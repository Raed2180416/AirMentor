# ML Risk UI Audit

Read-only audit generated on 2026-04-23 for `ml-risk-ui-audit-pass`.

## Scope

This audit traced the ML-risk contract from model output to backend projections and finally to each React surface that visibly consumes band, probability, drivers, recommended action, model provenance, or counterfactual lift.

Backend field source audited:

- `scoreObservableRiskWithModel()` returns `riskProb`, `riskBand`, `recommendedAction`, `observableDrivers`, `modelVersion`, and `calibrationVersion` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-risk-model.ts:2099-2185`.
- Playback policy logic emits action-code recommendations via `buildActionPolicyComparison()` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-service.ts:552-776`.
- Playback governance writes queue projections as `policyComparison.recommendedAction ?? inference.recommendedAction`, while student projection rows keep `recommendedAction: candidate.inference.recommendedAction` and stash model/calibration metadata inside `projectionJson.currentStatus` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:553-577` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:665-769`.
- Live runtime persists `riskAssessments.recommendedAction` as `policyComparison.recommendedAction ?? inference.recommendedAction` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:782-800`.

API endpoints audited:

- HoD proof bundle endpoints in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/modules/academic-proof-routes.ts:62-178`.
- Student shell card and risk explorer endpoints in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/modules/academic-proof-routes.ts:324-359`.
- Faculty profile proof endpoint in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/modules/admin-control-plane.ts:698-735` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/modules/admin-control-plane.ts:1121-1133`.

Projection / DB tables audited:

- `simulationStageQueueProjections` are used for checkpoint-scoped faculty proof views in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:210-230`.
- Live faculty proof views read `riskAssessments`, `reassessmentEvents`, and `studentObservedSemesterStates` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:410-427`.
- Student-shell workspace assembly reads `simulationStageOfferingProjections`, `simulationStageQueueProjections`, and `simulationStageStudentProjections` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/modules/academic.ts:2908-2920`.
- Risk explorer provenance and top-driver reconstruction read `riskEvidenceSnapshots` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:784-822`.

UI files audited:

- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-faculty-profile-page.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-proof-summary-strip.tsx`
- `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/system-admin-proof-dashboard-workspace.tsx`

Audit method:

- Static code trace only.
- No source files under `src/**` or `air-mentor-api/src/**` were modified.
- Findings below flag only gaps that are directly reproducible from code paths or tests.

## Coverage matrix

| UI surface | risk band shown? | risk prob shown? | top drivers shown? | recommended action shown? | recommendedAction humanised? | model version visible? | counterfactual lift shown? | Evidence ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HoD overview watchlist table | Yes | Yes | No | No | No | No | No | M1 |
| HoD reassessment audit table | Yes | Yes | No | No | No | No | No | M2 |
| HoD student drilldown modal | Yes | Yes | No | Yes | Partial | No | Yes | M3 |
| Faculty proof summary strip | Aggregate only (`High Watch`) | No | No | No | No | No | No | M4 |
| Faculty profile teaching-scope teaser | Yes | Yes | No | Yes | No | No | No | M5 |
| Faculty profile monitoring queue panel | Yes | No | Partial | Yes | No | No | Yes | M6 |
| Course-leader dashboard alert cards | No | Yes | Partial | Partial | No | No | No | M7 |
| Course page `Risk` tab | Yes | Yes | Partial | No | No | No | No | M8 |
| Course page attendance / TT / gradebook tables | Yes | Yes | No | No | No | No | No | M9 |
| Student Shell summary + overview | Yes | Yes | Partial | Yes | Partial | No (calibration method only) | Yes | M10 |
| Student Shell assessment evidence panel | No | No | Partial | No | No | No | No | M11 |
| Risk Explorer | Yes | Yes | Yes | Yes | Partial | Yes | Yes | M12 |
| System-admin proof dashboard checkpoint queue preview | Yes | Yes | No | Yes | No | No | Yes | M13 |

### Matrix evidence map

