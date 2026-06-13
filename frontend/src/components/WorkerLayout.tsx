import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/worker/scan',    label: 'Scan',    icon: '📷' },
  { to: '/worker/history', label: 'History', icon: '📋' },
];

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold leading-tight">DISA QR Verify</p>
          <p className="text-xs text-blue-200 leading-tight">{user?.name ?? 'Field Worker'}</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="text-xs text-blue-200 hover:text-white transition"
        >
          Sign out
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex">
        {tabs.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
                isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl mb-0.5">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
