const express = require('express');
const router  = express.Router();
const {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getCashflow,
  getMonthlyReport,
  getCategoryReport,
  getFinanceDashboard,
} = require('../controllers/financeController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createTransactionValidator,
  updateTransactionValidator,
} = require('../validators/financeValidator');

// All finance routes — Admin only
router.use(protect, adminOnly);

// Dashboard & Reports
router.get('/dashboard',        getFinanceDashboard);
router.get('/cashflow',         getCashflow);
router.get('/report/monthly',   getMonthlyReport);
router.get('/report/category',  getCategoryReport);

// Transactions CRUD
router.route('/transactions')
  .get(getAllTransactions)
  .post(createTransactionValidator, createTransaction);

router.route('/transactions/:id')
  .get(getTransactionById)
  .put(updateTransactionValidator, updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
