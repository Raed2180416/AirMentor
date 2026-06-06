import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearProofPlaybackSelection,
  PROOF_PLAYBACK_SELECTION_STORAGE_KEY,
  readProofPlaybackSelection,
  readSharedProofPlaybackSelection,
  writeProofPlaybackSelection,
} from '../src/proof-playback'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>()

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }

  removeItem(key: string) {
    this.data.delete(key)
  }
}

describe('proof playback storage helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists, reads, and clears the saved playback selection', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    writeProofPlaybackSelection({
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_001',
      updatedAt: '2026-03-27T00:00:00.000Z',
    })

    expect(readProofPlaybackSelection()).toMatchObject({
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_001',
    })
    expect(localStorage.getItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)).toContain('checkpoint_001')

    clearProofPlaybackSelection()

    expect(readProofPlaybackSelection()).toBeNull()
    expect(localStorage.getItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)).toBeNull()
  })

  it('restores a shared selection across admin and academic workspaces', () => {
    const localStorage = new MemoryStorage()
    vi.stubGlobal('window', { localStorage })

    writeProofPlaybackSelection({
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_002',
      updatedAt: '2026-06-04T15:00:00.000Z',
      workspace: 'system-admin',
      source: 'system-admin-proof-dashboard:auto',
    })

    expect(readSharedProofPlaybackSelection('academic')).toMatchObject({
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_002',
      workspace: 'system-admin',
    })
    expect(readSharedProofPlaybackSelection('system-admin')).toMatchObject({
      simulationRunId: 'run_001',
      simulationStageCheckpointId: 'checkpoint_002',
      workspace: 'system-admin',
    })
  })
})
