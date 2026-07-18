import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLeads, createLead,
  updateLeadStatus, deleteLead,
} from '../../features/leads/leadSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus, FiSearch, FiFilter, FiEdit2,
  FiTrash2, FiEye, FiRefreshCw,
} from 'react-icons/fi';
import Modal       from '../../components/ui/Modal';
import Badge       from '../../components/ui/Badge';
import Loader      from '../../components/ui/Loader';
import Pagination  from '../../components/ui/Pagination';
import EmptyState  from '../../components/ui/EmptyState';
import InputField  from '../../components/forms/InputField';
import SelectField from '../../components/forms/SelectField';
import { formatDate, capitalize } from '../../utils/formatters';
import { LEAD_STATUSES, EVENT_TYPES } from '../../utils/constants';
import { useDebounce } from '../../hooks/useDebounce';

// ── Validation Schemas ──
const createSchema = yup.object({
  name:       yup.string().min(2).required('Name is required'),
  email:      yup.string().email('Invalid email').required('Email is required'),
  phone:      yup.string().required('Phone is required'),
  eventType:  yup.string().required('Event type is required'),
  eventDate:  yup.string().required('Event date is required'),
  guestCount: yup.number().min(1).required('Guest count is required'),
  location:   yup.string().required('Location is required'),
  budget:     yup.number().min(0).optional(),
  message:    yup.string().optional(),
  source:     yup.string().optional(),
});

const updateSchema = yup.object({
  status:       yup.string().required('Status is required'),
  priority:     yup.string().optional(),
  adminNotes:   yup.string().optional(),
  // ✅ NEW: optional future date
  followUpDate: yup
    .string()
    .optional()
    .nullable()
    .test('is-future', 'Follow-up date must be in the future', (value) => {
      if (!value) return true;
      return new Date(value) > new Date();
    }),
});

