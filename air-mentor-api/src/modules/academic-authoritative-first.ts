export function pickAuthoritativeFirstList<T>(authoritative: T[], runtime: T[]) {
  return authoritative.length > 0 ? authoritative : runtime
}

export function pickAuthoritativeFirstRecord<T>(input: {
  authoritativeById: Map<string, T>
  runtimeById: Record<string, unknown>
  visibleIds: Iterable<string>
  parseRuntimeValue: (value: unknown) => T | null
}) {
  const visibleIds = input.visibleIds instanceof Set ? input.visibleIds : new Set(input.visibleIds)
  const entries = input.authoritativeById.size > 0
    ? Array.from(visibleIds).flatMap(id => {
        const authoritativeValue = input.authoritativeById.get(id)
        return authoritativeValue ? [[id, authoritativeValue] as const] : []
      })
    : Array.from(visibleIds).flatMap(id => {
        const runtimeValue = input.parseRuntimeValue(input.runtimeById[id])
        return runtimeValue ? [[id, runtimeValue] as const] : []
      })
  return Object.fromEntries(entries) as Record<string, T>
}
