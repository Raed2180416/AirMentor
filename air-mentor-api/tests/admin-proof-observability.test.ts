import { afterEach, describe, expect, it } from 'vitest'
import { persistOperationalEvent } from '../src/lib/telemetry.js'
import { MSRUAS_PROOF_BATCH_ID } from '../src/lib/msruas-proof-sandbox.js'
import { createTestApp, loginAs } from './helpers/test-app.js'

let current: Awaited<ReturnType<typeof createTestApp>> | null = null

afterEach(async () => {
  if (current) await current.close()
  current = null
})

describe('admin proof dashboard observability', () => {
  it('includes recent retained operational events in the proof dashboard payload', async () => {
    current = await createTestApp()
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    await persistOperationalEvent({
      source: 'backend',
      name: 'startup.ready',
      level: 'info',
      timestamp: '2026-03-29T00:00:00.000Z',
      details: {
        host: '0.0.0.0',
        sessionCookieSecure: true,
      },
    })

    const response = await current.app.inject({
      method: 'GET',
      url: `/api/admin/batches/${MSRUAS_PROOF_BATCH_ID}/proof-dashboard`,
      headers: {
        cookie: adminLogin.cookie,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().recentOperationalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'backend',
          name: 'startup.ready',
          level: 'info',
        }),
      ]),
    )
  })
})
