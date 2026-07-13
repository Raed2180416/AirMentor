// Grading bands, policy payloads/overrides, scope descriptors, resolved batch
// policy, and stage-policy contracts. Extracted verbatim from '../types'.

import type { ApiBatch } from './hierarchy'

export type ApiGradeBand = {
  grade: string
  minimumMark: number
  maximumMark: number
  gradePoint: number
}

export type ApiPolicyPayload = {
  gradeBands?: ApiGradeBand[]
  ceSeeSplit?: {
    ce: number
    see: number
  }
  ceComponentCaps?: {
    termTestsWeight: number
    quizWeight: number
    assignmentWeight: number
    maxTermTests: number
    maxQuizzes: number
    maxAssignments: number
  }
  workingCalendar?: {
    days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
    dayStart: string
    dayEnd: string
    courseworkWeeks: number
    examPreparationWeeks: number
    seeWeeks: number
    totalWeeks: number
  }
  attendanceRules?: {
    minimumRequiredPercent: number
    condonationFloorPercent: number
  }
  condonationRules?: {
    maximumShortagePercent: number
    requiresApproval: boolean
  }
  eligibilityRules?: {
    minimumCeForSeeEligibility: number
    allowCondonationForSeeEligibility: boolean
  }
  passRules?: {
    minimumCeMark: number
    minimumSeeMark: number
    minimumOverallMark: number
    ceMaximum: number
    seeMaximum: number
    overallMaximum: number
  }
  roundingRules?: {
    statusMarkRounding: 'nearest-integer'
    applyBeforeStatusDetermination: boolean
    sgpaCgpaDecimals: number
  }
  sgpaCgpaRules?: {
    sgpaModel: 'credit-weighted'
    cgpaModel: 'credit-weighted-cumulative'
    rounding: '2-decimal'
    includeFailedCredits: boolean
    repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
  }
  progressionRules?: {
    passMarkPercent: number
    minimumCgpaForPromotion: number
    requireNoActiveBacklogs: boolean
  }
  riskRules?: {
    highRiskAttendancePercentBelow: number
    mediumRiskAttendancePercentBelow: number
    highRiskCgpaBelow: number
    mediumRiskCgpaBelow: number
    highRiskBacklogCount: number
    mediumRiskBacklogCount: number
  }
}

export type ApiPolicyOverride = {
  policyOverrideId: string
  scopeType: 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch' | 'section'
  scopeId: string
  policy: ApiPolicyPayload
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiScopeType = ApiPolicyOverride['scopeType']

export type ApiScopeDescriptor = {
  scopeType: ApiScopeType | 'proof' | 'student'
  scopeId: string
  label: string
  batchId: string | null
  sectionCode: string | null
  branchName: string | null
  simulationRunId: string | null
  simulationStageCheckpointId: string | null
  studentId: string | null
}

export type ApiResolvedFrom = {
  kind: 'default-policy' | 'policy-override' | 'proof-run' | 'proof-checkpoint' | 'proof-unavailable'
  scopeType: ApiScopeType | 'proof' | 'student' | null
  scopeId: string | null
  label: string
}

export type ApiScopeMode = ApiScopeType | 'proof'
export type ApiCountSource = 'operational-semester' | 'proof-run' | 'proof-checkpoint' | 'unavailable'

export type ApiBatchSetupReadiness = {
  ready: boolean
  blockers: string[]
  batchLabel: string | null
}

export type ApiResolvedBatchPolicy = {
  batch: ApiBatch
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  scopeChain: Array<{
    scopeType: ApiScopeType
    scopeId: string
  }>
  appliedOverrides: Array<ApiPolicyOverride & { appliedAtScope: string }>
  effectivePolicy: {
    gradeBands: ApiGradeBand[]
    ceSeeSplit: {
      ce: number
      see: number
    }
    ceComponentCaps: {
      termTestsWeight: number
      quizWeight: number
      assignmentWeight: number
      maxTermTests: number
      maxQuizzes: number
      maxAssignments: number
    }
    workingCalendar: {
      days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
      dayStart: string
      dayEnd: string
      courseworkWeeks: number
      examPreparationWeeks: number
      seeWeeks: number
      totalWeeks: number
    }
    attendanceRules: {
      minimumRequiredPercent: number
      condonationFloorPercent: number
    }
    condonationRules: {
      maximumShortagePercent: number
      requiresApproval: boolean
    }
    eligibilityRules: {
      minimumCeForSeeEligibility: number
      allowCondonationForSeeEligibility: boolean
    }
    passRules: {
      minimumCeMark: number
      minimumSeeMark: number
      minimumOverallMark: number
      ceMaximum: number
      seeMaximum: number
      overallMaximum: number
    }
    roundingRules: {
      statusMarkRounding: 'nearest-integer'
      applyBeforeStatusDetermination: boolean
      sgpaCgpaDecimals: number
    }
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted'
      cgpaModel: 'credit-weighted-cumulative'
      rounding: '2-decimal'
      includeFailedCredits: boolean
      repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
    }
    progressionRules: {
      passMarkPercent: number
      minimumCgpaForPromotion: number
      requireNoActiveBacklogs: boolean
    }
    riskRules: {
      highRiskAttendancePercentBelow: number
      mediumRiskAttendancePercentBelow: number
      highRiskCgpaBelow: number
      mediumRiskCgpaBelow: number
      highRiskBacklogCount: number
      mediumRiskBacklogCount: number
    }
  }
  proofSandbox?: {
    hasProofData: boolean
    curriculumImport: {
      curriculumImportVersionId: string
      sourceLabel: string
      sourceChecksum: string
      semesterRange: [number, number]
      courseCount: number
      totalCredits: number
      explicitEdgeCount: number
      addedEdgeCount: number
      bridgeModuleCount: number
      electiveOptionCount: number
      importedAt: string
      status: string
    } | null
    structureSummary: {
      nodeCount: number
      explicitEdgeCount: number
      addedEdgeCount: number
      bridgeModuleCount: number
    }
    latestSimulationRun: {
      simulationRunId: string
      runLabel: string
      status: string
      seed: number
      sectionCount: number
      studentCount: number
      facultyCount: number
      semesterRange: [number, number]
      createdAt: string
      metrics: Record<string, unknown>
    } | null
    monitoringSummary: {
      riskAssessmentCount: number
      activeReassessmentCount: number
    }
  }
}

export type ApiStagePolicyOverride = {
  stagePolicyOverrideId: string
  scopeType: ApiScopeType
  scopeId: string
  policy: ApiStagePolicyPayload
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiResolvedBatchStagePolicy = {
  batch: ApiBatch
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  scopeChain: Array<{
    scopeType: ApiScopeType
    scopeId: string
  }>
  appliedOverrides: Array<ApiStagePolicyOverride & { appliedAtScope: string }>
  effectivePolicy: ApiStagePolicyPayload
}

export type ApiStageEvidenceKind = 'attendance' | 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'finals' | 'transcript'

export type ApiStagePolicyStageKey =
  | 'pre-tt1'
  | 'post-tt1'
  | 'post-tt2'
  | 'post-assignments'
  | 'post-see'

export type ApiStagePolicyStage = {
  key: ApiStagePolicyStageKey
  label: string
  description: string
  order: number
  semesterDayOffset: number
  requiredEvidence: ApiStageEvidenceKind[]
  requireQueueClearance: boolean
  requireTaskClearance: boolean
  advancementMode: 'admin-confirmed' | 'automatic'
  color: string
}

export type ApiStagePolicyPayload = {
  stages: ApiStagePolicyStage[]
}
