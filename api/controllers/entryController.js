// File: api/controllers/entryController.js
const { createTicket } = require('../services/ticketService');

exports.createPermit = async (req, res) => {
    try {
        const { requestorPhone } = req.body;
        // אישורי כניסה דורשים לוגיקה מעט שונה (requestorPhone), אבל נשתמש בטלפון של המשתמש המחובר ליתר ביטחון
        const phoneToUse = req.user ? req.user.phone : requestorPhone;

        const ticketId = await createTicket(
            'entry_permits', 
            phoneToUse, 
            req.body, 
            'entry_permit'
        );

        res.json({ success: true, message: "Permit request created", ticketId });
    } catch (error) {
        console.error("Entry Create Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};