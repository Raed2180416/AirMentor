import type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiAdminOffering,
  ApiAdminRequestSummary,
  ApiAdminReminder,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiOfferingOwnership,
  ApiPolicyOverride,
  ApiResolvedBatchPolicy,
  ApiStudentRecord,
} from '@web/shared/api/types'

export type UniversityScopeState = {
  academicFacultyId: string | null
  departmentId: string | null
  branchId: string | null
  batchId: string | null
  sectionCode: string | null
  label: string
}

export type RegistryFilterState = {
  academicFacultyId: string
  departmentId: string
  branchId: string
  batchId: string
  sectionCode: string
}

export type LiveAdminProofProvenance = Pick<
  ApiResolvedBatchPolicy,
  'scopeDescriptor' | 'resolvedFrom' | 'scopeMode' | 'countSource' | 'activeOperationalSemester'
>

export type LiveAdminSectionId = 'overview' | 'proof-dashboard' | 'faculties' | 'students' | 'faculty-members' | 'requests' | 'history'

export type LiveAdminDataset = {
  institution: ApiInstitution | null
  academicFaculties: ApiAcademicFaculty[]
  departments: ApiDepartment[]
  branches: ApiBranch[]
  batches: ApiBatch[]
  terms: ApiAcademicTerm[]
  facultyMembers: ApiFacultyRecord[]
  students: ApiStudentRecord[]
  courses: ApiCourse[]
  curriculumCourses: ApiCurriculumCourse[]
  policyOverrides: ApiPolicyOverride[]
  offerings: ApiAdminOffering[]
  ownerships: ApiOfferingOwnership[]
  requests: ApiAdminRequestSummary[]
  reminders: ApiAdminReminder[]
}

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

export type LiveAdminSearchResult = {
  key: string
  label: string
  meta: string
  route: LiveAdminRoute
}

export type LiveAdminSearchScope = {
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  sectionCode?: string
}

export type LiveAdminSearchOptions = {
  section?: LiveAdminSectionId
  scope?: LiveAdminSearchScope | null
}
