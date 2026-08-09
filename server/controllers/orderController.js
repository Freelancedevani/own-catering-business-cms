const StaffWallet = require('../models/StaffWallet');
const Staff       = require('../models/Staff');
const Order       = require('../models/Order');
const Client      = require('../models/Client');
const catchAsync  = require('../utils/catchAsync');
const AppError    = require('../utils/AppError');
const { autoCreateOrderTransaction } = require('../utils/financeHelper');
const { notifyStaff, notifyMultipleStaff, createNotification } = require('../utils/notificationService');

// ── Expense category → Transaction category map ──
const EXPENSE_CATEGORY_MAP = {
  food_raw_material: 'raw_material',
  decoration:        'miscellaneous',
  equipment_rental:  'equipment',
  vehicle_fuel:      'vehicle_fuel',
  venue_rental:      'venue_rental',
  staff_salary:      'staff_salary',
  utilities:         'utilities',
  marketing:         'marketing',
  miscellaneous:     'miscellaneous',
};

const ORDER_EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_MAP);

// ── Helper: auto-credit assigned staff fees on order complete ──
const creditStaffFeesForOrder = async (order, adminUserId) => {
  if (!order.assignedStaff?.length) return;

  const alreadyCredited = await StaffWallet.findOne({ order: order._id, type: 'credit' });
  if (alreadyCredited) return;

  for (const assignment of order.assignedStaff) {
    const staffId = assignment.staff?._id || assignment.staff;
    const fee     = assignment.fee || 0;
    if (fee <= 0) continue;

    await Staff.findByIdAndUpdate(staffId, {
      $inc: { totalEarned: fee, pendingBalance: fee },
    });

    const updatedStaff = await Staff.findById(staffId).select('pendingBalance');

    await StaffWallet.create({
      staff:        staffId,
      type:         'credit',
      amount:       fee,
      source:       'order_fee',
      order:        order._id,
      description:  `Fee for order ${order.orderNumber} — ${order.eventType}`,
      status:       'approved',
      balanceAfter: updatedStaff.pendingBalance,
      approvedBy:   adminUserId || null,
      approvedAt:   new Date(),
    });
  }
};

