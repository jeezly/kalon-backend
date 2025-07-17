const pool = require('../config/db');
const Package = require('./package');
const Credit = require('../models/Credit');

class Purchase {
  static async create(userId, packageId, paymentMethod, isLaSalle = false, cardDetails = null) {
    const transaction = await pool.getConnection();
    try {
      await transaction.beginTransaction();

      // Obtener el paquete con verificación de existencia
      const pkg = await Package.getById(packageId);
      if (!pkg) {
        throw new Error('Paquete no encontrado');
      }

      // Calcular total según tipo de usuario
      const total = isLaSalle ? pkg.precio_lasalle : pkg.precio_normal;
      const estado = paymentMethod === 'efectivo' ? 'pendiente' : 'completada';

      // Crear la compra
      const [result] = await transaction.query(
        `INSERT INTO compras 
        (usuario_id, paquete_id, metodo_pago, subtotal, total, estado)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, packageId, paymentMethod, total, total, estado]
      );

      const compraId = result.insertId;

      // Si es pago en efectivo, crear registro en pagos_pendientes
      if (paymentMethod === 'efectivo') {
        const diasLimite = 3; // Puedes obtener esto de la tabla configuraciones
        await transaction.query(
          `INSERT INTO pagos_pendientes
          (compra_id, fecha_limite, monto, metodo_pago, estado)
          VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, 'pendiente')`,
          [compraId, diasLimite, total, paymentMethod]
        );
      }

      // Si es pago con tarjeta, crear créditos inmediatamente
      if (paymentMethod === 'tarjeta') {
        await Credit.addCredits(
          userId,
          compraId,
          pkg.incluye_clases,
          `DATE_ADD(CURDATE(), INTERVAL ${pkg.vigencia_dias} DAY)`,
          transaction
        );
      }

      await transaction.commit();
      return compraId;
    } catch (error) {
      await transaction.rollback();
      console.error('Error en Purchase.create:', error);
      throw error;
    } finally {
      if (transaction) transaction.release();
    }
  }

  static async getUserPurchases(userId) {
    const [rows] = await pool.query(
      `SELECT 
        c.*, 
        p.nombre AS paquete_nombre, 
        p.tipo_clase,
        p.incluye_clases,
        p.vigencia_dias,
        IFNULL(SUM(cr.clases_disponibles - cr.clases_usadas), 0) AS creditos_restantes
      FROM compras c
      JOIN paquetes p ON c.paquete_id = p.id
      LEFT JOIN creditos cr ON cr.compra_id = c.id AND cr.activo = TRUE AND cr.fecha_expiracion >= CURDATE()
      WHERE c.usuario_id = ?
      GROUP BY c.id
      ORDER BY c.fecha_compra DESC`,
      [userId]
    );
    return rows;
  }

  static async getById(id) {
    const [rows] = await pool.query(
      `SELECT 
        c.*, 
        p.nombre AS paquete_nombre,
        p.tipo_clase,
        p.incluye_clases,
        p.vigencia_dias,
        p.precio_normal,
        p.precio_lasalle,
        pp.estado AS estado_pago,
        pp.fecha_limite
      FROM compras c
      JOIN paquetes p ON c.paquete_id = p.id
      LEFT JOIN pagos_pendientes pp ON pp.compra_id = c.id
      WHERE c.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async completePurchase(compraId) {
    const transaction = await pool.getConnection();
    try {
      await transaction.beginTransaction();

      // Actualizar estado de la compra
      await transaction.query(
        `UPDATE compras SET estado = 'completada' WHERE id = ?`,
        [compraId]
      );

      // Obtener datos de la compra para crear créditos
      const [compra] = await transaction.query(
        `SELECT 
          c.usuario_id, 
          p.incluye_clases, 
          p.vigencia_dias 
        FROM compras c
        JOIN paquetes p ON c.paquete_id = p.id
        WHERE c.id = ?`,
        [compraId]
      );

      if (!compra[0]) {
        throw new Error('Compra no encontrada');
      }

      // Crear créditos
      await transaction.query(
        `INSERT INTO creditos
        (usuario_id, compra_id, clases_disponibles, fecha_expiracion, activo)
        VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), TRUE)`,
        [
          compra[0].usuario_id,
          compraId,
          compra[0].incluye_clases,
          compra[0].vigencia_dias
        ]
      );

      // Marcar pago pendiente como completado
      await transaction.query(
        `UPDATE pagos_pendientes 
        SET estado = 'completado', fecha_completado = NOW()
        WHERE compra_id = ?`,
        [compraId]
      );

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error('Error en completePurchase:', error);
      throw error;
    } finally {
      if (transaction) transaction.release();
    }
  }

  static async getPendingPurchases() {
    const [rows] = await pool.query(
      `SELECT 
        c.*, 
        p.nombre AS paquete_nombre,
        u.nombre AS usuario_nombre,
        u.email,
        pp.fecha_limite,
        DATEDIFF(pp.fecha_limite, CURDATE()) AS dias_restantes
      FROM compras c
      JOIN paquetes p ON c.paquete_id = p.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN pagos_pendientes pp ON pp.compra_id = c.id
      WHERE c.estado = 'pendiente'
      AND pp.estado = 'pendiente'
      ORDER BY pp.fecha_limite ASC`
    );
    return rows;
  }
}

module.exports = Purchase;