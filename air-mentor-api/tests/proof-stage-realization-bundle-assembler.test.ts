import { describe, expect, it } from 'vitest'
import {
  assemblePlaybackGovernanceRealizationData,
  buildDefaultSeverityContext,
  buildSeverityContextByStudentId,
  inferHeuristicRiskBand,
} from '../src/lib/proof-stage-realization-bundle-assembler.js'
import type {
  InterventionRowForFetcher,
  LatentStateRowForFetcher,
} from '../src/lib/proof-stage-realization-data-fetcher.js'
import type {
  InterventionSeverityContext,
} from '../src/lib/proof-intervention-response-types.js'

describe('bundle-assembler · inferHeuristicRiskBand', () => {
  it('High when cgpa < 4.5 regardless of backlog', () => {
    expect(inferHeuristicRiskBand({ cgpa: 4.4, backlogCount: 0 })).toBe('High')
    expect(inferHeuristicRiskBand({ cgpa: 3.0, backlogCount: 0 })).toBe('High')
  })

  it('High when backlog >= 2 regardless of cgpa', () => {
    expect(inferHeuristicRiskBand({ cgpa: 8.5, backlogCount: 2 })).toBe('High')
    expect(inferHeuristicRiskBand({ cgpa: 9.5, backlogCount: 3 })).toBe('High')
  })

  it('Medium when cgpa < 7.0 (and not High)', () => {
    expect(inferHeuristicRiskBand({ cgpa: 6.9, backlogCount: 0 })).toBe('Medium')
    expect(inferHeuristicRiskBand({ cgpa: 5.5, backlogCount: 0 })).toBe('Medium')
  })

  it('Medium when backlog = 1 (and not High)', () => {
    expect(inferHeuristicRiskBand({ cgpa: 8.0, backlogCount: 1 })).toBe('Medium')
  })

  it('Low when cgpa >= 7.0 and backlog = 0', () => {
    expect(inferHeuristicRiskBand({ cgpa: 7.0, backlogCount: 0 })).toBe('Low')
    expect(inferHeuristicRiskBand({ cgpa: 8.5, backlogCount: 0 })).toBe('Low')
    expect(inferHeuristicRiskBand({ cgpa: 9.9, backlogCount: 0 })).toBe('Low')
  })

  it('null cgpa defaults to 6 (Medium band)', () => {
    expect(inferHeuristicRiskBand({ cgpa: null, backlogCount: 0 })).toBe('Medium')
  })

  it('null backlog defaults to 0', () => {
    expect(inferHeuristicRiskBand({ cgpa: 8.0, backlogCount: null })).toBe('Low')
  })
})

describe('bundle-assembler · buildDefaultSeverityContext', () => {
  it('fills sensible defaults for null inputs', () => {
    const ctx = buildDefaultSeverityContext({ cgpa: null, backlogCount: null })
    expect(ctx).toEqual({ riskBand: 'Medium', cgpa: 6, backlogCount: 0 })
  })

  it('propagates cgpa and backlogCount when provided', () => {
    const ctx = buildDefaultSeverityContext({ cgpa: 5.1, backlogCount: 2 })
    expect(ctx).toEqual({ riskBand: 'High', cgpa: 5.1, backlogCount: 2 })
  })
})

describe('bundle-assembler · buildSeverityContextByStudentId', () => {
  it('builds heuristic severity contexts from student summaries', () => {
    const map = buildSeverityContextByStudentId({
      summaries: [
        { studentId: 'a', cgpa: 8.5, backlogCount: 0 },
        { studentId: 'b', cgpa: 5.8, backlogCount: 1 },
        { studentId: 'c', cgpa: 3.2, backlogCount: 3 },
      ],
    })
    expect(map.get('a')).toEqual({ riskBand: 'Low', cgpa: 8.5, backlogCount: 0 })
    expect(map.get('b')).toEqual({ riskBand: 'Medium', cgpa: 5.8, backlogCount: 1 })
    expect(map.get('c')).toEqual({ riskBand: 'High', cgpa: 3.2, backlogCount: 3 })
  })

  it('explicit override wins over heuristic', () => {
    const explicit: InterventionSeverityContext = { riskBand: 'High', cgpa: 8.5, backlogCount: 0 }
    const map = buildSeverityContextByStudentId({
      summaries: [
        { studentId: 'a', cgpa: 8.5, backlogCount: 0 },
      ],
      override: new Map([['a', explicit]]),
    })
    expect(map.get('a')).toEqual(explicit)
  })

  it('empty summaries -> empty map', () => {
    const map = buildSeverityContextByStudentId({ summaries: [] })
    expect(map.size).toBe(0)
  })
})

