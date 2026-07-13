import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar, LayoutDashboard, ListTodo, Shield, Upload, Users,
} from 'lucide-react'
import { T,
  PAPER_MAP,
  type Offering, type Student,
  type Mentee, type StudentHistoryRecord,
} from '@web/simulation/fixtures'
import {
  type AcademicMeeting,
  createTransition,
  createCalendarAuditEvent,
  getNextScheduledDate,
  getRemedialProgress,
  isTaskActiveForQueue,
  normalizeDateISO,
  normalizeThemeMode,
  toDueLabel,
  toTodayISO,
  type CalendarAuditEvent,
  type EntryKind,
  type EntryLockMap,
  type FacultyAccount,
  type FacultyCapabilitySet,
  type FacultyTimetableTemplate,
  type LayoutMode,
  type QueueTransition,
  type RemedialPlan,
  type Role,
  type RiskBand,
  type SchemeState,
  type SharedTask,
  type StudentRuntimePatch,
  type TaskCalendarPlacement,
  type TaskType,
  type TermTestBlueprint,
  type ThemeMode,
  type TTKind,
  type Weekday,
} from '@kernel/shared/domain'
import {
  applyPlacementToTask,
  buildPlacementForRange,
  buildUntimedPlacement,
  classBlockOccursOnDate,
  clampRangeToDayBounds,
  getWeekdayForDateISO,
  minutesToDisplayLabel,
  normalizeTimedRange,
  reflowClassDayRanges,
} from '@web/shared/state/calendar-utils'
import {
  AppSelectorsContext,
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  getAssessmentComponentScore,
  getEntryLockMap,
  normalizeBlueprint,
  normalizeSchemeState,
  pruneScoreMap,
  seedBlueprintFromPaper,
  seedTermTestLeafScores,
  toStudentPatchKey,
  createAppSelectors,
  isPatchEmpty,
} from '@web/shared/state/selectors'
import { toCellKey } from '@web/shared/state/page-utils'
import { type AirMentorRepositories } from '@persistence/repositories/air-mentor-repositories'
import { clearPortalWorkspaceHints, navigateToPortal} from './portal-routing'
import {
  AcademicFacultyContextUnavailableState,
} from '@web/features/academic-session-shell'
import { AcademicWorkspaceSidebar } from '@web/features/academic-workspace-sidebar'
import { AcademicWorkspaceTopbar } from '@web/features/academic-workspace-topbar'
import { AcademicWorkspaceRouteSurface } from '@web/features/academic-workspace-route-surface'
import { canAccessPage, findStudentProfileLaunchTarget, getHomePage, getMenteeScopeIds, resolveAssignedMentees, resolveRoleSyncState } from '@web/features/academic-workspace-route-helpers'
import { materializeProofMonitoringTasks } from '@web/simulation/proof-monitoring-tasks'
import {
  coreMetricsFromFacultyQueueItem,
} from '@web/features/academic/student-checkpoint-parity'
import { applyThemePreset, isLightTheme } from '@web/shared/ui/theme'
import type {
  ApiAcademicBootstrap,
  ApiAcademicFacultyProfile,
  ApiAcademicHodProofBundle,
  ApiAcademicHodProofCounterfactualReport,
  ApiAcademicHodProofCounterfactualSimulatorReport,
  ApiProofReassessmentResolveResponse,
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
  ApiStudentRiskExplorer,
} from '@web/shared/api/types'
import { getAcademicApiBaseUrl } from './session-helpers'
import { RequiredNoteModal } from './required-note-modal'
import { TaskComposerModal } from './task-composer-modal'
import { StudentDrawer } from './student-drawer'
import { ActionQueue } from './action-queue'
import {
  buildHistoryProfile,
  getRouteSnapshotKey,
  suggestTaskForStudent,
} from './workspace-helpers'
import type {
  NoteActionState,
  PageId,
  RouteSnapshot,
  TaskComposerState,
  TaskCreateInput,
  TaskPlacementDraft,
} from './workspace-types'

const CLASS_SNAP_THRESHOLD_MINUTES = 14

/* ══════════════════════════════════════════════════════════════
   HOD VIEW — Teacher-centric with drill-down
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   CALENDAR PAGE
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   ROOT APP
   ══════════════════════════════════════════════════════════════ */

const CL_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar / Timetable' },
  { id: 'upload', icon: Upload, label: 'Data Entry Hub' },
]
const MENTOR_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'mentees', icon: Users, label: 'My Mentees' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar / Timetable' },
]
const HOD_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'department', icon: Shield, label: 'Department' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar / Timetable' },
]

type OperationalWorkspaceProps = {
  repositories: AirMentorRepositories
  liveAcademicMode: boolean
  initialTeacherId: string
  initialRole: Role
  onLogout: () => Promise<void> | void
  onRoleChange?: (role: Role) => Promise<void> | void
  loadFacultyProfile?: (facultyId: string) => Promise<ApiAcademicFacultyProfile>
  loadHodProofAnalytics?: () => Promise<ApiAcademicHodProofBundle>
  loadHodProofCounterfactual?: (input: { runIdBaseline: string; runIdRealized: string }) => Promise<ApiAcademicHodProofCounterfactualReport>
  loadHodProofCounterfactualSimulator?: (input: { runId: string }) => Promise<ApiAcademicHodProofCounterfactualSimulatorReport>
  loadStudentAgentCard?: (studentId: string) => Promise<ApiStudentAgentCard>
  loadStudentAgentTimeline?: (studentId: string) => Promise<{ items: ApiStudentAgentTimelineItem[] }>
  startStudentAgentSession?: (studentId: string) => Promise<ApiStudentAgentSession>
  sendStudentAgentMessage?: (sessionId: string, payload: { prompt: string }) => Promise<{ items: ApiStudentAgentMessage[] }>
  loadStudentRiskExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  onCommitDemoAttendanceEdit?: (offeringId: string, studentId: string, nextAttendancePct: number) => Promise<void>
  onRecomputeProofRunRisk?: (simulationRunId: string, options?: { refreshWorkspace?: boolean }) => Promise<void>
  onResolveProofReassessment?: (reassessmentEventId: string, options?: { refreshWorkspace?: boolean }) => Promise<ApiProofReassessmentResolveResponse>
  onAdvanceProofRun?: (simulationRunId: string, mode: 'day' | 'previous-day' | 'stage', options?: { refreshWorkspace?: boolean }) => Promise<void> | void
  onStopProofRun?: (simulationRunId: string) => Promise<void> | void
  onStepProofPlayback?: (direction: 'previous' | 'next' | 'start' | 'end') => Promise<void> | void
  academicBootstrap: ApiAcademicBootstrap
  proofPlaybackNotice?: { tone: 'neutral' | 'error'; message: string } | null
  onResetProofPlaybackSelection: () => Promise<void> | void
}

