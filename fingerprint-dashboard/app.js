const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/index'));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Fingerprint Dashboard is running',
    timestamp: new Date().toISOString()
  });
});

// Handle all other routes - serve index.html for client-side routing
app.get('*', (req, res) => {
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fingerprint Dashboard running on port ${PORT}`);
  console.log(`📊 Access your dashboard at: http://localhost:${PORT}`);
});

module.exports = app;
