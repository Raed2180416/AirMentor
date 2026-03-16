import { afterEach, describe, expect, it } from 'vitest'
import { AirMentorApiClient } from '../../src/api/client.js'
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

    const client = new AirMentorApiClient(address, cookieAwareFetch)
    const session = await client.login({ identifier: 'sysadmin', password: 'admin1234' })
    expect(session.user.username).toBe('sysadmin')

    const restored = await client.restoreSession()
    expect(restored.faculty?.facultyId).toBe('fac_sysadmin')

    const hodGrant = restored.availableRoleGrants.find((grant: { roleCode: string }) => grant.roleCode === 'HOD')
    expect(hodGrant).toBeTruthy()
    const switched = await client.switchRoleContext(hodGrant!.grantId)
    expect(switched.activeRoleGrant.roleCode).toBe('HOD')
  })
})
