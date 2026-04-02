import type { ApiBatch } from './api/types'
import {
  hasHierarchyScopeSelection,
  type LiveAdminDataset,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
  type UniversityScopeState,
} from './system-admin-live-data'

export const CANONICAL_PROOF_ACADEMIC_FACULTY_ID = 'academic_faculty_engineering_and_technology'
export const CANONICAL_PROOF_DEPARTMENT_ID = 'dept_cse'
export const CANONICAL_PROOF_BRANCH_ID = 'branch_mnc_btech'
export const CANONICAL_PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'

export const CANONICAL_PROOF_ROUTE: LiveAdminRoute = {
  section: 'faculties',
  academicFacultyId: CANONICAL_PROOF_ACADEMIC_FACULTY_ID,
  departmentId: CANONICAL_PROOF_DEPARTMENT_ID,
  branchId: CANONICAL_PROOF_BRANCH_ID,
  batchId: CANONICAL_PROOF_BATCH_ID,
}

export type AuthoritativeOperationalSemesterSource = 'proof-run' | 'batch' | 'unavailable'

export function isCanonicalProofBatchId(batchId?: string | null) {
  return batchId === CANONICAL_PROOF_BATCH_ID
}

export function resolveCanonicalProofBatch(data: Pick<LiveAdminDataset, 'batches'>): ApiBatch | null {
  return data.batches.find(item => item.batchId === CANONICAL_PROOF_BATCH_ID) ?? null
}

export function resolveAuthoritativeOperationalSemester(input: {
  route: LiveAdminRoute
  selectedBatch?: Pick<ApiBatch, 'batchId' | 'currentSemester'> | null
  activeOperationalSemester?: number | null
}) {
  if (
    input.route.section === 'faculties'
    && isCanonicalProofBatchId(input.route.batchId)
    && input.activeOperationalSemester != null
  ) {
    return {
      semester: input.activeOperationalSemester,
      source: 'proof-run' as const satisfies AuthoritativeOperationalSemesterSource,
    }
  }

  if (input.selectedBatch?.currentSemester != null) {
    return {
      semester: input.selectedBatch.currentSemester,
      source: 'batch' as const satisfies AuthoritativeOperationalSemesterSource,
    }
  }

  return {
    semester: null,
    source: 'unavailable' as const satisfies AuthoritativeOperationalSemesterSource,
  }
}

export function routeTargetsCanonicalProofHierarchy(route: LiveAdminRoute) {
  if (route.section !== 'faculties') return false
  return !route.academicFacultyId
    || route.academicFacultyId === CANONICAL_PROOF_ACADEMIC_FACULTY_ID
    || route.departmentId === CANONICAL_PROOF_DEPARTMENT_ID
    || route.branchId === CANONICAL_PROOF_BRANCH_ID
    || isCanonicalProofBatchId(route.batchId)
}

export function shouldResolveCanonicalProofRoute(
  route: LiveAdminRoute,
  data: Pick<LiveAdminDataset, 'batches'>,
) {
  const canonicalProofBatch = resolveCanonicalProofBatch(data)
  if (!canonicalProofBatch) return false
  const routeBatchMissingOrInvalid = !route.batchId || !data.batches.some(item => item.batchId === route.batchId)
  return routeBatchMissingOrInvalid && routeTargetsCanonicalProofHierarchy(route)
}

function normalizeScopeValue(value?: string | null) {
  const normalized = value?.trim() ?? ''
  return normalized || undefined
}

function normalizeHierarchyScope(
  scope?: Pick<UniversityScopeState, 'academicFacultyId' | 'departmentId' | 'branchId' | 'batchId' | 'sectionCode'> | null,
): LiveAdminSearchScope | null {
  if (!scope) return null
  const normalizedScope = {
    academicFacultyId: normalizeScopeValue(scope.academicFacultyId),
    departmentId: normalizeScopeValue(scope.departmentId),
    branchId: normalizeScopeValue(scope.branchId),
    batchId: normalizeScopeValue(scope.batchId),
    sectionCode: normalizeScopeValue(scope.sectionCode),
  } satisfies LiveAdminSearchScope
  return hasHierarchyScopeSelection(normalizedScope) ? normalizedScope : null
}

export function resolveAdminDirectoryScopeFilter(input: {
  route: LiveAdminRoute
  registryScope?: Pick<UniversityScopeState, 'academicFacultyId' | 'departmentId' | 'branchId' | 'batchId' | 'sectionCode'> | null
  selectedSectionCode?: string | null
}): LiveAdminSearchScope | null {
  if (input.route.section === 'faculties' && routeTargetsCanonicalProofHierarchy(input.route)) {
    return {
      academicFacultyId: normalizeScopeValue(input.route.academicFacultyId) ?? CANONICAL_PROOF_ACADEMIC_FACULTY_ID,
      departmentId: normalizeScopeValue(input.route.departmentId) ?? CANONICAL_PROOF_DEPARTMENT_ID,
      branchId: normalizeScopeValue(input.route.branchId) ?? CANONICAL_PROOF_BRANCH_ID,
      batchId: normalizeScopeValue(input.route.batchId) ?? CANONICAL_PROOF_BATCH_ID,
      sectionCode: normalizeScopeValue(input.selectedSectionCode),
    }
  }

  if (input.route.section === 'faculties') {
    return normalizeHierarchyScope({
      academicFacultyId: input.route.academicFacultyId ?? null,
      departmentId: input.route.departmentId ?? null,
      branchId: input.route.branchId ?? null,
      batchId: input.route.batchId ?? null,
      sectionCode: input.selectedSectionCode ?? null,
    })
  }

  return normalizeHierarchyScope(input.registryScope ?? null)
}
