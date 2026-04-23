// Deterministic world-realism engine — mathematical helpers for realistic mark
// distribution and per-stage learning dynamics.
//
// Pure function module. No DB. No wall-clock. Every output is a deterministic function
// of the seed and numeric inputs.
//
// Three capabilities:
//   1. stableTruncatedNormal — bell-shaped noise (replaces uniform stableBetween for realism)
//   2. stableAnchoredBeta    — anchored Beta distribution sample for mark realization
//   3. applyForgetDecay      — between-stage knowledge decay attenuated by relearn rate
//   4. realizeAssessmentMark — combines anchored Beta draw + intervention delta with bounds
//   5. computeMarkDelta      — maps cumulative intervention impact to per-assessment pct delta
//
// The anchored-Beta model replaces uniform-noise additive mark generation. Current code
// produces near-flat histograms because stableBetween(-14, 12) is uniform. Real exam
// distributions on per-student anchors are closer to Beta(α, β) with α+β controlled by
// (1 − volatility). This module provides that draw while keeping full determinism.

import type {
  AssessmentType,
  InterventionImpactTier,
  StudentLatentProfileForIntervention,
} from './proof-intervention-response-types.js'

// ---------- Pure utility helpers ----------

function stableUnit(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// ---------- Seeded gaussian (Box-Muller) ----------

export function stableGaussian(seed: string, mean: number, stdev: number): number {
  const u1 = Math.max(stableUnit(seed), 1e-10)
  const u2 = stableUnit(seed + '-pair')
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stdev
}

// Truncated normal: reroll up to 4 times if the draw falls outside [min, max]. If all
// attempts fail (rare unless bounds are very tight relative to stdev), clamp the final
// draw so the output is always in-range.
export function stableTruncatedNormal(input: {
  seed: string
  mean: number
  stdev: number
  min: number
  max: number
}): number {
  for (let attempt = 0; attempt < 4; attempt++) {
    const value = stableGaussian(`${input.seed}::try-${attempt}`, input.mean, input.stdev)
    if (value >= input.min && value <= input.max) return value
  }
  const fallback = stableGaussian(`${input.seed}::final`, input.mean, input.stdev)
  return clamp(fallback, input.min, input.max)
}

// ---------- Beta distribution quantile via Numerical Recipes §6.4 ----------

function logGamma(x: number): number {
  // Lanczos approximation, precision ~1e-15 for x > 0.
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  x -= 1
  const g = 7
  let a = p[0]!
  const t = x + g + 0.5
  for (let i = 1; i < p.length; i++) {
    a += p[i]! / (x + i)
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  // Modified Lentz's algorithm; converges typically in < 50 iter for our range.
  const MAX_ITER = 200
  const EPS = 3e-7
  const TINY = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPS) return h
  }
  return h
}

// Regularized incomplete beta I_x(a, b) — CDF of Beta(a, b) evaluated at x.
export function betaIncomplete(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log(1 - x),
  )
  const symmetric = x < (a + 1) / (a + b + 2)
  const aUse = symmetric ? a : b
  const bUse = symmetric ? b : a
  const xUse = symmetric ? x : 1 - x
  const cf = betaContinuedFraction(xUse, aUse, bUse)
  const result = bt * cf / aUse
  return symmetric ? result : 1 - result
}

// Inverse regularized incomplete beta — find x such that I_x(a, b) = u.
// Newton iteration with damped step to stay inside (0, 1).
export function betaQuantile(u: number, a: number, b: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  // Initial guess = mean of Beta(a, b)
  let x = a / (a + b)
  const logBetaFn = logGamma(a) + logGamma(b) - logGamma(a + b)
  const MAX_ITER = 30
  const TOL = 1e-7
  for (let i = 0; i < MAX_ITER; i++) {
    const f = betaIncomplete(x, a, b) - u
    if (Math.abs(f) < TOL) break
    const logPdf = (a - 1) * Math.log(Math.max(x, 1e-12))
      + (b - 1) * Math.log(Math.max(1 - x, 1e-12))
      - logBetaFn
    const pdf = Math.exp(logPdf)
    if (pdf < 1e-12) break
    let step = f / pdf
    let damp = 1
    let trial = x - step * damp
    while ((trial <= 0 || trial >= 1) && damp > 1e-6) {
      damp *= 0.5
      trial = x - step * damp
    }
    x = clamp(trial, 1e-6, 1 - 1e-6)
  }
  return x
}

// Anchored Beta sample. Given an anchor in [0, 1] and a concentration κ, samples from
// Beta(α = anchor×κ + 1, β = (1 − anchor)×κ + 1). Higher κ = tighter around anchor.
// We add +1 to both parameters so that α, β > 1 always, giving a unimodal distribution
// (avoiding the U-shaped Beta that occurs when α, β < 1).
export function stableAnchoredBeta(input: {
  seed: string
  anchor: number
  concentration: number
}): number {
  const safeAnchor = clamp(input.anchor, 0.01, 0.99)
  const kappa = clamp(input.concentration, 4, 80)
  const a = safeAnchor * kappa + 1
  const b = (1 - safeAnchor) * kappa + 1
  const u = clamp(stableUnit(input.seed), 1e-6, 1 - 1e-6)
  return betaQuantile(u, a, b)
}

// ---------- Assessment mark realization ----------

