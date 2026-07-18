import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL:         '/api',   // proxy handles it in dev
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong';
    const status  = error.response?.status;
    if (status === 401 && !error.config.url.includes('/auth/me')) {
      window.location.href = '/login';
    }
    if (status !== 401) toast.error(message);
    return Promise.reject(error);
  }
);

export default api;
