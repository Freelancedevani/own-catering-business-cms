import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStaff, fetchStaffStats, createStaff, updateStaff,
  markAttendance, deleteStaff, uploadProfilePic, removeProfilePic, changePassword,
} from '../../features/staff/staffSlice';
import { fetchWallet, creditWallet, withdrawWallet, clearWallet } from '../../features/staff/staffWalletSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiRefreshCw,
  FiUsers, FiCheckCircle, FiClock, FiCalendar, FiDollarSign,
  FiCreditCard, FiArrowUpCircle, FiArrowDownCircle, FiTrendingUp,
  FiCamera, FiLock,
} from 'react-icons/fi';
import Modal      from '../../components/ui/Modal';
import Badge      from '../../components/ui/Badge';
import Loader     from '../../components/ui/Loader';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import InputField  from '../../components/forms/InputField';
import SelectField from '../../components/forms/SelectField';
import { formatDate, formatCurrency, capitalize } from '../../utils/formatters';
import { STAFF_ROLES } from '../../utils/constants';
import { useDebounce } from '../../hooks/useDebounce';
import dayjs from 'dayjs';

// ─── Constants ────────────────────────────────────────────────
const DEPARTMENTS = [
  { value: 'kitchen',    label: 'Kitchen'    },
  { value: 'service',    label: 'Service'    },
  { value: 'delivery',   label: 'Delivery'   },
  { value: 'management', label: 'Management' },
  { value: 'accounts',   label: 'Accounts'   },
  { value: 'cleaning',   label: 'Cleaning'   },
  { value: 'other',      label: 'Other'      },
];

const GENDERS = [
  { value: 'male',   label: 'Male'   },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other'  },
];

// ✅ Fixed enum values — match backend exactly
const SALARY_TYPES = [
  { value: 'monthly',   label: 'Monthly'   },
  { value: 'daily',     label: 'Daily'     },
  { value: 'hourly',    label: 'Hourly'    },
  { value: 'per_event', label: 'Per Event' },
];

const STAFF_STATUSES = [
  { value: 'active',     label: 'Active',     color: 'green'  },
  { value: 'inactive',   label: 'Inactive',   color: 'gray'   },
  { value: 'on_leave',   label: 'On Leave',   color: 'yellow' },
  { value: 'terminated', label: 'Terminated', color: 'red'    },
];

const ATTENDANCE_STATUSES = [
  { value: 'present',  label: 'Present'  },
  { value: 'absent',   label: 'Absent'   },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave',    label: 'Leave'    },
];

// ✅ Fixed ATT_COLORS keys match backend enum values
const ATT_COLORS = {
  present:  'green',
  absent:   'red',
  half_day: 'yellow',
  leave:    'blue',
};

const CREDIT_SOURCES = [
  { value: 'monthly_salary', label: 'Monthly Salary' },
  { value: 'bonus',          label: 'Bonus'          },
  { value: 'adjustment',     label: 'Adjustment'     },
];

const WITHDRAW_SOURCES = [
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'advance',    label: 'Advance'    },
];

const SOURCE_LABELS = {
  order_fee:      'Order Fee',
  monthly_salary: 'Monthly Salary',
  bonus:          'Bonus',
  advance:        'Advance',
  withdrawal:     'Withdrawal',
  penalty:        'Penalty',
  adjustment:     'Adjustment',
};

// ─── Yup Schemas ─────────────────────────────────────────────
const staffSchema = yup.object({
  name:           yup.string().min(2).required('Name is required'),
  phone:          yup.string().required('Phone is required'),
  email:          yup.string().email('Invalid email').optional().nullable(),
  role:           yup.string().required('Role is required'),
  department:     yup.string().optional(),
  gender:         yup.string().optional(),
  salaryType:     yup.string().required('Salary type is required'),
  salaryAmount:   yup.number().min(0).required('Salary amount is required'),
  joiningDate:    yup.string().optional(),
  addressStreet:  yup.string().optional(),
  addressCity:    yup.string().optional(),
  addressState:   yup.string().optional(),
  addressPincode: yup.string().optional(),
  bankAccountName:   yup.string().optional(),
  bankAccountNumber: yup.string().optional(),
  bankName:          yup.string().optional(),
  bankIfscCode:      yup.string().optional(),
  bankUpiId:         yup.string().optional(),
});

