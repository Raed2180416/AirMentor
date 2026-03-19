import { and, desc, eq, or, asc } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { z, type ZodType } from 'zod'
import {
  adminRequestNotes,
  adminRequestTransitions,
  adminRequests,
  auditEvents,
  facultyProfiles,
  roleGrants,
  sessions,
  uiPreferences,
  userAccounts,
} from '../db/schema.js'
import type { RouteContext } from '../app.js'
import { createId } from '../lib/ids.js'
import { conflict, forbidden, unauthorized, badRequest } from '../lib/http-errors.js'
import { parseJson, stringifyJson } from '../lib/json.js'

export const sessionCookieSchema = z.object({
  roleGrantId: z.string().min(1),
})

export const themeModeSchema = z.enum(['frosted-focus-light', 'frosted-focus-dark'])
export const apiRoleSchema = z.enum(['SYSTEM_ADMIN', 'HOD', 'COURSE_LEADER', 'MENTOR'])
export const prioritySchema = z.enum(['P1', 'P2', 'P3', 'P4'])
export const adminRequestStatusSchema = z.enum(['New', 'In Review', 'Needs Info', 'Approved', 'Rejected', 'Implemented', 'Closed'])

export async function resolveRequestAuth(context: RouteContext, sessionId: string | undefined) {
  if (!sessionId) return null
  const [session] = await context.db.select().from(sessions).where(eq(sessions.sessionId, sessionId))
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= new Date(context.now()).getTime()) return null

  const [user] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, session.userId))
  if (!user || user.status !== 'active') return null

  const [faculty] = await context.db.select().from(facultyProfiles).where(and(eq(facultyProfiles.userId, user.userId), eq(facultyProfiles.status, 'active')))
  const grants = faculty
    ? await context.db.select().from(roleGrants).where(and(eq(roleGrants.facultyId, faculty.facultyId), eq(roleGrants.status, 'active'))).orderBy(asc(roleGrants.createdAt))
    : []
  const active = grants.find(item => item.grantId === session.activeRoleGrantId) ?? grants[0]
  if (!active) return null

  return {
    sessionId: session.sessionId,
    userId: user.userId,
    username: user.username,
    email: user.email,
    facultyId: faculty?.facultyId ?? null,
    facultyName: faculty?.displayName ?? null,
    activeRoleGrant: mapRoleGrant(active),
    availableRoleGrants: grants.map(mapRoleGrant),
  }
}

export function requireAuth(request: FastifyRequest) {
  if (!request.auth) throw unauthorized()
  return request.auth
}

export function requireRole(request: FastifyRequest, roles: string[]) {
  const auth = requireAuth(request)
  if (!roles.includes(auth.activeRoleGrant.roleCode)) {
    throw forbidden()
  }
  return auth
}

export async function ensurePreference(context: RouteContext, userId: string) {
  const [existing] = await context.db.select().from(uiPreferences).where(eq(uiPreferences.userId, userId))
  if (existing) return existing
  const created = {
    userId,
    themeMode: context.config.defaultThemeMode,
    version: 1,
    updatedAt: context.now(),
  }
  await context.db.insert(uiPreferences).values(created)
  return created
}

export function mapRoleGrant(row: typeof roleGrants.$inferSelect) {
  return {
    grantId: row.grantId,
    facultyId: row.facultyId,
    roleCode: row.roleCode,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
  }
}

export function mapAuditEvent(row: typeof auditEvents.$inferSelect) {
  return {
    auditEventId: row.auditEventId,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    actorRole: row.actorRole,
    actorId: row.actorId,
    before: parseJson(row.beforeJson, null),
    after: parseJson(row.afterJson, null),
    metadata: parseJson(row.metadataJson, null),
    createdAt: row.createdAt,
  }
}

