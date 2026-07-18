import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchClients, fetchClientStats,
  createClient, updateClient,
  deleteClient, convertLeadToClient,
} from '../../features/clients/clientSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2,
  FiEye, FiRefreshCw, FiUserCheck,
  FiTrendingUp, FiUsers, FiStar,
} from 'react-icons/fi';
import Modal       from '../../components/ui/Modal';
import Badge       from '../../components/ui/Badge';
import Loader      from '../../components/ui/Loader';
import Pagination  from '../../components/ui/Pagination';
import EmptyState  from '../../components/ui/EmptyState';
import InputField  from '../../components/forms/InputField';
import SelectField from '../../components/forms/SelectField';
import { formatDate, formatCurrency, capitalize } from '../../utils/formatters';
import { useDebounce } from '../../hooks/useDebounce';

// ── Validation Schema ──
const clientSchema = yup.object({
  name:        yup.string().min(2).required('Name is required'),
  email:       yup.string().email('Invalid email').required('Email is required'),
  phone:       yup.string().required('Phone is required'),
  clientType:  yup.string().optional(),
  source:      yup.string().optional(),
  status:      yup.string().optional(),
  company:     yup.string().optional(),
  alternatePhone:      yup.string().optional(),
  specialRequirements: yup.string().optional(),
  adminNotes:          yup.string().optional(),
  'billingAddress.street':  yup.string().optional(),
  'billingAddress.city':    yup.string().optional(),
  'billingAddress.state':   yup.string().optional(),
  'billingAddress.pincode': yup
    .string()
    .optional()
    .test('pincode', 'Pincode must be 6 digits', (val) => {
      if (!val || val.trim() === '') return true; // allow empty
      return /^\d{6}$/.test(val.trim());
    }),
});

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'corporate',  label: 'Corporate'  },
  { value: 'ngo',        label: 'NGO'        },
  { value: 'government', label: 'Government' },
];

const CLIENT_SOURCES = [
  { value: 'lead_conversion', label: 'Lead Conversion' },
  { value: 'direct',          label: 'Direct'          },
  { value: 'referral',        label: 'Referral'        },
  { value: 'social_media',    label: 'Social Media'    },
  { value: 'other',           label: 'Other'           },
];

const CLIENT_STATUSES = [
  { value: 'active',      label: 'Active',      color: 'green' },
  { value: 'inactive',    label: 'Inactive',    color: 'gray'  },
  { value: 'blacklisted', label: 'Blacklisted', color: 'red'   },
];

const DIETARY_OPTIONS = [
  { value: 'veg',         label: 'Veg'         },
  { value: 'non-veg',     label: 'Non-Veg'     },
  { value: 'vegan',       label: 'Vegan'       },
  { value: 'jain',        label: 'Jain'        },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'halal',       label: 'Halal'       },
];

// ── Strip empty strings and convert dot-notation to nested objects ──
const buildNestedPayload = (flatData) => {
  const result = {};
  Object.entries(flatData).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      if (!result[parent]) result[parent] = {};
      result[parent][child] = value;
    } else {
      result[key] = value;
    }
  });
  return result;
};

