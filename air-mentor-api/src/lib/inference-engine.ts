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
  feature: 'attendance' | 'tt1' | 'tt2' | 'see' | 'ce' | 'overall' | 'cgpa' | 'backlog' | 'co' | 'quiz' | 'assignment' | 'attendance-history' | 'question-pattern' | 'intervention-response' | 'prerequisite' | 'section-pressure' | 'coursework-gap' | 'cgpa-missing' | 'backlog-missing' | 'tt1-missing' | 'tt2-missing' | 'see-missing' | 'quiz-missing' | 'assignment-missing'
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
  cePct?: number | null
  overallPct?: number | null
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
  attentionAreas?: string[]
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

export type ObservableRiskBandThresholds = {
  readonly medium: number
  readonly high: number
}

export function policyRiskFloorFromObservableInput(
  input: ObservableInferenceInput,
  thresholds: ObservableRiskBandThresholds,
): { riskFloor: number; reasons: string[] } {
  const { riskRules } = input.policy
  const attendanceRules = input.policy.attendanceRules ?? {
    minimumRequiredPercent: riskRules.mediumRiskAttendancePercentBelow,
    condonationFloorPercent: Math.min(riskRules.mediumRiskAttendancePercentBelow, riskRules.highRiskAttendancePercentBelow),
  }
  const passRules = input.policy.passRules ?? {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  }
  let riskFloor = 0
  const reasons: string[] = []
  const applyFloor = (floor: number, reason: string) => {
    riskFloor = Math.max(riskFloor, floor)
    reasons.push(reason)
  }

  if (input.attendancePct < riskRules.highRiskAttendancePercentBelow) {
    applyFloor(thresholds.high, 'Attendance is below the high-risk institutional threshold.')
  } else if (input.attendancePct < Math.max(attendanceRules.minimumRequiredPercent, riskRules.mediumRiskAttendancePercentBelow)) {
    applyFloor(thresholds.medium, 'Attendance is below the minimum required institutional threshold.')
  }

  if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.highRiskCgpaBelow) {
    applyFloor(thresholds.high, 'Current CGPA is below the high-risk institutional threshold.')
  } else if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.mediumRiskCgpaBelow) {
    applyFloor(thresholds.medium, 'Current CGPA is below the watch institutional threshold.')
  }

  if (input.backlogMissing !== true && input.backlogCount >= riskRules.highRiskBacklogCount) {
    applyFloor(thresholds.high, 'Active backlog count is at the high-risk institutional threshold.')
  } else if (input.backlogMissing !== true && input.backlogCount >= riskRules.mediumRiskBacklogCount) {
    applyFloor(thresholds.medium, 'Active backlog count is above the watch institutional threshold.')
  }

  if (typeof input.cePct === 'number' && Number.isFinite(input.cePct)) {
    const ceMark = (input.cePct / 100) * passRules.ceMaximum
    if (ceMark < passRules.minimumCeMark) {
      applyFloor(thresholds.medium, `Continuous evaluation is below the minimum pass mark (${roundToTwo(ceMark)}/${passRules.ceMaximum}).`)
    }
  }

  if (typeof input.seePct === 'number' && Number.isFinite(input.seePct)) {
    const seeMark = (input.seePct / 100) * passRules.seeMaximum
    if (seeMark < passRules.minimumSeeMark) {
      applyFloor(thresholds.high, `SEE mark is below the minimum pass mark (${roundToTwo(seeMark)}/${passRules.seeMaximum}).`)
    }
  }

  if (typeof input.overallPct === 'number' && Number.isFinite(input.overallPct) && input.overallPct < passRules.minimumOverallMark) {
    applyFloor(thresholds.high, `Overall course mark is below the minimum pass mark (${roundToTwo(input.overallPct)}/${passRules.overallMaximum}).`)
  }

  return { riskFloor, reasons }
}

