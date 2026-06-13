/**
 * Handles deep-link QR scans: /scan/vehicle/:id
 * Resolves vehicle context → redirects to task form (check-in at start checkpoint).
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

export default function VehicleScanRoute() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (!user) {
    return <Navigate to={`/login?next=/scan/vehicle/${id}`} replace />;
  }

  useEffect(() => {
    if (!id) return;
    api
      .post(`/scan/vehicle/${id}`)
      .then(({ data }) => {
        // Find the start checkpoint for this vehicle's stretch and go to task form
        navigate('/worker/task', {
          state: {
            vehicle: data.vehicle,
            stretchId: data.vehicle.stretch_id,
            stretchName: data.vehicle.stretch_name,
            workerId: data.workerId,
            fromVehicle: true,
          },
          replace: true,
        });
      })
      .catch((err) => setError(err.response?.data?.error ?? 'Vehicle not found'));
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
        Resolving vehicle…
      </div>
    </div>
  );
}
