/**
 * PUT /api/admin/batches/:batchId/curriculum-feature-config/:curriculumCourseId
 * handler body — save sysadmin-owned feature inputs (scope-profile or
 * batch-local override), materialise, and enqueue a proof refresh.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts. Preserves the
 * R3 write->enqueue ordering.
 */
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  batchCurriculumFeatureBindings,
  batchCurriculumFeatureOverrides,
  curriculumCourses,
  curriculumFeatureProfileCourses,
  curriculumFeatureProfiles,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { badRequest, notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import { stringifyJson } from '../../../../lib/json.js'
import { emitAuditEvent, parseOrThrow, requireRole } from '../../../../modules/support.js'
import { curriculumFeatureConfigSaveSchema } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import {
  curriculumFeatureFingerprint,
  matchesCourseReference,
  normalizeCurriculumFeaturePayload,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { validateCurriculumFeaturePayloadForCourse } from '../../../../application/use-cases/admin-structure/feature-validation.js'
import { ensureCourseRecordForCurriculumCourse } from './curriculum-import-core.js'
import { assertScopeExists, listBatchesInScope } from './scope-queries.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'
import { materializeResolvedCurriculumFeatureItems } from './materialize-resolved.js'
import { regenerateCurriculumLinkageCandidatesForBatch } from './regenerate-linkage-candidates.js'
import { enqueueProofRefreshForBatches } from './enqueue-proof-refresh.js'
import { computeConfigImpactPreview } from './config-impact-preview.js'

export async function saveCurriculumFeatureConfig(context: RouteContext, request: FastifyRequest) {
  const auth = requireRole(request, ['SYSTEM_ADMIN'])
  const params = parseOrThrow(z.object({
    batchId: z.string().min(1),
    curriculumCourseId: z.string().min(1),
  }), request.params)
  const body = parseOrThrow(curriculumFeatureConfigSaveSchema, request.body)
  const [curriculumCourse] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
  if (!curriculumCourse || curriculumCourse.batchId !== params.batchId) throw notFound('Curriculum course not found')
  const normalizedPayload = normalizeCurriculumFeaturePayload(body)
  const beforeBatchFingerprints = new Map<string, string>()
  const now = context.now()
  const courseRecord = await ensureCourseRecordForCurriculumCourse(context, curriculumCourse)
  const activeBatchCurriculumRows = (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, params.batchId)))
    .filter(row => row.status !== 'deleted' && row.status !== 'archived')

  if (body.targetMode === 'scope-profile') {
    const targetScopeType = body.targetScopeType ?? 'branch'
    const targetScopeId = body.targetScopeId
      ?? (targetScopeType === 'batch' ? params.batchId : null)
    if (!targetScopeId) throw badRequest('Scope profile save requires a target scope id')
    await assertScopeExists(context, targetScopeType, targetScopeId)
    const affectedCandidateBatches = await listBatchesInScope(context, targetScopeType, targetScopeId)
    for (const candidate of affectedCandidateBatches) {
      const resolved = await resolveBatchCurriculumFeatures(context, candidate.batchId)
      beforeBatchFingerprints.set(candidate.batchId, resolved.curriculumFeatureProfileFingerprint)
    }
    for (const candidate of affectedCandidateBatches) {
      const candidateCurriculumRows = candidate.batchId === params.batchId
        ? activeBatchCurriculumRows
        : (await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.batchId, candidate.batchId)))
          .filter(row => row.status !== 'deleted' && row.status !== 'archived')
      const targetCurriculumCourse = candidateCurriculumRows.find(row => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, row)) ?? null
      if (!targetCurriculumCourse) continue
      validateCurriculumFeaturePayloadForCourse({
        batchId: candidate.batchId,
        batchCurriculumRows: candidateCurriculumRows,
        curriculumCourseId: targetCurriculumCourse.curriculumCourseId,
        payload: normalizedPayload,
      })
    }

    const profileRow = body.curriculumFeatureProfileId
      ? (await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, body.curriculumFeatureProfileId)))[0] ?? null
      : (await context.db.select().from(curriculumFeatureProfiles)).find(row => row.scopeType === targetScopeType && row.scopeId === targetScopeId && row.status === 'active') ?? null
    const ensuredProfile = profileRow ?? {
      curriculumFeatureProfileId: createId('curriculum_feature_profile'),
      name: `${targetScopeType.replace(/-/g, ' ')} feature profile`,
      scopeType: targetScopeType,
      scopeId: targetScopeId,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    if (!profileRow) {
      await context.db.insert(curriculumFeatureProfiles).values(ensuredProfile)
    }
    const existingProfileCourse = (await context.db.select().from(curriculumFeatureProfileCourses))
      .find(row => row.curriculumFeatureProfileId === ensuredProfile.curriculumFeatureProfileId && matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, {
        courseId: row.courseId,
        courseCode: row.courseCode,
        title: row.title,
      })) ?? null
    const fingerprint = curriculumFeatureFingerprint(normalizedPayload)
    if (existingProfileCourse) {
      await context.db.update(curriculumFeatureProfileCourses).set({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        assessmentProfile: normalizedPayload.assessmentProfile,
        outcomesJson: stringifyJson(normalizedPayload.outcomes),
        prerequisitesJson: stringifyJson(normalizedPayload.prerequisites),
        bridgeModulesJson: stringifyJson(normalizedPayload.bridgeModules),
        topicPartitionsJson: stringifyJson(normalizedPayload.topicPartitions),
        featureFingerprint: fingerprint,
        status: 'active',
        version: existingProfileCourse.version + 1,
        updatedAt: now,
      }).where(eq(curriculumFeatureProfileCourses.curriculumFeatureProfileCourseId, existingProfileCourse.curriculumFeatureProfileCourseId))
    } else {
      await context.db.insert(curriculumFeatureProfileCourses).values({
        curriculumFeatureProfileCourseId: createId('curriculum_feature_profile_course'),
        curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
        assessmentProfile: normalizedPayload.assessmentProfile,
        outcomesJson: stringifyJson(normalizedPayload.outcomes),
        prerequisitesJson: stringifyJson(normalizedPayload.prerequisites),
        bridgeModulesJson: stringifyJson(normalizedPayload.bridgeModules),
        topicPartitionsJson: stringifyJson(normalizedPayload.topicPartitions),
        featureFingerprint: fingerprint,
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const affectedBatchIds: string[] = []
    let lastImportVersionId: string | null = null
    for (const candidate of affectedCandidateBatches) {
      const binding = await context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, candidate.batchId)).then(rows => rows[0] ?? null)
      if (binding?.bindingMode === 'local-only' || binding?.status === 'archived') continue
      const localOverride = await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, candidate.batchId)).then(rows => rows.find(row => (
        row.curriculumCourseId === params.curriculumCourseId
        || row.courseId === courseRecord.courseId
        || row.courseCode.toLowerCase() === curriculumCourse.courseCode.toLowerCase()
      )) ?? null)
      if (localOverride?.status === 'active') continue
      const afterResolved = await resolveBatchCurriculumFeatures(context, candidate.batchId)
      const matchingItems = afterResolved.items.filter(item => matchesCourseReference({
        courseId: courseRecord.courseId,
        courseCode: curriculumCourse.courseCode,
        title: curriculumCourse.title,
      }, item))
      if (matchingItems.length === 0) continue
      lastImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
        batchId: candidate.batchId,
        actorFacultyId: auth.facultyId,
        now,
        items: matchingItems.map(item => ({
          curriculumCourseId: item.curriculumCourseId,
          resolvedConfig: item.resolvedConfig,
        })),
      })
      await regenerateCurriculumLinkageCandidatesForBatch(context, {
        batchId: candidate.batchId,
        targetCurriculumCourseIds: matchingItems.map(item => item.curriculumCourseId),
        now,
      })
      if ((beforeBatchFingerprints.get(candidate.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint) {
        affectedBatchIds.push(candidate.batchId)
      }
    }
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId: lastImportVersionId,
    })

    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureProfileCourse',
      entityId: `${ensuredProfile.curriculumFeatureProfileId}:${params.curriculumCourseId}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
        scopeType: ensuredProfile.scopeType,
        scopeId: ensuredProfile.scopeId,
        courseCode: curriculumCourse.courseCode,
        config: normalizedPayload,
        affectedBatchIds,
      },
    })

    return {
      ok: true,
      batchId: params.batchId,
      curriculumCourseId: params.curriculumCourseId,
      curriculumImportVersionId: lastImportVersionId,
      affectedBatchIds,
      proofRefresh,
      targetMode: body.targetMode,
      curriculumFeatureProfileId: ensuredProfile.curriculumFeatureProfileId,
    }
  }

  const beforeResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
  validateCurriculumFeaturePayloadForCourse({
    batchId: params.batchId,
    batchCurriculumRows: activeBatchCurriculumRows,
    curriculumCourseId: params.curriculumCourseId,
    payload: normalizedPayload,
  })
  const existingOverride = (await context.db.select().from(batchCurriculumFeatureOverrides).where(eq(batchCurriculumFeatureOverrides.batchId, params.batchId)))
    .find(row => row.curriculumCourseId === params.curriculumCourseId) ?? null
  const fingerprint = curriculumFeatureFingerprint(normalizedPayload)
  if (existingOverride) {
    await context.db.update(batchCurriculumFeatureOverrides).set({
      courseId: courseRecord.courseId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      overrideJson: stringifyJson(normalizedPayload),
      featureFingerprint: fingerprint,
      status: 'active',
      version: existingOverride.version + 1,
      updatedAt: now,
    }).where(eq(batchCurriculumFeatureOverrides.batchCurriculumFeatureOverrideId, existingOverride.batchCurriculumFeatureOverrideId))
  } else {
    await context.db.insert(batchCurriculumFeatureOverrides).values({
      batchCurriculumFeatureOverrideId: createId('batch_curriculum_feature_override'),
      batchId: params.batchId,
      curriculumCourseId: params.curriculumCourseId,
      courseId: courseRecord.courseId,
      courseCode: curriculumCourse.courseCode,
      title: curriculumCourse.title,
      overrideJson: stringifyJson(normalizedPayload),
      featureFingerprint: fingerprint,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  const afterResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
  const matchingItem = afterResolved.items.find(item => item.curriculumCourseId === params.curriculumCourseId)
  if (!matchingItem) throw notFound('Resolved curriculum feature item not found after save')
  const curriculumImportVersionId = await materializeResolvedCurriculumFeatureItems(context, {
    batchId: params.batchId,
    actorFacultyId: auth.facultyId,
    now,
    items: [{
      curriculumCourseId: params.curriculumCourseId,
      resolvedConfig: matchingItem.resolvedConfig,
    }],
  })
  await regenerateCurriculumLinkageCandidatesForBatch(context, {
    batchId: params.batchId,
    targetCurriculumCourseIds: [params.curriculumCourseId],
    now,
  })
  const affectedBatchIds = (beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint)
    ? [params.batchId]
    : []
  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: affectedBatchIds,
    actorFacultyId: auth.facultyId,
    now,
    curriculumImportVersionId,
  })

  const beforeItem = beforeResolved.items.find(item => item.curriculumCourseId === params.curriculumCourseId)
  const previewForAudit = normalizedPayload.outcomes.length > 0
    ? await computeConfigImpactPreview(context, {
        batchId: params.batchId,
        curriculumCourseId: params.curriculumCourseId,
        proposedOutcomes: normalizedPayload.outcomes.map(o => ({ id: o.id, bloom: o.bloom })),
      })
    : null
  await emitAuditEvent(context, {
    entityType: 'CurriculumFeatureConfig',
    entityId: `${params.batchId}:${params.curriculumCourseId}`,
    action: 'updated',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
    before: beforeItem ? {
      assessmentProfile: beforeItem.resolvedConfig.assessmentProfile,
      outcomes: beforeItem.resolvedConfig.outcomes,
      prerequisites: beforeItem.resolvedConfig.prerequisites,
      bridgeModules: beforeItem.resolvedConfig.bridgeModules,
      topicPartitions: beforeItem.resolvedConfig.topicPartitions,
    } : null,
    after: {
      curriculumCourseId: params.curriculumCourseId,
      curriculumImportVersionId,
      assessmentProfile: normalizedPayload.assessmentProfile,
      outcomes: normalizedPayload.outcomes,
      prerequisites: normalizedPayload.prerequisites,
      bridgeModules: normalizedPayload.bridgeModules,
      topicPartitions: normalizedPayload.topicPartitions,
    },
    metadata: previewForAudit ? {
      projectedDelta: previewForAudit.delta,
      studentCount: previewForAudit.studentCount,
      affectedStudentCount: previewForAudit.affectedStudents.length,
      affectedBatchIds,
    } : { affectedBatchIds },
  })

  return {
    ok: true,
    batchId: params.batchId,
    curriculumCourseId: params.curriculumCourseId,
    curriculumImportVersionId,
    affectedBatchIds,
    proofRefresh,
    targetMode: body.targetMode,
    curriculumFeatureProfileId: null,
  }
}
