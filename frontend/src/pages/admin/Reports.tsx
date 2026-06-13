import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { reportsApi } from '../../api';
import { todayISO } from '../../utils/formatIST';

interface ReportCard {
  title: string;
  description: string;
  icon: string;
  fetch: (from?: string, to?: string) => Promise<{ data: unknown }>;
  filename: string;
}

const REPORTS: ReportCard[] = [
  {
    title: 'Task Logs',
    description: 'All scan events — check-in, progress, completion — with worker, stretch, GPS, photos, and verification status.',
    icon: '📋',
    fetch: (f, t) => reportsApi.taskLogs(f, t),
    filename: 'task-logs',
  },
  {
    title: 'Attendance',
    description: 'Daily worker attendance records with check-in time, GPS location, and late flag.',
    icon: '🕐',
    fetch: (f, t) => reportsApi.attendance(f, t),
    filename: 'attendance',
  },
  {
    title: 'Verifications',
    description: 'Approved and rejected submissions with verifier name, remark, and decision timestamp.',
    icon: '✅',
    fetch: (f, t) => reportsApi.verifications(f, t),
    filename: 'verifications',
  },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ReportSection({ card }: { card: ReportCard }) {
  const today = todayISO();
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState(today);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [success, setSuccess] = useState(false);

  async function handleDownload() {
    setLoading(true); setErr(''); setSuccess(false);
    try {
      const { data } = await card.fetch(from || undefined, to || undefined);
      const dateTag = from ? `_${from}_to_${to}` : `_to_${to}`;
      downloadBlob(new Blob([data as BlobPart], { type: 'text/csv;charset=utf-8;' }), `${card.filename}${dateTag}.csv`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setErr('Export failed. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="text-3xl w-12 text-center flex-shrink-0">{card.icon}</div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900 mb-0.5">{card.title}</h2>
          <p className="text-xs text-gray-400 mb-4">{card.description}</p>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={to}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  Exporting…
                </>
              ) : '⬇ Export CSV'}
            </button>
          </div>

          {success && (
            <p className="text-green-600 text-xs mt-2 font-medium">CSV downloaded successfully.</p>
          )}
          {err && <p className="text-red-600 text-xs mt-2">{err}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-xs text-gray-400">Export data as CSV · leave "From" blank for all-time data up to the selected "To" date</p>
        </div>
        <div className="space-y-4">
          {REPORTS.map((r) => <ReportSection key={r.title} card={r} />)}
        </div>
      </div>
    </AdminLayout>
  );
}
