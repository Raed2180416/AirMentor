export function nullablePct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function roundNullablePct(value: unknown): number | null {
  const pct = nullablePct(value)
  return pct == null ? null : Math.round(pct * 10) / 10
}