- M1: HoD overview row renders `RiskBadge` only, with no drivers/action/counterfactual in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:536-598`.
- M2: HoD reassessment table renders `RiskBadge` and workflow state only in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:712-772`.
- M3: HoD drilldown shows risk, action, and counterfactual in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:817-885`; live HoD payload can carry `drivers` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:1052-1089`, but checkpoint HoD payload drops them with `drivers: []` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:593-643`.
- M4: Faculty proof summary strip only computes counts from `riskBand` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-proof-summary-strip.tsx:58-139`.
- M5: Faculty profile teaching-scope teaser concatenates band, probability, and raw `recommendedAction` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-faculty-profile-page.tsx:261-275`.
- M6: Faculty profile monitoring queue shows band, raw `recommendedAction`, optional driver chips, and counterfactual in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-faculty-profile-page.tsx:459-490`.
- M7: Course-leader dashboard cards only show `riskProbScaled` plus a single `reasonLabel`, where `reasonLabel` falls back to `recommendedAction`, in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx:68-98` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx:180-196`.
- M8: Course-page `Risk` tab renders band/probability plus only `student.reasons[0]?.label` in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:253-330`.
- M9: Course-page attendance, TT, and gradebook tables repeatedly render `RiskBadge` with no action/driver/counterfactual layer in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:366-383`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:516-535`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:750-770`.
- M10: Student Shell summary and overview show band, probability, calibration method, action, attention areas, and counterfactual, but no model/calibration version, in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:303-353` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:402-430`.
- M11: Student Shell assessment panel tries to render driver chips in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:490-505`, but checkpoint card assembly writes `drivers: []` for every component in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1803-1819`.
- M12: Risk Explorer exposes model version, calibration version, top drivers, and counterfactual in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:243-258`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:408-490`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:576-590`; payload provenance comes from `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:2230-2257`.
- M13: System-admin proof dashboard queue preview renders band, probability, raw `recommendedAction`, no-action probability, and lift with no driver or model provenance layer in `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/system-admin-proof-dashboard-workspace.tsx:871-885`.

## Findings

### F1. HoD console still cannot explain "why" the model is flagging a student.

The HoD overview table and reassessment table are band/probability-only surfaces. The student drilldown adds `recommendedAction` and `counterfactualLiftScaled`, but there is still no driver panel in the UI, even though live HoD payloads can carry `courseSnapshots[].drivers`. Checkpoint HoD payloads are worse: they explicitly zero the driver list with `drivers: []`. This means the HoD surface that is supposed to justify decisions still lacks a durable "why now" explanation at both the overview level and the drilldown level. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:536-598`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:817-885`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:593-643`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:1052-1089`.

### F2. HoD model transparency is missing at the exact surface that product intent calls out.

Risk Explorer exposes `modelVersion` and `calibrationVersion`, but HoD payload types do not carry those fields and the HoD page hero explicitly says it avoids showing "hidden model internals". The result is a transparency mismatch: the most governance-heavy surface cannot answer "which model/calibration produced this watchlist?" Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:211-214`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:228-229`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/api/types.ts:1650-1853`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:258`.

### F3. Checkpoint-scoped faculty queue surfaces lose driver detail, so the dashboard can fall back to raw action codes.

Checkpoint faculty queue assembly sets `drivers: []` for every queue row. The faculty profile monitoring queue UI tries to show driver chips, and the course-leader dashboard resolves its `reasonLabel` as `item.drivers[0]?.label ?? item.recommendedAction`. In checkpoint mode, that collapses to `recommendedAction`, which is allowed to be an action code because queue projections persist `policyComparison.recommendedAction ?? inference.recommendedAction`. This is a concrete "band but no why" and sometimes "band plus raw enum" failure. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:203-329`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-faculty-profile-page.tsx:459-490`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx:68-98`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:553-577`.

### F4. Risk Explorer is best-in-class for transparency, but its advanced intervention diagnostics still leak raw action codes.

Risk Explorer is the only audited surface that reliably exposes model version, calibration version, top observable drivers, and no-action comparator. However, the advanced diagnostics pane renders `policyComparison.recommendedAction` and candidate `action` values directly, and tests explicitly expect raw values like `structured-study-plan` in the markup. This is the strongest remaining humanisation gap after the helper wiring work. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:449-460`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/tests/risk-explorer.test.tsx:743-745`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/tests/risk-explorer.test.tsx:813-833`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-service.ts:750-776`.

### F5. Student Shell covers counterfactuals and attention areas, but checkpoint assessment rows still lose per-course driver chips.

The Student Shell overview is reasonably complete for band/probability/counterfactual/status, but the deeper assessment panel depends on `assessmentEvidence.components[].drivers`. In checkpoint mode the backend populates every component with `drivers: []`, so the UI's driver-chip affordance silently goes empty. This makes the shell weaker than the Risk Explorer for "why this course, right now?" even though the panel layout implies such detail should exist. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:402-430`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:490-505`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1803-1819`.

