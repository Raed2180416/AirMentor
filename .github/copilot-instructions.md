# AirMentor UI Copilot Workspace Instructions

## Quick Start: Agent Bootstrap (First 10 Minutes)

**READ THESE IN ORDER** before any coding:

1. [audit-map/index.md](../audit-map/index.md) – Purpose and update rules
2. [audit-map/00-governance/future-agent-operating-manual.md](../audit-map/00-governance/future-agent-operating-manual.md) – Operating procedures
3. [audit-map/24-agent-memory/known-facts.md](../audit-map/24-agent-memory/known-facts.md) – Verified project facts (append-only)
4. [audit-map/14-reconciliation/contradiction-matrix.md](../audit-map/14-reconciliation/contradiction-matrix.md) – Known mismatches & gaps
5. [audit-map/23-coverage/coverage-ledger.md](../audit-map/23-coverage/coverage-ledger.md) – Audit surface status
6. Check `audit-map/29-status/` and `audit-map/30-checkpoints/` for resumable work

**Then start with:** `audit-map/32-reports/operator-next-steps.md`

---

## Project Structure: Four-Surface Audit Model

The codebase is audited across **four separate evidence types** for each surface:

1. **Expected Behavior** – Design docs, specs, intended behavior
2. **Implemented Behavior** – Source code, actual logic, configuration  
3. **Tested Behavior** – Unit/integration tests, test coverage gaps
4. **Live Behavior** – Deployed evidence, runtime traces, contradiction vs live

### Repository Structure

```
.
├── src/                          # React frontend (Vite)
│   ├── portal-entry.tsx          # Portal chooser (#/, #/app, #/admin)
│   ├── App.tsx                   # App shell, theme, routing setup
│   ├── data.ts                   # Domain model (Offering, Student, Faculty, etc)
│   ├── domain.ts                 # TypeScript types
│   ├── selectors.ts              # Redux-like derived state
│   ├── repositories.ts           # HTTP client + localStorage layer
│   ├── api/                      # Route-specific HTTP clients
│   ├── system-admin-*.tsx        # System admin portal
│   ├── academic-*.tsx            # Academic portal (role-specific)
│   ├── pages/                    # Page components
│   ├── ui-primitives.tsx         # Reusable components
│   ├── proof-*.ts                # Proof-risk scoring runtime
│   ├── calendar-utils.ts         # Calendar math
│   └── theme.ts                  # Colors, constants
├── air-mentor-api/               # Node/Fastify backend
│   ├── src/index.ts              # Entry point (config, pool, migrations, startup)
│   ├── src/app.ts                # Fastify app builder
│   ├── src/config.ts             # .env config loader
│   ├── src/startup-diagnostics.ts # Pre-start validation
│   ├── src/db/
│   │   ├── schema.ts             # Drizzle ORM (18+ tables)
│   │   ├── migrations/           # Numbered .sql files
│   │   └── seed.ts, seeds/       # Database seeding
│   ├── src/lib/                  # Utilities (CSRF, proof-risk, telemetry, etc)
│   ├── src/modules/              # Domain routes (academic, admin, session, etc)
│   └── src/types/                # Shared TypeScript types
├── tests/                        # Frontend unit tests (vitest)
├── air-mentor-api/tests/         # Backend unit tests
├── audit-map/                    # **Operating system** (see below)
├── scripts/                      # Helper scripts (dev, Playwright, verification)
├── .github/workflows/            # CI/CD (deploy, verify, cadence)
├── docs/                         # Old audit corpus
└── audit/                        # Legacy audit outputs
```

---

## Tech Stack & Conventions

### Frontend (React 19 + Vite + TypeScript)

| Setting | Value | Notes |
|---------|-------|-------|
| **Build tool** | Vite | `npm run dev` for local, `npm run build` for prod |
| **Testing** | Vitest + React Testing Library | Files: `tests/**/*.test.ts{x}` (excludes e2e/) |
| **Linting** | ESLint with TS strict | `npm run lint` |
| **Routing** | Hash-based | `#/` (portal), `#/app` (academic), `#/admin` (admin) |
| **State** | LocalStorage + selectors | Immutable `domain.ts` types, derived via `selectors.ts` |
| **API** | HTTP + localStorage fallback | `repositories.ts` handles both |
| **Theme** | CSS via `theme.ts` | Colors, spacing, component constants |

**Code org conventions:**
- Page/portal components: `{role}-{feature}-*.tsx` (e.g. `system-admin-proof-dashboard-workspace.tsx`)
- Utilities: `{verb}-{noun}.ts` (e.g. `calendar-utils.ts`, `page-utils.ts`)
- Tests co-located: `file.ts` → `file.test.ts`
- React Refresh: `react-refresh/only-export-components` disabled on `system-admin-ui.tsx` and `ui-primitives.tsx` for Storybook

