# AirMentor Maintainability Refactor — Design Spec

**Date:** 2026-07-10  
**Scope:** Product-shippable refactor of the entire AirMentor UI + API codebase  
**Exit state:** Full Clean Architecture with `kernel/`, `adapters/`, `universities/` layers; lint clean; tests green; ML training/serving parity proven; university plugin system demonstrated with a second stub.  
**Execution mode:** Design spec approved, then incremental implementation one extraction boundary per commit.

---

## 1. Summary

This spec defines a deterministic, incremental refactor of `/home/raed/Projects/air-mentor-ui` from its current monolithic state to a Clean Architecture organization. The refactor preserves all existing behavior and hierarchical intent (Institution → Academic Faculty → Department → Branch → Batch → Section → Student/Faculty), introduces a framework-free domain layer, isolates the demo/proof simulation code, and adds automated architectural fitness gates.

The work is organized into 6 implementation phases plus a Phase 0 hygiene pass. Each phase produces a set of small, reviewable commits. Every commit must pass the verification command block defined in Section 8.

---

## 2. Exit Criteria (Definition of Done)

The refactor is complete when **all** of the following are true:

1. **Directory structure matches target architecture**
   - `kernel/` at repo root contains pure domain logic (grading, identity, credit, assessment, risk, curriculum).
   - `adapters/web/` contains the React application.
   - `adapters/persistence/` contains all Drizzle schema access.
   - `adapters/http/` contains Fastify route controllers.
   - `adapters/simulation/` contains proof/demo runtime glue.
   - `universities/msruas/` and `universities/iitb/` exist as plugins.

2. **No production file exceeds 400 lines**
   - Verified by `npm run architecture:check`.
   - Legacy files in `docs/architecture-line-ratchet.json` only shrink.

3. **Dependency rule enforced**
   - `kernel/` imports nothing from `adapters/`, `universities/`, React, Fastify, or Drizzle.
   - `adapters/web/` imports nothing from `air-mentor-api/src/db/schema`.
   - ESLint `no-restricted-imports` rules enforce this with CI gating.

4. **Lint clean**
   - `npm run lint` exits 0.

5. **All tests pass**
   - `npm test`, `npm --workspace air-mentor-api test`, and e2e suite.

6. **ML training/serving parity**
   - Canonical feature schema in `kernel/risk/`.
   - Contract tests compare Python training output with TypeScript serving on shared fixtures.
   - Mismatches documented and resolved or explicitly accepted.

7. **University plugin system proven**
   - MSRUAS policy extracted into `universities/msruas/`.
   - A second stub (`universities/iitb/`) proves the system is not hardcoded to MSRUAS.

8. **Simulation isolated**
   - No production code imports from `adapters/*/simulation/`.

9. **Agent map regenerated**
   - `docs/agent-map/` updated after each phase.

---

## 3. Constraints and Principles

- **Zero rewrites.** Domain logic is extracted and reorganized, not rewritten.
- **Preserve hierarchical intent.** The scope chain (Institution → … → Student/Faculty) is encoded in types and directory boundaries, never flattened.
- **Incremental extraction.** Each commit must pass build, lint (after Phase 0), architecture check, and tests.
- **Policy over detail.** University-specific rules live in `universities/`. Generic policies live in `kernel/`.
- **One commit per boundary.** A "boundary" is a single extracted file, moved directory, or new fitness gate.
- **Tests move with code.** `tests/` and `tests-e2e/` mirror the new structure.

---

## 4. Target Directory Structure

