import { describe, expect, it, vi } from 'vitest'
import { emitClientOperationalEvent, normalizeClientTelemetryError, resolveClientTelemetrySinkUrl } from '../src/telemetry'

describe('client telemetry', () => {
  it('emits structured JSON lines when explicitly enabled', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    try {
      const event = emitClientOperationalEvent('startup.ready', {
        workspace: 'academic',
      }, {
        enabled: true,
        timestamp: '2026-03-27T00:00:00.000Z',
      })

      expect(event.name).toBe('startup.ready')
      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(String(infoSpy.mock.calls[0]?.[0] ?? '')).toContain('"type":"airmentor-client-event"')
      expect(String(infoSpy.mock.calls[0]?.[0] ?? '')).toContain('"workspace":"academic"')
    } finally {
      infoSpy.mockRestore()
    }
  })

  it('normalizes API-shaped errors without depending on the client class', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 })
    expect(normalizeClientTelemetryError(error)).toMatchObject({
      name: 'Error',
      message: 'Forbidden',
      status: 403,
    })
  })

  it('can mirror client events to a backend relay transport', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const transport = vi.fn()

    try {
      emitClientOperationalEvent('proof.dashboard_loaded', {
        batchId: 'batch_branch_mnc_btech_2023',
      }, {
        enabled: true,
        sinkUrl: 'https://api-production-ab72.up.railway.app/api/client-telemetry',
        transport,
        timestamp: '2026-03-29T00:00:00.000Z',
      })

      await Promise.resolve()

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(transport).toHaveBeenCalledTimes(1)
      expect(transport).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'proof.dashboard_loaded',
          level: 'info',
        }),
        'https://api-production-ab72.up.railway.app/api/client-telemetry',
        expect.stringContaining('"batchId":"batch_branch_mnc_btech_2023"'),
      )
    } finally {
      infoSpy.mockRestore()
    }
  })

  it('derives the backend relay endpoint from the configured API base URL', () => {
    expect(resolveClientTelemetrySinkUrl(undefined, 'https://api-production-ab72.up.railway.app')).toBe(
      'https://api-production-ab72.up.railway.app/api/client-telemetry',
    )
  })
})
