import type {
  CoAttainmentRow,
  Mentee,
  Offering,
  Professor,
  Student,
  StudentHistoryRecord,
  SubjectRun,
  TeacherInfo,
  YearGroup,
} from '../data'
import type {
  AcademicMeeting,
  CalendarAuditEvent,
  EntryLockMap,
  FacultyAccount,
  FacultyTimetableTemplate,
  QueueTransition,
  SchemeState,
  SharedTask,
  StudentRuntimePatch,
  TaskCalendarPlacement,
  TTKind,
  TermTestBlueprint,
} from '../domain'

export type ApiRoleCode = 'SYSTEM_ADMIN' | 'HOD' | 'COURSE_LEADER' | 'MENTOR'

export type ApiRoleGrant = {
  grantId: string
  facultyId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  scopeLabel?: string | null
  startDate?: string | null
  endDate?: string | null
  status: string
  version: number
}

export type ApiUiPreferences = {
  userId: string
  themeMode: 'frosted-focus-light' | 'frosted-focus-dark'
  version: number
  updatedAt: string
}

export type ApiSessionResponse = {
  sessionId: string
  csrfToken: string
  user: {
    userId: string
    username: string
    email: string
  }
  faculty: {
    facultyId: string
    displayName: string | null
  } | null
  activeRoleGrant: ApiRoleGrant
  availableRoleGrants: ApiRoleGrant[]
  preferences: ApiUiPreferences
}

export type ApiLoginRequest = {
  identifier: string
  password: string
}

