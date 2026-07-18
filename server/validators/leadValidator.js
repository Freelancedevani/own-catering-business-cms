const { body, query, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

exports.createLeadValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('eventType')
    .notEmpty().withMessage('Event type is required')
    .isIn(['wedding','reception','engagement','conference','corporate', 'product_launch','baby_shower','funeral','birthday', 'anniversary', 'social_gathering', 'other'])
    .withMessage('Invalid event type'),

  body('eventDate')
    .notEmpty().withMessage('Event date is required')
    .isISO8601().withMessage('Please provide a valid date (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Event date must be in the future');
      }
      return true;
    }),

  body('guestCount')
    .notEmpty().withMessage('Guest count is required')
    .isInt({ min: 1, max: 10000 }).withMessage('Guest count must be between 1 and 10000'),

  body('location')
    .trim()
    .notEmpty().withMessage('Event location is required'),

  body('budget')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a positive number'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),

  body('source')
    .optional()
    .isIn(['website', 'phone', 'referral', 'social_media', 'walk_in', 'other'])
    .withMessage('Invalid source'),

  handleValidation,
];

exports.updateLeadStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['new', 'contacted', 'qualified', 'converted', 'lost'])
    .withMessage('Invalid status value'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid priority value'),

  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),

  handleValidation,
];

exports.updateLeadStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['new', 'contacted', 'qualified', 'converted', 'lost'])
    .withMessage('Invalid status value'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid priority value'),

  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),

  body('followUpDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Please provide a valid follow-up date (YYYY-MM-DD)')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Follow-up date must be in the future');
      }
      return true;
    }),

  handleValidation,
];