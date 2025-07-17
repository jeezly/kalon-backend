const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { verifyToken } = require('../middleware/authMiddleware');

// Obtener compras del usuario
router.get('/user', verifyToken, purchaseController.getUserPurchases);
// Crear una nueva compra
router.post('/', verifyToken, purchaseController.createPurchase);

module.exports = router;