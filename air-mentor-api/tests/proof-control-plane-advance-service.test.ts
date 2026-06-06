import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import {
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  studentInterventions,
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

type MockQueueCase = {
  simulationStageQueueCaseId: string
  simulationStageCheckpointId: string
  simulationRunId: string
  studentId: string
  primaryOfferingId: string | null
  semesterNumber: number
  sectionCode: string
  stageKey: string
  assignedToRole: string | null
  assignedFacultyId: string | null
  status: string
  recommendedAction: string | null
  dueAt: string | null
  countsTowardCapacity: number
  priorityRank: number | null
  governanceReason: string
  primaryCourseCode: string
  primaryCourseTitle: string
  supportingCourseCount: number
  supportingSourceKeysJson: string
  caseJson: string
  detailJson: string
  createdAt: string
  updatedAt: string
}

type MockQueueProjection = {
  simulationStageQueueProjectionId: string
  simulationStageCheckpointId: string
  simulationRunId: string
  simulationStageQueueCaseId: string | null
  studentId: string
  offeringId: string | null
  semesterNumber: number
  sectionCode: string
  courseCode: string
  courseTitle: string
  assignedToRole: string | null
  assignedFacultyId: string | null
  taskType: string
  status: string
  riskBand: string
  riskProbScaled: number
  noActionRiskProbScaled: number
  recommendedAction: string | null
  simulatedActionTaken: string | null
  detailJson: string
  createdAt: string
  updatedAt: string
}

function createMockDb(options?: {
  run?: Partial<MockRun>
  checkpoints?: MockCheckpoint[]
  queueCases?: MockQueueCase[]
  queueProjections?: MockQueueProjection[]
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
  let queueCases = options?.queueCases ?? []
  let queueProjections = options?.queueProjections ?? []
  const insertedInterventions: Array<typeof studentInterventions.$inferInsert> = []

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
          if (table === simulationStageQueueCases) {
            return {
              where: async () => queueCases,
            }
          }
          if (table === simulationStageQueueProjections) {
            return {
              where: async () => queueProjections,
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
      if (table === simulationStageQueueCases) {
        return {
          set(values: Partial<MockQueueCase>) {
            return {
              where: async () => {
                queueCases = queueCases.map(row => ({ ...row, ...values }))
              },
            }
          },
        }
      }
      if (table === simulationStageQueueProjections) {
        return {
          set(values: Partial<MockQueueProjection>) {
            return {
              where: async () => {
                queueProjections = queueProjections.map(row => ({ ...row, ...values }))
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
      if (table === studentInterventions) {
        return {
          values: (values: typeof studentInterventions.$inferInsert | Array<typeof studentInterventions.$inferInsert>) => {
            const rows = Array.isArray(values) ? values : [values]
            rows.forEach(row => {
              if (!insertedInterventions.some(existing => existing.interventionId === row.interventionId)) {
                insertedInterventions.push(row)
              }
            })
            return {
              onConflictDoNothing: async () => {},
            }
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
    getQueueCases: () => queueCases,
    getQueueProjections: () => queueProjections,
    getInsertedInterventions: () => insertedInterventions,
  }
}

function makeQueueCase(overrides: Partial<MockQueueCase> = {}): MockQueueCase {
  return {
    simulationStageQueueCaseId: overrides.simulationStageQueueCaseId ?? 'queue_case_001',
    simulationStageCheckpointId: overrides.simulationStageCheckpointId ?? 'cp_1_tt1',
    simulationRunId: overrides.simulationRunId ?? 'run_001',
    studentId: overrides.studentId ?? 'stud_5',
    primaryOfferingId: overrides.primaryOfferingId ?? 'offering_001',
    semesterNumber: overrides.semesterNumber ?? 1,
    sectionCode: overrides.sectionCode ?? 'A',
    stageKey: overrides.stageKey ?? 'post-tt1',
    assignedToRole: overrides.assignedToRole ?? 'COURSE_LEADER',
    assignedFacultyId: overrides.assignedFacultyId ?? 'faculty_course_leader',
    status: overrides.status ?? 'Open',
    recommendedAction: overrides.recommendedAction ?? 'targeted-tutoring',
    dueAt: overrides.dueAt ?? '2026-02-12T00:00:00.000Z',
    countsTowardCapacity: overrides.countsTowardCapacity ?? 1,
    priorityRank: overrides.priorityRank ?? 1,
    governanceReason: overrides.governanceReason ?? 'High post-TT1 risk',
    primaryCourseCode: overrides.primaryCourseCode ?? 'MTB101A',
    primaryCourseTitle: overrides.primaryCourseTitle ?? 'Mathematics I',
    supportingCourseCount: overrides.supportingCourseCount ?? 0,
    supportingSourceKeysJson: overrides.supportingSourceKeysJson ?? '[]',
    caseJson: overrides.caseJson ?? JSON.stringify({ caseKey: overrides.simulationStageQueueCaseId ?? 'queue_case_001' }),
    detailJson: overrides.detailJson ?? JSON.stringify({ primaryCase: true, countsTowardCapacity: true }),
    createdAt: overrides.createdAt ?? '2026-02-05T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-02-05T00:00:00.000Z',
  }
}

function makeQueueProjection(overrides: Partial<MockQueueProjection> = {}): MockQueueProjection {
  return {
    simulationStageQueueProjectionId: overrides.simulationStageQueueProjectionId ?? 'queue_projection_001',
    simulationStageCheckpointId: overrides.simulationStageCheckpointId ?? 'cp_1_tt1',
    simulationRunId: overrides.simulationRunId ?? 'run_001',
    simulationStageQueueCaseId: overrides.simulationStageQueueCaseId ?? 'queue_case_001',
    studentId: overrides.studentId ?? 'stud_5',
    offeringId: overrides.offeringId ?? 'offering_001',
    semesterNumber: overrides.semesterNumber ?? 1,
    sectionCode: overrides.sectionCode ?? 'A',
    courseCode: overrides.courseCode ?? 'MTB101A',
    courseTitle: overrides.courseTitle ?? 'Mathematics I',
    assignedToRole: overrides.assignedToRole ?? 'COURSE_LEADER',
    assignedFacultyId: overrides.assignedFacultyId ?? 'faculty_course_leader',
    taskType: overrides.taskType ?? 'Academic',
    status: overrides.status ?? 'Open',
    riskBand: overrides.riskBand ?? 'High',
    riskProbScaled: overrides.riskProbScaled ?? 82,
    noActionRiskProbScaled: overrides.noActionRiskProbScaled ?? 91,
    recommendedAction: overrides.recommendedAction ?? 'targeted-tutoring',
    simulatedActionTaken: overrides.simulatedActionTaken ?? null,
    detailJson: overrides.detailJson ?? JSON.stringify({ primaryCase: true, countsTowardCapacity: true }),
    createdAt: overrides.createdAt ?? '2026-02-05T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-02-05T00:00:00.000Z',
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
    expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()

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
    expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()
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
    expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()
  })

  it('primes a playback rebuild when stage realization has newer manual interventions', async () => {
    const originalFlag = process.env.AIRMENTOR_STAGE_REALIZATION_V1
    process.env.AIRMENTOR_STAGE_REALIZATION_V1 = '1'
    try {
      const { db } = createMockDb({
        run: {
          activeStageKey: 'post-assignments',
          simulatedDateIso: '2026-04-08T00:00:00.000Z',
        },
      })
      const deps = {
        createId: vi.fn(() => 'simulation_reset_manual_intervention'),
        emitSimulationAudit: vi.fn(async () => {}),
        publishOperationalProjection: vi.fn(async () => {}),
        rebuildSimulationStagePlayback: vi.fn(async () => {}),
        hasUnrealizedInterventionsSinceLastAdvance: vi.fn(async () => true),
      }

      await advanceProofSimulationStage(db, {
        simulationRunId: 'run_001',
        actorFacultyId: 'faculty_sysadmin',
        now: '2026-04-08T08:00:00.000Z',
        policy: {} as never,
      }, deps)

      expect(deps.hasUnrealizedInterventionsSinceLastAdvance).toHaveBeenCalledWith(db, expect.objectContaining({
        simulationRunId: 'run_001',
        batchId: 'batch_001',
        since: '2026-02-04T00:00:00.000Z',
      }))
      expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)
      expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
        actionType: 'stage-realization-applied',
      }))
    } finally {
      if (originalFlag === undefined) delete process.env.AIRMENTOR_STAGE_REALIZATION_V1
      else process.env.AIRMENTOR_STAGE_REALIZATION_V1 = originalFlag
    }
  })

  it('auto-resolves prior-stage queue cases with deterministic interventions without forcing playback rebuild', async () => {
    const queueCases = [
      makeQueueCase({
        simulationStageQueueCaseId: 'queue_case_intervene',
        studentId: 'stud_5',
        recommendedAction: 'targeted-tutoring',
      }),
      makeQueueCase({
        simulationStageQueueCaseId: 'queue_case_dismiss',
        studentId: 'stud_1',
        recommendedAction: 'targeted-tutoring',
      }),
    ]
    const queueProjections = queueCases.map((queueCase, index) =>
      makeQueueProjection({
        simulationStageQueueProjectionId: `queue_projection_${index + 1}`,
        simulationStageQueueCaseId: queueCase.simulationStageQueueCaseId,
        studentId: queueCase.studentId,
      }))
    const { db, getQueueCases, getQueueProjections, getInsertedInterventions } = createMockDb({
      run: {
        activeStageKey: 'post-tt1',
        simulatedDateIso: '2026-02-05T00:00:00.000Z',
      },
      queueCases,
      queueProjections,
    })
    const deps = {
      createId: vi.fn(() => 'simulation_reset_auto_resolution'),
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    const result = await advanceProofSimulationStage(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-02-05T12:00:00.000Z',
      policy: {} as never,
    }, deps)

    expect(result).toMatchObject({
      previousStageKey: 'post-tt1',
      activeStageKey: 'post-tt2',
      stageTransitioned: true,
      autoResolutionSummary: {
        openCaseCount: 2,
        resolvedCount: 2,
        dismissedCount: 1,
        interventionCount: 1,
      },
    })
    expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()
    expect(getQueueCases()).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'Resolved', countsTowardCapacity: 0 }),
    ]))
    expect(getQueueProjections()).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'Resolved' }),
    ]))
    expect(getInsertedInterventions()).toEqual([
      expect.objectContaining({
        studentId: 'stud_5',
        interventionType: 'targeted-tutoring',
        offeringId: 'offering_001',
      }),
    ])
    expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
      actionType: 'stage-queue-auto-resolved',
      payload: expect.objectContaining({
        source: 'proof-stage-auto-resolution-v1',
        summary: expect.objectContaining({ resolvedCount: 2, interventionCount: 1 }),
      }),
    }))
  })

  it('does not rebuild playback for auto-resolution-only transitions even when stage realization is enabled', async () => {
    const originalFlag = process.env.AIRMENTOR_STAGE_REALIZATION_V1
    process.env.AIRMENTOR_STAGE_REALIZATION_V1 = '1'
    try {
      const queueCases = [
        makeQueueCase({
          simulationStageQueueCaseId: 'queue_case_intervene',
          studentId: 'stud_5',
          recommendedAction: 'targeted-tutoring',
        }),
      ]
      const queueProjections = queueCases.map(queueCase =>
        makeQueueProjection({
          simulationStageQueueProjectionId: 'queue_projection_intervene',
          simulationStageQueueCaseId: queueCase.simulationStageQueueCaseId,
          studentId: queueCase.studentId,
        }))
      const { db, getInsertedInterventions } = createMockDb({
        run: {
          activeStageKey: 'post-tt1',
          simulatedDateIso: '2026-02-05T00:00:00.000Z',
        },
        queueCases,
        queueProjections,
      })
      const deps = {
        createId: vi.fn(() => 'simulation_reset_auto_resolution_flag_on'),
        emitSimulationAudit: vi.fn(async () => {}),
        publishOperationalProjection: vi.fn(async () => {}),
        rebuildSimulationStagePlayback: vi.fn(async () => {}),
        hasUnrealizedInterventionsSinceLastAdvance: vi.fn(async () => false),
      }

      const result = await advanceProofSimulationStage(db, {
        simulationRunId: 'run_001',
        actorFacultyId: 'faculty_sysadmin',
        now: '2026-02-05T12:00:00.000Z',
        policy: {} as never,
      }, deps)

      expect(result.autoResolutionSummary).toMatchObject({
        resolvedCount: 1,
        interventionCount: 1,
      })
      expect(deps.hasUnrealizedInterventionsSinceLastAdvance).toHaveBeenCalled()
      expect(deps.rebuildSimulationStagePlayback).not.toHaveBeenCalled()
      expect(getInsertedInterventions()).toHaveLength(1)
    } finally {
      if (originalFlag === undefined) delete process.env.AIRMENTOR_STAGE_REALIZATION_V1
      else process.env.AIRMENTOR_STAGE_REALIZATION_V1 = originalFlag
    }
  })

  it('rebuilds exactly once when manual realization and auto-resolution happen together', async () => {
    const originalFlag = process.env.AIRMENTOR_STAGE_REALIZATION_V1
    process.env.AIRMENTOR_STAGE_REALIZATION_V1 = '1'
    try {
      const queueCases = [
        makeQueueCase({
          simulationStageQueueCaseId: 'queue_case_intervene',
          studentId: 'stud_5',
          recommendedAction: 'targeted-tutoring',
        }),
      ]
      const queueProjections = queueCases.map(queueCase =>
        makeQueueProjection({
          simulationStageQueueProjectionId: 'queue_projection_intervene',
          simulationStageQueueCaseId: queueCase.simulationStageQueueCaseId,
          studentId: queueCase.studentId,
        }))
      const { db, getInsertedInterventions } = createMockDb({
        run: {
          activeStageKey: 'post-tt1',
          simulatedDateIso: '2026-02-05T00:00:00.000Z',
        },
        queueCases,
        queueProjections,
      })
      const deps = {
        createId: vi.fn(() => 'simulation_reset_manual_plus_auto'),
        emitSimulationAudit: vi.fn(async () => {}),
        publishOperationalProjection: vi.fn(async () => {}),
        rebuildSimulationStagePlayback: vi.fn(async () => {}),
        hasUnrealizedInterventionsSinceLastAdvance: vi.fn(async () => true),
      }

      const result = await advanceProofSimulationStage(db, {
        simulationRunId: 'run_001',
        actorFacultyId: 'faculty_sysadmin',
        now: '2026-02-05T12:00:00.000Z',
        policy: {} as never,
      }, deps)

      expect(result.autoResolutionSummary).toMatchObject({
        resolvedCount: 1,
        interventionCount: 1,
      })
      expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)
      expect(getInsertedInterventions()).toHaveLength(1)
      expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
        actionType: 'stage-realization-applied',
      }))
      expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
        actionType: 'stage-queue-auto-resolved',
      }))
    } finally {
      if (originalFlag === undefined) delete process.env.AIRMENTOR_STAGE_REALIZATION_V1
      else process.env.AIRMENTOR_STAGE_REALIZATION_V1 = originalFlag
    }
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
        updatedAt: '2027-04-30T00:00:00.000Z',
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
        updatedAt: '2026-02-06T00:00:00.000Z',
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
