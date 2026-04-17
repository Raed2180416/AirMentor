import { describe, expect, it } from 'vitest'
import {
  buildCoEvidenceDiagnosticsFromRows,
  buildPolicyDiagnostics,
  classifyPolicyPhenotype,
  mergeCoEvidenceDiagnostics,
  mergePolicyDiagnostics,
} from '../src/lib/msruas-proof-control-plane.js'
import {
  buildActionPolicyComparison,
  policyActionCatalogForStage,
} from '../src/lib/proof-control-plane-playback-service.js'

function buildEvidence(overrides: Partial<Parameters<typeof classifyPolicyPhenotype>[0]['evidence']> = {}) {
  return {
    attendancePct: 82,
    tt1Pct: 72,
    tt2Pct: 70,
    quizPct: 76,
    assignmentPct: 78,
    seePct: 68,
    weakCoCount: 0,
    weakQuestionCount: 1,
    attentionAreas: [],
    attendanceHistoryRiskCount: 0,
    currentCgpa: 7.6,
    backlogCount: 0,
    interventionResponseScore: 0.12,
    evidenceWindow: '6-post-tt2',
    weakCourseOutcomes: [],
    questionPatterns: {
      weakQuestionCount: 0,
      carelessErrorCount: 0,
      transferGapCount: 0,
      commonWeakTopics: [],
      commonWeakCourseOutcomes: [],
    },
    ...overrides,
  }
}

function buildPrerequisiteSummary(overrides: Partial<Parameters<typeof classifyPolicyPhenotype>[0]['prerequisiteSummary']> = {}) {
  return {
    prerequisiteAveragePct: 74,
    prerequisiteFailureCount: 0,
    prerequisiteWeakCourseCodes: [],
    downstreamDependencyLoad: 0,
    weakPrerequisiteChainCount: 0,
    repeatedWeakPrerequisiteFamilyCount: 0,
    ...overrides,
  }
}

