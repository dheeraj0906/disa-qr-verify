import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import VerifierLayout from '../../components/VerifierLayout';
import { taskLogsApi } from '../../api';
import { formatIST } from '../../utils/formatIST';
import type { TaskLog } from '../../types';

const CHECKPOINT_LABEL: Record<string, string> = {
  start: 'Check-In',
  mid:   'Progress',
  end:   'Completion',
};

export default function VerifierReviewPage() {
  const { id }    = useParams<{ id: string }>();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [log, setLog]         = useState<TaskLog | null>(
    (location.state as { log?: TaskLog } | null)?.log ?? null
  );
  const [loading, setLoading] = useState(!log);
  const [remark, setRemark]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');

  // Fallback: load from pending queue if not passed via navigation state
  useEffect(() => {
    if (log || !id) return;
    taskLogsApi.pending()
      .then(({ data }) => {
        const found = data.find((t) => t.id === id);
        if (found) setLog(found);
        else setError('Submission not found or already verified.');
      })
      .catch(() => setError('Failed to load submission.'))
      .finally(() => setLoading(false));
  }, [id, log]);

  async function handleVerify(action: 'approved' | 'rejected') {
    if (action === 'rejected' && !remark.trim()) {
      setError('A remark is required when rejecting a submission.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await taskLogsApi.verify(id!, action, remark.trim() || undefined);
      navigate('/verifier/queue', {
        replace: true,
        state: {
          flash: `${action === 'approved' ? 'Approved' : 'Rejected'}: ${log?.worker_name ?? 'submission'} — ${log?.stretch_name}`,
        },
      });
    } catch {
      setError('Failed to submit. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <VerifierLayout>
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          <div className="animate-spin h-6 w-6 border-4 border-teal-500 border-t-transparent rounded-full mr-3" />
          Loading submission…
        </div>
      </VerifierLayout>
    );
  }

  if (!log) {
    return (
      <VerifierLayout>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 mb-4">{error || 'Submission not found.'}</p>
          <button
            onClick={() => navigate('/verifier/queue')}
            className="text-teal-600 underline text-sm"
          >
            Back to Queue
          </button>
        </div>
      </VerifierLayout>
    );
  }

  return (
    <VerifierLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-sm">
          <button
            onClick={() => navigate('/verifier/queue')}
            className="text-teal-600 hover:text-teal-800 transition"
          >
            ← Queue
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 font-medium">Review Submission</span>
        </div>

        {/* Meta card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <MetaField label="Worker"    value={log.worker_name ?? '—'} />
            <MetaField label="Stretch"   value={log.stretch_name ?? '—'} />
            <MetaField
              label="Checkpoint"
              value={CHECKPOINT_LABEL[log.checkpoint_type ?? ''] ?? log.scan_type}
            />
            <MetaField label="Scanned At" value={formatIST(log.scanned_at)} />
          </div>
          {log.duration && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <MetaField label="Task Duration" value={log.duration} />
            </div>
          )}
        </div>

        {/* Side-by-side photos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <PhotoPanel label="Before" url={log.before_photo_url} />
          <PhotoPanel label="After"  url={log.after_photo_url}  />
        </div>

        {/* Action panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Remark
            <span className="text-gray-400 font-normal ml-1">(required for rejection)</span>
          </label>
          <textarea
            rows={3}
            value={remark}
            onChange={(e) => { setRemark(e.target.value); if (error) setError(''); }}
            placeholder="e.g. Photos unclear — please re-upload with correct location…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
          {error && <p className="text-red-600 text-xs mt-1.5">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleVerify('approved')}
              disabled={submitting}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting…' : '✓  Approve'}
            </button>
            <button
              onClick={() => handleVerify('rejected')}
              disabled={submitting}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition"
            >
              {submitting ? '…' : '✕  Reject'}
            </button>
          </div>
        </div>
      </div>
    </VerifierLayout>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-semibold text-gray-900 text-sm">{value}</p>
    </div>
  );
}

function PhotoPanel({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label} Photo</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-600 hover:underline"
          >
            Full size ↗
          </a>
        )}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={`${label} photo`}
            className="w-full object-contain max-h-80 bg-gray-50"
          />
        </a>
      ) : (
        <div className="h-52 flex flex-col items-center justify-center text-gray-300 gap-2">
          <span className="text-3xl">📷</span>
          <span className="text-xs">No photo uploaded</span>
        </div>
      )}
    </div>
  );
}
