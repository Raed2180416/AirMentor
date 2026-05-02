/**
 * Validation statistics — bootstrap CIs + permutation feature importance.
 *
 * Closes roadmap §4 rows E13 (bootstrap CIs on AUC) and E14
 * (permutation feature importance). Intentionally self-contained so
 * the production training pipeline in `proof-risk-model.ts` keeps
 * its narrow public surface; this module is consumed by the
 * evaluator and by the paper-evidence generator only.
 *
 * Determinism: every entry point takes a `seed: number` argument and
 * uses a `mulberry32`-style PRNG so reruns produce byte-identical
 * output. Tests at `tests/proof-risk-evaluation-stats.test.ts` lock
 * the determinism contract.
 *
 * Roadmap reference: P2 task 2.5 (calibration / bootstrap / per-feature
 * importance) per docs/MASTER_ROADMAP_2026-05-01.md §5.
 */

// ---------------------------------------------------------------------
// PRNG (mulberry32) — same algorithm used elsewhere in this codebase
// for determinism (see `tests/proof-risk-scoring-parity.test.ts:30`).
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
// Self-contained metric implementations. The existing private metrics
// in `proof-risk-model.ts` operate on `Array<{label, prob}>`; the
// validation stats here operate on parallel `predicted`/`actual`
// arrays so callers can reuse outputs from any model variant.
// ---------------------------------------------------------------------

/**
 * Mann-Whitney U / Wilcoxon ranksum AUC with mid-rank tie handling.
 * Returns 0.5 when one class is empty (canonical chance-level under
 * no-information) or when all predictions are tied (no rank
 * information available).
 *
 * Mid-rank tie handling matches the convention used by
 * scikit-learn's `roc_auc_score` and the SciPy ranksum tests; without
 * it, the Wilcoxon U on a fully-tied input would return whatever
 * stable-sort happened to put first, which is misleading. Tests at
 * `tests/proof-risk-evaluation-stats.test.ts` lock the "all-tied →
 * 0.5" contract that this is here to deliver.
 */
export function rocAucFromArrays(predicted: ArrayLike<number>, actual: ArrayLike<number>): number {
  if (predicted.length !== actual.length) {
    throw new Error(`[rocAucFromArrays] length mismatch: predicted=${predicted.length} actual=${actual.length}`)
  }
  let positives = 0
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] === 1) positives += 1
  }
  const negatives = actual.length - positives
  if (positives === 0 || negatives === 0) return 0.5
  const indices = Array.from({ length: actual.length }, (_, i) => i)
  indices.sort((a, b) => {
    const left = predicted[a] as number
    const right = predicted[b] as number
    if (left === right) return a - b
    return left - right
  })

  // Average-rank for ties: walk the sorted list, identify runs of
  // equal predicted values, and assign each row in the run the
  // arithmetic mean of the ranks it spans (i.e. (firstRank + lastRank) / 2).
  const ranks = new Array<number>(actual.length).fill(0)
  let runStart = 0
  while (runStart < indices.length) {
    let runEnd = runStart
    const runValue = predicted[indices[runStart] as number] as number
    while (runEnd + 1 < indices.length && (predicted[indices[runEnd + 1] as number] as number) === runValue) {
      runEnd += 1
    }
    const averageRank = (runStart + runEnd) / 2 + 1 // 1-based ranks
    for (let r = runStart; r <= runEnd; r += 1) {
      ranks[indices[r] as number] = averageRank
    }
    runStart = runEnd + 1
  }

  let rankSum = 0
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] === 1) rankSum += ranks[i] as number
  }
  return Math.max(0, Math.min(1, (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives)))
}

export function brierScoreFromArrays(predicted: ArrayLike<number>, actual: ArrayLike<number>): number {
  if (predicted.length === 0) return 0
  let sum = 0
  for (let i = 0; i < predicted.length; i += 1) {
    const diff = (actual[i] as number) - (predicted[i] as number)
    sum += diff * diff
  }
  return sum / predicted.length
}

// ---------------------------------------------------------------------
// Bootstrap CI on a paired metric.
// ---------------------------------------------------------------------

export type BootstrapCiResult = {
  /** Point estimate on the original (un-resampled) sample. */
  pointEstimate: number
  /** Mean of the bootstrap distribution. */
  bootstrapMean: number
  /** Lower bound at α/2 percentile. */
  lower: number
  /** Upper bound at 1 − α/2 percentile. */
  upper: number
  /** Number of bootstrap resamples actually computed. */
  B: number
  /** Two-sided alpha used. 0.05 → 95% CI. */
  alpha: number
  /** Seed used for the PRNG. */
  seed: number
}

export type PairedMetric = (predicted: ArrayLike<number>, actual: ArrayLike<number>) => number

