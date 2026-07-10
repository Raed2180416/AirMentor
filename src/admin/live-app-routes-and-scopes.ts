import type {
  ApiAcademicFaculty,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiScopeType,
} from '../api/types'
import type {
  LiveAdminDataset,
  LiveAdminRoute,
  LiveAdminSearchScope,
  RegistryFilterState,
} from '../system-admin-live-data'
import type { HierarchyScopeInput } from '../system-admin-overview-helpers'

export type ActiveAdminScope = {
  scopeType: ApiScopeType
  scopeId: string
  label: string
}

export function parseAdminRoute(hash: string): LiveAdminRoute {
  const cleaned = hash.replace(/^#\/admin/, '').replace(/^\/+/, '')
  if (!cleaned) return { section: 'overview' }
  const parts = cleaned.split('/').filter(Boolean)
  if (parts[0] === 'overview') return { section: 'overview' }
  if (parts[0] === 'proof-dashboard') return { section: 'proof-dashboard' }
  if (parts[0] === 'students') return { section: 'students', studentId: parts[1] }
  if (parts[0] === 'faculty-members') return { section: 'faculty-members', facultyMemberId: parts[1] }
  if (parts[0] === 'requests') return { section: 'requests', requestId: parts[1] }
  if (parts[0] === 'history') return { section: 'history' }
  if (parts[0] === 'faculties') {
    return {
      section: 'faculties',
      academicFacultyId: parts[1],
      departmentId: parts[2] === 'departments' ? parts[3] : undefined,
      branchId: parts[4] === 'branches' ? parts[5] : undefined,
      batchId: parts[6] === 'batches' ? parts[7] : undefined,
    }
  }
  return { section: 'overview' }
}

export function routeToHash(route: LiveAdminRoute) {
  if (route.section === 'overview') return '#/admin/overview'
  if (route.section === 'proof-dashboard') return '#/admin/proof-dashboard'
  if (route.section === 'students') return route.studentId ? `#/admin/students/${route.studentId}` : '#/admin/students'
  if (route.section === 'faculty-members') return route.facultyMemberId ? `#/admin/faculty-members/${route.facultyMemberId}` : '#/admin/faculty-members'
  if (route.section === 'requests') return route.requestId ? `#/admin/requests/${route.requestId}` : '#/admin/requests'
  if (route.section === 'history') return '#/admin/history'
  const segments = ['#/admin/faculties']
  if (route.academicFacultyId) segments.push(route.academicFacultyId)
  if (route.departmentId) segments.push('departments', route.departmentId)
  if (route.branchId) segments.push('branches', route.branchId)
  if (route.batchId) segments.push('batches', route.batchId)
  return segments.join('/')
}

export function toRegistrySearchScope(filter: RegistryFilterState): LiveAdminSearchScope | null {
  return {
    academicFacultyId: filter.academicFacultyId || undefined,
    departmentId: filter.departmentId || undefined,
    branchId: filter.branchId || undefined,
    batchId: filter.batchId || undefined,
    sectionCode: filter.sectionCode || undefined,
  }
}

export function normalizeHierarchyScope(scope: HierarchyScopeInput | null): LiveAdminSearchScope | null {
  if (!scope) return null
  return {
    academicFacultyId: scope.academicFacultyId || undefined,
    departmentId: scope.departmentId || undefined,
    branchId: scope.branchId || undefined,
    batchId: scope.batchId || undefined,
    sectionCode: scope.sectionCode || undefined,
  }
}

export function normalizeAdminSectionCode(sectionCode: string) {
  return sectionCode.trim().toUpperCase()
}

export function buildAdminSectionScopeId(batchId: string, sectionCode: string) {
  const normalizedBatchId = batchId.trim()
  const normalizedSectionCode = normalizeAdminSectionCode(sectionCode)
  if (!normalizedBatchId || !normalizedSectionCode) {
    throw new Error('Section scope ids require both a batch id and a section code.')
  }
  return `${normalizedBatchId}::${normalizedSectionCode}`
}

export function parseAdminSectionScopeId(scopeId: string) {
  const [batchId, sectionCode, ...remainder] = scopeId.split('::')
  if (remainder.length > 0) return null
  const normalizedBatchId = batchId?.trim() ?? ''
  const normalizedSectionCode = normalizeAdminSectionCode(sectionCode ?? '')
  if (!normalizedBatchId || !normalizedSectionCode) return null
  return {
    batchId: normalizedBatchId,
    sectionCode: normalizedSectionCode,
  }
}

export function buildAdminActiveScopeChain(input: {
  institution: LiveAdminDataset['institution']
  academicFaculty: ApiAcademicFaculty | null
  department: ApiDepartment | null
  branch: ApiBranch | null
  batch: ApiBatch | null
  sectionCode: string | null
}) {
  const chain: ActiveAdminScope[] = []
  if (input.institution) {
    chain.push({
      scopeType: 'institution',
      scopeId: input.institution.institutionId,
      label: input.institution.name,
    })
  }
  if (input.academicFaculty) {
    chain.push({
      scopeType: 'academic-faculty',
      scopeId: input.academicFaculty.academicFacultyId,
      label: input.academicFaculty.name,
    })
  }
  if (input.department) {
    chain.push({
      scopeType: 'department',
      scopeId: input.department.departmentId,
      label: input.department.name,
    })
  }
  if (input.branch) {
    chain.push({
      scopeType: 'branch',
      scopeId: input.branch.branchId,
      label: input.branch.name,
    })
  }
  if (input.batch) {
    chain.push({
      scopeType: 'batch',
      scopeId: input.batch.batchId,
      label: `Batch ${input.batch.batchLabel}`,
    })
  }
  if (input.batch && input.sectionCode) {
    chain.push({
      scopeType: 'section',
      scopeId: buildAdminSectionScopeId(input.batch.batchId, input.sectionCode),
      label: `Section ${normalizeAdminSectionCode(input.sectionCode)}`,
    })
  }
  return chain
}

export function fadeColor(hexColor: string, alpha: string) {
  const trimmed = hexColor.trim()
  if (!trimmed.startsWith('#')) return trimmed
  const normalized = trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
  return `${normalized}${alpha}`
}
