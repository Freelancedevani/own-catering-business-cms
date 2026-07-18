const mongoose = require('mongoose');
const crypto   = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
  staff:          { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  tokenHash:      { type: String, required: true, unique: true },   // SHA-256 of raw token
  jti:            { type: String, required: true, index: true },     // unique token id
  replacedBy:     { type: String, default: null },                   // jti of successor (rotation chain)
  revokedAt:      { type: Date,   default: null },
  expiresAt:      { type: Date,   required: true },
  ip:             { type: String },
  userAgent:      { type: String },
}, { timestamps: true });

// Virtuals for easy status checks
refreshTokenSchema.virtual('isExpired').get(function () {
  return Date.now() >= this.expiresAt.getTime();
});
refreshTokenSchema.virtual('isActive').get(function () {
  return !this.revokedAt && !this.isExpired;
});

// Static: hash a raw token
refreshTokenSchema.statics.hash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);