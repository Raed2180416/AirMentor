# AirMentor Product Architecture Map

**Version:** 2026-06-06-v2  
**Scope:** Complete feature-to-source mapping for university-agnostic product navigation  
**Status:** Corrected product intent — this is a REAL product, not research-only. Demo/proof layer is temporary scaffolding.

---

## 1. Product Surface by Role

### 1.1 System Admin (University Configuration Hub)
**Goal:** Deeply configure every aspect of a university's academic structure.

| Feature | Source Files | Key Functions/Components | Notes |
|---------|-------------|--------------------------|-------|
| Institution profile | `air-mentor-api/src/modules/admin-structure.ts` | `registerAdminStructureRoutes`, `DEFAULT_POLICY` | Hardcoded MSRUAS assumptions still present |
| Department/branch management | `air-mentor-api/src/modules/admin-structure.ts` | PATCH `/api/admin/departments/:id`, `/api/admin/branches/:id` | |
| Batch creation & provisioning | `air-mentor-api/src/modules/admin-structure.ts` | `post /api/admin/batches/:batchId/provision`, `buildAcademicBootstrap` | `buildAcademicBootstrap` complexity 481 — CRITICAL HOTSPOT |
| Curriculum graph builder | `air-mentor-api/src/modules/curriculum-graph-routes.ts`, `src/system-admin-curriculum-graph.tsx` | `registerCurriculumGraphRoutes`, `CurriculumGraphContent` | Undo/redo, LLM suggestions, validation |
| Course & offering management | `air-mentor-api/src/modules/admin-structure.ts`, `air-mentor-api/src/modules/academic-admin-offerings-routes.ts` | `registerAcademicAdminOfferingRoutes` | Complexity 222 |
| Faculty management & role grants | `air-mentor-api/src/modules/admin-structure.ts`, `air-mentor-api/src/modules/people.ts` | `registerPeopleRoutes`, `matchesFacultyDirectoryScope` | |
| Mentor assignments | `air-mentor-api/src/modules/admin-structure.ts` | `post /api/admin/mentor-assignments` | |
| Policy overrides | `air-mentor-api/src/modules/admin-structure.ts` | `patch /api/admin/policy-overrides/:id` | |
| Demo workspace provisioning | `air-mentor-api/src/modules/admin-structure.ts` | `post /api/admin/demo-workspaces/:id/provision` | DEMO SCAFFOLDING |
| Proof run management | `air-mentor-api/src/modules/admin-control-plane.ts` | `registerAdminControlPlaneRoutes` | Complexity 251; DEMO SCAFFOLDING |
| Live app workspace | `src/system-admin-live-app.tsx` | `SystemAdminLiveApp` | **Complexity 1575 — MASSIVE HOTSPOT** |
| Proof dashboard workspace | `src/system-admin-proof-dashboard-workspace.tsx` | `SystemAdminProofDashboardWorkspace` | Complexity 236; DEMO SCAFFOLDING |
| Timetable editor | `src/system-admin-timetable-editor.tsx` | `SystemAdminTimetableEditor` | Complexity 196 |
| Faculties workspace | `src/system-admin-faculties-workspace.tsx` | `SystemAdminFacultiesWorkspace` | Complexity 163 |

### 1.2 HOD (Head of Department)
**Goal:** Department-wide oversight, all students, all faculty, unlock mark entries.

