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

// === Middleware: אימות טוקן ופענוח ===
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "אין הרשאה (חסר טוקן)" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
        if (err) return res.status(403).json({ success: false, message: "טוקן לא תקין" });
        
        try {
            // פענוח הטלפון (אם מוצפן) או קריאה ישירה
            let realPhone = decodedPayload.phone;
            if (decodedPayload.data) {
                // נניח שיש לך פונקציית decrypt
                // realPhone = decrypt(decodedPayload.data); 
                // אם הסרת את ההצפנה, השתמש בזה:
                realPhone = decodedPayload.data; 
            }

            // === דיבאג קריטי: מה יש בתוך הטוקן? ===
            console.log("🎟️ Token Decoded:", {
                phone: realPhone,
                role: decodedPayload.role // <--- האם זה undefined?
            });

            req.user = {
                phone: realPhone,
                role: decodedPayload.role || 'user' // ברירת מחדל אם חסר
            };
            
            next();
        } catch (error) {
            console.error("Token Error:", error);
            return res.status(403).json({ success: false, message: "שגיאת עיבוד טוקן" });
        }
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

// === נתיב 2: אימות קוד, בדיקת הרשאות ויצירת טוקן ===
app.post('/api/auth/verify-otp', loginLimiter, async (req, res) => {
    const { phone, code } = req.body;

    try {
        // 1. בדיקת ה-OTP ב-DB
        const docRef = db.collection('otps').doc(phone);
        const doc = await docRef.get();

        if (!doc.exists) return res.json({ success: false, message: "לא נמצא קוד" });
        const data = doc.data();
        
        // בדיקת תוקף
        if (Date.now() > data.expiresAt) return res.json({ success: false, message: "פג תוקף" });
        
        // בדיקת התאמת קוד
        if (data.code === code) {
            await docRef.delete(); // מחיקת הקוד המשומש
            
            // 2. === קריטי: בדיקת הרשאות מנהל ===
            let role = 'user'; // ברירת מחדל
            
            try {
                console.log(`Checking admin permissions for: ${phone}...`);
                
                // בדיקה ישירה במסמך האדמינים
                const adminsDoc = await db.collection('permissions').doc('admins').get();
                
                if (adminsDoc.exists) {
                    const adminsList = adminsDoc.data();
                    // האם המספר קיים והערך הוא true?
                    if (adminsList[phone] === true) {
                        role = 'admin';
                        console.log(`✅ ADMIN IDENTIFIED: ${phone}`);
                    } else {
                        console.log(`ℹ️ User is not in admin list`);
                    }
                } else {
                    console.warn("⚠️ 'permissions/admins' document not found!");
                }
            } catch (err) {
                console.error("Error checking permissions:", err);
            }

            // 3. יצירת הטוקן עם התפקיד (Role)
            // כאן אנחנו מכניסים את ה-role שמצאנו לתוך הטוקן
            const token = jwt.sign(
                { 
                    phone: phone, 
                    role: role // <--- זה השדה שהיה חסר או undefined קודם
                }, 
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            console.log(`🎟️ Generated Token with Role: ${role}`);

            // 4. תשובה ללקוח
            return res.json({ 
                success: true, 
                token: token, 
                phone: phone,
                isAdmin: (role === 'admin') 
            });

        } else {
            return res.json({ success: false, message: "קוד שגוי" });
        }
    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ success: false, message: "שגיאת שרת" });
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
    
    const phone = req.user.phone; 
    if (!phone) return res.status(400).json({ success: false, message: "שגיאת הזדהות" });

    try {
        console.log(`Fetching tickets for user: ${phone}`);

        const [maintenanceSnapshot, entrySnapshot, maaneSnapshot] = await Promise.all([
            db.collection('maintenance_reports').where('phone', '==', phone).get(),
            db.collection('entry_permits').where('requestorPhone', '==', phone).get(),
            db.collection('maane_laprat_requests').where('phone', '==', phone).get()
        ]);

        let allTickets = [];

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
                // === תיקון קריטי: השם המלא של הקולקציה ===
                collectionType: 'maintenance_reports', // היה 'maintenance'
                
                type: data.type || 'general',
                createdAtStr: parseDate(data.createdAt) 
            });
        });

        // 2. עיבוד אישורי כניסה
        entrySnapshot.forEach(doc => {
            const data = doc.data();
            allTickets.push({
                id: doc.id,
                ...data,
                // === תיקון קריטי: השם המלא של הקולקציה ===
                collectionType: 'entry_permits', // היה 'entry'
                
                type: 'entry_permit', 
                createdAtStr: parseDate(data.createdAt)
            });
        });

        // 3. עיבוד מענה לפרט (זה כבר היה תקין, אבל ליתר ביטחון)
        maaneSnapshot.forEach(doc => {
            const data = doc.data();
            allTickets.push({
                id: doc.id,
                ...data,
                collectionType: 'maane_laprat_requests',
                createdAtStr: parseDate(data.createdAt)
            });
        });

        // מיון
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

