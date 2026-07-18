import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api   from '../../services/api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────
// Existing Thunks (unchanged)
// ─────────────────────────────────────────────
export const fetchStaff = createAsyncThunk(
  'staff/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/staff', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchStaffStats = createAsyncThunk(
  'staff/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/staff/stats');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createStaff = createAsyncThunk(
  'staff/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/staff', formData);
      toast.success('Staff member added successfully!');
      return data.data.staff;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateStaff = createAsyncThunk(
  'staff/update',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/staff/${id}`, payload);
      toast.success('Staff updated successfully!');
      return data.data.staff;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update staff');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteStaff = createAsyncThunk(
  'staff/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/staff/${id}`);
      toast.success('Staff deleted!');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete staff');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const markAttendance = createAsyncThunk(
  'staff/attendance',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/staff/${id}/attendance`, payload);
      toast.success('Attendance marked!');
      return data.data.staff;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ─────────────────────────────────────────────
// ✅ New Thunks
// ─────────────────────────────────────────────

// Upload profile picture to Cloudinary via backend
export const uploadProfilePic = createAsyncThunk(
  'staff/uploadProfilePic',
  async ({ id, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('profilePic', file);
      const { data } = await api.post(`/staff/${id}/upload-profile-pic`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Profile picture updated!');
      return { id, profilePic: data.data.profilePic };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Remove profile picture
export const removeProfilePic = createAsyncThunk(
  'staff/removeProfilePic',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/staff/${id}/remove-profile-pic`);
      toast.success('Profile picture removed!');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove picture');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Change password (admin sets new password for staff)
export const changePassword = createAsyncThunk(
  'staff/changePassword',
  async ({ id, newPassword }, { rejectWithValue }) => {
    try {
      await api.put(`/staff/${id}/change-password`, { newPassword });
      toast.success('Password updated successfully!');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Fetch attendance report for a staff member
export const fetchAttendance = createAsyncThunk(
  'staff/fetchAttendance',
  async ({ id, month, year }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/staff/${id}/attendance`, { params: { month, year } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// ─────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────
const staffSlice = createSlice({
  name: 'staff',
  initialState: {
    staff:        [],
    stats:        null,
    pagination:   {},
    attendance:   null,   // ✅ attendance report
    isLoading:    false,
    isSubmitting: false,
    isUploading:  false,  // ✅ separate uploading state for pic
    error:        null,
  },
  reducers: {
    clearError: (s) => { s.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchAll ──────────────────────────
      .addCase(fetchStaff.pending,   (s) => { s.isLoading = true;  s.error = null; })
      .addCase(fetchStaff.fulfilled, (s, a) => {
        s.isLoading  = false;
        s.staff      = a.payload.staff;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchStaff.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; })

      // ── fetchStats ────────────────────────
      .addCase(fetchStaffStats.fulfilled, (s, a) => { s.stats = a.payload; })

      // ── create ────────────────────────────
      .addCase(createStaff.pending,   (s) => { s.isSubmitting = true;  s.error = null; })
      .addCase(createStaff.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.staff.unshift(a.payload);
      })
      .addCase(createStaff.rejected,  (s, a) => { s.isSubmitting = false; s.error = a.payload; })

      // ── update ────────────────────────────
      .addCase(updateStaff.pending,   (s) => { s.isSubmitting = true;  s.error = null; })
      .addCase(updateStaff.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.staff.findIndex((m) => m._id === a.payload._id);
        if (idx !== -1) s.staff[idx] = a.payload;
      })
      .addCase(updateStaff.rejected,  (s, a) => { s.isSubmitting = false; s.error = a.payload; })

      // ── delete ────────────────────────────
      .addCase(deleteStaff.pending,   (s) => { s.isSubmitting = true; })
      .addCase(deleteStaff.fulfilled, (s, a) => {
        s.isSubmitting = false;
        s.staff = s.staff.filter((m) => m._id !== a.payload);
      })
      .addCase(deleteStaff.rejected,  (s, a) => { s.isSubmitting = false; s.error = a.payload; })

      // ── attendance ────────────────────────
      .addCase(markAttendance.pending,   (s) => { s.isSubmitting = true; })
      .addCase(markAttendance.fulfilled, (s, a) => {
        s.isSubmitting = false;
        const idx = s.staff.findIndex((m) => m._id === a.payload._id);
        if (idx !== -1) s.staff[idx] = a.payload;
      })
      .addCase(markAttendance.rejected,  (s, a) => { s.isSubmitting = false; s.error = a.payload; })

      .addCase(fetchAttendance.pending,   (s) => { s.isLoading = true; })
      .addCase(fetchAttendance.fulfilled, (s, a) => { s.isLoading = false; s.attendance = a.payload; })
      .addCase(fetchAttendance.rejected,  (s) => { s.isLoading = false; })

      // ✅ uploadProfilePic ──────────────────
      .addCase(uploadProfilePic.pending,   (s) => { s.isUploading = true;  s.error = null; })
      .addCase(uploadProfilePic.fulfilled, (s, a) => {
        s.isUploading = false;
        const idx = s.staff.findIndex((m) => m._id === a.payload.id);
        if (idx !== -1) s.staff[idx].profilePic = a.payload.profilePic;
      })
      .addCase(uploadProfilePic.rejected,  (s, a) => { s.isUploading = false; s.error = a.payload; })

      // ✅ removeProfilePic ──────────────────
      .addCase(removeProfilePic.pending,   (s) => { s.isUploading = true; })
      .addCase(removeProfilePic.fulfilled, (s, a) => {
        s.isUploading = false;
        const idx = s.staff.findIndex((m) => m._id === a.payload);
        if (idx !== -1) s.staff[idx].profilePic = { url: '', publicId: '' };
      })
      .addCase(removeProfilePic.rejected,  (s, a) => { s.isUploading = false; s.error = a.payload; })

      // ✅ changePassword ────────────────────
      .addCase(changePassword.pending,   (s) => { s.isSubmitting = true; })
      .addCase(changePassword.fulfilled, (s) => { s.isSubmitting = false; })
      .addCase(changePassword.rejected,  (s, a) => { s.isSubmitting = false; s.error = a.payload; });
  },
});

export const { clearError } = staffSlice.actions;
export default staffSlice.reducer;
