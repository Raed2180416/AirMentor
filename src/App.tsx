import { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  LayoutDashboard, ListTodo, Mail, Phone, Search, Shield, Upload, Users, X,
  AlertTriangle, TrendingDown, BookOpen, Target, Activity, Eye, MessageSquare,
} from 'lucide-react'
import {
  CO_COLORS, T, mono, sora, yearColor,
  PROFESSOR, OFFERINGS, YEAR_GROUPS, PAPER_MAP,
  FACULTY, generateTasks, MENTEES, getStudentHistoryRecord, hydrateAcademicData,
  type Offering, type Student, type YearGroup,
  type Mentee, type StudentHistoryRecord,
} from './data'
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
  type ScheduleMeta,
  type SchedulePreset,
  type SchemeState,
  type SharedTask,
  type StudentRuntimePatch,
  type TaskCalendarPlacement,
  type TaskPlacementMode,
  type TaskType,
  type TermTestBlueprint,
  type ThemeMode,
  type TTKind,
  type Weekday,
} from './domain'
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
} from './calendar-utils'
import {
  AppSelectorsContext,
  defaultSchemeForOffering,
  flattenBlueprintLeaves,
  getEntryLockMap,
  normalizeBlueprint,
  normalizeSchemeState,
  pruneScoreMap,
  seedBlueprintFromPaper,
  toStudentPatchKey,
  useAppSelectors,
  createAppSelectors,
  isPatchEmpty,
} from './selectors'
import { inferKindFromPendingAction, toCellKey } from './page-utils'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories, type AirMentorRepositories } from './repositories'
import { PortalEntryScreen } from './portal-entry'
import { clearPortalWorkspaceHints, getPortalHash, hashBelongsToPortalRoute, navigateToPortal, resolvePortalRoute, type PortalRoute } from './portal-routing'
import { SystemAdminApp } from './system-admin-app'
import { InfoBanner, MetricCard } from './system-admin-ui'
import { applyThemePreset, isLightTheme } from './theme'
import {
  Bar,
  BrandMark,
  Btn,
  Card,
  Chip,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  ModalWorkspace,
  PageBackButton,
  PageShell,
  RiskBadge,
  StagePips,
  UI_FONT_SIZES,
  UI_TRANSITION_FAST,
  UI_TRANSITION_MEDIUM,
  getFieldChromeStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
} from './ui-primitives'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type { ApiAcademicBootstrap, ApiAcademicFacultyProfile, ApiAcademicLoginFaculty, ApiAdminCalendarMarker, ApiSessionResponse } from './api/types'
import './App.css'

const LazyCourseDetail = lazy(() => import('./pages/course-pages').then(module => ({ default: module.CourseDetail })))
const LazyAllStudentsPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.AllStudentsPage })))
const LazyStudentHistoryPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.StudentHistoryPage })))
const LazySchemeSetupPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.SchemeSetupPage })))
const LazyUploadPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.UploadPage })))
const LazyEntryWorkspacePage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.EntryWorkspacePage })))
const LazyHodView = lazy(() => import('./pages/hod-pages').then(module => ({ default: module.HodView })))
const LazyCalendarTimetablePage = lazy(() => import('./pages/calendar-pages').then(module => ({ default: module.CalendarTimetablePage })))