| Feature | Source Files | Key Functions/Components | Notes |
|---------|-------------|--------------------------|-------|
| Department dashboard | `src/pages/hod-pages.tsx` | `HodView` | |
| All students view | `src/pages/workflow-pages.tsx` | `AllStudentsPage` | Roster, filter, action hub |
| Student history | `src/pages/workflow-pages.tsx` | `StudentHistoryPage` | Transcript, SGPA/CGPA, backlog |
| Course detail | `src/pages/course-pages.tsx` | `CourseDetail` | |
| Unlock review | `src/pages/hod-pages.tsx` | `UnlockReviewPage` | |
| Queue history | `src/pages/workflow-pages.tsx` | `QueueHistoryPage` | |
| Calendar | `src/pages/calendar-pages.tsx` | `CalendarTimetablePage` | Complexity 327 |
| Proof analytics | `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `buildHodProofAnalytics` | Complexity 581; DEMO SCAFFOLDING |
| Risk explorer | `src/pages/risk-explorer.tsx` | `RiskExplorerPage` | Complexity 129 |

### 1.3 Mentor
**Goal:** Per-mentee cross-subject risk view, action queue.

| Feature | Source Files | Key Functions/Components | Notes |
|---------|-------------|--------------------------|-------|
| Mentor dashboard | `src/pages/hod-pages.tsx` (shared) | `MentorView` | |
| Mentee detail | `src/pages/student-shell.tsx` | `MenteeDetailPage` | |
| Queue/action cards | `src/academic-route-pages.tsx` | `action-queue-item` testids | |
| Calendar/timetable | `src/pages/calendar-pages.tsx` | `CalendarTimetablePage` | |
| Student history | `src/pages/workflow-pages.tsx` | `StudentHistoryPage` | |

### 1.4 Course Leader
**Goal:** Subject-specific performance, assessment entry, scheme setup, queue pressure.

| Feature | Source Files | Key Functions/Components | Notes |
|---------|-------------|--------------------------|-------|
| CL dashboard | `src/pages/course-pages.tsx` | `CLDashboard` | |
| Course detail | `src/pages/course-pages.tsx` | `CourseDetail` | |
| All students | `src/pages/workflow-pages.tsx` | `AllStudentsPage` | |
| Scheme setup | `src/pages/workflow-pages.tsx` | `SchemeSetupPage` | Configure CE internals under policy |
| Entry workspace | `src/pages/workflow-pages.tsx` | `EntryWorkspacePage` | Direct attendance/TT/quiz/assignment/SEE entry |
| Upload hub | `src/pages/workflow-pages.tsx` | `UploadPage` | CSV disabled |
| Queue history | `src/pages/workflow-pages.tsx` | `QueueHistoryPage` | |
| Assessment entry & locks | `air-mentor-api/src/modules/academic-runtime-routes.ts` | `PUT assessment-entries/:kind`, `POST clear-lock` | |
| Attendance persistence | `air-mentor-api/src/modules/academic-runtime-routes.ts` | `PUT attendance` | |

### 1.5 Student
**Goal:** Self-view of performance, risk, shell agent.

| Feature | Source Files | Key Functions/Components | Notes |
|---------|-------------|--------------------------|-------|
| Student shell | `src/pages/student-shell.tsx`, `air-mentor-api/src/modules/academic-proof-routes.ts` | `StudentShellPage`, student shell card/timeline/session/message | |
| Risk explorer | `src/pages/risk-explorer.tsx` | `RiskExplorerPage` | |
| History | `src/pages/workflow-pages.tsx` | `StudentHistoryPage` | |

---

## 2. Core Backend Architecture

### 2.1 API Route Modules (Fastify)

| Module | File | Route Count | Complexity | Role |
|--------|------|-------------|------------|------|
| Admin structure | `air-mentor-api/src/modules/admin-structure.ts` | ~40 | 327 (register), 481 (bootstrap) | CRUD for all university entities |
| Academic runtime | `air-mentor-api/src/modules/academic-runtime-routes.ts` | ~15 | 338 | Live assessment/attendance entry |
| Academic (core) | `air-mentor-api/src/modules/academic.ts` | ~20 | 481 (bootstrap) | Student shell, proof tasks, analytics |
| Academic proof | `air-mentor-api/src/modules/academic-proof-routes.ts` | ~10 | 38 | Proof-scoped student endpoints |
| Admin control plane | `air-mentor-api/src/modules/admin-control-plane.ts` | ~15 | 251 | Proof run lifecycle |
| Academic admin offerings | `air-mentor-api/src/modules/academic-admin-offerings-routes.ts` | ~10 | 222 | Offering stage management |
| Curriculum graph | `air-mentor-api/src/modules/curriculum-graph-routes.ts` | ~8 | 40 | Graph builder API |
| People | `air-mentor-api/src/modules/people.ts` | ~8 | 60 | Faculty directory |
| Students | `air-mentor-api/src/modules/students.ts` | ~6 | 81 | Student CRUD |
| Session | `air-mentor-api/src/modules/session.ts` | ~4 | 51 | Auth, role context |
| Support | `air-mentor-api/src/modules/support.ts` | ~5 | - | Auth helpers, schemas |
| Academic access | `air-mentor-api/src/modules/academic-access.ts` | N/A | - | Role-based access evaluation |

### 2.2 Domain Services (Library Layer)

| Service | File | Key Exports | Complexity | Notes |
|---------|------|-------------|------------|-------|
| Risk model definitions | `air-mentor-api/src/lib/proof-risk-model.ts` | `buildObservableFeaturePayload`, `writeFeatureVectorToBuffer`, `featureVectorFromPayload`, `trainLogisticBaseCompact`, `scoreWithTreeBridge` | `writeFeatureVectorToBuffer`: 98, `chooseCalibration`: 66, `buildObservableFeaturePayload`: 49 | **CORE RISK ENGINE**. Contains feature schema v6 (48 features), model serving, tree bridge, calibration |
| Proof control plane (simulator) | `air-mentor-api/src/lib/msruas-proof-control-plane.ts` | `simulateSemesterCourse`, `publishOperationalProjection`, `buildPolicyDiagnostics` | `simulateSemesterCourse`: 160, `publishOperationalProjection`: 150 | DEMO SCAFFOLDING — MSRUAS-specific simulator |
| Proof sandbox | `air-mentor-api/src/lib/msruas-proof-sandbox.ts` | `seedMsruasProofSandboxUnsafe` | 211 | DEMO SCAFFOLDING |
| Seeded semester service | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | Semester progression logic | - | DEMO SCAFFOLDING |
| Runtime service | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | `recomputeObservedOnlyRisk` | 274 | Bridges demo and live paths |
| Policy service | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts` | `buildPolicyDiagnostics` | 150 | Policy validation |
| Playback governance | `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts` | `buildPlaybackGovernanceArtifacts` | 120 | DEMO governance |
| Rebuild context | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts` | `preparePlaybackRebuildContext` | 120 | DEMO scaffolding |
| Tail service | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | `buildStudentAgentCardFresh`, `buildFacultyProofView` | 369, 149 | UI payload builders |
| HOD service | `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `buildHodProofAnalytics` | 581 | DEMO analytics |
| Advance service | `air-mentor-api/src/lib/proof-control-plane-advance-service.ts` | Stage advancement | - | DEMO scaffolding |
| Inference engine | `air-mentor-api/src/lib/inference-engine.ts` | Risk inference orchestration | - | |

