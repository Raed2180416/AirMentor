import type { ResolvedPolicy } from '../modules/admin-structure.js'
import {
  ASSIGNMENT_WEAK_IMPACT,
  ASSIGNMENT_WEAK_THRESHOLD_PCT,
  ATTENDANCE_HIGH_RISK_IMPACT,
  ATTENDANCE_MEDIUM_RISK_IMPACT,
  ATTENDANCE_TREND_IMPACT,
  ATTENDANCE_TREND_THRESHOLD_COUNT,
  BACKLOG_HIGH_RISK_IMPACT,
  BACKLOG_MEDIUM_RISK_IMPACT,
  CGPA_HIGH_RISK_IMPACT,
  CGPA_MEDIUM_RISK_IMPACT,
  INFERENCE_BASELINE_RISK,
  INFERENCE_RISK_LOWER_CLAMP,
  INFERENCE_RISK_UPPER_CLAMP,
  INTERVENTION_NEGATIVE_RESPONSE_IMPACT,
  INTERVENTION_NEGATIVE_RESPONSE_THRESHOLD,
  INTERVENTION_POSITIVE_RESPONSE_IMPACT,
  INTERVENTION_POSITIVE_RESPONSE_THRESHOLD,
  QUESTION_WEAKNESS_HIGH_IMPACT,
  QUESTION_WEAKNESS_HIGH_THRESHOLD_COUNT,
  QUESTION_WEAKNESS_MEDIUM_IMPACT,
  QUESTION_WEAKNESS_MEDIUM_THRESHOLD_COUNT,
  QUIZ_WEAK_IMPACT,
  QUIZ_WEAK_THRESHOLD_PCT,
  RISK_BAND_HIGH_THRESHOLD,
  RISK_BAND_MEDIUM_THRESHOLD,
  TERM_SIGNAL_VERY_LOW_IMPACT,
  TERM_SIGNAL_VERY_LOW_THRESHOLD_PCT,
  TERM_SIGNAL_WATCH_IMPACT,
  TERM_SIGNAL_WATCH_THRESHOLD_PCT,
  WEAK_CO_HIGH_IMPACT,
  WEAK_CO_HIGH_THRESHOLD_COUNT,
  WEAK_CO_MEDIUM_IMPACT,
} from './learning-dynamics-constants.js'

export type ObservableDriver = {
  label: string
  impact: number
  feature: 'attendance' | 'tt1' | 'tt2' | 'see' | 'cgpa' | 'backlog' | 'co' | 'quiz' | 'assignment' | 'attendance-history' | 'question-pattern' | 'intervention-response'
}

