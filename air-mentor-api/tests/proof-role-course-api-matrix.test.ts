import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { simulationRuns } from '../src/db/schema.js'
import { activateProofOperationalSemester } from '../src/lib/msruas-proof-control-plane.js'
import { createTestApp, loginAs, TEST_NOW, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

type JsonRecord = Record<string, unknown>

const roleFixtures = {
  sysadmin: { identifier: 'sysadmin', password: 'admin1234', roleCode: 'SYSTEM_ADMIN', facultyId: 'fac_sysadmin' },
  courseLeader: { identifier: 'rohit.menon', password: 'faculty1234', roleCode: 'COURSE_LEADER', facultyId: 'mnc_t2' },
  mentor: { identifier: 'harish.bhat', password: 'faculty1234', roleCode: 'MENTOR', facultyId: 'mnc_t8' },
  hod: { identifier: 'devika.shetty', password: 'faculty1234', roleCode: 'HOD', facultyId: 'mnc_t1' },
} as const

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readPath(value: unknown, pathParts: string[]) {
  let cursor = value
  for (const part of pathParts) {
    if (!isRecord(cursor)) return null
    cursor = cursor[part]
  }
  return cursor ?? null
}

function countArrays(value: unknown, targetKeys: Set<string>, prefix = ''): Record<string, number> {
  if (!isRecord(value)) return {}
  const output: Record<string, number> = {}
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(child) && targetKeys.has(key)) {
      output[childPath] = child.length
    } else if (isRecord(child)) {
      Object.assign(output, countArrays(child, targetKeys, childPath))
    }
  }
  return output
}

function countStudentsByOffering(value: unknown): number {
  if (!isRecord(value)) return 0
  return Object.values(value).reduce<number>((sum, item) => sum + (Array.isArray(item) ? item.length : 0), 0)
}

function checkpointIdSeen(payload: unknown, checkpointId: string) {
  const candidatePaths = [
    ['checkpoint', 'simulationStageCheckpointId'],
    ['proofPlayback', 'simulationStageCheckpointId'],
    ['proofOperations', 'selectedCheckpoint', 'simulationStageCheckpointId'],
    ['summary', 'activeRunContext', 'checkpointContext', 'simulationStageCheckpointId'],
    ['summary', 'activeRunContext', 'simulationStageCheckpointId'],
    ['summary', 'selectedCheckpoint', 'simulationStageCheckpointId'],
    ['activeRunContext', 'simulationStageCheckpointId'],
  ]
  return candidatePaths.some(parts => readPath(payload, parts) === checkpointId)
}

function inferEndpointCounts(payload: unknown): Record<string, number> {
  const counts = countArrays(payload, new Set([
    'items',
    'students',
    'courses',
    'faculty',
    'offerings',
    'mentees',
    'monitoringQueue',
    'reassessments',
    'studentWatchRows',
    'courseRollups',
    'facultyRollups',
    'queuePreview',
    'offeringRollups',
  ]))
  const studentsByOffering = readPath(payload, ['studentsByOffering'])
  const studentsByOfferingCount = countStudentsByOffering(studentsByOffering)
  if (studentsByOfferingCount > 0) counts.studentsByOffering = studentsByOfferingCount
  return counts
}

async function switchToRole(cookie: string, availableRoleGrants: Array<{ grantId: string; roleCode: string }>, roleCode: string) {
  if (!current) throw new Error('Missing test app')
  const grant = availableRoleGrants.find(item => item.roleCode === roleCode)
  expect(grant).toBeTruthy()
  const response = await current.app.inject({
    method: 'POST',
    url: '/api/session/role-context',
    headers: { cookie, origin: TEST_ORIGIN },
    payload: { roleGrantId: grant!.grantId },
  })
  expect(response.statusCode).toBe(200)
}

async function loginFixture(fixture: typeof roleFixtures[keyof typeof roleFixtures]) {
  if (!current) throw new Error('Missing test app')
  const login = await loginAs(current.app, fixture.identifier, fixture.password)
  expect(login.response.statusCode).toBe(200)
  if (login.body.activeRoleGrant?.roleCode !== fixture.roleCode) {
    await switchToRole(login.cookie, login.body.availableRoleGrants ?? [], fixture.roleCode)
  }
  return login
}

async function injectJson(cookie: string, method: 'GET' | 'POST', url: string, payload?: unknown) {
  if (!current) throw new Error('Missing test app')
  const response = await current.app.inject({
    method,
    url,
    headers: { cookie, origin: TEST_ORIGIN },
    payload,
  } as any)
  const body = response.payload ? response.json() : null
  return { statusCode: response.statusCode, body }
}

