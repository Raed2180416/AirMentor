import { describe, expect, it } from 'vitest'
import {
  deriveDeferHod,
  deriveDominantWeakness,
  generateRecommendationText,
  humanLabelForActionCode,
} from '../src/lib/proof-recommendation-text-generator.js'
import type {
  RecommendationInterventionHistory,
  RecommendationTextInput,
  RecommendationTopDriver,
} from '../src/lib/proof-intervention-response-types.js'

function makeHistory(overrides: Partial<RecommendationInterventionHistory> = {}): RecommendationInterventionHistory {
  return {
    appliedCount: overrides.appliedCount ?? 0,
    lastTier: overrides.lastTier ?? null,
    lastActionCode: overrides.lastActionCode ?? null,
    consecutiveSevereStages: overrides.consecutiveSevereStages ?? 0,
  }
}

function makeInput(overrides: Partial<RecommendationTextInput> = {}): RecommendationTextInput {
  return {
    riskBand: overrides.riskBand ?? 'High',
    stageKey: overrides.stageKey ?? 'post-tt2',
    semesterNumber: overrides.semesterNumber ?? 3,
    topDrivers: overrides.topDrivers ?? [
      { feature: 'attendance', label: 'Attendance below threshold', impact: 0.28 },
    ],
    currentCgpa: overrides.currentCgpa ?? 5.4,
    backlogCount: overrides.backlogCount ?? 0,
    interventionHistory: overrides.interventionHistory ?? makeHistory(),
    attendancePct: overrides.attendancePct ?? 58,
    tt1Pct: overrides.tt1Pct ?? 45,
    tt2Pct: overrides.tt2Pct ?? 42,
    seePct: overrides.seePct ?? null,
  }
}

describe('recommendation-text-generator · humanLabelForActionCode', () => {
  it('returns canonical labels for all known enum codes', () => {
    expect(humanLabelForActionCode('attendance_warning')).toBe('Send attendance warning')
    expect(humanLabelForActionCode('targeted_remedial_plan')).toBe('Run targeted remedial plan')
    expect(humanLabelForActionCode('structured_study_plan')).toBe('Assign structured study plan')
    expect(humanLabelForActionCode('extra_academic_support_plan')).toBe('Extra academic support plan')
    expect(humanLabelForActionCode('mentor_meeting')).toBe('Schedule mentor meeting')
    expect(humanLabelForActionCode('faculty_followup_reminder')).toBe('Faculty follow-up reminder')
    expect(humanLabelForActionCode('hod_escalation_student_action')).toBe('Escalate student case to HoD')
    expect(humanLabelForActionCode('generic_default_family_action')).toBe('Review and plan next step')
  })

  it('falls back to Title Case for unknown snake_case legacy codes', () => {
    expect(humanLabelForActionCode('legacy_custom_code')).toBe('Legacy Custom Code')
  })

  it('falls back to Title Case for unknown kebab-case legacy codes', () => {
    expect(humanLabelForActionCode('tier1-direct-intervention')).toBe('Tier1 Direct Intervention')
  })

  it('returns null for null / undefined / empty input', () => {
    expect(humanLabelForActionCode(null)).toBeNull()
    expect(humanLabelForActionCode(undefined)).toBeNull()
    expect(humanLabelForActionCode('')).toBeNull()
    expect(humanLabelForActionCode('   ')).toBeNull()
  })

  it('is deterministic across repeated calls', () => {
    for (let i = 0; i < 20; i++) {
      expect(humanLabelForActionCode('targeted_remedial_plan')).toBe('Run targeted remedial plan')
    }
  })
})

