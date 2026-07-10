# AirMentor Workspace Instructions

## Product Truth (Authoritative — June 2026)

AirMentor is a **real AI-powered academic risk monitoring product for universities**.

- **Purpose:** Identify at-risk students early and enable faculty intervention before failure.
- **Current State:** Product is in pre-deployment validation. A demo/proof simulation layer (synthetic students, seeded semester progression, proof control panel) provides **temporary scaffolding** to validate every feature before real-student data arrives.
- **End State:** A **university-agnostic platform** where every institution configures its own programs, branches, batches, grading rules, role hierarchies, and workflows through System Admin. The proof layer is removed once the product is deterministically validated.
- **ML Status:** Models are currently **shadow/offline only** on a **governed promotion path** to production serving. Promotion requires: real-data validation, calibration review, fairness audit, threshold approval, human-review policy, monitoring, and rollback gates.
- **Synthetic Data Status:** Synthetic cohorts are **stand-in data** for product validation only. All claims about model performance must be scoped to synthetic evidence until real-data gates are passed.

## Read Order (Before Any Broad Exploration)

1. `CLAUDE.md` — Product truth and communication policy
2. `.windsurf/AGENTS.md` — Complete agent playbook, tools, verification loop, auto-update setup
3. `docs/agent-map/DEVIN_AGENT_SETUP.md` — Devin-specific onboarding, skill list, MCP plugins
4. `docs/SKILLS_INDEX.md` — Required skills and plugins for this codebase
5. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md` — Deterministic navigation layer
6. `docs/agent-map/repo-map.json` — Machine-queriable file/symbol/route/test/atom index
7. `docs/CURRENT_PRODUCT_CLEANUP_DECISION_MATRIX_2026-06-06.md` — What stays, what goes, what archives

## Durable Repository Areas (Protected)

- `src/`: React product surfaces for HOD, Mentor, Course Leader, System Admin, Student
- `air-mentor-api/src/`: Fastify API, policy engine, simulation scaffolding, risk model definitions, persistence
- `tests/`, `air-mentor-api/tests/`, `tests-e2e/`: Executable contracts (unit, API, browser)
- `docs/readiness/`: Security, retention, load, model governance policies
- `air-mentor-api/model-contract/proof-risk-model/`: Governed runtime serving contract

## Demo Scaffolding (Removal Path)

These exist to validate the product and WILL be removed from production:
- `msruas-proof-control-plane.ts` and related "proof" services — simulator core
- `generate_v2_data.py` — synthetic cohort generator
- Proof Control Panel UI surfaces — admin demo playback controls
- Seeded semester progression — deterministic synthetic replay

Before modifying any demo scaffolding, check if the same behavior exists in the live/runtime path. Prefer strengthening live paths over extending demo paths.

## Change Rules

1. **University-agnostic first:** New features must be configurable per institution, not hardcoded to MSRUAS/M&C.
2. **Live path over demo path:** Build production-ready runtime features; use demo only for validation gaps.
3. **ML safety:** Keep production scoring on the governed logistic path. Challengers remain shadow-only until all promotion gates pass.
4. **Preserve synthetic claim boundary:** Never claim real-student prediction accuracy until real data validates it.
5. **Configuration-driven:** Extract program templates, grading rules, role hierarchies into configurable schemas.
6. **Test with every change:** Unit, API, and browser contracts for all visible behavior.

## Verification Commands

```bash
# TypeScript compilation (all packages)
npm run build
npm --workspace air-mentor-api run build

# Unit tests
npm test -- --reporter=dot
npm --workspace air-mentor-api test -- --reporter=dot

# Backend risk model evaluation
npm --workspace air-mentor-api run evaluate:proof-risk-model

# Full proof closure (e2e, accessibility, keyboard)
npm run verify:proof-closure

# DB schema drift check
npm run backend:drift:check

# Repo hygiene
node scripts/check-repo-hygiene.mjs

# Agent map regeneration (after structural changes)
npm run agent:map
```

## Terminology

- Use **"recalibration"** (not "retraining") when discussing model updates on synthetic data.
- Use **"demo validation"** or **"proof scaffolding"** (not "simulation platform") for the synthetic layer.
- Use **"shadow"** or **"offline"** (not "research") for challenger model evaluation.
- Use **"university-agnostic"** or **"institution-configurable"** to describe the configurability goal.
