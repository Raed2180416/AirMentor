/**
 * approveCurriculumLinkageCandidate — approve a pending prerequisite linkage
 * candidate, apply it (scope-profile or batch-local), materialise, and enqueue
 * a proof refresh. Preserves the R3 write->enqueue ordering.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import { eq, inArray } from 'drizzle-orm'
import {
  batchCurriculumFeatureOverrides,
  curriculumCourses,
  curriculumLinkageCandidates,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { badRequest, notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import {
  createEmptyProofRefresh,
  curriculumFeatureFingerprint,
  matchesCourseReference,
  normalizeCurriculumFeaturePayload,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'
import {
  validateCurriculumFeaturePayloadForCourse,
  validateResolvedCurriculumFeatureItems,
} from '../../../../application/use-cases/admin-structure/feature-validation.js'
import { ensureCourseRecordForCurriculumCourse } from './curriculum-import-core.js'
import { listBatchesInScope } from './scope-queries.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'
import { materializeResolvedCurriculumFeatureItems } from './materialize-resolved.js'
import { upsertCurriculumFeatureProfileCourseRecord } from './profile-course-writes.js'
import { enqueueProofRefreshForBatches } from './enqueue-proof-refresh.js'

export async function approveCurriculumLinkageCandidate(context: RouteContext, input: {
  batchId: string
  curriculumLinkageCandidateId: string
  actorFacultyId?: string | null
  reviewNote?: string | null
  now: string
}) {
  const [candidateRow] = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, input.curriculumLinkageCandidateId))
  if (!candidateRow || candidateRow.batchId !== input.batchId) throw notFound('Curriculum linkage candidate not found')
  if (candidateRow.status !== 'pending') throw badRequest('Only pending linkage candidates can be approved')

  const resolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  const targetItem = resolved.items.find(item => item.curriculumCourseId === candidateRow.curriculumCourseId)
  if (!targetItem) throw notFound('Resolved curriculum feature item not found')
  if (targetItem.prerequisites.some(item => item.sourceCourseCode.toLowerCase() === candidateRow.sourceCourseCode.toLowerCase() && item.edgeKind === candidateRow.edgeKind)) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'approved',
      reviewNote: input.reviewNote ?? 'Already present in resolved prerequisites.',
      version: candidateRow.version + 1,
      updatedAt: input.now,
    }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, candidateRow.curriculumLinkageCandidateId))
    return {
      curriculumImportVersionId: resolved.curriculumImportVersion?.curriculumImportVersionId ?? null,
      affectedBatchIds: [] as string[],
      proofRefresh: createEmptyProofRefresh(resolved.curriculumImportVersion?.curriculumImportVersionId ?? null),
    }
  }

  const nextPayload = normalizeCurriculumFeaturePayload({
    assessmentProfile: targetItem.resolvedConfig.assessmentProfile,
    outcomes: targetItem.resolvedConfig.outcomes,
    prerequisites: [
      ...targetItem.resolvedConfig.prerequisites,
      {
        sourceCourseCode: candidateRow.sourceCourseCode,
        edgeKind: candidateRow.edgeKind as 'explicit' | 'added',
        rationale: candidateRow.rationale,
      },
    ],
    bridgeModules: targetItem.resolvedConfig.bridgeModules,
    topicPartitions: targetItem.resolvedConfig.topicPartitions,
  })

  const currentProfileId = targetItem.resolvedSource.curriculumFeatureProfileId ?? null
  const targetScopeType = targetItem.resolvedSource.scopeType ?? 'batch'
  const targetScopeId = targetItem.resolvedSource.scopeId ?? input.batchId
  const [curriculumCourse] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, candidateRow.curriculumCourseId))
  if (!curriculumCourse) throw notFound('Curriculum course not found')
  const courseRecord = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
  const beforeResolved = await resolveBatchCurriculumFeatures(context, input.batchId)
  let curriculumImportVersionId: string | null = null
  let affectedBatchIds: string[] = []

  if (currentProfileId && targetItem.resolvedSource.mode !== 'batch-local-override') {
    const targetBatches = await listBatchesInScope(context, targetScopeType, targetScopeId)
    const beforeFingerprints = new Map<string, string>()
    for (const batch of targetBatches) {
      const resolvedBatch = await resolveBatchCurriculumFeatures(context, batch.batchId)
      beforeFingerprints.set(batch.batchId, resolvedBatch.curriculumFeatureProfileFingerprint)
    }
    for (const batch of targetBatches) {
      const batchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batch.batchId)))
        .filter(row => row.status !== 'deleted' && row.status !== 'archived')
      const targetCurriculumCourse = batchCurriculumRows.find(row => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, row)) ?? null
      if (!targetCurriculumCourse) continue
      validateCurriculumFeaturePayloadForCourse({
        batchId: batch.batchId,
        batchCurriculumRows,
        curriculumCourseId: targetCurriculumCourse.curriculumCourseId,
        payload: nextPayload,
      })
    }
    await upsertCurriculumFeatureProfileCourseRecord(context, {
      curriculumFeatureProfileId: currentProfileId,
      curriculumCourse,
      courseId: courseRecord.courseId,
      payload: nextPayload,
      now: input.now,
    })
    for (const batch of targetBatches) {
      const afterResolved = await resolveBatchCurriculumFeatures(context, batch.batchId)
      const matchingItems = afterResolved.items.filter(item => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, item))
      if (matchingItems.length === 0) continue
      validateResolvedCurriculumFeatureItems({
        batchId: batch.batchId,
        batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, batch.batchId)))
          .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
        items: matchingItems.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
      curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
        batchId: batch.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: matchingItems.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
      if ((beforeFingerprints.get(batch.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint) {
        affectedBatchIds.push(batch.batchId)
      }
    }
  } else {
    validateCurriculumFeaturePayloadForCourse({
      batchId: input.batchId,
      batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
        .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
      curriculumCourseId: curriculumCourse.curriculumCourseId,
      payload: nextPayload,
    })
    const existingOverride = (await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, input.batchId)))
      .find(row => row.curriculumCourseId === curriculumCourse.curriculumCourseId) ?? null
    const fingerprint = curriculumFeatureFingerprint(nextPayload)
    if (existingOverride) {
      await context.db.update(batchCurriculumFeatureOverrides).set({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(nextPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: existingOverride.version + 1,
        updatedAt: input.now,
      }).where(eq(batchCurriculumFeatureOverrides.batchCurriculumFeatureOverrideId, existingOverride.batchCurriculumFeatureOverrideId))
    } else {
      await context.db.insert(batchCurriculumFeatureOverrides).values({
        batchCurriculumFeatureOverrideId: createId('batch_curriculum_feature_override'),
        batchId: input.batchId,
        curriculumCourseId: curriculumCourse.curriculumCourseId,
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        overrideJson: stringifyJson(nextPayload),
        featureFingerprint: fingerprint,
        status: 'active',
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
    }
    const afterResolved = await resolveBatchCurriculumFeatures(context, input.batchId)
    const matchingItem = afterResolved.items.find(item => item.curriculumCourseId === curriculumCourse.curriculumCourseId)
    if (matchingItem) {
      validateResolvedCurriculumFeatureItems({
        batchId: input.batchId,
        batchCurriculumRows: (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, input.batchId)))
          .filter(row => row.status !== 'deleted' && row.status !== 'archived'),
        items: [{
          curriculumCourseId: curriculumCourse.curriculumCourseId,
          resolvedConfig: matchingItem.resolvedConfig,
        }],
      })
      curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
        batchId: input.batchId,
        actorFacultyId: input.actorFacultyId,
        now: input.now,
        items: [{
          curriculumCourseId: curriculumCourse.curriculumCourseId,
          resolvedConfig: matchingItem.resolvedConfig,
        }],
      })
      affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint
        ? [input.batchId]
        : []
    }
  }

  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: affectedBatchIds,
    actorFacultyId: input.actorFacultyId,
    now: input.now,
    curriculumImportVersionId,
  })

  await context.db.update(curriculumLinkageCandidates).set({
    status: 'approved',
    reviewNote: input.reviewNote ?? null,
    version: candidateRow.version + 1,
    updatedAt: input.now,
  }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, candidateRow.curriculumLinkageCandidateId))

  const sameTargetPending = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, input.batchId))
  const rowsToSupersede = sameTargetPending.filter(row => (
    row.status === 'pending'
    && row.curriculumCourseId === candidateRow.curriculumCourseId
    && row.sourceCourseCode.toLowerCase() === candidateRow.sourceCourseCode.toLowerCase()
  ))
  if (rowsToSupersede.length > 0) {
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'superseded',
      updatedAt: input.now,
    }).where(inArray(curriculumLinkageCandidates.curriculumLinkageCandidateId, rowsToSupersede.map(row => row.curriculumLinkageCandidateId)))
  }

  return {
    curriculumImportVersionId,
    affectedBatchIds,
    proofRefresh,
  }
}
