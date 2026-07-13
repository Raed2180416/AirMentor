/**
 * Academic risk + advisory computation — observable feature/source assembly,
 * model-or-policy risk scoring, driver/what-if narratives, transcript advisory
 * notes, playback normalization, and the professor/mentee identity helpers.
 *
 * Framework/persistence-free: operates on already-projected shapes (never
 * Drizzle rows). Moved verbatim from modules/academic.ts (structural relocation
 * only). Risk-model + graph-summary services are imported from lib as before.
 */
import type { GraphAwarePrerequisiteSummary } from '../../../lib/graph-summary.js'
import {
  buildObservableFeaturePayload,
  scoreObservableRiskWithModel,
  type ObservableSourceRefs,
} from '../../../lib/proof-risk-model.js'
import { PROOF_DEMO_OPERATIONAL_THRESHOLDS } from '../../../lib/proof-demo-operational-band.js'
import { getProofRiskModelActive } from '../../../adapters/simulation/msruas-proof-control-plane.js'
import { humanLabelForActionCode } from '../../../lib/proof-recommendation-text-generator.js'
import type { ResolvedPolicy } from '../../../modules/admin-structure.js'
import type { AssessmentScoreSnapshot } from './academic-contracts.js'
import {
  assessmentTypeMatches,
  courseFamilyForCode,
  roundToTwo,
  toUiRole,
  visibleAssessmentComponentTypesForStage,
} from './academic-utils.js'

export function filterAssessmentMapForStage(
  assessmentMap: Record<string, AssessmentScoreSnapshot>,
  stageKey: string | null | undefined,
) {
  const visibleTypes = visibleAssessmentComponentTypesForStage(stageKey)
  if (!visibleTypes) return assessmentMap
  return Object.fromEntries(
    Object.entries(assessmentMap).filter(([componentType]) => assessmentTypeMatches(componentType, visibleTypes)),
  ) as Record<string, AssessmentScoreSnapshot>
}

export function buildAcademicObservableSourceRefs(input: {
  simulationRunId: string | null
  simulationStageCheckpointId?: string | null
  studentId: string
  offeringId: string
  semesterNumber: number
  sectionCode: string
  courseCode: string
  courseTitle: string
  stageKey: string | null
  prerequisiteSummary: GraphAwarePrerequisiteSummary
  weakCourseOutcomeCodes: string[]
}): ObservableSourceRefs {
  return {
    simulationRunId: input.simulationRunId ?? 'academic-live-authoritative',
    simulationStageCheckpointId: input.simulationStageCheckpointId ?? null,
    studentId: input.studentId,
    offeringId: input.offeringId,
    semesterNumber: input.semesterNumber,
    sectionCode: input.sectionCode,
    courseCode: input.courseCode,
    courseTitle: input.courseTitle,
    courseFamily: courseFamilyForCode(input.courseCode),
    coEvidenceMode: input.weakCourseOutcomeCodes.length > 0 ? 'rubric-derived' : null,
    stageKey: input.stageKey,
    prerequisiteCourseCodes: input.prerequisiteSummary.prerequisiteCourseCodes,
    prerequisiteWeakCourseCodes: input.prerequisiteSummary.prerequisiteWeakCourseCodes,
    weakCourseOutcomeCodes: input.weakCourseOutcomeCodes,
    dominantQuestionTopics: [],
    prerequisiteCompleteness: input.prerequisiteSummary.featureCompleteness,
    featureCompleteness: input.prerequisiteSummary.featureCompleteness,
    featureConfidenceClass: input.prerequisiteSummary.featureCompleteness.confidenceClass,
  }
}

