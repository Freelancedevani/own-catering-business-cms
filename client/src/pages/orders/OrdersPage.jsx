import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchOrders,
  fetchOrderStats,
  fetchOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  addPayment,
  assignStaff,
  removeStaff,
  deleteOrder,
  fetchOrderExpenses,
  addOrderExpense,
  deleteOrderExpense,
  clearOrderExpenses,
} from '../../features/orders/orderSlice';
import {
  generateInvoice,
  fetchInvoiceByOrder,
  syncInvoice,
  clearSelectedInvoice,
} from '../../features/invoices/invoiceSlice';
import { fetchClients } from '../../features/clients/clientSlice';
import { fetchStaff } from '../../features/staff/staffSlice';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  FiPlus,
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiDollarSign,
  FiUsers,
  FiChevronRight,
  FiX,
  FiMapPin,
  FiPackage,
  FiFileText,
} from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import InvoicePreview from '../invoices/InvoicePreview';
import { formatDate, formatCurrency, capitalize } from '../../utils/formatters';
import { useDebounce } from '../../hooks/useDebounce';
import dayjs from 'dayjs';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'reception', label: 'Reception' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'riceceremony', label: 'Rice Ceremony' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'conference', label: 'Conference' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'social_gathering', label: 'Social Gathering' },
  { value: 'baby_shower', label: 'Baby Shower' },
  { value: 'funeral', label: 'Funeral' },
  { value: 'other', label: 'Other' },
];

