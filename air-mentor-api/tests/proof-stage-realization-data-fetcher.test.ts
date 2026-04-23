import { describe, expect, it } from 'vitest'
import {
  buildEvidenceApplierInterventionInput,
  groupInterventionsByStudentAndOffering,
  mapLegacyInterventionTypeToActionCode,
  parseLatentProfileForIntervention,
  parseLatentProfilesForSemester,
  type InterventionRowForFetcher,
  type LatentStateRowForFetcher,
} from '../src/lib/proof-stage-realization-data-fetcher.js'
import type {
  InterventionSeverityContext,
} from '../src/lib/proof-intervention-response-types.js'

describe('data-fetcher · mapLegacyInterventionTypeToActionCode', () => {
  it('maps every legacy kebab-case value in the canonical table', () => {
    expect(mapLegacyInterventionTypeToActionCode('mentor-check-in')).toBe('mentor_meeting')
    expect(mapLegacyInterventionTypeToActionCode('mentor-outreach')).toBe('mentor_meeting')
    expect(mapLegacyInterventionTypeToActionCode('prerequisite-bridge')).toBe('targeted_remedial_plan')
    expect(mapLegacyInterventionTypeToActionCode('structured-study-plan')).toBe('structured_study_plan')
    expect(mapLegacyInterventionTypeToActionCode('targeted-tutoring')).toBe('targeted_remedial_plan')
    expect(mapLegacyInterventionTypeToActionCode('pre-see-rescue')).toBe('structured_study_plan')
    expect(mapLegacyInterventionTypeToActionCode('outreach-plus-tutoring')).toBe('targeted_remedial_plan')
    expect(mapLegacyInterventionTypeToActionCode('attendance-recovery-follow-up')).toBe('attendance_warning')
    expect(mapLegacyInterventionTypeToActionCode('faculty-outreach')).toBe('faculty_followup_reminder')
    expect(mapLegacyInterventionTypeToActionCode('alert-only')).toBe('faculty_followup_reminder')
    expect(mapLegacyInterventionTypeToActionCode('support')).toBe('generic_default_family_action')
  })

  it('drops no-action (returns null) so applier never counts it', () => {
    expect(mapLegacyInterventionTypeToActionCode('no-action')).toBeNull()
  })

  it('passes through canonical snake_case enum values unchanged', () => {
    expect(mapLegacyInterventionTypeToActionCode('targeted_remedial_plan')).toBe('targeted_remedial_plan')
    expect(mapLegacyInterventionTypeToActionCode('hod_escalation_student_action')).toBe('hod_escalation_student_action')
  })

  it('normalises kebab-case enum aliases -> snake_case', () => {
    // If a caller passes 'mentor_meeting' (already canonical) we keep it; if they
    // pass a kebab variant that matches canonical after hyphen->underscore, we
    // take the snake form.
    expect(mapLegacyInterventionTypeToActionCode('mentor_meeting')).toBe('mentor_meeting')
  })

  it('falls back to generic_default_family_action for unknown strings', () => {
    expect(mapLegacyInterventionTypeToActionCode('some-made-up-code')).toBe('generic_default_family_action')
    expect(mapLegacyInterventionTypeToActionCode('legacy_pre_launch_action')).toBe('generic_default_family_action')
  })

  it('returns null for null / undefined / empty / whitespace', () => {
    expect(mapLegacyInterventionTypeToActionCode(null)).toBeNull()
    expect(mapLegacyInterventionTypeToActionCode(undefined)).toBeNull()
    expect(mapLegacyInterventionTypeToActionCode('')).toBeNull()
    expect(mapLegacyInterventionTypeToActionCode('   ')).toBeNull()
  })

  it('is deterministic across repeated calls', () => {
    for (let i = 0; i < 50; i++) {
      expect(mapLegacyInterventionTypeToActionCode('mentor-check-in')).toBe('mentor_meeting')
    }
  })
})

