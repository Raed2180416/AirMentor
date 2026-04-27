# Local Backend Startup — College Demo (2026-04-27)

## Single command (canonical)

```
bash scripts/demo-start-backend.sh
```

What it does:
- exports demo-safe env vars (`AIRMENTOR_LOCAL_BACKEND_MODE=seeded`,
  `AIRMENTOR_API_PORT=4000`, `HOST=127.0.0.1`),
- adds the GitHub Pages origin to `CORS_ALLOWED_ORIGINS`,
- backgrounds the seeded server through
  `scripts/run-local-backend-for-testing.sh`,
- waits up to 90 seconds for `/health` to return `{"ok":true}`,
- prints the next-step instructions.

Refuses to start if port `4000` is already bound; if the existing
process answers `/health`, the script exits 0 quietly so the presenter
can keep using it.

## Frontend companion

Second terminal:
```
bash scripts/demo-start-frontend.sh
```

Equivalent shorthand:
```
npm run dev:local-backend
```

Either approach starts Vite at `http://127.0.0.1:5173/` with
`VITE_AIRMENTOR_API_BASE_URL=http://127.0.0.1:4000`.

## Bootstrap an active proof run (idempotent)

```
node scripts/demo-bootstrap-proof.mjs
```

If a healthy active run with checkpoints already exists, the script
exits without changes. Otherwise it runs:

1. POST `/api/session/login` (`sysadmin / admin1234`)
2. POST `/api/admin/batches/<batchId>/proof-imports` (if needed)
3. POST `/api/admin/proof-imports/<id>/validate` + `/approve`
4. POST `/api/admin/proof-runs/<run>/recompute-risk` (to materialise
   checkpoints from the seeded baseline)
5. POST `/api/admin/batches/<batchId>/proof-runs` with `activate: true`
   (if the prior step did not yield checkpoints)
6. polls the dashboard for up to 6 minutes for checkpoints to appear.

## Health checks

| Check | Command | Expected |
|---|---|---|
| Backend | `curl -fsS http://127.0.0.1:4000/health` | `{"ok":true}` |
| Frontend | `curl -fsS http://127.0.0.1:5173/` | starts with `<!doctype html>` |
| Active proof run | `node scripts/demo-bootstrap-proof.mjs` | `[bootstrap] active run already healthy: sim_mnc_2023_first6_v1 status=active checkpoints=30` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Port 4000 in use, presenter wants a clean restart | `lsof -ti :4000 \| xargs -r kill -9` then re-run `scripts/demo-start-backend.sh` |
| Port 5173 in use | `lsof -ti :5173 \| xargs -r kill -9` then re-run `scripts/demo-start-frontend.sh` |
| Embedded Postgres complains about `databaseDir` | The seeded server allocates `${TMPDIR}/airmentor-postgres-live-XXXXXX`; clear `/tmp` of stale dirs if disk pressure forced cleanup |
| `/health` returns 503 | Tail `/tmp/airmentor-demo-logs/backend.log`; usually a migration ordering log line. Restart fixes it. |
| Stage activation 200 but UI shows stale state | Refresh the browser (`Cmd-R` / `Ctrl-R`); the UI re-derives the bootstrap on every load. |
| Mixed-content block on Pages | Use the local frontend (`http://127.0.0.1:5173/`). Pages is a fallback. |

## Fallback ladder

1. Local frontend + local backend (default).
2. Vite preview build (`npm run build && npm run preview`) + local backend.
3. GitHub Pages frontend on the same laptop + local backend (only if
   the audience explicitly asked to see the live URL — otherwise skip).
4. If backend fails entirely, restart laptop and re-run
   `scripts/demo-start-backend.sh`. Embedded Postgres is fully clean
   on every boot.

## Verification log (2026-04-27)

```
$ bash scripts/demo-start-backend.sh
[demo] backend pid=... log=/tmp/airmentor-demo-logs/backend.log
[demo] backend ready after Ns
$ curl -fsS http://127.0.0.1:4000/health
{"ok":true}
$ node scripts/demo-bootstrap-proof.mjs
[bootstrap] sysadmin login ok
[bootstrap] active run already healthy: sim_mnc_2023_first6_v1 status=active checkpoints=30
```
