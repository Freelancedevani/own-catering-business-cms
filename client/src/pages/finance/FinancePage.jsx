import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTransactions, fetchFinanceDashboard,
  fetchCashflow, fetchMonthlyReport,
  fetchCategoryReport, createTransaction,
  updateTransaction, deleteTransaction,
} from '../../features/finance/financeSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  FiPlus, FiSearch, FiRefreshCw, FiEye,
  FiEdit2, FiTrash2, FiTrendingUp,
  FiTrendingDown, FiClock,
} from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
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

// ── Constants ──────────────────────────────────────
const INCOME_CATEGORIES = [
  { value: 'order_payment',   label: 'Order Payment'   },
  { value: 'advance_payment', label: 'Advance Payment' },
  { value: 'refund_received', label: 'Refund Received' },
  { value: 'other_income',    label: 'Other Income'    },
];

const EXPENSE_CATEGORIES = [
  { value: 'staff_salary',  label: 'Staff Salary'  },
  { value: 'raw_material',  label: 'Raw Material'  },
  { value: 'equipment',     label: 'Equipment'     },
  { value: 'vehicle_fuel',  label: 'Vehicle Fuel'  },
  { value: 'venue_rental',  label: 'Venue Rental'  },
  { value: 'utilities',     label: 'Utilities'     },
  { value: 'marketing',     label: 'Marketing'     },
  { value: 'maintenance',   label: 'Maintenance'   },
  { value: 'tax_payment',   label: 'Tax Payment'   },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash'          },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi',           label: 'UPI'           },
  { value: 'cheque',        label: 'Cheque'        },
  { value: 'card',          label: 'Card'          },
  { value: 'online',        label: 'Online'        },
];

