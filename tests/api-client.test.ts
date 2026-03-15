import { describe, expect, it, vi } from 'vitest'
import { AirMentorApiClient, AirMentorApiError } from '../src/api/client'

describe('AirMentorApiClient', () => {
  it('sends JSON requests with cookies included', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({
      userId: 'user-1',
      themeMode: 'frosted-focus-dark',
      version: 2,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000/', fetchMock as typeof fetch)
    const result = await client.saveUiPreferences({
      themeMode: 'frosted-focus-dark',
      version: 1,
    })

    expect(result.themeMode).toBe('frosted-focus-dark')
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/preferences/ui', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
    }))
  })

  it('throws an API error for non-2xx responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      error: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)

    await expect(client.login({ identifier: 'sysadmin', password: 'wrong' })).rejects.toBeInstanceOf(AirMentorApiError)
  })
})
