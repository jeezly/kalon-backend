const pool = require('../config/db');
const Reservation = require('../models/Reservation');
const Credit = require('../models/Credit');

const reservationController = {
  autoMarkAttendance: async (req, res) => {
  try {
    const { horarioId } = req.params;

    // 1. Obtener fecha y hora de la clase
    const [horario] = await pool.query(
      'SELECT dia_semana, hora_inicio FROM horarios WHERE id = ?',
      [horarioId]
    );

    if (!horario[0]) {
      return res.status(404).json({
        success: false,
        message: 'Horario no encontrado'
      });
    }

    const claseDateTime = new Date(`${horario[0].dia_semana}T${horario[0].hora_inicio}`);
    const ahora = new Date();

    // 2. Solo actualizar si la clase ya pasó
    if (ahora < claseDateTime) {
      return res.status(400).json({
        success: false,
        message: 'La clase aún no ha ocurrido, no se puede marcar asistencia automática'
      });
    }

    // 3. Actualizar las reservaciones "pendiente" a "asistio", excepto canceladas
    const [result] = await pool.query(
      `UPDATE reservas 
       SET estado = 'asistio'
       WHERE horario_id = ? AND estado = 'pendiente'`,
      [horarioId]
    );

    res.json({
      success: true,
      message: `Reservaciones actualizadas: ${result.affectedRows}`,
    });
  } catch (error) {
    console.error('Error en autoMarkAttendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar asistencia automáticamente',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},

  getUserReservations: async (req, res) => {
  try {
    const userId = req.user.id;
    const [reservations] = await pool.query(`
      SELECT 
        r.id, r.estado, r.horario_id,
        h.dia_semana, h.hora_inicio, h.hora_fin,
        c.nombre AS clase_nombre,
        co.nombre AS coach_nombre
      FROM reservas r
      JOIN horarios h ON r.horario_id = h.id
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      WHERE r.usuario_id = ? 
        AND r.estado = 'pendiente'
    `, [userId]);

    // Función para calcular la próxima fecha completa a partir del día y hora
    const getNextDateFromWeekday = (weekdayName, time) => {
      const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const today = new Date();
      const todayIndex = today.getDay();
      const targetIndex = weekdays.indexOf(weekdayName.toLowerCase());

      if (targetIndex === -1) return null;

      let diff = (targetIndex - todayIndex + 7) % 7;
      if (diff === 0) {
        const nowTime = today.toTimeString().slice(0, 5);
        if (nowTime >= time) diff = 7; // si ya pasó la hora de hoy, ir al próximo
      }

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      const [hour, minute] = time.split(':');
      targetDate.setHours(parseInt(hour), parseInt(minute), 0, 0);

      return targetDate;
    };

    // Construir resultados con fecha_reserva real
    const result = reservations.map(reserva => ({
      ...reserva,
      fecha_reserva: getNextDateFromWeekday(reserva.dia_semana, reserva.hora_inicio),
    }));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener reservas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},


  createReservation: async (req, res) => {
    try {
      const { scheduleId } = req.body;
      const userId = req.user.id;

      // 1. Verificar que el horario existe y está activo
      const [schedule] = await pool.query(`
        SELECT h.*, c.nombre AS tipo_clase 
        FROM horarios h
        JOIN clases c ON h.clase_id = c.id
        WHERE h.id = ? AND h.activo = TRUE
      `, [scheduleId]);

      if (!schedule[0]) {
        return res.status(404).json({ 
          success: false, 
          message: 'Horario no encontrado o inactivo' 
        });
      }

      const classType = schedule[0].tipo_clase;

      // 2. Verificar cupo disponible
      if (schedule[0].cupo_actual >= schedule[0].cupo_maximo) {
        return res.status(400).json({
          success: false,
          message: 'No hay cupo disponible para esta clase'
        });
      }

      // 3. Validar crédito (excepto para admins)
      let creditId = null;
      if (req.user.rol !== 'admin') {
        const credit = await Credit.getValidCreditForClass(userId, classType);
        if (!credit) {
          return res.status(400).json({
            success: false,
            message: `No tienes créditos disponibles para ${classType}`
          });
        }
        creditId = credit.id;
      }

      // 4. Crear reserva en la base de datos
      const reservationId = await Reservation.create(userId, scheduleId, creditId);

      // 5. Obtener los datos completos de la reserva creada
      const [newReservation] = await pool.query(`
        SELECT 
          r.*, 
          h.dia_semana, h.hora_inicio, h.hora_fin,
          c.nombre AS clase_nombre,
          co.nombre AS coach_nombre
        FROM reservas r
        JOIN horarios h ON r.horario_id = h.id
        JOIN clases c ON h.clase_id = c.id
        JOIN coaches co ON h.coach_id = co.id
        WHERE r.id = ?
      `, [reservationId]);

      res.status(201).json({ 
        success: true, 
        data: newReservation[0],
        message: 'Reserva creada exitosamente'
      });

    } catch (error) {
      console.error('Error al crear reserva:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al crear la reserva',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  updateReservation: async (req, res) => {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      
      const estadosPermitidos = ['pendiente', 'asistio', 'no_show', 'cancelada'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado no válido'
        });
      }

      const [result] = await pool.query(
        'UPDATE reservas SET estado = ? WHERE id = ?',
        [estado, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Reservación no encontrada'
        });
      }

      // Si se cancela, devolver crédito si aplica
      if (estado === 'cancelada') {
        const [reserva] = await pool.query(
          'SELECT credito_id FROM reservas WHERE id = ?',
          [id]
        );
        
        if (reserva[0]?.credito_id) {
          await pool.query(
            'UPDATE creditos SET clases_usadas = clases_usadas - 1 WHERE id = ?',
            [reserva[0].credito_id]
          );
        }
      }

      res.json({
        success: true,
        message: 'Reservación actualizada exitosamente'
      });
    } catch (error) {
      console.error('Error en updateReservation:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la reservación',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

cancelReservation: async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener datos de la reserva
    const [reservation] = await pool.query(
      'SELECT * FROM reservas WHERE id = ? AND estado = "pendiente"',
      [id]
    );
    
    if (!reservation[0]) {
      return res.status(404).json({
        success: false,
        message: 'Reservación no encontrada o no cancelable'
      });
    }

    // 2. Obtener el horario asociado
    const [horario] = await pool.query(
      'SELECT dia_semana, hora_inicio FROM horarios WHERE id = ?',
      [reservation[0].horario_id]
    );
    
    if (horario[0]) {
      const horaClase = new Date(`${horario[0].dia_semana} ${horario[0].hora_inicio}`);
      const horasRestantes = (horaClase - new Date()) / (1000 * 60 * 60);
      
      // Validar tiempo de cancelación (10 horas para todas las clases)
      if (horasRestantes < 10) {
        return res.status(400).json({
          success: false,
          message: 'Solo puedes cancelar con al menos 10 horas de anticipación'
        });
      }
    }


      // 3. Actualizar estado de la reserva
      await pool.query(
        `UPDATE reservas 
        SET estado = 'cancelada', fecha_cancelacion = NOW()
        WHERE id = ?`,
        [id]
      );

      // 4. Disminuir cupo del horario
      await pool.query(
        `UPDATE horarios 
        SET cupo_actual = cupo_actual - 1 
        WHERE id = ?`,
        [reservation[0].horario_id]
      );

      // 5. Devolver crédito si aplica
      if (reservation[0].credito_id) {
        await pool.query(
          `UPDATE creditos 
          SET clases_usadas = clases_usadas - 1 
          WHERE id = ?`,
          [reservation[0].credito_id]
        );
      }

      res.json({
        success: true,
        message: 'Reservación cancelada exitosamente'
      });
    } catch (error) {
      console.error('Error en cancelReservation:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cancelar la reservación',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  markAttendance: async (req, res) => {
    try {
      const { id } = req.params;
      const { attended } = req.body;
      
      // Verificar que la reserva existe
      const [reservation] = await pool.query(
        'SELECT id FROM reservas WHERE id = ?',
        [id]
      );
      
      if (!reservation[0]) {
        return res.status(404).json({
          success: false,
          message: 'Reservación no encontrada'
        });
      }

      // Actualizar estado de asistencia
      await pool.query(
        `UPDATE reservas 
        SET estado = ? 
        WHERE id = ?`,
        [attended ? 'asistio' : 'no_show', id]
      );

      res.json({
        success: true,
        message: `Asistencia marcada como ${attended ? 'asistió' : 'no asistió'}`
      });
    } catch (error) {
      console.error('Error en markAttendance:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar asistencia',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
};

module.exports = reservationController;