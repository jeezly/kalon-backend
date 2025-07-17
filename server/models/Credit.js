const pool = require('../config/db');

class Credit {
  static async addCredits(userId, purchaseId, classes, expirationDate) {
    const [result] = await pool.query(
      `INSERT INTO creditos 
      (usuario_id, compra_id, clases_disponibles, fecha_expiracion, activo)
      VALUES (?, ?, ?, ?, TRUE)`,
      [userId, purchaseId, classes, expirationDate]
    );
    return result.insertId;
  }

  static async getUserCredits(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM vista_creditos_usuarios 
      WHERE usuario_id = ? AND activo = TRUE 
      AND fecha_expiracion >= CURDATE()`,
      [userId]
    );
    return rows;
  }

  static async getValidCreditForClass(userId, classType) {
    const [rows] = await pool.query(
      `SELECT cr.* FROM creditos cr
      JOIN compras co ON cr.compra_id = co.id
      JOIN paquetes p ON co.paquete_id = p.id
      WHERE cr.usuario_id = ? AND cr.activo = TRUE 
      AND cr.fecha_expiracion >= CURDATE()
      AND p.tipo_clase = ?
      AND (cr.clases_disponibles - cr.clases_usadas) > 0
      ORDER BY cr.fecha_expiracion ASC
      LIMIT 1`,
      [userId, classType]
    );
    return rows[0];
  }

  static async useCredit(creditId) {
    await pool.query(
      'UPDATE creditos SET clases_usadas = clases_usadas + 1 WHERE id = ?',
      [creditId]
    );
    return true;
  }

  static async returnCredit(creditId) {
    await pool.query(
      'UPDATE creditos SET clases_usadas = clases_usadas - 1 WHERE id = ?',
      [creditId]
    );
    return true;
  }
  static async existsForPurchase(purchaseId) {
  const [rows] = await pool.query(
    'SELECT id FROM creditos WHERE compra_id = ? LIMIT 1',
    [purchaseId]
  );
  return rows.length > 0;
}

}


module.exports = Credit;