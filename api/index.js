const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// --- בדיקת משתנים ---
console.log("--- Runnning configuration Check ---");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// --- טעינת Firebase דרך משתני סביבה (.env) ---
// 1. תיקון המפתח הפרטי (הופך את ה-\n לירידת שורה אמיתית)
const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

// 2. בדיקה שהכל נטען
if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("❌ שגיאה: חסרים משתני סביבה של Firebase בקובץ .env");
    process.exit(1);
}

// 3. אתחול Firebase עם המשתנים
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore(); // הפנייה למסד הנתונים

// אתחול Twilio
const client = require('twilio')(accountSid, authToken);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false, // חובה: מבטל את חסימות ברירת המחדל
      directives: {
        defaultSrc: ["'self'"],
        // מתיר סקריפטים בתוך ה-HTML (unsafe-inline)
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], 
        // מתיר עיצובים חיצוניים
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        // מתיר פונטים
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        // מתיר תמונות
        imgSrc: ["'self'", "data:", "https://cdn-icons-png.flaticon.com", "https://*.googleapis.com"],
        // מתיר שליחת בקשות לשרת עצמו
        connectSrc: ["'self'"], 
        
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

//// RATE-LIMITER //////// RATE-LIMITER //////// RATE-LIMITER ////
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, //  דקה
    max: 30, 
    message: "Too many login attempts, please try again later."
});


const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { 
        success: false, 
        message: "יותר מדי ניסיונות שגויים! חכה דקה!." 
    },
    standardHeaders: true,
    legacyHeaders: false,
});


// החלה על נתיב השליחה
app.post('/api/auth/send-otp', otpLimiter);
//// END-RATE-LIMITER //////// END-RATE-LIMITER //////// END-RATE-LIMITER ////


// === פונקציית עזר: קבלת הרשאות לפי טלפון ===
// === פונקציה: קבלת הרשאות מתוך טוקן ===
async function get_user_permissions(phoneNumber) {
    // הגנה בסיסית: אם אין טלפון, אין הרשאות
    if (!phoneNumber) {
        return [];
    }

    const roles = [];

    try {
        // 1. שליפת כל מסמכי התפקידים מקולקשיין ההרשאות
        const permissionsSnapshot = await db.collection('permissions').get();

        if (permissionsSnapshot.empty) {
            return []; // לא הוגדרו תפקידים במערכת בכלל
        }

        // 2. מעבר על כל מסמך (כל מסמך מייצג תפקיד, למשל 'admins')
        permissionsSnapshot.forEach(doc => {
            const roleName = doc.id;       // שם המסמך = שם התפקיד
            const authorizedUsers = doc.data(); // רשימת המשתמשים בתוך המסמך

            // 3. בדיקה: האם מספר הטלפון קיים כשדה והערך שלו הוא true?
            if (authorizedUsers[phoneNumber] === true) {
                roles.push(roleName);
            }
        });

        // לוג לצורך דיבאג (אופציונלי - ניתן למחוק ב-Production)
        console.log(`Permissions found for ${phoneNumber}:`, roles);
        
        return roles;

    } catch (error) {
        console.error("Error inside get_user_permissions:", error);
        return []; // במקרה של שגיאה, מחזירים מערך ריק כדי לא לתקוע את השרת
    }
}

// פונקציית עזר לאבטחה
function authenticateToken(req, res, next) {
    // הטוקן מגיע בכותרת: Authorization: Bearer <TOKEN>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // לוקח רק את הטוקן

    if (!token) return res.status(401).json({ success: false, message: "אין הרשאה (חסר טוקן)" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "טוקן לא תקין" });
        
        // הכל תקין! שומרים את הטלפון שחילצנו מהטוקן בתוך הבקשה
        req.user = user; 
        next(); // ממשיכים לפונקציה הבאה
    });
}

