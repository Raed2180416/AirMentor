import { expect, test } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'

const PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
const DEMO_POINTER_STORAGE_KEY = 'airmentor.activeDemoWorkspacePointer'

type ApiResponseLike = {
  ok(): boolean
  status(): number
  text(): Promise<string>
  json(): Promise<unknown>
}

type RequestContextLike = {
  get(url: string, options?: Record<string, unknown>): Promise<ApiResponseLike>
  post(url: string, options?: Record<string, unknown>): Promise<ApiResponseLike>
  delete(url: string, options?: Record<string, unknown>): Promise<ApiResponseLike>
}

type AdminSession = {
  csrfToken: string
  demoWorkspaceId: string | null
  faculty: { facultyId: string } | null
  activeRoleGrant: { roleCode: string }
}

type HierarchyIds = {
  academicFacultyId: string
  departmentId: string
  branchId: string
  batchId: string
}

type ProvisionedDemoWorkspace = {
  demoWorkspaceId: string
  activeSimulationRunId: string
  provisionedCounts: {
    students: number
    enrollments: number
    offerings: number
    ownerships: number
    runs: number
    checkpoints: number
    observedStates: number
    riskAssessments: number
  }
}

function csrfHeaders(csrfToken: string, demoWorkspaceId?: string) {
  return {
    'X-AirMentor-CSRF': csrfToken,
    ...(demoWorkspaceId ? { 'X-AirMentor-Demo-Workspace': demoWorkspaceId } : {}),
  }
}

