/**
 * Learning-dynamics constants.
 *
 * Single source of truth for every numeric coefficient consumed by the
 * inference engine and the scenario engine. Each constant carries a
 * JSDoc `@bib` tag whose value matches a key in `docs/references.bib`,
 * or is annotated `@source institutional` (MSRUAS academic regulation,
 * disclosed in the paper Methods footnote) or `@source engineering`
 * (calibration choice, disclosed in the paper Limitations).
 *
 * The full audit trail per constant lives in
 * `docs/paper-evidence/01-literature-table.md`. Per-family literature
 * grounding for the scenario engine lives in
 * `docs/paper-evidence/scenario-grounding.md`.
 *
 * Roadmap reference: P1 (docs/MASTER_ROADMAP_2026-05-01.md §5).
 *
 * Invariants protected by `tests/learning-dynamics-constants.test.ts`:
 *   1. Every impact constant ∈ [-0.30, 0.30].
 *   2. Every "high" impact > its "medium" pair.
 *   3. Bloom-level mastery targets are monotone increasing.
 *   4. Band thresholds are ordered: BASELINE < MEDIUM < HIGH and each ∈ [0, 1].
 *   5. Driver clamp is symmetric around 0.5 and inside [0, 1].
 *
 * Do NOT edit a magnitude here without updating its row in
 * `docs/paper-evidence/01-literature-table.md` and adding a CHANGELOG
 * entry, otherwise the paper-evidence audit drifts.
 */

// =====================================================================
// Section A — Inference engine driver impacts
// Code site of consumer: air-mentor-api/src/lib/inference-engine.ts
// =====================================================================

/**
 * Impact added when attendance falls below the high-risk threshold.
 *
 * Largest single driver in the heuristic. Anchored in the Credé et al.
 * meta-analysis (k=69, N=21,195) which reports ρ=0.44 attendance-grade
 * and ρ=0.41 attendance-GPA — the strongest known predictor of
 * undergraduate performance.
 *
 * @bib crede2010class
 * @bib marburger2001absenteeism
 */
export const ATTENDANCE_HIGH_RISK_IMPACT = 0.28

/**
 * Impact added when attendance falls below the medium-risk threshold.
 *
 * Half-step of the high-risk impact: literature anchors the existence
 * of the gradient, the half-step is engineering for monotone
 * escalation.
 *
 * @bib crede2010class
 */
export const ATTENDANCE_MEDIUM_RISK_IMPACT = 0.14

/**
 * Impact added when current CGPA falls below the high-risk threshold.
 *
 * MSRUAS academic-warning trigger is CGPA < 5.0. Literature framing is
 * Tinto's academic-integration model and Astin's involvement theory.
 *
 * @bib tinto1993leaving
 * @bib astin1984student
 * @source institutional
 */
export const CGPA_HIGH_RISK_IMPACT = 0.20

/**
 * Impact added when current CGPA falls below the watch threshold.
 *
 * Half-step of high-risk; institutional CGPA-watch policy.
 *
 * @source institutional
 */
export const CGPA_MEDIUM_RISK_IMPACT = 0.10

/**
 * Impact added when active backlog count is high.
 *
 * Operationalises Tinto's cumulative-cascade model and Bean-Eaton's
 * psychological-barrier theory: each unresolved backlog lifts the
 * probability of further failure.
 *
 * @bib tinto1993leaving
 * @bib bean2001psychology
 */
export const BACKLOG_HIGH_RISK_IMPACT = 0.18

/**
 * Impact added when active backlog count is above the watch threshold.
 *
 * Half-step of high-risk; institutional escalation rule.
 *
 * @source institutional
 */
export const BACKLOG_MEDIUM_RISK_IMPACT = 0.09

/**
 * Impact added when a single term-test or SEE percent falls below the
 * "very low" boundary (40%, ~5 points below MSRUAS pass-mark).
 *
 * @source institutional
 */
export const TERM_SIGNAL_VERY_LOW_IMPACT = 0.16

