const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Fix: Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// In-memory storage
const devices = new Map();
const pendingCommands = new Map();
const accessLogs = [];
const eventLogs = [];

// Fix: Simple root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Fingerprint Access Control API',
        endpoints: {
            health: '/api/health',
            device: '/api/devices/:id',
            command: 'POST /api/command',
            logs: '/api/logs/access'
        }
    });
});

// Fix: Health check endpoint
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

// Fix: Device heartbeat with better error handling
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, timestamp, status } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }
        
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
        
        res.json({ 
            success: true, 
            commands,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Device status endpoint
app.post('/api/devices/status', (req, res) => {
    try {
        const { deviceId, users } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }
        
        console.log('📊 Status from:', deviceId, 'Users:', users?.length || 0);
        
        if (devices.has(deviceId)) {
            const device = devices.get(deviceId);
            device.lastSeen = new Date().toISOString();
            device.users = users;
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Get device info
app.get('/api/devices/:deviceId', (req, res) => {
    try {
        const device = devices.get(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ 
                success: false, 
                error: 'Device not found' 
            });
        }
        
        res.json({ success: true, device });
    } catch (error) {
        console.error('Get device error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Command endpoint
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
        
        res.json({ success: true, command });
    } catch (error) {
        console.error('Command error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Access logs endpoint
app.post('/api/logs/access', (req, res) => {
    try {
        const log = { 
            ...req.body, 
            receivedAt: new Date().toISOString(),
            id: Math.random().toString(36).substr(2, 9)
        };
        
        // Validate required fields
        if (!log.deviceId || !log.userName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        accessLogs.unshift(log);
        if (accessLogs.length > 100) accessLogs.pop();
        
        console.log('🔐 Access:', log.userName, '-', log.granted ? 'GRANTED' : 'DENIED');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Access log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Event logs endpoint
app.post('/api/logs/event', (req, res) => {
    try {
        const log = { 
            ...req.body, 
            receivedAt: new Date().toISOString(),
            id: Math.random().toString(36).substr(2, 9)
        };
        
        eventLogs.unshift(log);
        if (eventLogs.length > 100) eventLogs.pop();
        
        console.log('📢 Event:', log.action, '-', log.message);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Event log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fix: Get access logs
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

// Fix: Get event logs
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

// Fix: Error handling for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'POST /api/devices/heartbeat',
            'POST /api/devices/status',
            'GET /api/devices/:id',
            'POST /api/command',
            'POST /api/logs/access',
            'POST /api/logs/event',
            'GET /api/logs/access',
            'GET /api/logs/events'
        ]
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fixed Fingerprint Server running on port ${PORT}`);
    console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
});
