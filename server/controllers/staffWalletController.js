const Staff       = require('../models/Staff');
const StaffWallet = require('../models/StaffWallet');
const Order       = require('../models/Order');
const catchAsync  = require('../utils/catchAsync');
const AppError    = require('../utils/AppError');

// -----------------------------------------------
// @GET /api/staff/:id/wallet
// Staff or Admin — view wallet ledger
// -----------------------------------------------
exports.getWallet = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, type, source, startDate, endDate } = req.query;

  const staff = await Staff.findById(req.params.staffId)
    .select('name employeeId totalEarned totalWithdrawn pendingBalance');
  if (!staff) return next(new AppError('Staff not found', 404));

  const filter = { staff: req.params.staffId };
  if (type)   filter.type   = type;
  if (source) filter.source = source;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(endDate);
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await StaffWallet.countDocuments(filter);

  const transactions = await StaffWallet.find(filter)
    .populate('order', 'orderNumber eventType eventDate')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: {
      staff,
      wallet: {
        totalEarned:    staff.totalEarned,
        totalWithdrawn: staff.totalWithdrawn,
        pendingBalance: staff.pendingBalance,
      },
      transactions,
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
// @POST /api/staff/:id/wallet/credit
// Admin — manually credit (bonus, salary, adjustment)
// -----------------------------------------------
exports.creditWallet = catchAsync(async (req, res, next) => {
  const { amount, source, description } = req.body;

  const staff = await Staff.findById(req.params.staffId);
  if (!staff) return next(new AppError('Staff not found', 404));

  // Update staff stats
  staff.totalEarned    += amount;
  staff.pendingBalance  = staff.totalEarned - staff.totalWithdrawn;
  await staff.save();

  const txn = await StaffWallet.create({
    staff:        staff._id,
    type:         'credit',
    amount,
    source:       source || 'adjustment',
    description:  description || 'Manual credit by admin',
    status:       'approved',
    balanceAfter: staff.pendingBalance,
    approvedBy:   req.user._id,
    approvedAt:   new Date(),
  });

  res.status(201).json({
    success: true,
    message: `₹${amount} credited to ${staff.name}'s wallet`,
    data: { transaction: txn, pendingBalance: staff.pendingBalance },
  });
});

// -----------------------------------------------
// @POST /api/orders/:id/credit-staff-fees
// Admin — when order completes, credit all assigned staff fees
// -----------------------------------------------
exports.creditOrderFees = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('assignedStaff.staff', 'name totalEarned totalWithdrawn pendingBalance');

  if (!order) return next(new AppError('Order not found', 404));
  if (order.status !== 'completed')
    return next(new AppError('Can only credit fees for completed orders', 400));
  if (!order.assignedStaff.length)
    return next(new AppError('No staff assigned to this order', 400));

  // Check if already credited for this order
  const alreadyCredited = await StaffWallet.findOne({ order: order._id, type: 'credit' });
  if (alreadyCredited)
    return next(new AppError('Fees already credited for this order', 400));

  const results = [];

  for (const assignment of order.assignedStaff) {
    const staffDoc = assignment.staff;
    const fee      = assignment.fee || 0;
    if (fee <= 0) continue;

    // Update staff wallet stats
    await Staff.findByIdAndUpdate(staffDoc._id, {
      $inc: {
        totalEarned:    fee,
        pendingBalance: fee,
      },
    });

    const updatedStaff = await Staff.findById(staffDoc._id).select('pendingBalance');

    const txn = await StaffWallet.create({
      staff:       staffDoc._id,
      type:        'credit',
      amount:      fee,
      source:      'order_fee',
      order:       order._id,
      description: `Fee for order ${order.orderNumber} — ${order.eventType}`,
      status:      'approved',
      balanceAfter: updatedStaff.pendingBalance,
      approvedBy:  req.user._id,
      approvedAt:  new Date(),
    });

    results.push({
      staff:       staffDoc.name,
      fee,
      transaction: txn._id,
    });
  }

  res.status(200).json({
    success: true,
    message: `Staff fees credited for order ${order.orderNumber}`,
    data:    { credited: results },
  });
});

