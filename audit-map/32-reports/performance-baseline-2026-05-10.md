# AirMentor H9 Performance Baseline — 2026-05-10

## Intent

Measure local seeded MSRUAS demo performance for evaluator-critical proof surfaces after P5/P9 browser proof passed. This report is local-demo evidence only; it is not production load, real-data, or multi-program scale evidence.

## Environment

- Branch: `college-demo-2026-04-27`
- SHA: `30fc6886`
- Frontend: `http://127.0.0.1:5174`
- Backend: `http://127.0.0.1:4100`
- Browser: Playwright `firefox` unless overridden by env
- Video: expected disabled for local Nix Firefox runs
- Proof run: `simulation_run_bf79f99b-e92d-4af4-a3ad-77618a6b509b`
- Batch: `batch_branch_mnc_btech_2023`

## Port Preflight

Before running this spec, use:

```bash
ss -ltnp '( sport = :4000 or sport = :4100 or sport = :5173 or sport = :5174 )' || true
```

For the recorded run, fresh measurement ports were `http://127.0.0.1:4100` and `http://127.0.0.1:5174`. The run was executed without killing or reusing the pre-existing backend on `4000`; post-run verification should show `4100` and `5174` closed again.

## Command

```bash
AIRMENTOR_GIT_BRANCH="$(git branch --show-current)" AIRMENTOR_GIT_SHA="$(git rev-parse --short HEAD)" AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5174 AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx --no-install playwright test tests-e2e/specs/performance-baseline.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/h9-performance-baseline-root-verify
```

## Verdict

- Overall: **green**
- Rule: green means every scored surface stayed within budget and no browser console/page errors were observed. Amber means usable but above budget by no more than 25%. Red means timeout, crash, severe over-budget surface, or browser error.
- Sem6/post-SEE setup is informational because it is an internal heavy-context preparation path, not one evaluator click.

## Metrics

| Surface | Measured | Budget | Verdict |
|---|---:|---:|---|
| System admin proof dashboard visible | 5.93s | 20.00s | pass |
| Course Leader proof shell visible | 0.84s | 30.00s | pass |
| Single Next Stage proof advance | 2.65s | 60.00s | pass |
| Setup heavy HoD context at Sem6 post-SEE | 80.38s | informational | info |
| HoD proof bundle response | 10.14s | 30.00s | pass |
| HoD analytics surface visible after bundle | 8.96s | 45.00s | pass |
| Counterfactual simulator response | 0.94s | 90.00s | pass |
| Counterfactual simulator panel visible | 0.89s | 30.00s | pass |

## Browser Console Errors

- None observed.

## Page Errors

- None observed.

## Claim Boundary

H9 now has a measured local seeded performance baseline for the demo branch. This does not close production readiness, real institutional validation, deployment cold-start, real-data validation, or multi-tenant scale readiness.
