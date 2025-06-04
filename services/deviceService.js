const Device = require('../models/Device');
const LedConfig = require('../models/LedConfig');
const SensorData = require('../models/SensorData');
const { broadcastToClients, broadcastDeviceListFn, broadcastDeviceList, sendMessage, sendError } = require('../utils/websocketUtils');

async function handleIdentification(deviceId, message, ws, connectedDevices, broadcastDeviceListFn) {
  const device = connectedDevices.get(deviceId);
  device.deviceType = message.device || 'unknown';
  device.mac = message.mac;
  device.version = message.version;
  device.deviceIP = message.ip;
  
  console.log(`🔍 Dispositivo identificado: ${device.deviceType} (MAC: ${device.mac})`);
  
  try {
    await Device.findOneAndUpdate(
      { deviceId },
      {
        deviceType: device.deviceType,
        mac: device.mac,
        version: device.version,
        deviceIP: device.deviceIP,
        lastHeartbeat: new Date()
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar identificação do dispositivo:', err);
  }
  
  sendMessage(ws, {
    type: 'identification_ack',
    status: 'confirmed',
    timestamp: new Date().toISOString()
  });
  
  // Chamada corrigida da função broadcast
  broadcastDeviceList(connectedDevices);
}
async function handleHeartbeat(deviceId, message, connectedDevices) {
  const device = connectedDevices.get(deviceId);
  device.lastHeartbeat = new Date();
  device.uptime = message.uptime;
  
  console.log(`💓 Heartbeat de ${deviceId} - Uptime: ${message.uptime}s`);
  
  try {
    await Device.findOneAndUpdate(
      { deviceId },
      {
        lastHeartbeat: new Date(),
        uptime: message.uptime,
        isActive: true
      }
    );
  } catch (err) {
    console.error('Erro ao atualizar heartbeat do dispositivo:', err);
  }
}

async function handleResponse(deviceId, message, connectedDevices) {
  console.log(`📋 Resposta de ${deviceId}:`, message);
  
  broadcastToClients({
    type: 'device_response',
    deviceId: deviceId,
    data: message,
    timestamp: new Date().toISOString()
  }, connectedDevices, deviceId);
}

async function handleStatus(deviceId, message, connectedDevices) {
  const device = connectedDevices.get(deviceId);
  device.status = message;
  
  console.log(`📊 Status de ${deviceId}:`, message);
  
  try {
    await Device.findOneAndUpdate(
      { deviceId },
      { status: message, lastHeartbeat: new Date() }
    );
  } catch (err) {
    console.error('Erro ao atualizar status do dispositivo:', err);
  }
  
  broadcastToClients({
    type: 'device_status',
    deviceId: deviceId,
    status: message,
    timestamp: new Date().toISOString()
  }, connectedDevices, deviceId);
}

async function handleSensorData(deviceId, message) {
  console.log(`🌡️  Dados do sensor de ${deviceId}: ${message.sensor} = ${message.value}`);
  
  try {
    const sensorData = new SensorData({
      deviceId,
      sensor: message.sensor,
      value: message.value,
      timestamp: message.timestamp || new Date()
    });
    await sensorData.save();
  } catch (err) {
    console.error('Erro ao salvar dados do sensor:', err);
  }
  
  broadcastToClients({
    type: 'sensor_data',
    deviceId: deviceId,
    sensor: message.sensor,
    value: message.value,
    timestamp: message.timestamp
  }, connectedDevices, deviceId);
}

async function handleLedUpdate(deviceId, message, ws) {
  console.log(`💡 Atualização de LED de ${deviceId}:`, message.parameters);
  
  try {
    const ledConfig = new LedConfig({
      deviceId: deviceId,
      ...message.parameters,
      timestamp: new Date()
    });
    
    await ledConfig.save();
    console.log(`✅ Configuração de LED salva para ${deviceId}`);
    
    sendMessage(ws, {
      type: 'led_update_ack',
      status: 'saved',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Erro ao salvar configuração de LED:', err);
    sendError(ws, 'Failed to save LED configuration');
  }
}

async function handleMessage(deviceId, message, ws, connectedDevices, broadcasDeviceListFn) {
  const device = connectedDevices.get(deviceId);
  if (!device) return;
  
  console.log(`📨 Mensagem de ${deviceId}:`, message);
  
  switch (message.type) {
    case 'identification':
      await handleIdentification(deviceId, message, ws, connectedDevices, broadcastDeviceListFn);
      break;
    case 'heartbeat':
      await handleHeartbeat(deviceId, message, connectedDevices);
      break;
    case 'response':
      await handleResponse(deviceId, message, connectedDevices);
      break;
    case 'status':
      await handleStatus(deviceId, message, connectedDevices);
      break;
    case 'sensor_data':
      await handleSensorData(deviceId, message, connectedDevices);
      break;
    case 'led_update':
      await handleLedUpdate(deviceId, message, ws);
      break;
    case 'pong':
      console.log(`🏓 Pong recebido de ${deviceId}`);
      break;
    default:
      console.log(`⚠️  Tipo de mensagem desconhecido: ${message.type}`);
  }
}

module.exports = {
  handleMessage,
  handleIdentification,
  handleHeartbeat,
  handleResponse,
  handleStatus,
  handleSensorData,
  handleLedUpdate
};