const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'data', 'logs.json');

// Ensure data folder exists
fs.ensureFileSync(DATA_FILE);

// Load logs
let logs = fs.readJsonSync(DATA_FILE, { throws: false }) || [];

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// ---------------- API Endpoints ----------------
app.post('/api/heartbeat', (req, res) => {
    const data = req.body;
    console.log('Heartbeat:', data);
    res.json({ status: 'ok' });
    io.emit('heartbeat', data);
});

app.post('/api/access', (req, res) => {
    const log = req.body;
    console.log('Access Log:', log);
    logs.push(log);
    fs.writeJsonSync(DATA_FILE, logs);
    res.json({ status: 'ok' });
    io.emit('access', log);
});

app.post('/api/enrollment', (req, res) => {
    const update = req.body;
    console.log('Enrollment Update:', update);
    res.json({ status: 'ok' });
    io.emit('enrollment', update);
});

app.post('/api/events', (req, res) => {
    const event = req.body;
    console.log('Device Event:', event);
    res.json({ status: 'ok' });
    io.emit('event', event);
});

app.get('/api/logs', (req, res) => {
    res.json(logs);
});

// ---------------- Dashboard ----------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------- Socket.IO ----------------
io.on('connection', socket => {
    console.log('Dashboard connected');
    socket.emit('logs', logs);
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
