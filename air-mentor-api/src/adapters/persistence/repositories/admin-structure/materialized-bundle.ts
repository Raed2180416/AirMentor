/**
 * Materialised curriculum-feature bundle loader + payload adapters.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  batches,
  bridgeModules,
  courseOutcomeOverrides,
  courseTopicPartitions,
  curriculumCourses,
  curriculumEdges,
  curriculumNodes,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { parseJson } from '../../../../lib/json.js'
import {
  curriculumFeatureOutcomeSchema,
  type CurriculumFeatureProfileCoursePayload,
} from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import {
  buildDefaultCourseOutcomes,
  normalizeCurriculumFeaturePayload,
  normalizeFeatureStringList,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { findCurriculumNodeForCourse, getLatestCurriculumImport } from './curriculum-import-core.js'
import { mapCourseOutcomeOverride } from './row-mappers.js'

export type MaterializedCurriculumFeatureItem = {
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  curriculumNodeId: string | null
  courseId: string | null
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
  assessmentProfile: string
  outcomes: z.infer<typeof curriculumFeatureOutcomeSchema>[]
  outcomeOverride: ReturnType<typeof mapCourseOutcomeOverride> | null
  prerequisites: Array<{
    curriculumEdgeId: string
    sourceCurriculumNodeId: string
    sourceCourseCode: string
    sourceTitle: string
    edgeKind: string
    rationale: string
    status: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
}

export async function loadMaterializedCurriculumFeatureBundle(context: RouteContext, batchId: string) {
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')

  const latestImport = await getLatestCurriculumImport(context, batchId)
  const [curriculumRows, nodeRows, edgeRows, bridgeRows, topicRows, outcomeRows] = await Promise.all([
    context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batchId)),
    latestImport ? context.db.select().from(curriculumNodes).where(eq(curriculumNodes.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(curriculumEdges).where(eq(curriculumEdges.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(bridgeModules).where(eq(bridgeModules.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    latestImport ? context.db.select().from(courseTopicPartitions).where(eq(courseTopicPartitions.curriculumImportVersionId, latestImport.curriculumImportVersionId)) : Promise.resolve([]),
    context.db.select().from(courseOutcomeOverrides),
  ])

  const visibleCurriculumRows = curriculumRows
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.courseCode.localeCompare(right.courseCode))
  const nodeById = new Map(nodeRows.map(row => [row.curriculumNodeId, row]))
  const nodeKeySet = new Set(visibleCurriculumRows.map(row => `${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
  const nodeOnlyRows = nodeRows
    .filter(row => row.status === 'active')
    .filter(row => !nodeKeySet.has(`${row.semesterNumber}::${row.courseCode.toLowerCase()}`))
    .map(row => ({
      curriculumCourseId: `import:${row.curriculumNodeId}`,
      batchId,
      semesterNumber: row.semesterNumber,
      courseId: row.courseId,
      courseCode: row.courseCode,
      title: row.title,
      credits: row.credits,
      status: 'active',
      version: 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

  const items = [...visibleCurriculumRows, ...nodeOnlyRows].map(curriculumCourse => {
    const node = findCurriculumNodeForCourse(nodeRows, curriculumCourse)
    const activeOutcomeOverride = curriculumCourse.courseId
      ? outcomeRows
        .filter(row => row.courseId === curriculumCourse.courseId && row.scopeType === 'batch' && row.scopeId === batchId && row.status === 'active')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      : null
    const prerequisiteRows = node
      ? edgeRows
        .filter(row => row.targetCurriculumNodeId === node.curriculumNodeId && row.status === 'active')
        .map(row => {
          const sourceNode = nodeById.get(row.sourceCurriculumNodeId) ?? null
          return {
            curriculumEdgeId: row.curriculumEdgeId,
            sourceCurriculumNodeId: row.sourceCurriculumNodeId,
            sourceCourseCode: sourceNode?.courseCode ?? row.sourceCurriculumNodeId,
            sourceTitle: sourceNode?.title ?? row.sourceCurriculumNodeId,
            edgeKind: row.edgeKind,
            rationale: row.rationale,
            status: row.status,
          }
        })
      : []
    const bridgeRow = node
      ? bridgeRows
        .filter(row => row.curriculumNodeId === node.curriculumNodeId && row.status === 'active')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
      : null
    const topicByKind = new Map(
      (node ? topicRows.filter(row => row.curriculumNodeId === node.curriculumNodeId) : []).map(row => [
        row.partitionKind,
        normalizeFeatureStringList(parseJson(row.topicsJson, [] as string[])),
      ]),
    )
    return {
      curriculumCourseId: curriculumCourse.curriculumCourseId,
      curriculumImportVersionId: latestImport?.curriculumImportVersionId ?? null,
      curriculumNodeId: node?.curriculumNodeId ?? null,
      courseId: curriculumCourse.courseId ?? node?.courseId ?? null,
      semesterNumber: curriculumCourse.semesterNumber,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      credits: curriculumCourse.credits,
      assessmentProfile: node?.assessmentProfile ?? 'admin-authored',
      outcomes: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride).outcomes : buildDefaultCourseOutcomes(curriculumCourse.courseCode, curriculumCourse.title),
      outcomeOverride: activeOutcomeOverride ? mapCourseOutcomeOverride(activeOutcomeOverride) : null,
      prerequisites: prerequisiteRows,
      bridgeModules: bridgeRow ? normalizeFeatureStringList(parseJson(bridgeRow.moduleTitlesJson, [] as string[])) : [],
      topicPartitions: {
        tt1: topicByKind.get('tt1') ?? [],
        tt2: topicByKind.get('tt2') ?? [],
        see: topicByKind.get('see') ?? [],
        workbook: topicByKind.get('workbook') ?? [],
      },
    } satisfies MaterializedCurriculumFeatureItem
  })

  return {
    batchId,
    curriculumImportVersion: latestImport
      ? {
          curriculumImportVersionId: latestImport.curriculumImportVersionId,
          sourceLabel: latestImport.sourceLabel,
          sourceType: latestImport.sourceType,
          status: latestImport.status,
          validationStatus: latestImport.validationStatus,
          updatedAt: latestImport.updatedAt,
        }
      : null,
    items,
  }
}

export function toCurriculumFeaturePayload(item: Pick<MaterializedCurriculumFeatureItem, 'assessmentProfile' | 'outcomes' | 'prerequisites' | 'bridgeModules' | 'topicPartitions'>): CurriculumFeatureProfileCoursePayload {
  return normalizeCurriculumFeaturePayload({
    assessmentProfile: item.assessmentProfile,
    outcomes: item.outcomes,
    prerequisites: item.prerequisites.map(prerequisite => ({
      sourceCourseCode: prerequisite.sourceCourseCode,
      edgeKind: prerequisite.edgeKind as 'explicit' | 'added',
      rationale: prerequisite.rationale,
    })),
    bridgeModules: item.bridgeModules,
    topicPartitions: item.topicPartitions,
  })
}

export function fromResolvedCurriculumFeaturePayload(
  payload: CurriculumFeatureProfileCoursePayload,
  item: Pick<MaterializedCurriculumFeatureItem, 'courseCode' | 'title'>,
  batchItems: MaterializedCurriculumFeatureItem[],
) {
  return {
    assessmentProfile: payload.assessmentProfile,
    outcomes: payload.outcomes,
    prerequisites: payload.prerequisites.map(prerequisite => {
      const source = batchItems.find(candidate => candidate.courseCode.toLowerCase() === prerequisite.sourceCourseCode.toLowerCase())
      return {
        curriculumEdgeId: source?.curriculumNodeId ?? `${item.courseCode}:${prerequisite.sourceCourseCode}`,
        sourceCurriculumNodeId: source?.curriculumNodeId ?? prerequisite.sourceCourseCode,
        sourceCourseCode: prerequisite.sourceCourseCode,
        sourceTitle: source?.title ?? prerequisite.sourceCourseCode,
        edgeKind: prerequisite.edgeKind,
        rationale: prerequisite.rationale,
        status: 'active',
      }
    }),
    bridgeModules: payload.bridgeModules,
    topicPartitions: payload.topicPartitions,
  }
}
