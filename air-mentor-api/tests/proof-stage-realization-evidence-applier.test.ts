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

function makeProfile(overrides: Partial<{
  interventionReceptivity: number
  practiceCompliance: number
  consistency: number
  volatility: number
}> = {}): StudentLatentProfileForIntervention {
  return {
    dynamics: {
      forgetRate: 0.1,
      relearnRate: 0.55,
      transferGainRate: 0.4,
      studyGainRate: 0.5,
      fatigueRate: 0.08,
      consistency: overrides.consistency ?? 0.6,
      volatility: overrides.volatility ?? 0.2,
      recoveryTendency: 0.5,
      relapseTendency: 0.2,
    },
    behavior: {
      practiceCompliance: overrides.practiceCompliance ?? 0.55,
      helpSeekingTendency: 0.4,
      examPressure: 0.35,
    },
    intervention: {
      interventionReceptivity: overrides.interventionReceptivity ?? 0.6,
      temporaryUpliftCredit: 0.1,
      expectedRecoveryThreshold: 0.12,
    },
  }
}

function makeBaseline(overrides: Partial<StageBaselineEvidence> = {}): StageBaselineEvidence {
  return {
    attendancePct: 78,
    tt1Pct: 55,
    tt2Pct: 52,
    quizPct: 61,
    assignmentPct: 65,
    seePct: 48,
    cePct: 58,
    ...overrides,
  }
}

function makeIntervention(overrides: Partial<EvidenceApplierInterventionInput> = {}): EvidenceApplierInterventionInput {
  return {
    caseId: overrides.caseId ?? 'case_a',
    actionCode: overrides.actionCode ?? 'targeted_remedial_plan',
    concernFamily: overrides.concernFamily ?? 'coursework',
    ordinalInStageForStudent: overrides.ordinalInStageForStudent ?? 1,
    stageKeyApplied: overrides.stageKeyApplied ?? 'post-tt1',
    semesterNumberApplied: overrides.semesterNumberApplied ?? 3,
    dominantWeaknessHint: overrides.dominantWeaknessHint ?? 'coursework',
    severityContext: overrides.severityContext ?? {
      riskBand: 'Medium',
      cgpa: 6.0,
      backlogCount: 0,
    },
  }
}

describe('evidence-applier · flag-off semantics', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('flag off + interventions present -> realized === baseline', () => {
    const baseline = makeBaseline()
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_a',
      studentId: 'stud_1',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [makeIntervention()],
    })
    expect(result.flagOn).toBe(false)
    expect(result.realized).toEqual(baseline)
    expect(result.impact.totalImpact).toBe(0)
    expect(result.impact.appliedCount).toBe(0)
    expect(result.impact.dominantTier).toBeNull()
  })

  it('flag off + zero interventions -> realized === baseline', () => {
    const baseline = makeBaseline()
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_b',
      studentId: 'stud_2',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [],
    })
    expect(result.flagOn).toBe(false)
    expect(result.realized).toEqual(baseline)
  })
})

describe('evidence-applier · flag-on no-op for zero interventions', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('flag on + zero interventions -> realized === baseline', () => {
    const baseline = makeBaseline()
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_c',
      studentId: 'stud_3',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [],
    })
    expect(result.flagOn).toBe(true)
    expect(result.realized).toEqual(baseline)
    expect(result.impact.totalImpact).toBe(0)
  })
})

