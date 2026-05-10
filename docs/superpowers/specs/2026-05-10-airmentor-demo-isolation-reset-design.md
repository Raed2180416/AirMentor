# AirMentor Demo Isolation And Reset Design — 2026-05-10

## Intent

Close P5 by making demo runs disposable and isolated from real/global academic data, auth state, proof runs, credentials, sessions, and browser state.

Current code has a useful scaffold: `demo_workspaces`, `demoWorkspaceId` columns, admin routes, and `demo-isolation.test.ts`. That scaffold is not enough for the selected isolation model because it deletes tagged rows from the same database and covers only a subset of data. The selected boundary is stronger: each demo workspace uses an isolated temporary database/schema scope, while the global database stores only the workspace registry and pointer metadata.

## Feature Intent

A system admin can create, play, stop, and reset a demo for an evaluator. Course Leader, Mentor, and HoD demo credentials work only inside that demo scope. When the demo ends, demo data, credentials, and sessions disappear. Real/global sysadmin and teacher portfolios remain unchanged.

Evaluator-visible behavior:

- System admin creates a demo workspace and sees a demo pointer/status.
- Demo credentials log into demo-scoped academic/proof data.
- Browser local storage keeps only the active demo pointer/playback selection.
- Reset/stop removes the isolated demo scope and clears demo pointer state.
- Real/global teacher login and data still work after demo reset.

## Current Context

Existing files:

- `air-mentor-api/src/db/migrations/0023_demo_workspaces.sql`
  - Adds `demo_workspaces` and some `demo_workspace_id` columns.
- `air-mentor-api/src/lib/demo-workspace-service.ts`
  - Creates/lists workspaces, previews provisioning, resets tagged rows.
- `air-mentor-api/src/modules/admin-demo-workspace.ts`
  - Exposes list/create/preview/delete routes.
- `air-mentor-api/tests/demo-isolation.test.ts`
  - Proves tagged rows can be deleted without touching base counts.
- `src/api/client.ts` and `src/api/types.ts`
  - Frontend client/types for demo workspace APIs.
- `src/demo-workspace-badge.tsx`
  - UI badge scaffold.

Observed gap:

- Current isolation is row-tag cleanup in the global DB, not a temporary DB/schema scope.
- Auth rows, sessions, credentials, proof checkpoint artifacts, agent cards/messages, queue projections, telemetry, and several proof data tables are not fully covered by reset.
- Routes use one global `context.db`; there is no demo-scoped DB resolver.
- Browser storage contract is not enforced by tests.

## Approach Options

### Option A: Keep row-tag cleanup and expand table coverage

Add `demoWorkspaceId` to more tables and extend reset cascade.

Pros:

- Smallest implementation.
- Fits current code.
- Fast to test.

Cons:

- Not the selected user decision.
- Easy to miss tables.
- Demo credentials/sessions still risk global collision.
- Does not prove strong isolation to a college evaluator.

### Option B: Separate PostgreSQL schema per demo workspace

Keep one physical database. Create one schema per demo workspace, migrate/seed it, and route demo requests to that schema using a scoped `AppDb`/pool connection with `search_path`.

Pros:

- Matches selected isolation intent.
- Cheap locally and on hosted Postgres.
- Global registry remains simple.
- Reset can drop one schema and invalidate scoped sessions.

Cons:

- Requires careful DB connection scoping.
- Drizzle table definitions are global, so route code needs a controlled schema/search-path seam.
- Worker and auth resolution must be demo-aware.

### Option C: Separate physical temporary database per demo workspace

Create a new database per demo workspace, migrate/seed it, and route demo requests to a separate pool.

Pros:

- Strongest isolation.
- Drop database is a clean reset.

Cons:

- Requires database-create privileges not always available.
- Heavier operational model.
- Harder for local tests and future Render/Railway posture.

## Recommendation

Use **Option B: schema-per-demo**, with a design that can later swap to physical DB-per-demo if hosting allows.

Reason: it satisfies the selected Option C boundary at the data-plane level without requiring database-create privileges. The global database stores only the workspace registry and routing metadata. Demo academic/proof/auth data lives in the demo schema. Reset drops the schema and registry pointer.

