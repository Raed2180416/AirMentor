# Realism Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a defensible, intent-first realism verification campaign for AirMentor before demo closeout.

**Architecture:** A purpose-built pipeline DAG dispatches independent audit agents with disjoint report artifacts, then a merge agent synthesizes the verdict. Local browser verification runs in parallel from the coordinator session.

**Tech Stack:** AirMentor Vite/React frontend, Node/TypeScript backend, Playwright, pipeline v2 SQLite/tmux/worktree orchestrator.

---

### Task 1: Create purpose DAG

**Files:**
- Create: `pipeline/agents/realism-verification-2026-04-29-dag.yaml`
- Create: `audit-map/20-prompts/realism/*.md`
- Create: `pipeline/agents/manifests/realism-*.yaml`

- [ ] **Step 1: Write DAG, prompts, manifests**

Create six nodes: browser, proof-plane, teacher-hod, ml-sanity, readiness-security, merge-verdict. First five may run in parallel; merge waits for all.

- [ ] **Step 2: Validate DAG loads**

Run: `AIRMENTOR_DAG_ALLOW_UNTRACKED=1 ./pipeline/.venv/bin/python -m pipeline.orchestrator.main init --dag pipeline/agents/realism-verification-2026-04-29-dag.yaml`
Expected: JSON with `nodes: 6`.

- [ ] **Step 3: Commit DAG inputs**

Run: `git add docs/superpowers/specs/2026-04-29-realism-verification-design.md docs/superpowers/plans/2026-04-29-realism-verification.md pipeline/agents/realism-verification-2026-04-29-dag.yaml audit-map/20-prompts/realism pipeline/agents/manifests/realism-*.yaml && git commit -m "chore(pipeline): add realism verification DAG"`
Expected: commit includes only DAG inputs and design/plan docs.

### Task 2: Dispatch agents

**Files:**
- Read: `pipeline/README.md`
- Read: `pipeline/RUNBOOK.md`

- [ ] **Step 1: Init committed DAG**

Run: `./pipeline/.venv/bin/python -m pipeline.orchestrator.main init --dag pipeline/agents/realism-verification-2026-04-29-dag.yaml`
Expected: JSON with a new `dag_run_id`.

- [ ] **Step 2: Start orchestrator**

Run: `bash pipeline/scripts/start.sh --dag-run-id <dag_run_id> --parallel 4`
Expected: `airmentor-pipe-orchestrator` and `airmentor-pipe-tui` tmux sessions.

- [ ] **Step 3: Monitor status**

Run: `./pipeline/.venv/bin/python -m pipeline.orchestrator.main status --dag-run-id <dag_run_id>`
Expected: first five nodes running/completed before merge.

### Task 3: Coordinator browser verification

**Files:**
- Read: `package.json`
- Read: `tests-e2e/playwright.config.ts`
- Read: `scripts/system-admin-proof-risk-smoke.mjs`

- [ ] **Step 1: Run focused E2E/browser probes from canonical checkout**

Run targeted Playwright or existing proof-risk smoke scripts with artifact output under `/tmp/airmentor-demo-logs/realism-2026-04-29/`.

- [ ] **Step 2: Record failures with reproduction**

For every failure, capture role, semester/stage, page, expected realistic behavior, actual behavior, console/network errors, and artifact paths.

### Task 4: Merge and act

**Files:**
- Read: `audit-map/32-reports/realism-*-2026-04-29.md`

- [ ] **Step 1: Read agent reports**

Confirm every report has findings, evidence, blockers, and verdict.

- [ ] **Step 2: Build fix queue**

Separate must-fix demo blockers from maturity/readiness docs and post-demo improvements.

- [ ] **Step 3: Fix only reproduced root causes**

Use systematic debugging and TDD for each product-code fix. Re-run the exact browser/API probe that exposed it.
