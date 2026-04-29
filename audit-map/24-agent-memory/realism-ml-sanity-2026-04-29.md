# ML Realism Handoff — 2026-04-29

## Tested

- `proof-demo-operational-band.ts`: PROOF_DEMO_OPERATIONAL_THRESHOLDS = { high: 0.65, medium: 0.4 }. Confirmed in source and test.
- `scoreObservableRiskWithModel` override path: riskProb and headProbabilities unchanged; riskBand re-derived from bandThresholdsOverride. Verified at proof-risk-model.ts:2131–2167.
- `inferObservableRisk` (inference-engine.ts:175–191): null marks correctly skipped (not zero-filled). CGPA=0 guard at line 56. cgpaMissing + backlogMissing flags respected.
- Truth contract: calibrated riskProb, headProbabilities, observableDrivers unchanged by overlay. Tests proof-demo-operational-band.test.ts:118–135 pin this.
- Sem 1 pre-TT1: 120/0/0 (conservative, no prior history). Named students (Diya, Yash, Mira, Aarav Reddy, Arjun Reddy) show correct trajectory per sensitivity audit table.
- Sem 6 post-see: 4/31/85. 71% High is corpus artifact (heavy backlog seed). Queue governance caps actionable at 35% ≈42 students (PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT=0.35).
- Recommendation generator: evidence-anchored, no causal overclaim, HoD escalation gated on prior failure. First-time High → Mentor, not HoD.
- CO driver text: cites count, no causality. Cross-course driver: "historically lifts" scoped to proof corpus.
- Demo script step 6: "risk probability 0.6257 in the medium band" — 0.6257 < 0.65 → Medium. Correct under operational overlay. No fake probability claim.
- 16/16 tests pass per risk-band-realism-audit-2026-04-27.md Phase 7.

## Blockers

None hard-blocking demo. Soft flags only:
1. Demo script step 6 should say "operational urgency: medium" not bare "medium band".
2. Handoff Phase 7 doc typo: lists `high=0.6` in test description but actual test + constant both use `0.65`. Code is correct.
3. Vihaan Iyer (mnc_student_023): demo-safe-picks warns "missing TT2/SEE treated as zero." Inference engine skips null. Upstream mark builder behavior not confirmed — verify before demo if Vihaan is shown.

## Next Actions

Post-demo ML queue (7 items in full report):
- Verify missingness in upstream mark builder (null vs 0) for TT2/SEE before inference.
- Reconcile heuristic medium threshold (0.35 in inference-engine.ts:180) vs operational overlay (0.4).
- CO coverage audit: confirm weakCourseOutcomeCodes populated for all 6-semester courses.
- Calibrate model on real institutional data (current: synthetic proof corpus only).
- Add cross-stage trajectory features (decline rate, momentum) to reduce early-semester over-conservatism.
- Document expected High-band distribution per archetype family for sem 6.
- Back interventionResponseScore with real intervention outcome data.

Reverification before next pass: run `vitest run proof-demo-operational-band` (confirm 16/16), check proofScopeActive gate in academic.ts:1605–1626, check queue rank vector at sem 6.
