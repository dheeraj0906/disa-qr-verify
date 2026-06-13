# DISA QR Verify — Complete Project Reference

## DEVLOG Rule

**Every time you modify any file in this project, append a new row to the Change Log table in `DEVLOG.md`.**
Format: `| YYYY-MM-DD | Description of what changed and why | comma-separated list of files |`
Also update the "Last updated" date at the top of `DEVLOG.md`. If the change fixes a bug, add a row to the Bugs & Fixes table too.

---

## Live Deployment

| What | URL |
|---|---|
| Frontend (Netlify) | https://disa-qr-verify.netlify.app |
| Backend API (Render) | https://disa-qr-verify-api.onrender.com |
| GitHub | https://github.com/dheeraj0906/disa-qr-verify |
| Health check | `GET https://disa-qr-verify-api.onrender.com/health` → `{"status":"ok"}` |

**Render free tier** sleeps after ~15 min inactivity; ~30s cold start.  
**Netlify** proxies `/api/*` → Render via `[[redirects]]` in `frontend/netlify.toml`, so `VITE_API_URL` is not needed.

Infrastructure IDs:
- Render service: `srv-d8msa2e7r5hc73a5boa0`
- Netlify site: `e899c709-6e74-4c96-b52d-1ee7deef055b`
- Supabase project ref: `ncpycfqvkhuweybivepf`, region `ap-south-1`

---

## Default Credentials

| Role | Email | Password |
|---|---|---|
| super_admin | admin@disa.gov | Admin@1234 |
| commissioner | commissioner@disa.gov | Comm@1234 |
| verifier | verifier@disa.gov | Verify@1234 |
| field_worker | worker1@disa.gov | Worker@1234 |

---

## Project Purpose

Municipal sanitation department QR-based task verification for Khammam Municipal Corporation (Telangana, India). Workers scan QR checkpoints, upload geo-timestamped before/after photos. A 4-tier role hierarchy monitors attendance, task progress, and verifies completed work in real time. Map center: `[17.2478, 80.1514]` (Khammam).

---

## Monorepo File Tree

