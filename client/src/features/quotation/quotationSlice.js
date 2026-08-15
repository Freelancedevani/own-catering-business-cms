import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const generateQuotation = createAsyncThunk(
  'quotation/generate',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.post('/quotation/generate', payload);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to generate quotation');
    }
  }
);

const quotationSlice = createSlice({
  name: 'quotation',
  initialState: { result: null, loading: false, error: null },
  reducers: {
    clearQuotation: (state) => { state.result = null; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateQuotation.pending,   (s) => { s.loading = true; s.error = null; s.result = null; })
      .addCase(generateQuotation.fulfilled, (s, a) => { s.loading = false; s.result = a.payload; })
      .addCase(generateQuotation.rejected,  (s, a) => {
        s.loading = false; s.error = a.payload;
        toast.error(a.payload || 'Failed to generate quotation');
      });
  },
});

export const { clearQuotation } = quotationSlice.actions;
export default quotationSlice.reducer;
