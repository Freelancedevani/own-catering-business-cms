// server/validators/ingredientPriceValidator.js
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

exports.createIngredientValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('category')
    .optional()
    .isIn(['fish', 'meat', 'vegetable', 'grain', 'dairy', 'spice', 'other'])
    .withMessage('Invalid category'),

  body('unit')
    .notEmpty().withMessage('Unit is required')
    .isIn(['piece', 'gram', 'kg', 'litre', 'ml'])
    .withMessage('Invalid unit'),

  body('pricePerUnit')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  handleValidation,
];

exports.updateIngredientValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('category')
    .optional()
    .isIn(['fish', 'meat', 'vegetable', 'grain', 'dairy', 'spice', 'other'])
    .withMessage('Invalid category'),

  body('unit')
    .optional()
    .isIn(['piece', 'gram', 'kg', 'litre', 'ml'])
    .withMessage('Invalid unit'),

  body('pricePerUnit')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),

  handleValidation,
];
