# AirMentor H9 Performance Baseline Design

## Intent

AirMentor must remain credible to a college evaluator running the local MSRUAS B.Tech Mathematics & Computing demo in a browser. After the P5/P9 Firefox proof passed, the next open gap is not another workflow proof; it is whether the evaluator-facing proof surfaces respond within a usable local-demo performance envelope.

## Feature Intent

H9 establishes a measured local seeded performance baseline for the proof dashboard, HoD analytics, academic proof shells, and proof-control operations. It does not claim production scale, real-data predictive validity, deployment readiness, or multi-program generalization.

## Current Truth

- Branch `college-demo-2026-04-27` has fresh Firefox browser proof at `242074f`.
- Focused P5/P9 pack passed 12/12 on fresh ports `4100/5174`.
- Full all-spec Playwright regression passed 20/20 in 42.2 minutes on fresh ports `4100/5174`.
- `docs/CAPABILITY_MATRIX.md` still marks `Performance baseline` as `missing` under H9.
- `tests-e2e/playwright.config.ts` uses `NODE_OPTIONS=--max-old-space-size=8192` for long proof ladders, so memory pressure remains a known local-demo risk to measure honestly.

## Scope

Included:

- Fresh local stack preflight that does not kill or reuse stale user processes blindly.
- Measured timings for evaluator-critical proof surfaces.
- A durable performance report with budgets, measured durations, commands, environment, and verdicts.
- Capability matrix update limited to measured H9 evidence.
- Root-cause profiling only if a measured surface misses budget or times out.

Excluded:

- Production performance or load testing.
- Real Render/Railway cold-start measurement.
- Real-data model validation.
- Multi-program scalability work.
- Deep optimization without a measured failing surface.

## Evaluator Scenario

Role and purpose:

- System admin creates or resumes a proof run and expects visible progress instead of frozen controls.
- HoD opens department proof analytics and expects the risk/watchlist surface to load before losing confidence.
- Course Leader or faculty shell opens proof-grounded academic context and expects evidence to appear without stale loading.

Semester/stage:

- Measurements must use the seeded MSRUAS proof run across the same local demo flow family already proven by Playwright.
- HoD and proof-control surfaces should include later-stage/heavier contexts when practical, because those are more likely to expose performance issues.

Evaluator observation:

- Browser shows responsive loading/progress or completed proof surfaces.
- No crash, timeout, OOM, stale loading state, or silent failure.

## Measurement Surfaces

| Surface | Local demo budget | Reason |
|---|---:|---|
| Backend health after fresh start | <= 180s | Existing Playwright webServer startup budget. |
| Frontend health after fresh start | <= 120s | Existing Playwright webServer startup budget. |
| System admin proof dashboard visible | <= 20s after navigation | Admin must trust the proof run exists and is advancing. |
| HoD proof bundle response | <= 30s | Previous local behavior approached 31s; this is evaluator-visible. |
| HoD analytics surface visible | <= 45s after navigation | Includes API plus React rendering. |
| Academic/faculty proof shell visible | <= 30s after navigation | Teacher proof context must feel usable. |
| Stage advance / recompute operation | <= 60s with visible progress | Long operation is acceptable only if progress is explicit. |
| Full all-spec Playwright context | informational | Already passed; not a per-surface budget. |

## Approach

1. Preflight ports and processes.
   - Check `4000`, `4100`, `5173`, and `5174`.
   - Do not kill the pre-existing backend on `4000`.
   - Prefer fresh isolated E2E ports `4100/5174` for measurements unless blocked.

2. Run a timing harness through Playwright or API helpers.
   - Use browser timing for authenticated UI surfaces.
   - Use response timing for protected API calls when Playwright can observe them.
   - Capture console/page errors.

3. Write the performance report.
   - Path: `audit-map/32-reports/performance-baseline-2026-05-10.md`.
   - Include command, environment, branch, SHA, ports, measured durations, artifacts, and verdict.

4. Update the capability matrix.
   - Move H9 from `missing` only if measured evidence exists.
   - Keep production readiness and real-data validation blocked.

5. Profile only on failure.
   - If a surface misses budget, inspect network timing, Playwright trace, server output, and query/service scope.
   - Fix only the root cause and then rerun the failed surface plus relevant regression tests.

## Data Flow

- Browser starts from sysadmin or seeded academic login.
- Playwright records navigation, API response, and locator visibility timings.
- Backend seeded proof services provide the same local synthetic proof data used by the successful P5/P9 all-spec run.
- The report records only aggregate timings and artifact paths, not private credentials beyond existing seeded demo account labels.

## Error Handling

- Timeout means red for that surface unless a trace proves the product clearly displayed usable progress and completed later.
- Console/page errors are red unless proven unrelated static-resource noise.
- Server OOM or process exit is red.
- A missing metric is not green; mark it unmeasured and keep H9 partial.

## Testing and Verification

Minimum verification:

- Fresh-port preflight recorded.
- Timing harness run completed on local Firefox or Playwright-compatible browser.
- Performance report created with no placeholder values.
- `docs/CAPABILITY_MATRIX.md` updated consistently with the report.
- Git status clean after commit.

Optional verification if product code changes are needed:

- Focused Vitest regression for the optimized service.
- Targeted Playwright spec for the affected surface.
- TypeScript no-emit for changed package.

## Claim Boundary

H9 can claim local seeded demo performance has been measured and classified. H9 cannot claim production readiness, real institutional performance, real-data predictive validity, or multi-tenant scale readiness.

## Approval State

Design approved by user on 2026-05-10 for H9 performance baseline execution.