/**
 * Impact added when a single term-test or SEE percent falls below the
 * "watch" boundary (55%).
 *
 * @source institutional
 */
export const TERM_SIGNAL_WATCH_IMPACT = 0.08

/**
 * Threshold (percent) below which a term-test or SEE result is "very low".
 *
 * Operational watch line; ~5 points below MSRUAS pass-mark of 50% TT
 * and 35% SEE. Subject to P1.6 disclosure: there is no literature
 * anchor for the exact 40% cut.
 *
 * @source institutional
 */
export const TERM_SIGNAL_VERY_LOW_THRESHOLD_PCT = 40

/**
 * Threshold (percent) below which a term-test or SEE result is on the
 * institutional "comfortable pass" watchlist.
 *
 * @source institutional
 */
export const TERM_SIGNAL_WATCH_THRESHOLD_PCT = 55

/**
 * Impact added when attendance has been below threshold across multiple
 * checkpoints (compound trend, not a single snapshot).
 *
 * @bib crede2010class
 */
export const ATTENDANCE_TREND_IMPACT = 0.08

/** Number of checkpoint hits required to trigger the trend impact. */
export const ATTENDANCE_TREND_THRESHOLD_COUNT = 2

/**
 * Impact when ≥ N question-level weaknesses surface in the same paper
 * (fine-grained mastery deficit).
 *
 * @bib corbett1995knowledge
 * @bib anderson1996actr
 */
export const QUESTION_WEAKNESS_HIGH_IMPACT = 0.09

/** Question-weakness count required to trigger the high-impact band. */
export const QUESTION_WEAKNESS_HIGH_THRESHOLD_COUNT = 4

/**
 * Impact when ≥ M (smaller) question-level weaknesses surface; half-step
 * of the high-impact band.
 *
 * @source engineering
 */
export const QUESTION_WEAKNESS_MEDIUM_IMPACT = 0.05

/** Question-weakness count required to trigger the medium-impact band. */
export const QUESTION_WEAKNESS_MEDIUM_THRESHOLD_COUNT = 2

/**
 * Impact when quiz performance is below the institutional threshold.
 *
 * @source institutional
 */
export const QUIZ_WEAK_IMPACT = 0.06

/** Quiz percent threshold below which the quiz-weak impact fires. */
export const QUIZ_WEAK_THRESHOLD_PCT = 45

/**
 * Impact when assignment performance is below the institutional threshold.
 *
 * @source institutional
 */
export const ASSIGNMENT_WEAK_IMPACT = 0.06

/** Assignment percent threshold below which the assignment-weak impact fires. */
export const ASSIGNMENT_WEAK_THRESHOLD_PCT = 45

/**
 * Impact when ≥ 2 course outcomes are below the support threshold.
 *
 * Maps to Corbett-Anderson knowledge-tracing framework: multiple unmet
 * outcomes signal cumulative skill gap.
 *
 * @bib corbett1995knowledge
 * @bib anderson1996actr
 */
export const WEAK_CO_HIGH_IMPACT = 0.10

/** Weak-CO count required to trigger high-impact band. */
export const WEAK_CO_HIGH_THRESHOLD_COUNT = 2

/**
 * Impact when exactly one course outcome is below the support threshold.
 *
 * @source engineering
 */
export const WEAK_CO_MEDIUM_IMPACT = 0.05

/**
 * Impact when observed response after support is below the expected
 * recovery threshold (Bean-Eaton non-response state).
 *
 * @bib bean2001psychology
 * @bib tinto1993leaving
 */
export const INTERVENTION_NEGATIVE_RESPONSE_IMPACT = 0.08

/** Intervention-response score below which the negative-response driver fires. */
export const INTERVENTION_NEGATIVE_RESPONSE_THRESHOLD = -0.05

/**
 * Impact when observed response after support exceeds the expected
 * recovery threshold (positive recovery → reduces risk).
 *
 * @source engineering
 */
export const INTERVENTION_POSITIVE_RESPONSE_IMPACT = -0.05