export function buildAdvisoryNotes(input: {
  currentCgpa: number
  latestBacklogCount: number
  activeBacklogCredits: number
  repeatSubjects: string[]
  progressionStatus: 'Eligible' | 'Review' | 'Hold'
  trend: 'Improving' | 'Stable' | 'Declining'
}) {
  const notes: string[] = []
  if (input.progressionStatus === 'Hold') {
    notes.push('Progression is currently on hold under the active batch policy.')
  } else if (input.progressionStatus === 'Review') {
    notes.push('Progression needs review against the active sysadmin promotion rules.')
  } else {
    notes.push('Progression remains compliant with the active batch policy.')
  }
  if (input.latestBacklogCount > 0) {
    notes.push(`${input.latestBacklogCount} active backlog${input.latestBacklogCount > 1 ? 's remain' : ' remains'} on the latest transcript (${input.activeBacklogCredits} credits).`)
  }
  if (input.repeatSubjects.length > 0) {
    notes.push(`${input.repeatSubjects.length} repeated subject${input.repeatSubjects.length > 1 ? 's appear' : ' appears'} in transcript history.`)
  }
  if (input.trend === 'Declining') {
    notes.push('Latest SGPA trend is declining and should be reviewed with the current term performance.')
  } else if (input.trend === 'Improving') {
    notes.push('Latest SGPA trend is improving compared with the previous term.')
  }
  if (input.currentCgpa === 0) {
    notes.push('Transcript history has not been published yet for this student.')
  }
  return notes
}

export function buildStudentReasons(input: {
  attendancePct: number
  tt1Raw: number | null
  tt1Max: number
  tt2Raw: number | null
  tt2Max: number
  currentCgpa: number
  quizRawTotal: number
  coScores: Array<{ coId: string; overallAttainment: number }>
}) {
  const reasons: Array<{ label: string; impact: number; feature: string }> = []
  if (input.attendancePct < 65) reasons.push({ label: `Attendance critically low (${input.attendancePct}%)`, impact: 0.34, feature: 'attendance' })
  else if (input.attendancePct < 75) reasons.push({ label: `Attendance below threshold (${input.attendancePct}%)`, impact: 0.22, feature: 'attendance' })

  const termSignals = [
    { label: 'TT1', raw: input.tt1Raw, max: input.tt1Max, feature: 'tt1' },
    { label: 'TT2', raw: input.tt2Raw, max: input.tt2Max, feature: 'tt2' },
  ].filter(signal => signal.raw !== null && signal.max > 0)
  termSignals.forEach(signal => {
    const pct = Math.round(((signal.raw ?? 0) / signal.max) * 100)
    if (pct < 40) reasons.push({ label: `Very low ${signal.label} score (${signal.raw}/${signal.max})`, impact: 0.28, feature: signal.feature })
    else if (pct < 60) reasons.push({ label: `Below-average ${signal.label} (${signal.raw}/${signal.max})`, impact: 0.16, feature: signal.feature })
  })

  if (input.currentCgpa > 0 && input.currentCgpa < 6) reasons.push({ label: `Weak CGPA (${input.currentCgpa.toFixed(2)})`, impact: 0.22, feature: 'cgpa' })
  else if (input.currentCgpa > 0 && input.currentCgpa < 7) reasons.push({ label: `Below-average CGPA (${input.currentCgpa.toFixed(2)})`, impact: 0.12, feature: 'cgpa' })

  const weakestCo = [...input.coScores].sort((left, right) => left.overallAttainment - right.overallAttainment)[0]
  if (weakestCo && weakestCo.overallAttainment < 45) {
    reasons.push({ label: `Weak ${weakestCo.coId} attainment (${roundToTwo(weakestCo.overallAttainment)}%)`, impact: 0.18, feature: 'co' })
  }

  if (input.quizRawTotal > 0 && input.quizRawTotal < 4) {
    reasons.push({ label: `Low quiz performance (${input.quizRawTotal})`, impact: 0.09, feature: 'quiz' })
  }

  return reasons.sort((left, right) => right.impact - left.impact).slice(0, 4)
}

