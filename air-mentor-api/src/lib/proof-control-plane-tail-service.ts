import { createHash } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import {
  academicTerms,
  alertAcknowledgements,
  alertDecisions,
  batches,
  branches,
  courses,
  electiveRecommendations,
  facultyOfferingOwnerships,
  mentorAssignments,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  riskEvidenceSnapshots,
  riskOverrides,
  sectionOfferings,
  simulationQuestionTemplates,
  simulationRuns,
  simulationStageCheckpoints,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentAgentCards,
  studentAgentMessages,
  studentAgentSessions,
  studentBehaviorProfiles,
  studentCoStates,
  students,
  studentInterventionResponseStates,
  studentInterventions,
  studentObservedSemesterStates,
  studentQuestionResults,
  studentTopicStates,
} from '../db/schema.js'
import { parseJson } from './json.js'
import { parseObservedStateRow } from './proof-observed-state.js'
import {
  type FacultyProofViewerRole,
  isFacultyProofQueueItemVisible,
  isFacultyProofStudentVisible,
  queueDecisionTypeFromStatus,
  queueReassessmentStatusFromStatus,
} from './proof-control-plane-access.js'
import {
  buildMissingGraphAwarePrerequisiteSummary,
} from './graph-summary.js'
import {
  scoreObservableRiskWithModel,
  type CorrelationArtifact,
  type ModelBackedRiskOutput,
  type ObservableFeaturePayload,
  type ProductionRiskModelArtifact,
  type RiskHeadKey,
} from './proof-risk-model.js'
import { DEFAULT_POLICY } from '../modules/admin-structure.js'
import type {
  ObservableSourceRefsWithFeatureMetadata,
  ProofRecoveryState,
  StudentAgentCardPayload,
  StudentAgentCitation,
  StudentAgentMessage,
  StudentAgentTimelineItem,
  StudentRiskExplorerPayload,
} from './msruas-proof-control-plane.js'
import {
  buildProofCountProvenance,
  buildUnavailableCountProvenance,
} from './proof-provenance.js'

const STUDENT_AGENT_CARD_VERSION = 1

type ProofCheckpointSummaryLike = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageLabel: string
  stageDescription: string
  stageOrder: number
  previousCheckpointId: string | null
  nextCheckpointId: string | null
  openQueueCount?: number
  blockingQueueItemCount?: number
  stageAdvanceBlocked?: boolean
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}

type FacultyProofViewResult = {
  scopeDescriptor: unknown
  resolvedFrom: unknown
  scopeMode: unknown
  countSource: unknown
  activeOperationalSemester: number | null
  activeRunContexts: Array<{
    batchId: string
    batchLabel: string
    branchName: string | null
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
    [key: string]: unknown
  }>
  selectedCheckpoint: ProofCheckpointSummaryLike | null
  monitoringQueue: Array<Record<string, unknown>>
  electiveFits: Array<Record<string, unknown>>
}

function resolveOperationalCheckpointSummary(
  checkpointRows: Array<typeof simulationStageCheckpoints.$inferSelect>,
  semesterNumber: number,
  deps: Pick<ProofControlPlaneTailServiceDeps, 'parseProofCheckpointSummary' | 'withProofPlaybackGate'>,
) {
  const summaries = deps.withProofPlaybackGate(
    checkpointRows
      .slice()
      .sort((left, right) => left.semesterNumber - right.semesterNumber || left.stageOrder - right.stageOrder)
      .map(deps.parseProofCheckpointSummary),
  )
  const semesterSummaries = summaries.filter(item => item.semesterNumber === semesterNumber)
  return semesterSummaries
    .slice()
    .reverse()
    .find(item => item.playbackAccessible !== false)
    ?? semesterSummaries.at(-1)
    ?? null
}

type EvidenceTimelineItem = {
  semesterNumber: number
  observedState: Record<string, unknown>
}

