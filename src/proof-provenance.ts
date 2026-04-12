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

function formatScopeModeLabel(scopeMode: ApiScopeMode) {
  if (scopeMode === 'academic-faculty') return 'Academic faculty mode'
  if (scopeMode === 'proof') return 'Proof mode'
  return `${scopeMode.charAt(0).toUpperCase()}${scopeMode.slice(1)} mode`
}

function formatCountSourceLabel(countSource: ApiCountSource) {
  if (countSource === 'operational-semester') return 'Operational-semester defaults'
  if (countSource === 'proof-run') return 'Proof-run counts'
  if (countSource === 'proof-checkpoint') return 'Checkpoint-bound proof counts'
  return 'Unavailable counts'
}

export function normalizeProofPanelLabel(label: string) {
  return proofPanelLabelMap[label] ?? label
}

export function describeProofProvenance(provenance: ProofProvenanceLike) {
  const semesterLabel = provenance.countSource === 'proof-checkpoint'
    ? (
        provenance.activeOperationalSemester != null
          ? `checkpoint semester ${provenance.activeOperationalSemester}`
          : 'checkpoint semester unavailable'
      )
    : (
        provenance.activeOperationalSemester != null
          ? `operational semester ${provenance.activeOperationalSemester}`
          : 'operational semester unavailable'
      )
  return `Provenance · scope ${provenance.scopeDescriptor.label} · resolved from ${provenance.resolvedFrom.label} · ${formatCountSourceLabel(provenance.countSource)} · ${semesterLabel} · ${formatScopeModeLabel(provenance.scopeMode)}.`
}

export function describeProofModelUsefulness(provenance: ProofProvenanceLike) {
  if (provenance.countSource === 'unavailable') {
    return `Model usefulness · no authoritative proof count source is available. ${provenance.resolvedFrom.label}`
  }
  return `Model usefulness · ${formatCountSourceLabel(provenance.countSource)} are authoritative for ${provenance.scopeDescriptor.label}.`
}

export function describeProofAvailability(provenance: ProofProvenanceLike) {
  return describeProofModelUsefulness(provenance)
}
