const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  quantity:    { type: Number, required: true, min: 1 },
  unit:        { type: String, default: 'plate' },
  price:       { type: Number, required: true, min: 0 },
  totalPrice:  { type: Number },
}, { _id: true });

const paymentSchema = new mongoose.Schema({
  amount:           { type: Number, required: true },
  paymentMethod:    {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'online'],
    required: true,
  },
  paymentReference: { type: String },
  paidAt:           { type: Date, default: Date.now },
  notes:            { type: String },
}, { _id: true });

const assignedStaffSchema = new mongoose.Schema({
  staff:      { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  role:       { type: String },
  reportTime: { type: String },
  fee:        { type: Number, default: 0 },
}, { _id: true });

// ── NEW: Order Expense subdocument ──
const orderExpenseSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: [
      'food_raw_material', 'decoration', 'equipment_rental',
      'vehicle_fuel', 'venue_rental', 'staff_salary',
      'utilities', 'marketing', 'miscellaneous',
    ],
    required: true,
  },
  description:      { type: String },
  amount:           { type: Number, required: true, min: 0.01 },
  paymentMethod:    {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'online'],
    default: 'cash',
  },
  paymentReference: { type: String },
  vendor:           { type: String },
  date:             { type: Date, default: Date.now },
  addedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

const orderSchema = new mongoose.Schema({
  // ── Identity ──
  orderNumber: { type: String, unique: true },

  // ── Client ──
  client: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Client',
    required: true,
  },

  // ── Event Details ──
  eventType: {
    type: String,
    enum: [
      'wedding', 'reception', 'engagement', 'birthday', 'anniversary','riceceremony',
      'corporate', 'conference', 'product_launch', 'social_gathering',
      'baby_shower', 'funeral', 'other',
    ],
    required: true,
  },
  eventDate:     { type: Date,   required: true },
  eventTime:     { type: String },
  eventDuration: { type: Number, default: 4 },
  venue: {
    name:    { type: String },
    address: { type: String },
    city:    { type: String },
    pincode: { type: String },
  },
  guestCount: { type: Number, required: true, min: 1 },

  // ── Menu / Items ──
  items: [orderItemSchema],

  // ── Pricing ──
  subtotal:       { type: Number, default: 0 },
  discountType:   { type: String, enum: ['percentage', 'fixed', 'none'], default: 'none' },
  discountValue:  { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxRate:        { type: Number, default: 0 },
  taxAmount:      { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  totalAmount:    { type: Number, default: 0 },
  balanceAmount:  { type: Number, default: 0 },

  // ── Payments ──
  payments:      [paymentSchema],
  paidAmount:    { type: Number, default: 0 },
  paymentStatus: {
    type:    String,
    enum:    ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid',
  },

  // ── Staff ──
  assignedStaff: [assignedStaffSchema],

  // ── Expenses (NEW) ──
  expenses: [orderExpenseSchema],

  // ── Status ──
  status: {
    type:    String,
    enum:    ['inquiry', 'quoted', 'confirmed', 'planning', 'ready', 'in_progress', 'completed', 'cancelled'],
    default: 'inquiry',
  },

  // ── Source ──
  source:      { type: String, enum: ['lead', 'direct', 'referral', 'website', 'other'], default: 'direct' },
  relatedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },

  // ── Notes ──
  specialInstructions: { type: String },
  customerNotes:       { type: String },
  adminNotes:          { type: String },

  // ── Tags ──
  tags: [{ type: String }],

  // ── Cancellation ──
  cancelReason: { type: String },
  cancelledAt:  { type: Date },

  // ── Timestamps ──
  confirmedAt: { type: Date },
  completedAt: { type: Date },

}, { timestamps: true });

// ── Single pre-save hook ──
orderSchema.pre('save', async function () {
  // 1. Item totals
  this.items.forEach((item) => {
    item.totalPrice = item.quantity * item.price;
  });

  // 2. Subtotal
  this.subtotal = this.items.reduce((s, i) => s + (i.totalPrice || 0), 0);

  // 3. Discount
  if (this.discountType === 'fixed') {
    this.discountAmount = this.discountValue || 0;
  } else if (this.discountType === 'percentage') {
    this.discountAmount = (this.subtotal * (this.discountValue || 0)) / 100;
  } else {
    this.discountAmount = 0;
  }

  const afterDiscount = this.subtotal - this.discountAmount;

  // 4. Tax
  this.taxAmount = this.taxRate > 0 ? (afterDiscount * this.taxRate) / 100 : 0;

  // 5. Total
  this.totalAmount = afterDiscount + this.taxAmount + (this.deliveryCharge || 0);

  // 6. Paid & Balance
  this.paidAmount    = this.payments.reduce((s, p) => s + p.amount, 0);
  this.balanceAmount = this.totalAmount - this.paidAmount;

  // 7. Payment Status
  if (this.paidAmount <= 0) {
    this.paymentStatus = 'unpaid';
  } else if (this.paidAmount >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }

  // 8. Auto Order Number
  if (!this.orderNumber) {
    const now    = new Date();
    const mm     = String(now.getMonth() + 1).padStart(2, '0');
    const yy     = String(now.getFullYear()).slice(2);
    const prefix = `ORD-${yy}${mm}`;
    const last   = await this.constructor
      .findOne({ orderNumber: new RegExp(`^${prefix}`) })
      .sort({ orderNumber: -1 });
    const seq    = last ? parseInt(last.orderNumber.split('-').pop()) + 1 : 1;
    this.orderNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
  }
});

orderSchema.index({ client: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ eventDate: 1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', orderSchema);