// === נתיב אדמין: עדכון סטטוס והערות ===
app.post('/api/admin/update-ticket', authenticateToken, async (req, res) => {
    // 1. בדיקת הרשאות מנהל
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "אין הרשאות ניהול" });
    }

    const { collectionType, ticketId, status, adminNotes } = req.body;

    if (!collectionType || !ticketId) {
        return res.status(400).json({ success: false, message: "חסרים נתונים מזהים" });
    }

    try {
        // 2. ביצוע העדכון ב-Firestore
        // אנו משתמשים ב-collectionType שהגיע מהפרונט (למשל 'maintenance_reports' או 'entry_permits')
        await db.collection(collectionType).doc(ticketId).update({
            status: status,
            adminNotes: adminNotes,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: req.user.phone
        });

        console.log(`Ticket ${ticketId} updated by admin ${req.user.phone}`);
        res.json({ success: true, message: "הקריאה עודכנה בהצלחה" });

    } catch (error) {
        console.error("Admin Update Error:", error);
        res.status(500).json({ success: false, message: "שגיאה בעדכון הנתונים" });
    }
});


// ==========================================
//               CHAT SYSTEM
// ==========================================


// === הגנה מפני הצפת הודעות (Spam Protection) ===
// מאפשר 10 הודעות בדקה (מספיק לשיחה קולחת, אבל חוסם בוטים)
const chatSendLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 10,
    message: { success: false, message: "האטת קצב: נשלחו יותר מדי הודעות בזמן קצר." },
    standardHeaders: true,
    legacyHeaders: false,
});

const chatSyncLimiter = rateLimit({
    windowMs: 5 * 1000, 
    max: 10,
    message: { success: false, message: "Too many sync requests" },
    standardHeaders: true,
    legacyHeaders: false,
});

// פונקציית עזר לבדיקת הרשאה לטיקט ספציפי
// === פונקציית בדיקת הרשאות (גרסת דיאגנוסטיקה) ===
// === פונקציית עזר לבדיקת הרשאה (מתוקנת וחכמה) ===
async function verifyTicketAccess(user, collection, ticketId) {
    console.log(`🔍 Checking access: User=${user.phone} -> Ticket=${ticketId} (${collection})`);

    // 1. אדמין תמיד רשאי
    if (user.role === 'admin') {
        console.log("✅ Access granted: User is Admin");
        return true;
    }

    // 2. שליפת הטיקט
    const doc = await db.collection(collection).doc(ticketId).get();
    
    if (!doc.exists) {
        console.log("❌ Access denied: Ticket not found in DB");
        return false;
    }

    const data = doc.data();
    
    // 3. מציאת בעל הטיקט (תמיכה בכל סוגי השדות)
    // בתחזוקה זה 'phone', באישורים זה 'requestorPhone', ולפעמים 'visitorPhone'
    const ticketOwner = data.phone || data.requestorPhone || data.visitorPhone;

    if (!ticketOwner) {
        console.log("❌ Access denied: No owner phone number found on ticket document");
        return false;
    }

    // 4. נרמול והשוואה (החלק הקריטי!)
    // לוקחים רק את 9 הספרות האחרונות כדי ש-0501234567 ו-972501234567 ייחשבו זהים
    const normalize = (num) => String(num).replace(/\D/g, '').slice(-9);
    
    const userClean = normalize(user.phone);
    const ownerClean = normalize(ticketOwner);

    console.log(`🔢 Comparing: User(${userClean}) vs Owner(${ownerClean})`);

    if (userClean === ownerClean) {
        return true;
    }

    console.log("❌ Access denied: Phone numbers do not match");
    return false;
}

