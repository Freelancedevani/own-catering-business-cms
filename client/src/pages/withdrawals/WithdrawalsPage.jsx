import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchWithdrawals, fetchWithdrawalStats,
  createWithdrawal, updateWithdrawalStatus,
  deleteWithdrawal,
} from '../../features/withdrawals/withdrawalSlice';
import { fetchStaff } from '../../features/staff/staffSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus, FiSearch, FiRefreshCw, FiEye,
  FiCheckCircle, FiXCircle, FiDollarSign,
  FiTrash2, FiClock, FiTrendingDown,
} from 'react-icons/fi';
import Modal      from '../../components/ui/Modal';
import Badge      from '../../components/ui/Badge';
import Loader     from '../../components/ui/Loader';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import InputField  from '../../components/forms/InputField';
import SelectField from '../../components/forms/SelectField';
import { formatDate, formatCurrency, capitalize } from '../../utils/formatters';
import { useDebounce } from '../../hooks/useDebounce';
import dayjs from 'dayjs';

// ── Constants ───────────────────────────────────
const WITHDRAWAL_TYPES = [
  { value: 'salary',        label: 'Salary'        },
  { value: 'advance',       label: 'Advance'       },
  { value: 'bonus',         label: 'Bonus'         },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'other',         label: 'Other'         },
];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash'          },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi',           label: 'UPI'           },
  { value: 'cheque',        label: 'Cheque'        },
];

const STATUSES = [
  { value: 'pending',  label: 'Pending',  color: 'yellow' },
  { value: 'approved', label: 'Approved', color: 'blue'   },
  { value: 'paid',     label: 'Paid',     color: 'green'  },
  { value: 'rejected', label: 'Rejected', color: 'red'    },
];

const MONTHS = [
  { value: 1,  label: 'January'   }, { value: 2,  label: 'February'  },
  { value: 3,  label: 'March'     }, { value: 4,  label: 'April'     },
  { value: 5,  label: 'May'       }, { value: 6,  label: 'June'      },
  { value: 7,  label: 'July'      }, { value: 8,  label: 'August'    },
  { value: 9,  label: 'September' }, { value: 10, label: 'October'   },
  { value: 11, label: 'November'  }, { value: 12, label: 'December'  },
];

// ── Schemas ──────────────────────────────────────
const createSchema = yup.object({
  staff:         yup.string().required('Staff is required'),
  type:          yup.string().required('Type is required'),
  amount:        yup.number().min(1).required('Amount is required'),
  paymentMethod: yup.string().required('Payment method is required'),
  description:   yup.string().required('Description is required'),
  forMonth:      yup.number().optional().nullable(),
  forYear:       yup.number().optional().nullable(),
});

const approveSchema = yup.object({
  adminNotes: yup.string().optional(),
});

const paySchema = yup.object({
  paymentReference: yup.string().optional(),
  adminNotes:       yup.string().optional(),
});

const rejectSchema = yup.object({
  rejectionReason: yup.string().required('Rejection reason is required'),
});

