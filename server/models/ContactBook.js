const mongoose = require('mongoose');

const contactBookSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
    unique: true,
  },
  source: {
    type: String,
    enum: ['lead', 'client', 'staff', 'manual'],
    default: 'manual',
  },
  sourceRef: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  address: {
    street:  { type: String, trim: true, default: null },
    city:    { type: String, trim: true, default: null },
    state:   { type: String, trim: true, default: null },
    pincode: { type: String, trim: true, default: null },
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
  },
}, { timestamps: true });

contactBookSchema.index({ phone: 1 });
contactBookSchema.index({ source: 1 });

module.exports = mongoose.model('ContactBook', contactBookSchema);
