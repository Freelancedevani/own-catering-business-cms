const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  next();
};

exports.creditValidator = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('source')
    .optional()
    .isIn(['monthly_salary','bonus','adjustment']).withMessage('Invalid source'),
  body('description').optional().trim(),
  handleValidation,
];

exports.withdrawalValidator = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('source')
    .optional()
    .isIn(['withdrawal','advance']).withMessage('Invalid source'),
  body('description').optional().trim(),
  handleValidation,
];
