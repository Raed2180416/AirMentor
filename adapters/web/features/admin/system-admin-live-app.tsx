import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  ChevronRight,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Network,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from '@web/shared/api/client'
import { readActiveDemoWorkspacePointer } from '@web/simulation/demo-workspace-pointer'
import type {
  ApiAdminFacultyPasswordSetupResponse,
  ApiAuditEvent,
  ApiAdminFacultyCalendar,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigHistoryEvent,
  ApiCurriculumFeatureConfigPreview,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageGenerationStatus,
  ApiFacultyRecord,
  ApiMentorAssignmentBulkApplyResponse,
  ApiAdminRequestDetail,
  ApiAdminSearchResult,
  ApiOfferingStageEligibility,
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiProofRunCheckpointStudentSummary,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiSessionResponse,
  ApiSimulationStageCheckpointSummary,
  ApiStagePolicyOverride,
  ApiStudentRecord,
} from '@web/shared/api/types'
import { T, mono, sora } from '@web/simulation/fixtures'
import { normalizeThemeMode, type ThemeMode } from '@kernel/shared/domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from '@persistence/repositories/air-mentor-repositories'
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
  type LiveAdminDataset,
  type LiveAdminRoute,
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
} from './system-admin-overview-helpers'
import { resolveSelectedAdminRequest } from './admin-request-selection'
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
} from '@web/simulation/proof-pilot'
import {
  defaultBulkMentorAssignmentForm,
  getScopedMentorEligibleFaculty,
  type BulkMentorAssignmentFormState,
} from './system-admin-provisioning-helpers'
import {
  collectAdminQueueDismissKeys,
  mergeAdminQueueDismissKeys,
} from './system-admin-action-queue'
import {
  DayToggle,
  InfoBanner,
  RestoreBanner,
  type BreadcrumbSegment,
} from './system-admin-ui'
import type { LiveAdminSectionId } from './system-admin-live-data'
import { applyThemePreset, isLightTheme } from '@web/shared/ui/theme'
import { clearProofPlaybackSelection, readSharedProofPlaybackSelection, writeProofPlaybackSelection } from '@web/simulation/proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from '@web/shared/state/telemetry'
import { SystemAdminFacultiesWorkspace } from './system-admin-faculties-workspace'
import { SystemAdminHistoryWorkspace } from './system-admin-history-workspace'
import { SystemAdminProofDashboardWorkspace } from './system-admin-proof-dashboard-workspace'
import { SystemAdminRequestWorkspace } from './system-admin-request-workspace'
import { SystemAdminSessionBoundary } from './system-admin-session-shell'
import { ProofSurfaceLauncher } from '@web/simulation/proof-surface-shell'
import { ProofSimulationControls } from '@web/simulation/proof-simulation-controls'
import {
  Btn,
  Card,
  PageShell,
} from '@web/shared/ui/primitives'
import { useDismissibleSessionNotice } from '@web/shared/hooks/use-dismissible-session-notice'
import { OverviewSection } from './sections/overview-section'
import { StudentsSection } from './sections/students-section'
import { FacultyMembersSection } from './sections/faculty-members-section'
import { EntityEditorModals } from './sections/entity-editor-modals'
import { ActionQueueRail } from './action-queue-rail'
import { createAuthHandlers } from './live-app/handlers/auth-handlers'
import { createReminderHandlers } from './live-app/handlers/reminder-handlers'
import { createCurriculumEditorHelpers } from './live-app/handlers/curriculum-editor-helpers'
import { createHierarchyHandlers } from './live-app/handlers/hierarchy-handlers'
import { createCurriculumCrudHandlers } from './live-app/handlers/curriculum-crud-handlers'
import { createCurriculumFeatureHandlers } from './live-app/handlers/curriculum-feature-handlers'
import { createScopePolicyHandlers } from './live-app/handlers/scope-policy-handlers'
import { createProvisioningHandlers } from './live-app/handlers/provisioning-handlers'
import { createProofHandlers } from './live-app/handlers/proof-handlers'
import { createRequestHandlers } from './live-app/handlers/request-handlers'
import { createStudentHandlers } from './live-app/handlers/student-handlers'
import { createFacultyProfileHandlers } from './live-app/handlers/faculty-profile-handlers'
import { createFacultyOwnershipHandlers } from './live-app/handlers/faculty-ownership-handlers'
import { createRegistryNavigationHandlers } from './live-app/handlers/registry-navigation-handlers'
import { createRailNavigationHandlers } from './live-app/handlers/rail-navigation-handlers'

