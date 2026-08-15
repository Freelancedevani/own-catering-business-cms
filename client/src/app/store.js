import { configureStore } from '@reduxjs/toolkit';
import authReducer       from '../features/auth/authSlice';
import dashboardReducer  from '../features/dashboard/dashboardSlice';
import leadReducer       from '../features/leads/leadSlice';
import clientReducer     from '../features/clients/clientSlice';
import staffReducer      from '../features/staff/staffSlice';
import staffWalletReducer from '../features/staff/staffWalletSlice'; 
import orderReducer      from '../features/orders/orderSlice';
import withdrawalReducer from '../features/withdrawals/withdrawalSlice';
import financeReducer    from '../features/finance/financeSlice';
import menuReducer from '../features/menu/menuSlice';
import invoiceReducer from '../features/invoices/invoiceSlice';
import calendarReducer from '../features/calendar/calendarSlice';
import contactBookReducer from '../features/contacts/contactBookSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import quotationReducer from '../features/quotation/quotationSlice';

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    dashboard:     dashboardReducer,
    leads:         leadReducer,
    clients:       clientReducer,
    staff:         staffReducer,
    staffWallet:   staffWalletReducer,
    orders:        orderReducer,
    withdrawals:   withdrawalReducer,
    finance:       financeReducer,
    menu:          menuReducer,
    invoices:      invoiceReducer,
    calendar:      calendarReducer,
    contacts:      contactBookReducer,
    notifications: notificationReducer,
    quotation:     quotationReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});
