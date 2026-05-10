# AirMentor P5-D Demo Workspace Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified demo-workspace provisioning path that materializes complete seeded MSRUAS proof data into a demo scope without mutating global proof state.

**Architecture:** Use `demoWorkspaceId` as the authoritative P5-D routing key. Provisioning clones the already-seeded global MSRUAS proof rows into deterministic demo-prefixed IDs and tags demo-visible root rows with `demoWorkspaceId`; it does not rerun the fixed-ID MSRUAS seeder and does not introduce broad physical `search_path` routing. Reset continues to delete rows reachable from demo-tagged students, offerings, and runs.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, PostgreSQL/embedded-postgres tests, Vitest, existing AirMentor proof sandbox fixtures.

---

## File Structure

- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
  - Add `provisionDemoWorkspace` and helper functions for deterministic clone/tag provisioning.
  - Keep listing/create/preview/reset responsibilities in the existing demo-workspace service because reset and provisioning must share row-scope conventions.
- Modify: `air-mentor-api/src/modules/admin-demo-workspace.ts`
  - Add `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision`.
- Modify: `air-mentor-api/tests/demo-isolation.test.ts`
  - Add RED/GREEN regression for provisioned demo bootstrap, idempotency, global non-interference, and reset cleanup.
- Create: `audit-map/32-reports/p5d-demo-workspace-provisioning-2026-05-10.md`
  - Record verified local seeded demo provisioning evidence and claim boundary.
- Modify: `docs/CAPABILITY_MATRIX.md`
  - Update only the demo data isolation row and H1 row truth after verification.

---

## Task 1: Add RED Provisioning Regression

**Files:**

- Modify: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Extend imports**

Add these imported tables at the existing schema import block in `air-mentor-api/tests/demo-isolation.test.ts`:

```ts
  facultyOfferingOwnerships,
  studentEnrollments,
  sessions,
```

The file already imports `sessions`; keep only one import entry. If `facultyOfferingOwnerships` or `studentEnrollments` are already present, do not duplicate them.

- [ ] **Step 2: Add the failing test**

Append this test inside `describe('demo workspace isolation', () => { ... })` after the existing "does not let a demo-bound teacher bootstrap from the global active proof run" test:

