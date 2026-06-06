# Security & Performance Audit

**Date:** 2026-06-06  
**Scope:** Production deployment risks, performance bottlenecks, security vulnerabilities  
**Method:** Static analysis (codegraph complexity, knip unused code), architecture review, route inspection

---

## 1. Security Risks

### 1.1 HIGH: Python Tree Bridge Command Injection Surface

| Item | Detail |
|------|--------|
| **Location** | `air-mentor-api/src/lib/proof-risk-model.ts:831-869` (`scoreWithTreeBridge`) |
| **Issue** | `spawnSync()` invokes `python3` with model path and calibration JSON from environment variables or input parameters |
| **Risk** | If model path or calibration JSON is attacker-controlled, command injection is possible |
| **Mitigation** | Currently gated by `AIRMENTOR_ENABLE_TREE_BRIDGE_SERVING=1` (default OFF). **Before enabling:** sanitize all paths, validate JSON schema, use `execFile` instead of `spawnSync` with shell, whitelist model directory |
| **Status** | ACCEPTABLE while gated OFF. BLOCKER for production enablement |

### 1.2 HIGH: Admin Routes Lack Granular RBAC

| Item | Detail |
|------|--------|
| **Location** | `air-mentor-api/src/modules/admin-structure.ts` |
| **Issue** | Many admin CRUD endpoints use coarse `requireRole(['SYSTEM_ADMIN'])` without checking institution scope |
| **Risk** | A compromised admin account could mutate any institution's data |
| **Mitigation** | Add institution-scoped middleware: `requireInstitutionScope(request, resourceId)` |
| **Status** | MUST FIX before multi-tenancy |

### 1.3 MEDIUM: Session Cookie Security

| Item | Detail |
|------|--------|
| **Location** | `air-mentor-api/src/modules/support.ts` |
| **Issue** | `sessionCookieSchema` definition; verify `httpOnly`, `secure`, `sameSite` flags at runtime |
| **Risk** | XSS or CSRF if cookie flags are misconfigured |
| **Mitigation** | Audit Fastify session plugin configuration in main server file |
| **Status** | NEEDS VERIFICATION |

### 1.4 MEDIUM: Synthetic Data Leakage Risk

| Item | Detail |
|------|--------|
| **Location** | `air-mentor-api/scripts/generate_v2_data.py`, seeded sandbox |
| **Issue** | Synthetic data generator uses deterministic seeds; if same seeds are used across demo instances, patterns could be reverse-engineered |
| **Risk** | Low — synthetic data contains no real PII, but could reveal model training patterns |
| **Mitigation** | Use cryptographically random seeds for each demo instance; document seed in audit trail |
| **Status** | ACCEPTABLE for demo, not relevant for production |

### 1.5 LOW: Proof Run Recompute Without Authorization Check

| Item | Detail |
|------|--------|
| **Location** | `POST /api/admin/proof-runs/:id/recompute-risk` |
| **Issue** | Verify that recompute endpoints check both admin role AND proof run ownership |
| **Risk** | Denial of service via repeated recomputation |
| **Mitigation** | Add rate limiting and ownership check |
| **Status** | NEEDS VERIFICATION |

---

## 2. Performance Bottlenecks

### 2.1 CRITICAL: `SystemAdminLiveApp` — 1575 Cyclomatic Complexity

| Item | Detail |
|------|--------|
| **File** | `src/system-admin-live-app.tsx` |
| **Issue** | Single component with 1575 complexity. Likely causes: slow render, large bundle size, impossible to optimize |
| **Impact** | Frontend bundle bloat, slow initial render, poor maintainability |
| **Mitigation** | IMMEDIATE: Split into sub-components (one per workspace tab). Use lazy loading. Extract pure functions |
| **Priority** | P0 |

### 2.2 CRITICAL: `buildAcademicBootstrap` — 481 Complexity

| Item | Detail |
|------|--------|
| **File** | `air-mentor-api/src/modules/academic.ts` |
| **Issue** | Batch provisioning does too much in one transaction: creates students, enrollments, offerings, curriculum links, faculty assignments, mentor mappings |
| **Impact** | Request timeout for large batches, database lock contention, impossible to retry partial failures |
| **Mitigation** | Decompose into async job queue (e.g., BullMQ, pg-boss): `batch-provision-initiated` → worker stages → completion webhook |
| **Priority** | P0 |

### 2.3 HIGH: `registerAcademicRuntimeRoutes` — 338 Complexity

