import { createHash } from 'node:crypto'
import {
  simulationQuestionTemplates,
  studentCoStates,
  studentQuestionResults,
} from '../db/schema.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'
import {
  buildGraphAwarePrerequisiteSummary,
  buildMissingGraphAwarePrerequisiteSummary,
} from './graph-summary.js'
import { parseJson } from './json.js'
import type {
  PlaybackStageKey,
  PolicyPhenotype,
  StageCourseProjectionSource,
  StageEvidenceSnapshot,
} from './msruas-proof-control-plane.js'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function roundToFour(value: number) {
  return Math.round(value * 10000) / 10000
}

function safePct(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return clamp(roundToTwo(value), 0, 100)
}

function addDaysIso(isoString: string, days: number) {
  const date = new Date(isoString)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function buildDeterministicId(prefix: string, parts: Array<string | number>) {
  return `${prefix}_${createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 24)}`
}

export function dominantCoEvidenceMode(rows: Array<typeof studentCoStates.$inferSelect>) {
  const counts = new Map<string, number>()
  rows.forEach(row => {
    const state = parseJson(row.stateJson, {} as Record<string, unknown>)
    const mode = String(state.coEvidenceMode ?? 'fallback-simulated')
    counts.set(mode, (counts.get(mode) ?? 0) + 1)
  })
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'fallback-simulated'
}

export function toInterventionResponse(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return {
    interventionType: String(record.interventionType ?? 'support'),
    accepted: Boolean(record.accepted ?? false),
    completed: Boolean(record.completed ?? false),
    recoveryConfirmed: Boolean(record.recoveryConfirmed ?? false),
    residual: record.residual == null ? null : Number(record.residual),
  }
}

export function playbackCheckpointNowIso(runCreatedAt: string, semesterNumber: number, stage: { semesterDayOffset: number }) {
  return addDaysIso(runCreatedAt, ((semesterNumber - 1) * 140) + stage.semesterDayOffset)
}

export function stageCourseworkEvidenceForStage(input: {
  stageKey: PlaybackStageKey
  quizPct: number | null
  assignmentPct: number | null
}) {
  if (input.stageKey === 'pre-tt1' || input.stageKey === 'post-tt1') {
    return {
      quizPct: null,
      assignmentPct: null,
    }
  }
  return {
    quizPct: input.quizPct == null ? null : safePct(input.quizPct),
    assignmentPct: input.assignmentPct == null ? null : safePct(input.assignmentPct),
  }
}

function attendanceCheckpointCountForStage(stageKey: PlaybackStageKey) {
  switch (stageKey) {
    case 'pre-tt1':
      return 1
    case 'post-tt1':
      return 2
    case 'post-tt2':
      return 3
    case 'post-assignments':
    case 'post-see':
      return 4
  }
}

export function includedAttendanceForSourceStage(source: StageCourseProjectionSource, stageKey: PlaybackStageKey) {
  return source.attendanceHistory.slice(0, attendanceCheckpointCountForStage(stageKey))
}

function questionComponentsForStage(stageKey: PlaybackStageKey) {
  switch (stageKey) {
    case 'pre-tt1':
      return [] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-tt1':
      return ['tt1'] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-tt2':
    case 'post-assignments':
      return ['tt1', 'tt2'] as Array<'tt1' | 'tt2' | 'see'>
    case 'post-see':
      return ['tt1', 'tt2', 'see'] as Array<'tt1' | 'tt2' | 'see'>
  }
}

function summarizeCoRows(rows: Array<typeof studentCoStates.$inferSelect>) {
  return rows
    .map(row => {
      const state = parseJson(row.stateJson, {} as Record<string, unknown>)
      const scoreHistory = parseJson(
        JSON.stringify(state.coObservedScoreHistory ?? {}),
        { tt1Pct: 0, tt2Pct: 0, seePct: 0 },
      ) as { tt1Pct: number; tt2Pct: number; seePct: number }
      return {
        coCode: row.coCode,
        coTitle: row.coTitle,
        trend: String(state.coTrend ?? 'flat'),
        topics: parseJson(JSON.stringify(state.topics ?? []), [] as string[]),
        evidenceMode: String(state.coEvidenceMode ?? 'fallback-simulated'),
        tt1Pct: Number(scoreHistory.tt1Pct ?? 0),
        tt2Pct: Number(scoreHistory.tt2Pct ?? 0),
        seePct: Number(scoreHistory.seePct ?? 0),
        transferGap: Number(state.coTransferGap ?? 0),
      }
    })
    .sort((left, right) => {
      const leftStrength = Math.min(left.tt2Pct, left.seePct)
      const rightStrength = Math.min(right.tt2Pct, right.seePct)
      return leftStrength - rightStrength || left.coCode.localeCompare(right.coCode)
    })
}

export function summarizeQuestionPatterns(input: {
  rows: Array<typeof studentQuestionResults.$inferSelect>
  templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
}) {
  const weakTopicCounts = new Map<string, number>()
  const weakCoCounts = new Map<string, number>()
  let weakQuestionCount = 0
  let carelessErrorCount = 0
  let transferGapCount = 0

  input.rows.forEach(row => {
    const result = parseJson(row.resultJson, {} as Record<string, unknown>)
    const template = input.templatesById.get(row.simulationQuestionTemplateId)
    const score = Number(result.studentScoreOnQuestion ?? row.score)
    const maxScore = Number(row.maxScore)
    const errorType = String(result.errorTypeObserved ?? 'clean')
    if (errorType === 'careless-error') carelessErrorCount += 1
    if (errorType === 'transfer-gap') transferGapCount += 1
    if (maxScore > 0 && (score / maxScore) < 0.4) {
      weakQuestionCount += 1
      const topics = parseJson(template?.topicTagsJson ?? '[]', [] as string[])
      const cos = parseJson(template?.coTagsJson ?? '[]', [] as string[])
      topics.forEach(topic => weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1))
      cos.forEach(coCode => weakCoCounts.set(coCode, (weakCoCounts.get(coCode) ?? 0) + 1))
    }
  })

  const rankMap = (source: Map<string, number>) => [...source.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([label]) => label)

  return {
    weakQuestionCount,
    carelessErrorCount,
    transferGapCount,
    commonWeakTopics: rankMap(weakTopicCounts),
    commonWeakCourseOutcomes: rankMap(weakCoCounts),
  }
}

