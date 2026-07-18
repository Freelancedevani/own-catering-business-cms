// server/models/IngredientPrice.js
const mongoose = require('mongoose');

const ingredientPriceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // e.g., "Vetki", "Rice", "Chicken"
    },
    category: {
      type: String,
      enum: ['fish', 'meat', 'vegetable', 'grain', 'dairy', 'spice', 'other'],
      default: 'other',
    },
    unit: {
      type: String,
      enum: ['piece', 'gram', 'kg', 'litre', 'ml'],
      required: true, // e.g., "piece" for Vetki, "kg" for Rice
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0, // price in ₹ per unit
    },
    notes: {
      type: String,
      trim: true, // e.g., "Market rate, updated weekly"
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

module.exports = mongoose.model('IngredientPrice', ingredientPriceSchema);
