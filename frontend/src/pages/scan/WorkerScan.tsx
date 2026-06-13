/**
 * Handles deep-link QR scans: /scan/worker/:id
 * Marks attendance and shows confirmation.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { formatIST } from '../../utils/formatIST';

interface AttendanceResult {
  attendance: { check_in_time: string; is_late: boolean };
  worker: { name: string };
  isLate: boolean;
}

export default function WorkerScanRoute() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [error, setError] = useState('');

  if (!user) {
    return <Navigate to={`/login?next=/scan/worker/${id}`} replace />;
  }

  useEffect(() => {
    if (!id) return;
    // Try to get current GPS for attendance
    const doScan = (lat?: number, lng?: number) => {
      api
        .post(`/scan/worker/${id}`, { lat, lng })
        .then(({ data }) => setResult(data as AttendanceResult))
        .catch((err) => setError(err.response?.data?.error ?? 'Failed to mark attendance'));
    };

    navigator.geolocation?.getCurrentPosition(
      (pos) => doScan(pos.coords.latitude, pos.coords.longitude),
      () => doScan(),
      { enableHighAccuracy: true, timeout: 8000 }
    ) ?? doScan();
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

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Marking attendance…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{result.isLate ? '⏰' : '✅'}</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Attendance Marked</h1>
        <p className="text-gray-600 mb-4">{result.worker.name}</p>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
          result.isLate ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
        }`}>
          {result.isLate ? 'Late Check-In' : 'On Time'}
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {formatIST(result.attendance.check_in_time)}
        </p>
        <button
          onClick={() => navigate('/worker/scan')}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          Back to Scanner
        </button>
      </div>
    </div>
  );
}