describe('policy phenotype classification', () => {
  it('uses the deterministic precedence order for all six phenotypes', () => {
    expect(classifyPolicyPhenotype({
      stageKey: 'post-see',
      riskBand: 'High',
      evidence: buildEvidence({ weakCoCount: 3, weakQuestionCount: 5, backlogCount: 2 }),
      prerequisiteSummary: buildPrerequisiteSummary({ prerequisiteFailureCount: 2, prerequisiteWeakCourseCodes: ['AMC201'] }),
    }).policyPhenotype).toBe('late-semester-acute')

    expect(classifyPolicyPhenotype({
      stageKey: 'post-tt1',
      riskBand: 'High',
      evidence: buildEvidence({ interventionResponseScore: -0.12, weakCoCount: 3 }),
      prerequisiteSummary: buildPrerequisiteSummary(),
    }).policyPhenotype).toBe('persistent-nonresponse')

    expect(classifyPolicyPhenotype({
      stageKey: 'post-tt1',
      riskBand: 'High',
      evidence: buildEvidence({ backlogCount: 2, weakCoCount: 2 }),
      prerequisiteSummary: buildPrerequisiteSummary({ prerequisiteFailureCount: 1, prerequisiteWeakCourseCodes: ['AMC201'], downstreamDependencyLoad: 0.4 }),
    }).policyPhenotype).toBe('prerequisite-dominant')

    expect(classifyPolicyPhenotype({
      stageKey: 'post-tt1',
      riskBand: 'High',
      evidence: buildEvidence({ weakCoCount: 2, weakQuestionCount: 4, tt2Pct: 46, seePct: 44, attendancePct: 84 }),
      prerequisiteSummary: buildPrerequisiteSummary(),
    }).policyPhenotype).toBe('academic-weakness')

    expect(classifyPolicyPhenotype({
      stageKey: 'post-tt1',
      riskBand: 'Medium',
      evidence: buildEvidence({ attendancePct: 68, attendanceHistoryRiskCount: 2 }),
      prerequisiteSummary: buildPrerequisiteSummary(),
    }).policyPhenotype).toBe('attendance-dominant')

    expect(classifyPolicyPhenotype({
      stageKey: 'post-tt1',
      riskBand: 'Medium',
      evidence: buildEvidence(),
      prerequisiteSummary: buildPrerequisiteSummary(),
    }).policyPhenotype).toBe('diffuse-amber')
  })

  it('aggregates policy diagnostics corpus-wide without collapsing identical student keys across runs', () => {
    const checkpointRows = [
      { simulationStageCheckpointId: 'run-a-post-tt1', stageOrder: 2 },
      { simulationStageCheckpointId: 'run-a-post-tt2', stageOrder: 4 },
      { simulationStageCheckpointId: 'run-b-post-tt1', stageOrder: 2 },
      { simulationStageCheckpointId: 'run-b-post-tt2', stageOrder: 4 },
    ]
    const studentRows = [
      {
        simulationRunId: 'run-a',
        simulationStageCheckpointId: 'run-a-post-tt1',
        studentId: 'student-1',
        offeringId: 'offering-1',
        semesterNumber: 3,
        courseCode: 'AMC301',
        riskProbScaled: 74,
        riskBand: 'High',
        noActionRiskProbScaled: 84,
        simulatedActionTaken: 'targeted-tutoring',
        projectionJson: JSON.stringify({
          actionPath: {
            simulatedActionTaken: 'targeted-tutoring',
            policyComparison: {
              recommendedAction: 'targeted-tutoring',
              policyPhenotype: 'academic-weakness',
              candidates: [
                { action: 'targeted-tutoring', utility: 5 },
                { action: 'structured-study-plan', utility: 3 },
              ],
            },
          },
          counterfactualPolicyDiagnostics: {
            recommendedAction: 'targeted-tutoring',
            policyPhenotype: 'academic-weakness',
            counterfactualLiftScaled: 10,
          },
        }),
      },
      {
        simulationRunId: 'run-a',
        simulationStageCheckpointId: 'run-a-post-tt2',
        studentId: 'student-1',
        offeringId: 'offering-1',
        semesterNumber: 3,
        courseCode: 'AMC301',
        riskProbScaled: 58,
        riskBand: 'Medium',
        noActionRiskProbScaled: 70,
        simulatedActionTaken: null,
        projectionJson: JSON.stringify({}),
      },
      {
        simulationRunId: 'run-b',
        simulationStageCheckpointId: 'run-b-post-tt1',
        studentId: 'student-1',
        offeringId: 'offering-1',
        semesterNumber: 3,
        courseCode: 'AMC301',
        riskProbScaled: 69,
        riskBand: 'High',
        noActionRiskProbScaled: 74,
        simulatedActionTaken: 'structured-study-plan',
        projectionJson: JSON.stringify({
          actionPath: {
            simulatedActionTaken: 'structured-study-plan',
            policyComparison: {
              recommendedAction: 'structured-study-plan',
              policyPhenotype: 'academic-weakness',
              candidates: [
                { action: 'structured-study-plan', utility: 4 },
                { action: 'targeted-tutoring', utility: 2 },
              ],
            },
          },
          counterfactualPolicyDiagnostics: {
            recommendedAction: 'structured-study-plan',
            policyPhenotype: 'academic-weakness',
            counterfactualLiftScaled: 5,
          },
        }),
      },
      {
        simulationRunId: 'run-b',
        simulationStageCheckpointId: 'run-b-post-tt2',
        studentId: 'student-1',
        offeringId: 'offering-1',
        semesterNumber: 3,
        courseCode: 'AMC301',
        riskProbScaled: 62,
        riskBand: 'Medium',
        noActionRiskProbScaled: 71,
        simulatedActionTaken: null,
        projectionJson: JSON.stringify({}),
      },
    ]

    const combined = buildPolicyDiagnostics({ checkpointRows, studentRows })
    expect(combined).not.toBeNull()
    expect(combined?.recommendedActionCount).toBe(2)
    expect(combined?.simulatedActionCount).toBe(2)
    expect(combined?.counterfactualPolicyDiagnostics.byPhenotype['academic-weakness']?.support).toBe(2)
    expect(combined?.counterfactualPolicyDiagnostics.byPhenotype['academic-weakness']?.byAction['targeted-tutoring']?.support).toBe(1)
    expect(combined?.counterfactualPolicyDiagnostics.byPhenotype['academic-weakness']?.byAction['structured-study-plan']?.support).toBe(1)
    expect(combined?.acceptanceGates.targetedTutoringBeatsStructuredStudyPlanAcademicSlice).toBe(true)

    const merged = mergePolicyDiagnostics([
      buildPolicyDiagnostics({
        checkpointRows: checkpointRows.filter(row => row.simulationStageCheckpointId.startsWith('run-a')),
        studentRows: studentRows.filter(row => row.simulationRunId === 'run-a'),
      }),
      buildPolicyDiagnostics({
        checkpointRows: checkpointRows.filter(row => row.simulationStageCheckpointId.startsWith('run-b')),
        studentRows: studentRows.filter(row => row.simulationRunId === 'run-b'),
      }),
    ])

    expect(merged).not.toBeNull()
    expect(merged?.recommendedActionCount).toBe(2)
    expect(merged?.simulatedActionCount).toBe(2)
    expect(merged?.counterfactualPolicyDiagnostics.byPhenotype['academic-weakness']?.support).toBe(2)
    expect(merged?.counterfactualPolicyDiagnostics.targetedTutoringVsStructuredStudyPlanAcademicSlice).toMatchObject({
      targetedTutoringSupport: 1,
      structuredStudyPlanSupport: 1,
      targetedTutoringAverageCounterfactualLiftScaled: 10,
      structuredStudyPlanAverageCounterfactualLiftScaled: 5,
    })
  })

  it('merges CO evidence diagnostics across governed runs', () => {
    const merged = mergeCoEvidenceDiagnostics([
      buildCoEvidenceDiagnosticsFromRows([
        { semesterNumber: 1, courseFamily: 'theory-heavy', coEvidenceMode: 'synthetic-blueprint' },
        { semesterNumber: 6, courseFamily: 'lab-like', coEvidenceMode: 'rubric-derived' },
      ]),
      buildCoEvidenceDiagnosticsFromRows([
        { semesterNumber: 6, courseFamily: 'mixed', coEvidenceMode: 'offering-blueprint' },
      ]),
    ])

    expect(merged.totalRows).toBe(3)
    expect(merged.fallbackCount).toBe(0)
    expect(merged.byMode).toMatchObject({
      'synthetic-blueprint': 1,
      'rubric-derived': 1,
      'offering-blueprint': 1,
    })
    expect(merged.bySemester.sem6).toMatchObject({
      'rubric-derived': 1,
      'offering-blueprint': 1,
    })
    expect(merged.acceptanceGates).toEqual({
      theoryCoursesDefaultToBlueprintEvidence: true,
      fallbackOnlyInExplicitCases: true,
    })
  })

  it('keeps policy candidates aligned with the canonical action catalog for each stage', () => {
    const stageKeys = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const

    for (const stageKey of stageKeys) {
      const comparison = buildActionPolicyComparison({
        stageKey,
        evidence: buildEvidence({
          attendancePct: 69,
          attendanceHistoryRiskCount: 2,
          weakCoCount: 3,
          weakQuestionCount: 5,
          backlogCount: 2,
          interventionResponseScore: -0.08,
        }),
        riskBand: 'High',
        recommendedAction: 'Immediate mentor follow-up and reassessment before the next evaluation checkpoint.',
        prerequisiteSummary: buildPrerequisiteSummary({
          prerequisiteAveragePct: 46,
          prerequisiteFailureCount: 2,
          prerequisiteWeakCourseCodes: ['AMC201', 'AMC202'],
          downstreamDependencyLoad: 0.7,
          weakPrerequisiteChainCount: 3,
          repeatedWeakPrerequisiteFamilyCount: 1,
        }),
      })

      const expectedCatalog = policyActionCatalogForStage(stageKey, comparison.policyPhenotype)
      const candidateActions = comparison.candidates.map(candidate => candidate.action).sort()
      const expectedActions = [...expectedCatalog.stageActions].sort()

      expect(comparison.actionCatalog.version).toBe('policy-action-catalog-v1')
      expect(comparison.actionCatalog.stageKey).toBe(stageKey)
      expect(comparison.actionCatalog.phenotype).toBe(comparison.policyPhenotype)
      expect(comparison.actionCatalog.stageActions).toEqual(expectedCatalog.stageActions)
      expect(comparison.actionCatalog.phenotypeActions).toEqual(expectedCatalog.phenotypeActions)
      expect(comparison.actionCatalog.allCandidatesStageValid).toBe(true)
      expect(comparison.actionCatalog.recommendedActionStageValid).toBe(true)
      expect(candidateActions).toEqual(expectedActions)
      if (comparison.recommendedAction) {
        expect(expectedCatalog.stageActions.includes(comparison.recommendedAction)).toBe(true)
      }
    }
  })
})
