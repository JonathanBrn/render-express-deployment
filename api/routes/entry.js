// File: api/routes/entry.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/entryController');
const { authenticateToken } = require('../middleware/auth');

// שים לב: בגלל הבאג המקורי בקוד, אנחנו נאפשר גישה גם ללא טוקן אם חייבים, 
// אבל עדיף להגן עליו. כאן הוספתי הגנה.
router.post('/create', authenticateToken, controller.createPermit);

module.exports = router;