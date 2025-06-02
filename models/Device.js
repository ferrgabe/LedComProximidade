const mongoose = require('mongoose');

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

module.exports = mongoose.model('Device', DeviceSchema);