// client/src/features/ingredients/ingredientSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchIngredients = createAsyncThunk(
  'ingredients/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const query = params.category ? `?category=${params.category}` : '';
      const res = await api.get(`/ingredient-prices${query}`);
      return res.data.data.ingredients;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch ingredients');
    }
  }
);

export const createIngredient = createAsyncThunk(
  'ingredients/create',
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post('/ingredient-prices', formData);
      return res.data.data.ingredient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || err.response?.data?.message);
    }
  }
);

export const updateIngredient = createAsyncThunk(
  'ingredients/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/ingredient-prices/${id}`, formData);
      return res.data.data.ingredient;
    } catch (err) {
      return rejectWithValue(err.response?.data?.errors || err.response?.data?.message);
    }
  }
);

export const deleteIngredient = createAsyncThunk(
  'ingredients/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/ingredient-prices/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const ingredientSlice = createSlice({
  name: 'ingredients',
  initialState: {
    items: [],
    loading: false,
    submitting: false,
    error: null,
  },
  reducers: {
    clearIngredientError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchIngredients.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchIngredients.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchIngredients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload || 'Failed to load ingredients');
      })

      // create
      .addCase(createIngredient.pending, (state) => { state.submitting = true; })
      .addCase(createIngredient.fulfilled, (state, action) => {
        state.submitting = false;
        state.items.push(action.payload);
        toast.success('Ingredient added successfully');
      })
      .addCase(createIngredient.rejected, (state, action) => {
        state.submitting = false;
        toast.error('Failed to add ingredient');
      })

      // update
      .addCase(updateIngredient.pending, (state) => { state.submitting = true; })
      .addCase(updateIngredient.fulfilled, (state, action) => {
        state.submitting = false;
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
        toast.success('Price updated successfully');
      })
      .addCase(updateIngredient.rejected, (state) => {
        state.submitting = false;
        toast.error('Failed to update price');
      })

      // delete
      .addCase(deleteIngredient.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i._id !== action.payload);
        toast.success('Ingredient removed');
      })
      .addCase(deleteIngredient.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to remove');
      });
  },
});

export const { clearIngredientError } = ingredientSlice.actions;
export default ingredientSlice.reducer;
