import {
  riskEvidenceSnapshots,
  simulationStageCheckpoints,
  simulationQuestionTemplates,
  simulationStageQueueCases,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import {
  buildActionPolicyComparison,
  buildDeterministicId,
  buildNoActionSnapshot,
  buildStageEvidenceSnapshot,
  ceShortfallLabel,
  dominantCoEvidenceMode,
  downstreamCarryoverLabelForSource,
  includedAttendanceForSourceStage,
  mapActionToTaskType,
  playbackCheckpointNowIso,
  prerequisiteSummaryForSource,
  seeShortfallLabel,
} from './proof-control-plane-playback-service.js'
import {
  buildObservableFeaturePayload,
  featureHash,
  type CorrelationArtifact,
  type ObservableLabelPayload,
  type ProductionRiskModelArtifact,
  RISK_FEATURE_SCHEMA_VERSION,
  scoreObservableRiskWithModel,
} from './proof-risk-model.js'
import { buildMonitoringDecision } from './monitoring-engine.js'
import {
  governProofQueueStage,
  type ProofQueueCandidate,
  type ProofQueueGovernanceStageKey,
  type ProofQueuePriorCaseState,
  type ProofQueueRole,
} from './proof-queue-governance.js'
import type {
  ObservableSourceRefsWithFeatureMetadata,
  PlaybackStageKey,
  StageCourseProjectionSource,
} from './msruas-proof-control-plane.js'

type PlaybackStageDef = {
  key: PlaybackStageKey
  label: string
  description: string
  order: number
  semesterDayOffset: number
}

type SourceState = {
  previousRiskBand: 'High' | 'Medium' | 'Low' | null
  cooldownUntil: string | null
  actionTaken: string | null
  previousRiskProbScaled: number | null
}

type QueueCaseDecisionView = {
  status: 'opened' | 'open' | 'watch' | 'resolved' | 'idle'
  primarySourceKey: string | null
  supportingSourceKeys: string[]
  countsTowardCapacity: boolean
  priorityRank: number | null
  governanceReason: string
}

type StageCandidate = {
  checkpoint: typeof simulationStageCheckpoints.$inferInsert
  stage: PlaybackStageDef
  source: StageCourseProjectionSource
  sourceKey: string
  caseKey: string
  sourceState: SourceState
  sourceRefs: ObservableSourceRefsWithFeatureMetadata
  evidence: ReturnType<typeof buildStageEvidenceSnapshot>
  featurePayload: ReturnType<typeof buildObservableFeaturePayload>
  inference: ReturnType<typeof scoreObservableRiskWithModel>
  policyComparison: ReturnType<typeof buildActionPolicyComparison>
  monitoring: ReturnType<typeof buildMonitoringDecision>
  nextActionTaken: string | null
  noActionInference: ReturnType<typeof scoreObservableRiskWithModel>
  riskProbScaled: number
  noActionRiskProbScaled: number
  riskChangeFromPreviousCheckpointScaled: number
  counterfactualLiftScaled: number
  selectedPolicyCandidate: NonNullable<ReturnType<typeof buildActionPolicyComparison>['candidates'][number]> | null
  assignment: {
    assignedFacultyId: string | null
    facultyBudgetKey: string | null
  }
  downstreamCarryover: 0 | 1
}

export type BuildPlaybackGovernanceArtifactsInput = {
  simulationRunId: string
  now: string
  policy: ResolvedPolicy
  run: {
    batchId: string
    createdAt: string
    curriculumImportVersionId: string | null
    curriculumFeatureProfileFingerprint: string | null
  }
  stageDefs: PlaybackStageDef[]
  checkpointBySemesterStage: Map<string, typeof simulationStageCheckpoints.$inferInsert>
  courseLeaderFacultyIdByCurriculumNodeSectionSemester: Map<string, string>
  courseLeaderFacultyIdByOfferingId: Map<string, string>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
  facultyBudgetByKey: Map<string, number>
  hodFacultyId: string | null
  mentorFacultyIdByStudentId: Map<string, string>
  prerequisiteNodeIdsByTargetNodeId: Map<string, string[]>
  sectionRiskRateByStage: Map<string, number>
  sectionStudentCountBySemesterSection: Map<string, number>
  semesterNumbers: number[]
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  sources: StageCourseProjectionSource[]
  templateById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
  activeRiskArtifacts: {
    production: ProductionRiskModelArtifact | null
    correlations: CorrelationArtifact | null
  }
}

export type BuildPlaybackGovernanceArtifactsResult = {
  studentProjectionRows: Array<typeof simulationStageStudentProjections.$inferInsert>
  queueProjectionRows: Array<typeof simulationStageQueueProjections.$inferInsert>
  queueCaseRows: Array<typeof simulationStageQueueCases.$inferInsert>
  stageEvidenceRows: Array<typeof riskEvidenceSnapshots.$inferInsert>
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10
}

function sourceKeyForStageSource(source: StageCourseProjectionSource) {
  return `${source.studentId}::${source.semesterNumber}::${source.offeringId ?? ''}::${source.courseCode}`
}

function caseKeyForStageSource(source: StageCourseProjectionSource) {
  return `${source.studentId}::${source.semesterNumber}`
}

function queueCaseIdForSourceStage(source: StageCourseProjectionSource, simulationRunId: string, stageKey: PlaybackStageKey) {
  return buildDeterministicId('stage_queue_case', [simulationRunId, source.studentId, source.semesterNumber, stageKey])
}

function facultyAssignmentForSource(
  source: StageCourseProjectionSource,
  assignedRole: ProofQueueRole,
  input: Pick<
    BuildPlaybackGovernanceArtifactsInput,
    'courseLeaderFacultyIdByCurriculumNodeSectionSemester' | 'courseLeaderFacultyIdByOfferingId' | 'mentorFacultyIdByStudentId' | 'hodFacultyId'
  >,
) {
  const assignedFacultyId = assignedRole === 'Course Leader'
    ? (
      (source.offeringId ? input.courseLeaderFacultyIdByOfferingId.get(source.offeringId) : null)
      ?? (source.curriculumNodeId ? input.courseLeaderFacultyIdByCurriculumNodeSectionSemester.get(`${source.semesterNumber}::${source.sectionCode}::${source.curriculumNodeId}`) : null)
      ?? null
    )
    : assignedRole === 'Mentor'
      ? (input.mentorFacultyIdByStudentId.get(source.studentId) ?? null)
      : input.hodFacultyId
  return {
    assignedFacultyId,
    facultyBudgetKey: assignedFacultyId ? `${assignedRole}::${assignedFacultyId}::${source.semesterNumber}` : null,
  }
}

function buildStageCandidate(
  input: BuildPlaybackGovernanceArtifactsInput,
  source: StageCourseProjectionSource,
  checkpoint: typeof simulationStageCheckpoints.$inferInsert,
  stage: PlaybackStageDef,
  sourceState: SourceState,
): StageCandidate {
  const prerequisiteSummary = prerequisiteSummaryForSource({
    source,
    sourceByStudentNodeId: input.sourceByStudentNodeId,
    prerequisiteNodeIdsByTargetNodeId: input.prerequisiteNodeIdsByTargetNodeId,
    downstreamNodeIdsBySourceNodeId: input.downstreamNodeIdsBySourceNodeId,
    curriculumImportVersionId: input.run.curriculumImportVersionId ?? null,
    curriculumFeatureProfileFingerprint: input.run.curriculumFeatureProfileFingerprint ?? null,
  })
  const downstreamCarryover = downstreamCarryoverLabelForSource({
    source,
    sourceByStudentNodeId: input.sourceByStudentNodeId,
    downstreamNodeIdsBySourceNodeId: input.downstreamNodeIdsBySourceNodeId,
  })
  const evidence = buildStageEvidenceSnapshot({
    source,
    stageKey: stage.key,
    policy: input.policy,
    templatesById: input.templateById,
  })
  const sourceRefs: ObservableSourceRefsWithFeatureMetadata = {
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
    prerequisiteCompleteness: prerequisiteSummary.featureCompleteness,
    featureCompleteness: prerequisiteSummary.featureCompleteness,
    featureProvenance: prerequisiteSummary.featureProvenance,
    featureConfidenceClass: prerequisiteSummary.featureCompleteness.confidenceClass,
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
    sectionRiskRate: input.sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
    semesterProgress: stage.order / input.stageDefs.length,
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
    productionModel: input.activeRiskArtifacts.production,
    correlations: input.activeRiskArtifacts.correlations,
  })
  const policyComparison = buildActionPolicyComparison({
    stageKey: stage.key,
    evidence,
    riskBand: inference.riskBand,
    recommendedAction: inference.recommendedAction,
    prerequisiteSummary,
  })
  if (!policyComparison.actionCatalog.allCandidatesStageValid || !policyComparison.actionCatalog.recommendedActionStageValid) {
    throw new Error(`Policy action catalog validation failed for playback stage ${stage.key}`)
  }
  const stageNowIso = playbackCheckpointNowIso(input.run.createdAt, source.semesterNumber, stage)
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
      || stage.key === 'post-tt2'
      || stage.key === 'post-assignments'
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
    sectionRiskRate: input.sectionRiskRateByStage.get(`${source.semesterNumber}::${source.sectionCode}::${stage.key}`) ?? 0,
    semesterProgress: stage.order / input.stageDefs.length,
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
    productionModel: input.activeRiskArtifacts.production,
    correlations: input.activeRiskArtifacts.correlations,
  })
  const riskProbScaled = Math.round(inference.riskProb * 100)
  const noActionRiskProbScaled = Math.round(noActionInference.riskProb * 100)
  const riskChangeFromPreviousCheckpointScaled = sourceState.previousRiskProbScaled == null ? 0 : riskProbScaled - sourceState.previousRiskProbScaled
  const counterfactualLiftScaled = noActionRiskProbScaled - riskProbScaled
  const selectedPolicyCandidate = policyComparison.candidates.find(candidate => candidate.action === policyComparison.recommendedAction) ?? null
  const assignment = facultyAssignmentForSource(source, monitoring.queueOwnerRole as ProofQueueRole, input)

  return {
    checkpoint,
    stage,
    source,
    sourceKey: sourceKeyForStageSource(source),
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
}

