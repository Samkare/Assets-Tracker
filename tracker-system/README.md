# IT Asset Tracker — Production System

Full-stack internal tool for Task Source's IT fleet. Self-hosted, single Node process, SQLite.

- **Backend:** Node + Express + better-sqlite3 (server-side sessions, bcrypt, RBAC)
- **Frontend:** Vite + React + react-query (ported from the original prototype)
- **Features:** persistent CRUD, auth + roles (Admin / IT-Manager / Viewer), Excel import/export, persistent audit log

## Layout

```
tracker-system/
├─ shared/   one source of truth: constants, asset logic, zod validation
├─ server/   express API + SQLite (data/app.db)
└─ client/   Vite React app (built to client/dist, served by express in prod)
```

## First-time setup

```bash
cd tracker-system
copy .env.example .env        # then edit SESSION_SECRET + BOOTSTRAP_ADMIN_PASSWORD
npm install
npm run seed                  # migrate + load ~166 assets from ../uploads/parsed-rows.json
```

The seed prints the **bootstrap admin** (default `santosh@belgiumdia.com`). All seeded accounts
start with a temporary password and are forced to set a new one on first login.

| User | Role | Temp password |
|------|------|---------------|
| santosh@belgiumdia.com (bootstrap) | Admin | from `BOOTSTRAP_ADMIN_PASSWORD` |
| santosh@tasksource.io | Admin | `Welcome!2026` |
| sachin@tasksource.io, mahendra@tasksource.io | IT-Manager | `Welcome!2026` |

## Run

**Development** (Vite HMR on :5173, API on :3000, `/api` proxied):
```bash
npm run dev
```

**Production** (one port, express serves the built client):
```bash
npm run build                 # vite build -> client/dist
npm start                     # NODE_ENV=production, http://localhost:3000
```

> In production the session cookie is `secure` — serve over HTTPS (reverse proxy) or the
> browser will drop it. For plain-HTTP LAN use, run without `NODE_ENV=production`.

## Roles (RBAC)

| Action | Viewer | IT-Manager | Admin |
|--------|:------:|:----------:|:-----:|
| View assets / depts / audit / reports | ✓ | ✓ | ✓ |
| Create / edit / delete / repair assets | | ✓ | ✓ |
| Employee CRUD, Excel import | | ✓ | ✓ |
| Department CRUD, user management | | | ✓ |

Enforced server-side (middleware); the UI also hides controls by role.

## Excel import / export

- **Export:** Assets page → *Export* (rebuilds the original A–R column layout — round-trip safe).
- **Import:** Assets page → *Import* → pick `.xlsx` → review the dry-run preview
  (new / updated / duplicates / errors) → *Apply*. Duplicate asset tags collapse last-write-wins,
  preferring the richer assigned record.

## Operations (Windows)

**Run as a service — [nssm](https://nssm.cc):**
```powershell
nssm install ITAssetTracker "C:\Program Files\nodejs\node.exe" "E:\...\tracker-system\server\src\index.js"
nssm set ITAssetTracker AppDirectory "E:\...\tracker-system"
nssm set ITAssetTracker AppEnvironmentExtra NODE_ENV=production PORT=3000
nssm start ITAssetTracker
```

**Nightly backup — Task Scheduler (run once, elevated cmd):**
```
schtasks /create /tn "ITAssetTracker-Backup" /tr "\"E:\Automations\IT Department\IT Assets Tracker\tracker-system\backup.bat\"" /sc daily /st 02:00 /f
```
`backup.bat` runs `server/scripts/backup-db.js` → writes `data/backups/app-<timestamp>.db`
(keeps last 30) via WAL-safe SQLite online backup. Also keep an **offsite copy** of the
newest file (e.g. `robocopy data\backups \\NAS\itat\backups /mir`).

**Restore from a backup:**
1. Stop the server (close the start.bat window).
2. In `tracker-system/data/`: delete the live sidecars `app.db-wal` and `app.db-shm`
   (stale WAL would otherwise overwrite the restored data on next open).
3. Copy the chosen backup over the live DB: `copy /y data\backups\app-<ts>.db data\app.db`.
4. `npm run migrate` (brings an older snapshot up to the current schema).
5. Start the server; verify `GET /api/health` is 200 and the Dashboard counts look right.

Do a **restore drill quarterly** so the process is known-good before you actually need it.

**HTTPS:** front with Caddy/IIS reverse proxy to `localhost:3000`; then the `secure` cookie works.
Restrict the host firewall to the LAN + the one port.

## Testing

`npm test` — node:test integration suite (auth, CSRF, RBAC, asset CRUD + audit, soft-delete,
password policy). Runs against a throwaway temp DB; no setup needed.

## Security notes

- Helmet CSP enabled (same-origin; `style-src` allows inline for React styles). bcrypt-12, server-side
  sessions, CSRF header on all mutations, RBAC enforced server-side, account lockout (5 fails / 15 min),
  password policy (10+ chars, mixed case + digit), audit on every mutation. Prod refuses to boot with the
  default `SESSION_SECRET`.
- **Known transitive advisory (accepted):** `exceljs → uuid@8` (GHSA-w5hq-g745-h8pq). The flaw is in
  uuid's `v3/v5/v6` buffer path; exceljs uses only `v4` (random), so it is **not reachable** in this app.
  Forcing uuid@11 conflicts with exceljs's pin; revisit when exceljs updates.
- `esbuild`/`shell-quote` advisories are **Vite dev-chain only** — not present in the production bundle.

## Notes

- The dev-only "Tweaks" panel (accent/zebra/tilt) is stripped from production builds.
- Heavy pages (Repairs/Software/Consumables/Inventory/Alerts/Trends) are code-split (lazy-loaded).
