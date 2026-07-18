const Withdrawal = require('../models/Withdrawal');
const Staff      = require('../models/Staff');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');

// -----------------------------------------------
// @POST /api/withdrawals
// @access Admin only
// -----------------------------------------------
exports.createWithdrawal = catchAsync(async (req, res, next) => {
  const {
    staff, type, amount, paymentMethod,
    paymentReference, forMonth, forYear,
    description,
  } = req.body;

  // Validate staff exists & is active
  const staffDoc = await Staff.findById(staff);
  if (!staffDoc) return next(new AppError('Staff member not found', 404));
  if (staffDoc.status === 'terminated')
    return next(new AppError('Cannot process withdrawal for terminated staff', 400));

  // Prevent duplicate salary payment for same month/year
  if (type === 'salary' && forMonth && forYear) {
    const duplicate = await Withdrawal.findOne({
      staff,
      type: 'salary',
      forMonth,
      forYear,
      status: { $in: ['approved', 'paid'] },
    });
    if (duplicate)
      return next(new AppError(
        `Salary for ${forMonth}/${forYear} has already been processed`, 400
      ));
  }

  const withdrawal = await Withdrawal.create({
    staff, type, amount, paymentMethod,
    paymentReference, forMonth, forYear,
    description,
  });

  const populated = await Withdrawal.findById(withdrawal._id)
    .populate('staff', 'name employeeId role phone');

  res.status(201).json({
    success: true,
    message: 'Withdrawal request created successfully',
    data: { withdrawal: populated },
  });
});

// -----------------------------------------------
// @GET /api/withdrawals
// @access Admin only
// -----------------------------------------------
exports.getAllWithdrawals = catchAsync(async (req, res, next) => {
  const {
    status, type, staff,
    forMonth, forYear,
    startDate, endDate,
    page = 1, limit = 10,
    sortBy = 'createdAt', order = 'desc',
  } = req.query;

  const filter = {};
  if (status)   filter.status = status;
  if (type)     filter.type = type;
  if (staff)    filter.staff = staff;
  if (forMonth) filter.forMonth = Number(forMonth);
  if (forYear)  filter.forYear  = Number(forYear);

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }

  const skip      = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(filter)
      .populate('staff', 'name employeeId role')
      .populate('approvedBy', 'name')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Withdrawal.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// -----------------------------------------------
// @GET /api/withdrawals/:id
// @access Admin only
// -----------------------------------------------
exports.getWithdrawalById = catchAsync(async (req, res, next) => {
  const withdrawal = await Withdrawal.findById(req.params.id)
    .populate('staff', 'name employeeId role phone salaryType salaryAmount')
    .populate('approvedBy', 'name email');

  if (!withdrawal) return next(new AppError('Withdrawal not found', 404));

  res.status(200).json({ success: true, data: { withdrawal } });
});

// -----------------------------------------------
// @PATCH /api/withdrawals/:id/status
// @access Admin only
// -----------------------------------------------
exports.updateWithdrawalStatus = catchAsync(async (req, res, next) => {
  const { status, rejectionReason, paymentReference, adminNotes } = req.body;

  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return next(new AppError('Withdrawal not found', 404));

  // Prevent updating already finalized withdrawals
  if (['paid', 'rejected'].includes(withdrawal.status))
    return next(new AppError(
      `Cannot update a withdrawal that is already "${withdrawal.status}"`, 400
    ));

  // Status transition rules
  const validTransitions = {
    pending:  ['approved', 'rejected'],
    approved: ['paid', 'rejected'],
  };

  if (!validTransitions[withdrawal.status]?.includes(status))
    return next(new AppError(
      `Cannot change status from "${withdrawal.status}" to "${status}"`, 400
    ));

  withdrawal.status = status;
  withdrawal.approvedBy = req.user.id;
  if (rejectionReason) withdrawal.rejectionReason = rejectionReason;
  if (paymentReference) withdrawal.paymentReference = paymentReference;
  if (adminNotes) withdrawal.adminNotes = adminNotes;
  if (status === 'paid') withdrawal.paidAt = new Date();

  await withdrawal.save();

  // ── Update Staff balance when paid ──
  if (status === 'paid') {
    await Staff.findByIdAndUpdate(withdrawal.staff, {
      $inc: {
        totalWithdrawn: withdrawal.amount,
        pendingBalance: -withdrawal.amount,
      },
    });
  }

  const populated = await Withdrawal.findById(withdrawal._id)
    .populate('staff', 'name employeeId role')
    .populate('approvedBy', 'name');

  res.status(200).json({
    success: true,
    message: `Withdrawal ${status} successfully`,
    data: { withdrawal: populated },
  });
});

// -----------------------------------------------
// @DELETE /api/withdrawals/:id
// @access Admin only — only pending
// -----------------------------------------------
exports.deleteWithdrawal = catchAsync(async (req, res, next) => {
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return next(new AppError('Withdrawal not found', 404));

  if (withdrawal.status !== 'pending')
    return next(new AppError('Only pending withdrawals can be deleted', 400));

  await withdrawal.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Withdrawal deleted successfully',
    data: null,
  });
});

// -----------------------------------------------
// @GET /api/withdrawals/staff/:staffId
// @access Admin only — full history for one staff
// -----------------------------------------------
exports.getStaffWithdrawals = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.staffId)
    .select('name employeeId role salaryAmount salaryType totalEarned totalWithdrawn pendingBalance');
  if (!staff) return next(new AppError('Staff member not found', 404));

  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [withdrawals, total] = await Promise.all([
    Withdrawal.find({ staff: req.params.staffId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Withdrawal.countDocuments({ staff: req.params.staffId }),
  ]);

  // Summary
  const summary = await Withdrawal.aggregate([
    { $match: { staff: staff._id, status: 'paid' } },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count:       { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      staff,
      withdrawals,
      summary,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// -----------------------------------------------
// @GET /api/withdrawals/stats
// @access Admin only
// -----------------------------------------------
exports.getWithdrawalStats = catchAsync(async (req, res, next) => {
  const { month, year } = req.query;

  const matchFilter = { status: 'paid' };
  if (month && year) {
    matchFilter.forMonth = Number(month);
    matchFilter.forYear  = Number(year);
  }

  const [
    totalPaid,
    pending,
    byType,
    byMethod,
    monthlyTrend,
  ] = await Promise.all([
    Withdrawal.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    Withdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    Withdrawal.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),

    Withdrawal.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    // Last 6 months trend
    Withdrawal.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: { month: '$forMonth', year: '$forYear' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalPaid:    { amount: totalPaid[0]?.total || 0, count: totalPaid[0]?.count || 0 },
      pendingPayout:{ amount: pending[0]?.total  || 0, count: pending[0]?.count  || 0 },
      byType,
      byMethod,
      monthlyTrend,
    },
  });
});
