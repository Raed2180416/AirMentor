import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { RouteContext } from '../app.js'
import { createId } from './ids.js'
import { parseJson, stringifyJson } from './json.js'
import { conflict, notFound } from './http-errors.js'
import {
  MSRUAS_PROOF_BATCH_ID,
  MSRUAS_PROOF_SIMULATION_RUN_ID,
} from './msruas-proof-sandbox.js'
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
  simulationStageCheckpoints,
  studentCoStates,
  studentTopicStates,
  riskEvidenceSnapshots,
  riskAssessments,
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
  const [studentRows, enrollmentRows, offeringRows, ownershipRows, checkpointRows] = await Promise.all([
    context.db.select().from(students).where(eq(students.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.demoWorkspaceId, demoWorkspaceId)),
    context.db.select().from(simulationStageCheckpoints).where(eq(simulationStageCheckpoints.simulationRunId, activeSimulationRunId)),
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
    },
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
  const targetSemester = offeringSemesters.includes(sourceRun.activeOperationalSemester)
    ? sourceRun.activeOperationalSemester
    : Math.max(...offeringSemesters)

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
    activeStageKey: sourceRun.activeStageKey ?? 'pre-tt1',
    lifecycleState: 'active',
    demoWorkspaceId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing()

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
    await context.db
      .delete(teacherAllocations)
      .where(inArray(teacherAllocations.simulationRunId, demoRunIds))
    await context.db
      .delete(teacherLoadProfiles)
      .where(inArray(teacherLoadProfiles.simulationRunId, demoRunIds))
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
      .delete(riskAssessments)
      .where(inArray(riskAssessments.simulationRunId, demoRunIds))
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
