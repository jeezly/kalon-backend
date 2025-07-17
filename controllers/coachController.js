// server/controllers/coachController.js
const Coach = require('../models/Coach');

const coachController = {
  getAllCoaches: async (req, res) => {
    try {
      const coaches = await Coach.getAllActive();
      res.json({
        success: true,
        data: coaches
      });
    } catch (error) {
      console.error('Error en getAllCoaches:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener coaches'
      });
    }
  },

  getCoachesBySpecialty: async (req, res) => {
    try {
      const { specialty } = req.params;
      const coaches = await Coach.getBySpecialty(specialty);
      
      res.json({
        success: true,
        data: coaches
      });
    } catch (error) {
      console.error('Error en getCoachesBySpecialty:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener coaches por especialidad'
      });
    }
  },

  getCoachById: async (req, res) => {
    try {
      const { id } = req.params;
      const coach = await Coach.getById(id);
      
      if (!coach) {
        return res.status(404).json({
          success: false,
          message: 'Coach no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: coach
      });
    } catch (error) {
      console.error('Error en getCoachById:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener el coach'
      });
    }
  },

  createCoach: async (req, res) => {
    try {
      const { nombre, foto, especialidad } = req.body;
      
      if (!nombre || !especialidad) {
        return res.status(400).json({
          success: false,
          message: 'Nombre y especialidad son requeridos'
        });
      }
      
      const newCoachId = await Coach.create(nombre, foto || 'default.jpg', especialidad);
      
      const newCoach = await Coach.getById(newCoachId);
      
      res.status(201).json({ 
        success: true,
        data: newCoach
      });
    } catch (error) {
      console.error('Error en createCoach:', error);
      res.status(400).json({ 
        success: false,
        message: 'Error al crear coach'
      });
    }
  },

 // En coachController.js
 updateCoach: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, especialidad, activo } = req.body;
      
      // Manejo de la foto
      let foto = req.body.foto;
      if (req.file) {
        foto = req.file.filename; // Asume que multer guarda el nombre del archivo
      }

      // Si no hay foto nueva, mantener la existente
      if (!foto && foto !== null) {
        const [existingCoach] = await pool.query('SELECT foto FROM coaches WHERE id = ?', [id]);
        foto = existingCoach[0].foto;
      }

      // Construir la consulta dinámicamente
      const updates = [];
      const params = [];
      
      if (nombre !== undefined && nombre !== null) {
        updates.push('nombre = ?');
        params.push(nombre);
      }
      
      if (foto !== undefined && foto !== null) {
        updates.push('foto = ?');
        params.push(foto);
      }
      
      if (especialidad !== undefined && especialidad !== null) {
        updates.push('especialidad = ?');
        params.push(especialidad);
      }
      
      if (activo !== undefined && activo !== null) {
        updates.push('activo = ?');
        params.push(activo);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron campos para actualizar'
        });
      }
      
      params.push(id);
      
      const query = `UPDATE coaches SET ${updates.join(', ')} WHERE id = ?`;
      await pool.query(query, params);
      
      // Obtener y devolver el coach actualizado
      const updatedCoach = await Coach.getById(id);
      
      res.json({
        success: true,
        data: updatedCoach
      });
    } catch (error) {
      console.error('Error en updateCoach:', error);
      res.status(400).json({ 
        success: false,
        message: error.message || 'Error al actualizar coach'
      });
    }
  },


  deleteCoach: async (req, res) => {
    try {
      const { id } = req.params;
      await Coach.deactivate(id);
      
      res.json({ 
        success: true,
        message: 'Coach desactivado exitosamente'
      });
    } catch (error) {
      console.error('Error en deleteCoach:', error);
      res.status(400).json({ 
        success: false,
        message: 'Error al desactivar coach'
      });
    }
  }
};

module.exports = coachController;