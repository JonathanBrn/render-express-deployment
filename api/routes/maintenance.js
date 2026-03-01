// File: api/routes/maintenance.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/maintenanceController');
const { authenticateToken } = require('../middleware/auth');

router.post('/report', authenticateToken, controller.createReport);
router.get('/my-tickets', authenticateToken, controller.getMyTickets); // הוספנו את זה

module.exports = router;