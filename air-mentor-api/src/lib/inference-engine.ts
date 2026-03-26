import type { ResolvedPolicy } from '../modules/admin-structure.js'

export type ObservableDriver = {
  label: string
  impact: number
  feature: 'attendance' | 'tt1' | 'tt2' | 'see' | 'cgpa' | 'backlog' | 'co' | 'quiz' | 'assignment' | 'attendance-history' | 'question-pattern' | 'intervention-response'
}

export type ObservableInferenceInput = {
  attendancePct: number
  currentCgpa: number
  backlogCount: number
  tt1Pct?: number | null
  tt2Pct?: number | null
  seePct?: number | null
  weakCoCount?: number
  quizPct?: number | null
  assignmentPct?: number | null
  attendanceHistoryRiskCount?: number
  questionWeaknessCount?: number
  interventionResponseScore?: number | null
  policy: ResolvedPolicy
}

export type ObservableInferenceOutput = {
  riskProb: number
  riskBand: 'High' | 'Medium' | 'Low'
  recommendedAction: string
  observableDrivers: ObservableDriver[]
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

export function inferObservableDrivers(input: ObservableInferenceInput): ObservableDriver[] {
  const drivers: ObservableDriver[] = []
  const { riskRules } = input.policy
  if (input.attendancePct < riskRules.highRiskAttendancePercentBelow) {
    drivers.push({
      label: `Attendance is below the high-risk threshold (${input.attendancePct}%)`,
      impact: 0.28,
      feature: 'attendance',
    })
  } else if (input.attendancePct < riskRules.mediumRiskAttendancePercentBelow) {
    drivers.push({
      label: `Attendance is below the operating threshold (${input.attendancePct}%)`,
      impact: 0.14,
      feature: 'attendance',
    })
  }

  if (input.currentCgpa > 0 && input.currentCgpa < riskRules.highRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the high-risk threshold (${input.currentCgpa.toFixed(2)})`,
      impact: 0.2,
      feature: 'cgpa',
    })
  } else if (input.currentCgpa > 0 && input.currentCgpa < riskRules.mediumRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the watch threshold (${input.currentCgpa.toFixed(2)})`,
      impact: 0.1,
      feature: 'cgpa',
    })
  }

  if (input.backlogCount >= riskRules.highRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is high (${input.backlogCount})`,
      impact: 0.18,
      feature: 'backlog',
    })
  } else if (input.backlogCount >= riskRules.mediumRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is above the watch threshold (${input.backlogCount})`,
      impact: 0.09,
      feature: 'backlog',
    })
  }

  const termSignals = [
    { key: 'tt1' as const, label: 'TT1', pct: input.tt1Pct ?? null },
    { key: 'tt2' as const, label: 'TT2', pct: input.tt2Pct ?? null },
    { key: 'see' as const, label: 'SEE', pct: input.seePct ?? null },
  ]
  for (const signal of termSignals) {
    if (signal.pct === null) continue
    if (signal.pct < 40) {
      drivers.push({
        label: `${signal.label} performance is very low (${roundToTwo(signal.pct)}%)`,
        impact: 0.16,
        feature: signal.key,
      })
    } else if (signal.pct < 55) {
      drivers.push({
        label: `${signal.label} performance is below the watch threshold (${roundToTwo(signal.pct)}%)`,
        impact: 0.08,
        feature: signal.key,
      })
    }
  }

  if ((input.attendanceHistoryRiskCount ?? 0) >= 2) {
    drivers.push({
      label: `Attendance stayed below the policy threshold across multiple checkpoints (${input.attendanceHistoryRiskCount})`,
      impact: 0.08,
      feature: 'attendance-history',
    })
  }

  if ((input.questionWeaknessCount ?? 0) >= 4) {
    drivers.push({
      label: `Question-level evidence shows repeated weakness across the current paper (${input.questionWeaknessCount})`,
      impact: 0.09,
      feature: 'question-pattern',
    })
  } else if ((input.questionWeaknessCount ?? 0) >= 2) {
    drivers.push({
      label: 'Question-level evidence shows targeted weakness in the current evidence window',
      impact: 0.05,
      feature: 'question-pattern',
    })
  }

  if (typeof input.quizPct === 'number' && input.quizPct < 45) {
    drivers.push({
      label: `Quiz evidence is weak (${roundToTwo(input.quizPct)}%)`,
      impact: 0.06,
      feature: 'quiz',
    })
  }

  if (typeof input.assignmentPct === 'number' && input.assignmentPct < 45) {
    drivers.push({
      label: `Assignment evidence is weak (${roundToTwo(input.assignmentPct)}%)`,
      impact: 0.06,
      feature: 'assignment',
    })
  }

  if ((input.weakCoCount ?? 0) >= 2) {
    drivers.push({
      label: `Multiple course outcomes are below the support threshold (${input.weakCoCount})`,
      impact: 0.1,
      feature: 'co',
    })
  } else if ((input.weakCoCount ?? 0) === 1) {
    drivers.push({
      label: 'One course outcome is below the support threshold',
      impact: 0.05,
      feature: 'co',
    })
  }

  if (typeof input.interventionResponseScore === 'number' && input.interventionResponseScore < -0.05) {
    drivers.push({
      label: 'Observed response after support remains below the expected recovery threshold',
      impact: 0.08,
      feature: 'intervention-response',
    })
  } else if (typeof input.interventionResponseScore === 'number' && input.interventionResponseScore > 0.08) {
    drivers.push({
      label: 'Observed response after support improved above the expected recovery threshold',
      impact: -0.05,
      feature: 'intervention-response',
    })
  }

  return drivers.sort((left, right) => right.impact - left.impact)
}

export function inferObservableRisk(input: ObservableInferenceInput): ObservableInferenceOutput {
  const drivers = inferObservableDrivers(input)
  let riskProb = 0.08
  for (const driver of drivers) riskProb += driver.impact
  const bounded = Math.max(0.05, Math.min(0.95, roundToTwo(riskProb)))
  const riskBand: 'High' | 'Medium' | 'Low' = bounded >= 0.7 ? 'High' : bounded >= 0.35 ? 'Medium' : 'Low'
  return {
    riskProb: bounded,
    riskBand,
    recommendedAction: riskBand === 'High'
      ? 'Immediate mentor follow-up and reassessment before the next evaluation checkpoint.'
      : riskBand === 'Medium'
        ? 'Schedule a monitored reassessment and review the current intervention plan.'
        : 'Continue routine monitoring on the current evidence window.',
    observableDrivers: drivers,
  }
}
