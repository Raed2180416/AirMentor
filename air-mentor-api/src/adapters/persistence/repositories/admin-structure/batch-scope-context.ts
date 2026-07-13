/**
 * Batch scope-chain resolution + policy provenance shaping.
 *
 * Schema-coupled (reads institution/branch/department/batch rows); moved
 * verbatim from modules/admin-structure.ts.
 */
import { eq } from 'drizzle-orm'
import {
  batches,
  branches,
  departments,
  institutions,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { notFound } from '../../../../lib/http-errors.js'
import { parseJson } from '../../../../lib/json.js'
import {
  decodeSectionScopeId,
  encodeSectionScopeId,
  normalizeSectionCode,
  type ScopeTypeValue,
} from '../../../../lib/stage-policy.js'

type ScopeChainEntry = {
  scopeType: ScopeTypeValue
  scopeId: string
}

type BatchScopeContext = {
  institution: typeof institutions.$inferSelect
  batch: typeof batches.$inferSelect
  branch: typeof branches.$inferSelect
  department: typeof departments.$inferSelect
  sectionCode: string | null
  scopeChain: ScopeChainEntry[]
}

export type BatchResolutionOptions = {
  sectionCode?: string | null
}

export function listBatchSectionLabels(batch: typeof batches.$inferSelect) {
  return parseJson(batch.sectionLabelsJson, [] as string[])
    .map(normalizeSectionCode)
    .filter(Boolean)
}

export function resolveBatchSectionScope(batch: typeof batches.$inferSelect, requestedSectionCode?: string | null) {
  if (!requestedSectionCode) return null
  const sectionCode = normalizeSectionCode(requestedSectionCode)
  const knownSectionLabels = listBatchSectionLabels(batch)
  if (!knownSectionLabels.includes(sectionCode)) {
    throw notFound('Section scope not found')
  }
  return {
    sectionCode,
    scopeId: encodeSectionScopeId(batch.batchId, sectionCode),
  }
}

export function scopeReferencesDeletedBatch(scopeId: string, batchIds: Set<string>) {
  const parsed = decodeSectionScopeId(scopeId)
  return parsed ? batchIds.has(parsed.batchId) : false
}

export async function getBatchScopeContext(context: RouteContext, batchId: string, requestedSectionCode?: string | null): Promise<BatchScopeContext> {
  const [institution] = await context.db.select().from(institutions)
  if (!institution) throw notFound('Institution is not configured')

  const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, batchId))
  if (!batch) throw notFound('Batch not found')
  const [branch] = await context.db.select().from(branches).where(eq(branches.branchId, batch.branchId))
  if (!branch) throw notFound('Branch not found')
  const [department] = await context.db.select().from(departments).where(eq(departments.departmentId, branch.departmentId))
  if (!department) throw notFound('Department not found')
  const sectionScope = resolveBatchSectionScope(batch, requestedSectionCode)

  return {
    institution,
    batch,
    branch,
    department,
    sectionCode: sectionScope?.sectionCode ?? null,
    scopeChain: [
      { scopeType: 'institution', scopeId: institution.institutionId },
      ...(department.academicFacultyId ? [{ scopeType: 'academic-faculty' as const, scopeId: department.academicFacultyId }] : []),
      { scopeType: 'department', scopeId: department.departmentId },
      { scopeType: 'branch', scopeId: branch.branchId },
      { scopeType: 'batch', scopeId: batch.batchId },
      ...(sectionScope ? [{ scopeType: 'section' as const, scopeId: sectionScope.scopeId }] : []),
    ],
  }
}

export function formatScopeLabel(scope: ScopeChainEntry) {
  return `${scope.scopeType}:${scope.scopeId}`
}

function describeScopeDescriptor(scopeContext: BatchScopeContext, scope: ScopeChainEntry) {
  if (scope.scopeType === 'institution') return scopeContext.institution.name
  if (scope.scopeType === 'academic-faculty') return scopeContext.department.academicFacultyId ?? scope.scopeId
  if (scope.scopeType === 'department') return scopeContext.department.name
  if (scope.scopeType === 'branch') return scopeContext.branch.name
  if (scope.scopeType === 'batch') return scopeContext.batch.batchLabel
  return `Section ${scopeContext.sectionCode ?? scope.scopeId.split('::').at(-1) ?? scope.scopeId}`
}

export function buildResolvedPolicyProvenance(
  scopeContext: BatchScopeContext,
  appliedOverrides: ReadonlyArray<{ scopeType: string; scopeId: string }>,
) {
  const activeScope = scopeContext.scopeChain.at(-1) ?? { scopeType: 'batch' as const, scopeId: scopeContext.batch.batchId }
  const resolvedScope = appliedOverrides.at(-1) ?? null
  const resolvedFromScope = resolvedScope
    ? scopeContext.scopeChain.find(scope => scope.scopeType === resolvedScope.scopeType && scope.scopeId === resolvedScope.scopeId) ?? activeScope
    : scopeContext.scopeChain[0]
  return {
    scopeDescriptor: {
      scopeType: activeScope.scopeType,
      scopeId: activeScope.scopeId,
      label: describeScopeDescriptor(scopeContext, activeScope),
      batchId: scopeContext.batch.batchId,
      sectionCode: scopeContext.sectionCode,
      branchName: scopeContext.branch.name,
      simulationRunId: null,
      simulationStageCheckpointId: null,
      studentId: null,
    },
    resolvedFrom: {
      kind: resolvedScope ? 'policy-override' : 'default-policy',
      scopeType: resolvedFromScope.scopeType,
      scopeId: resolvedFromScope.scopeId,
      label: resolvedScope
        ? `${describeScopeDescriptor(scopeContext, resolvedFromScope)} override`
        : 'Institution default policy',
    },
    scopeMode: activeScope.scopeType,
    countSource: 'operational-semester' as const,
    activeOperationalSemester: scopeContext.batch.currentSemester,
  }
}
