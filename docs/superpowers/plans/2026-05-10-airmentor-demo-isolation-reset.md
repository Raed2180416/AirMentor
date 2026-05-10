# AirMentor Demo Isolation Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first P5 backend vertical slice: demo workspace registry metadata, schema-scoped demo data-plane lifecycle, and reset proof that global academic/auth/proof rows are not the demo storage plane.

**Architecture:** Keep the global DB as the registry plane. Add schema-scope metadata to `demo_workspaces`, create one PostgreSQL schema per demo workspace, and make reset drop that schema while keeping legacy row-tag cleanup as compatibility only. This plan intentionally stops before frontend/browser and full demo-login routing; those become P5-B after the backend isolation contract is green.

**Tech Stack:** TypeScript, Fastify, Drizzle schema definitions, node-postgres, SQL migrations, Vitest, embedded Postgres test harness.

---

## Scope Boundary

This plan covers **P5-A** only.

Included:

- Registry metadata fields for schema-backed demo workspaces.
- Safe schema name generation and schema lifecycle helpers.
- Backend create/list/reset route behavior for schema-backed demo workspaces.
- Tests proving schema exists after create and is gone after reset.
- Tests proving global counts remain stable and existing row-tag cleanup still works for legacy rows.
- Type updates for API payloads.

Deferred to P5-B:

- Demo-scoped teacher login/session routing.
- Full mock academic/proof seed inside demo schema.
- Frontend pointer-only storage and reset UI.
- Browser proof `demo-isolation-reset.spec.ts`.
- Capability matrix promotion beyond backend partial.

---

## File Structure

- Modify: `air-mentor-api/src/db/migrations/0024_demo_workspace_scope.sql`
  - Adds schema-scope registry columns to `demo_workspaces`.
- Modify: `air-mentor-api/src/db/schema.ts`
  - Adds Drizzle fields for the new registry columns.
- Create: `air-mentor-api/src/lib/demo-workspace-scope.ts`
  - Owns safe schema naming, identifier quoting, create/drop/existence helpers, and metadata parsing.
- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
  - Creates schema-backed workspace rows and drops schema on reset before compatibility row-tag cleanup.
- Modify: `air-mentor-api/src/modules/admin-demo-workspace.ts`
  - Passes system-admin faculty ID and optional source batch into create.
- Modify: `air-mentor-api/tests/demo-isolation.test.ts`
  - Adds RED/GREEN schema-scope lifecycle tests and keeps legacy row-tag cleanup coverage.
- Modify: `src/api/types.ts`
  - Adds frontend type fields returned by `ApiDemoWorkspace`.

---

## Task 1: Registry Schema Contract

**Files:**

- Create: `air-mentor-api/src/db/migrations/0024_demo_workspace_scope.sql`
- Modify: `air-mentor-api/src/db/schema.ts`
- Test: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Add failing registry metadata assertion**

Append this test inside `describe('demo workspace isolation', () => { ... })` in `air-mentor-api/tests/demo-isolation.test.ts`:

```ts
  it('creates demo workspaces with schema-scope registry metadata', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Schema Scope Demo', batchId: 'batch_branch_mnc_btech_2023' },
    })
    expect(createRes.statusCode).toBe(200)
    const body = createRes.json() as {
      demoWorkspaceId: string
      scopeKind?: string | null
      scopeName?: string | null
      sourceBatchId?: string | null
      metadataJson?: string | null
    }
    expect(body.scopeKind).toBe('schema')
    expect(body.scopeName).toMatch(/^demo_ws_[a-z0-9_]+$/)
    expect(body.sourceBatchId).toBe('batch_branch_mnc_btech_2023')

    const [row] = await current.db
      .select()
      .from(demoWorkspaces)
      .where(eq(demoWorkspaces.demoWorkspaceId, body.demoWorkspaceId))
    expect(row.scopeKind).toBe('schema')
    expect(row.scopeName).toBe(body.scopeName)
    expect(row.sourceBatchId).toBe('batch_branch_mnc_btech_2023')
    expect(row.createdByFacultyId).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify RED**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "schema-scope registry metadata"
```

Expected: TypeScript/runtime failure because `scopeKind`, `scopeName`, `sourceBatchId`, and `createdByFacultyId` are not in the schema/response yet.