### 2.3 Database Layer (Drizzle ORM)

| File | Purpose | Key Tables |
|------|---------|------------|
| `air-mentor-api/src/db/schema.ts` | Complete schema definitions | institutions, departments, branches, batches, sections, students, faculty, roleGrants, courseOfferings, curriculumCourses, assessments, attendance, transcriptSubjectResults, transcriptTermResults, proofRuns, proofCheckpoints, mentorAssignments, etc. |
| `air-mentor-api/src/db/migrations/` | Schema migrations | Check latest: `0026_backlog_credit_migration.sql` |

---

## 3. ML / Risk Model Layer

### 3.1 Feature Schema v6 (48 features: feat_0..feat_47)

| Feature Group | Feature Indices | Description | Source |
|---------------|-----------------|-------------|--------|
| Attendance | feat_0..feat_4 | Absence counts, percentages | Runtime attendance entries |
| Internal marks | feat_5..feat_9 | TT1, TT2, quiz, assignment, internal | Runtime assessment entries |
| SEE | feat_10..feat_14 | SEE marks, percentages | Runtime assessment entries |
| Historical | feat_15..feat_24 | Prior semester SGPA/CGPA, backlog | Transcript term results |
| Progress | feat_25 | Within-semester stage progress | Derived from stage key |
| Stage flags | feat_26..feat_30 | Binary stage indicators | Derived |
| Missingness | feat_31..feat_35 | Missing evidence flags | Derived from stage |
| Interactions | feat_36..feat_43 | Cross-feature interactions | Computed |
| Backlog credits | feat_44..feat_47 | Active, cleared, total, lower-year | Transcript + current state |

