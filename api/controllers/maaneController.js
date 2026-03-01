// File: api/controllers/maaneController.js
const { createTicket } = require('../services/ticketService');

exports.createRequest = async (req, res) => {
    try {
        const ticketId = await createTicket(
            'maane_laprat_requests', 
            req.user.phone, 
            req.body, 
            'maane_laprat'
        );
        res.json({ success: true, message: "Request created", ticketId });
    } catch (error) {
        console.error("Maane Create Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};