/**
 * @deprecated MSRUAS policy has moved to kernel/grading/ and universities/msruas/.
 * This barrel remains for backward compatibility during the refactor and will be removed.
 */
export type {
  AttendanceDecision,
  AttendanceRules,
  CondonationRules,
  CourseStatusDecision,
  EligibilityRules,
  GradeBand,
  GradePointSubjectAttempt,
  PassRules,
  RoundingRules,
  SgpaCgpaRules,
} from '../../../kernel/grading/index.js'

export type { DeterministicPolicy as MsruasDeterministicPolicy } from '../../../kernel/grading/index.js'

export {
  calculateCgpa,
  calculateSgpa,
  evaluateAttendanceStatus,
  evaluateCourseStatus,
  mapGradeBand,
  roundStatusMark,
  roundToDecimals,
} from '../../../kernel/grading/index.js'
