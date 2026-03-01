// File: api/routes/chat.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.post('/send', controller.sendMessage);
router.get('/sync', controller.syncMessages);

module.exports = router;