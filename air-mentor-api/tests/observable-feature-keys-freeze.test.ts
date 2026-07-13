import { describe, expect, it } from 'vitest'
import {
  OBSERVABLE_FEATURE_KEYS,
  RISK_FEATURE_SCHEMA_VERSION,
} from '../src/lib/proof-risk-model.js'

/**
 * FEATURE-ORDER FREEZE (Phase 4 blocker #3).
 *
 * `OBSERVABLE_FEATURE_KEYS` order is load-bearing in FOUR independent places that
 * must stay byte-aligned:
 *   1. TS `featureVectorFromPayload` (builds the vector in this order)
 *   2. the serialized `LogisticHeadArtifact.weights` map in the model bundle
 *   3. Python `generate_v2_data.py` `feat_N` CSV columns (index = position here)
 *   4. `validate_synthetic_quality.py` STAGE_INDICATOR_INDEXES
 *
 * Any reorder / insert / rename silently corrupts scoring (weights applied to the
 * wrong feature) with NO type error. This test is a deliberate tripwire: it must be
 * updated ONLY alongside a coordinated retrain + Python-side change + a schema
 * version bump. Do not "just update the snapshot".
 */

// The canonical v6 feature order, index 0..47. Frozen 2026-07-13.
const FROZEN_FEATURE_KEYS = [
  'attendancePctScaled',
  'attendanceTrendScaled',
  'attendanceHistoryRiskScaled',
  'currentCgpaScaled',
  'backlogPressureScaled',
  'tt1RiskScaled',
  'tt2RiskScaled',
  'seeRiskScaled',
  'quizRiskScaled',
  'assignmentRiskScaled',
  'weakCoPressureScaled',
  'weakQuestionPressureScaled',
  'courseworkTtMismatchScaled',
  'ttMomentumRiskScaled',
  'interventionResidualRiskScaled',
  'prerequisitePressureScaled',
  'prerequisiteAverageRiskScaled',
  'prerequisiteFailurePressureScaled',
  'prerequisiteChainDepthScaled',
  'prerequisiteWeakCourseRateScaled',
  'prerequisiteCarryoverLoadScaled',
  'prerequisiteRecencyWeightedFailureScaled',
  'downstreamDependencyLoadScaled',
  'weakPrerequisiteChainCountScaled',
  'repeatedWeakPrerequisiteFamilyCountScaled',
  'semesterProgressScaled',
  'stagePreTt1Scaled',
  'stagePostTt1Scaled',
  'stagePostTt2Scaled',
  'stagePostAssignmentsScaled',
  'stagePostSeeScaled',
  'sectionPressureScaled',
  'tt1tt2ExamCompoundRiskScaled',
  'courseworkCompoundRiskScaled',
  'stagePostTt2TtCompoundInteractionScaled',
  'attendanceTrendCompoundRiskScaled',
  'stagePostAssignmentsCourseworkInteractionScaled',
  'cgpaMissingScaled',
  'backlogMissingScaled',
  'tt1MissingScaled',
  'tt2MissingScaled',
  'seeMissingScaled',
  'quizMissingScaled',
  'assignmentMissingScaled',
  'activeBacklogCreditPressureScaled',
  'historicalBacklogBurdenScaled',
  'lowerYearBlockerPressureScaled',
  'backlogSensitivityScoreScaled',
] as const

describe('OBSERVABLE_FEATURE_KEYS freeze (v6)', () => {
  it('pins the schema version', () => {
    expect(RISK_FEATURE_SCHEMA_VERSION).toBe('observable-risk-features-v6')
  })

  it('pins the exact count (48)', () => {
    expect(OBSERVABLE_FEATURE_KEYS.length).toBe(48)
    expect(FROZEN_FEATURE_KEYS.length).toBe(48)
  })

  it('pins the exact ordered key tuple (feat_N index stability)', () => {
    expect([...OBSERVABLE_FEATURE_KEYS]).toEqual([...FROZEN_FEATURE_KEYS])
  })

  it('has no duplicate keys', () => {
    expect(new Set(OBSERVABLE_FEATURE_KEYS).size).toBe(OBSERVABLE_FEATURE_KEYS.length)
  })
})
