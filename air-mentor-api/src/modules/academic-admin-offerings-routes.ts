/**
 * Academic Admin Offerings Routes — thin controller.
 *
 * Offering lifecycle & provisioning surface for System Admin. Each handler
 * authenticates + parses the request, then delegates to a use-case (built over
 * a repository from context.db) and returns the raw body / throws the same
 * AppError as the legacy handler, so status codes and payloads are byte-for-byte
 * identical. Domain logic lives under src/application; all DB access lives under
 * src/adapters/persistence. Shared academic services (buildAcademicBootstrap,
 * buildOfferingStageEligibility, getOfferingContext, the assert* guards, the
 * course-outcome mapper/resolver, …) stay owned by academic.ts and are consumed
 * here as context-bound closures injected into the use-cases.
 *
 * Endpoints:
 *   GET    /api/admin/course-outcomes
 *   POST   /api/admin/course-outcomes
 *   PATCH  /api/admin/course-outcomes/:courseOutcomeOverrideId
 *   GET    /api/admin/offerings/:offeringId/resolved-course-outcomes
 *   GET    /api/admin/offerings/:offeringId/stage-eligibility
 *   POST   /api/admin/offerings/:offeringId/advance-stage
 *   POST   /api/admin/batches/:batchId/provision
 *   GET    /api/admin/offerings
 *   POST   /api/admin/attendance-snapshots
 *   POST   /api/admin/assessment-scores
 *   POST   /api/admin/student-interventions
 *   POST   /api/admin/transcript-term-results
 *   POST   /api/admin/transcript-subject-results
 *   POST   /api/admin/offerings
 *   PATCH  /api/admin/offerings/:offeringId
 *   GET    /api/admin/offering-ownership
 *   POST   /api/admin/offering-ownership
 *   PATCH  /api/admin/offering-ownership/:ownershipId
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import type { AcademicRouteDependencies } from './academic.js'
import {
  emitAuditEvent,
  expectVersion,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'
import { createAcademicOfferingsRepository } from '../adapters/persistence/repositories/academic-offerings/academic-offerings-repository.js'
import { provisionBatch } from '../adapters/persistence/repositories/academic-offerings/provision-batch.js'
import type {
  AcademicBootstrapResult,
  AuditEmitter,
  CourseOutcomeOverrideRow,
  CourseOutcomeScope,
  OfferingContextResult,
  ResolveCourseOutcomesInput,
  StageEligibilityResult,
} from '../application/use-cases/academic-offerings/shared.js'
import {
  createCourseOutcomeOverride,
  listCourseOutcomeOverrides,
  resolveOfferingCourseOutcomes,
  updateCourseOutcomeOverride,
} from '../application/use-cases/academic-offerings/course-outcomes.js'
import {
  createOffering,
  listOfferings,
  updateOffering,
} from '../application/use-cases/academic-offerings/offering-lifecycle.js'
import {
  advanceOfferingStage,
  getStageEligibility,
} from '../application/use-cases/academic-offerings/offering-stage.js'
import {
  createAssessmentScore,
  createAttendanceSnapshot,
  createIntervention,
  createTranscriptSubjectResult,
  createTranscriptTermResult,
} from '../application/use-cases/academic-offerings/bulk-ingestion.js'
import {
  createOwnership,
  listOfferingOwnerships,
  updateOwnership,
} from '../application/use-cases/academic-offerings/ownership.js'

export async function registerAcademicAdminOfferingRoutes(
  app: FastifyInstance,
  context: RouteContext,
  deps: AcademicRouteDependencies,
) {
  const repo = createAcademicOfferingsRepository(context.db)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)
  const now = context.now

  // Context-bound closures for the injected shared academic services; these
  // collapse the strict db/schema types onto the persistence-free structural
  // aliases the use-cases consume.
  const mapCourseOutcomeOverride = (row: CourseOutcomeOverrideRow) => deps.mapCourseOutcomeOverride(row)
  const assertCourseOutcomeScopeExists = (scopeType: CourseOutcomeScope, scopeId: string) =>
    deps.assertCourseOutcomeScopeExists(context, scopeType, scopeId)
  const resolveCourseOutcomesForOffering = (input: ResolveCourseOutcomesInput) =>
    deps.resolveCourseOutcomesForOffering(input)
  const getOfferingContext = (offeringId: string): Promise<OfferingContextResult> =>
    deps.getOfferingContext(context, offeringId)
  const buildOfferingStageEligibility = (offeringId: string): Promise<StageEligibilityResult> =>
    deps.buildOfferingStageEligibility(context, offeringId)
  const buildAcademicBootstrap = (viewer: {
    facultyId: string | null
    roleCode: string | null
    demoWorkspaceId: string | null
  }): Promise<AcademicBootstrapResult> => deps.buildAcademicBootstrap(context, viewer)
  const assertSingleActiveOfferingOwner = (offeringId: string, facultyId: string, excludeOwnershipId?: string) =>
    deps.assertSingleActiveOfferingOwner(context, offeringId, facultyId, excludeOwnershipId)

  app.get('/api/admin/course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List scoped course outcome overrides',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(deps.courseOutcomeOverrideListQuerySchema, request.query)
    return listCourseOutcomeOverrides(
      { repo, mapCourseOutcomeOverride },
      { courseId: query.courseId, scopeType: query.scopeType, scopeId: query.scopeId },
    )
  })

  app.post('/api/admin/course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a scoped course outcome override',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.courseOutcomeOverrideCreateSchema, request.body)
    return createCourseOutcomeOverride(
      { repo, mapCourseOutcomeOverride, assertCourseOutcomeScopeExists, emitAudit, now },
      {
        courseId: body.courseId,
        scopeType: body.scopeType,
        scopeId: body.scopeId,
        outcomes: body.outcomes,
        status: body.status,
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
      },
    )
  })

  app.patch('/api/admin/course-outcomes/:courseOutcomeOverrideId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update a scoped course outcome override',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ courseOutcomeOverrideId: z.string().min(1) }), request.params)
    const body = parseOrThrow(deps.courseOutcomeOverridePatchSchema, request.body)
    return updateCourseOutcomeOverride(
      { repo, mapCourseOutcomeOverride, assertCourseOutcomeScopeExists, expectVersion, emitAudit, now },
      {
        courseOutcomeOverrideId: params.courseOutcomeOverrideId,
        courseId: body.courseId,
        scopeType: body.scopeType,
        scopeId: body.scopeId,
        outcomes: body.outcomes,
        status: body.status,
        version: body.version,
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
      },
    )
  })

  app.get('/api/admin/offerings/:offeringId/resolved-course-outcomes', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Resolve the active course outcomes for an offering',
    },
  }, async request => {
    const auth = requireAuth(request)
    const params = parseOrThrow(deps.offeringParamsSchema, request.params)
    const assertViewerCanReadOffering = (offeringId: string) =>
      deps.assertViewerCanReadOffering(context, auth, offeringId)
    return resolveOfferingCourseOutcomes(
      { repo, assertViewerCanReadOffering, getOfferingContext, resolveCourseOutcomesForOffering },
      { offeringId: params.offeringId },
    )
  })

  app.get('/api/admin/offerings/:offeringId/stage-eligibility', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Compute whether an offering can advance to the next configured stage',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(deps.adminOfferingParamsSchema, request.params)
    return getStageEligibility({ buildOfferingStageEligibility }, { offeringId: params.offeringId })
  })

  app.post('/api/admin/offerings/:offeringId/advance-stage', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Advance an offering to the next configured stage when all evidence is complete',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(deps.adminOfferingParamsSchema, request.params)
    return advanceOfferingStage(
      { repo, buildOfferingStageEligibility, now },
      { offeringId: params.offeringId, actorFacultyId: auth.facultyId ?? null },
    )
  })

  app.post('/api/admin/batches/:batchId/provision', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Retired batch provisioning endpoint',
    },
  }, async request => {
    return provisionBatch(context, deps, request)
  })

  app.get('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List section offerings',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    return listOfferings(
      { buildAcademicBootstrap },
      {
        facultyId: auth.facultyId ?? null,
        roleCode: auth.activeRoleGrant.roleCode ?? null,
        demoWorkspaceId: auth.demoWorkspaceId ?? null,
      },
    )
  })

  app.post('/api/admin/attendance-snapshots', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student attendance snapshot',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.attendanceSnapshotCreateSchema, request.body)
    return createAttendanceSnapshot(
      { repo, emitAudit, now },
      { body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.post('/api/admin/assessment-scores', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student assessment score',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.assessmentScoreCreateSchema, request.body)
    return createAssessmentScore(
      { repo, emitAudit, now },
      { body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.post('/api/admin/student-interventions', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a student intervention history entry',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.interventionCreateSchema, request.body)
    return createIntervention(
      { repo, emitAudit, now },
      { body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.post('/api/admin/transcript-term-results', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a transcript term result',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.transcriptTermResultCreateSchema, request.body)
    return createTranscriptTermResult(
      { repo, emitAudit, now },
      { body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.post('/api/admin/transcript-subject-results', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a transcript subject result row',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.transcriptSubjectResultCreateSchema, request.body)
    return createTranscriptSubjectResult(
      { repo, emitAudit, now },
      { body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.post('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.offeringCreateSchema, request.body)
    return createOffering(
      { repo, emitAudit, now },
      { ...body, actorRole: auth.activeRoleGrant.roleCode, actorId: auth.facultyId ?? auth.userId },
    )
  })

  app.patch('/api/admin/offerings/:offeringId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ offeringId: z.string().min(1) }), request.params)
    const body = parseOrThrow(deps.offeringPatchSchema, request.body)
    return updateOffering(
      { repo, expectVersion, emitAudit, now },
      {
        ...body,
        offeringId: params.offeringId,
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
      },
    )
  })

  app.get('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List offering ownership records',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    return listOfferingOwnerships({ repo })
  })

  app.post('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(deps.ownershipCreateSchema, request.body)
    return createOwnership(
      { repo, assertSingleActiveOfferingOwner, emitAudit, now },
      {
        offeringId: body.offeringId,
        facultyId: body.facultyId,
        status: body.status,
        fixedOwnershipRole: deps.FIXED_OWNERSHIP_ROLE,
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
      },
    )
  })

  app.patch('/api/admin/offering-ownership/:ownershipId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ ownershipId: z.string().min(1) }), request.params)
    const body = parseOrThrow(deps.ownershipPatchSchema, request.body)
    return updateOwnership(
      { repo, assertSingleActiveOfferingOwner, expectVersion, emitAudit, now },
      {
        ownershipId: params.ownershipId,
        offeringId: body.offeringId,
        facultyId: body.facultyId,
        status: body.status,
        version: body.version,
        fixedOwnershipRole: deps.FIXED_OWNERSHIP_ROLE,
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
      },
    )
  })
}
