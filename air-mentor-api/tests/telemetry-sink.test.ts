import { afterEach, describe, expect, it, vi } from 'vitest'
import { emitOperationalEvent } from '../src/lib/telemetry.js'

describe('operational telemetry sink', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalTelemetryEnabled = process.env.AIRMENTOR_TELEMETRY_ENABLED

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = originalNodeEnv
    process.env.AIRMENTOR_TELEMETRY_ENABLED = originalTelemetryEnabled
  })

  it('forwards structured backend events to the configured sink through the dispatch hook', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const dispatch = vi.fn(async () => {})
    process.env.NODE_ENV = 'development'
    process.env.AIRMENTOR_TELEMETRY_ENABLED = 'true'

    try {
      const payload = emitOperationalEvent('startup.ready', {
        workspace: 'api',
      }, {
        level: 'info',
        timestamp: '2026-03-29T00:00:00.000Z',
        sinkUrl: 'https://telemetry.example.test/intake',
        dispatch,
      })

      expect(payload?.name).toBe('startup.ready')
      expect(infoSpy).toHaveBeenCalledTimes(1)
      await Promise.resolve()
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith(
        'https://telemetry.example.test/intake',
        expect.stringContaining('"name":"startup.ready"'),
        undefined,
      )
    } finally {
      infoSpy.mockRestore()
    }
  })
})
