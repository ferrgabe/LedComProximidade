const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.get('/', sensorController.getSensorData);
router.get('/stats', sensorController.getSensorStats);

module.exports = router;