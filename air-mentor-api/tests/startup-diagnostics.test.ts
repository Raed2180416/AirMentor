import { describe, expect, it } from 'vitest'
import { collectStartupDiagnostics, isProductionLikeTarget } from '../src/startup-diagnostics.js'
import type { AppConfig } from '../src/config.js'

function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/airmentor',
    port: 4000,
    host: '127.0.0.1',
    corsAllowedOrigins: ['http://127.0.0.1:5173'],
    passwordSetupBaseUrl: 'http://127.0.0.1:5173',
    passwordSetupPreviewEnabled: true,
    passwordSetupTtlHours: 24,
    telemetrySinkUrl: null,
    telemetrySinkBearerToken: null,
    sessionCookieName: 'airmentor_session',
    csrfCookieName: 'airmentor_csrf',
    csrfSecret: 'test-csrf-secret',
    csrfSecretConfigured: true,
    sessionCookieSecure: false,
    sessionCookieSameSite: 'lax',
    sessionTtlHours: 24 * 7,
    loginRateLimitWindowMs: 15 * 60 * 1000,
    loginRateLimitMaxAttempts: 8,
    defaultThemeMode: 'frosted-focus-light',
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: null,
    smtpPass: null,
    emailFromAddress: 'noreply@airmentor.example.com',
    emailFromName: 'AirMentor',
    passwordSetupEmailRateLimitWindowMs: 10 * 60 * 1000,
    passwordSetupEmailRateLimitMax: 3,
    ...overrides,
  }
}

describe('startup diagnostics', () => {
  it('treats non-local origins as production-like', () => {
    expect(isProductionLikeTarget(createConfig({
      corsAllowedOrigins: ['https://raed2180416.github.io'],
    }))).toBe(true)
    expect(isProductionLikeTarget(createConfig())).toBe(false)
  })

  it('flags invalid GitHub Pages cookie posture as a startup error', () => {
    const diagnostics = collectStartupDiagnostics(createConfig({
      corsAllowedOrigins: ['https://raed2180416.github.io'],
      sessionCookieSecure: false,
      sessionCookieSameSite: 'lax',
    }))

    expect(diagnostics.filter(item => item.level === 'error').map(item => item.code)).toEqual([
      'GITHUB_PAGES_REQUIRES_SAMESITE_NONE',
      'PRODUCTION_LIKE_REQUIRES_SECURE_COOKIE',
    ])
  })

  it('accepts the expected Pages plus Railway cookie posture', () => {
    const diagnostics = collectStartupDiagnostics(createConfig({
      corsAllowedOrigins: ['https://raed2180416.github.io'],
      csrfSecretConfigured: true,
      sessionCookieSecure: true,
      sessionCookieSameSite: 'none',
      host: '0.0.0.0',
      databaseUrl: 'postgres://railway.internal/airmentor',
    }))

    expect(diagnostics.some(item => item.level === 'error')).toBe(false)
  })

  it('requires an explicit csrf secret for production-like targets', () => {
    const diagnostics = collectStartupDiagnostics(createConfig({
      corsAllowedOrigins: ['https://raed2180416.github.io'],
      csrfSecretConfigured: false,
      sessionCookieSecure: true,
      sessionCookieSameSite: 'none',
      host: '0.0.0.0',
      databaseUrl: 'postgres://railway.internal/airmentor',
    }))

    expect(diagnostics.filter(item => item.level === 'error').map(item => item.code)).toContain('CSRF_SECRET_REQUIRED')
  })

  it('does not warn when production-like deployments rely on local telemetry retention without an external sink', () => {
    const diagnostics = collectStartupDiagnostics(createConfig({
      corsAllowedOrigins: ['https://raed2180416.github.io'],
      telemetrySinkUrl: null,
      telemetrySinkBearerToken: null,
      sessionCookieSecure: true,
      sessionCookieSameSite: 'none',
      host: '0.0.0.0',
      databaseUrl: 'postgres://railway.internal/airmentor',
    }))

    expect(diagnostics.some(item => item.code === 'TELEMETRY_SINK_NOT_CONFIGURED')).toBe(false)
  })
})
