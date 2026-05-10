import { eq, inArray } from 'drizzle-orm'
import type { RouteContext } from '../app.js'
import { createId } from './ids.js'
import { stringifyJson } from './json.js'
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
  studentCoStates,
  studentTopicStates,
  riskEvidenceSnapshots,
  riskAssessments,
  batches,
  academicTerms,
  curriculumCourses,
} from '../db/schema.js'

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

export async function resetDemoWorkspace(
  context: RouteContext,
  demoWorkspaceId: string,
): Promise<{
  deletedStudents: number
  deletedOfferings: number
  deletedRuns: number
  deletedSchema: boolean
  scopeName: string | null
}> {
  const [demoWs] = await context.db
    .select()
    .from(demoWorkspaces)
    .where(eq(demoWorkspaces.demoWorkspaceId, demoWorkspaceId))
  if (!demoWs) throw new Error(`Demo workspace ${demoWorkspaceId} not found`)

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
    deletedSchema,
    scopeName: demoWs.scopeName ?? null,
  }
}
