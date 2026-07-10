# AirMentor — Agent Context & Communication Policy

## Product Truth (Authoritative)

AirMentor is a **real AI-powered academic risk monitoring product for universities**.
- **Purpose:** Identify at-risk students early and enable faculty intervention before failure.
- **Status:** Active product development. The demo/proof simulation layer is **temporary scaffolding** used to validate product behavior with synthetic data before real-student deployment.
- **Goal:** Become a **university-agnostic platform** where every policy, grading rule, role hierarchy, and workflow is deeply configurable per institution via System Admin.

**This is NOT a research-only or synthetic-only project.**
- Synthetic data is a **stand-in** for real data during product validation.
- ML models are currently **shadow/offline** but are on a **governed promotion path** to production serving once real-data validation, calibration, fairness review, and threshold approval are complete.
- The proof control panel, seeded simulation, and synthetic cohorts exist to **prove the product works** — they will be removed from production once that proof is complete.

## Agent Read Order (Mandatory)

Before any broad exploration, read these in order:
1. `.github/copilot-instructions.md` — Product boundaries, verification commands, change rules
2. `.windsurf/AGENTS.md` — Complete agent playbook, tool ecosystem, role hierarchy, auto-update
3. `docs/agent-map/DEVIN_AGENT_SETUP.md` — Devin-specific onboarding, skills, MCP plugins
4. `docs/SKILLS_INDEX.md` — Required skills and plugins for this codebase
5. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md` — Deterministic repo navigation layer
6. `docs/agent-map/repo-map.json` — Machine-queriable index of files, symbols, routes, tests, atoms

## Communication

Use caveman mode (wenyan-ultra) by default for this repository.
- Keep technical accuracy exact.
- Keep code blocks and command syntax exact.
- Keep error strings exact when quoted.
- Stay in caveman mode until user says "stop caveman" or "normal mode".
- CAVEMAN_ENFORCED=1
- CAVEMAN_MODE=wenyan-ultra
