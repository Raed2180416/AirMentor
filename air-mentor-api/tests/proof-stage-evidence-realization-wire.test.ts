// Integration test for the Phase-6a wire-up of the stage-realization evidence applier
// into buildStageEvidenceSnapshot. Proves that when a caller passes the realization
// input AND the AIRMENTOR_STAGE_REALIZATION_V1 flag is on, the returned snapshot
// reflects intervention deltas on top of the baseline evidence produced by the
// existing playback machinery.
//
// This test exercises the ACTUAL playback service (not the applier in isolation) to
// guarantee the wiring point behaves correctly and that existing flag-off callers see
// bytewise-identical behaviour.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildStageEvidenceSnapshot } from '../src/lib/proof-control-plane-playback-service.js'
import { STAGE_REALIZATION_FLAG_NAME } from '../src/lib/proof-stage-realization-evidence-applier.js'
import type {
  EvidenceApplierInterventionInput,
} from '../src/lib/proof-stage-realization-evidence-applier.js'
import type {
  StudentLatentProfileForIntervention,
} from '../src/lib/proof-intervention-response-types.js'
import type {
  StageCourseProjectionSource,
} from '../src/lib/msruas-proof-control-plane.js'
import type { simulationQuestionTemplates } from '../src/db/schema.js'
import type { ResolvedPolicy } from '../src/modules/admin-structure.js'

function makeSource(overrides: Partial<StageCourseProjectionSource> = {}): StageCourseProjectionSource {
  return {
    studentId: overrides.studentId ?? 'stud_integration',
    studentName: overrides.studentName ?? 'Test Student',
    usn: overrides.usn ?? 'USN001',
    semesterNumber: overrides.semesterNumber ?? 3,
    sectionCode: overrides.sectionCode ?? 'A',
    termId: overrides.termId ?? null,
    offeringId: overrides.offeringId ?? 'offering_x',
    curriculumNodeId: overrides.curriculumNodeId ?? null,
    courseCode: overrides.courseCode ?? 'CS301',
    courseTitle: overrides.courseTitle ?? 'Algorithms',
    courseFamily: overrides.courseFamily ?? 'CS',
    attendanceHistory: overrides.attendanceHistory ?? [
      { checkpoint: 'wk4',  checkpointLabel: 'Week 4',  presentClasses: 14, totalClasses: 16, attendancePct: 87.5 },
      { checkpoint: 'wk8',  checkpointLabel: 'Week 8',  presentClasses: 27, totalClasses: 32, attendancePct: 84.4 },
      { checkpoint: 'wk12', checkpointLabel: 'Week 12', presentClasses: 39, totalClasses: 48, attendancePct: 81.3 },
      { checkpoint: 'wk16', checkpointLabel: 'Week 16', presentClasses: 50, totalClasses: 64, attendancePct: 78.1 },
    ],
    attendancePct: overrides.attendancePct ?? 78.1,
    tt1Pct: overrides.tt1Pct ?? 55,
    tt2Pct: overrides.tt2Pct ?? 52,
    quizPct: overrides.quizPct ?? 61,
    assignmentPct: overrides.assignmentPct ?? 65,
    cePct: overrides.cePct ?? 58,
    seePct: overrides.seePct ?? 48,
    finalMark: overrides.finalMark ?? 52,
    result: overrides.result ?? 'Passed',
    previousCgpa: overrides.previousCgpa ?? 6.2,
    previousBacklogCount: overrides.previousBacklogCount ?? 0,
    closingCgpa: overrides.closingCgpa ?? 6.0,
    closingBacklogCount: overrides.closingBacklogCount ?? 0,
    questionRows: overrides.questionRows ?? [],
    coRows: overrides.coRows ?? [],
    interventionResponse: overrides.interventionResponse ?? null,
  }
}

