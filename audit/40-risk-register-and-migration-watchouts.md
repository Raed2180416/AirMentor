# AirMentor Risk Register And Migration Watchouts

## What this area does
This register tracks realistic change risks for the AirMentor refactor and hardening program, including what can break, how to detect it early, and when to roll back.

## Confirmed observations
- AirMentor’s highest-risk migrations are not isolated code changes. They affect proof state, restore behavior, route ownership, session behavior, and runtime payload composition.
- Several proposed changes alter trust-sensitive flows, so regressions may show up as “the app feels wrong” before they show up as obvious crashes.

## Current-state reconciliation (2026-03-28)
- Several risks in the original register have already been exercised safely:
  - `src/App.tsx` and `src/system-admin-live-app.tsx` were split behind compatibility-preserving shells/workspaces
  - `academic.ts` was split into route registrars
  - CSRF and login-throttling hardening landed without breaking the live tests
- The risk picture has therefore shifted:
  - the remaining highest backend extraction risk is the proof facade, not `academic.ts`
  - the new highest migration risk is dual-contract/runtime-normalization drift during Stage 5
  - the remaining Stage 6 posture risk is secure-cookie misconfiguration, not total absence of CSRF
  - several newer risks now come from the hardening itself: CSRF propagation, fail-closed startup diagnostics, and browser-suite cadence cost

## Key workflows and contracts
| Change area | What can break | Why it can break | Blast radius | Early warning signs | Mitigation | Rollback trigger |
| --- | --- | --- | --- | --- | --- | --- |
| Split `src/App.tsx` | login/bootstrap/proof navigation drift | auth, route, and proof context logic are currently co-located and may separate unevenly | all teaching users | role-switch regressions, wrong faculty context, proof route mismatch | preserve public props and route behavior behind compatibility wrappers | any regression in bootstrap, faculty profile, student shell, or risk explorer acceptance |
| Split `src/system-admin-live-app.tsx` | admin search/detail/history/request navigation drift | route serialization, request detail loading, history restore, and proof dashboard state currently share one shell | system-admin users | route restore fails, request detail loads wrong record, history sections disappear | extract shells one route family at a time; keep route serializer stable | live admin acceptance or request-flow acceptance failure |
| Split `academic.ts` | broken academic/admin route ownership, payload drift | the module currently hides both teaching and admin-style write surfaces under one registrar | teaching users + admins | missing fields in bootstrap/faculty profile/proof payloads | freeze route contracts with tests before moving logic | any route contract or acceptance-script regression |
| Split `msruas-proof-control-plane.ts` | proof cards/explorer/HoD analytics divergence | one module currently owns execution plus multiple read-model builders and may drift during extraction | proof users | mismatched proof sections, probability display changes, shell output drift | golden tests on payload sections and disclaimers before extracting services | proof-risk smoke or proof UI test regression |
| Narrow runtime sync endpoints | data loss or overwrite bugs | current whole-slice saves hide authority boundaries and partial-write semantics | teaching users | tasks/placements/calendar state disappears or duplicates after save/reload | dual-write or shadow-read during migration; preserve version fields | runtime state mismatch after save/reload in seeded flows |
| Operate both coarse and narrow runtime contracts during cutover | drift between old `/sync` paths and new entity-level writes | both contract families are live until migration finishes | teaching users + API maintainers | narrow writes look correct but bootstrap/runtime snapshots diverge later | keep shadow-drift telemetry and parity tests on every cutover slice | any mismatch between narrow-route reads and legacy sync/bootstrap views |
| Normalize JSON-heavy tables | read-model breakage and migration bugs | live semantics currently ride inside JSON payloads that are easy to misread or backfill incorrectly | proof + runtime surfaces | deserialization errors, stale cards, missing evidence sections | migrate one snapshot family at a time with validation queries | migration error rate or missing record counts above threshold |
| Centralize access evaluators | accidental overexposure or overrestriction | route-local policy code and UI visibility helpers do not yet share one decision source | all scoped users | new forbidden errors, empty proof lists, widened access | keep route-level tests and add matrix tests before cutover | access-control test failures or unauthorized record visibility |
| Add rate limiting / session hardening | login friction or broken local/dev flows | current sessions and login flows were tuned for convenience and may react badly to production-style controls | all users, especially local QA | intermittent login failures, script login breakage | environment-aware thresholds and dev/test bypasses | sustained login failure increase or broken seeded scripts |
| Propagate CSRF correctly across scripts and secondary clients | authenticated writes fail even when the session cookie is valid | mutating requests now also require `X-AirMentor-CSRF` derived from the current session | all scripted/admin write paths | browser/script flows can read but fail on write with 403s | centralize CSRF handling in shared helpers and keep test-app/browser scripts aligned with session restore | any seeded script or acceptance flow breaks on authenticated mutations because the CSRF header is missing |
| Fail-closed startup diagnostics in production-like mode | app refuses to boot under mis-set cookie/origin envs | startup diagnostics now intentionally block unsafe production-like combinations | deployment/runtime operations | startup exits early with cookie/origin diagnostic errors | document required env combinations and validate them before deploy promotion | production-like deploy cannot start because cookie/origin/CSRF envs are inconsistent |
| In-memory login rate limiting on a distributed runtime | abuse protections behave inconsistently across instances or after restart | current rate limiting uses an in-process map rather than a shared store | auth posture across scaled deployments | rate limits reset after restart or differ by instance | keep current guardrail for single-node deployments and plan shared backing if horizontal scaling is introduced | repeated auth abuse is observable across multiple instances without consistent throttling |
| Add queue instrumentation and stale-state UI | noisy alerts or false stale indicators | freshness thresholds are not yet calibrated from observed runtime data | proof users and operators | operators ignore alerts, users see false “stale” warnings | start read-only; calibrate thresholds from observed baseline | stale-state false positive rate too high to be actionable |
| Isolate curriculum linkage service | approval/regeneration side effects drift or degraded approvals accumulate without retry | linkage and approval side effects currently sit inside a broader admin-structure path, and approval can now succeed even if proof refresh queueing does not | system admins | candidate generation missing, rising count of `approvalSucceeded && !proofRefreshQueued`, or proof refresh retry debt | keep deterministic fallback, explicit degraded warnings, and post-approval audit checks plus retry affordances | linkage approval behavior changes silently or degraded approvals accumulate without successful retry |
| Remove/archive mock and prototype surfaces | hidden dependency on dead artifact | dormant paths still have tests, scripts, or parity tooling relationships | developers and QA | broken docs/scripts referencing removed files | move to explicit archive path first; update scripts/tests in same change | any active workflow still depending on archived surface |
| Tighten CI and browser cadence | slower pipelines, flaky browser jobs, or lock/port contention | stricter gates and scheduled browser suites are now live and depend on environment bootstrapping | engineering delivery | longer lead time, more red pipelines due to flaky browser or seeded-environment setup | isolate flaky setup, keep lock discipline in browser wrappers, and make failures diagnosable | delivery blocked by repeated non-actionable browser/cadence failures for more than one iteration |

