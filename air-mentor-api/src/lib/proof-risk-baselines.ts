/**
 * Reference baselines for the paper Experiments section.
 *
 * Closes roadmap §4 row E9 (paper claim N1 needs comparator baselines):
 *   - majority-class predictor (returns the empirical positive rate of
 *     the training labels)
 *   - 2-feature logistic regression on (attendancePct, currentCgpa) only
 *
 * `production-v8` (full 43-feature logistic) and `depth-2-tree`
 * challenger live in `proof-risk-model.ts`; `baseline-v5-like`
 * (ablation) lives there too. This module adds the simpler-still
 * baselines the paper needs to bracket the reported numbers.
 *
 * The 2-feature logistic is trained by Newton-Raphson IRLS — fast,
 * deterministic, no learning-rate dial. Convergence threshold is
 * 1e-8 on weight L2 step; 50-iteration cap protects against
 * pathological inputs (rejected by tests below).
 *
 * Roadmap reference: P2 task 2.2 per docs/MASTER_ROADMAP_2026-05-01.md §5.
 */

// ---------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------

export type BaselineFeatureRow = {
  attendancePct: number
  currentCgpa: number
}

export type BaselinePredictor = (rows: ReadonlyArray<BaselineFeatureRow>) => number[]

// ---------------------------------------------------------------------
// Majority-class baseline
// ---------------------------------------------------------------------

export type MajorityClassBaseline = {
  baselineId: 'majority-class'
  empiricalPositiveRate: number
  trainSize: number
  positiveCount: number
  predict: BaselinePredictor
}

/**
 * Returns the empirical positive rate of the training labels for every
 * input row. AUC of this predictor is exactly 0.5; Brier is the
 * variance of the label distribution. Useful as a literal "no signal"
 * floor in paper tables.
 */
export function trainMajorityClassBaseline(labels: ArrayLike<number>): MajorityClassBaseline {
  if (labels.length === 0) {
    return {
      baselineId: 'majority-class',
      empiricalPositiveRate: 0.5,
      trainSize: 0,
      positiveCount: 0,
      predict: rows => rows.map(() => 0.5),
    }
  }
  let positives = 0
  for (let i = 0; i < labels.length; i += 1) {
    if (labels[i] === 1) positives += 1
  }
  const empiricalPositiveRate = positives / labels.length
  return {
    baselineId: 'majority-class',
    empiricalPositiveRate,
    trainSize: labels.length,
    positiveCount: positives,
    predict: rows => rows.map(() => empiricalPositiveRate),
  }
}

// ---------------------------------------------------------------------
// 2-feature logistic regression: (attendance, CGPA) → P(positive)
// ---------------------------------------------------------------------

export type TwoFeatureLogisticBaseline = {
  baselineId: 'two-feature-logistic'
  /** [intercept, w_attendance, w_cgpa] */
  weights: [number, number, number]
  iterations: number
  converged: boolean
  /**
   * Per-feature normalisation (centered, scaled to unit variance) used
   * to stabilise IRLS on the natural scale of the inputs.
   */
  normalisation: {
    attendanceMean: number
    attendanceStd: number
    cgpaMean: number
    cgpaStd: number
  }
  predict: BaselinePredictor
}

export type TwoFeatureLogisticOptions = {
  /** Maximum Newton-Raphson iterations. Default 50. */
  maxIterations?: number
  /** L2 regularisation (ridge) coefficient on weights, not on the intercept. Default 1e-3. */
  ridge?: number
  /** Convergence threshold on the L2 norm of the weight step. Default 1e-8. */
  tolerance?: number
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const e = Math.exp(-value)
    return 1 / (1 + e)
  }
  const e = Math.exp(value)
  return e / (1 + e)
}

function meanStd(values: ArrayLike<number>): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 }
  let sum = 0
  for (let i = 0; i < values.length; i += 1) sum += values[i] as number
  const mean = sum / values.length
  let varianceSum = 0
  for (let i = 0; i < values.length; i += 1) {
    const diff = (values[i] as number) - mean
    varianceSum += diff * diff
  }
  const variance = varianceSum / values.length
  const std = Math.sqrt(variance)
  return { mean, std: std === 0 ? 1 : std }
}

/**
 * Fit logistic-regression weights with Newton-Raphson IRLS on a
 * 2-feature design matrix (intercept + standardised attendance +
 * standardised CGPA). Returns a deterministic predictor.
 */
