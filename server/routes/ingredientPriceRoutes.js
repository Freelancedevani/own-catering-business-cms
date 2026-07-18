// server/routes/ingredientPriceRoutes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createIngredientValidator,
  updateIngredientValidator,
} = require('../validators/ingredientPriceValidator');
const {
  getAllIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} = require('../controllers/ingredientPriceController');

// Public (authenticated) — frontend calculator fetches this
router.get('/', protect, getAllIngredients);
router.get('/:id', protect, getIngredient);

// Admin only — manage pricing
router.post('/', protect, adminOnly, createIngredientValidator, createIngredient);
router.patch('/:id', protect, adminOnly, updateIngredientValidator, updateIngredient);
router.delete('/:id', protect, adminOnly, deleteIngredient);

module.exports = router;
