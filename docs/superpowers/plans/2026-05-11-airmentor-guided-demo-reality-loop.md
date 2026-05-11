# AirMentor Guided Demo Reality Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only Course Leader guided demo panel that shows one realistic synthetic MSRUAS student journey: evidence edit, recompute, risk/queue delta, intervention resolution, and next-stage validation.

**Architecture:** Add one focused frontend component, `DemoRealityLoopPanel`, and mount it on the Course Leader dashboard. Reuse existing academic APIs for student risk explorer, student shell card, attendance commit, reassessment resolve, and proof run advance; add only one narrow academic recompute wrapper route because the existing recompute route is system-admin-only. Keep all snapshots in component state and keep copy explicitly synthetic-demo bounded.

**Tech Stack:** React, TypeScript, Vitest, Fastify academic routes, existing AirMentor API client, existing proof-control-plane recompute service, local Playwright/Nix Firefox for browser proof.

---

## Scope Guard

- Work in isolated worktree: `/home/raed/projects/air-mentor-ui/.worktrees/guided-demo-reality-loop-2026-05-11`.
- Do not edit root P5-D WIP files outside this worktree.
- Do not commit unless explicitly approved.
- Do not deploy.
- Do not claim real-data predictive accuracy, production ML readiness, institutional validation, multi-program generality, or deployed readiness.

## File Structure

- Create: `src/demo-reality-loop.tsx`
  - Pure rendering, snapshot extraction, delta formatting, and orchestration of existing callback props.
- Modify: `src/academic-route-pages.tsx`
  - Mount `DemoRealityLoopPanel` inside `CLDashboard` above Priority Alerts.
  - Pass Course Leader offerings, `proofProfile`, and callback props.
- Modify: `src/academic-workspace-route-surface.tsx`
  - Pass loader/action callbacks from `OperationalWorkspace` into `CLDashboard`.
- Modify: `src/App.tsx`
  - Add `handleRecomputeAcademicProofRunRisk` using new client method and projection refresh.
  - Expose `repositories.entryData.commitAttendanceEntries` via a small dashboard callback for the selected offering.
- Modify: `src/api/client.ts`
  - Add `recomputeAcademicProofRunRisk(simulationRunId)` wrapper.
  - Extend client-like interface.
- Modify: `air-mentor-api/src/modules/academic-proof-routes.ts`
  - Add academic recompute endpoint with same scope/active-run guard pattern as academic advance/stop.
  - Use `resolveBatchPolicy` and `recomputeObservedOnlyRisk`.
- Test: `tests/demo-reality-loop.test.tsx`
  - Component fixture rendering, deltas, empty/error states, callback sequence.
- Test: `tests/academic-route-pages.test.tsx`
  - Course Leader dashboard shows panel and passes proof queue student.
- Test: `tests/api-client.test.ts`
  - Client posts to `/api/academic/proof-runs/:id/recompute-risk`.
- Test: `air-mentor-api/tests/academic-proof-routes.test.ts`
  - Academic recompute rejects cross-scope/inactive runs and invokes recompute with batch policy for active scoped run.
- Browser proof extension: `tests-e2e/specs/guided-demo-reality-loop.spec.ts`
  - Local evaluator story after P5-D provisioning.

---

### Task 1: Backend academic recompute route

**Files:**
- Modify: `air-mentor-api/src/modules/academic-proof-routes.ts`
- Test: `air-mentor-api/tests/academic-proof-routes.test.ts`

- [ ] **Step 1: Write failing backend test**

Add `recomputeObservedOnlyRisk` and `resolveBatchPolicy` mocks/imports to `air-mentor-api/tests/academic-proof-routes.test.ts`, then add this test:

