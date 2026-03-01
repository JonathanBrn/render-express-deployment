// File: api/routes/maane.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/maaneController');
const { authenticateToken } = require('../middleware/auth');

router.post('/report', authenticateToken, controller.createRequest);

module.exports = router;