function makePolicy(): ResolvedPolicy {
  return {
    attendanceRules: {
      minimumRequiredPercent: 75,
      condonationThresholdPercent: 65,
      condonationCapPerSemester: 2,
    },
    passRules: {
      minimumCeMark: 20,
      ceMaximum: 50,
      minimumSeeMark: 20,
      seeMaximum: 50,
      minimumOverallPercent: 40,
      overallMaximum: 100,
    },
    simulationRules: {
      defaultSeedOffset: 0,
    },
  } as unknown as ResolvedPolicy
}

function makeProfile(overrides: Partial<{
  interventionReceptivity: number
  practiceCompliance: number
}> = {}): StudentLatentProfileForIntervention {
  return {
    dynamics: {
      forgetRate: 0.1,
      relearnRate: 0.5,
      transferGainRate: 0.4,
      studyGainRate: 0.5,
      fatigueRate: 0.1,
      consistency: 0.55,
      volatility: 0.22,
      recoveryTendency: 0.5,
      relapseTendency: 0.22,
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

function makeIntervention(overrides: Partial<EvidenceApplierInterventionInput> = {}): EvidenceApplierInterventionInput {
  return {
    caseId: overrides.caseId ?? 'case_i',
    actionCode: overrides.actionCode ?? 'targeted_remedial_plan',
    concernFamily: overrides.concernFamily ?? 'coursework',
    ordinalInStageForStudent: overrides.ordinalInStageForStudent ?? 1,
    stageKeyApplied: overrides.stageKeyApplied ?? 'post-tt1',
    semesterNumberApplied: overrides.semesterNumberApplied ?? 3,
    dominantWeaknessHint: overrides.dominantWeaknessHint ?? 'coursework',
    severityContext: overrides.severityContext ?? { riskBand: 'High', cgpa: 5.5, backlogCount: 1 },
  }
}

const emptyTemplates = new Map<string, typeof simulationQuestionTemplates.$inferSelect>()

describe('buildStageEvidenceSnapshot · Phase-6a realization wire-up', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('no realization input -> post-tt2 snapshot hides future CE evidence', () => {
    const source = makeSource()
    const snapshot = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-tt2',
      policy: makePolicy(),
      templatesById: emptyTemplates,
    })
    expect(snapshot.tt1Pct).toBe(55)
    expect(snapshot.tt2Pct).toBe(52)
    expect(snapshot.quizPct).toBeNull()
    expect(snapshot.assignmentPct).toBeNull()
    expect(snapshot.seePct).toBeNull()
  })

  it('realization input + flag off -> baseline snapshot (flag gate)', () => {
    // flag is NOT set in env
    const source = makeSource()
    const snapshot = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-tt2',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_integ',
        runSeed: 123,
        studentProfile: makeProfile({ interventionReceptivity: 0.9 }),
        interventionsInWindow: [makeIntervention()],
      },
    })
    expect(snapshot.tt2Pct).toBe(52)
    expect(snapshot.quizPct).toBeNull()
    expect(snapshot.assignmentPct).toBeNull()
  })

  it('realization input + flag on + zero interventions -> baseline (no-op)', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource()
    const snapshot = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-tt2',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_integ',
        runSeed: 123,
        studentProfile: makeProfile(),
        interventionsInWindow: [],
      },
    })
    expect(snapshot.tt2Pct).toBe(52)
    expect(snapshot.quizPct).toBeNull()
  })

  it('realization input + flag on + workflow-only interventions -> baseline (zero-impact filter)', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource()
    const snapshot = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-tt2',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_integ',
        runSeed: 123,
        studentProfile: makeProfile(),
        interventionsInWindow: [
          makeIntervention({ actionCode: 'faculty_followup_reminder' }),
          makeIntervention({ caseId: 'b', actionCode: 'generic_default_family_action' }),
        ],
      },
    })
    expect(snapshot.tt2Pct).toBe(52)
    expect(snapshot.quizPct).toBeNull()
    expect(snapshot.assignmentPct).toBeNull()
  })

  it('realization input + flag on + student-facing intervention -> realized delta applied at CE stage', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource({
      tt2Pct: 50,
      quizPct: 55,
      assignmentPct: 60,
    })
    const baseline = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-assignments',
      policy: makePolicy(),
      templatesById: emptyTemplates,
    })
    const realized = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-assignments',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_integ_realized',
        runSeed: 999,
        studentProfile: makeProfile({ interventionReceptivity: 0.85, practiceCompliance: 0.8 }),
        interventionsInWindow: [
          makeIntervention({
            actionCode: 'targeted_remedial_plan',
            dominantWeaknessHint: 'coursework',
            severityContext: { riskBand: 'High', cgpa: 5.2, backlogCount: 1 },
          }),
        ],
      },
    })
    // Realized TT2/quiz/assignment should be strictly higher than baseline
    expect(realized.tt2Pct!).toBeGreaterThan(baseline.tt2Pct!)
    expect(realized.quizPct!).toBeGreaterThan(baseline.quizPct!)
    expect(realized.assignmentPct!).toBeGreaterThan(baseline.assignmentPct!)
    // TT1 immutable
    expect(realized.tt1Pct).toBe(baseline.tt1Pct)
    // Non-assessment fields unchanged
    expect(realized.weakCoCount).toBe(baseline.weakCoCount)
    expect(realized.weakQuestionCount).toBe(baseline.weakQuestionCount)
    expect(realized.currentCgpa).toBe(baseline.currentCgpa)
    expect(realized.backlogCount).toBe(baseline.backlogCount)
  })

  it('realization is deterministic across invocations with identical inputs', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource()
    const profile = makeProfile({ interventionReceptivity: 0.7, practiceCompliance: 0.7 })
    const input = {
      source,
      stageKey: 'post-assignments' as const,
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_det',
        runSeed: 42,
        studentProfile: profile,
        interventionsInWindow: [makeIntervention()],
      },
    }
    const first = buildStageEvidenceSnapshot(input)
    for (let i = 0; i < 5; i++) {
      const repeat = buildStageEvidenceSnapshot(input)
      expect(repeat.tt2Pct).toBe(first.tt2Pct)
      expect(repeat.quizPct).toBe(first.quizPct)
      expect(repeat.assignmentPct).toBe(first.assignmentPct)
      expect(repeat.attendancePct).toBe(first.attendancePct)
    }
  })

  it('realization preserves final-mark residual when rebuilding post-see overall', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource({
      cePct: 58,
      seePct: 48,
      finalMark: 54,
    })
    const baseline = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-see',
      policy: makePolicy(),
      templatesById: emptyTemplates,
    })
    const realized = buildStageEvidenceSnapshot({
      source,
      stageKey: 'post-see',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_overall_residual',
        runSeed: 991,
        studentProfile: makeProfile({ interventionReceptivity: 0.85, practiceCompliance: 0.8 }),
        interventionsInWindow: [
          makeIntervention({
            actionCode: 'targeted_remedial_plan',
            dominantWeaknessHint: 'coursework',
            severityContext: { riskBand: 'High', cgpa: 5.2, backlogCount: 1 },
          }),
        ],
      },
    })

    expect(realized.cePct!).toBeGreaterThan(baseline.cePct!)
    expect(realized.seePct!).toBeGreaterThan(baseline.seePct!)
    expect(realized.overallPct!).toBeGreaterThanOrEqual(baseline.overallPct!)
  })

  it('realization honours per-stage visibility: pre-tt1 keeps tt2/see null', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    const source = makeSource()
    const snapshot = buildStageEvidenceSnapshot({
      source,
      stageKey: 'pre-tt1',
      policy: makePolicy(),
      templatesById: emptyTemplates,
      realization: {
        runId: 'run_pre',
        runSeed: 1,
        studentProfile: makeProfile({ interventionReceptivity: 0.9 }),
        interventionsInWindow: [makeIntervention({ actionCode: 'targeted_remedial_plan' })],
      },
    })
    // pre-tt1 stage: tt1/tt2/quiz/assignment/see should all be null per playback rules
    expect(snapshot.tt1Pct).toBeNull()
    expect(snapshot.tt2Pct).toBeNull()
    expect(snapshot.seePct).toBeNull()
  })
})