**Key internal state families** (persisted via localStorage):
- Academic session: role-context, route history, workspace restore
- Proof dashboard: checkpoint selection (`airmentor-proof-playback-selection`)
- Admin UI: proof tab state, scope filters, dismissed queue items
- Runtime shadow state: tasks, cell values, drafts, calendar audit data

### Backend (Node 24 + Fastify + Drizzle + PostgreSQL)

| Setting | Value | Notes |
|---------|-------|-------|
| **Runtime** | tsx + Node 24 | `npm --workspace air-mentor-api run dev` localhost:4000 |
| **Framework** | Fastify 5 | Route registration via domain modules |
| **Database** | PostgreSQL + Drizzle ORM | Migrations in `src/db/migrations/`, seeded via `seeds/platform.seed.json` |
| **Testing** | Vitest + embedded-postgres | Isolated local DB, no external dependency; 180s timeout (420s for proof-rc) |
| **Security** | CSRF tokens + session cookies | Origin-checked, role-based access controls |

**Route org:**
- Each domain module exports a registrar function (e.g. `registerAcademicRoutes(ctx)`)
- Context injected via `RouteContext { config, db, pool, now }`
- Error handling: typed `AppError` with HTTP status + semantic codes
- Access control: role guards like `assertAcademicAccess()`, `evaluateHodStudentScopeAccess()`

**Database layers:**
- **Migrations**: Raw SQL, applied in filename order, recorded in `schema_migrations`
- **Seed**: Destructive reset-and-replay; broad auth/academic/proof tables cleared before JSON replay
- **Seeded runtime**: Platform baseline + MSRUAS proof sandbox synthetic runtime
- **Active runs**: Observable proof-risk v3 features → logit-v5 model → post-hoc calibration
- **Snapshots**: Row-level provenance in `riskEvidenceSnapshots`, artifacts in `riskModelArtifacts`

**Key modules:**
- `session.ts` – Session & CSRF management
- `academic-*.ts` – Academic routes (bootstrap, proof, runtime, access)
- `admin-*.ts` – Admin control plane (requests, proof, structure)
- `proof-run-queue.ts` – Async queue mechanics (lease, heartbeat, retry)
- `proof-risk-model.js` – Deterministic observable scoring + trained inference

### TypeScript Configuration

| File | Target | Notes |
|------|--------|-------|
| `tsconfig.app.json` | Frontend ES2022, ESNext modules | `noEmit: true` (Vite handles emit) |
| `air-mentor-api/tsconfig.build.json` | Backend ES2022, CommonJS | `rootDir: ./src` |
| `air-mentor-api/tsconfig.json` | Base shared settings | |

**Strict mode enforced:** `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

---

## Build & Run Commands

### Frontend

```bash
npm run dev              # Vite dev server (http://127.0.0.1:5173)
npm run dev:live        # Proxied dev with live backend
npm run build           # TypeScript + Vite production build
npm run lint            # ESLint check
npm test                # Vitest run (not watch)
```

### Backend (from root or within air-mentor-api/)

```bash
npm --workspace air-mentor-api run dev              # tsx watch (localhost:4000)
npm --workspace air-mentor-api run dev:seeded       # Dev with pre-populated DB
npm --workspace air-mentor-api run build            # tsc build
npm --workspace air-mentor-api run db:migrate       # Drizzle migrations
npm --workspace air-mentor-api run db:seed          # Database seeding
npm --workspace air-mentor-api test                 # Vitest suite runner
```

### Verification & Testing

```bash
npm run verify:proof-closure              # Full test suite + Playwright smoke tests
npm run verify:proof-closure:proof-rc      # Includes proof-rc backend suite
npm run verify:final-closeout              # Final integration check
npm run evaluate:proof-risk-model          # ML model evaluation
npm run playwright:smoke                   # Basic smoke test
npm run playwright:admin-live:acceptance   # Live admin surface acceptance tests
```

**Live Playwright suites** (require environment setup):
- `playwright:admin-live:acceptance`
- `playwright:admin-live:accessibility-regression`
- `playwright:admin-live:keyboard-regression`
- `playwright:admin-live:proof-risk`
- `playwright:admin-live:teaching-parity`
- `playwright:admin-live:request-flow`
- `playwright:admin-live:session-security`

---

## Environment Variables

### Backend (.env or .env.local in air-mentor-api/)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` or `RAILWAY_TEST_DATABASE_URL` | required | PostgreSQL connection |
| `PORT` | `4000` | Server port |
| `HOST` | `127.0.0.1` | Server host |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173, 127.0.0.1:5173` | CORS allowlist (comma-separated) |
| `CSRF_SECRET` | (generated) | CSRF token secret |
| `SESSION_COOKIE_SECURE` | `false` (dev), `true` (prod) | Secure cookie flag |
| `SESSION_COOKIE_SAME_SITE` | `Lax` | SameSite cookie policy |

### Frontend (Vite env)

| Variable | Purpose |
|----------|---------|
| `VITE_AIRMENTOR_API_BASE_URL` | API base URL (parsed in vite.config.ts) |
| `GITHUB_REPOSITORY` | For GitHub Pages base path calculation |
| `GITHUB_ACTIONS` | Triggers production-like base path |

### Live Testing

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_APP_URL` | App URL for live tests |
| `PLAYWRIGHT_API_URL` | API URL for live tests |
| `AIRMENTOR_LIVE_SYSTEM_ADMIN_IDENTIFIER` | Live admin email (required for live closeout) |
| `AIRMENTOR_LIVE_SYSTEM_ADMIN_PASSWORD` | Live admin password (required for live closeout) |
| `AIRMENTOR_LIVE_STACK` | Set to `1` for live test mode (uses real URLs, not local seeded) |

