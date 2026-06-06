import { describe, expect, it } from 'vitest'
import type { Mentee } from '../src/data'
import type { FacultyAccount } from '../src/domain'
import type { ApiAcademicFacultyProfile } from '../src/api/types'
import { getMenteeScopeIds, resolveAssignedMentees } from '../src/academic-workspace-route-helpers'

const mentees: Mentee[] = [
  {
    id: 'mentee-student_001',
    usn: '1MS23MC001',
    name: 'Aarav Sharma',
    phone: '',
    year: 'I Year',
    section: 'A',
    dept: 'MNC',
    courseRisks: [],
    avs: -1,
    prevCgpa: 7.1,
    interventions: [],
  },
  {
    id: 'm2',
    usn: '1MS23MC002',
    name: 'Bhavana Rao',
    phone: '',
    year: 'I Year',
    section: 'A',
    dept: 'MNC',
    courseRisks: [],
    avs: -1,
    prevCgpa: 7.6,
    interventions: [],
  },
]

const teacher: FacultyAccount = {
  facultyId: 'mnc_t8',
  name: 'Mentor',
  initials: 'MT',
  allowedRoles: ['Mentor'],
  dept: 'MNC',
  roleTitle: 'Assistant Professor',
  email: 'mentor@example.edu',
  courseCodes: [],
  offeringIds: [],
  menteeIds: ['student_001', 'm2'],
}

const profile = {
  mentorScope: {
    activeStudentCount: 1,
    studentIds: ['student_001'],
  },
} as ApiAcademicFacultyProfile

describe('academic workspace route helpers', () => {
  it('normalizes raw and prefixed mentee ids to the same scope keys', () => {
    expect(getMenteeScopeIds('student_001')).toEqual(['student_001', 'mentee-student_001'])
    expect(getMenteeScopeIds('mentee-student_001')).toEqual(['mentee-student_001', 'student_001'])
  })

  it('resolves assigned mentees from live faculty profile ids and static faculty ids', () => {
    expect(resolveAssignedMentees(mentees, teacher, profile).map(mentee => mentee.id)).toEqual(['mentee-student_001'])
    expect(resolveAssignedMentees(mentees, teacher, null).map(mentee => mentee.id)).toEqual(['mentee-student_001', 'm2'])
  })
})