```
disa-qr-verify/
├── CLAUDE.md                    ← this file (project memory)
├── DEVLOG.md                    ← living dev log, must update on every change
├── README.md
├── .env.example
│
├── backend/
│   ├── src/
│   │   ├── index.ts             ← Express app: CORS, rate-limit, route mounts, health
│   │   ├── middleware/
│   │   │   ├── auth.ts          ← JWT Bearer auth + requireRole() guard
│   │   │   ├── errorHandler.ts  ← global Express error handler
│   │   │   └── validate.ts      ← Zod schema validation middleware
│   │   ├── routes/
│   │   │   ├── auth.ts          ← POST /api/auth/login
│   │   │   ├── stretches.ts     ← CRUD /api/stretches (PostGIS coords)
│   │   │   ├── vehicles.ts      ← CRUD /api/vehicles
│   │   │   ├── checkpoints.ts   ← CRUD /api/checkpoints + GET /:id/qr (PNG)
│   │   │   ├── workers.ts       ← CRUD /api/workers + GET /:id/qr (PNG)
│   │   │   ├── users.ts         ← CRUD /api/users (super_admin only)
│   │   │   ├── qr.ts            ← POST /bulk-generate + GET /pdf (PDFKit)
│   │   │   ├── scan.ts          ← POST /checkpoint/:id, /vehicle/:id, /worker/:id
│   │   │   ├── taskLogs.ts      ← POST / GET / GET /pending /my /verified + POST /:id/verify
│   │   │   ├── attendance.ts    ← GET /attendance + GET /attendance/my
│   │   │   ├── dashboard.ts     ← GET /dashboard/live (commissioner view)
│   │   │   └── reports.ts       ← GET /reports/task-logs|attendance|verifications (CSV)
│   │   ├── utils/
│   │   │   ├── db.ts            ← pg Pool (Supabase, SSL, max 10, 30s idle timeout)
│   │   │   ├── jwt.ts           ← signToken() / verifyToken(), 8h expiry
│   │   │   ├── formatIST.ts     ← toIST(), isLate() (330 min UTC offset)
│   │   │   └── runMigrations.ts ← runs all backend/migrations/*.sql in order
│   │   └── types/index.ts       ← Role, StretchStatus, ScanType, VerificationStatus + interfaces
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── seeds/seed.ts
│   ├── render.yaml              ← Render deploy config
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── index.html
    ├── vite.config.ts           ← manualChunks for leaflet/html5-qrcode/vendor
    ├── netlify.toml             ← Netlify build config + /api/* proxy + SPA fallback
    ├── tailwind.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx              ← BrowserRouter, RoleRedirect, RequireAuth, all routes
        ├── api/
        │   ├── client.ts        ← Axios instance, baseURL fallback /api, Bearer interceptor, 401 redirect
        │   └── index.ts         ← typed API functions: authApi, stretchesApi, vehiclesApi, ...
        ├── context/
        │   └── AuthContext.tsx  ← AuthProvider (localStorage: disa_token, disa_user), useAuth()
        ├── components/
        │   ├── AdminLayout.tsx       ← gray-800 sidebar, NavLink tabs for all admin pages
        │   ├── CommissionerLayout.tsx← indigo-800 top bar
        │   ├── VerifierLayout.tsx    ← teal-800 top bar, Queue/History tabs
        │   ├── WorkerLayout.tsx      ← green-700 top bar
        │   ├── LiveMap.tsx           ← Leaflet OSM map, polylines + circleMarkers, no default markers
        │   ├── Modal.tsx             ← size prop: sm/md/lg → max-w-sm/lg/2xl
        │   ├── QRCodeDisplay.tsx     ← renders QR PNG from API URL
        │   └── StatusBadge.tsx       ← color-coded pill for stretch/verification status
        ├── hooks/
        │   └── useGeolocation.ts     ← acquire() → Promise<{lat,lng}>, highAccuracy, 10s timeout
        ├── pages/
        │   ├── Login.tsx
        │   ├── worker/
        │   │   ├── Scan.tsx          ← html5-qrcode scanner, scan button navigates to /scan/checkpoint/:id etc.
        │   │   ├── TaskForm.tsx      ← photo upload (burnGeoStamp → Cloudinary), submits task log
        │   │   └── History.tsx       ← worker's own task logs via /task-logs/my
        │   ├── scan/                 ← deep-link handlers (phone camera → app)
        │   │   ├── CheckpointScan.tsx← POST /scan/checkpoint/:id → resolve context → redirect worker
        │   │   ├── WorkerScan.tsx    ← POST /scan/worker/:id → attendance check-in
        │   │   └── VehicleScan.tsx   ← POST /scan/vehicle/:id → resolve vehicle context
        │   ├── commissioner/
        │   │   └── Dashboard.tsx     ← LiveMap + StatusBadge cards + AttendanceWidget + VerificationWidget + ActivityFeed, 30s auto-refresh
        │   ├── verifier/
        │   │   ├── Queue.tsx         ← pending logs oldest-first, flash message from location.state.flash
        │   │   ├── Review.tsx        ← side-by-side PhotoPanel, approve/reject with required remark on reject
        │   │   └── History.tsx       ← verifier's own actioned logs via /task-logs/verified, date filter
        │   └── admin/
        │       ├── Stretches.tsx     ← CRUD stretches, parseCoords(GeoJSON) for edit pre-fill
        │       ├── Vehicles.tsx      ← CRUD vehicles, handles UNIQUE(stretch_id) violation
        │       ├── Workers.tsx       ← CRUD workers, QR badge PNG download via workersApi.qrUrl()
        │       ├── Checkpoints.tsx   ← CRUD checkpoints, grouped by stretch, UNIQUE(stretch_id+type) handling
        │       ├── Users.tsx         ← CRUD users, password optional on edit, worker_id cast
        │       ├── Reports.tsx       ← CSV download: task-logs, attendance, verifications; downloadBlob() helper
        │       └── QRManagement.tsx  ← bulk generate + PDF download
        ├── types/index.ts       ← frontend TypeScript interfaces
        └── utils/
            ├── cloudinary.ts    ← uploadToCloudinary(), falls back to FileReader data-URL if unconfigured
            ├── formatIST.ts     ← formatIST(), formatDateIST(), todayISO() (en-CA locale for YYYY-MM-DD)
            └── geoStamp.ts      ← burnGeoStamp(file, lat, lng, timestamp) → canvas overlay → new File
```

---

## Database Schema

Supabase PostgreSQL 17 + PostGIS 3. Migration: `backend/migrations/001_initial_schema.sql`.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE stretches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  color_code  TEXT        NOT NULL,   -- 'green' | 'yellow' | 'red' | 'orange'
  road_name   TEXT,
  start_point GEOGRAPHY(POINT,4326),
  end_point   GEOGRAPHY(POINT,4326),
  status      TEXT        NOT NULL DEFAULT 'not_started'
              CHECK (status IN ('not_started','in_progress','completed','verified')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT  NOT NULL UNIQUE,
  driver_name         TEXT,
  stretch_id          UUID  UNIQUE REFERENCES stretches(id) ON DELETE SET NULL,  -- 1:1
  status              TEXT  NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checkpoints (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  stretch_id UUID  NOT NULL REFERENCES stretches(id) ON DELETE CASCADE,
  type       TEXT  NOT NULL CHECK (type IN ('start','mid','end')),
  location   GEOGRAPHY(POINT,4326),
  qr_code    TEXT  UNIQUE,            -- '/scan/checkpoint/{id}'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stretch_id, type)           -- one start/mid/end per stretch
);

