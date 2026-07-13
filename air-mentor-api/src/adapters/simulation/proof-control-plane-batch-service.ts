import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../../db/client.js'
import {
  alertAcknowledgements,
  alertDecisions,
  batches,
  courses,
  curriculumImportVersions,
  curriculumValidationResults,
  facultyProfiles,
  officialCodeCrosswalks,
  operationalTelemetryEvents,
  reassessmentEvents,
  reassessmentResolutions,
  riskAssessments,
  sectionOfferings,
  simulationLifecycleAudits,
  simulationResetSnapshots,
  simulationRuns,
  simulationQuestionTemplates,
  simulationStageCheckpoints,
  simulationStageQueueCases,
  simulationStageOfferingProjections,
  simulationStageQueueProjections,
  simulationStageStudentProjections,
  studentBehaviorProfiles,
  studentCoStates,
  studentInterventionResponseStates,
  studentQuestionResults,
  students,
  studentTopicStates,
  teacherLoadProfiles,
  worldContextSnapshots,
} from '../../db/schema.js'
import { notFound } from '../../lib/http-errors.js'
import { parseJson } from '../../lib/json.js'
import {
  buildCheckpointReadinessDiagnostics,
  buildProofQueueDiagnostics,
  buildProofWorkerDiagnostics,
  decorateProofRunsWithOperationalDiagnostics,
} from './proof-control-plane-dashboard-service.js'
import { MSRUAS_PROOF_BRANCH_ID, MSRUAS_PROOF_DEPARTMENT_ID } from './msruas-proof-sandbox.js'
import { pickMostRecentActiveRun } from '../../lib/proof-active-run.js'

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
  liveBlockingQueueItemCount?: number
  blockingQueueItemCount?: number
  stageAdvanceBlocked?: boolean
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}

export type ProofControlPlaneBatchServiceDeps = {
  getProofRiskModelDiagnostics: (db: AppDb, input: { batchId: string; simulationRunId: string | null }) => Promise<Record<string, unknown>>
  parseProofCheckpointSummary: (row: typeof simulationStageCheckpoints.$inferSelect) => ProofCheckpointSummaryLike
  queueStatusPriority: (status: string | null | undefined) => number
  withProofPlaybackGate: (summaries: ProofCheckpointSummaryLike[], queueCaseRows?: Array<typeof simulationStageQueueCases.$inferSelect>) => ProofCheckpointSummaryLike[]
}

async function resolveProofCheckpointForRun(
  db: AppDb,
  simulationRunId: string,
  simulationStageCheckpointId: string,
) {
  const [checkpoint] = await db.select().from(simulationStageCheckpoints).where(
    eq(simulationStageCheckpoints.simulationStageCheckpointId, simulationStageCheckpointId),
  )
  if (!checkpoint) throw notFound('Simulation stage checkpoint not found')
  if (checkpoint.simulationRunId !== simulationRunId) {
    throw notFound('Simulation stage checkpoint not found for the selected proof run')
  }
  return checkpoint
}

function checkpointRiskBandWeight(riskBand: string | null | undefined) {
  const normalized = (riskBand ?? '').trim().toLowerCase()
  if (normalized === 'high') return 3
  if (normalized === 'medium') return 2
  if (normalized === 'low') return 1
  return 0
}

function checkpointNullablePct(value: unknown) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function checkpointProjectionGovernance(row: typeof simulationStageStudentProjections.$inferSelect) {
  const payload = parseJson(row.projectionJson, {} as Record<string, unknown>)
  const governance = (payload.governance ?? {}) as Record<string, unknown>
  return {
    primaryCase: governance.primaryCase === true,
    countsTowardCapacity: governance.countsTowardCapacity === true,
    priorityRank: Number.isFinite(Number(governance.priorityRank)) ? Number(governance.priorityRank) : Number.MAX_SAFE_INTEGER,
  }
}

