// client/src/pages/calendar/CalendarPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDatesByMonth,
  createAuspiciousDate,
  updateAuspiciousDate,
  deleteAuspiciousDate,
} from '../../features/calendar/calendarSlice';
import { fetchLeads } from '../../features/leads/leadSlice';
import { fetchOrders } from '../../features/orders/orderSlice';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import Modal from '../../components/ui/Modal';
import InputField from '../../components/forms/InputField';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BENGALI_MONTHS = [
  'বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র',
  'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ',
  'ফাল্গুন', 'চৈত্র',
];

// Converts an English date string (YYYY-MM-DD) to Bengali calendar fields
function englishToBengali(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  const month = d.getUTCMonth(); // 0-indexed
  const year = d.getUTCFullYear();

  // Bengali calendar starts ~14th April each year
  // Month boundaries (approximate, day of month when Bengali month starts)
  const monthStarts = [14, 15, 15, 16, 17, 17, 17, 16, 15, 15, 14, 13];
  // Bengali month index corresponding to each English month start
  // Baisakh starts in April(3), so offset = 3
  let bMonth, bDay, bYear;

  const startDay = monthStarts[month];
  if (day >= startDay) {
    bMonth = (month - 3 + 12) % 12; // Bengali month index
    bDay = day - startDay + 1;
  } else {
    bMonth = (month - 4 + 12) % 12;
    const prevMonth = (month - 1 + 12) % 12;
    bDay = day + (monthStarts[prevMonth] - 1) - monthStarts[prevMonth] + 30;
    // Recalculate properly
    const prevStartDay = monthStarts[prevMonth];
    // days remaining in prev Bengali month
    bDay = day + (30 - (prevStartDay - 1));
  }

  // Bengali year: April 14 of English year Y = 1st Baisakh of Bengali year (Y - 593)
  if (month > 3 || (month === 3 && day >= 14)) {
    bYear = year - 593;
  } else {
    bYear = year - 594;
  }

  return {
    bengaliDay: bDay,
    bengaliMonth: BENGALI_MONTHS[bMonth],
    bengaliYear: bYear,
    bengaliDate: `${bDay} ${BENGALI_MONTHS[bMonth]} ${bYear}`,
  };
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EVENT_TYPES = [
  { value: 'biye', label: 'বিয়ে (Wedding)' },
  { value: 'annaprashan', label: 'অন্নপ্রাশন (Annaprashan)' },
  { value: 'mukhebhaat', label: 'মুখেভাত (Mukhe Bhaat)' },
  { value: 'grihapravesh', label: 'গৃহপ্রবেশ (Griha Pravesh)' },
  { value: 'namkaran', label: 'নামকরণ (Namkaran)' },
  {value: 'puja', label: 'পূজা (Puja)'},
  { value: 'upanayan', label: 'উপনয়ন (Upanayan)' },
  { value: 'other', label: 'অন্যান্য (Other)' },
];

const EVENT_COLORS = {
  biye: 'bg-amber-100 text-amber-800 border-amber-300',
  annaprashan: 'bg-green-100 text-green-800 border-green-300',
  mukhebhaat: 'bg-blue-100 text-blue-800 border-blue-300',
  grihapravesh: 'bg-purple-100 text-purple-800 border-purple-300',
  namkaran: 'bg-pink-100 text-pink-800 border-pink-300',
  puja: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  upanayan: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  other: 'bg-gray-100 text-gray-800 border-gray-300',
};

const EVENT_DOT_COLORS = {
  biye: 'bg-amber-400',
  annaprashan: 'bg-green-400',
  mukhebhaat: 'bg-blue-400',
  grihapravesh: 'bg-purple-400',
  namkaran: 'bg-pink-400',
  puja: 'bg-yellow-400',
  upanayan: 'bg-indigo-400',
  other: 'bg-gray-400',
};

const EVENT_ICONS = {
  biye: '💍',
  annaprashan: '🍚',
  mukhebhaat: '🥣',
  grihapravesh: '🏠',
  namkaran: '👶',
  puja: '🕉',
  upanayan: '🪡',
  other: '✨',
};

// ─────────────────────────────────────────────────────────
// Validation schema (English date fields only)
// ─────────────────────────────────────────────────────────

const dateSchema = yup.object({
  englishDate: yup.string().required('Date is required'),
  englishMonth: yup.string().required('Month is required'),
  englishYear: yup.number().min(2020).required('Year is required'),
  englishDay: yup.number().min(1).max(31).required('Day is required'),
  dayOfWeek: yup.string().required('Day of week is required'),
  bengaliDate: yup.string().required('Bengali date is required'),
  bengaliMonth: yup.string().required('Bengali month is required'),
  bengaliYear: yup.number().min(1400).required('Bengali year is required'),
  bengaliDay: yup.number().min(1).max(32).required('Bengali day is required'),
  events: yup.array().min(1, 'Select at least one event').required(),
  notes: yup.string().optional(),
});

// ─────────────────────────────────────────────────────────
// Calendar-grid helpers
// ─────────────────────────────────────────────────────────

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const firstWeekdayOfMonth = (year, month) => new Date(year, month, 1).getDay();

/** True if an auspicious-date record falls on this exact date. */
function isSameDay(record, year, month, day) {
  const d = new Date(record.englishDate);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const dispatch = useDispatch();
  const { dates, isSubmitting } = useSelector((s) => s.calendar);
  const { leads: monthLeads } = useSelector((s) => s.leads);
  const { orders: monthOrders } = useSelector((s) => s.orders);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selected, setSelected] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const addForm = useForm({ resolver: yupResolver(dateSchema) });
  const editForm = useForm({ resolver: yupResolver(dateSchema) });

  // Load auspicious dates + leads whenever the visible month changes
  useEffect(() => {
    dispatch(fetchDatesByMonth({ year: viewYear, month: viewMonth + 1 }));
    const start = new Date(viewYear, viewMonth, 1).toISOString().split('T')[0];
    const end = new Date(viewYear, viewMonth + 1, 0).toISOString().split('T')[0];
    dispatch(fetchLeads({ startDate: start, endDate: end, limit: 100 }));
    dispatch(fetchOrders({ startDate: start, endDate: end, limit: 100 }));
  }, [dispatch, viewYear, viewMonth]);

  // Build the 7-column grid for the visible month, one cell per day
  // (plus leading blanks so the 1st lands on the right weekday column).
  const cells = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const leadingBlanks = firstWeekdayOfMonth(viewYear, viewMonth);
    const grid = Array(leadingBlanks).fill(null);

    for (let day = 1; day <= total; day++) {
      const record = dates.find((d) => isSameDay(d, viewYear, viewMonth, day));
      const dayLeads = monthLeads.filter((l) => {
        if (!l.eventDate) return false;
        const d = new Date(l.eventDate);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
      });
      const dayOrders = monthOrders.filter((o) => {
        if (!o.eventDate) return false;
        const d = new Date(o.eventDate);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
      });

      grid.push({
        day,
        isToday:
          day === today.getDate() &&
          viewMonth === today.getMonth() &&
          viewYear === today.getFullYear(),
        record: record ?? null,
        leads: dayLeads,
        orders: dayOrders,
      });
    }
    return grid;
  }, [viewYear, viewMonth, dates, monthLeads, monthOrders, today]);

  const goToMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
    setSelected(null);
  };

  // ── Form submit handlers ──
  const toPayload = (data) => ({
    ...data,
    events: data.events.map((type) => ({
      type,
      label: EVENT_TYPES.find((e) => e.value === type)?.label.split(' ')[0],
    })),
  });

  const handleAdd = async (data) => {
    const result = await dispatch(createAuspiciousDate(toPayload(data)));
    if (!result.error) {
      setAddOpen(false);
      addForm.reset();
    }
  };

  const openEdit = (record) => {
    setEditTarget(record);
    editForm.reset({
      englishDate: new Date(record.englishDate).toISOString().split('T')[0],
      englishMonth: record.englishMonth,
      englishYear: record.englishYear,
      englishDay: record.englishDay,
      dayOfWeek: record.dayOfWeek,
      bengaliDate: record.bengaliDate || '',
      bengaliMonth: record.bengaliMonth || '',
      bengaliYear: record.bengaliYear || '',
      bengaliDay: record.bengaliDay || '',
      events: record.events.map((e) => e.type),
      notes: record.notes || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async (data) => {
    const result = await dispatch(
      updateAuspiciousDate({ id: editTarget._id, payload: toPayload(data) })
    );
    if (!result.error) {
      setEditOpen(false);
      setEditTarget(null);
      editForm.reset();
    }
  };

  const handleDelete = () => {
    if (!selected?.record) return;
    dispatch(deleteAuspiciousDate(selected.record._id));
    setDeleteOpen(false);
    setSelected(null);
  };

  // Auto-fill day-of-week and Bengali date whenever the date picker changes
  const addDateValue = addForm.watch('englishDate');
  useEffect(() => {
    if (!addDateValue) return;
    const d = new Date(addDateValue);
    addForm.setValue('dayOfWeek', WEEKDAYS[d.getDay()]);
    addForm.setValue('englishDay', d.getUTCDate());
    addForm.setValue('englishMonth', MONTHS[d.getUTCMonth()]);
    addForm.setValue('englishYear', d.getUTCFullYear());
    const bn = englishToBengali(addDateValue);
    if (bn) {
      addForm.setValue('bengaliDay', bn.bengaliDay);
      addForm.setValue('bengaliMonth', bn.bengaliMonth);
      addForm.setValue('bengaliYear', bn.bengaliYear);
      addForm.setValue('bengaliDate', bn.bengaliDate);
    }
  }, [addDateValue, addForm]);

  const editDateValue = editForm.watch('englishDate');
  useEffect(() => {
    if (!editDateValue) return;
    const d = new Date(editDateValue);
    editForm.setValue('dayOfWeek', WEEKDAYS[d.getDay()]);
    editForm.setValue('englishDay', d.getUTCDate());
    editForm.setValue('englishMonth', MONTHS[d.getUTCMonth()]);
    editForm.setValue('englishYear', d.getUTCFullYear());
    const bn = englishToBengali(editDateValue);
    if (bn) {
      editForm.setValue('bengaliDay', bn.bengaliDay);
      editForm.setValue('bengaliMonth', bn.bengaliMonth);
      editForm.setValue('bengaliYear', bn.bengaliYear);
      editForm.setValue('bengaliDate', bn.bengaliDate);
    }
  }, [editDateValue, editForm]);

  // Sync bengaliDate string whenever individual Bengali fields change
  const syncBengaliDate = (form) => {
    const { bengaliDay, bengaliMonth, bengaliYear } = form.getValues();
    if (bengaliDay && bengaliMonth && bengaliYear)
      form.setValue('bengaliDate', `${bengaliDay} ${bengaliMonth} ${bengaliYear}`);
  };

  const resetBengali = (form) => {
    const bn = englishToBengali(form.getValues('englishDate'));
    if (!bn) return;
    form.setValue('bengaliDay', bn.bengaliDay);
    form.setValue('bengaliMonth', bn.bengaliMonth);
    form.setValue('bengaliYear', bn.bengaliYear);
    form.setValue('bengaliDate', bn.bengaliDate);
  };

  // ── Shared form fields (Add + Edit use the same layout) ──
  const renderDateFields = (form) => (
    <div className="space-y-3">
      <InputField label="English Date" name="englishDate" type="date" required
        register={form.register} error={form.formState.errors.englishDate} />
      <InputField label="Day of Week" name="dayOfWeek" disabled
        register={form.register} error={form.formState.errors.dayOfWeek} />
      {/* Bengali date — editable with reset option */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-amber-700">বাংলা তারিখ (Bengali Date)</p>
          <button
            type="button"
            onClick={() => resetBengali(form)}
            className="text-xs text-amber-600 hover:text-amber-800 underline"
          >
            Auto-fill
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500">দিন</label>
            <input
              type="number" min={1} max={32}
              className="input-field text-sm"
              {...form.register('bengaliDay', { valueAsNumber: true, onChange: () => syncBengaliDate(form) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">মাস</label>
            <select
              className="input-field text-sm"
              {...form.register('bengaliMonth', { onChange: () => syncBengaliDate(form) })}
            >
              <option value="">মাস</option>
              {BENGALI_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">বছর</label>
            <input
              type="number" min={1400} max={1500}
              className="input-field text-sm"
              {...form.register('bengaliYear', { valueAsNumber: true, onChange: () => syncBengaliDate(form) })}
            />
          </div>
        </div>
        {form.formState.errors.bengaliDate && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.bengaliDate.message}</p>
        )}
        <input type="hidden" {...form.register('bengaliDate')} />
      </div>
    </div>
  );

  const renderEventCheckboxes = (form) => (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-2 block">Events</label>
      <div className="grid grid-cols-2 gap-2">
        {EVENT_TYPES.map((evt) => (
          <label key={evt.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              value={evt.value}
              {...form.register('events')}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            {evt.label}
          </label>
        ))}
      </div>
      {form.formState.errors.events && (
        <p className="text-xs text-red-500 mt-1">{form.formState.errors.events.message}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auspicious Dates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan around your key dates</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          >
            <FiPlus size={16} /> Add Event Type
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <button onClick={() => goToMonth(-1)} className="p-1.5 hover:bg-white/20 rounded-lg transition">
              <FiChevronLeft size={20} className="text-white" />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <h2 className="text-lg font-semibold text-white">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              {(viewMonth !== today.getMonth() || viewYear !== today.getFullYear()) && (
                <button
                  onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); setSelected(null); }}
                  className="text-xs text-purple-200 hover:text-white font-medium underline underline-offset-2"
                >
                  Today
                </button>
              )}
            </div>
            <button onClick={() => goToMonth(1)} className="p-1.5 hover:bg-white/20 rounded-lg transition">
              <FiChevronRight size={20} className="text-white" />
            </button>
          </div>
          {/* Stats bar */}
          <div className="grid grid-cols-3 divide-x divide-purple-100 bg-purple-50 border-b border-purple-100">
            <div className="px-4 py-2 text-center">
              <p className="text-lg font-bold text-purple-700">{dates.length}</p>
              <p className="text-[10px] text-purple-500 uppercase tracking-wide">Auspicious Days</p>
            </div>
            <div className="px-4 py-2 text-center">
              <p className="text-lg font-bold text-purple-700">
                {[...new Set(dates.flatMap((d) => d.events.map((e) => e.type)))].length}
              </p>
              <p className="text-[10px] text-purple-500 uppercase tracking-wide">Event Types</p>
            </div>
            <div className="px-4 py-2 text-center">
              <p className="text-lg font-bold text-purple-700">
                {dates.reduce((sum, d) => sum + d.events.length, 0)}
              </p>
              <p className="text-[10px] text-purple-500 uppercase tracking-wide">Total Events</p>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS_SHORT.map((day, i) => (
                <div key={day} className={`text-center text-xs font-medium py-2 ${
                  i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, idx) =>
                cell === null ? (
                  <div key={`blank-${idx}`} className="aspect-square" />
                ) : (
                  <button
                    key={cell.day}
                    onClick={() => (cell.record || cell.leads.length > 0 || cell.orders.length > 0) && setSelected(cell)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition relative
                      ${cell.record ? 'bg-purple-50 hover:bg-purple-100 cursor-pointer' : ''}
                      ${(cell.leads.length > 0 || cell.orders.length > 0) ? 'cursor-pointer hover:bg-orange-50' : 'hover:bg-gray-50'}
                      ${selected?.day === cell.day ? 'ring-2 ring-purple-600' : ''}
                    `}
                  >
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full font-medium text-sm
                      ${cell.isToday ? 'bg-purple-600 text-white' : cell.record ? 'text-purple-700' : 'text-gray-800'}
                    `}>
                      {cell.day}
                    </span>
                    <div className="flex items-center gap-0.5 mt-1">
                      {cell.record && cell.record.events.slice(0, 3).map((evt, i) => (
                        <span
                          key={i}
                          title={evt.label}
                          className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT_COLORS[evt.type] || EVENT_DOT_COLORS.other}`}
                        />
                      ))}
                      {cell.leads.length > 0 && (
                        <span className="text-[9px] font-bold bg-orange-400 text-white rounded-full px-1 leading-tight">
                          {cell.leads.length}
                        </span>
                      )}
                      {cell.orders.length > 0 && (
                        <span className="text-[9px] font-bold bg-blue-500 text-white rounded-full px-1 leading-tight">
                          {cell.orders.length}
                        </span>
                      )}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="card p-4">
          {selected ? (
            <div>
              {/* Date banner */}
              <div className="-mx-4 -mt-4 mb-4 bg-gradient-to-br from-purple-600 to-purple-700 rounded-t-xl px-4 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    {selected.record && (
                      <p className="text-purple-200 text-xs font-medium uppercase tracking-wide">{selected.record.dayOfWeek}</p>
                    )}
                    <p className="text-white text-2xl font-bold leading-tight">
                      {selected.day} {MONTHS[viewMonth]}
                    </p>
                    <p className="text-purple-200 text-sm">{viewYear}</p>
                    {selected.record?.bengaliDate && (
                      <p className="text-amber-300 text-xs mt-1 font-medium">🗓 {selected.record.bengaliDate}</p>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-purple-300 hover:text-white transition">
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Auspicious event cards */}
              {selected.record && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Auspicious Events</p>
                  <div className="space-y-2">
                    {selected.record.events.map((evt, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${EVENT_COLORS[evt.type] || EVENT_COLORS.other}`}
                      >
                        <span className="text-base">{EVENT_ICONS[evt.type]}</span>
                        <span className="text-sm font-medium">{evt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leads for this day */}
              {selected.leads.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Leads ({selected.leads.length})</p>
                  <div className="space-y-2">
                    {selected.leads.map((lead) => (
                      <div key={lead._id} className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                          <p className="text-xs text-gray-500">{lead.eventType} · {lead.guestCount} guests</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                          lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{lead.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders for this day */}
              {selected.orders.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Orders ({selected.orders.length})</p>
                  <div className="space-y-2">
                    {selected.orders.map((order) => (
                      <div key={order._id} className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            <span className="font-mono text-blue-600 text-xs">{order.orderNumber}</span> · {order.client?.name}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{order.eventType?.replace(/_/g, ' ')} · {order.guestCount} guests</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                          order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>{order.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.record?.notes && (
                <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selected.record.notes}</p>
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <Link
                  to="/leads"
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                >
                  <FiPlus size={14} /> Create Lead
                </Link>
                {isAdmin && selected.record && (
                  <>
                    <button
                      onClick={() => openEdit(selected.record)}
                      title="Edit date"
                      className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      title="Delete date"
                      className="px-3 py-2 text-red-400 hover:bg-red-50 rounded-lg transition"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-3 border-2 border-dashed border-purple-200">
                <span className="text-2xl">📅</span>
              </div>
              <p className="text-gray-600 text-sm font-medium">No date selected</p>
              <p className="text-gray-400 text-xs mt-1">Click a highlighted date to view its auspicious events</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Event Types</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(EVENT_COLORS).map(([key, colorClass]) => (
            <span
              key={key}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${colorClass}`}
            >
              {EVENT_ICONS[key]}
              <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Add modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); addForm.reset(); }}
        title="Add Auspicious Date"
        size="lg"
      >
        <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
          {renderDateFields(addForm)}
          {renderEventCheckboxes(addForm)}
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              className="input-field resize-none mt-1"
              {...addForm.register('notes')}
              placeholder="Optional..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setAddOpen(false); addForm.reset(); }} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              <FiPlus size={14} /> {isSubmitting ? 'Saving...' : 'Add Date'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditTarget(null); editForm.reset(); }}
        title="Edit Auspicious Date"
        size="lg"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          {renderDateFields(editForm)}
          {renderEventCheckboxes(editForm)}
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              className="input-field resize-none mt-1"
              {...editForm.register('notes')}
              placeholder="Optional..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setEditOpen(false); setEditTarget(null); editForm.reset(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Updating...' : 'Update Date'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Auspicious Date" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to remove this auspicious date?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}