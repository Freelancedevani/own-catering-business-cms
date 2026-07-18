// server/validators/auspiciousDateValidator.js
const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const eventTypeEnum = [
  'biye',
  'annaprashan',
  'mukhebhaat',
  'grihapravesh',
  'namkaran',
  'upanayan',
  'puja',
  'other',
];

const bengaliMonthEnum = [
  'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র',
  'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ',
  'ফাল্গুন', 'চৈত্র',
];

const englishMonthEnum = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

exports.validateCreateAuspiciousDate = [
  // English date fields
  body('englishDate')
    .notEmpty().withMessage('English date is required')
    .isISO8601().withMessage('Invalid English date format. Use YYYY-MM-DD'),

  body('englishMonth')
    .notEmpty().withMessage('English month is required')
    .isIn(englishMonthEnum).withMessage('Invalid English month'),

  body('englishYear')
    .notEmpty().withMessage('English year is required')
    .isInt({ min: 2020, max: 2100 }).withMessage('Invalid English year'),

  body('englishDay')
    .notEmpty().withMessage('English day is required')
    .isInt({ min: 1, max: 31 }).withMessage('Invalid English day (1-31)'),

  body('dayOfWeek')
    .notEmpty().withMessage('Day of week is required')
    .isIn(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    .withMessage('Invalid day of week'),

  // Bengali date fields
  body('bengaliDate')
    .notEmpty().withMessage('Bengali date string is required')
    .isString().withMessage('Bengali date must be a string'),

  body('bengaliMonth')
    .notEmpty().withMessage('Bengali month is required')
    .isIn(bengaliMonthEnum).withMessage('Invalid Bengali month'),

  body('bengaliYear')
    .notEmpty().withMessage('Bengali year is required')
    .isInt({ min: 1400, max: 1500 }).withMessage('Invalid Bengali year'),

  body('bengaliDay')
    .notEmpty().withMessage('Bengali day is required')
    .isInt({ min: 1, max: 32 }).withMessage('Invalid Bengali day (1-32)'),

  // Events (no time field anymore)
  body('events')
    .isArray({ min: 1 }).withMessage('At least one event is required'),

  body('events.*.type')
    .notEmpty().withMessage('Event type is required')
    .isIn(eventTypeEnum).withMessage('Invalid event type'),

  body('events.*.label')
    .notEmpty().withMessage('Event label is required')
    .isString().withMessage('Event label must be a string'),

  body('isHoliday')
    .optional()
    .isBoolean().withMessage('isHoliday must be boolean'),

  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string'),

  handleValidationErrors,
];

exports.validateUpdateAuspiciousDate = [
  param('id')
    .isMongoId().withMessage('Invalid auspicious date ID'),

  body('events')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one event is required'),

  body('events.*.type')
    .optional()
    .isIn(eventTypeEnum).withMessage('Invalid event type'),

  body('events.*.label')
    .optional()
    .isString().withMessage('Event label must be a string'),

  body('isHoliday')
    .optional()
    .isBoolean().withMessage('isHoliday must be boolean'),

  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string'),

  handleValidationErrors,
];

exports.validateGetByMonth = [
  query('year')
    .notEmpty().withMessage('Year is required')
    .isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),

  query('month')
    .notEmpty().withMessage('Month is required')
    .isInt({ min: 1, max: 12 }).withMessage('Invalid month (1-12)'),

  handleValidationErrors,
];

exports.validateGetByBengaliMonth = [
  query('bengaliYear')
    .notEmpty().withMessage('Bengali year is required')
    .isInt({ min: 1400, max: 1500 }).withMessage('Invalid Bengali year'),

  query('bengaliMonth')
    .notEmpty().withMessage('Bengali month is required')
    .isIn(bengaliMonthEnum).withMessage('Invalid Bengali month'),

  handleValidationErrors,
];

exports.validateGetById = [
  param('id')
    .isMongoId().withMessage('Invalid auspicious date ID'),

  handleValidationErrors,
];

exports.validateDeleteAuspiciousDate = [
  param('id')
    .isMongoId().withMessage('Invalid auspicious date ID'),

  handleValidationErrors,
];

exports.validateBulkCreate = [
  body('dates')
    .isArray({ min: 1 }).withMessage('Dates array is required and must contain at least one date'),

  handleValidationErrors,
];