import type { Mentee, Offering, Student } from './data'
import type { FacultyAccount, Role } from './domain'
import type { ApiAcademicFacultyProfile } from './api/types'

type StudentResolver = (offering: Offering) => Student[]

export function getHomePage(role: Role) {
  return role === 'Course Leader' ? 'dashboard' : role === 'Mentor' ? 'mentees' : 'department'
}

export function canAccessPage(role: Role, page: string) {
  if (page === 'student-history' || page === 'student-shell' || page === 'risk-explorer' || page === 'queue-history' || page === 'faculty-profile') return true
  if (page === 'scheme-setup') return role === 'Course Leader'
  if (page === 'unlock-review') return role === 'HoD'
  if (page === 'mentee-detail') return role === 'Mentor'
  if (role === 'Course Leader') return ['dashboard', 'students', 'course', 'calendar', 'upload', 'entry-workspace'].includes(page)
  if (role === 'Mentor') return ['mentees', 'calendar'].includes(page)
  return ['department', 'course', 'calendar', 'unlock-review'].includes(page)
}

export function resolveRoleSyncState(input: {
  allowedRoles: Role[]
  initialRole: Role
  role: Role
  page: string
}) {
  const { allowedRoles, initialRole, role, page } = input
  if (allowedRoles.length === 0) return null

  const nextRole = allowedRoles.includes(initialRole)
    ? initialRole
    : allowedRoles.includes(role)
      ? role
      : allowedRoles[0]

  if (nextRole !== role) {
    return {
      role: nextRole,
      page: getHomePage(nextRole),
    }
  }

  if (!canAccessPage(nextRole, page)) {
    return {
      role: nextRole,
      page: getHomePage(nextRole),
    }
  }

  return null
}

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
