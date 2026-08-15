const MenuItem = require('../models/MenuItem');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');

// GET /api/menu
exports.getAllMenuItems = catchAsync(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;

  const items = await MenuItem.find(filter).sort('name');
  res.status(200).json({ success: true, data: { items } });
});

// GET /api/menu/:id
exports.getMenuItem = catchAsync(async (req, res, next) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, data: { item } });
});

// POST /api/menu
exports.createMenuItem = catchAsync(async (req, res) => {
  const { name, code, category, unit, pricePerUnit, notes } = req.body;
  const item = await MenuItem.create({
    name, code, category, unit, pricePerUnit, notes,
    updatedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Menu item created', data: { item } });
});

// PATCH /api/menu/:id
exports.updateMenuItem = catchAsync(async (req, res, next) => {
  const item = await MenuItem.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  );
  if (!item) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, message: 'Menu item updated', data: { item } });
});

// DELETE /api/menu/:id — soft delete
exports.deleteMenuItem = catchAsync(async (req, res, next) => {
  const item = await MenuItem.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!item) return next(new AppError('Menu item not found', 404));
  res.status(200).json({ success: true, message: 'Menu item removed' });
});
