export type Role = 'super_admin' | 'commissioner' | 'verifier' | 'field_worker';
export type StretchStatus = 'not_started' | 'in_progress' | 'completed' | 'verified';
export type ScanType = 'check-in' | 'progress' | 'completion';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'n/a';
export type CheckpointType = 'start' | 'mid' | 'end';

export interface Stretch {
  id: string;
  name: string;
  color_code: string;
  road_name: string | null;
  start_point: unknown;
  end_point: unknown;
  status: StretchStatus;
  created_at: string;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  driver_name: string | null;
  stretch_id: string | null;
  status: string;
  created_at: string;
}

export interface Checkpoint {
  id: string;
  stretch_id: string;
  type: CheckpointType;
  location: unknown;
  qr_code: string | null;
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string | null;
  qr_badge_code: string | null;
  assigned_stretch_id: string | null;
  role: string;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  zone: string | null;
  worker_id: string | null;
  created_at: string;
}

export interface TaskLog {
  id: string;
  checkpoint_id: string;
  worker_id: string;
  vehicle_id: string | null;
  scan_type: ScanType;
  scanned_at: string;
  location: unknown;
  before_photo_url: string | null;
  after_photo_url: string | null;
  task_started_at: string | null;
  task_completion_time: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  remark: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  worker_id: string;
  date: string;
  check_in_time: string;
  location: unknown;
  is_late: boolean;
  created_at: string;
}

export interface JwtPayload {
  userId: string;
  role: Role;
  zone: string | null;
  workerId: string | null;
}
