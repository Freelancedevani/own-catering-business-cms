import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchContacts, createContact,
  updateContact, deleteContact, syncContacts,
  importContacts, exportContacts,
} from '../../features/contacts/contactBookSlice';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2,
  FiRefreshCw, FiPhone, FiUsers, FiDownloadCloud,
  FiUpload, FiDownload,
} from 'react-icons/fi';
import Modal      from '../../components/ui/Modal';
import Badge      from '../../components/ui/Badge';
import Loader     from '../../components/ui/Loader';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import InputField from '../../components/forms/InputField';
import { useDebounce } from '../../hooks/useDebounce';

const SOURCE_COLORS = {
  lead:   'blue',
  client: 'green',
  staff:  'purple',
  manual: 'gray',
};

// Defined OUTSIDE ContactBookPage so it keeps a stable component identity
// across re-renders. When a form component is declared inside another
// component's body, React sees a "new" component type on every re-render
// (e.g. every keystroke) and remounts it — which is what was kicking focus
// out of the address inputs after a single character.
function ContactForm({ form, setForm, onSubmit, onCancel, submitLabel, isSubmitting }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <InputField
        label="Full Name" name="name" required
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        placeholder="John Doe"
      />
      <InputField
        label="Phone Number" name="phone" required
        value={form.phone}
        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        placeholder="9876543210"
      />
      <div className="border-t pt-3">
        <p className="text-sm font-semibold text-gray-700 mb-3">Address <span className="text-xs font-normal text-gray-400">(optional — leave blank to mark as nil)</span></p>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Street" name="street"
            value={form.street}
            onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
            placeholder="Street" />
          <InputField label="City" name="city"
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            placeholder="City" />
          <InputField label="State" name="state"
            value={form.state}
            onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
            placeholder="State" />
          <InputField label="Pincode" name="pincode"
            value={form.pincode}
            onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))}
            placeholder="Pincode" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <textarea
          rows={2}
          placeholder="Optional notes..."
          className="input-field resize-none"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// Keep in sync with COLUMN_MAP keys on the backend
const EXPORT_FIELDS = [
  { key: 'name',      label: 'Name' },
  { key: 'phone',     label: 'Phone' },
  { key: 'address',   label: 'Address (combined)' },
  { key: 'street',    label: 'Street' },
  { key: 'city',      label: 'City' },
  { key: 'state',     label: 'State' },
  { key: 'pincode',   label: 'Pincode' },
  { key: 'source',    label: 'Source' },
  { key: 'notes',     label: 'Notes' },
  { key: 'createdAt', label: 'Added On' },
];

