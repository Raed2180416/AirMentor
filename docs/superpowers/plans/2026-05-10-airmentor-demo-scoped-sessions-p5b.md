# AirMentor P5-B Demo Scoped Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the P5-B vertical slice for demo-scoped session binding, frontend pointer-only storage, reset session invalidation, and capability-matrix evidence without claiming full demo schema data-plane routing.

**Architecture:** Keep global DB as the registry/auth source for this slice. Add a nullable demo workspace binding to sessions, validate `X-AirMentor-Demo-Workspace` against active schema-backed workspace rows, require matching pointer for demo-bound session restore, and delete demo-bound sessions during reset. Frontend stores only `{ demoWorkspaceId }` and the API client injects the demo header when that pointer exists.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL SQL migrations, Vitest, React/browser storage tests, existing AirMentor API client.

---

## Scope Boundary

This plan covers P5-B only.

Included:

- Backend session binding to an active demo workspace pointer.
- Restore failure when a demo-bound session omits or changes pointer.
- Reset deletion of demo-bound sessions.
- Frontend pointer store and API client header injection.
- Capability matrix updates limited to verified claims.

Deferred:

- Full per-demo schema search-path routing for all academic/proof tables.
- Full seeded demo credentials inside a demo schema.
- Multi-program template switching.
- Deployment or production-readiness claims.

---

## File Structure

- Create: `air-mentor-api/src/db/migrations/0025_demo_session_scope.sql`
  - Adds `sessions.demo_workspace_id` plus an index for reset deletion.
- Modify: `air-mentor-api/src/db/schema.ts`
  - Adds `demoWorkspaceId` to the `sessions` Drizzle table.
- Create: `air-mentor-api/src/lib/demo-workspace-session-scope.ts`
  - Reads the `X-AirMentor-Demo-Workspace` header and validates active schema-backed workspaces.
- Modify: `air-mentor-api/src/types/fastify.d.ts`
  - Adds `demoWorkspaceId` to request auth payload.
- Modify: `air-mentor-api/src/modules/support.ts`
  - Resolves session auth with optional demo pointer matching.
- Modify: `air-mentor-api/src/modules/session.ts`
  - Binds login sessions to validated demo pointer and includes `demoWorkspaceId` in session payload.
- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
  - Deletes demo-bound sessions during reset and returns `deletedSessions`.
- Modify: `air-mentor-api/tests/demo-isolation.test.ts`
  - Adds API tests for demo session binding, pointer mismatch rejection, global restore preservation, and reset session deletion.
- Modify: `src/api/types.ts`
  - Adds `demoWorkspaceId` to `ApiSessionResponse`.
- Create: `src/demo-workspace-pointer.ts`
  - Owns pointer-only browser storage for active demo workspace ID.
- Modify: `src/api/client.ts`
  - Accepts an optional demo pointer provider and injects `X-AirMentor-Demo-Workspace` on requests.
- Modify: `tests/api-client.test.ts`
  - Proves header injection happens only with a valid pointer.
- Create: `tests/demo-workspace-pointer.test.ts`
  - Proves browser storage contains only the pointer and can be cleared.
- Modify: `docs/CAPABILITY_MATRIX.md`
  - Promotes only verified P5 session/reset/isolation claims.

---

## Task 1: Backend RED Test For Demo Session Pointer Binding

**Files:**

- Modify: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Add imports to the existing test**

Add `sessions` to the schema import list:

```ts
import {
  students,
  sectionOfferings,
  simulationRuns,
  demoWorkspaces,
  batches,
  sessions,
} from '../src/db/schema.js'
```

- [ ] **Step 2: Add the failing demo session test**

Append this test inside `describe('demo workspace isolation', () => { ... })`:

