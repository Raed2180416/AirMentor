// Part of the AirMentor API client, decomposed from the original
// adapters/web/shared/api/client.ts monolith into ./client-parts/*.
// Behavior is unchanged; method bodies are moved verbatim. The public class
// AirMentorApiClient is assembled via a linear route-layer inheritance chain.

import type {
  ApiAcademicBootstrap,
  ApiAcademicCalendarAuditListResponse,
  ApiAcademicFaculty,
  ApiAcademicFacultyProfile,
  ApiAcademicHodProofBundle,
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
  ApiAcademicLoginFaculty,
  ApiAcademicMeeting,
  ApiAcademicRuntimeKey,
  ApiAcademicTaskListResponse,
  ApiAcademicTaskPlacementListResponse,
  ApiAcademicTerm,
  ApiActivateProofSemesterRequest,
  ApiActivateProofSemesterResponse,
  ApiAdminFacultyCalendar,
  ApiAdminFacultyPasswordSetupResponse,
  ApiAdminOffering,
  ApiAdminReminder,
  ApiAdminRequestDetail,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAdminSearchResult,
  ApiAppendAcademicCalendarAuditRequest,
  ApiAppendAcademicCalendarAuditResponse,
  ApiAssessmentScore,
  ApiAttendanceSnapshot,
  ApiAuditEvent,
  ApiBatch,
  ApiBatchCurriculumFeatureBinding,
  ApiBatchProvisioningRequest,
  ApiBatchProvisioningResponse,
  ApiBatchSetupReadiness,
  ApiBranch,
  ApiCourse,
  ApiCourseOutcomeOverride,
  ApiCourseOutcomeScopeType,
  ApiCurriculumBootstrapResult,
  ApiCurriculumCourse,
  ApiCurriculumFeatureBindingSaveResult,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigPayload,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumFeatureConfigSaveResult,
  ApiCurriculumFeatureProfile,
  ApiCurriculumGraphBundle,
  ApiCurriculumLinkageApprovalResult,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageCandidateRegenerateResult,
  ApiDeleteAcademicTaskPlacementResponse,
  ApiDepartment,
  ApiFacultyAppointment,
  ApiFacultyRecord,
  ApiGraphEdge,
  ApiGraphNode,
  ApiInstitution,
  ApiLoginRequest,
  ApiMentorAssignment,
  ApiMentorAssignmentBulkApplyRequest,
  ApiMentorAssignmentBulkApplyResponse,
  ApiOfferingOwnership,
  ApiOfferingStageEligibility,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRedeemResponse,
  ApiPasswordSetupRequestResponse,
  ApiPolicyOverride,
  ApiProofDashboard,
  ApiProofReassessmentAcknowledgeRequest,
  ApiProofReassessmentAcknowledgeResponse,
  ApiProofReassessmentResolveRequest,
  ApiProofReassessmentResolveResponse,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentDetail,
  ApiProofRunCheckpointStudentSummary,
  ApiProofStudentEvidenceTimelineItem,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiResolvedCourseOutcomeSet,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiSimulationStageCheckpointSummary,
  ApiStagePolicyOverride,
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
  ApiStudentEnrollment,
  ApiStudentIntervention,
  ApiStudentRecord,
  ApiStudentRiskExplorer,
  ApiTranscriptSubjectResult,
  ApiTranscriptTermResult,
  ApiUiPreferences,
  ApiUpsertAcademicTaskPlacementRequest,
  ApiUpsertAcademicTaskPlacementResponse,
  ApiUpsertAcademicTaskRequest,
  ApiUpsertAcademicTaskResponse
} from '@web/shared/api/types'
import type { EntryKind, FacultyTimetableTemplate, MeetingStatus, SchemeState, TTKind, TermTestBlueprint } from '@kernel/shared/domain'

