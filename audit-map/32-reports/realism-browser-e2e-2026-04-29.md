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
- Browser screenshots: `hod-proof-analytics.png`, `hod-counterfactual.png`, `course-leader.png`, `mentor.png`, `system-admin-app.png`.
- Final live proof-risk smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/final-browser-smoke-devika/final-live-devika-semester-walk-summary.json`.
- Deep Wave Sem 1 repaired proof-risk smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem1-devika-after-recompute-repair/deep-wave-source-sem1-devika-after-recompute-repair-semester-walk-summary.json`.
- Deep Wave Sem 6 repaired proof-risk smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem6-devika-after-recompute-repair/deep-wave-source-sem6-devika-after-recompute-repair-semester-walk-summary.json`.
- Stage A after-fixes proof-risk smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/stage-a-after-fixes/browser-proof-source-sem1-sem6-devika/stage-a-after-fixes-devika-semester-walk-summary.json`.
- Keyboard regression: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser-keyboard-final/system-admin-live-keyboard-regression-report.json`.
- Accessibility regression: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser-accessibility-final2/system-admin-live-accessibility-report.json`.

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
| Console errors | Final targeted smokes captured no preference 409 hits | 0 stale preference hits in final artifact grep | Pass | Earlier `/api/preferences/ui` stale-version noise was fixed by serializing theme saves. |
| Network failures | Captured | 0 failed requests in final targeted artifact grep | Pass | Final keyboard/a11y/proof-smoke artifact scan found no `requestfailed`, `pageerror`, or `/api/preferences/ui` 409 evidence. |
| Accessibility/keyboard | Dedicated live regressions run | keyboard 6/6 checks passed; accessibility 16 report entries, 0 violations | Pass | A11y tree assertions and focus/keyboard paths now run against live `4173/4000`. |

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

5. **UI preference concurrency noise was fixed and rerun.**

The stale `/api/preferences/ui` 409 noise was root-caused to overlapping theme saves using the same remote preference version. `src/repositories.ts` now serializes remote theme saves and retries once on stale-version 409. Regression coverage was added in `tests/repositories-http.test.ts`. Final keyboard, accessibility, and proof-smoke artifact scans found no `/api/preferences/ui`, `response:409`, or `Stale version` hits.

6. **Final-stage playback backend/API gating is fixed; browser artifacts need rerun for fresh visual proof.**

The final full-role smoke with `devika.shetty` passed for Sem 1 and Sem 6 role surfaces, including teacher, HoD, risk explorer, and student shell screenshots. Those browser artifacts were captured before Fix B and still record Sem 6 post-SEE as `playbackAccessible=false`. The backend/API fix now computes playback gates from live queue-case timeline state; focused dashboard, HoD, and student-shell regressions prove Sem 6 post-SEE becomes `playbackAccessible=true` when historical Sem 2 open cases later move to `Watching`/`Resolved`/`Closed`.

7. **Deep Wave faculty-context blocker is fixed and browser-proven.**

Root cause was not the React faculty-context component. The proof recompute path rebuilt checkpoint playback before guaranteeing all-semester proof `section_offerings` and active `faculty_offering_ownerships`; Sem 1 checkpoint bootstrap therefore returned `facultyCount=0`. The repair makes proof offering ensure idempotently backfill ownerships and makes proof recompute run that repair before rebuilding risk. Re-run evidence shows Sem 1 `COURSE_LEADER` bootstrap now has `offeringCount=2, facultyCount=1`; Sem 1 and Sem 6 full-role browser smokes both passed.

## Remaining Blockers

- **Fresh browser evidence caveat:** Re-run browser smoke if the demo needs visual proof of Sem 6 `playbackAccessible=true` after Fix B.
- **Proof-consumption caveat:** One bounded teacher attendance edit now persists through academic bootstrap and recomputed proof projection evidence; broader edit types still need separate proof.
- **Production-readiness blocker:** Real-data import, model governance, privacy/security, and deployment closeout are still not production-proven.

## Reverification Completed

- Chromium smoke completed and wrote screenshots/network/console logs under `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/`.
- HoD role switch visibly lands on HoD analytics.
- HoD counterfactual simulator visibly renders and calls the correct endpoint with `runId`.
- Course leader and mentor pages visibly render scoped proof overlays.
- Sysadmin dashboard API under browser-authenticated context returns 30 checkpoints.
- Final full-role proof smoke passed for Sem 1 and Sem 6 using `devika.shetty` with screenshots under `/tmp/airmentor-demo-logs/realism-2026-04-29/final-browser-smoke-devika/`.
- Deep Wave repaired Sem 1 smoke passed with screenshots under `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem1-devika-after-recompute-repair/`.
- Deep Wave repaired Sem 6 smoke passed with screenshots under `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem6-devika-after-recompute-repair/`.
- Stage A after-fixes Sem 1/Sem 6 proof smoke passed with corrected Sem 6 earlier-checkpoint banner and teacher-edit proof bridge code under `/tmp/airmentor-demo-logs/realism-2026-04-29/stage-a-after-fixes/browser-proof-source-sem1-sem6-devika/`; this browser artifact predates Fix B and should be rerun if current Sem 6 accessible playback needs screenshot evidence.
- Fix B API/browser-consumer parity passed via targeted dashboard, HoD, and student-shell regression tests after changing playback gating to live queue-case timeline semantics.
- Keyboard live regression passed: request flow, modal focus trap, proof checkpoint controls, portal role switch, teacher proof surface, and playback restore/reset path.
- Accessibility live regression passed with 16 report entries and 0 axe violations; screen-reader preflight transcript was written.

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
- `/tmp/airmentor-demo-logs/realism-2026-04-29/final-browser-smoke-devika/final-live-devika-semester-walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem1-devika-after-recompute-repair/deep-wave-source-sem1-devika-after-recompute-repair-semester-walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem6-devika-after-recompute-repair/deep-wave-source-sem6-devika-after-recompute-repair-semester-walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/stage-a-after-fixes/browser-proof-source-sem1-sem6-devika/stage-a-after-fixes-devika-semester-walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser-keyboard-final/system-admin-live-keyboard-regression-report.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser-accessibility-final2/system-admin-live-accessibility-report.json`

## Verdict

**Browser E2E verdict: PASS WITH CAVEATS.**

Browser proof is no longer blocked for core role surfaces. HoD counterfactual, Sem 1/Sem 6 proof-risk surfaces, keyboard navigation, accessibility smoke, Deep Wave faculty-context repair, bounded teacher-edit proof projection, and Fix B API gating are verified. The final demo is still conditional because fresh browser capture after Fix B and production readiness are not proven.
