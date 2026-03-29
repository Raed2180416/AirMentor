# AirMentor Issue Catalog Prioritized

## What this area does
This is the canonical issue ledger for the forensic audit. Each issue uses one shared namespace and full template so the subsystem audits, issue map, roadmap, and stakeholder summary can all refer to the same root findings.

## Confirmed observations
- The issues below are grounded in active code, tests, scripts, configs, or tracked artifacts.
- Repeated manifestations are intentionally grouped under shared root issues rather than listed as separate local defects.

## Current-state reconciliation (2026-03-29)
This issue catalog was authored before several remediation slices landed. The canonical current-state status is now:

| Issue | Current status | Reconciliation note |
| --- | --- | --- |
| AM-001 | Partial | frontend shells, backend route ownership, and proof services are split, but the hotspot files are still large |
| AM-002 | Mostly resolved | `#/` is neutral again and restore state is explicit/resettable; low-risk convenience persistence still remains |
| AM-003 | Mostly resolved | narrow task/task-placement/calendar routes exist, `/sync` routes are now compatibility-only, deprecated, and explicitly marked with deprecation headers, narrow per-entity writes no longer update runtime shadow, first-party runtime writes no longer use the generic runtime route, shadow-only task/placement/calendar extras are ignored once authoritative rows exist, and observed-state decoding is centralized; compatibility-retirement work still remains |
| AM-004 | Partial | academic access is more centralized, but full scope logic is still not unified end-to-end |
| AM-005 | Mostly resolved | proof restore/blocking/diagnostic messaging improved, the student-shell trust legend now sits next to the deterministic shell surface, and remaining validation is mainly deployed/user-interpretation work |
| AM-006 | Mostly resolved | proof dashboard/access/batch/checkpoint/playback/playback-reset/playback-governance/policy/rebuild-context/section-risk/runtime/live-run/seeded-bootstrap/seeded-scaffolding/seeded-semester/seeded-run/stage-summary/tail services now exist, and `msruas-proof-control-plane.ts` is materially smaller, though still a large facade |
| AM-007 | Partial | curriculum linkage approval now separates approval from proof-refresh queue success; helper brittleness remains |
| AM-008 | Mostly resolved | CI workflows, telemetry, local retained operational events, proof-dashboard surfacing, startup diagnostics, repo hygiene gates, optional telemetry sink forwarding, and Railway deploy preflight/diagnostics now exist; live sink provisioning and broader production analytics still remain |
| AM-009 | Mostly resolved | shell structure improved and live keyboard, axe/browser, accessibility-tree regression coverage, direct modal focus-trap/restore coverage, and a generated screen-reader preflight transcript now exist; the remaining gap is the final human assistive-tech pass |
| AM-010 | Resolved | mock-admin runtime/tests/scripts are gone and the root prototype/temp/PDF clutter has been removed or ignored appropriately |
| AM-011 | Partial | proof dashboard now exposes queue/lease/retry/checkpoint diagnostics and recent operational events; operability is improved but still not fully mature |
| AM-012 | Partial | authoritative-first bootstrap, compatibility-only shadow routes, and central observed-state decoding exist, but immutable replay snapshots still remain JSON-heavy by design |
| AM-013 | Mostly resolved | non-deploy verification and proof-browser cadence now exist, `verify:final-closeout*` now provide an explicit deterministic closeout bar, compatibility-route inventory assert mode is enforced by the closeout scripts, and the live closeout bar is now green against the deployed Pages + Railway stack |
| AM-014 | Partial | restore-state visibility is better, but request/process complexity still remains |
| AM-015 | Partial | startup diagnostics, repo hygiene gates, CI checks, Railway variable preflight, Railway deploy log capture, and readiness-health checks now exist; deployment/env drift is still a product risk, but the stale live Railway rollout was resolved on `2026-03-29` |
| AM-016 | Mostly resolved | login throttling and CSRF tokens exist; throttling is now DB-backed, production-like startup requires an explicit CSRF secret, and both repo-local and live session-security checks are now green |

The detailed issue bodies below still matter, but some older evidence lines are now historical rather than current. Use [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md) together with this catalog when deciding what is actually still open.

## Key workflows and contracts
### Prioritization rubric
- `Critical`: threatens correctness, change safety, or platform trust across multiple layers.
- `High`: materially harms maintainability, reliability, or major user journeys.
- `Medium`: meaningful product or engineering debt with narrower blast radius or lower immediacy.
- `Low`: local or cosmetic debt not currently shaping core risk.

## Findings
### AM-001 Monolithic Runtime Orchestrators Create Systemic Change Risk
Severity: Critical
Confidence: High
Type: systemic | cross-layer | tech-debt amplifier
Detection gap: Regressions often surface only after cross-feature manual exercise because the dominant files coordinate many unrelated behaviors.

#### Summary
AirMentor’s most important runtime behavior is concentrated in four oversized files. That concentration means a small change in one feature often carries hidden consequences for unrelated screens, scope rules, or proof flows.

