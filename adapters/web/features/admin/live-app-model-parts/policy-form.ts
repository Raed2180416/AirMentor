import type {
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
} from '@web/shared/api/types'
import {
  requirePositiveInteger,
  requireRange,
} from '../live-app-validation'

export type PolicyFormState = {
  oMin: string
  aPlusMin: string
  aMin: string
  bPlusMin: string
  bMin: string
  cMin: string
  pMin: string
  ce: string
  see: string
  termTestsWeight: string
  quizWeight: string
  assignmentWeight: string
  maxTermTests: string
  maxQuizzes: string
  maxAssignments: string
  dayStart: string
  dayEnd: string
  workingDays: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
  courseworkWeeks: string
  examPreparationWeeks: string
  seeWeeks: string
  totalWeeks: string
  minimumAttendancePercent: string
  condonationFloorPercent: string
  condonationShortagePercent: string
  condonationRequiresApproval: boolean
  minimumCeForSeeEligibility: string
  allowCondonationForSeeEligibility: boolean
  minimumCeMark: string
  minimumSeeMark: string
  minimumOverallMark: string
  applyBeforeStatusDetermination: boolean
  sgpaCgpaDecimals: string
  repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
  passMarkPercent: string
  minimumCgpaForPromotion: string
  requireNoActiveBacklogs: boolean
  highRiskAttendancePercentBelow: string
  mediumRiskAttendancePercentBelow: string
  highRiskCgpaBelow: string
  mediumRiskCgpaBelow: string
  highRiskBacklogCount: string
  mediumRiskBacklogCount: string
}

export const WEEKDAYS: PolicyFormState['workingDays'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DEFAULT_PROGRESSION_RULES = {
  passMarkPercent: 40,
  minimumCgpaForPromotion: 5,
  requireNoActiveBacklogs: true,
}

export function defaultPolicyForm(): PolicyFormState {
  return {
    oMin: '90', aPlusMin: '80', aMin: '70', bPlusMin: '60', bMin: '55', cMin: '50', pMin: '40',
    ce: '60', see: '40', termTestsWeight: '30', quizWeight: '10', assignmentWeight: '20',
    maxTermTests: '2', maxQuizzes: '5', maxAssignments: '5',
    dayStart: '08:30', dayEnd: '16:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    courseworkWeeks: '16', examPreparationWeeks: '1', seeWeeks: '3', totalWeeks: '20',
    minimumAttendancePercent: '75',
    condonationFloorPercent: '65',
    condonationShortagePercent: '10',
    condonationRequiresApproval: true,
    minimumCeForSeeEligibility: '24',
    allowCondonationForSeeEligibility: true,
    minimumCeMark: '24',
    minimumSeeMark: '16',
    minimumOverallMark: '40',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: '2',
    repeatedCoursePolicy: 'latest-attempt',
    passMarkPercent: '40',
    minimumCgpaForPromotion: '5.0',
    requireNoActiveBacklogs: true,
    highRiskAttendancePercentBelow: '65',
    mediumRiskAttendancePercentBelow: '75',
    highRiskCgpaBelow: '6.5',
    mediumRiskCgpaBelow: '7.5',
    highRiskBacklogCount: '2',
    mediumRiskBacklogCount: '1',
  }
}

export function mergePolicyPayload(base: ApiResolvedBatchPolicy['effectivePolicy'], override: ApiPolicyPayload): ApiResolvedBatchPolicy['effectivePolicy'] {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    attendanceRules: override.attendanceRules ?? base.attendanceRules,
    condonationRules: override.condonationRules ?? base.condonationRules,
    eligibilityRules: override.eligibilityRules ?? base.eligibilityRules,
    passRules: override.passRules ?? base.passRules,
    roundingRules: override.roundingRules ?? base.roundingRules,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
    progressionRules: override.progressionRules ?? base.progressionRules,
    riskRules: override.riskRules ?? base.riskRules,
  }
}