export type ProofControlPlaneTailServiceDeps = {
  buildEvidenceTimelineFromRows: (rows: Array<typeof studentObservedSemesterStates.$inferSelect>) => EvidenceTimelineItem[]
  clamp: (value: number, min: number, max: number) => number
  createId: (prefix: string) => string
  displayableHeadProbabilityScaled: (inferred: ModelBackedRiskOutput | null, head: RiskHeadKey) => number | null
  headDisplayState: (inferred: ModelBackedRiskOutput | null, head: RiskHeadKey) => {
    displayProbabilityAllowed: boolean
    supportWarning: string | null
    calibrationMethod: string
  } | null
  interventionAcceptedFromResponseState: (responseState: Record<string, unknown>) => boolean | null
  interventionCompletedFromResponseState: (responseState: Record<string, unknown>) => boolean | null
  interventionObservedResidualFromResponseState: (responseState: Record<string, unknown>) => number | null
  interventionRecoveryConfirmedFromResponseState: (responseState: Record<string, unknown>) => boolean | null
  isOpenReassessmentStatus: (status: string | null | undefined) => boolean
  loadActiveProofRiskArtifacts: (db: AppDb, batchId: string) => Promise<{
    production: ProductionRiskModelArtifact | null
    correlations: CorrelationArtifact | null
  }>
  parseProofCheckpointSummary: (row: typeof simulationStageCheckpoints.$inferSelect) => ProofCheckpointSummaryLike
  proofRecoveryStateFromResolutionRow: (row: (typeof reassessmentResolutions.$inferSelect) | null | undefined) => ProofRecoveryState | null
  proofResolutionPayloadFromRow: (row: (typeof reassessmentResolutions.$inferSelect) | null | undefined) => {
    observedResidual?: number | null
  }
  queueProjectionAssignedFacultyId: (row: typeof simulationStageQueueProjections.$inferSelect | typeof simulationStageQueueProjections.$inferInsert) => string | null
  queueStatusPriority: (status: string | null | undefined) => number
  uniqueSorted: (values: Iterable<string>) => string[]
  withProofPlaybackGate: (summaries: ProofCheckpointSummaryLike[]) => ProofCheckpointSummaryLike[]
}

