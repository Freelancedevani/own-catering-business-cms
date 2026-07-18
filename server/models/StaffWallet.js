const mongoose = require('mongoose');

const staffWalletSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  type: {
    type: String,
    enum: ['credit', 'debit', 'adjustment'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
  source: {
    type: String,
    enum: ['order_fee', 'monthly_salary', 'bonus', 'advance', 'withdrawal', 'penalty', 'adjustment'],
    required: true,
  },
  // Reference to the order if credit came from an order
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved', // credits auto-approved; withdrawals start pending
  },
  // Running balance snapshot after this transaction
  balanceAfter: { type: Number, default: 0 },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date },
  rejectedReason: { type: String, trim: true },

}, { timestamps: true });

staffWalletSchema.index({ staff: 1, createdAt: -1 });
staffWalletSchema.index({ staff: 1, type: 1 });
staffWalletSchema.index({ order: 1 });
staffWalletSchema.index({ status: 1 });

module.exports = mongoose.model('StaffWallet', staffWalletSchema);
