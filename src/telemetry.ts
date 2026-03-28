export type ClientOperationalEvent = {
  type: 'airmentor-client-event'
  name: string
  level: 'info' | 'warn' | 'error'
  timestamp: string
  details?: Record<string, unknown>
}

function telemetryEnabled(explicit?: boolean) {
  if (typeof explicit === 'boolean') return explicit
  return import.meta.env.MODE !== 'test'
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
  return event
}
