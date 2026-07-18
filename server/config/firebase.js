// config/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('../ayojoncatererstaff-firebase-adminsdk-fbsvc-5580bde1b6.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;