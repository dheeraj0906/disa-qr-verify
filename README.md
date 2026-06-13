# DISA QR Verify

Municipal sanitation task verification system built for **Khammam Municipal Corporation**. Field workers scan QR checkpoint markers with their phone cameras, upload geo-timestamped before/after photos, and a commissioner monitors progress live on a Leaflet map. Verifiers approve or reject completed tasks before a stretch is marked verified.

---

## Features

- **QR scan flow** — phone camera opens a deep link; no app install required
- **Geo-stamped photos** — canvas overlay burns GPS + IST timestamp before upload
- **4-tier roles** — super_admin → commissioner → verifier → field_worker
- **Live map dashboard** — Leaflet + OpenStreetMap, colour-coded stretch polylines, live vehicle marker with pulse ring
- **Attendance tracking** — worker badge scan at start of shift; configurable late threshold (default 07:00 IST)
- **Verification workflow** — approve / reject with remark; rejected stretches revert to in_progress
- **PDF QR sheet** — 2-column print-ready sheet of all checkpoint + worker badges
- **CSV exports** — task logs, attendance, and verifications with date-range filters

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Node.js 20 + Express 4 + TypeScript 5 |
| Database | PostgreSQL 17 + PostGIS (Supabase) |
| Auth | JWT (8 h expiry) + bcrypt |
| QR generation | `qrcode` (server PNG) |
| QR scanning | `html5-qrcode` (browser) |
| Photo storage | Cloudinary unsigned upload |
| PDF export | `pdfkit` |
| Frontend | React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 |
| Maps | Leaflet.js + OpenStreetMap |
| Validation | Zod |
| Rate limiting | express-rate-limit (100 req/15 min global; 10 req/min on scan routes) |

---

## Roles & Default Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| Super Admin | `admin@disa.gov` | `Admin@1234` | Full CRUD, QR management, all reports |
| Commissioner | `commissioner@disa.gov` | `Comm@1234` | Live map dashboard (read-only) |
| Verifier | `verifier@disa.gov` | `Verify@1234` | Approve / reject task submissions |
| Field Worker | `worker1@disa.gov` | `Worker@1234` | QR scan + photo upload on mobile |

> **Change all default passwords immediately after first login.**

---