CREATE TABLE workers (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT  NOT NULL,
  phone               TEXT,
  qr_badge_code       TEXT  UNIQUE,   -- '/scan/worker/{id}'
  assigned_stretch_id UUID  REFERENCES stretches(id) ON DELETE SET NULL,
  role                TEXT  NOT NULL DEFAULT 'field_worker',
  status              TEXT  NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT  NOT NULL,
  email         TEXT  NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,
  role          TEXT  NOT NULL CHECK (role IN ('super_admin','commissioner','verifier','field_worker')),
  zone          TEXT,                 -- commissioner's assigned zone
  worker_id     UUID  REFERENCES workers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_logs (
  id                   UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id        UUID  NOT NULL REFERENCES checkpoints(id),
  worker_id            UUID  NOT NULL REFERENCES workers(id),
  vehicle_id           UUID  REFERENCES vehicles(id),
  scan_type            TEXT  NOT NULL CHECK (scan_type IN ('check-in','progress','completion')),
  scanned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  location             GEOGRAPHY(POINT,4326),
  before_photo_url     TEXT,
  after_photo_url      TEXT,
  task_started_at      TIMESTAMPTZ,               -- set on check-in
  task_completion_time INTERVAL,                  -- now() - task_started_at on completion
  verification_status  TEXT  NOT NULL DEFAULT 'pending'
                       CHECK (verification_status IN ('pending','approved','rejected','n/a')),
  verified_by          UUID  REFERENCES users(id),
  verified_at          TIMESTAMPTZ,
  remark               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID  NOT NULL REFERENCES workers(id),
  date          DATE  NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  location      GEOGRAPHY(POINT,4326),
  is_late       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, date)
);

-- Indexes
CREATE INDEX idx_task_logs_worker      ON task_logs(worker_id);
CREATE INDEX idx_task_logs_checkpoint  ON task_logs(checkpoint_id);
CREATE INDEX idx_task_logs_vstatus     ON task_logs(verification_status);
CREATE INDEX idx_task_logs_scanned_at  ON task_logs(scanned_at DESC);
CREATE INDEX idx_attendance_worker_date ON attendance(worker_id, date);
CREATE INDEX idx_checkpoints_stretch   ON checkpoints(stretch_id);
```

**DB connection:** `backend/src/utils/db.ts` — `pg.Pool`, `DATABASE_URL` env var, `ssl: { rejectUnauthorized: false }`, max 10 connections, 30s idle timeout.

**Critical:** The DB password contains `@` — it must be URL-encoded as `%40` in `DATABASE_URL`. Example:
```
postgresql://postgres.ncpycfqvkhuweybivepf:disaqrverify%40718@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

---

## PostGIS Coordinate Convention

**Always use `ST_MakePoint(lng, lat)`** — PostGIS uses (longitude, latitude) order.  
**Leaflet uses `[lat, lng]`** — always swap when parsing from GeoJSON.

```typescript
// Parsing GeoJSON from DB to Leaflet coordinates:
const geo = JSON.parse(raw) as { coordinates?: [number, number] };
const [lng, lat] = geo.coordinates;
return [lat, lng]; // Leaflet [lat, lng]

// Inserting into DB:
ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
```

Stretches `GET /api/stretches` returns `start_point` and `end_point` as GeoJSON strings via `ST_AsGeoJSON(...)`. Parse with `JSON.parse()` in frontend.

---

## Backend TypeScript Types (`backend/src/types/index.ts`)

```typescript
export type Role = 'super_admin' | 'commissioner' | 'verifier' | 'field_worker';
export type StretchStatus = 'not_started' | 'in_progress' | 'completed' | 'verified';
export type ScanType = 'check-in' | 'progress' | 'completion';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'n/a';
export type CheckpointType = 'start' | 'mid' | 'end';

export interface JwtPayload {
  userId: string;
  role: Role;
  zone: string | null;
  workerId: string | null;   // links user → worker for field_worker role
}
```

---

## Frontend TypeScript Types (`frontend/src/types/index.ts`)

