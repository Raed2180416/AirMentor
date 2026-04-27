// Proof-demo operational risk band overlay.
//
// The calibrated proof risk model (`PRODUCTION_RISK_THRESHOLDS` in
// `proof-risk-model.ts`) bands probabilities at high=0.85 / medium=0.4. Those
// thresholds reflect raw failure-probability semantics learned during model
// training. In the deterministic demo proof corpus the maximum observed
// `overallCourseRisk` is around 0.71, which means the calibrated High band is
// unreachable — even severely struggling synthetic students stay Medium.
//
// For the six-semester demo we surface a separate "operational urgency" band
// that rebands the same `overallCourseRisk` value with reduced thresholds, so
// students with strong evidence-backed risk are visible as High without
// touching the calibrated probabilities, head outputs, or driver text.
//
// IMPORTANT semantics:
//   * The calibrated `headProbabilities`, `riskProb`, and `observableDrivers`
//     remain unchanged — they continue to represent raw probability of
//     adverse outcomes.
//   * The operational band is documented in the demo as an "operational
//     urgency" classification, NOT as "X% chance of failure".
//   * Sem 1 pre-TT1 stays conservative because no prior academic history
//     enters the score; the demo high threshold is reached only when
//     prior CGPA / backlog / attendance / current marks combine into a
//     real risk signal.
//
// Threshold rationale:
//   * Operational High = 0.65 sits between the heaviest Medium plateau
//     (~0.55-0.62) and the observed maximum overallCourseRisk in the proof
//     corpus (~0.71). Students with evidence-supported severe profiles
//     (cgpa<5, backlog>=4, prerequisite pressure) cross 0.65 and surface as
//     High; students with milder issues (e.g. 3 sem-1 backlogs and
//     borderline cgpa) stay Medium until the next semester accumulates more
//     evidence. Tuned via sensitivity audit on the deterministic proof
//     corpus (see `docs/demo/risk-band-realism-audit-2026-04-27.md`).
//   * Operational Medium = 0.4 matches the calibrated medium boundary so
//     the existing Medium band semantics carry over unchanged.
//
// Apply this overlay only when banding the demo proof projections. Live
// production banding uses the calibrated `productionModel.thresholds`.
// Demo-context callers must opt in via `bandThresholdsOverride`; the
// `academic.ts` surface gates the override behind `proofScopeActive` so
// real institutional data never receives the demo banding.

export const PROOF_DEMO_OPERATIONAL_THRESHOLDS = {
  medium: 0.4,
  high: 0.65,
} as const

export type ProofDemoOperationalBandThresholds = {
  readonly medium: number
  readonly high: number
}

export type ProofDemoOperationalBandRationaleKind =
  | 'operational-high-evidence-supported'
  | 'operational-medium-active-monitoring'
  | 'operational-low-routine-monitoring'

export type ProofDemoOperationalBandResult = {
  band: 'High' | 'Medium' | 'Low'
  rationale: string
  rationaleKind: ProofDemoOperationalBandRationaleKind
  thresholds: ProofDemoOperationalBandThresholds
  score: number
}

export type ProofDemoOperationalBandContext = {
  semesterNumber?: number
  stageKey?: string | null
  queueState?: string | null
  evidenceWindow?: string | null
}

function rationaleFor(
  band: 'High' | 'Medium' | 'Low',
  context?: ProofDemoOperationalBandContext,
): { text: string; kind: ProofDemoOperationalBandRationaleKind } {
  const stageHint = context?.stageKey ? ` at ${context.stageKey}` : ''
  if (band === 'High') {
    return {
      text: `Operational urgency: evidence supports immediate intervention${stageHint}.`,
      kind: 'operational-high-evidence-supported',
    }
  }
  if (band === 'Medium') {
    return {
      text: `Operational watch: active monitoring${stageHint}.`,
      kind: 'operational-medium-active-monitoring',
    }
  }
  return {
    text: `Operational low: routine monitoring${stageHint}.`,
    kind: 'operational-low-routine-monitoring',
  }
}

export function deriveProofDemoOperationalBand(
  score: number,
  context?: ProofDemoOperationalBandContext,
): ProofDemoOperationalBandResult {
  const safe = Number.isFinite(score) ? score : 0
  const thresholds = PROOF_DEMO_OPERATIONAL_THRESHOLDS
  const band: 'High' | 'Medium' | 'Low' = safe >= thresholds.high
    ? 'High'
    : safe >= thresholds.medium
      ? 'Medium'
      : 'Low'
  const { text, kind } = rationaleFor(band, context)
  return {
    band,
    rationale: text,
    rationaleKind: kind,
    thresholds,
    score: safe,
  }
}
