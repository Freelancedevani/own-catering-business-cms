const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const RefreshToken = require('../models/RefreshToken.model');

const ACCESS_TTL         = '15m';
const REFRESH_TTL_DAYS   = 30;
const REFRESH_TTL_MS     = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────
const createJti = () => crypto.randomBytes(16).toString('hex');

const signAccess = (staff) =>
  jwt.sign(
    { id: staff._id, role: 'staff', employeeId: staff.employeeId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );

const signRefresh = (staffId, jti) =>
  jwt.sign({ id: staffId, jti }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: `${REFRESH_TTL_DAYS}d`,
  });

const persistRefreshToken = async ({ staff, rawToken, jti, ip, userAgent }) => {
  await RefreshToken.create({
    staff:     staff._id,
    tokenHash: RefreshToken.hash(rawToken),
    jti,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    ip,
    userAgent,
  });
};

// ── Main: issue both tokens ───────────────────────────
const issueTokens = async (staff, req) => {
  const accessToken  = signAccess(staff);
  const jti          = createJti();
  const refreshToken = signRefresh(staff._id, jti);
  await persistRefreshToken({
    staff,
    rawToken:  refreshToken,
    jti,
    ip:        req.ip,
    userAgent: req.headers['user-agent'] || '',
  });
  return { accessToken, refreshToken };
};

// ── Rotate: revoke old, issue new ────────────────────
const rotateRefreshToken = async (oldDoc, staff, req) => {
  const newJti          = createJti();
  const newRefreshToken = signRefresh(staff._id, newJti);
  const newAccessToken  = signAccess(staff);

  // Mark old token as revoked and record successor
  oldDoc.revokedAt   = new Date();
  oldDoc.replacedBy  = newJti;
  await oldDoc.save();

  await persistRefreshToken({
    staff,
    rawToken:  newRefreshToken,
    jti:       newJti,
    ip:        req.ip,
    userAgent: req.headers['user-agent'] || '',
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

module.exports = { signAccess, issueTokens, rotateRefreshToken };