describe('data-fetcher · parseLatentProfileForIntervention', () => {
  it('parses a full well-formed latent-state JSON blob', () => {
    const json = JSON.stringify({
      archetype: 'high-potential',
      readiness: { mathReadiness: 0.7 },
      dynamics: {
        forgetRate: 0.12,
        relearnRate: 0.58,
        transferGainRate: 0.42,
        studyGainRate: 0.48,
        fatigueRate: 0.09,
        consistency: 0.63,
        volatility: 0.21,
        recoveryTendency: 0.57,
        relapseTendency: 0.18,
      },
      behavior: {
        practiceCompliance: 0.66,
        helpSeekingTendency: 0.44,
        examPressure: 0.33,
      },
      intervention: {
        interventionReceptivity: 0.72,
        temporaryUpliftCredit: 0.14,
        expectedRecoveryThreshold: 0.11,
      },
    })
    const profile = parseLatentProfileForIntervention(json)!
    expect(profile).not.toBeNull()
    expect(profile.dynamics.relearnRate).toBeCloseTo(0.58, 3)
    expect(profile.behavior.practiceCompliance).toBeCloseTo(0.66, 3)
    expect(profile.intervention.interventionReceptivity).toBeCloseTo(0.72, 3)
  })

  it('fills fallback values for missing scalar fields', () => {
    const json = JSON.stringify({
      dynamics: {},      // empty -> all defaults
      behavior: {},
      intervention: {},
    })
    const profile = parseLatentProfileForIntervention(json)!
    expect(profile).not.toBeNull()
    expect(profile.dynamics.forgetRate).toBe(0.1)
    expect(profile.behavior.practiceCompliance).toBe(0.55)
    expect(profile.intervention.interventionReceptivity).toBe(0.5)
  })

  it('returns null when dynamics/behavior/intervention sub-objects are missing', () => {
    expect(parseLatentProfileForIntervention(JSON.stringify({ archetype: 'x' }))).toBeNull()
    expect(parseLatentProfileForIntervention(JSON.stringify({ dynamics: {}, behavior: {} }))).toBeNull()
  })

  it('returns null for malformed JSON / null / empty input', () => {
    expect(parseLatentProfileForIntervention(null)).toBeNull()
    expect(parseLatentProfileForIntervention(undefined)).toBeNull()
    expect(parseLatentProfileForIntervention('')).toBeNull()
    expect(parseLatentProfileForIntervention('{not valid json')).toBeNull()
    expect(parseLatentProfileForIntervention('"a string"')).toBeNull()
    expect(parseLatentProfileForIntervention('null')).toBeNull()
  })
})

describe('data-fetcher · buildEvidenceApplierInterventionInput', () => {
  function makeRow(overrides: Partial<InterventionRowForFetcher> = {}): InterventionRowForFetcher {
    return {
      interventionId: overrides.interventionId ?? 'intv_a',
      studentId: overrides.studentId ?? 'stud_1',
      offeringId: overrides.offeringId ?? 'offr_1',
      interventionType: overrides.interventionType ?? 'mentor-check-in',
      occurredAt: overrides.occurredAt ?? '2026-04-01T10:00:00Z',
      createdAt: overrides.createdAt ?? '2026-04-01T10:00:01Z',
    }
  }
  const severity: InterventionSeverityContext = { riskBand: 'High', cgpa: 5.5, backlogCount: 1 }

  it('builds a valid applier input for a known legacy type', () => {
    const out = buildEvidenceApplierInterventionInput({
      interventionRow: makeRow(),
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      ordinalInStageForStudent: 1,
      severityContext: severity,
    })!
    expect(out.actionCode).toBe('mentor_meeting')
    expect(out.caseId).toBe('intv_a')
    expect(out.stageKeyApplied).toBe('post-tt1')
    expect(out.semesterNumberApplied).toBe(3)
    expect(out.ordinalInStageForStudent).toBe(1)
    expect(out.severityContext).toEqual(severity)
    expect(out.dominantWeaknessHint).toBeNull()
    expect(out.concernFamily).toBeNull()
  })

  it('returns null for no-action (maps to null actionCode)', () => {
    const out = buildEvidenceApplierInterventionInput({
      interventionRow: makeRow({ interventionType: 'no-action' }),
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      ordinalInStageForStudent: 1,
      severityContext: severity,
    })
    expect(out).toBeNull()
  })

  it('respects explicit dominantWeaknessHint + concernFamily', () => {
    const out = buildEvidenceApplierInterventionInput({
      interventionRow: makeRow({ interventionType: 'targeted-tutoring' }),
      semesterNumber: 3,
      stageKeyApplied: 'post-tt2',
      ordinalInStageForStudent: 2,
      severityContext: severity,
      dominantWeaknessHint: 'coursework',
      concernFamily: 'coursework',
    })!
    expect(out.dominantWeaknessHint).toBe('coursework')
    expect(out.concernFamily).toBe('coursework')
    expect(out.actionCode).toBe('targeted_remedial_plan')
  })
})