export function hydratePolicyForm(policy: ApiResolvedBatchPolicy['effectivePolicy']): PolicyFormState {
  const lookup = Object.fromEntries(policy.gradeBands.map(item => [item.grade, item.minimumMark])) as Record<string, number>
  return {
    oMin: String(lookup.O ?? 90), aPlusMin: String(lookup['A+'] ?? 80), aMin: String(lookup.A ?? 70),
    bPlusMin: String(lookup['B+'] ?? 60), bMin: String(lookup.B ?? 55), cMin: String(lookup.C ?? 50),
    pMin: String(lookup.P ?? 40),
    ce: String(policy.ceSeeSplit.ce), see: String(policy.ceSeeSplit.see),
    termTestsWeight: String(policy.ceComponentCaps.termTestsWeight),
    quizWeight: String(policy.ceComponentCaps.quizWeight),
    assignmentWeight: String(policy.ceComponentCaps.assignmentWeight),
    maxTermTests: String(policy.ceComponentCaps.maxTermTests),
    maxQuizzes: String(policy.ceComponentCaps.maxQuizzes),
    maxAssignments: String(policy.ceComponentCaps.maxAssignments),
    dayStart: policy.workingCalendar.dayStart, dayEnd: policy.workingCalendar.dayEnd,
    workingDays: [...policy.workingCalendar.days],
    courseworkWeeks: String(policy.workingCalendar.courseworkWeeks),
    examPreparationWeeks: String(policy.workingCalendar.examPreparationWeeks),
    seeWeeks: String(policy.workingCalendar.seeWeeks),
    totalWeeks: String(policy.workingCalendar.totalWeeks),
    minimumAttendancePercent: String(policy.attendanceRules.minimumRequiredPercent),
    condonationFloorPercent: String(policy.attendanceRules.condonationFloorPercent),
    condonationShortagePercent: String(policy.condonationRules.maximumShortagePercent),
    condonationRequiresApproval: policy.condonationRules.requiresApproval,
    minimumCeForSeeEligibility: String(policy.eligibilityRules.minimumCeForSeeEligibility),
    allowCondonationForSeeEligibility: policy.eligibilityRules.allowCondonationForSeeEligibility,
    minimumCeMark: String(policy.passRules.minimumCeMark),
    minimumSeeMark: String(policy.passRules.minimumSeeMark),
    minimumOverallMark: String(policy.passRules.minimumOverallMark),
    applyBeforeStatusDetermination: policy.roundingRules.applyBeforeStatusDetermination,
    sgpaCgpaDecimals: String(policy.roundingRules.sgpaCgpaDecimals),
    repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
    passMarkPercent: String(policy.progressionRules.passMarkPercent),
    minimumCgpaForPromotion: String(policy.progressionRules.minimumCgpaForPromotion),
    requireNoActiveBacklogs: policy.progressionRules.requireNoActiveBacklogs,
    highRiskAttendancePercentBelow: String(policy.riskRules.highRiskAttendancePercentBelow),
    mediumRiskAttendancePercentBelow: String(policy.riskRules.mediumRiskAttendancePercentBelow),
    highRiskCgpaBelow: String(policy.riskRules.highRiskCgpaBelow),
    mediumRiskCgpaBelow: String(policy.riskRules.mediumRiskCgpaBelow),
    highRiskBacklogCount: String(policy.riskRules.highRiskBacklogCount),
    mediumRiskBacklogCount: String(policy.riskRules.mediumRiskBacklogCount),
  }
}

