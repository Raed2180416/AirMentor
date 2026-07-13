export type Role = 'Course Leader' | 'Mentor' | 'HoD'

export type ApiRoleCode = 'SYSTEM_ADMIN' | 'HOD' | 'COURSE_LEADER' | 'MENTOR'

export function roleFromApiCode(code: ApiRoleCode): Role | null {
  switch (code) {
    case 'HOD': return 'HoD'
    case 'COURSE_LEADER': return 'Course Leader'
    case 'MENTOR': return 'Mentor'
    default: return null
  }
}

export function apiCodeFromRole(role: Role): ApiRoleCode {
  switch (role) {
    case 'HoD': return 'HOD'
    case 'Course Leader': return 'COURSE_LEADER'
    case 'Mentor': return 'MENTOR'
  }
}

export type FacultyCapabilitySet = {
  canApproveUnlock: boolean
  canEditMarks: boolean
}

export function capabilitiesForRole(role: Role | null | undefined): FacultyCapabilitySet {
  switch (role) {
    case 'HoD': return { canApproveUnlock: true, canEditMarks: true }
    case 'Course Leader': return { canApproveUnlock: true, canEditMarks: true }
    case 'Mentor': return { canApproveUnlock: false, canEditMarks: false }
    default: return { canApproveUnlock: false, canEditMarks: false }
  }
}
