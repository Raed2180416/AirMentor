# Stage 10 — Demo-Day Runbook

Dated: 2026-04-23.
Branch: `promote-proof-dashboard-origin` (HEAD: `876a4e48`).
Target: tomorrow's pilot demo — GitHub Pages frontend reaching a
local-machine backend through an ngrok HTTPS tunnel. Railway stays
wired and untouched so production flip-over is a one-variable change.

---

## TL;DR for the presenter

Three shells, in this order:

```
# shell 1 — demo backend + ngrok tunnel
bash scripts/demo-local-tunnel.sh

# shell 2 — optional: local frontend at http://127.0.0.1:5173 pointed at local backend
VITE_AIRMENTOR_API_BASE_URL=http://127.0.0.1:4000 npm run dev

# shell 3 — sanity probes during the demo
bash scripts/demo-role-smoke.sh
```

To make the **live Pages site** hit the local backend:

1. Copy the HTTPS URL printed by `demo-local-tunnel.sh`.
2. Open https://github.com/Raed2180416/AirMentor/settings/variables/actions
3. Set `VITE_AIRMENTOR_API_BASE_URL` to that HTTPS URL.
4. Trigger the `Deploy to GitHub Pages` workflow (Actions tab → Run workflow).
5. Open `https://raed2180416.github.io/AirMentor/` once the deploy finishes.

When you're done, stop the tunnel with Ctrl+C, then flip the repo variable
back to `https://api-production-ab72.up.railway.app` and re-deploy Pages
for normal production posture.

---

## Environment the demo relies on

| Variable | Value used | Set where |
|---|---|---|
| `AIRMENTOR_API_PORT` | `4000` | `demo-local-tunnel.sh` |
| `HOST` | `127.0.0.1` | `demo-local-tunnel.sh` |
| `CORS_ALLOWED_ORIGINS` | `https://raed2180416.github.io,http://127.0.0.1:5173,http://localhost:5173` | `demo-local-tunnel.sh` |
| `SESSION_COOKIE_SAME_SITE` | `none` | `demo-local-tunnel.sh` (cross-origin Pages) |
| `SESSION_COOKIE_SECURE` | `true` | `demo-local-tunnel.sh` |
| `CSRF_SECRET` | `airmentor-demo-<epoch>-csrf` | `demo-local-tunnel.sh` |
| `AIRMENTOR_SEED_NOW` | `2026-03-16T00:00:00Z` | `demo-local-tunnel.sh` |
| `AIRMENTOR_STAGE_REALIZATION_V1` | `1` | `demo-local-tunnel.sh` — **must stay on** |
| `AIRMENTOR_SECTION_OVERRIDES_V1` | `1` | `demo-local-tunnel.sh` — Track C overrides demo |
| `VITE_AIRMENTOR_API_BASE_URL` | ngrok HTTPS URL | GitHub Actions repo variable |

All of the above live in one place per environment (the tunnel script for
local, GitHub Actions repo variables for Pages build). Do not hard-code
them in source files.

---

## Seeded role credentials

| Role | Identifier | Password | facultyId |
|---|---|---|---|
| System Admin | `sysadmin` | `admin1234` | `fac_sysadmin` |
| HoD | `devika.shetty` | `faculty1234` | `mnc_t1` |
| Course Leader | `rohit.menon` | `faculty1234` | `mnc_t2` |
| Mentor | `harish.bhat` | `faculty1234` | `mnc_t8` |

Student login is not provisioned on the seeded backend. Student-facing
surfaces (risk explorer, student shell) are driven by the HoD / Course
Leader / Mentor sessions through scoped impersonation-style routes
(proof-access only, no mutation).

Source of truth: `@/home/raed/projects/air-mentor-ui/tests-e2e/helpers/login-as.ts:1-34`.

---

## Demo-day feature tour (recommended order)

### 1. Proof run activation (System Admin)
- Log in as `sysadmin`.
- Navigate to the sysadmin proof dashboard.
- Confirm:
  - batch `Proof MNC 2023`, 120 students, sections A/B
  - current semester pinned via `AIRMENTOR_SEED_NOW`
  - proof run ID visible and `active`
  - queue / worker states show green
