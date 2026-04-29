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

Browser automation now runs locally with Playwright Chromium under a NixOS-compatible `LD_LIBRARY_PATH`. No sudo path was used.

Evidence:

- Playwright Chromium executable resolved at `/home/raed/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`.
- Headless shell dependency check passed after selecting 64-bit Nix store libraries only.
- Frontend ran at `http://127.0.0.1:4173` with API proxy to `http://127.0.0.1:4000`.
- Purpose-built browser smoke script: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke.mjs`.
- Smoke summary: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke-summary.json`.
- Console log: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-console.json`.
- Network log: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-network.json`.
- Screenshots: `hod-proof-analytics.png`, `hod-counterfactual.png`, `course-leader.png`, `mentor.png`, `system-admin-app.png`.

Read-first anchors:

- `tests-e2e/helpers/login-as.ts:10-15` defines seeded HoD credential intent.
- `tests-e2e/helpers/login-as.ts:75-89` switches to the requested active role grant.
- `air-mentor-api/src/modules/academic-proof-routes.ts:66-248` defines HoD proof analytics routes and role gates.
- `air-mentor-api/src/modules/session.ts:39-88` builds session payload and synchronizes CSRF/session cookies.
- `air-mentor-api/src/config.ts:75-115` defines local/production cookie and origin posture.

## Browser Evidence Matrix

| Flow | Browser status | API/network result | Result | Realism note |
|---|---|---:|---|---|
| Open app shell | Rendered through Chromium | `/api/session`, `/api/academic/bootstrap` 200 | Pass | UI render proven for role pages. |
| HoD login and role context | `devika.shetty` active grant `HOD` after switch | session payload shows `grant_mnc_t1_hod` | Pass | HoD role switch is mandatory and works. |
| HoD analytics | `hod-proof-analytics.png` captured | `/api/academic/hod/proof-bundle` 200 | Pass | Department proof records visible. |
| Counterfactual simulator | `hod-counterfactual.png` captured | `/api/academic/hod/proof-counterfactual-simulator` 200 | Pass after product wiring fix | Panel shows projected/simulated language, not causal proof. |
| Course leader | `course-leader.png` captured | profile/bootstrap calls 200 | Pass | Course leader sees scoped dashboard and proof overlay. |
| Mentor | `mentor.png` captured | profile/bootstrap calls 200 | Pass | Mentor sees mentees and proof overlay. |
| Sysadmin proof dashboard API | Browser session + request context | dashboard status 200, `checkpointCount=30` | Pass | Active run `sim_mnc_2023_first6_v1`, semester 1 pre-TT1 active stage. |
| Console errors | Captured | 3 stale UI preference conflicts | Caveat | Not proof/role blocking, but should be fixed before polished demo. |
| Network failures | Captured | 0 failed requests | Pass | Only non-OK responses were 3 expected/stale `preferences/ui` 409s. |
| Accessibility/keyboard | Not covered by this smoke | none | Gap | Existing Playwright accessibility scripts still need dedicated run if required. |

## Browser Smoke Results

`browser-smoke-summary.json` reports:

- `status=completed`.
- Steps: `login-hod`, `hod-surface-visible`, `counterfactual-visible`, `login-course-leader`, `course-leader-visible`, `login-mentor`, `mentor-visible`, `admin-dashboard-api-read`.
- HoD surface: visible, has semester text, has department proof records.
- Counterfactual: tab visible, simulator response 200, panel visible, `prohibitedCopyFound=false`.
- Course leader: visible, active role `COURSE_LEADER`.
- Mentor: visible, active role `MENTOR`.
- Admin dashboard API: status 200, `checkpointCount=30`, `runId=sim_mnc_2023_first6_v1`, active stage `pre-tt1`, active operational semester 1.
- Network failures: 0.

## Findings

1. **Browser runtime blocker is resolved for local Playwright Chromium.**

Chromium can launch headlessly without sudo when 64-bit Nix store shared libraries are selected. Earlier `wrong ELF class` came from a 32-bit `libatk` path; the successful run filtered by ELF class.

2. **HoD counterfactual panel had a real product wiring bug and was fixed.**

Root cause: `OperationalWorkspace` accepted `loadHodProofCounterfactualSimulator` in its props type and caller supplied it, but the component did not destructure it or pass it into `academicWorkspace`. The HoD tab therefore rendered the fallback “Counterfactual panel not wired” instead of calling the simulator loader. Fix: pass `loadHodProofCounterfactualSimulator` into the route-surface workspace object and add regression test `tests/hod-counterfactual-wiring.test.ts`.

3. **HoD counterfactual is now browser-proven.**

The browser clicked the `Counterfactual Impact` tab, observed `/api/academic/hod/proof-counterfactual-simulator` status 200, and captured the panel. Copy uses “Projected”, “simulated”, and “not causally proven”; prohibited causal copy was not found.

4. **HoD 403 in early probe was operator role-context state, not route failure.**

`devika.shetty` can start as `COURSE_LEADER`; after switching to `grant_mnc_t1_hod`, browser HoD analytics renders and API calls pass.

5. **Current browser caveat is UI preference concurrency noise.**

Console/page errors contain three `Stale version for UI preferences` failures from `/api/preferences/ui` 409 during theme/preference save. This does not block proof surfaces, but it is visible browser noise and should be cleaned before a polished demo.

6. **Final-stage playback remains a separate proof-plane/demo-prep issue.**

This smoke verified current active semester/stage and role pages. It did not resolve the earlier Sem 6 post-SEE queue blocker.

## Remaining Blockers

- **Playback blocker:** Resolve or intentionally explain the earlier queue blocker before final Sem 6 playback demo.
- **Edit-persistence blocker:** One bounded teacher edit mutation + recompute + re-read remains unproven.
- **Console-noise blocker for polished demo:** Fix or suppress stale-version UI preference conflicts.
- **Accessibility gap:** Dedicated accessibility/keyboard Playwright checks were not part of this smoke.

## Reverification Completed

- Chromium smoke completed and wrote screenshots/network/console logs under `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/`.
- HoD role switch visibly lands on HoD analytics.
- HoD counterfactual simulator visibly renders and calls the correct endpoint with `runId`.
- Course leader and mentor pages visibly render scoped proof overlays.
- Sysadmin dashboard API under browser-authenticated context returns 30 checkpoints.

## Artifact Paths

- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-console.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-network.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/hod-proof-analytics.png`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/hod-counterfactual.png`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/course-leader.png`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/mentor.png`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/system-admin-app.png`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/proof-dashboard-final.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/precision/precision-summary.json`

## Verdict

**Browser E2E verdict: PASS WITH CAVEATS.**

Browser proof is no longer blocked. Core role surfaces and HoD counterfactual are visually and network-verified. The final demo is still conditional because Sem 6 playback preparation, one teacher edit persistence proof, accessibility checks, and UI-preference 409 cleanup remain open.
