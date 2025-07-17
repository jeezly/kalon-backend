// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const upload = require('../config/upload');


// Obtener todos los usuarios (solo admin)
router.get('/', verifyAdmin, userController.getAllUsers);

// Actualizar estatus La Salle
router.put('/:id/lasalle', verifyAdmin, userController.updateLaSalleStatus);

// Resetear contraseña
router.put('/:id/reset-password', verifyAdmin, userController.resetPassword);

// Actualizar estado del usuario (activo/inactivo)
router.put('/:id/status', verifyAdmin, userController.updateUserStatus);

// Obtener información del usuario actual
router.get('/me', userController.getCurrentUser);
// Actualizar perfil del usuario (con posibilidad de imagen)
router.put('/:id', verifyToken, upload.single('foto_perfil'), userController.updateUser);
// En routes/userRoutes.js o donde manejes las rutas de usuario
router.get('/:id/historial', verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Obtener compras
    const [compras] = await pool.query(`
      SELECT p.*, pk.nombre AS paquete_nombre 
      FROM compras p
      JOIN paquetes pk ON p.paquete_id = pk.id
      WHERE p.usuario_id = ?
      ORDER BY p.fecha_compra DESC
    `, [userId]);

    // Obtener reservas
    const [reservas] = await pool.query(`
      SELECT r.*, c.nombre AS clase_nombre, co.nombre AS coach_nombre
      FROM reservas r
      JOIN horarios h ON r.horario_id = h.id
      JOIN clases c ON h.clase_id = c.id
      JOIN coaches co ON h.coach_id = co.id
      WHERE r.usuario_id = ?
      ORDER BY r.fecha_reserva DESC
    `, [userId]);

    // Formatear respuesta
    const historial = [
      ...compras.map(c => ({
        tipo: 'compra',
        titulo: `Compra de paquete ${c.paquete_nombre}`,
        descripcion: `Créditos: ${c.creditos}`,
        fecha: c.fecha_compra,
        monto: c.monto_total,
        creditos: c.creditos
      })),
      ...reservas.map(r => ({
        tipo: 'clase',
        titulo: `Clase de ${r.clase_nombre}`,
        descripcion: `Con ${r.coach_nombre} - ${r.estado}`,
        fecha: r.fecha_reserva,
        monto: null,
        creditos: -1
      }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json({ success: true, data: historial });
  } catch (error) {
    console.error('Error en historial:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
});

router.post('/validate-recovery', userController.validateRecoveryAndReset);

module.exports = router;