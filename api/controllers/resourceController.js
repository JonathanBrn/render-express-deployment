// File: api/controllers/resourceController.js
const fs = require('fs');
const path = require('path');

// Helper to determine path to 'private' folder
// Assuming structure: /api/controllers/ -> ../../private
const PRIVATE_DIR = path.join(__dirname, '../../private');

exports.getDashboardHtml = async (req, res) => {
    try {
        const user = req.user; // Populated by authenticateToken middleware
        console.log(`Resource Request - User: ${user.phone}, Domains: ${user.domains}`);

        // Decide which file to serve based on permissions
        let filename = 'dashboard.html'; 
        
        // If user has ANY special permissions/domains, show admin
        if (user.domains && user.domains.length > 0) {
            filename = 'admin.html';
        }

        const filePath = path.join(PRIVATE_DIR, filename);
        
        // Read and send the file
        fs.readFile(filePath, 'utf8', (err, htmlData) => {
            if (err) {
                console.error(`Error reading ${filename}:`, err);
                return res.status(500).send("Error loading system file");
            }
            res.send(htmlData);
        });

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        res.status(500).send("Server Error");
    }
};

exports.getJsFile = (req, res) => {
    const filename = req.params.filename;
    
    // Security: Prevent Directory Traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(403).send("Access denied");
    }

    const filePath = path.join(PRIVATE_DIR, 'js', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    res.sendFile(filePath);
};

exports.getModuleFile = (req, res) => {
    const { category, folder, filename } = req.params;

    // Security: Prevent Directory Traversal
    if (filename.includes('..') || folder.includes('..') || category.includes('..')) {
        return res.status(403).send("Access denied");
    }

    const filePath = path.join(PRIVATE_DIR, category, folder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Module not found");
    }

    res.sendFile(filePath);
};

exports.getChatFile = (req, res) => {
    const filename = req.params.filename;

    if (filename.includes('..') || filename.includes('/')) {
        return res.status(403).send("Access denied");
    }

    const filePath = path.join(PRIVATE_DIR, 'chat', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Chat file not found");
    }

    res.sendFile(filePath);
};