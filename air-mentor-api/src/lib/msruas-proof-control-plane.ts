import { and, asc, count, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicRuntimeState,
  alertDecisions,
  alertOutcomes,
  batches,
  bridgeModules,
  courseTopicPartitions,
  courses,
  curriculumCourses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  curriculumValidationResults,
  electiveBaskets,
  electiveOptions,
  electiveRecommendations,
  facultyOfferingOwnerships,
  officialCodeCrosswalks,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  riskEvidenceSnapshots,
  riskModelArtifacts,
  sectionOfferings,
  simulationLifecycleAudits,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  simulationRuns,
  semesterTransitionLogs,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentBehaviorProfiles,
  studentCoStates,
  studentInterventionResponseStates,
  studentLatentStates,
  studentObservedSemesterStates,
  studentInterventions,
  studentQuestionResults,
  studentTopicStates,
  simulationQuestionTemplates,
  teacherAllocations,
  transcriptSubjectResults,
  transcriptTermResults,
  worldContextSnapshots,
} from '../db/schema.js'
import {
  buildFacultyTimetableTemplates as sharedBuildFacultyTimetableTemplates,
  weeklyContactHoursForCourse as sharedWeeklyContactHoursForCourse,
} from './academic-provisioning.js'
import { createId } from './ids.js'
import { parseJson } from './json.js'
import { parseObservedStateRow } from './proof-observed-state.js'
import {
  buildProofBatchDashboard as buildProofBatchDashboardService,
  getProofRunCheckpointDetail as getProofRunCheckpointDetailService,
  getProofRunCheckpointStudentDetail as getProofRunCheckpointStudentDetailService,
  listProofRunCheckpoints as listProofRunCheckpointsService,
  type ProofControlPlaneBatchServiceDeps,
} from './proof-control-plane-batch-service.js'
import {
  activateProofOperationalSemester as activateProofOperationalSemesterService,
  type ProofControlPlaneActivationServiceDeps,
} from './proof-control-plane-activation-service.js'
import {
  parseProofCheckpointSummary,
  queueProjectionAssignedFacultyId,
  queueStatusPriority,
  stageSummaryPayload,
  withProofPlaybackGate,
} from './proof-control-plane-checkpoint-service.js'
import {
  buildHodProofAnalytics as buildHodProofAnalyticsService,
  type ProofControlPlaneHodServiceDeps,
} from './proof-control-plane-hod-service.js'
import {
  buildFacultyProofView as buildFacultyProofViewService,
  buildStudentAgentCard as buildStudentAgentCardService,
  buildStudentRiskExplorer as buildStudentRiskExplorerService,
  getProofStudentEvidenceTimeline as getProofStudentEvidenceTimelineService,
  listStudentAgentTimeline as listStudentAgentTimelineService,
  sendStudentAgentMessage as sendStudentAgentMessageService,
  startStudentAgentSession as startStudentAgentSessionService,
  type ProofControlPlaneTailServiceDeps,
} from './proof-control-plane-tail-service.js'
import {
  buildPolicyDiagnostics,
  mergePolicyDiagnostics,
} from './proof-control-plane-policy-service.js'
import {
  recomputeObservedOnlyRisk as recomputeObservedOnlyRiskService,
  restoreProofSimulationSnapshot as restoreProofSimulationSnapshotService,
  type ProofControlPlaneRuntimeServiceDeps,
} from './proof-control-plane-runtime-service.js'
import {
  buildActionPolicyComparison,
  buildDeterministicId,
  buildNoActionSnapshot,
  buildStageEvidenceSnapshot,
  ceMinimumPctForPolicy,
  ceShortfallLabelFromPct,
  classifyPolicyPhenotype,
  stageCourseworkEvidenceForStage,
  summarizeQuestionPatterns,
  toInterventionResponse,
} from './proof-control-plane-playback-service.js'
import {
  startLiveBatchProofSimulationRun as startLiveBatchProofSimulationRunService,
  type ProofControlPlaneLiveRunServiceDeps,
} from './proof-control-plane-live-run-service.js'
import {
  preparePlaybackRebuildContext as preparePlaybackRebuildContextService,
  type ProofControlPlaneRebuildContextServiceDeps,
} from './proof-control-plane-rebuild-context-service.js'
import {
  buildPlaybackStageSummaries as buildPlaybackStageSummariesService,
  type ProofControlPlaneStageSummaryServiceDeps,
} from './proof-control-plane-stage-summary-service.js'
import { buildPlaybackGovernanceArtifacts } from './proof-control-plane-playback-governance-service.js'
import { resetPlaybackStageArtifacts } from './proof-control-plane-playback-reset-service.js'
import {
  buildSectionRiskRateByStage as buildSectionRiskRateByStageService,
  type ProofControlPlaneSectionRiskServiceDeps,
} from './proof-control-plane-section-risk-service.js'
import {
  finalizeSeededProofRun as finalizeSeededProofRunService,
  type ProofControlPlaneSeededRunServiceDeps,
} from './proof-control-plane-seeded-run-service.js'
import {
  buildSeededScaffolding as buildSeededScaffoldingService,
  type ProofControlPlaneSeededScaffoldingServiceDeps,
} from './proof-control-plane-seeded-scaffolding-service.js'
import {
  buildSeededHistoricalSemesterRows,
  buildSeededSemesterSixRows,
  type ProofControlPlaneSeededSemesterServiceDeps,
} from './proof-control-plane-seeded-semester-service.js'
import {
  prepareSeededProofRunBootstrap as prepareSeededProofRunBootstrapService,
  type ProofControlPlaneSeededBootstrapServiceDeps,
} from './proof-control-plane-seeded-bootstrap-service.js'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  compileMsruasCurriculumWorkbook,
  MSRUAS_PROOF_VALIDATOR_VERSION,
  validateCompiledCurriculum,
} from './msruas-curriculum-compiler.js'
import { inferObservableRisk } from './inference-engine.js'
import { buildMonitoringDecision } from './monitoring-engine.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyStageKey } from './stage-policy.js'
import {
  PROOF_CORPUS_MANIFEST,
  scenarioFamilyForSeed,
  type ModelBackedRiskOutput,
  type ObservableSourceRefs,
  type ProofRunModelMetadata,
  type RiskHeadKey,
  createProofRiskModelTrainingBuilder,
  summarizeProofRiskModelEvaluation,
  type CorrelationArtifact,
  type ProductionRiskModelArtifact,
} from './proof-risk-model.js'
import {
  type GraphAwareFeatureCompleteness,
  type GraphAwareFeatureProvenance,
  type GraphAwarePrerequisiteSummaryCompleteness,
} from './graph-summary.js'
import type {
  CountProvenanceValue,
  CountSourceValue,
  ResolvedFromValue,
  ScopeDescriptorValue,
  ScopeModeValue,
} from './proof-provenance.js'
import {
  calculateCgpa,
  calculateSgpa,
  evaluateCourseStatus,
  type MsruasDeterministicPolicy,
} from './msruas-rules.js'
import {
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_BRANCH_ID,
  MSRUAS_PROOF_DEPARTMENT_ID,
  PROOF_FACULTY,
  PROOF_TERM_DEFS,
} from './msruas-proof-sandbox.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'

const INFERENCE_MODEL_VERSION = 'observable-inference-v2'
const MONITORING_POLICY_VERSION = 'monitoring-policy-v2'
const WORLD_ENGINE_VERSION = 'world-engine-v2'
const RISK_ARTIFACT_REBUILD_PAGE_SIZE = 10_000
const PLAYBACK_STAGE_DEFS = DEFAULT_STAGE_POLICY.stages.map(stage => ({
  key: stage.key,
  label: stage.label,
  description: stage.description,
  order: stage.order,
  semesterDayOffset: stage.semesterDayOffset,
}))

export type PlaybackStageKey = StagePolicyStageKey

export type StudentAgentPanelLabel = 'Observed' | 'Policy Derived' | 'Simulation Internal' | 'Human Action Log'

export type StudentAgentCitation = {
  citationId: string
  label: string
  panelLabel: StudentAgentPanelLabel
  summary: string
}

export type StudentAgentMessage = {
  studentAgentMessageId: string
  actorType: string
  messageType: string
  body: string
  citations: StudentAgentCitation[]
  guardrailCode: string | null
  createdAt: string
  updatedAt: string
}

export type StudentAgentTimelineItem = {
  timelineItemId: string
  panelLabel: StudentAgentPanelLabel
  kind: 'semester-summary' | 'intervention' | 'reassessment' | 'resolution' | 'elective-fit'
  title: string
  detail: string
  occurredAt: string
  semesterNumber: number | null
  citations: StudentAgentCitation[]
}

export type ObservableSourceRefsWithFeatureMetadata = ObservableSourceRefs & {
  featureCompleteness: GraphAwareFeatureCompleteness
  featureProvenance: GraphAwareFeatureProvenance
}

export type ProofScopeDescriptor = ScopeDescriptorValue
export type ProofResolvedFrom = ResolvedFromValue
export type ProofScopeMode = ScopeModeValue
export type ProofCountSource = CountSourceValue
export type ProofCountProvenance = CountProvenanceValue

export type StudentAgentCardPayload = {
  studentAgentCardId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  cardVersion: number
  sourceSnapshotHash: string
  disclaimer: string
  scopeDescriptor: ProofScopeDescriptor
  resolvedFrom: ProofResolvedFrom
  scopeMode: ProofScopeMode
  countSource: ProofCountSource
  activeOperationalSemester: number | null
  runContext: {
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
    batchLabel: string | null
    branchName: string | null
  }
  checkpointContext: {
    simulationStageCheckpointId: string
    semesterNumber: number
    stageKey: string
    stageLabel: string
    stageDescription: string
    stageOrder: number
    previousCheckpointId: string | null
    nextCheckpointId: string | null
    stageAdvanceBlocked?: boolean
    blockingQueueItemCount?: number
    playbackAccessible?: boolean
    blockedByCheckpointId?: string | null
    blockedProgressionReason?: string | null
  } | null
  student: {
    studentId: string
    studentName: string
    usn: string
    sectionCode: string
    currentSemester: number
    programScopeVersion: string | null
    mentorTrack: string | null
  }
  allowedIntents: string[]
  summaryRail: {
    currentRiskBand: string | null
    currentRiskProbScaled: number | null
    currentRiskDisplayProbabilityAllowed?: boolean | null
    currentRiskSupportWarning?: string | null
    currentRiskCalibrationMethod?: string | null
    previousRiskBand?: string | null
    previousRiskProbScaled?: number | null
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    primaryCourseCode: string | null
    primaryCourseTitle: string | null
    nextDueAt: string | null
    currentReassessmentStatus: string | null
    currentQueueState?: string | null
    currentRecoveryState?: ProofRecoveryState | null
    currentCgpa: number
    backlogCount: number
    electiveFit: {
      recommendedCode: string
      recommendedTitle: string
      stream: string
      rationale: string[]
      alternatives: Array<{ code: string; title: string; stream: string }>
    } | null
  }
  overview: {
    observedLabel: StudentAgentPanelLabel
    policyLabel: StudentAgentPanelLabel
    currentEvidence: {
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      weakCoCount: number
      weakQuestionCount: number
      coEvidenceMode?: string | null
      interventionRecoveryStatus: string | null
    }
    currentStatus: {
      riskBand: string | null
      riskProbScaled: number | null
      riskCompleteness?: GraphAwarePrerequisiteSummaryCompleteness | null
      featureCompleteness?: GraphAwareFeatureCompleteness | null
      featureProvenance?: GraphAwareFeatureProvenance | null
      previousRiskBand?: string | null
      previousRiskProbScaled?: number | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      reassessmentStatus: string | null
      resolutionStatus?: string | null
      nextDueAt: string | null
      recommendedAction: string | null
      queueState?: string | null
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      assignedFacultyId?: string | null
      recoveryState?: ProofRecoveryState | null
      observedResidual?: number | null
      simulatedActionTaken?: string | null
      policyComparison?: {
        policyPhenotype?: PolicyPhenotype | null
        recommendedAction: string | null
        simulatedActionTaken: string | null
        noActionRiskBand: string | null
        noActionRiskProbScaled: number | null
        counterfactualLiftScaled: number | null
        rationale: string
      } | null
      attentionAreas: string[]
    }
    semesterSummaries: Array<{
      semesterNumber: number
      riskBands: string[]
      sgpa: number
      cgpaAfterSemester: number
      backlogCount: number
      weakCoCount: number
      questionResultCoverage: number
      interventionCount: number
    }>
  }
  topicAndCo: {
    panelLabel: StudentAgentPanelLabel
    topicBuckets: {
      known: string[]
      partial: string[]
      blocked: string[]
      highUncertainty: string[]
    }
    weakCourseOutcomes: Array<{
      coCode: string
      coTitle: string
      trend: string
      topics: string[]
      evidenceMode: string
      tt1Pct: number
      tt2Pct: number
      seePct: number
      transferGap: number
    }>
    questionPatterns: {
      weakQuestionCount: number
      carelessErrorCount: number
      transferGapCount: number
      commonWeakTopics: string[]
      commonWeakCourseOutcomes: string[]
    }
    simulationTags: string[]
  }
  assessmentEvidence: {
    panelLabel: StudentAgentPanelLabel
    components: Array<{
      courseCode: string
      courseTitle: string
      sectionCode: string | null
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      weakCoCount: number
      weakQuestionCount: number
      coEvidenceMode?: string | null
      drivers: Array<{ label: string; impact: number; feature: string }>
    }>
  }
  interventions: {
    panelLabel: StudentAgentPanelLabel
    currentReassessments: Array<{
      reassessmentEventId: string
      courseCode: string
      courseTitle: string
      status: string
      dueAt: string
      assignedToRole: string
      assignedFacultyId?: string | null
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      recoveryState?: ProofRecoveryState | null
      observedResidual?: number | null
    }>
    interventionHistory: Array<{
      interventionId: string
      interventionType: string
      note: string
      occurredAt: string
      accepted: boolean | null
      completed: boolean | null
      recoveryConfirmed: boolean | null
      recoveryState?: ProofRecoveryState | null
      observedResidual: number | null
    }>
    humanActionLog: Array<{
      title: string
      detail: string
      occurredAt: string
    }>
  }
  counterfactual: {
    panelLabel: StudentAgentPanelLabel
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    note: string
  } | null
  citations: StudentAgentCitation[]
}

export type StudentRiskExplorerPayload = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  disclaimer: string
  scopeDescriptor: ProofScopeDescriptor
  resolvedFrom: ProofResolvedFrom
  scopeMode: ProofScopeMode
  countSource: ProofCountSource
  activeOperationalSemester: number | null
  runContext: StudentAgentCardPayload['runContext']
  checkpointContext: StudentAgentCardPayload['checkpointContext']
  student: StudentAgentCardPayload['student']
  riskCompleteness?: GraphAwareFeatureCompleteness | null
  featureCompleteness: GraphAwareFeatureCompleteness
  featureProvenance: GraphAwareFeatureProvenance
  modelProvenance: {
    modelVersion: string | null
    calibrationVersion: string | null
    featureSchemaVersion: string | null
    evidenceWindow: string | null
    calibrationMethod?: string | null
    displayProbabilityAllowed?: boolean | null
    supportWarning?: string | null
    headDisplay?: Record<string, {
      displayProbabilityAllowed: boolean
      supportWarning: string | null
      calibrationMethod: string
    }> | null
    coEvidenceMode?: string | null
    simulationCalibrated: true
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
  trainedRiskHeadDisplays?: Record<string, {
    displayProbabilityAllowed: boolean
    supportWarning: string | null
    calibrationMethod: string
  }> | null
  derivedScenarioHeads: {
    semesterSgpaDropRiskProbScaled: number | null
    cumulativeCgpaDropRiskProbScaled: number | null
    electiveMismatchRiskProbScaled: number | null
    note: string
  }
  currentEvidence: StudentAgentCardPayload['overview']['currentEvidence']
  currentStatus: StudentAgentCardPayload['overview']['currentStatus']
  topDrivers: Array<{ label: string; impact: number; feature: string }>
  crossCourseDrivers: string[]
  prerequisiteMap: {
    prerequisiteCourseCodes: string[]
    weakPrerequisiteCourseCodes: string[]
    prerequisitePressureScaled: number | null
    prerequisiteAveragePct: number | null
    prerequisiteFailureCount: number | null
    completeness?: GraphAwarePrerequisiteSummaryCompleteness | null
  }
  weakCourseOutcomes: StudentAgentCardPayload['topicAndCo']['weakCourseOutcomes']
  questionPatterns: StudentAgentCardPayload['topicAndCo']['questionPatterns']
  semesterSummaries: StudentAgentCardPayload['overview']['semesterSummaries']
  assessmentComponents: StudentAgentCardPayload['assessmentEvidence']['components']
  counterfactual: StudentAgentCardPayload['counterfactual']
  electiveFit: StudentAgentCardPayload['summaryRail']['electiveFit']
  policyComparison?: {
    policyPhenotype?: PolicyPhenotype | null
    recommendedAction: string | null
    simulatedActionTaken: string | null
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    policyRationale: string
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
}

export type ProofCheckpointSummaryPayload = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageLabel: string
  stageDescription: string
  stageOrder: number
  previousCheckpointId: string | null
  nextCheckpointId: string | null
  totalStudentProjectionCount?: number
  studentCount?: number
  offeringCount?: number
  highRiskCount?: number
  mediumRiskCount?: number
  lowRiskCount?: number
  openQueueCount?: number
  resolvedQueueCount?: number
  noActionHighRiskCount?: number
  electiveVisibleCount?: number
  averageRiskDeltaScaled?: number
  averageRiskChangeFromPreviousCheckpointScaled?: number
  averageCounterfactualLiftScaled?: number
  stageAdvanceBlocked?: boolean
  blockingQueueItemCount?: number
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}

export type RuntimeCourse = {
  curriculumNodeId: string
  semesterNumber: number
  courseId: string | null
  courseCode: string
  title: string
  credits: number
  internalCompilerId: string
  officialWebCode: string | null
  officialWebTitle: string | null
  matchStatus: string
  mappingNote: string | null
  assessmentProfile: string
  explicitPrerequisites: string[]
  addedPrerequisites: string[]
  bridgeModules: string[]
  tt1Topics: string[]
  tt2Topics: string[]
  seeTopics: string[]
  workbookTopics: string[]
}

export type RuntimeElectiveOption = {
  stream: string
  pceGroup: string
  code: string
  title: string
  semesterSlot: string
}

type StudentTrajectory = {
  studentId: string
  usn: string
  name: string
  sectionCode: 'A' | 'B'
  archetype: string
  latentBase: {
    academicPotential: number
    mathematicsFoundation: number
    computingFoundation: number
    selfRegulation: number
    attendanceDiscipline: number
    supportResponsiveness: number
  }
  profile: {
    programScopeVersion: string
    currentSemester: number
    mentorTrack: 'mentor' | 'course-led' | 'mixed'
    electiveTrackInterestProfile: Record<string, number>
    readiness: {
      mathReadiness: number
      programmingReadiness: number
      logicReadiness: number
      statsReadiness: number
      systemsReadiness: number
      communicationReadiness: number
      labReadiness: number
    }
    dynamics: {
      forgetRate: number
      relearnRate: number
      transferGainRate: number
      studyGainRate: number
      fatigueRate: number
      consistency: number
      volatility: number
      recoveryTendency: number
      relapseTendency: number
    }
    behavior: {
      attendancePropensity: number
      helpSeekingTendency: number
      selfCheckTendency: number
      deadlineDiscipline: number
      examPressure: number
      timePressureSensitivity: number
      practiceCompliance: number
      courseworkReliability: number
    }
    assessment: {
      quizRecallStrength: number
      assignmentCompletionStrength: number
      termTestApplicationStrength: number
      seeEndurance: number
      labExecutionStrength: number
      partialCreditConversion: number
      carelessErrorRate: number
      multiStepBreakdownRisk: number
    }
    intervention: {
      interventionReceptivity: number
      temporaryUpliftCredit: number
      expectedRecoveryThreshold: number
    }
  }
}

type CourseSimulation = {
  attendancePct: number
  attendanceHistory: Array<{
    checkpoint: string
    checkpointLabel: string
    presentClasses: number
    totalClasses: number
    attendancePct: number
  }>
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  cePct: number
  seePct: number
  ceMark: number
  seeMark: number
  overallMark: number
  gradeLabel: string
  gradePoint: number
  result: 'Passed' | 'Failed'
  condoned: boolean
  prerequisiteCarryoverRisk: number
  courseworkToTtGap: number
  ttMomentum: number
  latentSummary: Record<string, number>
}

