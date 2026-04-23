// Phase 1-6d full-stack end-to-end integration test.
//
// Exercises the entire pipeline in a single test scope — from raw legacy DB row
// shapes (free-text interventionType + JSON latentStateJson blob) through the
// data-fetcher -> bundle-assembler -> evidence-applier chain and asserts hard
// invariants on the resulting realized evidence. Mirrors the logic of the
// reproducible demo at scripts/demo-stage-realization-flow.mjs so CI catches
// regressions the demo would catch.
//
// No DB dependency. Purely synthetic fixtures. Deterministic.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyRealizationToEvidenceSnapshot,
  STAGE_REALIZATION_FLAG_NAME,
} from '../src/lib/proof-stage-realization-evidence-applier.js'
import {
  groupInterventionsByStudentAndOffering,
  mapLegacyInterventionTypeToActionCode,
  parseLatentProfileForIntervention,
} from '../src/lib/proof-stage-realization-data-fetcher.js'
import {
  buildSeverityContextByStudentId,
} from '../src/lib/proof-stage-realization-bundle-assembler.js'

const SYNTHETIC_LATENT_JSON = JSON.stringify({
  dynamics: {
    forgetRate: 0.09, relearnRate: 0.55, transferGainRate: 0.42,
    studyGainRate: 0.55, fatigueRate: 0.08, consistency: 0.62,
    volatility: 0.2, recoveryTendency: 0.55, relapseTendency: 0.18,
  },
  behavior: {
    practiceCompliance: 0.78,
    helpSeekingTendency: 0.45,
    examPressure: 0.32,
  },
  intervention: {
    interventionReceptivity: 0.82,
    temporaryUpliftCredit: 0.11,
    expectedRecoveryThreshold: 0.10,
  },
})

const BASELINE = {
  attendancePct: 78,
  tt1Pct: 55,
  tt2Pct: 50,
  quizPct: 58,
  assignmentPct: 62,
  seePct: 46,
  cePct: 55,
}

function interventionRow(interventionId: string, interventionType: string, occurredAt: string) {
  return {
    interventionId,
    studentId: 'stud_demo',
    offeringId: 'offr_demo',
    interventionType,
    occurredAt,
    createdAt: occurredAt,
  }
}

function runPipeline(rows: ReturnType<typeof interventionRow>[]) {
  const profile = parseLatentProfileForIntervention(SYNTHETIC_LATENT_JSON)!
  const severity = buildSeverityContextByStudentId({
    summaries: [{ studentId: 'stud_demo', cgpa: 5.6, backlogCount: 1 }],
  })
  const grouped = groupInterventionsByStudentAndOffering({
    interventionRows: rows,
    semesterNumber: 3,
    stageKeyApplied: 'pre-tt1',
    severityContextByStudentId: severity,
  })
  const interventionsInWindow = grouped.get('stud_demo::offr_demo') ?? []
  return applyRealizationToEvidenceSnapshot({
    baseline: BASELINE,
    studentProfile: profile,
    runId: 'run_e2e',
    studentId: 'stud_demo',
    semesterNumber: 3,
    stageKey: 'post-tt2',
    interventionsInWindow,
  })
}

describe('E2E integration · legacy interventionType mapping (contract)', () => {
  it('every legacy kebab-case value maps deterministically to the enum set', () => {
    const cases: Array<[string, string | null]> = [
      ['mentor-check-in',                'mentor_meeting'],
      ['prerequisite-bridge',            'targeted_remedial_plan'],
      ['structured-study-plan',          'structured_study_plan'],
      ['targeted-tutoring',              'targeted_remedial_plan'],
      ['pre-see-rescue',                 'structured_study_plan'],
      ['outreach-plus-tutoring',         'targeted_remedial_plan'],
      ['attendance-recovery-follow-up',  'attendance_warning'],
      ['faculty-outreach',               'faculty_followup_reminder'],
      ['alert-only',                     'faculty_followup_reminder'],
      ['no-action',                       null],
      ['support',                        'generic_default_family_action'],
    ]
    for (const [legacy, expected] of cases) {
      expect(mapLegacyInterventionTypeToActionCode(legacy)).toBe(expected)
    }
  })
})

