const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');

// Obtener todos los paquetes activos
router.get('/', packageController.getAllPackages);

// Obtener paquetes por tipo de clase
router.get('/type/:type', packageController.getPackagesByType);

// Obtener un paquete específico por ID
router.get('/:id', packageController.getPackageById);

// Crear un nuevo paquete
router.post('/', packageController.createPackage);

// Actualizar un paquete existente
router.put('/:id', packageController.updatePackage);

// Eliminar (desactivar) un paquete
router.delete('/:id', packageController.deletePackage);

module.exports = router;