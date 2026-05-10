import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestApp, loginAs, TEST_NOW, TEST_ORIGIN } from './helpers/test-app.js'
import {
  students,
  sectionOfferings,
  simulationRuns,
  demoWorkspaces,
  batches,
} from '../src/db/schema.js'
import {
  assertSafeDemoScopeName,
  buildDemoScopeName,
  demoWorkspaceSchemaExists,
  quotePgIdentifier,
} from '../src/lib/demo-workspace-scope.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('demo workspace isolation', () => {
  it('builds safe demo schema names and rejects unsafe identifiers', async () => {
    expect(buildDemoScopeName('demo_ws_abc123')).toBe('demo_ws_demo_ws_abc123')
    expect(buildDemoScopeName('demo-ws-ABC.123')).toBe('demo_ws_demo_ws_abc_123')
    expect(() => assertSafeDemoScopeName('demo_ws_good_123')).not.toThrow()
    expect(() => assertSafeDemoScopeName('public')).toThrow(/Unsafe demo scope name/)
    expect(() => assertSafeDemoScopeName('demo_ws_bad;drop')).toThrow(/Unsafe demo scope name/)
    expect(quotePgIdentifier('demo_ws_good_123')).toBe('"demo_ws_good_123"')
  })

  it('creates demo workspaces with schema-scope registry metadata', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const [batch] = await current.db.select().from(batches)
    expect(batch).toBeTruthy()

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Schema Scope Demo', batchId: batch.batchId },
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
    expect(body.sourceBatchId).toBe(batch.batchId)

    const [row] = await current.db
      .select()
      .from(demoWorkspaces)
      .where(eq(demoWorkspaces.demoWorkspaceId, body.demoWorkspaceId))
    expect(row.scopeKind).toBe('schema')
    expect(row.scopeName).toBe(body.scopeName)
    expect(row.sourceBatchId).toBe(batch.batchId)
    expect(row.createdByFacultyId).toBeTruthy()
    expect(await demoWorkspaceSchemaExists(current.pool, body.scopeName ?? '')).toBe(true)
  })

  it('creates, lists, and resets a demo workspace without touching live data', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    // Snapshot global counts before any demo data
    const baseStudents = await current.db.select().from(students)
    const baseOfferings = await current.db.select().from(sectionOfferings)
    const baseRuns = await current.db.select().from(simulationRuns)

    // 1 — Create demo workspace
    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'College Demo Jan 2026' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }
    expect(demoWs.demoWorkspaceId).toBeTruthy()

    // 2 — List confirms workspace is present
    const listRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(listRes.statusCode).toBe(200)
    const listed = listRes.json() as Array<{ demoWorkspaceId: string }>
    expect(listed.some(r => r.demoWorkspaceId === demoWs.demoWorkspaceId)).toBe(true)

    // 3 — Insert demo-tagged rows directly to simulate provisioned data
    const { branches, courses, academicTerms, institutions } = await import('../src/db/schema.js')
    const [firstBranch] = await current.db.select().from(branches)
    const [firstCourse] = await current.db.select().from(courses)
    const [firstTerm] = await current.db.select().from(academicTerms)
    const [firstInstitution] = await current.db.select().from(institutions)
    expect(firstBranch).toBeTruthy()
    expect(firstCourse).toBeTruthy()
    expect(firstTerm).toBeTruthy()
    expect(firstInstitution).toBeTruthy()

    const demoStudentId = `student_demo_test_${Date.now()}`
    await current.db.insert(students).values({
      studentId: demoStudentId,
      institutionId: firstInstitution.institutionId,
      usn: 'DEMO001',
      rollNumber: null,
      name: 'Demo Student One',
      email: null,
      phone: null,
      admissionDate: TEST_NOW,
      status: 'active',
      demoWorkspaceId: demoWs.demoWorkspaceId,
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    const demoOfferingId = `offering_demo_test_${Date.now()}`
    await current.db.insert(sectionOfferings).values({
      offeringId: demoOfferingId,
      courseId: firstCourse.courseId,
      termId: firstTerm.termId,
      branchId: firstBranch.branchId,
      sectionCode: 'DEMO-A',
      yearLabel: '1 Year',
      attendance: 0,
      studentCount: 0,
      stage: 1,
      stageLabel: 'Demo',
      stageDescription: 'Demo offering',
      stageColor: '#888',
      tt1Done: 0,
      tt2Done: 0,
      tt1Locked: 0,
      tt2Locked: 0,
      quizLocked: 0,
      assignmentLocked: 0,
      finalsLocked: 0,
      pendingAction: null,
      status: 'active',
      demoWorkspaceId: demoWs.demoWorkspaceId,
      version: 1,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    })

    // 4 — Counts increased by exactly the inserted demo rows
    const midStudents = await current.db.select().from(students)
    const midOfferings = await current.db.select().from(sectionOfferings)
    expect(midStudents.length).toBe(baseStudents.length + 1)
    expect(midOfferings.length).toBe(baseOfferings.length + 1)

    // 5 — Reset demo workspace via API
    const resetRes = await current.app.inject({
      method: 'DELETE',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(resetRes.statusCode).toBe(200)
    const resetBody = resetRes.json() as { deletedStudents: number; deletedOfferings: number; deletedRuns: number }
    expect(resetBody.deletedStudents).toBe(1)
    expect(resetBody.deletedOfferings).toBe(1)
    expect(resetBody.deletedRuns).toBe(0)

    // 6 — Global counts returned to baseline; no demo residue
    const afterStudents = await current.db.select().from(students)
    const afterOfferings = await current.db.select().from(sectionOfferings)
    const afterRuns = await current.db.select().from(simulationRuns)
    expect(afterStudents.length).toBe(baseStudents.length)
    expect(afterOfferings.length).toBe(baseOfferings.length)
    expect(afterRuns.length).toBe(baseRuns.length)

    // 7 — Workspace record itself is gone
    const wsRow = await current.db
      .select()
      .from(demoWorkspaces)
      .where(eq(demoWorkspaces.demoWorkspaceId, demoWs.demoWorkspaceId))
    expect(wsRow.length).toBe(0)

    // 8 — List is now empty (or back to pre-test count)
    const listAfterRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(listAfterRes.statusCode).toBe(200)
    const listedAfter = listAfterRes.json() as Array<{ demoWorkspaceId: string }>
    expect(listedAfter.some(r => r.demoWorkspaceId === demoWs.demoWorkspaceId)).toBe(false)
  })

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

    const quotedScopeName = quotePgIdentifier(demoWs.scopeName ?? '')
    await current.pool.query(`CREATE TABLE ${quotedScopeName}.demo_marker (id TEXT PRIMARY KEY)`)
    await current.pool.query(`INSERT INTO ${quotedScopeName}.demo_marker (id) VALUES ('marker_1')`)

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

  it('preview provisioning returns estimated counts', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createRes = await current.app.inject({
      method: 'POST',
      url: '/api/admin/demo-workspaces',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { name: 'Preview Test WS' },
    })
    expect(createRes.statusCode).toBe(200)
    const demoWs = createRes.json() as { demoWorkspaceId: string }

    // Fetch a valid batchId and termId from the seeded DB
    const { batches, academicTerms } = await import('../src/db/schema.js')
    const [batch] = await current.db.select().from(batches)
    const [term] = await current.db.select().from(academicTerms).where(
      eq(academicTerms.batchId, batch.batchId),
    )
    expect(batch).toBeTruthy()
    expect(term).toBeTruthy()

    const previewRes = await current.app.inject({
      method: 'POST',
      url: `/api/admin/demo-workspaces/${demoWs.demoWorkspaceId}/provision/preview`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {
        batchId: batch.batchId,
        termId: term.termId,
        sectionLabels: ['A', 'B'],
        studentsPerSection: 30,
      },
    })
    expect(previewRes.statusCode).toBe(200)
    const preview = previewRes.json() as {
      estimatedStudentCount: number
      estimatedOfferingCount: number
      sections: string[]
    }
    expect(preview.estimatedStudentCount).toBe(60)
    expect(preview.sections).toEqual(['A', 'B'])
    expect(preview.estimatedOfferingCount).toBeGreaterThanOrEqual(0)
  })
})
