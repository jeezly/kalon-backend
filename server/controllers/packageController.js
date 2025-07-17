const Package = require('../models/package');
const pool = require('../config/db');

const packageController = {
  getAllPackages: async (req, res) => {
    try {
      const isLaSalle = req.user?.es_estudiante_lasalle || false;

      let packages = await Package.getAllActive();

      packages = packages.map(pkg => {
        const tiene_descuento = isLaSalle && pkg.precio_lasalle < pkg.precio_normal;

        return {
          ...pkg,
          precio_mostrar: isLaSalle ? pkg.precio_lasalle : pkg.precio_normal,
          tiene_descuento,
          mostrar_precio_lasalle: tiene_descuento // Solo lo mandamos si aplica
        };
      });

      res.json({
        success: true,
        data: packages,
        isLaSalle
      });
    } catch (error) {
      console.error('Error al obtener paquetes:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener paquetes',
        error: error.message
      });
    }
  },

  getPackagesByType: async (req, res) => {
    try {
      const { type } = req.params;
      const packages = await Package.getByType(type);
      res.json({ success: true, data: packages });
    } catch (error) {
      console.error('Error al obtener paquetes por tipo:', error);
      res.status(500).json({ success: false, message: 'Error al obtener paquetes por tipo' });
    }
  },

  getPackageById: async (req, res) => {
    try {
      const { id } = req.params;
      const pkg = await Package.getById(id);

      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Paquete no encontrado' });
      }

      res.json({ success: true, data: pkg });
    } catch (error) {
      console.error('Error al obtener paquete por ID:', error);
      res.status(500).json({ success: false, message: 'Error al obtener paquete' });
    }
  },

  createPackage: async (req, res) => {
    try {
      const packageData = req.body;
      const newPackageId = await Package.create(packageData);
      const newPackage = await Package.getById(newPackageId);

      res.status(201).json({ 
        success: true, 
        message: 'Paquete creado exitosamente',
        data: newPackage
      });
    } catch (error) {
      console.error('Error al crear paquete:', error);
      res.status(500).json({ success: false, message: 'Error al crear paquete' });
    }
  },

  updatePackage: async (req, res) => {
    try {
      const { id } = req.params;
      const packageData = req.body;

      await Package.update(id, packageData);
      const updatedPackage = await Package.getById(id);

      res.json({ 
        success: true, 
        message: 'Paquete actualizado exitosamente',
        data: updatedPackage
      });
    } catch (error) {
      console.error('Error al actualizar paquete:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar paquete' });
    }
  },

  deletePackage: async (req, res) => {
    try {
      const { id } = req.params;
      await Package.deactivate(id);

      res.json({ 
        success: true, 
        message: 'Paquete desactivado exitosamente'
      });
    } catch (error) {
      console.error('Error al desactivar paquete:', error);
      res.status(500).json({ success: false, message: 'Error al desactivar paquete' });
    }
  }
};

module.exports = packageController;
