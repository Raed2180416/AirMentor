# Readiness And Security Audit — 2026-04-29

## Intent And Feature Intent
Mission intent: create defensible real-data and production-readiness gate. Not fake claim production complete.
Feature intent: AirMentor demo-ready only if real deployment obligations explicit. Data contracts, import validation, privacy/security, model governance, real-data validation, operations must exist. CERT-In incident logging/reporting and audit trails are readiness gates for India deployment, not optional polish.

## Method
Read repo truth. Inspect `air-mentor-api/src/db/schema.ts` for data contract. Inspect `air-mentor-api/src/modules/session.ts`, `air-mentor-api/src/modules/admin-proof-sandbox.ts`, `air-mentor-api/src/modules/academic.ts` for validation and gates. Inspect `air-mentor-api/src/config.ts` for operational readiness. Inspect `.github/workflows/ci-verification.yml` and `.github/workflows/deploy-railway-api.yml` for deployment gates. Inspect `docs/demo/final-demo-readiness-2026-04-27.md`, `docs/closeout/final-authoritative-plan-security-observability-annex.md`, `docs/closeout/deploy-env-contract.md`, `audit-map/22-evals/environment-readiness-checklist.md`, `audit-map/32-reports/closure-readiness-verdict.md`, `audit-map/32-reports/setup-readiness-report.md` for context.

## Real Data Contract
Schema assessment:
- students: `students` table. Source: import. Type: text/integer. Nullable: email, phone, rollNumber. Stage availability: admissionDate. Validation rule: usn not null. Owner: institution. Import frequency: batch.
- enrollments: `student_enrollments` table. Source: import. Type: text/integer. Nullable: endDate. Stage availability: startDate. Validation rule: studentId, branchId, termId not null. Owner: institution. Import frequency: term.
- courses: `courses` table. Source: import. Type: text/integer. Nullable: none. Stage availability: createdAt. Validation rule: courseCode not null. Owner: institution. Import frequency: batch.
- offerings: `section_offerings` table. Source: import/manual. Type: text/integer. Nullable: pendingAction. Stage availability: stage. Validation rule: courseId, termId, branchId not null. Owner: faculty. Import frequency: term.
- faculty: `faculty_profiles` table. Source: import. Type: text/integer. Nullable: joinedOn. Stage availability: createdAt. Validation rule: employeeCode not null. Owner: institution. Import frequency: batch.
- mentor assignments: `mentor_assignments` table. Source: import/manual. Type: text/integer. Nullable: effectiveTo. Stage availability: effectiveFrom. Validation rule: studentId, facultyId not null. Owner: faculty. Import frequency: term.
- timetable: `faculty_calendar_workspaces` table. Source: manual. Type: text/json. Nullable: none. Stage availability: updatedAt. Validation rule: templateJson not null. Owner: faculty. Import frequency: manual.
- attendance: `student_attendance_snapshots` table. Source: manual/import. Type: text/integer. Nullable: none. Stage availability: capturedAt. Validation rule: presentClasses <= totalClasses. Owner: faculty. Import frequency: daily/weekly.
- marks: `student_assessment_scores` table. Source: manual/import. Type: text/integer. Nullable: componentCode. Stage availability: evaluatedAt. Validation rule: score <= maxScore. Owner: faculty. Import frequency: per assessment.
- question papers: `offering_question_papers` table. Source: manual. Type: text/json. Nullable: updatedByFacultyId. Stage availability: createdAt. Validation rule: blueprintJson not null. Owner: faculty. Import frequency: per assessment.
- CO mappings: `course_outcome_overrides` table. Source: manual/import. Type: text/json. Nullable: none. Stage availability: createdAt. Validation rule: outcomesJson not null. Owner: faculty/institution. Import frequency: batch/term.
- assessment weights: `offering_assessment_schemes` table. Source: manual. Type: text/json. Nullable: configuredByFacultyId. Stage availability: createdAt. Validation rule: schemeJson not null. Owner: faculty. Import frequency: term.
- SEE results: `transcript_subject_results` table. Source: import. Type: text/integer. Nullable: none. Stage availability: createdAt. Validation rule: score >= 0. Owner: institution. Import frequency: term end.
- backlogs: `transcript_term_results` table. Source: import. Type: text/integer. Nullable: none. Stage availability: createdAt. Validation rule: backlogCount >= 0. Owner: institution. Import frequency: term end.
- CGPA/SGPA: `transcript_term_results` table. Source: import. Type: text/integer. Nullable: none. Stage availability: createdAt. Validation rule: sgpaScaled >= 0. Owner: institution. Import frequency: term end.
- interventions: `student_interventions` table. Source: manual. Type: text. Nullable: facultyId, offeringId. Stage availability: occurredAt. Validation rule: interventionType not null. Owner: faculty. Import frequency: manual.

