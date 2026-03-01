const admin = require('firebase-admin');
require('dotenv').config();

// Fix private key newlines (Evidence: index.js lines 12-14)
const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("❌ Missing Firebase Config");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore();
module.exports = { admin, db };