describe('recommendation-text-generator · deriveDeferHod', () => {
  it('Low/Medium never defer', () => {
    for (const band of ['Low', 'Medium'] as const) {
      expect(deriveDeferHod({
        riskBand: band,
        currentCgpa: 3.5,
        backlogCount: 5,
        interventionHistory: makeHistory({ appliedCount: 2, lastTier: 'weak', consecutiveSevereStages: 3 }),
      })).toBe(false)
    }
  })

  it('High + no prior intervention -> no defer', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 4.0,
      backlogCount: 3,
      interventionHistory: makeHistory({ appliedCount: 0 }),
    })).toBe(false)
  })

  it('High + prior strong -> no defer (intervention already working)', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 4.0,
      backlogCount: 3,
      interventionHistory: makeHistory({ appliedCount: 2, lastTier: 'strong', consecutiveSevereStages: 2 }),
    })).toBe(false)
  })

  it('High + prior weak + backlog>=2 -> defer', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 5.0,
      backlogCount: 2,
      interventionHistory: makeHistory({ appliedCount: 1, lastTier: 'weak' }),
    })).toBe(true)
  })

  it('High + prior weak + consecutiveSevere>=2 -> defer', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 6.0,
      backlogCount: 0,
      interventionHistory: makeHistory({ appliedCount: 2, lastTier: 'partial', consecutiveSevereStages: 2 }),
    })).toBe(true)
  })

  it('High + prior weak + cgpa<4.5 -> defer', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 4.3,
      backlogCount: 1,
      interventionHistory: makeHistory({ appliedCount: 1, lastTier: 'weak' }),
    })).toBe(true)
  })

  it('High + prior weak but no cgpa/backlog/severe hit -> no defer', () => {
    expect(deriveDeferHod({
      riskBand: 'High',
      currentCgpa: 6.5,
      backlogCount: 0,
      interventionHistory: makeHistory({ appliedCount: 1, lastTier: 'weak', consecutiveSevereStages: 1 }),
    })).toBe(false)
  })
})

describe('recommendation-text-generator · deriveDominantWeakness', () => {
  it('maps top driver feature correctly', () => {
    expect(deriveDominantWeakness([{ feature: 'attendance', label: '', impact: 0.2 }])).toBe('attendance')
    expect(deriveDominantWeakness([{ feature: 'tt1', label: '', impact: 0.2 }])).toBe('exam')
    expect(deriveDominantWeakness([{ feature: 'quiz', label: '', impact: 0.2 }])).toBe('coursework')
    expect(deriveDominantWeakness([{ feature: 'cgpa', label: '', impact: 0.2 }])).toBe('broad')
    expect(deriveDominantWeakness([{ feature: 'intervention-response', label: '', impact: 0.2 }])).toBe('mentoring')
  })

  it('empty drivers -> null', () => {
    expect(deriveDominantWeakness([])).toBe(null)
  })
})

