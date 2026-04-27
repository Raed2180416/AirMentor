# Ngrok Connectivity Evaluation — College Demo (2026-04-27)

Time-boxed evaluation: ~75 minutes.

## Verdict

**RED. Do not promote ngrok for tomorrow's demo. Keep local frontend +
local backend as the primary path.**

## Setup discovered

- ngrok CLI: 3.31.0 (`/home/raed/.nix-profile/bin/ngrok`)
- Authtoken in `~/.config/ngrok/ngrok.yml` (redacted, never committed)
- Reserved ngrok domain: `<reserved-ngrok-domain>.ngrok-free.dev`
  (in `air-mentor-api/.env.tunnel`, gitignored)
- Existing scripts:
  - `@/home/raed/projects/air-mentor-ui/scripts/demo-local-tunnel.sh` — random domain, seeded backend
  - `@/home/raed/projects/air-mentor-ui/scripts/start-tunnel-stack.sh` — reserved domain, **points at Railway prod DB**
- `start-tunnel-stack.sh` is unsafe for the demo (it would expose real
  institutional Railway data through the tunnel). The seeded path is
  the only acceptable choice.

## What worked

- ngrok tunnel came up cleanly on the reserved domain.
  `https://<reserved-ngrok-domain>.ngrok-free.dev` resolves to the
  laptop backend over HTTPS.
- `GET /health` via ngrok returned `200 {"ok":true}`.
- CORS preflight (`OPTIONS /api/session/login` from
  `https://raed2180416.github.io`) returned `204` with proper
  `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials`.
- POST login from Pages origin to ngrok returned `200` and a JSON body
  with `sessionId` + `csrfToken`.
- Authenticated round-trip (login → proof-dashboard → role-context)
  succeeded **via curl** with a cookie jar.
- Active proof run reachable through ngrok:
  `sim_mnc_2023_first6_v1` / `active` / 30 checkpoints / sem 6.

## Why it is RED for tomorrow

The browser test (Playwright Chromium, headless) loaded the actual
`https://raed2180416.github.io/AirMentor/` and called the ngrok
backend with `credentials:'include'`:

```
healthFromBrowser     : { ok:true,  status:200 }
loginFromBrowser      : { ok:true,  status:200, sessionId, csrfToken }
cookiesAfterLogin     : []                                          ← BLOCKED
dashboardFromBrowser  : { ok:false, status:401, message:"Authentication required" }
roleContextFromBrowser: { ok:false, status:401 }
```

The login response succeeded but the browser **refused to store the
session cookie cross-site**. Backend emits the cookies as
`SameSite=Lax` even when the env vars are
`SESSION_COOKIE_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true`. The
running seeded server consistently downgrades to `Lax` (no `Secure`)
in actual HTTP responses, while an isolated `@fastify/cookie`
test-bench correctly produces `SameSite=None; Secure`. The exact
override path inside the seeded server pipeline was not identified
inside the time-box.

Browsers correctly drop `SameSite=Lax` cookies on cross-site
fetch/XHR responses. The result: every authenticated call from Pages
to ngrok returns 401. Sysadmin login, proof dashboard, teacher edit,
and HoD analytics all fail in the browser even though curl succeeds.

Artifact: `/tmp/airmentor-demo-logs/ngrok-cross-origin-summary.json`
records the full empirical browser test.

## What it would take to make ngrok GREEN

1. Fix the seeded-server cookie pipeline so `SameSite=None; Secure`
   actually lands on the wire when env requires it. (`@fastify/cookie`
   alone produces it correctly; the override is somewhere in the
   buildApp/session route stack.)
2. Add a runtime-configurable `VITE_AIRMENTOR_API_BASE_URL` (today it
   is build-time). Either redeploy Pages with the ngrok URL baked, or
   add a runtime config injection.
3. Add the ngrok domain to the backend's `CORS_ALLOWED_ORIGINS`
   allowlist so a Pages tab served via ngrok could ping back too.
4. Operationalise: GitHub repo variable
   `VITE_AIRMENTOR_API_BASE_URL=https://<reserved-ngrok-domain>.ngrok-free.dev`
   + redeploy Pages workflow.

None of this is risk-free inside the demo time window.

## Decision (locked-in)

- Primary path: `bash scripts/demo-start-backend.sh` +
  `bash scripts/demo-start-frontend.sh`, browser at
  `http://127.0.0.1:5173/`.
- GitHub Pages tab is a brochure only. The presenter explicitly says
  "API server runs on this laptop tonight; production-host decision
  is on the post-demo roadmap."
- ngrok is not started during the demo. It introduces a moving part
  whose cookie behavior we could not stabilise in 75 minutes.

## Reproducible artifacts

- Cross-origin browser test: `@/home/raed/projects/air-mentor-ui/scripts/_archive/pages-ngrok-cross-origin.mjs` (reference copy at `/tmp/airmentor-demo-logs/pages-ngrok-cross-origin.mjs`)
- ngrok screenshots: `@/home/raed/projects/air-mentor-ui/docs/demo/screenshots-2026-04-27/ngrok/`
- Summary JSON: `/tmp/airmentor-demo-logs/ngrok-cross-origin-summary.json`

## Acceptance

- [x] ngrok installed, configured, reserved domain reachable.
- [x] Backend health pass via localhost AND ngrok.
- [x] CORS preflight pass from Pages origin.
- [x] Browser end-to-end test executed from real Pages URL.
- [x] Cookie posture verified empirically.
- [x] No tokens or DB credentials committed (`.env.tunnel` already
      gitignored; CSRF secret not committed).
- [x] No real institutional data exposed (seeded ephemeral Postgres
      only; `start-tunnel-stack.sh` Railway path NOT used).
- [x] Local primary path verified live after ngrok teardown.

## What is live RIGHT NOW (2026-04-27 18:30 IST)

- Backend `http://127.0.0.1:4000` health → `{"ok":true}`
- Frontend `http://127.0.0.1:5173/` Vite serving the React bundle
- Active proof run: `sim_mnc_2023_first6_v1`, `status=active`,
  30 checkpoints, `activeOperationalSemester=6`
- Sysadmin sign-in lands on the System Admin Control Plane (verified
  via Playwright capture
  `@/home/raed/projects/air-mentor-ui/docs/demo/screenshots-2026-04-27/04-after-sysadmin-login.png`)
- Proof Control launcher modal exposes the active run (verified via
  `@/home/raed/projects/air-mentor-ui/docs/demo/screenshots-2026-04-27/06-system-admin-proof-control.png`)

To wake everything up tomorrow:
```
bash scripts/demo-start-backend.sh           # in terminal A
bash scripts/demo-start-frontend.sh          # in terminal B
node scripts/demo-bootstrap-proof.mjs        # idempotent — safe to re-run
```
Then open `http://127.0.0.1:5173/` and present.
