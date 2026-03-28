import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('keeps local development cookie defaults unchanged', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/airmentor',
    })

    expect(config.sessionCookieSecure).toBe(false)
    expect(config.sessionCookieSameSite).toBe('lax')
    expect(config.csrfSecretConfigured).toBe(false)
  })

  it('defaults production-like origins to secure SameSite=None cookies', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://railway.internal/airmentor',
      CORS_ALLOWED_ORIGINS: 'https://raed2180416.github.io',
      CSRF_SECRET: 'configured-secret',
    })

    expect(config.sessionCookieSecure).toBe(true)
    expect(config.sessionCookieSameSite).toBe('none')
    expect(config.csrfSecretConfigured).toBe(true)
    expect(config.host).toBe('0.0.0.0')
  })

  it('respects explicit cookie overrides', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://railway.internal/airmentor',
      CORS_ALLOWED_ORIGINS: 'https://raed2180416.github.io',
      CSRF_SECRET: 'configured-secret',
      SESSION_COOKIE_SECURE: 'false',
      SESSION_COOKIE_SAME_SITE: 'strict',
    })

    expect(config.sessionCookieSecure).toBe(false)
    expect(config.sessionCookieSameSite).toBe('strict')
  })
})
