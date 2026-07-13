// Institution + academic hierarchy (faculty org, departments, branches,
// batches, terms), faculty/appointment/student records, mentor assignments,
// and course/curriculum-course contracts. Extracted verbatim from '../types'.

import type {
  ApiFacultyCredentialStatus,
  ApiRoleGrant,
} from './session'
import type {
  ApiCountSource,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
} from './policy'

export type ApiInstitution = {
  institutionId: string
  name: string
  timezone: string
  academicYearStartMonth: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicFaculty = {
  academicFacultyId: string
  institutionId: string
  code: string
  name: string
  overview: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiDepartment = {
  departmentId: string
  institutionId: string
  academicFacultyId: string | null
  code: string
  name: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBranch = {
  branchId: string
  departmentId: string
  code: string
  name: string
  programLevel: string
  semesterCount: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatch = {
  batchId: string
  branchId: string
  admissionYear: number
  batchLabel: string
  currentSemester: number
  sectionLabels: string[]
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicTerm = {
  termId: string
  branchId: string
  batchId: string | null
  academicYearLabel: string
  semesterNumber: number
  startDate: string
  endDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyAppointment = {
  appointmentId: string
  facultyId: string
  departmentId: string
  departmentName?: string | null
  departmentCode?: string | null
  branchId: string | null
  branchName?: string | null
  branchCode?: string | null
  isPrimary: boolean
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyRecord = {
  facultyId: string
  userId: string
  username: string
  email: string
  phone: string | null
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
  credentialStatus: ApiFacultyCredentialStatus
  scopeDescriptor?: ApiScopeDescriptor | null
  resolvedFrom?: ApiResolvedFrom | null
  scopeMode?: ApiScopeMode | null
  countSource?: ApiCountSource | null
  activeOperationalSemester?: number | null
  appointments: ApiFacultyAppointment[]
  roleGrants: ApiRoleGrant[]
}

export type ApiStudentEnrollment = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder?: number
  academicStatus: string
  startDate: string
  endDate: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiMentorAssignment = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiMentorAssignmentBulkApplySelectionMode = 'missing-only' | 'replace-all'

export type ApiMentorAssignmentBulkApplyRequest = {
  batchId: string
  sectionCode?: string | null
  facultyId: string
  effectiveFrom: string
  source: string
  selectionMode?: ApiMentorAssignmentBulkApplySelectionMode
  previewOnly?: boolean
  expectedStudentIds?: string[]
}

export type ApiMentorAssignmentBulkApplyStudent = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string | null
  currentMentorFacultyId: string | null
  currentMentorAssignmentId: string | null
  action: 'assign' | 'reassign' | 'keep'
  actionReason: string
}

export type ApiMentorAssignmentBulkApplyResponse = {
  ok: true
  preview: boolean
  bulkApplyId: string | null
  batchId: string
  batchLabel: string
  sectionCode: string | null
  facultyId: string
  facultyDisplayName: string
  scopeLabel: string
  effectiveFrom: string
  source: string
  selectionMode: ApiMentorAssignmentBulkApplySelectionMode
  mentorEligibility: {
    eligible: boolean
    appointmentInScope: boolean
    mentorGrantInScope: boolean
    reasons: string[]
  }
  studentIds: string[]
  summary: {
    targetedStudentCount: number
    unchangedCount: number
    endedAssignmentCount: number
    createdAssignmentCount: number
  }
  students: ApiMentorAssignmentBulkApplyStudent[]
}

export type ApiStudentRecord = {
  studentId: string
  institutionId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
  currentCgpa: number
  scopeDescriptor?: ApiScopeDescriptor | null
  resolvedFrom?: ApiResolvedFrom | null
  scopeMode?: ApiScopeMode | null
  countSource?: ApiCountSource | null
  activeOperationalSemester?: number | null
  activeAcademicContext: {
    enrollmentId: string
    branchId: string
    branchName: string | null
    departmentId: string | null
    departmentName: string | null
    termId: string
    academicYearLabel: string | null
    semesterNumber: number | null
    sectionCode: string
    batchId: string | null
    batchLabel: string | null
    admissionYear: number | null
    academicStatus: string
  } | null
  activeMentorAssignment: ApiMentorAssignment | null
  enrollments: ApiStudentEnrollment[]
  mentorAssignments: ApiMentorAssignment[]
}

export type ApiCourse = {
  courseId: string
  institutionId: string
  courseCode: string
  title: string
  defaultCredits: number
  departmentId: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumCourse = {
  curriculumCourseId: string
  batchId: string
  semesterNumber: number
  courseId: string | null
  courseCode: string
  title: string
  credits: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}
