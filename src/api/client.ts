import type {
  ApiAcademicBootstrap,
  ApiAcademicFaculty,
  ApiAcademicHodProofBundle,
  ApiAcademicMeeting,
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiProofReassessmentAcknowledgeRequest,
  ApiProofReassessmentAcknowledgeResponse,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
  ApiAdminFacultyCalendar,
  ApiAcademicLoginFaculty,
  ApiAcademicTerm,
  ApiAcademicRuntimeKey,
  ApiAdminRequestDetail,
  ApiAdminReminder,
  ApiAdminSearchResult,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAdminOffering,
  ApiAcademicFacultyProfile,
  ApiAuditEvent,
  ApiAttendanceSnapshot,
  ApiAssessmentScore,
  ApiBatch,
  ApiBatchCurriculumFeatureBinding,
  ApiBatchProvisioningRequest,
  ApiBatchProvisioningResponse,
  ApiBranch,
  ApiCourse,
  ApiCurriculumFeatureBindingSaveResult,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigPayload,
  ApiCurriculumFeatureConfigSaveResult,
  ApiCurriculumFeatureProfile,
  ApiCourseOutcomeOverride,
  ApiCourseOutcomeScopeType,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiInstitution,
  ApiLoginRequest,
  ApiMentorAssignment,
  ApiOfferingOwnership,
  ApiPolicyOverride,
  ApiStagePolicyOverride,
  ApiOfferingStageEligibility,
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentDetail,
  ApiProofReassessmentResolveRequest,
  ApiProofReassessmentResolveResponse,
  ApiProofStudentEvidenceTimelineItem,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiResolvedCourseOutcomeSet,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
  ApiStudentRiskExplorer,
  ApiStudentRecord,
  ApiStudentEnrollment,
  ApiStudentIntervention,
  ApiSimulationStageCheckpointSummary,
  ApiTranscriptSubjectResult,
  ApiTranscriptTermResult,
  ApiUiPreferences,
} from './types.js'
import type {
  MeetingStatus,
  CalendarAuditEvent,
  EntryKind,
  FacultyTimetableTemplate,
  SchemeState,
  SharedTask,
  TaskCalendarPlacement,
  TTKind,
  TermTestBlueprint,
} from '../domain.js'

