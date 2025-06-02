const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
  deviceId: String,
  sensor: String,
  value: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);