#### Where it appears
- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Related symbols:
  - `SystemAdminLiveApp`
  - `buildAcademicBootstrap`
  - `resolveStudentShellRun`
  - `buildHodProofAnalytics`
  - `buildFacultyProofView`
  - `buildStudentAgentCard`
  - `buildStudentRiskExplorer`
  - `startStudentAgentSession`
  - `sendStudentAgentMessage`

#### What is happening
These files each own multiple responsibilities at once: session behavior, route state, page composition, domain transformation, scope filtering, proof shaping, and transport integration. The code is not merely large; it is structurally dense.

#### Why this is a problem
- Technical consequence: low local reasoning and high regression risk.
- User consequence: fixes in one area can destabilize unrelated journeys.
- Product consequence: shipping new capability gets slower and riskier over time.
- Operational consequence: incident debugging requires broad context and specific tribal knowledge.

#### Root cause
Feature growth accumulated inside successful orchestration surfaces instead of being extracted into smaller domain services once those surfaces proved the product model.

#### Cross-file relationships
- `src/repositories.ts` and `src/api/client.ts` feed both major frontend orchestrators.
- `academic.ts` and `msruas-proof-control-plane.ts` jointly assemble proof-facing academic responses.
- `system-admin-live-data.ts` and `admin-structure.ts` add further cross-file coupling for scope and admin state.

#### How it shows up in the UI/UX
- Dense, multi-purpose screens.
- Hidden dependencies between role switching, route state, and proof context.
- Large surface areas where small UI changes can affect unrelated behavior.

#### Recommended fix
- Split by bounded domain responsibility, not just by helper extraction.
- Create thinner route registrars and thinner UI shells.
- Give proof assembly, request workflow, runtime sync, and scope resolution their own smaller modules.
- Roll out incrementally behind unchanged contracts to reduce migration risk.

#### Priority rationale
This is the highest-leverage issue in the repo. It amplifies almost every other risk.

### AM-002 Split Persistence Model Creates Hidden State And User Confusion
Severity: High
Confidence: High
Type: systemic | cross-layer | product/UX mismatch | tech-debt amplifier
Detection gap: The default tests validate utilities and routes, but hidden storage interactions are mostly exposed by manual reload and navigation behavior.

#### Summary
AirMentor stores meaningful runtime state in React state, backend tables, local storage, and session storage at the same time. That makes restored state convenient but also unpredictable.

#### Where it appears
- `src/repositories.ts`
- `src/portal-routing.ts`
- `src/proof-playback.ts`
- `src/system-admin-live-app.tsx`
- Related symbols:
  - `createLocalAirMentorRepositories`
  - `createHttpSessionPreferencesRepository`
  - `createHttpAcademicRepositories`
  - `resolvePortalRoute`
  - `readProofPlaybackSelection`
  - `writeProofPlaybackSelection`

#### What is happening
The frontend restores portal hints, current faculty/admin identities, proof checkpoint selection, route snapshots, dismissed queue items, and local runtime slices from browser storage while also hydrating backend data and persisting server-owned slices.

#### Why this is a problem
- Technical consequence: unclear source of truth and overwrite risk.
- User consequence: route or checkpoint restoration can feel surprising.
- Product consequence: convenience features can reduce trust if not clearly surfaced.
- Operational consequence: debugging often becomes a storage-state investigation.

#### Root cause
The system preserves local-first and backend-first patterns simultaneously.

#### Cross-file relationships
- Storage hints in `portal-routing.ts`
- Runtime slices in `repositories.ts`
- Proof playback in `proof-playback.ts`
- Admin route persistence in `system-admin-live-app.tsx`, currently narrowed to `faculties` route-state restore plus scroll restoration
- Academic invalid-checkpoint fallback in `App.tsx`
- Backend runtime sync in `academic.ts`

#### How it shows up in the UI/UX
- Returning to a portal or proof surface with remembered state the user did not explicitly reselect.
- Deep-link and reload behavior that depends on hidden session storage.

#### Recommended fix
- Establish a per-domain source-of-truth policy.
- Keep only low-risk convenience state in browser storage.
- Add visible session-restore affordances and reset controls.

#### Priority rationale
This is a direct user-trust and maintainability issue that also complicates every state-related bug.

### AM-003 Heavy Bootstrap And Coarse Sync Contracts Increase Drift Risk
Severity: Critical
Confidence: High
Type: systemic | cross-layer | tech-debt amplifier
Detection gap: Build and fast tests do not fully capture large-scale payload or concurrent-edit problems.

#### Summary
AirMentor relies on broad bootstrap responses and coarse whole-slice synchronization for important runtime data. That makes the system easy to wire initially but fragile as datasets and concurrency grow.