```ts
it('allows academic proof recompute only for the active scoped proof run', async () => {
  const context = {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: async () => table === simulationRuns ? [{
            simulationRunId: 'sim_active_demo',
            batchId: 'batch_mnc_2023',
            activeFlag: 1,
            demoWorkspaceId: 'demo_ws_001',
          }] : [],
        }),
      }),
    },
    now: () => '2026-05-11T08:00:00.000Z',
  }
  const resolveBatchPolicy = vi.fn().mockResolvedValue({ effectivePolicy: { attendanceRules: { minimumRequiredPercent: 75 } } })

  app = fastify()
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.auth = {
      sessionId: 'session_course_leader',
      facultyId: 'faculty_course_leader',
      userId: 'faculty_course_leader',
      username: 'devika.shetty',
      email: 'devika.shetty@msruas.ac.in',
      demoWorkspaceId: 'demo_ws_001',
      facultyName: 'Devika Shetty',
      activeRoleGrant: {
        grantId: 'grant_course_leader',
        facultyId: 'faculty_course_leader',
        roleCode: 'COURSE_LEADER',
        scopeType: 'section',
        scopeId: 'section_a',
        status: 'active',
        version: 1,
      },
      availableRoleGrants: [],
    }
  })

  await registerAcademicProofRoutes(app, context as never, {
    academicRoleCodes: ['COURSE_LEADER', 'MENTOR', 'HOD'],
    assertStudentShellScope: vi.fn(),
    hodProofCourseQuerySchema: z.object({}).passthrough(),
    hodProofFacultyQuerySchema: z.object({}).passthrough(),
    hodProofReassessmentQuerySchema: z.object({}).passthrough(),
    hodProofStudentQuerySchema: z.object({}).passthrough(),
    hodProofSummaryQuerySchema: z.object({}).passthrough(),
    proofReassessmentAcknowledgeSchema: z.object({}).passthrough(),
    proofReassessmentParamsSchema: z.object({ reassessmentEventId: z.string().min(1) }),
    proofReassessmentResolveSchema: z.object({}).passthrough(),
    proofResolutionCreditByOutcome: { completed_improving: 0.3 },
    proofResolutionRecoveryState: vi.fn(),
    resolveAcademicStageCheckpoint: vi.fn(),
    resolveBatchPolicy,
    resolveProofReassessmentAccess: vi.fn(),
    resolveStudentShellRun: vi.fn(),
    studentShellMessageSchema: z.object({ prompt: z.string().min(1) }),
    studentShellQuerySchema: z.object({ simulationRunId: z.string().min(1).optional(), simulationStageCheckpointId: z.string().min(1).optional() }),
    studentShellSessionCreateSchema: z.object({ simulationRunId: z.string().min(1).optional(), simulationStageCheckpointId: z.string().min(1).optional() }),
  } as never)

  const response = await app.inject({
    method: 'POST',
    url: '/api/academic/proof-runs/sim_active_demo/recompute-risk',
    payload: {},
  })

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ ok: true })
  expect(resolveBatchPolicy).toHaveBeenCalledWith(context, 'batch_mnc_2023')
  expect(proofRouteMocks.recomputeObservedOnlyRisk).toHaveBeenCalledWith(context.db, {
    simulationRunId: 'sim_active_demo',
    policy: { attendanceRules: { minimumRequiredPercent: 75 } },
    actorFacultyId: 'faculty_course_leader',
    now: '2026-05-11T08:00:00.000Z',
  })
})
```

- [ ] **Step 2: Run failing backend test**

Run: `npx --no-install vitest run tests/academic-proof-routes.test.ts --reporter=dot`

Expected: FAIL because route `/api/academic/proof-runs/:simulationRunId/recompute-risk` does not exist or `recomputeObservedOnlyRisk` is not imported.

- [ ] **Step 3: Implement backend route**

In `air-mentor-api/src/modules/academic-proof-routes.ts`:

```ts
import {
  buildHodProofAnalytics,
  buildStudentAgentCard,
  buildStudentRiskExplorer,
  advanceProofSimulationDay,
  advanceProofSimulationPreviousDay,
  advanceProofSimulationStage,
  listStudentAgentTimeline,
  recomputeObservedOnlyRisk,
  sendStudentAgentMessage,
  startStudentAgentSession,
  stopProofSimulationRun,
} from '../lib/msruas-proof-control-plane.js'
```

