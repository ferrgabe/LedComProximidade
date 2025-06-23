const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Configurações
const PORT = 8080;
const WS_PATH = '/ws';
const MONGODB_URI = 'mongodb://localhost:27017/iot_dashboard';

// Conexão com o MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro na conexão MongoDB:', err));

// Definir schemas do MongoDB
const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  deviceType: String,
  mac: String,
  version: String,
  ip: String,
  deviceIP: String,
  connectedAt: Date,
  lastHeartbeat: Date,
  status: mongoose.Schema.Types.Mixed,
  uptime: Number,
  isActive: Boolean
});

const SensorDataSchema = new mongoose.Schema({
  deviceId: String,
  sensor: String,
  value: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const LedConfigSchema = new mongoose.Schema({
  deviceId: String,
  on: Boolean,
  red: Boolean,
  blue: Boolean,
  green: Boolean,
  behavior: Number,
  timestamp: { type: Date, default: Date.now }
});

// Criar modelos
const Device = mongoose.model('Device', DeviceSchema);
const SensorData = mongoose.model('SensorData', SensorDataSchema);
const LedConfig = mongoose.model('LedConfig', LedConfigSchema);

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
wss.on('connection', async (ws, req) => {
  const clientIP = req.socket.remoteAddress;

  console.log(`🔌 Nova conexão WebSocket de ${clientIP}`);

  // Inicializa informações do dispositivo
  const deviceInfo = {
    ws: ws,
    ip: clientIP,
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    isAlive: true,
    deviceType: 'unknown',
    mac: null,
    version: null,
    deviceIP: null,
    deviceId: null
  };

  ws.deviceInfo = deviceInfo;

  // Configurar ping/pong
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
    deviceInfo.lastHeartbeat = new Date();
  });

  // Tratar mensagens recebidas
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (!deviceInfo.deviceId && message.type === 'identification' && message.mac) {
        // Primeira vez recebendo identificação
        deviceInfo.mac = message.mac;
        deviceInfo.deviceType = message.device || 'unknown';
        deviceInfo.version = message.version;
        deviceInfo.deviceIP = message.ip;

        // Geração do deviceId (exemplo baseado no MAC ou aleatório)
        deviceInfo.deviceId = message.mac === '50:02:91:C9:6E:D2'
          ? '1'
          : generateDeviceId();

        connectedDevices.set(deviceInfo.deviceId, deviceInfo);

        // Salvar no MongoDB
        try {
          await Device.findOneAndUpdate(
            { deviceId: deviceInfo.deviceId },
            {
              deviceId: deviceInfo.deviceId,
              deviceType: deviceInfo.deviceType,
              mac: deviceInfo.mac,
              version: deviceInfo.version,
              ip: deviceInfo.ip,
              deviceIP: deviceInfo.deviceIP,
              connectedAt: deviceInfo.connectedAt,
              lastHeartbeat: deviceInfo.lastHeartbeat,
              isActive: true
            },
            { upsert: true, new: true }
          );
          console.log(`✅ Dispositivo registrado: ${deviceInfo.deviceType} | ID: ${deviceInfo.deviceId} | MAC: ${deviceInfo.mac}`);
        } catch (err) {
          console.error('❌ Erro ao salvar dispositivo no MongoDB:', err);
        }

        // Enviar ACK
        sendMessage(ws, {
          type: 'identification_ack',
          status: 'confirmed',
          timestamp: new Date().toISOString()
        });

        broadcastDeviceList();
        return;
      }

      if (!deviceInfo.deviceId) {
        sendError(ws, 'Device not identified. Send MAC address first.');
        return;
      }

      // Processar mensagem normalmente
      await handleMessage(deviceInfo.deviceId, message);

    } catch (err) {
      console.error(`❌ Erro ao processar mensagem:`, err);
      sendError(ws, 'Invalid JSON format');
    }
  });

  // Tratar desconexão
  ws.on('close', async (code, reason) => {
    const deviceId = deviceInfo.deviceId;
    console.log(`🔌 Dispositivo ${deviceId || 'desconhecido'} desconectado - Código: ${code}, Razão: ${reason}`);

    if (deviceId) {
      connectedDevices.delete(deviceId);
      try {
        await Device.findOneAndUpdate(
          { deviceId },
          { isActive: false, lastHeartbeat: new Date() }
        );
      } catch (err) {
        console.error('❌ Erro ao atualizar status do dispositivo:', err);
      }
    }
  });
});

