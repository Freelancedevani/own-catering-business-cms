import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────

export const fetchOrders = createAsyncThunk(
  'orders/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/orders', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchOrderStats = createAsyncThunk(
  'orders/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/orders/stats');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchOrderById = createAsyncThunk(
  'orders/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      return data.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createOrder = createAsyncThunk(
  'orders/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/orders', formData);
      toast.success('Order created successfully!');
      return data.data.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateOrder = createAsyncThunk(
  'orders/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/orders/${id}`, payload);
      toast.success('Order updated!');
      return data.data.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/orders/${id}/status`, payload);
      toast.success(`Status updated to ${payload.status}!`);
      return data.data.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const addPayment = createAsyncThunk(
  'orders/addPayment',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/orders/${id}/payment`, payload);
      toast.success('Payment recorded!');
      return data.data.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const assignStaff = createAsyncThunk(
  'orders/assignStaff',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/orders/${id}/staff`, payload);
      toast.success('Staff assigned!');
      return data.data.order;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign staff');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const removeStaff = createAsyncThunk(
  'orders/removeStaff',
  async ({ id, staffId }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/orders/${id}/staff/${staffId}`);
      toast.success('Staff removed!');
      return data.data.order;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteOrder = createAsyncThunk(
  'orders/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/orders/${id}`);
      toast.success('Order deleted!');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ── Expense Thunks (NEW) ──

export const fetchOrderExpenses = createAsyncThunk(
  'orders/fetchExpenses',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/orders/${id}/expenses`);
      return data.data; // { expenses, totalExpenses, orderRevenue, netProfit }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const addOrderExpense = createAsyncThunk(
  'orders/addExpense',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/orders/${id}/expenses`, payload);
      toast.success('Expense recorded!');
      return { id, ...data.data }; // { id, expenses, totalExpenses, orderRevenue, netProfit }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteOrderExpense = createAsyncThunk(
  'orders/deleteExpense',
  async ({ id, expenseId }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/orders/${id}/expenses/${expenseId}`);
      toast.success('Expense removed!');
      return { id, ...data.data };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const upsert = (state, order) => {
  const idx = state.orders.findIndex((o) => o._id === order._id);
  if (idx !== -1) state.orders[idx] = order;
  if (state.selectedOrder?._id === order._id) state.selectedOrder = order;
};

const upsertExpenses = (state, payload) => {
  // Update orderExpenses panel
  if (state.orderExpenses) {
    state.orderExpenses.expenses     = payload.expenses;
    state.orderExpenses.totalExpenses = payload.totalExpenses;
    state.orderExpenses.netProfit     = payload.netProfit;
  }
  // Also sync into selectedOrder if it matches
  if (state.selectedOrder?._id === payload.id) {
    state.selectedOrder.expenses = payload.expenses;
  }
};

// ─────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────

const orderSlice = createSlice({
  name: 'orders',
  initialState: {
    orders:         [],
    selectedOrder:  null,
    stats:          null,
    pagination:     {},
    orderExpenses:  null, // { expenses, totalExpenses, orderRevenue, netProfit }
    isLoading:      false,
    isSubmitting:   false,
    isExpenseLoading: false,
    error:          null,
  },
  reducers: {
    clearSelectedOrder:  (state) => { state.selectedOrder  = null; },
    clearOrderExpenses:  (state) => { state.orderExpenses  = null; },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchOrders.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchOrders.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.orders     = a.payload.orders;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchOrders.rejected,  (s) => { s.isLoading = false; })

      // Stats
      .addCase(fetchOrderStats.fulfilled, (s, a) => { s.stats = a.payload; })

      // Fetch by id
      .addCase(fetchOrderById.fulfilled, (s, a) => { s.selectedOrder = a.payload; })

      // Create
      .addCase(createOrder.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createOrder.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.orders.unshift(a.payload);
      })
      .addCase(createOrder.rejected,  (s) => { s.isSubmitting = false; })

      // Update
      .addCase(updateOrder.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateOrder.fulfilled, (s, a) => {
        s.isSubmitting = false;
        upsert(s, a.payload);
      })
      .addCase(updateOrder.rejected,  (s) => { s.isSubmitting = false; })

      // Status
      .addCase(updateOrderStatus.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateOrderStatus.fulfilled, (s, a) => {
        s.isSubmitting = false;
        upsert(s, a.payload);
      })
      .addCase(updateOrderStatus.rejected,  (s) => { s.isSubmitting = false; })

      // Payment
      .addCase(addPayment.pending,   (s) => { s.isSubmitting = true; })
      .addCase(addPayment.fulfilled, (s, a) => {
        s.isSubmitting = false;
        upsert(s, a.payload);
      })
      .addCase(addPayment.rejected,  (s) => { s.isSubmitting = false; })

      // Assign / Remove staff
      .addCase(assignStaff.fulfilled, (s, a) => { upsert(s, a.payload); })
      .addCase(removeStaff.fulfilled, (s, a) => { upsert(s, a.payload); })

      // Delete
      .addCase(deleteOrder.fulfilled, (s, a) => {
        s.orders = s.orders.filter((o) => o._id !== a.payload);
      })

      // ── Expenses ──
      .addCase(fetchOrderExpenses.pending,   (s) => { s.isExpenseLoading = true; })
      .addCase(fetchOrderExpenses.fulfilled, (s, a) => {
        s.isExpenseLoading = false;
        s.orderExpenses    = a.payload;
      })
      .addCase(fetchOrderExpenses.rejected,  (s) => { s.isExpenseLoading = false; })

      .addCase(addOrderExpense.pending,   (s) => { s.isSubmitting = true; })
      .addCase(addOrderExpense.fulfilled, (s, a) => {
        s.isSubmitting = false;
        upsertExpenses(s, a.payload);
      })
      .addCase(addOrderExpense.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(deleteOrderExpense.fulfilled, (s, a) => {
        upsertExpenses(s, a.payload);
      });
  },
});

export const { clearSelectedOrder, clearOrderExpenses } = orderSlice.actions;
export default orderSlice.reducer;
