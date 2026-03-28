# AirMentor ML / AI Feature Complete Documentation

## What this area does
This document explains the complete AirMentor proof, risk, and faculty-facing “AI” system. It combines plain-English product framing with technical detail grounded in code, tests, and runtime contracts.

## Confirmed observations
- AirMentor’s ML/AI layer is not a single model invocation pipeline.
- The live implementation is a hybrid of:
  - deterministic academic rules and simulation logic in `air-mentor-api/src/lib/msruas-proof-control-plane.ts`, `msruas-proof-sandbox.ts`, and `msruas-rules.ts`
  - observable heuristics in `air-mentor-api/src/lib/inference-engine.ts`
  - deterministic monitoring logic in `air-mentor-api/src/lib/monitoring-engine.ts`
  - trained risk-model artifacts, calibration, and evaluation logic in `air-mentor-api/src/lib/proof-risk-model.ts`
  - graph-aware curriculum and prerequisite summary logic in `air-mentor-api/src/lib/graph-summary.ts`
  - optional OLLAMA-backed curriculum linkage support in `air-mentor-api/src/lib/curriculum-linkage.ts`, `curriculum-linkage-python.ts`, and `air-mentor-api/scripts/curriculum_linkage_nlp.py`
  - faculty-facing explanatory UIs in `src/pages/risk-explorer.tsx`, `src/pages/student-shell.tsx`, and `src/pages/hod-pages.tsx`
- Tests explicitly assert deterministic behavior, support warnings, scope constraints, guardrails, and the absence of unbounded “AI says” phrasing.
- The exact thresholds, precedence rules, worker timings, fallback gates, and frontend-visible deterministic behaviors are enumerated in [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md).

## Key workflows and contracts
## 1. Goal of the model layer
The model layer exists to help faculty interpret student risk and intervention context using checkpoint-bound proof records. It is not intended to autonomously make academic decisions or generate unrestricted advice.

## 2. Exact product intent behind using ML/AI
AirMentor uses ML/AI-like components for four concrete reasons:
1. Turn observable academic evidence into structured risk signals.
2. Enrich those risk signals with curriculum and prerequisite context.
3. Present faculty with bounded explanatory surfaces that feel more intelligible than raw metrics alone.
4. Simulate and compare policy-driven interventions within a reproducible proof environment.

