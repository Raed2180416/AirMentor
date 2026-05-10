import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY,
  clearActiveDemoWorkspacePointer,
  readActiveDemoWorkspacePointer,
  writeActiveDemoWorkspacePointer,
} from '../src/demo-workspace-pointer'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('demo workspace pointer storage', () => {
  it('persists only the active demo workspace id', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    writeActiveDemoWorkspacePointer({ demoWorkspaceId: 'demo_ws_001' })

    expect(readActiveDemoWorkspacePointer()).toEqual({ demoWorkspaceId: 'demo_ws_001' })
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)).toBe(JSON.stringify({
      demoWorkspaceId: 'demo_ws_001',
    }))
  })

  it('clears invalid or empty pointer values', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    localStorage.setItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY, JSON.stringify({ password: 'secret' }))
    expect(readActiveDemoWorkspacePointer()).toBeNull()

    writeActiveDemoWorkspacePointer(null)
    expect(localStorage.getItem(ACTIVE_DEMO_WORKSPACE_POINTER_STORAGE_KEY)).toBeNull()

    writeActiveDemoWorkspacePointer({ demoWorkspaceId: 'demo_ws_002' })
    clearActiveDemoWorkspacePointer()
    expect(readActiveDemoWorkspacePointer()).toBeNull()
  })
})
