import api from './api';
import type {
  AuthUser, Stretch, Vehicle, Checkpoint, Worker,
  TaskLog, AttendanceRecord, DashboardData,
  ScanCheckpointResult, ScanWorkerResult,
} from '@/types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password }),
  me: () => api.get<AuthUser>('/auth/me'),
};

export const stretchesApi = {
  list: () => api.get<Stretch[]>('/stretches'),
};

export const vehiclesApi = {
  list: () => api.get<Vehicle[]>('/vehicles'),
};

export const checkpointsApi = {
  list: () => api.get<Checkpoint[]>('/checkpoints'),
};

export const workersApi = {
  list: () => api.get<Worker[]>('/workers'),
  me:   () => api.get<Worker>('/workers/me'),
};

export const scanApi = {
  checkpoint: (id: string) =>
    api.post<ScanCheckpointResult>(`/scan/checkpoint/${id}`),
  worker: (id: string, lat?: number, lng?: number) =>
    api.post<ScanWorkerResult>(`/scan/worker/${id}`, { lat, lng }),
  vehicle: (id: string) =>
    api.post(`/scan/vehicle/${id}`),
};

export const taskLogsApi = {
  submit: (data: Record<string, unknown>) => api.post<TaskLog>('/task-logs', data),
  list: () => api.get<TaskLog[]>('/task-logs'),
  pending: () => api.get<TaskLog[]>('/task-logs/pending'),
  my: () => api.get<TaskLog[]>('/task-logs/my'),
  verifiedBy: (from?: string, to?: string) =>
    api.get<TaskLog[]>('/task-logs/verified', { params: { from, to } }),
  verify: (id: string, action: 'approved' | 'rejected', remark?: string) =>
    api.post(`/task-logs/${id}/verify`, { action, remark }),
};

export const attendanceApi = {
  my: () => api.get<AttendanceRecord[]>('/attendance/my'),
  list: (date?: string) =>
    api.get<{ date: string; records: AttendanceRecord[]; summary: unknown }>('/attendance', { params: { date } }),
};

export const dashboardApi = {
  live: (date?: string) =>
    api.get<DashboardData>('/dashboard/live', { params: { date } }),
};

export const uploadApi = {
  photo: async (uri: string): Promise<string> => {
    const formData = new FormData();
    formData.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);
    const res = await api.post<{ url: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url ?? uri;
  },
};

export const notificationsApi = {
  saveToken: (token: string) => api.post('/users/push-token', { token }),
};
