const User = require('../models/User');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const generateToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError('Email already registered', 400));

  const user = await User.create({ name, email, password, phone });
  const token = generateToken(user._id, user.role);
  sendTokenCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  const token = generateToken(user._id, user.role);
  sendTokenCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
  });
});

exports.logout = (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return next(new AppError('User not found', 404));
  res.status(200).json({ success: true, data: { user } });
});
