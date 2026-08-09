const Lead = require('../models/Lead');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { upsertContact } = require('./contactBookController');
const { createNotification } = require('../utils/notificationService');

// -----------------------------------------------
// @POST /api/leads
// @access Public (anyone can submit an inquiry)
// -----------------------------------------------
exports.createLead = catchAsync(async (req, res, next) => {
  const {
    name, email, phone, eventType,
    eventDate, guestCount, location,
    budget, message, source, address,
  } = req.body;

  const lead = await Lead.create({
    name, email, phone, eventType,
    eventDate, guestCount, location,
    budget, message, source, address,
  });

  upsertContact({ name, phone, source: 'lead', sourceRef: lead._id }).catch(() => {});

  createNotification(
    '📌 New Lead Received',
    `${name} submitted an inquiry for ${eventType || 'an event'}.`,
    'lead',
    '/leads'
  ).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Your inquiry has been submitted. We will contact you shortly!',
    data: { lead },
  });
});

// -----------------------------------------------
// @GET /api/leads
// @access Admin only
// -----------------------------------------------
exports.getAllLeads = catchAsync(async (req, res, next) => {
  const {
    status, priority, eventType,
    startDate, endDate,
    page = 1, limit = 10,
    sortBy = 'createdAt', order = 'desc',
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (eventType) filter.eventType = eventType;
  if (startDate || endDate) {
    filter.eventDate = {};
    if (startDate) filter.eventDate.$gte = new Date(startDate);
    if (endDate) filter.eventDate.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Lead.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: 'Leads fetched successfully',
    data: {
      leads,
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
// @GET /api/leads/:id
// @access Admin only
// -----------------------------------------------
exports.getLeadById = catchAsync(async (req, res, next) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name email');

  if (!lead) return next(new AppError('Lead not found', 404));

  res.status(200).json({
    success: true,
    data: { lead },
  });
});

// -----------------------------------------------
// @PUT /api/leads/:id  — full update
// @access Admin only
// -----------------------------------------------
exports.updateLead = catchAsync(async (req, res, next) => {
  const {
    name, email, phone, eventType, eventDate, guestCount,
    location, budget, message, source,
    status, priority, adminNotes, assignedTo, followUpDate, address,
  } = req.body;

  const lead = await Lead.findById(req.params.id);
  if (!lead) return next(new AppError('Lead not found', 404));

  if (name       !== undefined) lead.name       = name;
  if (email      !== undefined) lead.email      = email;
  if (phone      !== undefined) lead.phone      = phone;
  if (eventType  !== undefined) lead.eventType  = eventType;
  if (eventDate  !== undefined) lead.eventDate  = eventDate;
  if (guestCount !== undefined) lead.guestCount = guestCount;
  if (location   !== undefined) lead.location   = location;
  if (budget     !== undefined) lead.budget     = budget;
  if (message    !== undefined) lead.message    = message;
  if (source     !== undefined) lead.source     = source;
  if (status     !== undefined) lead.status     = status;
  if (priority   !== undefined) lead.priority   = priority;
  if (adminNotes !== undefined) lead.adminNotes = adminNotes;
  if (assignedTo !== undefined) lead.assignedTo = assignedTo;
  if (followUpDate !== undefined) lead.followUpDate = followUpDate || null;
  if (address    !== undefined) lead.address    = address;

  await lead.save();

  res.status(200).json({
    success: true,
    message: 'Lead updated successfully',
    data: { lead },
  });
});

// -----------------------------------------------
// @DELETE /api/leads/:id
// @access Admin only
// -----------------------------------------------
exports.deleteLead = catchAsync(async (req, res, next) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return next(new AppError('Lead not found', 404));

  await lead.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Lead deleted successfully',
    data: null,
  });
});

// -----------------------------------------------
// @GET /api/leads/stats
// @access Admin only
// -----------------------------------------------
exports.getLeadStats = catchAsync(async (req, res, next) => {
  const stats = await Lead.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgBudget: { $avg: '$budget' },
        avgGuestCount: { $avg: '$guestCount' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const eventTypeStats = await Lead.aggregate([
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const totalLeads = await Lead.countDocuments();
  const newLeads = await Lead.countDocuments({ status: 'new' });
  const convertedLeads = await Lead.countDocuments({ status: 'converted' });
  const conversionRate = totalLeads > 0
    ? ((convertedLeads / totalLeads) * 100).toFixed(2)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      totalLeads,
      newLeads,
      convertedLeads,
      conversionRate: `${conversionRate}%`,
      byStatus: stats,
      byEventType: eventTypeStats,
    },
  });
});

// @PATCH /api/leads/:id/status — kept for backward compat, delegates to updateLead
exports.updateLeadStatus = exports.updateLead;