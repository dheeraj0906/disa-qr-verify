import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/verifier/queue',   label: 'Queue' },
  { to: '/verifier/history', label: 'History' },
];

export default function VerifierLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <header className="bg-teal-800 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-bold tracking-wide">DISA QR Verify</p>
          <p className="text-xs text-teal-300">Verification Panel</p>
        </div>
        <div className="flex items-center gap-5">
          <nav className="flex gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-xs px-3 py-1.5 rounded-lg transition ${
                    isActive
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-teal-200 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 border-l border-teal-700 pl-5">
            <span className="text-xs text-teal-300">{user?.name}</span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-teal-300 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
