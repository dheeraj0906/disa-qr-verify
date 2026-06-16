# DISA QR Verify — Development Log

> Maintained by Claude Code. This file is updated every time a code change is made.  
> Project: Municipal sanitation QR verification system for Khammam Municipal Corporation  
> Repository: https://github.com/dheeraj0906/disa-qr-verify  
> Last updated: 2026-06-17 (testing)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack Decisions](#tech-stack-decisions)
3. [Development Timeline](#development-timeline)
4. [Bugs & Fixes](#bugs--fixes)
5. [Test Results](#test-results)
6. [Deployment Log](#deployment-log)
7. [Change Log](#change-log)

---

## Project Overview

DISA QR Verify is a full-stack GIS-based field task verification system commissioned for Khammam Municipal Corporation. Field workers scan QR codes at physical checkpoint markers along sanitation stretches, upload geo-timestamped before/after photos, and a 4-tier role hierarchy (super_admin → commissioner → verifier → field_worker) monitors and verifies work in real time.

**Key capabilities:**
- QR scan via phone camera — no app install, deep-link URLs
- Canvas-burned GPS + IST timestamp overlay on photos before upload
- Live Leaflet map showing stretch status and vehicle position
- Worker attendance with configurable late threshold (07:00 IST)
- Stretch state machine: not_started → in_progress → completed → verified
- PDF QR sheet (pdfkit, 2-column grid) for printing checkpoint markers and worker badges
- CSV export (task logs, attendance, verifications) with date-range filter

---

## Tech Stack Decisions

| Decision | Choice | Reason |
|---|---|---|
| API runtime | Node.js 20 + Express 4 + TypeScript 5 | Type safety, team familiarity |
| Database | PostgreSQL 17 + PostGIS on Supabase | Geospatial queries, managed hosting, free tier |
| DB client | `pg` (node-postgres) | Direct control, pgBouncer transaction-mode compatible |
| Validation | Zod | Runtime schema validation, TypeScript inference |
| Auth | JWT + bcrypt | Stateless, 8h expiry, role+zone+workerId in payload |
| QR generation | `qrcode` | PNG buffer output for PDF sheet |
| QR scanning | `html5-qrcode` | Browser-native camera, no native app required |
| Photo storage | Cloudinary unsigned upload | Free tier, browser-side upload (no server relay) |
| PDF export | `pdfkit` | Streaming PDF generation, no headless browser needed |
| CSV export | Inline `toCSV()` helper | Replaced `json2csv` alpha (no TS types) |
| Frontend | React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 | Fast HMR, tree-shaking, utility-first CSS |
| Maps | Leaflet.js + OpenStreetMap | Open-source, no API key, PostGIS-compatible |
| Rate limiting | `express-rate-limit` | 100 req/15min global; 10 req/min on `/api/scan/*` |
| Bundle splitting | Vite `manualChunks` | Splits vendor-react, vendor-leaflet, vendor-qrscan, vendor-qrgen |

---

## Development Timeline

### Step 1 — Repository Scaffold  
*Commit: `1e5388a`*

- Created monorepo: `backend/` (Node.js/Express/TS) + `frontend/` (React/Vite/TS)
- Wrote `CLAUDE.md` — full architecture reference (schema, roles, routes, state machine, deployment)
- Generated `.env.example`, `.gitignore`
- Stubbed all 12 backend route files and all frontend page files
- Set up `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `vite.config.ts`

### Step 2 — Backend Setup, DB Migration, Seed  
*Commit: `7104ad1`*

- Connected Express to Supabase PostgreSQL via `pg` pool
- Wrote `001_initial_schema.sql`:
  - Tables: `stretches`, `vehicles` (UNIQUE `stretch_id`), `checkpoints` (UNIQUE `stretch_id+type`), `workers`, `users`, `task_logs`, `attendance` (UNIQUE `worker_id+date`)
  - PostGIS `GEOGRAPHY(POINT,4326)` columns for GPS
  - Indexes on `task_logs(worker_id)`, `task_logs(scanned_at DESC)`, `task_logs(verification_status)`
- Wrote `seed.ts` (idempotent): 4 stretches, 12 checkpoints with QR payloads, 4 workers, 4 default users, 2 real vehicles (`TS 24 BA 6647`, `TS 24 OJ 5578`)
- Implemented all CRUD backend routes with Zod validation
- **Fix:** `@` in DB password URL-encoded as `%40` in `DATABASE_URL`
- **Fix:** Supabase pgBouncer transaction mode can't infer UUID types → added `::uuid` cast to all UPDATE params
- **Fix:** `INSERT ... ON CONFLICT DO NOTHING RETURNING` returns empty on re-run → switched to INSERT then SELECT by name

### Step 3 — Auth, JWT, Role Middleware  
*Commit: `65bde5e`*

- Implemented `POST /api/auth/login` with bcrypt verify + JWT sign
- `AuthRequest` interface extends Express `Request` with `user?: JwtPayload`
- `authenticate` middleware: verifies Bearer token, attaches `req.user`
- `requireRole(...roles)` middleware: 403 if role not in list
- JWT payload: `{ userId, role, zone, workerId }`, 8h expiry
- Wrote 21 unit tests (auth logic) + 13 HTTP integration tests
- **Fix:** `jwt.sign` `expiresIn` type mismatch (`string` not assignable to `StringValue`) → cast as `any`
- **Fix:** `app.listen()` in module scope blocked test imports → guarded with `if (require.main === module)`
- **Fix:** Replaced `json2csv` alpha (no TS types) with inline `toCSV()` helper in `reports.ts`

### Step 4 — QR System + Admin QR UI  
*Commit: `38d57e6`*

- `POST /api/qr/bulk-generate` — generates missing QR payloads for all checkpoints + workers
- `GET /api/qr/pdf` — pdfkit streaming PDF: 2-column grid of QR PNGs with labels (38KB, 16 codes)
- `GET /api/checkpoints/:id/qr` and `GET /api/workers/:id/qr` — individual PNG endpoints
- Frontend: `AdminQRPage` with tabs (checkpoints / workers), inline mini-QR canvas preview per card, Bulk Generate button, PDF download
- `QRCodeDisplay` component: renders QR on canvas, `window.location.origin` prefix for full URL, PNG download via `canvas.toDataURL()`
- `AdminLayout`: dark sidebar (gray-900), 7 nav items, active = blue-600
- Typed API client (`frontend/src/api/index.ts`) for all resources

### Step 5 — Mobile Scan Flow  
*Commit: `fbc961b`*

- `Html5Qrcode` scanner in `Scan.tsx`: prefer rear camera, 600ms flash on decode
- QR payload parser: `/\/scan\/(checkpoint|worker|vehicle)\/([0-9a-f-]{36})/i`
- Deep-link routes: `/scan/checkpoint/:id`, `/scan/worker/:id`, `/scan/vehicle/:id`
  - Handlers redirect to `/login?next=<url>` if unauthenticated; login page reads `?next=` and redirects after login
- `CheckpointScan.tsx` → resolves checkpoint context, navigates to `/worker/task` with state
- `WorkerScan.tsx` → marks attendance, shows On Time / Late badge with IST timestamp
- `TaskForm.tsx` — 3-step UX:
  - Step 1: scan type shown (check-in / progress / completion)
  - Step 2: acquire GPS → `burnGeoStamp()` canvas overlay → `uploadToCloudinary()`
  - Step 3: submit `POST /api/task-logs`
  - Photos required only for completion scans
- `geoStamp.ts`: canvas overlay burns `Lat: X | Lng: Y | DD/MM/YYYY, HH:MM:SS` in bottom-right corner (semi-transparent black, white monospace)
- `cloudinary.ts`: unsigned upload; degrades to `FileReader.readAsDataURL()` stub if `VITE_CLOUDINARY_UPLOAD_PRESET` not set
- `WorkerLayout`: blue-700 top bar, fixed bottom nav
- **Fix:** `useRef<HTMLInputElement>(null)` React 18 returns `RefObject<HTMLInputElement | null>` → cast as `React.RefObject<HTMLInputElement>`
- **Fix:** Vite bundle 608KB single chunk → added `manualChunks` (vendor-react 164KB, vendor-qrscan 334KB, vendor-leaflet 149KB, vendor-qrgen 24KB)

### Step 6 — Attendance  
*(folded into Step 5 via `WorkerScan.tsx`)*

- `POST /api/scan/worker/:id` — creates/updates `attendance` record with GPS
- `isLate()` utility in `formatIST.ts`: compares check-in time against configurable `LATE_THRESHOLD_IST` (default 07:00 IST, stored as UTC offset)
- `WorkerScan.tsx` shows "On Time ✓" or "Late ⚠" badge with IST-formatted timestamp

### Step 7 — Commissioner Dashboard  
*Commit: `e2a5084`*

- `CommissionerLayout`: slate-900 top bar
- `StatusBadge`: colored pill for `not_started / in_progress / completed / verified`
- `LiveMap` (Leaflet):
  - Khammam center `[17.2478, 80.1514]`, zoom 13
  - `L.polyline` per stretch with `color_code` → Leaflet color
  - `L.circleMarker` at start/end points
  - Live vehicle marker from `last_vehicle_location` GeoJSON
  - `L.divIcon` pulse ring animation (`@keyframes pulse`) for vehicle position
  - `parseGeoJSON()` swaps coordinates (PostGIS stores [lng, lat], Leaflet needs [lat, lng])
  - Avoids default marker PNG (bundler issue) — uses `circleMarker` throughout
- `Dashboard.tsx`:
  - Date filter (default today), 30s auto-refresh with visual countdown
  - Left 2/3: map + stretch color legend
  - Right sidebar: stretch status cards, attendance % bar, verification counts (pending/approved/rejected), 20-item activity feed with photo thumbnails

### Step 8 — Verification Panel  
*Commit: `8cce788`*

- **Backend:** Added `GET /api/task-logs/verified` — verifier's own history filtered by `verified_by`, date range optional
- **Frontend:**
  - `VerifierLayout`: teal-800 top bar with Queue / History nav tabs
  - `Queue.tsx`: pending submissions oldest-first, photo thumbnail, colored stretch dot, flash message on return from review
  - `Review.tsx`: breadcrumb, meta card, side-by-side before/after photos (`Full size ↗` link), remark textarea, Approve (green) / Reject (red) — remark required for rejection; on submit navigates back to Queue with flash
  - `History.tsx`: table of own verifications with from/to date filter, decision pill, remark preview
- Fallback load in `Review.tsx`: if navigated directly (no `location.state`), fetches full pending queue and filters by ID

### Step 9 — Admin Panel Full CRUD + Reports  
*Commit: `558ffca`*

- **Backend fix:** `stretches.ts` PUT now updates GPS coordinates (was ignoring `start_lat/lng`, `end_lat/lng`)
- **Modal.tsx:** Added `size` prop (`sm` / `md` / `lg`) for wider CRUD forms
- **Stretches:** Table + modal (name, color, road name, start/end GPS lat/lng); status shown read-only
- **Vehicles:** Table + modal (reg number, driver, stretch dropdown); UNIQUE constraint violation surfaced as friendly message
- **Workers:** Table + modal (name, phone, stretch, role, status); QR badge PNG download link per row
- **Checkpoints:** Table grouped by stretch + modal (stretch dropdown, type, GPS); QR PNG download link; UNIQUE (stretch_id + type) error handled
- **Users:** Table + modal (name, email, password required on create / optional on edit, role, zone, worker link dropdown); email unique error handled
- **Reports:** 3 export cards (Task Logs / Attendance / Verifications), each with from/to date pickers and `⬇ Export CSV` button; `downloadBlob()` helper

### Step 10 — README, .env.example, Deployment Configs  
*Commit: `215f483`*

- `README.md`: features, tech stack table, default credentials, local dev walkthrough, Render + Netlify deployment guide, stretch state machine, API health check, timestamp note
- `.env.example`: added `NODE_ENV`, `PORT`, Cloudinary upload preset instructions
- `backend/render.yaml`: build command updated to run `node dist/utils/runMigrations.js` after `tsc`

---

## Bugs & Fixes

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | `DATABASE_URL` connection refused | `@` in password treated as URL delimiter | URL-encode `@` as `%40` |
| 2 | `ON CONFLICT DO NOTHING RETURNING` returned empty on re-seed | pgBouncer transaction mode returns empty for no-op inserts | INSERT then SELECT by name separately |
| 3 | `"could not determine data type of parameter $1"` | pgBouncer can't infer UUID type in UPDATE | Add `::uuid` cast to all UUID params |
| 4 | `app.listen()` blocked test imports | Server started at module load | Guarded with `if (require.main === module)` |
| 5 | `json2csv` alpha has no TS types | Package in alpha with missing declarations | Replaced with inline `toCSV()` helper |
| 6 | JWT `expiresIn` type error | `string` not assignable to `StringValue` | Cast as `any` |
| 7 | Vehicle UNIQUE constraint on seed re-run | Two vehicles assigned same stretch | Stretch 1 → `TS 24 BA 6647`, Stretch 2 → `TS 24 OJ 5578` |
| 8 | `RefObject<HTMLInputElement \| null>` type error | React 18 changed `useRef` return type | Cast as `React.RefObject<HTMLInputElement>` |
| 9 | Vite bundle 608KB single chunk warning | All deps in one chunk | `manualChunks` splits into 4 vendor chunks |
| 10 | Leaflet default marker PNGs missing | Bundler doesn't resolve marker assets | Use `L.circleMarker` + `L.divIcon` throughout |
| 11 | Render build failed in 19s | `NODE_ENV=production` caused `npm install` to skip devDeps (TypeScript, ts-node) | Changed to `npm install --include=dev` in build command |
| 12 | Stretches PUT ignored GPS updates | Backend route only updated name/color/road_name | Updated PUT to construct PostGIS `ST_MakePoint` expressions for start/end |
| 13 | Mobile: stretch never transitions to `in_progress` | `scan.tsx` called `/scan/checkpoint/:id` (context only) but never submitted a check-in task log | Added `taskLogsApi.submit({ scan_type: 'check-in' })` after successful start QR scan |
| 14 | Mobile: photos never uploaded to Cloudinary | `uploadApi.photo()` called `/upload` which doesn't exist on backend | Created `utils/cloudinary.ts` with direct unsigned upload; `upload.tsx` now uses it |
| 15 | Mobile: worker home showed all stretches | No filtering by assigned stretch | Fetch workers list, find current worker's `assigned_stretch_id`, filter stretch list |
| 16 | Mobile: `POST /users/push-token` 404 | Endpoint didn't exist | Added to `users.ts`; migration adds `expo_push_token` column |
| 17 | Mobile: physical QR stickers didn't open app | No Universal Link / App Link config | Intent filters in `app.json`; AASA + assetlinks.json on Netlify domain |
| 18 | Backend: photo URL validation rejected `file://` URIs | Zod `.string().url()` too strict | Changed to `.string().optional()` — allows any string, Cloudinary URLs in prod |
| 19 | Mobile: task-location screen didn't update after start QR scan | `useEffect([], [])` only runs on mount; returning from scan screen didn't trigger reload | Replaced with `useFocusEffect(useCallback(..., [stretchId]))` |
| 21 | `POST /api/task-logs` fails with "could not determine data type of parameter $7" | `taskStartedAt` can be null; pgBouncer can't infer timestamptz from null without explicit cast | Added `$7::timestamptz` cast in INSERT; also added `::uuid` casts to `verified_by` and `id` in verify UPDATE |
| 20 | Mobile: fingerprint prompt appeared on launch and blocked login | `_layout.tsx` called `tryBiometric()` (unawaited, result ignored) on every auth-state change; `login.tsx` also had a second biometric trigger | Removed all biometric code — password-only login for now |

---

## Test Results

### Step 3 — Auth Unit + HTTP Tests

All tests run via standalone TypeScript test scripts importing the Express app:

| Suite | Tests | Result |
|---|---|---|
| Auth unit (bcrypt, JWT sign/verify, isLate) | 21 | ✅ All pass |
| HTTP integration (login, protected routes, role guards) | 13 | ✅ All pass |

### Production End-to-End — 2026-06-14

All tests performed through `https://disa-qr-verify.netlify.app` (Netlify → Render → Supabase):

| Role | Login | Role-specific API | HTTP |
|---|---|---|---|
| `super_admin` | `admin@disa.gov` / `Admin@1234` | `GET /api/stretches` | 200 ✅ |
| `commissioner` | `commissioner@disa.gov` / `Comm@1234` | `GET /api/dashboard/live` | 200 ✅ |
| `verifier` | `verifier@disa.gov` / `Verify@1234` | `GET /api/task-logs/pending` | 200 ✅ |
| `field_worker` | `worker1@disa.gov` / `Worker@1234` | `GET /api/task-logs/my` | 200 ✅ |

Health check: `GET https://disa-qr-verify-api.onrender.com/health` → `{"status":"ok"}` ✅

---

## Deployment Log

### 2026-06-14 — GitHub

- Repository created: `dheeraj0906/disa-qr-verify` (public)
- `gh repo create disa-qr-verify --public --source=. --remote=origin --push`
- All 9 commits pushed to `master`

### 2026-06-14 — Netlify (Frontend)

- Site name: `disa-qr-verify`
- URL: **https://disa-qr-verify.netlify.app**
- CLI: `netlify-cli v26.1.0`
- Account: `nalidheerajsai01's team`
- Build: `npm run build` → `frontend/dist`
- Proxy rule added to `netlify.toml`:
  ```toml
  [[redirects]]
    from   = "/api/*"
    to     = "https://disa-qr-verify-api.onrender.com/api/:splat"
    status = 200
    force  = true
  ```
- No `VITE_API_URL` env var needed — frontend falls back to `/api`, Netlify proxies it to Render
- Auto-deploy on `master` push via GitHub connection

### 2026-06-14 — Render (Backend)

- Service name: `disa-qr-verify-api`
- URL: **https://disa-qr-verify-api.onrender.com**
- Plan: **Free** (sleeps after 15 min inactivity, ~30s cold start)
- Region: Singapore
- Service ID: `srv-d8msa2e7r5hc73a5boa0`
- Created via Render REST API (API key `rnd_ISpx...`)
- Root directory: `backend`
- Build command: `npm install --include=dev && npm run build && node dist/utils/runMigrations.js`
- Start command: `npm start`
- Auto-deploy on `master` push
- First deploy: `build_failed` (19s — `NODE_ENV=production` skipped devDeps)
- Second deploy: `live` ✅ — fixed with `--include=dev`

**Environment variables set on Render:**

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler URL (password `%40` encoded) |
| `JWT_SECRET` | Auto-generated by Render |
| `JWT_EXPIRES_IN` | `8h` |
| `CLOUDINARY_CLOUD_NAME` | `placeholder` (update when Cloudinary is configured) |
| `CLOUDINARY_API_KEY` | `placeholder` |
| `CLOUDINARY_API_SECRET` | `placeholder` |
| `FRONTEND_URL` | `https://disa-qr-verify.netlify.app` |
| `MUNICIPALITY_NAME` | `Khammam` |
| `LATE_THRESHOLD_IST` | `07:00` |
| `NODE_ENV` | `production` |

---

## Change Log

> New entries are prepended (newest first).

| Date | Description | Files Changed |
|---|---|---|
| 2026-06-17 | Full automated test sweep — backend API, auth guards, state machine, reject flow, QR, reports; documented in TESTING.md | `TESTING.md` |
| 2026-06-17 | Fix POST /api/task-logs pgBouncer type inference error — add ::timestamptz cast on $7 and ::uuid casts in verify UPDATE | `backend/src/routes/taskLogs.ts` |
| 2026-06-17 | Remove biometric auth from mobile app — fingerprint prompt was blocking login; password-only login for now | `mobile/src/app/_layout.tsx`, `mobile/src/app/(auth)/login.tsx` |
| 2026-06-16 | Bake Cloudinary + API env vars into EAS build profiles (preview + production) so APK has correct values without relying on local .env | `mobile/eas.json` |
| 2026-06-15 | Fix task-location screen not refreshing after returning from QR scan — replaced one-time useEffect with useFocusEffect so stretch status updates immediately when the worker comes back | `mobile/src/app/(worker)/task-location.tsx` |
| 2026-06-15 | Deep links: root layout intercepts Linking URLs and routes to scan/* screens; Android intent filters + iOS associatedDomains in app.json; AASA + assetlinks.json in frontend/public/.well-known; netlify.toml Content-Type header for AASA | `mobile/src/app/_layout.tsx`, `mobile/src/app/scan/_layout.tsx`, `mobile/src/app/scan/checkpoint/[id].tsx`, `mobile/src/app/scan/worker/[id].tsx`, `mobile/app.json`, `frontend/public/.well-known/apple-app-site-association`, `frontend/public/.well-known/assetlinks.json`, `frontend/netlify.toml` |
| 2026-06-15 | Push notifications: migration adds expo_push_token column; sendToVerifiers utility calls Expo push API; POST /users/push-token saves token; taskLogs POST fires push to verifiers on completion; relaxed photo URL validation to allow local URIs | `backend/migrations/002_push_tokens.sql`, `backend/src/utils/pushNotification.ts`, `backend/src/routes/users.ts`, `backend/src/routes/taskLogs.ts` |
| 2026-06-15 | GET /workers/me endpoint for current user's worker profile; mobile workersApi.me() in endpoints; worker home uses /me instead of fetching full list | `backend/src/routes/workers.ts`, `mobile/src/lib/endpoints.ts`, `mobile/src/app/(worker)/index.tsx` |
| 2026-06-15 | Cloudinary .env: mobile/.env + .env.example with EXPO_PUBLIC_* vars; .env added to mobile .gitignore; EAS build: improved eas.json with autoIncrement + submit profile; app.json extra.eas.projectId placeholder | `mobile/.env`, `mobile/.env.example`, `mobile/.gitignore`, `mobile/eas.json`, `mobile/app.json` |
| 2026-06-15 | Mobile app: fix check-in task log submission in scan screen (stretch state machine was broken), fix Cloudinary upload (replaced non-existent /upload endpoint with direct Cloudinary upload), fix worker home to show only assigned stretch, add before/after dual-photo upload UX, add worker history + attendance screens, add verifier history screen, add `verifiedBy()` endpoint, register all Stack screens in layouts, remove dead explore.tsx | `mobile/src/utils/cloudinary.ts`, `mobile/src/app/(worker)/scan.tsx`, `mobile/src/app/(worker)/upload.tsx`, `mobile/src/app/(worker)/index.tsx`, `mobile/src/app/(worker)/_layout.tsx`, `mobile/src/app/(worker)/history.tsx`, `mobile/src/app/(worker)/attendance.tsx`, `mobile/src/app/(verifier)/_layout.tsx`, `mobile/src/app/(verifier)/history.tsx`, `mobile/src/app/(admin)/_layout.tsx`, `mobile/src/lib/endpoints.ts` |
| 2026-06-14 | Extended CLAUDE.md with DEVLOG knowledge: tech stack rationale, seed data details, pgBouncer specifics, all 12 known bugs table, test coverage, full Render env vars | `CLAUDE.md` |
| 2026-06-14 | Rewrote CLAUDE.md as comprehensive project memory: full DB schema, all API endpoints with implementations, PostGIS conventions, type definitions, key patterns and gotchas, deployment notes | `CLAUDE.md` |
| 2026-06-14 | Fixed Render build command — `--include=dev` to keep TypeScript compiler when `NODE_ENV=production` | `backend/render.yaml` |
| 2026-06-14 | Added Netlify `/api/*` proxy redirect to Render backend | `frontend/netlify.toml` |
| 2026-06-14 | Step 10: README, updated `.env.example`, render.yaml runs migrations on build | `README.md`, `.env.example`, `backend/render.yaml` |
| 2026-06-14 | Step 9: Admin CRUD (Stretches, Vehicles, Workers, Checkpoints, Users) + CSV Reports; fixed Stretches PUT to update GPS; Modal size prop | `backend/src/routes/stretches.ts`, `frontend/src/components/Modal.tsx`, `frontend/src/pages/admin/*` |
| 2026-06-14 | Step 8: Verifier panel — queue, photo review, approve/reject, history; added `GET /task-logs/verified` backend route | `backend/src/routes/taskLogs.ts`, `frontend/src/components/VerifierLayout.tsx`, `frontend/src/pages/verifier/*` |
| 2026-06-14 | Step 7: Commissioner dashboard — Leaflet live map, stretch status cards, attendance and verification widgets, 30s auto-refresh | `frontend/src/components/{CommissionerLayout,LiveMap,StatusBadge}.tsx`, `frontend/src/pages/commissioner/Dashboard.tsx` |
| 2026-06-14 | Step 5: Mobile scan flow — QR scanner, deep-link handlers, geo+timestamp canvas, Cloudinary upload, task log submission, code-split chunks | `frontend/src/**` (Scan, TaskForm, History, geoStamp, cloudinary, WorkerLayout, vite.config.ts) |
| 2026-06-14 | Step 4: QR management UI, bulk generate, PDF export, AdminLayout, typed API client | `frontend/src/**` (QRManagement, QRCodeDisplay, AdminLayout, api/index.ts) |
| 2026-06-14 | Step 3: Auth verified (34 tests pass), replaced json2csv with inline CSV, decoupled app.listen | `backend/src/routes/{auth,reports}.ts`, `backend/src/middleware/auth.ts`, `backend/src/index.ts` |
| 2026-06-14 | Step 2: Fixed TS errors, idempotent seed, DB migration verified on Supabase | `backend/migrations/001_initial_schema.sql`, `backend/seeds/seed.ts`, all backend routes |
| 2026-06-14 | Step 1: Scaffold repo, CLAUDE.md, full backend route stubs, frontend shell | All files (initial scaffold) |