```typescript
export interface AuthUser { id, name, email, role: Role, zone: string | null }
export interface Stretch { id, name, color_code, road_name, status: StretchStatus, start_point: string|null, end_point: string|null }
export interface Vehicle { id, registration_number, driver_name, stretch_id, stretch_name?, status }
export interface Checkpoint { id, stretch_id, stretch_name, type: 'start'|'mid'|'end', qr_code }
export interface Worker { id, name, phone, qr_badge_code, assigned_stretch_id, stretch_name?, role, status }
export interface TaskLog { id, scan_type, scanned_at, before_photo_url, after_photo_url, verification_status, remark, verified_at, duration, worker_name?, stretch_name?, checkpoint_type?, color_code?, verified_by_name? }
export interface AttendanceRecord { id, worker_id, date, check_in_time, is_late, worker_name?, stretch_name? }
export interface DashboardData { municipality, date, stretches: (Stretch & { last_vehicle_location })[], attendance: {present, total}, verification: {pending, approved, rejected}, feed: TaskLog[] }
```

---

## Auth Flow

**Backend middleware** (`backend/src/middleware/auth.ts`):
- `authenticate`: reads `Authorization: Bearer <token>`, calls `verifyToken()`, sets `req.user: JwtPayload`
- `requireRole(...roles)`: checks `req.user.role` against allowed roles

**Login** (`POST /api/auth/login`):
1. Zod validates `{ email, password }`
2. bcrypt.compare against `password_hash`
3. Returns `{ token, user: AuthUser }` — token is 8h JWT with `{ userId, role, zone, workerId }`

**Frontend** (`frontend/src/context/AuthContext.tsx`):
- State persisted in `localStorage` as `disa_token` + `disa_user`
- `useAuth()` hook: `{ token, user, login(), logout() }`
- Axios interceptor auto-attaches `Authorization: Bearer <token>`
- 401 response → clear localStorage → redirect to `/login`

**Route guard** (`frontend/src/App.tsx`):
```typescript
const WORKER_ROLES = ['field_worker', 'super_admin'];
const COMM_ROLES   = ['commissioner', 'super_admin'];
const VERIFY_ROLES = ['verifier', 'super_admin'];
const ADMIN_ROLES  = ['super_admin'];
// <RequireAuth roles={ADMIN_ROLES}> wraps each route
// <RoleRedirect> at "/" sends each role to their home page
```

---

## API Endpoints (actual implemented routes)

### Auth
```
POST /api/auth/login        { email, password } → { token, user: AuthUser }
```

### Stretches (all authenticated; write = super_admin)
```
GET    /api/stretches          → Stretch[] (start_point/end_point as GeoJSON string)
POST   /api/stretches          { name, color_code, road_name?, start_lat?, start_lng?, end_lat?, end_lng? }
PUT    /api/stretches/:id      same fields (all optional); preserves existing point if coords omitted
DELETE /api/stretches/:id      → 204
```

### Vehicles
```
GET    /api/vehicles           → Vehicle[] (includes stretch_name via JOIN)
POST   /api/vehicles           { registration_number, driver_name?, stretch_id?, status? }
PUT    /api/vehicles/:id
DELETE /api/vehicles/:id       UNIQUE(stretch_id) violation → "A vehicle is already assigned to that stretch."
```

### Checkpoints
```
GET    /api/checkpoints        → Checkpoint[] (includes stretch_name)
POST   /api/checkpoints        { stretch_id, type, lat?, lng? }
PUT    /api/checkpoints/:id
DELETE /api/checkpoints/:id    UNIQUE(stretch_id, type) → handled in frontend
GET    /api/checkpoints/:id/qr → PNG buffer (direct img src or <a download>)
```

### Workers
```
GET    /api/workers            → Worker[] (includes stretch_name)
POST   /api/workers            { name, phone?, assigned_stretch_id?, status? }
PUT    /api/workers/:id
DELETE /api/workers/:id
GET    /api/workers/:id/qr     → PNG buffer
```

### Users
```
GET    /api/users              → AuthUser[] (super_admin only)
POST   /api/users              { name, email, password, role, zone?, worker_id? }
PUT    /api/users/:id          { name, email, role, zone?, worker_id?, password? (optional) }
DELETE /api/users/:id
```

### QR
```
POST   /api/qr/bulk-generate   → { checkpoints: N, workers: N, message }
GET    /api/qr/pdf             → PDF blob (PDFKit, 2-column A4 layout, 160px QR images)
```

### Scan (field_worker + super_admin)
```
POST   /api/scan/checkpoint/:id  → { checkpoint: {id, type, stretch_id, stretch_name, color_code, stretch_status}, workerId }
POST   /api/scan/vehicle/:id     → { vehicle: {id, registration_number, driver_name, stretch_id, stretch_name}, workerId }
POST   /api/scan/worker/:id      { lat?, lng? } → { attendance, worker, isLate }
       -- uses ON CONFLICT (worker_id, date) DO UPDATE (idempotent re-check-in)
```

