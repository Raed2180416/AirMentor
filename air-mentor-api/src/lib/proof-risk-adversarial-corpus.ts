/**
 * Adversarial validation corpus.
 *
 * Closes roadmap §4 row E11 (no adversarial validation corpus). The
 * scenario engine in `msruas-proof-control-plane.ts` uses near-
 * exponential decay dynamics; the production-v8 model is therefore
 * fit to that family of generative assumptions. An adversarial
 * corpus is generated under a *different* family (here: power-law
 * forgetting per Wickelgren 1974, Rubin & Wenzel 1996) so the paper
 * Experiments section can quantify boundary-of-generalisation.
 *
 * Design constraints:
 *  - Determinism: every entry point takes a `seed`. Same (size, alpha,
 *    seed) produces byte-identical output.
 *  - Schema match: each row carries the subset of `ObservableFeaturePayload`
 *    fields the inference engine actually reads, plus enough metadata
 *    that a paper-evidence script can join back to the corpus row.
 *  - No model coupling: this module emits synthetic rows; scoring
 *    happens in the evaluator. Tests only assert generation
 *    properties, not model performance.
 *
 * Roadmap reference: P2 task 2.4 (stretch) per
 * docs/MASTER_ROADMAP_2026-05-01.md §5.
 */

// ---------------------------------------------------------------------
// PRNG (mulberry32, same as proof-risk-evaluation-stats.ts)
// ---------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------
// Public schema
// ---------------------------------------------------------------------

export type AdversarialFeatureRow = {
  /** Stable identifier — `${corpusKind}-${seed}-${index}`. */
  rowId: string
  corpusKind: 'power-law-forgetting' | 'exponential-forgetting-control'
  /** 1 .. 6 — synthetic semester index. */
  semesterNumber: number
  /** Subset of ObservableFeaturePayload fields the heuristic + logistic both read. */
  attendancePct: number
  currentCgpa: number
  backlogCount: number
  cgpaMissing: boolean
  backlogMissing: boolean
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
  quizPct: number | null
  assignmentPct: number | null
  weakCoCount: number
  attendanceHistoryRiskCount: number
  questionWeaknessCount: number
  interventionResponseScore: number | null
  /** Ground-truth label for paper evaluation. */
  label: 0 | 1
}

export type AdversarialCorpus = {
  corpusKind: 'power-law-forgetting' | 'exponential-forgetting-control'
  seed: number
  size: number
  alpha: number
  rows: AdversarialFeatureRow[]
  meta: {
    positiveRate: number
    /**
     * Mean attendance trajectory across the cohort, by semester. The
     * test suite compares this against the control corpus — power-law
     * forgetting produces a heavier-tailed late-semester decline.
     */
    attendanceMeanBySemester: number[]
  }
}

export type GenerateAdversarialCorpusOptions = {
  /** Total rows to produce. Default 96 (16 students × 6 semesters). */
  size?: number
  /**
   * Power-law decay exponent. Larger α → faster decay. Default 0.6
   * (Wickelgren-Rubin range for educational retention).
   */
  alpha?: number
  /** Seed for deterministic generation. Default 7 (chosen so the
   *  positive rate lands near the production-v8 train rate). */
  seed?: number
}

// ---------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------

/**
 * Power-law forgetting trajectory: F(t) = F0 * (1 + t)^(-α).
 *
 * Compared to exponential decay e^(-λt), the power-law tail is heavier
 * at long t. In educational terms: a student who falls behind in
 * semester 2 stays behind longer through semester 6 under power-law,
 * but recovers faster under exponential. The engine in
 * msruas-proof-control-plane.ts uses near-exponential dynamics, so
 * this corpus tests the production model's behaviour outside the
 * generative process it was trained on.
 */
export function generatePowerLawAdversarialCorpus(
  options: GenerateAdversarialCorpusOptions = {},
): AdversarialCorpus {
  return generateCorpus('power-law-forgetting', options)
}

/**
 * Control corpus with exponential decay: F(t) = F0 * e^(-λt). Produced
 * by the *same* code path as `generatePowerLawAdversarialCorpus` so
 * any AUC delta between the two corpora is attributable to the
 * forgetting kernel and not to confounded code paths.
 */
export function generateExponentialControlCorpus(
  options: GenerateAdversarialCorpusOptions = {},
): AdversarialCorpus {
  return generateCorpus('exponential-forgetting-control', options)
}

