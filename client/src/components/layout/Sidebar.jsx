import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  FiHome, FiUsers, FiUserCheck, FiShoppingBag,
  FiTrendingUp, FiClipboard,
  FiLogOut, FiX, FiBookOpen, FiUser, FiCalendar, FiPhoneCall,
} from 'react-icons/fi';
import { logoutUser } from '../../features/auth/authSlice';
import { useAuth } from '../../hooks/useAuth';

// ── Replace with your actual logo path ──
import logo from '../../assets/logo.png';

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Dashboard',  icon: FiHome        },
  { path: '/leads',       label: 'Leads',       icon: FiClipboard   },
  { path: '/clients',     label: 'Clients',     icon: FiUserCheck   },
  { path: '/orders',      label: 'Orders',      icon: FiShoppingBag },
  { path: '/staff',       label: 'Staff',       icon: FiUsers       },
  { path: '/finance',     label: 'Finance',     icon: FiTrendingUp  },
  { path: '/ingredients', label: 'Menu Items',  icon: FiBookOpen    },
  { path: '/calendar',    label: 'Calendar',     icon: FiCalendar    },
  { path: '/contacts',    label: 'Contact Book', icon: FiPhoneCall   },
];

export default function Sidebar({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <>
      {/* ── Mobile Overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ── Sidebar Panel ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100
        shadow-xl z-30 flex flex-col transition-transform duration-300
        lg:static lg:translate-x-0 lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* ── Logo ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/* Logo Image — swap logo.png with your actual file */}
            <img
              src={logo}
              alt="Catering App Logo"
              className="w-9 h-9 object-contain rounded-xl"
              onError={(e) => {
                // Fallback to letter avatar if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextSibling.style.display = 'flex';
              }}
            />
            {/* Fallback letter avatar (hidden by default) */}
            <div
              className="w-9 h-9 bg-brand rounded-xl items-center justify-center hidden"
              aria-hidden="true"
            >
              <span className="text-white font-bold text-lg">C</span>
            </div>

            <div>
              <h1 className="text-base font-bold text-gray-900">Event Organizer</h1>
              <p className="text-xs text-gray-400">Business Manager</p>
            </div>
          </div>

          {/* Close btn — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-100 text-brand'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`
                    p-1.5 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                    }
                  `}>
                    <Icon size={15} />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── User Profile + Logout ── */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <FiUser size={14} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                       text-sm font-medium text-red-500 hover:bg-red-50
                       transition-colors duration-200"
          >
            <div className="p-1.5 rounded-lg bg-red-50">
              <FiLogOut size={15} />
            </div>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
