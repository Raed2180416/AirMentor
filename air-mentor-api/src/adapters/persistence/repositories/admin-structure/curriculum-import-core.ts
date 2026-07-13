/**
 * Curriculum-import write path (core): ensure course records, ensure an
 * editable admin-managed import version, and upsert curriculum nodes.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts. This is the
 * write path shared with curriculum-graph (R4) — semantics, ordering, and
 * transactions are preserved exactly.
 */
import { eq } from 'drizzle-orm'
import {
  batches,
  branches,
  courses,
  curriculumCourses,
  curriculumImportVersions,
  curriculumNodes,
  departments,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import { buildSnapshotChecksum, sanitizeInternalCompilerId } from '../../../../application/use-cases/admin-structure/feature-domain.js'

export async function getLatestCurriculumImport(context: RouteContext, batchId: string) {
  const rows = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId))
  return rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
}

export function findCurriculumNodeForCourse(
  nodeRows: Array<typeof curriculumNodes.$inferSelect>,
  course: {
    courseId?: string | null
    courseCode: string
    title: string
    semesterNumber: number
  },
) {
  return nodeRows.find(row =>
    (course.courseId && row.courseId === course.courseId)
    || (row.semesterNumber === course.semesterNumber && row.courseCode.toLowerCase() === course.courseCode.toLowerCase())
    || (row.semesterNumber === course.semesterNumber && row.title.toLowerCase() === course.title.toLowerCase())
  ) ?? null
}

export async function ensureCourseRecordForCurriculumCourse(context: RouteContext, curriculumCourse: typeof curriculumCourses.$inferSelect) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, curriculumCourse.batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')

  let course = curriculumCourse.courseId
    ? (await context.db.select().from(courses).where(eq(courses.courseId, curriculumCourse.courseId)))[0] ?? null
    : null

  if (!course) {
    const departmentCourses = await context.db.select().from(courses).where(eq(courses.departmentId, department.departmentId))
    course = departmentCourses.find(row => row.courseCode.toLowerCase() === curriculumCourse.courseCode.toLowerCase()) ?? null
  }

  if (!course) {
    const createdCourse = {
      courseId: createId('course'),
      institutionId: department.institutionId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(courses).values(createdCourse)
    course = createdCourse
  } else if (
    course.courseCode !== curriculumCourse.courseCode
    || course.title !== curriculumCourse.title
    || course.defaultCredits !== curriculumCourse.credits
    || course.departmentId !== department.departmentId
    || course.status !== 'active'
  ) {
    await context.db.update(courses).set({
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }).where(eq(courses.courseId, course.courseId))
    course = {
      ...course,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      defaultCredits: curriculumCourse.credits,
      departmentId: department.departmentId,
      status: 'active',
      version: course.version + 1,
      updatedAt: context.now(),
    }
  }

  if (curriculumCourse.courseId !== course.courseId) {
    await context.db.update(curriculumCourses).set({
      courseId: course.courseId,
      updatedAt: context.now(),
      version: curriculumCourse.version + 1,
    }).where(eq(curriculumCourses.curriculumCourseId, curriculumCourse.curriculumCourseId))
  }

  return course
}

