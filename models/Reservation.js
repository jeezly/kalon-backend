const pool = require('../config/db');

class Reservation {
  static async create(userId, scheduleId, creditId = null) {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 1. Verificar que el horario existe y tiene cupo
      const [schedule] = await connection.query(
        `SELECT h.cupo_maximo, h.cupo_actual, c.nombre AS clase_nombre 
         FROM horarios h
         JOIN clases c ON h.clase_id = c.id
         WHERE h.id = ? AND h.activo = TRUE FOR UPDATE`,
        [scheduleId]
      );

      if (!schedule[0]) {
        throw new Error('Horario no encontrado o inactivo');
      }

      if (schedule[0].cupo_actual >= schedule[0].cupo_maximo) {
        throw new Error('No hay cupo disponible para esta clase');
      }

      // 2. Validar crédito si es necesario
      if (creditId) {
        const [credit] = await connection.query(
          `SELECT cr.id, p.tipo_clase 
           FROM creditos cr
           JOIN compras co ON cr.compra_id = co.id
           JOIN paquetes p ON co.paquete_id = p.id
           WHERE cr.id = ? AND cr.activo = TRUE
           AND cr.fecha_expiracion >= CURDATE()
           AND (cr.clases_disponibles - cr.clases_usadas) > 0 FOR UPDATE`,
          [creditId]
        );

        if (!credit[0]) {
          throw new Error('Crédito no válido o agotado');
        }

        if (credit[0].tipo_clase !== schedule[0].clase_nombre) {
          throw new Error('El crédito no es válido para este tipo de clase');
        }
      }

      // 3. Crear la reserva
      const [result] = await connection.query(
        `INSERT INTO reservas 
         (usuario_id, horario_id, credito_id, estado)
         VALUES (?, ?, ?, 'pendiente')`,
        [userId, scheduleId, creditId]
      );

      // 4. Actualizar cupo en horario
      await connection.query(
        `UPDATE horarios 
         SET cupo_actual = cupo_actual + 1 
         WHERE id = ?`,
        [scheduleId]
      );

      // 5. Actualizar crédito si aplica
      if (creditId) {
        await connection.query(
          `UPDATE creditos 
           SET clases_usadas = clases_usadas + 1 
           WHERE id = ?`,
          [creditId]
        );
      }

      await connection.commit();
      return result.insertId;

    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  static async cancel(reservationId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Obtener datos de la reserva con bloqueo
    const [reservation] = await connection.query(
      `SELECT r.*, h.dia_semana, h.hora_inicio 
       FROM reservas r
       JOIN horarios h ON r.horario_id = h.id
       WHERE r.id = ? AND r.estado = 'pendiente' FOR UPDATE`,
      [reservationId]
    );

    if (!reservation[0]) {
      throw new Error('Reservación no encontrada o no cancelable');
    }

    // 2. Verificar límite de tiempo (10 horas antes)
    const horaClase = new Date(`${reservation[0].dia_semana} ${reservation[0].hora_inicio}`);
    const horasRestantes = (horaClase - new Date()) / (1000 * 60 * 60);
    
    if (horasRestantes < 10) {
      throw new Error('Solo puedes cancelar con al menos 10 horas de anticipación');
    }

    // 3. Actualizar estado de la reserva
    await connection.query(
      `UPDATE reservas 
       SET estado = 'cancelada', fecha_cancelacion = NOW()
       WHERE id = ?`,
      [reservationId]
    );

    // 4. Disminuir cupo del horario (SOLO AQUÍ)
    await connection.query(
      `UPDATE horarios 
       SET cupo_actual = GREATEST(0, cupo_actual - 1) 
       WHERE id = ?`,
      [reservation[0].horario_id]
    );

    // 5. Devolver crédito si aplica
    if (reservation[0].credito_id) {
      await connection.query(
        `UPDATE creditos 
         SET clases_usadas = GREATEST(0, clases_usadas - 1) 
         WHERE id = ?`,
        [reservation[0].credito_id]
      );
    }

    await connection.commit();
    return true;

  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

  static async getUserReservations(userId, filters = {}) {
    try {
      let query = `
        SELECT 
          r.id, r.estado, r.fecha_reserva, r.horario_id,
          h.dia_semana, h.hora_inicio, h.hora_fin,
          c.nombre AS clase_nombre,
          co.nombre AS coach_nombre,
          co.especialidad AS coach_especialidad
        FROM reservas r
        JOIN horarios h ON r.horario_id = h.id
        JOIN clases c ON h.clase_id = c.id
        JOIN coaches co ON h.coach_id = co.id
        WHERE r.usuario_id = ?
      `;

      const params = [userId];
      
      // Aplicar filtros
      if (filters.estado) {
        query += ` AND r.estado = ?`;
        params.push(filters.estado);
      } else {
        query += ` AND r.estado != 'cancelada'`;
      }

      if (filters.fecha_inicio) {
        query += ` AND h.dia_semana >= ?`;
        params.push(filters.fecha_inicio);
      }

      if (filters.fecha_fin) {
        query += ` AND h.dia_semana <= ?`;
        params.push(filters.fecha_fin);
      }

      query += ` ORDER BY h.dia_semana, h.hora_inicio`;

      const [rows] = await pool.query(query, params);
      return rows;

    } catch (error) {
      console.error('Error al obtener reservas del usuario:', error);
      throw error;
    }
  }

  static async update(reservationId, updateData) {
    try {
      const { estado } = updateData;
      const estadosPermitidos = ['pendiente', 'asistio', 'no_show', 'cancelada'];
      
      if (!estadosPermitidos.includes(estado)) {
        throw new Error('Estado no válido');
      }

      const [result] = await pool.query(
        'UPDATE reservas SET estado = ? WHERE id = ?',
        [estado, reservationId]
      );

      return result.affectedRows > 0;

    } catch (error) {
      console.error('Error al actualizar reservación:', error);
      throw error;
    }
  }

  static async markAttendance(reservationId, attended) {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Verificar que la reserva existe
      const [reservation] = await connection.query(
        'SELECT id, estado FROM reservas WHERE id = ? FOR UPDATE',
        [reservationId]
      );
      
      if (!reservation[0]) {
        throw new Error('Reservación no encontrada');
      }

      if (reservation[0].estado !== 'pendiente') {
        throw new Error('Solo se puede marcar asistencia en reservaciones pendientes');
      }

      // Actualizar estado de asistencia
      await connection.query(
        `UPDATE reservas 
         SET estado = ? 
         WHERE id = ?`,
        [attended ? 'asistio' : 'no_show', reservationId]
      );

      await connection.commit();
      return true;

    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  static async getById(reservationId) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          r.*, 
          h.dia_semana, h.hora_inicio, h.hora_fin,
          c.nombre AS clase_nombre,
          co.nombre AS coach_nombre
         FROM reservas r
         JOIN horarios h ON r.horario_id = h.id
         JOIN clases c ON h.clase_id = c.id
         JOIN coaches co ON h.coach_id = co.id
         WHERE r.id = ?`,
        [reservationId]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('Error al obtener reserva por ID:', error);
      throw error;
    }
  }
}

module.exports = Reservation;