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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        stats: {
            devices: devices.size,
            accessLogs: accessLogs.length,
            eventLogs: eventLogs.length
        }
    });
});

// Device heartbeat
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, timestamp, status, freeHeap, wifiRSSI } = req.body;
        
        console.log('📱 Heartbeat from:', deviceId);
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        // Update or create device
        const device = devices.get(deviceId) || { deviceId, users: [] };
        device.lastSeen = new Date().toISOString();
        device.timestamp = timestamp;
        device.status = status || 'online';
        device.freeHeap = freeHeap;
        device.wifiRSSI = wifiRSSI;
        
        devices.set(deviceId, device);
        
        // Return pending commands
        const commands = pendingCommands.get(deviceId) || [];
        pendingCommands.set(deviceId, []); // Clear after sending
        
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

// Device status update
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
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            id: id || 0, 
            name: name || '', 
            phone: phone || '', 
            cardId: cardId || '', 
            timestamp: Date.now() 
        };
        
        // Initialize if not exists
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

// Access logs
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

// Event logs
app.post('/api/logs/event', (req, res) => {
    try {
        const { deviceId, action, message, userId, cardId, timestamp } = req.body;
        
        if (!deviceId || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const logEntry = {
            id: Math.random().toString(36).substr(2, 9),
            deviceId,
            action,
            message: message || '',
            userId: userId || 0,
            cardId: cardId || 'NO_CARD',
            timestamp: timestamp || Date.now(),
            receivedAt: new Date().toISOString()
        };
        
        eventLogs.unshift(logEntry);
        if (eventLogs.length > 1000) eventLogs.pop();
        
        console.log('📢 Event:', action, '-', message);
        
        res.json({ success: true, message: 'Event log recorded' });
        
    } catch (error) {
        console.error('Event log error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        console.error('Get access logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        console.error('Get event logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all logs (for debugging)
app.get('/api/logs', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        
        res.json({
            success: true,
            accessLogs: accessLogs.slice(0, limit),
            eventLogs: eventLogs.slice(0, limit),
            stats: {
                totalAccessLogs: accessLogs.length,
                totalEventLogs: eventLogs.length
            }
        });
        
    } catch (error) {
        console.error('Get all logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        error: 'API endpoint not found',
        method: req.method,
        path: req.path,
        availableEndpoints: [
            'GET /api/health',
            'POST /api/devices/heartbeat',
            'POST /api/devices/status',
            'GET /api/devices/:id',
            'POST /api/command',
            'POST /api/logs/access',
            'POST /api/logs/event',
            'GET /api/logs/access',
            'GET /api/logs/events',
            'GET /api/logs'
        ]
    });
});

// Serve static files for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fingerprint Access Control Server running on port ${PORT}`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📱 Device ID: 8C128B2B1838`);
    console.log(`💾 Storage: In-memory (data resets on restart)`);
});
