const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { mobileAuthMiddleware } = require('../middleware/mobileAuthMiddleware');

const {
  getOrders,
  getOrderStats,
  getOrderById,
  getMyOrders,
  getMyOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  addPayment,
  assignStaff,
  removeStaff,
  deleteOrder,
  getOrderExpenses,
  addOrderExpense,
  deleteOrderExpense,
} = require('../controllers/orderController');

const {
  createOrderValidator,
  updateOrderValidator,
  addPaymentValidator,
  updateStatusValidator,
} = require('../validators/orderValidator');


// mobile routes 
//  get orders that assigned to staff based on staff id
router.get('/mobile/my-orders', mobileAuthMiddleware, getMyOrders);
router.get('/mobile/my-orders/:id', mobileAuthMiddleware, getMyOrderById);

// ── Apply auth to all routes ──
router.use(protect, adminOnly);

// ── Stats (must be BEFORE /:id to avoid conflict) ──
router.get('/stats', getOrderStats);

// ── Core CRUD ──
router.get   ('/',    getOrders);
router.post  ('/',    createOrderValidator, createOrder);
router.get   ('/:id', getOrderById);
router.put   ('/:id', updateOrderValidator, updateOrder);
router.delete('/:id', deleteOrder);

// ── Status ──
router.patch('/:id/status', updateStatusValidator, updateOrderStatus);

// ── Payment ──
router.post('/:id/payment', addPaymentValidator, addPayment);

// ── Staff ──
router.post  ('/:id/staff',           assignStaff);
router.delete('/:id/staff/:staffId',  removeStaff);

// ── Expenses (NEW) ──
router.get   ('/:id/expenses',             getOrderExpenses);
router.post  ('/:id/expenses',             addOrderExpense);
router.delete('/:id/expenses/:expenseId',  deleteOrderExpense);




module.exports = router;
