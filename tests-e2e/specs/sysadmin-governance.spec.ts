import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test.describe('Sysadmin Governance Control Plane', () => {
  test.setTimeout(120000)

  test('Sysadmin Governance Control Plane Test', async ({ page, seededRun, request }) => {
    // Login as sysadmin
    const { session } = await loginWithApiContext(request, 'system-admin')
    const headers = { 'X-AirMentor-CSRF': session.csrfToken }

    // 1. Global Policy Setup (CE/SEE rules, risk thresholds)
    const policyRes = await request.get(apiPath(`/api/admin/batches/${seededRun.batchId}/resolved-policy`), { headers })
    expect(policyRes.ok()).toBeTruthy()
    const policy = await policyRes.json()
    expect(policy.resolvedThresholds).toBeDefined()
    expect(policy.resolvedRules).toBeDefined()

    // 2. Hierarchy & Faculties Workspace (departments, profiles)
    const facultiesRes = await request.get(apiPath(`/api/admin/academic-faculties`), { headers })
    expect(facultiesRes.ok()).toBeTruthy()
    const faculties = await facultiesRes.json()
    expect(faculties.items.length).toBeGreaterThan(0)

    const deptsRes = await request.get(apiPath(`/api/admin/departments`), { headers })
    expect(deptsRes.ok()).toBeTruthy()
    const depts = await deptsRes.json()
    expect(depts.items.length).toBeGreaterThan(0)

    // 3. Role Assignments (granting HoD/Course Leader)
    const facultyRes = await request.get(apiPath(`/api/admin/faculty`), { headers })
    expect(facultyRes.ok()).toBeTruthy()
    const faculty = await facultyRes.json()
    expect(faculty.items.length).toBeGreaterThan(0)
    
    const hods = faculty.items.filter((f: any) => f.roleGrants?.some((g: any) => g.roleCode === 'HOD'))
    const courseLeaders = faculty.items.filter((f: any) => f.roleGrants?.some((g: any) => g.roleCode === 'COURSE_LEADER'))
    expect(hods.length).toBeGreaterThan(0)
    expect(courseLeaders.length).toBeGreaterThan(0)

    // 4. Curriculum Feature Mapping (prerequisite mapping UI)
    const currRes = await request.get(apiPath(`/api/admin/batches/${seededRun.batchId}/curriculum-feature-config`), { headers })
    expect(currRes.ok()).toBeTruthy()
    const curr = await currRes.json()
    expect(curr.config).toBeDefined()

    // 5. Scoped Registry Launches / System Audit trails
    const auditRes = await request.get(apiPath(`/api/admin/audit-events/recent?limit=80`), { headers })
    expect(auditRes.ok()).toBeTruthy()
    const audit = await auditRes.json()
    expect(audit.items.length).toBeGreaterThan(0)

    // Open the UI to ensure the Sysadmin Control Plane mounts properly
    await page.goto('/#/admin', { waitUntil: 'domcontentloaded' })
    await loginAs(page, 'system-admin')
    await page.goto('/#/admin', { waitUntil: 'networkidle' })

    // Verify the UI loads successfully (e.g. finding a main dashboard element or the user profile name)
    await expect(page.locator('text=Sysadmin').first()).toBeVisible()

    // Just log out
    const logoutButton = page.getByRole('button', { name: 'Logout', exact: true }).first()
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click()
    }
  })
})
