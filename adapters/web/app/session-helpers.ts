import type { Role } from '@kernel/shared/domain'
import type { ApiAcademicBootstrap, ApiSessionResponse } from '@web/shared/api/types'

export function mapApiRoleToRole(roleCode: ApiSessionResponse['activeRoleGrant']['roleCode']): Role | null {
  if (roleCode === 'COURSE_LEADER') return 'Course Leader'
  if (roleCode === 'MENTOR') return 'Mentor'
  if (roleCode === 'HOD') return 'HoD'
  return null
}

export function restrictVisibleFacultyOptions<T extends { facultyId: string; username?: string; name?: string; displayName?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftLabel = (left.displayName ?? left.name ?? left.username ?? left.facultyId).toLowerCase()
    const rightLabel = (right.displayName ?? right.name ?? right.username ?? right.facultyId).toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
}

export function restrictAcademicBootstrap(snapshot: ApiAcademicBootstrap): ApiAcademicBootstrap {
  const visibleFaculty = restrictVisibleFacultyOptions(snapshot.faculty)
  const visibleTeacherIds = new Set(visibleFaculty.map(account => account.facultyId))
  return {
    ...snapshot,
    faculty: visibleFaculty,
    teachers: snapshot.teachers.filter(teacher => visibleTeacherIds.has(teacher.id)),
  }
}

export function getAcademicApiBaseUrl() {
  return import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
}

export function readPasswordSetupTokenFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const token = params.get('password-setup-token')
  return token?.trim() || null
}

export function clearPasswordSetupTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('password-setup-token')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