// ── Status transition map ──
const TRANSITIONS = {
  confirmed:   ['agreement', 'cancelled'],
  agreement:   ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

// ── Notification messages per status ──
const STATUS_NOTIFICATION = {
  agreement:   (o) => ({ title: '📋 Agreement Completed', body: `Order ${o.orderNumber} (${o.eventType}) agreement is completed.` }),
  in_progress: (o) => ({ title: '🚀 Event In Progress',    body: `Order ${o.orderNumber} (${o.eventType}) is now in progress!` }),
  completed:   (o) => ({ title: '🎉 Order Completed',      body: `Order ${o.orderNumber} (${o.eventType}) is completed. Your fee has been credited.` }),
  cancelled:   (o) => ({ title: '❌ Order Cancelled',      body: `Order ${o.orderNumber} (${o.eventType}) has been cancelled.` }),
};

// ── Helper: notify all assigned staff on status change ──
const notifyAssignedStaffOnStatusChange = async (order, newStatus) => {
  if (!order.assignedStaff?.length) return;
  const notif = STATUS_NOTIFICATION[newStatus];
  if (!notif) return;

  const { title, body } = notif(order);
  const staffIds = order.assignedStaff.map(
    (a) => a.staff?._id?.toString() || a.staff?.toString()
  );

  await notifyMultipleStaff(staffIds, title, body, {
    orderId:     order._id.toString(),
    orderNumber: order.orderNumber,
    status:      newStatus,
    type:        'order_status_update',
  });
};

// ── Internal: auto-finance on completion (staff expenses) ──
const autoFinanceOnComplete = async (order, userId) => {
  for (const assignment of order.assignedStaff || []) {
    const fee     = assignment.fee || 0;
    const staffId = assignment.staff?._id || assignment.staff;
    if (fee <= 0) continue;

    await autoCreateOrderTransaction({
      flowType:      'expense',
      category:      'staff_salary',
      amount:        fee,
      description:   `Staff fee for ${assignment.role || 'Staff'} — order ${order.orderNumber} (${order.eventType})`,
      paymentMethod: 'bank_transfer',
      relatedOrder:  order._id,
      relatedClient: order.client,
      relatedStaff:  staffId,
      createdBy:     userId,
      tags:          ['staff_fee', 'auto'],
    });
  }
};

// ── Internal: auto-finance on cancellation (refund liability) ──
const autoFinanceOnCancel = async (order, userId) => {
  if (!order.paidAmount || order.paidAmount <= 0) return;

  await autoCreateOrderTransaction({
    flowType:      'income',
    category:      'refund_received',
    amount:        order.paidAmount,
    description:   `Cancellation refund liability — order ${order.orderNumber}. ₹${order.paidAmount} was collected.`,
    paymentMethod: 'bank_transfer',
    relatedOrder:  order._id,
    relatedClient: order.client,
    createdBy:     userId,
    status:        'pending',
    tags:          ['cancellation', 'refund', 'auto'],
  });
};

// -----------------------------------------------
// @GET /api/orders
// -----------------------------------------------
exports.getOrders = catchAsync(async (req, res, next) => {
  const {
    page = 1, limit = 10,
    search, status, eventType,
    paymentStatus, startDate, endDate,
    sortBy = 'createdAt', sortOrder = 'desc',
  } = req.query;

  const filter = {};
  if (status)        filter.status        = status;
  if (eventType)     filter.eventType     = eventType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (startDate || endDate) {
    filter.eventDate = {};
    if (startDate) filter.eventDate.$gte = new Date(startDate);
    if (endDate)   filter.eventDate.$lte = new Date(endDate);
  }

  if (search) {
    const clients = await Client.find({
      name: { $regex: search, $options: 'i' },
    }).select('_id');
    filter.$or = [
      { orderNumber:  { $regex: search, $options: 'i' } },
      { client:       { $in: clients.map((c) => c._id) } },
      { 'venue.city': { $regex: search, $options: 'i' } },
    ];
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const sort  = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const total = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate('client',              'name email phone')
    .populate('assignedStaff.staff', 'name role employeeId')
    .populate('relatedLead',         'name email')
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: {
      orders,
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
// @GET /api/orders/stats
// -----------------------------------------------
exports.getOrderStats = catchAsync(async (req, res, next) => {
  const now      = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [statusCounts, revenue, upcoming, paymentCounts, monthlyTrend, upcomingEvents] =
    await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: {
          _id:            null,
          totalRevenue:   { $sum: '$totalAmount'   },
          totalCollected: { $sum: '$paidAmount'    },
          totalBalance:   { $sum: '$balanceAmount' },
        }},
      ]),
      Order.countDocuments({
        eventDate: { $gte: now, $lte: monthEnd },
        status:    { $in: ['confirmed', 'agreement', 'in_progress'] },
      }),
      Order.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        }}},
        { $group: { _id: { $month: '$createdAt' }, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } },
      ]),
      Order.find({
        eventDate: { $gte: now, $lte: monthEnd },
        status: { $in: ['confirmed', 'agreement', 'in_progress'] },
      })
        .populate('client', 'name')
        .sort({ eventDate: 1 })
        .limit(10)
        .select('orderNumber eventType eventDate eventName guestCount status paymentStatus'),
    ]);

  const counts    = {};
  const payCounts = {};
  statusCounts.forEach(({ _id, count }) => { counts[_id]    = count; });
  paymentCounts.forEach(({ _id, count }) => { payCounts[_id] = count; });

  const byStatus = Object.entries(counts).map(([status, count]) => ({ _id: status, count }));

  res.status(200).json({
    success: true,
    data: {
      total:             Object.values(counts).reduce((s, c) => s + c, 0),
      totalOrders:       Object.values(counts).reduce((s, c) => s + c, 0),
      confirmed:         counts.confirmed   || 0,
      agreement:         counts.agreement   || 0,
      in_progress:       counts.in_progress || 0,
      completed:         counts.completed   || 0,
      cancelled:         counts.cancelled   || 0,
      upcomingThisMonth: upcoming,
      totalRevenue:      revenue[0]?.totalRevenue   || 0,
      totalCollected:    revenue[0]?.totalCollected || 0,
      totalBalance:      revenue[0]?.totalBalance   || 0,
      unpaidOrders:      payCounts.unpaid   || 0,
      partialOrders:     payCounts.partial  || 0,
      byStatus,
      monthlyTrend,
      upcomingEvents,
    },
  });
});

// -----------------------------------------------
// @GET /api/orders/:id
// -----------------------------------------------
exports.getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('client',              'name email phone address')
    .populate('assignedStaff.staff', 'name role phone employeeId')
    .populate('relatedLead',         'name email phone')
    .populate('expenses.addedBy',    'name');

  if (!order) return next(new AppError('Order not found', 404));
  res.status(200).json({ success: true, data: { order } });
});