```ts
  it('provisions a complete demo workspace without exposing or mutating global proof state', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const [globalActiveBefore] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.activeFlag, 1))
    expect(globalActiveBefore).toBeTruthy()
    expect(globalActiveBefore.demoWorkspaceId).toBeNull()

    const globalStudentCountBefore = await current.db.select().from(students)
    const globalOfferingCountBefore = await current.db.select().from(sectionOfferings)

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Provisioned Demo Workspace' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    const demoTeacherLoginBefore = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'devika.shetty', password: 'faculty1234' },
    })
    expect(demoTeacherLoginBefore.statusCode).toBe(200)
    const demoTeacherCookieBefore = Array.isArray(demoTeacherLoginBefore.headers['set-cookie'])
      ? demoTeacherLoginBefore.headers['set-cookie'][0]
      : demoTeacherLoginBefore.headers['set-cookie']

    const bootstrapBefore = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: {
        cookie: demoTeacherCookieBefore,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(bootstrapBefore.statusCode).toBe(403)
    expect(bootstrapBefore.json()).toMatchObject({ error: 'NO_ACTIVE_PROOF_RUN' })

    const provisionRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}/provision`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    })
    expect(provisionRes.statusCode).toBe(200)
    const provisioned = provisionRes.json() as {
      demoWorkspaceId: string
      activeSimulationRunId: string
      provisionedCounts: {
        students: number
        enrollments: number
        offerings: number
        ownerships: number
        runs: number
      }
    }
    expect(provisioned.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)
    expect(provisioned.activeSimulationRunId).toMatch(/^demo_/)
    expect(provisioned.provisionedCounts.students).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.enrollments).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.offerings).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.ownerships).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.runs).toBe(1)

    const provisionAgainRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}/provision`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    })
    expect(provisionAgainRes.statusCode).toBe(200)
    expect((provisionAgainRes.json() as { activeSimulationRunId: string }).activeSimulationRunId)
      .toBe(provisioned.activeSimulationRunId)

    const [demoRun] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, provisioned.activeSimulationRunId))
    expect(demoRun.demoWorkspaceId).toBe(demoWs.demoWorkspaceId)
    expect(demoRun.activeFlag).toBe(1)

    const [globalActiveAfterProvision] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, globalActiveBefore.simulationRunId))
    expect(globalActiveAfterProvision.activeFlag).toBe(1)
    expect(globalActiveAfterProvision.status).toBe('active')
    expect(globalActiveAfterProvision.demoWorkspaceId).toBeNull()

    const demoStudents = await current.db
      .select()
      .from(students)
      .where(eq(students.demoWorkspaceId, demoWs.demoWorkspaceId))
    const demoEnrollments = await current.db
      .select()
      .from(studentEnrollments)
      .where(eq(studentEnrollments.demoWorkspaceId, demoWs.demoWorkspaceId))
    const demoOfferings = await current.db
      .select()
      .from(sectionOfferings)
      .where(eq(sectionOfferings.demoWorkspaceId, demoWs.demoWorkspaceId))
    const demoOwnerships = await current.db
      .select()
      .from(facultyOfferingOwnerships)
      .where(eq(facultyOfferingOwnerships.demoWorkspaceId, demoWs.demoWorkspaceId))
    expect(demoStudents.length).toBe(provisioned.provisionedCounts.students)
    expect(demoEnrollments.length).toBe(provisioned.provisionedCounts.enrollments)
    expect(demoOfferings.length).toBe(provisioned.provisionedCounts.offerings)
    expect(demoOwnerships.length).toBe(provisioned.provisionedCounts.ownerships)

    const demoTeacherLoginAfter = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: TEST_ORIGIN,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
      payload: { identifier: 'devika.shetty', password: 'faculty1234' },
    })
    expect(demoTeacherLoginAfter.statusCode).toBe(200)
    const demoTeacherCookieAfter = Array.isArray(demoTeacherLoginAfter.headers['set-cookie'])
      ? demoTeacherLoginAfter.headers['set-cookie'][0]
      : demoTeacherLoginAfter.headers['set-cookie']
    const bootstrapAfter = await current.app.inject({
      method: 'GET',
      url: '/api/academic/bootstrap',
      headers: {
        cookie: demoTeacherCookieAfter,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(bootstrapAfter.statusCode).toBe(200)
    const bootstrap = bootstrapAfter.json() as {
      offerings: unknown[]
      faculty: unknown[]
      mentees: unknown[]
      proofOperations?: { activeRunId?: string | null } | null
    }
    expect(bootstrap.offerings.length).toBeGreaterThan(0)
    expect(bootstrap.faculty.length).toBeGreaterThan(0)
    expect(bootstrap.mentees.length).toBeGreaterThan(0)
    expect(bootstrap.proofOperations?.activeRunId).toBe(provisioned.activeSimulationRunId)

    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    expect((resetRes.json() as { deletedStudents: number; deletedOfferings: number; deletedRuns: number; deletedSessions: number }).deletedStudents)
      .toBe(provisioned.provisionedCounts.students)

    const restoreAfterReset = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: {
        cookie: demoTeacherCookieAfter,
        'x-airmentor-demo-workspace': demoWs.demoWorkspaceId,
      },
    })
    expect(restoreAfterReset.statusCode).toBe(401)

    const [globalActiveAfterReset] = await current.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, globalActiveBefore.simulationRunId))
    expect(globalActiveAfterReset.activeFlag).toBe(1)
    expect(globalActiveAfterReset.status).toBe('active')

    const globalStudentCountAfter = await current.db.select().from(students)
    const globalOfferingCountAfter = await current.db.select().from(sectionOfferings)
    expect(globalStudentCountAfter.filter(row => row.demoWorkspaceId === null)).toHaveLength(globalStudentCountBefore.filter(row => row.demoWorkspaceId === null).length)
    expect(globalOfferingCountAfter.filter(row => row.demoWorkspaceId === null)).toHaveLength(globalOfferingCountBefore.filter(row => row.demoWorkspaceId === null).length)
  })
```

