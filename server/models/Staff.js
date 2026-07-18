const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const documentSchema = new mongoose.Schema({
  type:     { type: String, trim: true },
  url:      { type: String, trim: true },
  publicId: { type: String, trim: true },
  verified: { type: Boolean, default: false },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  date:   { type: Date, required: true },
  status: {
    type:    String,
    enum:    ['present', 'absent', 'half_day', 'leave'],
    default: 'present',
  },
  note: { type: String, trim: true },
}, { _id: false });

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  name: {
    type:      String,
    required:  [true, 'Staff name is required'],
    trim:      true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },

  email: {
    type:      String,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    sparse:    true,
  },

  phone:          { type: String, required: [true, 'Phone number is required'], trim: true },
  alternatePhone: { type: String, trim: true },
  dateOfBirth:    { type: Date },
  gender:         { type: String, enum: ['male', 'female', 'other'] },

  address: {
    street:  { type: String, trim: true },
    city:    { type: String, trim: true },
    state:   { type: String, trim: true },
    pincode: { type: String, trim: true },
  },

  profilePic: {
    url:      { type: String, default: '' },
    publicId: { type: String, default: '' },
  },

  password: {
    type:      String,
    minlength: [6, 'Password must be at least 6 characters'],
    select:    false,
  },

  role: {
    type:     String,
    required: [true, 'Staff role is required'],
    enum: [
      'chef', 'assistant_chef', 'waiter', 'supervisor',
      'driver', 'cleaner', 'manager', 'accountant',
      'delivery_boy', 'helper', 'other',
    ],
  },

  department: {
    type: String,
    enum: ['kitchen', 'service', 'delivery', 'management', 'accounts', 'other'],
  },

  employeeId:  { type: String, unique: true, sparse: true },
  joiningDate: { type: Date, default: Date.now },
  leavingDate: { type: Date },

  salaryType: {
    type:     String,
    enum:     ['monthly', 'daily', 'hourly', 'per_event'],
    required: [true, 'Salary type is required'],
  },

  salaryAmount: {
    type:     Number,
    required: [true, 'Salary amount is required'],
    min:      [0, 'Salary cannot be negative'],
  },

  bankDetails: {
    accountName:   { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName:      { type: String, trim: true },
    ifscCode:      { type: String, trim: true, uppercase: true },
    upiId:         { type: String, trim: true },
  },

  status: {
    type:    String,
    enum:    ['active', 'inactive', 'on_leave', 'terminated'],
    default: 'active',
  },

  documents:  [documentSchema],
  attendance: [attendanceSchema],

  totalEarned:    { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },

  adminNotes: {
    type:      String,
    trim:      true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
  },

  fcmToken: { type: String, default: null },

}, { timestamps: true });

// ─── Pre-save hook ────────────────────────────
// ✅ async hook WITHOUT next() — correct Mongoose pattern
staffSchema.pre('save', async function () {
  if (!this.employeeId) {
    const count = await mongoose.model('Staff').countDocuments();
    this.employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
  }

  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

// ─── Instance method ──────────────────────────
staffSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ─── Indexes ──────────────────────────────────
staffSchema.index({ status:     1 });
staffSchema.index({ role:       1 });
staffSchema.index({ employeeId: 1 });
staffSchema.index({ phone:      1 });
staffSchema.index({ email:      1 });

module.exports = mongoose.model('Staff', staffSchema);