const IST = 'Asia/Kolkata';

export function toIST(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

export function isLate(checkInTime: Date | string, thresholdHHMM: string): boolean {
  const dt = new Date(checkInTime);
  const [hh, mm] = thresholdHHMM.split(':').map(Number);
  // Convert threshold to UTC for comparison: IST = UTC + 5:30
  const thresholdUTCMs = (hh * 60 + mm - 330) * 60 * 1000; // 330 min offset
  const midnightUTC = new Date(dt);
  midnightUTC.setUTCHours(0, 0, 0, 0);
  const todayThresholdUTC = midnightUTC.getTime() + thresholdUTCMs;
  return dt.getTime() > todayThresholdUTC;
}
