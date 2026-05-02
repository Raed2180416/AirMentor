# Realism Readiness Security Report - 2026-04-30

## Finding

Status: **not real-college production ready**.

Reason: current repo supports synthetic proof/demo and some security/audit primitives, but lacks real-data import gates, retention/delete/export policy, CERT-In runbook, real-data model validation, environment isolation enforcement, load/rollback/restore proof, and full edit-audit coverage.

## What Was Written

- Long readiness doc: `docs/real-data-production-readiness-2026-04-30.md`
- This concise report: `audit-map/32-reports/realism-readiness-security-2026-04-30.md`

## Evidence Used

- `air-mentor-api/src/db/schema.ts`: current production-relevant tables for students, enrollments, courses, offerings, faculty, mentor assignments, attendance, marks, question papers, CO mappings, assessment weights, transcripts, interventions, audit events, model artifacts, telemetry.
- `air-mentor-api/src/modules/academic.ts`: Zod input validation, stage gating helpers, assessment scheme validation, question paper CO validation.
- `air-mentor-api/src/modules/academic-access.ts`: scoped academic access decisions for HOD/course leader/mentor/system admin.
- `air-mentor-api/src/modules/support.ts`: `requireRole` and `emitAuditEvent`.
- `docs/demo/final-demo-readiness-2026-04-27.md`: demo caveats explicitly say local backend and synthetic baseline, not production.
- `docs/closeout/final-authoritative-plan-security-observability-annex.md`: session, CSRF, telemetry, redaction contracts.
- `docs/closeout/deploy-env-contract.md`: GitHub Pages/Railway deployment posture and live verification expectations.
- CERT-In official PDFs: 28 Apr 2022 directions, FAQ, incident reporting form.

## P0 Blockers

- Real-data import manifest/gate missing across all field families.
- Production/staging/seed isolation not hard-enforced.
- Retention/delete/export policy and user/institution data export path missing.
- Breach response and CERT-In operational runbook missing.
- Real-data model validation, calibration, fairness/subgroup review missing.
- Production load test, backup/restore drill, rollback drill, monitoring alert proof missing.
- Cumulative CGPA production contract incomplete: current schema has `sgpa_scaled` and `prev_cgpa_scaled`, not full audited CGPA history.
- Admin/teacher edit audit is partially implemented but not proven for every mutation path with immutable retention/export.

## P1 Risks

- Role least-privilege matrix needs route-by-route proof.
- Timetable source integration is still workspace JSON, not institution-grade source contract.
- Attendance/marks/transcript imports need reconciliation reports and correction workflows.
- Browser compatibility must be proven on final production topology, not only local/demo.
- Product copy must keep synthetic-risk claims separate from validated real-world claims.

## CERT-In Readiness Note

Official CERT-In material checked today requires readiness for 6-hour incident reporting, 180-day ICT log retention in Indian jurisdiction, NTP clock sync, Point of Contact maintenance, and reportable incident classes including data breach/leak, unauthorized access, cloud attacks, and AI/ML-related suspicious activity. Parent institution/security/legal must re-verify current official directions before launch.

## Deployment Topology Verdict

Demo topology remains acceptable for proof: local seeded backend plus frontend surface.

Production topology remains unapproved: final host, DB encryption/backup/PITR, staging data policy, seed isolation guardrails, monitoring, rollback, and load envelope are not evidenced.

## Next Engineering Order

1. Build import manifest/control-plane with schema version, source checksum, environment label, dry-run diff, row errors, approval, audit event, and rollback snapshot.
2. Enforce production/staging/seed isolation in config and DB write paths.
3. Add retention/delete/export and breach/CERT-In runbooks plus exportable audit package.
4. Run real historical validation with temporal split, calibration, subgroup review, baseline comparison, and threshold/workload approval.
5. Prove final deployment with health/readiness, monitoring, backup/restore, rollback, load, and browser matrix.

## Final

AirMentor can be shown as synthetic proof-control demo. It must not be sold or deployed as real-data college production until P0 gates close with evidence.
