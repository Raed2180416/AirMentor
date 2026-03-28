import { simulationQuestionTemplates } from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import type {
  PlaybackStageKey,
  StageCourseProjectionSource,
} from './msruas-proof-control-plane.js'

type PlaybackStageDef = {
  key: PlaybackStageKey
}

export type ProofControlPlaneSectionRiskServiceDeps = {
  PLAYBACK_STAGE_DEFS: PlaybackStageDef[]
  average: (values: number[]) => number
  buildStageEvidenceSnapshot: (input: {
    source: StageCourseProjectionSource
    stageKey: PlaybackStageKey
    policy: ResolvedPolicy
    templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
  }) => {
    attendancePct: number | null
    tt1Pct: number | null
    tt2Pct: number | null
    seePct: number | null
    weakCoCount: number | null
    weakQuestionCount: number | null
  }
  observableSectionPressureFromEvidence: (evidence: {
    attendancePct: number | null | undefined
    tt1Pct: number | null | undefined
    tt2Pct: number | null | undefined
    seePct: number | null | undefined
    weakCoCount: number | null | undefined
    weakQuestionCount: number | null | undefined
  }) => number
  roundToTwo: (value: number) => number
}

export function buildSectionRiskRateByStage(
  input: {
    policy: ResolvedPolicy
    sources: StageCourseProjectionSource[]
    templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
  },
  deps: ProofControlPlaneSectionRiskServiceDeps,
) {
  const sectionRiskRateByStage = new Map<string, number>()

  deps.PLAYBACK_STAGE_DEFS.forEach(stage => {
    const sectionAccumulator = new Map<string, number[]>()
    input.sources.forEach(source => {
      const evidence = deps.buildStageEvidenceSnapshot({
        source,
        stageKey: stage.key,
        policy: input.policy,
        templatesById: input.templatesById,
      })
      const sectionKey = `${source.semesterNumber}::${source.sectionCode}::${stage.key}`
      sectionAccumulator.set(sectionKey, [
        ...(sectionAccumulator.get(sectionKey) ?? []),
        deps.observableSectionPressureFromEvidence(evidence),
      ])
    })
    sectionAccumulator.forEach((values, key) => {
      sectionRiskRateByStage.set(key, deps.roundToTwo(deps.average(values)))
    })
  })

  return sectionRiskRateByStage
}
