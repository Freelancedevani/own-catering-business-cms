const Staff          = require('../models/Staff');
const RefreshToken   = require('../models/RefreshToken.model');
const catchAsync     = require('../utils/catchAsync');
const AppError       = require('../utils/AppError');
const { cloudinary } = require('../utils/cloudinary');
const bcrypt         = require('bcryptjs');
const { issueTokens, rotateRefreshToken } = require('../utils/tokens');


// ─────────────────────────────────────────────
// @POST /api/staff
// ─────────────────────────────────────────────
exports.createStaff = catchAsync(async (req, res, next) => {
  const existingPhone = await Staff.findOne({ phone: req.body.phone });
  if (existingPhone) return next(new AppError('Staff with this phone already exists', 400));
  if (!req.body.password) return next(new AppError('Password is required', 400));

  const staff = await Staff.create(req.body);
  staff.password = undefined;

  res.status(201).json({
    success: true,
    message: 'Staff member created successfully',
    data: { staff },
  });
});


// ─────────────────────────────────────────────
// @GET /api/staff
// ─────────────────────────────────────────────
exports.getAllStaff = catchAsync(async (req, res) => {
  const {
    status, role, department,
    search, page = 1, limit = 10,
    sortBy = 'createdAt', order = 'desc',
  } = req.query;

  const filter = {};
  if (status)     filter.status     = status;
  if (role)       filter.role       = role;
  if (department) filter.department = department;
  if (search) {
    filter.$or = [
      { name:       { $regex: search, $options: 'i' } },
      { phone:      { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { email:      { $regex: search, $options: 'i' } },
    ];
  }

  const skip      = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [staffList, total] = await Promise.all([
    Staff.find(filter)
      .select('-attendance -documents -bankDetails -password')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Staff.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      staff: staffList,
      pagination: {
        total, page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});


// ─────────────────────────────────────────────
// @GET /api/staff/:id
// ─────────────────────────────────────────────
exports.getStaffById = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id)
    .select('-password')
    .populate('user', 'name email role');
  if (!staff) return next(new AppError('Staff member not found', 404));

  res.status(200).json({ success: true, data: { staff } });
});


// ─────────────────────────────────────────────
// @PUT /api/staff/:id
// ─────────────────────────────────────────────
exports.updateStaff = catchAsync(async (req, res, next) => {
  if (req.body.phone) {
    const existing = await Staff.findOne({
      phone: req.body.phone, _id: { $ne: req.params.id },
    });
    if (existing) return next(new AppError('Phone already used by another staff member', 400));
  }

  delete req.body.password;

  const staff = await Staff.findByIdAndUpdate(
    req.params.id, req.body,
    { new: true, runValidators: true }
  ).select('-password');

  if (!staff) return next(new AppError('Staff member not found', 404));

  res.status(200).json({
    success: true,
    message: 'Staff updated successfully',
    data: { staff },
  });
});


// ─────────────────────────────────────────────
// @PUT /api/staff/:id/change-password
// ─────────────────────────────────────────────
exports.changePassword = catchAsync(async (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return next(new AppError('Password must be at least 6 characters', 400));

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  const hashed = await bcrypt.hash(newPassword, 12);
  await Staff.findByIdAndUpdate(req.params.id, { password: hashed });

  // Revoke all existing refresh tokens — force re-login on all devices
  await RefreshToken.updateMany(
    { staff: req.params.id, revokedAt: null },
    { revokedAt: new Date() }
  );

  res.status(200).json({ success: true, message: 'Password updated. Please login again.' });
});


// ─────────────────────────────────────────────
// @POST /api/staff/:id/upload-profile-pic
// ─────────────────────────────────────────────
exports.uploadProfilePic = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No image file provided', 400));

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (staff.profilePic?.publicId) {
    await cloudinary.uploader.destroy(staff.profilePic.publicId);
  }

  const updated = await Staff.findByIdAndUpdate(
    req.params.id,
    { profilePic: { url: req.file.path, publicId: req.file.filename } },
    { new: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile picture updated',
    data: { profilePic: updated.profilePic },
  });
});


// ─────────────────────────────────────────────
// @DELETE /api/staff/:id/remove-profile-pic
// ─────────────────────────────────────────────
exports.removeProfilePic = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (staff.profilePic?.publicId) {
    await cloudinary.uploader.destroy(staff.profilePic.publicId);
  }

  await Staff.findByIdAndUpdate(req.params.id, {
    profilePic: { url: '', publicId: '' },
  });

  res.status(200).json({ success: true, message: 'Profile picture removed' });
});


// ─────────────────────────────────────────────
// @POST /api/staff/mobile-login
// ─────────────────────────────────────────────
exports.mobileLogin = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;
  if (!phone || !password) return next(new AppError('Phone and password are required', 400));

  const staff = await Staff.findOne({ phone }).select('+password');
  if (!staff) return next(new AppError('Invalid credentials', 401));

  if (['terminated', 'inactive'].includes(staff.status))
    return next(new AppError('Your account is not active. Contact admin.', 403));

  const isMatch = await staff.comparePassword(password);
  if (!isMatch) return next(new AppError('Invalid credentials', 401));

  const { accessToken, refreshToken } = await issueTokens(staff, req);

  staff.password = undefined;
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { accessToken, refreshToken, staff },
  });
});


