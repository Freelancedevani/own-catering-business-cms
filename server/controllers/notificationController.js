const Staff = require('../models/Staff');

exports.saveToken = async (req, res) => {
  try {
    const { token } = req.body;
    const staffId = req.staffId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    await Staff.findByIdAndUpdate(staffId, { fcmToken: token });

    return res.status(200).json({
      success: true,
      message: 'Token saved successfully',
    });
  } catch (error) {
    console.error('[Notification] Save token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

exports.removeToken = async (req, res) => {
  try {
    const staffId = req.staffId;

    await Staff.findByIdAndUpdate(staffId, { fcmToken: null });

    return res.status(200).json({
      success: true,
      message: 'Token removed successfully',
    });
  } catch (error) {
    console.error('[Notification] Remove token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};