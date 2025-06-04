const WebSocket = require('ws');

function sendMessage(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem WebSocket:', error);
    }
  }
}

function sendError(ws, error) {
  sendMessage(ws, {
    type: 'error',
    message: error,
    timestamp: new Date().toISOString()
  });
}

function broadcastToClients(message, connectedDevices, excludeDeviceId = null) {
  if (!connectedDevices) return;
  
  connectedDevices.forEach((device, deviceId) => {
    if (deviceId !== excludeDeviceId && device.ws) {
      sendMessage(device.ws, message);
    }
  });
}

function broadcastDeviceList(connectedDevices) {
  if (!connectedDevices) return;
  
  const deviceList = Array.from(connectedDevices.keys());
  broadcastToClients({
    type: 'device_list_update',
    devices: deviceList,
    count: deviceList.length,
    timestamp: new Date().toISOString()
  }, connectedDevices);
}

module.exports = {
  sendMessage,
  sendError,
  broadcastToClients,
  broadcastDeviceList
};