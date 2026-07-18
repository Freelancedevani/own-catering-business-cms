const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Auto-generated transaction number
  transactionNumber: {
    type: String,
    unique: true,
  },

  // Type
  flowType: {
    type: String,
    required: [true, 'Flow type is required'],
    enum: ['income', 'expense'],
  },

  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      // Income categories
      'order_payment',      // payment received from client order
      'advance_payment',    // advance from client
      'refund_received',    // refund from vendor
      'other_income',

      // Expense categories
      'staff_salary',       // links to withdrawal
      'raw_material',       // groceries, vegetables, spices
      'equipment',          // kitchen equipment purchase
      'vehicle_fuel',       // delivery fuel
      'venue_rental',       // event venue cost
      'utilities',          // electricity, gas, water
      'marketing',          // ads, printing
      'maintenance',        // repairs
      'tax_payment',        // GST, income tax
      'miscellaneous',      // other expenses
    ],
  },

  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1'],
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },

  // Payment details
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'online'],
  },
  paymentReference: {
    type: String,
    trim: true, // UPI txn ID / cheque no / bank ref
  },

  // Date of actual transaction (can differ from createdAt)
  transactionDate: {
    type: Date,
    required: [true, 'Transaction date is required'],
    default: Date.now,
  },

  // Relations (all optional — for auto-linking)
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  relatedClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
  },
  relatedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null,
  },
  relatedWithdrawal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal',
    default: null,
  },

  // Status
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed',
  },

  // Tax
  gstApplicable: { type: Boolean, default: false },
  gstRate:       { type: Number, default: 0 },  // percentage
  gstAmount:     { type: Number, default: 0 },

  // Attachments (receipts, invoices)
  attachments: [{
    name: { type: String, trim: true },
    url:  { type: String, trim: true },
  }],

  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  adminNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },

  tags: {
    type: [String],
    default: [],
  },
}, { timestamps: true });

// ── Auto-generate transaction number ──
transactionSchema.pre('save', async function () {
  if (!this.transactionNumber) {
    const count = await mongoose.model('Transaction').countDocuments();
    const date  = new Date();
    const yr    = date.getFullYear().toString().slice(-2);
    const mon   = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = this.flowType === 'income' ? 'INC' : 'EXP';
    this.transactionNumber = `${prefix}-${yr}${mon}-${String(count + 1).padStart(4, '0')}`;
    // e.g. INC-2603-0001 / EXP-2603-0001
  }
});

// ── Auto-calculate GST amount ──
transactionSchema.pre('save', function () {
  if (this.gstApplicable && this.gstRate > 0) {
    this.gstAmount = parseFloat(((this.amount * this.gstRate) / 100).toFixed(2));
  } else {
    this.gstAmount = 0;
  }
});

// Indexes
transactionSchema.index({ flowType: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ relatedOrder: 1 });
transactionSchema.index({ relatedStaff: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
