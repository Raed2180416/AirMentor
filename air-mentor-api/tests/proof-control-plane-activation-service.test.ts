import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import { simulationRuns, simulationStageCheckpoints } from '../src/db/schema.js'
import { activateProofOperationalSemester } from '../src/lib/proof-control-plane-activation-service.js'

const TEST_NOW = '2026-03-16T00:00:00.000Z'

type MockRun = {
  simulationRunId: string
  batchId: string
  semesterStart: number
  semesterEnd: number
  activeOperationalSemester: number | null
  activeFlag: number
  updatedAt: string
}

type MockCheckpoint = {
  simulationRunId: string
  semesterNumber: number
  stageOrder: number
}

function createMockDb(options?: {
  run?: Partial<MockRun>
  checkpoints?: MockCheckpoint[]
}) {
  let run: MockRun = {
    simulationRunId: 'run_001',
    batchId: 'batch_001',
    semesterStart: 1,
    semesterEnd: 6,
    activeOperationalSemester: 6,
    activeFlag: 1,
    updatedAt: '2026-03-15T00:00:00.000Z',
    ...options?.run,
  }
  const checkpoints = options?.checkpoints ?? [
    { simulationRunId: run.simulationRunId, semesterNumber: 1, stageOrder: 1 },
    { simulationRunId: run.simulationRunId, semesterNumber: 2, stageOrder: 1 },
    { simulationRunId: run.simulationRunId, semesterNumber: 3, stageOrder: 1 },
    { simulationRunId: run.simulationRunId, semesterNumber: 4, stageOrder: 1 },
    { simulationRunId: run.simulationRunId, semesterNumber: 5, stageOrder: 1 },
    { simulationRunId: run.simulationRunId, semesterNumber: 6, stageOrder: 1 },
  ]

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === simulationRuns) {
            return {
              where: async () => [run],
            }
          }
          if (table === simulationStageCheckpoints) {
            return {
              where() {
                return {
                  orderBy: async () => checkpoints,
                }
              },
            }
          }
          throw new Error('Unexpected table in select mock')
        },
      }
    },
    update(table: unknown) {
      if (table !== simulationRuns) {
        throw new Error('Unexpected table in update mock')
      }
      return {
        set(values: Partial<MockRun>) {
          return {
            where: async () => {
              run = { ...run, ...values }
            },
          }
        },
      }
    },
  } as unknown as AppDb

  return {
    db,
    getRun: () => run,
  }
}

describe('proof-control-plane-activation-service', () => {
  it('updates the active operational semester, publishes the active projection, and emits audit payload details', async () => {
    const { db, getRun } = createMockDb()
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
    }

    const result = await activateProofOperationalSemester(db, {
      simulationRunId: 'run_001',
      semesterNumber: 4,
      actorFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    }, deps)

    expect(result).toEqual({
      ok: true,
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      activeOperationalSemester: 4,
      previousOperationalSemester: 6,
    })

    expect(getRun()).toMatchObject({
      activeOperationalSemester: 4,
      updatedAt: TEST_NOW,
    })
    expect(deps.publishOperationalProjection).toHaveBeenCalledTimes(1)
    expect(deps.publishOperationalProjection).toHaveBeenCalledWith(db, {
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      now: TEST_NOW,
    })
    expect(deps.emitSimulationAudit).toHaveBeenCalledTimes(1)
    expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, {
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      actionType: 'semester-activated',
      payload: {
        previousOperationalSemester: 6,
        activeOperationalSemester: 4,
        availableSemesters: [1, 2, 3, 4, 5, 6],
      },
      createdByFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    })
  })

  it('does not republish projections when the target proof run is inactive', async () => {
    const { db } = createMockDb({
      run: {
        activeFlag: 0,
      },
    })
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
    }

    const result = await activateProofOperationalSemester(db, {
      simulationRunId: 'run_001',
      semesterNumber: 5,
      actorFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    }, deps)

    expect(result).toMatchObject({
      ok: true,
      simulationRunId: 'run_001',
      activeOperationalSemester: 5,
      previousOperationalSemester: 6,
    })
    expect(deps.publishOperationalProjection).not.toHaveBeenCalled()
    expect(deps.emitSimulationAudit).toHaveBeenCalledTimes(1)
  })

  it('rejects semesters outside the proof run range before mutating state or audit', async () => {
    const { db, getRun } = createMockDb()
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
    }

    await expect(activateProofOperationalSemester(db, {
      simulationRunId: 'run_001',
      semesterNumber: 7,
      actorFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    }, deps)).rejects.toThrow('Semester 7 is outside the proof run range 1-6')

    expect(getRun()).toMatchObject({
      activeOperationalSemester: 6,
      updatedAt: '2026-03-15T00:00:00.000Z',
    })
    expect(deps.publishOperationalProjection).not.toHaveBeenCalled()
    expect(deps.emitSimulationAudit).not.toHaveBeenCalled()
  })
})