---

## Audit Map Operating System

The `audit-map/` folder is the **command and control plane** for ongoing investigation and agent coordination. It enforces reproducible, resumable, evidence-backed analysis.

### First Priority Files (In Order)

1. **`00-governance/`** – Policy & routing
   - `future-agent-operating-manual.md` – Operating procedures (first 10 min, working rules, before starting work)
   - `analysis-rules.md` – Evidence capture rules
   - `model-routing-policy.md` – Model selection (gpt-5.4, gpt-5.4-mini, Arctic slots, fallbacks)

2. **`24-agent-memory/`** – Durable findings
   - `known-facts.md` – Verified facts (append-only, 200+ verified findings)
   - `working-knowledge.md` – Current findings & contradictions (updated each pass)

3. **`14-reconciliation/contradiction-matrix.md`** – Known gaps & conflicts (C-001..C-012)

4. **`23-coverage/coverage-ledger.md`** – Audit surface status per path

5. **`29-status/` & `30-checkpoints/`** – Active job state for resumability

### Key Governance Docs

| File | Purpose |
|------|---------|
| `00-governance/analysis-rules.md` | Evidence capture standard |
| `00-governance/model-routing-policy.md` | Model selection rules (native `gpt-5.4`/`gpt-5.4-mini` vs Arctic slots) |
| `00-governance/decision-log.md` | Major assumptions & decisions |

### Operating Procedures

**Before Starting Work:**
1. Check `29-status/` for active jobs: `bash audit-map/16-scripts/tmux-list-jobs.sh`
2. Check `30-checkpoints/` for resumable passes
3. Update `24-agent-memory/working-knowledge.md` with current findings

**During Work:**
- Add contradictions immediately to `14-reconciliation/contradiction-matrix.md`
- Store evidence artifacts in `17-artifacts/local/` or `17-artifacts/live/`
- Write summary snapshots to `18-snapshots/repo/` or `18-snapshots/live/`

**Before Ending:**
- Update `23-coverage/coverage-ledger.md` for paths that changed
- Write next-step instructions to `24-agent-memory/working-knowledge.md`
- Create status file in `29-status/` and checkpoint in `30-checkpoints/` if work is resumable
- If blocked, document manual steps in `25-accounts-routing/manual-action-required.md`

### Audit Automation Scripts

Located in `audit-map/16-scripts/`:

| Script | Purpose |
|--------|---------|
| `tmux-list-jobs.sh` | List active detached analysis jobs |
| `tmux-job-status.sh <pass> <job>` | Check specific job status |
| `tmux-tail-job-log.sh <pass> <job>` | Tail live job log |
| `run-audit-pass.sh <pass>` | Start long-running audit pass in tmux |
| `task-classify-route.sh <task-type>` | Classify task → model/provider/budget |
| `select-execution-route.sh <provider> <model>` | Select Arctic slot or native execution |

### Evidence Organization

