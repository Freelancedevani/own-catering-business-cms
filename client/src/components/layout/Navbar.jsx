import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiBell, FiTrash2 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../features/notifications/notificationSlice';

const PAGE_TITLES = {
  '/dashboard':   { title: 'Dashboard',    subtitle: 'Welcome back 👋' },
  '/leads':       { title: 'Leads',        subtitle: 'Manage your inquiries' },
  '/clients':     { title: 'Clients',      subtitle: 'Manage your clients' },
  '/orders':      { title: 'Orders',       subtitle: 'Event order management' },
  '/staff':       { title: 'Staff',        subtitle: 'Team management' },
  '/withdrawals': { title: 'Withdrawals',  subtitle: 'Salary & payment tracking' },
  '/finance':     { title: 'Finance',      subtitle: 'Cashflow & reports' },
  '/ingredients': { title: 'Menu',         subtitle: 'Manage your menu items' },
  '/calendar':    { title: 'Calendar',     subtitle: 'Auspicious dates & events' },
  '/contacts':    { title: 'Contact Book', subtitle: 'All contacts in one place' },
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Navbar({ onMenuClick }) {
  const { user }   = useAuth();
  const location   = useLocation();
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const pageInfo   = PAGE_TITLES[location.pathname] || { title: 'CaterCMS', subtitle: '' };

  const { items: notifications, unreadCount } = useSelector((s) => s.notifications);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Fetch on mount
  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  // Refresh every 60s
  useEffect(() => {
    const id = setInterval(() => dispatch(fetchNotifications()), 60_000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (n) => {
    if (!n.isRead) dispatch(markNotificationRead(n._id));
    if (n.link) { navigate(n.link); setNotifOpen(false); }
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
      {/* ── Left ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <FiMenu size={20} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{pageInfo.title}</h2>
          <p className="text-xs text-gray-400 hidden sm:block">{pageInfo.subtitle}</p>
        </div>
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-3">

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <FiBell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {/* List */}
              <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-gray-400">No notifications</li>
                ) : (
                  notifications.map((n) => (
                    <li
                      key={n._id}
                      onClick={() => handleNotifClick(n)}
                      className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !n.isRead ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); dispatch(deleteNotification(n._id)); }}
                        className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {/* Footer */}
              {unreadCount > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 text-center">
                  <button
                    onClick={() => dispatch(markAllNotificationsRead())}
                    className="text-xs text-brand font-medium hover:underline"
                  >
                    Mark all as read
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-brand font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
