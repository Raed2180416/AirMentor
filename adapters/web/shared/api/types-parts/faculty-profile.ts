// Composite academic faculty profile contract.
// Extracted verbatim from '../types'.

import type { FacultyTimetableTemplate } from '@kernel/shared/domain'
import type { ApiRoleGrant } from './session'
import type { ApiFacultyAppointment } from './hierarchy'
import type { ApiAdminFacultyCalendarWorkspace } from './calendar'
import type { ApiFacultyProofOperations } from './faculty-proof-ops'

export type ApiAcademicFacultyProfile = {
  facultyId: string
  displayName: string
  designation: string
  employeeCode: string
  joinedOn: string | null
  email: string
  phone: string | null
  primaryDepartment: {
    departmentId: string
    name: string
    code: string
  } | null
  appointments: ApiFacultyAppointment[]
  permissions: ApiRoleGrant[]
  subjectRunCourseLeaderScope: Array<{
    subjectRunId: string
    courseCode: string
    title: string
    termId: string
    yearLabel: string
    sectionCodes: string[]
  }>
  mentorScope: {
    activeStudentCount: number
    studentIds: string[]
  }
  currentOwnedClasses: Array<{
    offeringId: string
    courseCode: string
    title: string
    yearLabel: string
    sectionCode: string
    ownershipRole: string
    departmentName: string | null
    branchName: string | null
  }>
  currentBatchContexts: Array<{
    batchId: string
    batchLabel: string
    branchName: string | null
    currentSemester: number
    sectionCodes: string[]
    roleCoverage: string[]
  }>
  timetableStatus: {
    hasTemplate: boolean
    publishedAt: string | null
    directEditWindowEndsAt: string | null
  }
  timetableTemplate?: FacultyTimetableTemplate | null
  calendarWorkspace?: ApiAdminFacultyCalendarWorkspace | null
  requestSummary: {
    openCount: number
    recent: Array<{
      adminRequestId: string
      summary: string
      status: string
      updatedAt: string
    }>
  }
  reassessmentSummary: {
    openCount: number
    nextDueAt: string | null
    recentDecisionTypes: string[]
  }
  proofOperations: ApiFacultyProofOperations
}
