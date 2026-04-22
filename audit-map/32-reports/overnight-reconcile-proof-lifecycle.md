# Overnight Reconcile: Proof Lifecycle

Pass: `overnight-reconcile-proof-lifecycle`
Date: 2026-04-22
Scope: proof-lifecycle docs vs authoritative code — activation, runtime, stage/date authority,
completed-inspectable vs stopped, reset semantics.

---

## Findings

### F-01 Activation Contract — code matches doc
`activateProofOperationalSemester` (activation-service.ts:32-94) writes
`simulationRuns.activeOperationalSemester` AND `batches.currentSemester` on every call.
07A doc (stage-07a:38) describes only `activeOperationalSemester`. The extra
`batches.currentSemester` write (activation-service.ts:61-64) is undocumented in 07A.

### F-02 Publish projection gated on activeFlag
`publishOperationalProjection` called only when `run.activeFlag === 1`
(activation-service.ts:66-72). Matches 07A intent: "re-activating refreshes projection
without duplicating runtime rows" (stage-07a:9).

### F-03 previousOperationalSemester fallback
Activation uses `run.activeOperationalSemester ?? run.semesterEnd ?? null` as previous
value (activation-service.ts:55). Doc does not state fallback chain. If
`activeOperationalSemester` is null (first activation), `semesterEnd` substitutes.
Not contradicted but undocumented.

### F-04 Risk recompute ignores activeOperationalSemester
`recomputeObservedOnlyRisk` derives `currentSemesterNumber` as
`Math.max(run.semesterEnd, max observed semesterNumber)` (runtime-service.ts:294-297).
`activeOperationalSemester` not consulted. Risk computation is always end-anchored,
not activation-anchored. No doc explicitly claims otherwise, but the omission is a
latent source of confusion for consumers expecting activation-scoped risk.

### F-05 Restore always activates
`restoreProofSimulationSnapshot` calls `startProofSimulationRun` with `activate: true`
hardcoded (runtime-service.ts:213). Doc does not surface this invariant. Restored run
is always the active run — no stopped/inspection mode survives a restore.

### F-06 resetPlaybackStageArtifacts scope
`resetPlaybackStageArtifacts` (playback-reset-service.ts:15-57) deletes ALL checkpoint-linked
projections, queue cases, stage evidence, agent cards/sessions. It does NOT touch
`simulationRuns` status or `activeFlag`. After reset, run remains active but has no
playback artifacts until rebuild. Doc gap: no closeout doc describes the boundary between
run-level state (preserved) and playback artifact state (wiped).

### F-07 Seeded run finalization order
`finalizeSeededProofRun` (seeded-run-service.ts:120-210) sequences:
insert all row families → `rebuildSimulationStagePlayback` (line 189) →
`rebuildProofRiskArtifacts` (line 194, skip-guarded) →
`recomputeObservedOnlyRisk` (line 202, skip-guarded).
07A and 07B docs reference these rebuilds implicitly via test commands but do not
specify the sequence contract.

### F-08 skipArtifactRebuild/skipActiveRiskRecompute undocumented
Two flags in `FinalizeSeededProofRunInput` (seeded-run-service.ts:58-59) bypass
expensive rebuilds. No closeout doc mentions these escape hatches. Risk: callers
may skip rebuilds without audit trail.

### F-09 Checkpoint authority for semester walk (07B/07C)
07B names deterministic checkpoint IDs per semester (stage-07b:36-38).
07C names semester 4-6 checkpoint IDs (stage-07c:28-30).
Code: `simulationStageCheckpoints` ordered by `(semesterNumber ASC, stageOrder ASC)`
(activation-service.ts:46-49). `availableSemesters` derived from checkpoint rows.
Doc and code match: semester authority flows through checkpoint table, not from
`batches.currentSemester` alone.

### F-10 completed-inspectable vs stopped distinction
No explicit `completed` or `stopped` status field on `simulationRuns` observed in
activation-service, runtime-service, or seeded-run-service reads. `activeFlag` (0/1)
is the sole runtime toggle found. "completed-inspectable" and "stopped" semantics from
the intent prompt have no direct code counterpart found — these are documentary
distinctions not enforced by a DB column. Doc gap in 07A-07C: no explicit state
machine table mapping lifecycle labels to `activeFlag` values.

