# Overnight Audit: Frontend UI/UX Flow Preservation

- 纪日：`2026-04-25`。
- 权威升格：`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 今已入 tracked corpus；本轮切至 **direct-authority** 模式，不再 proxy-only。
- 范围：`src/App.tsx`, `src/domain.ts`, `src/pages/calendar-pages.tsx`, `src/pages/hod-pages.tsx`, `src/pages/course-pages.tsx`, `src/system-admin-live-app.tsx` 及必要邻近 helper。
- 约束：只读审计；未改 `src/**`。
- 校验闸：`10` findings，皆具 `file:line`、severity ∈ {low,medium,high,critical}、target_phase 映射 unified mitigation plan Phase 1..11。

## Findings

1. **FF-01** — Course-level Risk Watch tab locked at `stage < 2`; pre-TT1 users cannot open watch surface even in watch-only mode. `src/pages/course-pages.tsx:67`
2. **FF-02** — `SharedTask` type has no `concernContextKey`, `primaryCase`, or `countsTowardCapacity` fields; frontend cannot distinguish primary concern cases from workflow tasks or enforce capacity gate. `src/domain.ts:286-318`
3. **FF-03** — Dismissal action labeled "Dismissed" in UI; auth-prompt mandates "handled" semantics for case closure. `src/App.tsx:2387`, `src/academic-route-pages.tsx:975`
4. **FF-04** — HOD correction cycle missing explicit relock step; `handleResetComplete` clears lock and resolves task but provides no post-recompute relock handler in the frontend flow. `src/App.tsx:3158-3207`
5. **FF-05** — `TaskType` enum (`'Follow-up' | 'Remedial' | 'Attendance' | 'Academic'`) has no workflow task category; workflow tasks (`approval-unlock`, `escalation-review`, `calendar-followup-task`, `hod-workflow-review`) are indistinguishable from primary concern cases. `src/domain.ts:10`
6. **FF-06** — Assessment surface `canOpenWorkspace` gated on `!isLocked`; visibility (read) conflated with editability (write); locked card cannot be opened for inspection. `src/page-utils.ts:49-56`, `src/pages/workflow-pages.tsx:555-579`
7. **FF-07** — HOD watchlist `Acknowledge` button rendered with no `onClick` handler; API `acknowledgeAcademicProofReassessment` exists but is not wired to the HoD overview row action. `src/pages/hod-pages.tsx:578`
8. **FF-08** — HOD overview defaults `showActionNeededOnly=true`; `watching` rows are hidden on first render; pre-TT1 watch-only context appears empty if no open cases exist. `src/pages/hod-pages.tsx:484-532`
9. **FF-09** — `resolveGovernedQueueState` has no mapping for `'reopened'` status; backend case-reopen on deterioration returns `'reopened'` but frontend maps it to `null` (no badge). `src/pages/hod-pages.tsx:43-49`
10. **FF-10** — `authoritativeOperationalSemester` computed by sysadmin but not propagated to batch edit modal; UI truth may drift from `run.activeOperationalSemester` after activation. `src/system-admin-live-app.tsx:2684-2688`, `src/system-admin-live-app.tsx:3129-3143`

## Evidence

### Flow Map

| Proxy flow | Scope | Auth-prompt anchor |
| --- | --- | --- |
| `L1` | Sysadmin proof control / activation / playback | auth-prompt A, E, G |
| `L2` | Sysadmin hierarchy / batch / semester editor | auth-prompt E.1-E.3 |
| `L3` | Course proof panel / Risk Watch | auth-prompt C.1, C.12 |
| `L4` | Assessment entry / lock / unlock / relock | auth-prompt D.6, F |
| `L5` | Mentor mentee / recurring task / hide-restore | auth-prompt B.14-B.18 |
| `L6` | Calendar / timetable / queue-date alignment | auth-prompt B.20, D.5 |
| `L7` | Queue history / dismiss / reopen / restore | auth-prompt B.17-B.18, C.2-C.4 |
| `L8` | HoD overview / course hotspots / faculty ops | auth-prompt D, N |
| `L9` | HoD unlock review / correction cycle | auth-prompt D.6 |
| `L10` | Risk explorer / student shell | auth-prompt M |
| `L11` | Session restore / proof-playback / fallback | auth-prompt G |

### Current-Code Anchors

**FF-01 — Risk Watch locked pre-TT1**
- `src/pages/course-pages.tsx:67`: `tabLocked = (tabId === 'risk' && offering.stage < 2)` — tab disabled at stage 1
- Tab button: `onClick={() => !locked && setTab(def.id)}` — click rejected; tab content never rendered
- Auth-prompt C.1 / UL-QC-04: Sem1 pre-TT1 = watch-only, not hidden

**FF-02 — `concernContextKey` absent from SharedTask**
- `src/domain.ts:286-318`: `SharedTask` has `id`, `studentId`, `offeringId`, `status`, `taskType?`, `dismissal?` — no `concernContextKey`, `primaryCase`, `countsTowardCapacity`
- Auth-prompt C.2 / UL-QC-01: `concernContextKey = studentId + offeringId + concernFamily + semesterNumber` mandatory 4-tuple
- Frontend queue list cannot partition primary concern vs workflow vs capacity-overflow rows

**FF-03 — Dismissal terminology mismatch**
- `src/App.tsx:2387`: `note: \`${role} dismissed this queue item from active work.\``
- `src/academic-route-pages.tsx:975`: `task.dismissal ? 'Dismissed' : 'Active'` chip label
- Auth-prompt B.17 / appendix "Dismissal Semantics": dismissal = **handled** = case closed; "Dismissed" implies skipped/ignored not handled
- Logic is otherwise correct (guard against re-dismiss, deterioration opens new case)

**FF-04 — HOD correction cycle: relock step absent**
- `src/App.tsx:3125-3138`: `handleApproveUnlock` — sets task status 'In Progress', unlock pending
- `src/App.tsx:3141-3156`: `handleRejectUnlock` — resolves task, lock retained
- `src/App.tsx:3158-3207`: `handleResetComplete` — calls `clearRemoteLock`, sets `lockByOffering[kind]=false`, resolves task; marks `unlockRequest.status='Reset Completed'`
- Missing: no `handleRelock` triggered after teacher edit + recompute; auth-prompt D.6 mandates `recompute -> relock` as final step; API `commitOfferingAssessmentEntries(lock: true)` exists but no UI step orchestrates it post-recompute

**FF-05 — TaskType enum lacks workflow category**
- `src/domain.ts:10`: `type TaskType = 'Follow-up' | 'Remedial' | 'Attendance' | 'Academic'`
- Auth-prompt C.4 / appendix "Workflow Isolation": `approval-unlock`, `escalation-review`, `calendar-followup-task`, `hod-workflow-review` are workflow tasks, not primary concern cases; must not count toward primary concern stats
- No `primaryCase` boolean on `SharedTask`; workflow tasks allocated same `taskType` as primary; stats conflated

**FF-06 — Assessment surface visibility conflated with editability**
- `src/page-utils.ts:56`: `canOpenSetup: input.stage <= 1 && !input.isLocked`
- `src/pages/workflow-pages.tsx:555-579`: when `!access.canOpenWorkspace`, entry hub renders locked card that cannot be drilled into
- Auth-prompt F / previous audit F02: "assessment surface always visible; lock/unlock governs edit only"
- Current: locked = invisible entry workspace, not read-only

**FF-07 — HOD Acknowledge button stub**
- `src/pages/hod-pages.tsx:577-579`: `{actionNeeded ? (<Btn size="sm" variant="ghost">Acknowledge</Btn>) : null}`
- No `onClick` prop; `acknowledgeAcademicProofReassessment` API method defined at `src/api/client.ts:550-553`
- Clicking "Acknowledge" is a no-op; HOD cannot record case acknowledgement from overview

**FF-08 — HOD overview hides Watching rows by default**
- `src/pages/hod-pages.tsx:484-532`: `showActionNeededOnly` initial value controls Watchlist filter; "Action Needed" button shown as primary
- Auth-prompt C.1 / UL-QC-04 / appendix "Semester 1 / pre-TT1": watch-only mode means `watching` rows ARE the primary surface during pre-TT1; defaulting to Action Needed filter produces an empty watchlist at semester start
- Caption at line 487 correctly states the distinction but default filter contradicts the semantic

**FF-09 — `resolveGovernedQueueState` missing 'reopened' case**
- `src/pages/hod-pages.tsx:43-49`: maps `'open'|'opened'` → 'open'; `'watch'|'watching'` → 'watching'; `'resolved'` → 'resolved'; anything else → `null`
- Auth-prompt B.18 / UL-QC-06: deterioration after resolution opens new case; backend may return status `'reopened'`
- `null` case renders no governed queue badge; HOD sees no indicator for reopened deterioration cases

**FF-10 — `authoritativeOperationalSemester` not propagated to batch edit modal**
- `src/system-admin-live-app.tsx:2684-2688`: `resolveAuthoritativeOperationalSemester` computed from run context
- `src/system-admin-live-app.tsx:3129-3143`: batch edit modal initializes from `selectedBatch.currentSemester`
- `src/system-admin-live-app.tsx:8157-8164`: modal form binds `selectedBatch.currentSemester` directly
- Auth-prompt E / UL-PL-03 / UL-QC-11: operational surface should serve `run.activeOperationalSemester -> batch.currentSemester -> fallback`; after activation the run value is authoritative but form shows stale batch field

## Recommendations

1. **Phase 5 (FF-01, FF-06, FF-07, FF-04)**: Risk Watch must render in read-only form at stage 1 — remove the full tab lock, add a "Watch Only — no actionable queue before TT1" banner instead. Wire HOD Acknowledge button to `acknowledgeAcademicProofReassessment`. Add explicit relock step after teacher edit/recompute in HOD correction cycle. Separate `canOpenSetup` (write) from `canViewSurface` (read) in `page-utils.ts`.
2. **Phase 4 (FF-08, FF-03)**: Default HOD watchlist filter to `showActionNeededOnly=false` so Watching rows are visible at semester start. Rename "Dismissed" label to "Handled" / "Case Closed" to match auth-prompt B.17 semantics.
3. **Phase 9 (FF-02, FF-05, FF-09)**: Add `concernContextKey`, `primaryCase`, `countsTowardCapacity` to `SharedTask`. Add `'WorkflowTask'` to `TaskType` union. Add `'reopened'` case to `resolveGovernedQueueState`.
4. **Phase 2 (FF-10)**: Propagate `authoritativeOperationalSemester` into batch edit modal hydration; display as read-only provenance label alongside editable `currentSemester`.
5. **Phase 5 (FF-06 cross-ref)**: Confirm `repositories.tasks.upsertTask` in `App.tsx:2469` calls backend; verify `due_at` persisted via API per UL-QC-08.

## Findings Table

| ID | Flow | Expected | Current code truth (file:line) | target_phase | severity |
| --- | --- | --- | --- | --- | --- |
| FF-01 | L3 | Risk Watch visible in Sem1 pre-TT1; only queue is watch-only (auth-prompt C.1, UL-QC-04) | `tabLocked('risk')` → `offering.stage < 2` disables tab; click blocked. `src/pages/course-pages.tsx:67` | Phase 5 | high |
| FF-02 | L7 | `concernContextKey = studentId+offeringId+concernFamily+semesterNumber` mandatory (auth-prompt C.2, UL-QC-01) | `SharedTask` has no `concernContextKey`, `primaryCase`, `countsTowardCapacity`. `src/domain.ts:286-318` | Phase 9 | high |
| FF-03 | L7 | dismissal = "handled" / case closed (auth-prompt B.17, appendix) | UI label "Dismissed" in chip and transition note. `src/App.tsx:2387`, `src/academic-route-pages.tsx:975` | Phase 4 | low |
| FF-04 | L9 | HOD cycle full: request→approve/reject→reset-unlock→teacher edit→recompute→relock (auth-prompt D.6) | `handleResetComplete` clears lock, resolves task; no relock handler after recompute. `src/App.tsx:3158-3207` | Phase 5 | medium |
| FF-05 | L7 | workflow tasks isolated, must not count as primary concern cases (auth-prompt C.4, UL-QC-03) | `TaskType` has no workflow category; no `primaryCase` boolean on `SharedTask`. `src/domain.ts:10`, `src/domain.ts:286-318` | Phase 9 | high |
| FF-06 | L4 | assessment surface always visible; lock/unlock governs edit only (auth-prompt F) | `canOpenSetup: stage <= 1 && !isLocked`; locked workspace card not inspectable. `src/page-utils.ts:49-56`, `src/pages/workflow-pages.tsx:555-579` | Phase 5 | high |
| FF-07 | L9 | HOD can acknowledge governed open cases via API | `<Btn>Acknowledge</Btn>` has no `onClick`; API exists but unwired. `src/pages/hod-pages.tsx:578` | Phase 5 | high |
| FF-08 | L8 | `watching` rows visible by default; pre-TT1 watch context not hidden (auth-prompt C.1, UL-QC-04) | `showActionNeededOnly` default hides watching rows; empty overview at semester start. `src/pages/hod-pages.tsx:484-532` | Phase 4 | medium |
| FF-09 | L7 | deterioration reopen creates new case; frontend must show badge for `'reopened'` status (auth-prompt B.18, UL-QC-06) | `resolveGovernedQueueState` maps `'reopened'` → `null`; no badge shown. `src/pages/hod-pages.tsx:43-49` | Phase 9 | medium |
| FF-10 | L1-L2 | operational semester UI serves `run.activeOperationalSemester` authority (UL-PL-03) | batch edit modal hydrates from `selectedBatch.currentSemester`; ignores run-authoritative value. `src/system-admin-live-app.tsx:3129-3143`, `src/system-admin-live-app.tsx:8157-8164` | Phase 2 | medium |

## Severity Distribution

| severity | count | findings |
| --- | --- | --- |
| critical | 0 | — |
| high | 5 | FF-01, FF-02, FF-05, FF-06, FF-07 |
| medium | 4 | FF-04, FF-08, FF-09, FF-10 |
| low | 1 | FF-03 |

## Target-Phase Mapping

| target_phase | findings | rationale |
| --- | --- | --- |
| Phase 2 | FF-10 | activation contract / run-batch rewrite; `authoritativeOperationalSemester` must flow to edit modal |
| Phase 4 | FF-03, FF-08 | queue/taxonomy/workflow isolation doc + UX defaults; "handled" wording + watching-visible default |
| Phase 5 | FF-01, FF-04, FF-06, FF-07 | calendar bridge + HOD correction cycle closure; visibility/editability split; relock step; Acknowledge wiring |
| Phase 9 | FF-02, FF-05, FF-09 | contract-sensitive impl: `concernContextKey`, `primaryCase`, workflow task type, `'reopened'` mapping |
