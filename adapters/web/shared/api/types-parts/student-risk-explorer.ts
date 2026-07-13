// Feature completeness/provenance and the student risk-explorer contract.
// Extracted verbatim from '../types'.

import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './policy'
import type { ApiRiskCalibrationMethod, ApiRiskHeadDisplay } from './risk'
import type { ApiStudentAgentCard } from './student-agent'

export type ApiFeatureCompleteness = {
  graphAvailable: boolean
  historyAvailable: boolean
  complete: boolean
  missing: Array<'graph' | 'history'>
  fallbackMode: 'graph-aware' | 'policy-only'
  confidenceClass: 'high' | 'medium' | 'low'
}

export type ApiFeatureProvenance = {
  curriculumImportVersionId: string | null
  curriculumFeatureProfileFingerprint: string | null
  graphNodeCount: number
  graphEdgeCount: number
  historyCourseCount: number
}

export type ApiStudentRiskExplorer = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  disclaimer: string
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  runContext: ApiStudentAgentCard['runContext']
  checkpointContext: ApiStudentAgentCard['checkpointContext']
  student: ApiStudentAgentCard['student']
  riskCompleteness?: ApiFeatureCompleteness | null
  featureCompleteness: ApiFeatureCompleteness
  featureConfidenceClass: 'high' | 'medium' | 'low'
  featureProvenance: ApiFeatureProvenance
  modelProvenance: {
    modelVersion: string | null
    calibrationVersion: string | null
    featureSchemaVersion: string | null
    evidenceWindow: string | null
    simulationCalibrated: true
    calibrationMethod?: ApiRiskCalibrationMethod | null
    displayProbabilityAllowed?: boolean | null
    supportWarning?: string | null
    headDisplay?: Record<string, ApiRiskHeadDisplay | undefined> | null
    coEvidenceMode?: string | null
    featureConfidenceClass?: 'high' | 'medium' | 'low' | null
  }
  trainedRiskHeads: {
    currentRiskBand: string | null
    currentRiskProbScaled: number | null
    attendanceRiskProbScaled: number | null
    ceRiskProbScaled: number | null
    seeRiskProbScaled: number | null
    overallCourseRiskProbScaled: number | null
    downstreamCarryoverRiskProbScaled: number | null
  }
  trainedRiskHeadDisplays?: Record<string, ApiRiskHeadDisplay | undefined> | null
  xaiRiskReduction?: {
    explanationMode: 'same-checkpoint-no-action-replay'
    disclaimer: string
    driverSource: string | null
    scorerFamily: string | null
    summary: {
      stageKey: string | null
      label: string
      baselineRiskProbScaled: number | null
      simulatedRiskProbScaled: number | null
      deltaProbScaled: number | null
      riskReducedByProbScaled: number | null
      activeInterventions: string[]
    } | null
    deltaTimeline: Array<{
      stageKey: string
      label: string
      baselineRiskProbScaled: number
      simulatedRiskProbScaled: number
      deltaProbScaled: number
      riskReducedByProbScaled: number
      activeInterventions: string[]
    }>
    componentImpacts: Array<{
      componentKey: 'attendance' | 'tt1' | 'tt2' | 'assignment' | 'see' | 'overall'
      componentLabel: string
      baselineScore: number | null
      simulatedScore: number | null
      lift: number | null
      direction: 'score-lift' | 'risk-reduction'
    }>
    topDriverEvidence: Array<{ label: string; impact: number; feature: string }>
  } | null
  policyComparison?: {
    policyPhenotype?: string | null
    recommendedAction: string | null
    simulatedActionTaken: string | null
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    policyRationale: string
    actionCatalog?: {
      version: string
      stageKey: string
      stageActions: string[]
      phenotype: string
      phenotypeActions: string[]
      allCandidatesStageValid: boolean
      recommendedActionStageValid: boolean
    } | null
    candidates: Array<{
      action: string
      utility: number
      nextCheckpointBenefitScaled: number
      stableRecoveryScore: number
      semesterCloseBenefitScaled: number
      relapsePenalty: number
      capacityCost: number
      rationale: string
    }>
  } | null
  derivedScenarioHeads: {
    semesterSgpaDropRiskProbScaled: number | null
    cumulativeCgpaDropRiskProbScaled: number | null
    electiveMismatchRiskProbScaled: number | null
    scale: 'advisory-index-0-100'
    displayProbabilityAllowed: false
    supportWarning: string
    note: string
  }
  currentEvidence: ApiStudentAgentCard['overview']['currentEvidence']
  currentStatus: ApiStudentAgentCard['overview']['currentStatus']
  topDrivers: Array<{ label: string; impact: number; feature: string }>
  crossCourseDrivers: string[]
  prerequisiteMap: {
    prerequisiteCourseCodes: string[]
    weakPrerequisiteCourseCodes: string[]
    prerequisitePressureScaled: number | null
    prerequisiteAveragePct: number | null
    prerequisiteFailureCount: number | null
    completeness?: ApiFeatureCompleteness | null
  }
  weakCourseOutcomes: ApiStudentAgentCard['topicAndCo']['weakCourseOutcomes']
  questionPatterns: ApiStudentAgentCard['topicAndCo']['questionPatterns']
  semesterSummaries: ApiStudentAgentCard['overview']['semesterSummaries']
  cgpaTrace: {
    formulaSource: string
    ceWeights: {
      tt1: number
      tt2: number
      quiz: number
      assignment: number
    }
    passRules: {
      ceMinimum: number
      seeMinimum: number
      overallMinimum: number
    }
    terms: Array<{
      semesterNumber: number
      storedSgpa: number | null
      recomputedSgpa: number
      storedCgpaAfterSemester: number | null
      recomputedCgpaAfterSemester: number
      registeredCredits: number
      earnedCredits: number
      backlogCount: number
      subjects: Array<{
        offeringId: string | null
        courseCode: string
        title: string
        credits: number
        attendancePct: number | null
        tt1Pct: number | null
        tt2Pct: number | null
        quizPct: number | null
        assignmentPct: number | null
        cePct: number | null
        ceMark: number | null
        seePct: number | null
        seeMark: number | null
        totalMark: number | null
        storedScore: number | null
        gradeLabel: string
        gradePoint: number
        result: string
        creditContribution: number
      }>
    }>
  }
  assessmentComponents: ApiStudentAgentCard['assessmentEvidence']['components']
  counterfactual: ApiStudentAgentCard['counterfactual']
  electiveFit: ApiStudentAgentCard['summaryRail']['electiveFit']
}