- This is the narrative anchor: the rest of the demo explains what this
  run is computing.

### 2. HoD analytics + drivers (HoD)
- Log in as `devika.shetty`.
- Open HoD proof analytics.
- Tabs to demo:
  - **Overview** — students, high/medium watch counts, open reassessments.
  - **Course Hotspots** — per-course risk concentration.
  - **Faculty Operations** — load + overload flags.
  - **Reassessment Audit** — per-run audit trail with acknowledge/resolve.
  - **Counterfactual Impact** (new this session — Stage 10) — see #6.
- Drill-down: pick a high-watch student, verify driver chips now appear
  on checkpoint course snapshots (commit `88f1da3e` fix).

### 3. Intervention effect realization (HoD + Course Leader)
- From the HoD queue, open a checkpoint-bound student case.
- Note the `pre-tt1` / `post-tt1` marks + recommended action.
- Apply a targeted intervention via the student case detail drawer
  (remedial plan / mentor meeting / targeted tutoring).
- Advance to `post-tt2`.
- Show:
  - the student's tt2 marks have moved vs the baseline trajectory
  - the recommended-action chip now renders a humanised label
    (no raw `targeted_remedial_plan` strings — commit `b5077aa0`/humaniser)
  - HoD audit trail records a `stage-realization-applied` entry.

### 4. Section-override demo (System Admin)
- Sysadmin → proof run setup panel (or direct API for speed):
  - Set `sectionOverridesJson` on the active run, e.g.
    ```json
    {
      "A": { "consistencyBias": 0.05 },
      "B": { "consistencyBias": -0.10, "interventionReceptivityBias": -0.05 }
    }
    ```
- Re-advance the stages (or create a new run with this override).
- Show HoD section-level risk distribution now matches expectation:
  section B more high-watch, section A better consistency.
- Flag: gated by `AIRMENTOR_SECTION_OVERRIDES_V1=1` — the tunnel
  script pins this.

### 5. Risk Explorer transparency (HoD or Course Leader)
- Open Risk Explorer for one high-watch student.
- Show:
  - `modelVersion` + `calibrationVersion` banner (already live)
  - Top observable drivers
  - No-action comparator + counterfactual lift
  - Advanced tab: policy candidates now render humanised labels
    (commit `b5077aa0`)

### 6. Counterfactual impact panel (HoD) — NEW
- Seed/identify a **baseline run** (`AIRMENTOR_STAGE_REALIZATION_V1=0`)
  and a **realized run** (`AIRMENTOR_STAGE_REALIZATION_V1=1` + interventions
  applied) for the same seeded cohort. Both run IDs are visible in the
  sysadmin proof dashboard.
- Navigate to:
  ```
  https://<pages-or-local>/#/app?counterfactualBaseline=<baseline-run-id>
  ```
  while logged in as HoD, on the department page.
- Pick the new **Counterfactual Impact** tab.
- Show:
  - 6-scalar aggregate strip (TT1/TT2/Quiz/Assignment/SEE/Total) with
    mean + median + positive/negative/zero counts per scalar
  - Top-movers list sorted by sum-of-absolute-deltas
  - "Download full counterfactual JSON" button for post-demo artifact

If no baseline param is in the URL, the tab shows a clear empty-state
message — it never crashes the HoD page.

Endpoint behind it:
```
GET /api/academic/hod/proof-counterfactual
    ?runIdBaseline=simulation_run_...
    &runIdRealized=simulation_run_...
```
Auth: `SYSTEM_ADMIN` or `HOD` with `evaluateFacultyContextAccess` pass.
400 on same-run ids.

### 7. Course Leader and Mentor flows (round-robin)
- Course Leader dashboard:
  - proof-scoped offerings tile now shows humanised action labels at
    the meta line (commit `b5077aa0`)
  - priority alert cards no longer leak raw action codes
- Mentor mentees list:
  - open a mentee detail, show intervention timeline humanised
  - faculty profile monitoring queue row humanised

