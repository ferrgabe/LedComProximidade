const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

// Rotas para dispositivos
router.get('/', deviceController.getAllDevices);
router.get('/active', deviceController.getActiveDevices);
router.get('/:deviceId', deviceController.getDeviceById);
router.get('/:deviceId/history', deviceController.getDeviceHistory);
router.post('/:deviceId/command', deviceController.sendCommand);
router.post('/:deviceId/ping', deviceController.pingDevice);
router.put('/:deviceId', deviceController.updateDevice);

module.exports = router;