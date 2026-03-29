import { describe, expect, it, vi } from 'vitest'
import { operationalTelemetryEvents } from '../src/db/schema.js'
import { emitOperationalEvent, forwardTelemetryPayload, normalizeTelemetryError } from '../src/lib/telemetry.js'
import { createTestApp, TEST_ORIGIN } from './helpers/test-app.js'

describe('backend telemetry', () => {
  it('normalizes thrown errors into structured payloads', () => {
    const normalized = normalizeTelemetryError(Object.assign(new Error('Nope'), { code: 'NOPE' }))
    expect(normalized).toMatchObject({
      name: 'Error',
      message: 'Nope',
      code: 'NOPE',
    })
  })

  it('emits structured JSON with a level field', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const previousNodeEnv = process.env.NODE_ENV
    const previousTelemetryEnabled = process.env.AIRMENTOR_TELEMETRY_ENABLED

    try {
      process.env.NODE_ENV = 'development'
      process.env.AIRMENTOR_TELEMETRY_ENABLED = 'true'
      const payload = emitOperationalEvent('security.csrf.rejected', {
        route: '/api/session/role-context',
      }, {
        level: 'warn',
        timestamp: '2026-03-29T00:00:00.000Z',
      })

      expect(payload).toMatchObject({
        name: 'security.csrf.rejected',
        level: 'warn',
      })
      expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain('"level":"warn"')
    } finally {
      process.env.NODE_ENV = previousNodeEnv
      process.env.AIRMENTOR_TELEMETRY_ENABLED = previousTelemetryEnabled
      warnSpy.mockRestore()
    }
  })

  it('can mirror backend telemetry payloads to an external sink dispatch', async () => {
    const dispatch = vi.fn()
    const payload = {
      type: 'airmentor-operational-event',
      name: 'startup.ready',
      level: 'info',
      timestamp: '2026-03-29T00:00:00.000Z',
      details: {
        host: '0.0.0.0',
      },
    }

    const relayed = await forwardTelemetryPayload(payload, 'https://ops.example/ingest', {
      bearerToken: 'relay-secret',
      dispatch,
    })

    expect(relayed).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      'https://ops.example/ingest',
      expect.stringContaining('"name":"startup.ready"'),
      'relay-secret',
    )
  })

  it('still emits structured JSON when production telemetry is enabled', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const dispatch = vi.fn()
    const previousNodeEnv = process.env.NODE_ENV
    const previousTelemetryEnabled = process.env.AIRMENTOR_TELEMETRY_ENABLED

    try {
      process.env.NODE_ENV = 'development'
      process.env.AIRMENTOR_TELEMETRY_ENABLED = 'true'
      const payload = emitOperationalEvent('startup.ready', {
        host: '0.0.0.0',
      }, {
        timestamp: '2026-03-29T00:00:00.000Z',
        sinkUrl: 'https://ops.example/ingest',
        dispatch,
      })

      expect(payload).toMatchObject({
        name: 'startup.ready',
        level: 'info',
      })
      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledTimes(1)
    } finally {
      process.env.NODE_ENV = previousNodeEnv
      process.env.AIRMENTOR_TELEMETRY_ENABLED = previousTelemetryEnabled
      infoSpy.mockRestore()
    }
  })

  it('persists backend telemetry when the app configures local retention', async () => {
    const current = await createTestApp()
    const previousNodeEnv = process.env.NODE_ENV
    const previousTelemetryEnabled = process.env.AIRMENTOR_TELEMETRY_ENABLED

    try {
      process.env.NODE_ENV = 'development'
      process.env.AIRMENTOR_TELEMETRY_ENABLED = 'true'
      emitOperationalEvent('startup.ready', {
        host: '0.0.0.0',
      }, {
        timestamp: '2026-03-29T00:00:00.000Z',
      })
      let persisted: Array<{ source: string; name: string }> = []
      for (let attempt = 0; attempt < 20; attempt += 1) {
        persisted = await current.db.select().from(operationalTelemetryEvents)
        if (persisted.some(item => item.source === 'backend' && item.name === 'startup.ready')) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      expect(persisted.some(item => item.source === 'backend' && item.name === 'startup.ready')).toBe(true)
    } finally {
      process.env.NODE_ENV = previousNodeEnv
      process.env.AIRMENTOR_TELEMETRY_ENABLED = previousTelemetryEnabled
      await current.close()
    }
  })

  it('accepts forwarded client telemetry from an allowed frontend origin', async () => {
    const current = await createTestApp()

    try {
      const response = await current.app.inject({
        method: 'POST',
        url: '/api/client-telemetry',
        headers: {
          origin: TEST_ORIGIN,
        },
        payload: {
          type: 'airmentor-client-event',
          name: 'startup.ready',
          level: 'info',
          timestamp: '2026-03-29T00:00:00.000Z',
          details: {
            workspace: 'system-admin',
          },
        },
      })

      expect(response.statusCode).toBe(202)
      expect(response.json()).toEqual({
        accepted: true,
        relayed: false,
      })
    } finally {
      await current.close()
    }
  })

  it('rejects malformed forwarded client telemetry payloads', async () => {
    const current = await createTestApp()

    try {
      const response = await current.app.inject({
        method: 'POST',
        url: '/api/client-telemetry',
        headers: {
          origin: TEST_ORIGIN,
        },
        payload: {
          type: 'airmentor-client-event',
          level: 'info',
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('BAD_REQUEST')
    } finally {
      await current.close()
    }
  })
})
