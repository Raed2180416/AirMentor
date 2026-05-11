// Shared type surface for the intervention-response + world-realism + mark-realization modules.
//
// Pure type module. No runtime imports. Compiled into a type-only export under the ESM
// strict-mode "import ... from './foo.js'" convention used across this codebase.
//
// The intervention-response engine, the world-realism engine, the stage-realization
// service, and the recommendation-text generator all import from here. Keeping the shared
// vocabulary in one place prevents the three engines from importing each other's
// implementation files and avoids dependency cycles.

export type ResponseProfile = 'strong' | 'partial' | 'weak' | 'resistant'

export type InterventionImpactTier = 'strong' | 'partial' | 'weak'

export type ProofInterventionActionCode =
  | 'mentor_meeting'
  | 'faculty_followup_reminder'
  | 'attendance_warning'
  | 'extra_academic_support_plan'
  | 'targeted_remedial_plan'
  | 'hod_escalation_student_action'
  | 'structured_study_plan'
  | 'peer_study_group'
  | 'generic_default_family_action'

export const PROOF_INTERVENTION_ACTION_CODES: readonly ProofInterventionActionCode[] = [
  'mentor_meeting',
  'faculty_followup_reminder',
  'attendance_warning',
  'extra_academic_support_plan',
  'targeted_remedial_plan',
  'hod_escalation_student_action',
  'structured_study_plan',
  'peer_study_group',
  'generic_default_family_action',
] as const

export type ProofInterventionConcernFamily =
  | 'attendance'
  | 'coursework'
  | 'exam-performance'
  | 'broad-academic'
  | 'mentoring-engagement'
  | 'unclassified'

export type ProofInterventionDominantWeakness =
  | 'attendance'
  | 'coursework'
  | 'exam'
  | 'broad'
  | 'mentoring'
  | null

export type InterventionStageKey =
  | 'pre-tt1'
  | 'post-tt1'
  | 'post-tt2'
  | 'post-assignments'
  | 'post-see'

export const INTERVENTION_STAGE_KEY_ORDER: readonly InterventionStageKey[] = [
  'pre-tt1',
  'post-tt1',
  'post-tt2',
  'post-assignments',
  'post-see',
] as const

export type AssessmentType = 'attendance' | 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'see'

// Structural interface matching the relevant parts of StudentTrajectory['profile']
// defined in msruas-proof-control-plane.ts. We do not import that type directly because
// (a) StudentTrajectory is not exported and (b) keeping this structural keeps the new
// engines DB-free and trivially testable.
export type StudentLatentProfileForIntervention = {
  dynamics: {
    forgetRate: number
    relearnRate: number
    transferGainRate: number
    studyGainRate: number
    fatigueRate: number
    consistency: number
    volatility: number
    recoveryTendency: number
    relapseTendency: number
  }
  behavior: {
    practiceCompliance: number
    helpSeekingTendency: number
    examPressure: number
  }
  intervention: {
    interventionReceptivity: number
    temporaryUpliftCredit: number
    expectedRecoveryThreshold: number
  }
}

// Broader structural profile used by the stage-slice simulator. Includes latentBase
// signals (section-ability / foundations / self-regulation) + readiness + behavior +
// assessment strengths that the existing linear-additive mark formulas depend on.
// Kept structurally compatible with the full StudentTrajectory in msruas-proof-control-plane.ts.
export type StudentLatentBaseForSimulation = {
  academicPotential: number
  mathematicsFoundation: number
  computingFoundation: number
  selfRegulation: number
  attendanceDiscipline: number
  supportResponsiveness: number
}

export type StudentReadinessForSimulation = {
  mathReadiness: number
  programmingReadiness: number
  logicReadiness: number
  statsReadiness: number
  systemsReadiness: number
  communicationReadiness: number
  labReadiness: number
}

export type StudentBehaviorForSimulation = StudentLatentProfileForIntervention['behavior'] & {
  attendancePropensity: number
  selfCheckTendency: number
  deadlineDiscipline: number
  timePressureSensitivity: number
  courseworkReliability: number
}

export type StudentAssessmentForSimulation = {
  quizRecallStrength: number
  assignmentCompletionStrength: number
  termTestApplicationStrength: number
  seeEndurance: number
  labExecutionStrength: number
  partialCreditConversion: number
  carelessErrorRate: number
  multiStepBreakdownRisk: number
}

export type StudentTrajectoryForSimulation = {
  studentId: string
  sectionCode: 'A' | 'B'
  latentBase: StudentLatentBaseForSimulation
  profile: {
    readiness: StudentReadinessForSimulation
    dynamics: StudentLatentProfileForIntervention['dynamics']
    behavior: StudentBehaviorForSimulation
    assessment: StudentAssessmentForSimulation
    intervention: StudentLatentProfileForIntervention['intervention']
  }
}

// Minimal subset of RuntimeCourse fields used by the slice-simulator.
// Kept narrow so tests can construct mocks easily without pulling the full schema.
export type CourseForSimulation = {
  internalCompilerId: string
  title: string
  assessmentProfile: string
  explicitPrerequisites: string[]
  addedPrerequisites: string[]
}

export type InterventionSeverityContext = {
  riskBand: 'High' | 'Medium' | 'Low'
  cgpa: number
  backlogCount: number
}

export type InterventionApplication = {
  runId: string
  studentId: string
  semesterNumber: number
  stageKey: InterventionStageKey
  caseId: string
  actionCode: ProofInterventionActionCode
  concernFamily: ProofInterventionConcernFamily | null
  ordinalInStageForStudent: number
  severityContext: InterventionSeverityContext
  dominantWeaknessHint: ProofInterventionDominantWeakness
}

export type ComputedInterventionImpact = {
  impact: number
  tier: InterventionImpactTier
  breakdown: {
    baseActionWeight: number
    responseScore: number
    compatibilityFactor: number
    stageFactor: number
    severityPenalty: number
    repeatPenalty: number
  }
}

export type RecommendationDeferTarget = 'Mentor' | 'Course Leader' | 'HoD'

export type RecommendationInterventionHistory = {
  appliedCount: number
  lastTier: InterventionImpactTier | null
  lastActionCode: ProofInterventionActionCode | null
  consecutiveSevereStages: number
}

export type RecommendationTopDriverFeature =
  | 'attendance'
  | 'tt1'
  | 'tt2'
  | 'see'
  | 'cgpa'
  | 'backlog'
  | 'co'
  | 'quiz'
  | 'assignment'
  | 'attendance-history'
  | 'question-pattern'
  | 'intervention-response'

export type RecommendationTopDriver = {
  feature: RecommendationTopDriverFeature
  label: string
  impact: number
}

export type RecommendationTextInput = {
  riskBand: 'High' | 'Medium' | 'Low'
  stageKey: InterventionStageKey
  semesterNumber: number
  topDrivers: RecommendationTopDriver[]
  currentCgpa: number | null
  backlogCount: number | null
  interventionHistory: RecommendationInterventionHistory
  attendancePct: number | null
  tt1Pct: number | null
  tt2Pct: number | null
  seePct: number | null
}

export type RecommendationTextOutput = {
  headline: string
  rationale: string
  suggestedActions: ProofInterventionActionCode[]
  metricsSummary: string
  deferTo: RecommendationDeferTarget
  deferHodFlag: boolean
  dominantWeakness: ProofInterventionDominantWeakness
}
