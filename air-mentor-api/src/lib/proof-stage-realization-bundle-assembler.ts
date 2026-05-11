// Phase-6d-3 bundle assembler — the consumer-side glue that turns loaded DB state
// (studentInterventions rows + studentLatentStates rows + per-student risk context)
// into the PlaybackGovernanceRealizationData shape that
// buildPlaybackGovernanceArtifacts accepts via its optional `realizationData` input.
//
// Pure function. Separated from proof-stage-realization-data-fetcher because this
// module imports the governance-service type, which in turn imports schema
// internals — keeping that dependency here lets the data-fetcher stay
// schema-agnostic and independently testable.
//
// Callers (msruas-proof-control-plane.ts / playback-governance orchestrator) load
// the rows they need, then call this assembler to get the bundle, then pass it
// into buildPlaybackGovernanceArtifacts alongside their other inputs.

import type {
  InterventionStageKey,
  InterventionSeverityContext,
  ProofInterventionDominantWeakness,
} from './proof-intervention-response-types.js'
import {
  groupInterventionsByStudentAndOffering,
  parseLatentProfilesForSemester,
  type InterventionRowForFetcher,
  type LatentStateRowForFetcher,
} from './proof-stage-realization-data-fetcher.js'
import type {
  PlaybackGovernanceRealizationData,
} from './proof-control-plane-playback-governance-service.js'

// ---------- Severity context derivation ----------

// Heuristic risk-band estimator for callers that don't have a prior-stage inference
// result at hand. Used to seed the severity context on interventions applied BEFORE
// the current stage. Matches MSRUAS policy thresholds.
//
// This is a defensive fallback — when a caller has a real prior-stage risk band
// (e.g., from the previous stage's governance pass), it should pass that in
// explicitly via severityContextByStudentId.
export function inferHeuristicRiskBand(input: {
  cgpa: number | null
  backlogCount: number | null
}): InterventionSeverityContext['riskBand'] {
  const cgpa = input.cgpa ?? 6
  const backlog = input.backlogCount ?? 0
  if (cgpa < 4.5 || backlog >= 2) return 'High'
  if (cgpa < 7.0 || backlog >= 1) return 'Medium'
  return 'Low'
}

export function buildDefaultSeverityContext(input: {
  cgpa: number | null
  backlogCount: number | null
}): InterventionSeverityContext {
  return {
    riskBand: inferHeuristicRiskBand(input),
    cgpa: input.cgpa ?? 6,
    backlogCount: input.backlogCount ?? 0,
  }
}

// Assemble default severity contexts from a list of student summaries (e.g., from
// previous stage's observed-state snapshot). Explicit per-student overrides in
// `override` win over the heuristic.
export function buildSeverityContextByStudentId(input: {
  summaries: ReadonlyArray<{ studentId: string; cgpa: number | null; backlogCount: number | null }>
  override?: ReadonlyMap<string, InterventionSeverityContext>
}): Map<string, InterventionSeverityContext> {
  const result = new Map<string, InterventionSeverityContext>()
  for (const summary of input.summaries) {
    const explicit = input.override?.get(summary.studentId)
    if (explicit) {
      result.set(summary.studentId, explicit)
      continue
    }
    result.set(summary.studentId, buildDefaultSeverityContext({
      cgpa: summary.cgpa,
      backlogCount: summary.backlogCount,
    }))
  }
  return result
}

// ---------- Bundle assembly ----------

export type BundleAssemblerInput = {
  runSeed: number
  semesterNumber: number
  stageKeyApplied: InterventionStageKey
  interventionRows: ReadonlyArray<InterventionRowForFetcher>
  latentStateRows: ReadonlyArray<LatentStateRowForFetcher>
  severityContextByStudentId: ReadonlyMap<string, InterventionSeverityContext>
  dominantWeaknessByStudentId?: ReadonlyMap<string, ProofInterventionDominantWeakness>
}

export function assemblePlaybackGovernanceRealizationData(
  input: BundleAssemblerInput,
): PlaybackGovernanceRealizationData {
  const studentProfileByStudentId = parseLatentProfilesForSemester({
    latentStateRows: input.latentStateRows,
    semesterNumber: input.semesterNumber,
  })

  const interventionsInWindowBySourceKey = groupInterventionsByStudentAndOffering({
    interventionRows: input.interventionRows,
    semesterNumber: input.semesterNumber,
    stageKeyApplied: input.stageKeyApplied,
    severityContextByStudentId: input.severityContextByStudentId,
    dominantWeaknessByStudentId: input.dominantWeaknessByStudentId,
  })

  return {
    runSeed: input.runSeed,
    studentProfileByStudentId,
    interventionsInWindowBySourceKey,
  }
}
