/**
 * Curriculum-import summary refresh + single-course sync into the import.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts. Part of the
 * curriculum-graph-shared write path (R4) — semantics/order preserved.
 */
import { eq } from 'drizzle-orm'
import {
  bridgeModules,
  curriculumCourses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  electiveBaskets,
  electiveOptions,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { stringifyJson } from '../../../../lib/json.js'
import { buildSnapshotChecksum } from '../../../../application/use-cases/admin-structure/feature-domain.js'
import {
  ensureCourseRecordForCurriculumCourse,
  ensureEditableCurriculumImport,
  findCurriculumNodeForCourse,
  getLatestCurriculumImport,
  upsertCurriculumNodeForCourse,
} from './curriculum-import-core.js'

export async function refreshCurriculumImportSummary(context: RouteContext, input: {
  batchId: string
  curriculumImportVersionId: string
  now: string
}) {
  const [importRow] = await context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
  if (!importRow) return

  const [nodeRows, edgeRows, bridgeRows, basketRows, optionRows] = await Promise.all([
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveBaskets).where(eq(electiveBaskets.curriculumImportVersionId, input.curriculumImportVersionId)),
    context.db.select().from(electiveOptions),
  ])

  const activeNodes = nodeRows.filter(row => row.status === 'active').sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
  const basketIds = new Set(basketRows.map(row => row.electiveBasketId))
  const scopedOptions = optionRows.filter(row => basketIds.has(row.electiveBasketId))
  const snapshotPayload = {
    nodes: activeNodes.map(row => ({
      semesterNumber: row.semesterNumber,
      courseCode: row.courseCode,
      title: row.title,
      credits: row.credits,
      status: row.status,
      assessmentProfile: row.assessmentProfile,
    })),
    edges: edgeRows.filter(row => row.status === 'active').map(row => ({
      sourceCurriculumNodeId: row.sourceCurriculumNodeId,
      targetCurriculumNodeId: row.targetCurriculumNodeId,
      edgeKind: row.edgeKind,
      rationale: row.rationale,
      status: row.status,
    })),
    bridges: bridgeRows.filter(row => row.status === 'active').map(row => ({
      curriculumNodeId: row.curriculumNodeId,
      moduleTitlesJson: row.moduleTitlesJson,
      status: row.status,
    })),
    electiveOptions: scopedOptions.map(row => ({
      electiveBasketId: row.electiveBasketId,
      code: row.code,
      title: row.title,
      stream: row.stream,
      semesterSlot: row.semesterSlot,
    })),
  }
  const checksum = buildSnapshotChecksum(snapshotPayload)
  await context.db.update(curriculumImportVersions).set({
    sourceChecksum: importRow.sourceType === 'admin' ? checksum : importRow.sourceChecksum,
    outputChecksum: checksum,
    firstSemester: activeNodes[0]?.semesterNumber ?? importRow.firstSemester,
    lastSemester: activeNodes.at(-1)?.semesterNumber ?? importRow.lastSemester,
    courseCount: activeNodes.length,
    totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
    explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
    addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
    bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
    electiveOptionCount: scopedOptions.length,
    validationStatus: importRow.sourceType === 'admin' ? 'admin-managed' : importRow.validationStatus,
    completenessCertificateJson: stringifyJson({
      sourceLabel: importRow.sourceLabel,
      managedBy: importRow.sourceType === 'admin' ? 'sysadmin' : 'import',
      courseCount: activeNodes.length,
      totalCredits: activeNodes.reduce((sum, row) => sum + row.credits, 0),
      explicitEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.status === 'active' && row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.filter(row => row.status === 'active').length,
      electiveOptionCount: scopedOptions.length,
    }),
    updatedAt: input.now,
  }).where(eq(curriculumImportVersions.curriculumImportVersionId, input.curriculumImportVersionId))
}

export async function syncCurriculumCourseIntoImport(context: RouteContext, input: {
  curriculumCourse: typeof curriculumCourses.$inferSelect
  actorFacultyId?: string | null
  now: string
}) {
  const latestImport = await getLatestCurriculumImport(context, input.curriculumCourse.batchId)
  if ((input.curriculumCourse.status === 'deleted' || input.curriculumCourse.status === 'archived') && !latestImport) return null
  const editableImport = latestImport ?? await ensureEditableCurriculumImport(context, {
    batchId: input.curriculumCourse.batchId,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
  })
  if (input.curriculumCourse.status !== 'deleted' && input.curriculumCourse.status !== 'archived') {
    const course = await ensureCourseRecordForCurriculumCourse(context, input.curriculumCourse)
    await upsertCurriculumNodeForCourse(context, {
      batchId: input.curriculumCourse.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse: input.curriculumCourse,
      courseId: course.courseId,
      now: input.now,
    })
  } else {
    const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
    const existingNode = findCurriculumNodeForCourse(nodeRows, {
      courseId: input.curriculumCourse.courseId,
      courseCode: input.curriculumCourse.courseCode,
      title: input.curriculumCourse.title,
      semesterNumber: input.curriculumCourse.semesterNumber,
    })
    if (existingNode) {
      await context.db.update(curriculumNodes).set({
        status: 'deleted',
        updatedAt: input.now,
      }).where(eq(curriculumNodes.curriculumNodeId, existingNode.curriculumNodeId))
    }
  }
  await refreshCurriculumImportSummary(context, {
    batchId: input.curriculumCourse.batchId,
    curriculumImportVersionId: editableImport.curriculumImportVersionId,
    now: input.now,
  })
  return editableImport
}
