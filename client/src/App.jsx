import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { fetchCurrentUser } from './features/auth/authSlice';

import LoginPage       from './pages/auth/LoginPage';
import DashboardPage   from './pages/dashboard/DashboardPage';
import LeadsPage       from './pages/leads/LeadsPage';
import ClientsPage     from './pages/clients/ClientsPage';
import StaffPage       from './pages/staff/StaffPage';
import OrdersPage      from './pages/orders/OrdersPage';
import WithdrawalsPage from './pages/withdrawals/WithdrawalsPage';
import FinancePage     from './pages/finance/FinancePage';
import DashboardLayout from './components/layout/DashboardLayout';
import Loader          from './components/ui/Loader';
import MenuPage from './pages/menu/MenuPage';
import QuotationPage from './pages/quotation/QuotationPage';
import CalendarPage from './pages/calendar/CalendarPage';
import ContactBookPage from './pages/contacts/ContactBookPage';

const ProtectedRoute = ({ children }) => {
  const { user, isChecking } = useSelector((s) => s.auth);
  if (isChecking) return <Loader fullScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, isChecking } = useSelector((s) => s.auth);
  if (isChecking) return <Loader fullScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px' },
          success: { iconTheme: { primary: '#7e22ce', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />

        <Route path="/" element={
          <ProtectedRoute><DashboardLayout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<DashboardPage />}   />
          <Route path="leads"       element={<LeadsPage />}       />
          <Route path="clients"     element={<ClientsPage />}     />
          <Route path="orders"      element={<OrdersPage />}      />
          <Route path="staff"       element={<StaffPage />}       />
          <Route path="withdrawals" element={<WithdrawalsPage />} />
          <Route path="finance"     element={<FinancePage />}     />
          <Route path="ingredients" element={<MenuPage />}  />
          <Route path="quotation"   element={<QuotationPage />}  />
          <Route path="calendar"    element={<CalendarPage />}    />
          <Route path="contacts"    element={<ContactBookPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
