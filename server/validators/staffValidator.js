const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message:  'Validation failed',
      errors:   errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Create ───────────────────────────────────
exports.createStaffValidator = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('phone')
    .trim().notEmpty().withMessage('Phone is required')
    .isMobilePhone('any').withMessage('Invalid phone number'),

  body('email')
    .optional({ values: 'falsy' })
    .trim().isEmail().withMessage('Invalid email')
    .normalizeEmail(),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['chef','assistant_chef','waiter','supervisor','driver',
           'cleaner','manager','accountant','delivery_boy','helper','other'])
    .withMessage('Invalid role'),

  body('department')
    .optional({ values: 'falsy' })
    .isIn(['kitchen','service','delivery','management','accounts','other'])
    .withMessage('Invalid department'),

  body('salaryType')
    .notEmpty().withMessage('Salary type is required')
    .isIn(['monthly','daily','hourly','per_event'])
    .withMessage('Invalid salary type'),

  body('salaryAmount')
    .notEmpty().withMessage('Salary amount is required')
    .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),

  body('gender')
    .optional({ values: 'falsy' })
    .isIn(['male','female','other']).withMessage('Invalid gender'),

  body('dateOfBirth')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid date of birth'),

  body('joiningDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid joining date'),

  // ✅ Fixed: optional({ values: 'falsy' }) — skips validation when empty string sent
  body('bankDetails.ifscCode')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code'),

  handleValidation,
];

// ─── Update ───────────────────────────────────
exports.updateStaffValidator = [
  body('name')
    .optional({ values: 'falsy' })
    .trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone('any').withMessage('Invalid phone number'),

  body('email')
    .optional({ values: 'falsy' })
    .trim().isEmail().withMessage('Invalid email').normalizeEmail(),

  body('role')
    .optional({ values: 'falsy' })
    .isIn(['chef','assistant_chef','waiter','supervisor','driver',
           'cleaner','manager','accountant','delivery_boy','helper','other'])
    .withMessage('Invalid role'),

  body('department')
    .optional({ values: 'falsy' })
    .isIn(['kitchen','service','delivery','management','accounts','other'])
    .withMessage('Invalid department'),

  body('salaryType')
    .optional({ values: 'falsy' })
    .isIn(['monthly','daily','hourly','per_event'])
    .withMessage('Invalid salary type'),

  body('salaryAmount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 }).withMessage('Salary must be positive'),

  body('status')
    .optional({ values: 'falsy' })
    .isIn(['active','inactive','on_leave','terminated'])
    .withMessage('Invalid status'),

  body('gender')
    .optional({ values: 'falsy' })
    .isIn(['male','female','other']).withMessage('Invalid gender'),

  body('dateOfBirth')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid date of birth'),

  body('joiningDate')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Invalid joining date'),

  // ✅ Fixed: same as create
  body('bankDetails.ifscCode')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code'),

  handleValidation,
];

// ─── Attendance ───────────────────────────────
exports.attendanceValidator = [
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format'),

  body('status')
    .notEmpty().withMessage('Attendance status is required')
    .isIn(['present','absent','half_day','leave'])
    .withMessage('Invalid attendance status'),

  body('note').optional({ values: 'falsy' }).trim(),

  handleValidation,
];