#### Where it appears
- `air-mentor-api/src/modules/academic.ts`
- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `src/api/client.ts`
- Related symbols/endpoints:
  - `buildAcademicBootstrap`
  - `/api/academic/bootstrap`
  - `/api/academic/runtime/:stateKey`
  - `/api/academic/tasks/sync`
  - `/api/academic/task-placements/sync`
  - `/api/academic/calendar-audit/sync`

#### What is happening
The academic workspace depends on large aggregate bootstrap responses and still carries a coarse compatibility route for generic runtime slices. Narrow entity routes now cover task, task-placement, and calendar-audit writes, first-party runtime writes no longer go through the generic runtime route, and bootstrap now ignores shadow-only task/placement/calendar extras once authoritative rows exist, but runtime/proof fact normalization is still incomplete.

#### Why this is a problem
- Technical consequence: harder merge/conflict behavior and broader rerender pressure.
- User consequence: stale or overwritten runtime state can appear after reload or multi-step editing.
- Product consequence: performance and predictability will degrade as institutional data grows.
- Operational consequence: support teams have fewer precise points to inspect when state drifts.

#### Root cause
The architecture prioritized rapid parity between local state and live backend behavior over tighter domain-specific persistence contracts.

#### Cross-file relationships
- `src/repositories.ts` HTTP mode
- `src/selectors.ts`
- backend runtime tables such as `academic_runtime_state`, `academic_tasks`, `academic_task_placements`

#### How it shows up in the UI/UX
- Slow-loading composite screens.
- Runtime edits that can feel “all or nothing.”
- Greater sensitivity to reloads and route changes.

#### Recommended fix
- Split bootstrap into smaller domain loaders where feasible.
- Move from whole-slice sync toward entity-scoped or operation-scoped saves.
- Add versioning or conflict handling at narrower granularity.

#### Priority rationale
This is both a correctness risk and a medium-term scalability ceiling.

### AM-004 Scope And Authorization Logic Is Correct In Places But Too Scattered
Severity: High
Confidence: High
Type: systemic | cross-layer | security/privacy | product/UX mismatch
Detection gap: Scope denial is tested for several proof routes, but global reasoning across all domains remains manual.

#### Summary
AirMentor enforces important scope rules, but the logic is spread across shared auth helpers, route modules, UI visibility helpers, and proof composition helpers. That makes the system harder to reason about and easier to drift.

#### Where it appears
- `air-mentor-api/src/modules/support.ts`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- `src/system-admin-live-data.ts`
- Related symbols:
  - `resolveRequestAuth`
  - `requireRole`
  - `resolveProofReassessmentAccess`
  - `isFacultyProofQueueItemVisible`
  - `isFacultyProofStudentVisible`
  - `isAcademicFacultyVisible`
  - `isDepartmentVisible`

#### What is happening
The codebase mixes generic role-grant enforcement with feature-specific scope filters and UI visibility helpers. There is no single policy layer that fully explains who can see which academic, proof, or admin records.

#### Why this is a problem
- Technical consequence: higher policy drift risk.
- User consequence: access-denied or empty-state behavior can feel inconsistent.
- Product consequence: trust suffers if users cannot predict what they should be able to see.
- Operational consequence: security review and change review are harder.

#### Root cause
Scope behavior evolved alongside features instead of being centralized as a first-class policy engine.

#### Cross-file relationships
- Session grants from `session.ts`
- UI visibility helpers in `system-admin-live-data.ts`
- proof access rules in `academic.ts` and `msruas-proof-control-plane.ts`

#### How it shows up in the UI/UX
- Some users see empty proof surfaces while others see detailed panels for similarly named routes.
- Scope reasoning depends on role, branch, mentorship, course ownership, run status, and checkpoint context.

#### Recommended fix
- Introduce centralized access-evaluation functions by domain.
- Reuse the same policy object for backend enforcement and frontend empty-state messaging.
- Add a small diagnostic explanation layer for denied or empty proof surfaces.

#### Priority rationale
This issue shapes correctness, privacy, and UX clarity simultaneously.

### AM-005 The Product Uses Careful Proof Language, But Capability Framing Can Still Overpromise
Severity: Medium
Confidence: High
Type: product/UX mismatch | model-behavior mismatch
Detection gap: The current tests enforce bounded language, but not whether users correctly understand the limits of the feature.

#### Summary
The proof UIs are more honest than typical AI surfaces, but names like “student shell” and “risk explorer” can still encourage assumptions that exceed the deterministic and checkpoint-bound reality of the implementation.

#### Where it appears
- `src/pages/student-shell.tsx`
- `src/pages/risk-explorer.tsx`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- related tests in `tests/student-shell.test.tsx`, `tests/risk-explorer.test.tsx`, `air-mentor-api/tests/student-agent-shell.test.ts`, `air-mentor-api/tests/risk-explorer.test.ts`

#### What is happening
The system presents faculty-facing explanatory interfaces with carefully bounded copy, but those surfaces still package deterministic and calibrated outputs inside a UX that users may interpret as more adaptive or conversational than it really is.

