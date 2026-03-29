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

export function describeProofProvenance(provenance: ProofProvenanceLike) {
  const semesterLabel = provenance.activeOperationalSemester != null
    ? `operational semester ${provenance.activeOperationalSemester}`
    : 'operational semester unavailable'
  return `Scope ${provenance.scopeDescriptor.label} · resolved from ${provenance.resolvedFrom.label} · ${formatCountSourceLabel(provenance.countSource)} · ${semesterLabel} · ${formatScopeModeLabel(provenance.scopeMode)}.`
}

export function describeProofAvailability(provenance: ProofProvenanceLike) {
  if (provenance.countSource === 'unavailable') {
    return `No authoritative proof count source is available. ${provenance.resolvedFrom.label}`
  }
  return `${formatCountSourceLabel(provenance.countSource)} are authoritative for ${provenance.scopeDescriptor.label}.`
}
