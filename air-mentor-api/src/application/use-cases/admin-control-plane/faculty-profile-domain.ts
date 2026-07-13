/**
 * Faculty-profile domain — framework-free row shapes + dataset contract for
 * GET /api/academic/faculty-profile/:facultyId.
 *
 * Each row interface lists exactly the columns the projection reads (matched to
 * db/schema nullability). The repository loads Drizzle rows (structural
 * supersets) and returns them as this dataset; the pre-mapped calendar
 * template/workspace fields keep the parse-mapping in the persistence layer.
 */
import type { FacultyCalendarTemplate, FacultyCalendarWorkspace } from './faculty-calendar-domain.js'

export type FacultyProfileRow = {
  facultyId: string
  userId: string
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
}

export type FacultyProfileUserRow = {
  userId: string
  email: string
  phone: string | null
}

export type FacultyProfileAppointmentRow = {
  appointmentId: string
  facultyId: string
  departmentId: string
  branchId: string | null
  isPrimary: number
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type FacultyProfileAcademicFacultyRow = {
  academicFacultyId: string
  name: string
}

export type FacultyProfileDepartmentRow = {
  departmentId: string
  name: string
  code: string
  academicFacultyId: string | null
}

export type FacultyProfileBatchRow = {
  batchId: string
  batchLabel: string
  currentSemester: number
  branchId: string
}

export type FacultyProfileRoleGrantRow = {
  grantId: string
  facultyId: string
  roleCode: string
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type FacultyProfileMentorAssignmentRow = {
  studentId: string
  effectiveTo: string | null
}

export type FacultyProfileOwnershipRow = {
  offeringId: string
  ownershipRole: string
  status: string
}

export type FacultyProfileOfferingRow = {
  offeringId: string
  courseId: string
  branchId: string
  termId: string
  sectionCode: string
  yearLabel: string
}

export type FacultyProfileCourseRow = {
  courseId: string
  courseCode: string
  title: string
}

export type FacultyProfileBranchRow = {
  branchId: string
  name: string
  code: string
  departmentId: string
}

export type FacultyProfileTermRow = {
  termId: string
  batchId: string | null
  semesterNumber: number
}

export type FacultyProfileAdminRequestRow = {
  adminRequestId: string
  requestedByFacultyId: string
  ownedByFacultyId: string | null
  summary: string
  status: string
  updatedAt: string
}

export type FacultyProfileReassessmentRow = {
  riskAssessmentId: string
  studentId: string
  offeringId: string | null
  status: string
  dueAt: string
}

export type FacultyProfileAlertDecisionRow = {
  riskAssessmentId: string
  decisionType: string
  updatedAt: string
}

export type FacultyProfileEnrollmentRow = {
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  academicStatus: string
}

export type FacultyProfileDataset = {
  profileRows: FacultyProfileRow[]
  userRows: FacultyProfileUserRow[]
  appointmentRows: FacultyProfileAppointmentRow[]
  academicFacultyRows: FacultyProfileAcademicFacultyRow[]
  departmentRows: FacultyProfileDepartmentRow[]
  batchRows: FacultyProfileBatchRow[]
  roleGrantRows: FacultyProfileRoleGrantRow[]
  assignmentRows: FacultyProfileMentorAssignmentRow[]
  ownershipRows: FacultyProfileOwnershipRow[]
  offeringRows: FacultyProfileOfferingRow[]
  courseRows: FacultyProfileCourseRow[]
  branchRows: FacultyProfileBranchRow[]
  termRows: FacultyProfileTermRow[]
  requestRows: FacultyProfileAdminRequestRow[]
  reassessmentRows: FacultyProfileReassessmentRow[]
  alertDecisionRows: FacultyProfileAlertDecisionRow[]
  enrollmentRows: FacultyProfileEnrollmentRow[]
  viewerAppointmentRows: FacultyProfileAppointmentRow[]
  teacherLocalTemplate: FacultyCalendarTemplate | null
  canonicalTemplate: FacultyCalendarTemplate | null
  calendarWorkspace: FacultyCalendarWorkspace | null
  timetableUpdatedAt: string | null
}

export function isLeaderLikeOwnershipRole(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized.includes('course') || normalized.includes('leader') || normalized.includes('owner') || normalized.includes('primary')
}
