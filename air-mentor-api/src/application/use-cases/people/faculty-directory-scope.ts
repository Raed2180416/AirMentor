/**
 * Faculty directory scope matching + scope-source selection. Pure functions
 * moved verbatim from modules/people.ts: they narrow the faculty list to a
 * requested academic-faculty/department/branch/batch/section, and pick the
 * single scope descriptor used to resolve proof provenance for a faculty record.
 */
import type { FacultyDirectoryScopeFilter } from './people-schemas.js'
import {
  isActiveRow,
  normalizeProvenanceScopeType,
  type FacultyRecord,
  type PeopleReferenceData,
} from './people-domain.js'

export function hasFacultyDirectoryScopeFilter(filter: FacultyDirectoryScopeFilter) {
  return Boolean(filter.academicFacultyId || filter.departmentId || filter.branchId || filter.batchId || filter.sectionCode)
}

export function matchesFacultyDirectoryScope(
  faculty: FacultyRecord,
  references: PeopleReferenceData,
  filter: FacultyDirectoryScopeFilter,
) {
  if (!hasFacultyDirectoryScopeFilter(filter)) return true

  const scopedBatch = filter.batchId ? references.batchById.get(filter.batchId) ?? null : null
  const scopedBranchId = filter.branchId ?? scopedBatch?.branchId ?? null
  const scopedDepartmentId = filter.departmentId
    ?? (scopedBranchId ? references.branchById.get(scopedBranchId)?.departmentId ?? null : null)
    ?? null
  const batchTermIds = filter.batchId
    ? new Set(
        Array.from(references.termById.values())
          .filter(item => item.batchId === filter.batchId)
          .map(item => item.termId),
      )
    : null
  const sectionScopeId = filter.batchId && filter.sectionCode
    ? `${filter.batchId}::${filter.sectionCode.trim().toUpperCase()}`
    : null

  const appointmentMatch = faculty.appointments.some(appointment => {
    if (!isActiveRow(appointment.status, appointment.endDate)) return false
    const department = references.departmentById.get(appointment.departmentId) ?? null
    if (filter.academicFacultyId && department?.academicFacultyId !== filter.academicFacultyId) return false
    if (scopedDepartmentId && appointment.departmentId !== scopedDepartmentId) return false
    if (scopedBranchId && appointment.branchId && appointment.branchId !== scopedBranchId) return false
    return true
  })

  const ownershipMatch = references.ownerships.some(ownership => {
    if (ownership.facultyId !== faculty.facultyId || ownership.status !== 'active') return false
    const offering = references.offeringById.get(ownership.offeringId) ?? null
    if (!offering) return false
    const term = references.termById.get(offering.termId) ?? null
    const department = offering.branchId ? references.branchById.get(offering.branchId)?.departmentId ?? null : null
    if (filter.academicFacultyId) {
      const academicFacultyId = department ? references.departmentById.get(department)?.academicFacultyId ?? null : null
      if (academicFacultyId !== filter.academicFacultyId) return false
    }
    if (scopedDepartmentId && department !== scopedDepartmentId) return false
    if (scopedBranchId && offering.branchId !== scopedBranchId) return false
    if (batchTermIds && (!term || !batchTermIds.has(term.termId))) return false
    if (filter.sectionCode && offering.sectionCode.trim().toUpperCase() !== filter.sectionCode.trim().toUpperCase()) return false
    return true
  })

  const grantMatch = faculty.roleGrants.some(grant => {
    if (!isActiveRow(grant.status, grant.endDate)) return false
    if (sectionScopeId && grant.scopeType === 'section' && grant.scopeId === sectionScopeId) return true
    if (filter.batchId && grant.scopeType === 'batch' && grant.scopeId === filter.batchId) return true
    if (scopedBranchId && grant.scopeType === 'branch' && grant.scopeId === scopedBranchId) return true
    if (scopedDepartmentId && grant.scopeType === 'department' && grant.scopeId === scopedDepartmentId) return true
    if (filter.academicFacultyId && grant.scopeType === 'academic-faculty' && grant.scopeId === filter.academicFacultyId) return true
    return false
  })

  return appointmentMatch || ownershipMatch || grantMatch
}

export function pickFacultyScopeSource(
  faculty: FacultyRecord,
  references: PeopleReferenceData,
): { scopeType: string; scopeId: string; label: string; batchId?: string; sectionCode?: string | null } | null {
  const activeOwnership = references.ownerships
    .filter(item => item.facultyId === faculty.facultyId && item.status === 'active')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt) || left.ownershipId.localeCompare(right.ownershipId))[0]
  if (activeOwnership) {
    const offering = references.offeringById.get(activeOwnership.offeringId)
    const term = offering ? references.termById.get(offering.termId) ?? null : null
    const batch = term?.batchId ? references.batchById.get(term.batchId) ?? null : null
    if (batch) {
      return {
        scopeType: 'section',
        scopeId: `${batch.batchId}::${offering?.sectionCode ?? ''}`.replace(/::$/, ''),
        label: batch.batchLabel,
        batchId: batch.batchId,
        sectionCode: offering?.sectionCode ?? null,
      }
    }
  }

  const activeBatchGrant = faculty.roleGrants.find(grant => grant.status === 'active' && grant.scopeType === 'batch')
  if (activeBatchGrant) {
    return {
      scopeType: 'batch',
      scopeId: activeBatchGrant.scopeId,
      label: activeBatchGrant.scopeLabel ?? activeBatchGrant.scopeId,
      batchId: activeBatchGrant.scopeId,
      sectionCode: null,
    }
  }

  const activeScopeGrant = faculty.roleGrants
    .filter(grant => isActiveRow(grant.status, grant.endDate))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.grantId.localeCompare(right.grantId))[0]
  if (activeScopeGrant) {
    const normalizedScopeType = normalizeProvenanceScopeType(activeScopeGrant.scopeType)
    return {
      scopeType: normalizedScopeType,
      scopeId: activeScopeGrant.scopeId,
      label: activeScopeGrant.scopeLabel ?? `${activeScopeGrant.scopeType}:${activeScopeGrant.scopeId}`,
      sectionCode: null,
    }
  }

  const primaryAppointment = faculty.appointments.find(appointment => appointment.isPrimary && appointment.status === 'active')
    ?? faculty.appointments.find(appointment => appointment.status === 'active')
    ?? null
  if (primaryAppointment?.branchId) {
    return {
      scopeType: 'branch',
      scopeId: primaryAppointment.branchId,
      label: primaryAppointment.branchName ?? primaryAppointment.branchId,
      sectionCode: null,
    }
  }
  if (primaryAppointment) {
    return {
      scopeType: 'department',
      scopeId: primaryAppointment.departmentId,
      label: primaryAppointment.departmentName ?? primaryAppointment.departmentId,
      sectionCode: null,
    }
  }
  if (references.institution) {
    return {
      scopeType: 'institution',
      scopeId: references.institution.institutionId,
      label: references.institution.name,
      sectionCode: null,
    }
  }
  return null
}