## Scope

In scope for P5:

1. Demo workspace registry metadata.
2. Demo schema lifecycle: create, migrate/clone seed, activate, stop/reset/drop.
3. Demo-scoped auth/session/credential handling.
4. Demo-scoped proof run creation, playback, stop, and reset.
5. Browser pointer-only storage contract.
6. API and browser tests proving global rows untouched.
7. Capability matrix update for P5 rows only when verified.

Out of scope:

- P6 multi-program template.
- P7 recalibration/model governance.
- P8 deployment closeout.
- P9 full performance pack.
- Real institutional data validation.
- Production ML claims.

## Architecture

### Registry Plane

Global DB keeps `demo_workspaces` as the only durable global demo table.

Add fields through a migration:

- `scope_kind`: `schema` for P5.
- `scope_name`: generated schema name such as `demo_ws_<safe_id>`.
- `source_batch_id`: canonical source batch copied into the demo scope.
- `active_simulation_run_id`: nullable pointer for UI restore.
- `created_by_faculty_id`: system admin actor.
- `stopped_at`: nullable timestamp.
- `reset_at`: nullable timestamp.
- `status`: `provisioning`, `active`, `stopped`, `reset_failed`, `deleted`.
- `metadata_json`: summary counts, seed, and public non-secret routing info.

### Demo Data Plane

Each demo workspace schema contains its own copy of all tables needed for the demo:

- auth tables: users, credentials, sessions, role grants, faculty profiles, preferences,
- academic tables: curriculum, faculty, students, enrollments, offerings, ownerships, attendance, marks, mentor assignments,
- proof tables: runs, queue, checkpoints, projections, risk rows, reset snapshots, generated credentials,
- operational tables that the demo flow writes to.

The demo schema is seeded from the canonical proof/demo seed path. It must not share mutable academic rows with global scope.

### Request Scope

Introduce a small routing seam:

- `resolveDemoScope(request)` reads a trusted demo pointer from one of:
  - explicit admin route parameter,
  - demo session metadata,
  - demo header used only by tests/internal client,
  - active demo pointer endpoint.
- `getScopedContext(context, scope)` returns either:
  - global context for real users,
  - demo context whose DB connection has the demo schema search path.

Only routes that are demo-aware use the scoped context. Global system-admin registry routes always use the global context.

### Auth And Sessions

Demo credentials are created inside the demo schema. Demo sessions are also stored in the demo schema and marked with the demo workspace ID in response payloads.

Stop/reset behavior:

- delete/invalidate demo sessions,
- delete demo credentials by dropping schema,
- clear active run pointer in registry,
- leave global sysadmin session untouched.

Global sysadmin remains authenticated through the global DB. Demo teacher logins must fail after reset.

### Browser Storage

Browser local storage may store only:

- `activeDemoWorkspaceId`,
- selected checkpoint/playback ID,
- demo UI selection/status.

It must not store generated credentials, student rows, marks, attendance, faculty rosters, or proof data.

### Reset Semantics

`DELETE /api/admin/demo-workspaces/:demoWorkspaceId` becomes a schema reset:

1. Validate system admin in global scope.
2. Resolve registry row.
3. Invalidate/drop demo schema resources.
4. Mark registry as deleted or delete registry row after audit summary is recorded.
5. Return counts from recorded metadata and reset operation.

If schema drop fails, mark `reset_failed` and return a typed error instead of claiming reset.

## Data Flow

1. System admin creates demo workspace.
2. Backend creates registry row with `status=provisioning`.
3. Backend creates demo schema and applies migrations/schema setup.
4. Backend seeds complete mock academic/proof/auth data into demo schema.
5. Backend marks registry `active` with summary counts and active run pointer.
6. Frontend stores only the demo workspace pointer.
7. Demo users authenticate against the demo schema and operate proof/academic surfaces.
8. Stop/reset invalidates demo sessions and drops demo schema.
9. Frontend clears pointer and returns to global mode.
10. Global sysadmin/teacher data is rechecked unchanged.

## Error Handling

