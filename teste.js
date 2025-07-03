const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/iot_dashboard')
  .then(() => {
    console.log('✅ Conexão bem-sucedida com o MongoDB');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Falha na conexão com MongoDB:', err.message);
  });
