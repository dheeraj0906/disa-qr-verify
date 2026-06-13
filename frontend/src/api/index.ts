import api from './client';
import type { Stretch, Vehicle, Checkpoint, Worker, TaskLog, AttendanceRecord, DashboardData } from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: import('../types').AuthUser }>('/auth/login', { email, password }),
};

// ── Stretches ─────────────────────────────────────────────────────────────────
export const stretchesApi = {
  list: () => api.get<Stretch[]>('/stretches'),
  create: (data: Partial<Stretch>) => api.post<Stretch>('/stretches', data),
  update: (id: string, data: Partial<Stretch>) => api.put<Stretch>(`/stretches/${id}`, data),
  remove: (id: string) => api.delete(`/stretches/${id}`),
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: () => api.get<Vehicle[]>('/vehicles'),
  create: (data: Partial<Vehicle>) => api.post<Vehicle>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) => api.put<Vehicle>(`/vehicles/${id}`, data),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
};

// ── Checkpoints ───────────────────────────────────────────────────────────────
export const checkpointsApi = {
  list: () => api.get<Checkpoint[]>('/checkpoints'),
  create: (data: Partial<Checkpoint>) => api.post<Checkpoint>('/checkpoints', data),
  update: (id: string, data: Partial<Checkpoint>) => api.put<Checkpoint>(`/checkpoints/${id}`, data),
  remove: (id: string) => api.delete(`/checkpoints/${id}`),
  qrUrl: (id: string) => `${api.defaults.baseURL}/checkpoints/${id}/qr`,
};

// ── Workers ───────────────────────────────────────────────────────────────────
export const workersApi = {
  list: () => api.get<Worker[]>('/workers'),
  create: (data: Partial<Worker>) => api.post<Worker>('/workers', data),
  update: (id: string, data: Partial<Worker>) => api.put<Worker>(`/workers/${id}`, data),
  remove: (id: string) => api.delete(`/workers/${id}`),
  qrUrl: (id: string) => `${api.defaults.baseURL}/workers/${id}/qr`,
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<import('../types').AuthUser[]>('/users'),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

// ── QR ────────────────────────────────────────────────────────────────────────
export const qrApi = {
  bulkGenerate: () => api.post<{ checkpoints: number; workers: number; message: string }>('/qr/bulk-generate'),
  pdfUrl: () => `${api.defaults.baseURL}/qr/pdf`,
  downloadPdf: () => api.get('/qr/pdf', { responseType: 'blob' }),
};

// ── Scan ──────────────────────────────────────────────────────────────────────
export const scanApi = {
  checkpoint: (id: string) => api.post(`/scan/checkpoint/${id}`),
  vehicle: (id: string) => api.post(`/scan/vehicle/${id}`),
  worker: (id: string, lat?: number, lng?: number) =>
    api.post(`/scan/worker/${id}`, { lat, lng }),
};

// ── Task Logs ─────────────────────────────────────────────────────────────────
export const taskLogsApi = {
  submit: (data: Record<string, unknown>) => api.post<TaskLog>('/task-logs', data),
  list: () => api.get<TaskLog[]>('/task-logs'),
  pending: () => api.get<TaskLog[]>('/task-logs/pending'),
  my: () => api.get<TaskLog[]>('/task-logs/my'),
  verify: (id: string, action: 'approved' | 'rejected', remark?: string) =>
    api.post(`/task-logs/${id}/verify`, { action, remark }),
  verifiedBy: (from?: string, to?: string) =>
    api.get<TaskLog[]>('/task-logs/verified', { params: { from, to } }),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  list: (date?: string) => api.get<{ date: string; records: AttendanceRecord[]; summary: unknown[] }>('/attendance', { params: { date } }),
  my: () => api.get<AttendanceRecord[]>('/attendance/my'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  live: (date?: string) => api.get<DashboardData>('/dashboard/live', { params: { date } }),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  taskLogs: (from?: string, to?: string) =>
    api.get('/reports/task-logs', { params: { from, to }, responseType: 'blob' }),
  attendance: (from?: string, to?: string) =>
    api.get('/reports/attendance', { params: { from, to }, responseType: 'blob' }),
  verifications: (from?: string, to?: string) =>
    api.get('/reports/verifications', { params: { from, to }, responseType: 'blob' }),
};
