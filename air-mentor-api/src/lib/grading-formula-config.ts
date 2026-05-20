export const GRADE_BANDS = [
  { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
  { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
  { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
  { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
  { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
  { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
  { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
  { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
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
}): number {
  return Math.round((computeCePct(components) / 100) * CE_SEE_SPLIT.ceMaximum)
}

export function computeSeeMark(seePct: number): number {
  return Math.round((seePct / 100) * CE_SEE_SPLIT.seeMaximum)
}

export function evaluateResult(input: {
  ceMark: number
  seeMark: number
  attendancePercent: number
  condoned?: boolean
}): { passed: boolean; result: 'Passed' | 'Failed'; gradeLabel: string; gradePoint: number } {
  const attendanceOk = input.attendancePercent >= ATTENDANCE_RULES.minimumPercent
    || (input.condoned === true && input.attendancePercent >= ATTENDANCE_RULES.condonationFloorPercent)
  const overall = input.ceMark + input.seeMark
  const passed = attendanceOk
    && input.ceMark >= PASS_RULES.ceMinimum
    && input.seeMark >= PASS_RULES.seeMinimum
    && overall >= PASS_RULES.overallMinimum
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
