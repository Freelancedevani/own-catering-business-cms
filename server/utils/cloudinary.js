const cloudinary             = require('cloudinary').v2;
const { CloudinaryStorage }  = require('multer-storage-cloudinary');
const multer                 = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Staff profile pic storage ──────────────────
const staffPicStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:           'catering/staff/profile',
    allowed_formats:  ['jpg', 'jpeg', 'png', 'webp'],
    transformation:   [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    public_id: (req) => `staff_${req.params.id}_${Date.now()}`,
  },
});

// ── Staff documents storage ────────────────────
const staffDocStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'catering/staff/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    public_id: (req) => `doc_${req.params.id}_${Date.now()}`,
  },
});

const uploadStaffPic = multer({
  storage: staffPicStorage,
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const uploadStaffDoc = multer({
  storage: staffDocStorage,
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = { cloudinary, uploadStaffPic, uploadStaffDoc };
