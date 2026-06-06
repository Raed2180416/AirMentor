# IDE-Shared Agent Configuration

This file is shared across all IDEs (Windsurf, Antigravity, VS Code, Code OSS, Trae) to ensure consistent agent behavior.

## Product Truth (Authoritative — June 2026)

AirMentor is a **real AI-powered academic risk monitoring product for universities**.

- **Purpose:** Identify at-risk students early and enable faculty intervention before failure.
- **Current State:** Product is in pre-deployment validation. A demo/proof simulation layer (synthetic students, seeded semester progression, proof control panel) provides **temporary scaffolding** to validate every feature before real-student data arrives.
- **End State:** A **university-agnostic platform** where every institution configures its own programs, branches, batches, grading rules, role hierarchies, and workflows through System Admin. The proof layer is removed once the product is deterministically validated.
- **ML Status:** Models are currently **shadow/offline only** on a **governed promotion path** to production serving. Promotion requires: real-data validation, calibration review, fairness audit, threshold approval, human-review policy, monitoring, and rollback gates.
- **Synthetic Data Status:** Synthetic cohorts are **stand-in data** for product validation only. All claims about model performance must be scoped to synthetic evidence until real-data gates are passed.

**This is NOT a research-only project.** The research track exists alongside the product track. Research produces challenger models; product uses governed baseline serving until promotion gates pass.

## Read Order (Before Any Broad Exploration)

1. `CLAUDE.md` — Product truth and communication policy
2. `.github/copilot-instructions.md` — Change rules, verification commands
3. `docs/agent-map/AGENT_REPO_MAP_2026-06-06.md` — Deterministic repo navigation
4. `docs/agent-map/repo-map.json` — Machine-queriable index
5. `docs/agent-map/PRODUCT_ARCHITECTURE_MAP_2026-06-06.md` — Complete feature-to-file mapping
6. `docs/agent-map/SEMANTIC_HOTSPOT_MAP_2026-06-06.md` — Function-level complexity index
7. `docs/agent-map/PROOF_DEMO_REMOVAL_PATH.md` — Demo scaffolding inventory
8. `docs/agent-map/SECURITY_PERFORMANCE_AUDIT_2026-06-06.md` — Risks and bottlenecks
9. `docs/CURRENT_PRODUCT_CLEANUP_DECISION_MATRIX_2026-06-06.md` — What stays, what goes

## Tool Ecosystem (How to Navigate This Repo)

### Phase 1: Deep Codebase Ingestion
Do not begin editing immediately. Use the tooling ecosystem:

1. **CodeGraph (codegraphcontext)** — Semantic code graph with Cypher queries. Already indexed 952 files.
   - Find function complexity: `mcp0_find_most_complex_functions`
   - Find call chains: `mcp0_analyze_code_relationships` with `call_chain`
   - Find dead code: `mcp0_find_dead_code`
   - Execute Cypher: `mcp0_execute_cypher_query`
   - Example query: `MATCH (f:Function) WHERE f.path CONTAINS 'proof-risk-model' RETURN f.name, f.cyclomatic_complexity ORDER BY f.cyclomatic_complexity DESC LIMIT 20`

2. **CTXO** — Symbol-level dependency analysis with blast radius.
   - Search symbols: `mcp2_search_symbols`
   - Get blast radius before changes: `mcp2_get_blast_radius`
   - Get logic slice (dependencies): `mcp2_get_logic_slice`
   - Find importers: `mcp2_find_importers`

3. **LogicStamp** — React/TypeScript component context with contracts.
   - Check watch status: `mcp9_logicstamp_watch_status`
   - Refresh snapshot: `mcp9_logicstamp_refresh_snapshot`
   - List bundles: `mcp9_logicstamp_list_bundles`
   - Read bundle: `mcp9_logicstamp_read_bundle`

4. **Repomix** — Pack repository into AI-friendly file for wide dependency analysis.
   - Command: `repomix --include "src/**/*.ts" --output repomix-output.xml`

5. **ast-grep** — Structural search with tree-sitter.
   - Example: `ast-grep run --pattern 'function $NAME($$$) { $$$ }' --lang ts`

6. **knip** — Unused code detection.
   - Command: `knip --no-gitignore`

### Phase 2: Impact Analysis
Before writing code:
1. **Blast radius:** `mcp2_get_blast_radius` on target symbol
2. **Reverse dependencies:** `mcp2_find_importers` on target symbol
3. **Call chain:** `mcp0_analyze_code_relationships` with `call_chain`
4. **Complexity check:** `mcp0_calculate_cyclomatic_complexity` on target function

### Phase 3: Planning
1. Draft implementation plan in chat context
2. Verify requirements before writing changes
3. For complex changes (>3 files), create a plan document

### Phase 4: Execution
1. **Token economy:** Use caveman/wenyan-ultra where appropriate
2. **Terminology:**
   - Use **"recalibration"** (not "retraining") when discussing model updates on synthetic data
   - Use **"demo validation"** or **"proof scaffolding"** (not "simulation platform") for the synthetic layer
   - Use **"shadow"** or **"offline"** for challenger model evaluation
   - Use **"university-agnostic"** or **"institution-configurable"** for configurability
3. **Minimal edits:** Prefer focused `edit` or `multi_edit` over broad rewrites

### Phase 5: Verification
1. TypeScript: `npx tsc -p tsconfig.app.json --noEmit` (frontend) and `npx tsc -p air-mentor-api/tsconfig.json --noEmit` (backend)
2. Lint: `npm run lint`
3. Unit tests: `npm test -- --reporter=dot` and `npm --workspace air-mentor-api test -- --reporter=dot`
4. Focused tests for changed behavior
5. Repo hygiene: `node scripts/check-repo-hygiene.mjs`

