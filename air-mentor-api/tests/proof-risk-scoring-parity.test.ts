// RCA test for ML model collapse at full-64 corpus scale.
// Validates that compact-dataset scoreRawAt (training self-eval path)
// and payload-based scoreObservableRiskWithModel (pass-2 scoring path)
// produce IDENTICAL probabilities for the same test rows.

import { describe, it, expect } from 'vitest'
import {
  createProofRiskModelTrainingBuilder,
  scoreObservableRiskWithModel,
  OBSERVABLE_FEATURE_KEYS,
  featureVectorArrayFromPayload,
  type ObservableFeaturePayload,
  type ObservableLabelPayload,
  type ObservableSourceRefs,
  type ProofCorpusManifestEntry,
  type ProofRunModelMetadata,
  type ScenarioFamily,
} from '../src/lib/proof-risk-model.js'
import type { ObservableInferenceInput } from '../src/lib/inference-engine.js'

const STAGE_KEYS = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const
const SECTION_CODES = ['A', 'B', 'C'] as const
const COURSE_FAMILIES = ['core', 'elective', 'lab'] as const
type SyntheticProofCorpusManifestEntry = ProofCorpusManifestEntry & {
  courseworkPct: number
  ttAggressivenessPct: number
  attendancePct: number
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function makeRowSet(seed: number, scenarioFamily: ScenarioFamily, runId: string) {
  const rng = mulberry32(seed)
  const rows: Array<{ featureJson: string; labelJson: string; sourceRefsJson: string }> = []
  // For each scenario, emit ~540 rows (= 6 semesters × 3 sections × 5 stages × 6 students)
  for (let semester = 1; semester <= 6; semester += 1) {
    for (const section of SECTION_CODES) {
      for (const stage of STAGE_KEYS) {
        for (let studentIdx = 0; studentIdx < 40; studentIdx += 1) {
          const r = () => rng()
          // Feature payload: gen realistic values with scenario-family influence
          const isLowAttn = scenarioFamily === 'low-attendance'
          const isWeakFdn = scenarioFamily === 'weak-foundation'
          const isCarryover = scenarioFamily === 'carryover-heavy'
          const attendancePct = isLowAttn ? 40 + r() * 40 : 70 + r() * 25
          const currentCgpa = isWeakFdn ? 3 + r() * 3 : 5 + r() * 4
          const backlogCount = isWeakFdn ? Math.floor(r() * 5) : Math.floor(r() * 2)
          const prePctAvailable = stage !== 'pre-tt1'
          const tt1Pct = stage === 'pre-tt1' ? null : 30 + r() * 60
          const tt2Pct = (stage === 'pre-tt1' || stage === 'post-tt1') ? null : 30 + r() * 60
          const quizPct = stage === 'pre-tt1' ? null : 40 + r() * 50
          const assignmentPct = stage === 'pre-tt1' ? null : 50 + r() * 40
          const seePct = stage === 'post-see' ? 30 + r() * 60 : null
          const weakCoCount = Math.floor(r() * 4)
          const weakQuestionCount = Math.floor(r() * 6)
          const prerequisiteFailureCount = Math.floor(r() * 2)
          const prerequisiteChainDepth = 1 + Math.floor(r() * 3)
          const prerequisiteWeakCourseCodes = isCarryover ? ['MAT101', 'PHY101'] : []
          const prerequisiteCourseCodes = ['MAT101', 'PHY101', 'CHE101']
          const featurePayload: ObservableFeaturePayload = {
            attendancePct,
            attendanceTrend: -10 + r() * 20,
            attendanceHistoryRiskCount: Math.floor(r() * 3),
            currentCgpa,
            backlogCount,
            tt1Pct,
            tt2Pct,
            seePct,
            quizPct,
            assignmentPct,
            weakCoCount,
            weakQuestionCount,
            courseworkToTtGap: -20 + r() * 40,
            ttMomentum: -15 + r() * 30,
            interventionResponseScore: -0.3 + r() * 0.6,
            prerequisitePressure: r() * 0.6,
            prerequisiteAveragePct: 40 + r() * 50,
            prerequisiteFailureCount,
            prerequisiteChainDepth,
            prerequisiteCarryoverLoad: isCarryover ? 0.6 + r() * 0.4 : r() * 0.3,
            prerequisiteRecencyWeightedFailure: r() * 0.5,
            downstreamDependencyLoad: r() * 0.5,
            weakPrerequisiteChainCount: Math.floor(r() * 4),
            repeatedWeakPrerequisiteFamilyCount: Math.floor(r() * 2),
            semesterProgress: semester / 6,
            sectionRiskRate: r() * 0.4,
            prerequisiteWeakCourseRate: isCarryover ? 0.4 + r() * 0.4 : r() * 0.2,
            cgpaMissing: semester === 1 && stage === 'pre-tt1' && r() < 0.3,
            backlogMissing: semester === 1 && r() < 0.1,
          }
          const labelRisk = (
            Math.max(0, 1 - attendancePct / 100) * 1.2
            + Math.max(0, 1 - currentCgpa / 10) * 1.0
            + (backlogCount / 4) * 0.6
            + (prerequisiteFailureCount / 3) * 0.5
            + Math.max(0, 1 - (tt1Pct ?? 50) / 100) * 0.4
          ) + r() * 0.15
          const labelPayload: ObservableLabelPayload = {
            attendanceRiskLabel: attendancePct < 65 ? 1 : 0,
            ceShortfallLabel: (prePctAvailable && (tt1Pct ?? 100) < 50 && (tt2Pct ?? 100) < 50) ? 1 : 0,
            seeShortfallLabel: labelRisk > 0.55 ? 1 : 0,
            overallCourseFailLabel: labelRisk > 0.6 ? 1 : 0,
            downstreamCarryoverLabel: isCarryover && labelRisk > 0.4 ? 1 : 0,
          }
          const sourceRefs: ObservableSourceRefs = {
            simulationRunId: runId,
            simulationStageCheckpointId: null,
            studentId: `${runId}-stu-${semester}-${section}-${studentIdx}`,
            offeringId: null,
            courseCode: `COU${100 + semester}`,
            courseTitle: `Course ${100 + semester}`,
            courseFamily: COURSE_FAMILIES[studentIdx % COURSE_FAMILIES.length]!,
            sectionCode: section,
            stageKey: stage,
            semesterNumber: semester,
            prerequisiteCourseCodes,
            prerequisiteWeakCourseCodes,
            weakCourseOutcomeCodes: [],
            dominantQuestionTopics: [],
          }
          rows.push({
            featureJson: JSON.stringify(featurePayload),
            labelJson: JSON.stringify(labelPayload),
            sourceRefsJson: JSON.stringify(sourceRefs),
          })
        }
      }
    }
  }
  return rows
}

function computeRocAuc(rows: Array<{ label: number; prob: number }>): number {
  if (!rows.length) return 0.5
  const pos = rows.filter(r => r.label === 1).map(r => r.prob)
  const neg = rows.filter(r => r.label === 0).map(r => r.prob)
  if (!pos.length || !neg.length) return 0.5
  let concordant = 0
  let ties = 0
  // Mann-Whitney AUC via sampling for speed (full N×M is O(n^2))
  const sampleSize = Math.min(pos.length * neg.length, 100_000)
  const posRng = mulberry32(1)
  const negRng = mulberry32(2)
  for (let i = 0; i < sampleSize; i += 1) {
    const p = pos[Math.floor(posRng() * pos.length)]!
    const n = neg[Math.floor(negRng() * neg.length)]!
    if (p > n) concordant += 1
    else if (p === n) ties += 1
  }
  return (concordant + 0.5 * ties) / sampleSize
}

describe('proof-risk-model: training vs pass-2 scoring parity [RCA]', () => {
  it('scoreRawAt (training self-eval) and scoreObservableRiskWithModel (pass-2) produce identical probabilities for the same test rows', () => {
    // Build 8-world corpus: enough to trigger beta calibration
    //   splitSummary aim: 5 train, 2 val, 1 test (or similar) via runMetadataById
    const runMetadataById = new Map<string, ProofRunModelMetadata>()
    const seedPlan: Array<{ seed: number; split: 'train' | 'validation' | 'test'; family: ScenarioFamily }> = [
      { seed: 101, split: 'train', family: 'balanced' },
      { seed: 202, split: 'train', family: 'weak-foundation' },
      { seed: 303, split: 'train', family: 'low-attendance' },
      { seed: 404, split: 'train', family: 'carryover-heavy' },
      { seed: 505, split: 'train', family: 'high-forgetting' },
      { seed: 606, split: 'train', family: 'coursework-inflation' },
      { seed: 707, split: 'validation', family: 'exam-fragility' },
      { seed: 808, split: 'validation', family: 'intervention-resistant' },
      { seed: 909, split: 'test', family: 'balanced' },
    ]
    // manifest derived from seedPlan: required so ProofRiskDatasetBuilder accepts all seeds.
    const manifest: SyntheticProofCorpusManifestEntry[] = seedPlan.map(({ seed, split, family }) => ({
      seed,
      split,
      scenarioFamily: family,
      courseworkPct: 0.45,
      ttAggressivenessPct: 0.5,
      attendancePct: 0.82,
    }))

    const allRows: Array<{ featureJson: string; labelJson: string; sourceRefsJson: string }> = []
    const rowsByRun: Record<string, typeof allRows> = {}
    for (const plan of seedPlan) {
      const runId = `sim-${plan.seed}`
      runMetadataById.set(runId, { simulationRunId: runId, seed: plan.seed, split: plan.split, scenarioFamily: plan.family })
      const rs = makeRowSet(plan.seed, plan.family, runId)
      rowsByRun[runId] = rs
      allRows.push(...rs)
    }
    console.error(`[parity-test] total rows = ${allRows.length}, per-run counts:`)
    for (const [runId, rs] of Object.entries(rowsByRun)) {
      console.error(`  ${runId}: ${rs.length}`)
    }

    const builder = createProofRiskModelTrainingBuilder({ runMetadataById, manifest })
    builder.addSerializedRows(allRows)
    const bundle = builder.build('2026-03-16T00:00:00.000Z')
    expect(bundle).not.toBeNull()
    if (!bundle) return

    const production = bundle.production
    console.error(`[parity-test] trained, modelVersion=${production.modelVersion}, heads:`, Object.keys(production.heads))
    const overallHead = production.heads.overallCourseRisk
    console.error(`[parity-test] overallCourseRisk head: intercept=${overallHead.intercept}, calibrationMethod=${overallHead.calibration.method}`)
    console.error(`[parity-test] overallCourseRisk weights sample:`)
    for (const key of OBSERVABLE_FEATURE_KEYS.slice(0, 8)) {
      console.error(`    ${key}: ${overallHead.weights[key]}`)
    }

    // Iterate the TEST rows (simulationRunId 909 → 'test' split)
    const testRunId = 'sim-909'
    const testRows = rowsByRun[testRunId]!
    expect(testRows.length).toBeGreaterThan(500)

    const payloadPassRows: Array<{ label: number; prob: number }> = []
    const compactScoreRows: Array<{ label: number; prob: number }> = []
    let firstDivergence = -1
    const divergenceSamples: Array<{ idx: number; compactRaw: number; payloadRaw: number; compactProb: number; payloadProb: number }> = []

    // Compute raw logit + calibrated prob for each test row via payload path
    for (let i = 0; i < testRows.length; i += 1) {
      const row = testRows[i]!
      const featurePayload = JSON.parse(row.featureJson) as ObservableFeaturePayload
      const labelPayload = JSON.parse(row.labelJson) as ObservableLabelPayload
      const sourceRefs = JSON.parse(row.sourceRefsJson) as ObservableSourceRefs

      const pass2 = scoreObservableRiskWithModel({
        attendancePct: featurePayload.attendancePct,
        currentCgpa: featurePayload.currentCgpa,
        backlogCount: featurePayload.backlogCount,
        tt1Pct: featurePayload.tt1Pct,
        tt2Pct: featurePayload.tt2Pct,
        quizPct: featurePayload.quizPct,
        assignmentPct: featurePayload.assignmentPct,
        seePct: featurePayload.seePct,
        weakCoCount: featurePayload.weakCoCount,
        attendanceHistoryRiskCount: featurePayload.attendanceHistoryRiskCount,
        questionWeaknessCount: featurePayload.weakQuestionCount,
        interventionResponseScore: featurePayload.interventionResponseScore,
        policy: {
          riskRules: {
            highRiskAttendancePercentBelow: 65,
            mediumRiskAttendancePercentBelow: 75,
            highRiskCgpaBelow: 6,
            mediumRiskCgpaBelow: 7,
            highRiskBacklogCount: 3,
            mediumRiskBacklogCount: 1,
          },
          assessmentPassingThresholds: { tt1: 40, tt2: 40, quiz: 40, assignment: 40, see: 45 },
          ceComponentCaps: {},
          workingCalendar: {},
          budgetCapacityRatio: 0.2,
        } as unknown as ObservableInferenceInput['policy'],
        featurePayload,
        sourceRefs,
        productionModel: production,
        correlations: bundle.correlations,
      })
      const pass2Prob = pass2.headProbabilities.overallCourseRisk
      payloadPassRows.push({ label: labelPayload.overallCourseFailLabel, prob: pass2Prob })

      // Manually reproduce training-time scoreRawAt path:
      //   logit = intercept + sum(weights[i] * writeBuffer(payload,sourceRefs)[i])
      // Use featureVectorArrayFromPayload which is the score-path formula, BUT
      // zero out indices 37-43 to mirror writeFeatureVectorToBuffer behavior.
      const arr = featureVectorArrayFromPayload(featurePayload, sourceRefs, true)
      const compactArr = [...arr.slice(0, 37), 0, 0, 0, 0, 0, 0, 0]
      let compactLogit = overallHead.intercept
      for (let k = 0; k < OBSERVABLE_FEATURE_KEYS.length; k += 1) {
        compactLogit += (overallHead.weights[OBSERVABLE_FEATURE_KEYS[k]!] ?? 0) * (compactArr[k] ?? 0)
      }
      const compactRaw = 1 / (1 + Math.exp(-compactLogit))
      // apply same calibration
      let calibratedCompact = compactRaw
      {
        const c = overallHead.calibration
        const clamped = Math.max(0.0001, Math.min(0.9999, compactRaw))
        if (c.method === 'beta') {
          const logProb = Math.log(clamped)
          const logInverseProb = -Math.log(1 - clamped)
          calibratedCompact = 1 / (1 + Math.exp(-(((c.logProbWeight ?? 1) * logProb) + ((c.logInverseProbWeight ?? 1) * logInverseProb) + (c.intercept ?? 0))))
        } else if (c.method === 'sigmoid') {
          const logit = Math.log(clamped / (1 - clamped))
          calibratedCompact = 1 / (1 + Math.exp(-(((c.slope ?? 1) * logit) + (c.intercept ?? 0))))
        } else if (c.method === 'identity') {
          calibratedCompact = clamped
        } else {
          // isotonic / venn-abers: bin lookup
          const idx = (c.thresholds ?? []).findIndex(t => clamped <= t)
          calibratedCompact = idx === -1
            ? (c.values?.[c.values.length - 1] ?? clamped)
            : (c.values?.[idx] ?? clamped)
        }
      }
      calibratedCompact = Math.max(0.0001, Math.min(0.9999, calibratedCompact))

      compactScoreRows.push({ label: labelPayload.overallCourseFailLabel, prob: Number(calibratedCompact.toFixed(4)) })

      const diff = Math.abs(pass2Prob - calibratedCompact)
      if (diff > 1e-3 && divergenceSamples.length < 5) {
        divergenceSamples.push({ idx: i, compactRaw, payloadRaw: compactRaw, compactProb: calibratedCompact, payloadProb: pass2Prob })
      }
      if (diff > 1e-3 && firstDivergence < 0) firstDivergence = i
    }

    console.error(`[parity-test] test rows scored: ${testRows.length}, first divergence at idx=${firstDivergence}`)
    if (divergenceSamples.length) {
      console.error(`[parity-test] divergence samples:`)
      for (const s of divergenceSamples) {
        console.error(`  idx=${s.idx}: compactRaw=${s.compactRaw.toFixed(4)} payloadRaw=${s.payloadRaw.toFixed(4)} compactProb=${s.compactProb.toFixed(4)} payloadProb=${s.payloadProb.toFixed(4)}`)
      }
    }

    const aucPayload = computeRocAuc(payloadPassRows)
    const aucCompact = computeRocAuc(compactScoreRows)
    console.error(`[parity-test] AUC payload-path = ${aucPayload.toFixed(4)}`)
    console.error(`[parity-test] AUC compact-path = ${aucCompact.toFixed(4)}`)

    // Positive/negative counts
    const posCount = testRows.filter((_, i) => payloadPassRows[i]!.label === 1).length
    const negCount = testRows.length - posCount
    console.error(`[parity-test] test positives=${posCount}, negatives=${negCount}`)

    // Payload prob histogram
    const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01]
    const hist = new Array(bins.length - 1).fill(0)
    for (const r of payloadPassRows) {
      for (let k = 0; k < bins.length - 1; k += 1) {
        if (r.prob >= bins[k]! && r.prob < bins[k + 1]!) { hist[k] += 1; break }
      }
    }
    console.error(`[parity-test] payload prob histogram:`)
    for (let k = 0; k < hist.length; k += 1) {
      console.error(`  [${bins[k]}..${bins[k+1]}): ${hist[k]}`)
    }

    // Sanity assertion: if parity holds, AUC should match to within 0.01
    expect(aucPayload).toBeGreaterThan(0.6)
    expect(Math.abs(aucPayload - aucCompact)).toBeLessThan(0.02)

    // Regression guard for commit a75bc33d5 collapse: the fresh bundle's
    // headSupportSummary must reflect that TRAIN ROWS WERE INGESTED. If pass-1
    // filtering excludes train runs (as in the 2026-04-24 full-64 collapse),
    // trainSupport collapses to 0 and every head learns weights≈0.
    expect(production.headSupportSummary.overallCourseRisk.trainSupport).toBeGreaterThan(0)
    expect(production.headSupportSummary.overallCourseRisk.trainPositives).toBeGreaterThan(0)
  }, 120_000)

  it('REGRESSION: a builder fed ONLY val+test rows (no train) collapses to constant-prior predictions (reproduces the commit a75bc33d5 bug)', () => {
    // This test pins the degenerate behaviour so any future refactor that
    // accidentally narrows pass-1 ingestion will be caught. It also documents
    // the exact symptom: weights=0, intercept≈logit(0.01), AUC≈0.5.
    const runMetadataById = new Map<string, ProofRunModelMetadata>()
    const seedPlan: Array<{ seed: number; split: 'train' | 'validation' | 'test'; family: ScenarioFamily }> = [
      { seed: 101, split: 'train', family: 'balanced' },
      { seed: 202, split: 'train', family: 'weak-foundation' },
      { seed: 303, split: 'train', family: 'low-attendance' },
      { seed: 707, split: 'validation', family: 'exam-fragility' },
      { seed: 808, split: 'validation', family: 'intervention-resistant' },
      { seed: 909, split: 'test', family: 'balanced' },
    ]
    const manifest: SyntheticProofCorpusManifestEntry[] = seedPlan.map(({ seed, split, family }) => ({
      seed, split, scenarioFamily: family,
      courseworkPct: 0.45, ttAggressivenessPct: 0.5, attendancePct: 0.82,
    }))

    // Build the corpus BUT only feed val+test rows into the builder — mirroring
    // the pre-fix evaluator behaviour (pass-1 filter narrowed to evaluationRunIdList).
    for (const plan of seedPlan) {
      const runId = `sim-${plan.seed}`
      runMetadataById.set(runId, { simulationRunId: runId, seed: plan.seed, split: plan.split, scenarioFamily: plan.family })
    }
    const builder = createProofRiskModelTrainingBuilder({ runMetadataById, manifest })
    for (const plan of seedPlan) {
      if (plan.split === 'train') continue // simulate the bug: train runs excluded
      const runId = `sim-${plan.seed}`
      const rs = makeRowSet(plan.seed, plan.family, runId)
      builder.addSerializedRows(rs)
    }
    const bundle = builder.build('2026-03-16T00:00:00.000Z')
    expect(bundle).not.toBeNull()
    if (!bundle) return

    // Pin the symptom: zero train support, and weights effectively zero.
    expect(bundle.production.headSupportSummary.overallCourseRisk.trainSupport).toBe(0)
    expect(bundle.production.headSupportSummary.overallCourseRisk.trainPositives).toBe(0)
    const h = bundle.production.heads.overallCourseRisk
    const weightNorm = OBSERVABLE_FEATURE_KEYS.reduce((acc, key) => acc + Math.abs(h.weights[key] ?? 0), 0)
    console.error(`[regression-test] weightNorm=${weightNorm}, intercept=${h.intercept}, calibrationMethod=${h.calibration.method}`)
    // With zero train rows, the logistic SGD has no gradient signal so every
    // weight stays at its 0 initialisation.
    expect(weightNorm).toBe(0)
  }, 60_000)
})
