import { describe, expect, it } from 'vitest'
import {
  PROOF_CORPUS_MANIFEST,
  PROOF_GENERATIVE_SPLIT_FAMILIES,
  PROOF_SCENARIO_FAMILIES,
  generativeSplitForFamily,
  selectGenerativeSplitEntries,
  type ScenarioFamily,
  type SplitName,
} from '../src/lib/proof-risk-model.js'

// =====================================================================
// P2 task 2.1 contract — family-disjoint generative-process split.
//
// Closes roadmap §4 row E8 (distribution leak). Tests guarantee:
//   (1) Every PROOF_SCENARIO_FAMILIES member is assigned to exactly one
//       split — exhaustive and disjoint.
//   (2) `generativeSplitForFamily()` is total (never throws on a valid
//       family) and consistent with `PROOF_GENERATIVE_SPLIT_FAMILIES`.
//   (3) Every manifest entry carries a `generativeSplit` field whose
//       value is consistent with its `scenarioFamily`.
//   (4) `selectGenerativeSplitEntries()` returns the right partition,
//       and the partition sizes match the documented protocol
//       (32 / 16 / 16 for the round-robin 64-world manifest).
//   (5) The new field does NOT replace the existing index-based `split`
//       field — both coexist and serve different evaluation protocols.
//   (6) The two protocols disagree (otherwise the new field would be
//       redundant) — proves we are testing two distinct splits.
// =====================================================================

describe('PROOF_GENERATIVE_SPLIT_FAMILIES — exhaustive and disjoint', () => {
  it('every scenario family appears exactly once across the three splits', () => {
    const seen = new Map<ScenarioFamily, SplitName>()
    for (const split of ['train', 'validation', 'test'] as const) {
      for (const family of PROOF_GENERATIVE_SPLIT_FAMILIES[split]) {
        expect(seen.has(family), `${family} appears in two splits`).toBe(false)
        seen.set(family, split)
      }
    }
    for (const family of PROOF_SCENARIO_FAMILIES) {
      expect(seen.has(family), `${family} not assigned to any split`).toBe(true)
    }
    expect(seen.size).toBe(PROOF_SCENARIO_FAMILIES.length)
  })

  it('matches the documented assignment in scenario-grounding.md / roadmap §5 P2 task 2.1', () => {
    expect(PROOF_GENERATIVE_SPLIT_FAMILIES).toEqual({
      train: ['weak-foundation', 'low-attendance', 'high-forgetting', 'coursework-inflation'],
      validation: ['exam-fragility', 'carryover-heavy'],
      test: ['intervention-resistant', 'balanced'],
    })
  })
})

describe('generativeSplitForFamily — total and consistent', () => {
  it('returns the matching split for every PROOF_SCENARIO_FAMILIES member', () => {
    for (const family of PROOF_SCENARIO_FAMILIES) {
      const split = generativeSplitForFamily(family)
      expect(PROOF_GENERATIVE_SPLIT_FAMILIES[split]).toContain(family)
    }
  })
})

describe('PROOF_CORPUS_MANIFEST — generativeSplit field present and consistent', () => {
  it('every entry carries a generativeSplit that matches its scenarioFamily', () => {
    for (const entry of PROOF_CORPUS_MANIFEST) {
      expect(entry.generativeSplit).toBe(generativeSplitForFamily(entry.scenarioFamily))
    }
  })

  it('every entry still carries the original index-based split (preserves production training contract)', () => {
    for (const entry of PROOF_CORPUS_MANIFEST) {
      expect(['train', 'validation', 'test']).toContain(entry.split)
    }
  })

  it('manifest size unchanged at 64 (P2 must not perturb the in-distribution evaluator)', () => {
    expect(PROOF_CORPUS_MANIFEST).toHaveLength(64)
  })
})

describe('selectGenerativeSplitEntries — partition sizing', () => {
  it('train partition has 32 entries (4 families × 8 round-robin slots)', () => {
    expect(selectGenerativeSplitEntries('train')).toHaveLength(32)
  })

  it('validation partition has 16 entries (2 families × 8)', () => {
    expect(selectGenerativeSplitEntries('validation')).toHaveLength(16)
  })

  it('test partition has 16 entries (2 families × 8)', () => {
    expect(selectGenerativeSplitEntries('test')).toHaveLength(16)
  })

  it('partitions are disjoint and exhaustive against the manifest', () => {
    const entries = [
      ...selectGenerativeSplitEntries('train'),
      ...selectGenerativeSplitEntries('validation'),
      ...selectGenerativeSplitEntries('test'),
    ]
    const seedSet = new Set(entries.map(entry => entry.seed))
    expect(seedSet.size).toBe(entries.length) // disjoint
    expect(entries).toHaveLength(PROOF_CORPUS_MANIFEST.length) // exhaustive
  })

  it('every entry inside a partition has the matching generativeSplit', () => {
    for (const split of ['train', 'validation', 'test'] as const) {
      for (const entry of selectGenerativeSplitEntries(split)) {
        expect(entry.generativeSplit).toBe(split)
      }
    }
  })
})

