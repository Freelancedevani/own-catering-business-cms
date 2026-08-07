const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { createMenuValidator, updateMenuValidator } = require('../validators/menuValidator');
const {
  getAllMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuController');

router.get('/',    protect,             getAllMenuItems);
router.get('/:id', protect,             getMenuItem);
router.post('/',   protect, adminOnly,  createMenuValidator, createMenuItem);
router.patch('/:id', protect, adminOnly, updateMenuValidator, updateMenuItem);
router.delete('/:id', protect, adminOnly, deleteMenuItem);

module.exports = router;