### Task Logs
```
POST   /api/task-logs            { checkpoint_id, vehicle_id?, scan_type, lat?, lng?, before_photo_url?, after_photo_url? }
       -- check-in: sets task_started_at, updates stretch to in_progress (if not_started)
       -- completion: computes task_completion_time, sets verification_status='pending', updates stretch to completed
       -- progress: verification_status='n/a'

GET    /api/task-logs            commissioner/super_admin → last 200, includes worker_name/stretch_name/checkpoint_type
GET    /api/task-logs/pending    verifier/super_admin → pending queue, ASC order (oldest first), includes color_code/duration
GET    /api/task-logs/my         field_worker → own 100 logs
GET    /api/task-logs/verified   verifier → own actioned logs, ?from=&to= date filter, includes verified_by_name
       IMPORTANT: /verified must be declared BEFORE /:id in Express to avoid param capture
POST   /api/task-logs/:id/verify { action: 'approved'|'rejected', remark? }
       -- approved: stretch → 'verified'
       -- rejected: stretch → 'in_progress' (worker must redo)
```

### Attendance
```
GET    /api/attendance           ?date=YYYY-MM-DD → { date, records: AttendanceRecord[], summary }
GET    /api/attendance/my        field_worker → own records
```

### Dashboard
```
GET    /api/dashboard/live       ?date=YYYY-MM-DD
       commissioner: filters stretches by users.zone (road_name or name ILIKE zone)
       super_admin: all stretches
       → DashboardData { municipality, date, stretches (with last_vehicle_location), attendance, verification, feed }
```

### Reports (super_admin, CSV download)
```
GET    /api/reports/task-logs       ?from=&to= → task-logs.csv
GET    /api/reports/attendance      ?from=&to= → attendance.csv
GET    /api/reports/verifications   ?from=&to= → verifications.csv
```

### Health
```
GET    /health   → { status: 'ok' }   (no auth, no /api prefix)
```

---

## Rate Limiting

- Global: 100 req / 15 min per IP on `/api/*`
- Scan: 10 req / 1 min on `/api/scan/*` (anti-replay)

---

## Stretch State Machine

```
not_started
    │  [POST /task-logs scan_type='check-in']
    ▼
in_progress
    │  [POST /task-logs scan_type='progress']  ← stays in_progress
    │
    │  [POST /task-logs scan_type='completion' + photos]
    ▼
completed   (task_log.verification_status = 'pending')
    │
    ├─ [POST /task-logs/:id/verify action='approved'] → verified
    └─ [POST /task-logs/:id/verify action='rejected'] → in_progress  (remark required)
```

Status is driven by task_log submissions and verifications. `workers.role` is separate from `users.role` — don't confuse them.

---

## IST / Timezone Handling

All DB timestamps stored UTC. Display in IST (Asia/Kolkata, UTC+5:30).

```typescript
// backend/src/utils/formatIST.ts
toIST(date)          // → Intl.DateTimeFormat 'en-IN' 24h
isLate(checkInTime, 'HH:MM')  // threshold in IST, compares in UTC
  // IST offset = 330 minutes; thresholdUTC = (hh*60 + mm - 330) * 60000

// frontend/src/utils/formatIST.ts
formatIST(utcStr)    // → toLocaleString('en-IN', Asia/Kolkata)
formatDateIST(utcStr)// → toLocaleDateString('en-IN', Asia/Kolkata)
todayISO()           // → YYYY-MM-DD in IST using 'en-CA' locale
```

`todayISO()` uses `en-CA` locale because it produces `YYYY-MM-DD` format in IST timezone. Do not use `en-IN` for this — it formats differently.

---

## Frontend Map (LiveMap.tsx)

- Uses Leaflet.js + OpenStreetMap tiles
- **No default markers** — uses `L.circleMarker` and `L.divIcon` to avoid Vite bundler PNG issue with `leaflet/dist/images`
- Color map: `green→#16a34a, yellow→#ca8a04, red→#dc2626, orange→#ea580c`
- Draws `L.polyline([startPt, endPt])` per stretch + circleMarkers at endpoints
- Vehicle live position from `last_vehicle_location` (GeoJSON from dashboard) shown with pulsing `L.divIcon` ring
- `parseGeoJSON(raw)` swaps `[lng, lat]` → `[lat, lng]` for Leaflet
- Map is initialized once in a `useEffect` with empty dep array; layers cleared and redrawn on data change

---

## Photo Upload (Cloudinary)

`frontend/src/utils/cloudinary.ts`:
- `cloudinaryConfigured` = `VITE_CLOUDINARY_CLOUD_NAME` is set and not `'placeholder'`
- If unconfigured: returns `FileReader` data-URL (stub) so app flow works without real Cloudinary
- If configured: unsigned upload to `https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload`