Destructure from route deps:

```ts
resolveBatchPolicy,
```

Add after academic stop route:

```ts
app.post('/api/academic/proof-runs/:simulationRunId/recompute-risk', {
  schema: {
    tags: ['academic'],
    summary: 'Recompute observable-only risk for the active proof run from the academic workspace',
  },
}, async request => {
  const auth = requireRole(request, ['SYSTEM_ADMIN', ...academicRoleCodes])
  assertAcademicAccess(evaluateFacultyContextAccess(auth, { allowSystemAdmin: true }))
  const params = parseOrThrow(z.object({ simulationRunId: z.string().min(1) }), request.params)
  const run = await resolveScopedAcademicProofRun(context, auth, params.simulationRunId)
  assertAcademicAccess(evaluateActiveProofRunAccess(auth, run.activeFlag === 1, 'Academic proof controls may recompute only the active proof run'))
  const resolved = await resolveBatchPolicy(context, run.batchId)
  await recomputeObservedOnlyRisk(context.db, {
    simulationRunId: params.simulationRunId,
    policy: resolved.effectivePolicy,
    actorFacultyId: auth.facultyId ?? null,
    now: context.now(),
  })
  return { ok: true }
})
```

- [ ] **Step 4: Pass backend route test**

Run: `npx --no-install vitest run tests/academic-proof-routes.test.ts --reporter=dot`

Expected: PASS.

---

### Task 2: API client wrapper

**Files:**
- Modify: `src/api/client.ts`
- Test: `tests/api-client.test.ts`

- [ ] **Step 1: Write failing client test**

Add to `tests/api-client.test.ts`:

```ts
it('posts academic proof recompute-risk through the academic workspace route', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }))
  const client = new AirMentorApiClient({ baseUrl: 'http://127.0.0.1:4100', fetchImpl: fetchMock })

  await expect(client.recomputeAcademicProofRunRisk('sim_active_demo')).resolves.toEqual({ ok: true })

  expect(fetchMock).toHaveBeenCalledWith(
    'http://127.0.0.1:4100/api/academic/proof-runs/sim_active_demo/recompute-risk',
    expect.objectContaining({ method: 'POST', body: '{}' }),
  )
})
```

- [ ] **Step 2: Run failing client test**

Run: `npx --no-install vitest run tests/api-client.test.ts --reporter=dot`

Expected: FAIL because `recomputeAcademicProofRunRisk` is missing.

- [ ] **Step 3: Implement client wrapper**

Add interface method:

```ts
recomputeAcademicProofRunRisk(simulationRunId: string): Promise<{ ok: true }>
```

Add class method near academic advance/stop:

```ts
async recomputeAcademicProofRunRisk(simulationRunId: string) {
  return this.request<{ ok: true }>(`/api/academic/proof-runs/${simulationRunId}/recompute-risk`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
```

- [ ] **Step 4: Pass client test**

Run: `npx --no-install vitest run tests/api-client.test.ts --reporter=dot`

Expected: PASS.

---

### Task 3: Guided demo panel component

**Files:**
- Create: `src/demo-reality-loop.tsx`
- Test: `tests/demo-reality-loop.test.tsx`

- [ ] **Step 1: Write failing render/delta tests**

Create `tests/demo-reality-loop.test.tsx` with fixture `ApiAcademicFacultyProfile`, fixture `Offering`, and callback spies. Assert:

```ts
expect(markup).toContain('data-proof-surface="demo-reality-loop"')
expect(markup).toContain('Demo Reality Loop')
expect(markup).toContain('synthetic MSRUAS demo')
expect(markup).toContain('Aarav Sharma')
expect(markup).toContain('Attendance')
expect(markup).toContain('Risk')
expect(markup).toContain('Queue')
expect(markup).toContain('This is a deterministic simulated-world response')
```

Add pure helper assertions through exported helpers:

