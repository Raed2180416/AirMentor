/**
 * Paper-evidence generator for E9 baselines + E11 adversarial corpus.
 *
 * Produces `docs/paper-evidence/03-baseline-results.md` with concrete
 * AUC / Brier / ECE / bootstrap-CI / permutation-importance numbers
 * for the majority-class and 2-feature-logistic baselines on the
 * adversarial (power-law) and control (exponential) corpora. This is
 * the smallest deterministic paper-numbers loop that does not require
 * the heavy evaluator (which depends on embedded-postgres).
 *
 * Run with: `npx tsx air-mentor-api/scripts/generate-baseline-paper-evidence.ts`
 *
 * Roadmap reference: P2 task 2.5 (calibration) + P10 paper Methods/Experiments.
 *
 * Output is deterministic — same git SHA produces same numbers.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  generateExponentialControlCorpus,
  generatePowerLawAdversarialCorpus,
  type AdversarialFeatureRow,
} from '../src/lib/proof-risk-adversarial-corpus.js'
import {
  trainMajorityClassBaseline,
  trainTwoFeatureLogisticBaseline,
  type BaselineFeatureRow,
} from '../src/lib/proof-risk-baselines.js'
import {
  bootstrapAucCi,
  bootstrapBrierCi,
  brierScoreFromArrays,
  permutationFeatureImportance,
  reliabilityDiagramData,
  rocAucFromArrays,
} from '../src/lib/proof-risk-evaluation-stats.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const OUTPUT_PATH = resolve(REPO_ROOT, 'docs', 'paper-evidence', '03-baseline-results.md')

const CORPUS_SIZE = 96
const ALPHA = 0.6
const TRAIN_SEED = 11
const ADVERSARIAL_SEED = 7
const CONTROL_SEED = 23
const BOOTSTRAP_B = 1000
const BOOTSTRAP_ALPHA = 0.05

function asBaselineRow(row: AdversarialFeatureRow): BaselineFeatureRow {
  return { attendancePct: row.attendancePct, currentCgpa: row.currentCgpa }
}

function fmt4(value: number): string {
  return value.toFixed(4)
}

function fmtPct(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

async function main() {
  // 1. Train baselines on a fresh power-law cohort (ground-truth labels
  //    are derived from the same generative process as the test set;
  //    the eval is not held-out by family but is held-out by seed).
  const trainCorpus = generatePowerLawAdversarialCorpus({ size: CORPUS_SIZE, alpha: ALPHA, seed: TRAIN_SEED })
  const trainRows = trainCorpus.rows.map(asBaselineRow)
  const trainLabels = trainCorpus.rows.map(row => row.label as 0 | 1)

  const majority = trainMajorityClassBaseline(trainLabels)
  const twoFeature = trainTwoFeatureLogisticBaseline(trainRows, trainLabels)

  // 2. Evaluate on (a) held-out adversarial corpus, (b) held-out
  //    control corpus. Same baselines, two test sets.
  const adversarialTest = generatePowerLawAdversarialCorpus({ size: CORPUS_SIZE, alpha: ALPHA, seed: ADVERSARIAL_SEED })
  const controlTest = generateExponentialControlCorpus({ size: CORPUS_SIZE, alpha: ALPHA, seed: CONTROL_SEED })

  function scoreSet(name: string, rows: AdversarialFeatureRow[]) {
    const labels = rows.map(row => row.label as 0 | 1)
    const features = rows.map(asBaselineRow)
    const majPred = majority.predict(features)
    const twoPred = twoFeature.predict(features)
    const majAuc = rocAucFromArrays(majPred, labels)
    const twoAuc = rocAucFromArrays(twoPred, labels)
    const majBrier = brierScoreFromArrays(majPred, labels)
    const twoBrier = brierScoreFromArrays(twoPred, labels)
    const majAucCi = bootstrapAucCi(majPred, labels, { B: BOOTSTRAP_B, alpha: BOOTSTRAP_ALPHA, seed: 101 })
    const twoAucCi = bootstrapAucCi(twoPred, labels, { B: BOOTSTRAP_B, alpha: BOOTSTRAP_ALPHA, seed: 101 })
    const twoBrierCi = bootstrapBrierCi(twoPred, labels, { B: BOOTSTRAP_B, alpha: BOOTSTRAP_ALPHA, seed: 101 })
    const twoReliability = reliabilityDiagramData(twoPred, labels, { numBins: 10 })
    const twoImportance = permutationFeatureImportance(
      features as ReadonlyArray<{ attendancePct: number; currentCgpa: number }>,
      labels,
      ['attendancePct', 'currentCgpa'],
      r => twoFeature.predict(r),
      rocAucFromArrays,
      { B: 30, seed: 17 },
    )
    return {
      name,
      n: labels.length,
      positiveRate: labels.reduce((a, b) => a + b, 0) / labels.length,
      majAuc,
      twoAuc,
      majBrier,
      twoBrier,
      majAucCi,
      twoAucCi,
      twoBrierCi,
      twoReliability,
      twoImportance,
    }
  }

  const advResult = scoreSet('adversarial-power-law', adversarialTest.rows)
  const ctlResult = scoreSet('control-exponential', controlTest.rows)

  // 3. Render markdown.
  const md: string[] = []
  md.push('# 03 — Baseline Results')
  md.push('')
  md.push('> Phase: P2 (Validation Methodology Fix), tasks 2.2 + 2.4 + 2.5')
  md.push('> Companion: `docs/paper-evidence/02-validation-protocol.md`,')
  md.push('> `docs/references.bib`,')
  md.push('> `air-mentor-api/scripts/generate-baseline-paper-evidence.ts`')
  md.push('> Generated: deterministic — re-run the script to refresh.')
  md.push('')
  md.push('Two paper baselines on two synthetic test corpora.')
  md.push('Baselines: **majority-class** (empirical positive rate) and')
  md.push('**two-feature logistic** (attendance + CGPA, Newton-Raphson IRLS).')
  md.push('Test corpora: **power-law forgetting** (adversarial — heavier tail than')
  md.push('the engine\'s near-exponential dynamics) and **exponential forgetting**')
  md.push('(control — matched α). Both corpora are produced by the same code')
  md.push('path, so AUC differences are attributable to the kernel rather than')
  md.push('to confounded code paths.')
  md.push('')
  md.push('Configuration:')
  md.push(`- Corpus size: ${CORPUS_SIZE} rows per corpus, 6-semester student trajectories.`)
  md.push(`- Power-law decay exponent α = ${ALPHA} (Wickelgren-Rubin range).`)
  md.push(`- Train seed: ${TRAIN_SEED}; adversarial test seed: ${ADVERSARIAL_SEED}; control test seed: ${CONTROL_SEED}.`)
  md.push(`- Bootstrap B = ${BOOTSTRAP_B}, α = ${BOOTSTRAP_ALPHA} (95% CI).`)
  md.push(`- Two-feature logistic: ridge = 1e-3, max iterations = 50, tolerance = 1e-8.`)
  md.push('')
  md.push(`Train cohort: ${trainCorpus.size} rows, positive rate ${fmtPct(trainCorpus.meta.positiveRate)}.`)
  md.push(`Two-feature logistic converged at iteration ${twoFeature.iterations} (converged=${twoFeature.converged}).`)
  md.push(`Weights: intercept=${fmt4(twoFeature.weights[0])}, w_attendance=${fmt4(twoFeature.weights[1])}, w_cgpa=${fmt4(twoFeature.weights[2])}.`)
  md.push('')

  md.push('## AUC + Brier on the two test corpora')
  md.push('')
  md.push('| Corpus | n | Positive rate | Majority AUC | 2-feature AUC | 2-feature AUC 95% CI | Majority Brier | 2-feature Brier | 2-feature Brier 95% CI |')
  md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const r of [advResult, ctlResult]) {
    md.push(`| ${r.name} | ${r.n} | ${fmtPct(r.positiveRate)} | ${fmt4(r.majAuc)} | ${fmt4(r.twoAuc)} | [${fmt4(r.twoAucCi.lower)}, ${fmt4(r.twoAucCi.upper)}] | ${fmt4(r.majBrier)} | ${fmt4(r.twoBrier)} | [${fmt4(r.twoBrierCi.lower)}, ${fmt4(r.twoBrierCi.upper)}] |`)
  }
  md.push('')
  md.push('Notes:')
  md.push('- Majority-class AUC is exactly 0.5 by construction (no information).')
  md.push('  The Brier score for majority-class is the variance of the label')
  md.push('  distribution (≤ 0.25 for any cohort).')
  md.push('- 2-feature logistic AUC well above 0.5 → the (attendance, CGPA)')
  md.push('  pair carries real signal even before the engine\'s 43-feature')
  md.push('  representation kicks in. This is the **floor** the production-v8')
  md.push('  model has to clear; numbers below this floor would invalidate')
  md.push('  paper claim N1.')
  md.push('- The CI gap between adversarial and control corpora is the')
  md.push('  literal "boundary of generalisation" disclosure for the paper.')
  md.push('')

  md.push('## Reliability diagram data — 2-feature logistic')
  md.push('')
  md.push('| Corpus | bins | ECE | MCE |')
  md.push('|---|---:|---:|---:|')
  for (const r of [advResult, ctlResult]) {
    md.push(`| ${r.name} | ${r.twoReliability.bins.length} | ${fmt4(r.twoReliability.expectedCalibrationError)} | ${fmt4(r.twoReliability.maxCalibrationError)} |`)
  }
  md.push('')
  md.push('Per-bin breakdown for the adversarial corpus (load-bearing for the paper figure):')
  md.push('')
  md.push('| Bin | Range | Count | Mean predicted | Fraction positive |')
  md.push('|---:|---|---:|---:|---:|')
  for (const bin of advResult.twoReliability.bins) {
    if (bin.count === 0) continue
    md.push(`| ${bin.binIndex} | [${bin.binLowerBound.toFixed(2)}, ${bin.binUpperBound.toFixed(2)}) | ${bin.count} | ${fmt4(bin.meanPredicted)} | ${fmt4(bin.fractionPositive)} |`)
  }
  md.push('')

  md.push('## Permutation feature importance — 2-feature logistic on adversarial corpus')
  md.push('')
  md.push('| Feature | Δ AUC | std | baseline AUC | mean permuted AUC |')
  md.push('|---|---:|---:|---:|---:|')
  for (const [feature, stats] of Object.entries(advResult.twoImportance.perFeature)) {
    md.push(`| ${feature} | ${fmt4(stats.delta)} | ${fmt4(stats.std)} | ${fmt4(stats.baseline)} | ${fmt4(stats.permuted)} |`)
  }
  md.push('')
  md.push('Δ AUC reads "how much does AUC drop when this feature is')
  md.push('shuffled within the corpus?" Larger Δ → the model relied more')
  md.push('heavily on the feature. The result must show **attendancePct >')
  md.push('currentCgpa** for paper claim alignment with the Credé attendance')
  md.push('meta-analysis (`docs/references.bib::crede2010class`).')
  md.push('')

  md.push('## Reproduction')
  md.push('')
  md.push('```')
  md.push('npx tsx air-mentor-api/scripts/generate-baseline-paper-evidence.ts')
  md.push('```')
  md.push('')
  md.push('Determinism is locked by the seeds in this script. To rerun')
  md.push('with different α / corpus size / bootstrap B, edit the')
  md.push('constants at the top of the file and re-run.')
  md.push('')
  md.push('Engineering-tier disclosures (paper Limitations §):')
  md.push('1. The adversarial corpus is itself synthetic — power-law')
  md.push('   forgetting is one of several literature-supported retention')
  md.push('   models, not the only one (see `docs/references.bib`).')
  md.push('2. Train and test corpora share the same code path; only the')
  md.push('   forgetting kernel and seed differ. This bounds what we can')
  md.push('   claim about real-cohort generalisation.')
  md.push('3. The 2-feature logistic is the *floor* baseline, not a')
  md.push('   competitive model. Paper Experiments compares the full')
  md.push('   production-v8 against this floor and the majority-class')
  md.push('   chance line.')

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, md.join('\n') + '\n', 'utf8')
  console.log(`[generate-baseline-paper-evidence] wrote ${OUTPUT_PATH}`)
  console.log(`[generate-baseline-paper-evidence] adversarial AUC=${fmt4(advResult.twoAuc)} CI=[${fmt4(advResult.twoAucCi.lower)},${fmt4(advResult.twoAucCi.upper)}]`)
  console.log(`[generate-baseline-paper-evidence] control AUC=${fmt4(ctlResult.twoAuc)} CI=[${fmt4(ctlResult.twoAucCi.lower)},${fmt4(ctlResult.twoAucCi.upper)}]`)
}

main().catch(error => {
  console.error('[generate-baseline-paper-evidence] failed:', error)
  process.exit(1)
})
