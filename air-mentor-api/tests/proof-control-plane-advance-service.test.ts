import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import {
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
} from '../src/db/schema.js'
import {
  advanceProofSimulationDay,
  advanceProofSimulationPreviousDay,
  advanceProofSimulationStage,
  resolveProofAdvance,
} from '../src/lib/proof-control-plane-advance-service.js'

type MockRun = {
  simulationRunId: string
  batchId: string
  createdAt: string
  semesterStart: number
  semesterEnd: number
  activeFlag: number
  activeOperationalSemester: number
  activeStageKey: string | null
  simulatedDateIso: string | null
  lifecycleState: string | null
  stageBoundaryJson: string | null
  updatedAt: string
}

type MockCheckpoint = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageOrder: number
}

function createMockDb(options?: {
  run?: Partial<MockRun>
  checkpoints?: MockCheckpoint[]
}) {
  let run: MockRun = {
    simulationRunId: 'run_001',
    batchId: 'batch_001',
    createdAt: '2026-01-01T00:00:00.000Z',
    semesterStart: 1,
    semesterEnd: 2,
    activeFlag: 1,
    activeOperationalSemester: 1,
    activeStageKey: 'pre-tt1',
    simulatedDateIso: '2026-02-04T00:00:00.000Z',
    lifecycleState: 'active',
    stageBoundaryJson: null,
    updatedAt: '2026-02-04T00:00:00.000Z',
    ...options?.run,
  }
  const checkpoints = options?.checkpoints ?? [
    { simulationStageCheckpointId: 'cp_1_pre', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'pre-tt1', stageOrder: 1 },
    { simulationStageCheckpointId: 'cp_1_tt1', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'post-tt1', stageOrder: 2 },
    { simulationStageCheckpointId: 'cp_1_tt2', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'post-tt2', stageOrder: 3 },
    { simulationStageCheckpointId: 'cp_1_asg', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'post-assignments', stageOrder: 4 },
    { simulationStageCheckpointId: 'cp_1_see', simulationRunId: run.simulationRunId, semesterNumber: 1, stageKey: 'post-see', stageOrder: 5 },
    { simulationStageCheckpointId: 'cp_2_pre', simulationRunId: run.simulationRunId, semesterNumber: 2, stageKey: 'pre-tt1', stageOrder: 1 },
  ]
  const insertedSnapshots: Array<Record<string, unknown>> = []

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
      throw new Error('Unexpected table in update mock')
    },
    insert(table: unknown) {
      if (table === simulationResetSnapshots) {
        return {
          values: async (values: Record<string, unknown>) => {
            insertedSnapshots.push(values)
          },
        }
      }
      throw new Error('Unexpected table in insert mock')
    },
  } as unknown as AppDb

  return {
    db,
    getRun: () => run,
    getInsertedSnapshots: () => insertedSnapshots,
  }
}