### 3.2 Risk Heads

| Head | Description | Current Model | Status |
|------|-------------|---------------|--------|
| attendanceRisk | Attendance failure risk | Logistic baseline | Production-ready |
| ceRisk | Continuous evaluation risk | Logistic/CatBoost shadow | Shadow only |
| seeRisk | Semester-end exam risk | Ensemble shadow | Shadow only |
| overallCourseRisk | Overall course failure risk | XGBoost (selected) / Logistic fallback | Shadow only, tree bridge gated |
| downstreamCarryoverRisk | Backlog/carryover risk | XGBoost shadow | Shadow only |

### 3.3 Training & Evaluation Scripts

| Script | Purpose | Location |
|--------|---------|----------|
| `train_sota_ensemble.py` | Main training pipeline (logistic + XGB + LGB + CatBoost) | `air-mentor-api/scripts/` |
| `train_catboost_challenger.py` | CatBoost-specific trainer with gates | `air-mentor-api/scripts/` |
| `generate_v2_data.py` | Synthetic cohort generator | `air-mentor-api/scripts/` |
| `run_sota_policy_benchmark.py` | Full benchmark orchestrator | `air-mentor-api/scripts/` |
| `run_shadow_tabular_benchmark.py` | Shadow tabular benchmark | `air-mentor-api/scripts/` |
| `evaluate_intervention_policies.py` | Policy evaluation | `air-mentor-api/scripts/` |
| `product_readiness_report.py` | Deployment gate checker | `air-mentor-api/scripts/` |
| `fairness_deep_dive.py` | Fairness slice analysis | `air-mentor-api/scripts/` |
| `queue_workload_report.py` | Workload/capacity evidence | `air-mentor-api/scripts/` |
| `run_ablation_suite.py` | Feature ablation suite | `air-mentor-api/scripts/` |
| `export_shadow_predictions.py` | Shadow prediction export | `air-mentor-api/scripts/` |
| `validate_synthetic_quality.py` | Synthetic data quality | `air-mentor-api/scripts/` |
| `tree-scoring-bridge.py` | XGB/LGB inference bridge | `air-mentor-api/scripts/` |

---

## 4. Frontend Architecture

### 4.1 Top-Level Components

| Component | File | Complexity | Notes |
|-----------|------|------------|-------|
| App | `src/App.tsx` | OperationalApp: 142, OperationalWorkspace: 680 | **ROOT STATE OWNER**. Owns schemeByOffering, ttBlueprints, studentPatches, drafts, cellValues, locks, lockAudit |
| Route surface | `src/academic-workspace-route-surface.tsx` | - | Lazy routes for all role pages |
| Sidebar | `src/academic-workspace-sidebar.tsx` | - | Navigation |
| Content shell | `src/academic-workspace-content-shell.tsx` | - | Layout wrapper |
| Topbar | `src/academic-workspace-topbar.tsx` | - | Header |
| Session shell | `src/academic-session-shell.tsx` | - | Auth/session wrapper |

### 4.2 Page Components by Role

| Role | Pages | File |
|------|-------|------|
| System Admin | Live app, Proof dashboard, Timetable, Faculties, Curriculum graph | `src/system-admin-*.tsx` |
| HOD | HodView, CourseDetail, UnlockReview, QueueHistory, Calendar | `src/pages/hod-pages.tsx`, `src/pages/course-pages.tsx`, `src/pages/calendar-pages.tsx` |
| Mentor | MentorView, MenteeDetail, QueueHistory, Calendar | `src/pages/hod-pages.tsx`, `src/pages/student-shell.tsx`, `src/pages/calendar-pages.tsx` |
| Course Leader | CLDashboard, CourseDetail, AllStudents, SchemeSetup, Upload, EntryWorkspace, QueueHistory | `src/pages/course-pages.tsx`, `src/pages/workflow-pages.tsx` |
| Student | StudentShell, RiskExplorer, History | `src/pages/student-shell.tsx`, `src/pages/risk-explorer.tsx`, `src/pages/workflow-pages.tsx` |

