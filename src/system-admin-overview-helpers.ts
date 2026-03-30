import type { ApiRoleGrant } from './api/types'
import {
  deriveCurrentYearLabel,
  hasHierarchyScopeSelection,
  isOfferingVisible,
  isFacultyMemberVisible,
  isStudentVisible,
  isTermVisible,
  isVisibleAdminRecord,
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  type LiveAdminDataset,
  type LiveAdminSearchScope,
} from './system-admin-live-data'

export type HierarchyScopeInput = {
  academicFacultyId?: string | null
  departmentId?: string | null
  branchId?: string | null
  batchId?: string | null
  sectionCode?: string | null
}

export type OverviewScopedCounts = {
  studentCount: number
  mentoredCount: number
  mentorGapCount: number
  facultyCount: number
  ownershipCount: number
}

export function isLeaderLikeOwnership(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized.includes('course') || normalized.includes('leader') || normalized.includes('owner') || normalized.includes('primary')
}

export function isCurrentRoleGrant(grant: ApiRoleGrant) {
  return grant.status === 'active'
}

export function describeRegistryScope(data: LiveAdminDataset, scope?: LiveAdminSearchScope | null) {
  if (!hasHierarchyScopeSelection(scope)) return null
  if (scope?.sectionCode) {
    const branch = resolveBranch(data, scope.branchId)
    const batch = resolveBatch(data, scope.batchId)
    return [`Section ${scope.sectionCode}`, batch ? `Batch ${batch.batchLabel}` : null, branch?.code ?? null].filter(Boolean).join(' · ')
  }
  if (scope?.batchId) {
    const batch = resolveBatch(data, scope.batchId)
    const branch = resolveBranch(data, scope.branchId)
    if (!batch) return branch?.name ?? 'Selected year'
    return [`${deriveCurrentYearLabel(batch.currentSemester)}`, `Batch ${batch.batchLabel}`, branch?.code ?? null].filter(Boolean).join(' · ')
  }
  if (scope?.branchId) return resolveBranch(data, scope.branchId)?.name ?? 'Selected branch'
  if (scope?.departmentId) return resolveDepartment(data, scope.departmentId)?.name ?? 'Selected department'
  if (scope?.academicFacultyId) return resolveAcademicFaculty(data, scope.academicFacultyId)?.name ?? 'Selected faculty'
  return null
}

