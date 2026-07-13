export type FacultyProofViewerRole = 'COURSE_LEADER' | 'MENTOR' | 'HOD' | 'SYSTEM_ADMIN' | null | undefined

export function isFacultyProofQueueItemVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  matchesOwnedOffering: boolean
  matchesAssignedStudent: boolean
}) {
  if (input.viewerRoleCode === 'HOD' || input.viewerRoleCode === 'SYSTEM_ADMIN') return true
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.matchesOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.matchesAssignedStudent
  return input.matchesOwnedOffering || input.matchesAssignedStudent
}

export function isFacultyProofStudentVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  visibleViaOwnedOffering: boolean
  visibleViaAssignedMentorScope: boolean
}) {
  if (input.viewerRoleCode === 'HOD' || input.viewerRoleCode === 'SYSTEM_ADMIN') return true
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.visibleViaOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.visibleViaAssignedMentorScope
  return input.visibleViaOwnedOffering || input.visibleViaAssignedMentorScope
}

export function queueDecisionTypeFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'suppress'
  if (status === 'Watching') return 'watch'
  if (status === 'Deferred') return 'deferred'
  return 'alert'
}

export function queueReassessmentStatusFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'Resolved'
  if (status === 'Watching') return 'Watching'
  if (status === 'Deferred') return 'Deferred'
  return 'Open'
}

export type PublicProofQueueStatus = 'open' | 'watch' | 'deferred' | 'resolved' | 'suppressed' | 'reevaluating'

export function canonicalPublicProofQueueStatus(status: string | null | undefined): PublicProofQueueStatus | null {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'open' || normalized === 'opened' || normalized === 'reopened') return 'open'
  if (normalized === 'watch' || normalized === 'watching') return 'watch'
  if (normalized === 'deferred') return 'deferred'
  if (normalized === 'resolved') return 'resolved'
  if (normalized === 'reevaluating' || normalized === 'reevaluating risk' || normalized === 'reevaluating-risk') return 'reevaluating'
  if (normalized === 'suppressed' || normalized === 'dismissed' || normalized === 'idle') return null
  return null
}
