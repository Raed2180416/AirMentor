import type { GradeBand, AttendanceRules, CondonationRules, EligibilityRules, PassRules, RoundingRules, SgpaCgpaRules } from '../grading/index.js'

export type WorkingCalendar = {
  days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
  dayStart: string
  dayEnd: string
  courseworkWeeks: number
  examPreparationWeeks: number
  seeWeeks: number
  totalWeeks: number
}

export type CeComponentCaps = {
  termTestsWeight: number
  quizWeight: number
  assignmentWeight: number
  maxTermTests: number
  maxQuizzes: number
  maxAssignments: number
}

export type AssessmentTemplate = {
  ceSeeSplit: { ce: number; see: number }
  ceComponentCaps: CeComponentCaps
  workingCalendar: WorkingCalendar
}

export type PromotionRules = {
  passMarkPercent: number
  minimumCgpaForPromotion: number
  requireNoActiveBacklogs: boolean
}

export type RiskRules = {
  highRiskAttendancePercentBelow: number
  mediumRiskAttendancePercentBelow: number
  highRiskCgpaBelow: number
  mediumRiskCgpaBelow: number
  highRiskBacklogCount: number
  mediumRiskBacklogCount: number
}

export type GradingSystem = {
  gradeBands: GradeBand[]
  roundingRules: RoundingRules
}

export type UniversityPlugin = {
  readonly universityId: string
  readonly displayName: string
  getGradingSystem(): GradingSystem
  getPassRules(): PassRules
  getPromotionRules(): PromotionRules
  getAssessmentTemplate(): AssessmentTemplate
  getAttendanceRules(): AttendanceRules
  getCondonationRules(): CondonationRules
  getEligibilityRules(): EligibilityRules
  getSgpaCgpaRules(): SgpaCgpaRules
  getRiskRules(): RiskRules
}
