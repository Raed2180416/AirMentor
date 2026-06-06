export const PROOF_PLAYBACK_SELECTION_STORAGE_KEY = 'airmentor-proof-playback-selection'

export type ProofPlaybackSelection = {
  simulationRunId: string
  simulationStageCheckpointId: string
  updatedAt: string
  workspace?: 'academic' | 'system-admin'
  source?: string
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
      workspace: parsed.workspace === 'academic' || parsed.workspace === 'system-admin' ? parsed.workspace : undefined,
      source: typeof parsed.source === 'string' ? parsed.source : undefined,
    }
  } catch {
    return null
  }
}

export function readProofPlaybackSelectionForWorkspace(workspace: ProofPlaybackSelection['workspace']): ProofPlaybackSelection | null {
  const selection = readProofPlaybackSelection()
  return selection?.workspace === workspace ? selection : null
}

// Proof playback is a shared cross-role control surface. Prefer same-workspace
// selections when present, but allow the other role's selection to drive
// playback so sysadmin and academic tabs stay aligned on one checkpoint.
export function readSharedProofPlaybackSelection(workspace?: ProofPlaybackSelection['workspace']): ProofPlaybackSelection | null {
  const selection = readProofPlaybackSelection()
  if (!selection) return null
  if (!workspace || !selection.workspace || selection.workspace === workspace) return selection
  return selection
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