// -----------------------------------------------
// @POST /api/orders
// -----------------------------------------------
exports.createOrder = catchAsync(async (req, res, next) => {
  const order = await Order.create(req.body);
  await order.populate('client', 'name email phone');

  await Client.findByIdAndUpdate(req.body.client, {
    $inc:          { totalOrders: 1 },
    lastOrderDate: new Date(),
  });

  if (order.paidAmount > 0) {
    const firstPayment = order.payments?.[0];
    await autoCreateOrderTransaction({
      flowType:         'income',
      category:         'advance_payment',
      amount:           order.paidAmount,
      description:      `Advance payment for order ${order.orderNumber} — ${order.eventType}`,
      paymentMethod:    firstPayment?.paymentMethod    || 'cash',
      paymentReference: firstPayment?.paymentReference || '',
      relatedOrder:     order._id,
      relatedClient:    order.client,
      createdBy:        req.user.id,
      tags:             ['advance', 'auto'],
    });
  }

  // ✅ Notify any pre-assigned staff at order creation
  if (order.assignedStaff?.length) {
    const staffIds = order.assignedStaff.map(
      (a) => a.staff?._id?.toString() || a.staff?.toString()
    );
    await notifyMultipleStaff(
      staffIds,
      '📌 New Order Assigned',
      `You have been assigned to order ${order.orderNumber} (${order.eventType}).`,
      {
        orderId:     order._id.toString(),
        orderNumber: order.orderNumber,
        type:        'new_order_assigned',
      }
    );
  }

  await createNotification(
    '📋 New Order Created',
    `Order ${order.orderNumber} (${order.eventType}) has been created.`,
    'order',
    `/orders`
  );

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data:    { order },
  });
});

// -----------------------------------------------
// @PUT /api/orders/:id
// -----------------------------------------------
exports.updateOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const { status, cancelReason, ...rest } = req.body;
  const prevStatus = order.status;

  if (status && status !== prevStatus) {
    if (!TRANSITIONS[prevStatus]?.includes(status)) {
      return next(new AppError(
        `Cannot transition from "${prevStatus}" to "${status}"`, 400
      ));
    }
    rest.status = status;
    if (status === 'confirmed') rest.confirmedAt = new Date();
    if (status === 'completed') rest.completedAt = new Date();
    if (status === 'cancelled') {
      rest.cancelledAt  = new Date();
      rest.cancelReason = cancelReason || '';
    }
  }

  Object.assign(order, rest);
  await order.save();

  if (status && status !== prevStatus) {
    await notifyAssignedStaffOnStatusChange(order, status);
    const notif = STATUS_NOTIFICATION[status];
    if (notif) {
      const { title, body } = notif(order);
      await createNotification(title, body, 'order', `/orders`);
    }

    if (status === 'completed') {
      await creditStaffFeesForOrder(order, req.user.id);
      await autoFinanceOnComplete(order, req.user.id);
    }

    if (status === 'cancelled') {
      await autoFinanceOnCancel(order, req.user.id);
    }
  }

  await order.populate('client',              'name email phone');
  await order.populate('assignedStaff.staff', 'name role employeeId');

  res.status(200).json({
    success: true,
    message: 'Order updated successfully',
    data:    { order },
  });
});

// -----------------------------------------------
// @PATCH /api/orders/:id/status
// -----------------------------------------------
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const { status, cancelReason, note } = req.body;
  const prevStatus = order.status;

  if (!TRANSITIONS[prevStatus]?.includes(status)) {
    return next(new AppError(
      `Cannot transition from "${prevStatus}" to "${status}"`, 400
    ));
  }

  order.status = status;
  if (note)                   order.adminNotes  = note;
  if (status === 'confirmed') order.confirmedAt = new Date();
  if (status === 'completed') order.completedAt = new Date();
  if (status === 'cancelled') {
    order.cancelledAt  = new Date();
    order.cancelReason = cancelReason || '';
  }

  await order.save();

  // ✅ Notify assigned staff about status change
  await notifyAssignedStaffOnStatusChange(order, status);
  const notif = STATUS_NOTIFICATION[status];
  if (notif) {
    const { title, body } = notif(order);
    await createNotification(title, body, 'order', `/orders`);
  }

  if (status === 'completed' && prevStatus !== 'completed') {
    await creditStaffFeesForOrder(order, req.user.id);
    await autoFinanceOnComplete(order, req.user.id);
  }

  if (status === 'cancelled' && prevStatus !== 'cancelled') {
    await autoFinanceOnCancel(order, req.user.id);
  }

  await order.populate('client',              'name email phone');
  await order.populate('assignedStaff.staff', 'name role employeeId');

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    data:    { order },
  });
});

