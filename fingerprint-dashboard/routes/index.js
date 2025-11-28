const express = require('express');
const router = express.Router();

// Mock data
let devices = [
  {
    id: '8C128B2B1838',
    name: 'Main Entrance',
    status: 'online',
    lastSeen: new Date(),
    users: 0,
    accessCount: 0
  }
];

let users = [
  { id: 1, name: 'John Doe', phone: '+250780146487', cardId: 'CARD001', enrolled: true },
  { id: 2, name: 'Jane Smith', phone: '+250781234567', cardId: 'CARD002', enrolled: true },
  { id: 3, name: 'Bob Wilson', phone: '+250782345678', cardId: 'CARD003', enrolled: true }
];

let accessLogs = [
  { 
    id: 1, 
    userName: 'John Doe', 
    cardId: 'CARD001', 
    granted: true, 
    timestamp: new Date(Date.now() - 300000), 
    deviceId: '8C128B2B1838', 
    type: 'fingerprint',
    realData: false
  }
];

let notifications = [
  { id: 1, type: 'success', message: 'Device 8C128B2B1838 connected', timestamp: new Date(Date.now() - 3600000) },
  { id: 2, type: 'warning', message: 'Failed access attempt detected', timestamp: new Date(Date.now() - 900000) }
];

// Real-time data tracking
let realTimeStats = {
  totalAccessToday: 0,
  successfulAccess: 0,
  failedAccess: 0,
  lastDeviceUpdate: new Date(),
  activeDevices: 0
};

// Helper functions
const formatTime = (date) => {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
};

const addNotification = (type, message) => {
  const newNotif = {
    id: Date.now(),
    type,
    message,
    timestamp: new Date()
  };
  notifications = [newNotif, ...notifications].slice(0, 10);
};

// Update dashboard stats
function updateDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayLogs = accessLogs.filter(log => new Date(log.timestamp) >= todayStart);
  const realLogs = accessLogs.filter(log => log.realData);
  
  realTimeStats.totalAccessToday = todayLogs.length;
  realTimeStats.successfulAccess = todayLogs.filter(log => log.granted).length;
  realTimeStats.failedAccess = todayLogs.filter(log => !log.granted).length;
  realTimeStats.activeDevices = devices.filter(d => d.status === 'online').length;
  realTimeStats.realDataCount = realLogs.length;
}

// Auto-update stats every minute
setInterval(updateDashboardStats, 60000);

// ========================================================
//           MAIN ROUTES
// ========================================================

router.get('/', (req, res) => {
  const activeTab = req.query.tab || 'dashboard';
  const showModal = req.query.modal === 'enroll';
  
  updateDashboardStats();
  
  const stats = {
    totalUsers: users.length,
    activeDevices: realTimeStats.activeDevices,
    todayAccess: realTimeStats.totalAccessToday,
    failedAttempts: realTimeStats.failedAccess,
    realDataCount: realTimeStats.realDataCount
  };

  res.render('index', {
    devices,
    users,
    accessLogs,
    notifications,
    stats,
    activeTab,
    showModal,
    formatTime,
    selectedDevice: devices[0]?.id || '',
    realTimeStats
  });
});

router.post('/users/enroll', (req, res) => {
  const { id, name, phone, cardId } = req.body;
  
  if (!id || !name || !phone || !cardId) {
    addNotification('error', 'Please fill all fields');
    return res.redirect('/?tab=users&modal=enroll');
  }
  
  // Check if ID already exists
  if (users.find(u => u.id === parseInt(id))) {
    addNotification('error', `User ID ${id} already exists`);
    return res.redirect('/?tab=users&modal=enroll');
  }
  
  const newUser = {
    id: parseInt(id),
    name,
    phone,
    cardId,
    enrolled: false
  };
  
  users.push(newUser);
  addNotification('info', `Enrollment started for ${name}. Please scan fingerprint on device.`);
  res.redirect('/?tab=users');
});

router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);
  
  if (user) {
    users = users.filter(u => u.id !== userId);
    addNotification('success', `User ${user.name} deleted successfully`);
  }
  
  res.redirect('/?tab=users');
});

router.post('/users/clear', (req, res) => {
  if (users.length > 0) {
    const userCount = users.length;
    users = [];
    addNotification('warning', `All ${userCount} users cleared from system`);
  }
  res.redirect('/?tab=users');
});

router.post('/logs/refresh', (req, res) => {
  // Simulate new log entry
  const randomUsers = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Johnson', 'Mike Brown'];
  const newLog = {
    id: accessLogs.length + 1,
    userName: randomUsers[Math.floor(Math.random() * randomUsers.length)],
    cardId: 'CARD' + (Math.floor(Math.random() * 1000)).toString().padStart(3, '0'),
    granted: Math.random() > 0.3,
    timestamp: new Date(),
    deviceId: '8C128B2B1838',
    type: 'fingerprint',
    realData: false
  };
  accessLogs.unshift(newLog);
  
  if (!newLog.granted) {
    addNotification('warning', `Failed access attempt by ${newLog.userName}`);
  } else {
    addNotification('success', `Access granted to ${newLog.userName}`);
  }
  
  updateDashboardStats();
  res.redirect('/?tab=logs');
});

// Update device status
router.post('/devices/refresh', (req, res) => {
  devices = devices.map(device => ({
    ...device,
    lastSeen: new Date(),
    status: Math.random() > 0.2 ? 'online' : 'offline',
    users: Math.max(1, Math.floor(Math.random() * 10))
  }));
  
  addNotification('info', 'Device status updated');
  updateDashboardStats();
  res.redirect('/?tab=devices');
});

// ========================================================
//           API ENDPOINTS FOR ESP32
// ========================================================

