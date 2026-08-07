const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['starter', 'maincourse', 'dessert'],
      default: 'maincourse',
    },
    unit: {
      type: String,
      enum: ['piece', 'gram', 'kg', 'litre', 'ml'],
      default: 'piece',
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Keep collection name as 'ingredientprices' to avoid data loss
module.exports = mongoose.model('MenuItem', menuItemSchema, 'menuitems');
