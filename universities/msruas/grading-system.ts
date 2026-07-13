import type { GradeBand, RoundingRules } from '../../kernel/grading/index.js'
import type { GradingSystem } from '../../kernel/policy/index.js'

const MSRUAS_ROUNDING: RoundingRules = {
  statusMarkRounding: 'nearest-integer',
  sgpaCgpaDecimals: 2,
}

export function createMsruasGradeBands(): GradeBand[] {
  return [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ]
}

export function createMsruasGradingSystem(): GradingSystem {
  return {
    gradeBands: createMsruasGradeBands(),
    roundingRules: MSRUAS_ROUNDING,
  }
}
