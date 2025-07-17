const pool = require('../config/db');
const Schedule = require('../models/Schedule');

const scheduleController = {
  getSchedulesByClassType: async (req, res) => {
    try {
      const { classType } = req.query;
      
      if (!classType) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro classType es requerido'
        });
      }

      const schedules = await Schedule.getByClassType(classType);

      res.json({
        success: true,
        count: schedules.length,
        data: schedules
      });

    } catch (error) {
      console.error('Error en getSchedulesByClassType:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener horarios',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  getAvailableSchedules: async (req, res) => {
    try {
      const schedules = await Schedule.getAvailable();
      
      res.json({
        success: true,
        count: schedules.length,
        data: schedules
      });
      
    } catch (error) {
      console.error('Error en getAvailableSchedules:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener horarios disponibles',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

getScheduleById: async (req, res) => {
  try {
    const { id } = req.params;
    
    // Consulta mejorada con todos los JOINs necesarios
    const query = `
      SELECT 
        h.id, h.dia_semana, h.hora_inicio, h.hora_fin, 
        h.cupo_maximo, h.cupo_actual, h.activo,
        c.id AS clase_id, c.nombre AS clase_nombre,
        co.id AS coach_id, co.nombre AS coach_nombre, co.especialidad AS coach_especialidad
      FROM horarios h
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      WHERE h.id = ?
    `;
    
    const [rows] = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Horario no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error en getScheduleById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener horario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},

  getAllSchedules: async (req, res) => {
  try {
    const schedules = await Schedule.getAll();
    
    res.json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    console.error('Error en getAllSchedules:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener todos los horarios'
    });
  }
  },
 getReservationsForSchedule: async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        r.id, r.estado, r.fecha_reserva,
        u.id AS usuario_id, 
        CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
        u.es_estudiante_lasalle AS es_la_salle,
        u.matricula_lasalle
      FROM reservas r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.horario_id = ? AND r.estado != 'cancelada'
      ORDER BY r.fecha_reserva DESC
    `;
    
    const [reservations] = await pool.query(query, [id]);
    
    res.json({
      success: true,
      count: reservations.length,
      data: reservations
    });
  } catch (error) {
    console.error('Error en getReservationsForSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener reservaciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},

  createSchedule: async (req, res) => {
    try {
      const scheduleId = await Schedule.create(req.body);
      
      const newSchedule = await Schedule.getById(scheduleId);
      
      res.status(201).json({
        success: true,
        message: 'Horario creado exitosamente',
        data: newSchedule
      });
    } catch (error) {
      console.error('Error en createSchedule:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear horario',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  updateSchedule: async (req, res) => {
  try {
    const { id } = req.params;
    const updatedSchedule = await Schedule.update(id, req.body);
    
    res.json({
      success: true,
      data: updatedSchedule
    });
  } catch (error) {
    console.error('Error en updateSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar horario'
    });
  }
},

  deleteSchedule: async (req, res) => {
    try {
      const { id } = req.params;
      await Schedule.deactivate(id);
      
      res.json({
        success: true,
        message: 'Horario eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error en deleteSchedule:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar horario',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = scheduleController;