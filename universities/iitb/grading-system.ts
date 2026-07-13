import type { GradeBand, RoundingRules } from '../../kernel/grading/index.js'
import type { GradingSystem } from '../../kernel/policy/index.js'

const IITB_ROUNDING: RoundingRules = {
  statusMarkRounding: 'nearest-integer',
  sgpaCgpaDecimals: 2,
}

export function createIitbGradeBands(): GradeBand[] {
  return [
    { grade: 'AA', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'AB', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'BB', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'BC', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'CC', minimumMark: 50, maximumMark: 59, gradePoint: 6 },
    { grade: 'CD', minimumMark: 40, maximumMark: 49, gradePoint: 5 },
    { grade: 'DD', minimumMark: 35, maximumMark: 39, gradePoint: 4 },
    { grade: 'FF', minimumMark: 0, maximumMark: 34, gradePoint: 0 },
  ]
}

export function createIitbGradingSystem(): GradingSystem {
  return {
    gradeBands: createIitbGradeBands(),
    roundingRules: IITB_ROUNDING,
  }
}