export type ApiInstitution = {
  institutionId: string
  name: string
  timezone: string
  academicYearStartMonth: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicFaculty = {
  academicFacultyId: string
  institutionId: string
  code: string
  name: string
  overview: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiDepartment = {
  departmentId: string
  institutionId: string
  academicFacultyId: string | null
  code: string
  name: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBranch = {
  branchId: string
  departmentId: string
  code: string
  name: string
  programLevel: string
  semesterCount: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatch = {
  batchId: string
  branchId: string
  admissionYear: number
  batchLabel: string
  currentSemester: number
  sectionLabels: string[]
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicTerm = {
  termId: string
  branchId: string
  batchId: string | null
  academicYearLabel: string
  semesterNumber: number
  startDate: string
  endDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyAppointment = {
  appointmentId: string
  facultyId: string
  departmentId: string
  departmentName?: string | null
  departmentCode?: string | null
  branchId: string | null
  branchName?: string | null
  branchCode?: string | null
  isPrimary: boolean
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyRecord = {
  facultyId: string
  userId: string
  username: string
  email: string
  phone: string | null
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
  scopeDescriptor?: ApiScopeDescriptor | null
  resolvedFrom?: ApiResolvedFrom | null
  scopeMode?: ApiScopeMode | null
  countSource?: ApiCountSource | null
  activeOperationalSemester?: number | null
  appointments: ApiFacultyAppointment[]
  roleGrants: ApiRoleGrant[]
}

export type ApiStudentEnrollment = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder?: number
  academicStatus: string
  startDate: string
  endDate: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiMentorAssignment = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiMentorAssignmentBulkApplySelectionMode = 'missing-only' | 'replace-all'

export type ApiMentorAssignmentBulkApplyRequest = {
  batchId: string
  sectionCode?: string | null
  facultyId: string
  effectiveFrom: string
  source: string
  selectionMode?: ApiMentorAssignmentBulkApplySelectionMode
  previewOnly?: boolean
  expectedStudentIds?: string[]
}

export type ApiMentorAssignmentBulkApplyStudent = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string | null
  currentMentorFacultyId: string | null
  currentMentorAssignmentId: string | null
  action: 'assign' | 'reassign' | 'keep'
  actionReason: string
}

export type ApiMentorAssignmentBulkApplyResponse = {
  ok: true
  preview: boolean
  bulkApplyId: string | null
  batchId: string
  batchLabel: string
  sectionCode: string | null
  facultyId: string
  facultyDisplayName: string
  scopeLabel: string
  effectiveFrom: string
  source: string
  selectionMode: ApiMentorAssignmentBulkApplySelectionMode
  mentorEligibility: {
    eligible: boolean
    appointmentInScope: boolean
    mentorGrantInScope: boolean
    reasons: string[]
  }
  studentIds: string[]
  summary: {
    targetedStudentCount: number
    unchangedCount: number
    endedAssignmentCount: number
    createdAssignmentCount: number
  }
  students: ApiMentorAssignmentBulkApplyStudent[]
}

export type ApiStudentRecord = {
  studentId: string
  institutionId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
  currentCgpa: number
  scopeDescriptor?: ApiScopeDescriptor | null
  resolvedFrom?: ApiResolvedFrom | null
  scopeMode?: ApiScopeMode | null
  countSource?: ApiCountSource | null
  activeOperationalSemester?: number | null
  activeAcademicContext: {
    enrollmentId: string
    branchId: string
    branchName: string | null
    departmentId: string | null
    departmentName: string | null
    termId: string
    academicYearLabel: string | null
    semesterNumber: number | null
    sectionCode: string
    batchId: string | null
    batchLabel: string | null
    admissionYear: number | null
    academicStatus: string
  } | null
  activeMentorAssignment: ApiMentorAssignment | null
  enrollments: ApiStudentEnrollment[]
  mentorAssignments: ApiMentorAssignment[]
}

export type ApiCourse = {
  courseId: string
  institutionId: string
  courseCode: string
  title: string
  defaultCredits: number
  departmentId: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumCourse = {
  curriculumCourseId: string
  batchId: string
  semesterNumber: number
  courseId: string | null
  courseCode: string
  title: string
  credits: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

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

export type ApiProofDashboard = {
  imports: Array<{
    curriculumImportVersionId: string
    sourceLabel: string
    sourceChecksum: string
    outputChecksum: string
    compilerVersion: string
    validationStatus: string
    unresolvedMappingCount: number
    status: string
    approvedAt: string | null
    createdAt: string
    certificate: Record<string, unknown>
  }>
  latestValidation: {
    validatorVersion: string
    status: string
    summary: Record<string, unknown>
  } | null
  crosswalkReviewQueue: Array<{
    officialCodeCrosswalkId: string
    internalCompilerId: string
    officialWebCode: string | null
    officialWebTitle: string | null
    confidence: string
    reviewStatus: string
    evidenceSource: string
  }>
  proofRuns: Array<{
    simulationRunId: string
    runLabel: string
    status: string
    activeFlag: boolean
    seed: number
    createdAt: string
    startedAt: string | null
    completedAt: string | null
    failureCode: string | null
    failureMessage: string | null
    progress: Record<string, unknown> | null
    metrics: Record<string, unknown>
    queueAgeSeconds?: number | null
    leaseState?: 'leased' | 'expired' | 'released' | null
    leaseExpiresAt?: string | null
    retryState?: 'retryable' | 'retry-of-previous-run' | null
    retryOfSimulationRunId?: string | null
    failureState?: 'none' | 'retryable'
  }>
  activeRunDetail: {
    simulationRunId: string
    runLabel: string
    seed: number
    activeOperationalSemester: number | null
    createdAt: string
    startedAt: string | null
    completedAt: string | null
    status: string
    failureCode: string | null
    failureMessage: string | null
    progress: Record<string, unknown> | null
    monitoringSummary: {
      riskAssessmentCount: number
      activeReassessmentCount: number
      alertDecisionCount: number
      acknowledgementCount: number
      resolutionCount: number
    }
    coverageDiagnostics: {
      behaviorProfileCoverage: {
        count: number
        expected: number
      }
      topicStateCoverage: {
        count: number
      }
      coStateCoverage: {
        count: number
      }
      questionTemplateCoverage: {
        count: number
      }
      questionResultCoverage: {
        count: number
      }
      interventionResponseCoverage: {
        count: number
      }
      worldContextCoverage: {
        count: number
      }
    }
    modelDiagnostics: {
      featureRowCount: number
      activeRunFeatureRowCount: number
      sourceRunCount: number
      trainingManifestVersion?: string | null
      runtimeSummary?: Record<string, unknown> | null
      overallCourseRuntimeSummary?: Record<string, unknown> | null
      queueBurdenSummary?: Record<string, unknown> | null
      stageRollups?: Array<Record<string, unknown>> | null
      acceptanceGateSummary?: Record<string, unknown> | null
      splitSummary?: {
        train: number
        validation: number
        test: number
      } | null
      worldSplitSummary?: {
        train: number
        validation: number
        test: number
      } | null
      scenarioFamilySummary?: Record<string, number> | null
      headSupportSummary?: Record<string, unknown> | null
      calibrationVersion?: string | null
      policyDiagnostics?: Record<string, unknown> | null
      coEvidenceDiagnostics?: Record<string, unknown> | null
      uiParityDiagnostics?: Record<string, unknown> | null
      production: {
        artifactVersion: string
        modelFamily: string
        createdAt: string
        evaluation: Record<string, unknown>
        trainingManifestVersion?: string | null
        splitSummary?: Record<string, number> | null
        worldSplitSummary?: Record<string, number> | null
        scenarioFamilySummary?: Record<string, number> | null
        headSupportSummary?: Record<string, unknown> | null
        calibrationVersion?: string | null
        policyDiagnostics?: Record<string, unknown> | null
        coEvidenceDiagnostics?: Record<string, unknown> | null
        uiParityDiagnostics?: Record<string, unknown> | null
        correlations?: Record<string, unknown> | null
      } | null
      challenger: {
        artifactVersion: string
        modelFamily: string
        createdAt: string
        evaluation: Record<string, unknown>
        trainingManifestVersion?: string | null
        splitSummary?: Record<string, number> | null
        worldSplitSummary?: Record<string, number> | null
        scenarioFamilySummary?: Record<string, number> | null
        headSupportSummary?: Record<string, unknown> | null
        calibrationVersion?: string | null
        policyDiagnostics?: Record<string, unknown> | null
        coEvidenceDiagnostics?: Record<string, unknown> | null
        uiParityDiagnostics?: Record<string, unknown> | null
        correlations?: Record<string, unknown> | null
      } | null
      correlations: Record<string, unknown> | null
    }
    queueDiagnostics?: {
      queuedRunCount: number
      runningRunCount: number
      failedRunCount: number
      retryableRunCount: number
      retryInFlightCount: number
      oldestQueuedRunAgeSeconds: number | null
      expiredLeaseRunCount: number
    }
    workerDiagnostics?: {
      queueAgeSeconds: number | null
      leaseState: 'leased' | 'expired' | 'released' | null
      leaseExpiresAt: string | null
      retryState: 'retryable' | 'retry-of-previous-run' | null
      retryOfSimulationRunId: string | null
      failureState: 'none' | 'retryable'
      progressPhase: string | null
      progressPercent: number | null
    } | null
    checkpointReadiness?: {
      totalCheckpointCount: number
      readyCheckpointCount: number
      blockedCheckpointCount: number
      playbackBlockedCheckpointCount: number
      totalBlockingQueueItemCount: number
      firstBlockedCheckpointId: string | null
      lastReadyCheckpointId: string | null
    }
    teacherAllocationLoad: Array<{
      teacherLoadProfileId: string
      facultyId: string
      facultyName: string
      semesterNumber: number
      sectionLoadCount: number
      weeklyContactHours: number
      assignedCredits: number
      permissions: string[]
    }>
    queuePreview: Array<{
      reassessmentEventId: string
      studentId: string
      studentName: string
      usn: string
      courseCode: string
      courseTitle: string
      sectionCode: string | null
      assignedToRole: string
      dueAt: string
      status: string
      riskBand: string
      riskProbScaled: number
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      coEvidenceMode?: string | null
      sourceKind?: 'runtime-reassessment' | 'checkpoint-playback'
      simulationStageCheckpointId?: string | null
      stageLabel?: string | null
    }>
    snapshots: Array<{
      simulationResetSnapshotId: string
      snapshotLabel: string
      createdAt: string
      payload: Record<string, unknown>
    }>
    checkpoints: ApiSimulationStageCheckpointSummary[]
  } | null
  lifecycleAudit: Array<{
    simulationLifecycleAuditId: string
    simulationRunId: string
    actionType: string
    payload: Record<string, unknown>
    createdByFacultyName: string | null
    createdAt: string
  }>
  recentOperationalEvents: Array<{
    operationalTelemetryEventId: string
    source: 'backend' | 'client'
    name: string
    level: 'info' | 'warn' | 'error'
    timestamp: string
    details: Record<string, unknown>
    createdAt: string
  }>
}

export type ApiActivateProofSemesterRequest = {
  semesterNumber: 1 | 2 | 3 | 4 | 5 | 6
}

export type ApiActivateProofSemesterResponse = {
  ok: true
  simulationRunId: string
  batchId: string
  activeOperationalSemester: number
  previousOperationalSemester: number | null
}

export type ApiSimulationStageCheckpointSummary = {
  simulationStageCheckpointId: string
  simulationRunId: string
  semesterNumber: number
  stageKey: string
  stageLabel: string
  stageDescription: string
  stageOrder: number
  previousCheckpointId: string | null
  nextCheckpointId: string | null
  totalStudentProjectionCount?: number
  studentCount?: number
  offeringCount?: number
  highRiskCount?: number
  mediumRiskCount?: number
  lowRiskCount?: number
  openQueueCount?: number
  watchQueueCount?: number
  watchStudentCount?: number
  resolvedQueueCount?: number
  noActionHighRiskCount?: number
  electiveVisibleCount?: number
  averageRiskDeltaScaled?: number
  averageRiskChangeFromPreviousCheckpointScaled?: number
  averageCounterfactualLiftScaled?: number
  stageAdvanceBlocked?: boolean
  blockingQueueItemCount?: number
  playbackAccessible?: boolean
  blockedByCheckpointId?: string | null
  blockedProgressionReason?: string | null
}

export type ApiRiskCalibrationMethod = 'identity' | 'sigmoid' | 'isotonic'

export type ApiRiskMetricSummary = {
  support: number
  positiveRate: number
  brierScore: number
  rocAuc: number
  expectedCalibrationError: number
}

export type ApiRiskCalibrationArtifact = {
  method: ApiRiskCalibrationMethod
  intercept: number | null
  slope: number | null
  thresholds: number[]
  values: number[]
  validationMetrics: ApiRiskMetricSummary
  testMetrics: ApiRiskMetricSummary
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  reliabilityBins: Array<{
    lowerBound: number
    upperBound: number
    meanPredicted: number
    meanObserved: number
    count: number
  }>
}

export type ApiRiskHeadDisplay = {
  displayProbabilityAllowed: boolean
  supportWarning: string | null
  calibrationMethod: ApiRiskCalibrationMethod
  calibrationStatus?: string | null
  riskBand?: string | null
  probabilityScaled?: number | null
}

export type ApiProofQueueState = 'open' | 'opened' | 'watch' | 'resolved'

export type ApiProofRecoveryState = 'under_watch' | 'confirmed_improvement'

export type ApiProofReassessmentResolutionOutcome =
  | 'completed_awaiting_evidence'
  | 'completed_improving'
  | 'not_completed'
  | 'no_show'
  | 'switch_intervention'
  | 'administratively_closed'

export type ApiProofQueueGovernanceFields = {
  queueCaseId?: string | null
  primaryCase?: boolean | null
  countsTowardCapacity?: boolean | null
  priorityRank?: number | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  assignedFacultyId?: string | null
}

export type ApiProofReassessmentAcknowledgement = {
  acknowledgedByFacultyId?: string | null
  status: string
  note: string | null
  createdAt: string
}

export type ApiProofReassessmentResolutionPayload = {
  outcome: ApiProofReassessmentResolutionOutcome
  temporaryResponseCredit: number
  recoveryState: ApiProofRecoveryState
  queueCaseId: string
  actorRole: ApiRoleCode | string
  resolvedAt: string
  version: number
}

export type ApiProofReassessmentResolution = {
  resolvedByFacultyId?: string | null
  resolutionStatus: string
  note: string | null
  createdAt: string
  outcome?: ApiProofReassessmentResolutionOutcome | null
  recoveryState?: ApiProofRecoveryState | null
  resolutionJson?: ApiProofReassessmentResolutionPayload | null
}

export type ApiProofReassessmentAcknowledgeRequest = {
  note?: string
}

export type ApiProofReassessmentResolveRequest = {
  outcome: ApiProofReassessmentResolutionOutcome
  note?: string
}

export type ApiProofReassessmentAcknowledgeResponse = {
  reassessmentEventId: string
  acknowledgement: ApiProofReassessmentAcknowledgement & {
    acknowledgementId: string
    alertDecisionId: string
  }
}

export type ApiProofReassessmentResolveResponse = {
  reassessmentEventId: string
  resolution: ApiProofReassessmentResolution & {
    reassessmentResolutionId: string
    resolutionJson: ApiProofReassessmentResolutionPayload
  }
}

export type ApiProofRunCheckpointDetail = {
  checkpoint: ApiSimulationStageCheckpointSummary
    queuePreview: Array<{
      simulationStageQueueProjectionId: string
      studentId: string
    offeringId: string | null
    semesterNumber: number
    sectionCode: string | null
    courseCode: string
    courseTitle: string
    assignedToRole: string
    taskType: string
    status: string
      riskBand: string
      riskProbScaled: number
      noActionRiskProbScaled: number | null
      recommendedAction: string | null
      simulatedActionTaken: string | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      coEvidenceMode?: string | null
      detail: Record<string, unknown> & ApiProofQueueGovernanceFields
    }>
  offeringRollups: Array<{
    simulationStageOfferingProjectionId: string
    offeringId: string | null
    curriculumNodeId: string | null
    semesterNumber: number
    sectionCode: string
    courseCode: string
    courseTitle: string
    stage: number
    stageLabel: string
    stageDescription: string
    pendingAction: string | null
    projection: Record<string, unknown>
  }>
}

export type ApiProofRunCheckpointStudentDetail = {
  checkpoint: ApiSimulationStageCheckpointSummary
  student: {
    studentId: string
    studentName: string
    usn: string
  }
    projections: Array<{
      simulationStageStudentProjectionId: string
      offeringId: string | null
    semesterNumber: number
    sectionCode: string
    courseCode: string
    courseTitle: string
    riskBand: string
    riskProbScaled: number
      noActionRiskBand: string | null
      noActionRiskProbScaled: number | null
      recommendedAction: string | null
      simulatedActionTaken: string | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      queueState: string | null
      reassessmentState: string | null
      evidenceWindow: string
    projection: Record<string, unknown>
  }>
}

export type ApiProofStudentEvidenceTimelineItem = {
  studentObservedSemesterStateId: string
  semesterNumber: number
  termId: string | null
  sectionCode: string
  observedState: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ApiStudentAgentPanelLabel = 'Observed' | 'Policy Derived' | 'Simulation Internal' | 'Human Action Log'

export type ApiStudentAgentCitation = {
  citationId: string
  label: string
  panelLabel: ApiStudentAgentPanelLabel
  summary: string
}

export type ApiStudentAgentTimelineItem = {
  timelineItemId: string
  panelLabel: ApiStudentAgentPanelLabel
  kind: 'semester-summary' | 'intervention' | 'reassessment' | 'resolution' | 'elective-fit'
  title: string
  detail: string
  occurredAt: string
  semesterNumber: number | null
  citations: ApiStudentAgentCitation[]
}

export type ApiStudentAgentMessage = {
  studentAgentMessageId: string
  actorType: string
  messageType: string
  body: string
  citations: ApiStudentAgentCitation[]
  guardrailCode: string | null
  createdAt: string
  updatedAt: string
}

export type ApiStudentAgentSession = {
  studentAgentSessionId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  studentId: string
  viewerFacultyId: string | null
  viewerRole: ApiRoleCode
  status: string
  responseMode: 'deterministic'
  cardVersion: number
  messages: ApiStudentAgentMessage[]
  createdAt: string
  updatedAt: string
}

export type ApiStudentAgentCard = {
  studentAgentCardId: string
  simulationRunId: string
  simulationStageCheckpointId: string | null
  cardVersion: number
  sourceSnapshotHash: string
  disclaimer: string
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  runContext: {
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
    batchLabel: string | null
    branchName: string | null
  }
  checkpointContext: {
    simulationStageCheckpointId: string
    semesterNumber: number
    stageKey: string
    stageLabel: string
    stageDescription: string
    stageOrder: number
    previousCheckpointId: string | null
    nextCheckpointId: string | null
    stageAdvanceBlocked?: boolean | null
    blockingQueueItemCount?: number | null
    playbackAccessible?: boolean | null
    blockedByCheckpointId?: string | null
    blockedProgressionReason?: string | null
  } | null
  student: {
    studentId: string
    studentName: string
    usn: string
    sectionCode: string
    currentSemester: number
    programScopeVersion: string | null
    mentorTrack: string | null
  }
  allowedIntents: string[]
  summaryRail: {
    currentRiskBand: string | null
    currentRiskProbScaled: number | null
    previousRiskBand?: string | null
    previousRiskProbScaled?: number | null
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    currentRiskDisplayProbabilityAllowed?: boolean | null
    currentRiskSupportWarning?: string | null
    currentRiskCalibrationMethod?: ApiRiskCalibrationMethod | null
    primaryCourseCode: string | null
    primaryCourseTitle: string | null
    nextDueAt: string | null
    currentReassessmentStatus: string | null
    currentQueueState?: ApiProofQueueState | null
    currentRecoveryState?: ApiProofRecoveryState | null
    currentCgpa: number
    backlogCount: number
    electiveFit: {
      recommendedCode: string
      recommendedTitle: string
      stream: string
      rationale: string[]
      alternatives: Array<{ code: string; title: string; stream: string }>
    } | null
  }
  overview: {
    observedLabel: ApiStudentAgentPanelLabel
    policyLabel: ApiStudentAgentPanelLabel
    currentEvidence: {
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      weakCoCount: number
      weakQuestionCount: number
      interventionRecoveryStatus: string | null
      coEvidenceMode?: string | null
    }
    currentStatus: {
      riskBand: string | null
      riskProbScaled: number | null
      riskCompleteness?: {
        graphAvailable: boolean
        historyAvailable: boolean
        complete: boolean
        missing: Array<'graph' | 'history'>
        fallbackMode: 'graph-aware' | 'policy-only'
      } | null
      featureCompleteness?: {
        graphAvailable: boolean
        historyAvailable: boolean
        complete: boolean
        missing: Array<'graph' | 'history'>
        fallbackMode: 'graph-aware' | 'policy-only'
      } | null
      featureProvenance?: {
        curriculumImportVersionId: string | null
        curriculumFeatureProfileFingerprint: string | null
        graphNodeCount: number
        graphEdgeCount: number
        historyCourseCount: number
      } | null
      previousRiskBand?: string | null
      previousRiskProbScaled?: number | null
      riskChangeFromPreviousCheckpointScaled?: number | null
      counterfactualLiftScaled?: number | null
      reassessmentStatus: string | null
      resolutionStatus?: string | null
      nextDueAt: string | null
      recommendedAction: string | null
      queueState: ApiProofQueueState | null
      simulatedActionTaken: string | null
      attentionAreas: string[]
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      assignedFacultyId?: string | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual?: number | null
      policyComparison?: {
        policyPhenotype?: string | null
        recommendedAction: string | null
        simulatedActionTaken: string | null
        noActionRiskBand: string | null
        noActionRiskProbScaled: number | null
        counterfactualLiftScaled: number | null
        rationale: string
      } | null
    }
    semesterSummaries: Array<{
      semesterNumber: number
      riskBands: string[]
      sgpa: number
      cgpaAfterSemester: number
      backlogCount: number
      weakCoCount: number
      questionResultCoverage: number
      interventionCount: number
    }>
  }
  topicAndCo: {
    panelLabel: ApiStudentAgentPanelLabel
    topicBuckets: {
      known: string[]
      partial: string[]
      blocked: string[]
      highUncertainty: string[]
    }
    weakCourseOutcomes: Array<{
      coCode: string
      coTitle: string
      trend: string
      topics: string[]
      tt1Pct: number
      tt2Pct: number
      seePct: number
      transferGap: number
      coEvidenceMode?: string | null
    }>
    questionPatterns: {
      weakQuestionCount: number
      carelessErrorCount: number
      transferGapCount: number
      commonWeakTopics: string[]
      commonWeakCourseOutcomes: string[]
    }
    simulationTags: string[]
  }
  assessmentEvidence: {
    panelLabel: ApiStudentAgentPanelLabel
    components: Array<{
      courseCode: string
      courseTitle: string
      sectionCode: string | null
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      weakCoCount: number
      weakQuestionCount: number
      drivers: Array<{ label: string; impact: number; feature: string }>
      coEvidenceMode?: string | null
    }>
  }
  interventions: {
    panelLabel: ApiStudentAgentPanelLabel
    currentReassessments: Array<{
      reassessmentEventId: string
      courseCode: string
      courseTitle: string
      status: string
      dueAt: string
      assignedToRole: string
      assignedFacultyId?: string | null
      queueCaseId?: string | null
      primaryCase?: boolean | null
      countsTowardCapacity?: boolean | null
      priorityRank?: number | null
      governanceReason?: string | null
      supportingCourseCount?: number | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual?: number | null
    }>
    interventionHistory: Array<{
      interventionId: string
      interventionType: string
      note: string
      occurredAt: string
      accepted: boolean | null
      completed: boolean | null
      recoveryConfirmed: boolean | null
      recoveryState?: ApiProofRecoveryState | null
      observedResidual: number | null
    }>
    humanActionLog: Array<{
      title: string
      detail: string
      occurredAt: string
    }>
  }
  counterfactual: {
    panelLabel: ApiStudentAgentPanelLabel
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    note: string
  } | null
  citations: ApiStudentAgentCitation[]
}

export type ApiFeatureCompleteness = {
  graphAvailable: boolean
  historyAvailable: boolean
  complete: boolean
  missing: Array<'graph' | 'history'>
  fallbackMode: 'graph-aware' | 'policy-only'
}

export type ApiFeatureProvenance = {
  curriculumImportVersionId: string | null
  curriculumFeatureProfileFingerprint: string | null
  graphNodeCount: number
  graphEdgeCount: number
  historyCourseCount: number
}

export type ApiStudentRiskExplorer = {
  simulationRunId: string
  simulationStageCheckpointId: string | null
  disclaimer: string
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  runContext: ApiStudentAgentCard['runContext']
  checkpointContext: ApiStudentAgentCard['checkpointContext']
  student: ApiStudentAgentCard['student']
  riskCompleteness?: ApiFeatureCompleteness | null
  featureCompleteness: ApiFeatureCompleteness
  featureProvenance: ApiFeatureProvenance
  modelProvenance: {
    modelVersion: string | null
    calibrationVersion: string | null
    featureSchemaVersion: string | null
    evidenceWindow: string | null
    simulationCalibrated: true
    calibrationMethod?: ApiRiskCalibrationMethod | null
    displayProbabilityAllowed?: boolean | null
    supportWarning?: string | null
    headDisplay?: Record<string, ApiRiskHeadDisplay | undefined> | null
    coEvidenceMode?: string | null
  }
  trainedRiskHeads: {
    currentRiskBand: string | null
    currentRiskProbScaled: number | null
    attendanceRiskProbScaled: number | null
    ceRiskProbScaled: number | null
    seeRiskProbScaled: number | null
    overallCourseRiskProbScaled: number | null
    downstreamCarryoverRiskProbScaled: number | null
  }
  trainedRiskHeadDisplays?: Record<string, ApiRiskHeadDisplay | undefined> | null
  policyComparison?: {
    policyPhenotype?: string | null
    recommendedAction: string | null
    simulatedActionTaken: string | null
    noActionRiskBand: string | null
    noActionRiskProbScaled: number | null
    counterfactualLiftScaled: number | null
    policyRationale: string
    candidates: Array<{
      action: string
      utility: number
      nextCheckpointBenefitScaled: number
      stableRecoveryScore: number
      semesterCloseBenefitScaled: number
      relapsePenalty: number
      capacityCost: number
      rationale: string
    }>
  } | null
  derivedScenarioHeads: {
    semesterSgpaDropRiskProbScaled: number | null
    cumulativeCgpaDropRiskProbScaled: number | null
    electiveMismatchRiskProbScaled: number | null
    note: string
  }
  currentEvidence: ApiStudentAgentCard['overview']['currentEvidence']
  currentStatus: ApiStudentAgentCard['overview']['currentStatus']
  topDrivers: Array<{ label: string; impact: number; feature: string }>
  crossCourseDrivers: string[]
  prerequisiteMap: {
    prerequisiteCourseCodes: string[]
    weakPrerequisiteCourseCodes: string[]
    prerequisitePressureScaled: number | null
    prerequisiteAveragePct: number | null
    prerequisiteFailureCount: number | null
    completeness?: ApiFeatureCompleteness | null
  }
  weakCourseOutcomes: ApiStudentAgentCard['topicAndCo']['weakCourseOutcomes']
  questionPatterns: ApiStudentAgentCard['topicAndCo']['questionPatterns']
  semesterSummaries: ApiStudentAgentCard['overview']['semesterSummaries']
  assessmentComponents: ApiStudentAgentCard['assessmentEvidence']['components']
  counterfactual: ApiStudentAgentCard['counterfactual']
  electiveFit: ApiStudentAgentCard['summaryRail']['electiveFit']
}

export type ApiFacultyProofOperations = {
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  activeRunContexts: Array<{
    batchId: string
    batchLabel: string
    branchName: string | null
    simulationRunId: string
    runLabel: string
    status: string
    seed: number
    createdAt: string
  }>
  selectedCheckpoint: ApiSimulationStageCheckpointSummary | null
  monitoringQueue: Array<{
    riskAssessmentId: string
    simulationRunId: string | null
    batchId: string | null
    batchLabel: string | null
    branchName: string | null
    studentId: string
    studentName: string
    usn: string
    offeringId: string
    courseCode: string
    courseTitle: string
    sectionCode: string | null
    riskBand: string
    riskProbScaled: number
    recommendedAction: string
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    drivers: Array<{ label: string; impact: number; feature: string }>
    dueAt: string | null
    reassessmentStatus: string | null
    decisionType: string | null
    decisionNote: string | null
    observedEvidence: {
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      cgpa: number
      backlogCount: number
      weakCoCount: number
      weakQuestionCount: number
      interventionRecoveryStatus: string | null
      coEvidenceMode?: string | null
    }
    override: {
      overrideBand: string
      overrideNote: string
      createdAt: string
    } | null
    acknowledgement: {
      status: string
      note: string | null
      createdAt: string
    } | null
    resolution: {
      resolutionStatus: string
      note: string | null
      createdAt: string
    } | null
  }>
  electiveFits: Array<{
    electiveRecommendationId: string
    studentId: string
    studentName: string
    usn: string
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string[]
    alternatives: Array<{ code: string; title: string; stream: string }>
    updatedAt: string
  }>
}

export type ApiAcademicHodProofRunContext = {
  simulationRunId: string
  batchId: string
  batchLabel: string
  branchName: string | null
  runLabel: string
  status: string
  seed: number
  createdAt: string
  sourceLabel: string
  checkpointContext?: ApiSimulationStageCheckpointSummary | null
}

export type ApiAcademicHodProofSummary = {
  activeRunContext: ApiAcademicHodProofRunContext | null
  scopeDescriptor: ApiScopeDescriptor
  resolvedFrom: ApiResolvedFrom
  scopeMode: ApiScopeMode
  countSource: ApiCountSource
  activeOperationalSemester: number | null
  scope: {
    departmentNames: string[]
    branchNames: string[]
  }
  monitoringSummary: {
    riskAssessmentCount: number
    activeReassessmentCount: number
    alertDecisionCount: number
    acknowledgementCount: number
    resolutionCount: number
  }
  totals: {
    studentsCovered: number
    highRiskCount: number
    mediumRiskCount: number
    averageQueueAgeHours: number
    manualOverrideCount: number
    unresolvedAlertCount: number
    resolvedAlertCount: number
  }
  sectionComparison: Array<{
    sectionCode: string
    studentCount: number
    highRiskCount: number
    mediumRiskCount: number
    averageAttendancePct: number
    openReassessmentCount: number
  }>
  semesterRiskDistribution: Array<{
    semesterNumber: number
    highPressureCount: number
    reviewCount: number
    stableCount: number
    basis: string
  }>
  backlogDistribution: Array<{
    bucket: string
    studentCount: number
  }>
  electiveDistribution: Array<{
    stream: string
    recommendationCount: number
  }>
  facultyLoadSummary: {
    facultyCount: number
    overloadedFacultyCount: number
    averageWeeklyContactHours: number
  }
}

export type ApiAcademicHodProofCourseRollup = {
  courseCode: string
  title: string
  sectionCodes: string[]
  riskCountHigh: number
  riskCountMedium: number
  averageAttendancePct: number
  tt1WeakCount: number
  tt2WeakCount: number
  seeWeakCount: number
  weakQuestionSignalCount: number
  backlogCarryoverCount: number
  openReassessmentCount: number
  resolvedReassessmentCount: number
  studentCount: number
}

export type ApiAcademicHodProofFacultyRollup = {
  facultyId: string
  facultyName: string
  designation: string
  permissions: string[]
  weeklyContactHours: number
  sectionLoadCount: number
  assignedSections: string[]
  queueLoad: number
  avgAcknowledgementLagHours: number
  reassessmentClosureRate: number
  interventionCount: number
  overloadFlag: boolean
}

export type ApiAcademicHodProofStudentWatch = {
  studentId: string
  studentName: string
  usn: string
  sectionCode: string
  currentSemester: number
  currentRiskBand: string
  currentRiskProbScaled: number
  currentQueueState?: ApiProofQueueState | null
  currentRecoveryState?: ApiProofRecoveryState | null
  previousRiskBand?: string | null
  previousRiskProbScaled?: number | null
  riskChangeFromPreviousCheckpointScaled?: number | null
  counterfactualLiftScaled?: number | null
  queueCaseId?: string | null
  countsTowardCapacity?: boolean | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  assignedFacultyId?: string | null
  primaryCourseCode: string
  primaryCourseTitle: string
  currentReassessmentStatus: string | null
  nextDueAt: string | null
  observedEvidence: {
    attendancePct: number
    tt1Pct: number
    tt2Pct: number
    quizPct: number
    assignmentPct: number
    seePct: number
    cgpa: number
    backlogCount: number
    weakCoCount: number
    weakQuestionCount: number
    interventionRecoveryStatus: string | null
    coEvidenceMode?: string | null
  }
  electiveFit: {
    recommendedCode: string
    recommendedTitle: string
    stream: string
    rationale: string[]
    alternatives: Array<{ code: string; title: string; stream: string }>
  } | null
  courseSnapshots: Array<{
    riskAssessmentId: string
    offeringId: string
    courseCode: string
    courseTitle: string
    sectionCode: string | null
    riskBand: string
    riskProbScaled: number
    queueState?: ApiProofQueueState | null
    queueCaseId?: string | null
    primaryCase?: boolean | null
    countsTowardCapacity?: boolean | null
    recommendedAction: string
    riskChangeFromPreviousCheckpointScaled?: number | null
    counterfactualLiftScaled?: number | null
    observedEvidence: {
      attendancePct: number
      tt1Pct: number
      tt2Pct: number
      quizPct: number
      assignmentPct: number
      seePct: number
      cgpa: number
      backlogCount: number
      weakCoCount: number
      weakQuestionCount: number
      interventionRecoveryStatus: string | null
      coEvidenceMode?: string | null
    }
    drivers: Array<{ label: string; impact: number; feature: string }>
  }>
  evidenceTimeline: ApiProofStudentEvidenceTimelineItem[]
}

export type ApiAcademicHodProofReassessment = {
  reassessmentEventId: string
  simulationRunId: string
  runLabel: string
  studentId: string
  studentName: string
  usn: string
  courseCode: string
  courseTitle: string
  sectionCode: string | null
  assignedToRole: string
  assignedFacultyId?: string | null
  dueAt: string
  status: string
  riskBand: string
  riskProbScaled: number
  decisionType: string | null
  decisionNote: string | null
  queueCaseId?: string | null
  primaryCase?: boolean | null
  countsTowardCapacity?: boolean | null
  priorityRank?: number | null
  governanceReason?: string | null
  supportingCourseCount?: number | null
  recoveryState?: ApiProofRecoveryState | null
  observedResidual?: number | null
  acknowledgement: ApiProofReassessmentAcknowledgement | null
  resolution: ApiProofReassessmentResolution | null
}

export type ApiAcademicHodProofBundle = {
  summary: ApiAcademicHodProofSummary
  courses: ApiAcademicHodProofCourseRollup[]
  faculty: ApiAcademicHodProofFacultyRollup[]
  students: ApiAcademicHodProofStudentWatch[]
  reassessments: ApiAcademicHodProofReassessment[]
}

export type ApiAdminSearchRoute = {
  section: 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

export type ApiAdminSearchResult = {
  key: string
  entityType: string
  entityId: string
  label: string
  meta: string
  route: ApiAdminSearchRoute
}

export type ApiAdminReminder = {
  reminderId: string
  facultyId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiTargetEntityRef = {
  entityType: string
  entityId: string
}

export type ApiAdminRequestSummary = {
  adminRequestId: string
  requestType: string
  scopeType: string
  scopeId: string
  targetEntityRefs: ApiTargetEntityRef[]
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: 'New' | 'In Review' | 'Needs Info' | 'Approved' | 'Rejected' | 'Implemented' | 'Closed'
  requestedByRole: ApiRoleCode
  requestedByFacultyId: string
  ownedByRole: ApiRoleCode
  ownedByFacultyId: string | null
  summary: string
  details: string
  notesThreadId: string
  dueAt: string
  slaPolicyCode: string
  decision: string | null
  payload: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  requesterName?: string | null
  ownerName?: string | null
}

export type ApiAdminRequestNote = {
  noteId: string
  adminRequestId: string
  authorRole: string
  authorFacultyId: string | null
  visibility: string
  noteType: string
  body: string
  createdAt: string
}

export type ApiAdminRequestTransition = {
  transitionId: string
  adminRequestId: string
  previousStatus: string | null
  nextStatus: string
  actorRole: string
  actorFacultyId: string | null
  noteId: string | null
  affectedEntityRefs: ApiTargetEntityRef[]
  createdAt: string
}

export type ApiAuditEvent = {
  auditEventId: string
  entityType: string
  entityId: string
  action: string
  actorRole: string
  actorId: string | null
  before: unknown
  after: unknown
  metadata: unknown
  createdAt: string
}

export type ApiAdminRequestDetail = ApiAdminRequestSummary & {
  notes: ApiAdminRequestNote[]
  transitions: ApiAdminRequestTransition[]
}

export type ApiAcademicLoginFaculty = {
  facultyId: string
  username: string
  name: string
  displayName: string
  designation: string
  dept: string
  departmentCode: string
  roleTitle: string
  allowedRoles: Array<'Course Leader' | 'Mentor' | 'HoD'>
}

export type ApiAcademicRuntimeState = {
  studentPatches: Record<string, StudentRuntimePatch>
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  drafts: Record<string, number>
  cellValues: Record<string, number>
  lockByOffering: Record<string, EntryLockMap>
  lockAuditByTarget: Record<string, QueueTransition[]>
  tasks: SharedTask[]
  resolvedTasks: Record<string, number>
  timetableByFacultyId: Record<string, FacultyTimetableTemplate>
  adminCalendarByFacultyId: Record<string, ApiAdminFacultyCalendarWorkspace>
  taskPlacements: Record<string, TaskCalendarPlacement>
  calendarAudit: CalendarAuditEvent[]
}

export type ApiAcademicTaskRecord = SharedTask & {
  version: number
}

export type ApiAcademicTaskListResponse = {
  items: ApiAcademicTaskRecord[]
}

export type ApiUpsertAcademicTaskRequest = {
  task: SharedTask
  expectedVersion?: number
}

export type ApiUpsertAcademicTaskResponse = {
  task: ApiAcademicTaskRecord
  created: boolean
}

export type ApiAcademicTaskPlacementRecord = TaskCalendarPlacement

export type ApiAcademicTaskPlacementListResponse = {
  items: ApiAcademicTaskPlacementRecord[]
}

export type ApiUpsertAcademicTaskPlacementRequest = {
  placement: TaskCalendarPlacement
  expectedUpdatedAt?: number
}

export type ApiUpsertAcademicTaskPlacementResponse = {
  placement: ApiAcademicTaskPlacementRecord
  created: boolean
}

export type ApiDeleteAcademicTaskPlacementResponse = {
  ok: true
  taskId: string
  deleted: boolean
}

export type ApiAcademicCalendarAuditRecord = CalendarAuditEvent

export type ApiAcademicCalendarAuditListResponse = {
  items: ApiAcademicCalendarAuditRecord[]
}

export type ApiAppendAcademicCalendarAuditRequest = {
  event: CalendarAuditEvent
}

export type ApiAppendAcademicCalendarAuditResponse = {
  event: ApiAcademicCalendarAuditRecord
  created: boolean
}

export type ApiCourseOutcomeScopeType = 'institution' | 'branch' | 'batch' | 'offering'

export type ApiCourseOutcome = {
  id: string
  desc: string
  bloom: string
}

export type ApiCourseOutcomeOverride = {
  courseOutcomeOverrideId: string
  courseId: string
  scopeType: ApiCourseOutcomeScopeType
  scopeId: string
  outcomes: ApiCourseOutcome[]
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiResolvedCourseOutcomeSet = {
  offeringId: string
  courseId: string
  outcomes: ApiCourseOutcome[]
}

export type ApiCurriculumFeatureConfigPayload = {
  assessmentProfile: string
  outcomes: ApiCourseOutcome[]
  prerequisites: Array<{
    sourceCourseCode: string
    edgeKind: 'explicit' | 'added'
    rationale: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
  targetMode?: 'batch-local-override' | 'scope-profile'
  targetScopeType?: ApiScopeType
  targetScopeId?: string
  curriculumFeatureProfileId?: string | null
}

export type ApiCurriculumFeatureProfile = {
  curriculumFeatureProfileId: string
  name: string
  scopeType: ApiScopeType
  scopeId: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatchCurriculumFeatureBinding = {
  batchId: string
  curriculumFeatureProfileId: string | null
  bindingMode: 'inherit-scope-profile' | 'pin-profile' | 'local-only'
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatchCurriculumFeatureOverride = {
  batchCurriculumFeatureOverrideId: string
  batchId: string
  curriculumCourseId: string
  courseId: string | null
  courseCode: string
  title: string
  override: ApiCurriculumFeatureConfigPayload
  featureFingerprint?: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumFeatureConfigItem = {
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  curriculumNodeId: string | null
  courseId: string | null
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
  assessmentProfile: string
  outcomes: ApiCourseOutcome[]
  outcomeOverride: ApiCourseOutcomeOverride | null
  prerequisites: Array<{
    curriculumEdgeId: string
    sourceCurriculumNodeId: string
    sourceCourseCode: string
    sourceTitle: string
    edgeKind: string
    rationale: string
    status: string
  }>
  bridgeModules: string[]
  topicPartitions: {
    tt1: string[]
    tt2: string[]
    see: string[]
    workbook: string[]
  }
  resolvedConfig?: ApiCurriculumFeatureConfigPayload
  featureFingerprint?: string
  resolvedSource?: {
    mode: 'materialized' | 'scope-profile' | 'pinned-profile' | 'batch-local-override'
    label: string
    scopeType?: ApiScopeType
    scopeId?: string
    curriculumFeatureProfileId?: string | null
  }
  appliedProfiles?: ApiCurriculumFeatureProfile[]
  localOverride?: ApiBatchCurriculumFeatureOverride | null
}

export type ApiCurriculumFeatureConfigBundle = {
  batchId: string
  curriculumImportVersion: {
    curriculumImportVersionId: string
    sourceLabel: string
    sourceType: string
    status: string
    validationStatus: string
    updatedAt: string
  } | null
  binding?: ApiBatchCurriculumFeatureBinding
  availableProfiles?: ApiCurriculumFeatureProfile[]
  primaryCurriculumFeatureProfileId?: string | null
  curriculumFeatureProfileFingerprint?: string
  items: ApiCurriculumFeatureConfigItem[]
}

export type ApiProofRefresh = {
  affectedBatchIds: string[]
  queuedSimulationRunIds: string[]
  curriculumImportVersionId: string | null
  failedBatchIds: string[]
  status: 'not-needed' | 'queued' | 'degraded'
  warning: string | null
}

export type ApiCurriculumLinkageGenerationStatus = {
  status: 'ok' | 'degraded' | 'error'
  warnings: string[]
  provider: 'python-nlp' | 'typescript-fallback'
}

export type ApiCurriculumFeatureConfigSaveResult = {
  ok: true
  batchId: string
  curriculumCourseId: string
  curriculumImportVersionId: string | null
  affectedBatchIds?: string[]
  proofRefresh?: ApiProofRefresh
  targetMode?: 'batch-local-override' | 'scope-profile'
  curriculumFeatureProfileId?: string | null
}

export type ApiCurriculumFeatureBindingSaveResult = {
  ok: true
  batchId: string
  curriculumImportVersionId: string | null
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  binding: ApiBatchCurriculumFeatureBinding
}

export type ApiCurriculumBootstrapResult = {
  ok: true
  batchId: string
  manifestKey: 'msruas-mnc-seed'
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  candidateGenerationStatus: ApiCurriculumLinkageGenerationStatus
  curriculumImportVersionId: string | null
  curriculumFeatureProfileId: string
  curriculumFeatureProfileFingerprint: string
  createdCourseCount: number
  upsertedProfileCourseCount: number
  generatedCandidateCount: number
}

export type ApiCurriculumLinkageCandidate = {
  curriculumLinkageCandidateId: string
  batchId: string
  curriculumCourseId: string
  sourceCurriculumCourseId?: string | null
  sourceCourseId?: string | null
  sourceCourseCode: string
  sourceTitle: string
  targetCourseCode: string
  targetTitle: string
  edgeKind: 'explicit' | 'added'
  rationale: string
  confidenceScaled: number
  sources: string[]
  signalSummary: Record<string, unknown>
  status: string
  reviewNote?: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumLinkageCandidateRegenerateResult = {
  ok: true
  batchId: string
  curriculumCourseId: string | null
  items: ApiCurriculumLinkageCandidate[]
  candidateGenerationStatus: ApiCurriculumLinkageGenerationStatus
}

export type ApiCurriculumLinkageApprovalResult = {
  ok: true
  batchId: string
  curriculumLinkageCandidateId: string
  approvalSucceeded: true
  proofRefreshQueued: boolean
  proofRefreshWarning: string | null
  affectedBatchIds: string[]
  curriculumImportVersionId: string | null
  proofRefresh?: ApiProofRefresh
}

export type ApiAcademicMeeting = AcademicMeeting
export type ApiCoAttainmentRow = CoAttainmentRow

export type ApiAcademicBootstrap = {
  professor: Professor
  faculty: FacultyAccount[]
  offerings: Offering[]
  yearGroups: YearGroup[]
  mentees: Mentee[]
  teachers: TeacherInfo[]
  subjectRuns: SubjectRun[]
  studentsByOffering: Record<string, Student[]>
  studentHistoryByUsn: Record<string, StudentHistoryRecord>
  runtime: ApiAcademicRuntimeState
  courseOutcomesByOffering: Record<string, ApiCourseOutcome[]>
  assessmentSchemesByOffering: Record<string, SchemeState>
  questionPapersByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  coAttainmentByOffering: Record<string, ApiCoAttainmentRow[]>
  meetings: ApiAcademicMeeting[]
  proofPlayback?: {
    simulationStageCheckpointId: string
    simulationRunId: string
    semesterNumber: number
    stageKey: string
    stageLabel: string
    stageDescription: string
    stageOrder: number
    previousCheckpointId: string | null
    nextCheckpointId: string | null
  } | null
}

export type ApiAcademicRuntimeKey = keyof ApiAcademicRuntimeState

export type ApiAdminOffering = Offering & {
  termId?: string
  branchId?: string
  version?: number
  finalsLocked?: boolean
}

export type ApiOfferingStageEligibility = {
  offeringId: string
  batchId: string | null
  policy: ApiStagePolicyPayload
  currentStage: ApiStagePolicyStage
  nextStage: ApiStagePolicyStage | null
  eligible: boolean
  blockingReasons: string[]
  queueBurden: number
  evidenceStatus: Array<{
    kind: ApiStageEvidenceKind
    required: boolean
    present: boolean
    presentCount: number
    expectedCount: number
    locked: boolean
  }>
}

export type ApiBatchProvisioningRequest = {
  termId: string
  sectionLabels?: string[]
  mode?: 'live-empty' | 'mock' | 'manual'
  studentsPerSection?: number
  facultyPoolIds?: string[]
  createStudents?: boolean
  createMentors?: boolean
  createAttendanceScaffolding?: boolean
  createAssessmentScaffolding?: boolean
  createTranscriptScaffolding?: boolean
}

export type ApiBatchProvisioningResponse = {
  ok: true
  batchId: string
  termId: string
  sections: string[]
  affectedBatchIds: string[]
  proofRefresh?: ApiProofRefresh
  summary: {
    createdOfferingCount: number
    createdStudentCount: number
    createdEnrollmentCount: number
    createdMentorCount: number
    createdAttendanceCount: number
    createdAssessmentCount: number
    createdTranscriptCount: number
    facultyPoolCount: number
    mentorFacultyPoolCount: number
    curriculumCourseCount: number
  }
  policyFingerprint: ApiStagePolicyPayload
  curriculumFeatureProfileFingerprint: string
}

export type ApiAdminCalendarMarkerType =
  | 'semester-start'
  | 'semester-end'
  | 'term-test-start'
  | 'term-test-end'
  | 'holiday'
  | 'event'

export type ApiAdminCalendarMarker = {
  markerId: string
  facultyId: string
  markerType: ApiAdminCalendarMarkerType
  title: string
  note: string | null
  dateISO: string
  endDateISO: string | null
  allDay: boolean
  startMinutes: number | null
  endMinutes: number | null
  color: string
  createdAt: number
  updatedAt: number
}

export type ApiAdminFacultyCalendarWorkspace = {
  publishedAt: string | null
  markers: ApiAdminCalendarMarker[]
}

export type ApiAdminFacultyCalendar = {
  facultyId: string
  template: FacultyTimetableTemplate | null
  workspace: ApiAdminFacultyCalendarWorkspace
  directEditWindowEndsAt: string | null
  classEditingLocked: boolean
}

export type ApiOfferingOwnership = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAttendanceSnapshot = {
  attendanceSnapshotId: string
  studentId: string
  offeringId: string
  presentClasses: number
  totalClasses: number
  attendancePercent: number
  source: string
  capturedAt: string
}

export type ApiAssessmentScore = {
  assessmentScoreId: string
  studentId: string
  offeringId: string
  termId: string | null
  componentType: 'tt1' | 'tt2' | 'quiz1' | 'quiz2' | 'asgn1' | 'asgn2' | 'sem_end' | 'lab' | 'viva' | 'other'
  componentCode: string | null
  score: number
  maxScore: number
  evaluatedAt: string
}

export type ApiStudentIntervention = {
  interventionId: string
  studentId: string
  facultyId: string | null
  offeringId: string | null
  interventionType: string
  note: string
  occurredAt: string
}

export type ApiTranscriptTermResult = {
  transcriptTermResultId: string
  studentId: string
  termId: string
  sgpaScaled: number
  registeredCredits: number
  earnedCredits: number
  backlogCount: number
}

export type ApiTranscriptSubjectResult = {
  transcriptSubjectResultId: string
  transcriptTermResultId: string
  courseCode: string
  title: string
  credits: number
  score: number
  gradeLabel: string
  gradePoint: number
  result: string
}

export type ApiAcademicFacultyProfile = {
  facultyId: string
  displayName: string
  designation: string
  employeeCode: string
  joinedOn: string | null
  email: string
  phone: string | null
  primaryDepartment: {
    departmentId: string
    name: string
    code: string
  } | null
  appointments: ApiFacultyAppointment[]
  permissions: ApiRoleGrant[]
  subjectRunCourseLeaderScope: Array<{
    subjectRunId: string
    courseCode: string
    title: string
    termId: string
    yearLabel: string
    sectionCodes: string[]
  }>
  mentorScope: {
    activeStudentCount: number
    studentIds: string[]
  }
  currentOwnedClasses: Array<{
    offeringId: string
    courseCode: string
    title: string
    yearLabel: string
    sectionCode: string
    ownershipRole: string
    departmentName: string | null
    branchName: string | null
  }>
  currentBatchContexts: Array<{
    batchId: string
    batchLabel: string
    branchName: string | null
    currentSemester: number
    sectionCodes: string[]
    roleCoverage: string[]
  }>
  timetableStatus: {
    hasTemplate: boolean
    publishedAt: string | null
    directEditWindowEndsAt: string | null
  }
  requestSummary: {
    openCount: number
    recent: Array<{
      adminRequestId: string
      summary: string
      status: string
      updatedAt: string
    }>
  }
  reassessmentSummary: {
    openCount: number
    nextDueAt: string | null
    recentDecisionTypes: string[]
  }
  proofOperations: ApiFacultyProofOperations
}
