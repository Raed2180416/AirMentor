import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { createDb, createPool, type AppDb } from '../src/db/client.js'
import { runSqlMigrations } from '../src/db/migrate.js'
import { seedIntoDatabase } from '../src/db/seed.js'
import { createNoopEmailTransport, createSmtpEmailTransport } from '../src/lib/email-transport.js'

const baseNow = process.env.AIRMENTOR_SEED_NOW ?? '2026-03-16T00:00:00.000Z'

function parsePort(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port')))
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

async function main() {
  const host = process.env.HOST ?? '127.0.0.1'
  const requestedApiPort = parsePort(process.env.AIRMENTOR_API_PORT ?? process.env.PORT, 0)
  const apiPort = requestedApiPort === 0 ? await findFreePort() : requestedApiPort
  const postgresPort = await findFreePort()
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'airmentor-postgres-live-'))
  const embeddedPostgres = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port: postgresPort,
    persistent: false,
    onLog: () => {},
    onError: message => {
      if (message) console.error(message)
    },
  })
  let pool: ReturnType<typeof createPool> | null = null
  let app: Awaited<ReturnType<typeof buildApp>> | null = null
  let shuttingDown = false

  const cleanup = async () => {
    if (shuttingDown) return
    shuttingDown = true
    if (app) await app.close().catch(() => undefined)
    if (pool) await pool.end().catch(() => undefined)
    await embeddedPostgres.stop().catch(() => undefined)
    await rm(databaseDir, { recursive: true, force: true }).catch(() => undefined)
  }

  const handleSignal = (signal: NodeJS.Signals) => {
    console.error(`[air-mentor-api] received ${signal}, shutting down seeded server...`)
    void cleanup().finally(() => process.exit(0))
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)

  try {
    console.error('[air-mentor-api] starting embedded postgres for seeded live server...')
    await embeddedPostgres.initialise()
    await embeddedPostgres.start()

    const connectionString = `postgres://postgres:postgres@127.0.0.1:${postgresPort}/postgres`
    pool = createPool(connectionString)
    const db = createDb(pool) as AppDb
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')
    await runSqlMigrations(pool, migrationsDir)
    await seedIntoDatabase(db, pool, baseNow)

    const config = loadConfig({
      ...process.env,
      DATABASE_URL: connectionString,
      HOST: host,
      PORT: String(apiPort),
      SESSION_COOKIE_SECURE: 'false',
      SESSION_COOKIE_SAME_SITE: 'lax',
      DEFAULT_THEME_MODE: 'frosted-focus-light',
    })

    const emailTransport = config.smtpHost
      ? await createSmtpEmailTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          user: config.smtpUser,
          pass: config.smtpPass,
          fromAddress: config.emailFromAddress,
          fromName: config.emailFromName,
        })
      : createNoopEmailTransport()

    app = await buildApp({
      config,
      db,
      pool,
      emailTransport,
      // Keep seeded academic data deterministic, but use wall-clock time for
      // runtime session expiry so live-browser logins do not receive already-
      // expired cookies as the fixed seed date ages.
      clock: () => new Date().toISOString(),
    })

    const apiBaseUrl = await app.listen({ port: config.port, host: config.host })
    const readyPayload = {
      type: 'airmentor-seeded-server-ready',
      apiBaseUrl,
      host: config.host,
      port: config.port,
      pid: process.pid,
      seedNow: baseNow,
    }

    if (process.env.AIRMENTOR_READY_FILE) {
      await writeFile(process.env.AIRMENTOR_READY_FILE, `${JSON.stringify(readyPayload)}\n`, 'utf8')
    }

    console.error(`[air-mentor-api] seeded live server ready at ${apiBaseUrl}`)
    console.log(JSON.stringify(readyPayload))
  } catch (error) {
    await cleanup()
    throw error
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
