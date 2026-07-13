export type ApiScopeType =
  | 'institution'
  | 'academic-faculty'
  | 'department'
  | 'branch'
  | 'batch'
  | 'section'
  | 'offering'
  | 'student'
  | 'faculty'

export type UniversityScopeState = {
  academicFacultyId: string | null
  departmentId: string | null
  branchId: string | null
  batchId: string | null
  sectionCode: string | null
  label: string
}

export type LiveAdminSearchScope = {
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  sectionCode?: string
}

export type LiveAdminSectionId =
  | 'overview'
  | 'proof-dashboard'
  | 'faculties'
  | 'students'
  | 'faculty-members'
  | 'requests'
  | 'history'

export type LiveAdminRoute = {
  section: LiveAdminSectionId
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

export type LiveAdminSearchOptions = {
  section?: LiveAdminSectionId
  scope?: LiveAdminSearchScope | null
}

export function hasHierarchyScopeSelection(scope?: LiveAdminSearchScope | null) {
  return Boolean(
    scope?.academicFacultyId
    || scope?.departmentId
    || scope?.branchId
    || scope?.batchId
    || scope?.sectionCode,
  )
}
