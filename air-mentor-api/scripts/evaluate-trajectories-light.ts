#!/usr/bin/env tsx
/**
 * Lightweight Deterministic Trajectory Evaluator
 * Evaluates 10 special + 20 sampled normal students across 5 stages.
 * Fast enough to run before demo.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  buildObservableFeaturePayload,
  scoreObservableRiskWithModel,
  trainProofRiskModel,
  type ObservableFeaturePayload,
  type ObservableSourceRefs,
  type ProofRunModelMetadata,
} from '../src/lib/proof-risk-model.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'
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
  const hasTt1 = stageKey !== 'pre-tt1'
  const hasTt2 = stageKey === 'post-tt2' || stageKey === 'post-assignments' || stageKey === 'post-see'
  const hasAssignments = stageKey === 'post-assignments' || stageKey === 'post-see'
  const hasSee = stageKey === 'post-see'

  return buildObservableFeaturePayload({
    attendancePct: trajectory.attendancePct * 100,
    attendanceHistory: [{ attendancePct: trajectory.attendancePct * 100 }],
    currentCgpa: 6.5,
    backlogCount: 0,
    tt1Pct: hasTt1 ? trajectory.tt1Pct * 100 : null,
    tt2Pct: hasTt2 ? trajectory.tt2Pct * 100 : null,
    seePct: hasSee ? trajectory.seePct * 100 : null,
    quizPct: hasAssignments ? trajectory.quizPct * 100 : null,
    assignmentPct: hasAssignments ? trajectory.assignmentPct * 100 : null,
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
  const seeds = [10001, 10002, 10003]
  const runMetadataById = new Map<string, ProofRunModelMetadata>(
    seeds.map(seed => [
      `sim-${seed}`,
      { simulationRunId: `sim-${seed}`, seed, split: 'train', scenarioFamily: 'balanced' },
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
  console.log('  LIGHTWEIGHT TRAJECTORY EVALUATOR')
  console.log('  30 students × 5 stages = 150 scoring events')
  console.log('══════════════════════════════════════════════════════════\n')

  console.log('Training minimal production model...')
  const bundle = trainMinimalModel()
  if (!bundle) throw new Error('Model training failed')
  console.log('Model trained.\n')

  const trajectoryMap = buildDemoTrajectoryMap(DEMO_STUDENT_IDS)
  const stageKeys = ['pre-tt1', 'post-tt1', 'post-tt2', 'post-assignments', 'post-see'] as const

  // Evaluate all 10 special students + 20 normal students (every 6th)
  const sampledStudentIds = [
    ...DEMO_STUDENT_IDS.filter((_, i) => i < 10), // special students are first 10
    ...DEMO_STUDENT_IDS.filter((_, i) => i >= 10 && i % 5 === 0).slice(0, 20),
  ]

  const reports: StudentReport[] = []
  let xgboostActiveCount = 0
  let deterministicCount = 0
  let shapPopulatedCount = 0

  for (const studentId of sampledStudentIds) {
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

      // Determinism check
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

      // XGBoost activity check
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

    let verdict = 'Normal progression'
    if (trajectory.special) {
      switch (trajectory.pattern) {
        case 'mediocre-flat':
          verdict = riskProgression.every(r => r > 0.35) ? 'PASS: Consistently elevated risk matches flat mediocrity' : 'FAIL: risk dropped below medium'
          break
        case 'fluctuating-resilient':
          verdict = riskProgression[3]! < riskProgression[1]! ? 'PASS: Recovery detected post-TT2 dip' : 'FAIL: no recovery detected'
          break
        case 'strong-start-fade':
          verdict = riskProgression[4]! > riskProgression[0]! ? 'PASS: Risk climbed after strong start' : 'FAIL: risk did not climb after fade'
          break
        case 'slow-starter-bad-attendance':
          verdict = bandProgression.includes('High') ? 'PASS: High risk triggered by bad attendance' : 'FAIL: attendance did not elevate risk'
          break
        case 'ce-strong-see-weak':
          verdict = stages[4]!.observableDrivers.some(d => d.feature === 'see')
            ? 'PASS: SEE surfaced as driver despite strong CE'
            : 'FAIL: SEE not surfaced as driver'
          break
        case 'ce-weak-see-strong':
          verdict = stages[4]!.riskBand !== 'High' || riskProgression[4]! < 0.6
            ? 'PASS: Strong SEE prevented extreme risk'
            : 'FAIL: strong SEE did not mitigate risk'
          break
        case 'test-strong-coursework-weak':
          verdict = stages.some(s => s.observableDrivers.some(d => d.feature === 'quiz' || d.feature === 'assignment'))
            ? 'PASS: Coursework weakness surfaced in SHAP'
            : 'FAIL: coursework gap not in drivers'
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

  const totalScoringEvents = sampledStudentIds.length * stageKeys.length
  const summary = {
    date: '2026-05-25',
    totalStudentsEvaluated: sampledStudentIds.length,
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
      avgFinalRisk: Math.round((reports.filter(r => !r.special).reduce((s, r) => s + r.riskProgression[4]!, 0) / Math.max(1, reports.filter(r => !r.special).length)) * 10000) / 10000,
      highRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'High').length,
      mediumRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'Medium').length,
      lowRiskCount: reports.filter(r => !r.special && r.bandProgression[4] === 'Low').length,
    },
  }

  fs.writeFileSync(path.join(OUT_DIR, 'lightweight-trajectory-report.json'), JSON.stringify({ summary, reports }, null, 2))

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  EVALUATION COMPLETE')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  Students evaluated:           ${summary.totalStudentsEvaluated}`)
  console.log(`  Scoring events:               ${summary.totalScoringEvents}`)
  console.log(`  Determinism pass rate:        ${summary.determinism.rate}%`)
  console.log(`  XGBoost active rate:          ${summary.xgboostActivity.rate}%`)
  console.log(`  SHAP populated rate:          ${summary.shapPopulation.rate}%`)
  console.log(`  Normal avg final risk:        ${summary.normalStudentSummary.avgFinalRisk}`)
  console.log(`  Normal final bands:           High=${summary.normalStudentSummary.highRiskCount}, Medium=${summary.normalStudentSummary.mediumRiskCount}, Low=${summary.normalStudentSummary.lowRiskCount}`)
  console.log('\n  Special Student Verdicts:')
  for (const v of summary.specialStudentVerdicts) {
    const status = v.verdict.startsWith('FAIL') ? 'FAIL' : 'PASS'
    console.log(`    [${status}] ${v.studentId} (${v.pattern}): final=${v.finalBand}(${v.finalRisk?.toFixed(3)}) — ${v.verdict}`)
  }

  const failCount = summary.specialStudentVerdicts.filter(v => v.verdict.startsWith('FAIL')).length
  if (failCount > 0) {
    console.log(`\n  WARNING: ${failCount} special student verdict(s) failed.`)
    process.exit(1)
  }
  console.log('\n  ALL SPECIAL STUDENT VERDICTS PASSED.')
  console.log(`  Report: ${OUT_DIR}/lightweight-trajectory-report.json`)
}

runEvaluation()