export type ObservableInferenceInput = {
  attendancePct: number
  currentCgpa: number
  cgpaMissing?: boolean
  backlogCount: number
  backlogMissing?: boolean
  tt1Pct?: number | null
  tt2Pct?: number | null
  seePct?: number | null
  weakCoCount?: number
  quizPct?: number | null
  assignmentPct?: number | null
  attendanceHistoryRiskCount?: number
  questionWeaknessCount?: number
  interventionResponseScore?: number | null
  stageKey?: string | null
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
      impact: ATTENDANCE_HIGH_RISK_IMPACT,
      feature: 'attendance',
    })
  } else if (input.attendancePct < riskRules.mediumRiskAttendancePercentBelow) {
    drivers.push({
      label: `Attendance is below the operating threshold (${input.attendancePct}%)`,
      impact: ATTENDANCE_MEDIUM_RISK_IMPACT,
      feature: 'attendance',
    })
  }

  if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.highRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the high-risk threshold (${input.currentCgpa.toFixed(2)})`,
      impact: CGPA_HIGH_RISK_IMPACT,
      feature: 'cgpa',
    })
  } else if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.mediumRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the watch threshold (${input.currentCgpa.toFixed(2)})`,
      impact: CGPA_MEDIUM_RISK_IMPACT,
      feature: 'cgpa',
    })
  }

  if (input.backlogMissing !== true && input.backlogCount >= riskRules.highRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is high (${input.backlogCount})`,
      impact: BACKLOG_HIGH_RISK_IMPACT,
      feature: 'backlog',
    })
  } else if (input.backlogMissing !== true && input.backlogCount >= riskRules.mediumRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is above the watch threshold (${input.backlogCount})`,
      impact: BACKLOG_MEDIUM_RISK_IMPACT,
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
    if (signal.pct < TERM_SIGNAL_VERY_LOW_THRESHOLD_PCT) {
      drivers.push({
        label: `${signal.label} performance is very low (${roundToTwo(signal.pct)}%)`,
        impact: TERM_SIGNAL_VERY_LOW_IMPACT,
        feature: signal.key,
      })
    } else if (signal.pct < TERM_SIGNAL_WATCH_THRESHOLD_PCT) {
      drivers.push({
        label: `${signal.label} performance is below the watch threshold (${roundToTwo(signal.pct)}%)`,
        impact: TERM_SIGNAL_WATCH_IMPACT,
        feature: signal.key,
      })
    }
  }

  if ((input.attendanceHistoryRiskCount ?? 0) >= ATTENDANCE_TREND_THRESHOLD_COUNT) {
    drivers.push({
      label: `Attendance stayed below the policy threshold across multiple checkpoints (${input.attendanceHistoryRiskCount})`,
      impact: ATTENDANCE_TREND_IMPACT,
      feature: 'attendance-history',
    })
  }

  if ((input.questionWeaknessCount ?? 0) >= QUESTION_WEAKNESS_HIGH_THRESHOLD_COUNT) {
    drivers.push({
      label: `Question-level evidence shows repeated weakness across the current paper (${input.questionWeaknessCount})`,
      impact: QUESTION_WEAKNESS_HIGH_IMPACT,
      feature: 'question-pattern',
    })
  } else if ((input.questionWeaknessCount ?? 0) >= QUESTION_WEAKNESS_MEDIUM_THRESHOLD_COUNT) {
    drivers.push({
      label: 'Question-level evidence shows targeted weakness in the current evidence window',
      impact: QUESTION_WEAKNESS_MEDIUM_IMPACT,
      feature: 'question-pattern',
    })
  }

  if (typeof input.quizPct === 'number' && input.quizPct < QUIZ_WEAK_THRESHOLD_PCT) {
    drivers.push({
      label: `Quiz evidence is weak (${roundToTwo(input.quizPct)}%)`,
      impact: QUIZ_WEAK_IMPACT,
      feature: 'quiz',
    })
  }

  if (typeof input.assignmentPct === 'number' && input.assignmentPct < ASSIGNMENT_WEAK_THRESHOLD_PCT) {
    drivers.push({
      label: `Assignment evidence is weak (${roundToTwo(input.assignmentPct)}%)`,
      impact: ASSIGNMENT_WEAK_IMPACT,
      feature: 'assignment',
    })
  }

  if ((input.weakCoCount ?? 0) >= WEAK_CO_HIGH_THRESHOLD_COUNT) {
    drivers.push({
      label: `Multiple course outcomes are below the support threshold (${input.weakCoCount})`,
      impact: WEAK_CO_HIGH_IMPACT,
      feature: 'co',
    })
  } else if ((input.weakCoCount ?? 0) === 1) {
    drivers.push({
      label: 'One course outcome is below the support threshold',
      impact: WEAK_CO_MEDIUM_IMPACT,
      feature: 'co',
    })
  }

  if (typeof input.interventionResponseScore === 'number' && input.interventionResponseScore < INTERVENTION_NEGATIVE_RESPONSE_THRESHOLD) {
    drivers.push({
      label: 'Observed response after support remains below the expected recovery threshold',
      impact: INTERVENTION_NEGATIVE_RESPONSE_IMPACT,
      feature: 'intervention-response',
    })
  } else if (typeof input.interventionResponseScore === 'number' && input.interventionResponseScore > INTERVENTION_POSITIVE_RESPONSE_THRESHOLD) {
    drivers.push({
      label: 'Observed response after support improved above the expected recovery threshold',
      impact: INTERVENTION_POSITIVE_RESPONSE_IMPACT,
      feature: 'intervention-response',
    })
  }

  return drivers.sort((left, right) => right.impact - left.impact)
}

export function inferObservableRisk(input: ObservableInferenceInput): ObservableInferenceOutput {
  const drivers = inferObservableDrivers(input)
  let riskProb = INFERENCE_BASELINE_RISK
  for (const driver of drivers) riskProb += driver.impact
  const bounded = Math.max(INFERENCE_RISK_LOWER_CLAMP, Math.min(INFERENCE_RISK_UPPER_CLAMP, roundToTwo(riskProb)))
  const riskBand: 'High' | 'Medium' | 'Low' = bounded >= RISK_BAND_HIGH_THRESHOLD ? 'High' : bounded >= RISK_BAND_MEDIUM_THRESHOLD ? 'Medium' : 'Low'
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
