# AirMentor Proof Sandbox And Curriculum Linkage Audit

## What this area does
This document gives deeper, subsystem-specific coverage of the proof sandbox, proof run lifecycle, checkpoint playback, and curriculum linkage pipeline because those features are large enough to deserve treatment beyond the general backend and ML docs.

## Confirmed observations
- The proof sandbox is admin-operated through `air-mentor-api/src/modules/admin-proof-sandbox.ts` and rendered through `src/system-admin-proof-dashboard-workspace.tsx`, with `src/system-admin-live-app.tsx` acting as the route/data orchestrator.
- The seeded MSRUAS proof world is defined in `air-mentor-api/src/lib/msruas-proof-sandbox.ts`.
- The proof control plane orchestration is still centered in `air-mentor-api/src/lib/msruas-proof-control-plane.ts`, but several services are now extracted around it.
- Async run creation, retry, and lease handling are implemented in `air-mentor-api/src/lib/proof-run-queue.ts`.
- Curriculum linkage generation and approval live in `air-mentor-api/src/modules/admin-structure.ts` with optional NLP/model support through `curriculum-linkage.ts`, `curriculum-linkage-python.ts`, and `scripts/curriculum_linkage_nlp.py`.
- The proof admin API surface also includes model-artifact inspection, checkpoint student detail, student evidence timeline, run activation, run archiving, recompute-risk, and snapshot restore endpoints.
- Proof dashboard responses now include queue age, lease state, retry/failure state, worker diagnostics, and checkpoint-readiness diagnostics.

## Key workflows and contracts
## Proof sandbox lifecycle
1. Admin opens a batch proof dashboard through `/api/admin/batches/:batchId/proof-dashboard`.
2. Admin creates a proof import through `/api/admin/batches/:batchId/proof-imports`.
3. Import validation runs through `/api/admin/proof-imports/:curriculumImportVersionId/validate`.
4. Crosswalk review may be required through `/api/admin/proof-imports/:curriculumImportVersionId/review-crosswalks`.
5. Import approval runs through `/api/admin/proof-imports/:curriculumImportVersionId/approve`.
6. A proof run is queued through `/api/admin/batches/:batchId/proof-runs`.
7. The queue worker claims and executes the run.
8. Checkpoints become available for playback and downstream academic proof surfaces.

## Proof playback contract
- System-admin checkpoint choice is stored in `src/proof-playback.ts`.
- Playback stepping is gated:
  - `start` jumps to the first accessible checkpoint
  - `end` jumps to the last checkpoint before blocked progression
  - `next` cannot cross blocked progression
- Academic proof surfaces consume the selected `simulationStageCheckpointId`.
- Playwright proof smoke explicitly verifies that a selected checkpoint survives reload and propagates to:
  - faculty proof panel
  - risk explorer
  - student shell
  - HoD analytics
- The proof smoke script also prewarms lifecycle state by calling admin APIs with the session cookie plus an allowed `Origin`, which makes the smoke flow an executable proof-operability contract rather than only a UI script.

## Curriculum linkage contract
1. Batch curriculum is bootstrapped through `/api/admin/batches/:batchId/curriculum/bootstrap`.
2. Linkage candidates are listed or regenerated.
3. Admin approves or rejects candidates.
4. Approval can affect multiple batches and may enqueue proof refresh work.
5. Approval and proof-refresh enqueue are now explicitly separated:
   - `approvalSucceeded`
   - `proofRefreshQueued`
   - `proofRefreshWarning`

## Current-state reconciliation (2026-03-28)
- The original audit correctly identified proof and linkage as the most operationally complex subsystem, but the operator surface is materially stronger now:
  - queue health, lease state, retry/failure, and checkpoint readiness are visible in the proof dashboard
  - curriculum linkage approval no longer implies proof refresh succeeded; degraded enqueue is explicit in both API and UI
  - scheduled proof/browser cadence now exists in CI
- The subsystem is still not fully decomposed. The proof facade remains one of the largest files in the repo.

## Findings
### Subsystem strengths
- The proof lifecycle is explicit and inspectable. Import, validation, review, approval, run creation, checkpoint detail, recompute, archive, retry, and restore all exist as named routes.
- The proof smoke script is unusually strong. It does not just click through a page; it prewarms lifecycle steps through APIs when required and validates checkpoint propagation across multiple roles and surfaces.
- Curriculum linkage approval is connected to proof-refresh consequences rather than being treated as a disconnected admin detail.

### Subsystem weaknesses
- The proof lifecycle is operationally heavy. Missing checkpoints can require recompute or lifecycle prewarm, as encoded directly in `scripts/system-admin-proof-risk-smoke.mjs`.
- Curriculum linkage pulls in a separate Python and optional local-model execution path, which is materially more fragile than the rest of the predominantly TypeScript platform.
- Proof and linkage both share the same broader weakness: sophisticated behavior with better in-product diagnostics now, but still limited external runtime observability and incomplete service decomposition.

## Implications
- **Technical consequence:** these subsystems are powerful but have a high cognitive and operational surface area.
- **User consequence:** proof data can look “missing” or “not ready” in ways users may not understand.
- **Product consequence:** the product’s most differentiated capability depends on the most operationally complex path.
- **Operational consequence:** support and debugging require familiarity with import status, crosswalk review, queue state, checkpoint availability, and linkage-runtime mode.

## Recommendations
- Add explicit UI states for “proof import incomplete,” “crosswalk review required,” “run queued,” “checkpoint generation in progress,” and “checkpoint stale or missing.”
- Separate curriculum linkage health and provenance from the rest of proof status so admins can tell whether a problem is linkage quality, linkage runtime, or proof execution.
- Keep instrumenting proof refresh enqueue results after linkage approval, expose the immediate retry path clearly, and continue extracting the remaining proof lifecycle seams from the main facade.

## Confirmed facts vs inference
### Confirmed facts
- The proof endpoints, linkage endpoints, queue worker, and smoke flow all exist and interact as described.
- Linkage approval can return proof refresh metadata including affected batches and queued simulation run IDs.

### Reasonable inference
- This subsystem is both the product’s most distinctive capability and the area where operational tooling most needs to catch up with feature sophistication.

## Cross-links
- [06 API And Integration Audit](./06-api-and-integration-audit.md)
- [10 Performance Scalability And Reliability Audit](./10-performance-scalability-and-reliability-audit.md)
- [13 ML / AI Feature Complete Documentation](./13-ml-ai-feature-complete-documentation.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