/** Intervention-response score above which the positive-response driver fires. */
export const INTERVENTION_POSITIVE_RESPONSE_THRESHOLD = 0.08

/**
 * Population prior used as the inference-engine baseline before drivers
 * are summed.
 *
 * @source engineering
 */
export const INFERENCE_BASELINE_RISK = 0.08

/**
 * Lower clamp on the bounded risk probability returned by the engine.
 *
 * Numerical-stability clamp (avoid 0) and operator-comprehension floor.
 *
 * @source engineering
 */
export const INFERENCE_RISK_LOWER_CLAMP = 0.05

/**
 * Upper clamp on the bounded risk probability.
 *
 * Numerical-stability clamp (avoid 1) and operator-comprehension ceiling.
 *
 * @source engineering
 */
export const INFERENCE_RISK_UPPER_CLAMP = 0.95

/**
 * Boundary at or above which the band is `High`.
 *
 * No literature support for the exact cut. Operator-tunable (deferred,
 * audit-map/08-ml-audit/01 GAP-6). To be replaced in P3 by
 * config-driven thresholds.
 *
 * @source engineering
 */
export const RISK_BAND_HIGH_THRESHOLD = 0.7

/**
 * Boundary at or above which the band is `Medium` (and below
 * `RISK_BAND_HIGH_THRESHOLD`).
 *
 * @source engineering
 */
export const RISK_BAND_MEDIUM_THRESHOLD = 0.35

// =====================================================================
// Section B — Scenario engine family fingerprints
// Code site of consumer: air-mentor-api/src/lib/msruas-proof-control-plane.ts
// =====================================================================

/**
 * Per-family scenario profile fingerprints. Each row is the deterministic
 * shift vector applied before the seed-derived domain perturbation.
 *
 * The fingerprint dimension (largest absolute value) per family is the
 * "load-bearing axis" documented in `docs/paper-evidence/scenario-grounding.md`.
 *
 * Literature anchors per family:
 *  - weak-foundation        → @bib tinto1975dropout, tinto1993leaving, astin1984student
 *  - low-attendance         → @bib crede2010class, marburger2001absenteeism
 *  - high-forgetting        → @bib cepeda2006spacing, pashler2007organizing, murre2015replication, ebbinghaus1885memory
 *  - coursework-inflation   → @bib astin1984student
 *  - exam-fragility         → @bib zeidner1998test
 *  - carryover-heavy        → @bib tinto1993leaving, bean2001psychology
 *  - intervention-resistant → @bib bean2001psychology, tinto1993leaving
 *  - balanced               → @source engineering (deliberate null/control)
 *
 * The exact magnitudes are engineering-tier: defended by the P2
 * sensitivity sweep (±20% AUC delta) per roadmap §5 P2 task 2.3.
 */
// Reconciled (D8 closure 2026-05-01): re-export the canonical
// scenario-family enum from `proof-risk-model.ts`. This keeps
// `PROOF_SCENARIO_FAMILIES` (runtime tuple, ordering matters for
// manifest indexing) and `ScenarioFamily` (string-literal union) the
// single source of truth across the codebase. Prior duplicate type
// declared here was compile-safe (same 8 strings) but drift-prone.
export type { ScenarioFamily } from './proof-risk-model.js'
import type { ScenarioFamily } from './proof-risk-model.js'

export type ScenarioFingerprint = {
  sectionAbilityShift: number
  sectionDisciplineShift: number
  forgetRateShift: number
  courseworkReliabilityShift: number
  examPressureShift: number
  supportResponsivenessShift: number
}