// === פונקציה לשליחת SMS (ללא שינוי) ===
async function sendSMSOtp(phoneNumber, code) {
    if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+' + phoneNumber;
    }
    try {
        console.log(`Sending WhatsApp to ${phoneNumber}...`);
        
        const message = await client.messages.create({
            body: `Your Sphere verification code is: ${code}`,
            // שים לב לשינוי כאן: מוסיפים whatsapp: לפני המספרים
            from: 'whatsapp:+14155238886', // המספר הקבוע של ה-Sandbox של Twilio
            to: 'whatsapp:' + phoneNumber  // המספר של המשתמש
        });
        
        console.log(`WhatsApp sent! SID: ${message.sid}`);
    } catch (error) {
        console.error("Twilio Error:", error.message);
        throw error;
    }
}

// === Middleware: בדיקת הרשאות מנהל ===
function requireAdmin(req, res, next) {
    // הבדיקה מסתמכת על כך ש-authenticateToken רץ קודם ומילא את req.user
    // ובתוך הטוקן יש שדה role
    if (req.user && req.user.role === 'admin') {
        next(); // המשתמש הוא מנהל - אפשר להמשיך
    } else {
        console.warn(`⛔ ניסיון גישה לממשק ניהול נחסם עבור: ${req.user ? req.user.phone : 'אורח'}`);
        return res.status(403).json({ success: false, message: "אין הרשאת מנהל (Access Denied)" });
    }
}

// === נתיב 1: בקשת קוד ושמירה ב-Firestore ===
app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    
    // יצירת קוד רנדומלי
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // חישוב זמן תפוגה (5 דקות מעכשיו)
    // Date.now() מחזיר מילישניות, לכן מוסיפים 5 * 60 * 1000
    const expiresAt = Date.now() + (5 * 60 * 1000);

    try {
        // שמירה ב-Firestore
        // אנו משתמשים במספר הטלפון כ-ID של המסמך כדי שיהיה קל למצוא אותו
        await db.collection('otps').doc(phone).set({
            code: code,
            expiresAt: expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp() // לצרכי תיעוד
        });

        console.log(`DEBUG: Code for ${phone} stored in DB: ${code}`);

        // שליחת ה-SMS בפועל
        await sendSMSOtp(phone, code);
        
        res.json({ success: true, message: "ה-SMS נשלח בהצלחה והקוד נשמר" });

    } catch (error) {
        console.error("Error saving/sending OTP:", error);
        res.status(500).json({ 
            success: false, 
            message: "שגיאת שרת פנימית" 
        });
    }
});

