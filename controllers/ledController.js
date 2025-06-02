const LedConfig = require('../models/LedConfig');
const { connectedDevices, sendMessage } = require('./websocketController');

exports.getLedConfigs = async (req, res) => {
  try {
    const { deviceId, limit, sort } = req.query;
    
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    
    const sortOption = sort === 'asc' ? { timestamp: 1 } : { timestamp: -1 };
    
    const configs = await LedConfig.find(query)
      .sort(sortOption)
      .limit(parseInt(limit) || 100);
    
    res.json({
      count: configs.length,
      configs: configs
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações de LED' });
  }
};

exports.getLatestLedConfig = async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    
    const latestConfig = await LedConfig.findOne(query)
      .sort({ timestamp: -1 });
    
    res.json(latestConfig);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar última configuração de LED' });
  }
};

exports.sendLedCommand = async (req, res) => {
  const deviceId = req.params.deviceId;
  const { command, parameters } = req.body;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  try {
    const ledConfig = new LedConfig({
      deviceId: deviceId,
      ...parameters,
      timestamp: new Date()
    });
    await ledConfig.save();
    
    const commandMessage = {
      type: 'command',
      command: command,
      parameters: parameters || {},
      timestamp: new Date().toISOString()
    };
    
    sendMessage(device.ws, commandMessage);
    
    res.json({
      status: 'sent',
      deviceId: deviceId,
      command: command
    });
  } catch (err) {
    console.error('Erro ao salvar configuração de LED:', err);
    res.status(500).json({ error: 'Failed to save LED configuration' });
  }
};