## Findings
### Highest-blast-radius risks
- Proof refactors in `msruas-proof-control-plane.ts`
- Academic route ownership changes in `academic.ts`
- Runtime-state contract changes across browser storage and backend sync

### Most likely “silent wrongness” risks
- route restore changes
- checkpoint fallback changes
- access-scope drift
- probability-display behavior changes

## Implications
- Rollback criteria must be defined per feature, not only per service.
- Acceptance scripts are not optional during the refactor program; they are early warning systems for silent wrongness.

## Recommendations
1. For every AM implementation spec, keep a named rollback trigger tied to an existing automated or smoke validation.
2. Shadow-measure before switching behavior on changes to state ownership, proof payload assembly, and access policy.
3. Record migration watchouts in PR descriptions so risk handling stays visible during execution, not only in this register.

## Confirmed facts vs inference
### Confirmed facts
- Each risk area above is tied to currently verified hotspots, routes, scripts, or tables in the repo.

### Strongly supported inference
- Silent semantic regressions are more likely than hard crashes during this program unless acceptance and telemetry coverage improve first.

## Cross-links
- [22 Evidence Appendix By Issue](./22-evidence-appendix-by-issue.md)
- [39 90-Day Execution Plan](./39-90-day-execution-plan.md)
- [23 Implementation Spec AM-001](./23-implementation-spec-AM-001.md)
- [38 Implementation Spec AM-016](./38-implementation-spec-AM-016.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