type CourseOutcomeSummary = {
  coCode: string
  coTitle: string
  topics: string[]
  mastery: number
  evidenceMode: 'offering-blueprint' | 'synthetic-blueprint' | 'rubric-derived' | 'fallback-simulated'
  observedScores: {
    tt1Pct: number
    tt2Pct: number
    seePct: number
  }
  trend: 'improving' | 'flat' | 'declining'
  transferGap: number
  recoveryAfterIntervention: number
}

export type SimulatedQuestionTemplate = {
  simulationQuestionTemplateId: string
  simulationRunId: string
  semesterNumber: number
  curriculumNodeId: string
  offeringId: string | null
  componentType: 'tt1' | 'tt2' | 'see'
  questionIndex: number
  questionCode: string
  questionType: string
  questionMarks: number
  difficultyScaled: number
  transferDemandScaled: number
  coTags: string[]
  topicTags: string[]
  microSkillTags: string[]
  sourceType: string
  templateJson: Record<string, unknown>
}

type SimulatedQuestionResult = {
  simulationQuestionTemplateId: string
  componentType: 'tt1' | 'tt2' | 'see'
  score: number
  maxScore: number
  errorType: 'clean' | 'careless-error' | 'partial-method' | 'transfer-gap' | 'incomplete'
  partialCreditProfile: number
}

export type BlueprintNode = {
  id: string
  label: string
  text: string
  maxMarks: number
  cos: string[]
  children?: BlueprintNode[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function stableUnit(seed: string) {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function stableBetween(seed: string, min: number, max: number) {
  return min + (stableUnit(seed) * (max - min))
}

function stableGaussian(seed: string, mean: number, stddev: number) {
  const u1 = Math.max(stableUnit(seed), 1e-10)
  const u2 = stableUnit(seed + '-pair')
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + (z * stddev)
}

const STUDENT_ARCHETYPES = [
  {
    key: 'deep-competent',
    abilityShift: 0.1,
    disciplineShift: 0.08,
    forgetShift: -0.03,
    pressureShift: -0.04,
    courseworkReliabilityShift: 0.08,
  },
  {
    key: 'strategic-efficient',
    abilityShift: 0.05,
    disciplineShift: 0.03,
    forgetShift: -0.01,
    pressureShift: 0.01,
    courseworkReliabilityShift: 0.03,
  },
  {
    key: 'strategic-fragile',
    abilityShift: 0.02,
    disciplineShift: -0.01,
    forgetShift: 0.02,
    pressureShift: 0.08,
    courseworkReliabilityShift: 0.01,
  },
  {
    key: 'cumulative-gap',
    abilityShift: -0.06,
    disciplineShift: 0.01,
    forgetShift: 0.04,
    pressureShift: 0.06,
    courseworkReliabilityShift: -0.02,
  },
  {
    key: 'underregulated',
    abilityShift: -0.04,
    disciplineShift: -0.08,
    forgetShift: 0.03,
    pressureShift: 0.06,
    courseworkReliabilityShift: -0.05,
  },
  {
    key: 'surface-survival',
    abilityShift: -0.01,
    disciplineShift: -0.03,
    forgetShift: 0.05,
    pressureShift: 0.1,
    courseworkReliabilityShift: -0.08,
  },
] as const

export type RuntimeCurriculum = {
  courses: RuntimeCourse[]
  electives: RuntimeElectiveOption[]
}

export type ScenarioProfile = {
  family: ReturnType<typeof scenarioFamilyForSeed>
  sectionAbilityShift: number
  sectionDisciplineShift: number
  forgetRateShift: number
  courseworkReliabilityShift: number
  examPressureShift: number
  supportResponsivenessShift: number
}

function scenarioProfileForSeed(seed: number): ScenarioProfile {
  const family = scenarioFamilyForSeed(seed)
  const seedStr = `domain-rand-${seed}`
  const domainShift = {
    sectionAbilityShift: stableBetween(`${seedStr}-ability`, -0.04, 0.04),
    sectionDisciplineShift: stableBetween(`${seedStr}-discipline`, -0.03, 0.03),
    forgetRateShift: stableBetween(`${seedStr}-forget`, -0.02, 0.02),
    courseworkReliabilityShift: stableBetween(`${seedStr}-coursework`, -0.03, 0.03),
    examPressureShift: stableBetween(`${seedStr}-pressure`, -0.02, 0.03),
    supportResponsivenessShift: stableBetween(`${seedStr}-support`, -0.03, 0.03),
  }
  let base: ScenarioProfile
  switch (family) {
    case 'weak-foundation':
      base = { family, sectionAbilityShift: -0.09, sectionDisciplineShift: -0.01, forgetRateShift: 0.02, courseworkReliabilityShift: -0.01, examPressureShift: 0.04, supportResponsivenessShift: -0.02 }
      break
    case 'low-attendance':
      base = { family, sectionAbilityShift: -0.01, sectionDisciplineShift: -0.08, forgetRateShift: 0.01, courseworkReliabilityShift: 0, examPressureShift: 0.02, supportResponsivenessShift: -0.04 }
      break
    case 'high-forgetting':
      base = { family, sectionAbilityShift: 0, sectionDisciplineShift: -0.01, forgetRateShift: 0.07, courseworkReliabilityShift: -0.02, examPressureShift: 0.03, supportResponsivenessShift: -0.02 }
      break
    case 'coursework-inflation':
      base = { family, sectionAbilityShift: -0.02, sectionDisciplineShift: 0.02, forgetRateShift: 0.01, courseworkReliabilityShift: 0.08, examPressureShift: 0.01, supportResponsivenessShift: 0 }
      break
    case 'exam-fragility':
      base = { family, sectionAbilityShift: -0.01, sectionDisciplineShift: 0, forgetRateShift: 0.02, courseworkReliabilityShift: 0.01, examPressureShift: 0.08, supportResponsivenessShift: -0.01 }
      break
    case 'carryover-heavy':
      base = { family, sectionAbilityShift: -0.05, sectionDisciplineShift: -0.01, forgetRateShift: 0.03, courseworkReliabilityShift: -0.01, examPressureShift: 0.03, supportResponsivenessShift: -0.02 }
      break
    case 'intervention-resistant':
      base = { family, sectionAbilityShift: -0.02, sectionDisciplineShift: -0.02, forgetRateShift: 0.02, courseworkReliabilityShift: -0.02, examPressureShift: 0.04, supportResponsivenessShift: -0.09 }
      break
    case 'balanced':
    default:
      base = { family, sectionAbilityShift: 0, sectionDisciplineShift: 0, forgetRateShift: 0, courseworkReliabilityShift: 0, examPressureShift: 0, supportResponsivenessShift: 0 }
      break
  }
  return {
    family: base.family,
    sectionAbilityShift: base.sectionAbilityShift + domainShift.sectionAbilityShift,
    sectionDisciplineShift: base.sectionDisciplineShift + domainShift.sectionDisciplineShift,
    forgetRateShift: base.forgetRateShift + domainShift.forgetRateShift,
    courseworkReliabilityShift: base.courseworkReliabilityShift + domainShift.courseworkReliabilityShift,
    examPressureShift: base.examPressureShift + domainShift.examPressureShift,
    supportResponsivenessShift: base.supportResponsivenessShift + domainShift.supportResponsivenessShift,
  }
}

function sectionForIndex(index: number): 'A' | 'B' {
  return index < 60 ? 'A' : 'B'
}

function pickArchetype(index: number, runSeed: number) {
  const score = stableUnit(`run-${runSeed}-student-${index + 1}-archetype`)
  const weighted = sectionForIndex(index) === 'A' ? score * 0.9 : score * 1.08
  const bucket = Math.min(STUDENT_ARCHETYPES.length - 1, Math.floor(weighted * STUDENT_ARCHETYPES.length))
  return STUDENT_ARCHETYPES[bucket] ?? STUDENT_ARCHETYPES[0]
}

function flattenBlueprintLeaves(nodes: BlueprintNode[]): BlueprintNode[] {
  const leaves: BlueprintNode[] = []
  const visit = (entries: BlueprintNode[]) => {
    for (const entry of entries) {
      if (entry.children?.length) {
        visit(entry.children)
        continue
      }
      leaves.push(entry)
    }
  }
  visit(nodes)
  return leaves
}

function normalizeTopicKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function coDefinitionsForCourse(course: RuntimeCourse) {
  const topicPool = course.workbookTopics.length > 0
    ? course.workbookTopics
    : [...course.tt1Topics, ...course.tt2Topics, ...course.seeTopics]
  const groups = [
    topicPool.filter((_, index) => index % 3 === 0),
    topicPool.filter((_, index) => index % 3 === 1),
    topicPool.filter((_, index) => index % 3 === 2),
  ].map(group => group.filter(Boolean))
  return groups.map((topics, index) => ({
    coCode: `${courseCodeForRuntime(course)}-CO${index + 1}`,
    coTitle: topics[0] ? `${topics[0]} competency` : `Course outcome ${index + 1}`,
    topics: topics.length > 0 ? topics : [course.title],
  }))
}

function buildAttendanceHistory(input: {
  attendancePct: number
  student: StudentTrajectory
  course: RuntimeCourse
  semesterNumber: number
  runSeed: number
}) {
  const checkpoints = [
    { checkpoint: 'wk4', checkpointLabel: 'Week 4', totalClasses: 8 },
    { checkpoint: 'wk8', checkpointLabel: 'Week 8', totalClasses: 16 },
    { checkpoint: 'wk12', checkpointLabel: 'Week 12', totalClasses: 24 },
    { checkpoint: 'wk16', checkpointLabel: 'Week 16', totalClasses: 32 },
  ]
  return checkpoints.map((checkpoint, index) => {
    const drift = stableBetween(
      `run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${input.semesterNumber}-${checkpoint.checkpoint}`,
      -4 - index,
      4,
    )
    const pct = clamp(
      Math.round(input.attendancePct + drift + ((index - 1.5) * 1.4 * (input.student.profile.behavior.attendancePropensity - 0.5))),
      48,
      99,
    )
    return {
      checkpoint: checkpoint.checkpoint,
      checkpointLabel: checkpoint.checkpointLabel,
      presentClasses: Math.round((pct / 100) * checkpoint.totalClasses),
      totalClasses: checkpoint.totalClasses,
      attendancePct: pct,
    }
  })
}

function buildTopicStateRows(input: {
  simulationRunId: string
  student: StudentTrajectory
  course: RuntimeCourse
  semesterNumber: number
  offeringId?: string | null
  mastery: number
  prereq: number
  runSeed: number
  now: string
}) {
  const topics = input.course.workbookTopics.length > 0 ? input.course.workbookTopics : [input.course.title]
  return topics.map(topic => {
    const topicKey = normalizeTopicKey(topic)
    const mastery = clamp(
      input.mastery + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${topicKey}-mastery`, -0.16, 0.12),
      0.08,
      0.98,
    )
    const retention = clamp(
      mastery - (input.student.profile.dynamics.forgetRate * 0.25) + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${topicKey}-retention`, -0.12, 0.08),
      0.05,
      0.97,
    )
    const transfer = clamp(
      mastery - (input.student.profile.assessment.multiStepBreakdownRisk * 0.22) + (input.student.profile.dynamics.transferGainRate * 0.12),
      0.04,
      0.97,
    )
    const prerequisiteDebt = clamp(
      (1 - input.prereq) * 0.7 + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${topicKey}-debt`, -0.06, 0.09),
      0,
      0.95,
    )
    const uncertainty = clamp(
      (1 - input.student.profile.dynamics.consistency) * 0.7 + (input.student.profile.dynamics.volatility * 0.4) + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${topicKey}-uncertainty`, -0.08, 0.08),
      0.03,
      0.92,
    )
    return {
      studentTopicStateId: createId('topic_state'),
      simulationRunId: input.simulationRunId,
      studentId: input.student.studentId,
      semesterNumber: input.semesterNumber,
      curriculumNodeId: input.course.curriculumNodeId,
      offeringId: input.offeringId ?? null,
      sectionCode: input.student.sectionCode,
      topicKey,
      topicName: topic,
      stateJson: JSON.stringify({
        mastery: roundToTwo(mastery),
        retention: roundToTwo(retention),
        transfer: roundToTwo(transfer),
        uncertainty: roundToTwo(uncertainty),
        prerequisiteDebt: roundToTwo(prerequisiteDebt),
        bridgeSkillNeeded: prerequisiteDebt >= 0.3,
        bridgeSkillCompleted: prerequisiteDebt < 0.18,
      }),
      createdAt: input.now,
      updatedAt: input.now,
    }
  })
}

function buildCourseOutcomeStates(input: {
  simulationRunId: string
  student: StudentTrajectory
  course: RuntimeCourse
  semesterNumber: number
  offeringId?: string | null
  tt1Pct: number
  tt2Pct: number
  seePct: number
  mastery: number
  templates?: SimulatedQuestionTemplate[]
  questionResults?: SimulatedQuestionResult[]
  runSeed: number
  now: string
}) {
  const questionResultByTemplateId = new Map((input.questionResults ?? []).map(result => [result.simulationQuestionTemplateId, result]))
  const templateByCoCode = new Map<string, Array<SimulatedQuestionTemplate>>()
  for (const template of input.templates ?? []) {
    for (const coCode of template.coTags) {
      templateByCoCode.set(coCode, [...(templateByCoCode.get(coCode) ?? []), template])
    }
  }

  const outcomes = coDefinitionsForCourse(input.course).map(outcome => {
    const coTemplates = templateByCoCode.get(outcome.coCode) ?? []
    const evidenceMode: CourseOutcomeSummary['evidenceMode'] = coTemplates.some(template => template.sourceType === 'offering-blueprint')
        ? 'offering-blueprint'
        : coTemplates.some(template => template.sourceType === 'rubric-derived')
          ? 'rubric-derived'
          : /lab|project|workshop|practical/i.test(input.course.assessmentProfile)
            ? 'rubric-derived'
            : 'synthetic-blueprint'
    const componentPct = (componentType: 'tt1' | 'tt2' | 'see') => {
      const componentTemplates = coTemplates.filter(template => template.componentType === componentType)
      if (!componentTemplates.length) return null
      const scoreSum = componentTemplates.reduce((sum, template) => sum + Number(questionResultByTemplateId.get(template.simulationQuestionTemplateId)?.score ?? 0), 0)
      const maxSum = componentTemplates.reduce((sum, template) => sum + template.questionMarks, 0)
      if (!maxSum) return null
      return clamp(roundToTwo((scoreSum / maxSum) * 100), 0, 100)
    }
    const tt1Pct = componentPct('tt1') ?? clamp(input.tt1Pct + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${outcome.coCode}-tt1`, -12, 8), 8, 99)
    const tt2Pct = componentPct('tt2') ?? clamp(input.tt2Pct + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${outcome.coCode}-tt2`, -10, 10), 8, 99)
    const seePct = componentPct('see') ?? clamp(input.seePct + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${outcome.coCode}-see`, -12, 9), 5, 99)
    const mastery = clamp(
      ((tt2Pct * 0.55) + (seePct * 0.45)) / 100
        + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${input.course.internalCompilerId}-${outcome.coCode}-mastery`, -0.08, 0.06),
      0.08,
      0.98,
    )
    const trend = tt2Pct - tt1Pct > 6 ? 'improving' : tt2Pct - tt1Pct < -4 ? 'declining' : 'flat'
    const transferGap = clamp((seePct - tt2Pct) / 100, -0.4, 0.4)
    const recoveryAfterIntervention = clamp(
      (tt2Pct - tt1Pct) / 100 + (input.student.profile.intervention.temporaryUpliftCredit * 0.2),
      -0.2,
      0.6,
    )
    return {
      row: {
        studentCoStateId: createId('co_state'),
        simulationRunId: input.simulationRunId,
        studentId: input.student.studentId,
        semesterNumber: input.semesterNumber,
        curriculumNodeId: input.course.curriculumNodeId,
        offeringId: input.offeringId ?? null,
        sectionCode: input.student.sectionCode,
        coCode: outcome.coCode,
        coTitle: outcome.coTitle,
        stateJson: JSON.stringify({
          coMasteryEstimate: roundToTwo(mastery),
          coEvidenceMode: evidenceMode,
          coObservedScoreHistory: {
            tt1Pct: roundToTwo(tt1Pct),
            tt2Pct: roundToTwo(tt2Pct),
            seePct: roundToTwo(seePct),
          },
          coTrend: trend,
          coTransferGap: roundToTwo(transferGap),
          coRecoveryAfterIntervention: roundToTwo(recoveryAfterIntervention),
          topics: outcome.topics,
        }),
        createdAt: input.now,
        updatedAt: input.now,
      },
      summary: {
        coCode: outcome.coCode,
        coTitle: outcome.coTitle,
        topics: outcome.topics,
        mastery: roundToTwo(mastery),
        evidenceMode,
        observedScores: {
          tt1Pct: roundToTwo(tt1Pct),
          tt2Pct: roundToTwo(tt2Pct),
          seePct: roundToTwo(seePct),
        },
        trend,
        transferGap: roundToTwo(transferGap),
        recoveryAfterIntervention: roundToTwo(recoveryAfterIntervention),
      } satisfies CourseOutcomeSummary,
    }
  })

  return {
    rows: outcomes.map(outcome => outcome.row),
    summaries: outcomes.map(outcome => outcome.summary),
    weakCoCount: outcomes.filter(outcome => outcome.summary.observedScores.tt2Pct < 50 || outcome.summary.observedScores.seePct < 45).length,
  }
}

function buildSimulatedQuestionTemplates(input: {
  simulationRunId: string
  semesterNumber: number
  course: RuntimeCourse
  offeringId?: string | null
  tt1Topics: string[]
  tt2Topics: string[]
  seeTopics: string[]
}) {
  const coDefs = coDefinitionsForCourse(input.course)
  const defaultSourceType = /lab|project|workshop/i.test(input.course.assessmentProfile)
    ? 'rubric-derived'
    : 'synthetic-blueprint'
  const buildTemplatesForTopics = (
    componentType: 'tt1' | 'tt2' | 'see',
    topics: string[],
    count: number,
    sourceType = defaultSourceType,
  ) => Array.from({ length: count }, (_, index) => {
    const topic = topics[index % Math.max(1, topics.length)] ?? input.course.title
    const co = coDefs[index % coDefs.length] ?? coDefs[0]
    const questionMarks = componentType === 'see' ? (index % 2 === 0 ? 8 : 6) : 5
    const difficultyScaled = Math.round(stableBetween(`${input.simulationRunId}-${input.course.internalCompilerId}-${componentType}-${index + 1}-difficulty`, 32, componentType === 'see' ? 84 : 76))
    const transferDemandScaled = Math.round(stableBetween(`${input.simulationRunId}-${input.course.internalCompilerId}-${componentType}-${index + 1}-transfer`, 28, componentType === 'tt1' ? 68 : 88))
    const microSkillKey = normalizeTopicKey(topic)
    return {
      simulationQuestionTemplateId: createId('question_template'),
      simulationRunId: input.simulationRunId,
      semesterNumber: input.semesterNumber,
      curriculumNodeId: input.course.curriculumNodeId,
      offeringId: input.offeringId ?? null,
      componentType,
      questionIndex: index + 1,
      questionCode: `${courseCodeForRuntime(input.course)}-${componentType.toUpperCase()}-Q${index + 1}`,
      questionType: transferDemandScaled >= 70 ? 'application' : difficultyScaled >= 60 ? 'analysis' : 'recall',
      questionMarks,
      difficultyScaled,
      transferDemandScaled,
      coTags: co ? [co.coCode] : [],
      topicTags: [topic],
      microSkillTags: [`${microSkillKey}_recall`, `${microSkillKey}_application`],
      sourceType,
      templateJson: {
        prompt: `${componentType.toUpperCase()} question ${index + 1} on ${topic}`,
        topic,
        marks: questionMarks,
      },
    } satisfies SimulatedQuestionTemplate
  })

  return [
    ...buildTemplatesForTopics('tt1', input.tt1Topics.length > 0 ? input.tt1Topics : input.tt2Topics, 5),
    ...buildTemplatesForTopics('tt2', input.tt2Topics.length > 0 ? input.tt2Topics : input.seeTopics, 5),
    ...buildTemplatesForTopics('see', input.seeTopics.length > 0 ? input.seeTopics : input.tt2Topics, 6),
  ]
}

