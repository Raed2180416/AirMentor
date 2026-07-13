/**
 * Offering stage-lifecycle use-cases (R10).
 *
 *   GET  /api/admin/offerings/:offeringId/stage-eligibility
 *   POST /api/admin/offerings/:offeringId/advance-stage
 *
 * advance-stage keeps the legacy atomic ordering: recompute eligibility -> guard
 * -> bump the offering stage columns -> append the stage-advancement audit row,
 * then recompute + return eligibility. Eligibility computation stays injected
 * (buildOfferingStageEligibility); only the offering row read/write and the
 * audit-row insert move behind the repository.
 */
import { createId } from '../../../lib/ids.js'
import { stringifyJson } from '../../../lib/json.js'
import { badRequest, notFound } from '../../../lib/http-errors.js'
import type { AcademicOfferingsRepository } from '../../ports/academic-offerings-repository.js'
import type { StageEligibilityResult } from './shared.js'

type BuildOfferingStageEligibility = (offeringId: string) => Promise<StageEligibilityResult>

export type GetStageEligibilityDeps = {
  buildOfferingStageEligibility: BuildOfferingStageEligibility
}

export type GetStageEligibilityInput = {
  offeringId: string
}

export async function getStageEligibility(
  deps: GetStageEligibilityDeps,
  input: GetStageEligibilityInput,
): Promise<unknown> {
  return deps.buildOfferingStageEligibility(input.offeringId)
}

export type AdvanceOfferingStageDeps = {
  repo: AcademicOfferingsRepository
  buildOfferingStageEligibility: BuildOfferingStageEligibility
  now: () => string
}

export type AdvanceOfferingStageInput = {
  offeringId: string
  actorFacultyId: string | null
}

export async function advanceOfferingStage(
  deps: AdvanceOfferingStageDeps,
  input: AdvanceOfferingStageInput,
): Promise<unknown> {
  const eligibility = await deps.buildOfferingStageEligibility(input.offeringId)
  if (!eligibility.eligible || !eligibility.nextStage) {
    throw badRequest('Offering cannot advance to the next stage', {
      blockingReasons: eligibility.blockingReasons,
    })
  }
  const current = await deps.repo.getOfferingById(input.offeringId)
  if (!current) throw notFound('Offering not found')
  await deps.repo.updateOfferingStage(input.offeringId, {
    stage: eligibility.nextStage.order,
    stageLabel: eligibility.nextStage.label,
    stageDescription: eligibility.nextStage.description,
    stageColor: eligibility.nextStage.color,
    version: current.version + 1,
    updatedAt: deps.now(),
  })
  await deps.repo.insertStageAdvancementAudit({
    offeringStageAdvancementAuditId: createId('offering_stage_advancement_audit'),
    offeringId: input.offeringId,
    batchId: eligibility.batchId,
    termId: current.termId,
    advancedByFacultyId: input.actorFacultyId ?? null,
    fromStageKey: eligibility.currentStage.key,
    toStageKey: eligibility.nextStage.key,
    auditJson: stringifyJson({
      fromStage: eligibility.currentStage,
      toStage: eligibility.nextStage,
      queueBurden: eligibility.queueBurden,
      evidenceStatus: eligibility.evidenceStatus,
    }),
    createdAt: deps.now(),
    updatedAt: deps.now(),
  })
  return deps.buildOfferingStageEligibility(input.offeringId)
}