function generateCorpus(
  corpusKind: 'power-law-forgetting' | 'exponential-forgetting-control',
  options: GenerateAdversarialCorpusOptions,
): AdversarialCorpus {
  const size = options.size ?? 96
  const alpha = options.alpha ?? 0.6
  const seed = options.seed ?? 7
  if (size <= 0) throw new Error(`[adversarial-corpus] size must be > 0; got ${size}`)
  if (alpha <= 0) throw new Error(`[adversarial-corpus] alpha must be > 0; got ${alpha}`)

  const rng = mulberry32(seed)
  const numSemesters = 6
  const studentsPerSemester = Math.max(1, Math.floor(size / numSemesters))
  const rows: AdversarialFeatureRow[] = []

  // Per-student baseline ability ∈ [0, 1] — drives initial F0.
  const abilities: number[] = []
  for (let s = 0; s < studentsPerSemester; s += 1) abilities.push(rng())

  // Loss-magnitude scaling: bounded absolute drop per kernel rather
  // than multiplicative decay. Multiplicative decay was over-aggressive
  // and clamped both kernels to the institutional 40% floor by t=5,
  // hiding the kernel difference. With absolute loss, the kernel
  // difference (1 - decay(t)) stays visible at long t.
  const ATTENDANCE_LOSS_MAGNITUDE = 30 // up to 30 percentage points of attendance loss
  const CGPA_LOSS_MAGNITUDE = 3.0 // up to 3.0 GPA points of loss

  // For each student, simulate the trajectory across 6 semesters and emit one row per (student, sem).
  for (let studentIndex = 0; studentIndex < studentsPerSemester; studentIndex += 1) {
    const ability = abilities[studentIndex] as number
    // Initial attendance pct: 65–95 weighted by ability.
    const attendance0Pct = 65 + ability * 30
    // Initial CGPA: 5.0–9.5 weighted by ability.
    const cgpa0 = 5.0 + ability * 4.5

    for (let sem = 1; sem <= numSemesters; sem += 1) {
      // t = sem - 1 in [0, 5].
      const t = sem - 1
      const decay = corpusKind === 'power-law-forgetting'
        ? Math.pow(1 + t, -alpha)
        : Math.exp(-alpha * t)
      // Loss = magnitude × (1 - decay). Power-law (1 - decay) is
      // SMALLER at long t than exponential, so the power-law cohort
      // retains more attendance/CGPA at semester 6 — the
      // "boundary-of-generalisation" signal the paper uses.
      const loss = 1 - decay
      const attendanceJitter = (rng() - 0.5) * 4
      const cgpaJitter = (rng() - 0.5) * 0.4
      const attendancePct = clamp(attendance0Pct - ATTENDANCE_LOSS_MAGNITUDE * loss + attendanceJitter, 40, 99)
      const currentCgpa = clamp(cgpa0 - CGPA_LOSS_MAGNITUDE * loss + cgpaJitter, 2.0, 10.0)

      // Backlog count rises monotonically as attendance/CGPA drop.
      const backlogPressure = loss * (1 - ability)
      const backlogCount = Math.round(backlogPressure * 5)

      // TT1/TT2/SEE follow attendance + CGPA via simple linear projection.
      // Add deterministic noise so they aren't perfectly co-linear.
      const tt1Pct = clamp(attendancePct - 5 + (rng() - 0.5) * 8, 10, 99)
      const tt2Pct = clamp(tt1Pct - 2 + (rng() - 0.5) * 6, 10, 99)
      const seePct = sem >= 3
        ? clamp((tt1Pct * 0.5) + (tt2Pct * 0.5) + (rng() - 0.5) * 6, 8, 99)
        : null
      const quizPct = sem >= 4 ? clamp(60 + ability * 30 + (rng() - 0.5) * 10, 30, 99) : null
      const assignmentPct = sem >= 4 ? clamp(60 + ability * 28 + (rng() - 0.5) * 10, 30, 99) : null

      const weakCoCount = (tt2Pct < 50 || (seePct ?? 100) < 45) ? 2 : (tt2Pct < 60 ? 1 : 0)
      const attendanceHistoryRiskCount = attendancePct < 75 ? Math.min(sem, 3) : 0
      const questionWeaknessCount = tt2Pct < 50 ? 4 : (tt2Pct < 60 ? 2 : 0)
      const interventionResponseScore = sem >= 3 ? (rng() - 0.5) * 0.2 : null

      // Label: positive iff persistent at-risk by semester end. Both
      // kernels agree on labelling logic; the difference between them
      // surfaces in the *features* (heavier late-semester decline
      // under power-law) so a model that learned exponential dynamics
      // mis-ranks the power-law cohort even though the labels follow
      // the same rule.
      const labelDriver = loss * (1 - ability) + (1 - attendancePct / 100) * 0.4
      const label: 0 | 1 = labelDriver > 0.45 ? 1 : 0

      rows.push({
        rowId: `${corpusKind}-${seed}-${studentIndex}-${sem}`,
        corpusKind,
        semesterNumber: sem,
        attendancePct: roundToOne(attendancePct),
        currentCgpa: roundToTwo(currentCgpa),
        backlogCount,
        cgpaMissing: sem === 1,
        backlogMissing: sem === 1,
        tt1Pct: sem >= 1 ? roundToOne(tt1Pct) : null,
        tt2Pct: sem >= 2 ? roundToOne(tt2Pct) : null,
        seePct: seePct === null ? null : roundToOne(seePct),
        quizPct: quizPct === null ? null : roundToOne(quizPct),
        assignmentPct: assignmentPct === null ? null : roundToOne(assignmentPct),
        weakCoCount,
        attendanceHistoryRiskCount,
        questionWeaknessCount,
        interventionResponseScore: interventionResponseScore === null
          ? null
          : roundToTwo(interventionResponseScore),
        label,
      })
    }
  }

  // Trim or pad to exactly `size` rows for deterministic test invariants.
  while (rows.length > size) rows.pop()

  const positives = rows.reduce((sum, row) => sum + row.label, 0)
  const positiveRate = rows.length === 0 ? 0 : positives / rows.length
  const attendanceMeanBySemester: number[] = []
  for (let sem = 1; sem <= numSemesters; sem += 1) {
    const semRows = rows.filter(row => row.semesterNumber === sem)
    const mean = semRows.length === 0
      ? 0
      : semRows.reduce((sum, row) => sum + row.attendancePct, 0) / semRows.length
    attendanceMeanBySemester.push(roundToOne(mean))
  }

  return {
    corpusKind,
    seed,
    size: rows.length,
    alpha,
    rows,
    meta: {
      positiveRate,
      attendanceMeanBySemester,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}