export function buildPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
  return {
    gradeBands: [
      { grade: 'O', minimumMark: Number(form.oMin), maximumMark: 100, gradePoint: 10 },
      { grade: 'A+', minimumMark: Number(form.aPlusMin), maximumMark: Math.max(Number(form.oMin) - 1, Number(form.aPlusMin)), gradePoint: 9 },
      { grade: 'A', minimumMark: Number(form.aMin), maximumMark: Math.max(Number(form.aPlusMin) - 1, Number(form.aMin)), gradePoint: 8 },
      { grade: 'B+', minimumMark: Number(form.bPlusMin), maximumMark: Math.max(Number(form.aMin) - 1, Number(form.bPlusMin)), gradePoint: 7 },
      { grade: 'B', minimumMark: Number(form.bMin), maximumMark: Math.max(Number(form.bPlusMin) - 1, Number(form.bMin)), gradePoint: 6 },
      { grade: 'C', minimumMark: Number(form.cMin), maximumMark: Math.max(Number(form.bMin) - 1, Number(form.cMin)), gradePoint: 5 },
      { grade: 'P', minimumMark: Number(form.pMin), maximumMark: Math.max(Number(form.cMin) - 1, Number(form.pMin)), gradePoint: 4 },
      { grade: 'F', minimumMark: 0, maximumMark: Math.max(Number(form.pMin) - 1, 0), gradePoint: 0 },
    ],
    ceSeeSplit: { ce: Number(form.ce), see: Number(form.see) },
    ceComponentCaps: {
      termTestsWeight: Number(form.termTestsWeight), quizWeight: Number(form.quizWeight),
      assignmentWeight: Number(form.assignmentWeight), maxTermTests: Number(form.maxTermTests),
      maxQuizzes: Number(form.maxQuizzes), maxAssignments: Number(form.maxAssignments),
    },
    workingCalendar: {
      days: form.workingDays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      courseworkWeeks: Number(form.courseworkWeeks),
      examPreparationWeeks: Number(form.examPreparationWeeks),
      seeWeeks: Number(form.seeWeeks),
      totalWeeks: Number(form.totalWeeks),
    },
    attendanceRules: {
      minimumRequiredPercent: Number(form.minimumAttendancePercent),
      condonationFloorPercent: Number(form.condonationFloorPercent),
    },
    condonationRules: {
      maximumShortagePercent: Number(form.condonationShortagePercent),
      requiresApproval: form.condonationRequiresApproval,
    },
    eligibilityRules: {
      minimumCeForSeeEligibility: Number(form.minimumCeForSeeEligibility),
      allowCondonationForSeeEligibility: form.allowCondonationForSeeEligibility,
    },
    passRules: {
      minimumCeMark: Number(form.minimumCeMark),
      minimumSeeMark: Number(form.minimumSeeMark),
      minimumOverallMark: Number(form.minimumOverallMark),
      ceMaximum: Number(form.ce),
      seeMaximum: Number(form.see),
      overallMaximum: 100,
    },
    roundingRules: {
      statusMarkRounding: 'nearest-integer',
      applyBeforeStatusDetermination: form.applyBeforeStatusDetermination,
      sgpaCgpaDecimals: Number(form.sgpaCgpaDecimals),
    },
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted', cgpaModel: 'credit-weighted-cumulative', rounding: '2-decimal',
      includeFailedCredits: false, repeatedCoursePolicy: form.repeatedCoursePolicy,
    },
    progressionRules: {
      passMarkPercent: Number(form.passMarkPercent),
      minimumCgpaForPromotion: Number(form.minimumCgpaForPromotion),
      requireNoActiveBacklogs: form.requireNoActiveBacklogs,
    },
    riskRules: {
      highRiskAttendancePercentBelow: Number(form.highRiskAttendancePercentBelow),
      mediumRiskAttendancePercentBelow: Number(form.mediumRiskAttendancePercentBelow),
      highRiskCgpaBelow: Number(form.highRiskCgpaBelow),
      mediumRiskCgpaBelow: Number(form.mediumRiskCgpaBelow),
      highRiskBacklogCount: Number(form.highRiskBacklogCount),
      mediumRiskBacklogCount: Number(form.mediumRiskBacklogCount),
    },
  }
}

