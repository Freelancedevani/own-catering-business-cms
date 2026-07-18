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

const EVENT_TYPES = [
  'wedding','reception','engagement','birthday','anniversary','riceceremony',
  'corporate','conference','product_launch','social_gathering',
  'baby_shower','funeral','other'
];

exports.createOrderValidator = [
  body('client')
    .notEmpty().withMessage('Client is required')
    .isMongoId().withMessage('Invalid client ID'),

  body('eventType')
    .notEmpty().withMessage('Event type is required')
    .isIn(EVENT_TYPES).withMessage('Invalid event type'),

  body('eventDate')
    .notEmpty().withMessage('Event date is required')
    .isISO8601().withMessage('Invalid date format'),
    // .custom((v) => {
    //   if (new Date(v) <= new Date())
    //     throw new Error('Event date must be in the future');
    //   return true;
    // }),

  body('guestCount')
    .notEmpty().withMessage('Guest count is required')
    .isInt({ min: 1, max: 100000 })
    .withMessage('Guest count must be between 1–100000'),

  body('items')
    .isArray({ min: 1 }).withMessage('At least one menu item is required'),

  body('items.*.name')
    .notEmpty().withMessage('Item name is required'),

  body('items.*.price')
    .notEmpty().withMessage('Item price is required')
    .isFloat({ min: 0 }).withMessage('Price must be positive'),

  body('items.*.quantity')
    .notEmpty().withMessage('Item quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  body('assignedStaff')
    .optional()
    .isArray().withMessage('Assigned staff must be an array'),

  body('assignedStaff.*.staff')
    .optional()
    .isMongoId().withMessage('Invalid staff ID'),

  body('assignedStaff.*.fee')
    .optional()
    .isFloat({ min: 0 }).withMessage('Staff fee must be positive'),

  body('discountType')
    .optional()
    .isIn(['percentage','fixed']).withMessage('Invalid discount type'),

  body('discountValue')
    .optional()
    .isFloat({ min: 0 }).withMessage('Discount must be positive'),

  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be 0–100'),

  body('deliveryCharge')
    .optional()
    .isFloat({ min: 0 }).withMessage('Delivery charge must be positive'),

  body('specialInstructions')
    .optional().trim()
    .isLength({ max: 1000 }).withMessage('Cannot exceed 1000 characters'),

  handleValidation,
];

exports.updateOrderValidator = [
  body('eventType')
    .optional().isIn(EVENT_TYPES).withMessage('Invalid event type'),

  body('eventDate')
    .optional()
    .isISO8601().withMessage('Invalid date format'),

  body('guestCount')
    .optional()
    .isInt({ min: 1 }).withMessage('Guest count must be at least 1'),

  body('status')
    .optional()
    .isIn(['inquiry','quoted','confirmed','planning','ready','in_progress','completed','cancelled'])
    .withMessage('Invalid status'),

  body('cancelReason')
    .if(body('status').equals('cancelled'))
    .notEmpty().withMessage('Cancel reason is required'),

  handleValidation,
];

exports.addPaymentValidator = [
  body('amount')
    .notEmpty().withMessage('Payment amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be at least 1'),

  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash','upi','bank_transfer','card','cheque','online'])
    .withMessage('Invalid payment method'),

  body('paymentReference')
    .optional().trim(),

  body('notes')
    .optional().trim(),

  handleValidation,
];

exports.updateStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['inquiry','quoted','confirmed','planning','ready','in_progress','completed','cancelled'])
    .withMessage('Invalid status'),

  body('note')
    .optional().trim(),

  body('cancelReason')
    .if(body('status').equals('cancelled'))
    .notEmpty().withMessage('Cancel reason is required when cancelling'),

  handleValidation,
];
