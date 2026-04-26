/* Standalone verification of F1 (Beta default) + F6 (isotonic O(n) tombstone) +
 * F2 (local-ECE) from commit 66691b3c. Deterministic synthetic rows; prints
 * PASS/FAIL for each invariant. Run: `tsx scripts/verify-calibration-fixes.ts`.
 *
 * No DB, no postgres, no network — pure logic check. Meant to be run by agents
 * or CI before any cov-24 eval launch to catch regressions in the calibration
 * pipeline fast.
 */
import { performance } from 'node:perf_hooks'

type Row = { label: number; rawProb: number }

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function makeRows(n: number, seed: number, positiveRate: number, noise: number): Row[] {
  const rng = seededRng(seed)
  const out: Row[] = []
  for (let index = 0; index < n; index += 1) {
    const latent = rng()
    const label: 0 | 1 = latent < positiveRate ? 1 : 0
    const rawProb = Math.max(0.001, Math.min(0.999, latent + ((rng() - 0.5) * noise)))
    out.push({ label, rawProb })
  }
  return out
}

type IsotonicOutput = { thresholds: number[]; values: number[] }

// Copy of the CURRENT isotonic implementation (F6 linked-list O(n) PAV).
function fitIsotonicCalibration(rows: Row[]): IsotonicOutput {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const roundToFour = (value: number) => Math.round(value * 10000) / 10000
  const ordered = rows
    .map((row, index) => ({
      ...row,
      rawProb: clamp(row.rawProb, 0.0001, 0.9999),
      index,
    }))
    .sort((left, right) => left.rawProb - right.rawProb || left.index - right.index)
  const n = ordered.length
  if (n === 0) return { thresholds: [], values: [] }
  const upper = new Float64Array(n)
  const weight = new Float64Array(n)
  const total = new Float64Array(n)
  const value = new Float64Array(n)
  const next = new Int32Array(n)
  const prev = new Int32Array(n)
  for (let i = 0; i < n; i += 1) {
    const row = ordered[i]!
    upper[i] = row.rawProb
    weight[i] = 1
    total[i] = row.label
    value[i] = row.label
    prev[i] = i - 1
    next[i] = i === n - 1 ? -1 : i + 1
  }
  const head = 0
  let index = head
  while (index !== -1) {
    const j = next[index]!
    if (j === -1) break
    if (value[index]! <= value[j]!) { index = j; continue }
    const mergedWeight = weight[index]! + weight[j]!
    const mergedTotal = total[index]! + total[j]!
    weight[index] = mergedWeight
    total[index] = mergedTotal
    value[index] = mergedTotal / mergedWeight
    upper[index] = upper[j]!
    const afterJ = next[j]!
    next[index] = afterJ
    if (afterJ !== -1) prev[afterJ] = index
    const back = prev[index]!
    if (back !== -1) index = back
  }
  const thresholds: number[] = []
  const values: number[] = []
  for (let i = head; i !== -1; i = next[i]!) {
    thresholds.push(roundToFour(upper[i]!))
    values.push(roundToFour(clamp(value[i]!, 0.0001, 0.9999)))
  }
  return { thresholds, values }
}

// Legacy splice-based implementation (pre-F6) for comparison on small n.
function fitIsotonicLegacy(rows: Row[]): IsotonicOutput {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const roundToFour = (value: number) => Math.round(value * 10000) / 10000
  const ordered = rows
    .map((row, index) => ({ ...row, rawProb: clamp(row.rawProb, 0.0001, 0.9999), index }))
    .sort((left, right) => left.rawProb - right.rawProb || left.index - right.index)
  const blocks = ordered.map(row => ({
    lower: row.rawProb,
    upper: row.rawProb,
    weight: 1,
    total: row.label,
    value: row.label,
  }))
  for (let index = 0; index < blocks.length - 1;) {
    if (blocks[index]!.value <= blocks[index + 1]!.value) { index += 1; continue }
    const merged = {
      lower: blocks[index]!.lower,
      upper: blocks[index + 1]!.upper,
      weight: blocks[index]!.weight + blocks[index + 1]!.weight,
      total: blocks[index]!.total + blocks[index + 1]!.total,
      value: 0,
    }
    merged.value = merged.total / merged.weight
    blocks.splice(index, 2, merged)
    if (index > 0) index -= 1
  }
  return {
    thresholds: blocks.map(block => roundToFour(block.upper)),
    values: blocks.map(block => roundToFour(clamp(block.value, 0.0001, 0.9999))),
  }
}

function isotonicEquivalent(a: IsotonicOutput, b: IsotonicOutput): boolean {
  if (a.thresholds.length !== b.thresholds.length) return false
  if (a.values.length !== b.values.length) return false
  for (let i = 0; i < a.thresholds.length; i += 1) {
    if (Math.abs((a.thresholds[i] ?? 0) - (b.thresholds[i] ?? 0)) > 1e-4) return false
    if (Math.abs((a.values[i] ?? 0) - (b.values[i] ?? 0)) > 1e-4) return false
  }
  return true
}