#### Why this is a problem
- Technical consequence: users may misattribute deterministic outputs to generic AI reasoning.
- User consequence: surprise when future-certainty questions are blocked or when outputs repeat deterministically.
- Product consequence: brand trust can erode if perceived capability and actual capability diverge.
- Operational consequence: support burden shifts to expectation management rather than bug fixing.

#### Root cause
The product is trying to combine approachable AI-flavored surfaces with a deliberately bounded evidence system.

#### Cross-file relationships
- deterministic shell reply builders
- provenance and support-warning display in risk explorer
- proof checkpoint context carried from admin proof playback into academic surfaces

#### How it shows up in the UI/UX
- Users may expect broader advice or prediction than the shell is designed to provide.
- Suppressed probabilities or guardrail replies can feel arbitrary without more visible explanation.

#### Recommended fix
- Keep the bounded framing, but add more explicit “what this can and cannot answer” microcopy.
- Surface when an answer is deterministic, checkpoint-specific, and evidence-bounded.

#### Priority rationale
This matters for trust, but the foundation is already stronger than many similar products.

### AM-006 Proof Orchestration Is Too Concentrated In One Mega-Module
Severity: Critical
Confidence: High
Type: systemic | cross-layer | model-behavior mismatch | tech-debt amplifier
Detection gap: Many proof behaviors are covered, but diagnosis still bottlenecks on understanding one enormous file.

#### Summary
`air-mentor-api/src/lib/msruas-proof-control-plane.ts` is the single biggest architectural risk in the repository. It combines simulation logic, feature shaping, checkpoint assembly, policy comparison, risk explorer payloads, student shell behavior, and analytics.

#### Where it appears
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Related exported symbols:
  - `startProofSimulationRun`
  - `buildProofBatchDashboard`
  - `buildHodProofAnalytics`
  - `buildFacultyProofView`
  - `getProofStudentEvidenceTimeline`
  - `buildStudentAgentCard`
  - `buildStudentRiskExplorer`
  - `startStudentAgentSession`
  - `sendStudentAgentMessage`

#### What is happening
The proof system’s core responsibilities are implemented as one macro-library instead of a composition of smaller services with explicit contracts.

#### Why this is a problem
- Technical consequence: extreme cognitive load and high regression risk.
- User consequence: proof defects are harder to fix quickly.
- Product consequence: adding or changing proof features becomes progressively more expensive.
- Operational consequence: one-file expertise becomes a bottleneck.

#### Root cause
The proof platform accumulated by extending a successful seeded orchestration layer rather than splitting responsibilities as the feature set matured.

#### Cross-file relationships
- `admin-proof-sandbox.ts`
- `academic.ts`
- `proof-run-queue.ts`
- `proof-risk-model.ts`
- `inference-engine.ts`
- `monitoring-engine.ts`
- `graph-summary.ts`

#### How it shows up in the UI/UX
- Proof surfaces are rich, but their correctness depends on a single concentrated backend assembly path.

#### Recommended fix
- Split into services for:
  - simulation execution
  - checkpoint assembly
  - scoring and diagnostics
  - HoD analytics
  - faculty proof payloads
  - student shell composition
  - risk explorer composition

#### Priority rationale
This is the largest single maintainability and correctness risk in the ML/proof platform.

### AM-007 Curriculum Linkage Is Operationally Brittle
Severity: Medium
Confidence: High
Type: cross-layer | model-behavior mismatch | tech-debt amplifier
Detection gap: Linkage quality and failure behavior are not richly instrumented.

#### Summary
Curriculum linkage is a meaningful subsystem with optional NLP assistance, but it introduces external runtime dependencies and a more fragile execution path than the rest of the platform.

#### Where it appears
- `air-mentor-api/src/modules/admin-structure.ts`
- `air-mentor-api/src/lib/curriculum-linkage.ts`
- `air-mentor-api/src/lib/curriculum-linkage-python.ts`
- `air-mentor-api/scripts/curriculum_linkage_nlp.py`
- endpoints under `/api/admin/batches/:batchId/curriculum/linkage-candidates*`

#### What is happening
The system generates linkage candidates, optionally consults a Python/NLP helper and local-model configuration, and then allows admin review or approval to propagate changes and queue proof refresh behavior.

#### Why this is a problem
- Technical consequence: more moving parts and environment variance.
- User consequence: candidate quality or availability can vary without clear UI explanation.
- Product consequence: curriculum governance can feel less trustworthy than the rest of the deterministic proof stack.
- Operational consequence: failures span TypeScript, Python, and local-model runtime configuration.

#### Root cause
The subsystem tries to provide intelligent linkage assistance without fully isolating or instrumenting that assistance path.

#### Cross-file relationships
- approval and regeneration in `admin-structure.ts`
- optional OLLAMA configuration
- proof refresh enqueue behavior after approval

#### How it shows up in the UI/UX
- Linkage candidates can appear like smart recommendations without exposing much runtime health or provenance detail.

