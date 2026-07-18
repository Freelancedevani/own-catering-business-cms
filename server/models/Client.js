const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street:  { type: String, trim: true },
  city:    { type: String, trim: true },
  state:   { type: String, trim: true },
  pincode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
}, { _id: false });

const clientSchema = new mongoose.Schema({
  // Link to auth user (optional — admin can create clients manually too)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Basic Info
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  alternatePhone: {
    type: String,
    trim: true,
  },
  company: {
    type: String,
    trim: true, // for corporate clients
  },

  // Address
  billingAddress: addressSchema,
  eventAddress:   addressSchema,

  // Preferences
  dietaryPreferences: {
    type: [String],
    enum: ['veg', 'non-veg', 'vegan', 'jain', 'gluten-free', 'halal'],
    default: [],
  },
  cuisinePreferences: {
    type: [String],
    default: [],
  },
  specialRequirements: {
    type: String,
    trim: true,
    maxlength: [1000, 'Cannot exceed 1000 characters'],
  },

  // Business Info
  clientType: {
    type: String,
    enum: ['individual', 'corporate', 'ngo', 'government','business' ,'other'],
    default: 'individual',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active',
  },
  source: {
    type: String,
    enum: ['lead_conversion', 'direct', 'referral', 'social_media', 'other'],
    default: 'direct',
  },
  convertedFromLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null,
  },

  // Stats (auto-updated)
  totalOrders: { type: Number, default: 0 },
  totalSpent:  { type: Number, default: 0 },
  lastOrderDate: { type: Date },

  // Admin
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
  },
  tags: {
    type: [String],
    default: [], // e.g. ['vip', 'repeat', 'corporate']
  },
}, { timestamps: true });

// Indexes
clientSchema.index({ email: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ clientType: 1 });
clientSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Client', clientSchema);
