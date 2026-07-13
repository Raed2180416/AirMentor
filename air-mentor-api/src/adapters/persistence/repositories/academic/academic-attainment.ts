/**
 * Academic attainment + transcript analytics — CO attainment, transcript
 * SGPA/CGPA/progression analytics, resolved course-outcome chains, and the
 * assessment-cell aggregation helpers.
 *
 * These functions type their inputs as db/schema rows (assessment scores,
 * transcript rows, course-outcome overrides), so they live in the persistence
 * layer and are moved verbatim from modules/academic.ts (no logic change).
 */
import { z } from 'zod'
import {
  academicTerms,
  courseOutcomeOverrides,
  studentAssessmentScores,
  transcriptSubjectResults,
  transcriptTermResults,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import { evaluateStudentProgression } from '../../../../lib/proof-student-progression.js'
import type { ResolvedPolicy } from '../../../../modules/admin-structure.js'
import {
  courseOutcomeSchema,
  schemeStateSchema,
  termTestBlueprintSchema,
} from '../../../../application/use-cases/academic/academic-contracts.js'
import {
  assessmentTypeMatches,
  normalizeTranscriptCourseKey,
  roundToTwo,
  visibleAssessmentComponentTypesForStage,
  weightedAverageNullable,
} from '../../../../application/use-cases/academic/academic-utils.js'
import {
  buildDefaultCourseOutcomes,
  clampInteger,
  flattenTermTestLeaves,
} from '../../../../application/use-cases/academic/academic-scheme.js'

export function filterAssessmentCellsForStage(
  cells: Array<typeof studentAssessmentScores.$inferSelect>,
  stageKey: string | null | undefined,
) {
  const visibleTypes = visibleAssessmentComponentTypesForStage(stageKey)
  if (!visibleTypes) return cells
  return cells.filter(cell => assessmentTypeMatches(cell.componentType, visibleTypes))
}

export function computeTranscriptAnalytics(input: {
  termRows: Array<typeof transcriptTermResults.$inferSelect>
  termById: Record<string, typeof academicTerms.$inferSelect>
  subjectsByTermResultId: Map<string, Array<typeof transcriptSubjectResults.$inferSelect>>
  policy: ResolvedPolicy
  fallbackCgpa: number
}) {
  const orderedTerms = [...input.termRows].sort((left, right) => {
    const leftTerm = input.termById[left.termId]
    const rightTerm = input.termById[right.termId]
    if (!leftTerm || !rightTerm) return left.termId.localeCompare(right.termId)
    return leftTerm.semesterNumber - rightTerm.semesterNumber
  })

  const attemptsByCourseKey = new Map<string, Array<typeof transcriptSubjectResults.$inferSelect & { termOrder: number }>>()
  orderedTerms.forEach((termRow, termOrder) => {
    const subjects = input.subjectsByTermResultId.get(termRow.transcriptTermResultId) ?? []
    subjects.forEach(subject => {
      const courseKey = normalizeTranscriptCourseKey(subject.courseCode)
      attemptsByCourseKey.set(courseKey, [...(attemptsByCourseKey.get(courseKey) ?? []), { ...subject, termOrder }])
    })
  })

  const selectedAttempts = Array.from(attemptsByCourseKey.values()).map(attempts => {
    if (input.policy.sgpaCgpaRules.repeatedCoursePolicy === 'best-attempt') {
      return [...attempts].sort((left, right) => {
        if (right.gradePoint !== left.gradePoint) return right.gradePoint - left.gradePoint
        if (right.score !== left.score) return right.score - left.score
        return right.termOrder - left.termOrder
      })[0]
    }
    return [...attempts].sort((left, right) => right.termOrder - left.termOrder)[0]
  })

  const includedAttempts = selectedAttempts.filter(attempt => {
    if (input.policy.sgpaCgpaRules.includeFailedCredits) return true
    return attempt.gradePoint > 0
  })
  const completedCreditsForCgpa = includedAttempts.reduce((sum, attempt) => sum + attempt.credits, 0)
  const weightedPoints = includedAttempts.reduce((sum, attempt) => sum + (attempt.gradePoint * attempt.credits), 0)
  const currentCgpa = completedCreditsForCgpa > 0
    ? roundToTwo(weightedPoints / completedCreditsForCgpa)
    : input.fallbackCgpa

  const repeatSubjects = Array.from(attemptsByCourseKey.values())
    .filter(attempts => attempts.length > 1 || attempts.some(attempt => attempt.result === 'Repeated'))
    .map(attempts => {
      const latest = [...attempts].sort((left, right) => right.termOrder - left.termOrder)[0]
      return `${latest.courseCode} ${latest.title}`
    })

  const sgpaSeries = orderedTerms.map(termRow => roundToTwo(termRow.sgpaScaled / 100))
  const latestSgpa = sgpaSeries.at(-1) ?? 0
  const previousSgpa = sgpaSeries.length > 1 ? sgpaSeries.at(-2) ?? latestSgpa : latestSgpa
  const trend: 'Improving' | 'Stable' | 'Declining' = latestSgpa - previousSgpa >= 0.25
    ? 'Improving'
    : previousSgpa - latestSgpa >= 0.25
      ? 'Declining'
      : 'Stable'

  const latestBacklogCount = orderedTerms.at(-1)?.backlogCount ?? 0
  const activeBacklogCredits = selectedAttempts
    .filter(attempt => attempt.result !== 'Passed' || attempt.gradePoint === 0)
    .reduce((sum, attempt) => sum + attempt.credits, 0)
  const latestTerm = orderedTerms.at(-1)
  const currentSemester = latestTerm
    ? input.termById[latestTerm.termId]?.semesterNumber ?? orderedTerms.length
    : orderedTerms.length
  const progressionDecision = evaluateStudentProgression({
    currentSemester,
    cgpa: currentCgpa,
    activeBacklogs: latestBacklogCount,
    activeBacklogCredits,
    consecutiveFailures: 0,
    policy: input.policy,
  })
  const progressionStatus: 'Eligible' | 'Review' | 'Hold' = progressionDecision.status === 'promoted'
    ? activeBacklogCredits > 0 || currentCgpa < input.policy.progressionRules.minimumCgpaForPromotion
      ? 'Review'
      : 'Eligible'
    : 'Hold'

  return {
    currentCgpa,
    completedCreditsForCgpa,
    activeBacklogCredits,
    repeatSubjects,
    trend,
    latestBacklogCount,
    latestSgpa,
    progressionStatus,
  }
}

export function pctsFromAssessmentCells(cells: Array<typeof studentAssessmentScores.$inferSelect>, componentTypes: string[]) {
  return cells
    .filter(cell => assessmentTypeMatches(cell.componentType, componentTypes))
    .map(cell => {
      if (cell.maxScore <= 0) return null
      return roundToTwo((cell.score / cell.maxScore) * 100)
    })
    .filter((value): value is number => value !== null)
}

export function rawTotalFromAssessmentCells(cells: Array<typeof studentAssessmentScores.$inferSelect>, componentTypes: string[]) {
  return cells
    .filter(cell => assessmentTypeMatches(cell.componentType, componentTypes))
    .reduce((sum, cell) => sum + cell.score, 0)
}

export function buildQuestionLeafScoreMap(input: {
  kind: 'tt1' | 'tt2'
  cells: Array<typeof studentAssessmentScores.$inferSelect>
}) {
  const storageType = `${input.kind}_leaf`
  return Object.fromEntries(
    input.cells
      .filter(cell => cell.componentType === storageType && !!cell.componentCode)
      .map(cell => [cell.componentCode as string, cell.score]),
  ) as Record<string, number>
}

export function computeStudentOutcomeAttainment(input: {
  outcomes: Array<z.infer<typeof courseOutcomeSchema>>
  tt1Blueprint: z.infer<typeof termTestBlueprintSchema>
  tt2Blueprint: z.infer<typeof termTestBlueprintSchema>
  assessmentCells: Array<typeof studentAssessmentScores.$inferSelect>
  scheme?: z.infer<typeof schemeStateSchema> | null
  proofEvidence?: {
    tt1Pct?: number | null
    tt2Pct?: number | null
    quizPct?: number | null
    assignmentPct?: number | null
  }
}) {
  const tt1LeafScores = buildQuestionLeafScoreMap({ kind: 'tt1', cells: input.assessmentCells })
  const tt2LeafScores = buildQuestionLeafScoreMap({ kind: 'tt2', cells: input.assessmentCells })
  const tt1Leaves = flattenTermTestLeaves(input.tt1Blueprint.nodes)
  const tt2Leaves = flattenTermTestLeaves(input.tt2Blueprint.nodes)

  return input.outcomes.map(outcome => {
    const proofPct = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null)
    const computeComponentAttainment = (leaves: ReturnType<typeof flattenTermTestLeaves>, scores: Record<string, number>, fallbackPct: number | null) => {
      const matchedLeaves = leaves.filter(leaf => leaf.cos.includes(outcome.id))
      if (matchedLeaves.length === 0) return null
      const maxScore = matchedLeaves.reduce((sum, leaf) => sum + leaf.maxMarks, 0)
      const scoredLeaves = matchedLeaves.filter(leaf => typeof scores[leaf.id] === 'number')
      if (scoredLeaves.length === 0 || maxScore <= 0) return fallbackPct
      const rawScore = scoredLeaves.reduce((sum, leaf) => sum + (scores[leaf.id] ?? 0), 0)
      return roundToTwo((rawScore / maxScore) * 100)
    }

    const tt1Attainment = computeComponentAttainment(tt1Leaves, tt1LeafScores, proofPct(input.proofEvidence?.tt1Pct))
    const tt2Attainment = computeComponentAttainment(tt2Leaves, tt2LeafScores, proofPct(input.proofEvidence?.tt2Pct))
    const courseworkAttainment = ([
      ...(input.scheme?.quizComponents ?? []).map((component, index) => ({
        component,
        storageType: `quiz${index + 1}`,
      })),
      ...(input.scheme?.assignmentComponents ?? []).map((component, index) => ({
        component,
        storageType: `asgn${index + 1}`,
      })),
    ])
      .filter(item => item.component.cos.includes(outcome.id))
      .map(item => {
        const cell = input.assessmentCells.find(score =>
          score.componentType === item.storageType
          && score.componentCode === item.component.id,
        )
        const fallbackPct = item.storageType.startsWith('quiz')
          ? proofPct(input.proofEvidence?.quizPct)
          : proofPct(input.proofEvidence?.assignmentPct)
        const value = cell && cell.maxScore > 0
          ? roundToTwo((cell.score / cell.maxScore) * 100)
          : fallbackPct
        return {
          value,
          weight: clampInteger(item.component.weightage, 0, 100, item.component.rawMax),
        }
      })
    const overallAttainment = weightedAverageNullable([
      {
        value: tt1Attainment,
        weight: clampInteger(input.scheme?.termTestWeights?.tt1, 0, 100, input.tt1Blueprint.totalMarks),
      },
      {
        value: tt2Attainment,
        weight: clampInteger(input.scheme?.termTestWeights?.tt2, 0, 100, input.tt2Blueprint.totalMarks),
      },
      ...courseworkAttainment,
    ])
    return {
      coId: outcome.id,
      tt1Attainment,
      tt2Attainment,
      overallAttainment: overallAttainment ?? 0,
      hasEvidence: overallAttainment !== null,
    }
  })
}

export function resolveCourseOutcomesForOffering(input: {
  institutionId: string
  branchId: string
  batchId?: string | null
  offeringId: string
  courseId: string
  courseCode: string
  courseTitle: string
  overrides: Array<typeof courseOutcomeOverrides.$inferSelect>
}) {
  const base = buildDefaultCourseOutcomes(input.courseCode, input.courseTitle)
  const scopeChain = [
    { scopeType: 'institution', scopeId: input.institutionId },
    { scopeType: 'branch', scopeId: input.branchId },
    ...(input.batchId ? [{ scopeType: 'batch' as const, scopeId: input.batchId }] : []),
    { scopeType: 'offering', scopeId: input.offeringId },
  ]

  let resolved = base
  for (const scope of scopeChain) {
    const match = input.overrides
      .filter(row => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    if (!match) continue
    const parsed = z.array(courseOutcomeSchema).safeParse(parseJson(match.outcomesJson, []))
    if (parsed.success && parsed.data.length > 0) resolved = parsed.data
  }
  return resolved
}