### F-11 Stage/date authority after activation
After semester activation, `batches.currentSemester` reflects the new operational
semester (activation-service.ts:61-64). Stage-date authority for downstream consumers
depends on this field. Downstream: `recomputeObservedOnlyRisk` does NOT read
`batches.currentSemester`; it reads `simulationRuns.semesterEnd` and observed rows.
Authority divergence: activation → `batches.currentSemester`; risk engine → `semesterEnd`.

### F-12 Audit emission on activation
`semester-activated` audit event emitted with `previousOperationalSemester`,
`activeOperationalSemester`, `availableSemesters` (activation-service.ts:74-85).
07A requires audit events (stage-07a:62) — confirmed present.

### F-13 Live run activate param
`StartLiveBatchProofSimulationRunInput.activate` (live-run-service.ts:38) is optional.
If omitted, activation behavior defaults are governed by the caller in
`msruas-proof-control-plane.ts`. Not surfaced in 07A-07C docs.

---

## Ledger

| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| LC-01 | activation contract | stage-07a:38,62-63 | activation-service.ts:57-64 | `batches.currentSemester` write is correct but undocumented; add to 07A contract note | docs/closeout/stage-07a:38 | needs-doc-update |
| LC-02 | activation publish gate | stage-07a:9 | activation-service.ts:66-72 | MATCH — projection refresh gated on activeFlag=1 | none | confirmed |
| LC-03 | previousOperationalSemester fallback | stage-07a (absent) | activation-service.ts:55 | undocumented fallback: `activeOperationalSemester ?? semesterEnd ?? null`; add to doc | docs/closeout/stage-07a | needs-doc-update |
| LC-04 | risk recompute scope | stage-07a,07b (absent) | runtime-service.ts:294-297 | risk engine uses `max(semesterEnd, observed)` not `activeOperationalSemester`; no doc contradiction but gap exists | audit-map/14-reconciliation/contradiction-matrix.md | needs-doc-update |
| LC-05 | restore always activates | stage-07a,07b (absent) | runtime-service.ts:213 | restore hardcodes `activate:true`; doc gap — no stopped/inspectable mode survives restore | docs/closeout/stage-07a | needs-doc-update |
| LC-06 | reset scope boundary | stage-07a-07c (absent) | playback-reset-service.ts:15-57 | playback artifacts wiped but run activeFlag preserved; undocumented boundary | docs/closeout/stage-07a | needs-doc-update |
| LC-07 | seeded run finalize order | stage-07a:100-103 | seeded-run-service.ts:189-210 | sequence correct; doc implies via test commands but does not name the order explicitly | docs/closeout/stage-07a (non-goal note) | confirmed |
| LC-08 | skip flags | stage-07a-07c (absent) | seeded-run-service.ts:58-59 | undocumented escape hatches; risk of silent rebuild skip | docs/closeout/stage-07a | needs-doc-update |
| LC-09 | semester checkpoint authority | stage-07b:36-38, stage-07c:28-30 | activation-service.ts:44-53 | MATCH — semester authority from checkpoint table; doc and code agree | none | confirmed |
| LC-10 | completed-inspectable vs stopped | stage-07a-07c (absent) | activation-service.ts, seeded-run-service.ts (no status enum) | no DB-level distinction found; lifecycle labels doc-only; needs state machine doc | audit-map/14-reconciliation/contradiction-matrix.md | needs-doc-update |
| LC-11 | stage/date authority divergence | stage-07a:62-63 | activation-service.ts:61-64, runtime-service.ts:294-297 | `batches.currentSemester` and `semesterEnd` can diverge after activation; risk engine ignores activation | audit-map/14-reconciliation/contradiction-matrix.md | needs-doc-update |
| LC-12 | audit event on activation | stage-07a:62 | activation-service.ts:74-85 | MATCH — `semester-activated` event emitted with full payload | none | confirmed |
| LC-13 | live run activate param | stage-07a (absent) | live-run-service.ts:38 | optional `activate` in live run input; caller-governed; doc gap | docs/closeout/stage-07a | needs-doc-update |

---

## Evidence

