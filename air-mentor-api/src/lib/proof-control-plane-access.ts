export type FacultyProofViewerRole = 'COURSE_LEADER' | 'MENTOR' | 'HOD' | 'SYSTEM_ADMIN' | null | undefined

export function isFacultyProofQueueItemVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  matchesOwnedOffering: boolean
  matchesAssignedStudent: boolean
}) {
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.matchesOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.matchesAssignedStudent
  return input.matchesOwnedOffering || input.matchesAssignedStudent
}

export function isFacultyProofStudentVisible(input: {
  viewerRoleCode: FacultyProofViewerRole
  visibleViaOwnedOffering: boolean
  visibleViaAssignedMentorScope: boolean
}) {
  if (input.viewerRoleCode === 'COURSE_LEADER') return input.visibleViaOwnedOffering
  if (input.viewerRoleCode === 'MENTOR') return input.visibleViaAssignedMentorScope
  return input.visibleViaOwnedOffering || input.visibleViaAssignedMentorScope
}

export function queueDecisionTypeFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'suppress'
  if (status === 'Watching') return 'watch'
  return 'alert'
}

export function queueReassessmentStatusFromStatus(status: string | null | undefined) {
  if (status === 'Resolved') return 'Resolved'
  if (status === 'Watching') return 'Watching'
  return 'Open'
}
