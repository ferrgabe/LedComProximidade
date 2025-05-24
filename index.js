const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configurações
const PORT = 8080;
const WS_PATH = '/ws';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Armazenar dispositivos conectados
const connectedDevices = new Map();

// Criar servidor WebSocket
const wss = new WebSocket.Server({ 
  server: server, 
  path: WS_PATH 
});

// Log de inicialização
console.log(`🚀 Servidor iniciando na porta ${PORT}`);
console.log(`📡 WebSocket disponível em ws://localhost:${PORT}${WS_PATH}`);

// Eventos do WebSocket
wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  //const deviceId = generateDeviceId();
  const deviceId = "1";
  
  console.log(`🔌 Nova conexão WebSocket de ${clientIP} - ID: ${deviceId}`);
  
  // Armazenar informações do dispositivo
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
  
  // Configurar ping/pong para manter conexão viva
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
    deviceInfo.lastHeartbeat = new Date();
  });
  
  // Tratar mensagens recebidas
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(deviceId, message);
    } catch (error) {
      console.error(`❌ Erro ao processar mensagem de ${deviceId}:`, error);
      sendError(ws, 'Invalid JSON format');
    }
  });
  
  // Tratar desconexão
  ws.on('close', (code, reason) => {
    console.log(`🔌 Dispositivo ${deviceId} desconectado - Código: ${code}, Razão: ${reason}`);
    connectedDevices.delete(deviceId);
    broadcastDeviceList();
  });
  
  // Tratar erros
  ws.on('error', (error) => {
    console.error(`❌ Erro WebSocket para ${deviceId}:`, error);
  });
  
  // Enviar mensagem de boas-vindas
  sendMessage(ws, {
    type: 'welcome',
    deviceId: deviceId,
    timestamp: new Date().toISOString()
  });
  
  // Atualizar lista de dispositivos para todos os clientes
  broadcastDeviceList();
});

// Função para tratar mensagens recebidas
function handleMessage(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  if (!device) return;
  
  console.log(`📨 Mensagem de ${deviceId}:`, message);
  
  switch (message.type) {
    case 'identification':
      handleIdentification(deviceId, message);
      break;
      
    case 'heartbeat':
      handleHeartbeat(deviceId, message);
      break;
      
    case 'response':
      handleResponse(deviceId, message);
      break;
      
    case 'status':
      handleStatus(deviceId, message);
      break;
      
    case 'sensor_data':
      handleSensorData(deviceId, message);
      break;
      
    case 'pong':
      handlePong(deviceId, message);
      break;
      
    default:
      console.log(`⚠️  Tipo de mensagem desconhecido: ${message.type}`);
  }
}

// Handlers específicos para cada tipo de mensagem
function handleIdentification(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.deviceType = message.device || 'unknown';
  device.mac = message.mac;
  device.version = message.version;
  device.deviceIP = message.ip;
  
  console.log(`🔍 Dispositivo identificado: ${device.deviceType} (MAC: ${device.mac})`);
  
  // Responder com confirmação
  sendMessage(device.ws, {
    type: 'identification_ack',
    status: 'confirmed',
    timestamp: new Date().toISOString()
  });
  
  broadcastDeviceList();
}

function handleHeartbeat(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.lastHeartbeat = new Date();
  device.uptime = message.uptime;
  
  console.log(`💓 Heartbeat de ${deviceId} - Uptime: ${message.uptime}s`);
}

function handleResponse(deviceId, message) {
  console.log(`📋 Resposta de ${deviceId}:`, message);
  
  // Broadcast para outros clientes (ex: dashboard web)
  broadcastToClients({
    type: 'device_response',
    deviceId: deviceId,
    data: message,
    timestamp: new Date().toISOString()
  }, deviceId);
}

function handleStatus(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.status = message;
  
  console.log(`📊 Status de ${deviceId}:`, message);
  
  // Broadcast status para outros clientes
  broadcastToClients({
    type: 'device_status',
    deviceId: deviceId,
    status: message,
    timestamp: new Date().toISOString()
  }, deviceId);
}

function handleSensorData(deviceId, message) {
  console.log(`🌡️  Dados do sensor de ${deviceId}: ${message.sensor} = ${message.value}`);
  
  // Aqui você pode salvar no banco de dados, processar, etc.
  
  // Broadcast para outros clientes
  broadcastToClients({
    type: 'sensor_data',
    deviceId: deviceId,
    sensor: message.sensor,
    value: message.value,
    timestamp: message.timestamp
  }, deviceId);
}

function handlePong(deviceId, message) {
  console.log(`🏓 Pong recebido de ${deviceId}`);
}

// Rotas HTTP da API REST
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/api/devices', (req, res) => {
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
});

app.post('/api/device/:deviceId/command', (req, res) => {
  const deviceId = req.params.deviceId;
  const { command, parameters } = req.body;
  
  const device = connectedDevices.get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // Enviar comando para o dispositivo
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
    command: command
  });
});

app.post('/api/device/:deviceId/ping', (req, res) => {
  const deviceId = req.params.deviceId;
  const device = connectedDevices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  sendMessage(device.ws, {
    type: 'ping',
    timestamp: new Date().toISOString()
  });
  
  res.json({ status: 'ping sent' });
});

// Funções utilitárias
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

function broadcastToClients(message, excludeDeviceId = null) {
  connectedDevices.forEach((device, deviceId) => {
    if (deviceId !== excludeDeviceId) {
      sendMessage(device.ws, message);
    }
  });
}

function broadcastDeviceList() {
  const deviceList = Array.from(connectedDevices.keys());
  broadcastToClients({
    type: 'device_list_update',
    devices: deviceList,
    count: deviceList.length,
    timestamp: new Date().toISOString()
  });
}

function generateDeviceId() {
  return 'device_' + Math.random().toString(36).substr(2, 9);
}

// Verificar conexões ativas periodicamente
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // 30 segundos

// Limpeza ao encerrar
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}${WS_PATH}`);
});