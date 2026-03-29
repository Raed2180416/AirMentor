import { operationalTelemetryEvents } from '../src/db/schema.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp, loginAs, TEST_ORIGIN } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
  vi.restoreAllMocks()
})

describe('client telemetry relay', () => {
  it('accepts frontend telemetry and relays it to the configured sink', async () => {
    current = await createTestApp({
      env: {
        AIRMENTOR_TELEMETRY_SINK_URL: 'https://telemetry.example.com/collect',
        AIRMENTOR_TELEMETRY_SINK_BEARER_TOKEN: 'relay-secret',
      },
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

    const response = await current.app.inject({
      method: 'POST',
      url: '/api/client-telemetry',
      headers: {
        origin: TEST_ORIGIN,
      },
      payload: {
        type: 'airmentor-client-event',
        name: 'proof.dashboard_loaded',
        level: 'info',
        timestamp: '2026-03-29T00:00:00.000Z',
        details: {
          batchId: 'batch_branch_mnc_btech_2023',
        },
      },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      accepted: true,
      relayed: true,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [sinkUrl, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(sinkUrl).toBe('https://telemetry.example.com/collect')
    expect(new Headers(requestInit.headers).get('authorization')).toBe('Bearer relay-secret')
    expect(requestInit.body).toContain('"name":"proof.dashboard_loaded"')
    expect(requestInit.body).toContain('"batchId":"batch_branch_mnc_btech_2023"')
    const persisted = await current.db.select().from(operationalTelemetryEvents)
    expect(persisted.some(item => item.source === 'client' && item.name === 'proof.dashboard_loaded')).toBe(true)
  })

  it('allows authenticated sessions to post telemetry without a CSRF token', async () => {
    current = await createTestApp()
    const login = await loginAs(current.app, 'sysadmin', 'admin1234')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }))

    const response = await current.rawInject({
      method: 'POST',
      url: '/api/client-telemetry',
      headers: {
        cookie: login.cookie,
        origin: TEST_ORIGIN,
      },
      payload: {
        type: 'airmentor-client-event',
        name: 'proof.dashboard_loaded',
        level: 'info',
        timestamp: '2026-03-29T00:00:00.000Z',
      },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      accepted: true,
      relayed: false,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
