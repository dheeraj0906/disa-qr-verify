import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/admin/stretches',   label: 'Stretches'   },
  { to: '/admin/vehicles',    label: 'Vehicles'     },
  { to: '/admin/workers',     label: 'Workers'      },
  { to: '/admin/checkpoints', label: 'Checkpoints'  },
  { to: '/admin/users',       label: 'Users'        },
  { to: '/admin/qr',          label: 'QR Codes'     },
  { to: '/admin/reports',     label: 'Reports'      },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <p className="text-sm font-bold tracking-wide text-blue-400 uppercase">DISA QR Verify</p>
          <p className="text-xs text-gray-400 mt-0.5">Admin Panel</p>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2 truncate">{user?.name}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