const SOURCES = [
  { value: 'website',      label: 'Website' },
  { value: 'phone',        label: 'Phone' },
  { value: 'referral',     label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'walk_in',      label: 'Walk In' },
  { value: 'other',        label: 'Other' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

export default function LeadsPage() {
  const dispatch = useDispatch();
  const { leads, pagination, isLoading, isSubmitting } = useSelector((s) => s.leads);

  // ── Modal States ──
  const [createModal, setCreateModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,    setSelected]    = useState(null);

  // ── Filters ──
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [eventType, setEventType] = useState('');
  const [page,      setPage]      = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  // ── Forms ──
  const createForm = useForm({ resolver: yupResolver(createSchema) });
  const updateForm = useForm({ resolver: yupResolver(updateSchema) });

  // ── Fetch ──
  const loadLeads = useCallback(() => {
    dispatch(fetchLeads({
      page,
      limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(status    && { status }),
      ...(eventType && { eventType }),
    }));
  }, [dispatch, page, debouncedSearch, status, eventType]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Handlers ──
  const handleCreate = async (data) => {
    const result = await dispatch(createLead(data));
    if (!result.error) {
      setCreateModal(false);
      createForm.reset();
    }
  };

  const handleUpdateStatus = async (data) => {
    // Send null explicitly if followUpDate is cleared
    const payload = {
      ...data,
      followUpDate: data.followUpDate || null,
    };
    const result = await dispatch(updateLeadStatus({ id: selected._id, payload }));
    if (!result.error) {
      setUpdateModal(false);
      updateForm.reset();
    }
  };

  const handleDelete = async () => {
    await dispatch(deleteLead(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  const openUpdate = (lead) => {
    setSelected(lead);
    updateForm.reset({
      status:       lead.status,
      priority:     lead.priority,
      adminNotes:   lead.adminNotes || '',
      // ✅ Pre-fill existing follow-up date (format to YYYY-MM-DD for date input)
      followUpDate: lead.followUpDate
        ? new Date(lead.followUpDate).toISOString().split('T')[0]
        : '',
    });
    setUpdateModal(true);
  };

  const openView   = (lead) => { setSelected(lead); setViewModal(true); };
  const openDelete = (lead) => { setSelected(lead); setDeleteModal(true); };

  const resetFilters = () => {
    setSearch(''); setStatus(''); setEventType(''); setPage(1);
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total || 0} total inquiries
          </p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus size={16} /> Add Lead
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input-field w-40"
          >
            <option value="">All Status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="input-field w-44"
          >
            <option value="">All Events</option>
            {EVENT_TYPES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <button onClick={resetFilters} className="btn-secondary flex items-center gap-2">
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <Loader />
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads found"
            description="Start by adding a new inquiry or adjust your filters"
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> Add Lead
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {/* ✅ Added "Follow-Up" column */}
                    {['Name', 'Event', 'Date', 'Guests', 'Budget', 'Status', 'Priority', 'Follow-Up', 'Actions']
                      .map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                               text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((lead) => {
                    const statusInfo    = LEAD_STATUSES.find((s) => s.value === lead.status);
                    const priorityColor = { low: 'gray', medium: 'yellow', high: 'red' };
                    // ✅ Highlight overdue follow-ups
                    const followUpOverdue =
                      lead.followUpDate && new Date(lead.followUpDate) < new Date();

                    return (
                      <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{lead.name}</p>
                            <p className="text-xs text-gray-400">{lead.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-700">
                          {lead.eventType?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {formatDate(lead.eventDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lead.guestCount}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {lead.budget ? `₹${lead.budget.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={statusInfo?.label} color={statusInfo?.color} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={capitalize(lead.priority)}
                            color={priorityColor[lead.priority] || 'gray'}
                          />
                        </td>
                        {/* ✅ Follow-Up Date cell with overdue highlight */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lead.followUpDate ? (
                            <span className={`text-xs font-medium ${
                              followUpOverdue ? 'text-red-500' : 'text-green-600'
                            }`}>
                              {formatDate(lead.followUpDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openView(lead)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="View">
                              <FiEye size={15} />
                            </button>
                            <button onClick={() => openUpdate(lead)}
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors" title="Update Status">
                              <FiEdit2 size={15} />
                            </button>
                            <button onClick={() => openDelete(lead)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={pagination?.totalPages || 1}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* ── Create Lead Modal ── */}
      <Modal
        isOpen={createModal}
        onClose={() => { setCreateModal(false); createForm.reset(); }}
        title="Add New Lead"
        size="lg"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Full Name" name="name" required
              register={createForm.register} error={createForm.formState.errors.name}
              placeholder="John Doe" />
            <InputField label="Email" name="email" type="email" required
              register={createForm.register} error={createForm.formState.errors.email}
              placeholder="john@example.com" />
            <InputField label="Phone" name="phone" required
              register={createForm.register} error={createForm.formState.errors.phone}
              placeholder="9876543210" />
            <SelectField label="Event Type" name="eventType" required
              register={createForm.register} error={createForm.formState.errors.eventType}
              options={EVENT_TYPES} placeholder="Select event type" />
            <InputField label="Event Date" name="eventDate" type="date" required
              register={createForm.register} error={createForm.formState.errors.eventDate} />
            <InputField label="Guest Count" name="guestCount" type="number" required
              register={createForm.register} error={createForm.formState.errors.guestCount}
              placeholder="100" />
            <InputField label="Location" name="location" required
              register={createForm.register} error={createForm.formState.errors.location}
              placeholder="Venue / City" />
            <InputField label="Budget (₹)" name="budget" type="number"
              register={createForm.register} error={createForm.formState.errors.budget}
              placeholder="50000" />
            <SelectField label="Source" name="source"
              register={createForm.register} options={SOURCES} placeholder="Select source" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea rows={3} placeholder="Any specific requirements..."
              className="input-field resize-none" {...createForm.register('message')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Update Status Modal ── */}
      <Modal
        isOpen={updateModal}
        onClose={() => setUpdateModal(false)}
        title="Update Lead Status"
        size="sm"
      >
        <form onSubmit={updateForm.handleSubmit(handleUpdateStatus)} className="space-y-4">
          <SelectField label="Status" name="status" required
            register={updateForm.register} error={updateForm.formState.errors.status}
            options={LEAD_STATUSES} placeholder="Select status" />
          <SelectField label="Priority" name="priority"
            register={updateForm.register} options={PRIORITIES} placeholder="Select priority" />

          {/* ✅ NEW: Follow-Up Date field */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Follow-Up Date</label>
            <input
              type="date"
              className="input-field"
              min={new Date().toISOString().split('T')[0]}
              {...updateForm.register('followUpDate')}
            />
            {updateForm.formState.errors.followUpDate && (
              <p className="text-xs text-red-500 mt-0.5">
                {updateForm.formState.errors.followUpDate.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Admin Notes</label>
            <textarea rows={3} placeholder="Add notes about this lead..."
              className="input-field resize-none" {...updateForm.register('adminNotes')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setUpdateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Update</button>
          </div>
        </form>
      </Modal>

      {/* ── View Lead Modal ── */}
      <Modal
        isOpen={viewModal}
        onClose={() => setViewModal(false)}
        title="Lead Details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center
                              justify-center text-brand font-bold text-xl">
                {selected.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.email} · {selected.phone}</p>
                <p className="text-sm text-gray-500 mt-1 font-mono text-xs">ID: {selected._id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Event Type',  value: capitalize(selected.eventType?.replace(/_/g, ' ')) },
                { label: 'Event Date',  value: formatDate(selected.eventDate) },
                { label: 'Guest Count', value: selected.guestCount },
                { label: 'Budget',      value: selected.budget ? `₹${selected.budget.toLocaleString('en-IN')}` : '—' },
                { label: 'Location',    value: selected.location },
                { label: 'Source',      value: capitalize(selected.source) },
                { label: 'Status',      value: <Badge label={LEAD_STATUSES.find((s) => s.value === selected.status)?.label} color={LEAD_STATUSES.find((s) => s.value === selected.status)?.color} /> },
                { label: 'Priority',    value: capitalize(selected.priority) },
                // ✅ NEW: Follow-Up Date in view grid
                {
                  label: 'Follow-Up Date',
                  value: selected.followUpDate
                    ? (
                      <span className={
                        new Date(selected.followUpDate) < new Date()
                          ? 'text-red-500 font-semibold'
                          : 'text-green-600 font-semibold'
                      }>
                        {formatDate(selected.followUpDate)}
                        {new Date(selected.followUpDate) < new Date() && ' (Overdue)'}
                      </span>
                    )
                    : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            {selected.message && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Message</p>
                <p className="text-sm text-gray-700">{selected.message}</p>
              </div>
            )}
            {selected.adminNotes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-xs text-yellow-600 font-medium mb-1">Admin Notes</p>
                <p className="text-sm text-gray-700">{selected.adminNotes}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              Created: {formatDate(selected.createdAt)}
            </p>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Lead"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the lead for{' '}
            <span className="font-semibold text-gray-900">{selected?.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}