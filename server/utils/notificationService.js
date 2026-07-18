const admin = require('../config/firebase');
const Staff = require('../models/Staff');

// ─── Send to single staff member ─────────────────────────
const notifyStaff = async (staffId, title, body, data = {}) => {
  try {
    console.log('[Notification] notifyStaff called with:', { staffId, title, body, data });
    const staff = await Staff.findById(staffId).select('fcmToken name');

    if (!staff?.fcmToken) {
      console.log(`[Notification] No token for staff: ${staffId}`);
      return;
    }

    const message = {
      token: staff.fcmToken,
      notification: { title, body },
      // FCM data payload — all values must be strings
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await admin.messaging().send(message);
    console.log(`[Notification] Sent to ${staff.name}:`, response);
    return response;

  } catch (error) {
    // Remove stale/invalid token automatically
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      await Staff.findByIdAndUpdate(staffId, { fcmToken: null });
      console.log(`[Notification] Removed stale token for staff: ${staffId}`);
    } else {
      console.error('[Notification] Send error:', error);
    }
  }
};

// ─── Send to multiple staff members ──────────────────────
const notifyMultipleStaff = async (staffIds, title, body, data = {}) => {
  try {
    const staffList = await Staff.find({
      _id: { $in: staffIds },
      fcmToken: { $ne: null },
      status: 'active', // only notify active staff
    }).select('fcmToken name');

    if (!staffList.length) {
      console.log('[Notification] No active staff with tokens found');
      return;
    }

    const tokens = staffList.map(s => s.fcmToken);
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    console.log(`[Notification] ${response.successCount} sent, ${response.failureCount} failed`);

    // Clean up failed tokens
    response.responses.forEach(async (resp, index) => {
      if (!resp.success) {
        const failedStaff = staffList[index];
        await Staff.findByIdAndUpdate(failedStaff._id, { fcmToken: null });
        console.log(`[Notification] Removed stale token for: ${failedStaff.name}`);
      }
    });

    return response;

  } catch (error) {
    console.error('[Notification] Multicast error:', error);
  }
};

// ─── Send to ALL active staff ─────────────────────────────
const notifyAllStaff = async (title, body, data = {}) => {
  try {
    const staffList = await Staff.find({
      fcmToken: { $ne: null },
      status: 'active',
    }).select('fcmToken name');

    if (!staffList.length) return;

    const staffIds = staffList.map(s => s._id);
    return await notifyMultipleStaff(staffIds, title, body, data);

  } catch (error) {
    console.error('[Notification] Notify all error:', error);
  }
};

module.exports = { notifyStaff, notifyMultipleStaff, notifyAllStaff };