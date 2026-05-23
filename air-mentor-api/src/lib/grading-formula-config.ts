export const GRADE_BANDS = [
  { grade: 'O', minimumMark: 91, maximumMark: 100, gradePoint: 10 },
  { grade: 'A+', minimumMark: 81, maximumMark: 90, gradePoint: 9 },
  { grade: 'A', minimumMark: 71, maximumMark: 80, gradePoint: 8 },
  { grade: 'B+', minimumMark: 61, maximumMark: 70, gradePoint: 7 },
  { grade: 'B', minimumMark: 51, maximumMark: 60, gradePoint: 6 },
  { grade: 'C', minimumMark: 45, maximumMark: 50, gradePoint: 5 },
  { grade: 'F', minimumMark: 0, maximumMark: 44, gradePoint: 0 },
] as const

export type GradeBand = typeof GRADE_BANDS[number]

export const CE_COMPONENT_WEIGHTS = {
  tt1: 0.28,
  tt2: 0.27,
  quiz: 0.20,
  assignment: 0.25,
} as const

export const CE_SEE_SPLIT = {
  ceMaximum: 60,
  seeMaximum: 40,
  overallMaximum: 100,
} as const

export const PASS_RULES = {
  ceMinimum: 24,
  seeMinimum: 16,
  overallMinimum: 40,
} as const

export function resolveGradingProfile(profile?: string | null) {
  if (profile === 'standard-50-50') {
    return {
      ceMaximum: 50,
      seeMaximum: 50,
      ceMinimum: 20,
      seeMinimum: 20,
      overallMinimum: 45,
    }
  }
  return {
    ceMaximum: 60,
    seeMaximum: 40,
    ceMinimum: 24,
    seeMinimum: 16,
    overallMinimum: 40,
  }
}

export const ATTENDANCE_RULES = {
  minimumPercent: 75,
  condonationFloorPercent: 65,
} as const

export function mapGradeBand(markPercent: number): GradeBand {
  const safe = Math.max(0, Math.min(100, markPercent))
  return GRADE_BANDS.find(b => safe >= b.minimumMark && safe <= b.maximumMark)
    ?? GRADE_BANDS[GRADE_BANDS.length - 1]
}

export function computeCePct(components: {
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
}): number {
  return (
    components.tt1Pct * CE_COMPONENT_WEIGHTS.tt1
    + components.tt2Pct * CE_COMPONENT_WEIGHTS.tt2
    + components.quizPct * CE_COMPONENT_WEIGHTS.quiz
    + components.assignmentPct * CE_COMPONENT_WEIGHTS.assignment
  )
}

export function computeCeMark(components: {
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
}, ceMaximum: number = CE_SEE_SPLIT.ceMaximum): number {
  return Math.round((computeCePct(components) / 100) * ceMaximum)
}

export function computeSeeMark(seePct: number, seeMaximum: number = CE_SEE_SPLIT.seeMaximum): number {
  return Math.round((seePct / 100) * seeMaximum)
}

export function evaluateResult(input: {
  ceMark: number
  seeMark: number
  attendancePercent: number
  condoned?: boolean
  assessmentProfile?: string | null
}): { passed: boolean; result: 'Passed' | 'Failed'; gradeLabel: string; gradePoint: number } {
  const profile = resolveGradingProfile(input.assessmentProfile)
  const attendanceOk = input.attendancePercent >= ATTENDANCE_RULES.minimumPercent
    || (input.condoned === true && input.attendancePercent >= ATTENDANCE_RULES.condonationFloorPercent)
  const overall = input.ceMark + input.seeMark
  const passed = attendanceOk
    && input.ceMark >= profile.ceMinimum
    && input.seeMark >= profile.seeMinimum
    && overall >= profile.overallMinimum
  const overallPct = (overall / CE_SEE_SPLIT.overallMaximum) * 100
  const band = passed ? mapGradeBand(overallPct) : mapGradeBand(0)
  return {
    passed,
    result: passed ? 'Passed' : 'Failed',
    gradeLabel: passed ? band.grade : 'F',
    gradePoint: passed ? band.gradePoint : 0,
  }
}

export function calculateSgpa(attempts: Array<{ credits: number; gradePoint: number; result: string }>): number {
  const filtered = attempts.filter(a => a.result === 'Passed' || a.gradePoint > 0)
  const totalCredits = filtered.reduce((sum, a) => sum + a.credits, 0)
  if (totalCredits === 0) return 0
  const weighted = filtered.reduce((sum, a) => sum + a.credits * a.gradePoint, 0)
  return Math.round((weighted / totalCredits) * 100) / 100
}