`frontend/src/utils/geoStamp.ts`:
- `burnGeoStamp(file, lat, lng, timestamp)` → draws `Lat/Lng/IST timestamp` overlay on canvas → returns new `File`
- Applied to both before/after photos before upload

---

## QR Code System

- QR payload strings stored in DB: `checkpoints.qr_code = '/scan/checkpoint/{id}'`, `workers.qr_badge_code = '/scan/worker/{id}'`
- `POST /api/qr/bulk-generate` sets these for any NULL rows
- `GET /api/checkpoints/:id/qr` and `GET /api/workers/:id/qr` generate PNG on demand with `qrcode` npm package
- Worker badge PNG: `<a href={workersApi.qrUrl(w.id)} download>` direct download
- QR PDF: `qrCode + PDFKit`, 2-column A4, 150px images, page-overflow handled

---

## Frontend Routing (App.tsx)

```
/login                      → LoginPage
/                           → RoleRedirect (sends to role's home)
/scan/checkpoint/:id        → CheckpointScan (deep-link, no auth required before redirect)
/scan/worker/:id            → WorkerScan
/scan/vehicle/:id           → VehicleScan
/worker/scan                → WORKER_ROLES
/worker/task                → WORKER_ROLES
/worker/history             → WORKER_ROLES
/commissioner/dashboard     → COMM_ROLES
/verifier/queue             → VERIFY_ROLES
/verifier/review/:id        → VERIFY_ROLES (log passed via location.state, fallback to fetch)
/verifier/history           → VERIFY_ROLES
/admin/stretches            → ADMIN_ROLES
/admin/vehicles             → ADMIN_ROLES
/admin/workers              → ADMIN_ROLES
/admin/checkpoints          → ADMIN_ROLES
/admin/users                → ADMIN_ROLES
/admin/qr                   → ADMIN_ROLES
/admin/reports              → ADMIN_ROLES
*                           → redirect to /
```

---

## Frontend API Client (`frontend/src/api/`)

`client.ts`: Axios instance, `baseURL = VITE_API_URL || '/api'`. On Netlify, `/api` is proxied to Render.

`index.ts` exports:
```typescript
authApi.login(email, password)
stretchesApi.list() | .create(data) | .update(id, data) | .remove(id)
vehiclesApi.list() | .create() | .update() | .remove()
checkpointsApi.list() | .create() | .update() | .remove() | .qrUrl(id)
workersApi.list() | .create() | .update() | .remove() | .qrUrl(id)
usersApi.list() | .create() | .update() | .remove()
qrApi.bulkGenerate() | .pdfUrl() | .downloadPdf()
scanApi.checkpoint(id) | .vehicle(id) | .worker(id, lat?, lng?)
taskLogsApi.submit(data) | .list() | .pending() | .my() | .verify(id, action, remark?) | .verifiedBy(from?, to?)
attendanceApi.list(date?) | .my()
dashboardApi.live(date?)
reportsApi.taskLogs(from?, to?) | .attendance(from?, to?) | .verifications(from?, to?)
```

---

## Key Patterns and Gotchas

**PostGIS GPS coords in scan routes**: `lat`/`lng` come from client as numbers. Template literal in SQL:
```typescript
const locExpr = lat != null
  ? `ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography`
  : 'NULL';
// then use locExpr literally in the query string (not as a parameter)
```

**Zod validation middleware** (`backend/src/middleware/validate.ts`): `validate(schema)` returns Express middleware. Call as `router.post('/', authenticate, requireRole(...), validate(schema), handler)`.

**Express route order**: In `taskLogs.ts`, `GET /verified` must come **before** `GET /:id` — Express matches routes top-to-bottom; if `/:id` appears first it captures `'verified'` as the ID.

**Verifier review navigation**: `Review.tsx` loads the task log from `location.state.log`. If state is missing (direct URL access), falls back to fetching the pending queue and filtering by `:id`. Navigate back with flash via:
```typescript
navigate('/verifier/queue', { state: { flash: 'Approved successfully' } });
```

**Admin Stretches parseCoords**: GeoJSON from DB needs to be parsed back to `{lat, lng}` to pre-fill edit form:
```typescript
function parseCoords(raw: string | null) {
  if (!raw) return { lat: '', lng: '' };
  const geo = JSON.parse(raw);
  const [lng, lat] = geo.coordinates;
  return { lat: String(lat), lng: String(lng) };
}
```

**Users admin worker_id cast**: `users` table has `worker_id` but `AuthUser` type doesn't include it. Cast:
```typescript
(u as AuthUser & { worker_id?: string }).worker_id
```

