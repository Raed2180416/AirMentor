import type {
  ApiCurriculumCourse,
  ApiFacultyRecord,
  ApiMentorAssignment,
  ApiStudentEnrollment,
} from '@web/shared/api/types'
import type { LiveAdminDataset } from './types'
import { isVisibleAdminRecord } from './helpers'
import {
  isAcademicFacultyVisible,
  isBatchVisible,
  isBranchVisible,
  isDepartmentVisible,
  isOfferingVisible,
  isTermVisible,
} from './visibility'

export function listDepartmentsForAcademicFaculty(data: LiveAdminDataset, academicFacultyId?: string | null) {
  if (academicFacultyId && !isAcademicFacultyVisible(data, academicFacultyId)) return []
  return data.departments.filter(item => item.academicFacultyId === (academicFacultyId ?? null) && isDepartmentVisible(data, item))
}

export function listBranchesForDepartment(data: LiveAdminDataset, departmentId?: string | null) {
  if (departmentId && !isDepartmentVisible(data, departmentId)) return []
  return data.branches.filter(item => item.departmentId === departmentId && isBranchVisible(data, item))
}

export function listBatchesForBranch(data: LiveAdminDataset, branchId?: string | null) {
  if (branchId && !isBranchVisible(data, branchId)) return []
  return data.batches
    .filter(item => item.branchId === branchId && isBatchVisible(data, item))
    .sort((left, right) => right.admissionYear - left.admissionYear)
}

export function listTermsForBatch(data: LiveAdminDataset, batchId?: string | null) {
  if (batchId && !isBatchVisible(data, batchId)) return []
  return data.terms
    .filter(item => item.batchId === batchId && isTermVisible(data, item))
    .sort((left, right) => left.semesterNumber - right.semesterNumber || left.startDate.localeCompare(right.startDate))
}

export function listCurriculumBySemester(data: LiveAdminDataset, batchId?: string | null) {
  if (batchId && !isBatchVisible(data, batchId)) return []
  const semesters = new Map<number, ApiCurriculumCourse[]>()
  for (const item of data.curriculumCourses.filter(course => course.batchId === batchId && isVisibleAdminRecord(course.status))) {
    const bucket = semesters.get(item.semesterNumber) ?? []
    bucket.push(item)
    semesters.set(item.semesterNumber, bucket)
  }
  return Array.from(semesters.entries())
    .sort(([left], [right]) => left - right)
    .map(([semesterNumber, courses]) => ({
      semesterNumber,
      courses: courses.sort((left, right) => left.courseCode.localeCompare(right.courseCode)),
    }))
}

export function getPrimaryAppointmentDepartmentId(facultyMember: ApiFacultyRecord) {
  return facultyMember.appointments.find(item => item.isPrimary)?.departmentId ?? null
}

export function findLatestEnrollment(student: {
  enrollments: ApiStudentEnrollment[]
  activeAcademicContext: { enrollmentId: string } | null
}) {
  const activeEnrollmentId = student.activeAcademicContext?.enrollmentId ?? null
  if (!activeEnrollmentId) return null
  return student.enrollments.find(item => item.enrollmentId === activeEnrollmentId) ?? null
}

export function findLatestMentorAssignment(student: {
  mentorAssignments: ApiMentorAssignment[]
  activeMentorAssignment: ApiMentorAssignment | null
}) {
  return student.activeMentorAssignment ?? null
}

export function listFacultyAssignments(data: LiveAdminDataset, facultyId: string) {
  return data.ownerships
    .filter(item => item.facultyId === facultyId && item.status === 'active')
    .map(item => {
      const offering = data.offerings.find(candidate => candidate.offId === item.offeringId) ?? null
      return {
        ownership: item,
        offering,
      }
    })
    .filter(item => item.offering && isOfferingVisible(data, item.offering))
}
