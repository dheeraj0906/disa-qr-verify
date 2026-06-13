import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/Login';

// Worker
import WorkerScanPage    from './pages/worker/Scan';
import TaskFormPage      from './pages/worker/TaskForm';
import WorkerHistoryPage from './pages/worker/History';

// Deep-link scan handlers (work from phone camera QR scans)
import CheckpointScanRoute from './pages/scan/CheckpointScan';
import WorkerScanRoute     from './pages/scan/WorkerScan';
import VehicleScanRoute    from './pages/scan/VehicleScan';

// Commissioner
import CommissionerDashboardPage from './pages/commissioner/Dashboard';

// Verifier
import VerifierQueuePage   from './pages/verifier/Queue';
import VerifierReviewPage  from './pages/verifier/Review';
import VerifierHistoryPage from './pages/verifier/History';

// Admin
import AdminStretchesPage   from './pages/admin/Stretches';
import AdminVehiclesPage    from './pages/admin/Vehicles';
import AdminWorkersPage     from './pages/admin/Workers';
import AdminCheckpointsPage from './pages/admin/Checkpoints';
import AdminUsersPage       from './pages/admin/Users';
import AdminReportsPage     from './pages/admin/Reports';
import AdminQRPage          from './pages/admin/QRManagement';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'super_admin':  return <Navigate to="/admin/stretches" replace />;
    case 'commissioner': return <Navigate to="/commissioner/dashboard" replace />;
    case 'verifier':     return <Navigate to="/verifier/queue" replace />;
    case 'field_worker': return <Navigate to="/worker/scan" replace />;
    default:             return <Navigate to="/login" replace />;
  }
}

function RequireAuth({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

const WORKER_ROLES = ['field_worker', 'super_admin'];
const COMM_ROLES   = ['commissioner', 'super_admin'];
const VERIFY_ROLES = ['verifier', 'super_admin'];
const ADMIN_ROLES  = ['super_admin'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* ── Deep-link scan routes (phone camera → app) ─────────────────── */}
          <Route path="/scan/checkpoint/:id" element={<CheckpointScanRoute />} />
          <Route path="/scan/worker/:id"     element={<WorkerScanRoute />} />
          <Route path="/scan/vehicle/:id"    element={<VehicleScanRoute />} />

          {/* ── Worker ───────────────────────────────────────────────────────── */}
          <Route path="/worker/scan" element={
            <RequireAuth roles={WORKER_ROLES}><WorkerScanPage /></RequireAuth>
          } />
          <Route path="/worker/task" element={
            <RequireAuth roles={WORKER_ROLES}><TaskFormPage /></RequireAuth>
          } />
          <Route path="/worker/history" element={
            <RequireAuth roles={WORKER_ROLES}><WorkerHistoryPage /></RequireAuth>
          } />

          {/* ── Commissioner ─────────────────────────────────────────────────── */}
          <Route path="/commissioner/dashboard" element={
            <RequireAuth roles={COMM_ROLES}><CommissionerDashboardPage /></RequireAuth>
          } />

          {/* ── Verifier ─────────────────────────────────────────────────────── */}
          <Route path="/verifier/queue" element={
            <RequireAuth roles={VERIFY_ROLES}><VerifierQueuePage /></RequireAuth>
          } />
          <Route path="/verifier/review/:id" element={
            <RequireAuth roles={VERIFY_ROLES}><VerifierReviewPage /></RequireAuth>
          } />
          <Route path="/verifier/history" element={
            <RequireAuth roles={VERIFY_ROLES}><VerifierHistoryPage /></RequireAuth>
          } />

          {/* ── Admin ────────────────────────────────────────────────────────── */}
          <Route path="/admin/stretches"   element={<RequireAuth roles={ADMIN_ROLES}><AdminStretchesPage /></RequireAuth>} />
          <Route path="/admin/vehicles"    element={<RequireAuth roles={ADMIN_ROLES}><AdminVehiclesPage /></RequireAuth>} />
          <Route path="/admin/workers"     element={<RequireAuth roles={ADMIN_ROLES}><AdminWorkersPage /></RequireAuth>} />
          <Route path="/admin/checkpoints" element={<RequireAuth roles={ADMIN_ROLES}><AdminCheckpointsPage /></RequireAuth>} />
          <Route path="/admin/users"       element={<RequireAuth roles={ADMIN_ROLES}><AdminUsersPage /></RequireAuth>} />
          <Route path="/admin/qr"          element={<RequireAuth roles={ADMIN_ROLES}><AdminQRPage /></RequireAuth>} />
          <Route path="/admin/reports"     element={<RequireAuth roles={ADMIN_ROLES}><AdminReportsPage /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
