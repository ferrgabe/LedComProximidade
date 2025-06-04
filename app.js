const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const { initializeWebSocket } = require('./controllers/websocketController');

// Configurações
const config = require('./config/database');

// Inicializa o app Express
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Conectar ao MongoDB
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro na conexão MongoDB:', err));

// Configurar WebSocket
const wss = new WebSocket.Server({ server, path: config.WS_PATH });
initializeWebSocket(wss);
require('./controllers/websocketController').initializeWebSocket(wss);

// Configurar rotas
app.use('/api/devices', require('./routes/deviceRoutes'));
app.use('/api/led', require('./routes/ledRoutes'));
app.use('/api/sensors', require('./routes/sensorRoutes'));


// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

// Iniciar servidor
server.listen(config.PORT, () => {
  console.log(`✅ Servidor rodando na porta ${config.PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${config.PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${config.PORT}${config.WS_PATH}`);
});