describe('proof-control-plane-advance-service', () => {
  it('crosses a stage boundary once on next-day and does not duplicate the transition on the following day', async () => {
    const { db, getRun, getInsertedSnapshots } = createMockDb()
    const deps = {
      createId: vi.fn(() => 'simulation_reset_001'),
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    const first = await advanceProofSimulationDay(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-02-04T12:00:00.000Z',
      policy: {} as never,
    }, deps)

    expect(first).toMatchObject({
      simulationRunId: 'run_001',
      activeOperationalSemester: 1,
      previousStageKey: 'pre-tt1',
      activeStageKey: 'post-tt1',
      stageTransitioned: true,
      crossedSemesterBoundary: false,
      simulatedDateIso: '2026-02-05T00:00:00.000Z',
      lifecycleState: 'active',
    })
    expect(getRun()).toMatchObject({
      activeOperationalSemester: 1,
      activeStageKey: 'post-tt1',
      simulatedDateIso: '2026-02-05T00:00:00.000Z',
      lifecycleState: 'active',
    })
    expect(getInsertedSnapshots()).toHaveLength(1)
    expect(JSON.parse(String(getInsertedSnapshots()[0]?.snapshotJson))).toMatchObject({
      snapshotType: 'stage-entry',
      runAuthority: {
        activeOperationalSemester: 1,
        activeStageKey: 'post-tt1',
      },
    })
    expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)

    const second = await advanceProofSimulationDay(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-02-05T12:00:00.000Z',
      policy: {} as never,
    }, deps)

    expect(second).toMatchObject({
      previousStageKey: 'post-tt1',
      activeStageKey: 'post-tt1',
      stageTransitioned: false,
      simulatedDateIso: '2026-02-06T00:00:00.000Z',
    })
    expect(getInsertedSnapshots()).toHaveLength(1)
    expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)
  })

  it('snaps next-stage to the next checkpoint boundary and exposes post-see auto-resolution semantics', async () => {
    const { db } = createMockDb({
      run: {
        activeStageKey: 'post-assignments',
        simulatedDateIso: '2026-04-08T00:00:00.000Z',
      },
    })
    const deps = {
      createId: vi.fn(() => 'simulation_reset_002'),
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    const result = await advanceProofSimulationStage(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-04-08T08:00:00.000Z',
      policy: {} as never,
    }, deps)

    expect(result).toMatchObject({
      previousStageKey: 'post-assignments',
      activeStageKey: 'post-see',
      stageTransitioned: true,
      autoResolutionMode: 'post-see-open-cases-may-auto-resolve',
      simulatedDateIso: '2026-04-30T00:00:00.000Z',
    })
    expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)
  })

  it('keeps semester-6 terminal runs completed-inspectable after the last checkpoint', () => {
    const resolution = resolveProofAdvance({
      mode: 'next-stage',
      run: {
        simulationRunId: 'run_terminal',
        batchId: 'batch_001',
        createdAt: '2026-01-01T00:00:00.000Z',
        semesterStart: 6,
        semesterEnd: 6,
        activeFlag: 1,
        activeOperationalSemester: 6,
        activeStageKey: 'post-see',
        simulatedDateIso: '2027-04-30T00:00:00.000Z',
        lifecycleState: 'active',
        stageBoundaryJson: null,
      },
      stageBoundary: {
        strictlyMonotonic: true,
        availableSemesters: [6],
        semesters: [{
          semesterNumber: 6,
          stageCount: 5,
          entryCheckpointId: 'cp_6_pre',
          entryStageKey: 'pre-tt1',
          exitCheckpointId: 'cp_6_see',
          exitStageKey: 'post-see',
          stageKeys: ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'],
          stageOrders: [1, 2, 3, 4, 5],
        }],
      },
    })

    expect(resolution).toMatchObject({
      stageTransitioned: false,
      lifecycleState: 'completed-inspectable',
      terminalLifecyclePreserved: true,
      autoResolutionMode: null,
    })
  })

  it('moves proof authority one persisted day backward without changing stage authority', async () => {
    const resolution = resolveProofAdvance({
      mode: 'previous-day' as never,
      run: {
        simulationRunId: 'run_day_back',
        batchId: 'batch_001',
        createdAt: '2026-01-01T00:00:00.000Z',
        semesterStart: 1,
        semesterEnd: 2,
        activeFlag: 1,
        activeOperationalSemester: 1,
        activeStageKey: 'post-tt1',
        simulatedDateIso: '2026-02-06T00:00:00.000Z',
        lifecycleState: 'active',
        stageBoundaryJson: null,
      },
      stageBoundary: {
        strictlyMonotonic: true,
        availableSemesters: [1],
        semesters: [{
          semesterNumber: 1,
          stageCount: 2,
          entryCheckpointId: 'cp_1_pre',
          entryStageKey: 'pre-tt1',
          exitCheckpointId: 'cp_1_tt1',
          exitStageKey: 'post-tt1',
          stageKeys: ['pre-tt1', 'post-tt1'],
          stageOrders: [1, 2],
        }],
      },
    })

    expect(resolution).toMatchObject({
      simulatedDateIso: '2026-02-05T00:00:00.000Z',
      stageTransitioned: false,
      current: expect.objectContaining({
        semesterNumber: 1,
        stageKey: 'post-tt1',
      }),
    })
  })

  it('moves persisted proof day backward even when the active run has no checkpoint chain', async () => {
    const { db, getRun, getInsertedSnapshots } = createMockDb({
      run: {
        activeOperationalSemester: 1,
        activeStageKey: 'pre-tt1',
        simulatedDateIso: '2026-03-16T00:00:00.000Z',
      },
      checkpoints: [],
    })
    const deps = {
      createId: vi.fn(() => 'simulation_reset_003'),
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    const result = await advanceProofSimulationPreviousDay(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_course_leader',
      now: '2026-03-16T12:00:00.000Z',
      policy: {} as never,
    }, deps)

    expect(result).toMatchObject({
      simulationRunId: 'run_001',
      activeOperationalSemester: 1,
      previousStageKey: 'pre-tt1',
      activeStageKey: 'pre-tt1',
      simulatedDateIso: '2026-03-15T00:00:00.000Z',
      stageTransitioned: false,
      crossedSemesterBoundary: false,
    })
    expect(getRun()).toMatchObject({
      activeOperationalSemester: 1,
      activeStageKey: 'pre-tt1',
      simulatedDateIso: '2026-03-15T00:00:00.000Z',
    })
    expect(getInsertedSnapshots()).toHaveLength(0)
    expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()
  })

  it('reports not-ready instead of an internal error when advancing before checkpoints exist', async () => {
    const { db } = createMockDb({ checkpoints: [] })
    const deps = {
      createId: vi.fn(() => 'simulation_reset_not_ready'),
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    await expect(advanceProofSimulationStage(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-02-04T12:00:00.000Z',
      policy: {} as never,
    }, deps)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Proof run is still preparing its stage checkpoints. Try again after the worker finishes.',
    })
    expect(deps.publishOperationalProjection).not.toHaveBeenCalled()
  })
})
