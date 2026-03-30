import type { Mentee, Offering, Student } from './data'
import type { FacultyAccount } from './domain'
import type { ApiAcademicFacultyProfile } from './api/types'

type StudentResolver = (offering: Offering) => Student[]

export function resolveAssignedMentees(
  allMentees: Mentee[],
  currentTeacher: FacultyAccount | null,
  facultyProfile: ApiAcademicFacultyProfile | null,
) {
  if (!currentTeacher) return allMentees

  if (facultyProfile) {
    const scopedIds = facultyProfile.mentorScope.studentIds.flatMap(studentId => [studentId, `mentee-${studentId}`])
    const scopedIdSet = new Set(scopedIds)
    return allMentees.filter(mentee => scopedIdSet.has(mentee.id))
  }

  const menteeIds = new Set(currentTeacher.menteeIds)
  return allMentees.filter(mentee => menteeIds.has(mentee.id))
}

export function findStudentProfileLaunchTarget(input: {
  studentId: string
  offeringId?: string | null
  offerings: Offering[]
  getStudentsForOffering: StudentResolver
}) {
  const normalizedStudentId = input.studentId.split('::').at(-1) ?? input.studentId
  const offeringOrder = input.offeringId
    ? [
        ...input.offerings.filter(offering => offering.offId === input.offeringId),
        ...input.offerings.filter(offering => offering.offId !== input.offeringId),
      ]
    : input.offerings

  for (const offering of offeringOrder) {
    const student = input.getStudentsForOffering(offering).find(candidate => {
      const candidateId = candidate.id.split('::').at(-1) ?? candidate.id
      return candidate.id === input.studentId || candidateId === normalizedStudentId
    })
    if (student) return { offering, student }
  }

  return null
}
