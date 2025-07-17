const pool = require('../config/db');

class Config {
  static async get(key) {
    const [rows] = await pool.query(
      'SELECT valor FROM configuraciones WHERE clave = ?',
      [key]
    );
    return rows[0]?.valor;
  }

  static async getAll() {
    const [rows] = await pool.query('SELECT * FROM configuraciones');
    return rows;
  }

  static async update(key, value) {
    await pool.query(
      'UPDATE configuraciones SET valor = ? WHERE clave = ?',
      [value, key]
    );
    return true;
  }
}

module.exports = Config;