function stageWeakCourseOutcomes(rows: Array<typeof studentCoStates.$inferSelect>, stageKey: PlaybackStageKey) {
  return summarizeCoRows(rows)
    .filter(row => {
      if (stageKey === 'pre-tt1') return false
      if (stageKey === 'post-tt1') return row.tt1Pct < 45
      if (stageKey === 'post-tt2') return row.tt2Pct < 45
      if (stageKey === 'post-assignments') return row.tt2Pct < 45
      return Math.min(row.tt2Pct || 100, row.seePct || 100) < 45 || row.seePct < 45
    })
    .slice(0, 6)
}

function pickInterventionResponseForStage(response: StageCourseProjectionSource['interventionResponse'], stageKey: PlaybackStageKey) {
  if (!response) return null
  if (stageKey === 'pre-tt1' || stageKey === 'post-tt1') return null
  return response.residual
}

function counterfactualAdjustment(actionTaken: string | null) {
  if (!actionTaken) {
    return {
      attendancePenalty: 0,
      tt2Penalty: 0,
      seePenalty: 0,
      weakSignalPenalty: 0,
      consistencyBuff: 0,
    }
  }
  switch (actionTaken) {
    case 'attendance-recovery-follow-up':
      return { attendancePenalty: 8, tt2Penalty: 0, seePenalty: 0, weakSignalPenalty: 0, consistencyBuff: 0.04 }
    case 'targeted-tutoring':
      return { attendancePenalty: 0, tt2Penalty: 14, seePenalty: 10, weakSignalPenalty: 2, consistencyBuff: 0.15 }
    case 'prerequisite-bridge':
      return { attendancePenalty: 0, tt2Penalty: 10, seePenalty: 8, weakSignalPenalty: 2, consistencyBuff: 0.08 }
    case 'mentor-check-in':
      return { attendancePenalty: 0, tt2Penalty: 4, seePenalty: 3, weakSignalPenalty: 0, consistencyBuff: 0.06 }
    case 'structured-study-plan':
      return { attendancePenalty: 0, tt2Penalty: 8, seePenalty: 6, weakSignalPenalty: 2, consistencyBuff: 0.20 }
    default:
      return { attendancePenalty: 0, tt2Penalty: 3, seePenalty: 2, weakSignalPenalty: 0, consistencyBuff: 0.02 }
  }
}

