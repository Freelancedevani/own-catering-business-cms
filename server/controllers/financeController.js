const Transaction = require('../models/Transaction');
const catchAsync  = require('../utils/catchAsync');
const AppError    = require('../utils/AppError');


// -----------------------------------------------
// @POST /api/finance/transactions
// @access Admin only
// -----------------------------------------------
exports.createTransaction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.create({
    ...req.body,
    createdBy: req.user.id,
  });

  const populated = await Transaction.findById(transaction._id)
    .populate('relatedClient', 'name email')
    .populate('relatedStaff',  'name employeeId')
    .populate('relatedOrder',  'orderNumber eventType')
    .populate('createdBy',     'name');

  res.status(201).json({
    success: true,
    message: 'Transaction recorded successfully',
    data: { transaction: populated },
  });
});


// -----------------------------------------------
// @GET /api/finance/transactions
// @access Admin only
// -----------------------------------------------
exports.getAllTransactions = catchAsync(async (req, res, next) => {
  const {
    flowType, category, status,
    paymentMethod, startDate, endDate,
    search, page = 1, limit = 10,
    sortBy = 'transactionDate', order = 'desc',
    source, // 'auto' | 'manual'
  } = req.query;

  const filter = {};
  if (flowType)      filter.flowType      = flowType;
  if (category)      filter.category      = category;
  if (status)        filter.status        = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  // Filter auto vs manual transactions by tag
  if (source === 'auto')   filter.tags = 'auto';
  if (source === 'manual') filter.tags = { $ne: 'auto' };

  if (startDate || endDate) {
    filter.transactionDate = {};
    if (startDate) filter.transactionDate.$gte = new Date(startDate);
    if (endDate)   filter.transactionDate.$lte = new Date(endDate);
  }

  if (search) {
    filter.$or = [
      { transactionNumber: { $regex: search, $options: 'i' } },
      { description:       { $regex: search, $options: 'i' } },
      { paymentReference:  { $regex: search, $options: 'i' } },
    ];
  }

  const skip      = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .populate('relatedClient', 'name')
      .populate('relatedStaff',  'name employeeId')
      .populate('relatedOrder',  'orderNumber eventType eventDate')
      .populate('createdBy',     'name')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Transaction.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
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
// @GET /api/finance/transactions/:id
// @access Admin only
// -----------------------------------------------
exports.getTransactionById = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('relatedClient',     'name email phone')
    .populate('relatedStaff',      'name employeeId role')
    .populate('relatedOrder',      'orderNumber eventType eventDate totalAmount')
    .populate('relatedWithdrawal', 'referenceNumber type amount')
    .populate('createdBy',         'name email');

  if (!transaction) return next(new AppError('Transaction not found', 404));

  res.status(200).json({ success: true, data: { transaction } });
});


// -----------------------------------------------
// @PUT /api/finance/transactions/:id
// @access Admin only
// -----------------------------------------------
exports.updateTransaction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return next(new AppError('Transaction not found', 404));

  if (transaction.status === 'cancelled')
    return next(new AppError('Cannot update a cancelled transaction', 400));

  // Prevent changing core identity fields after creation
  delete req.body.flowType;
  delete req.body.category;
  delete req.body.transactionNumber;

  const updated = await Transaction.findByIdAndUpdate(
    req.params.id, req.body,
    { new: true, runValidators: true }
  )
    .populate('relatedClient', 'name')
    .populate('relatedStaff',  'name employeeId')
    .populate('relatedOrder',  'orderNumber eventType')
    .populate('createdBy',     'name');

  res.status(200).json({
    success: true,
    message: 'Transaction updated successfully',
    data: { transaction: updated },
  });
});


// -----------------------------------------------
// @DELETE /api/finance/transactions/:id
// @access Admin only
// -----------------------------------------------
exports.deleteTransaction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return next(new AppError('Transaction not found', 404));

  if (transaction.status === 'completed' && transaction.tags?.includes('auto')) {
    return next(new AppError(
      'Cannot delete an auto-generated completed transaction. Cancel it instead.', 400
    ));
  }

  await transaction.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Transaction deleted successfully',
    data: null,
  });
});


// -----------------------------------------------
// @GET /api/finance/cashflow
// @access Admin only — Cashflow Summary
// -----------------------------------------------
exports.getCashflow = catchAsync(async (req, res, next) => {
  const { month, year } = req.query;

  const matchFilter = { status: 'completed' };

  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);
    matchFilter.transactionDate = { $gte: startDate, $lte: endDate };
  }

  const [incomeData, expenseData] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...matchFilter, flowType: 'income' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { ...matchFilter, flowType: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const totalIncome  = incomeData.reduce((s, i) => s + i.total, 0);
  const totalExpense = expenseData.reduce((s, i) => s + i.total, 0);
  const netProfit    = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0
    ? parseFloat(((netProfit / totalIncome) * 100).toFixed(2))
    : 0;

  res.status(200).json({
    success: true,
    data: {
      period: month && year ? `${month}/${year}` : 'All Time',
      summary: {
        totalIncome,
        totalExpense,
        netProfit,
        profitMargin: `${profitMargin}%`,
        status: netProfit >= 0 ? 'profit' : 'loss',
      },
      incomeBreakdown:  incomeData,
      expenseBreakdown: expenseData,
    },
  });
});


