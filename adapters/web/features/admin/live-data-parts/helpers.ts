import type {
  LiveAdminSearchScope,
  RegistryFilterState,
  UniversityScopeState,
} from './types'

export function hasHierarchyScopeSelection(scope?: LiveAdminSearchScope | null) {
  return Boolean(scope?.academicFacultyId || scope?.departmentId || scope?.branchId || scope?.batchId || scope?.sectionCode)
}

export function deriveCurrentYearLabel(currentSemester: number) {
  const year = Math.max(1, Math.ceil(currentSemester / 2))
  if (year === 1) return '1st Year'
  if (year === 2) return '2nd Year'
  if (year === 3) return '3rd Year'
  return `${year}th Year`
}

export function isVisibleAdminRecord(status?: string | null) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized !== 'archived' && normalized !== 'deleted' && normalized !== 'hidden'
}

export function compareAdminTimestampsDesc(left?: string | null, right?: string | null) {
  const leftValue = left?.trim() ?? ''
  const rightValue = right?.trim() ?? ''
  if (!leftValue && !rightValue) return 0
  if (!leftValue) return 1
  if (!rightValue) return -1
  return rightValue.localeCompare(leftValue)
}

export function defaultRegistryFilter(): RegistryFilterState {
  return {
    academicFacultyId: '',
    departmentId: '',
    branchId: '',
    batchId: '',
    sectionCode: '',
  }
}

export function hydrateRegistryFilter(scope: UniversityScopeState | null): RegistryFilterState {
  return {
    academicFacultyId: scope?.academicFacultyId ?? '',
    departmentId: scope?.departmentId ?? '',
    branchId: scope?.branchId ?? '',
    batchId: scope?.batchId ?? '',
    sectionCode: scope?.sectionCode ?? '',
  }
}
