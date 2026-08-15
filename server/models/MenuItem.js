const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },

    category: { type: String, required: true, trim: true, lowercase: true },

    unit: { type: String, required: true, trim: true },

    pricePerUnit: { type: Number, required: true, min: 0, default: 0 },

    notes: { type: String, trim: true, default: '' },

    isActive: { type: Boolean, default: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate code: MENU-001, MENU-002 …
menuItemSchema.pre('save', async function () {
  if (!this.code) {
    const last = await this.constructor
      .findOne({ code: /^MENU-/ })
      .sort({ code: -1 })
      .select('code');
    const seq = last ? parseInt(last.code.split('-')[1] || '0') + 1 : 1;
    this.code = `MENU-${String(seq).padStart(3, '0')}`;
  }
});

module.exports = mongoose.model('MenuItem', menuItemSchema, 'menuitems');
