import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import { batches, simulationRuns, simulationStageCheckpoints } from '../src/db/schema.js'
import { activateProofOperationalSemester } from '../src/adapters/simulation/proof-control-plane-activation-service.js'

const TEST_NOW = '2026-03-16T00:00:00.000Z'

type MockRun = {
  simulationRunId: string
  batchId: string
  semesterStart: number
  semesterEnd: number
  activeOperationalSemester: number | null
  activeFlag: number
  activeStageKey?: string | null
  simulatedDateIso?: string | null
  lifecycleState?: string | null
  stageBoundaryJson?: string | null
  updatedAt: string
}

type MockCheckpoint = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
}

type MockBatch = {
  batchId: string
  currentSemester: number
  updatedAt: string
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
    activeStageKey: 'pre-tt1',
    simulatedDateIso: '2026-03-15T00:00:00.000Z',
    lifecycleState: 'completed-inspectable',
    stageBoundaryJson: null,
    updatedAt: '2026-03-15T00:00:00.000Z',
    ...options?.run,
  }
  const checkpoints = options?.checkpoints ?? [
    { simulationStageCheckpointId: 'cp_1_pre', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_2_pre', simulationRunId: run.simulationRunId, semesterNumber: 2, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_3_pre', simulationRunId: run.simulationRunId, semesterNumber: 3, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_4_pre', simulationRunId: run.simulationRunId, semesterNumber: 4, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_5_pre', simulationRunId: run.simulationRunId, semesterNumber: 5, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_6_pre', simulationRunId: run.simulationRunId, semesterNumber: 6, stageKey: 'pre-tt1', stageOrder: 1 },
  ]
  let batch: MockBatch = {
    batchId: run.batchId,
    currentSemester: run.activeOperationalSemester ?? run.semesterEnd,
    updatedAt: '2026-03-15T00:00:00.000Z',
  }

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
      if (table === simulationRuns) {
        return {
          set(values: Partial<MockRun>) {
            return {
              where: async () => {
                run = { ...run, ...values }
              },
            }
          },
        }
      }
      if (table === batches) {
        return {
          set(values: Partial<MockBatch>) {
            return {
              where: async () => {
                batch = { ...batch, ...values }
              },
            }
          },
        }
      }
      throw new Error('Unexpected table in update mock')
    },
  } as unknown as AppDb

  return {
    db,
    getRun: () => run,
    getBatch: () => batch,
  }
}

describe('proof-control-plane-activation-service', () => {
  it('updates the active operational semester, publishes the active projection, and emits audit payload details', async () => {
    const { db, getRun, getBatch } = createMockDb()
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
      activeStageKey: 'pre-tt1',
      lifecycleState: 'active',
      updatedAt: TEST_NOW,
    })
    expect(JSON.parse(String(getRun().stageBoundaryJson))).toMatchObject({
      strictlyMonotonic: true,
      availableSemesters: [1, 2, 3, 4, 5, 6],
    })
    expect(getBatch()).toMatchObject({
      currentSemester: 4,
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
        previousLifecycleState: 'completed-inspectable',
        lifecycleState: 'active',
        activeStageKey: 'pre-tt1',
        availableSemesters: [1, 2, 3, 4, 5, 6],
      },
      createdByFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    })
  })

  it('does not republish projections when the target proof run is inactive', async () => {
    const { db, getBatch } = createMockDb({
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
    expect(getBatch()).toMatchObject({
      currentSemester: 5,
      updatedAt: TEST_NOW,
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

  it('activates a fresh semester at the entry stage and stamps lifecycle authority', async () => {
    const { db, getRun } = createMockDb({
      run: {
        activeOperationalSemester: null,
        activeStageKey: null,
        simulatedDateIso: null,
        lifecycleState: 'completed',
      },
      checkpoints: [
        { simulationStageCheckpointId: 'cp_1_pre', simulationRunId: 'run_001', semesterNumber: 1, stageKey: 'pre-tt1', stageOrder: 1 },
        { simulationStageCheckpointId: 'cp_1_tt1', simulationRunId: 'run_001', semesterNumber: 1, stageKey: 'post-tt1', stageOrder: 2 },
      ],
    })
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
    }

    await activateProofOperationalSemester(db, {
      simulationRunId: 'run_001',
      semesterNumber: 1,
      actorFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    }, deps)

    expect(getRun()).toMatchObject({
      activeOperationalSemester: 1,
      activeStageKey: 'pre-tt1',
      simulatedDateIso: TEST_NOW,
      lifecycleState: 'active',
    })
    expect(JSON.parse(String(getRun().stageBoundaryJson))).toMatchObject({
      strictlyMonotonic: true,
      semesters: [
        {
          semesterNumber: 1,
          entryStageKey: 'pre-tt1',
          exitStageKey: 'post-tt1',
        },
      ],
    })
  })

  it('rejects activation from the stopped lifecycle state', async () => {
    const { db } = createMockDb({
      run: {
        lifecycleState: 'stopped',
      },
    })
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
    }

    await expect(activateProofOperationalSemester(db, {
      simulationRunId: 'run_001',
      semesterNumber: 4,
      actorFacultyId: 'faculty_sysadmin',
      now: TEST_NOW,
    }, deps)).rejects.toThrow('Stopped proof runs must be restored before activation')

    expect(deps.publishOperationalProjection).not.toHaveBeenCalled()
    expect(deps.emitSimulationAudit).not.toHaveBeenCalled()
  })
})
