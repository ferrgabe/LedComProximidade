const SensorData = require('../models/SensorData');

exports.getSensorData = async (req, res) => {
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
};

exports.getSensorStats = async (req, res) => {
  try {
    const { deviceId, sensor, start, end } = req.query;
    
    const match = {};
    if (deviceId) match.deviceId = deviceId;
    if (sensor) match.sensor = sensor;
    if (start && end) {
      match.timestamp = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }
    
    const stats = await SensorData.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$sensor',
          count: { $sum: 1 },
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
          firstTimestamp: { $min: '$timestamp' },
          lastTimestamp: { $max: '$timestamp' }
        }
      }
    ]);
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas do sensor' });
  }
};