const express = require('express');
const router  = express.Router();

const { protect }             = require('../middleware/authMiddleware');
const { mobileAuthMiddleware } = require('../middleware/mobileAuthMiddleware');
const {
  saveToken, removeToken,
  getNotifications, markAsRead, markAllAsRead, deleteNotification,
} = require('../controllers/notificationController');

// ── Web admin routes ──────────────────────────────────────
router.get('/',              protect, getNotifications);
router.patch('/read-all',    protect, markAllAsRead);
router.patch('/:id/read',    protect, markAsRead);
router.delete('/:id',        protect, deleteNotification);

// ── Mobile FCM token routes ───────────────────────────────
router.post('/save-token',   mobileAuthMiddleware, saveToken);
router.delete('/remove-token', mobileAuthMiddleware, removeToken);

module.exports = router;
