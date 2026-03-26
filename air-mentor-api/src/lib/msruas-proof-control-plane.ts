import { createHash } from 'node:crypto'
import { and, asc, count, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicRuntimeState,
  academicTerms,
  alertAcknowledgements,
  alertDecisions,
  alertOutcomes,
  batches,
  branches,
  bridgeModules,
  courseTopicPartitions,
  courses,
  curriculumCourses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  curriculumValidationResults,
  departments,
  electiveBaskets,
  electiveOptions,
  electiveRecommendations,
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  officialCodeCrosswalks,
  offeringQuestionPapers,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  riskEvidenceSnapshots,
  riskModelArtifacts,
  riskOverrides,
  roleGrants,
  sectionOfferings,
  simulationLifecycleAudits,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  simulationResetSnapshots,
  simulationRuns,
  semesterTransitionLogs,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentBehaviorProfiles,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
  studentCoStates,
  students,
  studentInterventionResponseStates,
  studentLatentStates,
  studentObservedSemesterStates,
  studentInterventions,
  studentQuestionResults,
  studentTopicStates,
  simulationQuestionTemplates,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptSubjectResults,
  transcriptTermResults,
  userAccounts,
  worldContextSnapshots,
} from '../db/schema.js'
import {
  buildFacultyTimetableTemplates as sharedBuildFacultyTimetableTemplates,
  weeklyContactHoursForCourse as sharedWeeklyContactHoursForCourse,
} from './academic-provisioning.js'
import { createId } from './ids.js'
import { parseJson } from './json.js'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  compileMsruasCurriculumWorkbook,
  type CompiledCurriculumCourse,
  type CompiledCurriculumElective,
  MSRUAS_PROOF_VALIDATOR_VERSION,
  validateCompiledCurriculum,
} from './msruas-curriculum-compiler.js'
import { inferObservableRisk } from './inference-engine.js'
import { buildMonitoringDecision } from './monitoring-engine.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyStageKey } from './stage-policy.js'
import {
  PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD,
  governProofQueueStage,
  type ProofQueueCandidate,
  type ProofQueueGovernanceStageKey,
  type ProofQueuePriorCaseState,
  type ProofQueueRole,
} from './proof-queue-governance.js'
import {
  buildObservableFeaturePayload,
  featureHash,
  PROOF_CORPUS_MANIFEST,
  scenarioFamilyForSeed,
  type ObservableFeaturePayload,
  type ObservableLabelPayload,
  type ModelBackedRiskOutput,
  type ObservableSourceRefs,
  type ProofRunModelMetadata,
  type RiskHeadKey,
  RISK_CHALLENGER_MODEL_VERSION,
  RISK_CORRELATION_ARTIFACT_VERSION,
  RISK_FEATURE_SCHEMA_VERSION,
  RISK_PRODUCTION_MODEL_VERSION,
  createProofRiskModelTrainingBuilder,
  scoreObservableRiskWithModel,
  summarizeProofRiskModelEvaluation,
  type CorrelationArtifact,
  type ProductionRiskModelArtifact,
} from './proof-risk-model.js'
import {
  calculateCgpa,
  calculateSgpa,
  evaluateCourseStatus,
  type GradePointSubjectAttempt,
  type MsruasDeterministicPolicy,
} from './msruas-rules.js'
import {
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_BRANCH_ID,
  MSRUAS_PROOF_DEPARTMENT_ID,
  PROOF_FACULTY,
  PROOF_TERM_DEFS,
} from './msruas-proof-sandbox.js'
import { DEFAULT_POLICY, type ResolvedPolicy } from '../modules/admin-structure.js'

const INFERENCE_MODEL_VERSION = 'observable-inference-v2'
const MONITORING_POLICY_VERSION = 'monitoring-policy-v2'
const WORLD_ENGINE_VERSION = 'world-engine-v2'
const RISK_ARTIFACT_REBUILD_PAGE_SIZE = 10_000

type FacultyProofViewerRole = 'COURSE_LEADER' | 'MENTOR' | 'HOD' | 'SYSTEM_ADMIN' | null | undefined

function isFacultyProofQueueItemVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  matchesOwnedOffering: boolean
  matchesAssignedStudent: boolean
}) {
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.matchesOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.matchesAssignedStudent
  return input.matchesOwnedOffering || input.matchesAssignedStudent
}

function isFacultyProofStudentVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  visibleViaOwnedOffering: boolean
  visibleViaAssignedMentorScope: boolean
}) {
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.visibleViaOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.visibleViaAssignedMentorScope
  return input.visibleViaOwnedOffering || input.visibleViaAssignedMentorScope
}
const STUDENT_AGENT_CARD_VERSION = 1

const PLAYBACK_STAGE_DEFS = DEFAULT_STAGE_POLICY.stages.map(stage => ({
  key: stage.key,
  label: stage.label,
  description: stage.description,
  order: stage.order,
  semesterDayOffset: stage.semesterDayOffset,
}))

type PlaybackStageKey = StagePolicyStageKey

type StudentAgentPanelLabel = 'Observed' | 'Policy Derived' | 'Simulation Internal' | 'Human Action Log'

type StudentAgentCitation = {
  citationId: string
  label: string
  panelLabel: StudentAgentPanelLabel
  summary: string
}

type StudentAgentMessage = {
  studentAgentMessageId: string
  actorType: string
  messageType: string
  body: string
  citations: StudentAgentCitation[]
  guardrailCode: string | null
  createdAt: string
  updatedAt: string
}

type StudentAgentTimelineItem = {
  timelineItemId: string
  panelLabel: StudentAgentPanelLabel
  kind: 'semester-summary' | 'intervention' | 'reassessment' | 'resolution' | 'elective-fit'
  title: string
  detail: string
  occurredAt: string
  semesterNumber: number | null
  citations: StudentAgentCitation[]
}

type StudentAgentCardPayload = {
  studentAgentCardId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  cardVersion: number
  sourceSnapshotHash: string
  disclaimer: string
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

type StudentRiskExplorerPayload = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  disclaimer: string
  runContext: StudentAgentCardPayload['runContext']
  checkpointContext: StudentAgentCardPayload['checkpointContext']
  student: StudentAgentCardPayload['student']
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

type ProofCheckpointSummaryPayload = {
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

type RuntimeCourse = {
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

type RuntimeElectiveOption = {
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

type SimulatedQuestionTemplate = {
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

type BlueprintNode = {
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

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
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

type ScenarioProfile = {
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

  const outcomes = coDefinitionsForCourse(input.course).map((outcome, index) => {
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
type ProofRecoveryState = 'under_watch' | 'confirmed_improvement'

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
          observedState: parseJson(baseRow.observedStateJson, {} as Record<string, unknown>),
          createdAt: baseRow.createdAt,
          updatedAt: baseRow.updatedAt,
        }
      }

      const parsedRows = semesterRows.map(row => ({
        studentObservedSemesterStateId: row.studentObservedSemesterStateId,
        termId: row.termId,
        sectionCode: row.sectionCode,
        observedState: parseJson(row.observedStateJson, {} as Record<string, unknown>),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
      const latestRow = semesterRows.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? baseRow
      const latestState = parseJson(latestRow.observedStateJson, {} as Record<string, unknown>)
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

type StageCourseProjectionSource = {
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

type StageEvidenceSnapshot = {
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

function addDaysIso(isoString: string, days: number) {
  const date = new Date(isoString)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function playbackCheckpointNowIso(runCreatedAt: string, semesterNumber: number, stage: (typeof PLAYBACK_STAGE_DEFS)[number]) {
  return addDaysIso(runCreatedAt, ((semesterNumber - 1) * 140) + stage.semesterDayOffset)
}

export function stageCourseworkEvidenceForStage(input: {
  stageKey: PlaybackStageKey
  quizPct: number | null
  assignmentPct: number | null
}) {
  if (input.stageKey === 'semester-start' || input.stageKey === 'post-tt1') {
    return {
      quizPct: null,
      assignmentPct: null,
    }
  }
  return {
    quizPct: input.quizPct == null ? null : safePct(input.quizPct),
    assignmentPct: input.assignmentPct == null ? null : safePct(input.assignmentPct),
  }
}

function attendanceCheckpointCountForStage(stageKey: PlaybackStageKey) {
  switch (stageKey) {
    case 'semester-start':
      return 1
    case 'post-tt1':
      return 2
    case 'post-reassessment':
      return 3
    case 'post-tt2':
    case 'post-see':
    case 'semester-close':
      return 4
  }
}

function includedAttendanceForSourceStage(source: StageCourseProjectionSource, stageKey: PlaybackStageKey) {
  return source.attendanceHistory.slice(0, attendanceCheckpointCountForStage(stageKey))
}

function questionComponentsForStage(stageKey: PlaybackStageKey) {
  switch (stageKey) {
    case 'semester-start':
      return [] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-tt1':
    case 'post-reassessment':
      return ['tt1'] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-tt2':
      return ['tt1', 'tt2'] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-see':
    case 'semester-close':
      return ['tt1', 'tt2', 'see'] as Array<'tt1' | 'tt2' | 'see'>
  }
}

function stageWeakCourseOutcomes(rows: Array<typeof studentCoStates.$inferSelect>, stageKey: PlaybackStageKey) {
  return summarizeCoRows(rows)
    .filter(row => {
      if (stageKey === 'semester-start') return false
      if (stageKey === 'post-tt1' || stageKey === 'post-reassessment') return row.tt1Pct < 45
      if (stageKey === 'post-tt2') return row.tt2Pct < 45
      return Math.min(row.tt2Pct || 100, row.seePct || 100) < 45 || row.seePct < 45
    })
    .slice(0, 6)
}

function pickInterventionResponseForStage(response: StageCourseProjectionSource['interventionResponse'], stageKey: PlaybackStageKey) {
  if (!response) return null
  if (stageKey === 'semester-start' || stageKey === 'post-tt1') return null
  if (stageKey === 'post-reassessment') {
    if (response.accepted) return response.completed ? 0.05 : 0.02
    return -0.05
  }
  return response.residual
}

function counterfactualAdjustment(actionTaken: string | null) {
  if (!actionTaken) {
    return {
      attendancePenalty: 0,
      tt2Penalty: 0,
      seePenalty: 0,
      weakSignalPenalty: 0,
      consistencyBuff: 0,
    }
  }
  switch (actionTaken) {
    case 'attendance-recovery-follow-up':
      return { attendancePenalty: 8, tt2Penalty: 0, seePenalty: 0, weakSignalPenalty: 0, consistencyBuff: 0.04 }
    case 'targeted-tutoring':
      return { attendancePenalty: 0, tt2Penalty: 14, seePenalty: 10, weakSignalPenalty: 2, consistencyBuff: 0.15 }
    case 'prerequisite-bridge':
      return { attendancePenalty: 0, tt2Penalty: 10, seePenalty: 8, weakSignalPenalty: 2, consistencyBuff: 0.08 }
    case 'mentor-check-in':
      return { attendancePenalty: 0, tt2Penalty: 4, seePenalty: 3, weakSignalPenalty: 0, consistencyBuff: 0.06 }
    case 'structured-study-plan':
      return { attendancePenalty: 0, tt2Penalty: 8, seePenalty: 6, weakSignalPenalty: 2, consistencyBuff: 0.20 }
    default:
      return { attendancePenalty: 0, tt2Penalty: 3, seePenalty: 2, weakSignalPenalty: 0, consistencyBuff: 0.02 }
  }
}

function mapActionToTaskType(actionTaken: string | null) {
  switch (actionTaken) {
    case 'attendance-recovery-follow-up':
      return 'Attendance'
    case 'prerequisite-bridge':
      return 'Remedial'
    case 'faculty-outreach':
    case 'mentor-outreach':
    case 'outreach-plus-tutoring':
    case 'pre-see-rescue':
    case 'mentor-check-in':
      return 'Follow-up'
    case 'targeted-tutoring':
    case 'structured-study-plan':
      return 'Academic'
    default:
      return 'Follow-up'
  }
}

type PolicyActionCode =
  | 'no-action'
  | 'alert-only'
  | 'faculty-outreach'
  | 'mentor-outreach'
  | 'attendance-recovery-follow-up'
  | 'prerequisite-bridge'
  | 'targeted-tutoring'
  | 'structured-study-plan'
  | 'outreach-plus-tutoring'
  | 'pre-see-rescue'
  | 'mentor-check-in'

export type PolicyPhenotype =
  | 'attendance-dominant'
  | 'prerequisite-dominant'
  | 'academic-weakness'
  | 'persistent-nonresponse'
  | 'late-semester-acute'
  | 'diffuse-amber'

const POLICY_PHENOTYPE_ORDER: PolicyPhenotype[] = [
  'late-semester-acute',
  'persistent-nonresponse',
  'prerequisite-dominant',
  'academic-weakness',
  'attendance-dominant',
  'diffuse-amber',
]

const POLICY_EFFICACY_SUPPORT_THRESHOLD = 250

type PolicyPhenotypeAnalysis = {
  policyPhenotype: PolicyPhenotype
  attendanceDominant: boolean
  prerequisiteDominant: boolean
  academicWeakness: boolean
  persistentNonresponse: boolean
  lateSemesterAcute: boolean
  diffuseAmber: boolean
}

type ActionPolicyCandidate = {
  action: PolicyActionCode
  utility: number
  nextCheckpointBenefitScaled: number
  stableRecoveryScore: number
  semesterCloseBenefitScaled: number
  relapsePenalty: number
  capacityCost: number
  rationale: string
}

type PolicyDiagnosticCheckpointRow = {
  simulationStageCheckpointId: string
  stageOrder: number
}

type PolicyDiagnosticStudentRow = {
  simulationRunId: string
  simulationStageCheckpointId: string
  studentId: string
  offeringId: string | null
  semesterNumber: number
  courseCode: string
  riskProbScaled: number
  riskBand: string
  noActionRiskProbScaled: number
  simulatedActionTaken: string | null
  projectionJson: string
}

function capacityCostForAction(action: PolicyActionCode) {
  switch (action) {
    case 'outreach-plus-tutoring':
      return 0.95
    case 'pre-see-rescue':
      return 0.82
    case 'targeted-tutoring':
    case 'prerequisite-bridge':
      return 0.68
    case 'mentor-outreach':
    case 'mentor-check-in':
      return 0.54
    case 'attendance-recovery-follow-up':
    case 'faculty-outreach':
      return 0.36
    case 'structured-study-plan':
      return 0.22
    case 'alert-only':
      return 0.12
    case 'no-action':
    default:
      return 0
  }
}

function availablePolicyActionsForStage(stageKey: PlaybackStageKey) {
  const base: PolicyActionCode[] = [
    'no-action',
    'alert-only',
    'faculty-outreach',
    'mentor-outreach',
    'attendance-recovery-follow-up',
    'prerequisite-bridge',
    'targeted-tutoring',
    'structured-study-plan',
    'outreach-plus-tutoring',
  ]
  if (stageKey === 'post-tt2' || stageKey === 'post-see' || stageKey === 'semester-close') {
    base.push('pre-see-rescue')
  }
  return base
}

function lowAcademicEvidence(evidence: {
  weakCoCount: number
  weakQuestionCount: number
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
}) {
  return evidence.weakCoCount >= 2
    || evidence.weakQuestionCount >= 4
    || (evidence.tt1Pct != null && evidence.tt1Pct < 50)
    || (evidence.tt2Pct != null && evidence.tt2Pct < 50)
    || (evidence.seePct != null && evidence.seePct < 50)
}

export function classifyPolicyPhenotype(input: {
  stageKey: PlaybackStageKey
  evidence: StageEvidenceSnapshot
  riskBand: 'High' | 'Medium' | 'Low'
  prerequisiteSummary: {
    prerequisiteAveragePct: number
    prerequisiteFailureCount: number
    prerequisiteWeakCourseCodes: string[]
    downstreamDependencyLoad: number
    weakPrerequisiteChainCount: number
    repeatedWeakPrerequisiteFamilyCount: number
  }
}): PolicyPhenotypeAnalysis {
  const attendanceDominant = input.evidence.attendancePct < 75 || input.evidence.attendanceHistoryRiskCount >= 2
  const persistentNonresponse = (input.evidence.interventionResponseScore ?? 0) < -0.03
  const lateSemesterAcute = input.riskBand === 'High' && (
    input.stageKey === 'post-tt2' || input.stageKey === 'post-see' || input.stageKey === 'semester-close'
  )
  const prerequisiteDominant = (
    input.prerequisiteSummary.prerequisiteFailureCount > 0
    || (input.prerequisiteSummary.prerequisiteWeakCourseCodes.length > 0 && input.prerequisiteSummary.prerequisiteAveragePct < 55)
    || input.prerequisiteSummary.weakPrerequisiteChainCount >= 2
    || input.prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount > 0
  ) && (
    input.evidence.backlogCount > 0
    || lowAcademicEvidence(input.evidence)
  )
  const academicWeakness = input.evidence.attendancePct >= 75
    && !prerequisiteDominant
    && !lateSemesterAcute
    && lowAcademicEvidence(input.evidence)
  const diffuseAmber = input.riskBand === 'Medium'
    && !lateSemesterAcute
    && !persistentNonresponse
    && !prerequisiteDominant
    && !academicWeakness
    && !attendanceDominant

  if (lateSemesterAcute) {
    return {
      policyPhenotype: 'late-semester-acute',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute: true,
      diffuseAmber,
    }
  }
  if (persistentNonresponse) {
    return {
      policyPhenotype: 'persistent-nonresponse',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse: true,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (prerequisiteDominant) {
    return {
      policyPhenotype: 'prerequisite-dominant',
      attendanceDominant,
      prerequisiteDominant: true,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (academicWeakness) {
    return {
      policyPhenotype: 'academic-weakness',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness: true,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (attendanceDominant) {
    return {
      policyPhenotype: 'attendance-dominant',
      attendanceDominant: true,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  return {
    policyPhenotype: 'diffuse-amber',
    attendanceDominant,
    prerequisiteDominant,
    academicWeakness,
    persistentNonresponse,
    lateSemesterAcute,
    diffuseAmber: true,
  }
}

function buildActionPolicyComparison(input: {
  stageKey: PlaybackStageKey
  evidence: StageEvidenceSnapshot
  riskBand: 'High' | 'Medium' | 'Low'
  recommendedAction: string
  prerequisiteSummary: {
    prerequisiteAveragePct: number
    prerequisiteFailureCount: number
    prerequisiteWeakCourseCodes: string[]
    downstreamDependencyLoad: number
    weakPrerequisiteChainCount: number
    repeatedWeakPrerequisiteFamilyCount: number
  }
}) {
  const phenotype = classifyPolicyPhenotype(input)
  const attendanceDominant = phenotype.attendanceDominant
  const academicWeakness = phenotype.academicWeakness
  const prerequisitePressure = phenotype.prerequisiteDominant
  const nonresponsePressure = phenotype.persistentNonresponse
  const lateSemesterAcute = phenotype.lateSemesterAcute
  const diffuseAmber = phenotype.diffuseAmber

  const scoreAction = (action: PolicyActionCode): ActionPolicyCandidate => {
    let nextCheckpointBenefitScaled = 0
    let stableRecoveryScore = 0
    let semesterCloseBenefitScaled = 0
    let relapsePenalty = 0
    const rationale: string[] = []

    if (action === 'no-action') {
      relapsePenalty = input.riskBand === 'High' ? 0.42 : input.riskBand === 'Medium' ? 0.18 : 0.04
      rationale.push('No intervention applied.')
    }
    if (action === 'alert-only') {
      nextCheckpointBenefitScaled += input.riskBand === 'High' ? 2 : 1
      stableRecoveryScore += diffuseAmber ? 0.08 : 0.04
      relapsePenalty += attendanceDominant || prerequisitePressure ? 0.22 : 0.12
      rationale.push('Low-touch alert route.')
    }
    if (action === 'faculty-outreach') {
      nextCheckpointBenefitScaled += attendanceDominant ? 5 : 2
      stableRecoveryScore += attendanceDominant ? 0.16 : 0.08
      semesterCloseBenefitScaled += attendanceDominant ? 3 : 1
      relapsePenalty += nonresponsePressure ? 0.12 : 0.06
      rationale.push('Faculty outreach addresses attendance or momentum drift.')
    }
    if (action === 'mentor-outreach' || action === 'mentor-check-in') {
      nextCheckpointBenefitScaled += input.riskBand === 'High' ? 6 : 3
      stableRecoveryScore += nonresponsePressure ? 0.18 : 0.12
      semesterCloseBenefitScaled += input.riskBand === 'High' ? 4 : 2
      relapsePenalty += attendanceDominant ? 0.08 : 0.04
      rationale.push('Mentor-led follow-up supports persistent or volatile risk.')
    }
    if (action === 'attendance-recovery-follow-up') {
      nextCheckpointBenefitScaled += attendanceDominant ? 10 : 1
      stableRecoveryScore += attendanceDominant ? 0.24 : 0.04
      semesterCloseBenefitScaled += attendanceDominant ? 6 : 1
      relapsePenalty += attendanceDominant ? 0.04 : 0.16
      rationale.push('Attendance pressure is the dominant failure mode.')
    }
    if (action === 'prerequisite-bridge') {
      nextCheckpointBenefitScaled += prerequisitePressure ? 8 : 2
      stableRecoveryScore += prerequisitePressure ? 0.22 : 0.06
      semesterCloseBenefitScaled += prerequisitePressure ? 7 : 2
      relapsePenalty += prerequisitePressure ? 0.06 : 0.16
      rationale.push('Carryover and prerequisite weakness need bridge support.')
    }
    if (action === 'targeted-tutoring') {
      nextCheckpointBenefitScaled += academicWeakness ? 11 : 3
      stableRecoveryScore += academicWeakness ? 0.28 : 0.1
      semesterCloseBenefitScaled += academicWeakness ? 8 : 3
      relapsePenalty += nonresponsePressure ? 0.12 : 0.05
      rationale.push('Weak CO/question evidence points to targeted tutoring.')
    }
    if (action === 'structured-study-plan') {
      nextCheckpointBenefitScaled += diffuseAmber ? 5 : 2
      stableRecoveryScore += diffuseAmber ? 0.16 : 0.08
      semesterCloseBenefitScaled += diffuseAmber ? 4 : 2
      relapsePenalty += academicWeakness || prerequisitePressure ? 0.18 : 0.08
      rationale.push('Diffuse medium risk without one dominant failure mode.')
    }
    if (action === 'outreach-plus-tutoring') {
      nextCheckpointBenefitScaled += academicWeakness ? 12 : 4
      stableRecoveryScore += (academicWeakness && nonresponsePressure) ? 0.3 : 0.14
      semesterCloseBenefitScaled += academicWeakness ? 9 : 4
      relapsePenalty += nonresponsePressure ? 0.08 : 0.04
      rationale.push('Combined outreach and tutoring addresses persistent academic risk.')
    }
    if (action === 'pre-see-rescue') {
      nextCheckpointBenefitScaled += lateSemesterAcute ? 13 : 2
      stableRecoveryScore += lateSemesterAcute ? 0.22 : 0.04
      semesterCloseBenefitScaled += lateSemesterAcute ? 10 : 1
      relapsePenalty += lateSemesterAcute ? 0.12 : 0.2
      rationale.push('Late-semester rescue is appropriate for acute endgame risk.')
    }

    if (attendanceDominant && !['attendance-recovery-follow-up', 'faculty-outreach', 'mentor-outreach', 'outreach-plus-tutoring'].includes(action)) {
      relapsePenalty += 0.1
    }
    if (prerequisitePressure && !['prerequisite-bridge', 'outreach-plus-tutoring'].includes(action)) {
      relapsePenalty += 0.08
    }
    if (academicWeakness && !['targeted-tutoring', 'outreach-plus-tutoring', 'pre-see-rescue'].includes(action)) {
      relapsePenalty += 0.07
    }

    switch (phenotype.policyPhenotype) {
      case 'late-semester-acute':
        if (action === 'pre-see-rescue') {
          nextCheckpointBenefitScaled += 4
          stableRecoveryScore += 0.08
          semesterCloseBenefitScaled += 3
        }
        break
      case 'persistent-nonresponse':
        if (action === 'outreach-plus-tutoring') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.08
        }
        if (action === 'mentor-outreach') {
          nextCheckpointBenefitScaled += 2
          stableRecoveryScore += 0.05
        }
        break
      case 'prerequisite-dominant':
        if (action === 'prerequisite-bridge') {
          nextCheckpointBenefitScaled += 4
          stableRecoveryScore += 0.06
          semesterCloseBenefitScaled += 3
        }
        if (action === 'targeted-tutoring') relapsePenalty += 0.05
        break
      case 'academic-weakness':
        if (action === 'targeted-tutoring') {
          nextCheckpointBenefitScaled += 5
          stableRecoveryScore += 0.08
          semesterCloseBenefitScaled += 4
        }
        if (action === 'structured-study-plan') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.06
          semesterCloseBenefitScaled += 3
        }
        break
      case 'attendance-dominant':
        if (action === 'attendance-recovery-follow-up') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.05
          semesterCloseBenefitScaled += 2
        }
        if (action === 'faculty-outreach') stableRecoveryScore += 0.03
        break
      case 'diffuse-amber':
      default:
        if (action === 'structured-study-plan') {
          nextCheckpointBenefitScaled += 2
          stableRecoveryScore += 0.04
        }
        break
    }

    const capacityCost = capacityCostForAction(action)
    const utility = roundToFour(
      (0.35 * (nextCheckpointBenefitScaled / 10))
      + (0.35 * stableRecoveryScore)
      + (0.2 * (semesterCloseBenefitScaled / 10))
      - (0.05 * relapsePenalty)
      - (0.05 * capacityCost),
    )
    return {
      action,
      utility,
      nextCheckpointBenefitScaled: roundToFour(nextCheckpointBenefitScaled),
      stableRecoveryScore: roundToFour(stableRecoveryScore),
      semesterCloseBenefitScaled: roundToFour(semesterCloseBenefitScaled),
      relapsePenalty: roundToFour(relapsePenalty),
      capacityCost: roundToFour(capacityCost),
      rationale: rationale.join(' '),
    }
  }

  const candidates = availablePolicyActionsForStage(input.stageKey).map(scoreAction)
    .sort((left, right) => right.utility - left.utility || left.action.localeCompare(right.action))
  const bestCandidate = candidates[0] ?? null
  const noAction = candidates.find(candidate => candidate.action === 'no-action') ?? null
  const recommendedAction = input.riskBand === 'Low'
    || /routine monitoring/i.test(input.recommendedAction)
    || !bestCandidate
    || bestCandidate.action === 'no-action'
    || (noAction && bestCandidate.utility <= noAction.utility)
    ? null
    : bestCandidate.action

  return {
    policyPhenotype: phenotype.policyPhenotype,
    recommendedAction,
    candidates,
    policyRationale: bestCandidate?.rationale ?? 'Routine monitoring only.',
  }
}

function inferActionPath(input: {
  stageKey: PlaybackStageKey
  evidence: StageEvidenceSnapshot
  riskBand: 'High' | 'Medium' | 'Low'
  recommendedAction: string
  prerequisiteSummary: Parameters<typeof buildActionPolicyComparison>[0]['prerequisiteSummary']
}) {
  return buildActionPolicyComparison(input).recommendedAction
}

function queueDispositionForCheckpoint(input: {
  riskBand: 'High' | 'Medium' | 'Low'
  policyPhenotype: PolicyPhenotype
  recommendedPolicyAction: string | null
  counterfactualLiftScaled: number
}) {
  if (!input.recommendedPolicyAction || input.riskBand === 'Low') {
    return {
      actionable: false,
      watch: false,
    }
  }
  if (input.riskBand === 'High') {
    return {
      actionable: true,
      watch: false,
    }
  }
  if (
    input.riskBand === 'Medium'
    && input.policyPhenotype !== 'diffuse-amber'
    && input.counterfactualLiftScaled >= PROOF_QUEUE_ACTIONABLE_LIFT_THRESHOLD
  ) {
    return {
      actionable: true,
      watch: false,
    }
  }
  return {
    actionable: false,
    watch: true,
  }
}

function safePct(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return clamp(roundToTwo(value), 0, 100)
}

function buildStageEvidenceSnapshot(input: {
  source: StageCourseProjectionSource
  stageKey: PlaybackStageKey
  policy: ResolvedPolicy
  templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
}) {
  const includedAttendance = input.source.attendanceHistory.slice(0, attendanceCheckpointCountForStage(input.stageKey))
  const latestAttendance = includedAttendance[includedAttendance.length - 1]
  const weakCourseOutcomes = stageWeakCourseOutcomes(input.source.coRows, input.stageKey)
  const questionRows = input.source.questionRows.filter(row => questionComponentsForStage(input.stageKey).includes(row.componentType as 'tt1' | 'tt2' | 'see'))
  const questionPatterns = summarizeQuestionPatterns({
    rows: questionRows,
    templatesById: input.templatesById,
  })
  const courseworkEvidence = stageCourseworkEvidenceForStage({
    stageKey: input.stageKey,
    quizPct: input.source.quizPct,
    assignmentPct: input.source.assignmentPct,
  })
  const snapshot: StageEvidenceSnapshot = {
    attendancePct: latestAttendance?.attendancePct ?? input.source.attendancePct,
    tt1Pct: (input.stageKey === 'post-tt1' || input.stageKey === 'post-reassessment' || input.stageKey === 'post-tt2' || input.stageKey === 'post-see' || input.stageKey === 'semester-close')
      ? input.source.tt1Pct
      : null,
    tt2Pct: (input.stageKey === 'post-tt2' || input.stageKey === 'post-see' || input.stageKey === 'semester-close')
      ? input.source.tt2Pct
      : null,
    quizPct: courseworkEvidence.quizPct,
    assignmentPct: courseworkEvidence.assignmentPct,
    seePct: (input.stageKey === 'post-see' || input.stageKey === 'semester-close')
      ? input.source.seePct
      : null,
    weakCoCount: weakCourseOutcomes.length,
    weakQuestionCount: questionPatterns.weakQuestionCount,
    attentionAreas: [],
    attendanceHistoryRiskCount: includedAttendance.filter(entry => entry.attendancePct < input.policy.attendanceRules.minimumRequiredPercent).length,
    currentCgpa: input.stageKey === 'semester-close' ? input.source.closingCgpa : input.source.previousCgpa,
    backlogCount: input.stageKey === 'semester-close' ? input.source.closingBacklogCount : input.source.previousBacklogCount,
    interventionResponseScore: pickInterventionResponseForStage(input.source.interventionResponse, input.stageKey),
    evidenceWindow: `${input.source.semesterNumber}-${input.stageKey}`,
    weakCourseOutcomes,
    questionPatterns,
  }
  return snapshot
}

function buildNoActionSnapshot(input: {
  evidence: StageEvidenceSnapshot
  actionTaken: string | null
  stageKey: PlaybackStageKey
}) {
  if (!input.actionTaken || (input.stageKey !== 'post-reassessment' && input.stageKey !== 'post-tt2' && input.stageKey !== 'post-see' && input.stageKey !== 'semester-close')) {
    return {
      ...input.evidence,
      interventionResponseScore: input.evidence.interventionResponseScore == null ? null : Math.min(input.evidence.interventionResponseScore, 0),
    }
  }
  const adjustment = counterfactualAdjustment(input.actionTaken)
  return {
    ...input.evidence,
    attendancePct: clamp(input.evidence.attendancePct - adjustment.attendancePenalty, 0, 100),
    tt2Pct: input.evidence.tt2Pct == null ? null : clamp(input.evidence.tt2Pct - adjustment.tt2Penalty, 0, 100),
    seePct: input.evidence.seePct == null ? null : clamp(input.evidence.seePct - adjustment.seePenalty, 0, 100),
    weakCoCount: input.evidence.weakCoCount + adjustment.weakSignalPenalty,
    weakQuestionCount: input.evidence.weakQuestionCount + adjustment.weakSignalPenalty,
    interventionResponseScore: input.evidence.interventionResponseScore == null ? -0.05 : Math.min(input.evidence.interventionResponseScore - adjustment.consistencyBuff, -0.02),
  }
}

function courseDisciplineFamily(courseCode: string) {
  const normalized = courseCode.trim().toUpperCase()
  const match = normalized.match(/^[A-Z]+/)
  return match?.[0] ?? (normalized || 'GENERAL')
}

function collectGraphDistances(startNodeId: string, adjacency: Map<string, string[]>) {
  const distances = new Map<string, number>()
  const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: startNodeId, distance: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    const nextNodeIds = adjacency.get(current.nodeId) ?? []
    nextNodeIds.forEach(nextNodeId => {
      const nextDistance = current.distance + 1
      const existing = distances.get(nextNodeId)
      if (existing != null && existing <= nextDistance) return
      distances.set(nextNodeId, nextDistance)
      queue.push({ nodeId: nextNodeId, distance: nextDistance })
    })
  }
  return distances
}

function prerequisiteSummaryForSource(input: {
  source: StageCourseProjectionSource
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  prerequisiteNodeIdsByTargetNodeId: Map<string, string[]>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
}) {
  if (!input.source.curriculumNodeId) {
    return {
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [] as string[],
      prerequisiteWeakCourseCodes: [] as string[],
      downstreamDependencyLoad: 0,
      weakPrerequisiteChainCount: 0,
      repeatedWeakPrerequisiteFamilyCount: 0,
    }
  }
  const prerequisiteNodeIds = input.prerequisiteNodeIdsByTargetNodeId.get(input.source.curriculumNodeId) ?? []
  const transitivePrerequisiteDistances = collectGraphDistances(input.source.curriculumNodeId, input.prerequisiteNodeIdsByTargetNodeId)
  const prerequisiteSources = prerequisiteNodeIds
    .map(nodeId => input.sourceByStudentNodeId.get(`${input.source.studentId}::${nodeId}`) ?? null)
    .filter((row): row is StageCourseProjectionSource => !!row)
    .filter(row => row.semesterNumber < input.source.semesterNumber)
  const transitivePrerequisiteSources = [...transitivePrerequisiteDistances.entries()]
    .map(([nodeId, distance]) => ({
      source: input.sourceByStudentNodeId.get(`${input.source.studentId}::${nodeId}`) ?? null,
      distance,
    }))
    .filter((entry): entry is { source: StageCourseProjectionSource; distance: number } => !!entry.source)
    .filter(entry => entry.source.semesterNumber < input.source.semesterNumber)
  const prerequisiteAveragePct = prerequisiteSources.length > 0
    ? roundToOne(average(prerequisiteSources.map(row => row.finalMark)))
    : 0
  const prerequisiteFailureCount = prerequisiteSources.filter(row => row.result !== 'Passed').length
  const prerequisiteWeakCourseCodes = prerequisiteSources
    .filter(row => row.result !== 'Passed' || row.finalMark < 55)
    .map(row => row.courseCode)
  const weakTransitiveSources = transitivePrerequisiteSources.filter(entry =>
    entry.source.result !== 'Passed' || entry.source.finalMark < 55)
  const repeatedWeakPrerequisiteFamilyCount = [...weakTransitiveSources.reduce((accumulator, entry) => {
    const family = courseDisciplineFamily(entry.source.courseCode)
    accumulator.set(family, (accumulator.get(family) ?? 0) + 1)
    return accumulator
  }, new Map<string, number>()).values()].filter(count => count >= 2).length
  const downstreamDependencyLoad = (() => {
    const downstreamDistances = collectGraphDistances(input.source.curriculumNodeId!, input.downstreamNodeIdsBySourceNodeId)
    if (downstreamDistances.size === 0) return 0
    const weightedLoad = [...downstreamDistances.values()].reduce((sum, distance) => sum + (1 / Math.max(1, distance)), 0)
    return roundToFour(clamp(weightedLoad / 4, 0, 1))
  })()
  return {
    prerequisiteAveragePct,
    prerequisiteFailureCount,
    prerequisiteCourseCodes: prerequisiteSources.map(row => row.courseCode),
    prerequisiteWeakCourseCodes,
    downstreamDependencyLoad,
    weakPrerequisiteChainCount: weakTransitiveSources.length,
    repeatedWeakPrerequisiteFamilyCount,
  }
}

function downstreamCarryoverLabelForSource(input: {
  source: StageCourseProjectionSource
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
}) {
  if (!input.source.curriculumNodeId) return 0 as const
  const downstreamNodeIds = input.downstreamNodeIdsBySourceNodeId.get(input.source.curriculumNodeId) ?? []
  const downstreamSources = downstreamNodeIds
    .map(nodeId => input.sourceByStudentNodeId.get(`${input.source.studentId}::${nodeId}`) ?? null)
    .filter((row): row is StageCourseProjectionSource => !!row)
    .filter(row => row.semesterNumber > input.source.semesterNumber)
  return downstreamSources.some(row => row.result !== 'Passed' || row.finalMark < 50) ? 1 as const : 0 as const
}

export function ceMinimumPctForPolicy(policy: ResolvedPolicy) {
  return (policy.passRules.minimumCeMark / policy.passRules.ceMaximum) * 100
}

export function ceShortfallLabelFromPct(cePct: number, policy: ResolvedPolicy) {
  return cePct < ceMinimumPctForPolicy(policy) ? 1 as const : 0 as const
}

function ceShortfallLabel(source: StageCourseProjectionSource, policy: ResolvedPolicy) {
  return ceShortfallLabelFromPct(source.cePct, policy)
}

function seeShortfallLabel(source: StageCourseProjectionSource, policy: ResolvedPolicy) {
  const seeMinimumPct = (policy.passRules.minimumSeeMark / policy.passRules.seeMaximum) * 100
  return source.seePct < seeMinimumPct ? 1 as const : 0 as const
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
      .filter(row => (checkpointCountByRunId.get(row.simulationRunId) ?? 0) >= 36 && (stageEvidenceCountByRunId.get(row.simulationRunId) ?? 0) > 0)
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

function stageSummaryPayload(input: {
  checkpoint: typeof simulationStageCheckpoints.$inferInsert
  studentRows: Array<typeof simulationStageStudentProjections.$inferInsert>
  queueRows: Array<typeof simulationStageQueueProjections.$inferInsert>
  offeringRows: Array<typeof simulationStageOfferingProjections.$inferInsert>
  electiveVisibleCount: number
}) {
  const queueDetails = input.queueRows.map(row => ({
    row,
    detail: parseJson(row.detailJson, {} as Record<string, unknown>),
  }))
  const highRiskCount = input.studentRows.filter(row => row.riskBand === 'High').length
  const mediumRiskCount = input.studentRows.filter(row => row.riskBand === 'Medium').length
  const openQueueCount = queueDetails.filter(item =>
    item.row.status === 'Open'
    && Boolean(item.detail.primaryCase)
    && Boolean(item.detail.countsTowardCapacity)).length
  const watchQueueCount = input.queueRows.filter(row => row.status === 'Watching').length
  const resolvedQueueCount = input.queueRows.filter(row => row.status === 'Resolved').length
  const watchStudentCount = new Set(
    input.studentRows
      .filter(row => row.queueState === 'watch')
      .map(row => row.studentId),
  ).size
  const averageRiskDeltaScaled = roundToOne(average(
    input.studentRows.map(row => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      return Number(payload.riskChangeFromPreviousCheckpointScaled ?? payload.riskDeltaScaled ?? 0)
    }),
  ))
  const averageCounterfactualLiftScaled = roundToOne(average(
    input.studentRows.map(row => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      return Number(payload.counterfactualLiftScaled ?? ((payload.noActionComparator as Record<string, unknown> | undefined)?.deltaScaled ?? 0))
    }),
  ))
  return {
    simulationStageCheckpointId: input.checkpoint.simulationStageCheckpointId,
    simulationRunId: input.checkpoint.simulationRunId,
    semesterNumber: input.checkpoint.semesterNumber,
    stageKey: input.checkpoint.stageKey,
    stageLabel: input.checkpoint.stageLabel,
    stageDescription: input.checkpoint.stageDescription,
    stageOrder: input.checkpoint.stageOrder,
    previousCheckpointId: input.checkpoint.previousCheckpointId ?? null,
    nextCheckpointId: input.checkpoint.nextCheckpointId ?? null,
    totalStudentProjectionCount: input.studentRows.length,
    studentCount: new Set(input.studentRows.map(row => row.studentId)).size,
    offeringCount: input.offeringRows.length,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount: input.studentRows.length - highRiskCount - mediumRiskCount,
    openQueueCount,
    watchQueueCount,
    watchStudentCount,
    resolvedQueueCount,
    noActionHighRiskCount: input.studentRows.filter(row => row.noActionRiskBand === 'High').length,
    electiveVisibleCount: input.electiveVisibleCount,
    averageRiskDeltaScaled,
    averageRiskChangeFromPreviousCheckpointScaled: averageRiskDeltaScaled,
    averageCounterfactualLiftScaled,
    stageAdvanceBlocked: openQueueCount > 0,
    blockingQueueItemCount: openQueueCount,
  }
}

function queueDecisionTypeFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'suppress'
  if (status === 'Watching') return 'watch'
  return 'alert'
}

function queueReassessmentStatusFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'Resolved'
  if (status === 'Watching') return 'Watching'
  return 'Open'
}

function queueStatusPriority(status: string | null | undefined) {
  if (status === 'Open') return 2
  if (status === 'Watching') return 1
  if (status === 'Resolved') return 0
  return -1
}

function queueProjectionDetail(row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert) {
  return parseJson(row.detailJson, {} as Record<string, unknown>)
}

function queueProjectionIsPrimaryCapacityCase(row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert) {
  const detail = queueProjectionDetail(row)
  return row.status === 'Open' && detail.primaryCase === true && detail.countsTowardCapacity === true
}

function queueProjectionAssignedFacultyId(row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert) {
  if (row.assignedFacultyId) return row.assignedFacultyId
  const detail = queueProjectionDetail(row)
  return typeof detail.assignedFacultyId === 'string' ? detail.assignedFacultyId : null
}

function parseProofCheckpointSummary(row: typeof simulationStageCheckpoints.$inferSelect): ProofCheckpointSummaryPayload {
  return parseJson(row.summaryJson, {
    simulationStageCheckpointId: row.simulationStageCheckpointId,
    simulationRunId: row.simulationRunId,
    semesterNumber: row.semesterNumber,
    stageKey: row.stageKey,
    stageLabel: row.stageLabel,
    stageDescription: row.stageDescription,
    stageOrder: row.stageOrder,
    previousCheckpointId: row.previousCheckpointId ?? null,
    nextCheckpointId: row.nextCheckpointId ?? null,
  } satisfies ProofCheckpointSummaryPayload)
}

function withProofPlaybackGate(summaries: ProofCheckpointSummaryPayload[]) {
  const firstBlockedIndex = summaries.findIndex(summary => Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0) > 0)
  return summaries.map((summary, index) => {
    const stageAdvanceBlocked = Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0) > 0
    const playbackAccessible = firstBlockedIndex === -1 || index <= firstBlockedIndex
    const blockedByCheckpointId = firstBlockedIndex !== -1 && index > firstBlockedIndex
      ? summaries[firstBlockedIndex]?.simulationStageCheckpointId ?? null
      : null
    return {
      ...summary,
      stageAdvanceBlocked,
      blockingQueueItemCount: Number(summary.blockingQueueItemCount ?? summary.openQueueCount ?? 0),
      playbackAccessible,
      blockedByCheckpointId,
      blockedProgressionReason: !playbackAccessible && blockedByCheckpointId
        ? `Playback is blocked until all queue items for checkpoint ${blockedByCheckpointId} are resolved.`
        : stageAdvanceBlocked
          ? 'Playback cannot advance past this checkpoint until all queue items are resolved.'
          : null,
    }
  })
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

function riskBandRank(value: string | null | undefined) {
  switch (value) {
    case 'High':
      return 3
    case 'Medium':
      return 2
    case 'Low':
      return 1
    default:
      return 0
  }
}

export function buildPolicyDiagnostics(input: {
  checkpointRows: PolicyDiagnosticCheckpointRow[]
  studentRows: PolicyDiagnosticStudentRow[]
}) {
  if (input.studentRows.length === 0) return null
  const checkpointById = new Map(input.checkpointRows.map(row => [row.simulationStageCheckpointId, row]))
  const grouped = new Map<string, PolicyDiagnosticStudentRow[]>()
  input.studentRows.forEach(row => {
    const key = `${row.simulationRunId}::${row.studentId}::${row.offeringId ?? row.courseCode}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  })

  const counterfactualActionStats = new Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const counterfactualPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const counterfactualPhenotypeActionStats = new Map<PolicyPhenotype, Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>>()
  const realizedActionStats = new Map<string, {
    support: number
    nextCheckpointImprovementTotal: number
    nextCheckpointSupport: number
    semesterCloseImprovementTotal: number
    semesterCloseSupport: number
    stableRecoveryCount: number
    stableRecoverySupport: number
    relapseCount: number
    relapseSupport: number
  }>()
  const realizedPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    nextCheckpointImprovementTotal: number
    nextCheckpointSupport: number
    semesterCloseImprovementTotal: number
    semesterCloseSupport: number
    stableRecoveryCount: number
    stableRecoverySupport: number
    relapseCount: number
    relapseSupport: number
  }>()
  let totalRecommendedActionCount = 0
  let totalActionCount = 0

  grouped.forEach(rows => {
    const ordered = rows
      .slice()
      .sort((left, right) => {
        const leftCheckpoint = checkpointById.get(left.simulationStageCheckpointId)
        const rightCheckpoint = checkpointById.get(right.simulationStageCheckpointId)
        return (left.semesterNumber - right.semesterNumber)
          || ((leftCheckpoint?.stageOrder ?? 0) - (rightCheckpoint?.stageOrder ?? 0))
      })
    ordered.forEach((row, index) => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      const actionPath = (payload.actionPath ?? {}) as Record<string, unknown>
      const counterfactualPolicyDiagnostics = (payload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
      const actionPolicyComparison = (actionPath.policyComparison ?? {}) as Record<string, unknown>
      const candidates = parseJson(JSON.stringify(actionPolicyComparison.candidates ?? []), [] as Array<{
        action: string
        utility: number
      }>)
      const recommendedAction = typeof counterfactualPolicyDiagnostics.recommendedAction === 'string'
        ? counterfactualPolicyDiagnostics.recommendedAction
        : typeof actionPolicyComparison.recommendedAction === 'string'
          ? actionPolicyComparison.recommendedAction
          : null
      const policyPhenotype = (
        typeof counterfactualPolicyDiagnostics.policyPhenotype === 'string'
          ? counterfactualPolicyDiagnostics.policyPhenotype
          : typeof actionPolicyComparison.policyPhenotype === 'string'
            ? actionPolicyComparison.policyPhenotype
            : 'diffuse-amber'
      ) as PolicyPhenotype
      const simulatedActionTaken = typeof actionPath.simulatedActionTaken === 'string'
        ? actionPath.simulatedActionTaken
        : typeof counterfactualPolicyDiagnostics.simulatedActionTaken === 'string'
          ? counterfactualPolicyDiagnostics.simulatedActionTaken
          : null
      const counterfactualLiftScaled = Number(
        counterfactualPolicyDiagnostics.counterfactualLiftScaled
        ?? payload.counterfactualLiftScaled
        ?? row.noActionRiskProbScaled - row.riskProbScaled,
      )

      if (recommendedAction) {
        totalRecommendedActionCount += 1
        const stats = counterfactualActionStats.get(recommendedAction) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        stats.support += 1
        stats.counterfactualLiftTotal += counterfactualLiftScaled
        const selectedUtility = candidates.find(candidate => candidate.action === recommendedAction)?.utility ?? 0
        const bestUtility = candidates[0]?.utility ?? selectedUtility
        stats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        counterfactualActionStats.set(recommendedAction, stats)

        const phenotypeStats = counterfactualPhenotypeStats.get(policyPhenotype) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        phenotypeStats.support += 1
        phenotypeStats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        phenotypeStats.counterfactualLiftTotal += counterfactualLiftScaled
        counterfactualPhenotypeStats.set(policyPhenotype, phenotypeStats)

        const phenotypeActionStats = counterfactualPhenotypeActionStats.get(policyPhenotype) ?? new Map<string, {
          support: number
          regretTotal: number
          counterfactualLiftTotal: number
        }>()
        const actionStats = phenotypeActionStats.get(recommendedAction) ?? {
          support: 0,
          regretTotal: 0,
          counterfactualLiftTotal: 0,
        }
        actionStats.support += 1
        actionStats.regretTotal += Math.max(0, bestUtility - selectedUtility)
        actionStats.counterfactualLiftTotal += counterfactualLiftScaled
        phenotypeActionStats.set(recommendedAction, actionStats)
        counterfactualPhenotypeActionStats.set(policyPhenotype, phenotypeActionStats)
      }

      if (!simulatedActionTaken) return

      totalActionCount += 1
      const realized = realizedActionStats.get(simulatedActionTaken) ?? {
        support: 0,
        nextCheckpointImprovementTotal: 0,
        nextCheckpointSupport: 0,
        semesterCloseImprovementTotal: 0,
        semesterCloseSupport: 0,
        stableRecoveryCount: 0,
        stableRecoverySupport: 0,
        relapseCount: 0,
        relapseSupport: 0,
      }
      realized.support += 1

      const nextRow = ordered[index + 1] ?? null
      if (nextRow) {
        const nextImprovement = row.riskProbScaled - nextRow.riskProbScaled
        realized.nextCheckpointImprovementTotal += nextImprovement
        realized.nextCheckpointSupport += 1
        const recovered = nextRow.riskProbScaled <= (row.riskProbScaled - 8)
          || riskBandRank(nextRow.riskBand) < riskBandRank(row.riskBand)
        realized.stableRecoverySupport += 1
        if (recovered) realized.stableRecoveryCount += 1
        const laterRows = ordered.slice(index + 2).filter(candidate => candidate.semesterNumber === row.semesterNumber)
        const relapsed = recovered && laterRows.some(candidate => (
          candidate.riskProbScaled >= (nextRow.riskProbScaled + 6)
          || riskBandRank(candidate.riskBand) > riskBandRank(nextRow.riskBand)
        ))
        realized.relapseSupport += 1
        if (relapsed) realized.relapseCount += 1
      }

      const semesterCloseRow = ordered
        .slice(index)
        .reverse()
        .find(candidate => candidate.semesterNumber === row.semesterNumber)
      if (semesterCloseRow) {
        realized.semesterCloseImprovementTotal += row.riskProbScaled - semesterCloseRow.riskProbScaled
        realized.semesterCloseSupport += 1
      }

      realizedActionStats.set(simulatedActionTaken, realized)
      const nextCheckpointImprovement = nextRow ? row.riskProbScaled - nextRow.riskProbScaled : null
      const stableRecovered = nextRow
        ? nextRow.riskProbScaled <= (row.riskProbScaled - 8) || riskBandRank(nextRow.riskBand) < riskBandRank(row.riskBand)
        : false
      const relapsedAfterRecovery = nextRow
        ? stableRecovered && ordered.slice(index + 2).filter(candidate => candidate.semesterNumber === row.semesterNumber).some(candidate => (
          candidate.riskProbScaled >= (nextRow.riskProbScaled + 6)
          || riskBandRank(candidate.riskBand) > riskBandRank(nextRow.riskBand)
        ))
        : false
      const semesterCloseImprovement = semesterCloseRow ? row.riskProbScaled - semesterCloseRow.riskProbScaled : null
      const realizedPhenotype = realizedPhenotypeStats.get(policyPhenotype) ?? {
        support: 0,
        nextCheckpointImprovementTotal: 0,
        nextCheckpointSupport: 0,
        semesterCloseImprovementTotal: 0,
        semesterCloseSupport: 0,
        stableRecoveryCount: 0,
        stableRecoverySupport: 0,
        relapseCount: 0,
        relapseSupport: 0,
      }
      realizedPhenotype.support += 1
      if (nextCheckpointImprovement != null) {
        realizedPhenotype.nextCheckpointImprovementTotal += nextCheckpointImprovement
        realizedPhenotype.nextCheckpointSupport += 1
        realizedPhenotype.stableRecoverySupport += 1
        if (stableRecovered) realizedPhenotype.stableRecoveryCount += 1
        realizedPhenotype.relapseSupport += 1
        if (relapsedAfterRecovery) realizedPhenotype.relapseCount += 1
      }
      if (semesterCloseImprovement != null) {
        realizedPhenotype.semesterCloseImprovementTotal += semesterCloseImprovement
        realizedPhenotype.semesterCloseSupport += 1
      }
      realizedPhenotypeStats.set(policyPhenotype, realizedPhenotype)
    })
  })

  const counterfactualByAction = Object.fromEntries([...counterfactualActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
    }]))

  const counterfactualByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
      support: 0,
      regretTotal: 0,
      counterfactualLiftTotal: 0,
    }
    const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
      support: number
      regretTotal: number
      counterfactualLiftTotal: number
    }>()
    return [phenotype, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
      byAction: Object.fromEntries([...actionStats.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([action, actionStat]) => [action, {
          support: actionStat.support,
          counterfactualLiftTotal: roundToTwo(actionStat.counterfactualLiftTotal),
          regretTotal: roundToFour(actionStat.regretTotal),
          averageCounterfactualLiftScaled: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) : 0,
          averageRegret: actionStat.support > 0 ? roundToFour(actionStat.regretTotal / actionStat.support) : 0,
          beatsNoActionOnAverage: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) >= 0 : true,
          teacherFacingEfficacyAllowed: actionStat.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
        }])),
    }]
  }))

  const realizedByAction = Object.fromEntries([...realizedActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]))

  const realizedByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = realizedPhenotypeStats.get(phenotype) ?? {
      support: 0,
      nextCheckpointImprovementTotal: 0,
      nextCheckpointSupport: 0,
      semesterCloseImprovementTotal: 0,
      semesterCloseSupport: 0,
      stableRecoveryCount: 0,
      stableRecoverySupport: 0,
      relapseCount: 0,
      relapseSupport: 0,
    }
    return [phenotype, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]
  }))

  const structuredStudyPlan = counterfactualActionStats.get('structured-study-plan')
  const targetedTutoring = counterfactualActionStats.get('targeted-tutoring')
  const academicWeaknessActionStats = counterfactualPhenotypeActionStats.get('academic-weakness') ?? new Map<string, {
    support: number
    regretTotal: number
    counterfactualLiftTotal: number
  }>()
  const academicWeaknessTargetedTutoring = academicWeaknessActionStats.get('targeted-tutoring')
  const academicWeaknessStructuredStudyPlan = academicWeaknessActionStats.get('structured-study-plan')

  const noRecommendedActionUnderperformsNoAction = [...counterfactualActionStats.values()]
    .every(stats => stats.support === 0 || roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0)
  const academicWeaknessTargetedTutoringLift = academicWeaknessTargetedTutoring?.support
    ? roundToTwo(academicWeaknessTargetedTutoring.counterfactualLiftTotal / academicWeaknessTargetedTutoring.support)
    : null
  const academicWeaknessStructuredStudyPlanLift = academicWeaknessStructuredStudyPlan?.support
    ? roundToTwo(academicWeaknessStructuredStudyPlan.counterfactualLiftTotal / academicWeaknessStructuredStudyPlan.support)
    : null

  const acceptanceGates = {
    structuredStudyPlanWithinLimit: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount) < 0.5
      : true,
    targetedTutoringBeatsStructuredStudyPlanAcademicSlice: (academicWeaknessTargetedTutoring?.support ?? 0) > 0
      ? (academicWeaknessTargetedTutoringLift ?? Number.NEGATIVE_INFINITY)
        > (academicWeaknessStructuredStudyPlanLift ?? Number.NEGATIVE_INFINITY)
      : false,
    noRecommendedActionUnderperformsNoAction,
  }

  return {
    recommendedActionCount: totalRecommendedActionCount,
    simulatedActionCount: totalActionCount,
    structuredStudyPlanShare: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount)
      : 0,
    acceptanceGates,
    counterfactualPolicyDiagnostics: {
      metricNote: 'Counterfactual lift is measured at the same checkpoint against the stored no-action replay. Positive values always mean the recommended action beat no-action. Teacher-facing efficacy claims are suppressed below the replay support threshold.',
      efficacySupportThreshold: POLICY_EFFICACY_SUPPORT_THRESHOLD,
      targetedTutoringVsStructuredStudyPlanAcademicSlice: {
        phenotype: 'academic-weakness',
        targetedTutoringSupport: academicWeaknessTargetedTutoring?.support ?? 0,
        targetedTutoringAverageCounterfactualLiftScaled: academicWeaknessTargetedTutoringLift ?? 0,
        structuredStudyPlanSupport: academicWeaknessStructuredStudyPlan?.support ?? 0,
        structuredStudyPlanAverageCounterfactualLiftScaled: academicWeaknessStructuredStudyPlanLift ?? 0,
      },
      acceptanceGates,
      byAction: counterfactualByAction,
      byPhenotype: counterfactualByPhenotype,
    },
    realizedPathDiagnostics: {
      metricNote: 'Realized-path improvements compare the current checkpoint to later checkpoints on the carried simulated action path. Positive values mean risk fell later. For pre-see-rescue, semester-close improvement is the primary realized outcome; stable recovery is not the primary acceptance target.',
      byAction: realizedByAction,
      byPhenotype: realizedByPhenotype,
    },
    byAction: counterfactualByAction,
    byPhenotype: counterfactualByPhenotype,
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

export function mergePolicyDiagnostics(
  summaries: Array<ReturnType<typeof buildPolicyDiagnostics> | null | undefined>,
) {
  const valid = summaries.filter((summary): summary is NonNullable<ReturnType<typeof buildPolicyDiagnostics>> => !!summary)
  if (valid.length === 0) return null

  const counterfactualActionStats = new Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const counterfactualPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const counterfactualPhenotypeActionStats = new Map<PolicyPhenotype, Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>>()
  const realizedActionStats = new Map<string, {
    support: number
    nextCheckpointSupport: number
    nextCheckpointImprovementTotal: number
    semesterCloseSupport: number
    semesterCloseImprovementTotal: number
    stableRecoverySupport: number
    stableRecoveryCount: number
    relapseSupport: number
    relapseCount: number
  }>()
  const realizedPhenotypeStats = new Map<PolicyPhenotype, {
    support: number
    nextCheckpointSupport: number
    nextCheckpointImprovementTotal: number
    semesterCloseSupport: number
    semesterCloseImprovementTotal: number
    stableRecoverySupport: number
    stableRecoveryCount: number
    relapseSupport: number
    relapseCount: number
  }>()
  let totalRecommendedActionCount = 0
  let totalActionCount = 0

  valid.forEach(summary => {
    totalRecommendedActionCount += Number(summary.recommendedActionCount ?? 0)
    totalActionCount += Number(summary.simulatedActionCount ?? 0)

    Object.entries((summary.counterfactualPolicyDiagnostics?.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, raw]) => {
      const stats = counterfactualActionStats.get(action) ?? {
        support: 0,
        counterfactualLiftTotal: 0,
        regretTotal: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.counterfactualLiftTotal += Number(raw.counterfactualLiftTotal ?? 0)
      stats.regretTotal += Number(raw.regretTotal ?? 0)
      counterfactualActionStats.set(action, stats)
    })

    Object.entries((summary.counterfactualPolicyDiagnostics?.byPhenotype ?? {}) as Record<string, Record<string, unknown>>).forEach(([phenotypeKey, raw]) => {
      const phenotype = phenotypeKey as PolicyPhenotype
      const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
        support: 0,
        counterfactualLiftTotal: 0,
        regretTotal: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.counterfactualLiftTotal += Number(raw.counterfactualLiftTotal ?? 0)
      stats.regretTotal += Number(raw.regretTotal ?? 0)
      counterfactualPhenotypeStats.set(phenotype, stats)
      const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
        support: number
        counterfactualLiftTotal: number
        regretTotal: number
      }>()
      Object.entries((raw.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, actionRaw]) => {
        const current = actionStats.get(action) ?? {
          support: 0,
          counterfactualLiftTotal: 0,
          regretTotal: 0,
        }
        current.support += Number(actionRaw.support ?? 0)
        current.counterfactualLiftTotal += Number(actionRaw.counterfactualLiftTotal ?? 0)
        current.regretTotal += Number(actionRaw.regretTotal ?? 0)
        actionStats.set(action, current)
      })
      counterfactualPhenotypeActionStats.set(phenotype, actionStats)
    })

    Object.entries((summary.realizedPathDiagnostics?.byAction ?? {}) as Record<string, Record<string, unknown>>).forEach(([action, raw]) => {
      const stats = realizedActionStats.get(action) ?? {
        support: 0,
        nextCheckpointSupport: 0,
        nextCheckpointImprovementTotal: 0,
        semesterCloseSupport: 0,
        semesterCloseImprovementTotal: 0,
        stableRecoverySupport: 0,
        stableRecoveryCount: 0,
        relapseSupport: 0,
        relapseCount: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.nextCheckpointSupport += Number(raw.nextCheckpointSupport ?? 0)
      stats.nextCheckpointImprovementTotal += Number(raw.nextCheckpointImprovementTotal ?? 0)
      stats.semesterCloseSupport += Number(raw.semesterCloseSupport ?? 0)
      stats.semesterCloseImprovementTotal += Number(raw.semesterCloseImprovementTotal ?? 0)
      stats.stableRecoverySupport += Number(raw.stableRecoverySupport ?? 0)
      stats.stableRecoveryCount += Number(raw.stableRecoveryCount ?? 0)
      stats.relapseSupport += Number(raw.relapseSupport ?? 0)
      stats.relapseCount += Number(raw.relapseCount ?? 0)
      realizedActionStats.set(action, stats)
    })

    Object.entries((summary.realizedPathDiagnostics?.byPhenotype ?? {}) as Record<string, Record<string, unknown>>).forEach(([phenotypeKey, raw]) => {
      const phenotype = phenotypeKey as PolicyPhenotype
      const stats = realizedPhenotypeStats.get(phenotype) ?? {
        support: 0,
        nextCheckpointSupport: 0,
        nextCheckpointImprovementTotal: 0,
        semesterCloseSupport: 0,
        semesterCloseImprovementTotal: 0,
        stableRecoverySupport: 0,
        stableRecoveryCount: 0,
        relapseSupport: 0,
        relapseCount: 0,
      }
      stats.support += Number(raw.support ?? 0)
      stats.nextCheckpointSupport += Number(raw.nextCheckpointSupport ?? 0)
      stats.nextCheckpointImprovementTotal += Number(raw.nextCheckpointImprovementTotal ?? 0)
      stats.semesterCloseSupport += Number(raw.semesterCloseSupport ?? 0)
      stats.semesterCloseImprovementTotal += Number(raw.semesterCloseImprovementTotal ?? 0)
      stats.stableRecoverySupport += Number(raw.stableRecoverySupport ?? 0)
      stats.stableRecoveryCount += Number(raw.stableRecoveryCount ?? 0)
      stats.relapseSupport += Number(raw.relapseSupport ?? 0)
      stats.relapseCount += Number(raw.relapseCount ?? 0)
      realizedPhenotypeStats.set(phenotype, stats)
    })
  })

  const counterfactualByAction = Object.fromEntries([...counterfactualActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
    }]))

  const counterfactualByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = counterfactualPhenotypeStats.get(phenotype) ?? {
      support: 0,
      counterfactualLiftTotal: 0,
      regretTotal: 0,
    }
    const actionStats = counterfactualPhenotypeActionStats.get(phenotype) ?? new Map<string, {
      support: number
      counterfactualLiftTotal: number
      regretTotal: number
    }>()
    return [phenotype, {
      support: stats.support,
      counterfactualLiftTotal: roundToTwo(stats.counterfactualLiftTotal),
      regretTotal: roundToFour(stats.regretTotal),
      actionShare: totalRecommendedActionCount > 0 ? roundToFour(stats.support / totalRecommendedActionCount) : 0,
      averageCounterfactualLiftScaled: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) : 0,
      averageRegret: stats.support > 0 ? roundToFour(stats.regretTotal / stats.support) : 0,
      beatsNoActionOnAverage: stats.support > 0 ? roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0 : true,
      teacherFacingEfficacyAllowed: stats.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
      byAction: Object.fromEntries([...actionStats.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([action, actionStat]) => [action, {
          support: actionStat.support,
          counterfactualLiftTotal: roundToTwo(actionStat.counterfactualLiftTotal),
          regretTotal: roundToFour(actionStat.regretTotal),
          averageCounterfactualLiftScaled: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) : 0,
          averageRegret: actionStat.support > 0 ? roundToFour(actionStat.regretTotal / actionStat.support) : 0,
          beatsNoActionOnAverage: actionStat.support > 0 ? roundToTwo(actionStat.counterfactualLiftTotal / actionStat.support) >= 0 : true,
          teacherFacingEfficacyAllowed: actionStat.support >= POLICY_EFFICACY_SUPPORT_THRESHOLD,
        }])),
    }]
  }))

  const realizedByAction = Object.fromEntries([...realizedActionStats.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([action, stats]) => [action, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]))

  const realizedByPhenotype = Object.fromEntries(POLICY_PHENOTYPE_ORDER.map(phenotype => {
    const stats = realizedPhenotypeStats.get(phenotype) ?? {
      support: 0,
      nextCheckpointSupport: 0,
      nextCheckpointImprovementTotal: 0,
      semesterCloseSupport: 0,
      semesterCloseImprovementTotal: 0,
      stableRecoverySupport: 0,
      stableRecoveryCount: 0,
      relapseSupport: 0,
      relapseCount: 0,
    }
    return [phenotype, {
      support: stats.support,
      nextCheckpointSupport: stats.nextCheckpointSupport,
      nextCheckpointImprovementTotal: roundToTwo(stats.nextCheckpointImprovementTotal),
      semesterCloseSupport: stats.semesterCloseSupport,
      semesterCloseImprovementTotal: roundToTwo(stats.semesterCloseImprovementTotal),
      stableRecoverySupport: stats.stableRecoverySupport,
      stableRecoveryCount: stats.stableRecoveryCount,
      relapseSupport: stats.relapseSupport,
      relapseCount: stats.relapseCount,
      actionShare: totalActionCount > 0 ? roundToFour(stats.support / totalActionCount) : 0,
      averageNextCheckpointImprovementScaled: stats.nextCheckpointSupport > 0 ? roundToTwo(stats.nextCheckpointImprovementTotal / stats.nextCheckpointSupport) : 0,
      averageSemesterCloseImprovementScaled: stats.semesterCloseSupport > 0 ? roundToTwo(stats.semesterCloseImprovementTotal / stats.semesterCloseSupport) : 0,
      stableRecoveryRate: stats.stableRecoverySupport > 0 ? roundToFour(stats.stableRecoveryCount / stats.stableRecoverySupport) : 0,
      relapseRate: stats.relapseSupport > 0 ? roundToFour(stats.relapseCount / stats.relapseSupport) : 0,
    }]
  }))

  const structuredStudyPlan = counterfactualActionStats.get('structured-study-plan')
  const academicWeaknessActionStats = counterfactualPhenotypeActionStats.get('academic-weakness') ?? new Map<string, {
    support: number
    counterfactualLiftTotal: number
    regretTotal: number
  }>()
  const academicWeaknessTargetedTutoring = academicWeaknessActionStats.get('targeted-tutoring')
  const academicWeaknessStructuredStudyPlan = academicWeaknessActionStats.get('structured-study-plan')
  const academicWeaknessTargetedTutoringLift = academicWeaknessTargetedTutoring?.support
    ? roundToTwo(academicWeaknessTargetedTutoring.counterfactualLiftTotal / academicWeaknessTargetedTutoring.support)
    : null
  const academicWeaknessStructuredStudyPlanLift = academicWeaknessStructuredStudyPlan?.support
    ? roundToTwo(academicWeaknessStructuredStudyPlan.counterfactualLiftTotal / academicWeaknessStructuredStudyPlan.support)
    : null

  const acceptanceGates = {
    structuredStudyPlanWithinLimit: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount) < 0.5
      : true,
    targetedTutoringBeatsStructuredStudyPlanAcademicSlice: (academicWeaknessTargetedTutoring?.support ?? 0) > 0
      ? (academicWeaknessTargetedTutoringLift ?? Number.NEGATIVE_INFINITY)
        > (academicWeaknessStructuredStudyPlanLift ?? Number.NEGATIVE_INFINITY)
      : false,
    noRecommendedActionUnderperformsNoAction: [...counterfactualActionStats.values()]
      .every(stats => stats.support === 0 || roundToTwo(stats.counterfactualLiftTotal / stats.support) >= 0),
  }

  return {
    recommendedActionCount: totalRecommendedActionCount,
    simulatedActionCount: totalActionCount,
    structuredStudyPlanShare: totalRecommendedActionCount > 0 && structuredStudyPlan
      ? roundToFour(structuredStudyPlan.support / totalRecommendedActionCount)
      : 0,
    acceptanceGates,
    counterfactualPolicyDiagnostics: {
      metricNote: 'Counterfactual lift is measured at the same checkpoint against the stored no-action replay. Positive values always mean the recommended action beat no-action. Teacher-facing efficacy claims are suppressed below the replay support threshold.',
      efficacySupportThreshold: POLICY_EFFICACY_SUPPORT_THRESHOLD,
      targetedTutoringVsStructuredStudyPlanAcademicSlice: {
        phenotype: 'academic-weakness',
        targetedTutoringSupport: academicWeaknessTargetedTutoring?.support ?? 0,
        targetedTutoringAverageCounterfactualLiftScaled: academicWeaknessTargetedTutoringLift ?? 0,
        structuredStudyPlanSupport: academicWeaknessStructuredStudyPlan?.support ?? 0,
        structuredStudyPlanAverageCounterfactualLiftScaled: academicWeaknessStructuredStudyPlanLift ?? 0,
      },
      acceptanceGates,
      byAction: counterfactualByAction,
      byPhenotype: counterfactualByPhenotype,
    },
    realizedPathDiagnostics: {
      metricNote: 'Realized-path improvements compare the current checkpoint to later checkpoints on the carried simulated action path. Positive values mean risk fell later. For pre-see-rescue, semester-close improvement is the primary realized outcome; stable recovery is not the primary acceptance target.',
      byAction: realizedByAction,
      byPhenotype: realizedByPhenotype,
    },
    byAction: counterfactualByAction,
    byPhenotype: counterfactualByPhenotype,
  }
}

function toInterventionResponse(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    interventionType: String(record.interventionType ?? 'support'),
    accepted: Boolean(record.accepted ?? false),
    completed: Boolean(record.completed ?? false),
    recoveryConfirmed: Boolean(record.recoveryConfirmed ?? false),
    residual: record.residual == null ? null : Number(record.residual),
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

  const [existingCards, existingSessions, existingCheckpoints, existingStageEvidenceRows] = await Promise.all([
    db.select().from(studentAgentCards).where(eq(studentAgentCards.simulationRunId, input.simulationRunId)),
    db.select().from(studentAgentSessions).where(eq(studentAgentSessions.simulationRunId, input.simulationRunId)),
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)),
    db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, input.simulationRunId)),
  ])

  const stageCardIds = existingCards
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.studentAgentCardId)
  const stageSessionIds = existingSessions
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.studentAgentSessionId)
  const checkpointIds = existingCheckpoints.map(row => row.simulationStageCheckpointId)
  const stageEvidenceIds = existingStageEvidenceRows
    .filter(row => !!row.simulationStageCheckpointId)
    .map(row => row.riskEvidenceSnapshotId)

  if (stageSessionIds.length > 0) {
    await db.delete(studentAgentMessages).where(inArray(studentAgentMessages.studentAgentSessionId, stageSessionIds))
    await db.delete(studentAgentSessions).where(inArray(studentAgentSessions.studentAgentSessionId, stageSessionIds))
  }
  if (stageCardIds.length > 0) {
    await db.delete(studentAgentCards).where(inArray(studentAgentCards.studentAgentCardId, stageCardIds))
  }
  if (stageEvidenceIds.length > 0) {
    await db.delete(riskEvidenceSnapshots).where(inArray(riskEvidenceSnapshots.riskEvidenceSnapshotId, stageEvidenceIds))
  }
  if (checkpointIds.length > 0) {
    await db.delete(simulationStageQueueProjections).where(inArray(simulationStageQueueProjections.simulationStageCheckpointId, checkpointIds))
    await db.delete(simulationStageQueueCases).where(inArray(simulationStageQueueCases.simulationStageCheckpointId, checkpointIds))
    await db.delete(simulationStageOfferingProjections).where(inArray(simulationStageOfferingProjections.simulationStageCheckpointId, checkpointIds))
    await db.delete(simulationStageStudentProjections).where(inArray(simulationStageStudentProjections.simulationStageCheckpointId, checkpointIds))
    await db.delete(simulationStageCheckpoints).where(inArray(simulationStageCheckpoints.simulationStageCheckpointId, checkpointIds))
  }

  const [
    studentRows,
    observedRows,
    curriculumNodeRows,
    coRows,
    questionRows,
    questionTemplateRows,
    electiveRows,
    edgeRows,
    teacherAllocationRows,
    teacherLoadRows,
    ownershipRows,
    mentorRows,
    grantRows,
  ] = await Promise.all([
    db.select().from(students),
    db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId)),
    db.select().from(curriculumNodes).where(eq(curriculumNodes.batchId, run.batchId)),
    db.select().from(studentCoStates).where(eq(studentCoStates.simulationRunId, input.simulationRunId)),
    db.select().from(studentQuestionResults).where(eq(studentQuestionResults.simulationRunId, input.simulationRunId)),
    db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, input.simulationRunId)),
    db.select().from(electiveRecommendations).where(eq(electiveRecommendations.simulationRunId, input.simulationRunId)),
    db.select().from(curriculumEdges).where(eq(curriculumEdges.batchId, run.batchId)),
    db.select().from(teacherAllocations).where(eq(teacherAllocations.simulationRunId, input.simulationRunId)),
    db.select().from(teacherLoadProfiles).where(eq(teacherLoadProfiles.simulationRunId, input.simulationRunId)),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    db.select().from(mentorAssignments),
    db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
  ])

  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const curriculumNodeBySemesterCode = new Map(
    curriculumNodeRows.map(row => [`${row.semesterNumber}::${row.courseCode}`, row]),
  )
  const templateById = new Map(questionTemplateRows.map(row => [row.simulationQuestionTemplateId, row]))

  const checkpointBySemesterStage = new Map<string, typeof simulationStageCheckpoints.$inferInsert>()
  const orderedCheckpointRows = Array.from({ length: 6 }, (_, semesterIndex) => semesterIndex + 1)
    .flatMap(semesterNumber => PLAYBACK_STAGE_DEFS.map(stage => ({
      simulationStageCheckpointId: buildDeterministicId('stage_checkpoint', [input.simulationRunId, semesterNumber, stage.key]),
      simulationRunId: input.simulationRunId,
      semesterNumber,
      stageKey: stage.key,
      stageLabel: stage.label,
      stageDescription: stage.description,
      stageOrder: stage.order,
      previousCheckpointId: null as string | null,
      nextCheckpointId: null as string | null,
      summaryJson: '{}',
      createdAt: input.now,
      updatedAt: input.now,
    })))
  orderedCheckpointRows.forEach((row, index) => {
    row.previousCheckpointId = orderedCheckpointRows[index - 1]?.simulationStageCheckpointId ?? null
    row.nextCheckpointId = orderedCheckpointRows[index + 1]?.simulationStageCheckpointId ?? null
    checkpointBySemesterStage.set(`${row.semesterNumber}::${row.stageKey}`, row)
  })

  const previousSemesterSummaryByStudentSemester = new Map<string, { cgpa: number; backlogCount: number }>()
  observedRows
    .filter(row => row.semesterNumber <= 5)
    .forEach(row => {
      const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
      previousSemesterSummaryByStudentSemester.set(`${row.studentId}::${row.semesterNumber}`, {
        cgpa: Number(payload.cgpaAfterSemester ?? 0),
        backlogCount: Number(payload.backlogCount ?? 0),
      })
    })

  const coRowsBySourceKey = new Map<string, Array<typeof studentCoStates.$inferSelect>>()
  coRows.forEach(row => {
    const node = row.curriculumNodeId ? curriculumNodeRows.find(item => item.curriculumNodeId === row.curriculumNodeId) ?? null : null
    const key = `${row.studentId}::${row.semesterNumber}::${row.offeringId ?? ''}::${node?.courseCode ?? row.coCode}`
    coRowsBySourceKey.set(key, [...(coRowsBySourceKey.get(key) ?? []), row])
  })

  const questionRowsBySourceKey = new Map<string, Array<typeof studentQuestionResults.$inferSelect>>()
  questionRows.forEach(row => {
    const node = row.curriculumNodeId ? curriculumNodeRows.find(item => item.curriculumNodeId === row.curriculumNodeId) ?? null : null
    const courseCode = node?.courseCode ?? ''
    const key = `${row.studentId}::${row.semesterNumber}::${row.offeringId ?? ''}::${courseCode}`
    questionRowsBySourceKey.set(key, [...(questionRowsBySourceKey.get(key) ?? []), row])
  })

  const sources: StageCourseProjectionSource[] = []
  observedRows
    .slice()
    .sort((left, right) => left.studentId.localeCompare(right.studentId) || left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt))
    .forEach(row => {
      const student = studentById.get(row.studentId)
      const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
      const previousSummary = previousSemesterSummaryByStudentSemester.get(`${row.studentId}::${row.semesterNumber - 1}`) ?? { cgpa: 0, backlogCount: 0 }
      if (row.semesterNumber <= 5) {
        const subjectScores = Array.isArray(payload.subjectScores) ? payload.subjectScores : []
        subjectScores.forEach(subject => {
          const record = subject as Record<string, unknown>
          const courseCode = String(record.courseCode ?? 'NA')
          const curriculumNode = curriculumNodeBySemesterCode.get(`${row.semesterNumber}::${courseCode}`) ?? null
          const sourceKey = `${row.studentId}::${row.semesterNumber}::::${courseCode}`
          const coSourceRows = coRowsBySourceKey.get(sourceKey) ?? []
          const questionSourceRows = questionRowsBySourceKey.get(sourceKey) ?? []
          sources.push({
            studentId: row.studentId,
            studentName: student?.name ?? row.studentId,
            usn: student?.usn ?? '',
            semesterNumber: row.semesterNumber,
            sectionCode: row.sectionCode,
            termId: row.termId,
            offeringId: null,
            curriculumNodeId: curriculumNode?.curriculumNodeId ?? null,
            courseCode,
            courseTitle: String(record.title ?? courseCode),
            courseFamily: curriculumNode?.assessmentProfile ?? 'general',
            attendanceHistory: parseJson(JSON.stringify(record.attendanceHistory ?? []), [] as AttendanceHistoryEntry[]),
            attendancePct: Number(record.attendancePct ?? 0),
            tt1Pct: Number(record.tt1Pct ?? 0),
            tt2Pct: Number(record.tt2Pct ?? 0),
            quizPct: Number(record.quizPct ?? 0),
            assignmentPct: Number(record.assignmentPct ?? 0),
            cePct: Number(record.cePct ?? 0),
            seePct: Number(record.seePct ?? 0),
            finalMark: Number(record.score ?? 0),
            result: String(record.result ?? 'Unknown'),
            previousCgpa: previousSummary.cgpa,
            previousBacklogCount: previousSummary.backlogCount,
            closingCgpa: Number(payload.cgpaAfterSemester ?? previousSummary.cgpa),
            closingBacklogCount: Number(payload.backlogCount ?? previousSummary.backlogCount),
            questionRows: questionSourceRows,
            coRows: coSourceRows,
            interventionResponse: toInterventionResponse(record.interventionResponse),
          })
        })
        return
      }

      const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
      const courseCode = String(payload.courseCode ?? 'NA')
      const curriculumNode = curriculumNodeBySemesterCode.get(`${row.semesterNumber}::${courseCode}`) ?? null
      const sourceKey = `${row.studentId}::${row.semesterNumber}::${offeringId ?? ''}::${courseCode}`
      sources.push({
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        semesterNumber: row.semesterNumber,
        sectionCode: row.sectionCode,
        termId: row.termId,
        offeringId,
        curriculumNodeId: curriculumNode?.curriculumNodeId ?? null,
        courseCode,
        courseTitle: String(payload.courseTitle ?? courseCode),
        courseFamily: curriculumNode?.assessmentProfile ?? 'general',
        attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as AttendanceHistoryEntry[]),
        attendancePct: Number(payload.attendancePct ?? 0),
        tt1Pct: Number(payload.tt1Pct ?? 0),
        tt2Pct: Number(payload.tt2Pct ?? 0),
        quizPct: Number(payload.quizPct ?? 0),
        assignmentPct: Number(payload.assignmentPct ?? 0),
        cePct: Number(payload.cePct ?? 0),
        seePct: Number(payload.seePct ?? 0),
        finalMark: Number(payload.finalMark ?? 0),
        result: String(payload.result ?? 'Unknown'),
        previousCgpa: previousSummary.cgpa,
        previousBacklogCount: previousSummary.backlogCount,
        closingCgpa: Number(payload.cgpa ?? previousSummary.cgpa),
        closingBacklogCount: Number(payload.backlogCount ?? previousSummary.backlogCount),
        questionRows: questionRowsBySourceKey.get(sourceKey) ?? [],
        coRows: coRowsBySourceKey.get(sourceKey) ?? [],
        interventionResponse: toInterventionResponse(payload.interventionResponse),
      })
    })

  const sourceByStudentNodeId = new Map<string, StageCourseProjectionSource>()
  sources.forEach(source => {
    if (!source.curriculumNodeId) return
    sourceByStudentNodeId.set(`${source.studentId}::${source.curriculumNodeId}`, source)
  })

  const prerequisiteNodeIdsByTargetNodeId = new Map<string, string[]>()
  const downstreamNodeIdsBySourceNodeId = new Map<string, string[]>()
  edgeRows
    .filter(row => row.status === 'active')
    .forEach(row => {
      prerequisiteNodeIdsByTargetNodeId.set(row.targetCurriculumNodeId, [...(prerequisiteNodeIdsByTargetNodeId.get(row.targetCurriculumNodeId) ?? []), row.sourceCurriculumNodeId])
      downstreamNodeIdsBySourceNodeId.set(row.sourceCurriculumNodeId, [...(downstreamNodeIdsBySourceNodeId.get(row.sourceCurriculumNodeId) ?? []), row.targetCurriculumNodeId])
    })

  const sourceKeyForStageSource = (source: StageCourseProjectionSource) => (
    `${source.studentId}::${source.semesterNumber}::${source.offeringId ?? ''}::${source.courseCode}`
  )
  const caseKeyForStageSource = (source: StageCourseProjectionSource) => `${source.studentId}::${source.semesterNumber}`
  const queueCaseIdForSourceStage = (source: StageCourseProjectionSource, stageKey: PlaybackStageKey) => (
    buildDeterministicId('stage_queue_case', [input.simulationRunId, source.studentId, source.semesterNumber, stageKey])
  )
  const sectionStudentCountBySemesterSection = new Map<string, number>()
  Array.from(new Set(sources.map(source => `${source.semesterNumber}::${source.sectionCode}::${source.studentId}`)))
    .forEach(key => {
      const [semesterNumber, sectionCode] = key.split('::')
      const sectionKey = `${semesterNumber}::${sectionCode}`
      sectionStudentCountBySemesterSection.set(sectionKey, (sectionStudentCountBySemesterSection.get(sectionKey) ?? 0) + 1)
    })

  const courseLeaderFacultyIdByOfferingId = new Map<string, string>()
  ownershipRows
    .filter(row => row.offeringId != null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (!row.offeringId || courseLeaderFacultyIdByOfferingId.has(row.offeringId)) return
      courseLeaderFacultyIdByOfferingId.set(row.offeringId, row.facultyId)
    })
  const courseLeaderFacultyIdByCurriculumNodeSectionSemester = new Map<string, string>()
  teacherAllocationRows
    .filter(row => row.allocationRole === 'course-leader' && row.curriculumNodeId != null && row.sectionCode != null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      const allocationKey = `${row.semesterNumber}::${row.sectionCode}::${row.curriculumNodeId}`
      if (courseLeaderFacultyIdByCurriculumNodeSectionSemester.has(allocationKey)) return
      courseLeaderFacultyIdByCurriculumNodeSectionSemester.set(allocationKey, row.facultyId)
    })
  const mentorFacultyIdByStudentId = new Map<string, string>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (mentorFacultyIdByStudentId.has(row.studentId)) return
      mentorFacultyIdByStudentId.set(row.studentId, row.facultyId)
    })
  const hodFacultyId = grantRows
    .filter(row => row.roleCode === 'HOD' && [run.batchId, MSRUAS_PROOF_BRANCH_ID, MSRUAS_PROOF_DEPARTMENT_ID].includes(row.scopeId))
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))[0]?.facultyId ?? null
  const overloadPenaltyBySemesterFaculty = new Map<string, number>()
  for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
    const semesterLoads = teacherLoadRows.filter(row => row.semesterNumber === semesterNumber)
    const currentLoadAverage = average(semesterLoads.map(row => row.weeklyContactHours))
    const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
    semesterLoads.forEach(row => {
      overloadPenaltyBySemesterFaculty.set(
        `${semesterNumber}::${row.facultyId}`,
        row.weeklyContactHours > overloadThreshold ? 2 : 0,
      )
    })
  }
  const mentorAssignmentCountByFacultyId = new Map<string, number>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .forEach(row => {
      mentorAssignmentCountByFacultyId.set(row.facultyId, (mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) + 1)
    })
  const supervisedSectionCount = new Set(
    teacherAllocationRows
      .filter(row => row.sectionCode != null)
      .map(row => `${row.semesterNumber}::${row.sectionCode}`),
  ).size
  const facultyBudgetByKey = new Map<string, number>()
  teacherLoadRows.forEach(row => {
    const overloadPenalty = overloadPenaltyBySemesterFaculty.get(`${row.semesterNumber}::${row.facultyId}`) ?? 0
    const ownedOfferingCount = teacherAllocationRows.filter(allocation =>
      allocation.semesterNumber === row.semesterNumber
      && allocation.facultyId === row.facultyId
      && allocation.allocationRole === 'course-leader').length
    facultyBudgetByKey.set(
      `Course Leader::${row.facultyId}::${row.semesterNumber}`,
      clamp(4 + ownedOfferingCount - overloadPenalty, 2, 12),
    )
    facultyBudgetByKey.set(
      `Mentor::${row.facultyId}::${row.semesterNumber}`,
      clamp(6 + Math.ceil((mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) / 15) - overloadPenalty, 4, 18),
    )
    facultyBudgetByKey.set(
      `HoD::${row.facultyId}::${row.semesterNumber}`,
      clamp(8 + supervisedSectionCount - overloadPenalty, 6, 24),
    )
  })

  const facultyAssignmentForSource = (source: StageCourseProjectionSource, assignedRole: ProofQueueRole) => {
    const assignedFacultyId = assignedRole === 'Course Leader'
      ? (
        (source.offeringId ? courseLeaderFacultyIdByOfferingId.get(source.offeringId) : null)
        ?? (source.curriculumNodeId ? courseLeaderFacultyIdByCurriculumNodeSectionSemester.get(`${source.semesterNumber}::${source.sectionCode}::${source.curriculumNodeId}`) : null)
        ?? null
      )
      : assignedRole === 'Mentor'
        ? (mentorFacultyIdByStudentId.get(source.studentId) ?? null)
        : hodFacultyId
    return {
      assignedFacultyId,
      facultyBudgetKey: assignedFacultyId ? `${assignedRole}::${assignedFacultyId}::${source.semesterNumber}` : null,
    }
  }
  type QueueCaseDecisionView = {
    status: 'opened' | 'open' | 'watch' | 'resolved' | 'idle'
    primarySourceKey: string | null
    supportingSourceKeys: string[]
    countsTowardCapacity: boolean
    priorityRank: number | null
    governanceReason: string
  }

  const studentProjectionRows: Array<typeof simulationStageStudentProjections.$inferInsert> = []
  const queueProjectionRows: Array<typeof simulationStageQueueProjections.$inferInsert> = []
  const queueCaseRows: Array<typeof simulationStageQueueCases.$inferInsert> = []
  const stageEvidenceRows: Array<typeof riskEvidenceSnapshots.$inferInsert> = []
  const sectionRiskRateByStage = new Map<string, number>()

  PLAYBACK_STAGE_DEFS.forEach(stage => {
    const sectionAccumulator = new Map<string, number[]>()
    sources.forEach(source => {
      const evidence = buildStageEvidenceSnapshot({
        source,
        stageKey: stage.key,
        policy: input.policy,
        templatesById: templateById,
      })
      const sectionKey = `${source.semesterNumber}::${source.sectionCode}::${stage.key}`
      sectionAccumulator.set(sectionKey, [
        ...(sectionAccumulator.get(sectionKey) ?? []),
        observableSectionPressureFromEvidence(evidence),
      ])
    })
    sectionAccumulator.forEach((values, key) => {
      sectionRiskRateByStage.set(key, roundToTwo(average(values)))
    })
  })

  {
    const orderedSourcesForGovernance = sources
      .slice()
      .sort((left, right) => left.studentId.localeCompare(right.studentId) || left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
    const sourceStateByKey = new Map(orderedSourcesForGovernance.map(source => [
      sourceKeyForStageSource(source),
      {
        previousRiskBand: null as 'High' | 'Medium' | 'Low' | null,
        cooldownUntil: null as string | null,
        actionTaken: null as string | null,
        previousRiskProbScaled: null as number | null,
      },
    ]))
    const caseStateByKey = new Map<string, ProofQueuePriorCaseState>()

    for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
      const semesterSources = orderedSourcesForGovernance.filter(source => source.semesterNumber === semesterNumber)
      for (const stage of PLAYBACK_STAGE_DEFS) {
        const checkpoint = checkpointBySemesterStage.get(`${semesterNumber}::${stage.key}`)
        if (!checkpoint) continue
        const stageCandidates = semesterSources.map(source => {
          const sourceKey = sourceKeyForStageSource(source)
          const sourceState = sourceStateByKey.get(sourceKey)!
          const prerequisiteSummary = prerequisiteSummaryForSource({
            source,
            sourceByStudentNodeId,
            prerequisiteNodeIdsByTargetNodeId,
            downstreamNodeIdsBySourceNodeId,
          })
          const downstreamCarryover = downstreamCarryoverLabelForSource({
            source,
            sourceByStudentNodeId,
            downstreamNodeIdsBySourceNodeId,
          })
          const evidence = buildStageEvidenceSnapshot({
            source,
            stageKey: stage.key,
            policy: input.policy,
            templatesById: templateById,
          })
          const sourceRefs: ObservableSourceRefs = {
            simulationRunId: input.simulationRunId,
            simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
            studentId: source.studentId,
            offeringId: source.offeringId,
            semesterNumber: source.semesterNumber,
            sectionCode: source.sectionCode,
            courseCode: source.courseCode,
            courseTitle: source.courseTitle,
            courseFamily: source.courseFamily,
            coEvidenceMode: dominantCoEvidenceMode(source.coRows),
            stageKey: stage.key,
            prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
            prerequisiteWeakCourseCodes: prerequisiteSummary.prerequisiteWeakCourseCodes,
            weakCourseOutcomeCodes: evidence.weakCourseOutcomes.map(item => item.coCode),
            dominantQuestionTopics: evidence.questionPatterns.commonWeakTopics,
          }
          const featurePayload = buildObservableFeaturePayload({
            attendancePct: evidence.attendancePct,
            attendanceHistory: includedAttendanceForSourceStage(source, stage.key),
            currentCgpa: evidence.currentCgpa,
            backlogCount: evidence.backlogCount,
            tt1Pct: evidence.tt1Pct,
            tt2Pct: evidence.tt2Pct,
            quizPct: evidence.quizPct,
            assignmentPct: evidence.assignmentPct,
            seePct: evidence.seePct,
            weakCoCount: evidence.weakCoCount,
            weakQuestionCount: evidence.weakQuestionCount,
            interventionResponseScore: evidence.interventionResponseScore,
            prerequisiteAveragePct: prerequisiteSummary.prerequisiteAveragePct,
            prerequisiteFailureCount: prerequisiteSummary.prerequisiteFailureCount,
            prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
            downstreamDependencyLoad: prerequisiteSummary.downstreamDependencyLoad,
            weakPrerequisiteChainCount: prerequisiteSummary.weakPrerequisiteChainCount,
            repeatedWeakPrerequisiteFamilyCount: prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount,
            sectionRiskRate: sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
            semesterProgress: stage.order / PLAYBACK_STAGE_DEFS.length,
          })
          const inference = scoreObservableRiskWithModel({
            attendancePct: evidence.attendancePct,
            currentCgpa: evidence.currentCgpa,
            backlogCount: evidence.backlogCount,
            tt1Pct: evidence.tt1Pct,
            tt2Pct: evidence.tt2Pct,
            quizPct: evidence.quizPct,
            assignmentPct: evidence.assignmentPct,
            seePct: evidence.seePct,
            weakCoCount: evidence.weakCoCount,
            attendanceHistoryRiskCount: evidence.attendanceHistoryRiskCount,
            questionWeaknessCount: evidence.weakQuestionCount,
            interventionResponseScore: evidence.interventionResponseScore,
            policy: input.policy,
            featurePayload,
            sourceRefs,
            productionModel: activeRiskArtifacts.production,
            correlations: activeRiskArtifacts.correlations,
          })
          const policyComparison = buildActionPolicyComparison({
            stageKey: stage.key,
            evidence,
            riskBand: inference.riskBand,
            recommendedAction: inference.recommendedAction,
            prerequisiteSummary,
          })
          const stageNowIso = playbackCheckpointNowIso(run.createdAt, source.semesterNumber, stage)
          const monitoring = buildMonitoringDecision({
            riskProb: inference.riskProb,
            riskBand: inference.riskBand,
            previousRiskBand: sourceState.previousRiskBand,
            cooldownUntil: sourceState.cooldownUntil,
            evidenceWindowCount: stage.order,
            interventionResidual: evidence.interventionResponseScore,
            nowIso: stageNowIso,
          })
          const shouldSwitchAction = !sourceState.actionTaken
            || (policyComparison.recommendedAction != null && policyComparison.recommendedAction !== sourceState.actionTaken && (
              (evidence.interventionResponseScore ?? 0) < -0.03
              || stage.key === 'post-reassessment'
              || stage.key === 'post-tt2'
              || stage.key === 'post-see'
            ))
          const nextActionTaken = shouldSwitchAction ? (policyComparison.recommendedAction ?? sourceState.actionTaken) : sourceState.actionTaken
          const noAction = buildNoActionSnapshot({
            evidence,
            actionTaken: nextActionTaken,
            stageKey: stage.key,
          })
          const noActionFeaturePayload = buildObservableFeaturePayload({
            attendancePct: noAction.attendancePct,
            attendanceHistory: includedAttendanceForSourceStage(source, stage.key),
            currentCgpa: noAction.currentCgpa,
            backlogCount: noAction.backlogCount,
            tt1Pct: noAction.tt1Pct,
            tt2Pct: noAction.tt2Pct,
            quizPct: noAction.quizPct,
            assignmentPct: noAction.assignmentPct,
            seePct: noAction.seePct,
            weakCoCount: noAction.weakCoCount,
            weakQuestionCount: noAction.weakQuestionCount,
            interventionResponseScore: noAction.interventionResponseScore,
            prerequisiteAveragePct: prerequisiteSummary.prerequisiteAveragePct,
            prerequisiteFailureCount: prerequisiteSummary.prerequisiteFailureCount,
            prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
            downstreamDependencyLoad: prerequisiteSummary.downstreamDependencyLoad,
            weakPrerequisiteChainCount: prerequisiteSummary.weakPrerequisiteChainCount,
            repeatedWeakPrerequisiteFamilyCount: prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount,
            sectionRiskRate: sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
            semesterProgress: stage.order / PLAYBACK_STAGE_DEFS.length,
          })
          const noActionInference = scoreObservableRiskWithModel({
            attendancePct: noAction.attendancePct,
            currentCgpa: noAction.currentCgpa,
            backlogCount: noAction.backlogCount,
            tt1Pct: noAction.tt1Pct,
            tt2Pct: noAction.tt2Pct,
            quizPct: noAction.quizPct,
            assignmentPct: noAction.assignmentPct,
            seePct: noAction.seePct,
            weakCoCount: noAction.weakCoCount,
            attendanceHistoryRiskCount: noAction.attendanceHistoryRiskCount,
            questionWeaknessCount: noAction.weakQuestionCount,
            interventionResponseScore: noAction.interventionResponseScore,
            policy: input.policy,
            featurePayload: noActionFeaturePayload,
            sourceRefs,
            productionModel: activeRiskArtifacts.production,
            correlations: activeRiskArtifacts.correlations,
          })
          const riskProbScaled = Math.round(inference.riskProb * 100)
          const noActionRiskProbScaled = Math.round(noActionInference.riskProb * 100)
          const riskChangeFromPreviousCheckpointScaled = sourceState.previousRiskProbScaled == null ? 0 : riskProbScaled - sourceState.previousRiskProbScaled
          const counterfactualLiftScaled = noActionRiskProbScaled - riskProbScaled
          const selectedPolicyCandidate = policyComparison.candidates.find(candidate => candidate.action === policyComparison.recommendedAction) ?? null
          const assignment = facultyAssignmentForSource(source, monitoring.queueOwnerRole as ProofQueueRole)
          return {
            checkpoint,
            stage,
            source,
            sourceKey,
            caseKey: caseKeyForStageSource(source),
            sourceState,
            sourceRefs,
            evidence,
            featurePayload,
            inference,
            policyComparison,
            monitoring,
            nextActionTaken,
            noActionInference,
            riskProbScaled,
            noActionRiskProbScaled,
            riskChangeFromPreviousCheckpointScaled,
            counterfactualLiftScaled,
            selectedPolicyCandidate,
            assignment,
            downstreamCarryover,
          }
        })

        const governance = governProofQueueStage({
          stageKey: stage.key as ProofQueueGovernanceStageKey,
          candidates: stageCandidates.map(candidate => ({
            caseKey: candidate.caseKey,
            sourceKey: candidate.sourceKey,
            studentId: candidate.source.studentId,
            semesterNumber: candidate.source.semesterNumber,
            sectionCode: candidate.source.sectionCode,
            stageKey: stage.key as ProofQueueGovernanceStageKey,
            offeringId: candidate.source.offeringId,
            courseCode: candidate.source.courseCode,
            courseTitle: candidate.source.courseTitle,
            riskBand: candidate.inference.riskBand,
            riskProbScaled: candidate.riskProbScaled,
            noActionRiskProbScaled: candidate.noActionRiskProbScaled,
            riskChangeFromPreviousCheckpointScaled: candidate.riskChangeFromPreviousCheckpointScaled,
            counterfactualLiftScaled: candidate.counterfactualLiftScaled,
            policyPhenotype: candidate.policyComparison.policyPhenotype,
            recommendedAction: candidate.policyComparison.recommendedAction ?? candidate.sourceState.actionTaken ?? candidate.nextActionTaken,
            utilityDelta: candidate.selectedPolicyCandidate?.utility ?? 0,
            nextCheckpointBenefitScaled: candidate.selectedPolicyCandidate?.nextCheckpointBenefitScaled ?? 0,
            capacityCost: candidate.selectedPolicyCandidate?.capacityCost ?? 0,
            assignedRole: candidate.monitoring.queueOwnerRole as ProofQueueRole,
            assignedFacultyId: candidate.assignment.assignedFacultyId,
            facultyBudgetKey: candidate.assignment.facultyBudgetKey,
          }) satisfies ProofQueueCandidate),
          priorCaseStateByKey: caseStateByKey,
          sectionStudentCountByKey: new Map(
            [...sectionStudentCountBySemesterSection.entries()].filter(([key]) => key.startsWith(`${semesterNumber}::`)),
          ),
          facultyBudgetByKey,
        })

        const effectiveDecisionByCaseKey = new Map<string, QueueCaseDecisionView>()
        governance.decisions.forEach((decision, caseKey) => {
          const priorCaseState = caseStateByKey.get(caseKey) ?? null
          const effectivePrimarySourceKey = decision.status === 'watch' && priorCaseState?.open
            ? (priorCaseState.primarySourceKey ?? decision.primarySourceKey)
            : decision.primarySourceKey
          if (
            (decision.status === 'open' || decision.status === 'opened')
            && priorCaseState?.open
            && priorCaseState.primarySourceKey
            && priorCaseState.primarySourceKey !== effectivePrimarySourceKey
          ) {
            const previousPrimaryState = sourceStateByKey.get(priorCaseState.primarySourceKey)
            if (previousPrimaryState) {
              previousPrimaryState.actionTaken = null
              previousPrimaryState.cooldownUntil = null
              sourceStateByKey.set(priorCaseState.primarySourceKey, previousPrimaryState)
            }
          }
          if (decision.status === 'resolved' && priorCaseState?.primarySourceKey) {
            const previousPrimaryState = sourceStateByKey.get(priorCaseState.primarySourceKey)
            if (previousPrimaryState) {
              previousPrimaryState.actionTaken = null
              previousPrimaryState.cooldownUntil = null
              sourceStateByKey.set(priorCaseState.primarySourceKey, previousPrimaryState)
            }
          }
          effectiveDecisionByCaseKey.set(caseKey, {
            status: decision.status,
            primarySourceKey: effectivePrimarySourceKey,
            supportingSourceKeys: decision.supportingSourceKeys,
            countsTowardCapacity: decision.status === 'open' || decision.status === 'opened',
            priorityRank: decision.priorityRank,
            governanceReason: decision.governanceReason,
          })
        })

        const candidateBySourceKey = new Map(stageCandidates.map(candidate => [candidate.sourceKey, candidate]))
        effectiveDecisionByCaseKey.forEach((decision, caseKey) => {
          const primaryCandidate = decision.primarySourceKey ? (candidateBySourceKey.get(decision.primarySourceKey) ?? null) : null
          if (!primaryCandidate || decision.status === 'idle') return
          queueCaseRows.push({
            simulationStageQueueCaseId: queueCaseIdForSourceStage(primaryCandidate.source, stage.key),
            simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
            simulationRunId: input.simulationRunId,
            studentId: primaryCandidate.source.studentId,
            primaryOfferingId: primaryCandidate.source.offeringId,
            semesterNumber: primaryCandidate.source.semesterNumber,
            sectionCode: primaryCandidate.source.sectionCode,
            stageKey: stage.key,
            assignedToRole: primaryCandidate.monitoring.queueOwnerRole,
            assignedFacultyId: primaryCandidate.assignment.assignedFacultyId,
            status: decision.status === 'resolved'
              ? 'Resolved'
              : decision.status === 'watch'
                ? 'Watching'
                : 'Open',
            recommendedAction: primaryCandidate.policyComparison.recommendedAction ?? primaryCandidate.inference.recommendedAction,
            dueAt: primaryCandidate.monitoring.reassessmentDueAt,
            countsTowardCapacity: decision.status === 'open' || decision.status === 'opened' ? 1 : 0,
            priorityRank: decision.priorityRank,
            governanceReason: decision.governanceReason,
            primaryCourseCode: primaryCandidate.source.courseCode,
            primaryCourseTitle: primaryCandidate.source.courseTitle,
            supportingCourseCount: decision.supportingSourceKeys.length,
            supportingSourceKeysJson: JSON.stringify(decision.supportingSourceKeys),
            caseJson: JSON.stringify({
              caseKey,
              stageKey: stage.key,
              primarySourceKey: decision.primarySourceKey,
              supportingSourceKeys: decision.supportingSourceKeys,
              priorityRank: decision.priorityRank,
              governanceReason: decision.governanceReason,
              assignedFacultyId: primaryCandidate.assignment.assignedFacultyId,
            }),
            detailJson: JSON.stringify({
              queueCaseId: queueCaseIdForSourceStage(primaryCandidate.source, stage.key),
              stageKey: stage.key,
              stageLabel: stage.label,
              dueAt: primaryCandidate.monitoring.reassessmentDueAt,
              recommendedAction: primaryCandidate.policyComparison.recommendedAction ?? primaryCandidate.inference.recommendedAction,
              primarySourceKey: decision.primarySourceKey,
              supportingSourceKeys: decision.supportingSourceKeys,
              governanceReason: decision.governanceReason,
              countsTowardCapacity: decision.status === 'open' || decision.status === 'opened',
              priorityRank: decision.priorityRank,
              assignedFacultyId: primaryCandidate.assignment.assignedFacultyId,
            }),
            createdAt: input.now,
            updatedAt: input.now,
          })
        })

        stageCandidates.forEach(candidate => {
          const sourceState = sourceStateByKey.get(candidate.sourceKey) ?? candidate.sourceState
          const decision = effectiveDecisionByCaseKey.get(candidate.caseKey) ?? null
          const isPrimaryCase = !!decision && decision.primarySourceKey === candidate.sourceKey
          const isSupportingCase = !!decision && decision.supportingSourceKeys.includes(candidate.sourceKey)
          const evidenceSnapshotId = buildDeterministicId('risk_evidence', [candidate.checkpoint.simulationStageCheckpointId, candidate.source.studentId, candidate.source.offeringId ?? candidate.source.courseCode])
          const labelPayload: ObservableLabelPayload = {
            attendanceRiskLabel: candidate.source.attendancePct < input.policy.attendanceRules.minimumRequiredPercent ? 1 : 0,
            ceShortfallLabel: ceShortfallLabel(candidate.source, input.policy),
            seeShortfallLabel: seeShortfallLabel(candidate.source, input.policy),
            overallCourseFailLabel: candidate.source.result !== 'Passed' ? 1 : 0,
            downstreamCarryoverLabel: candidate.downstreamCarryover,
          }
          stageEvidenceRows.push({
            riskEvidenceSnapshotId: evidenceSnapshotId,
            simulationRunId: input.simulationRunId,
            simulationStageCheckpointId: candidate.checkpoint.simulationStageCheckpointId,
            batchId: run.batchId,
            studentId: candidate.source.studentId,
            offeringId: candidate.source.offeringId,
            semesterNumber: candidate.source.semesterNumber,
            sectionCode: candidate.source.sectionCode,
            courseCode: candidate.source.courseCode,
            courseTitle: candidate.source.courseTitle,
            stageKey: stage.key,
            evidenceWindow: candidate.evidence.evidenceWindow,
            featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
            featureJson: JSON.stringify(candidate.featurePayload),
            labelJson: JSON.stringify(labelPayload),
            sourceRefsJson: JSON.stringify({
              ...candidate.sourceRefs,
              sourceSnapshotHash: featureHash(candidate.featurePayload, labelPayload, candidate.sourceRefs),
            }),
            createdAt: input.now,
            updatedAt: input.now,
          })

          let queueState = 'idle'
          let reassessmentState = 'None'
          let countsTowardCapacity = false
          if (decision && (decision.status === 'opened' || decision.status === 'open') && (isPrimaryCase || isSupportingCase)) {
            queueState = isPrimaryCase ? decision.status : 'open'
            reassessmentState = 'Open'
            countsTowardCapacity = isPrimaryCase
          } else if (decision && decision.status === 'watch' && (isPrimaryCase || isSupportingCase)) {
            queueState = 'watch'
            reassessmentState = 'Watching'
          } else if (decision && decision.status === 'resolved' && isPrimaryCase) {
            queueState = 'resolved'
            reassessmentState = 'Resolved'
          }

          const effectiveActionTaken = isPrimaryCase && decision && (decision.status === 'opened' || decision.status === 'open')
            ? candidate.nextActionTaken
            : sourceState.actionTaken
          const queueCaseId = queueCaseIdForSourceStage(candidate.source, stage.key)
          const projectionJson = {
            evidenceSnapshotId,
            stageKey: stage.key,
            stageLabel: stage.label,
            stageDescription: stage.description,
            stageOccurredAt: playbackCheckpointNowIso(run.createdAt, candidate.source.semesterNumber, stage),
            currentEvidence: {
              attendancePct: roundToOne(candidate.evidence.attendancePct),
              tt1Pct: roundToOne(candidate.evidence.tt1Pct ?? 0),
              tt2Pct: roundToOne(candidate.evidence.tt2Pct ?? 0),
              quizPct: roundToOne(candidate.evidence.quizPct ?? 0),
              assignmentPct: roundToOne(candidate.evidence.assignmentPct ?? 0),
              seePct: roundToOne(candidate.evidence.seePct ?? 0),
              weakCoCount: candidate.evidence.weakCoCount,
              weakQuestionCount: candidate.evidence.weakQuestionCount,
              coEvidenceMode: candidate.sourceRefs.coEvidenceMode ?? null,
              interventionRecoveryStatus: candidate.evidence.interventionResponseScore == null
                ? null
                : candidate.evidence.interventionResponseScore >= 0 ? 'confirmed' : 'watch',
            },
            currentStatus: {
              riskBand: candidate.inference.riskBand,
              riskProbScaled: candidate.riskProbScaled,
              previousRiskBand: sourceState.previousRiskBand,
              previousRiskProbScaled: sourceState.previousRiskProbScaled,
              riskChangeFromPreviousCheckpointScaled: candidate.riskChangeFromPreviousCheckpointScaled,
              counterfactualLiftScaled: candidate.counterfactualLiftScaled,
              recommendedAction: candidate.inference.recommendedAction,
              attentionAreas: candidate.inference.observableDrivers.slice(0, 4).map(driver => driver.label),
              modelVersion: candidate.inference.modelVersion,
              calibrationVersion: candidate.inference.calibrationVersion,
              headProbabilities: candidate.inference.headProbabilities,
              crossCourseDrivers: candidate.inference.crossCourseDrivers,
              queueOwnerRole: candidate.monitoring.queueOwnerRole,
              queueState,
              reassessmentState,
              monitoringDecisionType: candidate.monitoring.decisionType,
              dueAt: candidate.monitoring.reassessmentDueAt,
              policyComparison: {
                policyPhenotype: candidate.policyComparison.policyPhenotype,
                recommendedAction: candidate.policyComparison.recommendedAction,
                simulatedActionTaken: effectiveActionTaken,
                noActionRiskBand: candidate.noActionInference.riskBand,
                noActionRiskProbScaled: candidate.noActionRiskProbScaled,
                counterfactualLiftScaled: candidate.counterfactualLiftScaled,
                rationale: candidate.policyComparison.policyRationale,
              },
            },
            governance: {
              queueCaseId,
              primaryCase: isPrimaryCase,
              countsTowardCapacity,
              priorityRank: decision?.priorityRank ?? null,
              governanceReason: decision?.governanceReason ?? 'idle',
              supportingCourseCount: decision?.supportingSourceKeys.length ?? 0,
              assignedFacultyId: candidate.assignment.assignedFacultyId,
            },
            noActionComparator: {
              riskBand: candidate.noActionInference.riskBand,
              riskProbScaled: candidate.noActionRiskProbScaled,
              counterfactualLiftScaled: candidate.counterfactualLiftScaled,
            },
            counterfactualPolicyDiagnostics: {
              policyPhenotype: candidate.policyComparison.policyPhenotype,
              recommendedAction: candidate.policyComparison.recommendedAction,
              simulatedActionTaken: effectiveActionTaken,
              noActionRiskBand: candidate.noActionInference.riskBand,
              noActionRiskProbScaled: candidate.noActionRiskProbScaled,
              counterfactualLiftScaled: candidate.counterfactualLiftScaled,
              policyRationale: candidate.policyComparison.policyRationale,
              candidates: candidate.policyComparison.candidates.slice(0, 5),
            },
            realizedPathDiagnostics: {
              policyPhenotype: candidate.policyComparison.policyPhenotype,
              previousRiskBand: sourceState.previousRiskBand,
              previousRiskProbScaled: sourceState.previousRiskProbScaled,
              currentRiskBand: candidate.inference.riskBand,
              currentRiskProbScaled: candidate.riskProbScaled,
              riskChangeFromPreviousCheckpointScaled: candidate.riskChangeFromPreviousCheckpointScaled,
            },
            questionPatterns: candidate.evidence.questionPatterns,
            weakCourseOutcomes: candidate.evidence.weakCourseOutcomes,
            actionPath: {
              taskType: mapActionToTaskType(effectiveActionTaken),
              simulatedActionTaken: effectiveActionTaken,
              queueState,
              reassessmentState,
              dueAt: candidate.monitoring.reassessmentDueAt,
              note: candidate.monitoring.note,
              policyComparison: {
                policyPhenotype: candidate.policyComparison.policyPhenotype,
                recommendedAction: candidate.policyComparison.recommendedAction,
                policyRationale: candidate.policyComparison.policyRationale,
                candidates: candidate.policyComparison.candidates.slice(0, 5),
              },
            },
            riskDeltaScaled: candidate.riskChangeFromPreviousCheckpointScaled,
            riskChangeFromPreviousCheckpointScaled: candidate.riskChangeFromPreviousCheckpointScaled,
            counterfactualLiftScaled: candidate.counterfactualLiftScaled,
          }

          studentProjectionRows.push({
            simulationStageStudentProjectionId: buildDeterministicId('stage_student_projection', [candidate.checkpoint.simulationStageCheckpointId, candidate.source.studentId, candidate.source.offeringId ?? candidate.source.courseCode]),
            simulationStageCheckpointId: candidate.checkpoint.simulationStageCheckpointId,
            simulationRunId: input.simulationRunId,
            studentId: candidate.source.studentId,
            offeringId: candidate.source.offeringId,
            semesterNumber: candidate.source.semesterNumber,
            sectionCode: candidate.source.sectionCode,
            courseCode: candidate.source.courseCode,
            courseTitle: candidate.source.courseTitle,
            riskProbScaled: candidate.riskProbScaled,
            riskBand: candidate.inference.riskBand,
            noActionRiskProbScaled: candidate.noActionRiskProbScaled,
            noActionRiskBand: candidate.noActionInference.riskBand,
            recommendedAction: candidate.inference.recommendedAction,
            simulatedActionTaken: effectiveActionTaken,
            queueState,
            reassessmentState,
            evidenceWindow: candidate.evidence.evidenceWindow,
            projectionJson: JSON.stringify(projectionJson),
            createdAt: input.now,
            updatedAt: input.now,
          })

          if (queueState !== 'idle') {
            queueProjectionRows.push({
              simulationStageQueueProjectionId: buildDeterministicId('stage_queue_projection', [candidate.checkpoint.simulationStageCheckpointId, candidate.source.studentId, candidate.source.offeringId ?? candidate.source.courseCode]),
              simulationStageCheckpointId: candidate.checkpoint.simulationStageCheckpointId,
              simulationRunId: input.simulationRunId,
              studentId: candidate.source.studentId,
              offeringId: candidate.source.offeringId,
            semesterNumber: candidate.source.semesterNumber,
            sectionCode: candidate.source.sectionCode,
            courseCode: candidate.source.courseCode,
            courseTitle: candidate.source.courseTitle,
            assignedToRole: candidate.monitoring.queueOwnerRole,
            assignedFacultyId: candidate.assignment.assignedFacultyId,
            taskType: mapActionToTaskType(effectiveActionTaken),
            status: queueState === 'resolved'
              ? 'Resolved'
              : queueState === 'watch'
                  ? 'Watching'
                  : 'Open',
            riskBand: candidate.inference.riskBand,
            riskProbScaled: candidate.riskProbScaled,
            noActionRiskProbScaled: candidate.noActionRiskProbScaled,
            recommendedAction: candidate.inference.recommendedAction,
            simulatedActionTaken: effectiveActionTaken,
            simulationStageQueueCaseId: queueCaseId,
            detailJson: JSON.stringify({
                stageKey: stage.key,
                stageLabel: stage.label,
                dueAt: candidate.monitoring.reassessmentDueAt,
                note: candidate.monitoring.note,
                currentEvidence: projectionJson.currentEvidence,
                coEvidenceMode: projectionJson.currentEvidence.coEvidenceMode,
                riskChangeFromPreviousCheckpointScaled: candidate.riskChangeFromPreviousCheckpointScaled,
                counterfactualLiftScaled: candidate.counterfactualLiftScaled,
                previousRiskBand: sourceState.previousRiskBand,
                previousRiskProbScaled: sourceState.previousRiskProbScaled,
                queueCaseId,
                primaryCase: isPrimaryCase,
                countsTowardCapacity,
                priorityRank: decision?.priorityRank ?? null,
                governanceReason: decision?.governanceReason ?? 'idle',
                supportingCourseCount: decision?.supportingSourceKeys.length ?? 0,
                assignedFacultyId: candidate.assignment.assignedFacultyId,
              }),
              createdAt: input.now,
              updatedAt: input.now,
            })
          }

          sourceState.previousRiskBand = candidate.inference.riskBand
          sourceState.previousRiskProbScaled = candidate.riskProbScaled
          if (isPrimaryCase && decision && (decision.status === 'opened' || decision.status === 'open')) {
            sourceState.cooldownUntil = candidate.monitoring.cooldownUntil
            sourceState.actionTaken = candidate.nextActionTaken
          }
          if (isPrimaryCase && decision?.status === 'resolved') {
            sourceState.cooldownUntil = null
            sourceState.actionTaken = null
          }
          sourceStateByKey.set(candidate.sourceKey, sourceState)
        })

        effectiveDecisionByCaseKey.forEach((decision, caseKey) => {
          caseStateByKey.set(caseKey, {
            open: decision.status === 'open' || decision.status === 'opened',
            primarySourceKey: decision.primarySourceKey,
          })
        })
      }
    }
  }

  if (false) {
    sources
    .sort((left, right) => left.studentId.localeCompare(right.studentId) || left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
    .forEach(source => {
      let previousRiskBand: 'High' | 'Medium' | 'Low' | null = null
      let cooldownUntil: string | null = null
      let actionTaken: string | null = null
      let queueOpen = false
      let previousRiskProbScaled: number | null = null

      PLAYBACK_STAGE_DEFS.forEach(stage => {
        const checkpoint = checkpointBySemesterStage.get(`${source.semesterNumber}::${stage.key}`)
        if (!checkpoint) return
        const stageNowIso = playbackCheckpointNowIso(run.createdAt, source.semesterNumber, stage)
        const prerequisiteSummary = prerequisiteSummaryForSource({
          source,
          sourceByStudentNodeId,
          prerequisiteNodeIdsByTargetNodeId,
          downstreamNodeIdsBySourceNodeId,
        })
        const downstreamCarryover = downstreamCarryoverLabelForSource({
          source,
          sourceByStudentNodeId,
          downstreamNodeIdsBySourceNodeId,
        })
        const evidence = buildStageEvidenceSnapshot({
          source,
          stageKey: stage.key,
          policy: input.policy,
          templatesById: templateById,
        })
        const sourceRefs: ObservableSourceRefs = {
          simulationRunId: input.simulationRunId,
          simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
          studentId: source.studentId,
          offeringId: source.offeringId,
          semesterNumber: source.semesterNumber,
          sectionCode: source.sectionCode,
          courseCode: source.courseCode,
          courseTitle: source.courseTitle,
          courseFamily: source.courseFamily,
          coEvidenceMode: dominantCoEvidenceMode(source.coRows),
          stageKey: stage.key,
          prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
          prerequisiteWeakCourseCodes: prerequisiteSummary.prerequisiteWeakCourseCodes,
          weakCourseOutcomeCodes: evidence.weakCourseOutcomes.map(item => item.coCode),
          dominantQuestionTopics: evidence.questionPatterns.commonWeakTopics,
        }
        const featurePayload = buildObservableFeaturePayload({
          attendancePct: evidence.attendancePct,
          attendanceHistory: includedAttendanceForSourceStage(source, stage.key),
          currentCgpa: evidence.currentCgpa,
          backlogCount: evidence.backlogCount,
          tt1Pct: evidence.tt1Pct,
          tt2Pct: evidence.tt2Pct,
          quizPct: evidence.quizPct,
          assignmentPct: evidence.assignmentPct,
          seePct: evidence.seePct,
          weakCoCount: evidence.weakCoCount,
          weakQuestionCount: evidence.weakQuestionCount,
          interventionResponseScore: evidence.interventionResponseScore,
          prerequisiteAveragePct: prerequisiteSummary.prerequisiteAveragePct,
          prerequisiteFailureCount: prerequisiteSummary.prerequisiteFailureCount,
          prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
          downstreamDependencyLoad: prerequisiteSummary.downstreamDependencyLoad,
          weakPrerequisiteChainCount: prerequisiteSummary.weakPrerequisiteChainCount,
          repeatedWeakPrerequisiteFamilyCount: prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount,
          sectionRiskRate: sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
          semesterProgress: stage.order / PLAYBACK_STAGE_DEFS.length,
        })
        const inference = scoreObservableRiskWithModel({
          attendancePct: evidence.attendancePct,
          currentCgpa: evidence.currentCgpa,
          backlogCount: evidence.backlogCount,
          tt1Pct: evidence.tt1Pct,
          tt2Pct: evidence.tt2Pct,
          quizPct: evidence.quizPct,
          assignmentPct: evidence.assignmentPct,
          seePct: evidence.seePct,
          weakCoCount: evidence.weakCoCount,
          attendanceHistoryRiskCount: evidence.attendanceHistoryRiskCount,
          questionWeaknessCount: evidence.weakQuestionCount,
          interventionResponseScore: evidence.interventionResponseScore,
          policy: input.policy,
          featurePayload,
          sourceRefs,
          productionModel: activeRiskArtifacts.production,
          correlations: activeRiskArtifacts.correlations,
        })
        const policyComparison = buildActionPolicyComparison({
          stageKey: stage.key,
          evidence,
          riskBand: inference.riskBand,
          recommendedAction: inference.recommendedAction,
          prerequisiteSummary,
        })
        let nextActionTaken = actionTaken
        const monitoring = buildMonitoringDecision({
          riskProb: inference.riskProb,
          riskBand: inference.riskBand,
          previousRiskBand,
          cooldownUntil,
          evidenceWindowCount: stage.order,
          interventionResidual: evidence.interventionResponseScore,
          nowIso: stageNowIso,
        })
        const shouldSwitchAction = !actionTaken
          || (policyComparison.recommendedAction != null && policyComparison.recommendedAction !== actionTaken && (
            (evidence.interventionResponseScore ?? 0) < -0.03
            || stage.key === 'post-reassessment'
            || stage.key === 'post-tt2'
            || stage.key === 'post-see'
          ))
        nextActionTaken = shouldSwitchAction ? (policyComparison.recommendedAction ?? actionTaken) : actionTaken
        const noAction = buildNoActionSnapshot({
          evidence,
          actionTaken: nextActionTaken,
          stageKey: stage.key,
        })
        const noActionFeaturePayload = buildObservableFeaturePayload({
          attendancePct: noAction.attendancePct,
          attendanceHistory: includedAttendanceForSourceStage(source, stage.key),
          currentCgpa: noAction.currentCgpa,
          backlogCount: noAction.backlogCount,
          tt1Pct: noAction.tt1Pct,
          tt2Pct: noAction.tt2Pct,
          quizPct: noAction.quizPct,
          assignmentPct: noAction.assignmentPct,
          seePct: noAction.seePct,
          weakCoCount: noAction.weakCoCount,
          weakQuestionCount: noAction.weakQuestionCount,
          interventionResponseScore: noAction.interventionResponseScore,
          prerequisiteAveragePct: prerequisiteSummary.prerequisiteAveragePct,
          prerequisiteFailureCount: prerequisiteSummary.prerequisiteFailureCount,
          prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
          downstreamDependencyLoad: prerequisiteSummary.downstreamDependencyLoad,
          weakPrerequisiteChainCount: prerequisiteSummary.weakPrerequisiteChainCount,
          repeatedWeakPrerequisiteFamilyCount: prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount,
          sectionRiskRate: sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
          semesterProgress: stage.order / PLAYBACK_STAGE_DEFS.length,
        })
        const noActionInference = scoreObservableRiskWithModel({
          attendancePct: noAction.attendancePct,
          currentCgpa: noAction.currentCgpa,
          backlogCount: noAction.backlogCount,
          tt1Pct: noAction.tt1Pct,
          tt2Pct: noAction.tt2Pct,
          quizPct: noAction.quizPct,
          assignmentPct: noAction.assignmentPct,
          seePct: noAction.seePct,
          weakCoCount: noAction.weakCoCount,
          attendanceHistoryRiskCount: noAction.attendanceHistoryRiskCount,
          questionWeaknessCount: noAction.weakQuestionCount,
          interventionResponseScore: noAction.interventionResponseScore,
          policy: input.policy,
          featurePayload: noActionFeaturePayload,
          sourceRefs,
          productionModel: activeRiskArtifacts.production,
          correlations: activeRiskArtifacts.correlations,
        })

        const riskProbScaled = Math.round(inference.riskProb * 100)
        const noActionRiskProbScaled = Math.round(noActionInference.riskProb * 100)
        const riskChangeFromPreviousCheckpointScaled = previousRiskProbScaled == null ? 0 : riskProbScaled - previousRiskProbScaled
        const counterfactualLiftScaled = noActionRiskProbScaled - riskProbScaled
        const queueDisposition = queueDispositionForCheckpoint({
          riskBand: inference.riskBand,
          policyPhenotype: policyComparison.policyPhenotype,
          recommendedPolicyAction: policyComparison.recommendedAction ?? nextActionTaken,
          counterfactualLiftScaled,
        })
        let queueState = 'idle'
        let reassessmentState = 'None'
        if (monitoring.decisionType !== 'suppress' && queueDisposition.actionable) {
          if (queueOpen) {
            queueState = 'open'
            reassessmentState = monitoring.decisionType === 'watch' ? 'Watching' : 'Open'
          } else {
            queueState = 'opened'
            reassessmentState = 'Open'
          }
          queueOpen = true
        } else if (queueOpen) {
          queueState = inference.riskBand === 'Low' || stage.key === 'semester-close' ? 'resolved' : 'watch'
          reassessmentState = queueState === 'resolved' ? 'Resolved' : 'Watching'
          queueOpen = false
        } else if (queueDisposition.watch) {
          queueState = 'watch'
          reassessmentState = 'Watching'
          queueOpen = false
        }
        const evidenceSnapshotId = buildDeterministicId('risk_evidence', [checkpoint.simulationStageCheckpointId, source.studentId, source.offeringId ?? source.courseCode])
        const labelPayload: ObservableLabelPayload = {
          attendanceRiskLabel: source.attendancePct < input.policy.attendanceRules.minimumRequiredPercent ? 1 : 0,
          ceShortfallLabel: ceShortfallLabel(source, input.policy),
          seeShortfallLabel: seeShortfallLabel(source, input.policy),
          overallCourseFailLabel: source.result !== 'Passed' ? 1 : 0,
          downstreamCarryoverLabel: downstreamCarryover,
        }
        stageEvidenceRows.push({
          riskEvidenceSnapshotId: evidenceSnapshotId,
          simulationRunId: input.simulationRunId,
          simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
          batchId: run.batchId,
          studentId: source.studentId,
          offeringId: source.offeringId,
          semesterNumber: source.semesterNumber,
          sectionCode: source.sectionCode,
          courseCode: source.courseCode,
          courseTitle: source.courseTitle,
          stageKey: stage.key,
          evidenceWindow: evidence.evidenceWindow,
          featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
          featureJson: JSON.stringify(featurePayload),
          labelJson: JSON.stringify(labelPayload),
          sourceRefsJson: JSON.stringify({
            ...sourceRefs,
            sourceSnapshotHash: featureHash(featurePayload, labelPayload, sourceRefs),
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
        const projectionJson = {
          evidenceSnapshotId,
          stageKey: stage.key,
          stageLabel: stage.label,
          stageDescription: stage.description,
          stageOccurredAt: stageNowIso,
          currentEvidence: {
            attendancePct: roundToOne(evidence.attendancePct),
            tt1Pct: roundToOne(evidence.tt1Pct ?? 0),
            tt2Pct: roundToOne(evidence.tt2Pct ?? 0),
            quizPct: roundToOne(evidence.quizPct ?? 0),
            assignmentPct: roundToOne(evidence.assignmentPct ?? 0),
            seePct: roundToOne(evidence.seePct ?? 0),
            weakCoCount: evidence.weakCoCount,
            weakQuestionCount: evidence.weakQuestionCount,
            coEvidenceMode: sourceRefs.coEvidenceMode ?? null,
            interventionRecoveryStatus: evidence.interventionResponseScore == null
              ? null
              : evidence.interventionResponseScore >= 0 ? 'confirmed' : 'watch',
          },
          currentStatus: {
            riskBand: inference.riskBand,
            riskProbScaled,
            previousRiskBand,
            previousRiskProbScaled,
            riskChangeFromPreviousCheckpointScaled,
            counterfactualLiftScaled,
            recommendedAction: inference.recommendedAction,
            attentionAreas: inference.observableDrivers.slice(0, 4).map(driver => driver.label),
            modelVersion: inference.modelVersion,
            calibrationVersion: inference.calibrationVersion,
            headProbabilities: inference.headProbabilities,
            crossCourseDrivers: inference.crossCourseDrivers,
            queueOwnerRole: monitoring.queueOwnerRole,
            queueState,
            reassessmentState,
            monitoringDecisionType: monitoring.decisionType,
            dueAt: monitoring.reassessmentDueAt,
            policyComparison: {
              policyPhenotype: policyComparison.policyPhenotype,
              recommendedAction: policyComparison.recommendedAction,
              simulatedActionTaken: nextActionTaken,
              noActionRiskBand: noActionInference.riskBand,
              noActionRiskProbScaled: Math.round(noActionInference.riskProb * 100),
              counterfactualLiftScaled,
              rationale: policyComparison.policyRationale,
            },
          },
          noActionComparator: {
            riskBand: noActionInference.riskBand,
            riskProbScaled: noActionRiskProbScaled,
            counterfactualLiftScaled,
          },
          counterfactualPolicyDiagnostics: {
            policyPhenotype: policyComparison.policyPhenotype,
            recommendedAction: policyComparison.recommendedAction,
            simulatedActionTaken: nextActionTaken,
            noActionRiskBand: noActionInference.riskBand,
            noActionRiskProbScaled,
            counterfactualLiftScaled,
            policyRationale: policyComparison.policyRationale,
            candidates: policyComparison.candidates.slice(0, 5),
          },
          realizedPathDiagnostics: {
            policyPhenotype: policyComparison.policyPhenotype,
            previousRiskBand,
            previousRiskProbScaled,
            currentRiskBand: inference.riskBand,
            currentRiskProbScaled: riskProbScaled,
            riskChangeFromPreviousCheckpointScaled,
          },
          questionPatterns: evidence.questionPatterns,
          weakCourseOutcomes: evidence.weakCourseOutcomes,
          actionPath: {
            taskType: mapActionToTaskType(nextActionTaken),
            simulatedActionTaken: nextActionTaken,
            queueState,
            reassessmentState,
            dueAt: monitoring.reassessmentDueAt,
            note: monitoring.note,
            policyComparison: {
              policyPhenotype: policyComparison.policyPhenotype,
              recommendedAction: policyComparison.recommendedAction,
              policyRationale: policyComparison.policyRationale,
              candidates: policyComparison.candidates.slice(0, 5),
            },
          },
          riskDeltaScaled: riskChangeFromPreviousCheckpointScaled,
          riskChangeFromPreviousCheckpointScaled,
          counterfactualLiftScaled,
        }

        studentProjectionRows.push({
          simulationStageStudentProjectionId: buildDeterministicId('stage_student_projection', [checkpoint.simulationStageCheckpointId, source.studentId, source.offeringId ?? source.courseCode]),
          simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
          simulationRunId: input.simulationRunId,
          studentId: source.studentId,
          offeringId: source.offeringId,
          semesterNumber: source.semesterNumber,
          sectionCode: source.sectionCode,
          courseCode: source.courseCode,
          courseTitle: source.courseTitle,
          riskProbScaled,
          riskBand: inference.riskBand,
          noActionRiskProbScaled,
          noActionRiskBand: noActionInference.riskBand,
          recommendedAction: inference.recommendedAction,
          simulatedActionTaken: nextActionTaken,
          queueState,
          reassessmentState,
          evidenceWindow: evidence.evidenceWindow,
          projectionJson: JSON.stringify(projectionJson),
          createdAt: input.now,
          updatedAt: input.now,
        })

        if (queueState !== 'idle') {
          queueProjectionRows.push({
            simulationStageQueueProjectionId: buildDeterministicId('stage_queue_projection', [checkpoint.simulationStageCheckpointId, source.studentId, source.offeringId ?? source.courseCode]),
            simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
            simulationRunId: input.simulationRunId,
            studentId: source.studentId,
            offeringId: source.offeringId,
            semesterNumber: source.semesterNumber,
            sectionCode: source.sectionCode,
            courseCode: source.courseCode,
            courseTitle: source.courseTitle,
            assignedToRole: monitoring.queueOwnerRole,
            taskType: mapActionToTaskType(nextActionTaken),
            status: queueState === 'resolved'
              ? 'Resolved'
              : queueState === 'watch'
                ? 'Watching'
                : 'Open',
            riskBand: inference.riskBand,
            riskProbScaled,
            noActionRiskProbScaled,
            recommendedAction: inference.recommendedAction,
            simulatedActionTaken: nextActionTaken,
            detailJson: JSON.stringify({
              stageKey: stage.key,
              stageLabel: stage.label,
              dueAt: monitoring.reassessmentDueAt,
              note: monitoring.note,
              currentEvidence: projectionJson.currentEvidence,
              coEvidenceMode: projectionJson.currentEvidence.coEvidenceMode,
              riskChangeFromPreviousCheckpointScaled,
              counterfactualLiftScaled,
              previousRiskBand,
              previousRiskProbScaled,
            }),
            createdAt: input.now,
            updatedAt: input.now,
          })
        }

        previousRiskBand = inference.riskBand
        previousRiskProbScaled = riskProbScaled
        cooldownUntil = monitoring.cooldownUntil
        actionTaken = nextActionTaken
      })
    })
  }

  const offeringProjectionRows: Array<typeof simulationStageOfferingProjections.$inferInsert> = []
  const offeringGroups = new Map<string, Array<typeof simulationStageStudentProjections.$inferInsert>>()
  studentProjectionRows.forEach(row => {
    const key = `${row.simulationStageCheckpointId}::${row.offeringId ?? row.courseCode}::${row.sectionCode}`
    offeringGroups.set(key, [...(offeringGroups.get(key) ?? []), row])
  })
  offeringGroups.forEach(rows => {
    const first = rows[0]
    if (!first) return
    const firstProjection = parseJson(first.projectionJson, {} as Record<string, unknown>)
    const checkpoint = checkpointBySemesterStage.get(`${first.semesterNumber}::${String(firstProjection.stageKey ?? '')}`) ?? orderedCheckpointRows.find(row => row.simulationStageCheckpointId === first.simulationStageCheckpointId)
    if (!checkpoint) return
    const pendingAction = [...new Set(rows.map(row => row.simulatedActionTaken).filter((value): value is string => !!value))][0] ?? null
    const projectionJson = {
      averageRiskProbScaled: roundToOne(average(rows.map(row => row.riskProbScaled))),
      highRiskCount: rows.filter(row => row.riskBand === 'High').length,
      mediumRiskCount: rows.filter(row => row.riskBand === 'Medium').length,
      openQueueCount: queueProjectionRows.filter(row => row.simulationStageCheckpointId === first.simulationStageCheckpointId && row.courseCode === first.courseCode && row.sectionCode === first.sectionCode && row.status === 'Open').length,
      studentCount: rows.length,
      averageAttendancePct: roundToOne(average(rows.map(row => {
        const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.attendancePct ?? 0)
      }))),
      averageTt1Pct: roundToOne(average(rows.map(row => {
        const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.tt1Pct ?? 0)
      }))),
      averageTt2Pct: roundToOne(average(rows.map(row => {
        const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.tt2Pct ?? 0)
      }))),
      averageSeePct: roundToOne(average(rows.map(row => {
        const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        return Number(currentEvidence.seePct ?? 0)
      }))),
      pendingAction,
    }
    offeringProjectionRows.push({
      simulationStageOfferingProjectionId: buildDeterministicId('stage_offering_projection', [first.simulationStageCheckpointId, first.offeringId ?? first.courseCode, first.sectionCode]),
      simulationStageCheckpointId: first.simulationStageCheckpointId,
      simulationRunId: input.simulationRunId,
      offeringId: first.offeringId,
      curriculumNodeId: sources.find(source => source.studentId === first.studentId && source.semesterNumber === first.semesterNumber && source.courseCode === first.courseCode && source.sectionCode === first.sectionCode)?.curriculumNodeId ?? null,
      semesterNumber: first.semesterNumber,
      sectionCode: first.sectionCode,
      courseCode: first.courseCode,
      courseTitle: first.courseTitle,
      stage: checkpoint.stageOrder,
      stageLabel: checkpoint.stageLabel,
      stageDescription: checkpoint.stageDescription,
      pendingAction,
      projectionJson: JSON.stringify(projectionJson),
      createdAt: input.now,
      updatedAt: input.now,
    })
  })

  orderedCheckpointRows.forEach(checkpoint => {
    const checkpointStudentRows = studentProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const checkpointQueueRows = queueProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const checkpointOfferingRows = offeringProjectionRows.filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
    const electiveVisibleCount = (
      checkpoint.semesterNumber > 5
      || (checkpoint.semesterNumber === 5 && checkpoint.stageKey === 'semester-close')
    )
      ? electiveRows.length
      : 0
    checkpoint.summaryJson = JSON.stringify(stageSummaryPayload({
      checkpoint,
      studentRows: checkpointStudentRows,
      queueRows: checkpointQueueRows,
      offeringRows: checkpointOfferingRows,
      electiveVisibleCount,
    }))
  })

  if (orderedCheckpointRows.length > 0) await insertRowsInChunks(db, simulationStageCheckpoints, orderedCheckpointRows)
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

async function readRuntimeCurriculum(db: AppDb, curriculumImportVersionId: string) {
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
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
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
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
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
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
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

export async function startProofSimulationRun(db: AppDb, input: {
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
    throw new Error('The proof simulator is currently scoped to the seeded MSRUAS proof batch only')
  }
  const runtime = await readRuntimeCurriculum(db, input.curriculumImportVersionId)
  const sem6 = runtime.courses.filter(course => course.semesterNumber === 6)
  if (runtime.courses.length === 0 || sem6.length === 0) throw new Error('Approved curriculum import is incomplete')
  const runSeed = input.seed ?? Math.floor(Date.now() % 100000)
  const scenarioProfile = scenarioProfileForSeed(runSeed)
  const deterministicPolicy = deterministicPolicyFromResolved(input.policy)
  const simulationRunId = createId('simulation_run')
  const activate = input.activate ?? true

  if (activate) {
    await db.update(simulationRuns).set({
      activeFlag: 0,
      updatedAt: input.now,
      status: 'completed',
    }).where(eq(simulationRuns.batchId, input.batchId))
  }

  const [sem6OfferingState] = await Promise.all([
    ensureSem6Offerings(db, runtime.courses, input.now),
  ])
  const offerings = sem6OfferingState.offerings
  const courseRows = await db.select().from(courses).where(eq(courses.departmentId, MSRUAS_PROOF_DEPARTMENT_ID))
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const sem6OfferingByCourseTitleSection = new Map<string, typeof sectionOfferings.$inferSelect>()
  for (const offering of offerings) {
    const course = courseById.get(offering.courseId)
    if (!course) continue
    sem6OfferingByCourseTitleSection.set(`${course.title}::${offering.sectionCode}`, offering)
  }

  await db.insert(simulationRuns).values({
    simulationRunId,
    batchId: input.batchId,
    curriculumImportVersionId: input.curriculumImportVersionId,
    curriculumFeatureProfileId: input.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    parentSimulationRunId: input.parentSimulationRunId ?? null,
    runLabel: input.runLabel ?? `MSRUAS proof rerun ${runSeed}`,
    status: activate ? 'active' : 'completed',
    activeFlag: activate ? 1 : 0,
    seed: runSeed,
    sectionCount: 2,
    studentCount: 120,
    facultyCount: PROOF_FACULTY.length,
    semesterStart: 1,
    semesterEnd: 6,
    sourceType: 'simulation',
    policySnapshotJson: JSON.stringify(input.policy),
    engineVersionsJson: JSON.stringify({
      compilerVersion: MSRUAS_PROOF_VALIDATOR_VERSION,
      worldEngineVersion: WORLD_ENGINE_VERSION,
      inferenceModelVersion: INFERENCE_MODEL_VERSION,
      monitoringPolicyVersion: MONITORING_POLICY_VERSION,
    }),
    metricsJson: JSON.stringify({
      proofGoal: 'adaptation-readiness',
      sectionDistribution: { A: 60, B: 60 },
      scenarioFamily: scenarioProfile.family,
    }),
    createdAt: input.now,
    updatedAt: input.now,
  })

  const trajectories = Array.from({ length: 120 }, (_, index) => buildStudentTrajectory(index, runSeed, scenarioProfile))
  const mentorFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('MENTOR'))
  const courseLeaderFaculty = PROOF_FACULTY.filter(item => item.permissions.includes('COURSE_LEADER'))
  const questionPaperRows = offerings.length > 0
    ? await db.select().from(offeringQuestionPapers).where(inArray(offeringQuestionPapers.offeringId, offerings.map(offering => offering.offeringId)))
    : []
  const blueprintByOfferingKind = new Map<string, { nodes: BlueprintNode[] }>()
  for (const paper of questionPaperRows) {
    const parsed = parseJson(paper.blueprintJson, {} as { nodes?: BlueprintNode[] })
    if (Array.isArray(parsed.nodes)) {
      blueprintByOfferingKind.set(`${paper.offeringId}::${paper.kind}`, { nodes: parsed.nodes })
    }
  }

  const teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert> = []
  const teacherLoadRows: Array<typeof teacherLoadProfiles.$inferInsert> = []
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
  const loadsByFacultyId = new Map<string, Array<{ offeringId: string; courseCode: string; courseName: string; sectionCode: string; semesterNumber: number; weeklyHours: number }>>()

  const questionTemplatesByScope = new Map<string, SimulatedQuestionTemplate[]>()
  for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
    const semesterCourses = runtime.courses.filter(course => course.semesterNumber === semesterNumber)
    ;(['A', 'B'] as const).forEach((sectionCode, sectionOffset) => {
      const sectionContext = {
        sectionAbilityMean: roundToTwo(average(
          trajectories.filter(student => student.sectionCode === sectionCode).map(student => student.latentBase.academicPotential),
        )),
        sectionAttendanceCulture: roundToTwo(average(
          trajectories.filter(student => student.sectionCode === sectionCode).map(student => student.profile.behavior.attendancePropensity),
        )),
        teacherStrictnessIndex: roundToTwo(stableBetween(`run-${runSeed}-sem-${semesterNumber}-${sectionCode}-strict`, 0.32, 0.78)),
        assessmentDifficultyIndex: roundToTwo(stableBetween(`run-${runSeed}-sem-${semesterNumber}-${sectionCode}-difficulty`, 0.38, 0.84)),
        interventionCapacity: roundToTwo(stableBetween(`run-${runSeed}-sem-${semesterNumber}-${sectionCode}-capacity`, 0.34, 0.82)),
      }
      worldContextRows.push({
        worldContextSnapshotId: createId('world_context'),
        simulationRunId,
        semesterNumber,
        sectionCode,
        contextType: 'section',
        contextKey: `semester-${semesterNumber}-${sectionCode}`,
        contextJson: JSON.stringify(sectionContext),
        createdAt: input.now,
        updatedAt: input.now,
      })

      semesterCourses.forEach((course, courseIndex) => {
        const faculty = courseLeaderFaculty[(courseIndex + sectionOffset) % courseLeaderFaculty.length]
        const offeringId = semesterNumber === 6
          ? sem6OfferingByCourseTitleSection.get(`${course.title}::${sectionCode}`)?.offeringId ?? null
          : null
        teacherAllocationRows.push({
          teacherAllocationId: createId('teacher_allocation'),
          simulationRunId,
          facultyId: faculty.facultyId,
          offeringId,
          curriculumNodeId: course.curriculumNodeId,
          semesterNumber,
          sectionCode,
          allocationRole: faculty.permissions.includes('COURSE_LEADER') ? 'course-leader' : 'mentor',
          plannedContactHours: weeklyContactHoursForCourse(course),
          createdAt: input.now,
          updatedAt: input.now,
        })
        if (offeringId) {
          const current = loadsByFacultyId.get(faculty.facultyId) ?? []
          current.push({
            offeringId,
            courseCode: courseCodeForRuntime(course),
            courseName: course.title,
            sectionCode,
            semesterNumber,
            weeklyHours: weeklyContactHoursForCourse(course),
          })
          loadsByFacultyId.set(faculty.facultyId, current)
        }

        const simulatedTemplates = buildSimulatedQuestionTemplates({
          simulationRunId,
          semesterNumber,
          course,
          offeringId,
          tt1Topics: course.tt1Topics,
          tt2Topics: course.tt2Topics,
          seeTopics: course.seeTopics,
        })
        const templateGroup = semesterNumber === 6 && offeringId
          ? [
              ...(blueprintByOfferingKind.has(`${offeringId}::tt1`)
                ? buildTemplatesFromBlueprint({
                    simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'tt1',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::tt1`) ?? { nodes: [] },
                    topicFallback: course.tt1Topics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'tt1')),
              ...(blueprintByOfferingKind.has(`${offeringId}::tt2`)
                ? buildTemplatesFromBlueprint({
                    simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'tt2',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::tt2`) ?? { nodes: [] },
                    topicFallback: course.tt2Topics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'tt2')),
              ...(blueprintByOfferingKind.has(`${offeringId}::see`)
                ? buildTemplatesFromBlueprint({
                    simulationRunId,
                    semesterNumber,
                    course,
                    offeringId,
                    componentType: 'see',
                    blueprint: blueprintByOfferingKind.get(`${offeringId}::see`) ?? { nodes: [] },
                    topicFallback: course.seeTopics,
                  })
                : simulatedTemplates.filter(template => template.componentType === 'see')),
            ]
          : simulatedTemplates

        questionTemplatesByScope.set(offeringId ?? course.curriculumNodeId, templateGroup)
        templateGroup.forEach(template => {
          questionTemplateRows.push({
            simulationQuestionTemplateId: template.simulationQuestionTemplateId,
            simulationRunId: template.simulationRunId,
            semesterNumber: template.semesterNumber,
            curriculumNodeId: template.curriculumNodeId,
            offeringId: template.offeringId,
            componentType: template.componentType,
            questionIndex: template.questionIndex,
            questionCode: template.questionCode,
            questionType: template.questionType,
            questionMarks: template.questionMarks,
            difficultyScaled: template.difficultyScaled,
            transferDemandScaled: template.transferDemandScaled,
            coTagsJson: JSON.stringify(template.coTags),
            topicTagsJson: JSON.stringify(template.topicTags),
            microSkillTagsJson: JSON.stringify(template.microSkillTags),
            sourceType: template.sourceType,
            templateJson: JSON.stringify(template.templateJson),
            createdAt: input.now,
            updatedAt: input.now,
          })
        })
      })
    })
  }

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

    const courseScores = new Map<string, number>()
    const cumulativeAttempts: GradePointSubjectAttempt[][] = []
    let currentCgpa = 0
    let activeBacklogCount = 0

    for (let semesterNumber = 1; semesterNumber <= 5; semesterNumber += 1) {
      const semesterCourses = runtime.courses.filter(course => course.semesterNumber === semesterNumber)
      const semesterAttempts: GradePointSubjectAttempt[] = []
      const subjectScores: Array<Record<string, unknown>> = []
      let semesterWeakCoCount = 0
      let semesterQuestionCoverage = 0
      let semesterInterventionCount = 0

      semesterCourses.forEach((course, courseIndex) => {
        const faculty = courseLeaderFaculty[(courseIndex + (trajectory.sectionCode === 'B' ? 1 : 0)) % courseLeaderFaculty.length]
        const simulation = simulateSemesterCourse({
          student: trajectory,
          course,
          semesterNumber,
          scoresByCourseTitle: courseScores,
          facultyId: faculty.facultyId,
          policy: deterministicPolicy,
          runSeed,
        })
        const templates = questionTemplatesByScope.get(course.curriculumNodeId) ?? []
        const questionResults = simulateQuestionResults({
          student: trajectory,
          course,
          templates,
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          seePct: simulation.seePct,
          runSeed,
        })
        const coStates = buildCourseOutcomeStates({
          simulationRunId,
          student: trajectory,
          course,
          semesterNumber,
          mastery: Number(simulation.latentSummary.mastery ?? 0),
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          seePct: simulation.seePct,
          templates,
          questionResults: questionResults.results,
          runSeed,
          now: input.now,
        })
        topicStateRows.push(...buildTopicStateRows({
          simulationRunId,
          student: trajectory,
          course,
          semesterNumber,
          mastery: Number(simulation.latentSummary.mastery ?? 0),
          prereq: Number(simulation.latentSummary.prereq ?? 0),
          runSeed,
          now: input.now,
        }))
        coStateRows.push(...coStates.rows)
        questionResults.results.forEach(result => {
          questionResultRows.push({
            studentQuestionResultId: createId('question_result'),
            simulationRunId,
            studentId: trajectory.studentId,
            semesterNumber,
            curriculumNodeId: course.curriculumNodeId,
            offeringId: null,
            simulationQuestionTemplateId: result.simulationQuestionTemplateId,
            componentType: result.componentType,
            sectionCode: trajectory.sectionCode,
            score: result.score,
            maxScore: result.maxScore,
            resultJson: JSON.stringify({
              studentScoreOnQuestion: result.score,
              studentPartialCreditProfile: result.partialCreditProfile,
              errorTypeObserved: result.errorType,
            }),
            createdAt: input.now,
            updatedAt: input.now,
          })
        })

        const historicalInterventionNeeded = (simulation.result === 'Failed' || simulation.prerequisiteCarryoverRisk >= 0.68) && semesterNumber >= 3
        let historicalInterventionSummary: Record<string, unknown> | null = null
        if (historicalInterventionNeeded) {
          semesterInterventionCount += 1
          const interventionId = createId('intervention')
          const interventionType = simulation.prerequisiteCarryoverRisk >= 0.68 ? 'prerequisite-bridge' : 'structured-study-plan'
          const accepted = stableUnit(`run-${runSeed}-${trajectory.studentId}-${course.internalCompilerId}-historical-intervention`) < trajectory.profile.intervention.interventionReceptivity
          const completed = accepted && stableUnit(`run-${runSeed}-${trajectory.studentId}-${course.internalCompilerId}-historical-completion`) < trajectory.profile.behavior.practiceCompliance
          const temporalLift = interventionType === 'prerequisite-bridge' ? (simulation.seePct - simulation.tt1Pct) / 100 : (simulation.tt2Pct - simulation.tt1Pct) / 100
          const residual = roundToTwo(temporalLift - trajectory.profile.intervention.expectedRecoveryThreshold)
          interventionRows.push({
            interventionId,
            studentId: trajectory.studentId,
            facultyId: mentorFaculty[index % mentorFaculty.length].facultyId,
            offeringId: null,
            interventionType,
            note: `Generated ${interventionType} for ${courseCodeForRuntime(course)} in semester ${semesterNumber}.`,
            occurredAt: input.now,
            createdAt: input.now,
            updatedAt: input.now,
          })
          interventionResponseRows.push({
            studentInterventionResponseStateId: createId('intervention_response'),
            simulationRunId,
            studentId: trajectory.studentId,
            semesterNumber,
            sectionCode: trajectory.sectionCode,
            offeringId: null,
            interventionId,
            interventionType,
            responseStateJson: JSON.stringify({
              interventionOfferFlag: true,
              interventionAcceptanceProb: roundToTwo(trajectory.profile.intervention.interventionReceptivity),
              interventionCompletionProb: roundToTwo(trajectory.profile.behavior.practiceCompliance),
              interventionReceptivity: roundToTwo(trajectory.profile.intervention.interventionReceptivity),
              temporaryUpliftCredit: roundToTwo(trajectory.profile.intervention.temporaryUpliftCredit),
              expectedRecoveryThreshold: roundToTwo(trajectory.profile.intervention.expectedRecoveryThreshold),
              observedVsExpectedResidual: residual,
              recoveryConfirmedFlag: residual >= 0 && completed,
              watchModeFlag: residual < 0.02,
              escalationNeededFlag: !completed || residual < -0.05,
              nonresponseCount: accepted ? 0 : 1,
              switchInterventionFlag: completed ? false : residual < -0.08,
            }),
            createdAt: input.now,
            updatedAt: input.now,
          })
          historicalInterventionSummary = {
            interventionType,
            accepted,
            completed,
            recoveryConfirmed: residual >= 0 && completed,
            residual,
          }
        }

        courseScores.set(course.title, simulation.overallMark)
        semesterAttempts.push({
          courseCode: courseCodeForRuntime(course),
          credits: course.credits,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
        })
        semesterWeakCoCount += coStates.weakCoCount
        semesterQuestionCoverage += questionResults.results.length
        subjectScores.push({
          courseCode: courseCodeForRuntime(course),
          title: course.title,
          credits: course.credits,
          score: simulation.overallMark,
          attendancePct: simulation.attendancePct,
          attendanceHistory: simulation.attendanceHistory,
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          quizPct: simulation.quizPct,
          assignmentPct: simulation.assignmentPct,
          cePct: simulation.cePct,
          seePct: simulation.seePct,
          gradeLabel: simulation.gradeLabel,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
          weakCoCount: coStates.weakCoCount,
          coSummary: coStates.summaries,
          questionEvidenceSummary: questionResults.summary,
          courseworkToTtGap: simulation.courseworkToTtGap,
          ttMomentum: simulation.ttMomentum,
          prerequisiteCarryoverRisk: simulation.prerequisiteCarryoverRisk,
          interventionResponse: historicalInterventionSummary,
        })
        latentRows.push({
          studentLatentStateId: createId('latent_state'),
          simulationRunId,
          studentId: trajectory.studentId,
          semesterNumber,
          sectionCode: trajectory.sectionCode,
          latentStateJson: JSON.stringify({
            ...trajectory.latentBase,
            archetype: trajectory.archetype,
            readiness: trajectory.profile.readiness,
            dynamics: trajectory.profile.dynamics,
            courseInternalId: course.internalCompilerId,
            courseTitle: course.title,
            scoreForecast: simulation.overallMark,
            ...simulation.latentSummary,
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
      })

      const sgpa = calculateSgpa({
        attempts: semesterAttempts,
        policy: {
          roundingRules: deterministicPolicy.roundingRules,
          sgpaCgpaRules: deterministicPolicy.sgpaCgpaRules,
        },
      })
      cumulativeAttempts.push(semesterAttempts)
      currentCgpa = calculateCgpa({
        termAttempts: cumulativeAttempts,
        policy: {
          roundingRules: deterministicPolicy.roundingRules,
          sgpaCgpaRules: deterministicPolicy.sgpaCgpaRules,
        },
      })
      const registeredCredits = semesterCourses.reduce((sum, course) => sum + course.credits, 0)
      const earnedCredits = subjectScores.filter(subject => subject.result === 'Passed').reduce((sum, subject) => sum + Number(subject.credits ?? 0), 0)
      activeBacklogCount += subjectScores.filter(subject => subject.result === 'Failed').length
      const term = PROOF_TERM_DEFS.find(item => item.semesterNumber === semesterNumber)
      if (!term) continue
      const transcriptTermResultId = createId('transcript_term')
      transcriptTermRowsInsert.push({
        transcriptTermResultId,
        studentId: trajectory.studentId,
        termId: term.termId,
        sgpaScaled: Math.round(sgpa * 100),
        registeredCredits,
        earnedCredits,
        backlogCount: activeBacklogCount,
        createdAt: input.now,
        updatedAt: input.now,
      })
      subjectScores.forEach(subject => {
        transcriptSubjectRowsInsert.push({
          transcriptSubjectResultId: createId('transcript_subject'),
          transcriptTermResultId,
          courseCode: String(subject.courseCode),
          title: String(subject.title),
          credits: Number(subject.credits ?? 0),
          score: Number(subject.score ?? 0),
          gradeLabel: String(subject.gradeLabel ?? 'F'),
          gradePoint: Number(subject.gradePoint ?? 0),
          result: String(subject.result ?? 'Failed'),
          createdAt: input.now,
          updatedAt: input.now,
        })
      })
      observedRows.push({
        studentObservedSemesterStateId: createId('observed_state'),
        simulationRunId,
        studentId: trajectory.studentId,
        termId: term.termId,
        semesterNumber,
        sectionCode: trajectory.sectionCode,
        observedStateJson: JSON.stringify({
          sgpa,
          cgpaAfterSemester: currentCgpa,
          registeredCredits,
          earnedCredits,
          backlogCount: activeBacklogCount,
          weakCoCount: semesterWeakCoCount,
          questionResultCoverage: semesterQuestionCoverage,
          interventionCount: semesterInterventionCount,
          subjectScores,
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
      if (semesterNumber > 1) {
        transitionRows.push({
          semesterTransitionLogId: createId('semester_transition'),
          simulationRunId,
          studentId: trajectory.studentId,
          fromSemester: semesterNumber - 1,
          toSemester: semesterNumber,
          summaryJson: JSON.stringify({
            cgpa: currentCgpa,
            backlogCount: activeBacklogCount,
            transitionReadiness: activeBacklogCount === 0 && currentCgpa >= 6 ? 'stable' : activeBacklogCount <= 1 ? 'review' : 'support-required',
          }),
          createdAt: input.now,
        })
      }
    }

    const electiveRecommendation = electiveRecommendationForStudent({
      courseScores,
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

    sem6.forEach((course, courseIndex) => {
      const offering = sem6OfferingByCourseTitleSection.get(`${course.title}::${trajectory.sectionCode}`)
      if (!offering) return
      const faculty = courseLeaderFaculty[(courseIndex + (trajectory.sectionCode === 'B' ? 1 : 0)) % courseLeaderFaculty.length]
      const simulation = simulateSemesterCourse({
        student: trajectory,
        course,
        semesterNumber: 6,
        scoresByCourseTitle: courseScores,
        facultyId: faculty.facultyId,
        policy: deterministicPolicy,
        runSeed,
      })
      const templates = questionTemplatesByScope.get(offering.offeringId) ?? []
      const questionResults = simulateQuestionResults({
        student: trajectory,
        course,
        templates,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        runSeed,
      })
      const coStates = buildCourseOutcomeStates({
        simulationRunId,
        student: trajectory,
        course,
        semesterNumber: 6,
        offeringId: offering.offeringId,
        mastery: Number(simulation.latentSummary.mastery ?? 0),
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        seePct: simulation.seePct,
        templates,
        questionResults: questionResults.results,
        runSeed,
        now: input.now,
      })
      topicStateRows.push(...buildTopicStateRows({
        simulationRunId,
        student: trajectory,
        course,
        semesterNumber: 6,
        offeringId: offering.offeringId,
        mastery: Number(simulation.latentSummary.mastery ?? 0),
        prereq: Number(simulation.latentSummary.prereq ?? 0),
        runSeed,
        now: input.now,
      }))
      coStateRows.push(...coStates.rows)
      questionResults.results.forEach(result => {
        questionResultRows.push({
          studentQuestionResultId: createId('question_result'),
          simulationRunId,
          studentId: trajectory.studentId,
          semesterNumber: 6,
          curriculumNodeId: course.curriculumNodeId,
          offeringId: offering.offeringId,
          simulationQuestionTemplateId: result.simulationQuestionTemplateId,
          componentType: result.componentType,
          sectionCode: trajectory.sectionCode,
          score: result.score,
          maxScore: result.maxScore,
          resultJson: JSON.stringify({
            studentScoreOnQuestion: result.score,
            studentPartialCreditProfile: result.partialCreditProfile,
            errorTypeObserved: result.errorType,
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
      })

      const recoveryInterventionType = coStates.weakCoCount >= 2
        ? 'targeted-tutoring'
        : simulation.prerequisiteCarryoverRisk >= 0.65
          ? 'prerequisite-bridge'
          : simulation.tt2Pct < 50
            ? 'pre-see-rescue'
            : 'mentor-check-in'
      const interventionAccepted = stableUnit(`run-${runSeed}-${trajectory.studentId}-${offering.offeringId}-accept`) < trajectory.profile.intervention.interventionReceptivity
      const interventionCompleted = interventionAccepted && stableUnit(`run-${runSeed}-${trajectory.studentId}-${offering.offeringId}-complete`) < trajectory.profile.behavior.practiceCompliance
      const temporalLift = recoveryInterventionType === 'pre-see-rescue'
        ? (simulation.seePct - simulation.tt2Pct) / 100
        : recoveryInterventionType === 'prerequisite-bridge'
          ? (simulation.seePct - simulation.tt1Pct) / 100
          : (simulation.tt2Pct - simulation.tt1Pct) / 100
      const responseResidual = roundToTwo(temporalLift - trajectory.profile.intervention.expectedRecoveryThreshold)
      const inference = inferObservableRisk({
        attendancePct: simulation.attendancePct,
        currentCgpa,
        backlogCount: activeBacklogCount,
        tt1Pct: simulation.tt1Pct,
        tt2Pct: simulation.tt2Pct,
        quizPct: simulation.quizPct,
        assignmentPct: simulation.assignmentPct,
        seePct: simulation.seePct,
        weakCoCount: coStates.weakCoCount,
        interventionResponseScore: interventionCompleted ? responseResidual : -Math.abs(responseResidual),
        attendanceHistoryRiskCount: simulation.attendanceHistory.filter(entry => entry.attendancePct < input.policy.attendanceRules.minimumRequiredPercent).length,
        questionWeaknessCount: questionResults.summary.weakQuestionCount,
        policy: input.policy,
      })
      const monitoring = buildMonitoringDecision({
        riskProb: inference.riskProb,
        riskBand: inference.riskBand,
        previousRiskBand: inference.riskBand === 'High' && stableUnit(`run-${runSeed}-${trajectory.studentId}-${offering.offeringId}-prev`) > 0.55 ? 'Medium' : null,
        cooldownUntil: null,
        evidenceWindowCount: 3,
        interventionResidual: responseResidual,
        nowIso: input.now,
      })

      attendanceRows.push({
        attendanceSnapshotId: createId('attendance'),
        studentId: trajectory.studentId,
        offeringId: offering.offeringId,
        presentClasses: simulation.attendanceHistory[simulation.attendanceHistory.length - 1]?.presentClasses ?? Math.round((simulation.attendancePct / 100) * 32),
        totalClasses: simulation.attendanceHistory[simulation.attendanceHistory.length - 1]?.totalClasses ?? 32,
        attendancePercent: simulation.attendancePct,
        source: `proof-run:${simulationRunId}`,
        capturedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      })
      assessmentRows.push(
        {
          assessmentScoreId: createId('assessment_tt1'),
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          componentType: 'tt1',
          componentCode: 'TT1',
          score: Math.round((simulation.tt1Pct / 100) * 25),
          maxScore: 25,
          evaluatedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        },
        {
          assessmentScoreId: createId('assessment_tt2'),
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          componentType: 'tt2',
          componentCode: 'TT2',
          score: Math.round((simulation.tt2Pct / 100) * 25),
          maxScore: 25,
          evaluatedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        },
        {
          assessmentScoreId: createId('assessment_quiz1'),
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          componentType: 'quiz1',
          componentCode: 'Quiz 1',
          score: Math.round((simulation.quizPct / 100) * 10),
          maxScore: 10,
          evaluatedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        },
        {
          assessmentScoreId: createId('assessment_assignment1'),
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          componentType: 'asgn1',
          componentCode: 'Assignment 1',
          score: Math.round((simulation.assignmentPct / 100) * 10),
          maxScore: 10,
          evaluatedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        },
        {
          assessmentScoreId: createId('assessment_see'),
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          componentType: 'see',
          componentCode: 'SEE',
          score: Math.round((simulation.seePct / 100) * 40),
          maxScore: 40,
          evaluatedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        },
      )
      const riskAssessmentId = createId('risk_assessment')
      const evidenceSnapshotId = createId('evidence_snapshot')
      riskRows.push({
        riskAssessmentId,
        simulationRunId,
        studentId: trajectory.studentId,
        offeringId: offering.offeringId,
        termId: 'term_mnc_sem6',
        assessmentScope: 'observable-only',
        riskProbScaled: Math.round(inference.riskProb * 100),
        riskBand: inference.riskBand,
        recommendedAction: inference.recommendedAction,
        driversJson: JSON.stringify(inference.observableDrivers),
        evidenceWindow: simulation.seePct > 0 ? 'semester-6-see' : simulation.tt2Pct > 0 ? 'semester-6-tt2' : 'semester-6-tt1',
        evidenceSnapshotId,
        modelVersion: INFERENCE_MODEL_VERSION,
        policyVersion: 'resolved-batch-policy',
        sourceType: 'simulation',
        assessedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      })
      const interventionId = createId('intervention')
      interventionRows.push({
        interventionId,
        studentId: trajectory.studentId,
        facultyId: mentorFaculty[index % mentorFaculty.length].facultyId,
        offeringId: offering.offeringId,
        interventionType: recoveryInterventionType,
        note: `Generated ${recoveryInterventionType} for ${courseCodeForRuntime(course)} from the active proof run.`,
        occurredAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      })
      interventionResponseRows.push({
        studentInterventionResponseStateId: createId('intervention_response'),
        simulationRunId,
        studentId: trajectory.studentId,
        semesterNumber: 6,
        sectionCode: trajectory.sectionCode,
        offeringId: offering.offeringId,
        interventionId,
        interventionType: recoveryInterventionType,
        responseStateJson: JSON.stringify({
          interventionOfferFlag: true,
          interventionAcceptanceProb: roundToTwo(trajectory.profile.intervention.interventionReceptivity),
          interventionCompletionProb: roundToTwo(trajectory.profile.behavior.practiceCompliance),
          interventionReceptivity: roundToTwo(trajectory.profile.intervention.interventionReceptivity),
          temporaryUpliftCredit: roundToTwo(trajectory.profile.intervention.temporaryUpliftCredit),
          expectedRecoveryThreshold: roundToTwo(trajectory.profile.intervention.expectedRecoveryThreshold),
          observedVsExpectedResidual: responseResidual,
          recoveryConfirmedFlag: responseResidual >= 0 && interventionCompleted,
          watchModeFlag: Math.abs(responseResidual) < 0.04,
          escalationNeededFlag: !interventionCompleted || responseResidual < -0.05,
          nonresponseCount: interventionAccepted ? 0 : 1,
          switchInterventionFlag: !interventionCompleted || responseResidual < -0.08,
          accepted: interventionAccepted,
          completed: interventionCompleted,
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
      observedRows.push({
        studentObservedSemesterStateId: createId('observed_state'),
        simulationRunId,
        studentId: trajectory.studentId,
        termId: 'term_mnc_sem6',
        semesterNumber: 6,
        sectionCode: trajectory.sectionCode,
        observedStateJson: JSON.stringify({
          offeringId: offering.offeringId,
          courseTitle: course.title,
          courseCode: courseCodeForRuntime(course),
          attendancePct: simulation.attendancePct,
          attendanceHistory: simulation.attendanceHistory,
          tt1Pct: simulation.tt1Pct,
          tt2Pct: simulation.tt2Pct,
          quizPct: simulation.quizPct,
          assignmentPct: simulation.assignmentPct,
          seePct: simulation.seePct,
          cePct: simulation.cePct,
          finalMark: simulation.overallMark,
          gradeLabel: simulation.gradeLabel,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
          weakCoCount: coStates.weakCoCount,
          coSummary: coStates.summaries,
          questionEvidenceSummary: questionResults.summary,
          cgpa: currentCgpa,
          backlogCount: activeBacklogCount,
          riskBand: inference.riskBand,
          riskProb: inference.riskProb,
          drivers: inference.observableDrivers,
          interventionResponse: {
            interventionType: recoveryInterventionType,
            accepted: interventionAccepted,
            completed: interventionCompleted,
            recoveryConfirmed: responseResidual >= 0 && interventionCompleted,
            residual: responseResidual,
          },
        }),
        createdAt: input.now,
        updatedAt: input.now,
      })
      const alertDecisionId = createId('alert_decision')
      alertRows.push({
        alertDecisionId,
        riskAssessmentId,
        studentId: trajectory.studentId,
        offeringId: offering.offeringId,
        decisionType: monitoring.decisionType,
        queueOwnerRole: monitoring.queueOwnerRole,
        note: monitoring.note,
        reassessmentDueAt: monitoring.reassessmentDueAt,
        cooldownUntil: monitoring.cooldownUntil,
        monitoringPolicyVersion: MONITORING_POLICY_VERSION,
        createdAt: input.now,
        updatedAt: input.now,
      })
      alertOutcomeRows.push({
        alertOutcomeId: createId('alert_outcome'),
        alertDecisionId,
        outcomeStatus: monitoring.decisionType === 'suppress' ? 'Suppressed' : 'Pending',
        acknowledgedByFacultyId: null,
        acknowledgedAt: null,
        outcomeNote: monitoring.note,
        createdAt: input.now,
        updatedAt: input.now,
      })
      if (monitoring.decisionType !== 'suppress') {
        reassessmentRows.push({
          reassessmentEventId: createId('reassessment'),
          riskAssessmentId,
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          assignedToRole: monitoring.queueOwnerRole,
          dueAt: monitoring.reassessmentDueAt ?? input.now,
          status: 'Open',
          payloadJson: JSON.stringify({
            riskBand: inference.riskBand,
            riskProb: inference.riskProb,
            recommendedAction: inference.recommendedAction,
            evidence: {
              attendancePct: simulation.attendancePct,
              tt1Pct: simulation.tt1Pct,
              tt2Pct: simulation.tt2Pct,
              quizPct: simulation.quizPct,
              assignmentPct: simulation.assignmentPct,
              seePct: simulation.seePct,
            },
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
      }
    })
  })

  const perFacultySemester = new Map<string, Array<typeof teacherAllocations.$inferInsert>>()
  teacherAllocationRows.forEach(row => {
    const key = `${row.facultyId}::${row.semesterNumber}`
    perFacultySemester.set(key, [...(perFacultySemester.get(key) ?? []), row])
  })
  for (const faculty of PROOF_FACULTY) {
    for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
      const allocations = perFacultySemester.get(`${faculty.facultyId}::${semesterNumber}`) ?? []
      teacherLoadRows.push({
        teacherLoadProfileId: createId('teacher_load'),
        simulationRunId,
        facultyId: faculty.facultyId,
        semesterNumber,
        sectionLoadCount: allocations.length,
        weeklyContactHours: allocations.reduce((sum, row) => sum + row.plannedContactHours, 0),
        assignedCredits: allocations.reduce((sum, row) => sum + (row.plannedContactHours > 0 ? 1 : 0), 0),
        permissionsJson: JSON.stringify(faculty.permissions),
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  }

  if (teacherAllocationRows.length > 0) await insertRowsInChunks(db, teacherAllocations, teacherAllocationRows)
  if (teacherLoadRows.length > 0) await insertRowsInChunks(db, teacherLoadProfiles, teacherLoadRows)
  if (latentRows.length > 0) await insertRowsInChunks(db, studentLatentStates, latentRows)
  if (behaviorRows.length > 0) await insertRowsInChunks(db, studentBehaviorProfiles, behaviorRows)
  if (topicStateRows.length > 0) await insertRowsInChunks(db, studentTopicStates, topicStateRows)
  if (coStateRows.length > 0) await insertRowsInChunks(db, studentCoStates, coStateRows)
  if (worldContextRows.length > 0) await insertRowsInChunks(db, worldContextSnapshots, worldContextRows)
  if (questionTemplateRows.length > 0) await insertRowsInChunks(db, simulationQuestionTemplates, questionTemplateRows)
  if (questionResultRows.length > 0) await insertRowsInChunks(db, studentQuestionResults, questionResultRows)
  if (observedRows.length > 0) await insertRowsInChunks(db, studentObservedSemesterStates, observedRows)
  if (transitionRows.length > 0) await insertRowsInChunks(db, semesterTransitionLogs, transitionRows)
  if (attendanceRows.length > 0) await insertRowsInChunks(db, studentAttendanceSnapshots, attendanceRows)
  if (assessmentRows.length > 0) await insertRowsInChunks(db, studentAssessmentScores, assessmentRows)
  if (transcriptTermRowsInsert.length > 0) await insertRowsInChunks(db, transcriptTermResults, transcriptTermRowsInsert)
  if (transcriptSubjectRowsInsert.length > 0) await insertRowsInChunks(db, transcriptSubjectResults, transcriptSubjectRowsInsert)
  if (riskRows.length > 0) await insertRowsInChunks(db, riskAssessments, riskRows)
  if (reassessmentRows.length > 0) await insertRowsInChunks(db, reassessmentEvents, reassessmentRows)
  if (alertRows.length > 0) await insertRowsInChunks(db, alertDecisions, alertRows)
  if (alertOutcomeRows.length > 0) await insertRowsInChunks(db, alertOutcomes, alertOutcomeRows)
  if (electiveRows.length > 0) await insertRowsInChunks(db, electiveRecommendations, electiveRows)
  if (interventionRows.length > 0) await insertRowsInChunks(db, studentInterventions, interventionRows)
  if (interventionResponseRows.length > 0) await insertRowsInChunks(db, studentInterventionResponseStates, interventionResponseRows)

  const currentProfiles = await db.select().from(studentAcademicProfiles)
  const currentProfileSet = new Set(currentProfiles.map(row => row.studentId))
  for (const trajectory of trajectories) {
    const latestObserved = observedRows
      .filter(row => row.studentId === trajectory.studentId && row.semesterNumber <= 5)
      .sort((left, right) => right.semesterNumber - left.semesterNumber)[0]
    if (!latestObserved) continue
    const payload = parseJson(latestObserved.observedStateJson, {} as Record<string, unknown>)
    const prevCgpaScaled = Math.round(Number(payload.cgpaAfterSemester ?? 0) * 100)
    if (currentProfileSet.has(trajectory.studentId)) {
      await db.update(studentAcademicProfiles).set({
        prevCgpaScaled,
        updatedAt: input.now,
      }).where(eq(studentAcademicProfiles.studentId, trajectory.studentId))
    }
  }

  await rebuildSimulationStagePlayback(db, {
    simulationRunId,
    policy: input.policy,
    now: input.now,
  })
  if (!input.skipArtifactRebuild) {
    await rebuildProofRiskArtifacts(db, {
      batchId: input.batchId,
      simulationRunId,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
    })
  }
  if (!input.skipActiveRiskRecompute) {
    await recomputeObservedOnlyRisk(db, {
      simulationRunId,
      policy: input.policy,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
      rebuildModelArtifacts: false,
    })
  }

  const snapshot = {
    curriculumImportVersionId: input.curriculumImportVersionId,
    seed: runSeed,
    policySnapshot: input.policy,
    sectionCount: 2,
    studentCount: 120,
    facultyCount: PROOF_FACULTY.length,
  }
  await db.insert(simulationResetSnapshots).values({
    simulationResetSnapshotId: createId('simulation_reset'),
    simulationRunId,
    batchId: input.batchId,
    snapshotLabel: 'Baseline snapshot',
    snapshotJson: JSON.stringify(snapshot),
    createdAt: input.now,
  })

  const timetablePayload = buildTimetablePayload(loadsByFacultyId)
  await upsertRuntimeSlice(db, 'timetableByFacultyId', timetablePayload, input.now)

  await emitSimulationAudit(db, {
    simulationRunId,
    batchId: input.batchId,
    actionType: input.parentSimulationRunId ? 'restored-run-created' : 'run-created',
    payload: {
      seed: runSeed,
      curriculumImportVersionId: input.curriculumImportVersionId,
      activate,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })

  await db.update(simulationRuns).set({
    metricsJson: JSON.stringify({
      proofGoal: 'adaptation-readiness',
      sectionDistribution: { A: 60, B: 60 },
      coverage: {
        behaviorProfileCount: behaviorRows.length,
        topicStateCount: topicStateRows.length,
        coStateCount: coStateRows.length,
        worldContextCount: worldContextRows.length,
        questionTemplateCount: questionTemplateRows.length,
        questionResultCount: questionResultRows.length,
        attendanceHistoryCoverageCount: observedRows.filter(row => {
          const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
          return Array.isArray(payload.attendanceHistory) || (Array.isArray(payload.subjectScores) && payload.subjectScores.some(item => Array.isArray((item as Record<string, unknown>).attendanceHistory)))
        }).length,
        interventionResponseCount: interventionResponseRows.length,
      },
    }),
    updatedAt: input.now,
  }).where(eq(simulationRuns.simulationRunId, simulationRunId))

  return {
    simulationRunId,
    activeFlag: activate,
  }
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
  await db.update(simulationRuns).set({
    activeFlag: 0,
    status: 'completed',
    updatedAt: input.now,
  }).where(eq(simulationRuns.batchId, run.batchId))
  await db.update(simulationRuns).set({
    activeFlag: 1,
    status: 'active',
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
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const snapshotRows = await db.select().from(simulationResetSnapshots).where(eq(simulationResetSnapshots.simulationRunId, run.simulationRunId)).orderBy(desc(simulationResetSnapshots.createdAt))
  const snapshot = input.simulationResetSnapshotId
    ? snapshotRows.find(row => row.simulationResetSnapshotId === input.simulationResetSnapshotId)
    : snapshotRows[0]
  if (!snapshot) throw new Error('Simulation snapshot not found')
  const payload = parseJson(snapshot.snapshotJson, {} as Record<string, unknown>)
  return startProofSimulationRun(db, {
    batchId: run.batchId,
    curriculumImportVersionId: String(payload.curriculumImportVersionId ?? run.curriculumImportVersionId ?? ''),
    policy: input.policy,
    curriculumFeatureProfileId: run.curriculumFeatureProfileId ?? null,
    curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
    seed: Number(payload.seed ?? run.seed),
    runLabel: `${run.runLabel} restored`,
    parentSimulationRunId: run.simulationRunId,
    activate: true,
  })
}

export async function recomputeObservedOnlyRisk(db: AppDb, input: {
  simulationRunId: string
  policy: ResolvedPolicy
  actorFacultyId?: string | null
  now: string
  rebuildModelArtifacts?: boolean
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const [observedRows, existingRiskRows, existingReassessments, existingResolutions, existingAlerts, existingOutcomes, existingEvidenceRows, teacherAllocationRows, teacherLoadRows, ownershipRows, mentorRows, grantRows] = await Promise.all([
    db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId)),
    db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, input.simulationRunId)),
    db.select().from(reassessmentEvents),
    db.select().from(reassessmentResolutions),
    db.select().from(alertDecisions),
    db.select().from(alertOutcomes),
    db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, input.simulationRunId)),
    db.select().from(teacherAllocations).where(eq(teacherAllocations.simulationRunId, input.simulationRunId)),
    db.select().from(teacherLoadProfiles).where(eq(teacherLoadProfiles.simulationRunId, input.simulationRunId)),
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    db.select().from(mentorAssignments),
    db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
  ])

  const riskIds = existingRiskRows.map(row => row.riskAssessmentId)
  const alertIds = existingAlerts.filter(row => riskIds.includes(row.riskAssessmentId)).map(row => row.alertDecisionId)
  if (alertIds.length > 0) {
    await db.delete(alertAcknowledgements).where(inArray(alertAcknowledgements.alertDecisionId, alertIds))
    await db.delete(alertOutcomes).where(inArray(alertOutcomes.alertDecisionId, alertIds))
    await db.delete(alertDecisions).where(inArray(alertDecisions.alertDecisionId, alertIds))
  }
  const reassessmentIds = existingReassessments.filter(row => riskIds.includes(row.riskAssessmentId)).map(row => row.reassessmentEventId)
  if (reassessmentIds.length > 0) {
    await db.delete(reassessmentResolutions).where(inArray(reassessmentResolutions.reassessmentEventId, reassessmentIds))
    await db.delete(reassessmentEvents).where(inArray(reassessmentEvents.reassessmentEventId, reassessmentIds))
  }
  if (riskIds.length > 0) {
    await db.delete(riskOverrides).where(inArray(riskOverrides.riskAssessmentId, riskIds))
    await db.delete(riskAssessments).where(inArray(riskAssessments.riskAssessmentId, riskIds))
  }
  const activeEvidenceIds = existingEvidenceRows
    .filter(row => !row.simulationStageCheckpointId)
    .map(row => row.riskEvidenceSnapshotId)
  if (activeEvidenceIds.length > 0) {
    await db.delete(riskEvidenceSnapshots).where(inArray(riskEvidenceSnapshots.riskEvidenceSnapshotId, activeEvidenceIds))
  }

  if (input.rebuildModelArtifacts !== false) {
    await rebuildSimulationStagePlayback(db, {
      simulationRunId: input.simulationRunId,
      policy: input.policy,
      now: input.now,
    })
    await rebuildProofRiskArtifacts(db, {
      batchId: run.batchId,
      simulationRunId: input.simulationRunId,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
    })
  }
  const activeRiskArtifacts = await loadActiveProofRiskArtifacts(db, run.batchId)
  const runEvidenceRows = await db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, input.simulationRunId))
  const existingRiskById = new Map(existingRiskRows.map(row => [row.riskAssessmentId, row]))
  const existingReassessmentById = new Map(existingReassessments.map(row => [row.reassessmentEventId, row]))
  const latestResolutionByStudentOffering = new Map<string, typeof reassessmentResolutions.$inferSelect>()
  existingResolutions.forEach(row => {
    const reassessment = existingReassessmentById.get(row.reassessmentEventId)
    if (!reassessment) return
    const risk = existingRiskById.get(reassessment.riskAssessmentId)
    const offeringId = risk?.offeringId ?? reassessment.offeringId ?? null
    if (!offeringId) return
    const key = `${reassessment.studentId}::${offeringId}`
    const current = latestResolutionByStudentOffering.get(key) ?? null
    if (!current || row.createdAt > current.createdAt) {
      latestResolutionByStudentOffering.set(key, row)
    }
  })

  const latestHistoricalByStudent = new Map<string, Record<string, unknown>>()
  observedRows
    .filter(row => row.semesterNumber <= 5)
    .sort((left, right) => right.semesterNumber - left.semesterNumber)
    .forEach(row => {
      if (!latestHistoricalByStudent.has(row.studentId)) {
        latestHistoricalByStudent.set(row.studentId, parseJson(row.observedStateJson, {} as Record<string, unknown>))
      }
    })

  const stageCloseEvidenceByStudentOffering = new Map<string, {
    featurePayload: ReturnType<typeof buildObservableFeaturePayload>
    labelPayload: ObservableLabelPayload
    sourceRefs: ObservableSourceRefs
  }>()
  runEvidenceRows
    .filter(row => row.stageKey === 'semester-close')
    .forEach(row => {
      const featurePayload = parseJson(row.featureJson, null as ReturnType<typeof buildObservableFeaturePayload> | null)
      const labelPayload = parseJson(row.labelJson, null as ObservableLabelPayload | null)
      const sourceRefs = parseJson(row.sourceRefsJson, null as ObservableSourceRefs | null)
      if (!featurePayload || !labelPayload || !sourceRefs) return
      stageCloseEvidenceByStudentOffering.set(`${row.studentId}::${row.offeringId ?? row.courseCode}`, {
        featurePayload,
        labelPayload,
        sourceRefs,
      })
    })

  const liveStageSourceKey = (studentId: string, offeringId: string, courseCode: string) => `${studentId}::6::${offeringId}::${courseCode}`
  const liveCaseKey = (studentId: string) => `${studentId}::6`
  const liveQueueCaseId = (studentId: string, stageKey: PlaybackStageKey) => buildDeterministicId('runtime_queue_case', [input.simulationRunId, studentId, 6, stageKey])
  const courseLeaderFacultyIdByOfferingId = new Map<string, string>()
  ownershipRows
    .filter(row => row.offeringId != null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (!row.offeringId || courseLeaderFacultyIdByOfferingId.has(row.offeringId)) return
      courseLeaderFacultyIdByOfferingId.set(row.offeringId, row.facultyId)
    })
  const mentorFacultyIdByStudentId = new Map<string, string>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))
    .forEach(row => {
      if (mentorFacultyIdByStudentId.has(row.studentId)) return
      mentorFacultyIdByStudentId.set(row.studentId, row.facultyId)
    })
  const hodFacultyId = grantRows
    .filter(row => row.roleCode === 'HOD' && [run.batchId, MSRUAS_PROOF_BRANCH_ID, MSRUAS_PROOF_DEPARTMENT_ID].includes(row.scopeId))
    .slice()
    .sort((left, right) => left.facultyId.localeCompare(right.facultyId))[0]?.facultyId ?? null
  const overloadPenaltyBySemesterFaculty = new Map<string, number>()
  const semesterSixLoads = teacherLoadRows.filter(row => row.semesterNumber === 6)
  const semesterSixLoadAverage = average(semesterSixLoads.map(row => row.weeklyContactHours))
  const semesterSixOverloadThreshold = Math.max(8, Math.ceil(semesterSixLoadAverage * 1.25))
  semesterSixLoads.forEach(row => {
    overloadPenaltyBySemesterFaculty.set(row.facultyId, row.weeklyContactHours > semesterSixOverloadThreshold ? 2 : 0)
  })
  const mentorAssignmentCountByFacultyId = new Map<string, number>()
  mentorRows
    .filter(row => row.effectiveTo === null)
    .forEach(row => {
      mentorAssignmentCountByFacultyId.set(row.facultyId, (mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) + 1)
    })
  const supervisedSectionCount = new Set(
    teacherAllocationRows
      .filter(row => row.sectionCode != null)
      .map(row => row.sectionCode!),
  ).size
  const facultyBudgetByKey = new Map<string, number>()
  semesterSixLoads.forEach(row => {
    const overloadPenalty = overloadPenaltyBySemesterFaculty.get(row.facultyId) ?? 0
    const ownedOfferingCount = teacherAllocationRows.filter(allocation =>
      allocation.semesterNumber === 6
      && allocation.facultyId === row.facultyId
      && allocation.allocationRole === 'course-leader').length
    facultyBudgetByKey.set(`Course Leader::${row.facultyId}::6`, clamp(4 + ownedOfferingCount - overloadPenalty, 2, 12))
    facultyBudgetByKey.set(`Mentor::${row.facultyId}::6`, clamp(6 + Math.ceil((mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) / 15) - overloadPenalty, 4, 18))
    facultyBudgetByKey.set(`HoD::${row.facultyId}::6`, clamp(8 + supervisedSectionCount - overloadPenalty, 6, 24))
  })
  const runtimeFacultyAssignment = (studentId: string, offeringId: string, assignedRole: ProofQueueRole) => {
    const assignedFacultyId = assignedRole === 'Course Leader'
      ? (courseLeaderFacultyIdByOfferingId.get(offeringId) ?? null)
      : assignedRole === 'Mentor'
        ? (mentorFacultyIdByStudentId.get(studentId) ?? null)
        : hodFacultyId
    return {
      assignedFacultyId,
      facultyBudgetKey: assignedFacultyId ? `${assignedRole}::${assignedFacultyId}::6` : null,
    }
  }
  const questionPatternBaseline = summarizeQuestionPatterns({
    rows: [],
    templatesById: new Map<string, typeof simulationQuestionTemplates.$inferSelect>(),
  })
  const liveStageKeyForPayload = (payload: Record<string, unknown>) => {
    if (payload.seePct != null) return 'post-see' as const
    if (payload.tt2Pct != null) return 'post-tt2' as const
    if (payload.tt1Pct != null) return 'post-tt1' as const
    return 'semester-start' as const
  }

  const sem6Rows = observedRows.filter(row => row.semesterNumber === 6)
  const sem6SectionStudentCountByKey = new Map<string, number>()
  Array.from(new Set(sem6Rows.map(row => `${row.semesterNumber}::${row.sectionCode}::${row.studentId}`)))
    .forEach(key => {
      const [semesterNumber, sectionCode] = key.split('::')
      const sectionKey = `${semesterNumber}::${sectionCode}`
      sem6SectionStudentCountByKey.set(sectionKey, (sem6SectionStudentCountByKey.get(sectionKey) ?? 0) + 1)
    })
  const sectionRiskRateBySemesterSection = new Map<string, number>()
  const sectionRiskRateSeed = new Map<string, number[]>()
  for (const row of sem6Rows) {
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
    const sectionKey = `${row.semesterNumber}::${row.sectionCode}`
    const observablePressure = observableSectionPressureFromEvidence({
      attendancePct: Number(payload.attendancePct ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: payload.tt2Pct == null ? Number(payload.tt1Pct ?? 0) : Number(payload.tt2Pct),
      seePct: payload.seePct == null ? Number(payload.tt2Pct ?? payload.tt1Pct ?? 0) : Number(payload.seePct),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
    })
    sectionRiskRateSeed.set(sectionKey, [...(sectionRiskRateSeed.get(sectionKey) ?? []), observablePressure])
  }
  sectionRiskRateSeed.forEach((values, key) => {
    sectionRiskRateBySemesterSection.set(key, roundToTwo(average(values)))
  })
  const riskRows: Array<typeof riskAssessments.$inferInsert> = []
  const activeEvidenceRows: Array<typeof riskEvidenceSnapshots.$inferInsert> = []
  const reassessmentRows: Array<typeof reassessmentEvents.$inferInsert> = []
  const alertRows: Array<typeof alertDecisions.$inferInsert> = []
  const alertOutcomeRows: Array<typeof alertOutcomes.$inferInsert> = []
  const runtimeQueueCandidates: Array<{
    caseKey: string
    sourceKey: string
    stageKey: PlaybackStageKey
    studentId: string
    sectionCode: string
    offeringId: string
    courseCode: string
    courseTitle: string
    riskAssessmentId: string
    riskBand: 'High' | 'Medium' | 'Low'
    riskProbScaled: number
    noActionRiskProbScaled: number
    counterfactualLiftScaled: number
    policyPhenotype: PolicyPhenotype
    recommendedAction: string | null
    utilityDelta: number
    nextCheckpointBenefitScaled: number
    capacityCost: number
    assignedRole: ProofQueueRole
    assignedFacultyId: string | null
    facultyBudgetKey: string | null
    dueAt: string
    monitoringNote: string
    evidenceSummary: {
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
    }
  }> = []
  for (const row of sem6Rows) {
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
    const historical = latestHistoricalByStudent.get(row.studentId) ?? {}
    const offeringId = String(payload.offeringId ?? '')
    if (!offeringId) continue
    const stageEvidence = stageCloseEvidenceByStudentOffering.get(`${row.studentId}::${offeringId}`) ?? null
    const latestResolutionRow = latestResolutionByStudentOffering.get(`${row.studentId}::${offeringId}`) ?? null
    const interventionResponseScore = liveInterventionResponseScoreFromPayload({
      payload,
      observedUpdatedAt: row.updatedAt,
      resolutionRow: latestResolutionRow,
    })
    const fallbackSourceRefs: ObservableSourceRefs = stageEvidence?.sourceRefs ?? {
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: null,
      studentId: row.studentId,
      offeringId,
      semesterNumber: 6,
      sectionCode: row.sectionCode,
      courseCode: String(payload.courseCode ?? 'NA'),
      courseTitle: String(payload.courseTitle ?? payload.courseCode ?? 'Unknown'),
      courseFamily: String(payload.assessmentProfile ?? 'general'),
      coEvidenceMode: 'fallback-simulated',
      stageKey: null,
      prerequisiteCourseCodes: [],
      prerequisiteWeakCourseCodes: [],
      weakCourseOutcomeCodes: [],
      dominantQuestionTopics: [],
    }
    const featurePayload = stageEvidence?.featurePayload ?? buildObservableFeaturePayload({
      attendancePct: Number(payload.attendancePct ?? 0),
      attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as Array<{ attendancePct: number }>),
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: payload.tt2Pct == null ? null : Number(payload.tt2Pct),
      quizPct: payload.quizPct == null ? null : Number(payload.quizPct),
      assignmentPct: payload.assignmentPct == null ? null : Number(payload.assignmentPct),
      seePct: payload.seePct == null ? null : Number(payload.seePct),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      interventionResponseScore,
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      sectionRiskRate: sectionRiskRateBySemesterSection.get(`${row.semesterNumber}::${row.sectionCode}`) ?? 0,
      semesterProgress: 1,
    })
    const labelPayload = stageEvidence?.labelPayload ?? {
      attendanceRiskLabel: Number(payload.attendancePct ?? 0) < input.policy.attendanceRules.minimumRequiredPercent ? 1 : 0,
      ceShortfallLabel: ceShortfallLabelFromPct(Number(payload.cePct ?? 0), input.policy),
      seeShortfallLabel: Number(payload.seePct ?? 0) < ((input.policy.passRules.minimumSeeMark / input.policy.passRules.seeMaximum) * 100) ? 1 : 0,
      overallCourseFailLabel: String(payload.result ?? 'Unknown') === 'Passed' ? 0 : 1,
      downstreamCarryoverLabel: 0,
    } satisfies ObservableLabelPayload
    const liveStageKey = liveStageKeyForPayload(payload)
    const liveStage = PLAYBACK_STAGE_DEFS.find(item => item.key === liveStageKey) ?? PLAYBACK_STAGE_DEFS[0]
    const inference = scoreObservableRiskWithModel({
      attendancePct: Number(payload.attendancePct ?? 0),
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: payload.tt2Pct == null ? null : Number(payload.tt2Pct),
      quizPct: payload.quizPct == null ? null : Number(payload.quizPct),
      assignmentPct: payload.assignmentPct == null ? null : Number(payload.assignmentPct),
      seePct: payload.seePct == null ? null : Number(payload.seePct),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      attendanceHistoryRiskCount: Array.isArray(payload.attendanceHistory)
        ? payload.attendanceHistory.filter(entry => Number((entry as Record<string, unknown>).attendancePct ?? 0) < input.policy.attendanceRules.minimumRequiredPercent).length
        : 0,
      questionWeaknessCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      interventionResponseScore,
      policy: input.policy,
      featurePayload,
      sourceRefs: fallbackSourceRefs,
      productionModel: activeRiskArtifacts.production,
      correlations: activeRiskArtifacts.correlations,
    })
    const liveEvidence: StageEvidenceSnapshot = {
      attendancePct: Number(payload.attendancePct ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: payload.tt2Pct == null ? null : Number(payload.tt2Pct),
      quizPct: payload.quizPct == null ? null : Number(payload.quizPct),
      assignmentPct: payload.assignmentPct == null ? null : Number(payload.assignmentPct),
      seePct: payload.seePct == null ? null : Number(payload.seePct),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      attentionAreas: [],
      attendanceHistoryRiskCount: Array.isArray(payload.attendanceHistory)
        ? payload.attendanceHistory.filter(entry => Number((entry as Record<string, unknown>).attendancePct ?? 0) < input.policy.attendanceRules.minimumRequiredPercent).length
        : 0,
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
      interventionResponseScore,
      evidenceWindow: payload.seePct != null ? 'semester-6-see' : payload.tt2Pct != null ? 'semester-6-tt2' : payload.tt1Pct != null ? 'semester-6-tt1' : 'semester-6-start',
      weakCourseOutcomes: [],
      questionPatterns: questionPatternBaseline,
    }
    const policyComparison = buildActionPolicyComparison({
      stageKey: liveStageKey,
      evidence: liveEvidence,
      riskBand: inference.riskBand,
      recommendedAction: inference.recommendedAction,
      prerequisiteSummary: {
        prerequisiteAveragePct: 0,
        prerequisiteFailureCount: 0,
        prerequisiteWeakCourseCodes: [],
        downstreamDependencyLoad: 0,
        weakPrerequisiteChainCount: 0,
        repeatedWeakPrerequisiteFamilyCount: 0,
      },
    })
    const noActionSnapshot = buildNoActionSnapshot({
      evidence: liveEvidence,
      actionTaken: policyComparison.recommendedAction,
      stageKey: liveStageKey,
    })
    const noActionFeaturePayload = buildObservableFeaturePayload({
      attendancePct: noActionSnapshot.attendancePct,
      attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as Array<{ attendancePct: number }>),
      currentCgpa: noActionSnapshot.currentCgpa,
      backlogCount: noActionSnapshot.backlogCount,
      tt1Pct: noActionSnapshot.tt1Pct,
      tt2Pct: noActionSnapshot.tt2Pct,
      quizPct: noActionSnapshot.quizPct,
      assignmentPct: noActionSnapshot.assignmentPct,
      seePct: noActionSnapshot.seePct,
      weakCoCount: noActionSnapshot.weakCoCount,
      weakQuestionCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: noActionSnapshot.interventionResponseScore,
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      sectionRiskRate: sectionRiskRateBySemesterSection.get(`${row.semesterNumber}::${row.sectionCode}`) ?? 0,
      semesterProgress: liveStage?.order ?? 1,
    })
    const noActionInference = scoreObservableRiskWithModel({
      attendancePct: noActionSnapshot.attendancePct,
      currentCgpa: noActionSnapshot.currentCgpa,
      backlogCount: noActionSnapshot.backlogCount,
      tt1Pct: noActionSnapshot.tt1Pct,
      tt2Pct: noActionSnapshot.tt2Pct,
      quizPct: noActionSnapshot.quizPct,
      assignmentPct: noActionSnapshot.assignmentPct,
      seePct: noActionSnapshot.seePct,
      weakCoCount: noActionSnapshot.weakCoCount,
      attendanceHistoryRiskCount: noActionSnapshot.attendanceHistoryRiskCount,
      questionWeaknessCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: noActionSnapshot.interventionResponseScore,
      policy: input.policy,
      featurePayload: noActionFeaturePayload,
      sourceRefs: fallbackSourceRefs,
      productionModel: activeRiskArtifacts.production,
      correlations: activeRiskArtifacts.correlations,
    })
    const monitoring = buildMonitoringDecision({
      riskProb: inference.riskProb,
      riskBand: inference.riskBand,
      previousRiskBand: null,
      cooldownUntil: null,
      evidenceWindowCount: liveStage?.order ?? 1,
      interventionResidual: interventionResponseScore,
      nowIso: input.now,
    })
    const riskAssessmentId = createId('risk_assessment')
    const evidenceSnapshotId = buildDeterministicId('risk_evidence_active', [input.simulationRunId, row.studentId, offeringId])
    activeEvidenceRows.push({
      riskEvidenceSnapshotId: evidenceSnapshotId,
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: null,
      batchId: run.batchId,
      studentId: row.studentId,
      offeringId,
      semesterNumber: 6,
      sectionCode: row.sectionCode,
      courseCode: String(payload.courseCode ?? 'NA'),
      courseTitle: String(payload.courseTitle ?? payload.courseCode ?? 'Unknown'),
      stageKey: null,
      evidenceWindow: payload.seePct != null ? 'semester-6-see' : payload.tt2Pct != null ? 'semester-6-tt2' : 'semester-6-tt1',
      featureSchemaVersion: RISK_FEATURE_SCHEMA_VERSION,
      featureJson: JSON.stringify(featurePayload),
      labelJson: JSON.stringify(labelPayload),
      sourceRefsJson: JSON.stringify({
        ...fallbackSourceRefs,
        sourceSnapshotHash: featureHash(featurePayload, labelPayload, fallbackSourceRefs),
      }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    riskRows.push({
      riskAssessmentId,
      simulationRunId: input.simulationRunId,
      studentId: row.studentId,
      offeringId,
      termId: row.termId,
      assessmentScope: 'observable-only',
      riskProbScaled: Math.round(inference.riskProb * 100),
      riskBand: inference.riskBand,
      recommendedAction: inference.recommendedAction,
      driversJson: JSON.stringify(inference.observableDrivers),
      evidenceWindow: payload.seePct != null ? 'semester-6-see' : payload.tt2Pct != null ? 'semester-6-tt2' : 'semester-6-tt1',
      evidenceSnapshotId,
      modelVersion: inference.modelVersion,
      policyVersion: 'resolved-batch-policy',
      sourceType: 'simulation',
      assessedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const alertDecisionId = createId('alert_decision')
    alertRows.push({
      alertDecisionId,
      riskAssessmentId,
      studentId: row.studentId,
      offeringId,
      decisionType: monitoring.decisionType,
      queueOwnerRole: monitoring.queueOwnerRole,
      note: monitoring.note,
      reassessmentDueAt: monitoring.reassessmentDueAt,
      cooldownUntil: monitoring.cooldownUntil,
      monitoringPolicyVersion: MONITORING_POLICY_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    })
    alertOutcomeRows.push({
      alertOutcomeId: createId('alert_outcome'),
      alertDecisionId,
      outcomeStatus: monitoring.decisionType === 'suppress' ? 'Suppressed' : 'Pending',
      acknowledgedByFacultyId: null,
      acknowledgedAt: null,
      outcomeNote: monitoring.note,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const selectedPolicyCandidate = policyComparison.candidates.find(candidate => candidate.action === policyComparison.recommendedAction) ?? null
    const assignment = runtimeFacultyAssignment(row.studentId, offeringId, monitoring.queueOwnerRole as ProofQueueRole)
    runtimeQueueCandidates.push({
      caseKey: liveCaseKey(row.studentId),
      sourceKey: liveStageSourceKey(row.studentId, offeringId, String(payload.courseCode ?? 'NA')),
      stageKey: liveStageKey,
      studentId: row.studentId,
      sectionCode: row.sectionCode,
      offeringId,
      courseCode: String(payload.courseCode ?? 'NA'),
      courseTitle: String(payload.courseTitle ?? payload.courseCode ?? 'Unknown'),
      riskAssessmentId,
      riskBand: inference.riskBand,
      riskProbScaled: Math.round(inference.riskProb * 100),
      noActionRiskProbScaled: Math.round(noActionInference.riskProb * 100),
      counterfactualLiftScaled: Math.round(noActionInference.riskProb * 100) - Math.round(inference.riskProb * 100),
      policyPhenotype: policyComparison.policyPhenotype,
      recommendedAction: policyComparison.recommendedAction ?? inference.recommendedAction,
      utilityDelta: selectedPolicyCandidate?.utility ?? 0,
      nextCheckpointBenefitScaled: selectedPolicyCandidate?.nextCheckpointBenefitScaled ?? 0,
      capacityCost: selectedPolicyCandidate?.capacityCost ?? 0,
      assignedRole: monitoring.queueOwnerRole as ProofQueueRole,
      assignedFacultyId: assignment.assignedFacultyId,
      facultyBudgetKey: assignment.facultyBudgetKey,
      dueAt: monitoring.reassessmentDueAt ?? input.now,
      monitoringNote: monitoring.note,
      evidenceSummary: {
        attendancePct: Number(payload.attendancePct ?? 0),
        tt1Pct: Number(payload.tt1Pct ?? 0),
        tt2Pct: Number(payload.tt2Pct ?? 0),
        quizPct: Number(payload.quizPct ?? 0),
        assignmentPct: Number(payload.assignmentPct ?? 0),
        seePct: Number(payload.seePct ?? 0),
      },
    })
  }
  const liveCaseStateByKey = new Map<string, ProofQueuePriorCaseState>()
  PLAYBACK_STAGE_DEFS.forEach(stage => {
    const stageCandidates = runtimeQueueCandidates.filter(candidate => candidate.stageKey === stage.key)
    if (stageCandidates.length === 0) return
    const governance = governProofQueueStage({
      stageKey: stage.key as ProofQueueGovernanceStageKey,
      candidates: stageCandidates.map(candidate => ({
        caseKey: candidate.caseKey,
        sourceKey: candidate.sourceKey,
        studentId: candidate.studentId,
        semesterNumber: 6,
        sectionCode: candidate.sectionCode,
        stageKey: candidate.stageKey,
        offeringId: candidate.offeringId,
        courseCode: candidate.courseCode,
        courseTitle: candidate.courseTitle,
        riskBand: candidate.riskBand,
        riskProbScaled: candidate.riskProbScaled,
        noActionRiskProbScaled: candidate.noActionRiskProbScaled,
        riskChangeFromPreviousCheckpointScaled: 0,
        counterfactualLiftScaled: candidate.counterfactualLiftScaled,
        policyPhenotype: candidate.policyPhenotype,
        recommendedAction: candidate.recommendedAction,
        utilityDelta: candidate.utilityDelta,
        nextCheckpointBenefitScaled: candidate.nextCheckpointBenefitScaled,
        capacityCost: candidate.capacityCost,
        assignedRole: candidate.assignedRole,
        assignedFacultyId: candidate.assignedFacultyId,
        facultyBudgetKey: candidate.facultyBudgetKey,
      }) satisfies ProofQueueCandidate),
      priorCaseStateByKey: liveCaseStateByKey,
      sectionStudentCountByKey: sem6SectionStudentCountByKey,
      facultyBudgetByKey,
    })

    const decisionsByCaseKey = governance.decisions
    const primaryCandidateByCaseKey = new Map<string, typeof runtimeQueueCandidates[number]>()
    stageCandidates.forEach(candidate => {
      const decision = decisionsByCaseKey.get(candidate.caseKey)
      if (!decision || decision.primarySourceKey !== candidate.sourceKey) return
      primaryCandidateByCaseKey.set(candidate.caseKey, candidate)
    })

    stageCandidates.forEach(candidate => {
      const decision = decisionsByCaseKey.get(candidate.caseKey) ?? null
      const alertRow = alertRows.find(row => row.riskAssessmentId === candidate.riskAssessmentId)
      const alertOutcomeRow = alertOutcomeRows.find(row => row.alertDecisionId === alertRow?.alertDecisionId)
      if (!alertRow || !alertOutcomeRow) return
      const isPrimary = decision?.primarySourceKey === candidate.sourceKey
      const isSupporting = !!decision && decision.supportingSourceKeys.includes(candidate.sourceKey)
      if (decision && (decision.status === 'opened' || decision.status === 'open') && isPrimary) {
        alertRow.decisionType = 'alert'
        alertOutcomeRow.outcomeStatus = 'Pending'
      } else if (decision && (decision.status === 'watch' || ((decision.status === 'opened' || decision.status === 'open') && isSupporting))) {
        alertRow.decisionType = 'watch'
        alertOutcomeRow.outcomeStatus = 'Pending'
      } else {
        alertRow.decisionType = 'suppress'
        alertOutcomeRow.outcomeStatus = 'Suppressed'
      }
    })

    decisionsByCaseKey.forEach((decision, caseKey) => {
      const primaryCandidate = primaryCandidateByCaseKey.get(caseKey)
      if (!primaryCandidate) return
      if (decision.status === 'opened' || decision.status === 'open') {
        reassessmentRows.push({
          reassessmentEventId: createId('reassessment'),
          riskAssessmentId: primaryCandidate.riskAssessmentId,
          studentId: primaryCandidate.studentId,
          offeringId: primaryCandidate.offeringId,
          assignedToRole: primaryCandidate.assignedRole,
          assignedFacultyId: primaryCandidate.assignedFacultyId,
          dueAt: primaryCandidate.dueAt,
          status: 'Open',
          payloadJson: JSON.stringify({
            queueCaseId: liveQueueCaseId(primaryCandidate.studentId, primaryCandidate.stageKey),
            stageKey: primaryCandidate.stageKey,
            riskBand: primaryCandidate.riskBand,
            riskProbScaled: primaryCandidate.riskProbScaled,
            recommendedAction: primaryCandidate.recommendedAction,
            assignedFacultyId: primaryCandidate.assignedFacultyId,
            primaryCase: true,
            countsTowardCapacity: true,
            priorityRank: decision.priorityRank,
            governanceReason: decision.governanceReason,
            supportingCourseCount: decision.supportingSourceKeys.length,
            supportingRiskAssessmentIds: stageCandidates
              .filter(candidate => decision.supportingSourceKeys.includes(candidate.sourceKey))
              .map(candidate => candidate.riskAssessmentId),
            evidence: primaryCandidate.evidenceSummary,
          }),
          createdAt: input.now,
          updatedAt: input.now,
        })
      }
      liveCaseStateByKey.set(caseKey, {
        open: decision.status === 'opened' || decision.status === 'open',
        primarySourceKey: decision.primarySourceKey,
      })
    })
  })
  if (activeEvidenceRows.length > 0) await insertRowsInChunks(db, riskEvidenceSnapshots, activeEvidenceRows)
  if (riskRows.length > 0) await db.insert(riskAssessments).values(riskRows)
  if (reassessmentRows.length > 0) await db.insert(reassessmentEvents).values(reassessmentRows)
  if (alertRows.length > 0) await db.insert(alertDecisions).values(alertRows)
  if (alertOutcomeRows.length > 0) await db.insert(alertOutcomes).values(alertOutcomeRows)

  await rebuildSimulationStagePlayback(db, {
    simulationRunId: input.simulationRunId,
    policy: input.policy,
    now: input.now,
  })

  await emitSimulationAudit(db, {
    simulationRunId: input.simulationRunId,
    batchId: run.batchId,
    actionType: 'recomputed-observed-risk',
    payload: {
      riskAssessmentCount: riskRows.length,
    },
    createdByFacultyId: input.actorFacultyId ?? null,
    now: input.now,
  })
}

export async function listProofRunCheckpoints(db: AppDb, input: {
  simulationRunId: string
}) {
  const rows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  return withProofPlaybackGate(rows.map(parseProofCheckpointSummary))
}

export async function getProofRunCheckpointDetail(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
}) {
  const [checkpoint] = await db.select().from(simulationStageCheckpoints).where(and(
    eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId),
    eq(simulationStageCheckpoints.simulationStageCheckpointId, input.simulationStageCheckpointId),
  ))
  if (!checkpoint) throw new Error('Simulation stage checkpoint not found')
  const [queueRows, offeringRows] = await Promise.all([
    db.select().from(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationStageCheckpointId, input.simulationStageCheckpointId)),
    db.select().from(simulationStageOfferingProjections).where(eq(simulationStageOfferingProjections.simulationStageCheckpointId, input.simulationStageCheckpointId)),
  ])
  const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary))
    .find(item => item.simulationStageCheckpointId === input.simulationStageCheckpointId)
    ?? parseProofCheckpointSummary(checkpoint)
  return {
    checkpoint: checkpointSummary,
    queuePreview: queueRows
      .slice()
      .sort((left, right) => queueStatusPriority(right.status) - queueStatusPriority(left.status) || right.riskProbScaled - left.riskProbScaled || left.studentId.localeCompare(right.studentId))
      .slice(0, 24)
      .map(row => {
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        return {
          simulationStageQueueProjectionId: row.simulationStageQueueProjectionId,
          studentId: row.studentId,
          offeringId: row.offeringId,
          semesterNumber: row.semesterNumber,
          sectionCode: row.sectionCode,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          assignedToRole: row.assignedToRole,
          taskType: row.taskType,
          status: row.status,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          noActionRiskProbScaled: row.noActionRiskProbScaled,
          recommendedAction: row.recommendedAction,
          simulatedActionTaken: row.simulatedActionTaken,
          riskChangeFromPreviousCheckpointScaled: Number(detail.riskChangeFromPreviousCheckpointScaled ?? 0),
          counterfactualLiftScaled: Number(detail.counterfactualLiftScaled ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled),
          coEvidenceMode: typeof detail.coEvidenceMode === 'string' ? detail.coEvidenceMode : null,
          detail,
        }
      }),
    offeringRollups: offeringRows
      .slice()
      .sort((left, right) => {
        const leftPayload = parseJson(left.projectionJson, {} as Record<string, unknown>)
        const rightPayload = parseJson(right.projectionJson, {} as Record<string, unknown>)
        return Number(rightPayload.averageRiskProbScaled ?? 0) - Number(leftPayload.averageRiskProbScaled ?? 0)
          || left.courseCode.localeCompare(right.courseCode)
      })
      .map(row => ({
        simulationStageOfferingProjectionId: row.simulationStageOfferingProjectionId,
        offeringId: row.offeringId,
        curriculumNodeId: row.curriculumNodeId,
        semesterNumber: row.semesterNumber,
        sectionCode: row.sectionCode,
        courseCode: row.courseCode,
        courseTitle: row.courseTitle,
        stage: row.stage,
        stageLabel: row.stageLabel,
        stageDescription: row.stageDescription,
        pendingAction: row.pendingAction,
        projection: parseJson(row.projectionJson, {} as Record<string, unknown>),
      })),
  }
}

export async function getProofRunCheckpointStudentDetail(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
  studentId: string
}) {
  const [checkpoint, student, projectionRows] = await Promise.all([
    db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId),
      eq(simulationStageCheckpoints.simulationStageCheckpointId, input.simulationStageCheckpointId),
    )).then(rows => rows[0] ?? null),
    db.select().from(students).where(eq(students.studentId, input.studentId)).then(rows => rows[0] ?? null),
    db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId),
      eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, input.studentId),
    )),
  ])
  if (!checkpoint) throw new Error('Simulation stage checkpoint not found')
  if (!student) throw new Error('Student not found')
  const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary))
    .find(item => item.simulationStageCheckpointId === input.simulationStageCheckpointId)
    ?? parseProofCheckpointSummary(checkpoint)
  return {
    checkpoint: checkpointSummary,
    student: {
      studentId: student.studentId,
      studentName: student.name,
      usn: student.usn,
    },
    projections: projectionRows
      .slice()
      .sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.courseCode.localeCompare(right.courseCode))
      .map(row => ({
        simulationStageStudentProjectionId: row.simulationStageStudentProjectionId,
        offeringId: row.offeringId,
        semesterNumber: row.semesterNumber,
        sectionCode: row.sectionCode,
        courseCode: row.courseCode,
        courseTitle: row.courseTitle,
        riskBand: row.riskBand,
        riskProbScaled: row.riskProbScaled,
        noActionRiskBand: row.noActionRiskBand,
        noActionRiskProbScaled: row.noActionRiskProbScaled,
        recommendedAction: row.recommendedAction,
        simulatedActionTaken: row.simulatedActionTaken,
        queueState: row.queueState,
        reassessmentState: row.reassessmentState,
        evidenceWindow: row.evidenceWindow,
        riskChangeFromPreviousCheckpointScaled: Number((parseJson(row.projectionJson, {} as Record<string, unknown>).riskChangeFromPreviousCheckpointScaled) ?? 0),
        counterfactualLiftScaled: Number((parseJson(row.projectionJson, {} as Record<string, unknown>).counterfactualLiftScaled) ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled),
        projection: parseJson(row.projectionJson, {} as Record<string, unknown>),
      })),
  }
}

export async function buildProofBatchDashboard(db: AppDb, batchId: string) {
  const [
    importRows,
    validationRows,
    crosswalkRows,
    runRows,
    snapshotRows,
    lifecycleRows,
    loadRows,
    behaviorProfileRows,
    topicStateRows,
    coStateRows,
    questionTemplateRows,
    questionResultRows,
    interventionResponseRows,
    worldContextRows,
    stageCheckpointRows,
    stageQueueRows,
    riskRows,
    reassessmentRows,
    alertRows,
    resolutionRows,
    acknowledgementRows,
    facultyRows,
    studentRows,
    userRows,
    offeringRows,
    courseRows,
  ] = await Promise.all([
    db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId)),
    db.select().from(curriculumValidationResults).where(eq(curriculumValidationResults.batchId, batchId)),
    db.select().from(officialCodeCrosswalks).where(eq(officialCodeCrosswalks.batchId, batchId)),
    db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId)),
    db.select().from(simulationResetSnapshots).where(eq(simulationResetSnapshots.batchId, batchId)),
    db.select().from(simulationLifecycleAudits).where(eq(simulationLifecycleAudits.batchId, batchId)),
    db.select().from(teacherLoadProfiles),
    db.select().from(studentBehaviorProfiles),
    db.select().from(studentTopicStates),
    db.select().from(studentCoStates),
    db.select().from(simulationQuestionTemplates),
    db.select().from(studentQuestionResults),
    db.select().from(studentInterventionResponseStates),
    db.select().from(worldContextSnapshots),
    db.select().from(simulationStageCheckpoints),
    db.select().from(simulationStageQueueProjections),
    db.select().from(riskAssessments),
    db.select().from(reassessmentEvents),
    db.select().from(alertDecisions),
    db.select().from(reassessmentResolutions).where(eq(reassessmentResolutions.batchId, batchId)),
    db.select().from(alertAcknowledgements).where(eq(alertAcknowledgements.batchId, batchId)),
    db.select().from(facultyProfiles),
    db.select().from(students),
    db.select().from(userAccounts),
    db.select().from(sectionOfferings).where(eq(sectionOfferings.branchId, MSRUAS_PROOF_BRANCH_ID)),
    db.select().from(courses).where(eq(courses.departmentId, MSRUAS_PROOF_DEPARTMENT_ID)),
  ])

  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const facultyById = new Map(facultyRows.map(row => [row.facultyId, row]))
  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const activeRun = runRows.find(row => row.activeFlag === 1) ?? runRows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const activeRunId = activeRun?.simulationRunId ?? null
  const modelDiagnostics = await getProofRiskModelDiagnostics(db, {
    batchId,
    simulationRunId: activeRunId,
  })
  const activeRiskRows = activeRunId ? riskRows.filter(row => row.simulationRunId === activeRunId) : []
  const riskIds = new Set(activeRiskRows.map(row => row.riskAssessmentId))
  const activeReassessments = reassessmentRows.filter(row => riskIds.has(row.riskAssessmentId))
  const activeAlerts = alertRows.filter(row => riskIds.has(row.riskAssessmentId))
  const activeSnapshots = activeRunId ? snapshotRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeLoads = activeRunId ? loadRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeBehaviorProfiles = activeRunId ? behaviorProfileRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeTopicStates = activeRunId ? topicStateRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeCoStates = activeRunId ? coStateRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeQuestionTemplates = activeRunId ? questionTemplateRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeQuestionResults = activeRunId ? questionResultRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeInterventionResponses = activeRunId ? interventionResponseRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeWorldContexts = activeRunId ? worldContextRows.filter(row => row.simulationRunId === activeRunId) : []
  const activeStageCheckpoints = activeRunId
    ? stageCheckpointRows
      .filter(row => row.simulationRunId === activeRunId)
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
    : []
  const activeCheckpointSummaries = withProofPlaybackGate(activeStageCheckpoints.map(parseProofCheckpointSummary))
  const activeStageQueueRows = activeRunId
    ? stageQueueRows.filter(row => row.simulationRunId === activeRunId)
    : []
  const checkpointMetaById = new Map(activeStageCheckpoints.map(row => {
    const summary = parseJson(row.summaryJson, {
      stageLabel: row.stageLabel,
      stageDescription: row.stageDescription,
      stageOrder: row.stageOrder,
      semesterNumber: row.semesterNumber,
    } as Record<string, unknown>)
    return [row.simulationStageCheckpointId, {
      stageLabel: String(summary.stageLabel ?? row.stageLabel),
      stageDescription: String(summary.stageDescription ?? row.stageDescription),
      stageOrder: Number(summary.stageOrder ?? row.stageOrder),
      semesterNumber: Number(summary.semesterNumber ?? row.semesterNumber),
    }]
  }))
  const activeQueue = activeReassessments
    .slice()
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
    .slice(0, 12)
    .map(event => {
      const risk = activeRiskRows.find(row => row.riskAssessmentId === event.riskAssessmentId)
      const offering = risk?.offeringId ? offeringRows.find(row => row.offeringId === risk.offeringId) : null
      const course = offering ? courseById.get(offering.courseId) : null
      const student = studentById.get(event.studentId)
      return {
        reassessmentEventId: event.reassessmentEventId,
        studentId: event.studentId,
        studentName: student?.name ?? event.studentId,
        usn: student?.usn ?? '',
        courseCode: course?.courseCode ?? 'NA',
        courseTitle: course?.title ?? 'Untitled course',
        sectionCode: offering?.sectionCode ?? null,
        assignedToRole: event.assignedToRole,
        dueAt: event.dueAt,
        status: event.status,
        riskBand: risk?.riskBand ?? 'Low',
        riskProbScaled: risk?.riskProbScaled ?? 0,
        sourceKind: 'runtime-reassessment' as const,
        simulationStageCheckpointId: null,
        stageLabel: null,
      }
    })
  const playbackQueue = (() => {
    if (activeQueue.length > 0) return activeQueue
    if (activeStageQueueRows.length === 0) return activeQueue
    const latestCheckpointId = activeCheckpointSummaries
      .slice()
      .reverse()
      .find(checkpoint => Number(checkpoint.blockingQueueItemCount ?? checkpoint.openQueueCount ?? 0) > 0)?.simulationStageCheckpointId
      ?? activeCheckpointSummaries[activeCheckpointSummaries.length - 1]?.simulationStageCheckpointId
      ?? null
    if (!latestCheckpointId) return activeQueue
    return activeStageQueueRows
      .filter(row => row.simulationStageCheckpointId === latestCheckpointId)
      .slice()
      .sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.studentId.localeCompare(right.studentId))
      .slice(0, 12)
      .map(row => {
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        const student = studentById.get(row.studentId)
        const checkpointMeta = checkpointMetaById.get(row.simulationStageCheckpointId) ?? null
        const dueAt = typeof detail.dueAt === 'string' && detail.dueAt.length > 0
          ? detail.dueAt
          : activeRun?.createdAt ?? new Date(0).toISOString()
        return {
          reassessmentEventId: row.simulationStageQueueProjectionId,
          studentId: row.studentId,
          studentName: student?.name ?? row.studentId,
          usn: student?.usn ?? '',
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          sectionCode: row.sectionCode,
          assignedToRole: row.assignedToRole,
          dueAt,
          status: row.status,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          sourceKind: 'checkpoint-playback' as const,
          simulationStageCheckpointId: row.simulationStageCheckpointId,
          stageLabel: checkpointMeta?.stageLabel ?? null,
          riskChangeFromPreviousCheckpointScaled: Number(detail.riskChangeFromPreviousCheckpointScaled ?? 0),
          counterfactualLiftScaled: Number(detail.counterfactualLiftScaled ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled),
          coEvidenceMode: typeof detail.coEvidenceMode === 'string' ? detail.coEvidenceMode : null,
        }
      })
  })()

  return {
    imports: importRows
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(row => ({
        curriculumImportVersionId: row.curriculumImportVersionId,
        sourceLabel: row.sourceLabel,
        sourceChecksum: row.sourceChecksum,
        outputChecksum: row.outputChecksum,
        compilerVersion: row.compilerVersion,
        validationStatus: row.validationStatus,
        unresolvedMappingCount: row.unresolvedMappingCount,
        status: row.status,
        approvedAt: row.approvedAt,
        createdAt: row.createdAt,
        certificate: parseJson(row.completenessCertificateJson, {} as Record<string, unknown>),
      })),
    latestValidation: validationRows
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      ? {
          validatorVersion: validationRows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0].validatorVersion,
          status: validationRows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0].status,
          summary: parseJson(validationRows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0].summaryJson, {} as Record<string, unknown>),
        }
      : null,
    crosswalkReviewQueue: crosswalkRows
      .filter(row => row.reviewStatus === 'pending-review')
      .map(row => ({
        officialCodeCrosswalkId: row.officialCodeCrosswalkId,
        internalCompilerId: row.internalCompilerId,
        officialWebCode: row.officialWebCode,
        officialWebTitle: row.officialWebTitle,
        confidence: row.confidence,
        reviewStatus: row.reviewStatus,
        evidenceSource: row.evidenceSource,
      })),
    proofRuns: runRows
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(row => ({
        simulationRunId: row.simulationRunId,
        runLabel: row.runLabel,
        status: row.status,
        activeFlag: row.activeFlag === 1,
        seed: row.seed,
        createdAt: row.createdAt,
        metrics: parseJson(row.metricsJson, {} as Record<string, unknown>),
      })),
    activeRunDetail: activeRun ? {
      simulationRunId: activeRun.simulationRunId,
      runLabel: activeRun.runLabel,
      seed: activeRun.seed,
      createdAt: activeRun.createdAt,
      status: activeRun.status,
      monitoringSummary: {
        riskAssessmentCount: activeRiskRows.length,
        activeReassessmentCount: activeReassessments.filter(row => row.status !== 'completed').length,
        alertDecisionCount: activeAlerts.length,
        acknowledgementCount: acknowledgementRows.length,
        resolutionCount: resolutionRows.length,
      },
      coverageDiagnostics: {
        behaviorProfileCoverage: {
          count: activeBehaviorProfiles.length,
          expected: activeRun.studentCount,
        },
        topicStateCoverage: {
          count: activeTopicStates.length,
        },
        coStateCoverage: {
          count: activeCoStates.length,
        },
        questionTemplateCoverage: {
          count: activeQuestionTemplates.length,
        },
        questionResultCoverage: {
          count: activeQuestionResults.length,
        },
        interventionResponseCoverage: {
          count: activeInterventionResponses.length,
        },
        worldContextCoverage: {
          count: activeWorldContexts.length,
        },
      },
      modelDiagnostics,
      teacherAllocationLoad: activeLoads.map(load => ({
        teacherLoadProfileId: load.teacherLoadProfileId,
        facultyId: load.facultyId,
        facultyName: facultyById.get(load.facultyId)?.displayName ?? load.facultyId,
        semesterNumber: load.semesterNumber,
        sectionLoadCount: load.sectionLoadCount,
        weeklyContactHours: load.weeklyContactHours,
        assignedCredits: load.assignedCredits,
        permissions: parseJson(load.permissionsJson, [] as string[]),
      })),
      queuePreview: playbackQueue,
      snapshots: activeSnapshots.map(snapshot => ({
        simulationResetSnapshotId: snapshot.simulationResetSnapshotId,
        snapshotLabel: snapshot.snapshotLabel,
        createdAt: snapshot.createdAt,
        payload: parseJson(snapshot.snapshotJson, {} as Record<string, unknown>),
      })),
      checkpoints: activeCheckpointSummaries,
    } : null,
    lifecycleAudit: lifecycleRows
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 20)
      .map(row => ({
        simulationLifecycleAuditId: row.simulationLifecycleAuditId,
        simulationRunId: row.simulationRunId,
        actionType: row.actionType,
        payload: parseJson(row.payloadJson, {} as Record<string, unknown>),
        createdByFacultyName: row.createdByFacultyId ? (facultyById.get(row.createdByFacultyId)?.displayName ?? row.createdByFacultyId) : null,
        createdAt: row.createdAt,
      })),
  }
}

export async function buildHodProofAnalytics(db: AppDb, input: {
  facultyId: string
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
  const [
    allAppointmentRows,
    runRows,
    batchRows,
    branchRows,
    departmentRows,
    termRows,
    facultyRows,
    grantRows,
    ownershipRows,
    mentorRows,
    studentProfileRows,
    courseRows,
    sectionOfferingRows,
    observedRows,
    riskAssessmentRows,
    reassessmentRows,
    alertRows,
    acknowledgementRows,
    resolutionRows,
    overrideRows,
    loadRows,
    allocationRows,
    interventionRows,
    electiveRows,
    transcriptRows,
    attendanceRows,
    assessmentRows,
    stageCheckpointRows,
    stageStudentRows,
    stageQueueRows,
  ] = await Promise.all([
    db.select().from(facultyAppointments),
    db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1)),
    db.select().from(batches),
    db.select().from(branches),
    db.select().from(departments),
    db.select().from(academicTerms),
    db.select().from(facultyProfiles),
    db.select().from(roleGrants),
    db.select().from(facultyOfferingOwnerships),
    db.select().from(mentorAssignments),
    db.select().from(students),
    db.select().from(courses),
    db.select().from(sectionOfferings),
    db.select().from(studentObservedSemesterStates),
    db.select().from(riskAssessments),
    db.select().from(reassessmentEvents),
    db.select().from(alertDecisions),
    db.select().from(alertAcknowledgements),
    db.select().from(reassessmentResolutions),
    db.select().from(riskOverrides),
    db.select().from(teacherLoadProfiles),
    db.select().from(teacherAllocations),
    db.select().from(studentInterventions),
    db.select().from(electiveRecommendations),
    db.select().from(transcriptTermResults),
    db.select().from(studentAttendanceSnapshots),
    db.select().from(studentAssessmentScores),
    db.select().from(simulationStageCheckpoints),
    db.select().from(simulationStageStudentProjections),
    db.select().from(simulationStageQueueProjections),
  ])

  const activeAppointments = allAppointmentRows.filter(row => row.facultyId === input.facultyId && row.status === 'active')
  const scopeDepartmentIds = new Set(activeAppointments.map(row => row.departmentId))
  const scopeBranchIds = new Set(activeAppointments.map(row => row.branchId).filter((value): value is string => !!value))
  const batchById = new Map(batchRows.map(row => [row.batchId, row]))
  const branchById = new Map(branchRows.map(row => [row.branchId, row]))
  const departmentById = new Map(departmentRows.map(row => [row.departmentId, row]))
  const termById = new Map(termRows.map(row => [row.termId, row]))
  const facultyById = new Map(facultyRows.map(row => [row.facultyId, row]))
  const studentById = new Map(studentProfileRows.map(row => [row.studentId, row]))
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const activeRun = runRows.find(row => row.activeFlag === 1) ?? null
  const activeBatch = activeRun ? (batchById.get(activeRun.batchId) ?? null) : null
  const activeBranch = activeBatch ? (branchById.get(activeBatch.branchId) ?? null) : null
  const scopeMatchesActiveBatch = !!(activeBranch && (scopeBranchIds.has(activeBranch.branchId) || scopeDepartmentIds.has(activeBranch.departmentId)))
  const activeRunId = activeRun?.simulationRunId ?? null
  const currentSemester = input.filters?.semester ?? activeBatch?.currentSemester ?? 6
  const activeTermIds = new Set(
    termRows
      .filter(row => row.batchId === activeBatch?.batchId)
      .filter(row => row.semesterNumber === currentSemester)
      .map(row => row.termId),
  )

  const emptyResponse = {
    summary: {
      activeRunContext: null,
      scope: {
        departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
        branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
      },
      monitoringSummary: {
        riskAssessmentCount: 0,
        activeReassessmentCount: 0,
        alertDecisionCount: 0,
        acknowledgementCount: 0,
        resolutionCount: 0,
      },
      totals: {
        studentsCovered: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        averageQueueAgeHours: 0,
        manualOverrideCount: 0,
        unresolvedAlertCount: 0,
        resolvedAlertCount: 0,
      },
      sectionComparison: [] as Array<{
        sectionCode: string
        studentCount: number
        highRiskCount: number
        mediumRiskCount: number
        averageAttendancePct: number
        openReassessmentCount: number
      }>,
      semesterRiskDistribution: [] as Array<{
        semesterNumber: number
        highPressureCount: number
        reviewCount: number
        stableCount: number
        basis: string
      }>,
      backlogDistribution: [] as Array<{
        bucket: string
        studentCount: number
      }>,
      electiveDistribution: [] as Array<{
        stream: string
        recommendationCount: number
      }>,
      facultyLoadSummary: {
        facultyCount: 0,
        overloadedFacultyCount: 0,
        averageWeeklyContactHours: 0,
      },
    },
    courses: [] as Array<Record<string, unknown>>,
    faculty: [] as Array<Record<string, unknown>>,
    students: [] as Array<Record<string, unknown>>,
    reassessments: [] as Array<Record<string, unknown>>,
  }

  if (input.filters?.simulationStageCheckpointId) {
    if (!activeRun || !activeBatch || !activeBranch || !activeRunId || !scopeMatchesActiveBatch) return emptyResponse
    const checkpoint = stageCheckpointRows.find(row => row.simulationStageCheckpointId === input.filters?.simulationStageCheckpointId) ?? null
    if (!checkpoint || checkpoint.simulationRunId !== activeRunId) return emptyResponse
    const checkpointSummary = withProofPlaybackGate(
      stageCheckpointRows
        .filter(row => row.simulationRunId === activeRunId)
        .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
        .map(parseProofCheckpointSummary),
    ).find(item => item.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      ?? parseProofCheckpointSummary(checkpoint)
    const checkpointStudentRows = stageStudentRows
      .filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
      .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))
      .filter(row => matchesTextFilter(row.courseCode, input.filters?.courseCode))
      .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    const checkpointQueueRows = stageQueueRows
      .filter(row => row.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
      .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))
      .filter(row => matchesTextFilter(row.courseCode, input.filters?.courseCode))
      .filter(row => matchesTextFilter(row.status, input.filters?.status))
      .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    const checkpointQueueGovernance = (row: typeof checkpointQueueRows[number]) => {
      const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
      return {
        detail,
        primaryCase: detail.primaryCase === true,
        countsTowardCapacity: detail.countsTowardCapacity === true,
        priorityRank: Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : Number.MAX_SAFE_INTEGER,
        queueCaseId: typeof detail.queueCaseId === 'string' ? detail.queueCaseId : row.simulationStageQueueCaseId ?? null,
      }
    }
    const checkpointOpenCaseRows = checkpointQueueRows.filter(row => {
      const governance = checkpointQueueGovernance(row)
      return row.status === 'Open' && governance.primaryCase && governance.countsTowardCapacity
    })
    const scopedStudentIds = new Set(checkpointStudentRows.map(row => row.studentId))
    const currentSemesterLoadRows = loadRows
      .filter(row => row.simulationRunId === activeRunId)
      .filter(row => row.semesterNumber === checkpoint.semesterNumber)

    const facultyPermissionMap = new Map<string, string[]>()
    grantRows.filter(row => row.status === 'active').forEach(row => {
      facultyPermissionMap.set(row.facultyId, uniqueSorted([...(facultyPermissionMap.get(row.facultyId) ?? []), row.roleCode]))
    })

    const activeMentorAssignments = mentorRows.filter(row => row.effectiveTo === null)
    const activeOwnershipRows = ownershipRows.filter(row => row.status === 'active')
    const currentLoadAverage = average(currentSemesterLoadRows.map(row => row.weeklyContactHours))
    const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
    const facultyIdsInScope = uniqueSorted([
      ...currentSemesterLoadRows.map(row => row.facultyId),
      ...activeMentorAssignments.map(row => row.facultyId),
      ...activeOwnershipRows.map(row => row.facultyId),
    ]).filter(facultyId => {
      const facultyAppointments = allAppointmentRows.filter(row => row.facultyId === facultyId && row.status === 'active')
      if (facultyAppointments.length === 0) return false
      return facultyAppointments.some(row => scopeDepartmentIds.has(row.departmentId) || (row.branchId ? scopeBranchIds.has(row.branchId) : false))
    })

    const facultyRowsForHod = facultyIdsInScope
      .filter(facultyId => matchesTextFilter(facultyId, input.filters?.facultyId))
      .map(facultyId => {
        const profile = facultyById.get(facultyId)
        const load = currentSemesterLoadRows.find(row => row.facultyId === facultyId) ?? null
        const allocations = allocationRows
          .filter(row => row.simulationRunId === activeRunId && row.semesterNumber === checkpoint.semesterNumber && row.facultyId === facultyId)
          .filter(row => !input.filters?.section || matchesTextFilter(row.sectionCode ?? null, input.filters.section))
        const relevantOfferingIds = new Set(activeOwnershipRows.filter(row => row.facultyId === facultyId).map(row => row.offeringId))
        const relevantStudentIds = new Set(activeMentorAssignments.filter(row => row.facultyId === facultyId).map(row => row.studentId))
        const relevantQueueRows = checkpointQueueRows.filter(row => {
          const assignedFacultyId = queueProjectionAssignedFacultyId(row)
          return assignedFacultyId === facultyId || relevantStudentIds.has(row.studentId) || (!!row.offeringId && relevantOfferingIds.has(row.offeringId))
        })
        const relevantInterventions = interventionRows.filter(row => row.facultyId === facultyId)
        return {
          facultyId,
          facultyName: profile?.displayName ?? facultyId,
          designation: profile?.designation ?? 'Faculty',
          permissions: facultyPermissionMap.get(facultyId) ?? [],
          weeklyContactHours: load?.weeklyContactHours ?? 0,
          sectionLoadCount: load?.sectionLoadCount ?? 0,
          assignedSections: uniqueSorted(allocations.map(row => row.sectionCode ?? '').filter(Boolean)),
          queueLoad: relevantQueueRows.filter(row => {
            const governance = checkpointQueueGovernance(row)
            return row.status === 'Open' && governance.primaryCase && governance.countsTowardCapacity
          }).length,
          avgAcknowledgementLagHours: 0,
          reassessmentClosureRate: relevantQueueRows.length > 0
            ? roundToOne((relevantQueueRows.filter(row => row.status === 'Resolved').length / relevantQueueRows.length) * 100)
            : 0,
          interventionCount: relevantInterventions.length,
          overloadFlag: (load?.weeklyContactHours ?? 0) >= overloadThreshold,
        }
      })
      .sort((left, right) => (right.queueLoad - left.queueLoad) || (right.weeklyContactHours - left.weeklyContactHours) || left.facultyName.localeCompare(right.facultyName))

    const courseRollups = Array.from(new Map(
      checkpointStudentRows.map(row => {
        const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
        const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
        const queueCount = checkpointOpenCaseRows.filter(item => item.courseCode === row.courseCode && item.sectionCode === row.sectionCode).length
        return [`${row.courseCode}::${row.sectionCode}`, {
          courseCode: row.courseCode,
          title: row.courseTitle,
          sectionCodes: uniqueSorted(checkpointStudentRows.filter(item => item.courseCode === row.courseCode).map(item => item.sectionCode)),
          riskCountHigh: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && item.riskBand === 'High').length,
          riskCountMedium: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && item.riskBand === 'Medium').length,
          averageAttendancePct: roundToOne(average(checkpointStudentRows.filter(item => item.courseCode === row.courseCode).map(item => {
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.attendancePct ?? 0)
          }))),
          tt1WeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.tt1Pct ?? 0) > 0 && Number(evidence.tt1Pct ?? 0) < 45
          }).length,
          tt2WeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.tt2Pct ?? 0) > 0 && Number(evidence.tt2Pct ?? 0) < 45
          }).length,
          seeWeakCount: checkpointStudentRows.filter(item => {
            if (item.courseCode !== row.courseCode) return false
            const p = parseJson(item.projectionJson, {} as Record<string, unknown>)
            const evidence = (p.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.seePct ?? 0) > 0 && Number(evidence.seePct ?? 0) < 45
          }).length,
          weakQuestionSignalCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && Number(((parseJson(item.projectionJson, {} as Record<string, unknown>).currentEvidence ?? {}) as Record<string, unknown>).weakQuestionCount ?? 0) >= 4).length,
          backlogCarryoverCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode && Number(((parseJson(item.projectionJson, {} as Record<string, unknown>).currentStatus ?? {}) as Record<string, unknown>).backlogCount ?? 0) > 0).length,
          openReassessmentCount: queueCount,
          resolvedReassessmentCount: checkpointQueueRows.filter(item => item.courseCode === row.courseCode && item.status === 'Resolved').length,
          studentCount: checkpointStudentRows.filter(item => item.courseCode === row.courseCode).length,
        }]
      }),
    ).values())
      .sort((left, right) => ((right.riskCountHigh + right.riskCountMedium) - (left.riskCountHigh + left.riskCountMedium)) || left.courseCode.localeCompare(right.courseCode))

    const studentWatchRows = Array.from(new Set(checkpointStudentRows.map(row => row.studentId)))
      .map(studentId => {
        const student = studentById.get(studentId)
        const rowsForStudent = checkpointStudentRows
          .filter(row => row.studentId === studentId)
          .sort((left, right) => {
            const leftPayload = parseJson(left.projectionJson, {} as Record<string, unknown>)
            const rightPayload = parseJson(right.projectionJson, {} as Record<string, unknown>)
            const leftGovernance = (leftPayload.governance ?? {}) as Record<string, unknown>
            const rightGovernance = (rightPayload.governance ?? {}) as Record<string, unknown>
            const leftPrimary = leftGovernance.primaryCase === true
            const rightPrimary = rightGovernance.primaryCase === true
            if (leftPrimary !== rightPrimary) return Number(rightPrimary) - Number(leftPrimary)
            const leftCounts = leftGovernance.countsTowardCapacity === true
            const rightCounts = rightGovernance.countsTowardCapacity === true
            if (leftCounts !== rightCounts) return Number(rightCounts) - Number(leftCounts)
            const leftRank = Number.isFinite(Number(leftGovernance.priorityRank)) ? Number(leftGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
            const rightRank = Number.isFinite(Number(rightGovernance.priorityRank)) ? Number(rightGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
            if (leftRank !== rightRank) return leftRank - rightRank
            return right.riskProbScaled - left.riskProbScaled || left.courseCode.localeCompare(right.courseCode)
          })
        const primary = rowsForStudent[0]
        if (!primary) return null
        const primaryPayload = parseJson(primary.projectionJson, {} as Record<string, unknown>)
        const primaryEvidence = (primaryPayload.currentEvidence ?? {}) as Record<string, unknown>
        const currentStatus = (primaryPayload.currentStatus ?? {}) as Record<string, unknown>
        const governance = (primaryPayload.governance ?? {}) as Record<string, unknown>
        const counterfactualPolicy = (primaryPayload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
        const evidenceTimeline = buildEvidenceTimelineFromRows(observedRows
          .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
          .sort((left, right) => left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt)))
        const electiveFit = (checkpoint.semesterNumber > 5 || (checkpoint.semesterNumber === 5 && checkpoint.stageKey === 'semester-close'))
          ? electiveRows
            .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
          : null
        return {
          studentId,
          studentName: student?.name ?? studentId,
          usn: student?.usn ?? '',
          sectionCode: primary.sectionCode,
          currentSemester: checkpoint.semesterNumber,
          currentRiskBand: primary.riskBand,
          currentRiskProbScaled: primary.riskProbScaled,
          currentQueueState: typeof currentStatus.queueState === 'string' ? currentStatus.queueState : null,
          queueCaseId: typeof governance.queueCaseId === 'string' ? governance.queueCaseId : null,
          countsTowardCapacity: governance.countsTowardCapacity === true,
          governanceReason: typeof governance.governanceReason === 'string' ? governance.governanceReason : null,
          supportingCourseCount: Number.isFinite(Number(governance.supportingCourseCount)) ? Number(governance.supportingCourseCount) : 0,
          assignedFacultyId: typeof governance.assignedFacultyId === 'string' ? governance.assignedFacultyId : null,
          riskChangeFromPreviousCheckpointScaled: Number(primaryPayload.riskChangeFromPreviousCheckpointScaled ?? 0),
          counterfactualLiftScaled: Number(
            counterfactualPolicy.counterfactualLiftScaled
            ?? primaryPayload.counterfactualLiftScaled
            ?? (primary.noActionRiskProbScaled ?? primary.riskProbScaled) - primary.riskProbScaled,
          ),
          primaryCourseCode: primary.courseCode,
          primaryCourseTitle: primary.courseTitle,
          currentReassessmentStatus: primary.reassessmentState,
          nextDueAt: typeof currentStatus.dueAt === 'string' ? currentStatus.dueAt : null,
          observedEvidence: {
            attendancePct: Number(primaryEvidence.attendancePct ?? 0),
            tt1Pct: Number(primaryEvidence.tt1Pct ?? 0),
            tt2Pct: Number(primaryEvidence.tt2Pct ?? 0),
            quizPct: Number(primaryEvidence.quizPct ?? 0),
            assignmentPct: Number(primaryEvidence.assignmentPct ?? 0),
            seePct: Number(primaryEvidence.seePct ?? 0),
            cgpa: 0,
            backlogCount: 0,
            weakCoCount: Number(primaryEvidence.weakCoCount ?? 0),
            weakQuestionCount: Number(primaryEvidence.weakQuestionCount ?? 0),
            coEvidenceMode: typeof primaryEvidence.coEvidenceMode === 'string' ? primaryEvidence.coEvidenceMode : null,
            interventionRecoveryStatus: typeof primaryEvidence.interventionRecoveryStatus === 'string'
              ? primaryEvidence.interventionRecoveryStatus
              : null,
          },
          electiveFit: electiveFit ? {
            recommendedCode: electiveFit.recommendedCode,
            recommendedTitle: electiveFit.recommendedTitle,
            stream: electiveFit.stream,
            rationale: parseJson(electiveFit.rationaleJson, [] as string[]),
            alternatives: parseJson(electiveFit.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
          } : null,
          courseSnapshots: rowsForStudent.map(row => {
            const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
            const evidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
            return {
              riskAssessmentId: `checkpoint:${checkpoint.simulationStageCheckpointId}:${row.studentId}:${row.courseCode}`,
              offeringId: row.offeringId ?? `${checkpoint.simulationStageCheckpointId}:${row.courseCode}`,
              courseCode: row.courseCode,
              courseTitle: row.courseTitle,
              sectionCode: row.sectionCode,
              riskBand: row.riskBand,
              riskProbScaled: row.riskProbScaled,
              queueState: typeof ((payload.currentStatus ?? {}) as Record<string, unknown>).queueState === 'string'
                ? String(((payload.currentStatus ?? {}) as Record<string, unknown>).queueState)
                : null,
              queueCaseId: typeof (((payload.governance ?? {}) as Record<string, unknown>).queueCaseId) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).queueCaseId))
                : null,
              primaryCase: ((payload.governance ?? {}) as Record<string, unknown>).primaryCase === true,
              countsTowardCapacity: ((payload.governance ?? {}) as Record<string, unknown>).countsTowardCapacity === true,
              governanceReason: typeof (((payload.governance ?? {}) as Record<string, unknown>).governanceReason) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).governanceReason))
                : null,
              supportingCourseCount: Number.isFinite(Number((((payload.governance ?? {}) as Record<string, unknown>).supportingCourseCount)))
                ? Number((((payload.governance ?? {}) as Record<string, unknown>).supportingCourseCount))
                : 0,
              assignedFacultyId: typeof (((payload.governance ?? {}) as Record<string, unknown>).assignedFacultyId) === 'string'
                ? String((((payload.governance ?? {}) as Record<string, unknown>).assignedFacultyId))
                : null,
              riskChangeFromPreviousCheckpointScaled: Number(payload.riskChangeFromPreviousCheckpointScaled ?? 0),
              counterfactualLiftScaled: Number(
                payload.counterfactualLiftScaled
                ?? (((payload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>).counterfactualLiftScaled)
                ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled,
              ),
              recommendedAction: row.recommendedAction ?? 'Continue routine monitoring on the current evidence window.',
              observedEvidence: {
                attendancePct: Number(evidence.attendancePct ?? 0),
                tt1Pct: Number(evidence.tt1Pct ?? 0),
                tt2Pct: Number(evidence.tt2Pct ?? 0),
                quizPct: Number(evidence.quizPct ?? 0),
                assignmentPct: Number(evidence.assignmentPct ?? 0),
                seePct: Number(evidence.seePct ?? 0),
                cgpa: 0,
                backlogCount: 0,
                weakCoCount: Number(evidence.weakCoCount ?? 0),
                weakQuestionCount: Number(evidence.weakQuestionCount ?? 0),
                coEvidenceMode: typeof evidence.coEvidenceMode === 'string' ? evidence.coEvidenceMode : null,
                interventionRecoveryStatus: typeof evidence.interventionRecoveryStatus === 'string' ? evidence.interventionRecoveryStatus : null,
              },
              drivers: [],
            }
          }),
          evidenceTimeline,
        }
      })
      .filter((row): row is NonNullable<typeof row> => !!row)
      .sort((left, right) => (right.currentRiskProbScaled - left.currentRiskProbScaled) || left.studentName.localeCompare(right.studentName))

    const reassessments = checkpointQueueRows
      .map(row => {
        const student = studentById.get(row.studentId)
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        return {
          reassessmentEventId: row.simulationStageQueueProjectionId,
          simulationRunId: checkpoint.simulationRunId,
          runLabel: activeRun.runLabel,
          studentId: row.studentId,
          studentName: student?.name ?? row.studentId,
          usn: student?.usn ?? '',
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          sectionCode: row.sectionCode,
          assignedToRole: row.assignedToRole ?? 'Course Leader',
          assignedFacultyId: row.assignedFacultyId ?? (typeof detail.assignedFacultyId === 'string' ? detail.assignedFacultyId : null),
          dueAt: typeof detail.dueAt === 'string' ? detail.dueAt : checkpoint.updatedAt,
          status: row.status,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          decisionType: queueDecisionTypeFromStatus(row.status),
          decisionNote: typeof detail.note === 'string' ? detail.note : null,
          queueCaseId: typeof detail.queueCaseId === 'string' ? detail.queueCaseId : row.simulationStageQueueCaseId ?? null,
          primaryCase: detail.primaryCase === true,
          countsTowardCapacity: detail.countsTowardCapacity === true,
          priorityRank: Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : null,
          governanceReason: typeof detail.governanceReason === 'string' ? detail.governanceReason : null,
          supportingCourseCount: Number.isFinite(Number(detail.supportingCourseCount)) ? Number(detail.supportingCourseCount) : 0,
          recoveryState: row.status === 'Resolved' ? 'under_watch' : null,
          observedResidual: null,
          acknowledgement: null,
          resolution: row.status === 'Resolved'
            ? {
                resolvedByFacultyId: null,
                resolutionStatus: 'Resolved',
                note: typeof detail.note === 'string' ? detail.note : null,
                createdAt: checkpoint.updatedAt,
              }
            : null,
        }
      })
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || right.riskProbScaled - left.riskProbScaled)

    return {
      summary: {
      activeRunContext: {
          simulationRunId: activeRun.simulationRunId,
          batchId: activeBatch.batchId,
          batchLabel: activeBatch.batchLabel,
          branchName: activeBranch.name,
          runLabel: activeRun.runLabel,
          status: activeRun.status,
          seed: activeRun.seed,
          createdAt: activeRun.createdAt,
          sourceLabel: 'Live proof records',
          checkpointContext: checkpointSummary,
        },
        scope: {
          departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
          branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
        },
        monitoringSummary: {
          riskAssessmentCount: checkpointStudentRows.length,
          activeReassessmentCount: checkpointOpenCaseRows.length,
          alertDecisionCount: checkpointQueueRows.length,
          acknowledgementCount: 0,
          resolutionCount: checkpointQueueRows.filter(row => row.status === 'Resolved' && checkpointQueueGovernance(row).primaryCase).length,
        },
        totals: {
          studentsCovered: scopedStudentIds.size,
          highRiskCount: checkpointStudentRows.filter(row => row.riskBand === 'High').length,
          mediumRiskCount: checkpointStudentRows.filter(row => row.riskBand === 'Medium').length,
          averageQueueAgeHours: 0,
          manualOverrideCount: 0,
          unresolvedAlertCount: checkpointOpenCaseRows.length,
          resolvedAlertCount: checkpointQueueRows.filter(row => row.status === 'Resolved' && checkpointQueueGovernance(row).primaryCase).length,
        },
        sectionComparison: uniqueSorted(checkpointStudentRows.map(row => row.sectionCode)).map(sectionCode => ({
          sectionCode,
          studentCount: new Set(checkpointStudentRows.filter(row => row.sectionCode === sectionCode).map(row => row.studentId)).size,
          highRiskCount: checkpointStudentRows.filter(row => row.sectionCode === sectionCode && row.riskBand === 'High').length,
          mediumRiskCount: checkpointStudentRows.filter(row => row.sectionCode === sectionCode && row.riskBand === 'Medium').length,
          averageAttendancePct: roundToOne(average(checkpointStudentRows.filter(row => row.sectionCode === sectionCode).map(row => {
            const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
            const evidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
            return Number(evidence.attendancePct ?? 0)
          }))),
          openReassessmentCount: checkpointOpenCaseRows.filter(row => row.sectionCode === sectionCode).length,
        })),
        semesterRiskDistribution: termRows
          .filter(row => row.batchId === activeBatch.batchId && row.semesterNumber <= checkpoint.semesterNumber)
          .sort((left, right) => left.semesterNumber - right.semesterNumber)
          .map(term => {
            const termTranscripts = transcriptRows.filter(row => row.termId === term.termId)
            const highPressureCount = termTranscripts.filter(row => row.backlogCount >= 2).length
            const reviewCount = termTranscripts.filter(row => row.backlogCount === 1).length
            const stableCount = termTranscripts.filter(row => row.backlogCount === 0).length
            return {
              semesterNumber: term.semesterNumber,
              highPressureCount,
              reviewCount,
              stableCount,
              basis: 'transcript-backlog',
            }
          }),
        backlogDistribution: ['0', '1', '2', '3+'].map(bucket => ({
          bucket,
          studentCount: transcriptRows.filter(row => bucketBacklogCount(row.backlogCount) === bucket).length,
        })),
        electiveDistribution: (checkpoint.semesterNumber > 5 || (checkpoint.semesterNumber === 5 && checkpoint.stageKey === 'semester-close'))
          ? Array.from(new Map(electiveRows.filter(row => row.simulationRunId === activeRunId).map(row => [row.stream, {
              stream: row.stream,
              recommendationCount: electiveRows.filter(item => item.simulationRunId === activeRunId && item.stream === row.stream).length,
            }])).values()).sort((left, right) => right.recommendationCount - left.recommendationCount || left.stream.localeCompare(right.stream))
          : [],
        facultyLoadSummary: {
          facultyCount: facultyRowsForHod.length,
          overloadedFacultyCount: facultyRowsForHod.filter(row => row.overloadFlag).length,
          averageWeeklyContactHours: roundToOne(average(facultyRowsForHod.map(row => row.weeklyContactHours))),
        },
      },
      courses: courseRollups,
      faculty: facultyRowsForHod,
      students: studentWatchRows,
      reassessments,
    }
  }

  if (!activeRun || !activeBatch || !activeBranch || !activeRunId || !scopeMatchesActiveBatch) return emptyResponse

  const activeOfferings = sectionOfferingRows
    .filter(row => activeTermIds.has(row.termId))
    .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
    .filter(row => {
      const course = courseById.get(row.courseId)
      return matchesTextFilter(course?.courseCode ?? null, input.filters?.courseCode)
    })
  const activeOfferingIds = new Set(activeOfferings.map(row => row.offeringId))
  const filteredObservedRows = observedRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => row.semesterNumber === currentSemester)
    .filter(row => matchesTextFilter(row.sectionCode, input.filters?.section))
    .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    .filter(row => {
      const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
      const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
      if (activeOfferingIds.size === 0) return !offeringId
      return !!offeringId && activeOfferingIds.has(offeringId)
    })

  const observedByStudentOffering = new Map<string, Record<string, unknown>>()
  filteredObservedRows.forEach(row => {
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
    const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
    if (!offeringId) return
    observedByStudentOffering.set(`${row.studentId}::${offeringId}`, payload)
  })

  const activeRiskRows = riskAssessmentRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => activeOfferingIds.has(row.offeringId))
    .filter(row => !input.filters?.studentId || row.studentId === input.filters.studentId)
    .filter(row => matchesTextFilter(row.riskBand, input.filters?.riskBand))

  const activeRiskIds = new Set(activeRiskRows.map(row => row.riskAssessmentId))
  const activeAlerts = alertRows.filter(row => activeRiskIds.has(row.riskAssessmentId))
  const activeReassessments = reassessmentRows
    .filter(row => activeRiskIds.has(row.riskAssessmentId))
    .filter(row => matchesTextFilter(row.status, input.filters?.status))
  const activeAlertIds = new Set(activeAlerts.map(row => row.alertDecisionId))
  const activeAcknowledgements = acknowledgementRows.filter(row => activeAlertIds.has(row.alertDecisionId))
  const activeReassessmentIds = new Set(activeReassessments.map(row => row.reassessmentEventId))
  const activeResolutions = resolutionRows.filter(row => activeReassessmentIds.has(row.reassessmentEventId))
  const activeOverrides = overrideRows.filter(row => activeRiskIds.has(row.riskAssessmentId))

  const distinctStudentIds = new Set(filteredObservedRows.map(row => row.studentId))
  if (input.filters?.studentId) distinctStudentIds.add(input.filters.studentId)
  const distinctStudentSectionById = new Map<string, string>()
  observedRows
    .filter(row => row.simulationRunId === activeRunId)
    .forEach(row => {
      if (!distinctStudentSectionById.has(row.studentId)) distinctStudentSectionById.set(row.studentId, row.sectionCode)
    })

  const activeRunContext = {
    simulationRunId: activeRun.simulationRunId,
    batchId: activeBatch.batchId,
    batchLabel: activeBatch.batchLabel,
    branchName: activeBranch.name,
    runLabel: activeRun.runLabel,
    status: activeRun.status,
    seed: activeRun.seed,
    createdAt: activeRun.createdAt,
    sourceLabel: 'Live proof records',
  }

  const currentSemesterLoadRows = loadRows
    .filter(row => row.simulationRunId === activeRunId)
    .filter(row => row.semesterNumber === currentSemester)

  const facultyPermissionMap = new Map<string, string[]>()
  grantRows
    .filter(row => row.status === 'active')
    .forEach(row => {
      facultyPermissionMap.set(row.facultyId, uniqueSorted([...(facultyPermissionMap.get(row.facultyId) ?? []), row.roleCode]))
    })

  const activeMentorAssignments = mentorRows.filter(row => row.effectiveTo === null)
  const activeOwnershipRows = ownershipRows.filter(row => row.status === 'active')
  const currentLoadAverage = average(currentSemesterLoadRows.map(row => row.weeklyContactHours))
  const overloadThreshold = Math.max(8, Math.ceil(currentLoadAverage * 1.25))
  const facultyIdsInScope = uniqueSorted([
    ...currentSemesterLoadRows.map(row => row.facultyId),
    ...activeMentorAssignments.map(row => row.facultyId),
    ...activeOwnershipRows.map(row => row.facultyId),
  ]).filter(facultyId => {
    const facultyAppointments = allAppointmentRows.filter(row => row.facultyId === facultyId && row.status === 'active')
    if (facultyAppointments.length === 0) return false
    return facultyAppointments.some(row => scopeDepartmentIds.has(row.departmentId) || (row.branchId ? scopeBranchIds.has(row.branchId) : false))
  })

  const facultyRowsForHod = facultyIdsInScope
    .filter(facultyId => matchesTextFilter(facultyId, input.filters?.facultyId))
    .map(facultyId => {
      const profile = facultyById.get(facultyId)
      const load = currentSemesterLoadRows.find(row => row.facultyId === facultyId) ?? null
      const allocations = allocationRows
        .filter(row => row.simulationRunId === activeRunId && row.semesterNumber === currentSemester && row.facultyId === facultyId)
        .filter(row => !input.filters?.section || matchesTextFilter(row.sectionCode ?? null, input.filters.section))
      const relevantOfferingIds = new Set(activeOwnershipRows.filter(row => row.facultyId === facultyId).map(row => row.offeringId))
      const relevantStudentIds = new Set(activeMentorAssignments.filter(row => row.facultyId === facultyId).map(row => row.studentId))
      const relevantRiskRows = activeRiskRows.filter(row => relevantStudentIds.has(row.studentId) || relevantOfferingIds.has(row.offeringId))
      const relevantRiskIds = new Set(relevantRiskRows.map(row => row.riskAssessmentId))
      const relevantReassessments = activeReassessments.filter(row =>
        (row.assignedFacultyId != null && row.assignedFacultyId === facultyId) || relevantRiskIds.has(row.riskAssessmentId),
      )
      const relevantAlerts = activeAlerts.filter(row => relevantRiskIds.has(row.riskAssessmentId))
      const relevantAcks = activeAcknowledgements.filter(row => relevantAlerts.some(alert => alert.alertDecisionId === row.alertDecisionId))
      const relevantInterventions = interventionRows.filter(row => row.facultyId === facultyId && (!row.offeringId || activeOfferingIds.has(row.offeringId)))
      const avgAcknowledgementLagHours = relevantAcks.length > 0
        ? roundToOne(average(relevantAcks.map(ack => {
            const alert = relevantAlerts.find(item => item.alertDecisionId === ack.alertDecisionId)
            return alert ? hoursBetween(alert.createdAt, ack.createdAt) : 0
          })))
        : 0
      const resolvedCount = relevantReassessments.filter(row => activeResolutions.some(resolution => resolution.reassessmentEventId === row.reassessmentEventId)).length
      const closureRate = relevantReassessments.length > 0 ? roundToOne((resolvedCount / relevantReassessments.length) * 100) : 0
      return {
        facultyId,
        facultyName: profile?.displayName ?? facultyId,
        designation: profile?.designation ?? 'Faculty',
        permissions: facultyPermissionMap.get(facultyId) ?? [],
        weeklyContactHours: load?.weeklyContactHours ?? 0,
        sectionLoadCount: load?.sectionLoadCount ?? 0,
        assignedSections: uniqueSorted(allocations.map(row => row.sectionCode ?? '').filter(Boolean)),
        queueLoad: relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
        avgAcknowledgementLagHours,
        reassessmentClosureRate: closureRate,
        interventionCount: relevantInterventions.length,
        overloadFlag: (load?.weeklyContactHours ?? 0) >= overloadThreshold,
      }
    })
    .sort((left, right) => (right.queueLoad - left.queueLoad) || (right.weeklyContactHours - left.weeklyContactHours) || left.facultyName.localeCompare(right.facultyName))

  const courseRollups = Array.from(new Map(
    uniqueSorted(activeOfferings.map(row => row.courseId)).map(courseId => {
      const course = courseById.get(courseId)
      const offeringIdsForCourse = new Set(activeOfferings.filter(row => row.courseId === courseId).map(row => row.offeringId))
      const riskForCourse = activeRiskRows.filter(row => offeringIdsForCourse.has(row.offeringId))
      const riskIds = new Set(riskForCourse.map(row => row.riskAssessmentId))
      const courseObserved = filteredObservedRows.filter(row => {
        const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
        return typeof payload.offeringId === 'string' && offeringIdsForCourse.has(payload.offeringId)
      })
      const attendanceValues = courseObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).attendancePct ?? 0)).filter(Number.isFinite)
      const tt1Values = courseObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).tt1Pct ?? 0)).filter(Number.isFinite)
      const tt2Values = courseObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).tt2Pct ?? 0)).filter(Number.isFinite)
      const seeValues = courseObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).seePct ?? 0)).filter(Number.isFinite)
      const weakQuestionValues = courseObserved.map(row => Number((parseJson(row.observedStateJson, {} as Record<string, unknown>).questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0)).filter(Number.isFinite)
      const backlogValues = courseObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).backlogCount ?? 0)).filter(Number.isFinite)
      const relevantReassessments = activeReassessments.filter(row => riskIds.has(row.riskAssessmentId))
      const key = course?.courseCode ?? courseId
      return [key, {
        courseCode: course?.courseCode ?? 'NA',
        title: course?.title ?? 'Untitled course',
        sectionCodes: uniqueSorted(activeOfferings.filter(row => row.courseId === courseId).map(row => row.sectionCode)),
        riskCountHigh: riskForCourse.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        riskCountMedium: riskForCourse.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageAttendancePct: roundToOne(average(attendanceValues)),
        tt1WeakCount: tt1Values.filter(value => value < 45).length,
        tt2WeakCount: tt2Values.filter(value => value < 45).length,
        seeWeakCount: seeValues.filter(value => value < 45).length,
        weakQuestionSignalCount: weakQuestionValues.filter(value => value >= 4).length,
        backlogCarryoverCount: backlogValues.filter(value => value > 0).length,
        openReassessmentCount: relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
        resolvedReassessmentCount: relevantReassessments.filter(row => activeResolutions.some(resolution => resolution.reassessmentEventId === row.reassessmentEventId)).length,
        studentCount: new Set(courseObserved.map(row => row.studentId)).size,
      }]
    }),
  ).values())
    .sort((left, right) => ((right.riskCountHigh + right.riskCountMedium) - (left.riskCountHigh + left.riskCountMedium)) || left.courseCode.localeCompare(right.courseCode))

  const latestTranscriptByStudent = new Map<string, typeof transcriptTermResults.$inferSelect>()
  transcriptRows
    .filter(row => {
      const term = termById.get(row.termId)
      return term?.batchId === activeBatch.batchId
    })
    .sort((left, right) => right.termId.localeCompare(left.termId) || right.updatedAt.localeCompare(left.updatedAt))
    .forEach(row => {
      if (!latestTranscriptByStudent.has(row.studentId)) latestTranscriptByStudent.set(row.studentId, row)
    })
  const latestResolutionByEventId = new Map<string, typeof reassessmentResolutions.$inferSelect>()
  activeResolutions
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach(row => {
      if (!latestResolutionByEventId.has(row.reassessmentEventId)) {
        latestResolutionByEventId.set(row.reassessmentEventId, row)
      }
    })
  const latestReassessmentByRiskId = new Map<string, typeof activeReassessments[number]>()
  activeReassessments
    .slice()
    .sort((left, right) => {
      const leftRank = isOpenReassessmentStatus(left.status) ? 1 : 0
      const rightRank = isOpenReassessmentStatus(right.status) ? 1 : 0
      if (leftRank !== rightRank) return rightRank - leftRank
      return right.updatedAt.localeCompare(left.updatedAt)
    })
    .forEach(row => {
      if (!latestReassessmentByRiskId.has(row.riskAssessmentId)) {
        latestReassessmentByRiskId.set(row.riskAssessmentId, row)
      }
    })

  const studentWatchRows = Array.from(new Set(activeRiskRows.map(row => row.studentId)))
    .map(studentId => {
      const student = studentById.get(studentId)
      const riskForStudent = activeRiskRows
        .filter(row => row.studentId === studentId)
        .sort((left, right) => {
          const leftReassessment = latestReassessmentByRiskId.get(left.riskAssessmentId) ?? null
          const rightReassessment = latestReassessmentByRiskId.get(right.riskAssessmentId) ?? null
          const leftRank = leftReassessment && isOpenReassessmentStatus(leftReassessment.status) ? 2 : leftReassessment ? 1 : 0
          const rightRank = rightReassessment && isOpenReassessmentStatus(rightReassessment.status) ? 2 : rightReassessment ? 1 : 0
          if (leftRank !== rightRank) return rightRank - leftRank
          return (right.riskProbScaled - left.riskProbScaled) || left.offeringId.localeCompare(right.offeringId)
        })
      const primaryRisk = riskForStudent[0]
      if (!primaryRisk) return null
      const offering = sectionOfferingRows.find(row => row.offeringId === primaryRisk.offeringId) ?? null
      const course = offering ? courseById.get(offering.courseId) : null
      const primaryEvidence = observedByStudentOffering.get(`${studentId}::${primaryRisk.offeringId}`) ?? {}
      const primaryReassessment = latestReassessmentByRiskId.get(primaryRisk.riskAssessmentId) ?? null
      const primaryReassessmentPayload = primaryReassessment ? parseJson(primaryReassessment.payloadJson, {} as Record<string, unknown>) : {}
      const primaryResolution = primaryReassessment ? (latestResolutionByEventId.get(primaryReassessment.reassessmentEventId) ?? null) : null
      const studentObservedRows = observedRows
        .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
        .sort((left, right) => left.semesterNumber - right.semesterNumber || left.createdAt.localeCompare(right.createdAt))
      const evidenceTimeline = buildEvidenceTimelineFromRows(studentObservedRows)
      const electiveFit = electiveRows
        .filter(row => row.simulationRunId === activeRunId && row.studentId === studentId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      const relevantReassessments = activeReassessments.filter(row => row.studentId === studentId)
      const nextDueAt = relevantReassessments.filter(row => isOpenReassessmentStatus(row.status)).map(row => row.dueAt).sort()[0] ?? null
      const courseSnapshots = riskForStudent.map(row => {
        const rowOffering = sectionOfferingRows.find(item => item.offeringId === row.offeringId) ?? null
        const rowCourse = rowOffering ? courseById.get(rowOffering.courseId) : null
        const rowEvidence = observedByStudentOffering.get(`${studentId}::${row.offeringId}`) ?? {}
        const rowReassessment = latestReassessmentByRiskId.get(row.riskAssessmentId) ?? null
        const rowPayload = rowReassessment ? parseJson(rowReassessment.payloadJson, {} as Record<string, unknown>) : {}
        return {
          riskAssessmentId: row.riskAssessmentId,
          offeringId: row.offeringId,
          courseCode: rowCourse?.courseCode ?? 'NA',
          courseTitle: rowCourse?.title ?? 'Untitled course',
          sectionCode: rowOffering?.sectionCode ?? null,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          queueState: rowReassessment
            ? (isOpenReassessmentStatus(rowReassessment.status) ? 'open' : normalizeFilterValue(rowReassessment.status) === 'resolved' ? 'resolved' : 'watch')
            : null,
          queueCaseId: typeof rowPayload.queueCaseId === 'string' ? rowPayload.queueCaseId : null,
          primaryCase: typeof rowPayload.primaryCase === 'boolean' ? rowPayload.primaryCase : null,
          countsTowardCapacity: typeof rowPayload.countsTowardCapacity === 'boolean' ? rowPayload.countsTowardCapacity : null,
          recommendedAction: row.recommendedAction,
          observedEvidence: {
            attendancePct: Number(rowEvidence.attendancePct ?? 0),
            tt1Pct: Number(rowEvidence.tt1Pct ?? 0),
            tt2Pct: Number(rowEvidence.tt2Pct ?? 0),
            quizPct: Number(rowEvidence.quizPct ?? 0),
            assignmentPct: Number(rowEvidence.assignmentPct ?? 0),
            seePct: Number(rowEvidence.seePct ?? 0),
            cgpa: Number(rowEvidence.cgpa ?? 0),
            backlogCount: Number(rowEvidence.backlogCount ?? 0),
            weakCoCount: Number(rowEvidence.weakCoCount ?? 0),
            weakQuestionCount: Number((rowEvidence.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
            coEvidenceMode: typeof rowEvidence.coEvidenceMode === 'string' ? rowEvidence.coEvidenceMode : null,
            interventionRecoveryStatus: rowEvidence.interventionResponse && typeof rowEvidence.interventionResponse === 'object'
              ? String((rowEvidence.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
              : null,
          },
          drivers: parseJson(row.driversJson, [] as unknown[]),
        }
      })
      return {
        studentId,
        studentName: student?.name ?? studentId,
        usn: student?.usn ?? '',
        sectionCode: offering?.sectionCode ?? distinctStudentSectionById.get(studentId) ?? 'NA',
        currentSemester,
        currentRiskBand: primaryRisk.riskBand,
        currentRiskProbScaled: primaryRisk.riskProbScaled,
        currentQueueState: primaryReassessment
          ? (isOpenReassessmentStatus(primaryReassessment.status) ? 'open' : normalizeFilterValue(primaryReassessment.status) === 'resolved' ? 'resolved' : 'watch')
          : null,
        currentRecoveryState: proofRecoveryStateFromResolutionRow(primaryResolution),
        queueCaseId: typeof primaryReassessmentPayload.queueCaseId === 'string' ? primaryReassessmentPayload.queueCaseId : null,
        countsTowardCapacity: typeof primaryReassessmentPayload.countsTowardCapacity === 'boolean' ? primaryReassessmentPayload.countsTowardCapacity : null,
        governanceReason: typeof primaryReassessmentPayload.governanceReason === 'string' ? primaryReassessmentPayload.governanceReason : null,
        supportingCourseCount: Number.isFinite(Number(primaryReassessmentPayload.supportingCourseCount)) ? Number(primaryReassessmentPayload.supportingCourseCount) : 0,
        assignedFacultyId: primaryReassessment?.assignedFacultyId ?? (typeof primaryReassessmentPayload.assignedFacultyId === 'string' ? primaryReassessmentPayload.assignedFacultyId : null),
        primaryCourseCode: course?.courseCode ?? 'NA',
        primaryCourseTitle: course?.title ?? 'Untitled course',
        currentReassessmentStatus: primaryReassessment?.status ?? relevantReassessments.find(row => isOpenReassessmentStatus(row.status))?.status ?? relevantReassessments[0]?.status ?? null,
        nextDueAt,
        observedEvidence: {
          attendancePct: Number(primaryEvidence.attendancePct ?? 0),
          tt1Pct: Number(primaryEvidence.tt1Pct ?? 0),
          tt2Pct: Number(primaryEvidence.tt2Pct ?? 0),
          quizPct: Number(primaryEvidence.quizPct ?? 0),
          assignmentPct: Number(primaryEvidence.assignmentPct ?? 0),
          seePct: Number(primaryEvidence.seePct ?? 0),
          cgpa: Number(primaryEvidence.cgpa ?? 0),
          backlogCount: Number(primaryEvidence.backlogCount ?? latestTranscriptByStudent.get(studentId)?.backlogCount ?? 0),
          weakCoCount: Number(primaryEvidence.weakCoCount ?? 0),
          weakQuestionCount: Number((primaryEvidence.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
          coEvidenceMode: typeof primaryEvidence.coEvidenceMode === 'string' ? primaryEvidence.coEvidenceMode : null,
          interventionRecoveryStatus: primaryEvidence.interventionResponse && typeof primaryEvidence.interventionResponse === 'object'
            ? String((primaryEvidence.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
            : null,
        },
        electiveFit: electiveFit ? {
          recommendedCode: electiveFit.recommendedCode,
          recommendedTitle: electiveFit.recommendedTitle,
          stream: electiveFit.stream,
          rationale: parseJson(electiveFit.rationaleJson, [] as string[]),
          alternatives: parseJson(electiveFit.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
        } : null,
        courseSnapshots,
        evidenceTimeline,
      }
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((left, right) => (right.currentRiskProbScaled - left.currentRiskProbScaled) || left.studentName.localeCompare(right.studentName))

  const facultyFilterIds = input.filters?.facultyId ? new Set([input.filters.facultyId]) : null
  const reassessments = activeReassessments
    .map(row => {
      const risk = activeRiskRows.find(item => item.riskAssessmentId === row.riskAssessmentId)
      if (!risk) return null
      const offering = sectionOfferingRows.find(item => item.offeringId === risk.offeringId) ?? null
      const course = offering ? courseById.get(offering.courseId) : null
      const student = studentById.get(row.studentId)
      const alert = activeAlerts.find(item => item.riskAssessmentId === row.riskAssessmentId) ?? null
      const acknowledgement = alert ? activeAcknowledgements.filter(item => item.alertDecisionId === alert.alertDecisionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null : null
      const resolution = activeResolutions.filter(item => item.reassessmentEventId === row.reassessmentEventId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      if (!matchesTextFilter(risk.riskBand, input.filters?.riskBand)) return null
      if (!matchesTextFilter(student?.studentId ?? null, input.filters?.studentId)) return null
      if (!matchesTextFilter(course?.courseCode ?? null, input.filters?.courseCode)) return null
      if (!matchesTextFilter(offering?.sectionCode ?? null, input.filters?.section)) return null
      if (facultyFilterIds && facultyFilterIds.size > 0) {
        const facultyId = [...facultyFilterIds][0]
        const relevantOfferingIds = new Set(activeOwnershipRows.filter(item => item.facultyId === facultyId).map(item => item.offeringId))
        const relevantStudentIds = new Set(activeMentorAssignments.filter(item => item.facultyId === facultyId).map(item => item.studentId))
        if (!relevantOfferingIds.has(risk.offeringId) && !relevantStudentIds.has(row.studentId)) return null
      }
      const payload = parseJson(row.payloadJson, {} as Record<string, unknown>)
      return {
        reassessmentEventId: row.reassessmentEventId,
        simulationRunId: activeRun.simulationRunId,
        runLabel: activeRun.runLabel,
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        courseCode: course?.courseCode ?? 'NA',
        courseTitle: course?.title ?? 'Untitled course',
        sectionCode: offering?.sectionCode ?? null,
        assignedToRole: row.assignedToRole,
        assignedFacultyId: row.assignedFacultyId ?? (typeof payload.assignedFacultyId === 'string' ? payload.assignedFacultyId : null),
        dueAt: row.dueAt,
        status: row.status,
        riskBand: risk.riskBand,
        riskProbScaled: risk.riskProbScaled,
        decisionType: alert?.decisionType ?? null,
        decisionNote: alert?.note ?? null,
        queueCaseId: typeof payload.queueCaseId === 'string' ? payload.queueCaseId : null,
        primaryCase: typeof payload.primaryCase === 'boolean' ? payload.primaryCase : true,
        countsTowardCapacity: typeof payload.countsTowardCapacity === 'boolean' ? payload.countsTowardCapacity : true,
        priorityRank: Number.isFinite(Number(payload.priorityRank)) ? Number(payload.priorityRank) : null,
        governanceReason: typeof payload.governanceReason === 'string' ? payload.governanceReason : null,
        supportingCourseCount: Number.isFinite(Number(payload.supportingCourseCount))
          ? Number(payload.supportingCourseCount)
          : Array.isArray(payload.supportingRiskAssessmentIds)
            ? payload.supportingRiskAssessmentIds.length
            : 0,
        recoveryState: proofRecoveryStateFromResolutionRow(resolution),
        observedResidual: Number.isFinite(Number(proofResolutionPayloadFromRow(resolution).observedResidual))
          ? Number(proofResolutionPayloadFromRow(resolution).observedResidual)
          : null,
        acknowledgement: acknowledgement ? {
          acknowledgedByFacultyId: acknowledgement.acknowledgedByFacultyId,
          status: acknowledgement.status,
          note: acknowledgement.note,
          createdAt: acknowledgement.createdAt,
        } : null,
        resolution: resolution ? {
          resolvedByFacultyId: resolution.resolvedByFacultyId,
          resolutionStatus: resolution.resolutionStatus,
          note: resolution.note,
          createdAt: resolution.createdAt,
        } : null,
      }
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || right.riskProbScaled - left.riskProbScaled)

  const sectionComparison = uniqueSorted(filteredObservedRows.map(row => row.sectionCode))
    .map(sectionCode => {
      const sectionRiskRows = activeRiskRows.filter(row => {
        const offering = sectionOfferingRows.find(item => item.offeringId === row.offeringId)
        return offering?.sectionCode === sectionCode
      })
      const sectionObserved = filteredObservedRows.filter(row => row.sectionCode === sectionCode)
      const sectionRiskIds = new Set(sectionRiskRows.map(row => row.riskAssessmentId))
      return {
        sectionCode,
        studentCount: new Set(sectionObserved.map(row => row.studentId)).size,
        highRiskCount: sectionRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        mediumRiskCount: sectionRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageAttendancePct: roundToOne(average(sectionObserved.map(row => Number(parseJson(row.observedStateJson, {} as Record<string, unknown>).attendancePct ?? 0)).filter(Number.isFinite))),
        openReassessmentCount: activeReassessments.filter(row => sectionRiskIds.has(row.riskAssessmentId) && isOpenReassessmentStatus(row.status)).length,
      }
    })

  const scopedStudentIds = studentWatchRows.length > 0
    ? new Set(studentWatchRows.map(row => row.studentId))
    : distinctStudentIds
  const semesterRiskDistribution = termRows
    .filter(row => row.batchId === activeBatch.batchId && row.semesterNumber <= currentSemester)
    .sort((left, right) => left.semesterNumber - right.semesterNumber)
    .map(term => {
      const termTranscripts = transcriptRows
        .filter(row => row.termId === term.termId)
        .filter(row => scopedStudentIds.has(row.studentId))
      const highPressureCount = termTranscripts.filter(row => row.backlogCount >= 2).length
      const reviewCount = termTranscripts.filter(row => row.backlogCount === 1).length
      const stableCount = termTranscripts.filter(row => row.backlogCount === 0).length
      return {
        semesterNumber: term.semesterNumber,
        highPressureCount,
        reviewCount,
        stableCount,
        basis: 'transcript-backlog',
      }
    })

  const latestBacklogRows = Array.from(latestTranscriptByStudent.values()).filter(row => scopedStudentIds.has(row.studentId))
  const backlogDistribution = ['0', '1', '2', '3+'].map(bucket => ({
    bucket,
    studentCount: latestBacklogRows.filter(row => bucketBacklogCount(row.backlogCount) === bucket).length,
  }))

  const electiveDistribution = Array.from(new Map(
    electiveRows
      .filter(row => row.simulationRunId === activeRunId)
      .filter(row => scopedStudentIds.has(row.studentId))
      .map(row => [row.stream, {
        stream: row.stream,
        recommendationCount: electiveRows.filter(item => item.simulationRunId === activeRunId && item.stream === row.stream && scopedStudentIds.has(item.studentId)).length,
      }]),
  ).values()).sort((left, right) => right.recommendationCount - left.recommendationCount || left.stream.localeCompare(right.stream))

  const monitoringSummary = {
    riskAssessmentCount: activeRiskRows.length,
    activeReassessmentCount: activeReassessments.filter(row => isOpenReassessmentStatus(row.status)).length,
    alertDecisionCount: activeAlerts.length,
    acknowledgementCount: activeAcknowledgements.length,
    resolutionCount: activeResolutions.length,
  }

  return {
    summary: {
      activeRunContext,
      scope: {
        departmentNames: uniqueSorted(Array.from(scopeDepartmentIds).map(departmentId => departmentById.get(departmentId)?.name ?? departmentId)),
        branchNames: uniqueSorted(Array.from(scopeBranchIds).map(branchId => branchById.get(branchId)?.name ?? branchId)),
      },
      monitoringSummary,
      totals: {
        studentsCovered: scopedStudentIds.size,
        highRiskCount: activeRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'high').length,
        mediumRiskCount: activeRiskRows.filter(row => normalizeFilterValue(row.riskBand) === 'medium').length,
        averageQueueAgeHours: roundToOne(average(activeReassessments.filter(row => isOpenReassessmentStatus(row.status)).map(row => hoursBetween(row.createdAt, input.now ?? new Date().toISOString())))),
        manualOverrideCount: activeOverrides.length,
        unresolvedAlertCount: activeAlerts.filter(row => !activeAcknowledgements.some(ack => ack.alertDecisionId === row.alertDecisionId)).length,
        resolvedAlertCount: activeResolutions.length,
      },
      sectionComparison,
      semesterRiskDistribution,
      backlogDistribution,
      electiveDistribution,
      facultyLoadSummary: {
        facultyCount: facultyRowsForHod.length,
        overloadedFacultyCount: facultyRowsForHod.filter(row => row.overloadFlag).length,
        averageWeeklyContactHours: roundToOne(average(facultyRowsForHod.map(row => row.weeklyContactHours))),
      },
    },
    courses: courseRollups,
    faculty: facultyRowsForHod,
    students: studentWatchRows,
    reassessments,
  }
}

export async function buildFacultyProofView(db: AppDb, input: {
  facultyId: string
  viewerRoleCode?: string | null
  simulationStageCheckpointId?: string | null
}) {
  const facultyId = input.facultyId
  const viewerRoleCode = input.viewerRoleCode as FacultyProofViewerRole
  if (input.simulationStageCheckpointId) {
    const [
      checkpoint,
      runRows,
      ownershipRows,
      mentorRows,
      observedRows,
      studentRows,
      electiveRows,
      queueRows,
      batchRows,
      branchRows,
    ] = await Promise.all([
      db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationStageCheckpointId, input.simulationStageCheckpointId)).then(rows => rows[0] ?? null),
      db.select().from(simulationRuns),
      db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, facultyId)),
      db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId)),
      db.select().from(studentObservedSemesterStates),
      db.select().from(students),
      db.select().from(electiveRecommendations),
      db.select().from(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationStageCheckpointId, input.simulationStageCheckpointId)),
      db.select().from(batches),
      db.select().from(branches),
    ])
    if (!checkpoint) throw new Error('Simulation stage checkpoint not found')
    const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, checkpoint.simulationRunId)).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    )
    const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary))
      .find(item => item.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      ?? parseProofCheckpointSummary(checkpoint)
    const run = runRows.find(row => row.simulationRunId === checkpoint.simulationRunId) ?? null
    if (!run) throw new Error('Simulation run not found for stage checkpoint')
    const batch = batchRows.find(row => row.batchId === run.batchId) ?? null
    const branch = batch ? (branchRows.find(row => row.branchId === batch.branchId) ?? null) : null
    const studentById = new Map(studentRows.map(row => [row.studentId, row]))
    const relevantOfferingIds = new Set(ownershipRows.filter(row => row.status === 'active').map(row => row.offeringId))
    const relevantStudentIds = new Set(mentorRows.filter(row => row.effectiveTo === null).map(row => row.studentId))
    const studentsVisibleViaOwnedOfferings = new Set(
      observedRows
        .filter(row => row.simulationRunId === checkpoint.simulationRunId)
        .flatMap(row => {
          const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
          const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
          return offeringId && relevantOfferingIds.has(offeringId) ? [row.studentId] : []
        }),
    )
    const facultyCheckpointQueueGovernance = (row: typeof queueRows[number]) => {
      const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
      return {
        primaryCase: detail.primaryCase === true,
        countsTowardCapacity: detail.countsTowardCapacity === true,
      }
    }
    const queueItems = queueRows
      .filter(row => isFacultyProofQueueItemVisible({
        viewerRoleCode,
        matchesAssignedStudent: relevantStudentIds.has(row.studentId),
        matchesOwnedOffering: !!row.offeringId && relevantOfferingIds.has(row.offeringId),
      }))
      .filter(row => {
        const governance = facultyCheckpointQueueGovernance(row)
        return row.status === 'Open' && governance.primaryCase && governance.countsTowardCapacity
      })
      .map(row => {
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        const currentEvidence = parseJson(JSON.stringify(detail.currentEvidence ?? {}), {} as Record<string, unknown>)
        const student = studentById.get(row.studentId)
        return {
          riskAssessmentId: `checkpoint:${checkpoint.simulationStageCheckpointId}:${row.studentId}:${row.courseCode}`,
          simulationRunId: row.simulationRunId,
          batchId: batch?.batchId ?? null,
          batchLabel: batch?.batchLabel ?? null,
          branchName: branch?.name ?? null,
          studentId: row.studentId,
          studentName: student?.name ?? row.studentId,
          usn: student?.usn ?? '',
          offeringId: row.offeringId ?? `${checkpoint.simulationStageCheckpointId}:${row.courseCode}`,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          sectionCode: row.sectionCode,
          riskBand: row.riskBand,
          riskProbScaled: row.riskProbScaled,
          riskChangeFromPreviousCheckpointScaled: Number(detail.riskChangeFromPreviousCheckpointScaled ?? 0),
          counterfactualLiftScaled: Number(detail.counterfactualLiftScaled ?? (row.noActionRiskProbScaled ?? row.riskProbScaled) - row.riskProbScaled),
          recommendedAction: row.recommendedAction ?? 'Continue routine monitoring on the current evidence window.',
          drivers: [],
          dueAt: typeof detail.dueAt === 'string' ? detail.dueAt : null,
          reassessmentStatus: queueReassessmentStatusFromStatus(row.status),
          decisionType: queueDecisionTypeFromStatus(row.status),
          decisionNote: typeof detail.note === 'string' ? detail.note : null,
          observedEvidence: {
            attendancePct: Number(currentEvidence.attendancePct ?? 0),
            tt1Pct: Number(currentEvidence.tt1Pct ?? 0),
            tt2Pct: Number(currentEvidence.tt2Pct ?? 0),
            quizPct: Number(currentEvidence.quizPct ?? 0),
            assignmentPct: Number(currentEvidence.assignmentPct ?? 0),
            seePct: Number(currentEvidence.seePct ?? 0),
            cgpa: 0,
            backlogCount: 0,
            weakCoCount: Number(currentEvidence.weakCoCount ?? 0),
            weakQuestionCount: Number(currentEvidence.weakQuestionCount ?? 0),
            coEvidenceMode: typeof currentEvidence.coEvidenceMode === 'string' ? currentEvidence.coEvidenceMode : null,
            interventionRecoveryStatus: typeof currentEvidence.interventionRecoveryStatus === 'string'
              ? currentEvidence.interventionRecoveryStatus
              : null,
          },
          override: null,
          acknowledgement: null,
          resolution: row.status === 'Resolved'
            ? {
                resolutionStatus: 'Resolved',
                note: typeof detail.note === 'string' ? detail.note : null,
                createdAt: checkpoint.updatedAt,
              }
            : null,
        }
      })
      .sort((left, right) => right.riskProbScaled - left.riskProbScaled || String(left.dueAt ?? '').localeCompare(String(right.dueAt ?? '')))

    const electiveVisible = checkpoint.semesterNumber > 5 || (checkpoint.semesterNumber === 5 && checkpoint.stageKey === 'semester-close')
    const electiveFits = electiveVisible
      ? electiveRows
        .filter(row => row.simulationRunId === checkpoint.simulationRunId)
        .filter(row => isFacultyProofStudentVisible({
          viewerRoleCode,
          visibleViaAssignedMentorScope: relevantStudentIds.has(row.studentId),
          visibleViaOwnedOffering: studentsVisibleViaOwnedOfferings.has(row.studentId),
        }))
        .map(row => {
          const student = studentById.get(row.studentId)
          return {
            electiveRecommendationId: row.electiveRecommendationId,
            studentId: row.studentId,
            studentName: student?.name ?? row.studentId,
            usn: student?.usn ?? '',
            recommendedCode: row.recommendedCode,
            recommendedTitle: row.recommendedTitle,
            stream: row.stream,
            rationale: parseJson(row.rationaleJson, [] as string[]),
            alternatives: parseJson(row.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
            updatedAt: row.updatedAt,
          }
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : []

    return {
      activeRunContexts: [{
        batchId: run.batchId,
        batchLabel: batch?.batchLabel ?? run.batchId,
        branchName: branch?.name ?? null,
        simulationRunId: run.simulationRunId,
        runLabel: run.runLabel,
        status: run.status,
        seed: run.seed,
        createdAt: run.createdAt,
      }],
      selectedCheckpoint: checkpointSummary,
      monitoringQueue: queueItems,
      electiveFits: electiveFits.slice(0, 12),
    }
  }

  const [
    ownershipRows,
    mentorRows,
    batchRows,
    branchRows,
    termRows,
    runRows,
    riskRows,
    reassessmentRows,
    alertRows,
    observedRows,
    electiveRows,
    studentRows,
    offeringRows,
    courseRows,
    overrideRows,
    acknowledgementRows,
    resolutionRows,
  ] = await Promise.all([
    db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, facultyId)),
    db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, facultyId)),
    db.select().from(batches),
    db.select().from(branches),
    db.select().from(academicTerms),
    db.select().from(simulationRuns).where(eq(simulationRuns.activeFlag, 1)),
    db.select().from(riskAssessments),
    db.select().from(reassessmentEvents),
    db.select().from(alertDecisions),
    db.select().from(studentObservedSemesterStates),
    db.select().from(electiveRecommendations),
    db.select().from(students),
    db.select().from(sectionOfferings),
    db.select().from(courses),
    db.select().from(riskOverrides),
    db.select().from(alertAcknowledgements),
    db.select().from(reassessmentResolutions),
  ])

  const activeRunIds = new Set(runRows.map(row => row.simulationRunId))
  const selectedActiveRun = runRows
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.runLabel.localeCompare(right.runLabel))[0] ?? null
  const selectedActiveRunId = selectedActiveRun?.simulationRunId ?? null
  const relevantOfferingIds = new Set(ownershipRows.filter(row => row.status === 'active').map(row => row.offeringId))
  const relevantStudentIds = new Set(mentorRows.filter(row => row.effectiveTo === null).map(row => row.studentId))
  const selectedBatch = selectedActiveRun ? (batchRows.find(row => row.batchId === selectedActiveRun.batchId) ?? null) : null
  const selectedCurrentSemester = selectedBatch?.currentSemester ?? 6
  const selectedActiveTermIds = new Set(
    termRows
      .filter(row => row.batchId === selectedBatch?.batchId)
      .filter(row => row.semesterNumber === selectedCurrentSemester)
      .map(row => row.termId),
  )
  const selectedActiveOfferingIds = new Set(
    offeringRows
      .filter(row => selectedActiveTermIds.size === 0 || selectedActiveTermIds.has(row.termId))
      .map(row => row.offeringId),
  )
  const studentsVisibleViaOwnedOfferings = new Set(
    observedRows
      .filter(row => selectedActiveRunId ? row.simulationRunId === selectedActiveRunId : activeRunIds.has(row.simulationRunId))
      .filter(row => row.semesterNumber === selectedCurrentSemester)
      .flatMap(row => {
        const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
        const offeringId = typeof payload.offeringId === 'string' ? payload.offeringId : null
        return offeringId && selectedActiveOfferingIds.has(offeringId) && relevantOfferingIds.has(offeringId) ? [row.studentId] : []
      }),
  )
  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const batchById = new Map(batchRows.map(row => [row.batchId, row]))
  const branchById = new Map(branchRows.map(row => [row.branchId, row]))
  const termById = new Map(termRows.map(row => [row.termId, row]))
  const observedByStudentOffering = new Map<string, Record<string, unknown>>()
  for (const row of observedRows.filter(row =>
    (selectedActiveRunId ? row.simulationRunId === selectedActiveRunId : activeRunIds.has(row.simulationRunId))
    && row.semesterNumber === selectedCurrentSemester,
  )) {
    const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
    const key = `${row.studentId}::${String(payload.offeringId ?? '')}`
    observedByStudentOffering.set(key, payload)
  }

  const activeRiskRows = riskRows
    .filter(row => selectedActiveRunId ? row.simulationRunId === selectedActiveRunId : activeRunIds.has(row.simulationRunId ?? ''))
    .filter(row => selectedActiveOfferingIds.size === 0 || selectedActiveOfferingIds.has(row.offeringId))
  const activeRiskById = new Map(activeRiskRows.map(row => [row.riskAssessmentId, row]))
  const queueItems = reassessmentRows
    .filter(row => activeRiskById.has(row.riskAssessmentId))
    .filter(row => isOpenReassessmentStatus(row.status))
    .filter(row => isFacultyProofQueueItemVisible({
      viewerRoleCode,
      matchesAssignedStudent: relevantStudentIds.has(row.studentId),
      matchesOwnedOffering: (() => {
        const risk = activeRiskById.get(row.riskAssessmentId)
        return !!risk && relevantOfferingIds.has(risk.offeringId)
      })(),
    }))
    .map(row => {
      const risk = activeRiskById.get(row.riskAssessmentId) ?? null
      if (!risk) return null
      const offering = offeringRows.find(item => item.offeringId === risk.offeringId)
      const course = offering ? courseById.get(offering.courseId) : null
      const term = risk.termId ? termById.get(risk.termId) : null
      const batch = term?.batchId ? batchById.get(term.batchId) : null
      const branch = batch ? branchById.get(batch.branchId) : null
      const student = studentById.get(row.studentId)
      const alert = alertRows.find(item => item.riskAssessmentId === row.riskAssessmentId)
      const evidence = observedByStudentOffering.get(`${row.studentId}::${risk.offeringId}`) ?? {}
      const override = overrideRows.filter(item => item.riskAssessmentId === row.riskAssessmentId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      const acknowledgement = alert ? acknowledgementRows.filter(item => item.alertDecisionId === alert.alertDecisionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null : null
      const resolution = resolutionRows.filter(item => item.reassessmentEventId === row.reassessmentEventId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      return {
        riskAssessmentId: risk.riskAssessmentId,
        simulationRunId: risk.simulationRunId,
        batchId: batch?.batchId ?? null,
        batchLabel: batch?.batchLabel ?? null,
        branchName: branch?.name ?? null,
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        offeringId: risk.offeringId,
        courseCode: course?.courseCode ?? 'NA',
        courseTitle: course?.title ?? 'Untitled course',
        sectionCode: offering?.sectionCode ?? null,
        riskBand: risk.riskBand,
        riskProbScaled: risk.riskProbScaled,
        recommendedAction: risk.recommendedAction,
        drivers: parseJson(risk.driversJson, [] as unknown[]),
        dueAt: row.dueAt ?? null,
        reassessmentStatus: row.status,
        decisionType: alert?.decisionType ?? null,
        decisionNote: alert?.note ?? null,
        observedEvidence: {
          attendancePct: Number(evidence.attendancePct ?? 0),
          tt1Pct: Number(evidence.tt1Pct ?? 0),
          tt2Pct: Number(evidence.tt2Pct ?? 0),
          quizPct: Number(evidence.quizPct ?? 0),
          assignmentPct: Number(evidence.assignmentPct ?? 0),
          seePct: Number(evidence.seePct ?? 0),
          cgpa: Number(evidence.cgpa ?? 0),
          backlogCount: Number(evidence.backlogCount ?? 0),
          weakCoCount: Number(evidence.weakCoCount ?? 0),
          weakQuestionCount: Number((evidence.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
          coEvidenceMode: typeof evidence.coEvidenceMode === 'string' ? evidence.coEvidenceMode : null,
          interventionRecoveryStatus: evidence.interventionResponse && typeof evidence.interventionResponse === 'object'
            ? String((evidence.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
            : null,
        },
        override: override ? {
          overrideBand: override.overrideBand,
          overrideNote: override.overrideNote,
          createdAt: override.createdAt,
        } : null,
        acknowledgement: acknowledgement ? {
          status: acknowledgement.status,
          note: acknowledgement.note,
          createdAt: acknowledgement.createdAt,
        } : null,
        resolution: resolution ? {
          resolutionStatus: resolution.resolutionStatus,
          note: resolution.note,
          createdAt: resolution.createdAt,
        } : null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => (right.riskProbScaled - left.riskProbScaled) || String(left.dueAt ?? '').localeCompare(String(right.dueAt ?? '')))

  const electiveFits = electiveRows
    .filter(row => selectedActiveRunId ? row.simulationRunId === selectedActiveRunId : activeRunIds.has(row.simulationRunId ?? ''))
    .filter(row => isFacultyProofStudentVisible({
      viewerRoleCode,
      visibleViaAssignedMentorScope: relevantStudentIds.has(row.studentId),
      visibleViaOwnedOffering: studentsVisibleViaOwnedOfferings.has(row.studentId),
    }))
    .map(row => {
      const student = studentById.get(row.studentId)
      return {
        electiveRecommendationId: row.electiveRecommendationId,
        studentId: row.studentId,
        studentName: student?.name ?? row.studentId,
        usn: student?.usn ?? '',
        recommendedCode: row.recommendedCode,
        recommendedTitle: row.recommendedTitle,
        stream: row.stream,
        rationale: parseJson(row.rationaleJson, [] as string[]),
        alternatives: parseJson(row.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
        updatedAt: row.updatedAt,
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  const activeRunContexts = runRows.map(run => {
    const batch = batchById.get(run.batchId)
    const branch = batch ? branchById.get(batch.branchId) : null
    return {
      batchId: run.batchId,
      batchLabel: batch?.batchLabel ?? run.batchId,
      branchName: branch?.name ?? null,
      simulationRunId: run.simulationRunId,
      runLabel: run.runLabel,
      status: run.status,
      seed: run.seed,
      createdAt: run.createdAt,
    }
  })

  return {
    activeRunContexts,
    selectedCheckpoint: null,
    monitoringQueue: queueItems,
    electiveFits: electiveFits.slice(0, 12),
  }
}

export async function getProofStudentEvidenceTimeline(db: AppDb, input: {
  simulationRunId: string
  studentId: string
}) {
  const rows = await db.select().from(studentObservedSemesterStates).where(and(
    eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId),
    eq(studentObservedSemesterStates.studentId, input.studentId),
  )).orderBy(asc(studentObservedSemesterStates.semesterNumber), asc(studentObservedSemesterStates.createdAt))

  return buildEvidenceTimelineFromRows(rows)
}

function sortValueDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValueDeep)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValueDeep(child)]),
  )
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortValueDeep(value))
}

function hashSnapshot(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function buildDeterministicId(prefix: string, parts: Array<string | number>) {
  return `${prefix}_${createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 24)}`
}

function latestByUpdatedAt<T extends { updatedAt: string }>(rows: T[]) {
  return rows.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}

function summarizeTopicBuckets(rows: Array<typeof studentTopicStates.$inferSelect>) {
  const known: string[] = []
  const partial: string[] = []
  const blocked: string[] = []
  const highUncertainty: string[] = []
  rows
    .slice()
    .sort((left, right) => left.topicName.localeCompare(right.topicName))
    .forEach(row => {
      const state = parseJson(row.stateJson, {} as Record<string, unknown>)
      const mastery = Number(state.mastery ?? 0)
      const retention = Number(state.retention ?? 0)
      const prerequisiteDebt = Number(state.prerequisiteDebt ?? 0)
      const uncertainty = Number(state.uncertainty ?? 0)
      if (uncertainty >= 0.5) highUncertainty.push(row.topicName)
      if (mastery >= 0.7 && retention >= 0.65 && prerequisiteDebt < 0.25) {
        known.push(row.topicName)
      } else if (mastery < 0.45 || prerequisiteDebt >= 0.5) {
        blocked.push(row.topicName)
      } else {
        partial.push(row.topicName)
      }
    })
  return {
    known: known.slice(0, 8),
    partial: partial.slice(0, 8),
    blocked: blocked.slice(0, 8),
    highUncertainty: highUncertainty.slice(0, 8),
  }
}

function summarizeCoRows(rows: Array<typeof studentCoStates.$inferSelect>) {
  return rows
    .map(row => {
      const state = parseJson(row.stateJson, {} as Record<string, unknown>)
      const scoreHistory = parseJson(
        JSON.stringify(state.coObservedScoreHistory ?? {}),
        { tt1Pct: 0, tt2Pct: 0, seePct: 0 },
      ) as { tt1Pct: number; tt2Pct: number; seePct: number }
      return {
        coCode: row.coCode,
        coTitle: row.coTitle,
        trend: String(state.coTrend ?? 'flat'),
        topics: parseJson(JSON.stringify(state.topics ?? []), [] as string[]),
        evidenceMode: String(state.coEvidenceMode ?? 'fallback-simulated'),
        tt1Pct: Number(scoreHistory.tt1Pct ?? 0),
        tt2Pct: Number(scoreHistory.tt2Pct ?? 0),
        seePct: Number(scoreHistory.seePct ?? 0),
        transferGap: Number(state.coTransferGap ?? 0),
      }
    })
    .sort((left, right) => {
      const leftStrength = Math.min(left.tt2Pct, left.seePct)
      const rightStrength = Math.min(right.tt2Pct, right.seePct)
      return leftStrength - rightStrength || left.coCode.localeCompare(right.coCode)
    })
}

function dominantCoEvidenceMode(rows: Array<typeof studentCoStates.$inferSelect>) {
  const counts = new Map<string, number>()
  rows.forEach(row => {
    const state = parseJson(row.stateJson, {} as Record<string, unknown>)
    const mode = String(state.coEvidenceMode ?? 'fallback-simulated')
    counts.set(mode, (counts.get(mode) ?? 0) + 1)
  })
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'fallback-simulated'
}

type ProofRiskInferenceContext = {
  featurePayload: ObservableFeaturePayload | null
  sourceRefs: ObservableSourceRefs | null
  featureSchemaVersion: string | null
  evidenceWindow: string | null
  inferred: ModelBackedRiskOutput | null
  fallbackOverallHeadDisplay: {
    displayProbabilityAllowed: boolean
    supportWarning: string | null
    calibrationMethod: string
  } | null
}

async function loadProofRiskInferenceContext(db: AppDb, input: {
  batchId: string
  simulationRunId: string
  simulationStageCheckpointId?: string | null
  studentId: string
  primaryCourseCode?: string | null
}): Promise<ProofRiskInferenceContext> {
  const activeArtifacts = await loadActiveProofRiskArtifacts(db, input.batchId)

  let featurePayload: ObservableFeaturePayload | null = null
  let sourceRefs: ObservableSourceRefs | null = null
  let featureSchemaVersion: string | null = null
  let evidenceWindow: string | null = null

  if (input.simulationStageCheckpointId) {
    const stageRows = await db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, input.studentId),
    ))
    const primaryStageRow = stageRows
      .slice()
      .sort((left, right) => {
        const leftPayload = parseJson(left.projectionJson, {} as Record<string, unknown>)
        const rightPayload = parseJson(right.projectionJson, {} as Record<string, unknown>)
        const leftGovernance = (leftPayload.governance ?? {}) as Record<string, unknown>
        const rightGovernance = (rightPayload.governance ?? {}) as Record<string, unknown>
        const leftPrimaryCase = leftGovernance.primaryCase === true
        const rightPrimaryCase = rightGovernance.primaryCase === true
        if (leftPrimaryCase !== rightPrimaryCase) return Number(rightPrimaryCase) - Number(leftPrimaryCase)
        const leftCountsTowardCapacity = leftGovernance.countsTowardCapacity === true
        const rightCountsTowardCapacity = rightGovernance.countsTowardCapacity === true
        if (leftCountsTowardCapacity !== rightCountsTowardCapacity) {
          return Number(rightCountsTowardCapacity) - Number(leftCountsTowardCapacity)
        }
        const leftRank = Number.isFinite(Number(leftGovernance.priorityRank)) ? Number(leftGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
        const rightRank = Number.isFinite(Number(rightGovernance.priorityRank)) ? Number(rightGovernance.priorityRank) : Number.MAX_SAFE_INTEGER
        if (leftRank !== rightRank) return leftRank - rightRank
        return (right.riskProbScaled - left.riskProbScaled) || left.courseCode.localeCompare(right.courseCode)
      })[0] ?? null
    const stagePayload = primaryStageRow
      ? parseJson(primaryStageRow.projectionJson, {} as Record<string, unknown>)
      : {}
    const evidenceSnapshotId = typeof stagePayload.evidenceSnapshotId === 'string'
      ? stagePayload.evidenceSnapshotId
      : null
    if (evidenceSnapshotId) {
      const [evidenceRow] = await db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.riskEvidenceSnapshotId, evidenceSnapshotId))
      if (evidenceRow) {
        featurePayload = parseJson(evidenceRow.featureJson, null as ObservableFeaturePayload | null)
        sourceRefs = parseJson(evidenceRow.sourceRefsJson, null as ObservableSourceRefs | null)
        featureSchemaVersion = evidenceRow.featureSchemaVersion
        evidenceWindow = evidenceRow.evidenceWindow
      }
    }
  } else {
    const evidenceRows = await db.select().from(riskEvidenceSnapshots).where(and(
      eq(riskEvidenceSnapshots.simulationRunId, input.simulationRunId),
      eq(riskEvidenceSnapshots.studentId, input.studentId),
    ))
    const activeEvidenceRow = evidenceRows.find(row => (
      row.simulationStageCheckpointId === null
      && (!input.primaryCourseCode || row.courseCode === input.primaryCourseCode)
    )) ?? evidenceRows.find(row => row.simulationStageCheckpointId === null) ?? null
    if (activeEvidenceRow) {
      featurePayload = parseJson(activeEvidenceRow.featureJson, null as ObservableFeaturePayload | null)
      sourceRefs = parseJson(activeEvidenceRow.sourceRefsJson, null as ObservableSourceRefs | null)
      featureSchemaVersion = activeEvidenceRow.featureSchemaVersion
      evidenceWindow = activeEvidenceRow.evidenceWindow
    }
  }

  const inferred = featurePayload
    ? scoreObservableRiskWithModel({
      attendancePct: featurePayload.attendancePct,
      currentCgpa: featurePayload.currentCgpa,
      backlogCount: featurePayload.backlogCount,
      tt1Pct: featurePayload.tt1Pct,
      tt2Pct: featurePayload.tt2Pct,
      quizPct: featurePayload.quizPct,
      assignmentPct: featurePayload.assignmentPct,
      seePct: featurePayload.seePct,
      weakCoCount: featurePayload.weakCoCount,
      attendanceHistoryRiskCount: featurePayload.attendanceHistoryRiskCount,
      questionWeaknessCount: featurePayload.weakQuestionCount,
      interventionResponseScore: featurePayload.interventionResponseScore,
      policy: DEFAULT_POLICY,
      featurePayload,
      sourceRefs,
      productionModel: activeArtifacts.production,
      correlations: activeArtifacts.correlations,
    })
    : null

  return {
    featurePayload,
    sourceRefs,
    featureSchemaVersion,
    evidenceWindow,
    inferred,
    fallbackOverallHeadDisplay: activeArtifacts.production ? {
      displayProbabilityAllowed: activeArtifacts.production.heads.overallCourseRisk.calibration.displayProbabilityAllowed,
      supportWarning: activeArtifacts.production.heads.overallCourseRisk.calibration.supportWarning,
      calibrationMethod: activeArtifacts.production.heads.overallCourseRisk.calibration.method,
    } : null,
  }
}

function summarizeQuestionPatterns(input: {
  rows: Array<typeof studentQuestionResults.$inferSelect>
  templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
}) {
  const weakTopicCounts = new Map<string, number>()
  const weakCoCounts = new Map<string, number>()
  let weakQuestionCount = 0
  let carelessErrorCount = 0
  let transferGapCount = 0

  input.rows.forEach(row => {
    const result = parseJson(row.resultJson, {} as Record<string, unknown>)
    const template = input.templatesById.get(row.simulationQuestionTemplateId)
    const score = Number(result.studentScoreOnQuestion ?? row.score)
    const maxScore = Number(row.maxScore)
    const errorType = String(result.errorTypeObserved ?? 'clean')
    if (errorType === 'careless-error') carelessErrorCount += 1
    if (errorType === 'transfer-gap') transferGapCount += 1
    if (maxScore > 0 && (score / maxScore) < 0.4) {
      weakQuestionCount += 1
      const topics = parseJson(template?.topicTagsJson ?? '[]', [] as string[])
      const cos = parseJson(template?.coTagsJson ?? '[]', [] as string[])
      topics.forEach(topic => weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1))
      cos.forEach(coCode => weakCoCounts.set(coCode, (weakCoCounts.get(coCode) ?? 0) + 1))
    }
  })

  const rankMap = (source: Map<string, number>) => [...source.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([label]) => label)

  return {
    weakQuestionCount,
    carelessErrorCount,
    transferGapCount,
    commonWeakTopics: rankMap(weakTopicCounts),
    commonWeakCourseOutcomes: rankMap(weakCoCounts),
  }
}

function buildStudentAgentCitations(input: {
  currentEvidence: StudentAgentCardPayload['overview']['currentEvidence']
  currentStatus: StudentAgentCardPayload['overview']['currentStatus']
  topicBuckets: StudentAgentCardPayload['topicAndCo']['topicBuckets']
  weakCourseOutcomes: StudentAgentCardPayload['topicAndCo']['weakCourseOutcomes']
  questionPatterns: StudentAgentCardPayload['topicAndCo']['questionPatterns']
  interventionHistory: StudentAgentCardPayload['interventions']['interventionHistory']
  reassessments: StudentAgentCardPayload['interventions']['currentReassessments']
  electiveFit: StudentAgentCardPayload['summaryRail']['electiveFit']
  semesterSummaries: StudentAgentCardPayload['overview']['semesterSummaries']
}): StudentAgentCitation[] {
  return [
    {
      citationId: 'observed-current-evidence',
      label: 'Current observed evidence',
      panelLabel: 'Observed',
      summary: `Attendance ${Math.round(input.currentEvidence.attendancePct)}%, TT1 ${Math.round(input.currentEvidence.tt1Pct)}%, TT2 ${Math.round(input.currentEvidence.tt2Pct)}%, quiz ${Math.round(input.currentEvidence.quizPct)}%, assignment ${Math.round(input.currentEvidence.assignmentPct)}%, SEE ${Math.round(input.currentEvidence.seePct)}%.`,
    },
    {
      citationId: 'policy-current-status',
      label: 'Current policy-derived watch status',
      panelLabel: 'Policy Derived',
      summary: `${input.currentStatus.riskBand ?? 'Unavailable'} watch${input.currentStatus.reassessmentStatus ? `, reassessment ${input.currentStatus.reassessmentStatus}` : ''}${input.currentStatus.nextDueAt ? `, next due ${input.currentStatus.nextDueAt}` : ''}.`,
    },
    {
      citationId: 'simulation-topic-buckets',
      label: 'Current topic buckets',
      panelLabel: 'Simulation Internal',
      summary: `Known ${input.topicBuckets.known.length}, partial ${input.topicBuckets.partial.length}, blocked ${input.topicBuckets.blocked.length}, high uncertainty ${input.topicBuckets.highUncertainty.length}.`,
    },
    {
      citationId: 'simulation-co-summary',
      label: 'Current course-outcome summary',
      panelLabel: 'Simulation Internal',
      summary: input.weakCourseOutcomes.length > 0
        ? `${input.weakCourseOutcomes.slice(0, 3).map(item => `${item.coCode} ${Math.round(item.tt2Pct)}%/${Math.round(item.seePct)}%`).join(' · ')}.`
        : 'No current weak course-outcome signals are stored on the active card.',
    },
    {
      citationId: 'observed-question-patterns',
      label: 'Question pattern summary',
      panelLabel: 'Observed',
      summary: `${input.questionPatterns.weakQuestionCount} weak questions, ${input.questionPatterns.carelessErrorCount} careless-error signals, ${input.questionPatterns.transferGapCount} transfer-gap signals.`,
    },
    {
      citationId: 'action-interventions',
      label: 'Intervention history',
      panelLabel: 'Human Action Log',
      summary: input.interventionHistory.length > 0
        ? input.interventionHistory.slice(0, 3).map(item => `${item.interventionType} on ${item.occurredAt.slice(0, 10)}`).join(' · ')
        : 'No intervention events are currently stored on this proof card.',
    },
    {
      citationId: 'action-reassessments',
      label: 'Reassessment log',
      panelLabel: 'Human Action Log',
      summary: input.reassessments.length > 0
        ? input.reassessments.slice(0, 3).map(item => `${item.courseCode} ${item.status}`).join(' · ')
        : 'No active reassessment entries are currently linked to this proof card.',
    },
    {
      citationId: 'policy-elective-fit',
      label: 'Elective-fit recommendation',
      panelLabel: 'Policy Derived',
      summary: input.electiveFit
        ? `${input.electiveFit.recommendedCode} ${input.electiveFit.recommendedTitle} in ${input.electiveFit.stream}.`
        : 'No elective-fit recommendation is currently available.',
    },
    {
      citationId: 'observed-semester-timeline',
      label: 'Semester evidence timeline',
      panelLabel: 'Observed',
      summary: input.semesterSummaries.length > 0
        ? input.semesterSummaries.map(item => `S${item.semesterNumber}: SGPA ${item.sgpa.toFixed(2)}, backlogs ${item.backlogCount}`).join(' · ')
        : 'No semester evidence timeline is currently available.',
    },
    {
      citationId: 'guardrail-scope',
      label: 'Shell guardrail boundary',
      panelLabel: 'Policy Derived',
      summary: 'This shell explains the current proof record only. It cannot predict future certainty, override grades or eligibility, or expose hidden world-engine internals.',
    },
  ]
}

function citationMapById(citations: StudentAgentCitation[]) {
  return new Map(citations.map(citation => [citation.citationId, citation]))
}

function selectCitations(citationById: Map<string, StudentAgentCitation>, citationIds: string[]) {
  return citationIds
    .map(citationId => citationById.get(citationId))
    .filter((citation): citation is StudentAgentCitation => !!citation)
}

function buildIntroShellMessage(now: string, citationById: Map<string, StudentAgentCitation>): Omit<StudentAgentMessage, 'studentAgentMessageId'> {
  return {
    actorType: 'assistant',
    messageType: 'intro',
    body: 'Student shell is active in deterministic mode. Ask about current semester performance, weak topics or course outcomes, reassessment status, intervention history, elective fit, or compare two semesters.',
    citations: selectCitations(citationById, ['guardrail-scope', 'observed-current-evidence', 'observed-semester-timeline']),
    guardrailCode: null,
    createdAt: now,
    updatedAt: now,
  }
}

function classifyStudentAgentPrompt(prompt: string) {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return { kind: 'blocked', guardrailCode: 'empty-prompt' } as const
  if (/\b(override|change|edit|update|set)\b/.test(normalized) && /\b(grade|risk|eligibility|reassessment)\b/.test(normalized)) {
    return { kind: 'blocked', guardrailCode: 'no-overrides' } as const
  }
  if (/\b(will|guarantee|definitely|certain|surely|future|next semester|next term|predict)\b/.test(normalized)) {
    return { kind: 'blocked', guardrailCode: 'no-future-certainty' } as const
  }
  if (/\b(other student|another student|someone else|compare with .*student)\b/.test(normalized)) {
    return { kind: 'blocked', guardrailCode: 'cross-student-disclosure' } as const
  }
  if (/\b(seed|coefficient|hidden|latent numeric|raw world|random|generator)\b/.test(normalized)) {
    return { kind: 'blocked', guardrailCode: 'hidden-internals' } as const
  }
  if (/\b(no action|without support|without intervention|counterfactual)\b/.test(normalized)) {
    return { kind: 'no-action-comparator' } as const
  }
  const semesterMatches = [...normalized.matchAll(/\bsemester\s*(\d)\b/g)].map(match => Number(match[1])).filter(Number.isFinite)
  if (semesterMatches.length >= 2 || /\bcompare\b/.test(normalized)) {
    return { kind: 'compare-semesters', semesterNumbers: semesterMatches.slice(0, 2) } as const
  }
  if (/\b(elective|recommend|fit|stream)\b/.test(normalized)) return { kind: 'elective-fit' } as const
  if (/\b(reassessment|due|watch|alert|status)\b/.test(normalized)) return { kind: 'reassessment-status' } as const
  if (/\b(intervention|bridge|tutoring|mentor|support|coaching)\b/.test(normalized)) return { kind: 'intervention-history' } as const
  if (/\b(topic|topics|co\b|course outcome|weak|misconception|question pattern)\b/.test(normalized)) return { kind: 'topic-and-co' } as const
  return { kind: 'current-performance' } as const
}

function buildGuardrailReply(input: {
  guardrailCode: string
  now: string
  citationById: Map<string, StudentAgentCitation>
}) {
  const bodyByCode: Record<string, string> = {
    'empty-prompt': 'Student shell can answer only bounded questions about the current proof record. Ask about current performance, weak topics or COs, reassessment status, intervention history, elective fit, or compare two semesters.',
    'no-overrides': 'Student shell is read-only. It cannot change grades, risk bands, eligibility, reassessment state, or any other policy-derived record.',
    'no-future-certainty': 'Student shell does not make future-certainty claims. It can explain the current proof record and the observed trajectory, but it cannot guarantee future grades or outcomes.',
    'cross-student-disclosure': 'Student shell is scoped to one student card at a time. It cannot disclose or compare another student’s record.',
    'hidden-internals': 'Student shell does not expose hidden generator coefficients, seeds, or raw world-context internals. It only renders the bounded card summary.',
  }
  return {
    actorType: 'assistant',
    messageType: 'guardrail',
    body: bodyByCode[input.guardrailCode] ?? bodyByCode['empty-prompt'],
    citations: selectCitations(input.citationById, ['guardrail-scope']),
    guardrailCode: input.guardrailCode,
    createdAt: input.now,
    updatedAt: input.now,
  } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
}

function buildAssistantReply(input: {
  prompt: string
  card: StudentAgentCardPayload
}) {
  const classification = classifyStudentAgentPrompt(input.prompt)
  const citationById = citationMapById(input.card.citations)
  if (classification.kind === 'blocked') {
    return buildGuardrailReply({
      guardrailCode: classification.guardrailCode,
      now: new Date().toISOString(),
      citationById,
    })
  }

  const current = input.card.overview.currentEvidence
  const status = input.card.overview.currentStatus
  if (classification.kind === 'current-performance') {
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: `Current observed evidence shows attendance at ${Math.round(current.attendancePct)}%, TT1 at ${Math.round(current.tt1Pct)}%, TT2 at ${Math.round(current.tt2Pct)}%, quiz at ${Math.round(current.quizPct)}%, assignment at ${Math.round(current.assignmentPct)}%, and SEE at ${Math.round(current.seePct)}%. The current watch status is ${status.riskBand ?? 'unavailable'}${status.riskProbScaled != null ? ` at ${status.riskProbScaled}%` : ''}${status.reassessmentStatus ? `, with reassessment ${status.reassessmentStatus}` : ''}.`,
      citations: selectCitations(citationById, ['observed-current-evidence', 'policy-current-status']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }
  if (classification.kind === 'topic-and-co') {
    const weakCos = input.card.topicAndCo.weakCourseOutcomes.slice(0, 3)
    const blockedTopics = input.card.topicAndCo.topicBuckets.blocked.slice(0, 4)
    const partialTopics = input.card.topicAndCo.topicBuckets.partial.slice(0, 4)
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: `The card shows blocked topics in ${blockedTopics.join(', ') || 'none recorded'} and partial topics in ${partialTopics.join(', ') || 'none recorded'}. The weakest current course outcomes are ${weakCos.map(item => `${item.coCode} (${Math.round(item.tt2Pct)}% TT2, ${Math.round(item.seePct)}% SEE, ${item.trend})`).join('; ') || 'none recorded on the active card'}.`,
      citations: selectCitations(citationById, ['simulation-topic-buckets', 'simulation-co-summary', 'observed-question-patterns']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }
  if (classification.kind === 'reassessment-status') {
    const reassessments = input.card.interventions.currentReassessments
    const next = reassessments[0]
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: next
        ? `The current reassessment status is ${next.status} for ${next.courseCode} ${next.courseTitle}, assigned to ${next.assignedToRole}, due at ${next.dueAt}. The shell keeps the student on watch until later evidence confirms recovery.`
        : 'There is no open reassessment linked to this card right now. The current watch context is still shown in the policy-derived status panel.',
      citations: selectCitations(citationById, ['policy-current-status', 'action-reassessments']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }
  if (classification.kind === 'intervention-history') {
    const history = input.card.interventions.interventionHistory.slice(0, 3)
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: history.length > 0
        ? `Recent intervention history includes ${history.map(item => `${item.interventionType} on ${item.occurredAt.slice(0, 10)}${item.completed === true ? ' completed' : item.completed === false ? ' not completed' : ''}${item.recoveryConfirmed === true ? ', recovery confirmed' : item.recoveryConfirmed === false ? ', recovery still under watch' : ''}`).join('; ')}.`
        : 'No intervention history is stored on this card at the moment.',
      citations: selectCitations(citationById, ['action-interventions', 'action-reassessments']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }
  if (classification.kind === 'elective-fit') {
    const elective = input.card.summaryRail.electiveFit
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: elective
        ? `The current elective fit points to ${elective.recommendedCode} ${elective.recommendedTitle} in the ${elective.stream} stream. The recorded rationale is ${elective.rationale.slice(0, 3).join('; ') || 'observed performance and prerequisite fit'}.`
        : 'No elective recommendation is stored on the current card.',
      citations: selectCitations(citationById, ['policy-elective-fit', 'observed-semester-timeline']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }
  if (classification.kind === 'no-action-comparator') {
    const comparator = input.card.counterfactual
    return {
      actorType: 'assistant',
      messageType: 'answer',
      body: comparator
        ? `For the current checkpoint, the bounded no-action comparator stays at ${comparator.noActionRiskBand ?? 'unavailable'}${comparator.noActionRiskProbScaled != null ? ` (${comparator.noActionRiskProbScaled}%)` : ''}. The counterfactual lift of the simulated action path over no-action is ${comparator.counterfactualLiftScaled ?? 0} scaled points.`
        : 'No checkpoint-bound no-action comparator is available on this card. Counterfactual comparison is only shown for checkpoint-bound playback cards.',
      citations: selectCitations(citationById, ['policy-current-status', 'guardrail-scope']),
      guardrailCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
  }

  const semesterNumbers = classification.semesterNumbers.length >= 2
    ? classification.semesterNumbers.slice(0, 2)
    : [1, input.card.student.currentSemester]
  const left = input.card.overview.semesterSummaries.find(item => item.semesterNumber === semesterNumbers[0]) ?? input.card.overview.semesterSummaries[0]
  const right = input.card.overview.semesterSummaries.find(item => item.semesterNumber === semesterNumbers[1]) ?? input.card.overview.semesterSummaries[input.card.overview.semesterSummaries.length - 1]
  return {
    actorType: 'assistant',
    messageType: 'answer',
    body: left && right
      ? `Semester ${left.semesterNumber} recorded SGPA ${left.sgpa.toFixed(2)}, backlog count ${left.backlogCount}, and risk bands ${left.riskBands.join(', ') || 'none'}. Semester ${right.semesterNumber} recorded SGPA ${right.sgpa.toFixed(2)}, backlog count ${right.backlogCount}, and risk bands ${right.riskBands.join(', ') || 'none'}.`
      : 'The card does not contain enough semester evidence to compare those semesters.',
    citations: selectCitations(citationById, ['observed-semester-timeline']),
    guardrailCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies Omit<StudentAgentMessage, 'studentAgentMessageId'>
}

export async function buildStudentAgentCard(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}) {
  const [
    run,
    student,
    behaviorProfile,
    observedRows,
    riskRows,
    topicRows,
    coRows,
    questionRows,
    responseRows,
    electiveRows,
    interventionRows,
    reassessmentRows,
    resolutionRows,
    offeringRows,
    courseRows,
    termRows,
    batchRows,
    branchRows,
    templateRows,
    stageCheckpoint,
    stageStudentRows,
    stageQueueRows,
  ] = await Promise.all([
    db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId)).then(rows => rows[0] ?? null),
    db.select().from(students).where(eq(students.studentId, input.studentId)).then(rows => rows[0] ?? null),
    db.select().from(studentBehaviorProfiles).where(and(
      eq(studentBehaviorProfiles.simulationRunId, input.simulationRunId),
      eq(studentBehaviorProfiles.studentId, input.studentId),
    )).then(rows => rows[0] ?? null),
    db.select().from(studentObservedSemesterStates).where(and(
      eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId),
      eq(studentObservedSemesterStates.studentId, input.studentId),
    )).orderBy(asc(studentObservedSemesterStates.semesterNumber), asc(studentObservedSemesterStates.createdAt)),
    db.select().from(riskAssessments).where(and(
      eq(riskAssessments.simulationRunId, input.simulationRunId),
      eq(riskAssessments.studentId, input.studentId),
    )),
    db.select().from(studentTopicStates).where(and(
      eq(studentTopicStates.simulationRunId, input.simulationRunId),
      eq(studentTopicStates.studentId, input.studentId),
    )),
    db.select().from(studentCoStates).where(and(
      eq(studentCoStates.simulationRunId, input.simulationRunId),
      eq(studentCoStates.studentId, input.studentId),
    )),
    db.select().from(studentQuestionResults).where(and(
      eq(studentQuestionResults.simulationRunId, input.simulationRunId),
      eq(studentQuestionResults.studentId, input.studentId),
    )),
    db.select().from(studentInterventionResponseStates).where(and(
      eq(studentInterventionResponseStates.simulationRunId, input.simulationRunId),
      eq(studentInterventionResponseStates.studentId, input.studentId),
    )),
    db.select().from(electiveRecommendations).where(and(
      eq(electiveRecommendations.simulationRunId, input.simulationRunId),
      eq(electiveRecommendations.studentId, input.studentId),
    )),
    db.select().from(studentInterventions).where(eq(studentInterventions.studentId, input.studentId)),
    db.select().from(reassessmentEvents).where(eq(reassessmentEvents.studentId, input.studentId)),
    db.select().from(reassessmentResolutions),
    db.select().from(sectionOfferings),
    db.select().from(courses),
    db.select().from(academicTerms),
    db.select().from(batches),
    db.select().from(branches),
    db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, input.simulationRunId)),
    input.simulationStageCheckpointId
      ? db.select().from(simulationStageCheckpoints).where(and(
          eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId),
          eq(simulationStageCheckpoints.simulationStageCheckpointId, input.simulationStageCheckpointId),
        )).then(rows => rows[0] ?? null)
      : Promise.resolve(null),
    input.simulationStageCheckpointId
      ? db.select().from(simulationStageStudentProjections).where(and(
          eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId),
          eq(simulationStageStudentProjections.studentId, input.studentId),
          eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
        ))
      : Promise.resolve([]),
    input.simulationStageCheckpointId
      ? db.select().from(simulationStageQueueProjections).where(and(
          eq(simulationStageQueueProjections.simulationRunId, input.simulationRunId),
          eq(simulationStageQueueProjections.studentId, input.studentId),
          eq(simulationStageQueueProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
        ))
      : Promise.resolve([]),
  ])

  if (!run) throw new Error(`Simulation run ${input.simulationRunId} was not found`)
  if (!student) throw new Error(`Student ${input.studentId} was not found`)
  if (input.simulationStageCheckpointId && !stageCheckpoint) {
    throw new Error(`Simulation stage checkpoint ${input.simulationStageCheckpointId} was not found`)
  }

  const batch = batchRows.find(row => row.batchId === run.batchId) ?? null
  const branch = batch ? (branchRows.find(row => row.branchId === batch.branchId) ?? null) : null
  const currentSemester = stageCheckpoint?.semesterNumber
    ?? behaviorProfile?.currentSemester
    ?? batch?.currentSemester
    ?? Math.max(1, ...observedRows.map(row => row.semesterNumber))
  const evidenceTimeline = buildEvidenceTimelineFromRows(observedRows)
  const currentSemesterRows = observedRows.filter(row => row.semesterNumber === currentSemester)
  const riskIds = new Set(riskRows.map(row => row.riskAssessmentId))
  const relevantReassessments = reassessmentRows
    .filter(row => riskIds.has(row.riskAssessmentId))
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
  const riskSortRank = (row: typeof riskRows[number]) => {
    const reassessment = relevantReassessments.find(item => item.riskAssessmentId === row.riskAssessmentId) ?? null
    return reassessment && isOpenReassessmentStatus(reassessment.status) ? 2 : reassessment ? 1 : 0
  }
  const stageProjectionGovernance = (row: typeof stageStudentRows[number]) => {
    const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
    const governance = (payload.governance ?? {}) as Record<string, unknown>
    return {
      primaryCase: governance.primaryCase === true,
      countsTowardCapacity: governance.countsTowardCapacity === true,
      priorityRank: Number.isFinite(Number(governance.priorityRank)) ? Number(governance.priorityRank) : Number.MAX_SAFE_INTEGER,
    }
  }
  const sortedRiskRows = riskRows.slice().sort((left, right) => {
    const rankDelta = riskSortRank(right) - riskSortRank(left)
    if (rankDelta !== 0) return rankDelta
    return (right.riskProbScaled - left.riskProbScaled) || left.offeringId.localeCompare(right.offeringId)
  })
  const sortedStageRows = stageStudentRows.slice().sort((left, right) => {
    const leftGovernance = stageProjectionGovernance(left)
    const rightGovernance = stageProjectionGovernance(right)
    if (leftGovernance.primaryCase !== rightGovernance.primaryCase) return Number(rightGovernance.primaryCase) - Number(leftGovernance.primaryCase)
    if (leftGovernance.countsTowardCapacity !== rightGovernance.countsTowardCapacity) return Number(rightGovernance.countsTowardCapacity) - Number(leftGovernance.countsTowardCapacity)
    if (leftGovernance.priorityRank !== rightGovernance.priorityRank) return leftGovernance.priorityRank - rightGovernance.priorityRank
    return (right.riskProbScaled - left.riskProbScaled) || left.courseCode.localeCompare(right.courseCode)
  })
  const primaryRisk = sortedRiskRows[0] ?? null
  const primaryStageProjection = sortedStageRows[0] ?? null
  const primaryOffering = stageCheckpoint
    ? (primaryStageProjection?.offeringId ? offeringRows.find(row => row.offeringId === primaryStageProjection.offeringId) ?? null : null)
    : primaryRisk
      ? offeringRows.find(row => row.offeringId === primaryRisk.offeringId) ?? null
      : null
  const primaryCourse = primaryOffering
    ? courseRows.find(row => row.courseId === primaryOffering.courseId) ?? null
    : stageCheckpoint && primaryStageProjection
      ? { courseId: primaryStageProjection.offeringId ?? primaryStageProjection.courseCode, courseCode: primaryStageProjection.courseCode, title: primaryStageProjection.courseTitle } as typeof courseRows[number]
      : null
  const currentObservedState = primaryOffering
    ? latestByUpdatedAt(currentSemesterRows.filter(row => {
        const payload = parseJson(row.observedStateJson, {} as Record<string, unknown>)
        return payload.offeringId === primaryOffering.offeringId
      }))
    : latestByUpdatedAt(currentSemesterRows)
  const currentObservedPayload = currentObservedState ? parseJson(currentObservedState.observedStateJson, {} as Record<string, unknown>) : {}
  const currentTopicRows = topicRows
    .filter(row => row.semesterNumber === currentSemester)
    .filter(row => !primaryOffering || row.offeringId === primaryOffering.offeringId)
  const currentCoRows = coRows
    .filter(row => row.semesterNumber === currentSemester)
    .filter(row => !primaryOffering || row.offeringId === primaryOffering.offeringId)
  const currentQuestionRows = questionRows
    .filter(row => row.semesterNumber === currentSemester)
    .filter(row => !primaryOffering || row.offeringId === primaryOffering.offeringId)
  const templatesById = new Map(templateRows.map(row => [row.simulationQuestionTemplateId, row]))
  let questionPatterns: StudentAgentCardPayload['topicAndCo']['questionPatterns'] = summarizeQuestionPatterns({
    rows: currentQuestionRows,
    templatesById,
  })
  let weakCourseOutcomes: StudentAgentCardPayload['topicAndCo']['weakCourseOutcomes'] = summarizeCoRows(currentCoRows)
    .filter(row => row.tt2Pct < 50 || row.seePct < 45 || row.transferGap < -0.04)
    .slice(0, 6)
  const topicBuckets = summarizeTopicBuckets(currentTopicRows)
  const latestElective = latestByUpdatedAt(electiveRows)
  const responseByInterventionId = new Map(
    responseRows
      .filter(row => typeof row.interventionId === 'string' && row.interventionId.length > 0)
      .map(row => [String(row.interventionId), row]),
  )
  const interventionHistory: StudentAgentCardPayload['interventions']['interventionHistory'] = interventionRows
    .filter(row => {
      if (!row.offeringId) return true
      return offeringRows.some(offering => offering.offeringId === row.offeringId)
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 10)
    .map(row => {
      const responseRow = responseByInterventionId.get(row.interventionId) ?? responseRows
        .filter(item => item.interventionId === row.interventionId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      const responseState = responseRow ? parseJson(responseRow.responseStateJson, {} as Record<string, unknown>) : {}
      const recoveryState: ProofRecoveryState = interventionRecoveryConfirmedFromResponseState(responseState) === true
        ? 'confirmed_improvement'
        : 'under_watch'
      return {
        interventionId: row.interventionId,
        interventionType: row.interventionType,
        note: row.note,
        occurredAt: row.occurredAt,
        accepted: interventionAcceptedFromResponseState(responseState),
        completed: interventionCompletedFromResponseState(responseState),
        recoveryConfirmed: interventionRecoveryConfirmedFromResponseState(responseState),
        recoveryState,
        observedResidual: interventionObservedResidualFromResponseState(responseState),
      }
    })
  const relevantResolutionRows = resolutionRows.filter(row =>
    relevantReassessments.some(reassessment => reassessment.reassessmentEventId === row.reassessmentEventId),
  )
  const latestResolutionByEventId = new Map<string, typeof reassessmentResolutions.$inferSelect>()
  relevantResolutionRows
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach(row => {
      if (!latestResolutionByEventId.has(row.reassessmentEventId)) {
        latestResolutionByEventId.set(row.reassessmentEventId, row)
      }
    })
  let reassessmentMap: StudentAgentCardPayload['interventions']['currentReassessments'] = relevantReassessments.map(row => {
    const matchingRisk = riskRows.find(risk => risk.riskAssessmentId === row.riskAssessmentId) ?? null
    const matchingOffering = matchingRisk
      ? offeringRows.find(offering => offering.offeringId === matchingRisk.offeringId) ?? null
      : null
    const matchingCourse = matchingOffering
      ? courseRows.find(course => course.courseId === matchingOffering.courseId) ?? null
      : null
    const payload = parseJson(row.payloadJson, {} as Record<string, unknown>)
    const resolution = latestResolutionByEventId.get(row.reassessmentEventId) ?? null
    return {
      reassessmentEventId: row.reassessmentEventId,
      courseCode: matchingCourse?.courseCode ?? primaryCourse?.courseCode ?? 'NA',
      courseTitle: matchingCourse?.title ?? primaryCourse?.title ?? 'Untitled course',
      status: row.status,
      dueAt: row.dueAt,
      assignedToRole: row.assignedToRole,
      assignedFacultyId: row.assignedFacultyId ?? (typeof payload.assignedFacultyId === 'string' ? payload.assignedFacultyId : null),
      queueCaseId: typeof payload.queueCaseId === 'string' ? payload.queueCaseId : null,
      primaryCase: typeof payload.primaryCase === 'boolean' ? payload.primaryCase : true,
      countsTowardCapacity: typeof payload.countsTowardCapacity === 'boolean' ? payload.countsTowardCapacity : null,
      priorityRank: Number.isFinite(Number(payload.priorityRank)) ? Number(payload.priorityRank) : null,
      governanceReason: typeof payload.governanceReason === 'string' ? payload.governanceReason : null,
      supportingCourseCount: Number.isFinite(Number(payload.supportingCourseCount))
        ? Number(payload.supportingCourseCount)
        : Array.isArray(payload.supportingRiskAssessmentIds)
          ? payload.supportingRiskAssessmentIds.length
          : 0,
      recoveryState: proofRecoveryStateFromResolutionRow(resolution),
      observedResidual: Number.isFinite(Number(proofResolutionPayloadFromRow(resolution).observedResidual))
        ? Number(proofResolutionPayloadFromRow(resolution).observedResidual)
        : null,
    }
  })
  reassessmentMap = reassessmentMap
    .slice()
    .sort((left, right) => {
      if ((left.countsTowardCapacity ?? false) !== (right.countsTowardCapacity ?? false)) {
        return Number(Boolean(right.countsTowardCapacity)) - Number(Boolean(left.countsTowardCapacity))
      }
      if ((left.primaryCase ?? false) !== (right.primaryCase ?? false)) {
        return Number(Boolean(right.primaryCase)) - Number(Boolean(left.primaryCase))
      }
      const statusDelta = queueStatusPriority(right.status) - queueStatusPriority(left.status)
      if (statusDelta !== 0) return statusDelta
      const leftRank = left.priorityRank ?? Number.MAX_SAFE_INTEGER
      const rightRank = right.priorityRank ?? Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) return leftRank - rightRank
      return left.dueAt.localeCompare(right.dueAt)
    })
  const humanActionLog = [
    ...interventionHistory.map(item => ({
      title: `Intervention · ${item.interventionType}`,
      detail: item.note,
      occurredAt: item.occurredAt,
    })),
    ...relevantReassessments.map(item => ({
      title: `Reassessment · ${item.status}`,
      detail: `Assigned to ${item.assignedToRole}, due ${item.dueAt}.`,
      occurredAt: item.createdAt,
    })),
    ...relevantResolutionRows
      .map(row => ({
        title: `Resolution · ${row.resolutionStatus}`,
        detail: row.note ?? 'Resolution stored on the proof record.',
        occurredAt: row.createdAt,
      })),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 12)

  const semesterSummaries = evidenceTimeline.map(item => {
    const observedState = item.observedState as Record<string, unknown>
    const riskBands = parseJson(JSON.stringify(observedState.riskBands ?? observedState.riskBand ? [observedState.riskBand] : []), [] as string[])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    return {
      semesterNumber: item.semesterNumber,
      riskBands: uniqueSorted(riskBands),
      sgpa: Number(observedState.sgpa ?? 0),
      cgpaAfterSemester: Number(observedState.cgpaAfterSemester ?? 0),
      backlogCount: Number(observedState.backlogCount ?? 0),
      weakCoCount: Number(observedState.weakCoCount ?? 0),
      questionResultCoverage: Number(observedState.questionResultCoverage ?? 0),
      interventionCount: Number(observedState.interventionCount ?? 0),
    }
  })

  let currentEvidence: StudentAgentCardPayload['overview']['currentEvidence'] = {
    attendancePct: Number(currentObservedPayload.attendancePct ?? 0),
    tt1Pct: Number(currentObservedPayload.tt1Pct ?? 0),
    tt2Pct: Number(currentObservedPayload.tt2Pct ?? 0),
    quizPct: Number(currentObservedPayload.quizPct ?? 0),
    assignmentPct: Number(currentObservedPayload.assignmentPct ?? 0),
    seePct: Number(currentObservedPayload.seePct ?? 0),
    weakCoCount: Number(currentObservedPayload.weakCoCount ?? weakCourseOutcomes.length),
    weakQuestionCount: Number((currentObservedPayload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? questionPatterns.weakQuestionCount),
    coEvidenceMode: currentCoRows.length > 0 ? dominantCoEvidenceMode(currentCoRows) : null,
    interventionRecoveryStatus: currentObservedPayload.interventionResponse && typeof currentObservedPayload.interventionResponse === 'object'
      ? String((currentObservedPayload.interventionResponse as Record<string, unknown>).recoveryConfirmed ? 'confirmed' : 'watch')
      : null,
  }

  const attentionAreas = uniqueSorted([
    ...(currentEvidence.attendancePct < 75 ? ['Attendance below threshold'] : []),
    ...(currentEvidence.tt1Pct < 45 ? ['TT1 below safe range'] : []),
    ...(currentEvidence.tt2Pct < 45 ? ['TT2 below safe range'] : []),
    ...(currentEvidence.seePct < 45 ? ['SEE below safe range'] : []),
    ...(currentEvidence.weakCoCount > 0 ? ['Weak course outcomes present'] : []),
    ...(questionPatterns.transferGapCount > 0 ? ['Transfer-gap question signals present'] : []),
  ])

  let currentStatus: StudentAgentCardPayload['overview']['currentStatus'] = {
    riskBand: primaryRisk?.riskBand ?? null,
    riskProbScaled: primaryRisk?.riskProbScaled ?? null,
    previousRiskBand: null,
    previousRiskProbScaled: null,
    riskChangeFromPreviousCheckpointScaled: null,
    counterfactualLiftScaled: null,
    reassessmentStatus: reassessmentMap[0]?.status ?? null,
    resolutionStatus: reassessmentMap[0]?.recoveryState ?? null,
    nextDueAt: reassessmentMap[0]?.dueAt ?? null,
    recommendedAction: primaryRisk?.recommendedAction ?? null,
    queueState: reassessmentMap[0]?.status === 'Open'
      ? 'open'
      : reassessmentMap[0]?.status === 'Watching'
        ? 'watch'
        : reassessmentMap[0]?.status === 'Resolved'
          ? 'resolved'
          : null,
    queueCaseId: reassessmentMap[0]?.queueCaseId ?? null,
    primaryCase: reassessmentMap[0]?.primaryCase ?? null,
    countsTowardCapacity: reassessmentMap[0]?.countsTowardCapacity ?? null,
    priorityRank: reassessmentMap[0]?.priorityRank ?? null,
    governanceReason: reassessmentMap[0]?.governanceReason ?? null,
    supportingCourseCount: reassessmentMap[0]?.supportingCourseCount ?? null,
    assignedFacultyId: reassessmentMap[0]?.assignedFacultyId ?? null,
    recoveryState: reassessmentMap[0]?.recoveryState ?? null,
    observedResidual: reassessmentMap[0]?.observedResidual ?? null,
    simulatedActionTaken: null as string | null,
    policyComparison: null,
    attentionAreas,
  }

  const electiveFit = latestElective ? {
    recommendedCode: latestElective.recommendedCode,
    recommendedTitle: latestElective.recommendedTitle,
    stream: latestElective.stream,
    rationale: parseJson(latestElective.rationaleJson, [] as string[]),
    alternatives: parseJson(latestElective.alternativesJson, [] as Array<{ code: string; title: string; stream: string }>),
  } : null

  let checkpointContext: StudentAgentCardPayload['checkpointContext'] = null
  let counterfactual: StudentAgentCardPayload['counterfactual'] = null
  let assessmentComponents: StudentAgentCardPayload['assessmentEvidence']['components'] = sortedRiskRows.map(row => {
    const offering = offeringRows.find(item => item.offeringId === row.offeringId) ?? null
    const course = offering ? (courseRows.find(item => item.courseId === offering.courseId) ?? null) : null
    const evidenceRow = observedRows
      .filter(observed => observed.semesterNumber === currentSemester)
      .find(observed => {
        const payload = parseJson(observed.observedStateJson, {} as Record<string, unknown>)
        return observed.studentId === student.studentId && payload.offeringId === row.offeringId
      })
    const payload = evidenceRow ? parseJson(evidenceRow.observedStateJson, {} as Record<string, unknown>) : {}
    return {
      courseCode: course?.courseCode ?? 'NA',
      courseTitle: course?.title ?? 'Untitled course',
      sectionCode: offering?.sectionCode ?? null,
      attendancePct: Number(payload.attendancePct ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: Number(payload.tt2Pct ?? 0),
      quizPct: Number(payload.quizPct ?? 0),
      assignmentPct: Number(payload.assignmentPct ?? 0),
      seePct: Number(payload.seePct ?? 0),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      coEvidenceMode: (() => {
        const componentCoRows = coRows
          .filter(item => item.studentId === student.studentId)
          .filter(item => item.semesterNumber === currentSemester)
          .filter(item => !row.offeringId || item.offeringId === row.offeringId)
        return componentCoRows.length > 0 ? dominantCoEvidenceMode(componentCoRows) : null
      })(),
      drivers: parseJson(row.driversJson, [] as Array<{ label: string; impact: number; feature: string }>),
    }
  })

  if (stageCheckpoint) {
    const stageCheckpointSummary = parseProofCheckpointSummary(stageCheckpoint)
    checkpointContext = {
      simulationStageCheckpointId: stageCheckpoint.simulationStageCheckpointId,
      semesterNumber: stageCheckpoint.semesterNumber,
      stageKey: stageCheckpoint.stageKey,
      stageLabel: stageCheckpoint.stageLabel,
      stageDescription: stageCheckpoint.stageDescription,
      stageOrder: stageCheckpoint.stageOrder,
      previousCheckpointId: stageCheckpoint.previousCheckpointId ?? null,
      nextCheckpointId: stageCheckpoint.nextCheckpointId ?? null,
      stageAdvanceBlocked: stageCheckpointSummary.stageAdvanceBlocked ?? Number(stageCheckpointSummary.openQueueCount ?? 0) > 0,
      blockingQueueItemCount: stageCheckpointSummary.blockingQueueItemCount ?? Number(stageCheckpointSummary.openQueueCount ?? 0),
      playbackAccessible: stageCheckpointSummary.playbackAccessible ?? true,
      blockedByCheckpointId: stageCheckpointSummary.blockedByCheckpointId ?? null,
      blockedProgressionReason: stageCheckpointSummary.blockedProgressionReason ?? null,
    }
    const primaryStagePayload = primaryStageProjection
      ? parseJson(primaryStageProjection.projectionJson, {} as Record<string, unknown>)
      : {}
    const primaryStageEvidence = (primaryStagePayload.currentEvidence ?? {}) as Record<string, unknown>
    const primaryStageStatus = (primaryStagePayload.currentStatus ?? {}) as Record<string, unknown>
    const primaryStageGovernance = (primaryStagePayload.governance ?? {}) as Record<string, unknown>
    const counterfactualPolicy = (primaryStagePayload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
    const realizedPath = (primaryStagePayload.realizedPathDiagnostics ?? {}) as Record<string, unknown>
    currentEvidence = {
      attendancePct: Number(primaryStageEvidence.attendancePct ?? 0),
      tt1Pct: Number(primaryStageEvidence.tt1Pct ?? 0),
      tt2Pct: Number(primaryStageEvidence.tt2Pct ?? 0),
      quizPct: Number(primaryStageEvidence.quizPct ?? 0),
      assignmentPct: Number(primaryStageEvidence.assignmentPct ?? 0),
      seePct: Number(primaryStageEvidence.seePct ?? 0),
      weakCoCount: Number(primaryStageEvidence.weakCoCount ?? 0),
      weakQuestionCount: Number(primaryStageEvidence.weakQuestionCount ?? 0),
      coEvidenceMode: typeof primaryStageEvidence.coEvidenceMode === 'string' ? primaryStageEvidence.coEvidenceMode : null,
      interventionRecoveryStatus: typeof primaryStageEvidence.interventionRecoveryStatus === 'string'
        ? primaryStageEvidence.interventionRecoveryStatus
        : null,
    }
    questionPatterns = parseJson(JSON.stringify(primaryStagePayload.questionPatterns ?? questionPatterns), questionPatterns) as typeof questionPatterns
    weakCourseOutcomes = parseJson(JSON.stringify(primaryStagePayload.weakCourseOutcomes ?? weakCourseOutcomes), weakCourseOutcomes) as typeof weakCourseOutcomes
    reassessmentMap = stageQueueRows
      .slice()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(row => {
        const detail = parseJson(row.detailJson, {} as Record<string, unknown>)
        return {
          reassessmentEventId: row.simulationStageQueueProjectionId,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          status: row.status,
          dueAt: typeof detail.dueAt === 'string' ? detail.dueAt : stageCheckpoint.updatedAt,
          assignedToRole: row.assignedToRole ?? 'Course Leader',
          assignedFacultyId: row.assignedFacultyId ?? (typeof detail.assignedFacultyId === 'string' ? detail.assignedFacultyId : null),
          queueCaseId: typeof detail.queueCaseId === 'string' ? detail.queueCaseId : null,
          primaryCase: typeof detail.primaryCase === 'boolean' ? detail.primaryCase : null,
          countsTowardCapacity: typeof detail.countsTowardCapacity === 'boolean' ? detail.countsTowardCapacity : null,
          priorityRank: Number.isFinite(Number(detail.priorityRank)) ? Number(detail.priorityRank) : null,
          governanceReason: typeof detail.governanceReason === 'string' ? detail.governanceReason : null,
          supportingCourseCount: Number.isFinite(Number(detail.supportingCourseCount)) ? Number(detail.supportingCourseCount) : 0,
          recoveryState: row.status === 'Resolved' ? 'under_watch' : null,
          observedResidual: null,
        }
      })
    currentStatus = {
      riskBand: primaryStageProjection?.riskBand ?? null,
      riskProbScaled: primaryStageProjection?.riskProbScaled ?? null,
      previousRiskBand: typeof primaryStageStatus.previousRiskBand === 'string'
        ? primaryStageStatus.previousRiskBand
        : typeof realizedPath.previousRiskBand === 'string'
          ? realizedPath.previousRiskBand
          : null,
      previousRiskProbScaled: Number.isFinite(Number(primaryStageStatus.previousRiskProbScaled))
        ? Number(primaryStageStatus.previousRiskProbScaled)
        : Number.isFinite(Number(realizedPath.previousRiskProbScaled))
          ? Number(realizedPath.previousRiskProbScaled)
          : null,
      riskChangeFromPreviousCheckpointScaled: Number.isFinite(Number(primaryStageStatus.riskChangeFromPreviousCheckpointScaled))
        ? Number(primaryStageStatus.riskChangeFromPreviousCheckpointScaled)
        : Number.isFinite(Number(primaryStagePayload.riskChangeFromPreviousCheckpointScaled))
          ? Number(primaryStagePayload.riskChangeFromPreviousCheckpointScaled)
          : null,
      counterfactualLiftScaled: Number.isFinite(Number(primaryStageStatus.counterfactualLiftScaled))
        ? Number(primaryStageStatus.counterfactualLiftScaled)
        : Number.isFinite(Number(primaryStagePayload.counterfactualLiftScaled))
          ? Number(primaryStagePayload.counterfactualLiftScaled)
          : null,
      reassessmentStatus: reassessmentMap[0]?.status ?? null,
      resolutionStatus: reassessmentMap[0]?.status === 'Resolved' ? 'Resolved' : null,
      nextDueAt: reassessmentMap[0]?.dueAt ?? null,
      recommendedAction: primaryStageProjection?.recommendedAction ?? null,
      queueState: primaryStageProjection?.queueState ?? null,
      queueCaseId: typeof primaryStageGovernance.queueCaseId === 'string' ? primaryStageGovernance.queueCaseId : null,
      primaryCase: typeof primaryStageGovernance.primaryCase === 'boolean' ? primaryStageGovernance.primaryCase : null,
      countsTowardCapacity: typeof primaryStageGovernance.countsTowardCapacity === 'boolean' ? primaryStageGovernance.countsTowardCapacity : null,
      priorityRank: Number.isFinite(Number(primaryStageGovernance.priorityRank)) ? Number(primaryStageGovernance.priorityRank) : null,
      governanceReason: typeof primaryStageGovernance.governanceReason === 'string' ? primaryStageGovernance.governanceReason : null,
      supportingCourseCount: Number.isFinite(Number(primaryStageGovernance.supportingCourseCount)) ? Number(primaryStageGovernance.supportingCourseCount) : null,
      assignedFacultyId: typeof primaryStageGovernance.assignedFacultyId === 'string' ? primaryStageGovernance.assignedFacultyId : null,
      recoveryState: reassessmentMap[0]?.recoveryState ?? null,
      observedResidual: reassessmentMap[0]?.observedResidual ?? null,
      simulatedActionTaken: primaryStageProjection?.simulatedActionTaken ?? null,
      policyComparison: parseJson(
        JSON.stringify((Object.keys(counterfactualPolicy).length > 0 ? {
          policyPhenotype: typeof counterfactualPolicy.policyPhenotype === 'string' ? counterfactualPolicy.policyPhenotype : null,
          recommendedAction: typeof counterfactualPolicy.recommendedAction === 'string' ? counterfactualPolicy.recommendedAction : null,
          simulatedActionTaken: typeof counterfactualPolicy.simulatedActionTaken === 'string' ? counterfactualPolicy.simulatedActionTaken : null,
          noActionRiskBand: typeof counterfactualPolicy.noActionRiskBand === 'string' ? counterfactualPolicy.noActionRiskBand : null,
          noActionRiskProbScaled: Number.isFinite(Number(counterfactualPolicy.noActionRiskProbScaled))
            ? Number(counterfactualPolicy.noActionRiskProbScaled)
            : null,
          counterfactualLiftScaled: Number.isFinite(Number(counterfactualPolicy.counterfactualLiftScaled))
            ? Number(counterfactualPolicy.counterfactualLiftScaled)
            : null,
          rationale: typeof counterfactualPolicy.policyRationale === 'string'
            ? counterfactualPolicy.policyRationale
            : '',
        } : (primaryStageStatus.policyComparison ?? null))),
        null as StudentAgentCardPayload['overview']['currentStatus']['policyComparison'],
      ),
      attentionAreas: parseJson(JSON.stringify(primaryStageStatus.attentionAreas ?? attentionAreas), attentionAreas),
    }
    const noAction = (primaryStagePayload.noActionComparator ?? {}) as Record<string, unknown>
    counterfactual = {
      panelLabel: 'Policy Derived',
      noActionRiskBand: typeof noAction.riskBand === 'string' ? noAction.riskBand : null,
      noActionRiskProbScaled: Number.isFinite(Number(noAction.riskProbScaled)) ? Number(noAction.riskProbScaled) : null,
      counterfactualLiftScaled: Number.isFinite(Number(noAction.counterfactualLiftScaled))
        ? Number(noAction.counterfactualLiftScaled)
        : Number.isFinite(Number(noAction.deltaScaled))
          ? Number(noAction.deltaScaled)
          : Number.isFinite(Number(primaryStagePayload.counterfactualLiftScaled))
            ? Number(primaryStagePayload.counterfactualLiftScaled)
            : null,
      note: 'Advisory comparison only. This shows the local no-action comparator for the selected checkpoint and does not change the proof record.',
    }
    assessmentComponents = sortedStageRows.map(row => {
      const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
      const evidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
      return {
        courseCode: row.courseCode,
        courseTitle: row.courseTitle,
        sectionCode: row.sectionCode,
        attendancePct: Number(evidence.attendancePct ?? 0),
        tt1Pct: Number(evidence.tt1Pct ?? 0),
        tt2Pct: Number(evidence.tt2Pct ?? 0),
        quizPct: Number(evidence.quizPct ?? 0),
        assignmentPct: Number(evidence.assignmentPct ?? 0),
        seePct: Number(evidence.seePct ?? 0),
        weakCoCount: Number(evidence.weakCoCount ?? 0),
        weakQuestionCount: Number(evidence.weakQuestionCount ?? 0),
        coEvidenceMode: typeof evidence.coEvidenceMode === 'string' ? evidence.coEvidenceMode : null,
        drivers: [],
      }
    })
  }

  if (!stageCheckpoint) {
    const primaryReassessment = reassessmentMap[0] ?? null
    const primaryResolution = primaryReassessment ? (latestResolutionByEventId.get(primaryReassessment.reassessmentEventId) ?? null) : null
    currentStatus = {
      ...currentStatus,
      reassessmentStatus: primaryReassessment?.status ?? currentStatus.reassessmentStatus,
      resolutionStatus: primaryResolution?.resolutionStatus ?? null,
      nextDueAt: primaryReassessment?.dueAt ?? currentStatus.nextDueAt,
      queueState: primaryReassessment ? (isOpenReassessmentStatus(primaryReassessment.status) ? 'open' : 'resolved') : currentStatus.queueState,
      queueCaseId: primaryReassessment?.queueCaseId ?? null,
      primaryCase: primaryReassessment?.primaryCase ?? null,
      countsTowardCapacity: primaryReassessment?.countsTowardCapacity ?? null,
      priorityRank: primaryReassessment?.priorityRank ?? null,
      governanceReason: primaryReassessment?.governanceReason ?? null,
      supportingCourseCount: primaryReassessment?.supportingCourseCount ?? null,
      assignedFacultyId: primaryReassessment?.assignedFacultyId ?? null,
      recoveryState: proofRecoveryStateFromResolutionRow(primaryResolution),
      observedResidual: Number.isFinite(Number(proofResolutionPayloadFromRow(primaryResolution).observedResidual))
        ? Number(proofResolutionPayloadFromRow(primaryResolution).observedResidual)
        : null,
    }
  }

  const proofRiskInference = await loadProofRiskInferenceContext(db, {
    batchId: run.batchId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    primaryCourseCode: primaryCourse?.courseCode ?? null,
  })
  const overallHeadDisplay = headDisplayState(proofRiskInference.inferred, 'overallCourseRisk')
    ?? proofRiskInference.fallbackOverallHeadDisplay
  currentStatus = {
    ...currentStatus,
    riskProbScaled: displayableHeadProbabilityScaled(proofRiskInference.inferred, 'overallCourseRisk'),
  }

  const simulationTags = behaviorProfile ? [
    `Archetype: ${String(parseJson(behaviorProfile.profileJson, {} as Record<string, unknown>).archetype ?? 'unspecified')}`,
    `Mentor track: ${String(parseJson(behaviorProfile.profileJson, {} as Record<string, unknown>).mentorTrack ?? 'unspecified')}`,
    ...(topicBuckets.highUncertainty.length > 0 ? ['High uncertainty topics present'] : []),
  ] : []

  const provisionalCard = {
    studentAgentCardId: '',
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    cardVersion: STUDENT_AGENT_CARD_VERSION,
    sourceSnapshotHash: '',
    disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
    runContext: {
      simulationRunId: run.simulationRunId,
      runLabel: run.runLabel,
      status: run.status,
      seed: run.seed,
      createdAt: run.createdAt,
      batchLabel: batch?.batchLabel ?? null,
      branchName: branch?.name ?? null,
    },
    checkpointContext,
    student: {
      studentId: student.studentId,
      studentName: student.name,
      usn: student.usn,
      sectionCode: currentObservedState?.sectionCode ?? topicRows[0]?.sectionCode ?? 'NA',
      currentSemester,
      programScopeVersion: behaviorProfile?.programScopeVersion ?? null,
      mentorTrack: String(parseJson(behaviorProfile?.profileJson ?? '{}', {} as Record<string, unknown>).mentorTrack ?? ''),
    },
    allowedIntents: [
      'Explain current semester performance',
      'Explain weak topics or course outcomes',
      'Explain reassessment status',
      'Explain intervention history',
      'Explain elective recommendation',
      'Compare semester X to semester Y',
    ],
    summaryRail: {
      currentRiskBand: currentStatus.riskBand,
      currentRiskProbScaled: currentStatus.riskProbScaled,
      previousRiskBand: currentStatus.previousRiskBand,
      previousRiskProbScaled: currentStatus.previousRiskProbScaled,
      riskChangeFromPreviousCheckpointScaled: currentStatus.riskChangeFromPreviousCheckpointScaled,
      counterfactualLiftScaled: currentStatus.counterfactualLiftScaled,
      currentRiskDisplayProbabilityAllowed: overallHeadDisplay?.displayProbabilityAllowed ?? null,
      currentRiskSupportWarning: overallHeadDisplay?.supportWarning ?? null,
      currentRiskCalibrationMethod: overallHeadDisplay?.calibrationMethod ?? null,
      primaryCourseCode: primaryCourse?.courseCode ?? null,
      primaryCourseTitle: primaryCourse?.title ?? null,
      nextDueAt: currentStatus.nextDueAt,
      currentReassessmentStatus: currentStatus.reassessmentStatus,
      currentQueueState: currentStatus.queueState ?? null,
      currentRecoveryState: currentStatus.recoveryState ?? null,
      currentCgpa: Number(currentObservedPayload.cgpa ?? semesterSummaries[semesterSummaries.length - 1]?.cgpaAfterSemester ?? 0),
      backlogCount: Number(currentObservedPayload.backlogCount ?? semesterSummaries[semesterSummaries.length - 1]?.backlogCount ?? 0),
      electiveFit,
    },
    overview: {
      observedLabel: 'Observed' as const,
      policyLabel: 'Policy Derived' as const,
      currentEvidence,
      currentStatus,
      semesterSummaries,
    },
    topicAndCo: {
      panelLabel: 'Simulation Internal' as const,
      topicBuckets,
      weakCourseOutcomes,
      questionPatterns,
      simulationTags,
    },
    assessmentEvidence: {
      panelLabel: 'Observed' as const,
      components: assessmentComponents,
    },
    interventions: {
      panelLabel: 'Human Action Log' as const,
      currentReassessments: reassessmentMap,
      interventionHistory,
      humanActionLog,
    },
    counterfactual,
    citations: [] as StudentAgentCitation[],
  } satisfies StudentAgentCardPayload

  const citations = buildStudentAgentCitations({
    currentEvidence,
    currentStatus,
    topicBuckets,
    weakCourseOutcomes,
    questionPatterns,
    interventionHistory,
    reassessments: reassessmentMap,
    electiveFit,
    semesterSummaries,
  })
  provisionalCard.citations = citations

  const sourceSnapshot = {
    simulationRunId: run.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    studentId: student.studentId,
    runUpdatedAt: run.updatedAt,
    behaviorUpdatedAt: behaviorProfile?.updatedAt ?? null,
    observedUpdatedAt: observedRows.map(row => row.updatedAt),
    riskUpdatedAt: riskRows.map(row => row.updatedAt),
    checkpointUpdatedAt: stageCheckpoint?.updatedAt ?? null,
    checkpointProjectionUpdatedAt: stageStudentRows.map(row => row.updatedAt),
    checkpointQueueUpdatedAt: stageQueueRows.map(row => row.updatedAt),
    topicUpdatedAt: currentTopicRows.map(row => row.updatedAt),
    coUpdatedAt: currentCoRows.map(row => row.updatedAt),
    questionUpdatedAt: currentQuestionRows.map(row => row.updatedAt),
    responseUpdatedAt: responseRows.map(row => row.updatedAt),
    electiveUpdatedAt: electiveRows.map(row => row.updatedAt),
    reassessmentUpdatedAt: relevantReassessments.map(row => row.updatedAt),
    resolutionUpdatedAt: relevantResolutionRows.map(row => row.updatedAt),
    interventionUpdatedAt: interventionRows.map(row => row.updatedAt),
  }
  const sourceSnapshotHash = hashSnapshot(sourceSnapshot)
  provisionalCard.sourceSnapshotHash = sourceSnapshotHash

  const studentAgentCardId = buildDeterministicId('agent_card', [
    input.simulationRunId,
    stageCheckpoint?.simulationStageCheckpointId ?? 'active',
    input.studentId,
    STUDENT_AGENT_CARD_VERSION,
  ])
  const existing = await db.select().from(studentAgentCards).where(
    eq(studentAgentCards.studentAgentCardId, studentAgentCardId),
  ).then(rows => rows[0] ?? null)
  const citationMapJson = stableStringify(citations)
  if (existing && existing.sourceSnapshotHash === sourceSnapshotHash) {
    return parseJson(existing.cardJson, provisionalCard as StudentAgentCardPayload)
  }
  const persistedCard = {
    ...provisionalCard,
    studentAgentCardId,
  }
  const now = new Date().toISOString()
  await db.insert(studentAgentCards).values({
    studentAgentCardId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    cardVersion: STUDENT_AGENT_CARD_VERSION,
    sourceSnapshotHash,
    cardJson: stableStringify(persistedCard),
    citationMapJson,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: studentAgentCards.studentAgentCardId,
    set: {
      simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
      sourceSnapshotHash,
      cardJson: stableStringify(persistedCard),
      citationMapJson,
      updatedAt: now,
    },
  })
  return persistedCard
}

function deriveScenarioRiskHeads(input: {
  currentRiskProbScaled: number | null
  currentCgpa: number
  backlogCount: number
  weakCoCount: number
  transferGapCount: number
  hasElectiveFit: boolean
  currentSemesterSummary?: StudentAgentCardPayload['overview']['semesterSummaries'][number] | null
  previousSemesterSummary?: StudentAgentCardPayload['overview']['semesterSummaries'][number] | null
}) {
  const overallRisk = clamp((input.currentRiskProbScaled ?? 0) / 100, 0.05, 0.95)
  const backlogPressure = clamp(input.backlogCount / 4, 0, 1)
  const lowCgpaPressure = clamp((7.5 - input.currentCgpa) / 4, 0, 1)
  const sgpaTrendPressure = input.currentSemesterSummary && input.previousSemesterSummary
    ? clamp((input.previousSemesterSummary.sgpa - input.currentSemesterSummary.sgpa + 1.5) / 4, 0, 1)
    : clamp((6.5 - input.currentCgpa) / 4, 0, 1)
  const coPressure = clamp(input.weakCoCount / 4, 0, 1)
  const transferGapPressure = clamp(input.transferGapCount / 5, 0, 1)

  return {
    semesterSgpaDropRiskProbScaled: Math.round(clamp(
      (overallRisk * 0.55) + (backlogPressure * 0.2) + (sgpaTrendPressure * 0.25),
      0.05,
      0.95,
    ) * 100),
    cumulativeCgpaDropRiskProbScaled: Math.round(clamp(
      (overallRisk * 0.45) + (backlogPressure * 0.25) + (lowCgpaPressure * 0.3),
      0.05,
      0.95,
    ) * 100),
    electiveMismatchRiskProbScaled: input.hasElectiveFit
      ? Math.round(clamp(
        (overallRisk * 0.45) + (coPressure * 0.25) + (transferGapPressure * 0.15) + (backlogPressure * 0.15),
        0.05,
        0.95,
      ) * 100)
      : null,
    note: 'These scenario heads are derived from the trained course-risk heads plus observed semester trend, backlog pressure, weak course outcomes, and elective-fit visibility. They are advisory and simulation-calibrated.',
  }
}

export async function buildStudentRiskExplorer(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')

  const card = await buildStudentAgentCard(db, input)
  let checkpointPolicyComparison: StudentRiskExplorerPayload['policyComparison'] = null

  if (input.simulationStageCheckpointId) {
    const stageRows = await db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, input.studentId),
    ))
    const primaryStageRow = stageRows
      .slice()
      .sort((left, right) => right.riskProbScaled - left.riskProbScaled || left.courseCode.localeCompare(right.courseCode))[0] ?? null
    const stagePayload = primaryStageRow
      ? parseJson(primaryStageRow.projectionJson, {} as Record<string, unknown>)
      : {}
    checkpointPolicyComparison = parseJson(
      JSON.stringify(stagePayload.counterfactualPolicyDiagnostics ?? null),
      null as StudentRiskExplorerPayload['policyComparison'],
    )
  }
  const proofRiskInference = await loadProofRiskInferenceContext(db, {
    batchId: run.batchId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    primaryCourseCode: card.summaryRail.primaryCourseCode,
  })
  const inferred = proofRiskInference.inferred
  const overallHeadDisplay = headDisplayState(inferred, 'overallCourseRisk')

  const currentSemesterNumber = card.checkpointContext?.semesterNumber ?? card.student.currentSemester
  const currentSemesterSummary = card.overview.semesterSummaries.find(item => item.semesterNumber === currentSemesterNumber) ?? null
  const previousSemesterSummary = card.overview.semesterSummaries.find(item => item.semesterNumber === currentSemesterNumber - 1) ?? null
  const derivedScenarioHeads = deriveScenarioRiskHeads({
    currentRiskProbScaled: inferred ? Math.round(inferred.riskProb * 100) : card.overview.currentStatus.riskProbScaled,
    currentCgpa: card.summaryRail.currentCgpa,
    backlogCount: card.summaryRail.backlogCount,
    weakCoCount: card.overview.currentEvidence.weakCoCount,
    transferGapCount: card.topicAndCo.questionPatterns.transferGapCount,
    hasElectiveFit: !!card.summaryRail.electiveFit,
    currentSemesterSummary,
    previousSemesterSummary,
  })

  return {
    simulationRunId: card.simulationRunId,
    simulationStageCheckpointId: card.simulationStageCheckpointId,
    disclaimer: 'Risk explorer is a proof-mode analysis surface. Trained heads are simulation-calibrated, observable-only, and advisory. Derived scenario heads are not separate trained models.',
    runContext: card.runContext,
    checkpointContext: card.checkpointContext,
    student: card.student,
    modelProvenance: {
      modelVersion: inferred?.modelVersion ?? null,
      calibrationVersion: inferred?.calibrationVersion ?? null,
      featureSchemaVersion: proofRiskInference.featureSchemaVersion,
      evidenceWindow: proofRiskInference.evidenceWindow,
      calibrationMethod: overallHeadDisplay?.calibrationMethod ?? null,
      displayProbabilityAllowed: overallHeadDisplay?.displayProbabilityAllowed ?? null,
      supportWarning: overallHeadDisplay?.supportWarning ?? null,
      headDisplay: inferred?.headDisplay ?? null,
      coEvidenceMode: proofRiskInference.sourceRefs?.coEvidenceMode ?? card.overview.currentEvidence.coEvidenceMode ?? null,
      simulationCalibrated: true as const,
    },
    trainedRiskHeads: {
      currentRiskBand: card.overview.currentStatus.riskBand,
      currentRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'overallCourseRisk'),
      attendanceRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'attendanceRisk'),
      ceRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'ceRisk'),
      seeRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'seeRisk'),
      overallCourseRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'overallCourseRisk'),
      downstreamCarryoverRiskProbScaled: displayableHeadProbabilityScaled(inferred, 'downstreamCarryoverRisk'),
    },
    trainedRiskHeadDisplays: inferred?.headDisplay ?? null,
    derivedScenarioHeads,
    currentEvidence: card.overview.currentEvidence,
    currentStatus: card.overview.currentStatus,
    topDrivers: inferred?.observableDrivers ?? [],
    crossCourseDrivers: inferred?.crossCourseDrivers ?? [],
    prerequisiteMap: {
      prerequisiteCourseCodes: proofRiskInference.sourceRefs?.prerequisiteCourseCodes ?? [],
      weakPrerequisiteCourseCodes: proofRiskInference.sourceRefs?.prerequisiteWeakCourseCodes ?? [],
      prerequisitePressureScaled: proofRiskInference.featurePayload?.prerequisitePressure ?? null,
      prerequisiteAveragePct: proofRiskInference.featurePayload?.prerequisiteAveragePct ?? null,
      prerequisiteFailureCount: proofRiskInference.featurePayload?.prerequisiteFailureCount ?? null,
    },
    weakCourseOutcomes: card.topicAndCo.weakCourseOutcomes,
    questionPatterns: card.topicAndCo.questionPatterns,
    semesterSummaries: card.overview.semesterSummaries,
    assessmentComponents: card.assessmentEvidence.components,
    counterfactual: card.counterfactual,
    electiveFit: card.summaryRail.electiveFit,
    policyComparison: checkpointPolicyComparison,
  } satisfies StudentRiskExplorerPayload
}

function mapStudentAgentMessages(rows: Array<typeof studentAgentMessages.$inferSelect>) {
  return rows
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(row => ({
      studentAgentMessageId: row.studentAgentMessageId,
      actorType: row.actorType,
      messageType: row.messageType,
      body: row.body,
      citations: parseJson(row.citationsJson, [] as StudentAgentCitation[]),
      guardrailCode: row.guardrailCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
}

export async function startStudentAgentSession(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId?: string | null
  studentId: string
  viewerFacultyId: string | null
  viewerRole: string
}) {
  const card = await buildStudentAgentCard(db, {
    simulationRunId: input.simulationRunId,
    studentId: input.studentId,
    simulationStageCheckpointId: input.simulationStageCheckpointId,
  })
  const now = new Date().toISOString()
  const [existingCard] = await db.select().from(studentAgentCards).where(eq(studentAgentCards.studentAgentCardId, card.studentAgentCardId))
  if (!existingCard) throw new Error('Student agent card was not persisted')
  const sessionId = createId('agent_session')
  const intro = buildIntroShellMessage(now, citationMapById(card.citations))
  await db.insert(studentAgentSessions).values({
    studentAgentSessionId: sessionId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    studentAgentCardId: card.studentAgentCardId,
    viewerFacultyId: input.viewerFacultyId,
    viewerRole: input.viewerRole,
    status: 'active',
    responseMode: 'deterministic',
    cardVersion: card.cardVersion,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(studentAgentMessages).values({
    studentAgentMessageId: createId('agent_message'),
    studentAgentSessionId: sessionId,
    actorType: intro.actorType,
    messageType: intro.messageType,
    body: intro.body,
    citationsJson: stableStringify(intro.citations),
    guardrailCode: intro.guardrailCode,
    createdAt: intro.createdAt,
    updatedAt: intro.updatedAt,
  })
  const messageRows = await db.select().from(studentAgentMessages).where(eq(studentAgentMessages.studentAgentSessionId, sessionId))
  return {
    studentAgentSessionId: sessionId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    viewerFacultyId: input.viewerFacultyId,
    viewerRole: input.viewerRole,
    status: 'active',
    responseMode: 'deterministic',
    cardVersion: card.cardVersion,
    messages: mapStudentAgentMessages(messageRows),
    createdAt: now,
    updatedAt: now,
  }
}

export async function sendStudentAgentMessage(db: AppDb, input: {
  studentAgentSessionId: string
  prompt: string
}) {
  const session = await db.select().from(studentAgentSessions).where(eq(studentAgentSessions.studentAgentSessionId, input.studentAgentSessionId)).then(rows => rows[0] ?? null)
  if (!session) throw new Error(`Student agent session ${input.studentAgentSessionId} was not found`)
  const card = await buildStudentAgentCard(db, {
    simulationRunId: session.simulationRunId,
    studentId: session.studentId,
    simulationStageCheckpointId: session.simulationStageCheckpointId,
  })
  const now = new Date().toISOString()
  const userMessageId = createId('agent_message')
  const assistantMessageId = createId('agent_message')
  const reply = buildAssistantReply({
    prompt: input.prompt,
    card,
  })
  await db.insert(studentAgentMessages).values([
    {
      studentAgentMessageId: userMessageId,
      studentAgentSessionId: session.studentAgentSessionId,
      actorType: 'user',
      messageType: 'prompt',
      body: input.prompt.trim(),
      citationsJson: '[]',
      guardrailCode: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      studentAgentMessageId: assistantMessageId,
      studentAgentSessionId: session.studentAgentSessionId,
      actorType: reply.actorType,
      messageType: reply.messageType,
      body: reply.body,
      citationsJson: stableStringify(reply.citations),
      guardrailCode: reply.guardrailCode,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await db.update(studentAgentSessions).set({
    updatedAt: now,
  }).where(eq(studentAgentSessions.studentAgentSessionId, session.studentAgentSessionId))
  return [
    {
      studentAgentMessageId: userMessageId,
      actorType: 'user',
      messageType: 'prompt',
      body: input.prompt.trim(),
      citations: [] as StudentAgentCitation[],
      guardrailCode: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      studentAgentMessageId: assistantMessageId,
      actorType: reply.actorType,
      messageType: reply.messageType,
      body: reply.body,
      citations: reply.citations,
      guardrailCode: reply.guardrailCode,
      createdAt: now,
      updatedAt: now,
    },
  ] satisfies StudentAgentMessage[]
}

export async function listStudentAgentTimeline(db: AppDb, input: {
  simulationRunId: string
  studentId: string
  simulationStageCheckpointId?: string | null
}) {
  const card = await buildStudentAgentCard(db, input)
  const citationById = citationMapById(card.citations)
  const timeline: StudentAgentTimelineItem[] = [
    ...card.overview.semesterSummaries.map(item => ({
      timelineItemId: `semester-${item.semesterNumber}`,
      panelLabel: 'Observed' as const,
      kind: 'semester-summary' as const,
      title: `Semester ${item.semesterNumber} summary`,
      detail: `SGPA ${item.sgpa.toFixed(2)} · CGPA ${item.cgpaAfterSemester.toFixed(2)} · backlogs ${item.backlogCount} · weak COs ${item.weakCoCount}.`,
      occurredAt: card.runContext.createdAt,
      semesterNumber: item.semesterNumber,
      citations: selectCitations(citationById, ['observed-semester-timeline']),
    })),
    ...card.interventions.interventionHistory.map(item => ({
      timelineItemId: item.interventionId,
      panelLabel: 'Human Action Log' as const,
      kind: 'intervention' as const,
      title: `Intervention · ${item.interventionType}`,
      detail: item.note,
      occurredAt: item.occurredAt,
      semesterNumber: null,
      citations: selectCitations(citationById, ['action-interventions']),
    })),
    ...card.interventions.currentReassessments.map(item => ({
      timelineItemId: item.reassessmentEventId,
      panelLabel: 'Human Action Log' as const,
      kind: 'reassessment' as const,
      title: `Reassessment · ${item.status}`,
      detail: `${item.courseCode} ${item.courseTitle} · assigned to ${item.assignedToRole} · due ${item.dueAt}.`,
      occurredAt: item.dueAt,
      semesterNumber: card.student.currentSemester,
      citations: selectCitations(citationById, ['action-reassessments', 'policy-current-status']),
    })),
    ...(card.summaryRail.electiveFit ? [{
      timelineItemId: `elective-${card.summaryRail.electiveFit.recommendedCode}`,
      panelLabel: 'Policy Derived' as const,
      kind: 'elective-fit' as const,
      title: 'Elective fit recommendation',
      detail: `${card.summaryRail.electiveFit.recommendedCode} ${card.summaryRail.electiveFit.recommendedTitle} · ${card.summaryRail.electiveFit.stream}.`,
      occurredAt: card.runContext.createdAt,
      semesterNumber: card.student.currentSemester,
      citations: selectCitations(citationById, ['policy-elective-fit']),
    }] satisfies StudentAgentTimelineItem[] : []),
  ]
  return timeline.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || (left.semesterNumber ?? 99) - (right.semesterNumber ?? 99))
}
