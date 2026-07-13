import type {
  ComponentProps,
  Dispatch,
  FormEventHandler,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  LiveAdminDataset,
  LiveAdminRoute,
} from '../system-admin-live-data'
import type {
  BatchProvisioningFormState,
  EntityEditorState,
  PolicyFormState,
  StagePolicyFormState,
} from '../system-admin-live-app'
import type { BulkMentorAssignmentFormState } from '../system-admin-provisioning-helpers'
import type {
  ApiAcademicFaculty,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiFacultyRecord,
  ApiMentorAssignmentBulkApplyResponse,
  ApiPolicyOverride,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiScopeType,
  ApiStagePolicyOverride,
  ApiStudentRecord,
} from '@web/shared/api/types'
import type { ApiCurriculumFeatureConfigBundle, ApiCurriculumFeatureConfigHistoryEvent, ApiCurriculumFeatureConfigPreview, ApiCurriculumLinkageCandidate, ApiCurriculumLinkageGenerationStatus } from '@web/shared/api/types'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { BatchSetupReadiness } from '../batch-setup-readiness'
import { SystemAdminProofDashboardWorkspace } from '../system-admin-proof-dashboard-workspace'
import { SystemAdminScopedRegistryLaunches } from '../system-admin-scoped-registry-launches'

export type RestoreNotice = { tone: 'neutral' | 'error'; message: string } | null

export type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

export type CurriculumFeatureFormState = {
  assessmentProfile: string
  outcomesText: string
  prerequisitesText: string
  bridgeModulesText: string
  tt1TopicsText: string
  tt2TopicsText: string
  seeTopicsText: string
  workbookTopicsText: string
}

export type SelectionItem = {
  key: string
  title: string
  subtitle: string
  selected: boolean
  onSelect: () => void
}

export type TabCard = {
  id: string
  label: string
  description: string
  icon: ReactNode
}

export type WorkspaceMetaScope = {
  scopeType: ApiScopeType
  scopeId: string
  label: string
}

export type CurriculumSemesterEntry = {
  semesterNumber: number
  courses: LiveAdminDataset['curriculumCourses']
}

export type ScopedRegistryScope = {
  label: string
} | null

export type HierarchyWorkspaceTabOption = {
  id: string
  label: string
  icon: ReactNode
}

export type GovernanceResolvedLineage = {
  scopeDescriptor: ApiResolvedBatchPolicy['scopeDescriptor']
  resolvedFrom: ApiResolvedBatchPolicy['resolvedFrom']
  scopeMode: ApiResolvedBatchPolicy['scopeMode']
  appliedOverrides: Array<{ scopeType: ApiScopeType; scopeId: string }>
}

export type GovernanceSubject = 'policy' | 'stage policy'

