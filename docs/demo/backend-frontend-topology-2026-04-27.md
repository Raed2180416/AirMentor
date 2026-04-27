# Backend / Frontend Topology — College Demo (2026-04-27)

Branch: `college-demo-2026-04-27`
HEAD: `681ffd99df037d8f6f5e48b0a23835d2c6fadc98`
Stack: laptop-local backend + (laptop-local frontend OR GitHub Pages frontend on the same laptop).

## Backend

- **Workspace**: `air-mentor-api/` (npm workspace `air-mentor-api`).
- **Default port**: `4000` on `127.0.0.1` (loopback only).
- **Mode**: `dev:seeded` — `tsx scripts/start-seeded-server.ts`. Boots an
  embedded PostgreSQL in `${TMPDIR}/airmentor-postgres-live-XXXXX`,
  applies all SQL migrations, seeds the MSRUAS proof sandbox.
- **Persistence**: ephemeral. Database is destroyed on process exit
  (seeded mode is `persistent: false`).
- **Boot command (canonical)**:
  ```bash
  AIRMENTOR_API_PORT=4000 \
  HOST=127.0.0.1 \
  CORS_ALLOWED_ORIGINS="http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173,https://raed2180416.github.io" \
  bash scripts/run-local-backend-for-testing.sh
  ```
- **Health**: `GET http://127.0.0.1:4000/health` → `{"ok":true}`.
- **Verified live**: `curl -fsS http://127.0.0.1:4000/health` returns
  `{"ok":true}` after migrations + seed complete.

## Frontend

- **Local dev**: `VITE_AIRMENTOR_API_BASE_URL=http://127.0.0.1:4000 npm run dev -- --host 127.0.0.1 --port 5173`.
  Equivalent shorthand: `npm run dev:local-backend`.
- **Local URL**: `http://127.0.0.1:5173/` (Vite serves `index.html` immediately).
- **GitHub Pages URL**: `https://raed2180416.github.io/AirMentor/`
  (deployed by `.github/workflows/deploy-pages.yml` from `main`).
- **API base**:
  - Local laptop: `VITE_AIRMENTOR_API_BASE_URL=http://127.0.0.1:4000`
    (matches `npm run dev:local-backend`).
  - GitHub Pages on same laptop: needs the same value baked at build
    time (or via repo `vars.VITE_AIRMENTOR_API_BASE_URL`). Today the
    Pages build uses whatever variable is set in the repo settings; on
    the demo laptop the only origin Pages can reach is `127.0.0.1:4000`
    served by the same machine, which mixed-content-blocks because
    Pages is `https`. Fallback below.

## CORS

`air-mentor-api/src/config.ts` parses `CORS_ALLOWED_ORIGINS` (CSV) and
defaults to localhost:5173/4173. The `run-local-backend-for-testing.sh`
helper uses the env var supplied above. For tomorrow's demo we add the
GitHub Pages origin so a Pages tab can hit the loopback backend through
the localhost-tunnel fallback (see below).

## What works (verified 2026-04-27)

- `curl http://127.0.0.1:4000/health` → `{"ok":true}`.
- `curl http://127.0.0.1:5173/` → Vite-served HTML, React boot, `@vite/client` connected.
- `POST /api/session/login` with `sysadmin/admin1234` → 200, sets
  `airmentor_session` + `airmentor_csrf` cookies.
- `GET /api/admin/batches/batch_branch_mnc_btech_2023/proof-dashboard`
  → 200 with active run `sim_mnc_2023_first6_v1`, 30 stage checkpoints.
- `POST /api/admin/proof-runs/<id>/activate-semester` for semesters
  1..6 → 200.
- HoD analytics 7/7 endpoints respond 200 once role is switched to HOD
  via `POST /api/session/role-context`.
- Teacher attendance edit `PUT /api/academic/offerings/<id>/attendance`
  → 200; `POST /api/admin/proof-runs/<id>/recompute-risk` → 200; risk
  score moved 0.6257 → 0.633 for the same student (medium → medium
  band, prob increased after attendance dropped from 28/32 → 12/32).

## What does NOT work today

- **GitHub Pages → loopback laptop backend** is blocked by browser
  mixed-content. Pages is served over HTTPS; `http://127.0.0.1:4000`
  is plain HTTP. Browsers block this for non-secure-context API
  candidates. Confirmed by inspecting `src/startup-diagnostics.ts`
  rule `HTTPS_PAGE_REQUIRES_HTTPS_API`.
- **Local Postgres in seeded mode is ephemeral**. Restarting the
  backend wipes proof runs and seeded teachers. This is intentional
  for the demo (clean state every time) but means we cannot rely on
  Pages reading the state across restarts.
- **Railway-shared backend is currently the prod target** but its
  outbound URL has unstable performance for live demos and we are not
  migrating hosting tonight.

## Demo path of record

PRIMARY PATH (use this on stage):

1. Run `bash scripts/demo-start-backend.sh` on the demo laptop. It
   boots seeded backend on `127.0.0.1:4000`, prints health URL, prints
   allowed origins, prints active proof run ID.
2. Run `npm run dev:local-backend` (or `bash scripts/demo-start-frontend.sh`)
   in a second terminal. It boots Vite at `http://127.0.0.1:5173/`.
3. Open the demo browser at `http://127.0.0.1:5173/`.

FALLBACK A (offline laptop, no internet):
- Use the local frontend exactly as PRIMARY. GitHub Pages is not used.

FALLBACK B (Pages must be shown):
- Open the GitHub Pages URL. Acknowledge the browser's mixed-content
  block by saying "GitHub Pages is the static frontend; tomorrow's
  demo runs the API on the same laptop because the build is local-first."
- Then switch the browser to `http://127.0.0.1:5173/` and continue.

EMERGENCY:
- Backend won't boot → `pkill -f tsx; pkill -f vite; bash scripts/demo-start-backend.sh`.
- Pages tab cannot reach API → close the Pages tab, open the local frontend.

## Files of record

- `vite.config.ts` — `pagesBase` from `GITHUB_REPOSITORY`, manual chunk split.
- `src/api-connection.ts` — `useApiConnectionTarget` polls health and
  picks first healthy candidate from primary + fallback CSV list.
- `air-mentor-api/scripts/start-seeded-server.ts` — embedded postgres + auto seed.
- `scripts/run-local-backend-for-testing.sh` — runner shim for the seeded server.
- `scripts/demo-start-backend.sh` — single-command demo wrapper (added today).

## Reproducibility

Snapshot at `/tmp/airmentor-college-demo-safety-20260427T112503Z`
contains pre-branch git status, full diff, untracked tarball.

This is enough to roll back the demo branch to its starting state if
anything goes wrong on stage.
