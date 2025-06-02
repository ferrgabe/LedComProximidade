function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
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
  connectedDevices.forEach((device, deviceId) => {
    if (deviceId !== excludeDeviceId) {
      sendMessage(device.ws, message);
    }
  });
}

function broadcastDeviceList(connectedDevices) {
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