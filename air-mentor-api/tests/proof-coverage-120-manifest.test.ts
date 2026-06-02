import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
  students,
} from '../src/db/schema.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

function increment(record: Record<string, number>, key: string | null | undefined) {
  const safeKey = key && key.length > 0 ? key : 'unknown'
  record[safeKey] = (record[safeKey] ?? 0) + 1
}

describe('proof coverage manifest for the seeded 120-student demo', () => {
  it('covers all students at every checkpoint and keeps high-risk students visible in queue governance', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin@airmentor.local', 'admin1234')
    const [run] = await current.db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1))
    expect(run).toBeTruthy()

    const recomputeResponse = await current.app.inject({
      method: 'POST',
      url: `/api/admin/proof-runs/${run.simulationRunId}/recompute-risk`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: {},
    })
    expect(recomputeResponse.statusCode).toBe(200)

    const [studentRows, checkpointRows, projectionRows] = await Promise.all([
      current.db.select().from(students),
      current.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, run.simulationRunId)),
      current.db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, run.simulationRunId)),
    ])
    const proofStudentIds = new Set(
      studentRows
        .filter(row => row.studentId.startsWith('mnc_student_'))
        .map(row => row.studentId),
    )
    const projectionsByCheckpointId = new Map<string, typeof projectionRows>()
    const riskBandCounts: Record<string, number> = {}
    const queueStateCounts: Record<string, number> = {}
    const highRows: Array<Record<string, unknown>> = []
    let driverlessHighRowCount = 0

    for (const row of projectionRows) {
      const rows = projectionsByCheckpointId.get(row.simulationStageCheckpointId) ?? []
      rows.push(row)
      projectionsByCheckpointId.set(row.simulationStageCheckpointId, rows)
      increment(riskBandCounts, row.riskBand)
      increment(queueStateCounts, row.queueState)
      if (row.riskBand === 'High') {
        const payload = JSON.parse(row.projectionJson || '{}') as {
          currentStatus?: { observableDrivers?: unknown[] }
        }
        const drivers = payload.currentStatus?.observableDrivers
        if (!Array.isArray(drivers) || drivers.length === 0) driverlessHighRowCount += 1
        highRows.push({
          studentId: row.studentId,
          semesterNumber: row.semesterNumber,
          evidenceWindow: row.evidenceWindow,
          courseCode: row.courseCode,
          riskProbScaled: row.riskProbScaled,
          queueState: row.queueState,
        })
      }
    }

    const checkpointCoverage = checkpointRows
      .slice()
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
      .map(checkpoint => {
        const rows = projectionsByCheckpointId.get(checkpoint.simulationStageCheckpointId) ?? []
        const uniqueStudents = new Set(rows.map(row => row.studentId))
        return {
          checkpointId: checkpoint.simulationStageCheckpointId,
          semesterNumber: checkpoint.semesterNumber,
          stageKey: checkpoint.stageKey,
          projectionRowCount: rows.length,
          uniqueStudentCount: uniqueStudents.size,
          missingStudentCount: [...proofStudentIds].filter(studentId => !uniqueStudents.has(studentId)).length,
        }
      })
    const badCheckpointCoverage = checkpointCoverage.filter(row => row.uniqueStudentCount !== 120 || row.missingStudentCount !== 0)

    const highStudentStageMap = new Map<string, {
      studentId: string
      semesterNumber: number
      evidenceWindow: string
      highRowCount: number
      nonIdleQueueRowCount: number
      queueStates: Record<string, number>
    }>()
    for (const row of projectionRows) {
      if (row.riskBand !== 'High') continue
      const key = `${row.studentId}::${row.semesterNumber}::${row.evidenceWindow}`
      const entry = highStudentStageMap.get(key) ?? {
        studentId: row.studentId,
        semesterNumber: row.semesterNumber,
        evidenceWindow: row.evidenceWindow,
        highRowCount: 0,
        nonIdleQueueRowCount: 0,
        queueStates: {},
      }
      entry.highRowCount += 1
      if (row.queueState !== 'idle') entry.nonIdleQueueRowCount += 1
      increment(entry.queueStates, row.queueState)
      highStudentStageMap.set(key, entry)
    }
    const highStudentStageGaps = [...highStudentStageMap.values()].filter(row => row.nonIdleQueueRowCount === 0)

    const manifest = {
      generatedAt: new Date().toISOString(),
      runId: run.simulationRunId,
      studentCount: proofStudentIds.size,
      checkpointCount: checkpointRows.length,
      projectionRowCount: projectionRows.length,
      riskBandCounts,
      queueStateCounts,
      checkpointCoverage,
      badCheckpointCoverage,
      highRowCount: highRows.length,
      highStudentStageCount: highStudentStageMap.size,
      highStudentStageGaps,
      driverlessHighRowCount,
      highRows: highRows.slice(0, 40),
    }
    const outputDir = path.resolve(process.cwd(), 'output/proof-coverage')
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      path.join(outputDir, 'proof-coverage-120-manifest-2026-06-01.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )

    expect(proofStudentIds.size).toBe(120)
    expect(checkpointRows).toHaveLength(30)
    expect(projectionRows).toHaveLength(21_600)
    expect(badCheckpointCoverage).toEqual([])
    expect(highRows.length).toBeGreaterThan(0)
    expect(highStudentStageGaps).toEqual([])
    expect(driverlessHighRowCount).toBe(0)
  }, 120_000)
})
