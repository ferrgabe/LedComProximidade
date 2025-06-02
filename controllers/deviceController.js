const Device = require('../models/Device');
const { connectedDevices } = require('./websocketController');
const { sendMessage } = require('../utils/websocketUtils');

exports.getAllDevices = async (req, res) => {
  try {
    const devices = await Device.find().sort({ connectedAt: -1 });
    res.json({
      count: devices.length,
      devices: devices
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dispositivos' });
  }
};

exports.getActiveDevices = (req, res) => {
  const devices = Array.from(connectedDevices.values()).map(device => ({
    id: device.id,
    deviceType: device.deviceType,
    mac: device.mac,
    ip: device.ip,
    deviceIP: device.deviceIP,
    connectedAt: device.connectedAt,
    lastHeartbeat: device.lastHeartbeat,
    version: device.version,
    status: device.status,
    uptime: device.uptime
  }));
  
  res.json({
    count: devices.length,
    devices: devices
  });
};

// Implementar outras funções do controller...