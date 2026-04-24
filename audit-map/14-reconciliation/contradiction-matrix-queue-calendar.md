# Contradiction Matrix: Queue / Calendar / HOD

| ID | Topic | Code Truth | Reconcile State | Evidence | Doc Action |
| --- | --- | --- | --- | --- | --- |
| QC-001 | `concernContextKey` | Queue contract/payload 仅见 `caseKey`、`primarySourceKey`；现 `concernContextKey` 虽落 `proof-queue-governance.ts` 然字段数(5)与 Auth Prompt B(18)/C(2) 要求(4)不符：[studentId, semester, offId, courseCode, family] vs [studentId, offId, family, semester]。 | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts:147-156`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:188` | 校准 literal 格式 [studentId, offId, family, semester]；码中去冗余 `courseCode`。 |
| QC-002 | Primary case vs workflow task | Auth Prompt C(4-6) 严分 Primary Family (risk) 与 Workflow Category (approval/unlock)；现码 `fallbackConcernFamily` 仍杂糅 `course-offering-risk` 等旧名。 | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts:141-145`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:197-213` | 列明 canonical taxonomy；清理旧名；`primaryCase` 逻辑须区分 workflow。 |
| QC-003 | Ownership routing | Auth Prompt C(8): High -> Mentor, Medium -> Course Leader, HOD owns approval/escalation；现码 `buildMonitoringDecision` 逻辑符。 | Resolved in code | `air-mentor-api/src/lib/monitoring-engine.ts:43-65`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:220-231` | 文档保留现路由。 |
| QC-004 | Dismissal = Handled | Auth Prompt B(17): dismissal = handled = close case；现码映射 `resolved -> dismissed`。 | Resolved in code | `air-mentor-api/src/lib/proof-queue-governance.ts:315-316`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:145` | 统一术语为 handled。 |
| QC-005 | Reopening deterrence | Auth Prompt B(18): 劣化开新案；现码 `reopened` 状态符。 | Resolved in code | `air-mentor-api/src/lib/proof-queue-governance.ts:306-336`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:149` | 确认 new case ID 生成。 |
| QC-006 | Mentor ownership move | Auth Prompt B(19): mentor 变则任务随之转 owner。 | Partially implemented | `air-mentor-api/src/lib/proof-queue-governance.ts:312-323` | 加固 backend 自动重路由逻辑。 |
| QC-007 | Calendar drag mutation | Auth Prompt B(20)/D(5): 拖拽须改 underlying due date。 | Implemented in UI | `src/pages/calendar-pages.tsx:892`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:154` | 验证 API 端持久化。 |
| QC-008 | Sem1 pre-TT1 watch-only | Auth Prompt C(1): Sem1 pre-TT1 为 watch-only；现码具 `pre_tt1_observation_only` gate。 | Resolved in code | `air-mentor-api/src/lib/proof-queue-governance.ts:234-240`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:176` | 保留 watch-only gate。 |
| QC-009 | Demo auto-resolution | Auth Prompt C(15): Demo mode 许 Next Stage 自动结案；现码仅见 `post-see` 结案。 | Open drift | `air-mentor-api/src/lib/proof-queue-governance.ts:491`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:270` | 补 general demo resolution flag。 |
| QC-010 | HOD correction full cycle | Auth Prompt D(6): `request -> approve -> reset-unlock -> edit -> recompute -> relock`。 | Resolved in code | `air-mentor-api/src/modules/academic-runtime-routes.ts:1285-1331`, `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:307` | 文档须闭环全链。 |

## Guardrails

- `concernContextKey` 若后补码，须为独立 literal；今码现有 `queueCaseId/primaryCase/countsTowardCapacity` 已各司其职，不宜混称。 `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:522-534`
- Workflow task 乃任务/排程层；primary concern case 乃 queue governance 层。两者混写即 drift。 `src/domain.ts:286-318`, `air-mentor-api/src/lib/proof-queue-governance.ts:322-349`
- HOD 文案须守 read-only overlay 语义；其可见数值源于 selected checkpoint/live proof summary，非前端即席推断。 `air-mentor-api/src/lib/proof-control-plane-hod-service.ts:423-434`, `src/pages/hod-pages.tsx:228-257`
