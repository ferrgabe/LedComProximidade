const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/', deviceController.getAllDevices);
router.get('/active', deviceController.getActiveDevices);
router.post('/:deviceId/command', deviceController.sendCommand);
router.post('/:deviceId/ping', deviceController.pingDevice);

module.exports = router;