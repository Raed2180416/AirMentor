# Devin Agent Setup for AirMentor

This file is a committed reference for any Devin agent that works on the `air-mentor-ui` repository.

## 1. Start Here

Read before any change:

1. `.github/copilot-instructions.md`
2. `CLAUDE.md`
3. `.windsurf/AGENTS.md`
4. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md`
5. `docs/agent-map/repo-map.json`
6. `HEARTBEAT.md`

## 2. Repository Shape

- **Frontend**: `src/` — React 19 + Vite + TypeScript + `@xyflow/react` + D3 + Framer Motion + Lucide.
- **Backend**: `air-mentor-api/` — Fastify API in `src/`, Node scripts, Python data scripts, model contracts.
- **Tests**: `tests/` (Vitest), `tests-e2e/` (Playwright), `air-mentor-api/tests/` (Vitest).
- **Docs**: `docs/` — product, architecture, audit, and agent maps.
- **Scripts**: `scripts/` — repo tooling, `air-mentor-api/scripts/` — backend tooling.
- **Generated map**: `docs/agent-map/*.jsonl` and `docs/agent-map/*.json`.

## 3. Repo Map Auto-Update

The map is automatically regenerated on every file change and before every commit. You should not manually run it unless you disabled the watcher/hooks.

```bash
# One-time setup (already done on this machine)
bash scripts/setup-live-watcher.sh   # systemd file watcher
bash scripts/setup-git-hooks.sh      # pre-commit hook

# Manual regeneration if needed
npm run agent:map
```

- **File-system watcher**: `systemctl --user status airmentor-live-watcher` / `tail -f .audit/live-watcher.log`
- **Git hook**: `git config --local core.hooksPath` should point to `.githooks`
- **Output**: `docs/agent-map/*` and `.audit/deterministic-index/`

This produces `repo-map.json`, `files.jsonl`, `symbols.jsonl`, `imports.jsonl`, `routes.jsonl`, `tests.jsonl`, `atoms.jsonl`, and `directories.json`.

## 4. Essential Commands

```bash
npm run build                 # frontend TS + vite build
npm --workspace air-mentor-api run build  # backend build
npm test -- --reporter=dot    # unit tests
npm --workspace air-mentor-api test -- --reporter=dot  # API tests
npm run e2e                   # Playwright e2e
npm run verify:proof-closure  # full proof closure (build + test + e2e)
npm run backend:drift:check   # DB schema drift
npm run lint                  # ESLint
node scripts/check-repo-hygiene.mjs
```

## 5. Required Skills for Devin

Before a task, invoke the relevant skills from the `skills` registry. For AirMentor these are the most common:

- `vercel-react-best-practices` — React 19 + Vite + performance
- `vercel-react-view-transitions` — animations / transitions
- `playwright-testing` — e2e tests and browser automation
- `jest-vitest` — unit tests
- `backend-engineering` — Fastify API, schema, policy engine
- `api-design` — REST route design
- `api-testing` — contract and route tests
- `database-engineering` — schema and query design
- `docker-kubernetes` — if touching container or deployment configs
- `ml-ops` — model evaluation and risk model promotion
- `data-pipelines` — synthetic data generation and evaluation flows
- `appsec-owasp` — security hardening
- `accessibility-wcag` — a11y compliance
- `clean-code` — refactoring and quality
- `code-review-mastery` — reviewing local changes
- `ci-cd-pipelines` — GitHub Actions and deployment
- `azure-prepare` / `azure-deploy` — Azure hosting if needed
- `technical-writing` — docs and runbooks
- `ai-agent-design` — if adding agentic features
- `mcp-builder` — if adding MCP tools

## 6. MCP Plugins to Load

Load these via `.devin/mcp_config.json` or the Devin MCP panel:

- `devin/filesystem` — list/read files (use sparingly; prefer repo-map)
- `devin/github-mcp-server` — PRs, issues, code search
- `devin/mcp-playwright` — browser verification
- `devin/context7` — docs for deps in `package.json` and `air-mentor-api/package.json`
- `devin/memory` — cross-session context
- `devin/fetch` — web research when needed

## 7. Token-Saving Rules

1. Query `docs/agent-map/*.jsonl` before broad file search.
2. Use `jq` to read `repo-map.json` for entry points.
3. Use `rg` against `symbols.jsonl` to find a symbol's file and line.
4. Use `atoms.jsonl` to trace exports, env vars, SQL tables, component calls, and hook calls.
5. Avoid loading full source unless the map points you there.
6. Never broad-replace across the repo without checking `imports.jsonl` first.

## 8. Product Guardrails

- AirMentor is a **real** product; the demo/proof layer is temporary scaffolding.
- ML models are **shadow/offline only** until promotion gates pass.
- Synthetic data is for validation only; do not claim real-student accuracy.
- Build **university-agnostic** features, configurable via System Admin.

## 9. Handoff Checklist

- [ ] Code compiles (`npm run build` and `npm --workspace air-mentor-api run build`)
- [ ] Tests pass at the relevant level
- [ ] Lint clean (`npm run lint`)
- [ ] Repo map regenerated if files moved/added/removed (`npm run agent:map`)
- [ ] No secrets, no `.env`, no `context.json` committed
- [ ] No new demo scaffolding unless explicitly approved
