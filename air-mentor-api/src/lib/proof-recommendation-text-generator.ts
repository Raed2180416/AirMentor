// Deterministic recommendation-text generator — replaces three-static-string
// inference-engine output with templated, metric-anchored, HOD-defer-aware text.
//
// Pure function module. No DB. No wall-clock. Same input -> bytewise-identical output.
//
// Rule set:
//   - HOD defer when riskBand = High AND (backlog >= 2 OR consecSevere >= 2 OR cgpa < 4.5) AND lastTier != 'strong'
//   - Mentor defer for High-band non-HoD cases; Course Leader defer for Medium/Low
//   - suggestedActions chosen by dominant weakness inferred from topDrivers[0].feature
//   - metricsSummary surfaces the 2-3 worst drivers with concrete numbers
//   - rationale is templated, filled from metrics + intervention history

import type {
  ProofInterventionActionCode,
  ProofInterventionDominantWeakness,
  RecommendationDeferTarget,
  RecommendationInterventionHistory,
  RecommendationTextInput,
  RecommendationTextOutput,
  RecommendationTopDriver,
  RecommendationTopDriverFeature,
} from './proof-intervention-response-types.js'

// ---------- Defer rule ----------

export function deriveDeferHod(input: {
  riskBand: 'High' | 'Medium' | 'Low'
  currentCgpa: number | null
  backlogCount: number | null
  interventionHistory: RecommendationInterventionHistory
}): boolean {
  if (input.riskBand !== 'High') return false
  const priorFailed = input.interventionHistory.lastTier !== null && input.interventionHistory.lastTier !== 'strong'
  if (!priorFailed && input.interventionHistory.appliedCount === 0) {
    // Never tried anything -> don't escalate yet.
    return false
  }
  const backlogHit = (input.backlogCount ?? 0) >= 2
  const severeHit = input.interventionHistory.consecutiveSevereStages >= 2
  const cgpaHit = input.currentCgpa != null && input.currentCgpa < 4.5
  return priorFailed && (backlogHit || severeHit || cgpaHit)
}

// ---------- Dominant weakness from topDrivers ----------

const FEATURE_TO_WEAKNESS: Readonly<Record<RecommendationTopDriverFeature, ProofInterventionDominantWeakness>> = {
  attendance: 'attendance',
  'attendance-history': 'attendance',
  tt1: 'exam',
  tt2: 'exam',
  see: 'exam',
  quiz: 'coursework',
  assignment: 'coursework',
  co: 'coursework',
  'question-pattern': 'coursework',
  cgpa: 'broad',
  backlog: 'broad',
  'intervention-response': 'mentoring',
}

export function deriveDominantWeakness(drivers: ReadonlyArray<RecommendationTopDriver>): ProofInterventionDominantWeakness {
  if (drivers.length === 0) return null
  const top = drivers[0]!
  return FEATURE_TO_WEAKNESS[top.feature] ?? null
}

// ---------- Action selection ----------

const WEAKNESS_TO_PRIMARY_ACTION: Readonly<Record<Exclude<ProofInterventionDominantWeakness, null>, ProofInterventionActionCode>> = {
  attendance: 'attendance_warning',
  coursework: 'targeted_remedial_plan',
  exam: 'structured_study_plan',
  broad: 'extra_academic_support_plan',
  mentoring: 'mentor_meeting',
}

function suggestedActionsFor(input: {
  riskBand: 'High' | 'Medium' | 'Low'
  weakness: ProofInterventionDominantWeakness
  deferHod: boolean
  interventionHistory: RecommendationInterventionHistory
}): ProofInterventionActionCode[] {
  if (input.deferHod) return ['hod_escalation_student_action']
  if (input.riskBand === 'High') {
    const primary = input.weakness == null
      ? 'extra_academic_support_plan'
      : WEAKNESS_TO_PRIMARY_ACTION[input.weakness]
    // If the last intervention was weak, also recommend mentor engagement.
    if (input.interventionHistory.lastTier === 'weak' || input.interventionHistory.lastTier === null) {
      return [primary, 'mentor_meeting']
    }
    return [primary]
  }
  if (input.riskBand === 'Medium') {
    if (input.interventionHistory.lastTier === 'weak') return ['mentor_meeting']
    return ['faculty_followup_reminder']
  }
  return []
}

// ---------- Defer target ----------

function deriveDeferTarget(input: {
  riskBand: 'High' | 'Medium' | 'Low'
  deferHod: boolean
}): RecommendationDeferTarget {
  if (input.deferHod) return 'HoD'
  if (input.riskBand === 'High') return 'Mentor'
  return 'Course Leader'
}

// ---------- Metrics summary ----------

function formatMetric(value: number | null, suffix: string, label: string, precision = 0): string | null {
  if (value == null) return null
  const formatted = precision > 0 ? value.toFixed(precision) : Math.round(value).toString()
  return `${label} ${formatted}${suffix}`
}

