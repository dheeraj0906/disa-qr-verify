# DISA QR Verify — Architecture Reference

## Project Purpose
Municipal sanitation department QR-based task verification system. Workers scan QR checkpoints, upload geo-timestamped before/after photos. A 4-tier role hierarchy monitors attendance, task progress, and verifies completed work in real time.

---

## Monorepo Structure
```
disa-qr-verify/
├── backend/          # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── routes/         # Express routers (auth, stretches, vehicles, workers, checkpoints, scans, attendance, verification, admin, reports)
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # auth (JWT), role-guard, rate-limit, error-handler, validator
│   │   ├── services/       # Business logic (qr, cloudinary, pdf, attendance, verification)
│   │   ├── utils/          # db pool (Supabase pg), jwt helpers, ist-format
│   │   └── types/          # Shared TS interfaces mirroring DB schema
│   ├── migrations/         # Numbered SQL migration files (run in order)
│   ├── seeds/              # Seed scripts: stretches, vehicles, checkpoints, default users
│   └── tsconfig.json
├── frontend/         # React 18 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── api/            # Axios instances + typed API client functions
│       ├── components/     # Reusable UI (QRScanner, PhotoUpload, MapView, StatusBadge, ...)
│       ├── context/        # AuthContext (JWT state)
│       ├── hooks/          # useGeolocation, useCamera, useTaskLog, ...
│       ├── pages/          # Route-level pages per role
│       │   ├── Login.tsx
│       │   ├── worker/     # Scan, attendance, history
│       │   ├── commissioner/ # Dashboard, map
│       │   ├── verifier/   # Queue, review, history
│       │   └── admin/      # Stretches, vehicles, workers, checkpoints, users, reports
│       ├── types/          # Shared TS types
│       └── utils/          # geoStamp (canvas overlay), formatIST, ...
├── .env.example
└── CLAUDE.md (this file)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| API framework | Express 4 + TypeScript 5 |
| Database | PostgreSQL 15 + PostGIS 3 (Supabase) |
| DB client | `pg` (node-postgres) with connection pool |
| Schema validation | `zod` |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` |
| QR generation | `qrcode` |
| QR scanning | `html5-qrcode` (browser) |
| Photo storage | Cloudinary (Node SDK + browser upload) |
| PDF export | `pdfkit` |
| CSV export | `json2csv` |
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Maps | Leaflet.js + OpenStreetMap tiles |
| HTTP client | Axios |
| Rate limiting | `express-rate-limit` |

---

## Role Hierarchy

| Role const | DB enum value | Description |
|---|---|---|
| Super Admin | `super_admin` | Full CRUD + QR management + all reports |
| Commissioner | `commissioner` | Read-only real-time dashboard for assigned zone |
| Verifier | `verifier` | Approve/reject pending task submissions |
| Field Worker | `field_worker` | Mobile scan + photo upload only |

### Permission Matrix

| Action | super_admin | commissioner | verifier | field_worker |
|---|:---:|:---:|:---:|:---:|
| CRUD stretches/vehicles/workers/checkpoints | ✓ | — | — | — |
| CRUD users | ✓ | — | — | — |
| Generate/print QR codes | ✓ | — | — | — |
| View all-zone dashboard | ✓ | — | — | — |
| View zone dashboard (assigned) | ✓ | ✓ | — | — |
| Approve/reject verifications | ✓ | — | ✓ | — |
| Scan QR + upload photos | ✓ | — | — | ✓ |
| View own attendance/task history | — | — | — | ✓ |
| CSV export | ✓ | — | — | — |

---

## Database Schema (PostGIS)

