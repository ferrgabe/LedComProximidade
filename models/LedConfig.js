const mongoose = require('mongoose');

const LedConfigSchema = new mongoose.Schema({
  deviceId: String,
  on: Boolean,
  red: Boolean,
  blue: Boolean,
  green: Boolean,
  behavior: Number,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LedConfig', LedConfigSchema);