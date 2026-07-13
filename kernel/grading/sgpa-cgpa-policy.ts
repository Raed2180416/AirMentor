import type { RoundingRules } from './rounding.js'
import { roundToDecimals } from './rounding.js'

export type SgpaCgpaRules = {
  includeFailedCredits: boolean
  repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
}

export type GradePointSubjectAttempt = {
  courseCode: string
  credits: number
  gradePoint: number
  result: 'Passed' | 'Failed' | 'Repeated'
}

export type SgpaInput = {
  attempts: GradePointSubjectAttempt[]
  policy: {
    roundingRules: RoundingRules
    sgpaCgpaRules: SgpaCgpaRules
  }
}

export function calculateSgpa(input: SgpaInput) {
  const filtered = input.attempts.filter(attempt => {
    if (input.policy.sgpaCgpaRules.includeFailedCredits) return true
    return attempt.result === 'Passed' || attempt.gradePoint > 0
  })
  const credits = filtered.reduce((sum, attempt) => sum + attempt.credits, 0)
  if (credits === 0) return 0
  const weighted = filtered.reduce((sum, attempt) => sum + (attempt.credits * attempt.gradePoint), 0)
  return roundToDecimals(weighted / credits, input.policy.roundingRules.sgpaCgpaDecimals)
}

export type CgpaInput = {
  termAttempts: GradePointSubjectAttempt[][]
  policy: {
    roundingRules: RoundingRules
    sgpaCgpaRules: SgpaCgpaRules
  }
}

export function calculateCgpa(input: CgpaInput) {
  const flattened = input.termAttempts.flat()
  return calculateSgpa({
    attempts: flattened,
    policy: input.policy,
  })
}