// Hard bounds per assessment — reflect real MSRUAS policy ranges.
export const ASSESSMENT_BOUNDS: Readonly<Record<AssessmentType, { min: number; max: number }>> = {
  attendance: { min: 52, max: 98 },
  tt1:        { min:  8, max: 97 },
  tt2:        { min:  8, max: 99 },
  quiz:       { min:  8, max: 99 },
  assignment: { min: 10, max: 99 },
  see:        { min:  8, max: 98 },
}

// How much room each assessment has to respond to an intervention.
// TT1 has zero room because by the time we're applying an intervention, TT1 is already
// written. TT2, quiz, assignment, SEE all have varying degrees of plasticity.
// Attendance can move up (the intervention is attendance-warning) but not much down.
export const ASSESSMENT_RESPONSIVENESS: Readonly<Record<AssessmentType, { min: number; max: number }>> = {
  attendance: { min: -2, max: 10 },
  tt1:        { min:  0, max:  0 },
  tt2:        { min: -2, max: 14 },
  quiz:       { min: -1, max:  9 },
  assignment: { min: -1, max: 11 },
  see:        { min: -2, max: 13 },
}

// Realize a mark: draw from the anchored Beta to get a realistic bell around the
// baseline anchor, then add the intervention delta (clipped to assessment-specific
// responsiveness bounds), then clamp to global assessment bounds.
export function realizeAssessmentMark(input: {
  seed: string
  assessmentType: AssessmentType
  anchorPct: number
  studentProfile: StudentLatentProfileForIntervention
  interventionDeltaPct: number
}): number {
  const bounds = ASSESSMENT_BOUNDS[input.assessmentType]
  const clampedAnchor = clamp(input.anchorPct, bounds.min, bounds.max) / 100
  const volatility = clamp(input.studentProfile.dynamics.volatility, 0.04, 0.62)
  // Low-volatility students cluster tightly around their anchor (high κ); high-volatility
  // students spread more widely. Range [6, 50] keeps the Beta from becoming pathological.
  const concentration = clamp(35 * (1 - volatility), 6, 50)
  const drawn = stableAnchoredBeta({
    seed: input.seed,
    anchor: clampedAnchor,
    concentration,
  }) * 100
  const respBounds = ASSESSMENT_RESPONSIVENESS[input.assessmentType]
  const clippedDelta = clamp(input.interventionDeltaPct, respBounds.min, respBounds.max)
  const adjusted = drawn + clippedDelta
  return roundTo(clamp(adjusted, bounds.min, bounds.max), 2)
}

// ---------- Between-stage decay ----------

// If `daysElapsedSinceLastEngagement` is 14 and forgetRate is 0.2, raw decay = 0.2 (fractional).
// Without intervention that's the full decay applied to the anchor. With intervention in
// the window, relearnRate attenuates: decay *= (1 − relearnRate × 0.4). A relearn rate of
// 0.5 therefore reduces decay to 80% of raw. Bounded at 0.3 to prevent runaway erasure.
export function applyForgetDecay(input: {
  studentProfile: StudentLatentProfileForIntervention
  daysElapsedSinceLastEngagement: number
  hadInterventionInWindow: boolean
}): number {
  const forgetRate = clamp(input.studentProfile.dynamics.forgetRate, 0, 0.28)
  const days = Math.max(0, input.daysElapsedSinceLastEngagement)
  const rawDecay = forgetRate * (days / 14)
  if (!input.hadInterventionInWindow) {
    return clamp(roundTo(rawDecay, 6), 0, 0.3)
  }
  const relearn = clamp(input.studentProfile.dynamics.relearnRate, 0, 1)
  const attenuated = rawDecay * (1 - relearn * 0.4)
  return clamp(roundTo(attenuated, 6), 0, 0.3)
}

// ---------- Mark delta from intervention impact ----------

export function computeMarkDelta(input: {
  totalInterventionImpact: number
  dominantTier: InterventionImpactTier | null
  assessmentType: AssessmentType
}): number {
  if (input.dominantTier === null || input.totalInterventionImpact <= 0) return 0
  const range = ASSESSMENT_RESPONSIVENESS[input.assessmentType]
  const span = range.max - range.min
  if (span <= 0) return 0
  const tierMultiplier =
    input.dominantTier === 'strong' ? 1.00 :
    input.dominantTier === 'partial' ? 0.55 : 0.15
  const delta = input.totalInterventionImpact * span * tierMultiplier
  // Delta is always positive when impact > 0 (interventions cannot hurt the student).
  // We still clamp to range.max to respect the per-assessment cap.
  return roundTo(clamp(delta, 0, range.max), 2)
}

// ---------- Forget decay applied to an anchor ----------

export function applyAnchorDecay(input: {
  anchorPct: number
  studentProfile: StudentLatentProfileForIntervention
  daysElapsedSinceLastEngagement: number
  hadInterventionInWindow: boolean
}): number {
  const decay = applyForgetDecay({
    studentProfile: input.studentProfile,
    daysElapsedSinceLastEngagement: input.daysElapsedSinceLastEngagement,
    hadInterventionInWindow: input.hadInterventionInWindow,
  })
  const anchorAfter = input.anchorPct * (1 - decay)
  return roundTo(clamp(anchorAfter, 0, 100), 2)
}
