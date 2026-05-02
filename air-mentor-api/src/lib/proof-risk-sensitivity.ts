/**
 * One-at-a-time (OAT) sensitivity sweep.
 *
 * Closes roadmap §4 row E10 (no sensitivity analysis). For each
 * registered parameter we re-score a fixed evaluation set with the
 * parameter scaled by 0.8x and 1.2x and report the AUC delta vs the
 * baseline. The loop is generic so any scorer that exposes a
 * "scale a single named parameter" handle plugs in.
 *
 * OAT is the simplest defensible local-sensitivity protocol; it
 * misses interaction effects (which a global Sobol sweep would
 * catch). The paper Methods footnote will state this; a Sobol /
 * Morris sweep is a future-work item if reviewers demand it.
 *
 * Roadmap reference: P2 task 2.3 per docs/MASTER_ROADMAP_2026-05-01.md §5.
 *
 * Determinism: uses no PRNG; only deterministic AUC computation.
 */

import { rocAucFromArrays } from './proof-risk-evaluation-stats.js'

export type SensitivityScorer<R> = (
  rows: ReadonlyArray<R>,
  parameterOverrides: Record<string, number>,
) => number[]

export type SensitivityParameter = {
  /** Stable identifier; appears in the output row. */
  name: string
  /** Baseline value (so callers can sanity-check before running). */
  baselineValue: number
  /**
   * Optional: override the multiplicative perturbation set per
   * parameter. Defaults to global `defaultPerturbations` argument.
   */
  perturbations?: ReadonlyArray<number>
}

export type SensitivityRow = {
  parameterName: string
  baselineValue: number
  baselineAuc: number
  perturbedFactor: number
  perturbedValue: number
  perturbedAuc: number
  /** baselineAuc - perturbedAuc. Positive means perturbation hurt. */
  aucDelta: number
  /** Absolute |aucDelta| — used to rank by sensitivity magnitude. */
  aucDeltaMagnitude: number
}

export type SensitivitySweepResult<R> = {
  baselineAuc: number
  rows: SensitivityRow[]
  /** Paramters ranked by max |aucDelta| across their perturbation set. */
  rankedByMagnitude: Array<{ parameterName: string; maxMagnitude: number }>
  /** Total scoring evaluations performed (1 baseline + Σ |perturbations|). */
  totalEvaluations: number
}

/**
 * Run a one-at-a-time sensitivity sweep.
 *
 * @param parameters list of named parameters with baseline values
 * @param scorer callback that scores `rows` with a single named
 *   parameter overridden; returns predicted probabilities
 * @param rows evaluation features
 * @param labels evaluation labels
 * @param defaultPerturbations multiplicative factors applied to each
 *   parameter unless that parameter overrides the set
 */
export function runOneAtATimeSensitivity<R>(
  parameters: ReadonlyArray<SensitivityParameter>,
  scorer: SensitivityScorer<R>,
  rows: ReadonlyArray<R>,
  labels: ArrayLike<number>,
  defaultPerturbations: ReadonlyArray<number> = [0.8, 1.2],
): SensitivitySweepResult<R> {
  if (rows.length !== labels.length) {
    throw new Error(`[runOneAtATimeSensitivity] length mismatch: rows=${rows.length} labels=${labels.length}`)
  }
  if (rows.length === 0) {
    throw new Error('[runOneAtATimeSensitivity] empty evaluation set')
  }

  const baselinePredicted = scorer(rows, {})
  const baselineAuc = rocAucFromArrays(baselinePredicted, labels)

  const sweepRows: SensitivityRow[] = []
  let totalEvaluations = 1
  for (const parameter of parameters) {
    const perturbations = parameter.perturbations ?? defaultPerturbations
    for (const factor of perturbations) {
      totalEvaluations += 1
      const overrides = { [parameter.name]: parameter.baselineValue * factor }
      const predicted = scorer(rows, overrides)
      const perturbedAuc = rocAucFromArrays(predicted, labels)
      const aucDelta = baselineAuc - perturbedAuc
      sweepRows.push({
        parameterName: parameter.name,
        baselineValue: parameter.baselineValue,
        baselineAuc,
        perturbedFactor: factor,
        perturbedValue: parameter.baselineValue * factor,
        perturbedAuc,
        aucDelta,
        aucDeltaMagnitude: Math.abs(aucDelta),
      })
    }
  }

  const byParam: Record<string, number> = {}
  for (const row of sweepRows) {
    const current = byParam[row.parameterName]
    if (current === undefined || row.aucDeltaMagnitude > current) {
      byParam[row.parameterName] = row.aucDeltaMagnitude
    }
  }
  const rankedByMagnitude = Object.entries(byParam)
    .map(([parameterName, maxMagnitude]) => ({ parameterName, maxMagnitude }))
    .sort((a, b) => b.maxMagnitude - a.maxMagnitude)

  return { baselineAuc, rows: sweepRows, rankedByMagnitude, totalEvaluations }
}

/**
 * Render a sensitivity-sweep result to a markdown table suitable for
 * `docs/paper-evidence/04-sensitivity-analysis.md`. Pure
 * string-building so callers can also pipe into a CLI script.
 */
export function renderSensitivityMarkdown(result: SensitivitySweepResult<unknown>, title = 'OAT sensitivity sweep'): string {
  const lines: string[] = []
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`Baseline AUC: ${result.baselineAuc.toFixed(4)}`)
  lines.push(`Total scoring evaluations: ${result.totalEvaluations}`)
  lines.push('')
  lines.push('## Per-perturbation rows')
  lines.push('')
  lines.push('| Parameter | Baseline | Factor | Perturbed | Perturbed AUC | ΔAUC vs baseline | |Δ| |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const row of result.rows) {
    lines.push(
      `| ${row.parameterName} | ${row.baselineValue} | ${row.perturbedFactor} | `
        + `${row.perturbedValue} | ${row.perturbedAuc.toFixed(4)} | `
        + `${row.aucDelta.toFixed(4)} | ${row.aucDeltaMagnitude.toFixed(4)} |`,
    )
  }
  lines.push('')
  lines.push('## Ranked by max |ΔAUC|')
  lines.push('')
  lines.push('| Rank | Parameter | max |ΔAUC| |')
  lines.push('|---:|---|---:|')
  result.rankedByMagnitude.forEach((row, index) => {
    lines.push(`| ${index + 1} | ${row.parameterName} | ${row.maxMagnitude.toFixed(4)} |`)
  })
  return lines.join('\n')
}