type TaskPlacementDraft = {
  dateISO: string
  placementMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

type TaskComposerState = {
  isOpen: boolean
  step: 'details' | 'remedial'
  offeringId?: string
  studentId?: string
  taskType: TaskType
  dueDateISO: string
  note: string
  search: string
  availableOfferingIds?: string[]
  placement?: TaskPlacementDraft
}

type NoteActionState =
  | { type: 'unlock-request'; offeringId: string; kind: EntryKind }
  | { type: 'reassign-task'; taskId: string; toRole: Role; title: string }
  | { type: 'student-handoff'; mode: 'escalate' | 'mentor'; studentId: string; offeringId: string; title: string }

type TaskCreateInput = {
  offeringId: string
  studentId: string
  taskType: TaskType
  due?: string
  dueDateISO?: string
  note?: string
  remedialPlan?: RemedialPlan
  scheduleMeta?: ScheduleMeta
  placement?: TaskPlacementDraft
}

type PageId = 'dashboard' | 'students' | 'course' | 'calendar' | 'upload' | 'entry-workspace' | 'mentees' | 'department' | 'mentee-detail' | 'student-history' | 'unlock-review' | 'scheme-setup' | 'queue-history' | 'faculty-profile'

type RouteSnapshot = {
  page: PageId
  offeringId: string | null
  uploadOfferingId: string | null
  uploadKind: EntryKind
  entryOfferingId: string
  entryKind: EntryKind
  selectedMenteeId: string | null
  historyProfile: StudentHistoryRecord | null
  historyBackPage: PageId | null
  selectedUnlockTaskId: string | null
  schemeOfferingId: string | null
  courseInitialTab?: string
}

const CLASS_SNAP_THRESHOLD_MINUTES = 14

function RouteLoadingFallback({ label = 'Loading workspace...' }: { label?: string }) {
  return (
    <PageShell size="standard">
      <Card style={{ maxWidth: 420, marginTop: 24 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 6 }}>Preparing page</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{label}</div>
      </Card>
    </PageShell>
  )
}

function getHomePage(role: Role): PageId {
  return role === 'Course Leader' ? 'dashboard' : role === 'Mentor' ? 'mentees' : 'department'
}

function canAccessPage(role: Role, page: PageId) {
  if (page === 'student-history' || page === 'queue-history' || page === 'faculty-profile') return true
  if (page === 'scheme-setup') return role === 'Course Leader'
  if (page === 'unlock-review') return role === 'HoD'
  if (page === 'mentee-detail') return role === 'Mentor'
  if (role === 'Course Leader') return ['dashboard', 'students', 'course', 'calendar', 'upload', 'entry-workspace'].includes(page)
  if (role === 'Mentor') return ['mentees', 'calendar'].includes(page)
  return ['department', 'course', 'calendar', 'unlock-review'].includes(page)
}

function getRouteSnapshotKey(snapshot: RouteSnapshot) {
  return [
    snapshot.page,
    snapshot.offeringId ?? '',
    snapshot.uploadOfferingId ?? '',
    snapshot.uploadKind,
    snapshot.entryOfferingId,
    snapshot.entryKind,
    snapshot.selectedMenteeId ?? '',
    snapshot.historyProfile?.usn ?? '',
    snapshot.historyBackPage ?? '',
    snapshot.selectedUnlockTaskId ?? '',
    snapshot.schemeOfferingId ?? '',
    snapshot.courseInitialTab ?? '',
  ].join('|')
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function describeCalendarMarkerType(markerType: ApiAdminCalendarMarker['markerType']) {
  if (markerType === 'semester-start') return 'Semester Start'
  if (markerType === 'semester-end') return 'Semester End'
  if (markerType === 'term-test-start') return 'Term Test Start'
  if (markerType === 'term-test-end') return 'Term Test End'
  if (markerType === 'holiday') return 'Holiday'
  return 'Event'
}

function getLatestTransition(task: SharedTask) {
  const history = task.transitionHistory ?? []
  return history[history.length - 1]
}

function buildHistoryProfile(input: { student?: Student | null; mentee?: Mentee | null; offering?: Offering | null }): StudentHistoryRecord | null {
  if (input.student) {
    return getStudentHistoryRecord({
      usn: input.student.usn,
      studentName: input.student.name,
      dept: input.offering?.dept ?? 'CSE',
      yearLabel: input.offering?.year,
      prevCgpa: input.student.prevCgpa,
    })
  }
  if (input.mentee) {
    return getStudentHistoryRecord({
      usn: input.mentee.usn,
      studentName: input.mentee.name,
      dept: input.mentee.dept,
      yearLabel: input.mentee.year,
      prevCgpa: input.mentee.prevCgpa,
    })
  }
  return null
}

function parseTimeToMinutes(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback
  return (hours * 60) + minutes
}

function AuthFieldLabel({ children }: { children: string }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function AuthNotice({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' | 'success' }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 10, padding: '10px 12px' }}>{message}</div>
}

function AuthHeroPill({ children, color = T.accent }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  )
}

function AuthHeroFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${T.accent}16, transparent 28%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), linear-gradient(180deg, ${T.bg}, ${T.surface2})`,
        padding: 'clamp(18px, 3vw, 30px)',
      }}
    >
      <PageShell size="wide" style={{ paddingTop: 12 }}>
        {children}
      </PageShell>
    </div>
  )
}

function LoginPage({
  facultyOptions = FACULTY.map(faculty => ({
    facultyId: faculty.facultyId,
    username: faculty.facultyId,
    name: faculty.name,
    displayName: faculty.name,
    designation: faculty.roleTitle,
    dept: faculty.dept,
    departmentCode: faculty.dept,
    roleTitle: faculty.roleTitle,
    allowedRoles: faculty.allowedRoles,
  })),
  helperText = '',
  modeLabel = 'Teaching Workspace',
  heroBody = 'Use the academic portal for course delivery, mentor follow-up, grading operations, and timetable-aware teaching workflows.',
  busy = false,
  externalError = '',
  onBackToPortal,
  onLogin,
}: {
  facultyOptions?: ApiAcademicLoginFaculty[]
  helperText?: string
  modeLabel?: string
  heroBody?: string
  busy?: boolean
  externalError?: string
  onBackToPortal?: () => void
  onLogin: (identifier: string, password: string) => Promise<void> | void
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const selectedOption = useMemo(() => {
    const key = identifier.trim().toLowerCase()
    if (!key) return null
    return facultyOptions.find(option => option.username.toLowerCase() === key) ?? null
  }, [facultyOptions, identifier])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) {
      setErr('Username is required.')
      return
    }
    try {
      setErr('')
      await onLogin(identifier.trim(), password)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Login failed')
    }
  }

  return (
    <AuthPageShell>
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
        <Card
          style={{
            padding: 28,
            background: `radial-gradient(circle at top left, ${T.success}22, transparent 34%), radial-gradient(circle at 82% 86%, ${T.accent}18, transparent 28%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
            display: 'grid',
            alignContent: 'space-between',
            minHeight: 520,
          }}
          glow={T.success}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <AuthHeroPill color={T.success}>
              <BookOpen size={12} />
              {modeLabel}
            </AuthHeroPill>
            <div>
              <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>
                Teach, mentor, and run daily academic operations from one place.
              </div>
              <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>
                {heroBody}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <AuthHeroFeature title="Teaching" body="Course leaders should immediately see classes, offerings, evaluation setup limits, and entry workflows without hunting through role-specific dead ends." color={T.success} />
              <AuthHeroFeature title="Mentoring" body="Mentors need fast access to student history, intervention queues, and escalation context, with academic records linked back to the right batch and semester." color={T.accent} />
              <AuthHeroFeature title="Scheduling" body="Faculty should manage weekly execution cleanly while still seeing the default timetable, temporary exceptions, and the permanent-change request path." color={T.orange} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the system-admin workspace instead? Return to the portal selector and switch context there.</div>
            {onBackToPortal ? (
              <Btn variant="ghost" onClick={onBackToPortal} disabled={busy}>
                Portal Selector
              </Btn>
            ) : null}
          </div>
        </Card>

        <Card style={{ padding: 28, display: 'grid', alignContent: 'space-between', minHeight: 520, background: `radial-gradient(circle at top right, ${T.success}12, transparent 28%), radial-gradient(circle at bottom left, ${T.accent}10, transparent 24%), linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>
            <div style={{ ...mono, fontSize: 10, color: T.success, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
            <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to enter the teaching workspace.</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>
              Sign in using your username and password. {helperText}
            </div>

            <form onSubmit={event => { void handleSubmit(event) }} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              <div>
                <AuthFieldLabel>Username</AuthFieldLabel>
                <AuthInput
                  id="teacher-username"
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  disabled={busy}
                  placeholder="e.g. kavitha.rao"
                  autoComplete="username"
                />
              </div>

              {selectedOption ? (
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 4 }}>Selected profile</div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{selectedOption.displayName || selectedOption.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                    {`${selectedOption.departmentCode ?? selectedOption.dept ?? 'Faculty'}${selectedOption.designation ? ` · ${selectedOption.designation}` : selectedOption.roleTitle ? ` · ${selectedOption.roleTitle}` : ''}${selectedOption.allowedRoles?.length ? ` · ${selectedOption.allowedRoles.join(' / ')}` : ` · Faculty ID ${selectedOption.facultyId}`}`}
                  </div>
                </div>
              ) : null}

              <div>
                <AuthFieldLabel>Password</AuthFieldLabel>
                <AuthInput id="teacher-password" type="password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} placeholder="••••••••" autoComplete="current-password" />
              </div>

              {err ? <AuthNotice message={err} tone="error" /> : null}
              {!!externalError ? <AuthNotice message={externalError} tone="error" /> : null}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                {onBackToPortal ? (
                  <Btn type="button" variant="ghost" onClick={onBackToPortal} disabled={busy}>
                    Back To Portal
                  </Btn>
                ) : <span />}
                <Btn type="submit" disabled={busy}>
                  <Shield size={14} />
                  {busy ? 'Signing In...' : 'Sign In'}
                </Btn>
              </div>
            </form>
          </div>

          <div style={{ width: '100%', maxWidth: 680, margin: '24px auto 0', borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface2, padding: '14px 16px' }}>
            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>After Sign-In</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
              The workspace restores your role-aware context, current teaching assignments, and the linked mentoring views that belong to the selected faculty profile.
            </div>
          </div>
        </Card>
      </div>
    </AuthPageShell>
  )
}

function FacultyProfilePage({
  currentTeacher,
  activeRole,
  profile,
  calendarMarkers,
  loading,
  error,
  pendingTaskCount,
  assignedOfferings,
  currentFacultyTimetable,
  onBack,
}: {
  currentTeacher: FacultyAccount
  activeRole: Role
  profile: ApiAcademicFacultyProfile | null
  calendarMarkers: ApiAdminCalendarMarker[]
  loading: boolean
  error: string
  pendingTaskCount: number
  assignedOfferings: Offering[]
  currentFacultyTimetable: FacultyTimetableTemplate | null
  onBack: () => void
}) {
  const livePermissions = profile?.permissions.filter(item => item.status === 'active') ?? []
  const effectivePermissions = (livePermissions.length > 0
    ? Array.from(new Set(livePermissions.map(item => item.roleCode)))
    : currentTeacher.allowedRoles
  ).filter(permission => permission !== 'SYSTEM_ADMIN')
  const effectiveDepartment = profile?.primaryDepartment?.name ?? currentTeacher.dept
  const effectivePhone = profile?.phone ?? 'Not set'
  const employeeCode = profile?.employeeCode ?? 'Not available'
  const timetableWindow = profile?.timetableStatus.directEditWindowEndsAt
    ? new Date(profile.timetableStatus.directEditWindowEndsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const upcomingMarkers = [...calendarMarkers]
    .sort((left, right) => {
      if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
      return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    })
    .slice(0, 5)
  const displayPermission = (permission: string) => {
    if (permission === 'COURSE_LEADER') return 'Course Leader'
    if (permission === 'SYSTEM_ADMIN') return 'System Admin'
    if (permission === 'HOD') return 'HoD'
    if (permission === 'MENTOR') return 'Mentor'
    return permission
  }

  return (
    <PageShell size="standard">
      <div style={{ display: 'grid', gap: 16, paddingTop: 18, paddingBottom: 26 }}>
        <PageBackButton onClick={onBack} />

        <Card style={{ padding: 20, display: 'grid', gap: 14, background: `linear-gradient(160deg, ${T.surface}, ${T.surface2})` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Teaching Profile</div>
              <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 8 }}>{profile?.displayName ?? currentTeacher.name}</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>
                Inspect-first faculty profile powered by the system-admin master record when available. Operational edits still happen in their existing teaching or admin workflows.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip color={T.accent}>{activeRole}</Chip>
              {effectivePermissions.map(permission => <Chip key={permission} color={T.success}>{permission}</Chip>)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <MetricCard label="Primary Department" value={effectiveDepartment} helper="Current teaching-side home context." />
            <MetricCard label="Designation" value={profile?.designation ?? currentTeacher.roleTitle} helper="Admin-managed teaching title and academic responsibility label." />
            <MetricCard label="Employee Code" value={employeeCode} helper="Read-only faculty identity key from the admin master record." />
            <MetricCard label="Email" value={profile?.email ?? currentTeacher.email} helper="Read-only identity field from the faculty record." />
            <MetricCard label="Phone" value={effectivePhone} helper="Shown here so faculty can verify admin-owned contact data." />
            <MetricCard label="Queue Items" value={String(pendingTaskCount)} helper="Current action queue count for this faculty context." />
          </div>
        </Card>

        {loading ? <InfoBanner message="Loading faculty profile..." /> : null}
        {error ? <InfoBanner tone="error" message={error} /> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Permissions</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {effectivePermissions.length > 0 ? effectivePermissions.map(permission => <Chip key={permission} color={T.accent}>{displayPermission(permission)}</Chip>) : <Chip color={T.dim}>No permissions</Chip>}
            </div>
            {profile?.permissions?.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').length ? profile.permissions.filter(permission => permission.roleCode !== 'SYSTEM_ADMIN').map(permission => (
              <Card key={permission.grantId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{displayPermission(permission.roleCode)}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {(permission.scopeLabel ?? `${permission.scopeType}:${permission.scopeId}`)} · {formatDateLabel(permission.startDate)} to {permission.endDate ? formatDateLabel(permission.endDate) : 'Active'} · {permission.status}
                </div>
              </Card>
            )) : null}
            <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
              HoD, mentor, and course-leader visibility now comes from the same admin-managed permission source instead of separate mock-only assumptions.
            </div>
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Appointments</div>
            {profile?.appointments?.length ? profile.appointments.map(appointment => (
              <Card key={appointment.appointmentId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>
                  {appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId}
                  {appointment.branchName ?? appointment.branchCode ?? appointment.branchId ? ` · ${appointment.branchName ?? appointment.branchCode ?? appointment.branchId}` : ''}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDateLabel(appointment.startDate)} to {appointment.endDate ? formatDateLabel(appointment.endDate) : 'Active'} · {appointment.status}
                </div>
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No explicit appointment projection available in the current mode.</div>
            )}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Teaching Scope</div>
            {(profile?.currentOwnedClasses?.length ? profile.currentOwnedClasses.map(item => ({
              key: item.offeringId,
              title: `${item.courseCode} · ${item.title}`,
              meta: `${item.yearLabel} · Section ${item.sectionCode} · ${item.ownershipRole}${item.branchName ? ` · ${item.branchName}` : ''}`,
            })) : assignedOfferings.map(item => ({
              key: item.offId,
              title: `${item.code} · ${item.title}`,
              meta: `${item.year} · Section ${item.section}`,
            }))).slice(0, 8).map(item => (
              <Card key={item.key} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.meta}</div>
              </Card>
            ))}
            {assignedOfferings.length === 0 && !profile?.currentOwnedClasses?.length ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No current class ownership is mapped in this mode.</div> : null}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Course Leader Scope</div>
            {profile?.subjectRunCourseLeaderScope?.length ? profile.subjectRunCourseLeaderScope.slice(0, 8).map(subjectRun => (
              <Card key={subjectRun.subjectRunId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{subjectRun.courseCode} · {subjectRun.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{subjectRun.yearLabel} · Sections {subjectRun.sectionCodes.join(', ')}</div>
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>No subject-run course-leader scope is currently assigned.</div>
            )}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Mentoring And Timetable</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Mentor scope: {profile?.mentorScope.activeStudentCount ?? currentTeacher.menteeIds.length} active students</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Timetable template: {(profile?.timetableStatus.hasTemplate ?? !!currentFacultyTimetable) ? 'Configured' : 'Not configured'}</div>
            <div style={{ ...mono, fontSize: 10, color: T.text }}>Direct edit window: {timetableWindow ?? 'Unavailable in current mode'}</div>
            {profile?.requestSummary ? (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                {profile.requestSummary.openCount} linked governed requests. Recent: {profile.requestSummary.recent.map(item => `${item.summary} (${item.status})`).join(' · ') || 'none'}.
              </div>
            ) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                Timetable and request summaries fall back to local teaching context when the live academic profile endpoint is not in use.
              </div>
            )}
          </Card>

          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Institution Calendar</div>
            {upcomingMarkers.length > 0 ? upcomingMarkers.map(marker => (
              <Card key={marker.markerId} style={{ padding: 10, background: T.surface2 }}>
                <div style={{ ...mono, fontSize: 10, color: T.text }}>{describeCalendarMarkerType(marker.markerType)} · {marker.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                  {formatDateLabel(marker.dateISO)}{marker.endDateISO ? ` to ${formatDateLabel(marker.endDateISO)}` : ''}{marker.allDay ? ' · All day' : marker.startMinutes != null && marker.endMinutes != null ? ` · ${minutesToDisplayLabel(marker.startMinutes)} - ${minutesToDisplayLabel(marker.endMinutes)}` : ''}
                </div>
                {marker.note ? <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{marker.note}</div> : null}
              </Card>
            )) : (
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                No institutional semester markers, holidays, term-test windows, or events are currently mapped for this faculty calendar.
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

function suggestTaskForStudent(s?: Student) {
  const toISO = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (!s) return { taskType: 'Follow-up' as TaskType, dueDateISO: toISO(7), note: '' }
  const attPct = Math.round((s.present / s.totalClasses) * 100)
  if (s.riskBand === 'High') return { taskType: 'Remedial' as TaskType, dueDateISO: toISO(3), note: 'High-risk case. Add a structured remedial plan with check-ins.' }
  if (attPct < 65 || s.flags.lowAttendance) return { taskType: 'Attendance' as TaskType, dueDateISO: toISO(2), note: 'Attendance intervention and follow-up required.' }
  if (s.riskBand === 'Medium') return { taskType: 'Academic' as TaskType, dueDateISO: toISO(5), note: 'Academic follow-up for medium-risk trend.' }
  return { taskType: 'Follow-up' as TaskType, dueDateISO: toISO(7), note: `General follow-up with ${s.name.split(' ')[0]}.` }
}

function RequiredNoteModal({ title, description, submitLabel, onClose, onSubmit }: { title: string; description: string; submitLabel: string; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={UI_TRANSITION_MEDIUM}
        style={{ width: '100%', maxWidth: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, boxShadow: '0 24px 60px rgba(2, 6, 23, 0.32)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{title}</div>
          <button aria-label="Close note modal" title="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={16} /></button>
        </div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>{description}</div>
        <textarea aria-label="Required note" value={note} onChange={e => setNote(e.target.value)} rows={5} placeholder="Enter the required note" style={{ width: '100%', resize: 'none', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 8, padding: '10px 12px' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" onClick={() => {
            if (!note.trim()) return
            onSubmit(note.trim())
          }}>{submitLabel}</Btn>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TaskComposerModal({ role, offerings, initialState, onClose, onSubmit }: { role: Role; offerings: Offering[]; initialState: TaskComposerState; onClose: () => void; onSubmit: (input: TaskCreateInput) => void }) {
  const { getStudentsPatched } = useAppSelectors()
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [selectedOffId, setSelectedOffId] = useState<string>(initialState.offeringId ?? '')
  const [query, setQuery] = useState(initialState.search)
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialState.studentId ?? '')
  const [taskType, setTaskType] = useState<TaskType>(initialState.taskType)
  const [dueDateISO, setDueDateISO] = useState(initialState.dueDateISO)
  const [note, setNote] = useState(initialState.note)
  const [step, setStep] = useState<'details' | 'remedial'>(initialState.step)
  const [planTitle, setPlanTitle] = useState(() => initialState.search ? `Remedial support plan for ${initialState.search.split(' ')[0]}` : '')
  const [checkIn1, setCheckIn1] = useState('')
  const [checkIn2, setCheckIn2] = useState('')
  const [planSteps, setPlanSteps] = useState<string[]>(['Target weak CO topics', 'Solve supervised practice set', 'Mentor check-in and reflection'])
  const [schedulingMode, setSchedulingMode] = useState<'one-time' | 'scheduled'>('one-time')
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('daily')
  const [scheduleTime, setScheduleTime] = useState('')
  const [customDates, setCustomDates] = useState<Array<{ dateISO: string; time?: string }>>([{ dateISO: '', time: '' }])

  const yearOptions = useMemo(() => Array.from(new Set(offerings.map(o => o.year))), [offerings])
  const deptOptions = useMemo(() => Array.from(new Set(offerings.map(o => o.dept))), [offerings])
  const classOfferings = useMemo(() => offerings.filter(o => (!selectedYear || o.year === selectedYear) && (!selectedDept || o.dept === selectedDept)), [offerings, selectedYear, selectedDept])
  const activeSelectedOffId = selectedOffId && classOfferings.some(o => o.offId === selectedOffId) ? selectedOffId : ''
  const selectedOffering = offerings.find(o => o.offId === activeSelectedOffId)
  const filteredStudents = (selectedOffering ? getStudentsPatched(selectedOffering) : []).filter(student => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return student.name.toLowerCase().includes(q) || student.usn.toLowerCase().includes(q)
  })
  const selectedStudent = filteredStudents.find(student => student.id === selectedStudentId) ?? (selectedOffering ? getStudentsPatched(selectedOffering).find(student => student.id === selectedStudentId) : undefined)
  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as Array<{ offering: Offering; student: Student }>
    const scope = activeSelectedOffId ? offerings.filter(o => o.offId === activeSelectedOffId) : classOfferings
    return scope.flatMap(o => getStudentsPatched(o).filter(student => student.name.toLowerCase().includes(q) || student.usn.toLowerCase().includes(q)).map(student => ({ offering: o, student }))).slice(0, 10)
  }, [activeSelectedOffId, classOfferings, getStudentsPatched, offerings, query])

  const hydrateSelectedStudent = useCallback((student: Student) => {
    const suggestion = suggestTaskForStudent(student)
    setTaskType(current => initialState.studentId && current === initialState.taskType ? suggestion.taskType : current)
    setDueDateISO(current => current || suggestion.dueDateISO)
    setNote(current => current || suggestion.note)
    setPlanTitle(`Remedial support plan for ${student.name.split(' ')[0]}`)
  }, [initialState.studentId, initialState.taskType])

  const getScheduleMeta = () => {
    if (schedulingMode === 'one-time') return undefined
    if (schedulePreset === 'custom dates') {
      const validCustomDates = customDates
        .map(item => ({ dateISO: item.dateISO.trim(), time: item.time?.trim() || undefined }))
        .filter(item => !!normalizeDateISO(item.dateISO))
      if (validCustomDates.length === 0) return undefined
      const nextDue = validCustomDates.map(item => item.dateISO).sort()[0]
      return {
        mode: 'scheduled' as const,
        preset: 'custom dates' as const,
        customDates: validCustomDates,
        status: 'active' as const,
        nextDueDateISO: nextDue,
      }
    }
    const normalizedDue = normalizeDateISO(dueDateISO) ?? toTodayISO()
    return {
      mode: 'scheduled' as const,
      preset: schedulePreset,
      time: scheduleTime || undefined,
      status: 'active' as const,
      nextDueDateISO: normalizedDue,
    }
  }

  const denseFieldStyle = getFieldChromeStyle({ dense: true })
  const denseTextAreaStyle = { ...denseFieldStyle, minHeight: 0 }

  return (
    <ModalWorkspace
      eyebrow="Action Queue"
      title={step === 'details' ? 'Add Task' : 'Build Remedial Plan'}
      caption={step === 'details' ? 'One unified task flow for follow-up, attendance, academic, and remedial actions.' : 'Step 2 of 2. Leaf tasks stay tied to the same queue item.'}
      onClose={onClose}
      width={760}
      size="lg"
      bodyStyle={{ display: 'grid', gap: 12 }}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={T.accent} size={9}>Owner: {role}</Chip>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {step === 'remedial' && <Btn size="sm" variant="ghost" onClick={() => setStep('details')}>Back</Btn>}
            <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
            {step === 'details' && taskType === 'Remedial' && <Btn size="sm" onClick={() => {
              const fallbackStudentId = selectedStudentId || filteredStudents[0]?.id || searchHits[0]?.student.id
              if (!selectedOffering || !fallbackStudentId) return
              if (!selectedStudentId) setSelectedStudentId(fallbackStudentId)
              setStep('remedial')
            }}>Build Plan</Btn>}
            {step === 'details' && taskType !== 'Remedial' && <Btn size="sm" onClick={() => {
              if (!selectedOffering || !selectedStudentId) return
              const scheduleMeta = getScheduleMeta()
              const effectiveDueDateISO = scheduleMeta?.nextDueDateISO ?? dueDateISO
              onSubmit({
                offeringId: selectedOffering.offId,
                studentId: selectedStudentId,
                taskType,
                dueDateISO: effectiveDueDateISO,
                due: toDueLabel(effectiveDueDateISO),
                note,
                scheduleMeta,
                placement: initialState.placement,
              })
              onClose()
            }}>Create Task</Btn>}
            {step === 'remedial' && <Btn size="sm" onClick={() => {
              if (!selectedOffering || !selectedStudentId) return
              const sanitized = planSteps.map(item => item.trim()).filter(Boolean)
              const scheduleMeta = getScheduleMeta()
              const effectiveDueDateISO = scheduleMeta?.nextDueDateISO ?? dueDateISO
              if (!planTitle.trim() || !effectiveDueDateISO || sanitized.length === 0) return
              const plan: RemedialPlan = {
                planId: `plan-${selectedStudentId}-${Date.now()}`,
                title: planTitle.trim(),
                createdAt: Date.now(),
                ownerRole: role,
                dueDateISO: effectiveDueDateISO,
                checkInDatesISO: [checkIn1, checkIn2].filter(Boolean),
                steps: sanitized.map((label, index) => ({ id: `step-${index + 1}`, label })),
              }
              onSubmit({
                offeringId: selectedOffering.offId,
                studentId: selectedStudentId,
                taskType: 'Remedial',
                dueDateISO: effectiveDueDateISO,
                due: toDueLabel(effectiveDueDateISO),
                note: note.trim() || planTitle.trim(),
                remedialPlan: plan,
                scheduleMeta,
                placement: initialState.placement,
              })
              onClose()
            }}>Create Remedial Task</Btn>}
          </div>
        </div>
      )}
    >
          {step === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldSelect aria-label="Select year" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={denseFieldStyle}>
                  <option value="">All Years</option>
                  {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </FieldSelect>
                <FieldSelect aria-label="Select branch" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={denseFieldStyle}>
                  <option value="">All Branches</option>
                  {deptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </FieldSelect>
              </div>
              <FieldSelect aria-label="Select class" value={activeSelectedOffId} onChange={e => { setSelectedOffId(e.target.value); setQuery('') }} style={denseFieldStyle}>
                <option value="">Select class</option>
                {classOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Sec {offering.section} · {offering.count} students</option>)}
              </FieldSelect>
              <FieldInput aria-label="Search student" placeholder="Search student / USN" value={query} onChange={e => setQuery(e.target.value)} style={denseFieldStyle} />
              {query.trim() !== '' && <div className="scroll-pane scroll-pane--dense" style={{ minHeight: 96, maxHeight: 140, overflowY: 'auto', border: `1px solid ${T.border2}`, borderRadius: 14, background: T.surface2 }}>
                {query.trim() !== '' && searchHits.length === 0 && <div style={{ ...mono, fontSize: 10, color: T.dim, padding: '10px 12px' }}>No matching students.</div>}
                {query.trim() !== '' && searchHits.map(hit => (
                  <button key={`${hit.offering.offId}-${hit.student.id}`} onClick={() => {
                    setSelectedYear(hit.offering.year)
                    setSelectedDept(hit.offering.dept)
                    setSelectedOffId(hit.offering.offId)
                    setSelectedStudentId(hit.student.id)
                    setQuery(hit.student.name)
                    hydrateSelectedStudent(hit.student)
                  }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', padding: '8px 10px' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 11, color: T.text }}>{hit.student.name}</div>
                    <div style={{ ...mono, fontSize: 9, color: T.muted }}>{hit.student.usn} · {hit.offering.code} · Sec {hit.offering.section}</div>
                  </button>
                ))}
              </div>}
              <FieldSelect aria-label="Select student" value={selectedStudentId} onChange={e => {
                const nextId = e.target.value
                setSelectedStudentId(nextId)
                const nextStudent = filteredStudents.find(student => student.id === nextId)
                if (nextStudent) hydrateSelectedStudent(nextStudent)
              }} style={denseFieldStyle}>
                <option value="">Select student</option>
                {filteredStudents.map(student => <option key={student.id} value={student.id}>{student.name} · {student.usn}</option>)}
              </FieldSelect>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldSelect aria-label="Task type" value={taskType} onChange={e => setTaskType(e.target.value as TaskType)} style={denseFieldStyle}>
                  <option>Follow-up</option>
                  <option>Remedial</option>
                  <option>Attendance</option>
                  <option>Academic</option>
                </FieldSelect>
                <FieldInput aria-label={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} title={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={denseFieldStyle} />
              </div>
              <Card style={{ padding: '10px 12px' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 8 }}>Scheduling</div>
                <div style={{ ...getSegmentedGroupStyle(), marginBottom: 8, width: 'fit-content' }}>
                  <button type="button" data-tab="true" onClick={() => setSchedulingMode('one-time')} style={getSegmentedButtonStyle({ active: schedulingMode === 'one-time', compact: true })}>One-time</button>
                  <button type="button" data-tab="true" onClick={() => setSchedulingMode('scheduled')} style={getSegmentedButtonStyle({ active: schedulingMode === 'scheduled', compact: true })}>Scheduled</button>
                </div>
                {schedulingMode === 'scheduled' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FieldSelect aria-label="Schedule preset" value={schedulePreset} onChange={e => setSchedulePreset(e.target.value as SchedulePreset)} style={denseFieldStyle}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="custom dates">Custom dates</option>
                      </FieldSelect>
                      {schedulePreset !== 'custom dates' && <FieldInput aria-label="Recurring time (optional)" type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={denseFieldStyle} />}
                    </div>
                    {schedulePreset === 'custom dates' && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {customDates.map((item, index) => (
                          <div key={`custom-date-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                            <FieldInput aria-label={`Custom date ${index + 1}`} type="date" value={item.dateISO} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, dateISO: e.target.value } : row))} style={denseFieldStyle} />
                            <FieldInput aria-label={`Custom date ${index + 1} time`} type="time" value={item.time ?? ''} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, time: e.target.value } : row))} style={denseFieldStyle} />
                            <button type="button" aria-label={`Remove custom date ${index + 1}`} onClick={() => setCustomDates(prev => prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index))} style={{ ...getIconButtonStyle({ subtle: false }), width: 38, height: 'auto', minHeight: 42, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>−</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setCustomDates(prev => [...prev, { dateISO: '', time: '' }])} style={{ ...getIconButtonStyle({ subtle: true }), width: 'fit-content', padding: '0 10px', ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>+ Add custom date</button>
                      </div>
                    )}
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Starts on: {normalizeDateISO(dueDateISO) ?? 'today'} · Queue activation follows the recurring schedule. Calendar placement stays exact when this task is launched from the timetable.</div>
                  </div>
                )}
              </Card>
              {initialState.placement && (
                <Card style={{ padding: '10px 12px' }}>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 6 }}>Calendar placement</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                    {initialState.placement.dateISO} · {initialState.placement.placementMode === 'untimed'
                      ? 'No preferred time'
                      : `${minutesToDisplayLabel(initialState.placement.startMinutes ?? 0)} - ${minutesToDisplayLabel(initialState.placement.endMinutes ?? 0)}`}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>Saving this task will place it directly into the calendar/timetable workspace.</div>
                </Card>
              )}
              <FieldTextarea aria-label="Task note" value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Task note" style={{ ...denseTextAreaStyle, resize: 'none' }} />
              {selectedStudent && (
                <Card style={{ padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>Selected student</div>
                  <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text, marginTop: 4 }}>{selectedStudent.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 2 }}>{selectedStudent.usn} · {selectedOffering?.code} Sec {selectedOffering?.section}</div>
                </Card>
              )}
            </>
          )}

          {step === 'remedial' && (
            <>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{selectedStudent?.name} · {selectedOffering?.code} Sec {selectedOffering?.section}</div>
              <FieldInput aria-label="Remedial plan title" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="Plan title" style={denseFieldStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <FieldInput aria-label="Plan due date" type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={denseFieldStyle} />
                <FieldInput aria-label="Check-in date 1" type="date" value={checkIn1} onChange={e => setCheckIn1(e.target.value)} style={denseFieldStyle} />
                <FieldInput aria-label="Check-in date 2" type="date" value={checkIn2} onChange={e => setCheckIn2(e.target.value)} style={denseFieldStyle} />
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>Plan steps (checklist)</div>
              {planSteps.map((stepLabel, index) => (
                <FieldInput key={index} aria-label={`Plan step ${index + 1}`} value={stepLabel} onChange={e => setPlanSteps(prev => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`Step ${index + 1}`} style={denseFieldStyle} />
              ))}
            </>
          )}
    </ModalWorkspace>
  )
}

/* ══════════════════════════════════════════════════════════════
   STUDENT DRAWER — SHAP, What-If, CO, Interventions
   ══════════════════════════════════════════════════════════════ */