export function buildPlaybackGovernanceArtifacts(
  input: BuildPlaybackGovernanceArtifactsInput,
): BuildPlaybackGovernanceArtifactsResult {
  const studentProjectionRows: Array<typeof simulationStageStudentProjections.$inferInsert> = []
  const queueProjectionRows: Array<typeof simulationStageQueueProjections.$inferInsert> = []
  const queueCaseRows: Array<typeof simulationStageQueueCases.$inferInsert> = []
  const stageEvidenceRows: Array<typeof riskEvidenceSnapshots.$inferInsert> = []

  const orderedSourcesForGovernance = (() => {
    const bySourceKey = new Map<string, StageCourseProjectionSource>()
    input.sources
      .slice()
      .sort((left, right) => left.studentId.localeCompare(right.studentId) || left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
      .forEach(source => {
        // Keep only the latest row for each source key to avoid duplicate deterministic IDs downstream.
        bySourceKey.set(sourceKeyForStageSource(source), source)
      })
    return Array.from(bySourceKey.values())
  })()
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

  for (const semesterNumber of input.semesterNumbers) {
    const semesterSources = orderedSourcesForGovernance.filter(source => source.semesterNumber === semesterNumber)
    for (const stage of input.stageDefs) {
      const checkpoint = input.checkpointBySemesterStage.get(`${semesterNumber}::${stage.key}`)
      if (!checkpoint) continue

      const stageCandidates = semesterSources.map(source =>
        buildStageCandidate(
          input,
          source,
          checkpoint,
          stage,
          sourceStateByKey.get(sourceKeyForStageSource(source))!,
        ))

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
          [...input.sectionStudentCountBySemesterSection.entries()].filter(([key]) => key.startsWith(`${semesterNumber}::`)),
        ),
        facultyBudgetByKey: input.facultyBudgetByKey,
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
          simulationStageQueueCaseId: queueCaseIdForSourceStage(primaryCandidate.source, input.simulationRunId, stage.key),
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
            queueCaseId: queueCaseIdForSourceStage(primaryCandidate.source, input.simulationRunId, stage.key),
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
          batchId: input.run.batchId,
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
        const queueCaseId = queueCaseIdForSourceStage(candidate.source, input.simulationRunId, stage.key)
        const projectionJson = {
          evidenceSnapshotId,
          stageKey: stage.key,
          stageLabel: stage.label,
          stageDescription: stage.description,
          stageOccurredAt: playbackCheckpointNowIso(input.run.createdAt, candidate.source.semesterNumber, stage),
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
              actionCatalog: candidate.policyComparison.actionCatalog,
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
            actionCatalog: candidate.policyComparison.actionCatalog,
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
              actionCatalog: candidate.policyComparison.actionCatalog,
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

  return {
    studentProjectionRows,
    queueProjectionRows,
    queueCaseRows,
    stageEvidenceRows,
  }
}
