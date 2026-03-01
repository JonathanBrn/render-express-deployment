const { createTicket } = require('../services/ticketService');
const { db } = require('../config/firebase');

exports.createReport = async (req, res) => {
    try {
        const { type, description, location } = req.body;
        
        // Basic Validation
        if (!type || !description || !location) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Use the Service (Abstracts the transaction complexity)
        const ticketId = await createTicket(
            'maintenance_reports', 
            req.user.phone, 
            req.body, 
            req.body.type
        );

        res.json({ success: true, message: "Report created", ticketId });

    } catch (error) {
        console.error("Maintenance Create Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.getMyTickets = async (req, res) => {
    const phone = req.user.phone;
    try {
        const [maint, entry, maane] = await Promise.all([
            db.collection('maintenance_reports').where('phone', '==', phone).get(),
            db.collection('entry_permits').where('requestorPhone', '==', phone).get(),
            db.collection('maane_laprat_requests').where('phone', '==', phone).get()
        ]);

        let tickets = [];
        const parse = (d) => ({ ...d, createdAtStr: d.createdAt?.toDate().toISOString() });

        maint.forEach(doc => tickets.push({ id: doc.id, ...parse(doc.data()), collectionType: 'maintenance_reports' }));
        entry.forEach(doc => tickets.push({ id: doc.id, ...parse(doc.data()), collectionType: 'entry_permits', type: 'entry_permit' }));
        maane.forEach(doc => tickets.push({ id: doc.id, ...parse(doc.data()), collectionType: 'maane_laprat_requests' }));

        tickets.sort((a, b) => new Date(b.createdAtStr) - new Date(a.createdAtStr));
        res.json({ success: true, tickets });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Error fetching tickets" });
    }
};