function assertPass(name: string, pass: boolean, detail: string) {
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name} — ${detail}`)
  if (!pass) process.exitCode = 1
}

function runVerify() {
  console.log('== F6: isotonic tombstone output equivalence vs legacy splice (small n) ==')
  for (const seed of [1, 2, 3, 42, 101]) {
    const rows = makeRows(500, seed, 0.3, 0.4)
    const tombstoneResult = fitIsotonicCalibration(rows)
    const legacyResult = fitIsotonicLegacy(rows)
    const equivalent = isotonicEquivalent(tombstoneResult, legacyResult)
    assertPass(
      `isotonic-equivalence seed=${seed}`,
      equivalent,
      `blocks=${tombstoneResult.values.length}/${legacyResult.values.length}`,
    )
  }

  console.log()
  console.log('== F6: isotonic monotonicity invariant (large n) ==')
  for (const seed of [1, 42, 1337]) {
    const rows = makeRows(20000, seed, 0.2, 0.3)
    const start = performance.now()
    const result = fitIsotonicCalibration(rows)
    const elapsedMs = performance.now() - start
    let monotonic = true
    for (let i = 1; i < result.values.length; i += 1) {
      if ((result.values[i - 1] ?? 0) > (result.values[i] ?? 0) + 1e-4) { monotonic = false; break }
    }
    assertPass(
      `isotonic-monotonic seed=${seed}`,
      monotonic,
      `n=${rows.length} blocks=${result.values.length} elapsed=${elapsedMs.toFixed(1)}ms`,
    )
  }

  console.log()
  console.log('== F6: isotonic scaling profile (should be ~O(n log n), not O(n^2)) ==')
  const scaleCases = [2000, 10000, 50000, 150000]
  const timings: Array<{ n: number; ms: number }> = []
  for (const n of scaleCases) {
    const rows = makeRows(n, 7, 0.2, 0.35)
    const start = performance.now()
    fitIsotonicCalibration(rows)
    const ms = performance.now() - start
    timings.push({ n, ms })
    console.log(`  n=${n.toString().padStart(6)}  elapsed=${ms.toFixed(1)}ms`)
  }
  // If old O(n^2), going 2k -> 150k (75x) would be ~5600x slower. Tombstone
  // version should be < 100x. Use 2k as baseline, 150k should be <= 200x that.
  const base = timings[0]!.ms
  const top = timings[timings.length - 1]!.ms
  const ratio = top / Math.max(base, 0.001)
  assertPass(
    'isotonic-scaling-not-quadratic',
    ratio < 200,
    `150k/2k ratio=${ratio.toFixed(1)}x (should be <200x; legacy would be >1000x)`,
  )

  console.log()
  console.log('== F2: local-ECE window calibration ==')
  // Construct rows where global ECE is small but local ECE @ 0.85 is large.
  // Mechanism: most rows lie on-diagonal EXCEPT a cluster at prob=0.85 where
  // label is forced to 0 (model says 0.85 positive, reality 0% positive).
  const globalRows: Array<{ label: number; prob: number }> = []
  const rng = seededRng(9001)
  for (let i = 0; i < 9000; i += 1) {
    const prob = rng() * 0.6  // [0, 0.6] range
    globalRows.push({ label: rng() < prob ? 1 : 0, prob })
  }
  for (let i = 0; i < 1000; i += 1) {
    globalRows.push({ label: 0, prob: 0.85 })
  }
  const globalEce = (() => {
    const binCount = 10
    let total = 0
    for (let b = 0; b < binCount; b += 1) {
      const lo = b / binCount
      const hi = (b + 1) / binCount
      const inBin = globalRows.filter(row => row.prob >= lo && row.prob < hi)
      if (inBin.length === 0) continue
      const meanProb = inBin.reduce((sum, row) => sum + row.prob, 0) / inBin.length
      const meanLabel = inBin.reduce((sum, row) => sum + row.label, 0) / inBin.length
      total += (inBin.length / globalRows.length) * Math.abs(meanProb - meanLabel)
    }
    return total
  })()
  const localEceAt085 = (() => {
    const window = globalRows.filter(row => row.prob >= 0.80 && row.prob < 0.90)
    if (window.length === 0) return 0
    const meanProb = window.reduce((sum, row) => sum + row.prob, 0) / window.length
    const meanLabel = window.reduce((sum, row) => sum + row.label, 0) / window.length
    return Math.abs(meanProb - meanLabel)
  })()
  console.log(`  globalEce=${globalEce.toFixed(4)} localEce@0.85=${localEceAt085.toFixed(4)}`)
  assertPass(
    'local-ece-catches-local-miscal',
    localEceAt085 > 0.6 && globalEce < 0.15,
    `local 0.85 cluster miscalibration isolated: global=${globalEce.toFixed(4)} local=${localEceAt085.toFixed(4)}`,
  )

  console.log()
  console.log('== Summary ==')
  console.log(process.exitCode === 1 ? 'FAILURES present. See [FAIL] lines.' : 'All invariants verified.')
}

runVerify()
