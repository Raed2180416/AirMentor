import { createPool, createDb } from './db/client.js'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { emitOperationalEvent } from './lib/telemetry.js'
import { assertStartupDiagnostics } from './startup-diagnostics.js'

async function main() {
  const config = loadConfig()
  const diagnostics = assertStartupDiagnostics(config)
  diagnostics.forEach(diagnostic => {
    emitOperationalEvent('startup.diagnostic', diagnostic, {
      level: diagnostic.level === 'error' ? 'error' : diagnostic.level === 'warning' ? 'warn' : 'info',
    })
  })
  const pool = createPool(config.databaseUrl)
  const db = createDb(pool)
  const app = await buildApp({ config, db, pool })
  await app.listen({ port: config.port, host: config.host })
  emitOperationalEvent('startup.ready', {
    host: config.host,
    port: config.port,
    corsAllowedOrigins: config.corsAllowedOrigins,
    sessionCookieSecure: config.sessionCookieSecure,
    sessionCookieSameSite: config.sessionCookieSameSite,
  })
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
