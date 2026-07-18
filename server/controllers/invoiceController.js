const Invoice = require('../models/Invoice');
const Order   = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');

// ── Generate invoice from an Order ──
// POST /api/invoices/generate/:orderId
exports.generateInvoice = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId)
    .populate('client', 'name email phone address');

  if (!order) return next(new AppError('Order not found', 404));

  // Check if a non-cancelled invoice already exists for this order
  const existing = await Invoice.findOne({
    order: order._id,
    status: { $ne: 'cancelled' },
  });

  // If exists and regenerate=false, return existing
  if (existing && !req.body.regenerate) {
    await existing.populate('client', 'name email phone address');
    return res.status(200).json({
      success: true,
      message: 'Existing invoice returned',
      data: { invoice: existing },
    });
  }

  // Cancel old if regenerating
  if (existing && req.body.regenerate) {
    existing.status = 'cancelled';
    await existing.save();
  }

  // Build items snapshot from order
  const items = order.items.map((i) => ({
    name:       i.name,
    description: i.description || '',
    quantity:   i.quantity,
    unit:       i.unit || 'plate',
    unitPrice:  i.price,
    total:      i.totalPrice || i.quantity * i.price,
  }));

  const dueDate = req.body.dueDate
    ? new Date(req.body.dueDate)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days

  const invoice = await Invoice.create({
    order:         order._id,
    client:        order.client._id,
    items,
    eventType:     order.eventType,
    eventDate:     order.eventDate,
    venue:         order.venue,
    guestCount:    order.guestCount,
    subtotal:       order.subtotal,
    discountType:   order.discountType,
    discountValue:  order.discountValue,
    discountAmount: order.discountAmount,
    taxRate:        order.taxRate,
    taxAmount:      order.taxAmount,
    deliveryCharge: order.deliveryCharge,
    totalAmount:    order.totalAmount,
    paidAmount:     order.paidAmount,
    balanceAmount:  order.balanceAmount,
    paymentStatus:  order.paymentStatus,
    payments:       order.payments,
    dueDate,
    notes:          req.body.notes || order.specialInstructions || '',
    companyInfo:    req.body.companyInfo || {},
    status:         'draft',
    regenerated:    !!existing,
    createdBy:      req.user.id,
  });

  await invoice.populate('client', 'name email phone address');

  res.status(201).json({
    success: true,
    message: 'Invoice generated successfully',
    data: { invoice },
  });
});

// ── Get all invoices ──
// GET /api/invoices
exports.getAllInvoices = catchAsync(async (req, res) => {
  const {
    page = 1, limit = 10,
    status, paymentStatus,
    search,
  } = req.query;

  const filter = {};
  if (status)        filter.status        = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Invoice.countDocuments(filter);

  const invoices = await Invoice.find(filter)
    .populate('client', 'name phone email')
    .populate('order',  'orderNumber eventType eventDate')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.status(200).json({
    success: true,
    data: {
      invoices,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// ── Get single invoice ──
// GET /api/invoices/:id
exports.getInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('client', 'name email phone address')
    .populate('order',  'orderNumber eventType eventDate status');

  if (!invoice) return next(new AppError('Invoice not found', 404));
  res.status(200).json({ success: true, data: { invoice } });
});

// ── Get invoice by Order ID ──
// GET /api/invoices/by-order/:orderId
exports.getInvoiceByOrder = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findOne({
    order:  req.params.orderId,
    status: { $ne: 'cancelled' },
  })
    .populate('client', 'name email phone address')
    .populate('order',  'orderNumber eventType eventDate status');

  if (!invoice) return next(new AppError('No invoice found for this order', 404));
  res.status(200).json({ success: true, data: { invoice } });
});

// ── Update invoice status / notes ──
// PATCH /api/invoices/:id
exports.updateInvoice = catchAsync(async (req, res, next) => {
  const allowed = ['status', 'notes', 'dueDate', 'companyInfo'];
  const update  = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

  const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, {
    new: true, runValidators: true,
  }).populate('client', 'name email phone address');

  if (!invoice) return next(new AppError('Invoice not found', 404));
  res.status(200).json({ success: true, data: { invoice } });
});

// ── Sync invoice with latest order data ──
// POST /api/invoices/:id/sync
exports.syncInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return next(new AppError('Invoice not found', 404));

  const order = await Order.findById(invoice.order)
    .populate('client', 'name email phone address');
  if (!order) return next(new AppError('Order not found', 404));

  invoice.items          = order.items.map((i) => ({
    name: i.name, description: i.description || '',
    quantity: i.quantity, unit: i.unit || 'plate',
    unitPrice: i.price, total: i.totalPrice || i.quantity * i.price,
  }));
  invoice.subtotal       = order.subtotal;
  invoice.discountType   = order.discountType;
  invoice.discountValue  = order.discountValue;
  invoice.discountAmount = order.discountAmount;
  invoice.taxRate        = order.taxRate;
  invoice.taxAmount      = order.taxAmount;
  invoice.deliveryCharge = order.deliveryCharge;
  invoice.totalAmount    = order.totalAmount;
  invoice.paidAmount     = order.paidAmount;
  invoice.balanceAmount  = order.balanceAmount;
  invoice.paymentStatus  = order.paymentStatus;
  invoice.payments       = order.payments;

  await invoice.save();
  await invoice.populate('client', 'name email phone address');

  res.status(200).json({
    success: true,
    message: 'Invoice synced with latest order data',
    data: { invoice },
  });
});

// ── Delete invoice ──
// DELETE /api/invoices/:id
exports.deleteInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findByIdAndDelete(req.params.id);
  if (!invoice) return next(new AppError('Invoice not found', 404));
  res.status(200).json({ success: true, message: 'Invoice deleted', data: null });
});
