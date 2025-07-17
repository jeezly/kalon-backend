const Purchase = require('../models/Purchase');
const Credit = require('../models/Credit');
const pool = require('../config/db');

const purchaseController = {
getUserPurchases: async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Consulta mejorada para obtener compras con créditos activos
    const [purchases] = await pool.query(`
      SELECT 
        c.id,
        p.id AS paquete_id,
        p.tipo_clase,
        p.nombre AS paquete_nombre,
        p.incluye_clases,
        p.vigencia_dias,
        p.precio_normal,
        p.precio_lasalle,
        c.metodo_pago,
        c.fecha_compra,
        cr.id AS credito_id,
        cr.clases_disponibles,
        cr.clases_usadas,
        (cr.clases_disponibles - cr.clases_usadas) AS creditos_restantes,
        cr.fecha_expiracion,
        cr.activo,
        CASE 
          WHEN cr.fecha_expiracion >= CURDATE() AND 
               (cr.clases_disponibles - cr.clases_usadas) > 0 AND
               cr.activo = TRUE
          THEN TRUE ELSE FALSE 
        END AS tiene_creditos_activos
      FROM compras c
      JOIN paquetes p ON c.paquete_id = p.id
      LEFT JOIN creditos cr ON cr.compra_id = c.id
      WHERE c.usuario_id = ?
      ORDER BY c.fecha_compra DESC
    `, [userId]);

    res.json({
      success: true,
      data: purchases.filter(p => p.tiene_creditos_activos) // Solo paquetes con créditos activos
    });
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener compras',
      error: error.message
    });
  }
},

  createPurchase: async (req, res) => {
  const transaction = await pool.getConnection();
  try {
    await transaction.beginTransaction();
    
    const { usuario_id, paquete_id, metodo_pago, card_details } = req.body;
    const user = req.user || { id: usuario_id };

    // 1. Verificar y obtener el paquete
    const [paquete] = await transaction.query(
      'SELECT * FROM paquetes WHERE id = ? AND activo = TRUE',
      [paquete_id]
    );
    
    if (!paquete[0]) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Paquete no encontrado o inactivo' 
      });
    }
    
    // 2. Verificar si el usuario es estudiante La Salle
    const [usuario] = await transaction.query(
      'SELECT es_estudiante_lasalle FROM usuarios WHERE id = ?',
      [user.id]
    );
    
    const isLaSalle = usuario[0]?.es_estudiante_lasalle || false;
    const precio = isLaSalle ? paquete[0].precio_lasalle : paquete[0].precio_normal;
    
    // 3. Registrar la compra
    const [compra] = await transaction.query(
      `INSERT INTO compras 
      (usuario_id, paquete_id, metodo_pago, subtotal, total, estado)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        paquete_id,
        metodo_pago,
        precio,
        precio,
        metodo_pago === 'tarjeta' ? 'completada' : 'pendiente'
      ]
    );
    
    // 4. Manejar según método de pago
    if (metodo_pago === 'efectivo') {
      // Registrar pago pendiente
      const diasLimite = 3;
      await transaction.query(
        `INSERT INTO pagos_pendientes
        (compra_id, fecha_limite, monto, metodo_pago, estado)
        VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, 'pendiente')`,
        [compra.insertId, diasLimite, precio, metodo_pago]
      );
    } else if (metodo_pago === 'tarjeta') {
      // Crear créditos inmediatamente
      await transaction.query(
        `INSERT INTO creditos
        (usuario_id, compra_id, clases_disponibles, fecha_expiracion, activo)
        VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), TRUE)`,
        [user.id, compra.insertId, paquete[0].incluye_clases, paquete[0].vigencia_dias]
      );
    }
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: metodo_pago === 'tarjeta' ? 
        'Pago procesado exitosamente. Créditos asignados.' : 
        'Pago en efectivo registrado. Debes completar el pago en caja para activar tus créditos.',
      data: {
        compraId: compra.insertId,
        metodo_pago,
        total: precio,
        creditosInmediatos: metodo_pago === 'tarjeta' ? paquete[0].incluye_clases : 0
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en createPurchase:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar la compra',
      error: error.message
    });
  } finally {
    if (transaction) transaction.release();
  }
},

  // Método adicional para obtener detalles de una compra específica
  getPurchaseDetails: async (req, res) => {
    try {
      const { id } = req.params;
      const purchase = await Purchase.getById(id);
      
      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Compra no encontrada'
        });
      }
      
      // Verificar que el usuario sea el dueño de la compra o admin
      if (req.user.id !== purchase.usuario_id && req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para ver esta compra'
        });
      }
      
      res.json({
        success: true,
        data: purchase
      });
    } catch (error) {
      console.error('Error al obtener detalles de compra:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles de la compra'
      });
    }
  }
};

// Función auxiliar para validar datos de tarjeta (simplificada)
function validateCardDetails(card) {
  if (!card || !card.number || !card.name || !card.expiry || !card.cvc) {
    return false;
  }
  
  // Validación básica de número de tarjeta (simulada)
  const cardNumber = card.number.replace(/\s/g, '');
  if (cardNumber.length !== 16 || isNaN(cardNumber)) {
    return false;
  }
  
  // Validar fecha MM/YY
  if (!card.expiry.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)) {
    return false;
  }
  
  // Validar CVC (3-4 dígitos)
  if (!card.cvc.match(/^[0-9]{3,4}$/)) {
    return false;
  }
  
  return true;
}

// Función para simular pago con tarjeta (en producción usar pasarela real)
function simulateCardPayment(cardDetails, amount) {
  // Simular rechazo de ciertos números de prueba
  const cardNumber = cardDetails.number.replace(/\s/g, '');
  if (cardNumber.startsWith('4111') || cardNumber.endsWith('0000')) {
    return false; // Simular tarjeta rechazada
  }
  
  // En un 95% de casos simular éxito
  return Math.random() < 0.95;
}

module.exports = purchaseController;