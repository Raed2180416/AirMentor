/**
 * Academic Runtime Routes — thin controller.
 *
 * Offering runtime & operational writes (runtime-state slices, action-queue
 * tasks + placements, calendar-audit, faculty timetable workspace, meetings, and
 * the offering data-entry writes). Each handler authenticates + parses the
 * request, then delegates to a use-case built over the AcademicRuntimeRepository
 * and the shared academic functions from academic.ts (the `deps` bag, bound as
 * context closures). Domain logic lives under src/application; all direct DB
 * access lives under src/adapters/persistence.
 *
 * The registrar name + signature `registerAcademicRuntimeRoutes(app, context,
 * deps)` is unchanged (academic.ts calls it) and `taskPayloadWithPlacementDate`
 * is re-exported for the unit test that imports it from this module.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { forbidden } from '../lib/http-errors.js'
import { triggerActiveRunRecomputeIfPresent } from '../adapters/simulation/msruas-proof-control-plane.js'
import type { AcademicRouteDependencies } from './academic.js'
import { DEFAULT_POLICY, resolveBatchPolicy } from './admin-structure.js'
import {
  emitAuditEvent,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'
import { createAcademicRuntimeRepository } from '../adapters/persistence/repositories/academic-runtime/academic-runtime-repository.js'
import type { AuditEmitter } from '../application/use-cases/curriculum-graph/shared.js'
import type { AcademicRuntimeUseCaseDeps } from '../application/use-cases/academic-runtime/deps.js'
import {
  upsertNamedRuntimeSlice,
  upsertRuntimeStateSlice,
} from '../application/use-cases/academic-runtime/runtime-state.js'
import {
  listVisibleTaskRecords,
  putSingleTask,
  syncTasks,
} from '../application/use-cases/academic-runtime/tasks.js'
import {
  transitionUnlockRequest,
  unlockRequestTransitionBodySchema,
} from '../application/use-cases/academic-runtime/unlock-request-transition.js'
import {
  deleteAcademicTaskPlacement,
  listVisibleTaskPlacements,
  putSinglePlacement,
  syncTaskPlacements,
} from '../application/use-cases/academic-runtime/task-placements.js'
import {
  appendAcademicCalendarAuditEvent,
  listCalendarAudit,
  saveFacultyCalendarWorkspace,
  syncCalendarAudit,
} from '../application/use-cases/academic-runtime/calendar-audit.js'
import {
  createMeeting,
  updateMeeting,
} from '../application/use-cases/academic-runtime/meetings.js'
import {
  clearAssessmentLock,
  commitAttendance,
  saveOfferingScheme,
  saveQuestionPaper,
} from '../application/use-cases/academic-runtime/offering-data-entry.js'
import { commitAssessmentEntries } from '../application/use-cases/academic-runtime/offering-assessment-entries.js'

export { taskPayloadWithPlacementDate } from '../application/use-cases/academic-runtime/task-payload.js'

export async function registerAcademicRuntimeRoutes(
  app: FastifyInstance,
  context: RouteContext,
  deps: AcademicRouteDependencies,
) {
  const {
    academicMeetingCreateSchema,
    academicMeetingParamsSchema,
    academicMeetingPatchSchema,
    academicRoleCodes,
    assessmentCommitParamsSchema,
    assessmentCommitSchema,
    attendanceCommitSchema,
    calendarAuditSyncSchema,
    facultyCalendarWorkspaceUpsertSchema,
    offeringParamsSchema,
    offeringQuestionPaperUpsertSchema,
    offeringSchemeUpsertSchema,
    questionPaperParamsSchema,
    runtimeSliceSchemas,
    runtimeStateKeySchema,
    taskPlacementSyncSchema,
    taskSyncSchema,
  } = deps

  const repo = createAcademicRuntimeRepository(context.db, context.now)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)

  // Context-bound closures for the shared academic `deps` functions + external
  // services, keeping the persistence-free application layer clean of `context`.
  const useCaseDeps: AcademicRuntimeUseCaseDeps = {
    repo,
    now: context.now,
    emitAudit,
    triggerActiveRunRecompute: facultyId => triggerActiveRunRecomputeIfPresent(context, facultyId),
    resolveBatchPolicy: (batchId, options) => resolveBatchPolicy(context, batchId, options),
    DEFAULT_POLICY,
    getAcademicRuntimeState: stateKey => deps.getAcademicRuntimeState(context, stateKey),
    saveAcademicRuntimeState: (stateKey, payload) => deps.saveAcademicRuntimeState(context, stateKey, payload),
    assertViewerCanManageTask: (auth, record) => deps.assertViewerCanManageTask(context, auth, record),
    assertStudentEnrolledInOffering: (offering, studentId) => deps.assertStudentEnrolledInOffering(context, offering, studentId),
    getOfferingContext: offeringId => deps.getOfferingContext(context, offeringId),
    assertCourseLeaderCanManageOffering: (facultyId, offeringId) => deps.assertCourseLeaderCanManageOffering(context, facultyId, offeringId),
    buildAcademicMeetingResponse: row => deps.buildAcademicMeetingResponse(context, row),
    validateFacultyCalendarTemplate: (facultyId, template) => deps.validateFacultyCalendarTemplate(context, facultyId, template),
    getEditableCalendarWindowStatus: facultyId => deps.getEditableCalendarWindowStatus(context, facultyId),
    assertViewerCanSuperviseStudent: input => deps.assertViewerCanSuperviseStudent({ ...input, context }),
    mapAcademicTaskRow: deps.mapAcademicTaskRow,
    mapTaskTransitionRow: deps.mapTaskTransitionRow,
    mapTaskPlacementRow: deps.mapTaskPlacementRow,
    mapCalendarAuditEventRow: deps.mapCalendarAuditEventRow,
    mapFacultyCalendarWorkspaceRow: deps.mapFacultyCalendarWorkspaceRow,
    normalizeAcademicStudentId: deps.normalizeAcademicStudentId,
    millisToIso: deps.millisToIso,
    validateMeetingWindow: deps.validateMeetingWindow,
    validateSchemeAgainstPolicy: deps.validateSchemeAgainstPolicy,
    canonicalizeSchemeState: deps.canonicalizeSchemeState,
    buildDefaultSchemeFromPolicy: deps.buildDefaultSchemeFromPolicy,
    buildDefaultQuestionPaper: deps.buildDefaultQuestionPaper,
    validateQuestionPaperBlueprint: deps.validateQuestionPaperBlueprint,
    flattenTermTestLeaves: deps.flattenTermTestLeaves,
    resolveCourseOutcomesForOffering: deps.resolveCourseOutcomesForOffering,
    taskSyncSchema: deps.taskSyncSchema,
    taskPlacementSyncSchema: deps.taskPlacementSyncSchema,
    calendarAuditSyncSchema: deps.calendarAuditSyncSchema,
    schemeStateSchema: deps.schemeStateSchema,
    termTestBlueprintSchema: deps.termTestBlueprintSchema,
    academicMeetingCreateSchema: deps.academicMeetingCreateSchema,
    academicMeetingPatchSchema: deps.academicMeetingPatchSchema,
    attendanceCommitSchema: deps.attendanceCommitSchema,
    assessmentCommitSchema: deps.assessmentCommitSchema,
    assessmentCommitParamsSchema: deps.assessmentCommitParamsSchema,
    questionPaperParamsSchema: deps.questionPaperParamsSchema,
    offeringSchemeUpsertSchema: deps.offeringSchemeUpsertSchema,
    offeringQuestionPaperUpsertSchema: deps.offeringQuestionPaperUpsertSchema,
  }

  const taskUpsertBodySchema = z.object({
    task: z.unknown(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  const taskPlacementUpsertBodySchema = z.object({
    placement: z.unknown(),
    expectedUpdatedAt: z.number().int().nonnegative().optional(),
  })
  const calendarAuditAppendBodySchema = z.object({
    event: z.unknown(),
  })
  const taskIdParamsSchema = z.object({
    taskId: z.string().min(1),
  })
  const taskPlacementDeleteQuerySchema = z.object({
    expectedUpdatedAt: z.coerce.number().int().nonnegative().optional(),
  })
  const compatibilityRouteSuccessors: Partial<Record<string, string>> = {
    '/api/academic/tasks/sync': '/api/academic/tasks',
    '/api/academic/task-placements/sync': '/api/academic/task-placements',
    '/api/academic/calendar-audit/sync': '/api/academic/calendar-audit',
  }

  function markCompatibilityRouteUsage(reply: { header: (name: string, value: string) => unknown }, route: string) {
    reply.header('Deprecation', 'true')
    reply.header('Sunset', '2026-12-31T00:00:00Z')
    reply.header('Warning', `299 AirMentor "${route} is a deprecated compatibility route; migrate to the authoritative academic endpoints."`)
    reply.header('X-AirMentor-Compatibility-Route', 'true')
    const successor = compatibilityRouteSuccessors[route]
    if (successor) {
      reply.header('Link', `<${successor}>; rel="successor-version"`)
    }
  }

  app.put('/api/academic/runtime/:stateKey', {
    schema: {
      tags: ['academic'],
      summary: 'Persist a single academic runtime slice',
      deprecated: true,
    },
  }, async (request, reply) => {
    requireRole(request, [...academicRoleCodes])
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ stateKey: runtimeStateKeySchema }), request.params)
    const body = parseOrThrow(runtimeSliceSchemas[params.stateKey] as z.ZodTypeAny, request.body)
    markCompatibilityRouteUsage(reply, '/api/academic/runtime/:stateKey')
    return upsertRuntimeStateSlice(useCaseDeps, auth, params.stateKey, body)
  })

  function registerNamedRuntimeSliceUpsertRoute(input: {
    route: string
    stateKey: 'drafts' | 'cellValues' | 'lockByOffering' | 'lockAuditByTarget'
    summary: string
  }) {
    app.put(input.route, {
      schema: {
        tags: ['academic'],
        summary: input.summary,
      },
    }, async request => {
      requireRole(request, [...academicRoleCodes])
      const auth = requireAuth(request)
      const body = parseOrThrow(runtimeSliceSchemas[input.stateKey] as z.ZodTypeAny, request.body)
      return upsertNamedRuntimeSlice(useCaseDeps, auth, input.route, input.stateKey, body)
    })
  }

  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/drafts',
    stateKey: 'drafts',
    summary: 'Persist academic draft cells',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/cell-values',
    stateKey: 'cellValues',
    summary: 'Persist academic cell values',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/lock-by-offering',
    stateKey: 'lockByOffering',
    summary: 'Persist academic entry locks by offering',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/lock-audit-by-target',
    stateKey: 'lockAuditByTarget',
    summary: 'Persist academic lock audit by target',
  })

  app.put('/api/academic/tasks/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative academic action queue projection for the active teaching role',
      deprecated: true,
    },
  }, async (request, reply) => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskSyncSchema, request.body)
    markCompatibilityRouteUsage(reply, '/api/academic/tasks/sync')
    return syncTasks(useCaseDeps, auth, auth.facultyId, body)
  })

  app.get('/api/academic/tasks', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative academic tasks for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    return {
      items: await listVisibleTaskRecords(useCaseDeps, auth),
    }
  })

  app.put('/api/academic/tasks/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Create or update a single academic task with per-entity conflict handling',
    },
  }, async request => {
    // SYSTEM_ADMIN is included so the admin control-plane and the Playwright
    // HOD correction-cycle fixture can seed tasks; assertViewerCanManageTask
    // then bypasses scope checks for SYSTEM_ADMIN while still enforcing them
    // for academic roles.
    const auth = requireRole(request, [...academicRoleCodes, 'SYSTEM_ADMIN'])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const body = parseOrThrow(taskUpsertBodySchema, request.body)
    return putSingleTask(useCaseDeps, auth, params.taskId, body)
  })

  // POST /api/academic/unlock-requests/:taskId/transition — Phase-6 HOD
  // correction-cycle state machine. Validates the requested transition
  // through proof-hod-correction-cycle-engine.ts (pure) and persists the
  // new unlockRequest payload onto the underlying academic task.
  //
  // Contract (§D.6 + §C.6):
  //   request → Pending       (COURSE_LEADER/MENTOR/HOD)
  //   approve → Approved      (HOD/SYSTEM_ADMIN)
  //   reject  → Rejected      (HOD/SYSTEM_ADMIN, terminal)
  //   reset-complete → Reset Completed (editor truly reopens)
  //   teacher-edit-submit → Reset Completed (triggers recompute flag)
  //   relock  → Relocked      (cycle closed)
  app.post('/api/academic/unlock-requests/:taskId/transition', {
    schema: {
      tags: ['academic'],
      summary: 'Drive a correction-cycle unlock request transition via the HOD state-machine engine',
    },
  }, async request => {
    // HOD + proof-faculty roles may all trigger different transitions; the
    // engine does the real role-gate check. We allow the union here so a
    // teacher can hit the same URL to submit a follow-up edit.
    const auth = requireRole(request, [...academicRoleCodes, 'SYSTEM_ADMIN'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const body = parseOrThrow(unlockRequestTransitionBodySchema, request.body)
    return transitionUnlockRequest(useCaseDeps, auth, auth.facultyId, params.taskId, body)
  })

  app.put('/api/academic/task-placements/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist task placements for the active teaching role',
      deprecated: true,
    },
  }, async (request, reply) => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskPlacementSyncSchema, request.body)
    markCompatibilityRouteUsage(reply, '/api/academic/task-placements/sync')
    return syncTaskPlacements(useCaseDeps, auth, auth.facultyId, body)
  })

  app.get('/api/academic/task-placements', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative task placements for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    return listVisibleTaskPlacements(useCaseDeps, auth)
  })

  app.put('/api/academic/task-placements/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Create or update a single task placement with per-entity conflict handling',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const body = parseOrThrow(taskPlacementUpsertBodySchema, request.body)
    return putSinglePlacement(useCaseDeps, auth, params.taskId, body)
  })

  app.delete('/api/academic/task-placements/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Delete a single task placement with per-entity conflict handling',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const query = parseOrThrow(taskPlacementDeleteQuerySchema, request.query)
    return deleteAcademicTaskPlacement(useCaseDeps, auth, params.taskId, query.expectedUpdatedAt)
  })

  app.put('/api/academic/calendar-audit/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist faculty calendar audit events',
      deprecated: true,
    },
  }, async (request, reply) => {
    const auth = requireRole(request, [...academicRoleCodes])
    const body = parseOrThrow(calendarAuditSyncSchema, request.body)
    markCompatibilityRouteUsage(reply, '/api/academic/calendar-audit/sync')
    return syncCalendarAudit(useCaseDeps, auth, body)
  })

  app.get('/api/academic/calendar-audit', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative calendar audit events for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    return listCalendarAudit(useCaseDeps, auth)
  })

  app.post('/api/academic/calendar-audit', {
    schema: {
      tags: ['academic'],
      summary: 'Append a single calendar audit event for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const body = parseOrThrow(calendarAuditAppendBodySchema, request.body)
    return appendAcademicCalendarAuditEvent(useCaseDeps, auth, body.event, {
      writeRuntimeShadow: false,
    })
  })

  app.put('/api/academic/faculty-calendar-workspace/:facultyId', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the faculty-owned timetable workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyCalendarWorkspaceUpsertSchema, request.body)
    return saveFacultyCalendarWorkspace(useCaseDeps, auth, auth.facultyId, params.facultyId, body.template)
  })

  app.post('/api/academic/meetings', {
    schema: {
      tags: ['academic'],
      summary: 'Create a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(academicMeetingCreateSchema, request.body)
    return createMeeting(useCaseDeps, auth, auth.facultyId, body)
  })

  app.patch('/api/academic/meetings/:meetingId', {
    schema: {
      tags: ['academic'],
      summary: 'Update a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(academicMeetingParamsSchema, request.params)
    const body = parseOrThrow(academicMeetingPatchSchema, request.body)
    return updateMeeting(useCaseDeps, auth, auth.facultyId, params.meetingId, body)
  })

  app.put('/api/academic/offerings/:offeringId/attendance', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering attendance entries from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(attendanceCommitSchema, request.body)
    return commitAttendance(useCaseDeps, auth, auth.facultyId, params.offeringId, body)
  })

  app.put('/api/academic/offerings/:offeringId/assessment-entries/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering assessment entry rows from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(assessmentCommitParamsSchema, request.params)
    const body = parseOrThrow(assessmentCommitSchema, request.body)
    return commitAssessmentEntries(useCaseDeps, auth, auth.facultyId, params, body)
  })

  app.post('/api/academic/offerings/:offeringId/assessment-entries/:kind/clear-lock', {
    schema: {
      tags: ['academic'],
      summary: 'Clear an assessment entry lock after HOD unlock approval (HOD only)',
    },
  }, async request => {
    const auth = requireRole(request, ['HOD'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(assessmentCommitParamsSchema, request.params)
    return clearAssessmentLock(useCaseDeps, auth, auth.facultyId, params)
  })

  app.put('/api/academic/offerings/:offeringId/scheme', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative assessment scheme for an offering',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(offeringSchemeUpsertSchema, request.body)
    return saveOfferingScheme(useCaseDeps, auth, auth.facultyId, params.offeringId, body)
  })

  app.put('/api/academic/offerings/:offeringId/question-papers/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist an offering-owned question paper blueprint',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(questionPaperParamsSchema, request.params)
    const body = parseOrThrow(offeringQuestionPaperUpsertSchema, request.body)
    return saveQuestionPaper(useCaseDeps, auth, auth.facultyId, params, body)
  })
}
