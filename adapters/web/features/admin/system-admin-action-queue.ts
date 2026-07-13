type AdminQueueDismissKeyInput = {
  requestIds?: readonly string[]
  reminderIds?: readonly string[]
  hiddenItemKeys?: readonly string[]
}

function appendPrefixedKeys(target: string[], prefix: string, values: readonly string[]) {
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    target.push(`${prefix}:${normalized}`)
  }
}

export function collectAdminQueueDismissKeys({
  requestIds = [],
  reminderIds = [],
  hiddenItemKeys = [],
}: AdminQueueDismissKeyInput) {
  const keys: string[] = []
  appendPrefixedKeys(keys, 'request', requestIds)
  appendPrefixedKeys(keys, 'reminder', reminderIds)
  appendPrefixedKeys(keys, 'hidden', hiddenItemKeys)
  return keys
}

export function mergeAdminQueueDismissKeys(existing: readonly string[], next: readonly string[]) {
  const merged = [...existing]
  for (const key of next) {
    if (!merged.includes(key)) merged.push(key)
  }
  return merged
}
