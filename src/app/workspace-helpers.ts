import type {
  RemedialPlan,
  Role,
  SchemeState,
  SharedTask,
  TaskType,
} from '../domain'
import type { Mentee, Offering, Student, StudentHistoryRecord } from '../data'
import type { RouteSnapshot } from './workspace-types'

export function getRouteSnapshotKey(snapshot: RouteSnapshot) {
  return [
    snapshot.page,
    snapshot.offeringId ?? '',
    snapshot.uploadOfferingId ?? '',
    snapshot.uploadKind,
    snapshot.entryOfferingId,
    snapshot.entryKind,
    snapshot.selectedMenteeId ?? '',
    snapshot.historyProfile?.usn ?? '',
    snapshot.historyStudentId ?? '',
    snapshot.studentShellStudentId ?? '',
    snapshot.historyBackPage ?? '',
    snapshot.selectedUnlockTaskId ?? '',
    snapshot.schemeOfferingId ?? '',
    snapshot.courseInitialTab ?? '',
  ].join('|')
}

export function formatDateTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function getLatestTransition(task: SharedTask) {
  const history = task.transitionHistory ?? []
  return history[history.length - 1]
}

export function buildHistoryProfile(input: {
  student?: Student | null
  mentee?: Mentee | null
  historyByUsn?: Record<string, StudentHistoryRecord> | null
}): StudentHistoryRecord | null {
  const usn = input.student?.usn ?? input.mentee?.usn ?? null
  return usn ? (input.historyByUsn?.[usn] ?? null) : null
}

export function parseTimeToMinutes(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback
  return (hours * 60) + minutes
}

export function createRemedialPlan({
  selectedStudentId,
  title,
  ownerRole,
  dueDateISO,
  checkInDatesISO,
  steps,
}: {
  selectedStudentId: string
  title: string
  ownerRole: Role
  dueDateISO: string
  checkInDatesISO: string[]
  steps: string[]
}): RemedialPlan {
  const createdAt = Date.now()
  return {
    planId: `plan-${selectedStudentId}-${createdAt}`,
    title,
    createdAt,
    ownerRole,
    dueDateISO,
    checkInDatesISO,
    steps: steps.map((label, index) => ({ id: `step-${index + 1}`, label })),
  }
}

export function suggestTaskForStudent(s?: Student) {
  const toISO = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (!s) return { taskType: 'Follow-up' as TaskType, dueDateISO: toISO(7), note: '' }
  const attPct = getStudentAttendancePct(s)
  if (s.riskBand === 'High') return { taskType: 'Remedial' as TaskType, dueDateISO: toISO(3), note: 'High-risk case. Add a structured remedial plan with check-ins.' }
  if ((attPct != null && attPct < 65) || s.flags.lowAttendance) return { taskType: 'Attendance' as TaskType, dueDateISO: toISO(2), note: 'Attendance intervention and follow-up required.' }
  if (s.riskBand === 'Medium') return { taskType: 'Academic' as TaskType, dueDateISO: toISO(5), note: 'Academic follow-up for medium-risk trend.' }
  return { taskType: 'Follow-up' as TaskType, dueDateISO: toISO(7), note: `General follow-up with ${s.name.split(' ')[0]}.` }
}

export function getStudentAttendancePct(student: Student) {
  return student.totalClasses > 0 ? Math.round((student.present / Math.max(1, student.totalClasses)) * 100) : null
}

export function isRiskVisibleAtProofStage(proofStageKey?: string | null) {
  if (!proofStageKey) return true
  return proofStageKey.toLowerCase() !== 'pre-tt1'
}

export function hasStudentRiskEvidence(offering: Offering | undefined, student: Student, proofStageKey?: string | null) {
  const stageAllowsRisk = proofStageKey ? isRiskVisibleAtProofStage(proofStageKey) : (offering?.stage ?? 0) >= 2
  return Boolean(offering && stageAllowsRisk && student.riskBand != null && student.riskProb != null)
}

export function getEvidenceStageKey(offering?: Offering, proofStageKey?: string | null) {
  const normalizedProofStage = proofStageKey?.toLowerCase()
  if (normalizedProofStage) return normalizedProofStage
  const stage = offering?.stageInfo?.stage ?? offering?.stage ?? 0
  if (stage >= 5) return 'post-see'
  if (stage >= 4) return 'post-assignments'
  if (stage >= 3) return 'post-tt2'
  if (stage >= 2) return 'post-tt1'
  return 'pre-tt1'
}

export function isPostSeeEvidenceStage(offering?: Offering, proofStageKey?: string | null) {
  return getEvidenceStageKey(offering, proofStageKey) === 'post-see'
}

export function getVisibleCeTargetForStage(scheme: SchemeState, offering?: Offering, proofStageKey?: string | null) {
  switch (getEvidenceStageKey(offering, proofStageKey)) {
    case 'pre-tt1':
      return 0
    case 'post-tt1':
      return scheme.termTestWeights.tt1
    case 'post-tt2':
      return scheme.termTestWeights.tt1 + scheme.termTestWeights.tt2
    case 'post-assignments':
    case 'post-see':
    default:
      return scheme.policyContext.ce
  }
}
