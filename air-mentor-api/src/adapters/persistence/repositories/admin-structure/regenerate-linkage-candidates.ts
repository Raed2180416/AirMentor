/**
 * regenerateCurriculumLinkageCandidatesForBatch — supersede pending candidates
 * and regenerate prerequisite linkage candidates for a batch or one course.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { eq, inArray } from 'drizzle-orm'
import {
  curriculumCourses,
  curriculumLinkageCandidates,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import { buildCurriculumLinkageCandidates } from '../../../../lib/curriculum-linkage.js'
import { expandCurriculumLinkageNeighborhood } from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'
import { mapCurriculumLinkageCandidate } from './row-mappers.js'

export async function regenerateCurriculumLinkageCandidatesForBatch(context: RouteContext, input: {
  batchId: string
  targetCurriculumCourseIds?: string[] | null
  now: string
}) {
  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const expandedTargetIds = input.targetCurriculumCourseIds?.length
    ? expandCurriculumLinkageNeighborhood({
        items: resolved.items.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          courseCode: item.courseCode,
          prerequisites: item.prerequisites,
        })),
        targetCurriculumCourseIds: input.targetCurriculumCourseIds,
      })
    : null
  const targetSet = expandedTargetIds?.length ? new Set(expandedTargetIds) : null
  const nextCandidateResult = await buildCurriculumLinkageCandidates({
    manifestKey: 'msruas-mnc-seed',
    items: resolved.items.map(item => ({
      curriculumCourseId: item.curriculumCourseId,
      semesterNumber: item.semesterNumber,
      courseCode: item.courseCode,
      title: item.title,
      outcomes: item.outcomes,
      prerequisites: item.prerequisites,
      bridgeModules: item.bridgeModules,
      topicPartitions: item.topicPartitions,
    })),
    targetCurriculumCourseIds: expandedTargetIds ?? null,
  })
  const nextCandidates = nextCandidateResult.items

  const existingRows = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, input.batchId))
  const rowsToSupersede = existingRows.filter(row => (
    row.status === 'pending'
    && (!targetSet || targetSet.has(row.curriculumCourseId))
  ))
  if (rowsToSupersede.length > 0) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'superseded',
      updatedAt: input.now,
    }).where(inArray(curriculumLinkageCandidates.curriculumLinkageCandidateId, rowsToSupersede.map(row => row.curriculumLinkageCandidateId)))
  }

  const curriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')
  const curriculumRowById = new Map(curriculumRows.map(row => [row.curriculumCourseId, row]))
  const curriculumRowByCourseCode = new Map(curriculumRows.map(row => [row.courseCode.toLowerCase(), row]))

  const inserted: Array<ReturnType<typeof mapCurriculumLinkageCandidate>> = []
  for (const candidate of nextCandidates) {
    const targetCourse = curriculumRowById.get(candidate.curriculumCourseId)
    if (!targetCourse) continue
    const sourceCourse = curriculumRowByCourseCode.get(candidate.sourceCourseCode.toLowerCase()) ?? null
    const candidateId = createId('curriculum_linkage_candidate')
    const row = {
      curriculumLinkageCandidateId: candidateId,
      batchId: input.batchId,
      curriculumCourseId: candidate.curriculumCourseId,
      sourceCurriculumCourseId: sourceCourse?.curriculumCourseId ?? null,
      sourceCourseId: sourceCourse?.courseId ?? null,
      sourceCourseCode: candidate.sourceCourseCode,
      sourceTitle: candidate.sourceTitle,
      targetCourseCode: candidate.targetCourseCode,
      targetTitle: candidate.targetTitle,
      edgeKind: candidate.edgeKind,
      rationale: candidate.rationale,
      confidenceScaled: candidate.confidenceScaled,
      sourcesJson: stringifyJson(candidate.sources),
      signalSummaryJson: stringifyJson(candidate.signalSummary),
      status: 'pending',
      reviewNote: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    }
    await context.db.insert(curriculumLinkageCandidates).values(row)
    inserted.push(mapCurriculumLinkageCandidate(row))
  }

  return {
    items: inserted,
    candidateGenerationStatus: nextCandidateResult.candidateGenerationStatus,
  }
}
