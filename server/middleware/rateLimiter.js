const rateLimit = require('express-rate-limit');

exports.authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 0 minute
  max: 100, // max 10 requests per window
  message: {
    success: false,
    message: 'Too many attempts from this IP. Please try again after 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

exports.globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 0 minutes
  max: 200,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
