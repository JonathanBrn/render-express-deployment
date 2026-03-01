// File: api/middleware/rateLimiters.js
const rateLimit = require('express-rate-limit');

exports.otpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    message: { success: false, message: "Too many login attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

exports.loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { success: false, message: "יותר מדי ניסיונות שגויים! חכה דקה!." },
    standardHeaders: true,
    legacyHeaders: false,
});