// -----------------------------------------------
// @POST /api/staff/:id/wallet/withdraw
// Admin — record a withdrawal / advance payment
// -----------------------------------------------
exports.requestWithdrawal = catchAsync(async (req, res, next) => {
  const { amount, source = 'withdrawal', description } = req.body;

  const staff = await Staff.findById(req.params.staffId);
  if (!staff) return next(new AppError('Staff not found', 404));

  if (amount > staff.pendingBalance)
    return next(new AppError(
      `Withdrawal ₹${amount} exceeds available balance ₹${staff.pendingBalance}`, 400
    ));

  staff.totalWithdrawn += amount;
  staff.pendingBalance  = staff.totalEarned - staff.totalWithdrawn;
  await staff.save();

  const txn = await StaffWallet.create({
    staff:        staff._id,
    type:         'debit',
    amount,
    source,
    description:  description || 'Withdrawal by admin',
    status:       'approved',
    balanceAfter: staff.pendingBalance,
    approvedBy:   req.user._id,
    approvedAt:   new Date(),
  });

  res.status(201).json({
    success: true,
    message: `₹${amount} debited from ${staff.name}'s wallet`,
    data:    { transaction: txn, pendingBalance: staff.pendingBalance },
  });
});

// -----------------------------------------------
// @GET /api/staff/wallet/summary
// Admin — all staff wallet balances at a glance
// -----------------------------------------------
exports.getWalletSummary = catchAsync(async (req, res, next) => {
  const staffList = await Staff.find({ status: 'active' })
    .select('name employeeId role totalEarned totalWithdrawn pendingBalance')
    .sort({ pendingBalance: -1 });

  const totals = staffList.reduce((acc, s) => ({
    totalEarned:    acc.totalEarned    + s.totalEarned,
    totalWithdrawn: acc.totalWithdrawn + s.totalWithdrawn,
    totalPending:   acc.totalPending   + s.pendingBalance,
  }), { totalEarned: 0, totalWithdrawn: 0, totalPending: 0 });

  res.status(200).json({
    success: true,
    data: { staffList, totals },
  });
});

// -----------------------------------------------
// @GET /api/staff-wallet/mobile/summary
// Mobile — staff sees their own wallet + transactions
// -----------------------------------------------
exports.getMobileWalletSummary = catchAsync(async (req, res, next) => {
  const staffId = req.staffId ?? req.staff?._id;

  const staff = await Staff.findById(staffId)
    .select('name totalEarned totalWithdrawn pendingBalance salaryType salaryAmount');
  if (!staff) return next(new AppError('Staff not found', 404));

  const transactions = await StaffWallet.find({ staff: staffId })
    .populate('order', 'orderNumber eventType eventDate')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.status(200).json({
    success: true,
    data: {
      pendingBalance:  staff.pendingBalance,
      totalEarned:     staff.totalEarned,
      totalWithdrawn:  staff.totalWithdrawn,
      salaryType:      staff.salaryType,
      salaryAmount:    staff.salaryAmount,
      transactions,
    },
  });
});

// -----------------------------------------------
// @POST /api/staff-wallet/mobile/withdraw
// Mobile — staff submits withdrawal request (pending)
// -----------------------------------------------
exports.mobileRequestWithdrawal = catchAsync(async (req, res, next) => {
  const staffId = req.staffId ?? req.staff?._id;
  const { amount, paymentMethod = 'bank', note } = req.body;

  const staff = await Staff.findById(staffId);
  if (!staff) return next(new AppError('Staff not found', 404));

  if (amount > staff.pendingBalance)
    return next(new AppError(
      `Withdrawal ₹${amount} exceeds available balance ₹${staff.pendingBalance}`, 400
    ));

  // ✅ status = pending — admin must approve, balance NOT deducted yet
  const txn = await StaffWallet.create({
    staff:       staff._id,
    type:        'debit',
    amount,
    source:      'withdrawal',
    description: note || 'Withdrawal request by staff',
    status:      'pending',              // ✅ pending until admin approves
    balanceAfter: staff.pendingBalance,  // snapshot current balance
  });

  res.status(201).json({
    success: true,
    message: 'Withdrawal request submitted — pending admin approval',
    data: {
      transaction:    txn,
      pendingBalance: staff.pendingBalance,
    },
  });
});