export async function emitAuditEvent(
  context: RouteContext,
  params: {
    entityType: string
    entityId: string
    action: string
    actorRole: string
    actorId?: string | null
    before?: unknown
    after?: unknown
    metadata?: unknown
  },
) {
  await context.db.insert(auditEvents).values({
    auditEventId: createId('audit'),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorRole: params.actorRole,
    actorId: params.actorId ?? null,
    beforeJson: params.before == null ? null : stringifyJson(params.before),
    afterJson: params.after == null ? null : stringifyJson(params.after),
    metadataJson: params.metadata == null ? null : stringifyJson(params.metadata),
    createdAt: context.now(),
  })
}

export function expectVersion(currentVersion: number, nextVersion: number, entityLabel: string, current: unknown) {
  if (currentVersion !== nextVersion) {
    throw conflict(`Stale version for ${entityLabel}`, current)
  }
}

export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw badRequest('Request validation failed', parsed.error.flatten())
  }
  return parsed.data
}

export async function createAdminRequestTransition(
  context: RouteContext,
  params: {
    adminRequestId: string
    previousStatus: string | null
    nextStatus: string
    actorRole: string
    actorFacultyId?: string | null
    noteId?: string | null
    affectedEntityRefs: unknown[]
  },
) {
  await context.db.insert(adminRequestTransitions).values({
    transitionId: createId('request_transition'),
    adminRequestId: params.adminRequestId,
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    actorRole: params.actorRole,
    actorFacultyId: params.actorFacultyId ?? null,
    noteId: params.noteId ?? null,
    affectedEntityRefsJson: stringifyJson(params.affectedEntityRefs),
    createdAt: context.now(),
  })
}

export async function getAdminRequestNotes(context: RouteContext, adminRequestId: string) {
  const notes = await context.db.select().from(adminRequestNotes).where(eq(adminRequestNotes.adminRequestId, adminRequestId)).orderBy(asc(adminRequestNotes.createdAt))
  return notes.map(note => ({
    noteId: note.noteId,
    adminRequestId: note.adminRequestId,
    authorRole: note.authorRole,
    authorFacultyId: note.authorFacultyId,
    visibility: note.visibility,
    noteType: note.noteType,
    body: note.body,
    createdAt: note.createdAt,
  }))
}

export async function getAdminRequestTransitions(context: RouteContext, adminRequestId: string) {
  const transitions = await context.db.select().from(adminRequestTransitions).where(eq(adminRequestTransitions.adminRequestId, adminRequestId)).orderBy(asc(adminRequestTransitions.createdAt))
  return transitions.map(transition => ({
    transitionId: transition.transitionId,
    adminRequestId: transition.adminRequestId,
    previousStatus: transition.previousStatus,
    nextStatus: transition.nextStatus,
    actorRole: transition.actorRole,
    actorFacultyId: transition.actorFacultyId,
    noteId: transition.noteId,
    affectedEntityRefs: parseJson(transition.affectedEntityRefsJson, [] as unknown[]),
    createdAt: transition.createdAt,
  }))
}

export async function getAuditEventsForEntity(context: RouteContext, entityType: string, entityId: string) {
  const rows = await context.db.select().from(auditEvents).where(and(eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, entityId))).orderBy(desc(auditEvents.createdAt))
  return rows.map(mapAuditEvent)
}

export async function canAccessAdminRequest(context: RouteContext, request: FastifyRequest, requestRecord: typeof adminRequests.$inferSelect) {
  const auth = requireAuth(request)
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') return true
  if (auth.activeRoleGrant.roleCode === 'HOD' && auth.facultyId === requestRecord.requestedByFacultyId) return true
  return false
}

export function serializeTargetEntityRefs(value: unknown) {
  return stringifyJson(value)
}

export function deserializeTargetEntityRefs(value: string) {
  return parseJson(value, [] as unknown[])
}

export const patchVersionSchema = z.object({
  version: z.number().int().positive(),
})

export async function findSystemAdminFacultyId(context: RouteContext) {
  const rows = await context.db
    .select({
      facultyId: roleGrants.facultyId,
    })
    .from(roleGrants)
    .where(and(eq(roleGrants.roleCode, 'SYSTEM_ADMIN'), eq(roleGrants.status, 'active')))
    .orderBy(asc(roleGrants.createdAt))
  return rows[0]?.facultyId ?? null
}
