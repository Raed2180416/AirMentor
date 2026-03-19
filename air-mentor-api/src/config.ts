import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type AppConfig = {
  databaseUrl: string
  port: number
  host: string
  corsAllowedOrigins: string[]
  sessionCookieName: string
  sessionCookieSecure: boolean
  sessionCookieSameSite: 'lax' | 'strict' | 'none'
  sessionTtlHours: number
  defaultThemeMode: string
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? env.RAILWAY_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/airmentor',
    port: parseNumber(env.PORT, 4000),
    host: env.HOST ?? '127.0.0.1',
    corsAllowedOrigins: parseStringList(env.CORS_ALLOWED_ORIGINS, [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
    ]),
    sessionCookieName: env.SESSION_COOKIE_NAME ?? 'airmentor_session',
    sessionCookieSecure: parseBoolean(env.SESSION_COOKIE_SECURE, false),
    sessionCookieSameSite: parseSameSite(env.SESSION_COOKIE_SAME_SITE, 'lax'),
    sessionTtlHours: parseNumber(env.SESSION_TTL_HOURS, 24 * 7),
    defaultThemeMode: env.DEFAULT_THEME_MODE ?? 'frosted-focus-light',
  }
}
