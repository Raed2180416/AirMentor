/**
 * Admin-structure routes — thin controller.
 *
 * Registrar for the System-Admin hierarchy + curriculum-feature governance
 * surface (academic faculties, batches, curriculum courses, curriculum-feature
 * config/profiles/bindings, curriculum bootstrap + linkage candidates, stage /
 * academic policy overrides, and resolved-policy reads).
 *
 * Pure domain (schemas, DEFAULT_POLICY, feature normalisation/validation) lives
 * under src/application/use-cases/admin-structure; all Drizzle access lives under
 * src/adapters/persistence/repositories/admin-structure. The heavy resolution /
 * materialisation functions are re-exported below because curriculum-graph,
 * academic, students, people, and the proof control-plane import them.
 */
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  batches,
  batchCurriculumFeatureBindings,
  branches,
  curriculumFeatureProfiles,
  curriculumLinkageCandidates,
  curriculumCourses,
  institutions,
  policyOverrides,
  stagePolicyOverrides,
} from '../db/schema.js'
import { badRequest, conflict, notFound } from '../lib/http-errors.js'
import { createId } from '../lib/ids.js'
import { stringifyJson } from '../lib/json.js'
import { emitOperationalEvent, normalizeTelemetryError } from '../lib/telemetry.js'
import { emitAuditEvent, expectVersion, getAuditEventsForEntity, parseOrThrow, requireRole } from './support.js'
import {
  academicFacultyCreateSchema,
  academicFacultyPatchSchema,
  batchCreateSchema,
  batchPatchSchema,
  curriculumBootstrapSchema,
  curriculumFeatureBindingSaveSchema,
  curriculumFeatureProfileCreateSchema,
  curriculumFeatureProfileFilterSchema,
  curriculumFeatureProfilePatchSchema,
  curriculumLinkageCandidateRegenerateSchema,
  curriculumLinkageCandidateReviewSchema,
  policyFilterSchema,
  policyOverrideCreateSchema,
  policyOverridePatchSchema,
  resolvedPolicyQuerySchema,
  scopeTypeSchema,
  stagePolicyFilterSchema,
  stagePolicyOverrideCreateSchema,
  stagePolicyOverridePatchSchema,
  type PolicyPayload,
  type ResolvedPolicy,
} from '../application/use-cases/admin-structure/admin-structure-schemas.js'
import { DEFAULT_POLICY } from '../application/use-cases/admin-structure/resolved-policy.js'
import {
  mapAcademicFaculty,
  mapBatch,
  mapBatchCurriculumFeatureBinding,
  mapCurriculumCourse,
  mapCurriculumFeatureProfile,
  mapCurriculumLinkageCandidate,
  mapPolicyOverride,
  mapStagePolicyOverride,
} from '../adapters/persistence/repositories/admin-structure/row-mappers.js'
import { assertScopeExists } from '../adapters/persistence/repositories/admin-structure/scope-queries.js'
import {
  resolveBatchPolicy,
  resolveBatchStagePolicy,
} from '../adapters/persistence/repositories/admin-structure/resolve-batch-policy.js'
import { resolveBatchCurriculumFeatures } from '../adapters/persistence/repositories/admin-structure/resolve-batch-features.js'
import { enqueueProofRefreshForBatches } from '../adapters/persistence/repositories/admin-structure/enqueue-proof-refresh.js'
import { materializeResolvedCurriculumFeatureItems } from '../adapters/persistence/repositories/admin-structure/materialize-resolved.js'
import { computeConfigImpactPreview } from '../adapters/persistence/repositories/admin-structure/config-impact-preview.js'
import { bootstrapCurriculumManifestForBatch } from '../adapters/persistence/repositories/admin-structure/bootstrap-manifest.js'
import { regenerateCurriculumLinkageCandidatesForBatch } from '../adapters/persistence/repositories/admin-structure/regenerate-linkage-candidates.js'
import { approveCurriculumLinkageCandidate } from '../adapters/persistence/repositories/admin-structure/approve-linkage-candidate.js'
import { cascadeDeleteAcademicFacultyChildren } from '../adapters/persistence/repositories/admin-structure/academic-faculty-cascade.js'
import { createAcademicFacultyCascadeSummary } from '../adapters/persistence/repositories/admin-structure/academic-faculty-cascade-summary.js'
import { computeSetupReadiness } from '../adapters/persistence/repositories/admin-structure/setup-readiness.js'
import {
  createCurriculumCourse,
  updateCurriculumCourse,
} from '../adapters/persistence/repositories/admin-structure/curriculum-course-writes.js'
import { saveCurriculumFeatureConfig } from '../adapters/persistence/repositories/admin-structure/save-feature-config.js'