- [ ] **Step 3: Add migration file**

Create `air-mentor-api/src/db/migrations/0024_demo_workspace_scope.sql`:

```sql
ALTER TABLE demo_workspaces ADD COLUMN scope_kind TEXT NOT NULL DEFAULT 'row_tag';
ALTER TABLE demo_workspaces ADD COLUMN scope_name TEXT;
ALTER TABLE demo_workspaces ADD COLUMN source_batch_id TEXT REFERENCES batches(batch_id);
ALTER TABLE demo_workspaces ADD COLUMN active_simulation_run_id TEXT;
ALTER TABLE demo_workspaces ADD COLUMN created_by_faculty_id TEXT;
ALTER TABLE demo_workspaces ADD COLUMN stopped_at TEXT;
ALTER TABLE demo_workspaces ADD COLUMN reset_at TEXT;
ALTER TABLE demo_workspaces ADD COLUMN metadata_json TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS demo_workspaces_scope_name_unique ON demo_workspaces(scope_name) WHERE scope_name IS NOT NULL;
```

- [ ] **Step 4: Update Drizzle schema**

In `air-mentor-api/src/db/schema.ts`, replace the `demoWorkspaces` table definition with:

```ts
export const demoWorkspaces = pgTable('demo_workspaces', {
  demoWorkspaceId: text('demo_workspace_id').primaryKey(),
  name: text('name').notNull(),
  ownerFacultyId: text('owner_faculty_id'),
  batchId: text('batch_id').references(() => batches.batchId),
  scopeKind: text('scope_kind').notNull().default('row_tag'),
  scopeName: text('scope_name'),
  sourceBatchId: text('source_batch_id').references(() => batches.batchId),
  activeSimulationRunId: text('active_simulation_run_id'),
  createdByFacultyId: text('created_by_faculty_id'),
  stoppedAt: text('stopped_at'),
  resetAt: text('reset_at'),
  metadataJson: text('metadata_json'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

- [ ] **Step 5: Update API type**

In `src/api/types.ts`, replace `ApiDemoWorkspace` with:

```ts
export type ApiDemoWorkspace = {
  demoWorkspaceId: string
  name: string
  ownerFacultyId: string | null
  batchId: string | null
  scopeKind: string
  scopeName: string | null
  sourceBatchId: string | null
  activeSimulationRunId: string | null
  createdByFacultyId: string | null
  stoppedAt: string | null
  resetAt: string | null
  metadataJson: string | null
  status: string
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 6: Run focused test again**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "schema-scope registry metadata"
```

Expected: still fails because service does not populate schema-scope fields yet.

---

## Task 2: Schema Scope Helper

**Files:**

- Create: `air-mentor-api/src/lib/demo-workspace-scope.ts`
- Test: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Add helper behavior assertions**

Append this import near the top of `air-mentor-api/tests/demo-isolation.test.ts`:

```ts
import {
  buildDemoScopeName,
  demoWorkspaceSchemaExists,
  assertSafeDemoScopeName,
} from '../src/lib/demo-workspace-scope.js'
```

Append this test inside the describe block:

```ts
  it('builds safe demo schema names and rejects unsafe identifiers', async () => {
    expect(buildDemoScopeName('demo_ws_abc123')).toBe('demo_ws_demo_ws_abc123')
    expect(buildDemoScopeName('demo-ws-ABC.123')).toBe('demo_ws_demo_ws_abc_123')
    expect(() => assertSafeDemoScopeName('demo_ws_good_123')).not.toThrow()
    expect(() => assertSafeDemoScopeName('public')).toThrow(/Unsafe demo scope name/)
    expect(() => assertSafeDemoScopeName('demo_ws_bad;drop')).toThrow(/Unsafe demo scope name/)
  })
```

- [ ] **Step 2: Run helper test to verify RED**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "safe demo schema names"
```

Expected: fails because `demo-workspace-scope.js` does not exist.

- [ ] **Step 3: Create helper file**

Create `air-mentor-api/src/lib/demo-workspace-scope.ts`:

```ts
import type { Pool } from 'pg'

export function buildDemoScopeName(demoWorkspaceId: string) {
  const normalized = demoWorkspaceId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return `demo_ws_${normalized || 'workspace'}`
}

export function assertSafeDemoScopeName(scopeName: string) {
  if (!/^demo_ws_[a-z0-9_]+$/.test(scopeName)) {
    throw new Error(`Unsafe demo scope name: ${scopeName}`)
  }
  return scopeName
}

export function quotePgIdentifier(identifier: string) {
  const safe = assertSafeDemoScopeName(identifier)
  return `"${safe.replace(/"/g, '""')}"`
}

