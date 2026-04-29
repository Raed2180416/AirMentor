# Readiness And Security Audit — 2026-04-29

## Intent And Feature Intent
Mission intent: create defensible real-data and production-readiness gate. Not fake claim production complete.
Feature intent: AirMentor demo-ready only if real deployment obligations explicit. Data contracts, import validation, privacy/security, model governance, real-data validation, operations. CERT-In incident logging/reporting and audit trails treated as readiness gates for India deployment. Not optional polish.

## Method
Read repo truth anchors.
Read `docs/demo/final-demo-readiness-2026-04-27.md`.
Read `docs/closeout/final-authoritative-plan-security-observability-annex.md`.
Read `docs/closeout/deploy-env-contract.md`.
Read `audit-map/22-evals/environment-readiness-checklist.md`.
Read `audit-map/32-reports/closure-readiness-verdict.md`.
Read `audit-map/32-reports/setup-readiness-report.md`.
Read `air-mentor-api/src/db/schema.ts`.
Read `air-mentor-api/src/modules/session.ts`.
Read `air-mentor-api/src/modules/admin-proof-sandbox.ts`.
Read `air-mentor-api/src/modules/academic.ts`.
Read `air-mentor-api/src/config.ts`.
Read `.github/workflows/ci-verification.yml`.
Read `.github/workflows/deploy-railway-api.yml`.
Assess schema/gate for data contract, import validation, privacy/security, model governance, real-data validation, operational readiness.

## Real Data Contract
Schema assessment:
- students: `students` table. Source: import. Type: `student_id` text PK, `usn` text notNull, `name` text notNull. Nullable: `roll_number`, `email`, `phone`. Stage availability: all. Validation rule: unique `student_id`, `usn`. Owner: institution. Import frequency: batch/term.
- enrollments: `student_enrollments` table. Source: import. Type: `enrollment_id` text PK, `student_id` text notNull, `branch_id` text notNull, `term_id` text notNull. Nullable: `end_date`. Stage availability: all. Validation rule: valid FKs. Owner: institution. Import frequency: term.
- courses: `courses` table. Source: import. Type: `course_id` text PK, `course_code` text notNull. Nullable: none. Stage availability: all. Validation rule: unique `course_id`. Owner: institution. Import frequency: batch/term.
- offerings: `section_offerings` table. Source: import/admin. Type: `offering_id` text PK. Nullable: `pending_action`. Stage availability: all. Validation rule: valid FKs. Owner: institution. Import frequency: term.
- faculty: `faculty_profiles` table. Source: import. Type: `faculty_id` text PK, `employee_code` text notNull. Nullable: `joined_on`. Stage availability: all. Validation rule: unique `faculty_id`. Owner: institution. Import frequency: batch/term.
- mentor assignments: `mentor_assignments` table. Source: import/admin. Type: `assignment_id` text PK. Nullable: `effective_to`. Stage availability: all. Validation rule: valid FKs. Owner: institution. Import frequency: term.
- timetable: `faculty_calendar_workspaces` table. Source: admin/faculty. Type: `faculty_id` text PK, `template_json` text notNull. Nullable: none. Stage availability: all. Validation rule: valid JSON. Owner: faculty. Import frequency: term.
- attendance: `student_attendance_snapshots` table. Source: faculty/import. Type: `attendance_snapshot_id` text PK. Nullable: none. Stage availability: all. Validation rule: `present_classes` <= `total_classes`. Owner: faculty. Import frequency: daily/weekly.
- marks: `student_assessment_scores` table. Source: faculty/import. Type: `assessment_score_id` text PK. Nullable: `component_code`. Stage availability: post-assessment. Validation rule: `score` <= `max_score`. Owner: faculty. Import frequency: post-assessment.
- question papers: `offering_question_papers` table. Source: faculty. Type: `paper_id` text PK. Nullable: `updated_by_faculty_id`. Stage availability: pre-assessment. Validation rule: valid JSON blueprint. Owner: faculty. Import frequency: pre-assessment.
- CO mappings: `course_outcome_overrides` table. Source: admin/faculty. Type: `course_outcome_override_id` text PK. Nullable: none. Stage availability: all. Validation rule: valid JSON outcomes. Owner: institution/faculty. Import frequency: term.
- assessment weights: `offering_assessment_schemes` table. Source: admin/faculty. Type: `offering_id` text PK. Nullable: `configured_by_faculty_id`. Stage availability: all. Validation rule: valid JSON scheme. Owner: institution/faculty. Import frequency: term.
- SEE results: `transcript_subject_results` table. Source: import. Type: `transcript_subject_result_id` text PK. Nullable: none. Stage availability: post-term. Validation rule: valid FKs. Owner: institution. Import frequency: post-term.
- backlogs: `transcript_term_results` table. Source: import. Type: `transcript_term_result_id` text PK, `backlog_count` integer notNull. Nullable: none. Stage availability: post-term. Validation rule: `backlog_count` >= 0. Owner: institution. Import frequency: post-term.
- CGPA/SGPA: `transcript_term_results` table. Source: import. Type: `sgpa_scaled` integer notNull. Nullable: none. Stage availability: post-term. Validation rule: scaled integer. Owner: institution. Import frequency: post-term.
- interventions: `student_interventions` table. Source: faculty. Type: `intervention_id` text PK. Nullable: `faculty_id`, `offering_id`. Stage availability: all. Validation rule: valid FKs. Owner: faculty. Import frequency: ad-hoc.

