export const PROOF_PLAYBACK_SELECTION_STORAGE_KEY = 'airmentor-proof-playback-selection'

export type ProofPlaybackSelection = {
  simulationRunId: string
  simulationStageCheckpointId: string
  updatedAt: string
}

function hasWindow() {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function readProofPlaybackSelection(): ProofPlaybackSelection | null {
  if (!hasWindow()) return null
  const raw = window.localStorage.getItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ProofPlaybackSelection>
    if (typeof parsed.simulationRunId !== 'string' || typeof parsed.simulationStageCheckpointId !== 'string') return null
    return {
      simulationRunId: parsed.simulationRunId,
      simulationStageCheckpointId: parsed.simulationStageCheckpointId,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeProofPlaybackSelection(selection: ProofPlaybackSelection | null) {
  if (!hasWindow()) return
  if (!selection) {
    window.localStorage.removeItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY, JSON.stringify(selection))
}

export function clearProofPlaybackSelection() {
  if (!hasWindow()) return
  window.localStorage.removeItem(PROOF_PLAYBACK_SELECTION_STORAGE_KEY)
}
