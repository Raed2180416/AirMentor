import type { SplitName } from './feature-schema.js'

export const PROOF_SCENARIO_FAMILIES = [
  'balanced',
  'weak-foundation',
  'low-attendance',
  'high-forgetting',
  'coursework-inflation',
  'exam-fragility',
  'carryover-heavy',
  'intervention-resistant',
  'chronic-absentee',
  'attendance-shock',
  'mental-health-disruption',
] as const

export type ScenarioFamily = (typeof PROOF_SCENARIO_FAMILIES)[number]
// Serving-side challenger families. 'catboost' denotes a CatBoost model whose
// JSON artefact is produced by scripts/train_catboost_challenger.py and loaded
// by the Python-interop serving path (phase 10 intent). 'depth-2-tree' remains
// the in-process TS challenger baseline.
export type ChallengerModelFamily = 'depth-2-tree' | 'catboost'
export type ProofRiskTrainingVariantId = 'production-v7' | 'production-v8' | 'baseline-v5-like'

export type ProofCorpusManifestEntry = {
  seed: number
  /**
   * Index-based family-balanced split used by the production training
   * pipeline (40 / 12 / 12). Every scenario family appears in every
   * split. This is the **in-distribution** evaluation protocol.
   */
  split: SplitName
  /**
   * Family-disjoint split used by the P2 generative-process evaluation
   * protocol (`docs/paper-evidence/02-validation-protocol.md`).
   * Train families ⊥ validation families ⊥ test families.
   * This is the **out-of-distribution** evaluation protocol used to
   * defend paper claim N1 ("reproduces failure modes that generalise").
   *
   * Mapping (per roadmap §5 P2 task 2.1):
   *   train      ← weak-foundation, low-attendance, high-forgetting, coursework-inflation
   *   validation ← exam-fragility, carryover-heavy
   *   test       ← intervention-resistant, balanced
   */
  generativeSplit: SplitName
  scenarioFamily: ScenarioFamily
}

/**
 * Family-disjoint split protocol introduced in P2 (E8 closure).
 * Read by `selectGenerativeSplitEntries()` and consumed by the
 * out-of-distribution evaluator path.
 */
export const PROOF_GENERATIVE_SPLIT_FAMILIES: Record<SplitName, ReadonlyArray<ScenarioFamily>> = {
  train: ['coursework-inflation', 'high-forgetting', 'low-attendance', 'weak-foundation', 'chronic-absentee'],
  validation: ['exam-fragility', 'carryover-heavy', 'attendance-shock'],
  test: ['balanced', 'intervention-resistant', 'mental-health-disruption'],
}

/**
 * Resolve a scenario family to its position in the family-disjoint
 * generative-process split.
 */
export function generativeSplitForFamily(family: ScenarioFamily): SplitName {
  for (const split of ['train', 'validation', 'test'] as const) {
    if (PROOF_GENERATIVE_SPLIT_FAMILIES[split].includes(family)) return split
  }
  // Defensive: every PROOF_SCENARIO_FAMILIES member must be assigned to one
  // of the three splits. This branch is unreachable under the invariants
  // protected by `tests/proof-generative-split.test.ts`.
  throw new Error(
    `[generativeSplitForFamily] unassigned scenario family ${family}; `
      + `update PROOF_GENERATIVE_SPLIT_FAMILIES to keep coverage exhaustive`,
  )
}

export const PROOF_CORPUS_MANIFEST: ProofCorpusManifestEntry[] = (() => {
  const entries: ProofCorpusManifestEntry[] = []
  for (let index = 0; index < 64; index += 1) {
    const scenarioFamily = PROOF_SCENARIO_FAMILIES[index % PROOF_SCENARIO_FAMILIES.length]!
    entries.push({
      seed: 101 + (index * 101),
      split: index < 40 ? 'train' : index < 52 ? 'validation' : 'test',
      generativeSplit: generativeSplitForFamily(scenarioFamily),
      scenarioFamily,
    })
  }
  return entries
})()
