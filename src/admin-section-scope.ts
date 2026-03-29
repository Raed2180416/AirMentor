import type {
  ApiAcademicFaculty,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiInstitution,
  ApiScopeType,
} from './api/types'

export type ActiveAdminScope = {
  scopeType: ApiScopeType
  scopeId: string
  label: string
}

export function normalizeAdminSectionCode(sectionCode: string) {
  return sectionCode.trim().toUpperCase()
}

export function buildAdminSectionScopeId(batchId: string, sectionCode: string) {
  return `${batchId}::${normalizeAdminSectionCode(sectionCode)}`
}

export function parseAdminSectionScopeId(scopeId: string) {
  const separatorIndex = scopeId.indexOf('::')
  if (separatorIndex <= 0 || separatorIndex >= scopeId.length - 2) return null
  const batchId = scopeId.slice(0, separatorIndex).trim()
  const sectionCode = normalizeAdminSectionCode(scopeId.slice(separatorIndex + 2))
  if (!batchId || !sectionCode) return null
  return { batchId, sectionCode }
}

export function formatAdminScopeTypeLabel(scopeType: ApiScopeType) {
  switch (scopeType) {
    case 'institution':
      return 'Institution'
    case 'academic-faculty':
      return 'Faculty'
    case 'department':
      return 'Department'
    case 'branch':
      return 'Branch'
    case 'batch':
      return 'Batch'
    case 'section':
      return 'Section'
    default:
      return scopeType
  }
}

export function buildActiveAdminScopeChain(input: {
  institution: ApiInstitution | null
  academicFaculty: ApiAcademicFaculty | null
  department: ApiDepartment | null
  branch: ApiBranch | null
  batch: ApiBatch | null
  sectionCode: string | null
}): ActiveAdminScope[] {
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
    const normalizedSectionCode = normalizeAdminSectionCode(input.sectionCode)
    chain.push({
      scopeType: 'section',
      scopeId: buildAdminSectionScopeId(input.batch.batchId, normalizedSectionCode),
      label: `Section ${normalizedSectionCode}`,
    })
  }
  return chain
}