describe('bundle-assembler · assemblePlaybackGovernanceRealizationData', () => {
  function intervention(overrides: Partial<InterventionRowForFetcher> = {}): InterventionRowForFetcher {
    return {
      interventionId: overrides.interventionId ?? 'intv_x',
      studentId: overrides.studentId ?? 'stud_1',
      offeringId: overrides.offeringId ?? 'offr_1',
      interventionType: overrides.interventionType ?? 'mentor-check-in',
      occurredAt: overrides.occurredAt ?? '2026-04-10T08:00:00Z',
      createdAt: overrides.createdAt ?? '2026-04-10T08:00:01Z',
    }
  }

  function latent(studentId: string, semesterNumber: number): LatentStateRowForFetcher {
    return {
      studentId,
      semesterNumber,
      latentStateJson: JSON.stringify({
        dynamics: { consistency: 0.6 },
        behavior: { practiceCompliance: 0.55 },
        intervention: { interventionReceptivity: 0.65 },
      }),
    }
  }

  const severity: InterventionSeverityContext = { riskBand: 'High', cgpa: 5.2, backlogCount: 1 }

  it('returns an empty bundle when no inputs', () => {
    const bundle = assemblePlaybackGovernanceRealizationData({
      runSeed: 10,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      interventionRows: [],
      latentStateRows: [],
      severityContextByStudentId: new Map(),
    })
    expect(bundle.runSeed).toBe(10)
    expect(bundle.studentProfileByStudentId.size).toBe(0)
    expect(bundle.interventionsInWindowBySourceKey.size).toBe(0)
  })

  it('wires studentProfile + interventions under matching source-key', () => {
    const bundle = assemblePlaybackGovernanceRealizationData({
      runSeed: 42,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      interventionRows: [intervention({ studentId: 'stud_1', offeringId: 'offr_1' })],
      latentStateRows: [latent('stud_1', 3)],
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    expect(bundle.runSeed).toBe(42)
    expect(bundle.studentProfileByStudentId.get('stud_1')).toBeDefined()
    expect(bundle.studentProfileByStudentId.get('stud_1')!.intervention.interventionReceptivity).toBeCloseTo(0.65)
    const group = bundle.interventionsInWindowBySourceKey.get('stud_1::offr_1')!
    expect(group).toBeDefined()
    expect(group.length).toBe(1)
    expect(group[0]!.actionCode).toBe('mentor_meeting')
    expect(group[0]!.severityContext).toEqual(severity)
  })

  it('semester filter excludes latent rows from other semesters', () => {
    const bundle = assemblePlaybackGovernanceRealizationData({
      runSeed: 1,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      interventionRows: [intervention({ studentId: 'stud_1' })],
      latentStateRows: [latent('stud_1', 3), latent('stud_out', 4)],
      severityContextByStudentId: new Map([['stud_1', severity], ['stud_out', severity]]),
    })
    expect(bundle.studentProfileByStudentId.has('stud_1')).toBe(true)
    expect(bundle.studentProfileByStudentId.has('stud_out')).toBe(false)
  })

  it('dropped no-action rows are not in the bundle', () => {
    const bundle = assemblePlaybackGovernanceRealizationData({
      runSeed: 1,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      interventionRows: [
        intervention({ interventionId: 'i1', interventionType: 'no-action' }),
        intervention({ interventionId: 'i2', interventionType: 'targeted-tutoring' }),
      ],
      latentStateRows: [latent('stud_1', 3)],
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    const group = bundle.interventionsInWindowBySourceKey.get('stud_1::offr_1')!
    expect(group.length).toBe(1)
    expect(group[0]!.caseId).toBe('i2')
  })

  it('deterministic across repeated invocations', () => {
    const args = {
      runSeed: 5,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1' as const,
      interventionRows: [
        intervention({ interventionId: 'a' }),
        intervention({ interventionId: 'b', occurredAt: '2026-04-11T08:00:00Z' }),
      ],
      latentStateRows: [latent('stud_1', 3)],
      severityContextByStudentId: new Map([['stud_1', severity]]),
    }
    const first = assemblePlaybackGovernanceRealizationData(args)
    for (let i = 0; i < 10; i++) {
      const rerun = assemblePlaybackGovernanceRealizationData(args)
      expect(rerun.runSeed).toBe(first.runSeed)
      expect([...rerun.interventionsInWindowBySourceKey.keys()])
        .toEqual([...first.interventionsInWindowBySourceKey.keys()])
    }
  })
})
