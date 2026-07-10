# AirMentor Agent Playbook

## Identity & Goal

You are an agent working on **AirMentor**, a real AI-powered academic risk monitoring product for universities. The codebase is a React 19 + Vite frontend with a Fastify API backend (`air-mentor-api` workspace), Playwright e2e tests, Vitest unit tests, and Python/Node scripts for proof scaffolding.

Your goal: **make high-quality, minimal, verified changes while preserving the live product path and the governed ML promotion boundary.**

## Mandatory Read Order

Before editing, read in this order:

1. `.github/copilot-instructions.md`
2. `CLAUDE.md`
3. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md`
4. `docs/agent-map/repo-map.json`
5. `HEARTBEAT.md`

## Deterministic Navigation

The repo map is the primary source of truth for file/symbol/route/test discovery. Regenerate it after any structural change:

```bash
npm run agent:map
```

Key machine-readable indexes:

- `docs/agent-map/repo-map.json` — summary, entry points, hot files, package scripts
- `docs/agent-map/files.jsonl` — one row per file with role, size, line counts, sha256, React signals
- `docs/agent-map/symbols.jsonl` — top-level symbols with start/end lines
- `docs/agent-map/imports.jsonl` — local import graph
- `docs/agent-map/routes.jsonl` — API route registrations
- `docs/agent-map/tests.jsonl` — test cases
- `docs/agent-map/atoms.jsonl` — exports, env vars, SQL tables, component calls, hook calls

Use `jq` or `rg` to query these instead of broad file scanning.

## Durable vs. Demo Scaffolding

Protected (live product):

- `src/` — React surfaces
- `air-mentor-api/src/` — API, policy, persistence
- `tests/`, `tests-e2e/`, `air-mentor-api/tests/` — executable contracts
- `air-mentor-api/model-contract/proof-risk-model/` — governed model contract

Temporary proof scaffolding (do not extend without explicit need):

- `msruas-proof-control-plane.ts` and related proof services
- `generate_v2_data.py`
- Proof Control Panel UI surfaces
- Seeded synthetic semester progression

## Change Rules

1. University-agnostic first: configurable per institution, not hardcoded to MSRUAS/M&C.
2. Live path over demo path.
3. ML safety: keep production scoring on the governed logistic path; challengers remain shadow-only.
4. Never claim real-student prediction accuracy until real data validates it.
5. Configuration-driven schemas for programs, grading rules, role hierarchies.
6. Test every change: unit, API, and browser contracts.

## Verification Commands

```bash
# TypeScript compile
npm run build
npm --workspace air-mentor-api run build

# Unit tests
npm test -- --reporter=dot
npm --workspace air-mentor-api test -- --reporter=dot

# Risk model evaluation
npm --workspace air-mentor-api run evaluate:proof-risk-model

# Full proof closure
npm run verify:proof-closure

# DB drift
npm run backend:drift:check

# Repo hygiene
node scripts/check-repo-hygiene.mjs

# Regenerate map
npm run agent:map
```

## Auto-Update: Map Watcher and Git Hooks

The repo map is kept fresh automatically on two triggers:

1. **File-system watcher** — runs on every save/create/move/delete:
   ```bash
   # Install and start the systemd user service (one-time)
   bash scripts/setup-live-watcher.sh
   # Status / logs
   systemctl --user status airmentor-live-watcher
   tail -f .audit/live-watcher.log
   ```

2. **Git pre-commit hook** — regenerates and stages the map before each commit:
   ```bash
   bash scripts/setup-git-hooks.sh   # one-time
   ```

The map will now update on any file change and is automatically committed. Generated files are in `docs/agent-map/` and `.audit/deterministic-index/`.


## Required Skills & MCP Plugins

Load these before any task to avoid token waste:

- **react** (frontend): `vercel-react-best-practices`, `vercel-ui`, `playwright-testing`, `jest-vitest`
- **backend**: `backend-engineering`, `api-design`, `api-testing`, `database-engineering`, `docker-kubernetes`
- **data/model**: `ml-ops`, `data-science`, `data-pipelines` (for model evaluation and synthetic data flows)
- **security/quality**: `appsec-owasp`, `accessibility-wcag`, `clean-code`, `code-review-mastery`
- **devops**: `ci-cd-pipelines`, `azure-prepare`, `azure-deploy`, `terraform-iac`
- **agentics**: `ai-agent-design`, `mcp-builder`, `mastra` (if adding agentic surfaces)
- **general**: `absolute-simplify`, `technical-writing`, `internal-docs`

## MCP Recommendations

- `devin/filesystem` — list/read only when repo-map does not answer
- `devin/github-mcp-server` — for PR/issue automation
- `devin/mcp-playwright` — for e2e verification and browser snapshots
- `devin/context7` — for up-to-date library docs of dependencies in `package.json` and `air-mentor-api/package.json`
- `devin/memory` — for persisting cross-session context about the project

## Communication

Use caveman mode (wenyan-ultra) by default for this repository. Keep technical accuracy exact. Stay in caveman mode until user says "stop caveman" or "normal mode".

## Anti-Patterns

- Do not broad-search source manually; query `docs/agent-map/*.jsonl` first.
- Do not delete files based only on static unused-code findings.
- Do not add new demo/proof scaffolding without a live-path alternative.
- Do not commit `context.json`, `node_modules`, `dist`, `.env`, or `.devin/config.local.json`.

## Handoff Reminder

When you finish, leave the repo in a buildable, testable state and run `npm run agent:map` if the file structure changed.
