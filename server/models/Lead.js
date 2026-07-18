const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Customer info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },

  // Event info
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    enum: [
      'wedding',
      'corporate',
      'birthday',
      'anniversary',
      'social_gathering',
      'funeral',
      'other',
      'product_launch',
      'baby_shower',
      'reception',
      'engagement',
      'conference',
    ],
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  followUpDate: {
    type: Date,
  }, 
  guestCount: {
    type: Number,
    required: [true, 'Guest count is required'],
    min: [1, 'Guest count must be at least 1'],
    max: [100000, 'Guest count cannot exceed 100000'],
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true,
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative'],
  },
  message: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
  },

  // Lead management
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
    default: 'new',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // admin user
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
  },
  source: {
    type: String,
    enum: ['website', 'phone', 'referral', 'social_media', 'walk_in', 'other'],
    default: 'website',
  },
  convertedToOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order', // will link later in Phase 3
  },
}, { timestamps: true });

// Index for faster queries
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ email: 1 });
leadSchema.index({ eventDate: 1 });

module.exports = mongoose.model('Lead', leadSchema);
