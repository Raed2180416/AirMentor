// Track C section-override applier (Phase 1 pure module).
//
// Applies per-section latent-profile shifts to a student trajectory's
// derived latent scalars (practiceCompliance, interventionReceptivity,
// examPressure, helpSeekingTendency, attendancePropensity, consistency,
// volatility). Used so HoD/Faculty can tune section-B vs section-A to
// match real-world MSRUAS priors ("section B struggles more with self-
// regulation"). Section-level mean shift + per-student deterministic
// jitter preserves within-section variance.
//
// Feature flag: AIRMENTOR_SECTION_OVERRIDES_V1. When unset / 0, the
// applier is a no-op — callers pass through the original trajectory
// untouched so baseline simulation is byte-identical to pre-Track-C
// behavior.
//
// Pure fn: no DB / filesystem I/O. Deterministic by (studentId, scalar)
// seed. Safe to call in unit tests without any setup.

import { createHash } from 'node:crypto'

// ---------- Section-overrides JSON shape ----------

export type SectionOverrideScalars = {
  practiceCompliance?: number | null
  interventionReceptivity?: number | null
  examPressure?: number | null
  helpSeekingTendency?: number | null
  attendancePropensity?: number | null
  consistency?: number | null
  volatility?: number | null
}

export type SectionOverrides = Record<string, SectionOverrideScalars>

// ---------- Trajectory sub-shape the applier touches ----------

// Deliberately structural — not imported from msruas-proof-control-plane.ts
// so this module is trivially unit-testable without DB/type-graph deps.
export type ProfileLatentForOverride = {
  behavior: {
    practiceCompliance: number
    helpSeekingTendency: number
    examPressure: number
    attendancePropensity: number
  }
  dynamics: {
    consistency: number
    volatility: number
  }
  intervention: {
    interventionReceptivity: number
  }
}

// ---------- Bounds (MSRUAS-realistic priors, per audit-map/32-reports/track-c-section-sliders-design.md) ----------

export const BOUND_LATENT_SHIFT = 0.15
export const BOUND_LATENT_MIN = 0.2
export const BOUND_LATENT_MAX = 0.9
export const BOUND_PER_STUDENT_JITTER = 0.06

export const SECTION_OVERRIDE_FLAG_NAME = 'AIRMENTOR_SECTION_OVERRIDES_V1'

// ---------- Deterministic seeded noise ----------

function stableUnit(seed: string): number {
  // Deterministic [0, 1) from a string seed. Reads first 6 bytes (48 bits)
  // of sha-256 as big-endian unsigned integer and divides by 2^48. Using 48
  // bits stays within JS's 53-bit Number safe-integer range so there is no
  // precision loss, and avoids signed-int32 overflow from `<<` / `|` bit ops.
  const hash = createHash('sha256').update(seed).digest()
  const v48 =
    hash[0] * 2 ** 40 +
    hash[1] * 2 ** 32 +
    hash[2] * 2 ** 24 +
    hash[3] * 2 ** 16 +
    hash[4] * 2 ** 8 +
    hash[5]
  return v48 / 2 ** 48
}

function stableBetween(seed: string, min: number, max: number): number {
  return min + stableUnit(seed) * (max - min)
}

// ---------- Parser ----------

export function parseSectionOverridesJson(
  json: string | null | undefined,
): SectionOverrides | null {
  if (!json || typeof json !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed == null) return null
  const record = parsed as Record<string, unknown>
  const result: SectionOverrides = {}
  for (const sectionCode of Object.keys(record)) {
    const entry = record[sectionCode]
    if (typeof entry !== 'object' || entry == null) continue
    const scalars = entry as Record<string, unknown>
    const sanitised: SectionOverrideScalars = {}
    for (const key of [
      'practiceCompliance',
      'interventionReceptivity',
      'examPressure',
      'helpSeekingTendency',
      'attendancePropensity',
      'consistency',
      'volatility',
    ] as const) {
      const value = scalars[key]
      if (value === null) {
        sanitised[key] = null
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        // Enforce MSRUAS bounds at parse time so downstream can trust the shape.
        if (value < BOUND_LATENT_MIN - 0.001 || value > BOUND_LATENT_MAX + 0.001) {
          sanitised[key] = null
        } else {
          sanitised[key] = Math.max(BOUND_LATENT_MIN, Math.min(BOUND_LATENT_MAX, value))
        }
      }
    }
    result[sectionCode] = sanitised
  }
  return result
}

