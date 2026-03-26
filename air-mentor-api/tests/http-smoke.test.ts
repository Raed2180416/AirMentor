import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('http smoke', () => {
  it('logs in, restores session, and switches role context through the frontend client', async () => {
    current = await createTestApp()
    const address = await current.app.listen({ port: 0, host: '127.0.0.1' })
    let cookieHeader = ''

    const cookieAwareFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('origin', TEST_ORIGIN)
      if (cookieHeader) headers.set('cookie', cookieHeader)
      const response = await fetch(input, { ...init, headers })
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) {
        cookieHeader = setCookie.split(';')[0]
      }
      return response
    }

    const apiFetch = async <T>(path: string, init?: RequestInit) => {
      const response = await cookieAwareFetch(`${address}${path}`, init)
      expect(response.ok).toBe(true)
      return response.json() as Promise<T>
    }

    const session = await apiFetch<{
      user: { username: string }
      availableRoleGrants: Array<{ grantId: string; roleCode: string }>
    }>('/api/session/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ identifier: 'sysadmin', password: 'admin1234' }),
    })
    expect(session.user.username).toBe('sysadmin')

    const restored = await apiFetch<{
      faculty: { facultyId: string } | null
      availableRoleGrants: Array<{ grantId: string; roleCode: string }>
      activeRoleGrant: { roleCode: string }
    }>('/api/session', {
      method: 'GET',
    })
    expect(restored.faculty?.facultyId).toBe('fac_sysadmin')

    const hodGrant = restored.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')
    expect(hodGrant).toBeTruthy()
    const switched = await apiFetch<{
      activeRoleGrant: { roleCode: string }
    }>('/api/session/role-context', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roleGrantId: hodGrant!.grantId }),
    })
    expect(switched.activeRoleGrant.roleCode).toBe('HOD')
  })
})