// -----------------------------------------------
// @GET /api/finance/report/monthly
// @access Admin only — Month by Month Report
// -----------------------------------------------
exports.getMonthlyReport = catchAsync(async (req, res, next) => {
  const { year = new Date().getFullYear() } = req.query;

  const report = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        transactionDate: {
          $gte: new Date(Number(year), 0, 1),
          $lte: new Date(Number(year), 11, 31, 23, 59, 59),
        },
      },
    },
    {
      $group: {
        _id: {
          month:    { $month: '$transactionDate' },
          flowType: '$flowType',
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthData = report.filter((r) => r._id.month === i + 1);
    const income  = monthData.find((r) => r._id.flowType === 'income')?.total  || 0;
    const expense = monthData.find((r) => r._id.flowType === 'expense')?.total || 0;
    return {
      month:     i + 1,
      monthName: new Date(year, i, 1).toLocaleString('default', { month: 'long' }),
      income,
      expense,
      profit: income - expense,
    };
  });

  const yearSummary = {
    totalIncome:  months.reduce((s, m) => s + m.income, 0),
    totalExpense: months.reduce((s, m) => s + m.expense, 0),
    totalProfit:  months.reduce((s, m) => s + m.profit, 0),
  };

  res.status(200).json({
    success: true,
    data: { year: Number(year), yearSummary, months },
  });
});


// -----------------------------------------------
// @GET /api/finance/report/category
// @access Admin only — Category wise breakdown
// -----------------------------------------------
exports.getCategoryReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, flowType } = req.query;

  const matchFilter = { status: 'completed' };
  if (flowType) matchFilter.flowType = flowType;
  if (startDate || endDate) {
    matchFilter.transactionDate = {};
    if (startDate) matchFilter.transactionDate.$gte = new Date(startDate);
    if (endDate)   matchFilter.transactionDate.$lte = new Date(endDate);
  }

  const report = await Transaction.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id:       { category: '$category', flowType: '$flowType' },
        total:     { $sum: '$amount' },
        count:     { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  res.status(200).json({ success: true, data: { report } });
});


// -----------------------------------------------
// @GET /api/finance/dashboard
// @access Admin only — Full finance overview
// -----------------------------------------------
exports.getFinanceDashboard = catchAsync(async (req, res, next) => {
  const now = new Date();

  const thisMonth = {
    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
    $lte: now,
  };
  const lastMonth = {
    $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    $lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
  };

  const [
    thisMonthIncome,
    thisMonthExpense,
    lastMonthIncome,
    lastMonthExpense,
    recentTransactions,
    pendingTransactions,
    topExpenseCategories,
    topIncomeCategories,
    autoVsManual,
  ] = await Promise.all([
    Transaction.aggregate([
      { $match: { flowType: 'income',  status: 'completed', transactionDate: thisMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { flowType: 'expense', status: 'completed', transactionDate: thisMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { flowType: 'income',  status: 'completed', transactionDate: lastMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { flowType: 'expense', status: 'completed', transactionDate: lastMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),

    // Recent 5 completed transactions
    Transaction.find({ status: 'completed' })
      .sort({ transactionDate: -1 })
      .limit(5)
      .populate('relatedClient', 'name')
      .populate('relatedStaff',  'name')
      .populate('relatedOrder',  'orderNumber eventType')
      .select('transactionNumber flowType category amount paymentMethod transactionDate description tags'),

    // Pending transactions
    Transaction.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('relatedOrder', 'orderNumber eventType')
      .select('transactionNumber flowType category amount description createdAt tags'),

    // Top expense categories this month
    Transaction.aggregate([
      { $match: { flowType: 'expense', status: 'completed', transactionDate: thisMonth } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),

    // Top income categories this month
    Transaction.aggregate([
      { $match: { flowType: 'income', status: 'completed', transactionDate: thisMonth } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),

    // Auto vs Manual count this month
    Transaction.aggregate([
      { $match: { status: 'completed', transactionDate: thisMonth } },
      {
        $group: {
          _id:   { $cond: [{ $in: ['auto', '$tags'] }, 'auto', 'manual'] },
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const curIncome   = thisMonthIncome[0]?.total  || 0;
  const curExpense  = thisMonthExpense[0]?.total  || 0;
  const prevIncome  = lastMonthIncome[0]?.total   || 0;
  const prevExpense = lastMonthExpense[0]?.total   || 0;

  const incomeGrowth  = prevIncome  > 0
    ? parseFloat((((curIncome  - prevIncome)  / prevIncome)  * 100).toFixed(2)) : 0;
  const expenseGrowth = prevExpense > 0
    ? parseFloat((((curExpense - prevExpense) / prevExpense) * 100).toFixed(2)) : 0;

  // Shape auto vs manual
  const autoStats   = autoVsManual.find((r) => r._id === 'auto')   || { count: 0, total: 0 };
  const manualStats = autoVsManual.find((r) => r._id === 'manual') || { count: 0, total: 0 };

  res.status(200).json({
    success: true,
    data: {
      thisMonth: {
        income:        curIncome,
        expense:       curExpense,
        profit:        curIncome - curExpense,
        incomeGrowth:  `${incomeGrowth}%`,
        expenseGrowth: `${expenseGrowth}%`,
      },
      lastMonth: {
        income:  prevIncome,
        expense: prevExpense,
        profit:  prevIncome - prevExpense,
      },
      transactionSources: {
        auto:   { count: autoStats.count,   total: autoStats.total   },
        manual: { count: manualStats.count, total: manualStats.total },
      },
      recentTransactions,
      pendingTransactions,
      topExpenseCategories,
      topIncomeCategories,
    },
  });
});