type SystemAdminLiveAppProps = {
  apiBaseUrl: string
  onExitPortal?: () => void
}

const EMPTY_FACULTY_RECORDS: ApiFacultyRecord[] = []


// Re-exports for backward compatibility — model + chrome extracted to src/admin/
// eslint-disable-next-line react-refresh/only-export-components
export * from './live-app-model'
// eslint-disable-next-line react-refresh/only-export-components
export * from './live-app-chrome'

import {
  EMPTY_DATA,
  WEEKDAYS,
  ADMIN_SECTION_TONES,
  DEFAULT_PROGRESSION_RULES,
  ADMIN_DISMISSED_QUEUE_STORAGE_KEY,
  ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT,
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
  formatRecordProofBanner,
  shouldShowProofCheckpointCgpa,
  shouldOverlayProofCheckpointStudentSummary,
  resolveFacultyCredentialStatus,
  parseAdminRoute,
  routeToHash,
  defaultPolicyForm,
  defaultEntityEditorState,
  defaultStudentForm,
  defaultCurriculumFeatureForm,
  hydrateCurriculumFeatureForm,
  defaultStagePolicyForm,
  hydrateStagePolicyForm,
  defaultBatchProvisioningForm,
  mergePolicyPayload,
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  defaultFacultyForm,
  toRegistrySearchScope,
  normalizeHierarchyScope,
  buildAdminActiveScopeChain,
  defaultAppointmentForm,
  defaultRoleGrantForm,
  defaultOwnershipForm,
  hydratePolicyForm,
  toErrorMessage,
  buildValidatedPolicyPayload,
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
  shouldHydrateHierarchyEditor,
} from './live-app-model'
import {
  TeachingShellAdminTopBar,
  OperationsRail,
} from './live-app-chrome'
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

  const handleResetFacultiesWorkspaceRestore = useCallback(() => {
    if (typeof window !== 'undefined' && route.section === 'faculties') {
      window.sessionStorage.removeItem(`airmentor-admin-ui:${routeToHash(route)}`)
    }
    setSelectedSectionCode(null)
    setUniversityTab('overview')
    setFacultiesRestoreNotice(null)
  }, [route, setFacultiesRestoreNotice])
  // --- Breadcrumbs ---
  // --- Extracted action handlers (see ./live-app/handlers/*) ---
  const { handleLogin, handleLogout, handleSwitchToSystemAdmin } = createAuthHandlers({
    apiClient,
    identifier,
    password,
    session,
    systemAdminGrant,
    settleCookieBackedSession,
    clearRegistryScope,
    onExitPortal,
    setAuthBusy,
    setAuthError,
    setSession,
    setIdentifier,
    setPassword,
    setDismissedQueueItemKeys,
    setData,
    setStagePolicyOverrides,
    setDataError,
  })
  const { handleCreateReminder, handleToggleReminderStatus } = createReminderHandlers({
    apiClient,
    remindersSupported,
    runAction,
    setActionError,
    setFlashMessage,
  })
  const { startEditingTerm, resetTermEditor, startEditingCurriculumCourse, resetCurriculumEditor } = createCurriculumEditorHelpers({
    data,
    authoritativeOperationalSemester,
    selectedCurriculumSemester,
    setEntityEditors,
    setSelectedCurriculumSemester,
    setSelectedCurriculumCourseId,
  })
  const {
    handleUpdateAcademicFaculty,
    handleArchiveAcademicFaculty,
    handleDeleteAcademicFaculty,
    handleRestoreAcademicFaculty,
    handleUpdateDepartment,
    handleArchiveDepartment,
    handleUpdateBranch,
    handleArchiveBranch,
    handleUpdateBatch,
    handleArchiveBatch,
    handleCreateAcademicFaculty,
    handleCreateDepartment,
    handleCreateBranch,
    handleCreateBatch,
  } = createHierarchyHandlers({
    apiClient,
    runAction,
    navigate,
    selectedAcademicFaculty,
    selectedDepartment,
    selectedBranch,
    selectedBatch,
    data,
    entityEditors,
    structureForms,
    departmentBranches,
    branchBatches,
    batchTerms,
    setData,
    setFlashMessage,
    setEditingEntity,
    setStructureForms,
    setActionError,
  })
  const {
    handleSaveTerm,
    handleArchiveTerm,
    handleSaveCurriculumCourse,
    handleBootstrapCurriculumManifest,
    handleRegenerateCurriculumLinkageCandidates,
    handleApproveCurriculumLinkageCandidate,
    handleRejectCurriculumLinkageCandidate,
    handleArchiveCurriculumCourse,
  } = createCurriculumCrudHandlers({
    apiClient,
    runAction,
    loadAdminData,
    selectedBranch,
    selectedBatch,
    data,
    entityEditors,
    curriculumLinkageReviewNote,
    selectedCurriculumFeatureItem,
    resetTermEditor,
    resetCurriculumEditor,
    refreshCurriculumFeatureConfig,
    refreshCurriculumLinkageCandidates,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    setFlashMessage,
    setCurriculumLinkageGenerationStatus,
    setCurriculumLinkageReviewNote,
    setCurriculumProofRefreshRetry,
  })
  const {
    handleSaveCurriculumFeatureConfig,
    handleLoadCurriculumFeatureHistory,
    handlePreviewCurriculumFeatureConfig,
    handleSaveCurriculumFeatureBinding,
  } = createCurriculumFeatureHandlers({
    apiClient,
    runAction,
    selectedBatch,
    selectedCurriculumFeatureItem,
    curriculumFeatureForm,
    curriculumFeatureItems,
    curriculumFeatureTargetScopeKey,
    curriculumFeatureTargetMode,
    curriculumFeatureBindingMode,
    curriculumFeaturePinnedProfileId,
    curriculumFeatureConfig,
    refreshCurriculumFeatureConfig,
    refreshCurriculumLinkageCandidates,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    setCurriculumFeatureForm,
    setCurriculumFeatureHistory,
    setCurriculumFeaturePreview,
    setCurriculumProofRefreshRetry,
    setFlashMessage,
  })
  const {
    handleSaveScopePolicy,
    handleResetScopePolicy,
    handleSaveScopeStagePolicy,
    handleResetScopeStagePolicy,
    handleAdvanceOfferingStage,
  } = createScopePolicyHandlers({
    apiClient,
    runAction,
    loadAdminData,
    activeGovernanceScope,
    activeScopeChain,
    activeScopePolicyOverride,
    activeScopeStageOverride,
    policyForm,
    stagePolicyForm,
    preferredGovernanceBatchId,
    selectedSectionCode,
    activeGovernanceProofRefreshBatchIds,
    resolvedBatchPolicy,
    resolvedStagePolicy,
    selectedStageOffering,
    queueProofRefreshBatches,
    setResolvedBatchPolicy,
    setResolvedStagePolicy,
    setPolicyForm,
    setStagePolicyForm,
    setSelectedStageEligibility,
    setFlashMessage,
  })
  const {
    handleProvisionBatch,
    handleProvisionSeededDemoWorkspace,
    handlePreviewBulkMentorAssignment,
    handleApplyBulkMentorAssignment,
  } = createProvisioningHandlers({
    apiClient,
    runAction,
    loadAdminData,
    selectedBatch,
    route,
    session,
    selectedSectionCode,
    batchProvisioningForm,
    bulkMentorAssignmentForm,
    bulkMentorAssignmentPreview,
    refreshCurriculumFeatureConfig,
    refreshProofDashboard,
    getQueuedProofRefreshCount,
    clearRegistryScope,
    setBulkMentorAssignmentPreview,
    setSession,
    setData,
    setStagePolicyOverrides,
    setDismissedQueueItemKeys,
    setDataError,
    setPassword,
    setFlashMessage,
    setActionError,
  })
  const {
    handleCreateProofImport,
    handleValidateLatestProofImport,
    handleReviewPendingCrosswalks,
    handleApproveLatestProofImport,
    handleCreateProofRun,
    handleCreateProofSimulation,
    handleRetryProofRun,
    handleActivateProofRun,
    handleActivateProofSemester,
    handleAdvanceProofRun,
    handleStopProofRun,
    handleArchiveProofRun,
    handleRecomputeProofRunRisk,
    handleRestoreProofSnapshot,
    handleResetProofRunFromScratch,
  } = createProofHandlers({
    apiClient,
    runAction,
    proofControlBatchId,
    proofDashboard,
    queueSelectedProofRefresh,
    refreshCurriculumFeatureConfig,
    refreshProofDashboard,
    setData,
    setFlashMessage,
    setSelectedProofCheckpointSource,
    setProofPlaybackRestoreNotice,
    setSelectedProofCheckpointDetail,
    setSelectedProofCheckpointId,
  })
  const { handleAdvanceRequest, handleRequestInfoRequest, handleRejectRequest } = createRequestHandlers({
    apiClient,
    refreshRequestWorkspaceState,
    setRequestBusy,
    setFlashMessage,
    setActionError,
  })
  const {
    resetStudentEditors,
    startEditingEnrollment,
    startEditingMentorAssignment,
    handleSaveStudent,
    handleArchiveStudent,
    handleSaveEnrollment,
    handleCloseEnrollment,
    handleSaveMentorAssignment,
    handleEndMentorAssignment,
    handlePromoteStudent,
  } = createStudentHandlers({
    apiClient,
    runAction,
    navigate,
    mergeStudentRecord,
    queueSelectedProofRefresh,
    selectedStudent,
    data,
    studentForm,
    enrollmentForm,
    mentorForm,
    setStudentForm,
    setEnrollmentForm,
    setMentorForm,
    setEditingEntity,
    setActionError,
    setFlashMessage,
  })
  const {
    resetFacultyEditors,
    startEditingAppointment,
    startEditingRoleGrant,
    handleSaveFaculty,
    handleIssueFacultyPasswordSetup,
    handleArchiveFaculty,
    handleSaveAppointment,
    handleArchiveAppointment,
  } = createFacultyProfileHandlers({
    apiClient,
    runAction,
    navigate,
    selectedFacultyMember,
    facultyForm,
    appointmentForm,
    setFacultyForm,
    setFacultyPasswordSetupResult,
    setAppointmentForm,
    setRoleGrantForm,
    setOwnershipForm,
    setEditingEntity,
    setFlashMessage,
  })
  const {
    handleSaveRoleGrant,
    handleArchiveRoleGrant,
    handleSaveOwnership,
    handleArchiveOwnership,
    handleAssignCurriculumCourseLeader,
    handleSaveFacultyCalendar,
  } = createFacultyOwnershipHandlers({
    apiClient,
    runAction,
    loadAdminData,
    operatorData,
    selectedFacultyMember,
    selectedBatch,
    selectedBranch,
    selectedSectionCode,
    roleGrantForm,
    ownershipForm,
    setOwnershipForm,
    setActionError,
    setFlashMessage,
    setFacultyCalendar,
    setFacultyCalendarLoading,
  })
  const { handleOpenScopedRegistry, handleOpenFullRegistry, handleReturnToScopedUniversity } = createRegistryNavigationHandlers({
    activeUniversityRegistryScope,
    registryScope,
    setRegistryScope,
    setStudentRegistryFilter,
    setFacultyRegistryFilter,
    clearRegistryScope,
    navigate,
    updateUniversityTab,
    updateSelectedSectionCode,
  })
  const { handleRailSectionChange } = createRailNavigationHandlers({
    route,
    activeUniversityRegistryScope,
    registryScope,
    setRegistryScope,
    setStudentRegistryFilter,
    setFacultyRegistryFilter,
    clearRegistryScope,
    navigate,
  })

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
        {route.section === 'faculty-members' && (
          <FacultyMembersSection
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
      <ActionQueueRail
        isRendered={renderInlineActionQueue}
        isVisible={showInlineActionQueue}
        actionCount={actionQueueCount}
        remindersSupported={remindersSupported}
        visibleQueueDismissKeys={visibleQueueDismissKeys}
        dismissedQueueItemKeys={dismissedQueueItemKeys}
        openRequests={openRequests}
        pendingReminders={pendingReminders}
        visibleHiddenItems={visibleHiddenQueueItems}
        onHideAll={hideAllVisibleQueueItems}
        onRestoreAll={restoreAllHiddenQueueItems}
        onDismissItem={dismissQueueItem}
        onNavigate={navigate}
        onToggleReminderStatus={handleToggleReminderStatus}
        onRestoreHiddenItem={item => {
          void runAction(async () => {
            await item.onRestore()
            setFlashMessage(`${item.label} restored.`)
          })
        }}
        onCreateReminder={handleCreateReminder}
      />
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