describe('Two protocols are genuinely different (sanity)', () => {
  // If the two split fields agreed for every entry, the new generative
  // protocol would be cosmetic. Verify they disagree somewhere — that
  // is the *point* of the new protocol.
  it('at least one entry has split != generativeSplit', () => {
    const disagreements = PROOF_CORPUS_MANIFEST.filter(entry => entry.split !== entry.generativeSplit)
    expect(disagreements.length).toBeGreaterThan(0)
  })

  // Specifically: balanced is the deliberate null/control family. Under
  // the in-distribution split it appears across all three partitions.
  // Under generative-process it lands ONLY in test (since the protocol
  // sends balanced + intervention-resistant to test).
  it('all `balanced` entries land in the generative-process test split', () => {
    for (const entry of PROOF_CORPUS_MANIFEST) {
      if (entry.scenarioFamily === 'balanced') {
        expect(entry.generativeSplit).toBe('test')
      }
    }
  })
})

describe('Evaluator profile wire-in (D18) — generative-split-{train,val,test}', () => {
  // The evaluator script `air-mentor-api/scripts/evaluate-proof-risk-model.ts`
  // exposes `EVAL_SEED_PROFILES['generative-split-{train,val,test}']`,
  // populated from `selectGenerativeSplitEntries`. We assert the
  // population invariants here so the evaluator script's import is
  // guaranteed to resolve to non-empty seed lists.
  it('train profile resolves to 32 seeds whose family is in PROOF_GENERATIVE_SPLIT_FAMILIES.train', () => {
    const entries = selectGenerativeSplitEntries('train')
    expect(entries).toHaveLength(32)
    const trainFamilies = new Set(PROOF_GENERATIVE_SPLIT_FAMILIES.train)
    for (const entry of entries) {
      expect(trainFamilies.has(entry.scenarioFamily)).toBe(true)
    }
  })

  it('val profile resolves to 16 seeds whose family is in PROOF_GENERATIVE_SPLIT_FAMILIES.validation', () => {
    const entries = selectGenerativeSplitEntries('validation')
    expect(entries).toHaveLength(16)
    const valFamilies = new Set(PROOF_GENERATIVE_SPLIT_FAMILIES.validation)
    for (const entry of entries) {
      expect(valFamilies.has(entry.scenarioFamily)).toBe(true)
    }
  })

  it('test profile resolves to 16 seeds whose family is in PROOF_GENERATIVE_SPLIT_FAMILIES.test', () => {
    const entries = selectGenerativeSplitEntries('test')
    expect(entries).toHaveLength(16)
    const testFamilies = new Set(PROOF_GENERATIVE_SPLIT_FAMILIES.test)
    for (const entry of entries) {
      expect(testFamilies.has(entry.scenarioFamily)).toBe(true)
    }
  })

  it('train ∪ val ∪ test seed sets = full manifest seeds (no orphan, no duplication)', () => {
    const fromGenerative = [
      ...selectGenerativeSplitEntries('train'),
      ...selectGenerativeSplitEntries('validation'),
      ...selectGenerativeSplitEntries('test'),
    ].map(entry => entry.seed).sort((a, b) => a - b)
    const fromManifest = PROOF_CORPUS_MANIFEST.map(entry => entry.seed).sort((a, b) => a - b)
    expect(fromGenerative).toEqual(fromManifest)
  })
})

describe('Generative-process split closes E8 (distribution leak)', () => {
  // E8 = "train and validate on same generative process". Under the new
  // protocol no scenario family appears in both train and val/test.
  it('train families are disjoint from val ∪ test families', () => {
    const trainFamilies = new Set(PROOF_GENERATIVE_SPLIT_FAMILIES.train)
    const heldOut = [
      ...PROOF_GENERATIVE_SPLIT_FAMILIES.validation,
      ...PROOF_GENERATIVE_SPLIT_FAMILIES.test,
    ]
    for (const family of heldOut) {
      expect(trainFamilies.has(family), `${family} leaks across train/held-out boundary`).toBe(false)
    }
  })

  it('val families are disjoint from test families', () => {
    const valFamilies = new Set(PROOF_GENERATIVE_SPLIT_FAMILIES.validation)
    for (const family of PROOF_GENERATIVE_SPLIT_FAMILIES.test) {
      expect(valFamilies.has(family), `${family} leaks across val/test boundary`).toBe(false)
    }
  })
})
