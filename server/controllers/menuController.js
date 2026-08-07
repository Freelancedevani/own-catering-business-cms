const IngredientPrice = require('../models/MenuItem');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// GET /api/menu
exports.getAllMenuItems = catchAsync(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;

  const ingredients = await IngredientPrice.find(filter).sort('name');
  res.status(200).json({ success: true, data: { ingredients } });
});

// GET /api/menu/:id
exports.getMenuItem = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findById(req.params.id);
  if (!ingredient) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, data: { ingredient } });
});

// POST /api/menu
exports.createMenuItem = catchAsync(async (req, res) => {
  const { name, category, pricePerUnit, notes } = req.body;
  const ingredient = await IngredientPrice.create({
    name,
    category,
    unit: 'piece',
    pricePerUnit,
    notes,
    updatedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Menu item created', data: { ingredient } });
});

// PATCH /api/menu/:id
exports.updateMenuItem = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!ingredient) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, message: 'Menu item updated', data: { ingredient } });
});

// DELETE /api/menu/:id — soft delete
exports.deleteMenuItem = catchAsync(async (req, res, next) => {
  const ingredient = await IngredientPrice.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!ingredient) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, message: 'Menu item removed' });
});