#### Recommended fix
- Treat linkage as a separately observable subsystem.
- Surface provenance and fallback mode more clearly.
- Add deterministic fallback reporting when NLP assistance is unavailable.

#### Priority rationale
Important, but less urgent than the core orchestration and state-authority issues.

### AM-008 Missing Production Observability Makes Quality Hard To Improve
Severity: High
Confidence: High
Type: systemic | cross-layer | tech-debt amplifier
Detection gap: This issue is itself a detection gap.

#### Summary
AirMentor has audit tables and tests, and it now retains operational telemetry locally and surfaces recent events in the proof dashboard. It still lacks a broader production observability layer, which prevents the team from measuring user pain, proof degradation, or operational failures with confidence.

#### Where it appears
- Runtime code across frontend and backend
- `air-mentor-api/src/app.ts`
- `air-mentor-api/src/lib/operational-event-store.ts`
- `air-mentor-api/src/lib/proof-control-plane-batch-service.ts`
- `src/system-admin-proof-dashboard-workspace.tsx`
- absence of analytics or error-reporting integrations in tracked runtime code
- smoke scripts rely on console output rather than production telemetry

#### What is happening
The platform mostly depends on tests, audit tables, manual debugging, and acceptance scripts rather than structured runtime metrics, tracing, error aggregation, or product analytics. The repo-local telemetry path now persists retained events, but that is still not the same as a provisioned observability stack.

#### Why this is a problem
- Technical consequence: hard-to-diagnose regressions and degraded paths.
- User consequence: issues are more likely to be discovered by end users first.
- Product consequence: prioritization is less evidence-based.
- Operational consequence: queue problems, proof load failures, or UX pain are under-measured.

#### Root cause
The repository invested heavily in correctness-by-construction and seeded verification, but not enough in operational visibility.

#### Cross-file relationships
- proof queue
- bootstrap endpoints
- shell and risk explorer loads
- curriculum linkage runtime
- request workflow

#### How it shows up in the UI/UX
- Users may see missing proof data, stale context, or load errors without the system giving the team enough downstream evidence to diagnose quickly.

#### Recommended fix
- Add metrics, tracing, and error aggregation for key journeys.
- Record proof-run lifecycle metrics, bootstrap latency, shell/risk load failures, and linkage helper failures.
- Keep the retained local event surface and proof-dashboard observability card, but do not mistake them for a production sink.
- Add product analytics around role usage, proof surface entry, and abandonment points.

#### Priority rationale
This is prerequisite infrastructure for scaling quality work efficiently.

### AM-009 Accessibility And Information-Density Debt Limits Usability
Severity: Medium
Confidence: Medium
Type: systemic | product/UX mismatch
Detection gap: Dedicated live keyboard, axe/browser, accessibility-tree regression, and a generated screen-reader preflight transcript now exist, but the final human assistive-technology pass is still absent.

#### Summary
The product’s custom dense UIs likely create keyboard, focus, semantic, and cognitive accessibility problems, especially on admin and proof-heavy screens. The repo now has direct modal focus and tab-semantics coverage, but that does not eliminate the underlying density risk.

#### Where it appears
- `src/ui-primitives.tsx`
- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `src/pages/student-shell.tsx`
- `src/pages/risk-explorer.tsx`
- `src/pages/hod-pages.tsx`
- `tests/system-admin-accessibility-contracts.test.tsx`
- `tests/ui-primitives-modal.test.tsx`

#### What is happening
The app uses large amounts of custom-styled inline UI with dense layouts and bespoke interactions. Live accessibility automation now exists, and the modal focus contract plus tab semantics are covered directly, but the product still depends heavily on custom semantics and dense information hierarchy.

#### Why this is a problem
- Technical consequence: accessibility bugs are hard to systematically prevent.
- User consequence: keyboard and assistive-technology users face elevated friction.
- Product consequence: institutional trust and adoption can suffer.
- Operational consequence: retrofitting accessibility later will be expensive.

#### Root cause
UI implementation prioritized feature coverage and visual control over reusable accessible primitives and explicit accessibility verification.

#### Cross-file relationships
- shared UI primitives
- proof pages
- system-admin shell

#### How it shows up in the UI/UX
- Dense multitask screens.
- Likely inconsistent focus behavior across tabs, panels, and route changes.

#### Recommended fix
- Add accessibility test automation and extract accessible primitives.
- Keep the existing direct contract tests for tab semantics and modal focus behavior as regression guards.
- Simplify information hierarchy on high-density screens.

#### Priority rationale
Material user-impact issue, but not the highest systemic risk compared with architecture and state authority.

### AM-010 Repo Drift And Dead Artifacts Blur The Real Product Surface
Severity: Medium
Confidence: High
Type: local | tech-debt amplifier
Detection gap: Repo drift usually shows up in developer confusion rather than runtime failure.

