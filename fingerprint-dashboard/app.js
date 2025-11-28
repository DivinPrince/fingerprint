const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// In-memory storage (replace with database in production)
global.devices = {};
global.accessLogs = [];
global.enrollments = [];
global.events = [];
global.users = [];

// Helper function to get device data
global.getDeviceData = function(deviceId) {
  if (!global.devices[deviceId]) {
    global.devices[deviceId] = {
      deviceId: deviceId,
      name: `Device ${deviceId.substring(0, 8)}`,
      status: 'offline',
      lastHeartbeat: null,
      usersCount: 0,
      sensorStatus: 'unknown',
      totalAccess: 0,
      grantedAccess: 0,
      deniedAccess: 0
    };
  }
  return global.devices[deviceId];
};

// API Routes for ESP32
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Web Dashboard Routes
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   🔐 Fingerprint Security System Server       ║');
  console.log(`║   ✅ Server running on port ${PORT}               ║`);
  console.log('║   🌐 Dashboard: http://localhost:' + PORT + '         ║');
  console.log('║   📡 API: http://localhost:' + PORT + '/api           ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\n📊 Dashboard ready at http://localhost:' + PORT);
  console.log('📡 Waiting for device connections...\n');
});
