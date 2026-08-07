import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchMenuItems = createAsyncThunk(
  'menu/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const query = params.category ? `?category=${params.category}` : '';
      const res = await api.get(`/menu${query}`);
      return res.data.data.ingredients;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch menu items');
    }
  }
);

export const createMenuItem = createAsyncThunk(
  'menu/create',
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post('/menu', formData);
      return res.data.data.ingredient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || err.response?.data?.message);
    }
  }
);

export const updateMenuItem = createAsyncThunk(
  'menu/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/menu/${id}`, formData);
      return res.data.data.ingredient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || err.response?.data?.message);
    }
  }
);

export const deleteMenuItem = createAsyncThunk(
  'menu/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/menu/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete');
    }
  }
);

const menuSlice = createSlice({
  name: 'menu',
  initialState: {
    items:      [],
    loading:    false,
    submitting: false,
    error:      null,
  },
  reducers: {
    clearMenuError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMenuItems.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchMenuItems.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
      .addCase(fetchMenuItems.rejected,  (s, a) => {
        s.loading = false; s.error = a.payload;
        toast.error(a.payload || 'Failed to load menu items');
      })

      .addCase(createMenuItem.pending,   (s) => { s.submitting = true; })
      .addCase(createMenuItem.fulfilled, (s, a) => {
        s.submitting = false;
        s.items.push(a.payload);
        toast.success('Menu item added!');
      })
      .addCase(createMenuItem.rejected,  (s) => { s.submitting = false; toast.error('Failed to add menu item'); })

      .addCase(updateMenuItem.pending,   (s) => { s.submitting = true; })
      .addCase(updateMenuItem.fulfilled, (s, a) => {
        s.submitting = false;
        const idx = s.items.findIndex((i) => i._id === a.payload._id);
        if (idx !== -1) s.items[idx] = a.payload;
        toast.success('Menu item updated!');
      })
      .addCase(updateMenuItem.rejected,  (s) => { s.submitting = false; toast.error('Failed to update menu item'); })

      .addCase(deleteMenuItem.fulfilled, (s, a) => {
        s.items = s.items.filter((i) => i._id !== a.payload);
        toast.success('Menu item removed');
      })
      .addCase(deleteMenuItem.rejected,  (s, a) => { toast.error(a.payload || 'Failed to remove'); });
  },
});

export const { clearMenuError } = menuSlice.actions;
export default menuSlice.reducer;
