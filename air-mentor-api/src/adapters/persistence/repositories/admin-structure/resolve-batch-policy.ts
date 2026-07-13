/**
 * resolveBatchStagePolicy / resolveBatchPolicy — resolve effective academic and
 * stage policies for a batch across the scope chain, plus proof-sandbox summary.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts and re-exported
 * from that module (consumed by academic, students, people, proof control-plane).
 */
import { eq } from 'drizzle-orm'
import {
  bridgeModules,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  policyOverrides,
  reassessmentEvents,
  riskAssessments,
  simulationRuns,
  stagePolicyOverrides,
} from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { parseJson } from '../../../../lib/json.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyPayload } from '../../../../lib/stage-policy.js'
import type { ResolvedPolicy } from '../../../../application/use-cases/admin-structure/admin-structure-schemas.js'
import { DEFAULT_POLICY, mergePolicy } from '../../../../application/use-cases/admin-structure/resolved-policy.js'
import {
  buildResolvedPolicyProvenance,
  formatScopeLabel,
  getBatchScopeContext,
  type BatchResolutionOptions,
} from './batch-scope-context.js'
import { mapBatch, mapPolicyOverride, mapStagePolicyOverride } from './row-mappers.js'

export async function resolveBatchStagePolicy(context: RouteContext, batchId: string, options: BatchResolutionOptions = {}) {
  const scopeContext = await getBatchScopeContext(context, batchId, options.sectionCode ?? null)
  const allOverrides = await context.db.select().from(stagePolicyOverrides)
  let effectivePolicy: StagePolicyPayload = DEFAULT_STAGE_POLICY
  const appliedOverrides: Array<ReturnType<typeof mapStagePolicyOverride> & { appliedAtScope: string }> = []

  for (const scope of scopeContext.scopeChain) {
    const override = allOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && item.status === 'active')
    if (!override) continue
    const mapped = mapStagePolicyOverride(override)
    effectivePolicy = mapped.policy
    appliedOverrides.push({
      ...mapped,
      appliedAtScope: formatScopeLabel(scope),
    })
  }
  const countProvenance = buildResolvedPolicyProvenance(scopeContext, appliedOverrides)

  return {
    batch: mapBatch(scopeContext.batch),
    ...countProvenance,
    scopeChain: scopeContext.scopeChain,
    appliedOverrides,
    effectivePolicy,
  }
}

async function buildProofSandboxSummary(context: RouteContext, batchId: string) {
  const [
    importRows,
    nodeRows,
    edgeRows,
    bridgeRows,
    simulationRows,
    assessmentRows,
    reassessmentRows,
  ] = await Promise.all([
    context.db.select().from(curriculumImportVersions).where(eq(curriculumImportVersions.batchId, batchId)),
    context.db.select().from(curriculumNodes).where(eq(curriculumNodes.batchId, batchId)),
    context.db.select().from(curriculumEdges).where(eq(curriculumEdges.batchId, batchId)),
    context.db.select().from(bridgeModules).where(eq(bridgeModules.batchId, batchId)),
    context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId)),
    context.db.select().from(riskAssessments),
    context.db.select().from(reassessmentEvents),
  ])

  const latestImport = importRows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  const latestRun = simulationRows.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  const latestRunMetrics = latestRun ? parseJson(latestRun.metricsJson, {} as Record<string, unknown>) : {}
  const scopedAssessments = latestRun
    ? assessmentRows.filter(row => row.simulationRunId === latestRun.simulationRunId)
    : []
  const scopedAssessmentIds = new Set(scopedAssessments.map(row => row.riskAssessmentId))
  const activeReassessmentCount = reassessmentRows.filter(row => scopedAssessmentIds.has(row.riskAssessmentId) && row.status !== 'completed').length

  return {
    hasProofData: !!latestImport || !!latestRun,
    curriculumImport: latestImport
      ? {
          curriculumImportVersionId: latestImport.curriculumImportVersionId,
          sourceLabel: latestImport.sourceLabel,
          sourceChecksum: latestImport.sourceChecksum,
          semesterRange: [latestImport.firstSemester, latestImport.lastSemester] as [number, number],
          courseCount: latestImport.courseCount,
          totalCredits: latestImport.totalCredits,
          explicitEdgeCount: latestImport.explicitEdgeCount,
          addedEdgeCount: latestImport.addedEdgeCount,
          bridgeModuleCount: latestImport.bridgeModuleCount,
          electiveOptionCount: latestImport.electiveOptionCount,
          importedAt: latestImport.createdAt,
          status: latestImport.status,
        }
      : null,
    structureSummary: {
      nodeCount: nodeRows.length,
      explicitEdgeCount: edgeRows.filter(row => row.edgeKind === 'explicit').length,
      addedEdgeCount: edgeRows.filter(row => row.edgeKind === 'added').length,
      bridgeModuleCount: bridgeRows.length,
    },
    latestSimulationRun: latestRun
      ? {
          simulationRunId: latestRun.simulationRunId,
          runLabel: latestRun.runLabel,
          status: latestRun.status,
          seed: latestRun.seed,
          sectionCount: latestRun.sectionCount,
          studentCount: latestRun.studentCount,
          facultyCount: latestRun.facultyCount,
          semesterRange: [latestRun.semesterStart, latestRun.semesterEnd] as [number, number],
          createdAt: latestRun.createdAt,
          metrics: latestRunMetrics,
        }
      : null,
    monitoringSummary: {
      riskAssessmentCount: scopedAssessments.length,
      activeReassessmentCount,
    },
  }
}

export async function resolveBatchPolicy(context: RouteContext, batchId: string, options: BatchResolutionOptions = {}) {
  const scopeContext = await getBatchScopeContext(context, batchId, options.sectionCode ?? null)

  const allOverrides = await context.db.select().from(policyOverrides)
  let effectivePolicy: ResolvedPolicy = DEFAULT_POLICY
  const appliedOverrides: Array<ReturnType<typeof mapPolicyOverride> & { appliedAtScope: string }> = []

  for (const scope of scopeContext.scopeChain) {
    const override = allOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && item.status === 'active')
    if (!override) continue
    const mapped = mapPolicyOverride(override)
    effectivePolicy = mergePolicy(effectivePolicy, mapped.policy)
    appliedOverrides.push({
      ...mapped,
      appliedAtScope: formatScopeLabel(scope),
    })
  }

  const proofSandbox = await buildProofSandboxSummary(context, scopeContext.batch.batchId)
  const countProvenance = buildResolvedPolicyProvenance(scopeContext, appliedOverrides)

  return {
    batch: mapBatch(scopeContext.batch),
    ...countProvenance,
    scopeChain: scopeContext.scopeChain,
    appliedOverrides,
    effectivePolicy,
    proofSandbox,
  }
}
