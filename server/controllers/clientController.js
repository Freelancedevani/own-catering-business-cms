const Client = require('../models/Client');
const Lead = require('../models/Lead');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { upsertContact } = require('./contactBookController');

// -----------------------------------------------
// @POST /api/clients
// @access Admin only
// -----------------------------------------------
exports.createClient = catchAsync(async (req, res, next) => {
  const existingClient = await Client.findOne({ email: req.body.email });
  if (existingClient) return next(new AppError('Client with this email already exists', 400));

  const client = await Client.create(req.body);

  upsertContact({ name: client.name, phone: client.phone, source: 'client', sourceRef: client._id }).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Client created successfully',
    data: { client },
  });
});


// -----------------------------------------------
// @POST /api/clients/convert/:leadId
// @access Admin only — Convert a lead to client
// -----------------------------------------------
exports.convertLeadToClient = catchAsync(async (req, res, next) => {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return next(new AppError('Lead not found', 404));

  if (lead.status === 'converted')
    return next(new AppError('This lead has already been converted', 400));

  const existingClient = await Client.findOne({ email: lead.email });
  if (existingClient) return next(new AppError('A client with this email already exists', 400));

  // Create client from lead data
  const client = await Client.create({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: 'lead_conversion',
    convertedFromLead: lead._id,
    adminNotes: lead.adminNotes || '',
    clientType: lead.eventType === 'corporate' ? 'corporate' : 'individual',
  });

  upsertContact({ name: client.name, phone: client.phone, source: 'client', sourceRef: client._id }).catch(() => {});

  // ✅ Delete the lead after successful conversion (no longer needed)
  await lead.deleteOne();

  res.status(201).json({
    success: true,
    message: 'Lead successfully converted to client and lead record removed',
    data: { client },
  });
});

// -----------------------------------------------
// @GET /api/clients
// @access Admin only
// -----------------------------------------------
exports.getAllClients = catchAsync(async (req, res, next) => {
  const {
    status, clientType, source,
    search, page = 1, limit = 10,
    sortBy = 'createdAt', order = 'desc',
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (clientType) filter.clientType = clientType;
  if (source) filter.source = source;

  // Search by name, email, phone
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .populate('assignedTo', 'name email')
      .populate('convertedFromLead', 'eventType eventDate')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Client.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: 'Clients fetched successfully',
    data: {
      clients,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

// -----------------------------------------------
// @GET /api/clients/:id
// @access Admin only
// -----------------------------------------------
exports.getClientById = catchAsync(async (req, res, next) => {
  const client = await Client.findById(req.params.id)
    .populate('assignedTo', 'name email')
    .populate('convertedFromLead', 'eventType eventDate guestCount budget');

  if (!client) return next(new AppError('Client not found', 404));

  res.status(200).json({
    success: true,
    data: { client },
  });
});

// -----------------------------------------------
// @PUT /api/clients/:id
// @access Admin only
// -----------------------------------------------
exports.updateClient = catchAsync(async (req, res, next) => {
  // Prevent duplicate email on update
  if (req.body.email) {
    const existing = await Client.findOne({
      email: req.body.email,
      _id: { $ne: req.params.id },
    });
    if (existing) return next(new AppError('Email already used by another client', 400));
  }

  const client = await Client.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!client) return next(new AppError('Client not found', 404));

  res.status(200).json({
    success: true,
    message: 'Client updated successfully',
    data: { client },
  });
});

// -----------------------------------------------
// @DELETE /api/clients/:id
// @access Admin only
// -----------------------------------------------
exports.deleteClient = catchAsync(async (req, res, next) => {
  const client = await Client.findById(req.params.id);
  if (!client) return next(new AppError('Client not found', 404));

  await client.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Client deleted successfully',
    data: null,
  });
});

// -----------------------------------------------
// @GET /api/clients/stats
// @access Admin only
// -----------------------------------------------
exports.getClientStats = catchAsync(async (req, res, next) => {
  const [
    totalClients,
    activeClients,
    corporateClients,
    topSpenders,
    bySource,
    byType,
  ] = await Promise.all([
    Client.countDocuments(),
    Client.countDocuments({ status: 'active' }),
    Client.countDocuments({ clientType: 'corporate' }),
    Client.find({ status: 'active' })
      .sort({ totalSpent: -1 })
      .limit(5)
      .select('name email totalSpent totalOrders'),
    Client.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Client.aggregate([
      { $group: { _id: '$clientType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalClients,
      activeClients,
      corporateClients,
      topSpenders,
      bySource,
      byType,
    },
  });
});