```ts
  it('binds demo sessions to the active demo workspace pointer and rejects pointer drift', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Session Scope Demo' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoLoginRes = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'sysadmin', password: 'admin1234' },
    })
    expect(demoLoginRes.statusCode).toBe(200)
    const demoLoginBody = demoLoginRes.json() as { sessionId: string; demoWorkspaceId?: string | null }
    expect(demoLoginBody.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const demoCookie = Array.isArray(demoLoginRes.headers['set-cookie'])
      ? demoLoginRes.headers['set-cookie'][0]
      : demoLoginRes.headers['set-cookie']
    expect(demoCookie).toBeTruthy()

    const [sessionRow] = await current.db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, demoLoginBody.sessionId))
    expect(sessionRow.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const restoreWithPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoCookie,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(restoreWithPointer.statusCode).toBe(200)
    expect((restoreWithPointer.json() as { demoWorkspaceId?: string | null }).demoWorkspaceId).toBe(demoWs.demoWorkspaceId)

    const restoreWithoutPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: demoCookie },
    })
    expect(restoreWithoutPointer.statusCode).toBe(401)

    const otherCreateRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Other Session Scope Demo' },
    })
    expect(otherCreateRes.statusCode).toBe(200)
    const otherWs = otherCreateRes.json() as { demoWorkspaceId: string }

    const restoreWithWrongPointer = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoCookie,
        'x-airmentor-demo-workspace': otherWs.demoWorkspaceId,
      },
    })
    expect(restoreWithWrongPointer.statusCode).toBe(401)

    const globalRestore = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: adminLogin.cookie },
    })
    expect(globalRestore.statusCode).toBe(200)
    expect((globalRestore.json() as { demoWorkspaceId?: string | null }).demoWorkspaceId).toBeNull()
  })
```

- [ ] **Step 3: Run test to verify RED**

Run from `air-mentor-api/`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot -t "binds demo sessions" --testTimeout=300000
```

Expected: fail because `sessions.demoWorkspaceId` and payload `demoWorkspaceId` do not exist yet.

---

## Task 2: Backend Migration, Schema, And Session Scope Helper

**Files:**

- Create: `air-mentor-api/src/db/migrations/0025_demo_session_scope.sql`
- Modify: `air-mentor-api/src/db/schema.ts`
- Create: `air-mentor-api/src/lib/demo-workspace-session-scope.ts`

- [ ] **Step 1: Add migration**

Create `air-mentor-api/src/db/migrations/0025_demo_session_scope.sql`:

```sql
ALTER TABLE sessions ADD COLUMN demo_workspace_id TEXT REFERENCES demo_workspaces(demo_workspace_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS sessions_demo_workspace_id_idx ON sessions(demo_workspace_id) WHERE demo_workspace_id IS NOT NULL;
```

- [ ] **Step 2: Update Drizzle sessions table**

In `air-mentor-api/src/db/schema.ts`, change the `sessions` table to include `demoWorkspaceId` after `activeRoleGrantId`:

```ts
export const sessions = pgTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  userId: text('user_id').notNull().references(() => userAccounts.userId),
  activeRoleGrantId: text('active_role_grant_id'),
  demoWorkspaceId: text('demo_workspace_id').references(() => demoWorkspaces.demoWorkspaceId),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
})
```

- [ ] **Step 3: Add helper module**

Create `air-mentor-api/src/lib/demo-workspace-session-scope.ts`:

```ts
import { eq } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import type { RouteContext } from '../app.js'
import { demoWorkspaces } from '../db/schema.js'
import { badRequest, unauthorized } from './http-errors.js'
import { assertSafeDemoScopeName } from './demo-workspace-scope.js'

export const DEMO_WORKSPACE_HEADER = 'x-airmentor-demo-workspace'

function readSingleHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export function readDemoWorkspaceHeader(request: FastifyRequest) {
  const value = readSingleHeaderValue(request.headers[DEMO_WORKSPACE_HEADER])
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export async function resolveActiveDemoWorkspaceForRequest(
  context: RouteContext,
  request: FastifyRequest,
) {
  const demoWorkspaceId = readDemoWorkspaceHeader(request)
  if (!demoWorkspaceId) return null

  const [workspace] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))

  if (!workspace) throw unauthorized('Demo workspace is not available')
  if (workspace.status !== 'active') throw unauthorized('Demo workspace is not active')
  if (workspace.scopeKind !== 'schema' || !workspace.scopeName) {
    throw badRequest('Demo workspace is not schema scoped')
  }
  assertSafeDemoScopeName(workspace.scopeName)

  return workspace
}

export function assertSessionMatchesDemoPointer(input: {
  sessionDemoWorkspaceId: string | null
  requestedDemoWorkspaceId: string | null
}) {
  if (!input.sessionDemoWorkspaceId) return
  if (input.sessionDemoWorkspaceId !== input.requestedDemoWorkspaceId) {
    throw unauthorized('Demo session requires its active demo workspace pointer')
  }
}
```

- [ ] **Step 4: Run the focused test again**

Run from `air-mentor-api/`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot -t "binds demo sessions" --testTimeout=300000
```

