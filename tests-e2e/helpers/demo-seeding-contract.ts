export type DemoBand = 'mid' | 'high' | 'low'
export type DemoPattern =
  | 'mediocre-flat'
  | 'fluctuating-resilient'
  | 'strong-start-fade'
  | 'slow-starter-bad-attendance'
  | 'ce-strong-see-weak'
  | 'ce-weak-see-strong'
  | 'test-strong-coursework-weak'
  | 'stable-high'
  | 'stable-mid'
  | 'chronic-at-risk'

export type DemoTrajectory = {
  studentId: string
  band: DemoBand
  pattern: DemoPattern
  special: boolean
  tt1Pct: number
  tt2Pct: number
  quizPct: number
  assignmentPct: number
  attendancePct: number
  seePct: number
}

export type DemoComponent = {
  id: string
  maxScore: number
}

export type DemoMarkEntry = {
  studentId: string
  components: Array<{
    componentCode: string
    score: number
    maxScore: number
  }>
}

export const DEMO_STUDENT_COUNT = 120
export const DEMO_SECTION_SIZE = 60
export const DEMO_BAND_TARGETS: Record<DemoBand, number> = {
  mid: 80,
  high: 20,
  low: 20,
}

export const DEMO_STUDENT_IDS = Array.from({ length: DEMO_STUDENT_COUNT }, (_, index) =>
  `mnc_student_${String(index + 1).padStart(3, '0')}`,
)

const SPECIAL_TRAJECTORIES: Array<Omit<DemoTrajectory, 'studentId' | 'special'>> = [
  { band: 'mid', pattern: 'mediocre-flat', tt1Pct: 0.50, tt2Pct: 0.50, quizPct: 0.50, assignmentPct: 0.50, attendancePct: 0.70, seePct: 0.50 },
  { band: 'mid', pattern: 'fluctuating-resilient', tt1Pct: 0.88, tt2Pct: 0.52, quizPct: 0.78, assignmentPct: 0.76, attendancePct: 0.84, seePct: 0.82 },
  { band: 'low', pattern: 'strong-start-fade', tt1Pct: 0.90, tt2Pct: 0.38, quizPct: 0.52, assignmentPct: 0.48, attendancePct: 0.72, seePct: 0.42 },
  { band: 'low', pattern: 'slow-starter-bad-attendance', tt1Pct: 0.24, tt2Pct: 0.78, quizPct: 0.58, assignmentPct: 0.54, attendancePct: 0.48, seePct: 0.74 },
  { band: 'high', pattern: 'ce-strong-see-weak', tt1Pct: 0.82, tt2Pct: 0.84, quizPct: 0.88, assignmentPct: 0.90, attendancePct: 0.90, seePct: 0.42 },
  { band: 'low', pattern: 'ce-weak-see-strong', tt1Pct: 0.34, tt2Pct: 0.38, quizPct: 0.42, assignmentPct: 0.44, attendancePct: 0.76, seePct: 0.84 },
  { band: 'mid', pattern: 'test-strong-coursework-weak', tt1Pct: 0.86, tt2Pct: 0.84, quizPct: 0.38, assignmentPct: 0.34, attendancePct: 0.80, seePct: 0.82 },
  { band: 'high', pattern: 'stable-high', tt1Pct: 0.88, tt2Pct: 0.90, quizPct: 0.87, assignmentPct: 0.86, attendancePct: 0.94, seePct: 0.89 },
  { band: 'mid', pattern: 'stable-mid', tt1Pct: 0.64, tt2Pct: 0.66, quizPct: 0.68, assignmentPct: 0.65, attendancePct: 0.82, seePct: 0.67 },
  { band: 'low', pattern: 'chronic-at-risk', tt1Pct: 0.32, tt2Pct: 0.36, quizPct: 0.40, assignmentPct: 0.38, attendancePct: 0.58, seePct: 0.34 },
]

function deterministicVariation(index: number, key: string, span: number) {
  let hash = 2166136261
  const seed = `${index}:${key}`
  for (let offset = 0; offset < seed.length; offset += 1) {
    hash ^= seed.charCodeAt(offset)
    hash = Math.imul(hash, 16777619)
  }
  return (((hash >>> 0) / 4294967295) * 2 - 1) * span
}

function normalPctForBand(index: number, band: DemoBand, kind: keyof Pick<DemoTrajectory, 'tt1Pct' | 'tt2Pct' | 'quizPct' | 'assignmentPct' | 'attendancePct' | 'seePct'>) {
  const baseByBand: Record<DemoBand, number> = {
    mid: 0.66,
    high: 0.88,
    low: 0.38,
  }
  const spanByBand: Record<DemoBand, number> = {
    mid: 0.11,
    high: 0.08,
    low: 0.14,
  }
  const shiftByKind: Record<typeof kind, number> = {
    tt1Pct: 0,
    tt2Pct: band === 'low' ? 0.02 : 0.01,
    quizPct: band === 'high' ? 0.01 : 0,
    assignmentPct: band === 'low' ? 0.01 : 0.02,
    attendancePct: band === 'low' ? 0.22 : band === 'mid' ? 0.18 : 0.08,
    seePct: band === 'low' ? 0.01 : 0.015,
  }
  return Math.max(0.08, Math.min(0.98, baseByBand[band] + shiftByKind[kind] + deterministicVariation(index, kind, spanByBand[band])))
}

function normalPatternForBand(band: DemoBand): DemoPattern {
  if (band === 'high') return 'stable-high'
  if (band === 'low') return 'chronic-at-risk'
  return 'stable-mid'
}

