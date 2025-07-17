const Class = require('../models/Class');

const classController = {
  getAllClasses: async (req, res) => {
    try {
      const classes = await Class.getAllActive();
      res.json({
        success: true,
        data: classes
      });
    } catch (error) {
      console.error('Error en getAllClasses:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener clases'
      });
    }
  },

  getClassById: async (req, res) => {
    try {
      const { id } = req.params;
      const classItem = await Class.getById(id);
      
      if (!classItem) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada'
        });
      }
      
      res.json({
        success: true,
        data: classItem
      });
    } catch (error) {
      console.error('Error en getClassById:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener la clase'
      });
    }
  }
};

module.exports = classController;