function buildTemplatesFromBlueprint(input: {
  simulationRunId: string
  semesterNumber: number
  course: RuntimeCourse
  offeringId: string
  componentType: 'tt1' | 'tt2' | 'see'
  blueprint: { nodes: BlueprintNode[] }
  topicFallback: string[]
}) {
  const leaves = flattenBlueprintLeaves(input.blueprint.nodes).slice(0, input.componentType === 'see' ? 6 : 5)
  return leaves.map((leaf, index) => {
    const topic = input.topicFallback[index % Math.max(1, input.topicFallback.length)] ?? input.course.title
    return {
      simulationQuestionTemplateId: createId('question_template'),
      simulationRunId: input.simulationRunId,
      semesterNumber: input.semesterNumber,
      curriculumNodeId: input.course.curriculumNodeId,
      offeringId: input.offeringId,
      componentType: input.componentType,
      questionIndex: index + 1,
      questionCode: `${courseCodeForRuntime(input.course)}-${input.componentType.toUpperCase()}-${leaf.label}`,
      questionType: leaf.maxMarks >= 8 ? 'application' : leaf.maxMarks >= 5 ? 'analysis' : 'recall',
      questionMarks: leaf.maxMarks,
      difficultyScaled: Math.round(stableBetween(`${input.simulationRunId}-${input.offeringId}-${input.componentType}-${leaf.id}-difficulty`, 38, 82)),
      transferDemandScaled: Math.round(stableBetween(`${input.simulationRunId}-${input.offeringId}-${input.componentType}-${leaf.id}-transfer`, 28, 90)),
      coTags: leaf.cos,
      topicTags: [topic],
      microSkillTags: [`${normalizeTopicKey(topic)}_recall`, `${normalizeTopicKey(topic)}_application`],
      sourceType: 'offering-blueprint',
      templateJson: {
        prompt: leaf.text,
        label: leaf.label,
        sourceLeafId: leaf.id,
      },
    } satisfies SimulatedQuestionTemplate
  })
}

function simulateQuestionResults(input: {
  student: StudentTrajectory
  course: RuntimeCourse
  templates: SimulatedQuestionTemplate[]
  tt1Pct: number
  tt2Pct: number
  seePct: number
  runSeed: number
}) {
  const results = input.templates.map(template => {
    const basePct = template.componentType === 'tt1'
      ? input.tt1Pct
      : template.componentType === 'tt2'
        ? input.tt2Pct
        : input.seePct
    const componentStrength = template.componentType === 'tt1'
      ? input.student.profile.assessment.termTestApplicationStrength
      : template.componentType === 'tt2'
        ? (input.student.profile.assessment.termTestApplicationStrength + input.student.profile.dynamics.relearnRate) / 2
        : input.student.profile.assessment.seeEndurance
    const expectedPct = clamp(
      basePct
        + (componentStrength * 14)
        - ((template.difficultyScaled / 100) * 10)
        - ((template.transferDemandScaled / 100) * input.student.profile.assessment.multiStepBreakdownRisk * 18)
        + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${template.questionCode}`, -14, 10),
      4,
      99,
    )
    const rawScore = clamp(Math.round((expectedPct / 100) * template.questionMarks), 0, template.questionMarks)
    const partialCreditProfile = roundToTwo(clamp(
      input.student.profile.assessment.partialCreditConversion - ((template.transferDemandScaled / 100) * 0.12) + stableBetween(`run-${input.runSeed}-${input.student.studentId}-${template.questionCode}-partial`, -0.08, 0.08),
      0.05,
      0.95,
    ))
    const errorSeed = stableUnit(`run-${input.runSeed}-${input.student.studentId}-${template.questionCode}-error`)
    const errorType: SimulatedQuestionResult['errorType'] = errorSeed < input.student.profile.assessment.carelessErrorRate
      ? 'careless-error'
      : errorSeed < input.student.profile.assessment.carelessErrorRate + input.student.profile.assessment.multiStepBreakdownRisk
        ? 'transfer-gap'
        : rawScore === 0
          ? 'incomplete'
          : rawScore < template.questionMarks
            ? 'partial-method'
            : 'clean'
    return {
      simulationQuestionTemplateId: template.simulationQuestionTemplateId,
      componentType: template.componentType,
      score: rawScore,
      maxScore: template.questionMarks,
      errorType,
      partialCreditProfile,
    } satisfies SimulatedQuestionResult
  })
  const tt1Results = results.filter(result => result.componentType === 'tt1')
  const tt2Results = results.filter(result => result.componentType === 'tt2')
  const seeResults = results.filter(result => result.componentType === 'see')
  return {
    results,
    summary: {
      tt1QuestionCount: tt1Results.length,
      tt2QuestionCount: tt2Results.length,
      seeQuestionCount: seeResults.length,
      weakQuestionCount: results.filter(result => (result.score / Math.max(1, result.maxScore)) < 0.4).length,
      carelessErrorCount: results.filter(result => result.errorType === 'careless-error').length,
      transferGapCount: results.filter(result => result.errorType === 'transfer-gap').length,
    },
  }
}

function courseCodeForRuntime(course: Pick<RuntimeCourse, 'officialWebCode' | 'internalCompilerId'>) {
  return course.officialWebCode ?? course.internalCompilerId
}

function isLabLikeCourse(course: Pick<RuntimeCourse, 'title' | 'assessmentProfile'>) {
  const haystack = `${course.title} ${course.assessmentProfile}`.toLowerCase()
  return haystack.includes('lab') || haystack.includes('project') || haystack.includes('workshop')
}

function weeklyContactHoursForCourse(course: Pick<RuntimeCourse, 'title' | 'assessmentProfile' | 'credits'>) {
  return sharedWeeklyContactHoursForCourse(course)
}

function deterministicPolicyFromResolved(policy: ResolvedPolicy): MsruasDeterministicPolicy {
  return {
    gradeBands: policy.gradeBands,
    attendanceRules: {
      minimumPercent: policy.attendanceRules.minimumRequiredPercent,
    },
    condonationRules: {
      minimumPercent: policy.attendanceRules.condonationFloorPercent,
      shortagePercent: policy.condonationRules.maximumShortagePercent,
      requiresApproval: policy.condonationRules.requiresApproval,
    },
    eligibilityRules: {
      minimumAttendancePercent: policy.attendanceRules.minimumRequiredPercent,
      minimumCeForSee: policy.eligibilityRules.minimumCeForSeeEligibility,
    },
    passRules: {
      ceMinimum: policy.passRules.minimumCeMark,
      seeMinimum: policy.passRules.minimumSeeMark,
      overallMinimum: policy.passRules.minimumOverallMark,
      ceMaximum: policy.passRules.ceMaximum,
      seeMaximum: policy.passRules.seeMaximum,
      overallMaximum: policy.passRules.overallMaximum,
    },
    roundingRules: {
      statusMarkRounding: policy.roundingRules.statusMarkRounding,
      sgpaCgpaDecimals: policy.roundingRules.sgpaCgpaDecimals,
    },
    sgpaCgpaRules: {
      includeFailedCredits: policy.sgpaCgpaRules.includeFailedCredits,
      repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
    },
  }
}

function buildStudentTrajectory(index: number, runSeed: number, scenarioProfile: ScenarioProfile): StudentTrajectory {
  const sectionCode = sectionForIndex(index)
  const sectionAbility = (sectionCode === 'A' ? 0.64 : 0.5) + scenarioProfile.sectionAbilityShift
  const sectionDiscipline = (sectionCode === 'A' ? 0.66 : 0.56) + scenarioProfile.sectionDisciplineShift
  const seedBase = `run-${runSeed}-student-${index + 1}`
  const archetype = pickArchetype(index, runSeed)
  const firstNames = ['Aarav', 'Ishita', 'Vihaan', 'Ananya', 'Advik', 'Meera', 'Reyansh', 'Kavya', 'Arjun', 'Diya', 'Krish', 'Nitya', 'Rohan', 'Saanvi', 'Dev', 'Mira', 'Kabir', 'Tara', 'Yash', 'Ira']
  const lastNames = ['Sharma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Joshi', 'Bhat', 'Rao', 'Singh', 'Krishnan', 'Menon', 'Kulkarni', 'Saxena', 'Varma']
  const first = firstNames[index % firstNames.length]
  const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length]
  const academicPotential = clamp(sectionAbility + archetype.abilityShift + stableGaussian(`${seedBase}-ability`, 0, 0.12), 0.2, 0.94)
  const mathematicsFoundation = clamp((sectionAbility + 0.04) + archetype.abilityShift + stableGaussian(`${seedBase}-math`, 0, 0.13), 0.2, 0.96)
  const computingFoundation = clamp((sectionAbility - 0.02) + (archetype.abilityShift * 0.9) + stableGaussian(`${seedBase}-computing`, 0, 0.13), 0.18, 0.96)
  const selfRegulation = clamp(sectionDiscipline + archetype.disciplineShift + stableGaussian(`${seedBase}-self`, 0, 0.12), 0.2, 0.95)
  const attendanceDiscipline = clamp((sectionDiscipline + 0.03) + archetype.disciplineShift + stableGaussian(`${seedBase}-attendance`, 0, 0.13), 0.2, 0.98)
  const supportResponsiveness = clamp(0.56 + scenarioProfile.supportResponsivenessShift + stableGaussian(`${seedBase}-support`, 0, 0.13), 0.15, 0.96)
  return {
    studentId: `mnc_student_${String(index + 1).padStart(3, '0')}`,
    usn: `1MS23MC${String(index + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    sectionCode,
    archetype: archetype.key,
    latentBase: {
      academicPotential,
      mathematicsFoundation,
      computingFoundation,
      selfRegulation,
      attendanceDiscipline,
      supportResponsiveness,
    },
    profile: {
      programScopeVersion: 'mnc-first-6-sem-v1',
      currentSemester: 6,
      mentorTrack: stableUnit(`${seedBase}-mentor-track`) > 0.66 ? 'mixed' : stableUnit(`${seedBase}-mentor-track`) > 0.33 ? 'course-led' : 'mentor',
      electiveTrackInterestProfile: {
        codingAndCryptography: roundToTwo(clamp(0.45 + stableBetween(`${seedBase}-interest-cc`, -0.22, 0.22), 0.05, 0.95)),
        mathematicalModels: roundToTwo(clamp(0.45 + stableBetween(`${seedBase}-interest-mm`, -0.22, 0.22), 0.05, 0.95)),
        artificialIntelligenceAndDataSciences: roundToTwo(clamp(0.45 + stableBetween(`${seedBase}-interest-ai`, -0.22, 0.22), 0.05, 0.95)),
        softwareDevelopment: roundToTwo(clamp(0.45 + stableBetween(`${seedBase}-interest-sd`, -0.22, 0.22), 0.05, 0.95)),
      },
      readiness: {
        mathReadiness: roundToTwo(mathematicsFoundation),
        programmingReadiness: roundToTwo(computingFoundation),
        logicReadiness: roundToTwo(clamp((mathematicsFoundation * 0.55) + (computingFoundation * 0.3) + stableBetween(`${seedBase}-logic`, -0.12, 0.12), 0.12, 0.96)),
        statsReadiness: roundToTwo(clamp((mathematicsFoundation * 0.62) + stableBetween(`${seedBase}-stats`, -0.14, 0.14), 0.1, 0.95)),
        systemsReadiness: roundToTwo(clamp((computingFoundation * 0.6) + stableBetween(`${seedBase}-systems`, -0.14, 0.14), 0.08, 0.95)),
        communicationReadiness: roundToTwo(clamp((selfRegulation * 0.4) + stableBetween(`${seedBase}-comm`, 0.18, 0.48), 0.08, 0.92)),
        labReadiness: roundToTwo(clamp((computingFoundation * 0.52) + (selfRegulation * 0.18) + stableBetween(`${seedBase}-lab`, -0.12, 0.14), 0.08, 0.95)),
      },
      dynamics: {
        forgetRate: roundToTwo(clamp(0.08 + scenarioProfile.forgetRateShift + archetype.forgetShift + stableBetween(`${seedBase}-forget`, -0.04, 0.05), 0.02, 0.28)),
        relearnRate: roundToTwo(clamp(0.55 + stableBetween(`${seedBase}-relearn`, -0.12, 0.14), 0.12, 0.92)),
        transferGainRate: roundToTwo(clamp(0.4 + stableBetween(`${seedBase}-transfer-gain`, -0.14, 0.14), 0.08, 0.9)),
        studyGainRate: roundToTwo(clamp(0.46 + stableBetween(`${seedBase}-study-gain`, -0.12, 0.12), 0.12, 0.92)),
        fatigueRate: roundToTwo(clamp(0.06 + stableBetween(`${seedBase}-fatigue`, -0.04, 0.06), 0.02, 0.30)),
        consistency: roundToTwo(clamp(0.54 + (selfRegulation * 0.2) + stableBetween(`${seedBase}-consistency`, -0.12, 0.12), 0.1, 0.95)),
        volatility: roundToTwo(clamp(0.22 + stableBetween(`${seedBase}-volatility`, -0.08, 0.14), 0.04, 0.62)),
        recoveryTendency: roundToTwo(clamp(0.5 + (supportResponsiveness * 0.18) + stableBetween(`${seedBase}-recovery`, -0.12, 0.12), 0.08, 0.94)),
        relapseTendency: roundToTwo(clamp(0.18 + stableBetween(`${seedBase}-relapse`, -0.06, 0.12), 0.02, 0.58)),
      },
      behavior: {
        attendancePropensity: roundToTwo(attendanceDiscipline),
        helpSeekingTendency: roundToTwo(clamp(0.42 + (supportResponsiveness * 0.18) + stableBetween(`${seedBase}-help`, -0.16, 0.16), 0.05, 0.95)),
        selfCheckTendency: roundToTwo(clamp(0.46 + (selfRegulation * 0.18) + stableBetween(`${seedBase}-self-check`, -0.16, 0.16), 0.05, 0.95)),
        deadlineDiscipline: roundToTwo(clamp(selfRegulation + stableBetween(`${seedBase}-deadline`, -0.12, 0.12), 0.08, 0.98)),
        examPressure: roundToTwo(clamp(0.32 + scenarioProfile.examPressureShift + archetype.pressureShift + stableBetween(`${seedBase}-pressure`, -0.14, 0.14), 0.05, 0.88)),
        timePressureSensitivity: roundToTwo(clamp(0.3 + stableBetween(`${seedBase}-time-pressure`, -0.12, 0.16), 0.05, 0.86)),
        practiceCompliance: roundToTwo(clamp(0.48 + (selfRegulation * 0.18) + stableBetween(`${seedBase}-practice`, -0.16, 0.16), 0.06, 0.95)),
        courseworkReliability: roundToTwo(clamp(0.72 + scenarioProfile.courseworkReliabilityShift + archetype.courseworkReliabilityShift + stableBetween(`${seedBase}-coursework-reliability`, -0.14, 0.1), 0.2, 0.98)),
      },
      assessment: {
        quizRecallStrength: roundToTwo(clamp(0.48 + stableBetween(`${seedBase}-quiz`, -0.16, 0.16), 0.08, 0.94)),
        assignmentCompletionStrength: roundToTwo(clamp(0.52 + stableBetween(`${seedBase}-assignment`, -0.14, 0.14), 0.08, 0.95)),
        termTestApplicationStrength: roundToTwo(clamp(0.48 + (academicPotential * 0.12) + stableBetween(`${seedBase}-tt`, -0.16, 0.16), 0.08, 0.95)),
        seeEndurance: roundToTwo(clamp(0.58 + stableBetween(`${seedBase}-see`, -0.14, 0.16), 0.08, 0.95)),
        labExecutionStrength: roundToTwo(clamp(0.5 + stableBetween(`${seedBase}-lab-exec`, -0.14, 0.16), 0.08, 0.96)),
        partialCreditConversion: roundToTwo(clamp(0.52 + stableBetween(`${seedBase}-partial-credit`, -0.16, 0.14), 0.08, 0.96)),
        carelessErrorRate: roundToTwo(clamp(0.08 + stableBetween(`${seedBase}-careless`, -0.03, 0.08), 0.01, 0.28)),
        multiStepBreakdownRisk: roundToTwo(clamp(0.18 + stableBetween(`${seedBase}-multistep`, -0.08, 0.12), 0.02, 0.54)),
      },
      intervention: {
        interventionReceptivity: roundToTwo(clamp(supportResponsiveness + stableBetween(`${seedBase}-intervention-receptive`, -0.16, 0.16), 0.08, 0.98)),
        temporaryUpliftCredit: roundToTwo(clamp(0.1 + stableBetween(`${seedBase}-uplift`, -0.04, 0.08), 0.01, 0.34)),
        expectedRecoveryThreshold: roundToTwo(clamp(0.12 + stableBetween(`${seedBase}-recovery-threshold`, -0.05, 0.08), 0.02, 0.36)),
      },
    },
  }
}

function courseEmphasis(course: Pick<RuntimeCourse, 'title'>) {
  const lower = course.title.toLowerCase()
  const mathHeavy = ['mathematics', 'algebra', 'probability', 'statistics', 'optimization', 'numerical', 'analysis', 'computation'].some(token => lower.includes(token))
  const computingHeavy = ['programming', 'computer', 'database', 'operating', 'network', 'software', 'algorithm', 'machine', 'data', 'distributed', 'logic', 'intelligence'].some(token => lower.includes(token))
  return {
    mathWeight: mathHeavy ? 0.7 : computingHeavy ? 0.35 : 0.5,
    computingWeight: computingHeavy ? 0.72 : mathHeavy ? 0.34 : 0.5,
  }
}

function prerequisiteAverage(course: RuntimeCourse, scoresByCourseTitle: Map<string, number>) {
  const signals = [...course.explicitPrerequisites, ...course.addedPrerequisites]
    .map(title => scoresByCourseTitle.get(title))
    .filter((value): value is number => typeof value === 'number')
  if (signals.length === 0) return 0.58
  return clamp(signals.reduce((sum, value) => sum + value, 0) / (signals.length * 100), 0.2, 0.95)
}

function teacherEffect(facultyId: string, course: RuntimeCourse, sectionCode: string, runSeed: number) {
  return stableBetween(`run-${runSeed}-${facultyId}-${course.internalCompilerId}-${sectionCode}`, -0.06, 0.08)
}

function simulateSemesterCourse(input: {
  student: StudentTrajectory
  course: RuntimeCourse
  semesterNumber: number
  scoresByCourseTitle: Map<string, number>
  facultyId: string
  policy: MsruasDeterministicPolicy
  runSeed: number
}): CourseSimulation {
  const { student, course, semesterNumber, scoresByCourseTitle, facultyId, policy, runSeed } = input
  const emphasis = courseEmphasis(course)
  const prereq = prerequisiteAverage(course, scoresByCourseTitle)
  const difficulty = 0.28 + (semesterNumber * 0.05) + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-difficulty`, -0.03, 0.05)
  const teaching = teacherEffect(facultyId, course, student.sectionCode, runSeed)
  const profile = student.profile
  const mastery = clamp(
    (student.latentBase.academicPotential * 0.32)
      + (student.latentBase.mathematicsFoundation * emphasis.mathWeight * 0.24)
      + (student.latentBase.computingFoundation * emphasis.computingWeight * 0.24)
      + (student.latentBase.selfRegulation * 0.12)
      + (student.latentBase.supportResponsiveness * 0.08)
      + (profile.readiness.logicReadiness * 0.06)
      + (profile.readiness.statsReadiness * 0.05)
      + (prereq * 0.18)
      + teaching
      - (difficulty * 0.22)
      + 0.06,
    0.22,
    0.96,
  )
  const attendancePct = clamp(
    Math.round(
      58
        + (student.latentBase.attendanceDiscipline * 30)
        + (student.latentBase.selfRegulation * 8)
        + (student.latentBase.supportResponsiveness * 4)
        + (profile.behavior.attendancePropensity * 6)
        - (difficulty * 8)
        + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-attendance`, -7, 9),
    ),
    52,
    98,
  )
  const tt1Pct = clamp(
    24
      + (mastery * 42)
      + (profile.assessment.termTestApplicationStrength * 16)
      + (profile.behavior.practiceCompliance * 8)
      - (profile.behavior.examPressure * 12)
      - (difficulty * 7)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-tt1`, -14, 12),
    8,
    97,
  )
  const tt2Pct = clamp(
    tt1Pct
      + (profile.dynamics.relearnRate * 8)
      + (profile.behavior.helpSeekingTendency * 5)
      - (profile.dynamics.forgetRate * 4)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-tt2`, -12, 14),
    8,
    99,
  )
  const quizPct = clamp(
    22
      + (mastery * 38)
      + (profile.assessment.quizRecallStrength * 20)
      + (profile.behavior.selfCheckTendency * 7)
      - (difficulty * 5)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-quiz`, -14, 12),
    8,
    99,
  )
  const assignmentBase = isLabLikeCourse(course)
    ? profile.assessment.labExecutionStrength
    : profile.assessment.assignmentCompletionStrength
  const assignmentPct = clamp(
    24
      + (mastery * 34)
      + (assignmentBase * 18)
      + (profile.behavior.deadlineDiscipline * 8)
      + (profile.behavior.courseworkReliability * 6)
      - (difficulty * 4)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-assignment`, -12, 12),
    10,
    99,
  )
  const cePct = clamp(
    (tt1Pct * 0.28)
      + (tt2Pct * 0.27)
      + (quizPct * 0.2)
      + (assignmentPct * 0.25)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-ce`, -6, 6),
    10,
    97,
  )
  const seePct = clamp(
    18
      + (mastery * 46)
      + (profile.assessment.seeEndurance * 18)
      + (profile.dynamics.transferGainRate * 10)
      - (profile.behavior.examPressure * 10)
      - (difficulty * 9)
      + stableBetween(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-see`, -14, 12),
    8,
    98,
  )
  const ceMark = roundToTwo((cePct / 100) * policy.passRules.ceMaximum)
  const seeMark = roundToTwo((seePct / 100) * policy.passRules.seeMaximum)
  const condoned = attendancePct >= policy.condonationRules.minimumPercent
    && attendancePct < policy.attendanceRules.minimumPercent
    && stableUnit(`run-${runSeed}-${student.studentId}-${course.internalCompilerId}-condonation`) > 0.42
  const decision = evaluateCourseStatus({
    attendancePercent: attendancePct,
    ceMark,
    seeMark,
    condoned,
    policy,
  })
  const attendanceHistory = buildAttendanceHistory({
    attendancePct,
    student,
    course,
    semesterNumber,
    runSeed,
  })
  return {
    attendancePct,
    attendanceHistory,
    tt1Pct: roundToTwo(tt1Pct),
    tt2Pct: roundToTwo(tt2Pct),
    quizPct: roundToTwo(quizPct),
    assignmentPct: roundToTwo(assignmentPct),
    cePct: roundToTwo(cePct),
    seePct: roundToTwo(seePct),
    ceMark,
    seeMark,
    overallMark: decision.overallRounded,
    gradeLabel: decision.gradeLabel,
    gradePoint: decision.gradePoint,
    result: decision.result,
    condoned,
    prerequisiteCarryoverRisk: roundToTwo(clamp((1 - prereq) + (difficulty * 0.18) - (mastery * 0.12), 0.02, 0.92)),
    courseworkToTtGap: roundToTwo(((quizPct + assignmentPct) / 2) - ((tt1Pct + tt2Pct) / 2)),
    ttMomentum: roundToTwo(tt2Pct - tt1Pct),
    latentSummary: {
      mastery: roundToTwo(mastery),
      prereq: roundToTwo(prereq),
      teaching: roundToTwo(teaching),
      difficulty: roundToTwo(difficulty),
    },
  }
}

