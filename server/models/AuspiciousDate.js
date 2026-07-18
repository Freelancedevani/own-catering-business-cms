// server/models/AuspiciousDate.js
const mongoose = require('mongoose');

const auspiciousDateSchema = new mongoose.Schema(
  {
    // English Date
    englishDate: {
      type: Date,
      required: [true, 'English date is required'],
      unique: true,
      index: true,
    },
    englishMonth: {
      type: String,
      required: true,
      enum: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ],
    },
    englishYear: {
      type: Number,
      required: true,
    },
    englishDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },

    // Bengali Date
    bengaliDate: {
      type: String, // e.g., "১৫ পৌষ ১৪৩১"
      required: [true, 'Bengali date is required'],
    },
    bengaliMonth: {
      type: String,
      required: [true, 'Bengali month name is required'],
      enum: [
        'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র',
        'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ',
        'ফাল্গুন', 'চৈত্র'
      ],
    },
    bengaliYear: {
      type: Number,
      required: [true, 'Bengali year is required'],
    },
    bengaliDay: {
      type: Number,
      required: true,
      min: 1,
      max: 32,
    },

    // Events on this date
    events: [
      {
        type: {
          type: String,
          required: true,
          enum: [
            'biye',
            'annaprashan',
            'mukhebhaat',
            'grihapravesh',
            'namkaran',
            'upanayan',
            'puja',
            'other',
          ],
        },
        label: {
          type: String,
          required: true,
        },
      },
    ],

    isHoliday: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
auspiciousDateSchema.index({ englishYear: 1, englishMonth: 1 });
auspiciousDateSchema.index({ bengaliYear: 1, bengaliMonth: 1 });
auspiciousDateSchema.index({ 'events.type': 1 });

// Virtual: formatted English date
auspiciousDateSchema.virtual('formattedEnglishDate').get(function () {
  return `${this.englishDate.toISOString().split('T')[0]}`;
});

// Virtual: formatted Bengali date string
auspiciousDateSchema.virtual('displayDate').get(function () {
  return {
    english: `${this.englishDay} ${this.englishMonth} ${this.englishYear}`,
    bengali: this.bengaliDate,
  };
});

auspiciousDateSchema.set('toJSON', { virtuals: true });
auspiciousDateSchema.set('toObject', { virtuals: true });

const AuspiciousDate = mongoose.model('AuspiciousDate', auspiciousDateSchema);

module.exports = AuspiciousDate;