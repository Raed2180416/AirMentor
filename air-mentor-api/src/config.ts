import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type AppConfig = {
  databaseUrl: string
  port: number
  host: string
  corsAllowedOrigins: string[]
  passwordSetupBaseUrl: string
  passwordSetupPreviewEnabled: boolean
  passwordSetupTtlHours: number
  telemetrySinkUrl: string | null
  telemetrySinkBearerToken: string | null
  sessionCookieName: string
  csrfCookieName: string
  csrfSecret: string
  csrfSecretConfigured: boolean
  sessionCookieSecure: boolean
  sessionCookieSameSite: 'lax' | 'strict' | 'none'
  sessionTtlHours: number
  loginRateLimitWindowMs: number
  loginRateLimitMaxAttempts: number
  defaultThemeMode: string
  smtpHost: string | null
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string | null
  smtpPass: string | null
  emailFromAddress: string
  emailFromName: string
  passwordSetupEmailRateLimitWindowMs: number
  passwordSetupEmailRateLimitMax: number
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(packageRoot, envFile)
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
  }
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback
  return value === 'true'
}

function parseNumber(value: string | undefined, fallback: number) {
  if (value == null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseStringList(value: string | undefined, fallback: string[]) {
  if (value == null) return fallback
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseSameSite(value: string | undefined, fallback: 'lax' | 'strict' | 'none') {
  if (value == null) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') return normalized
  return fallback
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin.trim())
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL ?? env.RAILWAY_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/airmentor'
  const sessionCookieName = env.SESSION_COOKIE_NAME ?? 'airmentor_session'
  const corsAllowedOrigins = parseStringList(env.CORS_ALLOWED_ORIGINS, [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ])
  const productionLikeTarget = env.NODE_ENV === 'production'
    || corsAllowedOrigins.some(origin => !isLocalOrigin(origin))
  const sessionCookieSameSite = parseSameSite(
    env.SESSION_COOKIE_SAME_SITE,
    productionLikeTarget ? 'none' : 'lax',
  )
  const sessionCookieSecure = parseBoolean(
    env.SESSION_COOKIE_SECURE,
    productionLikeTarget || sessionCookieSameSite === 'none',
  )
  const passwordSetupBaseUrl = (env.PASSWORD_SETUP_BASE_URL ?? corsAllowedOrigins[0] ?? 'http://127.0.0.1:5173').trim()
  const passwordSetupPreviewEnabled = parseBoolean(
    env.PASSWORD_SETUP_PREVIEW_ENABLED,
    corsAllowedOrigins.every(isLocalOrigin),
  )
  return {
    databaseUrl,
    port: parseNumber(env.PORT, 4000),
    host: env.HOST ?? (productionLikeTarget ? '0.0.0.0' : '127.0.0.1'),
    corsAllowedOrigins,
    passwordSetupBaseUrl,
    passwordSetupPreviewEnabled,
    passwordSetupTtlHours: parseNumber(env.PASSWORD_SETUP_TTL_HOURS, 24),
    telemetrySinkUrl: env.AIRMENTOR_TELEMETRY_SINK_URL?.trim() || null,
    telemetrySinkBearerToken: env.AIRMENTOR_TELEMETRY_SINK_BEARER_TOKEN?.trim() || null,
    sessionCookieName,
    csrfCookieName: env.CSRF_COOKIE_NAME ?? 'airmentor_csrf',
    csrfSecret: env.CSRF_SECRET ?? `${databaseUrl}::${sessionCookieName}`,
    csrfSecretConfigured: Boolean(env.CSRF_SECRET),
    sessionCookieSecure,
    sessionCookieSameSite,
    sessionTtlHours: parseNumber(env.SESSION_TTL_HOURS, 24 * 7),
    loginRateLimitWindowMs: parseNumber(env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    loginRateLimitMaxAttempts: parseNumber(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 8),
    defaultThemeMode: env.DEFAULT_THEME_MODE ?? 'frosted-focus-light',
    smtpHost: env.SMTP_HOST?.trim() || null,
    smtpPort: parseNumber(env.SMTP_PORT, 587),
    smtpSecure: parseBoolean(env.SMTP_SECURE, false),
    smtpUser: env.SMTP_USER?.trim() || null,
    smtpPass: env.SMTP_PASS?.trim() || null,
    emailFromAddress: env.EMAIL_FROM_ADDRESS?.trim() || 'noreply@airmentor.example.com',
    emailFromName: env.EMAIL_FROM_NAME?.trim() || 'AirMentor',
    passwordSetupEmailRateLimitWindowMs: parseNumber(env.PASSWORD_SETUP_EMAIL_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    passwordSetupEmailRateLimitMax: parseNumber(env.PASSWORD_SETUP_EMAIL_RATE_LIMIT_MAX, 3),
  }
}