function buildTimetablePayload(loadsByFacultyId: Map<string, Array<{ offeringId: string; courseCode: string; courseName: string; sectionCode: string; semesterNumber: number; weeklyHours: number }>>) {
  return sharedBuildFacultyTimetableTemplates(loadsByFacultyId)
}

function normalizeFilterValue(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized.toLowerCase() : null
}

function matchesTextFilter(value: string | null | undefined, filter?: string | null) {
  const normalizedFilter = normalizeFilterValue(filter)
  if (!normalizedFilter) return true
  return normalizeFilterValue(value) === normalizedFilter
}

function isOpenReassessmentStatus(status: string | null | undefined) {
  const normalized = normalizeFilterValue(status)
  return normalized !== 'completed' && normalized !== 'closed' && normalized !== 'resolved' && normalized !== 'monitoring-only'
}

export const PROOF_REASSESSMENT_RESOLUTION_OUTCOMES = [
  'completed_awaiting_evidence',
  'completed_improving',
  'not_completed',
  'no_show',
  'switch_intervention',
  'administratively_closed',
] as const

type ProofReassessmentResolutionOutcome = (typeof PROOF_REASSESSMENT_RESOLUTION_OUTCOMES)[number]
export type ProofRecoveryState = 'under_watch' | 'confirmed_improvement'

const PROOF_REASSESSMENT_TEMPORARY_RESPONSE_CREDIT: Record<ProofReassessmentResolutionOutcome, number> = {
  completed_awaiting_evidence: 0.02,
  completed_improving: 0.05,
  not_completed: -0.05,
  no_show: -0.08,
  switch_intervention: -0.01,
  administratively_closed: 0,
}

export function proofTemporaryResponseCreditForOutcome(outcome: string | null | undefined) {
  return outcome && outcome in PROOF_REASSESSMENT_TEMPORARY_RESPONSE_CREDIT
    ? PROOF_REASSESSMENT_TEMPORARY_RESPONSE_CREDIT[outcome as ProofReassessmentResolutionOutcome]
    : 0
}

export function proofRecoveryStateForOutcome(outcome: string | null | undefined): ProofRecoveryState {
  return outcome === 'completed_improving' ? 'confirmed_improvement' : 'under_watch'
}

function interventionAcceptedFromResponseState(responseState: Record<string, unknown>) {
  if (typeof responseState.accepted === 'boolean') return responseState.accepted
  if (typeof responseState.interventionOfferFlag === 'boolean') {
    return Boolean(responseState.interventionOfferFlag) && Number(responseState.interventionAcceptanceProb ?? 0) > 0
  }
  return null
}

function interventionCompletedFromResponseState(responseState: Record<string, unknown>) {
  if (typeof responseState.completed === 'boolean') return responseState.completed
  if (typeof responseState.interventionCompletionProb === 'number') {
    return Number(responseState.interventionCompletionProb) >= 0.5
  }
  return null
}

function interventionRecoveryConfirmedFromResponseState(responseState: Record<string, unknown>) {
  if (typeof responseState.recoveryConfirmed === 'boolean') return responseState.recoveryConfirmed
  if (typeof responseState.recoveryConfirmedFlag === 'boolean') return responseState.recoveryConfirmedFlag
  return null
}

function interventionObservedResidualFromResponseState(responseState: Record<string, unknown>) {
  if (Number.isFinite(Number(responseState.residual))) return Number(responseState.residual)
  if (Number.isFinite(Number(responseState.observedVsExpectedResidual))) return Number(responseState.observedVsExpectedResidual)
  return null
}

export function proofResolutionPayloadFromRow(row: (typeof reassessmentResolutions.$inferSelect) | null | undefined) {
  return row?.resolutionJson ? parseJson(row.resolutionJson, {} as Record<string, unknown>) : {}
}

function proofTemporaryResponseCreditFromResolutionRow(
  row: (typeof reassessmentResolutions.$inferSelect) | null | undefined,
  observedUpdatedAt?: string | null,
) {
  if (!row) return 0
  if (observedUpdatedAt && observedUpdatedAt > row.createdAt) return 0
  const payload = proofResolutionPayloadFromRow(row)
  if (Number.isFinite(Number(payload.temporaryResponseCredit))) return Number(payload.temporaryResponseCredit)
  return proofTemporaryResponseCreditForOutcome(typeof payload.outcome === 'string' ? payload.outcome : row.resolutionStatus)
}

function proofRecoveryStateFromResolutionRow(row: (typeof reassessmentResolutions.$inferSelect) | null | undefined): ProofRecoveryState | null {
  if (!row) return null
  const payload = proofResolutionPayloadFromRow(row)
  if (payload.recoveryState === 'confirmed_improvement' || payload.recoveryState === 'under_watch') {
    return payload.recoveryState
  }
  return proofRecoveryStateForOutcome(typeof payload.outcome === 'string' ? payload.outcome : row.resolutionStatus)
}

function liveInterventionResponseScoreFromPayload(input: {
  payload: Record<string, unknown>
  observedUpdatedAt?: string | null
  resolutionRow?: typeof reassessmentResolutions.$inferSelect | null
}) {
  const responseState = input.payload.interventionResponse && typeof input.payload.interventionResponse === 'object'
    ? input.payload.interventionResponse as Record<string, unknown>
    : null
  const baseResidual = responseState ? interventionObservedResidualFromResponseState(responseState) : null
  const temporaryCredit = proofTemporaryResponseCreditFromResolutionRow(input.resolutionRow ?? null, input.observedUpdatedAt ?? null)
  if (baseResidual == null && temporaryCredit === 0) return null
  return roundToTwo((baseResidual ?? 0) + temporaryCredit)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pctRiskProxy(pct: number | null | undefined) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0.5
  return clamp((100 - pct) / 100, 0, 1)
}

function observableSectionPressureFromEvidence(evidence: {
  attendancePct: number | null | undefined
  tt1Pct: number | null | undefined
  tt2Pct: number | null | undefined
  seePct: number | null | undefined
  weakCoCount: number | null | undefined
  weakQuestionCount: number | null | undefined
}) {
  return roundToTwo(average([
    pctRiskProxy(evidence.attendancePct),
    pctRiskProxy(evidence.tt1Pct),
    pctRiskProxy(evidence.tt2Pct),
    pctRiskProxy(evidence.seePct),
    clamp(Number(evidence.weakCoCount ?? 0) / 4, 0, 1),
    clamp(Number(evidence.weakQuestionCount ?? 0) / 6, 0, 1),
  ]))
}

function displayableHeadProbabilityScaled(
  inferred: ModelBackedRiskOutput | null,
  headKey: RiskHeadKey,
) {
  if (!inferred) return null
  if (inferred.headDisplay[headKey]?.displayProbabilityAllowed === false) return null
  return Math.round(inferred.headProbabilities[headKey] * 100)
}

function headDisplayState(
  inferred: ModelBackedRiskOutput | null,
  headKey: RiskHeadKey,
) {
  return inferred?.headDisplay[headKey] ?? null
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

function hoursBetween(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, (to - from) / (1000 * 60 * 60))
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set(Array.from(values).filter(Boolean))].sort()
}

function bucketBacklogCount(backlogCount: number) {
  if (backlogCount <= 0) return '0'
  if (backlogCount === 1) return '1'
  if (backlogCount === 2) return '2'
  return '3+'
}