```
air-mentor-ui/
├── kernel/                          # pure TypeScript, zero framework deps
│   ├── identity/
│   │   ├── session-scope.ts
│   │   ├── role-policy.ts
│   │   ├── hierarchy-policy.ts
│   │   └── index.ts
│   ├── grading/
│   │   ├── grade-band.ts
│   │   ├── attendance-policy.ts
│   │   ├── pass-policy.ts
│   │   ├── sgpa-cgpa-policy.ts
│   │   ├── rounding.ts
│   │   ├── grading-engine.ts
│   │   └── index.ts
│   ├── policy/
│   │   ├── university-plugin.ts
│   │   └── policy-context.ts
│   ├── credit/
│   │   ├── credit-load.ts
│   │   └── backlog-pressure.ts
│   ├── assessment/
│   │   ├── assessment-template.ts
│   │   └── weight-policy.ts
│   ├── risk/
│   │   ├── feature-contract.ts
│   │   ├── feature-schema.ts
│   │   ├── risk-scorer.ts
│   │   ├── driver-inference-engine.ts
│   │   ├── explanation-engine.ts
│   │   ├── model-registry.ts
│   │   └── index.ts
│   ├── curriculum/
│   │   ├── curriculum-graph.ts
│   │   └── prerequisite-policy.ts
│   └── index.ts
├── adapters/
│   ├── web/                         # React UI
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   └── operational-workspace.tsx
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   ├── system-admin-live-app.tsx
│   │   │   │   ├── live-app-model.ts
│   │   │   │   ├── live-app-chrome.tsx
│   │   │   │   ├── sections/
│   │   │   │   │   ├── overview-section.tsx
│   │   │   │   │   ├── students-section.tsx
│   │   │   │   │   ├── faculty-members-section.tsx
│   │   │   │   │   └── entity-editor-modals.tsx
│   │   │   │   └── modals/
│   │   │   ├── faculty/
│   │   │   ├── curriculum/
│   │   │   ├── calendar/
│   │   │   ├── hod/
│   │   │   ├── course/
│   │   │   ├── workflow/
│   │   │   ├── risk/
│   │   │   └── shell/
│   │   ├── shared/
│   │   │   ├── ui/
│   │   │   │   ├── primitives.tsx
│   │   │   │   └── theme.ts
│   │   │   ├── api/
│   │   │   │   └── client.ts
│   │   │   └── state/
│   │   └── simulation/
│   │       ├── fixtures.ts
│   │       ├── proof-surface-shell.tsx
│   │       └── proof-simulation-controls.tsx
│   ├── persistence/                 # Drizzle repositories only
│   │   ├── repositories/
│   │   │   ├── academic-repository.ts
│   │   │   ├── admin-repository.ts
│   │   │   └── user-repository.ts
│   │   └── schema-reference-guard.ts
│   ├── http/                          # Fastify route adapters
│   │   ├── contracts/
│   │   │   ├── session.ts
│   │   │   ├── admin.ts
│   │   │   ├── academic.ts
│   │   │   ├── proof.ts
│   │   │   └── calendar.ts
│   │   ├── controllers/
│   │   │   ├── academic-controller.ts
│   │   │   └── admin-controller.ts
│   │   └── middleware/
│   │       └── auth-middleware.ts
│   └── simulation/
│       ├── proof-control-plane.ts
│       └── scenario-generator.ts
├── universities/
│   ├── msruas/
│   │   ├── grading-system.ts
│   │   ├── pass-rules.ts
│   │   ├── promotion-rules.ts
│   │   ├── assessment-template.ts
│   │   ├── curriculum-loader.ts
│   │   └── canonical-tests.ts
│   └── iitb/                          # stub to prove generality
│       ├── grading-system.ts
│       ├── pass-rules.ts
│       └── assessment-template.ts
├── air-mentor-api/                    # existing API workspace
│   └── src/
│       ├── application/
│       │   ├── ports/                 # repository interfaces
│       │   └── use-cases/
│       ├── modules/                   # thin Fastify modules
│       └── db/
│           └── schema.ts              # referenced only by adapters/persistence
├── tests/
│   ├── unit/
│   │   ├── kernel/
│   │   ├── adapters/
│   │   │   ├── web/
│   │   │   └── persistence/
│   │   └── universities/
│   ├── integration/
│   ├── contracts/
│   └── e2e/
│       └── adapters/web/
├── scripts/
│   ├── check-architecture-boundaries.mjs
│   └── check-import-boundaries.mjs    # new
├── docs/
│   ├── plans/
│   │   └── 2026-07-10-air-mentor-maintainability-refactor.md
│   ├── agent-map/                     # regenerated after each phase
│   ├── architecture-line-ratchet.json
│   └── ARCHITECTURE_GUARDRAILS.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Path Aliases

Add to `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`:

```json
{
  "compilerOptions": {
    "paths": {
      "@kernel/*": ["./kernel/*"],
      "@adapters/*": ["./adapters/*"],
      "@web/*": ["./adapters/web/*"],
      "@http/*": ["./adapters/http/*"],
      "@persistence/*": ["./adapters/persistence/*"],
      "@simulation/*": ["./adapters/simulation/*"],
      "@universities/*": ["./universities/*"]
    }
  }
}
```

Add corresponding aliases to `air-mentor-api/tsconfig.json` so the API can import from `@kernel/*` and `@adapters/http/*`.

---

## 6. Phase Plan

### Phase 0 — Hygiene and CI Gates (1–2 days)

**Goal:** Make the automated quality signals trustworthy before structural work begins.

1. **Auto-fix lint**
   - Run `npx eslint --fix .` across `src/`, `air-mentor-api/src/`, and `tests/`.
   - Review each changed file. Do not apply unsafe fixes.
   - Commit per file family (`src/`, `tests/`, `air-mentor-api/`).

2. **Add `architecture:check` to CI**
   - Edit `.github/workflows/ci-verification.yml`.
   - Add a `architecture` job running `npm run architecture:check`.
   - Ensure it runs before the build/test jobs as a fast fail.

3. **Add ESLint import boundary rules**
   - Add `.eslintrc.cjs` rules using `no-restricted-imports`:
     - `kernel/**` cannot import from `adapters/**`, `universities/**`, `react`, `framer-motion`, `fastify`, `drizzle-orm`.
     - `adapters/web/**` cannot import from `air-mentor-api/src/**`.
   - Allow only `@kernel/*` style imports into `kernel/` from adapters.

4. **Add `knip` for dead-code detection**
   - Install `knip` as a dev dependency.
   - Run `npx knip --no-exit-code` to produce a baseline report.
   - Create `knip.json` with initial ignore list for false positives.

**Verification block per commit:**

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm test
npm --workspace air-mentor-api test
```

**Deliverables:**
- Lint reduced to a manageable number of manual issues.
- CI has `architecture:check` job.
- ESLint boundary rules in place (initially may have grandfathered exceptions).
- `knip.json` committed with baseline report.

---

### Phase 1 — Kernel/Identity + Kernel/Grading + Finish Admin UI (1–2 weeks)

**Goal:** Establish the pure domain foundation and the dependency rule. Finish the in-flight `src/admin/` extractions so no work is left dangling.

#### 1.1 Create `/kernel/` directory and first subdomains

1. Create `/kernel/identity/`:
   - Extract role/scope/hierarchy types from `src/system-admin-live-data.ts` and `air-mentor-api/src/lib/msruas-rules.ts` if applicable.
   - Create `session-scope.ts`, `role-policy.ts`, `hierarchy-policy.ts`.
   - Add pure functions for scope resolution (e.g., `isScopeWithin`, `narrowScope`).

2. Create `/kernel/grading/`:
   - Extract `GradeBand`, `AttendanceRules`, `CondonationRules`, `EligibilityRules`, `PassRules`, `RoundingRules`, `SgpaCgpaRules` from `air-mentor-api/src/lib/msruas-rules.ts`.
   - Move `evaluateAttendanceStatus`, `mapGradeBand`, `roundStatusMark`, `roundToDecimals` into `kernel/grading/`.
   - Define a `GradingEngine` interface and a default implementation.

3. Create `/kernel/policy/`:
   - Define `UniversityPlugin` interface with methods for grading system, pass rules, promotion rules, assessment template, curriculum loader.
   - Define `PolicyContext` that holds the active plugin.

4. Add index/barrel files.

5. Update `msruas-rules.ts` to re-export from `kernel/grading/` and `kernel/identity/` for backward compatibility. Mark it deprecated.

#### 1.2 Wire MSRUAS as the first plugin

1. Create `universities/msruas/`:
   - `grading-system.ts` returns MSRUAS grade bands, rounding rules, pass rules, SGPA/CGPA rules.
   - `pass-rules.ts`, `promotion-rules.ts`, `assessment-template.ts`, `curriculum-loader.ts`.
   - `canonical-tests.ts` with known-good input/output cases.

2. Create `universities/iitb/` as a stub:
   - Different grade bands, different CE/SEE weights, different backlog policy.
   - Enough to prove the plugin interface is generic.

#### 1.3 Finish `src/admin/` extractions

1. Move remaining inline sections out of `system-admin-live-app.tsx`:
   - Action queue rail (already extracted to `src/admin/action-queue-rail.tsx`).
   - Any remaining modal logic.
   - Any remaining coordinator state into the main component only.

2. Reduce `system-admin-live-app.tsx` to a coordinator:
   - State setup.
   - Event handlers.
   - Rendering of extracted sections.
   - Target: under 400 lines by end of Phase 2, but aim for under 1,000 lines by end of Phase 1.

3. Update `src/admin/live-app-model.ts` to re-export from `kernel/identity/` and `kernel/grading/` where appropriate.

**Verification block per commit:**

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm test
npm --workspace air-mentor-api test
```

**Deliverables:**
- `/kernel/identity/` and `/kernel/grading/` exist with tests.
- `/universities/msruas/` exists with canonical tests.
- `/universities/iitb/` stub exists.
- `system-admin-live-app.tsx` reduced to a coordinator.
- `msruas-rules.ts` is a deprecated re-export barrel.

---

### Phase 2 — UI Restructure to `adapters/web/` (2–3 weeks)

**Goal:** Move the UI into the target structure while continuing decomposition.

#### 2.1 Add stable `data-testid` attributes

1. Before moving DOM structure, audit `tests-e2e/` for selectors.
2. Add `data-testid` to key elements in:
   - `system-admin-live-app.tsx`
   - `app/operational-workspace.tsx`
   - `pages/calendar-pages.tsx`
   - `pages/hod-pages.tsx`
   - `pages/course-pages.tsx`
   - `App.tsx`
3. Update e2e specs to use the new `data-testid` selectors.

#### 2.2 Move `src/admin/` to `adapters/web/features/admin/`

1. Move all `src/admin/` files to `adapters/web/features/admin/`.
2. Update imports in `system-admin-live-app.tsx` and other callers.
3. Update tests in `tests/admin/` to `tests/unit/adapters/web/features/admin/`.

#### 2.3 Move `src/api/` to `adapters/web/shared/api/`

1. Move `src/api/client.ts` and `src/api/types.ts`.
2. Update all imports.

#### 2.4 Move remaining `src/` directories into `adapters/web/`

1. `src/app/` → `adapters/web/app/`
2. `src/pages/` → `adapters/web/features/` (split pages into features)
3. `src/hooks/` → `adapters/web/shared/hooks/`
4. `src/components/` → `adapters/web/shared/components/`
5. `src/theme.ts`, `src/ui-primitives.tsx` → `adapters/web/shared/ui/`
6. `src/domain.ts` → split between `kernel/identity/` and `kernel/shared/`.
7. `src/data.ts` → split fixtures to `adapters/web/simulation/fixtures.ts` and runtime types to `kernel/identity/` or `adapters/web/shared/types.ts`.
8. `src/selectors.ts` → move pure selectors to `kernel/`, UI selectors to `adapters/web/shared/state/`.
9. `src/repositories.ts` → move to `adapters/persistence/` or `adapters/web/persistence/` depending on whether the repositories are local-storage only.

#### 2.5 Decompose remaining UI monoliths

1. `app/operational-workspace.tsx` (2,666 lines)
   - Split into `adapters/web/app/operational-shell.tsx`, `operational-sidebar.tsx`, and feature panels.

2. `pages/calendar-pages.tsx` (2,731 lines)
   - Split by route: `calendar-day-page.tsx`, `calendar-week-page.tsx`, `calendar-shell.tsx`, etc.

3. `pages/hod-pages.tsx` (1,169 lines)
   - Split into `hod-dashboard-page.tsx`, `hod-approvals-page.tsx`, etc.

4. `App.tsx` (747 lines)
   - Reduce to route wiring; move route definitions to `adapters/web/app/routes.tsx`.

#### 2.6 Split `src/api/types.ts` monolith

1. Move canonical contracts to `adapters/http/contracts/`.
2. Keep UI-specific view models in `adapters/web/shared/api/view-models/`.
3. Ensure backend can import from `adapters/http/contracts/`.

**Verification block per commit:**

```bash
npm run lint
npm run build
npm run architecture:check
npm test
npm run test:e2e:smoke  # if exists
```

**Deliverables:**
- `adapters/web/` contains all UI code.
- `adapters/http/contracts/` contains canonical API contracts.
- `system-admin-live-app.tsx` under 1,000 lines.
- E2E tests use stable `data-testid` selectors.

---

### Phase 3 — Backend Use-Case / Repository Split (3–4 weeks)

**Goal:** Move business rules out of Fastify route modules and behind repository interfaces.

#### 3.1 Define repository interfaces

1. Create `air-mentor-api/src/application/ports/`.
2. Define one interface per bounded context:
   - `AcademicRepository`
   - `AdminRepository`
   - `UserRepository`
   - `CurriculumRepository`
   - `RiskRepository`
3. Keep interfaces framework-free. They return/accept domain types from `kernel/`.

#### 3.2 Implement Drizzle repositories

1. Create `adapters/persistence/repositories/`.
2. Implement each interface using existing Drizzle schema.
3. Each repository file under 400 lines. Split by entity if needed.

#### 3.3 Migrate route modules one at a time

1. **Priority order:**
   - `air-mentor-api/src/modules/academic.ts`
   - `air-mentor-api/src/modules/admin-structure.ts`
   - `air-mentor-api/src/modules/academic-runtime-routes.ts`
   - `air-mentor-api/src/modules/admin-control-plane.ts`
2. For each module:
   - Identify domain operations.
   - Move domain operations to `air-mentor-api/src/application/use-cases/`.
   - Replace direct DB calls with repository method calls.
   - Keep only HTTP request/response translation in the Fastify module.
   - Add tests for the use case.

#### 3.4 Enforce schema boundary

1. Add ESLint rule or custom script that forbids imports of `../db/schema` outside `adapters/persistence/`.
2. Fix violations incrementally as part of each module migration.

#### 3.5 Move domain types from `air-mentor-api/src/lib/` to `kernel/`

1. Move `msruas-rules.ts` pure policy into `kernel/grading/` and `universities/msruas/`.
2. Keep only adapter-specific serialization in `air-mentor-api/src/lib/`.

**Verification block per commit:**

```bash
npm run lint
npm run build:api
npm run architecture:check
npm --workspace air-mentor-api test
```

**Deliverables:**
- `air-mentor-api/src/application/` has ports and use cases.
- `adapters/persistence/` has Drizzle repository implementations.
- All `air-mentor-api/src/modules/*.ts` files are thin controllers under 400 lines.
- `../db/schema` imports exist only in `adapters/persistence/`.

---

### Phase 4 — ML / Risk Decomposition (2–3 weeks)

**Goal:** Break `air-mentor-api/src/lib/proof-risk-model.ts` and align Python training with TypeScript serving.

#### 4.1 Extract risk domain to `kernel/risk/`

1. `feature-schema.ts` — canonical `OBSERVABLE_FEATURE_KEYS`, versions, feature metadata.
2. `feature-contract.ts` — input/output shape for feature computation.
3. `risk-scorer.ts` — `RiskScorer` interface + default logit scorer.
4. `driver-inference-engine.ts` — maps risk scores to driver explanations.
5. `explanation-engine.ts` — generates human-readable explanations.
6. `model-registry.ts` — production/challenger model artifact versions and thresholds.

#### 4.2 Move artifact types

1. Move `EbmModelArtifact`, `EbmTerm` into `kernel/risk/model-artifact.ts`.
2. Move scenario families into `kernel/risk/scenario.ts`.

#### 4.3 Add contract tests

1. Create `tests/contracts/python-ts-risk-parity/`.
2. Generate Python fixture outputs for a small canonical student set.
3. Add TypeScript tests that load the same fixtures and assert TS serving matches Python within tolerance.
4. Document and resolve mismatches:
   - CE/SEE weight mismatch
   - CGPA update timing
   - Backlog metric mismatch
   - `feat_25` mapping

#### 4.4 Adapter risk services

1. Create `adapters/http/services/risk-service.ts` that orchestrates domain objects.
2. Keep Fastify route module thin.

**Verification block per commit:**

```bash
npm run lint
npm run build:api
npm run architecture:check
npm --workspace air-mentor-api test
python -m pytest tests/contracts/python-ts-risk-parity/  # if Python tests exist
```

**Deliverables:**
- `kernel/risk/` with full domain model and tests.
- Contract tests proving Python/TS parity.
- `proof-risk-model.ts` reduced or removed.

---

### Phase 5 — University Plugin System (1–2 weeks)

**Goal:** Make the platform university-agnostic.

#### 5.1 Finalize `UniversityPlugin` interface

1. In `kernel/policy/university-plugin.ts`:
   - `getGradingSystem(): GradingSystem`
   - `getPassRules(): PassRules`
   - `getPromotionRules(): PromotionRules`
   - `getAssessmentTemplate(): AssessmentTemplate`
   - `getCurriculumLoader(): CurriculumLoader`

#### 5.2 Extract MSRUAS plugin

1. Move all MSRUAS-specific policy from `kernel/` and `air-mentor-api/src/lib/` into `universities/msruas/`.
2. `kernel/` should contain only generic types and interfaces.

#### 5.3 Add IITB stub

1. `universities/iitb/` with different policy defaults.
2. Add tests proving the same student inputs produce different outputs under different plugins.

#### 5.4 Plugin loading

1. Add `PolicyContext` that loads the active plugin from config/env.
2. Update backend controllers to inject `PolicyContext` into use cases.

**Verification block per commit:**

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm test
npm --workspace air-mentor-api test
```

**Deliverables:**
- `universities/msruas/` is a complete plugin.
- `universities/iitb/` is a working stub.
- Backend loads the active plugin from config.
- Tests prove generic engine works with multiple plugins.

---

### Phase 6 — Quality Signals + Fitness Tests (1 week)

**Goal:** Make the architecture self-healing.

#### 6.1 Finish manual lint issues

1. Resolve remaining `no-explicit-any` and unused vars.
2. Where `any` is unavoidable, add `eslint-disable-next-line` with a justification comment.

#### 6.2 Add architecture fitness tests

1. `scripts/check-import-boundaries.mjs`:
   - Scans all `.ts/.tsx` files.
   - Verifies `kernel/` imports only from `kernel/` and built-ins.
   - Verifies `adapters/web/` does not import from `air-mentor-api/src/db/schema`.
   - Verifies `adapters/persistence/` is the only layer importing `drizzle-orm` schema definitions.
2. Add to CI.

#### 6.3 Run `knip` cleanup

1. Run `npx knip`.
2. Remove confirmed dead code or add to ignore list with justification.

#### 6.4 Regenerate agent map and docs

1. Run the context-generation script to update `docs/agent-map/`.
2. Update `ARCHITECTURE_GUARDRAILS.md` if needed.

#### 6.5 Final verification

Run the full verification block and ensure everything passes.

**Verification block:**

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm run test:boundaries    # new fitness test
npm test
npm --workspace air-mentor-api test
npm run test:e2e
npx knip --no-exit-code
```

**Deliverables:**
- Lint clean.
- Architecture fitness tests in CI.
- Dead code removed or explicitly ignored.
- Agent map and docs updated.

---

## 7. Cross-Cutting Concerns

### 7.1 Hierarchical Intent

- `kernel/identity/hierarchy-policy.ts` owns the scope chain.
- UI components receive `scope` props and call `kernel/identity` helpers to narrow/broaden.
- Backend use cases validate scope before querying repositories.
- Directory structure under `adapters/web/features/admin/` mirrors the hierarchy (overview → students → faculty → etc.).

### 7.2 Simulation Isolation

- All files under `adapters/web/simulation/` and `adapters/simulation/` are excluded from production build paths where feasible.
- Production code never imports from simulation paths.
- ESLint enforces this.

### 7.3 API Contract Sharing

- `adapters/http/contracts/` is the single source of truth for request/response shapes.
- Backend controllers validate against these contracts.
- UI client uses these contracts for typing.

### 7.4 Agent Map

- After each phase, run the context-generation script (see `docs/agent-map/` tooling).
- Commit the regenerated files with the message `chore(agent-map): regenerate after Phase N`.

---

## 8. Verification Command Block

Every commit in Phases 1–6 must run this block and pass before commit:

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm test
npm --workspace air-mentor-api test
```

For commits touching e2e tests or UI structure, also run:

```bash
npm run test:e2e:smoke
```

For commits touching risk/ML contract tests, also run:

```bash
npm --workspace air-mentor-api test -- tests/contracts/
```

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Moving files breaks imports across many files | High | Medium | Move one directory at a time; use path aliases; run full build after each move. |
| E2E selectors break during UI decomposition | High | Medium | Add `data-testid` attributes before moving structure. |
| Backend repository migration introduces subtle query changes | Medium | High | Keep tests for each migrated module; compare before/after query outputs on fixtures. |
| ML parity tests reveal deep mismatches | Medium | High | Document each mismatch; fix one at a time; escalate if it requires data pipeline changes. |
| Refactor drags on due to scope creep | Medium | High | One commit per boundary; no tangential features; weekly milestone check against this spec. |
| Lint auto-fix introduces unsafe changes | Low | Medium | Review every auto-fixed file; do not bulk-accept mechanical fixes in critical domain files. |

---

## 10. Rollback Plan

- Each commit is a single extraction or move. If a regression is found, revert the specific commit rather than rolling back a whole phase.
- Keep feature flags or backward-compatible re-export barrels during migration (e.g., `msruas-rules.ts` re-exports from `kernel/grading/`).
- If a module migration destabilizes a route, temporarily keep both the old route and the new controller behind a feature flag until tests pass.

---

## 11. Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Exit state | C — product-shippable | User wants completely sorted codebase |
| Execution mode | A — spec first, then execute | Reduces risk of architectural drift |
| Phase anchor | kernel/grading + identity first | Sets dependency-rule foundation |
| Lint strategy | Auto-fix first | CI lint job currently failing |
| Kernel location | `/kernel/` at repo root | Shared by UI and API |
| Backend migration | Gradual per-module | Lowest risk |
| Commit cadence | One commit per boundary | Atomic, bisectable |
| UI structure | Move to `adapters/web/` now | Aligns with target architecture |
| Test structure | Mirror new structure | Keeps tests discoverable |
| E2E selectors | Add `data-testid` first | Prevents selector churn |
| CI gates | Add `architecture:check` immediately | Prevents file-size backslide |
| Path aliases | Full aliases now | Avoids deep relative imports |
| ML parity | Full contract tests | Required for product-shippable state |
| Simulation isolation | Strict isolation | Target architecture requirement |
| Dead code | `knip` before major moves | Prevents moving dead code |
| Agent map | Regenerate after each phase | Keeps tooling accurate |
| `data.ts` | Split fixtures from runtime types | Separates demo data from domain types |
| API contracts | Shared at `adapters/http/contracts/` | Single source of truth |
| Boundary enforcement | ESLint `no-restricted-imports` | Fast IDE feedback |
| Identity | Include in Phase 1 | Cross-cutting; sets auth boundary early |

---

## 12. Definition of Done for the Whole Refactor

See Section 2 (Exit Criteria). In addition, the following subjective gates must be met:

- A new developer can open the repo and understand where to add a new feature in under 10 minutes.
- A code reviewer can approve a domain change without reading React or Fastify code.
- A university policy change requires edits only in `universities/<name>/`.
- A risk model update requires edits only in `kernel/risk/` and `adapters/simulation/`.

---

## 13. Appendix: Known Monoliths to Track

| File | Current Lines | Target | Phase |
|---|---|---|---|
| `src/system-admin-live-app.tsx` | 5,496 | < 400 | 2 |
| `air-mentor-api/src/modules/academic.ts` | 4,758 | < 400 | 3 |
| `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | 5,554 | split | 4 |
| `air-mentor-api/src/lib/proof-risk-model.ts` | 3,190 | split | 4 |
| `air-mentor-api/src/db/schema.ts` | 1,539 | < 400 or kept as schema-only | 3 |
| `src/api/types.ts` | 2,929 | < 400 per contract file | 2 |
| `src/data.ts` | 1,301 | split / removed | 2 |
| `src/pages/calendar-pages.tsx` | 2,731 | < 400 per page | 2 |
| `src/app/operational-workspace.tsx` | 2,666 | < 400 | 2 |
| `src/repositories.ts` | 937 | < 400 | 2 |

---

*Spec ready for implementation. Recommended next step: delegate to `absolute-human` for execution, or begin Phase 0 manually.*
