// File: api/middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware 1: פענוח הטוקן (ללא שינוי מהותי)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "חסר טוקן אימות" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "טוקן לא תקין" });
        
        // טעינת המידע מהטוקן לאובייקט הבקשה
        req.user = {
            phone: decoded.data || decoded.phone,
            role: decoded.role || 'guest',
            domains: decoded.domains || [] // זה המערך שמשכנו בלוגין
        };
        next();
    });
};

// Middleware 2: בדיקת הרשאה דינמית
// שימוש: router.get('/users', requirePermission('manage_users'), ...)
const requirePermission = (requiredDomain) => {
    return (req, res, next) => {
        const userDomains = req.user.domains || [];

        // 1. אם למשתמש יש הרשאת 'על' (*), הוא מורשה תמיד
        if (userDomains.includes('*')) {
            return next();
        }

        // 2. בדיקה אם ההרשאה הספציפית קיימת ברשימה שלו
        if (userDomains.includes(requiredDomain)) {
            return next();
        }

        // 3. אם לא - חסימה
        console.warn(`⛔ גישה נחסמה: ${req.user.phone} ניסה לגשת ל-${requiredDomain}`);
        return res.status(403).json({ 
            success: false, 
            message: "אין לך הרשאה לבצע פעולה זו" 
        });
    };
};

module.exports = { authenticateToken, requirePermission };