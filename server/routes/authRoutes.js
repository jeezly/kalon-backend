const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Rutas públicas
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Middleware de autenticación
router.use(AuthController.verifyToken);

// Rutas protegidas (requieren autenticación)
router.get('/me', (req, res) => {
  res.json({ 
    success: true, 
    user: req.user 
  });
});

module.exports = router;