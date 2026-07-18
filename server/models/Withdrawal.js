const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  // Auto-generated reference number
  referenceNumber: {
    type: String,
    unique: true,
  },

  // Relations
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff member is required'],
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // Withdrawal Details
  type: {
    type: String,
    required: [true, 'Withdrawal type is required'],
    enum: [
      'salary',        // monthly/weekly salary payment
      'advance',       // salary advance
      'bonus',         // performance bonus
      'reimbursement', // expense reimbursement
      'overtime',      // extra hours pay
      'incentive',     // event-based incentive
      'other',
    ],
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1'],
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['cash', 'bank_transfer', 'upi', 'cheque'],
  },
  paymentReference: {
    type: String,
    trim: true, // UPI txn ID / cheque number / transfer ref
  },

  // For salary type — which period
  forMonth: {
    type: Number,
    min: 1, max: 12,
  },
  forYear: {
    type: Number,
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  paidAt: {
    type: Date,
  },

  // Notes
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },
}, { timestamps: true });

// ── Auto-generate reference number ──
withdrawalSchema.pre('save', async function () {
  if (!this.referenceNumber) {
    const count = await mongoose.model('Withdrawal').countDocuments();
    const date = new Date();
    const yr  = date.getFullYear().toString().slice(-2);
    const mon = String(date.getMonth() + 1).padStart(2, '0');
    this.referenceNumber = `WD-${yr}${mon}-${String(count + 1).padStart(4, '0')}`;
    // e.g. WD-2603-0001
  }
});

// Indexes
withdrawalSchema.index({ staff: 1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ type: 1 });
withdrawalSchema.index({ createdAt: -1 });
withdrawalSchema.index({ forMonth: 1, forYear: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
