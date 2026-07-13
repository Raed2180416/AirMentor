export const RISK_FEATURE_SCHEMA_VERSION = 'observable-risk-features-v6'

export const OBSERVABLE_FEATURE_KEYS = [
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
  // v5 interaction features: stage × evidence products capture conditional effects
  // that additive stage indicators cannot express (e.g. TT1 weakness matters more at post-TT1)
  'tt1tt2ExamCompoundRiskScaled',
  'courseworkCompoundRiskScaled',
  'stagePostTt2TtCompoundInteractionScaled',
  'attendanceTrendCompoundRiskScaled',
  'stagePostAssignmentsCourseworkInteractionScaled',
  // v8 missingness indicators: sentinel 0.5 imputation in current pipeline → binary flag restores info
  'cgpaMissingScaled',
  'backlogMissingScaled',
  // v8b missingness indicators for assessment evidence: null-vs-zero disambiguation
  // (intent §G.4: explicit missingness, never silent zero-collapse).
  // tt1Pct/tt2Pct/seePct/quizPct/assignmentPct are number|null in payload.
  // Without these flags, a Sem1 pre-TT1 row with tt1Pct=null is indistinguishable
  // from a student who scored 0% on TT1. Flags restore the distinction.
  'tt1MissingScaled',
  'tt2MissingScaled',
  'seeMissingScaled',
  'quizMissingScaled',
  'assignmentMissingScaled',
  // v6 backlog-credit decomposition: replaces coarse backlogCount with credit-aware pressure
  'activeBacklogCreditPressureScaled',
  'historicalBacklogBurdenScaled',
  'lowerYearBlockerPressureScaled',
  'backlogSensitivityScoreScaled',
] as const

export type ObservableFeatureKey = (typeof OBSERVABLE_FEATURE_KEYS)[number]
export type RiskHeadKey =
  | 'attendanceRisk'
  | 'ceRisk'
  | 'seeRisk'
  | 'overallCourseRisk'
  | 'downstreamCarryoverRisk'
export type SplitName = 'train' | 'validation' | 'test'
export type CalibrationMethod = 'identity' | 'sigmoid' | 'isotonic' | 'beta' | 'venn-abers'
