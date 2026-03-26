import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
import {
  PROOF_CORPUS_MANIFEST,
  PROOF_CORPUS_MANIFEST_VERSION,
  PRODUCTION_RISK_THRESHOLDS,
  buildObservableFeaturePayload,
  scoreObservableRiskWithModel,
  summarizeProofRiskModelEvaluation,
  trainProofRiskModel,
  type ObservableFeaturePayload,
  type ObservableLabelPayload,
  type ObservableRiskEvidenceRow,
  type ObservableSourceRefs,
  type ProofRunModelMetadata,
} from '../src/lib/proof-risk-model.js'

function buildFeaturePayload(index: number, risky: boolean): ObservableFeaturePayload {
  return buildObservableFeaturePayload({
    attendancePct: risky ? 58 + (index % 6) : 82 - (index % 4),
    attendanceHistory: risky
      ? [{ attendancePct: 76 - (index % 4) }, { attendancePct: 58 + (index % 6) }]
      : [{ attendancePct: 78 - (index % 3) }, { attendancePct: 82 - (index % 4) }],
    currentCgpa: risky ? 5.6 + ((index % 4) * 0.1) : 8.2 - ((index % 3) * 0.1),
    backlogCount: risky ? 2 + (index % 2) : 0,
    tt1Pct: risky ? 34 + (index % 8) : 74 - (index % 6),
    tt2Pct: risky ? 36 + (index % 8) : 76 - (index % 5),
    seePct: risky ? 32 + (index % 7) : 72 - (index % 5),
    quizPct: risky ? 38 + (index % 6) : 78 - (index % 6),
    assignmentPct: risky ? 41 + (index % 5) : 80 - (index % 4),
    weakCoCount: risky ? 3 : 0,
    weakQuestionCount: risky ? 5 : 1,
    interventionResponseScore: risky ? -0.18 : 0.14,
    prerequisiteAveragePct: risky ? 44 : 76,
    prerequisiteFailureCount: risky ? 2 : 0,
    prerequisiteCourseCodes: risky ? ['AMC101', 'AMC102', 'AMC103'] : ['AMC101'],
    semesterProgress: 0.2 + ((index % 5) * 0.15),
    sectionRiskRate: risky ? 0.64 : 0.22,
  })
}

function buildLabelPayload(risky: boolean): ObservableLabelPayload {
  return {
    attendanceRiskLabel: risky ? 1 : 0,
    ceShortfallLabel: risky ? 1 : 0,
    seeShortfallLabel: risky ? 1 : 0,
    overallCourseFailLabel: risky ? 1 : 0,
    downstreamCarryoverLabel: risky ? 1 : 0,
  }
}

function buildSourceRefs(input: {
  runId: string
  studentId: string
  semesterNumber: number
  stageKey: string
  sectionCode: string
  courseCode: string
  coEvidenceMode: string
}): ObservableSourceRefs {
  return {
    simulationRunId: input.runId,
    simulationStageCheckpointId: `${input.runId}-${input.studentId}-${input.stageKey}`,
    studentId: input.studentId,
    offeringId: `${input.runId}-${input.courseCode}`,
    semesterNumber: input.semesterNumber,
    sectionCode: input.sectionCode,
    courseCode: input.courseCode,
    courseTitle: `Course ${input.courseCode}`,
    courseFamily: input.courseCode.endsWith('L') ? 'lab-like' : 'theory-heavy',
    coEvidenceMode: input.coEvidenceMode,
    stageKey: input.stageKey,
    prerequisiteCourseCodes: ['AMC101', 'AMC102'],
    prerequisiteWeakCourseCodes: input.courseCode === 'AMC301' ? ['AMC101'] : [],
    weakCourseOutcomeCodes: input.courseCode === 'AMC301' ? ['CO2'] : [],
    dominantQuestionTopics: input.courseCode === 'AMC301' ? ['recurrences'] : ['logic'],
  }
}

function buildRowsForRun(seed: number, count: number, riskyOffset = 0): ObservableRiskEvidenceRow[] {
  const runId = `sim-${seed}`
  return Array.from({ length: count }, (_, index) => {
    const risky = ((index + riskyOffset) % 2) === 0
    return {
      riskEvidenceSnapshotId: `${runId}-${index}`,
      batchId: 'batch-proof',
      featurePayload: buildFeaturePayload(index, risky),
      labelPayload: buildLabelPayload(risky),
      sourceRefs: buildSourceRefs({
        runId,
        studentId: `student-${index}`,
        semesterNumber: 1 + (index % 6),
        stageKey: ['semester-start', 'post-tt1', 'post-reassessment', 'post-tt2', 'post-see', 'semester-close'][index % 6]!,
        sectionCode: index % 2 === 0 ? 'A' : 'B',
        courseCode: index % 3 === 0 ? 'AMC301' : index % 3 === 1 ? 'AMC302' : 'AMC303L',
        coEvidenceMode: index % 3 === 2 ? 'rubric-derived' : 'synthetic-blueprint',
      }),
    }
  })
}

