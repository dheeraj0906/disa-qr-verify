-- 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Stretches ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stretches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color_code  TEXT        NOT NULL,
  road_name   TEXT,
  start_point GEOGRAPHY(POINT,4326),
  end_point   GEOGRAPHY(POINT,4326),
  status      TEXT        NOT NULL DEFAULT 'not_started'
              CHECK (status IN ('not_started','in_progress','completed','verified')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Vehicles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT        NOT NULL UNIQUE,
  driver_name         TEXT,
  stretch_id          UUID        UNIQUE REFERENCES stretches(id) ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Checkpoints ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkpoints (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stretch_id  UUID        NOT NULL REFERENCES stretches(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('start','mid','end')),
  location    GEOGRAPHY(POINT,4326),
  qr_code     TEXT        UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stretch_id, type)
);

-- ── Workers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  phone               TEXT,
  qr_badge_code       TEXT        UNIQUE,
  assigned_stretch_id UUID        REFERENCES stretches(id) ON DELETE SET NULL,
  role                TEXT        NOT NULL DEFAULT 'field_worker',
  status              TEXT        NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL
                CHECK (role IN ('super_admin','commissioner','verifier','field_worker')),
  zone          TEXT,
  worker_id     UUID        REFERENCES workers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Task Logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_logs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id        UUID        NOT NULL REFERENCES checkpoints(id),
  worker_id            UUID        NOT NULL REFERENCES workers(id),
  vehicle_id           UUID        REFERENCES vehicles(id),
  scan_type            TEXT        NOT NULL CHECK (scan_type IN ('check-in','progress','completion')),
  scanned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  location             GEOGRAPHY(POINT,4326),
  before_photo_url     TEXT,
  after_photo_url      TEXT,
  task_started_at      TIMESTAMPTZ,
  task_completion_time INTERVAL,
  verification_status  TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (verification_status IN ('pending','approved','rejected','n/a')),
  verified_by          UUID        REFERENCES users(id),
  verified_at          TIMESTAMPTZ,
  remark               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Attendance ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID        NOT NULL REFERENCES workers(id),
  date          DATE        NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  location      GEOGRAPHY(POINT,4326),
  is_late       BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, date)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_logs_worker      ON task_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_checkpoint  ON task_logs(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_vstatus     ON task_logs(verification_status);
CREATE INDEX IF NOT EXISTS idx_task_logs_scanned_at  ON task_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance(worker_id, date);
CREATE INDEX IF NOT EXISTS idx_checkpoints_stretch   ON checkpoints(stretch_id);
