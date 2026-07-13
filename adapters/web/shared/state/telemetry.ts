export type ClientOperationalEvent = {
  type: 'airmentor-client-event'
  name: string
  level: 'info' | 'warn' | 'error'
  timestamp: string
  details?: Record<string, unknown>
}

type ClientTelemetryTransport = (
  event: ClientOperationalEvent,
  sinkUrl: string,
  serialized: string,
) => void | Promise<void>

function telemetryEnabled(explicit?: boolean) {
  if (typeof explicit === 'boolean') return explicit
  return import.meta.env.MODE !== 'test'
}

export function resolveClientTelemetrySinkUrl(explicit?: string | null, apiBaseUrlOverride?: string | null) {
  if (explicit === null) return null
  if (typeof explicit === 'string') {
    const normalized = explicit.trim()
    if (normalized.length > 0) return normalized
  }
  const configured = import.meta.env.VITE_AIRMENTOR_TELEMETRY_SINK_URL
  if (typeof configured === 'string') {
    const normalized = configured.trim()
    if (normalized.length > 0) return normalized
  }
  const apiBaseUrl = apiBaseUrlOverride?.trim() || import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim()
  if (!apiBaseUrl) return null
  const trimmedBase = apiBaseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmedBase)) {
    return new URL('/api/client-telemetry', `${trimmedBase}/`).toString()
  }
  if (trimmedBase.startsWith('/')) {
    return `${trimmedBase}/client-telemetry`
  }
  return null
}

function defaultTelemetryTransport(
  event: ClientOperationalEvent,
  sinkUrl: string,
  serialized: string,
) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const payload = new Blob([serialized], { type: 'application/json' })
      const accepted = navigator.sendBeacon(sinkUrl, payload)
      if (accepted) return
    }
    if (typeof fetch === 'function') {
      void fetch(sinkUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: {
          'content-type': 'application/json',
        },
        body: serialized,
      }).catch(() => undefined)
      return
    }
  } catch (error) {
    const sinkError = normalizeClientTelemetryError(error)
    console.warn(JSON.stringify({
      type: 'airmentor-client-event',
      name: 'telemetry.sink_failed',
      level: 'warn',
      timestamp: new Date().toISOString(),
      details: {
        sinkUrl,
        eventName: event.name,
        error: sinkError,
      },
    }))
  }
}

export function normalizeClientTelemetryError(error: unknown) {
  if (error instanceof Error) {
    const telemetryError: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    }
    if ('status' in error && typeof error.status === 'number') telemetryError.status = error.status
    return telemetryError
  }
  if (typeof error === 'string') return { message: error }
  return { message: 'Unknown client error' }
}

export function emitClientOperationalEvent(
  name: string,
  details?: Record<string, unknown>,
  options?: {
    level?: ClientOperationalEvent['level']
    timestamp?: string
    enabled?: boolean
    sinkUrl?: string | null
    transport?: ClientTelemetryTransport
  },
) {
  const event: ClientOperationalEvent = {
    type: 'airmentor-client-event',
    name,
    level: options?.level ?? 'info',
    timestamp: options?.timestamp ?? new Date().toISOString(),
    ...(details ? { details } : {}),
  }
  if (!telemetryEnabled(options?.enabled)) return event
  const serialized = JSON.stringify(event)
  if (event.level === 'error') console.error(serialized)
  else if (event.level === 'warn') console.warn(serialized)
  else console.info(serialized)
  const sinkUrl = resolveClientTelemetrySinkUrl(options?.sinkUrl)
  if (sinkUrl) {
    const transport = options?.transport ?? defaultTelemetryTransport
    try {
      void Promise.resolve(transport(event, sinkUrl, serialized)).catch(error => {
        const sinkError = normalizeClientTelemetryError(error)
        console.warn(JSON.stringify({
          type: 'airmentor-client-event',
          name: 'telemetry.sink_failed',
          level: 'warn',
          timestamp: new Date().toISOString(),
          details: {
            sinkUrl,
            eventName: event.name,
            error: sinkError,
          },
        }))
      })
    } catch (error) {
      const sinkError = normalizeClientTelemetryError(error)
      console.warn(JSON.stringify({
        type: 'airmentor-client-event',
        name: 'telemetry.sink_failed',
        level: 'warn',
        timestamp: new Date().toISOString(),
        details: {
          sinkUrl,
          eventName: event.name,
          error: sinkError,
        },
      }))
    }
  }
  return event
}
