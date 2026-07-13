/**
 * People (faculty master) routes — thin controller.
 *
 * Each handler authenticates + parses the request, then delegates to a use-case
 * (built over a repository from context.db) and maps the use-case's
 * { status, body } onto the reply. Domain logic lives under src/application; all
 * DB access lives under src/adapters/persistence. External services (audit
 * emission, batch-policy resolution, password-setup token/link minting, the
 * email transport, and the process-wide setup-email rate limiter) are injected
 * as context-bound closures.
 *
 * Endpoints:
 *   GET   /api/admin/faculty
 *   POST  /api/admin/faculty
 *   PATCH /api/admin/faculty/:facultyId
 *   POST  /api/admin/faculty/:facultyId/password-setup
 *   POST  /api/admin/faculty/:facultyId/appointments
 *   PATCH /api/admin/appointments/:appointmentId
 *   POST  /api/admin/faculty/:facultyId/role-grants
 *   PATCH /api/admin/role-grants/:grantId
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { createNoopEmailTransport } from '../lib/email-transport.js'
import { EmailRateLimiter } from '../lib/email-rate-limiter.js'
import { buildPasswordSetupLink, issuePasswordSetupToken } from '../lib/password-setup.js'
import { resolveBatchPolicy } from './admin-structure.js'
import { emitAuditEvent, parseOrThrow, requireRole } from './support.js'
import type { AuditEmitter } from '../application/use-cases/curriculum-graph/shared.js'
import {
  appointmentCreateSchema,
  appointmentPatchSchema,
  facultyCreateSchema,
  facultyDirectoryScopeQuerySchema,
  facultyPatchSchema,
  roleGrantCreateSchema,
  roleGrantPatchSchema,
} from '../application/use-cases/people/people-schemas.js'
import type { ResolveBatchPolicyFn } from '../application/use-cases/people/faculty-provenance.js'
import type {
  BuildPasswordSetupLinkFn,
  CheckPasswordSetupRateLimitFn,
  IssuePasswordSetupTokenFn,
} from '../application/use-cases/people/deps.js'
import { createPeopleRepository } from '../adapters/persistence/repositories/people/people-repository.js'
import { listFaculty } from '../application/use-cases/people/list-faculty.js'
import { createFaculty } from '../application/use-cases/people/create-faculty.js'
import { updateFaculty } from '../application/use-cases/people/update-faculty.js'
import { issuePasswordSetup } from '../application/use-cases/people/issue-password-setup.js'
import { createAppointment, updateAppointment } from '../application/use-cases/people/faculty-appointments.js'
import { createRoleGrant, updateRoleGrant } from '../application/use-cases/people/role-grants.js'

const adminPasswordSetupRateLimiter = new EmailRateLimiter(10 * 60 * 1000, 5)

export async function registerPeopleRoutes(app: FastifyInstance, context: RouteContext) {
  const repo = createPeopleRepository(context.db)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)
  const resolveBatchPolicyBound: ResolveBatchPolicyFn = (batchId, options) => resolveBatchPolicy(context, batchId, options)
  const issuePasswordSetupTokenBound: IssuePasswordSetupTokenFn = now => issuePasswordSetupToken(context.config, now)
  const buildPasswordSetupLinkBound: BuildPasswordSetupLinkFn = rawToken => buildPasswordSetupLink(context.config, rawToken)
  const emailTransport = context.emailTransport ?? createNoopEmailTransport()
  const checkPasswordSetupRateLimit: CheckPasswordSetupRateLimitFn = email => adminPasswordSetupRateLimiter.check(email, Date.now())

  app.get('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'List faculty master records' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const filter = parseOrThrow(facultyDirectoryScopeQuerySchema, request.query ?? {})
    const result = await listFaculty(
      { repo, resolveBatchPolicy: resolveBatchPolicyBound, now: context.now },
      { filter },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'Create faculty profile and user' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(facultyCreateSchema, request.body)
    const result = await createFaculty(
      {
        repo,
        emitAudit,
        resolveBatchPolicy: resolveBatchPolicyBound,
        now: context.now,
        issuePasswordSetupToken: issuePasswordSetupTokenBound,
        defaultThemeMode: context.config.defaultThemeMode,
      },
      {
        actorUserId: auth.userId,
        actorRole: auth.activeRoleGrant.roleCode,
        actorFacultyId: auth.facultyId,
        body,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/faculty/:facultyId', {
    schema: { tags: ['people'], summary: 'Update faculty profile and user account' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyPatchSchema, request.body)
    const result = await updateFaculty(
      { repo, emitAudit, resolveBatchPolicy: resolveBatchPolicyBound, now: context.now },
      {
        facultyId: params.facultyId,
        actorRole: auth.activeRoleGrant.roleCode,
        actorFacultyId: auth.facultyId,
        body,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/faculty/:facultyId/password-setup', {
    schema: { tags: ['people'], summary: 'Issue a faculty password setup or reset link' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const result = await issuePasswordSetup(
      {
        repo,
        emitAudit,
        now: context.now,
        issuePasswordSetupToken: issuePasswordSetupTokenBound,
        buildPasswordSetupLink: buildPasswordSetupLinkBound,
        emailTransport,
        checkPasswordSetupRateLimit,
        passwordSetupPreviewEnabled: context.config.passwordSetupPreviewEnabled,
        emailFromAddress: context.config.emailFromAddress,
        emailFromName: context.config.emailFromName,
      },
      {
        facultyId: params.facultyId,
        actorUserId: auth.userId,
        actorRole: auth.activeRoleGrant.roleCode,
        actorFacultyId: auth.facultyId,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/faculty/:facultyId/appointments', {
    schema: { tags: ['people'], summary: 'Create faculty appointment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(appointmentCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const result = await createAppointment(
      { repo, emitAudit, now: context.now },
      { actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId, body },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/appointments/:appointmentId', {
    schema: { tags: ['people'], summary: 'Update faculty appointment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ appointmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(appointmentPatchSchema, request.body)
    const result = await updateAppointment(
      { repo, emitAudit, now: context.now },
      { appointmentId: params.appointmentId, actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId, body },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/faculty/:facultyId/role-grants', {
    schema: { tags: ['people'], summary: 'Create role grant' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(roleGrantCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const result = await createRoleGrant(
      { repo, emitAudit, now: context.now },
      { actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId, body },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/role-grants/:grantId', {
    schema: { tags: ['people'], summary: 'Update role grant' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ grantId: z.string().min(1) }), request.params)
    const body = parseOrThrow(roleGrantPatchSchema, request.body)
    const result = await updateRoleGrant(
      { repo, emitAudit, now: context.now },
      { grantId: params.grantId, actorRole: auth.activeRoleGrant.roleCode, actorFacultyId: auth.facultyId, body },
    )
    return reply.status(result.status).send(result.body)
  })
}
