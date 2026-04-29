# Realism Readiness And Security Audit — 2026-04-29

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. Prose short. Technical strings exact.

## INTENT FIRST

Mission intent: create a defensible real-data and production-readiness gate, not a fake claim that production is complete.

Feature intent: AirMentor may be demo-ready only if remaining real deployment obligations are explicit: data contracts, import validation, privacy/security, model governance, real-data validation, and operations. CERT-In incident logging/reporting and audit trails must be treated as readiness gates for India deployment, not optional polish.

## WRITE LIMIT

Write only:
- `audit-map/32-reports/realism-readiness-security-2026-04-29.md`
- `audit-map/24-agent-memory/realism-readiness-security-2026-04-29.md`

Do not modify product code.

## READ FIRST

- `docs/demo/final-demo-readiness-2026-04-27.md`
- `docs/closeout/final-authoritative-plan-security-observability-annex.md`
- `docs/closeout/deploy-env-contract.md`
- `audit-map/22-evals/environment-readiness-checklist.md`
- `audit-map/32-reports/closure-readiness-verdict.md`
- `audit-map/32-reports/setup-readiness-report.md`
- `air-mentor-api/src/db/schema.ts`
- `air-mentor-api/src/modules/session.ts`
- `air-mentor-api/src/modules/admin-proof-sandbox.ts`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/config.ts`
- `.github/workflows/ci-verification.yml`
- `.github/workflows/deploy-railway-api.yml`

## REQUIRED READINESS CHECKLIST

Create schema/gate assessment for:

Data contract fields:
- students
- enrollments
- courses
- offerings
- faculty
- mentor assignments
- timetable
- attendance
- marks
- question papers
- CO mappings
- assessment weights
- SEE results
- backlogs
- CGPA/SGPA
- interventions

For each: source, type, nullable, stage availability, validation rule, owner, import frequency.

Import validation:
- no duplicate student IDs
- course codes valid
- offering IDs valid
- faculty assignments valid
- marks within bounds
- attendance denominator > 0
- assessment weights sum correctly
- CO mappings complete
- prerequisite graph valid
- no future evidence in early stage

Privacy/security:
- role-based access control
- least privilege
- audit logs
- encryption at rest if hosted
- TLS in transit
- secret management
- data retention policy
- delete/export policy
- breach response plan
- admin action audit
- teacher edit audit
- CERT-In incident logging/reporting readiness

Model governance:
- training data version
- feature schema version
- model version
- calibration version
- evaluation report
- known caveats
- probability display guards
- threshold policy
- override policy
- human review policy
- appeal/correction process

Real-data validation:
- historical backtest
- temporal split
- semester-level validation
- course-level validation
- subgroup/fairness checks
- calibration by semester/stage
- precision@capacity
- false positive burden
- teacher workload simulation
- intervention outcome audit

Operational readiness:
- backup/restore
- monitoring
- health checks
- error tracking
- deployment rollback
- database migration plan
- seed/demo isolation
- production/staging separation
- load test
- browser compatibility

## REPORT FORMAT

Create `audit-map/32-reports/realism-readiness-security-2026-04-29.md` with sections:

# Readiness And Security Audit — 2026-04-29
## Intent And Feature Intent
## Method
## Real Data Contract
## Import Validation Gates
## Privacy Security And Audit Gates
## Model Governance Gates
## Real Data Validation Gates
## Operational Readiness Gates
## Blockers
## Demo-Safe Caveats
## Verdict

Also create `audit-map/24-agent-memory/realism-readiness-security-2026-04-29.md` with concise handoff.
