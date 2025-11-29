const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Storage (in-memory for testing)
const devices = new Map();
const pendingCommands = new Map();
const accessLogs = [];
const eventLogs = [];

// Initialize with test device
devices.set('8C128B2B1838', {
    deviceId: '8C128B2B1838',
    lastSeen: new Date().toISOString(),
    status: 'online',
    users: [],
    wifiRSSI: -45,
    freeHeap: 200000
});

// Serve the main interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fingerprint Access Control</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --primary: #2563eb;
                --primary-dark: #1d4ed8;
                --secondary: #64748b;
                --success: #10b981;
                --warning: #f59e0b;
                --danger: #ef4444;
                --dark: #1e293b;
                --light: #f8fafc;
                --sidebar-width: 260px;
                --border-radius: 12px;
                --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --transition: all 0.3s ease;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: #f1f5f9;
                color: #334155;
                line-height: 1.6;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem;
            }

            .header {
                background: white;
                padding: 2rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                margin-bottom: 2rem;
                text-align: center;
            }

            .header h1 {
                color: var(--dark);
                margin-bottom: 0.5rem;
                font-size: 2.5rem;
            }

            .header p {
                color: var(--secondary);
                font-size: 1.1rem;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                display: flex;
                align-items: center;
                gap: 1rem;
                transition: var(--transition);
            }

            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }

            .stat-icon {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                background: var(--primary);
                color: white;
            }

            .stat-icon.success { background: var(--success); }
            .stat-icon.warning { background: var(--warning); }

            .stat-info h3 {
                font-size: 2rem;
                font-weight: 700;
                color: var(--dark);
                margin-bottom: 0.25rem;
            }

            .stat-info p {
                color: var(--secondary);
                font-size: 0.875rem;
            }

            .content-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 2rem;
            }

            .card {
                background: white;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                padding: 1.5rem;
            }

            .card h3 {
                color: var(--dark);
                margin-bottom: 1rem;
                font-size: 1.25rem;
            }

            .btn {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: var(--border-radius);
                font-size: 0.875rem;
                font-weight: 500;
                text-decoration: none;
                cursor: pointer;
                transition: var(--transition);
                background: var(--primary);
                color: white;
                margin: 0.25rem;
            }

            .btn:hover {
                transform: translateY(-1px);
                box-shadow: var(--shadow);
            }

            .btn-danger {
                background: var(--danger);
            }

            .btn-success {
                background: var(--success);
            }

            .form-group {
                margin-bottom: 1rem;
            }

            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: var(--dark);
            }

            .form-group input {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d1d5db;
                border-radius: var(--border-radius);
                font-size: 1rem;
            }

            .logs {
                max-height: 400px;
                overflow-y: auto;
            }

            .log-item {
                padding: 0.75rem;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .log-item:last-child {
                border-bottom: none;
            }

            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
            }

            .status-badge.granted {
                background: #d1fae5;
                color: var(--success);
            }

            .status-badge.denied {
                background: #fee2e2;
                color: var(--danger);
            }

            .toast {
                position: fixed;
                top: 2rem;
                right: 2rem;
                background: white;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                padding: 1rem 1.5rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                z-index: 1000;
            }

            .hidden {
                display: none;
            }

            @media (max-width: 768px) {
                .content-grid {
                    grid-template-columns: 1fr;
                }
                
                .container {
                    padding: 1rem;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Fingerprint Access Control System</h1>
                <p>Device ID: <strong>8C128B2B1838</strong> | Status: <span id="statusText" style="color: var(--success);">🟢 Online</span></p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="totalUsers">0</h3>
                        <p>Registered Users</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="todayAccess">0</h3>
                        <p>Today's Access</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning">
                        <i class="fas fa-times-circle"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="deniedAttempts">0</h3>
                        <p>Denied Attempts</p>
                    </div>
                </div>
            </div>

            <div class="content-grid">
                <div class="card">
                    <h3>User Management</h3>
                    <div id="usersList">
                        <p>Loading users...</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn" onclick="showEnrollmentForm()">
                            <i class="fas fa-user-plus"></i> Add User
                        </button>
                        <button class="btn btn-danger" onclick="clearAllUsers()">
                            <i class="fas fa-trash"></i> Clear All Users
                        </button>
                    </div>

                    <div id="enrollmentForm" class="hidden" style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: var(--border-radius);">
                        <h4>Enroll New User</h4>
                        <form onsubmit="startEnrollment(event)">
                            <div class="form-group">
                                <label>User ID (1-20):</label>
                                <input type="number" id="enrollId" min="1" max="20" required>
                            </div>
                            <div class="form-group">
                                <label>Full Name:</label>
                                <input type="text" id="enrollName" required>
                            </div>
                            <div class="form-group">
                                <label>Phone Number:</label>
                                <input type="tel" id="enrollPhone" required>
                            </div>
                            <div class="form-group">
                                <label>Card ID:</label>
                                <input type="text" id="enrollCardId" required>
                            </div>
                            <button type="submit" class="btn btn-success">
                                <i class="fas fa-fingerprint"></i> Start Enrollment
                            </button>
                            <button type="button" class="btn btn-danger" onclick="hideEnrollmentForm()">
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>

                <div class="card">
                    <h3>Recent Access Logs</h3>
                    <div class="logs" id="accessLogs">
                        <p>Loading logs...</p>
                    </div>
                    <button class="btn" onclick="loadLogs()" style="margin-top: 1rem;">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
        </div>

        <div id="toast" class="toast hidden"></div>

        <script>
            const API_BASE = '/api';
            const DEVICE_ID = '8C128B2B1838';

            async function loadData() {
                await Promise.all([loadUsers(), loadAccessLogs(), loadSystemStatus()]);
            }

            async function loadSystemStatus() {
                try {
                    const response = await fetch(API_BASE + '/devices/' + DEVICE_ID);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            document.getElementById('totalUsers').textContent = data.device.users?.length || 0;
                        }
                    }
                } catch (error) {
                    console.error('Error loading system status:', error);
                }
            }

            async function loadUsers() {
                try {
                    const response = await fetch(API_BASE + '/devices/' + DEVICE_ID);
                    const container = document.getElementById('usersList');
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.device.users) {
                            if (data.device.users.length === 0) {
                                container.innerHTML = '<p>No users registered</p>';
                                return;
                            }
                            
                            container.innerHTML = data.device.users.map(user => `
                                <div style="padding: 0.5rem; border-bottom: 1px solid #e2e8f0;">
                                    <strong>${user.name}</strong> (ID: ${user.id})<br>
                                    <small>Card: ${user.cardId || 'N/A'} | Phone: ${user.phone || 'N/A'}</small>
                                    <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; float: right;" onclick="deleteUser(${user.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('');
                        }
                    }
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }

            async function loadAccessLogs() {
                try {
                    const response = await fetch(API_BASE + '/logs/access?deviceId=' + DEVICE_ID + '&limit=10');
                    const container = document.getElementById('accessLogs');
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.logs.length > 0) {
                            container.innerHTML = data.logs.map(log => `
                                <div class="log-item">
                                    <div>
                                        <strong>${log.userName}</strong><br>
                                        <small>${new Date(log.timestamp).toLocaleTimeString()}</small>
                                    </div>
                                    <span class="status-badge ${log.granted ? 'granted' : 'denied'}">
                                        ${log.granted ? 'Granted' : 'Denied'}
                                    </span>
                                </div>
                            `).join('');
                        } else {
                            container.innerHTML = '<p>No access logs yet</p>';
                        }
                    }
                } catch (error) {
                    console.error('Error loading logs:', error);
                }
            }

            function showEnrollmentForm() {
                document.getElementById('enrollmentForm').classList.remove('hidden');
            }

            function hideEnrollmentForm() {
                document.getElementById('enrollmentForm').classList.add('hidden');
            }

            async function startEnrollment(event) {
                event.preventDefault();
                
                const id = document.getElementById('enrollId').value;
                const name = document.getElementById('enrollName').value;
                const phone = document.getElementById('enrollPhone').value;
                const cardId = document.getElementById('enrollCardId').value;

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
                            cardId
                        })
                    });

                    if (response.ok) {
                        showToast('Enrollment started successfully!', 'success');
                        hideEnrollmentForm();
                        document.getElementById('enrollId').value = '';
                        document.getElementById('enrollName').value = '';
                        document.getElementById('enrollPhone').value = '';
                        document.getElementById('enrollCardId').value = '';
                    } else {
                        showToast('Failed to start enrollment', 'error');
                    }
                } catch (error) {
                    console.error('Error starting enrollment:', error);
                    showToast('Error starting enrollment', 'error');
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
                        showToast('User deleted successfully', 'success');
                        loadUsers();
                    } else {
                        showToast('Failed to delete user', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting user:', error);
                    showToast('Error deleting user', 'error');
                }
            }

            async function clearAllUsers() {
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
                        showToast('All users cleared successfully', 'success');
                        loadUsers();
                    } else {
                        showToast('Failed to clear users', 'error');
                    }
                } catch (error) {
                    console.error('Error clearing users:', error);
                    showToast('Error clearing users', 'error');
                }
            }

            function showToast(message, type = 'info') {
                const toast = document.getElementById('toast');
                toast.textContent = message;
                toast.className = `toast ${type}`;
                toast.classList.remove('hidden');

                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 3000);
            }

            // Auto-refresh every 10 seconds
            setInterval(loadData, 10000);

            // Initial load
            loadData();
        </script>
    </body>
    </html>
    `);
});