```sql
-- Enable extension (run once on Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE stretches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  color_code    TEXT NOT NULL,        -- hex or named: 'green','yellow','red','orange'
  road_name     TEXT,
  start_point   GEOGRAPHY(POINT,4326),
  end_point     GEOGRAPHY(POINT,4326),
  status        TEXT NOT NULL DEFAULT 'not_started',
                -- 'not_started' | 'in_progress' | 'completed' | 'verified'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  driver_name         TEXT,
  stretch_id          UUID REFERENCES stretches(id) UNIQUE,  -- 1:1 enforced
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checkpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stretch_id  UUID NOT NULL REFERENCES stretches(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('start','mid','end')),
  location    GEOGRAPHY(POINT,4326),
  qr_code     TEXT UNIQUE,            -- deep-link payload e.g. /scan/checkpoint/{id}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stretch_id, type)           -- one start/mid/end per stretch
);

CREATE TABLE workers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  phone               TEXT,
  qr_badge_code       TEXT UNIQUE,    -- /scan/worker/{id}
  assigned_stretch_id UUID REFERENCES stretches(id),
  role                TEXT NOT NULL DEFAULT 'field_worker',
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','commissioner','verifier','field_worker')),
  zone          TEXT,
  worker_id     UUID REFERENCES workers(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id         UUID NOT NULL REFERENCES checkpoints(id),
  worker_id             UUID NOT NULL REFERENCES workers(id),
  vehicle_id            UUID REFERENCES vehicles(id),
  scan_type             TEXT NOT NULL CHECK (scan_type IN ('check-in','progress','completion')),
  scanned_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  location              GEOGRAPHY(POINT,4326),
  before_photo_url      TEXT,
  after_photo_url       TEXT,
  task_started_at       TIMESTAMPTZ,
  task_completion_time  INTERVAL,
  verification_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending','approved','rejected','n/a')),
  verified_by           UUID REFERENCES users(id),
  verified_at           TIMESTAMPTZ,
  remark                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID NOT NULL REFERENCES workers(id),
  date          DATE NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  location      GEOGRAPHY(POINT,4326),
  is_late       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, date)            -- one attendance record per worker per day
);
```

---

## Stretch Color Codes & Seed Data

| Stretch | status color | Vehicle Reg | Road Name |
|---|---|---|---|
| Stretch 1 | green | Vehicle A (placeholder) | — |
| Stretch 2 | yellow | Vehicle B (placeholder) | — |
| Stretch 3 | red | Vehicle C (placeholder) | — |
| Stretch 4 | orange | Vehicle D (placeholder) | — |

Additional real vehicle entries seeded to Stretch 1 / Stretch 2 segments:
- `TS 24 BA 6647` → Jammi Banda Road
- `TS 24 OJ 5578` → ZP Center Road

Each stretch gets 3 checkpoints auto-generated at seed time: `start`, `mid`, `end`.

---

## QR Code Deep-Link Payloads

| Category | URL format | Encoded in |
|---|---|---|
| Checkpoint | `/scan/checkpoint/{checkpoint_id}` | `checkpoints.qr_code` |
| Vehicle tag | `/scan/vehicle/{vehicle_id}` | (generated on demand) |
| Worker badge | `/scan/worker/{worker_id}` | `workers.qr_badge_code` |

---

## Stretch State Machine (daily workflow)

```
not_started
    │  [check-in scan at Start checkpoint]
    ▼
in_progress
    │  [progress scan at Mid checkpoint]
    │  (remains in_progress)
    │
    │  [completion scan at End checkpoint + photos uploaded]
    ▼
completed (verification_status = 'pending')
    │
    ├─ [verifier approves] ──► verified
    │
    └─ [verifier rejects]  ──► in_progress  (with remark, worker notified)
```

---

## API Route Map (planned)

