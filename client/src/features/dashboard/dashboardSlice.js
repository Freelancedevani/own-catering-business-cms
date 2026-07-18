import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const [orders, leads, clients, staff, finance] = await Promise.all([
        api.get('/orders/stats'),
        api.get('/leads?limit=5&status=new'),
        api.get('/clients/stats'),
        api.get('/staff/stats'),
        api.get('/finance/dashboard'),
      ]);
      return {
        orderStats:   orders.data.data,
        recentLeads:  leads.data.data,
        clientStats:  clients.data.data,
        staffStats:   staff.data.data,
        financeStats: finance.data.data,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    orderStats:   null,
    recentLeads:  null,
    clientStats:  null,
    staffStats:   null,
    financeStats: null,
    isLoading:    false,
    error:        null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending,   (s) => { s.isLoading = true; s.error = null; })
      .addCase(fetchDashboardData.fulfilled, (s, a) => {
        s.isLoading    = false;
        s.orderStats   = a.payload.orderStats;
        s.recentLeads  = a.payload.recentLeads;
        s.clientStats  = a.payload.clientStats;
        s.staffStats   = a.payload.staffStats;
        s.financeStats = a.payload.financeStats;
      })
      .addCase(fetchDashboardData.rejected, (s, a) => {
        s.isLoading = false;
        s.error     = a.payload;
      });
  },
});

export default dashboardSlice.reducer;
