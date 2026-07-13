/**
 * Materialise resolved curriculum-feature items into the editable import
 * (nodes/edges/bridges/topic-partitions/outcome-overrides), and rematerialise a
 * whole batch's resolved curriculum.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { eq, inArray } from 'drizzle-orm'
import {
  bridgeModules,
  courseOutcomeOverrides,
  courseTopicPartitions,
  curriculumCourses,
  curriculumEdges,
  curriculumNodes,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import type { CurriculumFeatureProfileCoursePayload } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import { validateResolvedCurriculumFeatureItems } from '../../../../application/use-cases/admin-structure/feature-validation.js'
import {
  ensureCourseRecordForCurriculumCourse,
  ensureEditableCurriculumImport,
  findCurriculumNodeForCourse,
  upsertCurriculumNodeForCourse,
} from './curriculum-import-core.js'
import { refreshCurriculumImportSummary } from './curriculum-import-summary.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'

export async function materializeResolvedCurriculumFeatureItems(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
  items: Array<{
    curriculumCourseId: string
    resolvedConfig: CurriculumFeatureProfileCoursePayload
  }>
}) {
  const editableImport = await ensureEditableCurriculumImport(context, {
    batchId: input.batchId,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
  })
  const batchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
  validateResolvedCurriculumFeatureItems({
    batchId: input.batchId,
    batchCurriculumRows,
    items: input.items,
  })
  const nodeRows = await context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, editableImport.curriculumImportVersionId))
  const nodeById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))

  for (const item of input.items) {
    const curriculumCourse = batchCurriculumRows.find(row => row.curriculumCourseId === item.curriculumCourseId)
    if (!curriculumCourse) continue
    const course = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
    const node = await upsertCurriculumNodeForCourse(context, {
      batchId: input.batchId,
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumCourse,
      courseId: course.courseId,
      assessmentProfile: item.resolvedConfig.assessmentProfile,
      now: input.now,
    })
    nodeById.set(node.curriculumNodeId, node)

    const existingTargetEdgeRows = (await context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId)
    if (existingTargetEdgeRows.length > 0) {
      await context.db.delete(curriculumEdges).where(inArray(curriculumEdges.curriculumEdgeId, existingTargetEdgeRows.map(row => row.curriculumEdgeId)))
    }

    const prerequisiteRows: Array<typeof curriculumEdges.$inferInsert> = []
    for (const prerequisite of item.resolvedConfig.prerequisites) {
      const sourceCourse = batchCurriculumRows.find(row => row.courseCode.toLowerCase() === prerequisite.sourceCourseCode.toLowerCase())
      if (!sourceCourse) continue
      const sourceCourseRecord = await ensureCourseRecordForCurriculumCourse(context, sourceCourse)
      const sourceNode = findCurriculumNodeForCourse(Array.from(nodeById.values()), {
        courseId: sourceCourseRecord.courseId,
        courseCode: sourceCourse.courseCode,
        title: sourceCourse.title,
        semesterNumber: sourceCourse.semesterNumber,
      }) ?? await upsertCurriculumNodeForCourse(context, {
        batchId: input.batchId,
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumCourse: sourceCourse,
        courseId: sourceCourseRecord.courseId,
        now: input.now,
      })
      nodeById.set(sourceNode.curriculumNodeId, sourceNode)
      if (sourceNode.curriculumNodeId === node.curriculumNodeId) continue
      prerequisiteRows.push({
        curriculumEdgeId: createId('curriculum_edge'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        batchId: input.batchId,
        sourceCurriculumNodeId: sourceNode.curriculumNodeId,
        targetCurriculumNodeId: node.curriculumNodeId,
        edgeKind: prerequisite.edgeKind,
        rationale: prerequisite.rationale,
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
    if (prerequisiteRows.length > 0) {
      await context.db.insert(curriculumEdges).values(prerequisiteRows)
    }

    const existingBridgeRows = (await context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingBridgeRows.length > 0) {
      await context.db.delete(bridgeModules).where(inArray(bridgeModules.bridgeModuleId, existingBridgeRows.map(row => row.bridgeModuleId)))
    }
    if (item.resolvedConfig.bridgeModules.length > 0) {
      await context.db.insert(bridgeModules).values({
        bridgeModuleId: createId('bridge_module'),
        curriculumImportVersionId: editableImport.curriculumImportVersionId,
        curriculumNodeId: node.curriculumNodeId,
        batchId: input.batchId,
        moduleTitlesJson: stringifyJson(item.resolvedConfig.bridgeModules),
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
      })
    }

    const existingTopicRows = (await context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, editableImport.curriculumImportVersionId)))
      .filter(row => row.curriculumNodeId === node.curriculumNodeId)
    if (existingTopicRows.length > 0) {
      await context.db.delete(courseTopicPartitions).where(inArray(courseTopicPartitions.courseTopicPartitionId, existingTopicRows.map(row => row.courseTopicPartitionId)))
    }
    await context.db.insert(courseTopicPartitions).values(([
      ['tt1', item.resolvedConfig.topicPartitions.tt1],
      ['tt2', item.resolvedConfig.topicPartitions.tt2],
      ['see', item.resolvedConfig.topicPartitions.see],
      ['workbook', item.resolvedConfig.topicPartitions.workbook],
    ] as const).map(([partitionKind, topics]) => ({
      courseTopicPartitionId: createId('course_topic_partition'),
      curriculumImportVersionId: editableImport.curriculumImportVersionId,
      curriculumNodeId: node.curriculumNodeId,
      partitionKind,
      topicsJson: stringifyJson(topics),
      createdAt: input.now,
      updatedAt: input.now,
    })))

    const batchOutcomeRows = (await context.db.select().from(courseOutcomeOverrides))
      .filter(row => row.courseId === course.courseId && row.scopeType === 'batch' && row.scopeId === input.batchId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const currentOutcomeOverride = batchOutcomeRows[0] ?? null
    if (currentOutcomeOverride) {
      await context.db.update(courseOutcomeOverrides).set({
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: input.batchId,
        outcomesJson: stringifyJson(item.resolvedConfig.outcomes),
        status: 'active',
        version: currentOutcomeOverride.version + 1,
        updatedAt: input.now,
      }).where(eq(courseOutcomeOverrides.courseOutcomeOverrideId, currentOutcomeOverride.courseOutcomeOverrideId))
    } else {
      await context.db.insert(courseOutcomeOverrides).values({
        courseOutcomeOverrideId: createId('course_outcome_override'),
        courseId: course.courseId,
        scopeType: 'batch',
        scopeId: input.batchId,
        outcomesJson: stringifyJson(item.resolvedConfig.outcomes),
        status: 'active',
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
  }

  await refreshCurriculumImportSummary(context, {
    batchId: input.batchId,
    curriculumImportVersionId: editableImport.curriculumImportVersionId,
    now: input.now,
  })

  return editableImport.curriculumImportVersionId
}

export async function rematerializeResolvedBatchCurriculum(context: RouteContext, input: {
  batchId: string
  actorFacultyId?: string | null
  now: string
}) {
  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const curriculumImportVersionId = resolved.items.length > 0
    ? await materializeResolvedCurriculumFeatureItems(context, {
        batchId: input.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: resolved.items.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
    : null
  return {
    resolved,
    curriculumImportVersionId,
  }
}
