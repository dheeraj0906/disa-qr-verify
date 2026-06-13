/**
 * Handles deep-link QR scans: /scan/checkpoint/:id
 * Resolves checkpoint context then redirects to the task form.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

export default function CheckpointScanRoute() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  // If not authenticated send to login, preserving return path
  if (!user) {
    return <Navigate to={`/login?next=/scan/checkpoint/${id}`} replace />;
  }

  useEffect(() => {
    if (!id) return;
    api
      .post(`/scan/checkpoint/${id}`)
      .then(({ data }) => {
        // Navigate to task form with context passed via state
        navigate('/worker/task', { state: { checkpoint: data.checkpoint, workerId: data.workerId }, replace: true });
      })
      .catch((err) => {
        setError(err.response?.data?.error ?? 'Checkpoint not found');
      });
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <button onClick={() => navigate('/worker/scan')} className="text-blue-600 underline text-sm">
            Back to scanner
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-gray-500">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        Resolving checkpoint…
      </div>
    </div>
  );
}
