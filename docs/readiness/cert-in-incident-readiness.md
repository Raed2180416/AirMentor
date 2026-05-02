# CERT-In Incident Readiness

## Status

AirMentor is **not production-ready** for a real-college deployment until the parent institution, security owner, and legal/compliance owner assign and rehearse an incident-response process.

This document is an engineering readiness checklist. It is **not legal advice**. The parent institution/security/legal team must verify current CERT-In directions and any education-sector or privacy obligations before launch.

## Scope

This checklist covers cyber-incident logging, reporting, evidence preservation, operational owner assignment, and AirMentor evidence anchors. It does not by itself create the missing operational process or prove readiness.

## CERT-In Readiness Items To Verify

Based on the project readiness report, the production process must cover:

- **Six-hour reporting clock:** Report applicable cyber incidents to CERT-In within six hours of noticing or being brought to notice.
- **Log retention:** Maintain secure ICT logs for a rolling 180 days in Indian jurisdiction and make them available when required.
- **Clock synchronization:** Synchronize system clocks to NIC/NPL or another approved traceable time source.
- **Point of Contact:** Maintain an institution-approved CERT-In Point of Contact and keep it current.
- **Report fields:** Capture affected entity, incident type, affected systems, occurrence time, detection time, description, actions taken, and log availability.
- **Incident classes:** Cover unauthorized access, data breach, data leak, cloud-system attacks, and suspicious activity affecting AI/ML systems.

## Current AirMentor Evidence Anchors

- **Session events:** `air-mentor-api/src/modules/session.ts` emits login success/failure, rate-limit, restore, logout, and role-context switch events.
- **Origin and CSRF enforcement:** `air-mentor-api/src/app.ts` rejects non-allowlisted mutating origins and missing or mismatched CSRF headers for authenticated writes.
- **Telemetry normalization:** `air-mentor-api/src/lib/telemetry.ts` and `src/telemetry.ts` sanitize operational event payloads and treat sink failures as secondary warnings.
- **Client telemetry relay:** `air-mentor-api/src/modules/client-telemetry.ts` validates client telemetry and persists accepted events.
- **Startup diagnostics:** `air-mentor-api/src/startup-diagnostics.ts` and `src/startup-diagnostics.ts` provide production-like posture checks.
- **Deploy contract:** `docs/closeout/deploy-env-contract.md` records live target and credential redaction rules.
- **Security annex:** `docs/closeout/final-authoritative-plan-security-observability-annex.md` records auth, session, CSRF, role-boundary, observability, and redaction expectations.

## Required Incident Packet

For every reportable incident, the exportable packet must include:

- **Incident ID:** Stable AirMentor incident record identifier.
- **Severity:** Institution-defined severity level and reportability decision.
- **Reporter:** Person or system that detected the event.
- **Incident commander:** Named owner for coordination.
- **Timeline:** Occurrence time if known, detection time, triage time, containment time, recovery time, and reporting time.
- **Affected scope:** Institution, branch, batch, term, student/faculty records, systems, and data classes.
- **Technical evidence:** Relevant operational events, audit events, app logs, DB logs, deployment logs, and monitoring alerts.
- **Access evidence:** Sessions, role grants, CSRF/origin results, IP/user-agent data where institution policy allows retention.
- **Data exposure assessment:** Whether student PII, academic performance, attendance, interventions, model scores, audit logs, imports, backups, or secrets were affected.
- **Containment actions:** Disabled sessions, rotated credentials, blocked origin, reverted deploy, isolated database, or stopped import/recompute worker.
- **Notifications:** CERT-In, institution leadership, affected departments, and affected individuals where required by policy.
- **Postmortem:** Root cause, corrective actions, owner, due date, and verification evidence.

## Production Blockers

- **Owner roster missing:** No committed incident commander, deputy, security contact, legal contact, and CERT-In Point of Contact.
- **Severity matrix missing:** No institution-approved reportability/severity decision tree.
- **Evidence retention location missing:** No approved storage for 180-day logs, incident packets, and audit exports.
- **Notification templates missing:** No approved internal, CERT-In, and affected-person communication templates.
- **Rehearsal missing:** No tabletop or live drill artifact proving six-hour reporting readiness.
- **NTP/clock proof missing:** No production host evidence for synchronized clock configuration.
- **Immutable log/export proof missing:** Telemetry and audit primitives exist, but production retention/export immutability is not proven.

## Go-Live Gate

A real-college production launch is blocked until all items below are evidenced:

- **Assigned owners:** Incident commander, security owner, legal/compliance owner, operator on call, and CERT-In Point of Contact.
- **Approved runbook:** Severity matrix, notification templates, containment procedures, evidence packet format, and postmortem template.
- **Retention proof:** 180-day ICT log retention in approved jurisdiction with access controls and export procedure.
- **Clock proof:** Production API, DB, logging, and deployment hosts synchronized to approved time sources.
- **Drill proof:** Rehearsed reportable-incident scenario with timestamps showing the six-hour reporting path is achievable.
- **AirMentor export proof:** Ability to export relevant audit, telemetry, session, and deployment evidence without secrets leakage.

## Current Verdict

AirMentor has useful security and telemetry primitives for demo and engineering diagnostics. It is **not CERT-In production-ready** until the missing owners, retention, export, reporting, and rehearsal gates close with institution-approved evidence.
