import type { ScopeTypeValue } from './stage-policy.js'

export type CountSourceValue = 'operational-semester' | 'proof-run' | 'proof-checkpoint' | 'unavailable'
export type ScopeModeValue = ScopeTypeValue | 'proof'
export type ScopeDescriptorValue = {
  scopeType: ScopeTypeValue | 'proof' | 'student'
  scopeId: string
  label: string
  batchId: string | null
  sectionCode: string | null
  branchName: string | null
  simulationRunId: string | null
  simulationStageCheckpointId: string | null
  studentId: string | null
}

export type ResolvedFromValue = {
  kind: 'default-policy' | 'policy-override' | 'proof-run' | 'proof-checkpoint' | 'proof-unavailable'
  scopeType: ScopeTypeValue | 'proof' | 'student' | null
  scopeId: string | null
  label: string
}

export type CountProvenanceValue = {
  scopeDescriptor: ScopeDescriptorValue
  resolvedFrom: ResolvedFromValue
  scopeMode: ScopeModeValue
  countSource: CountSourceValue
  activeOperationalSemester: number | null
}

type ProofCountProvenanceInput = {
  activeOperationalSemester: number | null
  batchId: string
  batchLabel: string
  branchName?: string | null
  sectionCode?: string | null
  simulationRunId: string
  runLabel: string
  simulationStageCheckpointId?: string | null
  checkpointLabel?: string | null
  studentId?: string | null
  studentLabel?: string | null
}

export function buildProofCountProvenance(input: ProofCountProvenanceInput): CountProvenanceValue {
  const normalizedSectionCode = input.sectionCode?.trim().toUpperCase() ?? null
  const countSource: CountSourceValue = input.simulationStageCheckpointId ? 'proof-checkpoint' : 'proof-run'
  const scopeLabelParts = [
    input.studentLabel ?? input.batchLabel,
    normalizedSectionCode ? `Section ${normalizedSectionCode}` : null,
    input.studentLabel ? input.batchLabel : null,
  ].filter((value): value is string => Boolean(value))
  const resolvedFromLabel = input.simulationStageCheckpointId
    ? `${input.checkpointLabel ?? 'Selected checkpoint'} · ${input.runLabel}`
    : input.runLabel
  return {
    scopeDescriptor: {
      scopeType: input.studentId ? 'student' : 'proof',
      scopeId: input.studentId ?? input.simulationStageCheckpointId ?? input.simulationRunId,
      label: scopeLabelParts.join(' · '),
      batchId: input.batchId,
      sectionCode: normalizedSectionCode,
      branchName: input.branchName ?? null,
      simulationRunId: input.simulationRunId,
      simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
      studentId: input.studentId ?? null,
    },
    resolvedFrom: {
      kind: input.simulationStageCheckpointId ? 'proof-checkpoint' : 'proof-run',
      scopeType: 'proof',
      scopeId: input.simulationStageCheckpointId ?? input.simulationRunId,
      label: resolvedFromLabel,
    },
    scopeMode: 'proof',
    countSource,
    activeOperationalSemester: input.activeOperationalSemester,
  }
}

export function buildUnavailableCountProvenance(input: {
  activeOperationalSemester?: number | null
  batchId?: string | null
  batchLabel?: string | null
  branchName?: string | null
  sectionCode?: string | null
} = {}): CountProvenanceValue {
  const normalizedSectionCode = input.sectionCode?.trim().toUpperCase() ?? null
  return {
    scopeDescriptor: {
      scopeType: 'proof',
      scopeId: input.batchId ?? 'proof-unavailable',
      label: input.batchLabel
        ? `${input.batchLabel}${normalizedSectionCode ? ` · Section ${normalizedSectionCode}` : ''}`
        : 'Proof unavailable',
      batchId: input.batchId ?? null,
      sectionCode: normalizedSectionCode,
      branchName: input.branchName ?? null,
      simulationRunId: null,
      simulationStageCheckpointId: null,
      studentId: null,
    },
    resolvedFrom: {
      kind: 'proof-unavailable',
      scopeType: 'proof',
      scopeId: input.batchId ?? null,
      label: 'No active proof run is available for this scope.',
    },
    scopeMode: 'proof',
    countSource: 'unavailable',
    activeOperationalSemester: input.activeOperationalSemester ?? null,
  }
}
