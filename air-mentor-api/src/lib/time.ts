export function nowIso(now: Date = new Date()) {
  return now.toISOString()
}

export function addHours(iso: string, hours: number) {
  const next = new Date(iso)
  next.setHours(next.getHours() + hours)
  return next.toISOString()
}
