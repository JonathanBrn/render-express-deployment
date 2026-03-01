const { db, admin } = require('../config/firebase');

/**
 * Creates a ticket with an auto-incrementing ID inside a transaction.
 * @param {string} collectionName - Firestore collection (e.g., 'maintenance_reports')
 * @param {string} phone - User's phone (used for counter ID)
 * @param {object} data - The ticket payload
 * @param {string} type - The ticket type field
 */
async function createTicket(collectionName, phone, data, type) {
    const cleanPhone = phone.replace(/\D/g, ''); 
    const counterRef = db.collection('counters').doc(cleanPhone);

    return await db.runTransaction(async (t) => {
        const counterDoc = await t.get(counterRef);
        
        let newCount = 1;
        if (counterDoc.exists) {
            newCount = counterDoc.data().count + 1;
        }

        const newDocId = `${cleanPhone}-${newCount}`;
        const reportRef = db.collection(collectionName).doc(newDocId);

        const finalData = {
            ...data,
            phone: phone, // Owner
            id: newDocId,
            ticketNumber: newCount,
            type: type,
            status: 'open',
            collectionType: collectionName, // Helper for frontend chat
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        t.set(reportRef, finalData);
        t.set(counterRef, { count: newCount }, { merge: true });

        return newDocId;
    });
}

module.exports = { createTicket };