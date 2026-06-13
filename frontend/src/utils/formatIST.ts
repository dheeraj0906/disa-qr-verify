export function formatIST(utcString: string): string {
  return new Date(utcString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function formatDateIST(utcString: string): string {
  return new Date(utcString).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}