function buildEvidenceTimelineFromRows(rows: Array<typeof studentObservedSemesterStates.$inferSelect>) {
  const groupedBySemester = new Map<number, Array<typeof studentObservedSemesterStates.$inferSelect>>()
  rows.forEach(row => {
    groupedBySemester.set(row.semesterNumber, [...(groupedBySemester.get(row.semesterNumber) ?? []), row])
  })

  return [...groupedBySemester.entries()]
    .sort(([leftSemester], [rightSemester]) => leftSemester - rightSemester)
    .map(([, semesterRows]) => {
      const baseRow = semesterRows[0]
      if (!baseRow) throw new Error('Expected a grouped semester evidence row')
      if (semesterRows.length === 1) {
        return {
          studentObservedSemesterStateId: baseRow.studentObservedSemesterStateId,
          semesterNumber: baseRow.semesterNumber,
          termId: baseRow.termId,
          sectionCode: baseRow.sectionCode,
          observedState: parseObservedStateRow(baseRow),
          createdAt: baseRow.createdAt,
          updatedAt: baseRow.updatedAt,
        }
      }

      const parsedRows = semesterRows.map(row => ({
        studentObservedSemesterStateId: row.studentObservedSemesterStateId,
        termId: row.termId,
        sectionCode: row.sectionCode,
        observedState: parseObservedStateRow(row),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
      const latestRow = semesterRows.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? baseRow
      const latestState = parseObservedStateRow(latestRow)
      const uniqueRiskBands = [...new Set(parsedRows.map(row => {
        const riskBand = row.observedState.riskBand
        return typeof riskBand === 'string' && riskBand.length > 0 ? riskBand : 'Unknown'
      }))]

      return {
        studentObservedSemesterStateId: baseRow.studentObservedSemesterStateId,
        semesterNumber: baseRow.semesterNumber,
        termId: baseRow.termId,
        sectionCode: baseRow.sectionCode,
        observedState: {
          ...latestState,
          evidenceWindowCount: parsedRows.length,
          evidenceWindows: parsedRows.map(row => ({
            studentObservedSemesterStateId: row.studentObservedSemesterStateId,
            termId: row.termId,
            sectionCode: row.sectionCode,
            observedState: row.observedState,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
          riskBands: uniqueRiskBands,
        },
        createdAt: baseRow.createdAt,
        updatedAt: latestRow.updatedAt,
      }
    })
}

type AttendanceHistoryEntry = {
  checkpoint: string
  checkpointLabel: string
  presentClasses: number
  totalClasses: number
  attendancePct: number
}

export type StageCourseProjectionSource = {
  studentId: string
  studentName: string
  usn: string
  semesterNumber: number
  sectionCode: string
  termId: string | null
  offeringId: string | null
  curriculumNodeId: string | null
  courseCode: string
  courseTitle: string
  courseFamily: string
  attendanceHistory: AttendanceHistoryEntry[]
  attendancePct: number
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  cePct: number
  seePct: number
  finalMark: number
  result: string
  previousCgpa: number
  previousBacklogCount: number
  closingCgpa: number
  closingBacklogCount: number
  questionRows: Array<typeof studentQuestionResults.$inferSelect>
  coRows: Array<typeof studentCoStates.$inferSelect>
  interventionResponse: {
    interventionType: string
    accepted: boolean
    completed: boolean
    recoveryConfirmed: boolean
    residual: number | null
  } | null
}

export type StageEvidenceSnapshot = {
  attendancePct: number
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  seePct: number | null
  weakCoCount: number
  weakQuestionCount: number
  attentionAreas: string[]
  attendanceHistoryRiskCount: number
  currentCgpa: number
  backlogCount: number
  interventionResponseScore: number | null
  evidenceWindow: string
  weakCourseOutcomes: Array<{
    coCode: string
    coTitle: string
    trend: string
    topics: string[]
    evidenceMode: string
    tt1Pct: number
    tt2Pct: number
    seePct: number
    transferGap: number
  }>
  questionPatterns: ReturnType<typeof summarizeQuestionPatterns>
}

export type PolicyPhenotype =
  | 'attendance-dominant'
  | 'prerequisite-dominant'
  | 'academic-weakness'
  | 'persistent-nonresponse'
  | 'late-semester-acute'
  | 'diffuse-amber'

export {
  buildPolicyDiagnostics,
  ceMinimumPctForPolicy,
  ceShortfallLabelFromPct,
  classifyPolicyPhenotype,
  mergePolicyDiagnostics,
  stageCourseworkEvidenceForStage,
}

type ActiveRiskArtifacts = {
  production: ProductionRiskModelArtifact | null
  correlations: CorrelationArtifact | null
  evaluation: Record<string, unknown> | null
}

function governedRunStatusRank(status: typeof simulationRuns.$inferSelect.status) {
  switch (status) {
    case 'active':
      return 0
    case 'completed':
      return 1
    case 'ready':
      return 2
    case 'draft':
      return 3
    case 'archived':
      return 4
    default:
      return 5
  }
}

function compareGovernedCorpusRuns(
  left: typeof simulationRuns.$inferSelect,
  right: typeof simulationRuns.$inferSelect,
) {
  if (left.activeFlag !== right.activeFlag) return right.activeFlag - left.activeFlag
  const statusDelta = governedRunStatusRank(left.status) - governedRunStatusRank(right.status)
  if (statusDelta !== 0) return statusDelta
  if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt)
  if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt)
  return left.simulationRunId.localeCompare(right.simulationRunId)
}

function selectGovernedCorpusRuns(
  runRows: Array<typeof simulationRuns.$inferSelect>,
  manifest = PROOF_CORPUS_MANIFEST,
  completeRunIds?: ReadonlySet<string>,
) {
  const manifestBySeed = new Map(manifest.map(entry => [entry.seed, entry]))
  const manifestCandidatesBySeed = new Map<number, Array<typeof simulationRuns.$inferSelect>>()
  runRows.forEach(row => {
    if (!manifestBySeed.has(row.seed)) return
    if (completeRunIds && !completeRunIds.has(row.simulationRunId)) return
    manifestCandidatesBySeed.set(row.seed, [...(manifestCandidatesBySeed.get(row.seed) ?? []), row])
  })

  const selectedRunRows = manifest
    .map(entry => {
      const candidates = manifestCandidatesBySeed.get(entry.seed) ?? []
      return candidates.slice().sort(compareGovernedCorpusRuns)[0] ?? null
    })
    .filter((row): row is typeof simulationRuns.$inferSelect => !!row)
  const selectedRunIds = new Set(selectedRunRows.map(row => row.simulationRunId))
  const skippedNonManifestRunIds = runRows
    .filter(row => !manifestBySeed.has(row.seed))
    .map(row => row.simulationRunId)
    .sort()
  const skippedDuplicateManifestRunIds = runRows
    .filter(row => manifestBySeed.has(row.seed) && !selectedRunIds.has(row.simulationRunId))
    .map(row => row.simulationRunId)
    .sort()
  const skippedIncompleteManifestRunIds = completeRunIds
    ? runRows
      .filter(row => manifestBySeed.has(row.seed) && !completeRunIds.has(row.simulationRunId))
      .map(row => row.simulationRunId)
      .sort()
    : []

  return {
    manifestBySeed,
    selectedRunRows,
    skippedNonManifestRunIds,
    skippedDuplicateManifestRunIds,
    skippedIncompleteManifestRunIds,
  }
}

async function loadActiveProofRiskArtifacts(db: AppDb, batchId: string): Promise<ActiveRiskArtifacts> {
  const rows = await db.select().from(riskModelArtifacts).where(eq(riskModelArtifacts.batchId, batchId)).orderBy(desc(riskModelArtifacts.createdAt))
  const activeRows = rows.filter(row => row.activeFlag === 1 && row.status === 'active')
  const productionRow = activeRows.find(row => row.artifactType === 'production') ?? null
  const correlationRow = activeRows.find(row => row.artifactType === 'correlation') ?? null
  return {
    production: productionRow ? parseJson(productionRow.payloadJson, null as ProductionRiskModelArtifact | null) : null,
    correlations: correlationRow ? parseJson(correlationRow.payloadJson, null as CorrelationArtifact | null) : null,
    evaluation: productionRow ? parseJson(productionRow.evaluationJson, {} as Record<string, unknown>) : null,
  }
}

async function rebuildProofRiskArtifacts(db: AppDb, input: {
  batchId: string
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
}) {
  const [runRows, checkpointCountRows, stageEvidenceCountRows] = await Promise.all([
    db.select().from(simulationRuns).where(eq(simulationRuns.batchId, input.batchId)),
    db.select({
      simulationRunId: simulationStageCheckpoints.simulationRunId,
      checkpointCount: count(),
    }).from(simulationStageCheckpoints).groupBy(simulationStageCheckpoints.simulationRunId),
    db.select({
      simulationRunId: riskEvidenceSnapshots.simulationRunId,
      evidenceCount: count(),
    }).from(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.batchId, input.batchId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
    )).groupBy(riskEvidenceSnapshots.simulationRunId),
  ])
  const checkpointCountByRunId = new Map<string, number>()
  checkpointCountRows.forEach(row => {
    checkpointCountByRunId.set(row.simulationRunId, Number(row.checkpointCount))
  })
  const stageEvidenceCountByRunId = new Map<string, number>()
  stageEvidenceCountRows.forEach(row => {
    if (!row.simulationRunId) return
    stageEvidenceCountByRunId.set(row.simulationRunId, Number(row.evidenceCount))
  })
  const completeRunIds = new Set(
    runRows
      .filter(row => {
        const semesterSpan = Math.max(1, row.semesterEnd - row.semesterStart + 1)
        const expectedCheckpointCount = PLAYBACK_STAGE_DEFS.length * semesterSpan
        return (checkpointCountByRunId.get(row.simulationRunId) ?? 0) >= expectedCheckpointCount
          && (stageEvidenceCountByRunId.get(row.simulationRunId) ?? 0) > 0
      })
      .map(row => row.simulationRunId),
  )
  const {
    manifestBySeed,
    selectedRunRows: governedRunRows,
    skippedNonManifestRunIds,
    skippedDuplicateManifestRunIds,
    skippedIncompleteManifestRunIds,
  } = selectGovernedCorpusRuns(runRows, PROOF_CORPUS_MANIFEST, completeRunIds)
  const skippedSimulationRunIds = [...skippedNonManifestRunIds, ...skippedDuplicateManifestRunIds, ...skippedIncompleteManifestRunIds].sort()

  const runMetadataById = new Map<string, ProofRunModelMetadata>(
    governedRunRows.map(row => {
      const manifestEntry = manifestBySeed.get(row.seed)
      const metrics = parseJson(row.metricsJson, {} as Record<string, unknown>)
      const scenarioFamily = manifestEntry?.scenarioFamily ?? (
        typeof metrics.scenarioFamily === 'string'
          ? metrics.scenarioFamily as ProofRunModelMetadata['scenarioFamily']
          : scenarioFamilyForSeed(row.seed)
      )
      return [row.simulationRunId, {
        simulationRunId: row.simulationRunId,
        seed: row.seed,
        split: manifestEntry?.split,
        scenarioFamily,
      }]
    }),
  )
  const governedRunIds = new Set(runMetadataById.keys())
  if (governedRunIds.size === 0) return null

  const trainer = createProofRiskModelTrainingBuilder({
    runMetadataById,
    manifest: PROOF_CORPUS_MANIFEST,
  })
  const governedRunIdList = [...governedRunIds].sort()
  const governedCoEvidenceDiagnosticsPages: Array<ReturnType<typeof buildCoEvidenceDiagnosticsFromRows>> = []
  let lastEvidenceSnapshotId: string | null = null
  for (;;) {
    const conditions = [
      eq(riskEvidenceSnapshots.batchId, input.batchId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
      inArray(riskEvidenceSnapshots.simulationRunId, governedRunIdList),
    ]
    if (lastEvidenceSnapshotId) conditions.push(gt(riskEvidenceSnapshots.riskEvidenceSnapshotId, lastEvidenceSnapshotId))
    const page = await db.select({
      riskEvidenceSnapshotId: riskEvidenceSnapshots.riskEvidenceSnapshotId,
      semesterNumber: riskEvidenceSnapshots.semesterNumber,
      featureJson: riskEvidenceSnapshots.featureJson,
      labelJson: riskEvidenceSnapshots.labelJson,
      sourceRefsJson: riskEvidenceSnapshots.sourceRefsJson,
    }).from(riskEvidenceSnapshots).where(and(...conditions)).orderBy(
      asc(riskEvidenceSnapshots.riskEvidenceSnapshotId),
    ).limit(RISK_ARTIFACT_REBUILD_PAGE_SIZE)
    if (page.length === 0) break
    trainer.addSerializedRows(page.map(row => ({
      featureJson: row.featureJson,
      labelJson: row.labelJson,
      sourceRefsJson: row.sourceRefsJson,
    })))
    governedCoEvidenceDiagnosticsPages.push(buildCoEvidenceDiagnosticsFromRows(page.map(row => {
      const sourceRefs = parseJson(row.sourceRefsJson, {} as Record<string, unknown>)
      return {
        semesterNumber: row.semesterNumber,
        courseFamily: typeof sourceRefs.courseFamily === 'string' ? sourceRefs.courseFamily : null,
        coEvidenceMode: typeof sourceRefs.coEvidenceMode === 'string' ? sourceRefs.coEvidenceMode : null,
      }
    })))
    lastEvidenceSnapshotId = page[page.length - 1]?.riskEvidenceSnapshotId ?? null
  }

  const bundle = trainer.build(input.now)
  if (!bundle) return null

  const evaluation = {
    ...summarizeProofRiskModelEvaluation(bundle),
    governedRunCount: governedRunRows.length,
    skippedRunCount: skippedSimulationRunIds.length,
    skippedNonManifestRunCount: skippedNonManifestRunIds.length,
    skippedDuplicateManifestRunCount: skippedDuplicateManifestRunIds.length,
    skippedIncompleteManifestRunCount: skippedIncompleteManifestRunIds.length,
    skippedSimulationRunIds,
    skippedNonManifestRunIds,
    skippedDuplicateManifestRunIds,
    skippedIncompleteManifestRunIds,
  }
  const productionEvaluationPayload: Record<string, unknown> = {
    ...(evaluation.production as Record<string, unknown>),
    governedRunCount: evaluation.governedRunCount,
    skippedRunCount: evaluation.skippedRunCount,
    skippedNonManifestRunCount: evaluation.skippedNonManifestRunCount,
    skippedDuplicateManifestRunCount: evaluation.skippedDuplicateManifestRunCount,
    skippedIncompleteManifestRunCount: evaluation.skippedIncompleteManifestRunCount,
    skippedSimulationRunIds: evaluation.skippedSimulationRunIds,
    skippedNonManifestRunIds: evaluation.skippedNonManifestRunIds,
    skippedDuplicateManifestRunIds: evaluation.skippedDuplicateManifestRunIds,
    skippedIncompleteManifestRunIds: evaluation.skippedIncompleteManifestRunIds,
  }
  const challengerEvaluationPayload: Record<string, unknown> = {
    ...(evaluation.challenger as Record<string, unknown>),
    governedRunCount: evaluation.governedRunCount,
    skippedRunCount: evaluation.skippedRunCount,
    skippedNonManifestRunCount: evaluation.skippedNonManifestRunCount,
    skippedDuplicateManifestRunCount: evaluation.skippedDuplicateManifestRunCount,
    skippedIncompleteManifestRunCount: evaluation.skippedIncompleteManifestRunCount,
    skippedSimulationRunIds: evaluation.skippedSimulationRunIds,
    skippedNonManifestRunIds: evaluation.skippedNonManifestRunIds,
    skippedDuplicateManifestRunIds: evaluation.skippedDuplicateManifestRunIds,
    skippedIncompleteManifestRunIds: evaluation.skippedIncompleteManifestRunIds,
  }
  const [stageStudentRows, checkpointRows] = await Promise.all([
    db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId)),
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)),
  ])
  const coEvidenceRows = [] as Array<{
    semesterNumber: number
    courseFamily?: string | null
    coEvidenceMode?: string | null
  }>
  let lastTargetEvidenceSnapshotId: string | null = null
  for (;;) {
    const conditions = [
      eq(riskEvidenceSnapshots.batchId, input.batchId),
      eq(riskEvidenceSnapshots.simulationRunId, input.simulationRunId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
    ]
    if (lastTargetEvidenceSnapshotId) conditions.push(gt(riskEvidenceSnapshots.riskEvidenceSnapshotId, lastTargetEvidenceSnapshotId))
    const page = await db.select({
      riskEvidenceSnapshotId: riskEvidenceSnapshots.riskEvidenceSnapshotId,
      semesterNumber: riskEvidenceSnapshots.semesterNumber,
      sourceRefsJson: riskEvidenceSnapshots.sourceRefsJson,
    }).from(riskEvidenceSnapshots).where(and(...conditions)).orderBy(
      asc(riskEvidenceSnapshots.riskEvidenceSnapshotId),
    ).limit(RISK_ARTIFACT_REBUILD_PAGE_SIZE)
    if (page.length === 0) break
    page.forEach(row => {
      const sourceRefs = parseJson(row.sourceRefsJson, {} as Record<string, unknown>)
      coEvidenceRows.push({
        semesterNumber: row.semesterNumber,
        courseFamily: typeof sourceRefs.courseFamily === 'string' ? sourceRefs.courseFamily : null,
        coEvidenceMode: typeof sourceRefs.coEvidenceMode === 'string' ? sourceRefs.coEvidenceMode : null,
      })
    })
    lastTargetEvidenceSnapshotId = page[page.length - 1]?.riskEvidenceSnapshotId ?? null
  }
  const uiParityPolicyDiagnostics = buildPolicyDiagnostics({
    checkpointRows,
    studentRows: stageStudentRows,
  })
  const uiParityCoEvidenceDiagnostics = buildCoEvidenceDiagnosticsFromRows(coEvidenceRows)
  const perRunDiagnostics: Array<NonNullable<ReturnType<typeof buildPolicyDiagnostics>>> = []
  for (let i = 0; i < governedRunRows.length; i += 4) {
    const chunk = governedRunRows.slice(i, i + 4)
    const diags = await Promise.all(chunk.map(async runRow => {
      const [runStudentRows, runCheckpointRows] = await Promise.all([
        db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, runRow.simulationRunId)),
        db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, runRow.simulationRunId)),
      ])
      return buildPolicyDiagnostics({
        checkpointRows: runCheckpointRows,
        studentRows: runStudentRows,
      })
    }))
    for (const diag of diags) {
      if (diag) perRunDiagnostics.push(diag)
    }
  }
  const governedPolicyDiagnostics = mergePolicyDiagnostics(perRunDiagnostics)
  const governedCoEvidenceDiagnostics = mergeCoEvidenceDiagnostics(governedCoEvidenceDiagnosticsPages)
  const uiParityDiagnostics = {
    activeRunId: input.simulationRunId,
    policyDiagnostics: uiParityPolicyDiagnostics,
    coEvidenceDiagnostics: uiParityCoEvidenceDiagnostics,
  }
  productionEvaluationPayload.policyDiagnostics = governedPolicyDiagnostics
  productionEvaluationPayload.coEvidenceDiagnostics = governedCoEvidenceDiagnostics
  productionEvaluationPayload.uiParityDiagnostics = uiParityDiagnostics
  challengerEvaluationPayload.policyDiagnostics = governedPolicyDiagnostics
  challengerEvaluationPayload.coEvidenceDiagnostics = governedCoEvidenceDiagnostics
  challengerEvaluationPayload.uiParityDiagnostics = uiParityDiagnostics
  const existingRows = await db.select().from(riskModelArtifacts).where(eq(riskModelArtifacts.batchId, input.batchId))
  const targetRun = runRows.find(row => row.simulationRunId === input.simulationRunId) ?? null
  if (existingRows.length > 0) {
    const activeArtifactIds = existingRows.filter(row => row.activeFlag === 1).map(row => row.riskModelArtifactId)
    if (activeArtifactIds.length > 0) {
      await db.update(riskModelArtifacts).set({
        activeFlag: 0,
        updatedAt: input.now,
      }).where(inArray(riskModelArtifacts.riskModelArtifactId, activeArtifactIds))
    }
  }

  await db.insert(riskModelArtifacts).values([
    {
      riskModelArtifactId: createId('risk_model_artifact'),
      batchId: input.batchId,
      simulationRunId: input.simulationRunId,
      curriculumFeatureProfileId: targetRun?.curriculumFeatureProfileId ?? null,
      curriculumFeatureProfileFingerprint: targetRun?.curriculumFeatureProfileFingerprint ?? null,
      artifactType: 'production',
      modelFamily: 'logistic-scorecard',
      artifactVersion: bundle.production.modelVersion,
      featureSchemaVersion: bundle.production.featureSchemaVersion,
      sourceRunIdsJson: JSON.stringify(governedRunRows.map(row => row.simulationRunId)),
      payloadJson: JSON.stringify(bundle.production),
      evaluationJson: JSON.stringify(productionEvaluationPayload),
      status: 'active',
      activeFlag: 1,
      createdByFacultyId: input.actorFacultyId ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    },
    {
      riskModelArtifactId: createId('risk_model_artifact'),
      batchId: input.batchId,
      simulationRunId: input.simulationRunId,
      curriculumFeatureProfileId: targetRun?.curriculumFeatureProfileId ?? null,
      curriculumFeatureProfileFingerprint: targetRun?.curriculumFeatureProfileFingerprint ?? null,
      artifactType: 'challenger',
      modelFamily: 'decision-stump',
      artifactVersion: bundle.challenger.modelVersion,
      featureSchemaVersion: bundle.challenger.featureSchemaVersion,
      sourceRunIdsJson: JSON.stringify(governedRunRows.map(row => row.simulationRunId)),
      payloadJson: JSON.stringify(bundle.challenger),
      evaluationJson: JSON.stringify(challengerEvaluationPayload),
      status: 'active',
      activeFlag: 1,
      createdByFacultyId: input.actorFacultyId ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    },
    {
      riskModelArtifactId: createId('risk_model_artifact'),
      batchId: input.batchId,
      simulationRunId: input.simulationRunId,
      curriculumFeatureProfileId: targetRun?.curriculumFeatureProfileId ?? null,
      curriculumFeatureProfileFingerprint: targetRun?.curriculumFeatureProfileFingerprint ?? null,
      artifactType: 'correlation',
      modelFamily: 'association-summary',
      artifactVersion: bundle.correlations.artifactVersion,
      featureSchemaVersion: bundle.correlations.featureSchemaVersion,
      sourceRunIdsJson: JSON.stringify(governedRunRows.map(row => row.simulationRunId)),
      payloadJson: JSON.stringify(bundle.correlations),
      evaluationJson: JSON.stringify(evaluation.correlations),
      status: 'active',
      activeFlag: 1,
      createdByFacultyId: input.actorFacultyId ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    },
  ])
  return bundle
}

export async function getProofRiskModelDiagnostics(db: AppDb, input: {
  batchId: string
  simulationRunId?: string | null
}) {
  const [artifactRows, runRows, totalStageEvidenceRows, sourceRunRows] = await Promise.all([
    db.select().from(riskModelArtifacts).where(eq(riskModelArtifacts.batchId, input.batchId)).orderBy(desc(riskModelArtifacts.createdAt)),
    db.select().from(simulationRuns).where(eq(simulationRuns.batchId, input.batchId)),
    db.select({
      count: count(),
    }).from(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.batchId, input.batchId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
    )),
    db.select({
      simulationRunId: riskEvidenceSnapshots.simulationRunId,
    }).from(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.batchId, input.batchId),
      isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
      isNotNull(riskEvidenceSnapshots.simulationRunId),
    )).groupBy(riskEvidenceSnapshots.simulationRunId),
  ])
  const activeRows = artifactRows.filter(row => row.activeFlag === 1 && row.status === 'active')
  const productionRow = activeRows.find(row => row.artifactType === 'production') ?? null
  const challengerRow = activeRows.find(row => row.artifactType === 'challenger') ?? null
  const correlationRow = activeRows.find(row => row.artifactType === 'correlation') ?? null
  const sourceRunCount = sourceRunRows.length
  const targetRunId = input.simulationRunId
    ?? runRows.find(row => row.activeFlag === 1)?.simulationRunId
    ?? runRows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.simulationRunId
    ?? null
  const [targetStageEvidenceRows, stageStudentRows, checkpointRows] = targetRunId
    ? await Promise.all([
        db.select({
          count: count(),
        }).from(riskEvidenceSnapshots).where(and(
          eq(riskEvidenceSnapshots.batchId, input.batchId),
          eq(riskEvidenceSnapshots.simulationRunId, targetRunId),
          isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
        )),
        db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, targetRunId)),
        db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, targetRunId)),
      ])
    : [[{ count: 0 }], [], []]
  const productionEvaluation = productionRow ? parseJson(productionRow.evaluationJson, {} as Record<string, unknown>) : null
  const challengerEvaluation = challengerRow ? parseJson(challengerRow.evaluationJson, {} as Record<string, unknown>) : null
  const correlationPayload = correlationRow ? parseJson(correlationRow.payloadJson, {} as Record<string, unknown>) : null
  const productionEvaluationRoot = productionEvaluation as Record<string, unknown> | null
  const productionEvaluationRecord = productionEvaluation?.production && typeof productionEvaluation.production === 'object'
    ? productionEvaluation.production as Record<string, unknown>
    : productionEvaluation
  const productionHeads = productionEvaluationRecord?.heads && typeof productionEvaluationRecord.heads === 'object'
    ? productionEvaluationRecord.heads as Record<string, Record<string, unknown>>
    : {}
  const primaryHead = productionHeads.overallCourseRisk ?? productionHeads.attendanceRisk ?? null
  const storedPolicyDiagnostics = productionEvaluationRecord?.policyDiagnostics ?? productionEvaluationRoot?.policyDiagnostics ?? null
  const storedCoEvidenceDiagnostics = productionEvaluationRecord?.coEvidenceDiagnostics ?? productionEvaluationRoot?.coEvidenceDiagnostics ?? null
  const storedUiParityDiagnostics = productionEvaluationRecord?.uiParityDiagnostics ?? productionEvaluationRoot?.uiParityDiagnostics ?? null
  const policyDiagnostics = storedPolicyDiagnostics ?? buildPolicyDiagnostics({
    checkpointRows,
    studentRows: stageStudentRows,
  })
  let coEvidenceDiagnostics = storedCoEvidenceDiagnostics
  if (!coEvidenceDiagnostics) {
    if (!targetRunId) {
      coEvidenceDiagnostics = buildCoEvidenceDiagnosticsFromRows([])
    } else {
      const targetRunEvidenceRows = await db.select({
        semesterNumber: riskEvidenceSnapshots.semesterNumber,
        sourceRefsJson: riskEvidenceSnapshots.sourceRefsJson,
      }).from(riskEvidenceSnapshots).where(and(
        eq(riskEvidenceSnapshots.batchId, input.batchId),
        eq(riskEvidenceSnapshots.simulationRunId, targetRunId),
        isNotNull(riskEvidenceSnapshots.simulationStageCheckpointId),
      ))
      coEvidenceDiagnostics = buildCoEvidenceDiagnosticsFromRows(targetRunEvidenceRows.map(row => {
        const sourceRefs = parseJson(row.sourceRefsJson, {} as Record<string, unknown>)
        return {
          semesterNumber: row.semesterNumber,
          courseFamily: typeof sourceRefs.courseFamily === 'string' ? sourceRefs.courseFamily : null,
          coEvidenceMode: typeof sourceRefs.coEvidenceMode === 'string' ? sourceRefs.coEvidenceMode : null,
        }
      }))
    }
  }
  const uiParityDiagnostics = storedUiParityDiagnostics ?? {
    activeRunId: targetRunId,
    policyDiagnostics: buildPolicyDiagnostics({
      checkpointRows,
      studentRows: stageStudentRows,
    }),
    coEvidenceDiagnostics,
  }
  return {
    featureRowCount: Number(totalStageEvidenceRows[0]?.count ?? 0),
    activeRunFeatureRowCount: targetRunId
      ? Number(targetStageEvidenceRows[0]?.count ?? 0)
      : 0,
    sourceRunCount,
    governedRunCount: typeof productionEvaluationRoot?.governedRunCount === 'number'
      ? productionEvaluationRoot.governedRunCount
      : null,
    skippedRunCount: typeof productionEvaluationRoot?.skippedRunCount === 'number'
      ? productionEvaluationRoot.skippedRunCount
      : null,
    skippedNonManifestRunCount: typeof productionEvaluationRoot?.skippedNonManifestRunCount === 'number'
      ? productionEvaluationRoot.skippedNonManifestRunCount
      : null,
    skippedDuplicateManifestRunCount: typeof productionEvaluationRoot?.skippedDuplicateManifestRunCount === 'number'
      ? productionEvaluationRoot.skippedDuplicateManifestRunCount
      : null,
    trainingManifestVersion: typeof productionEvaluationRecord?.trainingManifestVersion === 'string'
      ? productionEvaluationRecord.trainingManifestVersion
      : null,
    calibrationVersion: typeof productionEvaluationRecord?.calibrationVersion === 'string'
      ? productionEvaluationRecord.calibrationVersion
      : null,
    splitSummary: productionEvaluationRecord?.splitSummary ?? null,
    worldSplitSummary: productionEvaluationRecord?.worldSplitSummary ?? null,
    scenarioFamilySummary: productionEvaluationRecord?.scenarioFamilySummary ?? null,
    headSupportSummary: productionEvaluationRecord?.headSupportSummary ?? null,
    coEvidenceDiagnostics,
    policyDiagnostics,
    uiParityDiagnostics,
    displayProbabilityAllowed: typeof primaryHead?.displayProbabilityAllowed === 'boolean' ? primaryHead.displayProbabilityAllowed : null,
    supportWarning: typeof primaryHead?.supportWarning === 'string' ? primaryHead.supportWarning : null,
    production: productionRow
      ? {
        artifactVersion: productionRow.artifactVersion,
        modelFamily: productionRow.modelFamily,
        createdAt: productionRow.createdAt,
        governedRunCount: typeof productionEvaluationRoot?.governedRunCount === 'number'
          ? productionEvaluationRoot.governedRunCount
          : null,
        skippedRunCount: typeof productionEvaluationRoot?.skippedRunCount === 'number'
          ? productionEvaluationRoot.skippedRunCount
          : null,
        skippedNonManifestRunCount: typeof productionEvaluationRoot?.skippedNonManifestRunCount === 'number'
          ? productionEvaluationRoot.skippedNonManifestRunCount
          : null,
        skippedDuplicateManifestRunCount: typeof productionEvaluationRoot?.skippedDuplicateManifestRunCount === 'number'
          ? productionEvaluationRoot.skippedDuplicateManifestRunCount
          : null,
        trainingManifestVersion: typeof productionEvaluationRecord?.trainingManifestVersion === 'string'
          ? productionEvaluationRecord.trainingManifestVersion
          : null,
        calibrationVersion: typeof productionEvaluationRecord?.calibrationVersion === 'string'
          ? productionEvaluationRecord.calibrationVersion
          : null,
        splitSummary: productionEvaluationRecord?.splitSummary ?? null,
        worldSplitSummary: productionEvaluationRecord?.worldSplitSummary ?? null,
        scenarioFamilySummary: productionEvaluationRecord?.scenarioFamilySummary ?? null,
        headSupportSummary: productionEvaluationRecord?.headSupportSummary ?? null,
        coEvidenceDiagnostics,
        displayProbabilityAllowed: typeof primaryHead?.displayProbabilityAllowed === 'boolean' ? primaryHead.displayProbabilityAllowed : null,
        supportWarning: typeof primaryHead?.supportWarning === 'string' ? primaryHead.supportWarning : null,
        policyDiagnostics,
        uiParityDiagnostics,
        correlations: correlationPayload,
        evaluation: productionEvaluation ?? {},
      }
      : null,
    challenger: challengerRow
      ? {
        artifactVersion: challengerRow.artifactVersion,
        modelFamily: challengerRow.modelFamily,
        createdAt: challengerRow.createdAt,
        trainingManifestVersion: typeof (challengerEvaluation as Record<string, unknown> | null)?.trainingManifestVersion === 'string'
          ? (challengerEvaluation as Record<string, unknown>).trainingManifestVersion
          : null,
        splitSummary: (challengerEvaluation as Record<string, unknown> | null)?.splitSummary ?? null,
        worldSplitSummary: (challengerEvaluation as Record<string, unknown> | null)?.worldSplitSummary ?? null,
        scenarioFamilySummary: (challengerEvaluation as Record<string, unknown> | null)?.scenarioFamilySummary ?? null,
        headSupportSummary: (challengerEvaluation as Record<string, unknown> | null)?.headSupportSummary ?? null,
        coEvidenceDiagnostics,
        policyDiagnostics,
        uiParityDiagnostics,
        evaluation: challengerEvaluation ?? {},
      }
      : null,
    correlations: correlationRow
      ? correlationPayload
      : null,
  }
}

