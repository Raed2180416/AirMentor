import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { RouteContext } from '../app.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import { createId } from './ids.js'
import { parseJson, stringifyJson } from './json.js'
import { conflict, notFound } from './http-errors.js'
import {
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_SIMULATION_RUN_ID,
} from '../adapters/simulation/msruas-proof-sandbox.js'
import { rebuildSimulationStagePlayback } from '../adapters/simulation/msruas-proof-control-plane.js'
import { resetPlaybackStageArtifacts } from '../adapters/simulation/proof-control-plane-playback-reset-service.js'
import {
  buildDemoScopeName,
  createDemoWorkspaceSchema,
  dropDemoWorkspaceSchema,
} from './demo-workspace-scope.js'
import {
  demoWorkspaces,
  students,
  studentEnrollments,
  mentorAssignments,
  sectionOfferings,
  facultyOfferingOwnerships,
  teacherAllocations,
  simulationRuns,
  studentAcademicProfiles,
  studentAttendanceSnapshots,
  studentAssessmentScores,
  studentBehaviorProfiles,
  studentLatentStates,
  teacherLoadProfiles,
  worldContextSnapshots,
  simulationQuestionTemplates,
  simulationResetSnapshots,
  simulationStageCheckpoints,
  studentObservedSemesterStates,
  studentQuestionResults,
  studentInterventions,
  studentInterventionResponseStates,
  semesterTransitionLogs,
  studentCoStates,
  studentTopicStates,
  riskEvidenceSnapshots,
  riskAssessments,
  reassessmentEvents,
  alertDecisions,
  alertOutcomes,
  electiveRecommendations,
  transcriptTermResults,
  transcriptSubjectResults,
  batches,
  academicTerms,
  curriculumCourses,
  sessions,
} from '../db/schema.js'

type ProvisionedCounts = {
  students: number
  enrollments: number
  offerings: number
  ownerships: number
  runs: number
  checkpoints: number
  observedStates: number
  riskAssessments: number
}

function demoIdPrefix(demoWorkspaceId: string) {
  return `demo_${demoWorkspaceId.replace(/[^a-zA-Z0-9_]+/g, '_')}`
}

function cloneId(demoWorkspaceId: string, sourceId: string) {
  return `${demoIdPrefix(demoWorkspaceId)}__${sourceId}`
}

function parseMetadata(value: string | null | undefined) {
  return parseJson(value ?? '{}', {} as Record<string, unknown>)
}

async function insertRowsInChunks<T>(
  context: RouteContext,
  table: unknown,
  rows: T[],
  chunkSize = 300,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const batch = rows.slice(index, index + chunkSize)
    if (batch.length === 0) continue
    await context.db.insert(table as never).values(batch as never).onConflictDoNothing()
  }
}

function mappedId(idMap: Map<string, string>, value: string | null | undefined) {
  if (value == null) return value ?? null
  return idMap.get(value) ?? value
}

function remapJsonValue(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === 'string') return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map(item => remapJsonValue(item, idMap))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapJsonValue(item, idMap)]),
    )
  }
  return value
}

function remapJsonText(value: string, idMap: Map<string, string>) {
  const parsed = parseJson<unknown>(value, undefined)
  if (parsed === undefined) return value
  return JSON.stringify(remapJsonValue(parsed, idMap))
}

async function resolveSourceProofRun(context: RouteContext) {
  const [activeGlobalRun] = await context.db
    .select()
    .from(simulationRuns)
    .where(and(
      eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID),
      eq(simulationRuns.activeFlag, 1),
      isNull(simulationRuns.demoWorkspaceId),
    ))
    .limit(1)
  if (activeGlobalRun) return activeGlobalRun

  const [canonicalRun] = await context.db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.simulationRunId, MSRUAS_PROOF_SIMULATION_RUN_ID))
  if (canonicalRun && (canonicalRun.demoWorkspaceId ?? null) === null) return canonicalRun

  const globalRuns = await context.db
    .select()
    .from(simulationRuns)
    .where(and(eq(simulationRuns.batchId, MSRUAS_PROOF_BATCH_ID), isNull(simulationRuns.demoWorkspaceId)))
  const latestRun = globalRuns.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  if (!latestRun) throw conflict('No seeded MSRUAS proof run is available for demo provisioning')
  return latestRun
}

