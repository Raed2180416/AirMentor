import type { AttendanceDecision, EligibilityRules } from './attendance-policy.js'
import { evaluateAttendanceStatus } from './attendance-policy.js'
import type { GradeBand } from './grade-band.js'
import { mapGradeBand } from './grade-band.js'
import type { RoundingRules } from './rounding.js'
import { roundStatusMark } from './rounding.js'
import type { SgpaCgpaRules } from './sgpa-cgpa-policy.js'

export type PassRules = {
  ceMinimum: number
  seeMinimum: number
  overallMinimum: number
  ceMaximum: number
  seeMaximum: number
  overallMaximum: number
}

export type CourseStatusDecision = {
  attendance: AttendanceDecision
  ceRounded: number
  seeRounded: number
  overallRounded: number
  seeEligible: boolean
  passed: boolean
  result: 'Passed' | 'Failed'
  gradeLabel: string
  gradePoint: number
}

export type DeterministicPolicy = {
  gradeBands: GradeBand[]
  attendanceRules: { minimumPercent: number }
  condonationRules: { minimumPercent: number; shortagePercent: number; requiresApproval: boolean }
  eligibilityRules: EligibilityRules
  passRules: PassRules
  roundingRules: RoundingRules
  sgpaCgpaRules: SgpaCgpaRules
}

export type CourseStatusInput = {
  attendancePercent: number
  ceMark: number
  seeMark: number
  condoned?: boolean
  policy: DeterministicPolicy
}

export function evaluateCourseStatus(input: CourseStatusInput): CourseStatusDecision {
  const attendance = evaluateAttendanceStatus({
    attendancePercent: input.attendancePercent,
    condoned: input.condoned,
    policy: input.policy,
  })
  const ceRounded = roundStatusMark(input.ceMark, input.policy.roundingRules)
  const seeRounded = roundStatusMark(input.seeMark, input.policy.roundingRules)
  const overallRounded = roundStatusMark(input.ceMark + input.seeMark, input.policy.roundingRules)
  const attendanceEligible = attendance.status === 'eligible'
  const seeEligible = attendanceEligible && ceRounded >= input.policy.eligibilityRules.minimumCeForSee
  const passed = attendanceEligible
    && ceRounded >= input.policy.passRules.ceMinimum
    && seeRounded >= input.policy.passRules.seeMinimum
    && overallRounded >= input.policy.passRules.overallMinimum
  const gradeBand = passed
    ? mapGradeBand((overallRounded / input.policy.passRules.overallMaximum) * 100, input.policy.gradeBands)
    : mapGradeBand(0, input.policy.gradeBands)
  return {
    attendance,
    ceRounded,
    seeRounded,
    overallRounded,
    seeEligible,
    passed,
    result: passed ? 'Passed' : 'Failed',
    gradeLabel: passed ? gradeBand.grade : 'F',
    gradePoint: passed ? gradeBand.gradePoint : 0,
  }
}
