import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiBell } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';

const PAGE_TITLES = {
  '/dashboard':   { title: 'Dashboard',    subtitle: 'Welcome back 👋' },
  '/leads':       { title: 'Leads',        subtitle: 'Manage your inquiries' },
  '/clients':     { title: 'Clients',      subtitle: 'Manage your clients' },
  '/orders':      { title: 'Orders',       subtitle: 'Event order management' },
  '/staff':       { title: 'Staff',        subtitle: 'Team management' },
  '/withdrawals': { title: 'Withdrawals',  subtitle: 'Salary & payment tracking' },
  '/finance':     { title: 'Finance',      subtitle: 'Cashflow & reports' },
  '/ingredients': { title: 'Menu',  subtitle: 'Manage your menu items' },
  '/calendar':    { title: 'Calendar',     subtitle: 'Auspicious dates & events' },
};

// Sample notifications — replace with real data from your API/store
const NOTIFICATIONS = [
  { id: 1, text: 'New lead assigned to you',         time: '2 min ago',  read: false },
  { id: 2, text: 'Order #1042 marked as confirmed',  time: '15 min ago', read: false },
  { id: 3, text: 'Staff payroll due this week',      time: '1 hr ago',   read: true  },
];

export default function Navbar({ onMenuClick }) {
  const { user }    = useAuth();
  const location    = useLocation();
  const pageInfo    = PAGE_TITLES[location.pathname] || { title: 'CaterCMS', subtitle: '' };

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
      {/* ── Left: Menu + Title ── */}
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

      {/* ── Right: Actions ── */}
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

          {/* Dropdown */}
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
                {NOTIFICATIONS.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !n.read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        !n.read ? 'bg-blue-500' : 'bg-transparent'
                      }`}
                    />
                    <div>
                      <p className="text-sm text-gray-800 leading-snug">{n.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-gray-100 text-center">
                <button className="text-xs text-brand font-medium hover:underline">
                  Mark all as read
                </button>
              </div>
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