export async function buildFacultyProofView(db: AppDb, input: {
  facultyId: string
  viewerRoleCode?: string | null
  simulationStageCheckpointId?: string | null
}, deps: ProofControlPlaneTailServiceDeps): Promise<FacultyProofViewResult> {
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
    const checkpointSummary = deps.withProofPlaybackGate(orderedCheckpointRows.map(deps.parseProofCheckpointSummary))
      .find(item => item.simulationStageCheckpointId === checkpoint.simulationStageCheckpointId)
      ?? deps.parseProofCheckpointSummary(checkpoint)
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
          const payload = parseObservedStateRow(row)
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

    const electiveVisible = checkpoint.stageKey === 'post-see'
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
    const countProvenance = buildProofCountProvenance({
      activeOperationalSemester: run.activeOperationalSemester ?? batch?.currentSemester ?? checkpoint.semesterNumber ?? null,
      batchId: run.batchId,
      batchLabel: batch?.batchLabel ?? run.batchId,
      branchName: branch?.name ?? null,
      simulationRunId: run.simulationRunId,
      runLabel: run.runLabel,
      simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
      checkpointLabel: checkpointSummary.stageLabel,
    })

    return {
      ...countProvenance,
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
  const selectedCurrentSemester = selectedActiveRun?.activeOperationalSemester ?? selectedBatch?.currentSemester ?? 6
  const operationalCheckpointSummary = selectedActiveRun
    ? resolveOperationalCheckpointSummary(
      await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, selectedActiveRun.simulationRunId)),
      selectedCurrentSemester,
      deps,
    )
    : null
  if (
    !input.simulationStageCheckpointId
    && selectedActiveRun
    && selectedBatch
    && selectedActiveRun.activeOperationalSemester != null
    && selectedActiveRun.activeOperationalSemester !== selectedBatch.currentSemester
    && operationalCheckpointSummary
  ) {
    const checkpointView = await buildFacultyProofView(db, {
      ...input,
      simulationStageCheckpointId: operationalCheckpointSummary.simulationStageCheckpointId,
    }, deps)
    const countProvenance = buildProofCountProvenance({
      activeOperationalSemester: selectedActiveRun.activeOperationalSemester ?? selectedBatch.currentSemester ?? null,
      batchId: selectedActiveRun.batchId,
      batchLabel: selectedBatch.batchLabel,
      branchName: branchRows.find(row => row.branchId === selectedBatch.branchId)?.name ?? null,
      simulationRunId: selectedActiveRun.simulationRunId,
      runLabel: selectedActiveRun.runLabel,
    })
    return {
      ...checkpointView,
      ...countProvenance,
      selectedCheckpoint: null,
    }
  }
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
        const payload = parseObservedStateRow(row)
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
    const payload = parseObservedStateRow(row)
    const key = `${row.studentId}::${String(payload.offeringId ?? '')}`
    observedByStudentOffering.set(key, payload)
  }

  const activeRiskRows = riskRows
    .filter(row => selectedActiveRunId ? row.simulationRunId === selectedActiveRunId : activeRunIds.has(row.simulationRunId ?? ''))
    .filter(row => selectedActiveOfferingIds.size === 0 || selectedActiveOfferingIds.has(row.offeringId))
  const activeRiskById = new Map(activeRiskRows.map(row => [row.riskAssessmentId, row]))
  const queueItems = reassessmentRows
    .filter(row => activeRiskById.has(row.riskAssessmentId))
    .filter(row => deps.isOpenReassessmentStatus(row.status))
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
  const countProvenance = selectedActiveRun
    ? buildProofCountProvenance({
        activeOperationalSemester: selectedActiveRun.activeOperationalSemester ?? selectedBatch?.currentSemester ?? null,
        batchId: selectedActiveRun.batchId,
        batchLabel: selectedBatch?.batchLabel ?? selectedActiveRun.batchId,
        branchName: selectedBatch ? (branchById.get(selectedBatch.branchId)?.name ?? null) : null,
        simulationRunId: selectedActiveRun.simulationRunId,
        runLabel: selectedActiveRun.runLabel,
      })
    : buildUnavailableCountProvenance()

  return {
    ...countProvenance,
    activeRunContexts,
    selectedCheckpoint: null,
    monitoringQueue: queueItems,
    electiveFits: electiveFits.slice(0, 12),
  }
}