export async function createDemoWorkspaceSchema(pool: Pick<Pool, 'query'>, scopeName: string) {
  const quoted = quotePgIdentifier(scopeName)
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoted}`)
  return { scopeName }
}

export async function dropDemoWorkspaceSchema(pool: Pick<Pool, 'query'>, scopeName: string) {
  const quoted = quotePgIdentifier(scopeName)
  await pool.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)
  return { scopeName }
}

export async function demoWorkspaceSchemaExists(pool: Pick<Pool, 'query'>, scopeName: string) {
  assertSafeDemoScopeName(scopeName)
  const result = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1', [scopeName])
  return (result.rows?.length ?? 0) > 0
}
```

- [ ] **Step 4: Run helper test to verify GREEN**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "safe demo schema names"
```

Expected: one selected test passes.

---

## Task 3: Create Schema-Backed Demo Workspace

**Files:**

- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
- Modify: `air-mentor-api/src/modules/admin-demo-workspace.ts`
- Test: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Add schema existence assertion to registry test**

In the `schema-scope registry metadata` test, after the DB row assertions add:

```ts
    expect(await demoWorkspaceSchemaExists(current.pool, body.scopeName ?? '')).toBe(true)
```

- [ ] **Step 2: Update route to pass actor**

In `air-mentor-api/src/modules/admin-demo-workspace.ts`, change the POST handler body from:

```ts
    requireRole(request, ['SYSTEM_ADMIN'])
```

to:

```ts
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
```

and change the return call to:

```ts
    return createDemoWorkspace(context, {
      ...body,
      createdByFacultyId: auth.facultyId ?? null,
    })
```

- [ ] **Step 3: Update service imports**

In `air-mentor-api/src/lib/demo-workspace-service.ts`, add imports:

```ts
import { stringifyJson } from './json.js'
import {
  buildDemoScopeName,
  createDemoWorkspaceSchema,
  dropDemoWorkspaceSchema,
} from './demo-workspace-scope.js'
```

- [ ] **Step 4: Update create input type**

In `createDemoWorkspace` input type add:

```ts
    createdByFacultyId?: string | null
```

- [ ] **Step 5: Update createDemoWorkspace implementation**

Replace the row construction in `createDemoWorkspace` with:

```ts
  const scopeName = buildDemoScopeName(demoWorkspaceId)
  const metadata = {
    storageMode: 'schema',
    sourceBatchId: input.batchId ?? null,
    provisionedCounts: {
      students: 0,
      offerings: 0,
      runs: 0,
    },
  }
  const row: typeof demoWorkspaces.$inferInsert = {
    demoWorkspaceId,
    name: input.name,
    ownerFacultyId: input.ownerFacultyId ?? null,
    batchId: input.batchId ?? null,
    scopeKind: 'schema',
    scopeName,
    sourceBatchId: input.batchId ?? null,
    activeSimulationRunId: null,
    createdByFacultyId: input.createdByFacultyId ?? null,
    stoppedAt: null,
    resetAt: null,
    metadataJson: stringifyJson(metadata),
    status: 'provisioning',
    createdAt: now,
    updatedAt: now,
  }
  await context.db.insert(demoWorkspaces).values(row)
  await createDemoWorkspaceSchema(context.pool, scopeName)
  await context.db.update(demoWorkspaces).set({
    status: 'active',
    updatedAt: now,
  }).where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  const [created] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  if (!created) throw new Error(`Demo workspace ${demoWorkspaceId} was not created`)
  return created
```

- [ ] **Step 6: Run registry/schema test**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "schema-scope registry metadata"
```

