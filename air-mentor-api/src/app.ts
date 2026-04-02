import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import type { Pool } from 'pg'
import type { AppConfig } from './config.js'
import type { AppDb } from './db/client.js'
import { AppError } from './lib/http-errors.js'
import { buildCsrfToken, readSingleHeaderValue, secureTokenEquals } from './lib/csrf.js'
import { emitOperationalEvent, normalizeTelemetryError, configureOperationalTelemetryPersistence } from './lib/telemetry.js'
import { persistOperationalTelemetryEvent } from './lib/operational-event-store.js'

export type BuildAppOptions = {
  config: AppConfig
  db: AppDb
  pool: Pick<Pool, 'query'>
  clock?: () => string
}

export type RouteContext = BuildAppOptions & {
  now: () => string
}

type RouteRegistrar = (app: FastifyInstance, context: RouteContext) => Promise<void>

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false })
  const context: RouteContext = {
    ...options,
    now: options.clock ?? (() => new Date().toISOString()),
  }
  const disposeTelemetryPersistence = configureOperationalTelemetryPersistence(event =>
    persistOperationalTelemetryEvent(context.db, event, context.now()),
  )

  await app.register(fastifyCookie)
  app.decorateRequest('auth', null)

  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return
    const requestPath = request.url.split('?')[0] ?? request.url
    const origin = request.headers.origin
    if (!origin || !context.config.corsAllowedOrigins.includes(origin)) {
      emitOperationalEvent('security.forbidden_origin', {
        method: request.method,
        route: requestPath,
        origin: origin ?? null,
      }, { level: 'warn' })
      return reply.status(403).send({
        error: 'FORBIDDEN_ORIGIN',
        message: 'Unsafe requests must originate from an allowed frontend origin.',
      })
    }
    if (requestPath === '/api/client-telemetry') return
    const sessionId = request.cookies[context.config.sessionCookieName]
    if (!sessionId) return
    const csrfHeader = readSingleHeaderValue(request.headers['x-airmentor-csrf'])
    const csrfCookie = request.cookies[context.config.csrfCookieName] ?? ''
    const expectedToken = buildCsrfToken(context.config.csrfSecret, sessionId)
    let failureReason: string | null = null

    if (!csrfHeader) failureReason = 'missing_header'
    else if (!csrfCookie) failureReason = 'missing_cookie'
    else if (!secureTokenEquals(csrfCookie, expectedToken)) failureReason = 'cookie_mismatch'
    else if (!secureTokenEquals(csrfHeader, expectedToken)) failureReason = 'header_mismatch'

    if (!failureReason) return

    emitOperationalEvent('security.csrf.rejected', {
      method: request.method,
      route: requestPath,
      origin: origin ?? null,
      reason: failureReason,
      sessionCookiePresent: true,
    }, { level: 'warn' })
    return reply.status(403).send({
      error: 'FORBIDDEN_CSRF',
      message: 'Authenticated write requests must include a valid CSRF token.',
    })
  })

  await app.register(fastifyCors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }
      callback(null, context.config.corsAllowedOrigins.includes(origin))
    },
  })
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'AirMentor Admin Foundation API',
        version: '0.1.0',
      },
    },
  })

  app.setErrorHandler((error, request, reply) => {
    const route = request.routeOptions.url ?? request.url
    if (error instanceof AppError || (typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error)) {
      const typedError = error as AppError
      emitOperationalEvent('request.error', {
        method: request.method,
        route,
        statusCode: typedError.statusCode,
        code: typedError.code,
        error: normalizeTelemetryError(error),
      }, { level: typedError.statusCode >= 500 ? 'error' : 'warn' })
      void reply.status(typedError.statusCode).send({
        error: typedError.code,
        message: typedError.message,
        details: typedError.details,
      })
      return
    }
    emitOperationalEvent('request.error', {
      method: request.method,
      route,
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      error: normalizeTelemetryError(error),
    }, { level: 'error' })
    app.log.error(error)
    console.error(error)
    void reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
    })
  })

  app.get('/', async () => ({
    name: 'AirMentor Admin Foundation API',
    health: '/health',
    openapi: '/openapi.json',
  }))
  app.get('/health', async () => ({ ok: true }))
  app.get('/openapi.json', async () => app.swagger())

  const modules: RouteRegistrar[] = []
  const { registerSessionRoutes } = await import('./modules/session.js')
  const { registerInstitutionRoutes } = await import('./modules/institution.js')
  const { registerAdminStructureRoutes } = await import('./modules/admin-structure.js')
  const { registerPeopleRoutes } = await import('./modules/people.js')
  const { registerStudentRoutes } = await import('./modules/students.js')
  const { registerCourseRoutes } = await import('./modules/courses.js')
  const { registerAdminRequestRoutes } = await import('./modules/admin-requests.js')
  const { registerAdminProofSandboxRoutes } = await import('./modules/admin-proof-sandbox.js')
  const { registerClientTelemetryRoutes } = await import('./modules/client-telemetry.js')
  const { registerAcademicRoutes } = await import('./modules/academic.js')
  const { registerAdminControlPlaneRoutes } = await import('./modules/admin-control-plane.js')
  modules.push(
    registerSessionRoutes,
    registerInstitutionRoutes,
    registerAdminStructureRoutes,
    registerPeopleRoutes,
    registerStudentRoutes,
    registerCourseRoutes,
    registerAdminRequestRoutes,
    registerAdminProofSandboxRoutes,
    registerClientTelemetryRoutes,
    registerAcademicRoutes,
    registerAdminControlPlaneRoutes,
  )

  for (const registerModule of modules) {
    await registerModule(app, context)
  }

  const { startProofRunWorker } = await import('./lib/proof-run-queue.js')
  const stopProofRunWorker = startProofRunWorker({
    db: context.db,
    pool: context.pool,
    clock: context.now,
  })
  app.addHook('onClose', async () => {
    disposeTelemetryPersistence()
    await stopProofRunWorker()
  })

  return app
}

export function getBody<T>(request: FastifyRequest) {
  return (request.body ?? {}) as T
}

export function sendCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  secure: boolean,
  sameSite: 'lax' | 'strict' | 'none',
  expiresAt: string,
  httpOnly = true,
) {
  reply.setCookie(name, value, {
    httpOnly,
    sameSite,
    path: '/',
    secure,
    expires: new Date(expiresAt),
  })
}
