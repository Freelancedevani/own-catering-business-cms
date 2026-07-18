import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchWithdrawals = createAsyncThunk(
  'withdrawals/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/withdrawals', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchWithdrawalStats = createAsyncThunk(
  'withdrawals/fetchStats',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/withdrawals/stats', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createWithdrawal = createAsyncThunk(
  'withdrawals/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/withdrawals', formData);
      toast.success('Withdrawal request created!');
      return data.data.withdrawal;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Single status update endpoint for approve / pay / reject
export const updateWithdrawalStatus = createAsyncThunk(
  'withdrawals/updateStatus',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/withdrawals/${id}/status`, payload);
      toast.success(
        payload.status === 'approved' ? 'Withdrawal approved!'  :
        payload.status === 'paid'     ? 'Marked as paid!'       :
        'Withdrawal rejected!'
      );
      return data.data.withdrawal;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteWithdrawal = createAsyncThunk(
  'withdrawals/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/withdrawals/${id}`);
      toast.success('Withdrawal deleted!');
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const withdrawalSlice = createSlice({
  name: 'withdrawals',
  initialState: {
    withdrawals:  [],
    stats:        null,
    pagination:   {},
    isLoading:    false,
    isSubmitting: false,
    error:        null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWithdrawals.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchWithdrawals.fulfilled, (s, a) => {
        s.isLoading   = false;
        s.withdrawals = a.payload.withdrawals;
        s.pagination  = a.payload.pagination;
      })
      .addCase(fetchWithdrawals.rejected,  (s) => { s.isLoading = false; })

      .addCase(fetchWithdrawalStats.fulfilled, (s, a) => { s.stats = a.payload; })

      .addCase(createWithdrawal.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createWithdrawal.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.withdrawals.unshift(a.payload);
      })
      .addCase(createWithdrawal.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(updateWithdrawalStatus.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateWithdrawalStatus.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.withdrawals.findIndex((w) => w._id === a.payload._id);
        if (idx !== -1) s.withdrawals[idx] = a.payload;
      })
      .addCase(updateWithdrawalStatus.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(deleteWithdrawal.fulfilled, (s, a) => {
        s.withdrawals = s.withdrawals.filter((w) => w._id !== a.payload);
      });
  },
});

export default withdrawalSlice.reducer;
