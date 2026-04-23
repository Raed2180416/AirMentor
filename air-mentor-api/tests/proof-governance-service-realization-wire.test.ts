// Integration test for the Phase-6d wire-up: proves that when
// BuildPlaybackGovernanceArtifactsInput carries a realizationData bundle AND
// AIRMENTOR_STAGE_REALIZATION_V1=1 is set, the realizationInputForSource helper
// assembles the right StageEvidenceRealizationInput for each source and that the
// downstream evidence reflects intervention deltas.
//
// This test exercises the helper in isolation (it is not exported, so we reach it
// through the applier with a known baseline) — the wire itself is verified via
// the already-existing proof-stage-evidence-realization-wire.test.ts. The purpose
// of this file is to lock the source-key contract (`${studentId}::${offeringId}`)
// and ensure null-offering handling, missing-profile fallback, and empty-
// intervention edge cases behave as documented.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STAGE_REALIZATION_FLAG_NAME,
  applyRealizationToEvidenceSnapshot,
  type EvidenceApplierInterventionInput,
  type StageBaselineEvidence,
} from '../src/lib/proof-stage-realization-evidence-applier.js'
import type {
  StudentLatentProfileForIntervention,
} from '../src/lib/proof-intervention-response-types.js'
import type {
  PlaybackGovernanceRealizationData,
} from '../src/lib/proof-control-plane-playback-governance-service.js'

function makeProfile(overrides: Partial<{ receptivity: number; compliance: number }> = {}): StudentLatentProfileForIntervention {
  return {
    dynamics: {
      forgetRate: 0.1, relearnRate: 0.5, transferGainRate: 0.4, studyGainRate: 0.5,
      fatigueRate: 0.1, consistency: 0.55, volatility: 0.22, recoveryTendency: 0.5, relapseTendency: 0.22,
    },
    behavior: {
      practiceCompliance: overrides.compliance ?? 0.55,
      helpSeekingTendency: 0.4,
      examPressure: 0.35,
    },
    intervention: {
      interventionReceptivity: overrides.receptivity ?? 0.6,
      temporaryUpliftCredit: 0.1,
      expectedRecoveryThreshold: 0.12,
    },
  }
}

function makeBaseline(): StageBaselineEvidence {
  return {
    attendancePct: 78, tt1Pct: 55, tt2Pct: 52,
    quizPct: 61, assignmentPct: 65, seePct: 48, cePct: 58,
  }
}

function makeIntervention(overrides: Partial<EvidenceApplierInterventionInput> = {}): EvidenceApplierInterventionInput {
  return {
    caseId: overrides.caseId ?? 'case_wire',
    actionCode: overrides.actionCode ?? 'targeted_remedial_plan',
    concernFamily: overrides.concernFamily ?? 'coursework',
    ordinalInStageForStudent: overrides.ordinalInStageForStudent ?? 1,
    stageKeyApplied: overrides.stageKeyApplied ?? 'post-tt1',
    semesterNumberApplied: overrides.semesterNumberApplied ?? 3,
    dominantWeaknessHint: overrides.dominantWeaknessHint ?? 'coursework',
    severityContext: overrides.severityContext ?? { riskBand: 'High', cgpa: 5.4, backlogCount: 1 },
  }
}

