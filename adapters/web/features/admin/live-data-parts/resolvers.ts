import type { LiveAdminDataset } from './types'

export function resolveAcademicFaculty(data: LiveAdminDataset, academicFacultyId?: string | null) {
  return academicFacultyId ? data.academicFaculties.find(item => item.academicFacultyId === academicFacultyId) ?? null : null
}

export function resolveDepartment(data: LiveAdminDataset, departmentId?: string | null) {
  return departmentId ? data.departments.find(item => item.departmentId === departmentId) ?? null : null
}

export function resolveBranch(data: LiveAdminDataset, branchId?: string | null) {
  return branchId ? data.branches.find(item => item.branchId === branchId) ?? null : null
}

export function resolveBatch(data: LiveAdminDataset, batchId?: string | null) {
  return batchId ? data.batches.find(item => item.batchId === batchId) ?? null : null
}

export function resolveStudent(data: LiveAdminDataset, studentId?: string | null) {
  return studentId ? data.students.find(item => item.studentId === studentId) ?? null : null
}

export function resolveFacultyMember(data: LiveAdminDataset, facultyMemberId?: string | null) {
  return facultyMemberId ? data.facultyMembers.find(item => item.facultyId === facultyMemberId) ?? null : null
}