```ts
expect(formatDemoDelta(68, 54, '%')).toBe('68% -> 54% (-14%)')
expect(formatDemoDelta(72, 72, '%')).toBe('72% -> 72% (no change)')
expect(formatDemoDelta(null, 60, '%')).toBe('Not recorded -> 60%')
```

Add empty state test:

```ts
expect(markup).toContain('Start/provision a demo run first')
```

- [ ] **Step 2: Run failing component test**

Run: `npx --no-install vitest run tests/demo-reality-loop.test.tsx --reporter=dot`

Expected: FAIL because component file does not exist.

- [ ] **Step 3: Implement component**

Create `src/demo-reality-loop.tsx` exporting:

```ts
export type DemoRealityLoopSnapshot = {
  attendancePct: number | null
  riskBand: string | null
  riskProbScaled: number | null
  queueState: string | null
  reassessmentStatus: string | null
}

export function formatDemoDelta(before: number | null, after: number | null, unit = ''): string

export function buildDemoRealityLoopSnapshot(input: ApiStudentRiskExplorer | ApiStudentAgentCard | null): DemoRealityLoopSnapshot | null

export function DemoRealityLoopPanel(props: DemoRealityLoopPanelProps): JSX.Element
```

Use `proofProfile.proofOperations.monitoringQueue` to select the highest-risk item, resolve its `Offering`, and show:

- student name, USN, semester/stage, course, risk, queue, top drivers;
- evidence fields with hidden-future copy;
- buttons with `data-proof-action` values:
  - `demo-loop-capture-before`
  - `demo-loop-apply-attendance-edit`
  - `demo-loop-recompute-risk`
  - `demo-loop-resolve-intervention`
  - `demo-loop-next-stage`
  - `demo-loop-load-next-stage`
- before/after deltas with `data-proof-section="demo-loop-delta"`;
- neutral no-intervention state when no open reassessment exists.

- [ ] **Step 4: Pass component test**

Run: `npx --no-install vitest run tests/demo-reality-loop.test.tsx --reporter=dot`

Expected: PASS.

---

### Task 4: Wire Course Leader dashboard orchestration

**Files:**
- Modify: `src/academic-route-pages.tsx`
- Modify: `src/academic-workspace-route-surface.tsx`
- Modify: `src/App.tsx`
- Test: `tests/academic-route-pages.test.tsx`

- [ ] **Step 1: Write failing dashboard wiring test**

In `tests/academic-route-pages.test.tsx`, render `CLDashboard` with proof queue fixture and assert:

```ts
expect(screen.getByText('Demo Reality Loop')).toBeTruthy()
expect(screen.getByText(/synthetic MSRUAS demo/i)).toBeTruthy()
expect(screen.getByText('Aarav Sharma')).toBeTruthy()
expect(screen.getByRole('button', { name: /Capture before snapshot/i })).toBeTruthy()
```

- [ ] **Step 2: Run failing dashboard test**

Run: `npx --no-install vitest run tests/academic-route-pages.test.tsx --reporter=dot`

Expected: FAIL because panel is not mounted.

- [ ] **Step 3: Wire props**

In `CLDashboardProps`, add:

```ts
loadStudentRiskExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
loadStudentAgentCard?: (studentId: string) => Promise<ApiStudentAgentCard>
onCommitDemoAttendanceEdit?: (offeringId: string, studentId: string, nextAttendancePct: number) => Promise<void>
onRecomputeProofRunRisk?: (simulationRunId: string) => Promise<void>
onResolveProofReassessment?: (reassessmentEventId: string) => Promise<ApiProofReassessmentResolveResponse>
```

Mount:

```tsx
<DemoRealityLoopPanel
  proofProfile={proofProfile ?? null}
  offerings={offerings}
  loadStudentRiskExplorer={loadStudentRiskExplorer}
  loadStudentAgentCard={loadStudentAgentCard}
  onCommitAttendanceEdit={onCommitDemoAttendanceEdit}
  onRecomputeProofRunRisk={onRecomputeProofRunRisk}
  onResolveReassessment={onResolveProofReassessment}
  onAdvanceProofRun={onAdvanceProofRun}
/>
```

