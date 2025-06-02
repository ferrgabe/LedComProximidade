const express = require('express');
const router = express.Router();
const ledController = require('../controllers/ledController');

router.get('/', ledController.getLedConfigs);
router.get('/latest', ledController.getLatestLedConfig);
router.post('/:deviceId/command', ledController.sendLedCommand);

module.exports = router;