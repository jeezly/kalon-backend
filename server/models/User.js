const pool = require('../config/db');

class User {
  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    return rows[0];
  }

  static async getById(id) {
  const [rows] = await pool.query(`
    SELECT id, nombre, apellidos, email, telefono, genero, rol, foto_perfil,
           es_estudiante_lasalle, matricula_lasalle
    FROM usuarios WHERE id = ?
  `, [id]);
  return rows[0];
}

  static async create({ nombre, apellidos, email, password, telefono, genero = 'otro' }) {
    const [result] = await pool.query(
      `INSERT INTO usuarios 
      (nombre, apellidos, email, password, telefono, genero, verificado) 
      VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [nombre, apellidos, email, password, telefono, genero]
    );
    return { id: result.insertId, nombre, email };
  }

  static async updateProfile(id, { nombre, telefono, fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil }) {
  await pool.query(
    `UPDATE usuarios SET 
    nombre = ?,
    telefono = ?, 
    fecha_nacimiento = ?,
    contacto_emergencia_nombre = ?,
    contacto_emergencia_telefono = ?,
    foto_perfil = COALESCE(?, foto_perfil)
    WHERE id = ?`,
    [nombre, telefono, fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_telefono, foto_perfil, id]
  );
  return true;
}

  static async updateLaSalleStatus(id, isLaSalle, matricula = null) {
    await pool.query(
      `UPDATE usuarios SET 
      es_estudiante_lasalle = ?,
      matricula_lasalle = ?
      WHERE id = ?`,
      [isLaSalle, matricula, id]
    );
    return true;
  }

  static async updatePassword(id, newPassword) {
    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [newPassword, id]
    );
    return true;
  }

  static async getAllClients() {
  const [rows] = await pool.query(
    `SELECT id, nombre, apellidos, email, telefono, 
    es_estudiante_lasalle, fecha_registro, activo
    FROM usuarios WHERE rol = 'cliente'`
  );
  return rows;
}
}

module.exports = User;