- [ ] **Step 3: Run the RED test**

Run from `air-mentor-api`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000 -t "provisions a complete demo workspace"
```

Expected: FAIL with 404 route not found for `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision`.

- [ ] **Step 4: Commit the RED test**

```bash
git add air-mentor-api/tests/demo-isolation.test.ts
git commit -m "test: add p5d demo provisioning regression"
```

---

## Task 2: Implement Demo Workspace Provisioning

**Files:**

- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
- Modify: `air-mentor-api/src/modules/admin-demo-workspace.ts`

- [ ] **Step 1: Extend service imports**

In `air-mentor-api/src/lib/demo-workspace-service.ts`, extend imports:

```ts
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { notFound, conflict } from './http-errors.js'
import { parseJson, stringifyJson } from './json.js'
import { MSRUAS_PROOF_BATCH_ID, MSRUAS_PROOF_SIMULATION_RUN_ID, PROOF_TERM_DEFS } from './msruas-proof-sandbox.js'
```

Keep existing imports that are still needed.

Extend the schema import block to include every cloned or cleaned table used by provisioning/reset:

```ts
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  alertDecisions,
  alertOutcomes,
  electiveRecommendations,
  riskEvidenceSnapshots,
  simulationQuestionTemplates,
  simulationResetSnapshots,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
  studentCoStates,
  studentInterventions,
  studentObservedSemesterStates,
  studentQuestionResults,
  studentTopicStates,
  transcriptSubjectResults,
  transcriptTermResults,
  worldContextSnapshots,
```

- [ ] **Step 2: Add deterministic clone helpers**

Add these helpers above `listDemoWorkspaces`:

```ts
type IdMap = Map<string, string>

type ProvisionedCounts = {
  students: number
  enrollments: number
  offerings: number
  ownerships: number
  runs: number
  checkpoints: number
}

function demoIdPrefix(demoWorkspaceId: string) {
  return `demo_${demoWorkspaceId.replace(/[^a-zA-Z0-9_]+/g, '_')}`
}

function cloneId(demoWorkspaceId: string, sourceId: string) {
  return `${demoIdPrefix(demoWorkspaceId)}__${sourceId}`
}

function cloneOptionalId(map: IdMap, value: string | null | undefined) {
  if (!value) return value ?? null
  return map.get(value) ?? value
}

function replaceIdsInText(value: string | null | undefined, maps: IdMap[]) {
  if (value == null) return value ?? null
  const entries = maps.flatMap(map => Array.from(map.entries()))
    .sort((left, right) => right[0].length - left[0].length)
  return entries.reduce((next, [from, to]) => next.split(from).join(to), value)
}