export function matchesStudentScope(student: LiveAdminDataset['students'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
  if (!scope) return true
  const context = student.activeAcademicContext
  if (!context) return false
  if (scope.academicFacultyId) {
    const department = context.departmentId ? resolveDepartment(data, context.departmentId) : null
    if (department?.academicFacultyId !== scope.academicFacultyId) return false
  }
  if (scope.departmentId && context.departmentId !== scope.departmentId) return false
  if (scope.branchId && context.branchId !== scope.branchId) return false
  if (scope.batchId && context.batchId !== scope.batchId) return false
  if (scope.sectionCode && context.sectionCode !== scope.sectionCode) return false
  return true
}

export function matchesFacultyScope(member: LiveAdminDataset['facultyMembers'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
  if (!scope) return true
  const hasScopedSelection = Boolean(scope.academicFacultyId || scope.departmentId || scope.branchId || scope.batchId || scope.sectionCode)
  if (!hasScopedSelection) return true

  const batchTermIds = scope.batchId
    ? new Set(
        data.terms
          .filter(item => item.batchId === scope.batchId && isTermVisible(data, item))
          .map(item => item.termId),
      )
    : null

  const appointmentMatch = member.appointments.some(appointment => {
    if (!isVisibleAdminRecord(appointment.status)) return false
    if (scope.departmentId && appointment.departmentId !== scope.departmentId) return false
    if (scope.branchId && appointment.branchId !== scope.branchId) return false
    if (scope.academicFacultyId) {
      const department = resolveDepartment(data, appointment.departmentId)
      if (department?.academicFacultyId !== scope.academicFacultyId) return false
    }
    return true
  })

  const ownershipMatch = data.ownerships.some(ownership => {
    if (ownership.facultyId !== member.facultyId || ownership.status !== 'active') return false
    const offering = data.offerings.find(item => item.offId === ownership.offeringId)
    if (!offering || !isOfferingVisible(data, offering)) return false
    const matchedDepartment = data.departments.find(item => item.code.toLowerCase() === offering.dept.toLowerCase())
    if (scope.academicFacultyId && matchedDepartment?.academicFacultyId !== scope.academicFacultyId) return false
    if (scope.departmentId && matchedDepartment?.departmentId !== scope.departmentId) return false
    if (scope.branchId && offering.branchId !== scope.branchId) return false
    if (batchTermIds && (!offering.termId || !batchTermIds.has(offering.termId))) return false
    if (scope.sectionCode && offering.section !== scope.sectionCode) return false
    return true
  })

  return appointmentMatch || ownershipMatch
}

export function matchesOfferingScope(offering: LiveAdminDataset['offerings'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
  if (!scope) return true
  const hasScopedSelection = Boolean(scope.academicFacultyId || scope.departmentId || scope.branchId || scope.batchId || scope.sectionCode)
  if (!hasScopedSelection) return true
  if (!isOfferingVisible(data, offering)) return false

  const branch = offering.branchId ? resolveBranch(data, offering.branchId) : null
  const department = branch
    ? resolveDepartment(data, branch.departmentId)
    : data.departments.find(item => item.code.toLowerCase() === offering.dept.toLowerCase()) ?? null
  const term = offering.termId ? data.terms.find(item => item.termId === offering.termId) ?? null : null

  if (scope.academicFacultyId && department?.academicFacultyId !== scope.academicFacultyId) return false
  if (scope.departmentId && department?.departmentId !== scope.departmentId) return false
  if (scope.branchId && offering.branchId !== scope.branchId) return false
  if (scope.batchId && term?.batchId !== scope.batchId) return false
  if (scope.sectionCode && offering.section !== scope.sectionCode) return false
  return true
}

export function computeOverviewScopedCounts(
  data: LiveAdminDataset,
  scope: LiveAdminSearchScope | null,
): OverviewScopedCounts {
  const visibleFacultyMembers = data.facultyMembers.filter(item => isFacultyMemberVisible(data, item))
  const visibleOfferings = data.offerings.filter(item => isOfferingVisible(data, item))
  const visibleOfferingById = new Map(visibleOfferings.map(item => [item.offId, item]))
  const activeVisibleOwnerships = data.ownerships.filter(item =>
    item.status === 'active' && isFacultyMemberVisible(data, item.facultyId) && visibleOfferingById.has(item.offeringId),
  )

  if (!scope || !hasHierarchyScopeSelection(scope)) {
    const globalStudents = data.students.filter(item => isStudentVisible(data, item))
    return {
      studentCount: globalStudents.length,
      mentoredCount: globalStudents.filter(item => item.activeMentorAssignment).length,
      mentorGapCount: globalStudents.filter(item => !item.activeMentorAssignment).length,
      facultyCount: 0,
      ownershipCount: 0,
    }
  }

  const scopedStudents = data.students
    .filter(item => isStudentVisible(data, item))
    .filter(item => matchesStudentScope(item, data, scope))

  const scopedFaculty = visibleFacultyMembers.filter(item => matchesFacultyScope(item, data, scope))

  const scopedOwnerships = activeVisibleOwnerships.filter(item => {
    const offering = visibleOfferingById.get(item.offeringId)
    return offering ? matchesOfferingScope(offering, data, scope) : false
  })

  return {
    studentCount: scopedStudents.length,
    mentoredCount: scopedStudents.filter(item => item.activeMentorAssignment).length,
    mentorGapCount: scopedStudents.filter(item => !item.activeMentorAssignment).length,
    facultyCount: scopedFaculty.length,
    ownershipCount: scopedOwnerships.length,
  }
}