export async function getProofRiskModelActive(db: AppDb, input: {
  batchId: string
}) {
  const artifacts = await loadActiveProofRiskArtifacts(db, input.batchId)
  return {
    production: artifacts.production,
    evaluation: artifacts.evaluation,
  }
}

export async function getProofRiskModelCorrelations(db: AppDb, input: {
  batchId: string
}) {
  const artifacts = await loadActiveProofRiskArtifacts(db, input.batchId)
  return {
    correlations: artifacts.correlations,
  }
}

export async function getProofRiskModelEvaluation(db: AppDb, input: {
  batchId: string
  simulationRunId?: string | null
}) {
  return getProofRiskModelDiagnostics(db, input)
}

function courseFamilyBucket(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return 'general'
  if (/lab|project|workshop|practical/.test(normalized)) return 'lab-like'
  if (/theory/.test(normalized)) return 'theory-heavy'
  if (/mixed/.test(normalized)) return 'mixed'
  return normalized
}

export function buildCoEvidenceDiagnosticsFromRows(rows: Array<{
  semesterNumber: number
  courseFamily?: string | null
  coEvidenceMode?: string | null
}>) {
  const byMode: Record<string, number> = {}
  const bySemester: Record<string, Record<string, number>> = {}
  const byCourseFamily: Record<string, Record<string, number>> = {}
  let fallbackCount = 0
  let theoryFallbackCount = 0
  let labFallbackCount = 0
  rows.forEach(row => {
    const mode = String(row.coEvidenceMode ?? 'fallback-simulated')
    const semesterKey = `sem${row.semesterNumber}`
    const courseFamily = courseFamilyBucket(row.courseFamily)
    if (mode === 'fallback-simulated') {
      fallbackCount += 1
      if (courseFamily === 'lab-like') {
        labFallbackCount += 1
      } else {
        theoryFallbackCount += 1
      }
    }
    byMode[mode] = (byMode[mode] ?? 0) + 1
    bySemester[semesterKey] = bySemester[semesterKey] ?? {}
    bySemester[semesterKey]![mode] = (bySemester[semesterKey]![mode] ?? 0) + 1
    byCourseFamily[courseFamily] = byCourseFamily[courseFamily] ?? {}
    byCourseFamily[courseFamily]![mode] = (byCourseFamily[courseFamily]![mode] ?? 0) + 1
  })
  return {
    totalRows: rows.length,
    fallbackCount,
    theoryFallbackCount,
    labFallbackCount,
    byMode,
    bySemester,
    byCourseFamily,
    acceptanceGates: {
      theoryCoursesDefaultToBlueprintEvidence: theoryFallbackCount === 0,
      fallbackOnlyInExplicitCases: fallbackCount === 0,
    },
  }
}

function mergeCountRecord(target: Record<string, number>, source: Record<string, unknown> | null | undefined) {
  Object.entries(source ?? {}).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + Number(value ?? 0)
  })
}

function mergeNestedCountRecord(target: Record<string, Record<string, number>>, source: Record<string, unknown> | null | undefined) {
  Object.entries(source ?? {}).forEach(([outerKey, outerValue]) => {
    const bucket = target[outerKey] ?? {}
    Object.entries((outerValue as Record<string, unknown> | null | undefined) ?? {}).forEach(([innerKey, innerValue]) => {
      bucket[innerKey] = (bucket[innerKey] ?? 0) + Number(innerValue ?? 0)
    })
    target[outerKey] = bucket
  })
}

export function mergeCoEvidenceDiagnostics(
  summaries: Array<ReturnType<typeof buildCoEvidenceDiagnosticsFromRows> | null | undefined>,
) {
  const valid = summaries.filter((summary): summary is ReturnType<typeof buildCoEvidenceDiagnosticsFromRows> => !!summary)
  if (valid.length === 0) return buildCoEvidenceDiagnosticsFromRows([])
  const byMode: Record<string, number> = {}
  const bySemester: Record<string, Record<string, number>> = {}
  const byCourseFamily: Record<string, Record<string, number>> = {}
  let totalRows = 0
  let fallbackCount = 0
  let theoryFallbackCount = 0
  let labFallbackCount = 0
  valid.forEach(summary => {
    totalRows += Number(summary.totalRows ?? 0)
    fallbackCount += Number(summary.fallbackCount ?? 0)
    theoryFallbackCount += Number(summary.theoryFallbackCount ?? 0)
    labFallbackCount += Number(summary.labFallbackCount ?? 0)
    mergeCountRecord(byMode, summary.byMode as Record<string, unknown> | undefined)
    mergeNestedCountRecord(bySemester, summary.bySemester as Record<string, unknown> | undefined)
    mergeNestedCountRecord(byCourseFamily, summary.byCourseFamily as Record<string, unknown> | undefined)
  })
  return {
    totalRows,
    fallbackCount,
    theoryFallbackCount,
    labFallbackCount,
    byMode,
    bySemester,
    byCourseFamily,
    acceptanceGates: {
      theoryCoursesDefaultToBlueprintEvidence: theoryFallbackCount === 0,
      fallbackOnlyInExplicitCases: fallbackCount === 0,
    },
  }
}


export async function rebuildSimulationStagePlayback(db: AppDb, input: {
  simulationRunId: string
  policy: ResolvedPolicy
  now: string
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const activeRiskArtifacts = await loadActiveProofRiskArtifacts(db, run.batchId)

  await resetPlaybackStageArtifacts(db, input.simulationRunId)

  const {
    checkpointBySemesterStage,
    courseLeaderFacultyIdByCurriculumNodeSectionSemester,
    courseLeaderFacultyIdByOfferingId,
    downstreamNodeIdsBySourceNodeId,
    electiveRows,
    facultyBudgetByKey,
    hodFacultyId,
    mentorFacultyIdByStudentId,
    orderedCheckpointRows,
    prerequisiteNodeIdsByTargetNodeId,
    sectionStudentCountBySemesterSection,
    semesterNumbers,
    sourceByStudentNodeId,
    sources,
    templateById,
  } = await preparePlaybackRebuildContextService(db, {
    simulationRunId: input.simulationRunId,
    now: input.now,
    run,
  }, proofControlPlaneRebuildContextServiceDeps)

  const sectionRiskRateByStage = buildSectionRiskRateByStageService({
    policy: input.policy,
    sources,
    templatesById: templateById,
  }, proofControlPlaneSectionRiskServiceDeps)
  const {
    studentProjectionRows,
    queueProjectionRows,
    queueCaseRows,
    stageEvidenceRows,
  } = buildPlaybackGovernanceArtifacts({
    simulationRunId: input.simulationRunId,
    now: input.now,
    policy: input.policy,
    run: {
      batchId: run.batchId,
      createdAt: run.createdAt,
      curriculumImportVersionId: run.curriculumImportVersionId ?? null,
      curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
    },
    stageDefs: PLAYBACK_STAGE_DEFS,
    checkpointBySemesterStage,
    courseLeaderFacultyIdByCurriculumNodeSectionSemester,
    courseLeaderFacultyIdByOfferingId,
    downstreamNodeIdsBySourceNodeId,
    facultyBudgetByKey,
    hodFacultyId,
    mentorFacultyIdByStudentId,
    prerequisiteNodeIdsByTargetNodeId,
    sectionRiskRateByStage,
    sectionStudentCountBySemesterSection,
    semesterNumbers,
    sourceByStudentNodeId,
    sources,
    templateById,
    activeRiskArtifacts,
  })

  const {
    checkpointRows: checkpointRowsWithSummary,
    offeringProjectionRows,
  } = buildPlaybackStageSummariesService({
    simulationRunId: input.simulationRunId,
    now: input.now,
    checkpointBySemesterStage,
    orderedCheckpointRows,
    studentProjectionRows,
    queueProjectionRows,
    sources,
    electiveRows,
  }, proofControlPlaneStageSummaryServiceDeps)

  if (checkpointRowsWithSummary.length > 0) await insertRowsInChunks(db, simulationStageCheckpoints, checkpointRowsWithSummary)
  if (studentProjectionRows.length > 0) await insertRowsInChunks(db, simulationStageStudentProjections, studentProjectionRows)
  if (offeringProjectionRows.length > 0) await insertRowsInChunks(db, simulationStageOfferingProjections, offeringProjectionRows)
  if (queueCaseRows.length > 0) await insertRowsInChunks(db, simulationStageQueueCases, queueCaseRows)
  if (queueProjectionRows.length > 0) await insertRowsInChunks(db, simulationStageQueueProjections, queueProjectionRows)
  if (stageEvidenceRows.length > 0) await insertRowsInChunks(db, riskEvidenceSnapshots, stageEvidenceRows)
}

async function upsertRuntimeSlice(db: AppDb, stateKey: string, payload: unknown, now: string) {
  const [current] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await db.update(academicRuntimeState).set({
      payloadJson: JSON.stringify(payload),
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return
  }
  await db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: JSON.stringify(payload),
    version: 1,
    updatedAt: now,
  })
}

async function insertRowsInChunks<T>(db: AppDb, table: unknown, rows: T[], chunkSize = 400) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const batch = rows.slice(index, index + chunkSize)
    if (batch.length === 0) continue
    await db.insert(table as never).values(batch as never)
  }
}

async function readRuntimeCurriculum(db: AppDb, curriculumImportVersionId: string): Promise<RuntimeCurriculum> {
  const [nodeRows, edgeRows, bridgeRows, partitionRows, basketRows, optionRows] = await Promise.all([
    db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(electiveBaskets).where(eq(electiveBaskets.curriculumImportVersionId, curriculumImportVersionId)),
    db.select().from(electiveOptions),
  ])

  const nodesById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))
  const explicitSourcesByTarget = new Map<string, string[]>()
  const addedSourcesByTarget = new Map<string, string[]>()
  for (const edge of edgeRows) {
    const source = nodesById.get(edge.sourceCurriculumNodeId)
    const target = nodesById.get(edge.targetCurriculumNodeId)
    if (!source || !target) continue
    const targetMap = edge.edgeKind === 'explicit' ? explicitSourcesByTarget : addedSourcesByTarget
    targetMap.set(target.curriculumNodeId, [...(targetMap.get(target.curriculumNodeId) ?? []), source.title])
  }
  const bridgeRowsByNodeId = new Map(bridgeRows.map(row => [row.curriculumNodeId, row]))
  const partitionsByNodeKind = new Map(partitionRows.map(row => [`${row.curriculumNodeId}::${row.partitionKind}`, row]))

  const courses = nodeRows.map<RuntimeCourse>(row => ({
    curriculumNodeId: row.curriculumNodeId,
    semesterNumber: row.semesterNumber,
    courseId: row.courseId,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    internalCompilerId: row.internalCompilerId,
    officialWebCode: row.officialWebCode,
    officialWebTitle: row.officialWebTitle,
    matchStatus: row.matchStatus,
    mappingNote: row.mappingNote,
    assessmentProfile: row.assessmentProfile,
    explicitPrerequisites: [...(explicitSourcesByTarget.get(row.curriculumNodeId) ?? [])].sort(),
    addedPrerequisites: [...(addedSourcesByTarget.get(row.curriculumNodeId) ?? [])].sort(),
    bridgeModules: parseJson(bridgeRowsByNodeId.get(row.curriculumNodeId)?.moduleTitlesJson ?? '[]', [] as string[]),
    tt1Topics: parseJson(partitionsByNodeKind.get(`${row.curriculumNodeId}::tt1`)?.topicsJson ?? '[]', [] as string[]),
    tt2Topics: parseJson(partitionsByNodeKind.get(`${row.curriculumNodeId}::tt2`)?.topicsJson ?? '[]', [] as string[]),
    seeTopics: parseJson(partitionsByNodeKind.get(`${row.curriculumNodeId}::see`)?.topicsJson ?? '[]', [] as string[]),
    workbookTopics: parseJson(partitionsByNodeKind.get(`${row.curriculumNodeId}::workbook`)?.topicsJson ?? '[]', [] as string[]),
  })).sort((left, right) => left.semesterNumber - right.semesterNumber || left.internalCompilerId.localeCompare(right.internalCompilerId))

  const optionsByBasketId = new Map<string, Array<typeof electiveOptions.$inferSelect>>()
  for (const option of optionRows) {
    optionsByBasketId.set(option.electiveBasketId, [...(optionsByBasketId.get(option.electiveBasketId) ?? []), option])
  }
  const electives = basketRows.flatMap<RuntimeElectiveOption>(basket => (
    (optionsByBasketId.get(basket.electiveBasketId) ?? []).map(option => ({
      stream: basket.stream,
      pceGroup: basket.pceGroup,
      code: option.code,
      title: option.title,
      semesterSlot: option.semesterSlot,
    }))
  ))

  return {
    courses,
    electives,
  }
}