export function buildStudentWhatIf(input: {
  riskProb: number
  attendancePct: number
  coScores: Array<{ coId: string; overallAttainment: number }>
}) {
  const scenarios: Array<{ label: string; current: string; target: string; currentRisk: number; newRisk: number }> = []
  if (input.attendancePct < 75) {
    scenarios.push({
      label: 'Improve attendance to 75%',
      current: `${input.attendancePct}%`,
      target: '75%',
      currentRisk: input.riskProb,
      newRisk: roundToTwo(Math.max(0.08, input.riskProb - 0.18)),
    })
  }
  const weakestCo = [...input.coScores]
    .filter(score => score.overallAttainment > 0)
    .sort((left, right) => left.overallAttainment - right.overallAttainment)[0]
  if (weakestCo && weakestCo.overallAttainment < 60) {
    scenarios.push({
      label: `${weakestCo.coId} attainment reaches 60%`,
      current: `${roundToTwo(weakestCo.overallAttainment)}%`,
      target: '60%',
      currentRisk: input.riskProb,
      newRisk: roundToTwo(Math.max(0.1, input.riskProb - 0.14)),
    })
  }
  return scenarios
}

export function computeRiskFromActiveModelOrPolicy(input: {
  attendancePct: number
  currentCgpa: number
  cgpaMissing?: boolean
  backlogCount: number
  backlogMissing?: boolean
  tt1Pct?: number | null
  tt2Pct?: number | null
  quizPct?: number | null
  assignmentPct?: number | null
  cePct?: number | null
  seePct?: number | null
  overallPct?: number | null
  weakCoCount?: number
  policy: ResolvedPolicy
  activeModel?: Awaited<ReturnType<typeof getProofRiskModelActive>>['production'] | null
  semesterProgress?: number
  prerequisiteSummary: GraphAwarePrerequisiteSummary
  sourceRefs?: ObservableSourceRefs | null
  // When true, re-band the calibrated overallCourseRisk through the demo
  // operational urgency thresholds. The caller must verify the offering is
  // in a proof/seeded run before passing true; live institutional data
  // must use calibrated banding.
  applyDemoOperationalBanding?: boolean
}) {
  const {
    attendancePct,
    currentCgpa,
    cgpaMissing = false,
    backlogCount,
    backlogMissing = false,
    tt1Pct = null,
    tt2Pct = null,
    quizPct = null,
    assignmentPct = null,
    cePct = null,
    seePct = null,
    overallPct = null,
    weakCoCount = 0,
    policy,
    activeModel = null,
    semesterProgress = 1,
    prerequisiteSummary,
    sourceRefs = null,
    applyDemoOperationalBanding = false,
  } = input
  const featurePayload = buildObservableFeaturePayload({
    attendancePct,
    attendanceHistory: [],
    currentCgpa,
    cgpaMissing,
    backlogCount,
    backlogMissing,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    seePct,
    weakCoCount,
    weakQuestionCount: 0,
    interventionResponseScore: null,
    prerequisiteAveragePct: prerequisiteSummary.prerequisiteAveragePct,
    prerequisiteFailureCount: prerequisiteSummary.prerequisiteFailureCount,
    prerequisiteCourseCodes: prerequisiteSummary.prerequisiteCourseCodes,
    downstreamDependencyLoad: prerequisiteSummary.downstreamDependencyLoad,
    weakPrerequisiteChainCount: prerequisiteSummary.weakPrerequisiteChainCount,
    repeatedWeakPrerequisiteFamilyCount: prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount,
    semesterNumber: sourceRefs?.semesterNumber ?? 1,
    sectionRiskRate: 0,
    semesterProgress,
  })
  // NOTE: Demo scopes bypass the trained production model and use the
  // rule-based inference engine because the current production model was
  // trained on a synthetic dataset with ~92% positive label rate (bug in
  // the old attendance simulation). Until the model is retrained with the
  // fixed generator, the inference engine provides more realistic and
  // interpretable risk bands for the demo.
  const inference = scoreObservableRiskWithModel({
    attendancePct,
    currentCgpa,
    cgpaMissing,
    backlogCount,
    backlogMissing,
    tt1Pct,
    tt2Pct,
    quizPct,
    assignmentPct,
    cePct,
    seePct,
    overallPct,
    weakCoCount,
    attendanceHistoryRiskCount: 0,
    questionWeaknessCount: 0,
    interventionResponseScore: null,
    policy,
    featurePayload,
    sourceRefs,
    productionModel: applyDemoOperationalBanding ? null : activeModel,
    bandThresholdsOverride: applyDemoOperationalBanding ? PROOF_DEMO_OPERATIONAL_THRESHOLDS : null,
  })
  return {
    riskProb: inference.riskProb,
    riskBand: inference.riskBand,
    riskCompleteness: prerequisiteSummary.featureCompleteness,
    featureCompleteness: prerequisiteSummary.featureCompleteness,
    featureProvenance: prerequisiteSummary.featureProvenance,
  }
}

