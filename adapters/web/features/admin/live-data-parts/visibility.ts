import type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiAdminOffering,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiStudentRecord,
} from '@web/shared/api/types'
import type { LiveAdminDataset } from './types'
import { isVisibleAdminRecord } from './helpers'
import {
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  resolveFacultyMember,
  resolveStudent,
} from './resolvers'

function toAcademicFaculty(data: LiveAdminDataset, candidate?: ApiAcademicFaculty | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveAcademicFaculty(data, candidate) : candidate
}

function toDepartment(data: LiveAdminDataset, candidate?: ApiDepartment | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveDepartment(data, candidate) : candidate
}

function toBranch(data: LiveAdminDataset, candidate?: ApiBranch | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveBranch(data, candidate) : candidate
}

function toBatch(data: LiveAdminDataset, candidate?: ApiBatch | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveBatch(data, candidate) : candidate
}

function toTerm(data: LiveAdminDataset, candidate?: ApiAcademicTerm | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? data.terms.find(item => item.termId === candidate) ?? null : candidate
}

function toCourse(data: LiveAdminDataset, candidate?: ApiCourse | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? data.courses.find(item => item.courseId === candidate) ?? null : candidate
}

function toOffering(data: LiveAdminDataset, candidate?: ApiAdminOffering | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? data.offerings.find(item => item.offId === candidate) ?? null : candidate
}

function toStudent(data: LiveAdminDataset, candidate?: ApiStudentRecord | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveStudent(data, candidate) : candidate
}

function toFacultyMember(data: LiveAdminDataset, candidate?: ApiFacultyRecord | string | null) {
  if (!candidate) return null
  return typeof candidate === 'string' ? resolveFacultyMember(data, candidate) : candidate
}

export function isAcademicFacultyVisible(data: LiveAdminDataset, candidate?: ApiAcademicFaculty | string | null) {
  const academicFaculty = toAcademicFaculty(data, candidate)
  return academicFaculty ? isVisibleAdminRecord(academicFaculty.status) : false
}

export function isDepartmentVisible(data: LiveAdminDataset, candidate?: ApiDepartment | string | null) {
  const department = toDepartment(data, candidate)
  if (!department || !isVisibleAdminRecord(department.status)) return false
  return !department.academicFacultyId || isAcademicFacultyVisible(data, department.academicFacultyId)
}

export function isBranchVisible(data: LiveAdminDataset, candidate?: ApiBranch | string | null) {
  const branch = toBranch(data, candidate)
  if (!branch || !isVisibleAdminRecord(branch.status)) return false
  return isDepartmentVisible(data, branch.departmentId)
}

export function isBatchVisible(data: LiveAdminDataset, candidate?: ApiBatch | string | null) {
  const batch = toBatch(data, candidate)
  if (!batch || !isVisibleAdminRecord(batch.status)) return false
  return isBranchVisible(data, batch.branchId)
}

export function isTermVisible(data: LiveAdminDataset, candidate?: ApiAcademicTerm | string | null) {
  const term = toTerm(data, candidate)
  if (!term || !isVisibleAdminRecord(term.status)) return false
  if (!isBranchVisible(data, term.branchId)) return false
  return !term.batchId || isBatchVisible(data, term.batchId)
}

export function isCourseVisible(data: LiveAdminDataset, candidate?: ApiCourse | string | null) {
  const course = toCourse(data, candidate)
  if (!course || !isVisibleAdminRecord(course.status)) return false
  return isDepartmentVisible(data, course.departmentId)
}

export function isOfferingVisible(data: LiveAdminDataset, candidate?: ApiAdminOffering | string | null) {
  const offering = toOffering(data, candidate)
  if (!offering) return false
  if (offering.branchId && !isBranchVisible(data, offering.branchId)) return false
  if (offering.termId && !isTermVisible(data, offering.termId)) return false
  return true
}

export function isStudentVisible(data: LiveAdminDataset, candidate?: ApiStudentRecord | string | null) {
  const student = toStudent(data, candidate)
  if (!student || !isVisibleAdminRecord(student.status)) return false
  const context = student.activeAcademicContext
  if (!context) return true
  if (context.batchId && !isBatchVisible(data, context.batchId)) return false
  if (context.branchId && !isBranchVisible(data, context.branchId)) return false
  if (context.departmentId && !isDepartmentVisible(data, context.departmentId)) return false
  return true
}

export function isFacultyMemberVisible(data: LiveAdminDataset, candidate?: ApiFacultyRecord | string | null) {
  const facultyMember = toFacultyMember(data, candidate)
  if (!facultyMember || !isVisibleAdminRecord(facultyMember.status)) return false
  const visibleAppointments = facultyMember.appointments.filter(item => isVisibleAdminRecord(item.status))
  if (visibleAppointments.length === 0) return true
  return visibleAppointments.some(appointment => {
    if (!isDepartmentVisible(data, appointment.departmentId)) return false
    return !appointment.branchId || isBranchVisible(data, appointment.branchId)
  })
}