function sortCheckpointProjectionRows(rows: Array<typeof simulationStageStudentProjections.$inferSelect>) {
  return rows.slice().sort((left, right) => {
    const leftGovernance = checkpointProjectionGovernance(left)
    const rightGovernance = checkpointProjectionGovernance(right)
    if (leftGovernance.primaryCase !== rightGovernance.primaryCase) return Number(rightGovernance.primaryCase) - Number(leftGovernance.primaryCase)
    if (leftGovernance.countsTowardCapacity !== rightGovernance.countsTowardCapacity) return Number(rightGovernance.countsTowardCapacity) - Number(leftGovernance.countsTowardCapacity)
    if (leftGovernance.priorityRank !== rightGovernance.priorityRank) return leftGovernance.priorityRank - rightGovernance.priorityRank
    return right.riskProbScaled - left.riskProbScaled || left.courseCode.localeCompare(right.courseCode)
  })
}

export async function listProofRunCheckpoints(db: AppDb, input: {
  simulationRunId: string
}, deps: ProofControlPlaneBatchServiceDeps) {
  const { parseProofCheckpointSummary, withProofPlaybackGate } = deps
  const [rows, queueCaseRows] = await Promise.all([
    db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
      asc(simulationStageCheckpoints.semesterNumber),
      asc(simulationStageCheckpoints.stageOrder),
    ),
    db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, input.simulationRunId)),
  ])
  return withProofPlaybackGate(rows.map(parseProofCheckpointSummary), queueCaseRows)
}

export async function getProofRunCheckpointDetail(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
}, deps: ProofControlPlaneBatchServiceDeps) {
  const { parseProofCheckpointSummary, queueStatusPriority, withProofPlaybackGate } = deps
  const checkpoint = await resolveProofCheckpointForRun(
    db,
    input.simulationRunId,
    input.simulationStageCheckpointId,
  )
  const [queueRows, offeringRows, queueCaseRows] = await Promise.all([
    db.select().from(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationStageCheckpointId, input.simulationStageCheckpointId)),
    db.select().from(simulationStageOfferingProjections).where(eq(simulationStageOfferingProjections.simulationStageCheckpointId, input.simulationStageCheckpointId)),
    db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, input.simulationRunId)),
  ])
  const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary), queueCaseRows)
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
}, deps: ProofControlPlaneBatchServiceDeps) {
  const { parseProofCheckpointSummary, withProofPlaybackGate } = deps
  const [checkpoint, student, projectionRows, queueCaseRows] = await Promise.all([
    resolveProofCheckpointForRun(db, input.simulationRunId, input.simulationStageCheckpointId),
    db.select().from(students).where(eq(students.studentId, input.studentId)).then(rows => rows[0] ?? null),
    db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId),
      eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
      eq(simulationStageStudentProjections.studentId, input.studentId),
    )),
    db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, input.simulationRunId)),
  ])
  if (!student) throw notFound('Student not found')
  const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary), queueCaseRows)
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