/**
 * Bootstrap a paired metric (e.g. AUC) on (predicted, actual) by
 * resampling indices with replacement B times. Returns the point
 * estimate, the bootstrap mean, and the symmetric percentile CI at
 * level (1 − α).
 *
 * The default B=1000 / α=0.05 matches the paper-Methods convention
 * used in EDM literature reviews (Romero & Ventura 2020 and
 * Bujang et al. 2021 reference the percentile bootstrap as the
 * standard for AUC CI reporting in education-data-mining baselines).
 *
 * Stable order guarantees: callers pass arrays in a deterministic
 * order; the PRNG is seeded; therefore the output is reproducible.
 */
export function bootstrapMetricCi(
  metric: PairedMetric,
  predicted: ArrayLike<number>,
  actual: ArrayLike<number>,
  options: { B?: number; alpha?: number; seed?: number } = {},
): BootstrapCiResult {
  if (predicted.length !== actual.length) {
    throw new Error(
      `[bootstrapMetricCi] length mismatch: predicted=${predicted.length} actual=${actual.length}`,
    )
  }
  const B = options.B ?? 1000
  const alpha = options.alpha ?? 0.05
  const seed = options.seed ?? 42
  if (B <= 0) throw new Error(`[bootstrapMetricCi] B must be > 0; got ${B}`)
  if (alpha <= 0 || alpha >= 1) throw new Error(`[bootstrapMetricCi] alpha must be in (0, 1); got ${alpha}`)
  if (predicted.length === 0) {
    return { pointEstimate: 0.5, bootstrapMean: 0.5, lower: 0.5, upper: 0.5, B, alpha, seed }
  }

  const rng = mulberry32(seed)
  const n = predicted.length
  const pointEstimate = metric(predicted, actual)
  const draws: number[] = []
  // Reusable buffers cut allocator pressure when B is large.
  const sampledPredicted = new Float64Array(n)
  const sampledActual = new Float64Array(n)
  for (let b = 0; b < B; b += 1) {
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(rng() * n)
      sampledPredicted[i] = predicted[idx] as number
      sampledActual[i] = actual[idx] as number
    }
    draws.push(metric(sampledPredicted, sampledActual))
  }
  draws.sort((left, right) => left - right)
  const bootstrapMean = draws.reduce((sum, value) => sum + value, 0) / draws.length
  const lowerIndex = Math.floor((alpha / 2) * draws.length)
  const upperIndex = Math.min(draws.length - 1, Math.ceil((1 - alpha / 2) * draws.length) - 1)
  return {
    pointEstimate,
    bootstrapMean,
    lower: draws[lowerIndex] as number,
    upper: draws[upperIndex] as number,
    B,
    alpha,
    seed,
  }
}

/** Convenience wrapper for AUC. */
export function bootstrapAucCi(
  predicted: ArrayLike<number>,
  actual: ArrayLike<number>,
  options: { B?: number; alpha?: number; seed?: number } = {},
): BootstrapCiResult {
  return bootstrapMetricCi(rocAucFromArrays, predicted, actual, options)
}

/** Convenience wrapper for Brier. */
export function bootstrapBrierCi(
  predicted: ArrayLike<number>,
  actual: ArrayLike<number>,
  options: { B?: number; alpha?: number; seed?: number } = {},
): BootstrapCiResult {
  return bootstrapMetricCi(brierScoreFromArrays, predicted, actual, options)
}

// ---------------------------------------------------------------------
// Permutation feature importance.
// ---------------------------------------------------------------------

export type PermutationImportanceResult<K extends string> = {
  /** Per-feature importance: positive value = metric drops when the feature is permuted. */
  perFeature: Record<K, { delta: number; std: number; baseline: number; permuted: number }>
  /** Number of permutations per feature. */
  B: number
  /** Seed used. */
  seed: number
  /** Metric direction: 'higher-is-better' (e.g. AUC) → delta = baseline - permuted. */
  metricDirection: 'higher-is-better' | 'lower-is-better'
}

export type FeatureRow<K extends string> = Record<K, number>

export type ScoreFn<K extends string> = (rows: ReadonlyArray<FeatureRow<K>>) => number[]

/**
 * Permutation feature importance per Breiman (2001) and the
 * implementation pattern in scikit-learn `permutation_importance`.
 * For each feature key in `featureKeys` we shuffle that column `B`
 * times (independently) and observe how much the metric degrades on
 * the resulting "broken" feature matrix. Larger drops mean the model
 * relied more heavily on that feature.
 *
 * The metric `metric(predicted, actual)` runs over per-row scalars.
 * `scoreFn(rows)` returns predicted probabilities; it is the only
 * model coupling — any scoring path (logistic, tree, hybrid, future
 * CatBoost) plugs in.
 *
 * Tests in `tests/proof-risk-evaluation-stats.test.ts` lock:
 *   - determinism with fixed seed
 *   - irrelevant-feature shuffle has near-zero importance
 *   - relevant-feature shuffle has large positive importance
 *   - shape of returned record matches `featureKeys`
 */
