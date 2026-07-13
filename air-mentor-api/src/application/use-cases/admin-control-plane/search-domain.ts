/**
 * Admin-search domain — framework-free row shapes, pure helpers, and result
 * types for GET /api/admin/search.
 *
 * Row interfaces mirror exactly the columns the multi-table scan reads (matched
 * to db/schema nullability). The Drizzle rows the repository returns are
 * structural supersets, so they assign into these narrower shapes without a
 * mapping step — the scan below is moved verbatim from the legacy handler.
 */
export type SearchAcademicFacultyRow = {
  academicFacultyId: string
  code: string
  name: string
  overview: string | null
  status: string
}

export type SearchDepartmentRow = {
  departmentId: string
  academicFacultyId: string | null
  code: string
  name: string
  status: string
}

export type SearchBranchRow = {
  branchId: string
  departmentId: string
  code: string
  name: string
  programLevel: string
  status: string
}

export type SearchBatchRow = {
  batchId: string
  branchId: string
  admissionYear: number
  batchLabel: string
  currentSemester: number
  status: string
}

export type SearchStudentRow = {
  studentId: string
  usn: string
  name: string
  email: string | null
  status: string
}

export type SearchFacultyProfileRow = {
  facultyId: string
  userId: string
  employeeCode: string
  displayName: string
  designation: string
  status: string
}

export type SearchUserAccountRow = {
  userId: string
  username: string
  email: string
}

export type SearchCourseRow = {
  courseId: string
  courseCode: string
  title: string
  departmentId: string
  status: string
}

export type SearchAdminRequestRow = {
  adminRequestId: string
  requestType: string
  scopeType: string
  scopeId: string
  status: string
  summary: string
  details: string
}

export type SearchDataset = {
  academicFacultyRows: SearchAcademicFacultyRow[]
  departmentRows: SearchDepartmentRow[]
  branchRows: SearchBranchRow[]
  batchRows: SearchBatchRow[]
  studentRows: SearchStudentRow[]
  facultyRows: SearchFacultyProfileRow[]
  userRows: SearchUserAccountRow[]
  courseRows: SearchCourseRow[]
  requestRows: SearchAdminRequestRow[]
}

export type SearchInput = {
  q: string
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  sectionCode?: string
}

export type SearchResultItem = {
  key: string
  entityType: string
  entityId: string
  label: string
  meta: string
  route: Record<string, string>
}

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

export function isVisibleStatus(status?: string | null) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized !== 'archived' && normalized !== 'deleted'
}

export function deriveCurrentYearLabel(currentSemester: number) {
  const year = Math.max(1, Math.ceil(currentSemester / 2))
  if (year === 1) return '1st Year'
  if (year === 2) return '2nd Year'
  if (year === 3) return '3rd Year'
  return `${year}th Year`
}
