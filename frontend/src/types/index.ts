export type Role = 'super_admin' | 'commissioner' | 'verifier' | 'field_worker';
export type StretchStatus = 'not_started' | 'in_progress' | 'completed' | 'verified';
export type ScanType = 'check-in' | 'progress' | 'completion';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'n/a';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  zone: string | null;
}

export interface Stretch {
  id: string;
  name: string;
  color_code: string;
  road_name: string | null;
  status: StretchStatus;
  start_point: string | null;
  end_point: string | null;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  driver_name: string | null;
  stretch_id: string | null;
  stretch_name?: string;
  status: string;
}

export interface Checkpoint {
  id: string;
  stretch_id: string;
  stretch_name: string;
  type: 'start' | 'mid' | 'end';
  qr_code: string | null;
}

export interface Worker {
  id: string;
  name: string;
  phone: string | null;
  qr_badge_code: string | null;
  assigned_stretch_id: string | null;
  stretch_name?: string;
  role: string;
  status: string;
}

export interface TaskLog {
  id: string;
  scan_type: ScanType;
  scanned_at: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  verification_status: VerificationStatus;
  remark: string | null;
  verified_at: string | null;
  duration: string | null;
  worker_name?: string;
  stretch_name?: string;
  checkpoint_type?: string;
  color_code?: string;
}

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  check_in_time: string;
  is_late: boolean;
  worker_name?: string;
  stretch_name?: string;
}

export interface DashboardData {
  municipality: string;
  date: string;
  stretches: (Stretch & { last_vehicle_location: string | null })[];
  attendance: { present: number; total: number };
  verification: { pending: number; approved: number; rejected: number };
  feed: TaskLog[];
}