export function buildValidatedPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
  const oMin = requireRange('O grade minimum', form.oMin, 0, 100)
  const aPlusMin = requireRange('A+ minimum', form.aPlusMin, 0, 100)
  const aMin = requireRange('A minimum', form.aMin, 0, 100)
  const bPlusMin = requireRange('B+ minimum', form.bPlusMin, 0, 100)
  const bMin = requireRange('B minimum', form.bMin, 0, 100)
  const cMin = requireRange('C minimum', form.cMin, 0, 100)
  const pMin = requireRange('P minimum', form.pMin, 0, 100)
  const ce = requireRange('CE', form.ce, 0, 100)
  const see = requireRange('SEE', form.see, 0, 100)
  const termTestsWeight = requireRange('Stored term test weight', form.termTestsWeight, 0, 100)
  const quizWeight = requireRange('Stored quiz weight', form.quizWeight, 0, 100)
  const assignmentWeight = requireRange('Stored assignment weight', form.assignmentWeight, 0, 100)
  const maxTermTests = requirePositiveInteger('Max term tests', form.maxTermTests)
  const maxQuizzes = requirePositiveInteger('Max quizzes', form.maxQuizzes)
  const maxAssignments = requirePositiveInteger('Max assignments', form.maxAssignments)
  const courseworkWeeks = requirePositiveInteger('Coursework weeks', form.courseworkWeeks)
  const examPreparationWeeks = requireRange('Exam preparation weeks', form.examPreparationWeeks, 0, 52)
  const seeWeeks = requireRange('SEE weeks', form.seeWeeks, 0, 52)
  const totalWeeks = requirePositiveInteger('Total weeks', form.totalWeeks)
  const minimumAttendancePercent = requireRange('Minimum attendance percent', form.minimumAttendancePercent, 0, 100)
  const condonationFloorPercent = requireRange('Condonation floor percent', form.condonationFloorPercent, 0, 100)
  const condonationShortagePercent = requireRange('Condonation shortage percent', form.condonationShortagePercent, 0, 100)
  const minimumCeForSeeEligibility = requireRange('Minimum CE for SEE eligibility', form.minimumCeForSeeEligibility, 0, 100)
  const minimumCeMark = requireRange('Minimum CE mark', form.minimumCeMark, 0, 100)
  const minimumSeeMark = requireRange('Minimum SEE mark', form.minimumSeeMark, 0, 100)
  const minimumOverallMark = requireRange('Minimum overall mark', form.minimumOverallMark, 0, 100)
  const sgpaCgpaDecimals = requireRange('SGPA / CGPA decimals', form.sgpaCgpaDecimals, 0, 4)
  const passMarkPercent = requireRange('Pass mark percent', form.passMarkPercent, 0, 100)
  const minimumCgpaForPromotion = requireRange('Minimum CGPA for promotion', form.minimumCgpaForPromotion, 0, 10)
  const highRiskAttendancePercentBelow = requireRange('High risk attendance threshold', form.highRiskAttendancePercentBelow, 0, 100)
  const mediumRiskAttendancePercentBelow = requireRange('Medium risk attendance threshold', form.mediumRiskAttendancePercentBelow, 0, 100)
  const highRiskCgpaBelow = requireRange('High risk CGPA threshold', form.highRiskCgpaBelow, 0, 10)
  const mediumRiskCgpaBelow = requireRange('Medium risk CGPA threshold', form.mediumRiskCgpaBelow, 0, 10)
  const highRiskBacklogCount = requireRange('High risk backlog threshold', form.highRiskBacklogCount, 0, 50)
  const mediumRiskBacklogCount = requireRange('Medium risk backlog threshold', form.mediumRiskBacklogCount, 0, 50)

  if (ce + see !== 100) throw new Error('CE and SEE must total 100.')
  if (courseworkWeeks + examPreparationWeeks + seeWeeks !== totalWeeks) {
    throw new Error('Coursework, exam preparation, and SEE weeks must total the configured total weeks.')
  }
  if (condonationFloorPercent > minimumAttendancePercent) {
    throw new Error('Condonation floor percent must be less than or equal to the minimum attendance percent.')
  }
  if (minimumCeForSeeEligibility > ce) {
    throw new Error('Minimum CE for SEE eligibility cannot exceed the CE maximum.')
  }
  if (minimumCeMark > ce || minimumSeeMark > see || minimumOverallMark > 100) {
    throw new Error('Pass thresholds cannot exceed the configured CE / SEE totals.')
  }
  if (!(oMin >= aPlusMin && aPlusMin >= aMin && aMin >= bPlusMin && bPlusMin >= bMin && bMin >= cMin && cMin >= pMin)) {
    throw new Error('Grade bands must descend from O down to P without gaps going upward.')
  }
  if (highRiskAttendancePercentBelow > mediumRiskAttendancePercentBelow) {
    throw new Error('High risk attendance threshold must be less than or equal to the medium risk threshold.')
  }
  if (highRiskCgpaBelow > mediumRiskCgpaBelow) {
    throw new Error('High risk CGPA threshold must be less than or equal to the medium risk threshold.')
  }
  if (highRiskBacklogCount < mediumRiskBacklogCount) {
    throw new Error('High risk backlog threshold must be greater than or equal to the medium risk threshold.')
  }

  return buildPolicyPayload({
    ...form,
    oMin: String(oMin),
    aPlusMin: String(aPlusMin),
    aMin: String(aMin),
    bPlusMin: String(bPlusMin),
    bMin: String(bMin),
    cMin: String(cMin),
    pMin: String(pMin),
    ce: String(ce),
    see: String(see),
    termTestsWeight: String(termTestsWeight),
    quizWeight: String(quizWeight),
    assignmentWeight: String(assignmentWeight),
    maxTermTests: String(maxTermTests),
    maxQuizzes: String(maxQuizzes),
    maxAssignments: String(maxAssignments),
    courseworkWeeks: String(courseworkWeeks),
    examPreparationWeeks: String(examPreparationWeeks),
    seeWeeks: String(seeWeeks),
    totalWeeks: String(totalWeeks),
    minimumAttendancePercent: String(minimumAttendancePercent),
    condonationFloorPercent: String(condonationFloorPercent),
    condonationShortagePercent: String(condonationShortagePercent),
    minimumCeForSeeEligibility: String(minimumCeForSeeEligibility),
    minimumCeMark: String(minimumCeMark),
    minimumSeeMark: String(minimumSeeMark),
    minimumOverallMark: String(minimumOverallMark),
    sgpaCgpaDecimals: String(sgpaCgpaDecimals),
    passMarkPercent: String(passMarkPercent),
    minimumCgpaForPromotion: String(minimumCgpaForPromotion),
    highRiskAttendancePercentBelow: String(highRiskAttendancePercentBelow),
    mediumRiskAttendancePercentBelow: String(mediumRiskAttendancePercentBelow),
    highRiskCgpaBelow: String(highRiskCgpaBelow),
    mediumRiskCgpaBelow: String(mediumRiskCgpaBelow),
    highRiskBacklogCount: String(highRiskBacklogCount),
    mediumRiskBacklogCount: String(mediumRiskBacklogCount),
  })
}
