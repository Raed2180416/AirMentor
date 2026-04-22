import { describe, expect, it } from 'vitest'
import {
  buildLatestHistoricalPayloadByStudent,
  resolveRuntimeCurrentSemesterNumber,
} from '../src/lib/proof-control-plane-runtime-service.js'

describe('proof-control-plane-runtime-service', () => {
  it('prefers the active operational semester over terminal-semester residue', () => {
    const semesterNumber = resolveRuntimeCurrentSemesterNumber({
      activeOperationalSemester: 1,
      semesterEnd: 6,
    }, [
      {
        studentId: 'student_001',
        semesterNumber: 1,
        observedStateJson: '{}',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        studentId: 'student_001',
        semesterNumber: 6,
        observedStateJson: '{}',
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
    ])

    expect(semesterNumber).toBe(1)
  })

  it('exposes no prior cgpa/backlog baseline before semester 1', () => {
    const historical = buildLatestHistoricalPayloadByStudent([
      {
        studentId: 'student_001',
        semesterNumber: 1,
        observedStateJson: JSON.stringify({
          cgpaAfterSemester: 7.2,
          backlogCount: 1,
        }),
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ], 1)

    expect(historical.size).toBe(0)
  })
})
