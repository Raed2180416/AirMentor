import { and, desc, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicRuntimeState,
  alertAcknowledgements,
  alertDecisions,
  alertOutcomes,
  facultyOfferingOwnerships,
  mentorAssignments,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  riskEvidenceSnapshots,
  riskOverrides,
  roleGrants,
  simulationQuestionTemplates,
  simulationResetSnapshots,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageStudentProjections,
  studentAssessmentScores,
  studentObservedSemesterStates,
  studentQuestionResults,
  teacherAllocations,
  teacherLoadProfiles,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { buildMissingGraphAwarePrerequisiteSummary } from './graph-summary.js'
import { parseJson } from './json.js'
import { buildMonitoringDecision } from './monitoring-engine.js'
import { MSRUAS_PROOF_BRANCH_ID, MSRUAS_PROOF_DEPARTMENT_ID } from './msruas-proof-sandbox.js'
import { parseObservedStateRow } from './proof-observed-state.js'
import { PROOF_DEMO_OPERATIONAL_THRESHOLDS } from './proof-demo-operational-band.js'
import {
  buildObservableFeaturePayload,
  featureHash,
  type ChallengerRiskModelArtifact,
  type CorrelationArtifact,
  type ObservableLabelPayload,
  type ObservableSourceRefs,
  type ProductionRiskModelArtifact,
  RISK_FEATURE_SCHEMA_VERSION,
  scoreObservableRiskWithModel,
} from './proof-risk-model.js'
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
  PolicyPhenotype,
  StageCourseProjectionSource,
  StageEvidenceSnapshot,
} from './msruas-proof-control-plane.js'
import type { StageEvidenceRealizationInput } from './proof-control-plane-playback-service.js'

type RuntimeStageDef = {
  key: string
  label: string
  description: string
  order: number
}

export function applyPolicyAndRebound(
  rawTt1: number | null,
  rawTt2: number | null,
  rawQuiz: number | null,
  rawAsgn: number | null,
  rawSee: number | null,
  policy: ResolvedPolicy
) {
  let tt1 = rawTt1 ?? 0
  let tt2 = rawTt2
  let quiz = rawQuiz
  let asgn = rawAsgn
  let see = rawSee

  if (tt2 != null && see != null && see > tt2 && tt1 > tt2) {
    tt2 += (see - tt2) * 0.5
  }

  const ttScale = policy.ceComponentCaps.termTestsWeight / 30
  const quizScale = policy.ceComponentCaps.quizWeight / 10
  const asgnScale = policy.ceComponentCaps.assignmentWeight / 20

  tt1 = Math.pow(tt1 / 100, ttScale) * 100
  if (tt2 != null) tt2 = Math.pow(tt2 / 100, ttScale) * 100
  if (quiz != null) quiz = Math.pow(quiz / 100, quizScale) * 100
  if (asgn != null) asgn = Math.pow(asgn / 100, asgnScale) * 100
  
  return { tt1, tt2, quiz, asgn, see }
}

function pctFromScoredComponents(rows: Array<typeof studentAssessmentScores.$inferSelect>, componentTypes: string[], _deps: Pick<ProofControlPlaneRuntimeServiceDeps, 'average'>) {
  const relevantRows = rows.filter(row => componentTypes.some(componentType => {
    if (componentType.endsWith('*')) return row.componentType.startsWith(componentType.slice(0, -1))
    return componentType === row.componentType
  }))
  if (relevantRows.length === 0) return null
  const totalScore = relevantRows.reduce((sum, row) => sum + row.score, 0)
  const totalMax = relevantRows.reduce((sum, row) => sum + row.maxScore, 0)
  if (totalMax <= 0) return null
  return Math.round((totalScore / totalMax) * 10000) / 100
}

function hasManualAssessmentPatch(patch: Record<string, unknown>) {
  return patch.tt1LeafScores != null
    || patch.tt2LeafScores != null
    || patch.quizScores != null
    || patch.assignmentScores != null
    || patch.seeScore != null
}

function recomputeCePct(payload: Record<string, unknown>, deps: Pick<ProofControlPlaneRuntimeServiceDeps, 'average'>) {
  const values = [payload.tt1Pct, payload.tt2Pct, payload.quizPct, payload.assignmentPct]
    .map(value => Number(value))
    .filter(Number.isFinite)
  return values.length > 0 ? Math.round(deps.average(values) * 100) / 100 : null
}

async function syncManualAssessmentScoresIntoObservedStates(
  db: AppDb,
  input: {
    simulationRunId: string
    policy: ResolvedPolicy
    now: string
  },
  deps: Pick<ProofControlPlaneRuntimeServiceDeps, 'average'>,
) {
  const [patchState] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'studentPatches'))
  const patches = parseJson(patchState?.payloadJson ?? '{}', {} as Record<string, Record<string, unknown>>)
  const manuallyEditedKeys = new Set(
    Object.entries(patches)
      .filter(([, patch]) => patch && typeof patch === 'object' && hasManualAssessmentPatch(patch))
      .map(([key]) => key),
  )
  if (manuallyEditedKeys.size === 0) return manuallyEditedKeys

  const observedRows = await db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId))
  const editableObservedRows = observedRows.filter(row => {
    const payload = parseObservedStateRow(row)
    const offeringId = String(payload.offeringId ?? '')
    return offeringId.length > 0 && manuallyEditedKeys.has(`${offeringId}::${row.studentId}`)
  })
  if (editableObservedRows.length === 0) return manuallyEditedKeys

  const assessmentRows = await db.select().from(studentAssessmentScores)
  const assessmentRowsByStudentOffering = new Map<string, Array<typeof studentAssessmentScores.$inferSelect>>()
  assessmentRows.forEach(row => {
    const key = `${row.offeringId}::${row.studentId}`
    if (!manuallyEditedKeys.has(key)) return
    assessmentRowsByStudentOffering.set(key, [...(assessmentRowsByStudentOffering.get(key) ?? []), row])
  })

  for (const row of editableObservedRows) {
    const payload = parseObservedStateRow(row)
    const offeringId = String(payload.offeringId ?? '')
    const key = `${offeringId}::${row.studentId}`
    const patch = patches[key] ?? {}
    const assessmentCells = assessmentRowsByStudentOffering.get(key) ?? []
    const nextPayload: Record<string, unknown> = { ...payload }

    if (patch.tt1LeafScores != null) nextPayload.tt1Pct = pctFromScoredComponents(assessmentCells, ['tt1', 'tt1_leaf'], deps)
    if (patch.tt2LeafScores != null) nextPayload.tt2Pct = pctFromScoredComponents(assessmentCells, ['tt2', 'tt2_leaf'], deps)
    if (patch.quizScores != null) nextPayload.quizPct = pctFromScoredComponents(assessmentCells, ['quiz*'], deps)
    if (patch.assignmentScores != null) nextPayload.assignmentPct = pctFromScoredComponents(assessmentCells, ['asgn*'], deps)
    if (patch.seeScore != null) nextPayload.seePct = pctFromScoredComponents(assessmentCells, ['sem_end', 'see'], deps)

    const cePct = recomputeCePct(nextPayload, deps)
    if (cePct != null) nextPayload.cePct = cePct
    if (nextPayload.seePct != null && cePct != null) {
      const ceMark = (cePct / 100) * input.policy.passRules.ceMaximum
      const seeMark = (Number(nextPayload.seePct) / 100) * input.policy.passRules.seeMaximum
      nextPayload.finalMark = Math.round((ceMark + seeMark) * 100) / 100
    }

    await db.update(studentObservedSemesterStates).set({
      observedStateJson: JSON.stringify(nextPayload),
      updatedAt: input.now,
    }).where(eq(studentObservedSemesterStates.studentObservedSemesterStateId, row.studentObservedSemesterStateId))
  }

  return manuallyEditedKeys
}

