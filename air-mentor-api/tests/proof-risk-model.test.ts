import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
import {
  BASELINE_V5_LIKE_PROOF_RISK_TRAINING_CONFIG,
  OBSERVABLE_FEATURE_KEYS,
  PROOF_CORPUS_MANIFEST,
  PROOF_CORPUS_MANIFEST_VERSION,
  PRODUCTION_RISK_THRESHOLDS,
  buildObservableFeaturePayload,
  featureVectorArrayFromPayload,
  scenarioFamilyForSeed,
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
    semesterNumber: 1, sectionRiskRate: risky ? 0.64 : 0.22,
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
        stageKey: ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see', 'post-see'][index % 6]!,
        sectionCode: index % 2 === 0 ? 'A' : 'B',
        courseCode: index % 3 === 0 ? 'AMC301' : index % 3 === 1 ? 'AMC302' : 'AMC303L',
        coEvidenceMode: index % 3 === 2 ? 'rubric-derived' : 'synthetic-blueprint',
      }),
    }
  })
}

describe('proof risk model', () => {
  it('aligns scenario family lookup with governed manifest seeds', () => {
    PROOF_CORPUS_MANIFEST.slice(0, 16).forEach(entry => {
      expect(scenarioFamilyForSeed(entry.seed)).toBe(entry.scenarioFamily)
    })
  })

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
    expect(firstBundle!.production.modelFamily).toBe('logistic')
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
    expect(scored.riskProb).toBeGreaterThanOrEqual(scored.headProbabilities.overallCourseRisk)
    expect(scored.queuePriorityScore).toBe(scored.riskProb)
    expect(scored.queuePrioritySource).toBe('overall-course-risk-head')
    expect(scored.queuePriorityScore).toBeGreaterThanOrEqual(0)
    expect(scored.queuePriorityScore).toBeLessThanOrEqual(1)
  })

  it('enforces institutional policy floors over model-backed serving scores', () => {
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
    const rows = [
      ...buildRowsForRun(manifestEntries[0]!.seed, 20),
      ...buildRowsForRun(manifestEntries[1]!.seed, 20, 1),
      ...buildRowsForRun(manifestEntries[2]!.seed, 20, 2),
    ]
    const bundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', { runMetadataById })
    expect(bundle).not.toBeNull()

    const strongButAttendanceShort = buildObservableFeaturePayload({
      attendancePct: 74,
      attendanceHistory: [{ attendancePct: 76 }, { attendancePct: 74 }],
      currentCgpa: 8.4,
      backlogCount: 0,
      tt1Pct: 82,
      tt2Pct: 84,
      quizPct: 86,
      assignmentPct: 88,
      seePct: 82,
      weakCoCount: 0,
      weakQuestionCount: 0,
      interventionResponseScore: 0.18,
      prerequisiteAveragePct: 78,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: ['AMC101'],
      semesterNumber: 2,
      sectionRiskRate: 0.12,
      semesterProgress: 1,
    })
    const attendanceScored = scoreObservableRiskWithModel({
      attendancePct: 74,
      currentCgpa: 8.4,
      backlogCount: 0,
      tt1Pct: 82,
      tt2Pct: 84,
      quizPct: 86,
      assignmentPct: 88,
      cePct: 84,
      seePct: 82,
      overallPct: 83.2,
      weakCoCount: 0,
      attendanceHistoryRiskCount: 1,
      questionWeaknessCount: 0,
      interventionResponseScore: 0.18,
      policy: DEFAULT_POLICY,
      featurePayload: strongButAttendanceShort,
      sourceRefs: buildSourceRefs({
        runId: 'sim-policy-floor',
        studentId: 'student-policy-attendance',
        semesterNumber: 2,
        stageKey: 'post-see',
        sectionCode: 'A',
        courseCode: 'AMC201',
        coEvidenceMode: 'rubric-derived',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    expect(attendanceScored.riskProb).toBeGreaterThanOrEqual(PRODUCTION_RISK_THRESHOLDS.medium)
    expect(attendanceScored.riskBand).not.toBe('Low')
    expect(attendanceScored.observableDrivers.some(driver => driver.feature === 'attendance')).toBe(true)

    const terminalFailure = buildObservableFeaturePayload({
      attendancePct: 88,
      attendanceHistory: [{ attendancePct: 88 }, { attendancePct: 89 }],
      currentCgpa: 8.2,
      backlogCount: 0,
      tt1Pct: 72,
      tt2Pct: 74,
      quizPct: 76,
      assignmentPct: 78,
      seePct: 30,
      weakCoCount: 0,
      weakQuestionCount: 0,
      interventionResponseScore: 0.1,
      prerequisiteAveragePct: 76,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: ['AMC101'],
      semesterNumber: 3,
      sectionRiskRate: 0.14,
      semesterProgress: 1,
    })
    const failureScored = scoreObservableRiskWithModel({
      attendancePct: 88,
      currentCgpa: 8.2,
      backlogCount: 0,
      tt1Pct: 72,
      tt2Pct: 74,
      quizPct: 76,
      assignmentPct: 78,
      cePct: 75,
      seePct: 30,
      overallPct: 33,
      weakCoCount: 0,
      attendanceHistoryRiskCount: 0,
      questionWeaknessCount: 0,
      interventionResponseScore: 0.1,
      policy: DEFAULT_POLICY,
      featurePayload: terminalFailure,
      sourceRefs: buildSourceRefs({
        runId: 'sim-policy-floor',
        studentId: 'student-policy-failure',
        semesterNumber: 3,
        stageKey: 'post-see',
        sectionCode: 'B',
        courseCode: 'AMC301',
        coEvidenceMode: 'rubric-derived',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    expect(failureScored.riskProb).toBeGreaterThanOrEqual(PRODUCTION_RISK_THRESHOLDS.high)
    expect(failureScored.riskBand).toBe('High')
    expect(failureScored.observableDrivers.some(driver => driver.feature === 'see' || driver.feature === 'overall')).toBe(true)

    const sparseSemesterOne = buildObservableFeaturePayload({
      attendancePct: 82,
      attendanceHistory: [{ attendancePct: 82 }],
      currentCgpa: 0,
      cgpaMissing: true,
      backlogCount: 0,
      backlogMissing: true,
      tt1Pct: null,
      tt2Pct: null,
      quizPct: null,
      assignmentPct: null,
      seePct: null,
      weakCoCount: 0,
      weakQuestionCount: 0,
      interventionResponseScore: null,
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      semesterNumber: 1,
      sectionRiskRate: 0.12,
      semesterProgress: 0,
    })
    const sparseScored = scoreObservableRiskWithModel({
      attendancePct: 82,
      currentCgpa: 0,
      cgpaMissing: true,
      backlogCount: 0,
      backlogMissing: true,
      tt1Pct: null,
      tt2Pct: null,
      quizPct: null,
      assignmentPct: null,
      seePct: null,
      weakCoCount: 0,
      attendanceHistoryRiskCount: 0,
      questionWeaknessCount: 0,
      interventionResponseScore: null,
      policy: DEFAULT_POLICY,
      featurePayload: sparseSemesterOne,
      sourceRefs: buildSourceRefs({
        runId: 'sim-policy-floor',
        studentId: 'student-sem1-sparse',
        semesterNumber: 1,
        stageKey: 'pre-tt1',
        sectionCode: 'A',
        courseCode: 'AMC101',
        coEvidenceMode: 'not-yet-observed',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    expect(sparseScored.riskBand).toBe('Low')
    expect(sparseScored.riskProb).toBeLessThan(PRODUCTION_RISK_THRESHOLDS.medium)
    expect(sparseScored.headDisplay.overallCourseRisk.displayProbabilityAllowed).toBe(false)
    expect(sparseScored.headDisplay.overallCourseRisk.supportWarning).toContain('not yet sufficient')
    expect(sparseScored.observableDrivers).toHaveLength(0)
  })

  it('suppresses probability display for fallback-simulated rows with partial feature completeness', () => {
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
    const rows = [
      ...buildRowsForRun(manifestEntries[0]!.seed, 20),
      ...buildRowsForRun(manifestEntries[1]!.seed, 20, 1),
      ...buildRowsForRun(manifestEntries[2]!.seed, 20, 2),
    ]
    const bundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', { runMetadataById })
    expect(bundle).not.toBeNull()

    const probePayload = rows[0]!.featurePayload
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
      sourceRefs: {
        ...buildSourceRefs({
          runId: 'sim-fallback-partial',
          studentId: 'student-fallback',
          semesterNumber: 6,
          stageKey: 'post-see',
          sectionCode: 'A',
          courseCode: 'AMC301',
          coEvidenceMode: 'fallback-simulated',
        }),
        featureCompleteness: {
          graphAvailable: false,
          historyAvailable: false,
          complete: false,
          missing: ['graph', 'history'],
          fallbackMode: 'policy-only',
          confidenceClass: 'low',
        },
        featureConfidenceClass: 'low',
      },
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })

    expect(scored.queuePriorityScore).toBe(0)
    expect(scored.queuePrioritySource).toBe('overall-course-risk-head')
    expect(scored.rankingAllowed).toBe(false)
    for (const display of Object.values(scored.headDisplay)) {
      expect(display.displayProbabilityAllowed).toBe(false)
      expect(display.supportWarning).toContain('Fallback-simulated evidence is low confidence')
    }
  })

  it('keeps zero-valued assessment evidence distinct from missingness in the feature payload', () => {
    const payload = buildObservableFeaturePayload({
      attendancePct: 78,
      attendanceHistory: [{ attendancePct: 80 }, { attendancePct: 78 }],
      currentCgpa: 0,
      cgpaMissing: true,
      backlogCount: 0,
      backlogMissing: true,
      tt1Pct: 0,
      tt2Pct: 50,
      seePct: null,
      quizPct: 0,
      assignmentPct: 80,
      weakCoCount: 1,
      weakQuestionCount: 2,
      interventionResponseScore: null,
      prerequisiteAveragePct: 62,
      prerequisiteFailureCount: 1,
      prerequisiteCourseCodes: ['AMC101', 'AMC102'],
      semesterProgress: 0.55,
      semesterNumber: 1, sectionRiskRate: 0.3,
    })

    expect(payload.tt1Pct).toBe(0)
    expect(payload.quizPct).toBe(0)
    expect(payload.seePct).toBeNull()
    expect(payload.courseworkToTtGap).toBe(15)
    expect(payload.cgpaMissing).toBe(true)
    expect(payload.backlogMissing).toBe(true)
  })

  it('does not mark future assessments as missing before the stage where they are expected', () => {
    const payload = buildObservableFeaturePayload({
      attendancePct: 84,
      attendanceHistory: [{ attendancePct: 85 }, { attendancePct: 84 }],
      currentCgpa: 8.1,
      backlogCount: 0,
      tt1Pct: 64,
      tt2Pct: null,
      seePct: null,
      quizPct: null,
      assignmentPct: null,
      weakCoCount: 0,
      weakQuestionCount: 1,
      interventionResponseScore: null,
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      semesterProgress: 0.25,
      semesterNumber: 1, sectionRiskRate: 0.16,
    })
    const indexOf = (feature: typeof OBSERVABLE_FEATURE_KEYS[number]) => OBSERVABLE_FEATURE_KEYS.indexOf(feature)
    const postTt1Vector = featureVectorArrayFromPayload(payload, buildSourceRefs({
      runId: 'sim-stage-missingness',
      studentId: 'student-stage-missingness',
      semesterNumber: 1,
      stageKey: 'post-tt1',
      sectionCode: 'A',
      courseCode: 'AMC101',
      coEvidenceMode: 'rubric-derived',
    }))
    const postSeeVector = featureVectorArrayFromPayload(payload, buildSourceRefs({
      runId: 'sim-stage-missingness',
      studentId: 'student-stage-missingness',
      semesterNumber: 1,
      stageKey: 'post-see',
      sectionCode: 'A',
      courseCode: 'AMC101',
      coEvidenceMode: 'rubric-derived',
    }))

    expect(postTt1Vector[indexOf('tt1MissingScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('tt2MissingScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('seeMissingScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('quizMissingScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('assignmentMissingScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('tt1RiskScaled')]).toBeCloseTo(0.36)
    expect(postTt1Vector[indexOf('tt2RiskScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('seeRiskScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('quizRiskScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('assignmentRiskScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('prerequisiteAverageRiskScaled')]).toBe(0)
    expect(postTt1Vector[indexOf('interventionResidualRiskScaled')]).toBe(0)
    expect(postSeeVector[indexOf('tt2MissingScaled')]).toBe(1)
    expect(postSeeVector[indexOf('seeMissingScaled')]).toBe(1)
    expect(postSeeVector[indexOf('quizMissingScaled')]).toBe(1)
    expect(postSeeVector[indexOf('assignmentMissingScaled')]).toBe(1)
    expect(postSeeVector[indexOf('tt2RiskScaled')]).toBe(0.5)
    expect(postSeeVector[indexOf('seeRiskScaled')]).toBe(0.5)
    expect(postSeeVector[indexOf('quizRiskScaled')]).toBe(0.5)
    expect(postSeeVector[indexOf('assignmentRiskScaled')]).toBe(0.5)
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
      semesterNumber: 1, sectionRiskRate: 0.18,
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
      semesterNumber: 1, sectionRiskRate: 0.62,
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
        stageKey: 'post-see',
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
        stageKey: 'post-see',
        sectionCode: 'A',
        courseCode: 'AMC302',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })

    expect(scoredPressured.headProbabilities.downstreamCarryoverRisk).toBeGreaterThan(scoredCautious.headProbabilities.downstreamCarryoverRisk)
  })

  it('adapts probabilities across evidence stages for the same observable payload', () => {
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

    const payload = buildFeaturePayload(4, true)
    const preTt1 = scoreObservableRiskWithModel({
      attendancePct: payload.attendancePct,
      currentCgpa: payload.currentCgpa,
      backlogCount: payload.backlogCount,
      tt1Pct: payload.tt1Pct,
      tt2Pct: payload.tt2Pct,
      quizPct: payload.quizPct,
      assignmentPct: payload.assignmentPct,
      seePct: payload.seePct,
      weakCoCount: payload.weakCoCount,
      attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
      questionWeaknessCount: payload.weakQuestionCount,
      interventionResponseScore: payload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: payload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-stage',
        studentId: 'student-stage',
        semesterNumber: 5,
        stageKey: 'pre-tt1',
        sectionCode: 'A',
        courseCode: 'AMC301',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    const postAssignments = scoreObservableRiskWithModel({
      attendancePct: payload.attendancePct,
      currentCgpa: payload.currentCgpa,
      backlogCount: payload.backlogCount,
      tt1Pct: payload.tt1Pct,
      tt2Pct: payload.tt2Pct,
      quizPct: payload.quizPct,
      assignmentPct: payload.assignmentPct,
      seePct: payload.seePct,
      weakCoCount: payload.weakCoCount,
      attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
      questionWeaknessCount: payload.weakQuestionCount,
      interventionResponseScore: payload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: payload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-stage',
        studentId: 'student-stage',
        semesterNumber: 5,
        stageKey: 'post-assignments',
        sectionCode: 'A',
        courseCode: 'AMC301',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })

    expect(preTt1.headProbabilities.overallCourseRisk).not.toBe(postAssignments.headProbabilities.overallCourseRisk)
  })

  it('keeps stage-only scoring invariant under baseline v5-like training config', () => {
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
    const bundle = trainProofRiskModel(rows, '2026-03-23T00:00:00.000Z', {
      runMetadataById,
      trainingConfig: BASELINE_V5_LIKE_PROOF_RISK_TRAINING_CONFIG,
    })
    expect(bundle).not.toBeNull()

    const payload = buildFeaturePayload(4, true)
    const preTt1 = scoreObservableRiskWithModel({
      attendancePct: payload.attendancePct,
      currentCgpa: payload.currentCgpa,
      backlogCount: payload.backlogCount,
      tt1Pct: payload.tt1Pct,
      tt2Pct: payload.tt2Pct,
      quizPct: payload.quizPct,
      assignmentPct: payload.assignmentPct,
      seePct: payload.seePct,
      weakCoCount: payload.weakCoCount,
      attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
      questionWeaknessCount: payload.weakQuestionCount,
      interventionResponseScore: payload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: payload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-stage',
        studentId: 'student-stage',
        semesterNumber: 5,
        stageKey: 'pre-tt1',
        sectionCode: 'A',
        courseCode: 'AMC301',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })
    const postAssignments = scoreObservableRiskWithModel({
      attendancePct: payload.attendancePct,
      currentCgpa: payload.currentCgpa,
      backlogCount: payload.backlogCount,
      tt1Pct: payload.tt1Pct,
      tt2Pct: payload.tt2Pct,
      quizPct: payload.quizPct,
      assignmentPct: payload.assignmentPct,
      seePct: payload.seePct,
      weakCoCount: payload.weakCoCount,
      attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
      questionWeaknessCount: payload.weakQuestionCount,
      interventionResponseScore: payload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload: payload,
      sourceRefs: buildSourceRefs({
        runId: 'sim-stage',
        studentId: 'student-stage',
        semesterNumber: 5,
        stageKey: 'post-assignments',
        sectionCode: 'A',
        courseCode: 'AMC301',
        coEvidenceMode: 'synthetic-blueprint',
      }),
      productionModel: bundle!.production,
      correlations: bundle!.correlations,
    })

    expect(preTt1.headProbabilities.overallCourseRisk).toBe(postAssignments.headProbabilities.overallCourseRisk)
  })
})