describe('proof risk model', () => {
  it('trains deterministically on governed manifest rows and skips non-manifest runs', () => {
    const manifestEntries = [
      PROOF_CORPUS_MANIFEST[0]!,
      PROOF_CORPUS_MANIFEST[40]!,
      PROOF_CORPUS_MANIFEST[52]!,
    ]
    const runMetadataById = new Map<string, ProofRunModelMetadata>(manifestEntries.map(entry => [
      `sim-${entry.seed}`,
      {
        simulationRunId: `sim-${entry.seed}`,
        seed: entry.seed,
        split: entry.split,
        scenarioFamily: entry.scenarioFamily,
      },
    ]))
    runMetadataById.set('sim-999999', {
      simulationRunId: 'sim-999999',
      seed: 999999,
      scenarioFamily: 'balanced',
    })

    const rows = [
      ...buildRowsForRun(manifestEntries[0]!.seed, 20),
      ...buildRowsForRun(manifestEntries[1]!.seed, 20, 1),
      ...buildRowsForRun(manifestEntries[2]!.seed, 20, 2),
      ...buildRowsForRun(999999, 20, 3),
    ]

    const firstBundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', { runMetadataById })
    const secondBundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', { runMetadataById })

    expect(firstBundle).not.toBeNull()
    expect(secondBundle).not.toBeNull()

    const firstEvaluation = summarizeProofRiskModelEvaluation(firstBundle!)
    const secondEvaluation = summarizeProofRiskModelEvaluation(secondBundle!)
    expect(firstEvaluation).toEqual(secondEvaluation)

    expect(firstBundle!.production.trainingManifestVersion).toBe(PROOF_CORPUS_MANIFEST_VERSION)
    expect(firstBundle!.production.thresholds).toEqual(PRODUCTION_RISK_THRESHOLDS)
    expect(firstBundle!.production.worldSplitSummary).toEqual({
      train: 1,
      validation: 1,
      test: 1,
    })
    expect(firstBundle!.production.splitSummary).toEqual({
      train: 20,
      validation: 20,
      test: 20,
    })
    expect(firstBundle!.production.headSupportSummary.overallCourseRisk).toMatchObject({
      trainSupport: 20,
      validationSupport: 20,
      testSupport: 20,
    })
    expect(firstEvaluation.production.thresholds).toEqual(PRODUCTION_RISK_THRESHOLDS)
    expect(firstBundle!.production.heads.overallCourseRisk.calibration.displayProbabilityAllowed).toBe(false)
    expect(firstBundle!.production.heads.overallCourseRisk.calibration.supportWarning).toContain('support')

    const probePayload = rows[0]!.featurePayload
    const probeRefs = rows[0]!.sourceRefs
    const scored = scoreObservableRiskWithModel({
      attendancePct: probePayload.attendancePct,
      currentCgpa: probePayload.currentCgpa,
      backlogCount: probePayload.backlogCount,
      tt1Pct: probePayload.tt1Pct,
      tt2Pct: probePayload.tt2Pct,
      quizPct: probePayload.quizPct,
      assignmentPct: probePayload.assignmentPct,
      seePct: probePayload.seePct,
      weakCoCount: probePayload.weakCoCount,
      attendanceHistoryRiskCount: probePayload.attendanceHistoryRiskCount,
      questionWeaknessCount: probePayload.weakQuestionCount,
      interventionResponseScore: probePayload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: probePayload,
      sourceRefs: probeRefs,
      productionModel: firstBundle!.production,
      correlations: firstBundle!.correlations,
    })

    expect(scored.headDisplay.overallCourseRisk.displayProbabilityAllowed).toBe(false)
    expect(scored.headDisplay.overallCourseRisk.supportWarning).toContain('support')
    expect(scored.riskProb).toBe(scored.headProbabilities.overallCourseRisk)
    expect(scored.queuePriorityScore).toBeLessThanOrEqual(0.95)
  })

  it('exposes deterministic carryover features and lifts downstream carryover risk for weaker prerequisite chains', () => {
    const cautiousPayload = buildObservableFeaturePayload({
      attendancePct: 81,
      attendanceHistory: [{ attendancePct: 79 }, { attendancePct: 81 }],
      currentCgpa: 8.1,
      backlogCount: 0,
      tt1Pct: 76,
      tt2Pct: 74,
      quizPct: 78,
      assignmentPct: 80,
      seePct: 73,
      weakCoCount: 0,
      weakQuestionCount: 1,
      interventionResponseScore: 0.12,
      prerequisiteAveragePct: 82,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: ['AMC101'],
      downstreamDependencyLoad: 0.12,
      weakPrerequisiteChainCount: 0,
      repeatedWeakPrerequisiteFamilyCount: 0,
      semesterProgress: 0.35,
      sectionRiskRate: 0.18,
    })
    const pressuredPayload = buildObservableFeaturePayload({
      attendancePct: 81,
      attendanceHistory: [{ attendancePct: 68 }, { attendancePct: 81 }],
      currentCgpa: 8.1,
      backlogCount: 0,
      tt1Pct: 76,
      tt2Pct: 74,
      quizPct: 78,
      assignmentPct: 80,
      seePct: 73,
      weakCoCount: 0,
      weakQuestionCount: 1,
      interventionResponseScore: 0.12,
      prerequisiteAveragePct: 46,
      prerequisiteFailureCount: 3,
      prerequisiteCourseCodes: ['AMC101', 'AMC102', 'AMC201', 'AMC202'],
      downstreamDependencyLoad: 0.72,
      weakPrerequisiteChainCount: 3,
      repeatedWeakPrerequisiteFamilyCount: 2,
      semesterProgress: 0.9,
      sectionRiskRate: 0.62,
    })

    expect(pressuredPayload.prerequisiteChainDepth).toBeGreaterThan(cautiousPayload.prerequisiteChainDepth)
    expect(pressuredPayload.prerequisiteWeakCourseRate).toBeGreaterThan(cautiousPayload.prerequisiteWeakCourseRate)
    expect(pressuredPayload.prerequisiteCarryoverLoad).toBeGreaterThan(cautiousPayload.prerequisiteCarryoverLoad)
    expect(pressuredPayload.prerequisiteRecencyWeightedFailure).toBeGreaterThan(cautiousPayload.prerequisiteRecencyWeightedFailure)
    expect(pressuredPayload.downstreamDependencyLoad).toBeGreaterThan(cautiousPayload.downstreamDependencyLoad)
    expect(pressuredPayload.weakPrerequisiteChainCount).toBeGreaterThan(cautiousPayload.weakPrerequisiteChainCount)
    expect(pressuredPayload.repeatedWeakPrerequisiteFamilyCount).toBeGreaterThan(cautiousPayload.repeatedWeakPrerequisiteFamilyCount)

    const manifestEntries = [PROOF_CORPUS_MANIFEST[0]!, PROOF_CORPUS_MANIFEST[40]!, PROOF_CORPUS_MANIFEST[52]!]
    const runMetadataById = new Map<string, ProofRunModelMetadata>(manifestEntries.map(entry => [
      `sim-${entry.seed}`,
      {
        simulationRunId: `sim-${entry.seed}`,
        seed: entry.seed,
        split: entry.split,
        scenarioFamily: entry.scenarioFamily,
      },
    ]))
    const rows = [
      ...buildRowsForRun(manifestEntries[0]!.seed, 20),
      ...buildRowsForRun(manifestEntries[1]!.seed, 20, 1),
      ...buildRowsForRun(manifestEntries[2]!.seed, 20, 2),
    ]
    const bundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', { runMetadataById })
    expect(bundle).not.toBeNull()

    const scoredCautious = scoreObservableRiskWithModel({
      attendancePct: cautiousPayload.attendancePct,
      currentCgpa: cautiousPayload.currentCgpa,
      backlogCount: cautiousPayload.backlogCount,
      tt1Pct: cautiousPayload.tt1Pct,
      tt2Pct: cautiousPayload.tt2Pct,
      quizPct: cautiousPayload.quizPct,
      assignmentPct: cautiousPayload.assignmentPct,
      seePct: cautiousPayload.seePct,
      weakCoCount: cautiousPayload.weakCoCount,
      attendanceHistoryRiskCount: cautiousPayload.attendanceHistoryRiskCount,
      questionWeaknessCount: cautiousPayload.weakQuestionCount,
      interventionResponseScore: cautiousPayload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: cautiousPayload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-carryover',
        studentId: 'student-cautious',
        semesterNumber: 4,
        stageKey: 'semester-close',
        sectionCode: 'A',
        courseCode: 'AMC302',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    const scoredPressured = scoreObservableRiskWithModel({
      attendancePct: pressuredPayload.attendancePct,
      currentCgpa: pressuredPayload.currentCgpa,
      backlogCount: pressuredPayload.backlogCount,
      tt1Pct: pressuredPayload.tt1Pct,
      tt2Pct: pressuredPayload.tt2Pct,
      quizPct: pressuredPayload.quizPct,
      assignmentPct: pressuredPayload.assignmentPct,
      seePct: pressuredPayload.seePct,
      weakCoCount: pressuredPayload.weakCoCount,
      attendanceHistoryRiskCount: pressuredPayload.attendanceHistoryRiskCount,
      questionWeaknessCount: pressuredPayload.weakQuestionCount,
      interventionResponseScore: pressuredPayload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: pressuredPayload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-carryover',
        studentId: 'student-pressured',
        semesterNumber: 4,
        stageKey: 'semester-close',
        sectionCode: 'A',
        courseCode: 'AMC302',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })

    expect(scoredPressured.headProbabilities.downstreamCarryoverRisk).toBeGreaterThan(scoredCautious.headProbabilities.downstreamCarryoverRisk)
  })
})