| ref | artifact | key lines |
|---|---|---|
| E-01 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 32-94 (activateProofOperationalSemester full fn) |
| E-02 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 55 (previousOperationalSemester fallback) |
| E-03 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 57-64 (dual-write simulationRuns + batches) |
| E-04 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 66-72 (activeFlag guard for publishOperationalProjection) |
| E-05 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 74-85 (semester-activated audit event) |
| E-06 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts | 44-53 (checkpoint-derived availableSemesters) |
| E-07 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts | 187-214 (restoreProofSimulationSnapshot, activate:true) |
| E-08 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts | 294-297 (currentSemesterNumber = max(semesterEnd, observed)) |
| E-09 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts | 15-57 (resetPlaybackStageArtifacts full wipe) |
| E-10 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts | 120-210 (finalizeSeededProofRun order) |
| E-11 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts | 47-59 (FinalizeSeededProofRunInput.activate/skip flags) |
| E-12 | air-mentor-api/src/lib/proof-control-plane-live-run-service.ts | 26-39 (StartLiveBatchProofSimulationRunInput.activate) |
| E-13 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | 7-9 (completion, commit abcdb25) |
| E-14 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | 38 (goal: public activation contract) |
| E-15 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | 19-39 (completion, deterministic checkpoint IDs) |
| E-16 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | 19-31 (completion, semesters 4-6 checkpoint IDs) |
| E-17 | audit-map/14-reconciliation/contradiction-matrix.md | C-021 (provenance fallback stays checkpoint-explicit, resolved) |
| E-18 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts | 1-23 (type defs, PROOF_TERM_DEFS) |
| E-19 | air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts | 1-47 (PreparePlaybackRebuildContextInput) |

---

## Mitigation Plan

### Phase 1 — Documentation gap closure (low risk, high value)

**P1-M1** (LC-01, LC-03): Update `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md`
to record: (a) `batches.currentSemester` is co-written with `simulationRuns.activeOperationalSemester`
on every activation; (b) `previousOperationalSemester` falls back to `semesterEnd` when
`activeOperationalSemester` is null on first activation.

**P1-M2** (LC-05, LC-06): Add lifecycle state-machine note in `docs/closeout/stage-07a`:
- `activeFlag=1` = active-run (inspectable); `activeFlag=0` = archived/stopped.
- `resetPlaybackStageArtifacts` wipes checkpoint-layer artifacts only; run-level state preserved.
- `restoreProofSimulationSnapshot` always sets restored run as active.

**P1-M3** (LC-08): Note `skipArtifactRebuild` / `skipActiveRiskRecompute` in 07A doc as
performance escape hatches with mandatory audit note requirement.

### Phase 5 — Contradiction matrix update

**P5-M1** (LC-04, LC-10, LC-11): Add new rows to `audit-map/14-reconciliation/contradiction-matrix.md`:
- C-029: risk engine uses `max(semesterEnd, observed)` not `activeOperationalSemester` → open,
  doc-gap, no product change needed now.
- C-030: completed-inspectable/stopped labels have no DB column counterpart → open, doc-gap.
- C-031: `batches.currentSemester` and `risk engine semesterEnd` can diverge after activation
  → open, doc-gap, potential consumer confusion.

### Phase 7 — Validation hooks

**P7-M1** (LC-09, LC-12, LC-02): Confirmed passing claims (LC-02, LC-09, LC-12) require no
action beyond recording in this ledger. Keep contradiction-matrix rows for these as
`resolved` per current evidence.

**P7-M2** (LC-04, LC-11): Future: if a consumer of the proof control plane needs
activation-scoped risk (not end-scoped), a new service function using
`activeOperationalSemester` as the semester anchor would be required. Flag as
phase-7 deferred enhancement, not a current blocker.

---

## Recommendations

1. **Add `batches.currentSemester` to the activation contract doc** (07A) so downstream
   consumers know both fields are synchronized on activation (LC-01).

2. **Document the lifecycle state machine explicitly**: `activeFlag` values, what
   `resetPlaybackStageArtifacts` preserves vs wipes, and that restore always produces
   a new active run (LC-05, LC-06, LC-10).

3. **Open C-029/C-030/C-031 in contradiction-matrix** to track the risk-engine /
   activation-scope divergence and the missing completed-inspectable DB enum (LC-04,
   LC-10, LC-11).

4. **No product code changes required** by this pass. All divergences are doc gaps, not
   behavioral defects. The frozen appendix (`final-decision-appendix.md`) is not
   affected — its absence from disk pre-dates this pass.

5. **Validation gate**: ledger has 13 rows (≥10 required). Mitigation plan keyed to
   phases 1, 5, 7 per intent. All evidence has real file:line references.
