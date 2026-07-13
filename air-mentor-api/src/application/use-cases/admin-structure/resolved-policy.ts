/**
 * Institution default academic policy + policy merge.
 *
 * Persistence-free pure policy domain moved verbatim from
 * modules/admin-structure.ts (DEFAULT_POLICY, mergePolicy). DEFAULT_POLICY and
 * ResolvedPolicy are re-exported from modules/admin-structure.ts for the many
 * lib/* and modules/* consumers that depend on them.
 */
import type { PolicyPayload, ResolvedPolicy } from './admin-structure-schemas.js'

export const DEFAULT_POLICY: ResolvedPolicy = {
  gradeBands: [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ],
  ceSeeSplit: {
    ce: 60,
    see: 40,
  },
  ceComponentCaps: {
    termTestsWeight: 30,
    quizWeight: 10,
    assignmentWeight: 20,
    maxTermTests: 2,
    maxQuizzes: 5,
    maxAssignments: 5,
  },
  workingCalendar: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    dayStart: '08:30',
    dayEnd: '16:30',
    courseworkWeeks: 16,
    examPreparationWeeks: 1,
    seeWeeks: 3,
    totalWeeks: 20,
  },
  attendanceRules: {
    minimumRequiredPercent: 75,
    condonationFloorPercent: 65,
  },
  condonationRules: {
    maximumShortagePercent: 10,
    requiresApproval: true,
  },
  eligibilityRules: {
    minimumCeForSeeEligibility: 24,
    allowCondonationForSeeEligibility: true,
  },
  passRules: {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  },
  roundingRules: {
    statusMarkRounding: 'nearest-integer',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: 2,
  },
  sgpaCgpaRules: {
    sgpaModel: 'credit-weighted',
    cgpaModel: 'credit-weighted-cumulative',
    rounding: '2-decimal',
    includeFailedCredits: true,
    repeatedCoursePolicy: 'latest-attempt',
  },
  progressionRules: {
    passMarkPercent: 40,
    minimumCgpaForPromotion: 5,
    requireNoActiveBacklogs: false,
  },
  remediationRules: {
    allowReSit: true,
    maxReSitAttempts: 2,
    reSitEligibilityMinAttendance: 65,
    reSitEligibilityMinCe: 24,
    allowReRegister: true,
    maxReRegisterAttempts: 3,
  },
  yearBackRules: {
    enableYearBack: true,
    detentionAfterConsecutiveFailures: 3,
    yearBackMinimumSemester: 2,
    allowPromotionWithBacklogs: true,
    promotionBacklogCreditLimit: 15,
    yearBackTriggerCredits: 16,
    yearBackTriggerFailedCourses: 0,
  },
  riskRules: {
    highRiskAttendancePercentBelow: 65,
    mediumRiskAttendancePercentBelow: 75,
    highRiskCgpaBelow: 6.5,
    mediumRiskCgpaBelow: 7.5,
    highRiskBacklogCount: 2,
    mediumRiskBacklogCount: 1,
  },
}

export function mergePolicy(base: ResolvedPolicy, override: PolicyPayload): ResolvedPolicy {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    attendanceRules: override.attendanceRules ?? base.attendanceRules,
    condonationRules: override.condonationRules ?? base.condonationRules,
    eligibilityRules: override.eligibilityRules ?? base.eligibilityRules,
    passRules: override.passRules ?? base.passRules,
    remediationRules: override.remediationRules ?? base.remediationRules,
    yearBackRules: override.yearBackRules ?? base.yearBackRules,
    roundingRules: override.roundingRules ?? base.roundingRules,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
    progressionRules: override.progressionRules ?? base.progressionRules,
    riskRules: override.riskRules ?? base.riskRules,
  }
}
