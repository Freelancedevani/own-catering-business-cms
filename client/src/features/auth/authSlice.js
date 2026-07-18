import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ── Async Thunks ──
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      return data.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout');
});

export const fetchCurrentUser = createAsyncThunk(
  'auth/me',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      return data.data.user;
    } catch (err) {
      return rejectWithValue(null);
    }
  }
);

// ── Slice ──
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:        null,
    isLoading:   false,
    isChecking:  true, // checking session on app load
    error:       null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending,   (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user      = action.payload;
        toast.success(`Welcome back, ${action.payload.name}!`);
      })
      .addCase(loginUser.rejected,  (state, action) => {
        state.isLoading = false;
        state.error     = action.payload;
      })

      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        toast.success('Logged out successfully');
      })

      // Fetch current user (session check)
      .addCase(fetchCurrentUser.pending,   (state) => { state.isChecking = true; })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isChecking = false;
        state.user       = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isChecking = false;
        state.user       = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
