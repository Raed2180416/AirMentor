/**
 * Faculty proof-provenance enrichment. Moved verbatim from modules/people.ts,
 * except the `context`-bound `resolveBatchPolicy` call is now an injected
 * closure (the controller binds it over RouteContext). The per-request cache is
 * threaded through unchanged so batch-policy resolution is shared exactly as
 * before (including the shared cache the list handler reuses across faculty).
 */
import { pickFacultyScopeSource } from './faculty-directory-scope.js'
import type {
  FacultyRecord,
  FacultyRecordWithProvenance,
  PeopleReferenceData,
  ProvenanceScopeType,
  ResolveBatchPolicyResult,
} from './people-domain.js'

export type ResolveBatchPolicyFn = (
  batchId: string,
  options: { sectionCode: string | null },
) => Promise<ResolveBatchPolicyResult>

export async function enrichFacultyRecordWithProvenance(
  resolveBatchPolicy: ResolveBatchPolicyFn,
  faculty: FacultyRecord,
  references: PeopleReferenceData,
  cache: Map<string, ResolveBatchPolicyResult>,
): Promise<FacultyRecordWithProvenance> {
  const scopeSource = pickFacultyScopeSource(faculty, references)
  if (!scopeSource) {
    return {
      ...faculty,
      scopeDescriptor: null,
      resolvedFrom: null,
      scopeMode: null,
      countSource: null,
      activeOperationalSemester: null,
    }
  }

  if (scopeSource.batchId) {
    const cacheKey = `${scopeSource.batchId}::${(scopeSource.sectionCode ?? '').trim().toUpperCase()}`
    let resolvedPolicy = cache.get(cacheKey)
    if (!resolvedPolicy) {
      resolvedPolicy = await resolveBatchPolicy(scopeSource.batchId, { sectionCode: scopeSource.sectionCode ?? null })
      cache.set(cacheKey, resolvedPolicy)
    }
    return {
      ...faculty,
      scopeDescriptor: resolvedPolicy.scopeDescriptor,
      resolvedFrom: resolvedPolicy.resolvedFrom,
      scopeMode: resolvedPolicy.scopeMode,
      countSource: resolvedPolicy.countSource,
      activeOperationalSemester: resolvedPolicy.activeOperationalSemester,
    }
  }

  return {
    ...faculty,
    scopeDescriptor: {
      scopeType: scopeSource.scopeType as ProvenanceScopeType,
      scopeId: scopeSource.scopeId,
      label: scopeSource.label,
      batchId: null,
      sectionCode: null,
      branchName: scopeSource.scopeType === 'branch' ? scopeSource.label : null,
      simulationRunId: null,
      simulationStageCheckpointId: null,
      studentId: null,
    },
    resolvedFrom: {
      kind: 'proof-unavailable',
      scopeType: scopeSource.scopeType as ProvenanceScopeType,
      scopeId: scopeSource.scopeId,
      label: scopeSource.label,
    },
    scopeMode: scopeSource.scopeType as ProvenanceScopeType,
    countSource: 'unavailable',
    activeOperationalSemester: null,
  }
}
