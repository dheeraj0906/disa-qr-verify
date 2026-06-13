/**
 * Step 2 + 3 of the mobile scan flow.
 * Shows context (stretch, checkpoint type, worker), collects before/after photos,
 * burns geo+timestamp overlay via canvas, uploads to Cloudinary, submits task_log.
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { burnGeoStamp } from '../../utils/geoStamp';
import { uploadToCloudinary, cloudinaryConfigured } from '../../utils/cloudinary';
import { taskLogsApi } from '../../api';
import WorkerLayout from '../../components/WorkerLayout';

type ScanType = 'check-in' | 'progress' | 'completion';

interface CheckpointContext {
  id: string;
  type: 'start' | 'mid' | 'end';
  stretch_id: string;
  stretch_name: string;
  color_code: string;
  stretch_status: string;
}

const SCAN_TYPE_MAP: Record<string, ScanType> = {
  start: 'check-in',
  mid:   'progress',
  end:   'completion',
};

const SCAN_LABEL: Record<ScanType, string> = {
  'check-in':   'Check-In (Start of Route)',
  'progress':   'Progress Update (Mid-Route)',
  'completion': 'Completion (End of Route)',
};

const SCAN_COLOR: Record<ScanType, string> = {
  'check-in':   'bg-blue-50 border-blue-300 text-blue-800',
  'progress':   'bg-yellow-50 border-yellow-300 text-yellow-800',
  'completion': 'bg-green-50 border-green-300 text-green-800',
};

const STRETCH_COLORS: Record<string, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
};

type SubmitState = 'idle' | 'gps' | 'stamping' | 'uploading' | 'saving' | 'success' | 'error';

export default function TaskFormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { acquire } = useGeolocation();

  const state = location.state as {
    checkpoint?: CheckpointContext;
    workerId?: string;
    fromVehicle?: boolean;
    stretchName?: string;
  } | null;

  const checkpoint = state?.checkpoint ?? null;

  // If arrived without state (e.g. direct URL), go back to scanner
  useEffect(() => {
    if (!state) navigate('/worker/scan', { replace: true });
  }, [state, navigate]);

  const scanType: ScanType = checkpoint ? SCAN_TYPE_MAP[checkpoint.type] ?? 'check-in' : 'check-in';
  const photosRequired = scanType === 'completion';

  const [beforeFile, setBeforeFile]   = useState<File | null>(null);
  const [afterFile, setAfterFile]     = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState('');
  const [afterPreview, setAfterPreview]   = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [progress, setProgress]       = useState('');

  const beforeInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const afterInputRef  = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  function onFileChange(which: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (which === 'before') { setBeforeFile(file); setBeforePreview(preview); }
    else                    { setAfterFile(file);  setAfterPreview(preview); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (photosRequired && (!beforeFile || !afterFile)) {
      setSubmitError('Both Before and After photos are required for completion.');
      return;
    }
    setSubmitError('');

    try {
      // Step A: acquire GPS
      setSubmitState('gps');
      setProgress('Acquiring GPS location…');
      const geo = await acquire().catch(() => ({ lat: 0, lng: 0 }));

      const now = new Date();
      let beforeUrl: string | null = null;
      let afterUrl:  string | null = null;

      // Step B: geo-stamp and upload before photo
      if (beforeFile) {
        setSubmitState('stamping');
        setProgress('Stamping before photo…');
        const stamped = await burnGeoStamp(beforeFile, geo.lat, geo.lng, now);

        setSubmitState('uploading');
        setProgress(`Uploading before photo${cloudinaryConfigured ? '' : ' (local mode)'}…`);
        beforeUrl = await uploadToCloudinary(stamped);
      }

      // Step C: geo-stamp and upload after photo
      if (afterFile) {
        setSubmitState('stamping');
        setProgress('Stamping after photo…');
        const stamped = await burnGeoStamp(afterFile, geo.lat, geo.lng, now);

        setSubmitState('uploading');
        setProgress(`Uploading after photo${cloudinaryConfigured ? '' : ' (local mode)'}…`);
        afterUrl = await uploadToCloudinary(stamped);
      }

      // Step D: submit task log
      setSubmitState('saving');
      setProgress('Saving to server…');
      await taskLogsApi.submit({
        checkpoint_id: checkpoint!.id,
        scan_type: scanType,
        lat: geo.lat || undefined,
        lng: geo.lng || undefined,
        before_photo_url: beforeUrl,
        after_photo_url:  afterUrl,
      });

      setSubmitState('success');
      setProgress('');
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setProgress('');
    }
  }

  if (!checkpoint && !state?.fromVehicle) return null;

  if (submitState === 'success') {
    return (
      <WorkerLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Submitted!</h1>
          <p className="text-gray-500 text-sm mb-2">
            {SCAN_LABEL[scanType]} logged for{' '}
            <strong>{checkpoint?.stretch_name ?? state?.stretchName}</strong>
          </p>
          {!cloudinaryConfigured && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Photos saved locally (Cloudinary not configured).
            </p>
          )}
          <p className="text-xs text-gray-400 mb-1">
            Automatically connected to server for time tracking.
          </p>
          {scanType === 'completion' && (
            <p className="text-xs text-blue-500 mb-6">
              Your submission is pending verification by the Verification Team.
            </p>
          )}
          <button
            onClick={() => navigate('/worker/scan')}
            className="w-full max-w-xs py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Scan Next QR
          </button>
        </div>
      </WorkerLayout>
    );
  }

  const isSubmitting = ['gps','stamping','uploading','saving'].includes(submitState);

  return (
    <WorkerLayout>
      <div className="max-w-md mx-auto px-4 pt-5 pb-8">
        {/* Context header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
              STRETCH_COLORS[checkpoint?.color_code ?? ''] ?? 'bg-gray-400'
            }`} />
            <div>
              <p className="font-bold text-gray-800 text-base leading-tight">
                {checkpoint?.stretch_name ?? state?.stretchName ?? 'Unknown Stretch'}
              </p>
              <p className="text-xs text-gray-400">{user?.name}</p>
            </div>
          </div>
          <div className={`px-3 py-2 rounded-lg border text-sm font-medium ${SCAN_COLOR[scanType]}`}>
            {SCAN_LABEL[scanType]}
          </div>
          {checkpoint && (
            <p className="text-xs text-gray-400 mt-2">
              Checkpoint: <strong>{checkpoint.type.toUpperCase()}</strong>
            </p>
          )}
        </div>

        {/* Photo upload form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <PhotoUploadField
            label="Before Photo"
            required={photosRequired}
            preview={beforePreview}
            inputRef={beforeInputRef}
            onChange={(e) => onFileChange('before', e)}
          />
          <PhotoUploadField
            label="After Photo"
            required={photosRequired}
            preview={afterPreview}
            inputRef={afterInputRef}
            onChange={(e) => onFileChange('after', e)}
          />

          {submitState === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {isSubmitting && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
              <p className="text-sm text-blue-700">{progress}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (photosRequired && (!beforeFile || !afterFile))}
            className="w-full py-4 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-base font-semibold rounded-2xl shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting…' : `Submit ${scanType === 'completion' ? '& Complete' : 'Update'}`}
          </button>

          <p className="text-xs text-gray-400 text-center">
            GPS + timestamp will be captured and embedded in photos automatically.
          </p>
        </form>
      </div>
    </WorkerLayout>
  );
}

// ── Photo upload field component ──────────────────────────────────────────────
function PhotoUploadField({
  label, required, preview, inputRef, onChange,
}: {
  label: string;
  required: boolean;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="w-full h-48 object-cover rounded-xl border border-gray-200"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition active:scale-95"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">Tap to capture {label.toLowerCase()}</span>
          <span className="text-xs">Camera or gallery</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}