export function isCriticallySparseAcademicEvidence(input: ObservableInferenceInput): boolean {
  const assessmentSignalsAvailable = [input.tt1Pct, input.tt2Pct, input.seePct, input.quizPct, input.assignmentPct]
    .filter(v => v != null).length
  return input.cgpaMissing === true && assessmentSignalsAvailable === 0
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

  if (typeof input.cePct === 'number' && Number.isFinite(input.cePct)) {
    const ceMark = (input.cePct / 100) * input.policy.passRules.ceMaximum
    if (ceMark < input.policy.passRules.minimumCeMark) {
      drivers.push({
        label: `Continuous evaluation is below the pass threshold (${roundToTwo(ceMark)}/${input.policy.passRules.ceMaximum})`,
        impact: TERM_SIGNAL_WATCH_IMPACT,
        feature: 'ce',
      })
    }
  }

  if (typeof input.overallPct === 'number' && Number.isFinite(input.overallPct) && input.overallPct < input.policy.passRules.minimumOverallMark) {
    drivers.push({
      label: `Overall course mark is below the pass threshold (${roundToTwo(input.overallPct)}/${input.policy.passRules.overallMaximum})`,
      impact: TERM_SIGNAL_VERY_LOW_IMPACT,
      feature: 'overall',
    })
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

function mergeObservableDrivers(
  primary: ObservableDriver[],
  supplemental: ObservableDriver[],
): ObservableDriver[] {
  const seen = new Set<string>()
  return [...primary, ...supplemental]
    .filter(driver => {
      const key = `${driver.feature}:${driver.label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => right.impact - left.impact)
}

function inferPolicyFloorDrivers(input: ObservableInferenceInput): ObservableDriver[] {
  const { riskRules } = input.policy
  const attendanceRules = input.policy.attendanceRules ?? {
    minimumRequiredPercent: riskRules.mediumRiskAttendancePercentBelow,
    condonationFloorPercent: Math.min(riskRules.mediumRiskAttendancePercentBelow, riskRules.highRiskAttendancePercentBelow),
  }
  const passRules = input.policy.passRules ?? {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  }
  const drivers: ObservableDriver[] = []

  const mediumAttendanceFloor = Math.max(attendanceRules.minimumRequiredPercent, riskRules.mediumRiskAttendancePercentBelow)
  if (input.attendancePct < riskRules.highRiskAttendancePercentBelow) {
    drivers.push({
      label: `Attendance is below the high-risk institutional threshold (${input.attendancePct}%)`,
      impact: ATTENDANCE_HIGH_RISK_IMPACT,
      feature: 'attendance',
    })
  } else if (input.attendancePct < mediumAttendanceFloor) {
    drivers.push({
      label: `Attendance is below the institutional minimum (${input.attendancePct}% < ${mediumAttendanceFloor}%)`,
      impact: ATTENDANCE_MEDIUM_RISK_IMPACT,
      feature: 'attendance',
    })
  }

  if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.highRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the high-risk institutional threshold (${input.currentCgpa.toFixed(2)})`,
      impact: CGPA_HIGH_RISK_IMPACT,
      feature: 'cgpa',
    })
  } else if (input.cgpaMissing !== true && input.currentCgpa > 0 && input.currentCgpa < riskRules.mediumRiskCgpaBelow) {
    drivers.push({
      label: `Current CGPA is below the watch institutional threshold (${input.currentCgpa.toFixed(2)})`,
      impact: CGPA_MEDIUM_RISK_IMPACT,
      feature: 'cgpa',
    })
  }

  if (input.backlogMissing !== true && input.backlogCount >= riskRules.highRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is at the high-risk institutional threshold (${input.backlogCount})`,
      impact: BACKLOG_HIGH_RISK_IMPACT,
      feature: 'backlog',
    })
  } else if (input.backlogMissing !== true && input.backlogCount >= riskRules.mediumRiskBacklogCount) {
    drivers.push({
      label: `Active backlog count is above the watch institutional threshold (${input.backlogCount})`,
      impact: BACKLOG_MEDIUM_RISK_IMPACT,
      feature: 'backlog',
    })
  }

  if (typeof input.cePct === 'number' && Number.isFinite(input.cePct)) {
    const ceMark = (input.cePct / 100) * passRules.ceMaximum
    if (ceMark < passRules.minimumCeMark) {
      drivers.push({
        label: `Continuous evaluation is below the minimum pass mark (${roundToTwo(ceMark)}/${passRules.ceMaximum})`,
        impact: TERM_SIGNAL_WATCH_IMPACT,
        feature: 'ce',
      })
    }
  }

  if (typeof input.seePct === 'number' && Number.isFinite(input.seePct)) {
    const seeMark = (input.seePct / 100) * passRules.seeMaximum
    if (seeMark < passRules.minimumSeeMark) {
      drivers.push({
        label: `SEE mark is below the minimum pass mark (${roundToTwo(seeMark)}/${passRules.seeMaximum})`,
        impact: TERM_SIGNAL_VERY_LOW_IMPACT,
        feature: 'see',
      })
    }
  }

  if (typeof input.overallPct === 'number' && Number.isFinite(input.overallPct) && input.overallPct < passRules.minimumOverallMark) {
    drivers.push({
      label: `Overall course mark is below the minimum pass mark (${roundToTwo(input.overallPct)}/${passRules.overallMaximum})`,
      impact: TERM_SIGNAL_VERY_LOW_IMPACT,
      feature: 'overall',
    })
  }

  return drivers
}

/**
 * Tinto Absorbing State Detector
 *
 * Certain academic conditions are "absorbing states" — once entered, the
 * student's risk is effectively terminal and the additive linear model
 * underestimates the severity. This function detects:
 *   1. Catastrophic CGPA (impact === CGPA_HIGH_RISK_IMPACT)
 *   2. Massive backlogs (impact === BACKLOG_HIGH_RISK_IMPACT)
 *
 * When detected, `inferObservableRisk` clamps the probability to at least
 * RISK_BAND_HIGH_THRESHOLD, forcing a "High" band regardless of what
 * the additive sum would have been.
 */
export function evaluateCatastrophicAbsorbingState(
  drivers: Pick<ObservableDriver, 'feature' | 'impact'>[],
): boolean {
  return drivers.some(
    d =>
      (d.feature === 'cgpa' && d.impact >= CGPA_HIGH_RISK_IMPACT) ||
      (d.feature === 'backlog' && d.impact >= BACKLOG_HIGH_RISK_IMPACT),
  )
}

export function inferObservableRisk(rawInput: ObservableInferenceInput): ObservableInferenceOutput {
  // Input Hardening: sanitize probabilistic generation outputs to prevent
  // NaN/Infinity propagation through the risk computation pipeline.
  const safeNum = (v: number, fallback: number) => Number.isFinite(v) ? v : fallback
  const safePct = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? null : Math.min(100, Math.max(0, v))
  const safeCount = (v: number | null | undefined) =>
    Math.max(0, Math.round(Number.isFinite(v) ? Number(v) : 0))
  const safeScore = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? null : Math.max(-1, Math.min(1, v))
  const input: ObservableInferenceInput = {
    ...rawInput,
    attendancePct: Math.min(100, Math.max(0, safeNum(rawInput.attendancePct, 0))),
    currentCgpa: Math.min(10, Math.max(0, safeNum(rawInput.currentCgpa, 0))),
    cgpaMissing: rawInput.cgpaMissing === true || !Number.isFinite(rawInput.currentCgpa),
    backlogCount: safeCount(rawInput.backlogCount),
    backlogMissing: rawInput.backlogMissing === true || !Number.isFinite(rawInput.backlogCount),
    tt1Pct: safePct(rawInput.tt1Pct),
    tt2Pct: safePct(rawInput.tt2Pct),
    seePct: safePct(rawInput.seePct),
    cePct: safePct(rawInput.cePct),
    overallPct: safePct(rawInput.overallPct),
    quizPct: safePct(rawInput.quizPct),
    assignmentPct: safePct(rawInput.assignmentPct),
    weakCoCount: safeCount(rawInput.weakCoCount),
    attendanceHistoryRiskCount: safeCount(rawInput.attendanceHistoryRiskCount),
    questionWeaknessCount: safeCount(rawInput.questionWeaknessCount),
    interventionResponseScore: safeScore(rawInput.interventionResponseScore),
  }

  // DAF safety fallback: refuse to issue high-confidence predictions when
  // evidence is critically sparse. A student with missing CGPA and no assessment
  // scores yet has insufficient telemetry for the model to differentiate between
  // "genuinely at risk" and "data not yet entered". Issuing a false High/Medium
  // flag here would harm the student and waste teacher time.
  if (isCriticallySparseAcademicEvidence(input)) {
    return {
      riskProb: INFERENCE_BASELINE_RISK,
      riskBand: 'Low',
      recommendedAction: 'Insufficient academic evidence to assess risk; continue routine monitoring until first assessment results are available.',
      observableDrivers: [],
      attentionAreas: ['Awaiting Evidence'],
    }
  }

  const drivers = inferObservableDrivers(input)
  let riskProb = INFERENCE_BASELINE_RISK
  for (const driver of drivers) riskProb += driver.impact
  let bounded = Math.max(INFERENCE_RISK_LOWER_CLAMP, Math.min(INFERENCE_RISK_UPPER_CLAMP, roundToTwo(riskProb)))

  // Absorbing state override: if the student is in a catastrophic state
  // (very low CGPA or massive backlogs), the additive model underestimates
  // risk. Force the probability to at least the High band threshold.
  if (evaluateCatastrophicAbsorbingState(drivers)) {
    const pressureAboveBaseline = Math.max(0, riskProb - INFERENCE_BASELINE_RISK)
    const absorbingFloor = roundToTwo(
      Math.min(
        INFERENCE_RISK_UPPER_CLAMP,
        RISK_BAND_HIGH_THRESHOLD + Math.min(0.14, pressureAboveBaseline * 0.12),
      ),
    )
    bounded = Math.max(bounded, absorbingFloor)
  }
  const policyFloor = policyRiskFloorFromObservableInput(input, {
    medium: RISK_BAND_MEDIUM_THRESHOLD,
    high: RISK_BAND_HIGH_THRESHOLD,
  })
  bounded = Math.max(bounded, policyFloor.riskFloor)

  const riskBand: 'High' | 'Medium' | 'Low' = bounded >= RISK_BAND_HIGH_THRESHOLD ? 'High' : bounded >= RISK_BAND_MEDIUM_THRESHOLD ? 'Medium' : 'Low'
  const observableDrivers = riskBand === 'Low'
    ? drivers
    : mergeObservableDrivers(drivers, inferPolicyFloorDrivers(input))
  
  // Extract primary root cause (top driver) and specific attention areas
  const primaryDriver = observableDrivers.length > 0 ? observableDrivers[0] : null
  let recommendedAction = 'Continue routine monitoring on the current evidence window.'
  
  if (riskBand === 'High' || riskBand === 'Medium') {
    if (!primaryDriver) {
      recommendedAction = 'Schedule a monitored reassessment and review the current intervention plan.'
    } else {
      switch (primaryDriver.feature) {
        case 'attendance':
        case 'attendance-history':
          recommendedAction = 'Student has missed critical sessions; schedule immediate meeting to discuss absenteeism and review makeup policies.'
          break
        case 'cgpa':
        case 'backlog':
        case 'prerequisite':
          recommendedAction = 'Student carries significant backlog or CGPA pressure; focus on prerequisite recovery before introducing new complex topics.'
          break
        case 'section-pressure':
          recommendedAction = 'Review the section-level risk pattern and coordinate a focused class support plan before the next checkpoint.'
          break
        case 'coursework-gap':
          recommendedAction = 'Compare coursework and test evidence to identify whether continuous evaluation is masking exam-readiness gaps.'
          break
        case 'co':
        case 'question-pattern':
          recommendedAction = 'Review specific failing Course Outcomes (COs) and question patterns with the student to identify exact conceptual gaps.'
          break
        case 'quiz':
        case 'assignment':
          recommendedAction = 'Student is struggling with continuous coursework; review latest assignment rubrics and quiz mistakes in the next 1-on-1.'
          break
        case 'tt1':
        case 'tt2':
        case 'see':
        case 'ce':
        case 'overall':
          recommendedAction = 'Review the recent examination paper with the student to correct foundational misunderstandings before the next major assessment.'
          break
        case 'intervention-response':
          recommendedAction = 'Student is unresponsive to current support plan; escalate to course coordinator and attempt an alternative intervention strategy.'
          break
        default:
          recommendedAction = 'Immediate mentor follow-up and reassessment before the next evaluation checkpoint.'
      }
    }
  }

  const attentionAreas = Array.from(new Set(observableDrivers.map(d => {
    if (d.feature === 'attendance' || d.feature === 'attendance-history') return 'Absenteeism'
    if (d.feature === 'backlog' || d.feature === 'cgpa' || d.feature === 'prerequisite') return 'Academic Standing'
    if (d.feature === 'section-pressure') return 'Cohort Pressure'
    if (d.feature === 'coursework-gap') return 'Coursework/Test Gap'
    if (d.feature === 'co' || d.feature === 'question-pattern') return 'Conceptual Gaps'
    if (d.feature === 'quiz' || d.feature === 'assignment') return 'Coursework Discipline'
    if (d.feature === 'tt1' || d.feature === 'tt2' || d.feature === 'see' || d.feature === 'ce' || d.feature === 'overall') return 'Exam Performance'
    return 'General Support'
  })))

  return {
    riskProb: bounded,
    riskBand,
    recommendedAction,
    observableDrivers,
    attentionAreas: attentionAreas.length > 0 ? attentionAreas : undefined,
  }
}