### F6. Course pages still consume only the thinnest slice of ML output.

Course pages consistently show band and probability. The dedicated `Risk` tab adds only the first reason label. No course-page surface shows recommended action, counterfactual lift, model version, or calibration version. For a surface where a course leader is expected to decide on immediate class-level follow-up, the action layer is absent. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:253-330`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:366-383`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:516-535`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:750-770`.

### F7. Cross-surface risk-band / probability consistency has an explicit guardrail, and I did not find a contradictory code path.

The repo includes a parity adapter that normalizes the same core checkpoint metrics out of Student Shell, Risk Explorer, HoD watch rows, and faculty monitoring queue rows. The parity tests assert equality for the same student/checkpoint fixture across all four selectors. This is strong evidence that band/probability mismatch across those surfaces is already guarded against. I found no contradicting selector logic in the audited files. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/student-checkpoint-parity.ts:24-96` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/tests/student-checkpoint-parity.test.ts:63-175`.

### F8. Internal sysadmin playback preview still leaks raw checkpoint action codes.

The system-admin proof dashboard is not the main faculty demo surface, but it does consume the same queue projection rows and currently prints `item.simulatedActionTaken ?? item.recommendedAction` directly beside risk probability and no-action comparator. That means internal demos, screenshots, or operator reviews can still expose raw stage-policy codes after the faculty helper wiring work. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/system-admin-proof-dashboard-workspace.tsx:871-885` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:553-577`.

## Gaps that would hurt the demo

1. HoD cannot defend the watchlist with drivers or model/calibration provenance. This undermines both trust and governance in the highest-stakes surface. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:211-214`, `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:817-885`, and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/api/types.ts:1650-1853`.
2. Faculty checkpoint queue cards can degrade to probability plus raw action-code text because checkpoint queue rows drop drivers. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:265-297` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx:80-98`.
3. Risk Explorer advanced mode still prints raw action codes (`structured-study-plan`, `targeted-tutoring`) even though this is the main explanation surface for faculty review. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:453-460` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/tests/risk-explorer.test.tsx:827-833`.
4. Student Shell checkpoint assessment rows promise driver chips but ship none, so the shell cannot stand on its own as a "why" surface. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:495-505` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1803-1819`.
5. Course pages still omit recommended action and counterfactuals entirely, so the surface is good for spotting risk but weak for deciding next action. Evidence: `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/course-pages.tsx:253-330`.

## Proposed fixes