// -----------------------------------------------
// @POST /api/orders/:id/payment
// -----------------------------------------------
exports.addPayment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const { amount, paymentMethod, paymentReference, notes } = req.body;

  if (amount > order.balanceAmount) {
    return next(new AppError(
      `Payment ₹${amount} exceeds balance ₹${order.balanceAmount}`, 400
    ));
  }

  order.payments.push({ amount, paymentMethod, paymentReference, notes });
  await order.save();

  await Client.findByIdAndUpdate(order.client, {
    $inc: { totalSpent: amount },
  });

  const isFullPayment = order.balanceAmount === 0;

  await autoCreateOrderTransaction({
    flowType:         'income',
    category:         'order_payment',
    amount,
    description:      `Payment ₹${amount} for order ${order.orderNumber} — ${order.eventType}${isFullPayment ? ' (Full Payment)' : ' (Partial Payment)'}`,
    paymentMethod:    paymentMethod    || 'cash',
    paymentReference: paymentReference || '',
    relatedOrder:     order._id,
    relatedClient:    order.client,
    createdBy:        req.user.id,
    tags:             ['payment', 'auto', isFullPayment ? 'full_payment' : 'partial'],
  });

  // ✅ Notify assigned staff about payment update
  // if (order.assignedStaff?.length) {
  //   const staffIds = order.assignedStaff.map(
  //     (a) => a.staff?._id?.toString() || a.staff?.toString()
  //   );
  //   await notifyMultipleStaff(
  //     staffIds,
  //     isFullPayment ? '💰 Full Payment Received' : '💳 Partial Payment Received',
  //     `₹${amount} payment recorded for order ${order.orderNumber} (${order.eventType}).`,
  //     {
  //       orderId:        order._id.toString(),
  //       orderNumber:    order.orderNumber,
  //       amount:         String(amount),
  //       isFullPayment:  String(isFullPayment),
  //       type:           'payment_update',
  //     }
  //   );
  // }

  await order.populate('client',              'name email phone');
  await order.populate('assignedStaff.staff', 'name role employeeId');

  res.status(200).json({
    success: true,
    message: 'Payment recorded successfully',
    data:    { order },
  });
});

// -----------------------------------------------
// @POST /api/orders/:id/staff
// -----------------------------------------------
exports.assignStaff = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const { staff, role, reportTime, fee } = req.body;

  const alreadyAssigned = order.assignedStaff.some(
    (s) => s.staff.toString() === staff
  );
  if (alreadyAssigned)
    return next(new AppError('Staff already assigned to this order', 400));

  // ✅ Auto-fill fee from staff salary if not provided
  let assignedFee = fee;
  if (assignedFee === undefined || assignedFee === null || assignedFee === '') {
    const staffDoc = await Staff.findById(staff).select('salaryAmount salaryType');
    assignedFee = staffDoc?.salaryAmount ?? 0;
  }

  order.assignedStaff.push({ staff, role, reportTime, fee: Number(assignedFee) });
  await order.save();
  await order.populate('assignedStaff.staff', 'name role employeeId phone salaryAmount salaryType');

  // ✅ Notify the newly assigned staff member
  await notifyStaff(
    staff,
    '📌 You Have Been Assigned to an Order',
    `You are assigned as ${role || 'Staff'} for order ${order.orderNumber} (${order.eventType}).${reportTime ? ` Report time: ${new Date(reportTime).toLocaleString('en-IN')}` : ''}`,
    {
      orderId:     order._id.toString(),
      orderNumber: order.orderNumber,
      role:        role || '',
      fee:         String(Number(assignedFee)),
      type:        'staff_assigned',
    }
  );

  res.status(200).json({
    success: true,
    message: 'Staff assigned successfully',
    data:    { order },
  });
});

// -----------------------------------------------
// @DELETE /api/orders/:id/staff/:staffId
// -----------------------------------------------
exports.removeStaff = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const before = order.assignedStaff.length;
  order.assignedStaff = order.assignedStaff.filter(
    (s) => s.staff.toString() !== req.params.staffId
  );

  if (order.assignedStaff.length === before)
    return next(new AppError('Staff not found in this order', 404));

  await order.save();
  await order.populate('assignedStaff.staff', 'name role employeeId phone');

  // ✅ Notify the removed staff member
  await notifyStaff(
    req.params.staffId,
    '🔕 Removed from Order',
    `You have been removed from order ${order.orderNumber} (${order.eventType}).`,
    {
      orderId:     order._id.toString(),
      orderNumber: order.orderNumber,
      type:        'staff_removed',
    }
  );

  res.status(200).json({
    success: true,
    message: 'Staff removed successfully',
    data:    { order },
  });
});