## Role Hierarchy & Permission Model

| Role | Scope |
|------|-------|
| **SYSTEM_ADMIN** | All institution configuration, all data, demo controls |
| **HOD** | Department-wide metrics, all students, all faculty, can unlock marks |
| **MENTOR** | Overall multi-subject metrics per assigned mentee, cross-subject risk |
| **COURSE_LEADER** | Individual student performance in their specific subject only |
| **STUDENT** | Self-view of performance, risk explorer, shell agent |

## Critical Constraints

1. **University-agnostic first:** New features must be configurable per institution
2. **Live path over demo path:** Build production-ready runtime features
3. **ML safety:** Production scoring on governed logistic path. Challengers shadow-only until gates pass
4. **Synthetic claim boundary:** Never claim real-student prediction accuracy without real data validation
5. **No hardcoded institution data:** Extract MSRUAS/M&C assumptions into configurable policy

## MSRUAS Policy Rules (To Be Made Configurable)

- SGPA = sum(credit × grade point) / total semester credits
- CGPA = sum(credit × grade point across semesters) / total attempted credits
- Grade mapping: O=10 (90-100), A+=9 (80-89), A=8 (70-79), B+=7 (60-69), B=6 (55-59), C=5 (50-54), P=4 (40-49), F=0 (<40)
- Subject pass requires: attendance eligibility + CE/internal eligibility + required SEE marks + minimum 40% overall
- If attendance or CE/internal fails: SEE is null/not attempted (not zero), course produces backlog
- Backlog/promotion is **credit-based** (not subject-count): max 15 credits for promotion
- Lower-year uncleared subjects block later promotion

## Risk Model Philosophy

- Rolling teacher-like **stage risk**, not single final-outcome classifier
- Sem 1 pre-TT1 has minimal prior data and should be cautious
- After TT1: risk updates using TT1 to anticipate TT2/trajectory
- After TT2: risk uses TT1+TT2 to update CE/SEE
- Assignments/quizzes are weak/noisy but nonzero CE evidence
- After SEE and in later semesters: learn from prior progression, carryover/backlog, historical patterns

## 5-Gate Model Validation Protocol

Before any recalibrated model or inference pipeline can be promoted:
1. **Discriminative Power (AUC)** — Verify classifier discrimination gains
2. **Probability Calibration (Brier Score)** — Measure Brier scores, plot calibration curves
3. **Feature Monotonicity Constraints** — Risk-inducing features must monotonically increase scores
4. **Subgroup Fairness** — Slice metrics across cohorts, courses, semesters, batches
5. **Out-of-Distribution (OOD) Robustness** — Validate against adversarial/extreme scenarios

## Key Files (Agent Quick Reference)

| File | Role | Complexity | Agent Warning |
|------|------|------------|---------------|
| `src/system-admin-live-app.tsx` | Admin workspace | 1575 | NEVER add features; extract instead |
| `src/App.tsx` | Root app state | 680 (workspace), 142 (app) | State should move to Zustand/Redux |
| `air-mentor-api/src/modules/academic.ts` | Academic core | 481 (bootstrap) | Split bootstrap into async jobs |
| `air-mentor-api/src/lib/proof-risk-model.ts` | Risk engine | 98 (feature builder) | ML contract — sync ALL consumers |
| `air-mentor-api/src/modules/admin-structure.ts` | Admin CRUD | 327 | Split by entity |
| `air-mentor-api/src/modules/academic-runtime-routes.ts` | Runtime routes | 338 | Split by domain |
| `air-mentor-api/src/modules/admin-control-plane.ts` | Proof routes | 251 | DEMO SCAFFOLDING |
| `src/obsidian-graph.tsx` | Curriculum graph | 547 | Optimize for >50 nodes |
| `src/pages/calendar-pages.tsx` | Calendar | 327 | Virtualize rendering |

## Verification Commands (Run These After Changes)

```bash
# TypeScript (all packages)
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p air-mentor-api/tsconfig.json --noEmit

# Tests
npm test -- --reporter=dot
npm --workspace air-mentor-api test -- --reporter=dot

# Lint
npm run lint

# Hygiene
node scripts/check-repo-hygiene.mjs

# Agent map regen (after structural changes)
npm run agent:map

# Backend risk model eval
npm --workspace air-mentor-api run evaluate:proof-risk-model

# Full proof closure
npm run verify:proof-closure
```

## Change Rules

1. Preserve the synthetic claim boundary (don't claim real-data accuracy)
2. Keep production scoring on governed logistic path
3. Prefer extracting a small boundary from a hotspot over broad rewrites
4. Do not add a second program template until the existing program is template-driven
5. Add/update focused unit, API, and browser contracts for visible behavior
6. Do not delete code based only on static unused-code findings; require product review

## Branch Independence

All branches share the same product positioning, core architecture, policy rules, and development guidelines. Branch-specific differences:
- `main`: Production-like serving, governed baseline
- Research branches: ML experimentation (must not modify serving path without gates)
- Feature branches: Specific phase work

## External Archive

Heavy artifacts (training corpora, model runs, database snapshots, evidence packs) live under `/home/raed/Archives` with content manifest and SHA-256. Generated runs: keep current runtime artifact, last promoted research run, and latest failed/shadow run for comparison. Everything else is deleted after archival.

## Agent Memory Update Protocol

After completing significant work:
1. Update relevant docs in `docs/agent-map/` if file structure or architecture changed
2. Regenerate agent map: `npm run agent:map`
3. Update this file if product intent or verification commands changed
4. Run repo hygiene: `node scripts/check-repo-hygiene.mjs`