const GST_RATES = [
  { value: 0,  label: '0%'  },
  { value: 5,  label: '5%'  },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

const PIE_COLORS = [
  '#6366f1','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#14b8a6','#f97316','#ec4899',
];

// ── Validation Schema ───────────────────────────────
const txSchema = yup.object({
  flowType:         yup.string().required('Flow type is required'),
  category:         yup.string().required('Category is required'),
  amount:           yup.number()
    .typeError('Enter a valid amount')
    .min(1, 'Minimum ₹1')
    .required('Amount is required'),
  description:      yup.string().required('Description is required'),
  paymentMethod:    yup.string().required('Payment method is required'),
  transactionDate:  yup.string().required('Date is required'),
  paymentReference: yup.string().optional(),
  gstApplicable:    yup.boolean().optional(),
  gstRate:          yup.number().optional(),
  tags:             yup.string().optional(),
});

// ── Custom Recharts Tooltip ─────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {capitalize(p.name)}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

// ───────────────────────────────────────────────────
export default function FinancePage() {
  const dispatch = useDispatch();
  const {
    transactions, dashboard, cashflow,
    monthlyReport, categoryReport,
    pagination, isLoading, isChartLoading, isSubmitting,
  } = useSelector((s) => s.finance);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('overview');

  // ── Modals ──
  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [viewModal,   setViewModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,    setSelected]    = useState(null);

  // ── Transaction Filters ──
  const [search,    setSearch]    = useState('');
  const [flowType,  setFlowType]  = useState('');
  const [category,  setCategory]  = useState('');
  const [method,    setMethod]    = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [page,      setPage]      = useState(1);

  // ── Chart Period ──
  const [chartYear,  setChartYear]  = useState(dayjs().year());
  const [chartMonth, setChartMonth] = useState(dayjs().month() + 1);

  const debouncedSearch = useDebounce(search, 400);

  // ── Forms ──
  const createForm = useForm({ resolver: yupResolver(txSchema) });
  const editForm   = useForm({ resolver: yupResolver(txSchema) });

  const watchFlowType      = createForm.watch('flowType');
  const watchGstApplicable = createForm.watch('gstApplicable');
  const editWatchFlowType  = editForm.watch('flowType');
  const editWatchGst       = editForm.watch('gstApplicable');

  // ── Fetch Transactions ──
  const loadTransactions = useCallback(() => {
    dispatch(fetchTransactions({
      page, limit: 12,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(flowType  && { flowType  }),
      ...(category  && { category  }),
      ...(method    && { paymentMethod: method }),
      ...(startDate && { startDate }),
      ...(endDate   && { endDate   }),
    }));
  }, [dispatch, page, debouncedSearch, flowType, category, method, startDate, endDate]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ── Fetch Dashboard + Monthly when year changes ──
  useEffect(() => {
    dispatch(fetchFinanceDashboard());
    dispatch(fetchMonthlyReport({ year: chartYear }));
    // ✅ Also refresh cashflow so KPI cards are in sync
    dispatch(fetchCashflow({ month: chartMonth, year: chartYear }));
  }, [dispatch, chartYear]);

  // ── Fetch Cashflow + Category when month/year changes ──
  useEffect(() => {
    dispatch(fetchCashflow({ month: chartMonth, year: chartYear }));
    dispatch(fetchCategoryReport({
      flowType:  'expense',
      startDate: `${chartYear}-${String(chartMonth).padStart(2, '0')}-01`,
      endDate:   dayjs(`${chartYear}-${String(chartMonth).padStart(2, '0')}-01`)
                   .endOf('month')
                   .format('YYYY-MM-DD'),
    }));
  }, [dispatch, chartMonth, chartYear]);

  // ── Handlers ──
  const handleCreate = async (data) => {
    const payload = {
      ...data,
      amount:        Number(data.amount),
      gstApplicable: !!data.gstApplicable,
      gstRate:       data.gstApplicable ? Number(data.gstRate) : 0,
      tags:          data.tags
        ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
    const result = await dispatch(createTransaction(payload));
    if (!result.error) {
      setCreateModal(false);
      createForm.reset();
      // Refresh all finance data after new transaction
      dispatch(fetchFinanceDashboard());
      dispatch(fetchCashflow({ month: chartMonth, year: chartYear }));
      dispatch(fetchMonthlyReport({ year: chartYear }));
    }
  };

  const handleEdit = async (data) => {
    const payload = {
      ...data,
      amount:        Number(data.amount),
      gstApplicable: !!data.gstApplicable,
      gstRate:       data.gstApplicable ? Number(data.gstRate) : 0,
      tags:          data.tags
        ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
    const result = await dispatch(updateTransaction({ id: selected._id, payload }));
    if (!result.error) {
      setEditModal(false);
      editForm.reset();
      dispatch(fetchCashflow({ month: chartMonth, year: chartYear }));
      dispatch(fetchMonthlyReport({ year: chartYear }));
    }
  };

  const handleDelete = async () => {
    await dispatch(deleteTransaction(selected._id));
    setDeleteModal(false);
    setSelected(null);
    dispatch(fetchCashflow({ month: chartMonth, year: chartYear }));
    dispatch(fetchMonthlyReport({ year: chartYear }));
  };

  const openEdit = (tx) => {
    setSelected(tx);
    editForm.reset({
      flowType:         tx.flowType,
      category:         tx.category,
      amount:           tx.amount,
      description:      tx.description,
      paymentMethod:    tx.paymentMethod,
      transactionDate:  dayjs(tx.transactionDate).format('YYYY-MM-DD'),
      paymentReference: tx.paymentReference || '',
      gstApplicable:    tx.gstApplicable    || false,
      gstRate:          tx.gstRate          || 0,
      tags:             tx.tags?.join(', ') || '',
    });
    setEditModal(true);
  };

  const resetFilters = () => {
    setSearch(''); setFlowType(''); setCategory('');
    setMethod(''); setStartDate(''); setEndDate(''); setPage(1);
  };

  // ── ✅ KPI: cashflow = single source of truth for current period ──
  const kpiIncome    = cashflow?.summary?.totalIncome  || 0;
  const kpiExpense   = cashflow?.summary?.totalExpense || 0;
  const kpiProfit    = cashflow?.summary?.netProfit    || 0;
  const profitMargin = cashflow?.summary?.profitMargin || '0%';
  const profitStatus = cashflow?.summary?.status       || 'loss';

  // Growth % from dashboard (last month comparison)
  const incomeGrowth  = dashboard?.thisMonth?.incomeGrowth  || '0%';
  const expenseGrowth = dashboard?.thisMonth?.expenseGrowth || '0%';
  const incomeDown    = String(incomeGrowth).startsWith('-');
  const expenseDown   = String(expenseGrowth).startsWith('-');

  // Pending summary
  const pendingCount = dashboard?.pendingTransactions?.length || 0;
  const pendingTotal = (dashboard?.pendingTransactions || [])
    .reduce((s, t) => s + (t.amount || 0), 0);

  // ── ✅ Monthly chart data — API returns { month, monthName, income, expense, profit } ──
  const monthlyChartData = (monthlyReport || []).map((m) => ({
    month:   m.monthName || MONTHS[(m.month || 1) - 1],
    income:  m.income  || 0,
    expense: m.expense || 0,
    profit:  m.profit  || 0,
  }));

  // ── ✅ Pie data — categoryReport: [{ _id: { category, flowType }, total, count }] ──
  const expensePieData = (categoryReport || [])
    .filter((c) => c._id?.flowType === 'expense' || !c._id?.flowType)
    .map((c) => ({
      name:  (c._id?.category || c._id || '').replace(/_/g, ' '),
      value: c.total || 0,
    }))
    .filter((d) => d.value > 0);

  // ─────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cashflow, transactions & reports
          </p>
        </div>
        <button
          onClick={() => { createForm.reset(); setCreateModal(true); }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus size={16} /> Record Transaction
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-100 gap-1">
        {[
          { key: 'overview',     label: '📊 Overview'     },
          { key: 'transactions', label: '📋 Transactions' },
          { key: 'reports',      label: '📈 Reports'      },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">

          {/* ── Chart Period Controls ── */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Period:</span>
            <select value={chartMonth}
              onChange={(e) => setChartMonth(Number(e.target.value))}
              className="input-field w-32 py-1.5 text-sm">
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={chartYear}
              onChange={(e) => setChartYear(Number(e.target.value))}
              className="input-field w-28 py-1.5 text-sm">
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">
              Showing: {MONTHS[chartMonth - 1]} {chartYear}
            </span>
          </div>

          {/* ── ✅ KPI Cards — all from cashflow (single source of truth) ── */}
          {isChartLoading ? <Loader /> : (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

              {/* 1 — Income */}
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                    <FiTrendingUp size={17} />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    Income · {MONTHS[chartMonth - 1]}
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(kpiIncome)}
                </p>
                <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${
                  incomeDown ? 'text-red-500' : 'text-green-500'
                }`}>
                  {incomeDown ? '▼' : '▲'} {incomeGrowth} vs last month
                </p>
              </div>

              {/* 2 — Expense */}
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-600">
                    <FiTrendingDown size={17} />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    Expense · {MONTHS[chartMonth - 1]}
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(kpiExpense)}
                </p>
                <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${
                  expenseDown ? 'text-green-500' : 'text-red-500'
                }`}>
                  {/* expense going DOWN is good */}
                  {expenseDown ? '▼ Reduced' : '▲'} {expenseGrowth} vs last month
                </p>
              </div>

              {/* 3 — Net Profit ✅ no duplicate margin calc */}
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2.5 rounded-xl ${
                    kpiProfit >= 0
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}>
                    <FaRupeeSign size={17} />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Net Profit</p>
                </div>
                <p className={`text-2xl font-bold ${
                  kpiProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {kpiProfit >= 0 ? '+' : ''}{formatCurrency(kpiProfit)}
                </p>
                <p className={`text-xs mt-1 font-medium ${
                  kpiProfit >= 0 ? 'text-blue-500' : 'text-red-500'
                }`}>
                  {/* ✅ profitMargin directly from cashflow API — no recalculation */}
                  {profitMargin} margin · {kpiProfit >= 0 ? '✅ Profit' : '⚠️ Loss'}
                </p>
              </div>

              {/* 4 — Pending Transactions ✅ replaced duplicate Profit Margin box */}
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-600">
                    <FiClock size={17} />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Pending</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingCount}
                  <span className="text-sm font-normal text-gray-400 ml-1">txns</span>
                </p>
                <p className="text-xs mt-1 font-medium text-yellow-600">
                  {formatCurrency(pendingTotal)} awaiting
                </p>
              </div>

            </div>
          )}

          {/* ── Last Month Comparison Strip ── */}
          {dashboard?.lastMonth && (
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Last Month Income',
                  value: dashboard.lastMonth.income,
                  color: 'text-green-600',
                },
                {
                  label: 'Last Month Expense',
                  value: dashboard.lastMonth.expense,
                  color: 'text-red-600',
                },
                {
                  label: 'Last Month Profit',
                  value: dashboard.lastMonth.profit,
                  color: dashboard.lastMonth.profit >= 0
                    ? 'text-blue-600' : 'text-orange-600',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="card py-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>
                    {formatCurrency(value || 0)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Monthly Income vs Expense BarChart ── */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Monthly Income vs Expense — {chartYear}
            </h2>
            {isChartLoading ? <Loader /> : monthlyChartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
                No data for {chartYear}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyChartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income"  name="Income"
                    fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense"
                    fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Net Profit Area Chart ── */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Net Profit Trend — {chartYear}
            </h2>
            {isChartLoading ? <Loader /> : monthlyChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No data for {chartYear}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyChartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone" dataKey="profit" name="Profit"
                    stroke="#6366f1" strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Cashflow Summary + Expense Pie ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Cashflow Summary */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Cashflow — {MONTHS[chartMonth - 1]} {chartYear}
              </h2>
              {isChartLoading ? <Loader /> : cashflow ? (
                <div className="space-y-3">
                  {[
                    {
                      label: 'Total Income',
                      value: cashflow.summary?.totalIncome || 0,
                      color: 'text-green-600',
                      bg:    'bg-green-50',
                    },
                    {
                      label: 'Total Expense',
                      value: cashflow.summary?.totalExpense || 0,
                      color: 'text-red-600',
                      bg:    'bg-red-50',
                    },
                    {
                      label: 'Net Profit',
                      value: cashflow.summary?.netProfit || 0,
                      color: (cashflow.summary?.netProfit || 0) >= 0
                        ? 'text-blue-600' : 'text-orange-600',
                      bg:    (cashflow.summary?.netProfit || 0) >= 0
                        ? 'bg-blue-50' : 'bg-orange-50',
                    },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label}
                      className={`flex items-center justify-between
                                  rounded-xl px-4 py-3 ${bg}`}>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className={`text-base font-bold ${color}`}>
                        {formatCurrency(value)}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between
                                  rounded-xl px-4 py-3 bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">Profit Margin</p>
                    <p className="text-base font-bold text-gray-900">
                      {cashflow.summary?.profitMargin || '0%'}
                    </p>
                  </div>
                  <div className="flex justify-center pt-1">
                    <Badge
                      label={capitalize(cashflow.summary?.status || 'N/A')}
                      color={cashflow.summary?.status === 'profit' ? 'green' : 'red'}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">No data</p>
              )}
            </div>

            {/* Expense Breakdown Pie */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Expense Breakdown — {MONTHS[chartMonth - 1]} {chartYear}
              </h2>
              {isChartLoading ? <Loader /> : expensePieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center
                                text-gray-400 text-sm">
                  No expense data for this period
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        cx="50%" cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) =>
                          percent > 0.05
                            ? `${capitalize(name)} ${(percent * 100).toFixed(0)}%`
                            : ''
                        }
                        labelLine={false}
                      >
                        {expensePieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => [formatCurrency(v), capitalize(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {expensePieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-600 capitalize">{d.name}</span>
                        <span className="text-gray-400">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Income / Expense Breakdown Lists ── */}
          {cashflow && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {[
                {
                  title: '💚 Income Breakdown',
                  items: cashflow.incomeBreakdown,
                  color: 'text-green-600',
                },
                {
                  title: '🔴 Expense Breakdown',
                  items: cashflow.expenseBreakdown,
                  color: 'text-red-600',
                },
              ].map(({ title, items, color }) => (
                <div key={title} className="card">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
                  {items?.length ? (
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i}
                          className="flex items-center justify-between
                                     rounded-lg px-3 py-2.5 bg-gray-50">
                          <p className="text-sm text-gray-700 capitalize font-medium">
                            {(item._id || item.category || '').replace(/_/g, ' ')}
                          </p>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${color}`}>
                              {formatCurrency(item.total || 0)}
                            </p>
                            {item.count && (
                              <p className="text-xs text-gray-400">
                                {item.count} txn{item.count > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No data</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Auto vs Manual Source Strip ── */}
          {dashboard?.transactionSources && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Transaction Sources — {MONTHS[chartMonth - 1]} {chartYear}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label:  '🤖 Auto (from Orders)',
                    src:    dashboard.transactionSources.auto,
                    bg:     'bg-blue-50',
                    color:  'text-blue-600',
                  },
                  {
                    label:  '✍️ Manual (Recorded)',
                    src:    dashboard.transactionSources.manual,
                    bg:     'bg-purple-50',
                    color:  'text-purple-600',
                  },
                ].map(({ label, src, bg, color }) => (
                  <div key={label} className={`rounded-xl p-4 ${bg}`}>
                    <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>
                      {src?.count || 0}
                      <span className="text-sm font-normal ml-1">txns</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(src?.total || 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Transactions ── */}
          {dashboard?.recentTransactions?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Recent Transactions
              </h2>
              <div className="space-y-2">
                {dashboard.recentTransactions.map((tx) => (
                  <div key={tx._id}
                    className="flex items-center justify-between
                               rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center
                                       justify-center text-xs font-bold ${
                        tx.flowType === 'income'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.flowType === 'income' ? '↑' : '↓'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                          {tx.description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.category?.replace(/_/g, ' ')} · {formatDate(tx.transactionDate)}
                          {tx.tags?.includes('auto') && (
                            <span className="ml-1 text-blue-400">🤖</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${
                      tx.flowType === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.flowType === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pending Transactions Alert ── */}
          {dashboard?.pendingTransactions?.length > 0 && (
            <div className="card border border-yellow-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                ⏳ Pending Transactions
              </h2>
              <div className="space-y-2">
                {dashboard.pendingTransactions.map((tx) => (
                  <div key={tx._id}
                    className="flex items-center justify-between
                               rounded-lg px-3 py-2.5 bg-yellow-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {tx.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tx.category?.replace(/_/g, ' ')} · {formatDate(tx.createdAt)}
                        {tx.tags?.includes('auto') && (
                          <span className="ml-1 text-blue-400">🤖 Auto</span>
                        )}
                      </p>
                    </div>
                    <Badge
                      label={formatCurrency(tx.amount)}
                      color="yellow"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════
          TAB: TRANSACTIONS
      ══════════════════════════════ */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="card py-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <FiSearch size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text"
                  placeholder="Search description, ref, txn no..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="input-field pl-8" />
              </div>
              <select value={flowType}
                onChange={(e) => {
                  setFlowType(e.target.value); setPage(1); setCategory('');
                }}
                className="input-field w-32">
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <select value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="input-field w-44">
                <option value="">All Categories</option>
                {(flowType === 'expense'
                  ? EXPENSE_CATEGORIES
                  : flowType === 'income'
                  ? INCOME_CATEGORIES
                  : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]
                ).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select value={method}
                onChange={(e) => { setMethod(e.target.value); setPage(1); }}
                className="input-field w-36">
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <input type="date" value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="input-field w-36" />
              <input type="date" value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="input-field w-36" />
              <button onClick={resetFilters}
                className="btn-secondary flex items-center gap-2">
                <FiRefreshCw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card p-0 overflow-hidden">
            {isLoading ? <Loader /> : transactions.length === 0 ? (
              <EmptyState
                title="No transactions found"
                description="Record your first income or expense"
                action={
                  <button onClick={() => setCreateModal(true)} className="btn-primary">
                    <FiPlus size={14} className="inline mr-1" /> Record Transaction
                  </button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {[
                          'Txn No.', 'Type', 'Category', 'Description',
                          'Amount', 'Method', 'Date', 'Source', 'Actions',
                        ].map((h) => (
                          <th key={h}
                            className="px-4 py-3 text-left text-xs font-semibold
                                       text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {transactions.map((tx) => (
                        <tr key={tx._id}
                          className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-bold text-brand">
                              {tx.transactionNumber || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              label={capitalize(tx.flowType)}
                              color={tx.flowType === 'income' ? 'green' : 'red'}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700 capitalize text-xs font-medium">
                              {tx.category?.replace(/_/g, ' ')}
                            </p>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-gray-700 truncate">{tx.description}</p>
                            {tx.relatedOrder && (
                              <p className="text-xs text-blue-500 mt-0.5">
                                🔗 {tx.relatedOrder?.orderNumber || 'Linked Order'}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className={`font-bold ${
                              tx.flowType === 'income'
                                ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {tx.flowType === 'income' ? '+' : '-'}
                              {formatCurrency(tx.amount)}
                            </p>
                            {tx.gstApplicable && (
                              <p className="text-xs text-gray-400">
                                GST {tx.gstRate}%
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                            {tx.paymentMethod?.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                            {formatDate(tx.transactionDate)}
                          </td>
                          <td className="px-4 py-3">
                            {tx.tags?.includes('auto') ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600
                                               text-xs rounded-full font-medium">
                                🤖 Auto
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500
                                               text-xs rounded-full font-medium">
                                ✍️ Manual
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => { setSelected(tx); setViewModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-blue-50
                                           text-blue-500 transition-colors"
                                title="View">
                                <FiEye size={14} />
                              </button>
                              <button onClick={() => openEdit(tx)}
                                className="p-1.5 rounded-lg hover:bg-purple-50
                                           text-purple-500 transition-colors"
                                title="Edit">
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => { setSelected(tx); setDeleteModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-red-50
                                           text-red-500 transition-colors"
                                title="Delete">
                                <FiTrash2 size={14} />
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
        </div>
      )}

      {/* ══════════════════════════════
          TAB: REPORTS
      ══════════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-5">

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select value={chartYear}
              onChange={(e) => setChartYear(Number(e.target.value))}
              className="input-field w-28 py-1.5 text-sm">
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Monthly Report Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                Monthly Report — {chartYear}
              </h2>
            </div>
            {isChartLoading ? <Loader /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Month','Income','Expense','Net Profit','Margin','Status'].map((h) => (
                        <th key={h}
                          className="px-4 py-3 text-left text-xs font-semibold
                                     text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthlyChartData.length === 0 ? (
                      <tr>
                        <td colSpan={6}
                          className="px-4 py-8 text-center text-gray-400 text-sm">
                          No report data for {chartYear}
                        </td>
                      </tr>
                    ) : (
                      monthlyChartData.map((row, i) => {
                        const margin = row.income > 0
                          ? ((row.profit / row.income) * 100).toFixed(1)
                          : '0';
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-800">
                              {row.month}
                            </td>
                            <td className="px-4 py-3 text-green-600 font-semibold">
                              {formatCurrency(row.income)}
                            </td>
                            <td className="px-4 py-3 text-red-600 font-semibold">
                              {formatCurrency(row.expense)}
                            </td>
                            <td className={`px-4 py-3 font-bold ${
                              row.profit >= 0 ? 'text-blue-600' : 'text-orange-600'
                            }`}>
                              {row.profit >= 0 ? '+' : ''}{formatCurrency(row.profit)}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{margin}%</td>
                            <td className="px-4 py-3">
                              <Badge
                                label={row.profit >= 0 ? 'Profit' : 'Loss'}
                                color={row.profit >= 0 ? 'green' : 'red'}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {monthlyChartData.length > 0 && (() => {
                    const ti = monthlyChartData.reduce((s, r) => s + r.income,  0);
                    const te = monthlyChartData.reduce((s, r) => s + r.expense, 0);
                    const tp = ti - te;
                    return (
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                          <td className="px-4 py-3 text-gray-900">TOTAL</td>
                          <td className="px-4 py-3 text-green-600">{formatCurrency(ti)}</td>
                          <td className="px-4 py-3 text-red-600">{formatCurrency(te)}</td>
                          <td className={`px-4 py-3 ${
                            tp >= 0 ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {tp >= 0 ? '+' : ''}{formatCurrency(tp)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {ti > 0 ? ((tp / ti) * 100).toFixed(1) : '0'}%
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              label={tp >= 0 ? 'Profit' : 'Loss'}
                              color={tp >= 0 ? 'green' : 'red'}
                            />
                          </td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════
          MODALS
      ═══════════════════════════ */}

      {/* CREATE + EDIT shared form loop */}
      {[
        {
          isOpen:      createModal,
          form:        createForm,
          watchFlow:   watchFlowType,
          watchGst:    watchGstApplicable,
          title:       'Record Transaction',
          onClose:     () => { setCreateModal(false); createForm.reset(); },
          onSubmit:    createForm.handleSubmit(handleCreate),
          submitLabel: 'Record',
        },
        {
          isOpen:      editModal,
          form:        editForm,
          watchFlow:   editWatchFlowType,
          watchGst:    editWatchGst,
          title:       'Edit Transaction',
          onClose:     () => { setEditModal(false); editForm.reset(); },
          onSubmit:    editForm.handleSubmit(handleEdit),
          submitLabel: 'Save Changes',
        },
      ].map(({ isOpen, form, watchFlow, watchGst, title, onClose, onSubmit, submitLabel }) => (
        <Modal key={title} isOpen={isOpen} onClose={onClose} title={title} size="lg">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              <SelectField label="Type" name="flowType" required
                register={form.register}
                error={form.formState.errors.flowType}
                options={[
                  { value: 'income',  label: '💚 Income'  },
                  { value: 'expense', label: '🔴 Expense' },
                ]}
                placeholder="Select type" />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className={`input-field ${
                    form.formState.errors.category ? 'border-red-400' : ''
                  }`}
                  {...form.register('category')}>
                  <option value="">Select category</option>
                  {(watchFlow === 'expense'
                    ? EXPENSE_CATEGORIES
                    : INCOME_CATEGORIES
                  ).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {form.formState.errors.category && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>

              <InputField label="Amount (₹)" name="amount" type="number" required
                register={form.register}
                error={form.formState.errors.amount}
                placeholder="75000" />

              <SelectField label="Payment Method" name="paymentMethod" required
                register={form.register}
                error={form.formState.errors.paymentMethod}
                options={PAYMENT_METHODS}
                placeholder="Select method" />

              <InputField label="Transaction Date" name="transactionDate"
                type="date" required
                register={form.register}
                error={form.formState.errors.transactionDate} />

              <InputField label="Payment Reference" name="paymentReference"
                register={form.register}
                placeholder="HDFC-TXN-20260307" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea rows={2}
                placeholder="Brief description of this transaction..."
                className={`input-field resize-none ${
                  form.formState.errors.description ? 'border-red-400' : ''
                }`}
                {...form.register('description')} />
              {form.formState.errors.description && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <InputField label="Tags (comma separated)" name="tags"
              register={form.register}
              placeholder="wedding, full_payment" />

            {/* GST — only for income */}
            {watchFlow === 'income' && (
              <div className="border border-gray-100 rounded-xl p-4 space-y-3
                              bg-gray-50">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id={`gst-${title}`}
                    className="w-4 h-4 accent-brand"
                    {...form.register('gstApplicable')} />
                  <label htmlFor={`gst-${title}`}
                    className="text-sm font-medium text-gray-700 cursor-pointer">
                    GST Applicable?
                  </label>
                </div>
                {watchGst && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">GST Rate</label>
                    <select className="input-field w-40" {...form.register('gstRate')}>
                      {GST_RATES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving...' : submitLabel}
              </button>
            </div>
          </form>
        </Modal>
      ))}

      {/* VIEW Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)}
        title="Transaction Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 flex items-center justify-between ${
              selected.flowType === 'income'
                ? 'bg-green-50 border border-green-100'
                : 'bg-red-50 border border-red-100'
            }`}>
              <div>
                <p className="text-xs text-gray-400 font-medium">Transaction Number</p>
                <p className="font-mono font-bold text-brand text-base">
                  {selected.transactionNumber || '—'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  label={capitalize(selected.flowType)}
                  color={selected.flowType === 'income' ? 'green' : 'red'}
                />
                {selected.tags?.includes('auto') && (
                  <span className="text-xs text-blue-500 font-medium">
                    🤖 Auto-generated
                  </span>
                )}
              </div>
            </div>

            <div className="text-center py-2">
              <p className="text-xs text-gray-400 mb-1">Amount</p>
              <p className={`text-4xl font-bold ${
                selected.flowType === 'income' ? 'text-green-600' : 'text-red-600'
              }`}>
                {selected.flowType === 'income' ? '+' : '-'}
                {formatCurrency(selected.amount)}
              </p>
              {selected.gstApplicable && (
                <p className="text-xs text-gray-400 mt-1">
                  GST @ {selected.gstRate}% = {formatCurrency(selected.gstAmount || 0)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Category',  value: selected.category?.replace(/_/g, ' ')     },
                { label: 'Method',    value: selected.paymentMethod?.replace(/_/g, ' ')},
                { label: 'Date',      value: formatDate(selected.transactionDate)       },
                { label: 'Reference', value: selected.paymentReference || '—'          },
                { label: 'Status',    value: capitalize(selected.status || 'completed') },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-800 capitalize">{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-700">{selected.description}</p>
            </div>

            {selected.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span key={tag}
                    className="px-2.5 py-1 bg-brand/10 text-brand
                               text-xs rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {(selected.relatedClient || selected.relatedStaff ||
              selected.relatedOrder   || selected.relatedWithdrawal) && (
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium mb-2">Linked To</p>
                <div className="space-y-1 text-sm">
                  {selected.relatedClient && (
                    <p className="text-gray-700">
                      👤 Client:{' '}
                      <span className="font-semibold">
                        {selected.relatedClient?.name || selected.relatedClient}
                      </span>
                    </p>
                  )}
                  {selected.relatedStaff && (
                    <p className="text-gray-700">
                      👷 Staff:{' '}
                      <span className="font-semibold">
                        {selected.relatedStaff?.name || selected.relatedStaff}
                      </span>
                    </p>
                  )}
                  {selected.relatedOrder && (
                    <p className="text-gray-700">
                      📦 Order:{' '}
                      <span className="font-semibold font-mono text-brand">
                        {selected.relatedOrder?.orderNumber || selected.relatedOrder}
                      </span>
                    </p>
                  )}
                  {selected.relatedWithdrawal && (
                    <p className="text-gray-700">
                      💸 Withdrawal:{' '}
                      <span className="font-semibold font-mono text-brand">
                        {selected.relatedWithdrawal?.referenceNumber
                          || selected.relatedWithdrawal}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              Recorded on {formatDate(selected.createdAt)}
            </p>
          </div>
        )}
      </Modal>

      {/* DELETE Modal */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)}
        title="Delete Transaction" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete transaction{' '}
            <span className="font-bold font-mono text-brand">
              {selected?.transactionNumber}
            </span>
            {' '}of{' '}
            <span className="font-bold">{formatCurrency(selected?.amount)}</span>?
            This cannot be undone.
          </p>
          {selected?.tags?.includes('auto') && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
              <p className="text-xs text-yellow-700 font-medium">
                ⚠️ This was auto-generated from an order. Deleting it will cause
                a mismatch with the order's payment records.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