**Modal size prop** (`components/Modal.tsx`): `size?: 'sm' | 'md' | 'lg'` maps to `max-w-sm | max-w-lg | max-w-2xl`.

**CSV reports** use inline `toCSV()` (no external dependency). `sendCSV()` sets `Content-Type: text/csv` + `Content-Disposition`. Frontend uses `downloadBlob()`:
```typescript
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

**Commissioner Dashboard auto-refresh**: 30s interval using `timerRef.current = setInterval(() => fetchData(date), 30000)`. Separate `useEffect` ticks countdown visual every second.

**Vite build**: `vite.config.ts` uses `manualChunks` to split `leaflet` and `html5-qrcode` into their own chunks, avoiding a monolithic bundle.

---

## Environment Variables

**Backend** (`.env` / Render dashboard):
```
DATABASE_URL=postgresql://postgres.ncpycfqvkhuweybivepf:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=<long random string>
CLOUDINARY_CLOUD_NAME=placeholder   ← update with real value to enable photo upload
CLOUDINARY_API_KEY=placeholder
CLOUDINARY_API_SECRET=placeholder
FRONTEND_URL=https://disa-qr-verify.netlify.app
MUNICIPALITY_NAME=Khammam
LATE_THRESHOLD_IST=07:00
PORT=4000                            ← Render sets $PORT automatically
NODE_ENV=production
```

**Frontend** (`frontend/.env` / Netlify env):
```
VITE_API_URL=                        ← intentionally empty; Netlify proxy handles it
VITE_CLOUDINARY_CLOUD_NAME=placeholder
VITE_CLOUDINARY_UPLOAD_PRESET=       ← unsigned upload preset name from Cloudinary dashboard
```

---

## Deployment

**Render** (`backend/render.yaml`):
```yaml
buildCommand: npm install --include=dev && npm run build && node dist/utils/runMigrations.js
startCommand: npm start
```
`--include=dev` is required because `NODE_ENV=production` causes plain `npm install` to skip devDependencies (TypeScript, ts-node), breaking the build.

**Netlify** (`frontend/netlify.toml`):
```toml
[build]
  base    = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from   = "/api/*"
  to     = "https://disa-qr-verify-api.onrender.com/api/:splat"
  status = 200
  force  = true

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

---

## Role Hierarchy Summary

| Role | Home Route | Access |
|---|---|---|
| super_admin | /admin/stretches | Everything |
| commissioner | /commissioner/dashboard | Read-only live dashboard (zone-filtered) |
| verifier | /verifier/queue | Approve/reject pending task submissions |
| field_worker | /worker/scan | Scan QR + submit photos only |

`super_admin` is also allowed in `WORKER_ROLES`, `COMM_ROLES`, `VERIFY_ROLES` — so admin can test all flows.

---

## Tech Stack — Decision Rationale

| Choice | Why |
|---|---|
| `pg` (node-postgres) | Direct control; pgBouncer transaction-mode compatible (no prepared statements) |
| Zod | Runtime schema validation + TypeScript type inference from the same schema |
| JWT (stateless, 8h) | No session store needed; role+zone+workerId embedded in payload |
| `qrcode` | PNG buffer output works cleanly with PDFKit |
| `html5-qrcode` | Browser-native camera access, no native app install required |
| Cloudinary unsigned upload | Free tier; browser uploads directly, no server relay |
| `pdfkit` | Streaming PDF generation, no headless browser needed |
| Inline `toCSV()` | Replaced `json2csv` alpha which had no TypeScript type declarations |
| Leaflet + OpenStreetMap | Open-source, no API key, works with PostGIS GeoJSON |
| Vite `manualChunks` | Splits into 4 vendor chunks: vendor-react ~164KB, vendor-qrscan ~334KB, vendor-leaflet ~149KB, vendor-qrgen ~24KB; avoids 608KB single-chunk warning |

---

## Seed Data (`backend/seeds/seed.ts`)

Seed is **idempotent** — uses `INSERT ... ON CONFLICT DO NOTHING` (checked separately by name). Safe to re-run.

**Stretches** (4):
- Stretch 1 — `color_code: 'green'`
- Stretch 2 — `color_code: 'yellow'`
- Stretch 3 — `color_code: 'red'`
- Stretch 4 — `color_code: 'orange'`

**Vehicles** (4 placeholder + 2 real):
- `TS 24 BA 6647` — Jammi Banda Road → Stretch 1
- `TS 24 OJ 5578` — ZP Center Road → Stretch 2
- (2 placeholder vehicles for Stretch 3 + 4)

**Checkpoints**: 3 per stretch (`start`, `mid`, `end`) with pre-set `qr_code` payloads `/scan/checkpoint/{id}`.

