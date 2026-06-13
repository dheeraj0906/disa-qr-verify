import { useState, useEffect, useCallback, useRef } from 'react';
import CommissionerLayout from '../../components/CommissionerLayout';
import LiveMap from '../../components/LiveMap';
import StatusBadge from '../../components/StatusBadge';
import { dashboardApi } from '../../api';
import { formatIST, todayISO } from '../../utils/formatIST';
import type { DashboardData, StretchStatus, TaskLog } from '../../types';

const STRETCH_DOT: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
};

const SCAN_LABEL: Record<string, string> = {
  'check-in':   'Check-In',
  'progress':   'Progress',
  'completion': 'Completion',
};

const VSTATUS_PILL: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  'n/a':    'bg-gray-100 text-gray-500',
};

const REFRESH_INTERVAL = 30_000; // 30 s

export default function CommissionerDashboardPage() {
  const [data, setData]         = useState<DashboardData | null>(null);
  const [date, setDate]         = useState<string>(todayISO());
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL / 1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (d: string) => {
    setError('');
    try {
      const { data: res } = await dashboardApi.live(d);
      setData(res);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch {
      setError('Failed to load dashboard data. Retrying…');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 s
  useEffect(() => {
    fetchData(date);
    timerRef.current = setInterval(() => fetchData(date), REFRESH_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [date, fetchData]);

  // Visual countdown
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  if (loading) {
    return (
      <CommissionerLayout>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            Loading dashboard…
          </div>
        </div>
      </CommissionerLayout>
    );
  }

  return (
    <CommissionerLayout>
      <div className="flex h-full overflow-hidden">
        {/* ── Left: Map + header ──────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-gray-200">
          {/* Sub-header */}
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {data?.municipality ?? 'Khammam'} — Real-Time Monitoring
              </h1>
              <p className="text-xs text-gray-400">
                {lastRefresh ? `Updated ${formatIST(lastRefresh.toISOString())}` : 'Loading…'}
                {' · '}Refresh in {countdown}s
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => { setDate(e.target.value); setLoading(true); }}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchData(date)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border-b border-red-200 px-5 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            {data && <LiveMap stretches={data.stretches} className="absolute inset-0" />}
            {/* No-GPS notice */}
            {data && data.stretches.every((s) => !s.start_point && !s.end_point) && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-gray-300 rounded-xl px-4 py-2 text-xs text-gray-600 shadow">
                GPS coordinates not set for stretches. Add them in Admin → Stretches to draw routes.
              </div>
            )}
          </div>

          {/* Stretch color legend */}
          {data && (
            <div className="bg-white border-t border-gray-200 px-5 py-2 flex items-center gap-5 flex-shrink-0 flex-wrap">
              {data.stretches.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${STRETCH_DOT[s.color_code] ?? 'bg-gray-400'}`} />
                  <span className="text-xs text-gray-600">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Widgets + feed ────────────────────────────────────────── */}
        <div className="w-80 xl:w-96 flex flex-col bg-white overflow-y-auto flex-shrink-0">
          {data ? (
            <>
              {/* Stretch status cards */}
              <Section title="Stretch Status">
                <div className="space-y-2">
                  {data.stretches.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full flex-shrink-0 ${STRETCH_DOT[s.color_code] ?? 'bg-gray-400'}`} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800 leading-tight">{s.name}</p>
                          {s.road_name && (
                            <p className="text-xs text-gray-400 leading-tight">{s.road_name}</p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={s.status as StretchStatus} />
                    </div>
                  ))}
                </div>
              </Section>

              {/* Attendance widget */}
              <Section title="5:00 AM — On-Field Staff Attendance">
                <AttendanceWidget data={data} />
              </Section>

              {/* Verification widget */}
              <Section title="Verification Team">
                <VerificationWidget data={data} />
              </Section>

              {/* Activity feed */}
              <Section title={`Recent Activity (${data.feed.length})`}>
                <ActivityFeed feed={data.feed} />
              </Section>
            </>
          ) : (
            <div className="p-5 text-sm text-gray-400">No data available</div>
          )}
        </div>
      </div>
    </CommissionerLayout>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 px-4 py-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  );
}

// ── Attendance widget ──────────────────────────────────────────────────────────
function AttendanceWidget({ data }: { data: DashboardData }) {
  const { present, total } = data.attendance as { present: string | number; total: string | number };
  const p = Number(present);
  const t = Number(total);
  const pct = t > 0 ? Math.round((p / t) * 100) : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-2xl font-bold text-gray-900">{p}</p>
          <p className="text-xs text-gray-400">of {t} workers present</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {pct}%
          </p>
          <p className="text-xs text-gray-400">attendance</p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{t - p} absent / unscanned</p>
    </div>
  );
}

// ── Verification widget ────────────────────────────────────────────────────────
function VerificationWidget({ data }: { data: DashboardData }) {
  const { pending, approved, rejected } = data.verification as {
    pending: string | number;
    approved: string | number;
    rejected: string | number;
  };

  const stats = [
    { label: 'Pending',  value: Number(pending),  color: 'bg-amber-500' },
    { label: 'Approved', value: Number(approved), color: 'bg-green-500' },
    { label: 'Rejected', value: Number(rejected), color: 'bg-red-500' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="text-center bg-gray-50 rounded-lg py-2.5 px-1">
          <div className={`h-1.5 w-8 rounded-full mx-auto mb-1.5 ${color}`} />
          <p className="text-lg font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────────
function ActivityFeed({ feed }: { feed: TaskLog[] }) {
  if (!feed.length) {
    return <p className="text-xs text-gray-400 text-center py-4">No activity yet today.</p>;
  }

  return (
    <div className="space-y-2">
      {feed.map((item) => (
        <div key={item.id} className="flex gap-2.5 py-1">
          {/* Photo thumb */}
          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            {item.after_photo_url ?? item.before_photo_url ? (
              <img
                src={(item.after_photo_url ?? item.before_photo_url)!}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">
                {item.scan_type === 'check-in' ? '🟢' : item.scan_type === 'progress' ? '🟡' : '🔵'}
              </div>
            )}
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="text-xs font-semibold text-gray-800 truncate">
                {item.worker_name ?? 'Worker'} — {SCAN_LABEL[item.scan_type] ?? item.scan_type}
              </p>
              {item.verification_status !== 'n/a' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${
                  VSTATUS_PILL[item.verification_status] ?? 'bg-gray-100 text-gray-500'
                }`}>
                  {item.verification_status}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{item.stretch_name}</p>
            <p className="text-xs text-gray-300">{formatIST(item.scanned_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