| Target file:line | Suggested change | Acceptance test |
| --- | --- | --- |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-hod-service.ts:593-643` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:855-885` | Preserve checkpoint `courseSnapshots[].drivers` and render the top 2-3 driver chips under each HoD course snapshot row. | HoD student drilldown fixture with a checkpoint row shows at least one driver chip and the same chip label as the underlying snapshot payload. |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/api/types.ts:1650-1853` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/hod-pages.tsx:211-229` | Add `modelVersion`, `calibrationVersion`, and preferably `featureSchemaVersion` to HoD proof bundle payloads and surface them in the HoD hero or badges. | HoD hero shows the same model/calibration strings as Risk Explorer for the same selected checkpoint. |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:265-297` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-route-pages.tsx:68-98` | Populate checkpoint queue `drivers` from stage projection payload or the attached evidence snapshot so dashboard cards can keep a concrete `why` label. | In checkpoint scope, a course-leader alert card shows a driver label rather than falling back to raw `recommendedAction`. |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/academic-faculty-profile-page.tsx:261-275` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/risk-explorer.tsx:453-460` | Humanise `recommendedAction` everywhere the UI renders it directly. Reuse `humanLabelForActionCode()` or add a frontend mirror with the same fallback behavior. | Faculty profile and Risk Explorer advanced tab never render raw hyphen/snake-case action codes in visible copy. |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1803-1819` and `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/pages/student-shell.tsx:490-505` | Stop writing `drivers: []` for checkpoint `assessmentComponents`; at minimum copy the top 3 observable drivers from the selected stage row or synthesize component-local driver labels from `attentionAreas`. | Checkpoint-bound Student Shell assessment tab displays non-empty driver chips for a fixture that already has checkpoint attention areas / top drivers. |
| `@/home/raed/.local/state/airmentor/pipeline/worktrees/fresh-sem1-audit-dispatch-dag-1610428c-20260423T091928Z/ml-risk-ui-audit/src/system-admin-proof-dashboard-workspace.tsx:871-885` | Reuse the same action humanisation helper on sysadmin queue preview cards so internal proof reviews match faculty copy. | Sysadmin checkpoint queue preview never renders raw hyphen/snake-case action codes in visible copy. |

## Verification commands

These are the exact grep / `rg` commands used to reproduce the main findings.

```bash
rg -n "scoreObservableRiskWithModel|observableDrivers|recommendedAction|modelVersion|calibrationVersion" air-mentor-api/src/lib/proof-risk-model.ts
rg -n "buildActionPolicyComparison|recommendedActionStageValid|recommendedAction" air-mentor-api/src/lib/proof-control-plane-playback-service.ts
rg -n "recommendedAction: primaryCandidate.policyComparison.recommendedAction|currentStatus: \\{|counterfactualPolicyDiagnostics" air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts
rg -n "recommendedAction: policyComparison.recommendedAction|riskAssessments" air-mentor-api/src/lib/proof-control-plane-runtime-service.ts air-mentor-api/src/lib/proof-control-plane-tail-service.ts
rg -n "drivers: \\[\\]|monitoringQueue|selectedCheckpoint" air-mentor-api/src/lib/proof-control-plane-tail-service.ts air-mentor-api/src/lib/proof-control-plane-hod-service.ts
rg -n "riskBand|riskProbScaled|recommendedAction|drivers|counterfactualLiftScaled|modelVersion|calibrationVersion" src/pages/hod-pages.tsx src/pages/course-pages.tsx src/pages/student-shell.tsx src/pages/risk-explorer.tsx src/academic-faculty-profile-page.tsx src/academic-route-pages.tsx src/academic-proof-summary-strip.tsx
rg -n "modelVersion|calibrationVersion" src/pages/hod-pages.tsx src/pages/student-shell.tsx src/pages/risk-explorer.tsx src/api/types.ts air-mentor-api/src/lib/proof-control-plane-hod-service.ts
rg -n "coreMetricsFromStudentCard|coreMetricsFromRiskExplorer|coreMetricsFromHodStudentWatch|coreMetricsFromFacultyQueueItem" src/student-checkpoint-parity.ts tests/student-checkpoint-parity.test.ts
```

## Follow-up code-changes

1. Add a shared `recommendedActionDisplay` field to all proof DTOs that can currently expose raw policy action codes.
2. Backfill checkpoint queue and checkpoint Student Shell builders so they preserve driver arrays instead of zeroing them out.
3. Extend HoD proof summary / bundle contracts with `modelVersion`, `calibrationVersion`, and `featureSchemaVersion`.
4. Add HoD UI driver rendering so the HoD can justify watchlist entries without leaving the page.
5. Add a regression test for checkpoint-scoped faculty dashboard cards proving that the visible "reason" remains a driver label or humanised action string.
6. Add a regression test for Risk Explorer advanced mode that forbids raw hyphen/snake-case action codes in visible copy.
7. Consider a lighter-weight action / counterfactual row on course pages so course leaders can move from detection to action without switching surfaces.

Summary judgment:

- Best-covered surface: Risk Explorer.
- Best consistency guardrail: cross-surface band/probability parity adapters and tests.
- Weakest actionability surface: HoD overview.
- Weakest checkpoint-specific `why` surface: faculty queue cards and Student Shell assessment rows.
