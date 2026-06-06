import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import {
  riskEvidenceSnapshots,
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageOfferingProjections,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
} from '../src/db/schema.js'
import {
  completeProofSimulationReset,
  resetCurrentProofStage,
  stopProofSimulationRun,
} from '../src/lib/proof-control-plane-playback-reset-service.js'

type MockRun = {
  simulationRunId: string
  batchId: string
  runLabel: string
  status: string
  activeFlag: number
  activeOperationalSemester: number
  activeStageKey: string
  simulatedDateIso: string
  lifecycleState: string
  stageBoundaryJson: string | null
  curriculumImportVersionId: string
  curriculumFeatureProfileId: string | null
  curriculumFeatureProfileFingerprint: string | null
  seed: number
  updatedAt: string
}

function createMockDb(options?: {
  run?: Partial<MockRun>
  snapshots?: Array<typeof simulationResetSnapshots.$inferSelect>
}) {
  let run: MockRun = {
    simulationRunId: 'run_001',
    batchId: 'batch_001',
    runLabel: 'Proof Run',
    status: 'active',
    activeFlag: 1,
    activeOperationalSemester: 4,
    activeStageKey: 'post-tt1',
    simulatedDateIso: '2026-03-20T00:00:00.000Z',
    lifecycleState: 'active',
    stageBoundaryJson: JSON.stringify({
      strictlyMonotonic: true,
      availableSemesters: [4],
      semesters: [{
        semesterNumber: 4,
        stageCount: 2,
        entryCheckpointId: 'cp_4_pre',
        entryStageKey: 'pre-tt1',
        exitCheckpointId: 'cp_4_tt1',
        exitStageKey: 'post-tt1',
        stageKeys: ['pre-tt1', 'post-tt1'],
        stageOrders: [1, 2],
      }],
    }),
    curriculumImportVersionId: 'curriculum_001',
    curriculumFeatureProfileId: 'profile_001',
    curriculumFeatureProfileFingerprint: 'fingerprint_001',
    seed: 1234,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...options?.run,
  }
  const snapshots = options?.snapshots ?? [
    {
      simulationResetSnapshotId: 'snapshot_stage_001',
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      snapshotLabel: 'Stage entry snapshot: semester 4 post-tt1',
      snapshotJson: JSON.stringify({
        snapshotType: 'stage-entry',
        runAuthority: {
          activeOperationalSemester: 4,
          activeStageKey: 'post-tt1',
          lifecycleState: 'active',
          simulatedDateIso: '2026-03-10T00:00:00.000Z',
          stageBoundary: JSON.parse(String(run.stageBoundaryJson)),
        },
      }),
      createdAt: '2026-03-10T00:00:00.000Z',
    },
    {
      simulationResetSnapshotId: 'snapshot_baseline_001',
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      snapshotLabel: 'Baseline snapshot',
      snapshotJson: JSON.stringify({
        snapshotType: 'baseline',
        curriculumImportVersionId: 'curriculum_001',
        seed: 9876,
        policySnapshot: { attendanceRules: { minimumRequiredPercent: 75 } },
        runAuthority: {
          activeOperationalSemester: 1,
          activeStageKey: 'pre-tt1',
          lifecycleState: 'completed-inspectable',
          simulatedDateIso: '2026-01-01T00:00:00.000Z',
        },
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]
  let cards = [{
    studentAgentCardId: 'card_001',
    simulationRunId: run.simulationRunId,
    simulationStageCheckpointId: 'cp_4_tt1',
  }]
  let sessions = [{
    studentAgentSessionId: 'session_001',
    simulationRunId: run.simulationRunId,
    simulationStageCheckpointId: 'cp_4_tt1',
  }]
  let messages = [{
    studentAgentMessageId: 'message_001',
    studentAgentSessionId: 'session_001',
  }]
  let checkpoints = [{
    simulationStageCheckpointId: 'cp_4_tt1',
    simulationRunId: run.simulationRunId,
    semesterNumber: 4,
    stageKey: 'post-tt1',
    stageOrder: 2,
  }]
  let evidenceRows = [{
    riskEvidenceSnapshotId: 'evidence_001',
    simulationRunId: run.simulationRunId,
    simulationStageCheckpointId: 'cp_4_tt1',
  }]
  let queueProjections = [{ simulationStageCheckpointId: 'cp_4_tt1' }]
  let queueCases = [{ simulationStageCheckpointId: 'cp_4_tt1' }]
  let offeringProjections = [{ simulationStageCheckpointId: 'cp_4_tt1' }]
  let studentProjections = [{ simulationStageCheckpointId: 'cp_4_tt1' }]

  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table === simulationRuns) {
            return {
              where: async () => [run],
            }
          }
          if (table === simulationResetSnapshots) {
            return {
              where() {
                return {
                  orderBy: async () => snapshots.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
                }
              },
            }
          }
          if (table === studentAgentCards) {
            return { where: async () => cards }
          }
          if (table === studentAgentSessions) {
            return { where: async () => sessions }
          }
          if (table === simulationStageCheckpoints) {
            return { where: async () => checkpoints }
          }
          if (table === riskEvidenceSnapshots) {
            return { where: async () => evidenceRows }
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
    delete(table: unknown) {
      return {
        where: async () => {
          if (table === studentAgentMessages) {
            messages = []
            return
          }
          if (table === studentAgentSessions) {
            sessions = []
            return
          }
          if (table === studentAgentCards) {
            cards = []
            return
          }
          if (table === riskEvidenceSnapshots) {
            evidenceRows = []
            return
          }
          if (table === simulationStageQueueProjections) {
            queueProjections = []
            return
          }
          if (table === simulationStageQueueCases) {
            queueCases = []
            return
          }
          if (table === simulationStageOfferingProjections) {
            offeringProjections = []
            return
          }
          if (table === simulationStageStudentProjections) {
            studentProjections = []
            return
          }
          if (table === simulationStageCheckpoints) {
            checkpoints = []
            return
          }
          throw new Error('Unexpected table in delete mock')
        },
      }
    },
  } as unknown as AppDb

  return {
    db,
    getRun: () => run,
    getArtifacts: () => ({
      cards,
      sessions,
      messages,
      checkpoints,
      evidenceRows,
      queueProjections,
      queueCases,
      offeringProjections,
      studentProjections,
    }),
    getSnapshots: () => snapshots,
  }
}

describe('proof-control-plane-playback-reset-service', () => {
  it('restores the current stage from its stage-entry snapshot and clears checkpoint artifacts', async () => {
    const { db, getRun, getArtifacts } = createMockDb()
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      publishOperationalProjection: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
    }

    const result = await resetCurrentProofStage(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-03-21T00:00:00.000Z',
      policy: { attendanceRules: { minimumRequiredPercent: 75 } } as never,
    }, deps)

    expect(result).toMatchObject({
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      simulationResetSnapshotId: 'snapshot_stage_001',
      activeOperationalSemester: 4,
      activeStageKey: 'post-tt1',
      simulatedDateIso: '2026-03-10T00:00:00.000Z',
    })
    expect(getRun()).toMatchObject({
      activeOperationalSemester: 4,
      activeStageKey: 'post-tt1',
      simulatedDateIso: '2026-03-10T00:00:00.000Z',
      lifecycleState: 'active',
    })
    expect(getArtifacts()).toEqual({
      cards: [],
      sessions: [],
      messages: [],
      checkpoints: [],
      evidenceRows: [],
      queueProjections: [],
      queueCases: [],
      offeringProjections: [],
      studentProjections: [],
    })
    expect(deps.rebuildSimulationStagePlayback).toHaveBeenCalledTimes(1)
    expect(deps.publishOperationalProjection).toHaveBeenCalledTimes(1)
    expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
      actionType: 'reset-current-stage',
    }))
  })

  it('uses the baseline snapshot to recreate a clean proof run on complete reset', async () => {
    const { db } = createMockDb()
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      startProofSimulationRun: vi.fn(async () => ({
        simulationRunId: 'run_002',
        activeFlag: true,
      })),
    }

    const result = await completeProofSimulationReset(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-03-21T00:00:00.000Z',
    }, deps)

    expect(result).toEqual({
      ok: true,
      batchId: 'batch_001',
      sourceSimulationRunId: 'run_001',
      simulationRunId: 'run_002',
    })
    expect(deps.startProofSimulationRun).toHaveBeenCalledWith(db, expect.objectContaining({
      batchId: 'batch_001',
      curriculumImportVersionId: 'curriculum_001',
      seed: 9876,
      parentSimulationRunId: 'run_001',
      activate: true,
    }))
    expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
      actionType: 'complete-reset',
    }))
  })

  it('stops the run after deleting proof credentials and invalidating proof sessions', async () => {
    const { db, getRun } = createMockDb({
      run: {
        lifecycleState: 'active',
        status: 'active',
      },
    })
    const deps = {
      emitSimulationAudit: vi.fn(async () => {}),
      deleteProofCredentials: vi.fn(async () => ({ deletedCount: 3 })),
      invalidateProofBatchSessions: vi.fn(async () => {}),
    }

    const result = await stopProofSimulationRun(db, {
      simulationRunId: 'run_001',
      actorFacultyId: 'faculty_sysadmin',
      now: '2026-03-21T00:00:00.000Z',
    }, deps)

    expect(result).toEqual({
      ok: true,
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      deletedCredentialCount: 3,
    })
    expect(getRun()).toMatchObject({
      activeFlag: 0,
      lifecycleState: 'stopped',
      status: 'completed',
    })
    expect(deps.deleteProofCredentials).toHaveBeenCalledWith(db, 'batch_001')
    expect(deps.invalidateProofBatchSessions).toHaveBeenCalledWith(db, 'batch_001', null)
    expect(deps.emitSimulationAudit).toHaveBeenCalledWith(db, expect.objectContaining({
      actionType: 'stopped',
      payload: expect.objectContaining({
        deletedCredentialCount: 3,
      }),
    }))
  })
})
