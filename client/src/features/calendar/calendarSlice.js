// client/src/features/calendar/calendarSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ── Async Thunks ──

export const fetchAuspiciousDateById = createAsyncThunk(
    'calendar/fetchById',
    async (id, { rejectWithValue }) => {
        try {
            const { data } = await api.get(`/auspicious-dates/${id}`);
            return data.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const fetchAuspiciousDates = createAsyncThunk(
    'calendar/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const { data } = await api.get('/auspicious-dates', { params });
            return data.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const fetchDatesByMonth = createAsyncThunk(
    'calendar/fetchByMonth',
    async ({ year, month }, { rejectWithValue }) => {
        try {
            const { data } = await api.get('/auspicious-dates/month', { params: { year, month } });
            return data.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const fetchDatesByBengaliMonth = createAsyncThunk(
    'calendar/fetchByBengaliMonth',
    async ({ bengaliYear, bengaliMonth }, { rejectWithValue }) => {
        try {
            const { data } = await api.get('/auspicious-dates/bengali-month', {
                params: { bengaliYear, bengaliMonth },
            });
            return data.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const fetchYearlySummary = createAsyncThunk(
    'calendar/fetchSummary',
    async (year, { rejectWithValue }) => {
        try {
            const { data } = await api.get(`/auspicious-dates/summary/${year}`);
            return data.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const createAuspiciousDate = createAsyncThunk(
    'calendar/create',
    async (formData, { rejectWithValue }) => {
        try {
            const { data } = await api.post('/auspicious-dates', formData);
            toast.success('Auspicious date added!');
            return data.data;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add date');
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const updateAuspiciousDate = createAsyncThunk(
    'calendar/update',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const { data } = await api.put(`/auspicious-dates/${id}`, payload);
            toast.success('Date updated!');
            return data.data;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update date');
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const deleteAuspiciousDate = createAsyncThunk(
    'calendar/delete',
    async (id, { rejectWithValue }) => {
        try {
            await api.delete(`/auspicious-dates/${id}`);
            toast.success('Date removed!');
            return id;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete date');
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

// ── Slice ──

const calendarSlice = createSlice({
    name: 'calendar',
    initialState: {
        dates: [],
        selectedDate: null,
        summary: null,
        isLoading: false,
        isSubmitting: false,
        error: null,
    },
    reducers: {
        clearSelectedDate: (state) => {
            state.selectedDate = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch by ID
            .addCase(fetchAuspiciousDateById.pending, (s) => { s.isLoading = true; })
            .addCase(fetchAuspiciousDateById.fulfilled, (s, a) => {
                s.isLoading = false;
                s.selectedDate = a.payload;
            })
            .addCase(fetchAuspiciousDateById.rejected, (s) => { s.isLoading = false; })

            // Fetch all dates
            .addCase(fetchAuspiciousDates.pending, (s) => {
                s.isLoading = true;
            })
            .addCase(fetchAuspiciousDates.fulfilled, (s, a) => {
                s.isLoading = false;
                s.dates = a.payload;
            })
            .addCase(fetchAuspiciousDates.rejected, (s) => {
                s.isLoading = false;
            })

            // Fetch by month
            .addCase(fetchDatesByMonth.pending, (s) => {
                s.isLoading = true;
            })
            .addCase(fetchDatesByMonth.fulfilled, (s, a) => {
                s.isLoading = false;
                s.dates = a.payload;
            })
            .addCase(fetchDatesByMonth.rejected, (s) => {
                s.isLoading = false;
            })

            // Fetch by Bengali month
            .addCase(fetchDatesByBengaliMonth.fulfilled, (s, a) => {
                s.dates = a.payload;
            })

            // Yearly summary
            .addCase(fetchYearlySummary.fulfilled, (s, a) => {
                s.summary = a.payload;
            })

            // Create
            .addCase(createAuspiciousDate.pending, (s) => {
                s.isSubmitting = true;
            })
            .addCase(createAuspiciousDate.fulfilled, (s, a) => {
                s.isSubmitting = false;
                s.dates.unshift(a.payload);
            })
            .addCase(createAuspiciousDate.rejected, (s) => {
                s.isSubmitting = false;
            })

            // Update
            .addCase(updateAuspiciousDate.pending, (s) => {
                s.isSubmitting = true;
            })
            .addCase(updateAuspiciousDate.fulfilled, (s, a) => {
                s.isSubmitting = false;
                const idx = s.dates.findIndex((d) => d._id === a.payload._id);
                if (idx !== -1) s.dates[idx] = a.payload;
                if (s.selectedDate?._id === a.payload._id) s.selectedDate = a.payload;
            })
            .addCase(updateAuspiciousDate.rejected, (s) => {
                s.isSubmitting = false;
            })

            // Delete
            .addCase(deleteAuspiciousDate.fulfilled, (s, a) => {
                s.dates = s.dates.filter((d) => d._id !== a.payload);
            });
    },
});

export const { clearSelectedDate, clearError } = calendarSlice.actions;
export default calendarSlice.reducer;