const createStaffSchema = staffSchema.shape({
  password: yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

const attendanceSchema = yup.object({
  date:     yup.string().required('Date is required'),
  status:   yup.string().required('Status is required'),
  notes:    yup.string().optional(),
  overtime: yup.number().min(0).optional(),
});

const walletCreditSchema = yup.object({
  amount:      yup.number().min(1, 'Min 1').required('Amount is required'),
  source:      yup.string().required('Source is required'),
  description: yup.string().optional(),
});

const walletWithdrawSchema = yup.object({
  amount:      yup.number().min(1, 'Min 1').required('Amount is required'),
  source:      yup.string().required('Type is required'),
  description: yup.string().optional(),
});

const passwordSchema = yup.object({
  newPassword:     yup.string().min(6, 'Min 6 characters').required('Password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm password'),
});

// ─── Helpers ─────────────────────────────────────────────────
// ✅ Fixed: never sends empty optional fields to backend
const buildPayload = (data) => {
  const address = {
    ...(data.addressStreet?.trim()  && { street:  data.addressStreet.trim()  }),
    ...(data.addressCity?.trim()    && { city:    data.addressCity.trim()    }),
    ...(data.addressState?.trim()   && { state:   data.addressState.trim()   }),
    ...(data.addressPincode?.trim() && { pincode: data.addressPincode.trim() }),
  };

  const bankDetails = {
    ...(data.bankAccountName?.trim()   && { accountName:   data.bankAccountName.trim()           }),
    ...(data.bankAccountNumber?.trim() && { accountNumber: data.bankAccountNumber.trim()          }),
    ...(data.bankName?.trim()          && { bankName:      data.bankName.trim()                   }),
    ...(data.bankIfscCode?.trim()      && { ifscCode:      data.bankIfscCode.trim().toUpperCase() }),
    ...(data.bankUpiId?.trim()         && { upiId:         data.bankUpiId.trim()                  }),
  };

  return {
    name:  data.name?.trim(),
    phone: data.phone?.trim(),
    ...(data.email?.trim()      && { email:      data.email.trim()       }),
    ...(data.role               && { role:       data.role               }),
    ...(data.department         && { department: data.department         }),
    ...(data.gender             && { gender:     data.gender             }),
    ...(data.salaryType         && { salaryType: data.salaryType         }),
    ...(data.salaryAmount != null && data.salaryAmount !== '' && {
      salaryAmount: Number(data.salaryAmount),
    }),
    ...(data.joiningDate        && { joiningDate: data.joiningDate       }),
    ...(Object.keys(address).length     > 0 && { address     }),
    ...(Object.keys(bankDetails).length > 0 && { bankDetails }),
  };
};

const flattenStaff = (m) => ({
  name:              m.name,
  phone:             m.phone,
  email:             m.email,
  role:              m.role,
  department:        m.department,
  gender:            m.gender,
  salaryType:        m.salaryType,
  salaryAmount:      m.salaryAmount || 0,
  joiningDate:       m.joiningDate ? dayjs(m.joiningDate).format('YYYY-MM-DD') : '',
  addressStreet:     m.address?.street     || '',
  addressCity:       m.address?.city       || '',
  addressState:      m.address?.state      || '',
  addressPincode:    m.address?.pincode    || '',
  bankAccountName:   m.bankDetails?.accountName   || '',
  bankAccountNumber: m.bankDetails?.accountNumber || '',
  bankName:          m.bankDetails?.bankName       || '',
  bankIfscCode:      m.bankDetails?.ifscCode       || '',
  bankUpiId:         m.bankDetails?.upiId          || '',
});

// ─── StaffAvatar ─────────────────────────────────────────────
function StaffAvatar({ member, size = 'md', onClick }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-2xl' };
  return (
    <div
      onClick={onClick}
      className={`${sizes[size]} rounded-full shrink-0 overflow-hidden bg-primary-100 flex items-center justify-center text-brand font-bold ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      {member?.profilePic?.url
        ? <img src={member.profilePic.url} alt={member.name} className="w-full h-full object-cover" />
        : member?.name?.charAt(0).toUpperCase()
      }
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────
function TabBar({ active, onChange }) {
  const tabs = [
    { key: 'basic',  label: 'Basic Info'       },
    { key: 'salary', label: 'Salary & Address' },
    { key: 'bank',   label: 'Bank Details'     },
  ];
  return (
    <div className="flex border-b border-gray-100 gap-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === t.key
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── StaffPage ────────────────────────────────────────────────
export default function StaffPage() {
  const dispatch = useDispatch();
  const { staff, stats, pagination, isLoading, isSubmitting, isUploading } = useSelector((s) => s.staff);
  const { currentWallet, transactions, isLoading: walletLoading, isSubmitting: walletSubmitting } = useSelector((s) => s.staffWallet);

  // Modal states
  const [createModal,    setCreateModal]    = useState(false);
  const [editModal,      setEditModal]      = useState(false);
  const [viewModal,      setViewModal]      = useState(false);
  const [deleteModal,    setDeleteModal]    = useState(false);
  const [attendanceModal,setAttendanceModal]= useState(false);
  const [walletModal,    setWalletModal]    = useState(false);
  const [creditModal,    setCreditModal]    = useState(false);
  const [withdrawModal,  setWithdrawModal]  = useState(false);
  const [passwordModal,  setPasswordModal]  = useState(false);

  const [selected,   setSelected]   = useState(null);
  const [activeTab,  setActiveTab]  = useState('basic');
  const [picPreview, setPicPreview] = useState(null);
  const [picFile,    setPicFile]    = useState(null);
  const picInputRef = useRef(null);
  const editPicRef  = useRef(null);

  // Filters
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  const [status, setStatus] = useState('');
  const [page,   setPage]   = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  // Forms
  const createForm     = useForm({ resolver: yupResolver(createStaffSchema) });
  const editForm       = useForm({ resolver: yupResolver(staffSchema) });
  const attendanceForm = useForm({ resolver: yupResolver(attendanceSchema) });
  const creditForm     = useForm({ resolver: yupResolver(walletCreditSchema) });
  const withdrawForm   = useForm({ resolver: yupResolver(walletWithdrawSchema) });
  const passwordForm   = useForm({ resolver: yupResolver(passwordSchema) });

  // Fetch
  const loadStaff = useCallback(() => {
    dispatch(fetchStaff({
      page, limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(role   && { role   }),
      ...(status && { status }),
    }));
  }, [dispatch, page, debouncedSearch, role, status]);

  useEffect(() => {
    loadStaff();
    dispatch(fetchStaffStats());
  }, [loadStaff]);

  // ─── Tab navigation with per-tab validation ───────────────
  // ✅ Fixed: validates only current tab fields before advancing
  const handleNextTab = async () => {
    const tabFields = {
      basic:  ['name', 'phone', 'email', 'role', 'department', 'gender', 'joiningDate', 'password'],
      salary: ['salaryAmount', 'salaryType'],
    };
    const isValid = await createForm.trigger(tabFields[activeTab] || []);
    if (isValid) setActiveTab(activeTab === 'basic' ? 'salary' : 'bank');
  };

  const handleEditNextTab = async () => {
    const tabFields = {
      basic:  ['name', 'phone', 'email', 'role', 'department', 'gender', 'joiningDate', 'status'],
      salary: ['salaryAmount', 'salaryType'],
    };
    const isValid = await editForm.trigger(tabFields[activeTab] || []);
    if (isValid) setActiveTab(activeTab === 'basic' ? 'salary' : 'bank');
  };

  // ─── Staff Handlers ───────────────────────────────────────
  // ✅ Fixed: uses result.payload?._id (MongoDB _id, not id)
  const handleCreate = async (data) => {
    const payload = { ...buildPayload(data), password: data.password };
    const result  = await dispatch(createStaff(payload));

    if (!result.error) {
      if (picFile && result.payload?._id) {
        await dispatch(uploadProfilePic({ id: result.payload._id, file: picFile }));
      }
      setCreateModal(false);
      createForm.reset();
      setPicPreview(null);
      setPicFile(null);
      setActiveTab('basic');
    }
  };

  const handleEdit = async (data) => {
    const result = await dispatch(updateStaff({
      id:      selected._id || selected.id,
      payload: buildPayload(data),
    }));
    if (!result.error) {
      setEditModal(false);
      editForm.reset();
    }
  };

  const handleAttendance = async (data) => {
    const result = await dispatch(markAttendance({ id: selected._id, payload: data }));
    if (!result.error) {
      setAttendanceModal(false);
      attendanceForm.reset();
    }
  };

  const handleDelete = async () => {
    await dispatch(deleteStaff(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  // Profile pic handlers
  const handlePicChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
    if (isEdit && selected) {
      dispatch(uploadProfilePic({ id: selected._id, file }));
    }
  };

  const handleRemovePic = async () => {
    if (selected?.profilePic?.publicId) {
      await dispatch(removeProfilePic(selected._id));
    }
    setPicPreview(null);
    setPicFile(null);
  };

  // Password handler
  const handlePasswordChange = async (data) => {
    const result = await dispatch(changePassword({ id: selected._id, newPassword: data.newPassword }));
    if (!result.error) {
      setPasswordModal(false);
      passwordForm.reset();
    }
  };

  // Open helpers
  const openEdit = (member) => {
    setSelected(member);
    editForm.reset(flattenStaff(member));
    setPicPreview(null);
    setPicFile(null);
    setActiveTab('basic');
    setEditModal(true);
  };

  const openAttendance = (member) => {
    setSelected(member);
    attendanceForm.reset({ date: dayjs().format('YYYY-MM-DD'), status: 'present', overtime: 0 });
    setAttendanceModal(true);
  };

  const resetFilters = () => { setSearch(''); setRole(''); setStatus(''); setPage(1); };

  // Wallet handlers
  const openWallet = (member) => {
    setSelected(member);
    dispatch(fetchWallet({ staffId: member._id, params: { limit: 20 } }));
    setWalletModal(true);
  };

  const handleCredit = async (data) => {
    const result = await dispatch(creditWallet({
      staffId: selected._id,
      payload: { amount: Number(data.amount), source: data.source, description: data.description },
    }));
    if (!result.error) { setCreditModal(false); creditForm.reset(); }
  };

  const handleWithdraw = async (data) => {
    const result = await dispatch(withdrawWallet({
      staffId: selected._id,
      payload: { amount: Number(data.amount), source: data.source, description: data.description },
    }));
    if (!result.error) { setWithdrawModal(false); withdrawForm.reset(); }
  };

  // Today's attendance count
  const todayPresent = staff.filter((m) => {
    const today = dayjs().format('YYYY-MM-DD');
    return m.attendance?.some((a) => dayjs(a.date).format('YYYY-MM-DD') === today && a.status === 'present');
  }).length;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total || 0} total members</p>
        </div>
        <button
          onClick={() => { setActiveTab('basic'); setPicPreview(null); setPicFile(null); setCreateModal(true); }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus size={16} /> Add Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff',    value: stats?.total   || 0, icon: FiUsers,        bg: 'bg-purple-100 text-purple-600' },
          { label: 'Active',         value: stats?.active  || 0, icon: FiCheckCircle,  bg: 'bg-green-100 text-green-600'   },
          { label: 'On Leave',       value: stats?.onLeave || 0, icon: FiClock,        bg: 'bg-yellow-100 text-yellow-600' },
          { label: 'Present Today',  value: todayPresent,        icon: FiCalendar,     bg: 'bg-blue-100 text-blue-600'     },
        ].map(({ label, value, icon: Icon, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`p-3 rounded-xl ${bg}`}><Icon size={18} /></div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search name, phone..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8"
            />
          </div>
          <select value={role}   onChange={(e) => { setRole(e.target.value);   setPage(1); }} className="input-field w-36">
            <option value="">All Roles</option>
            {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-36">
            <option value="">All Status</option>
            {STAFF_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={resetFilters} className="btn-secondary flex items-center gap-2">
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? <Loader /> : staff.length === 0 ? (
          <EmptyState
            title="No staff members found"
            description="Add your first team member..."
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> Add Staff
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Staff', 'Role & Dept', 'Phone', 'Salary', 'Wallet Balance', 'Joined', 'Status', 'Today', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((member) => {
                  const statusInfo = STAFF_STATUSES.find((s) => s.value === member.status);
                  const today      = dayjs().format('YYYY-MM-DD');
                  const todayAtt   = member.attendance?.find((a) => dayjs(a.date).format('YYYY-MM-DD') === today);
                  return (
                    <tr key={member._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StaffAvatar member={member} size="md" />
                          <div>
                            <p className="font-semibold text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-400">{member.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 capitalize">{member.role?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400 capitalize">{member.department}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{member.phone}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{formatCurrency(member.salaryAmount)}</p>
                        <p className="text-xs text-gray-400 capitalize">{member.salaryType?.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-blue-600">{formatCurrency(member.pendingBalance || 0)}</p>
                        <p className="text-xs text-gray-400">Earned {formatCurrency(member.totalEarned || 0)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(member.joiningDate)}</td>
                      <td className="px-4 py-3"><Badge label={statusInfo?.label} color={statusInfo?.color} /></td>
                      <td className="px-4 py-3">
                        {todayAtt
                          ? <Badge label={capitalize(todayAtt.status?.replace(/_/g, ' '))} color={ATT_COLORS[todayAtt.status] || 'gray'} />
                          : <span className="text-xs text-gray-400 italic">Not marked</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setSelected(member); setViewModal(true); }}   className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"   title="View"><FiEye size={14} /></button>
                          <button onClick={() => openEdit(member)}                               className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors" title="Edit"><FiEdit2 size={14} /></button>
                          <button onClick={() => openAttendance(member)}                         className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-colors"   title="Mark Attendance"><FiCheckCircle size={14} /></button>
                          <button onClick={() => openWallet(member)}                             className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-500 transition-colors" title="Wallet"><FiCreditCard size={14} /></button>
                          <button onClick={() => { setSelected(member); passwordForm.reset(); setPasswordModal(true); }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition-colors" title="Change Password"><FiLock size={14} /></button>
                          <button onClick={() => { setSelected(member); setDeleteModal(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"     title="Delete"><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={pagination?.totalPages || 1} onPageChange={setPage} />

      {/* ── CREATE MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={createModal}
        onClose={() => { setCreateModal(false); createForm.reset(); setPicPreview(null); setPicFile(null); }}
        title="Add Staff Member"
        size="lg"
      >
        <TabBar active={activeTab} onChange={setActiveTab} />
        {/* ✅ Fixed: onKeyDown prevents accidental Enter-key form submission */}
        <form
          onSubmit={createForm.handleSubmit(handleCreate)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}
        >
          {/* Tab: Basic */}
          {activeTab === 'basic' && (
            <div className="space-y-4 mt-4">
              {/* Profile pic picker */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center text-brand font-bold text-2xl shrink-0">
                  {picPreview
                    ? <img src={picPreview} alt="preview" className="w-full h-full object-cover" />
                    : <span>{createForm.watch('name')?.charAt(0)?.toUpperCase()}</span>
                  }
                  <button type="button" onClick={() => picInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-full">
                    <FiCamera size={18} />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Profile Picture</p>
                  <p className="text-xs text-gray-400">JPG, PNG or WebP · Max 2MB</p>
                  <button type="button" onClick={() => picInputRef.current?.click()} className="text-xs text-brand font-medium mt-1 hover:underline">
                    {picPreview ? 'Change photo' : 'Upload photo'}
                  </button>
                  {picPreview && (
                    <button type="button" onClick={() => { setPicPreview(null); setPicFile(null); }} className="text-xs text-red-400 font-medium mt-1 ml-3 hover:underline">Remove</button>
                  )}
                </div>
                <input ref={picInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePicChange(e, false)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Full Name"     name="name"     required register={createForm.register} error={createForm.formState.errors.name}     placeholder="Ramesh Kumar" />
                <InputField label="Phone"         name="phone"    required register={createForm.register} error={createForm.formState.errors.phone}    placeholder="9876543210" />
                <InputField label="Email"         name="email"    type="email" register={createForm.register} error={createForm.formState.errors.email} placeholder="ramesh@catering.com" />
                <SelectField label="Gender"       name="gender"   register={createForm.register} options={GENDERS}       placeholder="Select gender" />
                <SelectField label="Role"         name="role"     required register={createForm.register} error={createForm.formState.errors.role} options={STAFF_ROLES}   placeholder="Select role" />
                <SelectField label="Department"   name="department" register={createForm.register} options={DEPARTMENTS}  placeholder="Select department" />
                <InputField label="Joining Date"  name="joiningDate" type="date" register={createForm.register} />
                <InputField label="App Password"  name="password" type="password" required register={createForm.register} error={createForm.formState.errors.password} placeholder="Min 6 characters" />
              </div>
            </div>
          )}

          {/* Tab: Salary & Address */}
          {activeTab === 'salary' && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField  label="Salary Amount" name="salaryAmount" type="number" required register={createForm.register} error={createForm.formState.errors.salaryAmount} placeholder="25000" />
                <SelectField label="Salary Type"   name="salaryType"   required register={createForm.register} error={createForm.formState.errors.salaryType} options={SALARY_TYPES} placeholder="Select type" />
              </div>
              <p className="text-sm font-semibold text-gray-700 border-t pt-3">Address</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><InputField label="Street" name="addressStreet" register={createForm.register} placeholder="45 Park Lane" /></div>
                <InputField label="City"    name="addressCity"    register={createForm.register} placeholder="Mumbai" />
                <InputField label="State"   name="addressState"   register={createForm.register} placeholder="Maharashtra" />
                <InputField label="Pincode" name="addressPincode" register={createForm.register} placeholder="400001" />
              </div>
            </div>
          )}

          {/* Tab: Bank */}
          {activeTab === 'bank' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <InputField label="Account Holder Name" name="bankAccountName"   register={createForm.register} placeholder="Ramesh Kumar" />
              <InputField label="Account Number"      name="bankAccountNumber" register={createForm.register} placeholder="1234567890" />
              <InputField label="Bank Name"           name="bankName"          register={createForm.register} placeholder="SBI" />
              <InputField label="IFSC Code"           name="bankIfscCode"      register={createForm.register} placeholder="SBIN0001234" />
              <InputField label="UPI ID"              name="bankUpiId"         register={createForm.register} placeholder="ramesh@upi" />
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex justify-between items-center pt-5 mt-2 border-t">
            <div className="flex gap-2">
              {activeTab !== 'basic' && (
                <button type="button" onClick={() => setActiveTab(activeTab === 'bank' ? 'salary' : 'basic')} className="btn-secondary">Back</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancel</button>
              {/* ✅ Fixed: Next validates current tab before advancing */}
              {activeTab !== 'bank' ? (
                <button type="button" onClick={handleNextTab} className="btn-primary">Next</button>
              ) : (
                <button type="submit" disabled={isSubmitting || isUploading} className="btn-primary">
                  {isSubmitting ? 'Saving...' : isUploading ? 'Uploading pic...' : 'Add Staff'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── EDIT MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={editModal}
        onClose={() => { setEditModal(false); editForm.reset(); }}
        title="Edit Staff Member"
        size="lg"
      >
        <TabBar active={activeTab} onChange={setActiveTab} />
        {/* ✅ Fixed: same Enter-key guard */}
        <form
          onSubmit={editForm.handleSubmit(handleEdit)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}
        >
          {activeTab === 'basic' && (
            <div className="space-y-4 mt-4">
              {/* Profile pic editor */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center text-brand font-bold text-2xl shrink-0">
                  {isUploading
                    ? <div className="w-full h-full bg-gray-200 flex items-center justify-center"><Loader size="sm" /></div>
                    : (selected?.profilePic?.url || picPreview)
                      ? <img src={picPreview || selected?.profilePic?.url} alt={selected?.name} className="w-full h-full object-cover" />
                      : <span>{selected?.name?.charAt(0)?.toUpperCase()}</span>
                  }
                  {!isUploading && (
                    <button type="button" onClick={() => editPicRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-full">
                      <FiCamera size={18} />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Profile Picture</p>
                  <p className="text-xs text-gray-400">Uploads instantly to Cloudinary</p>
                  <button type="button" onClick={() => editPicRef.current?.click()} disabled={isUploading} className="text-xs text-brand font-medium mt-1 hover:underline disabled:opacity-50">
                    {isUploading ? 'Uploading...' : 'Change photo'}
                  </button>
                  {selected?.profilePic?.url && !isUploading && (
                    <button type="button" onClick={handleRemovePic} className="text-xs text-red-400 font-medium mt-1 ml-3 hover:underline">Remove</button>
                  )}
                </div>
                <input ref={editPicRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePicChange(e, true)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Full Name"   name="name"   required register={editForm.register} error={editForm.formState.errors.name}  />
                <InputField label="Phone"       name="phone"  required register={editForm.register} error={editForm.formState.errors.phone} />
                <InputField label="Email"       name="email"  type="email" register={editForm.register} />
                <SelectField label="Gender"     name="gender" register={editForm.register} options={GENDERS}       placeholder="Select gender" />
                <SelectField label="Role"       name="role"   required register={editForm.register} options={STAFF_ROLES}   placeholder="Select role" />
                <SelectField label="Department" name="department" register={editForm.register} options={DEPARTMENTS}  placeholder="Select department" />
                <SelectField label="Status"     name="status" register={editForm.register} options={STAFF_STATUSES} placeholder="Select status" />
                <InputField label="Joining Date" name="joiningDate" type="date" register={editForm.register} />
              </div>
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField  label="Salary Amount" name="salaryAmount" type="number" required register={editForm.register} error={editForm.formState.errors.salaryAmount} />
                <SelectField label="Salary Type"   name="salaryType"   required register={editForm.register} options={SALARY_TYPES} placeholder="Select type" />
              </div>
              <p className="text-sm font-semibold text-gray-700 border-t pt-3">Address</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><InputField label="Street" name="addressStreet" register={editForm.register} /></div>
                <InputField label="City"    name="addressCity"    register={editForm.register} />
                <InputField label="State"   name="addressState"   register={editForm.register} />
                <InputField label="Pincode" name="addressPincode" register={editForm.register} />
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <InputField label="Account Name"   name="bankAccountName"   register={editForm.register} />
              <InputField label="Account Number" name="bankAccountNumber" register={editForm.register} />
              <InputField label="Bank Name"      name="bankName"          register={editForm.register} />
              <InputField label="IFSC Code"      name="bankIfscCode"      register={editForm.register} />
              <InputField label="UPI ID"         name="bankUpiId"         register={editForm.register} />
            </div>
          )}

          <div className="flex justify-between items-center pt-5 mt-2 border-t">
            <div className="flex gap-2">
              {activeTab !== 'basic' && (
                <button type="button" onClick={() => setActiveTab(activeTab === 'bank' ? 'salary' : 'basic')} className="btn-secondary">Back</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditModal(false)} className="btn-secondary">Cancel</button>
              {/* ✅ Fixed: uses handleEditNextTab */}
              {activeTab !== 'bank' ? (
                <button type="button" onClick={handleEditNextTab} className="btn-primary">Next</button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── CHANGE PASSWORD MODAL ─────────────────────────────── */}
      <Modal isOpen={passwordModal} onClose={() => { setPasswordModal(false); passwordForm.reset(); }} title={`Change Password — ${selected?.name}`} size="sm">
        <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
            <StaffAvatar member={selected} size="sm" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{selected?.name}</p>
              <p className="text-xs text-gray-500">{selected?.employeeId} · {selected?.phone}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">This password will be used by the staff member to log in to the mobile app.</p>
          <InputField label="New Password"     name="newPassword"     type="password" required register={passwordForm.register} error={passwordForm.formState.errors.newPassword}     placeholder="Min 6 characters" />
          <InputField label="Confirm Password" name="confirmPassword" type="password" required register={passwordForm.register} error={passwordForm.formState.errors.confirmPassword} placeholder="Repeat password" />
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setPasswordModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              <FiLock size={14} /> {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── ATTENDANCE MODAL ──────────────────────────────────── */}
      <Modal isOpen={attendanceModal} onClose={() => { setAttendanceModal(false); attendanceForm.reset(); }} title={`Mark Attendance — ${selected?.name}`} size="sm">
        <form onSubmit={attendanceForm.handleSubmit(handleAttendance)} className="space-y-4">
          <InputField  label="Date"            name="date"     type="date"   required register={attendanceForm.register} error={attendanceForm.formState.errors.date}   />
          <SelectField label="Status"          name="status"   required register={attendanceForm.register} error={attendanceForm.formState.errors.status} options={ATTENDANCE_STATUSES} placeholder="Select status" />
          <InputField  label="Overtime Hours"  name="overtime" type="number" register={attendanceForm.register} placeholder="0" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea rows={2} placeholder="Optional note..." className="input-field resize-none" {...attendanceForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAttendanceModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Saving...' : 'Mark Attendance'}</button>
          </div>
        </form>
      </Modal>

      {/* ── VIEW MODAL ────────────────────────────────────────── */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Staff Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <StaffAvatar member={selected} size="lg" />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">{selected.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{selected.role?.replace(/_/g, ' ')}{selected.department && ` · ${selected.department}`}</p>
                <p className="text-xs text-gray-400">{selected.employeeId}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge label={STAFF_STATUSES.find((s) => s.value === selected.status)?.label} color={STAFF_STATUSES.find((s) => s.value === selected.status)?.color} />
                <button onClick={() => { setViewModal(false); passwordForm.reset(); setPasswordModal(true); }} className="text-xs text-indigo-500 font-medium flex items-center gap-1 hover:underline">
                  <FiLock size={11} /> Change Password
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Salary',  value: formatCurrency(selected.salaryAmount) },
                { label: 'Type',    value: capitalize(selected.salaryType?.replace(/_/g, ' ')) },
                { label: 'Joined',  value: formatDate(selected.joiningDate) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-brand mt-0.5 text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Earned',    value: formatCurrency(selected.totalEarned    || 0), color: 'text-green-600' },
                { label: 'Total Withdrawn', value: formatCurrency(selected.totalWithdrawn || 0), color: 'text-red-500'   },
                { label: 'Balance',         value: formatCurrency(selected.pendingBalance || 0), color: 'text-blue-600'  },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`font-bold mt-0.5 text-sm ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Phone',   value: selected.phone              },
                { label: 'Email',   value: selected.email              },
                { label: 'Gender',  value: capitalize(selected.gender) },
                { label: 'City',    value: selected.address?.city      },
                { label: 'State',   value: selected.address?.state     },
                { label: 'Pincode', value: selected.address?.pincode   },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800">{value || '—'}</p>
                </div>
              ))}
            </div>

            {selected.bankDetails?.accountNumber && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiDollarSign size={14} /> Bank Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Account Name',   value: selected.bankDetails.accountName   },
                    { label: 'Account Number', value: selected.bankDetails.accountNumber },
                    { label: 'Bank Name',      value: selected.bankDetails.bankName      },
                    { label: 'IFSC Code',      value: selected.bankDetails.ifscCode      },
                    { label: 'UPI ID',         value: selected.bankDetails.upiId         },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-semibold text-gray-800 text-xs mt-0.5">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.attendance?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Recent Attendance</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {[...selected.attendance]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 7)
                    .map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-sm text-gray-700">{formatDate(a.date)}</p>
                        <div className="flex items-center gap-2">
                          {a.overtime > 0 && <span className="text-xs text-orange-500 font-medium">{a.overtime}h OT</span>}
                          <Badge label={capitalize(a.status?.replace(/_/g, ' '))} color={ATT_COLORS[a.status] || 'gray'} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            <button onClick={() => { setViewModal(false); openWallet(selected); }} className="btn-secondary w-full flex items-center justify-center gap-2">
              <FiCreditCard size={14} /> View Full Wallet
            </button>
          </div>
        )}
      </Modal>

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Staff Member" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-900">{selected?.name}</span>? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>

      {/* ── WALLET MODAL ─────────────────────────────────────── */}
      <Modal isOpen={walletModal} onClose={() => { setWalletModal(false); dispatch(clearWallet()); }} title={`Wallet — ${selected?.name}`} size="lg">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total Earned',    value: currentWallet?.wallet?.totalEarned    || 0, icon: FiTrendingUp,      color: 'bg-green-50 text-green-600' },
            { label: 'Total Withdrawn', value: currentWallet?.wallet?.totalWithdrawn || 0, icon: FiArrowUpCircle,   color: 'bg-red-50 text-red-500'     },
            { label: 'Balance',         value: currentWallet?.wallet?.pendingBalance || 0, icon: FiArrowDownCircle, color: 'bg-blue-50 text-blue-600'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-xl p-4 ${color}`}>
              <div className="flex items-center gap-2 mb-1"><Icon size={14} /><p className="text-xs font-medium">{label}</p></div>
              <p className="text-xl font-bold">{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setCreditModal(true)}   className="btn-primary flex items-center gap-2 text-sm"><FiArrowDownCircle size={14} /> Credit</button>
          <button onClick={() => setWithdrawModal(true)} className="btn-secondary flex items-center gap-2 text-sm"><FiArrowUpCircle size={14} /> Withdraw</button>
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Transaction History</p>
        {walletLoading ? <Loader /> : transactions.length === 0 ? (
          <EmptyState title="No transactions yet" description="Credit or withdraw to get started" />
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {transactions.map((txn) => (
              <div key={txn._id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                    {txn.type === 'credit' ? <FiArrowDownCircle size={14} /> : <FiArrowUpCircle size={14} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{SOURCE_LABELS[txn.source] || txn.source}</p>
                    {txn.order      && <p className="text-xs text-gray-400">Order {txn.order.orderNumber}</p>}
                    {txn.description && <p className="text-xs text-gray-400 italic">{txn.description}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${txn.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Bal {formatCurrency(txn.balanceAfter)}</p>
                  <p className="text-xs text-gray-400">{dayjs(txn.createdAt).format('DD MMM, hh:mm A')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── CREDIT SUB-MODAL ─────────────────────────────────── */}
      <Modal isOpen={creditModal} onClose={() => { setCreditModal(false); creditForm.reset(); }} title="Credit Wallet" size="sm">
        <form onSubmit={creditForm.handleSubmit(handleCredit)} className="space-y-4">
          <InputField  label="Amount" name="amount" type="number" required register={creditForm.register} error={creditForm.formState.errors.amount} placeholder="500" />
          <SelectField label="Source" name="source" required register={creditForm.register} error={creditForm.formState.errors.source} options={CREDIT_SOURCES} placeholder="Select source" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea rows={2} placeholder="Optional note..." className="input-field resize-none" {...creditForm.register('description')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setCreditModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={walletSubmitting} className="btn-primary">{walletSubmitting ? 'Saving...' : 'Credit'}</button>
          </div>
        </form>
      </Modal>

      {/* ── WITHDRAW SUB-MODAL ───────────────────────────────── */}
      <Modal isOpen={withdrawModal} onClose={() => { setWithdrawModal(false); withdrawForm.reset(); }} title="Record Withdrawal" size="sm">
        <form onSubmit={withdrawForm.handleSubmit(handleWithdraw)} className="space-y-4">
          <InputField  label="Amount" name="amount" type="number" required register={withdrawForm.register} error={withdrawForm.formState.errors.amount} placeholder="1000" />
          <SelectField label="Type"   name="source" required register={withdrawForm.register} error={withdrawForm.formState.errors.source} options={WITHDRAW_SOURCES} placeholder="Select type" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea rows={2} placeholder="Optional note..." className="input-field resize-none" {...withdrawForm.register('description')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setWithdrawModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={walletSubmitting} className="btn-danger">{walletSubmitting ? 'Saving...' : 'Withdraw'}</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}