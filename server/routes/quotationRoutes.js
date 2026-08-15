const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { generateQuotation } = require('../controllers/quotationController');

router.post('/generate', protect, generateQuotation);

module.exports = router;
