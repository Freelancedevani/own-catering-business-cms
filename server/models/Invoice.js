const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },

  order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

  // Snapshot from Order at time of generation
  items: [{
    name:       { type: String, required: true },
    description: { type: String },
    quantity:   { type: Number, required: true },
    unit:       { type: String, default: 'plate' },
    unitPrice:  { type: Number, required: true },
    total:      { type: Number, required: true },
  }],

  eventType:     { type: String },
  eventDate:     { type: Date },
  venue:         { type: Object },
  guestCount:    { type: Number },

  subtotal:       { type: Number, default: 0 },
  discountType:   { type: String, default: 'none' },
  discountValue:  { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxRate:        { type: Number, default: 0 },
  taxAmount:      { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  totalAmount:    { type: Number, default: 0 },

  // Payment snapshot
  paidAmount:    { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid',
  },
  payments: [{
    amount:           Number,
    paymentMethod:    String,
    paymentReference: String,
    paidAt:           Date,
    notes:            String,
  }],

  // Invoice meta
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft',
  },
  dueDate:       { type: Date },
  notes:         { type: String },
  companyInfo: {
    name:    { type: String },
    address: { type: String },
    phone:   { type: String },
    email:   { type: String },
    gstin:   { type: String },
    logo:    { type: String },
  },

  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  regenerated:  { type: Boolean, default: false },
}, { timestamps: true });

// Auto invoice number
// ✅ CORRECT — just return, no next() needed
invoiceSchema.pre('validate', async function () {
  if (!this.invoiceNumber) {
    const now    = new Date();
    const mm     = String(now.getMonth() + 1).padStart(2, '0');
    const yy     = String(now.getFullYear()).slice(2);
    const prefix = `INV-${yy}${mm}`;
    const last   = await mongoose.model('Invoice')
      .findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
      .sort({ invoiceNumber: -1 });
    const seq = last ? parseInt(last.invoiceNumber.split('-').pop()) + 1 : 1;
    this.invoiceNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
  }
  // No next() — async hooks in Mongoose resolve on return
});


module.exports = mongoose.model('Invoice', invoiceSchema);
