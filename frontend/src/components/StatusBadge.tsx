import type { StretchStatus } from '../types';

const STYLES: Record<StretchStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  completed:   'bg-amber-100 text-amber-700 border-amber-300',
  verified:    'bg-green-100 text-green-700 border-green-300',
};

const LABELS: Record<StretchStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
  verified:    'Verified',
};

export default function StatusBadge({ status }: { status: StretchStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STYLES[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
