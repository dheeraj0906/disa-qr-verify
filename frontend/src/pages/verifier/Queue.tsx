import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import VerifierLayout from '../../components/VerifierLayout';
import { taskLogsApi } from '../../api';
import { formatIST } from '../../utils/formatIST';
import type { TaskLog } from '../../types';

const COLOR_DOT: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
};

const CHECKPOINT_LABEL: Record<string, string> = {
  start: 'Check-In',
  mid:   'Progress',
  end:   'Completion',
};

export default function VerifierQueuePage() {
  const [queue, setQueue]   = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const navigate  = useNavigate();
  const location  = useLocation();
  const flash     = (location.state as { flash?: string } | null)?.flash ?? '';

  useEffect(() => {
    taskLogsApi.pending()
      .then(({ data }) => setQueue(data))
      .catch(() => setError('Failed to load verification queue.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <VerifierLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Pending Verification</h1>
            <p className="text-xs text-gray-400">Oldest submissions first — click to review</p>
          </div>
          {!loading && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              queue.length > 0
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              {queue.length} pending
            </span>
          )}
        </div>

        {/* Flash */}
        {flash && (
          <div className="bg-green-50 border border-green-300 text-green-700 text-sm px-4 py-2.5 rounded-xl mb-4">
            {flash}
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="animate-spin h-7 w-7 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
            Loading queue…
          </div>
        )}
        {error && <div className="text-red-600 text-sm py-4">{error}</div>}
        {!loading && queue.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-gray-700 font-semibold">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No submissions pending verification.</p>
          </div>
        )}

        {/* Queue cards */}
        <div className="space-y-3">
          {queue.map((log) => (
            <button
              key={log.id}
              onClick={() => navigate(`/verifier/review/${log.id}`, { state: { log } })}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-md transition group"
            >
              <div className="flex gap-4 items-center">
                {/* Photo thumb */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                  {log.after_photo_url ?? log.before_photo_url ? (
                    <img
                      src={(log.after_photo_url ?? log.before_photo_url)!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
                      📷
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {log.worker_name ?? 'Worker'}
                    </p>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {CHECKPOINT_LABEL[log.checkpoint_type ?? ''] ?? log.scan_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${COLOR_DOT[log.color_code ?? ''] ?? 'bg-gray-400'}`} />
                    <p className="text-xs text-gray-500 truncate">{log.stretch_name}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{formatIST(log.scanned_at)}</span>
                    {log.duration && (
                      <span className="text-xs text-gray-300">· {log.duration}</span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-gray-300 group-hover:text-teal-500 transition text-xl leading-none">
                  →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </VerifierLayout>
  );
}