async function overlayManualAssessmentScoresIntoStageProjections(
  db: AppDb,
  input: {
    simulationRunId: string
    policy: ResolvedPolicy
    now: string
    manuallyEditedKeys: Set<string>
    activeRiskArtifacts: {
      production: ProductionRiskModelArtifact | null
      challenger: ChallengerRiskModelArtifact | null
      correlations: CorrelationArtifact | null
    }
  },
  deps: Pick<ProofControlPlaneRuntimeServiceDeps, 'average'>,
) {
  if (input.manuallyEditedKeys.size === 0) return
  const patchRows = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'studentPatches'))
  const patches = parseJson(patchRows[0]?.payloadJson ?? '{}', {} as Record<string, Record<string, unknown>>)
  const assessmentRows = await db.select().from(studentAssessmentScores)
  const assessmentRowsByStudentOffering = new Map<string, Array<typeof studentAssessmentScores.$inferSelect>>()
  assessmentRows.forEach(row => {
    const key = `${row.offeringId}::${row.studentId}`
    if (!input.manuallyEditedKeys.has(key)) return
    assessmentRowsByStudentOffering.set(key, [...(assessmentRowsByStudentOffering.get(key) ?? []), row])
  })
  const projectionRows = await db.select().from(simulationStageStudentProjections).where(eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId))
  for (const projection of projectionRows) {
    if (!projection.offeringId) continue
    const key = `${projection.offeringId}::${projection.studentId}`
    if (!input.manuallyEditedKeys.has(key)) continue
    const patch = patches[key] ?? {}
    const assessmentCells = assessmentRowsByStudentOffering.get(key) ?? []
    const projectionPayload = parseJson(projection.projectionJson, {} as Record<string, unknown>)
    const currentEvidence = projectionPayload.currentEvidence && typeof projectionPayload.currentEvidence === 'object'
      ? { ...(projectionPayload.currentEvidence as Record<string, unknown>) }
      : {}

    if (patch.tt1LeafScores != null) currentEvidence.tt1Pct = pctFromScoredComponents(assessmentCells, ['tt1', 'tt1_leaf'], deps)
    if (patch.tt2LeafScores != null) currentEvidence.tt2Pct = pctFromScoredComponents(assessmentCells, ['tt2', 'tt2_leaf'], deps)
    if (patch.quizScores != null) currentEvidence.quizPct = pctFromScoredComponents(assessmentCells, ['quiz*'], deps)
    if (patch.assignmentScores != null) currentEvidence.assignmentPct = pctFromScoredComponents(assessmentCells, ['asgn*'], deps)
    if (patch.seeScore != null) currentEvidence.seePct = pctFromScoredComponents(assessmentCells, ['sem_end', 'see'], deps)

    const cePct = recomputeCePct(currentEvidence, deps)
    if (cePct != null) currentEvidence.cePct = cePct
    if (currentEvidence.seePct != null && cePct != null) {
      const ceMark = (cePct / 100) * input.policy.passRules.ceMaximum
      const seeMark = (Number(currentEvidence.seePct) / 100) * input.policy.passRules.seeMaximum
      currentEvidence.overallPct = Math.round((ceMark + seeMark) * 100) / 100
    }

    const currentStatus = projectionPayload.currentStatus && typeof projectionPayload.currentStatus === 'object'
      ? projectionPayload.currentStatus as Record<string, unknown>
      : {}
    const adj = applyPolicyAndRebound(
      Number(currentEvidence.tt1Pct ?? 0),
      currentEvidence.tt2Pct == null ? null : Number(currentEvidence.tt2Pct),
      currentEvidence.quizPct == null ? null : Number(currentEvidence.quizPct),
      currentEvidence.assignmentPct == null ? null : Number(currentEvidence.assignmentPct),
      currentEvidence.seePct == null ? null : Number(currentEvidence.seePct),
      input.policy
    )
    const featurePayload = buildObservableFeaturePayload({
      attendancePct: Number(currentEvidence.attendancePct ?? 0),
      attendanceHistory: [],
      currentCgpa: Number(currentStatus.currentCgpa ?? 0),
      backlogCount: Number(currentStatus.backlogCount ?? 0),
      tt1Pct: adj.tt1,
      tt2Pct: adj.tt2,
      quizPct: adj.quiz,
      assignmentPct: adj.asgn,
      seePct: adj.see,
      weakCoCount: Number(currentEvidence.weakCoCount ?? 0),
      weakQuestionCount: Number(currentEvidence.weakQuestionCount ?? 0),
      interventionResponseScore: Number(currentEvidence.interventionResponseScore ?? 0),
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      semesterNumber: projection.semesterNumber,
      sectionRiskRate: 0,
      semesterProgress: Number((projectionPayload.stageOrder as number | undefined) ?? 1),
    })
    const missingPrerequisiteSummary = buildMissingGraphAwarePrerequisiteSummary({
      graphAvailable: false,
      historyAvailable: false,
    })
    const sourceRefs: ObservableSourceRefsWithFeatureMetadata = {
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: projection.simulationStageCheckpointId,
      studentId: projection.studentId,
      offeringId: projection.offeringId,
      semesterNumber: projection.semesterNumber,
      sectionCode: projection.sectionCode,
      courseCode: projection.courseCode,
      courseTitle: projection.courseTitle,
      courseFamily: 'manual-academic-evidence',
      coEvidenceMode: 'fallback-simulated',
      stageKey: typeof projectionPayload.stageKey === 'string' ? projectionPayload.stageKey : null,
      prerequisiteCourseCodes: [],
      prerequisiteWeakCourseCodes: [],
      prerequisiteCompleteness: missingPrerequisiteSummary.featureCompleteness,
      featureCompleteness: missingPrerequisiteSummary.featureCompleteness,
      featureProvenance: missingPrerequisiteSummary.featureProvenance,
      featureConfidenceClass: 'low',
      weakCourseOutcomeCodes: [],
      dominantQuestionTopics: [],
    }
    const inference = scoreObservableRiskWithModel({
      attendancePct: Number(currentEvidence.attendancePct ?? 0),
      currentCgpa: Number(currentStatus.currentCgpa ?? 0),
      backlogCount: Number(currentStatus.backlogCount ?? 0),
      tt1Pct: Number(currentEvidence.tt1Pct ?? 0),
      tt2Pct: currentEvidence.tt2Pct == null ? null : Number(currentEvidence.tt2Pct),
      quizPct: currentEvidence.quizPct == null ? null : Number(currentEvidence.quizPct),
      assignmentPct: currentEvidence.assignmentPct == null ? null : Number(currentEvidence.assignmentPct),
      cePct: currentEvidence.cePct == null ? null : Number(currentEvidence.cePct),
      seePct: currentEvidence.seePct == null ? null : Number(currentEvidence.seePct),
      overallPct: currentEvidence.overallPct == null ? null : Number(currentEvidence.overallPct),
      weakCoCount: Number(currentEvidence.weakCoCount ?? 0),
      attendanceHistoryRiskCount: 0,
      questionWeaknessCount: Number(currentEvidence.weakQuestionCount ?? 0),
      interventionResponseScore: Number(currentEvidence.interventionResponseScore ?? 0),
      policy: input.policy,
      featurePayload,
      sourceRefs,
      productionModel: input.activeRiskArtifacts.production,
      challengerModel: input.activeRiskArtifacts.challenger,
      correlations: input.activeRiskArtifacts.correlations,
      bandThresholdsOverride: PROOF_DEMO_OPERATIONAL_THRESHOLDS,
    })
    const riskProbScaled = Math.round(inference.riskProb * 100)
    await db.update(simulationStageStudentProjections).set({
      riskProbScaled,
      riskBand: inference.riskBand,
      recommendedAction: inference.recommendedAction,
      projectionJson: JSON.stringify({
        ...projectionPayload,
        currentEvidence,
        currentStatus: {
          ...currentStatus,
          riskBand: inference.riskBand,
          riskProbScaled,
          recommendedAction: inference.recommendedAction,
          attentionAreas: inference.attentionAreas,
          observableDrivers: inference.observableDrivers,
          modelVersion: inference.modelVersion,
          headProbabilities: inference.headProbabilities,
        },
        manualAcademicEvidenceApplied: true,
        manualAcademicEvidenceAppliedAt: input.now,
      }),
      updatedAt: input.now,
    }).where(eq(simulationStageStudentProjections.simulationStageStudentProjectionId, projection.simulationStageStudentProjectionId))
  }
}

