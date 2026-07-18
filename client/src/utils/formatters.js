import dayjs from 'dayjs';

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const formatDate = (date) =>
  date ? dayjs(date).format('DD MMM YYYY') : '—';

export const formatDateTime = (date) =>
  date ? dayjs(date).format('DD MMM YYYY, hh:mm A') : '—';

export const formatPhone = (phone) =>
  phone ? `+91 ${phone}` : '—';

export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : '';

export const truncate = (str, length = 40) =>
  str && str.length > length ? `${str.substring(0, length)}...` : str;