describe('proof role/course API matrix', () => {
  it('exports checkpoint-scoped sysadmin, course leader, mentor, and HoD API evidence across the seeded proof ladder', async () => {
    current = await createTestApp()
    const sysadmin = await loginFixture(roleFixtures.sysadmin)
    const courseLeader = await loginFixture(roleFixtures.courseLeader)
    const mentor = await loginFixture(roleFixtures.mentor)
    const hod = await loginFixture(roleFixtures.hod)

    const [activeRun] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(activeRun).toBeTruthy()
    await activateProofOperationalSemester(current.db, {
      simulationRunId: activeRun.simulationRunId,
      semesterNumber: 1,
      actorFacultyId: null,
      now: TEST_NOW,
    })

    const recomputeResponse = await injectJson(
      sysadmin.cookie,
      'POST',
      `/api/admin/proof-runs/${encodeURIComponent(activeRun.simulationRunId)}/recompute-risk`,
      {},
    )
    expect(recomputeResponse.statusCode).toBe(200)

    const { rows: checkpointRows } = await current.pool.query(`
      select *
      from simulation_stage_checkpoints
      where simulation_run_id = $1
      order by semester_number, stage_order
    `, [activeRun.simulationRunId])
    const { rows: projectionSummaryRows } = await current.pool.query(`
      select
        simulation_stage_checkpoint_id,
        count(*)::int as projection_count,
        count(distinct student_id)::int as student_count,
        count(distinct course_code)::int as course_count,
        count(*) filter (where risk_band = 'High')::int as high_rows,
        count(*) filter (where risk_band = 'Medium')::int as medium_rows,
        count(*) filter (where queue_state <> 'idle')::int as non_idle_queue_rows
      from simulation_stage_student_projections
      where simulation_run_id = $1
      group by simulation_stage_checkpoint_id
    `, [activeRun.simulationRunId])
    const dbSummaryByCheckpoint = new Map(projectionSummaryRows.map(row => [row.simulation_stage_checkpoint_id, row]))

    const matrix: Array<JsonRecord> = []
    const failures: Array<JsonRecord> = []
    for (const checkpoint of checkpointRows) {
      const checkpointId = checkpoint.simulation_stage_checkpoint_id as string
      const dbSummary = dbSummaryByCheckpoint.get(checkpointId)
      const endpoints = [
        {
          role: 'system-admin',
          cookie: sysadmin.cookie,
          endpoint: `/api/admin/proof-runs/${encodeURIComponent(activeRun.simulationRunId)}/checkpoints/${encodeURIComponent(checkpointId)}`,
        },
        {
          role: 'course-leader',
          cookie: courseLeader.cookie,
          endpoint: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        },
        {
          role: 'course-leader-profile',
          cookie: courseLeader.cookie,
          endpoint: `/api/academic/faculty-profile/${roleFixtures.courseLeader.facultyId}?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        },
        {
          role: 'mentor',
          cookie: mentor.cookie,
          endpoint: `/api/academic/bootstrap?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        },
        {
          role: 'mentor-profile',
          cookie: mentor.cookie,
          endpoint: `/api/academic/faculty-profile/${roleFixtures.mentor.facultyId}?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        },
        {
          role: 'hod',
          cookie: hod.cookie,
          endpoint: `/api/academic/hod/proof-bundle?simulationStageCheckpointId=${encodeURIComponent(checkpointId)}`,
        },
      ]

      for (const endpoint of endpoints) {
        const response = await injectJson(endpoint.cookie, 'GET', endpoint.endpoint)
        const body = response.body
        const row = {
          semesterNumber: checkpoint.semester_number,
          stageKey: checkpoint.stage_key,
          checkpointId,
          role: endpoint.role,
          endpoint: endpoint.endpoint.replace(checkpointId, ':checkpointId'),
          statusCode: response.statusCode,
          responseHash: response.statusCode === 200 ? stableHash(body) : null,
          checkpointMatched: response.statusCode === 200 ? checkpointIdSeen(body, checkpointId) : false,
          endpointCounts: response.statusCode === 200 ? inferEndpointCounts(body) : {},
          dbEvidence: {
            projectionRows: Number(dbSummary?.projection_count ?? 0),
            students: Number(dbSummary?.student_count ?? 0),
            courses: Number(dbSummary?.course_count ?? 0),
            highRows: Number(dbSummary?.high_rows ?? 0),
            mediumRows: Number(dbSummary?.medium_rows ?? 0),
            nonIdleQueueRows: Number(dbSummary?.non_idle_queue_rows ?? 0),
          },
        }
        matrix.push(row)
        if (row.statusCode !== 200 || !row.checkpointMatched) {
          failures.push({
            semesterNumber: row.semesterNumber,
            stageKey: row.stageKey,
            role: row.role,
            statusCode: row.statusCode,
            checkpointMatched: row.checkpointMatched,
          })
        }
      }
    }

    const badDbCoverage = checkpointRows
      .map(checkpoint => {
        const dbSummary = dbSummaryByCheckpoint.get(checkpoint.simulation_stage_checkpoint_id)
        return {
          checkpointId: checkpoint.simulation_stage_checkpoint_id,
          semesterNumber: checkpoint.semester_number,
          stageKey: checkpoint.stage_key,
          projectionRows: Number(dbSummary?.projection_count ?? 0),
          students: Number(dbSummary?.student_count ?? 0),
          courses: Number(dbSummary?.course_count ?? 0),
        }
      })
      .filter(row => row.projectionRows !== 720 || row.students !== 120 || row.courses === 0)

    const artifact = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 'proof-role-course-api-matrix.v1',
      run: {
        simulationRunId: activeRun.simulationRunId,
        batchId: activeRun.batchId,
      },
      summary: {
        checkpointCount: checkpointRows.length,
        roleEndpointRows: matrix.length,
        statusFailures: matrix.filter(row => row.statusCode !== 200).length,
        checkpointMatchFailures: matrix.filter(row => row.checkpointMatched !== true).length,
        badDbCoverage,
      },
      matrix,
      failures,
    }
    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      path.join(outputDir, 'proof-role-course-api-matrix-2026-06-01.json'),
      `${JSON.stringify(artifact, null, 2)}\n`,
    )

    expect(checkpointRows).toHaveLength(30)
    expect(matrix).toHaveLength(30 * 6)
    expect(badDbCoverage).toEqual([])
    expect(failures).toEqual([])
  }, 180_000)
})
