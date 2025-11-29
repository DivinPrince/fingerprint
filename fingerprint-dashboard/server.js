const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Storage
const devices = new Map();
const pendingCommands = new Map();
const accessLogs = [];
const eventLogs = [];

// Initialize with default device
devices.set('8C128B2B1838', {
    deviceId: '8C128B2B1838',
    lastSeen: new Date().toISOString(),
    status: 'online',
    users: [],
    wifiRSSI: -45,
    freeHeap: 200000
});

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: Date.now(),
        devices: Array.from(devices.keys()),
        uptime: process.uptime()
    });
});

// Device heartbeat
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, timestamp, status, freeHeap, wifiRSSI } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        console.log('💓 Heartbeat from:', deviceId);

        const device = {
            deviceId,
            lastSeen: new Date().toISOString(),
            timestamp: timestamp || Date.now(),
            status: status || 'online',
            freeHeap: freeHeap || 0,
            wifiRSSI: wifiRSSI || 0,
            users: devices.get(deviceId)?.users || []
        };
        
        devices.set(deviceId, device);
        
        const commands = pendingCommands.get(deviceId) || [];
        pendingCommands.set(deviceId, []);
        
        res.json({ 
            success: true, 
            commands,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Heartbeat error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Device status
app.post('/api/devices/status', (req, res) => {
    try {
        const { deviceId, users } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        console.log('📊 Status update:', deviceId, 'Users:', users?.length || 0);

        if (devices.has(deviceId)) {
            const device = devices.get(deviceId);
            device.lastSeen = new Date().toISOString();
            device.users = users || [];
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Status error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get device info
app.get('/api/devices/:deviceId', (req, res) => {
    try {
        const device = devices.get(req.params.deviceId);
        
        if (!device) {
            return res.status(404).json({ 
                success: false, 
                error: 'Device not found' 
            });
        }
        
        res.json({ 
            success: true, 
            device: {
                deviceId: device.deviceId,
                lastSeen: device.lastSeen,
                status: device.status,
                users: device.users || [],
                wifiRSSI: device.wifiRSSI,
                freeHeap: device.freeHeap
            }
        });
        
    } catch (error) {
        console.error('Get device error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send command to device
app.post('/api/command', (req, res) => {
    try {
        const { deviceId, type, id, name, phone, cardId } = req.body;
        
        if (!deviceId || !type) {
            return res.status(400).json({
                success: false,
                error: 'deviceId and type are required'
            });
        }
        
        const command = { 
            type, 
            id: parseInt(id) || 0, 
            name: name?.toString() || '', 
            phone: phone?.toString() || '', 
            cardId: cardId?.toString() || '', 
            timestamp: Date.now() 
        };
        
        if (!pendingCommands.has(deviceId)) {
            pendingCommands.set(deviceId, []);
        }
        
        pendingCommands.get(deviceId).push(command);
        console.log('📨 Command queued:', command.type, 'for user:', command.name);
        
        res.json({ 
            success: true, 
            command,
            message: 'Command queued'
        });
        
    } catch (error) {
        console.error('Command error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Access logs
app.post('/api/logs/access', (req, res) => {
    try {
        const { deviceId, userId, userName, cardId, granted, timestamp } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        const logEntry = {
            id: Date.now() + Math.random(),
            deviceId: deviceId.toString(),
            userId: parseInt(userId) || 0,
            userName: userName?.toString() || 'Unknown',
            cardId: cardId?.toString() || 'NO_CARD',
            granted: Boolean(granted),
            timestamp: parseInt(timestamp) || Date.now(),
            receivedAt: Date.now()
        };
        
        accessLogs.unshift(logEntry);
        if (accessLogs.length > 500) {
            accessLogs.length = 500;
        }
        
        // Detailed logging
        if (granted) {
            console.log('✅ ACCESS GRANTED:', userName, '(ID:', userId, ')', 'Card:', cardId);
        } else {
            console.log('❌ ACCESS DENIED:', userName);
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Access log error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Event logs
app.post('/api/logs/event', (req, res) => {
    try {
        const { deviceId, action, message, userId, cardId, timestamp } = req.body;
        
        if (!deviceId || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const logEntry = {
            id: Date.now() + Math.random(),
            deviceId,
            action,
            message: message || '',
            userId: userId || 0,
            cardId: cardId || 'NO_CARD',
            timestamp: timestamp || Date.now(),
            receivedAt: new Date().toISOString()
        };
        
        eventLogs.unshift(logEntry);
        if (eventLogs.length > 500) eventLogs.pop();
        
        console.log('📢 Event:', action, '-', message);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Event log error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get access logs
app.get('/api/logs/access', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const deviceId = req.query.deviceId;
        
        let logs = accessLogs;
        if (deviceId) {
            logs = logs.filter(log => log.deviceId === deviceId);
        }
        
        res.json({
            success: true,
            logs: logs.slice(0, limit),
            total: logs.length
        });
        
    } catch (error) {
        console.error('Get access logs error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get event logs
app.get('/api/logs/events', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const deviceId = req.query.deviceId;
        
        let logs = eventLogs;
        if (deviceId) {
            logs = logs.filter(log => log.deviceId === deviceId);
        }
        
        res.json({
            success: true,
            logs: logs.slice(0, limit),
            total: logs.length
        });
        
    } catch (error) {
        console.error('Get event logs error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Web interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fingerprint Access Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; text-align: center; }
            .header h1 { color: #2c3e50; margin-bottom: 0.5rem; }
            .status { background: #27ae60; color: white; padding: 10px; border-radius: 5px; display: inline-block; margin: 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
            .card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .btn { background: #3498db; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .btn-success { background: #27ae60; }
            .btn-danger { background: #e74c3c; }
            .form-group { margin: 10px 0; }
            input { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
            .logs { max-height: 400px; overflow-y: auto; }
            .log-item { padding: 10px; border-bottom: 1px solid #eee; }
            .granted { color: #27ae60; }
            .denied { color: #e74c3c; }
            .users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
            .user-card { background: #f8f9fa; padding: 1rem; border-radius: 5px; border-left: 4px solid #3498db; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Fingerprint Access Control System</h1>
                <div class="status">🟢 System Online - Device: 8C128B2B1838</div>
            </div>
            
            <div class="grid">
                <div>
                    <div class="card">
                        <h3>User Management</h3>
                        <div id="usersList">Loading users...</div>
                        <div style="margin-top: 1rem;">
                            <button class="btn" onclick="showEnrollment()">Add User</button>
                            <button class="btn btn-danger" onclick="clearUsers()">Clear All Users</button>
                        </div>
                        
                        <div id="enrollmentForm" style="display: none; margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 5px;">
                            <h4>Enroll New User</h4>
                            <form onsubmit="enrollUser(event)">
                                <div class="form-group">
                                    <input type="number" id="userId" placeholder="User ID (1-20)" min="1" max="20" required>
                                </div>
                                <div class="form-group">
                                    <input type="text" id="userName" placeholder="Full Name" required>
                                </div>
                                <div class="form-group">
                                    <input type="tel" id="userPhone" placeholder="Phone Number" required>
                                </div>
                                <div class="form-group">
                                    <input type="text" id="userCard" placeholder="Card ID" required>
                                </div>
                                <button type="submit" class="btn btn-success">Start Enrollment</button>
                                <button type="button" class="btn btn-danger" onclick="hideEnrollment()">Cancel</button>
                            </form>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>System Information</h3>
                        <div id="systemInfo">Loading...</div>
                    </div>
                </div>
                
                <div>
                    <div class="card">
                        <h3>Recent Access Logs</h3>
                        <div class="logs" id="accessLogs">Loading...</div>
                        <button class="btn" onclick="loadLogs()" style="margin-top: 1rem;">Refresh Logs</button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            const API_BASE = '/api';
            const DEVICE_ID = '8C128B2B1838';
            
            async function loadAllData() {
                await Promise.all([loadUsers(), loadSystemInfo(), loadAccessLogs()]);
            }
            
            async function loadUsers() {
                try {
                    const response = await fetch(API_BASE + '/devices/' + DEVICE_ID);
                    const container = document.getElementById('usersList');
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.device.users) {
                            if (data.device.users.length === 0) {
                                container.innerHTML = '<p>No users enrolled yet</p>';
                                return;
                            }
                            
                            container.innerHTML = '<div class="users-grid">' + 
                                data.device.users.map(user => `
                                    <div class="user-card">
                                        <strong>${user.name}</strong><br>
                                        <small>ID: ${user.id} | Card: ${user.cardId || 'N/A'}</small><br>
                                        <small>Phone: ${user.phone || 'N/A'}</small>
                                        <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px; margin-top: 5px;" onclick="deleteUser(${user.id})">
                                            Delete
                                        </button>
                                    </div>
                                `).join('') + '</div>';
                        }
                    }
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }
            
            async function loadSystemInfo() {
                try {
                    const response = await fetch(API_BASE + '/devices/' + DEVICE_ID);
                    const container = document.getElementById('systemInfo');
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            container.innerHTML = \`
                                <p><strong>Last Seen:</strong> \${new Date(data.device.lastSeen).toLocaleString()}</p>
                                <p><strong>Status:</strong> \${data.device.status}</p>
                                <p><strong>WiFi Strength:</strong> \${data.device.wifiRSSI || 'N/A'} dBm</p>
                                <p><strong>Free Memory:</strong> \${data.device.freeHeap ? (data.device.freeHeap / 1024).toFixed(1) + ' KB' : 'N/A'}</p>
                            \`;
                        }
                    }
                } catch (error) {
                    console.error('Error loading system info:', error);
                }
            }
            
            async function loadAccessLogs() {
                try {
                    const response = await fetch(API_BASE + '/logs/access?deviceId=' + DEVICE_ID + '&limit=20');
                    const container = document.getElementById('accessLogs');
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.logs.length > 0) {
                            container.innerHTML = data.logs.map(log => \`
                                <div class="log-item">
                                    <strong class="\${log.granted ? 'granted' : 'denied'}">\${log.granted ? '✅ GRANTED' : '❌ DENIED'}</strong>
                                    <br><strong>\${log.userName}</strong>
                                    <br>Card: \${log.cardId || 'N/A'}
                                    <br><small>\${new Date(log.timestamp).toLocaleString()}</small>
                                </div>
                            \`).join('');
                        } else {
                            container.innerHTML = '<p>No access logs yet</p>';
                        }
                    }
                } catch (error) {
                    console.error('Error loading logs:', error);
                }
            }
            
            function showEnrollment() {
                document.getElementById('enrollmentForm').style.display = 'block';
            }
            
            function hideEnrollment() {
                document.getElementById('enrollmentForm').style.display = 'none';
            }
            
            async function enrollUser(event) {
                event.preventDefault();
                const id = document.getElementById('userId').value;
                const name = document.getElementById('userName').value;
                const phone = document.getElementById('userPhone').value;
                const card = document.getElementById('userCard').value;
                
                try {
                    const response = await fetch(API_BASE + '/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: DEVICE_ID,
                            type: 'enroll',
                            id: parseInt(id),
                            name,
                            phone,
                            cardId: card
                        })
                    });
                    
                    if (response.ok) {
                        alert('Enrollment started! Check device LCD for instructions.');
                        hideEnrollment();
                        event.target.reset();
                    } else {
                        alert('Error starting enrollment');
                    }
                } catch (error) {
                    alert('Error starting enrollment');
                }
            }
            
            async function deleteUser(userId) {
                if (!confirm('Are you sure you want to delete this user?')) return;
                
                try {
                    const response = await fetch(API_BASE + '/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: DEVICE_ID,
                            type: 'delete',
                            id: userId
                        })
                    });
                    
                    if (response.ok) {
                        alert('User deleted!');
                        loadUsers();
                    }
                } catch (error) {
                    alert('Error deleting user');
                }
            }
            
            async function clearUsers() {
                if (!confirm('This will delete ALL users. Are you sure?')) return;
                
                try {
                    const response = await fetch(API_BASE + '/command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deviceId: DEVICE_ID,
                            type: 'clear'
                        })
                    });
                    
                    if (response.ok) {
                        alert('All users cleared!');
                        loadUsers();
                    }
                } catch (error) {
                    alert('Error clearing users');
                }
            }
            
            // Auto-refresh every 15 seconds
            setInterval(loadAllData, 15000);
            loadAllData();
        </script>
    </body>
    </html>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fingerprint Access Control Server running on port ${PORT}`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`✅ System Ready for Access Grants!`);
});