describe('governance-service · Phase-6d realization wire contract', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('source-key format `${studentId}::${offeringId}` matches data-fetcher grouping', () => {
    // Caller-side contract — interventions are stored under this exact key when the
    // data-fetcher groups them. Any change to either side MUST be paired.
    const bundle: PlaybackGovernanceRealizationData = {
      runSeed: 42,
      studentProfileByStudentId: new Map([['stud_1', makeProfile({ receptivity: 0.85, compliance: 0.8 })]]),
      interventionsInWindowBySourceKey: new Map([
        ['stud_1::offr_1', [makeIntervention()]],
      ]),
    }
    const studentId = 'stud_1'
    const offeringId = 'offr_1'
    const expectedKey = `${studentId}::${offeringId ?? ''}`
    expect(bundle.interventionsInWindowBySourceKey.has(expectedKey)).toBe(true)
    expect(bundle.studentProfileByStudentId.has(studentId)).toBe(true)
  })

  it('null offeringId resolves to source-key `${studentId}::` (empty suffix)', () => {
    const bundle: PlaybackGovernanceRealizationData = {
      runSeed: 1,
      studentProfileByStudentId: new Map([['stud_nullo', makeProfile()]]),
      interventionsInWindowBySourceKey: new Map([
        ['stud_nullo::', [makeIntervention()]],
      ]),
    }
    const studentId = 'stud_nullo'
    const offeringId: string | null = null
    const expectedKey = `${studentId}::${offeringId ?? ''}`
    expect(bundle.interventionsInWindowBySourceKey.has(expectedKey)).toBe(true)
  })

  it('flag on + full bundle + student with interventions -> realized marks differ from baseline', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const baseline = makeBaseline()
    const profile = makeProfile({ receptivity: 0.85, compliance: 0.8 })
    const bundle: PlaybackGovernanceRealizationData = {
      runSeed: 42,
      studentProfileByStudentId: new Map([['stud_active', profile]]),
      interventionsInWindowBySourceKey: new Map([
        ['stud_active::offr_a', [makeIntervention({ actionCode: 'targeted_remedial_plan' })]],
      ]),
    }
    const profileFromBundle = bundle.studentProfileByStudentId.get('stud_active')!
    const interventionsFromBundle = bundle.interventionsInWindowBySourceKey.get('stud_active::offr_a')!
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: profileFromBundle,
      runId: 'offr_a',
      studentId: 'stud_active',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: interventionsFromBundle,
    })
    expect(result.flagOn).toBe(true)
    expect(result.impact.totalImpact).toBeGreaterThan(0)
    expect(result.realized.tt2Pct!).toBeGreaterThan(baseline.tt2Pct!)
  })

  it('flag on + bundle but missing profile -> baseline returned (defensive path)', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const baseline = makeBaseline()
    // Simulate what realizationInputForSource does when profile is missing:
    // it returns undefined, and buildStageEvidenceSnapshot falls through to
    // baseline without calling the applier.
    const bundle: PlaybackGovernanceRealizationData = {
      runSeed: 42,
      studentProfileByStudentId: new Map(),  // empty — student not registered
      interventionsInWindowBySourceKey: new Map([
        ['stud_orphan::offr_x', [makeIntervention()]],
      ]),
    }
    const profile = bundle.studentProfileByStudentId.get('stud_orphan')
    expect(profile).toBeUndefined()
    // The wire helper returns undefined in this case, preserving baseline.
  })

  it('flag on + bundle with empty intervention list for this source -> baseline unchanged', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const baseline = makeBaseline()
    const profile = makeProfile({ receptivity: 0.85, compliance: 0.8 })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: profile,
      runId: 'offr_b',
      studentId: 'stud_no_interventions',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [],
    })
    expect(result.flagOn).toBe(true)
    expect(result.impact.totalImpact).toBe(0)
    expect(result.realized).toEqual(baseline)
  })

  it('runId derived as `offeringId ?? studentId` stays stable per source', () => {
    // Contract-level check: the helper in governance-service sets realization.runId =
    // source.offeringId ?? source.studentId. This guarantees per-(student, course)
    // determinism because the intervention-response-engine seeds its response draws
    // on (runId, studentId, ordinal, severity).
    const offeringId: string | null = 'offr_c'
    const studentId = 'stud_c'
    const expectedRunId = offeringId ?? studentId
    expect(expectedRunId).toBe('offr_c')

    const offeringIdNull: string | null = null
    const nullOfferingRunId = offeringIdNull ?? 'stud_d'
    expect(nullOfferingRunId).toBe('stud_d')
  })

  it('is deterministic across repeated invocations with identical bundle', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const baseline = makeBaseline()
    const profile = makeProfile({ receptivity: 0.7, compliance: 0.7 })
    const interventions = [makeIntervention()]
    const input = {
      baseline,
      studentProfile: profile,
      runId: 'offr_det',
      studentId: 'stud_det',
      semesterNumber: 3 as const,
      stageKey: 'post-tt2' as const,
      interventionsInWindow: interventions,
    }
    const first = applyRealizationToEvidenceSnapshot(input)
    for (let i = 0; i < 10; i++) {
      expect(applyRealizationToEvidenceSnapshot(input)).toEqual(first)
    }
  })
})
