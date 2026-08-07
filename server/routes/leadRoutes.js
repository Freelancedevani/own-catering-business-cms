const express = require('express');
const router = express.Router();
const {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
} = require('../controllers/leadController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createLeadValidator,
  updateLeadValidator,
  updateLeadStatusValidator,
} = require('../validators/leadValidator');

// Public - anyone can submit inquiry
router.post('/', createLeadValidator, createLead);

// Admin only routes
router.use(protect, adminOnly);
router.get('/stats', getLeadStats);
router.get('/', getAllLeads);
router.get('/:id', getLeadById);
router.put('/:id', updateLeadValidator, updateLead);
router.patch('/:id/status', updateLeadStatusValidator, updateLeadStatus);
router.delete('/:id', deleteLead);

module.exports = router;
