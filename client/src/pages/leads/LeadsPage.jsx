import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLeads, createLead,
  updateLead, deleteLead,
} from '../../features/leads/leadSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus, FiSearch, FiEdit2,
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

const baseFields = {
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
  street:     yup.string().optional(),
  city:       yup.string().optional(),
  state:      yup.string().optional(),
  pincode:    yup.string().optional(),
};

const createSchema = yup.object(baseFields);

const editSchema = yup.object({
  ...baseFields,
  status:      yup.string().optional(),
  priority:    yup.string().optional(),
  adminNotes:  yup.string().optional(),
  followUpDate: yup.string().optional().nullable(),
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

const buildPayload = (data) => {
  const { street, city, state, pincode, ...rest } = data;
  return {
    ...rest,
    followUpDate: data.followUpDate || null,
    address: { street: street || null, city: city || null, state: state || null, pincode: pincode || null },
  };
};

// Reusable lead form fields
const LeadFormFields = ({ form, isEdit = false }) => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <InputField label="Full Name" name="name" required
        register={form.register} error={form.formState.errors.name}
        placeholder="John Doe" />
      <InputField label="Email" name="email" type="email" required
        register={form.register} error={form.formState.errors.email}
        placeholder="john@example.com" />
      <InputField label="Phone" name="phone" required
        register={form.register} error={form.formState.errors.phone}
        placeholder="9876543210" />
      <SelectField label="Event Type" name="eventType" required
        register={form.register} error={form.formState.errors.eventType}
        options={EVENT_TYPES} placeholder="Select event type" />
      <InputField label="Event Date" name="eventDate" type="date" required
        register={form.register} error={form.formState.errors.eventDate} />
      <InputField label="Guest Count" name="guestCount" type="number" required
        register={form.register} error={form.formState.errors.guestCount}
        placeholder="100" />
      <InputField label="Location" name="location" required
        register={form.register} error={form.formState.errors.location}
        placeholder="Venue / City" />
      <InputField label="Budget (₹)" name="budget" type="number"
        register={form.register} error={form.formState.errors.budget}
        placeholder="50000" />
      <SelectField label="Source" name="source"
        register={form.register} options={SOURCES} placeholder="Select source" />
      {isEdit && (
        <>
          <SelectField label="Status" name="status"
            register={form.register} options={LEAD_STATUSES} placeholder="Select status" />
          <SelectField label="Priority" name="priority"
            register={form.register} options={PRIORITIES} placeholder="Select priority" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Follow-Up Date</label>
            <input type="date" className="input-field" {...form.register('followUpDate')} />
          </div>
        </>
      )}
    </div>

    <div className="border-t pt-3">
      <p className="text-sm font-semibold text-gray-700 mb-3">
        Address <span className="text-xs font-normal text-gray-400">(optional)</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Street"  name="street"  register={form.register} placeholder="Street" />
        <InputField label="City"    name="city"    register={form.register} placeholder="City" />
        <InputField label="State"   name="state"   register={form.register} placeholder="State" />
        <InputField label="Pincode" name="pincode" register={form.register} placeholder="Pincode" />
      </div>
    </div>

    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Message</label>
      <textarea rows={2} placeholder="Any specific requirements..."
        className="input-field resize-none" {...form.register('message')} />
    </div>

    {isEdit && (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Admin Notes</label>
        <textarea rows={2} placeholder="Internal notes..."
          className="input-field resize-none" {...form.register('adminNotes')} />
      </div>
    )}
  </>
);

export default function LeadsPage() {
  const dispatch = useDispatch();
  const { leads, pagination, isLoading, isSubmitting } = useSelector((s) => s.leads);

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,    setSelected]    = useState(null);

  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [eventType, setEventType] = useState('');
  const [page,      setPage]      = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  const createForm = useForm({ resolver: yupResolver(createSchema) });
  const editForm   = useForm({ resolver: yupResolver(editSchema) });

  const loadLeads = useCallback(() => {
    dispatch(fetchLeads({
      page, limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(status    && { status }),
      ...(eventType && { eventType }),
    }));
  }, [dispatch, page, debouncedSearch, status, eventType]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleCreate = async (data) => {
    const result = await dispatch(createLead(buildPayload(data)));
    if (!result.error) { setCreateModal(false); createForm.reset(); }
  };

  const handleEdit = async (data) => {
    const result = await dispatch(updateLead({ id: selected._id, payload: buildPayload(data) }));
    if (!result.error) { setEditModal(false); editForm.reset(); }
  };

  const handleDelete = async () => {
    await dispatch(deleteLead(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  const openEdit = (lead) => {
    setSelected(lead);
    editForm.reset({
      name:        lead.name        || '',
      email:       lead.email       || '',
      phone:       lead.phone       || '',
      eventType:   lead.eventType   || '',
      eventDate:   lead.eventDate   ? new Date(lead.eventDate).toISOString().split('T')[0] : '',
      guestCount:  lead.guestCount  || '',
      location:    lead.location    || '',
      budget:      lead.budget      || '',
      message:     lead.message     || '',
      source:      lead.source      || '',
      status:      lead.status      || 'new',
      priority:    lead.priority    || 'medium',
      adminNotes:  lead.adminNotes  || '',
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().split('T')[0] : '',
      street:  lead.address?.street  || '',
      city:    lead.address?.city    || '',
      state:   lead.address?.state   || '',
      pincode: lead.address?.pincode || '',
    });
    setEditModal(true);
  };

  const resetFilters = () => { setSearch(''); setStatus(''); setEventType(''); setPage(1); };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total || 0} total inquiries</p>
        </div>
        <button onClick={() => setCreateModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search name, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8" />
          </div>
          <select value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input-field w-40">
            <option value="">All Status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="input-field w-44">
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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? <Loader /> : leads.length === 0 ? (
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
                    {['Name', 'Event', 'Date', 'Guests', 'Budget', 'Status', 'Priority', 'Follow-Up', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((lead) => {
                    const statusInfo = LEAD_STATUSES.find((s) => s.value === lead.status);
                    const priorityColor = { low: 'gray', medium: 'yellow', high: 'red' };
                    const followUpOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date();
                    return (
                      <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{lead.name}</p>
                          <p className="text-xs text-gray-400">{lead.email}</p>
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
                          <Badge label={capitalize(lead.priority)}
                            color={priorityColor[lead.priority] || 'gray'} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lead.followUpDate ? (
                            <span className={`text-xs font-medium ${followUpOverdue ? 'text-red-500' : 'text-green-600'}`}>
                              {formatDate(lead.followUpDate)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setSelected(lead); setViewModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="View">
                              <FiEye size={15} />
                            </button>
                            <button onClick={() => openEdit(lead)}
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors" title="Edit">
                              <FiEdit2 size={15} />
                            </button>
                            <button onClick={() => { setSelected(lead); setDeleteModal(true); }}
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
            <Pagination page={page} totalPages={pagination?.totalPages || 1} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={createModal}
        onClose={() => { setCreateModal(false); createForm.reset(); }}
        title="Add New Lead" size="lg">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <LeadFormFields form={createForm} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setCreateModal(false); createForm.reset(); }}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal}
        onClose={() => { setEditModal(false); editForm.reset(); }}
        title="Edit Lead" size="lg">
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          <LeadFormFields form={editForm} isEdit />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setEditModal(false); editForm.reset(); }}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Lead Details" size="md">
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
                <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {selected._id}</p>
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
                { label: 'Follow-Up',   value: selected.followUpDate
                    ? <span className={new Date(selected.followUpDate) < new Date() ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
                        {formatDate(selected.followUpDate)}{new Date(selected.followUpDate) < new Date() && ' (Overdue)'}
                      </span>
                    : '—' },
                { label: 'Street',  value: selected.address?.street  || '—' },
                { label: 'City',    value: selected.address?.city    || '—' },
                { label: 'State',   value: selected.address?.state   || '—' },
                { label: 'Pincode', value: selected.address?.pincode || '—' },
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
            <p className="text-xs text-gray-400 text-center">Created: {formatDate(selected.createdAt)}</p>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Lead" size="sm">
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