## Import Validation Gates
- no duplicate student IDs: Enforced by `student_id` PK in `students` table.
- course codes valid: Enforced by `course_id` FK in `section_offerings` and `curriculum_courses`.
- offering IDs valid: Enforced by `offering_id` FK in multiple tables.
- faculty assignments valid: Enforced by `faculty_id` FK in `faculty_appointments` and `faculty_offering_ownerships`.
- marks within bounds: Enforced by `score` <= `max_score` logic in `student_assessment_scores` and `assessmentCommitSchema`.
- attendance denominator > 0: Enforced by `totalClasses: z.number().int().min(1)` in `attendanceCommitSchema`.
- assessment weights sum correctly: Enforced by `validateSchemeAgainstPolicy` in `air-mentor-api/src/modules/academic.ts`.
- CO mappings complete: Enforced by `courseOutcomeOverrideCreateSchema` requiring at least 1 outcome.
- prerequisite graph valid: Enforced by `buildGraphAwarePrerequisiteSummary` logic.
- no future evidence in early stage: Enforced by `buildOfferingStageEligibility` checking `targetStage?.requiredEvidence`.

## Privacy Security And Audit Gates
- role-based access control: Enforced by `requireRole` and `assertAcademicAccess` in `air-mentor-api/src/modules/academic.ts` and `air-mentor-api/src/modules/admin-proof-sandbox.ts`.
- least privilege: Enforced by role-scoped access rules (`evaluateHodStudentScopeAccess`, `evaluateMentorStudentScopeAccess`, `evaluateCourseLeaderOfferingManagementAccess`).
- audit logs: Enforced by `audit_events` table and `emitAuditEvent` calls.
- encryption at rest if hosted: Railway Postgres provides encryption at rest.
- TLS in transit: Enforced by `SESSION_COOKIE_SECURE=true` and HTTPS requirement for production-like origins.
- secret management: Enforced by `RAILWAY_TOKEN`, `CSRF_SECRET`, `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD` in GitHub Actions.
- data retention policy: Not explicitly defined in schema. Needs definition.
- delete/export policy: Not explicitly defined in schema. Needs definition.
- breach response plan: Not explicitly defined in repo. Needs definition.
- admin action audit: Enforced by `audit_events` table for `SYSTEM_ADMIN` actions.
- teacher edit audit: Enforced by `audit_events` table and `lockAuditByTarget` in `academic_runtime_state`.
- CERT-In incident logging/reporting readiness: Telemetry exists (`operational_telemetry_events`), but explicit CERT-In reporting format/process missing. Blocker for India deployment.

## Model Governance Gates
- training data version: Tracked in `risk_model_artifacts.source_run_ids_json`.
- feature schema version: Tracked in `risk_model_artifacts.feature_schema_version`.
- model version: Tracked in `risk_model_artifacts.artifact_version`.
- calibration version: Tracked in `risk_model_artifacts.evaluation_json`.
- evaluation report: Tracked in `risk_model_artifacts.evaluation_json`.
- known caveats: Documented in `docs/demo/final-demo-readiness-2026-04-27.md` (e.g., synthetic baseline used).
- probability display guards: Enforced by `riskProbScaled` and `riskBand` mapping.
- threshold policy: Enforced by `PROOF_DEMO_OPERATIONAL_THRESHOLDS` and `policySnapshotJson`.
- override policy: Enforced by `risk_overrides` table.
- human review policy: Enforced by `alert_decisions` and `reassessment_resolutions` tables.
- appeal/correction process: Enforced by `admin_requests` table.

## Real Data Validation Gates
- historical backtest: Not yet performed with real data. Synthetic baseline used.
- temporal split: Not yet performed with real data.
- semester-level validation: Not yet performed with real data.
- course-level validation: Not yet performed with real data.
- subgroup/fairness checks: Not yet performed with real data.
- calibration by semester/stage: Not yet performed with real data.
- precision@capacity: Not yet performed with real data.
- false positive burden: Not yet performed with real data.
- teacher workload simulation: Tracked in `teacher_load_profiles`, but needs real data validation.
- intervention outcome audit: Tracked in `student_intervention_response_states`, but needs real data validation.

## Operational Readiness Gates
- backup/restore: Railway provides automated backups.
- monitoring: Enforced by `/health` endpoint and `operational_telemetry_events`.
- health checks: Enforced by `air-mentor-api/src/startup-diagnostics.ts` and `/health`.
- error tracking: Enforced by `operational_telemetry_events` and `client-telemetry`.
- deployment rollback: Railway supports rollback.
- database migration plan: Drizzle ORM used, but explicit migration runbook needs verification.
- seed/demo isolation: Enforced by `MSRUAS_PROOF_BATCH_ID` and `ensureMsruasProofBatchStructure`.
- production/staging separation: Enforced by `RAILWAY_ENVIRONMENT` in GitHub Actions.
- load test: Not explicitly documented.
- browser compatibility: Enforced by Playwright tests (`playwright-admin-live-acceptance.sh`).

## Blockers
1. CERT-In incident logging/reporting readiness: Missing explicit process/format.
2. Real-data validation: All real-data validation gates (historical backtest, temporal split, etc.) are blocked pending real institutional data. Current model is synthetic baseline.
3. Data retention and delete/export policies: Missing explicit definition.
4. Breach response plan: Missing explicit definition.

## Demo-Safe Caveats
1. Backend is on laptop, not production host.
2. Risk model is synthetic baseline; real-data calibration is post-demo roadmap.
3. Sem 2-3 pre-TT1 cohort split intentionally conservative.
4. CO mapping verified only for seeded MSRUAS MnC syllabus.
5. Data safety: seeded embedded Postgres, ephemeral, never touches Railway.

## Verdict
Status: `partial` / `demo-ready`
AirMentor is demo-ready with synthetic data and local backend. It is NOT production-ready for real institutional use. Real-data validation, CERT-In compliance, and explicit privacy policies are hard blockers for production deployment.