```
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/stretches
POST   /api/stretches             [super_admin]
PUT    /api/stretches/:id         [super_admin]
DELETE /api/stretches/:id         [super_admin]

GET    /api/vehicles
POST   /api/vehicles              [super_admin]
PUT    /api/vehicles/:id          [super_admin]
DELETE /api/vehicles/:id          [super_admin]

GET    /api/checkpoints
POST   /api/checkpoints           [super_admin]
PUT    /api/checkpoints/:id       [super_admin]
DELETE /api/checkpoints/:id       [super_admin]
GET    /api/checkpoints/:id/qr    [super_admin]   → PNG buffer

GET    /api/workers
POST   /api/workers               [super_admin]
PUT    /api/workers/:id           [super_admin]
DELETE /api/workers/:id           [super_admin]
GET    /api/workers/:id/qr        [super_admin]   → PNG buffer

GET    /api/users                 [super_admin]
POST   /api/users                 [super_admin]
PUT    /api/users/:id             [super_admin]
DELETE /api/users/:id             [super_admin]

POST   /api/qr/bulk-generate      [super_admin]   → generate all missing QR codes
GET    /api/qr/pdf                [super_admin]   → PDF sheet download

POST   /api/scan/checkpoint/:id   [field_worker]  → resolves context, creates/updates task_log
POST   /api/scan/vehicle/:id      [field_worker]
POST   /api/scan/worker/:id       [field_worker]  → attendance check-in

POST   /api/task-logs             [field_worker]  → submit before/after photos
GET    /api/task-logs             [commissioner, super_admin]
GET    /api/task-logs/pending     [verifier, super_admin]
GET    /api/task-logs/my          [field_worker]
POST   /api/task-logs/:id/verify  [verifier, super_admin]   → approve/reject

GET    /api/attendance            [commissioner, super_admin]
GET    /api/attendance/my         [field_worker]

GET    /api/dashboard/live        [commissioner, super_admin]   → map + status + feed
GET    /api/reports/task-logs     [super_admin]   → CSV
GET    /api/reports/attendance    [super_admin]   → CSV
GET    /api/reports/verifications [super_admin]   → CSV
```

---

## Key Implementation Notes

- **Timestamps**: stored UTC in DB (`TIMESTAMPTZ`), formatted to IST (`Asia/Kolkata`, UTC+5:30) for all UI display using `Intl.DateTimeFormat`.
- **Geo-stamped photos**: client-side canvas overlay burns coordinates + timestamp onto image before Cloudinary upload.
- **Task duration**: `task_started_at` set on first `check-in` scan; `task_completion_time` computed as `scanned_at - task_started_at` when scan_type='completion' and photos confirmed.
- **Late attendance**: `is_late = check_in_time > configurable threshold` (default 07:00 IST).
- **Vehicle uniqueness**: `UNIQUE` constraint on `vehicles.stretch_id` — DB-level enforcement, API also validates.
- **Stretch color → Leaflet polyline**: color_code maps directly to Leaflet `color` option on `L.polyline`.
- **Commissioner zone**: `users.zone` filters dashboard to show only stretches whose `id` or `road_name` match.
- **Rate limiting**: 100 req/15 min per IP globally; 10 req/min on `/api/scan/*` to prevent QR replay spam.

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Backend API | Render.com | `npm run start`, port from `$PORT` env var |
| Frontend | Netlify | `npm run build`, publish `dist/`, env: `VITE_API_URL` |
| Database | Supabase | PostGIS enabled, connection via `DATABASE_URL` (pooler URL) |

---

## Environment Variables

See `.env.example` at repo root for the full list. Key vars:

**Backend**
```
DATABASE_URL=          # Supabase pooler connection string
JWT_SECRET=            # Long random string
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FRONTEND_URL=          # For CORS allow-list
LATE_THRESHOLD_IST=07:00  # HH:MM, configurable late check-in threshold
MUNICIPALITY_NAME=Khammam
PORT=4000
```

**Frontend**
```
VITE_API_URL=          # Backend API base URL
VITE_CLOUDINARY_UPLOAD_PRESET=  # Unsigned upload preset name
VITE_CLOUDINARY_CLOUD_NAME=
```

---

## Build Order (implementation phases)

1. ✅ Repo scaffold + CLAUDE.md (this file)
2. Backend: Express+TS setup, DB connection, migrations, seed script
3. Auth: JWT login, role middleware, seed default users
4. QR system: generation endpoints + admin QR UI + PDF export
5. Mobile scan flow: QR scanner → context form → geo/timestamp → Cloudinary → task_logs
6. Attendance flow: worker badge scan → attendance record
7. Commissioner dashboard: Leaflet map, status widgets, live feed
8. Verification panel: queue, photo comparison, approve/reject
9. Admin panel: all CRUD screens + CSV export
10. README, .env.example, deployment configs