```
audit-map/
├── 17-artifacts/
│   ├── local/          # Local code evidence (snapshots, exports)
│   └── live/           # Live deployment evidence (responses, traces)
├── 18-snapshots/
│   ├── repo/           # Repository snapshots (file listings, route trees)
│   └── live/           # Live deployment snapshots (JSON responses, HTML)
├── 24-agent-memory/    # Durable state
│   ├── known-facts.md  # Verified findings (append-only)
│   ├── working-knowledge.md  # Current work in progress
│   └── known-ambiguities.md  # Uncertain claims
├── 29-status/          # Active job status files (JSON)
├── 30-checkpoints/     # Resumable pass checkpoints
└── 32-reports/         # Final outputs (ledgers, matrices, registry maps)
```

### Model Routing Policy

This workspace has verified local Codex models:

| Model | Use | Status |
|-------|-----|--------|
| `gpt-5.4` | Contradiction resolution, synthesis, final reports | ✅ Available (native-only for high-stakes) |
| `gpt-5.4-mini` | Structured passes, template filling, route extraction | ✅ Available (default for most work) |
| `gpt-5.3-codex` | Fallback only | ✅ Available (Arctic slots verified) |
| `gpt-5.2` | Long-running fallback | ✅ Available (if native unavailable) |

**Routing rules:**
- Start at `gpt-5.4-mini` for structured passes
- Escalate to `gpt-5.4` when semantic ambiguity or contradiction density is high
- Use Arctic slots for high-parallelism or resilience (all 6 `codex-*` slots verified on `gpt-5.3-codex`)
- `account-routing-pass`, `ml-audit-pass`, `live-behavior-pass`, and `synthesis-pass` are **native-only** (policy enforcement)

---

## Known Constraints & Integration Points

### Frontend Routing & Access Control

- **Hash-based routing** (no server-side routing)
  - `#/` – Portal chooser
  - `#/app` – Academic portal (query string for scope: `?offering=X&batch=Y&role=MENTOR`)
  - `#/admin` – System admin portal (deep links: `students`, `faculty-members`, `requests`, `faculties/...`)
- **Academic session role-switching**: `POST /api/session/role-context` switches only among active grants; login selects highest-priority
- **Access control**: Faculty profile is self-access or HoD/admin if backend checks pass; student shell is drilldown-only via mentor/HoD
- **Runtime shadow state** persists via localStorage keys (tasks, calendar audit data, timetable templates)

### Backend API Contracts

- **CSRF protection** mandatory for POST/PUT/PATCH/DELETE (header + cookie + session-backed)
- **Origin checking** required; session cookie required
- **Session TTL** configurable (default 168h); rate-limiting on login
- **Proof model**: observable-risk-v3 features → logit-v5 production → post-hoc calibration
  - Head probability display suppressed unless held-out support & ECE quality clear thresholds
  - `ceRisk` intentionally band-only (no probability)
  - Academic surfaces reuse active proof via `computeRiskFromActiveModelOrPolicy()`
- **Async proof queue**: Lease claim → heartbeat → stage rebuild → activation → published projection
- **Fallback**: Runtime can synthesize `fallback-simulated` source refs for incomplete evidence and still score via trained path

### Live Deployment Known Issues

