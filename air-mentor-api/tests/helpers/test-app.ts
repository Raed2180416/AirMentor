import path from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import { buildApp } from '../../src/app.js'
import { loadConfig } from '../../src/config.js'
import { createDb, createPool, type AppDb } from '../../src/db/client.js'
import { runSqlMigrations } from '../../src/db/migrate.js'
import { seedIntoDatabase } from '../../src/db/seed.js'

const baseNow = '2026-03-16T00:00:00.000Z'
export const TEST_ORIGIN = 'http://127.0.0.1:5173'

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
}) {
  const port = await findFreePort()
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-test-'))
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
    await seedIntoDatabase(db, pool, baseNow)

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
      clock: () => baseNow,
    })
    await app.ready()

    return {
      app,
      db,
      embeddedPostgres,
      pool,
      async close() {
        await app.close()
        await pool.end()
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

export async function loginAs(app: Awaited<ReturnType<typeof createTestApp>>['app'], identifier: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session/login',
    headers: {
      origin: TEST_ORIGIN,
    },
    payload: { identifier, password },
  })
  const setCookie = response.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  return {
    response,
    cookie,
    body: response.json(),
  }
}
