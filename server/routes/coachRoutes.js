const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const upload = require('../config/upload');

// Rutas públicas
router.get('/', coachController.getAllCoaches);
router.get('/specialty/:specialty', coachController.getCoachesBySpecialty);
router.get('/:id', coachController.getCoachById);

// Rutas de administración (SIN verifyAdmin)
router.post('/', upload.single('foto'), coachController.createCoach);
router.put('/:id', upload.single('foto'), coachController.updateCoach);
router.delete('/:id', coachController.deleteCoach);

module.exports = router;