Expected: still fail because session routes and auth resolver are not wired yet.

---

## Task 3: Wire Backend Session Login/Restore And Reset

**Files:**

- Modify: `air-mentor-api/src/types/fastify.d.ts`
- Modify: `air-mentor-api/src/modules/support.ts`
- Modify: `air-mentor-api/src/modules/session.ts`
- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`

- [ ] **Step 1: Extend auth type**

In `air-mentor-api/src/types/fastify.d.ts`, add:

```ts
  demoWorkspaceId: string | null
```

inside the `RequestAuth` type.

- [ ] **Step 2: Update support auth resolver**

Change `resolveRequestAuth` signature to:

```ts
export async function resolveRequestAuth(
  context: RouteContext,
  sessionId: string | undefined,
  requestedDemoWorkspaceId: string | null = null,
) {
```

After loading `session`, add:

```ts
  if (session.demoWorkspaceId && session.demoWorkspaceId !== requestedDemoWorkspaceId) return null
```

Add `demoWorkspaceId: session.demoWorkspaceId ?? null` to the returned auth object.

- [ ] **Step 3: Update session route imports**

Add imports in `air-mentor-api/src/modules/session.ts`:

```ts
import { readDemoWorkspaceHeader, resolveActiveDemoWorkspaceForRequest } from '../lib/demo-workspace-session-scope.js'
```

- [ ] **Step 4: Wire preHandler pointer resolution**

Change the preHandler to:

```ts
  app.addHook('preHandler', async request => {
    const requestedDemoWorkspaceId = readDemoWorkspaceHeader(request)
    request.auth = await resolveRequestAuth(
      context,
      request.cookies[context.config.sessionCookieName],
      requestedDemoWorkspaceId,
    )
  })
```

- [ ] **Step 5: Include session payload demo ID**

In `buildSessionPayload`, add:

```ts
      demoWorkspaceId: session.demoWorkspaceId ?? null,
```

inside `payload`.

- [ ] **Step 6: Bind login sessions to demo pointer**

At the top of login handler after parsing body, add:

```ts
    const demoWorkspace = await resolveActiveDemoWorkspaceForRequest(context, request)
```

Then add `demoWorkspaceId: demoWorkspace?.demoWorkspaceId ?? null` to the `sessions` insert values.

- [ ] **Step 7: Delete demo sessions during reset**

In `air-mentor-api/src/lib/demo-workspace-service.ts`, import `sessions` from schema. In `resetDemoWorkspace`, before dropping schema, add:

```ts
  const demoSessions = await context.db
    .select({ sessionId: sessions.sessionId })
    .from(sessions)
    .where(eq(sessions.demoWorkspaceId, demoWorkspaceId))
  await context.db
    .delete(sessions)
    .where(eq(sessions.demoWorkspaceId, demoWorkspaceId))
```

Add `deletedSessions: number` to the return type and return object:

```ts
    deletedSessions: demoSessions.length,
```

- [ ] **Step 8: Run focused backend test GREEN**

Run from `air-mentor-api/`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot -t "binds demo sessions" --testTimeout=300000
```

Expected: pass.

- [ ] **Step 9: Commit backend session slice**

```bash
git add air-mentor-api/src/db/migrations/0025_demo_session_scope.sql air-mentor-api/src/db/schema.ts air-mentor-api/src/lib/demo-workspace-session-scope.ts air-mentor-api/src/types/fastify.d.ts air-mentor-api/src/modules/support.ts air-mentor-api/src/modules/session.ts air-mentor-api/src/lib/demo-workspace-service.ts air-mentor-api/tests/demo-isolation.test.ts
git commit -m "feat: bind demo sessions to workspace pointer"
```

---

## Task 4: Frontend Pointer Store And API Header Injection

**Files:**

- Create: `src/demo-workspace-pointer.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/types.ts`
- Create: `tests/demo-workspace-pointer.test.ts`
- Modify: `tests/api-client.test.ts`

- [ ] **Step 1: Add pointer store test**

Create `tests/demo-workspace-pointer.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY,
  clearActiveDemoWorkspacePointer,
  readActiveDemoWorkspacePointer,
  writeActiveDemoWorkspacePointer,
} from '../src/demo-workspace-pointer'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('demo workspace pointer storage', () => {
  it('persists only the active demo workspace id', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    writeActiveDemoWorkspacePointer({ demoWorkspaceId: 'demo_ws_001' })

    expect(readActiveDemoWorkspacePointer()).toEqual({ demoWorkspaceId: 'demo_ws_001' })
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)).toBe(JSON.stringify({
      demoWorkspaceId: 'demo_ws_001',
    }))
  })

  it('clears invalid or empty pointer values', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    localStorage.setItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY, JSON.stringify({ password: 'secret' }))
    expect(readActiveDemoWorkspacePointer()).toBeNull()

    writeActiveDemoWorkspacePointer(null)
    expect(localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)).toBeNull()

    writeActiveDemoWorkspacePointer({ demoWorkspaceId: 'demo_ws_002' })
    clearActiveDemoWorkspacePointer()
    expect(readActiveDemoWorkspacePointer()).toBeNull()
  })
})
```

- [ ] **Step 2: Run pointer test RED**

Run from repo root:

```bash
npx --no-install vitest run tests/demo-workspace-pointer.test.ts --reporter=dot
```

Expected: fail because `src/demo-workspace-pointer.ts` does not exist.

- [ ] **Step 3: Implement pointer store**

Create `src/demo-workspace-pointer.ts`:

```ts
export const ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY = 'airmentor.activeDemoWorkspacePointer'

export type ActiveDemoWorkspacePointer = {
  demoWorkspaceId: string
}

function hasWindowStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function normalizePointer(value: unknown): ActiveDemoWorkspacePointer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ActiveDemoWorkspacePointer>
  if (typeof candidate.demoWorkspaceId !== 'string') return null
  const demoWorkspaceId = candidate.demoWorkspaceId.trim()
  if (!demoWorkspaceId) return null
  return { demoWorkspaceId }
}

export function readActiveDemoWorkspacePointer(): ActiveDemoWorkspacePointer | null {
  if (!hasWindowStorage()) return null
  const raw = window.localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
  if (!raw) return null
  try {
    return normalizePointer(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeActiveDemoWorkspacePointer(pointer: ActiveDemoWorkspacePointer | null) {
  if (!hasWindowStorage()) return
  const normalized = normalizePointer(pointer)
  if (!normalized) {
    window.localStorage.removeItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY, JSON.stringify(normalized))
}

export function clearActiveDemoWorkspacePointer() {
  if (!hasWindowStorage()) return
  window.localStorage.removeItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
}
```

- [ ] **Step 4: Add API client header test**

Append to `tests/api-client.test.ts`:

```ts
  it('sends the active demo workspace pointer header when configured', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sessionId: 'session-1',
      csrfToken: 'csrf-token-1',
      demoWorkspaceId: 'demo_ws_001',
      user: { userId: 'user-1', username: 'sysadmin', email: 'sysadmin@example.com' },
      faculty: { facultyId: 'fac_sysadmin', displayName: 'System Admin' },
      activeRoleGrant: {
        grantId: 'grant-1',
        facultyId: 'fac_sysadmin',
        roleCode: 'SYSTEM_ADMIN',
        scopeType: 'institution',
        scopeId: 'inst-1',
        status: 'active',
        version: 1,
      },
      availableRoleGrants: [],
      preferences: {
        userId: 'user-1',
        themeMode: 'frosted-focus-light',
        version: 1,
        updatedAt: '2026-03-16T00:00:00.000Z',
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch, () => ({
      demoWorkspaceId: 'demo_ws_001',
    }))
    const result = await client.restoreSession()

    expect(result.demoWorkspaceId).toBe('demo_ws_001')
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/session', expect.objectContaining({
      headers: expect.objectContaining({
        'X-AirMentor-Demo-Workspace': 'demo_ws_001',
      }),
    }))
  })
```

- [ ] **Step 5: Run frontend tests RED**

Run from repo root:

```bash
npx --no-install vitest run tests/demo-workspace-pointer.test.ts tests/api-client.test.ts --reporter=dot
```

Expected: fail because the API client constructor does not accept the pointer provider and session type lacks `demoWorkspaceId`.

- [ ] **Step 6: Implement API client injection and type**

In `src/api/types.ts`, add to `ApiSessionResponse`:

```ts
  demoWorkspaceId: string | null
```

In `src/api/client.ts`, import type:

```ts
import type { ActiveDemoWorkspacePointer } from '../demo-workspace-pointer.js'
```

Add type:

```ts
type DemoWorkspacePointerProvider = () => ActiveDemoWorkspacePointer | null
```

Change class fields and constructor:

```ts
  private readonly demoWorkspacePointerProvider?: DemoWorkspacePointerProvider

  constructor(baseUrl: string, fetchImpl?: FetchLike, demoWorkspacePointerProvider?: DemoWorkspacePointerProvider) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl ?? getDefaultFetch()
    this.demoWorkspacePointerProvider = demoWorkspacePointerProvider
  }
```

In `request`, add pointer header before CSRF:

```ts
    const demoWorkspacePointer = this.demoWorkspacePointerProvider?.() ?? null
```

and include in `resolvedHeaders`:

```ts
      ...(demoWorkspacePointer ? { 'X-AirMentor-Demo-Workspace': demoWorkspacePointer.demoWorkspaceId } : {}),
```

- [ ] **Step 7: Run frontend tests GREEN**

Run from repo root:

```bash
npx --no-install vitest run tests/demo-workspace-pointer.test.ts tests/api-client.test.ts --reporter=dot
```

Expected: pass.

- [ ] **Step 8: Commit frontend pointer slice**

```bash
git add src/demo-workspace-pointer.ts src/api/client.ts src/api/types.ts tests/demo-workspace-pointer.test.ts tests/api-client.test.ts
git commit -m "feat: add demo workspace browser pointer"
```

---

## Task 5: Matrix And Verification

**Files:**

- Modify: `docs/CAPABILITY_MATRIX.md`

- [ ] **Step 1: Update matrix P5 rows**

Change rows to:

```md
| Reset Demo Workspace | partial — schema drop + demo-session invalidation verified; full seeded demo data-plane reset still pending | P5-A/P5-B: `air-mentor-api/tests/demo-isolation.test.ts` |
| Provisioning preview / dry run | works for estimate-only preview | P5-A: `air-mentor-api/tests/demo-isolation.test.ts` |
| Demo data isolation (`demoWorkspaceId`) | partial — schema registry/reset and demo session pointer isolation verified; broad academic/proof schema routing deferred | P5-A/P5-B: `air-mentor-api/tests/demo-isolation.test.ts`; `tests/demo-workspace-pointer.test.ts`; `tests/api-client.test.ts` |
```

Change test coverage row to:

```md
| Demo isolation regression test (global rows untouched) | partial — backend schema/reset/session-pointer regressions covered; full browser walkthrough pending | P5-A/P5-B: `air-mentor-api/tests/demo-isolation.test.ts`; `tests/demo-workspace-pointer.test.ts`; `tests/api-client.test.ts` |
```

- [ ] **Step 2: Run verification pack**

Run from repo root:

```bash
npx --no-install vitest run tests/demo-workspace-pointer.test.ts tests/api-client.test.ts --reporter=dot
npx --no-install tsc -p tsconfig.tests.json --noEmit --pretty false
```

Run from `air-mentor-api/`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000
npx --no-install tsc -p tsconfig.json --noEmit --pretty false
```

Expected: all pass.

- [ ] **Step 3: Browser proof preflight**

Run from repo root:

```bash
ss -ltnp '( sport = :5173 or sport = :5174 or sport = :4000 or sport = :4100 )' || true
```

Expected: record ports. If frontend/backend can be started safely, run a focused browser proof. If ports are occupied or local app cannot start without disrupting existing processes, record the blocker and do not claim browser proof.

- [ ] **Step 4: Commit matrix and final verification evidence**

```bash
git add docs/CAPABILITY_MATRIX.md
git commit -m "docs: update p5 demo isolation matrix evidence"
```

---

## Self-Review

Spec coverage:

- Backend demo pointer header: Task 2 and Task 3.
- Session binding and restore pointer matching: Task 1 and Task 3.
- Reset demo sessions: Task 3.
- Frontend pointer-only storage: Task 4.
- API header injection: Task 4.
- Capability matrix: Task 5.
- Browser proof/preflight: Task 5.

Placeholder scan:

- No `TBD`, `TODO`, or open-ended implementation steps remain.

Type consistency:

- `demoWorkspaceId` is the shared property name across `sessions`, request auth, session payload, API type, pointer store, and tests.
- `X-AirMentor-Demo-Workspace` is the client header; backend reads lowercase `x-airmentor-demo-workspace` through Fastify headers.
