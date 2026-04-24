# Final Decision Appendix

## Frozen Status

- Tracked corpus gap：此 path 于本轮 merge 前并不存在；named authority path `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 亦未入 tracked corpus。
- Nonneg guard：本轮不重构不可见旧 rule，不合成 frozen rule，不弱化既有 reconcile 结论。
- Proxy authority 可供 ledger / mitigation 排序，然不足以生成 appendix rule body。 `audit-map/20-prompts/prompt-index.md:16-82`, `audit-map/01-inventory/docs-index.md:15-55`, `docs/closeout/final-authoritative-plan.md:169-186`, `docs/closeout/final-authoritative-plan.md:257-288`, `docs/closeout/final-authoritative-plan.md:323-420`

## Overnight Additions (2026-04-25)

- **Queue Case Identity**: `concernContextKey = studentId + offeringId + concernFamily + semesterNumber`。 (Auth Prompt C.2)
- **Primary Concern Taxonomy**: 限 `attendance-risk`, `coursework-risk`, `exam-risk`, `broad-academic-risk`, `mentoring-followup` 五类。 (Auth Prompt C.3)
- **Workflow Isolation**: `approval-unlock`, `escalation-review`, `calendar-followup-task`, `hod-workflow-review` 乃 workflow tasks，非 primary concern，须隔离统计。 (Auth Prompt C.4)
- **HOD Correction Cycle**: `request -> approve/reject -> reset & unlock -> teacher edit -> recompute -> relock`。 (Auth Prompt D.6)
- **Dismissal Semantics**: `dismissal = handled`；此态结案，deterioration 则开新案。 (Auth Prompt B.17-18)
- **Calendar Bridge**: Calendar drag 须同步修改 underlying due date。 (Auth Prompt B.20)
