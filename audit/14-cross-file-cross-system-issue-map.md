# AirMentor Cross-File Cross-System Issue Map

## What this area does
This document maps the major issues to their technical origin points, participating files, user-visible symptoms, and downstream consequences. It is the bridge between subsystem audits and the canonical issue entries in [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md).

## Confirmed observations
- The most important AirMentor failures are rarely local to one file.
- The dominant issue clusters originate in:
  - frontend orchestration hotspots
  - backend orchestration hotspots
  - split persistence and hydration design
  - proof pipeline concentration
  - incomplete observability and runtime normalization

## Current-state reconciliation (2026-03-28)
- This issue map is still structurally correct, but several clusters are now partially mitigated:
  - frontend shell splits reduced the raw concentration inside the two root apps
  - academic route ownership is no longer concentrated in one registrar
  - proof queue/checkpoint diagnostics, startup diagnostics, CSRF, and login throttling now exist
- The remaining cross-system amplifier is now the unfinished proof/runtime normalization work, not total absence of seams or instrumentation.

## Key workflows and contracts
| Issue ID | Starts in | Participating files/systems | User-facing symptom | Canonical issue |
| --- | --- | --- | --- | --- |
| AM-001 | `src/App.tsx`, `src/system-admin-live-app.tsx` | `src/repositories.ts`, `src/api/client.ts`, `academic.ts`, `admin-structure.ts`, `msruas-proof-control-plane.ts` | Small UI changes have surprising cross-feature regressions | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-002 | `src/repositories.ts`, `src/portal-routing.ts`, `src/proof-playback.ts` | local storage, session storage, backend bootstrap, runtime sync, `src/App.tsx`, `src/system-admin-live-app.tsx` | Reload restores unexpected route, faculty, or checkpoint context, and proof fallback behavior depends on hidden invalidation rules | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-003 | `academic.ts` bootstrap and sync endpoints | `src/App.tsx`, `src/system-admin-live-app.tsx`, `api/client.ts`, `schema.ts` | Slow or fragile large-screen hydration and overwrite-prone saves | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-004 | `support.ts` plus feature-specific scope filters | `academic.ts`, `system-admin-live-data.ts`, `msruas-proof-control-plane.ts` | Access behavior is correct in many cases but hard to reason about globally | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-005 | proof surface copy and proof composition helpers | `student-shell.tsx`, `risk-explorer.tsx`, `msruas-proof-control-plane.ts` | Users may overread “AI” capability compared with actual bounded behavior | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-006 | `msruas-proof-control-plane.ts` | `admin-proof-sandbox.ts`, `academic.ts`, queue worker, proof tests | Proof changes are expensive and risky because everything meets in one file | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-007 | curriculum linkage helpers | `admin-structure.ts`, Python helper, OLLAMA env, linkage script | Linkage generation quality and availability are operationally brittle | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-008 | lack of telemetry across app and UI | all runtime surfaces | Team cannot see production quality clearly | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-009 | custom dense UI surfaces | `ui-primitives.tsx`, main shells, proof pages | Keyboard, focus, and cognitive accessibility risk | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-010 | stale/non-runtime files | removed mock-admin history plus alternate prototype UI, zero-byte placeholder, local temp probes, ignored local `__pycache__`, tracked PDF | Repo appears larger and less trustworthy than runtime product actually is | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-011 | `proof-run-queue.ts` | `app.ts`, proof dashboard, smoke prewarm, admin proof routes | Missing checkpoints can present as a vague proof-state problem | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-012 | `schema.ts` JSON-heavy design | `parseJson`/`stringifyJson`, runtime sync, proof artifact shaping | Hard to identify source of truth during data drift or reload issues | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-013 | split fast vs proof-rc coverage plus incomplete full-path confidence | tests, `run-vitest-suite.mjs`, package verify scripts, browser wrappers, non-deploy CI plus scheduled proof/browser cadence | Some serious regressions can still escape the default green baseline even though workflows are stronger now | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-014 | request-detail UI and route restoration | `system-admin-live-app.tsx`, `admin-requests.ts`, request-flow script | Request workflow feels process-heavy and deep-link stateful | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-015 | env and deployment config fragmentation | `vite.config.ts`, workflows, Railway config, frontend hard-fail screens | Environment misconfiguration becomes a user-visible outage quickly | [Issue catalog](./15-issue-catalog-prioritized.md) |
| AM-016 | session/auth hardening gaps | `session.ts`, `app.ts`, `config.ts` | Security posture depends heavily on deployment hygiene | [Issue catalog](./15-issue-catalog-prioritized.md) |

## Findings
### Root-cause clusters
#### Cluster A: Concentration
- AM-001, AM-006, and parts of AM-003 are all manifestations of the same structural fact: too much product behavior is concentrated in a few files.

#### Cluster B: Ambiguous state authority
- AM-002, AM-003, AM-012, and part of AM-014 all stem from multiple overlapping state stores and broad hydrate/sync contracts.

#### Cluster C: Proof power without proof observability
- AM-006, AM-008, AM-011, and AM-013 combine into the core platform risk for the proof system: sophisticated behavior, insufficient operational visibility.

#### Cluster D: Product clarity versus implementation reality
- AM-005, AM-014, and AM-015 all expose places where user expectations can diverge from system reality.

## Implications
- Fixing the repo drift issue alone will not materially reduce risk.
- Fixing only the UI without addressing state authority will improve appearance more than reliability.
- The highest leverage fixes are structural and observability-oriented because they remove failure amplifiers rather than only repairing symptoms.

## Recommendations
- Use the roadmap in [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md) as the execution order.
- Treat AM-001, AM-003, AM-006, and AM-008 as the core platform program.
- Treat AM-002- and AM-014-style route/playback restoration behaviors as user-trust work, not just implementation cleanup.

## Confirmed facts vs inference
### Confirmed facts
- The participating files and workflows above are grounded in code and tests.
- The issue clusters are supported by repeated patterns across frontend, backend, proof, and acceptance scripts.

### Reasonable inference
- The team’s future delivery speed depends more on reducing these cluster-level amplifiers than on fixing any single isolated bug.

## Cross-links
- [00 Executive Summary](./00-executive-summary.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