### 8. Sysadmin queue preview (System Admin)
- Sysadmin proof dashboard → checkpoint queue preview card
- Show: `action <humanised label>` instead of raw code
  (commit `b5077aa0`, `system-admin-proof-dashboard-workspace.tsx:875`)

---

## What NOT to touch on demo day

- `.github/workflows/deploy-pages.yml`, `.github/workflows/deploy-railway-api.yml`
- `scripts/verify-final-closeout-live.sh`
- Any `AIRMENTOR_LIVE_*` credential — live-verify mode requires a real
  sysadmin pair and will refuse to fall back to seeded creds.
- Pipeline orchestrator files — the pipeline is used for background agent
  automation and is not a demo surface.

---

## Smoke / sanity probes while demo is hot

After `demo-local-tunnel.sh` reports "backend healthy":

```bash
# health
curl -sf http://127.0.0.1:4000/health

# sysadmin login (round-trip cookie + CSRF probe)
curl -sf -c /tmp/amc.jar -b /tmp/amc.jar \
  -X POST http://127.0.0.1:4000/api/session/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"sysadmin","password":"admin1234"}'

# restore
curl -sf -b /tmp/amc.jar http://127.0.0.1:4000/api/session

# logout
CSRF="$(jq -r '.csrfToken' <<<"$(curl -sf -b /tmp/amc.jar http://127.0.0.1:4000/api/session)")"
curl -sf -b /tmp/amc.jar -X POST -H "X-AirMentor-CSRF: ${CSRF}" \
  http://127.0.0.1:4000/api/session/logout
```

`scripts/demo-role-smoke.sh` wraps this across all 4 seeded roles.

---

## Rollback to Railway (after demo)

```bash
# 1. Ctrl+C the tunnel script
# 2. Restore the Pages build variable back to Railway:
#    https://github.com/Raed2180416/AirMentor/settings/variables/actions
#    VITE_AIRMENTOR_API_BASE_URL=https://api-production-ab72.up.railway.app
# 3. Trigger 'Deploy to GitHub Pages' workflow again.
# 4. Verify:
bash scripts/check-railway-deploy-readiness.mjs
```

Deploy-env contract details stay authoritative at
`@/home/raed/projects/air-mentor-ui/docs/closeout/deploy-env-contract.md`.

---

## Known open items (deliberately deferred past demo)

Tracked in `@/home/raed/projects/air-mentor-ui/audit-map/32-reports/ml-risk-ui-audit.md`:

1. HoD bundle `modelVersion` / `calibrationVersion` banner (F2) —
   finding is visible but UI surface omits the two strings. Demo workaround:
   those values are present on Risk Explorer; point there if asked.
2. Checkpoint queue + student-shell assessment driver preservation (F3, F5) —
   HoD drilldown fix landed (`88f1da3e`); checkpoint queue projection still
   emits `drivers: []` for dashboard cards. Low priority — cards still
   show risk band + probability + humanised action label.

All other ML-audit findings (F4, F6, F7, F8) are either closed or
already-live. Reference the audit doc for full status + acceptance tests.

---

## Commit range covered by this runbook

```
876a4e48 feat(proof): wire HoD counterfactual panel through App loader chain
74470210 feat(proof): HoD counterfactual panel component + API client method
88f1da3e fix(proof): preserve observableDrivers on HoD checkpoint course snapshots
<hash>   feat(demo): humanise action-codes across UI + counterfactual API + demo tunnel
<hash>   docs(closeout): stage-09 fresh-sem1 realization consolidation
b5077aa0 docs(audit): ML-risk-UI audit — strip worktree-prefixed paths
a0f01da1 feat(proof): Phase-11 counterfactual reader pure module + 10 tests
91798553 test(e2e): Track D Flow Specs 3, 4, 5 frozen contracts
82105676 feat(proof): Track C Phase 2b extract wire helper to standalone module + 10 tests
8d1e315d feat(proof): Track C Phase 2 wire section-override applier into trajectory build
7717a273 feat(proof): Track C Phase 1b sectionOverridesJson column + migration
8bdda2a5 feat(proof): Track C Phase 1a section-override-applier pure module
af1eed23 fix(pipeline): round-9 put exit-contract at end of prompt
```
