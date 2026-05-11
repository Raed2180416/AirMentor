import { describe, expect, it } from 'vitest'
import { inferObservableRisk } from '../src/lib/inference-engine.js'
import { nullablePct, roundNullablePct } from '../src/lib/proof-evidence-normalization.js'
import { DEFAULT_POLICY } from '../src/modules/admin-structure.js'

describe('proof evidence normalization', () => {
  it('preserves missing assessment evidence separately from true numeric zero', () => {
    expect(nullablePct(undefined)).toBeNull()
    expect(nullablePct(null)).toBeNull()
    expect(nullablePct(Number.NaN)).toBeNull()
    expect(nullablePct('')).toBeNull()
    expect(nullablePct(0)).toBe(0)
    expect(nullablePct(37.25)).toBe(37.25)
  })

  it('rounds visible percentages without converting missing evidence to zero', () => {
    expect(roundNullablePct(undefined)).toBeNull()
    expect(roundNullablePct(null)).toBeNull()
    expect(roundNullablePct(0)).toBe(0)
    expect(roundNullablePct(37.26)).toBe(37.3)
  })

  it('does not emit TT2 or SEE zero-mark drivers for missing evidence', () => {
    const inferred = inferObservableRisk({
      attendancePct: 82,
      currentCgpa: 7.1,
      backlogCount: 0,
      tt1Pct: 58,
      tt2Pct: null,
      seePct: null,
      quizPct: null,
      assignmentPct: null,
      weakCoCount: 0,
      attendanceHistoryRiskCount: 0,
      questionWeaknessCount: 0,
      interventionResponseScore: null,
      policy: DEFAULT_POLICY,
    })

    const labels = inferred.observableDrivers.map(driver => driver.label)
    expect(labels.join('\\n')).not.toMatch(/TT2.*0%|SEE.*0%/)
    expect(inferred.observableDrivers.map(driver => driver.feature)).not.toContain('tt2')
    expect(inferred.observableDrivers.map(driver => driver.feature)).not.toContain('see')
  })

  it('keeps actual numeric zero available for visible poor-performance drivers', () => {
    const inferred = inferObservableRisk({
      attendancePct: 82,
      currentCgpa: 7.1,
      backlogCount: 0,
      tt1Pct: 58,
      tt2Pct: 0,
      seePct: 0,
      quizPct: null,
      assignmentPct: null,
      weakCoCount: 0,
      attendanceHistoryRiskCount: 0,
      questionWeaknessCount: 0,
      interventionResponseScore: null,
      policy: DEFAULT_POLICY,
    })

    const labels = inferred.observableDrivers.map(driver => driver.label).join('\\n')
    expect(labels).toMatch(/TT2 performance is very low \(0%\)/)
    expect(labels).toMatch(/SEE performance is very low \(0%\)/)
  })
})
