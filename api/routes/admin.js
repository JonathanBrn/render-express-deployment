// File: api/routes/admin.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.use(authenticateToken);

// דשבורד כללי - דורש הרשאת צפייה בדוחות
router.get('/all-data', requirePermission('view_reports'), controller.getAllData);

// עדכון טיקט - דורש הרשאת ניהול טיקטים
router.post('/update-ticket', requirePermission('manage_tickets'), controller.updateTicket);

// ניהול משתמשים - דורש הרשאת ניהול משתמשים
router.get('/users', requirePermission('manage_users'), controller.getUsers);
router.post('/users', requirePermission('manage_users'), controller.saveUser);

module.exports = router;