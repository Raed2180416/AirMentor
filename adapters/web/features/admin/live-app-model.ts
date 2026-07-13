export {
  toErrorMessage,
  requireText,
  requirePositiveInteger,
  requireNonNegativeInteger,
  requirePositiveEvenInteger,
  requireDate,
  requireRange,
} from './live-app-validation'
export {
  formatClockLabel,
  readStringField,
  readNumberField,
  readBooleanField,
  readRecordField,
  formatSplitSummary,
  formatKeyedCounts,
  formatHeadSupportSummary,
  formatDiagnosticSummary,
  summarizeAuditEvent,
} from './live-app-diagnostic-formatters'
export {
  parseAdminRoute,
  routeToHash,
  toRegistrySearchScope,
  normalizeHierarchyScope,
  normalizeAdminSectionCode,
  buildAdminSectionScopeId,
  parseAdminSectionScopeId,
  buildAdminActiveScopeChain,
  fadeColor,
} from './live-app-routes-and-scopes'
export type { ActiveAdminScope } from './live-app-routes-and-scopes'
export {
  defaultCurriculumFeatureForm,
  hydrateCurriculumFeatureForm,
  parseCurriculumFeatureLines,
  buildCurriculumFeaturePayload,
  validateCurriculumFeaturePrerequisites,
} from './live-app-curriculum-feature-model'
export type { CurriculumFeatureFormState } from './live-app-curriculum-feature-model'
export {
  defaultEntityEditorState,
  defaultStudentForm,
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  defaultFacultyForm,
  defaultAppointmentForm,
  defaultRoleGrantForm,
  defaultOwnershipForm,
} from './live-app-editor-forms'
export type {
  StructureFormState,
  EntityEditorState,
  StudentFormState,
  EnrollmentFormState,
  MentorAssignmentFormState,
  FacultyFormState,
  AppointmentFormState,
  RoleGrantFormState,
  OwnershipFormState,
} from './live-app-editor-forms'
export {
  DEFAULT_STAGE_POLICY,
  STAGE_EVIDENCE_OPTIONS,
  defaultStagePolicyForm,
  hydrateStagePolicyForm,
  buildStagePolicyPayload,
} from './live-app-stage-policy-model'
export type { StagePolicyFormState } from './live-app-stage-policy-model'

export {
  EMPTY_FACULTY_RECORDS,
  EMPTY_DATA,
  upsertLiveAdminItem,
  upsertAcademicFacultyRecord,
  upsertDepartmentRecord,
  upsertBranchRecord,
  upsertBatchRecord,
  applyFacultyVisibilityRules,
  matchesBatchScope,
  toOptionalScopeValue,
} from './live-app-model-parts/dataset-records'

export {
  WEEKDAYS,
  DEFAULT_PROGRESSION_RULES,
  defaultPolicyForm,
  mergePolicyPayload,
  hydratePolicyForm,
  buildPolicyPayload,
  buildValidatedPolicyPayload,
} from './live-app-model-parts/policy-form'
export type { PolicyFormState } from './live-app-model-parts/policy-form'

export {
  defaultBatchProvisioningForm,
  buildBatchProvisioningPayload,
} from './live-app-model-parts/batch-provisioning'
export type { BatchProvisioningFormState } from './live-app-model-parts/batch-provisioning'

export {
  hasRecordProofProvenance,
  formatRecordProofBanner,
  shouldShowProofCheckpointCgpa,
  shouldOverlayProofCheckpointStudentSummary,
} from './live-app-model-parts/proof-records'
export type { ProvenancedRecord } from './live-app-model-parts/proof-records'

export {
  formatFacultyGrantScopeLabel,
  formatFacultyAppointmentLabel,
  resolveFacultyCredentialStatus,
} from './live-app-model-parts/faculty-labels'

export {
  ADMIN_SECTION_TONES,
  ADMIN_DISMISSED_QUEUE_STORAGE_KEY,
  ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT,
  UNIVERSITY_TABS,
  isUniversityTab,
  readSubmittedField,
  shouldHydrateHierarchyEditor,
  getAuditEventRoute,
  createAdminWorkspaceSnapshot,
  getAdminWorkspaceSnapshotKey,
} from './live-app-model-parts/workspace-and-tabs'
export type {
  StudentDetailTab,
  FacultyDetailTab,
  UniversityTab,
  EditingEntity,
  AdminWorkspaceSnapshot,
} from './live-app-model-parts/workspace-and-tabs'
