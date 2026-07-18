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

const INCOME_CATEGORIES = ['order_payment','advance_payment','refund_received','other_income'];
const EXPENSE_CATEGORIES = [
  'staff_salary','raw_material','equipment','vehicle_fuel',
  'venue_rental','utilities','marketing','maintenance',
  'tax_payment','miscellaneous',
];
const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

exports.createTransactionValidator = [
  body('flowType')
    .notEmpty().withMessage('Flow type is required')
    .isIn(['income', 'expense']).withMessage('Flow type must be income or expense'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(ALL_CATEGORIES).withMessage('Invalid category')
    .custom((category, { req }) => {
      const { flowType } = req.body;
      if (flowType === 'income' && !INCOME_CATEGORIES.includes(category))
        throw new Error('Invalid category for income transaction');
      if (flowType === 'expense' && !EXPENSE_CATEGORIES.includes(category))
        throw new Error('Invalid category for expense transaction');
      return true;
    }),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be at least 1'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash','bank_transfer','upi','cheque','card','online'])
    .withMessage('Invalid payment method'),

  body('transactionDate')
    .optional()
    .isISO8601().withMessage('Invalid transaction date'),

  body('gstApplicable')
    .optional()
    .isBoolean().withMessage('gstApplicable must be true or false'),

  body('gstRate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be between 0–100'),

  body('relatedOrder')
    .optional()
    .isMongoId().withMessage('Invalid order ID'),

  body('relatedClient')
    .optional()
    .isMongoId().withMessage('Invalid client ID'),

  body('relatedStaff')
    .optional()
    .isMongoId().withMessage('Invalid staff ID'),

  body('relatedWithdrawal')
    .optional()
    .isMongoId().withMessage('Invalid withdrawal ID'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),

  handleValidation,
];

exports.updateTransactionValidator = [
  body('amount')
    .optional()
    .isFloat({ min: 1 }).withMessage('Amount must be at least 1'),

  body('description')
    .optional().trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('paymentMethod')
    .optional()
    .isIn(['cash','bank_transfer','upi','cheque','card','online'])
    .withMessage('Invalid payment method'),

  body('status')
    .optional()
    .isIn(['completed','pending','cancelled'])
    .withMessage('Invalid status'),

  body('transactionDate')
    .optional()
    .isISO8601().withMessage('Invalid transaction date'),

  handleValidation,
];
