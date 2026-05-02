# Demo-Perfect And Production-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AirMentor defensible for a synthetic demo first, then close the documented production-readiness evidence gaps without overstating claims.

**Architecture:** Stage A fixes/proves demo-critical behavior using root-cause tracing, TDD, and browser proof. Stage B packages production-readiness as explicit artifacts and, only where needed, narrow endpoints/tests. Demo proof and production claims stay separate.

**Tech Stack:** TypeScript, Vitest, Fastify inject tests, Playwright smoke scripts, Markdown audit/handoff docs.

---

## File Structure

- Modify only if root cause is proven: `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts` for playback gate semantics.
- Modify only if root cause is proven: `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` or adjacent proof runtime service for academic edit consumption.
- Add/modify tests: `air-mentor-api/tests/academic-parity.test.ts`, `air-mentor-api/tests/proof-control-plane-checkpoint-service.test.ts`, or a focused proof runtime test if existing patterns fit better.
- Update evidence docs: `audit-map/32-reports/realism-proof-plane-2026-04-29.md`, `audit-map/32-reports/realism-teacher-hod-2026-04-29.md`, `audit-map/32-reports/realism-verdict-2026-04-29.md`, and handoffs under `audit-map/24-agent-memory/`.
- Add production-readiness docs if Stage B is reached: `docs/readiness/cert-in-incident-readiness.md`, `docs/readiness/data-retention-delete-export-policy.md`, `docs/readiness/model-governance-card.md`, `docs/readiness/load-test-plan.md`.

## Task 1: Sem6 Playback Queue Root Cause

- [ ] Read checkpoint gate implementation and existing tests around `withProofPlaybackGate`.
- [ ] Reproduce the Sem6 blocker using API/dashboard data and capture the exact blocking checkpoint, queue counts, and reason.
- [ ] Decide whether it is correct governance or stale/unresolved state.
- [ ] If behavior is wrong, write a failing test that proves the desired playback/readiness semantics.
- [ ] Implement only the minimal root-cause fix.
- [ ] Run focused tests and browser smoke for Sem6.

## Task 2: Teacher Edit Proof-Projection Bridge

- [ ] Trace data flow from `PUT /api/academic/offerings/:offeringId/attendance` to stored attendance snapshots.
- [ ] Trace recompute inputs for proof projections and determine whether attendance snapshots are intentionally consumed.
- [ ] Write a failing test only if product intent is that teacher edits must affect recomputed proof projections.
- [ ] Implement minimal bridge if test proves missing intended behavior.
- [ ] Verify academic bootstrap, proof projection, and browser surfaces.

## Task 3: Demo Evidence Rerun

- [ ] Run focused backend tests for changed code.
- [ ] Run Sem1 and Sem6 full-role browser smokes with `devika.shetty`.
- [ ] Capture backend bootstrap counts and smoke summary paths.
- [ ] Update audit/handoff docs with exact evidence and remaining caveats.

## Task 4: Production-Readiness Package

- [ ] Create CERT-In incident logging/reporting readiness document with fields, timeline, and audit evidence references.
- [ ] Create data retention and delete/export policy document with current implementation status and missing endpoint decisions.
- [ ] Create model governance card with calibration, operational-band framing, fairness-gap status, and deployment claim boundaries.
- [ ] Create load-test plan or run a bounded local load check if safe.
- [ ] Update final verdict to separate demo readiness from production readiness.

## Self-Review

- No production code changes before failing tests for behavior changes.
- Demo-perfect and production-ready are separated to avoid false claims.
- Each task has observable evidence paths and focused verification.
- Existing dirty workspace is not assumed clean; final summaries must identify only touched files relevant to this plan.
