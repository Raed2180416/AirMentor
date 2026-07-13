import type { LiveAdminRoute, LiveAdminSearchScope, LiveAdminSectionId } from './session-scope.js'

export type HierarchyScopeInput = {
  academicFacultyId?: string | null
  departmentId?: string | null
  branchId?: string | null
  batchId?: string | null
  sectionCode?: string | null
}

export type ActiveAdminScope = {
  scopeType: 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section'
  scopeId: string
  scopeLabel: string
  route: LiveAdminRoute
}

export function buildAdminActiveScopeChain(route: LiveAdminRoute): ActiveAdminScope[] {
  const chain: ActiveAdminScope[] = []
  if (route.academicFacultyId) {
    chain.push({
      scopeType: 'academic-faculty',
      scopeId: route.academicFacultyId,
      scopeLabel: 'Academic Faculty',
      route,
    })
  }
  if (route.departmentId) {
    chain.push({
      scopeType: 'department',
      scopeId: route.departmentId,
      scopeLabel: 'Department',
      route,
    })
  }
  if (route.branchId) {
    chain.push({
      scopeType: 'branch',
      scopeId: route.branchId,
      scopeLabel: 'Branch',
      route,
    })
  }
  if (route.batchId) {
    chain.push({
      scopeType: 'batch',
      scopeId: route.batchId,
      scopeLabel: 'Batch',
      route,
    })
  }
  return chain
}

export function isScopeWithin(inner: HierarchyScopeInput, outer: HierarchyScopeInput): boolean {
  if (outer.academicFacultyId && inner.academicFacultyId !== outer.academicFacultyId) return false
  if (outer.departmentId && inner.departmentId !== outer.departmentId) return false
  if (outer.branchId && inner.branchId !== outer.branchId) return false
  if (outer.batchId && inner.batchId !== outer.batchId) return false
  if (outer.sectionCode && inner.sectionCode !== outer.sectionCode) return false
  return true
}

export function narrowScope(
  base: HierarchyScopeInput,
  child: HierarchyScopeInput,
): HierarchyScopeInput {
  return {
    academicFacultyId: child.academicFacultyId ?? base.academicFacultyId,
    departmentId: child.departmentId ?? base.departmentId,
    branchId: child.branchId ?? base.branchId,
    batchId: child.batchId ?? base.batchId,
    sectionCode: child.sectionCode ?? base.sectionCode,
  }
}

export function routeSectionScope(section: LiveAdminSectionId): HierarchyScopeInput {
  switch (section) {
    case 'overview': return {}
    case 'proof-dashboard': return {}
    case 'faculties': return {}
    case 'students': return {}
    case 'faculty-members': return {}
    case 'requests': return {}
    case 'history': return {}
    default: return {}
  }
}

export function scopeTargetsCanonicalProofHierarchy(scope?: LiveAdminSearchScope | null) {
  if (!scope) return false
  return !!(scope.batchId || scope.branchId || scope.departmentId || scope.academicFacultyId)
}
