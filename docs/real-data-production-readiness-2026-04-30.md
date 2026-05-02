# Real Data Production Readiness - 2026-04-30

## Verdict

Real college deployment status: **not ready**.

The current AirMentor system is suitable for synthetic/local proof and controlled demo work. It must not be represented as ready for institutional production until the gates in this document are closed with real college data, legal/privacy approval, and operational evidence.

Synthetic demo truth and production truth are separate:

- Synthetic/demo: seeded proof runs, local backend by default, GitHub Pages frontend as a demo surface, synthetic risk model evidence.
- Production: real student/faculty data, institution-owned hosting policy, signed data-processing terms, audited imports, production/staging/seed isolation, incident response, retention/export/delete policy, model governance, monitoring, rollback, and browser support proof.

## Evidence Base

Repo anchors reviewed:

- `air-mentor-api/src/db/schema.ts`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/modules/academic-access.ts`
- `air-mentor-api/src/modules/support.ts`
- `air-mentor-api/src/modules/session.ts`
- `air-mentor-api/src/modules/admin-proof-sandbox.ts`
- `air-mentor-api/src/config.ts`
- `docs/demo/final-demo-readiness-2026-04-27.md`
- `docs/closeout/final-authoritative-plan-security-observability-annex.md`
- `docs/closeout/deploy-env-contract.md`
- `audit-map/32-reports/realism-readiness-security-2026-04-29.md`

Official CERT-In references checked for readiness wording:

- CERT-In Directions dated 28 Apr 2022: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
- CERT-In FAQ on Cyber Security Directions: https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf
- CERT-In Incident Reporting Form: https://www.cert-in.org.in/PDF/certinirform.pdf

Parent institution/security/legal must verify current official CERT-In directions before go-live. This document records engineering readiness requirements, not legal advice.

## Real Data Source Contract

Every production import must carry:

- `source_system`: SIS, ERP, LMS, exam cell, HR/faculty system, timetable system, attendance device/app, or manual faculty entry.
- `source_owner`: named office/person accountable for correctness.
- `exported_at`: source-system timestamp in ISO-8601 with timezone.
- `imported_at`: backend timestamp.
- `academic_scope`: institution, branch, batch, term, semester, section.
- `schema_version`: versioned contract name.
- `source_checksum`: checksum of raw file/API payload.
- `row_count`: source count and accepted/rejected count.
- `import_environment`: `production`, `staging`, or `seed-demo`.
- `approved_by`: faculty/admin approver for production promotion.
- `audit_event_id`: immutable import audit reference.

Production import must be append-audited and replayable. Silent overwrite is not acceptable for marks, attendance, transcript, mentor assignment, role grant, or intervention data.

## Field Family Schema Matrix

| Field family | Current repo table(s) | Required production fields | Source | Type | Nullable | Stage availability | Validation rule | Owner | Import frequency |
|---|---|---|---|---|---|---|---|---|---|
| Students | `students`, `user_accounts` when login exists | `student_id`, `institution_id`, `usn`, `roll_number`, `name`, `email`, `phone`, `admission_date`, `status`, `created_at`, `updated_at`; production add `consent_basis`, `guardian_contact` only if institution policy requires | Admissions/SIS | Text IDs, text PII, ISO date text, status enum | Current nullable: `roll_number`, `email`, `phone`; production nullable only if source confirms missing contact allowed | Before batch/term bootstrap; no risk or mentor workflow before active student exists | Unique `student_id`; unique `usn` per institution; valid institution FK; email/phone format if present; admission date not after first enrollment; status in controlled enum | Registrar/admissions office | Initial bulk, then daily delta during admissions and weekly correction window |
| Enrollments | `student_enrollments` | `enrollment_id`, `student_id`, `branch_id`, `term_id`, `section_code`, `roster_order`, `academic_status`, `start_date`, `end_date`, version timestamps | SIS/academic office | Text IDs, integer roster, ISO dates, status enum | Current nullable: `end_date`; production nullable until withdrawal/transfer/end event | Before term starts; required before attendance, marks, mentor queue, and HOD scope | Student/branch/term FK valid; one active enrollment per student per term unless explicit cross-enrollment policy; section code matches offering section; end date >= start date | Academic office/department coordinator | Term setup, plus daily/weekly changes during add-drop |
| Courses | `courses`, `curriculum_courses`, `curriculum_nodes` | `course_id`, `institution_id`, `course_code`, `title`, `credits`, `department_id`, `semester_number`, `status`, official code/title crosswalk | Curriculum office/department | Text IDs/codes, integer credits/semester, JSON for linkage metadata | `course_id` may be absent in curriculum staging rows but not production offering rows; official title/code nullable only during review | Before batch curriculum import and before offerings | Course code unique per curriculum scope; credits >= 0; department FK valid; official crosswalk reviewed or marked unresolved with blocker | Curriculum committee/department | Curriculum revision, usually annual/semester |
| Offerings | `section_offerings`, `faculty_offering_ownerships`, `teacher_allocations` | `offering_id`, `course_id`, `term_id`, `branch_id`, `section_code`, `year_label`, `student_count`, `stage`, `stage_label`, lock flags, ownerships | Timetable/department academic office | Text IDs, integer counts/stage/flags, status enum | Current nullable: `pending_action`; production nullable only for no pending workflow | Before class start; `stage` advances only when required evidence exists | Course/term/branch FK valid; section exists in enrollment; student count reconciles with active enrollment; stage mutation only via advance-stage flow; ownership required for course leader actions | Department coordinator/HOD | Term setup, changes during timetable add-drop |
| Faculty | `faculty_profiles`, `faculty_appointments`, `role_grants`, `user_accounts` | `faculty_id`, `user_id`, `employee_code`, `display_name`, `designation`, `department_id`, `branch_id`, role grants, appointment dates/status | HR/faculty office/IAM | Text IDs, ISO dates, boolean/integer flags, role enum | Current nullable: `joined_on`, `branch_id`, `end_date`, phone; production nullable only for institution-wide appointment or inactive end date | Before ownership, mentor assignment, timetable, and login role grants | Employee code unique; appointment FK valid; role grant scope valid; no expired role can act; inactive faculty cannot own active offering | HR plus system admin | Initial bulk, monthly HR sync, immediate delta on role changes |
| Mentor assignments | `mentor_assignments` | `assignment_id`, `student_id`, `faculty_id`, `effective_from`, `effective_to`, `source`, version timestamps | Department/HOD mentor list | Text IDs, ISO dates, source enum | Current nullable: `effective_to`; production nullable for active assignment | Before mentor dashboard and intervention queue for term | Student/faculty FK valid; active mentor has faculty appointment; no overlapping active mentor assignment unless multi-mentor policy exists; effective dates within term or documented exception | HOD/mentor coordinator | Term setup, immediate delta on reassignment |
| Timetable | `faculty_calendar_workspaces`, `faculty_calendar_admin_workspaces`, `academic_task_calendar_placements`, `academic_meetings` | Faculty weekly template, course sessions, room/slot, start/end, meeting/task placement, update audit | Timetable office/faculty calendar | JSON text, text IDs, ISO date, integer minutes | Current nullable: task `start_minutes`, `end_minutes`, `slot_id`, meeting `notes`; production nullable only for unscheduled/manual task | Before workload, teacher availability, intervention scheduling, and calendar proof | Start < end; slot inside campus hours; faculty not double-booked; offering/faculty ownership exists; admin override audited | Timetable office/faculty | Term setup, daily delta for changes |
| Attendance | `student_attendance_snapshots`, offering `attendance` aggregate | `student_id`, `offering_id`, `present_classes`, `total_classes`, `attendance_percent`, `source`, `captured_at` | Attendance app/LMS/manual faculty entry | Text IDs, integer counts/percent, ISO timestamp | Current schema: none nullable; production nullable not allowed after capture | Available only after attended classes; no future attendance before stage date | Student/offering FK valid; `total_classes >= 1` for commit; `0 <= present_classes <= total_classes`; percent recomputed; capture timestamp not future; class date belongs to timetable | Course leader/faculty | Daily or weekly, plus locked correction window |
| Marks | `student_assessment_scores`, `student_question_results` | `student_id`, `offering_id`, `term_id`, `component_type`, `component_code`, `score`, `max_score`, `evaluated_at`, optional per-question result | LMS/exam cell/faculty entry | Text IDs/enums, integer scores, ISO timestamp, JSON for question result | Current nullable: `term_id`, `component_code`; production nullable only when component has no sub-code | Stage-bound: TT1 only after TT1, TT2 after TT2, quizzes/assignments after configured component, SEE after final result | FK valid; `max_score >= 1`; `0 <= score <= max_score`; component exists in assessment scheme; evaluated date not after source export; locked component changes require audit and approval | Course leader/exam cell | Per assessment, plus correction window |
| Question papers | `offering_question_papers`, `simulation_question_templates` for synthetic proof | `paper_id`, `offering_id`, `kind`, `blueprint_json`, CO tags, topic tags, total marks, updated_by, version | Faculty/question paper repository/exam cell | Text IDs/enums, JSON text, integer marks | Current nullable: `updated_by_faculty_id`; production should require updater for manual changes | Before marks import for matching component; only current or past assessment paper may affect current stage | Offering FK valid; route `kind` matches paper kind; referenced CO IDs exist in resolved course outcome scope; total marks equals scheme; versioned changes audited | Course leader/exam cell | Per assessment/paper version |
| CO mappings | `course_outcome_overrides`, `curriculum_feature_profile_courses`, `student_co_states` for synthetic states | `course_id`, `scope_type`, `scope_id`, `outcomes_json`, Bloom level, topic linkage, status, version | Curriculum office/course leader | Text IDs, JSON text, enum status | Current schema: none nullable in override row; production nullable not allowed for active course | Before question paper and outcome attainment calculations | Course FK valid; scope valid; each CO has stable ID and description; no question paper can reference missing CO; override status active/reviewed | Curriculum committee/course leader | Curriculum revision, per course setup |
| Assessment weights | `offering_assessment_schemes`, `policy_overrides`, `stage_policy_overrides` | `offering_id`, `scheme_json`, `policy_snapshot_json`, configured_by, CE/SEE split, component counts/weights, status | Academic policy/HOD/course leader | JSON text, text IDs, integer weights | Current nullable: `configured_by_faculty_id`; production should require configured_by except inherited locked policy | Before marks entry/import and before stage eligibility | Scheme CE/SEE must match policy; quiz/assignment counts under cap; component weights equal totals; active term tests <= policy max; changes after marks require admin audit | HOD/course leader/system admin | Term setup, rare policy revision |
| SEE results | `transcript_subject_results`, `student_assessment_scores` with `sem_end`/`see` style components | `transcript_subject_result_id`, `transcript_term_result_id`, `course_code`, `title`, `credits`, `score`, `grade_label`, `grade_point`, `result` | Exam cell/university result system | Text IDs/codes, integer credits/score/grade point, enum result | Current schema: none nullable; production nullable not allowed after result publication | Post-SEE/term end only; must not affect earlier stages | Transcript term FK valid; course code reconciles to offering/course; score and grade point in policy range; result enum valid; import locked after appeal/correction window | Exam cell | Term end, plus official correction delta |
| Backlogs | `transcript_term_results`, `transcript_subject_results` | `student_id`, `term_id`, `backlog_count`, failed subject rows, result status | Exam cell/SIS transcript | Integer counts, text result enum | Current schema: none nullable; production nullable not allowed after transcript import | Post-result; prior backlog summary may be available at next semester start | `backlog_count >= 0`; count equals failed/uncleared subject rows under policy; old backlog clearances versioned; no negative earned credits | Exam cell/registrar | Term end and supplementary result updates |
| CGPA/SGPA | `transcript_term_results`, `student_academic_profiles.prev_cgpa_scaled`; production needs explicit cumulative CGPA history | `sgpa_scaled`, `cgpa_scaled`, `registered_credits`, `earned_credits`, previous term CGPA, transcript basis | SIS/transcript office | Integer scaled GPA/credits, text term IDs | Current gap: `cgpa_scaled` not first-class in `transcript_term_results`; production must add/import cumulative CGPA or derive with audited formula | Prior CGPA available before next term risk; current SGPA post-term | SGPA/CGPA range matches institutional scale; earned <= registered; cumulative formula and rounding documented; previous CGPA cannot be synthetic in production | Registrar/exam cell | Term end, plus official correction delta |
| Interventions | `student_interventions`, `student_intervention_response_states`, `academic_tasks`, `alert_decisions`, `reassessment_resolutions` | `intervention_id`, `student_id`, `faculty_id`, `offering_id`, `intervention_type`, note, occurred_at, action owner, response/outcome | Mentor/course leader/HOD/student support office | Text IDs, ISO timestamp, JSON response state | Current nullable: `faculty_id`, `offering_id`; production nullable only for institution-level non-course intervention with owner | After risk flag or manual teacher concern; future simulated intervention cannot be recorded as real | Student FK valid; owner in scope; intervention type controlled; note redacted for sensitive data; action/outcome audit immutable; escalation and closure statuses required | Mentor/course leader/HOD/student support | Event-driven, weekly review/export |

## Import Validation Gates

Production import must fail closed unless all applicable gates pass.

### Global gates

| Gate | Required rule | Current repo support | Production readiness |
|---|---|---|---|
| Schema version | Import payload declares approved `schema_version` and `source_system` | Partial: schema exists in DB, no full import manifest gate | Blocker until manifest-driven importer exists |
| Environment label | Payload declares `production`, `staging`, or `seed-demo`; seed data cannot write production | Partial: demo docs and `MSRUAS_PROOF_BATCH_ID` separate proof batches | Blocker until enforced at DB/API/import level |
| Source checksum | Raw file/API export checksum recorded | Partial: curriculum import has checksum fields | Extend to every real-data import |
| Dry-run diff | Import preview shows creates/updates/deletes/rejects before commit | Not generally present | Blocker for production |
| Approval | Production import requires named approver and audit event | Partial: admin audit exists | Must be required for all high-risk imports |
| Rollback snapshot | Previous state export or reversible migration exists | Partial: simulation reset snapshots only | Blocker for production data |

### Entity gates

| Entity gate | Rule |
|---|---|
| No duplicate student IDs | `student_id` primary key plus unique `usn` per institution; reject duplicates before DB write |
| Course codes valid | Imported course codes must map to approved curriculum/course rows; unresolved crosswalk blocks offering/marks import |
| Offering IDs valid | Attendance/marks/question papers/interventions must reference active offering for term and section |
| Faculty assignments valid | Faculty must have active appointment and scoped role/ownership before edits or imports |
| Marks within bounds | `0 <= score <= max_score`, `max_score >= 1`, component in assessment scheme |
| Attendance denominator > 0 | Commit/import requires `total_classes >= 1`; `present_classes <= total_classes`; percent recomputed |
| Assessment weights sum correctly | CE/SEE and component totals must exactly match policy; repo has `validateSchemeAgainstPolicy` for offering schemes |
| CO mappings complete | Question paper CO IDs must exist in resolved scope; repo has `validateQuestionPaperBlueprint` |
| Prerequisite graph valid | Curriculum graph must have reviewed edges, no impossible references, and unresolved mapping count must block production |
| No future evidence in early stage | Stage checkpoint/active date controls what TT/SEE/intervention evidence may be visible or scored |
| Transcript reconciliation | Term SGPA/backlogs/subject results must reconcile by student, term, credits, and course code |
| Timetable reconciliation | Offering, faculty ownership, calendar slot, and section enrollment must agree |
| Audit completeness | Import and every manual correction emits `audit_events` with actor, before/after, metadata, source import ID |

## Privacy, Security, And Compliance Gates

| Gate | Required production truth | Current repo truth | Gap/blocker |
|---|---|---|---|
| Data classification | Student PII, academic performance, attendance, intervention notes, model scores, audit logs classified by sensitivity | Not centrally documented | Blocker |
| Least privilege | `SYSTEM_ADMIN`, `HOD`, `COURSE_LEADER`, `MENTOR`, and any future `STUDENT` role mapped to exact read/write scopes | Role access exists in `academic-access.ts` and `requireRole` | Needs full production role matrix and negative-path proof |
| Role-scoped queries | Users can only read students/offerings in scope | Implemented for many academic paths | Needs full endpoint inventory proof before go-live |
| Admin action audit | All admin imports/edits/role changes are audited | `audit_events` and `emitAuditEvent` exist | Need immutable retention and export |
| Teacher edit audit | Attendance, marks, schemes, papers, interventions record actor, before/after, source | Partial via admin/academic routes | Need coverage matrix proving every edit path audits |
| TLS in transit | All production frontend/API/DB connections use TLS; cookies `Secure`; no HTTP mixed content | Config supports secure cookie posture; deploy contract documents HTTPS needs | Need live hosting proof for chosen production topology |
| Encryption at rest | DB backups, object storage, logs, and exports encrypted at rest by institution-approved host | Not proven in repo | Blocker |
| Secret management | No secrets in repo/docs/logs; production secrets in GitHub/Railway/institution secret store with rotation | Config supports env secrets; redaction docs exist | Need rotation/runbook and secret inventory |
| Session/CSRF | Production-like origin requires HTTPS API base, secure cookies, CSRF secret | Documented and tested in closeout annex | Must re-prove on final host |
| Retention | Explicit retention schedule for raw imports, audit logs, app logs, model artifacts, backups, student records | Missing | Blocker |
| Delete/export | Student/institution export and deletion/rectification process documented and technically supported | Missing | Blocker |
| Breach response | Incident commander, severity matrix, notification templates, containment, forensics, recovery, postmortem | Missing | Blocker |
| CERT-In readiness | 6-hour reporting clock, 180-day ICT log retention in Indian jurisdiction, PoC details, NTP sync, incident form fields, evidence package | Missing explicit product/institution runbook | Blocker |

### CERT-In India checklist

As of this audit, official CERT-In directions checked from CERT-In PDFs require readiness for:

- Reporting applicable cyber incidents to CERT-In within 6 hours of noticing or being brought to notice.
- Maintaining secure logs of ICT systems for a rolling 180 days in Indian jurisdiction and providing them to CERT-In when required.
- Synchronizing ICT system clocks to NIC/NPL or traceable time sources.
- Designating and updating a CERT-In Point of Contact.
- Preparing incident reports that include affected entity, incident type, affected system details, occurrence/detection time, description, actions taken, and log availability.
- Covering reportable classes including unauthorized access, data breach, data leak, attacks on cloud systems, and attacks or suspicious activities affecting AI/ML systems.

Parent institution/security/legal must verify the latest CERT-In directions and any sector-specific education/privacy obligations before production launch.

## Model Governance Gates

| Gate | Required production truth | Current repo truth | Gap/blocker |
|---|---|---|---|
| Training data version | Every model points to immutable training cohort/source/run IDs | `risk_model_artifacts.source_run_ids_json` exists for proof artifacts | Real college source versioning absent |
| Feature schema version | Every score records feature schema and feature extraction version | `feature_schema_version` exists in artifacts/evidence snapshots | Must freeze real-data feature schema |
| Model version | Active model artifact ID and family exposed to operator | `risk_model_artifacts` supports this | Need production promotion policy |
| Calibration version | Calibration method, cohort, semester/stage split, and date recorded | Synthetic calibration artifacts exist | Real-data calibration absent |
| Evaluation report | Historical holdout, temporal split, calibration, fairness, precision@capacity | Synthetic reports exist | Real-data validation absent |
| Known caveats | UI/docs state synthetic vs real validity boundary | Demo docs warn not production-ready | Must become in-product production disclaimer |
| Probability display guards | Risk probabilities must show uncertainty, calibration date, cohort scope, and not imply causal certainty | `riskProbScaled`/bands exist | Need real-data calibration and UX guard |
| Threshold policy | Intervention capacity thresholds approved by HOD/admin | Proof operational thresholds exist | Need real institutional policy |
| Override policy | Human override/appeal/correction audited | `risk_overrides`, `alert_decisions`, `reassessment_resolutions` exist | Need user-facing appeal/correction process |
| Human review | Model can prioritize, not autonomously penalize students | Queue/task design supports human review | Must be policy-bound before deployment |
| Intervention outcome audit | Track whether interventions help, harm, or create workload | Synthetic response states exist | Real intervention outcome tracking absent |

Production rule: synthetic proof-risk metrics cannot be used as real-world model evidence. A model becomes production-eligible only after real historical backtest, temporal validation, subgroup/fairness review, calibration review, and human-governance approval.

## Real-Data Validation Plan

Minimum validation before pilot:

1. Import one historical cohort with at least one full semester of attendance, internal marks, SEE results, SGPA/CGPA, and backlog outcomes.
2. Freeze feature schema and label definition before training/evaluation.
3. Use temporal split: train on older terms, validate on later terms, test on a holdout term.
4. Evaluate at semester and stage levels, not only whole-cohort aggregate.
5. Evaluate by course, section, gender/category only if legally and ethically approved, admission route if available, prior CGPA band, backlog status, and attendance band.
6. Report calibration curves by stage and semester.
7. Report precision@capacity for actual teacher workload, not arbitrary top-N.
8. Report false positive burden and false negative misses.
9. Compare model against simple baselines: prior CGPA, attendance threshold, TT1-only threshold, backlog history.
10. Run intervention outcome audit only after real interventions have consent/policy coverage.

Minimum pilot acceptance:

- No production label leakage from future marks/results into early stage scores.
- No unexplained high-risk concentration in a protected or administratively sensitive subgroup.
- HOD/course leader sign-off on thresholds and expected workload.
- Student-impact policy: model output cannot be sole basis for disciplinary action, grade decision, scholarship decision, or denial of opportunity.

## Deployment Topology Gates

| Topology area | Required production truth | Current state | Gap/blocker |
|---|---|---|---|
| Production DB | Institution-approved managed Postgres or equivalent with TLS, backups, PITR, encryption at rest | Local/demo and Railway-oriented contracts exist | Final host not selected/proven |
| Staging DB | Real-like masked/anonymized data only; no live student PII unless approved | Not fully defined | Blocker |
| Seed/demo DB | Synthetic data physically and logically isolated from production | Demo docs assert local seeded isolation | Enforce with env and DB guardrails |
| Frontend | HTTPS, production API base, browser compatibility matrix | GitHub Pages exists for demo; local backend was primary in demo docs | Need final production topology proof |
| Backend | HTTPS API, secure cookies, CSRF, allowed origin, health/readiness diagnostics | Config and tests support posture | Need live proof on chosen host |
| Secrets | Secret store, rotation, access review, no logs leakage | Env-based config exists | Need institution secret management runbook |
| Migrations | Forward/backward migration plan, backup before migration, rollback drill | Drizzle config exists | Need migration runbook and dry run |
| Rollback | App and DB rollback, seed/prod isolation preserved | Railway rollback noted in old report | Need tested rollback artifact |
| Health | `/health` plus DB, migration, queue, telemetry, dependency readiness | `/health` exists | Need deeper readiness endpoint or runbook |
| Monitoring | API errors, login failures, import failures, queue failures, latency, DB saturation | Operational telemetry table exists | Need external alerting dashboard |
| Browser compatibility | Chrome/Edge/Firefox/Safari current versions on desktop; mobile if required | Playwright tests exist | Need production browser matrix and screenshots |
| Load/performance | Pilot load test with expected users/import sizes and queue latency | Missing | Blocker |

## Admin And Teacher Edit Audit Requirements

Every production edit path must record:

- Actor user ID, role, faculty ID if relevant.
- Scope: institution/branch/batch/term/offering/student.
- Before and after payload, redacted where necessary.
- Source: import, manual correction, admin override, HOD approval, teacher edit.
- Reason/comment for high-risk changes: marks, attendance, role grant, mentor assignment, intervention, risk override.
- Timestamp from synchronized server time.
- Request metadata: IP/user agent if allowed by policy, correlation ID, import manifest ID.
- Approval chain for locked or post-publication changes.
- Exportable audit package for internal audit and incident response.

Current `audit_events` has core fields (`entity_type`, `entity_id`, `action`, `actor_role`, `actor_id`, `before_json`, `after_json`, `metadata_json`, `created_at`). Production needs immutable retention, full endpoint coverage proof, and export tooling.

## Blockers Before Real College Deployment

P0 blockers:

- No institution-approved real-data import manifest/gate across all field families.
- No production/staging/seed isolation enforcement beyond demo convention.
- No retention/delete/export policy or endpoints/runbooks.
- No breach response and CERT-In readiness runbook.
- No real-data model validation, fairness/subgroup review, or calibration evidence.
- No production load test, backup/restore drill, rollback drill, or monitoring alert proof.
- No explicit cumulative CGPA production contract in current transcript schema.
- No full edit-audit coverage matrix proving every admin/teacher mutation path emits immutable audit.

P1 blockers:

- Need finalized role least-privilege matrix for all routes and future student access.
- Need timetable source integration contract beyond faculty workspace JSON.
- Need import reconciliation reports for transcript, marks, attendance, and enrollments.
- Need browser compatibility evidence on final production topology.
- Need in-product caveats separating synthetic demo risk from real validated risk.

## Production Go-Live Checklist

Go-live is allowed only when all are true:

- Data contracts signed by source owners for all field families above.
- Dry-run import rejects bad data and produces row-level error reports.
- Production DB, staging DB, and seed/demo DB are physically/logically isolated.
- Real import writes are audited, reversible, approved, and environment-labelled.
- TLS, secure cookies, CSRF, allowed origins, secret rotation, and encryption-at-rest evidence are filed.
- CERT-In checklist is current, owner-assigned, and rehearsed.
- Backup/restore and rollback drills pass.
- Monitoring alerts reach named operators.
- Model card, validation report, calibration report, threshold policy, and human-review policy are approved.
- Browser matrix and load test pass on final deployment target.
- Parent institution accepts privacy, retention, delete/export, breach, and student-impact policies.

## Final Readiness Statement

AirMentor can proceed as a synthetic proof-control demo. It cannot proceed as a real college production deployment until the P0 blockers above are closed with evidence. The right next engineering step is not UI polish; it is a production import/control-plane layer that enforces source manifests, environment isolation, audited corrections, privacy/security policy, and real-data model validation.