export const SCENARIO_FINGERPRINTS: Record<ScenarioFamily, ScenarioFingerprint> = {
  'weak-foundation': {
    sectionAbilityShift: -0.09,
    sectionDisciplineShift: -0.01,
    forgetRateShift: 0.02,
    courseworkReliabilityShift: -0.01,
    examPressureShift: 0.04,
    supportResponsivenessShift: -0.02,
  },
  'low-attendance': {
    sectionAbilityShift: -0.01,
    sectionDisciplineShift: -0.08,
    forgetRateShift: 0.01,
    courseworkReliabilityShift: 0,
    examPressureShift: 0.02,
    supportResponsivenessShift: -0.04,
  },
  'high-forgetting': {
    sectionAbilityShift: 0,
    sectionDisciplineShift: -0.01,
    forgetRateShift: 0.07,
    courseworkReliabilityShift: -0.02,
    examPressureShift: 0.03,
    supportResponsivenessShift: -0.02,
  },
  'coursework-inflation': {
    sectionAbilityShift: -0.02,
    sectionDisciplineShift: 0.02,
    forgetRateShift: 0.01,
    courseworkReliabilityShift: 0.08,
    examPressureShift: 0.01,
    supportResponsivenessShift: 0,
  },
  'exam-fragility': {
    sectionAbilityShift: -0.01,
    sectionDisciplineShift: 0,
    forgetRateShift: 0.02,
    courseworkReliabilityShift: 0.01,
    examPressureShift: 0.08,
    supportResponsivenessShift: -0.01,
  },
  'carryover-heavy': {
    sectionAbilityShift: -0.05,
    sectionDisciplineShift: -0.01,
    forgetRateShift: 0.03,
    courseworkReliabilityShift: -0.01,
    examPressureShift: 0.03,
    supportResponsivenessShift: -0.02,
  },
  'intervention-resistant': {
    sectionAbilityShift: -0.02,
    sectionDisciplineShift: -0.02,
    forgetRateShift: 0.02,
    courseworkReliabilityShift: -0.02,
    examPressureShift: 0.04,
    supportResponsivenessShift: -0.09,
  },
  balanced: {
    sectionAbilityShift: 0,
    sectionDisciplineShift: 0,
    forgetRateShift: 0,
    courseworkReliabilityShift: 0,
    examPressureShift: 0,
    supportResponsivenessShift: 0,
  },
}

// =====================================================================
// Section C — Curriculum / mastery thresholds
// (consumed by future P3 wire-up; see roadmap §5 P3 task 3.2)
// =====================================================================

/**
 * Bloom-level → mastery target mapping used by P3 to derive
 * `outcomeMasteryTarget` from `outcomeBloomLevel`.
 *
 * Magnitudes are engineering-tier; framework anchored.
 *
 * @bib corbett1995knowledge
 * @bib anderson1996actr
 * @source engineering
 */
export const BLOOM_LEVEL_MASTERY_TARGET: Record<
  'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create',
  number
> = {
  remember: 0.50,
  understand: 0.50,
  apply: 0.60,
  analyze: 0.70,
  evaluate: 0.80,
  create: 0.90,
}

/**
 * Threshold ratio used to flag a course outcome as "weak" once P3
 * lands: `mastery < target * MASTERY_WEAKNESS_RATIO`.
 *
 * Replaces the hardcoded `tt2Pct < 50 || seePct < 45` rule at
 * `msruas-proof-control-plane.ts:1286`. Magnitude engineering.
 *
 * @source engineering
 */
export const MASTERY_WEAKNESS_RATIO = 0.85

/**
 * Default edge-weight mapping for prerequisite edges before P3 explicit
 * weight wire-up.
 *
 * - `explicit` (official curriculum prerequisite) = 1.0
 * - `added`    (admin-supplied support link)      = 0.5
 *
 * @source institutional
 */
export const PREREQUISITE_EDGE_DEFAULT_WEIGHT = {
  explicit: 1.0,
  added: 0.5,
}

// =====================================================================
// Source-class summary (kept in source so a code reader sees the
// disclosure surface immediately).
// =====================================================================

export const CONSTANTS_SOURCE_CLASS_SUMMARY = {
  total: 32,
  literature: 12,
  institutional: 11,
  engineering: 9,
  paperEvidenceFile: 'docs/paper-evidence/01-literature-table.md',
  bibFile: 'docs/references.bib',
} as const