// === נתיב 2: אימות קוד ויצירת Token ===
app.post('/api/auth/verify-otp', loginLimiter, async (req, res) => {
    const { phone, code } = req.body;

    try {
        // ... (הבדיקה מול Firestore נשארת אותו דבר: בדיקת תוקף וקוד) ...
        const docRef = db.collection('otps').doc(phone);
        const doc = await docRef.get();

        if (!doc.exists) return res.json({ success: false, message: "לא נמצא קוד" });
        const data = doc.data();
        if (Date.now() > data.expiresAt) return res.json({ success: false, message: "פג תוקף" });
        
        if (data.code === code) {
            await docRef.delete(); // מחיקת הקוד המשומש
            
            // === יצירת ה-TOKEN ===
            // אנחנו מצפינים את הטלפון בתוך הטוקן
            const token = jwt.sign(
                { phone: phone },             // המידע להצפנה
                process.env.JWT_SECRET,       // המפתח הסודי
                { expiresIn: '30d' }          // תוקף ל-30 יום (כדי שלא יצטרך להתחבר כל רגע)
            );

            // מחזירים את הטוקן לקלינט
            return res.json({ success: true, token: token, phone: phone });
        } else {
            return res.json({ success: false, message: "קוד שגוי" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "שגיאה" });
    }
});

// === נתיב: שמירת דיווח עם ID מבוסס טלפון ומונה ===
app.post('/api/maintenance/report', authenticateToken, async (req, res) => {
    try {
        const reportData = req.body;
        
        // === התיקון הקריטי: לוקחים את הטלפון מהטוקן! ===
        const userPhone = req.user.phone; 
        
        // ניקוי מספר הטלפון (למרות שהוא מגיע מהטוקן, ליתר ביטחון)
        const cleanPhone = userPhone.replace(/\D/g, ''); 
        
        if (!cleanPhone) {
            return res.status(400).json({ success: false, message: "מספר טלפון לא תקין" });
        }

        // רפרנס למסמך המונה של המשתמש הזה
        const counterRef = db.collection('counters').doc(cleanPhone);

        // ביצוע טרנזקציה כדי למנוע כפילויות
        await db.runTransaction(async (t) => {
            // קריאת המונה הנוכחי
            const counterDoc = await t.get(counterRef);
            
            let newCount = 1;
            if (counterDoc.exists) {
                // אם המונה קיים, נוסיף 1
                newCount = counterDoc.data().count + 1;
            }

            // יצירת ה-ID החדש: 0501234567-1
            const newDocId = `${cleanPhone}-${newCount}`;
            const reportRef = db.collection('maintenance_reports').doc(newDocId);

            // הכנת המידע לשמירה
            const finalData = {
                ...reportData,
                phone: userPhone,
                id: newDocId,          // שומרים גם את ה-ID בתוך המסמך
                ticketNumber: newCount, // מספר קריאה רץ של המשתמש
                status: 'open',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // ביצוע הכתיבות (חייב להיות בסוף הטרנזקציה)
            
            // 1. שמירת הדיווח החדש
            t.set(reportRef, finalData);
            
            // 2. עדכון המונה למספר החדש
            t.set(counterRef, { count: newCount }, { merge: true });
        });

        console.log(`Report created successfully for ${cleanPhone}`);
        
        res.json({ 
            success: true, 
            message: "הדיווח נשמר בהצלחה" 
        });

    } catch (error) {
        console.error("Transaction failed: ", error);
        res.status(500).json({ 
            success: false, 
            message: "שגיאה בשמירת הדיווח" 
        });
    }
});

// === נתיב ייעודי: יצירת בקשת מענה לפרט ===
app.post('/api/maane/report', authenticateToken, async (req, res) => {
    try {
        const reportData = req.body;
        const userPhone = req.user.phone; 
        const cleanPhone = userPhone.replace(/\D/g, ''); 

        // לוגיקה של מונה (Counter) - נשארת זהה לכולם כדי לשמור על רצף מספרי
        const counterRef = db.collection('counters').doc(cleanPhone);

        await db.runTransaction(async (t) => {
            const counterDoc = await t.get(counterRef);
            let newCount = 1;
            if (counterDoc.exists) {
                newCount = counterDoc.data().count + 1;
            }

            // יצירת מזהה ייחודי
            const newDocId = `${cleanPhone}-${newCount}`;
            
            // שמירה לקולקציה הייעודית
            const reportRef = db.collection('maane_laprat_requests').doc(newDocId);

            const finalData = {
                ...reportData,       // המידע מהטופס (מידות, סוג, הערות)
                phone: userPhone,    // טלפון מהטוקן
                id: newDocId,
                ticketNumber: newCount,
                type: 'maane_laprat', // סוג ראשי קבוע
                collectionType: 'maane_laprat_requests', // חשוב לשליפה
                status: 'open',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            t.set(reportRef, finalData);
            t.set(counterRef, { count: newCount }, { merge: true });
        });

        console.log(`Maane Laprat request created: ${cleanPhone}`);
        res.json({ success: true, message: "הבקשה נשלחה בהצלחה" });

    } catch (error) {
        console.error("Maane Laprat Save Error:", error);
        res.status(500).json({ success: false, message: "שגיאה בשמירת הבקשה" });
    }
});

// === שליפת היסטוריה מאובטחת (JWT) ===
app.get('/api/maintenance/my-tickets', authenticateToken, async (req, res) => {
    
    // קריטי: לוקחים את הטלפון מהטוקן המאומת
    const phone = req.user.phone; 

    if (!phone) return res.status(400).json({ success: false, message: "שגיאת הזדהות" });

    try {
        console.log(`Fetching tickets for user: ${phone}`);

        // === ביצוע 3 שאילתות במקביל ===
        const [maintenanceSnapshot, entrySnapshot, maaneSnapshot] = await Promise.all([
            db.collection('maintenance_reports').where('phone', '==', phone).get(),
            db.collection('entry_permits').where('requestorPhone', '==', phone).get(),
            // הוספת הקולקציה החדשה:
            db.collection('maane_laprat_requests').where('phone', '==', phone).get()
        ]);

        let allTickets = [];

        // פונקציית עזר להמרת תאריך
        const parseDate = (timestamp) => {
            if (!timestamp || !timestamp.toDate) return new Date().toISOString();
            return timestamp.toDate().toISOString();
        };

        // 1. עיבוד תקלות בינוי
        maintenanceSnapshot.forEach(doc => {
            const data = doc.data();
            allTickets.push({
                id: doc.id,
                ...data,
                collectionType: 'maintenance',
                createdAtStr: parseDate(data.createdAt) 
            });
        });

        // 2. עיבוד אישורי כניסה
        entrySnapshot.forEach(doc => {
            const data = doc.data();
            allTickets.push({
                id: doc.id,
                ...data,
                collectionType: 'entry',
                type: 'entry_permit', 
                createdAtStr: parseDate(data.createdAt)
            });
        });

        // 3. עיבוד מענה לפרט (החלק החדש)
        maaneSnapshot.forEach(doc => {
            const data = doc.data();
            allTickets.push({
                id: doc.id,
                ...data,
                collectionType: 'maane_laprat',
                // הסוג (type) כבר שמור בתוך הדאטה כ-'maane_laprat'
                createdAtStr: parseDate(data.createdAt)
            });
        });

        // 4. מיון הכל ביחד לפי תאריך (מהחדש לישן)
        allTickets.sort((a, b) => new Date(b.createdAtStr) - new Date(a.createdAtStr));

        res.json({ success: true, tickets: allTickets });

    } catch (error) {
        console.error("Error fetching tickets:", error);
        res.status(500).json({ success: false, message: "שגיאה בשליפת נתונים" });
    }
});

// === יצירת בקשת אישור כניסה (קולקשיין נפרד) ===
app.post('/api/entry/create', async (req, res) => {
    try {
        const formData = req.body;
        const requestorPhone = formData.requestorPhone; 
        const cleanPhone = requestorPhone.replace(/\D/g, '');

        if (!cleanPhone) return res.status(400).json({ success: false, message: "מספר טלפון חסר" });

        const counterRef = db.collection('counters').doc(cleanPhone);

        await db.runTransaction(async (t) => {
            const counterDoc = await t.get(counterRef);
            let newCount = 1;
            if (counterDoc.exists) {
                newCount = counterDoc.data().count + 1;
            }

            const newDocId = `${cleanPhone}-${newCount}`;
            
            // === שינוי: שמירה לקולקשיין נפרד ===
            const reportRef = db.collection('entry_permits').doc(newDocId);

            const finalData = {
                ...formData,
                id: newDocId,
                ticketNumber: newCount,
                type: 'entry_permit', // מזהה סוג
                status: 'open',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            t.set(reportRef, finalData);
            t.set(counterRef, { count: newCount }, { merge: true });
        });

        console.log(`Entry Permit created in separate collection: ${cleanPhone}`);
        res.json({ success: true, message: "הבקשה נשלחה בהצלחה" });

    } catch (error) {
        console.error("Entry Permit Error:", error);
        res.status(500).json({ success: false, message: "שגיאה בשמירה" });
    }
});

// === נתיב מיוחד: טעינת ה-HTML של המערכת ===
// שים לב: משתמש ב-authenticateToken כדי להגן על הקוד!
app.get('/api/resource/dashboard-html', authenticateToken, async (req, res) => {
    try {
        // 1. בדיקת הרשאות לפי הטלפון בטוקן
        const userPermissions = await get_user_permissions(req.user.phone);
        console.log(`User: ${req.user.phone}, Roles: ${userPermissions}`);

        // 2. קביעת שם הקובץ - החלפה מלאה
        let filename = 'dashboard.html'; // ברירת מחדל

        // אם יש הרשאות כלשהן (המערך לא ריק) -> טוענים את ממשק המנהל
        if (userPermissions.length > 0) {
            filename = 'admin.html';
        }

        // 3. בניית הנתיב לקובץ הנבחר
        const filePath = path.join(__dirname, '..', 'private', filename);
        
        // 4. קריאת הקובץ ושליחתו AS-IS (כמו שהוא)
        fs.readFile(filePath, 'utf8', (err, htmlData) => {
            if (err) {
                console.error(`Error reading ${filename}:`, err);
                return res.status(500).send("Error loading system file");
            }
            
            // שולחים את הקובץ השלם.
            // אין כאן שום logic של replace או הזרקה. זה קובץ אחר לגמרי.
            res.send(htmlData);
        });

    } catch (error) {
        console.error("Route Error:", error);
        res.status(500).send("Server Error");
    }
});

// === נתיב 1: טעינת סקריפטים כלליים (private/js) ===
// מטפל בבקשות כמו: /api/resource/js/binui.js
app.get('/api/resource/js/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    
    // הגנות אבטחה
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(403).send("Access denied");
    }

    // בניית הנתיב: private/js/binui.js
    const filePath = path.join(__dirname, '..', 'private', 'js', filename);

    if (!fs.existsSync(filePath)) {
        console.error("General JS not found:", filePath);
        return res.status(404).send("File not found");
    }

    res.sendFile(filePath);
});

// === נתיב להגשת קבצי JS מוגנים ===
// === נתיב לטעינת מודולים (קבצים בתוך תיקיות משנה) ===
app.get('/api/resource/module/:category/:folder/:filename', authenticateToken, (req, res) => {
    const { category, folder, filename } = req.params;

    // הגנות אבטחה (מונע גלישה לתיקיות אחרות)
    if (filename.includes('..') || folder.includes('..') || category.includes('..')) {
        return res.status(403).send("Access denied");
    }

    // בניית הנתיב: private/maane-laprat/uniforms/uniforms.html
    const filePath = path.join(__dirname, '..', 'private', category, folder, filename);

    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath); // לוג שיעזור לך להבין איפה הוא מחפש
        return res.status(404).send("Module not found");
    }

    res.sendFile(filePath);
});