export function trainTwoFeatureLogisticBaseline(
  rows: ReadonlyArray<BaselineFeatureRow>,
  labels: ArrayLike<number>,
  options: TwoFeatureLogisticOptions = {},
): TwoFeatureLogisticBaseline {
  if (rows.length !== labels.length) {
    throw new Error(
      `[trainTwoFeatureLogisticBaseline] length mismatch: rows=${rows.length} labels=${labels.length}`,
    )
  }
  const maxIterations = options.maxIterations ?? 50
  const ridge = options.ridge ?? 1e-3
  const tolerance = options.tolerance ?? 1e-8
  if (rows.length === 0) {
    const fallback: TwoFeatureLogisticBaseline = {
      baselineId: 'two-feature-logistic',
      weights: [0, 0, 0],
      iterations: 0,
      converged: true,
      normalisation: { attendanceMean: 0, attendanceStd: 1, cgpaMean: 0, cgpaStd: 1 },
      predict: predRows => predRows.map(() => 0.5),
    }
    return fallback
  }

  const attendance = rows.map(row => row.attendancePct)
  const cgpa = rows.map(row => row.currentCgpa)
  const attStats = meanStd(attendance)
  const cgpaStats = meanStd(cgpa)
  // Design matrix: [1, (att - μ)/σ, (cgpa - μ)/σ].
  const n = rows.length
  const design: number[][] = rows.map((row, i) => [
    1,
    ((attendance[i] as number) - attStats.mean) / attStats.std,
    ((cgpa[i] as number) - cgpaStats.mean) / cgpaStats.std,
  ])
  let weights: [number, number, number] = [0, 0, 0]
  let iterations = 0
  let converged = false

  for (let it = 0; it < maxIterations; it += 1) {
    iterations = it + 1
    const probabilities = design.map(x =>
      sigmoid(x[0]! * weights[0] + x[1]! * weights[1] + x[2]! * weights[2]),
    )
    // gradient g = Xᵀ (p - y) + ridge*[0,w1,w2]
    const grad: [number, number, number] = [0, 0, 0]
    for (let i = 0; i < n; i += 1) {
      const residual = (probabilities[i] as number) - (labels[i] as number)
      grad[0] += residual * (design[i]![0] as number)
      grad[1] += residual * (design[i]![1] as number)
      grad[2] += residual * (design[i]![2] as number)
    }
    grad[1] += ridge * weights[1]
    grad[2] += ridge * weights[2]
    // Hessian H = Xᵀ W X + ridge*diag(0,1,1) where W=diag(p_i*(1-p_i))
    const hessian: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for (let i = 0; i < n; i += 1) {
      const p = probabilities[i] as number
      const w = p * (1 - p)
      const x = design[i]!
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          hessian[r]![c] = (hessian[r]![c] as number) + w * (x[r] as number) * (x[c] as number)
        }
      }
    }
    hessian[1]![1] = (hessian[1]![1] as number) + ridge
    hessian[2]![2] = (hessian[2]![2] as number) + ridge
    // Solve Hessian * step = grad → step. 3x3 closed form.
    const step = solve3x3(hessian, grad)
    if (!step) {
      // singular Hessian → bail with current weights
      converged = false
      break
    }
    const next: [number, number, number] = [
      weights[0] - step[0],
      weights[1] - step[1],
      weights[2] - step[2],
    ]
    const stepNorm = Math.sqrt(step[0] ** 2 + step[1] ** 2 + step[2] ** 2)
    weights = next
    if (stepNorm < tolerance) {
      converged = true
      break
    }
  }

  const baseline: TwoFeatureLogisticBaseline = {
    baselineId: 'two-feature-logistic',
    weights,
    iterations,
    converged,
    normalisation: {
      attendanceMean: attStats.mean,
      attendanceStd: attStats.std,
      cgpaMean: cgpaStats.mean,
      cgpaStd: cgpaStats.std,
    },
    predict: predRows =>
      predRows.map(row => {
        const z =
          weights[0]
          + weights[1] * ((row.attendancePct - attStats.mean) / attStats.std)
          + weights[2] * ((row.currentCgpa - cgpaStats.mean) / cgpaStats.std)
        return sigmoid(z)
      }),
  }
  return baseline
}

// 3x3 linear solve via Cramer's rule. Returns null on singular input.
function solve3x3(A: number[][], b: ReadonlyArray<number>): [number, number, number] | null {
  const det =
    (A[0]![0] as number) * ((A[1]![1] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (A[2]![1] as number))
    - (A[0]![1] as number) * ((A[1]![0] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (A[2]![0] as number))
    + (A[0]![2] as number) * ((A[1]![0] as number) * (A[2]![1] as number) - (A[1]![1] as number) * (A[2]![0] as number))
  if (Math.abs(det) < 1e-12) return null
  const detX =
    (b[0] as number) * ((A[1]![1] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (A[2]![1] as number))
    - (A[0]![1] as number) * ((b[1] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (b[2] as number))
    + (A[0]![2] as number) * ((b[1] as number) * (A[2]![1] as number) - (A[1]![1] as number) * (b[2] as number))
  const detY =
    (A[0]![0] as number) * ((b[1] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (b[2] as number))
    - (b[0] as number) * ((A[1]![0] as number) * (A[2]![2] as number) - (A[1]![2] as number) * (A[2]![0] as number))
    + (A[0]![2] as number) * ((A[1]![0] as number) * (b[2] as number) - (b[1] as number) * (A[2]![0] as number))
  const detZ =
    (A[0]![0] as number) * ((A[1]![1] as number) * (b[2] as number) - (b[1] as number) * (A[2]![1] as number))
    - (A[0]![1] as number) * ((A[1]![0] as number) * (b[2] as number) - (b[1] as number) * (A[2]![0] as number))
    + (b[0] as number) * ((A[1]![0] as number) * (A[2]![1] as number) - (A[1]![1] as number) * (A[2]![0] as number))
  return [detX / det, detY / det, detZ / det]
}
