// server/routes/auspiciousDateRoutes.js
const express = require('express');
const router = express.Router();
const auspiciousDateController = require('../controllers/auspiciousDateController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  validateCreateAuspiciousDate,
  validateUpdateAuspiciousDate,
  validateGetByMonth,
  validateGetByBengaliMonth,
  validateGetById,
  validateDeleteAuspiciousDate,
  validateBulkCreate,
} = require('../validators/auspiciousDateValidator');

// ============ PUBLIC ROUTES ============

// Get all dates (with optional filters: year, month, eventType, bengaliYear, bengaliMonth)
router.get('/', auspiciousDateController.getAllAuspiciousDates);

// Get by English month (query: year, month)
router.get('/month', validateGetByMonth, auspiciousDateController.getByMonth);

// Get by Bengali month (query: bengaliYear, bengaliMonth)
router.get('/bengali-month', validateGetByBengaliMonth, auspiciousDateController.getByBengaliMonth);

// Get yearly summary
router.get('/summary/:year', auspiciousDateController.getYearlySummary);

// Get single date by ID
router.get('/:id', validateGetById, auspiciousDateController.getAuspiciousDateById);

// ============ ADMIN ROUTES ============

// Create single date
router.post(
  '/',
  protect,
  adminOnly,
  validateCreateAuspiciousDate,
  auspiciousDateController.createAuspiciousDate
);

// Bulk create dates
router.post(
  '/bulk',
  protect,
  adminOnly,
  validateBulkCreate,
  auspiciousDateController.bulkCreateAuspiciousDates
);

// Update date
router.put(
  '/:id',
  protect,
  adminOnly,
  validateUpdateAuspiciousDate,
  auspiciousDateController.updateAuspiciousDate
);

// Delete date
router.delete(
  '/:id',
  protect,
  adminOnly,
  validateDeleteAuspiciousDate,
  auspiciousDateController.deleteAuspiciousDate
);

module.exports = router;