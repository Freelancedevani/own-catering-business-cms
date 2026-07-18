import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchInvoices = createAsyncThunk(
  'invoices/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/invoices', { params });
      return data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchInvoiceById = createAsyncThunk(
  'invoices/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      return data.data.invoice;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const fetchInvoiceByOrder = createAsyncThunk(
  'invoices/fetchByOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/invoices/by-order/${orderId}`);
      return data.data.invoice;
    } catch (err) {
      // Silently reject — caller handles the 404
      return rejectWithValue(err.response?.data?.message);
    }
  }
);


export const generateInvoice = createAsyncThunk(
  'invoices/generate',
  async ({ orderId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/invoices/generate/${orderId}`, payload);
      toast.success('Invoice generated!');
      return data.data.invoice;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const syncInvoice = createAsyncThunk(
  'invoices/sync',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/invoices/${id}/sync`);
      toast.success('Invoice synced!');
      return data.data.invoice;
    } catch (err) {
      toast.error('Sync failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateInvoice = createAsyncThunk(
  'invoices/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/invoices/${id}`, payload);
      toast.success('Invoice updated!');
      return data.data.invoice;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

export const deleteInvoice = createAsyncThunk(
  'invoices/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted!');
      return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

const upsert = (state, invoice) => {
  const idx = state.invoices.findIndex((i) => i._id === invoice._id);
  if (idx !== -1) state.invoices[idx] = invoice;
  if (state.selectedInvoice?._id === invoice._id) state.selectedInvoice = invoice;
};

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState: {
    invoices:        [],
    selectedInvoice: null,
    pagination:      {},
    isLoading:       false,
    isSubmitting:    false,
    error:           null,
  },
  reducers: {
    clearSelectedInvoice: (state) => { state.selectedInvoice = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchInvoices.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.invoices   = a.payload.invoices;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchInvoices.rejected,  (s) => { s.isLoading = false; })

      .addCase(fetchInvoiceById.fulfilled,    (s, a) => { s.selectedInvoice = a.payload; })
      .addCase(fetchInvoiceByOrder.fulfilled, (s, a) => { s.selectedInvoice = a.payload; })

      .addCase(generateInvoice.pending,   (s) => { s.isSubmitting = true; })
      .addCase(generateInvoice.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.selectedInvoice = a.payload;
        s.invoices.unshift(a.payload);
      })
      .addCase(generateInvoice.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(syncInvoice.fulfilled,   (s, a) => { upsert(s, a.payload); s.selectedInvoice = a.payload; })
      .addCase(updateInvoice.fulfilled, (s, a) => { upsert(s, a.payload); })
      .addCase(deleteInvoice.fulfilled, (s, a) => {
        s.invoices = s.invoices.filter((i) => i._id !== a.payload);
        if (s.selectedInvoice?._id === a.payload) s.selectedInvoice = null;
      });
  },
});

export const { clearSelectedInvoice } = invoiceSlice.actions;
export default invoiceSlice.reducer;