const ORDER_STATUSES = [
  { value: 'inquiry', label: 'Inquiry', color: 'gray' },
  { value: 'quoted', label: 'Quoted', color: 'yellow' },
  { value: 'confirmed', label: 'Confirmed', color: 'blue' },
  { value: 'planning', label: 'Planning', color: 'purple' },
  { value: 'ready', label: 'Ready', color: 'indigo' },
  { value: 'in_progress', label: 'In Progress', color: 'orange' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
];

const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', color: 'red' },
  { value: 'partial', label: 'Partial', color: 'yellow' },
  { value: 'paid', label: 'Paid', color: 'green' },
  { value: 'refunded', label: 'Refunded', color: 'gray' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

const DISCOUNT_TYPES = [
  { value: 'none', label: 'No Discount' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'percentage', label: 'Percentage' },
];

const ORDER_EXPENSE_CATEGORIES = [
  { value: 'food_raw_material', label: 'Food / Raw Material' },
  { value: 'decoration', label: 'Decoration' },
  { value: 'equipment_rental', label: 'Equipment Rental' },
  { value: 'vehicle_fuel', label: 'Vehicle / Fuel' },
  { value: 'venue_rental', label: 'Venue Rental' },
  { value: 'staff_salary', label: 'Staff Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const NEXT_STATUSES = {
  inquiry: ['quoted', 'confirmed', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  confirmed: ['planning', 'cancelled'],
  planning: ['ready', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────
const createSchema = yup.object({
  client: yup.string().required('Client is required'),
  eventType: yup.string().required('Event type is required'),
  eventDate: yup.string().required('Event date is required'),
  eventTime: yup.string().optional(),
  guestCount: yup.number().min(1).required('Guest count is required'),
  venue: yup.object({
    name: yup.string().optional(),
    address: yup.string().optional(),
    city: yup.string().optional(),
    pincode: yup.string().optional(),
  }),
  discountType: yup.string().optional(),
  discountValue: yup.number().min(0).optional(),
  taxRate: yup.number().min(0).max(100).optional(),
  deliveryCharge: yup.number().min(0).optional(),
  customerNotes: yup.string().optional(),
  adminNotes: yup.string().optional(),
  specialInstructions: yup.string().optional(),
});

const statusSchema = yup.object({
  status: yup.string().required('Status is required'),
  note: yup.string().optional(),
  cancelReason: yup.string().when('status', {
    is: 'cancelled',
    then: (s) => s.required('Cancel reason is required'),
  }),
});

const paymentSchema = yup.object({
  amount: yup.number().min(1).required('Amount is required'),
  paymentMethod: yup.string().required('Payment method is required'),
  paymentReference: yup.string().optional(),
  notes: yup.string().optional(),
});

const staffSchema = yup.object({
  staff: yup.string().required('Staff is required'),
  role: yup.string().optional(),
  reportTime: yup.string().optional(),
  fee: yup.string().optional(),
});

const expenseSchema = yup.object({
  category: yup.string().required('Category is required'),
  description: yup.string().optional(),
  amount: yup.number().min(1).required('Amount is required'),
  paymentMethod: yup.string().optional(),
  paymentReference: yup.string().optional(),
  vendor: yup.string().optional(),
});

// ─────────────────────────────────────────────
// PriceSummary component
// ─────────────────────────────────────────────
function PriceSummary({
  subtotal,
  discountAmount,
  taxRate,
  taxAmount,
  deliveryCharge,
  totalAmount,
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-600">
        <span>Subtotal</span>
        <span className="font-medium">{formatCurrency(subtotal || 0)}</span>
      </div>

      {discountAmount > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Discount</span>
          <span className="font-medium">-{formatCurrency(discountAmount)}</span>
        </div>
      )}

      {taxRate > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Tax {taxRate}%</span>
          <span className="font-medium">{formatCurrency(taxAmount || 0)}</span>
        </div>
      )}

      {deliveryCharge > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Delivery</span>
          <span className="font-medium">{formatCurrency(deliveryCharge)}</span>
        </div>
      )}

      <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold text-gray-900">
        <span>Total</span>
        <span className="text-brand">{formatCurrency(totalAmount || 0)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function OrdersPage() {
  const dispatch = useDispatch();

  const {
    orders,
    stats,
    pagination,
    isLoading,
    isSubmitting,
    selectedOrder,
    orderExpenses,
    isExpenseLoading,
  } = useSelector((s) => s.orders);

  const { clients } = useSelector((s) => s.clients);
  const { staff } = useSelector((s) => s.staff);
  const { selectedInvoice, isSubmitting: isInvoiceSubmitting } = useSelector(
    (s) => s.invoices
  );

  const [createModal, setCreateModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const liveOrder = orders.find((o) => o._id === selected?._id) || selected;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  const [liveItems, setLiveItems] = useState([]);
  const [liveDiscount, setLiveDiscount] = useState({ type: 'none', value: 0 });
  const [liveTax, setLiveTax] = useState(0);
  const [liveDelivery, setLiveDelivery] = useState(0);

  const createForm = useForm({
    resolver: yupResolver(createSchema),
    defaultValues: {
      items: [{ name: '', description: '', quantity: 1, unit: 'plate', price: 0 }],
      discountType: 'none',
      discountValue: 0,
      taxRate: 0,
      deliveryCharge: 0,
    },
  });

  const editForm = useForm({
    resolver: yupResolver(createSchema),
  });

  const statusForm = useForm({
    resolver: yupResolver(statusSchema),
  });

  const payForm = useForm({
    resolver: yupResolver(paymentSchema),
  });

  const staffForm = useForm({
    resolver: yupResolver(staffSchema),
    defaultValues: { staff: '', role: '', reportTime: '', fee: '' },
  });

  const expenseForm = useForm({
    resolver: yupResolver(expenseSchema),
    defaultValues: { paymentMethod: 'cash' },
  });

  const {
    fields: createItems,
    append: appendCreateItem,
    remove: removeCreateItem,
  } = useFieldArray({
    control: createForm.control,
    name: 'items',
  });

  const {
    fields: editItems,
    append: appendEditItem,
    remove: removeEditItem,
  } = useFieldArray({
    control: editForm.control,
    name: 'items',
  });

  const watchCreateItems = createForm.watch('items');
  const watchCreateDiscount = createForm.watch('discountType');
  const watchCreateDiscountV = createForm.watch('discountValue');
  const watchCreateTax = createForm.watch('taxRate');
  const watchCreateDelivery = createForm.watch('deliveryCharge');

  useEffect(() => {
    setLiveItems(watchCreateItems || []);
    setLiveDiscount({
      type: watchCreateDiscount || 'none',
      value: watchCreateDiscountV || 0,
    });
    setLiveTax(watchCreateTax || 0);
    setLiveDelivery(watchCreateDelivery || 0);
  }, [
    watchCreateItems,
    watchCreateDiscount,
    watchCreateDiscountV,
    watchCreateTax,
    watchCreateDelivery,
  ]);

  const calcPrice = (items, discType, discVal, tax, delivery) => {
    const subtotal = (items || []).reduce(
      (sum, item) =>
        sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
      0
    );

    let discountAmount = 0;
    if (discType === 'fixed') discountAmount = Number(discVal) || 0;
    if (discType === 'percentage') {
      discountAmount = (subtotal * (Number(discVal) || 0)) / 100;
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = (afterDiscount * (Number(tax) || 0)) / 100;
    const totalAmount = afterDiscount + taxAmount + (Number(delivery) || 0);

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    };
  };

  const livePrice = calcPrice(
    liveItems,
    liveDiscount.type,
    liveDiscount.value,
    liveTax,
    liveDelivery
  );

  const loadOrders = useCallback(() => {
    dispatch(
      fetchOrders({
        page,
        limit: 10,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && { status: statusFilter }),
        ...(eventTypeFilter && { eventType: eventTypeFilter }),
        ...(paymentFilter && { paymentStatus: paymentFilter }),
      })
    );
  }, [dispatch, page, debouncedSearch, statusFilter, eventTypeFilter, paymentFilter]);

  const refreshDashboardData = useCallback(
    async (orderId = null) => {
      await Promise.all([
        dispatch(fetchOrderStats()),
        dispatch(
          fetchOrders({
            page,
            limit: 10,
            ...(debouncedSearch && { search: debouncedSearch }),
            ...(statusFilter && { status: statusFilter }),
            ...(eventTypeFilter && { eventType: eventTypeFilter }),
            ...(paymentFilter && { paymentStatus: paymentFilter }),
          })
        ),
      ]);

      if (orderId) {
        await dispatch(fetchOrderById(orderId));
        await dispatch(fetchOrderExpenses(orderId));
      }
    },
    [dispatch, page, debouncedSearch, statusFilter, eventTypeFilter, paymentFilter]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    dispatch(fetchOrderStats());
    dispatch(fetchClients({ limit: 200 }));
    dispatch(fetchStaff({ limit: 100, status: 'active' }));
  }, [dispatch]);

  const handleCreate = async (data) => {
    const payload = {
      ...data,
      taxRate: Number(data.taxRate || 0),
      discountValue: Number(data.discountValue || 0),
      deliveryCharge: Number(data.deliveryCharge || 0),
      items: data.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
    };

    const result = await dispatch(createOrder(payload));
    if (!result.error) {
      setCreateModal(false);
      createForm.reset({
        items: [{ name: '', description: '', quantity: 1, unit: 'plate', price: 0 }],
        discountType: 'none',
        discountValue: 0,
        taxRate: 0,
        deliveryCharge: 0,
      });
      await refreshDashboardData();
    }
  };

  const handleEdit = async (data) => {
    const payload = {
      ...data,
      taxRate: Number(data.taxRate || 0),
      discountValue: Number(data.discountValue || 0),
      deliveryCharge: Number(data.deliveryCharge || 0),
      items: data.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
    };

    const result = await dispatch(updateOrder({ id: selected._id, payload }));
    if (!result.error) {
      setEditModal(false);
      editForm.reset();
      await refreshDashboardData(selected?._id);
    }
  };

  const handleStatusUpdate = async (data) => {
    const result = await dispatch(
      updateOrderStatus({ id: selected._id, payload: data })
    );

    if (!result.error) {
      setStatusModal(false);
      statusForm.reset();
      await refreshDashboardData(selected?._id);
    }
  };

  const handlePayment = async (data) => {
    const result = await dispatch(
      addPayment({
        id: selected._id,
        payload: {
          ...data,
          amount: Number(data.amount),
        },
      })
    );

    if (!result.error) {
      setPayModal(false);
      payForm.reset();
      await refreshDashboardData(selected?._id);
    }
  };

  const handleAssignStaff = async (data) => {
    const feeValue =
      data.fee !== '' && Number(data.fee) > 0 ? Number(data.fee) : undefined;

    const payload = {
      staff: data.staff,
      ...(data.role && { role: data.role }),
      ...(data.reportTime && { reportTime: data.reportTime }),
      ...(feeValue !== undefined && { fee: feeValue }),
    };

    const result = await dispatch(assignStaff({ id: selected._id, payload }));

    if (!result.error) {
      staffForm.reset({ staff: '', role: '', reportTime: '', fee: '' });
      await refreshDashboardData(selected?._id);
      if (result.payload?.data?.order) setSelected(result.payload.data.order);
    }
  };

  const handleRemoveStaff = async (staffId) => {
    const result = await dispatch(
      removeStaff({ id: selected._id, staffId })
    );

    if (!result.error) {
      await refreshDashboardData(selected?._id);
      if (result.payload?.data?.order) setSelected(result.payload.data.order);
    }
  };

  const handleDelete = async () => {
    const result = await dispatch(deleteOrder(selected._id));
    if (!result.error) {
      setDeleteModal(false);
      setSelected(null);
      await refreshDashboardData();
    }
  };

  const handleAddExpense = async (data) => {
    const result = await dispatch(
      addOrderExpense({
        id: selected._id,
        payload: {
          ...data,
          amount: Number(data.amount),
        },
      })
    );

    if (!result.error) {
      setExpenseModal(false);
      expenseForm.reset({ paymentMethod: 'cash' });
      await refreshDashboardData(selected?._id);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const result = await dispatch(
      deleteOrderExpense({ id: selected._id, expenseId })
    );

    if (!result.error) {
      await refreshDashboardData(selected?._id);
    }
  };

  const handleGenerateInvoice = async (order, regenerate = false) => {
    const result = await dispatch(
      generateInvoice({
        orderId: order._id,
        payload: { regenerate },
      })
    );

    if (!result.error) setInvoiceModal(true);
  };

  const handleViewInvoice = async (order) => {
    try {
      await dispatch(fetchInvoiceByOrder(order._id)).unwrap();
      setInvoiceModal(true);
    } catch {
      const result = await dispatch(
        generateInvoice({
          orderId: order._id,
          payload: { regenerate: false },
        })
      );
      if (!result.error) setInvoiceModal(true);
    }
  };

  const handleSyncInvoice = async () => {
    if (selectedInvoice?._id) {
      await dispatch(syncInvoice(selectedInvoice._id));
    }
  };

  const openView = (order) => {
    dispatch(fetchOrderById(order._id));
    dispatch(fetchOrderExpenses(order._id));
    setSelected(order);
    setViewModal(true);
  };

  const openEdit = (order) => {
    setSelected(order);
    editForm.reset({
      client: order.client?._id || order.client,
      eventType: order.eventType,
      eventDate: dayjs(order.eventDate).format('YYYY-MM-DD'),
      eventTime: order.eventTime || '',
      guestCount: order.guestCount,
      venue: order.venue || {},
      discountType: order.discountType || 'none',
      discountValue: order.discountValue || 0,
      taxRate: order.taxRate || 0,
      deliveryCharge: order.deliveryCharge || 0,
      customerNotes: order.customerNotes || '',
      adminNotes: order.adminNotes || '',
      specialInstructions: order.specialInstructions || '',
      items: order.items.map((i) => ({
        name: i.name,
        description: i.description || '',
        quantity: i.quantity,
        unit: i.unit || 'plate',
        price: i.price,
      })),
    });
    setEditModal(true);
  };

  const openStatus = (order) => {
    setSelected(order);
    statusForm.reset({ status: '', note: '', cancelReason: '' });
    setStatusModal(true);
  };

  const openPay = (order) => {
    setSelected(order);
    payForm.reset({
      amount: order.balanceAmount || 0,
      paymentMethod: '',
      paymentReference: '',
      notes: '',
    });
    setPayModal(true);
  };

  const openStaff = (order) => {
    setSelected(order);
    staffForm.reset({ staff: '', role: '', reportTime: '', fee: '' });
    setStaffModal(true);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setEventTypeFilter('');
    setPaymentFilter('');
    setPage(1);
  };

  const watchStatusForm = statusForm.watch('status');

  const pendingAmount =
    stats?.totalPendingAmount ??
    stats?.pendingAmount ??
    stats?.totalBalance ??
    0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total || 0} total orders
          </p>
        </div>

        <button
          onClick={() => {
            createForm.reset({
              items: [{ name: '', description: '', quantity: 1, unit: 'plate', price: 0 }],
              discountType: 'none',
              discountValue: 0,
              taxRate: 0,
              deliveryCharge: 0,
            });
            setCreateModal(true);
          }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <FiPlus size={16} /> New Order
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(stats?.totalRevenue || 0),
            sub: `${stats?.total || 0} orders`,
            bg: 'bg-blue-100 text-blue-600',
            icon: <FaRupeeSign size={17} />,
          },
          {
            label: 'Collected Amount',
            value: formatCurrency(stats?.totalCollected || 0),
            sub: `Pending ${formatCurrency(pendingAmount)}`,
            bg: 'bg-green-100 text-green-600',
            icon: <FaRupeeSign size={17} />,
          },
          {
            label: 'Upcoming Events',
            value: stats?.upcomingThisMonth || 0,
            sub: 'This month',
            bg: 'bg-purple-100 text-purple-600',
            icon: <FiPackage size={17} />,
          },
          {
            label: 'Pending Payment',
            value: formatCurrency(pendingAmount),
            sub: `${stats?.unpaidOrders || 0} unpaid • ${stats?.partialOrders || 0} partial`,
            bg: 'bg-red-100 text-red-600',
            icon: <FaRupeeSign size={17} />,
          },
        ].map(({ label, value, sub, bg, icon }) => (
          <div key={label} className="card">
            <div className={`inline-flex p-2.5 rounded-xl mb-3 ${bg}`}>{icon}</div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ value: '', label: 'All' }, ...ORDER_STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setStatusFilter(s.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
              statusFilter === s.value
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand hover:text-brand'
            }`}
          >
            {s.label}
            {s.value && (
              <span className="ml-1.5 bg-white/30 rounded-full px-1.5 py-0.5">
                {stats?.[s.value === 'in_progress' ? 'inProgress' : s.value] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <FiSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search order no, client, city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-8"
            />
          </div>

          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-40"
          >
            <option value="">All Events</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-36"
          >
            <option value="">All Payments</option>
            {PAYMENT_STATUSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <button onClick={resetFilters} className="btn-secondary flex items-center gap-2">
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <Loader />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Create your first catering order"
            action={
              <button onClick={() => setCreateModal(true)} className="btn-primary">
                <FiPlus size={14} className="inline mr-1" /> New Order
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Order', 'Client', 'Event', 'Date', 'Guests', 'Total', 'Payment', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const statusInfo = ORDER_STATUSES.find((s) => s.value === order.status);
                  const payInfo = PAYMENT_STATUSES.find((p) => p.value === order.paymentStatus);

                  return (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold text-brand">
                          {order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(order.createdAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-brand font-bold text-xs shrink-0">
                            {order.client?.name?.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-medium text-gray-900 truncate max-w-28">
                            {order.client?.name}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-gray-700 capitalize font-medium text-xs">
                          {order.eventType?.replace(/_/g, ' ')}
                        </p>
                        {order.venue?.city && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <FiMapPin size={10} />
                            {order.venue.city}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        <p>{formatDate(order.eventDate)}</p>
                        {order.eventTime && <p className="text-gray-400">{order.eventTime}</p>}
                      </td>

                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {order.guestCount?.toLocaleString()}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        {order.balanceAmount > 0 && (
                          <p className="text-xs text-red-500">
                            Due {formatCurrency(order.balanceAmount)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge label={payInfo?.label} color={payInfo?.color} />
                      </td>

                      <td className="px-4 py-3">
                        <Badge label={statusInfo?.label} color={statusInfo?.color} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openView(order)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                            title="View"
                          >
                            <FiEye size={14} />
                          </button>

                          <button
                            onClick={() => openEdit(order)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 size={14} />
                          </button>

                          {NEXT_STATUSES[order.status]?.length > 0 && (
                            <button
                              onClick={() => openStatus(order)}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-colors"
                              title="Update Status"
                            >
                              <FiChevronRight size={14} />
                            </button>
                          )}

                          {order.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => openPay(order)}
                              className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-500 transition-colors"
                              title="Add Payment"
                            >
                              <FiDollarSign size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => openStaff(order)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition-colors"
                            title="Manage Staff"
                          >
                            <FiUsers size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setSelected(order);
                              handleViewInvoice(order);
                            }}
                            className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-500 transition-colors"
                            title="Invoice"
                          >
                            <FiFileText size={14} />
                          </button>

                          {!['completed', 'in_progress'].includes(order.status) && (
                            <button
                              onClick={() => {
                                setSelected(order);
                                setDeleteModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                              title="Delete"
                            >
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
        )}
      </div>

      <Pagination
        page={page}
        totalPages={pagination?.totalPages || 1}
        onPageChange={setPage}
      />

      <Modal
        isOpen={createModal}
        onClose={() => {
          setCreateModal(false);
          createForm.reset();
        }}
        title="New Order"
        size="xl"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                className={`input-field ${
                  createForm.formState.errors.client ? 'border-red-400' : ''
                }`}
                {...createForm.register('client')}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.phone}
                  </option>
                ))}
              </select>
              {createForm.formState.errors.client && (
                <p className="text-xs text-red-500">
                  {createForm.formState.errors.client.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Event Type <span className="text-red-500">*</span>
              </label>
              <select
                className={`input-field ${
                  createForm.formState.errors.eventType ? 'border-red-400' : ''
                }`}
                {...createForm.register('eventType')}
              >
                <option value="">Select event type</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Event Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={`input-field ${
                  createForm.formState.errors.eventDate ? 'border-red-400' : ''
                }`}
                {...createForm.register('eventDate')}
              />
              {createForm.formState.errors.eventDate && (
                <p className="text-xs text-red-500">
                  {createForm.formState.errors.eventDate.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Event Time</label>
              <input type="time" className="input-field" {...createForm.register('eventTime')} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Guest Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="250"
                className={`input-field ${
                  createForm.formState.errors.guestCount ? 'border-red-400' : ''
                }`}
                {...createForm.register('guestCount')}
              />
              {createForm.formState.errors.guestCount && (
                <p className="text-xs text-red-500">
                  {createForm.formState.errors.guestCount.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Venue</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Venue name"
                className="input-field"
                {...createForm.register('venue.name')}
              />
              <input
                type="text"
                placeholder="City"
                className="input-field"
                {...createForm.register('venue.city')}
              />
              <input
                type="text"
                placeholder="Address"
                className="input-field col-span-2"
                {...createForm.register('venue.address')}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Menu Items</p>
              <button
                type="button"
                onClick={() =>
                  appendCreateItem({
                    name: '',
                    description: '',
                    quantity: 1,
                    unit: 'plate',
                    price: 0,
                  })
                }
                className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
              >
                <FiPlus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {createItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-3"
                >
                  <input
                    type="text"
                    placeholder="Item name"
                    className="input-field col-span-4 text-sm py-1.5"
                    {...createForm.register(`items.${idx}.name`)}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    className="input-field col-span-2 text-sm py-1.5"
                    {...createForm.register(`items.${idx}.quantity`)}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    className="input-field col-span-2 text-sm py-1.5"
                    {...createForm.register(`items.${idx}.unit`)}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    min="0"
                    className="input-field col-span-3 text-sm py-1.5"
                    {...createForm.register(`items.${idx}.price`)}
                  />
                  <button
                    type="button"
                    onClick={() => removeCreateItem(idx)}
                    disabled={createItems.length === 1}
                    className="col-span-1 p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30 flex justify-center"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Discount Type</label>
                <select className="input-field text-sm" {...createForm.register('discountType')}>
                  {DISCOUNT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Discount Value</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="input-field text-sm"
                  {...createForm.register('discountValue')}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Tax Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="18"
                  className="input-field text-sm"
                  {...createForm.register('taxRate')}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Delivery Charge</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="input-field text-sm"
                  {...createForm.register('deliveryCharge')}
                />
              </div>
            </div>

            <div className="mt-3">
              <PriceSummary
                subtotal={livePrice.subtotal}
                discountAmount={livePrice.discountAmount}
                taxRate={liveTax}
                taxAmount={livePrice.taxAmount}
                deliveryCharge={liveDelivery}
                totalAmount={livePrice.totalAmount}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Customer Notes</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                placeholder="Special requests from client..."
                {...createForm.register('customerNotes')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Admin Notes</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                placeholder="Internal notes..."
                {...createForm.register('adminNotes')}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-gray-500">Special Instructions</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                placeholder="Dietary restrictions, setup requirements..."
                {...createForm.register('specialInstructions')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editModal}
        onClose={() => {
          setEditModal(false);
          editForm.reset();
        }}
        title={`Edit Order ${selected?.orderNumber}`}
        size="xl"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Event Type</label>
              <select className="input-field" {...editForm.register('eventType')}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Event Date</label>
              <input type="date" className="input-field" {...editForm.register('eventDate')} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Event Time</label>
              <input type="time" className="input-field" {...editForm.register('eventTime')} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Guest Count</label>
              <input type="number" min="1" className="input-field" {...editForm.register('guestCount')} />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Venue</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Venue name"
                className="input-field"
                {...editForm.register('venue.name')}
              />
              <input
                type="text"
                placeholder="City"
                className="input-field"
                {...editForm.register('venue.city')}
              />
              <input
                type="text"
                placeholder="Address"
                className="input-field col-span-2"
                {...editForm.register('venue.address')}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Menu Items</p>
              <button
                type="button"
                onClick={() =>
                  appendEditItem({
                    name: '',
                    description: '',
                    quantity: 1,
                    unit: 'plate',
                    price: 0,
                  })
                }
                className="text-xs text-brand font-medium flex items-center gap-1"
              >
                <FiPlus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {editItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-3"
                >
                  <input
                    type="text"
                    placeholder="Item name"
                    className="input-field col-span-4 text-sm py-1.5"
                    {...editForm.register(`items.${idx}.name`)}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    className="input-field col-span-2 text-sm py-1.5"
                    {...editForm.register(`items.${idx}.quantity`)}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    className="input-field col-span-2 text-sm py-1.5"
                    {...editForm.register(`items.${idx}.unit`)}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    className="input-field col-span-3 text-sm py-1.5"
                    {...editForm.register(`items.${idx}.price`)}
                  />
                  <button
                    type="button"
                    onClick={() => removeEditItem(idx)}
                    disabled={editItems.length === 1}
                    className="col-span-1 p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30 flex justify-center"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Discount Type</label>
              <select className="input-field text-sm" {...editForm.register('discountType')}>
                {DISCOUNT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Discount Value</label>
              <input
                type="number"
                min="0"
                className="input-field text-sm"
                {...editForm.register('discountValue')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Tax Rate %</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-field text-sm"
                {...editForm.register('taxRate')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Delivery Charge</label>
              <input
                type="number"
                min="0"
                className="input-field text-sm"
                {...editForm.register('deliveryCharge')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Customer Notes</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                {...editForm.register('customerNotes')}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Admin Notes</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                {...editForm.register('adminNotes')}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-gray-500">Special Instructions</label>
              <textarea
                rows={2}
                className="input-field text-sm resize-none"
                {...editForm.register('specialInstructions')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={statusModal}
        onClose={() => {
          setStatusModal(false);
          statusForm.reset();
        }}
        title="Update Order Status"
        size="sm"
      >
        <form onSubmit={statusForm.handleSubmit(handleStatusUpdate)} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">Current</p>
            <Badge
              label={ORDER_STATUSES.find((s) => s.value === selected?.status)?.label}
              color={ORDER_STATUSES.find((s) => s.value === selected?.status)?.color}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Move to <span className="text-red-500">*</span>
            </label>
            <select
              className={`input-field ${
                statusForm.formState.errors.status ? 'border-red-400' : ''
              }`}
              {...statusForm.register('status')}
            >
              <option value="">Select next status</option>
              {(NEXT_STATUSES[selected?.status] || []).map((s) => {
                const info = ORDER_STATUSES.find((o) => o.value === s);
                return (
                  <option key={s} value={s}>
                    {info?.label}
                  </option>
                );
              })}
            </select>
            {statusForm.formState.errors.status && (
              <p className="text-xs text-red-500">
                {statusForm.formState.errors.status.message}
              </p>
            )}
          </div>

          {watchStatusForm === 'cancelled' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Cancel Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Client changed plans"
                className={`input-field resize-none ${
                  statusForm.formState.errors.cancelReason ? 'border-red-400' : ''
                }`}
                {...statusForm.register('cancelReason')}
              />
              {statusForm.formState.errors.cancelReason && (
                <p className="text-xs text-red-500">
                  {statusForm.formState.errors.cancelReason.message}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Client confirmed via phone"
              className="input-field resize-none"
              {...statusForm.register('note')}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStatusModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={watchStatusForm === 'cancelled' ? 'btn-danger' : 'btn-primary'}
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={payModal}
        onClose={() => {
          setPayModal(false);
          payForm.reset();
        }}
        title="Record Payment"
        size="sm"
      >
        <form onSubmit={payForm.handleSubmit(handlePayment)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Total', value: formatCurrency(selected?.totalAmount), cls: 'text-gray-900' },
              { label: 'Paid', value: formatCurrency(selected?.paidAmount), cls: 'text-green-600' },
              { label: 'Balance', value: formatCurrency(selected?.balanceAmount), cls: 'text-red-600' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`font-bold text-sm ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={selected?.balanceAmount}
              className={`input-field ${
                payForm.formState.errors.amount ? 'border-red-400' : ''
              }`}
              {...payForm.register('amount')}
            />
            {payForm.formState.errors.amount && (
              <p className="text-xs text-red-500">{payForm.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              className={`input-field ${
                payForm.formState.errors.paymentMethod ? 'border-red-400' : ''
              }`}
              {...payForm.register('paymentMethod')}
            >
              <option value="">Select method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Payment Reference</label>
            <input
              type="text"
              placeholder="UPI txn ID / cheque no / bank ref..."
              className="input-field"
              {...payForm.register('paymentReference')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              className="input-field resize-none"
              placeholder="e.g. Advance payment received"
              {...payForm.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={staffModal}
        onClose={() => {
          setStaffModal(false);
          staffForm.reset({ staff: '', role: '', reportTime: '', fee: '' });
        }}
        title={`Staff — ${liveOrder?.orderNumber}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Assigned Staff ({liveOrder?.assignedStaff?.length || 0})
            </p>

            {!liveOrder?.assignedStaff?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">No staff assigned yet</p>
            ) : (
              <div className="space-y-2">
                {liveOrder.assignedStaff.map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-brand font-bold text-xs shrink-0">
                        {s.staff?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{s.staff?.name}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {s.role || s.staff?.role?.replace(/_/g, ' ')}
                          {s.reportTime && ` · Report ${s.reportTime}`}
                          {s.fee > 0 && ` · ${formatCurrency(s.fee)}`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveStaff(s.staff?._id || s.staff)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Assign New Staff
            </p>

            <form onSubmit={staffForm.handleSubmit(handleAssignStaff)} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Staff Member <span className="text-red-500">*</span>
                </label>
                <select
                  className={`input-field ${
                    staffForm.formState.errors.staff ? 'border-red-400' : ''
                  }`}
                  {...staffForm.register('staff')}
                >
                  <option value="">Select staff</option>
                  {staff
                    .filter(
                      (s) =>
                        !liveOrder?.assignedStaff?.some(
                          (a) => (a.staff?._id || a.staff) === s._id
                        )
                    )
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({capitalize(s.role?.replace(/_/g, ' '))})
                        {s.salaryAmount ? ` — ${formatCurrency(s.salaryAmount)}` : ''}
                      </option>
                    ))}
                </select>
                {staffForm.formState.errors.staff && (
                  <p className="text-xs text-red-500">{staffForm.formState.errors.staff.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Role at Event</label>
                  <input
                    type="text"
                    placeholder="e.g. Head Chef"
                    className="input-field text-sm"
                    {...staffForm.register('role')}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Report Time</label>
                  <input
                    type="time"
                    className="input-field text-sm"
                    {...staffForm.register('reportTime')}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">
                    Fee <span className="text-gray-400">(blank = salary)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Auto"
                    className="input-field text-sm"
                    {...staffForm.register('fee')}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  <FiPlus size={14} />
                  {isSubmitting ? 'Assigning...' : 'Assign Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewModal}
        onClose={() => {
          setViewModal(false);
          dispatch(clearOrderExpenses());
        }}
        title="Order Details"
        size="xl"
      >
        {selectedOrder && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-mono font-bold text-brand text-lg">{selectedOrder.orderNumber}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Created {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  label={ORDER_STATUSES.find((s) => s.value === selectedOrder.status)?.label}
                  color={ORDER_STATUSES.find((s) => s.value === selectedOrder.status)?.color}
                />
                <Badge
                  label={PAYMENT_STATUSES.find((p) => p.value === selectedOrder.paymentStatus)?.label}
                  color={PAYMENT_STATUSES.find((p) => p.value === selectedOrder.paymentStatus)?.color}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Client</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-brand font-bold shrink-0">
                      {selectedOrder.client?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedOrder.client?.name}</p>
                      <p className="text-xs text-gray-500">{selectedOrder.client?.phone}</p>
                      <p className="text-xs text-gray-400">{selectedOrder.client?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Event Details
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Event Type', value: selectedOrder.eventType?.replace(/_/g, ' ') },
                      {
                        label: 'Guest Count',
                        value: `${selectedOrder.guestCount?.toLocaleString()} guests`,
                      },
                      { label: 'Date', value: formatDate(selectedOrder.eventDate) },
                      { label: 'Time', value: selectedOrder.eventTime },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-semibold text-gray-800 capitalize">{value || '—'}</p>
                      </div>
                    ))}
                  </div>

                  {selectedOrder.venue?.name && (
                    <div className="mt-3 flex items-start gap-2 text-sm">
                      <FiMapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-gray-700">
                        {selectedOrder.venue.name}
                        {selectedOrder.venue.address && `, ${selectedOrder.venue.address}`}
                        {selectedOrder.venue.city && `, ${selectedOrder.venue.city}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Menu Items ({selectedOrder.items?.length})
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.quantity} {item.unit} × {formatCurrency(item.price)}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900">
                          {formatCurrency(item.totalPrice || item.quantity * item.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Price Breakdown
                  </p>
                  <PriceSummary
                    subtotal={selectedOrder.subtotal}
                    discountAmount={selectedOrder.discountAmount}
                    taxRate={selectedOrder.taxRate}
                    taxAmount={selectedOrder.taxAmount}
                    deliveryCharge={selectedOrder.deliveryCharge}
                    totalAmount={selectedOrder.totalAmount}
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Paid</p>
                      <p className="font-bold text-green-600">
                        {formatCurrency(selectedOrder.paidAmount)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className="font-bold text-red-600">
                        {formatCurrency(selectedOrder.balanceAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedOrder.payments?.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Payment History ({selectedOrder.payments.length})
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.payments.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="font-medium text-gray-900 capitalize">
                              {p.paymentMethod?.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDate(p.paidAt)}
                              {p.paymentReference && ` · ${p.paymentReference}`}
                            </p>
                          </div>
                          <p className="font-bold text-green-600">
                            {formatCurrency(p.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedOrder.assignedStaff?.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Assigned Staff ({selectedOrder.assignedStaff.length})
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.assignedStaff.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-brand font-bold text-xs shrink-0">
                            {s.staff?.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{s.staff?.name}</p>
                            <p className="text-xs text-gray-500">
                              {s.role}
                              {s.reportTime && ` · ${s.reportTime}`}
                            </p>
                          </div>
                          {s.fee > 0 && (
                            <p className="text-sm font-bold text-brand">{formatCurrency(s.fee)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Order Expenses {orderExpenses?.expenses?.length ? `(${orderExpenses.expenses.length})` : ''}
                    </p>
                    <button
                      onClick={() => setExpenseModal(true)}
                      className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
                    >
                      <FiPlus size={12} /> Add Expense
                    </button>
                  </div>

                  {orderExpenses && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Revenue', value: orderExpenses.orderRevenue, cls: 'text-blue-600' },
                        { label: 'Expenses', value: orderExpenses.totalExpenses, cls: 'text-red-600' },
                        {
                          label: 'Net Profit',
                          value: orderExpenses.netProfit,
                          cls: orderExpenses.netProfit >= 0 ? 'text-green-600' : 'text-orange-600',
                        },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="bg-white rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className={`font-bold text-sm ${cls}`}>
                            {formatCurrency(value || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpenseLoading ? (
                    <div className="py-4 flex justify-center">
                      <Loader />
                    </div>
                  ) : orderExpenses?.expenses?.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">
                      No expenses recorded yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {orderExpenses?.expenses?.map((e) => (
                        <div
                          key={e._id}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-gray-900 capitalize">
                              {e.category?.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {e.description && `${e.description} `}
                              {e.vendor && `· ${e.vendor} `}
                              · {formatDate(e.date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-red-600">{formatCurrency(e.amount)}</p>
                            <button
                              onClick={() => handleDeleteExpense(e._id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(selectedOrder.customerNotes ||
                  selectedOrder.adminNotes ||
                  selectedOrder.specialInstructions) && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</p>
                    {selectedOrder.customerNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Customer Notes</p>
                        <p className="text-sm text-gray-700">{selectedOrder.customerNotes}</p>
                      </div>
                    )}
                    {selectedOrder.adminNotes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Admin Notes</p>
                        <p className="text-sm text-gray-700">{selectedOrder.adminNotes}</p>
                      </div>
                    )}
                    {selectedOrder.specialInstructions && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Special Instructions</p>
                        <p className="text-sm text-gray-700">{selectedOrder.specialInstructions}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedOrder.status === 'cancelled' && selectedOrder.cancelReason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-600 font-medium mb-1">Cancellation Reason</p>
                    <p className="text-sm text-gray-700">{selectedOrder.cancelReason}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(selectedOrder.cancelledAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
              {NEXT_STATUSES[selectedOrder.status]?.length > 0 && (
                <button
                  onClick={() => {
                    setViewModal(false);
                    openStatus(selectedOrder);
                  }}
                  className="btn-secondary flex items-center gap-2 text-sm btn-sm"
                >
                  <FiChevronRight size={14} /> Update Status
                </button>
              )}

              {selectedOrder.paymentStatus !== 'paid' && (
                <button
                  onClick={() => {
                    setViewModal(false);
                    openPay(selectedOrder);
                  }}
                  className="btn-primary flex items-center gap-2 text-sm btn-sm"
                >
                  <FiDollarSign size={14} /> Add Payment
                </button>
              )}

              <button
                onClick={() => {
                  setViewModal(false);
                  openStaff(selectedOrder);
                }}
                className="btn-secondary flex items-center gap-2 text-sm btn-sm"
              >
                <FiUsers size={14} /> Manage Staff
              </button>

              <button
                onClick={() => setExpenseModal(true)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <FiPackage size={14} /> Add Expense
              </button>

              <button
                onClick={() => handleViewInvoice(selectedOrder)}
                disabled={isInvoiceSubmitting}
                className="btn-secondary flex items-center gap-2 text-sm text-teal-600 border-teal-200 hover:bg-teal-50 btn-sm"
              >
                <FiFileText size={14} />
                {isInvoiceSubmitting ? 'Loading...' : 'View Invoice'}
              </button>

              <button
                onClick={() => handleGenerateInvoice(selectedOrder, true)}
                disabled={isInvoiceSubmitting}
                className="btn-secondary flex items-center gap-2 text-sm btn-sm"
              >
                <FiFileText size={14} /> Regenerate Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={expenseModal}
        onClose={() => {
          setExpenseModal(false);
          expenseForm.reset({ paymentMethod: 'cash' });
        }}
        title="Add Order Expense"
        size="sm"
      >
        <form onSubmit={expenseForm.handleSubmit(handleAddExpense)} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              className={`input-field ${
                expenseForm.formState.errors.category ? 'border-red-400' : ''
              }`}
              {...expenseForm.register('category')}
            >
              <option value="">Select category</option>
              {ORDER_EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {expenseForm.formState.errors.category && (
              <p className="text-xs text-red-500">{expenseForm.formState.errors.category.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              placeholder="e.g. Flowers from Sharma Decorators"
              className="input-field"
              {...expenseForm.register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="5000"
                className={`input-field ${
                  expenseForm.formState.errors.amount ? 'border-red-400' : ''
                }`}
                {...expenseForm.register('amount')}
              />
              {expenseForm.formState.errors.amount && (
                <p className="text-xs text-red-500">{expenseForm.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Vendor / Payee</label>
              <input
                type="text"
                placeholder="e.g. XYZ Supplier"
                className="input-field"
                {...expenseForm.register('vendor')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Payment Method</label>
              <select className="input-field" {...expenseForm.register('paymentMethod')}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Reference</label>
              <input
                type="text"
                placeholder="UPI txn / cheque no"
                className="input-field"
                {...expenseForm.register('paymentReference')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setExpenseModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Order"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete order <span className="font-bold font-mono text-brand">{selected?.orderNumber}</span>{' '}
            for <span className="font-bold">{selected?.client?.name}</span>? This cannot be undone.
          </p>

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

      {invoiceModal && selectedInvoice && (
        <InvoicePreview
          invoice={selectedInvoice}
          onSync={handleSyncInvoice}
          onClose={() => {
            setInvoiceModal(false);
            dispatch(clearSelectedInvoice());
          }}
        />
      )}
    </div>
  );
}