In `AcademicWorkspaceRouteSurface`, pass workspace callbacks to `CLDashboard`.

In `App.tsx`, add:

```ts
const handleRecomputeAcademicProofRunRisk = useCallback(async (simulationRunId: string) => {
  if (!apiClient) throw new Error('Academic backend is unavailable.')
  await apiClient.recomputeAcademicProofRunRisk(simulationRunId)
  await refreshAcademicProjection()
}, [apiClient, refreshAcademicProjection])
```

Add attendance callback that commits one selected student attendance entry through `repositories.entryData.commitAttendanceEntries` and refreshes academic projection.

Add reassessment callback:

```ts
const handleResolveAcademicProofReassessment = useCallback(async (reassessmentEventId: string) => {
  if (!apiClient) throw new Error('Academic backend is unavailable.')
  const result = await apiClient.resolveAcademicProofReassessment(reassessmentEventId, {
    outcome: 'completed_improving',
    note: 'Demo Reality Loop guided intervention resolution.',
  })
  await refreshAcademicProjection()
  return result
}, [apiClient, refreshAcademicProjection])
```

- [ ] **Step 4: Pass dashboard wiring test**

Run: `npx --no-install vitest run tests/academic-route-pages.test.tsx --reporter=dot`

Expected: PASS.

---

### Task 5: Focused browser proof

**Files:**
- Create: `tests-e2e/specs/guided-demo-reality-loop.spec.ts`

- [ ] **Step 1: Create browser spec**

Use existing P5-D helpers and login flow. The browser spec must:

1. provision seeded demo workspace locally;
2. login as generated Course Leader;
3. assert `[data-proof-surface="demo-reality-loop"]` is visible;
4. click capture before;
5. click apply attendance edit;
6. click recompute risk;
7. assert `[data-proof-section="demo-loop-delta"]` renders evidence/risk/queue deltas;
8. click resolve intervention if enabled, otherwise assert no-intervention copy;
9. click next stage;
10. assert `[data-proof-section="demo-loop-next-stage-validation"]` renders;
11. assert no production/real-data claim copy appears.

- [ ] **Step 2: Run focused static/unit pack**

Run from root worktree:

```bash
npx --no-install vitest run tests/demo-reality-loop.test.tsx tests/academic-route-pages.test.tsx tests/api-client.test.ts --reporter=dot
npx --no-install tsc -p tsconfig.tests.json --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 3: Run backend pack**

Run from `air-mentor-api`:

```bash
npx --no-install vitest run tests/academic-proof-routes.test.ts --reporter=dot --testTimeout=300000
npx --no-install tsc -p tsconfig.json --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 4: Run browser proof locally with Nix Firefox**

Use fresh frontend/backend ports. If repo Playwright and Nix browser mismatch, pin `PLAYWRIGHT_TEST_IMPORT` to the Nix `@playwright/test` module. Command pattern:

```bash
PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js \
AIRMENTOR_PW_DISABLE_VIDEO=1 \
AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 \
AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 \
nix develop -c playwright test tests-e2e/specs/guided-demo-reality-loop.spec.ts --config tests-e2e/playwright.config.ts --reporter=list
```

Expected: PASS.

---

## Self-Review

- **Spec coverage:** The tasks cover guided student selection, authoritative evidence display, attendance edit, recompute, before/after deltas, intervention resolution, next-stage validation, empty/error states, and browser proof.
- **Placeholder scan:** No `TBD`, `TODO`, `implement later`, or unbounded "handle edge cases" language remains.
- **Type consistency:** The plan uses existing `ApiStudentRiskExplorer`, `ApiStudentAgentCard`, `ApiAcademicFacultyProfile`, `ApiProofReassessmentResolveResponse`, and existing proof run callbacks. New method names are consistent across client, App, and dashboard wiring.
- **Claim boundary:** Plan is local-only and synthetic-demo-bounded; no deployment or real-data/production ML claim is introduced.