export interface AirMentorApiClientLike {
  restoreSession(): Promise<ApiSessionResponse>
  login(payload: ApiLoginRequest): Promise<ApiSessionResponse>
  requestPasswordSetup(payload: { identifier: string }): Promise<ApiPasswordSetupRequestResponse>
  inspectPasswordSetup(token: string): Promise<ApiPasswordSetupInspectResponse>
  redeemPasswordSetup(payload: { token: string; password: string }): Promise<ApiPasswordSetupRedeemResponse>
  logout(): Promise<void>
  switchRoleContext(roleGrantId: string): Promise<ApiSessionResponse>
  listAcademicLoginFaculty(): Promise<{ items: ApiAcademicLoginFaculty[] }>
  getAcademicBootstrap(filter?: { simulationStageCheckpointId?: string }): Promise<ApiAcademicBootstrap>
  getAcademicHodProofBundle(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }): Promise<ApiAcademicHodProofBundle>
  getAcademicHodProofSummary(filter?: { section?: string; semester?: number; simulationStageCheckpointId?: string }): Promise<ApiAcademicHodProofSummary>
  getAcademicHodProofCourses(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiAcademicHodProofCourseRollup[] }>
  getAcademicHodProofFaculty(filter?: { section?: string; semester?: number; facultyId?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiAcademicHodProofFacultyRollup[] }>
  getAcademicHodProofStudents(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiAcademicHodProofStudentWatch[] }>
  getAcademicHodProofReassessments(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiAcademicHodProofReassessment[] }>
  advanceAcademicProofRun(simulationRunId: string, payload: { mode: 'day' | 'previous-day' | 'stage' }): Promise<Record<string, unknown>>
  stopAcademicProofRun(simulationRunId: string): Promise<Record<string, unknown>>
  recomputeAcademicProofRunRisk(simulationRunId: string): Promise<{ ok: true }>
  acknowledgeAcademicProofReassessment(reassessmentEventId: string, payload?: ApiProofReassessmentAcknowledgeRequest): Promise<ApiProofReassessmentAcknowledgeResponse>
  resolveAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentResolveRequest): Promise<ApiProofReassessmentResolveResponse>
  getAcademicStudentAgentCard(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentAgentCard>
  getAcademicStudentRiskExplorer(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentRiskExplorer>
  getAcademicStudentAgentTimeline(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiStudentAgentTimelineItem[] }>
  startAcademicStudentAgentSession(studentId: string, payload?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentAgentSession>
  sendAcademicStudentAgentMessage(sessionId: string, payload: { prompt: string }): Promise<{ items: ApiStudentAgentMessage[] }>
  saveAcademicDrafts(payload: Record<string, number>): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  saveAcademicCellValues(payload: Record<string, number>): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  saveAcademicLockByOffering(payload: Record<string, Record<string, boolean>>): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  saveAcademicLockAuditByTarget(payload: Record<string, Array<{ action: string; actorRole: string; at?: number }>>): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  saveAcademicResolvedTasks(payload: Record<string, number>): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  listAcademicTasks(): Promise<ApiAcademicTaskListResponse>
  saveAcademicTask(taskId: string, payload: ApiUpsertAcademicTaskRequest): Promise<ApiUpsertAcademicTaskResponse>
  listAcademicTaskPlacements(): Promise<ApiAcademicTaskPlacementListResponse>
  saveAcademicTaskPlacement(taskId: string, payload: ApiUpsertAcademicTaskPlacementRequest): Promise<ApiUpsertAcademicTaskPlacementResponse>
  deleteAcademicTaskPlacement(taskId: string, expectedUpdatedAt?: number): Promise<ApiDeleteAcademicTaskPlacementResponse>
  listAcademicCalendarAuditEvents(): Promise<ApiAcademicCalendarAuditListResponse>
  appendAcademicCalendarAuditEvent(payload: ApiAppendAcademicCalendarAuditRequest): Promise<ApiAppendAcademicCalendarAuditResponse>
  saveFacultyCalendarWorkspace(facultyId: string, payload: { template: FacultyTimetableTemplate }): Promise<{ facultyId: string; template: FacultyTimetableTemplate; version: number; directEditWindowEndsAt: string | null; classEditingLocked: boolean }>
  createAcademicMeeting(payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status?: MeetingStatus }): Promise<ApiAcademicMeeting>
  updateAcademicMeeting(meetingId: string, payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: MeetingStatus; version: number }): Promise<ApiAcademicMeeting>
  commitOfferingAttendance(offeringId: string, payload: { entries: Array<{ studentId: string; presentClasses: number; totalClasses: number }>; capturedAt?: string; lock?: boolean }): Promise<{ ok: true; offeringId: string; capturedAt: string; averageAttendance: number; locked: boolean }>
  commitOfferingAssessmentEntries(offeringId: string, kind: Exclude<EntryKind, 'attendance'>, payload: { entries: Array<{ studentId: string; components: Array<{ componentCode: string; score: number; maxScore: number }> }>; evaluatedAt?: string; lock?: boolean }): Promise<{ ok: true; offeringId: string; kind: Exclude<EntryKind, 'attendance'>; evaluatedAt: string; locked: boolean }>
  clearOfferingAssessmentLock(offeringId: string, kind: EntryKind): Promise<{ ok: true; offeringId: string; kind: EntryKind; cleared: boolean; reason?: string }>
  getUiPreferences(): Promise<ApiUiPreferences>
  saveUiPreferences(payload: Pick<ApiUiPreferences, 'themeMode' | 'version'>): Promise<ApiUiPreferences>
  getInstitution(): Promise<ApiInstitution>
  updateInstitution(payload: Pick<ApiInstitution, 'name' | 'timezone' | 'academicYearStartMonth' | 'status' | 'version'>): Promise<ApiInstitution>
  listAcademicFaculties(): Promise<{ items: ApiAcademicFaculty[] }>
  createAcademicFaculty(payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status'>): Promise<ApiAcademicFaculty>
  updateAcademicFaculty(academicFacultyId: string, payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status' | 'version'>): Promise<ApiAcademicFaculty>
  listDepartments(): Promise<{ items: ApiDepartment[] }>
  createDepartment(payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status'>): Promise<ApiDepartment>
  updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status' | 'version'>): Promise<ApiDepartment>
  listBranches(): Promise<{ items: ApiBranch[] }>
  createBranch(payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status'>): Promise<ApiBranch>
  updateBranch(branchId: string, payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status' | 'version'>): Promise<ApiBranch>
  listBatches(): Promise<{ items: ApiBatch[] }>
  createBatch(payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status'>): Promise<ApiBatch>
  updateBatch(batchId: string, payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status' | 'version'>): Promise<ApiBatch>
  listTerms(): Promise<{ items: ApiAcademicTerm[] }>
  createTerm(payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status'>): Promise<ApiAcademicTerm>
  updateTerm(termId: string, payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status' | 'version'>): Promise<ApiAcademicTerm>
  listFaculty(filter?: {
    academicFacultyId?: string
    departmentId?: string
    branchId?: string
    batchId?: string
    sectionCode?: string
  }): Promise<{ items: ApiFacultyRecord[] }>
  createFaculty(payload: {
    username: string
    email: string
    phone?: string | null
    password?: string | null
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
  }): Promise<ApiFacultyRecord>
  issueFacultyPasswordSetup(facultyId: string): Promise<ApiAdminFacultyPasswordSetupResponse>
  updateFaculty(facultyId: string, payload: {
    username: string
    email: string
    phone?: string | null
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
    version: number
  }): Promise<ApiFacultyRecord>
  createFacultyAppointment(facultyId: string, payload: Pick<ApiFacultyAppointment, 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status'>): Promise<ApiFacultyAppointment>
  updateFacultyAppointment(appointmentId: string, payload: Pick<ApiFacultyAppointment, 'facultyId' | 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status' | 'version'>): Promise<ApiFacultyAppointment>
  createRoleGrant(facultyId: string, payload: Pick<ApiRoleGrant, 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status'>): Promise<ApiRoleGrant>
  updateRoleGrant(grantId: string, payload: Pick<ApiRoleGrant, 'facultyId' | 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status' | 'version'>): Promise<ApiRoleGrant>
  listStudents(filter?: {
    academicFacultyId?: string
    departmentId?: string
    branchId?: string
    batchId?: string
    sectionCode?: string
  }): Promise<{ items: ApiStudentRecord[] }>
  createStudent(payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status'>): Promise<ApiStudentRecord>
  updateStudent(studentId: string, payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status' | 'version'>): Promise<ApiStudentRecord>
  createEnrollment(studentId: string, payload: Pick<ApiStudentEnrollment, 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate'> & { rosterOrder?: number }): Promise<ApiStudentEnrollment>
  updateEnrollment(enrollmentId: string, payload: Pick<ApiStudentEnrollment, 'studentId' | 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate' | 'version'> & { rosterOrder?: number }): Promise<ApiStudentEnrollment>
  createMentorAssignment(payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source'>): Promise<ApiMentorAssignment>
  updateMentorAssignment(assignmentId: string, payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source' | 'version'>): Promise<ApiMentorAssignment>
  bulkApplyMentorAssignments(payload: ApiMentorAssignmentBulkApplyRequest): Promise<ApiMentorAssignmentBulkApplyResponse>
  listCourses(): Promise<{ items: ApiCourse[] }>
  createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>): Promise<ApiCourse>
  updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>): Promise<ApiCourse>
  listCurriculumCourses(batchId?: string): Promise<{ items: ApiCurriculumCourse[] }>
  createCurriculumCourse(payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status'>): Promise<ApiCurriculumCourse>
  updateCurriculumCourse(curriculumCourseId: string, payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status' | 'version'>): Promise<ApiCurriculumCourse>
  listPolicyOverrides(filter?: { scopeType?: ApiPolicyOverride['scopeType']; scopeId?: string }): Promise<{ items: ApiPolicyOverride[] }>
  createPolicyOverride(payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>): Promise<ApiPolicyOverride>
  updatePolicyOverride(policyOverrideId: string, payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>): Promise<ApiPolicyOverride>
  getBatchSetupReadiness(batchId: string, options?: { sectionCode?: string | null }): Promise<ApiBatchSetupReadiness>
  getResolvedBatchPolicy(batchId: string, filter?: { sectionCode?: string | null }): Promise<ApiResolvedBatchPolicy>
  listStagePolicyOverrides(filter?: { scopeType?: ApiStagePolicyOverride['scopeType']; scopeId?: string }): Promise<{ items: ApiStagePolicyOverride[] }>
  createStagePolicyOverride(payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>): Promise<ApiStagePolicyOverride>
  updateStagePolicyOverride(stagePolicyOverrideId: string, payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>): Promise<ApiStagePolicyOverride>
  getResolvedStagePolicy(batchId: string, filter?: { sectionCode?: string | null }): Promise<ApiResolvedBatchStagePolicy>
  getProofDashboard(batchId: string): Promise<ApiProofDashboard>
  createProofImport(batchId: string, payload?: { sourcePath?: string }): Promise<{ curriculumImportVersionId: string; validation: Record<string, unknown>; completenessCertificate: Record<string, unknown> }>
  validateProofImport(curriculumImportVersionId: string): Promise<Record<string, unknown>>
  reviewProofCrosswalks(curriculumImportVersionId: string, payload: { reviews: Array<{ officialCodeCrosswalkId: string; reviewStatus: string; overrideReason?: string | null }> }): Promise<{ ok: true; count: number }>
  approveProofImport(curriculumImportVersionId: string): Promise<{ ok: true }>
  createProofRun(batchId: string, payload: { curriculumImportVersionId: string; seed?: number; runLabel?: string; activate?: boolean }): Promise<{ simulationRunId: string; status: string; activeFlag: boolean; createdAt: string; startedAt: string | null; completedAt: string | null; failureCode: string | null; failureMessage: string | null; progress: Record<string, unknown> | null }>
  retryProofRun(simulationRunId: string): Promise<{ simulationRunId: string; status: string; activeFlag: boolean; createdAt: string; startedAt: string | null; completedAt: string | null; failureCode: string | null; failureMessage: string | null; progress: Record<string, unknown> | null }>
  activateProofRun(simulationRunId: string): Promise<{ ok: true }>
  activateProofSemester(simulationRunId: string, payload: ApiActivateProofSemesterRequest): Promise<ApiActivateProofSemesterResponse>
  advanceProofRun(simulationRunId: string, payload: { mode: 'day' | 'previous-day' | 'stage' }): Promise<Record<string, unknown>>
  stopProofRun(simulationRunId: string): Promise<Record<string, unknown>>
  archiveProofRun(simulationRunId: string): Promise<{ ok: true }>
  recomputeProofRunRisk(simulationRunId: string): Promise<{ ok: true }>
  restoreProofRunSnapshot(simulationRunId: string, payload?: { simulationResetSnapshotId?: string }): Promise<{ simulationRunId: string; activeFlag: boolean }>
  getProofRunCheckpoints(simulationRunId: string): Promise<{ items: ApiSimulationStageCheckpointSummary[] }>
  getProofRunCheckpointDetail(simulationRunId: string, simulationStageCheckpointId: string): Promise<ApiProofRunCheckpointDetail>
  listProofRunCheckpointStudents(simulationRunId: string, simulationStageCheckpointId: string): Promise<{ items: ApiProofRunCheckpointStudentSummary[] }>
  getProofRunCheckpointStudentDetail(simulationRunId: string, simulationStageCheckpointId: string, studentId: string): Promise<ApiProofRunCheckpointStudentDetail>
  getProofStudentEvidenceTimeline(simulationRunId: string, studentId: string): Promise<{ items: ApiProofStudentEvidenceTimelineItem[] }>
  listOfferings(): Promise<{ items: ApiAdminOffering[] }>
  createOffering(payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    finalsLocked?: boolean
    pendingAction?: string | null
    status: string
  }): Promise<ApiAdminOffering>
  updateOffering(offeringId: string, payload: {
    courseId: string
    termId: string
    branchId: string
    sectionCode: string
    yearLabel: string
    attendance: number
    studentCount: number
    stage: number
    stageLabel: string
    stageDescription: string
    stageColor: string
    tt1Done?: boolean
    tt2Done?: boolean
    tt1Locked?: boolean
    tt2Locked?: boolean
    quizLocked?: boolean
    assignmentLocked?: boolean
    finalsLocked?: boolean
    pendingAction?: string | null
    status: string
    version: number
  }): Promise<ApiAdminOffering>
  getOfferingStageEligibility(offeringId: string): Promise<ApiOfferingStageEligibility>
  advanceOfferingStage(offeringId: string): Promise<ApiOfferingStageEligibility>
  listOfferingOwnership(): Promise<{ items: ApiOfferingOwnership[] }>
  createOfferingOwnership(payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status'>): Promise<ApiOfferingOwnership>
  updateOfferingOwnership(ownershipId: string, payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status' | 'version'>): Promise<ApiOfferingOwnership>
  listCourseOutcomeOverrides(filter?: { courseId?: string; scopeType?: ApiCourseOutcomeScopeType; scopeId?: string }): Promise<{ items: ApiCourseOutcomeOverride[] }>
  createCourseOutcomeOverride(payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status'>): Promise<ApiCourseOutcomeOverride>
  updateCourseOutcomeOverride(courseOutcomeOverrideId: string, payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status' | 'version'>): Promise<ApiCourseOutcomeOverride>
  getResolvedCourseOutcomes(offeringId: string): Promise<ApiResolvedCourseOutcomeSet>
  getCurriculumFeatureConfig(batchId: string): Promise<ApiCurriculumFeatureConfigBundle>
  bootstrapCurriculum(batchId: string, payload?: { manifestKey?: ApiCurriculumBootstrapResult['manifestKey'] }): Promise<ApiCurriculumBootstrapResult>
  listCurriculumLinkageCandidates(batchId: string, filter?: { curriculumCourseId?: string }): Promise<{ items: ApiCurriculumLinkageCandidate[] }>
  regenerateCurriculumLinkageCandidates(batchId: string, payload?: { curriculumCourseId?: string }): Promise<ApiCurriculumLinkageCandidateRegenerateResult>
  approveCurriculumLinkageCandidate(batchId: string, curriculumLinkageCandidateId: string, payload?: { reviewNote?: string }): Promise<ApiCurriculumLinkageApprovalResult>
  rejectCurriculumLinkageCandidate(batchId: string, curriculumLinkageCandidateId: string, payload?: { reviewNote?: string }): Promise<{ ok: true; batchId: string; curriculumLinkageCandidateId: string }>
  listCurriculumFeatureProfiles(filter?: { scopeType?: ApiCurriculumFeatureProfile['scopeType']; scopeId?: string }): Promise<{ items: ApiCurriculumFeatureProfile[] }>
  createCurriculumFeatureProfile(payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status'>): Promise<ApiCurriculumFeatureProfile>
  updateCurriculumFeatureProfile(curriculumFeatureProfileId: string, payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status' | 'version'>): Promise<ApiCurriculumFeatureProfile>
  saveCurriculumFeatureBinding(batchId: string, payload: Pick<ApiBatchCurriculumFeatureBinding, 'bindingMode' | 'curriculumFeatureProfileId' | 'status' | 'version'>): Promise<ApiCurriculumFeatureBindingSaveResult>
  saveCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, payload: ApiCurriculumFeatureConfigPayload): Promise<ApiCurriculumFeatureConfigSaveResult>
  previewCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, proposedOutcomes: Array<{ id: string; bloom: string }>): Promise<ApiCurriculumFeatureConfigPreview>
  getCurriculumFeatureConfigHistory(batchId: string, curriculumCourseId: string): Promise<{ events: ApiCurriculumFeatureConfigHistoryEvent[] }>
  getCurriculumGraph(batchId: string): Promise<ApiCurriculumGraphBundle>
  saveCurriculumGraphDraft(batchId: string, payload: { nodes: ApiGraphNode[]; edges: ApiGraphEdge[]; command?: unknown }): Promise<{ ok: boolean; draftId: string; savedAt: string }>
  validateCurriculumGraph(batchId: string, payload?: { nodes?: ApiGraphNode[]; edges?: ApiGraphEdge[] }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>
  publishCurriculumGraph(batchId: string): Promise<{ ok: boolean; newImportVersionId: string; validation: { valid: boolean; errors: string[]; warnings: string[] }; publishedAt: string }>
  undoCurriculumGraph(batchId: string): Promise<{ ok: boolean; reversePayload: unknown; commandType: string }>
  redoCurriculumGraph(batchId: string): Promise<{ ok: boolean; forwardPayload: unknown; commandType: string }>
  suggestCurriculumGraph(batchId: string, payload?: { targetCurriculumNodeIds?: string[] }): Promise<{ ok: boolean; candidateCount: number; candidateGenerationStatus: string }>
  approveCurriculumGraphSuggestion(batchId: string, suggestionId: string): Promise<{ ok: boolean; suggestionId: string; status: string }>
  rejectCurriculumGraphSuggestion(batchId: string, suggestionId: string): Promise<{ ok: boolean; suggestionId: string; status: string }>
  provisionBatch(batchId: string, payload: ApiBatchProvisioningRequest): Promise<ApiBatchProvisioningResponse>
  saveOfferingAssessmentScheme(offeringId: string, payload: { scheme: SchemeState }): Promise<{ offeringId: string; scheme: SchemeState; version: number; policySnapshot: unknown }>
  saveOfferingQuestionPaper(offeringId: string, kind: TTKind, payload: { blueprint: TermTestBlueprint }): Promise<{ paperId: string; offeringId: string; kind: TTKind; blueprint: TermTestBlueprint; version: number }>
  createAttendanceSnapshot(payload: Omit<ApiAttendanceSnapshot, 'attendanceSnapshotId'>): Promise<{ attendanceSnapshotId: string; ok: true }>
  createAssessmentScore(payload: Omit<ApiAssessmentScore, 'assessmentScoreId'>): Promise<{ assessmentScoreId: string; ok: true }>
  createStudentIntervention(payload: Omit<ApiStudentIntervention, 'interventionId'>): Promise<{ interventionId: string; ok: true }>
  createTranscriptTermResult(payload: Omit<ApiTranscriptTermResult, 'transcriptTermResultId'>): Promise<{ transcriptTermResultId: string; ok: true }>
  createTranscriptSubjectResult(payload: Omit<ApiTranscriptSubjectResult, 'transcriptSubjectResultId'>): Promise<{ transcriptSubjectResultId: string; ok: true }>
  listAdminRequests(): Promise<{ items: ApiAdminRequestSummary[] }>
  searchAdminWorkspace(query: string, scope?: {
    academicFacultyId?: string
    departmentId?: string
    branchId?: string
    batchId?: string
    sectionCode?: string
  }): Promise<{ items: ApiAdminSearchResult[] }>
  listAuditEvents(filter: { entityType: string; entityId: string }): Promise<{ items: ApiAuditEvent[] }>
  listRecentAdminAuditEvents(limit?: number): Promise<{ items: ApiAuditEvent[] }>
  listAdminReminders(): Promise<{ items: ApiAdminReminder[] }>
  createAdminReminder(payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status'>): Promise<ApiAdminReminder>
  updateAdminReminder(reminderId: string, payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status' | 'version'>): Promise<ApiAdminReminder>
  getAdminFacultyCalendar(facultyId: string): Promise<ApiAdminFacultyCalendar>
  saveAdminFacultyCalendar(facultyId: string, payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>): Promise<ApiAdminFacultyCalendar>
  getAcademicFacultyProfile(facultyId: string, filter?: { simulationStageCheckpointId?: string }): Promise<ApiAcademicFacultyProfile>
  getAdminRequest(requestId: string): Promise<ApiAdminRequestDetail>
  assignAdminRequest(requestId: string, payload: { version: number; ownedByFacultyId?: string | null; noteBody?: string }): Promise<ApiAdminRequestSummary>
  requestAdminRequestInfo(requestId: string, payload: { version: number; noteBody: string }): Promise<ApiAdminRequestSummary>
  approveAdminRequest(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  rejectAdminRequest(requestId: string, payload: { version: number; noteBody: string }): Promise<ApiAdminRequestSummary>
  markAdminRequestImplemented(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  closeAdminRequest(requestId: string, payload: { version: number; noteBody?: string }): Promise<ApiAdminRequestSummary>
  addAdminRequestNote(requestId: string, payload: { visibility?: string; noteType: string; body: string }): Promise<ApiAdminRequestNote>
  getAdminRequestAudit(requestId: string): Promise<{ transitions: ApiAdminRequestDetail['transitions']; auditEvents: ApiAuditEvent[] }>
}
