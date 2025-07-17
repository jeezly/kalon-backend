const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/user', verifyToken, creditController.getUserCredits);
router.get('/active', verifyToken, creditController.getActiveCredits);

module.exports = router;