async function syncCurriculumSnapshot(db: AppDb, batchId: string, importVersionId: string, now: string) {
  const nodeRows = await db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, importVersionId))
  await db.delete(curriculumCourses).where(eq(curriculumCourses.batchId, batchId))
  if (nodeRows.length === 0) return
  await db.insert(curriculumCourses).values(nodeRows.map(row => ({
    curriculumCourseId: `curriculum_course_${row.curriculumNodeId}`,
    batchId,
    semesterNumber: row.semesterNumber,
    courseId: row.courseId ?? `proof_course_${row.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })))
}

async function emitSimulationAudit(db: AppDb, input: {
  simulationRunId: string
  batchId: string
  actionType: string
  payload: unknown
  createdByFacultyId?: string | null
  now: string
}) {
  await db.insert(simulationLifecycleAudits).values({
    simulationLifecycleAuditId: createId('simulation_audit'),
    simulationRunId: input.simulationRunId,
    batchId: input.batchId,
    actionType: input.actionType,
    payloadJson: JSON.stringify(input.payload),
    createdByFacultyId: input.createdByFacultyId ?? null,
    createdAt: input.now,
  })
}

async function ensureProofCourses(db: AppDb, runtimeCourses: RuntimeCourse[], now: string) {
  const existingRows = await db.select().from(courses).where(eq(courses.departmentId, MSRUAS_PROOF_DEPARTMENT_ID))
  const existingByCodeTitle = new Map(existingRows.map(row => [`${row.courseCode}::${row.title}`, row]))
  const courseIdByInternalId = new Map<string, string>()
  const newRows: Array<typeof courses.$inferInsert> = []

  for (const course of runtimeCourses) {
    const courseCode = courseCodeForRuntime(course)
    const key = `${courseCode}::${course.title}`
    const existing = existingByCodeTitle.get(key)
    if (existing) {
      courseIdByInternalId.set(course.internalCompilerId, existing.courseId)
      continue
    }
    const courseId = `course_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    newRows.push({
      courseId,
      institutionId: 'msruas',
      courseCode,
      title: course.title,
      defaultCredits: course.credits,
      departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    courseIdByInternalId.set(course.internalCompilerId, courseId)
  }

  if (newRows.length > 0) await db.insert(courses).values(newRows)
  return courseIdByInternalId
}

function electiveRecommendationForStudent(input: {
  courseScores: Map<string, number>
  electives: RuntimeElectiveOption[]
}) {
  const streamRules = [
    { stream: 'Coding and Cryptography', titles: ['Discrete Mathematics', 'Digital Logic Design', 'Theory of Computation', 'Data Structures and Algorithms'], rationale: ['strong symbolic reasoning', 'good performance on formal and logic-heavy courses'] },
    { stream: 'Mathematical Models', titles: ['Engineering Mathematics-1', 'Engineering Mathematics-2', 'Linear Algebra', 'Probability and Statistics'], rationale: ['stable mathematical foundation', 'consistent performance on proof-oriented mathematics'] },
    { stream: 'Artificial Intelligence and Data Sciences', titles: ['Programming in C', 'Python Programming', 'Machine Learning', 'Probability and Statistics'], rationale: ['applied modelling strength', 'solid algorithmic and data reasoning profile'] },
    { stream: 'Software Development', titles: ['Object Oriented Programming', 'Database Management Systems', 'Operating Systems', 'Software Engineering'], rationale: ['strong systems and software stack performance', 'good consistency in implementation-heavy courses'] },
    { stream: 'Applied Mathematics', titles: ['Engineering Mathematics-1', 'Engineering Mathematics-2', 'Linear Algebra', 'Numerical Methods'], rationale: ['high readiness for quantitative electives', 'strong performance on analytical methods'] },
    { stream: 'Data Science and Analytics', titles: ['Python Programming', 'Probability and Statistics', 'Machine Learning', 'Scientific Computing Lab'], rationale: ['good preparation for data-centric electives', 'observable strength in modelling and computation'] },
  ]
  const sem6Options = input.electives.filter((option: RuntimeElectiveOption) => option.semesterSlot.toLowerCase() === 'sem 6')
  const scores = streamRules.map(rule => {
    const values = rule.titles.map(title => input.courseScores.get(title)).filter((value): value is number => typeof value === 'number')
    const score = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 40
    const option = sem6Options.find((candidate: RuntimeElectiveOption) => candidate.stream === rule.stream)
    return {
      stream: rule.stream,
      option: option ?? sem6Options[0],
      score: roundToTwo(score),
      rationale: rule.rationale,
    }
  }).filter(item => item.option).sort((left, right) => right.score - left.score)

  const best = scores[0]
  return {
    recommended: best.option,
    rationale: best.rationale,
    alternatives: scores.slice(1, 4).map(item => ({
      code: item.option.code,
      title: item.option.title,
      stream: item.option.stream,
      score: item.score,
    })),
  }
}

async function ensureSem6Offerings(db: AppDb, runtimeCourses: RuntimeCourse[], now: string) {
  const sem6Courses = runtimeCourses.filter(course => course.semesterNumber === 6)
  const courseRows = await db.select().from(courses).where(eq(courses.departmentId, MSRUAS_PROOF_DEPARTMENT_ID))
  const courseByTitle = new Map(courseRows.map(row => [row.title, row]))
  const offeringRows = await db.select().from(sectionOfferings).where(eq(sectionOfferings.termId, 'term_mnc_sem6'))
  const ownershipRows = await db.select().from(facultyOfferingOwnerships)
  const currentByKey = new Map<string, typeof sectionOfferings.$inferSelect>()
  for (const offering of offeringRows) {
    const course = courseRows.find(row => row.courseId === offering.courseId)
    if (!course) continue
    currentByKey.set(`${course.title}::${offering.sectionCode}`, offering)
  }

  const courseLeaderFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('COURSE_LEADER'))
  const newOfferingRows: Array<typeof sectionOfferings.$inferInsert> = []
  const newOwnershipRows: Array<typeof facultyOfferingOwnerships.$inferInsert> = []
  const offeringFacultyById = new Map<string, string>()

  ;(['A', 'B'] as const).forEach((sectionCode, sectionOffset) => {
    sem6Courses.forEach((course, courseIndex) => {
      const key = `${course.title}::${sectionCode}`
      const current = currentByKey.get(key)
      const faculty = courseLeaderFaculty[(courseIndex + (sectionOffset * 3)) % courseLeaderFaculty.length]
      if (current) {
        offeringFacultyById.set(current.offeringId, faculty.facultyId)
        return
      }
      const courseRow = courseByTitle.get(course.title)
      if (!courseRow) return
      const offeringId = `mnc_s6_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${sectionCode.toLowerCase()}`
      newOfferingRows.push({
        offeringId,
        courseId: courseRow.courseId,
        termId: 'term_mnc_sem6',
        branchId: MSRUAS_PROOF_BRANCH_ID,
        sectionCode,
        yearLabel: '3rd Year',
        attendance: sectionCode === 'A' ? 82 : 74,
        studentCount: 60,
        stage: 2,
        stageLabel: 'TT1 Review',
        stageDescription: 'Observable monitoring window after TT1; reassessment stays active.',
        stageColor: '#f59e0b',
        tt1Done: 1,
        tt2Done: 0,
        tt1Locked: 1,
        tt2Locked: 0,
        quizLocked: 1,
        assignmentLocked: 1,
        pendingAction: 'Adaptive reassessment window active',
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      if (!ownershipRows.some(row => row.offeringId === offeringId && row.facultyId === faculty.facultyId && row.status === 'active')) {
        newOwnershipRows.push({
          ownershipId: `ownership_${faculty.facultyId}_${offeringId}`,
          offeringId,
          facultyId: faculty.facultyId,
          ownershipRole: 'owner',
          status: 'active',
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
      }
      offeringFacultyById.set(offeringId, faculty.facultyId)
    })
  })

  if (newOfferingRows.length > 0) await db.insert(sectionOfferings).values(newOfferingRows)
  if (newOwnershipRows.length > 0) await db.insert(facultyOfferingOwnerships).values(newOwnershipRows)

  const refreshedOfferings = newOfferingRows.length > 0
    ? await db.select().from(sectionOfferings).where(eq(sectionOfferings.termId, 'term_mnc_sem6'))
    : offeringRows
  return {
    offerings: refreshedOfferings,
    offeringFacultyById,
  }
}

async function publishOperationalProjection(db: AppDb, input: {
  simulationRunId: string
  batchId: string
  now: string
}) {
  const [observedRows, riskRows, alertRows, electiveRows] = await Promise.all([
    db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId)),
    db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, input.simulationRunId)),
    db.select().from(alertDecisions),
    db.select().from(electiveRecommendations).where(eq(electiveRecommendations.simulationRunId, input.simulationRunId)),
  ])

  const sem5OrEarlierRows = observedRows.filter(row => row.semesterNumber <= 5)
  const sem6Rows = observedRows.filter(row => row.semesterNumber === 6)
  const termBySemester = new Map<number, (typeof PROOF_TERM_DEFS)[number]>(PROOF_TERM_DEFS.map(term => [term.semesterNumber, term]))
  const transcriptTermInsertRows: Array<typeof transcriptTermResults.$inferInsert> = []
  const transcriptSubjectInsertRows: Array<typeof transcriptSubjectResults.$inferInsert> = []

  for (const row of sem5OrEarlierRows) {
    const payload = parseObservedStateRow(row)
    const term = termBySemester.get(row.semesterNumber)
    if (!term) continue
    const transcriptTermResultId = createId('transcript_term')
    transcriptTermInsertRows.push({
      transcriptTermResultId,
      studentId: row.studentId,
      termId: term.termId,
      sgpaScaled: Math.round(Number(payload.sgpa ?? 0) * 100),
      registeredCredits: Number(payload.registeredCredits ?? 0),
      earnedCredits: Number(payload.earnedCredits ?? 0),
      backlogCount: Number(payload.backlogCount ?? 0),
      createdAt: input.now,
      updatedAt: input.now,
    })
    const subjectScores = Array.isArray(payload.subjectScores) ? payload.subjectScores : []
    subjectScores.forEach((subject, index) => {
      const record = subject as Record<string, unknown>
      transcriptSubjectInsertRows.push({
        transcriptSubjectResultId: createId(`transcript_subject_${index + 1}`),
        transcriptTermResultId,
        courseCode: String(record.courseCode ?? 'NA'),
        title: String(record.title ?? 'Untitled'),
        credits: Number(record.credits ?? 0),
        score: Number(record.score ?? 0),
        gradeLabel: String(record.gradeLabel ?? 'F'),
        gradePoint: Number(record.gradePoint ?? 0),
        result: String(record.result ?? 'Failed'),
        createdAt: input.now,
        updatedAt: input.now,
      })
    })
  }

  if (transcriptTermInsertRows.length > 0) await db.insert(transcriptTermResults).values(transcriptTermInsertRows)
  if (transcriptSubjectInsertRows.length > 0) await db.insert(transcriptSubjectResults).values(transcriptSubjectInsertRows)

  const attendanceRows: Array<typeof studentAttendanceSnapshots.$inferInsert> = []
  const assessmentRows: Array<typeof studentAssessmentScores.$inferInsert> = []
  for (const row of sem6Rows) {
    const payload = parseObservedStateRow(row)
    const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
    if (!offeringId) continue
    const attendancePct = Math.round(Number(payload.attendancePct ?? 0))
    attendanceRows.push({
      attendanceSnapshotId: createId('attendance'),
      studentId: row.studentId,
      offeringId,
      presentClasses: Math.round((attendancePct / 100) * 32),
      totalClasses: 32,
      attendancePercent: attendancePct,
      source: `proof-run:${input.simulationRunId}`,
      capturedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const tt1Pct = Number(payload.tt1Pct ?? 0)
    const tt2Pct = Number(payload.tt2Pct ?? 0)
    const quizPct = Number(payload.quizPct ?? 0)
    const assignmentPct = Number(payload.assignmentPct ?? 0)
    const seePct = Number(payload.seePct ?? 0)
    assessmentRows.push(
      {
        assessmentScoreId: createId('assessment_tt1'),
        studentId: row.studentId,
        offeringId,
        termId: 'term_mnc_sem6',
        componentType: 'tt1',
        componentCode: 'TT1',
        score: Math.round((tt1Pct / 100) * 25),
        maxScore: 25,
        evaluatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      {
        assessmentScoreId: createId('assessment_tt2'),
        studentId: row.studentId,
        offeringId,
        termId: 'term_mnc_sem6',
        componentType: 'tt2',
        componentCode: 'TT2',
        score: Math.round((tt2Pct / 100) * 25),
        maxScore: 25,
        evaluatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      {
        assessmentScoreId: createId('assessment_quiz1'),
        studentId: row.studentId,
        offeringId,
        termId: 'term_mnc_sem6',
        componentType: 'quiz1',
        componentCode: 'Quiz 1',
        score: Math.round((quizPct / 100) * 10),
        maxScore: 10,
        evaluatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      {
        assessmentScoreId: createId('assessment_assignment1'),
        studentId: row.studentId,
        offeringId,
        termId: 'term_mnc_sem6',
        componentType: 'asgn1',
        componentCode: 'Assignment 1',
        score: Math.round((assignmentPct / 100) * 10),
        maxScore: 10,
        evaluatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      {
        assessmentScoreId: createId('assessment_see'),
        studentId: row.studentId,
        offeringId,
        termId: 'term_mnc_sem6',
        componentType: 'see',
        componentCode: 'SEE',
        score: Math.round((seePct / 100) * 40),
        maxScore: 40,
        evaluatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
    )
  }
  if (attendanceRows.length > 0) await db.insert(studentAttendanceSnapshots).values(attendanceRows)
  if (assessmentRows.length > 0) await db.insert(studentAssessmentScores).values(assessmentRows)

  if (riskRows.length > 0) {
    const riskIds = riskRows.map(row => row.riskAssessmentId)
    const relevantAlerts = alertRows.filter(row => riskIds.includes(row.riskAssessmentId))
    await db.update(riskAssessments).set({
      assessedAt: input.now,
      updatedAt: input.now,
    }).where(eq(riskAssessments.simulationRunId, input.simulationRunId))
    if (relevantAlerts.length > 0) {
      await db.update(alertDecisions).set({
        createdAt: input.now,
        updatedAt: input.now,
      }).where(inArray(alertDecisions.alertDecisionId, relevantAlerts.map(row => row.alertDecisionId)))
    }
  }

  if (electiveRows.length > 0) {
    await db.update(electiveRecommendations).set({
      updatedAt: input.now,
    }).where(eq(electiveRecommendations.simulationRunId, input.simulationRunId))
  }

  const latestCgpaByStudent = new Map<string, number>()
  for (const row of sem5OrEarlierRows) {
    const payload = parseObservedStateRow(row)
    const cgpa = Number(payload.cgpaAfterSemester ?? 0)
    latestCgpaByStudent.set(row.studentId, cgpa)
  }
  for (const [studentId, cgpa] of latestCgpaByStudent.entries()) {
    const [profile] = await db.select().from(studentAcademicProfiles).where(eq(studentAcademicProfiles.studentId, studentId))
    if (profile) {
      await db.update(studentAcademicProfiles).set({
        prevCgpaScaled: Math.round(cgpa * 100),
        updatedAt: input.now,
      }).where(eq(studentAcademicProfiles.studentId, studentId))
    }
  }
}

export async function createProofCurriculumImport(db: AppDb, input: {
  batchId: string
  sourcePath?: string
  actorFacultyId?: string | null
  now: string
}) {
  const compiled = compileMsruasCurriculumWorkbook(input.sourcePath)
  const validation = validateCompiledCurriculum(compiled)
  const completenessCertificate = buildCompletenessCertificate(compiled, validation)
  const outputChecksum = buildCurriculumOutputChecksum(compiled)
  const curriculumImportVersionId = createId('curriculum_import')

  const [batch] = await db.select().from(batches).where(eq(batches.batchId, input.batchId))
  if (!batch) throw new Error('Batch not found')

  await db.insert(curriculumImportVersions).values({
    curriculumImportVersionId,
    batchId: input.batchId,
    sourceLabel: compiled.sourceLabel,
    sourceChecksum: compiled.sourceChecksum,
    sourcePath: compiled.sourcePath,
    sourceType: compiled.sourceType,
    compilerVersion: compiled.compilerVersion,
    outputChecksum,
    firstSemester: validation.semesterCoverage[0],
    lastSemester: validation.semesterCoverage[1],
    courseCount: validation.courseCount,
    totalCredits: validation.totalCredits,
    explicitEdgeCount: validation.explicitEdgeCount,
    addedEdgeCount: validation.addedEdgeCount,
    bridgeModuleCount: validation.bridgeModuleCount,
    electiveOptionCount: validation.electiveOptionCount,
    unresolvedMappingCount: validation.unresolvedMappingCount,
    validationStatus: validation.status,
    completenessCertificateJson: JSON.stringify(completenessCertificate),
    approvedByFacultyId: null,
    approvedAt: null,
    status: validation.errors.length > 0 ? 'needs-review' : 'validated',
    createdAt: input.now,
    updatedAt: input.now,
  })

  await db.insert(curriculumValidationResults).values({
    curriculumValidationResultId: createId('curriculum_validation'),
    curriculumImportVersionId,
    batchId: input.batchId,
    validatorVersion: MSRUAS_PROOF_VALIDATOR_VERSION,
    status: validation.status,
    summaryJson: JSON.stringify(validation),
    createdAt: input.now,
    updatedAt: input.now,
  })

  const courseIdByInternalId = await ensureProofCourses(db, compiled.courses.map(course => ({
    curriculumNodeId: '',
    semesterNumber: course.semester,
    courseId: null,
    courseCode: course.officialWebCode ?? course.internalCompilerId,
    title: course.title,
    credits: course.credits,
    internalCompilerId: course.internalCompilerId,
    officialWebCode: course.officialWebCode,
    officialWebTitle: course.officialWebTitle,
    matchStatus: course.matchStatus,
    mappingNote: course.mappingNote,
    assessmentProfile: course.assessmentProfile,
    explicitPrerequisites: course.explicitPrerequisites,
    addedPrerequisites: course.addedPrerequisites,
    bridgeModules: course.bridgeModules,
    tt1Topics: course.tt1Topics,
    tt2Topics: course.tt2Topics,
    seeTopics: course.seeTopics,
    workbookTopics: course.workbookTopics,
  })), input.now)

  const curriculumNodeRows: Array<typeof curriculumNodes.$inferInsert> = compiled.courses.map(course => ({
    curriculumNodeId: createId('curriculum_node'),
    curriculumImportVersionId,
    batchId: input.batchId,
    semesterNumber: course.semester,
    courseId: courseIdByInternalId.get(course.internalCompilerId) ?? null,
    courseCode: course.officialWebCode ?? course.internalCompilerId,
    title: course.title,
    credits: course.credits,
    internalCompilerId: course.internalCompilerId,
    officialWebCode: course.officialWebCode,
    officialWebTitle: course.officialWebTitle,
    matchStatus: course.matchStatus,
    mappingNote: course.mappingNote,
    assessmentProfile: course.assessmentProfile,
    status: 'active',
    createdAt: input.now,
    updatedAt: input.now,
  }))
  await db.insert(curriculumNodes).values(curriculumNodeRows)
  const nodeIdByTitle = new Map(curriculumNodeRows.map(row => [row.title, row.curriculumNodeId]))
  const nodeRowByTitle = new Map(curriculumNodeRows.map(row => [row.title, row]))

  const curriculumEdgeRows: Array<typeof curriculumEdges.$inferInsert> = [
    ...compiled.explicitEdges.map(edge => ({
      curriculumEdgeId: createId('curriculum_edge'),
      curriculumImportVersionId,
      batchId: input.batchId,
      sourceCurriculumNodeId: nodeIdByTitle.get(edge.sourceCourse) ?? '',
      targetCurriculumNodeId: nodeIdByTitle.get(edge.targetCourse) ?? '',
      edgeKind: 'explicit',
      rationale: edge.edgeType,
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    })),
    ...compiled.addedEdges.map(edge => ({
      curriculumEdgeId: createId('curriculum_edge'),
      curriculumImportVersionId,
      batchId: input.batchId,
      sourceCurriculumNodeId: nodeIdByTitle.get(edge.sourceCourse) ?? '',
      targetCurriculumNodeId: nodeIdByTitle.get(edge.targetCourse) ?? '',
      edgeKind: 'added',
      rationale: edge.whyAdded ?? edge.edgeType,
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    })),
  ].filter(row => row.sourceCurriculumNodeId && row.targetCurriculumNodeId)
  if (curriculumEdgeRows.length > 0) await db.insert(curriculumEdges).values(curriculumEdgeRows)

  const bridgeRows: Array<typeof bridgeModules.$inferInsert> = compiled.courses
    .filter(course => course.bridgeModules.length > 0)
    .flatMap(course => {
      const node = nodeRowByTitle.get(course.title)
      if (!node) return []
      return [{
        bridgeModuleId: createId('bridge'),
        curriculumImportVersionId,
        curriculumNodeId: node.curriculumNodeId,
        batchId: input.batchId,
        moduleTitlesJson: JSON.stringify(course.bridgeModules),
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      }]
    })
  if (bridgeRows.length > 0) await db.insert(bridgeModules).values(bridgeRows)

  const topicRows: Array<typeof courseTopicPartitions.$inferInsert> = compiled.courses.flatMap(course => {
    const node = nodeRowByTitle.get(course.title)
    if (!node) return []
    return [
      { partitionKind: 'tt1', topicsJson: JSON.stringify(course.tt1Topics) },
      { partitionKind: 'tt2', topicsJson: JSON.stringify(course.tt2Topics) },
      { partitionKind: 'see', topicsJson: JSON.stringify(course.seeTopics) },
      { partitionKind: 'workbook', topicsJson: JSON.stringify(course.workbookTopics) },
    ].map(partition => ({
      courseTopicPartitionId: createId('topic_partition'),
      curriculumImportVersionId,
      curriculumNodeId: node.curriculumNodeId,
      partitionKind: partition.partitionKind,
      topicsJson: partition.topicsJson,
      createdAt: input.now,
      updatedAt: input.now,
    }))
  })
  if (topicRows.length > 0) await db.insert(courseTopicPartitions).values(topicRows)

  const basketIds = new Map<string, string>()
  const basketRows: Array<typeof electiveBaskets.$inferInsert> = []
  const optionRows: Array<typeof electiveOptions.$inferInsert> = []
  compiled.electives.forEach(elective => {
    const basketKey = `${elective.stream}::${elective.pceGroup}`
    let basketId = basketIds.get(basketKey)
    if (!basketId) {
      basketId = createId('elective_basket')
      basketIds.set(basketKey, basketId)
      basketRows.push({
        electiveBasketId: basketId,
        curriculumImportVersionId,
        batchId: input.batchId,
        semesterNumber: Number(elective.semesterSlot.replace(/[^0-9]/g, '') || '6'),
        stream: elective.stream,
        pceGroup: elective.pceGroup,
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
    optionRows.push({
      electiveOptionId: createId('elective_option'),
      electiveBasketId: basketId,
      code: elective.code,
      title: elective.title,
      stream: elective.stream,
      semesterSlot: elective.semesterSlot,
      createdAt: input.now,
      updatedAt: input.now,
    })
  })
  if (basketRows.length > 0) await db.insert(electiveBaskets).values(basketRows)
  if (optionRows.length > 0) await db.insert(electiveOptions).values(optionRows)

  const crosswalkRows: Array<typeof officialCodeCrosswalks.$inferInsert> = curriculumNodeRows.map(node => ({
    officialCodeCrosswalkId: createId('crosswalk'),
    curriculumImportVersionId,
    curriculumNodeId: node.curriculumNodeId,
    batchId: input.batchId,
    internalCompilerId: node.internalCompilerId,
    officialWebCode: node.officialWebCode,
    officialWebTitle: node.officialWebTitle,
    confidence: node.matchStatus.startsWith('exact') ? 'high' : node.matchStatus.includes('near') ? 'medium' : 'low',
    evidenceSource: 'reconciled-workbook',
    reviewStatus: node.matchStatus.startsWith('exact') ? 'auto-approved' : 'pending-review',
    overrideReason: null,
    approvedByFacultyId: node.matchStatus.startsWith('exact') ? input.actorFacultyId ?? null : null,
    approvedAt: node.matchStatus.startsWith('exact') ? input.now : null,
    createdAt: input.now,
    updatedAt: input.now,
  }))
  if (crosswalkRows.length > 0) await db.insert(officialCodeCrosswalks).values(crosswalkRows)

  return {
    curriculumImportVersionId,
    validation,
    completenessCertificate,
  }
}

export async function reviewProofCrosswalks(db: AppDb, input: {
  curriculumImportVersionId: string
  actorFacultyId?: string | null
  reviews: Array<{
    officialCodeCrosswalkId: string
    reviewStatus: string
    overrideReason?: string | null
  }>
  now: string
}) {
  for (const review of input.reviews) {
    await db.update(officialCodeCrosswalks).set({
      reviewStatus: review.reviewStatus,
      overrideReason: review.overrideReason ?? null,
      approvedByFacultyId: input.actorFacultyId ?? null,
      approvedAt: input.now,
      updatedAt: input.now,
    }).where(eq(officialCodeCrosswalks.officialCodeCrosswalkId, review.officialCodeCrosswalkId))
  }
}

export async function validateProofCurriculumImport(db: AppDb, input: {
  curriculumImportVersionId: string
  now: string
}) {
  const [importRow] = await db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  if (!importRow) throw new Error('Curriculum import not found')
  const compiled = compileMsruasCurriculumWorkbook(importRow.sourcePath ?? undefined)
  const validation = validateCompiledCurriculum(compiled)
  const certificate = buildCompletenessCertificate(compiled, validation)
  await db.insert(curriculumValidationResults).values({
    curriculumValidationResultId: createId('curriculum_validation'),
    curriculumImportVersionId: importRow.curriculumImportVersionId,
    batchId: importRow.batchId,
    validatorVersion: MSRUAS_PROOF_VALIDATOR_VERSION,
    status: validation.status,
    summaryJson: JSON.stringify(validation),
    createdAt: input.now,
    updatedAt: input.now,
  })
  await db.update(curriculumImportVersions).set({
    sourceChecksum: compiled.sourceChecksum,
    outputChecksum: buildCurriculumOutputChecksum(compiled),
    unresolvedMappingCount: validation.unresolvedMappingCount,
    validationStatus: validation.status,
    completenessCertificateJson: JSON.stringify(certificate),
    updatedAt: input.now,
    status: validation.errors.length > 0 ? 'needs-review' : 'validated',
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, importRow.curriculumImportVersionId))
  return validation
}

export async function approveProofCurriculumImport(db: AppDb, input: {
  curriculumImportVersionId: string
  actorFacultyId?: string | null
  now: string
}) {
  const [importRow] = await db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  if (!importRow) throw new Error('Curriculum import not found')
  const crosswalkRows = await db.select().from(officialCodeCrosswalks).where(eq(officialCodeCrosswalks.curriculumImportVersionId, input.curriculumImportVersionId))
  if (crosswalkRows.some(row => row.reviewStatus === 'pending-review')) {
    throw new Error('All pending crosswalk mappings must be reviewed before approval')
  }
  await db.update(curriculumImportVersions).set({
    approvedByFacultyId: input.actorFacultyId ?? null,
    approvedAt: input.now,
    status: 'approved',
    updatedAt: input.now,
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  await syncCurriculumSnapshot(db, importRow.batchId, input.curriculumImportVersionId, input.now)
}

async function startLiveBatchProofSimulationRun(db: AppDb, input: {
  simulationRunId?: string
  batchId: string
  curriculumImportVersionId: string
  policy: ResolvedPolicy
  curriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  actorFacultyId?: string | null
  now: string
  seed?: number
  runLabel?: string
  parentSimulationRunId?: string | null
  activate?: boolean
}) {
  return startLiveBatchProofSimulationRunService(db, input, proofControlPlaneLiveRunServiceDeps)
}

export async function startProofSimulationRun(db: AppDb, input: {
  simulationRunId?: string
  batchId: string
  curriculumImportVersionId: string
  policy: ResolvedPolicy
  curriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
  actorFacultyId?: string | null
  now: string
  seed?: number
  runLabel?: string
  parentSimulationRunId?: string | null
  activate?: boolean
  skipArtifactRebuild?: boolean
  skipActiveRiskRecompute?: boolean
}) {
  if (input.batchId !== MSRUAS_PROOF_BATCH_ID) {
    return startLiveBatchProofSimulationRun(db, input)
  }
  const {
    activate,
    deterministicPolicy,
    offerings,
    runSeed,
    runtime,
    scenarioProfile,
    sem6,
    sem6OfferingByCourseTitleSection,
    simulationRunId,
  } = await prepareSeededProofRunBootstrapService(db, input, proofControlPlaneSeededBootstrapServiceDeps)

  const trajectories = Array.from({ length: 120 }, (_, index) => buildStudentTrajectory(index, runSeed, scenarioProfile))
  const mentorFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('MENTOR'))
  const courseLeaderFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('COURSE_LEADER'))

  const teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert> = []
  const latentRows: Array<typeof studentLatentStates.$inferInsert> = []
  const behaviorRows: Array<typeof studentBehaviorProfiles.$inferInsert> = []
  const topicStateRows: Array<typeof studentTopicStates.$inferInsert> = []
  const coStateRows: Array<typeof studentCoStates.$inferInsert> = []
  const worldContextRows: Array<typeof worldContextSnapshots.$inferInsert> = []
  const questionTemplateRows: Array<typeof simulationQuestionTemplates.$inferInsert> = []
  const questionResultRows: Array<typeof studentQuestionResults.$inferInsert> = []
  const interventionResponseRows: Array<typeof studentInterventionResponseStates.$inferInsert> = []
  const observedRows: Array<typeof studentObservedSemesterStates.$inferInsert> = []
  const transitionRows: Array<typeof semesterTransitionLogs.$inferInsert> = []
  const attendanceRows: Array<typeof studentAttendanceSnapshots.$inferInsert> = []
  const assessmentRows: Array<typeof studentAssessmentScores.$inferInsert> = []
  const riskRows: Array<typeof riskAssessments.$inferInsert> = []
  const reassessmentRows: Array<typeof reassessmentEvents.$inferInsert> = []
  const alertRows: Array<typeof alertDecisions.$inferInsert> = []
  const alertOutcomeRows: Array<typeof alertOutcomes.$inferInsert> = []
  const electiveRows: Array<typeof electiveRecommendations.$inferInsert> = []
  const interventionRows: Array<typeof studentInterventions.$inferInsert> = []
  const transcriptTermRowsInsert: Array<typeof transcriptTermResults.$inferInsert> = []
  const transcriptSubjectRowsInsert: Array<typeof transcriptSubjectResults.$inferInsert> = []
  const {
    loadsByFacultyId,
    questionTemplateRows: seededQuestionTemplateRows,
    questionTemplatesByScope,
    teacherAllocationRows: seededTeacherAllocationRows,
    worldContextRows: seededWorldContextRows,
  } = await buildSeededScaffoldingService(db, {
    courseLeaderFaculty,
    now: input.now,
    offerings,
    runSeed,
    runtimeCourses: runtime.courses,
    sem6OfferingByCourseTitleSection,
    simulationRunId,
    trajectories,
  }, proofControlPlaneSeededScaffoldingServiceDeps)
  teacherAllocationRows.push(...seededTeacherAllocationRows)
  questionTemplateRows.push(...seededQuestionTemplateRows)
  worldContextRows.push(...seededWorldContextRows)

  trajectories.forEach((trajectory, index) => {
    behaviorRows.push({
      studentBehaviorProfileId: createId('behavior_profile'),
      simulationRunId,
      studentId: trajectory.studentId,
      sectionCode: trajectory.sectionCode,
      currentSemester: trajectory.profile.currentSemester,
      programScopeVersion: trajectory.profile.programScopeVersion,
      profileJson: JSON.stringify({
        archetype: trajectory.archetype,
        mentorTrack: trajectory.profile.mentorTrack,
        electiveTrackInterestProfile: trajectory.profile.electiveTrackInterestProfile,
        readiness: trajectory.profile.readiness,
        dynamics: trajectory.profile.dynamics,
        behavior: trajectory.profile.behavior,
        assessment: trajectory.profile.assessment,
        intervention: trajectory.profile.intervention,
      }),
      createdAt: input.now,
      updatedAt: input.now,
    })

    const historical = buildSeededHistoricalSemesterRows({
      courseLeaderFaculty,
      deterministicPolicy,
      now: input.now,
      questionTemplatesByScope,
      runSeed,
      runtimeCourses: runtime.courses,
      simulationRunId,
      trajectory,
      trajectoryIndex: index,
      latentRows,
      topicStateRows,
      coStateRows,
      questionResultRows,
      interventionRows,
      interventionResponseRows,
      observedRows,
      transitionRows,
      transcriptTermRowsInsert,
      transcriptSubjectRowsInsert,
    }, proofControlPlaneSeededSemesterServiceDeps)

    const electiveRecommendation = electiveRecommendationForStudent({
      courseScores: historical.courseScores,
      electives: runtime.electives,
    })
    electiveRows.push({
      electiveRecommendationId: createId('elective_recommendation'),
      simulationRunId,
      studentId: trajectory.studentId,
      batchId: input.batchId,
      semesterNumber: 6,
      recommendedCode: electiveRecommendation.recommended.code,
      recommendedTitle: electiveRecommendation.recommended.title,
      stream: electiveRecommendation.recommended.stream,
      rationaleJson: JSON.stringify(electiveRecommendation.rationale),
      alternativesJson: JSON.stringify(electiveRecommendation.alternatives),
      createdAt: input.now,
      updatedAt: input.now,
    })

    buildSeededSemesterSixRows({
      activeBacklogCount: historical.activeBacklogCount,
      attendanceRows,
      assessmentRows,
      coStateRows,
      currentCgpa: historical.currentCgpa,
      courseLeaderFaculty,
      courseScores: historical.courseScores,
      deterministicPolicy,
      interventionRows,
      interventionResponseRows,
      mentorFaculty,
      now: input.now,
      observedRows,
      questionResultRows,
      questionTemplatesByScope,
      reassessmentRows,
      riskRows,
      runSeed,
      sem6,
      sem6OfferingByCourseTitleSection,
      simulationRunId,
      student: trajectory,
      topicStateRows,
      alertRows,
      alertOutcomeRows,
      policy: input.policy,
      trajectoryIndex: index,
    }, proofControlPlaneSeededSemesterServiceDeps)
  })

  return finalizeSeededProofRunService(db, {
    simulationRunId,
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    policy: input.policy,
    actorFacultyId: input.actorFacultyId ?? null,
    now: input.now,
    runSeed,
    activate,
    scenarioFamily: scenarioProfile.family,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    skipArtifactRebuild: input.skipArtifactRebuild,
    skipActiveRiskRecompute: input.skipActiveRiskRecompute,
    trajectories,
    loadsByFacultyId,
    teacherAllocationRows,
    latentRows,
    behaviorRows,
    topicStateRows,
    coStateRows,
    worldContextRows,
    questionTemplateRows,
    questionResultRows,
    interventionResponseRows,
    observedRows,
    transitionRows,
    attendanceRows,
    assessmentRows,
    riskRows,
    reassessmentRows,
    alertRows,
    alertOutcomeRows,
    electiveRows,
    interventionRows,
    transcriptTermRowsInsert,
    transcriptSubjectRowsInsert,
  }, proofControlPlaneSeededRunServiceDeps)
}

export async function archiveProofSimulationRun(db: AppDb, input: {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  await db.update(simulationRuns).set({
    status: 'archived',
    activeFlag: 0,
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  await emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'archived',
    payload: {},
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })
}

export async function activateProofSimulationRun(db: AppDb, input: {
  simulationRunId: string
  actorFacultyId?: string | null
  now: string
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const [checkpointCountRow, observedCountRow] = await Promise.all([
    db.select({ count: count() }).from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, run.simulationRunId)),
    db.select({ count: count() }).from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, run.simulationRunId)),
  ])
  const alreadyMaterialized = Number(checkpointCountRow[0]?.count ?? 0) > 0 || Number(observedCountRow[0]?.count ?? 0) > 0
  if (!alreadyMaterialized && (run.status === 'queued' || run.status === 'running')) {
    if (!run.curriculumImportVersionId) {
      throw new Error('Queued proof run is missing its curriculum import version')
    }
    await startProofSimulationRun(db, {
      simulationRunId: run.simulationRunId,
      batchId: run.batchId,
      curriculumImportVersionId: run.curriculumImportVersionId,
      curriculumFeatureProfileId: run.curriculumFeatureProfileId ?? null,
      curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
      policy: parseJson(run.policySnapshotJson, {} as ResolvedPolicy),
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
      seed: run.seed,
      runLabel: run.runLabel,
      parentSimulationRunId: run.parentSimulationRunId ?? null,
      activate: true,
    })
  }
  await db.update(simulationRuns).set({
    activeFlag: 0,
    status: 'completed',
    updatedAt: input.now,
  }).where(eq(simulationRuns.batchId, run.batchId))
  await db.update(simulationRuns).set({
    activeFlag: 1,
    status: 'active',
    activeOperationalSemester: run.activeOperationalSemester ?? run.semesterEnd,
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, run.simulationRunId))
  await publishOperationalProjection(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    now: input.now,
  })
  await emitSimulationAudit(db, {
    simulationRunId: run.simulationRunId,
    batchId: run.batchId,
    actionType: 'activated',
    payload: {},
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })
}

export async function restoreProofSimulationSnapshot(db: AppDb, input: {
  simulationRunId: string
  simulationResetSnapshotId?: string
  policy: ResolvedPolicy
  actorFacultyId?: string | null
  now: string
}) {
  return restoreProofSimulationSnapshotService(db, input, proofControlPlaneRuntimeServiceDeps)
}

export async function recomputeObservedOnlyRisk(db: AppDb, input: {
  simulationRunId: string
  policy: ResolvedPolicy
  actorFacultyId?: string | null
  now: string
  rebuildModelArtifacts?: boolean
}) {
  return recomputeObservedOnlyRiskService(db, input, proofControlPlaneRuntimeServiceDeps)
}

const proofControlPlaneRebuildContextServiceDeps: ProofControlPlaneRebuildContextServiceDeps = {
  PLAYBACK_STAGE_DEFS,
  MSRUAS_PROOF_BRANCH_ID,
  MSRUAS_PROOF_DEPARTMENT_ID,
  average,
  buildDeterministicId,
  clamp,
  parseJson,
  toInterventionResponse,
}

const proofControlPlaneStageSummaryServiceDeps: ProofControlPlaneStageSummaryServiceDeps = {
  average,
  buildDeterministicId,
  parseJson,
  roundToOne,
  stageSummaryPayload,
}

const proofControlPlaneSectionRiskServiceDeps: ProofControlPlaneSectionRiskServiceDeps = {
  PLAYBACK_STAGE_DEFS,
  average,
  buildStageEvidenceSnapshot,
  observableSectionPressureFromEvidence,
  roundToTwo,
}

const proofControlPlaneRuntimeServiceDeps: ProofControlPlaneRuntimeServiceDeps = {
  PLAYBACK_STAGE_DEFS,
  MONITORING_POLICY_VERSION,
  average,
  buildActionPolicyComparison,
  buildDeterministicId,
  buildNoActionSnapshot,
  ceShortfallLabelFromPct,
  clamp,
  createId,
  emitSimulationAudit,
  insertRowsInChunks,
  liveInterventionResponseScoreFromPayload,
  loadActiveProofRiskArtifacts,
  observableSectionPressureFromEvidence,
  rebuildProofRiskArtifacts,
  rebuildSimulationStagePlayback,
  roundToTwo,
  startProofSimulationRun,
  summarizeQuestionPatterns,
}

const proofControlPlaneLiveRunServiceDeps: ProofControlPlaneLiveRunServiceDeps = {
  INFERENCE_MODEL_VERSION,
  MONITORING_POLICY_VERSION,
  MSRUAS_PROOF_VALIDATOR_VERSION,
  WORLD_ENGINE_VERSION,
  average,
  createId,
  deterministicPolicyFromResolved,
  emitSimulationAudit,
  evaluateCourseStatus,
  insertRowsInChunks,
  rebuildSimulationStagePlayback,
  recomputeObservedOnlyRisk,
  roundToTwo,
  weeklyContactHoursForCourse,
}

const proofControlPlaneSeededRunServiceDeps: ProofControlPlaneSeededRunServiceDeps = {
  PROOF_FACULTY,
  buildTimetablePayload,
  createId,
  emitSimulationAudit,
  insertRowsInChunks,
  parseJson,
  rebuildProofRiskArtifacts,
  rebuildSimulationStagePlayback,
  recomputeObservedOnlyRisk,
  upsertRuntimeSlice,
}

const proofControlPlaneSeededScaffoldingServiceDeps: ProofControlPlaneSeededScaffoldingServiceDeps = {
  average,
  buildSimulatedQuestionTemplates,
  buildTemplatesFromBlueprint,
  courseCodeForRuntime,
  createId,
  parseJson,
  roundToTwo,
  stableBetween,
  weeklyContactHoursForCourse,
}

const proofControlPlaneSeededSemesterServiceDeps: ProofControlPlaneSeededSemesterServiceDeps = {
  PROOF_TERM_DEFS,
  buildCourseOutcomeStates,
  buildMonitoringDecision,
  buildTopicStateRows,
  calculateCgpa,
  calculateSgpa,
  courseCodeForRuntime,
  createId,
  inferObservableRisk,
  mentorFaculty: PROOF_FACULTY.filter(item => item.permissions.includes('MENTOR')),
  roundToTwo,
  simulateQuestionResults,
  simulateSemesterCourse,
  stableUnit,
}

const proofControlPlaneSeededBootstrapServiceDeps: ProofControlPlaneSeededBootstrapServiceDeps = {
  INFERENCE_MODEL_VERSION,
  MONITORING_POLICY_VERSION,
  MSRUAS_PROOF_DEPARTMENT_ID,
  MSRUAS_PROOF_VALIDATOR_VERSION,
  PROOF_FACULTY,
  WORLD_ENGINE_VERSION,
  createId,
  deterministicPolicyFromResolved,
  ensureSem6Offerings,
  readRuntimeCurriculum,
  scenarioProfileForSeed,
}

const proofControlPlaneBatchServiceDeps: ProofControlPlaneBatchServiceDeps = {
  getProofRiskModelDiagnostics,
  parseProofCheckpointSummary,
  queueStatusPriority,
  withProofPlaybackGate,
}

const proofControlPlaneActivationServiceDeps: ProofControlPlaneActivationServiceDeps = {
  emitSimulationAudit,
  publishOperationalProjection,
}

const proofControlPlaneHodServiceDeps: ProofControlPlaneHodServiceDeps = {
  average,
  buildEvidenceTimelineFromRows,
  bucketBacklogCount,
  hoursBetween,
  isOpenReassessmentStatus,
  matchesTextFilter,
  normalizeFilterValue,
  parseProofCheckpointSummary,
  proofRecoveryStateFromResolutionRow,
  proofResolutionPayloadFromRow,
  queueProjectionAssignedFacultyId,
  roundToOne,
  uniqueSorted,
  withProofPlaybackGate,
}

export async function listProofRunCheckpoints(db: AppDb, input: {
  simulationRunId: string
}) {
  return listProofRunCheckpointsService(db, input, proofControlPlaneBatchServiceDeps)
}

export async function getProofRunCheckpointDetail(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
}) {
  return getProofRunCheckpointDetailService(db, input, proofControlPlaneBatchServiceDeps)
}

export async function getProofRunCheckpointStudentDetail(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
  studentId: string
}) {
  return getProofRunCheckpointStudentDetailService(db, input, proofControlPlaneBatchServiceDeps)
}

export async function buildProofBatchDashboard(db: AppDb, batchId: string) {
  return buildProofBatchDashboardService(db, batchId, proofControlPlaneBatchServiceDeps)
}

export async function activateProofOperationalSemester(db: AppDb, input: {
  simulationRunId: string
  semesterNumber: number
  actorFacultyId?: string | null
  now: string
}) {
  return activateProofOperationalSemesterService(db, input, proofControlPlaneActivationServiceDeps)
}

export async function buildHodProofAnalytics(db: AppDb, input: {
  facultyId: string
  roleScopeType?: string | null
  roleScopeId?: string | null
  now?: string
  filters?: {
    section?: string
    semester?: number
    simulationStageCheckpointId?: string
    riskBand?: string
    status?: string
    facultyId?: string
    courseCode?: string
    studentId?: string
  }
}) {
  return buildHodProofAnalyticsService(db, input, proofControlPlaneHodServiceDeps)
}

const proofControlPlaneTailServiceDeps: ProofControlPlaneTailServiceDeps = {
  buildEvidenceTimelineFromRows,
  clamp,
  createId,
  displayableHeadProbabilityScaled,
  headDisplayState,
  interventionAcceptedFromResponseState,
  interventionCompletedFromResponseState,
  interventionObservedResidualFromResponseState,
  interventionRecoveryConfirmedFromResponseState,
  isOpenReassessmentStatus,
  loadActiveProofRiskArtifacts,
  parseProofCheckpointSummary,
  proofRecoveryStateFromResolutionRow,
  proofResolutionPayloadFromRow,
  queueProjectionAssignedFacultyId,
  queueStatusPriority,
  uniqueSorted,
  withProofPlaybackGate,
}

export async function buildFacultyProofView(db: AppDb, input: {
  facultyId: string
  viewerRoleCode?: string | null
  simulationStageCheckpointId?: string | null
}) {
  return buildFacultyProofViewService(db, input, proofControlPlaneTailServiceDeps)
}

export async function getProofStudentEvidenceTimeline(db: AppDb, input: {
  simulationRunId: string
  studentId: string
}) {
  return getProofStudentEvidenceTimelineService(db, input, proofControlPlaneTailServiceDeps)
}

export async function buildStudentAgentCard(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}): Promise<StudentAgentCardPayload> {
  return buildStudentAgentCardService(db, input, proofControlPlaneTailServiceDeps)
}

export async function buildStudentRiskExplorer(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}): Promise<StudentRiskExplorerPayload> {
  return buildStudentRiskExplorerService(db, input, proofControlPlaneTailServiceDeps)
}

export async function startStudentAgentSession(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId?: string | null
  studentId: string
  viewerFacultyId: string | null
  viewerRole: string
}) {
  return startStudentAgentSessionService(db, input, proofControlPlaneTailServiceDeps)
}

export async function sendStudentAgentMessage(db: AppDb, input: {
  studentAgentSessionId: string
  prompt: string
}) {
  return sendStudentAgentMessageService(db, input, proofControlPlaneTailServiceDeps)
}

export async function listStudentAgentTimeline(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}) {
  return listStudentAgentTimelineService(db, input, proofControlPlaneTailServiceDeps)
}
