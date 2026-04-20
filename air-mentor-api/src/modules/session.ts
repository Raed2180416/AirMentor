import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendCookie, type RouteContext } from '../app.js'
import { buildCsrfToken } from '../lib/csrf.js'
import { facultyProfiles, loginRateLimitWindows, roleGrants, sessions, uiPreferences, userAccounts, userPasswordCredentials, userPasswordSetupTokens } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { badRequest, conflict, notFound, tooManyRequests, unauthorized } from '../lib/http-errors.js'
import { buildPasswordSetupLink, deriveFacultyCredentialStatus, hashPasswordSetupToken, isPasswordSetupTokenExpired, issuePasswordSetupToken } from '../lib/password-setup.js'
import { createNoopEmailTransport } from '../lib/email-transport.js'
import { EmailRateLimiter } from '../lib/email-rate-limiter.js'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { emitOperationalEvent } from '../lib/telemetry.js'
import { addHours } from '../lib/time.js'
import { ensurePreference, parseOrThrow, requireAuth, resolveRequestAuth, sortActiveRoleGrantRows } from './support.js'

const selfServicePasswordSetupRateLimiter = new EmailRateLimiter(10 * 60 * 1000, 3)

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const passwordSetupRequestSchema = z.object({
  identifier: z.string().min(1),
})

const passwordSetupRedeemSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

const themePatchSchema = z.object({
  themeMode: z.enum(['frosted-focus-light', 'frosted-focus-dark']),
  version: z.number().int().positive(),
})

async function buildSessionPayload(context: RouteContext, sessionId: string) {
  const [session] = await context.db.select().from(sessions).where(eq(sessions.sessionId, sessionId))
  if (!session) throw unauthorized()
  const auth = await resolveRequestAuth(context, sessionId)
  if (!auth) throw unauthorized()
  const preferences = await ensurePreference(context, auth.userId)
  return {
    expiresAt: session.expiresAt,
    payload: {
      sessionId: auth.sessionId,
      csrfToken: buildCsrfToken(context.config.csrfSecret, auth.sessionId),
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
    },
  }
}

function syncSessionCookies(context: RouteContext, reply: Parameters<typeof sendCookie>[0], sessionId: string, expiresAt: string) {
  sendCookie(
    reply,
    context.config.sessionCookieName,
    sessionId,
    context.config.sessionCookieSecure,
    context.config.sessionCookieSameSite,
    expiresAt,
  )
  sendCookie(
    reply,
    context.config.csrfCookieName,
    buildCsrfToken(context.config.csrfSecret, sessionId),
    context.config.sessionCookieSecure,
    context.config.sessionCookieSameSite,
    expiresAt,
    false,
  )
}