#### Summary
The mock-admin runtime path and the tracked root-level prototype/PDF artifacts have been removed, and the local temp `.cjs` probes are now ignored. Remaining hygiene pressure is limited to generated outputs rather than tracked runtime-surface confusion.

#### Where it appears
- `air-mentor-api/scripts/__pycache__/curriculum_linkage_nlp.cpython-313.pyc`

#### What is happening
Tracked root-level drift has been cleaned up. The remaining artifact note is now limited to ignored/generated outputs such as the linkage-helper bytecode cache.

#### Why this is a problem
- Technical consequence: extra maintenance burden and search noise.
- User consequence: indirect, through slower engineering and more fragile ownership.
- Product consequence: signals incomplete decommissioning of old concepts.
- Operational consequence: increases risk of editing or testing the wrong surface.

#### Root cause
Transition artifacts were retained inside the main repo rather than archived or deleted once the live path became authoritative.

#### Cross-file relationships
- the current repo still contains root-level artifacts that are not part of the live runtime, even though the mock admin runtime path itself is now gone

#### How it shows up in the UI/UX
- Mostly indirect. It shapes engineering clarity more than direct user behavior.

#### Recommended fix
- Remove or archive dormant and stray artifacts.
- Keep only live or intentionally maintained experimental surfaces.

#### Priority rationale
Useful cleanup, but secondary to systemic architecture and runtime correctness issues.

### AM-011 Queue Worker Operability Is Under-Instrumented For Such A Critical Subsystem
Severity: High
Confidence: High
Type: systemic | cross-layer | tech-debt amplifier
Detection gap: Queue health is not richly surfaced to operators or telemetry.

#### Summary
The proof queue has sensible lease mechanics, and the proof dashboard now exposes queue diagnostics plus recent operational events, but its operability still depends on code understanding and manual scripts more than rich runtime visibility.

#### Where it appears
- `air-mentor-api/src/lib/proof-run-queue.ts`
- `air-mentor-api/src/app.ts`
- `air-mentor-api/src/modules/admin-proof-sandbox.ts`
- `scripts/system-admin-proof-risk-smoke.mjs`
- `air-mentor-api/src/lib/proof-control-plane-batch-service.ts`
- `src/system-admin-proof-dashboard-workspace.tsx`

#### What is happening
Queued proof runs are claimed, heartbeated, and finalized by a background worker. When checkpoints are missing, operators or smoke scripts may need to recompute or prewarm lifecycle steps to restore expected proof state.

#### Why this is a problem
- Technical consequence: queue issues can masquerade as UI or access issues.
- User consequence: proof surfaces may look incomplete or unavailable.
- Product consequence: proof trust depends on operational freshness.
- Operational consequence: poor visibility into stuck, failed, or delayed runs.

#### Root cause
The worker design is functional, but observability and operator tooling did not keep pace with the importance of the subsystem.

#### Cross-file relationships
- proof dashboard reads queue/run state
- proof smoke script prewarms missing lifecycle steps
- academic proof endpoints rely on the existence of active run artifacts

#### How it shows up in the UI/UX
- Missing checkpoint playback.
- Proof views with incomplete data until recompute or rerun occurs.

#### Recommended fix
- Add queue dashboards and metrics.
- Surface stale or incomplete proof state explicitly in the UI.
- Keep the recent operational-event feed in the proof dashboard because it makes operator state easier to audit.
- Record retry counts and checkpoint materialization latency.

#### Priority rationale
High-value reliability work because proof trust depends on it.

### AM-012 JSON-Heavy Snapshot Design Weakens State Clarity
Severity: High
Confidence: High
Type: systemic | cross-layer | tech-debt amplifier
Detection gap: Drift across serialized snapshots is hard to detect automatically.

#### Summary
The database models real domain entities well, but many important runtime and proof concepts are still persisted as JSON snapshots. That weakens inspectability and makes source-of-truth reasoning harder.

#### Where it appears
- `air-mentor-api/src/db/schema.ts`
- `air-mentor-api/src/lib/json.ts`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- especially tables such as `academic_runtime_state`, `risk_evidence_snapshots`, `student_observed_semester_states`, `student_agent_cards`, `simulation_runs`

#### What is happening
Structured payloads are frequently serialized into JSON strings and then rehydrated later for rendering, replay, or runtime synchronization.

#### Why this is a problem
- Technical consequence: weaker DB constraints and harder debugging.
- User consequence: stale or mismatched snapshot behavior can surface indirectly.
- Product consequence: replay and evidence trust are harder to explain cleanly.
- Operational consequence: ad hoc querying and repair work become more expensive.

#### Root cause
The platform optimized for fast feature evolution and snapshot portability more than normalized introspection.

#### Cross-file relationships
- JSON parsing helpers
- proof artifact shaping
- runtime slice sync
- bootstrap composition

#### How it shows up in the UI/UX
- Data can appear consistent on one surface and stale on another if different snapshots are being read or refreshed on different cycles.