## Local Development

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project with PostGIS enabled
- A [Cloudinary](https://cloudinary.com) account (free tier is sufficient)

### 1 — Clone and install

```bash
git clone https://github.com/your-org/disa-qr-verify.git
cd disa-qr-verify

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2 — Configure environment

```bash
# Backend
cp ../.env.example backend/.env
# Edit backend/.env — set DATABASE_URL, JWT_SECRET, CLOUDINARY_*, FRONTEND_URL

# Frontend
cp ../.env.example frontend/.env
# Edit frontend/.env — set VITE_API_URL, VITE_CLOUDINARY_*
```

**Database URL encoding** — if your Supabase password contains `@`, encode it as `%40`:
```
postgresql://postgres.ncpycfqvkhuweybivepf:my%40pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### 3 — Run migrations and seed

```bash
cd backend
npm run migrate   # creates schema + PostGIS extension
npm run seed      # inserts 4 stretches, 12 checkpoints, 4 workers, 4 default users
```

### 4 — Start dev servers

```bash
# Terminal 1 — backend (port 4000)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in as `admin@disa.gov / Admin@1234`.

Go to **Admin → QR Codes → Bulk Generate** to create QR payloads for all checkpoints and workers, then **Download PDF** to get the print sheet.

---

## Project Structure

```
disa-qr-verify/
├── backend/
│   ├── migrations/         # SQL migration files (001_initial_schema.sql)
│   ├── seeds/seed.ts       # Idempotent seed data
│   ├── src/
│   │   ├── index.ts        # Express app + rate limits + CORS
│   │   ├── middleware/     # auth (JWT), validate (Zod), errorHandler
│   │   ├── routes/         # auth, stretches, vehicles, checkpoints, workers,
│   │   │                   # users, qr, scan, task-logs, attendance, dashboard, reports
│   │   └── utils/          # db pool, formatIST, jwt helpers, runMigrations
│   └── render.yaml         # Render deployment config
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed Axios API client
│   │   ├── components/     # AdminLayout, CommissionerLayout, VerifierLayout,
│   │   │                   # WorkerLayout, LiveMap, StatusBadge, Modal, QRCodeDisplay
│   │   ├── context/        # AuthContext (JWT state in localStorage)
│   │   ├── pages/
│   │   │   ├── admin/      # Stretches, Vehicles, Workers, Checkpoints, Users,
│   │   │   │               # QRManagement, Reports
│   │   │   ├── commissioner/ # Dashboard (live map + widgets)
│   │   │   ├── verifier/   # Queue, Review (photo comparison), History
│   │   │   ├── worker/     # Scan (QR scanner), TaskForm, History
│   │   │   └── scan/       # Deep-link handlers (CheckpointScan, WorkerScan, VehicleScan)
│   │   ├── types/          # Shared TypeScript interfaces
│   │   └── utils/          # geoStamp (canvas overlay), formatIST, cloudinary upload
│   └── netlify.toml        # Netlify deployment config
├── .env.example            # All environment variables with descriptions
└── CLAUDE.md               # Full architecture reference (schema, routes, state machine)
```

---

## Deploying to Production

### Backend — Render

1. Push this repo to GitHub.
2. In [Render](https://render.com), create a new **Web Service** and connect your repo.
3. Set **Root Directory** to `backend`.
4. Render will detect `render.yaml` automatically — it sets the build and start commands.
5. Add the following **Environment Variables** in the Render dashboard:

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler URL (with `%40` for `@` in password) |
| `JWT_SECRET` | Long random string (min 32 chars) |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FRONTEND_URL` | Your Netlify URL, e.g. `https://disa-qr.netlify.app` |

> `render.yaml` runs `node dist/utils/runMigrations.js` at the end of each build, so the schema is always up to date before the new instance starts.

After first deploy, SSH into the Render shell and run:
```bash
node -e "require('ts-node').register(); require('./dist/seeds/seed')"
```
Or run locally pointing at the production `DATABASE_URL`:
```bash
cd backend && DATABASE_URL=<prod_url> npm run seed
```

### Frontend — Netlify

1. In [Netlify](https://netlify.com), create a new site and connect your repo.
2. Set **Base directory** to `frontend`, **Build command** to `npm run build`, **Publish directory** to `frontend/dist`.
   *(Or Netlify will pick these up from `frontend/netlify.toml` automatically.)*
3. Add the following **Environment Variables** in Netlify → Site settings → Environment variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | Your Render API URL + `/api`, e.g. `https://disa-qr-api.onrender.com/api` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Name of your **unsigned** upload preset |

**Creating the Cloudinary upload preset:**  
Cloudinary Dashboard → Settings → Upload → Upload presets → Add upload preset → Set signing mode to **Unsigned** → note the preset name.

4. Trigger a deploy. All React routes (`/*`) redirect to `index.html` via the `netlify.toml` redirect rule.

---

## Stretch State Machine

```
not_started
    │  [field worker scans Start checkpoint]
    ▼
in_progress
    │  [field worker scans Mid checkpoint — no state change]
    │
    │  [field worker scans End checkpoint + uploads before/after photos]
    ▼
completed  (verification_status = 'pending')
    │
    ├─ [verifier approves] ──► verified
    │
    └─ [verifier rejects + remark] ──► in_progress  (worker retries)
```

---

## API Health Check

```
GET /health
→ { "status": "ok" }
```

All other routes live under `/api/` and require a `Bearer <token>` header (except `POST /api/auth/login`).

---

## Timestamps

All timestamps are stored in UTC (`TIMESTAMPTZ`) and displayed in **IST (Asia/Kolkata, UTC+5:30)** using `Intl.DateTimeFormat`. The attendance late-check threshold (`LATE_THRESHOLD_IST=07:00`) is also interpreted in IST.
