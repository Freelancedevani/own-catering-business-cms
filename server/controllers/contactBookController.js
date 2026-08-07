const XLSX = require('xlsx');
const ContactBook = require('../models/ContactBook');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Strips +91 / 91 / leading 0s and any non-digit characters (spaces,
// dashes, brackets) from an Indian mobile number, returning the clean
// 10-digit number. Returns null if a valid 10-digit number can't be
// extracted (e.g. too short after cleaning).
const normalizePhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/\D/g, ''); // keep digits only

  digits = digits.replace(/^0+/, ''); // strip leading zero(s), e.g. "0" or "+0"

  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2); // strip country code 91 / +91
  }

  if (digits.length > 10) digits = digits.slice(-10); // fallback: keep last 10

  return digits.length === 10 ? digits : null;
};

// ── Internal helper — called by lead/client controllers ──
exports.upsertContact = async ({ name, phone, source, sourceRef }) => {
  if (!phone) return;
  await ContactBook.findOneAndUpdate(
    { phone },
    { name, source, sourceRef },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// @GET /api/contacts
exports.getAllContacts = catchAsync(async (req, res) => {
  const { search, source, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (source) filter.source = source;
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [contacts, total] = await Promise.all([
    ContactBook.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ContactBook.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      contacts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// @POST /api/contacts  (manual add)
exports.createContact = catchAsync(async (req, res, next) => {
  const { name, notes } = req.body;

  const phone = normalizePhone(req.body.phone);
  if (!phone) return next(new AppError('Enter a valid 10-digit phone number', 400));

  const existing = await ContactBook.findOne({ phone });
  if (existing) return next(new AppError('A contact with this phone number already exists', 400));

  const contact = await ContactBook.create({ name, phone, notes, source: 'manual' });

  res.status(201).json({ success: true, message: 'Contact added', data: { contact } });
});

// @PUT /api/contacts/:id
exports.updateContact = catchAsync(async (req, res, next) => {
  const { name, notes, address } = req.body;

  let phone;
  if (req.body.phone) {
    phone = normalizePhone(req.body.phone);
    if (!phone) return next(new AppError('Enter a valid 10-digit phone number', 400));

    const dup = await ContactBook.findOne({ phone, _id: { $ne: req.params.id } });
    if (dup) return next(new AppError('Phone number already used by another contact', 400));
  }

  const contact = await ContactBook.findByIdAndUpdate(
    req.params.id,
    { name, ...(phone && { phone }), notes, address },
    { new: true, runValidators: true }
  );
  if (!contact) return next(new AppError('Contact not found', 404));

  res.status(200).json({ success: true, message: 'Contact updated', data: { contact } });
});

// @POST /api/contacts/sync
exports.syncContacts = catchAsync(async (req, res) => {
  const [leads, clients, staff] = await Promise.all([
    Lead.find({}, 'name phone _id address'),
    Client.find({}, 'name phone _id billingAddress'),
    Staff.find({}, 'name phone _id address'),
  ]);

  const entries = [
    ...leads.map((l) => ({
      name: l.name, phone: l.phone, source: 'lead', sourceRef: l._id,
      address: l.address
        ? { street: l.address.street || null, city: l.address.city || null,
            state: l.address.state || null, pincode: l.address.pincode || null }
        : null,
    })),
    ...clients.map((c) => ({
      name: c.name, phone: c.phone, source: 'client', sourceRef: c._id,
      address: c.billingAddress
        ? { street: c.billingAddress.street || null, city: c.billingAddress.city || null,
            state: c.billingAddress.state || null, pincode: c.billingAddress.pincode || null }
        : null,
    })),
    ...staff.map((s) => ({
      name: s.name, phone: s.phone, source: 'staff', sourceRef: s._id,
      address: s.address
        ? { street: s.address.street || null, city: s.address.city || null,
            state: s.address.state || null, pincode: s.address.pincode || null }
        : null,
    })),
  ].filter((e) => e.phone);

  let added = 0, updated = 0;
  await Promise.all(
    entries.map(async ({ name, phone, source, sourceRef, address }) => {
      const existing = await ContactBook.findOne({ phone });
      if (!existing) {
        await ContactBook.create({ name, phone, source, sourceRef, address });
        added++;
      } else {
        await ContactBook.updateOne({ phone }, { name, source, sourceRef, address });
        updated++;
      }
    })
  );

  res.status(200).json({
    success: true,
    message: `Sync complete — ${added} added, ${updated} updated`,
    data: { added, updated },
  });
});

// @DELETE /api/contacts/:id
exports.deleteContact = catchAsync(async (req, res, next) => {
  const contact = await ContactBook.findById(req.params.id);
  if (!contact) return next(new AppError('Contact not found', 404));

  await contact.deleteOne();
  res.status(200).json({ success: true, message: 'Contact deleted', data: null });
});

// ─────────────────────────────────────────────────────────────
//  IMPORT  —  @POST /api/contacts/import   (multipart, field "file")
//  Only Name / Phone / Address columns are read from the sheet.
//  Anything missing is filled with "nil". Rows with no phone at
//  all are skipped (phone is the unique key used to match/dedupe).
// ─────────────────────────────────────────────────────────────
exports.importContacts = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('Please upload an Excel (.xlsx/.csv) file', 400));

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err) {
    return next(new AppError('Could not read the uploaded file — is it a valid Excel/CSV file?', 400));
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) return next(new AppError('The uploaded file has no data rows', 400));

  // Flexible header matching — tolerant of spacing/casing differences,
  // e.g. "Phone Number", "phone_number", "Mobile" all match phone.
  const getField = (row, ...keys) => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const match = rowKeys.find((k) => k.toLowerCase().replace(/[\s_-]/g, '') === key);
      if (match && String(row[match]).trim() !== '') return String(row[match]).trim();
    }
    return null;
  };

  let added = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const name       = getField(row, 'name', 'fullname', 'contactname')   || 'nil';
    const rawPhone   = getField(row, 'phone', 'phonenumber', 'mobile', 'contact', 'mobilenumber');
    const street     = getField(row, 'street', 'address', 'addressline1') || 'nil';
    const city       = getField(row, 'city')                               || 'nil';
    const state      = getField(row, 'state')                              || 'nil';
    const pincode    = getField(row, 'pincode', 'zip', 'zipcode', 'postalcode') || 'nil';

    // Cleans +91 / 91 / leading 0 prefixes down to a plain 10-digit number.
    // Also guards against header/title rows slipping in as data (a cell like
    // "Phone Number" has no digits and normalizes to null, so it's skipped).
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      skipped++;
      errors.push(`Row ${i + 2}: missing/invalid phone number — skipped`);
      continue;
    }

    const address = { street, city, state, pincode };

    try {
      const existing = await ContactBook.findOne({ phone });
      if (existing) {
        await ContactBook.updateOne({ phone }, { name, address });
        updated++;
      } else {
        await ContactBook.create({ name, phone, address, source: 'manual' });
        added++;
      }
    } catch (err) {
      skipped++;
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  res.status(200).json({
    success: true,
    message: `Import complete — ${added} added, ${updated} updated, ${skipped} skipped`,
    data: { added, updated, skipped, errors },
  });
});

// ─────────────────────────────────────────────────────────────
//  EXPORT  —  @GET /api/contacts/export?fields=name,phone,address...
//  Defaults to Name + Phone only if no fields are specified.
// ─────────────────────────────────────────────────────────────
const COLUMN_MAP = {
  name:      { header: 'Name',     get: (c) => c.name },
  phone:     { header: 'Phone',    get: (c) => c.phone },
  street:    { header: 'Street',   get: (c) => c.address?.street  || 'nil' },
  city:      { header: 'City',     get: (c) => c.address?.city    || 'nil' },
  state:     { header: 'State',    get: (c) => c.address?.state   || 'nil' },
  pincode:   { header: 'Pincode',  get: (c) => c.address?.pincode || 'nil' },
  address:   {
    header: 'Address',
    get: (c) => {
      const a = c.address;
      if (!a || (!a.street && !a.city && !a.state && !a.pincode)) return 'nil';
      return [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ');
    },
  },
  source:    { header: 'Source',   get: (c) => c.source },
  notes:     { header: 'Notes',    get: (c) => c.notes || 'nil' },
  createdAt: { header: 'Added On', get: (c) => new Date(c.createdAt).toLocaleDateString() },
};

exports.exportContacts = catchAsync(async (req, res, next) => {
  const { fields, source, search } = req.query;

  // Default export = Name + Phone only, per requirement
  const requested = fields ? fields.split(',').map((f) => f.trim()) : ['name', 'phone'];
  const columns = requested.filter((f) => COLUMN_MAP[f]);
  if (!columns.length) return next(new AppError('No valid export fields specified', 400));

  const filter = {};
  if (source) filter.source = source;
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const contacts = await ContactBook.find(filter).sort({ createdAt: -1 });

  const data = contacts.map((c) => {
    const row = {};
    columns.forEach((col) => { row[COLUMN_MAP[col].header] = COLUMN_MAP[col].get(c); });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="contacts-${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// Exposed so the frontend can render checkboxes without hardcoding the list
exports.getExportableFields = (req, res) => {
  res.status(200).json({
    success: true,
    data: Object.keys(COLUMN_MAP).map((key) => ({ key, label: COLUMN_MAP[key].header })),
  });
};