function StudentDrawer({
  student,
  offering,
  role,
  meetings,
  onClose,
  onEscalate,
  onOpenTaskComposer,
  onAssignToMentor,
  onOpenHistory,
  onScheduleMeeting,
}: {
  student: Student | null
  offering?: Offering
  role: Role
  meetings: AcademicMeeting[]
  onClose: () => void
  onEscalate: (s: Student, o?: Offering) => void
  onOpenTaskComposer: (s: Student, o?: Offering, taskType?: TaskType) => void
  onAssignToMentor: (s: Student, o?: Offering) => void
  onOpenHistory: (s: Student, o?: Offering) => void
  onScheduleMeeting: (input: { student: Student; offering?: Offering; title: string; notes?: string; dateISO: string; startMinutes: number; endMinutes: number }) => Promise<void> | void
}) {
  const { deriveAcademicProjection, getSchemeForOffering } = useAppSelectors()
  const studentSeedName = student?.name.split(' ')[0] ?? 'Student'
  const normalizedStudentId = student?.id.split('::').at(-1) ?? ''
  const [meetingTitle, setMeetingTitle] = useState(() => `Student meeting · ${studentSeedName}`)
  const [meetingDateISO, setMeetingDateISO] = useState(() => toTodayISO())
  const [meetingStart, setMeetingStart] = useState('15:30')
  const [meetingEnd, setMeetingEnd] = useState('16:00')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [showMeetingComposer, setShowMeetingComposer] = useState(false)
  const studentMeetings = useMemo(
    () => meetings
      .filter(meeting => meeting.studentUsn === student?.usn || meeting.studentId === normalizedStudentId)
      .sort((left, right) => `${right.dateISO}-${right.startMinutes}`.localeCompare(`${left.dateISO}-${left.startMinutes}`)),
    [meetings, normalizedStudentId, student?.usn],
  )
  if (!student) return null
  const s = student
  const attPct = Math.round(s.present / s.totalClasses * 100)
  const riskCol = s.riskBand === 'High' ? T.danger : s.riskBand === 'Medium' ? T.warning : T.success
  const canSeeDetailedMarks = role !== 'Mentor'
  const drawerHistory = buildHistoryProfile({ student: s, offering: offering ?? null })
  const activeScheme = offering ? getSchemeForOffering(offering) : null
  const ceSummary = offering && activeScheme ? deriveAcademicProjection({ offering, student: s, scheme: activeScheme, history: drawerHistory }) : null
  const ceSignalThresholds = activeScheme ? {
    success: activeScheme.policyContext.ce * 0.5,
    warning: activeScheme.policyContext.ce * 0.4,
  } : null

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={UI_TRANSITION_FAST}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
    >
      <motion.div
        initial={{ x: 360, opacity: 0.98 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 360, opacity: 0.98 }}
        transition={UI_TRANSITION_MEDIUM}
        onClick={e => e.stopPropagation()}
        className="scroll-pane scroll-pane--dense"
        style={{ width: 520, maxWidth: '100vw', height: '100vh', overflowY: 'auto', background: T.surface, borderLeft: `1px solid ${T.border}`, padding: '24px 28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>{s.name}</div>
            <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 2 }}>{s.usn}</div>
            {offering && <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{offering.code} · {offering.title} · Sec {offering.section}</div>}
          </div>
          <button aria-label="Close student details" title="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Risk Gauge */}
        {s.riskProb !== null ? (
          <div style={{ background: `${riskCol}0c`, border: `1px solid ${riskCol}30`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ ...sora, fontWeight: 800, fontSize: 42, color: riskCol }}>{Math.round(s.riskProb * 100)}%</div>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: riskCol }}>Failure Risk — {s.riskBand}</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>P(subject grade &lt; 7.5 or backlog)</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {s.flags.backlog && <Chip color={T.danger} size={9}>Backlog history</Chip>}
                  {s.flags.lowAttendance && <Chip color={T.warning} size={9}>Low attendance</Chip>}
                  {s.flags.declining && <Chip color={T.warning} size={9}>Declining trend</Chip>}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}><Bar val={s.riskProb * 100} color={riskCol} h={8} /></div>
          </div>
        ) : (
          <div style={{ background: T.surface2, borderRadius: 12, padding: '18px 22px', marginBottom: 18, textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 12, color: T.muted }}>Risk prediction unavailable — TT1 not yet completed</div>
            <div style={{ ...mono, fontSize: 11, color: T.dim, marginTop: 4 }}>Showing attendance data only</div>
          </div>
        )}

        {/* SHAP — Top Risk Drivers */}
        {s.reasons.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={14} color={T.danger} /> Top Risk Drivers
            </div>
            {s.reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text, marginBottom: 3 }}>{r.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ height: 6, borderRadius: 3, background: r.impact > 0.25 ? T.danger : r.impact > 0.15 ? T.warning : T.blue, width: `${Math.min(100, r.impact * 300)}%`, minWidth: 20, transition: 'width 0.4s ease' }} />
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{Math.round(r.impact * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CO Attainment */}
        {s.coScores.length > 0 && s.coScores[0].attainment > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={14} color={T.accent} /> CO Attainment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {s.coScores.map((co, i) => {
                const col = CO_COLORS[i % CO_COLORS.length]
                return (
                  <div key={co.coId} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 10, color: col, marginBottom: 2 }}>{co.coId}</div>
                    <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: co.attainment >= 60 ? T.success : co.attainment >= 40 ? T.warning : T.danger }}>{co.attainment}%</div>
                    <Bar val={co.attainment} color={co.attainment >= 60 ? T.success : co.attainment >= 40 ? T.warning : T.danger} h={4} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* What-If Scenarios */}
        {s.whatIf.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} color={T.blue} /> What Could Change
            </div>
            {s.whatIf.map((w, i) => (
              <div key={i} style={{ background: `${T.blue}0a`, border: `1px solid ${T.blue}25`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{w.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ ...mono, fontSize: 12, color: T.muted }}>{w.current}</span>
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>→</span>
                  <span style={{ ...mono, fontSize: 12, color: T.success }}>{w.target}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.danger }}>{Math.round(w.currentRisk * 100)}%</span>
                    <span style={{ ...mono, fontSize: 10, color: T.dim }}>→</span>
                    <span style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.success }}>{Math.round(w.newRisk * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Academic Snapshot */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} color={T.accent} /> Academic Snapshot
          </div>
          {!canSeeDetailedMarks && (
            <div style={{ ...mono, fontSize: 11, color: T.warning, marginBottom: 8 }}>Mentor view shows summary academics only. Raw entry fields remain restricted.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { lbl: 'Attendance', val: `${attPct}%`, col: attPct >= 75 ? T.success : attPct >= 65 ? T.warning : T.danger },
              { lbl: 'TT Summary', val: canSeeDetailedMarks ? `${s.tt1Score ?? '—'} / ${s.tt2Score ?? '—'}` : ceSummary ? `${(ceSummary.tt1Scaled + ceSummary.tt2Scaled).toFixed(1)}/30` : '—', col: ceSummary && ceSummary.tt1Scaled + ceSummary.tt2Scaled >= 15 ? T.success : T.warning },
              { lbl: 'CE Signal', val: ceSummary && activeScheme ? `${ceSummary.ce60.toFixed(1)}/${activeScheme.policyContext.ce}` : '—', col: ceSummary && ceSignalThresholds ? (ceSummary.ce60 >= ceSignalThresholds.success ? T.success : ceSummary.ce60 >= ceSignalThresholds.warning ? T.warning : T.danger) : T.warning },
              { lbl: 'Weak Component', val: s.reasons[0]?.feature?.toUpperCase() ?? 'None', col: s.reasons[0] ? T.warning : T.success },
              { lbl: 'SEE Readiness', val: s.riskBand === 'High' ? 'Needs support' : s.riskBand === 'Medium' ? 'Watch' : 'On track', col: s.riskBand === 'High' ? T.danger : s.riskBand === 'Medium' ? T.warning : T.success },
              { lbl: 'Pred CGPA', val: ceSummary ? ceSummary.predictedCgpa.toFixed(2) : (s.prevCgpa > 0 ? s.prevCgpa.toFixed(1) : '—'), col: (ceSummary?.predictedCgpa ?? s.prevCgpa) >= 7 ? T.success : (ceSummary?.predictedCgpa ?? s.prevCgpa) >= 6 ? T.warning : T.danger },
            ].map((x, i) => (
              <div key={i} style={{ background: T.surface2, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: x.col }}>{x.val}</div>
                <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Intervention History */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={14} color={T.warning} /> Intervention Log
          </div>
          {s.interventions.length > 0 ? s.interventions.map((iv, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 50 }}>{iv.date}</div>
              <Chip color={T.warning} size={9}>{iv.type}</Chip>
              <div style={{ ...mono, fontSize: 11, color: T.muted, flex: 1 }}>{iv.note}</div>
            </div>
          )) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim, padding: '12px 0' }}>No interventions logged yet</div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color={T.accent} /> Meetings
          </div>
          {studentMeetings.length > 0 ? studentMeetings.map(meeting => (
            <div key={meeting.meetingId} style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 13, color: T.text }}>{meeting.title}</div>
                <Chip color={meeting.status === 'completed' ? T.success : meeting.status === 'cancelled' ? T.danger : T.accent} size={9}>{meeting.status}</Chip>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                {meeting.dateISO} · {minutesToDisplayLabel(meeting.startMinutes)} - {minutesToDisplayLabel(meeting.endMinutes)}
                {meeting.courseCode ? ` · ${meeting.courseCode}` : ''}
              </div>
              {meeting.notes ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>{meeting.notes}</div> : null}
            </div>
          )) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim, padding: '12px 0' }}>No meetings scheduled yet</div>
          )}

          {showMeetingComposer && (
            <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, display: 'grid', gap: 10 }}>
              <input aria-label="Meeting title" value={meetingTitle} onChange={event => setMeetingTitle(event.target.value)} placeholder="Meeting title" style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input aria-label="Meeting date" type="date" value={meetingDateISO} onChange={event => setMeetingDateISO(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
                <input aria-label="Meeting start time" type="time" value={meetingStart} onChange={event => setMeetingStart(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
                <input aria-label="Meeting end time" type="time" value={meetingEnd} onChange={event => setMeetingEnd(event.target.value)} style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px' }} />
              </div>
              <textarea aria-label="Meeting notes" value={meetingNotes} onChange={event => setMeetingNotes(event.target.value)} rows={3} placeholder="Add context, agenda, or follow-up notes" style={{ ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface, color: T.text, padding: '8px 10px', resize: 'vertical' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn size="sm" variant="ghost" onClick={() => setShowMeetingComposer(false)}>Cancel</Btn>
                <Btn size="sm" onClick={() => {
                  void onScheduleMeeting({
                    student: s,
                    offering,
                    title: meetingTitle.trim() || `Student meeting · ${s.name.split(' ')[0]}`,
                    notes: meetingNotes.trim(),
                    dateISO: meetingDateISO,
                    startMinutes: parseTimeToMinutes(meetingStart, 15 * 60),
                    endMinutes: parseTimeToMinutes(meetingEnd, (15 * 60) + 30),
                  })
                  setShowMeetingComposer(false)
                  setMeetingNotes('')
                }}>Schedule Meeting</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" onClick={() => navigator.clipboard.writeText(s.phone)}><Phone size={12} /> Call</Btn>
          <Btn size="sm" variant="ghost"><Mail size={12} /> Email</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenTaskComposer(s, offering, s.riskBand === 'High' ? 'Remedial' : 'Follow-up')}><MessageSquare size={12} /> Add Task</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setShowMeetingComposer(current => !current)}><Calendar size={12} /> {showMeetingComposer ? 'Hide Meeting Form' : 'Schedule Meeting'}</Btn>
          {(role === 'Course Leader' || role === 'HoD') && <Btn size="sm" variant="ghost" onClick={() => onAssignToMentor(s, offering)}><Users size={12} /> Defer to Mentor</Btn>}
          <Btn size="sm" variant="ghost" onClick={() => onOpenHistory(s, offering)}><Eye size={12} /> Open Full Profile</Btn>
          {role !== 'HoD' && <Btn size="sm" variant="danger" onClick={() => onEscalate(s, offering)}><AlertTriangle size={12} /> Escalate to HoD</Btn>}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ACTION QUEUE (Right Sidebar)
   ══════════════════════════════════════════════════════════════ */

function ActionQueue({ role, tasks, resolvedTaskIds, onResolveTask, onUndoTask, onOpenStudent, onOpenTaskComposer, onRemedialCheckIn, onReassignTask, onOpenUnlockReview, onOpenQueueHistory, onApproveUnlock, onRejectUnlock, onResetComplete, onToggleSchedulePause, onEditSchedule, onDismissTask, onDismissSeries }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onResolveTask: (id: string) => void; onUndoTask: (id: string) => void; onOpenStudent: (task: SharedTask) => void; onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void; onRemedialCheckIn: (taskId: string) => void; onReassignTask: (taskId: string, toRole: Role) => void; onOpenUnlockReview: (taskId: string) => void; onOpenQueueHistory: () => void; onApproveUnlock: (taskId: string) => void; onRejectUnlock: (taskId: string) => void; onResetComplete: (taskId: string) => void; onToggleSchedulePause: (taskId: string) => void; onEditSchedule: (taskId: string) => void; onDismissTask: (taskId: string) => void; onDismissSeries: (taskId: string) => void }) {
  const todayISO = toTodayISO()
  const [showQueueHelp, setShowQueueHelp] = useState(false)
  const active = tasks
    .filter(t => isTaskActiveForQueue(t, resolvedTaskIds, todayISO))
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  const done = tasks.filter(t => !!resolvedTaskIds[t.id]).sort((a, b) => (resolvedTaskIds[b.id] ?? 0) - (resolvedTaskIds[a.id] ?? 0))
  const buttonStyle = (color: string, variant: 'ghost' | 'filled' = 'ghost', disabled = false) => ({
    ...mono,
    fontSize: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${disabled ? T.border2 : `${color}${variant === 'filled' ? '44' : '30'}`}`,
    background: disabled ? T.surface3 : variant === 'filled' ? `${color}16` : `${color}10`,
    color: disabled ? T.dim : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
  })

  return (
    <div className="scroll-pane scroll-pane--dense" style={{ width: 320, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ListTodo size={16} color={T.accent} />
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue</div>
        <button
          type="button"
          aria-label={showQueueHelp ? 'Hide queue help' : 'Show queue help'}
          aria-expanded={showQueueHelp}
          title={showQueueHelp ? 'Hide queue help' : 'Show queue help'}
          onClick={() => setShowQueueHelp(current => !current)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            border: `1px solid ${T.border2}`,
            background: showQueueHelp ? `${T.accent}16` : T.surface2,
            color: showQueueHelp ? T.accent : T.muted,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          i
        </button>
        <button aria-label="Open queue history" title="Open queue history" onClick={onOpenQueueHistory} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>History</button>
        <Chip color={T.danger} size={10}>{active.length} pending</Chip>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>Single-owner queue with visible reassignment trail.</div>
      <AnimatePresence initial={false}>
        {showQueueHelp && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}
          >
            <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Queue shortcuts</div>
            <div style={{ ...mono, fontSize: 10, color: T.text, marginBottom: 8 }}>Click any task card to open the full student or task context.</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.success} size={9}>Mark done</Chip>
                <span style={{ ...mono, fontSize: 10, color: T.dim }}>Completes the current work. Recurring tasks come back on their next scheduled date.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip color={T.muted} size={9}>Dismiss</Chip>
                <span style={{ ...mono, fontSize: 10, color: T.dim }}>Stops it from active work. On recurring tasks, this ends the series and keeps it restorable in history.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {active.map(t => {
        const progress = getRemedialProgress(t.remedialPlan)
        const hasRemedialFlow = (t.taskType === 'Remedial' || !!t.remedialPlan) && progress.total > 0
        const latestTransition = getLatestTransition(t)
        return (
          <motion.div
            key={t.id}
            layout
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${t.title}`}
            title="Open details"
            onClick={() => onOpenStudent(t)}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpenStudent(t)
              }
            }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ y: -1, scale: 0.992 }}
            transition={UI_TRANSITION_FAST}
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: `0 14px 28px ${T.bg}22` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ ...sora, fontWeight: 600, fontSize: 12, color: T.text, lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{t.courseCode || 'Mentor'} · {t.year}</div>
              </div>
              <RiskBadge band={t.riskBand} prob={t.riskProb} />
            </div>
            <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 8 }}>{t.actionHint}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip color={t.status === 'New' ? T.danger : T.warning} size={9}>{t.status}</Chip>
              <Chip color={T.accent} size={9}>Owner: {t.assignedTo}</Chip>
              <Chip color={T.dim} size={9}>Due: {t.due}</Chip>
              {t.scheduleMeta?.mode === 'scheduled' && <Chip color={t.scheduleMeta.status === 'paused' ? T.warning : t.scheduleMeta.status === 'ended' ? T.danger : T.success} size={9}>Recurring: {t.scheduleMeta.preset} · {t.scheduleMeta.status ?? 'active'}</Chip>}
              {t.unlockRequest && <Chip color={t.unlockRequest.status === 'Rejected' ? T.danger : t.unlockRequest.status === 'Reset Completed' ? T.success : T.warning} size={9}>Unlock: {t.unlockRequest.status}</Chip>}
            </div>
            {latestTransition && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ ...mono, fontSize: 9, color: T.muted }}>
                  Last transition: {latestTransition.action} · {formatDateTime(latestTransition.at)}
                </div>
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 3 }}>{latestTransition.note}</div>
              </div>
            )}
            {hasRemedialFlow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Chip color={progress.completed === progress.total ? T.success : T.warning} size={9}>Plan {progress.completed}/{progress.total}</Chip>
                <span style={{ ...mono, fontSize: 9, color: T.dim }}>Next check-in: {t.remedialPlan?.checkInDatesISO.find(d => new Date(`${d}T00:00:00`).getTime() >= Date.now()) ?? 'Schedule pending'}</span>
              </div>
            )}
            <div style={{ ...mono, fontSize: 9, color: T.dim, marginBottom: 8 }}>
              {t.scheduleMeta?.mode === 'scheduled'
                ? 'Recurring task: Mark done clears only this occurrence. Dismiss ends the recurring task.'
                : 'One-time task: Mark done completes it. Dismiss removes it from the active queue without marking it complete.'}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(t.taskType === 'Remedial' || !!t.remedialPlan) && (
                  <button
                    aria-label="Log remedial check-in"
                    title="Log remedial check-in"
                    onClick={event => {
                      event.stopPropagation()
                      onRemedialCheckIn(t.id)
                    }}
                    style={buttonStyle(T.warning)}
                  >
                    <Activity size={12} />
                    Check-in
                  </button>
                )}
                {t.unlockRequest && role === 'HoD' && (
                  <>
                    <button aria-label="Review unlock request" title="Review unlock" onClick={event => { event.stopPropagation(); onOpenUnlockReview(t.id) }} style={buttonStyle(T.warning)}>Review</button>
                    {t.unlockRequest.status === 'Pending' && <button aria-label="Approve unlock request" title="Approve unlock" onClick={event => { event.stopPropagation(); onApproveUnlock(t.id) }} style={buttonStyle(T.success)}>Approve</button>}
                    {t.unlockRequest.status === 'Pending' && <button aria-label="Reject unlock request" title="Reject unlock" onClick={event => { event.stopPropagation(); onRejectUnlock(t.id) }} style={buttonStyle(T.danger)}>Reject</button>}
                    {t.unlockRequest.status === 'Approved' && <button aria-label="Reset and unlock dataset" title="Reset and unlock" onClick={event => { event.stopPropagation(); onResetComplete(t.id) }} style={buttonStyle(T.success)}>Reset</button>}
                  </>
                )}
                {role === 'Course Leader' && !t.unlockRequest && <button aria-label="Reassign task to mentor" title="Defer to Mentor" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'Mentor') }} style={buttonStyle(T.blue)}>Mentor</button>}
                {role !== 'HoD' && !t.unlockRequest && <button aria-label="Reassign task to hod" title="Defer to HoD" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'HoD') }} style={buttonStyle(T.danger)}>HoD</button>}
                {role === 'HoD' && !t.unlockRequest && <button aria-label="Return task to course leader" title="Return to Course Leader" onClick={event => { event.stopPropagation(); onReassignTask(t.id, 'Course Leader') }} style={buttonStyle(T.blue)}>CL</button>}
                {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Pause or resume recurrence" title={t.scheduleMeta.status === 'paused' ? 'Resume recurrence' : 'Pause recurrence'} onClick={event => { event.stopPropagation(); onToggleSchedulePause(t.id) }} style={buttonStyle(T.warning)}>{t.scheduleMeta.status === 'paused' ? 'Resume' : 'Pause'}</button>}
                {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Edit recurrence" title="Edit recurrence" onClick={event => { event.stopPropagation(); onEditSchedule(t.id) }} style={buttonStyle(T.accent)}>Edit schedule</button>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!t.scheduleMeta && <button aria-label="Dismiss task" title="Dismiss task to history" onClick={event => { event.stopPropagation(); onDismissTask(t.id) }} style={buttonStyle(T.muted)}>Dismiss</button>}
                  {t.scheduleMeta?.mode === 'scheduled' && <button aria-label="Dismiss recurring task" title="Dismiss recurring task" onClick={event => { event.stopPropagation(); onDismissSeries(t.id) }} style={buttonStyle(T.danger)}>Dismiss</button>}
                </div>
                <button aria-label={t.scheduleMeta?.mode === 'scheduled' ? 'Mark current occurrence as done' : 'Mark task as done'} title={t.scheduleMeta?.mode === 'scheduled' ? 'Mark current occurrence as done' : 'Mark task as done'} onClick={event => { event.stopPropagation(); onResolveTask(t.id) }} style={buttonStyle(T.success, 'filled')}>
                  <CheckCircle size={12} />
                  Mark done
                </button>
              </div>
            </div>
          </motion.div>
        )
      })}

      {done.length > 0 && (
        <>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Resolved history</div>
          {done.slice(0, 6).map(t => (
            <div key={t.id} style={{ background: `${T.success}08`, border: `1px solid ${T.success}20`, borderRadius: 8, padding: '8px 12px', marginBottom: 6, opacity: 0.75 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...mono, fontSize: 11, color: T.success, textDecoration: 'line-through', flex: 1 }}>{t.title}</div>
                <button aria-label="Undo resolved task" title="Undo" onClick={() => onUndoTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>Undo</button>
              </div>
              <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 2 }}>Kept in queue history for audit continuity.</div>
            </div>
          ))}
        </>
      )}

      {active.length === 0 && done.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
          <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.success }}>All clear!</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>No pending actions right now</div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 10, background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${T.surface} 35%)` }}>
        <button aria-label="Add quick task" title="Add quick task" onClick={() => onOpenTaskComposer()} style={{ width: '100%', border: 'none', borderRadius: 10, cursor: 'pointer', background: T.accent, color: '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...sora, fontWeight: 700, fontSize: 12 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Quick Add Task
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COURSE LEADER: DASHBOARD
   ══════════════════════════════════════════════════════════════ */

function CLDashboard({ offerings, pendingTaskCount, onOpenCourse, onOpenStudent, onOpenUpload, onOpenCalendar, onOpenPendingActions, teacherInitials, greetingHeadline, greetingMeta }: { offerings: Offering[]; pendingTaskCount: number; onOpenCourse: (o: Offering) => void; onOpenStudent: (s: Student, o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void; onOpenCalendar: () => void; onOpenPendingActions: () => void; teacherInitials: string; greetingHeadline: string; greetingMeta: string }) {
  const { getStudentsPatched } = useAppSelectors()
  const total = offerings.reduce((a, o) => a + o.count, 0)
  const allAtRisk = useMemo(() => offerings.flatMap(o => getStudentsPatched(o)), [getStudentsPatched, offerings])
  const highRiskStudents = useMemo(() => allAtRisk.filter(s => s.riskBand === 'High'), [allAtRisk])
  const highRiskCount = allAtRisk.filter(s => s.riskBand === 'High').length
  const yearGroups = useMemo(() => {
    return Array.from(new Set(offerings.map(o => o.year))).map(year => {
      const sample = offerings.find(o => o.year === year) ?? offerings[0]
      return { year, color: yearColor(year), stageInfo: sample.stageInfo, offerings: offerings.filter(o => o.year === year) }
    })
  }, [offerings])

  return (
    <PageShell size="wide">
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 18, color: '#fff' }}>{teacherInitials}</div>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 18, color: T.text }}>{greetingHeadline}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{PROFESSOR.dept} · {PROFESSOR.role}</div>
          <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 3 }}>{greetingMeta}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Btn size="sm" onClick={onOpenCalendar}>Open Calendar / Timetable</Btn>
        </div>
      </div>

      {/* Stat Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '👥', label: 'Total Students', val: total, color: T.success },
          { icon: '‼️', label: 'High Risk Students', val: highRiskCount, color: T.danger },
          { icon: '🎯', label: 'Pending Actions', val: pendingTaskCount, color: T.warning, action: onOpenPendingActions },
        ].map((s, i) => (
          <Card key={i} glow={s.color} style={{ padding: '14px 18px', cursor: s.action ? 'pointer' : 'default' }} onClick={s.action}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ ...sora, fontWeight: 800, fontSize: 24, color: s.color }}>{s.val}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Priority Alerts */}
      {highRiskCount > 0 && (
        <Card glow={T.danger} style={{ padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color={T.danger} />
            <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.danger }}>Priority Alerts</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>— {highRiskCount} high-risk students need immediate attention</div>
          </div>
          <div className="scroll-pane scroll-pane--dense" style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {highRiskStudents.map(s => {
              const off = offerings.find(o => getStudentsPatched(o).some(st => st.id === s.id))
              return (
                <div key={s.id} onClick={() => off && onOpenStudent(s as unknown as Student, off)}
                  style={{ background: T.surface2, border: `1px solid ${T.danger}25`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.danger + '60')} onMouseLeave={e => (e.currentTarget.style.borderColor = T.danger + '25')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{s.name}</div>
                    <div style={{ ...sora, fontWeight: 800, fontSize: 16, color: T.danger }}>{Math.round(s.riskProb! * 100)}%</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{off?.code ?? 'Course'} · {off?.year ?? ''} · Sec {off?.section ?? ''}</div>
                  {s.reasons[0] && <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>↳ {s.reasons[0].label}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <button aria-label="Copy student phone number" title="Copy phone" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(s.phone) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 0 }}><Phone size={11} /></button>
                    <span style={{ ...mono, fontSize: 9, color: T.accent }}>Contact →</span>
                  </div>
                </div>
              )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Year Sections */}
      {yearGroups.map(g => <YearSection key={g.year} group={g} onOpenCourse={onOpenCourse} onOpenUpload={onOpenUpload} />)}

    </PageShell>
  )
}

function YearSection({ group, onOpenCourse, onOpenUpload }: { group: YearGroup; onOpenCourse: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const { year, color, stageInfo, offerings } = group
  const [collapsed, setCollapsed] = useState(false)
  const totalStudents = offerings.reduce((a, o) => a + o.count, 0)
  const avgAtt = Math.round(offerings.reduce((a, o) => a + getOfferingAttendancePatched(o), 0) / (offerings.length || 1))
  const highRiskCount = offerings.filter(o => o.stage >= 2).reduce((a, o) => a + getStudentsPatched(o).filter(s => s.riskBand === 'High').length, 0)
  const pendingCount = offerings.filter(o => o.pendingAction).length

  return (
    <div style={{ marginBottom: 22 }}>
      <div data-pressable="true" onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: `${color}0c`, border: `1px solid ${color}28`, borderRadius: collapsed ? 10 : '10px 10px 0 0', marginBottom: collapsed ? 0 : 12, cursor: 'pointer', transition: 'all 0.2s', flexWrap: 'wrap' }}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 13, color, background: `${color}18`, border: `1px solid ${color}40`, padding: '3px 12px', borderRadius: 6 }}>{year}</div>
        <Chip color={stageInfo.color}>{stageInfo.label} · {stageInfo.desc}</Chip>
        <StagePips current={stageInfo.stage} />
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{offerings.length} class{offerings.length > 1 ? 'es' : ''} · {totalStudents} students · {avgAtt}% att</div>
        {highRiskCount > 0 && <Chip color={T.danger} size={9}>🔴 {highRiskCount} high risk</Chip>}
        {pendingCount > 0 && <Chip color={T.warning} size={9}>⚡ {pendingCount} data flags</Chip>}
        <div style={{ ...mono, fontSize: 12, color: T.dim, marginLeft: 'auto' }}>{collapsed ? '▸' : '▾'}</div>
      </div>
      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, animation: 'fadeUp 0.25s ease' }}>
          {offerings.map(o => <OfferingCard key={o.offId} o={o} yc={color} onOpen={onOpenCourse} onOpenUpload={onOpenUpload} />)}
        </div>
      )}
    </div>
  )
}

function OfferingCard({ o, yc, onOpen, onOpenUpload }: { o: Offering; yc: string; onOpen: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  const sc = o.stageInfo.color
  const avgAtt = getOfferingAttendancePatched(o)
  const ac = avgAtt >= 75 ? T.success : avgAtt >= 65 ? T.warning : T.danger
  const checks = [o.tt1Done, o.tt2Done, avgAtt >= 75]
  const highRisk = o.stage >= 2 ? getStudentsPatched(o).filter(s => s.riskBand === 'High').length : 0

  return (
    <Card onClick={() => onOpen(o)} glow={yc} style={{ position: 'relative', overflow: 'hidden', padding: '16px 18px', borderRadius: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${yc},${sc})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 10, color: yc, marginBottom: 2 }}>{o.code} · {o.dept} · Sec {o.section}</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, lineHeight: 1.25 }}>{o.title}</div>
        </div>
        <Chip color={sc} size={10}>{o.stageInfo.label}</Chip>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <Chip color={T.dim} size={9}>{o.count} students</Chip>
        <Chip color={ac} size={9}>{avgAtt}% att</Chip>
        {highRisk > 0 && <Chip color={T.danger} size={9}>🔴 {highRisk} at risk</Chip>}
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
        {['TT1', 'TT2', 'Att'].map((lbl, i) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: checks[i] ? T.success : T.border2, border: `1.5px solid ${checks[i] ? T.success : T.dim}` }} />
            <span style={{ ...mono, fontSize: 9, color: T.dim }}>{lbl}</span>
          </div>
        ))}
        <StagePips current={o.stageInfo.stage} />
      </div>
      {o.pendingAction
        ? <div style={{ background: '#f59e0b0c', border: '1px solid #f59e0b25', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>⚡</span>
            <span style={{ ...mono, fontSize: 10, color: T.warning }}>{o.pendingAction}</span>
            <button onClick={(e) => { e.stopPropagation(); onOpenUpload(o, inferKindFromPendingAction(o.pendingAction)) }} style={{ ...mono, fontSize: 9, color: T.accent, marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>Open in Hub →</button>
          </div>
        : <div style={{ background: '#10b9810c', border: '1px solid #10b98125', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>✓</span>
            <span style={{ ...mono, fontSize: 10, color: T.success }}>All caught up</span>
          </div>
      }
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════════
   MENTOR VIEW — Student-centric, cross-subject risk
   ══════════════════════════════════════════════════════════════ */

function MentorView({ mentees, tasks, onOpenMentee }: { mentees: Mentee[]; tasks: SharedTask[]; onOpenMentee: (m: Mentee) => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const sorted = [...mentees].sort((a, b) => b.avs - a.avs)
  const highRisk = mentees.filter(m => m.avs >= 0.6).length
  const medRisk = mentees.filter(m => m.avs >= 0.35 && m.avs < 0.6).length
  const lowRisk = mentees.filter(m => m.avs >= 0 && m.avs < 0.35).length
  const filteredMentees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sorted.filter(m => {
      const byRisk =
        activeFilter === 'all'
          ? true
          : activeFilter === 'high'
            ? m.avs >= 0.6
            : activeFilter === 'medium'
              ? m.avs >= 0.35 && m.avs < 0.6
              : m.avs >= 0 && m.avs < 0.35
      if (!byRisk) return false
      if (!query) return true
      const matchesText = [
        m.name,
        m.usn,
        m.dept,
        m.year,
        m.section,
        ...m.courseRisks.map(cr => `${cr.code} ${cr.title}`),
      ].join(' ').toLowerCase()
      return matchesText.includes(query)
    })
  }, [activeFilter, searchQuery, sorted])
  const pendingMentorActions = useMemo(() => {
    const menteeByUsn = new Map(mentees.map(m => [m.usn, m]))
    return tasks
      .filter(task =>
        task.assignedTo === 'Mentor'
        && !task.dismissal
        && task.status !== 'Resolved'
        && menteeByUsn.has(task.studentUsn),
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        const aDue = a.dueDateISO ?? '9999-12-31'
        const bDue = b.dueDateISO ?? '9999-12-31'
        return aDue.localeCompare(bDue)
      })
      .slice(0, 6)
  }, [mentees, tasks])

  return (
    <PageShell size="standard">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={22} color={T.accent} />
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>My Mentees</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Student-centric view · Aggregate vulnerability across all courses</div>
          </div>
        </div>
        <div style={{ minWidth: 220, flex: '1 1 280px', maxWidth: 360, position: 'relative' }}>
          <Search size={14} color={T.dim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search mentee, USN, or course"
            style={{
              width: '100%',
              padding: '9px 34px 9px 30px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface2,
              color: T.text,
              ...mono,
              fontSize: 10,
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              aria-label="Clear mentee search"
              title="Clear search"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: T.dim, cursor: 'pointer', display: 'flex' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Total Mentees', val: mentees.length, col: T.accent, key: 'all' as const, clickable: true },
          { lbl: 'High Vulnerability', val: highRisk, col: T.danger, key: 'high' as const, clickable: true },
          { lbl: 'Medium Risk', val: medRisk, col: T.warning, key: 'medium' as const, clickable: true },
          { lbl: 'Low Risk', val: lowRisk, col: T.success, key: 'low' as const, clickable: true },
        ].map((x, i) => (
          <Card
            key={i}
            glow={x.col}
            onClick={x.clickable ? () => setActiveFilter(x.key) : undefined}
            style={{
              padding: '12px 16px',
              cursor: x.clickable ? 'pointer' : 'default',
              border: x.clickable && activeFilter === x.key ? `1px solid ${x.col}` : undefined,
              boxShadow: x.clickable && activeFilter === x.key ? `0 0 0 1px ${x.col}25 inset` : undefined,
            }}
          >
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue (Pending Actions)</div>
          <Chip color={pendingMentorActions.length > 0 ? T.warning : T.success} size={9}>
            {pendingMentorActions.length} active
          </Chip>
        </div>
        {pendingMentorActions.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingMentorActions.map(task => {
              const target = mentees.find(m => m.usn === task.studentUsn || m.id === task.studentId)
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: `1px solid ${T.border}`, background: T.surface2, borderRadius: 8, padding: '9px 10px' }}>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{task.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.courseCode} · {task.due}</div>
                  </div>
                  {target && (
                    <button
                      onClick={() => onOpenMentee(target)}
                      style={{ ...mono, fontSize: 10, color: T.accent, border: `1px solid ${T.border2}`, background: 'transparent', borderRadius: 6, height: 28, padding: '0 10px', cursor: 'pointer', alignSelf: 'center', flexShrink: 0 }}
                    >
                      Open Student
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ ...mono, fontSize: 11, color: T.dim }}>No pending mentor actions right now.</div>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredMentees.map(m => {
          const avsBand = m.avs >= 0.6 ? 'High' : m.avs >= 0.35 ? 'Medium' : m.avs >= 0 ? 'Low' : null
          const avsCol = avsBand === 'High' ? T.danger : avsBand === 'Medium' ? T.warning : avsBand === 'Low' ? T.success : T.dim
          return (
            <Card key={m.id} glow={avsCol} style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => onOpenMentee(m)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text }}>{m.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 1 }}>{m.usn} · {m.year} · Sec {m.section} · {m.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {m.avs >= 0 ? (
                    <>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: avsCol }}>{Math.round(m.avs * 100)}%</div>
                      <div style={{ ...mono, fontSize: 9, color: T.muted }}>Aggregate Vulnerability</div>
                    </>
                  ) : (
                    <Chip color={T.dim} size={10}>Awaiting TT1</Chip>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {m.courseRisks.map(cr => {
                  const rCol = cr.risk >= 0.7 ? T.danger : cr.risk >= 0.35 ? T.warning : cr.risk >= 0 ? T.success : T.dim
                  return (
                    <div key={cr.code} style={{ flex: '1 1 140px', background: T.surface2, borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>{cr.code}</span>
                        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: rCol }}>{cr.risk >= 0 ? `${Math.round(cr.risk * 100)}%` : '—'}</span>
                      </div>
                      <Bar val={cr.risk >= 0 ? cr.risk * 100 : 0} color={rCol} h={4} />
                      <div style={{ ...mono, fontSize: 8, color: T.dim, marginTop: 2 }}>{cr.title.slice(0, 25)}</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.interventions.length > 0 ? (
                  <>
                    <Chip color={T.warning} size={9}>Last: {m.interventions[m.interventions.length - 1].date}</Chip>
                    <span style={{ ...mono, fontSize: 10, color: T.muted }}>{m.interventions[m.interventions.length - 1].note.slice(0, 40)}…</span>
                  </>
                ) : (
                  <span style={{ ...mono, fontSize: 10, color: T.dim }}>No interventions logged</span>
                )}
                {m.prevCgpa > 0 && <Chip color={T.dim} size={9}>CGPA: {m.prevCgpa.toFixed(1)}</Chip>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button aria-label={`Copy ${m.name} phone number`} title="Copy phone" onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(m.phone) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Phone size={13} /></button>
                  <button aria-label={`Email ${m.name}`} title="Email" onClick={e => e.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent }}><Mail size={13} /></button>
                </div>
              </div>
            </Card>
          )
        })}
        {filteredMentees.length === 0 && (
          <Card style={{ padding: '16px 18px' }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>
              No mentees found for this filter.
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  )
}

function MenteeDetailPage({ mentee, onBack, onOpenHistory }: { mentee: Mentee; onBack: () => void; onOpenHistory: (mentee: Mentee) => void }) {
  const [activeInsight, setActiveInsight] = useState<'risk' | 'cgpa'>('risk')
  const avgCourseRisk = mentee.avs >= 0 ? Math.round(mentee.courseRisks.filter(r => r.risk >= 0).reduce((acc, risk) => acc + risk.risk, 0) / Math.max(1, mentee.courseRisks.filter(r => r.risk >= 0).length) * 100) : null
  const history = useMemo(() => getStudentHistoryRecord({
    usn: mentee.usn,
    studentName: mentee.name,
    dept: mentee.dept,
    yearLabel: mentee.year,
    prevCgpa: mentee.prevCgpa,
  }), [mentee.dept, mentee.name, mentee.prevCgpa, mentee.usn, mentee.year])
  const sgpaSeries = useMemo(
    () => [...history.terms]
      .sort((a, b) => a.semesterNumber - b.semesterNumber)
      .map(term => ({ label: `S${term.semesterNumber}`, value: term.sgpa })),
    [history.terms],
  )
  const maxSgpa = sgpaSeries.reduce((best, point) => point.value > best.value ? point : best, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const minSgpa = sgpaSeries.reduce((worst, point) => point.value < worst.value ? point : worst, sgpaSeries[0] ?? { label: 'S1', value: 0 })
  const subjectStats = useMemo(() => {
    const allSubjects = history.terms.flatMap(term => term.subjects.map(subject => ({ ...subject, termLabel: term.label })))
    const best = allSubjects.reduce((winner, subject) => subject.score > winner.score ? subject : winner, allSubjects[0] ?? null)
    const lowest = allSubjects.reduce((loser, subject) => subject.score < loser.score ? subject : loser, allSubjects[0] ?? null)
    return { best, lowest }
  }, [history.terms])
  const riskDrivers = [...mentee.courseRisks]
    .filter(r => r.risk >= 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 3)
  const prioritizedCourseRisks = useMemo(
    () => [...mentee.courseRisks].filter(risk => risk.risk >= 0).sort((left, right) => right.risk - left.risk),
    [mentee.courseRisks],
  )
  const totalRiskWeight = useMemo(
    () => prioritizedCourseRisks.reduce((sum, risk) => sum + risk.risk, 0),
    [prioritizedCourseRisks],
  )

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 22, color: T.text }}>{mentee.name}</div>
          <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 3 }}>{mentee.usn} · {mentee.year} · Sec {mentee.section} · {mentee.dept}</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Mentor workspace with intervention context, summary academics, and transcript entry point.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(mentee.phone)}><Phone size={12} /> Copy Phone</Btn>
          <Btn size="sm" onClick={() => onOpenHistory(mentee)}><Eye size={12} /> View Student History</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card
          glow={mentee.avs >= 0.6 ? T.danger : mentee.avs >= 0.35 ? T.warning : T.success}
          onClick={() => setActiveInsight('risk')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'risk' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: mentee.avs >= 0.6 ? T.danger : mentee.avs >= 0.35 ? T.warning : T.success }}>
            {mentee.avs >= 0 ? `${Math.round(mentee.avs * 100)}%` : 'Awaiting TT1'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Aggregate Risk (click for why)</div>
        </Card>
        <Card
          glow={mentee.prevCgpa >= 7 ? T.success : mentee.prevCgpa >= 6 ? T.warning : T.danger}
          onClick={() => setActiveInsight('cgpa')}
          style={{ padding: '12px 16px', cursor: 'pointer', border: activeInsight === 'cgpa' ? `1px solid ${T.accent}` : undefined }}
        >
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: mentee.prevCgpa >= 7 ? T.success : mentee.prevCgpa >= 6 ? T.warning : T.danger }}>
            {mentee.prevCgpa > 0 ? mentee.prevCgpa.toFixed(1) : '—'}
          </div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Prev CGPA (click for trend)</div>
        </Card>
        <Card glow={T.accent} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.accent }}>{mentee.courseRisks.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Tracked Courses</div>
        </Card>
        <Card glow={T.warning} style={{ padding: '12px 16px' }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.warning }}>{mentee.interventions.length}</div>
          <div style={{ ...mono, fontSize: 9, color: T.muted }}>Interventions Logged</div>
        </Card>
      </div>

      {activeInsight === 'risk' && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Why Aggregate Risk is {mentee.avs >= 0 ? `${Math.round(mentee.avs * 100)}%` : 'unavailable'}</div>
          {riskDrivers.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {riskDrivers.map(driver => {
                const color = driver.risk >= 0.7 ? T.danger : driver.risk >= 0.35 ? T.warning : T.success
                const contribution = totalRiskWeight > 0 ? Math.round((driver.risk / totalRiskWeight) * 100) : 0
                return (
                  <div key={driver.code} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{driver.code} · {driver.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>
                          {driver.risk >= 0.7 ? 'Major contributor' : driver.risk >= 0.35 ? 'Medium contributor' : 'Minor contributor'} · ~{contribution}% of current total
                        </div>
                      </div>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 16, color }}>{Math.round(driver.risk * 100)}%</div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Bar val={driver.risk * 100} color={color} h={4} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ ...mono, fontSize: 11, color: T.dim }}>Risk breakdown will appear after course-level data is available.</div>
          )}
        </Card>
      )}

      {activeInsight === 'cgpa' && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Previous GPA Trend & Subject Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 8 }}>SGPA by semester</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {sgpaSeries.map(point => (
                  <div key={point.label} style={{ flex: 1, minWidth: 30 }}>
                    <div style={{ height: `${Math.max(10, Math.round((point.value / 10) * 100))}%`, background: T.accent + 'aa', border: `1px solid ${T.accent}66`, borderRadius: '6px 6px 3px 3px' }} />
                    <div style={{ ...mono, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 5 }}>{point.label}</div>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, textAlign: 'center' }}>{point.value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 7, alignContent: 'start' }}>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Max SGPA: <span style={{ color: T.success }}>{maxSgpa.value.toFixed(2)}</span> ({maxSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>Min SGPA: <span style={{ color: T.danger }}>{minSgpa.value.toFixed(2)}</span> ({minSgpa.label})</div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>
                Best Subject: <span style={{ color: T.success }}>{subjectStats.best ? `${subjectStats.best.code} (${subjectStats.best.score})` : '—'}</span>
              </div>
              <div style={{ ...mono, fontSize: 11, color: T.text }}>
                Lowest Subject: <span style={{ color: T.warning }}>{subjectStats.lowest ? `${subjectStats.lowest.code} (${subjectStats.lowest.score})` : '—'}</span>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>
                {subjectStats.best?.title ?? 'No subject data'} | {subjectStats.lowest?.title ?? 'No subject data'}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 10 }}>Mentor Priority Queue</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {prioritizedCourseRisks.map((risk, index) => {
              const color = risk.risk >= 0.7 ? T.danger : risk.risk >= 0.35 ? T.warning : risk.risk >= 0 ? T.success : T.dim
              const guidance = risk.risk >= 0.7
                ? 'Immediate 1:1 check-in and weekly follow-up'
                : risk.risk >= 0.5
                  ? 'Create remedial task and review after next assessment'
                  : risk.risk >= 0.35
                    ? 'Monitor attendance and assign targeted practice'
                    : 'Keep under watch and reinforce consistency'
              return (
                <div key={risk.code} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div>
                      <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>P{index + 1} · {risk.code}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{risk.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 18, color }}>{risk.risk >= 0 ? `${Math.round(risk.risk * 100)}%` : '—'}</div>
                      <div style={{ ...mono, fontSize: 9, color: T.dim }}>{risk.risk >= 0 ? `${risk.band} vulnerability` : 'Awaiting data'}</div>
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginBottom: 6 }}>{guidance}</div>
                  <Bar val={risk.risk >= 0 ? risk.risk * 100 : 0} color={color} h={5} />
                </div>
              )
            })}
            {prioritizedCourseRisks.length === 0 && <div style={{ ...mono, fontSize: 11, color: T.dim }}>Course priorities will appear once risk inputs are available.</div>}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Mentor Summary</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              {avgCourseRisk !== null ? `Average course risk is ${avgCourseRisk}%.` : 'No score-based risk yet.'}
              {' '}Previous-semester CGPA is {history.currentCgpa > 0 ? history.currentCgpa.toFixed(2) : 'not yet available'}.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {mentee.courseRisks.filter(r => r.risk >= 0.5).map(r => <Chip key={r.code} color={r.risk >= 0.7 ? T.danger : T.warning} size={9}>{r.code}</Chip>)}
              {mentee.courseRisks.every(r => r.risk < 0.5) && <Chip color={T.success} size={9}>No current high-risk courses</Chip>}
            </div>
          </Card>

          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Intervention Timeline</div>
            {mentee.interventions.length > 0 ? mentee.interventions.map((entry, index) => (
              <div key={`${entry.date}-${index}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: index < mentee.interventions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 56 }}>{entry.date}</div>
                <Chip color={T.warning} size={9}>{entry.type}</Chip>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>{entry.note}</div>
              </div>
            )) : (
              <div style={{ ...mono, fontSize: 11, color: T.dim }}>No interventions logged for this mentee yet.</div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

function UnlockReviewPage({ task, offering, onBack, onApprove, onReject, onResetComplete }: { task: SharedTask; offering: Offering | null; onBack: () => void; onApprove: () => void; onReject: () => void; onResetComplete: () => void }) {
  return (
    <PageShell size="narrow">
      <PageBackButton onClick={onBack} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Unlock Review</div>
        <div style={{ ...mono, fontSize: 11, color: T.accent, marginTop: 4 }}>{task.courseCode} · {offering?.title ?? task.courseName} · {task.unlockRequest?.kind.toUpperCase()}</div>
      </div>
      <Card glow={task.unlockRequest?.status === 'Rejected' ? T.danger : T.warning} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip color={T.accent} size={9}>Requested by: {task.unlockRequest?.requestedByRole ?? task.sourceRole}</Chip>
          <Chip color={task.unlockRequest?.status === 'Rejected' ? T.danger : task.unlockRequest?.status === 'Reset Completed' ? T.success : T.warning} size={9}>Status: {task.unlockRequest?.status ?? 'Pending'}</Chip>
          <Chip color={T.dim} size={9}>Submitted: {formatDateTime(task.unlockRequest?.requestedAt)}</Chip>
        </div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>{task.actionHint}</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Request Details</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Offering: {offering?.code ?? task.courseCode} · Sec {offering?.section ?? '—'}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current owner: {task.assignedTo}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Reason: {task.actionHint}</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Teacher note: {task.unlockRequest?.requestNote ?? task.requestNote ?? 'No request note captured'}</div>
            {task.unlockRequest?.handoffNote && <div style={{ ...mono, fontSize: 11, color: T.muted }}>Handoff note: {task.unlockRequest.handoffNote}</div>}
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>Latest review note: {task.unlockRequest?.reviewNote ?? 'No review note yet'}</div>
          </div>
        </Card>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Decision Flow</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 10 }}>Approve to allow a correction cycle, reject if the lock should stand, and then complete reset/unlock explicitly.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {task.unlockRequest?.status === 'Pending' && (
              <>
                <Btn size="sm" onClick={onApprove}>Approve</Btn>
                <Btn size="sm" variant="danger" onClick={onReject}>Reject</Btn>
              </>
            )}
            {task.unlockRequest?.status === 'Approved' && <Btn size="sm" onClick={onResetComplete}>Reset & Unlock</Btn>}
            {(task.unlockRequest?.status === 'Rejected' || task.unlockRequest?.status === 'Reset Completed') && <Chip color={task.unlockRequest.status === 'Rejected' ? T.danger : T.success} size={9}>Decision completed</Chip>}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10 }}>Transition History</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(task.transitionHistory ?? []).map(transition => (
            <div key={transition.id} style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 112 }}>{formatDateTime(transition.at)}</div>
              <div>
                <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.action}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted }}>{transition.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  )
}