| Item | Detail |
|------|--------|
| **File** | `air-mentor-api/src/modules/academic-runtime-routes.ts` |
| **Issue** | All runtime routes (attendance, assessment, scheme, tasks, calendar) in one module |
| **Impact** | Hard to optimize individual routes, all routes share same middleware stack |
| **Mitigation** | Split by domain: `attendance-routes.ts`, `assessment-routes.ts`, `scheme-routes.ts`, `task-routes.ts` |
| **Priority** | P1 |

### 2.4 HIGH: `registerAdminStructureRoutes` — 327 Complexity

| Item | Detail |
|------|--------|
| **File** | `air-mentor-api/src/modules/admin-structure.ts` |
| **Issue** | All admin CRUD in one module |
| **Impact** | Same as above — monolithic route file |
| **Mitigation** | Split by entity: `batch-routes.ts`, `faculty-routes.ts`, `student-routes.ts`, `offering-routes.ts` |
| **Priority** | P1 |

### 2.5 HIGH: Risk Model Feature Building

| Item | Detail |
|------|--------|
| **File** | `air-mentor-api/src/lib/proof-risk-model.ts` |
| **Issue** | `buildObservableFeaturePayload` (49 complexity), `writeFeatureVectorToBuffer` (98 complexity) build feature vectors synchronously on every risk request |
| **Impact** | High CPU per risk request; does not scale to large cohorts |
| **Mitigation** | Cache feature vectors per (student, stage); precompute historical features on transcript update; use worker queue for bulk recomputation |
| **Priority** | P1 |

### 2.6 MEDIUM: Calendar/Timetable Page — 327 Complexity

| Item | Detail |
|------|--------|
| **File** | `src/pages/calendar-pages.tsx` |
| **Issue** | Complex calendar rendering logic |
| **Impact** | Slow re-render on date navigation |
| **Mitigation** | Virtualize large calendars; memoize date computations |
| **Priority** | P2 |

### 2.7 MEDIUM: Obsidian Graph (Curriculum Graph) — 547 Complexity

| Item | Detail |
|------|--------|
| **File** | `src/obsidian-graph.tsx` |
| **Issue** | D3 force simulation + XYFlow rendering for curriculum graph |
| **Impact** | High memory/CPU for large graphs (>50 nodes) |
| **Mitigation** | Limit initial node count; use canvas renderer for large graphs; debounce force simulation |
| **Priority** | P2 |

---

## 3. Scalability Risks

| Risk | Detail | Mitigation |
|------|--------|------------|
| Single-backend deployment | Railway monolith — no horizontal scaling | Containerize; add load balancer; stateless API design |
| Database connection pool | Unknown pool size; could exhaust under load | Configure PgBouncer or similar; monitor active connections |
| ML model loading | Tree bridge loads XGBoost model from disk on EACH call | Load model ONCE at startup; keep in memory |
| Synthetic data generation | `generate_v2_data.py` generates full cohorts in-memory | Stream to disk; process in chunks |
| Proof checkpoint storage | Checkpoints store full student state | Compress; store diffs only; set retention policy |

---

## 4. Deployment Risks

| Risk | Detail | Mitigation |
|------|--------|------------|
| Environment variable drift | `.env` and `.env.example` may diverge | Audit and diff before each deploy |
| Missing model artifacts | Tree bridge fails if artifacts absent | Startup health check validates artifact presence |
| Python venv mismatch | `requirements.txt` pins may not match deployed venv | Use Docker with frozen requirements; CI build test |
| Database migration order | Migrations may have ordering conflicts | Test migrations from clean state in CI |
| Frontend API base URL | `VITE_AIRMENTOR_API_BASE_URL` hardcoded per env | Use runtime config endpoint instead of build-time env |

---

## 5. Action Priority Matrix

| Priority | Action | Owner | Effort | Blocker For |
|----------|--------|-------|--------|-------------|
| P0 | Split `SystemAdminLiveApp` into sub-components | Frontend | 3 days | Scalability |
| P0 | Decompose `buildAcademicBootstrap` into async job queue | Backend | 5 days | Large batch provisioning |
| P0 | Add institution-scoped RBAC middleware | Backend | 2 days | Multi-tenancy |
| P1 | Split route modules by domain | Backend | 3 days | Maintainability |
| P1 | Cache/precompute risk features | Backend | 4 days | Risk API throughput |
| P1 | Harden tree bridge command invocation | Backend | 1 day | ML serving security |
| P2 | Virtualize calendar rendering | Frontend | 2 days | Calendar UX |
| P2 | Optimize curriculum graph for large graphs | Frontend | 3 days | Graph UX |
| P2 | Add runtime config endpoint | Backend | 1 day | Deployment flexibility |
