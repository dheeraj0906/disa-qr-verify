import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import WorkerLayout from '../../components/WorkerLayout';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

function parseQrPayload(raw: string): { type: 'checkpoint' | 'worker' | 'vehicle'; id: string } | null {
  // Accepts both full URLs (https://app.com/scan/checkpoint/uuid) and bare paths (/scan/checkpoint/uuid)
  const match = raw.match(/\/scan\/(checkpoint|worker|vehicle)\/([0-9a-f-]{36})/i);
  if (!match) return null;
  return { type: match[1] as 'checkpoint' | 'worker' | 'vehicle', id: match[2] };
}

export default function WorkerScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState('');

  const SCANNER_ID = 'disa-qr-scanner';

  async function startScanning() {
    setState('scanning');
    setError('');

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) throw new Error('No camera found on this device');

      // Prefer rear camera
      const cam = cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[cameras.length - 1];

      const qr = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = qr;

      await qr.start(
        cam.id,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decoded) => {
          void handleDecoded(decoded, qr);
        },
        undefined
      );
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Camera error');
    }
  }

  async function handleDecoded(raw: string, qr: Html5Qrcode) {
    if (scannerRef.current !== qr) return; // already stopped
    await qr.stop().catch(() => undefined);
    scannerRef.current = null;
    setLastResult(raw);

    const parsed = parseQrPayload(raw);
    if (!parsed) {
      setState('error');
      setError(`Unrecognised QR: "${raw}"`);
      return;
    }

    setState('success');
    // Brief success flash then navigate to the right handler
    setTimeout(() => {
      if (parsed.type === 'checkpoint') navigate(`/scan/checkpoint/${parsed.id}`);
      else if (parsed.type === 'worker')  navigate(`/scan/worker/${parsed.id}`);
      else if (parsed.type === 'vehicle') navigate(`/scan/vehicle/${parsed.id}`);
    }, 600);
  }

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  return (
    <WorkerLayout>
      <div className="flex flex-col items-center px-4 pt-6 pb-4 max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-1">Scan QR Code</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Point your camera at a checkpoint QR, vehicle tag, or your worker badge
        </p>

        {/* Scanner viewport */}
        <div className="w-full rounded-2xl overflow-hidden border-4 border-blue-500 shadow-lg mb-5">
          <div id={SCANNER_ID} className="w-full" style={{ minHeight: 280 }} />
        </div>

        {/* Status messages */}
        {state === 'idle' && (
          <button
            onClick={startScanning}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-lg font-semibold rounded-2xl shadow transition"
          >
            Start Camera
          </button>
        )}

        {state === 'scanning' && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-blue-600 font-medium text-sm">
              <span className="animate-pulse h-2 w-2 rounded-full bg-blue-500" />
              Scanning…
            </div>
            <button
              onClick={async () => {
                await scannerRef.current?.stop().catch(() => undefined);
                scannerRef.current = null;
                setState('idle');
              }}
              className="mt-3 block w-full text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Cancel
            </button>
          </div>
        )}

        {state === 'success' && (
          <div className="w-full py-4 bg-green-50 border border-green-200 rounded-2xl text-center">
            <p className="text-green-700 font-semibold text-lg">✓ QR Scanned!</p>
            <p className="text-xs text-green-500 mt-1 break-all px-4">{lastResult}</p>
            <p className="text-xs text-gray-400 mt-1">Redirecting…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="w-full py-4 bg-red-50 border border-red-200 rounded-2xl text-center">
            <p className="text-red-700 font-semibold">Scan failed</p>
            <p className="text-xs text-red-500 mt-1 px-4">{error}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-3 text-sm text-blue-600 underline"
            >
              Try again
            </button>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          Step 1 of 3 — Scan → Context → Upload
        </p>
      </div>
    </WorkerLayout>
  );
}
