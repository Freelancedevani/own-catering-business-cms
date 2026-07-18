import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchWallet = createAsyncThunk(
  'staffWallet/fetch',
  async ({ staffId, params }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/staff-wallet/${staffId}`, { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchWalletSummary = createAsyncThunk(
  'staffWallet/summary',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/staff-wallet/summary');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const creditWallet = createAsyncThunk(
  'staffWallet/credit',
  async ({ staffId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/staff-wallet/${staffId}/credit`, payload);
      toast.success('Wallet credited successfully!');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credit failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const withdrawWallet = createAsyncThunk(
  'staffWallet/withdraw',
  async ({ staffId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/staff-wallet/${staffId}/withdraw`, payload);
      toast.success('Withdrawal recorded!');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdrawal failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const creditOrderFees = createAsyncThunk(
  'staffWallet/creditOrderFees',
  async (orderId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/orders/${orderId}/credit-staff-fees`);
      toast.success('Order fees credited to staff wallets!');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to credit fees');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const staffWalletSlice = createSlice({
  name: 'staffWallet',
  initialState: {
    // Per-staff wallet view
    currentWallet:      null,   // { staff, wallet: { totalEarned, totalWithdrawn, pendingBalance } }
    transactions:       [],
    walletPagination:   {},
    // All-staff summary
    summary:            null,   // { staffList, totals }
    isLoading:          false,
    isSubmitting:       false,
    error:              null,
  },
  reducers: {
    clearWallet: (s) => {
      s.currentWallet  = null;
      s.transactions   = [];
      s.walletPagination = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWallet
      .addCase(fetchWallet.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchWallet.fulfilled, (s, a) => {
        s.isLoading        = false;
        s.currentWallet    = { staff: a.payload.staff, wallet: a.payload.wallet };
        s.transactions     = a.payload.transactions;
        s.walletPagination = a.payload.pagination;
      })
      .addCase(fetchWallet.rejected,  (s) => { s.isLoading = false; })

      // fetchWalletSummary
      .addCase(fetchWalletSummary.fulfilled, (s, a) => { s.summary = a.payload; })

      // creditWallet
      .addCase(creditWallet.pending,   (s) => { s.isSubmitting = true; })
      .addCase(creditWallet.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.transactions.unshift(a.payload.transaction);
        if (s.currentWallet) s.currentWallet.wallet.pendingBalance = a.payload.pendingBalance;
      })
      .addCase(creditWallet.rejected,  (s) => { s.isSubmitting = false; })

      // withdrawWallet
      .addCase(withdrawWallet.pending,   (s) => { s.isSubmitting = true; })
      .addCase(withdrawWallet.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.transactions.unshift(a.payload.transaction);
        if (s.currentWallet) s.currentWallet.wallet.pendingBalance = a.payload.pendingBalance;
      })
      .addCase(withdrawWallet.rejected,  (s) => { s.isSubmitting = false; })

      // creditOrderFees
      .addCase(creditOrderFees.pending,   (s) => { s.isSubmitting = true; })
      .addCase(creditOrderFees.fulfilled, (s) => { s.isSubmitting = false; })
      .addCase(creditOrderFees.rejected,  (s) => { s.isSubmitting = false; });
  },
});

export const { clearWallet } = staffWalletSlice.actions;
export default staffWalletSlice.reducer;