export async function ensureEditableCurriculumImport(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
}) {
  const existing = await getLatestCurriculumImport(context, input.batchId)
  if (existing) return existing

  const curriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))

  const checksum = buildSnapshotChecksum(curriculumRows.map(row => ({
    semesterNumber: row.semesterNumber,
    courseCode: row.courseCode,
    title: row.title,
    credits: row.credits,
    status: row.status,
  })))
  const firstSemester = curriculumRows[0]?.semesterNumber ?? 1
  const lastSemester = curriculumRows.at(-1)?.semesterNumber ?? firstSemester
  const importRow = {
    curriculumImportVersionId: createId('curriculum_import'),
    batchId: input.batchId,
    sourceLabel: 'system-admin-live',
    sourceChecksum: checksum,
    sourcePath: null,
    sourceType: 'admin',
    compilerVersion: 'system-admin-live-v1',
    outputChecksum: checksum,
    firstSemester,
    lastSemester,
    courseCount: curriculumRows.length,
    totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: 0,
    addedEdgeCount: 0,
    bridgeModuleCount: 0,
    electiveOptionCount: 0,
    unresolvedMappingCount: 0,
    validationStatus: 'admin-managed',
    completenessCertificateJson: stringifyJson({
      sourceLabel: 'system-admin-live',
      managedBy: 'sysadmin',
      courseCount: curriculumRows.length,
      totalCredits: curriculumRows.reduce((sum, row) => sum + row.credits, 0),
    }),
    approvedByFacultyId: input.actorFacultyId ?? null,
    approvedAt: input.now,
    status: 'approved',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumImportVersions).values(importRow)

  for (const curriculumCourse of curriculumRows) {
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    await context.db.insert(curriculumNodes).values({
      curriculumNodeId: createId('curriculum_node'),
      curriculumImportVersionId: importRow.curriculumImportVersionId,
      batchId: input.batchId,
      semesterNumber: curriculumCourse.semesterNumber,
      courseId: course.courseId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      credits: curriculumCourse.credits,
      internalCompilerId: sanitizeInternalCompilerId(curriculumCourse.courseCode, curriculumCourse.title),
      officialWebCode: curriculumCourse.courseCode,
      officialWebTitle: curriculumCourse.title,
      matchStatus: 'admin-authored',
      mappingNote: 'System-admin managed curriculum snapshot.',
      assessmentProfile: 'admin-authored',
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  return importRow
}

export async function upsertCurriculumNodeForCourse(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  curriculumCourse: typeof curriculumCourses.$inferSelect
  courseId: string
  assessmentProfile?: string | null
  now: string
}) {
  const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId))
  const current = findCurriculumNodeForCourse(nodeRows, {
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    semesterNumber: input.curriculumCourse.semesterNumber,
  })

  if (current) {
    await context.db.update(curriculumNodes).set({
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      internalCompilerId: current.internalCompilerId || sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      matchStatus: current.matchStatus || 'admin-authored',
      mappingNote: current.mappingNote ?? 'System-admin managed curriculum snapshot.',
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }).where(eq(curriculumNodes.curriculumNodeId, current.curriculumNodeId))
    return {
      ...current,
      semesterNumber: input.curriculumCourse.semesterNumber,
      courseId: input.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      credits: input.curriculumCourse.credits,
      officialWebCode: input.curriculumCourse.courseCode,
      officialWebTitle: input.curriculumCourse.title,
      assessmentProfile: input.assessmentProfile ?? current.assessmentProfile ?? 'admin-authored',
      status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
      updatedAt: input.now,
    }
  }

  const created = {
    curriculumNodeId: createId('curriculum_node'),
    curriculumImportVersionId: input.curriculumImportVersionId,
    batchId: input.batchId,
    semesterNumber: input.curriculumCourse.semesterNumber,
    courseId: input.courseId,
    courseCode: input.curriculumCourse.courseCode,
    title: input.curriculumCourse.title,
    credits: input.curriculumCourse.credits,
    internalCompilerId: sanitizeInternalCompilerId(input.curriculumCourse.courseCode, input.curriculumCourse.title),
    officialWebCode: input.curriculumCourse.courseCode,
    officialWebTitle: input.curriculumCourse.title,
    matchStatus: 'admin-authored',
    mappingNote: 'System-admin managed curriculum snapshot.',
    assessmentProfile: input.assessmentProfile ?? 'admin-authored',
    outcomeBloomLevel: null,
    outcomeMasteryTarget: null,
    status: input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived' ? 'deleted' : 'active',
    createdAt: input.now,
    updatedAt: input.now,
  }
  await context.db.insert(curriculumNodes).values(created)
  return created
}
