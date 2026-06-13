import { useState, useEffect, useCallback } from 'react';
import VerifierLayout from '../../components/VerifierLayout';
import { taskLogsApi } from '../../api';
import { formatIST, todayISO } from '../../utils/formatIST';
import type { TaskLog } from '../../types';

const STATUS_PILL: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
};

const CHECKPOINT_LABEL: Record<string, string> = {
  start: 'Check-In',
  mid:   'Progress',
  end:   'Completion',
};

const COLOR_DOT: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
};

export default function VerifierHistoryPage() {
  const today = todayISO();
  const [rows, setRows]     = useState<TaskLog[]>([]);
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const fetch = useCallback(() => {
    setLoading(true);
    setError('');
    taskLogsApi.verifiedBy(from || undefined, to || undefined)
      .then(({ data }) => setRows(data))
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <VerifierLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Verification History</h1>
            <p className="text-xs text-gray-400">Your approved and rejected submissions</p>
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={to}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={fetch}
              className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              Apply
            </button>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <div className="animate-spin h-6 w-6 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
            Loading history…
          </div>
        )}
        {error && <div className="text-red-600 text-sm py-4">{error}</div>}
        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>No verifications found for this date range.</p>
          </div>
        )}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    Worker
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    Stretch
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    Decision
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                    Remark
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Verified At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs">{row.worker_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${COLOR_DOT[row.color_code ?? ''] ?? 'bg-gray-300'}`} />
                        <span className="text-xs text-gray-700">{row.stretch_name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">
                        {CHECKPOINT_LABEL[row.checkpoint_type ?? ''] ?? row.scan_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_PILL[row.verification_status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {row.verification_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                      <span className="text-xs text-gray-500 line-clamp-2">
                        {row.remark ?? <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                      <span className="text-xs text-gray-400">
                        {row.verified_at ? formatIST(row.verified_at) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
              Showing {rows.length} record{rows.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </VerifierLayout>
  );
}
