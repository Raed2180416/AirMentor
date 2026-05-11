import { describe, expect, it, vi } from 'vitest'
import type { AppDb } from '../src/db/client.js'
import {
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
} from '../src/db/schema.js'
import { finalizeSeededProofRun } from '../src/lib/proof-control-plane-seeded-run-service.js'

const TEST_NOW = '2026-03-16T00:00:00.000Z'

function createMockDb() {
  let run = {
    simulationRunId: 'run_001',
    batchId: 'batch_001',
    activeOperationalSemester: 6,
    activeStageKey: null as string | null,
    simulatedDateIso: null as string | null,
    status: 'running',
    activeFlag: 0,
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: '2026-03-15T00:00:00.000Z',
  }
  const checkpointRows = [
    {
      simulationStageCheckpointId: 'cp_1_pre',
      simulationRunId: 'run_001',
      semesterNumber: 1,
      stageKey: 'pre-tt1',
      stageOrder: 1,
    },
    {
      simulationStageCheckpointId: 'cp_1_tt1',
      simulationRunId: 'run_001',
      semesterNumber: 1,
      stageKey: 'post-tt1',
      stageOrder: 2,
    },
  ]
  const insertedSnapshots: Array<Record<string, unknown>> = []
  const runUpdates: Array<Record<string, unknown>> = []

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
              where: async () => checkpointRows,
            }
          }
          throw new Error('Unexpected table in select mock')
        },
      }
    },
    update(table: unknown) {
      if (table === simulationRuns) {
        return {
          set(values: Record<string, unknown>) {
            return {
              where: async () => {
                runUpdates.push(values)
                const deactivatesOtherActiveRuns = values.activeFlag === 0
                  && values.status === 'completed'
                  && !('completedAt' in values)
                if (!deactivatesOtherActiveRuns) {
                  run = { ...run, ...values }
                }
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
    getRunUpdates: () => runUpdates,
    getSnapshots: () => insertedSnapshots,
  }
}

describe('proof-control-plane-seeded-run-service', () => {
  it('does not write live-profile history and stamps completed-inspectable authority', async () => {
    const { db, getRun, getRunUpdates, getSnapshots } = createMockDb()
    const deps = {
      PROOF_FACULTY: [{ facultyId: 'faculty_001', permissions: ['COURSE_LEADER'] }],
      buildTimetablePayload: vi.fn(() => ({})),
      createId: vi.fn((prefix: string) => `${prefix}_001`),
      emitSimulationAudit: vi.fn(async () => {}),
      insertRowsInChunks: vi.fn(async () => {}),
      parseJson: vi.fn((raw: string | null | undefined, fallback: unknown) => {
        if (!raw) return fallback
        try {
          return JSON.parse(raw)
        } catch {
          return fallback
        }
      }),
      rebuildProofRiskArtifacts: vi.fn(async () => {}),
      rebuildSimulationStagePlayback: vi.fn(async () => {}),
      recomputeObservedOnlyRisk: vi.fn(async () => {}),
      upsertRuntimeSlice: vi.fn(async () => {}),
    }

    await finalizeSeededProofRun(db, {
      simulationRunId: 'run_001',
      batchId: 'batch_001',
      curriculumImportVersionId: 'curriculum_001',
      policy: {
        attendanceRules: { minimumRequiredPercent: 75 },
        passRules: { minimumCeMark: 20, minimumSeeMark: 20, ceMaximum: 50, seeMaximum: 50 },
      } as never,
      now: TEST_NOW,
      runSeed: 1234,
      activate: true,
      scenarioFamily: 'balanced',
      trajectories: [{ studentId: 'student_001' }],
      loadsByFacultyId: new Map(),
      teacherAllocationRows: [],
      latentRows: [],
      behaviorRows: [],
      topicStateRows: [],
      coStateRows: [],
      worldContextRows: [],
      questionTemplateRows: [],
      questionResultRows: [],
      interventionResponseRows: [],
      observedRows: [],
      transitionRows: [],
      attendanceRows: [],
      assessmentRows: [],
      riskRows: [],
      reassessmentRows: [],
      alertRows: [],
      alertOutcomeRows: [],
      electiveRows: [],
      interventionRows: [],
      transcriptTermRowsInsert: [],
      transcriptSubjectRowsInsert: [],
    }, deps)

    expect(getRun()).toMatchObject({
      status: 'completed',
      activeFlag: 1,
      activeOperationalSemester: 1,
      lifecycleState: 'completed-inspectable',
      runMode: 'seeded-proof',
      activeStageKey: 'pre-tt1',
      simulatedDateIso: TEST_NOW,
    })
    expect(getRunUpdates().map(update => update.activeFlag)).toEqual([1, 0])

    const [snapshot] = getSnapshots()
    expect(snapshot).toBeTruthy()
    const payload = JSON.parse(String(snapshot.snapshotJson))
    expect(payload.runAuthority).toMatchObject({
      activeOperationalSemester: 1,
      activeStageKey: 'pre-tt1',
      lifecycleState: 'completed-inspectable',
      runMode: 'seeded-proof',
    })
  })
})