export async function listProofRunCheckpointStudents(db: AppDb, input: {
  simulationRunId: string
  simulationStageCheckpointId: string
}, deps: ProofControlPlaneBatchServiceDeps) {
  const { parseProofCheckpointSummary, withProofPlaybackGate } = deps
  const [checkpoint, projectionRows, queueCaseRows, studentRows] = await Promise.all([
    resolveProofCheckpointForRun(db, input.simulationRunId, input.simulationStageCheckpointId),
    db.select().from(simulationStageStudentProjections).where(and(
      eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId),
      eq(simulationStageStudentProjections.simulationStageCheckpointId, input.simulationStageCheckpointId),
    )),
    db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, input.simulationRunId)),
    db.select().from(students),
  ])
  const orderedCheckpointRows = await db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId)).orderBy(
    asc(simulationStageCheckpoints.semesterNumber),
    asc(simulationStageCheckpoints.stageOrder),
  )
  const checkpointSummary = withProofPlaybackGate(orderedCheckpointRows.map(parseProofCheckpointSummary), queueCaseRows)
    .find(item => item.simulationStageCheckpointId === input.simulationStageCheckpointId)
    ?? parseProofCheckpointSummary(checkpoint)
  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const rowsByStudentId = new Map<string, Array<typeof simulationStageStudentProjections.$inferSelect>>()
  for (const row of projectionRows) {
    rowsByStudentId.set(row.studentId, [...(rowsByStudentId.get(row.studentId) ?? []), row])
  }
  const items = Array.from(rowsByStudentId.entries())
    .map(([studentId, rowsForStudent]) => {
      const primary = sortCheckpointProjectionRows(rowsForStudent)[0] ?? null
      if (!primary) return null
      const student = studentById.get(studentId) ?? null
      const payload = parseJson(primary.projectionJson, {} as Record<string, unknown>)
      const currentEvidence = (payload.currentEvidence ?? {}) as Record<string, unknown>
      const currentStatus = (payload.currentStatus ?? {}) as Record<string, unknown>
      const counterfactualPolicy = (payload.counterfactualPolicyDiagnostics ?? {}) as Record<string, unknown>
      return {
        studentId,
        studentName: student?.name ?? studentId,
        usn: student?.usn ?? '',
        sectionCode: primary.sectionCode,
        currentSemester: checkpointSummary.semesterNumber,
        currentRiskBand: primary.riskBand,
        currentRiskProbScaled: primary.riskProbScaled,
        currentQueueState: primary.queueState ?? (typeof currentStatus.queueState === 'string' ? currentStatus.queueState : null),
        currentReassessmentStatus: primary.reassessmentState,
        primaryCourseCode: primary.courseCode,
        primaryCourseTitle: primary.courseTitle,
        nextDueAt: typeof currentStatus.dueAt === 'string' ? currentStatus.dueAt : null,
        riskChangeFromPreviousCheckpointScaled: Number(payload.riskChangeFromPreviousCheckpointScaled ?? 0),
        counterfactualLiftScaled: Number(
          counterfactualPolicy.counterfactualLiftScaled
          ?? payload.counterfactualLiftScaled
          ?? (primary.noActionRiskProbScaled ?? primary.riskProbScaled) - primary.riskProbScaled,
        ),
        observedEvidence: {
          attendancePct: Number(currentEvidence.attendancePct ?? 0),
          tt1Pct: checkpointNullablePct(currentEvidence.tt1Pct),
          tt2Pct: checkpointNullablePct(currentEvidence.tt2Pct),
          quizPct: checkpointNullablePct(currentEvidence.quizPct),
          assignmentPct: checkpointNullablePct(currentEvidence.assignmentPct),
          seePct: checkpointNullablePct(currentEvidence.seePct),
          cgpa: Number(currentStatus.currentCgpa ?? 0),
          backlogCount: Number(currentStatus.backlogCount ?? 0),
          weakCoCount: Number(currentEvidence.weakCoCount ?? 0),
          weakQuestionCount: Number(currentEvidence.weakQuestionCount ?? 0),
          coEvidenceMode: typeof currentEvidence.coEvidenceMode === 'string' ? currentEvidence.coEvidenceMode : null,
          interventionRecoveryStatus: typeof currentEvidence.interventionRecoveryStatus === 'string'
            ? currentEvidence.interventionRecoveryStatus
            : null,
        },
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => (
      checkpointRiskBandWeight(right.currentRiskBand) - checkpointRiskBandWeight(left.currentRiskBand)
      || right.currentRiskProbScaled - left.currentRiskProbScaled
      || left.studentName.localeCompare(right.studentName)
    ))
  return {
    checkpoint: checkpointSummary,
    items,
  }
}

export async function buildProofBatchDashboard(db: AppDb, batchId: string, deps: ProofControlPlaneBatchServiceDeps) {
  const { getProofRiskModelDiagnostics, parseProofCheckpointSummary, withProofPlaybackGate } = deps
  const [batch] = await db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')
  const [
    importRows,
    validationRows,
    crosswalkRows,
    runRows,
    lifecycleRows,
    resolutionRows,
    acknowledgementRows,
    recentOperationalEventRows,
    offeringRows,
    courseRows,
  ] = await Promise.all([
    db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId)),
    db.select().from(curriculumValidationResults).where(eq(curriculumValidationResults.batchId, batchId)),
    db.select().from(officialCodeCrosswalks).where(eq(officialCodeCrosswalks.batchId, batchId)),
    db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId)),
    db.select().from(simulationLifecycleAudits).where(eq(simulationLifecycleAudits.batchId, batchId)),
    db.select().from(reassessmentResolutions).where(eq(reassessmentResolutions.batchId, batchId)),
    db.select().from(alertAcknowledgements).where(eq(alertAcknowledgements.batchId, batchId)),
    db.select().from(operationalTelemetryEvents).orderBy(desc(operationalTelemetryEvents.eventTimestamp), desc(operationalTelemetryEvents.createdAt)).limit(12),
    db.select().from(sectionOfferings).where(eq(sectionOfferings.branchId, MSRUAS_PROOF_BRANCH_ID)),
    db.select().from(courses).where(eq(courses.departmentId, MSRUAS_PROOF_DEPARTMENT_ID)),
  ])

  const courseById = new Map(courseRows.map(row => [row.courseId, row]))
  const proofRunStatusRank = (status: string) => {
    switch (status) {
      case 'active':
        return 0
      case 'running':
        return 1
      case 'queued':
        return 2
      case 'completed':
        return 3
      case 'failed':
        return 4
      case 'archived':
        return 5
      default:
        return 6
    }
  }
  const activeRun = pickMostRecentActiveRun(
    runRows
      .filter(row => row.activeFlag === 1)
      .map(row => ({
        ...row,
        runLabel: row.runLabel,
        activeOperationalSemester: row.activeOperationalSemester,
      })),
  ) ?? runRows
    .slice()
    .sort((left, right) => {
      const statusDelta = proofRunStatusRank(left.status) - proofRunStatusRank(right.status)
      if (statusDelta !== 0) return statusDelta
      if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt)
      return right.createdAt.localeCompare(left.createdAt)
    })[0] ?? null
  const activeRunId = activeRun?.simulationRunId ?? null
  const modelDiagnostics = await getProofRiskModelDiagnostics(db, {
    batchId,
    simulationRunId: activeRunId,
  })
  const [
    activeSnapshots,
    activeLoads,
    activeBehaviorProfiles,
    activeTopicStates,
    activeCoStates,
    activeQuestionTemplates,
    activeQuestionResults,
    activeInterventionResponses,
    activeWorldContexts,
    activeStageCheckpoints,
    activeStageQueueCases,
    activeStageQueueRows,
    activeRiskRows,
  ] = activeRunId
    ? await Promise.all([
        db.select().from(simulationResetSnapshots).where(and(
          eq(simulationResetSnapshots.batchId, batchId),
          eq(simulationResetSnapshots.simulationRunId, activeRunId),
        )),
        db.select().from(teacherLoadProfiles).where(eq(teacherLoadProfiles.simulationRunId, activeRunId)),
        db.select().from(studentBehaviorProfiles).where(eq(studentBehaviorProfiles.simulationRunId, activeRunId)),
        db.select().from(studentTopicStates).where(eq(studentTopicStates.simulationRunId, activeRunId)),
        db.select().from(studentCoStates).where(eq(studentCoStates.simulationRunId, activeRunId)),
        db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, activeRunId)),
        db.select().from(studentQuestionResults).where(eq(studentQuestionResults.simulationRunId, activeRunId)),
        db.select().from(studentInterventionResponseStates).where(eq(studentInterventionResponseStates.simulationRunId, activeRunId)),
        db.select().from(worldContextSnapshots).where(eq(worldContextSnapshots.simulationRunId, activeRunId)),
        db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, activeRunId)).orderBy(
          asc(simulationStageCheckpoints.semesterNumber),
          asc(simulationStageCheckpoints.stageOrder),
        ),
        db.select().from(simulationStageQueueCases).where(eq(simulationStageQueueCases.simulationRunId, activeRunId)),
        db.select().from(simulationStageQueueProjections).where(eq(simulationStageQueueProjections.simulationRunId, activeRunId)),
        db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, activeRunId)),
      ])
    : [[], [], [], [], [], [], [], [], [], [], [], [], []]
  const activeCheckpointSummaries = withProofPlaybackGate(activeStageCheckpoints.map(parseProofCheckpointSummary), activeStageQueueCases)
  const riskIds = activeRiskRows.map(row => row.riskAssessmentId)
  const [activeReassessments, activeAlerts] = riskIds.length > 0
    ? await Promise.all([
        db.select().from(reassessmentEvents).where(inArray(reassessmentEvents.riskAssessmentId, riskIds)),
        db.select().from(alertDecisions).where(inArray(alertDecisions.riskAssessmentId, riskIds)),
      ])
    : [[], []]
  const facultyIds = Array.from(new Set([
    ...activeLoads.map(load => load.facultyId),
    ...activeStageQueueRows.map(row => row.assignedFacultyId).filter((value): value is string => typeof value === 'string' && value.length > 0),
    ...activeReassessments.map(row => row.assignedFacultyId).filter((value): value is string => typeof value === 'string' && value.length > 0),
    ...lifecycleRows.map(row => row.createdByFacultyId).filter((value): value is string => typeof value === 'string' && value.length > 0),
  ]))
  const studentIds = Array.from(new Set([
    ...activeRiskRows.map(row => row.studentId),
    ...activeStageQueueRows.map(row => row.studentId),
    ...activeReassessments.map(row => row.studentId),
  ]))
  const [facultyRows, studentRows] = await Promise.all([
    facultyIds.length > 0
      ? db.select().from(facultyProfiles).where(inArray(facultyProfiles.facultyId, facultyIds))
      : Promise.resolve([]),
    studentIds.length > 0
      ? db.select().from(students).where(inArray(students.studentId, studentIds))
      : Promise.resolve([]),
  ])
  const facultyById = new Map(facultyRows.map(row => [row.facultyId, row]))
  const studentById = new Map(studentRows.map(row => [row.studentId, row]))
  const latestValidationRow = validationRows
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
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
  const proofRuns = decorateProofRunsWithOperationalDiagnostics(runRows
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(row => ({
      simulationRunId: row.simulationRunId,
      runLabel: row.runLabel,
      status: row.status,
      activeFlag: row.activeFlag === 1,
      seed: row.seed,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      progress: parseJson(row.progressJson, null as Record<string, unknown> | null),
      metrics: parseJson(row.metricsJson, {} as Record<string, unknown>),
      workerLeaseExpiresAt: row.workerLeaseExpiresAt,
    })), new Date().toISOString())
  const activeRunSummary = activeRun
    ? proofRuns.find(row => row.simulationRunId === activeRun.simulationRunId) ?? null
    : null
  const queueDiagnostics = buildProofQueueDiagnostics(proofRuns)
  const workerDiagnostics = buildProofWorkerDiagnostics(activeRunSummary)
  const checkpointReadiness = buildCheckpointReadinessDiagnostics(activeCheckpointSummaries)

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
    latestValidation: latestValidationRow
      ? {
          validatorVersion: latestValidationRow.validatorVersion,
          status: latestValidationRow.status,
          summary: parseJson(latestValidationRow.summaryJson, {} as Record<string, unknown>),
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
    proofRuns,
    activeRunDetail: activeRun ? {
      simulationRunId: activeRun.simulationRunId,
      runLabel: activeRun.runLabel,
      seed: activeRun.seed,
      activeOperationalSemester: activeRun.activeOperationalSemester,
      // Phase-11 audit §5.2: dashboard must surface the authoritative active
      // stage + simulated date so flow-5/6/8 specs (and the HOD analytics UI)
      // can probe the real run-authority state without reading DB directly.
      activeStageKey: activeRun.activeStageKey ?? null,
      simulatedDateIso: activeRun.simulatedDateIso ?? null,
      lifecycleState: activeRun.lifecycleState ?? null,
      createdAt: activeRun.createdAt,
      startedAt: activeRun.startedAt,
      completedAt: activeRun.completedAt,
      status: activeRun.status,
      failureCode: activeRun.failureCode,
      failureMessage: activeRun.failureMessage,
      progress: parseJson(activeRun.progressJson, null as Record<string, unknown> | null),
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
      queueDiagnostics,
      workerDiagnostics,
      checkpointReadiness,
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
    recentOperationalEvents: recentOperationalEventRows.map(row => ({
      operationalTelemetryEventId: row.operationalTelemetryEventId,
      source: row.source as 'backend' | 'client',
      name: row.name,
      level: row.level as 'info' | 'warn' | 'error',
      timestamp: row.eventTimestamp,
      details: parseJson(row.payloadJson, {} as Record<string, unknown>),
      createdAt: row.createdAt,
    })),
  }
}
