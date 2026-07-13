type BatchSetupReadinessInput = {
  batchLabel: string | null
  currentSemesterTermConfigured: boolean
  curriculumRowCount: number
  facultyInScopeCount: number
  mentorReadyFacultyCount: number
  studentCount: number
  offeringCount: number
  offeringsWithoutOwnerCount: number
  studentsWithoutEnrollmentCount: number
  studentsWithoutMentorCount: number
  offeringsWithoutRosterCount: number
}

export type BatchSetupReadiness = {
  ready: boolean
  blockers: string[]
}

export function buildBatchSetupReadiness(input: BatchSetupReadinessInput): BatchSetupReadiness {
  const blockers: string[] = []
  const batchLabel = input.batchLabel ?? 'this batch'

  if (!input.currentSemesterTermConfigured) blockers.push(`Add the live semester term for ${batchLabel}.`)
  if (input.curriculumRowCount === 0) blockers.push(`Add curriculum rows before moving ${batchLabel} forward.`)
  if (input.facultyInScopeCount === 0) blockers.push(`Add faculty appointments in scope for ${batchLabel}.`)
  if (input.mentorReadyFacultyCount === 0) blockers.push(`Grant at least one mentor-ready faculty member in ${batchLabel}.`)
  if (input.studentCount === 0) blockers.push(`Add or provision students for ${batchLabel}.`)
  if (input.offeringCount === 0) blockers.push(`Create teaching offerings for ${batchLabel}.`)
  if (input.offeringsWithoutOwnerCount > 0) blockers.push(`${input.offeringsWithoutOwnerCount} offering(s) still need a faculty owner.`)
  if (input.studentsWithoutEnrollmentCount > 0) blockers.push(`${input.studentsWithoutEnrollmentCount} student(s) still need an active enrollment.`)
  if (input.studentsWithoutMentorCount > 0) blockers.push(`${input.studentsWithoutMentorCount} student(s) still need a mentor.`)
  if (input.offeringsWithoutRosterCount > 0) blockers.push(`${input.offeringsWithoutRosterCount} offering(s) still have no roster.`)

  return {
    ready: blockers.length === 0,
    blockers,
  }
}
