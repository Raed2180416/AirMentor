import { describe, expect, it } from 'vitest'
import { evaluateCatastrophicAbsorbingState, inferObservableRisk } from '../air-mentor-api/src/lib/inference-engine.js'
import {
  CGPA_HIGH_RISK_IMPACT,
  BACKLOG_HIGH_RISK_IMPACT,
  RISK_BAND_HIGH_THRESHOLD,
} from '../air-mentor-api/src/lib/learning-dynamics-constants.js'
import type { ResolvedPolicy } from '../air-mentor-api/src/modules/admin-structure.js'

const mockPolicy = {
  passRules: {
    minimumCeMark: 24,
    minimumSeeMark: 16,
    minimumOverallMark: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  },
  attendanceRules: {
    minimumRequiredPercent: 75,
    condonationFloorPercent: 65,
  },
  riskRules: {
    highRiskAttendancePercentBelow: 60,
    mediumRiskAttendancePercentBelow: 75,
    highRiskCgpaBelow: 6.5,
    mediumRiskCgpaBelow: 7.5,
    highRiskBacklogCredits: 12,
    mediumRiskBacklogCredits: 6,
    highRiskBacklogCount: 4,
    mediumRiskBacklogCount: 2,
  },
} as unknown as ResolvedPolicy

describe('Tinto Absorbing State Logic', () => {
  it('identifies catastrophic CGPA as an absorbing state', () => {
    const drivers = [
      { feature: 'cgpa' as const, impact: CGPA_HIGH_RISK_IMPACT, label: 'Bad CGPA' },
    ]
    expect(evaluateCatastrophicAbsorbingState(drivers)).toBe(true)
  })

  it('identifies catastrophic Backlogs as an absorbing state', () => {
    const drivers = [
      { feature: 'backlog' as const, impact: BACKLOG_HIGH_RISK_IMPACT, label: 'Many backlogs' },
    ]
    expect(evaluateCatastrophicAbsorbingState(drivers)).toBe(true)
  })

  it('does not trigger absorbing state for medium risk drivers', () => {
    const drivers = [
      { feature: 'cgpa' as const, impact: 0.10, label: 'Medium CGPA' },
      { feature: 'backlog' as const, impact: 0.06, label: 'Medium Backlogs' },
    ]
    expect(evaluateCatastrophicAbsorbingState(drivers)).toBe(false)
  })

  it('overrides additive model when student has catastrophic CGPA in sparse telemetry (e.g. Day 1 of Sem 6)', () => {
    // Student with 4.5 CGPA but NO assessment data yet.
    // Linear additive math: Baseline (0.08) + CGPA (0.20) + perfect attendance (0) = 0.28 (Low Risk)
    // Absorbing State logic forces it to 0.80 (High Risk).
    const result = inferObservableRisk({
      attendancePct: 90,
      currentCgpa: 4.5, // < 5.0 (High Risk)
      backlogCount: 0,
      policy: mockPolicy,
    })
    
    expect(result.observableDrivers.some(d => d.feature === 'cgpa' && d.impact === CGPA_HIGH_RISK_IMPACT)).toBe(true)
    expect(result.riskProb).toBeGreaterThanOrEqual(RISK_BAND_HIGH_THRESHOLD)
    expect(result.riskBand).toBe('High')
  })

  it('overrides additive model when student has massive backlogs', () => {
    // 72 backlogs
    const result = inferObservableRisk({
      attendancePct: 90,
      currentCgpa: 6.5,
      backlogCount: 72, // > 4 (High Risk)
      policy: mockPolicy,
    })
    
    expect(result.riskProb).toBeGreaterThanOrEqual(RISK_BAND_HIGH_THRESHOLD)
    expect(result.riskBand).toBe('High')
  })

  it('applies the institutional floor when student is NOT in an absorbing state', () => {
    // Student has critically low attendance, but decent CGPA and no backlogs.
    // This is not an absorbing-state override; the institutional attendance
    // floor now correctly lifts the result to High.
    const result = inferObservableRisk({
      attendancePct: 50,
      currentCgpa: 8.0,
      backlogCount: 0,
      policy: mockPolicy,
    })
    
    expect(result.observableDrivers.some(d => d.feature === 'cgpa' || d.feature === 'backlog')).toBe(false)
    expect(result.riskProb).toBeGreaterThanOrEqual(RISK_BAND_HIGH_THRESHOLD)
    expect(result.riskBand).toBe('High')
  })
})
