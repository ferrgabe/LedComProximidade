const Device = require('../models/Device');
const { handleMessage } = require('../services/deviceService');
const { broadcastToClients, broadcastDeviceList, sendMessage, sendError } = require('../utils/websocketUtils');

module.exports = function(wss) {
  const connectedDevices = new Map();

  wss.on('connection', async (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    const deviceId = generateDeviceId();
    
    console.log(`🔌 Nova conexão WebSocket de ${clientIP} - ID: ${deviceId}`);
    
    const deviceInfo = {
      id: deviceId,
      ws: ws,
      ip: clientIP,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true,
      deviceType: 'unknown',
      mac: null,
      version: null
    };
    
    connectedDevices.set(deviceId, deviceInfo);
    
    try {
      await Device.findOneAndUpdate(
        { deviceId },
        { 
          deviceId,
          ip: clientIP,
          connectedAt: new Date(),
          lastHeartbeat: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Erro ao salvar dispositivo no MongoDB:', err);
    }
    
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
      deviceInfo.lastHeartbeat = new Date();
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(deviceId, message, ws, connectedDevices);
      } catch (error) {
        console.error(`❌ Erro ao processar mensagem de ${deviceId}:`, error);
        sendError(ws, 'Invalid JSON format');
      }
    });
    
    ws.on('close', async (code, reason) => {
      console.log(`🔌 Dispositivo ${deviceId} desconectado - Código: ${code}, Razão: ${reason}`);
      
      try {
        await Device.findOneAndUpdate(
          { deviceId },
          { isActive: false, lastHeartbeat: new Date() }
        );
      } catch (err) {
        console.error('Erro ao atualizar status do dispositivo:', err);
      }
      
      connectedDevices.delete(deviceId);
      broadcastDeviceList(connectedDevices);
    });
    
    ws.on('error', (error) => {
      console.error(`❌ Erro WebSocket para ${deviceId}:`, error);
    });
    
    sendMessage(ws, {
      type: 'welcome',
      deviceId: deviceId,
      timestamp: new Date().toISOString()
    });
    
    broadcastDeviceList(connectedDevices);
  });

  // Ping para manter conexões ativas
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });
};

function generateDeviceId() {
  return 'device_' + Math.random().toString(36).substr(2, 9);
}