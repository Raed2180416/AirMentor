# AirMentor H9 Performance Baseline — 2026-05-10

## Intent

Measure local seeded MSRUAS demo performance for evaluator-critical proof surfaces after P5/P9 browser proof passed. This report is local-demo evidence only; it is not production load, real-data, or multi-program scale evidence.

## Environment

- Branch: `h9-performance-baseline-2026-05-10`
- SHA: `3fb651b3`
- Frontend: `http://127.0.0.1:5174`
- Backend: `http://127.0.0.1:4100`
- Browser: Playwright `firefox` unless overridden by env
- Video: expected disabled for local Nix Firefox runs
- Proof run: `simulation_run_df6c8592-0b76-4f08-a498-866810ecf25e`
- Batch: `batch_branch_mnc_btech_2023`

## Port Preflight

Before the run, `ss -ltnp '( sport = :4000 or sport = :4100 or sport = :5173 or sport = :5174 )' || true` showed only the pre-existing backend on `127.0.0.1:4000` (`MainThread`, pid `9098`). Fresh ports `4100` and `5174` were free and used for the measurement run. After Playwright exited, `4100` and `5174` were closed again; the pre-existing backend on `4000` remained untouched.

## Command

```bash
AIRMENTOR_GIT_BRANCH="$(git branch --show-current)" AIRMENTOR_GIT_SHA="$(git rev-parse --short HEAD)" AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5174 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox node_modules/.bin/playwright test tests-e2e/specs/performance-baseline.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/h9-performance-baseline
```

Result: `1 passed (3.4m)`.

## Verdict

- Overall: **green**
- Rule: green means every scored surface stayed within budget and no browser console/page errors were observed. Amber means usable but above budget by no more than 25%. Red means timeout, crash, severe over-budget surface, or browser error.
- Sem6/post-SEE setup is informational because it is an internal heavy-context preparation path, not one evaluator click.

## Metrics

| Surface | Measured | Budget | Verdict |
|---|---:|---:|---|
| System admin proof dashboard visible | 6.40s | 20.00s | pass |
| Course Leader proof shell visible | 1.33s | 30.00s | pass |
| Single Next Stage proof advance | 2.64s | 60.00s | pass |
| Setup heavy HoD context at Sem6 post-SEE | 83.05s | informational | info |
| HoD proof bundle response | 10.68s | 30.00s | pass |
| HoD analytics surface visible after bundle | 8.95s | 45.00s | pass |
| Counterfactual simulator response | 0.98s | 90.00s | pass |
| Counterfactual simulator panel visible | 0.89s | 30.00s | pass |

## Browser Console Errors

- None observed.

## Page Errors

- None observed.

## Claim Boundary

H9 now has a measured local seeded performance baseline for the demo branch. This does not close production readiness, real institutional validation, deployment cold-start, real-data validation, or multi-tenant scale readiness.
