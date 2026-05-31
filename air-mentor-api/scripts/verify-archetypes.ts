import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  scoreObservableRiskWithModel,
  buildObservableFeaturePayload,
} from '../src/lib/proof-risk-model.js'
import type { ProofRiskModelBundle } from '../src/lib/proof-risk-model.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const artifactStr = readFileSync(path.resolve(__dirname, '../../output/proof-risk-model/risk-model-bundle.json'), 'utf8')
const bundle = JSON.parse(artifactStr) as ProofRiskModelBundle

function evaluateStage(name: string, input: any) {
  const featurePayload = buildObservableFeaturePayload({
    attendancePct: input.attendancePct,
    currentCgpa: input.currentCgpa ?? 7.5,
    cgpaMissing: input.cgpaMissing ?? false,
    backlogCount: input.backlogCount ?? 0,
    backlogCredits: input.backlogCredits ?? (input.backlogCount ? input.backlogCount * 4 : 0),
    tt1Pct: input.tt1Pct ?? null,
    tt2Pct: input.tt2Pct ?? null,
    quizPct: input.quizPct ?? null,
    assignmentPct: input.assignmentPct ?? null,
    seePct: input.seePct ?? null,
    weakCoCount: input.weakCoCount ?? 0,
    weakQuestionCount: input.weakQuestionCount ?? 0,
    interventionResponseScore: input.interventionResponseScore ?? null,
    prerequisiteAveragePct: input.prerequisiteAveragePct ?? 65,
    prerequisiteFailureCount: input.prerequisiteFailureCount ?? 0,
    prerequisiteCourseCodes: [],
    semesterNumber: input.semesterNumber ?? 3,
    sectionRiskRate: 0.15,
    semesterProgress: input.semesterProgress ?? 0.5,
  })

  const output = scoreObservableRiskWithModel({
    attendancePct: input.attendancePct,
    currentCgpa: input.currentCgpa ?? 7.5,
    cgpaMissing: input.cgpaMissing ?? false,
    backlogCount: input.backlogCount ?? 0,
    backlogCredits: input.backlogCredits ?? (input.backlogCount ? input.backlogCount * 4 : 0),
    tt1Pct: input.tt1Pct ?? null,
    tt2Pct: input.tt2Pct ?? null,
    seePct: input.seePct ?? null,
    weakCoCount: input.weakCoCount ?? 0,
    quizPct: input.quizPct ?? null,
    assignmentPct: input.assignmentPct ?? null,
    attendanceHistoryRiskCount: input.attendanceHistoryRiskCount ?? 0,
    questionWeaknessCount: input.weakQuestionCount ?? 0,
    interventionResponseScore: input.interventionResponseScore ?? null,
    stageKey: input.stageKey ?? 'mid-semester',
    policy: DEFAULT_POLICY,
    featurePayload,
    productionModel: bundle.production,
    challengerModel: bundle.challenger,
    correlations: bundle.correlations,
  })

  return {
    stage: name,
    riskProb: Math.round(output.riskProb * 100) + '%',
    riskBand: output.riskBand,
    action: output.recommendedAction,
    drivers: output.observableDrivers.slice(0, 2).map((d: any) => d.label)
  }
}

const archetypes = [
  {
    name: "Archetype A: The Consistent High Performer",
    stages: [
      { name: "1. Pre-TT1", payload: { attendancePct: 92, cgpaMissing: false, currentCgpa: 8.5, semesterProgress: 0.1 } },
      { name: "2. Post-TT1", payload: { attendancePct: 93, tt1Pct: 88, currentCgpa: 8.5, semesterProgress: 0.3 } },
      { name: "3. Post-TT2", payload: { attendancePct: 91, tt1Pct: 88, tt2Pct: 86, assignmentPct: 90, quizPct: 85, currentCgpa: 8.5, semesterProgress: 0.7 } },
      { name: "4. Post-SEE", payload: { attendancePct: 90, tt1Pct: 88, tt2Pct: 86, assignmentPct: 90, quizPct: 85, seePct: 89, currentCgpa: 8.5, semesterProgress: 1.0 } }
    ]
  },
  {
    name: "Archetype B: The Sudden Drop-Off (Mid-Semester Crisis)",
    stages: [
      { name: "1. Pre-TT1", payload: { attendancePct: 95, currentCgpa: 7.2, semesterProgress: 0.1 } },
      { name: "2. Post-TT1", payload: { attendancePct: 90, tt1Pct: 75, currentCgpa: 7.2, semesterProgress: 0.3 } },
      { name: "3. Post-TT2", payload: { attendancePct: 45, attendanceHistoryRiskCount: 1, tt1Pct: 75, tt2Pct: 35, weakCoCount: 3, assignmentPct: 40, quizPct: 30, currentCgpa: 7.2, semesterProgress: 0.7 } },
      { name: "4. Post-SEE", payload: { attendancePct: 35, attendanceHistoryRiskCount: 2, tt1Pct: 75, tt2Pct: 35, weakCoCount: 4, assignmentPct: 20, quizPct: 30, seePct: 25, currentCgpa: 7.2, semesterProgress: 1.0 } }
    ]
  },
  {
    name: "Archetype C: The Terminal Absentee / Backlog Carrier",
    stages: [
      { name: "1. Pre-TT1", payload: { attendancePct: 55, backlogCount: 3, backlogCredits: 12, currentCgpa: 4.8, semesterProgress: 0.1 } },
      { name: "2. Post-TT1", payload: { attendancePct: 40, backlogCount: 3, backlogCredits: 12, tt1Pct: 22, currentCgpa: 4.8, semesterProgress: 0.3 } },
      { name: "3. Post-TT2", payload: { attendancePct: 30, backlogCount: 3, backlogCredits: 12, tt1Pct: 22, tt2Pct: 15, weakCoCount: 5, assignmentPct: 10, quizPct: 0, currentCgpa: 4.8, semesterProgress: 0.7 } },
      { name: "4. Post-SEE", payload: { attendancePct: 25, backlogCount: 3, backlogCredits: 12, tt1Pct: 22, tt2Pct: 15, weakCoCount: 5, assignmentPct: 10, quizPct: 0, seePct: 12, currentCgpa: 4.8, semesterProgress: 1.0 } }
    ]
  },
  {
    name: "Archetype D: The Late Bloomer (Intervention Success)",
    stages: [
      { name: "1. Pre-TT1", payload: { attendancePct: 70, currentCgpa: 6.1, semesterProgress: 0.1 } },
      { name: "2. Post-TT1", payload: { attendancePct: 72, tt1Pct: 38, weakCoCount: 2, currentCgpa: 6.1, semesterProgress: 0.3 } },
      { name: "3. Post-Intervention / Post-TT2", payload: { attendancePct: 85, tt1Pct: 38, tt2Pct: 65, assignmentPct: 70, quizPct: 68, weakCoCount: 0, interventionResponseScore: 0.85, currentCgpa: 6.1, semesterProgress: 0.7 } },
      { name: "4. Post-SEE", payload: { attendancePct: 88, tt1Pct: 38, tt2Pct: 65, assignmentPct: 70, quizPct: 68, seePct: 72, interventionResponseScore: 0.90, currentCgpa: 6.1, semesterProgress: 1.0 } }
    ]
  }
]

const results: any = {}

for (const archetype of archetypes) {
  results[archetype.name] = archetype.stages.map(stage => evaluateStage(stage.name, stage.payload))
}

writeFileSync(
  path.resolve(__dirname, '../../archetype_evaluation_raw.json'),
  JSON.stringify(results, null, 2)
)

console.log("Evaluation complete. Results saved to archetype_evaluation_raw.json")