## Import Validation Gates
- no duplicate student IDs: Enforced by `studentId` primary key in `students` table.
- course codes valid: Enforced by `courseId` foreign key in `section_offerings` table.
- offering IDs valid: Enforced by `offeringId` foreign key in related tables.
- faculty assignments valid: Enforced by `facultyId` foreign key in `faculty_appointments` table.
- marks within bounds: Enforced by `score <= maxScore` logic in `air-mentor-api/src/modules/academic.ts`.
- attendance denominator > 0: Enforced by `totalClasses >= 1` logic in `air-mentor-api/src/modules/academic.ts`.
- assessment weights sum correctly: Enforced by `validateSchemeAgainstPolicy` in `air-mentor-api/src/modules/academic.ts`.
- CO mappings complete: Enforced by `validateQuestionPaperBlueprint` in `air-mentor-api/src/modules/academic.ts`.
- prerequisite graph valid: Enforced by `buildGraphAwarePrerequisiteSummary` in `air-mentor-api/src/lib/graph-summary.ts`.
- no future evidence in early stage: Enforced by `buildOfferingStageEligibility` in `air-mentor-api/src/modules/academic.ts`.

## Privacy Security And Audit Gates
- role-based access control: Enforced by `requireRole` and `assertAcademicAccess` in `air-mentor-api/src/modules/academic.ts`.
- least privilege: Enforced by role-scoped queries in `air-mentor-api/src/modules/academic.ts`.
- audit logs: Enforced by `audit_events` table and `emitAuditEvent` in `air-mentor-api/src/modules/support.ts`.
- encryption at rest if hosted: Railway Postgres provides encryption at rest.
- TLS in transit: Enforced by `SESSION_COOKIE_SECURE=true` in `air-mentor-api/src/config.ts`.
- secret management: Enforced by `.env` and GitHub Secrets.
- data retention policy: Missing explicit automated deletion policy.
- delete/export policy: Missing explicit export/delete endpoints for users.
- breach response plan: Missing explicit document.
- admin action audit: Enforced by `audit_events` table.
- teacher edit audit: Enforced by `audit_events` table.
- CERT-In incident logging/reporting readiness: Missing explicit CERT-In format export.

## Model Governance Gates
- training data version: Tracked in `risk_model_artifacts` table.
- feature schema version: Tracked in `risk_model_artifacts` table.
- model version: Tracked in `risk_model_artifacts` table.
- calibration version: Tracked in `risk_model_artifacts` table.
- evaluation report: Available via `/api/admin/proof-models/evaluation`.
- known caveats: Documented in `docs/demo/final-demo-readiness-2026-04-27.md`.
- probability display guards: Enforced by `riskProbScaled` and `riskBand` in `simulation_stage_student_projections`.
- threshold policy: Enforced by `PROOF_DEMO_OPERATIONAL_THRESHOLDS`.
- override policy: Enforced by `risk_overrides` table.
- human review policy: Enforced by `alert_decisions` and `reassessment_resolutions` tables.
- appeal/correction process: Missing explicit student appeal flow.

## Real Data Validation Gates
- historical backtest: Supported by `simulation_runs` table.
- temporal split: Supported by `simulation_runs` table.
- semester-level validation: Supported by `simulation_stage_checkpoints` table.
- course-level validation: Supported by `simulation_stage_offering_projections` table.
- subgroup/fairness checks: Missing explicit automated fairness report.
- calibration by semester/stage: Supported by `risk_model_artifacts` table.
- precision@capacity: Supported by `simulation_stage_queue_cases` table.
- false positive burden: Supported by `simulation_stage_queue_cases` table.
- teacher workload simulation: Supported by `teacher_load_profiles` table.
- intervention outcome audit: Supported by `student_intervention_response_states` table.

## Operational Readiness Gates
- backup/restore: Supported by `simulation_reset_snapshots` table.
- monitoring: Supported by `operational_telemetry_events` table.
- health checks: Supported by `/health` endpoint.
- error tracking: Supported by `operational_telemetry_events` table.
- deployment rollback: Supported by Railway.
- database migration plan: Supported by Drizzle ORM.
- seed/demo isolation: Supported by `MSRUAS_PROOF_BATCH_ID`.
- production/staging separation: Supported by Railway environments.
- load test: Missing explicit load test report.
- browser compatibility: Supported by Playwright tests.

## Blockers
- CERT-In incident logging/reporting readiness missing.
- Data retention policy missing.
- Delete/export policy missing.
- Breach response plan missing.
- Subgroup/fairness checks missing.
- Load test report missing.
- Student appeal/correction process missing.

## Demo-Safe Caveats
- Backend is on laptop, not production host.
- Risk model is synthetic baseline.
- Sem 2-3 pre-TT1 cohort split conservative.
- CO mapping verified only for seeded MSRUAS MnC syllabus.

## Verdict
Status: partial. Demo-ready with caveats. Not production-ready for India deployment due to missing CERT-In readiness, retention policies, and fairness checks.
