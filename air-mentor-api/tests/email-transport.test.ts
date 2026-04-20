import { afterEach, describe, expect, it } from 'vitest'
import { createNoopEmailTransport, type SendPasswordSetupEmailOptions } from '../src/lib/email-transport.js'
import { EmailRateLimiter } from '../src/lib/email-rate-limiter.js'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

const baseEmailOpts: SendPasswordSetupEmailOptions = {
  to: 'faculty@example.com',
  recipientName: 'Test Faculty',
  setupLink: 'http://127.0.0.1:5173/?password-setup-token=test-token#/app',
  purpose: 'invite',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  fromAddress: 'noreply@airmentor.example.com',
  fromName: 'AirMentor',
}

describe('EmailRateLimiter', () => {
  it('allows first request in fresh window', () => {
    const limiter = new EmailRateLimiter(60_000, 3)
    const result = limiter.check('a@b.com', 1000)
    expect(result.allowed).toBe(true)
  })

  it('blocks when max reached within window', () => {
    const limiter = new EmailRateLimiter(60_000, 2)
    limiter.check('a@b.com', 1000)
    limiter.check('a@b.com', 2000)
    const third = limiter.check('a@b.com', 3000)
    expect(third.allowed).toBe(false)
    if (!third.allowed) {
      expect(third.retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('resets window after expiry', () => {
    const limiter = new EmailRateLimiter(60_000, 1)
    limiter.check('a@b.com', 1000)
    limiter.check('a@b.com', 2000)
    // advance past window
    const afterWindow = limiter.check('a@b.com', 1000 + 60_001)
    expect(afterWindow.allowed).toBe(true)
  })

  it('tracks different keys independently', () => {
    const limiter = new EmailRateLimiter(60_000, 1)
    limiter.check('a@b.com', 1000)
    limiter.check('a@b.com', 2000)
    const other = limiter.check('b@b.com', 1000)
    expect(other.allowed).toBe(true)
  })

  it('reset clears key immediately', () => {
    const limiter = new EmailRateLimiter(60_000, 1)
    limiter.check('a@b.com', 1000)
    limiter.reset('a@b.com')
    const after = limiter.check('a@b.com', 1000)
    expect(after.allowed).toBe(true)
  })
})

describe('NoopEmailTransport', () => {
  it('returns delivered=false without throwing', async () => {
    const transport = createNoopEmailTransport()
    expect(transport.mode).toBe('noop')
    const result = await transport.sendPasswordSetupEmail(baseEmailOpts)
    expect(result.delivered).toBe(false)
  })

  it('handles reset purpose without error', async () => {
    const transport = createNoopEmailTransport()
    const result = await transport.sendPasswordSetupEmail({ ...baseEmailOpts, purpose: 'reset' })
    expect(result.delivered).toBe(false)
  })
})

describe('POST /api/admin/faculty/:facultyId/password-setup — email delivery', () => {
  let current: Awaited<ReturnType<typeof createTestApp>> | null = null

  afterEach(async () => {
    if (current) await current.close()
    current = null
  })

  it('returns emailDelivered=false and rateLimited=false with noop transport (default)', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const listRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/faculty',
      headers: { cookie: login.cookie },
    })
    const faculty = listRes.json().items.find((f: { displayName: string }) => f.displayName !== 'System Admin')
    expect(faculty).toBeTruthy()

    const res = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${faculty.facultyId}/password-setup`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.emailDelivered).toBe(false)
    expect(body.rateLimited).toBe(false)
    expect(typeof body.expiresAt).toBe('string')
    expect(typeof body.issuedToEmail).toBe('string')
  })

  it('returns emailDelivered=true when a mock transport is injected', async () => {
    const delivered: SendPasswordSetupEmailOptions[] = []
    const mockTransport = {
      mode: 'smtp' as const,
      async sendPasswordSetupEmail(opts: SendPasswordSetupEmailOptions) {
        delivered.push(opts)
        return { delivered: true }
      },
    }

    current = await createTestApp({ emailTransport: mockTransport })
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')

    const listRes = await current.app.inject({
      method: 'GET',
      url: '/api/admin/faculty',
      headers: { cookie: login.cookie },
    })
    const faculty = listRes.json().items.find((f: { displayName: string }) => f.displayName !== 'System Admin')
    expect(faculty).toBeTruthy()

    const res = await current.app.inject({
      method: 'POST',
      url: `/api/admin/faculty/${faculty.facultyId}/password-setup`,
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.emailDelivered).toBe(true)
    expect(body.rateLimited).toBe(false)
    expect(delivered).toHaveLength(1)
    expect(delivered[0]!.to).toBe(faculty.email)
    expect(delivered[0]!.purpose).toMatch(/^(invite|reset)$/)
    expect(delivered[0]!.setupLink).toContain('password-setup-token')
  })
})

describe('POST /api/session/password-setup/request — email delivery', () => {
  let current: Awaited<ReturnType<typeof createTestApp>> | null = null

  afterEach(async () => {
    if (current) await current.close()
    current = null
  })

  it('delivers email via injected mock transport on self-service request', async () => {
    const delivered: SendPasswordSetupEmailOptions[] = []
    const mockTransport = {
      mode: 'smtp' as const,
      async sendPasswordSetupEmail(opts: SendPasswordSetupEmailOptions) {
        delivered.push(opts)
        return { delivered: true }
      },
    }

    current = await createTestApp({ emailTransport: mockTransport })

    // kavitha.rao exists in seed data and has a password already → purpose = 'reset'
    const res = await current.app.inject({
      method: 'POST',
      url: '/api/session/password-setup/request',
      headers: { origin: TEST_ORIGIN },
      payload: { identifier: 'kavitha.rao' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(delivered).toHaveLength(1)
    expect(delivered[0]!.purpose).toBe('reset')
    expect(delivered[0]!.setupLink).toContain('password-setup-token')
  })

  it('returns ok=true even for unknown identifier (no user enumeration)', async () => {
    current = await createTestApp()

    const res = await current.app.inject({
      method: 'POST',
      url: '/api/session/password-setup/request',
      headers: { origin: TEST_ORIGIN },
      payload: { identifier: 'nonexistent.user.xyz' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
