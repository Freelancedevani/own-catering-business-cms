const express = require('express');
const router  = express.Router();
const {
  createWithdrawal,
  getAllWithdrawals,
  getWithdrawalById,
  updateWithdrawalStatus,
  deleteWithdrawal,
  getStaffWithdrawals,
  getWithdrawalStats,
} = require('../controllers/withdrawalController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createWithdrawalValidator,
  updateWithdrawalStatusValidator,
} = require('../validators/withdrawalValidator');

router.use(protect, adminOnly);

router.get('/stats',            getWithdrawalStats);
router.get('/staff/:staffId',   getStaffWithdrawals);

router.route('/')
  .get(getAllWithdrawals)
  .post(createWithdrawalValidator, createWithdrawal);

router.route('/:id')
  .get(getWithdrawalById)
  .delete(deleteWithdrawal);

router.patch('/:id/status', updateWithdrawalStatusValidator, updateWithdrawalStatus);

module.exports = router;