**Workers** (4 field_workers): `worker1`–`worker4`, each assigned to one stretch.

**Users** (4 default — see Default Credentials table above): passwords bcrypt-hashed with salt rounds 10.

---

## pgBouncer / Supabase Specifics

Supabase uses pgBouncer in **transaction pooling mode** (port 6543). This has two implications:

1. **No prepared statements** — `pg` Pool works fine; don't use `pg-native` or ORM features that use named prepared statements.
2. **UUID type inference fails** — pgBouncer can't infer `UUID` type for `$1` parameters in UPDATE WHERE clauses. Always cast explicitly:
   ```sql
   WHERE id = $1::uuid
   ```
   Without the cast you get: `"could not determine data type of parameter $1"`.

3. **`ON CONFLICT DO NOTHING RETURNING` returns empty on no-op** — if a row already exists and conflict is ignored, `RETURNING` returns zero rows. Pattern used in seed: INSERT (ignoring conflict), then SELECT by unique field separately.

---

## Known Bugs Fixed (do not re-introduce)

| # | Bug | Root Cause | Fix Applied |
|---|---|---|---|
| 1 | DB connection refused | `@` in password treated as URL delimiter | URL-encode `@` as `%40` in `DATABASE_URL` |
| 2 | Seed re-run returns empty | `ON CONFLICT DO NOTHING RETURNING` returns nothing on skip | INSERT then SELECT by name separately |
| 3 | `"could not determine data type of parameter $1"` | pgBouncer transaction mode can't infer UUID in UPDATE | Add `::uuid` cast to all UUID params |
| 4 | Server start blocks test imports | `app.listen()` at module scope | Guarded with `if (require.main === module)` |
| 5 | `json2csv` has no TS types | Alpha package, no declarations | Replaced with inline `toCSV()` in `reports.ts` |
| 6 | JWT `expiresIn` TS type error | `string` not assignable to `StringValue` | Cast as `any` in `jwt.sign()` call |
| 7 | Vehicle UNIQUE constraint on seed re-run | Two vehicles assigned same stretch_id | `TS 24 BA 6647` → Stretch 1, `TS 24 OJ 5578` → Stretch 2 |
| 8 | `RefObject<HTMLInputElement \| null>` type error | React 18 changed `useRef` return type | Cast as `React.RefObject<HTMLInputElement>` |
| 9 | 608KB single Vite chunk warning | All deps in one bundle | `manualChunks` splits into 4 vendor chunks |
| 10 | Leaflet default marker PNGs missing at runtime | Vite bundler doesn't resolve `leaflet/dist/images` assets | Use `L.circleMarker` + `L.divIcon` throughout — no `L.marker` with default icon |
| 11 | Render build failed in 19s | `NODE_ENV=production` caused `npm install` to skip devDeps (TypeScript, ts-node missing) | Changed to `npm install --include=dev` in build command |
| 12 | Stretches PUT ignored GPS coord updates | Backend route only updated name/color/road_name columns | PUT now builds `ST_MakePoint` expression for both start/end, falls back to existing column value if coords omitted |

---

## Test Coverage

**Step 3 auth tests** (34 total, all passing):
- 21 unit tests: bcrypt hash/compare, JWT sign/verify, `isLate()` edge cases
- 13 HTTP integration tests: login success/fail, protected route 401/403, role guard per endpoint

**Production e2e** (2026-06-14, via Netlify → Render → Supabase):

| Role | Tested endpoint | Result |
|---|---|---|
| super_admin | GET /api/stretches | 200 ✅ |
| commissioner | GET /api/dashboard/live | 200 ✅ |
| verifier | GET /api/task-logs/pending | 200 ✅ |
| field_worker | GET /api/task-logs/my | 200 ✅ |

Health: `GET https://disa-qr-verify-api.onrender.com/health` → `{"status":"ok"}` ✅

---

## Deployment — Full Render Env Vars

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler URL with `%40` password encoding |
| `JWT_SECRET` | Auto-generated by Render (rotate via Render dashboard if needed) |
| `JWT_EXPIRES_IN` | `8h` |
| `CLOUDINARY_CLOUD_NAME` | `placeholder` — update to enable real photo uploads |
| `CLOUDINARY_API_KEY` | `placeholder` |
| `CLOUDINARY_API_SECRET` | `placeholder` |
| `FRONTEND_URL` | `https://disa-qr-verify.netlify.app` |
| `MUNICIPALITY_NAME` | `Khammam` |
| `LATE_THRESHOLD_IST` | `07:00` |
| `NODE_ENV` | `production` |

Auto-deploy is wired to GitHub `master` branch for both Render and Netlify.
