import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

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

    const restore = await current.app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: login.cookie },
    })
    expect(restore.statusCode).toBe(200)
    expect(restore.json().user.username).toBe('sysadmin')

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
})
