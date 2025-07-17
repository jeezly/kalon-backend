const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const reservationController = require('../controllers/reservationController');

router.get('/user', verifyToken, reservationController.getUserReservations);
router.post('/', 
  express.json(),
  verifyToken,
  reservationController.createReservation
);router.put('/:id/cancel', verifyToken, reservationController.cancelReservation);

module.exports = router;