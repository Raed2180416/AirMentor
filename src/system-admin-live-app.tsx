import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Compass,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Network,
  Plus,
  RefreshCw,
  UserCog,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import { readActiveDemoWorkspacePointer, writeActiveDemoWorkspacePointer } from './demo-workspace-pointer'
import type {
  ApiAcademicFaculty,
  ApiAdminFacultyPasswordSetupResponse,
  ApiAuditEvent,
  ApiAdminFacultyCalendar,
  ApiBatchProvisioningRequest,
  ApiBatch,
  ApiBranch,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageGenerationStatus,
  ApiCurriculumFeatureConfigPayload,
  ApiDepartment,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiMentorAssignmentBulkApplyResponse,
  ApiMentorAssignment,
  ApiAdminRequestDetail,
  ApiAdminSearchResult,
  ApiAdminRequestSummary,
  ApiOfferingStageEligibility,
  ApiOfferingOwnership,
  ApiPolicyPayload,
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentSummary,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiRoleCode,
  ApiScopeType,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiSimulationStageCheckpointSummary,
  ApiStageEvidenceKind,
  ApiStagePolicyOverride,
  ApiStagePolicyPayload,
  ApiStudentEnrollment,
  ApiStudentRecord,
} from './api/types'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from './repositories'
import {
  defaultRegistryFilter,
  compareAdminTimestampsDesc,
  deriveCurrentYearLabel,
  findLatestEnrollment,
  findLatestMentorAssignment,
  hasHierarchyScopeSelection,
  isAcademicFacultyVisible,
  isBatchVisible,
  isBranchVisible,
  isDepartmentVisible,
  isFacultyMemberVisible,
  isOfferingVisible,
  isStudentVisible,
  isTermVisible,
  isVisibleAdminRecord,
  getPrimaryAppointmentDepartmentId,
  listBatchesForBranch,
  listBranchesForDepartment,
  listCurriculumBySemester,
  listDepartmentsForAcademicFaculty,
  listFacultyAssignments,
  listTermsForBatch,
  hydrateRegistryFilter,
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  resolveFacultyMember,
  resolveStudent,
  searchLiveAdminWorkspace,
  type LiveAdminProofProvenance,
  type LiveAdminDataset,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
  type RegistryFilterState,
  type UniversityScopeState,
} from './system-admin-live-data'
import {
  computeOverviewScopedCounts,
  describeRegistryScope,
  formatOverviewFacultyCaption,
  isCurrentRoleGrant,
  isLeaderLikeOwnership,
  matchesFacultyScope,
  matchesStudentScope,
  type HierarchyScopeInput,
} from './system-admin-overview-helpers'
import { describeProofAvailability, describeProofProvenance } from './proof-provenance'
import { resolveSelectedAdminRequest } from './admin-request-selection'
import { areSessionResponsesEquivalent } from './session-response-helpers'
import {
  CANONICAL_PROOF_BATCH_ID,
  CANONICAL_PROOF_ACADEMIC_FACULTY_ID,
  CANONICAL_PROOF_BRANCH_ID,
  CANONICAL_PROOF_DEPARTMENT_ID,
  isCanonicalProofBatchId,
  resolveAdminDirectoryScopeFilter,
  resolveAuthoritativeOperationalSemester,
  resolveCanonicalProofBatch,
  resolveProofDashboardBatchId,
  scopeTargetsCanonicalProofHierarchy,
} from './proof-pilot'
import {
  buildBulkMentorAssignmentApplyPayload,
  buildBulkMentorAssignmentPreviewPayload,
  defaultBulkMentorAssignmentForm,
  describeBulkMentorPreview,
  getScopedMentorEligibleFaculty,
  type BulkMentorAssignmentFormState,
} from './system-admin-provisioning-helpers'
import {
  collectAdminQueueDismissKeys,
  mergeAdminQueueDismissKeys,
} from './system-admin-action-queue'
import {
  AdminBreadcrumbs,
  DayToggle,
  EmptyState,
  EntityButton,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  ModalFrame,
  QueueBulkActions,
  RestoreBanner,
  SearchField,
  SectionHeading,
  SelectInput,
  TextAreaInput,
  TextInput,
  TOP_TABS,
  formatDate,
  formatDateTime,
  type BreadcrumbSegment,
} from './system-admin-ui'
import type { LiveAdminSectionId } from './system-admin-live-data'
import { applyThemePreset, isLightTheme } from './theme'
import { clearProofPlaybackSelection, readSharedProofPlaybackSelection, writeProofPlaybackSelection } from './proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from './telemetry'
import { SystemAdminFacultyCalendarWorkspace } from './system-admin-faculty-calendar-workspace'
import {
  describeGovernanceRollbackMessage,
  SystemAdminFacultiesWorkspace,
} from './system-admin-faculties-workspace'
import { SystemAdminHistoryWorkspace } from './system-admin-history-workspace'
import { SystemAdminProofDashboardWorkspace } from './system-admin-proof-dashboard-workspace'
import { SystemAdminRequestWorkspace } from './system-admin-request-workspace'
import { SystemAdminSessionBoundary } from './system-admin-session-shell'
import { ProofSurfaceLauncher } from './proof-surface-shell'
import { ProofSimulationControls, type ProofAdvanceControlMode } from './proof-simulation-controls'
import {
  BrandMark,
  Btn,
  Card,
  Chip,
  ModalWorkspace,
  NotificationCountBadge,
  PageShell,
  UI_FONT_SIZES,
  getPrimaryActionButtonStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
  withAlpha,
} from './ui-primitives'
import { useDismissibleSessionNotice } from './hooks/use-dismissible-session-notice'
import { OverviewSection } from './admin/sections/overview-section'
import { StudentsSection } from './admin/sections/students-section'
import { FacultyMembersSection } from './admin/sections/faculty-members-section'
import { EntityEditorModals } from './admin/sections/entity-editor-modals'

type SystemAdminLiveAppProps = {
  apiBaseUrl: string
  onExitPortal?: () => void
}


// Re-exports for backward compatibility — model + chrome extracted to src/admin/
export * from './admin/live-app-model'
export * from './admin/live-app-chrome'

