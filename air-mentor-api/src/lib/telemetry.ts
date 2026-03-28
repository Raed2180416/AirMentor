type TelemetryLevel = 'info' | 'warn' | 'error'

type Serializable =
  | string
  | number
  | boolean
  | null
  | Serializable[]
  | { [key: string]: Serializable }

function sanitizeValue(value: unknown, depth = 0): Serializable | undefined {
  if (depth > 5) return '[truncated]'
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    const normalized: Record<string, Serializable> = {
      name: value.name,
      message: value.message,
    }
    const code = Reflect.get(value, 'code')
    if (typeof code === 'string') normalized.code = code
    return normalized
  }
  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeValue(item, depth + 1))
      .filter((item): item is Serializable => item !== undefined)
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, sanitizeValue(item, depth + 1)] as const)
      .filter((entry): entry is readonly [string, Serializable] => entry[1] !== undefined)
    return Object.fromEntries(entries)
  }
  return String(value)
}

function telemetryEnabled() {
  return process.env.NODE_ENV !== 'test' && process.env.AIRMENTOR_TELEMETRY_ENABLED !== 'false'
}

export function normalizeTelemetryError(error: unknown) {
  return sanitizeValue(error) as Record<string, Serializable> | undefined
}

export function emitOperationalEvent(
  name: string,
  details?: Record<string, unknown>,
  options?: { level?: TelemetryLevel; timestamp?: string },
) {
  if (!telemetryEnabled()) return null
  const payload = {
    type: 'airmentor-operational-event',
    name,
    timestamp: options?.timestamp ?? new Date().toISOString(),
    details: sanitizeValue(details ?? {}) ?? {},
  }
  const line = JSON.stringify(payload)
  if ((options?.level ?? 'info') === 'error') {
    console.error(line)
  } else if ((options?.level ?? 'info') === 'warn') {
    console.warn(line)
  } else {
    console.info(line)
  }
  return payload
}
