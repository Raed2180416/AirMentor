import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendCookie, type RouteContext } from '../app.js'
import { facultyProfiles, roleGrants, sessions, uiPreferences, userAccounts, userPasswordCredentials } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { conflict, badRequest, notFound, unauthorized } from '../lib/http-errors.js'
import { verifyPassword } from '../lib/passwords.js'
import { addHours } from '../lib/time.js'
import { ensurePreference, parseOrThrow, requireAuth, resolveRequestAuth } from './support.js'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const themePatchSchema = z.object({
  themeMode: z.enum(['frosted-focus-light', 'frosted-focus-dark']),
  version: z.number().int().positive(),
})

async function buildSessionPayload(context: RouteContext, sessionId: string) {
  const auth = await resolveRequestAuth(context, sessionId)
  if (!auth) throw unauthorized()
  const preferences = await ensurePreference(context, auth.userId)
  return {
    sessionId: auth.sessionId,
    user: {
      userId: auth.userId,
      username: auth.username,
      email: auth.email,
    },
    faculty: auth.facultyId ? {
      facultyId: auth.facultyId,
      displayName: auth.facultyName,
    } : null,
    activeRoleGrant: auth.activeRoleGrant,
    availableRoleGrants: auth.availableRoleGrants,
    preferences: {
      themeMode: preferences.themeMode,
      version: preferences.version,
      updatedAt: preferences.updatedAt,
    },
  }
}

export async function registerSessionRoutes(app: FastifyInstance, context: RouteContext) {
  app.addHook('preHandler', async request => {
    request.auth = await resolveRequestAuth(context, request.cookies[context.config.sessionCookieName])
  })

  app.get('/api/session', {
    schema: {
      tags: ['session'],
      summary: 'Restore current session',
    },
  }, async request => {
    const auth = requireAuth(request)
    await context.db.update(sessions).set({
      lastSeenAt: context.now(),
      updatedAt: context.now(),
    }).where(eq(sessions.sessionId, auth.sessionId))
    return buildSessionPayload(context, auth.sessionId)
  })

  app.post('/api/session/login', {
    schema: {
      tags: ['session'],
      summary: 'Login with username and password',
    },
  }, async (request, reply) => {
    const body = parseOrThrow(loginSchema, request.body)
    const users = await context.db.select().from(userAccounts).where(eq(userAccounts.username, body.identifier))
    const user = users[0]
    if (!user) throw unauthorized('Invalid credentials')

    const [credential] = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))
    if (!credential) throw unauthorized('Password is not configured for this account')

    const isValid = await verifyPassword(credential.passwordHash, body.password)
    if (!isValid) throw unauthorized('Invalid credentials')

    const [faculty] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.userId, user.userId))
    if (!faculty) throw notFound('Faculty profile is missing for this account')
    const grants = await context.db.select().from(roleGrants).where(and(eq(roleGrants.facultyId, faculty.facultyId), eq(roleGrants.status, 'active')))
    if (grants.length === 0) throw badRequest('No active role grants are configured for this user')

    const now = context.now()
    const expiresAt = addHours(now, context.config.sessionTtlHours)
    const sessionId = createId('session')
    await ensurePreference(context, user.userId)
    await context.db.insert(sessions).values({
      sessionId,
      userId: user.userId,
      activeRoleGrantId: grants[0].grantId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    })
    sendCookie(
      reply,
      context.config.sessionCookieName,
      sessionId,
      context.config.sessionCookieSecure,
      context.config.sessionCookieSameSite,
      expiresAt,
    )
    return buildSessionPayload(context, sessionId)
  })

  app.delete('/api/session', {
    schema: {
      tags: ['session'],
      summary: 'Logout current session',
    },
  }, async (request, reply) => {
    const auth = requireAuth(request)
    await context.db.delete(sessions).where(eq(sessions.sessionId, auth.sessionId))
    reply.clearCookie(context.config.sessionCookieName, {
      path: '/',
      sameSite: context.config.sessionCookieSameSite,
      secure: context.config.sessionCookieSecure,
    })
    return { ok: true }
  })

  app.post('/api/session/role-context', {
    schema: {
      tags: ['session'],
      summary: 'Switch active role context',
    },
  }, async request => {
    const auth = requireAuth(request)
    const body = parseOrThrow(z.object({ roleGrantId: z.string().min(1) }), request.body)
    const match = auth.availableRoleGrants.find(item => item.grantId === body.roleGrantId)
    if (!match) throw unauthorized('Role grant is not available for this session')
    await context.db.update(sessions).set({
      activeRoleGrantId: body.roleGrantId,
      updatedAt: context.now(),
    }).where(eq(sessions.sessionId, auth.sessionId))
    return buildSessionPayload(context, auth.sessionId)
  })

  app.get('/api/preferences/ui', {
    schema: {
      tags: ['session'],
      summary: 'Get UI preferences',
    },
  }, async request => {
    const auth = requireAuth(request)
    const preferences = await ensurePreference(context, auth.userId)
    return {
      userId: auth.userId,
      themeMode: preferences.themeMode,
      version: preferences.version,
      updatedAt: preferences.updatedAt,
    }
  })

  app.patch('/api/preferences/ui', {
    schema: {
      tags: ['session'],
      summary: 'Save UI preferences',
    },
  }, async request => {
    const auth = requireAuth(request)
    const body = parseOrThrow(themePatchSchema, request.body)
    const preferences = await ensurePreference(context, auth.userId)
    if (preferences.version !== body.version) {
      throw conflict('Stale version for UI preferences', preferences)
    }
    await context.db.update(uiPreferences).set({
      themeMode: body.themeMode,
      version: body.version + 1,
      updatedAt: context.now(),
    }).where(eq(uiPreferences.userId, auth.userId))
    const [next] = await context.db.select().from(uiPreferences).where(eq(uiPreferences.userId, auth.userId))
    return {
      userId: auth.userId,
      themeMode: next.themeMode,
      version: next.version,
      updatedAt: next.updatedAt,
    }
  })
}