describe('E2E integration · three scenarios end-to-end', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('scenario A — no interventions: realized === baseline (identity)', () => {
    const result = runPipeline([])
    expect(result.flagOn).toBe(true)
    expect(result.impact.totalImpact).toBe(0)
    expect(result.impact.appliedCount).toBe(0)
    expect(result.realized.tt1Pct).toBe(BASELINE.tt1Pct)
    expect(result.realized.tt2Pct).toBe(BASELINE.tt2Pct)
    expect(result.realized.quizPct).toBe(BASELINE.quizPct)
    expect(result.realized.assignmentPct).toBe(BASELINE.assignmentPct)
    expect(result.realized.seePct).toBe(BASELINE.seePct)
    expect(result.realized.attendancePct).toBe(BASELINE.attendancePct)
  })

  it('scenario B — workflow-only (faculty_followup_reminder): realized === baseline', () => {
    const result = runPipeline([
      interventionRow('wf1', 'faculty-outreach', '2026-04-10T10:00:00Z'),
    ])
    expect(result.flagOn).toBe(true)
    // faculty_followup_reminder has zero responsiveness -> impact=0 -> deltas=0
    expect(result.impact.totalImpact).toBe(0)
    expect(result.realized.tt2Pct).toBe(BASELINE.tt2Pct)
    expect(result.realized.quizPct).toBe(BASELINE.quizPct)
  })

  it('scenario C — student-facing (targeted-tutoring + mentor-check-in): realized > baseline on responsive assessments', () => {
    const result = runPipeline([
      interventionRow('sf1', 'targeted-tutoring', '2026-04-10T10:00:00Z'),
      interventionRow('sf2', 'mentor-check-in',   '2026-04-12T10:00:00Z'),
    ])
    expect(result.flagOn).toBe(true)
    expect(result.impact.appliedCount).toBe(2)
    expect(result.impact.totalImpact).toBeGreaterThan(0)
    expect(result.impact.dominantTier).toBe('strong')
    // Responsive assessments strictly exceed baseline
    expect(result.realized.tt2Pct!).toBeGreaterThan(BASELINE.tt2Pct)
    expect(result.realized.quizPct!).toBeGreaterThan(BASELINE.quizPct)
    expect(result.realized.assignmentPct!).toBeGreaterThan(BASELINE.assignmentPct)
    expect(result.realized.seePct!).toBeGreaterThan(BASELINE.seePct)
    expect(result.realized.attendancePct).toBeGreaterThan(BASELINE.attendancePct)
    // TT1 responsiveness = 0 -> stays immutable
    expect(result.realized.tt1Pct).toBe(BASELINE.tt1Pct)
  })

  it('scenario C reference values stay stable for deterministic demo output', () => {
    // This pins the exact numbers the demo script prints so a change in the
    // engine heuristics gets surfaced in CI.
    const result = runPipeline([
      interventionRow('sf1', 'targeted-tutoring', '2026-04-10T10:00:00Z'),
      interventionRow('sf2', 'mentor-check-in',   '2026-04-12T10:00:00Z'),
    ])
    expect(result.impact.totalImpact).toBeCloseTo(0.95, 2)
    expect(result.realized.tt2Pct).toBe(64)
    expect(result.realized.quizPct).toBe(67)
    expect(result.realized.assignmentPct).toBe(73)
    expect(result.realized.seePct).toBe(59)
  })
})

describe('E2E integration · flag-off regression guard', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    delete process.env[STAGE_REALIZATION_FLAG_NAME]
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('flag off + student-facing intervention -> realized === baseline (bytewise)', () => {
    const result = runPipeline([
      interventionRow('sf1', 'targeted-tutoring', '2026-04-10T10:00:00Z'),
      interventionRow('sf2', 'mentor-check-in',   '2026-04-12T10:00:00Z'),
    ])
    expect(result.flagOn).toBe(false)
    expect(result.impact.totalImpact).toBe(0)
    expect(result.realized).toEqual(BASELINE)
  })
})

describe('E2E integration · determinism across repeat runs', () => {
  const originalFlag = process.env[STAGE_REALIZATION_FLAG_NAME]

  beforeEach(() => {
    process.env[STAGE_REALIZATION_FLAG_NAME] = '1'
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[STAGE_REALIZATION_FLAG_NAME]
    else process.env[STAGE_REALIZATION_FLAG_NAME] = originalFlag
  })

  it('scenario C is bytewise deterministic across 20 repeat invocations', () => {
    const rows = [
      interventionRow('sf1', 'targeted-tutoring', '2026-04-10T10:00:00Z'),
      interventionRow('sf2', 'mentor-check-in',   '2026-04-12T10:00:00Z'),
    ]
    const first = runPipeline(rows)
    for (let i = 0; i < 20; i++) {
      const repeat = runPipeline(rows)
      expect(repeat.realized).toEqual(first.realized)
      expect(repeat.impact.totalImpact).toBe(first.impact.totalImpact)
      expect(repeat.impact.markDeltas).toEqual(first.impact.markDeltas)
    }
  })
})
