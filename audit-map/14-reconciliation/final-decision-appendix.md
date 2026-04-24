# Final Decision Appendix

## Frozen Status

- Tracked corpus gap：此 path 于本轮 merge 前并不存在；named authority path `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 亦未入 tracked corpus。
- Nonneg guard：本轮不重构不可见旧 rule，不合成 frozen rule，不弱化既有 reconcile 结论。
- Proxy authority 可供 ledger / mitigation 排序，然不足以生成 appendix rule body。 `audit-map/20-prompts/prompt-index.md:16-82`, `audit-map/01-inventory/docs-index.md:15-55`, `docs/closeout/final-authoritative-plan.md:169-186`, `docs/closeout/final-authoritative-plan.md:257-288`, `docs/closeout/final-authoritative-plan.md:323-420`

## Overnight Additions (2026-04-25)

- **Semester 1 / pre-TT1**: Watch-only semantics. System-generated model output is watch-only. Do NOT auto-open system-generated actionable queue cases.
- **Queue Case Identity**: `concernContextKey = studentId + offeringId + concernFamily + semesterNumber`。 (Auth Prompt C.2)
- **Primary Concern Taxonomy**: 限 `attendance-risk`, `coursework-risk`, `exam-risk`, `broad-academic-risk`, `mentoring-followup` 五类。 (Auth Prompt C.3)
- **Workflow Isolation**: `approval-unlock`, `escalation-review`, `calendar-followup-task`, `hod-workflow-review` 乃 workflow tasks，非 primary concern，须隔离统计。 (Auth Prompt C.4)
- **HOD Correction Cycle**: `request -> approve/reject -> reset & unlock -> teacher edit -> recompute -> relock`。 (Auth Prompt D.6)
- **Dismissal Semantics**: `dismissal = handled`；此态结案，deterioration 则开新案。 (Auth Prompt B.17-18)
- **Calendar Bridge**: Calendar drag 须同步修改 underlying due date。 (Auth Prompt B.20)
- **HoD role semantics**: HOD is NOT the default owner for ordinary model-generated risk cases. Default ordinary risk routing: High risk -> Mentor, Medium watch -> Course Leader.
- **Model vs policy vs simulator boundary**: Model predicts risk only. Policy/action layer chooses recommended intervention. Monitoring/governance layer decides owner/due/cooldown/open/watch routing. Simulator/intervention engine determines future with-intervention and no-action trajectories.
- **Seed generation authority**: Seeded next-stage generation is a simulation engine, not the authoritative live risk scorer. Runtime/UI risk must always be rescored from authoritative observed state.
- **Missingness semantics**: Use one production model family for demo phase. Add explicit missingness companion features. Keep evidence-layer null semantics correct.
- **Operational banding and queue opening**: Keep `overallCourseRisk` as the primary operational head for UI banding and ranking.
- **Final analytics scope**: Final Semester 6 analytics must aggregate semester-level and full-run projected results. Final copy must use words like: projected, simulated, counterfactual.
- **Post-assignments date default**: Use `2023-12-10` for the Semester 1 demo default.
- **Manual unresolved cases on Next Stage in demo mode**: In demo mode, all open actionable primary student concern cases may auto-resolve on Next Stage.
