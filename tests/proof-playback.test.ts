import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearProofPlaybackSelection,
  PROOF_PLAYBACK_SELECTION_STORAGE_KEY,
  readProofPlaybackSelection,
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
})
