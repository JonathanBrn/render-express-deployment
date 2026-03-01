// File: api/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const maintenanceRoutes = require('./routes/maintenance');
const resourceRoutes = require('./routes/resources');
// --- New Imports ---
const entryRoutes = require('./routes/entry');
const maaneRoutes = require('./routes/maane');
const chatRoutes = require('./routes/chat');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://cdn-icons-png.flaticon.com", "https://*.googleapis.com"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// --- Mounting Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/resource', resourceRoutes);
// --- New Mounts ---
app.use('/api/entry', entryRoutes);
app.use('/api/maane', maaneRoutes);
app.use('/api/chat', chatRoutes);

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

module.exports = app;