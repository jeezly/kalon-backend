const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/authMiddleware'); // Usa el middleware existente
const ReportController = require('../controllers/reportController');


// Middleware de autenticación para todas las rutas de reportes
router.use(verifyAdmin); // Reemplaza AuthController.verifyToken con verifyAdmin

// Rutas de reportes
router.get('/financial', ReportController.getFinancialReport);
router.get('/attendance', ReportController.getAttendanceReport);
router.get('/user-activity', ReportController.getUserActivityReport);
router.get('/dashboard-stats', ReportController.getDashboardStats);
router.get('/recent-reservations', ReportController.getRecentReservations);

module.exports = router;