- **GitHub Pages** (reachable via https://raed2180416.github.io/AirMentor/) – Root and `#/admin` resolve to HTML shell
- **Railway backend** (https://api-production-ab72.up.railway.app/) – `/health` endpoint returns `404` (contradiction C-008)
- **Live credential gating**: Closeout scripts require live admin credentials; local environment currently lacks them
- **Network restrictions**: Current native shell cannot refresh Railway evidence due to DNS/network configuration (EBUSY errors)

### Testing Blind Spots

- ✅ Deterministic helpers (calendar, page utils, selectors)
- ✅ Backend route tests, proof model tests
- ✅ Local UI contracts (Vitest + jsdom)
- ⚠️ **Missing**: Cross-role same-student parity, live Pages/Railway auth proof, live proof-artifact freshness, accessibility at production data volume, long-tail frontend interactions (partially mapped)

---

## Common Development Workflows

### Local Development Setup

```bash
# Install dependencies
npm install

# Start backend
npm --workspace air-mentor-api run dev:seeded

# In another terminal, start frontend
npm run dev

# Frontend available at http://localhost:5173
```

### Running Tests

```bash
# Frontend unit tests
npm test

# Backend unit tests
npm --workspace air-mentor-api test

# Full verification suite
npm run verify:proof-closure

# Proof-rc suite (longer, ~420s)
AIRMENTOR_BACKEND_SUITE=proof-rc npm --workspace air-mentor-api test
```

### Database Management

```bash
# Run migrations
npm --workspace air-mentor-api run db:migrate

# Seed database
npm --workspace air-mentor-api run db:seed

# Reset (migrations + seed)
npm --workspace air-mentor-api run dev:seeded
```

### Code Quality

```bash
# Lint all code
npm run lint

# Type check
npm run build  # includes `tsc -b`

# Fix linting issues
npm run lint -- --fix
```

### Audit Map Investigation

```bash
# List active audit jobs
bash audit-map/16-scripts/tmux-list-jobs.sh

# Check specific job status
bash audit-map/16-scripts/tmux-job-status.sh inventory-pass bootstrap

# Tail live job log
bash audit-map/16-scripts/tmux-tail-job-log.sh inventory-pass bootstrap

# Classify a new task  
bash audit-map/16-scripts/task-classify-route.sh my-new-analysis-type
```

---

## Key Files to Know

### Frontend Entry Points
- `src/App.tsx` – Main app shell, theme setup
- `src/portal-entry.tsx` – Portal chooser UI
- `src/portal-routing.ts` – Hash-based router
- `src/academic-workspace-entry.tsx` – Academic portal shell
- `src/system-admin-app.tsx` – Admin portal shell

### Backend Entry Points
- `air-mentor-api/src/index.ts` – Server startup
- `air-mentor-api/src/app.ts` – Fastify app builder
- `air-mentor-api/src/db/schema.ts` – ORM schema (18+ tables)
- `air-mentor-api/src/modules/*` – Domain route registrars

### Proof-Risk Stack
- `src/proof-*.ts` – Frontend runtime (scoring, checkout, playback)
- `air-mentor-api/src/lib/proof-risk-model.js` – Observable scoring + trained inference
- `air-mentor-api/src/lib/proof-observed-state.js` – Row parsing for evidence
- `air-mentor-api/scripts/evaluate-proof-risk-model.ts` – Model evaluation

### Key Utilities
- `src/data.ts` – Domain model (Offering, Student, Faculty, Batch, etc)
- `src/domain.ts` – TypeScript type definitions
- `src/selectors.ts` – Redux-like state selectors
- `src/repositories.ts` – HTTP client + localStorage layer
- `src/calendar-utils.ts` – Calendar math (date parsing, term calculations)
- `src/page-utils.ts` – UI layout utilities (scroll, focus, panel sizes)
- `src/theme.ts` – Theme constants

### Testing & Verification
- `tests/` – Frontend unit tests
- `air-mentor-api/tests/` – Backend unit tests
- `scripts/playwright-*.sh` – Playwright test suites
- `scripts/verify-final-closeout.sh` – Local integration verification
- `scripts/verify-final-closeout-live.sh` – Live integration verification

---

## Contradiction Matrix Quick Reference

Active contradictions (see `audit-map/14-reconciliation/contradiction-matrix.md` for full details):

| ID | Issue | Impact | Status |
|----|----|--------|--------|
| C-006 | Admin request UI missing `Needs Info` / `Rejected` transitions | Backend supports them; UI missing | Open |
| C-008 | Railway `/health` returns 404 instead of 200 | Deployment health check unclear | Open (live-only) |
| C-010 | Missing artifact for C-010 | Resolved in manual rerun | Closed |
| C-011 | Faculties section selector built from students, not canonical labels | Empty sections can disappear from governance UI | Open |
| C-012 | Status file monitor restamps without active tmux | Minor: durable artifacts are authoritative | Minor |

---

## Next Steps for New Agents

1. **Read the governance docs** (first 10 min section above)
2. **Check operator dashboard**: `audit-map/32-reports/operator-dashboard.md`
3. **Check next-steps guide**: `audit-map/32-reports/operator-next-steps.md`
4. **List active jobs**: `bash audit-map/16-scripts/tmux-list-jobs.sh`
5. **Pick a bounded pass** from `audit-map/20-prompts/` and execute via `audit-map/16-scripts/run-audit-pass.sh`
6. **Update memory** in `audit-map/24-agent-memory/working-knowledge.md` before signing off

---

## Related Documentation

- **Tech Stack Guides**: `docs/` and `docs/closeout/` (legacy audit corpus)
- **Workflow Config**: `.github/workflows/` (CI/CD, verification, cadence)
- **Issue Tracking**: `audit-map/14-reconciliation/contradiction-matrix.md` (authoritative blockers)
- **Feature Registry**: `audit-map/15-final-maps/feature-registry.md` (24 feature families)
- **Architecture Maps**: `audit-map/02-architecture/`, `audit-map/06-data-flows/`, `audit-map/07-state-flows/`
- **Testing Coverage**: `audit-map/09-test-audit/`
- **ML Proof Risk**: `audit-map/08-ml-audit/` and `air-mentor-api/src/lib/proof-risk-model.js`