#### Recommended fix
- Normalize the most operationally important snapshot fields into first-class relational facts.
- Keep immutable snapshot records for replay where needed, but do not use them as the only authoritative representation.

#### Priority rationale
Foundational issue that compounds debugging and runtime drift.

### AM-013 Verification Is Strong On Contracts But Weak On Heavy Holistic Flows
Severity: High
Confidence: High
Type: systemic | tech-debt amplifier
Detection gap: Heavy proof and browser flows are not part of the main fast verification baseline.

#### Summary
The repository’s automated coverage is better than average for a product this size, but the strongest holistic proof/admin flows are either browser scripts outside default runs or proof-rc-gated backend tests. The closeout scripts now also assert compatibility-route caller cleanliness and collect structured JSON evidence from the key browser flows.

#### Where it appears
- frontend tests under `tests/`
- backend tests under `air-mentor-api/tests/`
- `air-mentor-api/scripts/run-vitest-suite.mjs`
- `package.json`
- `air-mentor-api/tests/admin-control-plane.test.ts`
- `scripts/system-admin-live-acceptance.mjs`
- `scripts/system-admin-live-request-flow.mjs`
- `scripts/system-admin-proof-risk-smoke.mjs`
- `scripts/system-admin-teaching-parity-smoke.mjs`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/deploy-railway-api.yml`
- `scripts/report-compat-route-callers.mjs`
- `scripts/verify-final-closeout.sh`
- `scripts/verify-final-closeout-live.sh`

#### What is happening
Fast baseline tests validate many contracts, while the heaviest end-to-end scenarios still depend on proof-rc and browser suites that are separate from the default fast baseline. The backend runner hard-codes proof-heavy exclusions, the root `verify:proof-closure*` scripts still encode a stronger integrated proof confidence bar than a plain local green run, the closeout scripts now assert compatibility-route cleanliness, and CI is materially stronger because non-deploy verification and scheduled proof/browser cadence exist.

#### Why this is a problem
- Technical consequence: some important regressions will escape default verification.
- User consequence: regressions may be found later in manual QA or user flows.
- Product consequence: quality confidence for the most impressive proof features is lower than it appears at a glance.
- Operational consequence: release readiness depends on additional discipline outside baseline commands.

#### Root cause
The full proof/admin/browser flows are expensive enough that they were separated from the fast suite, but no equivalent always-on detection layer replaced them.

#### Cross-file relationships
- seeded test harness
- proof queue governance
- browser acceptance scripts and wrappers that also bootstrap the environment
- deploy workflows that can skip real deploy or post-deploy health verification based on missing variables

#### How it shows up in the UI/UX
- Heavy proof and request flows can regress even while fast tests remain green.

#### Recommended fix
- Keep the new CI/browser cadence mandatory and visible.
- Continue adding telemetry and artifact-freshness checks to catch regressions that tests still miss.

#### Priority rationale
This is a force multiplier for the other issues because it weakens early detection.

### AM-014 Request Workflow And Restored Route State Create UX Friction
Severity: Medium
Confidence: High
Type: cross-layer | product/UX mismatch
Detection gap: The browser request-flow script covers happy-path persistence, not broader user confusion or alternative task paths.

#### Summary
The request system works end-to-end, but it exposes workflow mechanics more than user intent, and its deep-link plus restored-route behavior increases cognitive load.

#### Where it appears
- `src/system-admin-live-app.tsx`
- `air-mentor-api/src/modules/admin-requests.ts`
- `scripts/system-admin-live-request-flow.mjs`
- `scripts/system-admin-live-acceptance.mjs`

#### What is happening
Users open request detail, progress statuses through action buttons, and rely on route-specific detail persistence. The workflow is functional but process-heavy. The backend transition graph is rigid:
- `New -> In Review | Rejected`
- `In Review -> Needs Info | Approved | Rejected`
- `Needs Info -> In Review | Rejected`
- `Approved -> Implemented | Rejected`
- `Rejected -> Closed`
- `Implemented -> Closed`

#### Why this is a problem
- Technical consequence: request behavior is tightly coupled to detail state and route restoration.
- User consequence: next steps and consequences are not always obvious from button labels alone.
- Product consequence: the workflow feels more like an internal state machine than a guided operations tool.
- Operational consequence: inconsistent mental models can create unnecessary support or training effort.

#### Root cause
The workflow was designed around backend status transitions first and user explanation second.

#### Cross-file relationships
- request detail loading in the admin UI
- transition routes in `admin-requests.ts`
- audit and note history

#### How it shows up in the UI/UX
- Dense detail panels.
- Deep-linked request pages that persist on reload.
- Action verbs that assume prior process knowledge.

#### Recommended fix
- Add inline consequences and next-step descriptions for each action.
- Make restored request context explicit.
- Collapse or sequence less-critical detail sections by default.

#### Priority rationale
Moderate product pain with clear UX payoff, but not a platform blocker.

### AM-015 Deployment And Environment Configuration Are Fragile To Drift
Severity: Medium
Confidence: High
Type: cross-layer | tech-debt amplifier
Detection gap: Environment drift is mostly caught only when deployments or local live runs fail.

#### Summary
AirMentor depends on coordinated frontend, backend, proxy, and deployment configuration. Misconfiguration quickly becomes a user-visible outage or a frontend hard-stop, so the Railway deploy workflow now captures deploy logs and uses an explicit readiness-health probe.

#### Where it appears
- `vite.config.ts`
- `src/system-admin-app.tsx`
- `src/App.tsx`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/deploy-railway-api.yml`
- `air-mentor-api/railway.json`
- `air-mentor-api/src/config.ts`
- `scripts/check-railway-deploy-readiness.mjs`