import {
  EMPTY_DATA,
  WEEKDAYS,
  ADMIN_SECTION_TONES,
  DEFAULT_PROGRESSION_RULES,
  ADMIN_DISMISSED_QUEUE_STORAGE_KEY,
  ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT,
  UNIVERSITY_TABS,
  DEFAULT_STAGE_POLICY,
  STAGE_EVIDENCE_OPTIONS,
  type PolicyFormState,
  type StructureFormState,
  type CurriculumFeatureFormState,
  type EntityEditorState,
  type StudentFormState,
  type StagePolicyFormState,
  type BatchProvisioningFormState,
  type EnrollmentFormState,
  type MentorAssignmentFormState,
  type FacultyFormState,
  type AppointmentFormState,
  type RoleGrantFormState,
  type OwnershipFormState,
  type AdminWorkspaceSnapshot,
  type ActiveAdminScope,
  type UniversityTab,
  type StudentDetailTab,
  type FacultyDetailTab,
  type EditingEntity,
  type ProvenancedRecord,
  isUniversityTab,
  applyFacultyVisibilityRules,
  hasRecordProofProvenance,
  formatRecordProofBanner,
  shouldShowProofCheckpointCgpa,
  shouldOverlayProofCheckpointStudentSummary,
  formatFacultyGrantScopeLabel,
  formatFacultyAppointmentLabel,
  resolveFacultyCredentialStatus,
  parseAdminRoute,
  routeToHash,
  defaultPolicyForm,
  defaultEntityEditorState,
  defaultStudentForm,
  defaultCurriculumFeatureForm,
  hydrateCurriculumFeatureForm,
  parseCurriculumFeatureLines,
  buildCurriculumFeaturePayload,
  validateCurriculumFeaturePrerequisites,
  defaultStagePolicyForm,
  hydrateStagePolicyForm,
  buildStagePolicyPayload,
  defaultBatchProvisioningForm,
  buildBatchProvisioningPayload,
  mergePolicyPayload,
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  defaultFacultyForm,
  toRegistrySearchScope,
  normalizeHierarchyScope,
  normalizeAdminSectionCode,
  buildAdminSectionScopeId,
  parseAdminSectionScopeId,
  buildAdminActiveScopeChain,
  fadeColor,
  defaultAppointmentForm,
  defaultRoleGrantForm,
  defaultOwnershipForm,
  hydratePolicyForm,
  buildPolicyPayload,
  toErrorMessage,
  requireText,
  requirePositiveInteger,
  requireNonNegativeInteger,
  requirePositiveEvenInteger,
  requireDate,
  requireRange,
  buildValidatedPolicyPayload,
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
  getAuditEventRoute,
  createAdminWorkspaceSnapshot,
  getAdminWorkspaceSnapshotKey,
  matchesBatchScope,
  toOptionalScopeValue,
  readSubmittedField,
  shouldHydrateHierarchyEditor,
  upsertAcademicFacultyRecord,
  upsertDepartmentRecord,
  upsertBranchRecord,
  upsertBatchRecord,
} from './admin/live-app-model'
import {
  TeachingShellAdminTopBar,
  OperationsRail,
  SectionLaunchCard,
  OverviewSupportCard,
  ActionQueueCard,
  AdminDetailTabs,
  AdminDetailTabPanel,
  AdminMiniStat,
} from './admin/live-app-chrome'
export function SystemAdminLiveApp({ apiBaseUrl, onExitPortal }: SystemAdminLiveAppProps) {
  const apiClient = useMemo(() => new AirMentorApiClient(apiBaseUrl, undefined, readActiveDemoWorkspacePointer), [apiBaseUrl])
  const repositories = useMemo(() => createAirMentorRepositories({ repositoryMode: 'http', apiClient }), [apiClient])

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [now, setNow] = useState(() => new Date())
  const [booting, setBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [session, setSession] = useState<ApiSessionResponse | null>(null)
  const [data, setData] = useState<LiveAdminDataset>(EMPTY_DATA)
  const [scopedDirectoryStudents, setScopedDirectoryStudents] = useState<ApiStudentRecord[] | null>(null)
  const [scopedDirectoryFacultyMembers, setScopedDirectoryFacultyMembers] = useState<ApiFacultyRecord[] | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [flashMessage, setFlashMessage] = useState('')
  const [curriculumProofRefreshRetry, setCurriculumProofRefreshRetry] = useState<{
    batchIds: string[]
    curriculumImportVersionId: string | null
    message: string
  } | null>(null)
  const [actionError, setActionError] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [serverSearchResults, setServerSearchResults] = useState<ApiAdminSearchResult[]>([])
  const [showActionQueue, setShowActionQueue] = useState(true)
  const [renderInlineActionQueue, setRenderInlineActionQueue] = useState(() => typeof window === 'undefined' ? true : window.innerWidth >= ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT)
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window === 'undefined' ? false : window.innerWidth < 1280)
  const [remindersSupported, setRemindersSupported] = useState(true)
  const [universityTab, setUniversityTab] = useState<UniversityTab>('overview')
  const [selectedSectionCode, setSelectedSectionCode] = useState<string | null>(null)
  const { notice: facultiesRestoreNotice, setNotice: setFacultiesRestoreNotice, dismissNotice: dismissFacultiesRestoreNotice } = useDismissibleSessionNotice()
  const [route, setRoute] = useState<LiveAdminRoute>(() => parseAdminRoute(typeof window === 'undefined' ? '' : window.location.hash))
  const [routeHistory, setRouteHistory] = useState<AdminWorkspaceSnapshot[]>([])
  const [registryScope, setRegistryScope] = useState<UniversityScopeState | null>(null)
  const [studentRegistryFilter, setStudentRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [facultyRegistryFilter, setFacultyRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [studentRegistrySearch, setStudentRegistrySearch] = useState('')
  const [facultyRegistrySearch, setFacultyRegistrySearch] = useState('')
  const [dismissedQueueItemKeys, setDismissedQueueItemKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(ADMIN_DISMISSED_QUEUE_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })
  const [structureForms, setStructureForms] = useState<StructureFormState>({
    academicFaculty: { code: '', name: '', overview: '' },
    department: { code: '', name: '' },
    branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' },
    batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' },
    term: { academicYearLabel: '2026-27', semesterNumber: '1', startDate: '2026-08-01', endDate: '2026-12-15' },
    curriculum: { semesterNumber: '1', courseCode: '', title: '', credits: '4' },
  })
  const [entityEditors, setEntityEditors] = useState<EntityEditorState>(() => defaultEntityEditorState())
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(() => defaultPolicyForm())
  const [batchSetupReadiness, setBatchSetupReadiness] = useState<{ ready: boolean; blockers: string[] } | null>(null)
  const [resolvedBatchPolicy, setResolvedBatchPolicy] = useState<ApiResolvedBatchPolicy | null>(null)
  const [stagePolicyOverrides, setStagePolicyOverrides] = useState<ApiStagePolicyOverride[]>([])
  const [resolvedStagePolicy, setResolvedStagePolicy] = useState<ApiResolvedBatchStagePolicy | null>(null)
  const [stagePolicyForm, setStagePolicyForm] = useState<StagePolicyFormState>(() => defaultStagePolicyForm())
  const [proofDashboard, setProofDashboard] = useState<ApiProofDashboard | null>(null)
  const [proofDashboardLoading, setProofDashboardLoading] = useState(false)
  const [curriculumFeatureConfig, setCurriculumFeatureConfig] = useState<ApiCurriculumFeatureConfigBundle | null>(null)
  const [curriculumLinkageCandidates, setCurriculumLinkageCandidates] = useState<ApiCurriculumLinkageCandidate[]>([])
  const [curriculumLinkageGenerationStatus, setCurriculumLinkageGenerationStatus] = useState<ApiCurriculumLinkageGenerationStatus | null>(null)
  const [curriculumLinkageCandidatesLoading, setCurriculumLinkageCandidatesLoading] = useState(false)
  const [curriculumLinkageReviewNote, setCurriculumLinkageReviewNote] = useState('')
  const [selectedCurriculumFeatureCourseId, setSelectedCurriculumFeatureCourseId] = useState('')
  const [selectedCurriculumSemester, setSelectedCurriculumSemester] = useState('')
  const [selectedCurriculumCourseId, setSelectedCurriculumCourseId] = useState('')
  const [curriculumFeatureForm, setCurriculumFeatureForm] = useState<CurriculumFeatureFormState>(() => defaultCurriculumFeatureForm())
  const [curriculumFeaturePreview, setCurriculumFeaturePreview] = useState<ApiCurriculumFeatureConfigPreview | null>(null)
  const [curriculumFeatureHistory, setCurriculumFeatureHistory] = useState<ApiCurriculumFeatureConfigHistoryEvent[] | null>(null)
  const [curriculumFeatureTargetMode, setCurriculumFeatureTargetMode] = useState<'batch-local-override' | 'scope-profile'>('batch-local-override')
  const [curriculumFeatureTargetScopeKey, setCurriculumFeatureTargetScopeKey] = useState('')
  const [curriculumFeatureBindingMode, setCurriculumFeatureBindingMode] = useState<'inherit-scope-profile' | 'pin-profile' | 'local-only'>('inherit-scope-profile')
  const [curriculumFeaturePinnedProfileId, setCurriculumFeaturePinnedProfileId] = useState('')
  const [batchProvisioningForm, setBatchProvisioningForm] = useState<BatchProvisioningFormState>(() => defaultBatchProvisioningForm())
  const [bulkMentorAssignmentForm, setBulkMentorAssignmentForm] = useState<BulkMentorAssignmentFormState>(() => defaultBulkMentorAssignmentForm())
  const [bulkMentorAssignmentPreview, setBulkMentorAssignmentPreview] = useState<ApiMentorAssignmentBulkApplyResponse | null>(null)
  const [selectedStageOfferingId, setSelectedStageOfferingId] = useState('')
  const [selectedStageEligibility, setSelectedStageEligibility] = useState<ApiOfferingStageEligibility | null>(null)
  const [selectedProofCheckpointId, setSelectedProofCheckpointId] = useState<string | null>(() => readSharedProofPlaybackSelection('system-admin')?.simulationStageCheckpointId ?? null)
  const [selectedProofCheckpointSource, setSelectedProofCheckpointSource] = useState<'auto' | 'restored' | 'manual'>(() => readSharedProofPlaybackSelection('system-admin') ? 'restored' : 'auto')
  const [proofPlaybackRestoreNotice, setProofPlaybackRestoreNotice] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null)
  const [selectedProofCheckpointDetail, setSelectedProofCheckpointDetail] = useState<ApiProofRunCheckpointDetail | null>(null)
  const [selectedProofCheckpointStudents, setSelectedProofCheckpointStudents] = useState<ApiProofRunCheckpointStudentSummary[] | null>(null)
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<ApiAdminRequestDetail | null>(null)
  const [requestDetailLoading, setRequestDetailLoading] = useState(false)
  const [requestBusy, setRequestBusy] = useState('')
  const [studentForm, setStudentForm] = useState<StudentFormState>(() => defaultStudentForm())
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentFormState>(() => defaultEnrollmentForm())
  const [mentorForm, setMentorForm] = useState<MentorAssignmentFormState>(() => defaultMentorAssignmentForm())
  const [facultyForm, setFacultyForm] = useState<FacultyFormState>(() => defaultFacultyForm())
  const [facultyPasswordSetupResult, setFacultyPasswordSetupResult] = useState<ApiAdminFacultyPasswordSetupResponse | null>(null)
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>(() => defaultAppointmentForm())
  const [roleGrantForm, setRoleGrantForm] = useState<RoleGrantFormState>(() => defaultRoleGrantForm())
  const [ownershipForm, setOwnershipForm] = useState<OwnershipFormState>(() => defaultOwnershipForm())
  const [studentAuditLoading, setStudentAuditLoading] = useState(false)
  const [studentAuditEvents, setStudentAuditEvents] = useState<ApiAuditEvent[]>([])
  const [facultyAuditLoading, setFacultyAuditLoading] = useState(false)
  const [facultyAuditEvents, setFacultyAuditEvents] = useState<ApiAuditEvent[]>([])
  const [selectedStudentPolicy, setSelectedStudentPolicy] = useState<ApiResolvedBatchPolicy | null>(null)
  const [selectedStudentPolicyLoading, setSelectedStudentPolicyLoading] = useState(false)
  const [recentAuditLoading, setRecentAuditLoading] = useState(false)
  const [recentAuditEvents, setRecentAuditEvents] = useState<ApiAuditEvent[]>([])
  const [facultyCalendarLoading, setFacultyCalendarLoading] = useState(false)
  const [facultyCalendar, setFacultyCalendar] = useState<ApiAdminFacultyCalendar | null>(null)
  const [showFacultyTimetableExpanded, setShowFacultyTimetableExpanded] = useState(false)
  const [studentDetailTab, setStudentDetailTab] = useState<StudentDetailTab>('profile')
  const [facultyDetailTab, setFacultyDetailTab] = useState<FacultyDetailTab>('profile')
  const [editingEntity, setEditingEntity] = useState<EditingEntity | null>(null)
  const universityWorkspacePaneRef = useRef<HTMLDivElement | null>(null)
  const scopedAdminDirectoryFilter = useMemo(
    () => resolveAdminDirectoryScopeFilter({
      route,
      registryScope,
      selectedSectionCode,
    }),
    [registryScope, route, selectedSectionCode],
  )

  const mergeStudentRecord = useCallback((nextStudent: ApiStudentRecord) => {
    setData(prev => {
      const nextStudents = prev.students.some(item => item.studentId === nextStudent.studentId)
        ? prev.students.map(item => item.studentId === nextStudent.studentId ? nextStudent : item)
        : [nextStudent, ...prev.students]
      return {
        ...prev,
        students: nextStudents,
      }
    })
  }, [])
  const pendingScrollRestoreRef = useRef<number | null>(null)

  const deferredSearch = useDeferredValue(searchQuery)

  applyThemePreset(themeMode)

  const persistTheme = useCallback((nextMode: ThemeMode) => {
    setThemeMode(nextMode)
    if (typeof window !== 'undefined') window.localStorage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, nextMode)
    void repositories.sessionPreferences.saveTheme(nextMode)
  }, [repositories])

  const currentWorkspaceSnapshot = useCallback(() => createAdminWorkspaceSnapshot({
    route,
    universityTab,
    selectedSectionCode,
  }), [route, selectedSectionCode, universityTab])

  const scrollUniversityWorkspaceToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    universityWorkspacePaneRef.current?.scrollTo({ top: 0, behavior })
  }, [])

  const pushCurrentWorkspaceToHistory = useCallback(() => {
    const snapshot = currentWorkspaceSnapshot()
    setRouteHistory(existing => {
      const last = existing.at(-1)
      if (last && getAdminWorkspaceSnapshotKey(last) === getAdminWorkspaceSnapshotKey(snapshot)) return existing
      return [...existing, snapshot].slice(-60)
    })
  }, [currentWorkspaceSnapshot])

  const navigate = useCallback((nextRoute: LiveAdminRoute, options?: { recordHistory?: boolean }) => {
    if (options?.recordHistory !== false && getAdminWorkspaceSnapshotKey({ route: nextRoute, universityTab, selectedSectionCode }) !== getAdminWorkspaceSnapshotKey({ route, universityTab, selectedSectionCode })) {
      pushCurrentWorkspaceToHistory()
    }
    const nextHash = routeToHash(nextRoute)
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) window.location.hash = nextHash
    setRoute(nextRoute)
  }, [pushCurrentWorkspaceToHistory, route, selectedSectionCode, universityTab])

  const updateUniversityTab = useCallback((nextTab: UniversityTab, options?: { recordHistory?: boolean; scroll?: boolean }) => {
    if (nextTab === universityTab) {
      if (options?.scroll !== false) scrollUniversityWorkspaceToTop()
      return
    }
    if (options?.recordHistory !== false) pushCurrentWorkspaceToHistory()
    setUniversityTab(nextTab)
    if (options?.scroll !== false) scrollUniversityWorkspaceToTop()
  }, [pushCurrentWorkspaceToHistory, scrollUniversityWorkspaceToTop, universityTab])

  const updateSelectedSectionCode = useCallback((nextSectionCode: string | null, options?: { recordHistory?: boolean }) => {
    if ((nextSectionCode ?? null) === selectedSectionCode) return
    if (options?.recordHistory !== false) pushCurrentWorkspaceToHistory()
    setSelectedSectionCode(nextSectionCode ?? null)
  }, [pushCurrentWorkspaceToHistory, selectedSectionCode])

  const clearRouteHistory = useCallback(() => {
    setRouteHistory([])
    pendingScrollRestoreRef.current = null
  }, [])

  const clearRegistryScope = useCallback(() => {
    setRegistryScope(null)
  }, [])

  const dismissQueueItem = useCallback((key: string) => {
    setDismissedQueueItemKeys(existing => existing.includes(key) ? existing : [...existing, key])
  }, [])

  const restoreAllHiddenQueueItems = useCallback(() => {
    setDismissedQueueItemKeys([])
  }, [])

  const handleGoHome = useCallback(() => {
    clearRouteHistory()
    clearRegistryScope()
    updateSelectedSectionCode(null, { recordHistory: false })
    updateUniversityTab('overview', { recordHistory: false })
    navigate({ section: 'overview' }, { recordHistory: false })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [clearRegistryScope, clearRouteHistory, navigate, updateSelectedSectionCode, updateUniversityTab])

  const handleNavigateBack = useCallback(() => {
    const nextHistory = [...routeHistory]
    const previous = nextHistory.pop()
    if (!previous) {
      handleGoHome()
      return
    }
    setRouteHistory(nextHistory)
    pendingScrollRestoreRef.current = previous.scrollY
    setRoute(previous.route)
    setUniversityTab(previous.universityTab)
    setSelectedSectionCode(previous.selectedSectionCode)
    if (typeof window !== 'undefined') {
      const nextHash = routeToHash(previous.route)
      if (window.location.hash !== nextHash) window.location.hash = nextHash
    }
  }, [handleGoHome, routeHistory])

  const settleCookieBackedSession = useCallback(async (
    stage: 'login' | 'role-switch',
    optimisticSession: ApiSessionResponse | null = null,
  ) => {
    const retryDelaysMs = [0, 40, 100, 200, 350, 500]
    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, delayMs))
      }
      try {
        return await apiClient.restoreSession()
      } catch (error) {
        if (error instanceof AirMentorApiError && error.status === 401) continue
        throw error
      }
    }
    if (optimisticSession) {
      emitClientOperationalEvent('auth.session.cookie_settle_delayed', {
        workspace: 'system-admin',
        stage,
        sessionId: optimisticSession.sessionId,
        activeRole: optimisticSession.activeRoleGrant.roleCode,
      }, { level: 'warn' })
      return optimisticSession
    }
    throw new Error(
      stage === 'login'
        ? 'Signed in, but the backend session cookie did not become readable yet. Please try signing in again.'
        : 'Role switch did not settle in the backend session. Please retry the switch.',
    )
  }, [apiClient])

  const loadAdminData = useCallback(async () => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    setDataLoading(true)
    setDataError('')
    try {
      const safeInstitution = async () => {
        try { return await apiClient.getInstitution() } catch (error) {
          if (error instanceof AirMentorApiError && error.status === 404) return null
          throw error
        }
      }
      const safeReminders = async () => {
        try {
          const response = await apiClient.listAdminReminders()
          setRemindersSupported(true)
          return response
        } catch (error) {
          if (error instanceof AirMentorApiError && error.status === 404) {
            setRemindersSupported(false)
            return { items: [] }
          }
          throw error
        }
      }
      const [institution, academicFaculties, departments, branches, batches, terms, facultyMembers, students, courses, curriculumCourses, policyOverrides, nextStagePolicyOverrides, offerings, ownerships, requests, reminders] = await Promise.all([
        safeInstitution(), apiClient.listAcademicFaculties(), apiClient.listDepartments(),
        apiClient.listBranches(), apiClient.listBatches(), apiClient.listTerms(),
        apiClient.listFaculty(), apiClient.listStudents(), apiClient.listCourses(),
        apiClient.listCurriculumCourses(), apiClient.listPolicyOverrides(), apiClient.listStagePolicyOverrides(),
        apiClient.listOfferings(), apiClient.listOfferingOwnership(), apiClient.listAdminRequests(),
        safeReminders(),
      ])
      setData({
        institution, academicFaculties: academicFaculties.items, departments: departments.items,
        branches: branches.items, batches: batches.items, terms: terms.items,
        facultyMembers: applyFacultyVisibilityRules(facultyMembers.items), students: students.items, courses: courses.items,
        curriculumCourses: curriculumCourses.items, policyOverrides: policyOverrides.items,
        offerings: offerings.items, ownerships: ownerships.items, requests: requests.items,
        reminders: reminders.items,
      })
      setStagePolicyOverrides(nextStagePolicyOverrides.items)
    } catch (error) {
      setDataError(toErrorMessage(error))
    } finally {
      setDataLoading(false)
    }
  }, [apiClient, session])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const syncRoute = () => setRoute(parseAdminRoute(window.location.hash))
    window.addEventListener('hashchange', syncRoute)
    if (!window.location.hash.startsWith('#/admin')) window.location.hash = '#/admin/overview'
    syncRoute()
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ADMIN_DISMISSED_QUEUE_STORAGE_KEY, JSON.stringify(dismissedQueueItemKeys))
  }, [dismissedQueueItemKeys])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setEditingEntity(null)
    if (route.section !== 'faculties') {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      setFacultiesRestoreNotice(null)
      return
    }
    const storageKey = `airmentor-admin-ui:${routeToHash(route)}`
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      setFacultiesRestoreNotice(null)
      return
    }
    try {
      const parsed = JSON.parse(raw) as { tab?: unknown; sectionCode?: string | null }
      setUniversityTab(isUniversityTab(parsed.tab) ? parsed.tab : 'overview')
      setSelectedSectionCode(parsed.sectionCode ?? null)
      setFacultiesRestoreNotice({
        tone: 'neutral',
        message: 'Faculties workspace state was restored from your last sysadmin session. Use Reset workspace to return to the default University overview.',
      })
    } catch {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      setFacultiesRestoreNotice({
        tone: 'error',
        message: 'Saved faculties workspace state could not be restored. Reset workspace to return to the default University overview.',
      })
    }
  }, [route, setFacultiesRestoreNotice])

  useEffect(() => {
    if (typeof window === 'undefined' || route.section !== 'faculties') return
    window.sessionStorage.setItem(`airmentor-admin-ui:${routeToHash(route)}`, JSON.stringify({
      tab: universityTab,
      sectionCode: selectedSectionCode,
    }))
  }, [route, selectedSectionCode, universityTab])

  useEffect(() => {
    if (pendingScrollRestoreRef.current == null || typeof window === 'undefined') return
    const targetScrollY = pendingScrollRestoreRef.current
    pendingScrollRestoreRef.current = null
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetScrollY, behavior: 'auto' })
    })
  }, [route, selectedSectionCode, universityTab])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const restored = await apiClient.restoreSession()
        emitClientOperationalEvent('auth.session.restored', {
          workspace: 'system-admin',
          sessionId: restored.sessionId,
          facultyId: restored.faculty?.facultyId ?? null,
          activeRole: restored.activeRoleGrant.roleCode,
        })
        if (!cancelled) setSession(restored)
      } catch (error) {
        if (!(error instanceof AirMentorApiError && error.status === 401)) {
          emitClientOperationalEvent('auth.session.restore_failed', {
            workspace: 'system-admin',
            error: normalizeClientTelemetryError(error),
          }, { level: 'warn' })
        }
        if (!cancelled) setSession(null)
      }
      finally { if (!cancelled) setBooting(false) }
    })()
    return () => { cancelled = true }
  }, [apiClient])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    void loadAdminData()
  }, [loadAdminData, session])

  const routeScopedBatchId = useMemo(() => {
    if (route.batchId) return route.batchId
    return null
  }, [route.batchId])
  const proofDashboardBatchId = useMemo(() => resolveProofDashboardBatchId({
    route,
    routeScopedBatchId,
    directoryScope: scopedAdminDirectoryFilter,
    data,
  }), [data, route, routeScopedBatchId, scopedAdminDirectoryFilter])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setScopedDirectoryStudents(null)
      setScopedDirectoryFacultyMembers(null)
      return
    }
    if (!scopedAdminDirectoryFilter || !hasHierarchyScopeSelection(scopedAdminDirectoryFilter)) {
      setScopedDirectoryStudents(null)
      setScopedDirectoryFacultyMembers(null)
      return
    }
    let cancelled = false
    setScopedDirectoryStudents(null)
    setScopedDirectoryFacultyMembers(null)
    void (async () => {
      try {
        const [facultyResponse, studentsResponse] = await Promise.all([
          apiClient.listFaculty(scopedAdminDirectoryFilter),
          apiClient.listStudents(scopedAdminDirectoryFilter),
        ])
        if (cancelled) return
        setScopedDirectoryFacultyMembers(applyFacultyVisibilityRules(facultyResponse.items))
        setScopedDirectoryStudents(studentsResponse.items)
      } catch (error) {
        if (cancelled) return
        setScopedDirectoryStudents(null)
        setScopedDirectoryFacultyMembers(null)
        setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, scopedAdminDirectoryFilter, session])

  useEffect(() => {
    if (!routeScopedBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setResolvedBatchPolicy(null)
      setResolvedStagePolicy(null)
      setProofDashboard(null)
      setCurriculumFeatureConfig(null)
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      setStagePolicyForm(defaultStagePolicyForm())
      setSelectedStageOfferingId('')
      setSelectedStageEligibility(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(routeScopedBatchId, { sectionCode: selectedSectionCode })
        if (cancelled) return
        setResolvedBatchPolicy(next)
        setPolicyForm(hydratePolicyForm(next.effectivePolicy))
      } catch (error) { if (!cancelled) setActionError(toErrorMessage(error)) }
    })()
    return () => { cancelled = true }
  }, [apiClient, routeScopedBatchId, selectedSectionCode, session])

  useEffect(() => {
    if (!routeScopedBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setBatchSetupReadiness(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getBatchSetupReadiness(routeScopedBatchId, { sectionCode: selectedSectionCode })
        if (cancelled) return
        setBatchSetupReadiness(next)
      } catch { if (!cancelled) setBatchSetupReadiness({ ready: false, blockers: [] }) }
    })()
    return () => { cancelled = true }
  }, [apiClient, routeScopedBatchId, selectedSectionCode, session])

  useEffect(() => {
    if (!routeScopedBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setResolvedStagePolicy(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedStagePolicy(routeScopedBatchId, { sectionCode: selectedSectionCode })
        if (cancelled) return
        setResolvedStagePolicy(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, routeScopedBatchId, selectedSectionCode, session])

  const refreshCurriculumFeatureConfig = useCallback(async (batchId: string) => {
    const next = await apiClient.getCurriculumFeatureConfig(batchId)
    setCurriculumFeatureConfig(next)
    return next
  }, [apiClient])

  const refreshCurriculumLinkageCandidates = useCallback(async (batchId: string) => {
    setCurriculumLinkageCandidatesLoading(true)
    try {
      const next = await apiClient.listCurriculumLinkageCandidates(batchId)
      setCurriculumLinkageCandidates(next.items)
      return next.items
    } finally {
      setCurriculumLinkageCandidatesLoading(false)
    }
  }, [apiClient])

  const refreshProofDashboard = useCallback(async (batchId: string) => {
    setProofDashboardLoading(true)
    try {
      const next = await apiClient.getProofDashboard(batchId)
      setProofDashboard(next)
      return next
    } finally {
      setProofDashboardLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    if (!proofDashboardBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setProofDashboard(null)
      return
    }
    let cancelled = false
    setProofDashboardLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getProofDashboard(proofDashboardBatchId)
        if (!cancelled) setProofDashboard(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      } finally {
        if (!cancelled) setProofDashboardLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, proofDashboardBatchId, session])

  useEffect(() => {
    if (!proofDashboardBatchId) return
    const hasPendingProofRun = proofDashboard?.proofRuns.some(run => run.status === 'queued' || run.status === 'running') ?? false
    if (!hasPendingProofRun) return
    const timer = window.setInterval(() => {
      void refreshProofDashboard(proofDashboardBatchId)
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [proofDashboard?.proofRuns, proofDashboardBatchId, refreshProofDashboard])

  const getQueuedProofRefreshCount = useCallback((value: unknown) => {
    if (!value || typeof value !== 'object') return 0
    const proofRefresh = (value as { proofRefresh?: { queuedSimulationRunIds?: unknown } }).proofRefresh
    if (!proofRefresh || !Array.isArray(proofRefresh.queuedSimulationRunIds)) return 0
    return proofRefresh.queuedSimulationRunIds.length
  }, [])

  const queueProofRefreshBatches = useCallback(async (batchIds: string[], reason: string, overrideImportVersionId?: string | null) => {
    const refreshedBatchIds: string[] = []
    for (const batchId of Array.from(new Set(batchIds.filter(isCanonicalProofBatchId)))) {
      const scopedConfig = batchId === routeScopedBatchId
        ? curriculumFeatureConfig
        : await apiClient.getCurriculumFeatureConfig(batchId)
      const scopedDashboard = batchId === routeScopedBatchId
        ? proofDashboard
        : await apiClient.getProofDashboard(batchId)
      const importVersionId = overrideImportVersionId
        ?? scopedConfig?.curriculumImportVersion?.curriculumImportVersionId
        ?? scopedDashboard?.imports[0]?.curriculumImportVersionId
        ?? null
      if (!importVersionId) continue
      const activeRun = scopedDashboard?.activeRunDetail ?? null
      await apiClient.createProofRun(batchId, {
        curriculumImportVersionId: importVersionId,
        seed: activeRun?.seed,
        runLabel: `${activeRun?.runLabel ?? 'Sysadmin refresh'} · ${reason}`,
        activate: true,
      })
      refreshedBatchIds.push(batchId)
      if (batchId === routeScopedBatchId || batchId === proofDashboardBatchId) {
        await refreshProofDashboard(batchId)
      }
    }
    return refreshedBatchIds
  }, [apiClient, curriculumFeatureConfig, proofDashboard, proofDashboardBatchId, refreshProofDashboard, routeScopedBatchId])

  const queueSelectedProofRefresh = useCallback(async (reason: string, curriculumImportVersionId?: string | null) => {
    if (!routeScopedBatchId) return []
    return queueProofRefreshBatches([routeScopedBatchId], reason, curriculumImportVersionId)
  }, [queueProofRefreshBatches, routeScopedBatchId])

  useEffect(() => {
    if (!routeScopedBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setCurriculumFeatureConfig(null)
      setCurriculumLinkageCandidates([])
      setCurriculumLinkageGenerationStatus(null)
      setCurriculumLinkageReviewNote('')
      setCurriculumProofRefreshRetry(null)
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getCurriculumFeatureConfig(routeScopedBatchId)
        if (cancelled) return
        setCurriculumFeatureConfig(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, routeScopedBatchId, session])

  useEffect(() => {
    if (!routeScopedBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setCurriculumLinkageCandidates([])
      setCurriculumLinkageGenerationStatus(null)
      setCurriculumLinkageCandidatesLoading(false)
      return
    }
    let cancelled = false
    setCurriculumLinkageCandidatesLoading(true)
    void (async () => {
      try {
        const next = await apiClient.listCurriculumLinkageCandidates(routeScopedBatchId)
        if (cancelled) return
        setCurriculumLinkageCandidates(next.items)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      } finally {
        if (!cancelled) setCurriculumLinkageCandidatesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, routeScopedBatchId, session])

  useEffect(() => {
    const items = curriculumFeatureConfig?.items ?? []
    if (items.length === 0) {
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      return
    }
    const nextSelectedId = items.some(item => item.curriculumCourseId === selectedCurriculumFeatureCourseId)
      ? selectedCurriculumFeatureCourseId
      : items[0]!.curriculumCourseId
    setSelectedCurriculumFeatureCourseId(nextSelectedId)
    const selectedItem = items.find(item => item.curriculumCourseId === nextSelectedId) ?? null
    setCurriculumFeatureForm(hydrateCurriculumFeatureForm(selectedItem))
  }, [curriculumFeatureConfig, selectedCurriculumFeatureCourseId])

  const curriculumFeatureBinding = curriculumFeatureConfig?.binding ?? null

  useEffect(() => {
    const binding = curriculumFeatureBinding
    setCurriculumFeatureBindingMode(binding?.bindingMode ?? 'inherit-scope-profile')
    setCurriculumFeaturePinnedProfileId(binding?.curriculumFeatureProfileId ?? '')
  }, [curriculumFeatureBinding])

  useEffect(() => {
    if (!flashMessage) return undefined
    const timer = window.setTimeout(() => setFlashMessage(''), 2500)
    return () => window.clearTimeout(timer)
  }, [flashMessage])

  const systemAdminGrant = session?.availableRoleGrants.find(item => item.roleCode === 'SYSTEM_ADMIN') ?? null
  const selectedAcademicFaculty = resolveAcademicFaculty(data, route.academicFacultyId)
  const selectedDepartment = resolveDepartment(data, route.departmentId)
  const selectedBranch = resolveBranch(data, route.branchId)
  const selectedBatch = resolveBatch(data, routeScopedBatchId ?? undefined)
  const canonicalProofBatch = useMemo(() => resolveCanonicalProofBatch(data), [data])
  const proofControlBatchId = canonicalProofBatch?.batchId
    ?? CANONICAL_PROOF_BATCH_ID
  const canonicalProofRegistryScope = useMemo<UniversityScopeState | null>(() => {
    if (!canonicalProofBatch) return null
    return {
      academicFacultyId: CANONICAL_PROOF_ACADEMIC_FACULTY_ID,
      departmentId: CANONICAL_PROOF_DEPARTMENT_ID,
      branchId: CANONICAL_PROOF_BRANCH_ID,
      batchId: canonicalProofBatch.batchId,
      sectionCode: null,
      label: `MNC proof branch · ${deriveCurrentYearLabel(canonicalProofBatch.currentSemester)} · Batch ${canonicalProofBatch.batchLabel}`,
    }
  }, [canonicalProofBatch])
  const operatorData = data
  const activeRunDetail = proofDashboard?.activeRunDetail ?? null
  const { semester: authoritativeOperationalSemester, source: authoritativeOperationalSemesterSource } = resolveAuthoritativeOperationalSemester({
    route,
    selectedBatch,
    activeOperationalSemester: activeRunDetail?.activeOperationalSemester ?? null,
  })
  const activeSimulationRunId = activeRunDetail?.simulationRunId ?? null
  const activeRunCheckpoints = useMemo(
    () => activeRunDetail?.checkpoints ?? [],
    [activeRunDetail?.checkpoints],
  )
  const activeModelDiagnostics = activeRunDetail?.modelDiagnostics ?? null
  const activeProductionDiagnostics = activeModelDiagnostics?.production ?? null
  const activeChallengerDiagnostics = activeModelDiagnostics?.challenger ?? null
  const activeProductionEvaluation = (activeProductionDiagnostics?.evaluation ?? {}) as Record<string, unknown>
  const activeChallengerEvaluation = (activeChallengerDiagnostics?.evaluation ?? {}) as Record<string, unknown>
  const activeDiagnosticsTrainingManifestVersion = activeModelDiagnostics?.trainingManifestVersion
    ?? readStringField(activeProductionEvaluation, 'trainingManifestVersion')
    ?? readStringField(activeChallengerEvaluation, 'trainingManifestVersion')
    ?? activeProductionDiagnostics?.trainingManifestVersion
    ?? activeChallengerDiagnostics?.trainingManifestVersion
  const activeDiagnosticsCalibrationVersion = activeModelDiagnostics?.calibrationVersion
    ?? activeProductionDiagnostics?.calibrationVersion
    ?? activeChallengerDiagnostics?.calibrationVersion
    ?? readStringField(activeProductionEvaluation, 'calibrationVersion')
    ?? readStringField(activeChallengerEvaluation, 'calibrationVersion')
  const activeDiagnosticsSplitSummary = activeModelDiagnostics?.splitSummary
    ?? readRecordField(activeProductionEvaluation, 'splitSummary')
    ?? readRecordField(activeChallengerEvaluation, 'splitSummary')
  const activeDiagnosticsWorldSplitSummary = activeModelDiagnostics?.worldSplitSummary
    ?? readRecordField(activeProductionEvaluation, 'worldSplitSummary')
    ?? readRecordField(activeChallengerEvaluation, 'worldSplitSummary')
  const activeDiagnosticsScenarioFamilies = activeModelDiagnostics?.scenarioFamilySummary
    ?? readRecordField(activeProductionEvaluation, 'scenarioFamilySummary')
    ?? readRecordField(activeChallengerEvaluation, 'scenarioFamilySummary')
  const activeDiagnosticsHeadSupportSummary = activeModelDiagnostics?.headSupportSummary
    ?? readRecordField(activeProductionEvaluation, 'headSupportSummary')
    ?? readRecordField(activeChallengerEvaluation, 'headSupportSummary')
  const activeDiagnosticsPolicyDiagnostics = activeModelDiagnostics?.policyDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'policyDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'policyDiagnostics')
  const activeDiagnosticsCoEvidence = activeModelDiagnostics?.coEvidenceDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'coEvidenceDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'coEvidenceDiagnostics')
  const activeDiagnosticsSupportWarning = readStringField(activeProductionEvaluation, 'supportWarning')
    ?? readStringField(activeChallengerEvaluation, 'supportWarning')
    ?? null
  const activeDiagnosticsDisplayProbabilityAllowed = readBooleanField(activeProductionEvaluation, 'displayProbabilityAllowed')
    ?? readBooleanField(activeChallengerEvaluation, 'displayProbabilityAllowed')
  const activeDiagnosticsGovernedRunCount = readNumberField(activeProductionEvaluation, 'governedRunCount')
    ?? readNumberField(activeChallengerEvaluation, 'governedRunCount')
  const activeDiagnosticsSkippedRunCount = readNumberField(activeProductionEvaluation, 'skippedRunCount')
    ?? readNumberField(activeChallengerEvaluation, 'skippedRunCount')
  const activeDiagnosticsPolicyAcceptance = readRecordField(activeDiagnosticsPolicyDiagnostics, 'acceptanceGates')
  const activeDiagnosticsUiParity = activeModelDiagnostics?.uiParityDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'uiParityDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'uiParityDiagnostics')
  const activeDiagnosticsOverallCourseRuntime = readRecordField(activeProductionEvaluation, 'overallCourseRuntimeSummary')
    ?? readRecordField(activeChallengerEvaluation, 'overallCourseRuntimeSummary')
    ?? readRecordField(activeProductionEvaluation, 'runtimeSummary')
    ?? readRecordField(activeChallengerEvaluation, 'runtimeSummary')
    ?? activeModelDiagnostics?.overallCourseRuntimeSummary
    ?? activeModelDiagnostics?.runtimeSummary

  const activeDiagnosticsQueueBurden = readRecordField(activeProductionEvaluation, 'queueBurdenSummary')
    ?? readRecordField(activeChallengerEvaluation, 'queueBurdenSummary')
    ?? activeModelDiagnostics?.queueBurdenSummary
  const selectedProofCheckpoint = useMemo<ApiSimulationStageCheckpointSummary | null>(() => {
    if (activeRunCheckpoints.length === 0) return null
    if (!selectedProofCheckpointId) return activeRunCheckpoints[0] ?? null
    return activeRunCheckpoints.find(item => item.simulationStageCheckpointId === selectedProofCheckpointId) ?? activeRunCheckpoints[0] ?? null
  }, [activeRunCheckpoints, selectedProofCheckpointId])
  const defaultProofPlaybackCheckpointId = useMemo(() => {
    if (!activeRunCheckpoints.length) return null
    if (activeRunDetail?.activeStageKey) {
      const match = activeRunCheckpoints.find(item => item.stageKey === activeRunDetail.activeStageKey)
      if (match) return match.simulationStageCheckpointId
    }
    return activeRunCheckpoints[0]?.simulationStageCheckpointId ?? null
  }, [activeRunCheckpoints, activeRunDetail?.activeStageKey])
  const firstBlockedCheckpointIndex = useMemo(() => (
    activeRunCheckpoints.findIndex(item => item.playbackAccessible === false || item.stageAdvanceBlocked === true || (item.blockingQueueItemCount ?? item.openQueueCount ?? 0) > 0)
  ), [activeRunCheckpoints])
  const selectedProofCheckpointIndex = useMemo(() => (
    selectedProofCheckpoint
      ? activeRunCheckpoints.findIndex(item => item.simulationStageCheckpointId === selectedProofCheckpoint.simulationStageCheckpointId)
      : -1
  ), [activeRunCheckpoints, selectedProofCheckpoint])
  const selectedProofCheckpointBlocked = !!selectedProofCheckpoint && (
    selectedProofCheckpoint.playbackAccessible === false
    || selectedProofCheckpoint.stageAdvanceBlocked === true
    || (selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0) > 0
  )
  const selectedProofCheckpointHasBlockedProgression = firstBlockedCheckpointIndex >= 0
    && selectedProofCheckpointIndex >= 0
    && selectedProofCheckpointIndex >= firstBlockedCheckpointIndex
  const selectedProofCheckpointCanStepForward = !!selectedProofCheckpoint && activeRunCheckpoints.length > 0 && !selectedProofCheckpointBlocked && !selectedProofCheckpointHasBlockedProgression
  const selectedProofCheckpointCanPlayToEnd = !!selectedProofCheckpoint && activeRunCheckpoints.length > 0 && !selectedProofCheckpointBlocked && firstBlockedCheckpointIndex < 0

  useEffect(() => {
    if (!activeSimulationRunId || !selectedProofCheckpoint) return
    emitClientOperationalEvent('proof.checkpoint.readiness', {
      workspace: 'system-admin',
      simulationRunId: activeSimulationRunId,
      simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
      stageLabel: selectedProofCheckpoint.stageLabel,
      playbackAccessible: selectedProofCheckpoint.playbackAccessible !== false,
      stageAdvanceBlocked: selectedProofCheckpoint.stageAdvanceBlocked === true,
      blockingQueueItemCount: selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0,
      canStepForward: selectedProofCheckpointCanStepForward,
      canPlayToEnd: selectedProofCheckpointCanPlayToEnd,
    }, {
      level: selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'warn' : 'info',
    })
  }, [
    activeSimulationRunId,
    selectedProofCheckpoint,
    selectedProofCheckpointBlocked,
    selectedProofCheckpointCanPlayToEnd,
    selectedProofCheckpointCanStepForward,
    selectedProofCheckpointHasBlockedProgression,
  ])

  const studentRegistryScope = useMemo(
    () => toRegistrySearchScope(studentRegistryFilter),
    [studentRegistryFilter],
  )
  const facultyRegistryScope = useMemo(
    () => toRegistrySearchScope(facultyRegistryFilter),
    [facultyRegistryFilter],
  )
  const studentRegistryHasScope = hasHierarchyScopeSelection(studentRegistryScope)
  const selectedProofCheckpointStudentMap = useMemo(() => (
    new Map((selectedProofCheckpointStudents ?? []).map(item => [item.studentId, item]))
  ), [selectedProofCheckpointStudents])
  const studentRegistryProofScopeActive = route.section === 'students' && scopeTargetsCanonicalProofHierarchy(scopedAdminDirectoryFilter)
  const selectedStudentRecord = resolveStudent(operatorData, route.studentId)
  const selectedStudent = selectedStudentRecord && isStudentVisible(operatorData, selectedStudentRecord)
    ? selectedStudentRecord
    : null
  const selectedStudentActiveAcademicContext = selectedStudent?.activeAcademicContext ?? null
  const selectedStudentProofScopeActive = !!selectedStudent && shouldOverlayProofCheckpointStudentSummary({
    routeSection: route.section,
    studentBatchId: selectedStudentActiveAcademicContext?.batchId,
    selectedProofCheckpoint,
    registryScope: scopedAdminDirectoryFilter,
  })
  const selectedStudentCheckpointSummary = selectedStudentProofScopeActive && selectedStudent
    ? selectedProofCheckpointStudentMap.get(selectedStudent.studentId) ?? null
    : null
  const selectedStudentDisplaySemester = selectedStudentCheckpointSummary?.currentSemester ?? selectedStudentActiveAcademicContext?.semesterNumber ?? null
  const selectedStudentDisplayCgpa = selectedStudentCheckpointSummary?.observedEvidence.cgpa ?? selectedStudent?.currentCgpa ?? 0
  const selectedStudentCheckpointCgpaVisible = shouldShowProofCheckpointCgpa({
    proofScopeActive: selectedStudentProofScopeActive,
    semesterNumber: selectedStudentDisplaySemester,
    stageKey: selectedProofCheckpoint?.stageKey,
  })
  const selectedStudentDisplayBacklogCount = selectedStudentCheckpointSummary?.observedEvidence.backlogCount ?? null
  const selectedStudentHasCheckpointBacklogs = selectedStudentDisplayBacklogCount != null
    ? selectedStudentDisplayBacklogCount > 0
    : /(backlog|fail|repeat|detain)/i.test(selectedStudentActiveAcademicContext?.academicStatus ?? '')
  const selectedStudentPolicyBatchId = selectedStudentActiveAcademicContext?.batchId ?? null
  const selectedStudentPolicySectionCode = selectedStudentActiveAcademicContext?.sectionCode ?? null
  const selectedFacultyRecord = resolveFacultyMember(operatorData, route.facultyMemberId)
  const selectedFacultyMember = selectedFacultyRecord && isFacultyMemberVisible(operatorData, selectedFacultyRecord)
    ? selectedFacultyRecord
    : null
  const selectedRequestSummary = route.requestId ? operatorData.requests.find(item => item.adminRequestId === route.requestId) ?? null : null
  const selectedFacultyId = selectedFacultyMember?.facultyId ?? null
  const selectedFacultyCredentialStatus = resolveFacultyCredentialStatus(selectedFacultyMember)
  const selectedStudentProofBanner = formatRecordProofBanner(selectedStudent as unknown as ProvenancedRecord | null)
  const selectedFacultyProofBanner = formatRecordProofBanner(selectedFacultyMember as unknown as ProvenancedRecord | null)
  const selectedStudentCheckpointBanner = selectedStudentCheckpointSummary && selectedProofCheckpoint
    ? `Checkpoint view pinned to Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}. CGPA, queue state, and risk chips below reflect the selected proof snapshot while identity and edit flows stay canonical.`
    : ''
  const selectedStudentRouteIsExplicit = route.section === 'students' && !!route.studentId
  const selectedStudentScopeMismatch = !!selectedStudent && studentRegistryHasScope && !matchesStudentScope(selectedStudent, operatorData, studentRegistryScope)

  useEffect(() => {
    setFacultyPasswordSetupResult(null)
  }, [selectedFacultyId])

  useEffect(() => {
    const requestId = route.requestId
    if (!requestId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN' || !selectedRequestSummary) {
      setSelectedRequestDetail(null)
      setRequestDetailLoading(false)
      return
    }
    let cancelled = false
    setRequestDetailLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getAdminRequest(requestId)
        if (cancelled) return
        setSelectedRequestDetail(next)
      } catch (error) {
        if (cancelled) return
        setSelectedRequestDetail(null)
        setActionError(toErrorMessage(error))
      } finally {
        if (!cancelled) setRequestDetailLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.requestId, selectedRequestSummary, session])

  useEffect(() => {
    if (!activeSimulationRunId || activeRunCheckpoints.length === 0) {
      setSelectedProofCheckpointDetail(null)
      setProofPlaybackRestoreNotice(null)
      return
    }
    const persistedSelection = readSharedProofPlaybackSelection('system-admin')
    const currentSelectionValid = !!selectedProofCheckpointId && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === selectedProofCheckpointId)
    const persistedCheckpointId = persistedSelection?.simulationRunId === activeSimulationRunId
      ? persistedSelection.simulationStageCheckpointId
      : null
    const persistedCheckpointValid = !!persistedCheckpointId && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === persistedCheckpointId)

    if (currentSelectionValid) {
      if (selectedProofCheckpointSource === 'restored') {
        const restoredCheckpoint = activeRunCheckpoints.find(item => item.simulationStageCheckpointId === selectedProofCheckpointId) ?? null
        if (restoredCheckpoint) {
          const nextMessage = `Proof playback restored to Semester ${restoredCheckpoint.semesterNumber} · ${restoredCheckpoint.stageLabel}. Use Reset playback to clear the saved checkpoint.`
          setProofPlaybackRestoreNotice(current => current?.tone === 'neutral' && current.message === nextMessage
            ? current
            : { tone: 'neutral', message: nextMessage })
        }
      } else {
        setProofPlaybackRestoreNotice(current => current?.tone === 'error' ? current : null)
      }
      return
    }

    if (persistedCheckpointValid && persistedCheckpointId) {
      setSelectedProofCheckpointId(persistedCheckpointId)
      setSelectedProofCheckpointSource('restored')
      const restoredCheckpoint = activeRunCheckpoints.find(item => item.simulationStageCheckpointId === persistedCheckpointId) ?? null
      if (restoredCheckpoint) {
        const nextMessage = `Proof playback restored to Semester ${restoredCheckpoint.semesterNumber} · ${restoredCheckpoint.stageLabel}. Use Reset playback to clear the saved checkpoint.`
        setProofPlaybackRestoreNotice(current => current?.tone === 'neutral' && current.message === nextMessage
          ? current
          : { tone: 'neutral', message: nextMessage })
      }
      return
    }

    if (persistedSelection?.simulationStageCheckpointId) {
      clearProofPlaybackSelection()
      setProofPlaybackRestoreNotice({
        tone: 'error',
        message: 'Saved proof playback checkpoint is no longer available in this academic scope. Reset playback to return to the active proof-run view.',
      })
    } else {
      setProofPlaybackRestoreNotice(current => current?.tone === 'error' ? current : null)
    }
    setSelectedProofCheckpointSource('auto')
    setSelectedProofCheckpointId(defaultProofPlaybackCheckpointId)
  }, [activeRunCheckpoints, activeSimulationRunId, defaultProofPlaybackCheckpointId, selectedProofCheckpointId, selectedProofCheckpointSource])

  useEffect(() => {
    if (!activeSimulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) {
      setSelectedProofCheckpointDetail(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const detail = await apiClient.getProofRunCheckpointDetail(
          activeSimulationRunId,
          selectedProofCheckpoint.simulationStageCheckpointId,
        )
        if (!cancelled) setSelectedProofCheckpointDetail(detail)
      } catch (error) {
        emitClientOperationalEvent('proof.checkpoint.detail_load_failed', {
          workspace: 'system-admin',
          simulationRunId: activeSimulationRunId,
          simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        if (cancelled) return
        if (error instanceof AirMentorApiError && error.status === 404) {
          setSelectedProofCheckpointDetail(null)
          return
        }
        setActionError(toErrorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSimulationRunId, apiClient, selectedProofCheckpoint])

  useEffect(() => {
    if (!activeSimulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) {
      setSelectedProofCheckpointStudents(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await apiClient.listProofRunCheckpointStudents(
          activeSimulationRunId,
          selectedProofCheckpoint.simulationStageCheckpointId,
        )
        if (!cancelled) setSelectedProofCheckpointStudents(response.items)
      } catch (error) {
        emitClientOperationalEvent('proof.checkpoint.students_load_failed', {
          workspace: 'system-admin',
          simulationRunId: activeSimulationRunId,
          simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        if (cancelled) return
        if (error instanceof AirMentorApiError && error.status === 404) {
          setSelectedProofCheckpointStudents(null)
          return
        }
        setActionError(toErrorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSimulationRunId, apiClient, selectedProofCheckpoint])

  useEffect(() => {
    if (!proofDashboard?.activeRunDetail?.simulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) return
    writeProofPlaybackSelection({
      simulationRunId: proofDashboard.activeRunDetail.simulationRunId,
      simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
      updatedAt: new Date().toISOString(),
      workspace: 'system-admin',
      source: `system-admin-proof-dashboard:${selectedProofCheckpointSource}`,
    })
  }, [proofDashboard?.activeRunDetail?.simulationRunId, selectedProofCheckpoint?.simulationStageCheckpointId, selectedProofCheckpointSource])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    const query = deferredSearch.trim()
    const activeSearchScope = route.section === 'faculties'
      ? {
          academicFacultyId: toOptionalScopeValue(route.academicFacultyId),
          departmentId: toOptionalScopeValue(route.departmentId),
          branchId: toOptionalScopeValue(route.branchId),
          batchId: toOptionalScopeValue(route.batchId),
          sectionCode: toOptionalScopeValue(selectedSectionCode),
        }
      : route.section === 'students'
        ? studentRegistryScope
        : route.section === 'faculty-members'
          ? (hasHierarchyScopeSelection(facultyRegistryScope) ? facultyRegistryScope : null)
          : {
              academicFacultyId: toOptionalScopeValue(registryScope?.academicFacultyId),
              departmentId: toOptionalScopeValue(registryScope?.departmentId),
              branchId: toOptionalScopeValue(registryScope?.branchId),
              batchId: toOptionalScopeValue(registryScope?.batchId),
              sectionCode: toOptionalScopeValue(registryScope?.sectionCode),
            }
    if (!query) {
      setServerSearchResults([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await apiClient.searchAdminWorkspace(query, activeSearchScope ?? undefined)
        if (!cancelled) setServerSearchResults(response.items)
      } catch {
        if (!cancelled) setServerSearchResults([])
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, deferredSearch, facultyRegistryScope, registryScope?.academicFacultyId, registryScope?.batchId, registryScope?.branchId, registryScope?.departmentId, registryScope?.sectionCode, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, route.section, selectedSectionCode, session, studentRegistryHasScope, studentRegistryScope])

  useEffect(() => {
    setStudentDetailTab('profile')
  }, [selectedStudent?.studentId])

  useEffect(() => {
    setFacultyDetailTab('profile')
  }, [selectedFacultyMember?.facultyId])

  useEffect(() => {
    setShowFacultyTimetableExpanded(false)
  }, [facultyDetailTab, selectedFacultyMember?.facultyId])

  useEffect(() => {
    if (route.section === 'faculty-members' && route.facultyMemberId && !selectedFacultyMember && session && !dataLoading && data.facultyMembers.length > 0) {
      setActionError('That faculty profile is no longer available in the active workspace.')
      navigate({ section: 'faculty-members' }, { recordHistory: false })
    }
  }, [data.facultyMembers.length, dataLoading, navigate, route.facultyMemberId, route.section, selectedFacultyMember, session])

  useEffect(() => {
    if (route.section !== 'students' || !route.studentId || !session || dataLoading || data.students.length === 0 || selectedStudent) return
    setActionError('That student is no longer available in the active workspace.')
    navigate({ section: 'students' }, { recordHistory: false })
  }, [data.students.length, dataLoading, navigate, route.section, route.studentId, selectedStudent, session])

  useEffect(() => {
    if (route.section !== 'requests' || !route.requestId || !session || dataLoading) return
    if (selectedRequestSummary) return
    setActionError('That request is no longer available in the current admin workspace.')
    navigate({ section: 'requests' }, { recordHistory: false })
  }, [dataLoading, navigate, route.requestId, route.section, selectedRequestSummary, session])

  const searchResults = useMemo(() => {
    const activeSearchScope = route.section === 'faculties'
      ? {
          academicFacultyId: toOptionalScopeValue(route.academicFacultyId),
          departmentId: toOptionalScopeValue(route.departmentId),
          branchId: toOptionalScopeValue(route.branchId),
          batchId: toOptionalScopeValue(route.batchId),
          sectionCode: toOptionalScopeValue(selectedSectionCode),
        }
      : route.section === 'students'
        ? studentRegistryScope
        : route.section === 'faculty-members'
          ? (hasHierarchyScopeSelection(facultyRegistryScope) ? facultyRegistryScope : null)
          : {
              academicFacultyId: toOptionalScopeValue(registryScope?.academicFacultyId),
              departmentId: toOptionalScopeValue(registryScope?.departmentId),
              branchId: toOptionalScopeValue(registryScope?.branchId),
              batchId: toOptionalScopeValue(registryScope?.batchId),
              sectionCode: toOptionalScopeValue(registryScope?.sectionCode),
            }
    const matchesActiveSection = (candidateRoute: LiveAdminRoute) => {
      if (route.section === 'overview' || route.section === 'proof-dashboard') return true
      if (route.section === 'history') return candidateRoute.section === 'requests'
      return candidateRoute.section === route.section
    }
    const isRouteVisible = (candidateRoute: LiveAdminRoute) => {
      if (candidateRoute.section === 'requests' || candidateRoute.section === 'overview') return true
      if (candidateRoute.studentId) return isStudentVisible(operatorData, candidateRoute.studentId)
      if (candidateRoute.facultyMemberId) return isFacultyMemberVisible(operatorData, candidateRoute.facultyMemberId)
      if (candidateRoute.batchId) return isBatchVisible(operatorData, candidateRoute.batchId)
      if (candidateRoute.branchId) return isBranchVisible(operatorData, candidateRoute.branchId)
      if (candidateRoute.departmentId) return isDepartmentVisible(operatorData, candidateRoute.departmentId)
      if (candidateRoute.academicFacultyId) return isAcademicFacultyVisible(operatorData, candidateRoute.academicFacultyId)
      return true
    }
    if (serverSearchResults.length > 0) {
      return serverSearchResults.map(result => ({
        key: result.key,
        label: result.label,
        meta: result.meta,
        route: {
          section: result.route.section,
          academicFacultyId: result.route.academicFacultyId,
          departmentId: result.route.departmentId,
          branchId: result.route.branchId,
          batchId: result.route.batchId,
          studentId: result.route.studentId,
          facultyMemberId: result.route.facultyMemberId,
          requestId: result.route.requestId,
        } satisfies LiveAdminRoute,
      })).filter(result => matchesActiveSection(result.route) && isRouteVisible(result.route))
    }
    return searchLiveAdminWorkspace(operatorData, deferredSearch, {
      section: route.section,
      scope: activeSearchScope,
    }).filter(result => matchesActiveSection(result.route) && isRouteVisible(result.route))
  }, [deferredSearch, facultyRegistryScope, operatorData, registryScope?.academicFacultyId, registryScope?.batchId, registryScope?.branchId, registryScope?.departmentId, registryScope?.sectionCode, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, route.section, selectedSectionCode, serverSearchResults, studentRegistryScope])
  const selectedRequest = resolveSelectedAdminRequest(selectedRequestSummary, selectedRequestDetail)
  const requestDetail = selectedRequestDetail && selectedRequest?.adminRequestId === selectedRequestDetail.adminRequestId ? selectedRequestDetail : null

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'academic-faculty')) return
    setEntityEditors(prev => ({
      ...prev,
      academicFaculty: selectedAcademicFaculty
        ? {
            code: selectedAcademicFaculty.code,
            name: selectedAcademicFaculty.name,
            overview: selectedAcademicFaculty.overview ?? '',
          }
        : defaultEntityEditorState().academicFaculty,
    }))
  }, [editingEntity, selectedAcademicFaculty])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'department')) return
    setEntityEditors(prev => ({
      ...prev,
      department: selectedDepartment
        ? {
            code: selectedDepartment.code,
            name: selectedDepartment.name,
          }
        : defaultEntityEditorState().department,
    }))
  }, [editingEntity, selectedDepartment])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'branch')) return
    setEntityEditors(prev => ({
      ...prev,
      branch: selectedBranch
        ? {
            code: selectedBranch.code,
            name: selectedBranch.name,
            programLevel: selectedBranch.programLevel,
            semesterCount: String(selectedBranch.semesterCount),
          }
        : defaultEntityEditorState().branch,
    }))
  }, [editingEntity, selectedBranch])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'batch')) return
    const nextSemester = String(authoritativeOperationalSemester ?? selectedBatch?.currentSemester ?? 1)
    setEntityEditors(prev => ({
      ...prev,
      batch: selectedBatch
        ? {
            admissionYear: String(selectedBatch.admissionYear),
            batchLabel: selectedBatch.batchLabel,
            currentSemester: String(selectedBatch.currentSemester),
            sectionLabels: selectedBatch.sectionLabels.join(', '),
          }
        : defaultEntityEditorState().batch,
      term: defaultEntityEditorState(nextSemester).term,
      curriculum: defaultEntityEditorState(nextSemester).curriculum,
    }))
  }, [authoritativeOperationalSemester, editingEntity, selectedBatch])

  useEffect(() => {
    if (!selectedStudent) {
      setStudentForm(defaultStudentForm())
      setEnrollmentForm(defaultEnrollmentForm())
      setMentorForm(defaultMentorAssignmentForm())
      return
    }
    const latestEnrollment = findLatestEnrollment(selectedStudent)
    const latestMentorAssignment = findLatestMentorAssignment(selectedStudent)
    setStudentForm({
      usn: selectedStudent.usn,
      rollNumber: selectedStudent.rollNumber ?? '',
      name: selectedStudent.name,
      email: selectedStudent.email ?? '',
      phone: selectedStudent.phone ?? '',
      admissionDate: selectedStudent.admissionDate,
    })
    setEnrollmentForm(latestEnrollment ? {
      enrollmentId: latestEnrollment.enrollmentId,
      branchId: latestEnrollment.branchId,
      termId: latestEnrollment.termId,
      sectionCode: latestEnrollment.sectionCode,
      rosterOrder: String(latestEnrollment.rosterOrder ?? 0),
      academicStatus: latestEnrollment.academicStatus,
      startDate: latestEnrollment.startDate,
      endDate: latestEnrollment.endDate ?? '',
    } : {
      ...defaultEnrollmentForm(),
      branchId: selectedStudent.activeAcademicContext?.branchId ?? '',
      termId: selectedStudent.activeAcademicContext?.termId ?? '',
      sectionCode: selectedStudent.activeAcademicContext?.sectionCode ?? 'A',
    })
    setMentorForm(latestMentorAssignment ? {
      assignmentId: latestMentorAssignment.assignmentId,
      facultyId: latestMentorAssignment.facultyId,
      effectiveFrom: latestMentorAssignment.effectiveFrom,
      effectiveTo: latestMentorAssignment.effectiveTo ?? '',
      source: latestMentorAssignment.source,
    } : defaultMentorAssignmentForm())
  }, [selectedStudent])

  useEffect(() => {
    if (!selectedFacultyMember) {
      setFacultyForm(defaultFacultyForm())
      setAppointmentForm(defaultAppointmentForm())
      setRoleGrantForm(defaultRoleGrantForm())
      setOwnershipForm(defaultOwnershipForm())
      return
    }
    const primaryAppointment = selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0] ?? null
    const latestGrant = selectedFacultyMember.roleGrants[0] ?? null
    setFacultyForm({
      username: selectedFacultyMember.username,
      password: '',
      email: selectedFacultyMember.email,
      phone: selectedFacultyMember.phone ?? '',
      employeeCode: selectedFacultyMember.employeeCode,
      displayName: selectedFacultyMember.displayName,
      designation: selectedFacultyMember.designation,
      joinedOn: selectedFacultyMember.joinedOn ?? '',
    })
    setAppointmentForm(primaryAppointment ? {
      appointmentId: primaryAppointment.appointmentId,
      departmentId: primaryAppointment.departmentId,
      branchId: primaryAppointment.branchId ?? '',
      isPrimary: primaryAppointment.isPrimary,
      startDate: primaryAppointment.startDate,
      endDate: primaryAppointment.endDate ?? '',
    } : defaultAppointmentForm())
    setRoleGrantForm(latestGrant ? {
      grantId: latestGrant.grantId,
      roleCode: latestGrant.roleCode,
      scopeType: latestGrant.scopeType,
      scopeId: latestGrant.scopeId,
      startDate: latestGrant.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: latestGrant.endDate ?? '',
    } : defaultRoleGrantForm())
    setOwnershipForm({
      ...defaultOwnershipForm(),
      facultyId: selectedFacultyMember.facultyId,
    })
  }, [operatorData.ownerships, selectedFacultyMember])

  useEffect(() => {
    if (!selectedStudentPolicyBatchId) {
      setSelectedStudentPolicy(null)
      setSelectedStudentPolicyLoading(false)
      return
    }
    let cancelled = false
    setSelectedStudentPolicyLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(selectedStudentPolicyBatchId, { sectionCode: selectedStudentPolicySectionCode })
        if (!cancelled) setSelectedStudentPolicy(next)
      } catch {
        if (!cancelled) setSelectedStudentPolicy(null)
      } finally {
        if (!cancelled) setSelectedStudentPolicyLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedStudentPolicyBatchId, selectedStudentPolicySectionCode])

  useEffect(() => {
    if (!selectedStudent) {
      setStudentAuditEvents([])
      setStudentAuditLoading(false)
      return
    }
    let cancelled = false
    setStudentAuditLoading(true)
    void (async () => {
      const requests = [
        apiClient.listAuditEvents({ entityType: 'Student', entityId: selectedStudent.studentId }),
        ...selectedStudent.enrollments.map(item => apiClient.listAuditEvents({ entityType: 'StudentEnrollment', entityId: item.enrollmentId })),
        ...selectedStudent.mentorAssignments.map(item => apiClient.listAuditEvents({ entityType: 'MentorAssignment', entityId: item.assignmentId })),
      ]
      const settled = await Promise.allSettled(requests)
      const items = settled.flatMap(result => result.status === 'fulfilled' ? result.value.items : [])
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      if (!cancelled) {
        setStudentAuditEvents(items)
        setStudentAuditLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedStudent])

  useEffect(() => {
    if (!selectedFacultyMember) {
      setFacultyAuditEvents([])
      setFacultyAuditLoading(false)
      return
    }
    let cancelled = false
    setFacultyAuditLoading(true)
    void (async () => {
      const facultyOwnerships = operatorData.ownerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
      const requests = [
        apiClient.listAuditEvents({ entityType: 'FacultyProfile', entityId: selectedFacultyMember.facultyId }),
        ...selectedFacultyMember.appointments.map(item => apiClient.listAuditEvents({ entityType: 'FacultyAppointment', entityId: item.appointmentId })),
        ...selectedFacultyMember.roleGrants.map(item => apiClient.listAuditEvents({ entityType: 'RoleGrant', entityId: item.grantId })),
        ...facultyOwnerships.map(item => apiClient.listAuditEvents({ entityType: 'faculty_offering_ownership', entityId: item.ownershipId })),
      ]
      const settled = await Promise.allSettled(requests)
      const items = settled.flatMap(result => result.status === 'fulfilled' ? result.value.items : [])
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      if (!cancelled) {
        setFacultyAuditEvents(items)
        setFacultyAuditLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, operatorData.ownerships, selectedFacultyMember])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setRecentAuditEvents([])
      setRecentAuditLoading(false)
      return
    }
    let cancelled = false
    setRecentAuditLoading(true)
    void (async () => {
      try {
        const response = await apiClient.listRecentAdminAuditEvents(90)
        if (!cancelled) setRecentAuditEvents(response.items)
      } catch {
        if (!cancelled) setRecentAuditEvents([])
      } finally {
        if (!cancelled) setRecentAuditLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, session])

  useEffect(() => {
    if (!selectedFacultyId) {
      setFacultyCalendar(null)
      setFacultyCalendarLoading(false)
      return
    }
    let cancelled = false
    setFacultyCalendarLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getAdminFacultyCalendar(selectedFacultyId)
        if (!cancelled) setFacultyCalendar(next)
      } catch {
        if (!cancelled) setFacultyCalendar(null)
      } finally {
        if (!cancelled) setFacultyCalendarLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedFacultyId])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      const loginSession = await apiClient.login({ identifier, password })
      setSession(loginSession); setIdentifier(''); setPassword('')
      void settleCookieBackedSession('login', loginSession)
        .then(settledSession => {
          setSession(current => {
            if (!current) return current
            if (current.sessionId !== loginSession.sessionId) return current
            if (current.activeRoleGrant.grantId !== loginSession.activeRoleGrant.grantId) return current
            if (areSessionResponsesEquivalent(current, settledSession)) return current
            return settledSession
          })
        })
        .catch(error => {
          setAuthError(toErrorMessage(error))
        })
    } catch (error) {
      setAuthError(toErrorMessage(error))
    }
    finally { setAuthBusy(false) }
  }

  const handleLogout = async () => {
    const activeSessionId = session?.sessionId ?? null
    clearRegistryScope()
    setDismissedQueueItemKeys([])
    setSession(null)
    setData(EMPTY_DATA)
    setStagePolicyOverrides([])
    setDataError('')
    onExitPortal?.()
    void apiClient.logout().catch(error => {
      emitClientOperationalEvent('auth.session.logout_failed', {
        workspace: 'system-admin',
        sessionId: activeSessionId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
    })
  }

  const handleSwitchToSystemAdmin = async () => {
    if (!systemAdminGrant) return
    setAuthBusy(true); setAuthError('')
    try {
      const switchedSession = await apiClient.switchRoleContext(systemAdminGrant.grantId)
      setSession(switchedSession)
      void settleCookieBackedSession('role-switch', switchedSession)
        .then(settledSession => {
          setSession(current => {
            if (!current) return current
            if (current.sessionId !== switchedSession.sessionId) return current
            if (current.activeRoleGrant.grantId !== switchedSession.activeRoleGrant.grantId) return current
            if (areSessionResponsesEquivalent(current, settledSession)) return current
            return settledSession
          })
        })
        .catch(error => {
          setAuthError(toErrorMessage(error))
        })
    }
    catch (error) {
      setAuthError(toErrorMessage(error))
    }
    finally { setAuthBusy(false) }
  }

  const runAction = useCallback(async <T,>(runner: () => Promise<T>) => {
    setActionError('')
    try {
      const result = await runner()
      await loadAdminData()
      return result
    } catch (error) {
      if (error instanceof AirMentorApiError && error.status === 409 && /stale version/i.test(error.message)) {
        await loadAdminData()
        setActionError(`${error.message}. Reloaded the latest server state. Please review the record and try again.`)
        return null
      }
      setActionError(toErrorMessage(error))
      return null
    }
  }, [loadAdminData])

  const retryCurriculumProofRefresh = useCallback(async () => {
    if (!curriculumProofRefreshRetry) return
    await runAction(async () => {
      const refreshed = await queueProofRefreshBatches(
        curriculumProofRefreshRetry.batchIds,
        'curriculum-proof-refresh-retry',
        curriculumProofRefreshRetry.curriculumImportVersionId,
      )
      setCurriculumProofRefreshRetry(null)
      setFlashMessage(
        refreshed.length > 0
          ? `Proof refresh retried for ${refreshed.length} affected batch${refreshed.length === 1 ? '' : 'es'}.`
          : 'Proof refresh retry did not need to queue a new run.',
      )
    })
  }, [curriculumProofRefreshRetry, queueProofRefreshBatches, runAction])

  const handleCreateReminder = async () => {
    if (!remindersSupported) {
      setActionError('This live backend does not expose private admin reminders yet. Deploy the latest API to enable them.')
      return
    }
    const title = window.prompt('Reminder title')
    if (!title?.trim()) return
    const body = window.prompt('Reminder note', 'Follow up with HoD / verify structure change / review pending implementation.') ?? ''
    const dueAt = window.prompt('Due date and time (YYYY-MM-DDTHH:mm)', `${new Date().toISOString().slice(0, 16)}`) ?? ''
    if (!dueAt.trim()) return
    await runAction(async () => {
      await apiClient.createAdminReminder({
        title: title.trim(),
        body: body.trim() || 'Personal admin reminder.',
        dueAt: dueAt.trim(),
        status: 'pending',
      })
      setFlashMessage('Reminder created.')
    })
  }

  const handleToggleReminderStatus = async (reminder: LiveAdminDataset['reminders'][number]) => {
    if (!remindersSupported) {
      setActionError('Private reminders are not available on this backend yet.')
      return
    }
    await runAction(async () => {
      await apiClient.updateAdminReminder(reminder.reminderId, {
        title: reminder.title,
        body: reminder.body,
        dueAt: reminder.dueAt,
        status: reminder.status === 'pending' ? 'done' : 'pending',
        version: reminder.version,
      })
      setFlashMessage(reminder.status === 'pending' ? 'Reminder completed.' : 'Reminder reopened.')
    })
  }

  const startEditingTerm = (termId: string) => {
    const target = data.terms.find(item => item.termId === termId)
    if (!target) return
    setEntityEditors(prev => ({
      ...prev,
      term: {
        termId: target.termId,
        academicYearLabel: target.academicYearLabel,
        semesterNumber: String(target.semesterNumber),
        startDate: target.startDate,
        endDate: target.endDate,
      },
    }))
  }

  const resetTermEditor = () => {
    setEntityEditors(prev => ({
      ...prev,
      term: defaultEntityEditorState(String(authoritativeOperationalSemester ?? 1)).term,
    }))
  }

  const startEditingCurriculumCourse = (curriculumCourseId: string) => {
    const target = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!target) return
    setSelectedCurriculumSemester(String(target.semesterNumber))
    setSelectedCurriculumCourseId(target.curriculumCourseId)
    setEntityEditors(prev => ({
      ...prev,
      curriculum: {
        curriculumCourseId: target.curriculumCourseId,
        semesterNumber: String(target.semesterNumber),
        courseCode: target.courseCode,
        title: target.title,
        credits: String(target.credits),
      },
    }))
  }

  const resetCurriculumEditor = () => {
    setEntityEditors(prev => ({
      ...prev,
      curriculum: defaultEntityEditorState(selectedCurriculumSemester || String(authoritativeOperationalSemester ?? 1)).curriculum,
    }))
  }

  const handleUpdateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', entityEditors.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', entityEditors.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', entityEditors.academicFaculty.overview).trim() || null,
        status: selectedAcademicFaculty.status,
        version: selectedAcademicFaculty.version,
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setFlashMessage('Academic faculty updated.')
    setEditingEntity(null)
  }

  const handleArchiveAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Archive ${selectedAcademicFaculty.name}? Departments, branches, years, students, and faculty tied to this scope will disappear from the working views until you restore it from History.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'archived',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty archived. Restore it from History when needed.')
    })
  }

  const handleDeleteAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Delete ${selectedAcademicFaculty.name}? This removes the faculty scope from working views, including its departments, branches, years, and linked registries, and sends the faculty to the recycle bin.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'deleted',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty moved to recycle bin.')
    })
  }

  const handleRestoreAcademicFaculty = async (academicFaculty = selectedAcademicFaculty) => {
    if (!academicFaculty) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(academicFaculty.academicFacultyId, {
        code: academicFaculty.code,
        name: academicFaculty.name,
        overview: academicFaculty.overview,
        status: 'active',
        version: academicFaculty.version,
      })
      navigate({ section: 'faculties', academicFacultyId: academicFaculty.academicFacultyId })
      setFlashMessage('Academic faculty restored.')
    })
  }

  const handleUpdateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', entityEditors.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', entityEditors.department.name)),
        status: selectedDepartment.status,
        version: selectedDepartment.version,
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setFlashMessage('Department updated.')
    setEditingEntity(null)
  }

  const handleArchiveDepartment = async () => {
    if (!selectedDepartment) return
    const activeCourseCount = data.courses.filter(item => item.departmentId === selectedDepartment.departmentId && isVisibleAdminRecord(item.status)).length
    const activeAppointmentCount = data.facultyMembers
      .flatMap(item => item.appointments)
      .filter(item => item.departmentId === selectedDepartment.departmentId && item.status === 'active').length
    if (departmentBranches.length > 0 || activeCourseCount > 0 || activeAppointmentCount > 0) {
      setActionError('Clear branches, course catalog links, and faculty appointments before archiving this department.')
      return
    }
    await runAction(async () => {
      await apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedDepartment.academicFacultyId,
        code: selectedDepartment.code,
        name: selectedDepartment.name,
        status: 'deleted',
        version: selectedDepartment.version,
      })
      navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId })
      setFlashMessage('Department archived.')
    })
  }

  const handleUpdateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', entityEditors.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', entityEditors.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', entityEditors.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', entityEditors.branch.semesterCount)),
        status: selectedBranch.status,
        version: selectedBranch.version,
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setFlashMessage('Branch updated.')
    setEditingEntity(null)
  }

  const handleArchiveBranch = async () => {
    if (!selectedBranch) return
    const activeTermCount = data.terms.filter(item => item.branchId === selectedBranch.branchId && isVisibleAdminRecord(item.status)).length
    if (branchBatches.length > 0 || activeTermCount > 0) {
      setActionError('Archive or move branch batches and terms before archiving the branch.')
      return
    }
    await runAction(async () => {
      await apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: selectedBranch.code,
        name: selectedBranch.name,
        programLevel: selectedBranch.programLevel,
        semesterCount: selectedBranch.semesterCount,
        status: 'deleted',
        version: selectedBranch.version,
      })
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
      })
      setFlashMessage('Branch archived.')
    })
  }

  const handleUpdateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBatch || !selectedBranch) return
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', entityEditors.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', entityEditors.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', entityEditors.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', entityEditors.batch.currentSemester)),
        sectionLabels,
        status: selectedBatch.status,
        version: selectedBatch.version,
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setFlashMessage('Batch updated.')
    setEditingEntity(null)
  }

  const handleArchiveBatch = async () => {
    if (!selectedBatch || !selectedBranch) return
    const activeStudentCount = data.students.filter(item => item.status === 'active' && item.activeAcademicContext?.batchId === selectedBatch.batchId).length
    const activeTermCount = batchTerms.length
    const activeCurriculumCount = data.curriculumCourses.filter(item => item.batchId === selectedBatch.batchId && isVisibleAdminRecord(item.status)).length
    if (activeStudentCount > 0 || activeTermCount > 0 || activeCurriculumCount > 0) {
      setActionError('Archive the batch’s terms and curriculum, and remap active students before archiving the batch.')
      return
    }
    await runAction(async () => {
      await apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: selectedBatch.admissionYear,
        batchLabel: selectedBatch.batchLabel,
        currentSemester: selectedBatch.currentSemester,
        sectionLabels: selectedBatch.sectionLabels,
        status: 'deleted',
        version: selectedBatch.version,
      })
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
        branchId: selectedBranch.branchId,
      })
      setFlashMessage('Batch archived.')
    })
  }

  const handleCreateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.createAcademicFaculty({
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', structureForms.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', structureForms.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', structureForms.academicFaculty.overview).trim() || null,
        status: 'active',
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setStructureForms(prev => ({ ...prev, academicFaculty: { code: '', name: '', overview: '' } }))
    setFlashMessage('Academic faculty created.')
  }

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.createDepartment({
        academicFacultyId: selectedAcademicFaculty.academicFacultyId,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', structureForms.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', structureForms.department.name)),
        status: 'active',
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setStructureForms(prev => ({ ...prev, department: { code: '', name: '' } }))
    setFlashMessage('Department created.')
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.createBranch({
        departmentId: selectedDepartment.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', structureForms.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', structureForms.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', structureForms.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', structureForms.branch.semesterCount)),
        status: 'active',
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setStructureForms(prev => ({ ...prev, branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' } }))
    setFlashMessage('Branch created.')
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', structureForms.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.createBatch({
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', structureForms.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', structureForms.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', structureForms.batch.currentSemester)),
        sectionLabels,
        status: 'active',
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setStructureForms(prev => ({ ...prev, batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' } }))
    setFlashMessage('Batch created.')
  }

  const handleSaveTerm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch || !selectedBatch) return
    await runAction(async () => {
      if (entityEditors.term.termId) {
        const current = data.terms.find(item => item.termId === entityEditors.term.termId)
        if (!current) throw new Error('Selected term could not be found.')
        await apiClient.updateTerm(current.termId, {
          branchId: selectedBranch.branchId,
          batchId: selectedBatch.batchId,
          academicYearLabel: requireText('Academic year label', entityEditors.term.academicYearLabel),
          semesterNumber: requirePositiveInteger('Semester number', entityEditors.term.semesterNumber),
          startDate: requireDate('Term start date', entityEditors.term.startDate),
          endDate: requireDate('Term end date', entityEditors.term.endDate),
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Academic term updated.')
      } else {
        await apiClient.createTerm({
          branchId: selectedBranch.branchId,
          batchId: selectedBatch.batchId,
          academicYearLabel: requireText('Academic year label', entityEditors.term.academicYearLabel),
          semesterNumber: requirePositiveInteger('Semester number', entityEditors.term.semesterNumber),
          startDate: requireDate('Term start date', entityEditors.term.startDate),
          endDate: requireDate('Term end date', entityEditors.term.endDate),
          status: 'active',
        })
        setFlashMessage('Academic term created.')
      }
      resetTermEditor()
    })
  }

  const handleArchiveTerm = async (termId: string) => {
    const target = data.terms.find(item => item.termId === termId)
    if (!target) return
    await runAction(async () => {
      await apiClient.updateTerm(target.termId, {
        branchId: target.branchId,
        batchId: target.batchId,
        academicYearLabel: target.academicYearLabel,
        semesterNumber: target.semesterNumber,
        startDate: target.startDate,
        endDate: target.endDate,
        status: 'deleted',
        version: target.version,
      })
      if (entityEditors.term.termId === termId) resetTermEditor()
      setFlashMessage('Academic term archived.')
    })
  }

  const handleSaveCurriculumCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBatch) return
    await runAction(async () => {
      let courseCodeForRefresh = entityEditors.curriculum.courseCode
      const matchingCourse = data.courses.find(item => item.courseCode.toLowerCase() === entityEditors.curriculum.courseCode.toLowerCase() && isVisibleAdminRecord(item.status)) ?? null
      if (entityEditors.curriculum.curriculumCourseId) {
        const current = data.curriculumCourses.find(item => item.curriculumCourseId === entityEditors.curriculum.curriculumCourseId)
        if (!current) throw new Error('Selected curriculum course could not be found.')
        courseCodeForRefresh = current.courseCode
        await apiClient.updateCurriculumCourse(current.curriculumCourseId, {
          batchId: selectedBatch.batchId,
          semesterNumber: requirePositiveInteger('Curriculum semester number', entityEditors.curriculum.semesterNumber),
          courseId: matchingCourse?.courseId ?? null,
          courseCode: requireText('Course code', entityEditors.curriculum.courseCode),
          title: requireText('Course title', entityEditors.curriculum.title),
          credits: requirePositiveInteger('Course credits', entityEditors.curriculum.credits),
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Curriculum course updated.')
      } else {
        await apiClient.createCurriculumCourse({
          batchId: selectedBatch.batchId,
          semesterNumber: requirePositiveInteger('Curriculum semester number', entityEditors.curriculum.semesterNumber),
          courseId: matchingCourse?.courseId ?? null,
          courseCode: requireText('Course code', entityEditors.curriculum.courseCode),
          title: requireText('Course title', entityEditors.curriculum.title),
          credits: requirePositiveInteger('Course credits', entityEditors.curriculum.credits),
          status: 'active',
        })
        setFlashMessage('Curriculum course created.')
      }
      resetCurriculumEditor()
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(`Curriculum course saved for ${courseCodeForRefresh}. Any required proof refresh is now queued by the backend.`)
    })
  }

  const handleBootstrapCurriculumManifest = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const result = await apiClient.bootstrapCurriculum(selectedBatch.batchId, { manifestKey: 'msruas-mnc-seed' })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        queuedCount > 0
          ? `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, generated ${result.generatedCandidateCount} prerequisite suggestion${result.generatedCandidateCount === 1 ? '' : 's'}, and queued ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'}.${generationNote}`
          : `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, and generated ${result.generatedCandidateCount} prerequisite suggestion${result.generatedCandidateCount === 1 ? '' : 's'}.${generationNote}`,
      )
    })
  }

  const handleRegenerateCurriculumLinkageCandidates = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.regenerateCurriculumLinkageCandidates(selectedBatch.batchId, {
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.regeneration_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.regenerated', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
        generatedCount: result.items.length,
        candidateGenerationStatus: result.candidateGenerationStatus.status,
      })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        result.items.length > 0
          ? `Generated ${result.items.length} prerequisite suggestion${result.items.length === 1 ? '' : 's'} for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`
          : `No prerequisite suggestions generated for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`,
      )
    })
  }

  const handleApproveCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.approveCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
          reviewNote: curriculumLinkageReviewNote.trim() || undefined,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.approval_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumLinkageCandidateId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.approved', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumLinkageCandidateId,
        affectedBatchIds: result.affectedBatchIds,
        proofRefreshQueued: result.proofRefreshQueued,
        proofRefreshStatus: result.proofRefresh?.status ?? null,
        queuedProofRefreshCount: getQueuedProofRefreshCount(result),
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      setCurriculumLinkageReviewNote('')
      if (!result.proofRefreshQueued && result.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: result.affectedBatchIds,
          curriculumImportVersionId: result.curriculumImportVersionId,
          message: result.proofRefreshWarning
            ?? 'Prerequisite suggestion accepted, but proof refresh queueing failed for one or more affected batches. Retry immediately to restore proof parity.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(
        !result.proofRefreshQueued
          ? `Suggestion accepted, but proof refresh queueing failed. ${result.proofRefreshWarning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
          : queuedCount > 0
          ? `Suggestion accepted and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
          : 'Prerequisite suggestion accepted.',
      )
    })
  }

  const handleRejectCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.rejectCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
        reviewNote: curriculumLinkageReviewNote.trim() || undefined,
      })
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      setCurriculumLinkageReviewNote('')
      setFlashMessage('Prerequisite suggestion rejected.')
    })
  }

  const handleArchiveCurriculumCourse = async (curriculumCourseId: string) => {
    const current = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!current) return
    await runAction(async () => {
      await apiClient.updateCurriculumCourse(current.curriculumCourseId, {
        batchId: current.batchId,
        semesterNumber: current.semesterNumber,
        courseId: current.courseId,
        courseCode: current.courseCode,
        title: current.title,
        credits: current.credits,
        status: 'deleted',
        version: current.version,
      })
      if (entityEditors.curriculum.curriculumCourseId === curriculumCourseId) resetCurriculumEditor()
      await loadAdminData()
      await refreshCurriculumFeatureConfig(current.batchId)
      await refreshCurriculumLinkageCandidates(current.batchId)
      await refreshProofDashboard(current.batchId)
      setFlashMessage(`Curriculum course archived for ${current.courseCode}. Any required proof refresh is now queued by the backend.`)
    })
  }

  const handleSaveCurriculumFeatureConfig = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const payload = buildCurriculumFeaturePayload(curriculumFeatureForm)
      validateCurriculumFeaturePrerequisites(selectedCurriculumFeatureItem, payload.prerequisites, curriculumFeatureItems)
      const [targetScopeType, targetScopeId] = curriculumFeatureTargetScopeKey.split('::')
      const saved = await apiClient.saveCurriculumFeatureConfig(selectedBatch.batchId, selectedCurriculumFeatureItem.curriculumCourseId, {
        ...payload,
        targetMode: curriculumFeatureTargetMode,
        targetScopeType: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeType as ApiScopeType : undefined,
        targetScopeId: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeId : undefined,
      })
      const nextBundle = await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const nextSelected = nextBundle.items.find(item => item.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId) ?? null
      setCurriculumFeatureForm(hydrateCurriculumFeatureForm(nextSelected))
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds?.length) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? `Curriculum model inputs were saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed for one or more affected batches.`,
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum model inputs saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued for ${selectedCurriculumFeatureItem.courseCode}.`
          : `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}.`)
    })
  }

  const handleLoadCurriculumFeatureHistory = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const result = await apiClient.getCurriculumFeatureConfigHistory(
        selectedBatch.batchId,
        selectedCurriculumFeatureItem.curriculumCourseId,
      )
      setCurriculumFeatureHistory(result.events)
    })
  }

  const handlePreviewCurriculumFeatureConfig = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const payload = buildCurriculumFeaturePayload(curriculumFeatureForm)
      const result = await apiClient.previewCurriculumFeatureConfig(
        selectedBatch.batchId,
        selectedCurriculumFeatureItem.curriculumCourseId,
        payload.outcomes.map(o => ({ id: o.id, bloom: o.bloom })),
      )
      setCurriculumFeaturePreview(result)
    })
  }

  const handleSaveCurriculumFeatureBinding = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const saved = await apiClient.saveCurriculumFeatureBinding(selectedBatch.batchId, {
        bindingMode: curriculumFeatureBindingMode,
        curriculumFeatureProfileId: curriculumFeatureBindingMode === 'pin-profile' ? (curriculumFeaturePinnedProfileId || null) : null,
        status: 'active',
        version: curriculumFeatureConfig?.binding?.version ?? 1,
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? 'Curriculum feature binding was saved, but proof refresh queueing failed for one or more affected batches.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum feature binding saved, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum feature binding saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
          : 'Curriculum feature binding saved.')
    })
  }

  const handleSaveScopePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const existing = activeScopePolicyOverride
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildValidatedPolicyPayload(policyForm),
        status: 'active',
      }
      if (existing) await apiClient.updatePolicyOverride(existing.policyOverrideId, { ...payload, version: existing.version })
      else await apiClient.createPolicyOverride(payload)
      await loadAdminData()
      if (preferredGovernanceBatchId) {
        const nextResolved = await apiClient.getResolvedBatchPolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'policy refresh')
        : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} policy saved.`)
    })
  }

  const handleResetScopePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting governance.')
      return
    }
    if (!activeScopePolicyOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
      return
    }
    const existing = activeScopePolicyOverride
    if (!existing) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
      return
    }
    await runAction(async () => {
      await apiClient.updatePolicyOverride(existing.policyOverrideId, {
        scopeType: existing.scopeType,
        scopeId: existing.scopeId,
        policy: existing.policy,
        status: 'archived',
        version: existing.version,
      })
      await loadAdminData()
      let nextResolved: ApiResolvedBatchPolicy | null = null
      if (preferredGovernanceBatchId) {
        nextResolved = await apiClient.getResolvedBatchPolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
        setPolicyForm(hydratePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'policy reset')
        : []
      const rollbackMessage = describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedBatchPolicy,
        subject: 'policy',
      })
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy override reset and proof batch refreshed. ${rollbackMessage}`
        : `${activeGovernanceScope.label} policy override reset. ${rollbackMessage}`)
    })
  }

  const handleSaveScopeStagePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildStagePolicyPayload(stagePolicyForm),
        status: 'active',
      }
      if (activeScopeStageOverride) await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, { ...payload, version: activeScopeStageOverride.version })
      else await apiClient.createStagePolicyOverride(payload)
      await loadAdminData()
      if (preferredGovernanceBatchId) {
        const nextResolved = await apiClient.getResolvedStagePolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'stage policy refresh')
        : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} stage policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} stage policy saved.`)
    })
  }

  const handleResetScopeStagePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting stage policy.')
      return
    }
    if (!activeScopeStageOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      }))
      return
    }
    await runAction(async () => {
      await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, {
        scopeType: activeScopeStageOverride.scopeType,
        scopeId: activeScopeStageOverride.scopeId,
        policy: activeScopeStageOverride.policy,
        status: 'archived',
        version: activeScopeStageOverride.version,
      })
      await loadAdminData()
      let nextResolved: ApiResolvedBatchStagePolicy | null = null
      if (preferredGovernanceBatchId) {
        nextResolved = await apiClient.getResolvedStagePolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
        setStagePolicyForm(hydrateStagePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = activeGovernanceProofRefreshBatchIds.length > 0
        ? await queueProofRefreshBatches(activeGovernanceProofRefreshBatchIds, 'stage policy reset')
        : []
      const rollbackMessage = describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedStagePolicy,
        subject: 'stage policy',
      })
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} stage policy override reset and proof batch refreshed. ${rollbackMessage}`
        : `${activeGovernanceScope.label} stage policy override reset. ${rollbackMessage}`)
    })
  }

  const handleAdvanceOfferingStage = async () => {
    if (!selectedStageOffering) return
    await runAction(async () => {
      const nextEligibility = await apiClient.advanceOfferingStage(selectedStageOffering.offId)
      setSelectedStageEligibility(nextEligibility)
      await loadAdminData()
      setFlashMessage(`${selectedStageOffering.code} · Section ${selectedStageOffering.section} advanced to ${nextEligibility.currentStage.label}.`)
    })
  }

  const handleProvisionBatch = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const payload = buildBatchProvisioningPayload(batchProvisioningForm)
      const result = await apiClient.provisionBatch(selectedBatch.batchId, payload)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      if (selectedBatch.batchId === route.batchId) {
        await refreshProofDashboard(selectedBatch.batchId)
      }
      const queuedCount = getQueuedProofRefreshCount(result)
      setFlashMessage(
        queuedCount > 0
          ? `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, ${result.summary.createdMentorCount} mentor links, and ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'} for ${selectedBatch.batchLabel}.`
          : `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, and ${result.summary.createdMentorCount} mentor links for ${selectedBatch.batchLabel}.`,
      )
    })
  }

  const handleProvisionSeededDemoWorkspace = async () => {
    if (!selectedBatch) return
    if (!window.confirm(`Provision a disposable seeded demo workspace for ${selectedBatch.batchLabel}?`)) return
    const activeSessionId = session?.sessionId ?? null
    setActionError('')
    try {
      const workspace = await apiClient.createDemoWorkspace({
        name: `MSRUAS seeded demo · ${selectedBatch.batchLabel}`,
        ownerFacultyId: session?.faculty?.facultyId ?? undefined,
        batchId: selectedBatch.batchId,
      })
      const provisioned = await apiClient.provisionDemoWorkspace(workspace.demoWorkspaceId)
      await apiClient.logout().catch(error => {
        emitClientOperationalEvent('auth.session.logout_failed', {
          workspace: 'system-admin',
          sessionId: activeSessionId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
      })
      writeActiveDemoWorkspacePointer({ demoWorkspaceId: workspace.demoWorkspaceId })
      clearRegistryScope()
      setDismissedQueueItemKeys([])
      setSession(null)
      setData(EMPTY_DATA)
      setStagePolicyOverrides([])
      setDataError('')
      setPassword('')
      setFlashMessage('')
      if (typeof window !== 'undefined') {
        window.alert(`Seeded demo workspace ready with ${provisioned.provisionedCounts.checkpoints} checkpoints, ${provisioned.provisionedCounts.observedStates} observed states, and ${provisioned.provisionedCounts.riskAssessments} risk assessments. Sign in again to enter the demo workspace.`)
      }
    } catch (error) {
      setActionError(toErrorMessage(error))
    }
  }

  const handlePreviewBulkMentorAssignment = async () => {
    if (!selectedBatch) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentPreviewPayload(selectedBatch.batchId, selectedSectionCode, bulkMentorAssignmentForm),
    ))
    if (!result) return
    setBulkMentorAssignmentPreview(result)
    setFlashMessage(describeBulkMentorPreview(result))
  }

  const handleApplyBulkMentorAssignment = async () => {
    if (!selectedBatch || !bulkMentorAssignmentPreview) return
    if (
      bulkMentorAssignmentPreview.summary.createdAssignmentCount === 0
      && bulkMentorAssignmentPreview.summary.endedAssignmentCount === 0
    ) {
      setFlashMessage('The current preview does not contain any mentor changes to apply.')
      return
    }
    if (!window.confirm(`Apply mentor changes for ${bulkMentorAssignmentPreview.scopeLabel}?`)) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentApplyPayload(
        selectedBatch.batchId,
        selectedSectionCode,
        bulkMentorAssignmentForm,
        bulkMentorAssignmentPreview.studentIds,
      ),
    ))
    if (!result) return
    await loadAdminData()
    setBulkMentorAssignmentPreview(null)
    setFlashMessage(
      `${result.summary.createdAssignmentCount} mentor links applied and ${result.summary.endedAssignmentCount} active links end-dated for ${result.scopeLabel}.`,
    )
  }

  const handleCreateProofImport = async () => {
    await runAction(async () => {
      await apiClient.createProofImport(proofControlBatchId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof curriculum import created from the reconciled workbook.')
    })
  }

  const handleValidateLatestProofImport = async () => {
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.validateProofImport(latestImport.curriculumImportVersionId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Latest proof import validated.')
    })
  }

  const handleReviewPendingCrosswalks = async () => {
    if (!proofDashboard?.crosswalkReviewQueue.length || !proofDashboard.imports[0]) return
    await runAction(async () => {
      await apiClient.reviewProofCrosswalks(proofDashboard.imports[0].curriculumImportVersionId, {
        reviews: proofDashboard.crosswalkReviewQueue.map(item => ({
          officialCodeCrosswalkId: item.officialCodeCrosswalkId,
          reviewStatus: 'accepted-with-note',
          overrideReason: 'Reviewed in the sysadmin proof shell for the first-6-semester proof batch.',
        })),
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Pending proof crosswalk entries marked as reviewed.')
    })
  }

  const handleApproveLatestProofImport = async () => {
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.approveProofImport(latestImport.curriculumImportVersionId)
      const rerun = await queueSelectedProofRefresh('proof import approval', latestImport.curriculumImportVersionId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(
        rerun.length > 0
          ? 'Latest proof import approved, synced into the batch curriculum snapshot, and republished as the active proof run.'
          : 'Latest proof import approved and synced into the batch curriculum snapshot.',
      )
    })
  }

  const handleCreateProofRun = async () => {
    const preferredImport = proofDashboard?.imports.find(item => item.status === 'approved') ?? proofDashboard?.imports[0]
    if (!preferredImport) return
    await runAction(async () => {
      const queuedRun = await apiClient.createProofRun(proofControlBatchId, {
        curriculumImportVersionId: preferredImport.curriculumImportVersionId,
        activate: true,
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof simulation rerun queued as ${queuedRun.simulationRunId}. It will publish automatically when background execution completes.`)
    })
  }

  const handleCreateProofSimulation = async () => {
    await runAction(async () => {
      const createdImport = await apiClient.createProofImport(proofControlBatchId)
      await refreshCurriculumFeatureConfig(proofControlBatchId)
      const queuedRun = await apiClient.createProofRun(proofControlBatchId, {
        curriculumImportVersionId: createdImport.curriculumImportVersionId,
        activate: true,
      })
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof simulation created as ${queuedRun.simulationRunId}. It will publish automatically when background execution completes.`)
    })
  }

  const handleRetryProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.retryProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Failed proof run re-queued for background execution.')
    })
  }

  const handleActivateProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.activateProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Selected proof run is now active.')
    })
  }

  const handleActivateProofSemester = async (simulationRunId: string, semesterNumber: number) => {
    await runAction(async () => {
      const activation = await apiClient.activateProofSemester(simulationRunId, {
        semesterNumber: semesterNumber as 1 | 2 | 3 | 4 | 5 | 6,
      })
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(batch => (
          batch.batchId === activation.batchId
            ? {
                ...batch,
                currentSemester: activation.activeOperationalSemester,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )),
      }))
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(`Proof operational semester switched to Semester ${semesterNumber}.`)
    })
  }

  const handleAdvanceProofRun = async (simulationRunId: string, mode: ProofAdvanceControlMode) => {
    await runAction(async () => {
      try {
        await apiClient.advanceProofRun(simulationRunId, { mode })
      } catch (error) {
        if (error instanceof AirMentorApiError && error.status === 409) {
          await refreshProofDashboard(proofControlBatchId)
          setFlashMessage('Proof run is still preparing checkpoints. Refreshed status; retry when progress finishes.')
          return
        }
        throw error
      }
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage(mode === 'day' ? 'Proof simulation advanced by one day.' : 'Proof simulation advanced to the next stage.')
    })
  }

  const handleStopProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.stopProofRun(simulationRunId)
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof simulation stopped.')
    })
  }

  const handleArchiveProofRun = async (simulationRunId: string) => {
    await runAction(async () => {
      await apiClient.archiveProofRun(simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Selected proof run archived.')
    })
  }

  const handleRecomputeProofRunRisk = async () => {
    if (!proofDashboard?.activeRunDetail) return
    const activeRunDetail = proofDashboard.activeRunDetail
    await runAction(async () => {
      await apiClient.recomputeProofRunRisk(activeRunDetail.simulationRunId)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Observable-only risk recomputed for the active proof run.')
    })
  }

  const handleRestoreProofSnapshot = async (simulationRunId: string, simulationResetSnapshotId?: string) => {
    await runAction(async () => {
      await apiClient.restoreProofRunSnapshot(simulationRunId, simulationResetSnapshotId ? { simulationResetSnapshotId } : undefined)
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof run restored from the selected snapshot.')
    })
  }

  const handleResetProofRunFromScratch = async (simulationRunId: string, simulationResetSnapshotId?: string) => {
    if (!simulationResetSnapshotId) return
    if (!window.confirm('Reset the active proof branch from the baseline snapshot and pin it back to Semester 1? This creates a fresh run and replaces the current active proof run.')) return
    await runAction(async () => {
      const restored = await apiClient.restoreProofRunSnapshot(simulationRunId, { simulationResetSnapshotId })
      const activation = await apiClient.activateProofSemester(restored.simulationRunId, { semesterNumber: 1 })
      clearProofPlaybackSelection()
      setSelectedProofCheckpointSource('auto')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(null)
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(batch => (
          batch.batchId === activation.batchId
            ? {
                ...batch,
                currentSemester: activation.activeOperationalSemester,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )),
      }))
      await refreshProofDashboard(proofControlBatchId)
      setFlashMessage('Proof branch reset from the baseline snapshot and pinned to Semester 1.')
    })
  }

  const handleResetProofPlaybackSelection = useCallback(() => {
    clearProofPlaybackSelection()
    setSelectedProofCheckpointSource('auto')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(defaultProofPlaybackCheckpointId)
  }, [defaultProofPlaybackCheckpointId])

  const handleSelectProofCheckpoint = useCallback((checkpointId: string | null) => {
    setSelectedProofCheckpointSource('manual')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(checkpointId)
  }, [])

  const handleStepProofPlayback = useCallback((direction: 'previous' | 'next' | 'start' | 'end') => {
    if (activeRunCheckpoints.length === 0) return
    if (direction === 'start') {
      const checkpointId = activeRunCheckpoints[0]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointSource('manual')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(checkpointId)
      return
    }
    if (direction === 'end') {
      const lastAccessibleIndex = firstBlockedCheckpointIndex >= 0 ? Math.max(0, firstBlockedCheckpointIndex - 1) : activeRunCheckpoints.length - 1
      const checkpointId = activeRunCheckpoints[lastAccessibleIndex]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointSource('manual')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(checkpointId)
      return
    }
    const currentIndex = Math.max(0, activeRunCheckpoints.findIndex(item => item.simulationStageCheckpointId === selectedProofCheckpoint?.simulationStageCheckpointId))
    const nextIndex = direction === 'previous'
      ? Math.max(0, currentIndex - 1)
      : Math.min(activeRunCheckpoints.length - 1, currentIndex + 1)
    if (direction === 'next' && firstBlockedCheckpointIndex >= 0 && nextIndex >= firstBlockedCheckpointIndex) return
    const checkpointId = activeRunCheckpoints[nextIndex]?.simulationStageCheckpointId ?? null
    setSelectedProofCheckpointSource('manual')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(checkpointId)
  }, [activeRunCheckpoints, firstBlockedCheckpointIndex, selectedProofCheckpoint?.simulationStageCheckpointId])

  const refreshRequestWorkspaceState = useCallback(async (requestId: string) => {
    await loadAdminData()
    if (route.requestId === requestId) {
      const nextDetail = await apiClient.getAdminRequest(requestId)
      setSelectedRequestDetail(nextDetail)
    }
  }, [apiClient, loadAdminData, route.requestId])

  const handleAdvanceRequest = async (request: ApiAdminRequestSummary) => {
    setRequestBusy(request.adminRequestId)
    try {
      if (request.status === 'New' || request.status === 'Needs Info') await apiClient.assignAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Claimed for review.' })
      else if (request.status === 'In Review') await apiClient.approveAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Approved for implementation.' })
      else if (request.status === 'Approved') await apiClient.markAdminRequestImplemented(request.adminRequestId, { version: request.version, noteBody: 'Implemented from the sysadmin workspace.' })
      else if (request.status === 'Implemented' || request.status === 'Rejected') await apiClient.closeAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Closed after execution.' })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request updated.')
    } catch (error) { setActionError(toErrorMessage(error)) }
    finally { setRequestBusy('') }
  }

  const handleRequestInfoRequest = async (request: ApiAdminRequestSummary) => {
    if (request.status !== 'In Review') return
    const noteBody = window.prompt('What clarification is needed from HoD?', 'Please clarify implementation scope and acceptance criteria.')
    if (noteBody == null) return
    const trimmedNote = noteBody.trim()
    if (!trimmedNote) {
      setActionError('A clarification note is required to move this request to Needs Info.')
      return
    }
    setRequestBusy(request.adminRequestId)
    try {
      await apiClient.requestAdminRequestInfo(request.adminRequestId, {
        version: request.version,
        noteBody: trimmedNote,
      })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request moved to Needs Info.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestBusy('')
    }
  }

  const handleRejectRequest = async (request: ApiAdminRequestSummary) => {
    if (!['New', 'In Review', 'Needs Info', 'Approved'].includes(request.status)) return
    const noteBody = window.prompt('Enter a rejection rationale (required).', 'Rejected by system admin after governance review.')
    if (noteBody == null) return
    const trimmedNote = noteBody.trim()
    if (!trimmedNote) {
      setActionError('A rejection rationale is required to reject this request.')
      return
    }
    setRequestBusy(request.adminRequestId)
    try {
      await apiClient.rejectAdminRequest(request.adminRequestId, {
        version: request.version,
        noteBody: trimmedNote,
      })
      await refreshRequestWorkspaceState(request.adminRequestId)
      setFlashMessage('Request rejected.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestBusy('')
    }
  }

  const resetStudentEditors = () => {
    setStudentForm(defaultStudentForm())
    setEnrollmentForm(defaultEnrollmentForm())
    setMentorForm(defaultMentorAssignmentForm())
  }

  const startEditingEnrollment = (enrollment: ApiStudentEnrollment) => {
    setEnrollmentForm({
      enrollmentId: enrollment.enrollmentId,
      branchId: enrollment.branchId,
      termId: enrollment.termId,
      sectionCode: enrollment.sectionCode,
      rosterOrder: String(enrollment.rosterOrder ?? 0),
      academicStatus: enrollment.academicStatus,
      startDate: enrollment.startDate,
      endDate: enrollment.endDate ?? '',
    })
  }

  const startEditingMentorAssignment = (assignment: ApiMentorAssignment) => {
    setMentorForm({
      assignmentId: assignment.assignmentId,
      facultyId: assignment.facultyId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo ?? '',
      source: assignment.source,
    })
  }

  const handleSaveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      usn: requireText('University ID / USN', studentForm.usn),
      rollNumber: studentForm.rollNumber.trim() || null,
      name: requireText('Student name', studentForm.name),
      email: studentForm.email.trim() || null,
      phone: studentForm.phone.trim() || null,
      admissionDate: requireDate('Admission date', studentForm.admissionDate),
      status: selectedStudent?.status ?? 'active',
    }
    if (selectedStudent) {
      await runAction(async () => {
        const updated = await apiClient.updateStudent(selectedStudent.studentId, {
          ...payload,
          version: selectedStudent.version,
        })
        mergeStudentRecord(updated)
        setFlashMessage('Student record updated.')
        setEditingEntity(null)
      })
      return
    }
    const created = await runAction(async () => {
      const next = await apiClient.createStudent(payload)
      mergeStudentRecord(next)
      return next
    })
    if (created) {
      navigate({ section: 'students', studentId: created.studentId })
      setFlashMessage('Student created.')
    }
  }

  const handleArchiveStudent = async () => {
    if (!selectedStudent) return
    if (!window.confirm(`Delete ${selectedStudent.name}? This moves the record to the recycle bin for 60 days.`)) return
    await runAction(async () => {
      const deleted = await apiClient.updateStudent(selectedStudent.studentId, {
        usn: selectedStudent.usn,
        rollNumber: selectedStudent.rollNumber,
        name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        admissionDate: selectedStudent.admissionDate,
        status: 'deleted',
        version: selectedStudent.version,
      })
      mergeStudentRecord(deleted)
      navigate({ section: 'students' })
      resetStudentEditors()
      setFlashMessage('Student moved to recycle bin.')
    })
  }

  const handleSaveEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing enrollment.')
    const payload = {
      branchId: requireText('Branch', enrollmentForm.branchId),
      termId: requireText('Term', enrollmentForm.termId),
      sectionCode: requireText('Section', enrollmentForm.sectionCode),
      rosterOrder: requirePositiveInteger('Roster order', enrollmentForm.rosterOrder),
      academicStatus: requireText('Academic status', enrollmentForm.academicStatus),
      startDate: requireDate('Enrollment start date', enrollmentForm.startDate),
      endDate: enrollmentForm.endDate.trim() ? requireDate('Enrollment end date', enrollmentForm.endDate) : null,
    }
    if (enrollmentForm.enrollmentId) {
      const current = selectedStudent.enrollments.find(item => item.enrollmentId === enrollmentForm.enrollmentId)
      if (!current) throw new Error('Enrollment could not be found.')
      await runAction(async () => {
        await apiClient.updateEnrollment(current.enrollmentId, {
          studentId: selectedStudent.studentId,
          ...payload,
          version: current.version,
        })
        const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
        setFlashMessage(rerun.length > 0 ? 'Enrollment updated and proof batch refreshed.' : 'Enrollment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createEnrollment(selectedStudent.studentId, payload)
      const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
      setFlashMessage(rerun.length > 0 ? 'Enrollment created and proof batch refreshed.' : 'Enrollment created.')
    })
  }

  const handleCloseEnrollment = async (enrollment: ApiStudentEnrollment) => {
    if (!selectedStudent) return
    if (!window.confirm(`Close enrollment ${enrollment.enrollmentId}?`)) return
    await runAction(async () => {
      await apiClient.updateEnrollment(enrollment.enrollmentId, {
        studentId: selectedStudent.studentId,
        branchId: enrollment.branchId,
        termId: enrollment.termId,
        sectionCode: enrollment.sectionCode,
        rosterOrder: enrollment.rosterOrder ?? 0,
        academicStatus: enrollment.academicStatus === 'regular' ? 'completed' : enrollment.academicStatus,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate ?? new Date().toISOString().slice(0, 10),
        version: enrollment.version,
      })
      setFlashMessage('Enrollment closed.')
    })
  }

  const handleSaveMentorAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing mentor linkage.')
    const payload = {
      studentId: selectedStudent.studentId,
      facultyId: requireText('Mentor faculty', mentorForm.facultyId),
      effectiveFrom: requireDate('Mentor effective from', mentorForm.effectiveFrom),
      effectiveTo: mentorForm.effectiveTo.trim() ? requireDate('Mentor effective to', mentorForm.effectiveTo) : null,
      source: requireText('Assignment source', mentorForm.source),
    }
    if (mentorForm.assignmentId) {
      const current = selectedStudent.mentorAssignments.find(item => item.assignmentId === mentorForm.assignmentId)
      if (!current) throw new Error('Mentor assignment could not be found.')
      await runAction(async () => {
        await apiClient.updateMentorAssignment(current.assignmentId, {
          ...payload,
          version: current.version,
        })
        setFlashMessage('Mentor assignment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createMentorAssignment(payload)
      setFlashMessage('Mentor assignment created.')
    })
  }

  const handleEndMentorAssignment = async (assignment: ApiMentorAssignment) => {
    if (!selectedStudent) return
    if (!window.confirm('End this mentor assignment?')) return
    await runAction(async () => {
      await apiClient.updateMentorAssignment(assignment.assignmentId, {
        studentId: assignment.studentId,
        facultyId: assignment.facultyId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo ?? new Date().toISOString().slice(0, 10),
        source: assignment.source,
        version: assignment.version,
      })
      setFlashMessage('Mentor assignment ended.')
    })
  }

  const handlePromoteStudent = async (targetTermId: string) => {
    if (!selectedStudent) return
    const currentEnrollment = findLatestEnrollment(selectedStudent)
    const targetTerm = data.terms.find(item => item.termId === targetTermId)
    if (!currentEnrollment || !targetTerm) {
      setActionError('Active enrollment and target term are required for promotion.')
      return
    }
    const existingTarget = selectedStudent.enrollments.find(item => item.termId === targetTermId)
    if (existingTarget) {
      setActionError('This student already has an enrollment for the selected next term.')
      return
    }
    if (!window.confirm(`Promote ${selectedStudent.name} into Semester ${targetTerm.semesterNumber} (${targetTerm.academicYearLabel})?`)) return
    await runAction(async () => {
      if (!currentEnrollment.endDate) {
        await apiClient.updateEnrollment(currentEnrollment.enrollmentId, {
          studentId: selectedStudent.studentId,
          branchId: currentEnrollment.branchId,
          termId: currentEnrollment.termId,
          sectionCode: currentEnrollment.sectionCode,
          rosterOrder: currentEnrollment.rosterOrder ?? 0,
          academicStatus: currentEnrollment.academicStatus === 'regular' ? 'completed' : currentEnrollment.academicStatus,
          startDate: currentEnrollment.startDate,
          endDate: targetTerm.startDate,
          version: currentEnrollment.version,
        })
      }
      await apiClient.createEnrollment(selectedStudent.studentId, {
        branchId: targetTerm.branchId,
        termId: targetTerm.termId,
        sectionCode: currentEnrollment.sectionCode,
        rosterOrder: currentEnrollment.rosterOrder ?? 0,
        academicStatus: 'regular',
        startDate: targetTerm.startDate,
        endDate: null,
      })
      setFlashMessage(`Promotion recorded for Semester ${targetTerm.semesterNumber}.`)
    })
  }

  const resetFacultyEditors = () => {
    setFacultyForm(defaultFacultyForm())
    setFacultyPasswordSetupResult(null)
    setAppointmentForm(defaultAppointmentForm())
    setRoleGrantForm(defaultRoleGrantForm())
    setOwnershipForm(defaultOwnershipForm())
  }

  const startEditingAppointment = (appointment: ApiFacultyAppointment) => {
    setAppointmentForm({
      appointmentId: appointment.appointmentId,
      departmentId: appointment.departmentId,
      branchId: appointment.branchId ?? '',
      isPrimary: appointment.isPrimary,
      startDate: appointment.startDate,
      endDate: appointment.endDate ?? '',
    })
  }

  const startEditingRoleGrant = (grant: ApiRoleGrant) => {
    setRoleGrantForm({
      grantId: grant.grantId,
      roleCode: grant.roleCode,
      scopeType: grant.scopeType,
      scopeId: grant.scopeId,
      startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: grant.endDate ?? '',
    })
  }

  const handleSaveFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      username: requireText('Username', facultyForm.username),
      email: requireText('Email', facultyForm.email),
      phone: facultyForm.phone.trim() || null,
      employeeCode: requireText('Employee code', facultyForm.employeeCode),
      displayName: requireText('Display name', facultyForm.displayName),
      designation: requireText('Designation', facultyForm.designation),
      joinedOn: selectedFacultyMember?.joinedOn ?? null,
      status: selectedFacultyMember?.status ?? 'active',
    }
    if (selectedFacultyMember) {
      await runAction(async () => {
        await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
          ...payload,
          version: selectedFacultyMember.version,
        })
        setFlashMessage('Faculty profile updated.')
        setEditingEntity(null)
      })
      return
    }
    const created = await runAction(async () => apiClient.createFaculty({
      ...payload,
      password: facultyForm.password.trim() || null,
    }))
    if (created) {
      navigate({ section: 'faculty-members', facultyMemberId: created.facultyId })
      setFlashMessage(created.credentialStatus?.passwordConfigured
        ? 'Faculty profile created with an admin-set password.'
        : 'Faculty profile created. Open Sign-In Setup to issue or copy the invite link.')
    }
  }

  const handleIssueFacultyPasswordSetup = async () => {
    if (!selectedFacultyMember) return
    const issued = await runAction(async () => apiClient.issueFacultyPasswordSetup(selectedFacultyMember.facultyId))
    if (!issued) return
    setFacultyPasswordSetupResult(issued)
    setFlashMessage(
      issued.setupUrl
        ? `${issued.purpose === 'invite' ? 'Invite' : 'Reset'} link is ready for ${selectedFacultyMember.displayName}.`
        : `${issued.purpose === 'invite' ? 'Invite' : 'Reset'} link generated for ${selectedFacultyMember.displayName}.`,
    )
  }

  const handleArchiveFaculty = async () => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${selectedFacultyMember.displayName}? This will soft-delete the faculty profile and login.`)) return
    await runAction(async () => {
      await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
        username: selectedFacultyMember.username,
        email: selectedFacultyMember.email,
        phone: selectedFacultyMember.phone,
        employeeCode: selectedFacultyMember.employeeCode,
        displayName: selectedFacultyMember.displayName,
        designation: selectedFacultyMember.designation,
        joinedOn: selectedFacultyMember.joinedOn,
        status: 'deleted',
        version: selectedFacultyMember.version,
      })
      navigate({ section: 'faculty-members' })
      resetFacultyEditors()
      setFlashMessage('Faculty member moved to recycle bin.')
    })
  }

  const handleSaveAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing appointments.')
    const payload = {
      departmentId: requireText('Department', appointmentForm.departmentId),
      branchId: appointmentForm.branchId.trim() || null,
      isPrimary: appointmentForm.isPrimary,
      startDate: requireDate('Appointment start date', appointmentForm.startDate),
      endDate: appointmentForm.endDate.trim() ? requireDate('Appointment end date', appointmentForm.endDate) : null,
      status: 'active',
    }
    if (appointmentForm.appointmentId) {
      const current = selectedFacultyMember.appointments.find(item => item.appointmentId === appointmentForm.appointmentId)
      if (!current) throw new Error('Appointment could not be found.')
      await runAction(async () => {
        await apiClient.updateFacultyAppointment(current.appointmentId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Appointment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createFacultyAppointment(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Appointment created.')
    })
  }

  const handleArchiveAppointment = async (appointment: ApiFacultyAppointment) => {
    if (!selectedFacultyMember) return
    if (!window.confirm('Delete this appointment?')) return
    await runAction(async () => {
      await apiClient.updateFacultyAppointment(appointment.appointmentId, {
        facultyId: selectedFacultyMember.facultyId,
        departmentId: appointment.departmentId,
        branchId: appointment.branchId,
        isPrimary: appointment.isPrimary,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        status: 'deleted',
        version: appointment.version,
      })
      setFlashMessage('Appointment moved to recycle bin.')
    })
  }

  const handleSaveRoleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing permissions.')
    const payload = {
      roleCode: roleGrantForm.roleCode,
      scopeType: requireText('Scope type', roleGrantForm.scopeType),
      scopeId: requireText('Scope id', roleGrantForm.scopeId),
      startDate: requireDate('Permission start date', roleGrantForm.startDate),
      endDate: roleGrantForm.endDate.trim() ? requireDate('Permission end date', roleGrantForm.endDate) : null,
      status: 'active',
    }
    if (roleGrantForm.grantId) {
      const current = selectedFacultyMember.roleGrants.find(item => item.grantId === roleGrantForm.grantId)
      if (!current) throw new Error('Permission grant could not be found.')
      await runAction(async () => {
        await apiClient.updateRoleGrant(current.grantId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Permission updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createRoleGrant(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Permission granted.')
    })
  }

  const handleArchiveRoleGrant = async (grant: ApiRoleGrant) => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${grant.roleCode} permission?`)) return
    await runAction(async () => {
      await apiClient.updateRoleGrant(grant.grantId, {
        facultyId: selectedFacultyMember.facultyId,
        roleCode: grant.roleCode,
        scopeType: grant.scopeType,
        scopeId: grant.scopeId,
        startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
        endDate: grant.endDate,
        status: 'deleted',
        version: grant.version,
      })
      setFlashMessage('Permission moved to recycle bin.')
    })
  }

  const handleSaveOwnership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing teaching ownership.')
    const offeringId = requireText('Class / offering', ownershipForm.offeringId)
    await runAction(async () => {
      await apiClient.createOfferingOwnership({
        offeringId,
        facultyId: selectedFacultyMember.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      })
      setOwnershipForm({
        ownershipId: '',
        offeringId: '',
        facultyId: selectedFacultyMember.facultyId,
      })
      setFlashMessage('Class ownership added.')
    })
  }

  const handleArchiveOwnership = async (ownership: ApiOfferingOwnership) => {
    if (!window.confirm('Delete this teaching ownership?')) return
    await runAction(async () => {
      await apiClient.updateOfferingOwnership(ownership.ownershipId, {
        offeringId: ownership.offeringId,
        facultyId: ownership.facultyId,
        ownershipRole: ownership.ownershipRole,
        status: 'deleted',
        version: ownership.version,
      })
      setFlashMessage('Teaching ownership moved to recycle bin.')
    })
  }

  const handleAssignCurriculumCourseLeader = async (curriculumCourseId: string, facultyId: string) => {
    if (!selectedBatch || !selectedBranch) return
    const curriculumCourse = operatorData.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!curriculumCourse) {
      setActionError('The selected curriculum course could not be found.')
      return
    }
    const matchingTermIds = new Set(
      operatorData.terms
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isTermVisible(operatorData, item))
        .map(item => item.termId),
    )
    const matchingOfferings = operatorData.offerings.filter(item => {
      if (item.branchId !== selectedBranch.branchId) return false
      if (!item.termId) return false
      if (!matchingTermIds.has(item.termId)) return false
      if (item.code.toLowerCase() !== curriculumCourse.courseCode.toLowerCase()) return false
      if (selectedSectionCode && item.section !== selectedSectionCode) return false
      return true
    })
    if (matchingOfferings.length === 0) {
      setActionError('No live offerings match this curriculum row in the selected year or section yet. Create the relevant class offerings first.')
      return
    }

    await runAction(async () => {
      for (const offering of matchingOfferings) {
        const activeLeaderLikeOwnerships = operatorData.ownerships.filter(ownership => ownership.offeringId === offering.offId && ownership.status === 'active' && isLeaderLikeOwnership(ownership.ownershipRole))
        for (const ownership of activeLeaderLikeOwnerships) {
          if (!facultyId || ownership.facultyId !== facultyId) {
            await apiClient.updateOfferingOwnership(ownership.ownershipId, {
              offeringId: ownership.offeringId,
              facultyId: ownership.facultyId,
              ownershipRole: ownership.ownershipRole,
              status: 'deleted',
              version: ownership.version,
            })
          }
        }
        if (!facultyId) continue
        const existingForTarget = activeLeaderLikeOwnerships.find(ownership => ownership.facultyId === facultyId)
        if (!existingForTarget) {
          await apiClient.createOfferingOwnership({
            offeringId: offering.offId,
            facultyId,
            ownershipRole: 'owner',
            status: 'active',
          })
        }
      }
      setFlashMessage(facultyId
        ? `Course leader updated across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`
        : `Course leader cleared across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`)
    })
  }

  const handleSaveFacultyCalendar = async (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => {
    if (!selectedFacultyMember) return
    setFacultyCalendarLoading(true)
    setActionError('')
    try {
      const next = await apiClient.saveAdminFacultyCalendar(selectedFacultyMember.facultyId, payload)
      setFacultyCalendar(next)
      await loadAdminData()
      setFlashMessage('Timetable planner saved.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setFacultyCalendarLoading(false)
    }
  }

  // --- Computed ---
  const facultyDepartments = listDepartmentsForAcademicFaculty(data, selectedAcademicFaculty?.academicFacultyId)
  const departmentBranches = listBranchesForDepartment(data, selectedDepartment?.departmentId)
  const branchBatches = listBatchesForBranch(data, selectedBranch?.branchId)
  const batchTerms = listTermsForBatch(data, selectedBatch?.batchId)
  const curriculumBySemester = listCurriculumBySemester(data, selectedBatch?.batchId)
  const curriculumSemesterEntries = useMemo(() => {
    const semesterCount = selectedBranch?.semesterCount ?? 0
    if (semesterCount <= 0) return curriculumBySemester
    return Array.from({ length: semesterCount }, (_, index) => {
      const semesterNumber = index + 1
      const existing = curriculumBySemester.find(entry => entry.semesterNumber === semesterNumber)
      return existing ?? { semesterNumber, courses: [] }
    })
  }, [curriculumBySemester, selectedBranch?.semesterCount])
  const selectedCurriculumSemesterEntry = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === selectedCurriculumSemester) ?? null
  const selectedCurriculumSemesterCourses = selectedCurriculumSemesterEntry?.courses ?? []
  const selectedCurriculumCourse = selectedCurriculumSemesterCourses.find(course => course.curriculumCourseId === selectedCurriculumCourseId)
    ?? selectedCurriculumSemesterCourses[0]
    ?? null
  const curriculumFeatureItems = curriculumFeatureConfig?.items ?? []
  const selectedCurriculumFeatureItem = curriculumFeatureItems.find(item => item.curriculumCourseId === selectedCurriculumFeatureCourseId) ?? null
  const selectedCurriculumLinkageCandidates = useMemo(
    () => selectedCurriculumFeatureItem
      ? curriculumLinkageCandidates.filter(candidate => candidate.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId)
      : [],
    [curriculumLinkageCandidates, selectedCurriculumFeatureItem],
  )
  const activeBatchPolicyOverride = selectedBatch
    ? data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId && isVisibleAdminRecord(item.status)) ?? null
    : null

  useEffect(() => {
    if (curriculumSemesterEntries.length === 0) {
      setSelectedCurriculumSemester('')
      setSelectedCurriculumCourseId('')
      return
    }
    const preferredSemester = selectedCurriculumSemester
      && curriculumSemesterEntries.some(entry => String(entry.semesterNumber) === selectedCurriculumSemester)
      ? selectedCurriculumSemester
      : curriculumSemesterEntries.find(entry => entry.semesterNumber === authoritativeOperationalSemester)?.semesterNumber?.toString()
        ?? String(curriculumSemesterEntries[0]!.semesterNumber)
    if (preferredSemester !== selectedCurriculumSemester) {
      setSelectedCurriculumSemester(preferredSemester)
      return
    }
    const semesterCourses = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === preferredSemester)?.courses ?? []
    if (semesterCourses.length === 0) {
      if (selectedCurriculumCourseId) setSelectedCurriculumCourseId('')
      return
    }
    if (!semesterCourses.some(course => course.curriculumCourseId === selectedCurriculumCourseId)) {
      setSelectedCurriculumCourseId(semesterCourses[0]!.curriculumCourseId)
    }
  }, [authoritativeOperationalSemester, curriculumSemesterEntries, selectedCurriculumCourseId, selectedCurriculumSemester])
  useEffect(() => {
    if (entityEditors.curriculum.curriculumCourseId) return
    const nextSemester = selectedCurriculumSemester || String(authoritativeOperationalSemester ?? 1)
    if (entityEditors.curriculum.semesterNumber === nextSemester) return
    setEntityEditors(prev => ({
      ...prev,
      curriculum: {
        ...prev.curriculum,
        semesterNumber: nextSemester,
      },
    }))
  }, [authoritativeOperationalSemester, entityEditors.curriculum.curriculumCourseId, entityEditors.curriculum.semesterNumber, selectedCurriculumSemester])
  const activeScopeChain = useMemo<ActiveAdminScope[]>(() => buildAdminActiveScopeChain({
    institution: data.institution,
    academicFaculty: selectedAcademicFaculty,
    department: selectedDepartment,
    branch: selectedBranch,
    batch: selectedBatch,
    sectionCode: selectedSectionCode,
  }), [data.institution, selectedAcademicFaculty, selectedBatch, selectedBranch, selectedDepartment, selectedSectionCode])
  const activeGovernanceScope = activeScopeChain.at(-1) ?? null
  const activeGovernanceScopeId = activeGovernanceScope?.scopeId ?? null
  const activeGovernanceScopeType = activeGovernanceScope?.scopeType ?? null
  const activeGovernanceScopeBatchIds = useMemo(() => {
    if (!activeGovernanceScope) return []
    return data.batches
      .filter(batch => matchesBatchScope(batch, data, activeGovernanceScope.scopeType, activeGovernanceScope.scopeId))
      .map(batch => batch.batchId)
  }, [activeGovernanceScope, data])
  const preferredGovernanceBatchId = selectedBatch?.batchId
    ?? activeGovernanceScopeBatchIds.find(isCanonicalProofBatchId)
    ?? activeGovernanceScopeBatchIds[0]
    ?? null
  const activeGovernanceProofRefreshBatchIds = selectedBatch?.batchId
    ? [selectedBatch.batchId]
    : activeGovernanceScopeBatchIds.filter(isCanonicalProofBatchId)
  const scopePolicyOverrides = useMemo(() => (
    activeScopeChain.flatMap(scope => {
      const match = data.policyOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && isVisibleAdminRecord(item.status))
      return match ? [{ ...match, appliedAtScope: `${scope.scopeType}:${scope.scopeId}` }] : []
    })
  ), [activeScopeChain, data.policyOverrides])
  const scopeStageOverrides = useMemo(() => (
    activeScopeChain.flatMap(scope => {
      const match = stagePolicyOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && isVisibleAdminRecord(item.status))
      return match ? [{ ...match, appliedAtScope: `${scope.scopeType}:${scope.scopeId}` }] : []
    })
  ), [activeScopeChain, stagePolicyOverrides])
  const effectiveScopePolicy = useMemo(() => {
    if (
      activeGovernanceScope
      && resolvedBatchPolicy
      && resolvedBatchPolicy.batch.batchId === selectedBatch?.batchId
      && resolvedBatchPolicy.scopeChain.some(scope => scope.scopeType === activeGovernanceScope.scopeType && scope.scopeId === activeGovernanceScope.scopeId)
    ) {
      return resolvedBatchPolicy.effectivePolicy
    }
    return scopePolicyOverrides.reduce<ApiResolvedBatchPolicy['effectivePolicy']>(
      (policy, override) => mergePolicyPayload(policy, override.policy),
      buildValidatedPolicyPayload(defaultPolicyForm()),
    )
  }, [activeGovernanceScope, resolvedBatchPolicy, scopePolicyOverrides, selectedBatch?.batchId])
  const effectiveScopeStagePolicy = useMemo(() => {
    if (
      activeGovernanceScope
      && resolvedStagePolicy
      && resolvedStagePolicy.batch.batchId === selectedBatch?.batchId
      && resolvedStagePolicy.scopeChain.some(scope => scope.scopeType === activeGovernanceScope.scopeType && scope.scopeId === activeGovernanceScope.scopeId)
    ) {
      return resolvedStagePolicy.effectivePolicy
    }
    return scopeStageOverrides.at(-1)?.policy ?? DEFAULT_STAGE_POLICY
  }, [activeGovernanceScope, resolvedStagePolicy, scopeStageOverrides, selectedBatch?.batchId])
  const activeScopePolicyOverride = activeGovernanceScope
    ? data.policyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const activeScopeStageOverride = activeGovernanceScope
    ? stagePolicyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const curriculumFeatureTargetScopeOptions = activeScopeChain.filter(scope => scope.scopeType !== 'section')
  const curriculumFeatureProfileOptions = curriculumFeatureConfig?.availableProfiles ?? []
  const visibleAcademicFaculties = operatorData.academicFaculties.filter(item => isAcademicFacultyVisible(operatorData, item))
  const visibleDepartments = operatorData.departments.filter(item => isDepartmentVisible(operatorData, item))
  const visibleBranches = operatorData.branches.filter(item => isBranchVisible(operatorData, item))
  const visibleBatches = operatorData.batches.filter(item => isBatchVisible(operatorData, item))
  const visibleTerms = operatorData.terms
    .filter(item => isTermVisible(operatorData, item))
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
  const archivedItems = [
    ...operatorData.academicFaculties.filter(item => item.status === 'archived').map(item => ({
      key: `archived:academic-faculty:${item.academicFacultyId}`,
      label: item.name,
      meta: 'Academic faculty',
      updatedAt: item.updatedAt ?? item.createdAt ?? '',
      onRestore: async () => {
        await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
      },
    })),
  ].sort((left, right) => compareAdminTimestampsDesc(left.updatedAt, right.updatedAt))
  const deletedItems = [
    ...operatorData.academicFaculties.filter(item => item.status === 'deleted').map(item => ({ key: `academic-faculty:${item.academicFacultyId}`, label: item.name, meta: 'Academic faculty', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
    } })),
    ...operatorData.departments.filter(item => item.status === 'deleted').map(item => ({ key: `department:${item.departmentId}`, label: item.name, meta: 'Department', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateDepartment(item.departmentId, { academicFacultyId: item.academicFacultyId, code: item.code, name: item.name, status: 'active', version: item.version })
    } })),
    ...operatorData.branches.filter(item => item.status === 'deleted').map(item => ({ key: `branch:${item.branchId}`, label: item.name, meta: 'Branch', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateBranch(item.branchId, { departmentId: item.departmentId, code: item.code, name: item.name, programLevel: item.programLevel, semesterCount: item.semesterCount, status: 'active', version: item.version })
    } })),
    ...operatorData.batches.filter(item => item.status === 'deleted').map(item => ({ key: `batch:${item.batchId}`, label: item.batchLabel, meta: 'Year', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateBatch(item.batchId, { branchId: item.branchId, admissionYear: item.admissionYear, batchLabel: item.batchLabel, currentSemester: item.currentSemester, sectionLabels: item.sectionLabels, status: 'active', version: item.version })
    } })),
    ...operatorData.students.filter(item => item.status === 'deleted').map(item => ({ key: `student:${item.studentId}`, label: item.name, meta: 'Student', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      const restored = await apiClient.updateStudent(item.studentId, { usn: item.usn, rollNumber: item.rollNumber, name: item.name, email: item.email, phone: item.phone, admissionDate: item.admissionDate, status: 'active', version: item.version })
      mergeStudentRecord(restored)
    } })),
    ...operatorData.facultyMembers.filter(item => item.status === 'deleted').map(item => ({ key: `faculty:${item.facultyId}`, label: item.displayName, meta: 'Faculty member', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateFaculty(item.facultyId, { username: item.username, email: item.email, phone: item.phone, employeeCode: item.employeeCode, displayName: item.displayName, designation: item.designation, joinedOn: item.joinedOn, status: 'active', version: item.version })
    } })),
    ...operatorData.courses.filter(item => item.status === 'deleted').map(item => ({ key: `course:${item.courseId}`, label: item.title, meta: 'Course', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateCourse(item.courseId, { courseCode: item.courseCode, title: item.title, defaultCredits: item.defaultCredits, departmentId: item.departmentId, status: 'active', version: item.version })
    } })),
  ].sort((left, right) => compareAdminTimestampsDesc(left.updatedAt, right.updatedAt))
  const hiddenItemCount = archivedItems.length + deletedItems.length
  const selectedAcademicFacultyImpact = selectedAcademicFaculty
    ? {
        departments: operatorData.departments.filter(item => item.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted').length,
        branches: operatorData.branches.filter(item => {
          const department = resolveDepartment(operatorData, item.departmentId)
          return department?.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted'
        }).length,
        batches: operatorData.batches.filter(item => {
          const branch = resolveBranch(operatorData, item.branchId)
          const department = branch ? resolveDepartment(operatorData, branch.departmentId) : null
          return department?.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted'
        }).length,
        students: operatorData.students.filter(item => item.status !== 'deleted' && item.activeAcademicContext?.departmentId && resolveDepartment(operatorData, item.activeAcademicContext.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId).length,
        facultyMembers: operatorData.facultyMembers.filter(item => isFacultyMemberVisible(operatorData, item) && item.appointments.some(appointment => appointment.status !== 'deleted' && resolveDepartment(operatorData, appointment.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId)).length,
        courses: operatorData.courses.filter(item => item.status !== 'deleted' && resolveDepartment(operatorData, item.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId).length,
      }
    : null
  const openRequests = operatorData.requests
    .filter(item => item.status !== 'Closed')
    .filter(item => !dismissedQueueItemKeys.includes(`request:${item.adminRequestId}`))
  const pendingReminders = data.reminders
    .filter(item => item.status === 'pending')
    .filter(item => !dismissedQueueItemKeys.includes(`reminder:${item.reminderId}`))
  const visibleHiddenQueueItems = [...archivedItems, ...deletedItems].filter(item => !dismissedQueueItemKeys.includes(`hidden:${item.key}`))
  const visibleQueueDismissKeys = useMemo(() => collectAdminQueueDismissKeys({
    requestIds: openRequests.map(item => item.adminRequestId),
    reminderIds: pendingReminders.map(item => item.reminderId),
    hiddenItemKeys: visibleHiddenQueueItems.map(item => item.key),
  }), [openRequests, pendingReminders, visibleHiddenQueueItems])
  const actionQueueCount = openRequests.length + pendingReminders.length + visibleHiddenQueueItems.length
  const hideAllVisibleQueueItems = useCallback(() => {
    setDismissedQueueItemKeys(existing => mergeAdminQueueDismissKeys(existing, visibleQueueDismissKeys))
  }, [visibleQueueDismissKeys])
  const selectorSections = selectedBatch?.sectionLabels ?? []
  const activeUniversityScope = route.section === 'faculties'
    ? {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        departmentId: selectedDepartment?.departmentId ?? null,
        branchId: selectedBranch?.branchId ?? null,
        batchId: selectedBatch?.batchId ?? null,
        sectionCode: selectedSectionCode,
      }
    : null
  const currentUniversityLevel = selectedSectionCode
    ? 'section'
    : selectedBatch
      ? 'batch'
      : selectedBranch
        ? 'branch'
        : selectedDepartment
          ? 'department'
          : 'faculty'
  const universityLeftItems = (() => {
    if (currentUniversityLevel === 'section' && selectedBatch) {
      return selectorSections.map(sectionCode => ({
        key: `section:${sectionCode}`,
        title: `Section ${sectionCode}`,
        subtitle: 'Section scope',
        selected: selectedSectionCode === sectionCode,
        onSelect: () => updateSelectedSectionCode(sectionCode),
      }))
    }
    if (currentUniversityLevel === 'batch' && selectedBranch) {
      return branchBatches.map(batch => ({
        key: `batch:${batch.batchId}`,
        title: `${deriveCurrentYearLabel(batch.currentSemester)}`,
        subtitle: `Batch ${batch.batchLabel} · ${batch.currentSemester % 2 === 0 ? 'Even' : 'Odd'} semester`,
        selected: route.batchId === batch.batchId,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
          departmentId: selectedDepartment?.departmentId,
          branchId: selectedBranch!.branchId,
          batchId: batch.batchId,
        }),
      }))
    }
    if (currentUniversityLevel === 'branch' && selectedDepartment) {
      return departmentBranches.map(branch => ({
        key: `branch:${branch.branchId}`,
        title: branch.name,
        subtitle: `${branch.code} · ${branch.programLevel} · ${branch.semesterCount} semesters`,
        selected: route.branchId === branch.branchId,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
          departmentId: selectedDepartment!.departmentId,
          branchId: branch.branchId,
        }),
      }))
    }
    if (currentUniversityLevel === 'department' && selectedAcademicFaculty) {
      return facultyDepartments
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(department => ({
          key: `department:${department.departmentId}`,
          title: department.name,
          subtitle: `${department.code} · ${listBranchesForDepartment(operatorData, department.departmentId).length} branches`,
          selected: route.departmentId === department.departmentId,
          onSelect: () => navigate({
            section: 'faculties',
            academicFacultyId: selectedAcademicFaculty.academicFacultyId,
            departmentId: department.departmentId,
          }),
        }))
    }
    return visibleAcademicFaculties
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(faculty => ({
      key: `faculty:${faculty.academicFacultyId}`,
      title: faculty.name,
      subtitle: `${faculty.code} · ${listDepartmentsForAcademicFaculty(operatorData, faculty.academicFacultyId).length} departments`,
      selected: route.academicFacultyId === faculty.academicFacultyId,
      onSelect: () => navigate({ section: 'faculties', academicFacultyId: faculty.academicFacultyId }),
    }))
  })()
  const universityNextItems = (() => {
    if (selectedSectionCode) return []
    if (selectedBatch) {
      return selectorSections.map(sectionCode => ({
        key: `section:${sectionCode}`,
        title: `Section ${sectionCode}`,
        description: `${operatorData.students.filter(student => student.activeAcademicContext?.batchId === selectedBatch!.batchId && student.activeAcademicContext.sectionCode === sectionCode).length} students`,
        onSelect: () => updateSelectedSectionCode(sectionCode),
      }))
    }
    if (selectedBranch) {
      return branchBatches.map(batch => ({
        key: `year:${batch.batchId}`,
        title: deriveCurrentYearLabel(batch.currentSemester),
        description: `${batch.batchLabel} · sections ${batch.sectionLabels.join(', ') || 'NA'}`,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
          departmentId: selectedDepartment?.departmentId,
          branchId: selectedBranch!.branchId,
          batchId: batch.batchId,
        }),
      }))
    }
    if (selectedDepartment) {
      return departmentBranches.map(branch => ({
        key: `branch:${branch.branchId}`,
        title: branch.name,
        description: `${branch.code} · ${branch.programLevel} · ${listBatchesForBranch(operatorData, branch.branchId).length} years`,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
          departmentId: selectedDepartment!.departmentId,
          branchId: branch.branchId,
        }),
      }))
    }
    if (selectedAcademicFaculty) {
      return facultyDepartments.map(department => ({
        key: `department:${department.departmentId}`,
        title: department.name,
        description: `${department.code} · ${listBranchesForDepartment(operatorData, department.departmentId).length} branches`,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty!.academicFacultyId,
          departmentId: department.departmentId,
        }),
      }))
    }
    return []
  })()
  const scopedAdminDirectoryData: LiveAdminDataset = {
    ...operatorData,
    students: scopedDirectoryStudents ?? operatorData.students,
    facultyMembers: scopedDirectoryFacultyMembers ?? operatorData.facultyMembers,
  }
  const filteredUniversityStudents = scopedAdminDirectoryData.students
    .filter(item => isStudentVisible(operatorData, item))
    .filter(student => matchesStudentScope(student, operatorData, activeUniversityScope))
  const filteredUniversityFaculty = scopedAdminDirectoryData.facultyMembers
    .filter(item => isFacultyMemberVisible(operatorData, item))
    .filter(member => matchesFacultyScope(member, operatorData, activeUniversityScope))
  const scopedUniversityStudents = activeUniversityScope ? filteredUniversityStudents : []
  const universityContextLabel = selectedSectionCode
    ? `Section ${selectedSectionCode}`
    : selectedBatch
      ? deriveCurrentYearLabel(authoritativeOperationalSemester ?? selectedBatch.currentSemester)
      : selectedBranch
        ? selectedBranch.name
        : selectedDepartment
          ? selectedDepartment.name
        : selectedAcademicFaculty
          ? selectedAcademicFaculty.name
          : 'Main Dashboard'
  const activeUniversityRegistryScope = activeUniversityScope
    ? {
        ...activeUniversityScope,
        label: universityContextLabel,
      }
    : null
  const activeUniversityStudentScopeChipLabel = selectedSectionCode
    ? 'Section scope'
    : selectedBatch
      ? 'Year scope'
      : selectedBranch
        ? 'Branch scope'
        : selectedDepartment
          ? 'Department scope'
          : selectedAcademicFaculty
            ? 'Faculty scope'
            : 'Global registry'
  const activeUniversityFacultyScopeChipLabel = selectedSectionCode
    ? 'Section scope'
    : selectedBatch
      ? 'Year scope'
      : selectedBranch
        ? 'Branch scope'
        : selectedDepartment
          ? 'Department scope'
          : selectedAcademicFaculty
            ? 'Faculty scope'
            : 'All faculty'
  const normalizedActiveUniversityRegistryScope = normalizeHierarchyScope(activeUniversityRegistryScope)
  const normalizedRegistryScope = normalizeHierarchyScope(registryScope)
  const overviewHierarchyScope = hasHierarchyScopeSelection(normalizedActiveUniversityRegistryScope)
    ? normalizedActiveUniversityRegistryScope
    : hasHierarchyScopeSelection(normalizedRegistryScope)
      ? normalizedRegistryScope
      : null
  const overviewScopeLabel = describeRegistryScope(operatorData, overviewHierarchyScope)
  const universityNavigatorTitle = selectedSectionCode
    ? 'Hierarchy Complete'
    : selectedBatch
      ? 'Sections'
      : selectedBranch
        ? 'Years'
        : selectedDepartment
          ? 'Branches'
          : selectedAcademicFaculty
            ? 'Departments'
            : 'Departments'
  const universityNavigatorHelper = selectedSectionCode
    ? 'You are already at the final layer. Use the filtered student and faculty views below or go back one level to keep drilling sideways.'
    : selectedBatch
      ? 'The left rail stays on years while this subpanel shows section-specific actions, counts, and drill-down.'
      : selectedBranch
        ? 'The left rail stays on branches while this subpanel becomes the year workspace for the selected branch.'
        : selectedDepartment
          ? 'The left rail stays on departments while this subpanel becomes the branch workspace for the selected department.'
          : selectedAcademicFaculty
            ? 'The left rail stays on faculties while this subpanel becomes the department workspace for the selected faculty.'
            : 'Pick a faculty from the left rail first, then this subpanel becomes its department workspace.'
  const universityLevelTitle = currentUniversityLevel === 'faculty'
    ? 'Academic Faculties'
    : currentUniversityLevel === 'department'
      ? 'Departments'
      : currentUniversityLevel === 'branch'
        ? 'Branches'
        : currentUniversityLevel === 'batch'
          ? 'Years'
          : 'Sections'
  const universityLevelHelper = currentUniversityLevel === 'faculty'
    ? 'Stay on the faculty rail while the subpanel handles the next layer and the selected faculty summary.'
    : currentUniversityLevel === 'department'
      ? 'Stay on the department rail while the subpanel handles branch-level work for the selected department.'
      : currentUniversityLevel === 'branch'
        ? 'Stay on the branch rail while the subpanel handles year-level work for the selected branch.'
        : currentUniversityLevel === 'batch'
          ? 'Stay on the year rail while the subpanel handles sections, policy tabs, and term or curriculum setup.'
          : 'Sections are the last layer. Use the filtered registries or go back to the year rail for broader edits.'
  const universityTabOptions = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: <LayoutDashboard size={13} />,
      description: 'Hierarchy navigator, filtered views, and the main year workspace summary.',
    },
    {
      id: 'bands' as const,
      label: 'Bands',
      icon: <CheckCircle2 size={13} />,
      description: 'Grade cutoffs for O, A+, A, B+, B, C, and P within the selected year.',
    },
    {
      id: 'ce-see' as const,
      label: 'CE / SEE',
      icon: <Compass size={13} />,
      description: 'Continuous evaluation, SEE split, internal weights, and working-day limits.',
    },
    {
      id: 'cgpa' as const,
      label: 'CGPA Formula',
      icon: <GraduationCap size={13} />,
      description: 'Pass mark, repeat-course policy, and promotion guardrails for progression.',
    },
    {
      id: 'stage' as const,
      label: 'Stage Gates',
      icon: <Clock3 size={13} />,
      description: 'Configure inherited stage gates and advance individual classes only when evidence is complete.',
    },
    ...(selectedBranch ? [{
      id: 'courses' as const,
      label: 'Courses',
      icon: <BookOpen size={13} />,
      description: 'Semester-wise curriculum rows, credits, and course leader assignments.',
    }] : []),
    ...(selectedBatch ? [{
      id: 'curriculum' as const,
      label: 'Curriculum',
      icon: <Network size={13} />,
      description: 'Visual curriculum graph builder with prerequisite edges, course nodes, ML suggestions, and publish workflow.',
    }] : []),
  ] satisfies Array<{ id: UniversityTab; label: string; icon: ReactNode; description: string }>
  const activeUniversityTab = universityTabOptions.find(item => item.id === universityTab) ?? universityTabOptions[0]
  const universityWorkspaceLabel = activeGovernanceScope && universityTab !== 'overview'
    ? `${universityContextLabel} · ${activeUniversityTab.label}`
    : universityContextLabel
  const universityWorkspaceTabCards = activeGovernanceScope
    ? universityTabOptions.filter(item => item.id !== 'overview')
    : []
  const showInlineActionQueue = showActionQueue && viewportWidth >= ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT
  useEffect(() => {
    if (showInlineActionQueue) {
      setRenderInlineActionQueue(true)
      return
    }
    if (typeof window === 'undefined') {
      setRenderInlineActionQueue(false)
      return
    }
    const timer = window.setTimeout(() => setRenderInlineActionQueue(false), 190)
    return () => window.clearTimeout(timer)
  }, [showInlineActionQueue])

  const registryIsSingleColumn = viewportWidth < 1180
  const registryPageColumns = viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(320px, 420px) minmax(0, 1fr)'
  const universityWorkspaceColumns = viewportWidth < 1220 ? 'minmax(0, 1fr)' : '260px minmax(0, 1fr)'
  const registryFilterColumns = viewportWidth < 760
    ? 'minmax(0, 1fr)'
    : viewportWidth < 1120
      ? 'repeat(2, minmax(0, 1fr))'
      : 'repeat(auto-fit, minmax(140px, 1fr))'
  const getUniversityCourseLeaders = (courseCode: string) => {
    const leaderNames = operatorData.ownerships.flatMap(ownership => {
      if (ownership.status !== 'active' || !isLeaderLikeOwnership(ownership.ownershipRole)) return []
      const offering = operatorData.offerings.find(item => item.offId === ownership.offeringId)
      const facultyMember = resolveFacultyMember(operatorData, ownership.facultyId)
      if (!offering || !facultyMember) return []
      if (offering.code.toLowerCase() !== courseCode.toLowerCase()) return []
      if (selectedSectionCode && offering.section !== selectedSectionCode) return []
      return [facultyMember.displayName]
    })
    return Array.from(new Set(leaderNames))
  }
  const scopedCourseLeaderFaculty = Array.from(new Map(
    filteredUniversityFaculty
      .filter(member => member.status === 'active')
      .map(member => [member.facultyId, member]),
  ).values())
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
  const getScopedCourseOfferings = (curriculumCourseId: string) => {
    if (!selectedBatch || !selectedBranch) return []
    const curriculumCourse = operatorData.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!curriculumCourse) return []
    const matchingTermIds = new Set(
      operatorData.terms
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isVisibleAdminRecord(item.status))
        .map(item => item.termId),
    )
    return operatorData.offerings.filter(item => {
      if (item.branchId !== selectedBranch.branchId) return false
      if (!item.termId) return false
      if (!matchingTermIds.has(item.termId)) return false
      if (item.code.toLowerCase() !== curriculumCourse.courseCode.toLowerCase()) return false
      if (selectedSectionCode && item.section !== selectedSectionCode) return false
      return true
    })
  }
  const getScopedCourseLeaderState = (curriculumCourseId: string) => {
    const matchingOfferings = getScopedCourseOfferings(curriculumCourseId)
    const leaderIds = Array.from(new Set(
      matchingOfferings.flatMap(offering => operatorData.ownerships
        .filter(ownership => ownership.offeringId === offering.offId && ownership.status === 'active' && isLeaderLikeOwnership(ownership.ownershipRole))
        .map(ownership => ownership.facultyId)),
    ))
    return {
      matchingOfferings,
      leaderIds,
      selectedFacultyId: leaderIds.length === 1 ? leaderIds[0] : '',
      hasMultipleLeaders: leaderIds.length > 1,
    }
  }
  const mentorEligibleFaculty = operatorData.facultyMembers
    .filter(item => isFacultyMemberVisible(operatorData, item) && item.status === 'active' && item.roleGrants.some(grant => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
  // variables removed because edit-lock modals manage context reset internally
  const selectedStudentPromotionRules = selectedStudentPolicy?.effectivePolicy.progressionRules ?? DEFAULT_PROGRESSION_RULES
  const selectedStudentNextTerms = selectedStudentActiveAcademicContext
    ? operatorData.terms
        .filter(item => item.branchId === selectedStudentActiveAcademicContext.branchId && item.semesterNumber === (selectedStudentDisplaySemester ?? 0) + 1 && isTermVisible(operatorData, item))
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
    : []
  const selectedStudentPromotionRecommended = selectedStudent
    ? selectedStudentDisplayCgpa >= selectedStudentPromotionRules.minimumCgpaForPromotion
      && (!selectedStudentPromotionRules.requireNoActiveBacklogs || !selectedStudentHasCheckpointBacklogs)
    : false
  const effectiveStudentRegistryFilter = studentRegistryFilter
  const effectiveFacultyRegistryFilter = facultyRegistryFilter
  const studentRegistryScopeLabel = describeRegistryScope(operatorData, studentRegistryScope)
  const facultyRegistryScopeLabel = describeRegistryScope(operatorData, facultyRegistryScope)
  const studentFilterDepartments = visibleDepartments
    .filter(item => !effectiveStudentRegistryFilter.academicFacultyId || item.academicFacultyId === effectiveStudentRegistryFilter.academicFacultyId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const studentFilterBranches = visibleBranches
    .filter(item => !effectiveStudentRegistryFilter.departmentId || item.departmentId === effectiveStudentRegistryFilter.departmentId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const studentFilterBatches = visibleBatches
    .filter(item => !effectiveStudentRegistryFilter.branchId || item.branchId === effectiveStudentRegistryFilter.branchId)
    .sort((left, right) => left.admissionYear - right.admissionYear || left.batchLabel.localeCompare(right.batchLabel))
  const studentFilterSections = Array.from(new Set(
    studentFilterBatches
      .filter(item => !effectiveStudentRegistryFilter.batchId || item.batchId === effectiveStudentRegistryFilter.batchId)
      .flatMap(item => item.sectionLabels),
  )).sort()
  const facultyFilterDepartments = visibleDepartments
    .filter(item => !effectiveFacultyRegistryFilter.academicFacultyId || item.academicFacultyId === effectiveFacultyRegistryFilter.academicFacultyId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const facultyFilterBranches = visibleBranches
    .filter(item => !effectiveFacultyRegistryFilter.departmentId || item.departmentId === effectiveFacultyRegistryFilter.departmentId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const facultyFilterBatches = visibleBatches
    .filter(item => !effectiveFacultyRegistryFilter.branchId || item.branchId === effectiveFacultyRegistryFilter.branchId)
    .sort((left, right) => left.admissionYear - right.admissionYear || left.batchLabel.localeCompare(right.batchLabel))
  const facultyFilterSections = Array.from(new Set(
    facultyFilterBatches
      .filter(item => !effectiveFacultyRegistryFilter.batchId || item.batchId === effectiveFacultyRegistryFilter.batchId)
      .flatMap(item => item.sectionLabels),
  )).sort()
  const visibleFacultyMembers = operatorData.facultyMembers.filter(item => isFacultyMemberVisible(operatorData, item))
  const visibleOfferings = [...operatorData.offerings]
    .filter(item => isOfferingVisible(operatorData, item))
    .sort((left, right) => `${left.code}-${left.year}-${left.section}`.localeCompare(`${right.code}-${right.year}-${right.section}`))
  const batchTermIds = new Set(batchTerms.map(item => item.termId))
  const currentSemesterTerm = selectedBatch
    ? batchTerms.find(item => item.semesterNumber === authoritativeOperationalSemester && isVisibleAdminRecord(item.status)) ?? batchTerms[0] ?? null
    : null
  const batchOfferings = selectedBatch
    ? visibleOfferings
        .filter(item => item.termId ? batchTermIds.has(item.termId) : false)
        .filter(item => !selectedSectionCode || item.section === selectedSectionCode)
    : []
  const visibleOfferingById = new Map(visibleOfferings.map(item => [item.offId, item]))
  const activeVisibleOwnerships = operatorData.ownerships.filter(item => item.status === 'active' && isFacultyMemberVisible(operatorData, item.facultyId) && visibleOfferingById.has(item.offeringId))
  const selectedFacultyAssignments = selectedFacultyMember ? listFacultyAssignments(operatorData, selectedFacultyMember.facultyId) : []
  const batchScopeForProvisioning = selectedBatch
    ? {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        departmentId: selectedDepartment?.departmentId ?? null,
        branchId: selectedBranch?.branchId ?? null,
        batchId: selectedBatch.batchId,
        sectionCode: null,
      }
    : null
  const batchFacultyPool = batchScopeForProvisioning
    ? visibleFacultyMembers.filter(item => matchesFacultyScope(item, operatorData, batchScopeForProvisioning))
    : EMPTY_FACULTY_RECORDS
  const batchMentorEligibleFaculty = getScopedMentorEligibleFaculty(
    batchFacultyPool,
    selectedBatch?.batchId ?? null,
    selectedSectionCode,
  )
  const batchStudents = selectedBatch
    ? operatorData.students
        .filter(item => isStudentVisible(operatorData, item))
        .filter(item => item.activeAcademicContext?.batchId === selectedBatch.batchId)
        .filter(item => !selectedSectionCode || item.activeAcademicContext?.sectionCode === selectedSectionCode)
    : []
  const batchOfferingsWithoutOwner = batchOfferings.filter(offering => !activeVisibleOwnerships.some(ownership => ownership.offeringId === offering.offId))
  const batchStudentsWithoutEnrollment = batchStudents.filter(student => !findLatestEnrollment(student))
  const batchStudentsWithoutMentor = batchStudents.filter(student => !student.activeMentorAssignment)
  const batchOfferingsWithoutRoster = batchOfferings.filter(offering => !batchStudents.some(student => (
    student.activeAcademicContext?.termId === offering.termId
    && student.activeAcademicContext?.sectionCode === offering.section
  )))
  const effectiveBatchSetupReadiness = batchSetupReadiness ?? { ready: false, blockers: ['Loading setup status…'] }

  useEffect(() => {
    setBatchProvisioningForm(prev => {
      const nextFacultyPoolIds = prev.facultyPoolIds.filter(facultyId => batchFacultyPool.some(member => member.facultyId === facultyId))
      return nextFacultyPoolIds.length === prev.facultyPoolIds.length
        ? prev
        : { ...prev, facultyPoolIds: nextFacultyPoolIds }
    })
  }, [batchFacultyPool])

  useEffect(() => {
    setBulkMentorAssignmentForm(prev => {
      const fallbackFacultyId = batchMentorEligibleFaculty[0]?.facultyId ?? ''
      const nextFacultyId = batchMentorEligibleFaculty.some(member => member.facultyId === prev.facultyId)
        ? prev.facultyId
        : fallbackFacultyId
      const nextEffectiveFrom = currentSemesterTerm?.startDate ?? prev.effectiveFrom
      if (nextFacultyId === prev.facultyId && nextEffectiveFrom === prev.effectiveFrom) return prev
      return {
        ...prev,
        facultyId: nextFacultyId,
        effectiveFrom: nextEffectiveFrom,
      }
    })
  }, [batchMentorEligibleFaculty, currentSemesterTerm?.startDate, selectedBatch?.batchId, selectedSectionCode])

  useEffect(() => {
    setBulkMentorAssignmentPreview(null)
  }, [
    selectedBatch?.batchId,
    selectedSectionCode,
    bulkMentorAssignmentForm.facultyId,
    bulkMentorAssignmentForm.effectiveFrom,
    bulkMentorAssignmentForm.source,
    bulkMentorAssignmentForm.selectionMode,
  ])

  const selectedStageOffering = batchOfferings.find(item => item.offId === selectedStageOfferingId) ?? batchOfferings[0] ?? null
  const selectedCurriculumFeatureTargetScope = curriculumFeatureTargetScopeKey
    ? curriculumFeatureTargetScopeOptions.find(scope => `${scope.scopeType}::${scope.scopeId}` === curriculumFeatureTargetScopeKey) ?? null
    : null
  const curriculumFeatureAffectedBatchPreview = selectedCurriculumFeatureTargetScope
    ? visibleBatches.filter(batch => matchesBatchScope(batch, operatorData, selectedCurriculumFeatureTargetScope.scopeType, selectedCurriculumFeatureTargetScope.scopeId))
    : []
  const overviewCounts = computeOverviewScopedCounts(
    overviewHierarchyScope ? scopedAdminDirectoryData : operatorData,
    overviewHierarchyScope,
  )
  const overviewGlobalCounts = computeOverviewScopedCounts(operatorData, null)
  const overviewVisibleStudentCount = overviewCounts.studentCount
  const overviewVisibleMentoredCount = overviewCounts.mentoredCount
  const overviewVisibleMentorGapCount = overviewCounts.mentorGapCount
  const overviewGlobalStudentCount = overviewGlobalCounts.studentCount
  const overviewGlobalMentoredCount = overviewGlobalCounts.mentoredCount
  const overviewFacultyCaption = formatOverviewFacultyCaption(overviewCounts, Boolean(overviewHierarchyScope))
  const normalizedStudentRegistrySearch = studentRegistrySearch.trim().toLowerCase()
  const normalizedFacultyRegistrySearch = facultyRegistrySearch.trim().toLowerCase()
  const studentRegistryItems = (studentRegistryHasScope ? scopedAdminDirectoryData : operatorData).students
    .filter(item => isStudentVisible(operatorData, item))
    .filter(item => !studentRegistryHasScope || matchesStudentScope(item, operatorData, studentRegistryScope))
    .filter(item => {
      if (!normalizedStudentRegistrySearch) return true
      const searchableText = [
        item.name,
        item.usn,
        item.rollNumber ?? '',
        item.email ?? '',
        item.phone ?? '',
        item.activeAcademicContext?.departmentName ?? '',
        item.activeAcademicContext?.branchName ?? '',
        item.activeAcademicContext?.batchLabel ?? '',
        item.activeAcademicContext?.sectionCode ?? '',
      ].join(' ').toLowerCase()
      return searchableText.includes(normalizedStudentRegistrySearch)
    })
    .sort((left, right) => {
      const leftKey = `${left.activeAcademicContext?.departmentName ?? ''}-${left.activeAcademicContext?.branchName ?? ''}-${left.name}-${left.usn}`
      const rightKey = `${right.activeAcademicContext?.departmentName ?? ''}-${right.activeAcademicContext?.branchName ?? ''}-${right.name}-${right.usn}`
      return leftKey.localeCompare(rightKey)
    })
  const studentRegistryViewItems = studentRegistryItems.map(student => {
    const proofOverlayActive = shouldOverlayProofCheckpointStudentSummary({
      routeSection: route.section,
      studentBatchId: student.activeAcademicContext?.batchId,
      selectedProofCheckpoint,
      registryScope: scopedAdminDirectoryFilter,
    })
    const checkpointSummary = proofOverlayActive
      ? selectedProofCheckpointStudentMap.get(student.studentId) ?? null
      : null
    const displaySemester = checkpointSummary?.currentSemester
      ?? (proofOverlayActive ? selectedProofCheckpoint?.semesterNumber ?? null : student.activeAcademicContext?.semesterNumber ?? null)
    const showCheckpointCgpa = shouldShowProofCheckpointCgpa({
      proofScopeActive: proofOverlayActive,
      semesterNumber: displaySemester,
      stageKey: selectedProofCheckpoint?.stageKey,
    })
    return {
      student,
      proofOverlayActive,
      checkpointSummary,
      displayCgpa: checkpointSummary
        ? checkpointSummary.observedEvidence.cgpa
        : proofOverlayActive
          ? null
          : student.currentCgpa,
      displaySemester,
      showCheckpointCgpa,
    }
  })
  const studentRegistryProofOverlayActive = studentRegistryViewItems.some(item => item.proofOverlayActive)
  const facultyRegistryItems = (hasHierarchyScopeSelection(facultyRegistryScope) ? scopedAdminDirectoryData : operatorData).facultyMembers
    .filter(item => isFacultyMemberVisible(operatorData, item))
    .filter(item => matchesFacultyScope(item, operatorData, {
      academicFacultyId: effectiveFacultyRegistryFilter.academicFacultyId || null,
      departmentId: effectiveFacultyRegistryFilter.departmentId || null,
      branchId: effectiveFacultyRegistryFilter.branchId || null,
      batchId: effectiveFacultyRegistryFilter.batchId || null,
      sectionCode: effectiveFacultyRegistryFilter.sectionCode || null,
    }))
    .filter(item => {
      if (!normalizedFacultyRegistrySearch) return true
      const primaryDepartment = resolveDepartment(operatorData, getPrimaryAppointmentDepartmentId(item))?.name ?? ''
      const searchableText = [
        item.displayName,
        item.employeeCode,
        item.username,
        item.email,
        item.phone ?? '',
        item.designation,
        primaryDepartment,
        ...item.roleGrants.map(grant => grant.roleCode),
      ].join(' ').toLowerCase()
      return searchableText.includes(normalizedFacultyRegistrySearch)
    })
    .sort((left, right) => {
      const leftDepartment = resolveDepartment(operatorData, getPrimaryAppointmentDepartmentId(left))?.name ?? ''
      const rightDepartment = resolveDepartment(operatorData, getPrimaryAppointmentDepartmentId(right))?.name ?? ''
      return `${leftDepartment}-${left.displayName}-${left.employeeCode}`.localeCompare(`${rightDepartment}-${right.displayName}-${right.employeeCode}`)
    })
  const studentRegistryCaption = studentRegistryHasScope
    ? studentRegistryProofOverlayActive && selectedProofCheckpoint
      ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Proof-scoped feed filtered to ${studentRegistryScopeLabel ?? 'the selected academic scope'} and pinned to Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}.`
      : `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Live scope-backed feed filtered to ${studentRegistryScopeLabel ?? 'the selected academic scope'}.`
    : studentRegistryProofOverlayActive && selectedProofCheckpoint
      ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Global registry remains open, but proof-batch students now follow Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel} instead of stale canonical-semester cards.`
    : selectedStudentRouteIsExplicit
      ? 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. The global registry remains open while the explicit student drilldown is focused on the right.'
      : 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Global student registry is open; apply filters to narrow the scope.'
  const studentRegistryEmptyMessage = studentRegistryHasScope
    ? studentRegistryProofOverlayActive && selectedProofCheckpoint
      ? `No students match the current proof scope for Semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel}.`
      : 'No students match the current academic scope.'
    : selectedStudentRouteIsExplicit
      ? 'No students match the current global filters. The explicit student drilldown is already open on the right.'
      : 'No students match the current global filters.'
  const termsForEnrollment = visibleTerms.filter(item => !enrollmentForm.branchId || item.branchId === enrollmentForm.branchId)
  const branchesForAppointment = visibleBranches.filter(item => !appointmentForm.departmentId || item.departmentId === appointmentForm.departmentId)
  const selectedFacultyOwnerships = selectedFacultyMember
    ? activeVisibleOwnerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
    : []
  const activeOfferingOwnerById = new Map(
    activeVisibleOwnerships
      .map(item => [item.offeringId, item]),
  )
  const availableOwnershipOfferings = selectedFacultyMember
    ? visibleOfferings.filter(item => !activeOfferingOwnerById.has(item.offId))
    : []
  const selectedFacultyCalendarOfferings = selectedFacultyAssignments.flatMap(item => item.offering ? [item.offering] : [])
  const sortedFacultyCalendarMarkers = [...(facultyCalendar?.workspace.markers ?? [])]
    .sort((left, right) => {
      if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
      return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    })
  const facultyCalendarRecurringBlocks = facultyCalendar?.template?.classBlocks.filter(item => !item.dateISO) ?? []
  const facultyCalendarExtraBlocks = facultyCalendar?.template?.classBlocks.filter(item => !!item.dateISO) ?? []

  useEffect(() => {
    if (!activeGovernanceScopeId || !activeGovernanceScopeType) return
    setPolicyForm(hydratePolicyForm(effectiveScopePolicy))
  }, [
    activeGovernanceScopeId,
    activeGovernanceScopeType,
    activeScopePolicyOverride?.policyOverrideId,
    activeScopePolicyOverride?.version,
    effectiveScopePolicy,
  ])

  useEffect(() => {
    if (routeScopedBatchId || !preferredGovernanceBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        if (!cancelled) setResolvedBatchPolicy(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, preferredGovernanceBatchId, routeScopedBatchId, selectedSectionCode, session])

  useEffect(() => {
    if (!activeGovernanceScopeId || !activeGovernanceScopeType) {
      setStagePolicyForm(defaultStagePolicyForm())
      return
    }
    setStagePolicyForm(hydrateStagePolicyForm(effectiveScopeStagePolicy))
  }, [
    activeGovernanceScopeId,
    activeGovernanceScopeType,
    activeScopeStageOverride?.stagePolicyOverrideId,
    activeScopeStageOverride?.version,
    effectiveScopeStagePolicy,
  ])

  useEffect(() => {
    if (routeScopedBatchId || !preferredGovernanceBatchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedStagePolicy(preferredGovernanceBatchId, { sectionCode: selectedSectionCode })
        if (!cancelled) setResolvedStagePolicy(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, preferredGovernanceBatchId, routeScopedBatchId, selectedSectionCode, session])

  useEffect(() => {
    setBatchProvisioningForm(prev => ({
      ...prev,
      termId: currentSemesterTerm?.termId ?? prev.termId,
      sectionLabels: selectedBatch?.sectionLabels.join(', ') ?? prev.sectionLabels,
    }))
  }, [currentSemesterTerm?.termId, selectedBatch?.batchId, selectedBatch?.sectionLabels])

  useEffect(() => {
    const availableKeys = new Set(curriculumFeatureTargetScopeOptions.map(scope => `${scope.scopeType}::${scope.scopeId}`))
    if (availableKeys.size === 0) {
      setCurriculumFeatureTargetScopeKey('')
      return
    }
    setCurriculumFeatureTargetScopeKey(current => {
      if (current && availableKeys.has(current)) return current
      const preferred = selectedBranch
        ? `branch::${selectedBranch.branchId}`
        : activeGovernanceScope
          ? `${activeGovernanceScope.scopeType}::${activeGovernanceScope.scopeId}`
          : null
      return preferred && availableKeys.has(preferred) ? preferred : Array.from(availableKeys)[0]!
    })
  }, [activeGovernanceScope, curriculumFeatureTargetScopeOptions, selectedBranch])

  useEffect(() => {
    if (!selectedStageOffering) {
      setSelectedStageOfferingId('')
      setSelectedStageEligibility(null)
      return
    }
    if (selectedStageOffering.offId !== selectedStageOfferingId) {
      setSelectedStageOfferingId(selectedStageOffering.offId)
    }
  }, [selectedStageOffering, selectedStageOfferingId])

  useEffect(() => {
    if (!selectedStageOfferingId || !selectedBatch) {
      setSelectedStageEligibility(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getOfferingStageEligibility(selectedStageOfferingId)
        if (!cancelled) setSelectedStageEligibility(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedBatch, selectedStageOfferingId])
  const scopeOptions = (() => {
    if (roleGrantForm.scopeType === 'institution') {
      return data.institution ? [{ value: data.institution.institutionId, label: data.institution.name }] : []
    }
    if (roleGrantForm.scopeType === 'academic-faculty') {
      return visibleAcademicFaculties.map(item => ({ value: item.academicFacultyId, label: item.name }))
    }
    if (roleGrantForm.scopeType === 'department') {
      return visibleDepartments.map(item => ({ value: item.departmentId, label: item.name }))
    }
    if (roleGrantForm.scopeType === 'branch') {
      return visibleBranches.map(item => ({ value: item.branchId, label: item.name }))
    }
    if (roleGrantForm.scopeType === 'batch') {
      return visibleBatches.map(item => ({ value: item.batchId, label: `${item.batchLabel} · ${deriveCurrentYearLabel(item.currentSemester)}` }))
    }
  if (roleGrantForm.scopeType === 'offering') {
      return visibleOfferings.map(item => ({ value: item.offId, label: `${item.code} · ${item.year} · ${item.section}` }))
    }
    return []
  })()
  const handleOpenScopedRegistry = (section: 'students' | 'faculty-members') => {
    if (activeUniversityRegistryScope) {
      setRegistryScope(activeUniversityRegistryScope)
      if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
      else setFacultyRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
    } else if (section === 'students') {
      clearRegistryScope()
      setStudentRegistryFilter(defaultRegistryFilter())
    } else {
      clearRegistryScope()
      setFacultyRegistryFilter(defaultRegistryFilter())
    }
    navigate({ section })
  }
  const handleOpenFullRegistry = (section: 'students' | 'faculty-members') => {
    clearRegistryScope()
    if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
    else setFacultyRegistryFilter(defaultRegistryFilter())
    navigate({ section })
  }
  const handleReturnToScopedUniversity = () => {
    if (!registryScope) return
    updateUniversityTab('overview', { recordHistory: false })
    updateSelectedSectionCode(registryScope.sectionCode, { recordHistory: false })
    navigate({
      section: 'faculties',
      academicFacultyId: registryScope.academicFacultyId ?? undefined,
      departmentId: registryScope.departmentId ?? undefined,
      branchId: registryScope.branchId ?? undefined,
      batchId: registryScope.batchId ?? undefined,
    }, { recordHistory: false })
  }
  const handleResetFacultiesWorkspaceRestore = useCallback(() => {
    if (typeof window !== 'undefined' && route.section === 'faculties') {
      window.sessionStorage.removeItem(`airmentor-admin-ui:${routeToHash(route)}`)
    }
    setSelectedSectionCode(null)
    setUniversityTab('overview')
    setFacultiesRestoreNotice(null)
  }, [route, setFacultiesRestoreNotice])
  // --- Breadcrumbs ---
  const topBarBreadcrumbs: BreadcrumbSegment[] = (() => {
    if (route.section === 'overview') return [{ label: 'Dashboard' }]
    if (route.section === 'proof-dashboard') return [{ label: 'Proof Dashboard' }]
    if (route.section === 'history') return [{ label: 'History & Restore' }]
    if (route.section === 'requests') {
      const segments: BreadcrumbSegment[] = [{ label: 'Requests', onClick: selectedRequestSummary ? () => navigate({ section: 'requests' }) : undefined }]
      if (selectedRequestSummary) segments.push({ label: selectedRequestSummary.summary || selectedRequestSummary.adminRequestId })
      return segments
    }
    if (route.section === 'students') {
      const segments: BreadcrumbSegment[] = []
      if (registryScope) segments.push({ label: registryScope.label, onClick: () => handleReturnToScopedUniversity() })
      segments.push({ label: 'Students', onClick: selectedStudent ? () => navigate({ section: 'students' }) : undefined })
      if (selectedStudent) segments.push({ label: selectedStudent.name })
      return segments
    }
    if (route.section === 'faculty-members') {
      const segments: BreadcrumbSegment[] = []
      if (registryScope) segments.push({ label: registryScope.label, onClick: () => handleReturnToScopedUniversity() })
      segments.push({ label: 'Faculty Members', onClick: selectedFacultyMember ? () => navigate({ section: 'faculty-members' }) : undefined })
      if (selectedFacultyMember) segments.push({ label: selectedFacultyMember.displayName })
      return segments
    }
    if (route.section === 'faculties') {
      const segments: BreadcrumbSegment[] = [{ label: 'University', onClick: selectedAcademicFaculty ? () => navigate({ section: 'faculties' }) : undefined }]
      if (selectedAcademicFaculty) {
        segments.push({ label: selectedAcademicFaculty.name, onClick: selectedDepartment ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId }) : undefined })
      }
      if (selectedDepartment) {
        segments.push({ label: selectedDepartment.name, onClick: selectedBranch ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId }) : undefined })
      }
      if (selectedBranch) {
        segments.push({ label: selectedBranch.name, onClick: selectedBatch ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId }) : undefined })
      }
      if (selectedBatch) {
        segments.push({ label: `Batch ${selectedBatch.batchLabel}`, onClick: selectedSectionCode ? () => { updateSelectedSectionCode(null); navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch?.branchId, batchId: selectedBatch.batchId }) } : undefined })
      }
      if (selectedSectionCode) {
        segments.push({ label: `Section ${selectedSectionCode}` })
      }
      return segments
    }
    return []
  })()
  const adminContextLabel = route.section === 'faculties'
    ? universityWorkspaceLabel
    : route.section === 'proof-dashboard'
      ? 'Proof Dashboard'
    : route.section === 'students'
      ? 'Student Registry'
      : route.section === 'faculty-members'
        ? 'Faculty Registry'
        : route.section === 'requests'
        ? 'Governed Requests'
        : route.section === 'history'
          ? 'History And Restore'
            : 'System Admin'
  const railScopeLabel = route.section === 'faculties'
    ? activeUniversityRegistryScope?.label ?? universityWorkspaceLabel
    : route.section === 'proof-dashboard'
      ? canonicalProofRegistryScope?.label ?? registryScope?.label
    : route.section === 'students'
      ? studentRegistryScopeLabel ?? undefined
      : route.section === 'faculty-members'
        ? facultyRegistryScopeLabel ?? registryScope?.label ?? undefined
        : registryScope?.label
  const railSearchPlaceholder = route.section === 'overview'
    ? 'Search across the full control plane...'
    : route.section === 'proof-dashboard'
      ? 'Search the proof control plane...'
    : route.section === 'faculties'
      ? 'Search within the active university scope...'
      : route.section === 'students'
        ? 'Search students in the active scope...'
        : route.section === 'faculty-members'
          ? 'Search faculty in the active scope...'
          : route.section === 'requests'
            ? 'Search governed requests...'
            : 'Search admin history...'
  const railSearchResults = searchResults.map(result => ({
    key: result.key,
    title: result.label,
    subtitle: result.meta,
    onSelect: () => {
      const scopedRegistryTarget = result.route.section === 'students' || result.route.section === 'faculty-members'
      if (scopedRegistryTarget) {
        const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
        if (nextScope) {
          setRegistryScope(nextScope)
          if (result.route.section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(nextScope))
          if (result.route.section === 'faculty-members') setFacultyRegistryFilter(hydrateRegistryFilter(nextScope))
        }
      }
      setSearchQuery('')
      navigate(result.route)
    },
  }))
  const handleRailSectionChange = (section: LiveAdminSectionId) => {
    if (section === route.section) return
    if (section === 'students' || section === 'faculty-members') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      if (nextScope) {
        setRegistryScope(nextScope)
        if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(nextScope))
        else setFacultyRegistryFilter(hydrateRegistryFilter(nextScope))
      } else if (route.section === 'faculties') {
        clearRegistryScope()
        if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
        else setFacultyRegistryFilter(defaultRegistryFilter())
      }
      navigate({ section })
      return
    }
    if (section === 'faculties') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      navigate({
        section: 'faculties',
        academicFacultyId: nextScope?.academicFacultyId ?? undefined,
        departmentId: nextScope?.departmentId ?? undefined,
        branchId: nextScope?.branchId ?? undefined,
        batchId: nextScope?.batchId ?? undefined,
      })
      return
    }
    navigate({ section })
  }
  const canNavigateBack = routeHistory.length > 0
  const workspaceAdminName = session?.faculty?.displayName ?? session?.user.username ?? 'System Admin'
  const proofLauncherOperationalSemester = activeRunDetail?.activeOperationalSemester ?? authoritativeOperationalSemester
  const proofLauncherStageLabel = selectedProofCheckpoint
    ? `${selectedProofCheckpoint.stageLabel} · Semester ${selectedProofCheckpoint.semesterNumber}`
    : proofLauncherOperationalSemester != null
      ? `Live semester ${proofLauncherOperationalSemester}`
      : 'No active checkpoint selected'
  const proofLauncherPopupTitle = activeRunDetail ? `Proof run ${activeRunDetail.runLabel}` : 'Proof control plane'
  const proofLauncherPopupCaption = canonicalProofRegistryScope
    ? `Quick proof actions for ${canonicalProofRegistryScope.label}. Snapshot and preview actions change proof pages only.`
    : 'Quick proof actions for the canonical proof batch.'
  void [
    DayToggle,
    WEEKDAYS,
    STAGE_EVIDENCE_OPTIONS,
    selectedStageEligibility,
    startEditingTerm,
    startEditingCurriculumCourse,
    handleSaveTerm,
    handleArchiveTerm,
    handleSaveCurriculumCourse,
    handleBootstrapCurriculumManifest,
    handleArchiveCurriculumCourse,
    handleSaveScopePolicy,
    handleResetScopePolicy,
    handleSaveScopeStagePolicy,
    handleResetScopeStagePolicy,
    handleAdvanceOfferingStage,
    handleProvisionBatch,
    handleAssignCurriculumCourseLeader,
    selectedCurriculumCourse,
    universityNextItems,
    universityNavigatorTitle,
    universityNavigatorHelper,
    getUniversityCourseLeaders,
    scopedCourseLeaderFaculty,
    getScopedCourseLeaderState,
    batchFacultyPool,
    batchOfferingsWithoutOwner,
    batchStudentsWithoutEnrollment,
    batchStudentsWithoutMentor,
    batchOfferingsWithoutRoster,
  ]

  // --- Main workspace ---
  return (
    <SystemAdminSessionBoundary
      booting={booting}
      activeRoleCode={session?.activeRoleGrant.roleCode ?? null}
      canSwitchToSystemAdmin={Boolean(systemAdminGrant)}
      authBusy={authBusy}
      authError={authError}
      identifier={identifier}
      password={password}
      apiBaseUrl={apiBaseUrl}
      onIdentifierChange={setIdentifier}
      onPasswordChange={setPassword}
      onLogin={handleLogin}
      onExitPortal={onExitPortal}
      onSwitchToSystemAdmin={() => { void handleSwitchToSystemAdmin() }}
      onLogout={() => { void handleLogout() }}
    >
      <div className="app-shell" style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text, transition: 'background-color 220ms ease, color 220ms ease' }}>
        <TeachingShellAdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        adminName={workspaceAdminName}
        contextLabel={adminContextLabel}
        now={now}
        themeMode={themeMode}
        actionCount={actionQueueCount}
        showActionQueue={showActionQueue}
        canNavigateBack={canNavigateBack}
        onNavigateBack={handleNavigateBack}
        onToggleTheme={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}
        onGoHome={handleGoHome}
        onToggleQueue={() => setShowActionQueue(current => !current)}
        onRefresh={() => { void loadAdminData() }}
        onLogout={handleLogout}
        />

        <ProofSurfaceLauncher
          targetId={route.section === 'proof-dashboard' ? 'system-admin-proof-controls' : undefined}
          label="Proof Control"
          dataProofEntityId={selectedProofCheckpoint?.simulationStageCheckpointId ?? activeRunDetail?.simulationRunId ?? canonicalProofRegistryScope?.batchId ?? 'proof-dashboard'}
          popupTitle={proofLauncherPopupTitle}
          popupCaption={proofLauncherPopupCaption}
          popupContent={({ closePopup }) => (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Current stage</div>
                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{proofLauncherStageLabel}</div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue / requests</div>
                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{`${activeRunDetail?.monitoringSummary.activeReassessmentCount ?? 0} queue · ${openRequests.length} requests`}</div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Verification ledger</div>
                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{`${activeRunDetail?.monitoringSummary.acknowledgementCount ?? 0} acknowledgements · ${activeRunDetail?.monitoringSummary.resolutionCount ?? 0} resolutions`}</div>
                </Card>
                <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 6 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>Private reminders</div>
                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{pendingReminders.length}</div>
                </Card>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ProofSimulationControls
                  activeRunDetail={activeRunDetail}
                  activeRunCheckpoints={activeRunCheckpoints}
                  selectedProofCheckpoint={selectedProofCheckpoint}
                  selectedProofCheckpointCanStepForward={selectedProofCheckpointCanStepForward}
                  selectedProofCheckpointCanPlayToEnd={selectedProofCheckpointCanPlayToEnd}
                  baselineSnapshot={activeRunDetail?.snapshots.find(item => /baseline/i.test(item.snapshotLabel)) ?? activeRunDetail?.snapshots[0] ?? null}
                  resetStageSnapshot={activeRunDetail?.snapshots[0] ?? null}
                  createDisabled={proofDashboardLoading}
                  onCreateProofSimulation={handleCreateProofSimulation}
                  onStopProofRun={handleStopProofRun}
                  onAdvanceProofRun={handleAdvanceProofRun}
                  onRestoreProofSnapshot={handleRestoreProofSnapshot}
                  onResetProofRunFromScratch={handleResetProofRunFromScratch}
                  onStepProofPlayback={handleStepProofPlayback}
                  beforeAction={closePopup}
                />
              </div>
            </div>
          )}
          popupFooter={({ closePopup, jumpToTarget }) => (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => {
                  closePopup()
                  if (route.section === 'proof-dashboard') {
                    jumpToTarget()
                    return
                  }
                  navigate({ section: 'proof-dashboard' })
                }}
              >
                {route.section === 'proof-dashboard' ? 'Jump To Live Controls' : 'Open Proof Dashboard'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={closePopup}>
                Close
              </Btn>
            </div>
          )}
        />

        <div style={{ display: 'flex', minHeight: 'calc(100vh - 84px)', alignItems: 'stretch' }}>
        {sidebarCollapsed ? (
        <motion.button
          type="button"
          aria-label="Expand operations rail"
          title="Expand operations rail"
          onClick={() => setSidebarCollapsed(false)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: 18,
            bottom: 18,
            zIndex: 32,
            width: 42,
            height: 42,
            borderRadius: 999,
            background: T.surface,
            border: `1px solid ${T.border2}`,
            color: T.muted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 14px 30px rgba(2,6,23,0.18)',
          }}
        >
          <ChevronRight size={16} />
        </motion.button>
      ) : null}
      <OperationsRail
        collapsed={sidebarCollapsed}
        contextLabel={adminContextLabel}
        scopeLabel={railScopeLabel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={railSearchPlaceholder}
        searchResults={railSearchResults}
        activeSection={route.section as LiveAdminSectionId}
        onSectionChange={handleRailSectionChange}
        breadcrumbs={topBarBreadcrumbs}
        onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: renderInlineActionQueue ? 'minmax(0,1fr) 320px' : 'minmax(0,1fr)', gap: 0, alignItems: 'start' }}>
      <motion.div
        key={`${routeToHash(route)}::${universityTab}::${selectedSectionCode ?? ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ minWidth: 0 }}
      >
      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34, maxWidth: '100%', paddingLeft: viewportWidth < 720 ? 14 : 22, paddingRight: viewportWidth < 720 ? 14 : 22 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {curriculumProofRefreshRetry ? (
          <RestoreBanner
            title="Proof Refresh Needs Retry"
            message={curriculumProofRefreshRetry.message}
            tone="error"
            actionLabel="Retry proof refresh"
            onAction={() => {
              void retryCurriculumProofRefresh()
            }}
          />
        ) : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {/* ========== OVERVIEW ========== */}
        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <OverviewSection
            viewportWidth={viewportWidth}
            actionQueueCount={actionQueueCount}
            openRequests={openRequests}
            hiddenItemCount={hiddenItemCount}
            remindersSupported={remindersSupported}
            pendingReminders={pendingReminders}
            activeRunDetail={activeRunDetail}
            proofLauncherStageLabel={proofLauncherStageLabel}
            visibleAcademicFaculties={visibleAcademicFaculties}
            visibleDepartments={visibleDepartments}
            visibleBranches={visibleBranches}
            overviewHierarchyScope={overviewHierarchyScope}
            overviewVisibleStudentCount={overviewVisibleStudentCount}
            overviewVisibleMentoredCount={overviewVisibleMentoredCount}
            overviewGlobalStudentCount={overviewGlobalStudentCount}
            overviewGlobalMentoredCount={overviewGlobalMentoredCount}
            overviewScopeLabel={overviewScopeLabel}
            overviewFacultyCaption={overviewFacultyCaption}
            overviewVisibleMentorGapCount={overviewVisibleMentorGapCount}
            overviewCounts={overviewCounts}
            navigate={navigate}
          />
        )}

        {/* ========== PROOF DASHBOARD ========== */}
        {route.section === 'proof-dashboard' && (
          <SystemAdminProofDashboardWorkspace
            proofDashboard={proofDashboard}
            proofDashboardLoading={proofDashboardLoading}
            batchSetupReadiness={effectiveBatchSetupReadiness}
            dashboardLayout="page"
            showLauncher={false}
            activeRunCheckpoints={activeRunCheckpoints}
            activeModelDiagnostics={activeModelDiagnostics}
            activeProductionDiagnostics={activeProductionDiagnostics}
            activeDiagnosticsTrainingManifestVersion={activeDiagnosticsTrainingManifestVersion}
            activeDiagnosticsCalibrationVersion={activeDiagnosticsCalibrationVersion}
            activeDiagnosticsSplitSummary={activeDiagnosticsSplitSummary}
            activeDiagnosticsWorldSplitSummary={activeDiagnosticsWorldSplitSummary}
            activeDiagnosticsScenarioFamilies={activeDiagnosticsScenarioFamilies}
            activeDiagnosticsHeadSupportSummary={activeDiagnosticsHeadSupportSummary}
            activeDiagnosticsGovernedRunCount={activeDiagnosticsGovernedRunCount}
            activeDiagnosticsSkippedRunCount={activeDiagnosticsSkippedRunCount}
            activeDiagnosticsDisplayProbabilityAllowed={activeDiagnosticsDisplayProbabilityAllowed}
            activeDiagnosticsSupportWarning={activeDiagnosticsSupportWarning}
            activeDiagnosticsPolicyDiagnostics={activeDiagnosticsPolicyDiagnostics}
            activeDiagnosticsCoEvidence={activeDiagnosticsCoEvidence}
            activeDiagnosticsPolicyAcceptance={activeDiagnosticsPolicyAcceptance}
            activeDiagnosticsOverallCourseRuntime={activeDiagnosticsOverallCourseRuntime}
            activeDiagnosticsQueueBurden={activeDiagnosticsQueueBurden}
            activeDiagnosticsUiParity={activeDiagnosticsUiParity}
            selectedProofCheckpoint={selectedProofCheckpoint}
            selectedProofCheckpointDetail={selectedProofCheckpointDetail}
            selectedProofCheckpointBlocked={selectedProofCheckpointBlocked}
            selectedProofCheckpointHasBlockedProgression={selectedProofCheckpointHasBlockedProgression}
            selectedProofCheckpointCanStepForward={selectedProofCheckpointCanStepForward}
            selectedProofCheckpointCanPlayToEnd={selectedProofCheckpointCanPlayToEnd}
            proofPlaybackRestoreNotice={proofPlaybackRestoreNotice}
            onCreateProofImport={handleCreateProofImport}
            onValidateLatestProofImport={handleValidateLatestProofImport}
            onReviewPendingCrosswalks={handleReviewPendingCrosswalks}
            onApproveLatestProofImport={handleApproveLatestProofImport}
            onCreateProofSimulation={handleCreateProofSimulation}
            onCreateProofRun={handleCreateProofRun}
            onRecomputeProofRunRisk={handleRecomputeProofRunRisk}
            onActivateProofRun={handleActivateProofRun}
            onActivateProofSemester={handleActivateProofSemester}
            onAdvanceProofRun={handleAdvanceProofRun}
            onRetryProofRun={handleRetryProofRun}
            onStopProofRun={handleStopProofRun}
            onArchiveProofRun={handleArchiveProofRun}
            onRestoreProofSnapshot={handleRestoreProofSnapshot}
            onResetProofRunFromScratch={handleResetProofRunFromScratch}
            onResetProofPlaybackSelection={handleResetProofPlaybackSelection}
            onDismissProofPlaybackRestoreNotice={() => setProofPlaybackRestoreNotice(null)}
            onSelectProofCheckpoint={handleSelectProofCheckpoint}
            onStepProofPlayback={handleStepProofPlayback}
            formatSplitSummary={formatSplitSummary}
            formatKeyedCounts={formatKeyedCounts}
            formatHeadSupportSummary={formatHeadSupportSummary}
            formatDiagnosticSummary={formatDiagnosticSummary}
          />
        )}

        {/* ========== FACULTIES (selector workspace) ========== */}
        {route.section === 'faculties' && (
          <SystemAdminFacultiesWorkspace
            data={operatorData}
            route={route}
            toneColor={ADMIN_SECTION_TONES.faculties}
            restoreNotice={facultiesRestoreNotice}
            onResetRestore={handleResetFacultiesWorkspaceRestore}
            onDismissRestoreNotice={dismissFacultiesRestoreNotice}
            selectedAcademicFaculty={selectedAcademicFaculty}
            selectedDepartment={selectedDepartment}
            selectedBranch={selectedBranch}
            selectedBatch={selectedBatch}
            canonicalProofBatch={canonicalProofBatch}
            authoritativeOperationalSemester={authoritativeOperationalSemester}
            authoritativeOperationalSemesterSource={authoritativeOperationalSemesterSource}
            selectedSectionCode={selectedSectionCode}
            selectedAcademicFacultyImpact={selectedAcademicFacultyImpact}
            facultyDepartments={facultyDepartments}
            departmentBranches={departmentBranches}
            branchBatches={branchBatches}
            structureForms={structureForms}
            setStructureForms={setStructureForms}
            setEditingEntity={value => setEditingEntity(value as EditingEntity | null)}
            handleCreateAcademicFaculty={handleCreateAcademicFaculty}
            handleCreateDepartment={handleCreateDepartment}
            handleCreateBranch={handleCreateBranch}
            handleCreateBatch={handleCreateBatch}
            navigate={navigate}
            updateSelectedSectionCode={updateSelectedSectionCode}
            universityTab={universityTab}
            updateUniversityTab={(tabId, options) => updateUniversityTab(tabId as UniversityTab, options)}
            universityTabOptions={universityTabOptions}
            universityWorkspaceTabCards={universityWorkspaceTabCards}
            universityWorkspaceColumns={universityWorkspaceColumns}
            universityLevelTitle={universityLevelTitle}
            universityLevelHelper={universityLevelHelper}
            universityLeftItems={universityLeftItems}
            universityWorkspaceLabel={universityWorkspaceLabel}
            universityWorkspacePaneRef={universityWorkspacePaneRef}
            stickyShadow={isLightTheme(themeMode) ? '0 18px 32px rgba(15, 23, 42, 0.08)' : '0 18px 32px rgba(2, 6, 23, 0.32)'}
            activeBatchPolicyOverride={activeBatchPolicyOverride}
            activeScopeChain={activeScopeChain}
            activeGovernanceScope={activeGovernanceScope}
            resolvedBatchPolicy={resolvedBatchPolicy}
            resolvedStagePolicy={resolvedStagePolicy}
            activeScopePolicyOverride={activeScopePolicyOverride}
            activeScopeStageOverride={activeScopeStageOverride}
            policyForm={policyForm}
            setPolicyForm={setPolicyForm}
            stagePolicyForm={stagePolicyForm}
            setStagePolicyForm={setStagePolicyForm}
            handleSaveScopePolicy={handleSaveScopePolicy}
            handleResetScopePolicy={handleResetScopePolicy}
            handleSaveScopeStagePolicy={handleSaveScopeStagePolicy}
            handleResetScopeStagePolicy={handleResetScopeStagePolicy}
            entityEditors={entityEditors}
            setEntityEditors={setEntityEditors}
            batchTerms={batchTerms}
            currentSemesterTerm={currentSemesterTerm}
            startEditingTerm={startEditingTerm}
            resetTermEditor={resetTermEditor}
            handleSaveTerm={handleSaveTerm}
            handleArchiveTerm={handleArchiveTerm}
            selectedCurriculumSemester={selectedCurriculumSemester}
            setSelectedCurriculumSemester={setSelectedCurriculumSemester}
            curriculumSemesterEntries={curriculumSemesterEntries}
            selectedCurriculumCourseId={selectedCurriculumCourseId}
            startEditingCurriculumCourse={startEditingCurriculumCourse}
            resetCurriculumEditor={resetCurriculumEditor}
            handleSaveCurriculumCourse={handleSaveCurriculumCourse}
            handleArchiveCurriculumCourse={handleArchiveCurriculumCourse}
            handleBootstrapCurriculumManifest={handleBootstrapCurriculumManifest}
            scopedCourseLeaderFaculty={scopedCourseLeaderFaculty}
            getScopedCourseLeaderState={getScopedCourseLeaderState}
            handleAssignCurriculumCourseLeader={handleAssignCurriculumCourseLeader}
            batchProvisioningForm={batchProvisioningForm}
            setBatchProvisioningForm={setBatchProvisioningForm}
            handleProvisionBatch={handleProvisionBatch}
            handleProvisionSeededDemoWorkspace={handleProvisionSeededDemoWorkspace}
            batchFacultyPool={batchFacultyPool}
            batchMentorEligibleFaculty={batchMentorEligibleFaculty}
            batchOfferingsWithoutOwner={batchOfferingsWithoutOwner}
            batchStudentsWithoutEnrollment={batchStudentsWithoutEnrollment}
            batchStudentsWithoutMentor={batchStudentsWithoutMentor}
            batchOfferingsWithoutRoster={batchOfferingsWithoutRoster}
            batchSetupReadiness={effectiveBatchSetupReadiness}
            bulkMentorAssignmentForm={bulkMentorAssignmentForm}
            setBulkMentorAssignmentForm={setBulkMentorAssignmentForm}
            bulkMentorAssignmentPreview={bulkMentorAssignmentPreview}
            handlePreviewBulkMentorAssignment={handlePreviewBulkMentorAssignment}
            handleApplyBulkMentorAssignment={handleApplyBulkMentorAssignment}
            clearBulkMentorAssignmentPreview={() => setBulkMentorAssignmentPreview(null)}
            activeUniversityRegistryScope={activeUniversityRegistryScope}
            activeUniversityStudentScopeChipLabel={activeUniversityStudentScopeChipLabel}
            activeUniversityFacultyScopeChipLabel={activeUniversityFacultyScopeChipLabel}
            scopedUniversityStudents={scopedUniversityStudents}
            filteredUniversityFaculty={filteredUniversityFaculty}
            curriculumFeatureConfig={curriculumFeatureConfig}
            curriculumFeatureItems={curriculumFeatureItems}
            selectedCurriculumFeatureCourseId={selectedCurriculumFeatureCourseId}
            setSelectedCurriculumFeatureCourseId={setSelectedCurriculumFeatureCourseId}
            selectedCurriculumFeatureItem={selectedCurriculumFeatureItem}
            curriculumFeatureProfileOptions={curriculumFeatureProfileOptions}
            curriculumFeatureBindingMode={curriculumFeatureBindingMode}
            setCurriculumFeatureBindingMode={setCurriculumFeatureBindingMode}
            curriculumFeaturePinnedProfileId={curriculumFeaturePinnedProfileId}
            setCurriculumFeaturePinnedProfileId={setCurriculumFeaturePinnedProfileId}
            curriculumFeatureTargetMode={curriculumFeatureTargetMode}
            setCurriculumFeatureTargetMode={setCurriculumFeatureTargetMode}
            curriculumFeatureTargetScopeKey={curriculumFeatureTargetScopeKey}
            setCurriculumFeatureTargetScopeKey={setCurriculumFeatureTargetScopeKey}
            curriculumFeatureTargetScopeOptions={curriculumFeatureTargetScopeOptions}
            selectedCurriculumFeatureTargetScope={selectedCurriculumFeatureTargetScope}
            curriculumFeatureAffectedBatchPreview={curriculumFeatureAffectedBatchPreview}
            curriculumLinkageGenerationStatus={curriculumLinkageGenerationStatus}
            curriculumLinkageCandidatesLoading={curriculumLinkageCandidatesLoading}
            selectedCurriculumLinkageCandidates={selectedCurriculumLinkageCandidates}
            curriculumLinkageReviewNote={curriculumLinkageReviewNote}
            setCurriculumLinkageReviewNote={setCurriculumLinkageReviewNote}
            curriculumFeatureForm={curriculumFeatureForm}
            setCurriculumFeatureForm={setCurriculumFeatureForm}
            handleSaveCurriculumFeatureBinding={handleSaveCurriculumFeatureBinding}
            handleRegenerateCurriculumLinkageCandidates={handleRegenerateCurriculumLinkageCandidates}
            handleApproveCurriculumLinkageCandidate={handleApproveCurriculumLinkageCandidate}
            handleRejectCurriculumLinkageCandidate={handleRejectCurriculumLinkageCandidate}
            handleSaveCurriculumFeatureConfig={handleSaveCurriculumFeatureConfig}
            handlePreviewCurriculumFeatureConfig={handlePreviewCurriculumFeatureConfig}
            curriculumFeaturePreview={curriculumFeaturePreview}
            handleLoadCurriculumFeatureHistory={handleLoadCurriculumFeatureHistory}
            curriculumFeatureHistory={curriculumFeatureHistory}
            proofDashboardProps={{
              proofDashboard,
              proofDashboardLoading,
              batchSetupReadiness: effectiveBatchSetupReadiness,
              activeRunCheckpoints,
              activeModelDiagnostics,
              activeProductionDiagnostics,
              activeDiagnosticsTrainingManifestVersion,
              activeDiagnosticsCalibrationVersion,
              activeDiagnosticsSplitSummary,
              activeDiagnosticsWorldSplitSummary,
              activeDiagnosticsScenarioFamilies,
              activeDiagnosticsHeadSupportSummary,
              activeDiagnosticsGovernedRunCount,
              activeDiagnosticsSkippedRunCount,
              activeDiagnosticsDisplayProbabilityAllowed,
              activeDiagnosticsSupportWarning,
              activeDiagnosticsPolicyDiagnostics,
              activeDiagnosticsCoEvidence,
              activeDiagnosticsPolicyAcceptance,
              activeDiagnosticsOverallCourseRuntime,
              activeDiagnosticsQueueBurden,
              activeDiagnosticsUiParity,
              selectedProofCheckpoint,
              selectedProofCheckpointDetail,
              selectedProofCheckpointBlocked,
              selectedProofCheckpointHasBlockedProgression,
              selectedProofCheckpointCanStepForward,
              selectedProofCheckpointCanPlayToEnd,
              proofPlaybackRestoreNotice,
              onCreateProofImport: handleCreateProofImport,
              onValidateLatestProofImport: handleValidateLatestProofImport,
              onReviewPendingCrosswalks: handleReviewPendingCrosswalks,
              onApproveLatestProofImport: handleApproveLatestProofImport,
              onCreateProofSimulation: handleCreateProofSimulation,
              onCreateProofRun: handleCreateProofRun,
              onRecomputeProofRunRisk: handleRecomputeProofRunRisk,
              onActivateProofRun: handleActivateProofRun,
              onActivateProofSemester: handleActivateProofSemester,
              onAdvanceProofRun: handleAdvanceProofRun,
              onRetryProofRun: handleRetryProofRun,
              onStopProofRun: handleStopProofRun,
              onArchiveProofRun: handleArchiveProofRun,
              onRestoreProofSnapshot: handleRestoreProofSnapshot,
              onResetProofRunFromScratch: handleResetProofRunFromScratch,
              onResetProofPlaybackSelection: handleResetProofPlaybackSelection,
              onSelectProofCheckpoint: handleSelectProofCheckpoint,
              onStepProofPlayback: handleStepProofPlayback,
              formatSplitSummary,
              formatKeyedCounts,
              formatHeadSupportSummary,
              formatDiagnosticSummary,
            }}
            onOpenProofDashboard={() => navigate({ section: 'proof-dashboard' })}
            registryLaunchProps={{
              registryScopeLabel: activeUniversityRegistryScope?.label ?? null,
              studentScopeChipLabel: activeUniversityStudentScopeChipLabel,
              facultyScopeChipLabel: activeUniversityFacultyScopeChipLabel,
              visibleStudentCount: scopedUniversityStudents.length,
              visibleFacultyCount: filteredUniversityFaculty.length,
              studentToneColor: ADMIN_SECTION_TONES.students,
              facultyToneColor: ADMIN_SECTION_TONES['faculty-members'],
              onOpenScopedStudents: () => handleOpenScopedRegistry('students'),
              onOpenAllStudents: () => handleOpenFullRegistry('students'),
              onOpenScopedFaculty: () => handleOpenScopedRegistry('faculty-members'),
              onOpenAllFaculty: () => handleOpenFullRegistry('faculty-members'),
            }}
            apiClient={apiClient}
          />
        )}

        {/* ========== STUDENTS ========== */}
        {/* ========== STUDENTS ========== */}
        {route.section === 'students' && (
          <StudentsSection
            data={data}
            route={route}
            themeMode={themeMode}
            registryPageColumns={registryPageColumns}
            registryFilterColumns={registryFilterColumns}
            registryIsSingleColumn={registryIsSingleColumn}
            registryScope={registryScope}
            navigate={navigate}
            studentRegistryItems={studentRegistryItems}
            studentRegistryViewItems={studentRegistryViewItems}
            studentRegistryCaption={studentRegistryCaption}
            studentRegistryEmptyMessage={studentRegistryEmptyMessage}
            studentRegistryScopeLabel={studentRegistryScopeLabel}
            studentRegistryProofOverlayActive={studentRegistryProofOverlayActive}
            studentRegistrySearch={studentRegistrySearch}
            setStudentRegistrySearch={setStudentRegistrySearch}
            effectiveStudentRegistryFilter={effectiveStudentRegistryFilter}
            setStudentRegistryFilter={setStudentRegistryFilter}
            studentFilterDepartments={studentFilterDepartments}
            studentFilterBranches={studentFilterBranches}
            studentFilterBatches={studentFilterBatches}
            studentFilterSections={studentFilterSections}
            visibleAcademicFaculties={visibleAcademicFaculties}
            selectedStudent={selectedStudent}
            selectedStudentRouteIsExplicit={selectedStudentRouteIsExplicit}
            selectedStudentScopeMismatch={selectedStudentScopeMismatch}
            selectedStudentDisplayCgpa={selectedStudentDisplayCgpa}
            selectedStudentDisplaySemester={selectedStudentDisplaySemester}
            selectedStudentDisplayBacklogCount={selectedStudentDisplayBacklogCount}
            selectedStudentCheckpointCgpaVisible={selectedStudentCheckpointCgpaVisible}
            selectedStudentCheckpointSummary={selectedStudentCheckpointSummary}
            selectedStudentCheckpointBanner={selectedStudentCheckpointBanner}
            selectedStudentProofBanner={selectedStudentProofBanner}
            selectedStudentPolicy={selectedStudentPolicy}
            selectedStudentPolicyLoading={selectedStudentPolicyLoading}
            selectedStudentPromotionRecommended={selectedStudentPromotionRecommended}
            selectedStudentPromotionRules={selectedStudentPromotionRules}
            selectedStudentNextTerms={selectedStudentNextTerms}
            selectedProofCheckpoint={selectedProofCheckpoint}
            studentDetailTab={studentDetailTab}
            setStudentDetailTab={setStudentDetailTab}
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            enrollmentForm={enrollmentForm}
            setEnrollmentForm={setEnrollmentForm}
            mentorForm={mentorForm}
            setMentorForm={setMentorForm}
            studentAuditLoading={studentAuditLoading}
            studentAuditEvents={studentAuditEvents}
            handleSaveStudent={handleSaveStudent}
            handleArchiveStudent={handleArchiveStudent}
            handleCloseEnrollment={handleCloseEnrollment}
            handleEndMentorAssignment={handleEndMentorAssignment}
            handlePromoteStudent={handlePromoteStudent}
            setEditingEntity={setEditingEntity}
            resetStudentEditors={resetStudentEditors}
            startEditingEnrollment={startEditingEnrollment}
            startEditingMentorAssignment={startEditingMentorAssignment}
          />
        )}

        {/* ========== FACULTY MEMBERS ========== */}
        {/* ========== FACULTY MEMBERS ========== */}
        {route.section === 'faculty-members' && (
          <FacultyMembersSection
            data={data}
            route={route}
            themeMode={themeMode}
            now={now}
            password={password}
            registryPageColumns={registryPageColumns}
            registryFilterColumns={registryFilterColumns}
            registryIsSingleColumn={registryIsSingleColumn}
            registryScope={registryScope}
            navigate={navigate}
            facultyRegistryItems={facultyRegistryItems}
            facultyRegistrySearch={facultyRegistrySearch}
            setFacultyRegistrySearch={setFacultyRegistrySearch}
            effectiveFacultyRegistryFilter={effectiveFacultyRegistryFilter}
            setFacultyRegistryFilter={setFacultyRegistryFilter}
            facultyFilterDepartments={facultyFilterDepartments}
            facultyFilterBranches={facultyFilterBranches}
            facultyFilterBatches={facultyFilterBatches}
            facultyFilterSections={facultyFilterSections}
            visibleAcademicFaculties={visibleAcademicFaculties}
            selectedFacultyMember={selectedFacultyMember}
            selectedFacultyAssignments={selectedFacultyAssignments}
            selectedFacultyOwnerships={selectedFacultyOwnerships}
            selectedFacultyCalendarOfferings={selectedFacultyCalendarOfferings}
            selectedFacultyCredentialStatus={selectedFacultyCredentialStatus}
            selectedFacultyProofBanner={selectedFacultyProofBanner}
            facultyCalendar={facultyCalendar}
            facultyCalendarLoading={facultyCalendarLoading}
            facultyCalendarRecurringBlocks={facultyCalendarRecurringBlocks}
            facultyCalendarExtraBlocks={facultyCalendarExtraBlocks}
            sortedFacultyCalendarMarkers={sortedFacultyCalendarMarkers}
            showFacultyTimetableExpanded={showFacultyTimetableExpanded}
            setShowFacultyTimetableExpanded={setShowFacultyTimetableExpanded}
            availableOwnershipOfferings={availableOwnershipOfferings}
            facultyDetailTab={facultyDetailTab}
            setFacultyDetailTab={setFacultyDetailTab}
            facultyForm={facultyForm}
            setFacultyForm={setFacultyForm}
            appointmentForm={appointmentForm}
            setAppointmentForm={setAppointmentForm}
            roleGrantForm={roleGrantForm}
            setRoleGrantForm={setRoleGrantForm}
            ownershipForm={ownershipForm}
            setOwnershipForm={setOwnershipForm}
            facultyPasswordSetupResult={facultyPasswordSetupResult}
            facultyAuditLoading={facultyAuditLoading}
            facultyAuditEvents={facultyAuditEvents}
            handleSaveFaculty={handleSaveFaculty}
            handleArchiveFaculty={handleArchiveFaculty}
            handleIssueFacultyPasswordSetup={handleIssueFacultyPasswordSetup}
            handleSaveAppointment={handleSaveAppointment}
            handleArchiveAppointment={handleArchiveAppointment}
            handleSaveRoleGrant={handleSaveRoleGrant}
            handleArchiveRoleGrant={handleArchiveRoleGrant}
            handleSaveOwnership={handleSaveOwnership}
            handleArchiveOwnership={handleArchiveOwnership}
            handleSaveFacultyCalendar={handleSaveFacultyCalendar}
            handleOpenFullRegistry={handleOpenFullRegistry}
            setEditingEntity={setEditingEntity}
            resetFacultyEditors={resetFacultyEditors}
            startEditingAppointment={startEditingAppointment}
            startEditingRoleGrant={startEditingRoleGrant}
            operatorData={operatorData}
          />
        )}

        {/* ========== HISTORY ========== */}
        {route.section === 'history' && (
          <SystemAdminHistoryWorkspace
            archivedItems={archivedItems}
            deletedItems={deletedItems}
            recentAuditEvents={recentAuditEvents}
            recentAuditLoading={recentAuditLoading}
            toneColor={ADMIN_SECTION_TONES.history}
            summarizeAuditEvent={summarizeAuditEvent}
            getAuditEventRoute={getAuditEventRoute}
            onOpenRoute={navigate}
            onRestoreItem={item => {
              void runAction(async () => {
                await item.onRestore()
                setFlashMessage(`${item.label} restored.`)
              })
            }}
          />
        )}

        {/* ========== REQUESTS ========== */}
        {route.section === 'requests' && (
          <SystemAdminRequestWorkspace
            requests={operatorData.requests}
            selectedRequestId={route.requestId}
            requestDetailLoading={requestDetailLoading}
            selectedRequest={selectedRequest}
            requestDetail={requestDetail}
            requestBusyId={requestBusy}
            toneColor={ADMIN_SECTION_TONES.requests}
            onSelectRequest={requestId => navigate({ section: 'requests', requestId })}
            onAdvanceRequest={request => { void handleAdvanceRequest(request) }}
            onRequestInfoRequest={request => { void handleRequestInfoRequest(request) }}
            onRejectRequest={request => { void handleRejectRequest(request) }}
          />
        )}

        {dataLoading ? <InfoBanner message="Refreshing live admin data…" /> : null}
      </PageShell>
      </motion.div>
      <AnimatePresence initial={false}>
      {renderInlineActionQueue ? (
        <motion.div
          key="system-admin-inline-action-queue"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: showInlineActionQueue ? 1 : 0, x: showInlineActionQueue ? 0 : 18 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="scroll-pane scroll-pane--dense"
          style={{ position: 'sticky', top: 92, height: 'calc(100vh - 92px)', overflowY: 'auto', padding: '18px 16px', borderLeft: `1px solid ${T.border}`, background: T.surface, transition: 'background-color 220ms ease, border-color 220ms ease, color 220ms ease' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Bell size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Action Queue</div>
            <Chip color={T.danger} size={10}>{actionQueueCount} visible</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>
            Requests go first. {remindersSupported ? 'Personal reminders stay private to the signed-in system admin.' : 'Private reminders are hidden until the live API supports `/api/admin/reminders`.'}
          </div>
          <QueueBulkActions
            canHideAll={visibleQueueDismissKeys.length > 0}
            hiddenCount={dismissedQueueItemKeys.length}
            onHideAll={hideAllVisibleQueueItems}
            onRestoreAll={restoreAllHiddenQueueItems}
          />

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Requests</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {openRequests.slice(0, 8).map(request => (
              <ActionQueueCard
                key={request.adminRequestId}
                title={request.summary}
                subtitle={`${request.requestType} · ${request.requesterName ?? request.requestedByFacultyId} · due ${formatDateTime(request.dueAt)}`}
                chips={[request.status, request.priority]}
                tone={request.status === 'Implemented' ? T.success : T.warning}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <Chip color={request.status === 'Implemented' ? T.success : T.warning} size={9}>{request.status}</Chip>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`request:${request.adminRequestId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
                onClick={() => navigate({ section: 'requests', requestId: request.adminRequestId })}
              />
            ))}
            {openRequests.length === 0 ? <InfoBanner message="No open HoD or governance requests right now." /> : null}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Personal Tasks</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {remindersSupported ? pendingReminders.map(reminder => (
              <ActionQueueCard
                key={reminder.reminderId}
                title={reminder.title}
                subtitle={`${reminder.body} · due ${formatDateTime(reminder.dueAt)}`}
                chips={[reminder.status]}
                tone={T.accent}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); void handleToggleReminderStatus(reminder) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`reminder:${reminder.reminderId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
              />
            )) : null}
            {remindersSupported
              ? (pendingReminders.length === 0 ? <InfoBanner message="No private admin reminders. Use the quick add button below." /> : null)
              : <InfoBanner message="This backend does not expose private reminders yet, so the queue is running in request-only mode." />}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Hidden Records</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {visibleHiddenQueueItems.slice(0, 4).map(item => (
              <ActionQueueCard
                key={item.key}
                title={item.label}
                subtitle={`${item.meta} · ${item.key.startsWith('archived:') ? 'archived' : 'deleted'} ${formatDateTime(item.updatedAt)}${item.key.startsWith('archived:') ? '' : ' · restore window 60 days'}`}
                chips={[item.meta]}
                tone={item.key.startsWith('archived:') ? T.warning : T.danger}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); void runAction(async () => { await item.onRestore(); setFlashMessage(`${item.label} restored.`) }) }} style={{ ...mono, fontSize: 10, color: T.success, background: 'none', border: 'none', cursor: 'pointer' }}>Restore</button>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`hidden:${item.key}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
              />
            ))}
            {visibleHiddenQueueItems.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>Nothing hidden right now.</div> : null}
          </div>
          {actionQueueCount === 0 && dismissedQueueItemKeys.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <InfoBanner message="Everything in this action queue is currently hidden. Use Restore all hidden to bring requests, reminders, and restore-ready records back into view." />
            </div>
          ) : null}

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, ${fadeColor(T.surface, '00')} 0%, ${T.surface} 35%)` }}>
            <button
              type="button"
              onClick={() => void handleCreateReminder()}
              disabled={!remindersSupported}
              style={getPrimaryActionButtonStyle({ disabled: !remindersSupported, fullWidth: true })}
            >
              <Plus size={14} />
              {remindersSupported ? 'Quick Add Reminder' : 'Reminder API Unavailable'}
            </button>
          </div>
        </motion.div>
      ) : null}
      </AnimatePresence>
      </div>
      </div>

      <EntityEditorModals
        editingEntity={editingEntity}
        setEditingEntity={setEditingEntity}
        selectedStudent={selectedStudent}
        selectedFacultyMember={selectedFacultyMember}
        selectedAcademicFaculty={selectedAcademicFaculty}
        selectedDepartment={selectedDepartment}
        selectedBranch={selectedBranch}
        selectedBatch={selectedBatch}
        studentForm={studentForm}
        setStudentForm={setStudentForm}
        enrollmentForm={enrollmentForm}
        setEnrollmentForm={setEnrollmentForm}
        mentorForm={mentorForm}
        setMentorForm={setMentorForm}
        facultyForm={facultyForm}
        setFacultyForm={setFacultyForm}
        roleGrantForm={roleGrantForm}
        setRoleGrantForm={setRoleGrantForm}
        appointmentForm={appointmentForm}
        setAppointmentForm={setAppointmentForm}
        entityEditors={entityEditors}
        setEntityEditors={setEntityEditors}
        visibleBranches={visibleBranches}
        visibleTerms={visibleTerms}
        visibleDepartments={visibleDepartments}
        termsForEnrollment={termsForEnrollment}
        mentorEligibleFaculty={mentorEligibleFaculty}
        branchesForAppointment={branchesForAppointment}
        scopeOptions={scopeOptions}
        handleSaveStudent={handleSaveStudent}
        handleArchiveStudent={handleArchiveStudent}
        handleSaveEnrollment={handleSaveEnrollment}
        handleSaveMentorAssignment={handleSaveMentorAssignment}
        handleSaveFaculty={handleSaveFaculty}
        handleArchiveFaculty={handleArchiveFaculty}
        handleSaveRoleGrant={handleSaveRoleGrant}
        handleSaveAppointment={handleSaveAppointment}
        handleUpdateAcademicFaculty={handleUpdateAcademicFaculty}
        handleArchiveAcademicFaculty={handleArchiveAcademicFaculty}
        handleRestoreAcademicFaculty={handleRestoreAcademicFaculty}
        handleDeleteAcademicFaculty={handleDeleteAcademicFaculty}
        handleUpdateDepartment={handleUpdateDepartment}
        handleArchiveDepartment={handleArchiveDepartment}
        handleUpdateBranch={handleUpdateBranch}
        handleArchiveBranch={handleArchiveBranch}
        handleUpdateBatch={handleUpdateBatch}
        handleArchiveBatch={handleArchiveBatch}
      />
      </div>
    </SystemAdminSessionBoundary>
  )
}