// ────────────────────────────────────────────────
export default function WithdrawalsPage() {
  const dispatch = useDispatch();
  const { withdrawals, stats, pagination, isLoading, isSubmitting } =
    useSelector((s) => s.withdrawals);
  const { staff } = useSelector((s) => s.staff);

  // ── Modal States ──
  const [createModal, setCreateModal] = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [approveModal,setApproveModal]= useState(false);
  const [payModal,    setPayModal]    = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,    setSelected]    = useState(null);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type,   setType]   = useState('');
  const [page,   setPage]   = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  // ── Forms ──
  const createForm  = useForm({ resolver: yupResolver(createSchema)  });
  const approveForm = useForm({ resolver: yupResolver(approveSchema) });
  const payForm     = useForm({ resolver: yupResolver(paySchema)     });
  const rejectForm  = useForm({ resolver: yupResolver(rejectSchema)  });

  // ── Watch for salary auto-fill ──
  const watchedStaff = createForm.watch('staff');
  const watchedType  = createForm.watch('type');

  useEffect(() => {
    if (watchedType === 'salary' && watchedStaff) {
      const member = staff.find((s) => s._id === watchedStaff);
      if (member?.salaryAmount) {
        createForm.setValue('amount', member.salaryAmount);
        const month = dayjs().month() + 1;
        const year  = dayjs().year();
        createForm.setValue('forMonth', month);
        createForm.setValue('forYear',  year);
        createForm.setValue(
          'description',
          `${MONTHS.find((m) => m.value === month)?.label} ${year} salary payment`
        );
      }
    }
  }, [watchedStaff, watchedType, staff, createForm]);

  // ── Fetch ──
  const loadWithdrawals = useCallback(() => {
    dispatch(fetchWithdrawals({
      page, limit: 10,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(status && { status }),
      ...(type   && { type }),
    }));
  }, [dispatch, page, debouncedSearch, status, type]);

  useEffect(() => {
    loadWithdrawals();
    dispatch(fetchWithdrawalStats({
      month: dayjs().month() + 1,
      year:  dayjs().year(),
    }));
    dispatch(fetchStaff({ limit: 100, status: 'active' }));
  }, [loadWithdrawals]);

  // ── Handlers ──
  const handleCreate = async (data) => {
    const payload = {
      ...data,
      forMonth: data.forMonth ? Number(data.forMonth) : undefined,
      forYear:  data.forYear  ? Number(data.forYear)  : undefined,
    };
    const result = await dispatch(createWithdrawal(payload));
    if (!result.error) { setCreateModal(false); createForm.reset(); }
  };

  const handleApprove = async (data) => {
    const result = await dispatch(updateWithdrawalStatus({
      id: selected._id,
      payload: { status: 'approved', adminNotes: data.adminNotes },
    }));
    if (!result.error) { setApproveModal(false); approveForm.reset(); }
  };

  const handlePay = async (data) => {
    const result = await dispatch(updateWithdrawalStatus({
      id: selected._id,
      payload: {
        status:           'paid',
        paymentReference: data.paymentReference,
        adminNotes:       data.adminNotes,
      },
    }));
    if (!result.error) { setPayModal(false); payForm.reset(); }
  };

  const handleReject = async (data) => {
    const result = await dispatch(updateWithdrawalStatus({
      id: selected._id,
      payload: { status: 'rejected', rejectionReason: data.rejectionReason },
    }));
    if (!result.error) { setRejectModal(false); rejectForm.reset(); }
  };

  const handleDelete = async () => {
    await dispatch(deleteWithdrawal(selected._id));
    setDeleteModal(false);
    setSelected(null);
  };

  const openApprove = (w) => {
    setSelected(w); approveForm.reset(); setApproveModal(true);
  };

  const openPay = (w) => {
    setSelected(w);
    const member = staff.find((s) => s._id === (w.staff?._id || w.staff));
    payForm.reset({
      paymentReference: '',
      adminNotes: member?.bankDetails?.upiId
        ? `Transferred via UPI to ${member.bankDetails.upiId}`
        : '',
    });
    setPayModal(true);
  };

  const openReject = (w) => {
    setSelected(w); rejectForm.reset(); setRejectModal(true);
  };

  const resetFilters = () => {
    setSearch(''); setStatus(''); setType(''); setPage(1);
  };

  // ── Helper: get staff bank info ──
  const getStaffBank = (w) =>
    staff.find((s) => s._id === (w?.staff?._id || w?.staff));

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Withdrawals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total || 0} total requests
          </p>
        </div>
        <button onClick={() => { createForm.reset(); setCreateModal(true); }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> New Request
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid',    value: formatCurrency(stats?.totalPaid),
            icon: FiDollarSign,  bg: 'bg-green-100 text-green-600'   },
          { label: 'Pending',       value: stats?.pendingCount  || 0,
            icon: FiClock,       bg: 'bg-yellow-100 text-yellow-600' },
          { label: 'Approved',      value: stats?.approvedCount || 0,
            icon: FiCheckCircle, bg: 'bg-blue-100 text-blue-600'     },
          { label: 'This Month',    value: formatCurrency(stats?.thisMonthPaid),
            icon: FiTrendingDown,bg: 'bg-purple-100 text-purple-600' },
        ].map(({ label, value, icon: Icon, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`p-3 rounded-xl ${bg}`}><Icon size={18} /></div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search staff, ref number..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field pl-8" />
          </div>
          <select value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input-field w-36">
            <option value="">All Status</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="input-field w-40">
            <option value="">All Types</option>
            {WITHDRAWAL_TYPES.map((t) => (
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
        {isLoading ? <Loader /> : withdrawals.length === 0 ? (
          <EmptyState
            title="No withdrawal requests"
            description="Create a new salary or advance request for staff"
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> New Request
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Ref No.', 'Staff', 'Type', 'Amount', 'For',
                      'Status', 'Method', 'Actions'].map((h) => (
                      <th key={h}
                        className="px-4 py-3 text-left text-xs font-semibold
                                   text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawals.map((w) => {
                    const statusInfo = STATUSES.find((s) => s.value === w.status);
                    const forPeriod  = w.forMonth && w.forYear
                      ? `${MONTHS.find((m) => m.value === w.forMonth)?.label} ${w.forYear}`
                      : '—';
                    return (
                      <tr key={w._id} className="hover:bg-gray-50 transition-colors">

                        {/* Ref */}
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-brand">
                            {w.referenceNumber || '—'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(w.createdAt)}
                          </p>
                        </td>

                        {/* Staff */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex
                                            items-center justify-center text-brand
                                            font-bold text-xs shrink-0">
                              {w.staff?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {w.staff?.name || '—'}
                              </p>
                              <p className="text-xs text-gray-400 capitalize">
                                {w.staff?.role?.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <Badge
                            label={capitalize(w.type)}
                            color={w.type === 'salary' ? 'purple' : 'blue'}
                          />
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(w.amount)}
                          </p>
                        </td>

                        {/* For (month/year) */}
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {forPeriod}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Badge label={statusInfo?.label} color={statusInfo?.color} />
                        </td>

                        {/* Payment Method */}
                        <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                          {w.paymentMethod?.replace(/_/g, ' ') || '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {/* View */}
                            <button
                              onClick={() => { setSelected(w); setViewModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500
                                         transition-colors" title="View">
                              <FiEye size={14} />
                            </button>
                            {/* Approve */}
                            {w.status === 'pending' && (
                              <button onClick={() => openApprove(w)}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-500
                                           transition-colors" title="Approve">
                                <FiCheckCircle size={14} />
                              </button>
                            )}
                            {/* Mark Paid */}
                            {w.status === 'approved' && (
                              <button onClick={() => openPay(w)}
                                className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500
                                           transition-colors" title="Mark as Paid">
                                <FiDollarSign size={14} />
                              </button>
                            )}
                            {/* Reject */}
                            {['pending', 'approved'].includes(w.status) && (
                              <button onClick={() => openReject(w)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500
                                           transition-colors" title="Reject">
                                <FiXCircle size={14} />
                              </button>
                            )}
                            {/* Delete */}
                            {w.status === 'pending' && (
                              <button
                                onClick={() => { setSelected(w); setDeleteModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400
                                           transition-colors" title="Delete">
                                <FiTrash2 size={14} />
                              </button>
                            )}
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

      {/* ═══════════════════════════════════════
          MODALS
      ═══════════════════════════════════════ */}

      {/* ── CREATE MODAL ── */}
      <Modal isOpen={createModal}
        onClose={() => { setCreateModal(false); createForm.reset(); }}
        title="New Withdrawal Request" size="md">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">

          {/* Staff */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Staff Member <span className="text-red-500">*</span>
            </label>
            <select className={`input-field ${
              createForm.formState.errors.staff ? 'border-red-400' : ''
            }`} {...createForm.register('staff')}>
              <option value="">Select staff member</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — {capitalize(s.role)} ({formatCurrency(s.salaryAmount)})
                </option>
              ))}
            </select>
            {createForm.formState.errors.staff && (
              <p className="text-xs text-red-500">
                {createForm.formState.errors.staff.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Type" name="type" required
              register={createForm.register}
              error={createForm.formState.errors.type}
              options={WITHDRAWAL_TYPES} placeholder="Select type" />
            <InputField label="Amount (₹)" name="amount" type="number" required
              register={createForm.register}
              error={createForm.formState.errors.amount}
              placeholder="25000" />
          </div>

          <SelectField label="Payment Method" name="paymentMethod" required
            register={createForm.register}
            error={createForm.formState.errors.paymentMethod}
            options={PAYMENT_METHODS} placeholder="Select method" />

          {/* Month/Year — only for salary type */}
          {watchedType === 'salary' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">For Month</label>
                <select className="input-field" {...createForm.register('forMonth')}>
                  <option value="">Select month</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <InputField label="For Year" name="forYear" type="number"
                register={createForm.register}
                placeholder={String(dayjs().year())} />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea rows={3}
              placeholder="e.g. March 2026 salary payment"
              className={`input-field resize-none ${
                createForm.formState.errors.description ? 'border-red-400' : ''
              }`}
              {...createForm.register('description')} />
            {createForm.formState.errors.description && (
              <p className="text-xs text-red-500">
                {createForm.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Auto-fill hint */}
          {watchedType === 'salary' && watchedStaff && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium">
                💡 Amount & description auto-filled from staff salary
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── APPROVE MODAL ── */}
      <Modal isOpen={approveModal}
        onClose={() => { setApproveModal(false); approveForm.reset(); }}
        title="Approve Withdrawal" size="sm">
        <form onSubmit={approveForm.handleSubmit(handleApprove)} className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-sm text-green-700">
              Approving{' '}
              <span className="font-bold">{formatCurrency(selected?.amount)}</span>{' '}
              for <span className="font-bold">{selected?.staff?.name}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Admin Notes
            </label>
            <textarea rows={3} placeholder="e.g. Approved by manager"
              className="input-field resize-none"
              {...approveForm.register('adminNotes')} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setApproveModal(false)}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="btn-primary">
              {isSubmitting ? 'Approving...' : '✓ Approve'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── PAY MODAL ── */}
      <Modal isOpen={payModal}
        onClose={() => { setPayModal(false); payForm.reset(); }}
        title={`Mark as Paid — ${formatCurrency(selected?.amount)}`} size="sm">
        <form onSubmit={payForm.handleSubmit(handlePay)} className="space-y-4">

          {/* Staff Bank Details hint */}
          {selected && (() => {
            const member = getStaffBank(selected);
            return member?.bankDetails?.accountNumber ? (
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
                  Staff Bank Details
                </p>
                <p className="font-semibold text-gray-800">
                  {member.bankDetails.accountName}
                </p>
                <p className="text-gray-600">
                  {member.bankDetails.bankName} · {member.bankDetails.accountNumber}
                </p>
                <p className="text-gray-500 text-xs">
                  IFSC: {member.bankDetails.ifscCode}
                </p>
                {member.bankDetails.upiId && (
                  <p className="text-brand font-semibold text-xs">
                    UPI: {member.bankDetails.upiId}
                  </p>
                )}
              </div>
            ) : null;
          })()}

          <InputField label="Payment Reference"
            name="paymentReference"
            register={payForm.register}
            placeholder="UPI txn ID / cheque no / bank ref no" />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Admin Notes</label>
            <textarea rows={2} placeholder="e.g. Transferred via UPI"
              className="input-field resize-none"
              {...payForm.register('adminNotes')} />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPayModal(false)}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="btn-primary">
              {isSubmitting ? 'Processing...' : '✓ Mark as Paid'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── REJECT MODAL ── */}
      <Modal isOpen={rejectModal}
        onClose={() => { setRejectModal(false); rejectForm.reset(); }}
        title="Reject Withdrawal" size="sm">
        <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-700">
              Rejecting{' '}
              <span className="font-bold">{formatCurrency(selected?.amount)}</span>{' '}
              for <span className="font-bold">{selected?.staff?.name}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea rows={3}
              placeholder="e.g. Insufficient funds this month"
              className={`input-field resize-none ${
                rejectForm.formState.errors.rejectionReason ? 'border-red-400' : ''
              }`}
              {...rejectForm.register('rejectionReason')} />
            {rejectForm.formState.errors.rejectionReason && (
              <p className="text-xs text-red-500">
                {rejectForm.formState.errors.rejectionReason.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRejectModal(false)}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-danger">
              {isSubmitting ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── VIEW MODAL ── */}
      <Modal isOpen={viewModal}
        onClose={() => setViewModal(false)}
        title="Withdrawal Details" size="md">
        {selected && (
          <div className="space-y-4">

            {/* Status Banner */}
            <div className={`rounded-xl p-4 flex items-center justify-between ${
              selected.status === 'paid'     ? 'bg-green-50  border border-green-100'  :
              selected.status === 'approved' ? 'bg-blue-50   border border-blue-100'   :
              selected.status === 'rejected' ? 'bg-red-50    border border-red-100'    :
                                               'bg-yellow-50 border border-yellow-100'
            }`}>
              <div>
                <p className="text-xs text-gray-400 font-medium">Reference Number</p>
                <p className="font-mono font-bold text-brand text-base">
                  {selected.referenceNumber || '—'}
                </p>
              </div>
              <Badge
                label={STATUSES.find((s) => s.value === selected.status)?.label}
                color={STATUSES.find((s) => s.value === selected.status)?.color}
              />
            </div>

            {/* Staff */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center
                              justify-center text-brand font-bold shrink-0">
                {selected.staff?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selected.staff?.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {selected.staff?.role?.replace(/_/g, ' ')} · {selected.staff?.employeeId}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">Salary</p>
                <p className="font-bold text-brand text-sm">
                  {formatCurrency(selected.staff?.salaryAmount)}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Amount',     value: formatCurrency(selected.amount)                       },
                { label: 'Type',       value: capitalize(selected.type)                             },
                { label: 'Method',     value: selected.paymentMethod?.replace(/_/g, ' ') || '—'    },
                { label: 'Reference',  value: selected.paymentReference  || '—'                    },
                { label: 'For Period', value: selected.forMonth && selected.forYear
                    ? `${MONTHS.find((m) => m.value === selected.forMonth)?.label} ${selected.forYear}`
                    : '—'
                },
                { label: 'Created',    value: formatDate(selected.createdAt)                        },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800 capitalize">{value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700">{selected.description}</p>
            </div>

            {/* Admin Notes */}
            {selected.adminNotes && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium mb-1">Admin Notes</p>
                <p className="text-sm text-gray-700">{selected.adminNotes}</p>
              </div>
            )}

            {/* Rejection Reason */}
            {selected.status === 'rejected' && selected.rejectionReason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs text-red-600 font-medium mb-1">Rejection Reason</p>
                <p className="text-sm text-gray-700">{selected.rejectionReason}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Timeline
              </p>
              <div className="relative pl-4">
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
                {[
                  { label: 'Request Created', date: selected.createdAt,  show: true                  },
                  { label: 'Approved',        date: selected.approvedAt, show: !!selected.approvedAt },
                  { label: 'Paid',            date: selected.paidAt,     show: !!selected.paidAt     },
                  { label: 'Rejected',        date: selected.rejectedAt, show: !!selected.rejectedAt },
                ].filter((t) => t.show).map(({ label, date }) => (
                  <div key={label} className="flex items-center gap-3 mb-3 relative">
                    <div className="absolute -left-4 w-3 h-3 rounded-full bg-brand
                                    border-2 border-white shadow-sm" />
                    <p className="text-sm text-gray-600 flex-1">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── DELETE MODAL ── */}
      <Modal isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Request" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete withdrawal request of{' '}
            <span className="font-bold">{formatCurrency(selected?.amount)}</span>{' '}
            for <span className="font-bold">{selected?.staff?.name}</span>?
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
