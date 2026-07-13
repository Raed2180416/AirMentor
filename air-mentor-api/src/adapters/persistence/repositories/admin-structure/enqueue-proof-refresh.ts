/**
 * enqueueProofRefreshForBatches — resolve policy + features for each affected
 * batch and enqueue (or reuse) a proof simulation run.
 *
 * Schema-coupled; moved verbatim from modules/admin-structure.ts and re-exported
 * from that module (consumed by academic-admin-offerings-routes).
 */
import { eq } from 'drizzle-orm'
import { simulationRuns } from '../../../../db/schema.js'
import type { RouteContext } from '../../../../app.js'
import { enqueueProofSimulationRun } from '../../../../lib/proof-run-queue.js'
import { emitOperationalEvent, normalizeTelemetryError } from '../../../../lib/telemetry.js'
import {
  createEmptyProofRefresh,
  type ProofRefreshSummary,
} from '../../../../application/use-cases/admin-structure/feature-domain.js'
import { resolveBatchPolicy } from './resolve-batch-policy.js'
import { resolveBatchCurriculumFeatures } from './resolve-batch-features.js'

export async function enqueueProofRefreshForBatches(context: RouteContext, input: {
  batchIds: string[]
  actorFacultyId?: string | null
  now: string
  curriculumImportVersionId?: string | null
}) {
  const uniqueBatchIds = Array.from(new Set(input.batchIds.filter(Boolean)))
  if (uniqueBatchIds.length === 0) {
    return createEmptyProofRefresh(input.curriculumImportVersionId ?? null)
  }

  const queuedSimulationRunIds: string[] = []
  const failedBatchIds: string[] = []
  const warnings: string[] = []
  let lastCurriculumImportVersionId = input.curriculumImportVersionId ?? null

  for (const batchId of uniqueBatchIds) {
    try {
      const [resolvedPolicy, resolvedFeatures] = await Promise.all([
        resolveBatchPolicy(context, batchId),
        resolveBatchCurriculumFeatures(context, batchId),
      ])
      const curriculumImportVersionId = resolvedFeatures.curriculumImportVersion?.curriculumImportVersionId
        ?? input.curriculumImportVersionId
        ?? null
      if (!curriculumImportVersionId) {
        failedBatchIds.push(batchId)
        warnings.push(`No materialized curriculum import is available yet for batch ${batchId}.`)
        continue
      }
      lastCurriculumImportVersionId = curriculumImportVersionId
      const runRows = await context.db.select().from(simulationRuns).where(eq(simulationRuns.batchId, batchId))
      const existingQueuedRun = runRows
        .filter(row =>
          (row.status === 'queued' || row.status === 'running')
          && row.curriculumImportVersionId === curriculumImportVersionId
          && (row.curriculumFeatureProfileFingerprint ?? '') === resolvedFeatures.curriculumFeatureProfileFingerprint
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))[0] ?? null
      if (existingQueuedRun) {
        queuedSimulationRunIds.push(existingQueuedRun.simulationRunId)
        continue
      }
      const queued = await enqueueProofSimulationRun(context.db, {
        batchId,
        curriculumImportVersionId,
        policy: resolvedPolicy.effectivePolicy,
        curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId ?? null,
        curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
        now: input.now,
        activate: true,
      })
      queuedSimulationRunIds.push(queued.simulationRunId)
    } catch (error) {
      failedBatchIds.push(batchId)
      warnings.push(`Proof refresh could not be queued for batch ${batchId}.`)
      emitOperationalEvent('curriculum.proof_refresh.enqueue_failed', {
        batchId,
        actorFacultyId: input.actorFacultyId ?? null,
        curriculumImportVersionId: input.curriculumImportVersionId ?? null,
        error: normalizeTelemetryError(error),
      }, { level: 'error' })
    }
  }

  return {
    affectedBatchIds: uniqueBatchIds,
    queuedSimulationRunIds,
    curriculumImportVersionId: lastCurriculumImportVersionId,
    failedBatchIds,
    status: failedBatchIds.length > 0 ? 'degraded' : queuedSimulationRunIds.length > 0 ? 'queued' : 'not-needed',
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  } satisfies ProofRefreshSummary
}