export async function registerSessionRoutes(app: FastifyInstance, context: RouteContext) {
  function normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase()
  }

  function getAttemptKey(identifier: string) {
    return createHash('sha256')
      .update(context.config.csrfSecret)
      .update('::')
      .update(normalizeIdentifier(identifier))
      .digest('hex')
  }

  function windowExpired(windowStartedAt: string, nowIsoString: string) {
    return (new Date(nowIsoString).getTime() - new Date(windowStartedAt).getTime()) >= context.config.loginRateLimitWindowMs
  }

  async function assertLoginAttemptAllowed(identifier: string) {
    const now = context.now()
    const key = getAttemptKey(identifier)
    const [current] = await context.db.select().from(loginRateLimitWindows).where(eq(loginRateLimitWindows.attemptKey, key))
    if (!current) return
    if (windowExpired(current.windowStartedAt, now)) {
      await context.db.delete(loginRateLimitWindows).where(eq(loginRateLimitWindows.attemptKey, key))
      return
    }
    if (current.failureCount < context.config.loginRateLimitMaxAttempts) return
    emitOperationalEvent('auth.login.rate_limited', {
      identifier: normalizeIdentifier(identifier),
      attemptCount: current.failureCount,
      windowMs: context.config.loginRateLimitWindowMs,
    }, { level: 'warn' })
    throw tooManyRequests('Too many login attempts. Please wait and try again.')
  }

  async function recordFailedLogin(identifier: string) {
    const now = context.now()
    const key = getAttemptKey(identifier)
    const [current] = await context.db.select().from(loginRateLimitWindows).where(eq(loginRateLimitWindows.attemptKey, key))
    if (!current || windowExpired(current.windowStartedAt, now)) {
      if (current) {
        await context.db.delete(loginRateLimitWindows).where(eq(loginRateLimitWindows.attemptKey, key))
      }
      await context.db.insert(loginRateLimitWindows).values({
        attemptKey: key,
        failureCount: 1,
        windowStartedAt: now,
        lastFailedAt: now,
        updatedAt: now,
      })
      return
    }
    await context.db.update(loginRateLimitWindows).set({
      failureCount: current.failureCount + 1,
      lastFailedAt: now,
      updatedAt: now,
    }).where(eq(loginRateLimitWindows.attemptKey, key))
  }

  async function clearFailedLogins(identifier: string) {
    await context.db.delete(loginRateLimitWindows).where(eq(loginRateLimitWindows.attemptKey, getAttemptKey(identifier)))
  }

  async function findUserByIdentifier(identifier: string) {
    const normalized = normalizeIdentifier(identifier)
    const users = await context.db.select().from(userAccounts)
    return users.find(user =>
      normalizeIdentifier(user.username) === normalized
      || normalizeIdentifier(user.email) === normalized,
    ) ?? null
  }

  async function findPasswordSetupContextByToken(token: string) {
    const tokenHash = hashPasswordSetupToken(token)
    const [tokenRow] = await context.db.select().from(userPasswordSetupTokens).where(eq(userPasswordSetupTokens.tokenHash, tokenHash))
    if (!tokenRow) throw notFound('Password setup link is invalid')
    const now = context.now()
    if (tokenRow.consumedAt) throw badRequest('This password setup link has already been used')
    if (isPasswordSetupTokenExpired(tokenRow.expiresAt, now)) throw badRequest('This password setup link has expired')
    const [user] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, tokenRow.userId))
    if (!user || user.status !== 'active') throw notFound('Active user account not found for this password setup link')
    const [faculty] = await context.db.select().from(facultyProfiles).where(and(eq(facultyProfiles.userId, user.userId), eq(facultyProfiles.status, 'active')))
    if (!faculty) throw notFound('Active faculty profile not found for this password setup link')
    return { tokenRow, user, faculty }
  }

  app.addHook('preHandler', async request => {
    request.auth = await resolveRequestAuth(context, request.cookies[context.config.sessionCookieName])
  })

  app.get('/api/session', {
    schema: {
      tags: ['session'],
      summary: 'Restore current session',
    },
  }, async (request, reply) => {
    const auth = requireAuth(request)
    const now = context.now()
    await context.db.update(sessions).set({
      lastSeenAt: now,
      updatedAt: now,
    }).where(eq(sessions.sessionId, auth.sessionId))
    emitOperationalEvent('auth.session.restored', {
      sessionId: auth.sessionId,
      userId: auth.userId,
      facultyId: auth.facultyId ?? null,
      activeRole: auth.activeRoleGrant.roleCode,
    })
    const session = await buildSessionPayload(context, auth.sessionId)
    syncSessionCookies(context, reply, auth.sessionId, session.expiresAt)
    return session.payload
  })

  app.post('/api/session/login', {
    schema: {
      tags: ['session'],
      summary: 'Login with username and password',
    },
  }, async (request, reply) => {
    const body = parseOrThrow(loginSchema, request.body)
    await assertLoginAttemptAllowed(body.identifier)
    const user = await findUserByIdentifier(body.identifier)
    if (!user) {
      await recordFailedLogin(body.identifier)
      emitOperationalEvent('auth.login.failed', {
        identifier: body.identifier,
        reason: 'user_not_found',
      }, { level: 'warn' })
      throw unauthorized('Invalid credentials')
    }
    if (user.status !== 'active') {
      await recordFailedLogin(body.identifier)
      emitOperationalEvent('auth.login.failed', {
        identifier: body.identifier,
        userId: user.userId,
        reason: 'user_inactive',
      }, { level: 'warn' })
      throw unauthorized('This account is no longer active')
    }

    const [credential] = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))
    if (!credential) {
      await recordFailedLogin(body.identifier)
      emitOperationalEvent('auth.login.failed', {
        identifier: body.identifier,
        userId: user.userId,
        reason: 'credential_missing',
      }, { level: 'warn' })
      throw unauthorized('Finish password setup from the invite or reset link before signing in')
    }

    const isValid = await verifyPassword(credential.passwordHash, body.password)
    if (!isValid) {
      await recordFailedLogin(body.identifier)
      emitOperationalEvent('auth.login.failed', {
        identifier: body.identifier,
        userId: user.userId,
        reason: 'invalid_password',
      }, { level: 'warn' })
      throw unauthorized('Invalid credentials')
    }

    const [faculty] = await context.db.select().from(facultyProfiles).where(and(eq(facultyProfiles.userId, user.userId), eq(facultyProfiles.status, 'active')))
    if (!faculty) {
      await recordFailedLogin(body.identifier)
      throw notFound('Faculty profile is missing or inactive for this account')
    }
    const grants = sortActiveRoleGrantRows(
      await context.db.select().from(roleGrants).where(and(eq(roleGrants.facultyId, faculty.facultyId), eq(roleGrants.status, 'active'))),
    )
    if (grants.length === 0) {
      await recordFailedLogin(body.identifier)
      throw badRequest('No active role grants are configured for this user')
    }
    await clearFailedLogins(body.identifier)

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
    syncSessionCookies(context, reply, sessionId, expiresAt)
    emitOperationalEvent('auth.login.succeeded', {
      sessionId,
      userId: user.userId,
      facultyId: faculty.facultyId,
      activeRole: grants[0].roleCode,
    })
    return (await buildSessionPayload(context, sessionId)).payload
  })

  app.post('/api/session/password-setup/request', {
    schema: {
      tags: ['session'],
      summary: 'Request a password setup or reset link',
    },
  }, async request => {
    const body = parseOrThrow(passwordSetupRequestSchema, request.body)
    const user = await findUserByIdentifier(body.identifier)
    if (!user || user.status !== 'active') {
      return {
        ok: true as const,
        previewEnabled: context.config.passwordSetupPreviewEnabled,
        setupUrl: null,
        message: 'If this account exists, a password setup link has been prepared.',
      }
    }
    const [faculty] = await context.db.select().from(facultyProfiles).where(and(eq(facultyProfiles.userId, user.userId), eq(facultyProfiles.status, 'active')))
    if (!faculty) {
      return {
        ok: true as const,
        previewEnabled: context.config.passwordSetupPreviewEnabled,
        setupUrl: null,
        message: 'If this account exists, a password setup link has been prepared.',
      }
    }
    const credentialRows = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))
    const now = context.now()
    const issued = issuePasswordSetupToken(context.config, now)
    const purpose = credentialRows.length > 0 ? 'reset' : 'invite'
    await context.db.insert(userPasswordSetupTokens).values({
      passwordSetupTokenId: issued.passwordSetupTokenId,
      userId: user.userId,
      purpose,
      tokenHash: issued.tokenHash,
      issuedToEmail: user.email,
      requestedByUserId: null,
      expiresAt: issued.expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    emitOperationalEvent('auth.password_setup.requested', {
      userId: user.userId,
      facultyId: faculty.facultyId,
      purpose,
      previewEnabled: context.config.passwordSetupPreviewEnabled,
    })
    const setupLink = buildPasswordSetupLink(context.config, issued.rawToken)
    const transport = context.emailTransport ?? createNoopEmailTransport()
    const rateLimitResult = selfServicePasswordSetupRateLimiter.check(user.email, Date.now())
    if (rateLimitResult.allowed) {
      await transport.sendPasswordSetupEmail({
        to: user.email,
        recipientName: faculty.displayName ?? user.username,
        setupLink,
        purpose,
        expiresAt: issued.expiresAt,
        fromAddress: context.config.emailFromAddress,
        fromName: context.config.emailFromName,
      })
    }
    return {
      ok: true as const,
      previewEnabled: context.config.passwordSetupPreviewEnabled,
      setupUrl: context.config.passwordSetupPreviewEnabled ? setupLink : null,
      message: context.config.passwordSetupPreviewEnabled
        ? 'Password setup preview link is ready on this local system.'
        : 'If this account exists, a password setup link has been sent.',
    }
  })

  app.get('/api/session/password-setup/:token', {
    schema: {
      tags: ['session'],
      summary: 'Inspect a password setup or reset link',
    },
  }, async request => {
    const params = parseOrThrow(z.object({ token: z.string().min(1) }), request.params)
    const { tokenRow, user, faculty } = await findPasswordSetupContextByToken(params.token)
    return {
      purpose: tokenRow.purpose,
      username: user.username,
      email: user.email,
      facultyId: faculty.facultyId,
      displayName: faculty.displayName,
      expiresAt: tokenRow.expiresAt,
      credentialStatus: deriveFacultyCredentialStatus({
        now: context.now(),
        passwordConfigured: (await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))).length > 0,
        tokens: await context.db.select().from(userPasswordSetupTokens).where(eq(userPasswordSetupTokens.userId, user.userId)),
      }),
    }
  })

  app.post('/api/session/password-setup/redeem', {
    schema: {
      tags: ['session'],
      summary: 'Redeem a password setup or reset link',
    },
  }, async request => {
    const body = parseOrThrow(passwordSetupRedeemSchema, request.body)
    const { tokenRow, user, faculty } = await findPasswordSetupContextByToken(body.token)
    const now = context.now()
    const nextPasswordHash = await hashPassword(body.password)
    const [existingCredential] = await context.db.select().from(userPasswordCredentials).where(eq(userPasswordCredentials.userId, user.userId))
    if (existingCredential) {
      await context.db.update(userPasswordCredentials).set({
        passwordHash: nextPasswordHash,
        updatedAt: now,
      }).where(eq(userPasswordCredentials.userId, user.userId))
    } else {
      await context.db.insert(userPasswordCredentials).values({
        userId: user.userId,
        passwordHash: nextPasswordHash,
        updatedAt: now,
      })
    }
    await context.db.update(userPasswordSetupTokens).set({
      consumedAt: now,
      updatedAt: now,
    }).where(eq(userPasswordSetupTokens.passwordSetupTokenId, tokenRow.passwordSetupTokenId))
    await context.db.delete(sessions).where(eq(sessions.userId, user.userId))
    await clearFailedLogins(user.username)
    await clearFailedLogins(user.email)
    emitOperationalEvent('auth.password_setup.redeemed', {
      userId: user.userId,
      facultyId: faculty.facultyId,
      purpose: tokenRow.purpose,
    })
    return {
      ok: true as const,
      username: user.username,
      displayName: faculty.displayName,
      purpose: tokenRow.purpose,
    }
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
    reply.clearCookie(context.config.csrfCookieName, {
      path: '/',
      sameSite: context.config.sessionCookieSameSite,
      secure: context.config.sessionCookieSecure,
    })
    emitOperationalEvent('auth.logout.succeeded', {
      sessionId: auth.sessionId,
      userId: auth.userId,
      facultyId: auth.facultyId ?? null,
      activeRole: auth.activeRoleGrant.roleCode,
    })
    return { ok: true }
  })

  app.post('/api/session/role-context', {
    schema: {
      tags: ['session'],
      summary: 'Switch active role context',
    },
  }, async (request, reply) => {
    const auth = requireAuth(request)
    const body = parseOrThrow(z.object({ roleGrantId: z.string().min(1) }), request.body)
    const match = auth.availableRoleGrants.find(item => item.grantId === body.roleGrantId)
    if (!match) throw unauthorized('Role grant is not available for this session')
    await context.db.update(sessions).set({
      activeRoleGrantId: body.roleGrantId,
      updatedAt: context.now(),
    }).where(eq(sessions.sessionId, auth.sessionId))
    emitOperationalEvent('auth.role_context.switched', {
      sessionId: auth.sessionId,
      userId: auth.userId,
      facultyId: auth.facultyId ?? null,
      fromRole: auth.activeRoleGrant.roleCode,
      toRole: match.roleCode,
      scopeType: match.scopeType,
      scopeId: match.scopeId,
    })
    const session = await buildSessionPayload(context, auth.sessionId)
    syncSessionCookies(context, reply, auth.sessionId, session.expiresAt)
    return session.payload
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