// === נתיב אדמין: משיכת כל הנתונים (כולל מענה לפרט) ===
app.get('/api/admin/all-data', authenticateToken, async (req, res) => {
    try {
        // שליפת 3 הקולקציות במקביל
        const [maintenanceSnap, entrySnap, maaneSnap] = await Promise.all([
            db.collection('maintenance_reports').get(),
            db.collection('entry_permits').get(),
            db.collection('maane_laprat_requests').get() // <-- החדש
        ]);

        let allTickets = [];

        const parseDate = (t) => t && t.toDate ? t.toDate().toISOString() : new Date().toISOString();

        // 1. תקלות
        maintenanceSnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'maintenance_reports',
                type: d.type || 'general',
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // 2. אישורים
        entrySnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'entry_permits',
                type: 'entry_permit',
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // 3. מענה לפרט (חדש!)
        maaneSnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'maane_laprat_requests',
                type: 'maane_laprat', // סוג ראשי
                // subType מכיל את הסוג הספציפי (uniforms/shoes)
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // מיון
        allTickets.sort((a, b) => new Date(b.createdAtStr) - new Date(a.createdAtStr));

        res.json({ success: true, tickets: allTickets });

    } catch (error) {
        console.error("Admin API Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});



if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}
module.exports = app;

//❤️