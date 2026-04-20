# Master System Map

## Integrated Snapshot (Current)

- Frontend role surfaces, route map, feature atoms, dependency graph, and state-flow families are locally mapped and test-backed across academic + sysadmin workflows.
- GAP closure Track A is now locally preserved in code plus focused tests: proof activation persists configured assessment schemes, stage-order gating blocks future evidence locks, HoD clear-lock clears DB state, bootstrap hard-gates when no active proof run exists, archive/activate invalidates branch-scoped faculty sessions, and proof due labels can anchor to playback virtual date.
- ML stack is mapped as layered deterministic + trained-artifact system with explicit fallback semantics and artifact/evidence provenance boundaries.
- Backend provenance map is now explicit for migration lineage, destructive seed layering, proof async queue execution, run finalization, checkpoint/projection rebuilds, batch-wide artifact lineage, restore/replay flows, and semester activation/publication coupling.
- Proof refresh completion ownership is now explicitly mapped: Fastify bootstrap starts the in-process worker (`startProofRunWorker(...)`), queue lease-claim/heartbeat logic controls execution, seeded/live run services terminalize `completed`/`failed`, and activation-path fallback can synchronously execute queued non-materialized runs.
- Same-entity proof truth is now explicitly bounded: operational-semester APIs, proof-run APIs, and proof-checkpoint APIs can legitimately differ because they consume different persistence layers, and default active proof views can recurse into playback checkpoints while keeping checkpoint-explicit provenance when fallback occurs.
- Workflow automation map is now explicit for CI, Pages deploy, Railway deploy, weekly proof/browser cadence, and manual live closeout orchestration, including trigger gates, script couplings, side effects, and workflow-only confidence blind spots.
- Live deployment validation remains partially blocked in this environment (credential and network/browser constraints), so local confidence is high while deployed parity confidence is medium where live evidence is stale.

## End-to-End Control Plane (Backend)

1. Schema bootstrap: SQL migrations apply in lexical filename order and are tracked in `schema_migrations`.
2. Data seed roots: destructive platform seed replay from `platform.seed.json` + proof sandbox synthetic corpus; live-runtime replay is a fresh snapshot of current operational tables rather than immutable restore.
3. Run orchestration: queue-ready `simulation_runs` row claimed by worker lease, heartbeat maintained, and delegated to proof-control-plane execution; ownership is in-process worker bootstrap (`air-mentor-api/src/app.ts` -> `startProofRunWorker(...)`).
4. Materialization: seeded/runtime services populate runtime facts, risk/evidence families, checkpoint projections, and snapshots.
5. Activation/publication: one run is activated per batch and operational projection publication rewrites user-visible runtime surfaces.
6. Replay: snapshot restore launches parent-linked reruns and can reactivate/republish for deterministic rollback/forward control.

## Authoritative vs Derived Boundaries

- Authoritative: identity/session controls, runtime observed facts, run control records, reset snapshots, governance/profile bindings.
- Derived: checkpoint projections, queue projections/cases, active risk and alert/reassessment outputs, operational transcript/assessment projection mirrors.
- Artifact/evidence bridge: `risk_model_artifacts` and `risk_evidence_snapshots` connect batch-scoped model/version provenance to row-level prediction evidence; the active artifact pair can be trained from multiple governed source runs even when one run is currently active.

## Same-Entity Divergence Boundaries

- `operational-semester` surfaces read operational mirrors and resolved batch policy; `proof-run` and `proof-checkpoint` surfaces read proof-run or checkpoint persistence families.
- Default faculty, HoD, and student proof slices can recurse into the latest playback-accessible checkpoint for the activated semester, but current local code now keeps checkpoint-explicit provenance instead of relabeling the payload as `proof-run`.
- `simulation_runs.active_operational_semester` and `batches.current_semester` are duplicated semester pointers; activation keeps them aligned, but inactive runs can preserve stale values without republishing.
- `academic-authoritative-first` helpers choose authoritative families wholesale once present, so runtime shadow data can disappear instead of being merged per record.

## Active Contradictions Carry-Forward

- `C-001` live Railway `/health` mismatch remains unresolved due to current environment recapture blockers.
- Live parity/read-only observer contradictions (`C-015`, `C-017`, `C-019`) still block deployed semantic proof even though local gap-closure behavior is now code-backed.
- No new local product contradiction was introduced in this gap-closure reconciliation pass; stale carry-forward prose about `C-006` and `C-021` has been superseded by current code/test truth.

## Primary Risks (Backend Provenance)

- Migration prefix reuse (`0002_*`, `0012_*`) is execution-safe but readability-risky for human lineage reconstruction.
- `seedIntoDatabase(...)` is a full reset boundary; rerunning it replaces auth, academic, and proof runtime state instead of layering on top.
- Projection delete-and-rebuild publication can expose transient sparsity if interrupted outside a strict transaction envelope.
- Active recompute fallback provenance (`fallback-simulated`) can be over-trusted by consumers unless treated as degraded-evidence mode.
- Default proof-run views can be stage-backed while labeled as run-level provenance, which is test-backed but still cognitively risky for cross-surface parity analysis.
- Live-runtime snapshot restore replays current operational truth rather than a frozen historical image.

## Next Verification Targets

- Same-student cross-surface parity validation for active semester/checkpoint views across roles.
- Live worker + projection publication behavior under deployed constraints (credentialed rerun), now that local ownership/terminalization lineage is mapped in `audit-map/13-backend-provenance/proof-refresh-completion-lineage.md`.
- Transactionality and rollback guarantees around high-volume projection rewrites.
