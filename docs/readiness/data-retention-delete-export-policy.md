# Data Retention, Delete, And Export Policy

## Status

This is a policy and implementation-gap document. AirMentor is **not production-ready** for real student data until retention schedules, export tooling, rectification/delete workflows, immutable audit retention, and institution approvals are implemented and verified.

## Scope

This document covers production handling of real student/faculty data, academic records, operational logs, model artifacts, imports, exports, and backups. It does not alter product behavior or create the missing endpoints.

## Data Classes

| Data class | Examples | Sensitivity | Current repo anchor | Production requirement |
|---|---|---|---|---|
| Student PII | name, email, phone, roll number, USN | High | `students`, `user_accounts` | Classified, access-scoped, exportable, rectifiable, retained by institution policy |
| Faculty PII | name, employee code, contact, role grants | High | `faculty_profiles`, `role_grants` | HR-owned source, scoped access, role-change audit |
| Academic records | enrollments, courses, offerings, transcripts, SGPA/backlogs | High | schema tables and proof services | Source-owned imports, reconciliation, correction workflow |
| Attendance and marks | attendance snapshots, assessment scores, question results | High | `student_attendance_snapshots`, `student_assessment_scores` | Stage-bound availability, correction approval, before/after audit |
| Interventions | mentor/HOD/course-leader actions, notes, outcomes | High | `student_interventions`, `academic_tasks` | Sensitive-note redaction, owner scoping, closure audit |
| Risk/model outputs | risk bands, probabilities, recommendations, model artifacts | High | proof/risk artifact tables and reports | Model card, calibration version, human-review guardrails |
| Audit events | actor, action, before/after, metadata | High | `audit_events`, `emitAuditEvent` | Immutable retention, export package, tamper monitoring |
| Operational telemetry | auth, startup, proof queue, client telemetry | Medium/High | telemetry modules and security annex | 180-day operational log retention for production systems where required |
| Raw imports | SIS/LMS/exam/HR/timetable files or API payloads | High | partial curriculum import support | Checksums, dry-run diff, approval, rollback snapshot, retention schedule |
| Backups | database backups, exports, deployment artifacts | High | deploy contract references | Encryption at rest, restore drill, retention/deletion schedule |

## Current Repo Support

- **Audit schema:** `audit_events` stores entity type, entity ID, action, actor role, actor ID, before JSON, after JSON, metadata JSON, and timestamp.
- **Telemetry primitives:** backend and client telemetry normalize operational events and redact unsafe runtime objects.
- **Access control:** academic access decisions and `requireRole` provide scoped role enforcement for many routes.
- **Stage evidence rules:** proof-plane audit verifies future assessment fields are hidden across six semesters and five stages.
- **Readiness source:** `docs/real-data-production-readiness-2026-04-30.md` identifies retention/delete/export as a P0 blocker.

## Required Retention Schedule

The institution must approve exact durations. A production schedule must define at least:

| Record family | Minimum decision needed | Required evidence |
|---|---|---|
| Student profile and enrollment | Retain while enrolled plus institution-approved archival period | Approved policy and export/delete exception rules |
| Attendance and marks | Retain according to academic/exam rules and appeal windows | Source owner sign-off and correction audit process |
| Transcripts and backlog history | Retain according to registrar/exam-cell policy | Registrar approval and reconciliation report |
| Interventions and notes | Retain only as long as policy permits for student-support purpose | Redaction rules and access-review evidence |
| Audit events | Retain immutably for institutional audit and incident response | Tamper-resistant storage and export proof |
| Operational logs | Retain per CERT-In/institution requirement, including 180-day ICT logs where applicable | Storage location, access control, and retrieval proof |
| Raw imports | Retain long enough for replay/reconciliation, then archive/delete by policy | Checksum, manifest, and deletion proof |
| Model artifacts | Retain active and historical artifacts tied to decisions | Model card, source cohort IDs, calibration report |
| Backups | Retain encrypted backups by recovery objective and legal policy | Backup inventory and restore-drill artifact |

## Delete, Rectification, And Export Requirements

Production must provide controlled workflows for:

- **Institution export:** Complete scoped export of students, enrollments, courses, attendance, marks, interventions, risk outputs, audit events, and import manifests.
- **Student export:** Student-specific export where policy permits, with sensitive internal audit or third-party data redacted as required.
- **Rectification:** Correct wrong PII, attendance, marks, role grants, mentor assignment, or transcript mapping with before/after audit and source owner approval.
- **Delete/restrict:** Delete, anonymize, or restrict records only when allowed by academic retention law/policy and without breaking mandatory audit trails.
- **Appeal/correction chain:** Marks, attendance, interventions, and risk-affecting corrections require reason, actor, approval chain, and immutable audit.
- **Redaction:** Exports must strip passwords, session cookies, CSRF tokens, bearer tokens, provider secrets, and unnecessary prompt/runtime payloads.

## Missing Implementation Gates

- **Missing export endpoints/tooling:** No proven student/institution export command or API package exists for production.
- **Missing deletion workflow:** No proven delete/anonymize/restrict process exists for real student data.
- **Missing retention scheduler:** No implemented lifecycle job proves retention periods are enforced.
- **Missing immutable storage proof:** `audit_events` exists, but tamper-resistant retention/export is not proven.
- **Missing raw import manifest across all field families:** Curriculum has partial checksum support, but all real-data imports need manifests, dry-run diffs, approvals, and rollback snapshots.
- **Missing access-review process:** Role-scoped code exists, but production access reviews and export authorization are not documented as a runbook.
- **Missing backup deletion/restore governance:** Backup retention, encryption-at-rest evidence, and deletion after retention are not proven.

## Go-Live Gate

Before production with real college data, the project must produce:

- **Approved retention schedule:** Signed by institution owner for every data class above.
- **Export proof:** A redacted sample institution export and student export generated from a staging dataset.
- **Rectification proof:** A correction workflow for at least PII, attendance, marks, and role grants with immutable before/after audit.
- **Delete/restrict proof:** A policy-compliant deletion/anonymization/restriction procedure tested on staging data.
- **Audit immutability proof:** Audit events and operational logs preserved in approved storage with retrieval test.
- **Backup governance proof:** Encrypted backup inventory, restore drill, retention expiry, and deletion proof.

## Current Verdict

AirMentor has schema and audit primitives, but production retention, delete, and export readiness is **blocked** until policy, endpoints/tooling, immutable retention, and rehearsal artifacts exist.
