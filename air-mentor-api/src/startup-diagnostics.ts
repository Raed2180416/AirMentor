import type { AppConfig } from './config.js'

export type StartupDiagnostic = {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim())
}

export function isProductionLikeTarget(config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production') return true
  return config.corsAllowedOrigins.some(origin => !isLocalOrigin(origin))
}

export function collectStartupDiagnostics(config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  const diagnostics: StartupDiagnostic[] = []
  const productionLike = isProductionLikeTarget(config, env)
  const nonLocalOrigins = config.corsAllowedOrigins.filter(origin => !isLocalOrigin(origin))
  const hasGithubPagesOrigin = nonLocalOrigins.some(origin => origin.includes('github.io'))
  const usingDefaultLocalDatabase = /127\.0\.0\.1:5432\/airmentor$/i.test(config.databaseUrl)

  diagnostics.push({
    level: 'info',
    code: 'STARTUP_MODE',
    message: productionLike
      ? 'Running with production-like origin and cookie expectations.'
      : 'Running with local-first origin and cookie expectations.',
  })

  if (config.corsAllowedOrigins.length === 0) {
    diagnostics.push({
      level: 'error',
      code: 'CORS_ALLOWED_ORIGINS_EMPTY',
      message: 'At least one allowed frontend origin must be configured.',
    })
  }

  if (config.sessionCookieSameSite === 'none' && !config.sessionCookieSecure) {
    diagnostics.push({
      level: 'error',
      code: 'COOKIE_NONE_WITHOUT_SECURE',
      message: 'SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true.',
    })
  }

  if (hasGithubPagesOrigin && config.sessionCookieSameSite !== 'none') {
    diagnostics.push({
      level: 'error',
      code: 'GITHUB_PAGES_REQUIRES_SAMESITE_NONE',
      message: 'GitHub Pages cross-origin sessions require SESSION_COOKIE_SAME_SITE=none.',
    })
  }

  if (productionLike && !config.sessionCookieSecure) {
    diagnostics.push({
      level: 'error',
      code: 'PRODUCTION_LIKE_REQUIRES_SECURE_COOKIE',
      message: 'Production-like origins require SESSION_COOKIE_SECURE=true.',
    })
  }

  if (productionLike && !config.csrfSecretConfigured) {
    diagnostics.push({
      level: 'error',
      code: 'CSRF_SECRET_REQUIRED',
      message: 'Production-like deployments must set an explicit CSRF_SECRET.',
    })
  }

  if (productionLike && config.host === '127.0.0.1') {
    diagnostics.push({
      level: 'warning',
      code: 'HOST_LOOPBACK_IN_PRODUCTION_LIKE_MODE',
      message: 'HOST is still set to 127.0.0.1 while non-local origins are configured.',
    })
  }

  if (productionLike && usingDefaultLocalDatabase) {
    diagnostics.push({
      level: 'warning',
      code: 'DATABASE_URL_DEFAULT_LOCAL',
      message: 'DATABASE_URL still points at the default local Postgres connection string.',
    })
  }

  return diagnostics
}

export function assertStartupDiagnostics(config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  const diagnostics = collectStartupDiagnostics(config, env)
  const errors = diagnostics.filter(item => item.level === 'error')
  if (errors.length > 0) {
    const summary = errors.map(item => `${item.code}: ${item.message}`).join(' | ')
    throw new Error(`Startup diagnostics failed: ${summary}`)
  }
  return diagnostics
}