export function OperationalWorkspace({
  repositories,
  liveAcademicMode,
  initialTeacherId,
  initialRole,
  onLogout,
  onRoleChange,
  loadFacultyProfile,
  loadHodProofAnalytics,
  loadHodProofCounterfactual,
  loadHodProofCounterfactualSimulator,
  loadStudentAgentCard,
  loadStudentAgentTimeline,
  startStudentAgentSession,
  sendStudentAgentMessage,
  loadStudentRiskExplorer,
  onCommitDemoAttendanceEdit,
  onRecomputeProofRunRisk,
  onResolveProofReassessment,
  onAdvanceProofRun,
  onStopProofRun,
  onStepProofPlayback,
  academicBootstrap,
  proofPlaybackNotice,
  onResetProofPlaybackSelection,
}: OperationalWorkspaceProps) {
  const facultyAccounts = academicBootstrap.faculty
  const allOfferings = academicBootstrap.offerings
  const allYearGroups = academicBootstrap.yearGroups
  const allMentees = academicBootstrap.mentees
  const studentsByOffering = academicBootstrap.studentsByOffering
  const studentHistoryByUsn = academicBootstrap.studentHistoryByUsn
  const defaultOffering = allOfferings[0] ?? null
  // GAP-7: In proof playback mode, use the checkpoint's capture date as the due-label anchor.
  // Simulation tasks have academic-calendar dates that appear "past" relative to wall clock.
  const proofVirtualDateISO: string | undefined = (academicBootstrap as { proofPlayback?: { currentDateISO?: string } }).proofPlayback?.currentDateISO
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [isCompactTopbar, setIsCompactTopbar] = useState(() => window.innerWidth < 980)
  const [now, setNow] = useState(() => new Date())
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(initialTeacherId)
  const currentTeacher = useMemo<FacultyAccount | null>(() => currentTeacherId ? (facultyAccounts.find(faculty => faculty.facultyId === currentTeacherId) ?? null) : null, [currentTeacherId, facultyAccounts])
  const [role, setRole] = useState<Role>(initialRole)
  const [page, setPage] = useState<PageId>(() => getHomePage(initialRole))
  const [offering, setOffering] = useState<Offering | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null)
  const [selectedMentee, setSelectedMentee] = useState<Mentee | null>(null)
  const [historyProfile, setHistoryProfile] = useState<StudentHistoryRecord | null>(null)
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null)
  const [studentShellStudentId, setStudentShellStudentId] = useState<string | null>(null)
  const [historyBackPage, setHistoryBackPage] = useState<PageId | null>(null)
  const [selectedUnlockTaskId, setSelectedUnlockTaskId] = useState<string | null>(null)
  const [schemeOfferingId, setSchemeOfferingId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1100)
  const [showActionQueue, setShowActionQueue] = useState(() => window.innerWidth >= 1100)
  const actionQueueRef = useRef<HTMLDivElement | null>(null)
  const [uploadOffering, setUploadOffering] = useState<Offering | null>(null)
  const [uploadKind, setUploadKind] = useState<EntryKind>('tt1')
  const [entryOfferingId, setEntryOfferingId] = useState<string>(defaultOffering?.offId ?? '')
  const [entryKind, setEntryKind] = useState<EntryKind>('tt1')
  const [courseInitialTab, setCourseInitialTab] = useState<string | undefined>(undefined)
  const [routeHistory, setRouteHistory] = useState<RouteSnapshot[]>([])
  const previousRouteRef = useRef<RouteSnapshot | null>(null)
  const restoringRouteRef = useRef(false)
  const [taskComposer, setTaskComposer] = useState<TaskComposerState>({ isOpen: false, step: 'details', taskType: 'Follow-up', dueDateISO: '', note: '', search: '' })
  const [pendingNoteAction, setPendingNoteAction] = useState<NoteActionState | null>(null)
  const [facultyProfile, setFacultyProfile] = useState<ApiAcademicFacultyProfile | null>(null)
  const [facultyProfileLoading, setFacultyProfileLoading] = useState(false)
  const [facultyProfileError, setFacultyProfileError] = useState('')
  const [hodProofAnalytics, setHodProofAnalytics] = useState<ApiAcademicHodProofBundle | null>(null)
  const [hodProofLoading, setHodProofLoading] = useState(false)
  const [hodProofError, setHodProofError] = useState('')
  const [roleChangeBusy, setRoleChangeBusy] = useState(false)
  const [roleChangeError, setRoleChangeError] = useState('')

  const [riskReevaluationPulse, setRiskReevaluationPulse] = useState(false)
  const riskReevaluationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markRiskReevaluationPending = useCallback((durationMs = 1800) => {
    setRiskReevaluationPulse(true)
    if (riskReevaluationTimeoutRef.current) clearTimeout(riskReevaluationTimeoutRef.current)
    riskReevaluationTimeoutRef.current = setTimeout(() => {
      setRiskReevaluationPulse(false)
      riskReevaluationTimeoutRef.current = null
    }, durationMs)
  }, [])
  useEffect(() => () => {
    if (riskReevaluationTimeoutRef.current) clearTimeout(riskReevaluationTimeoutRef.current)
  }, [])
  const isReevaluatingRisk = riskReevaluationPulse || facultyProfileLoading || hodProofLoading || roleChangeBusy
  const [studentPatches, setStudentPatches] = useState<Record<string, StudentRuntimePatch>>(() => repositories.entryData.getStudentPatchesSnapshot())
  const [schemeByOffering, setSchemeByOffering] = useState<Record<string, SchemeState>>(() => repositories.entryData.getSchemeStateSnapshot(allOfferings))
  const [ttBlueprintsByOffering, setTtBlueprintsByOffering] = useState<Record<string, Record<TTKind, TermTestBlueprint>>>(() => repositories.entryData.getBlueprintSnapshot(allOfferings))
  const [lockAuditByTarget, setLockAuditByTarget] = useState<Record<string, QueueTransition[]>>(() => repositories.locksAudit.getLockAuditSnapshot())
  const selectors = useMemo(() => createAppSelectors({
    studentPatches,
    schemeByOffering,
    ttBlueprintsByOffering,
    studentsByOffering,
    studentSourceMode: 'live',
  }), [schemeByOffering, studentPatches, studentsByOffering, ttBlueprintsByOffering])
  const { getStudentsPatched } = selectors

  const allowedRoles = useMemo(() => (currentTeacher?.allowedRoles ?? []).filter(candidate => String(candidate) !== 'SYSTEM_ADMIN'), [currentTeacher])
  useEffect(() => {
    setCurrentTeacherId(initialTeacherId)
  }, [initialTeacherId])
  useEffect(() => {
    if (!currentTeacher?.facultyId || !loadFacultyProfile) {
      setFacultyProfile(null)
      setFacultyProfileError('')
      setFacultyProfileLoading(false)
      return
    }

    let cancelled = false
    setFacultyProfileLoading(true)
    setFacultyProfileError('')
    void loadFacultyProfile(currentTeacher.facultyId)
      .then(profile => {
        if (!cancelled) setFacultyProfile(profile)
      })
      .catch(error => {
        if (!cancelled) {
          setFacultyProfile(null)
          setFacultyProfileError(error instanceof Error ? error.message : 'Could not load the faculty profile.')
        }
      })
      .finally(() => {
        if (!cancelled) setFacultyProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentTeacher?.facultyId, loadFacultyProfile, page])
  useEffect(() => {
    if (role !== 'HoD' || !currentTeacher?.facultyId || !loadHodProofAnalytics) {
      setHodProofAnalytics(null)
      setHodProofError('')
      setHodProofLoading(false)
      return
    }

    let cancelled = false
    setHodProofLoading(true)
    setHodProofError('')
    void loadHodProofAnalytics()
      .then(bundle => {
        if (!cancelled) setHodProofAnalytics(bundle)
      })
      .catch(error => {
        if (!cancelled) {
          setHodProofAnalytics(null)
          setHodProofError(error instanceof Error ? error.message : 'Could not load HoD proof analytics.')
        }
      })
      .finally(() => {
        if (!cancelled) setHodProofLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentTeacher?.facultyId, loadHodProofAnalytics, role])
  useEffect(() => {
    const nextState = resolveRoleSyncState({
      allowedRoles,
      initialRole,
      role,
      page,
    })
    if (!nextState) return
    if (nextState.role !== role) setRole(nextState.role)
    if (nextState.page !== page) setPage(nextState.page as PageId)
  }, [allowedRoles, initialRole, page, role])
  const capabilities = useMemo<FacultyCapabilitySet>(() => ({
    canApproveUnlock: role === 'HoD',
    canEditMarks: role === 'Course Leader',
  }), [role])
  const profileOwnedOfferingIds = useMemo(() => new Set(facultyProfile?.currentOwnedClasses.map(item => item.offeringId) ?? []), [facultyProfile])
  const assignedOfferings = useMemo(() => {
    if (!currentTeacher) return []
    if (role === 'HoD') return allOfferings
    if (facultyProfileLoading) return []
    if (facultyProfile) {
      return profileOwnedOfferingIds.size > 0 ? allOfferings.filter(item => profileOwnedOfferingIds.has(item.offId)) : []
    }
    if (liveAcademicMode) return []
    const ownedOfferingIds = new Set(currentTeacher.offeringIds ?? [])
    return ownedOfferingIds.size > 0 ? allOfferings.filter(item => ownedOfferingIds.has(item.offId)) : []
  }, [allOfferings, currentTeacher, facultyProfile, facultyProfileLoading, liveAcademicMode, profileOwnedOfferingIds, role])
  const assignedMentees = useMemo(() => {
    if (liveAcademicMode && !facultyProfile) return []
    return resolveAssignedMentees(allMentees, currentTeacher, facultyProfile)
  }, [allMentees, currentTeacher, facultyProfile, liveAcademicMode])

  const [lockByOffering, setLockByOffering] = useState<Record<string, EntryLockMap>>(() => repositories.locksAudit.getLockSnapshot(allOfferings))
  const [draftBySection, setDraftBySection] = useState<Record<string, number>>(() => repositories.entryData.getDraftSnapshot())
  const [cellValues, setCellValues] = useState<Record<string, number>>(() => repositories.entryData.getCellValueSnapshot())
  const [allTasksList, setAllTasksList] = useState<SharedTask[]>(() => repositories.tasks.getTasksSnapshot(() => []))
  const [resolvedTasks, setResolvedTasks] = useState<Record<string, number>>(() => repositories.tasks.getResolvedTasksSnapshot({}))
  const [timetableByFacultyId, setTimetableByFacultyId] = useState<Record<string, FacultyTimetableTemplate>>(() => repositories.calendar.getTimetableTemplatesSnapshot(facultyAccounts, allOfferings))
  const [taskPlacements, setTaskPlacements] = useState<Record<string, TaskCalendarPlacement>>(() => repositories.calendar.getTaskPlacementsSnapshot())
  const [calendarAuditEvents, setCalendarAuditEvents] = useState<CalendarAuditEvent[]>(() => repositories.calendar.getCalendarAuditSnapshot())
  const [academicMeetings, setAcademicMeetings] = useState<AcademicMeeting[]>(() => repositories.calendar.getMeetingsSnapshot())
  const hydratedLockSnapshotRef = useRef(JSON.stringify(lockByOffering))
  const hydratedDraftSnapshotRef = useRef(JSON.stringify(draftBySection))
  const hydratedCellValueSnapshotRef = useRef(JSON.stringify(cellValues))
  const hydratedLockAuditSnapshotRef = useRef(JSON.stringify(lockAuditByTarget))
  const hydratedTimetableSnapshotRef = useRef(JSON.stringify(timetableByFacultyId))
  const hydratedBlueprintSnapshotRef = useRef(JSON.stringify(ttBlueprintsByOffering))
  const hydratedTaskSnapshotRef = useRef(JSON.stringify(allTasksList))

  useEffect(() => {
    const nextStudentPatches = repositories.entryData.getStudentPatchesSnapshot()
    const nextSchemeByOffering = repositories.entryData.getSchemeStateSnapshot(allOfferings)
    const nextTtBlueprintsByOffering = repositories.entryData.getBlueprintSnapshot(allOfferings)
    const nextLockAuditByTarget = repositories.locksAudit.getLockAuditSnapshot()
    const nextLockByOffering = repositories.locksAudit.getLockSnapshot(allOfferings)
    const nextDraftBySection = repositories.entryData.getDraftSnapshot()
    const nextCellValues = repositories.entryData.getCellValueSnapshot()
    const nextAllTasksList = repositories.tasks.getTasksSnapshot(() => [])
    const nextResolvedTasks = repositories.tasks.getResolvedTasksSnapshot({})
    const nextTimetableByFacultyId = repositories.calendar.getTimetableTemplatesSnapshot(facultyAccounts, allOfferings)
    const nextTaskPlacements = repositories.calendar.getTaskPlacementsSnapshot()
    const nextCalendarAuditEvents = repositories.calendar.getCalendarAuditSnapshot()
    const nextAcademicMeetings = repositories.calendar.getMeetingsSnapshot()

    hydratedLockSnapshotRef.current = JSON.stringify(nextLockByOffering)
    hydratedDraftSnapshotRef.current = JSON.stringify(nextDraftBySection)
    hydratedCellValueSnapshotRef.current = JSON.stringify(nextCellValues)
    hydratedLockAuditSnapshotRef.current = JSON.stringify(nextLockAuditByTarget)
    hydratedTimetableSnapshotRef.current = JSON.stringify(nextTimetableByFacultyId)
    hydratedBlueprintSnapshotRef.current = JSON.stringify(nextTtBlueprintsByOffering)
    hydratedTaskSnapshotRef.current = JSON.stringify(nextAllTasksList)

    setStudentPatches(nextStudentPatches)
    setSchemeByOffering(nextSchemeByOffering)
    setTtBlueprintsByOffering(nextTtBlueprintsByOffering)
    setLockAuditByTarget(nextLockAuditByTarget)
    setLockByOffering(nextLockByOffering)
    setDraftBySection(nextDraftBySection)
    setCellValues(nextCellValues)
    setAllTasksList(nextAllTasksList)
    setResolvedTasks(nextResolvedTasks)
    setTimetableByFacultyId(nextTimetableByFacultyId)
    setTaskPlacements(nextTaskPlacements)
    setCalendarAuditEvents(nextCalendarAuditEvents)
    setAcademicMeetings(nextAcademicMeetings)
  }, [allOfferings, facultyAccounts, repositories])

  useEffect(() => {
    const serialized = JSON.stringify(lockByOffering)
    if (serialized === hydratedLockSnapshotRef.current) return
    const previousSnapshot = hydratedLockSnapshotRef.current
    hydratedLockSnapshotRef.current = serialized
    void repositories.locksAudit.saveLocks(lockByOffering).catch(error => {
      hydratedLockSnapshotRef.current = previousSnapshot
      setLockByOffering(JSON.parse(previousSnapshot))
      console.error('Could not persist lock state.', error)
    })
  }, [lockByOffering, repositories])
  useEffect(() => {
    const serialized = JSON.stringify(draftBySection)
    if (serialized === hydratedDraftSnapshotRef.current) return
    const previousSnapshot = hydratedDraftSnapshotRef.current
    hydratedDraftSnapshotRef.current = serialized
    void repositories.entryData.saveDrafts(draftBySection).catch(error => {
      hydratedDraftSnapshotRef.current = previousSnapshot
      setDraftBySection(JSON.parse(previousSnapshot))
      console.error('Could not persist draft state.', error)
    })
  }, [draftBySection, repositories])
  useEffect(() => {
    const serialized = JSON.stringify(cellValues)
    if (serialized === hydratedCellValueSnapshotRef.current) return
    const previousSnapshot = hydratedCellValueSnapshotRef.current
    hydratedCellValueSnapshotRef.current = serialized
    void repositories.entryData.saveCellValues(cellValues).catch(error => {
      hydratedCellValueSnapshotRef.current = previousSnapshot
      setCellValues(JSON.parse(previousSnapshot))
      console.error('Could not persist cell values.', error)
    })
  }, [cellValues, repositories])
  useEffect(() => {
    const serialized = JSON.stringify(allTasksList)
    if (serialized === hydratedTaskSnapshotRef.current) return
    const previousSnapshot = hydratedTaskSnapshotRef.current
    hydratedTaskSnapshotRef.current = serialized
    void repositories.tasks.saveTasks(allTasksList).catch(error => {
      if (hydratedTaskSnapshotRef.current !== serialized) {
        console.error('Could not persist stale task queue state.', error)
        return
      }
      hydratedTaskSnapshotRef.current = previousSnapshot
      setAllTasksList(JSON.parse(previousSnapshot))
      console.error('Could not persist task queue state.', error)
    })
  }, [allTasksList, repositories])
  useEffect(() => { void repositories.tasks.saveResolvedTasks(resolvedTasks) }, [repositories, resolvedTasks])
  useEffect(() => {
    if (page !== 'calendar') return
    const serialized = JSON.stringify(timetableByFacultyId)
    if (serialized === hydratedTimetableSnapshotRef.current) return
    const previousSnapshot = hydratedTimetableSnapshotRef.current
    hydratedTimetableSnapshotRef.current = serialized
    void repositories.calendar.saveTimetableTemplates(timetableByFacultyId).catch(error => {
      hydratedTimetableSnapshotRef.current = previousSnapshot
      setTimetableByFacultyId(JSON.parse(previousSnapshot))
      console.error('Could not persist timetable templates.', error)
    })
  }, [page, repositories, timetableByFacultyId])
  useEffect(() => { void repositories.calendar.saveTaskPlacements(taskPlacements) }, [repositories, taskPlacements])
  useEffect(() => { void repositories.calendar.saveCalendarAudit(calendarAuditEvents) }, [calendarAuditEvents, repositories])
  useEffect(() => { void repositories.entryData.saveStudentPatches(studentPatches) }, [repositories, studentPatches])
  useEffect(() => {
    if (role !== 'Course Leader' || (page !== 'course' && page !== 'scheme-setup' && page !== 'entry-workspace')) return
    void repositories.entryData.saveSchemeState(schemeByOffering).catch(error => {
      console.error('Could not persist scheme state.', error)
    })
  }, [page, repositories, role, schemeByOffering])
  useEffect(() => {
    if (role !== 'Course Leader' || (page !== 'course' && page !== 'scheme-setup' && page !== 'entry-workspace')) return
    const serialized = JSON.stringify(ttBlueprintsByOffering)
    if (serialized === hydratedBlueprintSnapshotRef.current) return
    const hasInvalidBlueprint = Object.values(ttBlueprintsByOffering).some(kinds =>
      (['tt1', 'tt2'] as const).some(kind => kinds[kind]?.totalMarks !== 25),
    )
    if (hasInvalidBlueprint) return
    const previousSnapshot = hydratedBlueprintSnapshotRef.current
    hydratedBlueprintSnapshotRef.current = serialized
    void repositories.entryData.saveBlueprintState(ttBlueprintsByOffering).catch(error => {
      hydratedBlueprintSnapshotRef.current = previousSnapshot
      setTtBlueprintsByOffering(JSON.parse(previousSnapshot))
      console.error('Could not persist question-paper blueprints.', error)
    })
  }, [page, repositories, role, ttBlueprintsByOffering])
  useEffect(() => {
    const serialized = JSON.stringify(lockAuditByTarget)
    if (serialized === hydratedLockAuditSnapshotRef.current) return
    const previousSnapshot = hydratedLockAuditSnapshotRef.current
    hydratedLockAuditSnapshotRef.current = serialized
    void repositories.locksAudit.saveLockAudit(lockAuditByTarget).catch(error => {
      hydratedLockAuditSnapshotRef.current = previousSnapshot
      setLockAuditByTarget(JSON.parse(previousSnapshot))
      console.error('Could not persist lock audit.', error)
    })
  }, [lockAuditByTarget, repositories])

  const supervisedOfferingIds = useMemo(() => new Set(assignedOfferings.map(o => o.offId)), [assignedOfferings])
  const supervisedMenteeIds = useMemo(() => new Set(assignedMentees.flatMap(m => getMenteeScopeIds(m.id))), [assignedMentees])
  const supervisedMenteeUsns = useMemo(() => new Set(assignedMentees.map(m => m.usn)), [assignedMentees])
  const calendarOfferingIds = useMemo(() => new Set(assignedOfferings.map(item => item.offId)), [assignedOfferings])
  const calendarMenteeIds = useMemo(() => new Set(assignedMentees.flatMap(mentee => getMenteeScopeIds(mentee.id))), [assignedMentees])
  const calendarMenteeUsns = useMemo(() => new Set(assignedMentees.map(mentee => mentee.usn)), [assignedMentees])
  const calendarOfferings = useMemo(() => allOfferings.filter(item => calendarOfferingIds.has(item.offId)), [allOfferings, calendarOfferingIds])
  const currentFacultyTimetable = useMemo(() => {
    if (!currentTeacher) return null
    return facultyProfile?.timetableTemplate ?? timetableByFacultyId[currentTeacher.facultyId] ?? null
  }, [currentTeacher, facultyProfile, timetableByFacultyId])
  const filteredCurrentFacultyTimetable = useMemo(() => {
    if (!currentFacultyTimetable) return null
    if (role === 'HoD') return currentFacultyTimetable
    return {
      ...currentFacultyTimetable,
      classBlocks: currentFacultyTimetable.classBlocks.filter(block => calendarOfferingIds.has(block.offeringId)),
    }
  }, [calendarOfferingIds, currentFacultyTimetable, role])
  const currentFacultyCalendarMarkers = useMemo(
    () => currentTeacher
      ? (facultyProfile?.calendarWorkspace?.markers ?? academicBootstrap?.runtime.adminCalendarByFacultyId?.[currentTeacher.facultyId]?.markers ?? [])
      : [],
    [academicBootstrap, currentTeacher, facultyProfile],
  )
  const mergedCalendarTasks = useMemo(() => {
    if (!currentTeacher) return [] as SharedTask[]
    return allTasksList.filter(task => {
      if (!currentTeacher.allowedRoles.includes(task.assignedTo)) return false
      if (task.assignedTo === 'Course Leader') return calendarOfferingIds.has(task.offeringId)
      if (task.assignedTo === 'Mentor') return calendarMenteeIds.has(task.studentId) || calendarMenteeUsns.has(task.studentUsn) || calendarOfferingIds.has(task.offeringId)
      return calendarOfferingIds.has(task.offeringId)
    })
  }, [allTasksList, calendarMenteeIds, calendarMenteeUsns, calendarOfferingIds, currentTeacher])
  const calendarMeetings = useMemo(() => {
    if (!currentTeacher) return [] as AcademicMeeting[]
    if (role === 'HoD') return academicMeetings
    return academicMeetings.filter(meeting => {
      if (meeting.facultyId === currentTeacher.facultyId) return true
      if (meeting.offeringId && calendarOfferingIds.has(meeting.offeringId)) return true
      return calendarMenteeUsns.has(meeting.studentUsn)
    })
  }, [academicMeetings, calendarMenteeUsns, calendarOfferingIds, currentTeacher, role])

  const getFallbackBlueprintSet = useCallback((offeringId: string) => {
    const backendBlueprints = academicBootstrap?.questionPapersByOffering?.[offeringId]
    if (backendBlueprints?.tt1 && backendBlueprints?.tt2) {
      return {
        tt1: normalizeBlueprint('tt1', backendBlueprints.tt1),
        tt2: normalizeBlueprint('tt2', backendBlueprints.tt2),
      }
    }
    if (liveAcademicMode) {
      return {
        tt1: { kind: 'tt1' as const, totalMarks: 0, updatedAt: 0, nodes: [] },
        tt2: { kind: 'tt2' as const, totalMarks: 0, updatedAt: 0, nodes: [] },
      }
    }
    const sourceOffering = allOfferings.find(item => item.offId === offeringId) ?? defaultOffering
    const basePaper = PAPER_MAP[sourceOffering?.code ?? defaultOffering?.code ?? 'default'] || PAPER_MAP.default
    return {
      tt1: seedBlueprintFromPaper('tt1', basePaper),
      tt2: seedBlueprintFromPaper('tt2', basePaper),
    }
  }, [academicBootstrap, allOfferings, defaultOffering, liveAcademicMode])

  const roleTasks = useMemo<SharedTask[]>(() => {
    const base = allTasksList.filter(t => t.assignedTo === role)
    const suppressedProofTaskIds = new Set([
      ...allTasksList.map(task => task.id),
      ...Object.keys(resolvedTasks).filter(taskId => taskId.startsWith('proof-monitoring-')),
    ])
    const activeProofQueueTasks = materializeProofMonitoringTasks({
      queue: facultyProfile?.proofOperations.monitoringQueue ?? [],
      role,
      proofVirtualDateISO,
      semesterNumber: academicBootstrap?.proofPlayback?.semesterNumber,
      stageKey: academicBootstrap?.proofPlayback?.stageKey,
      suppressedTaskIds: suppressedProofTaskIds,
    })
    if (role === 'HoD') return [...base, ...activeProofQueueTasks]
    if (role === 'Course Leader') return [...base.filter(t => supervisedOfferingIds.has(t.offeringId)), ...activeProofQueueTasks.filter(t => supervisedOfferingIds.has(t.offeringId))]
    const mentorScopedIds = supervisedMenteeIds
    return [
      ...base.filter(t => mentorScopedIds.has(t.studentId) || supervisedMenteeUsns.has(t.studentUsn)),
      ...activeProofQueueTasks.filter(t => mentorScopedIds.has(t.studentId) || supervisedMenteeUsns.has(t.studentUsn)),
    ]
  }, [academicBootstrap?.proofPlayback?.semesterNumber, academicBootstrap?.proofPlayback?.stageKey, allTasksList, facultyProfile?.proofOperations.monitoringQueue, proofVirtualDateISO, resolvedTasks, role, supervisedOfferingIds, supervisedMenteeIds, supervisedMenteeUsns])

  // Pending action badge count must use the proof-playback simulated date
  // (§B.14 + audit §5.2). Without this, tasks scheduled for simulated-future
  // but wall-clock-past show up too early, or vice versa.
  const pendingActionCount = roleTasks.filter(task => isTaskActiveForQueue(task, resolvedTasks, proofVirtualDateISO ?? toTodayISO())).length
  const layoutMode: LayoutMode = !sidebarCollapsed && showActionQueue
    ? 'three-column'
    : (!sidebarCollapsed || showActionQueue ? 'split' : 'focus')
  
  const navItems = role === 'Course Leader' ? CL_NAV : role === 'Mentor' ? MENTOR_NAV : HOD_NAV
  const hasEntryStartedForOffering = useCallback((offId: string) => {
    const locks = lockByOffering[offId]
    const hasAnyLock = locks ? Object.values(locks).some(Boolean) : false
    return hasAnyLock
  }, [lockByOffering])
  const taskComposerOfferings = useMemo(() => {
    if (taskComposer.availableOfferingIds && taskComposer.availableOfferingIds.length > 0) {
      return allOfferings.filter(item => taskComposer.availableOfferingIds?.includes(item.offId))
    }
    return role === 'HoD' ? allOfferings : assignedOfferings
  }, [allOfferings, assignedOfferings, role, taskComposer.availableOfferingIds])
  const selectedSchemeOffering = schemeOfferingId ? (allOfferings.find(item => item.offId === schemeOfferingId) ?? null) : null
  const selectedUnlockTask = selectedUnlockTaskId ? (allTasksList.find(task => task.id === selectedUnlockTaskId) ?? null) : null
  const facultyGivenName = useMemo(() => {
    const rawName = currentTeacher?.name ?? ''
    const normalized = rawName.replace(/^dr\.?\s+/i, '').trim()
    if (!normalized) return ''
    return normalized.split(/\s+/)[0]
  }, [currentTeacher])
  const formattedCurrentTime = useMemo(() => now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(), [now])
  const greetingHeadline = useMemo(() => {
    const hour = now.getHours()
    const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
    const salutation = facultyGivenName ? `Dr. ${facultyGivenName}` : 'Dr.'
    return `Good ${timeOfDay}, ${salutation}`
  }, [facultyGivenName, now])
  const greetingMeta = useMemo(() => `it's ${formattedCurrentTime}, here are your insights for today`, [formattedCurrentTime])
  const greetingSubline = useMemo(() => {
    const deptLabel = currentTeacher?.dept?.trim() || 'Faculty'
    const roleLabel = role
    return `${deptLabel} · ${roleLabel}`
  }, [currentTeacher?.dept, role])
  const sidebarYearGroups = useMemo(() => {
    const assignedOfferingIds = new Set(assignedOfferings.map(item => item.offId))
    return allYearGroups.filter(group => group.offerings.some(item => assignedOfferingIds.has(item.offId)))
  }, [allYearGroups, assignedOfferings])
  const sidebarCompletenessRows = useMemo(() => {
    const scopedStudents = assignedOfferings.flatMap(offeringItem => getStudentsPatched(offeringItem))
    if (scopedStudents.length === 0) return []

    const safeAverageAttendance = Math.round(
      scopedStudents.reduce((sum, student) => sum + Math.round((student.present / Math.max(1, student.totalClasses)) * 100), 0) / scopedStudents.length,
    )

    return [
      { lbl: 'TT1 Marks', pct: Math.round((scopedStudents.filter(student => student.tt1Score !== null).length / scopedStudents.length) * 100) },
      { lbl: 'Attendance', pct: safeAverageAttendance },
      { lbl: 'Quizzes', pct: Math.round((scopedStudents.filter(student => student.quiz1 !== null || student.quiz2 !== null).length / scopedStudents.length) * 100) },
    ]
  }, [assignedOfferings, getStudentsPatched])
  const canNavigateBack = routeHistory.length > 0
    || page !== getHomePage(role)
    || !!offering
    || !!selectedStudent
    || !!selectedMentee
    || !!historyProfile
    || !!selectedUnlockTaskId
    || !!schemeOfferingId
    || !!uploadOffering
    || !!courseInitialTab
  const routeSnapshot = useMemo<RouteSnapshot>(() => ({
    page,
    offeringId: offering?.offId ?? null,
    uploadOfferingId: uploadOffering?.offId ?? null,
    uploadKind,
    entryOfferingId,
    entryKind,
    selectedMenteeId: selectedMentee?.id ?? null,
    historyProfile,
    historyStudentId,
    studentShellStudentId,
    historyBackPage,
    selectedUnlockTaskId,
    schemeOfferingId,
    courseInitialTab,
  }), [
    courseInitialTab,
    entryKind,
    entryOfferingId,
    historyBackPage,
    historyProfile,
    historyStudentId,
    offering,
    page,
    schemeOfferingId,
    selectedMentee,
    selectedUnlockTaskId,
    studentShellStudentId,
    uploadKind,
    uploadOffering,
  ])

  const clearRouteHistory = useCallback(() => {
    setRouteHistory([])
    previousRouteRef.current = null
    restoringRouteRef.current = false
  }, [])

  const restoreRouteSnapshot = useCallback((snapshot: RouteSnapshot) => {
    setPage(snapshot.page)
    setOffering(snapshot.offeringId ? (allOfferings.find(item => item.offId === snapshot.offeringId) ?? null) : null)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setSelectedMentee(snapshot.selectedMenteeId ? (allMentees.find(item => item.id === snapshot.selectedMenteeId) ?? null) : null)
    setHistoryProfile(snapshot.historyProfile)
    setHistoryStudentId(snapshot.historyStudentId)
    setStudentShellStudentId(snapshot.studentShellStudentId)
    setHistoryBackPage(snapshot.historyBackPage)
    setSelectedUnlockTaskId(snapshot.selectedUnlockTaskId)
    setSchemeOfferingId(snapshot.schemeOfferingId)
    setUploadOffering(snapshot.uploadOfferingId ? (allOfferings.find(item => item.offId === snapshot.uploadOfferingId) ?? null) : null)
    setUploadKind(snapshot.uploadKind)
    setEntryOfferingId(snapshot.entryOfferingId)
    setEntryKind(snapshot.entryKind)
    setCourseInitialTab(snapshot.courseInitialTab)
  }, [allMentees, allOfferings])

  const exitToPortal = useCallback(() => {
    if (typeof window !== 'undefined') clearPortalWorkspaceHints(window.localStorage)
    navigateToPortal('home')
  }, [])

  // IMMEDIATELY apply the theme *before* rendering any components so child elements pick up the correct T colors
  applyThemePreset(themeMode)

  useEffect(() => {
    void repositories.sessionPreferences.saveTheme(themeMode)
  }, [repositories, themeMode])

  useEffect(() => {
    const previous = previousRouteRef.current
    if (!previous) {
      previousRouteRef.current = routeSnapshot
      return
    }
    const previousKey = getRouteSnapshotKey(previous)
    const nextKey = getRouteSnapshotKey(routeSnapshot)
    if (previousKey === nextKey) return
    if (restoringRouteRef.current) {
      restoringRouteRef.current = false
      previousRouteRef.current = routeSnapshot
      return
    }
    setRouteHistory(existing => {
      const last = existing.at(-1)
      if (last && getRouteSnapshotKey(last) === previousKey) return existing
      return [...existing, previous].slice(-40)
    })
    previousRouteRef.current = routeSnapshot
  }, [routeSnapshot])

  useEffect(() => {
    void repositories.sessionPreferences.saveCurrentFacultyId(currentTeacherId)
  }, [currentTeacherId, repositories])

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth
      const nextNarrow = width < 1100
      setIsCompactTopbar(width < 980)
      if (nextNarrow) {
        setSidebarCollapsed(true)
        setShowActionQueue(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const auditParamsApplied = useRef(false)
  useEffect(() => {
    if (auditParamsApplied.current) return
    if (getAcademicApiBaseUrl()) {
      auditParamsApplied.current = true
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (![...params.keys()].some(key => key.startsWith('mock'))) {
      auditParamsApplied.current = true
      return
    }
    const mockTeacher = params.get('mockTeacher')
    if (mockTeacher && currentTeacherId !== mockTeacher) {
      const mockFaculty = facultyAccounts.find(faculty => faculty.facultyId === mockTeacher)
      setCurrentTeacherId(mockTeacher)
      if (mockFaculty) {
        const nextRole = mockFaculty.allowedRoles[0]
        setRole(nextRole)
        setPage(getHomePage(nextRole))
      }
      return
    }
    if (!currentTeacher) return
    const mockRole = params.get('mockRole') as Role | null
    if (mockRole && allowedRoles.includes(mockRole) && role !== mockRole) {
      setRole(mockRole)
      setPage(getHomePage(mockRole))
      return
    }
    const mockOfferingId = params.get('mockOfferingId')
    const targetOffering = mockOfferingId ? (allOfferings.find(item => item.offId === mockOfferingId) ?? null) : null
    const mockStudentUsn = params.get('mockStudentUsn')
    const targetStudent = mockStudentUsn && targetOffering ? (getStudentsPatched(targetOffering).find(student => student.usn === mockStudentUsn) ?? null) : null
    const mockMenteeId = params.get('mockMenteeId')
    const targetMentee = mockMenteeId ? (allMentees.find(mentee => mentee.id === mockMenteeId) ?? null) : null
    const mockPage = params.get('mockPage') as PageId | null
    const mockTab = params.get('mockTab')
    if (targetOffering) {
      setOffering(targetOffering)
      setUploadOffering(targetOffering)
      setEntryOfferingId(targetOffering.offId)
      setSchemeOfferingId(targetOffering.offId)
    }
    const mockKind = params.get('mockKind') as EntryKind | null
    if (mockKind) {
      setUploadKind(mockKind)
      setEntryKind(mockKind)
    }
    if (mockTab) setCourseInitialTab(mockTab)
    const mockShowQueue = params.get('mockShowQueue')
    if (mockShowQueue) setShowActionQueue(mockShowQueue !== '0')
    if (targetStudent && targetOffering) {
      if (mockPage !== 'student-history') {
        setSelectedStudent(targetStudent)
        setSelectedOffering(targetOffering)
      }
      if (mockPage === 'student-history') {
        const nextHistory = buildHistoryProfile({ student: targetStudent, historyByUsn: studentHistoryByUsn })
        if (nextHistory) setHistoryProfile(nextHistory)
        setHistoryStudentId(targetStudent.id.split('::').at(-1) ?? targetStudent.id)
      }
      if (mockPage === 'student-shell') {
        setStudentShellStudentId(targetStudent.id.split('::').at(-1) ?? targetStudent.id)
      }
      if (mockPage === 'risk-explorer') {
        setStudentShellStudentId(targetStudent.id.split('::').at(-1) ?? targetStudent.id)
      }
    }
    if (targetMentee) {
      setSelectedMentee(targetMentee)
      if (mockPage === 'student-history') {
        const nextHistory = buildHistoryProfile({ mentee: targetMentee, historyByUsn: studentHistoryByUsn })
        if (nextHistory) setHistoryProfile(nextHistory)
        setHistoryStudentId(targetMentee.id.replace(/^mentee-/, ''))
      }
    }
    const mockUnlockTaskId = params.get('mockUnlockTaskId')
    if (mockUnlockTaskId) setSelectedUnlockTaskId(mockUnlockTaskId)
    if (mockPage && canAccessPage(role, mockPage)) setPage(mockPage)
    auditParamsApplied.current = true
  }, [allMentees, allOfferings, allTasksList, allowedRoles, currentTeacher, currentTeacherId, facultyAccounts, getStudentsPatched, role, studentHistoryByUsn])

  const handleOpenCourse = useCallback((o: Offering) => {
    setOffering(o)
    setCourseInitialTab(undefined)
    setPage('course')
  }, [])
  const handleGoHome = useCallback(() => {
    clearRouteHistory()
    setPage(getHomePage(role))
    setOffering(null)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setSelectedMentee(null)
    setHistoryProfile(null)
    setSelectedUnlockTaskId(null)
    setSchemeOfferingId(null)
    setUploadOffering(null)
    setCourseInitialTab(undefined)
    setHistoryBackPage(null)
  }, [clearRouteHistory, role])
  const handleNavigateBack = useCallback(() => {
    const nextHistory = [...routeHistory]
    while (nextHistory.length > 0) {
      const candidate = nextHistory.pop()
      if (!candidate || !canAccessPage(role, candidate.page)) continue
      setRouteHistory(nextHistory)
      restoringRouteRef.current = true
      restoreRouteSnapshot(candidate)
      return
    }
    handleGoHome()
  }, [handleGoHome, restoreRouteSnapshot, role, routeHistory])
  const handleOpenStudent = useCallback((s: Student, o?: Offering) => {
    setSelectedStudent(s)
    setSelectedOffering(o || null)
  }, [])
  const handleOpenStudents = useCallback(() => {
    setSelectedStudent(null)
    setSelectedOffering(null)
    setPage('students')
  }, [])
  const handleScheduleMeeting = useCallback(async (input: {
    student: Student
    offering?: Offering
    title: string
    notes?: string
    dateISO: string
    startMinutes: number
    endMinutes: number
  }) => {
    const created = await repositories.calendar.createMeeting({
      studentId: input.student.id.split('::').at(-1) ?? input.student.id,
      offeringId: input.offering?.offId ?? null,
      title: input.title,
      notes: input.notes,
      dateISO: input.dateISO,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      status: 'scheduled',
    })
    setAcademicMeetings(current => [...current, created].sort((left, right) => `${left.dateISO}-${left.startMinutes}`.localeCompare(`${right.dateISO}-${right.startMinutes}`)))
  }, [repositories])
  const handleUpdateMeeting = useCallback(async (meetingId: string, payload: {
    studentId: string
    offeringId?: string | null
    title: string
    notes?: string | null
    dateISO: string
    startMinutes: number
    endMinutes: number
    status: AcademicMeeting['status']
    version: number
  }) => {
    const updated = await repositories.calendar.updateMeeting(meetingId, payload)
    setAcademicMeetings(current => current.map(meeting => meeting.meetingId === meetingId ? updated : meeting))
  }, [repositories])
  const handleOpenHistoryFromStudent = useCallback((s: Student, _o?: Offering) => {
    const nextHistory = buildHistoryProfile({ student: s, historyByUsn: studentHistoryByUsn })
    if (!nextHistory) return
    setHistoryProfile(nextHistory)
    setHistoryStudentId(s.id.split('::').at(-1) ?? s.id)
    setHistoryBackPage(page)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setPage('student-history')
  }, [page, studentHistoryByUsn])
  const handleOpenMentee = useCallback((m: Mentee) => {
    setSelectedMentee(m)
    setPage('mentee-detail')
  }, [])
  const handleOpenStudentProfile = useCallback((studentId: string, offeringId?: string | null) => {
    if (role === 'Mentor') {
      const normalizedStudentId = studentId.split('::').at(-1) ?? studentId
      const studentScopeIds = new Set(getMenteeScopeIds(normalizedStudentId))
      const mentorMatch = assignedMentees.find(mentee => studentScopeIds.has(mentee.id))
      if (mentorMatch) {
        setSelectedMentee(mentorMatch)
        setPage('mentee-detail')
        return
      }
    }

    const searchableOfferings = role === 'HoD'
      ? allOfferings
      : assignedOfferings.length > 0
        ? assignedOfferings
        : allOfferings
    const target = findStudentProfileLaunchTarget({
      studentId,
      offeringId,
      offerings: searchableOfferings,
      getStudentsForOffering: getStudentsPatched,
    })
    if (target) handleOpenStudent(target.student, target.offering)
  }, [allOfferings, assignedMentees, assignedOfferings, getStudentsPatched, handleOpenStudent, role])
  const handleOpenHistoryFromMentee = useCallback((m: Mentee) => {
    const nextHistory = buildHistoryProfile({ mentee: m, historyByUsn: studentHistoryByUsn })
    if (!nextHistory) return
    setHistoryProfile(nextHistory)
    setHistoryStudentId(m.id.replace(/^mentee-/, ''))
    setHistoryBackPage('mentee-detail')
    setPage('student-history')
  }, [studentHistoryByUsn])
  const handleOpenStudentShell = useCallback((studentId: string, backPage?: PageId) => {
    setStudentShellStudentId(studentId)
    setHistoryBackPage(backPage ?? page)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setPage('student-shell')
  }, [page])
  const handleOpenRiskExplorer = useCallback((studentId: string, backPage?: PageId) => {
    setStudentShellStudentId(studentId)
    setHistoryBackPage(backPage ?? page)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setPage('risk-explorer')
  }, [page])
  const handleOpenCalendar = useCallback(() => {
    setPage('calendar')
    setOffering(null)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setSelectedMentee(null)
  }, [])
  const handleOpenEntryHub = useCallback((o: Offering, kind: EntryKind) => {
    setUploadOffering(o)
    setUploadKind(kind)
    setEntryOfferingId(o.offId)
    setEntryKind(kind)
    setPage('entry-workspace')
  }, [])
  const handleOpenUpload = useCallback((o?: Offering, kind: EntryKind = 'tt1') => {
    if (o) setUploadOffering(o)
    else setUploadOffering(assignedOfferings[0] ?? defaultOffering)
    setUploadKind(kind)
    setPage('upload')
  }, [assignedOfferings, defaultOffering])
  const handleOpenWorkspace = useCallback((offeringId: string, kind: EntryKind) => {
    setEntryOfferingId(offeringId)
    setEntryKind(kind)
    setPage('entry-workspace')
  }, [])
  const handleOpenSchemeSetup = useCallback((o?: Offering) => {
    const target = o ?? uploadOffering ?? offering ?? assignedOfferings[0] ?? defaultOffering
    if (!target) return
    setSchemeOfferingId(target.offId)
    setPage('scheme-setup')
  }, [assignedOfferings, defaultOffering, offering, uploadOffering])
  const handleToggleActionQueue = useCallback(() => {
    setShowActionQueue(current => {
      if (current) return false
      requestAnimationFrame(() => {
        actionQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      })
      return true
    })
  }, [])
  const handleOpenQueueHistory = useCallback(() => setPage('queue-history'), [])
  const handleOpenUnlockReview = useCallback((taskId: string) => {
    setSelectedUnlockTaskId(taskId)
    setPage('unlock-review')
  }, [])

  const handleUpdateBlueprint = useCallback((offId: string, kind: TTKind, next: TermTestBlueprint) => {
    setTtBlueprintsByOffering(prev => ({
      ...prev,
      [offId]: {
        ...(prev[offId] ?? getFallbackBlueprintSet(offId)),
        [kind]: normalizeBlueprint(kind, next),
      },
    }))
  }, [getFallbackBlueprintSet])

  const handleRoleChange = useCallback((r: Role) => {
    if (!allowedRoles.includes(r) || r === role || roleChangeBusy) return
    markRiskReevaluationPending()

    const applyRoleLocally = () => {
      clearRouteHistory()
      setRole(r)
      setPage(getHomePage(r))
      setOffering(null)
      setSelectedStudent(null)
      setSelectedMentee(null)
      setHistoryProfile(null)
      setSelectedUnlockTaskId(null)
      setSchemeOfferingId(null)
      setCourseInitialTab(undefined)
      setHistoryBackPage(null)
      setTaskComposer(prev => ({ ...prev, isOpen: false, placement: undefined, availableOfferingIds: undefined }))
      setPendingNoteAction(null)
    }

    setRoleChangeError('')
    if (!onRoleChange) {
      applyRoleLocally()
      return
    }

    setRoleChangeBusy(true)
    void Promise.resolve(onRoleChange(r))
      .catch(error => {
        setRoleChangeError(error instanceof Error ? error.message : `Could not switch to ${r}.`)
      })
      .finally(() => {
        setRoleChangeBusy(false)
      })
  }, [allowedRoles, clearRouteHistory, markRiskReevaluationPending, onRoleChange, role, roleChangeBusy])

  const buildEntryCommitPayload = useCallback((offId: string, kind: EntryKind) => {
    const targetOffering = allOfferings.find(item => item.offId === offId)
    if (!targetOffering) return null
    const students = selectors.getStudentsPatched(targetOffering)
    const getPatch = (studentId: string) => selectors.getStudentPatch(offId, studentId)

    if (kind === 'attendance') {
      return {
        kind,
        payload: {
          entries: students.map(student => {
            const patch = getPatch(student.id)
            return {
              studentId: student.id,
              presentClasses: patch.present ?? student.present,
              totalClasses: patch.totalClasses ?? student.totalClasses,
            }
          }),
        },
      }
    }

    const currentScheme = schemeByOffering[offId] ?? defaultSchemeForOffering(targetOffering)
    if (students.length === 0) return null
    if (kind === 'tt1' || kind === 'tt2') {
      const blueprint = ttBlueprintsByOffering[offId]?.[kind] ?? getFallbackBlueprintSet(offId)[kind]
      const leaves = flattenBlueprintLeaves(blueprint.nodes)
      if (leaves.length === 0) return null
      const entries = students.map(student => {
        const patch = getPatch(student.id)
        const patchScores = kind === 'tt1' ? patch.tt1LeafScores : patch.tt2LeafScores
        const seededScores = seedTermTestLeafScores(kind === 'tt1' ? student.tt1Score : student.tt2Score, kind === 'tt1' ? student.tt1Max : student.tt2Max, leaves)
        const components = leaves.map(leaf => {
          const key = toCellKey(offId, kind, student.id, leaf.id)
          const score = cellValues[key] ?? patchScores?.[leaf.id] ?? seededScores?.[leaf.id]
          if (typeof score !== 'number') return null
          return {
            componentCode: leaf.id,
            score,
            maxScore: leaf.maxMarks,
          }
        })
        if (components.some(component => component === null)) return null
        return {
          studentId: student.id,
          components: components as Array<{ componentCode: string; score: number; maxScore: number }>,
        }
      })
      if (entries.some(entry => entry === null)) return null
      return {
        kind,
        payload: {
          entries: entries as Array<{ studentId: string; components: Array<{ componentCode: string; score: number; maxScore: number }> }>,
        },
      }
    }

    if (kind === 'quiz' || kind === 'assignment') {
      const components = kind === 'quiz' ? currentScheme.quizComponents : currentScheme.assignmentComponents
      if (components.length === 0) return null
      return {
        kind,
        payload: {
          entries: students.map(student => {
            const patch = getPatch(student.id)
            const patchScores = kind === 'quiz' ? patch.quizScores : patch.assignmentScores
            return {
              studentId: student.id,
              components: components.map((component, index) => {
                const fallbackValue = patchScores?.[component.id]
                  ?? getAssessmentComponentScore(student, kind, component, index)
                  ?? 0
                return {
                  componentCode: component.id,
                  score: cellValues[toCellKey(offId, kind, student.id, component.id)] ?? fallbackValue,
                  maxScore: component.rawMax,
                }
              }),
            }
          }),
        },
      }
    }

    const finalEntries = students.flatMap(student => {
      const patch = getPatch(student.id)
      const value = cellValues[toCellKey(offId, 'finals', student.id, 'see')] ?? patch.seeScore
      if (typeof value !== 'number') return []
      return [{
        studentId: student.id,
        components: [{
          componentCode: 'see',
          score: value,
          maxScore: currentScheme.finalsMax,
        }],
      }]
    })
    if (finalEntries.length === 0) return null
    return {
      kind,
      payload: {
        entries: finalEntries,
      },
    }
  }, [allOfferings, cellValues, getFallbackBlueprintSet, schemeByOffering, selectors, ttBlueprintsByOffering])

  const persistEntryWorkspace = useCallback(async (offId: string, kind: EntryKind, lock = false) => {
    markRiskReevaluationPending()
    if (kind === 'attendance') {
      const commit = buildEntryCommitPayload(offId, kind)
      if (!commit || commit.kind !== 'attendance') return
      await repositories.entryData.commitAttendanceEntries(offId, {
        ...commit.payload,
        capturedAt: new Date().toISOString(),
        lock,
      })
      return
    }
    const commit = buildEntryCommitPayload(offId, kind)
    if (!commit || commit.kind === 'attendance') return
    await repositories.entryData.commitAssessmentEntries(offId, commit.kind as Exclude<EntryKind, 'attendance'>, {
      ...commit.payload,
      evaluatedAt: new Date().toISOString(),
      lock,
    })
  }, [buildEntryCommitPayload, markRiskReevaluationPending, repositories])

  const handleSaveDraft = useCallback((offId: string, kind: EntryKind) => {
    markRiskReevaluationPending()
    setDraftBySection(prev => ({ ...prev, [`${offId}::${kind}`]: Date.now() }))
  }, [markRiskReevaluationPending])

  const handleSubmitLock = useCallback((offId: string, kind: EntryKind) => {
    markRiskReevaluationPending()
    let previousLock: boolean | undefined
    let previousSchemeStatus: SchemeState['status'] | undefined
    let previousSchemeLockedAt: number | undefined

    setLockByOffering(prev => {
      previousLock = prev[offId]?.[kind]
      return {
        ...prev,
        [offId]: { ...(prev[offId] ?? getEntryLockMap(allOfferings.find(o => o.offId === offId) ?? defaultOffering ?? allOfferings[0])), [kind]: true },
      }
    })
    setSchemeByOffering(prev => {
      previousSchemeStatus = prev[offId]?.status
      previousSchemeLockedAt = prev[offId]?.lockedAt
      return prev[offId] ? ({
        ...prev,
        [offId]: {
          ...prev[offId],
          status: 'Locked',
          lockedAt: Date.now(),
        },
      }) : prev
    })
    
    persistEntryWorkspace(offId, kind, true).catch(error => {
      setLockByOffering(prev => ({
        ...prev,
        [offId]: { ...prev[offId], [kind]: previousLock ?? false },
      }))
      setSchemeByOffering(prev => prev[offId] ? ({
        ...prev,
        [offId]: {
          ...prev[offId],
          status: previousSchemeStatus ?? prev[offId].status,
          lockedAt: previousSchemeLockedAt,
        },
      }) : prev)
      console.error('Failed to lock entry workspace', error)
    })
  }, [allOfferings, defaultOffering, markRiskReevaluationPending, persistEntryWorkspace])

  const commitStudentPatch = useCallback((offeringId: string, studentId: string, updater: (existing: StudentRuntimePatch) => StudentRuntimePatch) => {
    setStudentPatches(prev => {
      const key = toStudentPatchKey(offeringId, studentId)
      const existing = prev[key] ?? {}
      const updated = updater(existing)
      const cleaned: StudentRuntimePatch = {
        ...updated,
        tt1LeafScores: pruneScoreMap(updated.tt1LeafScores),
        tt2LeafScores: pruneScoreMap(updated.tt2LeafScores),
        quizScores: pruneScoreMap(updated.quizScores),
        assignmentScores: pruneScoreMap(updated.assignmentScores),
      }
      const next = { ...prev }
      if (isPatchEmpty(cleaned)) delete next[key]
      else next[key] = cleaned
      return next
    })
  }, [])

  const handleCellValueChange = useCallback((key: string, value: number | undefined) => {
    markRiskReevaluationPending()
    setCellValues(prev => {
      const next = { ...prev }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })
    const [offeringId, kind, studentId, field] = key.split('::') as [string, EntryKind, string, string]
    if (!offeringId || !kind || !studentId || !field) return
    commitStudentPatch(offeringId, studentId, existing => {
      if (kind === 'attendance') {
        return {
          ...existing,
          present: field === 'present' ? value : existing.present,
          totalClasses: field === 'total' ? value : existing.totalClasses,
        }
      }
      if (kind === 'finals') {
        return {
          ...existing,
          seeScore: field === 'see' ? value : existing.seeScore,
        }
      }
      if (kind === 'tt1' || kind === 'tt2') {
        const nextScores = { ...((kind === 'tt1' ? existing.tt1LeafScores : existing.tt2LeafScores) ?? {}) }
        if (value === undefined) delete nextScores[field]
        else nextScores[field] = value
        return kind === 'tt1'
          ? { ...existing, tt1LeafScores: nextScores }
          : { ...existing, tt2LeafScores: nextScores }
      }
      if (kind === 'quiz' || kind === 'assignment') {
        const nextScores = { ...((kind === 'quiz' ? existing.quizScores : existing.assignmentScores) ?? {}) }
        if (value === undefined) delete nextScores[field]
        else nextScores[field] = value
        return kind === 'quiz'
          ? { ...existing, quizScores: nextScores }
          : { ...existing, assignmentScores: nextScores }
      }
      return existing
    })
  }, [commitStudentPatch, markRiskReevaluationPending])

  const handleResolveTask = useCallback((id: string) => {
    markRiskReevaluationPending()
    const resolvedAt = Date.now()
    const target = allTasksList.find(task => task.id === id)
    if (!target) {
      if (id.startsWith('proof-monitoring-')) setResolvedTasks(prev => ({ ...prev, [id]: resolvedAt }))
      return
    }
    const activePlacement = taskPlacements[id]
    setResolvedTasks(prev => ({ ...prev, [id]: resolvedAt }))
    const resolvedTask: SharedTask = {
      ...target,
      status: 'Resolved',
      updatedAt: resolvedAt,
      resolvedByFacultyId: currentTeacherId ?? undefined,
      scheduleMeta: target.scheduleMeta?.mode === 'scheduled'
        ? {
            ...target.scheduleMeta,
            completedDatesISO: [...(target.scheduleMeta.completedDatesISO ?? []), ...(target.dueDateISO ? [target.dueDateISO] : [])],
          }
        : target.scheduleMeta,
      transitionHistory: [...(target.transitionHistory ?? []), createTransition({ action: 'Resolved', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: target.assignedTo, toOwner: target.assignedTo, note: `${role} marked this queue item as resolved.` })],
    }

    let nextTask: SharedTask | null = null
    if (target.scheduleMeta?.mode === 'scheduled' && target.scheduleMeta.status !== 'paused' && target.scheduleMeta.status !== 'ended') {
      const nextDueDateISO = getNextScheduledDate(target.scheduleMeta, target.dueDateISO)
      if (nextDueDateISO) {
        nextTask = {
          ...target,
          id: `${target.id}-next-${Date.now()}`,
          status: 'New',
          dueDateISO: nextDueDateISO,
          due: toDueLabel(nextDueDateISO, 'This week', proofVirtualDateISO),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          scheduleMeta: {
            ...target.scheduleMeta,
            nextDueDateISO,
            completedDatesISO: [...(target.scheduleMeta.completedDatesISO ?? []), ...(target.dueDateISO ? [target.dueDateISO] : [])],
          },
          transitionHistory: [createTransition({ action: 'Scheduled occurrence created', actorRole: 'System', toOwner: target.assignedTo, note: `Next ${target.scheduleMeta.preset ?? 'recurring'} occurrence activated for ${nextDueDateISO}.` })],
        }
      }
    }

    setAllTasksList(prev => {
      const updated = prev.map(task => task.id === id ? resolvedTask : task)
      return nextTask ? [...updated, nextTask] : updated
    })
    if (activePlacement && nextTask) {
      setTaskPlacements(prev => ({
        ...prev,
        [nextTask.id]: {
          ...activePlacement,
          taskId: nextTask.id,
          dateISO: nextTask?.dueDateISO ?? activePlacement.dateISO,
          updatedAt: Date.now(),
        },
      }))
    }
  }, [allTasksList, currentTeacherId, markRiskReevaluationPending, proofVirtualDateISO, role, taskPlacements])

  const handleToggleSchedulePause = useCallback((taskId: string) => {
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || task.scheduleMeta?.mode !== 'scheduled' || task.scheduleMeta.status === 'ended') return task
      const nextStatus = task.scheduleMeta.status === 'paused' ? 'active' : 'paused'
      return {
        ...task,
        updatedAt: Date.now(),
        scheduleMeta: { ...task.scheduleMeta, status: nextStatus },
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: nextStatus === 'paused' ? 'Recurrence paused' : 'Recurrence resumed', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} set recurrence state to ${nextStatus}.` })],
      }
    }))
  }, [currentTeacherId, role])

  const handleEditSchedule = useCallback((taskId: string) => {
    const nextDate = window.prompt('Set next occurrence date (YYYY-MM-DD)')
    const normalized = normalizeDateISO(nextDate ?? undefined)
    if (!normalized) return
    const taskPlacement = taskPlacements[taskId]
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || task.scheduleMeta?.mode !== 'scheduled' || task.scheduleMeta.status === 'ended') return task
      return {
        ...task,
        dueDateISO: normalized,
        due: toDueLabel(normalized, 'This week', proofVirtualDateISO),
        updatedAt: Date.now(),
        scheduleMeta: { ...task.scheduleMeta, nextDueDateISO: normalized },
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Recurrence edited', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} updated future schedule starting ${normalized}.` })],
      }
    }))
    if (taskPlacement) {
      setTaskPlacements(prev => ({
        ...prev,
        [taskId]: {
          ...taskPlacement,
          dateISO: normalized,
          updatedAt: Date.now(),
        },
      }))
    }
  }, [currentTeacherId, proofVirtualDateISO, role, taskPlacements])

  const handleDismissTask = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    const dismissedAt = Date.now()
    const target = roleTasks.find(task => task.id === taskId)
    if (!target || target.scheduleMeta?.mode === 'scheduled' || target.dismissal) return
    const dismissedTask: SharedTask = {
      ...target,
      updatedAt: dismissedAt,
      dismissal: {
        kind: 'task',
        dismissedAt,
        dismissedByFacultyId: currentTeacherId ?? undefined,
        dismissedDateISO: normalizeDateISO(target.dueDateISO),
      },
      transitionHistory: [
        ...(target.transitionHistory ?? []),
        createTransition({
          action: 'Dismissed',
          actorRole: role,
          actorTeacherId: currentTeacherId ?? undefined,
          fromOwner: target.assignedTo,
          toOwner: target.assignedTo,
          note: `${role} dismissed this queue item from active work.`,
        }),
      ],
    }
    if (taskId.startsWith('proof-monitoring-')) {
      setResolvedTasks(prev => ({ ...prev, [taskId]: dismissedAt }))
    }
    setAllTasksList(prev => {
      let matchedExistingTask = false
      const nextTasks = prev.map(task => {
        if (task.id !== taskId) return task
        matchedExistingTask = true
        return dismissedTask
      })
      return matchedExistingTask ? nextTasks : [...nextTasks, dismissedTask]
    })
  }, [currentTeacherId, markRiskReevaluationPending, role, roleTasks])

  const handleDismissSeries = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || task.scheduleMeta?.mode !== 'scheduled' || task.dismissal) return task
      return {
        ...task,
        updatedAt: Date.now(),
        dismissal: {
          kind: 'series',
          dismissedAt: Date.now(),
          dismissedByFacultyId: currentTeacherId ?? undefined,
          dismissedDateISO: normalizeDateISO(task.dueDateISO),
        },
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Series dismissed', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} removed this recurring series from active work.` })],
      }
    }))
  }, [currentTeacherId, markRiskReevaluationPending, role])

  const handleRestoreTask = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    setResolvedTasks(prev => {
      if (!prev[taskId]) return prev
      const next = { ...prev }
      delete next[taskId]
      return next
    })
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || !task.dismissal) return task
      const action = task.dismissal.kind === 'series' ? 'Series resumed' : 'Restored'
      const note = task.dismissal.kind === 'series'
        ? `${role} resumed this recurring series.`
        : `${role} restored this dismissed queue item.`
      return {
        ...task,
        updatedAt: Date.now(),
        dismissal: undefined,
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action, actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note })],
      }
    }))
  }, [currentTeacherId, markRiskReevaluationPending, role])

  const handleUndoTask = useCallback((id: string) => {
    markRiskReevaluationPending()
    setResolvedTasks(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAllTasksList(prev => prev.map(task => task.id === id ? ({
      ...task,
      status: 'In Progress',
      updatedAt: Date.now(),
      transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Reopened', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} reopened the resolved queue item.` })],
    }) : task))
  }, [currentTeacherId, markRiskReevaluationPending, role])

  const appendLockAudit = useCallback((offeringId: string, kind: EntryKind, transition: QueueTransition) => {
    setLockAuditByTarget(prev => ({
      ...prev,
      [`${offeringId}::${kind}`]: [...(prev[`${offeringId}::${kind}`] ?? []), transition],
    }))
  }, [])
  const appendCalendarAudit = useCallback((event: CalendarAuditEvent) => {
    setCalendarAuditEvents(prev => [event, ...prev])
  }, [])

  const handleUpdateStudentAttendance = useCallback((offeringId: string, studentId: string, patch: StudentRuntimePatch) => {
    commitStudentPatch(offeringId, studentId, existing => ({ ...existing, ...patch }))
  }, [commitStudentPatch])

  const handleCommitDemoAttendanceEdit = useCallback(async (offeringId: string, studentId: string, nextAttendancePct: number) => {
    if (onCommitDemoAttendanceEdit) {
      await onCommitDemoAttendanceEdit(offeringId, studentId, nextAttendancePct)
      return
    }
    const offeringForEdit = allOfferings.find(item => item.offId === offeringId)
    if (!offeringForEdit) throw new Error('Demo attendance edit offering is unavailable.')
    const studentForEdit = getStudentsPatched(offeringForEdit).find(student => (student.id.split('::').at(-1) ?? student.id) === studentId || student.id === studentId)
    if (!studentForEdit) throw new Error('Demo attendance edit student is unavailable.')
    const totalClasses = Math.max(1, studentForEdit.totalClasses || 50)
    const presentClasses = Math.max(0, Math.min(totalClasses, Math.round((nextAttendancePct / 100) * totalClasses)))
    commitStudentPatch(offeringId, studentForEdit.id, existing => ({
      ...existing,
      present: presentClasses,
      totalClasses,
    }))
    await repositories.entryData.commitAttendanceEntries(offeringId, {
      entries: [{ studentId, presentClasses, totalClasses }],
      capturedAt: new Date().toISOString(),
      lock: false,
    })
  }, [allOfferings, commitStudentPatch, getStudentsPatched, onCommitDemoAttendanceEdit, repositories])

  const handleScheduleTask = useCallback((taskId: string, input: TaskPlacementDraft) => {
    if (!currentTeacher || !currentFacultyTimetable || !currentTeacher.allowedRoles.includes('Course Leader')) return
    const task = allTasksList.find(item => item.id === taskId)
    if (!task) return
    const previousPlacement = taskPlacements[taskId]
    const nextPlacement = input.placementMode === 'timed' && typeof input.startMinutes === 'number' && typeof input.endMinutes === 'number'
      ? buildPlacementForRange({
          taskId,
          dateISO: input.dateISO,
          startMinutes: input.startMinutes,
          endMinutes: input.endMinutes,
          dayStartMinutes: currentFacultyTimetable.dayStartMinutes,
          dayEndMinutes: currentFacultyTimetable.dayEndMinutes,
        })
      : buildUntimedPlacement({ taskId, dateISO: input.dateISO })
    const updatedTask = applyPlacementToTask(task, nextPlacement, proofVirtualDateISO)
    void repositories.tasks.upsertTask(updatedTask)
    setTaskPlacements(prev => ({ ...prev, [taskId]: nextPlacement }))
    setAllTasksList(prev => prev.map(item => item.id === taskId ? updatedTask : item))
    appendCalendarAudit(createCalendarAuditEvent({
      facultyId: currentTeacher.facultyId,
      actorRole: role,
      actorFacultyId: currentTeacherId ?? undefined,
      actionKind: previousPlacement
        ? (previousPlacement.placementMode === 'timed' && input.placementMode === 'untimed' ? 'task-unscheduled' : 'task-rescheduled')
        : 'task-scheduled',
      targetType: 'task',
      targetId: taskId,
      note: previousPlacement ? `Rescheduled ${task.title} for ${input.dateISO}.` : `Scheduled ${task.title} for ${input.dateISO}.`,
      before: previousPlacement ? {
        dateISO: previousPlacement.dateISO,
        startMinutes: previousPlacement.startMinutes,
        endMinutes: previousPlacement.endMinutes,
        startTime: previousPlacement.startTime,
        endTime: previousPlacement.endTime,
        placementMode: previousPlacement.placementMode,
      } : undefined,
      after: {
        dateISO: nextPlacement.dateISO,
        startMinutes: nextPlacement.startMinutes,
        endMinutes: nextPlacement.endMinutes,
        startTime: nextPlacement.startTime,
        endTime: nextPlacement.endTime,
        placementMode: nextPlacement.placementMode,
        offeringId: task.offeringId,
      },
    }))
  }, [allTasksList, appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, proofVirtualDateISO, repositories, role, taskPlacements])

  const resolveCommittedClassRange = useCallback((blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }) => {
    if (!currentFacultyTimetable) return null
    const block = currentFacultyTimetable.classBlocks.find(item => item.id === blockId)
    if (!block) return null
    const normalizedDateISO = block.kind === 'extra'
      ? (normalizeDateISO(input.dateISO ?? block.dateISO ?? '') ?? block.dateISO)
      : undefined
    const resolvedDay = normalizedDateISO
      ? (getWeekdayForDateISO(normalizedDateISO) ?? input.day)
      : input.day
    const targetDayBlocks = [
      ...currentFacultyTimetable.classBlocks.filter(item => item.id !== blockId && (
        normalizedDateISO
          ? classBlockOccursOnDate(item, normalizedDateISO, resolvedDay)
          : item.day === resolvedDay
      )),
      { ...block, day: resolvedDay, dateISO: normalizedDateISO },
    ]
    const reflowed = reflowClassDayRanges({
      blocks: targetDayBlocks,
      targetId: blockId,
      desiredStartMinutes: input.startMinutes,
      desiredEndMinutes: input.endMinutes,
      dayStartMinutes: currentFacultyTimetable.dayStartMinutes,
      dayEndMinutes: currentFacultyTimetable.dayEndMinutes,
      snapThresholdMinutes: CLASS_SNAP_THRESHOLD_MINUTES,
    })
    if (!reflowed) return null

    const changedBlockIds = Array.from(new Set([
      blockId,
      ...reflowed.changedBlockIds,
    ]))

    return {
      day: resolvedDay,
      dateISO: normalizedDateISO,
      primary: { day: resolvedDay, dateISO: normalizedDateISO, startMinutes: reflowed.targetRange.startMinutes, endMinutes: reflowed.targetRange.endMinutes },
      changedBlockIds,
      rangesById: reflowed.rangesById,
    }
  }, [currentFacultyTimetable])

  const applyClassBlockTiming = useCallback((blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }, actionKind: 'class-moved' | 'class-resized') => {
    if (!currentTeacher || !currentFacultyTimetable || !currentTeacher.allowedRoles.includes('Course Leader')) return
    const block = currentFacultyTimetable.classBlocks.find(item => item.id === blockId)
    if (!block) return
    const resolved = resolveCommittedClassRange(blockId, input)
    if (!resolved) return
    const changedBlocks = currentFacultyTimetable.classBlocks.filter(item => resolved.changedBlockIds.includes(item.id))
    setTimetableByFacultyId(prev => ({
      ...prev,
      [currentTeacher.facultyId]: {
        ...currentFacultyTimetable,
        updatedAt: Date.now(),
        classBlocks: currentFacultyTimetable.classBlocks.map(item => {
          const nextRange = resolved.rangesById[item.id]
          if (nextRange) {
            return {
              ...item,
              day: item.id === blockId ? resolved.day : item.day,
              dateISO: item.id === blockId ? resolved.dateISO : item.dateISO,
              startMinutes: nextRange.startMinutes,
              endMinutes: nextRange.endMinutes,
            }
          }
          return item
        }),
      },
    }))
    appendCalendarAudit(createCalendarAuditEvent({
      facultyId: currentTeacher.facultyId,
      actorRole: role,
      actorFacultyId: currentTeacherId ?? undefined,
      actionKind,
      targetType: 'class',
      targetId: blockId,
      note: `${actionKind === 'class-resized' ? 'Resized' : 'Updated'} ${block.courseCode} Sec ${block.section} to ${resolved.primary.day} ${minutesToDisplayLabel(resolved.primary.startMinutes)} - ${minutesToDisplayLabel(resolved.primary.endMinutes)}.${changedBlocks.length > 1 ? ` Reflowed ${changedBlocks.length - 1} adjacent class${changedBlocks.length > 2 ? 'es' : ''} on the same day.` : ''}`,
      before: { day: block.day, dateISO: block.dateISO, startMinutes: block.startMinutes, endMinutes: block.endMinutes, offeringId: block.offeringId },
      after: { day: resolved.primary.day, dateISO: resolved.primary.dateISO, startMinutes: resolved.primary.startMinutes, endMinutes: resolved.primary.endMinutes, offeringId: block.offeringId },
    }))
    changedBlocks
      .filter(item => item.id !== blockId)
      .forEach(item => {
        const nextRange = resolved.rangesById[item.id]
        if (!nextRange) return
      appendCalendarAudit(createCalendarAuditEvent({
        facultyId: currentTeacher.facultyId,
        actorRole: role,
        actorFacultyId: currentTeacherId ?? undefined,
        actionKind: 'class-moved',
        targetType: 'class',
        targetId: item.id,
        note: `${item.courseCode} Sec ${item.section} was reflowed to ${minutesToDisplayLabel(nextRange.startMinutes)} - ${minutesToDisplayLabel(nextRange.endMinutes)} after ${block.courseCode} Sec ${block.section} changed.`,
        before: { day: item.day, dateISO: item.dateISO, startMinutes: item.startMinutes, endMinutes: item.endMinutes, offeringId: item.offeringId },
        after: { day: item.day, dateISO: item.dateISO, startMinutes: nextRange.startMinutes, endMinutes: nextRange.endMinutes, offeringId: item.offeringId },
      }))
    })
  }, [appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, resolveCommittedClassRange, role])

  const handleMoveClassBlock = useCallback((blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }) => {
    applyClassBlockTiming(blockId, input, 'class-moved')
  }, [applyClassBlockTiming])

  const handleResizeClassBlock = useCallback((blockId: string, input: { startMinutes: number; endMinutes: number }) => {
    const block = currentFacultyTimetable?.classBlocks.find(item => item.id === blockId)
    if (!block) return
    applyClassBlockTiming(blockId, { day: block.day, startMinutes: input.startMinutes, endMinutes: input.endMinutes }, 'class-resized')
  }, [applyClassBlockTiming, currentFacultyTimetable])

  const handleEditClassTiming = useCallback((blockId: string, input: { day: Weekday; dateISO?: string; startMinutes: number; endMinutes: number }) => {
    applyClassBlockTiming(blockId, input, 'class-moved')
  }, [applyClassBlockTiming])

  const handleCreateExtraClass = useCallback((input: { offeringId: string; dateISO: string; startMinutes: number; endMinutes: number }) => {
    if (!currentTeacher || !currentFacultyTimetable || !currentTeacher.allowedRoles.includes('Course Leader')) return
    const offering = allOfferings.find(item => item.offId === input.offeringId)
    const normalizedDateISO = normalizeDateISO(input.dateISO)
    const day = normalizedDateISO ? getWeekdayForDateISO(normalizedDateISO) : null
    if (!offering || !normalizedDateISO || !day) return

    const draftId = `extra-${offering.offId}-${Date.now()}`
    const draftBlock = {
      id: draftId,
      facultyId: currentTeacher.facultyId,
      offeringId: offering.offId,
      courseCode: offering.code,
      courseName: offering.title,
      section: offering.section,
      year: offering.year,
      day,
      dateISO: normalizedDateISO,
      kind: 'extra' as const,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
    }

    const targetDayBlocks = [
      ...currentFacultyTimetable.classBlocks.filter(item => classBlockOccursOnDate(item, normalizedDateISO, day)),
      draftBlock,
    ]
    const reflowed = reflowClassDayRanges({
      blocks: targetDayBlocks,
      targetId: draftId,
      desiredStartMinutes: input.startMinutes,
      desiredEndMinutes: input.endMinutes,
      dayStartMinutes: currentFacultyTimetable.dayStartMinutes,
      dayEndMinutes: currentFacultyTimetable.dayEndMinutes,
      snapThresholdMinutes: CLASS_SNAP_THRESHOLD_MINUTES,
    })
    if (!reflowed) return

    const changedExistingBlocks = currentFacultyTimetable.classBlocks.filter(item => reflowed.changedBlockIds.includes(item.id))
    const nextBlock = {
      ...draftBlock,
      startMinutes: reflowed.targetRange.startMinutes,
      endMinutes: reflowed.targetRange.endMinutes,
    }

    setTimetableByFacultyId(prev => ({
      ...prev,
      [currentTeacher.facultyId]: {
        ...currentFacultyTimetable,
        updatedAt: Date.now(),
        classBlocks: [
          ...currentFacultyTimetable.classBlocks.map(item => {
            const nextRange = reflowed.rangesById[item.id]
            if (!nextRange) return item
            return {
              ...item,
              startMinutes: nextRange.startMinutes,
              endMinutes: nextRange.endMinutes,
            }
          }),
          nextBlock,
        ],
      },
    }))

    appendCalendarAudit(createCalendarAuditEvent({
      facultyId: currentTeacher.facultyId,
      actorRole: role,
      actorFacultyId: currentTeacherId ?? undefined,
      actionKind: 'class-created',
      targetType: 'class',
      targetId: nextBlock.id,
      note: `Scheduled extra ${nextBlock.courseCode} Sec ${nextBlock.section} on ${normalizedDateISO} ${minutesToDisplayLabel(nextBlock.startMinutes)} - ${minutesToDisplayLabel(nextBlock.endMinutes)}.${changedExistingBlocks.length > 0 ? ` Reflowed ${changedExistingBlocks.length} existing class${changedExistingBlocks.length > 1 ? 'es' : ''} on the same date.` : ''}`,
      after: {
        day,
        dateISO: normalizedDateISO,
        startMinutes: nextBlock.startMinutes,
        endMinutes: nextBlock.endMinutes,
        offeringId: nextBlock.offeringId,
      },
    }))

    changedExistingBlocks.forEach(item => {
      const nextRange = reflowed.rangesById[item.id]
      if (!nextRange) return
      appendCalendarAudit(createCalendarAuditEvent({
        facultyId: currentTeacher.facultyId,
        actorRole: role,
        actorFacultyId: currentTeacherId ?? undefined,
        actionKind: 'class-moved',
        targetType: 'class',
        targetId: item.id,
        note: `${item.courseCode} Sec ${item.section} was reflowed to ${minutesToDisplayLabel(nextRange.startMinutes)} - ${minutesToDisplayLabel(nextRange.endMinutes)} after scheduling an extra class.`,
        before: { day: item.day, dateISO: item.dateISO, startMinutes: item.startMinutes, endMinutes: item.endMinutes, offeringId: item.offeringId },
        after: { day: item.day, dateISO: item.dateISO, startMinutes: nextRange.startMinutes, endMinutes: nextRange.endMinutes, offeringId: item.offeringId },
      }))
    })
  }, [allOfferings, appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, role])

  const handleOpenCourseFromCalendar = useCallback((offeringId: string) => {
    if (role === 'Mentor') return
    const targetOffering = allOfferings.find(item => item.offId === offeringId)
    if (!targetOffering) return
    handleOpenCourse(targetOffering)
  }, [allOfferings, handleOpenCourse, role])

  const handleOpenActionQueueFromCalendar = useCallback(() => {
    setShowActionQueue(true)
  }, [])

  const handleUpdateTimetableBounds = useCallback((input: { dayStartMinutes: number; dayEndMinutes: number }) => {
    if (!currentTeacher || !currentFacultyTimetable || !currentTeacher.allowedRoles.includes('Course Leader')) return
    const normalized = normalizeTimedRange(input.dayStartMinutes, input.dayEndMinutes, 0, 24 * 60, 120)
    setTimetableByFacultyId(prev => ({
      ...prev,
      [currentTeacher.facultyId]: {
        ...currentFacultyTimetable,
        dayStartMinutes: normalized.startMinutes,
        dayEndMinutes: normalized.endMinutes,
        updatedAt: Date.now(),
        classBlocks: currentFacultyTimetable.classBlocks.map(block => ({
          ...block,
          ...clampRangeToDayBounds(block.startMinutes, block.endMinutes, normalized.startMinutes, normalized.endMinutes),
        })),
      },
    }))
  }, [currentFacultyTimetable, currentTeacher])

  const handleOpenTaskComposer = useCallback((input?: { offeringId?: string; studentId?: string; taskType?: TaskType; dueDateISO?: string; availableOfferingIds?: string[]; placement?: TaskPlacementDraft }) => {
    const scopedFallbackOffering = input?.availableOfferingIds?.[0] ? (allOfferings.find(item => item.offId === input.availableOfferingIds?.[0]) ?? null) : null
    const fallbackOffering = (input?.offeringId ? allOfferings.find(item => item.offId === input.offeringId) : null) ?? scopedFallbackOffering ?? uploadOffering ?? offering ?? assignedOfferings[0] ?? defaultOffering
    const selectedStudent = input?.studentId && fallbackOffering
      ? getStudentsPatched(fallbackOffering).find(student => student.id === input.studentId)
      : undefined
    const suggested = suggestTaskForStudent(selectedStudent)
    setTaskComposer({
      isOpen: true,
      step: 'details',
      offeringId: fallbackOffering?.offId,
      studentId: input?.studentId,
      taskType: input?.taskType ?? suggested.taskType,
      dueDateISO: input?.dueDateISO ?? suggested.dueDateISO,
      note: suggested.note,
      search: selectedStudent?.name ?? '',
      availableOfferingIds: input?.availableOfferingIds,
      placement: input?.placement,
    })
  }, [allOfferings, assignedOfferings, defaultOffering, getStudentsPatched, offering, uploadOffering])

  const handleRequestUnlock = useCallback((offeringId: string, kind: EntryKind) => {
    markRiskReevaluationPending()
    setPendingNoteAction({ type: 'unlock-request', offeringId, kind })
  }, [markRiskReevaluationPending])

  const handleCreateTask = useCallback((input: TaskCreateInput) => {
    markRiskReevaluationPending()
    const off = allOfferings.find(o => o.offId === input.offeringId)
    if (!off || !currentTeacher) return
    const s = getStudentsPatched(off).find(st => st.id === input.studentId)
    if (!s) return
    const id = `manual-${input.taskType}-${s.id}-${Date.now()}`
    const riskProb = s.riskProb ?? 0.45
    const title = `${input.taskType}: ${s.name.split(' ')[0]} (${off.code} Sec ${off.section})`
    const next: SharedTask = {
      id,
      studentId: s.id,
      studentName: s.name,
      studentUsn: s.usn,
      offeringId: off.offId,
      courseCode: off.code,
      courseName: off.title,
      year: off.year,
      riskProb,
      riskBand: (s.riskBand ?? 'Medium') as RiskBand,
      title,
      due: input.dueDateISO ? toDueLabel(input.dueDateISO, 'This week', proofVirtualDateISO) : (input.due || 'This week'),
      dueDateISO: input.dueDateISO,
      status: 'New',
      actionHint: input.note || `${input.taskType} task created from quick panel`,
      priority: Math.round(riskProb * 100),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: input.taskType,
      remedialPlan: input.remedialPlan,
      assignedTo: role,
      escalated: false,
      sourceRole: role,
      manual: true,
      requestNote: input.note,
      scheduleMeta: input.scheduleMeta,
      transitionHistory: [createTransition({
        action: 'Created',
        actorRole: role,
        actorTeacherId: currentTeacherId ?? undefined,
        fromOwner: role,
        toOwner: role,
        note: input.note || `${role} created ${input.taskType.toLowerCase()} queue item.`,
      })],
    }
    const placement = input.placement
      ? (input.placement.placementMode === 'timed' && typeof input.placement.startMinutes === 'number' && typeof input.placement.endMinutes === 'number' && currentFacultyTimetable
          ? buildPlacementForRange({
              taskId: id,
              dateISO: input.placement.dateISO,
              startMinutes: input.placement.startMinutes,
              endMinutes: input.placement.endMinutes,
              dayStartMinutes: currentFacultyTimetable.dayStartMinutes,
              dayEndMinutes: currentFacultyTimetable.dayEndMinutes,
            })
          : buildUntimedPlacement({ taskId: id, dateISO: input.placement.dateISO }))
      : undefined
    const nextTask = placement
      ? applyPlacementToTask(next, placement, proofVirtualDateISO)
      : next
    void repositories.tasks.upsertTask(nextTask)
    setAllTasksList(prev => [nextTask, ...prev])
    if (placement) {
      setTaskPlacements(prev => ({ ...prev, [id]: placement }))
      appendCalendarAudit(createCalendarAuditEvent({
        facultyId: currentTeacher.facultyId,
        actorRole: role,
        actorFacultyId: currentTeacherId ?? undefined,
        actionKind: 'task-created-and-scheduled',
        targetType: 'task',
        targetId: id,
        note: `Created ${next.title} directly from calendar/timetable.`,
        after: {
          dateISO: placement.dateISO,
          startMinutes: placement.startMinutes,
          endMinutes: placement.endMinutes,
          startTime: placement.startTime,
          endTime: placement.endTime,
          placementMode: placement.placementMode,
          offeringId: next.offeringId,
        },
      }))
    }
  }, [allOfferings, appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, getStudentsPatched, markRiskReevaluationPending, proofVirtualDateISO, repositories, role])

  const handleRemedialCheckIn = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || !task.remedialPlan) return task
      const nextPending = task.remedialPlan.steps.find(step => !step.completedAt)
      if (!nextPending) return task
      const updatedPlan: RemedialPlan = {
        ...task.remedialPlan,
        steps: task.remedialPlan.steps.map(step => step.id === nextPending.id ? { ...step, completedAt: Date.now() } : step),
      }
      const progress = getRemedialProgress(updatedPlan)
      const updatedTask: SharedTask = {
        ...task,
        remedialPlan: updatedPlan,
        status: progress.completed === progress.total ? 'Follow-up' : 'In Progress',
        updatedAt: Date.now(),
        actionHint: progress.completed === progress.total ? 'Remedial plan completed; monitor improvement in next cycle' : 'Remedial check-in logged and progress updated',
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({
          action: progress.completed === progress.total ? 'Remedial plan completed' : 'Remedial check-in logged',
          actorRole: role,
          actorTeacherId: currentTeacherId ?? undefined,
          fromOwner: task.assignedTo,
          toOwner: task.assignedTo,
          note: progress.completed === progress.total ? 'All remedial steps have been completed.' : 'One remedial step was marked complete.',
        })],
      }
      void repositories.tasks.upsertTask(updatedTask)
      return updatedTask
    }))
  }, [currentTeacherId, markRiskReevaluationPending, repositories, role])

  const submitUnlockRequest = useCallback((offeringId: string, kind: EntryKind, note: string) => {
    markRiskReevaluationPending()
    const off = allOfferings.find(o => o.offId === offeringId)
    if (!off) return
    const anchorStudent = getStudentsPatched(off)[0]
    const anchorStudentId = anchorStudent?.id.split('::').at(-1) ?? `${offeringId}-${kind}-lock`
    const id = `unlock-${offeringId}-${kind}`
    const requestedAt = Date.now()
    const transition = createTransition({
      action: 'Unlock requested',
      actorRole: role,
      actorTeacherId: currentTeacherId ?? undefined,
      fromOwner: role,
      toOwner: 'HoD',
      note,
    })
    appendLockAudit(offeringId, kind, transition)
    setResolvedTasks(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAllTasksList(prev => {
      const existing = prev.find(task => task.id === id)
      const nextTask: SharedTask = existing ? {
        ...existing,
        studentId: anchorStudentId,
        updatedAt: requestedAt,
        due: 'Today',
        status: 'New',
        assignedTo: 'HoD',
        taskType: 'Academic',
        escalated: true,
        sourceRole: role,
        actionHint: note,
        requestNote: note,
        handoffNote: note,
        unlockRequest: {
          offeringId,
          kind,
          status: 'Pending',
          requestedByRole: role,
          requestedByFacultyId: currentTeacherId ?? undefined,
          requestedAt,
          requestNote: note,
          handoffNote: note,
        },
        transitionHistory: [...(existing.transitionHistory ?? []), transition],
      } : {
        id,
        studentId: anchorStudentId,
        studentName: 'Class Data Lock',
        studentUsn: 'N/A',
        offeringId,
        courseCode: off.code,
        courseName: off.title,
        year: off.year,
        riskProb: 0.5,
        riskBand: 'Medium',
        title: `Unlock request: ${off.code} Sec ${off.section} · ${kind.toUpperCase()}`,
        due: 'Today',
        status: 'New',
        actionHint: note,
        priority: 80,
        createdAt: requestedAt,
        updatedAt: requestedAt,
        assignedTo: 'HoD',
        taskType: 'Academic',
        escalated: true,
        sourceRole: role,
        manual: true,
        requestNote: note,
        handoffNote: note,
        unlockRequest: {
          offeringId,
          kind,
          status: 'Pending',
          requestedByRole: role,
          requestedByFacultyId: currentTeacherId ?? undefined,
          requestedAt,
          requestNote: note,
          handoffNote: note,
        },
        transitionHistory: [transition],
      }
      void repositories.tasks.upsertTask(nextTask)
      return existing ? prev.map(task => task.id === id ? nextTask : task) : [nextTask, ...prev]
    })
  }, [allOfferings, appendLockAudit, currentTeacherId, getStudentsPatched, markRiskReevaluationPending, repositories, role])

  const submitStudentHandoff = useCallback((studentId: string, offeringId: string, mode: 'escalate' | 'mentor', note: string) => {
    markRiskReevaluationPending()
    const off = allOfferings.find(item => item.offId === offeringId)
    if (!off) return
    const student = getStudentsPatched(off).find(item => item.id === studentId)
    if (!student) return
    const id = `${mode}-${student.id}-${off.offId}`
    const createdAt = Date.now()
    const assignedTo: Role = mode === 'escalate' ? 'HoD' : 'Mentor'
    const title = mode === 'escalate'
      ? `Escalated: ${student.name.split(' ')[0]} requires HoD intervention`
      : `Mentor follow-up needed for ${student.name.split(' ')[0]}`
    const transition = createTransition({
      action: mode === 'escalate' ? 'Created and escalated to HoD' : 'Created and deferred to Mentor',
      actorRole: role,
      actorTeacherId: currentTeacherId ?? undefined,
      fromOwner: role,
      toOwner: assignedTo,
      note,
    })
    setResolvedTasks(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAllTasksList(prev => {
      const existing = prev.find(task => task.id === id)
      const nextTask: SharedTask = existing ? {
        ...existing,
        updatedAt: createdAt,
        assignedTo,
        escalated: mode === 'escalate',
        status: 'New',
        actionHint: note,
        requestNote: mode === 'escalate' ? note : existing.requestNote,
        handoffNote: note,
        transitionHistory: [...(existing.transitionHistory ?? []), transition],
      } : {
        id,
        studentId: student.id,
        studentName: student.name,
        studentUsn: student.usn,
        offeringId: off.offId,
        courseCode: off.code,
        courseName: off.title,
        year: off.year,
        riskProb: student.riskProb ?? 0.5,
        riskBand: (student.riskBand ?? 'Medium') as RiskBand,
        title,
        due: mode === 'escalate' ? 'Today' : 'This week',
        status: 'New',
        actionHint: note,
        priority: Math.round((student.riskProb ?? 0.5) * 100),
        createdAt,
        updatedAt: createdAt,
        assignedTo,
        taskType: mode === 'escalate' ? 'Academic' : 'Follow-up',
        escalated: mode === 'escalate',
        sourceRole: role,
        manual: true,
        requestNote: mode === 'escalate' ? note : undefined,
        handoffNote: note,
        transitionHistory: [transition],
      }
      void repositories.tasks.upsertTask(nextTask)
      return existing ? prev.map(task => task.id === id ? nextTask : task) : [nextTask, ...prev]
    })
  }, [allOfferings, currentTeacherId, getStudentsPatched, markRiskReevaluationPending, repositories, role])

  const commitTaskReassignment = useCallback((taskId: string, toRole: Role, note: string) => {
    markRiskReevaluationPending()
    setResolvedTasks(prev => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId) return task
      const nextTask: SharedTask = {
        ...task,
        assignedTo: toRole,
        escalated: toRole === 'HoD',
        updatedAt: Date.now(),
        status: 'New',
        actionHint: note,
        requestNote: toRole === 'HoD' ? note : task.requestNote,
        handoffNote: note,
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({
          action: toRole === 'HoD' ? 'Deferred to HoD' : toRole === 'Mentor' ? 'Deferred to Mentor' : `Returned to ${toRole}`,
          actorRole: role,
          actorTeacherId: currentTeacherId ?? undefined,
          fromOwner: task.assignedTo,
          toOwner: toRole,
          note,
        })],
      }
      void repositories.tasks.upsertTask(nextTask)
      return nextTask
    }))
  }, [currentTeacherId, markRiskReevaluationPending, repositories, role])

  const handleReassignTask = useCallback((taskId: string, toRole: Role) => {
    const task = allTasksList.find(item => item.id === taskId)
    if (!task) return
    setPendingNoteAction({
      type: 'reassign-task',
      taskId,
      toRole,
      title: task.title,
    })
  }, [allTasksList])

  const handleOpenStudentEscalation = useCallback((student: Student, currentOffering?: Offering) => {
    const resolvedOffering = currentOffering ?? allOfferings.find(item => getStudentsPatched(item).some(candidate => candidate.id === student.id))
    if (!resolvedOffering) return
    setPendingNoteAction({
      type: 'student-handoff',
      mode: 'escalate',
      studentId: student.id,
      offeringId: resolvedOffering.offId,
      title: `Escalate ${student.name} to HoD`,
    })
  }, [allOfferings, getStudentsPatched])

  const handleOpenStudentMentorHandoff = useCallback((student: Student, currentOffering?: Offering) => {
    const resolvedOffering = currentOffering ?? allOfferings.find(item => getStudentsPatched(item).some(candidate => candidate.id === student.id))
    if (!resolvedOffering) return
    setPendingNoteAction({
      type: 'student-handoff',
      mode: 'mentor',
      studentId: student.id,
      offeringId: resolvedOffering.offId,
      title: `Defer ${student.name} to Mentor`,
    })
  }, [allOfferings, getStudentsPatched])

  const handleSubmitRequiredNote = useCallback((note: string) => {
    const action = pendingNoteAction
    if (!action) return
    if (action.type === 'unlock-request') submitUnlockRequest(action.offeringId, action.kind, note)
    if (action.type === 'reassign-task') commitTaskReassignment(action.taskId, action.toRole, note)
    if (action.type === 'student-handoff') submitStudentHandoff(action.studentId, action.offeringId, action.mode, note)
    setPendingNoteAction(null)
  }, [commitTaskReassignment, pendingNoteAction, submitStudentHandoff, submitUnlockRequest])

  const handleSaveScheme = useCallback((offId: string, next: SchemeState) => {
    markRiskReevaluationPending()
    const offeringForScheme = allOfferings.find(item => item.offId === offId) ?? defaultOffering ?? allOfferings[0]
    setSchemeByOffering(prev => ({
      ...prev,
      [offId]: normalizeSchemeState({
        ...next,
        status: hasEntryStartedForOffering(offId) ? 'Locked' : next.status,
        lastEditedBy: role,
      }, offeringForScheme),
    }))
    setPage('upload')
  }, [allOfferings, defaultOffering, hasEntryStartedForOffering, markRiskReevaluationPending, role])

  const handleApproveUnlock = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    setAllTasksList(prev => prev.map(task => task.id === taskId ? ({
      ...task,
      updatedAt: Date.now(),
      status: 'In Progress',
      resolvedByFacultyId: currentTeacherId ?? undefined,
      unlockRequest: task.unlockRequest ? {
        ...task.unlockRequest,
        status: 'Approved',
        reviewedAt: Date.now(),
        reviewNote: 'HoD approved a controlled correction cycle.',
      } : task.unlockRequest,
      transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Unlock approved', actorRole: 'HoD', actorTeacherId: currentTeacherId ?? undefined, fromOwner: 'HoD', toOwner: 'HoD', note: 'Request approved pending explicit reset/unlock.' })],
    }) : task))
  }, [currentTeacherId, markRiskReevaluationPending])

  const handleRejectUnlock = useCallback((taskId: string) => {
    markRiskReevaluationPending()
    setAllTasksList(prev => prev.map(task => task.id === taskId ? ({
      ...task,
      updatedAt: Date.now(),
      status: 'Resolved',
      resolvedByFacultyId: currentTeacherId ?? undefined,
      unlockRequest: task.unlockRequest ? {
        ...task.unlockRequest,
        status: 'Rejected',
        reviewedAt: Date.now(),
        reviewNote: 'HoD rejected the unlock request.',
      } : task.unlockRequest,
      transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Unlock rejected', actorRole: 'HoD', actorTeacherId: currentTeacherId ?? undefined, fromOwner: 'HoD', toOwner: 'HoD', note: 'Lock remains in effect.' })],
    }) : task))
    setResolvedTasks(prev => ({ ...prev, [taskId]: Date.now() }))
  }, [currentTeacherId, markRiskReevaluationPending])

  const handleResetComplete = useCallback(async (taskId: string) => {
    markRiskReevaluationPending()
    const task = allTasksList.find(item => item.id === taskId)
    if (!task?.unlockRequest) return
    const unlockKind = task.unlockRequest.kind
    // GAP-3: Must clear the DB lock column BEFORE updating local state.
    // Without this, the teacher's next submission still hits `sectionOfferings.tt1Locked = 1`
    // and gets forbidden — the runtime blob alone is not checked by the commit route.
    try {
      await repositories.locksAudit.clearRemoteLock(task.offeringId, unlockKind)
    } catch (clearError) {
      console.error('[handleResetComplete] Failed to clear remote lock — unlock aborted', clearError)
      return
    }
    appendLockAudit(task.offeringId, unlockKind, createTransition({
      action: 'Reset completed and unlocked',
      actorRole: 'HoD',
      actorTeacherId: currentTeacherId ?? undefined,
      fromOwner: 'HoD',
      toOwner: task.sourceRole === 'Mentor' ? 'Mentor' : 'Course Leader',
      note: 'Entry dataset is unlocked for correction.',
    }))
    setLockByOffering(prev => ({
      ...prev,
      [task.offeringId]: {
        ...(prev[task.offeringId] ?? getEntryLockMap(allOfferings.find(o => o.offId === task.offeringId) ?? defaultOffering ?? allOfferings[0])),
        [unlockKind]: false,
      },
    }))
    setSchemeByOffering(prev => prev[task.offeringId] ? ({
      ...prev,
      [task.offeringId]: {
        ...prev[task.offeringId],
        status: 'Configured',
      },
    }) : prev)
    setAllTasksList(prev => prev.map(item => item.id === taskId ? ({
      ...item,
      updatedAt: Date.now(),
      status: 'Resolved',
      resolvedByFacultyId: currentTeacherId ?? undefined,
      unlockRequest: item.unlockRequest ? {
        ...item.unlockRequest,
        status: 'Reset Completed',
        reviewedAt: Date.now(),
        reviewNote: 'Reset completed and entry unlocked for correction.',
      } : item.unlockRequest,
      transitionHistory: [...(item.transitionHistory ?? []), createTransition({ action: 'Reset completed and unlocked', actorRole: 'HoD', actorTeacherId: currentTeacherId ?? undefined, fromOwner: 'HoD', toOwner: item.sourceRole === 'Mentor' ? 'Mentor' : 'Course Leader', note: 'Entry dataset is unlocked for correction.' })],
    }) : item))
    setResolvedTasks(prev => ({ ...prev, [taskId]: Date.now() }))
  }, [allOfferings, allTasksList, appendLockAudit, currentTeacherId, defaultOffering, markRiskReevaluationPending, repositories])

  const handleOpenTaskStudent = useCallback((task: SharedTask) => {
    const taskScopeIds = new Set(getMenteeScopeIds(task.studentId.split('::').at(-1) ?? task.studentId))
    const mentorMatch = assignedMentees.find(mentee => mentee.usn === task.studentUsn || taskScopeIds.has(mentee.id))
    if (mentorMatch && role === 'Mentor') {
      setSelectedMentee(mentorMatch)
      setPage('mentee-detail')
      return
    }
    const searchableOfferings = role === 'HoD' ? allOfferings : assignedOfferings
    const target = findStudentProfileLaunchTarget({
      studentId: task.studentId,
      offeringId: task.offeringId,
      offerings: searchableOfferings,
      getStudentsForOffering: getStudentsPatched,
    })
    if (target) {
      handleOpenStudent(target.student, target.offering)
      return
    }
    if (mentorMatch) {
      const nextHistory = buildHistoryProfile({ mentee: mentorMatch, historyByUsn: studentHistoryByUsn })
      if (nextHistory) {
        setHistoryProfile(nextHistory)
        setHistoryBackPage(page)
        setPage('student-history')
      }
    }
  }, [allOfferings, assignedMentees, assignedOfferings, getStudentsPatched, handleOpenStudent, page, role, studentHistoryByUsn])

  const pendingNoteMeta = useMemo(() => {
    if (!pendingNoteAction) return null
    if (pendingNoteAction.type === 'unlock-request') {
      const off = allOfferings.find(item => item.offId === pendingNoteAction.offeringId)
      return {
        title: `Request unlock for ${off?.code ?? 'offering'} ${pendingNoteAction.kind.toUpperCase()}`,
        description: 'Add the teacher note that should travel with this unlock request to the HoD queue.',
        submitLabel: 'Send Unlock Request',
      }
    }
    if (pendingNoteAction.type === 'reassign-task') {
      return {
        title: `Reassign queue item to ${pendingNoteAction.toRole}`,
        description: `Add the handoff note that the next owner should see for "${pendingNoteAction.title}".`,
        submitLabel: 'Confirm Reassignment',
      }
    }
    const off = allOfferings.find(item => item.offId === pendingNoteAction.offeringId)
    return {
      title: pendingNoteAction.mode === 'escalate' ? 'Escalate student to HoD' : 'Defer student to Mentor',
      description: `Add the sender note for ${off?.code ?? 'the selected class'} so the receiving owner sees the full context.`,
      submitLabel: pendingNoteAction.mode === 'escalate' ? 'Escalate with Note' : 'Defer with Note',
    }
  }, [allOfferings, pendingNoteAction])

  if (!currentTeacher) {
    return (
      <AcademicFacultyContextUnavailableState
        onLogout={() => { void onLogout() }}
        onBackToPortal={exitToPortal}
      />
    )
  }

  const handleLogout = () => {
    clearRouteHistory()
    setOffering(null)
    setSelectedStudent(null)
    setSelectedMentee(null)
    setHistoryProfile(null)
    setSelectedUnlockTaskId(null)
    setSchemeOfferingId(null)
    setCourseInitialTab(undefined)
    setHistoryBackPage(null)
    setTaskComposer(prev => ({ ...prev, isOpen: false, placement: undefined, availableOfferingIds: undefined }))
    setPendingNoteAction(null)
    void onLogout()
  }

  const sidebarToggleLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const routeLoadingLabel = page === 'course'
    ? 'Loading course workspace...'
    : page === 'calendar'
      ? 'Loading calendar workspace...'
    : page === 'student-shell'
      ? 'Loading student shell...'
      : page === 'risk-explorer'
      ? 'Loading risk explorer...'
      : page === 'upload' || page === 'entry-workspace' || page === 'scheme-setup'
        ? 'Loading entry workflow...'
      : page === 'department'
        ? 'Loading department view...'
        : 'Loading workspace...'

  const selectedMenteeHistory = selectedMentee ? buildHistoryProfile({ mentee: selectedMentee, historyByUsn: studentHistoryByUsn }) : null
  const selectedUnlockTaskOffering = selectedUnlockTask ? allOfferings.find(item => item.offId === selectedUnlockTask.offeringId) ?? null : null
  const handleOpenStudentShellFromHistory = (studentId: string) => handleOpenStudentShell(studentId, historyBackPage ?? page)
  const handleOpenRiskExplorerFromHistory = (studentId: string) => handleOpenRiskExplorer(studentId, historyBackPage ?? page)
  const academicWorkspace = {
    role,
    page,
    currentTeacher,
    facultyProfile,
    facultyProfileLoading,
    facultyProfileError,
    currentFacultyCalendarMarkers,
    pendingActionCount,
    assignedOfferings,
    filteredCurrentFacultyTimetable,
    handleOpenFacultyProfile: () => setPage('faculty-profile'),
    greetingHeadline,
    greetingMeta,
    greetingSubline,
    handleNavigateBack,
    handleOpenStudentProfile,
    handleOpenStudentShell,
    handleOpenRiskExplorer,
    handleOpenCourse,
    handleOpenStudent,
    handleOpenStudents,
    handleOpenUpload,
    handleOpenCalendar,
    handleToggleActionQueue,
    handleOpenHistoryFromStudent,
    handleOpenHistoryFromMentee,
    courseInitialTab,
    offering,
    selectedSchemeOffering,
    schemeByOffering,
    defaultSchemeForOffering,
    lockByOffering,
    ttBlueprintsByOffering,
    getEntryLockMap,
    getFallbackBlueprintSet,
    academicBootstrap,
    studentHistoryByUsn,
    handleUpdateBlueprint,
    handleOpenEntryHub,
    handleOpenSchemeSetup,
    hasEntryStartedForOffering,
    handleSaveScheme,
    allowedRoles,
    calendarOfferings,
    mergedCalendarTasks,
    calendarMeetings,
    resolvedTasks,
    taskPlacements,
    handleScheduleTask,
    handleUpdateMeeting,
    handleMoveClassBlock,
    handleResizeClassBlock,
    handleEditClassTiming,
    handleCreateExtraClass,
    handleOpenTaskComposer,
    handleOpenCourseFromCalendar,
    handleOpenActionQueueFromCalendar,
    handleUpdateTimetableBounds,
    handleDismissTask,
    handleDismissSeries,
    uploadOffering,
    uploadKind,
    handleOpenWorkspace,
    handleRequestUnlock,
    entryOfferingId,
    entryKind,
    draftBySection,
    handleSaveDraft,
    handleSubmitLock,
    cellValues,
    handleCellValueChange,
    handleUpdateStudentAttendance,
    lockAuditByTarget,
    capabilities,
    roleTasks,
    handleOpenTaskStudent,
    handleOpenUnlockReview,
    handleRestoreTask,
    assignedMentees,
    selectedMentee,
    selectedMenteeHistory,
    handleOpenMentee,
    allTasksList,
    calendarAuditEvents,
    hodProofAnalytics,
    hodProofLoading,
    hodProofError,
    loadHodProofCounterfactual,
    loadHodProofCounterfactualSimulator,
    handleOpenQueueHistory,
    selectedUnlockTask,
    selectedUnlockTaskOffering,
    handleApproveUnlock,
    handleRejectUnlock,
    handleResetComplete,
    historyProfile,
    historyStudentId,
    studentShellStudentId,
    handleOpenStudentShellFromHistory,
    handleOpenRiskExplorerFromHistory,
    loadStudentAgentCard,
    loadStudentAgentTimeline,
    startStudentAgentSession,
    sendStudentAgentMessage,
    loadStudentRiskExplorer,
    handleCommitDemoAttendanceEdit,
    handleRecomputeProofRunRisk: onRecomputeProofRunRisk,
    handleResolveProofReassessment: onResolveProofReassessment,
    handleAdvanceProofRun: onAdvanceProofRun,
    handleStopProofRun: onStopProofRun,
    handleStepProofPlayback: onStepProofPlayback,
  }

  return (
    <AppSelectorsContext.Provider value={selectors}>
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg, color: T.text, overflowX: 'hidden' }}>
      <AcademicWorkspaceTopbar
        themeMode={themeMode}
        isCompactTopbar={isCompactTopbar}
        sidebarCollapsed={sidebarCollapsed}
        sidebarToggleLabel={sidebarToggleLabel}
        allowedRoles={allowedRoles}
        role={role}
        roleChangeBusy={roleChangeBusy}
        isReevaluatingRisk={isReevaluatingRisk}
        canNavigateBack={canNavigateBack}
        formattedCurrentTime={formattedCurrentTime}
        showActionQueue={showActionQueue}
        pendingActionCount={pendingActionCount}
        onGoHome={handleGoHome}
        onToggleSidebar={() => setSidebarCollapsed(current => !current)}
        onRoleChange={handleRoleChange}
        onNavigateBack={handleNavigateBack}
        onToggleTheme={() => setThemeMode(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')}
        onToggleActionQueue={handleToggleActionQueue}
        onLogout={handleLogout}
      />

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="app-main" style={{ display: 'flex', flex: 1, minWidth: 0, position: 'relative' }}>
        <AcademicWorkspaceSidebar
          currentTeacher={currentTeacher}
          role={role}
          page={page}
          historyBackPage={historyBackPage}
          navItems={navItems}
          sidebarYearGroups={sidebarYearGroups}
          sidebarCompletenessRows={sidebarCompletenessRows}
          sidebarCollapsed={sidebarCollapsed}
          sidebarToggleLabel={sidebarToggleLabel}
          isCompactTopbar={isCompactTopbar}
          onOpenFacultyProfile={() => setPage('faculty-profile')}
          onSelectNavItem={nextPage => {
            setPage(nextPage)
            setOffering(null)
          }}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          onCollapseSidebar={() => setSidebarCollapsed(true)}
        />

        <AcademicWorkspaceRouteSurface
          workspace={academicWorkspace}
          layoutMode={layoutMode}
          proofPlaybackNotice={proofPlaybackNotice}
          routeError={roleChangeError}
          routeLoadingLabel={routeLoadingLabel}
          onResetProofPlaybackSelection={onResetProofPlaybackSelection}
        />

        {/* Right Sidebar — Action Queue */}
        <AnimatePresence>
          {showActionQueue && (
            <motion.div
              ref={actionQueueRef}
              initial={{ width: 0, opacity: 0, x: 24 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <ActionQueue role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} simulatedDateISO={proofVirtualDateISO} onResolveTask={handleResolveTask} onUndoTask={handleUndoTask} onOpenTaskComposer={handleOpenTaskComposer} onRemedialCheckIn={handleRemedialCheckIn} onOpenStudent={handleOpenTaskStudent} onReassignTask={handleReassignTask} onOpenUnlockReview={handleOpenUnlockReview} onOpenQueueHistory={handleOpenQueueHistory} onApproveUnlock={handleApproveUnlock} onRejectUnlock={handleRejectUnlock} onResetComplete={handleResetComplete} onToggleSchedulePause={handleToggleSchedulePause} onEditSchedule={handleEditSchedule} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ STUDENT DRAWER ═══ */}
      <AnimatePresence>
        {selectedStudent && (() => {
          const matchingQueueItem = facultyProfile?.proofOperations.monitoringQueue.find(item => item.studentId === selectedStudent.id || item.studentId === selectedStudent.id.split('::').at(-1))
          const coreMetricsOverride = matchingQueueItem ? coreMetricsFromFacultyQueueItem(matchingQueueItem) : null

          return (
            <StudentDrawer student={selectedStudent} offering={selectedOffering || undefined} historyByUsn={studentHistoryByUsn} role={role} meetings={academicMeetings} proofStageKey={academicBootstrap?.proofPlayback?.stageKey} coreMetricsOverride={coreMetricsOverride} onClose={() => { setSelectedStudent(null); setSelectedOffering(null) }} onEscalate={handleOpenStudentEscalation} onOpenTaskComposer={(s, o, taskType) => {
              const resolvedOffering = o ?? allOfferings.find(item => getStudentsPatched(item).some(candidate => candidate.id === s.id))
              handleOpenTaskComposer({ offeringId: resolvedOffering?.offId, studentId: s.id, taskType })
            }} onAssignToMentor={handleOpenStudentMentorHandoff} onOpenHistory={handleOpenHistoryFromStudent} onOpenStudentShell={studentId => handleOpenStudentShell(studentId, page)} onOpenRiskExplorer={studentId => handleOpenRiskExplorer(studentId, page)} onScheduleMeeting={handleScheduleMeeting} />
          )
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {taskComposer.isOpen && (
          <TaskComposerModal role={role} offerings={taskComposerOfferings} initialState={taskComposer} onClose={() => setTaskComposer(prev => ({ ...prev, isOpen: false, placement: undefined, availableOfferingIds: undefined }))} onSubmit={handleCreateTask} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingNoteAction && pendingNoteMeta && (
          <RequiredNoteModal title={pendingNoteMeta.title} description={pendingNoteMeta.description} submitLabel={pendingNoteMeta.submitLabel} onClose={() => setPendingNoteAction(null)} onSubmit={handleSubmitRequiredNote} />
        )}
      </AnimatePresence>

    </div>
    </AppSelectorsContext.Provider>
  )
}
