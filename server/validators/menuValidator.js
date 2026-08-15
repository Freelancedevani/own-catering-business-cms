const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  next();
};

exports.createMenuValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('pricePerUnit').isFloat({ min: 0 }).withMessage('Price must be ≥ 0'),
  body('portion.value').optional().isFloat({ min: 0 }),
  body('ingredients').optional().isArray(),
  body('ingredients.*.ingredientId').optional().isMongoId().withMessage('Invalid ingredient ID'),
  body('ingredients.*.quantity').optional().isFloat({ min: 0 }),
  body('ingredients.*.unit').optional().trim().notEmpty(),
  body('notes').optional().trim().isLength({ max: 500 }),
  handleValidation,
];

exports.updateMenuValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('category').optional().trim().notEmpty(),
  body('unit').optional().trim().notEmpty(),
  body('pricePerUnit').optional().isFloat({ min: 0 }),
  body('portion.value').optional().isFloat({ min: 0 }),
  body('ingredients').optional().isArray(),
  body('ingredients.*.ingredientId').optional().isMongoId(),
  body('ingredients.*.quantity').optional().isFloat({ min: 0 }),
  body('ingredients.*.unit').optional().trim().notEmpty(),
  body('notes').optional().trim().isLength({ max: 500 }),
  handleValidation,
];
