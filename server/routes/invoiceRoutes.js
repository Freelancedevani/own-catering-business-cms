const express    = require('express');
const router     = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  generateInvoice,
  getAllInvoices,
  getInvoice,
  getInvoiceByOrder,
  updateInvoice,
  syncInvoice,
  deleteInvoice,
} = require('../controllers/invoiceController');

router.use(protect);

router.get('/',                    getAllInvoices);
router.get('/by-order/:orderId',   getInvoiceByOrder);
router.get('/:id',                 getInvoice);
router.post('/generate/:orderId',  generateInvoice);
router.patch('/:id',               updateInvoice);
router.post('/:id/sync',           syncInvoice);
router.delete('/:id', adminOnly,   deleteInvoice);

module.exports = router;
