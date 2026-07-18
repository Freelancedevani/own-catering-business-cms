// const { body, validationResult } = require('express-validator');

// const handleValidation = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       success: false,
//       message: 'Validation failed',
//       errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
//     });
//   }
//   next();
// };

// const addressValidator = (prefix) => [
//   body(`${prefix}.street`).optional().trim(),
//   body(`${prefix}.city`).optional().trim(),
//   body(`${prefix}.state`).optional().trim(),
//   body(`${prefix}.pincode`)
//     .optional()
//     .matches(/^\d{6}$/).withMessage(`${prefix} pincode must be 6 digits`),
//   body(`${prefix}.country`).optional().trim(),
// ];

// exports.createClientValidator = [
//   body('name')
//     .trim()
//     .notEmpty().withMessage('Name is required')
//     .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

//   body('email')
//     .trim()
//     .notEmpty().withMessage('Email is required')
//     .isEmail().withMessage('Please provide a valid email')
//     .normalizeEmail(),

//   body('phone')
//     .trim()
//     .notEmpty().withMessage('Phone is required')
//     .isMobilePhone().withMessage('Please provide a valid phone number'),

//   body('alternatePhone')
//     .optional()
//     .isMobilePhone().withMessage('Please provide a valid alternate phone'),

//   body('company').optional().trim(),

//   body('clientType')
//     .optional()
//     .isIn(['individual', 'corporate', 'ngo', 'government'])
//     .withMessage('Invalid client type'),

//   body('status')
//     .optional()
//     .isIn(['active', 'inactive', 'blacklisted'])
//     .withMessage('Invalid status'),

//   body('source')
//     .optional()
//     .isIn(['lead_conversion', 'direct', 'referral', 'social_media', 'other'])
//     .withMessage('Invalid source'),

//   body('dietaryPreferences')
//     .optional()
//     .isArray().withMessage('Dietary preferences must be an array')
//     .custom((arr) => {
//       const valid = ['veg', 'non-veg', 'vegan', 'jain', 'gluten-free', 'halal'];
//       if (!arr.every((v) => valid.includes(v)))
//         throw new Error('Invalid dietary preference value');
//       return true;
//     }),

//   body('tags')
//     .optional()
//     .isArray().withMessage('Tags must be an array'),

//   body('specialRequirements')
//     .optional()
//     .trim()
//     .isLength({ max: 1000 }).withMessage('Cannot exceed 1000 characters'),

//   body('adminNotes')
//     .optional()
//     .trim()
//     .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),

//   ...addressValidator('billingAddress'),
//   ...addressValidator('eventAddress'),

//   handleValidation,
// ];

// exports.updateClientValidator = [
//   body('name')
//     .optional()
//     .trim()
//     .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

//   body('email')
//     .optional()
//     .trim()
//     .isEmail().withMessage('Please provide a valid email')
//     .normalizeEmail(),

//   body('phone')
//     .optional()
//     .isMobilePhone().withMessage('Please provide a valid phone number'),

//   body('clientType')
//     .optional()
//     .isIn(['individual', 'corporate', 'ngo', 'government'])
//     .withMessage('Invalid client type'),

//   body('status')
//     .optional()
//     .isIn(['active', 'inactive', 'blacklisted'])
//     .withMessage('Invalid status'),

//   body('dietaryPreferences')
//     .optional()
//     .isArray().withMessage('Dietary preferences must be an array'),

//   body('tags')
//     .optional()
//     .isArray().withMessage('Tags must be an array'),

//   ...addressValidator('billingAddress'),
//   ...addressValidator('eventAddress'),

//   handleValidation,
// ];


// server/validators/clientValidator.js
const { body, validationResult } = require('express-validator');

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

const addressValidator = (prefix) => [
  body(`${prefix}.street`).optional().trim(),
  body(`${prefix}.city`).optional().trim(),
  body(`${prefix}.state`).optional().trim(),
  body(`${prefix}.pincode`)
    .optional()
    .matches(/^\d{6}$/)
    .withMessage(`${prefix} pincode must be 6 digits`),
  body(`${prefix}.country`).optional().trim(),
];

// ✅ STATUS ENUM — defined once, reused in both validators
const VALID_STATUS   = ['active', 'inactive', 'blacklisted'];
const VALID_TYPES    = ['individual', 'corporate', 'ngo', 'government'];
const VALID_SOURCES  = ['lead_conversion', 'direct', 'referral', 'social_media', 'other'];
const VALID_DIETARY  = ['veg', 'non-veg', 'vegan', 'jain', 'gluten-free', 'halal'];

exports.createClientValidator = [
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

  body('alternatePhone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid alternate phone'),

  body('company').optional().trim(),

  body('clientType')
    .optional()
    .isIn(VALID_TYPES).withMessage('Invalid client type'),

  body('status')
    .optional()
    .isIn(VALID_STATUS).withMessage(`Status must be one of: ${VALID_STATUS.join(', ')}`),

  body('source')
    .optional()
    .isIn(VALID_SOURCES).withMessage('Invalid source'),

  body('dietaryPreferences')
    .optional()
    .isArray().withMessage('Dietary preferences must be an array')
    .custom((arr) => {
      if (!arr.every((v) => VALID_DIETARY.includes(v)))
        throw new Error(`Invalid dietary preference. Allowed: ${VALID_DIETARY.join(', ')}`);
      return true;
    }),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  body('specialRequirements')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Cannot exceed 1000 characters'),

  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),

  ...addressValidator('billingAddress'),
  ...addressValidator('eventAddress'),

  handleValidation,
];

exports.updateClientValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('alternatePhone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid alternate phone'),

  body('clientType')
    .optional()
    .isIn(VALID_TYPES).withMessage('Invalid client type'),

  // ✅ THIS was the bug — now uses shared VALID_STATUS with all 3 values
  body('status')
    .optional()
    .isIn(VALID_STATUS).withMessage(`Status must be one of: ${VALID_STATUS.join(', ')}`),

  body('source')
    .optional()
    .isIn(VALID_SOURCES).withMessage('Invalid source'),

  body('dietaryPreferences')
    .optional()
    .isArray().withMessage('Dietary preferences must be an array')
    .custom((arr) => {
      if (!arr.every((v) => VALID_DIETARY.includes(v)))
        throw new Error(`Invalid dietary preference. Allowed: ${VALID_DIETARY.join(', ')}`);
      return true;
    }),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  body('specialRequirements')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Cannot exceed 1000 characters'),

  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes cannot exceed 2000 characters'),

  ...addressValidator('billingAddress'),
  ...addressValidator('eventAddress'),

  handleValidation,
];
