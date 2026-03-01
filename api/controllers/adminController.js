// File: api/controllers/adminController.js
const { db, admin } = require('../config/firebase');

// שליפת כל הנתונים לדשבורד
exports.getAllData = async (req, res) => {
    try {
        const [maintenanceSnap, entrySnap, maaneSnap] = await Promise.all([
            db.collection('maintenance_reports').get(),
            db.collection('entry_permits').get(),
            db.collection('maane_laprat_requests').get()
        ]);

        let allTickets = [];
        const parseDate = (t) => t && t.toDate ? t.toDate().toISOString() : new Date().toISOString();

        // עיבוד תקלות
        maintenanceSnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'maintenance_reports',
                type: d.type || 'general',
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // עיבוד אישורי כניסה
        entrySnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'entry_permits',
                type: 'entry_permit',
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // עיבוד מענה לפרט
        maaneSnap.forEach(doc => {
            const d = doc.data();
            allTickets.push({ 
                id: doc.id, ...d, 
                collectionType: 'maane_laprat_requests',
                type: 'maane_laprat',
                createdAtStr: parseDate(d.createdAt)
            });
        });

        // מיון לפי תאריך (חדש לישן)
        allTickets.sort((a, b) => new Date(b.createdAtStr) - new Date(a.createdAtStr));

        res.json({ success: true, tickets: allTickets });

    } catch (error) {
        console.error("Admin Data Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// עדכון סטטוס והערות
exports.updateTicket = async (req, res) => {
    const { collectionType, ticketId, status, adminNotes } = req.body;

    try {
        await db.collection(collectionType).doc(ticketId).update({
            status,
            adminNotes,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: req.user.phone
        });
        res.json({ success: true, message: "עודכן בהצלחה" });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ success: false, message: "שגיאה בעדכון" });
    }
};

// שליפת משתמשים
exports.getUsers = async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => users.push(doc.data()));
        res.json({ success: true, users });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// שמירת/הוספת משתמש
exports.saveUser = async (req, res) => {
    function normalizeAndValidatePhone(phone) {
        if (!phone) {
            return { valid: false, message: "חובה להזין מספר טלפון" };
        }

        // ניקוי כל מה שאינו ספרה
        let cleanPhone = phone.replace(/\D/g, '');

        // אם מתחיל ב־0 → המרה ל־972
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '972' + cleanPhone.substring(1);
        }

        // אם מתחיל ב־972 נשאיר
        if (!cleanPhone.startsWith('972')) {
            return { valid: false, message: "מספר חייב להתחיל ב־0 או 972" };
        }

        // בדיקה שמדובר במספר סלולרי ישראלי תקין
        // 972 + 9 ספרות (סה"כ 12 ספרות)
        const israeliPhoneRegex = /^9725\d{8}$/;

        if (!israeliPhoneRegex.test(cleanPhone)) {
            return { valid: false, message: "מספר טלפון ישראלי לא תקין" };
        }

        return { valid: true, phone: cleanPhone };
    }

    const { phone, fullName, roleId, isActive } = req.body;

    // 1. ולידציה: חובה לקבל שם וטלפון
    if (!phone || !fullName) {
        return res.status(400).json({ success: false, message: "חובה להזין שם מלא ומספר טלפון" });
    }

    // 2. נירמול הטלפון (משאיר רק ספרות, כדי למנוע כפילויות כמו 050-123 ו-050123)

    if ( ! normalizeAndValidatePhone(phone).valid ) {
         return res.status(400).json({ success: false, message: "מספר טלפון לא תקין" });
    }

    try {
        const cleanPhone = normalizeAndValidatePhone(phone).phone
        await db.collection('users').doc(cleanPhone).set({
            phone: cleanPhone,
            fullName: fullName,
            // 3. ברירות מחדל: אם לא נשלח תפקיד -> 'user'. אם לא נשלח סטטוס -> true.
            roleId: roleId || 'user',
            isActive: isActive !== undefined ? isActive : true,
            
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // merge = אם המשתמש קיים, נעדכן רק את השדות החדשים ולא נמחק היסטוריה

        res.json({ success: true, message: "המשתמש נוסף/עודכן בהצלחה" });
    } catch (e) {
        console.error("Save User Error:", e);
        res.status(500).json({ success: false, error: "שגיאה בשמירת הנתונים בשרת" });
    }
};