function parseMetadata(value: string | null | undefined) {
  return parseJson(value ?? '{}', {} as Record<string, unknown>)
}
```

- [ ] **Step 3: Add source-run resolution**

Add this helper above `provisionDemoWorkspace`:

```ts
async function resolveSourceProofRun(context: RouteContext) {
  const [activeGlobalRun] = await context.db
    .select()
    .from(simulationRuns)
    .where(and(
      eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID),
      eq(simulationRuns.activeFlag, 1),
      isNull(simulationRuns.demoWorkspaceId),
    ))
    .limit(1)
  if (activeGlobalRun) return activeGlobalRun

  const [canonicalRun] = await context.db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.simulationRunId, MSRUAS_PROOF_SIMULATION_RUN_ID))
  if (canonicalRun && (canonicalRun.demoWorkspaceId ?? null) === null) return canonicalRun

  const globalRuns = await context.db
    .select()
    .from(simulationRuns)
    .where(and(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID), isNull(simulationRuns.demoWorkspaceId)))
  const latestRun = globalRuns.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  if (!latestRun) throw conflict('No seeded MSRUAS proof run is available for demo provisioning')
  return latestRun
}
```

- [ ] **Step 4: Add idempotent result helper**

Add this helper above `provisionDemoWorkspace`:

```ts
async function summarizeProvisionedWorkspace(context: RouteContext, demoWorkspaceId: string, activeSimulationRunId: string) {
  const [studentRows, enrollmentRows, offeringRows, ownershipRows, checkpointRows] = await Promise.all([
    context.db.select().from(students).where(eq(students.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, activeSimulationRunId)),
  ])
  return {
    demoWorkspaceId,
    activeSimulationRunId,
    provisionedCounts: {
      students: studentRows.length,
      enrollments: enrollmentRows.length,
      offerings: offeringRows.length,
      ownerships: ownershipRows.length,
      runs: 1,
      checkpoints: checkpointRows.length,
    },
  }
}
```

- [ ] **Step 5: Add `provisionDemoWorkspace`**

Add `export async function provisionDemoWorkspace(context: RouteContext, demoWorkspaceId: string)` before `resetDemoWorkspace`. Implementation rules:

- Load workspace; throw `notFound('Demo workspace not found')` if absent.
- Throw `conflict('Demo workspace is not active')` unless `status === 'active'`.
- If `activeSimulationRunId` exists and that run still exists, return `summarizeProvisionedWorkspace(...)`.
- Resolve source global proof run with `resolveSourceProofRun`.
- Build deterministic maps for source run, students, offerings, ownerships, checkpoints, queue cases, templates, risk assessments, alert decisions, reassessments, academic tasks, transcript terms, student agent cards/sessions.
- Clone in parent-before-child order:
  1. `students` with `demoWorkspaceId` and demo USN/email suffix.
  2. `studentAcademicProfiles`.
  3. `sectionOfferings` with `demoWorkspaceId`.
  4. `studentEnrollments` with `demoWorkspaceId`.
  5. `mentorAssignments` with `demoWorkspaceId`.
  6. `facultyOfferingOwnerships` with `demoWorkspaceId`.
  7. `simulationRuns` as active demo run with `parentSimulationRunId` set to source run ID, `demoWorkspaceId`, `activeFlag: 1`, `status: 'active'`, `lifecycleState: 'active'`, and `runLabel` prefixed with `Demo workspace`.
  8. Run-scoped proof rows and evidence rows, replacing source IDs inside text/JSON using `replaceIdsInText`.
  9. Update `demoWorkspaces.activeSimulationRunId`, `batchId`, `sourceBatchId`, metadata `provisionedCounts`, and `status: 'active'`.
- Use `.onConflictDoNothing()` for insert batches so repeated calls remain safe.

- [ ] **Step 6: Wire the route**

In `air-mentor-api/src/modules/admin-demo-workspace.ts`:

```ts
import {
  createDemoWorkspace,
  listDemoWorkspaces,
  previewDemoProvisioning,
  provisionDemoWorkspace,
  resetDemoWorkspace,
} from '../lib/demo-workspace-service.js'
```

Add this route between preview and delete:

```ts
  app.post('/api/admin/demo-workspaces/:demoWorkspaceId/provision', {
    schema: {
      tags: ['admin-demo-workspace'],
      summary: 'Provision complete seeded demo data for a demo workspace',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(
      z.object({ demoWorkspaceId: z.string().min(1) }),
      request.params,
    )
    return provisionDemoWorkspace(context, params.demoWorkspaceId)
  })
```

- [ ] **Step 7: Run focused GREEN test**

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000 -t "provisions a complete demo workspace"
```

Expected: PASS.

- [ ] **Step 8: Commit implementation**

```bash
git add air-mentor-api/src/lib/demo-workspace-service.ts air-mentor-api/src/modules/admin-demo-workspace.ts
git commit -m "feat: provision seeded demo workspaces"
```

---

## Task 3: Harden Reset Cleanup For Provisioned Rows

**Files:**

- Modify: `air-mentor-api/src/lib/demo-workspace-service.ts`
- Test: `air-mentor-api/tests/demo-isolation.test.ts`

- [ ] **Step 1: Run the full demo-isolation suite**

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000
```

Expected: PASS. If it fails with FK violations on reset, continue to Step 2.

- [ ] **Step 2: Delete run-scoped child rows before root rows**

Inside `resetDemoWorkspace`, before deleting `simulationRuns`, add deletes for provisioned run-scoped children in this order when `demoRunIds.length > 0`:

```ts
await context.db.delete(studentAgentMessages).where(inArray(studentAgentMessages.studentAgentSessionId, demoStudentAgentSessionIds))
await context.db.delete(studentAgentSessions).where(inArray(studentAgentSessions.simulationRunId, demoRunIds))
await context.db.delete(studentAgentCards).where(inArray(studentAgentCards.simulationRunId, demoRunIds))
await context.db.delete(studentQuestionResults).where(inArray(studentQuestionResults.simulationRunId, demoRunIds))
await context.db.delete(simulationStageQueueProjections).where(inArray(simulationStageQueueProjections.simulationRunId, demoRunIds))
await context.db.delete(simulationStageOfferingProjections).where(inArray(simulationStageOfferingProjections.simulationRunId, demoRunIds))
await context.db.delete(simulationStageStudentProjections).where(inArray(simulationStageStudentProjections.simulationRunId, demoRunIds))
await context.db.delete(simulationStageQueueCases).where(inArray(simulationStageQueueCases.simulationRunId, demoRunIds))
await context.db.delete(simulationStageCheckpoints).where(inArray(simulationStageCheckpoints.simulationRunId, demoRunIds))
await context.db.delete(simulationQuestionTemplates).where(inArray(simulationQuestionTemplates.simulationRunId, demoRunIds))
await context.db.delete(simulationResetSnapshots).where(inArray(simulationResetSnapshots.simulationRunId, demoRunIds))
await context.db.delete(studentObservedSemesterStates).where(inArray(studentObservedSemesterStates.simulationRunId, demoRunIds))
await context.db.delete(studentCoStates).where(inArray(studentCoStates.simulationRunId, demoRunIds))
await context.db.delete(studentTopicStates).where(inArray(studentTopicStates.simulationRunId, demoRunIds))
await context.db.delete(studentLatentStates).where(inArray(studentLatentStates.simulationRunId, demoRunIds))
await context.db.delete(studentBehaviorProfiles).where(inArray(studentBehaviorProfiles.simulationRunId, demoRunIds))
await context.db.delete(worldContextSnapshots).where(inArray(worldContextSnapshots.simulationRunId, demoRunIds))
await context.db.delete(electiveRecommendations).where(inArray(electiveRecommendations.simulationRunId, demoRunIds))
await context.db.delete(riskEvidenceSnapshots).where(inArray(riskEvidenceSnapshots.simulationRunId, demoRunIds))
await context.db.delete(alertOutcomes).where(inArray(alertOutcomes.alertDecisionId, demoAlertDecisionIds))
await context.db.delete(alertDecisions).where(inArray(alertDecisions.riskAssessmentId, demoRiskAssessmentIds))
await context.db.delete(reassessmentEvents).where(inArray(reassessmentEvents.riskAssessmentId, demoRiskAssessmentIds))
await context.db.delete(riskAssessments).where(inArray(riskAssessments.simulationRunId, demoRunIds))
```

Collect `demoStudentAgentSessionIds`, `demoRiskAssessmentIds`, and `demoAlertDecisionIds` with selects before deletion.

- [ ] **Step 3: Delete academic task children before tasks**

When `demoStudentIds` or `demoOfferingIds` exist, select demo academic task IDs by demo students/offerings, then delete:

```ts
await context.db.delete(academicTaskPlacements).where(inArray(academicTaskPlacements.taskId, demoTaskIds))
await context.db.delete(academicTaskTransitions).where(inArray(academicTaskTransitions.taskId, demoTaskIds))
await context.db.delete(academicTasks).where(inArray(academicTasks.taskId, demoTaskIds))
```

- [ ] **Step 4: Run full demo-isolation suite again**

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000
```

Expected: PASS.

- [ ] **Step 5: Commit reset hardening if changed**

```bash
git add air-mentor-api/src/lib/demo-workspace-service.ts
git commit -m "fix: clean provisioned demo workspace rows"
```

---

## Task 4: Verification, Report, Matrix

**Files:**

- Create: `audit-map/32-reports/p5d-demo-workspace-provisioning-2026-05-10.md`
- Modify: `docs/CAPABILITY_MATRIX.md`

- [ ] **Step 1: Run backend focused verification**

```bash
npx --no-install vitest run tests/demo-isolation.test.ts tests/proof-control-plane-seeded-bootstrap-service.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000
```

Expected: all tests PASS.

- [ ] **Step 2: Run backend typecheck**

```bash
npx --no-install tsc -p tsconfig.json --noEmit --pretty false
```

Expected: exit 0.

- [ ] **Step 3: Write report**

Create `audit-map/32-reports/p5d-demo-workspace-provisioning-2026-05-10.md`:

```md
# AirMentor P5-D Demo Workspace Provisioning — 2026-05-10

## Intent

College evaluator can create a local demo workspace with complete seeded MSRUAS proof data while global proof state remains untouched.

## Implementation

- Added `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision`.
- Provisioning clones existing seeded MSRUAS proof rows into deterministic demo-prefixed IDs.
- Demo-visible root rows are tagged with `demoWorkspaceId`.
- Demo active proof run does not deactivate the global active proof run.
- Reset deletes demo-bound sessions/data/schema and leaves global rows intact.

## Verification

- `npx --no-install vitest run tests/demo-isolation.test.ts tests/proof-control-plane-seeded-bootstrap-service.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000` — PASS.
- `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` — PASS.

## Claim Boundary

P5-D proves local seeded demo workspace provisioning/reset under current `demoWorkspaceId` guards. It does not claim broad physical schema routing for every table, multi-program templates, production deployment readiness, real-data validation, or production ML validity.
```

- [ ] **Step 4: Update capability matrix conservatively**

Update `docs/CAPABILITY_MATRIX.md` rows:

- `Reset Demo Workspace`: mention provisioned demo rows/session/schema cleanup verified by `tests/demo-isolation.test.ts`.
- `Demo data isolation (demoWorkspaceId)`: mention P5-D seeded provisioning route and report; keep status `partial` because broad physical schema routing and multi-program remain deferred.
- `Demo isolation regression test`: remove stale "performance baseline remains pending" phrase and add P5-D provisioning regression evidence.

Do not mark P5 as fully complete.

- [ ] **Step 5: Commit report and matrix**

```bash
git add audit-map/32-reports/p5d-demo-workspace-provisioning-2026-05-10.md docs/CAPABILITY_MATRIX.md
git commit -m "docs: record p5d demo provisioning evidence"
```

---

## Task 5: Final Branch Verification And Merge

**Files:**

- Read-only: git status/log.

- [ ] **Step 1: Check worktree status and log**

```bash
git status --short
git log --oneline --decorate --max-count=8
```

Expected: working tree clean and latest commits include P5-D test, implementation, and report/matrix.

- [ ] **Step 2: Merge back to root branch**

From root repository, fast-forward merge branch `p5d-demo-workspace-provisioning-2026-05-10` into `college-demo-2026-04-27`.

- [ ] **Step 3: Re-run focused verification from root**

From root `air-mentor-api`:

```bash
npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000
npx --no-install tsc -p tsconfig.json --noEmit --pretty false
```

Expected: PASS and exit 0.

- [ ] **Step 4: Clean finished branch/worktree**

Remove `.worktrees/p5d-demo-workspace-provisioning-2026-05-10` and delete branch `p5d-demo-workspace-provisioning-2026-05-10` only after root verification is green.

---

## Self-Review

Spec coverage:

- Complete seeded demo workspace: Tasks 1-2 clone global seeded rows into demo scope.
- Demo/global non-interference: Task 1 checks global active run and global row counts before/after provision/reset.
- Demo-bound sessions: Task 1 checks demo teacher bootstrap before provisioning, after provisioning, and stale restore after reset.
- Reset cleanup: Task 3 hardens delete order and Task 1 asserts cleanup counts.
- Conservative truth boundary: Task 4 report and matrix preserve partial status.

Placeholder scan:

- No deferred implementation placeholders remain. The only conditional branch is reset hardening, tied to concrete FK failure mode and exact delete order.

Type consistency:

- `provisionedCounts` fields match tests and report.
- `activeSimulationRunId` matches `demoWorkspaces.activeSimulationRunId` and response shape.
- Route path matches test path: `/api/admin/demo-workspaces/:demoWorkspaceId/provision`.
