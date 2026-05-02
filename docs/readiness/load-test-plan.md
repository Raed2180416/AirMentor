# Load Test And Operational Drill Plan

## Status

This document is a **plan only**. It is not evidence that AirMentor has passed production load, backup/restore, rollback, or monitoring drills.

AirMentor remains **not production-ready** until this plan is executed on an approved final or staging topology and artifacts are filed.

## Scope

The plan covers synthetic local load checks, staging masked-data rehearsal, production-pilot readiness, backup/restore, rollback, migration dry-run, monitoring alerts, and browser compatibility evidence.

## Systems Under Test

- **Frontend:** Vite/React production build or final deployed frontend.
- **Backend API:** Fastify AirMentor API.
- **Database:** production-equivalent Postgres or institution-approved database.
- **Proof workloads:** proof dashboard, HoD proof analytics, proof-students endpoint, recompute-risk, queue processing, and counterfactual simulator.
- **Auth workloads:** login, session restore, role switching, logout, CSRF-protected writes.
- **Import workloads:** future production import dry-run and commit paths once implemented.
- **Telemetry:** auth events, startup diagnostics, client telemetry relay, proof queue events, alert delivery.

## Environment Levels

| Level | Purpose | Data | Current readiness |
|---|---|---|---|
| Local synthetic | Developer/demo confidence and regression checks | Seeded synthetic proof data | Existing targeted evidence available |
| Staging masked/anonymized | Production-like rehearsal without live PII exposure | Masked or synthetic-realistic data | Not fully defined |
| Production pilot | Final go-live proof under institution controls | Approved real data only | Not approved |

## Workload Scenarios

### Scenario 1: Health And Startup Readiness

- **Flow:** start backend, run migrations, call `/health`, verify startup diagnostics, verify frontend API base configuration.
- **Signals:** startup warnings, readiness failures, DB connectivity, migration status, allowed origin, secure cookie posture.
- **Pass criteria:** no production-like startup gate failure; health and readiness checks pass within agreed SLO.
- **Fail criteria:** missing allowed origin, insecure cookie posture, missing CSRF secret, DB warning treated as blocker, or health endpoint unstable.

### Scenario 2: Auth And Session Load

- **Flow:** concurrent logins, role switches, session restores, logout, invalid CSRF writes, forbidden-origin writes.
- **Signals:** login latency, rate-limit behavior, session restore latency, CSRF rejection rate, forbidden-origin telemetry.
- **Pass criteria:** legitimate sessions succeed within SLO; invalid writes are rejected; no secret/cookie leakage in logs.
- **Fail criteria:** session confusion, cross-role leakage, accepted invalid CSRF, accepted forbidden origin, or raw credentials in logs.

### Scenario 3: Proof Dashboard And HoD Analytics

- **Flow:** system admin dashboard reads, HoD proof analytics reads, proof-students pagination, risk explorer, counterfactual simulator.
- **Signals:** API latency, frontend console errors, DB query latency, memory/CPU, risk count consistency.
- **Pass criteria:** dashboard and HoD surfaces remain usable at pilot concurrency; proof counts remain consistent with the active run.
- **Fail criteria:** timeout, stale run status, incorrect risk totals, future evidence leakage, page errors, or visible synthetic/production claim confusion.

### Scenario 4: Recompute And Queue Worker

- **Flow:** queue proof recompute jobs, claim jobs, execute recompute, read proof dashboard, archive/reset if allowed in environment.
- **Signals:** queue depth, job duration, failure count, requeue count, DB write pressure, telemetry events.
- **Pass criteria:** recompute completes within agreed window; failed jobs emit actionable diagnostics; dashboard remains consistent after recompute.
- **Fail criteria:** stuck claimed job, silent failure, missing proof checkpoints, corrupted active run, or queue backlog beyond SLO.

### Scenario 5: Import Dry-Run And Commit

This scenario becomes executable only after the production import/control-plane exists.

- **Flow:** submit import manifest, dry-run diff, row-level validation, approval, commit, rollback snapshot, reconciliation report.
- **Signals:** row error count, accepted/rejected count, checksum, audit events, rollback snapshot, source owner approval.
- **Pass criteria:** bad rows fail closed; approved good rows commit with audit and rollback evidence.
- **Fail criteria:** silent overwrite, missing checksum, missing approval, no row-level errors, no rollback snapshot, or seed data writing production.

## Load Profiles

