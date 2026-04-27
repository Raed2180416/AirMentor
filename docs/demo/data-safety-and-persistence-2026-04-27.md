# Data Safety + Persistence — College Demo (2026-04-27)

## Storage layout (verified)

| Concern | Where it lives | Lifecycle |
|---|---|---|
| Demo proof run state (`simulation_runs`, checkpoints, projections, queue cases, attendance/marks shadows) | Embedded Postgres, `${TMPDIR}/airmentor-postgres-live-XXXXX` | Created on backend boot, **destroyed on process exit** (`persistent: false` in `air-mentor-api/scripts/start-seeded-server.ts`) |
| Real / institutional data | Railway Postgres at `yamanote.proxy.rlwy.net:36859/railway` (only used by `dev:railway-db` mode, **not** by the seeded demo path) | Persisted on Railway. Untouched by the seeded demo. |
| Seeded sysadmin / teacher / student rows | Reseeded into the embedded Postgres on every boot via `seedIntoDatabase` + `seedMsruasProofSandbox` | Ephemeral; rebuilt deterministically. |
| Frontend session/UI state | `localStorage` (admin UI route hash, theme), HTTP-only `airmentor_session` cookie | Cleared on logout or browser reset. Cookie tied to backend session row. |

## Why demo runs are local-only by construction

`AIRMENTOR_LOCAL_BACKEND_MODE=seeded` (the default in
`scripts/run-local-backend-for-testing.sh`) makes the backend launch
its own embedded Postgres on a random local port. The demo backend
never reads from or writes to the Railway production DB.

Demo data therefore cannot pollute actual data, because the connection
string the backend uses is a freshly-created
`postgres://postgres:postgres@127.0.0.1:<random>/postgres` URL, not
the Railway URL. Restarting the backend wipes the entire database
including all proof runs, seeded teachers, and edited evidence.

## What active proof run mode looks like

After bootstrap (see `/tmp/airmentor-demo-logs/probe/proof-dashboard-after-bootstrap.json`):

- `simulationRunId`: `sim_mnc_2023_first6_v1`
- `runLabel`: "MSRUAS first-6-semester proof batch"
- `status`: `active`, `lifecycleState`: `active`, `activeFlag`: 1
- `studentCount`: 120 (BTech Mathematics & Computing 2023 batch)
- `facultyCount`: 10 PROOF_FACULTY rows (mnc_t1 .. mnc_t10)
- `sectionCount`: 2 (A + B per semester)
- `semesterStart`: 1, `semesterEnd`: 6
- `checkpoints`: 30 (6 semesters × 5 stages)

## Refresh / relogin behavior (verified by walkthrough probe)

- `POST /api/session/login` returns `csrfToken` and sets
  `airmentor_session` cookie.
- After page refresh, `GET /api/session/refresh` (used by frontend boot)
  returns the same active role grant if the cookie is still valid.
- The active proof run is determined globally by
  `pickMostRecentActiveRun` in
  `air-mentor-api/src/lib/proof-active-run.ts` — it persists across
  browser sessions because it lives in DB rows, not in the browser.

## Reset / archive controls (audited)

- `POST /api/admin/proof-runs/:id/archive` — archives the active run.
  Demo: only invoke if you want to abandon the active run.
- Restart backend → wipes all run state. No safety prompt needed
  because the seeded backend is local-only.
- `POST /api/admin/proof-runs/:id/retry` — clones a failed run into a
  fresh queued attempt without touching the prior row.

## Caveats to call out on stage

1. There is no UI banner today that says "DEMO LOCAL PROOF RUN" because
   the seeded backend is the only configuration this branch ships.
   The truth is enforced at the connection layer (embedded Postgres),
   not at the UI badge layer. Talking point:

   > "Tonight's backend is an embedded local Postgres that lives in a
   > tempdir. Every run is gone the moment we shut the laptop. The
   > Railway database is not touched."

2. If the demo laptop has previously been pointed at the Railway
   backend (`dev:railway-db` mode), tomorrow's demo must explicitly
   stay in seeded mode — `scripts/demo-start-backend.sh` enforces
   `AIRMENTOR_LOCAL_BACKEND_MODE=seeded`.

3. There is no production-data path through the GitHub Pages build
   today either, because the Pages frontend points at the laptop
   loopback and Railway's prod backend is not in the CORS allow list
   for the demo build.

## Verification log

- Bootstrap probe: `/tmp/airmentor-demo-logs/probe/proof-dashboard-after-bootstrap.json`
- Six-semester walk artifact: `/tmp/airmentor-demo-logs/walk-v2/walk-summary.json`
- Edit + recompute round-trip: `/tmp/airmentor-demo-logs/edit/edit-recompute-summary.json`
- Backend log: `/tmp/airmentor-demo-logs/backend.log`

## Acceptance check (passed)

- [x] Demo proof runs do not write to Railway DB. Confirmed by reading
      `start-seeded-server.ts`: it allocates an in-process Postgres
      and overrides `DATABASE_URL` for the loaded config.
- [x] Active proof run survives refresh + relogin. Confirmed by
      walkthrough probe re-fetching `/api/admin/.../proof-dashboard`
      after re-authenticating.
- [x] Reset (backend restart) does not corrupt actual data. Trivially
      true: actual data is on Railway and the demo backend never
      opens that connection.