// ─────────────────────────────────────────────
// @POST /api/staff/mobile-refresh
// ─────────────────────────────────────────────
exports.mobileRefresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError('Refresh token required', 400));

  // Verify JWT signature + expiry
  let decoded;
  try {
    decoded = require('jsonwebtoken').verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return next(new AppError('Invalid or expired refresh token. Please login again.', 401));
  }

  // Find stored token by hash
  const stored = await RefreshToken.findOne({
    tokenHash: RefreshToken.hash(refreshToken),
  }).populate('staff');

  if (!stored || !stored.isActive) {
    // If token was already used (revokedAt set) — possible theft, revoke entire family
    if (stored?.replacedBy) {
      await RefreshToken.updateMany({ staff: stored.staff }, { revokedAt: new Date() });
    }
    return next(new AppError('Session expired. Please login again.', 401));
  }

  const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(stored, stored.staff, req);

  res.status(200).json({
    success: true,
    data: { accessToken, refreshToken: newRefreshToken },
  });
});


// ─────────────────────────────────────────────
// @POST /api/staff/mobile-logout
// ─────────────────────────────────────────────
exports.mobileLogout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.findOneAndUpdate(
      { tokenHash: RefreshToken.hash(refreshToken) },
      { revokedAt: new Date() }
    );
  }
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});


// ─────────────────────────────────────────────
// @GET /api/staff/mobile/me
// ─────────────────────────────────────────────
// exports.getMobileProfile = catchAsync(async (req, res, next) => {
//   const staff = await Staff.findById(req.staffId)
//     .select('-password -attendance -documents')
//     .populate('user', 'name email');
//   if (!staff) return next(new AppError('Staff not found', 404));

//   res.status(200).json({ success: true, data: { staff } });
// });

exports.getMobileProfile = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.staffId)
    .select('-password -documents')
    .populate('user', 'name email');

  if (!staff) return next(new AppError('Staff not found', 404));

  res.status(200).json({ success: true, data: { staff } });
});

// ─────────────────────────────────────────────
// @DELETE /api/staff/:id
// ─────────────────────────────────────────────
exports.deleteStaff = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  if (staff.profilePic?.publicId) {
    await cloudinary.uploader.destroy(staff.profilePic.publicId);
  }

  // Revoke all sessions
  await RefreshToken.deleteMany({ staff: req.params.id });
  await staff.deleteOne();

  res.status(200).json({ success: true, message: 'Staff member deleted', data: null });
});


// ─────────────────────────────────────────────
// @POST /api/staff/:id/attendance
// ─────────────────────────────────────────────
exports.markAttendance = catchAsync(async (req, res, next) => {
  const { date, status, note } = req.body;

  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found', 404));

  const attendanceDate = new Date(date);
  const alreadyMarked  = staff.attendance.some(
    (a) => new Date(a.date).toDateString() === attendanceDate.toDateString()
  );
  if (alreadyMarked) return next(new AppError('Attendance already marked for this date', 400));

  const updated = await Staff.findByIdAndUpdate(
    req.params.id,
    { $push: { attendance: { date: attendanceDate, status, note } } },
    { new: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Attendance marked successfully',
    data: { staff: updated },
  });
});


// ─────────────────────────────────────────────
// @GET /api/staff/:id/attendance
// ─────────────────────────────────────────────
exports.getAttendance = catchAsync(async (req, res, next) => {
  const { month, year } = req.query;
  const staff = await Staff.findById(req.params.id)
    .select('name employeeId attendance salaryType salaryAmount');
  if (!staff) return next(new AppError('Staff member not found', 404));

  let attendance = staff.attendance;
  if (month && year) {
    attendance = attendance.filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    });
  }

  const summary = {
    present:  attendance.filter((a) => a.status === 'present').length,
    absent:   attendance.filter((a) => a.status === 'absent').length,
    half_day: attendance.filter((a) => a.status === 'half_day').length,
    leave:    attendance.filter((a) => a.status === 'leave').length,
    total:    attendance.length,
  };

  let earnedSalary = 0;
  if (staff.salaryType === 'daily') {
    earnedSalary = (summary.present + summary.half_day * 0.5) * staff.salaryAmount;
  } else if (staff.salaryType === 'monthly') {
    const daysInMonth = new Date(year, month, 0).getDate();
    earnedSalary = ((summary.present + summary.half_day * 0.5) / daysInMonth) * staff.salaryAmount;
  }

  res.status(200).json({
    success: true,
    data: {
      staff:        { name: staff.name, employeeId: staff.employeeId },
      month:        `${month}/${year}`,
      attendance,
      summary,
      earnedSalary: Math.round(earnedSalary),
    },
  });
});


// ─────────────────────────────────────────────
// @GET /api/staff/stats
// ─────────────────────────────────────────────
exports.getStaffStats = catchAsync(async (req, res) => {
  const [total, byRole, byStatus, byDepartment, topEarners] = await Promise.all([
    Staff.countDocuments(),
    Staff.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Staff.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Staff.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Staff.find({ status: 'active' }).sort({ totalEarned: -1 }).limit(5)
      .select('name employeeId role totalEarned totalWithdrawn pendingBalance profilePic'),
  ]);

  res.status(200).json({
    success: true,
    data: { total, byRole, byStatus, byDepartment, topEarners },
  });
});