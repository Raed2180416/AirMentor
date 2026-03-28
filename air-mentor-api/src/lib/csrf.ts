import { createHmac, timingSafeEqual } from 'node:crypto'

export function buildCsrfToken(secret: string, sessionId: string) {
  return createHmac('sha256', secret).update(sessionId).digest('base64url')
}

export function readSingleHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function secureTokenEquals(left: string, right: string) {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}
