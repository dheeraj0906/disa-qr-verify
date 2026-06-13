import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import { checkpointsApi, workersApi, qrApi } from '../../api';
import type { Checkpoint, Worker } from '../../types';

type Tab = 'checkpoints' | 'workers';

const TYPE_ORDER: Record<string, number> = { start: 0, mid: 1, end: 2 };
const TYPE_COLOR: Record<string, string> = {
  start: 'bg-green-100 text-green-800',
  mid:   'bg-yellow-100 text-yellow-800',
  end:   'bg-red-100 text-red-800',
};

// ── Tiny inline QR preview ────────────────────────────────────────────────────
function MiniQR({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const full = value.startsWith('http') ? value : `${window.location.origin}${value}`;
    QRCode.toCanvas(ref.current, full, { width: 80, margin: 1 }).catch(() => undefined);
  }, [value]);
  return <canvas ref={ref} className="mx-auto block" />;
}

// ── Checkpoint cards ──────────────────────────────────────────────────────────
function CheckpointGrid({
  checkpoints,
  onView,
}: {
  checkpoints: Checkpoint[];
  onView: (cp: Checkpoint) => void;
}) {
  if (checkpoints.length === 0)
    return <Empty text="No checkpoints found. Run 'Bulk Generate' first." />;

  const byStretch = checkpoints.reduce<Record<string, Checkpoint[]>>((acc, cp) => {
    if (!acc[cp.stretch_name]) acc[cp.stretch_name] = [];
    acc[cp.stretch_name].push(cp);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byStretch).map(([stretch, cps]) => (
        <div key={stretch}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {stretch}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cps.map((cp) => (
              <div key={cp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${
                      TYPE_COLOR[cp.type] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {cp.type}
                  </span>
                  {cp.qr_code ? (
                    <span className="text-xs text-green-600 font-medium">✓ Ready</span>
                  ) : (
                    <span className="text-xs text-amber-500 font-medium">⚠ Missing</span>
                  )}
                </div>

                {cp.qr_code ? (
                  <>
                    <MiniQR value={cp.qr_code} />
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-400 break-all leading-relaxed">
                        {cp.qr_code}
                      </p>
                      <button
                        onClick={() => onView(cp)}
                        className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                      >
                        View / Download PNG
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-24 flex items-center justify-center text-gray-300 text-sm">
                    No QR generated
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Worker cards ──────────────────────────────────────────────────────────────
function WorkerGrid({
  workers,
  onView,
}: {
  workers: Worker[];
  onView: (w: Worker) => void;
}) {
  if (workers.length === 0)
    return <Empty text="No workers found. Add workers in the Workers section first." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {workers.map((w) => (
        <div key={w.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{w.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{w.stretch_name ?? 'Unassigned'}</p>
              {w.phone && (
                <p className="text-xs text-gray-400">{w.phone}</p>
              )}
            </div>
            {w.qr_badge_code ? (
              <span className="text-xs text-green-600 font-medium">✓</span>
            ) : (
              <span className="text-xs text-amber-500 font-medium">⚠</span>
            )}
          </div>

          {w.qr_badge_code ? (
            <>
              <MiniQR value={w.qr_badge_code} />
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400 break-all leading-relaxed">
                  {w.qr_badge_code}
                </p>
                <button
                  onClick={() => onView(w)}
                  className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                >
                  View / Download PNG
                </button>
              </div>
            </>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-300 text-sm">
              No badge generated
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-gray-400 py-20 text-sm">{text}</div>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQRPage() {
  const [tab, setTab] = useState<Tab>('checkpoints');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{ title: string; qrValue: string; label: string } | null>(
    null
  );

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cpRes, wRes] = await Promise.all([checkpointsApi.list(), workersApi.list()]);
      const sorted = [...cpRes.data].sort((a, b) => {
        const s = a.stretch_name.localeCompare(b.stretch_name);
        return s !== 0 ? s : (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0);
      });
      setCheckpoints(sorted);
      setWorkers(wRes.data);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBulkGenerate() {
    setGenerating(true);
    try {
      const { data } = await qrApi.bulkGenerate();
      showToast(
        `Done — ${data.checkpoints} checkpoint + ${data.workers} worker codes generated`
      );
      await load();
    } catch {
      showToast('Bulk generate failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const { data } = await qrApi.downloadPdf();
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'disa-qr-sheet.pdf';
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF downloaded successfully');
    } catch {
      showToast('PDF download failed', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  }

  const cpMissing = checkpoints.filter((c) => !c.qr_code).length;
  const wMissing  = workers.filter((w) => !w.qr_badge_code).length;
  const anyMissing = cpMissing + wMissing > 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QR Code Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              {checkpoints.filter((c) => c.qr_code).length} checkpoint codes ·{' '}
              {workers.filter((w) => w.qr_badge_code).length} worker badge codes
              {anyMissing && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {cpMissing + wMissing} missing
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={handleBulkGenerate}
              disabled={generating || !anyMissing}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-medium rounded-lg transition"
            >
              {generating ? 'Generating…' : 'Bulk Generate Missing'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              {downloadingPdf ? 'Preparing…' : '⬇ PDF Sheet'}
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {(['checkpoints', 'workers'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t} ({t === 'checkpoints' ? checkpoints.length : workers.length})
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading…</div>
        ) : tab === 'checkpoints' ? (
          <CheckpointGrid
            checkpoints={checkpoints}
            onView={(cp) =>
              setModal({
                title: `${cp.stretch_name} — ${cp.type.toUpperCase()} Checkpoint`,
                qrValue: cp.qr_code!,
                label: `cp-${cp.stretch_name.replace(/\s/g, '-')}-${cp.type}`,
              })
            }
          />
        ) : (
          <WorkerGrid
            workers={workers}
            onView={(w) =>
              setModal({
                title: `Worker Badge: ${w.name}`,
                qrValue: w.qr_badge_code!,
                label: `worker-${w.name.replace(/\s/g, '-')}`,
              })
            }
          />
        )}
      </div>

      {/* QR View Modal */}
      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <div className="flex flex-col items-center gap-3 py-2">
            <QRCodeDisplay value={modal.qrValue} size={220} label={modal.label} />
            <p className="text-xs text-gray-400 text-center break-all max-w-xs">
              {modal.qrValue}
            </p>
            <p className="text-xs text-gray-300 text-center">
              Scans to: {window.location.origin}{modal.qrValue}
            </p>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
