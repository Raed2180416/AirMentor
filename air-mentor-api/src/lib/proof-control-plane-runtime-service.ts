import { desc, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
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
import {
  buildObservableFeaturePayload,
  featureHash,
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
  StageEvidenceSnapshot,
} from './msruas-proof-control-plane.js'

type RuntimeStageDef = {
  key: string
  label: string
  description: string
  order: number
}

export type ProofControlPlaneRuntimeServiceDeps = {
  PLAYBACK_STAGE_DEFS: RuntimeStageDef[]
  MONITORING_POLICY_VERSION: string
  average: (values: number[]) => number
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
    seePct: number | null
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
  const [observedRows, existingRiskRows, existingReassessments, existingResolutions, existingAlerts, existingEvidenceRows, teacherAllocationRows, teacherLoadRows, ownershipRows, mentorRows, grantRows] = await Promise.all([
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

  const currentSemesterNumber = Math.max(
    run.semesterEnd,
    observedRows.reduce((max, row) => Math.max(max, row.semesterNumber), 0),
  )
  const latestHistoricalByStudent = new Map<string, Record<string, unknown>>()
  observedRows
    .filter(row => row.semesterNumber < currentSemesterNumber)
    .sort((left, right) => right.semesterNumber - left.semesterNumber)
    .forEach(row => {
      if (!latestHistoricalByStudent.has(row.studentId)) {
        latestHistoricalByStudent.set(row.studentId, parseObservedStateRow(row))
      }
    })

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

  const rawCurrentSemesterRows = observedRows.filter(row => row.semesterNumber === currentSemesterNumber)
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
    const stageEvidence = stageCloseEvidenceByStudentOffering.get(`${row.studentId}::${offeringId}`) ?? null
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
    const noActionFeaturePayload = buildObservableFeaturePayload({
      attendancePct: noActionSnapshot.attendancePct,
      attendanceHistory: parseJson(JSON.stringify(payload.attendanceHistory ?? []), [] as Array<{ attendancePct: number }>),
      currentCgpa: noActionSnapshot.currentCgpa,
      backlogCount: noActionSnapshot.backlogCount,
      tt1Pct: Number(noActionSnapshot.tt1Pct ?? 0),
      tt2Pct: noActionSnapshot.tt2Pct,
      quizPct: noActionSnapshot.quizPct,
      assignmentPct: noActionSnapshot.assignmentPct,
      seePct: noActionSnapshot.seePct,
      weakCoCount: noActionSnapshot.weakCoCount,
      weakQuestionCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: Number(noActionSnapshot.interventionResponseScore ?? 0),
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
      tt1Pct: Number(noActionSnapshot.tt1Pct ?? 0),
      tt2Pct: noActionSnapshot.tt2Pct,
      quizPct: noActionSnapshot.quizPct,
      assignmentPct: noActionSnapshot.assignmentPct,
      seePct: noActionSnapshot.seePct,
      weakCoCount: noActionSnapshot.weakCoCount,
      attendanceHistoryRiskCount: noActionSnapshot.attendanceHistoryRiskCount,
      questionWeaknessCount: noActionSnapshot.weakQuestionCount,
      interventionResponseScore: Number(noActionSnapshot.interventionResponseScore ?? 0),
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
      liveCaseStateByKey.set(caseKey, {
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