describe('data-fetcher · groupInterventionsByStudentAndOffering', () => {
  function row(id: string, studentId: string, offeringId: string | null, type: string, occurredAt: string): InterventionRowForFetcher {
    return {
      interventionId: id,
      studentId,
      offeringId,
      interventionType: type,
      occurredAt,
      createdAt: occurredAt,
    }
  }

  const severity: InterventionSeverityContext = { riskBand: 'Medium', cgpa: 6.3, backlogCount: 0 }

  it('groups by studentId::offeringId and orders by occurredAt', () => {
    const grouped = groupInterventionsByStudentAndOffering({
      interventionRows: [
        row('i3', 'stud_1', 'offr_1', 'mentor-check-in',          '2026-04-03T10:00:00Z'),
        row('i1', 'stud_1', 'offr_1', 'targeted-tutoring',        '2026-04-01T10:00:00Z'),
        row('i2', 'stud_1', 'offr_1', 'structured-study-plan',    '2026-04-02T10:00:00Z'),
      ],
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    const bucket = grouped.get('stud_1::offr_1')!
    expect(bucket).not.toBeUndefined()
    expect(bucket.length).toBe(3)
    expect(bucket.map(i => i.caseId)).toEqual(['i1', 'i2', 'i3'])
    expect(bucket.map(i => i.ordinalInStageForStudent)).toEqual([1, 2, 3])
  })

  it('drops rows whose interventionType maps to null (no-action)', () => {
    const grouped = groupInterventionsByStudentAndOffering({
      interventionRows: [
        row('i1', 'stud_1', 'offr_1', 'no-action',         '2026-04-01T10:00:00Z'),
        row('i2', 'stud_1', 'offr_1', 'targeted-tutoring', '2026-04-02T10:00:00Z'),
      ],
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    const bucket = grouped.get('stud_1::offr_1')!
    expect(bucket.length).toBe(1)
    expect(bucket[0]!.caseId).toBe('i2')
    expect(bucket[0]!.ordinalInStageForStudent).toBe(2)  // ordinal still advances for skipped rows
  })

  it('omits students without severity context', () => {
    const grouped = groupInterventionsByStudentAndOffering({
      interventionRows: [
        row('i1', 'stud_missing', 'offr_1', 'mentor-check-in', '2026-04-01T10:00:00Z'),
      ],
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map(),
    })
    expect(grouped.size).toBe(0)
  })

  it('handles null offeringId (groups under studentId::)', () => {
    const grouped = groupInterventionsByStudentAndOffering({
      interventionRows: [
        row('i1', 'stud_1', null, 'mentor-check-in', '2026-04-01T10:00:00Z'),
      ],
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    expect(grouped.has('stud_1::')).toBe(true)
  })

  it('is deterministic regardless of input row order (same set -> same ordinals)', () => {
    const rows = [
      row('a', 'stud_1', 'offr_1', 'mentor-check-in', '2026-04-01T10:00:00Z'),
      row('b', 'stud_1', 'offr_1', 'mentor-check-in', '2026-04-02T10:00:00Z'),
      row('c', 'stud_1', 'offr_1', 'mentor-check-in', '2026-04-03T10:00:00Z'),
    ]
    const asc = groupInterventionsByStudentAndOffering({
      interventionRows: rows,
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    const desc = groupInterventionsByStudentAndOffering({
      interventionRows: [...rows].reverse(),
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    expect(asc.get('stud_1::offr_1')).toEqual(desc.get('stud_1::offr_1'))
  })

  it('breaks ties on occurredAt with interventionId lexicographic order', () => {
    const grouped = groupInterventionsByStudentAndOffering({
      interventionRows: [
        row('ZZZ', 'stud_1', 'offr_1', 'mentor-check-in', '2026-04-01T10:00:00Z'),
        row('AAA', 'stud_1', 'offr_1', 'mentor-check-in', '2026-04-01T10:00:00Z'),
      ],
      semesterNumber: 3,
      stageKeyApplied: 'post-tt1',
      severityContextByStudentId: new Map([['stud_1', severity]]),
    })
    const bucket = grouped.get('stud_1::offr_1')!
    expect(bucket.map(i => i.caseId)).toEqual(['AAA', 'ZZZ'])
  })
})

describe('data-fetcher · parseLatentProfilesForSemester', () => {
  function makeRow(studentId: string, semesterNumber: number, profile: Record<string, unknown>): LatentStateRowForFetcher {
    return {
      studentId,
      semesterNumber,
      latentStateJson: JSON.stringify(profile),
    }
  }

  const wellFormed = {
    dynamics: { consistency: 0.6 },
    behavior: {},
    intervention: {},
  }

  it('returns a map keyed by studentId for the target semester', () => {
    const rows = [
      makeRow('stud_1', 3, wellFormed),
      makeRow('stud_2', 3, wellFormed),
      makeRow('stud_3', 4, wellFormed),  // different semester, must be excluded
    ]
    const result = parseLatentProfilesForSemester({ latentStateRows: rows, semesterNumber: 3 })
    expect(result.size).toBe(2)
    expect(result.has('stud_1')).toBe(true)
    expect(result.has('stud_2')).toBe(true)
    expect(result.has('stud_3')).toBe(false)
  })

  it('skips rows whose latent JSON fails to parse', () => {
    const rows: LatentStateRowForFetcher[] = [
      makeRow('stud_1', 3, wellFormed),
      { studentId: 'stud_bad', semesterNumber: 3, latentStateJson: '{broken json' },
    ]
    const result = parseLatentProfilesForSemester({ latentStateRows: rows, semesterNumber: 3 })
    expect(result.size).toBe(1)
    expect(result.has('stud_1')).toBe(true)
    expect(result.has('stud_bad')).toBe(false)
  })
})