// Função para tratar mensagens recebidas
async function handleMessage(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  if (!device) return;
  
  console.log(`📨 Mensagem de ${deviceId}:`, message);
  
  switch (message.type) {
    case 'identification':
      await handleIdentification(deviceId, message);
      break;
      
    case 'heartbeat':
      await handleHeartbeat(deviceId, message);
      break;
      
    case 'response':
      await handleResponse(deviceId, message);
      break;
      
    case 'status':
      await handleStatus(deviceId, message);
      break;
      
    case 'sensor_data':
      await handleSensorData(deviceId, message);
      break;
      
    case 'pong':
      handlePong(deviceId, message);
      break;

    case 'led_update':
      await handleLedUpdate(deviceId, message);
      break;
      
    default:
      console.log(`⚠️  Tipo de mensagem desconhecido: ${message.type}`);
  }
}

// Handlers específicos para cada tipo de mensagem
async function handleIdentification(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.deviceType = message.device || 'unknown';
  device.mac = message.mac;
  device.version = message.version;
  device.deviceIP = message.ip;
  
  console.log(`🔍 Dispositivo identificado: ${device.deviceType} (MAC: ${device.mac})`);
  
  // Atualizar no MongoDB
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
  
  // Responder com confirmação
  sendMessage(device.ws, {
    type: 'identification_ack',
    status: 'confirmed',
    timestamp: new Date().toISOString()
  });
  
  broadcastDeviceList();
}

async function handleHeartbeat(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.lastHeartbeat = new Date();
  device.uptime = message.uptime;
  
  console.log(`💓 Heartbeat de ${deviceId} - Uptime: ${message.uptime}s`);
  
  // Atualizar no MongoDB
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

async function handleLedUpdate(deviceId, message) {
  console.log(`💡 Atualização de LED de ${deviceId}:`, message.parameters);
  
  try {
    const ledConfig = new LedConfig({
      deviceId: deviceId,
      ...message.parameters, // Spread operator para incluir todas as propriedades
      timestamp: new Date()
    });
    
    await ledConfig.save();
    console.log(`✅ Configuração de LED salva para ${deviceId}`);
    
    const device = connectedDevices.get(deviceId);
    if (device && device.ws) {
      sendMessage(device.ws, {
        type: 'led_update_ack',
        status: 'saved',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('❌ Erro ao salvar configuração de LED:', err);
    
    // Enviar mensagem de erro de volta ao dispositivo, se possível
    const device = connectedDevices.get(deviceId);
    if (device && device.ws) {
      sendError(device.ws, 'Failed to save LED configuration');
    }
  }
}

async function handleResponse(deviceId, message) {
  console.log(`📋 Resposta de ${deviceId}:`, message);
  
  // Broadcast para outros clientes (ex: dashboard web)
  broadcastToClients({
    type: 'device_response',
    deviceId: deviceId,
    data: message,
    timestamp: new Date().toISOString()
  }, deviceId);
}

async function handleStatus(deviceId, message) {
  const device = connectedDevices.get(deviceId);
  device.status = message;
  
  console.log(`📊 Status de ${deviceId}:`, message);
  
  // Atualizar no MongoDB
  try {
    await Device.findOneAndUpdate(
      { deviceId },
      { status: message, lastHeartbeat: new Date() }
    );
  } catch (err) {
    console.error('Erro ao atualizar status do dispositivo:', err);
  }
  
  // Broadcast status para outros clientes
  broadcastToClients({
    type: 'device_status',
    deviceId: deviceId,
    status: message,
    timestamp: new Date().toISOString()
  }, deviceId);
}

async function handleSensorData(deviceId, message) {
  console.log(`🌡️  Dados do sensor de ${deviceId}: ${message.sensor} = ${message.value}`);
  
  // Salvar no MongoDB
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

// Obter dispositivos ativos (conectados agora)
app.get('/api/devices/active', (req, res) => {
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

// Obter todos os dispositivos (do MongoDB)
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find().sort({ connectedAt: -1 });
    res.json({
      count: devices.length,
      devices: devices
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dispositivos' });
  }
});

// Obter dados de sensor
app.get('/api/sensor-data', async (req, res) => {
  try {
    const { deviceId, sensor, start, end, limit } = req.query;
    
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (sensor) query.sensor = sensor;
    if (start && end) {
      query.timestamp = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }
    
    const data = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 1000);
    
    res.json({
      count: data.length,
      data: data
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados de sensor' });
  }
});

app.post('/api/device/:deviceId/command', async (req, res) => {
  const deviceId = req.params.deviceId;
  const { command, parameters } = req.body;
  
    const device = connectedDevices.get(deviceId);
    if (!device) {
      console.log(device)
      console.log(deviceId)
      return res.status(404).json({ error: 'Device not found' });
    }
  
  // Se for um comando de LED, salve no banco de dados primeiro
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
      return res.status(500).json({ error: 'Failed to save LED configuration' });
    }
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

// Rotas para configurações de LED
app.get('/api/led-configs', async (req, res) => {
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
});

app.get('/api/led-configs/latest', async (req, res) => {
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