export default function ClientsPage() {
  const dispatch = useDispatch();
  const { clients, stats, pagination, isLoading, isSubmitting } =
    useSelector((s) => s.clients);

  // ── Modal States ──
  const [createModal,  setCreateModal]  = useState(false);
  const [editModal,    setEditModal]    = useState(false);
  const [viewModal,    setViewModal]    = useState(false);
  const [deleteModal,  setDeleteModal]  = useState(false);
  const [convertModal, setConvertModal] = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [leadId,       setLeadId]       = useState('');

  // ── Dietary state for both create and edit ──
  const [createDiet, setCreateDiet] = useState([]);
  const [editDiet,   setEditDiet]   = useState([]);

  // ── Filters ──
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [clientType, setClientType] = useState('');
  const [page,       setPage]       = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  // ── Forms ──
  const createForm = useForm({ resolver: yupResolver(clientSchema) });
  const editForm   = useForm({ resolver: yupResolver(clientSchema) });

  // ── Fetch ──
  const loadClients = useCallback(() => {
    dispatch(fetchClients({
      page, limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(status     && { status }),
      ...(clientType && { clientType }),
    }));
  }, [dispatch, page, debouncedSearch, status, clientType]);

  useEffect(() => {
    loadClients();
    dispatch(fetchClientStats());
  }, [loadClients]);

  // ── Handlers ──
  const handleCreate = async (data) => {
    const payload = buildNestedPayload({ ...data, dietaryPreferences: createDiet });
    const result  = await dispatch(createClient(payload));
    if (!result.error) {
      setCreateModal(false);
      createForm.reset();
      setCreateDiet([]);
    }
  };

  const handleEdit = async (data) => {
    const payload = buildNestedPayload({ ...data, dietaryPreferences: editDiet });
    const result  = await dispatch(updateClient({ id: selected._id, payload }));
    if (!result.error) {
      setEditModal(false);
      editForm.reset();
      setEditDiet([]);
    }
  };

  const handleDelete = async () => {
    await dispatch(deleteClient(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  const handleConvert = async () => {
    if (!leadId.trim()) return;
    const result = await dispatch(convertLeadToClient(leadId.trim()));
    if (!result.error) { setConvertModal(false); setLeadId(''); }
  };

  const openEdit = (client) => {
    setSelected(client);
    setEditDiet(client.dietaryPreferences || []);
    editForm.reset({
      name:        client.name        || '',
      email:       client.email       || '',
      phone:       client.phone       || '',
      clientType:  client.clientType  || '',
      source:      client.source      || '',
      status:      client.status      || 'active',
      company:     client.company     || '',
      alternatePhone:      client.alternatePhone      || '',
      specialRequirements: client.specialRequirements || '',
      adminNotes:          client.adminNotes          || '',
      'billingAddress.street':  client.billingAddress?.street  || '',
      'billingAddress.city':    client.billingAddress?.city    || '',
      'billingAddress.state':   client.billingAddress?.state   || '',
      'billingAddress.pincode': client.billingAddress?.pincode || '',
    });
    setEditModal(true);
  };

  const toggleDiet = (val, setter) => {
    setter((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );
  };

  const resetFilters = () => {
    setSearch(''); setStatus(''); setClientType(''); setPage(1);
  };

  // ── Reusable Client Form Body ──
  const ClientFormFields = ({ form, dietState, setDietState }) => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Full Name" name="name" required
          register={form.register}
          error={form.formState.errors.name}
          placeholder="John Doe" />
        <InputField label="Email" name="email" type="email" required
          register={form.register}
          error={form.formState.errors.email}
          placeholder="john@example.com" />
        <InputField label="Phone" name="phone" required
          register={form.register}
          error={form.formState.errors.phone}
          placeholder="9876543210" />
        <InputField label="Alternate Phone" name="alternatePhone"
          register={form.register}
          placeholder="Optional" />
        <InputField label="Company" name="company"
          register={form.register}
          placeholder="Company name (optional)" />
        <SelectField label="Client Type" name="clientType"
          register={form.register}
          options={CLIENT_TYPES}
          placeholder="Select type" />
        <SelectField label="Source" name="source"
          register={form.register}
          options={CLIENT_SOURCES}
          placeholder="Select source" />
        <SelectField label="Status" name="status"
          register={form.register}
          options={CLIENT_STATUSES}
          placeholder="Select status" />
      </div>

      {/* Billing Address */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Billing Address</p>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Street" name="billingAddress.street"
            register={form.register} placeholder="Street" />
          <InputField label="City" name="billingAddress.city"
            register={form.register} placeholder="City" />
          <InputField label="State" name="billingAddress.state"
            register={form.register} placeholder="State" />
          <InputField label="Pincode" name="billingAddress.pincode"
            register={form.register}
            error={form.formState.errors?.['billingAddress.pincode']}
            placeholder="6-digit pincode" />
        </div>
      </div>

      {/* Special Requirements */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Special Requirements
        </label>
        <textarea rows={2} placeholder="Any special requirements..."
          className="input-field resize-none"
          {...form.register('specialRequirements')} />
      </div>

      {/* Dietary Preferences */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Dietary Preferences
        </p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((d) => (
            <button key={d.value} type="button"
              onClick={() => toggleDiet(d.value, setDietState)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border
                          transition-colors ${
                dietState.includes(d.value)
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
              }`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Admin Notes</label>
        <textarea rows={2} placeholder="Internal notes..."
          className="input-field resize-none"
          {...form.register('adminNotes')} />
      </div>
    </>
  );

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total || 0} total clients
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setConvertModal(true)}
            className="btn-secondary flex items-center gap-2">
            <FiUserCheck size={15} /> Convert Lead
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="btn-primary flex items-center gap-2">
            <FiPlus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total Clients',     value: stats.totalClients,     icon: FiUsers,     color: 'blue'   },
            { label: 'Active Clients',    value: stats.activeClients,    icon: FiUserCheck, color: 'green'  },
            { label: 'Corporate Clients', value: stats.corporateClients, icon: FiStar,      color: 'purple' },
            { label: 'Top Spender',
              value: stats.topSpenders?.[0]?.name || '—',
              icon: FiTrendingUp, color: 'yellow' },
          ].map(({ label, value, icon: Icon, color }) => {
            const colorMap = {
              blue:   'bg-blue-100 text-blue-600',
              green:  'bg-green-100 text-green-600',
              purple: 'bg-purple-100 text-purple-600',
              yellow: 'bg-yellow-100 text-yellow-600',
            };
            return (
              <div key={label} className="card flex items-center gap-3">
                <div className={`p-3 rounded-xl ${colorMap[color]}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8"
            />
          </div>
          <select value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input-field w-36">
            <option value="">All Status</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select value={clientType}
            onChange={(e) => { setClientType(e.target.value); setPage(1); }}
            className="input-field w-36">
            <option value="">All Types</option>
            {CLIENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button onClick={resetFilters}
            className="btn-secondary flex items-center gap-2">
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? <Loader /> : clients.length === 0 ? (
          <EmptyState
            title="No clients found"
            description="Add a client directly or convert a lead"
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> Add Client
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Client','Phone','Type','Source','Orders','Total Spent','Status','Actions']
                      .map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                               text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map((client) => {
                    const statusInfo = CLIENT_STATUSES.find((s) => s.value === client.status);
                    return (
                      <tr key={client._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex
                                            items-center justify-center text-brand
                                            font-bold text-sm shrink-0">
                              {client.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{client.name}</p>
                              <p className="text-xs text-gray-400">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{client.phone}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={capitalize(client.clientType)}
                            color={client.clientType === 'corporate' ? 'blue' : 'gray'}
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize">
                          {client.source?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-700">
                          {client.totalOrders || 0}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {formatCurrency(client.totalSpent)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={statusInfo?.label} color={statusInfo?.color} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setSelected(client); setViewModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500
                                         transition-colors" title="View">
                              <FiEye size={15} />
                            </button>
                            <button onClick={() => openEdit(client)}
                              className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500
                                         transition-colors" title="Edit">
                              <FiEdit2 size={15} />
                            </button>
                            <button
                              onClick={() => { setSelected(client); setDeleteModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500
                                         transition-colors" title="Delete">
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

      {/* ───────────────────────────────────────
          MODALS
      ─────────────────────────────────────── */}

      {/* ── Create Client Modal ── */}
      <Modal isOpen={createModal}
        onClose={() => { setCreateModal(false); createForm.reset(); setCreateDiet([]); }}
        title="Add New Client" size="lg">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <ClientFormFields
            form={createForm}
            dietState={createDiet}
            setDietState={setCreateDiet}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button"
              onClick={() => { setCreateModal(false); createForm.reset(); setCreateDiet([]); }}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Client Modal ── */}
      <Modal isOpen={editModal}
        onClose={() => { setEditModal(false); editForm.reset(); setEditDiet([]); }}
        title="Edit Client" size="lg">
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          <ClientFormFields
            form={editForm}
            dietState={editDiet}
            setDietState={setEditDiet}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button"
              onClick={() => { setEditModal(false); editForm.reset(); setEditDiet([]); }}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Client Modal ── */}
      <Modal isOpen={viewModal}
        onClose={() => setViewModal(false)}
        title="Client Details" size="md">
        {selected && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center
                              justify-center text-brand font-bold text-2xl">
                {selected.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.email}</p>
                <p className="text-sm text-gray-500">{selected.phone}</p>
              </div>
              <div className="ml-auto">
                <Badge
                  label={CLIENT_STATUSES.find((s) => s.value === selected.status)?.label}
                  color={CLIENT_STATUSES.find((s) => s.value === selected.status)?.color}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Orders', value: selected.totalOrders || 0 },
                { label: 'Total Spent',  value: formatCurrency(selected.totalSpent) },
                { label: 'Last Order',   value: formatDate(selected.lastOrderDate) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-brand mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Client Type', value: capitalize(selected.clientType) },
                { label: 'Source',      value: selected.source?.replace(/_/g, ' ') },
                { label: 'Company',     value: selected.company     || '—' },
                { label: 'Alt Phone',   value: selected.alternatePhone || '—' },
                { label: 'Street',      value: selected.billingAddress?.street  || '—' },
                { label: 'City',        value: selected.billingAddress?.city    || '—' },
                { label: 'State',       value: selected.billingAddress?.state   || '—' },
                { label: 'Pincode',     value: selected.billingAddress?.pincode || '—' },
                { label: 'Joined',      value: formatDate(selected.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800 capitalize">{value}</p>
                </div>
              ))}
            </div>

            {/* Dietary Preferences */}
            {selected.dietaryPreferences?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  Dietary Preferences
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.dietaryPreferences.map((d) => (
                    <span key={d}
                      className="px-2 py-1 bg-green-100 text-green-700
                                 text-xs rounded-full font-medium capitalize">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {selected.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span key={tag}
                    className="px-2 py-1 bg-purple-100 text-purple-700
                               text-xs rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Special Requirements */}
            {selected.specialRequirements && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium mb-1">
                  Special Requirements
                </p>
                <p className="text-sm text-gray-700">{selected.specialRequirements}</p>
              </div>
            )}

            {/* Admin Notes */}
            {selected.adminNotes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-xs text-yellow-600 font-medium mb-1">Admin Notes</p>
                <p className="text-sm text-gray-700">{selected.adminNotes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Convert Lead Modal ── */}
      <Modal isOpen={convertModal}
        onClose={() => { setConvertModal(false); setLeadId(''); }}
        title="Convert Lead to Client" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the Lead ID to convert it into a client. You can find
            the Lead ID from the Leads page.
          </p>
          <InputField
            label="Lead ID"
            name="leadId"
            placeholder="Paste Lead ObjectId here"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setConvertModal(false)}
              className="btn-secondary">Cancel</button>
            <button
              onClick={handleConvert}
              disabled={!leadId.trim() || isSubmitting}
              className="btn-primary">
              {isSubmitting ? 'Converting...' : 'Convert to Client'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Client" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{selected?.name}</span>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)}
              className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
