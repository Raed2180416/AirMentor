import path from 'node:path'
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import type { InjectOptions } from 'light-my-request'
import { buildApp } from '../../src/app.js'
import { loadConfig } from '../../src/config.js'
import { createDb, createPool, type AppDb } from '../../src/db/client.js'
import { runSqlMigrations } from '../../src/db/migrate.js'
import { seedIntoDatabase, type SeedProfile } from '../../src/db/seed.js'
import { buildCsrfToken } from '../../src/lib/csrf.js'
import type { EmailTransport } from '../../src/lib/email-transport.js'

export const TEST_NOW = '2026-03-16T00:00:00.000Z'
export const TEST_ORIGIN = 'http://127.0.0.1:5173'

function readCookieValue(cookieHeader: unknown, name: string) {
  const rawCookieHeader = Array.isArray(cookieHeader)
    ? cookieHeader.join('; ')
    : typeof cookieHeader === 'string'
      ? cookieHeader
      : ''
  if (!rawCookieHeader) return null
  const entries = rawCookieHeader.split(';')
  for (const entry of entries) {
    const [cookieName, ...valueParts] = entry.trim().split('=')
    if (cookieName === name) return valueParts.join('=')
  }
  return null
}

function appendCookieValue(cookieHeader: unknown, name: string, value: string) {
  const rawCookieHeader = Array.isArray(cookieHeader)
    ? cookieHeader.join('; ')
    : typeof cookieHeader === 'string'
      ? cookieHeader
      : ''
  if (!rawCookieHeader) return `${name}=${value}`
  return `${rawCookieHeader}; ${name}=${value}`
}

function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a test port')))
        return
      }
      const port = address.port
      server.close(error => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

export async function createTestApp(options?: {
  env?: NodeJS.ProcessEnv
  emailTransport?: EmailTransport
  seedProfile?: SeedProfile
}) {
  const port = await findFreePort()
  const tmpBase = process.env.AIRMENTOR_TMPDIR ?? path.resolve(import.meta.dirname, '../../.airmentor-test-tmp')
  await mkdir(tmpBase, { recursive: true })
  const databaseDir = await mkdtemp(path.join(tmpBase, 'airmentor-postgres-test-'))
  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: message => {
      if (message) console.error(message)
    },
  })
  let pool: ReturnType<typeof createPool> | null = null

  try {
    await embeddedPostgres.initialise()
    await embeddedPostgres.start()

    const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
    pool = createPool(connectionString)
    const db = createDb(pool) as AppDb
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations')
    await runSqlMigrations(pool, migrationsDir)
    await seedIntoDatabase(db, pool, TEST_NOW, { profile: options?.seedProfile })

    const config = loadConfig({
      DATABASE_URL: connectionString,
      SESSION_COOKIE_SECURE: 'false',
      SESSION_COOKIE_SAME_SITE: 'lax',
      DEFAULT_THEME_MODE: 'frosted-focus-light',
      ...options?.env,
    })
    const app = await buildApp({
      config,
      db,
      pool,
      clock: () => TEST_NOW,
      emailTransport: options?.emailTransport,
    })
    await app.ready()
    const rawInject = app.inject.bind(app)
    app.inject = (async (options: string | InjectOptions) => {
      if (!options || typeof options === 'string') {
        return rawInject(options)
      }
      const method = (options.method ?? 'GET').toUpperCase()
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return rawInject(options)
      }
      const headers = { ...(options.headers ?? {}) } as Record<string, unknown>
      const sessionId = readCookieValue(headers.cookie, config.sessionCookieName)
      if (!sessionId) {
        return rawInject(options)
      }
      const csrfToken = buildCsrfToken(config.csrfSecret, sessionId)
      if (!readCookieValue(headers.cookie, config.csrfCookieName)) {
        headers.cookie = appendCookieValue(headers.cookie, config.csrfCookieName, csrfToken)
      }
      if (!headers['x-airmentor-csrf'] && !headers['X-AirMentor-CSRF']) {
        headers['x-airmentor-csrf'] = csrfToken
      }
      return rawInject({
        ...options,
        headers: headers as InjectOptions['headers'],
      })
    }) as typeof app.inject

    const activePool = pool
    return {
      app,
      rawInject,
      db,
      config,
      embeddedPostgres,
      pool: activePool,
      async close() {
        await app.close()
        await activePool.end()
        await embeddedPostgres.stop()
        await rm(databaseDir, { recursive: true, force: true })
      },
    }
  } catch (error) {
    if (pool) await pool.end()
    await embeddedPostgres.stop().catch(() => undefined)
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

// Persistent variant: postgres data survives process death.
// Used by the evaluator when AIRMENTOR_EVAL_DB_DIR is set so that a killed
// run can be resumed with AIRMENTOR_EVAL_SKIP_RECOMPUTE=1 without losing the
// 64-seed corpus or the trained artifacts.
export async function createPersistentTestApp(databaseDir: string) {
  await mkdir(databaseDir, { recursive: true })
  const port = await findFreePort()
  const alreadyInitialized = await access(path.join(databaseDir, 'PG_VERSION')).then(() => true).catch(() => false)

  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    onLog: () => {},
    onError: message => {
      if (message) console.error(message)
    },
  })

  let pool: ReturnType<typeof createPool> | null = null
  try {
    if (!alreadyInitialized) {
      await embeddedPostgres.initialise()
    }
    await embeddedPostgres.start()

    const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
    pool = createPool(connectionString)
    const db = createDb(pool) as AppDb
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations')
    await runSqlMigrations(pool, migrationsDir)

    if (!alreadyInitialized) {
      await seedIntoDatabase(db, pool, TEST_NOW)
    }

    const activePool = pool
    return {
      db,
      pool: activePool,
      embeddedPostgres,
      async close() {
        await activePool.end()
        await embeddedPostgres.stop()
        // Intentionally NOT removing databaseDir — persistence is the point.
      },
    }
  } catch (error) {
    if (pool) await pool.end()
    await embeddedPostgres.stop().catch(() => undefined)
    throw error
  }
}

export async function loginAs(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  identifier: string,
  password: string,
  options?: {
    demoWorkspaceId?: string | null
  },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session/login',
    headers: {
      origin: TEST_ORIGIN,
      ...(options?.demoWorkspaceId ? { 'x-airmentor-demo-workspace': options.demoWorkspaceId } : {}),
    },
    payload: { identifier, password },
  })
  const setCookie = response.headers['set-cookie']
  const setCookieValues = Array.isArray(setCookie) ? setCookie : [setCookie]
  const cookie = setCookieValues.find(value => readCookieValue(value ?? '', 'airmentor_session')) ?? setCookieValues[0]
  if (!cookie) {
    throw new Error(`Expected login for ${identifier} to return a session cookie`)
  }
  return {
    response,
    cookie,
    body: response.json(),
  }
}
