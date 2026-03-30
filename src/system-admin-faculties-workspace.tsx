import { Plus } from 'lucide-react'
import type {
  ComponentProps,
  Dispatch,
  FormEventHandler,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react'
import { T, mono, sora } from './data'
import {
  deriveCurrentYearLabel,
  type LiveAdminDataset,
  type LiveAdminRoute,
} from './system-admin-live-data'
import type {
  BatchProvisioningFormState,
  EntityEditorState,
  PolicyFormState,
  StagePolicyFormState,
} from './system-admin-live-app'
import {
  EmptyState,
  InfoBanner,
  TextAreaInput,
  TextInput,
  SectionHeading,
} from './system-admin-ui'
import {
  Btn,
  Card,
  Chip,
  withAlpha,
} from './ui-primitives'
import { SystemAdminHierarchyWorkspaceShell } from './system-admin-hierarchy-workspace-shell'
import { SystemAdminProofDashboardWorkspace } from './system-admin-proof-dashboard-workspace'
import { SystemAdminScopedRegistryLaunches } from './system-admin-scoped-registry-launches'
import type {
  ApiAcademicFaculty,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiFacultyRecord,
  ApiPolicyOverride,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiScopeType,
  ApiStageEvidenceKind,
  ApiStagePolicyOverride,
  ApiStudentRecord,
} from './api/types'
import type { ApiCurriculumFeatureConfigBundle, ApiCurriculumLinkageCandidate, ApiCurriculumLinkageGenerationStatus } from './api/types'

type RestoreNotice = { tone: 'neutral' | 'error'; message: string } | null

type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

type CurriculumFeatureFormState = {
  assessmentProfile: string
  outcomesText: string
  prerequisitesText: string
  bridgeModulesText: string
  tt1TopicsText: string
  tt2TopicsText: string
  seeTopicsText: string
  workbookTopicsText: string
}

type AdminMiniStatProps = {
  label: string
  value: string
  tone?: string
}

function AdminMiniStat({ label, value, tone = T.accent }: AdminMiniStatProps) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${withAlpha(tone, '28')}`, background: `linear-gradient(180deg, ${withAlpha(tone, '12')}, ${T.surface})`, padding: '12px 14px', minWidth: 0, boxShadow: `0 10px 24px ${withAlpha(tone, '12')}` }}>
      <div style={{ ...mono, fontSize: 9, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text, marginTop: 6, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function formatScopeTypeLabel(scopeType: ApiScopeType) {
  switch (scopeType) {
    case 'institution':
      return 'Institution'
    case 'academic-faculty':
      return 'Faculty'
    case 'department':
      return 'Department'
    case 'branch':
      return 'Branch'
    case 'batch':
      return 'Batch'
    case 'section':
      return 'Section'
    default:
      return scopeType
  }
}

type SelectionItem = {
  key: string
  title: string
  subtitle: string
  selected: boolean
  onSelect: () => void
}

type TabCard = {
  id: string
  label: string
  description: string
  icon: ReactNode
}

type WorkspaceMetaScope = {
  scopeType: ApiScopeType
  scopeId: string
  label: string
}

type CurriculumSemesterEntry = {
  semesterNumber: number
  courses: LiveAdminDataset['curriculumCourses']
}

type ScopedRegistryScope = {
  label: string
} | null

type HierarchyWorkspaceTabOption = {
  id: string
  label: string
  icon: ReactNode
}

type GovernanceResolvedLineage = {
  scopeDescriptor: ApiResolvedBatchPolicy['scopeDescriptor']
  resolvedFrom: ApiResolvedBatchPolicy['resolvedFrom']
  scopeMode: ApiResolvedBatchPolicy['scopeMode']
  appliedOverrides: Array<{ scopeType: ApiScopeType; scopeId: string }>
}

type GovernanceSubject = 'policy' | 'stage policy'

function formatScopeModeLabel(scopeMode: ApiScopeType | 'proof') {
  if (scopeMode === 'proof') return 'Proof'
  return formatScopeTypeLabel(scopeMode)
}

function getInstitutionDefaultsLabel(activeScopeChain: WorkspaceMetaScope[]) {
  const institutionScope = activeScopeChain.find(scope => scope.scopeType === 'institution')
  return institutionScope ? `${institutionScope.label} defaults` : 'Institution defaults'
}

function getScopeLabelFromChain(
  scopeType: ApiScopeType | 'proof' | 'student',
  scopeId: string,
  activeScopeChain: WorkspaceMetaScope[],
) {
  const match = activeScopeChain.find(scope => scope.scopeType === scopeType && scope.scopeId === scopeId)
  if (match) return match.label
  if (scopeType === 'proof') return 'Proof'
  if (scopeType === 'student') return `Student ${scopeId}`
  if (scopeType === 'section') {
    const sectionCode = scopeId.split('::').at(-1) ?? scopeId
    return `Section ${sectionCode}`
  }
  return `${formatScopeTypeLabel(scopeType)} ${scopeId}`
}

function describeResolvedFromLabel(
  resolved: GovernanceResolvedLineage | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  if (!resolved) return 'authoritative lineage is loading'
  const explicitLabel = resolved.resolvedFrom.label.trim()
  if (explicitLabel) return explicitLabel
  if (resolved.resolvedFrom.scopeType && resolved.resolvedFrom.scopeId) {
    return `${getScopeLabelFromChain(resolved.resolvedFrom.scopeType, resolved.resolvedFrom.scopeId, activeScopeChain)} override`
  }
  return getInstitutionDefaultsLabel(activeScopeChain)
}

function buildGovernanceLineageTrail(
  resolved: GovernanceResolvedLineage | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  const lineage = [getInstitutionDefaultsLabel(activeScopeChain)]
  if (!resolved) return lineage.join(' -> ')
  for (const applied of resolved.appliedOverrides) {
    lineage.push(getScopeLabelFromChain(applied.scopeType, applied.scopeId, activeScopeChain))
  }
  return lineage.join(' -> ')
}

function describeRollbackTargetLabel(
  resolved: GovernanceResolvedLineage | null,
  activeGovernanceScope: WorkspaceMetaScope | null,
  activeScopeChain: WorkspaceMetaScope[],
) {
  if (!resolved || !activeGovernanceScope) return getInstitutionDefaultsLabel(activeScopeChain)
  const fallbackOverride = [...resolved.appliedOverrides].reverse().find(applied => (
    applied.scopeType !== activeGovernanceScope.scopeType || applied.scopeId !== activeGovernanceScope.scopeId
  ))
  return fallbackOverride
    ? `${getScopeLabelFromChain(fallbackOverride.scopeType, fallbackOverride.scopeId, activeScopeChain)} override`
    : getInstitutionDefaultsLabel(activeScopeChain)
}

export function describeGovernanceResolutionMessage({
  activeGovernanceScope,
  activeScopeChain,
  resolved,
  subject,
}: {
  activeGovernanceScope: WorkspaceMetaScope | null
  activeScopeChain: WorkspaceMetaScope[]
  resolved: GovernanceResolvedLineage | null
  subject: GovernanceSubject
}) {
  if (!resolved) {
    const resolvedScopeType = activeGovernanceScope?.scopeType ?? 'institution'
    return `Resolved lineage is loading for ${formatScopeTypeLabel(resolvedScopeType).toLowerCase()} ${activeGovernanceScope?.label ?? 'defaults'}.`
  }
  return `Scope ${resolved.scopeDescriptor.label} is running in ${formatScopeModeLabel(resolved.scopeMode)} mode. Effective ${subject} resolves from ${describeResolvedFromLabel(resolved, activeScopeChain)}. Lineage: ${buildGovernanceLineageTrail(resolved, activeScopeChain)}.`
}

export function describeGovernanceRollbackMessage({
  activeGovernanceScope,
  activeScopeChain,
  hasLocalOverride,
  resolved,
  subject,
}: {
  activeGovernanceScope: WorkspaceMetaScope | null
  activeScopeChain: WorkspaceMetaScope[]
  hasLocalOverride: boolean
  resolved: GovernanceResolvedLineage | null
  subject: GovernanceSubject
}) {
  const scopeLabel = resolved?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'the active scope'
  if (!resolved) {
    return hasLocalOverride
      ? `Reset will archive the local ${subject} override at ${scopeLabel}. Authoritative fallback lineage is still loading.`
      : `${scopeLabel} is already inheriting. Authoritative lineage is still loading.`
  }
  if (!hasLocalOverride) {
    return `${scopeLabel} is already inheriting from ${describeResolvedFromLabel(resolved, activeScopeChain)}.`
  }
  return `Reset will archive the local ${subject} override at ${scopeLabel} and fall back to ${describeRollbackTargetLabel(resolved, activeGovernanceScope, activeScopeChain)}.`
}

const STAGE_EVIDENCE_OPTIONS: ApiStageEvidenceKind[] = ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript']

function LabeledField({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      {children}
      {hint ? <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>{hint}</div> : null}
    </div>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: T.text }}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span style={{ ...mono, fontSize: 10 }}>{label}</span>
    </label>
  )
}

export function SystemAdminHierarchyWorkspaceTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: HierarchyWorkspaceTabOption[]
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div role="tablist" aria-label="Hierarchy workspace sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          id={`university-tab-${tab.id}`}
          role="tab"
          aria-controls={`university-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          data-tab="true"
          onClick={() => onChange(tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 8,
            border: `1px solid ${activeTab === tab.id ? T.accent : T.border}`,
            background: activeTab === tab.id ? `${T.accent}16` : 'transparent',
            color: activeTab === tab.id ? T.accentLight : T.muted,
            cursor: 'pointer',
            padding: '8px 12px',
            ...mono,
            fontSize: 10,
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

type SystemAdminFacultiesWorkspaceProps = {
  data: LiveAdminDataset
  route: LiveAdminRoute
  toneColor: string
  restoreNotice: RestoreNotice
  onResetRestore: () => void
  selectedAcademicFaculty: ApiAcademicFaculty | null
  selectedDepartment: ApiDepartment | null
  selectedBranch: ApiBranch | null
  selectedBatch: ApiBatch | null
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
  batchFacultyPool: ApiFacultyRecord[]
  batchOfferingsWithoutOwner: LiveAdminDataset['offerings']
  batchStudentsWithoutEnrollment: ApiStudentRecord[]
  batchStudentsWithoutMentor: ApiStudentRecord[]
  batchOfferingsWithoutRoster: LiveAdminDataset['offerings']
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
  proofDashboardProps: ComponentProps<typeof SystemAdminProofDashboardWorkspace>
  registryLaunchProps: ComponentProps<typeof SystemAdminScopedRegistryLaunches>
}

export function SystemAdminFacultiesWorkspace({
  data,
  route,
  toneColor,
  restoreNotice,
  onResetRestore,
  selectedAcademicFaculty,
  selectedDepartment,
  selectedBranch,
  selectedBatch,
  selectedSectionCode,
  selectedAcademicFacultyImpact,
  facultyDepartments,
  departmentBranches,
  branchBatches,
  structureForms,
  setStructureForms,
  setEditingEntity,
  handleCreateAcademicFaculty,
  handleCreateDepartment,
  handleCreateBranch,
  handleCreateBatch,
  navigate,
  updateSelectedSectionCode,
  universityTab,
  updateUniversityTab,
  universityTabOptions,
  universityWorkspaceTabCards,
  universityWorkspaceColumns,
  universityLevelTitle,
  universityLevelHelper,
  universityLeftItems,
  universityWorkspaceLabel,
  universityWorkspacePaneRef,
  stickyShadow,
  activeBatchPolicyOverride,
  activeScopeChain,
  activeGovernanceScope,
  resolvedBatchPolicy,
  resolvedStagePolicy,
  activeScopePolicyOverride,
  activeScopeStageOverride,
  policyForm,
  setPolicyForm,
  stagePolicyForm,
  setStagePolicyForm,
  handleSaveScopePolicy,
  handleResetScopePolicy,
  handleSaveScopeStagePolicy,
  handleResetScopeStagePolicy,
  entityEditors,
  setEntityEditors,
  batchTerms,
  currentSemesterTerm,
  startEditingTerm,
  resetTermEditor,
  handleSaveTerm,
  handleArchiveTerm,
  selectedCurriculumSemester,
  setSelectedCurriculumSemester,
  curriculumSemesterEntries,
  activeUniversityRegistryScope,
  activeUniversityStudentScopeChipLabel,
  activeUniversityFacultyScopeChipLabel,
  scopedUniversityStudents,
  filteredUniversityFaculty,
  curriculumFeatureConfig,
  curriculumFeatureItems,
  selectedCurriculumFeatureCourseId,
  setSelectedCurriculumFeatureCourseId,
  selectedCurriculumFeatureItem,
  selectedCurriculumCourseId,
  startEditingCurriculumCourse,
  resetCurriculumEditor,
  handleSaveCurriculumCourse,
  handleArchiveCurriculumCourse,
  handleBootstrapCurriculumManifest,
  scopedCourseLeaderFaculty,
  getScopedCourseLeaderState,
  handleAssignCurriculumCourseLeader,
  batchProvisioningForm,
  setBatchProvisioningForm,
  handleProvisionBatch,
  batchFacultyPool,
  batchOfferingsWithoutOwner,
  batchStudentsWithoutEnrollment,
  batchStudentsWithoutMentor,
  batchOfferingsWithoutRoster,
  curriculumFeatureProfileOptions,
  curriculumFeatureBindingMode,
  setCurriculumFeatureBindingMode,
  curriculumFeaturePinnedProfileId,
  setCurriculumFeaturePinnedProfileId,
  curriculumFeatureTargetMode,
  setCurriculumFeatureTargetMode,
  curriculumFeatureTargetScopeKey,
  setCurriculumFeatureTargetScopeKey,
  curriculumFeatureTargetScopeOptions,
  selectedCurriculumFeatureTargetScope,
  curriculumFeatureAffectedBatchPreview,
  curriculumLinkageGenerationStatus,
  curriculumLinkageCandidatesLoading,
  selectedCurriculumLinkageCandidates,
  curriculumLinkageReviewNote,
  setCurriculumLinkageReviewNote,
  curriculumFeatureForm,
  setCurriculumFeatureForm,
  handleSaveCurriculumFeatureBinding,
  handleRegenerateCurriculumLinkageCandidates,
  handleApproveCurriculumLinkageCandidate,
  handleRejectCurriculumLinkageCandidate,
  handleSaveCurriculumFeatureConfig,
  proofDashboardProps,
  registryLaunchProps,
}: SystemAdminFacultiesWorkspaceProps) {
  void [route, activeUniversityRegistryScope, activeUniversityStudentScopeChipLabel, activeUniversityFacultyScopeChipLabel, scopedUniversityStudents, filteredUniversityFaculty]

  const selectorControls = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Faculty</div>
        <select
          value={selectedAcademicFaculty?.academicFacultyId ?? ''}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({ section: 'faculties', academicFacultyId: event.target.value || undefined })
          }}
          style={{ width: '100%' }}
        >
          <option value="">All Academic Faculties</option>
          {selectedAcademicFaculty && selectedAcademicFaculty.status !== 'deleted' && selectedAcademicFaculty.status !== 'hidden' && selectedAcademicFaculty.status !== 'archived' ? null : null}
          {selectedAcademicFaculty && !facultyDepartments.some(item => item.academicFacultyId === selectedAcademicFaculty.academicFacultyId) ? (
            <option value={selectedAcademicFaculty.academicFacultyId}>{selectedAcademicFaculty.name} ({selectedAcademicFaculty.status})</option>
          ) : null}
          {data.academicFaculties.filter(item => item.status !== 'deleted' && item.status !== 'hidden').map(faculty => <option key={faculty.academicFacultyId} value={faculty.academicFacultyId}>{faculty.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department</div>
        <select
          value={selectedDepartment?.departmentId ?? ''}
          disabled={!selectedAcademicFaculty}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: event.target.value || undefined,
            })
          }}
          style={{ width: '100%' }}
        >
          <option value="">{selectedAcademicFaculty ? 'Select Department' : 'Pick Faculty First'}</option>
          {facultyDepartments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch</div>
        <select
          value={selectedBranch?.branchId ?? ''}
          disabled={!selectedDepartment}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: selectedDepartment?.departmentId,
              branchId: event.target.value || undefined,
            })
          }}
          style={{ width: '100%' }}
        >
          <option value="">{selectedDepartment ? 'Select Branch' : 'Pick Department First'}</option>
          {departmentBranches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Year</div>
        <select
          value={selectedBatch?.batchId ?? ''}
          disabled={!selectedBranch}
          onChange={event => {
            updateSelectedSectionCode(null, { recordHistory: false })
            navigate({
              section: 'faculties',
              academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
              departmentId: selectedDepartment?.departmentId,
              branchId: selectedBranch?.branchId,
              batchId: event.target.value || undefined,
            })
          }}
          style={{ width: '100%' }}
        >
          <option value="">{selectedBranch ? 'Select Year' : 'Pick Branch First'}</option>
          {branchBatches.map(batch => <option key={batch.batchId} value={batch.batchId}>{deriveCurrentYearLabel(batch.currentSemester)} · {batch.batchLabel}</option>)}
        </select>
      </div>
      <div>
        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Section</div>
        <select
          value={selectedSectionCode ?? ''}
          disabled={!selectedBatch}
          onChange={event => updateSelectedSectionCode(event.target.value || null)}
          style={{ width: '100%' }}
        >
          <option value="">{selectedBatch ? 'All Sections' : 'Pick Year First'}</option>
          {selectedBatch ? data.students.filter(item => item.activeAcademicContext?.batchId === selectedBatch.batchId).map(item => item.activeAcademicContext?.sectionCode).filter((item): item is string => Boolean(item)).filter((item, index, list) => list.indexOf(item) === index).map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>) : null}
        </select>
      </div>
    </div>
  )

  const entityRailItems = universityLeftItems.map(item => (
    <button key={item.key} type="button" onClick={item.onSelect} data-pressable="true" style={{ textAlign: 'left', justifyContent: 'flex-start', display: 'grid', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
      <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.title}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{item.subtitle}</div>
    </button>
  ))

  const workspaceMeta = (
    <>
      {selectedBranch ? <Chip color={T.success}>{selectedBranch.programLevel}</Chip> : null}
      {selectedBatch ? <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Override active' : 'Inherited policy'}</Chip> : null}
    </>
  )

  const overviewNavigator = universityTab === 'overview' ? (
    <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 10 }}>
      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Hierarchy Navigator · {selectedSectionCode ? 'Section' : universityLevelTitle}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        {universityLevelHelper}
      </div>
      {selectedBatch ? (
        <Card style={{ padding: 14, background: T.surface }}>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {selectedSectionCode
              ? 'No further hierarchy level exists below section. Use the tabs above or jump into the scoped student or faculty pages below.'
              : 'The next-level cards appear here as soon as the current level on the left is selected.'}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {branchBatches.length === 0 ? (
            <Card style={{ padding: 14, background: T.surface }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                The next-level cards appear here as soon as the current level on the left is selected.
              </div>
            </Card>
          ) : branchBatches.map(batch => (
            <button key={batch.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch?.branchId, batchId: batch.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{`Batch ${batch.batchLabel} · sections ${batch.sectionLabels.join(', ')}`}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  ) : null

  const yearEditors = universityTab === 'overview' && selectedBatch && universityWorkspaceTabCards.length > 0 ? (
    <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
      <div>
        <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Year Editors</div>
        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
          These cards open the exact edit surface for the selected year, so you land on the real controls instead of hunting through the overview.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {universityWorkspaceTabCards.map(tab => (
          <button
            key={`workspace:${tab.id}`}
            type="button"
            data-pressable="true"
            onClick={() => updateUniversityTab(tab.id)}
            style={{
              textAlign: 'left',
              borderRadius: 14,
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: '14px 16px',
              display: 'grid',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}>
              {tab.icon}
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{tab.label}</div>
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{tab.description}</div>
            <div style={{ ...mono, fontSize: 10, color: T.accentLight, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open Editor</div>
          </button>
        ))}
      </div>
    </Card>
  ) : null

  const selectedCurriculumFeatureTargetScopeChip = selectedCurriculumFeatureTargetScope
    ? `${formatScopeTypeLabel(selectedCurriculumFeatureTargetScope.scopeType)} · ${selectedCurriculumFeatureTargetScope.label}`
    : null
  const selectedCurriculumSemesterEntry = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === selectedCurriculumSemester) ?? null
  const selectedCurriculumSemesterCourses = selectedCurriculumSemesterEntry?.courses ?? []
  const policyScopeChipLabel = resolvedBatchPolicy?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'Institution defaults'
  const stagePolicyScopeChipLabel = resolvedStagePolicy?.scopeDescriptor.label ?? activeGovernanceScope?.label ?? 'Institution defaults'
  const policyResolvedFromChipLabel = describeResolvedFromLabel(resolvedBatchPolicy, activeScopeChain)
  const stagePolicyResolvedFromChipLabel = describeResolvedFromLabel(resolvedStagePolicy, activeScopeChain)
  const policyStatusChips = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? 'Local override active' : 'Inherited policy'}</Chip>
      <Chip color={T.accent}>{`Scope ${policyScopeChipLabel}`}</Chip>
      <Chip color={T.warning}>{`Resolved from ${policyResolvedFromChipLabel}`}</Chip>
      <Chip color={T.success}>{`${formatScopeModeLabel(resolvedBatchPolicy?.scopeMode ?? activeGovernanceScope?.scopeType ?? 'institution')} mode`}</Chip>
    </div>
  )
  const stagePolicyStatusChips = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip color={activeScopeStageOverride ? T.orange : T.dim}>{activeScopeStageOverride ? 'Local stage override active' : 'Inherited stage policy'}</Chip>
      <Chip color={T.accent}>{`Scope ${stagePolicyScopeChipLabel}`}</Chip>
      <Chip color={T.warning}>{`Resolved from ${stagePolicyResolvedFromChipLabel}`}</Chip>
      <Chip color={T.success}>{`${formatScopeModeLabel(resolvedStagePolicy?.scopeMode ?? activeGovernanceScope?.scopeType ?? 'institution')} mode`}</Chip>
    </div>
  )
  const policyLineageNotices = (
    <>
      <InfoBanner message={describeGovernanceResolutionMessage({
        activeGovernanceScope,
        activeScopeChain,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      })}
      />
      <InfoBanner message={describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: !!activeScopePolicyOverride,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      })}
      />
    </>
  )
  const stagePolicyLineageNotices = (
    <>
      <InfoBanner message={describeGovernanceResolutionMessage({
        activeGovernanceScope,
        activeScopeChain,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      })}
      />
      <InfoBanner message={describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: !!activeScopeStageOverride,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      })}
      />
    </>
  )
  const policyActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Btn type="button" onClick={() => void handleSaveScopePolicy()}>Save Scope Governance</Btn>
      <Btn type="button" variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset To Inherited Policy</Btn>
    </div>
  )
  const stagePolicyActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Btn type="button" onClick={() => void handleSaveScopeStagePolicy()}>Save Stage Policy</Btn>
      <Btn type="button" variant="ghost" onClick={() => void handleResetScopeStagePolicy()}>Reset To Inherited Stage Policy</Btn>
    </div>
  )
  const governanceBandsPanel = selectedBatch && universityTab === 'bands' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Academic Bands" eyebrow="Evaluation" caption={`Resolved grade bands for ${activeGovernanceScope?.label ?? 'the active scope'}. Save here to create or update the local override at this exact scope.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <LabeledField label="O minimum"><TextInput value={policyForm.oMin} onChange={event => setPolicyForm(prev => ({ ...prev, oMin: event.target.value }))} /></LabeledField>
        <LabeledField label="A+ minimum"><TextInput value={policyForm.aPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, aPlusMin: event.target.value }))} /></LabeledField>
        <LabeledField label="A minimum"><TextInput value={policyForm.aMin} onChange={event => setPolicyForm(prev => ({ ...prev, aMin: event.target.value }))} /></LabeledField>
        <LabeledField label="B+ minimum"><TextInput value={policyForm.bPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, bPlusMin: event.target.value }))} /></LabeledField>
        <LabeledField label="B minimum"><TextInput value={policyForm.bMin} onChange={event => setPolicyForm(prev => ({ ...prev, bMin: event.target.value }))} /></LabeledField>
        <LabeledField label="C minimum"><TextInput value={policyForm.cMin} onChange={event => setPolicyForm(prev => ({ ...prev, cMin: event.target.value }))} /></LabeledField>
        <LabeledField label="P minimum"><TextInput value={policyForm.pMin} onChange={event => setPolicyForm(prev => ({ ...prev, pMin: event.target.value }))} /></LabeledField>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
        Grade bands descend from O to P. Validation happens on save and will reject any upward gaps or invalid thresholds.
      </div>
      {policyActions}
    </Card>
  ) : null
  const governanceCeSeePanel = selectedBatch && universityTab === 'ce-see' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="CE / SEE Split" eyebrow="Assessment" caption={`Configure the CE/SEE split, component caps, attendance, condonation, and working calendar at ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <LabeledField label="CE"><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></LabeledField>
        <LabeledField label="SEE"><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></LabeledField>
        <LabeledField label="Term test weight"><TextInput value={policyForm.termTestsWeight} onChange={event => setPolicyForm(prev => ({ ...prev, termTestsWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Quiz weight"><TextInput value={policyForm.quizWeight} onChange={event => setPolicyForm(prev => ({ ...prev, quizWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Assignment weight"><TextInput value={policyForm.assignmentWeight} onChange={event => setPolicyForm(prev => ({ ...prev, assignmentWeight: event.target.value }))} /></LabeledField>
        <LabeledField label="Max term tests"><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></LabeledField>
        <LabeledField label="Max quizzes"><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></LabeledField>
        <LabeledField label="Max assignments"><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></LabeledField>
      </div>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Working Calendar</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Day start"><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></LabeledField>
          <LabeledField label="Day end"><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></LabeledField>
          <LabeledField label="Coursework weeks"><TextInput value={policyForm.courseworkWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, courseworkWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="Exam prep weeks"><TextInput value={policyForm.examPreparationWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, examPreparationWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="SEE weeks"><TextInput value={policyForm.seeWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, seeWeeks: event.target.value }))} /></LabeledField>
          <LabeledField label="Total weeks"><TextInput value={policyForm.totalWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, totalWeeks: event.target.value }))} /></LabeledField>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map(day => (
            <ToggleField
              key={day}
              label={day}
              checked={policyForm.workingDays.includes(day)}
              onChange={checked => setPolicyForm(prev => ({
                ...prev,
                workingDays: checked
                  ? prev.workingDays.includes(day) ? prev.workingDays : [...prev.workingDays, day]
                  : prev.workingDays.filter(item => item !== day),
              }))}
            />
          ))}
        </div>
      </Card>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Attendance And Eligibility</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Minimum attendance %"><TextInput value={policyForm.minimumAttendancePercent} onChange={event => setPolicyForm(prev => ({ ...prev, minimumAttendancePercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Condonation floor %"><TextInput value={policyForm.condonationFloorPercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationFloorPercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Condonation shortage %"><TextInput value={policyForm.condonationShortagePercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationShortagePercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Minimum CE for SEE"><TextInput value={policyForm.minimumCeForSeeEligibility} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeForSeeEligibility: event.target.value }))} /></LabeledField>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ToggleField label="Condonation requires approval" checked={policyForm.condonationRequiresApproval} onChange={checked => setPolicyForm(prev => ({ ...prev, condonationRequiresApproval: checked }))} />
          <ToggleField label="Allow condonation for SEE eligibility" checked={policyForm.allowCondonationForSeeEligibility} onChange={checked => setPolicyForm(prev => ({ ...prev, allowCondonationForSeeEligibility: checked }))} />
        </div>
      </Card>
      {policyActions}
    </Card>
  ) : null
  const governanceCgpaPanel = selectedBatch && universityTab === 'cgpa' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="CGPA And Progression" eyebrow="Rules" caption={`Configure pass thresholds, rounding, repeat handling, progression, and risk thresholds for ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {policyStatusChips}
      {policyLineageNotices}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <LabeledField label="Minimum CE mark"><TextInput value={policyForm.minimumCeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeMark: event.target.value }))} /></LabeledField>
        <LabeledField label="Minimum SEE mark"><TextInput value={policyForm.minimumSeeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumSeeMark: event.target.value }))} /></LabeledField>
        <LabeledField label="Minimum overall mark"><TextInput value={policyForm.minimumOverallMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumOverallMark: event.target.value }))} /></LabeledField>
        <LabeledField label="SGPA / CGPA decimals"><TextInput value={policyForm.sgpaCgpaDecimals} onChange={event => setPolicyForm(prev => ({ ...prev, sgpaCgpaDecimals: event.target.value }))} /></LabeledField>
        <LabeledField label="Repeat-course policy">
          <select value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))} style={{ width: '100%' }}>
            <option value="latest-attempt">Latest attempt</option>
            <option value="best-attempt">Best attempt</option>
          </select>
        </LabeledField>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ToggleField label="Apply rounding before status determination" checked={policyForm.applyBeforeStatusDetermination} onChange={checked => setPolicyForm(prev => ({ ...prev, applyBeforeStatusDetermination: checked }))} />
      </div>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Progression</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Pass mark %"><TextInput value={policyForm.passMarkPercent} onChange={event => setPolicyForm(prev => ({ ...prev, passMarkPercent: event.target.value }))} /></LabeledField>
          <LabeledField label="Minimum CGPA"><TextInput value={policyForm.minimumCgpaForPromotion} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCgpaForPromotion: event.target.value }))} /></LabeledField>
        </div>
        <ToggleField label="Require no active backlogs" checked={policyForm.requireNoActiveBacklogs} onChange={checked => setPolicyForm(prev => ({ ...prev, requireNoActiveBacklogs: checked }))} />
      </Card>
      <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Risk Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="High-risk attendance below"><TextInput value={policyForm.highRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskAttendancePercentBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk attendance below"><TextInput value={policyForm.mediumRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskAttendancePercentBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="High-risk CGPA below"><TextInput value={policyForm.highRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskCgpaBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk CGPA below"><TextInput value={policyForm.mediumRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskCgpaBelow: event.target.value }))} /></LabeledField>
          <LabeledField label="High-risk backlog count"><TextInput value={policyForm.highRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskBacklogCount: event.target.value }))} /></LabeledField>
          <LabeledField label="Medium-risk backlog count"><TextInput value={policyForm.mediumRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskBacklogCount: event.target.value }))} /></LabeledField>
        </div>
      </Card>
      {policyActions}
    </Card>
  ) : null
  const stagePolicyPanel = selectedBatch && universityTab === 'stage' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Stage Policy" eyebrow="Lifecycle" caption={`Configure inherited class-stage gates at ${activeGovernanceScope?.label ?? 'the active scope'}.`} />
      {stagePolicyStatusChips}
      {stagePolicyLineageNotices}
      <div style={{ display: 'grid', gap: 12 }}>
        {stagePolicyForm.stages.map((stage, index) => (
          <Card key={stage.key} style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{stage.label || `Stage ${index + 1}`}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{stage.key}</div>
              </div>
              <Chip color={T.accent}>{`Offset day ${stage.semesterDayOffset}`}</Chip>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Label"><TextInput value={stage.label} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></LabeledField>
              <LabeledField label="Semester day offset"><TextInput value={stage.semesterDayOffset} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, semesterDayOffset: event.target.value } : item) }))} /></LabeledField>
              <LabeledField label="Advancement mode">
                <select value={stage.advancementMode} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, advancementMode: event.target.value as StagePolicyFormState['stages'][number]['advancementMode'] } : item) }))} style={{ width: '100%' }}>
                  <option value="admin-confirmed">Admin confirmed</option>
                  <option value="automatic">Automatic</option>
                </select>
              </LabeledField>
              <LabeledField label="Color"><TextInput value={stage.color} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item) }))} /></LabeledField>
            </div>
            <LabeledField label="Description"><TextAreaInput value={stage.description} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} rows={3} /></LabeledField>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Required evidence</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {STAGE_EVIDENCE_OPTIONS.map(option => (
                  <ToggleField
                    key={`${stage.key}:${option}`}
                    label={option}
                    checked={stage.requiredEvidence.includes(option)}
                    onChange={checked => setStagePolicyForm(prev => ({
                      ...prev,
                      stages: prev.stages.map((item, itemIndex) => itemIndex === index ? {
                        ...item,
                        requiredEvidence: checked
                          ? item.requiredEvidence.includes(option) ? item.requiredEvidence : [...item.requiredEvidence, option]
                          : item.requiredEvidence.filter(evidence => evidence !== option),
                      } : item),
                    }))}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ToggleField label="Require queue clearance" checked={stage.requireQueueClearance} onChange={checked => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireQueueClearance: checked } : item) }))} />
              <ToggleField label="Require task clearance" checked={stage.requireTaskClearance} onChange={checked => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireTaskClearance: checked } : item) }))} />
            </div>
          </Card>
        ))}
      </div>
      {stagePolicyActions}
    </Card>
  ) : null
  const coursesPanel = selectedBranch && universityTab === 'courses' ? (
    selectedBatch ? (
      <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
        <SectionHeading title="Terms, Curriculum, And Course Leaders" eyebrow="Courses" caption={`Operate semester navigation, curriculum rows, and course-leader ownership directly for Batch ${selectedBatch.batchLabel}${selectedSectionCode ? ` · Section ${selectedSectionCode}` : ''}.`} />
        <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Academic Terms</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>Semester navigation is now owned here instead of relying on the legacy shell.</div>
            </div>
            {currentSemesterTerm ? <Chip color={T.success}>{`Current sem term · ${currentSemesterTerm.academicYearLabel}`}</Chip> : <Chip color={T.warning}>No term mapped to current semester</Chip>}
          </div>
          {batchTerms.length === 0 ? <EmptyState title="No academic terms yet" body="Create the first semester term here before provisioning or assigning course leaders." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {batchTerms.map(term => (
                <Card key={term.termId} style={{ padding: 12, background: T.surface, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${term.academicYearLabel} · Semester ${term.semesterNumber}`}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{`${term.startDate} to ${term.endDate}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingTerm(term.termId)}>Edit Term</Btn>
                    <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveTerm(term.termId)}>Archive</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <form onSubmit={handleSaveTerm} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{entityEditors.term.termId ? 'Edit Term' : 'Add Term'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Academic year"><TextInput value={entityEditors.term.academicYearLabel} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, academicYearLabel: event.target.value } }))} /></LabeledField>
              <LabeledField label="Semester number"><TextInput value={entityEditors.term.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, semesterNumber: event.target.value } }))} /></LabeledField>
              <LabeledField label="Start date"><TextInput value={entityEditors.term.startDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, startDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></LabeledField>
              <LabeledField label="End date"><TextInput value={entityEditors.term.endDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, endDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></LabeledField>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn type="submit">{entityEditors.term.termId ? 'Save Term' : 'Create Term'}</Btn>
              <Btn type="button" variant="ghost" onClick={resetTermEditor}>Clear Editor</Btn>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Curriculum Rows</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>Semester-wise curriculum editing and course-leader assignment now live in the extracted workspace.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <LabeledField label="Semester">
                <select value={selectedCurriculumSemester} onChange={event => setSelectedCurriculumSemester(event.target.value)} style={{ width: 160 }}>
                  {curriculumSemesterEntries.map(entry => (
                    <option key={entry.semesterNumber} value={String(entry.semesterNumber)}>
                      {`Semester ${entry.semesterNumber}`}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <Btn type="button" variant="ghost" onClick={() => void handleBootstrapCurriculumManifest()}>Bootstrap From Manifest</Btn>
            </div>
          </div>
          {selectedCurriculumSemesterCourses.length === 0 ? <EmptyState title="No curriculum rows for this semester" body="Create the first course row below or bootstrap the governed manifest into this batch." /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {selectedCurriculumSemesterCourses.map(course => {
                const leaderState = getScopedCourseLeaderState(course.curriculumCourseId)
                return (
                  <Card key={course.curriculumCourseId} style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${course.courseCode} · ${course.title}`}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{`${course.credits} credits · ${leaderState.matchingOfferings.length} live offering${leaderState.matchingOfferings.length === 1 ? '' : 's'}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingCurriculumCourse(course.curriculumCourseId)}>Edit</Btn>
                        <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveCurriculumCourse(course.curriculumCourseId)}>Archive</Btn>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px)', gap: 10 }}>
                      <LabeledField label="Course leader" hint={leaderState.hasMultipleLeaders ? 'Multiple leader-like ownerships exist across the matching live offerings.' : undefined}>
                        <select value={leaderState.selectedFacultyId} onChange={event => void handleAssignCurriculumCourseLeader(course.curriculumCourseId, event.target.value)} style={{ width: '100%' }}>
                          <option value="">Clear leader assignment</option>
                          {scopedCourseLeaderFaculty.map(faculty => (
                            <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.displayName}</option>
                          ))}
                        </select>
                      </LabeledField>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {leaderState.leaderIds.length === 0 ? <Chip color={T.warning}>No leader assigned</Chip> : leaderState.leaderIds.map(facultyId => {
                        const faculty = scopedCourseLeaderFaculty.find(item => item.facultyId === facultyId)
                        return <Chip key={`${course.curriculumCourseId}:${facultyId}`} color={leaderState.hasMultipleLeaders ? T.warning : T.success}>{faculty?.displayName ?? facultyId}</Chip>
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
          <form onSubmit={handleSaveCurriculumCourse} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{entityEditors.curriculum.curriculumCourseId ? 'Edit Curriculum Row' : 'Add Curriculum Row'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <LabeledField label="Semester number"><TextInput value={entityEditors.curriculum.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, semesterNumber: event.target.value } }))} /></LabeledField>
              <LabeledField label="Course code"><TextInput value={entityEditors.curriculum.courseCode} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, courseCode: event.target.value } }))} /></LabeledField>
              <LabeledField label="Course title"><TextInput value={entityEditors.curriculum.title} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, title: event.target.value } }))} /></LabeledField>
              <LabeledField label="Credits"><TextInput value={entityEditors.curriculum.credits} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, credits: event.target.value } }))} /></LabeledField>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn type="submit">{entityEditors.curriculum.curriculumCourseId ? 'Save Curriculum Row' : 'Create Curriculum Row'}</Btn>
              <Btn type="button" variant="ghost" onClick={resetCurriculumEditor}>Clear Editor</Btn>
              <Chip color={selectedCurriculumCourseId ? T.accent : T.dim}>{selectedCurriculumCourseId ? `Selected row ${selectedCurriculumCourseId}` : 'No row selected'}</Chip>
            </div>
          </form>
        </Card>
      </Card>
    ) : (
      <EmptyState title="Select a year first" body="Terms and curriculum editing unlock once a batch is selected within the chosen branch." />
    )
  ) : null
  const provisionPanel = selectedBatch && universityTab === 'provision' ? (
    <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
      <SectionHeading title="Provisioning" eyebrow="Operations" caption={`Launch deterministic student, mentor, ownership, and scaffolding generation for Batch ${selectedBatch.batchLabel}${selectedSectionCode ? ` · Section ${selectedSectionCode}` : ''}.`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
        <AdminMiniStat label="Faculty In Scope" value={String(batchFacultyPool.length)} tone={T.accent} />
        <AdminMiniStat label="Offerings Without Owner" value={String(batchOfferingsWithoutOwner.length)} tone={batchOfferingsWithoutOwner.length ? T.warning : T.success} />
        <AdminMiniStat label="Students Without Enrollment" value={String(batchStudentsWithoutEnrollment.length)} tone={batchStudentsWithoutEnrollment.length ? T.warning : T.success} />
        <AdminMiniStat label="Students Without Mentor" value={String(batchStudentsWithoutMentor.length)} tone={batchStudentsWithoutMentor.length ? T.warning : T.success} />
        <AdminMiniStat label="Offerings Without Roster" value={String(batchOfferingsWithoutRoster.length)} tone={batchOfferingsWithoutRoster.length ? T.warning : T.success} />
      </div>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={event => { event.preventDefault(); void handleProvisionBatch() }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <LabeledField label="Provisioning term">
            <select value={batchProvisioningForm.termId} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, termId: event.target.value }))} style={{ width: '100%' }}>
              <option value="">{currentSemesterTerm ? 'Use current semester term' : 'Select term'}</option>
              {batchTerms.map(term => (
                <option key={term.termId} value={term.termId}>{`${term.academicYearLabel} · Semester ${term.semesterNumber}`}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Mode">
            <select value={batchProvisioningForm.mode} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, mode: event.target.value as BatchProvisioningFormState['mode'] }))} style={{ width: '100%' }}>
              <option value="mock">Mock</option>
              <option value="live">Live</option>
            </select>
          </LabeledField>
          <LabeledField label="Sections"><TextInput value={batchProvisioningForm.sectionLabels} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, sectionLabels: event.target.value }))} placeholder="A, B" /></LabeledField>
          <LabeledField label="Students per section"><TextInput value={batchProvisioningForm.studentsPerSection} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, studentsPerSection: event.target.value }))} /></LabeledField>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ToggleField label="Create students" checked={batchProvisioningForm.createStudents} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createStudents: checked }))} />
          <ToggleField label="Create mentors" checked={batchProvisioningForm.createMentors} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createMentors: checked }))} />
          <ToggleField label="Create attendance scaffolding" checked={batchProvisioningForm.createAttendanceScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createAttendanceScaffolding: checked }))} />
          <ToggleField label="Create assessment scaffolding" checked={batchProvisioningForm.createAssessmentScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createAssessmentScaffolding: checked }))} />
          <ToggleField label="Create transcript scaffolding" checked={batchProvisioningForm.createTranscriptScaffolding} onChange={checked => setBatchProvisioningForm(prev => ({ ...prev, createTranscriptScaffolding: checked }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn type="submit">Run Provisioning</Btn>
          {currentSemesterTerm ? <Chip color={T.success}>{`Current semester term ${currentSemesterTerm.academicYearLabel}`}</Chip> : <Chip color={T.warning}>Add a term before running provisioning</Chip>}
        </div>
      </form>
    </Card>
  ) : null

  return (
    <SystemAdminHierarchyWorkspaceShell
      toneColor={toneColor}
      restoreNotice={restoreNotice}
      onResetRestore={onResetRestore}
      selectorControls={selectorControls}
      selectorHelperText="Search narrows automatically to the active selector scope. `Year` is a UI alias for the canonical batch record beneath it."
      workspaceColumns={universityWorkspaceColumns}
      entityRailTitle={universityLevelTitle}
      entityRailHelper={universityLevelHelper}
      entityRailCount={universityLeftItems.length}
      entityRailItems={entityRailItems}
      entityRailEmptyTitle={`No ${universityLevelTitle.toLowerCase()} yet`}
      entityRailEmptyBody="Use the forms on the right to create the first record in this scope."
      entityRailCreateForm={!selectedAcademicFaculty ? (
        <form onSubmit={handleCreateAcademicFaculty} style={{ display: 'grid', gap: 8, marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} color={T.accent} />
            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Academic Faculty</div>
          </div>
          <TextInput value={structureForms.academicFaculty.code} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" />
          <TextInput value={structureForms.academicFaculty.name} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" />
          <TextAreaInput value={structureForms.academicFaculty.overview} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} placeholder="Overview" rows={2} />
          <Btn type="submit">Add Faculty</Btn>
        </form>
      ) : null}
      workspacePaneRef={universityWorkspacePaneRef}
      stickyShadow={stickyShadow}
      workspaceLabel={universityWorkspaceLabel}
      workspaceHelperText={selectedBatch
        ? 'Use the editor cards below or the sticky tabs here to jump straight into the exact year-level control surface.'
        : 'This area behaves as a scoped navigator plus metadata surface until a year is selected.'}
      workspaceMeta={workspaceMeta}
      tabActions={<SystemAdminHierarchyWorkspaceTabs tabs={universityTabOptions} activeTab={universityTab} onChange={tabId => updateUniversityTab(tabId)} />}
      workspacePanelId={`university-panel-${universityTab}`}
      workspacePanelLabelledBy={`university-tab-${universityTab}`}
      overviewNavigator={overviewNavigator}
      yearEditors={yearEditors}
    >
      {!selectedAcademicFaculty ? (
        <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select an academic faculty in the tree to begin, or create one below." />
      ) : null}

      {selectedAcademicFaculty && !selectedDepartment && (
        <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
          <SectionHeading
            title={selectedAcademicFaculty.name}
            eyebrow="Academic Faculty"
            caption={selectedAcademicFaculty.status === 'archived'
              ? 'This faculty is archived. Restore it to bring its departments and linked workspace scope back into the main admin views.'
              : 'Edit the faculty record, then add or organize departments underneath it.'}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Chip color={T.accent}>{selectedAcademicFaculty.code}</Chip>
            <Chip color={T.success}>{facultyDepartments.length} departments</Chip>
            <Chip color={selectedAcademicFaculty.status === 'archived' ? T.warning : T.success}>{selectedAcademicFaculty.status}</Chip>
          </div>
          {selectedAcademicFacultyImpact ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginTop: 16 }}>
              <AdminMiniStat label="Departments" value={String(selectedAcademicFacultyImpact.departments)} tone={T.accent} />
              <AdminMiniStat label="Branches" value={String(selectedAcademicFacultyImpact.branches)} tone={T.success} />
              <AdminMiniStat label="Years" value={String(selectedAcademicFacultyImpact.batches)} tone={T.warning} />
              <AdminMiniStat label="Students" value={String(selectedAcademicFacultyImpact.students)} tone={T.orange} />
              <AdminMiniStat label="Faculty" value={String(selectedAcademicFacultyImpact.facultyMembers)} tone={T.orange} />
              <AdminMiniStat label="Courses" value={String(selectedAcademicFacultyImpact.courses)} tone={T.orange} />
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overview</div>
            <Card style={{ padding: 14, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.9 }}>
                {selectedAcademicFaculty.overview?.trim() || 'No faculty overview has been added yet.'}
              </div>
            </Card>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" size="sm" onClick={() => setEditingEntity('academic-faculty' as never)}>Edit Faculty</Btn>
          </div>
          {selectedAcademicFaculty.status === 'archived' ? null : facultyDepartments.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Departments</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {facultyDepartments.map(department => {
                  const previewBranches = data.branches.filter(branch => branch.departmentId === department.departmentId && branch.status !== 'deleted').sort((left, right) => left.name.localeCompare(right.name))
                  return (
                    <Card key={department.departmentId} style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{department.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{department.code} · {previewBranches.length} branches</div>
                        </div>
                        <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId })}>Open</Btn>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {previewBranches.slice(0, 4).map(branch => (
                          <button
                            key={branch.branchId}
                            type="button"
                            data-pressable="true"
                            onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId, branchId: branch.branchId })}
                            style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                          >
                            {branch.name}
                          </button>
                        ))}
                        {previewBranches.length > 4 ? <Chip color={T.dim}>+{previewBranches.length - 4} more</Chip> : null}
                        {previewBranches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No branches yet.</span> : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : null}
          {selectedAcademicFaculty.status === 'archived' ? null : (
            <form onSubmit={handleCreateDepartment} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
              <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department Code</div><TextInput value={structureForms.department.code} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" /></div>
              <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Department Name</div><TextInput value={structureForms.department.name} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" /></div>
              <Btn type="submit">Add Department</Btn>
            </form>
          )}
        </Card>
      )}

      {selectedDepartment && !selectedBranch && (
        <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
          <SectionHeading title={selectedDepartment.name} eyebrow="Department" caption="Edit the department record, then create or reorganize the branches it owns." />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Chip color={T.accent}>{selectedDepartment.code}</Chip>
            <Chip color={T.success}>{departmentBranches.length} branches</Chip>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" size="sm" onClick={() => setEditingEntity('department' as never)}>Edit Department</Btn>
          </div>
          {departmentBranches.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Branches</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {departmentBranches.map(branch => {
                  const previewBatches = data.batches.filter(batch => batch.branchId === branch.branchId && batch.status !== 'deleted').sort((left, right) => left.admissionYear - right.admissionYear)
                  return (
                    <Card key={branch.branchId} style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{branch.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{branch.code} · {branch.programLevel} · {previewBatches.length} years</div>
                        </div>
                        <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId })}>Open</Btn>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {previewBatches.slice(0, 4).map(batch => (
                          <button
                            key={batch.batchId}
                            type="button"
                            data-pressable="true"
                            onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId, batchId: batch.batchId })}
                            style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                          >
                            {deriveCurrentYearLabel(batch.currentSemester)}
                          </button>
                        ))}
                        {previewBatches.length > 4 ? <Chip color={T.dim}>+{previewBatches.length - 4} more</Chip> : null}
                        {previewBatches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No years yet.</span> : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : null}
          <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Branch</div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch Code</div><TextInput value={structureForms.branch.code} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} placeholder="CSE-AI" /></div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Branch Name</div><TextInput value={structureForms.branch.name} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} placeholder="AI and Data Science" /></div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Program Level</div><TextInput value={structureForms.branch.programLevel} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))} placeholder="UG" /></div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Semester Count</div><TextInput value={structureForms.branch.semesterCount} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} placeholder="8" /></div>
            <Btn type="submit">Add Branch</Btn>
          </form>
        </Card>
      )}

      {selectedBranch && !selectedBatch && (
        <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
          <SectionHeading title={selectedBranch.name} eyebrow="Branch" caption="Edit core branch metadata, then add or maintain the batch versions that inherit from it." />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Chip color={T.accent}>{selectedBranch.code}</Chip>
            <Chip color={T.warning}>{selectedBranch.programLevel}</Chip>
            <Chip color={T.success}>{branchBatches.length} batches</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
            {selectedBranch.semesterCount} semesters configured in this branch. Use the edit dialog for branch metadata or jump directly into a year below.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" size="sm" onClick={() => setEditingEntity('branch' as never)}>Edit Branch</Btn>
          </div>
          {branchBatches.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Years</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {branchBatches.map(batch => (
                  <Card key={batch.batchId} style={{ padding: 14, background: T.surface2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sem {batch.currentSemester}</div>
                      </div>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })}>Open</Btn>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {batch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
          <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Admission Year</div><TextInput value={structureForms.batch.admissionYear} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value, batchLabel: event.target.value } }))} placeholder="2022" /></div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Active Semester</div><TextInput value={structureForms.batch.currentSemester} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} placeholder="5" /></div>
            <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Section Labels</div><TextInput value={structureForms.batch.sectionLabels} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" /></div>
            <Btn type="submit">Add Batch</Btn>
          </form>
        </Card>
      )}

      {selectedBatch && universityTab === 'overview' && (
        <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Chip color={T.success}>Batch {selectedBatch.batchLabel}</Chip>
            <Chip color={T.accent}>Sem {selectedBatch.currentSemester}</Chip>
            <Chip color={T.warning}>{deriveCurrentYearLabel(selectedBatch.currentSemester)}</Chip>
            <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Local Policy Override' : 'Inherited Policy'}</Chip>
          </div>

          <SectionHeading title="Batch Configuration" eyebrow="Settings" caption="Edit the batch identity, active semester, and sections before adjusting policy, terms, or curriculum." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <Card style={{ padding: 14, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission Year</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedBatch.admissionYear}</div>
            </Card>
            <Card style={{ padding: 14, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Semester</div>
              <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedBatch.currentSemester}</div>
            </Card>
            <Card style={{ padding: 14, background: T.surface2 }}>
              <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sections</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {selectedBatch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
              </div>
            </Card>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" size="sm" onClick={() => setEditingEntity('batch' as never)}>Edit Batch</Btn>
          </div>

          <InfoBanner message={describeGovernanceResolutionMessage({
            activeGovernanceScope,
            activeScopeChain,
            resolved: resolvedBatchPolicy,
            subject: 'policy',
          })}
          />

          <SystemAdminProofDashboardWorkspace {...proofDashboardProps} />

          <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
            <SectionHeading title="Curriculum Model Inputs" eyebrow="Curriculum" caption="Manage course outcomes, prerequisite edges, bridge modules, and topic partitions through batch-local overrides or shared scope profiles that feed retraining and world generation." />
            {curriculumFeatureItems.length === 0 ? (
              <EmptyState title="No model input bundle yet" body="Save at least one curriculum row first. The sysadmin editor will then project those rows into the proof curriculum snapshot." />
            ) : (
              <>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Course</div>
                      <select
                        value={selectedCurriculumFeatureCourseId}
                        onChange={event => {
                          const nextId = event.target.value
                          setSelectedCurriculumFeatureCourseId(nextId)
                        }}
                        style={{ width: '100%' }}
                      >
                        {curriculumFeatureItems.map(item => (
                          <option key={item.curriculumCourseId} value={item.curriculumCourseId}>
                            {`Sem ${item.semesterNumber} · ${item.courseCode} · ${item.title}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resolved Snapshot</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Chip color={curriculumFeatureConfig?.curriculumImportVersion ? T.accent : T.dim}>
                          {curriculumFeatureConfig?.curriculumImportVersion
                            ? `${curriculumFeatureConfig.curriculumImportVersion.sourceLabel} · ${curriculumFeatureConfig.curriculumImportVersion.validationStatus}`
                            : 'No import snapshot yet'}
                        </Chip>
                        {curriculumFeatureConfig?.curriculumFeatureProfileFingerprint ? <Chip color={T.success}>{`Fingerprint ${curriculumFeatureConfig.curriculumFeatureProfileFingerprint.slice(0, 8)}`}</Chip> : null}
                        {selectedCurriculumFeatureItem?.resolvedSource ? <Chip color={T.warning}>{selectedCurriculumFeatureItem.resolvedSource.label}</Chip> : null}
                        {selectedCurriculumFeatureItem?.localOverride ? <Chip color={T.orange}>Batch-local override active</Chip> : <Chip color={T.dim}>No batch-local override</Chip>}
                      </div>
                    </div>
                  </div>

                  <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <div>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Batch Binding Mode</div>
                        <select value={curriculumFeatureBindingMode} onChange={event => setCurriculumFeatureBindingMode(event.target.value as typeof curriculumFeatureBindingMode)} style={{ width: '100%' }}>
                          <option value="inherit-scope-profile">Inherit scope profile</option>
                          <option value="pin-profile">Pin specific profile</option>
                          <option value="local-only">Local only</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pinned Profile</div>
                        <select value={curriculumFeaturePinnedProfileId} disabled={curriculumFeatureBindingMode !== 'pin-profile'} onChange={event => setCurriculumFeaturePinnedProfileId(event.target.value)} style={{ width: '100%' }}>
                          <option value="">Select profile</option>
                          {curriculumFeatureProfileOptions.map(profile => (
                            <option key={profile.curriculumFeatureProfileId} value={profile.curriculumFeatureProfileId}>
                              {`${formatScopeTypeLabel(profile.scopeType)} · ${profile.name}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Save Target Mode</div>
                        <select value={curriculumFeatureTargetMode} onChange={event => setCurriculumFeatureTargetMode(event.target.value as typeof curriculumFeatureTargetMode)} style={{ width: '100%' }}>
                          <option value="batch-local-override">Batch-local override</option>
                          <option value="scope-profile">Scope profile</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Target Scope</div>
                        <select value={curriculumFeatureTargetScopeKey} disabled={curriculumFeatureTargetMode !== 'scope-profile'} onChange={event => setCurriculumFeatureTargetScopeKey(event.target.value)} style={{ width: '100%' }}>
                          {curriculumFeatureTargetScopeOptions.map(scope => (
                            <option key={`${scope.scopeType}:${scope.scopeId}`} value={`${scope.scopeType}::${scope.scopeId}`}>
                              {`${formatScopeTypeLabel(scope.scopeType)} · ${scope.label}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={curriculumFeatureConfig?.binding?.bindingMode === 'local-only' ? T.orange : T.accent}>
                        {`Current binding · ${curriculumFeatureConfig?.binding?.bindingMode ?? 'inherit-scope-profile'}`}
                      </Chip>
                      {selectedCurriculumFeatureItem?.appliedProfiles?.map(profile => (
                        <Chip key={profile.curriculumFeatureProfileId} color={T.success}>{`${formatScopeTypeLabel(profile.scopeType)} · ${profile.name}`}</Chip>
                      ))}
                      {curriculumFeatureTargetMode === 'scope-profile' && selectedCurriculumFeatureTargetScope ? (
                        <Chip color={T.warning}>{`${curriculumFeatureAffectedBatchPreview.length} affected batch${curriculumFeatureAffectedBatchPreview.length === 1 ? '' : 'es'} in target scope`}</Chip>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="button" onClick={() => void handleSaveCurriculumFeatureBinding()} disabled={curriculumFeatureBindingMode === 'pin-profile' && !curriculumFeaturePinnedProfileId}>
                        Save Binding
                      </Btn>
                    </div>
                  </Card>
                </div>
                <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Curriculum Linkage Review</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                        Deterministic matching leads, semantic overlap follows, and local Ollama assist is optional. Nothing changes the active graph until you approve a candidate or edit prerequisites directly.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedCurriculumLinkageCandidates.some(candidate => candidate.status === 'pending') ? T.warning : T.dim}>
                        {`${selectedCurriculumLinkageCandidates.filter(candidate => candidate.status === 'pending').length} pending`}
                      </Chip>
                      <Chip color={T.accent}>{`${selectedCurriculumLinkageCandidates.length} total for selected course`}</Chip>
                      {curriculumLinkageGenerationStatus ? (
                        <Chip color={curriculumLinkageGenerationStatus.status === 'ok' ? T.success : curriculumLinkageGenerationStatus.status === 'error' ? T.danger : T.warning}>
                          {`Generator · ${curriculumLinkageGenerationStatus.status} · ${curriculumLinkageGenerationStatus.provider === 'python-nlp' ? 'python nlp' : 'ts fallback'}`}
                        </Chip>
                      ) : null}
                      <Btn type="button" variant="ghost" onClick={() => void handleRegenerateCurriculumLinkageCandidates()} disabled={!selectedCurriculumFeatureItem}>
                        Regenerate Selected Course
                      </Btn>
                    </div>
                  </div>
                  {curriculumLinkageGenerationStatus?.warnings.length ? (
                    <InfoBanner message={curriculumLinkageGenerationStatus.warnings.join(' ')} tone={curriculumLinkageGenerationStatus.status === 'error' ? 'error' : 'neutral'} />
                  ) : null}
                  <div>
                    <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Review Note</div>
                    <TextAreaInput
                      value={curriculumLinkageReviewNote}
                      onChange={event => setCurriculumLinkageReviewNote(event.target.value)}
                      rows={3}
                      placeholder="Optional review note saved with approve/reject actions."
                    />
                  </div>
                  {curriculumLinkageCandidatesLoading ? (
                    <InfoBanner message="Refreshing curriculum linkage candidates for the selected batch." />
                  ) : !selectedCurriculumFeatureItem ? (
                    <EmptyState title="Select a model-input course" body="Choose a course above to review candidate prerequisite and cross-course links for that one curriculum row." />
                  ) : selectedCurriculumLinkageCandidates.length === 0 ? (
                    <EmptyState title="No linkage candidates" body="This course currently has no pending or reviewed candidate edges. Regenerate after editing outcomes, topics, or bridge modules." />
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {selectedCurriculumLinkageCandidates.map(candidate => (
                        <Card key={candidate.curriculumLinkageCandidateId} style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{`${candidate.sourceCourseCode} -> ${candidate.targetCourseCode}`}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                                {`${candidate.sourceTitle} -> ${candidate.targetTitle}`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Chip color={candidate.status === 'approved' ? T.success : candidate.status === 'rejected' ? T.danger : T.warning}>{candidate.status}</Chip>
                              <Chip color={candidate.edgeKind === 'explicit' ? T.accent : T.orange}>{candidate.edgeKind}</Chip>
                              <Chip color={T.dim}>{`${candidate.confidenceScaled}% confidence`}</Chip>
                            </div>
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.8 }}>{candidate.rationale}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {candidate.sources.map(source => <Chip key={`${candidate.curriculumLinkageCandidateId}:${source}`} color={T.dim}>{source}</Chip>)}
                          </div>
                          {candidate.reviewNote ? <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.8 }}>{`Review note · ${candidate.reviewNote}`}</div> : null}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn type="button" variant="ghost" onClick={() => void handleApproveCurriculumLinkageCandidate(candidate.curriculumLinkageCandidateId)} disabled={candidate.status !== 'pending'}>
                              Approve Link
                            </Btn>
                            <Btn type="button" variant="danger" onClick={() => void handleRejectCurriculumLinkageCandidate(candidate.curriculumLinkageCandidateId)} disabled={candidate.status !== 'pending'}>
                              Reject Link
                            </Btn>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
                <InfoBanner message="Outcome line format: CO1 | Apply | Description. Prerequisite line format: COURSE_CODE | explicit|added | rationale. Saving to a scope profile updates that shared feature category and only refreshes affected batches whose resolved fingerprints change." />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Assessment Profile</div><TextInput value={curriculumFeatureForm.assessmentProfile} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, assessmentProfile: event.target.value }))} placeholder="admin-authored" /></div>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Bridge Modules</div><TextAreaInput value={curriculumFeatureForm.bridgeModulesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, bridgeModulesText: event.target.value }))} rows={4} placeholder={'Bridge topic 1\nBridge topic 2'} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Course Outcomes</div><TextAreaInput value={curriculumFeatureForm.outcomesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, outcomesText: event.target.value }))} rows={6} placeholder={'CO1 | Understand | Explain the core concepts\nCO2 | Apply | Apply the methods to structured problems'} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Prerequisites</div><TextAreaInput value={curriculumFeatureForm.prerequisitesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, prerequisitesText: event.target.value }))} rows={5} placeholder={'MATH201 | explicit | Calculus foundation for optimisation\nCS202 | added | Added dependency for implementation readiness'} /></div>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>TT1 Topics</div><TextAreaInput value={curriculumFeatureForm.tt1TopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, tt1TopicsText: event.target.value }))} rows={4} placeholder={'Unit 1\nUnit 2'} /></div>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>TT2 Topics</div><TextAreaInput value={curriculumFeatureForm.tt2TopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, tt2TopicsText: event.target.value }))} rows={4} placeholder={'Unit 3\nUnit 4'} /></div>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>SEE Topics</div><TextAreaInput value={curriculumFeatureForm.seeTopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, seeTopicsText: event.target.value }))} rows={4} placeholder={'Comprehensive topic 1\nComprehensive topic 2'} /></div>
                  <div><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Workbook Topics</div><TextAreaInput value={curriculumFeatureForm.workbookTopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, workbookTopicsText: event.target.value }))} rows={4} placeholder={'Workbook topic 1\nWorkbook topic 2'} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => void handleSaveCurriculumFeatureConfig()} disabled={!selectedCurriculumFeatureItem}>{curriculumFeatureTargetMode === 'scope-profile' ? 'Save Shared Model Inputs' : 'Save Model Inputs'}</Btn>
                  {selectedCurriculumFeatureItem ? <Chip color={T.warning}>{`${selectedCurriculumFeatureItem.prerequisites.length} prerequisites · ${selectedCurriculumFeatureItem.bridgeModules.length} bridge modules`}</Chip> : null}
                  {curriculumFeatureTargetMode === 'scope-profile' && selectedCurriculumFeatureTargetScopeChip ? <Chip color={T.accent}>{selectedCurriculumFeatureTargetScopeChip}</Chip> : null}
                </div>
              </>
            )}
          </Card>
        </Card>
      )}

      {governanceBandsPanel}
      {governanceCeSeePanel}
      {governanceCgpaPanel}
      {stagePolicyPanel}
      {coursesPanel}
      {provisionPanel}

      {selectedBranch ? (
        <Card style={{ padding: 18, display: 'grid', gap: 10 }}>
          <SectionHeading title="Pick A Year" eyebrow="Courses" caption="Course editing unlocks at branch level, but semester-wise rows belong to a selected year." />
          {branchBatches.map(batch => (
            <button key={batch.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sections {batch.sectionLabels.join(', ')}</div>
            </button>
          ))}
        </Card>
      ) : (
        <EmptyState title="Select a branch" body="Courses are only editable after branch scope is selected." />
      )}

      <SystemAdminScopedRegistryLaunches {...registryLaunchProps} />
    </SystemAdminHierarchyWorkspaceShell>
  )
}