export type ProofControlPlaneRuntimeServiceDeps = {
  PLAYBACK_STAGE_DEFS: RuntimeStageDef[]
  MONITORING_POLICY_VERSION: string
  average: (values: number[]) => number
  buildStageEvidenceSnapshot?: (input: {
    source: StageCourseProjectionSource
    stageKey: PlaybackStageKey
    policy: ResolvedPolicy
    templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
    realization?: StageEvidenceRealizationInput
  }) => StageEvidenceSnapshot
  buildActionPolicyComparison: (input: {
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
  }) => {
    recommendedAction: string | null
    policyPhenotype: PolicyPhenotype
    candidates: Array<{
      action: string
      utility: number
      nextCheckpointBenefitScaled?: number
      capacityCost?: number
    }>
    actionCatalog: {
      version: string
      stageKey: PlaybackStageKey
      stageActions: string[]
      phenotype: PolicyPhenotype
      phenotypeActions: string[]
      allCandidatesStageValid: boolean
      recommendedActionStageValid: boolean
    }
  }
  buildDeterministicId: (prefix: string, parts: Array<string | number>) => string
  buildNoActionSnapshot: (input: {
    evidence: StageEvidenceSnapshot
    actionTaken: string | null
    stageKey: PlaybackStageKey
  }) => {
    attendancePct: number
    currentCgpa: number
	    backlogCount: number
	    tt1Pct: number | null
	    tt2Pct: number | null
	    quizPct: number | null
	    assignmentPct: number | null
	    cePct: number | null
	    seePct: number | null
	    overallPct: number | null
	    weakCoCount: number
    weakQuestionCount: number
    interventionResponseScore: number | null
    attendanceHistoryRiskCount: number
  }
  ceShortfallLabelFromPct: (cePct: number, policy: ResolvedPolicy) => 0 | 1
  clamp: (value: number, min: number, max: number) => number
  createId: (prefix: string) => string
  emitSimulationAudit: (db: AppDb, input: {
    simulationRunId: string
    batchId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyId?: string | null
    now: string
  }) => Promise<void>
  insertRowsInChunks: <T>(db: AppDb, table: unknown, rows: T[], chunkSize?: number) => Promise<void>
  liveInterventionResponseScoreFromPayload: (input: {
    payload: Record<string, unknown>
    observedUpdatedAt?: string | null
    resolutionRow?: typeof reassessmentResolutions.$inferSelect | null
  }) => number | null
  loadActiveProofRiskArtifacts: (db: AppDb, batchId: string) => Promise<{
    production: ProductionRiskModelArtifact | null
    challenger: ChallengerRiskModelArtifact | null
    correlations: CorrelationArtifact | null
  }>
  observableSectionPressureFromEvidence: (evidence: {
    attendancePct: number | null | undefined
    tt1Pct: number | null | undefined
    tt2Pct: number | null | undefined
    seePct: number | null | undefined
    weakCoCount: number | null | undefined
    weakQuestionCount: number | null | undefined
  }) => number
  rebuildProofRiskArtifacts: (db: AppDb, input: {
    batchId: string
    simulationRunId: string
    actorFacultyId?: string | null
    now: string
  }) => Promise<unknown>
  rebuildSimulationStagePlayback: (db: AppDb, input: {
    simulationRunId: string
    policy: ResolvedPolicy
    now: string
  }) => Promise<unknown>
  roundToTwo: (value: number) => number
  startProofSimulationRun: (db: AppDb, input: {
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
  }) => Promise<{
    simulationRunId: string
    activeFlag: boolean
  }>
  summarizeQuestionPatterns: (input: {
    rows: Array<typeof studentQuestionResults.$inferSelect>
    templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
  }) => {
    weakQuestionCount: number
    carelessErrorCount: number
    transferGapCount: number
    commonWeakTopics: string[]
    commonWeakCourseOutcomes: string[]
  }
}

