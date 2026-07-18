// server/routes/staffWalletRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getWallet, creditWallet, requestWithdrawal,
  getWalletSummary, creditOrderFees,
  getMobileWalletSummary, mobileRequestWithdrawal,
} = require('../controllers/staffWalletController');
const { creditValidator, withdrawalValidator } = require('../validators/staffWalletValidator');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { mobileAuthMiddleware } = require('../middleware/mobileAuthMiddleware');

// Mobile routes for staff withdrawal requests
router.get ('/mobile/summary',  mobileAuthMiddleware, getMobileWalletSummary);
router.post('/mobile/withdraw', mobileAuthMiddleware, mobileRequestWithdrawal);

router.use(protect, adminOnly);

router.get  ('/summary',              getWalletSummary);
router.post ('/order/:orderId/credit-fees', creditOrderFees);  // moved from orderRoutes

router.get  ('/:staffId',             getWallet);
router.post ('/:staffId/credit',      creditValidator,     creditWallet);
router.post ('/:staffId/withdraw',    withdrawalValidator, requestWithdrawal);

module.exports = router;
