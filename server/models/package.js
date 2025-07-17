const pool = require('../config/db');

class Package {
  static async getAllActive() {
    const [rows] = await pool.query(`
       SELECT 
        id,
        tipo_clase,
        nombre,
        incluye_clases,
        vigencia_dias,
        precio_normal,
        precio_lasalle
      FROM paquetes
      WHERE activo = TRUE
    `);
    return rows;
  }

  static async getById(id) {
    const [rows] = await pool.query('SELECT * FROM paquetes WHERE id = ?', [id]);
    return rows[0];
  }

  static async getByType(classType) {
    const [rows] = await pool.query(
      'SELECT * FROM paquetes WHERE tipo_clase = ? AND activo = TRUE',
      [classType]
    );
    return rows;
  }

  static async create(packageData) {
    const { tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle } = packageData;
    const [result] = await pool.query(
      `INSERT INTO paquetes 
      (tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle, activo)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle]
    );
    return result.insertId;
  }

  static async update(id, packageData) {
    const { tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle } = packageData;
    await pool.query(
      `UPDATE paquetes SET 
      tipo_clase = ?, nombre = ?, incluye_clases = ?, 
      vigencia_dias = ?, precio_normal = ?, precio_lasalle = ?
      WHERE id = ?`,
      [tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle, id]
    );
    return true;
  }

  static async deactivate(id) {
    await pool.query('UPDATE paquetes SET activo = FALSE WHERE id = ?', [id]);
    return true;
  }
}

module.exports = Package;