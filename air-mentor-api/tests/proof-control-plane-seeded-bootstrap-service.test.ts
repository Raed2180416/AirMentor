import { describe, expect, it, vi } from 'vitest'
import { prepareSeededProofRunBootstrap } from '../src/adapters/simulation/proof-control-plane-seeded-bootstrap-service.js'

function createDbStub() {
  const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }))
  const insertValues = vi.fn().mockResolvedValue(undefined)
  const selectWhere = vi.fn().mockResolvedValue([
    {
      courseId: 'course_sem6_analytics',
      title: 'Applied Machine Learning',
      departmentId: 'dept_cse',
    },
  ])
  return {
    updateSet,
    insertValues,
    db: {
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateSet })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: selectWhere })),
      })),
    },
  }
}

describe('seeded proof run bootstrap publication', () => {
  it('keeps the previous active proof run visible while a replacement run is building', async () => {
    const { db, updateSet } = createDbStub()

    await prepareSeededProofRunBootstrap(db as never, {
      simulationRunId: 'simulation_run_replacement',
      batchId: 'batch_branch_mnc_btech_2023',
      curriculumImportVersionId: 'curriculum_import_001',
      policy: {} as never,
      now: '2026-04-03T00:00:00.000Z',
      seed: 101,
      activate: true,
    }, {
      INFERENCE_MODEL_VERSION: 'inference-test',
      MONITORING_POLICY_VERSION: 'monitoring-test',
      MSRUAS_PROOF_DEPARTMENT_ID: 'dept_cse',
      MSRUAS_PROOF_VALIDATOR_VERSION: 'validator-test',
      PROOF_FACULTY: [{ facultyId: 'mnc_t1', permissions: ['COURSE_LEADER'] }],
      WORLD_ENGINE_VERSION: 'world-test',
      createId: prefix => `${prefix}_001`,
      deterministicPolicyFromResolved: () => ({ passRules: {} }) as never,
      ensureSem6Offerings: async () => ({
        offerings: [{
          offeringId: 'offering_sem6_analytics_a',
          courseId: 'course_sem6_analytics',
          sectionCode: 'A',
        } as never],
      }),
      readRuntimeCurriculum: async () => ({
        courses: [{
          courseId: 'course_sem6_analytics',
          title: 'Applied Machine Learning',
          semesterNumber: 6,
        }],
      } as never),
      scenarioProfileForSeed: () => ({ family: 'baseline' }) as never,
    })

    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({
      activeFlag: 0,
    }))
  })

  it('persists demo workspace scope when starting a fresh seeded proof run', async () => {
    const { db, insertValues } = createDbStub()

    await prepareSeededProofRunBootstrap(db as never, {
      batchId: 'batch_branch_mnc_btech_2023',
      curriculumImportVersionId: 'curriculum_import_001',
      policy: {} as never,
      now: '2026-04-03T00:00:00.000Z',
      seed: 101,
      activate: true,
      demoWorkspaceId: 'demo_ws_scope_001',
    }, {
      INFERENCE_MODEL_VERSION: 'inference-test',
      MONITORING_POLICY_VERSION: 'monitoring-test',
      MSRUAS_PROOF_DEPARTMENT_ID: 'dept_cse',
      MSRUAS_PROOF_VALIDATOR_VERSION: 'validator-test',
      PROOF_FACULTY: [{ facultyId: 'mnc_t1', permissions: ['COURSE_LEADER'] }],
      WORLD_ENGINE_VERSION: 'world-test',
      createId: prefix => `${prefix}_001`,
      deterministicPolicyFromResolved: () => ({ passRules: {} }) as never,
      ensureSem6Offerings: async () => ({
        offerings: [{
          offeringId: 'offering_sem6_analytics_a',
          courseId: 'course_sem6_analytics',
          sectionCode: 'A',
        } as never],
      }),
      readRuntimeCurriculum: async () => ({
        courses: [{
          courseId: 'course_sem6_analytics',
          title: 'Applied Machine Learning',
          semesterNumber: 6,
        }],
      } as never),
      scenarioProfileForSeed: () => ({ family: 'baseline' }) as never,
    })

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      demoWorkspaceId: 'demo_ws_scope_001',
    }))
  })
})