export function mapActionToTaskType(actionTaken: string | null) {
  switch (actionTaken) {
    case 'attendance-recovery-follow-up':
      return 'Attendance'
    case 'prerequisite-bridge':
      return 'Remedial'
    case 'faculty-outreach':
    case 'mentor-outreach':
    case 'outreach-plus-tutoring':
    case 'pre-see-rescue':
    case 'mentor-check-in':
      return 'Follow-up'
    case 'targeted-tutoring':
    case 'structured-study-plan':
      return 'Academic'
    default:
      return 'Follow-up'
  }
}

type PolicyActionCode =
  | 'no-action'
  | 'alert-only'
  | 'faculty-outreach'
  | 'mentor-outreach'
  | 'attendance-recovery-follow-up'
  | 'prerequisite-bridge'
  | 'targeted-tutoring'
  | 'structured-study-plan'
  | 'outreach-plus-tutoring'
  | 'pre-see-rescue'
  | 'mentor-check-in'

type PolicyPhenotypeAnalysis = {
  policyPhenotype: PolicyPhenotype
  attendanceDominant: boolean
  prerequisiteDominant: boolean
  academicWeakness: boolean
  persistentNonresponse: boolean
  lateSemesterAcute: boolean
  diffuseAmber: boolean
}

type ActionPolicyCandidate = {
  action: PolicyActionCode
  utility: number
  nextCheckpointBenefitScaled: number
  stableRecoveryScore: number
  semesterCloseBenefitScaled: number
  relapsePenalty: number
  capacityCost: number
  rationale: string
}

function capacityCostForAction(action: PolicyActionCode) {
  switch (action) {
    case 'outreach-plus-tutoring':
      return 0.95
    case 'pre-see-rescue':
      return 0.82
    case 'targeted-tutoring':
    case 'prerequisite-bridge':
      return 0.68
    case 'mentor-outreach':
    case 'mentor-check-in':
      return 0.54
    case 'attendance-recovery-follow-up':
    case 'faculty-outreach':
      return 0.36
    case 'structured-study-plan':
      return 0.22
    case 'alert-only':
      return 0.12
    case 'no-action':
    default:
      return 0
  }
}

function availablePolicyActionsForStage(stageKey: PlaybackStageKey) {
  const base: PolicyActionCode[] = [
    'no-action',
    'alert-only',
    'faculty-outreach',
    'mentor-outreach',
    'attendance-recovery-follow-up',
    'prerequisite-bridge',
    'targeted-tutoring',
    'structured-study-plan',
    'outreach-plus-tutoring',
  ]
  if (stageKey === 'post-tt2' || stageKey === 'post-assignments' || stageKey === 'post-see') {
    base.push('pre-see-rescue')
  }
  return base
}

function lowAcademicEvidence(evidence: {
  weakCoCount: number
  weakQuestionCount: number
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
}) {
  return evidence.weakCoCount >= 2
    || evidence.weakQuestionCount >= 4
    || (evidence.tt1Pct != null && evidence.tt1Pct < 50)
    || (evidence.tt2Pct != null && evidence.tt2Pct < 50)
    || (evidence.seePct != null && evidence.seePct < 50)
}