#### What is happening
The frontend expects `VITE_AIRMENTOR_API_BASE_URL`, optionally relies on a local proxy target, and the backend expects correct cookie, origin, DB, and Railway settings. Local live mode also assumes seeded-server bootstrapping, embedded Postgres, dynamic API-port allocation, and a same-origin Vite proxy path. Startup diagnostics now exist, the Railway readiness script has boot-smoke and health-check modes, and environment correctness still depends on configuration discipline.

#### Why this is a problem
- Technical consequence: local/live parity is configuration-sensitive.
- User consequence: misconfiguration blocks portal startup directly.
- Product consequence: operational polish depends on environment hygiene more than the UI implies.
- Operational consequence: deployment safety depends on external vars being present and correct.

#### Root cause
The app is split across separate deployment targets with several environment-controlled behaviors. Runtime self-diagnostics are now better, but configuration drift is still a first-order failure mode.

#### Cross-file relationships
- frontend hard-fail screens
- Vite proxy behavior
- Railway healthcheck and deploy workflow, including no-op paths when deploy variables are absent
- `scripts/dev-live.sh` and `air-mentor-api/scripts/start-seeded-server.ts`

#### How it shows up in the UI/UX
- “backend required” error states on the frontend.
- Live-mode startup failures if the environment is incomplete.

#### Recommended fix
- Keep startup diagnostics and clearer environment validation in place.
- Document and enforce required env combinations for each deployment mode.
- Preserve captured Railway deploy stdout/stderr so failed rollouts are diagnosable.
- Add stronger preflight verification in CI for the live path.

#### Priority rationale
Important operational hygiene issue, but secondary to structural platform problems.

### AM-016 Session Hardening And Abuse Protections Are Minimal
Severity: Medium
Confidence: High
Type: security/privacy | systemic
Detection gap: No visible brute-force or anomaly instrumentation is present.

#### Summary
The session system is understandable and now materially harder than before, but it still lacks the stricter default cookie posture and deeper abuse monitoring expected for a stronger production stance.

#### Where it appears
- `air-mentor-api/src/modules/session.ts`
- `air-mentor-api/src/app.ts`
- `air-mentor-api/src/config.ts`

#### What is happening
Logins verify password hashes, create durable cookie sessions, and now apply rate limiting plus a session-bound CSRF token strategy. Login is still effectively username-based, `GET /api/session` acts as a keepalive, secure-cookie posture still depends on configuration, and default-role selection is driven by hard-coded grant ordering rather than explicit user choice.

#### Why this is a problem
- Technical consequence: security posture depends heavily on trusted deployment conditions.
- User consequence: indirect, through institutional risk exposure.
- Product consequence: enterprise-readiness is weaker than the core domain maturity.
- Operational consequence: attack or misconfiguration detection is weak.

#### Root cause
Security posture focused on baseline session correctness, not deeper abuse resistance.

#### Cross-file relationships
- session creation
- origin allowlist checks
- cookie config defaults
- keepalive and default-role logic in `support.ts`

#### How it shows up in the UI/UX
- Usually invisible until something is misconfigured or abused.

#### Recommended fix
- Keep rate limiting and CSRF protection mandatory for login and sensitive mutating routes.
- Make secure-cookie production defaults explicit and harder to misconfigure.
- Add deeper anomaly/abuse monitoring beyond the current repo-native telemetry.

#### Priority rationale
Important to address before broader production rollout or more sensitive deployments.

## Implications
- The dominant risk pattern is not “many random bugs.” It is a smaller set of root issues amplifying one another.

## Recommendations
- Use [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md) to sequence fixes by leverage rather than by subsystem ownership.

## Confirmed facts vs inference
### Confirmed facts
- Every issue above is grounded in code, tests, scripts, or tracked artifacts.

### Reasonable inference
- The repository is still in the phase where architectural corrections can substantially improve both delivery speed and product trust before the current patterns harden further.

## Cross-links
- [14 Cross-File Cross-System Issue Map](./14-cross-file-cross-system-issue-map.md)
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [17 Non-Technical Explanation For Stakeholders](./17-non-technical-explanation-for-stakeholders.md)
