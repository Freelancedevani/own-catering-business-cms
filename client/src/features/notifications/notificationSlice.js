import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/notifications?limit=20');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id) => {
    await api.patch(`/notifications/${id}/read`);
    return id;
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async () => {
    await api.patch('/notifications/read-all');
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (id) => {
    await api.delete(`/notifications/${id}`);
    return id;
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.items       = payload.notifications;
        state.unreadCount = payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })

      .addCase(markNotificationRead.fulfilled, (state, { payload: id }) => {
        const n = state.items.find((n) => n._id === id);
        if (n && !n.isRead) { n.isRead = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
      })

      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.isRead = true; });
        state.unreadCount = 0;
      })

      .addCase(deleteNotification.fulfilled, (state, { payload: id }) => {
        const n = state.items.find((n) => n._id === id);
        if (n && !n.isRead) state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.items = state.items.filter((n) => n._id !== id);
      });
  },
});

export default notificationSlice.reducer;
