const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title:   { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['order', 'lead', 'withdrawal', 'payment', 'staff', 'general'],
    default: 'general',
  },
  link:   { type: String, default: null }, // e.g. '/orders/abc123'
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
