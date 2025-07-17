const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const Schedule = require('../models/Schedule');
const Class = require('../models/Class');

// Middleware para validar parámetros de consulta
const validateQueryParams = (req, res, next) => {
  if (req.query.classType && typeof req.query.classType !== 'string') {
    return res.status(400).json({ 
      success: false,
      message: 'El parámetro classType debe ser una cadena de texto' 
    });
  }
  next();
};

// Middleware para validar ID
const validateId = (req, res, next) => {
  if (!req.params.id || isNaN(req.params.id)) {
    return res.status(400).json({ 
      success: false,
      message: 'ID de horario no válido' 
    });
  }
  next();
};

// Obtener horarios (todos o filtrados por tipo de clase)
router.get('/', validateQueryParams, (req, res) => {
  if (req.query.classType) {
    return scheduleController.getSchedulesByClassType(req, res);
  }
  return scheduleController.getAllSchedules(req, res);
});

// Obtener todos los horarios disponibles
router.get('/available', scheduleController.getAvailableSchedules);

// Obtener un horario específico por ID
router.get('/:id', validateId, scheduleController.getScheduleById);

// Obtener reservaciones para un horario específico
router.get('/:id/reservations', validateId, scheduleController.getReservationsForSchedule);

// Crear un nuevo horario
router.post('/', 
  express.json(),
  (req, res, next) => {
    if (!req.body.clase_id || !req.body.coach_id || !req.body.dia_semana) {
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos para crear horario'
      });
    }
    next();
  },
  scheduleController.createSchedule
);

// Actualizar un horario existente
router.put('/:id', 
  validateId,
  express.json(),
  scheduleController.updateSchedule
);

// Eliminar un horario
router.delete('/:id', validateId, scheduleController.deleteSchedule);

// Ruta para obtener todas las clases
router.get('/classes/all', async (req, res) => {
  try {
    const classes = await Class.getAllActive();
    res.json({
      success: true,
      data: classes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener las clases'
    });
  }
});

module.exports = router;