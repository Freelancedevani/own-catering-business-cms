import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchTransactions = createAsyncThunk(
  'finance/fetchTransactions',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/transactions', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchFinanceDashboard = createAsyncThunk(
  'finance/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/dashboard');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchCashflow = createAsyncThunk(
  'finance/fetchCashflow',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/cashflow', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchMonthlyReport = createAsyncThunk(
  'finance/fetchMonthlyReport',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/report/monthly', { params });
      return data.data; // { year, yearSummary, months: [...] }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchCategoryReport = createAsyncThunk(
  'finance/fetchCategoryReport',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/finance/report/category', { params });
      return data.data; // { report: [...] }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createTransaction = createAsyncThunk(
  'finance/createTransaction',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/finance/transactions', formData);
      toast.success('Transaction recorded!');
      return data.data.transaction;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'finance/updateTransaction',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/finance/transactions/${id}`, payload);
      toast.success('Transaction updated!');
      return data.data.transaction;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'finance/deleteTransaction',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/finance/transactions/${id}`);
      toast.success('Transaction deleted!');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const financeSlice = createSlice({
  name: 'finance',
  initialState: {
    transactions:   [],
    dashboard:      null,
    cashflow:       null,
    monthlyReport:  [],   // array of month objects: [{ month, monthName, income, expense, profit }]
    categoryReport: [],   // array of report objects: [{ _id: { category, flowType }, total, count }]
    pagination:     {},
    isLoading:      false,
    isChartLoading: false,
    isSubmitting:   false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ── Transactions ──
      .addCase(fetchTransactions.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchTransactions.fulfilled, (s, a) => {
        s.isLoading    = false;
        s.transactions = a.payload.transactions;
        s.pagination   = a.payload.pagination;
      })
      .addCase(fetchTransactions.rejected,  (s) => { s.isLoading = false; })

      // ── Dashboard ──
      // API shape: { thisMonth: { income, expense, profit, incomeGrowth, expenseGrowth },
      //              lastMonth: { income, expense, profit },
      //              transactionSources, recentTransactions, pendingTransactions,
      //              topExpenseCategories, topIncomeCategories }
      .addCase(fetchFinanceDashboard.pending,   (s) => { s.isChartLoading = true; })
      .addCase(fetchFinanceDashboard.fulfilled, (s, a) => {
        s.isChartLoading = false;
        s.dashboard      = a.payload; // store entire object, access via dashboard.thisMonth.income
      })
      .addCase(fetchFinanceDashboard.rejected,  (s) => { s.isChartLoading = false; })

      // ── Cashflow ──
      // API shape: { period, summary: { totalIncome, totalExpense, netProfit, profitMargin, status },
      //              incomeBreakdown, expenseBreakdown }
      .addCase(fetchCashflow.pending,   (s) => { s.isChartLoading = true; })
      .addCase(fetchCashflow.fulfilled, (s, a) => {
        s.isChartLoading = false;
        s.cashflow       = a.payload;
      })
      .addCase(fetchCashflow.rejected,  (s) => { s.isChartLoading = false; })

      // ── Monthly Report ──
      // API shape: { year, yearSummary, months: [{ month, monthName, income, expense, profit }] }
      .addCase(fetchMonthlyReport.pending,   (s) => { s.isChartLoading = true; })
      .addCase(fetchMonthlyReport.fulfilled, (s, a) => {
        s.isChartLoading  = false;
        // ✅ FIX: extract months array from payload
        s.monthlyReport   = a.payload?.months || [];
        s.yearSummary     = a.payload?.yearSummary || null;
      })
      .addCase(fetchMonthlyReport.rejected,  (s) => { s.isChartLoading = false; })

      // ── Category Report ──
      // API shape: { report: [{ _id: { category, flowType }, total, count, avgAmount }] }
      .addCase(fetchCategoryReport.pending,   (s) => { s.isChartLoading = true; })
      .addCase(fetchCategoryReport.fulfilled, (s, a) => {
        s.isChartLoading  = false;
        // ✅ FIX: extract report array from payload
        s.categoryReport  = a.payload?.report || [];
      })
      .addCase(fetchCategoryReport.rejected,  (s) => { s.isChartLoading = false; })

      // ── Create ──
      .addCase(createTransaction.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createTransaction.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.transactions.unshift(a.payload);
      })
      .addCase(createTransaction.rejected,  (s) => { s.isSubmitting = false; })

      // ── Update ──
      .addCase(updateTransaction.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateTransaction.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.transactions.findIndex((t) => t._id === a.payload._id);
        if (idx !== -1) s.transactions[idx] = a.payload;
      })
      .addCase(updateTransaction.rejected,  (s) => { s.isSubmitting = false; })

      // ── Delete ──
      .addCase(deleteTransaction.fulfilled, (s, a) => {
        s.transactions = s.transactions.filter((t) => t._id !== a.payload);
      });
  },
});

export default financeSlice.reducer;
