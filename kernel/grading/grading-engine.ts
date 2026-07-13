import type { CourseStatusDecision, CourseStatusInput } from './pass-policy.js'
import { evaluateCourseStatus } from './pass-policy.js'
import type { CgpaInput, SgpaInput } from './sgpa-cgpa-policy.js'
import { calculateCgpa, calculateSgpa } from './sgpa-cgpa-policy.js'

export type GradingEngine = {
  evaluateCourseStatus: (input: CourseStatusInput) => CourseStatusDecision
  calculateSgpa: (input: SgpaInput) => number
  calculateCgpa: (input: CgpaInput) => number
}

export function createDefaultGradingEngine(): GradingEngine {
  return {
    evaluateCourseStatus,
    calculateSgpa,
    calculateCgpa,
  }
}