export default function ContactBookPage() {
  const dispatch = useDispatch();
  const { contacts, pagination, isLoading, isSubmitting, isSyncing, isImporting, isExporting } =
    useSelector((s) => s.contacts);

  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [selected,    setSelected]    = useState(null);

  const EMPTY_FORM = { name: '', phone: '', notes: '', street: '', city: '', state: '', pincode: '' };
  const [form, setForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [page,   setPage]   = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  // Export field selection — defaults to Name + Phone only
  const [exportFields, setExportFields] = useState(['name', 'phone']);

  const fileInputRef = useRef(null);

  const loadContacts = useCallback(() => {
    dispatch(fetchContacts({
      page, limit: 20,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(source && { source }),
    }));
  }, [dispatch, page, debouncedSearch, source]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const resetForm = () => setForm(EMPTY_FORM);

  const handleCreate = async (e) => {
    e.preventDefault();
    const result = await dispatch(createContact(buildPayload(form)));
    if (!result.error) { setCreateModal(false); resetForm(); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const result = await dispatch(updateContact({ id: selected._id, payload: buildPayload(form) }));
    if (!result.error) { setEditModal(false); resetForm(); }
  };

  const handleDelete = async () => {
    await dispatch(deleteContact(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  const buildPayload = ({ name, phone, notes, street, city, state, pincode }) => ({
    name, phone, notes,
    address: { street: street || null, city: city || null, state: state || null, pincode: pincode || null },
  });

  const openEdit = (contact) => {
    setSelected(contact);
    setForm({
      name:    contact.name,
      phone:   contact.phone,
      notes:   contact.notes   || '',
      street:  contact.address?.street  || '',
      city:    contact.address?.city    || '',
      state:   contact.address?.state   || '',
      pincode: contact.address?.pincode || '',
    });
    setEditModal(true);
  };

  // ── Import handlers ──
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await dispatch(importContacts(file));
    e.target.value = ''; // allow re-selecting the same file later
  };

  // ── Export handlers ──
  const toggleExportField = (key) => {
    setExportFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    const fields = exportFields.length ? exportFields : ['name', 'phone'];
    await dispatch(exportContacts({ fields, search: debouncedSearch, source }));
    setExportModal(false);
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contact Book</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total || 0} total contacts — auto-collected from leads, clients & staff
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChosen}
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="btn-secondary flex items-center gap-2"
          >
            <FiUpload size={15} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={() => setExportModal(true)}
            disabled={isExporting}
            className="btn-secondary flex items-center gap-2"
          >
            <FiDownload size={15} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            onClick={() => dispatch(syncContacts())}
            disabled={isSyncing}
            className="btn-secondary flex items-center gap-2"
          >
            <FiDownloadCloud size={15} />
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus size={15} /> Add Contact
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search name or phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8"
            />
          </div>
          <select
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="input-field w-36"
          >
            <option value="">All Sources</option>
            <option value="lead">Lead</option>
            <option value="client">Client</option>
            <option value="staff">Staff</option>
            <option value="manual">Manual</option>
          </select>
          <button
            onClick={() => { setSearch(''); setSource(''); setPage(1); }}
            className="btn-secondary flex items-center gap-2"
          >
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? <Loader /> : contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Contacts are auto-added when leads or clients are created. You can also add manually or import from Excel."
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> Add Contact
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Contact', 'Phone', 'Address', 'Source', 'Notes', 'Actions'].map((h) => (
                      <th key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center
                                          justify-center text-brand font-bold text-sm shrink-0">
                            {c.name?.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <FiPhone size={13} />
                          {c.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.address?.city && c.address?.state
                          ? `${c.address.city}, ${c.address.state}`
                          : c.address?.city || c.address?.state || <span className="text-gray-300">nil</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={c.source.charAt(0).toUpperCase() + c.source.slice(1)}
                          color={SOURCE_COLORS[c.source] || 'gray'}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {c.notes || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            onClick={() => { setSelected(c); setDeleteModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Delete"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {/* ── Create Modal ── */}
      <Modal isOpen={createModal}
        onClose={() => { setCreateModal(false); resetForm(); }}
        title="Add Contact" size="sm">
        <ContactForm
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          onCancel={() => { setCreateModal(false); resetForm(); }}
          submitLabel="Add Contact"
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal isOpen={editModal}
        onClose={() => { setEditModal(false); resetForm(); }}
        title="Edit Contact" size="sm">
        <ContactForm
          form={form}
          setForm={setForm}
          onSubmit={handleEdit}
          onCancel={() => { setEditModal(false); resetForm(); }}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Contact" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{selected?.name}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>

      {/* ── Export Modal ── */}
      <Modal isOpen={exportModal}
        onClose={() => setExportModal(false)}
        title="Export Contacts" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose which columns to include. Defaults to Name + Phone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportFields.includes(key)}
                  onChange={() => toggleExportField(key)}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
          {exportFields.length === 0 && (
            <p className="text-xs text-amber-600">No columns selected — export will default to Name + Phone.</p>
          )}
          {(debouncedSearch || source) && (
            <p className="text-xs text-gray-400">
              Applies your current search/source filter to the export.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setExportModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleExport} disabled={isExporting} className="btn-primary">
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}