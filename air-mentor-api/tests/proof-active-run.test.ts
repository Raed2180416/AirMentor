import { describe, expect, it } from 'vitest'
import {
  isActiveProofRunCandidate,
  pickMostRecentActiveRun,
} from '../src/lib/proof-active-run.js'

describe('proof active run selector', () => {
  it('ignores more recent rows that are not active when lifecycle signals exist', () => {
    const selected = pickMostRecentActiveRun([
      {
        updatedAt: '2026-04-05T00:00:00.000Z',
        createdAt: '2026-04-05T00:00:00.000Z',
        activeOperationalSemester: 2,
        runLabel: 'Completed newer run',
        activeFlag: 0,
        status: 'completed',
      },
      {
        updatedAt: '2026-04-04T00:00:00.000Z',
        createdAt: '2026-04-04T00:00:00.000Z',
        activeOperationalSemester: 1,
        runLabel: 'Active older run',
        activeFlag: 1,
        status: 'completed',
      },
    ])

    expect(selected?.runLabel).toBe('Active older run')
  })

  it('returns null when lifecycle signals exist but none of the rows are active', () => {
    const selected = pickMostRecentActiveRun([
      {
        updatedAt: '2026-04-05T00:00:00.000Z',
        createdAt: '2026-04-05T00:00:00.000Z',
        activeOperationalSemester: 2,
        runLabel: 'Archived run',
        activeFlag: 0,
        status: 'archived',
      },
    ])

    expect(selected).toBeNull()
    expect(isActiveProofRunCandidate({
      updatedAt: '2026-04-05T00:00:00.000Z',
      createdAt: '2026-04-05T00:00:00.000Z',
      activeOperationalSemester: 2,
      runLabel: 'Archived run',
      activeFlag: 0,
      status: 'archived',
    })).toBe(false)
  })
})
