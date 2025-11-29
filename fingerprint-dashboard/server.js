const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(bodyParser.json());
app.use(express.static("public"));

let heartbeats = [];
let accessLogs = [];
let commands = [];

// --- API Endpoints ---
app.post("/api/heartbeat", (req, res) => {
  const data = req.body;
  heartbeats.push(data);
  io.emit("heartbeat", data); // push to UI
  res.json({ success: true });
});

app.post("/api/access", (req, res) => {
  const data = req.body;
  accessLogs.push(data);
  io.emit("access", data);
  res.json({ success: true });
});

app.post("/api/enrollment", (req, res) => {
  const data = req.body;
  io.emit("enrollment", data);
  res.json({ success: true });
});

app.post("/api/events", (req, res) => {
  const data = req.body;
  io.emit("events", data);
  res.json({ success: true });
});

// --- Commands for devices ---
app.get("/api/commands/:deviceId", (req, res) => {
  const deviceId = req.params.deviceId;
  const deviceCommands = commands.filter(c => c.deviceId === deviceId);
  res.json(deviceCommands);
});

// Add a command (for testing enroll/delete)
app.post("/api/commands", (req, res) => {
  const cmd = req.body;
  commands.push(cmd);
  res.json({ success: true });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
