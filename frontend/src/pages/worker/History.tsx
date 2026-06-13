import { useState, useEffect } from 'react';
import WorkerLayout from '../../components/WorkerLayout';
import { taskLogsApi, attendanceApi } from '../../api';
import { formatIST } from '../../utils/formatIST';
import type { TaskLog, AttendanceRecord } from '../../types';

type ActiveTab = 'tasks' | 'attendance';

const VSTATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  'n/a':    'bg-gray-100 text-gray-500',
};

const SCAN_ICON: Record<string, string> = {
  'check-in':   '🟢',
  'progress':   '🟡',
  'completion': '🔵',
};

export default function WorkerHistoryPage() {
  const [tab, setTab] = useState<ActiveTab>('tasks');
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([taskLogsApi.my(), attendanceApi.my()])
      .then(([t, a]) => { setTasks(t.data); setAttendance(a.data); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkerLayout>
      <div className="max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-bold text-gray-800 mb-4">My History</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(['tasks', 'attendance'] as ActiveTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {t === 'tasks' ? `Tasks (${tasks.length})` : `Attendance (${attendance.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : tab === 'tasks' ? (
          <TaskList tasks={tasks} />
        ) : (
          <AttendanceList records={attendance} />
        )}
      </div>
    </WorkerLayout>
  );
}

function TaskList({ tasks }: { tasks: TaskLog[] }) {
  if (!tasks.length) return <Empty text="No tasks logged yet. Scan a checkpoint QR to begin." />;

  return (
    <div className="space-y-3 pb-4">
      {tasks.map((t) => (
        <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{SCAN_ICON[t.scan_type] ?? '⚪'}</span>
              <span className="text-sm font-semibold text-gray-800 capitalize">
                {t.scan_type}
              </span>
              {t.stretch_name && (
                <span className="text-xs text-gray-500">· {t.stretch_name}</span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
              VSTATUS_STYLE[t.verification_status] ?? 'bg-gray-100 text-gray-500'
            }`}>
              {t.verification_status}
            </span>
          </div>

          <p className="text-xs text-gray-400 mb-2">{formatIST(t.scanned_at)}</p>

          {(t.before_photo_url || t.after_photo_url) && (
            <div className="flex gap-2">
              {t.before_photo_url && (
                <PhotoThumb url={t.before_photo_url} label="Before" />
              )}
              {t.after_photo_url && (
                <PhotoThumb url={t.after_photo_url} label="After" />
              )}
            </div>
          )}

          {t.remark && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded">
              Remark: {t.remark}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PhotoThumb({ url, label }: { url: string; label: string }) {
  const isDataUrl = url.startsWith('data:');
  return (
    <div className="relative flex-1 max-w-[120px]">
      {isDataUrl || url.startsWith('http') ? (
        <img
          src={url}
          alt={label}
          className="w-full h-20 object-cover rounded-lg border border-gray-200"
        />
      ) : (
        <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">
          {label}
        </div>
      )}
      <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
        {label}
      </span>
    </div>
  );
}

function AttendanceList({ records }: { records: AttendanceRecord[] }) {
  if (!records.length) return <Empty text="No attendance records yet. Scan your worker badge QR each morning." />;

  return (
    <div className="space-y-3 pb-4">
      {records.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">{a.date}</p>
            <p className="text-xs text-gray-400">{formatIST(a.check_in_time)}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            a.is_late ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
          }`}>
            {a.is_late ? 'Late' : 'On Time'}
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center text-gray-400 py-16 text-sm">
      <p className="text-3xl mb-3">📭</p>
      {text}
    </div>
  );
}