| Profile | Purpose | Example shape | Required before go-live |
|---|---|---|---|
| Smoke | Ensure route chain works | 1 admin, 1 HOD, 1 course leader, 1 mentor | Yes |
| Pilot | Expected small college pilot | Named by institution: concurrent admins/HODs/faculty and proof jobs | Yes |
| Burst | Timetable/exam-result import or post-SEE review burst | Higher read concurrency plus one import/recompute wave | Yes |
| Failure drill | Confirm alerts and recovery | induced API error, failed proof job, rejected import | Yes |

Exact production numbers must be approved by the institution before execution.

## Backup, Restore, Migration, And Rollback Drills

### Backup Drill

- **Required artifact:** backup ID, timestamp, DB size, encryption-at-rest proof, storage location, retention expiry.
- **Pass criteria:** backup exists, is encrypted, is access-controlled, and is listed in the backup inventory.
- **Fail criteria:** no backup, unclear retention, no encryption proof, or no owner.

### Restore Drill

- **Required artifact:** restore target, restore time, verification queries, data integrity checks, application smoke result.
- **Pass criteria:** restore completes within approved RTO/RPO and proof dashboard/session smoke works on restored target.
- **Fail criteria:** restore fails, data inconsistent, credentials leaked, or application cannot start.

### Migration Dry-Run

- **Required artifact:** migration SHA, pre-migration backup, migration logs, rollback decision point, post-migration checks.
- **Pass criteria:** migration applies cleanly to staging copy and checks pass.
- **Fail criteria:** destructive migration without backup, unbounded lock time, failed checks, or no rollback decision point.

### Rollback Drill

- **Required artifact:** app version before/after, DB rollback strategy, restored service health, smoke result.
- **Pass criteria:** rollback restores previous working version and preserves audit/history consistency.
- **Fail criteria:** rollback loses records, breaks sessions, crosses seed/production data, or lacks owner approval.

## Monitoring And Alerting Requirements

Production monitoring must alert named operators on:

- **API health:** health/readiness failure, elevated 5xx, high latency.
- **Auth/security:** login failure spikes, rate-limit spikes, forbidden-origin attempts, CSRF rejection anomalies.
- **Proof jobs:** queued job age, claimed job timeout, recompute failures, missing checkpoints.
- **Imports:** dry-run failures, commit failures, high rejected-row count, missing approval.
- **Database:** connection exhaustion, slow queries, disk pressure, backup failure.
- **Telemetry:** sink failure, event persistence failure, abnormal client error spikes.

## Browser Compatibility Matrix

Before production, capture evidence for:

- **Desktop Chrome or Chromium:** latest stable.
- **Desktop Edge:** latest stable if institution standard.
- **Desktop Firefox:** latest stable.
- **Safari:** latest supported version if macOS/iPad users are in scope.
- **Mobile/tablet:** only if institution requires mobile use for faculty or students.

Each browser artifact must include login, proof dashboard or role home, HoD analytics if role permits, a CSRF-protected write where safe, no console errors, and screenshots or videos where required.

## Required Artifacts

- **Load run manifest:** environment, app SHA, API SHA, DB snapshot ID, data classification, test profile, operator.
- **Command log:** exact command with secrets redacted.
- **Metrics bundle:** latency, error rate, throughput, queue duration, DB stats, CPU/memory, browser failures.
- **Security log sample:** auth, CSRF, forbidden-origin, startup diagnostics.
- **Proof consistency report:** checkpoint count, risk totals, future-evidence leakage check.
- **Backup/restore report:** backup ID, restore target, RTO/RPO, verification queries.
- **Rollback report:** rollback trigger, steps, duration, post-rollback smoke.
- **Alert proof:** named operator receives and acknowledges test alerts.

## Final Production Pass Criteria

Production load and drill readiness can be claimed only when:

- **Pilot profile passes:** agreed user/job/import load passes without SLO breach.
- **Burst profile passes:** post-SEE or import burst does not corrupt proof state or block core reads beyond SLO.
- **Security negative paths pass:** invalid CSRF, forbidden origin, and unauthorized role access fail closed under load.
- **Backup/restore passes:** restore completes inside approved RTO/RPO and app smoke succeeds.
- **Rollback passes:** app rollback and DB strategy are rehearsed without data loss.
- **Alerts pass:** named operators receive critical alerts and can retrieve evidence.
- **Browser matrix passes:** agreed browsers run core workflows with no console/page errors.

## Current Verdict

This plan defines the evidence needed for operational readiness. It is **not evidence** that AirMentor has passed production load, restore, rollback, monitoring, or browser-matrix gates.
