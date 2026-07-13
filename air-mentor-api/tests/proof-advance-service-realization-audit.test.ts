// Phase-6c test: buildStageRealizationAppliedAuditPayload helper + flag check.
// Exercises the extracted pure helpers so we don't need a full DB mock. The
// integration-level assertion (that persistResolvedAdvance calls emitSimulationAudit
// with this payload when flag is on) is covered by the wire being a single-line
// call to buildStageRealizationAppliedAuditPayload + isStageRealizationAuditEnabled.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STAGE_REALIZATION_FLAG_NAME,
} from '../src/lib/proof-stage-realization-evidence-applier.js'
import {
  buildStageRealizationAppliedAuditPayload,
  isStageRealizationAuditEnabled,
  type ProofAdvanceResolution,
} from '../src/adapters/simulation/proof-control-plane-advance-service.js'

function makeResolution(overrides: Partial<ProofAdvanceResolution> = {}): ProofAdvanceResolution {
  return {
    mode: overrides.mode ?? 'next-stage',
    previous: overrides.previous ?? {
      chainIndex: 0,
      positionId: 'pos_0',
      previousPositionId: null,
      nextPositionId: 'pos_1',
      semesterNumber: 1,
      stageKey: 'pre-tt1',
      stageOrder: 0,
      occurredAt: '2026-03-16T00:00:00Z',
    },
    current: overrides.current ?? {
      chainIndex: 1,
      positionId: 'pos_1',
      previousPositionId: 'pos_0',
      nextPositionId: 'pos_2',
      semesterNumber: 1,
      stageKey: 'post-tt1',
      stageOrder: 1,
      occurredAt: '2026-04-13T00:00:00Z',
    },
    next: overrides.next ?? null,
    simulatedDateIso: overrides.simulatedDateIso ?? '2026-04-13T00:00:00Z',
    stageTransitioned: overrides.stageTransitioned ?? true,
    crossedSemesterBoundary: overrides.crossedSemesterBoundary ?? false,
    terminalLifecyclePreserved: overrides.terminalLifecyclePreserved ?? false,
    lifecycleState: overrides.lifecycleState ?? 'active',
    nextBoundaryAt: overrides.nextBoundaryAt ?? null,
    autoResolutionMode: overrides.autoResolutionMode ?? null,
  }
}

describe('advance-service · Phase-6c buildStageRealizationAppliedAuditPayload', () => {
  it('captures transitionFrom + transitionTo with semester and stage', () => {
    const resolution = makeResolution()
    const payload = buildStageRealizationAppliedAuditPayload({ resolution })
    expect(payload.transitionFrom).toEqual({ semesterNumber: 1, stageKey: 'pre-tt1' })
    expect(payload.transitionTo).toEqual({ semesterNumber: 1, stageKey: 'post-tt1' })
  })

  it('propagates crossedSemesterBoundary flag', () => {
    const truthy = buildStageRealizationAppliedAuditPayload({
      resolution: makeResolution({ crossedSemesterBoundary: true }),
    })
    expect(truthy.crossedSemesterBoundary).toBe(true)

    const falsy = buildStageRealizationAppliedAuditPayload({
      resolution: makeResolution({ crossedSemesterBoundary: false }),
    })
    expect(falsy.crossedSemesterBoundary).toBe(false)
  })

  it('records realizationFlag name constant + deterministic note', () => {
    const payload = buildStageRealizationAppliedAuditPayload({ resolution: makeResolution() })
    expect(payload.realizationFlag).toBe(STAGE_REALIZATION_FLAG_NAME)
    expect(payload.note).toContain('Phase 6d')
  })

  it('is bytewise deterministic for identical resolutions', () => {
    const resolution = makeResolution()
    const first = buildStageRealizationAppliedAuditPayload({ resolution })
    for (let i = 0; i < 20; i++) {
      expect(buildStageRealizationAppliedAuditPayload({ resolution })).toEqual(first)
    }
  })

  it('reflects cross-semester boundary case (end of semester)', () => {
    const payload = buildStageRealizationAppliedAuditPayload({
      resolution: makeResolution({
        previous: {
          chainIndex: 4,
          positionId: 'pos_4',
          previousPositionId: 'pos_3',
          nextPositionId: 'pos_5',
          semesterNumber: 1,
          stageKey: 'post-see',
          stageOrder: 4,
          occurredAt: '2026-06-15T00:00:00Z',
        },
        current: {
          chainIndex: 5,
          positionId: 'pos_5',
          previousPositionId: 'pos_4',
          nextPositionId: 'pos_6',
          semesterNumber: 2,
          stageKey: 'pre-tt1',
          stageOrder: 0,
          occurredAt: '2026-07-27T00:00:00Z',
        },
        crossedSemesterBoundary: true,
      }),
    })
    expect(payload.transitionFrom).toEqual({ semesterNumber: 1, stageKey: 'post-see' })
    expect(payload.transitionTo).toEqual({ semesterNumber: 2, stageKey: 'pre-tt1' })
    expect(payload.crossedSemesterBoundary).toBe(true)
  })
})

describe('advance-service · Phase-6c isStageRealizationAuditEnabled', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('returns false when flag unset', () => {
    expect(isStageRealizationAuditEnabled()).toBe(false)
  })

  it('returns true when flag=1', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
    expect(isStageRealizationAuditEnabled()).toBe(true)
  })

  it('returns false for non-"1" truthy values', () => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = 'true'
    expect(isStageRealizationAuditEnabled()).toBe(false)
    process.env[STAGE_REALIZATION_FLAG_NAME] = '0'
    expect(isStageRealizationAuditEnabled()).toBe(false)
    process.env[STAGE_REALIZATION_FLAG_NAME] = ''
    expect(isStageRealizationAuditEnabled()).toBe(false)
  })
})
