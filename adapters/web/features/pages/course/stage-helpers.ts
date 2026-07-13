import type { Offering, Student } from '@web/simulation/fixtures'

export function getAttendancePct(student: Student) {
  return student.totalClasses > 0 ? Math.round((student.present / Math.max(1, student.totalClasses)) * 100) : null
}

type StageEvidenceKind = 'tt1' | 'tt2' | 'coursework' | 'see'

const PROOF_STAGE_RANK: Record<string, number> = {
  'pre-tt1': 0,
  'post-tt1': 1,
  'post-tt2': 2,
  'post-assignments': 3,
  'post-see': 4,
}

function getProofStageRank(proofStageKey?: string | null) {
  if (!proofStageKey) return null
  return PROOF_STAGE_RANK[proofStageKey.toLowerCase()] ?? null
}

export function isProofEvidenceVisible(proofStageKey: string | null | undefined, kind: StageEvidenceKind) {
  const rank = getProofStageRank(proofStageKey)
  if (rank == null) return true
  if (kind === 'tt1') return rank >= 1
  if (kind === 'tt2') return rank >= 2
  if (kind === 'coursework') return rank >= 3
  return rank >= 4
}

export function isRiskEvidenceVisible(offering: Offering, proofStageKey?: string | null) {
  const rank = getProofStageRank(proofStageKey)
  return rank == null ? offering.stage >= 2 : rank >= 1
}

export function hasRiskEvidence(offering: Offering, student: Student, proofStageKey?: string | null) {
  return isRiskEvidenceVisible(offering, proofStageKey) && student.riskBand != null && student.riskProb != null
}

export function getStageRailProgress(offering: Offering, proofStageKey?: string | null) {
  const rank = getProofStageRank(proofStageKey)
  return rank == null ? offering.stageInfo.stage : Math.max(1, Math.min(5, rank + 1))
}

export function getDisplayStageInfo(offering: Offering, proofStageKey?: string | null) {
  const rank = getProofStageRank(proofStageKey)
  if (rank == null) return offering.stageInfo
  const labels: Record<string, { label: string; desc: string }> = {
    'pre-tt1': { label: 'Pre TT1', desc: 'Before first term-test evidence' },
    'post-tt1': { label: 'Post TT1', desc: 'TT1 evidence available' },
    'post-tt2': { label: 'Post TT2', desc: 'TT1 and TT2 evidence available' },
    'post-assignments': { label: 'Post Assignments', desc: 'Coursework evidence available' },
    'post-see': { label: 'Post SEE', desc: 'Semester-end evidence available' },
  }
  const copy = labels[proofStageKey?.toLowerCase() ?? ''] ?? labels['pre-tt1']
  return {
    ...offering.stageInfo,
    stage: rank + 1,
    label: copy.label,
    desc: copy.desc,
  }
}
