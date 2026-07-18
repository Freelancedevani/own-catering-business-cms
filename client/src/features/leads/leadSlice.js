import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchLeads = createAsyncThunk(
  'leads/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/leads', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createLead = createAsyncThunk(
  'leads/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/leads', formData);
      toast.success('Lead created successfully!');
      return data.data.lead;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateLeadStatus = createAsyncThunk(
  'leads/updateStatus',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/leads/${id}/status`, payload);
      toast.success('Lead updated successfully!');
      return data.data.lead;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteLead = createAsyncThunk(
  'leads/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/leads/${id}`);
      toast.success('Lead deleted successfully!');
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const leadSlice = createSlice({
  name: 'leads',
  initialState: {
    leads:      [],
    pagination: {},
    isLoading:  false,
    isSubmitting: false,
    error:      null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchLeads.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchLeads.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.leads      = a.payload.leads;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchLeads.rejected, (s) => { s.isLoading = false; })

      // Create
      .addCase(createLead.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createLead.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.leads.unshift(a.payload);
      })
      .addCase(createLead.rejected, (s) => { s.isSubmitting = false; })

      // Update status
      .addCase(updateLeadStatus.fulfilled, (s, a) => {
        const idx = s.leads.findIndex((l) => l._id === a.payload._id);
        if (idx !== -1) s.leads[idx] = a.payload;
      })

      // Delete
      .addCase(deleteLead.fulfilled, (s, a) => {
        s.leads = s.leads.filter((l) => l._id !== a.payload);
      });
  },
});

export default leadSlice.reducer;
