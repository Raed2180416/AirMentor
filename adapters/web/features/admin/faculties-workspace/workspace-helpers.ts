import type {
  ApiScopeType,
  ApiCurriculumFeatureConfigBundle,
  ApiStageEvidenceKind,
} from '@web/shared/api/types'
import type {
  CurriculumSemesterEntry,
  GovernanceResolvedLineage,
  GovernanceSubject,
  WorkspaceMetaScope,
} from './types'

export function formatScopeTypeLabel(scopeType: ApiScopeType) {
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

type ParsedPrerequisiteDraftLine = {
  sourceCourseCode: string
  edgeKind: 'explicit' | 'added'
  rationale: string
  lineNumber: number
}

type PrerequisiteValidationResult = {
  errors: string[]
  parsedLineCount: number
}

function parsePrerequisiteDraftLines(prerequisitesText: string) {
  const lines = prerequisitesText
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(item => item.line.length > 0)

  const parsed: ParsedPrerequisiteDraftLine[] = []
  const errors: string[] = []

  for (const item of lines) {
    const segments = item.line.split('|').map(segment => segment.trim()).filter(Boolean)
    if (segments.length < 3) {
      errors.push(`Line ${item.lineNumber} must use COURSE_CODE | explicit|added | rationale.`)
      continue
    }
    const [sourceCourseCode, rawEdgeKind, ...rationaleSegments] = segments
    const edgeKind = rawEdgeKind?.toLowerCase() === 'added'
      ? 'added'
      : rawEdgeKind?.toLowerCase() === 'explicit'
        ? 'explicit'
        : null
    if (!sourceCourseCode) {
      errors.push(`Line ${item.lineNumber} is missing a source course code.`)
      continue
    }
    if (!edgeKind) {
      errors.push(`Line ${item.lineNumber} must declare edge kind as explicit or added.`)
      continue
    }
    const rationale = rationaleSegments.join(' | ').trim()
    if (!rationale) {
      errors.push(`Line ${item.lineNumber} must include a rationale.`)
      continue
    }
    parsed.push({
      sourceCourseCode,
      edgeKind,
      rationale,
      lineNumber: item.lineNumber,
    })
  }

  return { parsed, errors }
}

export function validatePrerequisiteDraftAgainstCurriculum(
  targetCourse: Pick<ApiCurriculumFeatureConfigBundle['items'][number], 'curriculumCourseId' | 'courseCode' | 'semesterNumber'> | null,
  prerequisitesText: string,
  curriculumSemesterEntries: CurriculumSemesterEntry[],
): PrerequisiteValidationResult {
  if (!targetCourse) {
    return {
      errors: ['Select a model-input course before validating prerequisites.'],
      parsedLineCount: 0,
    }
  }

  const { parsed, errors } = parsePrerequisiteDraftLines(prerequisitesText)
  const allCourses = curriculumSemesterEntries.flatMap(entry => entry.courses)
  const rowByCourseCode = new Map(allCourses.map(row => [row.courseCode.trim().toLowerCase(), row]))
  const targetRow = allCourses.find(row => row.curriculumCourseId === targetCourse.curriculumCourseId)
    ?? allCourses.find(row => row.courseCode.trim().toLowerCase() === targetCourse.courseCode.trim().toLowerCase())
    ?? null

  if (!targetRow) {
    return {
      errors: [...errors, `Selected course ${targetCourse.courseCode} is not present in the current curriculum rows.`],
      parsedLineCount: parsed.length,
    }
  }

  const seenEdges = new Set<string>()
  for (const prerequisite of parsed) {
    const normalizedSourceCourseCode = prerequisite.sourceCourseCode.trim().toLowerCase()
    const sourceRow = rowByCourseCode.get(normalizedSourceCourseCode) ?? null
    const edgeKey = `${normalizedSourceCourseCode}::${targetRow.curriculumCourseId}::${prerequisite.edgeKind}`
    if (seenEdges.has(edgeKey)) {
      errors.push(`Line ${prerequisite.lineNumber} duplicates a ${prerequisite.edgeKind} prerequisite edge for ${targetRow.courseCode}.`)
      continue
    }
    seenEdges.add(edgeKey)
    if (!sourceRow) {
      errors.push(`Line ${prerequisite.lineNumber}: source course ${prerequisite.sourceCourseCode} is not present in the current curriculum rows.`)
      continue
    }
    if (
      sourceRow.curriculumCourseId === targetRow.curriculumCourseId
      || sourceRow.courseCode.trim().toLowerCase() === targetRow.courseCode.trim().toLowerCase()
    ) {
      errors.push(`Line ${prerequisite.lineNumber}: self-referential prerequisite edges are not allowed.`)
      continue
    }
    if (prerequisite.edgeKind === 'explicit' && sourceRow.semesterNumber >= targetRow.semesterNumber) {
      errors.push(`Line ${prerequisite.lineNumber}: prerequisite edges require an earlier semester. Found semester ${sourceRow.semesterNumber} -> ${targetRow.semesterNumber}.`)
    }
  }

  return {
    errors,
    parsedLineCount: parsed.length,
  }
}

export function formatScopeModeLabel(scopeMode: ApiScopeType | 'proof') {
  if (scopeMode === 'proof') return 'Proof'
  return formatScopeTypeLabel(scopeMode)
}

function getInstitutionDefaultsLabel(activeScopeChain: WorkspaceMetaScope[]) {
  const institutionScope = activeScopeChain.find(scope => scope.scopeType === 'institution')
  return institutionScope ? `${institutionScope.label} defaults` : 'Institution defaults'
}

function getScopeLabelFromChain(
  scopeType: ApiScopeType | 'proof' | 'student',
  scopeId: string,
  activeScopeChain: WorkspaceMetaScope[],
) {
  const match = activeScopeChain.find(scope => scope.scopeType === scopeType && scope.scopeId === scopeId)
  if (match) return match.label
  if (scopeType === 'proof') return 'Proof'
  if (scopeType === 'student') return `Student ${scopeId}`
  if (scopeType === 'section') {
    const sectionCode = scopeId.split('::').at(-1) ?? scopeId
    return `Section ${sectionCode}`
  }
  return `${formatScopeTypeLabel(scopeType)} ${scopeId}`
}

export function describeResolvedFromLabel(
  resolved: GovernanceResolvedLineage | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  if (!resolved) return 'authoritative lineage is loading'
  const explicitLabel = resolved.resolvedFrom.label.trim()
  if (explicitLabel) return explicitLabel
  if (resolved.resolvedFrom.scopeType && resolved.resolvedFrom.scopeId) {
    return `${getScopeLabelFromChain(resolved.resolvedFrom.scopeType, resolved.resolvedFrom.scopeId, activeScopeChain)} override`
  }
  return getInstitutionDefaultsLabel(activeScopeChain)
}

function buildGovernanceLineageTrail(
  resolved: GovernanceResolvedLineage | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  const lineage = [getInstitutionDefaultsLabel(activeScopeChain)]
  if (!resolved) return lineage.join(' -> ')
  for (const applied of resolved.appliedOverrides) {
    lineage.push(getScopeLabelFromChain(applied.scopeType, applied.scopeId, activeScopeChain))
  }
  return lineage.join(' -> ')
}

function describeRollbackTargetLabel(
  resolved: GovernanceResolvedLineage | null,
  activeGovernanceScope: WorkspaceMetaScope | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  if (!resolved || !activeGovernanceScope) return getInstitutionDefaultsLabel(activeScopeChain)
  const fallbackOverride = [...resolved.appliedOverrides].reverse().find(applied => (
    applied.scopeType !== activeGovernanceScope.scopeType || applied.scopeId !== activeGovernanceScope.scopeId
  ))
  return fallbackOverride
    ? `${getScopeLabelFromChain(fallbackOverride.scopeType, fallbackOverride.scopeId, activeScopeChain)} override`
    : getInstitutionDefaultsLabel(activeScopeChain)
}

export function describeGovernanceResolutionMessage({
  activeGovernanceScope,
  activeScopeChain,
  resolved,
  subject,
}: {
  activeGovernanceScope: WorkspaceMetaScope | null
  activeScopeChain: WorkspaceMetaScope[]
  resolved: GovernanceResolvedLineage | null
  subject: GovernanceSubject
}) {
  if (!resolved) {
    const resolvedScopeType = activeGovernanceScope?.scopeType ?? 'institution'
    return `Resolved lineage is loading for ${formatScopeTypeLabel(resolvedScopeType).toLowerCase()} ${activeGovernanceScope?.label ?? 'defaults'}.`
  }
  return `Scope ${resolved.scopeDescriptor.label} is running in ${formatScopeModeLabel(resolved.scopeMode)} mode. Effective ${subject} resolves from ${describeResolvedFromLabel(resolved, activeScopeChain)}. Lineage: ${buildGovernanceLineageTrail(resolved, activeScopeChain)}.`
}

export function describeGovernanceRollbackMessage({
  activeGovernanceScope,
  activeScopeChain,
  hasLocalOverride,
  resolved,
  subject,
}: {
  activeGovernanceScope: WorkspaceMetaScope | null
  activeScopeChain: WorkspaceMetaScope[]
  hasLocalOverride: boolean
  resolved: GovernanceResolvedLineage | null
  subject: GovernanceSubject
}) {
  const scopeLabel = resolved?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'the active scope'
  if (!resolved) {
    return hasLocalOverride
      ? `Reset will archive the local ${subject} override at ${scopeLabel}. Authoritative fallback lineage is still loading.`
      : `${scopeLabel} is already inheriting. Authoritative lineage is still loading.`
  }
  if (!hasLocalOverride) {
    return `${scopeLabel} is already inheriting from ${describeResolvedFromLabel(resolved, activeScopeChain)}.`
  }
  return `Reset will archive the local ${subject} override at ${scopeLabel} and fall back to ${describeRollbackTargetLabel(resolved, activeGovernanceScope, activeScopeChain)}.`
}

export const STAGE_EVIDENCE_OPTIONS: ApiStageEvidenceKind[] = ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript']