Expected: selected test passes.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add air-mentor-api/src/db/migrations/0024_demo_workspace_scope.sql air-mentor-api/src/db/schema.ts air-mentor-api/src/lib/demo-workspace-scope.ts air-mentor-api/src/lib/demo-workspace-service.ts air-mentor-api/src/modules/admin-demo-workspace.ts air-mentor-api/tests/demo-isolation.test.ts src/api/types.ts
git commit -m "feat: register schema-scoped demo workspaces"
```

---

## Task 4: Reset Drops Schema And Keeps Legacy Cleanup

**Files:**

- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
- Modify: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Add reset schema-drop test**

Append this test inside the describe block:

```ts
  it('drops the demo schema on reset while preserving global rows', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const baseStudents = await current.db.select().from(students)
    const baseOfferings = await current.db.select().from(sectionOfferings)
    const baseRuns = await current.db.select().from(simulationRuns)

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Reset Schema Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string; scopeName: string | null }
    expect(demoWs.scopeName).toBeTruthy()
    expect(await demoWorkspaceSchemaExists(current.pool, demoWs.scopeName ?? '')).toBe(true)

    await current.pool.query(`CREATE TABLE "${demoWs.scopeName}".demo_marker (id TEXT PRIMARY KEY)`)
    await current.pool.query(`INSERT INTO "${demoWs.scopeName}".demo_marker (id) VALUES ('marker_1')`)

    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    const resetBody = resetRes.json() as { deletedSchema?: boolean; scopeName?: string | null }
    expect(resetBody.deletedSchema).toBe(true)
    expect(resetBody.scopeName).toBe(demoWs.scopeName)
    expect(await demoWorkspaceSchemaExists(current.pool, demoWs.scopeName ?? '')).toBe(false)

    expect((await current.db.select().from(students)).length).toBe(baseStudents.length)
    expect((await current.db.select().from(sectionOfferings)).length).toBe(baseOfferings.length)
    expect((await current.db.select().from(simulationRuns)).length).toBe(baseRuns.length)
  })
```

- [ ] **Step 2: Run reset schema-drop test to verify RED**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot -t "drops the demo schema"
```

Expected: fails because reset response does not include `deletedSchema` and reset may not drop the schema.

- [ ] **Step 3: Update reset return type**

In `resetDemoWorkspace` return type add:

```ts
  deletedSchema: boolean
  scopeName: string | null
```

- [ ] **Step 4: Drop schema before legacy cleanup**

In `resetDemoWorkspace`, after the `demoWs` not-found check, add:

```ts
  let deletedSchema = false
  if (demoWs.scopeKind === 'schema' && demoWs.scopeName) {
    await dropDemoWorkspaceSchema(context.pool, demoWs.scopeName)
    deletedSchema = true
  }
```

- [ ] **Step 5: Return schema reset fields**

At the return object, add:

```ts
    deletedSchema,
    scopeName: demoWs.scopeName ?? null,
```

- [ ] **Step 6: Update frontend reset return type**

In `src/api/client.ts`, change reset return type to:

```ts
    return this.request<{ deletedStudents: number; deletedOfferings: number; deletedRuns: number; deletedSchema?: boolean; scopeName?: string | null }>(
```

- [ ] **Step 7: Run demo-isolation tests**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000
```

Expected: all demo-isolation tests pass.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add air-mentor-api/src/lib/demo-workspace-service.ts air-mentor-api/tests/demo-isolation.test.ts src/api/client.ts
git commit -m "feat: reset schema-scoped demo workspaces"
```

---

## Task 5: Verification And Handoff

**Files:**

- Read: `docs/CAPABILITY_MATRIX.md`
- Read: `audit-map/32-reports/proof-realism-audit-2026-05-10.md`

- [ ] **Step 1: Run targeted backend tests**

Run from `air-mentor-api/`:

```bash
npx vitest run tests/demo-isolation.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000
```

Expected: both files pass.

- [ ] **Step 2: Run typechecks**

Run:

```bash
npx tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
npx tsc -p tsconfig.tests.json --noEmit --pretty false
```

Expected: no TypeScript errors.

- [ ] **Step 3: Review status and diff**

Run:

```bash
git status --short
git log --oneline --decorate --max-count=8
```

Expected: working tree clean; latest commits are the P5-A implementation commits.

- [ ] **Step 4: Report P5-A boundary**

Final response must state:

```text
P5-A backend schema-scope contract is complete. Full P5 is not complete until P5-B adds demo-scoped auth/session routing, frontend pointer-only storage, browser proof, and capability matrix updates.
```
