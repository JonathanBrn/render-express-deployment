// File: api/controllers/authController.js
const jwt = require('jsonwebtoken');
const { db, admin } = require('../config/firebase'); // Import from your new config
const client = require('../config/twilio'); // Import from your new config

// Helper: Send SMS (Internal function)
async function sendSMSOtp(phoneNumber, code) {
    if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
    }
    try {
        await client.messages.create({
            body: `Your Sphere verification code is: ${code}`,
            from: 'whatsapp:+14155238886', // Sandbox number
            to: 'whatsapp:' + phoneNumber
        });
    } catch (error) {
        console.error("Twilio Error:", error.message);
        throw error;
    }
}

// 1. Send OTP
exports.sendOtp = async (req, res) => {
    const { phone } = req.body;
    
    // ולידציה בסיסית
    if (!phone) return res.status(400).json({ success: false, message: "חסר מספר טלפון" });

    // נירמול המספר (כדי שיתאים למפתח ב-DB)
    const cleanPhone = phone.replace(/\D/g, ''); 

    try {
        // === בדיקת Whitelist (החלק החדש) ===
        // 1. נסיון שליפת המשתמש מה-DB
        const userDoc = await db.collection('users').doc(cleanPhone).get();

        // 2. בדיקה כפולה: האם המשתמש לא קיים? או האם הוא קיים אבל חסום?
        if (!userDoc.exists || userDoc.data().isActive === false) {
            console.warn(`⛔ ניסיון כניסה נחסם למספר: ${cleanPhone}`);
            return res.status(403).json({ 
                success: false, 
                message: "אינך מורשה לגשת למערכת. פנה למנהל המערכת להוספה." 
            });
        }
        // ====================================

        // אם עברנו את הבדיקה, ממשיכים כרגיל:
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + (5 * 60 * 1000); // 5 דקות

        // שמירת הקוד ב-otps
        await db.collection('otps').doc(cleanPhone).set({
            code: code,
            expiresAt: expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // שליחת ההודעה בוואטסאפ (הפונקציה הפנימית שלך)
        await sendSMSOtp(cleanPhone, code); // וודא שהפונקציה הזו קיימת למעלה בקובץ
        
        console.log(`✅ OTP נשלח למשתמש מורשה: ${cleanPhone}`); // לוג לשרת
        console.log(code);
        res.json({ success: true, message: "קוד אימות נשלח בהצלחה" });

    } catch (error) {
        console.error("Send OTP Error:", error);
        res.status(500).json({ success: false, message: "שגיאת שרת פנימית" });
    }
};

// 2. Verify OTP & Login
exports.verifyOtp = async (req, res) => {
    const { phone, code } = req.body;

    try {
        // 1. אימות ה-OTP (ללא שינוי)
        const otpDoc = await db.collection('otps').doc(phone).get();
        if (!otpDoc.exists || otpDoc.data().code !== code) {
            return res.status(400).json({ success: false, message: "קוד שגוי או פג תוקף" });
        }
        await db.collection('otps').doc(phone).delete();

        // 2. שליפת המשתמש והרשאותיו
        let userRole = 'guest'; // ברירת מחדל
        let allowedDomains = []; // מערך ההרשאות
        let fullName = '';

        const userDoc = await db.collection('users').doc(phone).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            
            if (userData.isActive === false) {
                return res.status(403).json({ success: false, message: "משתמש זה חסום" });
            }

            userRole = userData.roleId || 'user';
            fullName = userData.fullName;

            // === החלק הקריטי: משיכת ההרשאות מהתפקיד ב-DB ===
            const roleDoc = await db.collection('roles').doc(userRole).get();
            
            if (roleDoc.exists) {
                // נניח שבמסד הנתונים זה נראה כך: { permissions: { domains: ['maintenance', 'users'] } }
                const roleData = roleDoc.data();
                if (roleData.permissions && Array.isArray(roleData.permissions.domains)) {
                    allowedDomains = roleData.permissions.domains;
                }
            } else {
                console.warn(`Role ${userRole} not found in DB, assigning empty permissions.`);
            }
        }

        // 3. יצירת הטוקן עם ההרשאות בפנים (Payload)
        const token = jwt.sign({ 
            phone: phone, 
            role: userRole,
            domains: allowedDomains, // <--- כאן ההרשאות נכנסות לטוקן
            name: fullName
        }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ success: true, token, phone, role: userRole });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "שגיאת שרת" });
    }
};