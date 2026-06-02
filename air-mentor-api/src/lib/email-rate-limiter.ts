type RateLimitEntry = { count: number; windowStart: number }

export type EmailRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

export class EmailRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>()
  private readonly windowMs: number
  private readonly maxPerWindow: number

  constructor(
    windowMs: number,
    maxPerWindow: number,
  ) {
    this.windowMs = windowMs
    this.maxPerWindow = maxPerWindow
  }

  check(key: string, nowMs: number): EmailRateLimitResult {
    const entry = this.store.get(key)
    if (!entry || nowMs - entry.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: nowMs })
      return { allowed: true }
    }
    if (entry.count >= this.maxPerWindow) {
      const retryAfterMs = this.windowMs - (nowMs - entry.windowStart)
      return { allowed: false, retryAfterMs }
    }
    entry.count += 1
    return { allowed: true }
  }

  reset(key: string) {
    this.store.delete(key)
  }
}
