const express = require('express');
const router = express.Router();

const { mobileAuthMiddleware } = require('../middleware/mobileAuthMiddleware');
const {
  saveToken,
  removeToken,
} = require('../controllers/notificationController');

router.post('/save-token', mobileAuthMiddleware, saveToken);
router.delete('/remove-token', mobileAuthMiddleware, removeToken);

module.exports = router;