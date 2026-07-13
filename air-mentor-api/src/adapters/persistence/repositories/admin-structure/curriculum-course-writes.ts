/**
 * POST/PATCH /api/admin/curriculum-courses handler bodies — create/update a
 * curriculum course, sync it into the import, rematerialise, regenerate linkage
 * candidates, and enqueue a proof refresh.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts.
 */
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  batches,
  courses,
  curriculumCourses,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { createId } from '../../../../lib/ids.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from '../../../../modules/support.js'
import {
  curriculumCourseCreateSchema,
  curriculumCoursePatchSchema,
} from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import { mapCurriculumCourse } from './row-mappers.js'
import { syncCurriculumCourseIntoImport } from './curriculum-import-summary.js'
import { rematerializeResolvedBatchCurriculum } from './materialize-resolved.js'
import { regenerateCurriculumLinkageCandidatesForBatch } from './regenerate-linkage-candidates.js'
import { enqueueProofRefreshForBatches } from './enqueue-proof-refresh.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'

export async function createCurriculumCourse(context: RouteContext, request: FastifyRequest) {
  const auth = requireRole(request, ['SYSTEM_ADMIN'])
  const body = parseOrThrow(curriculumCourseCreateSchema, request.body)
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
  if (!batch) throw notFound('Batch not found')
  if (body.courseId) {
    const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
    if (!course) throw notFound('Course not found')
  }
  const now = context.now()
  const beforeResolved = await resolveBatchCurriculumFeatures(context, body.batchId)
  const created = {
    curriculumCourseId: createId('curriculum_course'),
    batchId: body.batchId,
    semesterNumber: body.semesterNumber,
    courseId: body.courseId ?? null,
    courseCode: body.courseCode,
    title: body.title,
    credits: body.credits,
    status: body.status,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await context.db.insert(curriculumCourses).values(created)
  await syncCurriculumCourseIntoImport(context, {
    curriculumCourse: created,
    actorFacultyId: auth.facultyId,
    now,
  })
  const { resolved: afterResolved, curriculumImportVersionId } = await rematerializeResolvedBatchCurriculum(context, {
    batchId: created.batchId,
    actorFacultyId: auth.facultyId,
    now,
  })
  await regenerateCurriculumLinkageCandidatesForBatch(context, {
    batchId: created.batchId,
    targetCurriculumCourseIds: [created.curriculumCourseId],
    now,
  })
  const affectedBatchIds = beforeResolved.curriculumFeatureProfileFingerprint !== afterResolved.curriculumFeatureProfileFingerprint
    ? [created.batchId]
    : []
  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: affectedBatchIds,
    actorFacultyId: auth.facultyId,
    now,
    curriculumImportVersionId,
  })
  const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, created.curriculumCourseId))
  await emitAuditEvent(context, {
    entityType: 'CurriculumCourse',
    entityId: created.curriculumCourseId,
    action: 'created',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
    after: mapCurriculumCourse(persisted ?? created),
  })
  return {
    ...mapCurriculumCourse(persisted ?? created),
    proofRefresh,
  }
}

export async function updateCurriculumCourse(context: RouteContext, request: FastifyRequest) {
  const auth = requireRole(request, ['SYSTEM_ADMIN'])
  const params = parseOrThrow(z.object({ curriculumCourseId: z.string().min(1) }), request.params)
  const body = parseOrThrow(curriculumCoursePatchSchema, request.body)
  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
  if (!batch) throw notFound('Batch not found')
  if (body.courseId) {
    const [course] = await context.db.select().from(courses).where(eq(courses.courseId, body.courseId))
    if (!course) throw notFound('Course not found')
  }
  const [current] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
  if (!current) throw notFound('Curriculum course not found')
  expectVersion(current.version, body.version, 'CurriculumCourse', mapCurriculumCourse(current))
  const now = context.now()
  const beforeResolvedByBatchId = new Map<string, string>([
    [current.batchId, (await resolveBatchCurriculumFeatures(context, current.batchId)).curriculumFeatureProfileFingerprint],
  ])
  if (body.batchId !== current.batchId) {
    beforeResolvedByBatchId.set(body.batchId, (await resolveBatchCurriculumFeatures(context, body.batchId)).curriculumFeatureProfileFingerprint)
  }
  await context.db.update(curriculumCourses).set({
    batchId: body.batchId,
    semesterNumber: body.semesterNumber,
    courseId: body.courseId ?? null,
    courseCode: body.courseCode,
    title: body.title,
    credits: body.credits,
    status: body.status,
    version: current.version + 1,
    updatedAt: now,
  }).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
  const [next] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
  if (!next) throw notFound('Curriculum course not found after update')
  await syncCurriculumCourseIntoImport(context, {
    curriculumCourse: next,
    actorFacultyId: auth.facultyId,
    now,
  })
  const { resolved: afterResolved, curriculumImportVersionId } = await rematerializeResolvedBatchCurriculum(context, {
    batchId: next.batchId,
    actorFacultyId: auth.facultyId,
    now,
  })
  let previousBatchImportVersionId: string | null = null
  if (current.batchId !== next.batchId) {
    const previousBatchRematerialized = await rematerializeResolvedBatchCurriculum(context, {
      batchId: current.batchId,
      actorFacultyId: auth.facultyId,
      now,
    })
    previousBatchImportVersionId = previousBatchRematerialized.curriculumImportVersionId
    await regenerateCurriculumLinkageCandidatesForBatch(context, {
      batchId: current.batchId,
      now,
    })
  }
  await regenerateCurriculumLinkageCandidatesForBatch(context, {
    batchId: next.batchId,
    targetCurriculumCourseIds: [next.curriculumCourseId],
    now,
  })
  const affectedBatchIds = Array.from(new Set([
    ...((beforeResolvedByBatchId.get(next.batchId) ?? '') !== afterResolved.curriculumFeatureProfileFingerprint ? [next.batchId] : []),
    ...(current.batchId !== next.batchId && previousBatchImportVersionId !== null ? [current.batchId] : []),
  ]))
  const proofRefresh = await enqueueProofRefreshForBatches(context, {
    batchIds: affectedBatchIds,
    actorFacultyId: auth.facultyId,
    now,
    curriculumImportVersionId: curriculumImportVersionId ?? previousBatchImportVersionId,
  })
  const [persisted] = await context.db.select().from(curriculumCourses).where(eq(curriculumCourses.curriculumCourseId, params.curriculumCourseId))
  await emitAuditEvent(context, {
    entityType: 'CurriculumCourse',
    entityId: params.curriculumCourseId,
    action: 'updated',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
    before: mapCurriculumCourse(current),
    after: mapCurriculumCourse(persisted ?? next),
  })
  return {
    ...mapCurriculumCourse(persisted ?? next),
    proofRefresh,
  }
}
