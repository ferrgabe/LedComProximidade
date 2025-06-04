const Device = require('../models/Device');
const { connectedDevices } = require('./websocketController');
const LedConfig = require('../models/LedConfig');
const { sendMessage } = require('../utils/websocketUtils');

exports.sendCommand = async (req, res) => {
  const deviceId = req.params.deviceId;
  const { command, parameters } = req.body;
  
  // Obter a instância atual de connectedDevices
  const connectedDevices = getConnectedDevices();
  
  console.log('Dispositivos conectados:', [...connectedDevices.keys()]);

  try {
    if (!connectedDevices) {
      throw new Error('Nenhum dispositivo conectado');
    }

    const device = connectedDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        error: 'Dispositivo não encontrado',
        connectedDevices: [...connectedDevices.keys()]
      });
    }

    if (command === 'led_update') {
      try {
        const ledConfig = new LedConfig({
          deviceId,
          ...parameters,
          timestamp: new Date()
        });
        await ledConfig.save();
      } catch (err) {
        console.error('Erro ao salvar LED:', err);
      }
    }

    const commandMessage = {
      type: 'command',
      command,
      parameters: parameters || {},
      timestamp: new Date().toISOString()
    };

    sendMessage(device.ws, commandMessage);
    
    res.json({
      status: 'success',
      deviceId,
      command
    });

  } catch (err) {
    console.error('Erro no sendCommand:', err);
    res.status(500).json({
      error: 'Erro ao enviar comando',
      details: err.message,
      systemError: err.stack // Apenas para desenvolvimento
    });
  }
};

// Obter todos os dispositivos do banco de dados
exports.getAllDevices = async (req, res) => {
  try {
    const devices = await Device.find().sort({ connectedAt: -1 });
    res.json({
      count: devices.length,
      devices: devices
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Erro ao buscar dispositivos',
      details: err.message 
    });
  }
};

// Obter apenas dispositivos ativos (conectados via WebSocket)
exports.getActiveDevices = (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao buscar dispositivos ativos',
      details: err.message
    });
  }
};

// Enviar comando para um dispositivo específico
exports.sendCommand = async (req, res) => {
  const deviceId = req.params.deviceId;
  const { command, parameters } = req.body;
  
  try {
    const device = connectedDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo não encontrado ou desconectado' });
    }

    // Se for comando de LED, salva no banco
    if (command === 'led_update') {
      try {
        const ledConfig = new LedConfig({
          deviceId: deviceId,
          ...parameters,
          timestamp: new Date()
        });
        await ledConfig.save();
      } catch (err) {
        console.error('Erro ao salvar configuração de LED:', err);
      }
    }

    const commandMessage = {
      type: 'command',
      command: command,
      parameters: parameters || {},
      timestamp: new Date().toISOString()
    };

    sendMessage(device.ws, commandMessage);
    
    console.log(`📤 Comando enviado para ${deviceId}: ${command}`);
    
    res.json({
      status: 'sent',
      deviceId: deviceId,
      command: command,
      parameters: parameters
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao enviar comando',
      details: err.message
    });
  }
};

// Enviar ping para um dispositivo
exports.pingDevice = async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    const device = connectedDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo não encontrado ou desconectado' });
    }

    sendMessage(device.ws, {
      type: 'ping',
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      status: 'ping sent',
      deviceId: deviceId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao enviar ping',
      details: err.message
    });
  }
};

// Obter informações de um dispositivo específico
exports.getDeviceById = async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    // Primeiro verifica se está ativo
    const activeDevice = connectedDevices.get(deviceId);
    if (activeDevice) {
      return res.json({
        isActive: true,
        device: {
          id: activeDevice.id,
          deviceType: activeDevice.deviceType,
          mac: activeDevice.mac,
          ip: activeDevice.ip,
          deviceIP: activeDevice.deviceIP,
          connectedAt: activeDevice.connectedAt,
          lastHeartbeat: activeDevice.lastHeartbeat,
          version: activeDevice.version,
          status: activeDevice.status,
          uptime: activeDevice.uptime
        }
      });
    }

    // Se não estiver ativo, busca no banco de dados
    const storedDevice = await Device.findOne({ deviceId });
    if (!storedDevice) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    res.json({
      isActive: false,
      device: storedDevice
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao buscar dispositivo',
      details: err.message
    });
  }
};

// Atualizar informações de um dispositivo
exports.updateDevice = async (req, res) => {
  const deviceId = req.params.deviceId;
  const updateData = req.body;
  
  try {
    const updatedDevice = await Device.findOneAndUpdate(
      { deviceId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDevice) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    res.json({
      status: 'updated',
      device: updatedDevice
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao atualizar dispositivo',
      details: err.message
    });
  }
};

// Obter histórico de conexões de um dispositivo
exports.getDeviceHistory = async (req, res) => {
  const deviceId = req.params.deviceId;
  
  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    // Aqui você pode adicionar lógica para buscar histórico mais detalhado
    // se tiver uma coleção separada para histórico
    
    res.json({
      deviceId: deviceId,
      connectionHistory: {
        firstSeen: device.connectedAt,
        lastSeen: device.lastHeartbeat,
        connectionCount: device.connectionCount || 1,
        isActive: connectedDevices.has(deviceId)
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao buscar histórico',
      details: err.message
    });
  }
};