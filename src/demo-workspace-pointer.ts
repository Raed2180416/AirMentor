export const ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY = 'airmentor.activeDemoWorkspacePointer'

export type ActiveDemoWorkspacePointer = {
  demoWorkspaceId: string
}

function hasWindowStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function normalizePointer(value: unknown): ActiveDemoWorkspacePointer | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ActiveDemoWorkspacePointer>
  if (typeof candidate.demoWorkspaceId !== 'string') return null
  const demoWorkspaceId = candidate.demoWorkspaceId.trim()
  if (!demoWorkspaceId) return null
  return { demoWorkspaceId }
}

export function readActiveDemoWorkspacePointer(): ActiveDemoWorkspacePointer | null {
  if (!hasWindowStorage()) return null
  const raw = window.localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
  if (!raw) return null
  try {
    return normalizePointer(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeActiveDemoWorkspacePointer(pointer: ActiveDemoWorkspacePointer | null) {
  if (!hasWindowStorage()) return
  const normalized = normalizePointer(pointer)
  if (!normalized) {
    window.localStorage.removeItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY, JSON.stringify(normalized))
}

export function clearActiveDemoWorkspacePointer() {
  if (!hasWindowStorage()) return
  window.localStorage.removeItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)
}
