// Coordinator/barrel for the web API contract types. Implementation lives in
// ./types-parts/*. This module re-exports the identical public surface so
// existing '@web/shared/api/types' importers keep working unchanged.

export type {
  ApiAdminFacultyPasswordSetupResponse,
  ApiFacultyCredentialStatus,
  ApiLoginRequest,
  ApiPasswordSetupInspectResponse,
  ApiPasswordSetupRedeemResponse,
  ApiPasswordSetupRequestResponse,
  ApiRoleCode,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiUiPreferences,
} from './types-parts/session'

export type {
  ApiAcademicFaculty,
  ApiAcademicTerm,
  ApiBatch,
  ApiBranch,
  ApiCourse,
  ApiCurriculumCourse,
  ApiDepartment,
  ApiFacultyAppointment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiMentorAssignment,
  ApiMentorAssignmentBulkApplyRequest,
  ApiMentorAssignmentBulkApplyResponse,
  ApiMentorAssignmentBulkApplySelectionMode,
  ApiMentorAssignmentBulkApplyStudent,
  ApiStudentEnrollment,
  ApiStudentRecord,
} from './types-parts/hierarchy'

export type {
  ApiBatchSetupReadiness,
  ApiCountSource,
  ApiGradeBand,
  ApiPolicyOverride,
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiResolvedFrom,
  ApiScopeDescriptor,
  ApiScopeMode,
  ApiScopeType,
  ApiStageEvidenceKind,
  ApiStagePolicyOverride,
  ApiStagePolicyPayload,
  ApiStagePolicyStage,
  ApiStagePolicyStageKey,
} from './types-parts/policy'

export type {
  ApiActivateProofSemesterRequest,
  ApiActivateProofSemesterResponse,
  ApiProofDashboard,
  ApiSimulationStageCheckpointSummary,
} from './types-parts/proof-dashboard'

export type {
  ApiRiskCalibrationArtifact,
  ApiRiskCalibrationMethod,
  ApiRiskHeadDisplay,
  ApiRiskMetricSummary,
} from './types-parts/risk'

export type {
  ApiProofQueueGovernanceFields,
  ApiProofQueueState,
  ApiProofReassessmentAcknowledgeRequest,
  ApiProofReassessmentAcknowledgeResponse,
  ApiProofReassessmentAcknowledgement,
  ApiProofReassessmentResolution,
  ApiProofReassessmentResolutionOutcome,
  ApiProofReassessmentResolutionPayload,
  ApiProofReassessmentResolveRequest,
  ApiProofReassessmentResolveResponse,
  ApiProofRecoveryState,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentDetail,
  ApiProofStudentEvidenceTimelineItem,
} from './types-parts/proof-reassessment'

export type {
  ApiStudentAgentCard,
  ApiStudentAgentCitation,
  ApiStudentAgentMessage,
  ApiStudentAgentPanelLabel,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
} from './types-parts/student-agent'

export type {
  ApiFeatureCompleteness,
  ApiFeatureProvenance,
  ApiStudentRiskExplorer,
} from './types-parts/student-risk-explorer'

export type { ApiFacultyProofOperations } from './types-parts/faculty-proof-ops'

export type {
  ApiAcademicHodProofBundle,
  ApiAcademicHodProofCourseRollup,
  ApiAcademicHodProofFacultyRollup,
  ApiAcademicHodProofReassessment,
  ApiAcademicHodProofRunContext,
  ApiAcademicHodProofStudentWatch,
  ApiAcademicHodProofSummary,
} from './types-parts/hod-proof'

export type {
  ApiAcademicHodProofCounterfactualAggregate,
  ApiAcademicHodProofCounterfactualReport,
  ApiAcademicHodProofCounterfactualScalar,
  ApiAcademicHodProofCounterfactualSimulatorReport,
  ApiAcademicHodProofCounterfactualStudentStageDiff,
  ApiAcademicHodProofSimulatorBandTransition,
  ApiAcademicHodProofSimulatorProjectedFinal,
  ApiAcademicHodProofSimulatorRiskBand,
  ApiAcademicHodProofSimulatorScalarKey,
  ApiAcademicHodProofSimulatorSemesterAggregate,
  ApiAcademicHodProofSimulatorSemesterStageAggregate,
  ApiAcademicHodProofSimulatorStageKey,
  ApiAcademicHodProofSimulatorStudentStage,
  ApiProofRunCheckpointStudentSummary,
} from './types-parts/hod-proof-counterfactual'

export type {
  ApiAdminReminder,
  ApiAdminRequestDetail,
  ApiAdminRequestNote,
  ApiAdminRequestSummary,
  ApiAdminRequestTransition,
  ApiAdminSearchResult,
  ApiAdminSearchRoute,
  ApiAuditEvent,
  ApiTargetEntityRef,
} from './types-parts/admin'

export type {
  ApiAcademicCalendarAuditListResponse,
  ApiAcademicCalendarAuditRecord,
  ApiAcademicLoginFaculty,
  ApiAcademicRuntimeState,
  ApiAcademicTaskListResponse,
  ApiAcademicTaskPlacementListResponse,
  ApiAcademicTaskPlacementRecord,
  ApiAcademicTaskRecord,
  ApiAppendAcademicCalendarAuditRequest,
  ApiAppendAcademicCalendarAuditResponse,
  ApiDeleteAcademicTaskPlacementResponse,
  ApiUpsertAcademicTaskPlacementRequest,
  ApiUpsertAcademicTaskPlacementResponse,
  ApiUpsertAcademicTaskRequest,
  ApiUpsertAcademicTaskResponse,
} from './types-parts/academic-runtime'

export type {
  ApiBatchCurriculumFeatureBinding,
  ApiBatchCurriculumFeatureOverride,
  ApiCourseOutcome,
  ApiCourseOutcomeOverride,
  ApiCourseOutcomeScopeType,
  ApiCurriculumBootstrapResult,
  ApiCurriculumFeatureBindingSaveResult,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigItem,
  ApiCurriculumFeatureConfigPayload,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumFeatureConfigSaveResult,
  ApiCurriculumFeatureProfile,
  ApiCurriculumGraphBundle,
  ApiCurriculumLinkageApprovalResult,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageCandidateRegenerateResult,
  ApiCurriculumLinkageGenerationStatus,
  ApiGraphEdge,
  ApiGraphNode,
  ApiGraphSuggestion,
  ApiProofRefresh,
  ApiResolvedCourseOutcomeSet,
} from './types-parts/curriculum'

export type {
  ApiAcademicBootstrap,
  ApiAcademicMeeting,
  ApiAcademicRuntimeKey,
  ApiAdminOffering,
  ApiBatchProvisioningRequest,
  ApiBatchProvisioningResponse,
  ApiCoAttainmentRow,
  ApiOfferingStageEligibility,
} from './types-parts/academic-bootstrap'

export type {
  ApiAdminCalendarMarker,
  ApiAdminCalendarMarkerType,
  ApiAdminFacultyCalendar,
  ApiAdminFacultyCalendarWorkspace,
} from './types-parts/calendar'

export type {
  ApiAssessmentScore,
  ApiAttendanceSnapshot,
  ApiOfferingOwnership,
  ApiStudentIntervention,
  ApiTranscriptSubjectResult,
  ApiTranscriptTermResult,
} from './types-parts/offering-records'

export type { ApiAcademicFacultyProfile } from './types-parts/faculty-profile'

export type {
  ApiDemoProvisioningPreview,
  ApiDemoProvisioningResult,
  ApiDemoWorkspace,
} from './types-parts/demo'
