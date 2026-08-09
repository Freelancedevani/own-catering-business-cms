const Staff        = require('../models/Staff');
const Notification = require('../models/Notification');
const catchAsync   = require('../utils/catchAsync');

// ── Mobile: save FCM token ────────────────────────────────
exports.saveToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });
    await Staff.findByIdAndUpdate(req.staffId, { fcmToken: token });
    return res.status(200).json({ success: true, message: 'Token saved successfully' });
  } catch (error) {
    console.error('[Notification] Save token error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Mobile: remove FCM token ──────────────────────────────
exports.removeToken = async (req, res) => {
  try {
    await Staff.findByIdAndUpdate(req.staffId, { fcmToken: null });
    return res.status(200).json({ success: true, message: 'Token removed successfully' });
  } catch (error) {
    console.error('[Notification] Remove token error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Web: GET /api/notifications ───────────────────────────
exports.getNotifications = catchAsync(async (req, res) => {
  const limit = Number(req.query.limit) || 20;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find().sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ isRead: false }),
  ]);

  res.status(200).json({ success: true, data: { notifications, unreadCount } });
});

// ── Web: PATCH /api/notifications/:id/read ────────────────
exports.markAsRead = catchAsync(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.status(200).json({ success: true });
});

// ── Web: PATCH /api/notifications/read-all ────────────────
exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ isRead: false }, { isRead: true });
  res.status(200).json({ success: true });
});

// ── Web: DELETE /api/notifications/:id ───────────────────
exports.deleteNotification = catchAsync(async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true });
});