type RuntimeRunSemesterAuthorityLike = Pick<typeof simulationRuns.$inferSelect, 'activeOperationalSemester' | 'semesterEnd'>
type RuntimeObservedSemesterRowLike = Pick<typeof studentObservedSemesterStates.$inferSelect, 'studentId' | 'semesterNumber' | 'observedStateJson' | 'updatedAt'>

export function resolveRuntimeCurrentSemesterNumber(
  run: RuntimeRunSemesterAuthorityLike,
  observedRows: RuntimeObservedSemesterRowLike[],
) {
  if (run.activeOperationalSemester != null && run.activeOperationalSemester > 0) {
    return run.activeOperationalSemester
  }
  return Math.max(
    run.semesterEnd,
    observedRows.reduce((max, row) => Math.max(max, row.semesterNumber), 0),
  )
}

export function buildLatestHistoricalPayloadByStudent(
  observedRows: RuntimeObservedSemesterRowLike[],
  currentSemesterNumber: number,
) {
  const latestHistoricalByStudent = new Map<string, Record<string, unknown>>()
  observedRows
    .filter(row => row.semesterNumber < currentSemesterNumber)
    .slice()
    .sort((left, right) => (
      right.semesterNumber - left.semesterNumber
      || String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? ''))
    ))
    .forEach(row => {
      if (!latestHistoricalByStudent.has(row.studentId)) {
        latestHistoricalByStudent.set(row.studentId, parseObservedStateRow(row))
      }
    })
  return latestHistoricalByStudent
}

