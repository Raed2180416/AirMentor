import { describe, expect, it, vi } from 'vitest'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '../src/telemetry'

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
})