// API Routes (same as before)
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, timestamp, status, freeHeap, wifiRSSI } = req.body;
        
        console.log('📱 Heartbeat from:', deviceId);
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        const device = devices.get(deviceId) || { deviceId, users: [] };
        device.lastSeen = new Date().toISOString();
        device.timestamp = timestamp;
        device.status = status || 'online';
        device.freeHeap = freeHeap;
        device.wifiRSSI = wifiRSSI;
        
        devices.set(deviceId, device);
        
        const commands = pendingCommands.get(deviceId) || [];
        pendingCommands.set(deviceId, []);
        
        res.json({ 
            success: true, 
            commands,
            message: 'Heartbeat received'
        });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/devices/status', (req, res) => {
    try {
        const { deviceId, users, timestamp, wifiRSSI, freeHeap } = req.body;
        
        console.log('📊 Status from:', deviceId, 'Users:', users?.length || 0);
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        if (devices.has(deviceId)) {
            const device = devices.get(deviceId);
            device.lastSeen = new Date().toISOString();
            device.users = users || [];
            device.wifiRSSI = wifiRSSI;
            device.freeHeap = freeHeap;
        }
        
        res.json({ success: true, message: 'Status updated' });
        
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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
            id: id || 0, 
            name: name || '', 
            phone: phone || '', 
            cardId: cardId || '', 
            timestamp: Date.now() 
        };
        
        if (!pendingCommands.has(deviceId)) {
            pendingCommands.set(deviceId, []);
        }
        
        pendingCommands.get(deviceId).push(command);
        console.log('📨 Command queued:', command);
        
        res.json({ 
            success: true, 
            command,
            message: 'Command queued for device'
        });
        
    } catch (error) {
        console.error('Command error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/logs/access', (req, res) => {
    try {
        const { deviceId, userId, userName, cardId, granted, timestamp } = req.body;
        
        if (!deviceId || !userName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const logEntry = {
            id: Math.random().toString(36).substr(2, 9),
            deviceId,
            userId: userId || 0,
            userName,
            cardId: cardId || 'NO_CARD',
            granted: granted || false,
            timestamp: timestamp || Date.now(),
            receivedAt: new Date().toISOString()
        };
        
        accessLogs.unshift(logEntry);
        if (accessLogs.length > 1000) accessLogs.pop();
        
        console.log('🔐 Access:', userName, '-', granted ? 'GRANTED' : 'DENIED');
        
        res.json({ success: true, message: 'Access log recorded' });
        
    } catch (error) {
        console.error('Access log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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
        console.error('Get access logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fingerprint Access Control Server running on port ${PORT}`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`✅ ESP32 is successfully connected!`);
});
