# Browser E2E Realism Audit — 2026-04-29

## Intent And Feature Intent

吾驗意圖：AirMentor must feel real to an average faculty/admin user, not merely return JSON.

Feature intent checked:

- The proof dashboard must expose the active six-semester run without stale inactive state.
- Role sessions must restore and switch correctly.
- HoD and teacher workflows must be scoped to real grants.
- Browser demo must not hide API failures behind pretty UI.
- No fake probability, no future evidence leak, no missing evidence treated as certain failure.

## Method

Browser automation could not run in this workstation because no Chrome/Chromium binary exists.

Evidence:

- Playwright MCP error: Chrome not found at `/opt/google/chrome/chrome`.
- Puppeteer MCP error: Chrome `131.0.6778.204` missing under `/home/raed/.cache/puppeteer`.
- `npx playwright install chrome` attempted but blocked on `sudo` password; process was stopped.
- Local backend listening on `127.0.0.1:4000`.
- Local Vite frontend listening on `127.0.0.1:5173`.
- API full-walk artifact: `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/walk-summary.json`.
- API precision artifact: `/tmp/airmentor-demo-logs/realism-2026-04-29/precision/precision-summary.json`.

Read-first anchors:

- `tests-e2e/helpers/login-as.ts:10-15` defines seeded HoD credential intent.
- `tests-e2e/helpers/login-as.ts:75-89` switches to the requested active role grant.
- `air-mentor-api/src/modules/academic-proof-routes.ts:66-248` defines HoD proof analytics routes and role gates.
- `air-mentor-api/src/modules/session.ts:39-88` builds session payload and synchronizes CSRF/session cookies.
- `air-mentor-api/src/config.ts:75-115` defines local/production cookie and origin posture.

## Browser Evidence Matrix

| Flow | Browser status | API substitute | Result | Realism note |
|---|---|---:|---|---|
| Open app shell | Blocked: Chrome missing | Vite process listening | Partial | UI render not proven. |
| Sysadmin login | Blocked: Chrome missing | `/api/session/login` 200 | Pass API | Cookie/CSRF issued. |
| Active proof dashboard | Blocked: Chrome missing | dashboard JSON captured | Pass after recompute | Initial checkpoint list was empty before recompute. |
| Six-semester walk | Blocked: Chrome missing | 6 semester activations 200 | Pass API | 30 checkpoints present after recompute. |
| HoD analytics | Blocked: Chrome missing | HoD role switch then endpoints 200 | Pass API | Must switch from COURSE_LEADER to HOD. |
| Teacher course scope | Blocked: Chrome missing | teacher bootstrap checks | Partial | Course leader sees two courses; mentor sees zero courses. |
| Counterfactual simulator | Blocked: Chrome missing | HoD + `runId` endpoint 200 | Pass API | Earlier 400 was missing `runId`. |
| Console errors | Not run | none | Unknown | Must rerun with Chrome. |
| Visual stale data | Not run | API says active run `sim_mnc_2023_first6_v1` | Unknown | UI state not proven. |
| Accessibility/keyboard | Not run | none | Unknown | Must rerun with Chrome. |

## Findings

1. Browser runtime is the current hard blocker for true E2E proof.

The machine lacks Chrome/Chromium for both Playwright MCP and Puppeteer MCP. This is not a product defect, but it prevents a defensible final browser-demo claim.

2. API proof-plane is alive after recompute.

The final dashboard artifact reports `checkpointCount=30`, with every expected semester/stage key present: `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.

3. Initial dashboard state can be misleading before recompute.

The first full-walk dashboard artifact had `checkpointCount=0`. After `/api/admin/proof-runs/:runId/recompute-risk`, the final dashboard had 30 checkpoints. Demo runbook must include recompute/readiness before browser demo.

4. HoD 403 in early probe was operator role-context error, not route failure.

`devika.shetty` logs in first as `COURSE_LEADER`. After switching to `grant_mnc_t1_hod`, HoD proof endpoints returned 200. The seeded helper already performs this switch.

5. HoD counterfactual simulator requires `runId`.

Calling `/api/academic/hod/proof-counterfactual-simulator` without `runId` returns 400 by schema. Calling with `runId=sim_mnc_2023_first6_v1` after HoD switch returns 200.

6. Sysadmin cannot read HoD scoped summary endpoints.

The `proof-summary`, `proof-bundle`, `proof-courses`, `proof-faculty`, `proof-students`, and `proof-reassessments` routes require `HOD`. Sysadmin may read simulator but not the scoped HoD rollups. This is strict permission behavior, not a browser failure.

7. Final-stage playback may be blocked by unresolved earlier queue items.

Sem 6 post-SEE has `playbackAccessible=false` and says playback is blocked until all queue items for checkpoint `stage_checkpoint_45dd134a0ac969ea05a049e7` are resolved. If the demo must click through playback, queue preparation is mandatory.

## Blockers

- **Browser runtime blocker:** Install Chrome/Chromium for Playwright/Puppeteer, then rerun browser E2E.
- **Demo-prep blocker:** Ensure proof run is recomputed/readiness-checked before opening the dashboard.
- **Playback blocker:** Resolve or intentionally explain the earlier queue blocker before final Sem 6 playback demo.
- **Evidence blocker:** No screenshot, console, network, or accessibility browser artifact exists yet.

## Reverification Needed

- Run `npx puppeteer browsers install chrome` or install a system Chrome/Chromium package.
- Rerun Playwright browser flows with seeded logins.
- Verify no console errors at system-admin dashboard, HoD analytics, course leader page, mentor page, and student/risk explorer surfaces.
- Verify HoD role switch visibly lands on HoD analytics, not course-leader scope.
- Verify Sem 6 playback behavior after queue resolution.
- Capture screenshots and network logs under `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/`.

## Artifact Paths

- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/proof-dashboard-initial.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/proof-dashboard-final.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/precision/precision-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/precision-probe.mjs`

## Verdict

**Browser E2E verdict: BLOCKED BY ENVIRONMENT, not product-passed.**

API and role-substituted probes are strong enough to continue audit synthesis, but they are not a substitute for the final browser walkthrough. The final demo must not be marked fully ready until Chrome is installed and the browser run captures visual, console, and network evidence.