export async function restoreProofSimulationSnapshot(db: AppDb, input: {
  simulationRunId: string
  simulationResetSnapshotId?: string
  policy: ResolvedPolicy
  actorFacultyId?: string | null
  now: string
}, deps: ProofControlPlaneRuntimeServiceDeps) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const snapshotRows = await db.select().from(simulationResetSnapshots).where(eq(simulationResetSnapshots.simulationRunId, run.simulationRunId)).orderBy(desc(simulationResetSnapshots.createdAt))
  const snapshot = input.simulationResetSnapshotId
    ? snapshotRows.find(row => row.simulationResetSnapshotId === input.simulationResetSnapshotId)
    : snapshotRows[0]
  if (!snapshot) throw new Error('Simulation snapshot not found')
  const payload = parseJson(snapshot.snapshotJson, {} as Record<string, unknown>)
  return deps.startProofSimulationRun(db, {
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
}, deps: ProofControlPlaneRuntimeServiceDeps) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')
  const manuallyEditedStudentOfferingKeys = await syncManualAssessmentScoresIntoObservedStates(db, {
    simulationRunId: input.simulationRunId,
    policy: input.policy,
    now: input.now,
  }, deps)
  const [_observedRows, existingRiskRows, existingReassessments, existingResolutions, existingAlerts, existingEvidenceRows, teacherAllocationRows, teacherLoadRows, ownershipRows, mentorRows, grantRows] = await Promise.all([
    db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId)),
    db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, input.simulationRunId)),
    db.select().from(reassessmentEvents),
    db.select().from(reassessmentResolutions),
    db.select().from(alertDecisions),
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
    await deps.rebuildSimulationStagePlayback(db, {
      simulationRunId: input.simulationRunId,
      policy: input.policy,
      now: input.now,
    })
    await deps.rebuildProofRiskArtifacts(db, {
      batchId: run.batchId,
      simulationRunId: input.simulationRunId,
      actorFacultyId: input.actorFacultyId ?? null,
      now: input.now,
    })
  }
  const refreshedObservedRows = await db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId))
  const activeRiskArtifacts = await deps.loadActiveProofRiskArtifacts(db, run.batchId)
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

  const currentSemesterNumber = resolveRuntimeCurrentSemesterNumber(run, refreshedObservedRows)
  const latestHistoricalByStudent = buildLatestHistoricalPayloadByStudent(refreshedObservedRows, currentSemesterNumber)

  const stageCloseEvidenceByStudentOffering = new Map<string, {
    featurePayload: ReturnType<typeof buildObservableFeaturePayload>
    labelPayload: ObservableLabelPayload
    sourceRefs: ObservableSourceRefs
  }>()
  runEvidenceRows
    .filter(row => row.stageKey === 'post-see')
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

  const liveStageSourceKey = (studentId: string, offeringId: string, courseCode: string) => `${studentId}::${currentSemesterNumber}::${offeringId}::${courseCode}`
  const liveCaseKey = (studentId: string) => `${studentId}::${currentSemesterNumber}`
  const liveQueueCaseId = (studentId: string, stageKey: ProofQueueGovernanceStageKey) => deps.buildDeterministicId('runtime_queue_case', [input.simulationRunId, studentId, currentSemesterNumber, stageKey])
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
  const currentSemesterLoads = teacherLoadRows.filter(row => row.semesterNumber === currentSemesterNumber)
  const currentSemesterLoadAverage = deps.average(currentSemesterLoads.map(row => row.weeklyContactHours))
  const currentSemesterOverloadThreshold = Math.max(8, Math.ceil(currentSemesterLoadAverage * 1.25))
  currentSemesterLoads.forEach(row => {
    overloadPenaltyBySemesterFaculty.set(row.facultyId, row.weeklyContactHours > currentSemesterOverloadThreshold ? 2 : 0)
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
  currentSemesterLoads.forEach(row => {
    const overloadPenalty = overloadPenaltyBySemesterFaculty.get(row.facultyId) ?? 0
    const ownedOfferingCount = teacherAllocationRows.filter(allocation =>
      allocation.semesterNumber === currentSemesterNumber
      && allocation.facultyId === row.facultyId
      && allocation.allocationRole === 'course-leader').length
    facultyBudgetByKey.set(`Course Leader::${row.facultyId}::${currentSemesterNumber}`, deps.clamp(4 + ownedOfferingCount - overloadPenalty, 2, 12))
    facultyBudgetByKey.set(`Mentor::${row.facultyId}::${currentSemesterNumber}`, deps.clamp(6 + Math.ceil((mentorAssignmentCountByFacultyId.get(row.facultyId) ?? 0) / 15) - overloadPenalty, 4, 18))
    facultyBudgetByKey.set(`HoD::${row.facultyId}::${currentSemesterNumber}`, deps.clamp(8 + supervisedSectionCount - overloadPenalty, 6, 24))
  })
  const runtimeFacultyAssignment = (studentId: string, offeringId: string, assignedRole: ProofQueueRole) => {
    const assignedFacultyId = assignedRole === 'Course Leader'
      ? (courseLeaderFacultyIdByOfferingId.get(offeringId) ?? null)
      : assignedRole === 'Mentor'
        ? (mentorFacultyIdByStudentId.get(studentId) ?? null)
        : hodFacultyId
    return {
      assignedFacultyId,
      facultyBudgetKey: assignedFacultyId ? `${assignedRole}::${assignedFacultyId}::${currentSemesterNumber}` : null,
    }
  }
  const questionPatternBaseline = deps.summarizeQuestionPatterns({
    rows: [],
    templatesById: new Map<string, typeof simulationQuestionTemplates.$inferSelect>(),
  })
  const liveStageKeyForPayload = (payload: Record<string, unknown>): ProofQueueGovernanceStageKey => {
    if (payload.seePct != null) return 'post-see'
    if (payload.assignmentPct != null) return 'post-assignments'
    if (payload.tt2Pct != null) return 'post-tt2'
    if (payload.tt1Pct != null) return 'post-tt1'
    return 'pre-tt1'
  }

  const rawCurrentSemesterRows = refreshedObservedRows.filter(row => row.semesterNumber === currentSemesterNumber)
  const currentSemesterRowsByStudentOffering = new Map<string, typeof studentObservedSemesterStates.$inferSelect>()
  for (const row of rawCurrentSemesterRows) {
    const payload = parseObservedStateRow(row)
    const offeringId = String(payload.offeringId ?? '')
    if (!offeringId) continue
    const key = `${row.studentId}::${offeringId}`
    const existing = currentSemesterRowsByStudentOffering.get(key)
    if (!existing
      || row.updatedAt > existing.updatedAt
      || (row.updatedAt === existing.updatedAt && row.studentObservedSemesterStateId > existing.studentObservedSemesterStateId)) {
      currentSemesterRowsByStudentOffering.set(key, row)
    }
  }
  const currentSemesterRows = [...currentSemesterRowsByStudentOffering.values()]
  const currentSemesterSectionStudentCountByKey = new Map<string, number>()
  Array.from(new Set(currentSemesterRows.map(row => `${row.semesterNumber}::${row.sectionCode}::${row.studentId}`)))
    .forEach(key => {
      const [semesterNumber, sectionCode] = key.split('::')
      const sectionKey = `${semesterNumber}::${sectionCode}`
      currentSemesterSectionStudentCountByKey.set(sectionKey, (currentSemesterSectionStudentCountByKey.get(sectionKey) ?? 0) + 1)
    })
  const sectionRiskRateBySemesterSection = new Map<string, number>()
  const sectionRiskRateSeed = new Map<string, number[]>()
  for (const row of currentSemesterRows) {
    const payload = parseObservedStateRow(row)
    const sectionKey = `${row.semesterNumber}::${row.sectionCode}`
    const observablePressure = deps.observableSectionPressureFromEvidence({
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
    sectionRiskRateBySemesterSection.set(key, deps.roundToTwo(deps.average(values)))
  })
  const riskRows: Array<typeof riskAssessments.$inferInsert> = []
  const activeEvidenceRows: Array<typeof riskEvidenceSnapshots.$inferInsert> = []
  const reassessmentRows: Array<typeof reassessmentEvents.$inferInsert> = []
  const alertRows: Array<typeof alertDecisions.$inferInsert> = []
  const alertOutcomeRows: Array<typeof alertOutcomes.$inferInsert> = []
  const manuallyEditedProjectionUpdates: Array<{
    studentId: string
    offeringId: string
    semesterNumber: number
    stageKey: ProofQueueGovernanceStageKey
    riskProbScaled: number
    riskBand: 'High' | 'Medium' | 'Low'
    noActionRiskProbScaled: number
    noActionRiskBand: 'High' | 'Medium' | 'Low'
    recommendedAction: string | null
    currentEvidence: StageEvidenceSnapshot
    currentStatus: ReturnType<typeof scoreObservableRiskWithModel>
    counterfactualLiftScaled: number
  }> = []
  const runtimeQueueCandidates: Array<{
    caseKey: string
    sourceKey: string
    stageKey: ProofQueueGovernanceStageKey
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
  for (const row of currentSemesterRows) {
    const payload = parseObservedStateRow(row)
    const historical = latestHistoricalByStudent.get(row.studentId) ?? {}
    const offeringId = String(payload.offeringId ?? '')
    if (!offeringId) continue
    const manualEvidenceKey = `${offeringId}::${row.studentId}`
    const stageEvidence = manuallyEditedStudentOfferingKeys.has(manualEvidenceKey)
      ? null
      : (stageCloseEvidenceByStudentOffering.get(`${row.studentId}::${offeringId}`) ?? null)
    const latestResolutionRow = latestResolutionByStudentOffering.get(`${row.studentId}::${offeringId}`) ?? null
    const interventionResponseScore = deps.liveInterventionResponseScoreFromPayload({
      payload,
      observedUpdatedAt: row.updatedAt,
      resolutionRow: latestResolutionRow,
    }) ?? 0
    const missingPrerequisiteSummary = buildMissingGraphAwarePrerequisiteSummary({
      graphAvailable: false,
      historyAvailable: false,
    })
    const defaultSourceRefs: ObservableSourceRefsWithFeatureMetadata = {
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: null,
      studentId: row.studentId,
      offeringId,
      semesterNumber: currentSemesterNumber,
      sectionCode: row.sectionCode,
      courseCode: String(payload.courseCode ?? 'NA'),
      courseTitle: String(payload.courseTitle ?? payload.courseCode ?? 'Unknown'),
      courseFamily: String(payload.assessmentProfile ?? 'general'),
      coEvidenceMode: 'fallback-simulated',
      stageKey: null,
      prerequisiteCourseCodes: [],
      prerequisiteWeakCourseCodes: [],
      prerequisiteCompleteness: missingPrerequisiteSummary.featureCompleteness,
      featureCompleteness: missingPrerequisiteSummary.featureCompleteness,
      featureProvenance: missingPrerequisiteSummary.featureProvenance,
      featureConfidenceClass: missingPrerequisiteSummary.featureCompleteness.confidenceClass,
      weakCourseOutcomeCodes: [],
      dominantQuestionTopics: [],
    }
    const stageSourceRefs = stageEvidence?.sourceRefs as Partial<ObservableSourceRefsWithFeatureMetadata> | null
    const resolvedFeatureCompleteness = stageSourceRefs?.featureCompleteness
      ?? stageSourceRefs?.prerequisiteCompleteness
      ?? missingPrerequisiteSummary.featureCompleteness
    const resolvedFeatureProvenance = stageSourceRefs?.featureProvenance
      ?? missingPrerequisiteSummary.featureProvenance
    const fallbackSourceRefs: ObservableSourceRefsWithFeatureMetadata = {
      ...defaultSourceRefs,
      ...(stageSourceRefs ?? {}),
      simulationRunId: defaultSourceRefs.simulationRunId,
      simulationStageCheckpointId: stageSourceRefs?.simulationStageCheckpointId ?? defaultSourceRefs.simulationStageCheckpointId,
      studentId: defaultSourceRefs.studentId,
      offeringId: defaultSourceRefs.offeringId,
      semesterNumber: defaultSourceRefs.semesterNumber,
      sectionCode: defaultSourceRefs.sectionCode,
      courseCode: defaultSourceRefs.courseCode,
      courseTitle: defaultSourceRefs.courseTitle,
      courseFamily: stageSourceRefs?.courseFamily ?? defaultSourceRefs.courseFamily,
      coEvidenceMode: stageSourceRefs?.coEvidenceMode ?? defaultSourceRefs.coEvidenceMode,
      stageKey: stageSourceRefs?.stageKey ?? defaultSourceRefs.stageKey,
      prerequisiteCourseCodes: stageSourceRefs?.prerequisiteCourseCodes ?? defaultSourceRefs.prerequisiteCourseCodes,
      prerequisiteWeakCourseCodes: stageSourceRefs?.prerequisiteWeakCourseCodes ?? defaultSourceRefs.prerequisiteWeakCourseCodes,
      prerequisiteCompleteness: resolvedFeatureCompleteness,
      featureCompleteness: resolvedFeatureCompleteness,
      featureProvenance: resolvedFeatureProvenance,
      featureConfidenceClass: stageSourceRefs?.featureConfidenceClass ?? resolvedFeatureCompleteness.confidenceClass,
      weakCourseOutcomeCodes: stageSourceRefs?.weakCourseOutcomeCodes ?? defaultSourceRefs.weakCourseOutcomeCodes,
      dominantQuestionTopics: stageSourceRefs?.dominantQuestionTopics ?? defaultSourceRefs.dominantQuestionTopics,
    }
    const adj = applyPolicyAndRebound(
      Number(payload.tt1Pct ?? 0),
      payload.tt2Pct == null ? null : Number(payload.tt2Pct),
      payload.quizPct == null ? null : Number(payload.quizPct),
      payload.assignmentPct == null ? null : Number(payload.assignmentPct),
      payload.seePct == null ? null : Number(payload.seePct),
      input.policy
    )
    const featurePayload = stageEvidence?.featurePayload ?? buildObservableFeaturePayload({
      attendancePct: Number(payload.attendancePct ?? 0),
      attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as Array<{ attendancePct: number }>),
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
	      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
	      tt1Pct: adj.tt1,
	      tt2Pct: adj.tt2,
	      quizPct: adj.quiz,
	      assignmentPct: adj.asgn,
	      seePct: adj.see,
	      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      interventionResponseScore,
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      semesterNumber: row.semesterNumber,
      sectionRiskRate: sectionRiskRateBySemesterSection.get(`${row.semesterNumber}::${row.sectionCode}`) ?? 0,
      semesterProgress: 1,
    })
    const labelPayload = stageEvidence?.labelPayload ?? {
      attendanceRiskLabel: Number(payload.attendancePct ?? 0) < input.policy.attendanceRules.minimumRequiredPercent ? 1 : 0,
      ceShortfallLabel: deps.ceShortfallLabelFromPct(Number(payload.cePct ?? 0), input.policy),
      seeShortfallLabel: Number(payload.seePct ?? 0) < ((input.policy.passRules.minimumSeeMark / input.policy.passRules.seeMaximum) * 100) ? 1 : 0,
      overallCourseFailLabel: String(payload.result ?? 'Unknown') === 'Passed' ? 0 : 1,
      downstreamCarryoverLabel: 0,
    } satisfies ObservableLabelPayload
    const liveStageKey = liveStageKeyForPayload(payload)
    const liveStage = deps.PLAYBACK_STAGE_DEFS.find(item => item.key === liveStageKey) ?? deps.PLAYBACK_STAGE_DEFS[0]
    const inference = scoreObservableRiskWithModel({
      attendancePct: Number(payload.attendancePct ?? 0),
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
      tt1Pct: adj.tt1,
	      tt2Pct: adj.tt2,
	      quizPct: adj.quiz,
	      assignmentPct: adj.asgn,
	      cePct: payload.cePct == null ? null : Number(payload.cePct),
	      seePct: adj.see,
	      overallPct: payload.finalMark == null ? null : Number(payload.finalMark),
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
      challengerModel: activeRiskArtifacts.challenger,
      correlations: activeRiskArtifacts.correlations,
      bandThresholdsOverride: PROOF_DEMO_OPERATIONAL_THRESHOLDS,
    })
    const liveEvidence: StageEvidenceSnapshot = {
      attendancePct: Number(payload.attendancePct ?? 0),
      tt1Pct: Number(payload.tt1Pct ?? 0),
      tt2Pct: payload.tt2Pct == null ? null : Number(payload.tt2Pct),
      quizPct: payload.quizPct == null ? null : Number(payload.quizPct),
      assignmentPct: payload.assignmentPct == null ? null : Number(payload.assignmentPct),
      cePct: payload.cePct == null ? null : Number(payload.cePct),
      seePct: payload.seePct == null ? null : Number(payload.seePct),
      overallPct: payload.finalMark == null ? null : Number(payload.finalMark),
      weakCoCount: Number(payload.weakCoCount ?? 0),
      weakQuestionCount: Number((payload.questionEvidenceSummary as Record<string, unknown> | undefined)?.weakQuestionCount ?? 0),
      attentionAreas: [],
      attendanceHistoryRiskCount: Array.isArray(payload.attendanceHistory)
        ? payload.attendanceHistory.filter(entry => Number((entry as Record<string, unknown>).attendancePct ?? 0) < input.policy.attendanceRules.minimumRequiredPercent).length
        : 0,
      currentCgpa: Number(historical.cgpaAfterSemester ?? payload.cgpa ?? 0),
      backlogCount: Number(historical.backlogCount ?? payload.backlogCount ?? 0),
      interventionResponseScore,
      evidenceWindow: payload.seePct != null ? `semester-${currentSemesterNumber}-see` : payload.tt2Pct != null ? `semester-${currentSemesterNumber}-tt2` : payload.tt1Pct != null ? `semester-${currentSemesterNumber}-tt1` : `semester-${currentSemesterNumber}-start`,
      weakCourseOutcomes: [],
      questionPatterns: questionPatternBaseline,
    }
    const policyComparison = deps.buildActionPolicyComparison({
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
    if (!policyComparison.actionCatalog.allCandidatesStageValid || !policyComparison.actionCatalog.recommendedActionStageValid) {
      throw new Error(`Policy action catalog validation failed for runtime stage ${liveStageKey}`)
    }
    const noActionSnapshot = deps.buildNoActionSnapshot({
      evidence: liveEvidence,
      actionTaken: policyComparison.recommendedAction,
      stageKey: liveStageKey,
    })
    const adjNoAct = applyPolicyAndRebound(
      Number(noActionSnapshot.tt1Pct ?? 0),
      noActionSnapshot.tt2Pct,
      noActionSnapshot.quizPct,
      noActionSnapshot.assignmentPct,
      noActionSnapshot.seePct,
      input.policy
    )
    const noActionFeaturePayload = buildObservableFeaturePayload({
      attendancePct: noActionSnapshot.attendancePct,
      attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as Array<{ attendancePct: number }>),
	      currentCgpa: noActionSnapshot.currentCgpa,
	      backlogCount: noActionSnapshot.backlogCount,
	      tt1Pct: adjNoAct.tt1,
	      tt2Pct: adjNoAct.tt2,
	      quizPct: adjNoAct.quiz,
	      assignmentPct: adjNoAct.asgn,
	      seePct: adjNoAct.see,
	      weakCoCount: noActionSnapshot.weakCoCount,
      weakQuestionCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: Number(noActionSnapshot.interventionResponseScore ?? 0),
      prerequisiteAveragePct: 0,
      prerequisiteFailureCount: 0,
      prerequisiteCourseCodes: [],
      semesterNumber: currentSemesterNumber,
      sectionRiskRate: sectionRiskRateBySemesterSection.get(`${row.semesterNumber}::${row.sectionCode}`) ?? 0,
      semesterProgress: liveStage?.order ?? 1,
    })
    const noActionInference = scoreObservableRiskWithModel({
      attendancePct: noActionSnapshot.attendancePct,
      currentCgpa: noActionSnapshot.currentCgpa,
	      backlogCount: noActionSnapshot.backlogCount,
	      tt1Pct: adjNoAct.tt1,
	      tt2Pct: adjNoAct.tt2,
	      quizPct: adjNoAct.quiz,
	      assignmentPct: adjNoAct.asgn,
	      seePct: adjNoAct.see,
	      cePct: noActionSnapshot.cePct == null ? null : Number(noActionSnapshot.cePct),
	      overallPct: noActionSnapshot.overallPct == null ? null : Number(noActionSnapshot.overallPct),
	      weakCoCount: noActionSnapshot.weakCoCount,
      attendanceHistoryRiskCount: noActionSnapshot.attendanceHistoryRiskCount,
      questionWeaknessCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: Number(noActionSnapshot.interventionResponseScore ?? 0),
      policy: input.policy,
      featurePayload: noActionFeaturePayload,
      sourceRefs: fallbackSourceRefs,
      productionModel: activeRiskArtifacts.production,
      challengerModel: activeRiskArtifacts.challenger,
      correlations: activeRiskArtifacts.correlations,
      bandThresholdsOverride: PROOF_DEMO_OPERATIONAL_THRESHOLDS,
    })
    if (manuallyEditedStudentOfferingKeys.has(manualEvidenceKey)) {
      manuallyEditedProjectionUpdates.push({
        studentId: row.studentId,
        offeringId,
        semesterNumber: currentSemesterNumber,
        stageKey: liveStageKey,
        riskProbScaled: Math.round(inference.riskProb * 100),
        riskBand: inference.riskBand,
        noActionRiskProbScaled: Math.round(noActionInference.riskProb * 100),
        noActionRiskBand: noActionInference.riskBand,
        recommendedAction: inference.recommendedAction,
        currentEvidence: liveEvidence,
        currentStatus: inference,
        counterfactualLiftScaled: Math.round(noActionInference.riskProb * 100) - Math.round(inference.riskProb * 100),
      })
    }
    const monitoring = buildMonitoringDecision({
      riskProb: inference.riskProb,
      riskBand: inference.riskBand,
      previousRiskBand: null,
      cooldownUntil: null,
      evidenceWindowCount: liveStage?.order ?? 1,
      interventionResidual: interventionResponseScore,
      nowIso: input.now,
    })
    const riskAssessmentId = deps.createId('risk_assessment')
    const evidenceSnapshotId = deps.buildDeterministicId('risk_evidence_active', [input.simulationRunId, row.studentId, offeringId])
    activeEvidenceRows.push({
      riskEvidenceSnapshotId: evidenceSnapshotId,
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: null,
      batchId: run.batchId,
      studentId: row.studentId,
      offeringId,
      semesterNumber: currentSemesterNumber,
      sectionCode: row.sectionCode,
      courseCode: String(payload.courseCode ?? 'NA'),
      courseTitle: String(payload.courseTitle ?? payload.courseCode ?? 'Unknown'),
      stageKey: null,
      evidenceWindow: payload.seePct != null ? `semester-${currentSemesterNumber}-see` : payload.tt2Pct != null ? `semester-${currentSemesterNumber}-tt2` : payload.tt1Pct != null ? `semester-${currentSemesterNumber}-tt1` : `semester-${currentSemesterNumber}-start`,
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
      evidenceWindow: payload.seePct != null ? `semester-${currentSemesterNumber}-see` : payload.tt2Pct != null ? `semester-${currentSemesterNumber}-tt2` : payload.tt1Pct != null ? `semester-${currentSemesterNumber}-tt1` : `semester-${currentSemesterNumber}-start`,
      evidenceSnapshotId,
      modelVersion: inference.modelVersion,
      policyVersion: 'resolved-batch-policy',
      sourceType: 'simulation',
      assessedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    const alertDecisionId = deps.createId('alert_decision')
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
      monitoringPolicyVersion: deps.MONITORING_POLICY_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    })
    alertOutcomeRows.push({
      alertOutcomeId: deps.createId('alert_outcome'),
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
  deps.PLAYBACK_STAGE_DEFS.forEach(stage => {
    const stageCandidates = runtimeQueueCandidates.filter(candidate => candidate.stageKey === stage.key)
    if (stageCandidates.length === 0) return
    const governance = governProofQueueStage({
      stageKey: stage.key as ProofQueueGovernanceStageKey,
      candidates: stageCandidates.map(candidate => ({
        caseKey: candidate.caseKey,
        sourceKey: candidate.sourceKey,
        studentId: candidate.studentId,
        semesterNumber: currentSemesterNumber,
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
      sectionStudentCountByKey: currentSemesterSectionStudentCountByKey,
      facultyBudgetByKey,
    })

    const decisionsBySourceKey = new Map<string, typeof governance.decisions extends Map<any, infer V> ? V : never>()
    governance.decisions.forEach(decision => {
      if (decision.primarySourceKey) decisionsBySourceKey.set(decision.primarySourceKey, decision)
      decision.supportingSourceKeys.forEach(sourceKey => decisionsBySourceKey.set(sourceKey, decision))
    })

    const primaryCandidateByConcernContextKey = new Map<string, typeof runtimeQueueCandidates[number]>()
    stageCandidates.forEach(candidate => {
      const decision = decisionsBySourceKey.get(candidate.sourceKey)
      if (!decision || decision.primarySourceKey !== candidate.sourceKey) return
      primaryCandidateByConcernContextKey.set(decision.concernContextKey, candidate)
    })

    stageCandidates.forEach(candidate => {
      const decision = decisionsBySourceKey.get(candidate.sourceKey) ?? null
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
      } else if (decision?.status === 'deferred') {
        alertRow.decisionType = 'deferred'
        alertOutcomeRow.outcomeStatus = 'Suppressed'
      } else {
        alertRow.decisionType = 'suppress'
        alertOutcomeRow.outcomeStatus = 'Suppressed'
      }
    })

    governance.decisions.forEach((decision, concernContextKey) => {
      const primaryCandidate = primaryCandidateByConcernContextKey.get(concernContextKey)
      if (!primaryCandidate) return
      if (decision.status === 'opened' || decision.status === 'open') {
        reassessmentRows.push({
          reassessmentEventId: deps.createId('reassessment'),
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
      liveCaseStateByKey.set(liveCaseKey(primaryCandidate.studentId), {
        open: decision.status === 'opened' || decision.status === 'open',
        primarySourceKey: decision.primarySourceKey,
      })
    })
  })
  if (activeEvidenceRows.length > 0) await deps.insertRowsInChunks(db, riskEvidenceSnapshots, activeEvidenceRows)
  if (riskRows.length > 0) await db.insert(riskAssessments).values(riskRows)
  if (reassessmentRows.length > 0) await db.insert(reassessmentEvents).values(reassessmentRows)
  if (alertRows.length > 0) await db.insert(alertDecisions).values(alertRows)
  if (alertOutcomeRows.length > 0) await db.insert(alertOutcomes).values(alertOutcomeRows)

  await deps.rebuildSimulationStagePlayback(db, {
    simulationRunId: input.simulationRunId,
    policy: input.policy,
    now: input.now,
  })
  await overlayManualAssessmentScoresIntoStageProjections(db, {
    simulationRunId: input.simulationRunId,
    policy: input.policy,
    now: input.now,
    manuallyEditedKeys: manuallyEditedStudentOfferingKeys,
    activeRiskArtifacts,
  }, deps)

  for (const update of manuallyEditedProjectionUpdates) {
    const [checkpoint] = await db.select().from(simulationStageCheckpoints).where(and(
      eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId),
      eq(simulationStageCheckpoints.semesterNumber, update.semesterNumber),
      eq(simulationStageCheckpoints.stageKey, update.stageKey),
    ))
    if (!checkpoint) continue
    const [projection] = await db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId),
      eq(simulationStageStudentProjections.simulationStageCheckpointId, checkpoint.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, update.studentId),
      eq(simulationStageStudentProjections.offeringId, update.offeringId),
    ))
    if (!projection) continue
    const projectionPayload = parseJson(projection.projectionJson, {} as Record<string, unknown>)
    const currentStatus = projectionPayload.currentStatus && typeof projectionPayload.currentStatus === 'object'
      ? projectionPayload.currentStatus as Record<string, unknown>
      : {}
    const nextProjectionPayload = {
      ...projectionPayload,
      currentEvidence: {
        ...(projectionPayload.currentEvidence && typeof projectionPayload.currentEvidence === 'object' ? projectionPayload.currentEvidence as Record<string, unknown> : {}),
        attendancePct: update.currentEvidence.attendancePct,
        tt1Pct: update.currentEvidence.tt1Pct,
        tt2Pct: update.currentEvidence.tt2Pct,
        quizPct: update.currentEvidence.quizPct,
        assignmentPct: update.currentEvidence.assignmentPct,
        cePct: update.currentEvidence.cePct,
        seePct: update.currentEvidence.seePct,
        overallPct: update.currentEvidence.overallPct,
        weakCoCount: update.currentEvidence.weakCoCount,
        weakQuestionCount: update.currentEvidence.weakQuestionCount,
      },
      currentStatus: {
        ...currentStatus,
        riskBand: update.riskBand,
        riskProbScaled: update.riskProbScaled,
        noActionRiskBand: update.noActionRiskBand,
        noActionRiskProbScaled: update.noActionRiskProbScaled,
        counterfactualLiftScaled: update.counterfactualLiftScaled,
        recommendedAction: update.recommendedAction,
        attentionAreas: update.currentStatus.attentionAreas,
        observableDrivers: update.currentStatus.observableDrivers,
        modelVersion: update.currentStatus.modelVersion,
        headProbabilities: update.currentStatus.headProbabilities,
      },
      manualAcademicEvidenceApplied: true,
      manualAcademicEvidenceAppliedAt: input.now,
    }
    await db.update(simulationStageStudentProjections).set({
      riskProbScaled: update.riskProbScaled,
      riskBand: update.riskBand,
      noActionRiskProbScaled: update.noActionRiskProbScaled,
      noActionRiskBand: update.noActionRiskBand,
      recommendedAction: update.recommendedAction,
      projectionJson: JSON.stringify(nextProjectionPayload),
      updatedAt: input.now,
    }).where(eq(simulationStageStudentProjections.simulationStageStudentProjectionId, projection.simulationStageStudentProjectionId))
  }

  await deps.emitSimulationAudit(db, {
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
