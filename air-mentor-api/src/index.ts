import { createPool, createDb } from './db/client.js'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { emitOperationalEvent, configureOperationalTelemetryPersistence } from './lib/telemetry.js'
import { persistOperationalTelemetryEvent } from './lib/operational-event-store.js'
import { assertStartupDiagnostics } from './startup-diagnostics.js'
import { createNoopEmailTransport, createSmtpEmailTransport } from './lib/email-transport.js'

async function main() {
  const config = loadConfig()
  const pool = createPool(config.databaseUrl)
  const db = createDb(pool)
  const disposeTelemetryPersistence = configureOperationalTelemetryPersistence(event =>
    persistOperationalTelemetryEvent(db, event),
  )
  const diagnostics = assertStartupDiagnostics(config)
  diagnostics.forEach(diagnostic => {
    emitOperationalEvent('startup.diagnostic', diagnostic, {
      level: diagnostic.level === 'error' ? 'error' : diagnostic.level === 'warning' ? 'warn' : 'info',
    })
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
  try {
    const app = await buildApp({ config, db, pool, emailTransport })
    await app.listen({ port: config.port, host: config.host })
    emitOperationalEvent('startup.ready', {
      host: config.host,
      port: config.port,
      corsAllowedOrigins: config.corsAllowedOrigins,
      telemetrySinkConfigured: Boolean(config.telemetrySinkUrl),
      sessionCookieSecure: config.sessionCookieSecure,
      sessionCookieSameSite: config.sessionCookieSameSite,
    })
  } catch (error) {
    disposeTelemetryPersistence()
    await pool.end().catch(() => undefined)
    throw error
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
