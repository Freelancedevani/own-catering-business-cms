import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchClients = createAsyncThunk(
  'clients/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/clients', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchClientStats = createAsyncThunk(
  'clients/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/clients/stats');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createClient = createAsyncThunk(
  'clients/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/clients', formData);
      toast.success('Client created successfully!');
      return data.data.client;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateClient = createAsyncThunk(
  'clients/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/clients/${id}`, payload);
      toast.success('Client updated successfully!');
      return data.data.client;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteClient = createAsyncThunk(
  'clients/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client deleted successfully!');
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const convertLeadToClient = createAsyncThunk(
  'clients/convertLead',
  async (leadId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/clients/convert/${leadId}`);
      toast.success('Lead converted to client!');
      return data.data.client;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const clientSlice = createSlice({
  name: 'clients',
  initialState: {
    clients:      [],
    stats:        null,
    pagination:   {},
    isLoading:    false,
    isSubmitting: false,
    error:        null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchClients.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchClients.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.clients    = a.payload.clients;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchClients.rejected, (s) => { s.isLoading = false; })

      // Stats
      .addCase(fetchClientStats.fulfilled, (s, a) => { s.stats = a.payload; })

      // Create
      .addCase(createClient.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createClient.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.clients.unshift(a.payload);
      })
      .addCase(createClient.rejected, (s) => { s.isSubmitting = false; })

      // Update
      .addCase(updateClient.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateClient.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.clients.findIndex((c) => c._id === a.payload._id);
        if (idx !== -1) s.clients[idx] = a.payload;
      })
      .addCase(updateClient.rejected, (s) => { s.isSubmitting = false; })

      // Delete
      .addCase(deleteClient.fulfilled, (s, a) => {
        s.clients = s.clients.filter((c) => c._id !== a.payload);
      })

      // Convert Lead
      .addCase(convertLeadToClient.fulfilled, (s, a) => {
        s.clients.unshift(a.payload);
      });
  },
});

export default clientSlice.reducer;
