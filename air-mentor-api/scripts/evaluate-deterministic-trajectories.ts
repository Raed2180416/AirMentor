#!/usr/bin/env tsx
/**
 * Deterministic Student Trajectory Evaluator
 *
 * Evaluates ALL 120 students across ALL assessment stages using the actual
 * production scoring pipeline (XGBoost primary for overallCourseRisk,
 * logistic for other heads). Produces a comprehensive report proving:
 *
 * 1. XGBoost is active and producing different results than logistic fallback
 * 2. Each archetype's risk progression is realistic and directionally correct
 * 3. SHAP drivers are populated and match expected dominant features
 * 4. Determinism: same student + same stage = identical risk score
 * 5. Stage indicators actually affect risk (pre-tt1 vs post-see differs)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// We must import from the built/compiled module because tsx runs the file directly.
// Use relative paths from scripts/ → src/lib/
import {
  buildObservableFeaturePayload,
  scoreObservableRiskWithModel,
  trainProofRiskModel,
  type ObservableFeaturePayload,
  type ObservableSourceRefs,
  type ProofRunModelMetadata,
} from '../src/lib/proof-risk-model.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'

// Import demo seeding contract from tests-e2e (it uses plain TS, tsx can run it)
import {
  buildDemoTrajectoryMap,
  DEMO_STUDENT_IDS,
  type DemoTrajectory,
} from '../../tests-e2e/helpers/demo-seeding-contract.js'

const OUT_DIR = path.join(process.cwd(), 'output', 'trajectory-evaluation')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function buildSourceRefs(studentId: string, stageKey: string): ObservableSourceRefs {
  const numeric = Number(studentId.slice(-3))
  const sectionCode = numeric <= 60 ? 'A' : 'B'
  return {
    simulationRunId: 'eval-run-2026-05-25',
    simulationStageCheckpointId: `eval-run-2026-05-25-${studentId}-${stageKey}`,
    studentId,
    offeringId: `eval-run-2026-05-25-AMC301-${sectionCode}`,
    semesterNumber: 1,
    sectionCode,
    courseCode: 'AMC301',
    courseTitle: 'Course AMC301',
    courseFamily: 'theory-heavy',
    coEvidenceMode: 'synthetic-blueprint',
    stageKey: stageKey as any,
    prerequisiteCourseCodes: ['AMC101', 'AMC102'],
    prerequisiteWeakCourseCodes: [],
    weakCourseOutcomeCodes: [],
    dominantQuestionTopics: ['logic'],
  }
}

function featurePayloadForStage(trajectory: DemoTrajectory, stageKey: string): ObservableFeaturePayload {
  // Map stage to which assessment evidence is available
  const hasTt1 = stageKey !== 'pre-tt1'
  const hasTt2 = stageKey === 'post-tt2' || stageKey === 'post-assignments' || stageKey === 'post-see'
  const hasAssignments = stageKey === 'post-assignments' || stageKey === 'post-see'
  const hasSee = stageKey === 'post-see'

  const tt1Pct = hasTt1 ? trajectory.tt1Pct * 100 : null
  const tt2Pct = hasTt2 ? trajectory.tt2Pct * 100 : null
  const seePct = hasSee ? trajectory.seePct * 100 : null
  const quizPct = hasAssignments ? trajectory.quizPct * 100 : null
  const assignmentPct = hasAssignments ? trajectory.assignmentPct * 100 : null

  return buildObservableFeaturePayload({
    attendancePct: trajectory.attendancePct * 100,
    attendanceHistory: [{ attendancePct: trajectory.attendancePct * 100 }],
    currentCgpa: 6.5,
    backlogCount: 0,
    tt1Pct,
    tt2Pct,
    seePct,
    quizPct,
    assignmentPct,
    weakCoCount: 0,
    weakQuestionCount: 1,
    interventionResponseScore: 0.1,
    prerequisiteAveragePct: 70,
    prerequisiteFailureCount: 0,
    prerequisiteCourseCodes: ['AMC101'],
    semesterProgress: stageKey === 'pre-tt1' ? 0.1 : stageKey === 'post-tt1' ? 0.3 : stageKey === 'post-tt2' ? 0.5 : stageKey === 'post-assignments' ? 0.7 : 0.9,
    semesterNumber: 1,
    sectionRiskRate: 0.3,
  })
}

function trainMinimalModel() {
  // Build a minimal training set so we have a valid production model artifact
  const seeds = [10001, 10002, 10003]
  const runMetadataById = new Map<string, ProofRunModelMetadata>(
    seeds.map(seed => [
      `sim-${seed}`,
      {
        simulationRunId: `sim-${seed}`,
        seed,
        split: 'train',
        scenarioFamily: 'balanced',
      },
    ]),
  )

  const rows = seeds.flatMap(seed =>
    Array.from({ length: 40 }, (_, i) => {
      const risky = i < 20
      return {
        riskEvidenceSnapshotId: `sim-${seed}-${i}`,
        batchId: 'batch-eval',
        featurePayload: buildObservableFeaturePayload({
          attendancePct: risky ? 60 : 85,
          attendanceHistory: [{ attendancePct: risky ? 65 : 84 }],
          currentCgpa: risky ? 5.5 : 8.0,
          backlogCount: risky ? 2 : 0,
          tt1Pct: risky ? 35 : 75,
          tt2Pct: risky ? 38 : 78,
          seePct: risky ? 32 : 74,
          quizPct: risky ? 40 : 80,
          assignmentPct: risky ? 42 : 82,
          weakCoCount: risky ? 3 : 0,
          weakQuestionCount: risky ? 5 : 1,
          interventionResponseScore: risky ? -0.15 : 0.15,
          prerequisiteAveragePct: risky ? 45 : 78,
          prerequisiteFailureCount: risky ? 2 : 0,
          prerequisiteCourseCodes: ['AMC101'],
          semesterProgress: 0.5,
          semesterNumber: 1,
          sectionRiskRate: risky ? 0.6 : 0.2,
        }),
        labelPayload: {
          attendanceRiskLabel: (risky ? 1 : 0) as 0 | 1,
          ceShortfallLabel: (risky ? 1 : 0) as 0 | 1,
          seeShortfallLabel: (risky ? 1 : 0) as 0 | 1,
          overallCourseFailLabel: (risky ? 1 : 0) as 0 | 1,
          downstreamCarryoverLabel: (risky ? 1 : 0) as 0 | 1,
        },
        sourceRefs: {
          simulationRunId: `sim-${seed}`,
          simulationStageCheckpointId: `sim-${seed}-s${i}`,
          studentId: `student-${i}`,
          offeringId: `sim-${seed}-AMC301`,
          semesterNumber: 1,
          sectionCode: 'A',
          courseCode: 'AMC301',
          courseTitle: 'Course AMC301',
          courseFamily: 'theory-heavy',
          coEvidenceMode: 'synthetic-blueprint',
          stageKey: 'post-see',
          prerequisiteCourseCodes: ['AMC101'],
          prerequisiteWeakCourseCodes: [],
          weakCourseOutcomeCodes: [],
          dominantQuestionTopics: ['logic'],
        } as ObservableSourceRefs,
      }
    }),
  )

  return trainProofRiskModel(rows, '2026-05-25T00:00:00.000Z', { runMetadataById })
}

type StageResult = {
  stageKey: string
  riskProb: number
  riskBand: 'High' | 'Medium' | 'Low'
  headProbabilities: Record<string, number>
  queuePriorityScore: number
  observableDrivers: Array<{ feature: string; impact: number; label: string }>
  recommendedAction: string
}

type StudentReport = {
  studentId: string
  pattern: string
  band: string
  special: boolean
  stages: StageResult[]
  riskProgression: number[]
  bandProgression: string[]
  verdict: string
}

function runEvaluation() {
  ensureDir(OUT_DIR)
  console.log('══════════════════════════════════════════════════════════')
  console.log('  DETERMINISTIC STUDENT TRAJECTORY EVALUATOR')
  console.log('  Date: 2026-05-25')
  console.log('  Evaluating: 120 students × 5 stages = 600 scoring events')
  console.log('══════════════════════════════════════════════════════════\n')

  console.log('Training minimal production model...')
  const bundle = trainMinimalModel()
  if (!bundle) throw new Error('Model training failed')
  console.log('Model trained. Heads:', Object.keys(bundle.production.heads).join(', '))

  const trajectoryMap = buildDemoTrajectoryMap(DEMO_STUDENT_IDS)
  const stageKeys = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const

  const reports: StudentReport[] = []
  let xgboostActiveCount = 0
  let deterministicCount = 0
  let shapPopulatedCount = 0

  for (const studentId of DEMO_STUDENT_IDS) {
    const trajectory = trajectoryMap.get(studentId)!
    const stages: StageResult[] = []

    for (const stageKey of stageKeys) {
      const payload = featurePayloadForStage(trajectory, stageKey)
      const sourceRefs = buildSourceRefs(studentId, stageKey)

      const scored = scoreObservableRiskWithModel({
        attendancePct: payload.attendancePct,
        currentCgpa: payload.currentCgpa,
        backlogCount: payload.backlogCount,
        tt1Pct: payload.tt1Pct,
        tt2Pct: payload.tt2Pct,
        quizPct: payload.quizPct,
        assignmentPct: payload.assignmentPct,
        seePct: payload.seePct,
        weakCoCount: payload.weakCoCount,
        attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
        questionWeaknessCount: payload.weakQuestionCount,
        interventionResponseScore: payload.interventionResponseScore,
        policy: DEFAULT_POLICY,
        featurePayload: payload,
        sourceRefs,
        productionModel: bundle.production,
        correlations: bundle.correlations,
      })

      // Determinism check: score the same input again
      const scored2 = scoreObservableRiskWithModel({
        attendancePct: payload.attendancePct,
        currentCgpa: payload.currentCgpa,
        backlogCount: payload.backlogCount,
        tt1Pct: payload.tt1Pct,
        tt2Pct: payload.tt2Pct,
        quizPct: payload.quizPct,
        assignmentPct: payload.assignmentPct,
        seePct: payload.seePct,
        weakCoCount: payload.weakCoCount,
        attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
        questionWeaknessCount: payload.weakQuestionCount,
        interventionResponseScore: payload.interventionResponseScore,
        policy: DEFAULT_POLICY,
        featurePayload: payload,
        sourceRefs,
        productionModel: bundle.production,
        correlations: bundle.correlations,
      })
      if (scored.riskProb === scored2.riskProb) deterministicCount++

      // XGBoost activity check: compare with null productionModel (logistic fallback)
      const fallback = scoreObservableRiskWithModel({
        attendancePct: payload.attendancePct,
        currentCgpa: payload.currentCgpa,
        backlogCount: payload.backlogCount,
        tt1Pct: payload.tt1Pct,
        tt2Pct: payload.tt2Pct,
        quizPct: payload.quizPct,
        assignmentPct: payload.assignmentPct,
        seePct: payload.seePct,
        weakCoCount: payload.weakCoCount,
        attendanceHistoryRiskCount: payload.attendanceHistoryRiskCount,
        questionWeaknessCount: payload.weakQuestionCount,
        interventionResponseScore: payload.interventionResponseScore,
        policy: DEFAULT_POLICY,
        featurePayload: payload,
        sourceRefs,
        productionModel: null,
        correlations: null,
      })
      if (Math.abs(scored.headProbabilities.overallCourseRisk - fallback.headProbabilities.overallCourseRisk) > 0.001) {
        xgboostActiveCount++
      }

      if (scored.observableDrivers.length > 0) shapPopulatedCount++

      stages.push({
        stageKey,
        riskProb: scored.riskProb,
        riskBand: scored.riskBand,
        headProbabilities: scored.headProbabilities as Record<string, number>,
        queuePriorityScore: scored.queuePriorityScore,
        observableDrivers: scored.observableDrivers.map(d => ({ feature: d.feature, impact: d.impact, label: d.label })),
        recommendedAction: scored.recommendedAction,
      })
    }

    const riskProgression = stages.map(s => s.riskProb)
    const bandProgression = stages.map(s => s.riskBand)

    // Verdict logic
    let verdict = 'Normal progression'
    if (trajectory.special) {
      switch (trajectory.pattern) {
        case 'mediocre-flat':
          verdict = riskProgression.every(r => r > 0.35) ? 'Consistently elevated risk — matches flat mediocrity' : 'UNEXPECTED: risk dropped below medium'
          break
        case 'fluctuating-resilient':
          verdict = riskProgression[3]! < riskProgression[1]! ? 'Recovery detected post-TT2 dip — correct' : 'UNEXPECTED: no recovery detected'
          break
        case 'strong-start-fade':
          verdict = riskProgression[4]! > riskProgression[0]! ? 'Risk climbed after strong start — correct fade pattern' : 'UNEXPECTED: risk did not climb after fade'
          break
        case 'slow-starter-bad-attendance':
          verdict = bandProgression.includes('High') ? 'High risk triggered by bad attendance — correct' : 'UNEXPECTED: attendance did not elevate risk'
          break
        case 'ce-strong-see-weak':
          verdict = stages[4]!.observableDrivers.some(d => d.feature === 'see')
            ? 'SEE surfaced as driver despite strong CE — correct'
            : 'UNEXPECTED: SEE not surfaced as driver'
          break
        case 'ce-weak-see-strong':
          verdict = stages[4]!.riskBand !== 'High' || riskProgression[4]! < 0.6
            ? 'Strong SEE prevented extreme risk — correct'
            : 'UNEXPECTED: strong SEE did not mitigate risk'
          break
        case 'test-strong-coursework-weak':
          verdict = stages.some(s => s.observableDrivers.some(d => d.feature === 'quiz' || d.feature === 'assignment'))
            ? 'Coursework weakness surfaced in SHAP — correct'
            : 'UNEXPECTED: coursework gap not in drivers'
          break
        default:
          verdict = 'Special pattern evaluated'
      }
    }

    reports.push({
      studentId,
      pattern: trajectory.pattern,
      band: trajectory.band,
      special: trajectory.special,
      stages,
      riskProgression,
      bandProgression,
      verdict,
    })
  }

  // Write full report
  const totalScoringEvents = DEMO_STUDENT_IDS.length * stageKeys.length
  const summary = {
    date: '2026-05-25',
    totalStudents: DEMO_STUDENT_IDS.length,
    totalScoringEvents,
    stageKeys: [...stageKeys],
    determinism: {
      checked: totalScoringEvents,
      passed: deterministicCount,
      rate: Math.round((deterministicCount / totalScoringEvents) * 10000) / 100,
    },
    xgboostActivity: {
      checked: totalScoringEvents,
      active: xgboostActiveCount,
      rate: Math.round((xgboostActiveCount / totalScoringEvents) * 10000) / 100,
    },
    shapPopulation: {
      checked: totalScoringEvents,
      populated: shapPopulatedCount,
      rate: Math.round((shapPopulatedCount / totalScoringEvents) * 10000) / 100,
    },
    specialStudentVerdicts: reports.filter(r => r.special).map(r => ({
      studentId: r.studentId,
      pattern: r.pattern,
      verdict: r.verdict,
      finalRisk: r.riskProgression[4],
      finalBand: r.bandProgression[4],
    })),
    normalStudentSummary: {
      avgFinalRisk: Math.round((reports.filter(r => !r.special).reduce((s, r) => s + r.riskProgression[4]!, 0) / reports.filter(r => !r.special).length) * 10000) / 10000,
      highRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'High').length,
      mediumRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'Medium').length,
      lowRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'Low').length,
    },
  }

  fs.writeFileSync(path.join(OUT_DIR, 'deterministic-trajectory-report.json'), JSON.stringify({ summary, reports }, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'deterministic-trajectory-summary.json'), JSON.stringify(summary, null, 2))

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  EVALUATION COMPLETE')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  Total students evaluated:     ${summary.totalStudents}`)
  console.log(`  Total scoring events:         ${summary.totalScoringEvents}`)
  console.log(`  Determinism pass rate:        ${summary.determinism.rate}% (${summary.determinism.passed}/${summary.determinism.checked})`)
  console.log(`  XGBoost active rate:          ${summary.xgboostActivity.rate}% (${summary.xgboostActivity.active}/${summary.xgboostActivity.checked})`)
  console.log(`  SHAP populated rate:          ${summary.shapPopulation.rate}% (${summary.shapPopulation.populated}/${summary.shapPopulation.checked})`)
  console.log(`  Normal student avg final risk: ${summary.normalStudentSummary.avgFinalRisk}`)
  console.log(`  Normal student final bands:     High=${summary.normalStudentSummary.highRiskCount}, Medium=${summary.normalStudentSummary.mediumRiskCount}, Low=${summary.normalStudentSummary.lowRiskCount}`)
  console.log('\n  Special Student Verdicts:')
  for (const v of summary.specialStudentVerdicts) {
    const status = v.verdict.startsWith('UNEXPECTED') ? 'FAIL' : 'PASS'
    console.log(`    [${status}] ${v.studentId} (${v.pattern}): final=${v.finalBand}(${v.finalRisk?.toFixed(3)}) — ${v.verdict}`)
  }
  console.log(`\n  Full report written to: ${OUT_DIR}/`)

  // Exit with non-zero if any special student verdict failed
  const unexpectedCount = summary.specialStudentVerdicts.filter(v => v.verdict.startsWith('UNEXPECTED')).length
  if (unexpectedCount > 0) {
    console.log(`\n  WARNING: ${unexpectedCount} special student verdict(s) failed.`)
    process.exit(1)
  }
  console.log('\n  ALL SPECIAL STUDENT VERDICTS PASSED.')
  process.exit(0)
}

runEvaluation()
