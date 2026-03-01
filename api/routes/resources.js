// File: api/routes/resources.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/resourceController');
const { authenticateToken } = require('../middleware/auth');

// All resource routes require authentication
router.use(authenticateToken);

// 1. Get the main HTML (Dashboard or Admin)
router.get('/dashboard-html', controller.getDashboardHtml);

// 2. Get General JS files (e.g., binui.js)
router.get('/js/:filename', controller.getJsFile);

// 3. Get Module files (e.g., Maane Laprat forms)
router.get('/module/:category/:folder/:filename', controller.getModuleFile);

// 4. Get Chat files
router.get('/chat/:filename', controller.getChatFile);

module.exports = router;