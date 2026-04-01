import { describe, expect, it } from 'vitest'
import {
  buildCombinedSemesterProofSummaryPath,
  buildSemesterProofSummaryPath,
  buildSemesterScopedArtifactPath,
  normalizeSemesterTargetList,
  parseProofTargetSemester,
  resolveSemesterWalkCheckpoint,
  sanitizeArtifactPrefix,
} from '../scripts/proof-risk-semester-walk.mjs'

describe('proof risk semester-walk helpers', () => {
  it('parses and normalizes targeted semesters deterministically', () => {
    expect(parseProofTargetSemester('2')).toBe(2)
    expect(parseProofTargetSemester('')).toBeNull()
    expect(() => parseProofTargetSemester('two')).toThrow(/Invalid AIRMENTOR_PROOF_TARGET_SEMESTER/)
    expect(normalizeSemesterTargetList('1, 2,3,2')).toEqual([1, 2, 3])
    expect(normalizeSemesterTargetList('4, 5, 6, 5')).toEqual([4, 5, 6])
  })

  it('selects the last checkpoint within the targeted semester using stage order and checkpoint id', () => {
    const checkpoint = resolveSemesterWalkCheckpoint([
      {
        simulationStageCheckpointId: 'checkpoint_sem1_pre',
        semesterNumber: 1,
        stageOrder: 1,
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem1_post',
        semesterNumber: 1,
        stageOrder: 2,
      },
      {
        simulationStageCheckpointId: 'checkpoint_sem2_pre',
        semesterNumber: 2,
        stageOrder: 1,
      },
    ], 1)

    expect(checkpoint).toMatchObject({
      simulationStageCheckpointId: 'checkpoint_sem1_post',
      semesterNumber: 1,
      stageOrder: 2,
    })
  })

  it('builds semester-scoped artifact and summary paths with a sanitized prefix', () => {
    const prefix = sanitizeArtifactPrefix('07b local walk')
    expect(prefix).toBe('07b-local-walk')
    expect(buildSemesterScopedArtifactPath('/tmp/system-admin-proof-control-plane.png', prefix, 3)).toBe(
      '/tmp/07b-local-walk-semester-3-system-admin-proof-control-plane.png',
    )
    expect(buildSemesterProofSummaryPath('/tmp/output', prefix, 3)).toBe(
      '/tmp/output/07b-local-walk-semester-3-proof-risk-walk-summary.json',
    )
    expect(buildCombinedSemesterProofSummaryPath('/tmp/output', prefix)).toBe(
      '/tmp/output/07b-local-walk-semester-walk-summary.json',
    )
  })
})