function metricsSummaryString(input: RecommendationTextInput): string {
  const parts: Array<string | null> = []
  // Pull from topDrivers first — they are pre-ranked by impact — but also include CGPA
  // and backlog when present because they're always demo-relevant.
  const driverFeatures = new Set(input.topDrivers.slice(0, 3).map(d => d.feature))
  if (driverFeatures.has('attendance') || driverFeatures.has('attendance-history')) {
    parts.push(formatMetric(input.attendancePct, '%', 'attendance'))
  }
  if (driverFeatures.has('tt1')) parts.push(formatMetric(input.tt1Pct, '%', 'TT1'))
  if (driverFeatures.has('tt2')) parts.push(formatMetric(input.tt2Pct, '%', 'TT2'))
  if (driverFeatures.has('see')) parts.push(formatMetric(input.seePct, '%', 'SEE'))
  if (input.currentCgpa != null) parts.push(formatMetric(input.currentCgpa, '', 'CGPA', 2))
  if (input.backlogCount != null && input.backlogCount > 0) {
    parts.push(`backlog ${input.backlogCount}`)
  }
  const cleaned = parts.filter((piece): piece is string => piece !== null)
  return cleaned.length > 0 ? cleaned.join(', ') : 'no critical metrics flagged'
}

// ---------- Headline ----------

function headlineFor(input: {
  riskBand: 'High' | 'Medium' | 'Low'
  stageKey: RecommendationTextInput['stageKey']
  semesterNumber: number
  deferHod: boolean
  interventionHistory: RecommendationInterventionHistory
  weakness: ProofInterventionDominantWeakness
}): string {
  if (input.deferHod) {
    return `Escalate to HoD: repeated severe risk despite ${input.interventionHistory.appliedCount} prior intervention${input.interventionHistory.appliedCount === 1 ? '' : 's'}`
  }
  if (input.riskBand === 'High') {
    const weaknessLabel =
      input.weakness === 'attendance' ? 'attendance crisis' :
      input.weakness === 'coursework' ? 'coursework weakness' :
      input.weakness === 'exam' ? 'exam-performance drop' :
      input.weakness === 'mentoring' ? 'disengagement' :
      'compounded academic risk'
    return `High-risk action required: ${weaknessLabel} at semester ${input.semesterNumber} ${input.stageKey}`
  }
  if (input.riskBand === 'Medium') {
    return `Watch list: monitored reassessment at ${input.stageKey}`
  }
  return `On track: routine monitoring at ${input.stageKey}`
}

// ---------- Rationale ----------

function rationaleFor(input: {
  output: Omit<RecommendationTextOutput, 'rationale'>
  fullInput: RecommendationTextInput
}): string {
  const { output, fullInput } = input
  const history = fullInput.interventionHistory
  const weaknessTxt =
    output.dominantWeakness === 'attendance' ? 'Attendance is the primary risk signal.' :
    output.dominantWeakness === 'coursework' ? 'Coursework performance is driving the risk.' :
    output.dominantWeakness === 'exam' ? 'Exam-style assessments are driving the risk.' :
    output.dominantWeakness === 'mentoring' ? 'Post-intervention response is the primary risk signal.' :
    output.dominantWeakness === 'broad' ? 'Multiple signals indicate broad academic struggle.' :
    'The current evidence window shows a low-concern profile.'

  if (output.deferHodFlag) {
    const priorTier = history.lastTier ?? 'unknown'
    return [
      `High-risk pattern persists across ${history.consecutiveSevereStages} consecutive stage${history.consecutiveSevereStages === 1 ? '' : 's'}.`,
      weaknessTxt,
      `Prior intervention outcome: ${priorTier}. Outcome indicates escalation path.`,
      `Escalate to Head of Department for a corrective plan. Metrics: ${output.metricsSummary}.`,
    ].join(' ')
  }
  if (fullInput.riskBand === 'High') {
    const applied = history.appliedCount
    const priorNote = applied === 0
      ? 'No prior intervention has been applied this semester.'
      : `Prior interventions applied: ${applied}${history.lastTier ? `; last outcome ${history.lastTier} tier` : ''}.`
    return [
      `High-risk status at semester ${fullInput.semesterNumber} ${fullInput.stageKey}.`,
      weaknessTxt,
      priorNote,
      `Suggested next step targets the dominant weakness. Metrics: ${output.metricsSummary}.`,
    ].join(' ')
  }
  if (fullInput.riskBand === 'Medium') {
    return [
      `Medium-risk watch at ${fullInput.stageKey}.`,
      weaknessTxt,
      `Metrics: ${output.metricsSummary}. Schedule a monitored reassessment before the next evaluation window.`,
    ].join(' ')
  }
  return `Low-risk profile at ${fullInput.stageKey}. Continue routine monitoring. Metrics: ${output.metricsSummary}.`
}

// ---------- Entry point ----------

export function generateRecommendationText(input: RecommendationTextInput): RecommendationTextOutput {
  const deferHodFlag = deriveDeferHod({
    riskBand: input.riskBand,
    currentCgpa: input.currentCgpa,
    backlogCount: input.backlogCount,
    interventionHistory: input.interventionHistory,
  })
  const dominantWeakness = deriveDominantWeakness(input.topDrivers)
  const suggestedActions = suggestedActionsFor({
    riskBand: input.riskBand,
    weakness: dominantWeakness,
    deferHod: deferHodFlag,
    interventionHistory: input.interventionHistory,
  })
  const deferTo = deriveDeferTarget({ riskBand: input.riskBand, deferHod: deferHodFlag })
  const metricsSummary = metricsSummaryString(input)
  const headline = headlineFor({
    riskBand: input.riskBand,
    stageKey: input.stageKey,
    semesterNumber: input.semesterNumber,
    deferHod: deferHodFlag,
    interventionHistory: input.interventionHistory,
    weakness: dominantWeakness,
  })
  const partial = {
    headline,
    suggestedActions,
    metricsSummary,
    deferTo,
    deferHodFlag,
    dominantWeakness,
  }
  const rationale = rationaleFor({ output: partial, fullInput: input })
  return { ...partial, rationale }
}
