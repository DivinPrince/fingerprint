// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// In-memory storage (replace with database in production)
let devices = {};
let accessLogs = [];
let enrollmentLogs = [];
let deviceEvents = [];
let pendingCommands = {};

// Initialize device commands storage
const initDeviceCommands = (deviceId) => {
  if (!pendingCommands[deviceId]) {
    pendingCommands[deviceId] = null;
  }
};

// ========== API ENDPOINTS ==========

// Heartbeat - Device status updates
app.post('/api/heartbeat', (req, res) => {
  const { deviceId, timestamp, status } = req.body;
  
  devices[deviceId] = {
    deviceId,
    lastSeen: Date.now(),
    status,
    timestamp
  };
  
  console.log(`Heartbeat from ${deviceId}: ${status}`);
  res.json({ success: true, message: 'Heartbeat received' });
});

// Access logs - Fingerprint scan results
app.post('/api/access', (req, res) => {
  const { deviceId, userId, userName, cardId, granted, timestamp } = req.body;
  
  const accessLog = {
    id: accessLogs.length + 1,
    deviceId,
    userId,
    userName,
    cardId,
    granted,
    timestamp: Date.now(),
    deviceTimestamp: timestamp
  };
  
  accessLogs.unshift(accessLog);
  
  // Keep only last 100 logs
  if (accessLogs.length > 100) {
    accessLogs = accessLogs.slice(0, 100);
  }
  
  console.log(`Access ${granted ? 'GRANTED' : 'DENIED'}: ${userName} (${cardId})`);
  res.json({ success: true, message: 'Access log saved' });
});

// Enrollment updates
app.post('/api/enrollment', (req, res) => {
  const { deviceId, status, success, id, name, cardId, step, timestamp } = req.body;
  
  const enrollLog = {
    id: enrollmentLogs.length + 1,
    deviceId,
    status,
    success,
    userId: id,
    name,
    cardId,
    step,
    timestamp: Date.now(),
    deviceTimestamp: timestamp
  };
  
  enrollmentLogs.unshift(enrollLog);
  
  // Keep only last 50 enrollment logs
  if (enrollmentLogs.length > 50) {
    enrollmentLogs = enrollmentLogs.slice(0, 50);
  }
  
  console.log(`Enrollment update: ${status} - ${name} (${cardId})`);
  res.json({ success: true, message: 'Enrollment log saved' });
});

// Device events
app.post('/api/events', (req, res) => {
  const { deviceId, action, message, userId, cardId, timestamp } = req.body;
  
  const event = {
    id: deviceEvents.length + 1,
    deviceId,
    action,
    message,
    userId,
    cardId,
    timestamp: Date.now(),
    deviceTimestamp: timestamp
  };
  
  deviceEvents.unshift(event);
  
  // Keep only last 100 events
  if (deviceEvents.length > 100) {
    deviceEvents = deviceEvents.slice(0, 100);
  }
  
  console.log(`Device event: ${action} - ${message}`);
  res.json({ success: true, message: 'Event logged' });
});

// Get pending command for device
app.get('/api/commands/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  
  initDeviceCommands(deviceId);
  
  const command = pendingCommands[deviceId];
  
  if (command) {
    // Clear command after sending
    pendingCommands[deviceId] = null;
    console.log(`Sending command to ${deviceId}:`, command);
    res.json(command);
  } else {
    res.json({ type: 'none' });
  }
});

// Send command to device (from web interface)
app.post('/api/commands/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const command = req.body;
  
  initDeviceCommands(deviceId);
  
  pendingCommands[deviceId] = command;
  
  console.log(`Command queued for ${deviceId}:`, command);
  res.json({ success: true, message: 'Command queued' });
});

// ========== WEB INTERFACE API ENDPOINTS ==========

// Get all devices
app.get('/api/devices', (req, res) => {
  const deviceList = Object.values(devices);
  res.json(deviceList);
});

// Get access logs
app.get('/api/logs/access', (req, res) => {
  res.json(accessLogs);
});

// Get enrollment logs
app.get('/api/logs/enrollment', (req, res) => {
  res.json(enrollmentLogs);
});

// Get device events
app.get('/api/logs/events', (req, res) => {
  res.json(deviceEvents);
});

// Enroll new user
app.post('/api/enroll', (req, res) => {
  const { deviceId, id, name, phone, cardId } = req.body;
  
  if (!deviceId || !id || !name || !cardId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const command = {
    type: 'enroll',
    id: parseInt(id),
    name,
    phone: phone || '',
    cardId
  };
  
  initDeviceCommands(deviceId);
  pendingCommands[deviceId] = command;
  
  res.json({ success: true, message: 'Enrollment command sent' });
});

// Delete user
app.post('/api/delete', (req, res) => {
  const { deviceId, id } = req.body;
  
  if (!deviceId || !id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const command = {
    type: 'delete',
    id: parseInt(id)
  };
  
  initDeviceCommands(deviceId);
  pendingCommands[deviceId] = command;
  
  res.json({ success: true, message: 'Delete command sent' });
});

// Clear all users
app.post('/api/clear', (req, res) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID required' });
  }
  
  const command = {
    type: 'clear'
  };
  
  initDeviceCommands(deviceId);
  pendingCommands[deviceId] = command;
  
  res.json({ success: true, message: 'Clear all command sent' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`Fingerprint Control Server Running`);
  console.log(`Port: ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
  console.log(`========================================`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});