export function buildDemoTrajectoryMap(studentIds: string[] = DEMO_STUDENT_IDS) {
  const bandRemaining: Record<DemoBand, number> = { ...DEMO_BAND_TARGETS }
  const map = new Map<string, DemoTrajectory>()

  studentIds.forEach((studentId, index) => {
    const special = SPECIAL_TRAJECTORIES[index]
    if (special) {
      bandRemaining[special.band] -= 1
      map.set(studentId, { ...special, studentId, special: true })
    }
  })

  const normalBandSequence: DemoBand[] = [
    ...Array.from({ length: bandRemaining.mid }, () => 'mid' as const),
    ...Array.from({ length: bandRemaining.high }, () => 'high' as const),
    ...Array.from({ length: bandRemaining.low }, () => 'low' as const),
  ]

  let normalCursor = 0
  studentIds.forEach((studentId, index) => {
    if (map.has(studentId)) return
    const band = normalBandSequence[normalCursor] ?? 'mid'
    normalCursor += 1
    map.set(studentId, {
      studentId,
      band,
      pattern: normalPatternForBand(band),
      special: false,
      tt1Pct: normalPctForBand(index, band, 'tt1Pct'),
      tt2Pct: normalPctForBand(index, band, 'tt2Pct'),
      quizPct: normalPctForBand(index, band, 'quizPct'),
      assignmentPct: normalPctForBand(index, band, 'assignmentPct'),
      attendancePct: normalPctForBand(index, band, 'attendancePct'),
      seePct: normalPctForBand(index, band, 'seePct'),
    })
  })

  return map
}

export function summarizeDemoTrajectoryMap(map: Map<string, DemoTrajectory>) {
  const bands: Record<DemoBand, number> = { mid: 0, high: 0, low: 0 }
  const patterns: Record<string, number> = {}
  let specialCount = 0
  for (const trajectory of Array.from(map.values())) {
    bands[trajectory.band] += 1
    patterns[trajectory.pattern] = (patterns[trajectory.pattern] ?? 0) + 1
    if (trajectory.special) specialCount += 1
  }
  return {
    total: map.size,
    bands,
    patterns,
    specialCount,
    sectionCounts: {
      A: Array.from(map.keys()).filter(studentId => Number(studentId.slice(-3)) <= DEMO_SECTION_SIZE).length,
      B: Array.from(map.keys()).filter(studentId => Number(studentId.slice(-3)) > DEMO_SECTION_SIZE).length,
    },
  }
}

export function assertDemoTrajectoryContract(map: Map<string, DemoTrajectory>) {
  const summary = summarizeDemoTrajectoryMap(map)
  if (summary.total !== DEMO_STUDENT_COUNT) throw new Error(`Expected ${DEMO_STUDENT_COUNT} demo students, got ${summary.total}`)
  for (const band of Object.keys(DEMO_BAND_TARGETS) as DemoBand[]) {
    if (summary.bands[band] !== DEMO_BAND_TARGETS[band]) {
      throw new Error(`Expected ${DEMO_BAND_TARGETS[band]} ${band} students, got ${summary.bands[band]}`)
    }
  }
  if (summary.specialCount !== SPECIAL_TRAJECTORIES.length) throw new Error(`Expected ${SPECIAL_TRAJECTORIES.length} special-case students, got ${summary.specialCount}`)
  for (const special of SPECIAL_TRAJECTORIES) {
    if (!summary.patterns[special.pattern]) throw new Error(`Missing special trajectory pattern ${special.pattern}`)
  }
  if (summary.sectionCounts.A !== DEMO_SECTION_SIZE || summary.sectionCounts.B !== DEMO_SECTION_SIZE) {
    throw new Error(`Expected 60/60 section split, got ${summary.sectionCounts.A}/${summary.sectionCounts.B}`)
  }
  return summary
}

export function trajectoryPctForKind(trajectory: DemoTrajectory, kind: 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'finals') {
  if (kind === 'finals') return trajectory.seePct
  if (kind === 'assignment') return trajectory.assignmentPct
  if (kind === 'quiz') return trajectory.quizPct
  if (kind === 'tt2') return trajectory.tt2Pct
  return trajectory.tt1Pct
}

function deterministicScore(studentIndex: number, componentId: string, maxScore: number, pct: number) {
  const variedPct = Math.max(0, Math.min(1, pct + deterministicVariation(studentIndex, componentId, 0.045)))
  return Math.max(0, Math.min(maxScore, Math.round(variedPct * maxScore)))
}

export function generateDemoMarksPayload(input: {
  kind: 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'finals'
  studentIds?: string[]
  trajectoryMap?: Map<string, DemoTrajectory>
  components: DemoComponent[]
}): DemoMarkEntry[] {
  const studentIds = input.studentIds ?? DEMO_STUDENT_IDS
  const trajectoryMap = input.trajectoryMap ?? buildDemoTrajectoryMap(studentIds)
  return studentIds.map((studentId, index) => {
    const trajectory = trajectoryMap.get(studentId)
    if (!trajectory) throw new Error(`Missing demo trajectory for ${studentId}`)
    const pct = trajectoryPctForKind(trajectory, input.kind)
    return {
      studentId,
      components: input.components.map(component => ({
        componentCode: component.id,
        score: deterministicScore(index, component.id, component.maxScore, pct),
        maxScore: component.maxScore,
      })),
    }
  })
}

export function percentFromEntry(entry: DemoMarkEntry) {
  const scored = entry.components.reduce((sum, component) => sum + component.score, 0)
  const maximum = entry.components.reduce((sum, component) => sum + component.maxScore, 0)
  return maximum > 0 ? Math.round((scored / maximum) * 10000) / 100 : 0
}