describe('recommendation-text-generator · generateRecommendationText', () => {
  it('High-risk + deferHod produces HoD escalation recommendation', () => {
    const drivers: RecommendationTopDriver[] = [
      { feature: 'attendance', label: 'Attendance very low', impact: 0.28 },
      { feature: 'tt1', label: 'TT1 very low', impact: 0.16 },
      { feature: 'co', label: 'Multiple COs below threshold', impact: 0.1 },
    ]
    const input = makeInput({
      riskBand: 'High',
      topDrivers: drivers,
      currentCgpa: 4.2,
      backlogCount: 3,
      attendancePct: 28,
      tt1Pct: 32,
      interventionHistory: makeHistory({
        appliedCount: 2,
        lastTier: 'weak',
        consecutiveSevereStages: 2,
        lastActionCode: 'mentor_meeting',
      }),
    })
    const out = generateRecommendationText(input)
    expect(out.deferHodFlag).toBe(true)
    expect(out.deferTo).toBe('HoD')
    expect(out.suggestedActions).toEqual(['hod_escalation_student_action'])
    expect(out.headline.toLowerCase()).toContain('hod')
    expect(out.rationale.toLowerCase()).toContain('escalate')
    expect(out.metricsSummary).toContain('attendance')
    expect(out.metricsSummary).toContain('CGPA')
    expect(out.metricsSummary).toContain('backlog')
  })

  it('High-risk attendance-dominant -> attendance_warning primary action', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'High',
      topDrivers: [{ feature: 'attendance', label: 'Attendance very low', impact: 0.28 }],
      currentCgpa: 7.5,
      backlogCount: 0,
      attendancePct: 32,
      interventionHistory: makeHistory({ appliedCount: 0 }),
    }))
    expect(out.deferHodFlag).toBe(false)
    expect(out.deferTo).toBe('Mentor')
    expect(out.suggestedActions[0]).toBe('attendance_warning')
  })

  it('High-risk coursework-dominant -> targeted_remedial_plan', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'High',
      topDrivers: [{ feature: 'assignment', label: 'Assignment weak', impact: 0.2 }],
      interventionHistory: makeHistory({ appliedCount: 0 }),
    }))
    expect(out.suggestedActions[0]).toBe('targeted_remedial_plan')
  })

  it('High-risk exam-dominant -> structured_study_plan', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'High',
      topDrivers: [{ feature: 'tt2', label: 'TT2 low', impact: 0.16 }],
      interventionHistory: makeHistory({ appliedCount: 0 }),
    }))
    expect(out.suggestedActions[0]).toBe('structured_study_plan')
  })

  it('Medium-risk with prior weak -> mentor_meeting', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'Medium',
      topDrivers: [{ feature: 'tt2', label: 'TT2 below watch', impact: 0.08 }],
      interventionHistory: makeHistory({ appliedCount: 1, lastTier: 'weak' }),
    }))
    expect(out.deferTo).toBe('Course Leader')
    expect(out.suggestedActions).toEqual(['mentor_meeting'])
  })

  it('Medium-risk clean -> faculty_followup_reminder', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'Medium',
      topDrivers: [{ feature: 'quiz', label: 'Quiz weak', impact: 0.06 }],
      interventionHistory: makeHistory({ appliedCount: 0 }),
    }))
    expect(out.suggestedActions).toEqual(['faculty_followup_reminder'])
  })

  it('Low-risk -> no suggested actions, Course Leader defer', () => {
    const out = generateRecommendationText(makeInput({
      riskBand: 'Low',
      topDrivers: [],
      interventionHistory: makeHistory(),
      attendancePct: 92,
      tt1Pct: 78,
      tt2Pct: 82,
      currentCgpa: 8.1,
      backlogCount: 0,
    }))
    expect(out.suggestedActions).toEqual([])
    expect(out.deferTo).toBe('Course Leader')
    expect(out.headline).toContain('On track')
  })

  it('is deterministic: identical input -> bytewise identical output', () => {
    const input = makeInput()
    const first = generateRecommendationText(input)
    for (let i = 0; i < 25; i++) {
      expect(generateRecommendationText(input)).toEqual(first)
    }
  })

  it('metricsSummary includes backlog only when > 0', () => {
    const withBacklog = generateRecommendationText(makeInput({ backlogCount: 2 }))
    expect(withBacklog.metricsSummary).toContain('backlog 2')
    const noBacklog = generateRecommendationText(makeInput({ backlogCount: 0 }))
    expect(noBacklog.metricsSummary).not.toContain('backlog')
  })

  it('rationale is a non-empty multi-sentence string', () => {
    const out = generateRecommendationText(makeInput())
    expect(out.rationale.length).toBeGreaterThan(50)
    expect(out.rationale.split('.').length).toBeGreaterThan(2)
  })

  it('headline reflects risk band', () => {
    expect(generateRecommendationText(makeInput({ riskBand: 'High' })).headline.toLowerCase()).toMatch(/high|escalate/)
    expect(generateRecommendationText(makeInput({ riskBand: 'Medium' })).headline.toLowerCase()).toContain('watch')
    expect(generateRecommendationText(makeInput({ riskBand: 'Low', topDrivers: [] })).headline.toLowerCase()).toContain('on track')
  })
})