function QueueHistoryPage({ role, tasks, resolvedTaskIds, onBack, onOpenTaskStudent, onOpenUnlockReview, onRestoreTask }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onBack: () => void; onOpenTaskStudent: (task: SharedTask) => void; onOpenUnlockReview: (taskId: string) => void; onRestoreTask: (taskId: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved' | 'dismissed'>('all')
  const visible = tasks
    .filter(task => {
      if (filter === 'all') return true
      if (filter === 'active') return !resolvedTaskIds[task.id] && !task.dismissal
      if (filter === 'resolved') return !!resolvedTaskIds[task.id]
      return !!task.dismissal
    })
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

  return (
    <PageShell size="standard">
      <PageBackButton onClick={onBack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Queue History</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{role} view of active, resolved, and reassigned items.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'resolved', 'dismissed'] as const).map(option => (
            <button key={option} data-tab="true" onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '5px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? T.accent + '18' : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map(task => (
          <Card key={task.id} onClick={() => onOpenTaskStudent(task)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{task.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.studentUsn} · {task.courseCode || 'Mentor context'}</div>
                <div style={{ ...mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Open the related student context directly from anywhere on this card.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={resolvedTaskIds[task.id] ? T.success : task.dismissal ? T.muted : T.warning} size={9}>{resolvedTaskIds[task.id] ? 'Resolved' : task.dismissal ? 'Dismissed' : 'Active'}</Chip>
                {task.dismissal && <Chip color={task.dismissal.kind === 'series' ? T.danger : T.muted} size={9}>{task.dismissal.kind === 'series' ? 'Series dismissed' : 'Dismissed'}</Chip>}
                <Chip color={task.assignedTo === 'HoD' ? T.danger : task.assignedTo === 'Mentor' ? T.warning : T.accent} size={9}>{task.assignedTo}</Chip>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
              {(task.transitionHistory ?? []).map(transition => (
                <div key={transition.id} style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, minWidth: 112 }}>{formatDateTime(transition.at)}</div>
                  <div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.action}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted }}>{transition.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div onClick={event => event.stopPropagation()}><Btn size="sm" variant="ghost" onClick={() => onOpenTaskStudent(task)}>Open Student</Btn></div>
              {task.dismissal && <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onRestoreTask(task.id)}>{task.dismissal.kind === 'series' ? 'Resume series' : 'Restore'}</Btn></div>}
              {task.unlockRequest && role === 'HoD' && <div onClick={event => event.stopPropagation()}><Btn size="sm" onClick={() => onOpenUnlockReview(task.id)}>Open Unlock Review</Btn></div>}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}

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
  initialTeacherId: string
  initialRole: Role
  onLogout: () => Promise<void> | void
  onRoleChange?: (role: Role) => Promise<void> | void
  loadFacultyProfile?: (facultyId: string) => Promise<ApiAcademicFacultyProfile>
  academicBootstrap?: ApiAcademicBootstrap | null
}

function OperationalWorkspace({
  repositories,
  initialTeacherId,
  initialRole,
  onLogout,
  onRoleChange,
  loadFacultyProfile,
  academicBootstrap = null,
}: OperationalWorkspaceProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [isCompactTopbar, setIsCompactTopbar] = useState(() => window.innerWidth < 980)
  const [showTopbarMenu, setShowTopbarMenu] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(initialTeacherId)
  const currentTeacher = useMemo<FacultyAccount | null>(() => currentTeacherId ? (FACULTY.find(faculty => faculty.facultyId === currentTeacherId) ?? null) : null, [currentTeacherId])
  const [role, setRole] = useState<Role>(initialRole)
  const [page, setPage] = useState<PageId>(() => getHomePage(initialRole))
  const [offering, setOffering] = useState<Offering | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null)
  const [selectedMentee, setSelectedMentee] = useState<Mentee | null>(null)
  const [historyProfile, setHistoryProfile] = useState<StudentHistoryRecord | null>(null)
  const [historyBackPage, setHistoryBackPage] = useState<PageId | null>(null)
  const [selectedUnlockTaskId, setSelectedUnlockTaskId] = useState<string | null>(null)
  const [schemeOfferingId, setSchemeOfferingId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1100)
  const [showActionQueue, setShowActionQueue] = useState(() => window.innerWidth >= 1100)
  const actionQueueRef = useRef<HTMLDivElement | null>(null)
  const [uploadOffering, setUploadOffering] = useState<Offering | null>(null)
  const [uploadKind, setUploadKind] = useState<EntryKind>('tt1')
  const [entryOfferingId, setEntryOfferingId] = useState<string>(OFFERINGS[0].offId)
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
  const [studentPatches, setStudentPatches] = useState<Record<string, StudentRuntimePatch>>(() => repositories.entryData.getStudentPatchesSnapshot())
  const [schemeByOffering, setSchemeByOffering] = useState<Record<string, SchemeState>>(() => repositories.entryData.getSchemeStateSnapshot(OFFERINGS))
  const [ttBlueprintsByOffering, setTtBlueprintsByOffering] = useState<Record<string, Record<TTKind, TermTestBlueprint>>>(() => repositories.entryData.getBlueprintSnapshot(OFFERINGS))
  const [lockAuditByTarget, setLockAuditByTarget] = useState<Record<string, QueueTransition[]>>(() => repositories.locksAudit.getLockAuditSnapshot())
  const selectors = useMemo(() => createAppSelectors({ studentPatches, schemeByOffering, ttBlueprintsByOffering }), [schemeByOffering, studentPatches, ttBlueprintsByOffering])
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
  }, [currentTeacher?.facultyId, loadFacultyProfile])
  useEffect(() => {
    if (allowedRoles.length === 0) return
    const nextRole = allowedRoles.includes(initialRole)
      ? initialRole
      : allowedRoles.includes(role)
        ? role
        : allowedRoles[0]
    setRole(nextRole)
    setPage(getHomePage(nextRole))
  }, [allowedRoles, initialRole, role])
  useEffect(() => {
    if (role === 'Course Leader' && page === 'students') {
      setPage('dashboard')
    }
  }, [page, role])
  const capabilities = useMemo<FacultyCapabilitySet>(() => ({
    canApproveUnlock: role === 'HoD',
    canEditMarks: role === 'Course Leader',
  }), [role])
  const assignedOfferings = useMemo(() => {
    if (!currentTeacher) return OFFERINGS
    if (role === 'HoD') return OFFERINGS
    return OFFERINGS.filter(o => currentTeacher.courseCodes.includes(o.code))
  }, [currentTeacher, role])
  const assignedMentees = useMemo(() => {
    if (!currentTeacher) return MENTEES
    const ids = new Set(currentTeacher.menteeIds)
    return MENTEES.filter(m => ids.has(m.id))
  }, [currentTeacher])

  const [lockByOffering, setLockByOffering] = useState<Record<string, EntryLockMap>>(() => repositories.locksAudit.getLockSnapshot(OFFERINGS))
  const [draftBySection, setDraftBySection] = useState<Record<string, number>>(() => repositories.entryData.getDraftSnapshot())
  const [cellValues, setCellValues] = useState<Record<string, number>>(() => repositories.entryData.getCellValueSnapshot())
  const [allTasksList, setAllTasksList] = useState<SharedTask[]>(() => repositories.tasks.getTasksSnapshot(() => {
    const courseLeaderTasks: SharedTask[] = generateTasks().map(t => ({
      ...t,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: 'Follow-up',
      assignedTo: 'Course Leader',
      transitionHistory: [createTransition({ action: 'Created from automatic high-risk trigger', actorRole: 'Auto', toOwner: 'Course Leader', note: 'Student crossed automatic academic-risk threshold.' })],
    }))
    const mentorTasks: SharedTask[] = MENTEES
      .filter(m => m.avs >= 0.5)
      .slice(0, 8)
      .map((m, i) => ({
        id: `mentor-seed-${m.id}-${i}`,
        studentId: m.id,
        studentName: m.name,
        studentUsn: m.usn,
        offeringId: '',
        courseCode: m.courseRisks[0]?.code ?? 'GEN',
        courseName: m.courseRisks[0]?.title ?? 'Mentor Follow-up',
        year: m.year,
        riskProb: m.avs,
        riskBand: m.avs >= 0.7 ? 'High' : m.avs >= 0.35 ? 'Medium' : 'Low',
        title: `Mentor follow-up with ${m.name.split(' ')[0]}`,
        due: 'This week',
        status: m.interventions.length > 0 ? 'In Progress' : 'New',
        actionHint: 'Mentor intervention and counselling review',
        priority: Math.round(m.avs * 100),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        taskType: 'Follow-up' as TaskType,
        assignedTo: 'Mentor',
        transitionHistory: [createTransition({ action: 'Created from mentor vulnerability watchlist', actorRole: 'Auto', toOwner: 'Mentor', note: 'Seeded mentor queue item for mock walkthrough.' })],
      }))
    const cs401A = OFFERINGS.find(item => item.code === 'CS401' && item.section === 'A') ?? OFFERINGS[0]
    const cs403C = OFFERINGS.find(item => item.code === 'CS403' && item.section === 'C') ?? OFFERINGS[0]
    const overdueRemedial: SharedTask = {
      id: 'seed-remedial-overdue-m1',
      studentId: 'm1',
      studentName: 'Aarav Sharma',
      studentUsn: '1MS23CS001',
      offeringId: cs401A.offId,
      courseCode: cs401A.code,
      courseName: cs401A.title,
      year: cs401A.year,
      riskProb: 0.82,
      riskBand: 'High',
      title: 'Overdue remedial follow-up for Aarav',
      due: 'Overdue',
      dueDateISO: '2026-03-05',
      status: 'In Progress',
      actionHint: 'Check-in slipped past due date; mentor follow-up is overdue.',
      priority: 92,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: 'Remedial',
      assignedTo: 'Mentor',
      sourceRole: 'Course Leader',
      manual: true,
      remedialPlan: {
        planId: 'plan-aarav-overdue',
        title: 'Algorithm recovery sprint',
        createdAt: Date.now(),
        ownerRole: 'Mentor',
        dueDateISO: '2026-03-05',
        checkInDatesISO: ['2026-03-03', '2026-03-08'],
        steps: [
          { id: 'step-1', label: 'Attend remedial on recurrence relations', completedAt: Date.now() - 86_400_000 },
          { id: 'step-2', label: 'Submit guided practice sheet' },
          { id: 'step-3', label: 'Mentor review discussion' },
        ],
      },
      transitionHistory: [
        createTransition({ action: 'Created and deferred to Mentor', actorRole: 'Course Leader', fromOwner: 'Course Leader', toOwner: 'Mentor', note: 'High-risk case handed to mentor for ongoing support.' }),
        createTransition({ action: 'Remedial check-in logged', actorRole: 'Mentor', fromOwner: 'Mentor', toOwner: 'Mentor', note: 'Initial remedial session completed; next step is overdue.' }),
      ],
    }
    const pendingUnlockTask: SharedTask = {
      id: 'seed-unlock-pending-cs401a-tt1',
      studentId: `${cs401A.offId}-tt1-lock`,
      studentName: 'Class Data Lock',
      studentUsn: 'N/A',
      offeringId: cs401A.offId,
      courseCode: cs401A.code,
      courseName: cs401A.title,
      year: cs401A.year,
      riskProb: 0.45,
      riskBand: 'Medium',
      title: `Unlock request: ${cs401A.code} Sec ${cs401A.section} · TT1`,
      due: 'Today',
      status: 'New',
      actionHint: 'Course Leader requested HoD unlock for TT1 correction after late moderation issue.',
      priority: 80,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: 'Academic',
      assignedTo: 'HoD',
      escalated: true,
      sourceRole: 'Course Leader',
      manual: true,
      requestNote: 'Late moderation issue was discovered after TT1 lock. Need controlled correction for a small set of students.',
      handoffNote: 'Please unlock TT1 once moderation discrepancy is verified.',
      unlockRequest: {
        offeringId: cs401A.offId,
        kind: 'tt1',
        status: 'Pending',
        requestedByRole: 'Course Leader',
        requestedByFacultyId: 't1',
        requestedAt: Date.now(),
        requestNote: 'Late moderation issue was discovered after TT1 lock. Need controlled correction for a small set of students.',
        handoffNote: 'Please unlock TT1 once moderation discrepancy is verified.',
      },
      transitionHistory: [createTransition({ action: 'Unlock requested', actorRole: 'Course Leader', fromOwner: 'Course Leader', toOwner: 'HoD', note: 'Seeded pending unlock example for mock review flow.' })],
    }
    const rejectedUnlockTask: SharedTask = {
      id: 'seed-unlock-rejected-cs403c-tt1',
      studentId: `${cs403C.offId}-tt1-lock`,
      studentName: 'Class Data Lock',
      studentUsn: 'N/A',
      offeringId: cs403C.offId,
      courseCode: cs403C.code,
      courseName: cs403C.title,
      year: cs403C.year,
      riskProb: 0.35,
      riskBand: 'Medium',
      title: `Unlock request: ${cs403C.code} Sec ${cs403C.section} · TT1`,
      due: 'Resolved',
      status: 'Resolved',
      actionHint: 'Rejected after HoD confirmed mark sheet was already ratified.',
      priority: 60,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType: 'Academic',
      assignedTo: 'HoD',
      escalated: true,
      sourceRole: 'Course Leader',
      manual: true,
      requestNote: 'Requested TT1 unlock for a re-evaluation challenge, but the sheet had already been ratified.',
      handoffNote: 'Please review whether this ratified sheet can be reopened.',
      unlockRequest: {
        offeringId: cs403C.offId,
        kind: 'tt1',
        status: 'Rejected',
        requestedByRole: 'Course Leader',
        requestedByFacultyId: 't1',
        requestedAt: Date.now() - 86_400_000,
        requestNote: 'Requested TT1 unlock for a re-evaluation challenge, but the sheet had already been ratified.',
        handoffNote: 'Please review whether this ratified sheet can be reopened.',
        reviewedAt: Date.now() - 43_200_000,
        reviewNote: 'Ratified score sheet should not be reopened.',
      },
      transitionHistory: [
        createTransition({ action: 'Unlock requested', actorRole: 'Course Leader', fromOwner: 'Course Leader', toOwner: 'HoD', note: 'Seeded rejected unlock case.' }),
        createTransition({ action: 'Unlock rejected', actorRole: 'HoD', fromOwner: 'HoD', toOwner: 'HoD', note: 'Ratified sheet must remain locked.' }),
      ],
    }
    return [...courseLeaderTasks, overdueRemedial, pendingUnlockTask, rejectedUnlockTask, ...mentorTasks]
  }))
  const [resolvedTasks, setResolvedTasks] = useState<Record<string, number>>(() => repositories.tasks.getResolvedTasksSnapshot({ 'seed-unlock-rejected-cs403c-tt1': Date.now() - 43_200_000 }))
  const [timetableByFacultyId, setTimetableByFacultyId] = useState<Record<string, FacultyTimetableTemplate>>(() => repositories.calendar.getTimetableTemplatesSnapshot(FACULTY, OFFERINGS))
  const [taskPlacements, setTaskPlacements] = useState<Record<string, TaskCalendarPlacement>>(() => repositories.calendar.getTaskPlacementsSnapshot())
  const [calendarAuditEvents, setCalendarAuditEvents] = useState<CalendarAuditEvent[]>(() => repositories.calendar.getCalendarAuditSnapshot())
  const [academicMeetings, setAcademicMeetings] = useState<AcademicMeeting[]>(() => repositories.calendar.getMeetingsSnapshot())

  useEffect(() => {
    setStudentPatches(repositories.entryData.getStudentPatchesSnapshot())
    setSchemeByOffering(repositories.entryData.getSchemeStateSnapshot(OFFERINGS))
    setTtBlueprintsByOffering(repositories.entryData.getBlueprintSnapshot(OFFERINGS))
    setLockAuditByTarget(repositories.locksAudit.getLockAuditSnapshot())
    setLockByOffering(repositories.locksAudit.getLockSnapshot(OFFERINGS))
    setDraftBySection(repositories.entryData.getDraftSnapshot())
    setCellValues(repositories.entryData.getCellValueSnapshot())
    setAllTasksList(repositories.tasks.getTasksSnapshot(() => []))
    setResolvedTasks(repositories.tasks.getResolvedTasksSnapshot({}))
    setTimetableByFacultyId(repositories.calendar.getTimetableTemplatesSnapshot(FACULTY, OFFERINGS))
    setTaskPlacements(repositories.calendar.getTaskPlacementsSnapshot())
    setCalendarAuditEvents(repositories.calendar.getCalendarAuditSnapshot())
    setAcademicMeetings(repositories.calendar.getMeetingsSnapshot())
  }, [repositories])

  useEffect(() => { void repositories.locksAudit.saveLocks(lockByOffering) }, [lockByOffering, repositories])
  useEffect(() => { void repositories.entryData.saveDrafts(draftBySection) }, [draftBySection, repositories])
  useEffect(() => { void repositories.entryData.saveCellValues(cellValues) }, [cellValues, repositories])
  useEffect(() => { void repositories.tasks.saveTasks(allTasksList) }, [allTasksList, repositories])
  useEffect(() => { void repositories.tasks.saveResolvedTasks(resolvedTasks) }, [repositories, resolvedTasks])
  useEffect(() => { void repositories.calendar.saveTimetableTemplates(timetableByFacultyId) }, [repositories, timetableByFacultyId])
  useEffect(() => { void repositories.calendar.saveTaskPlacements(taskPlacements) }, [repositories, taskPlacements])
  useEffect(() => { void repositories.calendar.saveCalendarAudit(calendarAuditEvents) }, [calendarAuditEvents, repositories])
  useEffect(() => { void repositories.entryData.saveStudentPatches(studentPatches) }, [repositories, studentPatches])
  useEffect(() => { void repositories.entryData.saveSchemeState(schemeByOffering) }, [repositories, schemeByOffering])
  useEffect(() => { void repositories.entryData.saveBlueprintState(ttBlueprintsByOffering) }, [repositories, ttBlueprintsByOffering])
  useEffect(() => { void repositories.locksAudit.saveLockAudit(lockAuditByTarget) }, [lockAuditByTarget, repositories])

  const supervisedOfferingIds = useMemo(() => new Set(assignedOfferings.map(o => o.offId)), [assignedOfferings])
  const supervisedMenteeIds = useMemo(() => new Set(assignedMentees.map(m => m.id)), [assignedMentees])
  const supervisedMenteeUsns = useMemo(() => new Set(assignedMentees.map(m => m.usn)), [assignedMentees])
  const calendarOfferingIds = useMemo(() => new Set(currentTeacher?.offeringIds ?? []), [currentTeacher])
  const calendarMenteeIds = useMemo(() => new Set(currentTeacher?.menteeIds ?? []), [currentTeacher])
  const calendarMenteeUsns = useMemo(() => new Set(
    MENTEES
      .filter(mentee => calendarMenteeIds.has(mentee.id))
      .map(mentee => mentee.usn),
  ), [calendarMenteeIds])
  const calendarOfferings = useMemo(() => OFFERINGS.filter(item => calendarOfferingIds.has(item.offId)), [calendarOfferingIds])
  const currentFacultyTimetable = useMemo(() => currentTeacher ? (timetableByFacultyId[currentTeacher.facultyId] ?? null) : null, [currentTeacher, timetableByFacultyId])
  const currentFacultyCalendarMarkers = useMemo(
    () => currentTeacher
      ? (academicBootstrap?.runtime.adminCalendarByFacultyId?.[currentTeacher.facultyId]?.markers ?? [])
      : [],
    [academicBootstrap, currentTeacher],
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
    const sourceOffering = OFFERINGS.find(item => item.offId === offeringId) ?? OFFERINGS[0]
    const basePaper = PAPER_MAP[sourceOffering?.code ?? OFFERINGS[0].code] || PAPER_MAP.default
    return {
      tt1: seedBlueprintFromPaper('tt1', basePaper),
      tt2: seedBlueprintFromPaper('tt2', basePaper),
    }
  }, [academicBootstrap])

  const roleTasks = useMemo(() => {
    const base = allTasksList.filter(t => t.assignedTo === role)
    if (role === 'HoD') return base
    if (role === 'Course Leader') return base.filter(t => supervisedOfferingIds.has(t.offeringId))
    const mentorScopedIds = new Set([...Array.from(supervisedMenteeIds), ...Array.from(supervisedMenteeIds).map(id => `mentee-${id}`)])
    return base.filter(t => mentorScopedIds.has(t.studentId) || supervisedMenteeUsns.has(t.studentUsn))
  }, [allTasksList, role, supervisedOfferingIds, supervisedMenteeIds, supervisedMenteeUsns])

  const pendingActionCount = roleTasks.filter(task => isTaskActiveForQueue(task, resolvedTasks, toTodayISO())).length
  const layoutMode: LayoutMode = !sidebarCollapsed && showActionQueue
    ? 'three-column'
    : (!sidebarCollapsed || showActionQueue ? 'split' : 'focus')
  
  const navItems = role === 'Course Leader' ? CL_NAV : role === 'Mentor' ? MENTOR_NAV : HOD_NAV
  const hasEntryStartedForOffering = useCallback((offId: string) => {
    const hasDraft = Object.keys(draftBySection).some(key => key.startsWith(`${offId}::`))
    const hasCells = Object.keys(cellValues).some(key => key.startsWith(`${offId}::`))
    const locks = lockByOffering[offId]
    const hasAnyLock = locks ? Object.values(locks).some(Boolean) : false
    return hasDraft || hasCells || hasAnyLock
  }, [cellValues, draftBySection, lockByOffering])
  const taskComposerOfferings = useMemo(() => {
    if (taskComposer.availableOfferingIds && taskComposer.availableOfferingIds.length > 0) {
      return OFFERINGS.filter(item => taskComposer.availableOfferingIds?.includes(item.offId))
    }
    return role === 'HoD' ? OFFERINGS : (assignedOfferings.length > 0 ? assignedOfferings : OFFERINGS)
  }, [assignedOfferings, role, taskComposer.availableOfferingIds])
  const selectedSchemeOffering = schemeOfferingId ? (OFFERINGS.find(item => item.offId === schemeOfferingId) ?? null) : null
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
    offering,
    page,
    schemeOfferingId,
    selectedMentee,
    selectedUnlockTaskId,
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
    setOffering(snapshot.offeringId ? (OFFERINGS.find(item => item.offId === snapshot.offeringId) ?? null) : null)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setSelectedMentee(snapshot.selectedMenteeId ? (MENTEES.find(item => item.id === snapshot.selectedMenteeId) ?? null) : null)
    setHistoryProfile(snapshot.historyProfile)
    setHistoryBackPage(snapshot.historyBackPage)
    setSelectedUnlockTaskId(snapshot.selectedUnlockTaskId)
    setSchemeOfferingId(snapshot.schemeOfferingId)
    setUploadOffering(snapshot.uploadOfferingId ? (OFFERINGS.find(item => item.offId === snapshot.uploadOfferingId) ?? null) : null)
    setUploadKind(snapshot.uploadKind)
    setEntryOfferingId(snapshot.entryOfferingId)
    setEntryKind(snapshot.entryKind)
    setCourseInitialTab(snapshot.courseInitialTab)
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
    const params = new URLSearchParams(window.location.search)
    if (![...params.keys()].some(key => key.startsWith('mock'))) {
      auditParamsApplied.current = true
      return
    }
    const mockTeacher = params.get('mockTeacher')
    if (mockTeacher && currentTeacherId !== mockTeacher) {
      const mockFaculty = FACULTY.find(faculty => faculty.facultyId === mockTeacher)
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const targetOffering = mockOfferingId ? (OFFERINGS.find(item => item.offId === mockOfferingId) ?? null) : null
    const mockStudentUsn = params.get('mockStudentUsn')
    const targetStudent = mockStudentUsn && targetOffering ? (getStudentsPatched(targetOffering).find(student => student.usn === mockStudentUsn) ?? null) : null
    const mockMenteeId = params.get('mockMenteeId')
    const targetMentee = mockMenteeId ? (MENTEES.find(mentee => mentee.id === mockMenteeId) ?? null) : null
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
        const nextHistory = buildHistoryProfile({ student: targetStudent, offering: targetOffering })
        if (nextHistory) setHistoryProfile(nextHistory)
      }
    }
    if (targetMentee) {
      setSelectedMentee(targetMentee)
      if (mockPage === 'student-history') {
        const nextHistory = buildHistoryProfile({ mentee: targetMentee })
        if (nextHistory) setHistoryProfile(nextHistory)
      }
    }
    const mockUnlockTaskId = params.get('mockUnlockTaskId')
    if (mockUnlockTaskId) setSelectedUnlockTaskId(mockUnlockTaskId)
    if (mockPage && canAccessPage(role, mockPage)) setPage(mockPage)
    auditParamsApplied.current = true
  }, [allTasksList, allowedRoles, currentTeacher, currentTeacherId, getStudentsPatched, role])

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
  const handleOpenHistoryFromStudent = useCallback((s: Student, o?: Offering) => {
    const nextHistory = buildHistoryProfile({ student: s, offering: o ?? null })
    if (!nextHistory) return
    setHistoryProfile(nextHistory)
    setHistoryBackPage(page)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setPage('student-history')
  }, [page])
  const handleOpenMentee = useCallback((m: Mentee) => {
    setSelectedMentee(m)
    setPage('mentee-detail')
  }, [])
  const handleOpenHistoryFromMentee = useCallback((m: Mentee) => {
    const nextHistory = buildHistoryProfile({ mentee: m })
    if (!nextHistory) return
    setHistoryProfile(nextHistory)
    setHistoryBackPage('mentee-detail')
    setPage('student-history')
  }, [])
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
    else setUploadOffering(assignedOfferings[0] ?? OFFERINGS[0])
    setUploadKind(kind)
    setPage('upload')
  }, [assignedOfferings])
  const handleOpenWorkspace = useCallback((offeringId: string, kind: EntryKind) => {
    setEntryOfferingId(offeringId)
    setEntryKind(kind)
    setPage('entry-workspace')
  }, [])
  const handleOpenSchemeSetup = useCallback((o?: Offering) => {
    const target = o ?? uploadOffering ?? offering ?? assignedOfferings[0] ?? OFFERINGS[0]
    if (!target) return
    setSchemeOfferingId(target.offId)
    setPage('scheme-setup')
  }, [assignedOfferings, offering, uploadOffering])
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
    if (!allowedRoles.includes(r)) return
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
    void onRoleChange?.(r)
  }, [allowedRoles, clearRouteHistory, onRoleChange])

  const buildEntryCommitPayload = useCallback((offId: string, kind: EntryKind) => {
    const targetOffering = OFFERINGS.find(item => item.offId === offId)
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
    if (kind === 'tt1' || kind === 'tt2') {
      const blueprint = ttBlueprintsByOffering[offId]?.[kind] ?? getFallbackBlueprintSet(offId)[kind]
      const leaves = flattenBlueprintLeaves(blueprint.nodes)
      if (leaves.length === 0) return null
      return {
        kind,
        payload: {
          entries: students.map(student => {
            const patch = getPatch(student.id)
            const patchScores = kind === 'tt1' ? patch.tt1LeafScores : patch.tt2LeafScores
            const rawTotal = kind === 'tt1' ? student.tt1Score : student.tt2Score
            const rawMax = kind === 'tt1' ? student.tt1Max : student.tt2Max
            return {
              studentId: student.id,
              components: leaves.map(leaf => {
                const key = toCellKey(offId, kind, student.id, leaf.id)
                const fallbackValue = patchScores?.[leaf.id]
                  ?? (rawTotal !== null ? Math.round((rawTotal / Math.max(1, rawMax)) * leaf.maxMarks) : 0)
                return {
                  componentCode: leaf.id,
                  score: cellValues[key] ?? fallbackValue,
                  maxScore: leaf.maxMarks,
                }
              }),
            }
          }),
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
                  ?? (kind === 'quiz'
                    ? (index === 0 ? student.quiz1 : student.quiz2)
                    : (index === 0 ? student.asgn1 : student.asgn2))
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
  }, [cellValues, getFallbackBlueprintSet, schemeByOffering, selectors, ttBlueprintsByOffering])

  const persistEntryWorkspace = useCallback(async (offId: string, kind: EntryKind, lock = false) => {
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
  }, [buildEntryCommitPayload, repositories])

  const handleSaveDraft = useCallback((offId: string, kind: EntryKind) => {
    setDraftBySection(prev => ({ ...prev, [`${offId}::${kind}`]: Date.now() }))
    setSchemeByOffering(prev => ({
      ...prev,
      [offId]: prev[offId] ? { ...prev[offId], status: prev[offId].status === 'Needs Setup' ? 'Configured' : prev[offId].status } : defaultSchemeForOffering(OFFERINGS.find(item => item.offId === offId) ?? OFFERINGS[0]),
    }))
    void persistEntryWorkspace(offId, kind, false)
  }, [persistEntryWorkspace])

  const handleSubmitLock = useCallback((offId: string, kind: EntryKind) => {
    setLockByOffering(prev => ({
      ...prev,
      [offId]: { ...(prev[offId] ?? getEntryLockMap(OFFERINGS.find(o => o.offId === offId) ?? OFFERINGS[0])), [kind]: true },
    }))
    setSchemeByOffering(prev => prev[offId] ? ({
      ...prev,
      [offId]: {
        ...prev[offId],
        status: 'Locked',
        lockedAt: Date.now(),
      },
    }) : prev)
    void persistEntryWorkspace(offId, kind, true)
  }, [persistEntryWorkspace])

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
  }, [commitStudentPatch])

  const handleResolveTask = useCallback((id: string) => {
    const resolvedAt = Date.now()
    const target = allTasksList.find(task => task.id === id)
    if (!target) return
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
          due: toDueLabel(nextDueDateISO),
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
  }, [allTasksList, currentTeacherId, role, taskPlacements])

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
        due: toDueLabel(normalized),
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
  }, [currentTeacherId, role, taskPlacements])

  const handleDismissTask = useCallback((taskId: string) => {
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || task.scheduleMeta?.mode === 'scheduled' || task.dismissal) return task
      return {
        ...task,
        updatedAt: Date.now(),
        dismissal: {
          kind: 'task',
          dismissedAt: Date.now(),
          dismissedByFacultyId: currentTeacherId ?? undefined,
          dismissedDateISO: normalizeDateISO(task.dueDateISO),
        },
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Dismissed', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} dismissed this queue item from active work.` })],
      }
    }))
  }, [currentTeacherId, role])

  const handleDismissSeries = useCallback((taskId: string) => {
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
  }, [currentTeacherId, role])

  const handleRestoreTask = useCallback((taskId: string) => {
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
  }, [currentTeacherId, role])

  const handleUndoTask = useCallback((id: string) => {
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
  }, [currentTeacherId, role])

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
    const updatedTask = applyPlacementToTask(task, nextPlacement)
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
  }, [allTasksList, appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, repositories, role, taskPlacements])

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
    const offering = OFFERINGS.find(item => item.offId === input.offeringId)
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
  }, [appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, role])

  const handleOpenCourseFromCalendar = useCallback((offeringId: string) => {
    if (role === 'Mentor') return
    const targetOffering = OFFERINGS.find(item => item.offId === offeringId)
    if (!targetOffering) return
    handleOpenCourse(targetOffering)
  }, [handleOpenCourse, role])

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
    const scopedFallbackOffering = input?.availableOfferingIds?.[0] ? (OFFERINGS.find(item => item.offId === input.availableOfferingIds?.[0]) ?? null) : null
    const fallbackOffering = (input?.offeringId ? OFFERINGS.find(item => item.offId === input.offeringId) : null) ?? scopedFallbackOffering ?? uploadOffering ?? offering ?? assignedOfferings[0] ?? OFFERINGS[0]
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
  }, [assignedOfferings, getStudentsPatched, offering, uploadOffering])

  const handleRequestUnlock = useCallback((offeringId: string, kind: EntryKind) => {
    setPendingNoteAction({ type: 'unlock-request', offeringId, kind })
  }, [])

  const handleCreateTask = useCallback((input: TaskCreateInput) => {
    const off = OFFERINGS.find(o => o.offId === input.offeringId)
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
      due: input.due || toDueLabel(input.dueDateISO),
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
      ? applyPlacementToTask(next, placement)
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
  }, [appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, getStudentsPatched, repositories, role])

  const handleRemedialCheckIn = useCallback((taskId: string) => {
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
  }, [currentTeacherId, repositories, role])

  const submitUnlockRequest = useCallback((offeringId: string, kind: EntryKind, note: string) => {
    const off = OFFERINGS.find(o => o.offId === offeringId)
    if (!off) return
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
        studentId: `${offeringId}-${kind}-lock`,
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
  }, [appendLockAudit, currentTeacherId, repositories, role])

  const submitStudentHandoff = useCallback((studentId: string, offeringId: string, mode: 'escalate' | 'mentor', note: string) => {
    const off = OFFERINGS.find(item => item.offId === offeringId)
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
  }, [currentTeacherId, getStudentsPatched, repositories, role])

  const commitTaskReassignment = useCallback((taskId: string, toRole: Role, note: string) => {
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
  }, [currentTeacherId, repositories, role])

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
    const resolvedOffering = currentOffering ?? OFFERINGS.find(item => getStudentsPatched(item).some(candidate => candidate.id === student.id))
    if (!resolvedOffering) return
    setPendingNoteAction({
      type: 'student-handoff',
      mode: 'escalate',
      studentId: student.id,
      offeringId: resolvedOffering.offId,
      title: `Escalate ${student.name} to HoD`,
    })
  }, [getStudentsPatched])

  const handleOpenStudentMentorHandoff = useCallback((student: Student, currentOffering?: Offering) => {
    const resolvedOffering = currentOffering ?? OFFERINGS.find(item => getStudentsPatched(item).some(candidate => candidate.id === student.id))
    if (!resolvedOffering) return
    setPendingNoteAction({
      type: 'student-handoff',
      mode: 'mentor',
      studentId: student.id,
      offeringId: resolvedOffering.offId,
      title: `Defer ${student.name} to Mentor`,
    })
  }, [getStudentsPatched])

  const handleSubmitRequiredNote = useCallback((note: string) => {
    const action = pendingNoteAction
    if (!action) return
    if (action.type === 'unlock-request') submitUnlockRequest(action.offeringId, action.kind, note)
    if (action.type === 'reassign-task') commitTaskReassignment(action.taskId, action.toRole, note)
    if (action.type === 'student-handoff') submitStudentHandoff(action.studentId, action.offeringId, action.mode, note)
    setPendingNoteAction(null)
  }, [commitTaskReassignment, pendingNoteAction, submitStudentHandoff, submitUnlockRequest])

  const handleSaveScheme = useCallback((offId: string, next: SchemeState) => {
    const offeringForScheme = OFFERINGS.find(item => item.offId === offId) ?? OFFERINGS[0]
    setSchemeByOffering(prev => ({
      ...prev,
      [offId]: normalizeSchemeState({
        ...next,
        status: hasEntryStartedForOffering(offId) ? 'Locked' : next.status,
        lastEditedBy: role,
      }, offeringForScheme),
    }))
    setPage('upload')
  }, [hasEntryStartedForOffering, role])

  const handleApproveUnlock = useCallback((taskId: string) => {
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
  }, [currentTeacherId])

  const handleRejectUnlock = useCallback((taskId: string) => {
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
  }, [currentTeacherId])

  const handleResetComplete = useCallback((taskId: string) => {
    const task = allTasksList.find(item => item.id === taskId)
    if (!task?.unlockRequest) return
    const unlockKind = task.unlockRequest.kind
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
        ...(prev[task.offeringId] ?? getEntryLockMap(OFFERINGS.find(o => o.offId === task.offeringId) ?? OFFERINGS[0])),
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
  }, [allTasksList, appendLockAudit, currentTeacherId])

  const handleOpenTaskStudent = useCallback((task: SharedTask) => {
    const mentorMatch = assignedMentees.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId) ?? MENTEES.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId)
    if (mentorMatch && role === 'Mentor') {
      setSelectedMentee(mentorMatch)
      setPage('mentee-detail')
      return
    }
    const searchableOfferings = role === 'HoD' ? OFFERINGS : assignedOfferings
    for (const off of searchableOfferings) {
      const student = getStudentsPatched(off).find(st => st.id === task.studentId || st.usn === task.studentUsn)
      if (student) {
        handleOpenStudent(student, off)
        return
      }
    }
    if (mentorMatch) {
      const nextHistory = buildHistoryProfile({ mentee: mentorMatch })
      if (nextHistory) {
        setHistoryProfile(nextHistory)
        setHistoryBackPage(page)
        setPage('student-history')
      }
    }
  }, [assignedMentees, assignedOfferings, getStudentsPatched, handleOpenStudent, page, role])

  const pendingNoteMeta = useMemo(() => {
    if (!pendingNoteAction) return null
    if (pendingNoteAction.type === 'unlock-request') {
      const off = OFFERINGS.find(item => item.offId === pendingNoteAction.offeringId)
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
    const off = OFFERINGS.find(item => item.offId === pendingNoteAction.offeringId)
    return {
      title: pendingNoteAction.mode === 'escalate' ? 'Escalate student to HoD' : 'Defer student to Mentor',
      description: `Add the sender note for ${off?.code ?? 'the selected class'} so the receiving owner sees the full context.`,
      submitLabel: pendingNoteAction.mode === 'escalate' ? 'Escalate with Note' : 'Defer with Note',
    }
  }, [pendingNoteAction])

  if (!currentTeacher) {
    return (
      <AuthPageShell>
        <Card style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
          <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Faculty Context Unavailable</div>
          <InfoBanner tone="error" message="The active faculty profile is no longer available, so this teaching session cannot be restored safely." />
          <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
            Sign back in to refresh the faculty context after admin changes or manual cleanup.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => { void onLogout() }}>Return to Login</Btn>
            <Btn variant="ghost" onClick={handleGoHome}>Back to Portal</Btn>
          </div>
        </Card>
      </AuthPageShell>
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
    setShowTopbarMenu(false)
    void onLogout()
  }

  const sidebarToggleLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const routeLoadingLabel = page === 'course'
    ? 'Loading course workspace...'
    : page === 'calendar'
      ? 'Loading calendar workspace...'
    : page === 'upload' || page === 'entry-workspace' || page === 'scheme-setup'
      ? 'Loading entry workflow...'
      : page === 'department'
        ? 'Loading department view...'
        : 'Loading workspace...'

  return (
    <AppSelectorsContext.Provider value={selectors}>
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg, color: T.text, overflowX: 'hidden' }}>
      {/* ═══ TOP BAR ═══ */}
      <div className={`top-bar-shell ${isCompactTopbar ? 'top-bar-shell--compact' : ''}`} style={{ ...getShellBarStyle(themeMode), display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px' }}>
        {/* Brand */}
        <button aria-label="Go to dashboard" title="Go to dashboard" onClick={handleGoHome} className="top-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <BrandMark size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 15, color: T.text }}>AirMentor</div>
            <div className="top-bar-greeting" style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: T.dim }}>AI Mentor Intelligence</div>
          </div>
        </button>

        {isCompactTopbar && (
          <button className="top-control-btn" aria-label={sidebarToggleLabel} title={sidebarToggleLabel} onClick={() => setSidebarCollapsed(c => !c)} style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 10px', color: T.muted }}>
            <motion.span animate={{ rotate: sidebarCollapsed ? 0 : 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <ChevronRight size={14} />
            </motion.span>
          </button>
        )}

        {/* Role Switcher */}
        <div className="top-bar-role-switcher" style={{ ...getSegmentedGroupStyle(), marginLeft: 16 }}>
          {allowedRoles.map(r => (
            <button key={r} onClick={() => handleRoleChange(r)}
              data-tab="true"
              style={getSegmentedButtonStyle({ active: role === r, compact: isCompactTopbar })}>
              {r}
            </button>
          ))}
        </div>

        <div className="top-bar-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {canNavigateBack ? (
            <button
              className="top-control-btn"
              aria-label="Go back"
              title="Go back"
              onClick={handleNavigateBack}
              style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 6, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}
            >
              <ChevronLeft size={14} />
              Back
            </button>
          ) : null}
          <div className="top-bar-clock" style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 10px', ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, display: 'flex', alignItems: 'center', background: T.surface2 }}>
            {formattedCurrentTime}
          </div>

          <button className="top-control-btn" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={() => {
            setThemeMode(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')
          }} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted }}>{isLightTheme(themeMode) ? '🌙' : '☀️'}</button>

          <button className="top-control-btn" aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'} title={showActionQueue ? 'Hide action queue' : 'Show action queue'} onClick={handleToggleActionQueue} style={{ ...getIconButtonStyle({ active: showActionQueue }), color: showActionQueue ? T.accent : T.muted, position: 'relative' }}>
            <Bell size={14} />
            {pendingActionCount > 0 && <div style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pendingActionCount}</div>}
          </button>

          {isCompactTopbar && (
            <>
              <button className="top-control-btn" aria-label={showTopbarMenu ? 'Close more controls' : 'Open more controls'} title="More" onClick={() => setShowTopbarMenu(v => !v)} style={{ ...getIconButtonStyle({ active: showTopbarMenu, subtle: false }), width: 'auto', padding: '0 10px', color: showTopbarMenu ? T.accent : T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>More</button>
              {showTopbarMenu && (
                <div className="top-bar-more-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 38, minWidth: 200, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`, boxShadow: '0 18px 42px rgba(2,6,23,0.26)', display: 'grid', gap: 8, zIndex: 70 }}>
                  <button onClick={handleLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: '100%', padding: '0 10px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow, textAlign: 'left', justifyContent: 'flex-start' }}>
                    Logout
                  </button>
                </div>
              )}
            </>
          )}

          {!isCompactTopbar && (
            <button className="top-control-btn" aria-label="Logout" title="Logout" onClick={handleLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>
              Logout
            </button>
          )}
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="app-main" style={{ display: 'flex', flex: 1, minWidth: 0, position: 'relative' }}>
        {!isCompactTopbar && sidebarCollapsed && (
          <motion.button
            type="button"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
            onClick={() => setSidebarCollapsed(false)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: 18,
              bottom: 18,
              zIndex: 30,
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
        )}

        {/* Left Sidebar */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 210, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 54, height: 'calc(100vh - 54px)', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', minWidth: 210, flex: 1, overflowY: 'auto' }}>
                {/* Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 10, color: '#fff', flexShrink: 0 }}>{PROFESSOR.initials}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTeacher.name}</div>
                    <div style={{ ...mono, fontSize: 9, color: T.dim }}>{role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPage('faculty-profile')}
                  style={{ width: '100%', marginBottom: 12, borderRadius: 8, border: `1px solid ${page === 'faculty-profile' ? T.accent : T.border}`, background: page === 'faculty-profile' ? `${T.accent}14` : T.surface2, color: page === 'faculty-profile' ? T.accentLight : T.muted, cursor: 'pointer', padding: '8px 10px', textAlign: 'left', ...mono, fontSize: 10 }}
                >
                  Faculty Profile
                </button>

                {/* Nav */}
                <nav>
                  {navItems.map(item => {
                    const Icon = item.icon
                    const active = page === item.id
                      || ((page === 'course') && item.id === (role === 'HoD' ? 'department' : role === 'Mentor' ? 'mentees' : 'dashboard'))
                      || ((page === 'student-history') && item.id === (historyBackPage === 'students' ? 'students' : role === 'HoD' ? 'department' : role === 'Mentor' ? 'mentees' : 'dashboard'))
                      || ((page === 'upload' || page === 'entry-workspace' || page === 'scheme-setup') && item.id === 'upload')
                      || ((page === 'queue-history' || page === 'unlock-review') && item.id === 'queue-history')
                      || ((page === 'mentee-detail') && item.id === 'mentees')
                    return (
                      <button key={item.id} onClick={() => { setPage(item.id); setOffering(null) }}
                        data-nav-item="true"
                        data-active={active ? 'true' : 'false'}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: active ? T.accent + '18' : 'transparent', color: active ? T.accentLight : T.muted, ...sora, fontWeight: 500, fontSize: 12, marginBottom: 2, transition: 'all 0.15s', textAlign: 'left' as const }}>
                        <Icon size={15} /> {item.label}
                      </button>
                    )
                  })}
                </nav>

                {/* Year Stages — Course Leader only */}
                {role === 'Course Leader' && (
                  <div style={{ padding: '12px 0', borderTop: `1px solid ${T.border}`, marginTop: 12 }}>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Year Stages</div>
                    {YEAR_GROUPS.map(g => (
                      <div key={g.year} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                        <span style={{ ...mono, fontSize: 9, color: T.muted, flex: 1 }}>{g.year}</span>
                        <span style={{ ...mono, fontSize: 8, color: g.stageInfo.color }}>{g.stageInfo.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Data completeness */}
                {role === 'Course Leader' && (
                  <div style={{ padding: '10px 0', borderTop: `1px solid ${T.border}` }}>
                    <div style={{ ...mono, fontSize: 8, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Data Completeness</div>
                    {[
                      { lbl: 'TT1 Marks', pct: 64 },
                      { lbl: 'Attendance', pct: 82 },
                      { lbl: 'Quizzes', pct: 36 },
                    ].map(d => (
                      <div key={d.lbl} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ ...mono, fontSize: 9, color: T.muted }}>{d.lbl}</span>
                          <span style={{ ...mono, fontSize: 9, color: d.pct >= 80 ? T.success : d.pct >= 50 ? T.warning : T.danger }}>{d.pct}%</span>
                        </div>
                        <Bar val={d.pct} color={d.pct >= 80 ? T.success : d.pct >= 50 ? T.warning : T.danger} h={3} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px', borderTop: `1px solid ${T.border}` }}>
                <button
                  type="button"
                  aria-label={sidebarToggleLabel}
                  title={sidebarToggleLabel}
                  onClick={() => setSidebarCollapsed(true)}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    border: `1px solid ${T.border2}`,
                    background: T.surface2,
                    color: T.muted,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    ...mono,
                    fontSize: 11,
                  }}
                >
                  <span>Collapse sidebar</span>
                  <motion.span animate={{ rotate: 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <ChevronRight size={14} />
                  </motion.span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Content */}
        <div className={`scroll-pane app-content app-content--${layoutMode}`} style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
          <Suspense fallback={<RouteLoadingFallback label={routeLoadingLabel} />}>
            {page === 'faculty-profile' && (
              <FacultyProfilePage
                currentTeacher={currentTeacher}
                activeRole={role}
                profile={facultyProfile}
                calendarMarkers={currentFacultyCalendarMarkers}
                loading={facultyProfileLoading}
                error={facultyProfileError}
                pendingTaskCount={pendingActionCount}
                assignedOfferings={assignedOfferings}
                currentFacultyTimetable={currentFacultyTimetable}
                onBack={handleNavigateBack}
              />
            )}
            {role === 'Course Leader' && page === 'dashboard' && <CLDashboard offerings={assignedOfferings} pendingTaskCount={pendingActionCount} onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} onOpenUpload={handleOpenUpload} onOpenCalendar={handleOpenCalendar} onOpenPendingActions={handleToggleActionQueue} teacherInitials={currentTeacher.initials} greetingHeadline={greetingHeadline} greetingMeta={greetingMeta} />}
            {role === 'Course Leader' && page === 'students' && <LazyAllStudentsPage offerings={assignedOfferings} onBack={handleNavigateBack} onOpenStudent={handleOpenStudent} onOpenHistory={handleOpenHistoryFromStudent} onOpenUpload={handleOpenUpload} />}
            {role === 'Course Leader' && page === 'course' && offering && <LazyCourseDetail key={`${offering.offId}-${courseInitialTab ?? 'overview'}`} offering={offering} scheme={schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)} lockMap={lockByOffering[offering.offId] ?? getEntryLockMap(offering)} blueprints={ttBlueprintsByOffering[offering.offId] ?? getFallbackBlueprintSet(offering.offId)} courseOutcomes={academicBootstrap?.courseOutcomesByOffering?.[offering.offId]} coAttainmentRows={academicBootstrap?.coAttainmentByOffering?.[offering.offId]} onUpdateBlueprint={(kind, next) => handleUpdateBlueprint(offering.offId, kind, next)} onBack={handleNavigateBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} onOpenSchemeSetup={() => handleOpenSchemeSetup(offering)} initialTab={courseInitialTab} />}
            {role === 'Course Leader' && page === 'scheme-setup' && selectedSchemeOffering && <LazySchemeSetupPage role={role} offering={selectedSchemeOffering} scheme={schemeByOffering[selectedSchemeOffering.offId] ?? defaultSchemeForOffering(selectedSchemeOffering)} hasEntryStarted={hasEntryStartedForOffering(selectedSchemeOffering.offId)} onSave={(next) => handleSaveScheme(selectedSchemeOffering.offId, next)} onBack={handleNavigateBack} />}
            {role === 'Course Leader' && page === 'calendar' && currentFacultyTimetable && <LazyCalendarTimetablePage currentTeacher={currentTeacher} activeRole={role} allowedRoles={allowedRoles} facultyOfferings={calendarOfferings} mergedTasks={mergedCalendarTasks} meetings={calendarMeetings} resolvedTaskIds={resolvedTasks} timetable={currentFacultyTimetable} adminMarkers={currentFacultyCalendarMarkers} taskPlacements={taskPlacements} onBack={handleNavigateBack} onScheduleTask={handleScheduleTask} onUpdateMeeting={handleUpdateMeeting} onMoveClassBlock={handleMoveClassBlock} onResizeClassBlock={handleResizeClassBlock} onEditClassTiming={handleEditClassTiming} onCreateExtraClass={handleCreateExtraClass} onOpenTaskComposer={handleOpenTaskComposer} onOpenCourse={handleOpenCourseFromCalendar} onOpenActionQueue={handleOpenActionQueueFromCalendar} onUpdateTimetableBounds={handleUpdateTimetableBounds} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />}
            {role === 'Course Leader' && page === 'upload' && <LazyUploadPage key={`${uploadOffering?.offId ?? 'default'}-${uploadKind}`} role={role} offering={uploadOffering} defaultKind={uploadKind} onBack={handleNavigateBack} onOpenWorkspace={handleOpenWorkspace} lockByOffering={lockByOffering} onRequestUnlock={handleRequestUnlock} availableOfferings={assignedOfferings} onOpenSchemeSetup={handleOpenSchemeSetup} />}
            {role === 'Course Leader' && page === 'entry-workspace' && <LazyEntryWorkspacePage capabilities={capabilities} offeringId={entryOfferingId} kind={entryKind} onBack={handleNavigateBack} lockByOffering={lockByOffering} draftBySection={draftBySection} onSaveDraft={handleSaveDraft} onSubmitLock={handleSubmitLock} onRequestUnlock={handleRequestUnlock} cellValues={cellValues} onCellValueChange={handleCellValueChange} onOpenStudent={handleOpenStudent} onOpenTaskComposer={handleOpenTaskComposer} onUpdateStudentAttendance={handleUpdateStudentAttendance} schemeByOffering={schemeByOffering} ttBlueprintsByOffering={ttBlueprintsByOffering} lockAuditByTarget={lockAuditByTarget} />}
            {role === 'Course Leader' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onBack={handleNavigateBack} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} onRestoreTask={handleRestoreTask} />}

            {role === 'Mentor' && page === 'mentees' && <MentorView mentees={assignedMentees} tasks={roleTasks} onOpenMentee={handleOpenMentee} />}
            {role === 'Mentor' && page === 'mentee-detail' && selectedMentee && <MenteeDetailPage mentee={selectedMentee} onBack={handleNavigateBack} onOpenHistory={handleOpenHistoryFromMentee} />}
            {role === 'Mentor' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onBack={handleNavigateBack} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} onRestoreTask={handleRestoreTask} />}
            {role === 'Mentor' && page === 'calendar' && currentFacultyTimetable && <LazyCalendarTimetablePage currentTeacher={currentTeacher} activeRole={role} allowedRoles={allowedRoles} facultyOfferings={calendarOfferings} mergedTasks={mergedCalendarTasks} meetings={calendarMeetings} resolvedTaskIds={resolvedTasks} timetable={currentFacultyTimetable} adminMarkers={currentFacultyCalendarMarkers} taskPlacements={taskPlacements} onBack={handleNavigateBack} onScheduleTask={handleScheduleTask} onUpdateMeeting={handleUpdateMeeting} onMoveClassBlock={handleMoveClassBlock} onResizeClassBlock={handleResizeClassBlock} onEditClassTiming={handleEditClassTiming} onCreateExtraClass={handleCreateExtraClass} onOpenTaskComposer={handleOpenTaskComposer} onOpenCourse={handleOpenCourseFromCalendar} onOpenActionQueue={handleOpenActionQueueFromCalendar} onUpdateTimetableBounds={handleUpdateTimetableBounds} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />}

            {role === 'HoD' && page === 'department' && <LazyHodView onOpenQueueHistory={handleOpenQueueHistory} onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} tasks={allTasksList} calendarAuditEvents={calendarAuditEvents} />}
            {role === 'HoD' && page === 'course' && offering && <LazyCourseDetail key={`${offering.offId}-${courseInitialTab ?? 'overview'}`} offering={offering} scheme={schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)} lockMap={lockByOffering[offering.offId] ?? getEntryLockMap(offering)} blueprints={ttBlueprintsByOffering[offering.offId] ?? getFallbackBlueprintSet(offering.offId)} courseOutcomes={academicBootstrap?.courseOutcomesByOffering?.[offering.offId]} coAttainmentRows={academicBootstrap?.coAttainmentByOffering?.[offering.offId]} onUpdateBlueprint={(kind, next) => handleUpdateBlueprint(offering.offId, kind, next)} onBack={handleNavigateBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} onOpenSchemeSetup={() => handleOpenSchemeSetup(offering)} initialTab={courseInitialTab} />}
            {role === 'HoD' && page === 'unlock-review' && selectedUnlockTask && <UnlockReviewPage task={selectedUnlockTask} offering={OFFERINGS.find(item => item.offId === selectedUnlockTask.offeringId) ?? null} onBack={handleNavigateBack} onApprove={() => handleApproveUnlock(selectedUnlockTask.id)} onReject={() => handleRejectUnlock(selectedUnlockTask.id)} onResetComplete={() => handleResetComplete(selectedUnlockTask.id)} />}
            {role === 'HoD' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onBack={handleNavigateBack} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} onRestoreTask={handleRestoreTask} />}
            {role === 'HoD' && page === 'calendar' && currentFacultyTimetable && <LazyCalendarTimetablePage currentTeacher={currentTeacher} activeRole={role} allowedRoles={allowedRoles} facultyOfferings={calendarOfferings} mergedTasks={mergedCalendarTasks} meetings={calendarMeetings} resolvedTaskIds={resolvedTasks} timetable={currentFacultyTimetable} adminMarkers={currentFacultyCalendarMarkers} taskPlacements={taskPlacements} onBack={handleNavigateBack} onScheduleTask={handleScheduleTask} onUpdateMeeting={handleUpdateMeeting} onMoveClassBlock={handleMoveClassBlock} onResizeClassBlock={handleResizeClassBlock} onEditClassTiming={handleEditClassTiming} onCreateExtraClass={handleCreateExtraClass} onOpenTaskComposer={handleOpenTaskComposer} onOpenCourse={handleOpenCourseFromCalendar} onOpenActionQueue={handleOpenActionQueueFromCalendar} onUpdateTimetableBounds={handleUpdateTimetableBounds} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />}

            {page === 'student-history' && historyProfile && <LazyStudentHistoryPage role={role} history={historyProfile} onBack={handleNavigateBack} />}
          </Suspense>
        </div>

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
              <ActionQueue role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onResolveTask={handleResolveTask} onUndoTask={handleUndoTask} onOpenTaskComposer={handleOpenTaskComposer} onRemedialCheckIn={handleRemedialCheckIn} onOpenStudent={handleOpenTaskStudent} onReassignTask={handleReassignTask} onOpenUnlockReview={handleOpenUnlockReview} onOpenQueueHistory={handleOpenQueueHistory} onApproveUnlock={handleApproveUnlock} onRejectUnlock={handleRejectUnlock} onResetComplete={handleResetComplete} onToggleSchedulePause={handleToggleSchedulePause} onEditSchedule={handleEditSchedule} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ STUDENT DRAWER ═══ */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDrawer student={selectedStudent} offering={selectedOffering || undefined} role={role} meetings={academicMeetings} onClose={() => { setSelectedStudent(null); setSelectedOffering(null) }} onEscalate={handleOpenStudentEscalation} onOpenTaskComposer={(s, o, taskType) => {
            const resolvedOffering = o ?? OFFERINGS.find(item => getStudentsPatched(item).some(candidate => candidate.id === s.id))
            handleOpenTaskComposer({ offeringId: resolvedOffering?.offId, studentId: s.id, taskType })
          }} onAssignToMentor={handleOpenStudentMentorHandoff} onOpenHistory={handleOpenHistoryFromStudent} onScheduleMeeting={handleScheduleMeeting} />
        )}
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

function mapApiRoleToRole(roleCode: ApiSessionResponse['activeRoleGrant']['roleCode']): Role | null {
  if (roleCode === 'COURSE_LEADER') return 'Course Leader'
  if (roleCode === 'MENTOR') return 'Mentor'
  if (roleCode === 'HOD') return 'HoD'
  return null
}

const PRIMARY_VISIBLE_FACULTY_USERNAME = 'kavitha.rao'
const PRIMARY_VISIBLE_FACULTY_NAME = 'dr. kavitha rao'

function normalizeVisibleFacultyIdentity(value?: string | null) {
  return (value ?? '').trim().toLowerCase()
}

function restrictVisibleFacultyOptions<T extends { facultyId: string; username?: string; name?: string; displayName?: string }>(items: T[]) {
  const candidates = items
    .filter(item => normalizeVisibleFacultyIdentity(item.username) === PRIMARY_VISIBLE_FACULTY_USERNAME || normalizeVisibleFacultyIdentity(item.displayName ?? item.name) === PRIMARY_VISIBLE_FACULTY_NAME)
    .sort((left, right) => {
      const leftExactUsername = normalizeVisibleFacultyIdentity(left.username) === PRIMARY_VISIBLE_FACULTY_USERNAME ? 1 : 0
      const rightExactUsername = normalizeVisibleFacultyIdentity(right.username) === PRIMARY_VISIBLE_FACULTY_USERNAME ? 1 : 0
      if (leftExactUsername !== rightExactUsername) return rightExactUsername - leftExactUsername
      return left.facultyId.localeCompare(right.facultyId)
    })
  return candidates.length > 0 ? [candidates[0]] : items
}

function restrictAcademicBootstrap(snapshot: ApiAcademicBootstrap): ApiAcademicBootstrap {
  const visibleFaculty = restrictVisibleFacultyOptions(snapshot.faculty)
  const visibleTeacherIds = new Set(visibleFaculty.map(account => account.facultyId))
  return {
    ...snapshot,
    faculty: visibleFaculty,
    teachers: snapshot.teachers.filter(teacher => visibleTeacherIds.has(teacher.id)),
  }
}

function getAcademicApiBaseUrl() {
  return import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || ''
}

export function OperationalApp() {
  const apiBaseUrl = getAcademicApiBaseUrl()
  const apiClient = useMemo(() => (apiBaseUrl ? new AirMentorApiClient(apiBaseUrl) : null), [apiBaseUrl])
  const remoteSessionRepositories = useMemo(() => (
    apiClient
      ? createAirMentorRepositories({
          repositoryMode: 'http',
          apiClient,
          remoteFacultyStorageKey: AIRMENTOR_STORAGE_KEYS.currentFacultyId,
        })
      : null
  ), [apiClient])
  const [booting, setBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [remoteSession, setRemoteSession] = useState<ApiSessionResponse | null>(null)
  const [remoteBootstrap, setRemoteBootstrap] = useState<ApiAcademicBootstrap | null>(null)
  const [loginFaculty, setLoginFaculty] = useState<ApiAcademicLoginFaculty[]>([])

  const fetchAcademicBootstrap = useCallback(async () => {
    if (!apiClient) return null
    const snapshot = restrictAcademicBootstrap(await apiClient.getAcademicBootstrap())
    hydrateAcademicData(snapshot)
    setRemoteBootstrap(snapshot)
    setLoginFaculty(restrictVisibleFacultyOptions(snapshot.faculty.map(account => {
      const accountUsername = (account as { username?: string }).username ?? account.facultyId
      return {
        facultyId: account.facultyId,
        username: accountUsername,
        name: account.name,
        displayName: account.name,
        designation: account.roleTitle,
        dept: account.dept,
        departmentCode: account.dept,
        roleTitle: account.roleTitle,
        allowedRoles: account.allowedRoles,
      }
    })))
    return snapshot
  }, [apiClient])

  useEffect(() => {
    if (!apiClient || !remoteSessionRepositories) {
      setAuthError('VITE_AIRMENTOR_API_BASE_URL is required. Teaching workspace runs in backend-only mode.')
      setBooting(false)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const [publicFaculty, restoredSession] = await Promise.all([
          apiClient.listAcademicLoginFaculty().catch(() => null),
          remoteSessionRepositories.sessionPreferences.restoreRemoteSession(),
        ])
        if (cancelled) return
        if (publicFaculty?.items?.length) {
          setLoginFaculty(restrictVisibleFacultyOptions(publicFaculty.items))
        }
        const restoredRole = restoredSession ? mapApiRoleToRole(restoredSession.activeRoleGrant.roleCode) : null
        if (restoredSession?.faculty?.facultyId && restoredRole) {
          setRemoteSession(restoredSession)
          await fetchAcademicBootstrap()
        } else {
          setRemoteSession(null)
          setRemoteBootstrap(null)
        }
      } catch (error) {
        if (cancelled) return
        setAuthError(error instanceof Error ? error.message : 'Could not restore the academic portal session.')
        setRemoteSession(null)
        setRemoteBootstrap(null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [apiClient, fetchAcademicBootstrap, remoteSessionRepositories])

  const remoteRepositories = useMemo(() => (
    apiClient && remoteBootstrap
      ? createAirMentorRepositories({
          repositoryMode: 'http',
          apiClient,
          academicBootstrap: remoteBootstrap,
          remoteFacultyStorageKey: AIRMENTOR_STORAGE_KEYS.currentFacultyId,
        })
      : null
  ), [apiClient, remoteBootstrap])

  const handleRemoteLogin = useCallback(async (identifier: string, password: string) => {
    if (!remoteSessionRepositories) throw new Error('Academic backend is unavailable.')
    setAuthBusy(true)
    setAuthError('')
    try {
      const session = await remoteSessionRepositories.sessionPreferences.loginRemoteSession({
        identifier,
        password,
      })
      const role = mapApiRoleToRole(session.activeRoleGrant.roleCode)
      if (!session.faculty?.facultyId || !role) {
        throw new Error('This account does not have an academic portal role.')
      }
      setRemoteSession(session)
      await fetchAcademicBootstrap()
    } catch (error) {
      const message = error instanceof AirMentorApiError ? error.message : (error instanceof Error ? error.message : 'Academic login failed.')
      setAuthError(message)
      throw new Error(message)
    } finally {
      setAuthBusy(false)
    }
  }, [fetchAcademicBootstrap, remoteSessionRepositories])

  const handleRemoteLogout = useCallback(async () => {
    if (!remoteSessionRepositories) return
    await remoteSessionRepositories.sessionPreferences.logoutRemoteSession()
    setRemoteSession(null)
    setRemoteBootstrap(null)
  }, [remoteSessionRepositories])

  const handleRemoteRoleChange = useCallback(async (role: Role) => {
    if (!remoteSession || !remoteSessionRepositories) return
    const match = remoteSession.availableRoleGrants.find(grant => mapApiRoleToRole(grant.roleCode) === role)
    if (!match) return
    const nextSession = await remoteSessionRepositories.sessionPreferences.switchRemoteRoleContext(match.grantId)
    setRemoteSession(nextSession)
    await fetchAcademicBootstrap()
  }, [fetchAcademicBootstrap, remoteSession, remoteSessionRepositories])

  const remoteInitialRole = remoteSession ? mapApiRoleToRole(remoteSession.activeRoleGrant.roleCode) : null

  if (!apiClient || !remoteSessionRepositories) {
    return (
      <AuthPageShell>
        <Card style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
          <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>Teaching Workspace</div>
          <InfoBanner tone="error" message="VITE_AIRMENTOR_API_BASE_URL is required. Mock mode has been removed." />
          <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
            Configure the API URL so the teaching workspace runs entirely from system-admin managed backend data.
          </div>
          <div>
            <Btn variant="ghost" onClick={() => navigateToPortal('home')}>Back to Portal</Btn>
          </div>
        </Card>
      </AuthPageShell>
    )
  }

  if (booting) return <RouteLoadingFallback label="Restoring academic session..." />

  if (!remoteSession || !remoteSession.faculty?.facultyId || !remoteInitialRole || !remoteRepositories) {
    return (
      <LoginPage
        facultyOptions={loginFaculty}
        helperText=""
        modeLabel="Teaching Workspace Live Mode"
        heroBody="Sign in against the live backend so course leaders, mentors, and HoDs land in their actual system-admin managed teaching context."
        busy={authBusy}
        externalError={authError}
        onBackToPortal={() => navigateToPortal('home')}
        onLogin={handleRemoteLogin}
      />
    )
  }

  return (
    <OperationalWorkspace
      repositories={remoteRepositories}
      initialTeacherId={remoteSession.faculty.facultyId}
      initialRole={remoteInitialRole}
      onLogout={handleRemoteLogout}
      onRoleChange={handleRemoteRoleChange}
      loadFacultyProfile={facultyId => apiClient.getAcademicFacultyProfile(facultyId)}
      academicBootstrap={remoteBootstrap}
    />
  )
}

function PortalRouterApp() {
  const [route, setRoute] = useState<PortalRoute>(() => {
    if (typeof window === 'undefined') return 'home'
    return resolvePortalRoute(window.location.hash, window.localStorage)
  })

  const handleExitAdminToPortal = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearPortalWorkspaceHints(window.localStorage)
    }
    setRoute('home')
    navigateToPortal('home')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncRoute = () => setRoute(resolvePortalRoute(window.location.hash, window.localStorage))
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextHash = getPortalHash(route)
    if (!hashBelongsToPortalRoute(window.location.hash, route)) window.location.hash = nextHash
  }, [route])

  if (route === 'app') return <OperationalApp />
  if (route === 'admin') return <SystemAdminApp onExitPortal={handleExitAdminToPortal} />

  return (
    <PortalEntryScreen
      onSelectAcademic={() => navigateToPortal('app')}
      onSelectAdmin={() => navigateToPortal('admin')}
    />
  )
}

export default function App() {
  return <PortalRouterApp />
}