### 4.3 UI Primitives & Shared

| Component/File | Purpose |
|----------------|---------|
| `src/ui-primitives.tsx` | Reusable UI components |
| `src/theme.ts` | Theme configuration |
| `src/telemetry.ts` | Client telemetry |
| `src/api/client.ts` | API client |
| `src/api/types.ts` | Shared type definitions |
| `src/repositories.ts` | Live mode API method mapping |
| `src/selectors.ts` | State selectors |
| `src/action-code-humaniser.ts` | Action label humanization |

---

## 5. Complexity Hotspots (Agent Warning)

These files have extremely high cyclomatic complexity. **Any agent modifying these MUST use impact analysis first.**

| Rank | File | Function | Complexity | Risk |
|------|------|----------|------------|------|
| 1 | `src/system-admin-live-app.tsx` | `SystemAdminLiveApp` | 1575 | Massive admin UI — likely contains many sub-features that should be split |
| 2 | `src/App.tsx` | `OperationalWorkspace` | 680 | Root workspace orchestration |
| 3 | `air-mentor-api/src/lib/proof-control-plane-hod-service.ts` | `buildHodProofAnalytics` | 581 | HOD analytics builder |
| 4 | `src/obsidian-graph.tsx` | `ObsidianGraph` | 547 | Curriculum graph visualization (D3/XYFlow) |
| 5 | `air-mentor-api/src/modules/academic.ts` | `buildAcademicBootstrap` | 481 | Batch provisioning — MSRUAS-specific |
| 6 | `air-mentor-api/src/modules/academic-runtime-routes.ts` | `registerAcademicRuntimeRoutes` | 338 | Runtime route registration |
| 7 | `air-mentor-api/src/modules/admin-structure.ts` | `registerAdminStructureRoutes` | 327 | Admin CRUD routes |
| 8 | `src/pages/calendar-pages.tsx` | `CalendarTimetablePage` | 327 | Calendar/timetable UI |
| 9 | `air-mentor-api/src/modules/admin-control-plane.ts` | `registerAdminControlPlaneRoutes` | 251 | Proof control routes |
| 10 | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | `buildStudentAgentCardFresh` | 369 | Student card payload builder |

---

## 6. University-Agnostic Configuration Gaps

These areas still contain hardcoded MSRUAS/M&C assumptions and MUST be made configurable:

| Area | Hardcoded Assumptions | Config Target | Priority |
|------|----------------------|---------------|----------|
| Grading | O=10, A+=9...F=0 scale | `DEFAULT_POLICY.gradeMapping` | P0 |
| SGPA/CGPA formula | Credit-based with `includeFailedCredits=false` conflict | `DEFAULT_POLICY.sgpaCgpaRules` | P0 |
| CE/SEE weighting | 60/40 (TS) vs 40/60 (Python generator) mismatch | `DEFAULT_POLICY.assessmentWeights` | P0 |
| Backlog limit | 15 credits max | `DEFAULT_POLICY.promotionRules.maxBacklogCredits` | P0 |
| Degree duration | 6 semesters assumed | `DEFAULT_POLICY.degreeDuration` | P1 |
| Stage progression | Pre-TT1 → TT1 → TT2 → Pre-SEE → Post-SEE | `DEFAULT_POLICY.semesterStages` | P1 |
| Course credits | Mostly 4-credit assumption | Per-course configurable | P1 |
| Program template | MNC 2023 batch hardcoded | Runtime template contract | P0 |
| Faculty roles | HOD/Mentor/Course Leader only | Configurable role hierarchy | P1 |
| Capacity limits | Mentor=15, CL=20 hardcoded | Institution-configurable | P1 |

