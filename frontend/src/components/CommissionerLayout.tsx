import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CommissionerLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-bold tracking-wide">DISA QR Verify</p>
            <p className="text-xs text-slate-400">Real-Time Monitoring Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-xs text-slate-400">{user?.name}</span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
