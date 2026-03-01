// File: api/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { otpLimiter, loginLimiter } = require('../middleware/rateLimiters');

// POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, authController.sendOtp);

// POST /api/auth/verify-otp
router.post('/verify-otp', loginLimiter, authController.verifyOtp);

module.exports = router;