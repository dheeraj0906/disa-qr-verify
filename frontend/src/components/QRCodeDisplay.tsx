import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;       // the QR payload (e.g. /scan/checkpoint/{id})
  size?: number;       // canvas px size (default 180)
  label?: string;      // filename stem for downloads
  appBaseUrl?: string; // prefix for full URL QRs (default: window.location.origin)
}

export default function QRCodeDisplay({ value, size = 180, label = 'qr', appBaseUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Build the full URL that will be encoded (phones need absolute URLs)
  const base = appBaseUrl ?? window.location.origin;
  const fullUrl = value.startsWith('http') ? value : `${base}${value}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, fullUrl, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).catch((e: Error) => setError(e.message));
  }, [fullUrl, size]);

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${label}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (error) return <div className="text-red-500 text-xs">{error}</div>;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded border border-gray-200" />
      <button
        onClick={downloadPNG}
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        Download PNG
      </button>
    </div>
  );
}