export function permutationFeatureImportance<K extends string>(
  rows: ReadonlyArray<FeatureRow<K>>,
  actual: ArrayLike<number>,
  featureKeys: ReadonlyArray<K>,
  scoreFn: ScoreFn<K>,
  metric: PairedMetric,
  options: {
    B?: number
    seed?: number
    metricDirection?: 'higher-is-better' | 'lower-is-better'
  } = {},
): PermutationImportanceResult<K> {
  if (rows.length !== actual.length) {
    throw new Error(`[permutationFeatureImportance] length mismatch: rows=${rows.length} actual=${actual.length}`)
  }
  const B = options.B ?? 20
  const seed = options.seed ?? 42
  const metricDirection = options.metricDirection ?? 'higher-is-better'
  if (B <= 0) throw new Error(`[permutationFeatureImportance] B must be > 0; got ${B}`)

  const rng = mulberry32(seed)
  const baselinePredicted = scoreFn(rows)
  const baseline = metric(baselinePredicted, actual)

  const perFeature = {} as Record<K, { delta: number; std: number; baseline: number; permuted: number }>

  for (const featureKey of featureKeys) {
    const samples: number[] = []
    for (let b = 0; b < B; b += 1) {
      // Fisher-Yates shuffle of the column values, deterministic
      // because rng is seeded once at the top of the function and
      // consumed in featureKey-order.
      const columnValues = rows.map(row => row[featureKey])
      for (let i = columnValues.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1))
        const tmp = columnValues[i] as number
        columnValues[i] = columnValues[j] as number
        columnValues[j] = tmp
      }
      const permutedRows = rows.map((row, index) => ({ ...row, [featureKey]: columnValues[index] }) as FeatureRow<K>)
      const permutedPredicted = scoreFn(permutedRows)
      samples.push(metric(permutedPredicted, actual))
    }
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, samples.length - 1)
    const std = Math.sqrt(variance)
    const delta = metricDirection === 'higher-is-better' ? baseline - mean : mean - baseline
    perFeature[featureKey] = { delta, std, baseline, permuted: mean }
  }

  return { perFeature, B, seed, metricDirection }
}

// ---------------------------------------------------------------------
// Reliability bins (calibration plot data; closes E12 partial-→-done).
// The reliability *diagram* (PNG/SVG) is rendered by the paper-figure
// script in `scripts/paper-figures/calibration-plot.py` (P10);
// here we only emit the binned data the figure script consumes.
// ---------------------------------------------------------------------

export type ReliabilityBin = {
  binIndex: number
  binLowerBound: number
  binUpperBound: number
  count: number
  meanPredicted: number
  fractionPositive: number
}

export type ReliabilityDiagramData = {
  bins: ReliabilityBin[]
  /**
   * Expected Calibration Error (ECE): weighted average of |p̄ − ȳ|
   * across populated bins, weights = bin count / N.
   */
  expectedCalibrationError: number
  /** Maximum gap |p̄ − ȳ| over populated bins (MCE). */
  maxCalibrationError: number
  totalCount: number
}

export function reliabilityDiagramData(
  predicted: ArrayLike<number>,
  actual: ArrayLike<number>,
  options: { numBins?: number } = {},
): ReliabilityDiagramData {
  if (predicted.length !== actual.length) {
    throw new Error(`[reliabilityDiagramData] length mismatch: predicted=${predicted.length} actual=${actual.length}`)
  }
  const numBins = options.numBins ?? 10
  if (numBins <= 0) throw new Error(`[reliabilityDiagramData] numBins must be > 0; got ${numBins}`)
  const bins: ReliabilityBin[] = []
  for (let b = 0; b < numBins; b += 1) {
    bins.push({
      binIndex: b,
      binLowerBound: b / numBins,
      binUpperBound: (b + 1) / numBins,
      count: 0,
      meanPredicted: 0,
      fractionPositive: 0,
    })
  }
  const sums = new Array(numBins).fill(0) as number[]
  const positives = new Array(numBins).fill(0) as number[]
  for (let i = 0; i < predicted.length; i += 1) {
    const p = predicted[i] as number
    const idx = Math.min(numBins - 1, Math.max(0, Math.floor(p * numBins)))
    const bin = bins[idx] as ReliabilityBin
    bin.count += 1
    sums[idx] = (sums[idx] as number) + p
    if (actual[i] === 1) positives[idx] = (positives[idx] as number) + 1
  }
  let ece = 0
  let mce = 0
  for (let b = 0; b < numBins; b += 1) {
    const bin = bins[b] as ReliabilityBin
    if (bin.count === 0) continue
    bin.meanPredicted = (sums[b] as number) / bin.count
    bin.fractionPositive = (positives[b] as number) / bin.count
    const gap = Math.abs(bin.meanPredicted - bin.fractionPositive)
    ece += (bin.count / predicted.length) * gap
    if (gap > mce) mce = gap
  }
  return {
    bins,
    expectedCalibrationError: ece,
    maxCalibrationError: mce,
    totalCount: predicted.length,
  }
}
