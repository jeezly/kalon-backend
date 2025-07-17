const Credit = require('../models/Credit');

const creditController = {
  getUserCredits: async (req, res) => {
    try {
      const userId = req.user.id;
      const credits = await Credit.getUserCredits(userId);
      
      // Calcular total de créditos disponibles
      const totalCredits = credits.reduce((sum, credit) => {
        return sum + (credit.clases_disponibles - credit.clases_usadas);
      }, 0);

      res.json({
        success: true,
        data: {
          creditos: totalCredits,
          detalles: credits
        }
      });
    } catch (error) {
      console.error('Error al obtener créditos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener créditos del usuario'
      });
    }
  },

  getActiveCredits: async (req, res) => {
    try {
      const userId = req.user.id;
      const credits = await Credit.getActiveCredits(userId);
      
      res.json({
        success: true,
        data: credits
      });
    } catch (error) {
      console.error('Error al obtener créditos activos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener créditos activos'
      });
    }
  }
};

module.exports = creditController;