// === נתיב שליחת הודעה (עם פירוט שגיאות) ===
app.post('/api/chat/send', authenticateToken, chatSendLimiter, async (req, res) => {
    const { collectionType, ticketId, message } = req.body;

    console.log(`📨 Incoming Message: "${message}" to ${ticketId}`);

    if (!message || !message.trim()) {
        console.log("❌ Empty message blocked");
        return res.json({ success: false, error: "Empty message" });
    }

    try {
        const hasAccess = await verifyTicketAccess(req.user, collectionType, ticketId);
        
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "Access Denied (Check server logs)" });
        }

        await db.collection(collectionType).doc(ticketId).collection('messages').add({
            text: message,
            senderPhone: req.user.phone,
            senderRole: req.user.role || 'user',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Message saved to DB successfully");
        res.json({ success: true });

    } catch (error) {
        console.error("🔥 EXCEPTION in /chat/send:", error);
        // מחזיר את הודעת השגיאה המלאה לדפדפן כדי שתראה אותה
        res.status(500).json({ success: false, error: error.message });
    }
});

// === נתיב טעינת משאבי הצ'אט (HTML/CSS/JS) ===
app.get('/api/resource/chat/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    
    // מניעת גלישה לתיקיות אחרות
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(403).send("Access denied");
    }

    // הנתיב: private/chat/filename
    const filePath = path.join(__dirname, '..', 'private', 'chat', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Chat file not found");
    }

    res.sendFile(filePath);
});

// === סנכרון הודעות (Delta Sync) ===
// משתמש ב-Limiter כדי למנוע הצפות
app.get('/api/chat/sync', authenticateToken, chatSyncLimiter, async (req, res) => {
    const { collectionType, ticketId, lastSync } = req.query;

    try {
        // בדיקת אבטחה
        const hasAccess = await verifyTicketAccess(req.user, collectionType, ticketId);
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: "Access Denied" });
        }

        // שאילתה בסיסית
        let query = db.collection(collectionType).doc(ticketId).collection('messages')
                      .orderBy('createdAt', 'asc');

        // אם נשלח זמן סנכרון אחרון - מביאים רק מה שחדש
        if (lastSync && lastSync !== '0') {
            const lastDate = new Date(parseInt(lastSync)); // המרה מ-milliseconds לתאריך
            query = query.startAfter(lastDate);
        }

        const snapshot = await query.get();
        const messages = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // המרה לזמן לקוח (Milliseconds)
            const timeMs = data.createdAt ? data.createdAt.toMillis() : Date.now();
            
            messages.push({
                id: doc.id,
                text: data.text,
                isMe: data.senderPhone === req.user.phone, // האם אני כתבתי?
                isAdmin: data.senderRole === 'admin',      // האם מנהל כתב?
                timestamp: timeMs
            });
        });

        res.json({ success: true, messages: messages });

    } catch (error) {
        console.error("Chat sync error:", error);
        res.status(500).json({ success: false });
    }
});


if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}
module.exports = app;

//❤️

