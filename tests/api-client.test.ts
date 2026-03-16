import { describe, expect, it, vi } from 'vitest'
import { AirMentorApiClient, AirMentorApiError } from '../src/api/client'

describe('AirMentorApiClient', () => {
  it('binds the default global fetch to the window/global scope', async () => {
    const fetchMock = vi.fn(async function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
      expect(this).toBe(globalThis)
      return new Response(JSON.stringify({
        userId: 'user-1',
        themeMode: 'frosted-focus-light',
        version: 1,
        updatedAt: '2026-03-16T00:00:00.000Z',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    vi.stubGlobal('fetch', fetchMock as typeof fetch)

    try {
      const client = new AirMentorApiClient('http://127.0.0.1:4000')
      const result = await client.getUiPreferences()
      expect(result.themeMode).toBe('frosted-focus-light')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

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

  it('does not send a JSON content-type header for bodyless requests like logout', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, {
      status: 204,
    }))

    const client = new AirMentorApiClient('http://127.0.0.1:4000', fetchMock as typeof fetch)
    await client.logout()

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/session', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
      headers: {},
    }))
  })
})
