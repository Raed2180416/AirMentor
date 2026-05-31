import { describe, expect, it } from 'vitest'
import {
  DEMO_STUDENT_IDS,
  assertDemoTrajectoryContract,
  buildDemoTrajectoryMap,
  generateDemoMarksPayload,
  percentFromEntry,
} from '../tests-e2e/helpers/demo-seeding-contract'

describe('demo seeding contract', () => {
  it('keeps the canonical 120-student distribution auditable', () => {
    const summary = assertDemoTrajectoryContract(buildDemoTrajectoryMap())

    expect(summary.total).toBe(120)
    expect(summary.bands).toEqual({ mid: 80, high: 20, low: 20 })
    expect(summary.specialCount).toBe(10)
    expect(summary.sectionCounts).toEqual({ A: 60, B: 60 })
    expect(summary.patterns['mediocre-flat']).toBeGreaterThan(0)
    expect(summary.patterns['fluctuating-resilient']).toBeGreaterThan(0)
    expect(summary.patterns['strong-start-fade']).toBeGreaterThan(0)
    expect(summary.patterns['slow-starter-bad-attendance']).toBeGreaterThan(0)
  })

  it('generates bounded component payloads for every demo student', () => {
    const entries = generateDemoMarksPayload({
      kind: 'tt1',
      studentIds: DEMO_STUDENT_IDS,
      components: [
        { id: 'tt1-q1-p1', maxScore: 4 },
        { id: 'tt1-q1-p2', maxScore: 3 },
        { id: 'tt1-q2-p1', maxScore: 6 },
        { id: 'tt1-q3-p1', maxScore: 6 },
        { id: 'tt1-q4-p1', maxScore: 6 },
      ],
    })

    expect(entries).toHaveLength(120)
    expect(entries.every(entry => entry.components.every(component => component.score >= 0 && component.score <= component.maxScore))).toBe(true)
    expect(percentFromEntry(entries[0])).toBeGreaterThanOrEqual(0)
    expect(percentFromEntry(entries[0])).toBeLessThanOrEqual(100)
  })
})
