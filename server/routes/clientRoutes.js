const express = require('express');
const router = express.Router();
const {
  createClient,
  convertLeadToClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientStats,
} = require('../controllers/clientController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  createClientValidator,
  updateClientValidator,
} = require('../validators/clientValidator');

// All client routes — Admin only
router.use(protect, adminOnly);

router.get('/stats', getClientStats);
router.post('/convert/:leadId', convertLeadToClient);
router.route('/')
  .get(getAllClients)
  .post(createClientValidator, createClient);

router.route('/:id')
  .get(getClientById)
  .put(updateClientValidator, updateClient)
  .delete(deleteClient);

module.exports = router;