// -----------------------------------------------
// @DELETE /api/orders/:id
// -----------------------------------------------
exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  if (['completed', 'in_progress'].includes(order.status))
    return next(new AppError(
      'Cannot delete a completed or in-progress order', 400
    ));

  await order.deleteOne();
  res.status(200).json({
    success: true,
    message: 'Order deleted successfully',
    data:    null,
  });
});

// ═══════════════════════════════════════════════
// ORDER EXPENSES
// ═══════════════════════════════════════════════

exports.getOrderExpenses = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .select('expenses orderNumber eventType totalAmount paidAmount')
    .populate('expenses.addedBy', 'name');

  if (!order) return next(new AppError('Order not found', 404));

  const totalExpenses = order.expenses.reduce((s, e) => s + e.amount, 0);

  res.status(200).json({
    success: true,
    data: {
      expenses:      order.expenses,
      totalExpenses,
      orderNumber:   order.orderNumber,
      orderRevenue:  order.totalAmount,
      netProfit:     order.totalAmount - totalExpenses,
    },
  });
});

exports.addOrderExpense = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const { category, description, amount, paymentMethod, paymentReference, vendor } = req.body;

  if (!category || !ORDER_EXPENSE_CATEGORIES.includes(category)) {
    return next(new AppError(
      `Invalid category. Valid values: ${ORDER_EXPENSE_CATEGORIES.join(', ')}`, 400
    ));
  }
  if (!amount || Number(amount) <= 0) {
    return next(new AppError('Amount must be greater than 0', 400));
  }

  order.expenses.push({
    category,
    description:      description      || '',
    amount:           Number(amount),
    paymentMethod:    paymentMethod    || 'cash',
    paymentReference: paymentReference || '',
    vendor:           vendor           || '',
    addedBy:          req.user.id,
    date:             new Date(),
  });

  await order.save();

  await autoCreateOrderTransaction({
    flowType:         'expense',
    category:         EXPENSE_CATEGORY_MAP[category] || 'miscellaneous',
    amount:           Number(amount),
    description:      `[Order ${order.orderNumber}] ${description || category.replace(/_/g, ' ')} — ${order.eventType}${vendor ? ` (${vendor})` : ''}`,
    paymentMethod:    paymentMethod    || 'cash',
    paymentReference: paymentReference || '',
    relatedOrder:     order._id,
    relatedClient:    order.client,
    createdBy:        req.user.id,
    tags:             ['order_expense', 'auto', category],
  });

  const totalExpenses = order.expenses.reduce((s, e) => s + e.amount, 0);

  res.status(201).json({
    success: true,
    message: 'Expense added successfully',
    data: {
      expenses:      order.expenses,
      totalExpenses,
      orderRevenue:  order.totalAmount,
      netProfit:     order.totalAmount - totalExpenses,
    },
  });
});

exports.deleteOrderExpense = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('Order not found', 404));

  const before = order.expenses.length;
  order.expenses = order.expenses.filter(
    (e) => e._id.toString() !== req.params.expenseId
  );

  if (order.expenses.length === before)
    return next(new AppError('Expense not found', 404));

  await order.save();

  const totalExpenses = order.expenses.reduce((s, e) => s + e.amount, 0);

  res.status(200).json({
    success: true,
    message: 'Expense deleted successfully',
    data: {
      expenses:      order.expenses,
      totalExpenses,
      orderRevenue:  order.totalAmount,
      netProfit:     order.totalAmount - totalExpenses,
    },
  });
});

// -----------------------------------------------
// @GET /api/orders/mobile/my-orders
// -----------------------------------------------
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const staffId = req.staffId ?? req.staff?._id;

  const orders = await Order.find({ 'assignedStaff.staff': staffId })
    .populate('client', 'name phone email')
    .sort({ eventDate: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

// -----------------------------------------------
// @GET /api/orders/mobile/my-orders/:id
// -----------------------------------------------
exports.getMyOrderById = catchAsync(async (req, res, next) => {
  const staffId = req.staffId ?? req.staff?._id;

  const order = await Order.findOne({ _id: req.params.id, 'assignedStaff.staff': staffId })
    .populate('client', 'name phone email')
    .lean();

  res.status(200).json({
    success: true,
    data: order,
  });
});