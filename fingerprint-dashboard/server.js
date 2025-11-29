const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Ultra-simple middleware
app.use(cors());
app.use(express.json());

// Simple storage
let devices = {};
let commands = {};
let logs = [];

// Root endpoint - Simple HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fingerprint Control</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
            .card { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .btn { background: #007bff; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .success { color: green; }
            .error { color: red; }
            input { padding: 8px; margin: 5px; width: 200px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔒 Fingerprint System</h1>
            <div class="card">
                <h3>Enroll User</h3>
                <input type="number" id="id" placeholder="ID (1-20)" min="1" max="20">
                <input type="text" id="name" placeholder="Name">
                <input type="tel" id="phone" placeholder="Phone">
                <input type="text" id="card" placeholder="Card ID">
                <button class="btn" onclick="enroll()">Enroll User</button>
            </div>
            
            <div class="card">
                <h3>System Control</h3>
                <button class="btn" onclick="getStatus()">Refresh Status</button>
                <button class="btn" onclick="clearUsers()" style="background: #dc3545;">Clear All Users</button>
            </div>
            
            <div class="card">
                <h3>Device Status</h3>
                <div id="status">Click Refresh Status</div>
            </div>
            
            <div class="card">
                <h3>Access Logs</h3>
                <div id="logs">No logs yet</div>
            </div>
        </div>

        <script>
            async function enroll() {
                const id = document.getElementById('id').value;
                const name = document.getElementById('name').value;
                const phone = document.getElementById('phone').value;
                const card = document.getElementById('card').value;
                
                if (!id || !name) return alert('Fill ID and Name');
                
                try {
                    const response = await fetch('/api/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: '8C128B2B1838',
                            type: 'enroll',
                            id: parseInt(id),
                            name: name,
                            phone: phone,
                            cardId: card
                        })
                    });
                    
                    if (response.ok) {
                        alert('Enrollment started! Check device.');
                        document.getElementById('id').value = '';
                        document.getElementById('name').value = '';
                        document.getElementById('phone').value = '';
                        document.getElementById('card').value = '';
                    }
                } catch (e) {
                    alert('Error: ' + e.message);
                }
            }
            
            async function getStatus() {
                try {
                    const response = await fetch('/api/devices/8C128B2B1838');
                    if (response.ok) {
                        const data = await response.json();
                        document.getElementById('status').innerHTML = 
                            'Last Seen: ' + (data.device?.lastSeen ? new Date(data.device.lastSeen).toLocaleString() : 'Never') + '<br>' +
                            'Users: ' + (data.device?.users?.length || 0);
                    }
                } catch (e) {
                    document.getElementById('status').innerHTML = 'Error loading status';
                }
            }
            
            async function clearUsers() {
                if (!confirm('Clear ALL users?')) return;
                
                try {
                    await fetch('/api/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: '8C128B2B1838',
                            type: 'clear'
                        })
                    });
                    alert('Clear command sent');
                } catch (e) {
                    alert('Error: ' + e.message);
                }
            }
            
            // Load logs
            async function loadLogs() {
                try {
                    const response = await fetch('/api/logs/access?deviceId=8C128B2B1838&limit=10');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.logs && data.logs.length > 0) {
                            document.getElementById('logs').innerHTML = data.logs.map(log => 
                                '<div class="' + (log.granted ? 'success' : 'error') + '">' +
                                (log.granted ? '✅' : '❌') + ' ' + log.userName + ' - ' + 
                                new Date(log.timestamp).toLocaleTimeString() + '</div>'
                            ).join('');
                        }
                    }
                } catch (e) {
                    console.log('Error loading logs');
                }
            }
            
            // Auto refresh
            setInterval(() => {
                getStatus();
                loadLogs();
            }, 5000);
            
            getStatus();
            loadLogs();
        </script>
    </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// Device heartbeat
app.post('/api/devices/heartbeat', (req, res) => {
  try {
    const { deviceId, timestamp, status } = req.body;
    console.log('Heartbeat from:', deviceId);
    
    if (!devices[deviceId]) {
      devices[deviceId] = { users: [] };
    }
    
    devices[deviceId].lastSeen = new Date().toISOString();
    devices[deviceId].status = status || 'online';
    
    // Return pending commands
    const pendingCommands = commands[deviceId] || [];
    commands[deviceId] = [];
    
    res.json({ 
      success: true, 
      commands: pendingCommands,
      message: 'OK'
    });
    
  } catch (error) {
    console.log('Heartbeat error:', error.message);
    res.json({ success: true, commands: [] });
  }
});

// Device status
app.post('/api/devices/status', (req, res) => {
  try {
    const { deviceId, users } = req.body;
    console.log('Status from:', deviceId, 'Users:', users?.length || 0);
    
    if (devices[deviceId]) {
      devices[deviceId].users = users || [];
      devices[deviceId].lastSeen = new Date().toISOString();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.log('Status error:', error.message);
    res.json({ success: true });
  }
});

// Get device
app.get('/api/devices/:deviceId', (req, res) => {
  try {
    const device = devices[req.params.deviceId];
    res.json({ 
      success: true, 
      device: device || { users: [], status: 'offline' }
    });
  } catch (error) {
    console.log('Get device error:', error.message);
    res.json({ success: true, device: { users: [] } });
  }
});

// Command endpoint
app.post('/api/command', (req, res) => {
  try {
    const { deviceId, type, id, name, phone, cardId } = req.body;
    console.log('Command:', type, 'for device:', deviceId);
    
    if (!commands[deviceId]) {
      commands[deviceId] = [];
    }
    
    commands[deviceId].push({
      type, id, name, phone, cardId, timestamp: Date.now()
    });
    
    res.json({ success: true, message: 'Command queued' });
  } catch (error) {
    console.log('Command error:', error.message);
    res.json({ success: true });
  }
});

// Access logs
app.post('/api/logs/access', (req, res) => {
  try {
    const { deviceId, userName, granted, cardId } = req.body;
    
    const log = {
      deviceId,
      userName: userName || 'Unknown',
      granted: !!granted,
      cardId: cardId || 'NO_CARD',
      timestamp: Date.now(),
      id: Date.now()
    };
    
    logs.unshift(log);
    if (logs.length > 100) logs.pop();
    
    console.log(granted ? '✅ ACCESS GRANTED:' : '❌ ACCESS DENIED:', userName);
    
    res.json({ success: true });
  } catch (error) {
    console.log('Log error:', error.message);
    res.json({ success: true });
  }
});

// Get access logs
app.get('/api/logs/access', (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const limit = parseInt(req.query.limit) || 20;
    
    let filteredLogs = logs;
    if (deviceId) {
      filteredLogs = logs.filter(log => log.deviceId === deviceId);
    }
    
    res.json({
      success: true,
      logs: filteredLogs.slice(0, limit)
    });
  } catch (error) {
    console.log('Get logs error:', error.message);
    res.json({ success: true, logs: [] });
  }
});

// Catch-all for API routes
app.all('/api/*', (req, res) => {
  res.json({ success: true, message: 'API endpoint' });
});

// Global error handler - prevent crashes
process.on('uncaughtException', (error) => {
  console.log('⚠️ Non-fatal error:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('⚠️ Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ULTRA-STABLE Server running on port ${PORT}`);
  console.log(`📍 Web Interface: http://localhost:${PORT}`);
  console.log(`✅ Ready for ESP32 connections!`);
});
