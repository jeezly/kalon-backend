const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

// Obtener todas las clases activas
router.get('/', classController.getAllClasses);

// Obtener una clase por ID
router.get('/:id', classController.getClassById);
router.get('/all', async (req, res) => {
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