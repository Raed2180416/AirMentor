import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './api/types'

export type ProofProvenanceLike = {
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
}

const proofPanelLabelMap: Record<string, string> = {
  Observed: 'Observed',
  'Policy Derived': 'Model Output',
  'Simulation Internal': 'Simulated Intervention / Realized Path',
  'Human Action Log': 'Simulated Intervention / Realized Path',
}

function formatSemesterLabel(countSource: ApiCountSource, semesterNumber: number | null) {
  if (semesterNumber == null) {
    return countSource === 'proof-checkpoint'
      ? 'the selected checkpoint'
      : 'the current live semester'
  }
  return `Semester ${semesterNumber}`
}

export function normalizeProofPanelLabel(label: string) {
  return proofPanelLabelMap[label] ?? label
}

export function describeProofProvenance(provenance: ProofProvenanceLike) {
  const semesterLabel = formatSemesterLabel(provenance.countSource, provenance.activeOperationalSemester)
  if (provenance.countSource === 'proof-checkpoint') {
    return `You are viewing a saved preview checkpoint (${semesterLabel}) for ${provenance.scopeDescriptor.label}. Every number on this page is fixed to this point in time — change the checkpoint to see a different stage.`
  }
  if (provenance.countSource === 'proof-run') {
    return `You are viewing the active simulation snapshot for ${provenance.scopeDescriptor.label}. All numbers on this page reflect ${semesterLabel} and update when the simulation is refreshed.`
  }
  if (provenance.countSource === 'operational-semester') {
    return `You are viewing live data for ${provenance.scopeDescriptor.label}, showing ${semesterLabel}. Numbers update as records change.`
  }
  return `Proof data is not available for ${provenance.scopeDescriptor.label} yet. Numbers will appear once a simulation run is active.`
}

export function describeProofModelUsefulness(provenance: ProofProvenanceLike) {
  if (provenance.countSource === 'unavailable') {
    return 'Use this page as context only — simulation counts are not available yet.'
  }
  if (provenance.countSource === 'proof-checkpoint') {
    return 'Numbers are fixed to the selected preview checkpoint. Use the stage controls to move between checkpoints.'
  }
  if (provenance.countSource === 'proof-run') {
    return 'Numbers come from the active simulation run and update when it is refreshed.'
  }
  return 'Numbers reflect the current live semester and update in real time.'
}

export function describeProofAvailability(provenance: ProofProvenanceLike) {
  return describeProofModelUsefulness(provenance)
}