## 3. User-facing features powered by it
| Feature | User-facing surface | Primary files |
| --- | --- | --- |
| Proof dashboard and playback | System admin batch proof view | `src/system-admin-live-app.tsx`, `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `msruas-proof-control-plane.ts` |
| Faculty proof panel | Academic faculty profile proof operations | `src/App.tsx`, `tests/faculty-profile-proof.test.tsx`, `air-mentor-api/src/modules/academic.ts`, `msruas-proof-control-plane.ts` |
| HoD proof analytics | HoD overview, proof students/faculty/courses/reassessments | `src/pages/hod-pages.tsx`, `air-mentor-api/src/modules/academic.ts`, `msruas-proof-control-plane.ts` |
| Risk explorer | Student risk explorer | `src/pages/risk-explorer.tsx`, `air-mentor-api/src/modules/academic.ts`, `msruas-proof-control-plane.ts`, `proof-risk-model.ts` |
| Student shell | Deterministic explainer and bounded chat | `src/pages/student-shell.tsx`, `air-mentor-api/src/modules/academic.ts`, `msruas-proof-control-plane.ts` |
| Curriculum linkage assistance | Admin curriculum linkage candidates | `air-mentor-api/src/modules/admin-structure.ts`, `curriculum-linkage.ts`, `curriculum_linkage_nlp.py` |

## 4. End-to-end execution path
### A. Proof data creation
1. Admin configures academic hierarchy, curriculum, policy, and optional curriculum feature bindings in `air-mentor-api/src/modules/admin-structure.ts`.
2. A curriculum import is created, validated, reviewed, and approved through `air-mentor-api/src/modules/admin-proof-sandbox.ts`.
3. A proof run is created or retried. Queueing is handled by `air-mentor-api/src/lib/proof-run-queue.ts`.
4. The worker executes `startProofSimulationRun` from `air-mentor-api/src/lib/msruas-proof-control-plane.ts`.
5. The run creates or refreshes simulation and evidence artifacts such as checkpoints, observed semester states, evidence snapshots, risk assessments, alert decisions, and student agent cards.

### B. Proof data consumption
1. A system-admin user selects a checkpoint in the proof control plane. The selection is persisted in the frontend through `src/proof-playback.ts`.
1.1. Checkpoint stepping is governance-aware in `src/system-admin-live-app.tsx`: `start` jumps to the first accessible checkpoint, `end` stops before the first blocked checkpoint, and `next` cannot cross blocked progression.
2. The academic frontend passes `simulationStageCheckpointId` into faculty profile, HoD analytics, risk explorer, or student shell calls.
2.1. If a stored checkpoint becomes inaccessible (`403` or `404`), the academic app clears local proof-playback state, retries bootstrap without the checkpoint, and falls back to the active proof-run view.
3. `air-mentor-api/src/modules/academic.ts` resolves the relevant run or checkpoint and applies scope checks.
4. `air-mentor-api/src/lib/msruas-proof-control-plane.ts` assembles the final payload for the requested surface.
5. The frontend renders a bounded proof surface with explicit authority labels, disclaimers, and sectioned evidence.

## 5. Inputs, transformations, retrieval, ranking, prompts, and output shaping
### Inputs
- institutional and academic structure
- course ownership and mentor assignments
- attendance, assessment, intervention, and transcript records
- curriculum nodes, edges, partitions, and prerequisite relationships
- seeded simulation state for the MSRUAS proof corpus
- resolved policy and resolved stage policy
- active or selected proof run and checkpoint

### Transformations
- feature construction in `proof-risk-model.ts`
- observable driver and risk inference in `inference-engine.ts`
- monitoring decision generation in `monitoring-engine.ts`
- graph-aware prerequisite summarization in `graph-summary.ts`
- stage evidence snapshots, no-action comparator construction, policy phenotype classification, and payload shaping in `msruas-proof-control-plane.ts`

### Retrieval and ranking
- proof queues are governed through `proof-queue-governance.ts`
- faculty monitoring rows, elective fit items, reassessment lists, and HoD student rollups are derived from checkpoint-bound evidence plus scope filters
- curriculum linkage candidates are ranked or proposed through deterministic heuristics plus optional OLLAMA assistance

### Prompting and orchestration
- There is no general-purpose LLM prompt loop for the student shell.
- `buildIntroShellMessage`, `classifyStudentAgentPrompt`, `buildGuardrailReply`, and `buildAssistantReply` in `msruas-proof-control-plane.ts` implement a deterministic conversation scaffold.
- The only real model-adjacent free-text orchestration in the repository is the optional curriculum linkage NLP helper.

### Output shaping
- Risk explorer output emphasizes model provenance, trained heads, derived scenario heads, evidence, policy comparison, and counterfactuals.
- Risk explorer frontend fallback is also deterministic: percentages are suppressed when `displayProbabilityAllowed === false`, and UI band fallback uses `>= 70` High, `>= 35` Medium, else Low.
- Student shell output emphasizes summary rail, current evidence, bounded citations, intervention history, and guardrailed explanation. The UI explicitly labels assistant messages as `Guardrail`, `Session Intro`, and `Deterministic Reply`.
- HoD analytics aggregate proof state at faculty, course, reassessment, and student levels.
- HoD analytics default to an “action-needed only” operating view rather than a full neutral department view.

## 6. Tool usage and orchestration if present
- OLLAMA linkage:
  - optional base URL and model selection
  - Python subprocess wrapper path via `curriculum-linkage-python.ts`
  - NLP script in `curriculum_linkage_nlp.py`
- No external tool-calling framework or retrieval-augmented LLM orchestration is present for the student shell or risk explorer.

## 7. Memory, state, and context handling
- Student shell sessions are persisted in:
  - `student_agent_sessions`
  - `student_agent_messages`
- The shell still behaves deterministically. Session state is used to preserve bounded conversational context, not to generate open-ended memory.
- Checkpoint context is first-class and explicitly carried across payloads and UI surfaces.

## 8. Safety and guardrail logic
- Scope safety:
  - mentor, course-leader, HoD, and system-admin access is tested in `air-mentor-api/tests/student-agent-shell.test.ts` and `air-mentor-api/tests/risk-explorer.test.ts`
- Session/message safety:
  - student-shell session creation and message posting are not identical permissions; posting additionally requires viewer faculty/role match and, for academic roles, the active proof run
- Output safety:
  - proof UIs and tests reject unbounded “AI says” framing
  - blocked future-certainty prompts return a `no-future-certainty` guardrail response
  - support warnings hide or suppress unstable probability displays when held-out support is insufficient
- Product safety:
  - proof surfaces repeatedly emphasize that formal academic status remains policy-derived
  - counterfactuals are explicitly marked advisory

## 9. Failure and fallback logic
- Proof run lifecycle:
  - queued runs can be retried
  - active runs can be recomputed or restored from snapshots
  - proof smoke scripts prewarm imports and runs if checkpoints are missing
- Shell and explorer UI:
  - render explicit load errors before unavailable empty states
- Model display:
  - probabilities can be suppressed while still showing risk bands and support warnings
- Curriculum linkage:
  - can fall back from Python helper or OLLAMA-backed generation to deterministic linkage logic, but the path is still operationally brittle

## 10. UX consequences of model uncertainty or inconsistency
- AirMentor does one important thing correctly: it exposes uncertainty indirectly through support warnings, calibration metadata, and bounded language rather than pretending to be omniscient.
- The main UX risk is not hallucination. It is contextual opacity. Users may not understand why a specific checkpoint, scope, or counterfactual is being shown unless the surrounding UI reinforces that context.

## 11. Cost, latency, and performance tradeoffs
- Most of the live proof experience is compute-heavy backend composition rather than paid third-party model inference.
- That keeps direct model cost low but moves complexity into backend compute, queueing, and large payload assembly.
- The optional OLLAMA linkage path introduces local-model latency and environment fragility rather than cloud-model cost.

## 12. Evaluation quality signals
- Strongest offline evidence:
  - `air-mentor-api/tests/proof-risk-model.test.ts`
  - `air-mentor-api/tests/evaluate-proof-risk-model.test.ts`
  - `air-mentor-api/output/proof-risk-model/evaluation-report.json`
  - `air-mentor-api/output/proof-risk-model/evaluation-report.md`
- The tracked evaluation artifacts are not freshness-checked in CI, so they should be treated as useful evidence, not as self-proving current truth.
- Strongest product-level evidence:
  - deterministic UI and access-control tests
  - proof smoke acceptance script
- Missing evidence:
  - online monitoring
  - usage analytics
  - drift detection
  - calibration monitoring in production

## 13. Architecture weaknesses
- The proof platform’s power is concentrated inside `msruas-proof-control-plane.ts`.
- The student shell is safer than a generic chat feature, but its safety is tightly coupled to one giant orchestration file rather than being enforced through a smaller isolated policy engine.
- Curriculum linkage is a partially separate intelligence stack with extra runtime dependencies.

## 14. Missing instrumentation
- no visible production eventing for checkpoint-lag or queue backlog
- no proof surface usage analytics
- no failure-rate dashboards for shell or risk explorer loads
- no production calibration or support-monitoring telemetry
- no linkage quality feedback loop from admin decisions

## 15. Mismatch between intended intelligence and actual implementation
- **Where the system is elegant:** the proof UIs are honest about bounded authority, and the tests enforce those boundaries.
- **Where the system is brittle:** a large amount of “intelligence” is handcrafted orchestration and snapshot shaping inside one file. That works, but it is hard to evolve safely.
- **Where the UX may overpromise:** users could still read “student shell” or “risk explorer” as more adaptive and conversational than the deterministic implementation really is.
- **Where the UX underexplains:** support warnings, calibrated probability display suppression, and checkpoint context are technically strong, but users may not understand why they matter without more product framing.

## Findings
### Summary judgment
AirMentor’s AI/ML layer is more rigorous than a typical “AI feature” because it intentionally narrows scope, cites evidence, suppresses unstable probabilities, and blocks future-certainty claims. The main risk is not unbounded generation. The main risk is that the architecture needed to achieve that rigor is too concentrated and too lightly instrumented.

## Implications
- **User impact:** the system can earn trust if its context is visible; it can lose trust if checkpoint and scope behavior feels implicit.
- **Product impact:** the product is strongest when it presents AI as bounded proof interpretation, not when it invites expectations of general intelligent tutoring.
- **Engineering impact:** the model layer is difficult to modify safely because deterministic rules, calibration logic, payload shaping, and session behavior all converge in a small set of files.

## Recommendations
1. Split the proof platform into smaller services for scoring, checkpoint assembly, explanation composition, and UI payload shaping.
2. Add explicit user-facing explanations for hidden or suppressed probability states.
3. Instrument proof load success, queue latency, guardrail triggers, and linkage candidate approval outcomes.
4. Treat curriculum linkage as a separately monitored subsystem with its own health and fallback reporting.
5. Keep the student shell deterministic unless the platform also adds a much stronger safety, evaluation, and observability stack.

## Confirmed facts vs inference
### Confirmed facts
- The system is hybrid and heavily deterministic.
- Guardrail behavior, support warnings, and scope denials are explicitly tested.
- Optional OLLAMA-backed linkage exists and is environment-controlled.

### Reasonable inference
- The product team likely wants the trust benefits of AI-assisted interpretation without the operational and policy risks of an unconstrained model feature. The code strongly supports that interpretation.

## Cross-links
- [02 System Architecture Overview](./02-system-architecture-overview.md)
- [07 Auth Security And Privacy Audit](./07-auth-security-and-privacy-audit.md)
- [09 Testing Quality And Observability Audit](./09-testing-quality-and-observability-audit.md)
- [14 Cross-File Cross-System Issue Map](./14-cross-file-cross-system-issue-map.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [18 Proof Sandbox And Curriculum Linkage Audit](./18-proof-sandbox-and-curriculum-linkage-audit.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
