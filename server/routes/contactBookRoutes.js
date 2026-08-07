const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
  syncContacts,
  importContacts,
  exportContacts,
  getExportableFields,
} = require('../controllers/contactBookController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Keep the uploaded file in memory (small files only) — no need to touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Only .xlsx, .xls or .csv files are allowed'), ok);
  },
});

router.use(protect, adminOnly);

router.post('/sync', syncContacts);
router.post('/import', upload.single('file'), importContacts);
router.get('/export', exportContacts);
router.get('/export-fields', getExportableFields);

router.route('/')
  .get(getAllContacts)
  .post(createContact);

router.route('/:id')
  .put(updateContact)
  .delete(deleteContact);

module.exports = router;