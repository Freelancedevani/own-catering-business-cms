// const express = require('express');
// const router  = express.Router();
// const {
//   createStaff, getAllStaff, getStaffById,
//   updateStaff, deleteStaff,
//   markAttendance, getAttendance,
//   getStaffStats,
//   uploadProfilePic, removeProfilePic,
//   changePassword,
//   mobileLogin, getMobileProfile,
// } = require('../controllers/staffController');
// const { protect, adminOnly }          = require('../middleware/authMiddleware');
// const { mobileAuthMiddleware }        = require('../middleware/mobileAuthMiddleware');
// const { uploadStaffPic }              = require('../utils/cloudinary');
// const {
//   createStaffValidator,
//   updateStaffValidator,
//   attendanceValidator,
// } = require('../validators/staffValidator');

// // ─────────────────────────────────────────────
// // ✅ Public — Mobile App (no admin auth needed)
// // ─────────────────────────────────────────────
// router.post('/mobile-login',  mobileLogin);
// router.get('/mobile/me',      mobileAuthMiddleware, getMobileProfile);

// // ─────────────────────────────────────────────
// // All routes below require admin auth
// // ─────────────────────────────────────────────
// router.use(protect, adminOnly);

// router.get('/stats', getStaffStats);

// router.route('/')
//   .get(getAllStaff)
//   .post(createStaffValidator, createStaff);

// router.route('/:id')
//   .get(getStaffById)
//   .put(updateStaffValidator, updateStaff)
//   .delete(deleteStaff);

// // ✅ Password change
// router.put('/:id/change-password', changePassword);

// // ✅ Profile pic upload — multer middleware runs before controller
// router.post('/:id/upload-profile-pic',
//   uploadStaffPic.single('profilePic'),
//   uploadProfilePic
// );
// router.delete('/:id/remove-profile-pic', removeProfilePic);

// // Attendance (unchanged)
// router.route('/:id/attendance')
//   .post(attendanceValidator, markAttendance)
//   .get(getAttendance);

// module.exports = router;

const express = require('express');
const router  = express.Router();
const {
  createStaff, getAllStaff, getStaffById,
  updateStaff, deleteStaff,
  markAttendance, getAttendance,
  getStaffStats,
  uploadProfilePic, removeProfilePic,
  changePassword,
  mobileLogin, mobileRefresh, mobileLogout,
  getMobileProfile,
} = require('../controllers/staffController');
const { protect, adminOnly }          = require('../middleware/authMiddleware');
const { mobileAuthMiddleware }        = require('../middleware/mobileAuthMiddleware');
const { uploadStaffPic }              = require('../utils/cloudinary');
const {
  createStaffValidator,
  updateStaffValidator,
  attendanceValidator,
} = require('../validators/staffValidator');

// ─────────────────────────────────────────────
// Public — Mobile App
// ─────────────────────────────────────────────
router.post('/mobile-login',    mobileLogin);
router.post('/mobile-refresh',  mobileRefresh);
router.post('/mobile-logout',   mobileLogout);
router.get('/mobile/me',        mobileAuthMiddleware, getMobileProfile);

// ─────────────────────────────────────────────
// All routes below require admin auth
// ─────────────────────────────────────────────
router.use(protect, adminOnly);

router.get('/stats', getStaffStats);

router.route('/')
  .get(getAllStaff)
  .post(createStaffValidator, createStaff);

router.route('/:id')
  .get(getStaffById)
  .put(updateStaffValidator, updateStaff)
  .delete(deleteStaff);

router.put('/:id/change-password', changePassword);

router.post('/:id/upload-profile-pic',
  uploadStaffPic.single('profilePic'),
  uploadProfilePic
);
router.delete('/:id/remove-profile-pic', removeProfilePic);

router.route('/:id/attendance')
  .post(attendanceValidator, markAttendance)
  .get(getAttendance);

module.exports = router;