async function readJson<T>(response: ApiResponseLike, label: string): Promise<T> {
  const text = await response.text()
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()}: ${text.slice(0, 800)}`)
  }
  return (text ? JSON.parse(text) : null) as T
}

async function postJson<T>(request: RequestContextLike, url: string, options: Record<string, unknown>, label: string) {
  return readJson<T>(await request.post(url, options), label)
}

async function loginWithOptionalDemo(
  request: RequestContextLike,
  role: 'system-admin' | 'course-leader' | 'hod',
  demoWorkspaceId?: string,
) {
  const actors = {
    'system-admin': { identifier: 'sysadmin', password: 'admin1234', roleCode: 'SYSTEM_ADMIN', facultyId: 'fac_sysadmin' },
    'course-leader': { identifier: 'rohit.menon', password: 'faculty1234', roleCode: 'COURSE_LEADER', facultyId: 'mnc_t2' },
    hod: { identifier: 'devika.shetty', password: 'faculty1234', roleCode: 'HOD', facultyId: 'mnc_t1' },
  } as const
  const actor = actors[role]
  let session = await postJson<AdminSession>(request, apiPath('/api/session/login'), {
    headers: demoWorkspaceId ? { 'X-AirMentor-Demo-Workspace': demoWorkspaceId } : {},
    data: { identifier: actor.identifier, password: actor.password },
  }, `Login as ${role}`)

  if (session.activeRoleGrant.roleCode !== actor.roleCode) {
    const availableRoleGrants = (session as unknown as { availableRoleGrants?: Array<{ grantId: string; roleCode: string; facultyId: string }> }).availableRoleGrants ?? []
    const targetGrant = availableRoleGrants.find(grant => grant.roleCode === actor.roleCode && grant.facultyId === actor.facultyId)
    if (!targetGrant) throw new Error(`Role ${actor.roleCode} is not available for seeded actor ${actor.identifier}.`)
    session = await postJson<AdminSession>(request, apiPath('/api/session/role-context'), {
      headers: csrfHeaders(session.csrfToken, demoWorkspaceId),
      data: { roleGrantId: targetGrant.grantId },
    }, `Switch role to ${actor.roleCode}`)
  }

  return { actor, session }
}

async function readProofHierarchy(request: RequestContextLike, csrfToken: string): Promise<HierarchyIds> {
  const [faculties, departments, branches, batches] = await Promise.all([
    readJson<{ items: Array<{ academicFacultyId: string }> }>(await request.get(apiPath('/api/admin/academic-faculties'), { headers: csrfHeaders(csrfToken) }), 'List academic faculties'),
    readJson<{ items: Array<{ departmentId: string; academicFacultyId: string }> }>(await request.get(apiPath('/api/admin/departments'), { headers: csrfHeaders(csrfToken) }), 'List departments'),
    readJson<{ items: Array<{ branchId: string; departmentId: string }> }>(await request.get(apiPath('/api/admin/branches'), { headers: csrfHeaders(csrfToken) }), 'List branches'),
    readJson<{ items: Array<{ batchId: string; branchId: string }> }>(await request.get(apiPath('/api/admin/batches'), { headers: csrfHeaders(csrfToken) }), 'List batches'),
  ])
  const batch = batches.items.find(item => item.batchId === PROOF_BATCH_ID)
  if (!batch) throw new Error(`Could not find proof batch ${PROOF_BATCH_ID}`)
  const branch = branches.items.find(item => item.branchId === batch.branchId)
  if (!branch) throw new Error(`Could not find proof branch for ${batch.batchId}`)
  const department = departments.items.find(item => item.departmentId === branch.departmentId)
  if (!department) throw new Error(`Could not find proof department for ${branch.branchId}`)
  const faculty = faculties.items.find(item => item.academicFacultyId === department.academicFacultyId)
  if (!faculty) throw new Error(`Could not find proof academic faculty for ${department.departmentId}`)
  return {
    academicFacultyId: faculty.academicFacultyId,
    departmentId: department.departmentId,
    branchId: branch.branchId,
    batchId: batch.batchId,
  }
}

async function resetDemoWorkspaceIfPresent(request: RequestContextLike, demoWorkspaceId: string | null, csrfToken: string | null) {
  if (!demoWorkspaceId || !csrfToken) return null
  const response = await request.delete(apiPath(`/api/admin/demo-workspaces/${encodeURIComponent(demoWorkspaceId)}`), {
    headers: csrfHeaders(csrfToken),
    failOnStatusCode: false,
  })
  if (response.status() === 404 || response.status() === 401) return null
  return readJson<{ deletedStudents: number; deletedOfferings: number; deletedRuns: number }>(response, `Reset demo workspace ${demoWorkspaceId}`)
}

async function signInSystemAdminThroughUi(page: { getByPlaceholder: (text: string | RegExp) => { fill(value: string): Promise<unknown> }; locator: (selector: string) => { first(): { fill(value: string): Promise<unknown> } }; getByRole: (role: 'button', options: { name: RegExp }) => { click(): Promise<unknown> }; waitForResponse: (predicate: (response: { url(): string; status(): number }) => boolean, options?: { timeout?: number }) => Promise<unknown> }) {
  await page.getByPlaceholder('sysadmin').fill('sysadmin')
  await page.locator('input[type="password"]').first().fill('admin1234')
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/session/login') && response.status() === 200, { timeout: 45_000 }),
    page.getByRole('button', { name: /^Sign In$/i }).click(),
  ])
}

async function signInAcademicThroughUi(
  page: {
    locator: (selector: string) => { fill(value: string): Promise<unknown> }
    getByRole: (role: 'button', options: { name: RegExp }) => { click(): Promise<unknown> }
    waitForResponse: (predicate: (response: { url(): string; status(): number }) => boolean, options?: { timeout?: number }) => Promise<unknown>
  },
  identifier: string,
  password: string,
) {
  await page.locator('#teacher-username').fill(identifier)
  await page.locator('#teacher-password').fill(password)
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/session/login') && response.status() === 200, { timeout: 45_000 }),
    page.getByRole('button', { name: /^Sign In$/i }).click(),
  ])
}

test('P5-D browser proof provisions seeded demo workspace, surfaces demo-bound roles, then reset invalidates demo sessions', async ({ page, request }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  let demoWorkspaceId: string | null = null
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })
  page.on('dialog', async dialog => {
    await dialog.accept()
  })

  try {
    const { session: sysadminSession } = await loginWithOptionalDemo(request, 'system-admin')
    const hierarchy = await readProofHierarchy(request, sysadminSession.csrfToken)

    await page.goto('/#/admin', { waitUntil: 'domcontentloaded' })
    await signInSystemAdminThroughUi(page)

    const adminRoute = `/#/admin/faculties/${hierarchy.academicFacultyId}/departments/${hierarchy.departmentId}/branches/${hierarchy.branchId}/batches/${hierarchy.batchId}`
    await page.goto(adminRoute, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('tab', { name: /Provision/i })).toBeVisible({ timeout: 60_000 })
    await page.getByRole('tab', { name: /Provision/i }).click()
    await expect(page.getByRole('button', { name: /Provision Seeded Demo Workspace/i })).toBeVisible({ timeout: 30_000 })

    const [provisionResponse] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/admin/demo-workspaces/') && response.url().includes('/provision') && response.status() === 200, { timeout: 180_000 }),
      page.getByRole('button', { name: /Provision Seeded Demo Workspace/i }).click(),
    ])
    const provisioned = await provisionResponse.json() as ProvisionedDemoWorkspace
    demoWorkspaceId = provisioned.demoWorkspaceId
    expect(demoWorkspaceId).toMatch(/^demo_ws_/)
    expect(provisioned.activeSimulationRunId).toMatch(/^demo_/)
    expect(provisioned.provisionedCounts.students).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.offerings).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.checkpoints).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.observedStates).toBeGreaterThan(0)
    expect(provisioned.provisionedCounts.riskAssessments).toBeGreaterThan(0)

    await page.waitForFunction(
      ([key, value]) => window.localStorage.getItem(key)?.includes(value),
      [DEMO_POINTER_STORAGE_KEY, demoWorkspaceId],
      { timeout: 30_000 },
    )

    const { session: demoCourseLeaderSession } = await loginWithOptionalDemo(request, 'course-leader', demoWorkspaceId)
    expect(demoCourseLeaderSession.demoWorkspaceId).toBe(demoWorkspaceId)
    const demoBootstrap = await request.get(apiPath('/api/academic/bootstrap'), {
      headers: { 'X-AirMentor-Demo-Workspace': demoWorkspaceId },
    })
    const demoBootstrapBody = await readJson<{ offerings: unknown[]; faculty: unknown[]; mentees: unknown[] }>(demoBootstrap, 'Read demo academic bootstrap')
    expect(demoBootstrapBody.offerings.length).toBeGreaterThan(0)
    expect(demoBootstrapBody.faculty.length).toBeGreaterThan(0)
    expect(demoBootstrapBody.mentees.length).toBeGreaterThan(0)

    await page.context().clearCookies()
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, JSON.stringify({ demoWorkspaceId: value })),
      [DEMO_POINTER_STORAGE_KEY, demoWorkspaceId],
    )
    await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
    await signInAcademicThroughUi(page, 'rohit.menon', 'faculty1234')
    const courseLeaderSummary = page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="course-leader-dashboard"]').first()
    await expect(courseLeaderSummary).toBeVisible({ timeout: 45_000 })
    await expect(courseLeaderSummary).toContainText(/Course Leader Dashboard/i)

    const { session: demoHodSession } = await loginWithOptionalDemo(request, 'hod', demoWorkspaceId)
    expect(demoHodSession.demoWorkspaceId).toBe(demoWorkspaceId)
    const demoProofBundle = await request.get(apiPath('/api/academic/hod/proof-bundle'), {
      headers: { 'X-AirMentor-Demo-Workspace': demoWorkspaceId },
    })
    const demoProofBundleBody = await readJson<{ summary?: { activeRunContext?: { simulationRunId?: string } | null } }>(demoProofBundle, 'Read demo HoD proof bundle')
    expect(demoProofBundleBody.summary?.activeRunContext?.simulationRunId).toBe(provisioned.activeSimulationRunId)

    await page.context().clearCookies()
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, JSON.stringify({ demoWorkspaceId: value })),
      [DEMO_POINTER_STORAGE_KEY, demoWorkspaceId],
    )
    const { session: browserHodSession } = await loginWithOptionalDemo(page.context().request as unknown as RequestContextLike, 'hod', demoWorkspaceId)
    expect(browserHodSession.demoWorkspaceId).toBe(demoWorkspaceId)
    const hodProofBundleResponse = page.waitForResponse(response => response.url().includes('/api/academic/hod/proof-bundle') && response.status() === 200, { timeout: 75_000 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await hodProofBundleResponse
    const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
    await expect(hodSurface).toBeVisible({ timeout: 45_000 })
    await expect(hodSurface).toContainText(/Department proof records for the active simulation run/i)

    const { session: resetAdminSession } = await loginWithOptionalDemo(request, 'system-admin')
    const resetBody = await resetDemoWorkspaceIfPresent(request, demoWorkspaceId, resetAdminSession.csrfToken)
    expect(resetBody?.deletedStudents).toBe(provisioned.provisionedCounts.students)
    expect(resetBody?.deletedRuns).toBe(1)

    const [restoreAfterReset] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/session') && response.status() === 401, { timeout: 45_000 }),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ])
    expect(restoreAfterReset.status()).toBe(401)
    demoWorkspaceId = null
  } finally {
    if (demoWorkspaceId) {
      const { session } = await loginWithOptionalDemo(request, 'system-admin')
      await resetDemoWorkspaceIfPresent(request, demoWorkspaceId, session.csrfToken)
    }
  }

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