describe('evidence-applier · flag-on intervention delta applied', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('single student-facing intervention raises tt2/quiz/assignment/see', () => {
    const baseline = makeBaseline({ tt2Pct: 50, quizPct: 55, assignmentPct: 60, seePct: 45 })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.85, practiceCompliance: 0.8 }),
      runId: 'run_intv',
      studentId: 'stud_intv',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [
        makeIntervention({
          actionCode: 'targeted_remedial_plan',
          dominantWeaknessHint: 'coursework',
          severityContext: { riskBand: 'High', cgpa: 5.2, backlogCount: 1 },
        }),
      ],
    })
    expect(result.impact.totalImpact).toBeGreaterThan(0)
    expect(result.realized.tt2Pct!).toBeGreaterThanOrEqual(baseline.tt2Pct!)
    expect(result.realized.quizPct!).toBeGreaterThanOrEqual(baseline.quizPct!)
    expect(result.realized.assignmentPct!).toBeGreaterThanOrEqual(baseline.assignmentPct!)
    expect(result.realized.seePct!).toBeGreaterThanOrEqual(baseline.seePct!)
  })

  it('TT1 stays immutable (delta = 0)', () => {
    const baseline = makeBaseline({ tt1Pct: 55 })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.9, practiceCompliance: 0.85 }),
      runId: 'run_tt1',
      studentId: 'stud_tt1',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [makeIntervention({ actionCode: 'targeted_remedial_plan' })],
    })
    expect(result.impact.markDeltas.tt1).toBe(0)
    expect(result.realized.tt1Pct).toBe(baseline.tt1Pct)
  })

  it('null baseline fields remain null after delta application', () => {
    const baseline = makeBaseline({ tt2Pct: null, seePct: null, cePct: null })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_null',
      studentId: 'stud_null',
      semesterNumber: 3,
      stageKey: 'post-tt1',
      interventionsInWindow: [makeIntervention()],
    })
    expect(result.realized.tt2Pct).toBeNull()
    expect(result.realized.seePct).toBeNull()
    expect(result.realized.cePct).toBeNull()
  })

  it('workflow-only interventions (faculty_followup_reminder) contribute zero delta', () => {
    const baseline = makeBaseline()
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_wfl',
      studentId: 'stud_wfl',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [
        makeIntervention({ actionCode: 'faculty_followup_reminder' }),
        makeIntervention({ caseId: 'b', actionCode: 'generic_default_family_action' }),
      ],
    })
    expect(result.impact.totalImpact).toBe(0)
    expect(result.realized).toEqual(baseline)
  })

  it('CE rebuilt from shifted components + baseline noise residual', () => {
    const baseline = makeBaseline({
      tt1Pct: 50, tt2Pct: 48, quizPct: 55, assignmentPct: 60,
      cePct: 54,  // Some arbitrary baseline CE with an implicit noise residual
    })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.85, practiceCompliance: 0.8 }),
      runId: 'run_ce',
      studentId: 'stud_ce',
      semesterNumber: 3,
      stageKey: 'post-assignments',
      interventionsInWindow: [
        makeIntervention({
          actionCode: 'targeted_remedial_plan',
          severityContext: { riskBand: 'High', cgpa: 5.5, backlogCount: 1 },
        }),
      ],
    })
    const baselineWeighted = 50 * 0.28 + 48 * 0.27 + 55 * 0.2 + 60 * 0.25
    const baselineNoise = baseline.cePct! - baselineWeighted
    const expectedNewWeighted =
        result.realized.tt1Pct! * 0.28
      + result.realized.tt2Pct! * 0.27
      + result.realized.quizPct! * 0.2
      + result.realized.assignmentPct! * 0.25
    const expectedCe = Math.max(10, Math.min(97, expectedNewWeighted + baselineNoise))
    expect(result.realized.cePct).toBeCloseTo(expectedCe, 1)
  })

  it('CE remains baseline if any component is null (future stage)', () => {
    const baseline = makeBaseline({ tt2Pct: null, cePct: 50 })
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile(),
      runId: 'run_pnc',
      studentId: 'stud_pnc',
      semesterNumber: 3,
      stageKey: 'post-tt1',
      interventionsInWindow: [makeIntervention()],
    })
    expect(result.realized.cePct).toBe(50)
  })

  it('is deterministic across multiple invocations', () => {
    const baseline = makeBaseline()
    const profile = makeProfile({ interventionReceptivity: 0.7 })
    const input = {
      baseline,
      studentProfile: profile,
      runId: 'run_det',
      studentId: 'stud_det',
      semesterNumber: 3 as const,
      stageKey: 'post-tt2' as const,
      interventionsInWindow: [makeIntervention()],
    }
    const first = applyRealizationToEvidenceSnapshot(input)
    for (let i = 0; i < 20; i++) {
      expect(applyRealizationToEvidenceSnapshot(input)).toEqual(first)
    }
  })

  it('strong-profile student sees larger delta than resistant-profile on same intervention', () => {
    const baseline = makeBaseline({ tt2Pct: 55 })
    const strongResult = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.95, practiceCompliance: 0.9 }),
      runId: 'run_strong',
      studentId: 'stud_strong',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [makeIntervention({
        actionCode: 'targeted_remedial_plan',
        severityContext: { riskBand: 'High', cgpa: 5, backlogCount: 1 },
      })],
    })
    const resistantResult = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.1, practiceCompliance: 0.1 }),
      runId: 'run_resistant',
      studentId: 'stud_resistant',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: [makeIntervention({
        actionCode: 'targeted_remedial_plan',
        severityContext: { riskBand: 'High', cgpa: 5, backlogCount: 1 },
      })],
    })
    // Strong-profile student -> higher responseScore -> larger impact -> larger tt2 delta
    expect(strongResult.impact.totalImpact).toBeGreaterThan(resistantResult.impact.totalImpact)
  })
})

describe('evidence-applier · bounds safety', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('realized marks never exceed assessment upper bound', () => {
    // Baseline near ceiling + strong intervention should clamp to assessment max
    const baseline = makeBaseline({
      tt2Pct: 96, quizPct: 97, assignmentPct: 98, seePct: 96, attendancePct: 96,
    })
    const apps: EvidenceApplierInterventionInput[] = []
    for (let i = 0; i < 5; i++) {
      apps.push(makeIntervention({
        caseId: `c${i}`,
        actionCode: 'targeted_remedial_plan',
        ordinalInStageForStudent: 1,
        severityContext: { riskBand: 'Low', cgpa: 8.5, backlogCount: 0 },
      }))
    }
    const result = applyRealizationToEvidenceSnapshot({
      baseline,
      studentProfile: makeProfile({ interventionReceptivity: 0.95, practiceCompliance: 0.95 }),
      runId: 'run_ceil',
      studentId: 'stud_ceil',
      semesterNumber: 3,
      stageKey: 'post-tt2',
      interventionsInWindow: apps,
    })
    expect(result.realized.attendancePct).toBeLessThanOrEqual(98)
    expect(result.realized.tt2Pct!).toBeLessThanOrEqual(99)
    expect(result.realized.quizPct!).toBeLessThanOrEqual(99)
    expect(result.realized.assignmentPct!).toBeLessThanOrEqual(99)
    expect(result.realized.seePct!).toBeLessThanOrEqual(98)
  })
})
