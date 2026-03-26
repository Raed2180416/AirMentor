import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import type { Pool } from 'pg'
import type { AppConfig } from './config.js'
import type { AppDb } from './db/client.js'
import { AppError } from './lib/http-errors.js'

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

  app.decorateRequest('auth', null)

  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return
    const origin = request.headers.origin
    if (!origin || !context.config.corsAllowedOrigins.includes(origin)) {
      return reply.status(403).send({
        error: 'FORBIDDEN_ORIGIN',
        message: 'Unsafe requests must originate from an allowed frontend origin.',
      })
    }
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
  await app.register(fastifyCookie)
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'AirMentor Admin Foundation API',
        version: '0.1.0',
      },
    },
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError || (typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error)) {
      const typedError = error as AppError
      void reply.status(typedError.statusCode).send({
        error: typedError.code,
        message: typedError.message,
        details: typedError.details,
      })
      return
    }
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
    stopProofRunWorker()
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
) {
  reply.setCookie(name, value, {
    httpOnly: true,
    sameSite,
    path: '/',
    secure,
    expires: new Date(expiresAt),
  })
}
