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

exports.createWithdrawalValidator = [
  body('staff')
    .notEmpty().withMessage('Staff ID is required')
    .isMongoId().withMessage('Invalid staff ID'),

  body('type')
    .notEmpty().withMessage('Withdrawal type is required')
    .isIn(['salary','advance','bonus','reimbursement','overtime','incentive','other'])
    .withMessage('Invalid withdrawal type'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be at least 1'),

  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash','bank_transfer','upi','cheque'])
    .withMessage('Invalid payment method'),

  body('paymentReference')
    .optional().trim(),

  body('forMonth')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1–12'),

  body('forYear')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),

  body('description')
    .optional().trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  handleValidation,
];

exports.updateWithdrawalStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['approved','paid','rejected'])
    .withMessage('Invalid status — allowed: approved, paid, rejected'),

  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty().withMessage('Rejection reason is required when rejecting'),

  body('paymentReference')
    .if(body('status').equals('paid'))
    .optional().trim(),

  body('adminNotes')
    .optional().trim()
    .isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters'),

  handleValidation,
];
