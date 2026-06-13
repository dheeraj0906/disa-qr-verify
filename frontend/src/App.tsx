import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/Login';

// Worker
import WorkerScanPage from './pages/worker/Scan';
import WorkerHistoryPage from './pages/worker/History';

// Commissioner
import CommissionerDashboardPage from './pages/commissioner/Dashboard';

// Verifier
import VerifierQueuePage from './pages/verifier/Queue';
import VerifierReviewPage from './pages/verifier/Review';
import VerifierHistoryPage from './pages/verifier/History';

// Admin
import AdminStretchesPage from './pages/admin/Stretches';
import AdminVehiclesPage from './pages/admin/Vehicles';
import AdminWorkersPage from './pages/admin/Workers';
import AdminCheckpointsPage from './pages/admin/Checkpoints';
import AdminUsersPage from './pages/admin/Users';
import AdminReportsPage from './pages/admin/Reports';
import AdminQRPage from './pages/admin/QRManagement';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'super_admin':   return <Navigate to="/admin/stretches" replace />;
    case 'commissioner':  return <Navigate to="/commissioner/dashboard" replace />;
    case 'verifier':      return <Navigate to="/verifier/queue" replace />;
    case 'field_worker':  return <Navigate to="/worker/scan" replace />;
    default:              return <Navigate to="/login" replace />;
  }
}

function RequireAuth({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Worker */}
          <Route path="/worker/scan" element={
            <RequireAuth roles={['field_worker','super_admin']}><WorkerScanPage /></RequireAuth>
          } />
          <Route path="/worker/history" element={
            <RequireAuth roles={['field_worker','super_admin']}><WorkerHistoryPage /></RequireAuth>
          } />

          {/* Commissioner */}
          <Route path="/commissioner/dashboard" element={
            <RequireAuth roles={['commissioner','super_admin']}><CommissionerDashboardPage /></RequireAuth>
          } />

          {/* Verifier */}
          <Route path="/verifier/queue" element={
            <RequireAuth roles={['verifier','super_admin']}><VerifierQueuePage /></RequireAuth>
          } />
          <Route path="/verifier/review/:id" element={
            <RequireAuth roles={['verifier','super_admin']}><VerifierReviewPage /></RequireAuth>
          } />
          <Route path="/verifier/history" element={
            <RequireAuth roles={['verifier','super_admin']}><VerifierHistoryPage /></RequireAuth>
          } />

          {/* Admin */}
          <Route path="/admin/stretches" element={
            <RequireAuth roles={['super_admin']}><AdminStretchesPage /></RequireAuth>
          } />
          <Route path="/admin/vehicles" element={
            <RequireAuth roles={['super_admin']}><AdminVehiclesPage /></RequireAuth>
          } />
          <Route path="/admin/workers" element={
            <RequireAuth roles={['super_admin']}><AdminWorkersPage /></RequireAuth>
          } />
          <Route path="/admin/checkpoints" element={
            <RequireAuth roles={['super_admin']}><AdminCheckpointsPage /></RequireAuth>
          } />
          <Route path="/admin/users" element={
            <RequireAuth roles={['super_admin']}><AdminUsersPage /></RequireAuth>
          } />
          <Route path="/admin/qr" element={
            <RequireAuth roles={['super_admin']}><AdminQRPage /></RequireAuth>
          } />
          <Route path="/admin/reports" element={
            <RequireAuth roles={['super_admin']}><AdminReportsPage /></RequireAuth>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