export {
  resolveBatchPolicy,
  resolveBatchStagePolicy,
  resolveBatchCurriculumFeatures,
  enqueueProofRefreshForBatches,
  scopeTypeSchema,
  DEFAULT_POLICY,
}
export type { PolicyPayload, ResolvedPolicy }

export async function registerAdminStructureRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'List academic faculties' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(academicFaculties)
    return { items: rows.map(mapAcademicFaculty) }
  })

  app.post('/api/admin/academic-faculties', {
    schema: { tags: ['admin-structure'], summary: 'Create academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(academicFacultyCreateSchema, request.body)
    const [institution] = await context.db.select().from(institutions)
    if (!institution) throw notFound('Institution is not configured')
    const created = {
      academicFacultyId: createId('academic_faculty'),
      institutionId: institution.institutionId,
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(academicFaculties).values(created)
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: created.academicFacultyId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAcademicFaculty(created),
    })
    return mapAcademicFaculty(created)
  })

  app.patch('/api/admin/academic-faculties/:academicFacultyId', {
    schema: { tags: ['admin-structure'], summary: 'Update academic faculty' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ academicFacultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(academicFacultyPatchSchema, request.body)
    const [current] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    if (!current) throw notFound('Academic faculty not found')
    expectVersion(current.version, body.version, 'AcademicFaculty', mapAcademicFaculty(current))
    const now = context.now()
    const cascadeSummary = createAcademicFacultyCascadeSummary()

    if (body.status === 'deleted' && current.status !== 'deleted') {
      await cascadeDeleteAcademicFacultyChildren(context, { auth, params, now, cascadeSummary })
    }

    await context.db.update(academicFaculties).set({
      code: body.code,
      name: body.name,
      overview: body.overview ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    const [next] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, params.academicFacultyId))
    await emitAuditEvent(context, {
      entityType: 'AcademicFaculty',
      entityId: params.academicFacultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapAcademicFaculty(current),
      after: mapAcademicFaculty(next),
      metadata: body.status === 'deleted' && current.status !== 'deleted'
        ? {
            reason: 'academic_faculty_deleted',
            cascade: cascadeSummary,
          }
        : undefined,
    })
    return mapAcademicFaculty(next)
  })

  app.get('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'List batches' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(batches)
    return { items: rows.map(mapBatch) }
  })

  app.post('/api/admin/batches', {
    schema: { tags: ['admin-structure'], summary: 'Create batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(batchCreateSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const created = {
      batchId: createId('batch'),
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(batches).values(created)
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: created.batchId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapBatch(created),
    })
    return mapBatch(created)
  })

  app.patch('/api/admin/batches/:batchId', {
    schema: { tags: ['admin-structure'], summary: 'Update batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(batchPatchSchema, request.body)
    const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, body.branchId))
    if (!branch) throw notFound('Branch not found')
    const [current] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!current) throw notFound('Batch not found')
    expectVersion(current.version, body.version, 'Batch', mapBatch(current))
    await context.db.update(batches).set({
      branchId: body.branchId,
      admissionYear: body.admissionYear,
      batchLabel: body.batchLabel,
      currentSemester: body.currentSemester,
      sectionLabelsJson: stringifyJson(body.sectionLabels),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(batches.batchId, params.batchId))
    const [next] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    await emitAuditEvent(context, {
      entityType: 'Batch',
      entityId: params.batchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapBatch(current),
      after: mapBatch(next),
    })
    return mapBatch(next)
  })

  app.get('/api/admin/batches/:batchId/setup-readiness', {
    schema: { tags: ['admin-structure'], summary: 'Compute setup readiness blockers for a batch' },
  }, async request => computeSetupReadiness(context, request))

  app.get('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'List curriculum courses' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(z.object({ batchId: z.string().min(1).optional() }), request.query)
    const rows = await context.db.select().from(curriculumCourses)
    return {
      items: rows
        .filter(item => !query.batchId || item.batchId === query.batchId)
        .map(mapCurriculumCourse),
    }
  })

  app.post('/api/admin/curriculum-courses', {
    schema: { tags: ['admin-structure'], summary: 'Create curriculum course' },
  }, async request => createCurriculumCourse(context, request))

  app.patch('/api/admin/curriculum-courses/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Update curriculum course' },
  }, async request => updateCurriculumCourse(context, request))

  app.get('/api/admin/batches/:batchId/curriculum-feature-config', {
    schema: { tags: ['admin-structure'], summary: 'List sysadmin-owned model feature inputs for a batch curriculum' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    return resolveBatchCurriculumFeatures(context, params.batchId)
  })

  app.post('/api/admin/batches/:batchId/curriculum-feature-config/preview', {
    schema: { tags: ['admin-structure'], summary: 'Preview impact of a proposed feature config change on current risk distribution' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(z.object({
      curriculumCourseId: z.string().min(1),
      proposedOutcomes: z.array(z.object({ id: z.string().min(1), bloom: z.string().min(1) })).min(1),
    }), request.body)
    const result = await computeConfigImpactPreview(context, {
      batchId: params.batchId,
      curriculumCourseId: body.curriculumCourseId,
      proposedOutcomes: body.proposedOutcomes,
    })
    if (!result) throw notFound('No active proof run or curriculum node found for this batch/course')
    return result
  })

  app.post('/api/admin/batches/:batchId/curriculum/bootstrap', {
    schema: { tags: ['admin-structure'], summary: 'Bootstrap a supported curriculum manifest into the selected batch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumBootstrapSchema, request.body ?? {})
    const now = context.now()
    const result = await bootstrapCurriculumManifestForBatch(context, {
      batchId: params.batchId,
      manifestKey: body.manifestKey,
      actorFacultyId: auth.facultyId,
      now,
    })
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: [params.batchId],
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId: result.curriculumImportVersionId,
    })
    await emitAuditEvent(context, {
      entityType: 'CurriculumBootstrap',
      entityId: `${params.batchId}:${body.manifestKey}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        manifestKey: body.manifestKey,
        ...result,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      manifestKey: body.manifestKey,
      affectedBatchIds: [params.batchId],
      proofRefresh,
      ...result,
    }
  })

  app.get('/api/admin/batches/:batchId/curriculum/linkage-candidates', {
    schema: { tags: ['admin-structure'], summary: 'List persisted curriculum linkage candidates for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const query = parseOrThrow(z.object({ curriculumCourseId: z.string().min(1).optional() }), request.query)
    const rows = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.batchId, params.batchId))
    return {
      items: rows
        .filter(row => row.status !== 'superseded')
        .filter(row => !query.curriculumCourseId || row.curriculumCourseId === query.curriculumCourseId)
        .map(mapCurriculumLinkageCandidate)
        .sort((left, right) => right.confidenceScaled - left.confidenceScaled || left.targetCourseCode.localeCompare(right.targetCourseCode)),
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/regenerate', {
    schema: { tags: ['admin-structure'], summary: 'Regenerate curriculum linkage candidates for a batch or one course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateRegenerateSchema, request.body ?? {})
    let result
    try {
      result = await regenerateCurriculumLinkageCandidatesForBatch(context, {
        batchId: params.batchId,
        targetCurriculumCourseIds: body.curriculumCourseId ? [body.curriculumCourseId] : null,
        now: context.now(),
      })
    } catch (error) {
      emitOperationalEvent('curriculum.linkage.regeneration_failed', {
        batchId: params.batchId,
        curriculumCourseId: body.curriculumCourseId ?? null,
        error: normalizeTelemetryError(error),
      }, { level: 'error' })
      throw error
    }
    emitOperationalEvent('curriculum.linkage.regenerated', {
      batchId: params.batchId,
      curriculumCourseId: body.curriculumCourseId ?? null,
      generatedCount: result.items.length,
      candidateGenerationStatus: result.candidateGenerationStatus,
    })
    await emitAuditEvent(context, {
      entityType: 'CurriculumLinkageCandidate',
      entityId: `${params.batchId}:${body.curriculumCourseId ?? 'all'}`,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        curriculumCourseId: body.curriculumCourseId ?? null,
        generatedCount: result.items.length,
        candidateGenerationStatus: result.candidateGenerationStatus,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumCourseId: body.curriculumCourseId ?? null,
      items: result.items,
      candidateGenerationStatus: result.candidateGenerationStatus,
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/:curriculumLinkageCandidateId/approve', {
    schema: { tags: ['admin-structure'], summary: 'Approve a curriculum linkage candidate' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumLinkageCandidateId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateReviewSchema, request.body ?? {})
    let result
    try {
      result = await approveCurriculumLinkageCandidate(context, {
        batchId: params.batchId,
        curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
        actorFacultyId: auth.facultyId,
        reviewNote: body.reviewNote ?? null,
        now: context.now(),
      })
    } catch (error) {
      emitOperationalEvent('curriculum.linkage.approval_failed', {
        batchId: params.batchId,
        curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
        error: normalizeTelemetryError(error),
      }, { level: 'error' })
      throw error
    }
    emitOperationalEvent('curriculum.linkage.approved', {
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
      affectedBatchIds: result.affectedBatchIds,
      curriculumImportVersionId: result.curriculumImportVersionId,
      proofRefreshQueued: result.proofRefresh.status !== 'degraded',
      proofRefreshWarning: result.proofRefresh.warning,
      proofRefresh: result.proofRefresh,
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
      approvalSucceeded: true,
      proofRefreshQueued: result.proofRefresh.status !== 'degraded',
      proofRefreshWarning: result.proofRefresh.warning,
      ...result,
    }
  })

  app.post('/api/admin/batches/:batchId/curriculum/linkage-candidates/:curriculumLinkageCandidateId/reject', {
    schema: { tags: ['admin-structure'], summary: 'Reject a curriculum linkage candidate' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({
      batchId: z.string().min(1),
      curriculumLinkageCandidateId: z.string().min(1),
    }), request.params)
    const body = parseOrThrow(curriculumLinkageCandidateReviewSchema, request.body ?? {})
    const [current] = await context.db.select().from(curriculumLinkageCandidates).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, params.curriculumLinkageCandidateId))
    if (!current || current.batchId !== params.batchId) throw notFound('Curriculum linkage candidate not found')
    const now = context.now()
    await context.db.update(curriculumLinkageCandidates).set({
      status: 'rejected',
      reviewNote: body.reviewNote ?? null,
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(curriculumLinkageCandidates.curriculumLinkageCandidateId, params.curriculumLinkageCandidateId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumLinkageCandidate',
      entityId: params.curriculumLinkageCandidateId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumLinkageCandidate(current),
      after: mapCurriculumLinkageCandidate({
        ...current,
        status: 'rejected',
        reviewNote: body.reviewNote ?? null,
        version: current.version + 1,
        updatedAt: now,
      }),
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumLinkageCandidateId: params.curriculumLinkageCandidateId,
    }
  })

  app.put('/api/admin/batches/:batchId/curriculum-feature-config/:curriculumCourseId', {
    schema: { tags: ['admin-structure'], summary: 'Save sysadmin-owned model feature inputs for one curriculum course' },
  }, async request => saveCurriculumFeatureConfig(context, request))

  app.get('/api/admin/batches/:batchId/curriculum-feature-config/:curriculumCourseId/history', {
    schema: { tags: ['admin-structure'], summary: 'Configuration change history for one curriculum course' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1), curriculumCourseId: z.string().min(1) }), request.params)
    const events = await getAuditEventsForEntity(context, 'CurriculumFeatureConfig', `${params.batchId}:${params.curriculumCourseId}`)
    return { events }
  })

  app.get('/api/admin/curriculum-feature-profiles', {
    schema: { tags: ['admin-structure'], summary: 'List curriculum feature profiles' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(curriculumFeatureProfileFilterSchema, request.query)
    const rows = await context.db.select().from(curriculumFeatureProfiles)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapCurriculumFeatureProfile),
    }
  })

  app.post('/api/admin/curriculum-feature-profiles', {
    schema: { tags: ['admin-structure'], summary: 'Create a curriculum feature profile' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(curriculumFeatureProfileCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(curriculumFeatureProfiles)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')) {
      throw conflict('An active curriculum feature profile already exists for this scope')
    }
    const created = {
      curriculumFeatureProfileId: createId('curriculum_feature_profile'),
      name: body.name,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(curriculumFeatureProfiles).values(created)
    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureProfile',
      entityId: created.curriculumFeatureProfileId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapCurriculumFeatureProfile(created),
    })
    return mapCurriculumFeatureProfile(created)
  })

  app.patch('/api/admin/curriculum-feature-profiles/:curriculumFeatureProfileId', {
    schema: { tags: ['admin-structure'], summary: 'Update a curriculum feature profile' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ curriculumFeatureProfileId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumFeatureProfilePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    if (!current) throw notFound('Curriculum feature profile not found')
    expectVersion(current.version, body.version, 'CurriculumFeatureProfile', mapCurriculumFeatureProfile(current))
    const rows = await context.db.select().from(curriculumFeatureProfiles)
    const duplicate = rows.find(item => item.curriculumFeatureProfileId !== params.curriculumFeatureProfileId && item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')
    if (duplicate) throw conflict('An active curriculum feature profile already exists for this scope')
    await context.db.update(curriculumFeatureProfiles).set({
      name: body.name,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    const [next] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, params.curriculumFeatureProfileId))
    await emitAuditEvent(context, {
      entityType: 'CurriculumFeatureProfile',
      entityId: params.curriculumFeatureProfileId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapCurriculumFeatureProfile(current),
      after: mapCurriculumFeatureProfile(next),
    })
    return mapCurriculumFeatureProfile(next)
  })

  app.put('/api/admin/batches/:batchId/curriculum-feature-binding', {
    schema: { tags: ['admin-structure'], summary: 'Save a batch curriculum feature binding' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(curriculumFeatureBindingSaveSchema, request.body)
    const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, params.batchId))
    if (!batch) throw notFound('Batch not found')
    if (body.bindingMode === 'pin-profile' && !body.curriculumFeatureProfileId) {
      throw badRequest('Pinned profile binding requires a curriculum feature profile id')
    }
    if (body.curriculumFeatureProfileId) {
      const [profile] = await context.db.select().from(curriculumFeatureProfiles).where(eq(curriculumFeatureProfiles.curriculumFeatureProfileId, body.curriculumFeatureProfileId))
      if (!profile || profile.status !== 'active') throw notFound('Pinned curriculum feature profile not found')
    }
    const beforeResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    const [current] = await context.db.select().from(batchCurriculumFeatureBindings).where(eq(batchCurriculumFeatureBindings.batchId, params.batchId))
    const now = context.now()
    if (current) {
      if (body.version != null) expectVersion(current.version, body.version, 'BatchCurriculumFeatureBinding', mapBatchCurriculumFeatureBinding(current))
      await context.db.update(batchCurriculumFeatureBindings).set({
        curriculumFeatureProfileId: body.bindingMode === 'pin-profile' ? (body.curriculumFeatureProfileId ?? null) : null,
        bindingMode: body.bindingMode,
        status: body.status,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(batchCurriculumFeatureBindings.batchId, params.batchId))
    } else {
      await context.db.insert(batchCurriculumFeatureBindings).values({
        batchId: params.batchId,
        curriculumFeatureProfileId: body.bindingMode === 'pin-profile' ? (body.curriculumFeatureProfileId ?? null) : null,
        bindingMode: body.bindingMode,
        status: body.status,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }
    const afterResolved = await resolveBatchCurriculumFeatures(context, params.batchId)
    const curriculumImportVersionId = afterResolved.items.length > 0
      ? await materializeResolvedCurriculumFeatureItems(context, {
          batchId: params.batchId,
          actorFacultyId: auth.facultyId,
          now,
          items: afterResolved.items.map(item => ({
            curriculumCourseId: item.curriculumCourseId,
            resolvedConfig: item.resolvedConfig,
          })),
        })
      : null
    const affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint ? [params.batchId] : []
    const proofRefresh = await enqueueProofRefreshForBatches(context, {
      batchIds: affectedBatchIds,
      actorFacultyId: auth.facultyId,
      now,
      curriculumImportVersionId,
    })
    await emitAuditEvent(context, {
      entityType: 'BatchCurriculumFeatureBinding',
      entityId: params.batchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        batchId: params.batchId,
        bindingMode: body.bindingMode,
        curriculumFeatureProfileId: body.curriculumFeatureProfileId ?? null,
      },
    })
    return {
      ok: true,
      batchId: params.batchId,
      curriculumImportVersionId,
      affectedBatchIds,
      proofRefresh,
      binding: afterResolved.binding,
    }
  })

  app.get('/api/admin/stage-policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'List stage policy overrides' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(stagePolicyFilterSchema, request.query)
    const rows = await context.db.select().from(stagePolicyOverrides)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapStagePolicyOverride),
    }
  })

  app.post('/api/admin/stage-policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'Create stage policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(stagePolicyOverrideCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(stagePolicyOverrides)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')) {
      throw conflict('A stage policy override already exists for this scope')
    }
    const created = {
      stagePolicyOverrideId: createId('stage_policy_override'),
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(stagePolicyOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'StagePolicyOverride',
      entityId: created.stagePolicyOverrideId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapStagePolicyOverride(created),
    })
    return mapStagePolicyOverride(created)
  })

  app.patch('/api/admin/stage-policy-overrides/:stagePolicyOverrideId', {
    schema: { tags: ['admin-structure'], summary: 'Update a stage policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ stagePolicyOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(stagePolicyOverridePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(stagePolicyOverrides).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    if (!current) throw notFound('Stage policy override not found')
    expectVersion(current.version, body.version, 'StagePolicyOverride', mapStagePolicyOverride(current))
    const rows = await context.db.select().from(stagePolicyOverrides)
    const duplicate = rows.find(item => item.stagePolicyOverrideId !== params.stagePolicyOverrideId && item.scopeType === body.scopeType && item.scopeId === body.scopeId && item.status === 'active')
    if (duplicate) throw conflict('A stage policy override already exists for this scope')
    await context.db.update(stagePolicyOverrides).set({
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    const [next] = await context.db.select().from(stagePolicyOverrides).where(eq(stagePolicyOverrides.stagePolicyOverrideId, params.stagePolicyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'StagePolicyOverride',
      entityId: params.stagePolicyOverrideId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapStagePolicyOverride(current),
      after: mapStagePolicyOverride(next),
    })
    return mapStagePolicyOverride(next)
  })

  app.get('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'List policy overrides' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(policyFilterSchema, request.query)
    const rows = await context.db.select().from(policyOverrides)
    return {
      items: rows
        .filter(item => (!query.scopeType || item.scopeType === query.scopeType) && (!query.scopeId || item.scopeId === query.scopeId))
        .map(mapPolicyOverride),
    }
  })

  app.post('/api/admin/policy-overrides', {
    schema: { tags: ['admin-structure'], summary: 'Create policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(policyOverrideCreateSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const existing = await context.db.select().from(policyOverrides)
    if (existing.some(item => item.scopeType === body.scopeType && item.scopeId === body.scopeId)) {
      throw conflict('A policy override already exists for this scope')
    }
    const created = {
      policyOverrideId: createId('policy'),
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(policyOverrides).values(created)
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: created.policyOverrideId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapPolicyOverride(created),
    })
    return mapPolicyOverride(created)
  })

  app.patch('/api/admin/policy-overrides/:policyOverrideId', {
    schema: { tags: ['admin-structure'], summary: 'Update policy override' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ policyOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(policyOverridePatchSchema, request.body)
    await assertScopeExists(context, body.scopeType, body.scopeId)
    const [current] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    if (!current) throw notFound('Policy override not found')
    expectVersion(current.version, body.version, 'PolicyOverride', mapPolicyOverride(current))
    const rows = await context.db.select().from(policyOverrides)
    const duplicate = rows.find(item => item.policyOverrideId !== params.policyOverrideId && item.scopeType === body.scopeType && item.scopeId === body.scopeId)
    if (duplicate) throw conflict('A policy override already exists for this scope')
    await context.db.update(policyOverrides).set({
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      policyJson: stringifyJson(body.policy),
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    const [next] = await context.db.select().from(policyOverrides).where(eq(policyOverrides.policyOverrideId, params.policyOverrideId))
    await emitAuditEvent(context, {
      entityType: 'PolicyOverride',
      entityId: params.policyOverrideId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapPolicyOverride(current),
      after: mapPolicyOverride(next),
    })
    return mapPolicyOverride(next)
  })

  app.get('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Resolve the effective policy for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const query = parseOrThrow(resolvedPolicyQuerySchema, request.query)
    return resolveBatchPolicy(context, params.batchId, { sectionCode: query.sectionCode ?? null })
  })

  app.get('/api/admin/batches/:batchId/resolved-stage-policy', {
    schema: { tags: ['admin-structure'], summary: 'Resolve the effective stage policy for a batch' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ batchId: z.string().min(1) }), request.params)
    const query = parseOrThrow(resolvedPolicyQuerySchema, request.query)
    return resolveBatchStagePolicy(context, params.batchId, { sectionCode: query.sectionCode ?? null })
  })

  app.post('/api/admin/batches/:batchId/resolved-policy', {
    schema: { tags: ['admin-structure'], summary: 'Prevent unsupported writes to resolved policy endpoint' },
  }, async () => {
    throw badRequest('Resolved policy is derived. Update the relevant policy override scope instead.')
  })
}
