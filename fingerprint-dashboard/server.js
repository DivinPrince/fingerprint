const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with error handling
app.use(cors());
app.use(express.json({ 
    limit: '1mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }
}));

// Simple in-memory storage with limits
const devices = new Map();
const pendingCommands = new Map();
const accessLogs = [];
const MAX_LOGS = 500; // Prevent memory overflow

// Initialize with default device
function initializeDevice() {
    devices.set('8C128B2B1838', {
        deviceId: '8C128B2B1838',
        lastSeen: new Date().toISOString(),
        status: 'online',
        users: [],
        wifiRSSI: -45,
        freeHeap: 200000
    });
}

initializeDevice();

// Request logging with error handling
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
    next();
});

// Health check - simple and reliable
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: Date.now(),
        devices: Array.from(devices.keys()),
        uptime: process.uptime()
    });
});

// Device heartbeat - optimized and stable
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, timestamp, status, freeHeap, wifiRSSI } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        console.log('💓 Heartbeat from:', deviceId);

        // Simple device update
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
        
        // Get pending commands safely
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

// Device status - simplified
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

// Access logs - with memory protection
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
        
        // Prevent memory overflow
        accessLogs.unshift(logEntry);
        if (accessLogs.length > MAX_LOGS) {
            accessLogs.length = MAX_LOGS;
        }
        
        console.log('🔐 Access:', logEntry.userName, '-', logEntry.granted ? 'GRANTED' : 'DENIED');
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Access log error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get access logs
app.get('/api/logs/access', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
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

// Simple web interface
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
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .status { background: #4CAF50; color: white; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .card { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
            .btn { background: #007cba; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .btn-danger { background: #dc3545; }
            .form-group { margin: 10px 0; }
            input { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Fingerprint Access Control</h1>
                <div class="status">🟢 System Online - Device: 8C128B2B1838</div>
            </div>
            
            <div class="card">
                <h3>Quick Actions</h3>
                <button class="btn" onclick="loadData()">Refresh Status</button>
                <button class="btn btn-danger" onclick="clearUsers()">Clear All Users</button>
            </div>
            
            <div class="card">
                <h3>Enroll New User</h3>
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
                    <button type="submit" class="btn">Start Enrollment</button>
                </form>
            </div>
            
            <div class="card">
                <h3>System Info</h3>
                <div id="info">Loading...</div>
            </div>
            
            <div class="card">
                <h3>Recent Access</h3>
                <div id="logs">Loading...</div>
            </div>
        </div>

        <script>
            const API_BASE = '/api';
            const DEVICE_ID = '8C128B2B1838';
            
            async function loadData() {
                try {
                    const [deviceRes, logsRes] = await Promise.all([
                        fetch(API_BASE + '/devices/' + DEVICE_ID),
                        fetch(API_BASE + '/logs/access?deviceId=' + DEVICE_ID + '&limit=10')
                    ]);
                    
                    if (deviceRes.ok) {
                        const deviceData = await deviceRes.json();
                        if (deviceData.success) {
                            document.getElementById('info').innerHTML = \`
                                <p><strong>Users:</strong> \${deviceData.device.users?.length || 0}</p>
                                <p><strong>Last Seen:</strong> \${new Date(deviceData.device.lastSeen).toLocaleTimeString()}</p>
                                <p><strong>Status:</strong> \${deviceData.device.status}</p>
                            \`;
                        }
                    }
                    
                    if (logsRes.ok) {
                        const logsData = await logsRes.json();
                        if (logsData.success) {
                            document.getElementById('logs').innerHTML = logsData.logs.map(log => \`
                                <p>\${new Date(log.timestamp).toLocaleTimeString()} - \${log.userName} - \${log.granted ? '✅ Granted' : '❌ Denied'}</p>
                            \`).join('');
                        }
                    }
                } catch (error) {
                    console.error('Error loading data:', error);
                }
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
                        alert('Enrollment started!');
                        event.target.reset();
                    } else {
                        alert('Error starting enrollment');
                    }
                } catch (error) {
                    alert('Error starting enrollment');
                }
            }
            
            async function clearUsers() {
                if (!confirm('Clear ALL users?')) return;
                
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
                        loadData();
                    }
                } catch (error) {
                    alert('Error clearing users');
                }
            }
            
            // Auto-refresh every 15 seconds
            setInterval(loadData, 15000);
            loadData();
        </script>
    </body>
    </html>
    `);
});

// Global error handler
process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error.message);
    // Don't exit - keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 STABLE Fingerprint Server running on port ${PORT}`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📱 Device ID: 8C128B2B1838`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});
