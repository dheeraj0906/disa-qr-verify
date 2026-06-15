export function formatIST(utcString: string): string {
  return new Date(utcString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function formatDateIST(utcString: string): string {
  return new Date(utcString).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatDuration(interval: string | null): string {
  if (!interval) return '—';
  const match = interval.match(/(\d+):(\d+):(\d+)/);
  if (!match) return interval;
  const [, h, m] = match;
  if (Number(h) > 0) return `${Number(h)}h ${Number(m)}m`;
  return `${Number(m)}m`;
}

export function nowISTLabel(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}
