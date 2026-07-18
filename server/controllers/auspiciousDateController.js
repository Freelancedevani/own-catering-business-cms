// server/controllers/auspiciousDateController.js
const AuspiciousDate = require('../models/AuspiciousDate');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// @desc    Create a new auspicious date
// @route   POST /api/auspicious-dates
// @access  Private/Admin
exports.createAuspiciousDate = catchAsync(async (req, res, next) => {
  const {
    englishDate,
    englishMonth,
    englishYear,
    englishDay,
    dayOfWeek,
    bengaliDate,
    bengaliMonth,
    bengaliYear,
    bengaliDay,
    events,
    isHoliday,
    notes,
  } = req.body;

  const existingDate = await AuspiciousDate.findOne({ englishDate: new Date(englishDate) });
  if (existingDate) {
    return next(new AppError('An entry for this date already exists', 400));
  }

  const auspiciousDate = await AuspiciousDate.create({
    englishDate: new Date(englishDate),
    englishMonth,
    englishYear,
    englishDay,
    dayOfWeek,
    bengaliDate,
    bengaliMonth,
    bengaliYear,
    bengaliDay,
    events,
    isHoliday: isHoliday || false,
    notes: notes || '',
    createdBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Auspicious date created successfully',
    data: auspiciousDate,
  });
});

// @desc    Get all auspicious dates
// @route   GET /api/auspicious-dates
// @access  Public
exports.getAllAuspiciousDates = catchAsync(async (req, res, next) => {
  const { year, month, bengaliYear, bengaliMonth, eventType } = req.query;

  const filter = {};

  if (year) filter.englishYear = parseInt(year);
  if (month) filter.englishMonth = month;
  if (bengaliYear) filter.bengaliYear = parseInt(bengaliYear);
  if (bengaliMonth) filter.bengaliMonth = bengaliMonth;
  if (eventType) filter['events.type'] = eventType;

  const auspiciousDates = await AuspiciousDate.find(filter)
    .sort({ englishDate: 1 })
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  res.status(200).json({
    success: true,
    count: auspiciousDates.length,
    data: auspiciousDates,
  });
});

// @desc    Get auspicious dates by English month
// @route   GET /api/auspicious-dates/month
// @access  Public
exports.getByMonth = catchAsync(async (req, res, next) => {
  const { year, month } = req.query;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const monthName = monthNames[parseInt(month) - 1];

  const auspiciousDates = await AuspiciousDate.find({
    englishYear: parseInt(year),
    englishMonth: monthName,
  }).sort({ englishDate: 1 });

  res.status(200).json({
    success: true,
    count: auspiciousDates.length,
    data: auspiciousDates,
  });
});

// @desc    Get auspicious dates by Bengali month
// @route   GET /api/auspicious-dates/bengali-month
// @access  Public
exports.getByBengaliMonth = catchAsync(async (req, res, next) => {
  const { bengaliYear, bengaliMonth } = req.query;

  const auspiciousDates = await AuspiciousDate.find({
    bengaliYear: parseInt(bengaliYear),
    bengaliMonth,
  }).sort({ englishDate: 1 });

  res.status(200).json({
    success: true,
    count: auspiciousDates.length,
    data: auspiciousDates,
  });
});

// @desc    Get single auspicious date by ID
// @route   GET /api/auspicious-dates/:id
// @access  Public
exports.getAuspiciousDateById = catchAsync(async (req, res, next) => {
  const auspiciousDate = await AuspiciousDate.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!auspiciousDate) {
    return next(new AppError('Auspicious date not found', 404));
  }

  res.status(200).json({
    success: true,
    data: auspiciousDate,
  });
});

// @desc    Update an auspicious date
// @route   PUT /api/auspicious-dates/:id
// @access  Private/Admin
exports.updateAuspiciousDate = catchAsync(async (req, res, next) => {
  const { events, isHoliday, notes } = req.body;

  const auspiciousDate = await AuspiciousDate.findById(req.params.id);

  if (!auspiciousDate) {
    return next(new AppError('Auspicious date not found', 404));
  }

  if (events) auspiciousDate.events = events;
  if (isHoliday !== undefined) auspiciousDate.isHoliday = isHoliday;
  if (notes !== undefined) auspiciousDate.notes = notes;
  auspiciousDate.updatedBy = req.user._id;

  await auspiciousDate.save();

  res.status(200).json({
    success: true,
    message: 'Auspicious date updated successfully',
    data: auspiciousDate,
  });
});

// @desc    Delete an auspicious date
// @route   DELETE /api/auspicious-dates/:id
// @access  Private/Admin
exports.deleteAuspiciousDate = catchAsync(async (req, res, next) => {
  const auspiciousDate = await AuspiciousDate.findById(req.params.id);

  if (!auspiciousDate) {
    return next(new AppError('Auspicious date not found', 404));
  }

  await auspiciousDate.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Auspicious date deleted successfully',
  });
});

// @desc    Bulk create auspicious dates
// @route   POST /api/auspicious-dates/bulk
// @access  Private/Admin
exports.bulkCreateAuspiciousDates = catchAsync(async (req, res, next) => {
  const { dates } = req.body;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return next(new AppError('Please provide an array of dates', 400));
  }

  const formattedDates = dates.map((d) => ({
    ...d,
    englishDate: new Date(d.englishDate),
    createdBy: req.user._id,
  }));

  const created = await AuspiciousDate.insertMany(formattedDates, {
    ordered: false,
  });

  res.status(201).json({
    success: true,
    message: `${created.length} auspicious dates created successfully`,
    count: created.length,
  });
});

// @desc    Get yearly summary
// @route   GET /api/auspicious-dates/summary/:year
// @access  Public
exports.getYearlySummary = catchAsync(async (req, res, next) => {
  const year = parseInt(req.params.year);

  const summary = await AuspiciousDate.aggregate([
    {
      $match: { englishYear: year },
    },
    {
      $unwind: '$events',
    },
    {
      $group: {
        _id: '$events.type',
        count: { $sum: 1 },
        label: { $first: '$events.label' },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  const totalAuspiciousDays = await AuspiciousDate.countDocuments({
    englishYear: year,
  });

  res.status(200).json({
    success: true,
    data: {
      year,
      totalAuspiciousDays,
      byEventType: summary,
    },
  });
});