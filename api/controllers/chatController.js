const { db, admin } = require('../config/firebase');

// === פונקציית עזר לבדיקת הרשאות (מעודכנת ל-RBAC) ===
async function verifyAccess(user, collection, ticketId) {
    // 1. בדיקת הרשאות מנהל (לפי ה-Domains בטוקן)
    const userDomains = user.domains || [];
    
    // אם למשתמש יש הרשאת 'על' (*) או הרשאת ניהול טיקטים - הוא מורשה להיכנס
    if (userDomains.includes('*') || userDomains.includes('manage_tickets')) {
        return true;
    }

    // 2. אם אינו מנהל, נבדוק אם הטיקט שייך לו (משתמש רגיל)
    try {
        const doc = await db.collection(collection).doc(ticketId).get();
        
        if (!doc.exists) return false;
        
        const data = doc.data();
        // מציאת בעל הטיקט (תמיכה בכל סוגי השדות)
        const owner = data.phone || data.requestorPhone || data.visitorPhone;

        if (!owner) return false;

        // נרמול מספרים (השוואת 9 ספרות אחרונות)
        const normalize = (num) => String(num).replace(/\D/g, '').slice(-9);
        return normalize(user.phone) === normalize(owner);
        
    } catch (error) {
        console.error("Error verifying chat access:", error);
        return false;
    }
}

// === שליחת הודעה ===
exports.sendMessage = async (req, res) => {
    const { collectionType, ticketId, message } = req.body;
    
    // ולידציה בסיסית
    if (!message || !message.trim()) return res.json({ success: false });

    // בדיקת גישה
    const hasAccess = await verifyAccess(req.user, collectionType, ticketId);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: "Access Denied" });
    }

    try {
        // זיהוי האם השולח הוא אדמין (לצורך תצוגה בצד לקוח)
        // אם למשתמש יש הרשאות ניהול, נסמן את ההודעה כ-isAdmin
        const isSenderAdmin = req.user.domains && (req.user.domains.includes('*') || req.user.domains.includes('manage_tickets'));

        await db.collection(collectionType).doc(ticketId).collection('messages').add({
            text: message,
            senderPhone: req.user.phone,
            senderRole: isSenderAdmin ? 'admin' : 'user', // סימון לתצוגה
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (e) {
        console.error("Chat Send Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// === סנכרון הודעות ===
exports.syncMessages = async (req, res) => {
    const { collectionType, ticketId, lastSync } = req.query;

    const hasAccess = await verifyAccess(req.user, collectionType, ticketId);
    if (!hasAccess) {
        return res.status(403).json({ success: false, message: "Access Denied" });
    }

    try {
        let query = db.collection(collectionType).doc(ticketId).collection('messages').orderBy('createdAt', 'asc');
        
        if (lastSync && lastSync !== '0') {
            query = query.startAfter(new Date(parseInt(lastSync)));
        }

        const snapshot = await query.get();
        const messages = [];
        
        snapshot.forEach(doc => {
            const d = doc.data();
            messages.push({
                id: doc.id,
                text: d.text,
                isMe: d.senderPhone === req.user.phone,
                // אדמין זה כל מי ששלח הודעה וסומן כאדמין, או שהתפקיד שלו הוא לא user
                isAdmin: d.senderRole === 'admin' || (d.senderRole && d.senderRole !== 'user'),
                timestamp: d.createdAt ? d.createdAt.toMillis() : Date.now()
            });
        });

        res.json({ success: true, messages });
    } catch (e) {
        console.error("Chat Sync Error:", e);
        res.status(500).json({ success: false });
    }
};