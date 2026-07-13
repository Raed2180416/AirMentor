import type { ApiAuditEvent } from '@web/shared/api/types'
import { T } from '@web/simulation/fixtures'
import type { LiveAdminRoute } from '../system-admin-live-data'
import { routeToHash } from '../live-app-routes-and-scopes'

export const ADMIN_SECTION_TONES = {
  overview: T.accent,
  faculties: T.success,
  students: T.blue,
  'faculty-members': T.orange,
  requests: T.warning,
  history: T.danger,
} as const
export const ADMIN_DISMISSED_QUEUE_STORAGE_KEY = 'airmentor-admin-dismissed-queue-items'
export const ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT = 1400

export type StudentDetailTab = 'profile' | 'academic' | 'mentor' | 'progression' | 'history'
export type FacultyDetailTab = 'profile' | 'appointments' | 'permissions' | 'teaching' | 'timetable' | 'history'
export type UniversityTab = 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'stage' | 'courses' | 'curriculum'
export const UNIVERSITY_TABS = new Set<UniversityTab>(['overview', 'bands', 'ce-see', 'cgpa', 'stage', 'courses', 'curriculum'])

export function isUniversityTab(value: unknown): value is UniversityTab {
  return typeof value === 'string' && UNIVERSITY_TABS.has(value as UniversityTab)
}

export type EditingEntity =
  | 'academic-faculty'
  | 'department'
  | 'branch'
  | 'batch'
  | 'batch'
  | 'student-profile'
  | 'student-enrollment'
  | 'student-mentor'
  | 'faculty-profile'
  | 'faculty-appointment'
  | 'faculty-permission'

export type AdminWorkspaceSnapshot = {
  route: LiveAdminRoute
  universityTab: UniversityTab
  selectedSectionCode: string | null
  scrollY: number
}

export function readSubmittedField(form: HTMLFormElement, fieldName: string, fallback = '') {
  const value = new FormData(form).get(fieldName)
  return typeof value === 'string' ? value : fallback
}

export function shouldHydrateHierarchyEditor(editingEntity: EditingEntity | null, target: Extract<EditingEntity, 'academic-faculty' | 'department' | 'branch' | 'batch'>) {
  return editingEntity !== target
}

export function getAuditEventRoute(event: ApiAuditEvent): LiveAdminRoute | null {
  if (event.entityType === 'Student' || event.entityType === 'StudentEnrollment' || event.entityType === 'MentorAssignment') {
    const studentId = event.entityType === 'Student'
      ? event.entityId
      : typeof event.after === 'object' && event.after && 'studentId' in event.after
        ? String((event.after as { studentId?: unknown }).studentId ?? '')
        : typeof event.before === 'object' && event.before && 'studentId' in event.before
          ? String((event.before as { studentId?: unknown }).studentId ?? '')
          : ''
    return studentId ? { section: 'students', studentId } : null
  }
  if (event.entityType === 'FacultyProfile' || event.entityType === 'FacultyAppointment' || event.entityType === 'RoleGrant' || event.entityType === 'faculty_offering_ownership' || event.entityType === 'FacultyTimetableAdmin') {
    const facultyMemberId = event.entityType === 'FacultyProfile' || event.entityType === 'FacultyTimetableAdmin'
      ? event.entityId
      : typeof event.after === 'object' && event.after && 'facultyId' in event.after
        ? String((event.after as { facultyId?: unknown }).facultyId ?? '')
        : typeof event.before === 'object' && event.before && 'facultyId' in event.before
          ? String((event.before as { facultyId?: unknown }).facultyId ?? '')
          : ''
    return facultyMemberId ? { section: 'faculty-members', facultyMemberId } : null
  }
  if (event.entityType === 'AdminRequest') return { section: 'requests', requestId: event.entityId }
  return null
}

export function createAdminWorkspaceSnapshot(input: Omit<AdminWorkspaceSnapshot, 'scrollY'>): AdminWorkspaceSnapshot {
  return {
    ...input,
    scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
  }
}

export function getAdminWorkspaceSnapshotKey(snapshot: Omit<AdminWorkspaceSnapshot, 'scrollY'> | AdminWorkspaceSnapshot) {
  return `${routeToHash(snapshot.route)}::${snapshot.universityTab}::${snapshot.selectedSectionCode ?? ''}`
}