export type SystemAdminFacultiesWorkspaceProps = {
  data: LiveAdminDataset
  route: LiveAdminRoute
  toneColor: string
  restoreNotice: RestoreNotice
  onResetRestore: () => void
  onDismissRestoreNotice?: () => void
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  selectedBranch: ApiBranch | null
  selectedBatch: ApiBatch | null
  canonicalProofBatch: ApiBatch | null
  authoritativeOperationalSemester: number | null
  authoritativeOperationalSemesterSource: 'proof-run' | 'batch' | 'unavailable'
  selectedSectionCode: string | null
  selectedAcademicFacultyImpact: {
    departments: number
    branches: number
    batches: number
    students: number
    facultyMembers: number
    courses: number
  } | null
  facultyDepartments: ApiDepartment[]
  departmentBranches: ApiBranch[]
  branchBatches: ApiBatch[]
  structureForms: StructureFormState
  setStructureForms: Dispatch<SetStateAction<StructureFormState>>
  setEditingEntity: Dispatch<SetStateAction<'academic-faculty' | 'department' | 'branch' | 'batch' | null>>
  handleCreateAcademicFaculty: FormEventHandler<HTMLFormElement>
  handleCreateDepartment: FormEventHandler<HTMLFormElement>
  handleCreateBranch: FormEventHandler<HTMLFormElement>
  handleCreateBatch: FormEventHandler<HTMLFormElement>
  navigate: (route: LiveAdminRoute, options?: { recordHistory?: boolean }) => void
  updateSelectedSectionCode: (sectionCode: string | null, options?: { recordHistory?: boolean }) => void
  universityTab: string
  updateUniversityTab: (tabId: string, options?: { recordHistory?: boolean }) => void
  universityTabOptions: Array<{ id: string; label: string; icon: ReactNode }>
  universityWorkspaceTabCards: TabCard[]
  universityWorkspaceColumns: string
  universityLevelTitle: string
  universityLevelHelper: string
  universityLeftItems: SelectionItem[]
  universityWorkspaceLabel: string
  universityWorkspacePaneRef: RefObject<HTMLDivElement | null>
  stickyShadow: string
  activeBatchPolicyOverride: ApiPolicyOverride | null
  activeScopeChain: WorkspaceMetaScope[]
  activeGovernanceScope: WorkspaceMetaScope | null
  resolvedBatchPolicy: ApiResolvedBatchPolicy | null
  resolvedStagePolicy: ApiResolvedBatchStagePolicy | null
  activeScopePolicyOverride: ApiPolicyOverride | null
  activeScopeStageOverride: ApiStagePolicyOverride | null
  policyForm: PolicyFormState
  setPolicyForm: Dispatch<SetStateAction<PolicyFormState>>
  stagePolicyForm: StagePolicyFormState
  setStagePolicyForm: Dispatch<SetStateAction<StagePolicyFormState>>
  handleSaveScopePolicy: () => Promise<void>
  handleResetScopePolicy: () => Promise<void>
  handleSaveScopeStagePolicy: () => Promise<void>
  handleResetScopeStagePolicy: () => Promise<void>
  entityEditors: Pick<EntityEditorState, 'term' | 'curriculum'>
  setEntityEditors: Dispatch<SetStateAction<EntityEditorState>>
  batchTerms: LiveAdminDataset['terms']
  currentSemesterTerm: LiveAdminDataset['terms'][number] | null
  startEditingTerm: (termId: string) => void
  resetTermEditor: () => void
  handleSaveTerm: FormEventHandler<HTMLFormElement>
  handleArchiveTerm: (termId: string) => Promise<void>
  selectedCurriculumSemester: string
  setSelectedCurriculumSemester: Dispatch<SetStateAction<string>>
  curriculumSemesterEntries: CurriculumSemesterEntry[]
  selectedCurriculumCourseId: string
  startEditingCurriculumCourse: (curriculumCourseId: string) => void
  resetCurriculumEditor: () => void
  handleSaveCurriculumCourse: FormEventHandler<HTMLFormElement>
  handleArchiveCurriculumCourse: (curriculumCourseId: string) => Promise<void>
  handleBootstrapCurriculumManifest: () => Promise<void>
  scopedCourseLeaderFaculty: ApiFacultyRecord[]
  getScopedCourseLeaderState: (curriculumCourseId: string) => {
    matchingOfferings: LiveAdminDataset['offerings']
    leaderIds: string[]
    selectedFacultyId: string
    hasMultipleLeaders: boolean
  }
  handleAssignCurriculumCourseLeader: (curriculumCourseId: string, facultyId: string) => Promise<void>
  batchProvisioningForm: BatchProvisioningFormState
  setBatchProvisioningForm: Dispatch<SetStateAction<BatchProvisioningFormState>>
  handleProvisionBatch: () => Promise<void>
  handleProvisionSeededDemoWorkspace: () => Promise<void>
  batchFacultyPool: ApiFacultyRecord[]
  batchMentorEligibleFaculty: ApiFacultyRecord[]
  batchOfferingsWithoutOwner: LiveAdminDataset['offerings']
  batchStudentsWithoutEnrollment: ApiStudentRecord[]
  batchStudentsWithoutMentor: ApiStudentRecord[]
  batchOfferingsWithoutRoster: LiveAdminDataset['offerings']
  batchSetupReadiness: BatchSetupReadiness | null
  bulkMentorAssignmentForm: BulkMentorAssignmentFormState
  setBulkMentorAssignmentForm: Dispatch<SetStateAction<BulkMentorAssignmentFormState>>
  bulkMentorAssignmentPreview: ApiMentorAssignmentBulkApplyResponse | null
  handlePreviewBulkMentorAssignment: () => Promise<void>
  handleApplyBulkMentorAssignment: () => Promise<void>
  clearBulkMentorAssignmentPreview: () => void
  activeUniversityRegistryScope: ScopedRegistryScope
  activeUniversityStudentScopeChipLabel: string
  activeUniversityFacultyScopeChipLabel: string
  scopedUniversityStudents: ApiStudentRecord[]
  filteredUniversityFaculty: ApiFacultyRecord[]
  curriculumFeatureConfig: ApiCurriculumFeatureConfigBundle | null
  curriculumFeatureItems: ApiCurriculumFeatureConfigBundle['items']
  selectedCurriculumFeatureCourseId: string
  setSelectedCurriculumFeatureCourseId: Dispatch<SetStateAction<string>>
  selectedCurriculumFeatureItem: ApiCurriculumFeatureConfigBundle['items'][number] | null
  curriculumFeatureProfileOptions: NonNullable<ApiCurriculumFeatureConfigBundle['availableProfiles']>
  curriculumFeatureBindingMode: 'inherit-scope-profile' | 'pin-profile' | 'local-only'
  setCurriculumFeatureBindingMode: Dispatch<SetStateAction<'inherit-scope-profile' | 'pin-profile' | 'local-only'>>
  curriculumFeaturePinnedProfileId: string
  setCurriculumFeaturePinnedProfileId: Dispatch<SetStateAction<string>>
  curriculumFeatureTargetMode: 'batch-local-override' | 'scope-profile'
  setCurriculumFeatureTargetMode: Dispatch<SetStateAction<'batch-local-override' | 'scope-profile'>>
  curriculumFeatureTargetScopeKey: string
  setCurriculumFeatureTargetScopeKey: Dispatch<SetStateAction<string>>
  curriculumFeatureTargetScopeOptions: Array<{ scopeType: ApiScopeType; scopeId: string; label: string }>
  selectedCurriculumFeatureTargetScope: { scopeType: ApiScopeType; scopeId: string; label: string } | null
  curriculumFeatureAffectedBatchPreview: ApiBatch[]
  curriculumLinkageGenerationStatus: ApiCurriculumLinkageGenerationStatus | null
  curriculumLinkageCandidatesLoading: boolean
  selectedCurriculumLinkageCandidates: ApiCurriculumLinkageCandidate[]
  curriculumLinkageReviewNote: string
  setCurriculumLinkageReviewNote: Dispatch<SetStateAction<string>>
  curriculumFeatureForm: CurriculumFeatureFormState
  setCurriculumFeatureForm: Dispatch<SetStateAction<CurriculumFeatureFormState>>
  handleSaveCurriculumFeatureBinding: () => Promise<void>
  handleRegenerateCurriculumLinkageCandidates: () => Promise<void>
  handleApproveCurriculumLinkageCandidate: (candidateId: string) => Promise<void>
  handleRejectCurriculumLinkageCandidate: (candidateId: string) => Promise<void>
  handleSaveCurriculumFeatureConfig: () => Promise<void>
  handlePreviewCurriculumFeatureConfig: () => Promise<void>
  curriculumFeaturePreview: ApiCurriculumFeatureConfigPreview | null
  handleLoadCurriculumFeatureHistory: () => Promise<void>
  curriculumFeatureHistory: ApiCurriculumFeatureConfigHistoryEvent[] | null
  proofDashboardProps: ComponentProps<typeof SystemAdminProofDashboardWorkspace>
  onOpenProofDashboard: () => void
  registryLaunchProps: ComponentProps<typeof SystemAdminScopedRegistryLaunches>
  apiClient: AirMentorApiClient
}