export function classifyPolicyPhenotype(input: {
  stageKey: PlaybackStageKey
  evidence: StageEvidenceSnapshot
  riskBand: 'High' | 'Medium' | 'Low'
  prerequisiteSummary: {
    prerequisiteAveragePct: number
    prerequisiteFailureCount: number
    prerequisiteWeakCourseCodes: string[]
    downstreamDependencyLoad: number
    weakPrerequisiteChainCount: number
    repeatedWeakPrerequisiteFamilyCount: number
  }
}): PolicyPhenotypeAnalysis {
  const attendanceDominant = input.evidence.attendancePct < 75 || input.evidence.attendanceHistoryRiskCount >= 2
  const persistentNonresponse = (input.evidence.interventionResponseScore ?? 0) < -0.03
  const lateSemesterAcute = input.riskBand === 'High' && (
    input.stageKey === 'post-tt2' || input.stageKey === 'post-assignments' || input.stageKey === 'post-see'
  )
  const prerequisiteDominant = (
    input.prerequisiteSummary.prerequisiteFailureCount > 0
    || (input.prerequisiteSummary.prerequisiteWeakCourseCodes.length > 0 && input.prerequisiteSummary.prerequisiteAveragePct < 55)
    || input.prerequisiteSummary.weakPrerequisiteChainCount >= 2
    || input.prerequisiteSummary.repeatedWeakPrerequisiteFamilyCount > 0
  ) && (
    input.evidence.backlogCount > 0
    || lowAcademicEvidence(input.evidence)
  )
  const academicWeakness = input.evidence.attendancePct >= 75
    && !prerequisiteDominant
    && !lateSemesterAcute
    && lowAcademicEvidence(input.evidence)
  const diffuseAmber = input.riskBand === 'Medium'
    && !lateSemesterAcute
    && !persistentNonresponse
    && !prerequisiteDominant
    && !academicWeakness
    && !attendanceDominant

  if (lateSemesterAcute) {
    return {
      policyPhenotype: 'late-semester-acute',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute: true,
      diffuseAmber,
    }
  }
  if (persistentNonresponse) {
    return {
      policyPhenotype: 'persistent-nonresponse',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse: true,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (prerequisiteDominant) {
    return {
      policyPhenotype: 'prerequisite-dominant',
      attendanceDominant,
      prerequisiteDominant: true,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (academicWeakness) {
    return {
      policyPhenotype: 'academic-weakness',
      attendanceDominant,
      prerequisiteDominant,
      academicWeakness: true,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  if (attendanceDominant) {
    return {
      policyPhenotype: 'attendance-dominant',
      attendanceDominant: true,
      prerequisiteDominant,
      academicWeakness,
      persistentNonresponse,
      lateSemesterAcute,
      diffuseAmber,
    }
  }
  return {
    policyPhenotype: 'diffuse-amber',
    attendanceDominant,
    prerequisiteDominant,
    academicWeakness,
    persistentNonresponse,
    lateSemesterAcute,
    diffuseAmber: true,
  }
}

export function buildActionPolicyComparison(input: {
  stageKey: PlaybackStageKey
  evidence: StageEvidenceSnapshot
  riskBand: 'High' | 'Medium' | 'Low'
  recommendedAction: string
  prerequisiteSummary: {
    prerequisiteAveragePct: number
    prerequisiteFailureCount: number
    prerequisiteWeakCourseCodes: string[]
    downstreamDependencyLoad: number
    weakPrerequisiteChainCount: number
    repeatedWeakPrerequisiteFamilyCount: number
  }
}) {
  const phenotype = classifyPolicyPhenotype(input)
  const attendanceDominant = phenotype.attendanceDominant
  const academicWeakness = phenotype.academicWeakness
  const prerequisitePressure = phenotype.prerequisiteDominant
  const nonresponsePressure = phenotype.persistentNonresponse
  const lateSemesterAcute = phenotype.lateSemesterAcute
  const diffuseAmber = phenotype.diffuseAmber

  const scoreAction = (action: PolicyActionCode): ActionPolicyCandidate => {
    let nextCheckpointBenefitScaled = 0
    let stableRecoveryScore = 0
    let semesterCloseBenefitScaled = 0
    let relapsePenalty = 0
    const rationale: string[] = []

    if (action === 'no-action') {
      relapsePenalty = input.riskBand === 'High' ? 0.42 : input.riskBand === 'Medium' ? 0.18 : 0.04
      rationale.push('No intervention applied.')
    }
    if (action === 'alert-only') {
      nextCheckpointBenefitScaled += input.riskBand === 'High' ? 2 : 1
      stableRecoveryScore += diffuseAmber ? 0.08 : 0.04
      relapsePenalty += attendanceDominant || prerequisitePressure ? 0.22 : 0.12
      rationale.push('Low-touch alert route.')
    }
    if (action === 'faculty-outreach') {
      nextCheckpointBenefitScaled += attendanceDominant ? 5 : 2
      stableRecoveryScore += attendanceDominant ? 0.16 : 0.08
      semesterCloseBenefitScaled += attendanceDominant ? 3 : 1
      relapsePenalty += nonresponsePressure ? 0.12 : 0.06
      rationale.push('Faculty outreach addresses attendance or momentum drift.')
    }
    if (action === 'mentor-outreach' || action === 'mentor-check-in') {
      nextCheckpointBenefitScaled += input.riskBand === 'High' ? 6 : 3
      stableRecoveryScore += nonresponsePressure ? 0.18 : 0.12
      semesterCloseBenefitScaled += input.riskBand === 'High' ? 4 : 2
      relapsePenalty += attendanceDominant ? 0.08 : 0.04
      rationale.push('Mentor-led follow-up supports persistent or volatile risk.')
    }
    if (action === 'attendance-recovery-follow-up') {
      nextCheckpointBenefitScaled += attendanceDominant ? 10 : 1
      stableRecoveryScore += attendanceDominant ? 0.24 : 0.04
      semesterCloseBenefitScaled += attendanceDominant ? 6 : 1
      relapsePenalty += attendanceDominant ? 0.04 : 0.16
      rationale.push('Attendance pressure is the dominant failure mode.')
    }
    if (action === 'prerequisite-bridge') {
      nextCheckpointBenefitScaled += prerequisitePressure ? 8 : 2
      stableRecoveryScore += prerequisitePressure ? 0.22 : 0.06
      semesterCloseBenefitScaled += prerequisitePressure ? 7 : 2
      relapsePenalty += prerequisitePressure ? 0.06 : 0.16
      rationale.push('Carryover and prerequisite weakness need bridge support.')
    }
    if (action === 'targeted-tutoring') {
      nextCheckpointBenefitScaled += academicWeakness ? 11 : 3
      stableRecoveryScore += academicWeakness ? 0.28 : 0.1
      semesterCloseBenefitScaled += academicWeakness ? 8 : 3
      relapsePenalty += nonresponsePressure ? 0.12 : 0.05
      rationale.push('Weak CO/question evidence points to targeted tutoring.')
    }
    if (action === 'structured-study-plan') {
      nextCheckpointBenefitScaled += diffuseAmber ? 5 : 2
      stableRecoveryScore += diffuseAmber ? 0.16 : 0.08
      semesterCloseBenefitScaled += diffuseAmber ? 4 : 2
      relapsePenalty += academicWeakness || prerequisitePressure ? 0.18 : 0.08
      rationale.push('Diffuse medium risk without one dominant failure mode.')
    }
    if (action === 'outreach-plus-tutoring') {
      nextCheckpointBenefitScaled += academicWeakness ? 12 : 4
      stableRecoveryScore += (academicWeakness && nonresponsePressure) ? 0.3 : 0.14
      semesterCloseBenefitScaled += academicWeakness ? 9 : 4
      relapsePenalty += nonresponsePressure ? 0.08 : 0.04
      rationale.push('Combined outreach and tutoring addresses persistent academic risk.')
    }
    if (action === 'pre-see-rescue') {
      nextCheckpointBenefitScaled += lateSemesterAcute ? 13 : 2
      stableRecoveryScore += lateSemesterAcute ? 0.22 : 0.04
      semesterCloseBenefitScaled += lateSemesterAcute ? 10 : 1
      relapsePenalty += lateSemesterAcute ? 0.12 : 0.2
      rationale.push('Late-semester rescue is appropriate for acute endgame risk.')
    }

    if (attendanceDominant && !['attendance-recovery-follow-up', 'faculty-outreach', 'mentor-outreach', 'outreach-plus-tutoring'].includes(action)) {
      relapsePenalty += 0.1
    }
    if (prerequisitePressure && !['prerequisite-bridge', 'outreach-plus-tutoring'].includes(action)) {
      relapsePenalty += 0.08
    }
    if (academicWeakness && !['targeted-tutoring', 'outreach-plus-tutoring', 'pre-see-rescue'].includes(action)) {
      relapsePenalty += 0.07
    }

    switch (phenotype.policyPhenotype) {
      case 'late-semester-acute':
        if (action === 'pre-see-rescue') {
          nextCheckpointBenefitScaled += 4
          stableRecoveryScore += 0.08
          semesterCloseBenefitScaled += 3
        }
        break
      case 'persistent-nonresponse':
        if (action === 'outreach-plus-tutoring') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.08
        }
        if (action === 'mentor-outreach') {
          nextCheckpointBenefitScaled += 2
          stableRecoveryScore += 0.05
        }
        break
      case 'prerequisite-dominant':
        if (action === 'prerequisite-bridge') {
          nextCheckpointBenefitScaled += 4
          stableRecoveryScore += 0.06
          semesterCloseBenefitScaled += 3
        }
        if (action === 'targeted-tutoring') relapsePenalty += 0.05
        break
      case 'academic-weakness':
        if (action === 'targeted-tutoring') {
          nextCheckpointBenefitScaled += 5
          stableRecoveryScore += 0.08
          semesterCloseBenefitScaled += 4
        }
        if (action === 'structured-study-plan') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.06
          semesterCloseBenefitScaled += 3
        }
        break
      case 'attendance-dominant':
        if (action === 'attendance-recovery-follow-up') {
          nextCheckpointBenefitScaled += 3
          stableRecoveryScore += 0.05
          semesterCloseBenefitScaled += 2
        }
        if (action === 'faculty-outreach') stableRecoveryScore += 0.03
        break
      case 'diffuse-amber':
      default:
        if (action === 'structured-study-plan') {
          nextCheckpointBenefitScaled += 2
          stableRecoveryScore += 0.04
        }
        break
    }

    const capacityCost = capacityCostForAction(action)
    const utility = roundToFour(
      (0.35 * (nextCheckpointBenefitScaled / 10))
      + (0.35 * stableRecoveryScore)
      + (0.2 * (semesterCloseBenefitScaled / 10))
      - (0.05 * relapsePenalty)
      - (0.05 * capacityCost),
    )
    return {
      action,
      utility,
      nextCheckpointBenefitScaled: roundToFour(nextCheckpointBenefitScaled),
      stableRecoveryScore: roundToFour(stableRecoveryScore),
      semesterCloseBenefitScaled: roundToFour(semesterCloseBenefitScaled),
      relapsePenalty: roundToFour(relapsePenalty),
      capacityCost: roundToFour(capacityCost),
      rationale: rationale.join(' '),
    }
  }

  const candidates = availablePolicyActionsForStage(input.stageKey).map(scoreAction)
    .sort((left, right) => right.utility - left.utility || left.action.localeCompare(right.action))
  const bestCandidate = candidates[0] ?? null
  const noAction = candidates.find(candidate => candidate.action === 'no-action') ?? null
  const recommendedAction = input.riskBand === 'Low'
    || /routine monitoring/i.test(input.recommendedAction)
    || !bestCandidate
    || bestCandidate.action === 'no-action'
    || (noAction && bestCandidate.utility <= noAction.utility)
    ? null
    : bestCandidate.action

  return {
    policyPhenotype: phenotype.policyPhenotype,
    recommendedAction,
    candidates,
    policyRationale: bestCandidate?.rationale ?? 'Routine monitoring only.',
  }
}

export function buildStageEvidenceSnapshot(input: {
  source: StageCourseProjectionSource
  stageKey: PlaybackStageKey
  policy: ResolvedPolicy
  templatesById: Map<string, typeof simulationQuestionTemplates.$inferSelect>
}) {
  const includedAttendance = input.source.attendanceHistory.slice(0, attendanceCheckpointCountForStage(input.stageKey))
  const latestAttendance = includedAttendance[includedAttendance.length - 1]
  const weakCourseOutcomes = stageWeakCourseOutcomes(input.source.coRows, input.stageKey)
  const questionRows = input.source.questionRows.filter(row => questionComponentsForStage(input.stageKey).includes(row.componentType as 'tt1' | 'tt2' | 'see'))
  const questionPatterns = summarizeQuestionPatterns({
    rows: questionRows,
    templatesById: input.templatesById,
  })
  const courseworkEvidence = stageCourseworkEvidenceForStage({
    stageKey: input.stageKey,
    quizPct: input.source.quizPct,
    assignmentPct: input.source.assignmentPct,
  })
  const snapshot: StageEvidenceSnapshot = {
    attendancePct: latestAttendance?.attendancePct ?? input.source.attendancePct,
    tt1Pct: (input.stageKey === 'post-tt1' || input.stageKey === 'post-tt2' || input.stageKey === 'post-assignments' || input.stageKey === 'post-see')
      ? input.source.tt1Pct
      : null,
    tt2Pct: (input.stageKey === 'post-tt2' || input.stageKey === 'post-assignments' || input.stageKey === 'post-see')
      ? input.source.tt2Pct
      : null,
    quizPct: courseworkEvidence.quizPct,
    assignmentPct: courseworkEvidence.assignmentPct,
    seePct: input.stageKey === 'post-see'
      ? input.source.seePct
      : null,
    weakCoCount: weakCourseOutcomes.length,
    weakQuestionCount: questionPatterns.weakQuestionCount,
    attentionAreas: [],
    attendanceHistoryRiskCount: includedAttendance.filter(entry => entry.attendancePct < input.policy.attendanceRules.minimumRequiredPercent).length,
    currentCgpa: input.stageKey === 'post-see' ? input.source.closingCgpa : input.source.previousCgpa,
    backlogCount: input.stageKey === 'post-see' ? input.source.closingBacklogCount : input.source.previousBacklogCount,
    interventionResponseScore: pickInterventionResponseForStage(input.source.interventionResponse, input.stageKey),
    evidenceWindow: `${input.source.semesterNumber}-${input.stageKey}`,
    weakCourseOutcomes,
    questionPatterns,
  }
  return snapshot
}

export function buildNoActionSnapshot(input: {
  evidence: StageEvidenceSnapshot
  actionTaken: string | null
  stageKey: PlaybackStageKey
}) {
  if (!input.actionTaken || (input.stageKey !== 'post-tt2' && input.stageKey !== 'post-assignments' && input.stageKey !== 'post-see')) {
    return {
      ...input.evidence,
      interventionResponseScore: input.evidence.interventionResponseScore == null ? null : Math.min(input.evidence.interventionResponseScore, 0),
    }
  }
  const adjustment = counterfactualAdjustment(input.actionTaken)
  return {
    ...input.evidence,
    attendancePct: clamp(input.evidence.attendancePct - adjustment.attendancePenalty, 0, 100),
    tt2Pct: input.evidence.tt2Pct == null ? null : clamp(input.evidence.tt2Pct - adjustment.tt2Penalty, 0, 100),
    seePct: input.evidence.seePct == null ? null : clamp(input.evidence.seePct - adjustment.seePenalty, 0, 100),
    weakCoCount: input.evidence.weakCoCount + adjustment.weakSignalPenalty,
    weakQuestionCount: input.evidence.weakQuestionCount + adjustment.weakSignalPenalty,
    interventionResponseScore: input.evidence.interventionResponseScore == null ? -0.05 : Math.min(input.evidence.interventionResponseScore - adjustment.consistencyBuff, -0.02),
  }
}

function courseDisciplineFamily(courseCode: string) {
  const normalized = courseCode.trim().toUpperCase()
  const match = normalized.match(/^[A-Z]+/)
  return match?.[0] ?? (normalized || 'GENERAL')
}

export function prerequisiteSummaryForSource(input: {
  source: StageCourseProjectionSource
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  prerequisiteNodeIdsByTargetNodeId: Map<string, string[]>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
  curriculumImportVersionId?: string | null
  curriculumFeatureProfileFingerprint?: string | null
}) {
  const nodeCourseCodeByNodeId = new Map<string, string>()
  for (const row of input.sourceByStudentNodeId.values()) {
    if (!row.curriculumNodeId) continue
    nodeCourseCodeByNodeId.set(row.curriculumNodeId, row.courseCode.trim().toUpperCase())
  }
  const prerequisiteGraphByGraphKey = new Map<string, string[]>()
  for (const [targetNodeId, prerequisiteNodeIds] of input.prerequisiteNodeIdsByTargetNodeId.entries()) {
    const targetCourseCode = nodeCourseCodeByNodeId.get(targetNodeId)
    if (!targetCourseCode) continue
    const prerequisiteCourseCodes = Array.from(new Set(prerequisiteNodeIds
      .map((nodeId: string) => nodeCourseCodeByNodeId.get(nodeId))
      .filter((value: string | undefined): value is string => !!value)))
    prerequisiteGraphByGraphKey.set(targetCourseCode, prerequisiteCourseCodes)
  }
  const downstreamGraphByGraphKey = new Map<string, string[]>()
  for (const [sourceNodeId, downstreamNodeIds] of input.downstreamNodeIdsBySourceNodeId.entries()) {
    const sourceCourseCode = nodeCourseCodeByNodeId.get(sourceNodeId)
    if (!sourceCourseCode) continue
    const downstreamCourseCodes = Array.from(new Set(downstreamNodeIds
      .map((nodeId: string) => nodeCourseCodeByNodeId.get(nodeId))
      .filter((value: string | undefined): value is string => !!value)))
    downstreamGraphByGraphKey.set(sourceCourseCode, downstreamCourseCodes)
  }
  const sourceByHistoricalKey = new Map<string, StageCourseProjectionSource>()
  for (const row of input.sourceByStudentNodeId.values()) {
    sourceByHistoricalKey.set(`${row.studentId}::${row.courseCode.trim().toUpperCase()}`, row)
  }
  if (!input.source.curriculumNodeId) {
    return buildMissingGraphAwarePrerequisiteSummary({
      graphAvailable: false,
      historyAvailable: false,
      curriculumImportVersionId: input.curriculumImportVersionId ?? null,
      curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    })
  }
  return buildGraphAwarePrerequisiteSummary({
    source: input.source,
    sourceGraphKey: input.source.courseCode.trim().toUpperCase(),
    historicalSourceKeyForGraphKey: graphKey => `${input.source.studentId}::${graphKey.trim().toUpperCase()}`,
    sourceByHistoricalKey,
    prerequisiteGraphByGraphKey,
    downstreamGraphByGraphKey,
    graphAvailable: true,
    curriculumImportVersionId: input.curriculumImportVersionId ?? null,
    curriculumFeatureProfileFingerprint: input.curriculumFeatureProfileFingerprint ?? null,
    getSemesterNumber: row => row.semesterNumber,
    getFinalMark: row => row.finalMark,
    getResult: row => row.result,
    getCourseCode: row => row.courseCode.trim().toUpperCase(),
    getCourseFamily: courseDisciplineFamily,
  })
}

export function downstreamCarryoverLabelForSource(input: {
  source: StageCourseProjectionSource
  sourceByStudentNodeId: Map<string, StageCourseProjectionSource>
  downstreamNodeIdsBySourceNodeId: Map<string, string[]>
}) {
  if (!input.source.curriculumNodeId) return 0 as const
  const downstreamNodeIds = input.downstreamNodeIdsBySourceNodeId.get(input.source.curriculumNodeId) ?? []
  const downstreamSources = downstreamNodeIds
    .map(nodeId => input.sourceByStudentNodeId.get(`${input.source.studentId}::${nodeId}`) ?? null)
    .filter((row): row is StageCourseProjectionSource => !!row)
    .filter(row => row.semesterNumber > input.source.semesterNumber)
  return downstreamSources.some(row => row.result !== 'Passed' || row.finalMark < 50) ? 1 as const : 0 as const
}

export function ceMinimumPctForPolicy(policy: ResolvedPolicy) {
  return (policy.passRules.minimumCeMark / policy.passRules.ceMaximum) * 100
}

export function ceShortfallLabelFromPct(cePct: number, policy: ResolvedPolicy) {
  return cePct < ceMinimumPctForPolicy(policy) ? 1 as const : 0 as const
}

export function ceShortfallLabel(source: StageCourseProjectionSource, policy: ResolvedPolicy) {
  return ceShortfallLabelFromPct(source.cePct, policy)
}

export function seeShortfallLabel(source: StageCourseProjectionSource, policy: ResolvedPolicy) {
  const seeMinimumPct = (policy.passRules.minimumSeeMark / policy.passRules.seeMaximum) * 100
  return source.seePct < seeMinimumPct ? 1 as const : 0 as const
}