async function summarizeProvisionedWorkspace(
  context: RouteContext,
  demoWorkspaceId: string,
  activeSimulationRunId: string,
): Promise<{
  demoWorkspaceId: string
  activeSimulationRunId: string
  provisionedCounts: ProvisionedCounts
}> {
  const [studentRows, enrollmentRows, offeringRows, ownershipRows, checkpointRows, observedRows, riskRows] = await Promise.all([
    context.db.select().from(students).where(eq(students.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, activeSimulationRunId)),
    context.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, activeSimulationRunId)),
    context.db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, activeSimulationRunId)),
  ])
  return {
    demoWorkspaceId,
    activeSimulationRunId,
    provisionedCounts: {
      students: studentRows.length,
      enrollments: enrollmentRows.length,
      offerings: offeringRows.length,
      ownerships: ownershipRows.length,
      runs: 1,
      checkpoints: checkpointRows.length,
      observedStates: observedRows.length,
      riskAssessments: riskRows.length,
    },
  }
}

async function cloneProofArtifactsForDemoRun(
  context: RouteContext,
  input: {
    demoWorkspaceId: string
    sourceSimulationRunId: string
    demoSimulationRunId: string
    sourceStudentIds: string[]
    sourceOfferingIds: string[]
    studentIdBySource: Map<string, string>
    offeringIdBySource: Map<string, string>
    now: string
  },
) {
  const [
    sourceTeacherAllocations,
    sourceTeacherLoads,
    sourceLatentStates,
    sourceBehaviorProfiles,
    sourceTopicStates,
    sourceCoStates,
    sourceWorldContexts,
    sourceQuestionTemplates,
    sourceQuestionResults,
    sourceObservedStates,
    sourceAttendanceSnapshots,
    sourceAssessmentScores,
    sourceRiskEvidence,
    sourceRiskAssessments,
    sourceReassessments,
    sourceAlerts,
    sourceElectives,
    sourceTransitions,
    sourceInterventions,
    sourceInterventionResponses,
    sourceTranscriptTerms,
  ] = await Promise.all([
    context.db.select().from(teacherAllocations).where(eq(teacherAllocations.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(teacherLoadProfiles).where(eq(teacherLoadProfiles.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentLatentStates).where(eq(studentLatentStates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentBehaviorProfiles).where(eq(studentBehaviorProfiles.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentTopicStates).where(eq(studentTopicStates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentCoStates).where(eq(studentCoStates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(worldContextSnapshots).where(eq(worldContextSnapshots.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(simulationQuestionTemplates).where(eq(simulationQuestionTemplates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentQuestionResults).where(eq(studentQuestionResults.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentObservedSemesterStates).where(eq(studentObservedSemesterStates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentAttendanceSnapshots).where(and(
      inArray(studentAttendanceSnapshots.studentId, input.sourceStudentIds),
      inArray(studentAttendanceSnapshots.offeringId, input.sourceOfferingIds),
    )),
    context.db.select().from(studentAssessmentScores).where(and(
      inArray(studentAssessmentScores.studentId, input.sourceStudentIds),
      inArray(studentAssessmentScores.offeringId, input.sourceOfferingIds),
    )),
    context.db.select().from(riskEvidenceSnapshots).where(eq(riskEvidenceSnapshots.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(riskAssessments).where(eq(riskAssessments.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(reassessmentEvents).where(and(
      inArray(reassessmentEvents.studentId, input.sourceStudentIds),
      inArray(reassessmentEvents.offeringId, input.sourceOfferingIds),
    )),
    context.db.select().from(alertDecisions).where(and(
      inArray(alertDecisions.studentId, input.sourceStudentIds),
      inArray(alertDecisions.offeringId, input.sourceOfferingIds),
    )),
    context.db.select().from(electiveRecommendations).where(eq(electiveRecommendations.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(semesterTransitionLogs).where(eq(semesterTransitionLogs.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(studentInterventions).where(and(
      inArray(studentInterventions.studentId, input.sourceStudentIds),
      inArray(studentInterventions.offeringId, input.sourceOfferingIds),
    )),
    context.db.select().from(studentInterventionResponseStates).where(eq(studentInterventionResponseStates.simulationRunId, input.sourceSimulationRunId)),
    context.db.select().from(transcriptTermResults).where(inArray(transcriptTermResults.studentId, input.sourceStudentIds)),
  ])

  const idMap = new Map<string, string>([
    ...input.studentIdBySource.entries(),
    ...input.offeringIdBySource.entries(),
  ])
  const templateIdBySource = new Map(sourceQuestionTemplates.map(row => [row.simulationQuestionTemplateId, cloneId(input.demoWorkspaceId, row.simulationQuestionTemplateId)]))
  const riskEvidenceIdBySource = new Map(sourceRiskEvidence.map(row => [row.riskEvidenceSnapshotId, cloneId(input.demoWorkspaceId, row.riskEvidenceSnapshotId)]))
  const riskAssessmentIdBySource = new Map(sourceRiskAssessments.map(row => [row.riskAssessmentId, cloneId(input.demoWorkspaceId, row.riskAssessmentId)]))
  const alertDecisionIdBySource = new Map(sourceAlerts.map(row => [row.alertDecisionId, cloneId(input.demoWorkspaceId, row.alertDecisionId)]))
  const interventionIdBySource = new Map(sourceInterventions.map(row => [row.interventionId, cloneId(input.demoWorkspaceId, row.interventionId)]))
  const transcriptTermIdBySource = new Map(sourceTranscriptTerms.map(row => [row.transcriptTermResultId, cloneId(input.demoWorkspaceId, row.transcriptTermResultId)]))
  for (const entries of [
    templateIdBySource,
    riskEvidenceIdBySource,
    riskAssessmentIdBySource,
    alertDecisionIdBySource,
    interventionIdBySource,
    transcriptTermIdBySource,
  ]) {
    entries.forEach((value, key) => idMap.set(key, value))
  }

  await insertRowsInChunks(context, teacherAllocations, sourceTeacherAllocations.map(row => ({
    ...row,
    teacherAllocationId: cloneId(input.demoWorkspaceId, row.teacherAllocationId),
    simulationRunId: input.demoSimulationRunId,
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    demoWorkspaceId: input.demoWorkspaceId,
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, teacherLoadProfiles, sourceTeacherLoads.map(row => ({
    ...row,
    teacherLoadProfileId: cloneId(input.demoWorkspaceId, row.teacherLoadProfileId),
    simulationRunId: input.demoSimulationRunId,
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentLatentStates, sourceLatentStates.map(row => ({
    ...row,
    studentLatentStateId: cloneId(input.demoWorkspaceId, row.studentLatentStateId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    latentStateJson: remapJsonText(row.latentStateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentBehaviorProfiles, sourceBehaviorProfiles.map(row => ({
    ...row,
    studentBehaviorProfileId: cloneId(input.demoWorkspaceId, row.studentBehaviorProfileId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    profileJson: remapJsonText(row.profileJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentTopicStates, sourceTopicStates.map(row => ({
    ...row,
    studentTopicStateId: cloneId(input.demoWorkspaceId, row.studentTopicStateId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    stateJson: remapJsonText(row.stateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentCoStates, sourceCoStates.map(row => ({
    ...row,
    studentCoStateId: cloneId(input.demoWorkspaceId, row.studentCoStateId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    stateJson: remapJsonText(row.stateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, worldContextSnapshots, sourceWorldContexts.map(row => ({
    ...row,
    worldContextSnapshotId: cloneId(input.demoWorkspaceId, row.worldContextSnapshotId),
    simulationRunId: input.demoSimulationRunId,
    contextJson: remapJsonText(row.contextJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, simulationQuestionTemplates, sourceQuestionTemplates.map(row => ({
    ...row,
    simulationQuestionTemplateId: templateIdBySource.get(row.simulationQuestionTemplateId) ?? cloneId(input.demoWorkspaceId, row.simulationQuestionTemplateId),
    simulationRunId: input.demoSimulationRunId,
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    templateJson: remapJsonText(row.templateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentQuestionResults, sourceQuestionResults.map(row => ({
    ...row,
    studentQuestionResultId: cloneId(input.demoWorkspaceId, row.studentQuestionResultId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    simulationQuestionTemplateId: templateIdBySource.get(row.simulationQuestionTemplateId) ?? cloneId(input.demoWorkspaceId, row.simulationQuestionTemplateId),
    resultJson: remapJsonText(row.resultJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentObservedSemesterStates, sourceObservedStates.map(row => ({
    ...row,
    studentObservedSemesterStateId: cloneId(input.demoWorkspaceId, row.studentObservedSemesterStateId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    observedStateJson: remapJsonText(row.observedStateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentAttendanceSnapshots, sourceAttendanceSnapshots.map(row => ({
    ...row,
    attendanceSnapshotId: cloneId(input.demoWorkspaceId, row.attendanceSnapshotId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentAssessmentScores, sourceAssessmentScores.map(row => ({
    ...row,
    assessmentScoreId: cloneId(input.demoWorkspaceId, row.assessmentScoreId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, riskEvidenceSnapshots, sourceRiskEvidence.map(row => ({
    ...row,
    riskEvidenceSnapshotId: riskEvidenceIdBySource.get(row.riskEvidenceSnapshotId) ?? cloneId(input.demoWorkspaceId, row.riskEvidenceSnapshotId),
    simulationRunId: input.demoSimulationRunId,
    simulationStageCheckpointId: null,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    featureJson: remapJsonText(row.featureJson, idMap),
    labelJson: remapJsonText(row.labelJson, idMap),
    sourceRefsJson: remapJsonText(row.sourceRefsJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, riskAssessments, sourceRiskAssessments.map(row => ({
    ...row,
    riskAssessmentId: riskAssessmentIdBySource.get(row.riskAssessmentId) ?? cloneId(input.demoWorkspaceId, row.riskAssessmentId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    evidenceSnapshotId: row.evidenceSnapshotId ? riskEvidenceIdBySource.get(row.evidenceSnapshotId) ?? cloneId(input.demoWorkspaceId, row.evidenceSnapshotId) : null,
    driversJson: remapJsonText(row.driversJson, idMap),
    assessedAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, reassessmentEvents, sourceReassessments.map(row => ({
    ...row,
    reassessmentEventId: cloneId(input.demoWorkspaceId, row.reassessmentEventId),
    riskAssessmentId: riskAssessmentIdBySource.get(row.riskAssessmentId) ?? cloneId(input.demoWorkspaceId, row.riskAssessmentId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    payloadJson: remapJsonText(row.payloadJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, alertDecisions, sourceAlerts.map(row => ({
    ...row,
    alertDecisionId: alertDecisionIdBySource.get(row.alertDecisionId) ?? cloneId(input.demoWorkspaceId, row.alertDecisionId),
    riskAssessmentId: riskAssessmentIdBySource.get(row.riskAssessmentId) ?? cloneId(input.demoWorkspaceId, row.riskAssessmentId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  if (sourceAlerts.length > 0) {
    const sourceAlertIds = sourceAlerts.map(row => row.alertDecisionId)
    const sourceOutcomes = await context.db.select().from(alertOutcomes).where(inArray(alertOutcomes.alertDecisionId, sourceAlertIds))
    await insertRowsInChunks(context, alertOutcomes, sourceOutcomes.map(row => ({
      ...row,
      alertOutcomeId: cloneId(input.demoWorkspaceId, row.alertOutcomeId),
      alertDecisionId: alertDecisionIdBySource.get(row.alertDecisionId) ?? cloneId(input.demoWorkspaceId, row.alertDecisionId),
      createdAt: input.now,
      updatedAt: input.now,
    })))
  }
  await insertRowsInChunks(context, electiveRecommendations, sourceElectives.map(row => ({
    ...row,
    electiveRecommendationId: cloneId(input.demoWorkspaceId, row.electiveRecommendationId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    rationaleJson: remapJsonText(row.rationaleJson, idMap),
    alternativesJson: remapJsonText(row.alternativesJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, semesterTransitionLogs, sourceTransitions.map(row => ({
    ...row,
    semesterTransitionLogId: cloneId(input.demoWorkspaceId, row.semesterTransitionLogId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    summaryJson: remapJsonText(row.summaryJson, idMap),
    createdAt: input.now,
  })))
  await insertRowsInChunks(context, studentInterventions, sourceInterventions.map(row => ({
    ...row,
    interventionId: interventionIdBySource.get(row.interventionId) ?? cloneId(input.demoWorkspaceId, row.interventionId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, studentInterventionResponseStates, sourceInterventionResponses.map(row => ({
    ...row,
    studentInterventionResponseStateId: cloneId(input.demoWorkspaceId, row.studentInterventionResponseStateId),
    simulationRunId: input.demoSimulationRunId,
    studentId: mappedId(input.studentIdBySource, row.studentId),
    offeringId: mappedId(input.offeringIdBySource, row.offeringId),
    interventionId: row.interventionId ? interventionIdBySource.get(row.interventionId) ?? cloneId(input.demoWorkspaceId, row.interventionId) : null,
    responseStateJson: remapJsonText(row.responseStateJson, idMap),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  await insertRowsInChunks(context, transcriptTermResults, sourceTranscriptTerms.map(row => ({
    ...row,
    transcriptTermResultId: transcriptTermIdBySource.get(row.transcriptTermResultId) ?? cloneId(input.demoWorkspaceId, row.transcriptTermResultId),
    studentId: mappedId(input.studentIdBySource, row.studentId),
    createdAt: input.now,
    updatedAt: input.now,
  })))
  if (sourceTranscriptTerms.length > 0) {
    const sourceTranscriptTermIds = sourceTranscriptTerms.map(row => row.transcriptTermResultId)
    const sourceTranscriptSubjects = await context.db
      .select()
      .from(transcriptSubjectResults)
      .where(inArray(transcriptSubjectResults.transcriptTermResultId, sourceTranscriptTermIds))
    await insertRowsInChunks(context, transcriptSubjectResults, sourceTranscriptSubjects.map(row => ({
      ...row,
      transcriptSubjectResultId: cloneId(input.demoWorkspaceId, row.transcriptSubjectResultId),
      transcriptTermResultId: transcriptTermIdBySource.get(row.transcriptTermResultId) ?? cloneId(input.demoWorkspaceId, row.transcriptTermResultId),
      createdAt: input.now,
      updatedAt: input.now,
    })))
  }
}

export async function listDemoWorkspaces(context: RouteContext) {
  return context.db.select().from(demoWorkspaces).orderBy(demoWorkspaces.createdAt)
}

export async function createDemoWorkspace(
  context: RouteContext,
  input: {
    name: string
    ownerFacultyId?: string
    batchId?: string
    createdByFacultyId?: string | null
  },
): Promise<typeof demoWorkspaces.$inferSelect> {
  const now = context.now()
  const demoWorkspaceId = createId('demo_ws')
  const scopeName = buildDemoScopeName(demoWorkspaceId)
  const metadata = {
    storageMode: 'schema',
    sourceBatchId: input.batchId ?? null,
    provisionedCounts: {
      students: 0,
      offerings: 0,
      runs: 0,
    },
  }
  const row: typeof demoWorkspaces.$inferInsert = {
    demoWorkspaceId,
    name: input.name,
    ownerFacultyId: input.ownerFacultyId ?? null,
    batchId: input.batchId ?? null,
    scopeKind: 'schema',
    scopeName,
    sourceBatchId: input.batchId ?? null,
    activeSimulationRunId: null,
    createdByFacultyId: input.createdByFacultyId ?? null,
    stoppedAt: null,
    resetAt: null,
    metadataJson: stringifyJson(metadata),
    status: 'provisioning',
    createdAt: now,
    updatedAt: now,
  }
  await context.db.insert(demoWorkspaces).values(row)
  await createDemoWorkspaceSchema(context.pool, scopeName)
  await context.db.update(demoWorkspaces).set({
    status: 'active',
    updatedAt: now,
  }).where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  const [created] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  if (!created) throw new Error(`Demo workspace ${demoWorkspaceId} was not created`)
  return created
}

export async function previewDemoProvisioning(
  context: RouteContext,
  input: {
    demoWorkspaceId: string
    batchId: string
    termId: string
    sectionLabels: string[]
    studentsPerSection: number
  },
): Promise<{
  batchLabel: string
  termLabel: string
  sections: string[]
  estimatedStudentCount: number
  estimatedOfferingCount: number
  curriculumCourseCount: number
}> {
  const [demoWs] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, input.demoWorkspaceId))
  if (!demoWs) throw new Error(`Demo workspace ${input.demoWorkspaceId} not found`)

  const [batch] = await context.db
    .select()
    .from(batches)
    .where(eq(batches.batchId, input.batchId))
  if (!batch) throw new Error(`Batch ${input.batchId} not found`)

  const [term] = await context.db
    .select()
    .from(academicTerms)
    .where(eq(academicTerms.termId, input.termId))
  if (!term) throw new Error(`Term ${input.termId} not found`)

  const curriculumRows = await context.db
    .select()
    .from(curriculumCourses)
    .where(eq(curriculumCourses.batchId, input.batchId))

  const activeCurriculumRows = curriculumRows.filter(
    row =>
      row.status !== 'deleted' &&
      row.status !== 'archived' &&
      row.semesterNumber === term.semesterNumber,
  )

  const curriculumCourseCount = activeCurriculumRows.length
  const estimatedOfferingCount = curriculumCourseCount * input.sectionLabels.length
  const estimatedStudentCount = input.sectionLabels.length * input.studentsPerSection

  return {
    batchLabel: batch.batchLabel,
    termLabel: term.academicYearLabel,
    sections: input.sectionLabels,
    estimatedStudentCount,
    estimatedOfferingCount,
    curriculumCourseCount,
  }
}

export async function provisionDemoWorkspace(
  context: RouteContext,
  demoWorkspaceId: string,
): Promise<{
  demoWorkspaceId: string
  activeSimulationRunId: string
  provisionedCounts: ProvisionedCounts
}> {
  const now = context.now()
  const [demoWs] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  if (!demoWs) throw notFound('Demo workspace not found')
  if (demoWs.status !== 'active') throw conflict('Demo workspace is not active')

  if (demoWs.activeSimulationRunId) {
    const [existingRun] = await context.db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.simulationRunId, demoWs.activeSimulationRunId))
    if (existingRun && existingRun.demoWorkspaceId === demoWorkspaceId) {
      return summarizeProvisionedWorkspace(context, demoWorkspaceId, existingRun.simulationRunId)
    }
  }

  const sourceRun = await resolveSourceProofRun(context)
  const sourceTerms = await context.db
    .select()
    .from(academicTerms)
    .where(eq(academicTerms.batchId, sourceRun.batchId))
  const sourceTermIds = sourceTerms.map(row => row.termId)
  if (sourceTermIds.length === 0) throw conflict('No academic terms are available for demo provisioning')

  const sourceOfferings = await context.db
    .select()
    .from(sectionOfferings)
    .where(and(inArray(sectionOfferings.termId, sourceTermIds), isNull(sectionOfferings.demoWorkspaceId)))
  if (sourceOfferings.length === 0) throw conflict('No seeded offerings are available for demo provisioning')

  const sourceOfferingIds = sourceOfferings.map(row => row.offeringId)
  const sourceEnrollments = await context.db
    .select()
    .from(studentEnrollments)
    .where(and(inArray(studentEnrollments.termId, sourceTermIds), isNull(studentEnrollments.demoWorkspaceId)))
  const sourceStudentIds = [...new Set(sourceEnrollments.map(row => row.studentId))]
  if (sourceStudentIds.length === 0) throw conflict('No seeded students are available for demo provisioning')

  const [
    sourceStudents,
    sourceProfiles,
    sourceMentors,
    sourceOwnerships,
  ] = await Promise.all([
    context.db.select().from(students).where(and(inArray(students.studentId, sourceStudentIds), isNull(students.demoWorkspaceId))),
    context.db.select().from(studentAcademicProfiles).where(inArray(studentAcademicProfiles.studentId, sourceStudentIds)),
    context.db.select().from(mentorAssignments).where(and(inArray(mentorAssignments.studentId, sourceStudentIds), isNull(mentorAssignments.demoWorkspaceId))),
    context.db.select().from(facultyOfferingOwnerships).where(and(inArray(facultyOfferingOwnerships.offeringId, sourceOfferingIds), isNull(facultyOfferingOwnerships.demoWorkspaceId))),
  ])

  const studentIdBySource = new Map(sourceStudents.map(row => [row.studentId, cloneId(demoWorkspaceId, row.studentId)]))
  const offeringIdBySource = new Map(sourceOfferings.map(row => [row.offeringId, cloneId(demoWorkspaceId, row.offeringId)]))
  const clonedRunId = cloneId(demoWorkspaceId, sourceRun.simulationRunId)
  const termById = new Map(sourceTerms.map(row => [row.termId, row]))
  const offeringSemesters = sourceOfferings
    .map(row => termById.get(row.termId)?.semesterNumber ?? null)
    .filter((value): value is number => value != null)
  const targetSemester = offeringSemesters.includes(sourceRun.semesterStart)
    ? sourceRun.semesterStart
    : Math.min(...offeringSemesters)

  await context.db.insert(students).values(sourceStudents.map(row => ({
    ...row,
    studentId: studentIdBySource.get(row.studentId) ?? cloneId(demoWorkspaceId, row.studentId),
    usn: `${row.usn}-DEMO-${demoIdPrefix(demoWorkspaceId)}`,
    email: row.email ? row.email.replace('@', `+${demoIdPrefix(demoWorkspaceId)}@`) : null,
    demoWorkspaceId,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoNothing()

  if (sourceProfiles.length > 0) {
    await context.db.insert(studentAcademicProfiles).values(sourceProfiles.map(row => ({
      ...row,
      studentId: studentIdBySource.get(row.studentId) ?? cloneId(demoWorkspaceId, row.studentId),
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing()
  }

  await context.db.insert(sectionOfferings).values(sourceOfferings.map(row => ({
    ...row,
    offeringId: offeringIdBySource.get(row.offeringId) ?? cloneId(demoWorkspaceId, row.offeringId),
    demoWorkspaceId,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoNothing()

  await context.db.insert(studentEnrollments).values(sourceEnrollments.map(row => ({
    ...row,
    enrollmentId: cloneId(demoWorkspaceId, row.enrollmentId),
    studentId: studentIdBySource.get(row.studentId) ?? cloneId(demoWorkspaceId, row.studentId),
    demoWorkspaceId,
    createdAt: now,
    updatedAt: now,
  }))).onConflictDoNothing()

  if (sourceMentors.length > 0) {
    await context.db.insert(mentorAssignments).values(sourceMentors.map(row => ({
      ...row,
      assignmentId: cloneId(demoWorkspaceId, row.assignmentId),
      studentId: studentIdBySource.get(row.studentId) ?? cloneId(demoWorkspaceId, row.studentId),
      demoWorkspaceId,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing()
  }

  if (sourceOwnerships.length > 0) {
    await context.db.insert(facultyOfferingOwnerships).values(sourceOwnerships.map(row => ({
      ...row,
      ownershipId: cloneId(demoWorkspaceId, row.ownershipId),
      offeringId: offeringIdBySource.get(row.offeringId) ?? cloneId(demoWorkspaceId, row.offeringId),
      demoWorkspaceId,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing()
  }

  await context.db.insert(simulationRuns).values({
    ...sourceRun,
    simulationRunId: clonedRunId,
    parentSimulationRunId: sourceRun.simulationRunId,
    runLabel: `Demo workspace ${demoWs.name}: ${sourceRun.runLabel}`,
    status: 'active',
    activeFlag: 1,
    activeOperationalSemester: targetSemester,
    activeStageKey: 'pre-tt1',
    lifecycleState: 'active',
    demoWorkspaceId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing()

  await cloneProofArtifactsForDemoRun(context, {
    demoWorkspaceId,
    sourceSimulationRunId: sourceRun.simulationRunId,
    demoSimulationRunId: clonedRunId,
    sourceStudentIds,
    sourceOfferingIds,
    studentIdBySource,
    offeringIdBySource,
    now,
  })
  await rebuildSimulationStagePlayback(context.db, {
    simulationRunId: clonedRunId,
    policy: parseJson(sourceRun.policySnapshotJson, {} as ResolvedPolicy),
    now,
  })

  const result = await summarizeProvisionedWorkspace(context, demoWorkspaceId, clonedRunId)
  const metadata = parseMetadata(demoWs.metadataJson)
  await context.db.update(demoWorkspaces).set({
    batchId: sourceRun.batchId,
    sourceBatchId: sourceRun.batchId,
    activeSimulationRunId: clonedRunId,
    metadataJson: stringifyJson({
      ...metadata,
      storageMode: 'schema',
      sourceBatchId: sourceRun.batchId,
      provisionedCounts: result.provisionedCounts,
    }),
    status: 'active',
    updatedAt: now,
  }).where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))

  return result
}

export async function resetDemoWorkspace(
  context: RouteContext,
  demoWorkspaceId: string,
): Promise<{
  deletedStudents: number
  deletedOfferings: number
  deletedRuns: number
  deletedSessions: number
  deletedSchema: boolean
  scopeName: string | null
}> {
  const [demoWs] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  if (!demoWs) throw new Error(`Demo workspace ${demoWorkspaceId} not found`)

  const demoSessions = await context.db
    .select({ sessionId: sessions.sessionId })
    .from(sessions)
    .where(eq(sessions.demoWorkspaceId, demoWorkspaceId))
  await context.db
    .delete(sessions)
    .where(eq(sessions.demoWorkspaceId, demoWorkspaceId))

  let deletedSchema = false
  if (demoWs.scopeKind === 'schema' && demoWs.scopeName) {
    await dropDemoWorkspaceSchema(context.pool, demoWs.scopeName)
    deletedSchema = true
  }

  // 1. Get IDs for cascade
  const demoStudents = await context.db
    .select({ studentId: students.studentId })
    .from(students)
    .where(eq(students.demoWorkspaceId, demoWorkspaceId))
  const demoStudentIds = demoStudents.map(r => r.studentId)

  const demoOfferings = await context.db
    .select({ offeringId: sectionOfferings.offeringId })
    .from(sectionOfferings)
    .where(eq(sectionOfferings.demoWorkspaceId, demoWorkspaceId))
  const demoOfferingIds = demoOfferings.map(r => r.offeringId)

  const demoRuns = await context.db
    .select({ simulationRunId: simulationRuns.simulationRunId })
    .from(simulationRuns)
    .where(eq(simulationRuns.demoWorkspaceId, demoWorkspaceId))
  const demoRunIds = demoRuns.map(r => r.simulationRunId)

  // 2. Delete child tables
  if (demoRunIds.length > 0) {
    for (const simulationRunId of demoRunIds) {
      await resetPlaybackStageArtifacts(context.db, simulationRunId)
    }
    await context.db
      .delete(simulationResetSnapshots)
      .where(inArray(simulationResetSnapshots.simulationRunId, demoRunIds))
    await context.db
      .delete(studentInterventionResponseStates)
      .where(inArray(studentInterventionResponseStates.simulationRunId, demoRunIds))
    await context.db
      .delete(studentQuestionResults)
      .where(inArray(studentQuestionResults.simulationRunId, demoRunIds))
    await context.db
      .delete(simulationQuestionTemplates)
      .where(inArray(simulationQuestionTemplates.simulationRunId, demoRunIds))
    await context.db
      .delete(semesterTransitionLogs)
      .where(inArray(semesterTransitionLogs.simulationRunId, demoRunIds))
    await context.db
      .delete(electiveRecommendations)
      .where(inArray(electiveRecommendations.simulationRunId, demoRunIds))
    const demoAlertDecisions = await context.db
      .select({ alertDecisionId: alertDecisions.alertDecisionId })
      .from(alertDecisions)
      .where(inArray(alertDecisions.studentId, demoStudentIds.length > 0 ? demoStudentIds : ['__none__']))
    const demoAlertDecisionIds = demoAlertDecisions.map(row => row.alertDecisionId)
    if (demoAlertDecisionIds.length > 0) {
      await context.db
        .delete(alertOutcomes)
        .where(inArray(alertOutcomes.alertDecisionId, demoAlertDecisionIds))
    }
    await context.db
      .delete(alertDecisions)
      .where(inArray(alertDecisions.studentId, demoStudentIds.length > 0 ? demoStudentIds : ['__none__']))
    await context.db
      .delete(reassessmentEvents)
      .where(inArray(reassessmentEvents.studentId, demoStudentIds.length > 0 ? demoStudentIds : ['__none__']))
    await context.db
      .delete(riskAssessments)
      .where(inArray(riskAssessments.simulationRunId, demoRunIds))
    await context.db
      .delete(teacherLoadProfiles)
      .where(inArray(teacherLoadProfiles.simulationRunId, demoRunIds))
    await context.db
      .delete(teacherAllocations)
      .where(inArray(teacherAllocations.simulationRunId, demoRunIds))
    await context.db
      .delete(studentBehaviorProfiles)
      .where(inArray(studentBehaviorProfiles.simulationRunId, demoRunIds))
    await context.db
      .delete(studentLatentStates)
      .where(inArray(studentLatentStates.simulationRunId, demoRunIds))
    await context.db
      .delete(worldContextSnapshots)
      .where(inArray(worldContextSnapshots.simulationRunId, demoRunIds))
    await context.db
      .delete(studentCoStates)
      .where(inArray(studentCoStates.simulationRunId, demoRunIds))
    await context.db
      .delete(studentTopicStates)
      .where(inArray(studentTopicStates.simulationRunId, demoRunIds))
    await context.db
      .delete(riskEvidenceSnapshots)
      .where(inArray(riskEvidenceSnapshots.simulationRunId, demoRunIds))
    await context.db
      .delete(studentObservedSemesterStates)
      .where(inArray(studentObservedSemesterStates.simulationRunId, demoRunIds))
  }
  if (demoOfferingIds.length > 0) {
    await context.db
      .delete(facultyOfferingOwnerships)
      .where(inArray(facultyOfferingOwnerships.offeringId, demoOfferingIds))
  }
  if (demoStudentIds.length > 0) {
    await context.db
      .delete(studentAttendanceSnapshots)
      .where(inArray(studentAttendanceSnapshots.studentId, demoStudentIds))
    await context.db
      .delete(studentAssessmentScores)
      .where(inArray(studentAssessmentScores.studentId, demoStudentIds))
    await context.db
      .delete(studentInterventions)
      .where(inArray(studentInterventions.studentId, demoStudentIds))
    const demoTranscriptTerms = await context.db
      .select({ transcriptTermResultId: transcriptTermResults.transcriptTermResultId })
      .from(transcriptTermResults)
      .where(inArray(transcriptTermResults.studentId, demoStudentIds))
    const demoTranscriptTermIds = demoTranscriptTerms.map(row => row.transcriptTermResultId)
    if (demoTranscriptTermIds.length > 0) {
      await context.db
        .delete(transcriptSubjectResults)
        .where(inArray(transcriptSubjectResults.transcriptTermResultId, demoTranscriptTermIds))
      await context.db
        .delete(transcriptTermResults)
        .where(inArray(transcriptTermResults.transcriptTermResultId, demoTranscriptTermIds))
    }
    await context.db
      .delete(studentAcademicProfiles)
      .where(inArray(studentAcademicProfiles.studentId, demoStudentIds))
    await context.db
      .delete(mentorAssignments)
      .where(inArray(mentorAssignments.studentId, demoStudentIds))
    await context.db
      .delete(studentEnrollments)
      .where(inArray(studentEnrollments.studentId, demoStudentIds))
  }

  // 3. Delete root tables
  await context.db
    .delete(simulationRuns)
    .where(eq(simulationRuns.demoWorkspaceId, demoWorkspaceId))
  await context.db
    .delete(sectionOfferings)
    .where(eq(sectionOfferings.demoWorkspaceId, demoWorkspaceId))
  await context.db
    .delete(students)
    .where(eq(students.demoWorkspaceId, demoWorkspaceId))

  // 4. Delete workspace record
  await context.db
    .delete(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))

  return {
    deletedStudents: demoStudentIds.length,
    deletedOfferings: demoOfferingIds.length,
    deletedRuns: demoRunIds.length,
    deletedSessions: demoSessions.length,
    deletedSchema,
    scopeName: demoWs.scopeName ?? null,
  }
}