---

## 7. Key API Endpoints Index

### 7.1 Authentication & Session
- `POST /api/session/login`
- `POST /api/session/role-context`
- `POST /api/session/password-setup/request`
- `POST /api/session/password-setup/redeem`
- `GET /api/session`
- `GET /api/session/password-setup/:token`

### 7.2 Academic Runtime (Live Production Path)
- `PUT /api/academic/offerings/:offeringId/attendance`
- `PUT /api/academic/offerings/:offeringId/assessment-entries/:kind`
- `POST /api/academic/offerings/:offeringId/assessment-entries/:kind/clear-lock`
- `PUT /api/academic/offerings/:offeringId/scheme`
- `PUT /api/academic/offerings/:offeringId/question-papers/:kind`
- `PUT /api/academic/runtime/:stateKey`
- `PUT /api/academic/tasks/:taskId`
- `PUT /api/academic/tasks/sync`
- `PUT /api/academic/task-placements/:taskId`
- `PUT /api/academic/task-placements/sync`
- `POST /api/academic/meetings`
- `PATCH /api/academic/meetings/:meetingId`
- `POST /api/academic/calendar-audit`
- `PUT /api/academic/calendar-audit/sync`
- `PUT /api/academic/faculty-calendar-workspace/:facultyId`
- `PUT /api/admin/faculty-calendar/:facultyId`

### 7.3 Proof/Demo Scaffolding
- `POST /api/admin/batches/:batchId/proof-runs`
- `POST /api/admin/proof-runs/:simulationRunId/activate`
- `POST /api/admin/proof-runs/:simulationRunId/activate-semester`
- `POST /api/admin/proof-runs/:simulationRunId/advance`
- `POST /api/admin/proof-runs/:simulationRunId/recompute-risk`
- `POST /api/admin/proof-runs/:simulationRunId/stop`
- `POST /api/admin/proof-runs/:simulationRunId/archive`
- `POST /api/admin/proof-runs/:simulationRunId/restore-snapshot`
- `GET /api/admin/proof-runs/:simulationRunId/checkpoints`
- `GET /api/admin/proof-runs/:simulationRunId/checkpoints/:checkpointId/students`
- `POST /api/academic/proof-runs/:simulationRunId/advance`
- `POST /api/academic/proof-runs/:simulationRunId/recompute-risk`
- `POST /api/academic/proof-runs/:simulationRunId/stop`
- `POST /api/academic/proof-reassessments/:reassessmentEventId/acknowledge`
- `POST /api/academic/proof-reassessments/:reassessmentEventId/resolve`

### 7.4 Admin CRUD
- Full CRUD for: batches, branches, departments, courses, curriculum-courses, course-outcomes, faculty, students, enrollments, offerings, mentor-assignments, role-grants, appointments, reminders, requests
- `POST /api/admin/batches/:batchId/curriculum/bootstrap`
- `POST /api/admin/batches/:batchId/curriculum-graph/draft|publish|undo|redo|validate|suggest`
- `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision`

---

## 8. Test Architecture

| Suite | Location | Count | Purpose |
|-------|----------|-------|---------|
| Frontend unit | `tests/` | ~20 files | Component tests (Vitest + jsdom) |
| Backend unit | `air-mentor-api/tests/` | ~30 files | API/service tests (Vitest) |
| E2E browser | `tests-e2e/` | ~10 specs | Playwright (Firefox, Chromium) |

Key test files:
- `air-mentor-api/tests/proof-risk-model.test.ts` — Risk model contract tests
- `air-mentor-api/tests/proof-control-plane-advance-service.test.ts` — Stage advancement regression
- `air-mentor-api/tests/msruas-proof-sandbox.test.ts` — Simulator seeding tests
- `tests/academic-route-pages.test.tsx` — UI route tests
- `tests/system-admin-proof-dashboard-workspace.test.tsx` — Admin dashboard tests
- `tests-e2e/specs/airmentor-demo-hardening-api-verification.spec.ts` — Full API verification