export class AirMentorApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export interface AirMentorApiClientLike {
  restoreSession(): Promise<ApiSessionResponse>
  login(payload: ApiLoginRequest): Promise<ApiSessionResponse>
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
  acknowledgeAcademicProofReassessment(reassessmentEventId: string, payload?: ApiProofReassessmentAcknowledgeRequest): Promise<ApiProofReassessmentAcknowledgeResponse>
  resolveAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentResolveRequest): Promise<ApiProofReassessmentResolveResponse>
  getAcademicStudentAgentCard(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentAgentCard>
  getAcademicStudentRiskExplorer(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentRiskExplorer>
  getAcademicStudentAgentTimeline(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<{ items: ApiStudentAgentTimelineItem[] }>
  startAcademicStudentAgentSession(studentId: string, payload?: { simulationRunId?: string; simulationStageCheckpointId?: string }): Promise<ApiStudentAgentSession>
  sendAcademicStudentAgentMessage(sessionId: string, payload: { prompt: string }): Promise<{ items: ApiStudentAgentMessage[] }>
  saveAcademicRuntimeSlice<T>(stateKey: ApiAcademicRuntimeKey, payload: T): Promise<{ ok: true; stateKey: ApiAcademicRuntimeKey }>
  syncAcademicTasks(payload: { tasks: SharedTask[] }): Promise<{ ok: true; count: number }>
  syncAcademicTaskPlacements(payload: { placements: Record<string, TaskCalendarPlacement> }): Promise<{ ok: true; count: number }>
  syncAcademicCalendarAudit(payload: { events: CalendarAuditEvent[] }): Promise<{ ok: true; count: number }>
  saveFacultyCalendarWorkspace(facultyId: string, payload: { template: FacultyTimetableTemplate }): Promise<{ facultyId: string; template: FacultyTimetableTemplate; version: number; directEditWindowEndsAt: string | null; classEditingLocked: boolean }>
  createAcademicMeeting(payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status?: MeetingStatus }): Promise<ApiAcademicMeeting>
  updateAcademicMeeting(meetingId: string, payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: MeetingStatus; version: number }): Promise<ApiAcademicMeeting>
  commitOfferingAttendance(offeringId: string, payload: { entries: Array<{ studentId: string; presentClasses: number; totalClasses: number }>; capturedAt?: string; lock?: boolean }): Promise<{ ok: true; offeringId: string; capturedAt: string; averageAttendance: number; locked: boolean }>
  commitOfferingAssessmentEntries(offeringId: string, kind: Exclude<EntryKind, 'attendance'>, payload: { entries: Array<{ studentId: string; components: Array<{ componentCode: string; score: number; maxScore: number }> }>; evaluatedAt?: string; lock?: boolean }): Promise<{ ok: true; offeringId: string; kind: Exclude<EntryKind, 'attendance'>; evaluatedAt: string; locked: boolean }>
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
  listFaculty(): Promise<{ items: ApiFacultyRecord[] }>
  createFaculty(payload: {
    username: string
    email: string
    phone?: string | null
    password: string
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
  }): Promise<ApiFacultyRecord>
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
  listStudents(): Promise<{ items: ApiStudentRecord[] }>
  createStudent(payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status'>): Promise<ApiStudentRecord>
  updateStudent(studentId: string, payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status' | 'version'>): Promise<ApiStudentRecord>
  createEnrollment(studentId: string, payload: Pick<ApiStudentEnrollment, 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate'> & { rosterOrder?: number }): Promise<ApiStudentEnrollment>
  updateEnrollment(enrollmentId: string, payload: Pick<ApiStudentEnrollment, 'studentId' | 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate' | 'version'> & { rosterOrder?: number }): Promise<ApiStudentEnrollment>
  createMentorAssignment(payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source'>): Promise<ApiMentorAssignment>
  updateMentorAssignment(assignmentId: string, payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source' | 'version'>): Promise<ApiMentorAssignment>
  listCourses(): Promise<{ items: ApiCourse[] }>
  createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>): Promise<ApiCourse>
  updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>): Promise<ApiCourse>
  listCurriculumCourses(batchId?: string): Promise<{ items: ApiCurriculumCourse[] }>
  createCurriculumCourse(payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status'>): Promise<ApiCurriculumCourse>
  updateCurriculumCourse(curriculumCourseId: string, payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status' | 'version'>): Promise<ApiCurriculumCourse>
  listPolicyOverrides(filter?: { scopeType?: ApiPolicyOverride['scopeType']; scopeId?: string }): Promise<{ items: ApiPolicyOverride[] }>
  createPolicyOverride(payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>): Promise<ApiPolicyOverride>
  updatePolicyOverride(policyOverrideId: string, payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>): Promise<ApiPolicyOverride>
  getResolvedBatchPolicy(batchId: string): Promise<ApiResolvedBatchPolicy>
  listStagePolicyOverrides(filter?: { scopeType?: ApiStagePolicyOverride['scopeType']; scopeId?: string }): Promise<{ items: ApiStagePolicyOverride[] }>
  createStagePolicyOverride(payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>): Promise<ApiStagePolicyOverride>
  updateStagePolicyOverride(stagePolicyOverrideId: string, payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>): Promise<ApiStagePolicyOverride>
  getResolvedStagePolicy(batchId: string): Promise<ApiResolvedBatchStagePolicy>
  getProofDashboard(batchId: string): Promise<ApiProofDashboard>
  createProofImport(batchId: string, payload?: { sourcePath?: string }): Promise<{ curriculumImportVersionId: string; validation: Record<string, unknown>; completenessCertificate: Record<string, unknown> }>
  validateProofImport(curriculumImportVersionId: string): Promise<Record<string, unknown>>
  reviewProofCrosswalks(curriculumImportVersionId: string, payload: { reviews: Array<{ officialCodeCrosswalkId: string; reviewStatus: string; overrideReason?: string | null }> }): Promise<{ ok: true; count: number }>
  approveProofImport(curriculumImportVersionId: string): Promise<{ ok: true }>
  createProofRun(batchId: string, payload: { curriculumImportVersionId: string; seed?: number; runLabel?: string; activate?: boolean }): Promise<{ simulationRunId: string; activeFlag: boolean }>
  activateProofRun(simulationRunId: string): Promise<{ ok: true }>
  archiveProofRun(simulationRunId: string): Promise<{ ok: true }>
  recomputeProofRunRisk(simulationRunId: string): Promise<{ ok: true }>
  restoreProofRunSnapshot(simulationRunId: string, payload?: { simulationResetSnapshotId?: string }): Promise<{ simulationRunId: string; activeFlag: boolean }>
  getProofRunCheckpoints(simulationRunId: string): Promise<{ items: ApiSimulationStageCheckpointSummary[] }>
  getProofRunCheckpointDetail(simulationRunId: string, simulationStageCheckpointId: string): Promise<ApiProofRunCheckpointDetail>
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
  listCurriculumFeatureProfiles(filter?: { scopeType?: ApiCurriculumFeatureProfile['scopeType']; scopeId?: string }): Promise<{ items: ApiCurriculumFeatureProfile[] }>
  createCurriculumFeatureProfile(payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status'>): Promise<ApiCurriculumFeatureProfile>
  updateCurriculumFeatureProfile(curriculumFeatureProfileId: string, payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status' | 'version'>): Promise<ApiCurriculumFeatureProfile>
  saveCurriculumFeatureBinding(batchId: string, payload: Pick<ApiBatchCurriculumFeatureBinding, 'bindingMode' | 'curriculumFeatureProfileId' | 'status' | 'version'>): Promise<ApiCurriculumFeatureBindingSaveResult>
  saveCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, payload: ApiCurriculumFeatureConfigPayload): Promise<ApiCurriculumFeatureConfigSaveResult>
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

type FetchLike = typeof fetch

function getDefaultFetch(): FetchLike {
  return globalThis.fetch.bind(globalThis) as FetchLike
}

export class AirMentorApiClient implements AirMentorApiClientLike {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(baseUrl: string, fetchImpl?: FetchLike) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.fetchImpl = fetchImpl ?? getDefaultFetch()
  }

  async restoreSession() {
    return this.request<ApiSessionResponse>('/api/session')
  }

  async login(payload: ApiLoginRequest) {
    return this.request<ApiSessionResponse>('/api/session/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async logout() {
    await this.request('/api/session', { method: 'DELETE' })
  }

  async switchRoleContext(roleGrantId: string) {
    return this.request<ApiSessionResponse>('/api/session/role-context', {
      method: 'POST',
      body: JSON.stringify({ roleGrantId }),
    })
  }

  async listAcademicLoginFaculty() {
    return this.request<{ items: ApiAcademicLoginFaculty[] }>('/api/academic/public/faculty')
  }

  async getAcademicBootstrap(filter?: { simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicBootstrap>(`/api/academic/bootstrap${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofBundle(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.status) searchParams.set('status', filter.status)
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicHodProofBundle>(`/api/academic/hod/proof-bundle${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofSummary(filter?: { section?: string; semester?: number; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicHodProofSummary>(`/api/academic/hod/proof-summary${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofCourses(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofCourseRollup[] }>(`/api/academic/hod/proof-courses${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofFaculty(filter?: { section?: string; semester?: number; facultyId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofFacultyRollup[] }>(`/api/academic/hod/proof-faculty${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofStudents(filter?: { section?: string; semester?: number; riskBand?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofStudentWatch[] }>(`/api/academic/hod/proof-students${query ? `?${query}` : ''}`)
  }

  async getAcademicHodProofReassessments(filter?: { section?: string; semester?: number; riskBand?: string; status?: string; facultyId?: string; courseCode?: string; studentId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.section) searchParams.set('section', filter.section)
    if (typeof filter?.semester === 'number') searchParams.set('semester', String(filter.semester))
    if (filter?.riskBand) searchParams.set('riskBand', filter.riskBand)
    if (filter?.status) searchParams.set('status', filter.status)
    if (filter?.facultyId) searchParams.set('facultyId', filter.facultyId)
    if (filter?.courseCode) searchParams.set('courseCode', filter.courseCode)
    if (filter?.studentId) searchParams.set('studentId', filter.studentId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiAcademicHodProofReassessment[] }>(`/api/academic/hod/proof-reassessments${query ? `?${query}` : ''}`)
  }

  async acknowledgeAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentAcknowledgeRequest = {}) {
    return this.request<ApiProofReassessmentAcknowledgeResponse>(`/api/academic/proof-reassessments/${encodeURIComponent(reassessmentEventId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async resolveAcademicProofReassessment(reassessmentEventId: string, payload: ApiProofReassessmentResolveRequest) {
    return this.request<ApiProofReassessmentResolveResponse>(`/api/academic/proof-reassessments/${encodeURIComponent(reassessmentEventId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getAcademicStudentAgentCard(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiStudentAgentCard>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/card${query ? `?${query}` : ''}`)
  }

  async getAcademicStudentRiskExplorer(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiStudentRiskExplorer>(`/api/academic/students/${encodeURIComponent(studentId)}/risk-explorer${query ? `?${query}` : ''}`)
  }

  async getAcademicStudentAgentTimeline(studentId: string, filter?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationRunId) searchParams.set('simulationRunId', filter.simulationRunId)
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<{ items: ApiStudentAgentTimelineItem[] }>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/timeline${query ? `?${query}` : ''}`)
  }

  async startAcademicStudentAgentSession(studentId: string, payload?: { simulationRunId?: string; simulationStageCheckpointId?: string }) {
    return this.request<ApiStudentAgentSession>(`/api/academic/student-shell/students/${encodeURIComponent(studentId)}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async sendAcademicStudentAgentMessage(sessionId: string, payload: { prompt: string }) {
    return this.request<{ items: ApiStudentAgentMessage[] }>(`/api/academic/student-shell/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async saveAcademicRuntimeSlice<T>(stateKey: ApiAcademicRuntimeKey, payload: T) {
    return this.request<{ ok: true; stateKey: ApiAcademicRuntimeKey }>(`/api/academic/runtime/${stateKey}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async syncAcademicTasks(payload: { tasks: SharedTask[] }) {
    return this.request<{ ok: true; count: number }>('/api/academic/tasks/sync', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async syncAcademicTaskPlacements(payload: { placements: Record<string, TaskCalendarPlacement> }) {
    return this.request<{ ok: true; count: number }>('/api/academic/task-placements/sync', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async syncAcademicCalendarAudit(payload: { events: CalendarAuditEvent[] }) {
    return this.request<{ ok: true; count: number }>('/api/academic/calendar-audit/sync', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveFacultyCalendarWorkspace(facultyId: string, payload: { template: FacultyTimetableTemplate }) {
    return this.request<{ facultyId: string; template: FacultyTimetableTemplate; version: number; directEditWindowEndsAt: string | null; classEditingLocked: boolean }>(`/api/academic/faculty-calendar-workspace/${facultyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async createAcademicMeeting(payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status?: MeetingStatus }) {
    return this.request<ApiAcademicMeeting>('/api/academic/meetings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAcademicMeeting(meetingId: string, payload: { studentId: string; offeringId?: string | null; title: string; notes?: string | null; dateISO: string; startMinutes: number; endMinutes: number; status: MeetingStatus; version: number }) {
    return this.request<ApiAcademicMeeting>(`/api/academic/meetings/${meetingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async commitOfferingAttendance(offeringId: string, payload: { entries: Array<{ studentId: string; presentClasses: number; totalClasses: number }>; capturedAt?: string; lock?: boolean }) {
    return this.request<{ ok: true; offeringId: string; capturedAt: string; averageAttendance: number; locked: boolean }>(`/api/academic/offerings/${offeringId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async commitOfferingAssessmentEntries(offeringId: string, kind: Exclude<EntryKind, 'attendance'>, payload: { entries: Array<{ studentId: string; components: Array<{ componentCode: string; score: number; maxScore: number }> }>; evaluatedAt?: string; lock?: boolean }) {
    return this.request<{ ok: true; offeringId: string; kind: Exclude<EntryKind, 'attendance'>; evaluatedAt: string; locked: boolean }>(`/api/academic/offerings/${offeringId}/assessment-entries/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async getUiPreferences() {
    return this.request<ApiUiPreferences>('/api/preferences/ui')
  }

  async saveUiPreferences(payload: Pick<ApiUiPreferences, 'themeMode' | 'version'>) {
    return this.request<ApiUiPreferences>('/api/preferences/ui', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getInstitution() {
    return this.request<ApiInstitution>('/api/admin/institution')
  }

  async updateInstitution(payload: Pick<ApiInstitution, 'name' | 'timezone' | 'academicYearStartMonth' | 'status' | 'version'>) {
    return this.request<ApiInstitution>('/api/admin/institution', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listAcademicFaculties() {
    return this.request<{ items: ApiAcademicFaculty[] }>('/api/admin/academic-faculties')
  }

  async createAcademicFaculty(payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status'>) {
    return this.request<ApiAcademicFaculty>('/api/admin/academic-faculties', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAcademicFaculty(academicFacultyId: string, payload: Pick<ApiAcademicFaculty, 'code' | 'name' | 'overview' | 'status' | 'version'>) {
    return this.request<ApiAcademicFaculty>(`/api/admin/academic-faculties/${academicFacultyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listDepartments() {
    return this.request<{ items: ApiDepartment[] }>('/api/admin/departments')
  }

  async createDepartment(payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status'>) {
    return this.request<ApiDepartment>('/api/admin/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDepartment(departmentId: string, payload: Pick<ApiDepartment, 'academicFacultyId' | 'code' | 'name' | 'status' | 'version'>) {
    return this.request<ApiDepartment>(`/api/admin/departments/${departmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listBranches() {
    return this.request<{ items: ApiBranch[] }>('/api/admin/branches')
  }

  async createBranch(payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status'>) {
    return this.request<ApiBranch>('/api/admin/branches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateBranch(branchId: string, payload: Pick<ApiBranch, 'departmentId' | 'code' | 'name' | 'programLevel' | 'semesterCount' | 'status' | 'version'>) {
    return this.request<ApiBranch>(`/api/admin/branches/${branchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listBatches() {
    return this.request<{ items: ApiBatch[] }>('/api/admin/batches')
  }

  async createBatch(payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status'>) {
    return this.request<ApiBatch>('/api/admin/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateBatch(batchId: string, payload: Pick<ApiBatch, 'branchId' | 'admissionYear' | 'batchLabel' | 'currentSemester' | 'sectionLabels' | 'status' | 'version'>) {
    return this.request<ApiBatch>(`/api/admin/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listTerms() {
    return this.request<{ items: ApiAcademicTerm[] }>('/api/admin/terms')
  }

  async createTerm(payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiAcademicTerm>('/api/admin/terms', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTerm(termId: string, payload: Pick<ApiAcademicTerm, 'branchId' | 'batchId' | 'academicYearLabel' | 'semesterNumber' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiAcademicTerm>(`/api/admin/terms/${termId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listFaculty() {
    return this.request<{ items: ApiFacultyRecord[] }>('/api/admin/faculty')
  }

  async createFaculty(payload: {
    username: string
    email: string
    phone?: string | null
    password: string
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
  }) {
    return this.request<ApiFacultyRecord>('/api/admin/faculty', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateFaculty(facultyId: string, payload: {
    username: string
    email: string
    phone?: string | null
    employeeCode: string
    displayName: string
    designation: string
    joinedOn?: string | null
    status: string
    version: number
  }) {
    return this.request<ApiFacultyRecord>(`/api/admin/faculty/${facultyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createFacultyAppointment(facultyId: string, payload: Pick<ApiFacultyAppointment, 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiFacultyAppointment>(`/api/admin/faculty/${facultyId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateFacultyAppointment(appointmentId: string, payload: Pick<ApiFacultyAppointment, 'facultyId' | 'departmentId' | 'branchId' | 'isPrimary' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiFacultyAppointment>(`/api/admin/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createRoleGrant(facultyId: string, payload: Pick<ApiRoleGrant, 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status'>) {
    return this.request<ApiRoleGrant>(`/api/admin/faculty/${facultyId}/role-grants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateRoleGrant(grantId: string, payload: Pick<ApiRoleGrant, 'facultyId' | 'roleCode' | 'scopeType' | 'scopeId' | 'startDate' | 'endDate' | 'status' | 'version'>) {
    return this.request<ApiRoleGrant>(`/api/admin/role-grants/${grantId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listStudents() {
    return this.request<{ items: ApiStudentRecord[] }>('/api/admin/students')
  }

  async createStudent(payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status'>) {
    return this.request<ApiStudentRecord>('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateStudent(studentId: string, payload: Pick<ApiStudentRecord, 'usn' | 'rollNumber' | 'name' | 'email' | 'phone' | 'admissionDate' | 'status' | 'version'>) {
    return this.request<ApiStudentRecord>(`/api/admin/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createEnrollment(studentId: string, payload: Pick<ApiStudentEnrollment, 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate'> & { rosterOrder?: number }) {
    return this.request<ApiStudentEnrollment>(`/api/admin/students/${studentId}/enrollments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateEnrollment(enrollmentId: string, payload: Pick<ApiStudentEnrollment, 'studentId' | 'branchId' | 'termId' | 'sectionCode' | 'academicStatus' | 'startDate' | 'endDate' | 'version'> & { rosterOrder?: number }) {
    return this.request<ApiStudentEnrollment>(`/api/admin/enrollments/${enrollmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async createMentorAssignment(payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source'>) {
    return this.request<ApiMentorAssignment>('/api/admin/mentor-assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateMentorAssignment(assignmentId: string, payload: Pick<ApiMentorAssignment, 'studentId' | 'facultyId' | 'effectiveFrom' | 'effectiveTo' | 'source' | 'version'>) {
    return this.request<ApiMentorAssignment>(`/api/admin/mentor-assignments/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listCourses() {
    return this.request<{ items: ApiCourse[] }>('/api/admin/courses')
  }

  async createCourse(payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status'>) {
    return this.request<ApiCourse>('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCourse(courseId: string, payload: Pick<ApiCourse, 'courseCode' | 'title' | 'defaultCredits' | 'departmentId' | 'status' | 'version'>) {
    return this.request<ApiCourse>(`/api/admin/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listCurriculumCourses(batchId?: string) {
    const searchParams = new URLSearchParams()
    if (batchId) searchParams.set('batchId', batchId)
    const query = searchParams.toString()
    return this.request<{ items: ApiCurriculumCourse[] }>(`/api/admin/curriculum-courses${query ? `?${query}` : ''}`)
  }

  async createCurriculumCourse(payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status'>) {
    return this.request<ApiCurriculumCourse>('/api/admin/curriculum-courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCurriculumCourse(curriculumCourseId: string, payload: Pick<ApiCurriculumCourse, 'batchId' | 'semesterNumber' | 'courseId' | 'courseCode' | 'title' | 'credits' | 'status' | 'version'>) {
    return this.request<ApiCurriculumCourse>(`/api/admin/curriculum-courses/${curriculumCourseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listPolicyOverrides(filter?: { scopeType?: ApiPolicyOverride['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiPolicyOverride[] }>(`/api/admin/policy-overrides${query ? `?${query}` : ''}`)
  }

  async createPolicyOverride(payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>) {
    return this.request<ApiPolicyOverride>('/api/admin/policy-overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updatePolicyOverride(policyOverrideId: string, payload: Pick<ApiPolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>) {
    return this.request<ApiPolicyOverride>(`/api/admin/policy-overrides/${policyOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedBatchPolicy(batchId: string) {
    return this.request<ApiResolvedBatchPolicy>(`/api/admin/batches/${batchId}/resolved-policy`)
  }

  async listStagePolicyOverrides(filter?: { scopeType?: ApiStagePolicyOverride['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiStagePolicyOverride[] }>(`/api/admin/stage-policy-overrides${query ? `?${query}` : ''}`)
  }

  async createStagePolicyOverride(payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status'>) {
    return this.request<ApiStagePolicyOverride>('/api/admin/stage-policy-overrides', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateStagePolicyOverride(stagePolicyOverrideId: string, payload: Pick<ApiStagePolicyOverride, 'scopeType' | 'scopeId' | 'policy' | 'status' | 'version'>) {
    return this.request<ApiStagePolicyOverride>(`/api/admin/stage-policy-overrides/${stagePolicyOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedStagePolicy(batchId: string) {
    return this.request<ApiResolvedBatchStagePolicy>(`/api/admin/batches/${batchId}/resolved-stage-policy`)
  }

  async getProofDashboard(batchId: string) {
    return this.request<ApiProofDashboard>(`/api/admin/batches/${batchId}/proof-dashboard`)
  }

  async createProofImport(batchId: string, payload?: { sourcePath?: string }) {
    return this.request<{ curriculumImportVersionId: string; validation: Record<string, unknown>; completenessCertificate: Record<string, unknown> }>(`/api/admin/batches/${batchId}/proof-imports`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async validateProofImport(curriculumImportVersionId: string) {
    return this.request<Record<string, unknown>>(`/api/admin/proof-imports/${curriculumImportVersionId}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async reviewProofCrosswalks(curriculumImportVersionId: string, payload: { reviews: Array<{ officialCodeCrosswalkId: string; reviewStatus: string; overrideReason?: string | null }> }) {
    return this.request<{ ok: true; count: number }>(`/api/admin/proof-imports/${curriculumImportVersionId}/review-crosswalks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async approveProofImport(curriculumImportVersionId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-imports/${curriculumImportVersionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async createProofRun(batchId: string, payload: { curriculumImportVersionId: string; seed?: number; runLabel?: string; activate?: boolean }) {
    return this.request<{ simulationRunId: string; activeFlag: boolean }>(`/api/admin/batches/${batchId}/proof-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async activateProofRun(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async archiveProofRun(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/archive`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async recomputeProofRunRisk(simulationRunId: string) {
    return this.request<{ ok: true }>(`/api/admin/proof-runs/${simulationRunId}/recompute-risk`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async restoreProofRunSnapshot(simulationRunId: string, payload?: { simulationResetSnapshotId?: string }) {
    return this.request<{ simulationRunId: string; activeFlag: boolean }>(`/api/admin/proof-runs/${simulationRunId}/restore-snapshot`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async getProofRunCheckpoints(simulationRunId: string) {
    return this.request<{ items: ApiSimulationStageCheckpointSummary[] }>(`/api/admin/proof-runs/${simulationRunId}/checkpoints`)
  }

  async getProofRunCheckpointDetail(simulationRunId: string, simulationStageCheckpointId: string) {
    return this.request<ApiProofRunCheckpointDetail>(`/api/admin/proof-runs/${simulationRunId}/checkpoints/${encodeURIComponent(simulationStageCheckpointId)}`)
  }

  async getProofRunCheckpointStudentDetail(simulationRunId: string, simulationStageCheckpointId: string, studentId: string) {
    return this.request<ApiProofRunCheckpointStudentDetail>(`/api/admin/proof-runs/${simulationRunId}/checkpoints/${encodeURIComponent(simulationStageCheckpointId)}/students/${encodeURIComponent(studentId)}`)
  }

  async getProofStudentEvidenceTimeline(simulationRunId: string, studentId: string) {
    return this.request<{ items: ApiProofStudentEvidenceTimelineItem[] }>(`/api/admin/proof-runs/${simulationRunId}/students/${studentId}/evidence-timeline`)
  }

  async listOfferings() {
    return this.request<{ items: ApiAdminOffering[] }>('/api/admin/offerings')
  }

  async createOffering(payload: {
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
  }) {
    return this.request<ApiAdminOffering>('/api/admin/offerings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateOffering(offeringId: string, payload: {
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
  }) {
    return this.request<ApiAdminOffering>(`/api/admin/offerings/${offeringId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getOfferingStageEligibility(offeringId: string) {
    return this.request<ApiOfferingStageEligibility>(`/api/admin/offerings/${offeringId}/stage-eligibility`)
  }

  async advanceOfferingStage(offeringId: string) {
    return this.request<ApiOfferingStageEligibility>(`/api/admin/offerings/${offeringId}/advance-stage`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async listOfferingOwnership() {
    return this.request<{ items: ApiOfferingOwnership[] }>('/api/admin/offering-ownership')
  }

  async createOfferingOwnership(payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status'>) {
    return this.request<ApiOfferingOwnership>('/api/admin/offering-ownership', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateOfferingOwnership(ownershipId: string, payload: Pick<ApiOfferingOwnership, 'offeringId' | 'facultyId' | 'ownershipRole' | 'status' | 'version'>) {
    return this.request<ApiOfferingOwnership>(`/api/admin/offering-ownership/${ownershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listCourseOutcomeOverrides(filter?: { courseId?: string; scopeType?: ApiCourseOutcomeScopeType; scopeId?: string }) {
    const search = new URLSearchParams()
    if (filter?.courseId) search.set('courseId', filter.courseId)
    if (filter?.scopeType) search.set('scopeType', filter.scopeType)
    if (filter?.scopeId) search.set('scopeId', filter.scopeId)
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return this.request<{ items: ApiCourseOutcomeOverride[] }>(`/api/admin/course-outcomes${suffix}`)
  }

  async createCourseOutcomeOverride(payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status'>) {
    return this.request<ApiCourseOutcomeOverride>('/api/admin/course-outcomes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCourseOutcomeOverride(courseOutcomeOverrideId: string, payload: Pick<ApiCourseOutcomeOverride, 'courseId' | 'scopeType' | 'scopeId' | 'outcomes' | 'status' | 'version'>) {
    return this.request<ApiCourseOutcomeOverride>(`/api/admin/course-outcomes/${courseOutcomeOverrideId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getResolvedCourseOutcomes(offeringId: string) {
    return this.request<ApiResolvedCourseOutcomeSet>(`/api/admin/offerings/${offeringId}/resolved-course-outcomes`)
  }

  async getCurriculumFeatureConfig(batchId: string) {
    return this.request<ApiCurriculumFeatureConfigBundle>(`/api/admin/batches/${batchId}/curriculum-feature-config`)
  }

  async listCurriculumFeatureProfiles(filter?: { scopeType?: ApiCurriculumFeatureProfile['scopeType']; scopeId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.scopeType) searchParams.set('scopeType', filter.scopeType)
    if (filter?.scopeId) searchParams.set('scopeId', filter.scopeId)
    const query = searchParams.toString()
    return this.request<{ items: ApiCurriculumFeatureProfile[] }>(`/api/admin/curriculum-feature-profiles${query ? `?${query}` : ''}`)
  }

  async createCurriculumFeatureProfile(payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status'>) {
    return this.request<ApiCurriculumFeatureProfile>('/api/admin/curriculum-feature-profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateCurriculumFeatureProfile(curriculumFeatureProfileId: string, payload: Pick<ApiCurriculumFeatureProfile, 'name' | 'scopeType' | 'scopeId' | 'status' | 'version'>) {
    return this.request<ApiCurriculumFeatureProfile>(`/api/admin/curriculum-feature-profiles/${curriculumFeatureProfileId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async saveCurriculumFeatureBinding(batchId: string, payload: Pick<ApiBatchCurriculumFeatureBinding, 'bindingMode' | 'curriculumFeatureProfileId' | 'status' | 'version'>) {
    return this.request<ApiCurriculumFeatureBindingSaveResult>(`/api/admin/batches/${batchId}/curriculum-feature-binding`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveCurriculumFeatureConfig(batchId: string, curriculumCourseId: string, payload: ApiCurriculumFeatureConfigPayload) {
    return this.request<ApiCurriculumFeatureConfigSaveResult>(
      `/api/admin/batches/${batchId}/curriculum-feature-config/${curriculumCourseId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    )
  }

  async provisionBatch(batchId: string, payload: ApiBatchProvisioningRequest) {
    return this.request<ApiBatchProvisioningResponse>(`/api/admin/batches/${batchId}/provision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async saveOfferingAssessmentScheme(offeringId: string, payload: { scheme: SchemeState }) {
    return this.request<{ offeringId: string; scheme: SchemeState; version: number; policySnapshot: unknown }>(`/api/academic/offerings/${offeringId}/scheme`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async saveOfferingQuestionPaper(offeringId: string, kind: TTKind, payload: { blueprint: TermTestBlueprint }) {
    return this.request<{ paperId: string; offeringId: string; kind: TTKind; blueprint: TermTestBlueprint; version: number }>(`/api/academic/offerings/${offeringId}/question-papers/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async createAttendanceSnapshot(payload: Omit<ApiAttendanceSnapshot, 'attendanceSnapshotId'>) {
    return this.request<{ attendanceSnapshotId: string; ok: true }>('/api/admin/attendance-snapshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createAssessmentScore(payload: Omit<ApiAssessmentScore, 'assessmentScoreId'>) {
    return this.request<{ assessmentScoreId: string; ok: true }>('/api/admin/assessment-scores', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createStudentIntervention(payload: Omit<ApiStudentIntervention, 'interventionId'>) {
    return this.request<{ interventionId: string; ok: true }>('/api/admin/student-interventions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createTranscriptTermResult(payload: Omit<ApiTranscriptTermResult, 'transcriptTermResultId'>) {
    return this.request<{ transcriptTermResultId: string; ok: true }>('/api/admin/transcript-term-results', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createTranscriptSubjectResult(payload: Omit<ApiTranscriptSubjectResult, 'transcriptSubjectResultId'>) {
    return this.request<{ transcriptSubjectResultId: string; ok: true }>('/api/admin/transcript-subject-results', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listAdminRequests() {
    return this.request<{ items: ApiAdminRequestSummary[] }>('/api/admin/requests')
  }

  async searchAdminWorkspace(query: string, scope?: {
    academicFacultyId?: string
    departmentId?: string
    branchId?: string
    batchId?: string
    sectionCode?: string
  }) {
    const searchParams = new URLSearchParams()
    if (query.trim()) searchParams.set('q', query.trim())
    if (scope?.academicFacultyId) searchParams.set('academicFacultyId', scope.academicFacultyId)
    if (scope?.departmentId) searchParams.set('departmentId', scope.departmentId)
    if (scope?.branchId) searchParams.set('branchId', scope.branchId)
    if (scope?.batchId) searchParams.set('batchId', scope.batchId)
    if (scope?.sectionCode) searchParams.set('sectionCode', scope.sectionCode)
    const qs = searchParams.toString()
    return this.request<{ items: ApiAdminSearchResult[] }>(`/api/admin/search${qs ? `?${qs}` : ''}`)
  }

  async listAuditEvents(filter: { entityType: string; entityId: string }) {
    const searchParams = new URLSearchParams({
      entityType: filter.entityType,
      entityId: filter.entityId,
    })
    return this.request<{ items: ApiAuditEvent[] }>(`/api/admin/audit-events?${searchParams.toString()}`)
  }

  async listRecentAdminAuditEvents(limit = 80) {
    const searchParams = new URLSearchParams({ limit: String(limit) })
    return this.request<{ items: ApiAuditEvent[] }>(`/api/admin/audit-events/recent?${searchParams.toString()}`)
  }

  async listAdminReminders() {
    return this.request<{ items: ApiAdminReminder[] }>('/api/admin/reminders')
  }

  async createAdminReminder(payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status'>) {
    return this.request<ApiAdminReminder>('/api/admin/reminders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateAdminReminder(reminderId: string, payload: Pick<ApiAdminReminder, 'title' | 'body' | 'dueAt' | 'status' | 'version'>) {
    return this.request<ApiAdminReminder>(`/api/admin/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async getAdminFacultyCalendar(facultyId: string) {
    return this.request<ApiAdminFacultyCalendar>(`/api/admin/faculty-calendar/${facultyId}`)
  }

  async saveAdminFacultyCalendar(facultyId: string, payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) {
    return this.request<ApiAdminFacultyCalendar>(`/api/admin/faculty-calendar/${facultyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async getAcademicFacultyProfile(facultyId: string, filter?: { simulationStageCheckpointId?: string }) {
    const searchParams = new URLSearchParams()
    if (filter?.simulationStageCheckpointId) searchParams.set('simulationStageCheckpointId', filter.simulationStageCheckpointId)
    const query = searchParams.toString()
    return this.request<ApiAcademicFacultyProfile>(`/api/academic/faculty-profile/${facultyId}${query ? `?${query}` : ''}`)
  }

  async getAdminRequest(requestId: string) {
    return this.request<ApiAdminRequestDetail>(`/api/admin/requests/${requestId}`)
  }

  async assignAdminRequest(requestId: string, payload: { version: number; ownedByFacultyId?: string | null; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async requestAdminRequestInfo(requestId: string, payload: { version: number; noteBody: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/request-info`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async approveAdminRequest(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async rejectAdminRequest(requestId: string, payload: { version: number; noteBody: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async markAdminRequestImplemented(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/mark-implemented`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async closeAdminRequest(requestId: string, payload: { version: number; noteBody?: string }) {
    return this.request<ApiAdminRequestSummary>(`/api/admin/requests/${requestId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async addAdminRequestNote(requestId: string, payload: { visibility?: string; noteType: string; body: string }) {
    return this.request<ApiAdminRequestNote>(`/api/admin/requests/${requestId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getAdminRequestAudit(requestId: string) {
    return this.request<{ transitions: ApiAdminRequestDetail['transitions']; auditEvents: ApiAuditEvent[] }>(`/api/admin/requests/${requestId}/audit`)
  }

  private async request<T>(path: string, init?: RequestInit) {
    const hasBody = init?.body !== undefined
    const resolvedHeaders = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: resolvedHeaders,
      ...init,
    })

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : response.statusText || 'API request failed'
      throw new AirMentorApiError(response.status, message, payload)
    }

    return payload as T
  }
}
