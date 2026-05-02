# Production Readiness Document Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a production-readiness governance document package that separates synthetic demo proof from real-college deployment approval.

**Architecture:** This is documentation-only Stage B packaging. The documents live under `docs/readiness/` and reference existing repo anchors, tests, and reports without changing product behavior. Each file owns one governance gate family: incident readiness, retention/export, model governance, or load/rollback planning.

**Tech Stack:** Markdown, existing TypeScript/Fastify/Vitest/Playwright evidence anchors, AirMentor closeout/audit-map documentation.

---

## File Structure

- Create: `docs/readiness/cert-in-incident-readiness.md`
  - Records CERT-In-aligned incident response readiness fields, current evidence anchors, missing production owner approvals, and non-legal engineering boundaries.
- Create: `docs/readiness/data-retention-delete-export-policy.md`
  - Records data classes, retention/export/delete requirements, current repo support, missing endpoints/runbooks, and go-live gates.
- Create: `docs/readiness/model-governance-card.md`
  - Records synthetic model claim boundaries, required real-data validation, calibration/fairness/threshold gates, and human-review policy.
- Create: `docs/readiness/load-test-plan.md`
  - Records local and production load-test plan, backup/restore/rollback evidence needs, monitoring signals, and pass/fail criteria.
- No product code changes are allowed in this package.

## Task 1: CERT-In Incident Readiness

**Files:**
- Create: `docs/readiness/cert-in-incident-readiness.md`

- [ ] **Step 1: Create the document**

Content must include:
- Status: not production-ready until institution/security/legal assign owners and rehearse the runbook.
- Official readiness items checked from existing readiness doc: 6-hour reporting, 180-day ICT logs in Indian jurisdiction, clock sync, Point of Contact, report fields, reportable incident classes.
- Current repo anchors: session events, CSRF/origin gates, telemetry, startup diagnostics, deploy env contract.
- Missing gates: owner roster, evidence retention location, incident severity matrix, notification templates, rehearsal artifact.

- [ ] **Step 2: Verify wording avoids legal overclaim**

Run:

```bash
grep -n "production ready\|legal advice\|Parent institution" docs/readiness/cert-in-incident-readiness.md
```

Expected:
- Document says not production-ready.
- Document says this is not legal advice.
- Document assigns final verification to parent institution/security/legal.

## Task 2: Retention, Delete, Export Policy

**Files:**
- Create: `docs/readiness/data-retention-delete-export-policy.md`

- [ ] **Step 1: Create the document**

Content must include:
- Status: policy package only; endpoints/export tooling are missing.
- Data classes: student PII, academic records, attendance/marks, interventions, audit events, telemetry, model artifacts, raw imports, backups.
- Current repo anchors: `audit_events`, telemetry docs, schema support, readiness doc.
- Required controls: retention schedule, student/institution export, rectification/delete workflow, immutable audit, redaction, approval chain.

- [ ] **Step 2: Verify blockers remain explicit**

Run:

```bash
grep -n "Blocker\|Missing\|not production-ready" docs/readiness/data-retention-delete-export-policy.md
```

Expected: output lists implementation blockers and missing endpoint/tooling work.

## Task 3: Model Governance Card

**Files:**
- Create: `docs/readiness/model-governance-card.md`

- [ ] **Step 1: Create the document**

Content must include:
- Status: synthetic proof model only, not real-data deployment approval.
- Current evidence: six-semester proof-plane audit, Flow10 HoD counterfactual browser proof, backend ML helper tests.
- Required real-data gates: immutable training data version, feature schema freeze, temporal validation, calibration report, subgroup/fairness review, threshold/workload approval, intervention outcome audit, human-review rule.
- Disallowed claim: model output cannot be sole basis for grade, discipline, scholarship, or opportunity denial.

- [ ] **Step 2: Verify synthetic/production boundary**

Run:

```bash
grep -n "synthetic\|real-data\|sole basis" docs/readiness/model-governance-card.md
```

Expected: output includes synthetic-only boundary, real-data gates, and human-impact guardrail.

## Task 4: Load Test And Operational Drill Plan

**Files:**
- Create: `docs/readiness/load-test-plan.md`

- [ ] **Step 1: Create the document**

Content must include:
- Status: plan only; no load/rollback/restore proof is produced by the document.
- Scope: health/readiness, login/session, proof dashboard, HoD analytics, import dry-run, queue/recompute, telemetry.
- Environments: local synthetic, staging masked/anonymized, production pilot.
- Required drills: backup/restore, rollback, migration dry-run, alert delivery, browser matrix.
- Pass/fail criteria and artifacts.

- [ ] **Step 2: Verify no false evidence claim**

Run:

```bash
grep -n "plan only\|not evidence\|Pass criteria\|Fail criteria" docs/readiness/load-test-plan.md
```

Expected: document says it is a plan and names pass/fail criteria.

## Task 5: Package Validation

**Files:**
- Read: `docs/readiness/*.md`
- Read: `docs/real-data-production-readiness-2026-04-30.md`
- Read: `audit-map/32-reports/proof-readiness-closeout-2026-04-30.md`

- [ ] **Step 1: List created files**

Run:

```bash
find docs/readiness -maxdepth 1 -type f -print | sort
```

Expected:

```text
docs/readiness/cert-in-incident-readiness.md
docs/readiness/data-retention-delete-export-policy.md
docs/readiness/load-test-plan.md
docs/readiness/model-governance-card.md
```

- [ ] **Step 2: Check no product-code diff was introduced by this package**

Run:

```bash
git diff --name-only -- docs/readiness docs/superpowers/plans/2026-04-30-production-readiness-document-package.md
```

Expected: only the new plan and readiness markdown files appear.

## Self-Review

- Scope is documentation-only.
- Production readiness is not claimed.
- Each new document has an explicit owner family and missing implementation gates.
- No product code files are part of this plan.
