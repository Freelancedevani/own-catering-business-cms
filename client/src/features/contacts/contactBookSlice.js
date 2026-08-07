import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchContacts = createAsyncThunk(
  'contacts/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/contacts', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createContact = createAsyncThunk(
  'contacts/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/contacts', payload);
      toast.success('Contact added!');
      return data.data.contact;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateContact = createAsyncThunk(
  'contacts/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/contacts/${id}`, payload);
      toast.success('Contact updated!');
      return data.data.contact;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/contacts/${id}`);
      toast.success('Contact deleted!');
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const syncContacts = createAsyncThunk(
  'contacts/sync',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.post('/contacts/sync');
      toast.success(data.message);
      dispatch(fetchContacts({ page: 1, limit: 20 }));
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ── Import: upload an .xlsx/.csv file. Backend only reads Name/Phone/Address,
//    fills "nil" for anything blank, and skips rows with no phone number. ──
export const importContacts = createAsyncThunk(
  'contacts/import',
  async (file, { dispatch, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message);
      dispatch(fetchContacts({ page: 1, limit: 20 }));
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Import failed';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── Export: fields is an array of column keys, e.g. ['name','phone'].
//    Defaults to name+phone on the backend if omitted. ──
export const exportContacts = createAsyncThunk(
  'contacts/export',
  async ({ fields, search, source } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (fields?.length) params.fields = fields.join(',');
      if (search) params.search = search;
      if (source) params.source = source;

      const response = await api.get('/contacts/export', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contacts-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export downloaded!');
      return true;
    } catch (err) {
      toast.error('Export failed');
      return rejectWithValue(err.message);
    }
  }
);

const contactBookSlice = createSlice({
  name: 'contacts',
  initialState: {
    contacts:     [],
    pagination:   {},
    isLoading:    false,
    isSubmitting: false,
    isSyncing:    false,
    isImporting:  false,
    isExporting:  false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContacts.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchContacts.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.contacts   = a.payload.contacts;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchContacts.rejected,  (s) => { s.isLoading = false; })

      .addCase(createContact.pending,   (s) => { s.isSubmitting = true; })
      .addCase(createContact.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.contacts.unshift(a.payload);
      })
      .addCase(createContact.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(updateContact.pending,   (s) => { s.isSubmitting = true; })
      .addCase(updateContact.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.contacts.findIndex((c) => c._id === a.payload._id);
        if (idx !== -1) s.contacts[idx] = a.payload;
      })
      .addCase(updateContact.rejected,  (s) => { s.isSubmitting = false; })

      .addCase(deleteContact.fulfilled, (s, a) => {
        s.contacts = s.contacts.filter((c) => c._id !== a.payload);
      })

      .addCase(syncContacts.pending,   (s) => { s.isSyncing = true; })
      .addCase(syncContacts.fulfilled, (s) => { s.isSyncing = false; })
      .addCase(syncContacts.rejected,  (s) => { s.isSyncing = false; })

      .addCase(importContacts.pending,   (s) => { s.isImporting = true; })
      .addCase(importContacts.fulfilled, (s) => { s.isImporting = false; })
      .addCase(importContacts.rejected,  (s) => { s.isImporting = false; })

      .addCase(exportContacts.pending,   (s) => { s.isExporting = true; })
      .addCase(exportContacts.fulfilled, (s) => { s.isExporting = false; })
      .addCase(exportContacts.rejected,  (s) => { s.isExporting = false; });
  },
});

export default contactBookSlice.reducer;