Typed failures:

- `DEMO_WORKSPACE_NOT_FOUND` when registry row is missing.
- `DEMO_WORKSPACE_NOT_ACTIVE` when trying to use a stopped/deleted demo.
- `DEMO_SCOPE_PROVISIONING` when the schema is still being created.
- `DEMO_SCOPE_RESET_FAILED` when schema cleanup fails.
- `DEMO_SCOPE_UNAVAILABLE` when scoped DB connection cannot be created.

No generic `Unexpected server error` should be shown for expected lifecycle states.

## Testing Strategy

### Backend RED/GREEN Tests

Add/extend `air-mentor-api/tests/demo-isolation.test.ts`:

1. Create demo workspace creates registry metadata and isolated scope.
2. Demo provisioning creates demo users/students/offers/runs in demo scope, not global tables.
3. Demo teacher login works before reset and fails after reset.
4. Global sysadmin session remains valid after demo reset.
5. Global teacher portfolio counts remain unchanged after create/play/reset.
6. Reset removes the demo scope and does not rely on row-tag deletion.
7. Preview remains dry-run and writes no demo/global rows.

### Browser Test

Add focused Playwright spec `tests-e2e/specs/demo-isolation-reset.spec.ts`:

Role/scenario:

- Average system admin creates demo workspace.
- Evaluator sees demo badge/status.
- Course Leader demo credential logs in and sees scoped proof summary.
- Reset demo clears pointer.
- Same demo credential no longer logs in.
- Real/global sysadmin or real teacher login still works.
- Browser local storage is inspected to ensure only pointer/status/playback selection keys exist for demo.

### Verification Commands

Targeted backend:

```bash
npx vitest run tests/demo-isolation.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000
```

Typechecks:

```bash
npx tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
npx tsc -p tsconfig.tests.json --noEmit --pretty false
```

Focused browser, if local servers are available:

```bash
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/demo-isolation-reset.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/demo-isolation-reset
```

## Incremental Implementation Lanes

### Lane 1: Registry contract and tests

Add schema metadata fields and tests that prove the registry records a schema scope, not row-tag-only cleanup.

### Lane 2: Scoped DB provider

Add a small service for creating scoped DB contexts. Keep it isolated and testable.

### Lane 3: Demo provision/reset service

Create/drop schema, apply schema setup, seed demo data, and return summary counts. Keep global registry writes separate from demo data writes.

### Lane 4: Auth/session isolation

Route demo login/session restore through demo scope. Prove demo credentials die with reset and global sessions survive.

### Lane 5: Frontend pointer and reset UI

Wire pointer-only local storage, demo badge/status, reset action, and no-secret storage guard.

### Lane 6: Browser proof and matrix update

Run evaluator-visible browser proof. Update `docs/CAPABILITY_MATRIX.md` only after backend/browser evidence passes.

## Risks

- Drizzle schema/search-path support may be awkward with pooled connections. Mitigation: isolate this in one scoped DB provider and use transactions or dedicated client checkout when setting `search_path`.
- Schema creation may be slow in tests. Mitigation: keep first test focused and use seeded summaries where full proof run is too heavy.
- Existing row-tag scaffold may tempt partial closure. Mitigation: keep row tags only as compatibility metadata; acceptance requires isolated demo scope.
- Browser servers may not be running. Mitigation: backend/API proof is mandatory; browser rerun is fresh only when local server pair exists.

## Acceptance Criteria

P5 is complete only when:

1. Demo workspace data-plane is isolated in a demo scope separate from global academic/auth/proof rows.
2. Reset/stop removes demo data, credentials, and demo sessions.
3. Global sysadmin session survives demo reset.
4. Demo teacher login fails after reset.
5. Global teacher/sysadmin data remains unchanged across create/play/reset.
6. Browser stores only demo pointer/status/playback selection.
7. `docs/CAPABILITY_MATRIX.md` moves P5 rows only as far as evidence proves.

## Non-Claims

This design does not claim:

- multi-program generalization,
- production deployment readiness,
- real-data validation,
- production ML accuracy,
- full regression/performance coverage.
