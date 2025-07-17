const pool = require('../config/db');

class Schedule {
  static async getAvailable() {
    const [rows] = await pool.query('SELECT * FROM vista_horarios_disponibles');
    return rows;
  }

  static async getAll() {
    const [rows] = await pool.query(
      `SELECT h.*, c.nombre AS clase_nombre, co.nombre AS coach_nombre
      FROM horarios h
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      ORDER BY h.dia_semana, h.hora_inicio`
    );
    return rows;
  }

  static async getByDay(day) {
    const [rows] = await pool.query(
      `SELECT h.*, c.nombre AS clase_nombre, co.nombre AS coach_nombre
      FROM horarios h
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      WHERE h.dia_semana = ? AND h.activo = TRUE
      ORDER BY h.hora_inicio`,
      [day]
    );
    return rows;
  }

 static async getById(id) {
  const query = `
    SELECT 
      h.*,
      c.nombre AS clase_nombre,
      co.nombre AS coach_nombre
    FROM horarios h
    JOIN clases c ON h.clase_id = c.id
    JOIN coaches co ON h.coach_id = co.id
    WHERE h.id = ?
  `;
  const [rows] = await pool.query(query, [id]);
  return rows[0];
}

  static async getByClassType(classType) {
    const [rows] = await pool.query(
      `SELECT h.*, c.nombre AS clase_nombre, co.nombre AS coach_nombre
      FROM horarios h
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      WHERE c.nombre = ? AND h.activo = TRUE AND c.activa = TRUE AND co.activo = TRUE
      ORDER BY h.dia_semana, h.hora_inicio`,
      [classType]
    );
    return rows;
  }

  static async create(scheduleData) {
    const { clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = scheduleData;
    const [result] = await pool.query(
      `INSERT INTO horarios 
      (clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, activo)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo]
    );
    return result.insertId;
  }

  static async update(id, scheduleData) {
    const { clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, activo } = scheduleData;
    await pool.query(
      `UPDATE horarios SET 
      clase_id = ?, coach_id = ?, dia_semana = ?, 
      hora_inicio = ?, hora_fin = ?, cupo_maximo = ?, activo = ?
      WHERE id = ?`,
      [clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo, activo, id]
    );
    return true;
  }

  static async deactivate(id) {
    await pool.query('UPDATE horarios SET activo = FALSE WHERE id = ?', [id]);
    return true;
  }

static async getReservationsForSchedule(scheduleId) {
  const query = `
    SELECT 
      r.*,
      u.nombre AS usuario_nombre,
      u.apellidos AS usuario_apellidos,
      u.es_estudiante_lasalle AS es_la_salle
    FROM reservas r
    JOIN usuarios u ON r.usuario_id = u.id
    WHERE r.horario_id = ? AND r.estado != 'cancelada'
  `;
  const [rows] = await pool.query(query, [scheduleId]);
  return rows;
}
}

module.exports = Schedule;