// ---------- Applier ----------

export type ApplySectionOverrideInput = {
  latent: ProfileLatentForOverride
  sectionCode: string
  overrides: SectionOverrides | null | undefined
  studentId: string
  runSeed: string
}

export type ApplySectionOverrideResult = {
  latent: ProfileLatentForOverride
  applied: boolean
  shiftsBySclalar: Partial<Record<keyof SectionOverrideScalars, number>>
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function shiftScalar(params: {
  target: number | null | undefined
  current: number
  studentId: string
  sectionCode: string
  scalarName: string
  runSeed: string
}): { next: number; shift: number } {
  const { target, current, studentId, sectionCode, scalarName, runSeed } = params
  if (target == null) {
    return { next: current, shift: 0 }
  }
  const rawShift = target - current
  const cappedShift = clamp(rawShift, -BOUND_LATENT_SHIFT, BOUND_LATENT_SHIFT)
  // Per-student jitter preserves within-section variance. Deterministic
  // seed per (runSeed, studentId, sectionCode, scalar) so replays match.
  const jitter = stableBetween(
    `section-override-v1/${runSeed}/${sectionCode}/${studentId}/${scalarName}`,
    -BOUND_PER_STUDENT_JITTER,
    BOUND_PER_STUDENT_JITTER,
  )
  const candidate = current + cappedShift + jitter
  const next = clamp(candidate, BOUND_LATENT_MIN, BOUND_LATENT_MAX)
  return { next, shift: next - current }
}

export function applySectionOverridesToProfile(
  input: ApplySectionOverrideInput,
): ApplySectionOverrideResult {
  const flag = process.env[SECTION_OVERRIDE_FLAG_NAME]
  const flagOn = flag === '1'
  if (!flagOn || !input.overrides) {
    return { latent: input.latent, applied: false, shiftsBySclalar: {} }
  }
  const sectionOverride = input.overrides[input.sectionCode]
  if (!sectionOverride) {
    return { latent: input.latent, applied: false, shiftsBySclalar: {} }
  }
  const shifts: Partial<Record<keyof SectionOverrideScalars, number>> = {}
  const mk = (scalarName: keyof SectionOverrideScalars, current: number): number => {
    const { next, shift } = shiftScalar({
      target: sectionOverride[scalarName],
      current,
      studentId: input.studentId,
      sectionCode: input.sectionCode,
      scalarName: String(scalarName),
      runSeed: input.runSeed,
    })
    if (shift !== 0) shifts[scalarName] = shift
    return next
  }
  const latent: ProfileLatentForOverride = {
    behavior: {
      practiceCompliance: mk('practiceCompliance', input.latent.behavior.practiceCompliance),
      helpSeekingTendency: mk('helpSeekingTendency', input.latent.behavior.helpSeekingTendency),
      examPressure: mk('examPressure', input.latent.behavior.examPressure),
      attendancePropensity: mk('attendancePropensity', input.latent.behavior.attendancePropensity),
    },
    dynamics: {
      consistency: mk('consistency', input.latent.dynamics.consistency),
      volatility: mk('volatility', input.latent.dynamics.volatility),
    },
    intervention: {
      interventionReceptivity: mk('interventionReceptivity', input.latent.intervention.interventionReceptivity),
    },
  }
  return {
    latent,
    applied: Object.keys(shifts).length > 0,
    shiftsBySclalar: shifts,
  }
}
