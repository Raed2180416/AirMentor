/**
 * Admin Control Plane Routes — thin controller.
 *
 * Each handler authenticates + parses the request, then delegates to a use-case
 * (built over a repository from context.db) and maps the use-case's
 * { status, body } onto the reply. Domain logic lives under src/application; all
 * DB access lives under src/adapters/persistence. External services
 * (audit history/mapping, proof view, role-grant/scope resolution) are injected
 * as context-bound closures.
 *
 * Endpoints:
 *   GET   /api/admin/search
 *   GET   /api/admin/audit-events
 *   GET   /api/admin/audit-events/recent
 *   GET   /api/admin/reminders
 *   POST  /api/admin/reminders
 *   PATCH /api/admin/reminders/:reminderId
 *   GET   /api/admin/faculty-calendar/:facultyId
 *   PUT   /api/admin/faculty-calendar/:facultyId
 *   GET   /api/academic/faculty-profile/:facultyId
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { forbidden } from '../lib/http-errors.js'
import {
  emitAuditEvent,
  getAuditEventsForEntity,
  mapAuditEvent,
  mapRoleGrant,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'
import { buildFacultyProofView } from '../lib/msruas-proof-control-plane.js'
import { resolveAcademicStageCheckpoint } from './academic.js'
import type { AuditEmitter } from '../application/use-cases/curriculum-graph/shared.js'
import { facultyCalendarSaveSchema } from '../application/use-cases/admin-control-plane/faculty-calendar-domain.js'
import type { AuditEventRow } from '../application/use-cases/admin-control-plane/reminder-audit-domain.js'
import type { FacultyProfileRoleGrantRow } from '../application/use-cases/admin-control-plane/faculty-profile-domain.js'
import { createAdminControlPlaneRepository } from '../adapters/persistence/repositories/admin-control-plane/admin-control-plane-repository.js'
import { searchAdminWorkspace } from '../application/use-cases/admin-control-plane/search-admin-workspace.js'
import { readEntityAuditEvents, readRecentAuditEvents } from '../application/use-cases/admin-control-plane/audit-events.js'
import { createReminder, listReminders, updateReminder } from '../application/use-cases/admin-control-plane/reminders.js'
import { readFacultyCalendar, saveFacultyCalendar } from '../application/use-cases/admin-control-plane/faculty-calendar.js'
import { readFacultyProfile } from '../application/use-cases/admin-control-plane/read-faculty-profile.js'

const reminderCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  dueAt: z.string().min(1),
  status: z.enum(['pending', 'done']).default('pending'),
})

const reminderPatchSchema = reminderCreateSchema.extend({
  version: z.number().int().positive(),
})

const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  academicFacultyId: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  sectionCode: z.string().optional(),
})

const auditQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
})

const recentAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(80),
})

const facultyCalendarParamsSchema = z.object({
  facultyId: z.string().min(1),
})

export async function registerAdminControlPlaneRoutes(app: FastifyInstance, context: RouteContext) {
  const repo = createAdminControlPlaneRepository(context.db, context.now)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)
  const getAuditEventsForEntityBound = (entityType: string, entityId: string) =>
    getAuditEventsForEntity(context, entityType, entityId)
  const mapAuditEventBound = (row: AuditEventRow) => mapAuditEvent(row)
  const mapRoleGrantBound = (row: FacultyProfileRoleGrantRow) => mapRoleGrant(row)
  const buildFacultyProofViewBound = (input: Parameters<typeof buildFacultyProofView>[1]) =>
    buildFacultyProofView(context.db, input)

  app.get('/api/admin/search', {
    schema: { tags: ['admin-control-plane'], summary: 'Search the admin workspace with optional scope narrowing' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(searchQuerySchema, request.query)
    const result = await searchAdminWorkspace({ repo }, { query })
    return reply.status(result.status).send(result.body)
  })

  app.get('/api/admin/audit-events', {
    schema: { tags: ['admin-control-plane'], summary: 'Read audit history for any admin-managed entity' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(auditQuerySchema, request.query)
    const result = await readEntityAuditEvents(
      { getAuditEventsForEntity: getAuditEventsForEntityBound },
      { entityType: query.entityType, entityId: query.entityId },
    )
    return reply.status(result.status).send(result.body)
  })

  app.get('/api/admin/audit-events/recent', {
    schema: { tags: ['admin-control-plane'], summary: 'Read the most recent admin audit activity across the workspace' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(recentAuditQuerySchema, request.query)
    const result = await readRecentAuditEvents({ repo, mapAuditEvent: mapAuditEventBound }, { limit: query.limit })
    return reply.status(result.status).send(result.body)
  })

  app.get('/api/admin/reminders', {
    schema: { tags: ['admin-control-plane'], summary: 'List private reminders for the current system admin' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const result = await listReminders({ repo }, { facultyId: auth.facultyId })
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/reminders', {
    schema: { tags: ['admin-control-plane'], summary: 'Create a private reminder for the current system admin' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    if (!auth.facultyId) throw forbidden('Faculty context is required to create reminders')
    const body = parseOrThrow(reminderCreateSchema, request.body)
    const result = await createReminder(
      { repo, emitAudit },
      {
        facultyId: auth.facultyId,
        actorRole: auth.activeRoleGrant.roleCode,
        title: body.title,
        body: body.body,
        dueAt: body.dueAt,
        status: body.status,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/reminders/:reminderId', {
    schema: { tags: ['admin-control-plane'], summary: 'Update a private reminder' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    if (!auth.facultyId) throw forbidden('Faculty context is required to update reminders')
    const params = parseOrThrow(z.object({ reminderId: z.string().min(1) }), request.params)
    const body = parseOrThrow(reminderPatchSchema, request.body)
    const result = await updateReminder(
      { repo, emitAudit },
      {
        facultyId: auth.facultyId,
        actorRole: auth.activeRoleGrant.roleCode,
        reminderId: params.reminderId,
        title: body.title,
        body: body.body,
        dueAt: body.dueAt,
        status: body.status,
        version: body.version,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.get('/api/admin/faculty-calendar/:facultyId', {
    schema: { tags: ['admin-control-plane'], summary: 'Read the sysadmin timetable workspace for a faculty member' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(facultyCalendarParamsSchema, request.params)
    const result = await readFacultyCalendar({ repo, now: context.now }, { facultyId: params.facultyId })
    return reply.status(result.status).send(result.body)
  })

  app.put('/api/admin/faculty-calendar/:facultyId', {
    schema: { tags: ['admin-control-plane'], summary: 'Persist the sysadmin timetable workspace for a faculty member' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(facultyCalendarParamsSchema, request.params)
    const body = parseOrThrow(facultyCalendarSaveSchema, request.body)
    const result = await saveFacultyCalendar(
      { repo, emitAudit, now: context.now },
      {
        facultyId: params.facultyId,
        actorRole: auth.activeRoleGrant.roleCode,
        actorFacultyId: auth.facultyId,
        actorUserId: auth.userId,
        body,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.get('/api/academic/faculty-profile/:facultyId', {
    schema: { tags: ['academic'], summary: 'Read the teaching-side faculty profile projection' },
  }, async (request, reply) => {
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const query = parseOrThrow(z.object({
      simulationStageCheckpointId: z.string().min(1).optional(),
    }), request.query)
    const resolveCheckpoint = (simulationRunId: string, simulationStageCheckpointId: string) =>
      resolveAcademicStageCheckpoint(context, auth, simulationRunId, simulationStageCheckpointId)
    const result = await readFacultyProfile(
      {
        repo,
        resolveAcademicStageCheckpoint: resolveCheckpoint,
        buildFacultyProofView: buildFacultyProofViewBound,
        mapRoleGrant: mapRoleGrantBound,
      },
      {
        facultyId: params.facultyId,
        simulationStageCheckpointId: query.simulationStageCheckpointId,
        viewerRoleCode: auth.activeRoleGrant.roleCode,
        viewerFacultyId: auth.facultyId,
        demoWorkspaceId: auth.demoWorkspaceId,
      },
    )
    return reply.status(result.status).send(result.body)
  })
}