export async function getProofStudentEvidenceTimeline(db: AppDb, input: {
  simulationRunId: string
  studentId: string
}, deps: ProofControlPlaneTailServiceDeps) {
  const rows = await db.select().from(studentObservedSemesterStates).where(and(
    eq(studentObservedSemesterStates.simulationRunId, input.simulationRunId),
    eq(studentObservedSemesterStates.studentId, input.studentId),
  )).orderBy(asc(studentObservedSemesterStates.semesterNumber), asc(studentObservedSemesterStates.createdAt))

  return deps.buildEvidenceTimelineFromRows(rows)
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
  sourceRefs: ObservableSourceRefsWithFeatureMetadata | null
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
}, deps: ProofControlPlaneTailServiceDeps): Promise<ProofRiskInferenceContext> {
  const activeArtifacts = await deps.loadActiveProofRiskArtifacts(db, input.batchId)

  let featurePayload: ObservableFeaturePayload | null = null
  let sourceRefs: ObservableSourceRefsWithFeatureMetadata | null = null
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
        sourceRefs = parseJson(evidenceRow.sourceRefsJson, null as ObservableSourceRefsWithFeatureMetadata | null)
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
      sourceRefs = parseJson(activeEvidenceRow.sourceRefsJson, null as ObservableSourceRefsWithFeatureMetadata | null)
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
}, deps: ProofControlPlaneTailServiceDeps): Promise<StudentAgentCardPayload> {
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
  if (
    !input.simulationStageCheckpointId
    && run.activeOperationalSemester != null
    && batch
    && run.activeOperationalSemester !== batch.currentSemester
  ) {
    const operationalCheckpointSummary = resolveOperationalCheckpointSummary(
      await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)),
      run.activeOperationalSemester,
      deps,
    )
    if (operationalCheckpointSummary) {
      const checkpointCard = await buildStudentAgentCard(db, {
        ...input,
        simulationStageCheckpointId: operationalCheckpointSummary.simulationStageCheckpointId,
      }, deps)
      const countProvenance = buildProofCountProvenance({
        activeOperationalSemester: run.activeOperationalSemester ?? batch.currentSemester ?? null,
        batchId: run.batchId,
        batchLabel: batch.batchLabel,
        branchName: branch?.name ?? null,
        sectionCode: checkpointCard.student.sectionCode ?? null,
        simulationRunId: run.simulationRunId,
        runLabel: run.runLabel,
        studentId: student.studentId,
        studentLabel: student.name,
      })
      return {
        ...checkpointCard,
        ...countProvenance,
        simulationStageCheckpointId: null,
        checkpointContext: null,
      }
    }
  }
  const currentSemester = stageCheckpoint?.semesterNumber
    ?? run.activeOperationalSemester
    ?? behaviorProfile?.currentSemester
    ?? batch?.currentSemester
    ?? Math.max(1, ...observedRows.map(row => row.semesterNumber))
  const evidenceTimeline = deps.buildEvidenceTimelineFromRows(observedRows)
  const currentSemesterRows = observedRows.filter(row => row.semesterNumber === currentSemester)
  const riskIds = new Set(riskRows.map(row => row.riskAssessmentId))
  const relevantReassessments = reassessmentRows
    .filter(row => riskIds.has(row.riskAssessmentId))
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
  const riskSortRank = (row: typeof riskRows[number]) => {
    const reassessment = relevantReassessments.find(item => item.riskAssessmentId === row.riskAssessmentId) ?? null
    return reassessment && deps.isOpenReassessmentStatus(reassessment.status) ? 2 : reassessment ? 1 : 0
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
        const payload = parseObservedStateRow(row)
        return payload.offeringId === primaryOffering.offeringId
      }))
    : latestByUpdatedAt(currentSemesterRows)
  const currentObservedPayload = currentObservedState ? parseObservedStateRow(currentObservedState) : {}
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
      const recoveryState: ProofRecoveryState = deps.interventionRecoveryConfirmedFromResponseState(responseState) === true
        ? 'confirmed_improvement'
        : 'under_watch'
      return {
        interventionId: row.interventionId,
        interventionType: row.interventionType,
        note: row.note,
        occurredAt: row.occurredAt,
        accepted: deps.interventionAcceptedFromResponseState(responseState),
        completed: deps.interventionCompletedFromResponseState(responseState),
        recoveryConfirmed: deps.interventionRecoveryConfirmedFromResponseState(responseState),
        recoveryState,
        observedResidual: deps.interventionObservedResidualFromResponseState(responseState),
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
      recoveryState: deps.proofRecoveryStateFromResolutionRow(resolution),
      observedResidual: Number.isFinite(Number(deps.proofResolutionPayloadFromRow(resolution).observedResidual))
        ? Number(deps.proofResolutionPayloadFromRow(resolution).observedResidual)
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
      const statusDelta = deps.queueStatusPriority(right.status) - deps.queueStatusPriority(left.status)
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
      riskBands: deps.uniqueSorted(riskBands),
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

  const attentionAreas = deps.uniqueSorted([
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
        const payload = parseObservedStateRow(observed)
        return observed.studentId === student.studentId && payload.offeringId === row.offeringId
      })
    const payload = evidenceRow ? parseObservedStateRow(evidenceRow) : {}
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
    const stageCheckpointSummary = deps.parseProofCheckpointSummary(stageCheckpoint)
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
      queueState: primaryReassessment ? (deps.isOpenReassessmentStatus(primaryReassessment.status) ? 'open' : 'resolved') : currentStatus.queueState,
      queueCaseId: primaryReassessment?.queueCaseId ?? null,
      primaryCase: primaryReassessment?.primaryCase ?? null,
      countsTowardCapacity: primaryReassessment?.countsTowardCapacity ?? null,
      priorityRank: primaryReassessment?.priorityRank ?? null,
      governanceReason: primaryReassessment?.governanceReason ?? null,
      supportingCourseCount: primaryReassessment?.supportingCourseCount ?? null,
      assignedFacultyId: primaryReassessment?.assignedFacultyId ?? null,
      recoveryState: deps.proofRecoveryStateFromResolutionRow(primaryResolution),
      observedResidual: Number.isFinite(Number(deps.proofResolutionPayloadFromRow(primaryResolution).observedResidual))
        ? Number(deps.proofResolutionPayloadFromRow(primaryResolution).observedResidual)
        : null,
    }
  }

  const proofRiskInference = await loadProofRiskInferenceContext(db, {
    batchId: run.batchId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    primaryCourseCode: primaryCourse?.courseCode ?? null,
  }, deps)
  const overallHeadDisplay = deps.headDisplayState(proofRiskInference.inferred, 'overallCourseRisk')
    ?? proofRiskInference.fallbackOverallHeadDisplay
  const fallbackFeatureSummary = buildMissingGraphAwarePrerequisiteSummary({
    graphAvailable: false,
    historyAvailable: false,
    curriculumImportVersionId: String(run.curriculumImportVersionId ?? null),
    curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
  })
  const featureCompleteness = proofRiskInference.sourceRefs?.featureCompleteness
    ?? proofRiskInference.sourceRefs?.prerequisiteCompleteness
    ?? fallbackFeatureSummary.featureCompleteness
  const featureProvenance = proofRiskInference.sourceRefs?.featureProvenance
    ?? fallbackFeatureSummary.featureProvenance
  currentStatus = {
    ...currentStatus,
    riskProbScaled: deps.displayableHeadProbabilityScaled(proofRiskInference.inferred, 'overallCourseRisk'),
    riskCompleteness: featureCompleteness,
    featureCompleteness,
    featureProvenance,
  }

  const simulationTags = behaviorProfile ? [
    `Archetype: ${String(parseJson(behaviorProfile.profileJson, {} as Record<string, unknown>).archetype ?? 'unspecified')}`,
    `Mentor track: ${String(parseJson(behaviorProfile.profileJson, {} as Record<string, unknown>).mentorTrack ?? 'unspecified')}`,
    ...(topicBuckets.highUncertainty.length > 0 ? ['High uncertainty topics present'] : []),
  ] : []
  const countProvenance = buildProofCountProvenance({
    activeOperationalSemester: run.activeOperationalSemester ?? batch?.currentSemester ?? null,
    batchId: run.batchId,
    batchLabel: batch?.batchLabel ?? run.batchId,
    branchName: branch?.name ?? null,
    sectionCode: currentObservedState?.sectionCode ?? topicRows[0]?.sectionCode ?? null,
    simulationRunId: run.simulationRunId,
    runLabel: run.runLabel,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    checkpointLabel: checkpointContext?.stageLabel ?? null,
    studentId: student.studentId,
    studentLabel: student.name,
  })

  const provisionalCard = {
    studentAgentCardId: '',
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: stageCheckpoint?.simulationStageCheckpointId ?? null,
    cardVersion: STUDENT_AGENT_CARD_VERSION,
    sourceSnapshotHash: '',
    disclaimer: 'Simulation UX only. Formal academic status remains policy-derived, and this shell cannot change institutional records.',
    ...countProvenance,
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
}, deps: ProofControlPlaneTailServiceDeps) {
  const overallRisk = deps.clamp((input.currentRiskProbScaled ?? 0) / 100, 0.05, 0.95)
  const backlogPressure = deps.clamp(input.backlogCount / 4, 0, 1)
  const lowCgpaPressure = deps.clamp((7.5 - input.currentCgpa) / 4, 0, 1)
  const sgpaTrendPressure = input.currentSemesterSummary && input.previousSemesterSummary
    ? deps.clamp((input.previousSemesterSummary.sgpa - input.currentSemesterSummary.sgpa + 1.5) / 4, 0, 1)
    : deps.clamp((6.5 - input.currentCgpa) / 4, 0, 1)
  const coPressure = deps.clamp(input.weakCoCount / 4, 0, 1)
  const transferGapPressure = deps.clamp(input.transferGapCount / 5, 0, 1)

  return {
    semesterSgpaDropRiskProbScaled: Math.round(deps.clamp(
      (overallRisk * 0.55) + (backlogPressure * 0.2) + (sgpaTrendPressure * 0.25),
      0.05,
      0.95,
    ) * 100),
    cumulativeCgpaDropRiskProbScaled: Math.round(deps.clamp(
      (overallRisk * 0.45) + (backlogPressure * 0.25) + (lowCgpaPressure * 0.3),
      0.05,
      0.95,
    ) * 100),
    electiveMismatchRiskProbScaled: input.hasElectiveFit
      ? Math.round(deps.clamp(
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
}, deps: ProofControlPlaneTailServiceDeps) {
  const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.simulationRunId, input.simulationRunId))
  if (!run) throw new Error('Simulation run not found')

  const card = await buildStudentAgentCard(db, input, deps)
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
  if (card.overview.currentStatus.policyComparison) {
    checkpointPolicyComparison = {
      policyPhenotype: card.overview.currentStatus.policyComparison.policyPhenotype ?? null,
      recommendedAction: card.overview.currentStatus.policyComparison.recommendedAction,
      simulatedActionTaken: card.overview.currentStatus.policyComparison.simulatedActionTaken,
      noActionRiskBand: card.overview.currentStatus.policyComparison.noActionRiskBand,
      noActionRiskProbScaled: card.overview.currentStatus.policyComparison.noActionRiskProbScaled,
      counterfactualLiftScaled: card.overview.currentStatus.policyComparison.counterfactualLiftScaled,
      policyRationale: card.overview.currentStatus.policyComparison.rationale,
      candidates: checkpointPolicyComparison?.candidates ?? [],
    }
  }
  const proofRiskInference = await loadProofRiskInferenceContext(db, {
    batchId: run.batchId,
    simulationRunId: input.simulationRunId,
    simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    primaryCourseCode: card.summaryRail.primaryCourseCode,
  }, deps)
  const inferred = proofRiskInference.inferred
  const overallHeadDisplay = deps.headDisplayState(inferred, 'overallCourseRisk')
  const fallbackFeatureSummary = buildMissingGraphAwarePrerequisiteSummary({
    graphAvailable: false,
    historyAvailable: false,
    curriculumImportVersionId: String(run.curriculumImportVersionId ?? null),
    curriculumFeatureProfileFingerprint: run.curriculumFeatureProfileFingerprint ?? null,
  })
  const featureCompleteness = proofRiskInference.sourceRefs?.featureCompleteness
    ?? proofRiskInference.sourceRefs?.prerequisiteCompleteness
    ?? fallbackFeatureSummary.featureCompleteness
  const featureProvenance = proofRiskInference.sourceRefs?.featureProvenance
    ?? fallbackFeatureSummary.featureProvenance
  const currentStatus = {
    ...card.overview.currentStatus,
    riskProbScaled: deps.displayableHeadProbabilityScaled(proofRiskInference.inferred, 'overallCourseRisk'),
    riskCompleteness: featureCompleteness,
    featureCompleteness,
    featureProvenance,
  }

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
  }, deps)

  return {
    simulationRunId: card.simulationRunId,
    simulationStageCheckpointId: card.simulationStageCheckpointId,
    disclaimer: 'Risk explorer is a proof-mode analysis surface. Trained heads are simulation-calibrated, observable-only, and advisory. Derived scenario heads are not separate trained models.',
    scopeDescriptor: card.scopeDescriptor,
    resolvedFrom: card.resolvedFrom,
    scopeMode: card.scopeMode,
    countSource: card.countSource,
    activeOperationalSemester: card.activeOperationalSemester,
    runContext: card.runContext,
    checkpointContext: card.checkpointContext,
    student: card.student,
    riskCompleteness: featureCompleteness,
    featureCompleteness,
    featureProvenance,
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
      currentRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'overallCourseRisk'),
      attendanceRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'attendanceRisk'),
      ceRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'ceRisk'),
      seeRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'seeRisk'),
      overallCourseRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'overallCourseRisk'),
      downstreamCarryoverRiskProbScaled: deps.displayableHeadProbabilityScaled(inferred, 'downstreamCarryoverRisk'),
    },
    trainedRiskHeadDisplays: inferred?.headDisplay ?? null,
    derivedScenarioHeads,
    currentEvidence: card.overview.currentEvidence,
    currentStatus,
    topDrivers: inferred?.observableDrivers ?? [],
    crossCourseDrivers: inferred?.crossCourseDrivers ?? [],
    prerequisiteMap: {
      prerequisiteCourseCodes: proofRiskInference.sourceRefs?.prerequisiteCourseCodes ?? [],
      weakPrerequisiteCourseCodes: proofRiskInference.sourceRefs?.prerequisiteWeakCourseCodes ?? [],
      prerequisitePressureScaled: proofRiskInference.featurePayload?.prerequisitePressure ?? null,
      prerequisiteAveragePct: proofRiskInference.featurePayload?.prerequisiteAveragePct ?? null,
      prerequisiteFailureCount: proofRiskInference.featurePayload?.prerequisiteFailureCount ?? null,
      completeness: featureCompleteness,
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
}, deps: ProofControlPlaneTailServiceDeps) {
  const card = await buildStudentAgentCard(db, {
    simulationRunId: input.simulationRunId,
    studentId: input.studentId,
    simulationStageCheckpointId: input.simulationStageCheckpointId,
  }, deps)
  const now = new Date().toISOString()
  const [existingCard] = await db.select().from(studentAgentCards).where(eq(studentAgentCards.studentAgentCardId, card.studentAgentCardId))
  if (!existingCard) throw new Error('Student agent card was not persisted')
  const sessionId = deps.createId('agent_session')
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
    studentAgentMessageId: deps.createId('agent_message'),
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
}, deps: ProofControlPlaneTailServiceDeps) {
  const session = await db.select().from(studentAgentSessions).where(eq(studentAgentSessions.studentAgentSessionId, input.studentAgentSessionId)).then(rows => rows[0] ?? null)
  if (!session) throw new Error(`Student agent session ${input.studentAgentSessionId} was not found`)
  const card = await buildStudentAgentCard(db, {
    simulationRunId: session.simulationRunId,
    studentId: session.studentId,
    simulationStageCheckpointId: session.simulationStageCheckpointId,
  }, deps)
  const now = new Date().toISOString()
  const userMessageId = deps.createId('agent_message')
  const assistantMessageId = deps.createId('agent_message')
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
}, deps: ProofControlPlaneTailServiceDeps) {
  const card = await buildStudentAgentCard(db, input, deps)
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
