// server/controllers/ingredientPriceController.js
const IngredientPrice = require('../models/IngredientPrice');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// GET /api/ingredient-prices  — frontend uses this for the calculator
exports.getAllIngredients = catchAsync(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;

  const ingredients = await IngredientPrice.find(filter).sort('name');
  res.status(200).json({ success: true, data: { ingredients } });
});

// GET /api/ingredient-prices/:id
exports.getIngredient = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findById(req.params.id);
  if (!ingredient) return next(new AppError('Ingredient not found', 404));
  res.status(200).json({ success: true, data: { ingredient } });
});

// POST /api/ingredient-prices  — admin only
exports.createIngredient = catchAsync(async (req, res) => {
  const { name, category, unit, pricePerUnit, notes } = req.body;
  const ingredient = await IngredientPrice.create({
    name,
    category,
    unit,
    pricePerUnit,
    notes,
    updatedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Ingredient created', data: { ingredient } });
});

// PATCH /api/ingredient-prices/:id  — admin only, update price
exports.updateIngredient = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!ingredient) return next(new AppError('Ingredient not found', 404));
  res.status(200).json({ success: true, message: 'Price updated', data: { ingredient } });
});

// DELETE /api/ingredient-prices/:id  — soft delete
exports.deleteIngredient = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!ingredient) return next(new AppError('Ingredient not found', 404));
  res.status(200).json({ success: true, message: 'Ingredient deactivated' });
});