// API endpoint for device heartbeat
router.post('/api/heartbeat', (req, res) => {
  try {
    const { deviceId, timestamp, status, usersCount, sensorStatus } = req.body;
    
    console.log(`💓 Heartbeat from device: ${deviceId}`);
    console.log(`Status: ${status}, Users: ${usersCount}, Sensor: ${sensorStatus}`);
    
    // Update device last seen
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex !== -1) {
      devices[deviceIndex].lastSeen = new Date();
      devices[deviceIndex].status = status || 'online';
      if (usersCount !== undefined) {
        devices[deviceIndex].users = usersCount;
      }
    } else {
      // Add new device if not found
      devices.push({
        id: deviceId,
        name: `Device ${deviceId}`,
        status: status || 'online',
        lastSeen: new Date(),
        users: usersCount || 0,
        accessCount: 0
      });
    }
    
    realTimeStats.lastDeviceUpdate = new Date();
    updateDashboardStats();
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'Heartbeat received',
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in heartbeat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for access logs
router.post('/api/access', (req, res) => {
  try {
    const { deviceId, timestamp, userId, userName, cardId, granted, type } = req.body;
    
    console.log(`🔐 REAL ACCESS from device: ${deviceId}`);
    console.log(`User: ${userName} (ID: ${userId}), Card: ${cardId}, Granted: ${granted}`);
    
    // Update device access count
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex !== -1) {
      devices[deviceIndex].accessCount++;
      devices[deviceIndex].lastSeen = new Date();
    }
    
    // Add to access logs with real data marker
    const newLog = {
      id: accessLogs.length + 1,
      userName: userName || 'Unknown User',
      cardId: cardId || `CARD${userId || '000'}`,
      granted: granted || false,
      timestamp: new Date(),
      deviceId: deviceId,
      type: type || 'fingerprint',
      realData: true
    };
    
    accessLogs.unshift(newLog);
    
    // Update user enrollment status if access was granted
    if (granted && userId > 0) {
      const userIndex = users.findIndex(u => u.id === parseInt(userId));
      if (userIndex !== -1) {
        users[userIndex].enrolled = true;
        if (userName && userName !== 'Unknown User') {
          users[userIndex].name = userName;
        }
      } else if (userName && userName !== 'Unknown User') {
        // Add new user if not exists
        users.push({
          id: parseInt(userId),
          name: userName,
          phone: '',
          cardId: cardId || `CARD${userId}`,
          enrolled: true
        });
      }
    }
    
    // Add notification
    if (!granted) {
      addNotification('warning', `🚫 Access DENIED for ${userName} on ${deviceId}`);
    } else {
      addNotification('success', `✅ Access GRANTED to ${userName} on ${deviceId}`);
    }
    
    updateDashboardStats();
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'Access log recorded',
      logId: newLog.id
    });
  } catch (error) {
    console.error('Error in access log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for enrollment updates
router.post('/api/enrollment', (req, res) => {
  try {
    const { deviceId, timestamp, status, success, id, name, phone, cardId, step } = req.body;
    
    console.log(`👤 Enrollment update from device: ${deviceId}`);
    console.log(`Status: ${status}, Success: ${success}, User: ${name}`);
    
    if (success && id && name) {
      // Check if user already exists
      const existingUserIndex = users.findIndex(u => u.id === parseInt(id));
      
      if (existingUserIndex !== -1) {
        // Update existing user
        users[existingUserIndex].enrolled = true;
        users[existingUserIndex].name = name;
        if (phone) users[existingUserIndex].phone = phone;
        if (cardId) users[existingUserIndex].cardId = cardId;
        
        addNotification('success', `User ${name} (ID: ${id}) updated successfully on device ${deviceId}`);
      } else {
        // Add new user
        const newUser = {
          id: parseInt(id),
          name: name,
          phone: phone || '',
          cardId: cardId || `CARD${id.toString().padStart(3, '0')}`,
          enrolled: true
        };
        users.push(newUser);
        
        addNotification('success', `New user ${name} (ID: ${id}) enrolled successfully on device ${deviceId}`);
      }
    } else if (!success) {
      addNotification('error', `Enrollment failed on device ${deviceId}: ${status}`);
    }
    
    updateDashboardStats();
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'Enrollment update received'
    });
  } catch (error) {
    console.error('Error in enrollment update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for device events
router.post('/api/event', (req, res) => {
  try {
    const { deviceId, timestamp, action, message, userId, userName, cardId } = req.body;
    
    console.log(`📱 Device event from: ${deviceId}`);
    console.log(`Action: ${action}, Message: ${message}`);
    
    // Add system notification
    addNotification('info', `Device ${deviceId}: ${message}`);
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'Event received'
    });
  } catch (error) {
    console.error('Error in device event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint for connection testing
router.post('/api/test', (req, res) => {
  try {
    const { deviceId, test, timestamp, message } = req.body;
    
    console.log(`🧪 Test connection from device: ${deviceId}`);
    console.log(`Message: ${message}`);
    
    // Update device status
    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex !== -1) {
      devices[deviceIndex].lastSeen = new Date();
      devices[deviceIndex].status = 'online';
    }
    
    addNotification('success', `Device ${deviceId} connected successfully`);
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'Test connection successful',
      serverTime: new Date().toISOString(),
      deviceTime: new Date(parseInt(timestamp)).toISOString()
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get device status
router.get('/api/devices', (req, res) => {
  res.json(devices);
});

// Get access logs
router.get('/api/logs', (req, res) => {
  res.json(accessLogs);
});

// Get users
router.get('/api/users', (req, res) => {
  res.json(users);
});

// Get stats
router.get('/api/stats', (req, res) => {
  updateDashboardStats();
  res.json(realTimeStats);
});

module.exports = router;