const MOCK_FIRST_NAMES = ['Aarav', 'Ishita', 'Vihaan', 'Ananya', 'Advik', 'Meera', 'Reyansh', 'Kavya', 'Arjun', 'Diya', 'Krish', 'Nitya', 'Rohan', 'Saanvi', 'Dev', 'Mira', 'Kabir', 'Tara', 'Yash', 'Ira']
const MOCK_LAST_NAMES = ['Sharma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Joshi', 'Bhat', 'Rao', 'Singh', 'Krishnan', 'Menon', 'Kulkarni', 'Saxena', 'Varma']

export function mockStudentIdentity(index: number) {
  const first = MOCK_FIRST_NAMES[index % MOCK_FIRST_NAMES.length]
  const last = MOCK_LAST_NAMES[Math.floor(index / MOCK_FIRST_NAMES.length) % MOCK_LAST_NAMES.length]
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${index + 1}@msruas.ac.in`,
    phone: `9${String(700000000 + index).padStart(9, '0')}`,
  }
}

export function normalizePlaybackRiskBand(value: string | null | undefined): 'Low' | 'Medium' | 'High' {
  return value === 'High' || value === 'Medium' || value === 'Low' ? value : 'Low'
}

export function normalizePlaybackDriverRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap(driver => {
    if (!driver || typeof driver !== 'object') return []
    const row = driver as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    const feature = typeof row.feature === 'string' ? row.feature.trim() : ''
    const impact = Number(row.impact)
    if (!label || !feature || !Number.isFinite(impact)) return []
    return [{ label, feature, impact: roundToTwo(Math.abs(impact)) }]
  }).sort((left, right) => right.impact - left.impact)
}

export function toPlaybackReasonRows(
  attentionAreas: string[],
  recommendedAction: string | null,
  observableDrivers: Array<{ label: string; impact: number; feature: string }> = [],
) {
  if (observableDrivers.length > 0) {
    return observableDrivers.slice(0, 4)
  }
  if (attentionAreas.length > 0) {
    return attentionAreas.slice(0, 4).map((label, index) => ({
      label,
      impact: roundToTwo(Math.max(0.24 - (index * 0.05), 0.06)),
      feature: 'checkpoint-summary',
    }))
  }
  if (!recommendedAction) return []
  return [{
    label: `Recommended action: ${humanLabelForActionCode(recommendedAction) ?? recommendedAction}`,
    impact: 0.08,
    feature: 'checkpoint-summary',
  }]
}

export function buildProfessorProjection(input: {
  faculty: Array<{
    facultyId: string
    name: string
    initials: string
    email: string
    dept: string
    roleTitle: string
  }>
  facultyId?: string | null
  roleCode?: string | null
}) {
  const current = input.facultyId
    ? (input.faculty.find(account => account.facultyId === input.facultyId) ?? null)
    : null
  const fallback = current ?? input.faculty[0] ?? {
    facultyId: 'faculty-unassigned',
    name: 'Teaching Workspace',
    initials: 'TW',
    email: '',
    dept: 'Unassigned',
    roleTitle: 'Faculty',
  }

  return {
    name: fallback.name,
    id: fallback.facultyId,
    dept: fallback.dept,
    role: input.roleCode ? (toUiRole(input.roleCode) ?? fallback.roleTitle) : fallback.roleTitle,
    initials: fallback.initials,
    email: fallback.email,
  }
}
