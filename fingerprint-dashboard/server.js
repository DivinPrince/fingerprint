const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage
const devices = new Map();
const pendingCommands = new Map();
const accessLogs = [];
const eventLogs = [];

// Serve HTML interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fingerprint Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #f0f2f5; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .card { background: white; padding: 20px; margin: 10px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            .btn-primary { background: #3498db; color: white; }
            .btn-danger { background: #e74c3c; color: white; }
            .form-group { margin: 10px 0; }
            .form-control { width: 100%; padding: 8px; margin: 5px 0; }
            .logs { height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; font-size: 12px; }
            .hidden { display: none; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Fingerprint Test System</h1>
                <p>Device ID: <span id="deviceId">8C128B2B1838</span></p>
            </div>

            <div class="grid">
                <div>
                    <div class="card">
                        <h3>👤 Quick Enrollment</h3>
                        <form id="enrollForm">
                            <input type="number" id="enrollId" class="form-control" placeholder="User ID (1-20)" min="1" max="20" required>
                            <input type="text" id="enrollName" class="form-control" placeholder="Name" required>
                            <input type="tel" id="enrollPhone" class="form-control" placeholder="Phone" required>
                            <input type="text" id="enrollCardId" class="form-control" placeholder="Card ID" required>
                            <button type="submit" class="btn btn-primary">Start Enrollment</button>
                        </form>
                    </div>

                    <div class="card">
                        <h3>⚡ Quick Actions</h3>
                        <button class="btn btn-primary" onclick="getStatus()">Refresh Status</button>
                        <button class="btn btn-danger" onclick="clearAll()">Clear All Users</button>
                        <div style="margin-top: 10px;">
                            <input type="number" id="deleteId" class="form-control" placeholder="User ID to delete" style="width: 150px; display: inline-block;">
                            <button class="btn btn-danger" onclick="deleteUser()">Delete User</button>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="card">
                        <h3>📊 System Info</h3>
                        <div id="status">Click Refresh Status</div>
                        <div class="logs" id="accessLogs">Access logs will appear here...</div>
                    </div>

                    <div class="card">
                        <h3>🔔 Events</h3>
                        <div class="logs" id="eventLogs">System events will appear here...</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            const API_BASE = '/api';
            let deviceId = '8C128B2B1838';

            // Enrollment
            document.getElementById('enrollForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('enrollId').value;
                const name = document.getElementById('enrollName').value;
                const phone = document.getElementById('enrollPhone').value;
                const cardId = document.getElementById('enrollCardId').value;

                const response = await fetch(API_BASE + '/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId, type: 'enroll', id: parseInt(id), name, phone, cardId })
                });

                if (response.ok) {
                    alert('Enrollment started!');
                    e.target.reset();
                } else {
                    alert('Error starting enrollment');
                }
            });

            async function getStatus() {
                try {
                    const response = await fetch(API_BASE + '/devices/' + deviceId);
                    const data = await response.json();
                    
                    if (data.success) {
                        document.getElementById('status').innerHTML = `
                            <strong>Status:</strong> Online<br>
                            <strong>Users:</strong> ${data.device.users?.length || 0}<br>
                            <strong>Last Seen:</strong> ${new Date(data.device.lastSeen).toLocaleTimeString()}
                        `;
                    }
                } catch (error) {
                    document.getElementById('status').innerHTML = 'Error fetching status';
                }
            }

            async function deleteUser() {
                const id = document.getElementById('deleteId').value;
                if (!id) return alert('Enter User ID');

                await fetch(API_BASE + '/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId, type: 'delete', id: parseInt(id) })
                });

                alert('Delete command sent');
                document.getElementById('deleteId').value = '';
            }

            async function clearAll() {
                if (!confirm('Clear ALL users?')) return;
                
                await fetch(API_BASE + '/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId, type: 'clear' })
                });

                alert('Clear command sent');
            }

            // Load logs on start
            async function loadLogs() {
                try {
                    const [accessRes, eventsRes] = await Promise.all([
                        fetch(API_BASE + '/logs/access?limit=10'),
                        fetch(API_BASE + '/logs/events?limit=10')
                    ]);

                    const accessData = await accessRes.json();
                    const eventsData = await eventsRes.json();

                    if (accessData.success) {
                        document.getElementById('accessLogs').innerHTML = accessData.logs
                            .map(log => `<div>${new Date(log.timestamp).toLocaleTimeString()} - ${log.userName} (${log.cardId}) - ${log.granted ? '✅' : '❌'}</div>`)
                            .join('');
                    }

                    if (eventsData.success) {
                        document.getElementById('eventLogs').innerHTML = eventsData.logs
                            .map(log => `<div>${new Date(log.timestamp).toLocaleTimeString()} - ${log.action}: ${log.message}</div>`)
                            .join('');
                    }
                } catch (error) {
                    console.error('Error loading logs:', error);
                }
            }

            // Auto-refresh every 5 seconds
            setInterval(() => {
                getStatus();
                loadLogs();
            }, 5000);

            // Initial load
            getStatus();
            loadLogs();
        </script>
    </body>
    </html>
    `);
});

// API Routes
app.post('/api/devices/heartbeat', (req, res) => {
    const { deviceId, timestamp, status } = req.body;
    
    console.log('📱 Heartbeat from:', deviceId);
    
    // Store device
    devices.set(deviceId, {
        deviceId,
        lastSeen: new Date().toISOString(),
        timestamp,
        status,
        ip: req.ip
    });
    
    // Return pending commands
    const commands = pendingCommands.get(deviceId) || [];
    pendingCommands.set(deviceId, []);
    
    res.json({ success: true, commands });
});

app.post('/api/devices/status', (req, res) => {
    const { deviceId, users } = req.body;
    console.log('📊 Status from:', deviceId, 'Users:', users?.length || 0);
    
    if (devices.has(deviceId)) {
        const device = devices.get(deviceId);
        device.lastSeen = new Date().toISOString();
        device.users = users;
    }
    
    res.json({ success: true });
});

app.get('/api/devices/:deviceId', (req, res) => {
    const device = devices.get(req.params.deviceId);
    res.json(device ? { success: true, device } : { success: false, error: 'Device not found' });
});

app.post('/api/command', (req, res) => {
    const { deviceId, type, id, name, phone, cardId } = req.body;
    
    const command = { type, id, name, phone, cardId, timestamp: Date.now() };
    
    if (!pendingCommands.has(deviceId)) {
        pendingCommands.set(deviceId, []);
    }
    
    pendingCommands.get(deviceId).push(command);
    console.log('📨 Command queued:', command);
    
    res.json({ success: true, command });
});

app.post('/api/logs/access', (req, res) => {
    const log = { ...req.body, receivedAt: new Date().toISOString() };
    accessLogs.unshift(log);
    if (accessLogs.length > 100) accessLogs.pop();
    console.log('🔐 Access:', log.userName, log.granted ? 'GRANTED' : 'DENIED');
    res.json({ success: true });
});

app.post('/api/logs/event', (req, res) => {
    const log = { ...req.body, receivedAt: new Date().toISOString() };
    eventLogs.unshift(log);
    if (eventLogs.length > 100) eventLogs.pop();
    console.log('📢 Event:', log.action, '-', log.message);
    res.json({ success: true });
});

app.get('/api/logs/access', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ success: true, logs: accessLogs.slice(0, limit) });
});

app.get('/api/logs/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ success: true, logs: eventLogs.slice(0, limit) });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        devices: Array.from(devices.keys()),
        stats: {
            devices: devices.size,
            accessLogs: accessLogs.length,
            eventLogs: eventLogs.length
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Fingerprint Test Server running on port ${PORT}`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
});
