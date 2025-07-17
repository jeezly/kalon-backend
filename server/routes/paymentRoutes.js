const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController'); // Solo una declaración
const { verifyToken } = require('../middleware/authMiddleware');

// Rutas
router.post('/stripe', verifyToken, PaymentController.processStripePayment);
router.get('/pending', verifyToken, PaymentController.getPendingPayments);
router.put('/:id/complete', verifyToken, PaymentController.markAsPaid);
router.put('/:id/cancel', verifyToken, PaymentController.cancelPayment);

module.exports = router;