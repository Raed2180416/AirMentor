import { buildApp } from '../src/app.js'
import { loginRateLimitWindows } from '../src/db/schema.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_NOW, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('session routes', () => {
  it('allows the Vite dev origin to call session routes with credentials', async () => {
    current = await createTestApp()

    const response = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: 'http://127.0.0.1:5173',
      },
      payload: {
        identifier: 'sysadmin',
        password: 'admin1234',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.json().csrfToken).toEqual(expect.any(String))
  })

  it('supports GitHub Pages cross-origin login with secure SameSite=None cookies', async () => {
    current = await createTestApp({
      env: {
        CORS_ALLOWED_ORIGINS: 'https://raed2180416.github.io',
        SESSION_COOKIE_SECURE: 'true',
        SESSION_COOKIE_SAME_SITE: 'none',
      },
    })

    const response = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: {
        origin: 'https://raed2180416.github.io',
      },
      payload: {
        identifier: 'sysadmin',
        password: 'admin1234',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('https://raed2180416.github.io')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.json().csrfToken).toEqual(expect.any(String))
    const setCookie = response.headers['set-cookie']
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieHeader).toContain('Secure')
    expect(cookieHeader).toContain('SameSite=None')
  })

  it('logs in, restores session, switches role context, and logs out', async () => {
    current = await createTestApp()

    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(login.response.statusCode).toBe(200)
    expect(login.body.activeRoleGrant.roleCode).toBe('SYSTEM_ADMIN')
    expect(login.body.availableRoleGrants).toHaveLength(2)
    expect(login.body.csrfToken).toEqual(expect.any(String))

    const restore = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: login.cookie },
    })
    expect(restore.statusCode).toBe(200)
    expect(restore.json().user.username).toBe('sysadmin')
    expect(restore.json().csrfToken).toEqual(expect.any(String))

    const nextGrantId = login.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(nextGrantId).toBeTruthy()

    const switched = await current.app.inject({
      method: 'POST',
      url: '/api/session/role-context',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { roleGrantId: nextGrantId },
    })
    expect(switched.statusCode).toBe(200)
    expect(switched.json().activeRoleGrant.roleCode).toBe('HOD')

    const logout = await current.app.inject({
      method: 'DELETE',
      url: '/api/session',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
    })
    expect(logout.statusCode).toBe(200)

    const afterLogout = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: login.cookie },
    })
    expect(afterLogout.statusCode).toBe(401)
  })

  it('chooses a deterministic default academic role on login for multi-role faculty', async () => {
    current = await createTestApp()

    const login = await loginAs(current.app, 'devika.shetty', 'faculty1234')
    expect(login.response.statusCode).toBe(200)
    expect(login.body.activeRoleGrant.roleCode).toBe('COURSE_LEADER')
    expect(login.body.availableRoleGrants.map((grant: { roleCode: string }) => grant.roleCode)).toEqual([
      'COURSE_LEADER',
      'MENTOR',
      'HOD',
    ])
  })

  it('guards system-admin routes from non-admin role contexts', async () => {
    current = await createTestApp()

    const login = await loginAs(current.app, 'kavitha.rao', '1234')
    const response = await current.app.inject({
      method: 'GET',
      url: '/api/admin/departments',
      headers: { cookie: login.cookie },
    })

    expect(response.statusCode).toBe(403)
  })

  it('rejects authenticated mutations that do not include a CSRF token', async () => {
    current = await createTestApp()

    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const nextGrantId = login.body.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')?.grantId
    expect(nextGrantId).toBeTruthy()

    const switched = await current.rawInject({
      method: 'POST',
      url: '/api/session/role-context',
      headers: { cookie: login.cookie, origin: TEST_ORIGIN },
      payload: { roleGrantId: nextGrantId },
    })

    expect(switched.statusCode).toBe(403)
    expect(switched.json()).toMatchObject({
      error: 'FORBIDDEN_CSRF',
    })
  })

  it('rate limits repeated failed login attempts', async () => {
    current = await createTestApp({
      env: {
        LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '2',
        LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      },
    })

    const attempt = () => current!.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: { origin: TEST_ORIGIN },
      payload: {
        identifier: 'sysadmin',
        password: 'wrong-password',
      },
    })

    expect((await attempt()).statusCode).toBe(401)
    expect((await attempt()).statusCode).toBe(401)

    const third = await attempt()
    expect(third.statusCode).toBe(429)
    expect(third.json()).toMatchObject({
      error: 'TOO_MANY_REQUESTS',
    })
  })

  it('persists failed login buckets in the database and clears them after a successful login', async () => {
    current = await createTestApp({
      env: {
        LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '4',
        LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      },
    })

    const failed = await current.app.inject({
      method: 'POST',
      url: '/api/session/login',
      headers: { origin: TEST_ORIGIN },
      payload: {
        identifier: 'sysadmin',
        password: 'wrong-password',
      },
    })
    expect(failed.statusCode).toBe(401)

    const persistedFailures = await current.db.select().from(loginRateLimitWindows)
    expect(persistedFailures).toHaveLength(1)
    expect(persistedFailures[0]?.failureCount).toBe(1)

    const success = await loginAs(current.app, 'sysadmin', 'admin1234')
    expect(success.response.statusCode).toBe(200)

    const remainingFailures = await current.db.select().from(loginRateLimitWindows)
    expect(remainingFailures).toEqual([])
  })

  it('shares login throttling across app instances through the database', async () => {
    current = await createTestApp({
      env: {
        LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '2',
        LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
      },
    })
    const siblingApp = await buildApp({
      config: current.config,
      db: current.db,
      pool: current.pool,
      clock: () => TEST_NOW,
    })
    await siblingApp.ready()

    try {
      const attemptPrimary = () => current!.app.inject({
        method: 'POST',
        url: '/api/session/login',
        headers: { origin: TEST_ORIGIN },
        payload: {
          identifier: 'sysadmin',
          password: 'wrong-password',
        },
      })
      const attemptSibling = () => siblingApp.inject({
        method: 'POST',
        url: '/api/session/login',
        headers: { origin: TEST_ORIGIN },
        payload: {
          identifier: 'sysadmin',
          password: 'wrong-password',
        },
      })

      expect((await attemptPrimary()).statusCode).toBe(401)
      expect((await attemptSibling()).statusCode).toBe(401)

      const third = await attemptPrimary()
      expect(third.statusCode).toBe(429)
      expect(third.json()).toMatchObject({
        error: 'TOO_MANY_REQUESTS',
      })
    } finally {
      await siblingApp.close()
    }
  })
})
