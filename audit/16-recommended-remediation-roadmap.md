# AirMentor Recommended Remediation Roadmap

## Current-state reconciliation (2026-03-28)
- This roadmap remains directionally useful, but it now needs to be read as a progress-tracked document rather than a fresh plan.
- Current stage status:
  - Stage 0: complete enough to close
  - Stage 1: substantially complete
  - Stage 2: complete enough to close
  - Stage 3: complete enough to close
  - Stage 4: complete enough to close
  - Stage 5: complete enough to close
  - Stage 6: complete enough to close repo-locally
  - Stage 7: complete enough to close repo-locally
- The remaining highest-value work is now:
  - keep deprecated compatibility routes until caller inventory is empty and release-cycle evidence is green
  - run the deterministic closeout suites:
    - `npm run verify:final-closeout`
    - `PLAYWRIGHT_APP_URL=<live-pages-url> PLAYWRIGHT_API_URL=<live-railway-url> npm run verify:final-closeout:live`
  - finish the remaining manual accessibility validation work, especially screen-reader-oriented review, now that live keyboard/axe flows and explicit proof-tab semantics are in place
- See [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md) for exact evidence.

## What this area does
This document turns the issue catalog into an execution roadmap ordered by user trust, correctness, maintainability, and architectural leverage.

## Confirmed observations
- The highest-value fixes are not isolated bugfixes. They are structural changes that reduce cross-layer blast radius and make later remediation safer.
- Several medium issues should be deferred until the platform is easier to reason about; otherwise the team will spend effort fixing symptoms inside unstable architecture.

## Key workflows and contracts
### Execution principles
1. Fix amplifiers before symptoms.
2. Add observability before large proof expansion.
3. Prefer seams that reduce ownership bottlenecks.
4. Preserve product intent: a faculty-facing, proof-bounded academic operating system, not a generic AI chatbot.

## Findings
### Phase 0: Stabilize Measurement And Safe Change Boundaries
Target issues: `AM-008`, `AM-013`, `AM-015`

#### Objectives
- Make runtime quality visible.
- Improve confidence in future architectural changes.
- Reduce environment-caused false alarms.

#### Work
- Add structured telemetry for:
  - login failures
  - admin and academic bootstrap failures
  - proof-run creation and checkpoint readiness
  - shell and risk explorer load failures
  - curriculum linkage generation errors
- Promote critical acceptance flows into regular verification:
  - live admin acceptance
  - request flow
  - proof smoke
  - admin-to-teaching parity
- Make `verify:proof-closure` and `verify:proof-closure:proof-rc` the explicit CI-grade confidence bar for the proof stack instead of informal convenience scripts.
- Add startup diagnostics and deployment preflight checks for required environment variables and cookie/origin safety.
- Add a dedicated non-deploy CI workflow for lint/test/build so green deploy workflows cannot mask skipped verification.

#### Why now
Every later phase becomes lower-risk if the team can see regressions and environment drift quickly.

### Phase 1: Break The Largest Orchestrators
Target issues: `AM-001`, `AM-006`

#### Objectives
- Reduce cognitive load and change failure rate.
- Make ownership possible by domain rather than by “the person who knows the giant file.”

#### Work
- Split `src/App.tsx` into:
  - auth/session shell
  - academic navigation shell
  - proof-aware faculty profile shell
  - teaching runtime shell
- Split `src/system-admin-live-app.tsx` into:
  - route and loader shell
  - hierarchy management
  - request workflow
  - proof control plane
  - faculty calendar/audit
- Split `air-mentor-api/src/lib/msruas-proof-control-plane.ts` into:
  - proof run execution
  - checkpoint assembly
  - HoD analytics
  - faculty proof payloads
  - risk explorer composition
  - student shell composition
- Split `air-mentor-api/src/modules/academic.ts` by subdomain route ownership.

#### Why now
This phase removes the single biggest engineering bottleneck and reduces the blast radius of all later changes.

### Phase 2: Establish One Authoritative State Model
Target issues: `AM-002`, `AM-003`, `AM-012`

#### Objectives
- Make state predictable.
- Reduce hidden storage behavior and overwrite risk.
- Prepare the platform for larger institutional datasets.

#### Work
- Define authoritative ownership for each runtime slice.
- Replace whole-slice sync endpoints with narrower entity- or operation-level contracts where feasible.
- Reduce browser-stored state to explicit convenience features.
- Add visible restore/reset affordances for route and checkpoint state.
- Normalize the most operationally important JSON snapshots into relational facts or typed server-side stores.

#### Why now
Once the giant files are split, this becomes much easier and yields immediate UX and correctness gains.

### Phase 3: Centralize Scope And Security Semantics
Target issues: `AM-004`, `AM-016`

#### Objectives
- Make access control more explainable and less drift-prone.
- Harden production readiness.

#### Work
- Introduce centralized domain access evaluators for:
  - admin hierarchy visibility
  - proof access
  - archived-run inspection
  - faculty/student record visibility
- Reuse those evaluators for backend enforcement and frontend empty-state messaging.
- Add rate limiting and stronger deployment checks for cookie security posture.

#### Why now
By this point the codebase is modular enough that centralized policy logic can actually stay centralized.

### Phase 4: Improve Proof Trust And Operability
Target issues: `AM-005`, `AM-007`, `AM-011`

#### Objectives
- Keep the proof platform rigorous while making it easier to operate and easier for users to trust.

#### Work
- Add queue-health dashboards and stale-proof-state surfacing.
- Expose clearer user-facing explanations for checkpoint-specific and probability-suppressed states.
- Treat curriculum linkage as an isolated subsystem with health, provenance, fallback, and approval-quality metrics.
- Keep the student shell deterministic unless future instrumentation and evaluation become substantially stronger.

#### Why now
This phase improves the product’s flagship differentiator once the platform underneath it is safer.

### Phase 5: UX And Accessibility Refinement
Target issues: `AM-009`, `AM-014`, `AM-010`

#### Objectives
- Reduce cognitive load.
- Make navigation and request workflows more legible.
- Clean repo drift that no longer supports the live product.

#### Work
- Add persistent scope and checkpoint banners.
- Reframe request actions around user outcomes and next steps.
- Introduce accessibility regression checks and reusable accessible primitives.
- Remove or archive dormant mock/prototype/temp artifacts.

#### Why now
This phase compounds the benefits of earlier structural fixes and improves day-to-day usability.

## Implications
- The roadmap intentionally delays some UI polish until the team can change the platform safely.
- The most important future-state quality is not just “fewer bugs.” It is a system where proof trust, user clarity, and engineering velocity reinforce each other.

## Recommendations
- Staff early phases with engineers who understand both frontend and backend proof flows.
- Treat the proof platform and state-authority refactor as program work, not as opportunistic cleanup.
- Keep the product promise fixed during the refactor: bounded, evidence-based faculty decision support.

## Confirmed facts vs inference
### Confirmed facts
- The roadmap phases map directly to confirmed issue clusters.

### Reasonable inference
- Phase 1 plus Phase 2 will deliver the greatest reduction in change-failure rate and debugging cost.

## Cross-links
- [14 Cross-File Cross-System Issue Map](./14-cross-file-cross-system-issue-map.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [17 Non-Technical Explanation For Stakeholders](./17-non-technical-explanation-for-stakeholders.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
