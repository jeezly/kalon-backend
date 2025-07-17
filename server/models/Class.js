const pool = require('../config/db');

class Class {
  static async getAllActive() {
    const [rows] = await pool.query('SELECT * FROM clases WHERE activa = TRUE');
    return rows;
  }

  static async getById(id) {
    const [rows] = await pool.query('SELECT * FROM clases WHERE id = ?', [id]);
    return rows[0];
  }

  static async getByType(type) {
    const [rows] = await pool.query(
      'SELECT * FROM clases WHERE nombre = ? AND activa = TRUE',
      [type]
    );
    return rows[0];
  }

  static async getByDifficulty(difficulty) {
    const [rows] = await pool.query(
      'SELECT * FROM clases WHERE dificultad = ? AND activa = TRUE',
      [difficulty]
    );
    return rows;
  }
}

module.exports = Class;