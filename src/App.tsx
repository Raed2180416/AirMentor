import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar, CheckCircle,
  GraduationCap, LayoutDashboard, ListTodo, Mail, Phone, Shield, Upload, Users, X,
  AlertTriangle, TrendingDown, BookOpen, Target, Activity, Eye, MessageSquare,
} from 'lucide-react'
import {
  CO_COLORS, T, mono, sora,
  PAPER_MAP,
  hydrateAcademicData,
  type Offering, type Student,
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
import { toCellKey } from './page-utils'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories, type AirMentorRepositories } from './repositories'
import { PortalEntryScreen } from './portal-entry'
import { clearPortalWorkspaceHints, getPortalHash, hashBelongsToPortalRoute, navigateToPortal, resolvePortalRoute, type PortalRoute } from './portal-routing'
import { SystemAdminApp } from './system-admin-app'
import {
  AcademicFacultyContextUnavailableState,
  AcademicSessionBoundary,
} from './academic-session-shell'
import { AcademicWorkspaceSidebar } from './academic-workspace-sidebar'
import { AcademicWorkspaceTopbar } from './academic-workspace-topbar'
import { AcademicWorkspaceRouteSurface } from './academic-workspace-route-surface'
import { findStudentProfileLaunchTarget, resolveAssignedMentees } from './academic-workspace-route-helpers'
import { applyThemePreset, isLightTheme } from './theme'
import {
  Bar,
  Btn,
  Card,
  Chip,
  FieldInput,
  FieldSelect,
  FieldTextarea,
  ModalWorkspace,
  RiskBadge,
  UI_FONT_SIZES,
  UI_TRANSITION_FAST,
  UI_TRANSITION_MEDIUM,
  getFieldChromeStyle,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  withAlpha,
} from './ui-primitives'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAcademicBootstrap,
  ApiAcademicFacultyProfile,
  ApiAcademicHodProofBundle,
  ApiAcademicLoginFaculty,
  ApiSessionResponse,
  ApiStudentAgentCard,
  ApiStudentAgentMessage,
  ApiStudentAgentSession,
  ApiStudentAgentTimelineItem,
  ApiStudentRiskExplorer,
} from './api/types'
import { clearProofPlaybackSelection, PROOF_PLAYBACK_SELECTION_STORAGE_KEY, readProofPlaybackSelection } from './proof-playback'
import { collectFrontendStartupDiagnostics } from './startup-diagnostics'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from './telemetry'
import './App.css'

export { FacultyProfilePage } from './academic-faculty-profile-page'

const subtleDividerStyle = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${withAlpha(T.border2, '26')} 14%, ${withAlpha(T.border2, '62')} 50%, ${withAlpha(T.border2, '26')} 86%, transparent)`,
  opacity: 0.9,
}

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

type PageId = 'dashboard' | 'students' | 'course' | 'calendar' | 'upload' | 'entry-workspace' | 'mentees' | 'department' | 'mentee-detail' | 'student-history' | 'student-shell' | 'risk-explorer' | 'unlock-review' | 'scheme-setup' | 'queue-history' | 'faculty-profile'

type RouteSnapshot = {
  page: PageId
  offeringId: string | null
  uploadOfferingId: string | null
  uploadKind: EntryKind
  entryOfferingId: string
  entryKind: EntryKind
  selectedMenteeId: string | null
  historyProfile: StudentHistoryRecord | null
  historyStudentId: string | null
  studentShellStudentId: string | null
  historyBackPage: PageId | null
  selectedUnlockTaskId: string | null
  schemeOfferingId: string | null
  courseInitialTab?: string
}

const CLASS_SNAP_THRESHOLD_MINUTES = 14

function getHomePage(role: Role): PageId {
  return role === 'Course Leader' ? 'dashboard' : role === 'Mentor' ? 'mentees' : 'department'
}

function canAccessPage(role: Role, page: PageId) {
  if (page === 'student-history' || page === 'student-shell' || page === 'risk-explorer' || page === 'queue-history' || page === 'faculty-profile') return true
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
    snapshot.historyStudentId ?? '',
    snapshot.studentShellStudentId ?? '',
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

function getLatestTransition(task: SharedTask) {
  const history = task.transitionHistory ?? []
  return history[history.length - 1]
}

function buildHistoryProfile(input: {
  student?: Student | null
  mentee?: Mentee | null
  historyByUsn?: Record<string, StudentHistoryRecord> | null
}): StudentHistoryRecord | null {
  const usn = input.student?.usn ?? input.mentee?.usn ?? null
  return usn ? (input.historyByUsn?.[usn] ?? null) : null
}

function parseTimeToMinutes(value: string, fallback: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback
  return (hours * 60) + minutes
}

function createRemedialPlan({
  selectedStudentId,
  title,
  ownerRole,
  dueDateISO,
  checkInDatesISO,
  steps,
}: {
  selectedStudentId: string
  title: string
  ownerRole: Role
  dueDateISO: string
  checkInDatesISO: string[]
  steps: string[]
}): RemedialPlan {
  const createdAt = Date.now()
  return {
    planId: `plan-${selectedStudentId}-${createdAt}`,
    title,
    createdAt,
    ownerRole,
    dueDateISO,
    checkInDatesISO,
    steps: steps.map((label, index) => ({ id: `step-${index + 1}`, label })),
  }
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

export function RequiredNoteModal({ title, description, submitLabel, onClose, onSubmit }: { title: string; description: string; submitLabel: string; onClose: () => void; onSubmit: (note: string) => void }) {
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

export function TaskComposerModal({ role, offerings, initialState, onClose, onSubmit }: { role: Role; offerings: Offering[]; initialState: TaskComposerState; onClose: () => void; onSubmit: (input: TaskCreateInput) => void }) {
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
              const plan = createRemedialPlan({
                selectedStudentId,
                title: planTitle.trim(),
                ownerRole: role,
                dueDateISO: effectiveDueDateISO,
                checkInDatesISO: [checkIn1, checkIn2].filter(Boolean),
                steps: sanitized,
              })
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
                {classOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Sec {offering.section} · {getStudentsPatched(offering).length} students</option>)}
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
   STUDENT DRAWER — OBSERVABLE WATCH, CO, INTERVENTIONS
   ══════════════════════════════════════════════════════════════ */

export function StudentDrawer({
  student,
  offering,
  historyByUsn,
  role,
  meetings,
  onClose,
  onEscalate,
  onOpenTaskComposer,
  onAssignToMentor,
  onOpenHistory,
  onOpenStudentShell,
  onOpenRiskExplorer,
  onScheduleMeeting,
}: {
  student: Student | null
  offering?: Offering
  historyByUsn?: Record<string, StudentHistoryRecord> | null
  role: Role
  meetings: AcademicMeeting[]
  onClose: () => void
  onEscalate: (s: Student, o?: Offering) => void
  onOpenTaskComposer: (s: Student, o?: Offering, taskType?: TaskType) => void
  onAssignToMentor: (s: Student, o?: Offering) => void
  onOpenHistory: (s: Student, o?: Offering) => void
  onOpenStudentShell: (studentId: string) => void
  onOpenRiskExplorer: (studentId: string) => void
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
  const drawerHistory = buildHistoryProfile({ student: s, historyByUsn })
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

        {/* Watch Gauge */}
        {s.riskProb !== null ? (
          <div style={{ background: `${riskCol}0c`, border: `1px solid ${riskCol}30`, borderRadius: 12, padding: '18px 22px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ ...sora, fontWeight: 800, fontSize: 42, color: riskCol }}>{Math.round(s.riskProb * 100)}%</div>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: riskCol }}>Academic Watch Score — {s.riskBand}</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 2 }}>Observable-only score from attendance, term tests, transcript history, and course outcomes.</div>
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
            <div style={{ ...mono, fontSize: 12, color: T.muted }}>Watch score unavailable because the current evidence window is incomplete.</div>
            <div style={{ ...mono, fontSize: 11, color: T.dim, marginTop: 4 }}>Showing attendance and transcript context only.</div>
          </div>
        )}

        {/* Observable Drivers */}
        {s.reasons.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={14} color={T.danger} /> Observable Drivers
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
              { lbl: 'Primary Signal', val: s.reasons[0]?.feature?.toUpperCase() ?? 'None', col: s.reasons[0] ? T.warning : T.success },
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

        {drawerHistory?.electiveRecommendation ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <GraduationCap size={14} color={T.accent} /> Semester 6 Elective Fit
            </div>
            <div style={{ background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
              <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{drawerHistory.electiveRecommendation.recommendedTitle}</div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 4 }}>{drawerHistory.electiveRecommendation.recommendedCode} · {drawerHistory.electiveRecommendation.stream}</div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.7 }}>{drawerHistory.electiveRecommendation.rationale || 'Recommended from the current proof-batch elective basket using accumulated readiness signals.'}</div>
              {drawerHistory.electiveRecommendation.alternatives.length > 0 ? (
                <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 8 }}>
                  Alternates: {drawerHistory.electiveRecommendation.alternatives.map(option => `${option.title} (${option.code})`).join(' · ')}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

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
          <Btn size="sm" variant="ghost" onClick={() => onOpenStudentShell(normalizedStudentId)}><Shield size={12} /> Student Shell</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenRiskExplorer(normalizedStudentId)}><Activity size={12} /> Risk Explorer</Btn>
          {role !== 'HoD' && <Btn size="sm" variant="danger" onClick={() => onEscalate(s, offering)}><AlertTriangle size={12} /> Escalate to HoD</Btn>}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ACTION QUEUE (Right Sidebar)
   ══════════════════════════════════════════════════════════════ */

export function ActionQueue({ role, tasks, resolvedTaskIds, onResolveTask, onUndoTask, onOpenStudent, onOpenTaskComposer, onRemedialCheckIn, onReassignTask, onOpenUnlockReview, onOpenQueueHistory, onApproveUnlock, onRejectUnlock, onResetComplete, onToggleSchedulePause, onEditSchedule, onDismissTask, onDismissSeries }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onResolveTask: (id: string) => void; onUndoTask: (id: string) => void; onOpenStudent: (task: SharedTask) => void; onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void; onRemedialCheckIn: (taskId: string) => void; onReassignTask: (taskId: string, toRole: Role) => void; onOpenUnlockReview: (taskId: string) => void; onOpenQueueHistory: () => void; onApproveUnlock: (taskId: string) => void; onRejectUnlock: (taskId: string) => void; onResetComplete: (taskId: string) => void; onToggleSchedulePause: (taskId: string) => void; onEditSchedule: (taskId: string) => void; onDismissTask: (taskId: string) => void; onDismissSeries: (taskId: string) => void }) {
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
              <div style={subtleDividerStyle} aria-hidden="true" />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
  loadHodProofAnalytics?: () => Promise<ApiAcademicHodProofBundle>
  loadStudentAgentCard?: (studentId: string) => Promise<ApiStudentAgentCard>
  loadStudentAgentTimeline?: (studentId: string) => Promise<{ items: ApiStudentAgentTimelineItem[] }>
  startStudentAgentSession?: (studentId: string) => Promise<ApiStudentAgentSession>
  sendStudentAgentMessage?: (sessionId: string, payload: { prompt: string }) => Promise<{ items: ApiStudentAgentMessage[] }>
  loadStudentRiskExplorer?: (studentId: string) => Promise<ApiStudentRiskExplorer>
  academicBootstrap: ApiAcademicBootstrap
  proofPlaybackNotice?: { tone: 'neutral' | 'error'; message: string } | null
  onResetProofPlaybackSelection: () => Promise<void> | void
}

function OperationalWorkspace({
  repositories,
  initialTeacherId,
  initialRole,
  onLogout,
  onRoleChange,
  loadFacultyProfile,
  loadHodProofAnalytics,
  loadStudentAgentCard,
  loadStudentAgentTimeline,
  startStudentAgentSession,
  sendStudentAgentMessage,
  loadStudentRiskExplorer,
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
  }, [currentTeacher?.facultyId, loadFacultyProfile])
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
  const profileOwnedOfferingIds = useMemo(() => new Set(facultyProfile?.currentOwnedClasses.map(item => item.offeringId) ?? []), [facultyProfile])
  const assignedOfferings = useMemo(() => {
    if (!currentTeacher) return []
    if (role === 'HoD') return allOfferings
    if (facultyProfileLoading) return []
    if (facultyProfile) {
      return profileOwnedOfferingIds.size > 0 ? allOfferings.filter(item => profileOwnedOfferingIds.has(item.offId)) : []
    }
    const ownedOfferingIds = new Set(currentTeacher.offeringIds ?? [])
    return ownedOfferingIds.size > 0 ? allOfferings.filter(item => ownedOfferingIds.has(item.offId)) : []
  }, [allOfferings, currentTeacher, facultyProfile, facultyProfileLoading, profileOwnedOfferingIds, role])
  const assignedMentees = useMemo(() => {
    return resolveAssignedMentees(allMentees, currentTeacher, facultyProfile)
  }, [allMentees, currentTeacher, facultyProfile])

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
  const timetableHydrationSkipRef = useRef(0)
  const blueprintHydrationSkipRef = useRef(0)

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
    timetableHydrationSkipRef.current = 2
    blueprintHydrationSkipRef.current = 2

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
      console.error('Could not persist cell values.', error)
    })
  }, [cellValues, repositories])
  useEffect(() => { void repositories.tasks.saveTasks(allTasksList) }, [allTasksList, repositories])
  useEffect(() => { void repositories.tasks.saveResolvedTasks(resolvedTasks) }, [repositories, resolvedTasks])
  useEffect(() => {
    if (page !== 'calendar') return
    if (timetableHydrationSkipRef.current > 0) {
      timetableHydrationSkipRef.current -= 1
      return
    }
    const serialized = JSON.stringify(timetableByFacultyId)
    if (serialized === hydratedTimetableSnapshotRef.current) return
    const previousSnapshot = hydratedTimetableSnapshotRef.current
    hydratedTimetableSnapshotRef.current = serialized
    void repositories.calendar.saveTimetableTemplates(timetableByFacultyId).catch(error => {
      hydratedTimetableSnapshotRef.current = previousSnapshot
      console.error('Could not persist timetable templates.', error)
    })
  }, [page, repositories, timetableByFacultyId])
  useEffect(() => { void repositories.calendar.saveTaskPlacements(taskPlacements) }, [repositories, taskPlacements])
  useEffect(() => { void repositories.calendar.saveCalendarAudit(calendarAuditEvents) }, [calendarAuditEvents, repositories])
  useEffect(() => { void repositories.entryData.saveStudentPatches(studentPatches) }, [repositories, studentPatches])
  useEffect(() => {
    if (role !== 'Course Leader' || (page !== 'course' && page !== 'scheme-setup' && page !== 'entry-workspace')) return
    void repositories.entryData.saveSchemeState(schemeByOffering)
  }, [page, repositories, role, schemeByOffering])
  useEffect(() => {
    if (role !== 'Course Leader' || (page !== 'course' && page !== 'scheme-setup' && page !== 'entry-workspace')) return
    if (blueprintHydrationSkipRef.current > 0) {
      blueprintHydrationSkipRef.current -= 1
      return
    }
    const serialized = JSON.stringify(ttBlueprintsByOffering)
    if (serialized === hydratedBlueprintSnapshotRef.current) return
    const previousSnapshot = hydratedBlueprintSnapshotRef.current
    hydratedBlueprintSnapshotRef.current = serialized
    void repositories.entryData.saveBlueprintState(ttBlueprintsByOffering).catch(error => {
      hydratedBlueprintSnapshotRef.current = previousSnapshot
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
      console.error('Could not persist lock audit.', error)
    })
  }, [lockAuditByTarget, repositories])

  const supervisedOfferingIds = useMemo(() => new Set(assignedOfferings.map(o => o.offId)), [assignedOfferings])
  const supervisedMenteeIds = useMemo(() => new Set(assignedMentees.map(m => m.id)), [assignedMentees])
  const supervisedMenteeUsns = useMemo(() => new Set(assignedMentees.map(m => m.usn)), [assignedMentees])
  const calendarOfferingIds = useMemo(() => new Set(assignedOfferings.map(item => item.offId)), [assignedOfferings])
  const calendarMenteeIds = useMemo(() => new Set(currentTeacher?.menteeIds ?? []), [currentTeacher])
  const calendarMenteeUsns = useMemo(() => new Set(
    allMentees
      .filter(mentee => calendarMenteeIds.has(mentee.id))
      .map(mentee => mentee.usn),
  ), [allMentees, calendarMenteeIds])
  const calendarOfferings = useMemo(() => allOfferings.filter(item => calendarOfferingIds.has(item.offId)), [allOfferings, calendarOfferingIds])
  const currentFacultyTimetable = useMemo(() => currentTeacher ? (timetableByFacultyId[currentTeacher.facultyId] ?? null) : null, [currentTeacher, timetableByFacultyId])
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
    const sourceOffering = allOfferings.find(item => item.offId === offeringId) ?? defaultOffering
    const basePaper = PAPER_MAP[sourceOffering?.code ?? defaultOffering?.code ?? 'default'] || PAPER_MAP.default
    return {
      tt1: seedBlueprintFromPaper('tt1', basePaper),
      tt2: seedBlueprintFromPaper('tt2', basePaper),
    }
  }, [academicBootstrap, allOfferings, defaultOffering])

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
      const mentorMatch = assignedMentees.find(mentee => mentee.id === studentId || mentee.id === `mentee-${normalizedStudentId}`) ?? allMentees.find(mentee => mentee.id === studentId || mentee.id === `mentee-${normalizedStudentId}`)
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
  }, [allMentees, allOfferings, assignedMentees, assignedOfferings, getStudentsPatched, handleOpenStudent, role])
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
      .then(() => {
        applyRoleLocally()
      })
      .catch(error => {
        setRoleChangeError(error instanceof Error ? error.message : `Could not switch to ${r}.`)
      })
      .finally(() => {
        setRoleChangeBusy(false)
      })
  }, [allowedRoles, clearRouteHistory, onRoleChange, role, roleChangeBusy])

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
        const components = leaves.map(leaf => {
          const key = toCellKey(offId, kind, student.id, leaf.id)
          const score = cellValues[key] ?? patchScores?.[leaf.id]
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
  }, [allOfferings, cellValues, getFallbackBlueprintSet, schemeByOffering, selectors, ttBlueprintsByOffering])

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
  }, [])

  const handleSubmitLock = useCallback((offId: string, kind: EntryKind) => {
    setLockByOffering(prev => ({
      ...prev,
      [offId]: { ...(prev[offId] ?? getEntryLockMap(allOfferings.find(o => o.offId === offId) ?? defaultOffering ?? allOfferings[0])), [kind]: true },
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
  }, [allOfferings, defaultOffering, persistEntryWorkspace])

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
    setPendingNoteAction({ type: 'unlock-request', offeringId, kind })
  }, [])

  const handleCreateTask = useCallback((input: TaskCreateInput) => {
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
  }, [allOfferings, appendCalendarAudit, currentFacultyTimetable, currentTeacher, currentTeacherId, getStudentsPatched, repositories, role])

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
    const off = allOfferings.find(o => o.offId === offeringId)
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
  }, [allOfferings, appendLockAudit, currentTeacherId, repositories, role])

  const submitStudentHandoff = useCallback((studentId: string, offeringId: string, mode: 'escalate' | 'mentor', note: string) => {
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
  }, [allOfferings, currentTeacherId, getStudentsPatched, repositories, role])

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
  }, [allOfferings, defaultOffering, hasEntryStartedForOffering, role])

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
  }, [allOfferings, allTasksList, appendLockAudit, currentTeacherId, defaultOffering])

  const handleOpenTaskStudent = useCallback((task: SharedTask) => {
    const mentorMatch = assignedMentees.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId) ?? allMentees.find(mentee => mentee.usn === task.studentUsn || mentee.id === task.studentId)
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
  }, [allMentees, allOfferings, assignedMentees, assignedOfferings, getStudentsPatched, handleOpenStudent, page, role, studentHistoryByUsn])

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
    greetingHeadline,
    greetingMeta,
    greetingSubline,
    handleNavigateBack,
    handleOpenStudentProfile,
    handleOpenStudentShell,
    handleOpenRiskExplorer,
    handleOpenCourse,
    handleOpenStudent,
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
              <ActionQueue role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onResolveTask={handleResolveTask} onUndoTask={handleUndoTask} onOpenTaskComposer={handleOpenTaskComposer} onRemedialCheckIn={handleRemedialCheckIn} onOpenStudent={handleOpenTaskStudent} onReassignTask={handleReassignTask} onOpenUnlockReview={handleOpenUnlockReview} onOpenQueueHistory={handleOpenQueueHistory} onApproveUnlock={handleApproveUnlock} onRejectUnlock={handleRejectUnlock} onResetComplete={handleResetComplete} onToggleSchedulePause={handleToggleSchedulePause} onEditSchedule={handleEditSchedule} onDismissTask={handleDismissTask} onDismissSeries={handleDismissSeries} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ STUDENT DRAWER ═══ */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDrawer student={selectedStudent} offering={selectedOffering || undefined} historyByUsn={studentHistoryByUsn} role={role} meetings={academicMeetings} onClose={() => { setSelectedStudent(null); setSelectedOffering(null) }} onEscalate={handleOpenStudentEscalation} onOpenTaskComposer={(s, o, taskType) => {
            const resolvedOffering = o ?? allOfferings.find(item => getStudentsPatched(item).some(candidate => candidate.id === s.id))
            handleOpenTaskComposer({ offeringId: resolvedOffering?.offId, studentId: s.id, taskType })
          }} onAssignToMentor={handleOpenStudentMentorHandoff} onOpenHistory={handleOpenHistoryFromStudent} onOpenStudentShell={studentId => handleOpenStudentShell(studentId, page)} onOpenRiskExplorer={studentId => handleOpenRiskExplorer(studentId, page)} onScheduleMeeting={handleScheduleMeeting} />
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

function restrictVisibleFacultyOptions<T extends { facultyId: string; username?: string; name?: string; displayName?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftLabel = (left.displayName ?? left.name ?? left.username ?? left.facultyId).toLowerCase()
    const rightLabel = (right.displayName ?? right.name ?? right.username ?? right.facultyId).toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
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
  const telemetrySinkUrl = import.meta.env.VITE_AIRMENTOR_TELEMETRY_SINK_URL?.trim() || ''
  const apiClient = useMemo(() => (apiBaseUrl ? new AirMentorApiClient(apiBaseUrl) : null), [apiBaseUrl])
  const startupDiagnostics = useMemo(
    () => collectFrontendStartupDiagnostics({ apiBaseUrl, telemetrySinkUrl }),
    [apiBaseUrl, telemetrySinkUrl],
  )
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
  const [playbackCheckpointId, setPlaybackCheckpointId] = useState<string | null>(() => readProofPlaybackSelection()?.simulationStageCheckpointId ?? null)
  const [proofPlaybackNotice, setProofPlaybackNotice] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null)
  const handleReturnToPortal = useCallback(() => {
    if (typeof window !== 'undefined') clearPortalWorkspaceHints(window.localStorage)
    navigateToPortal('home')
  }, [])

  useEffect(() => {
    startupDiagnostics.forEach(diagnostic => {
      emitClientOperationalEvent('startup.diagnostic', {
        workspace: 'academic',
        ...diagnostic,
      }, {
        level: diagnostic.level === 'error' ? 'error' : diagnostic.level === 'warning' ? 'warn' : 'info',
      })
    })
    emitClientOperationalEvent('startup.ready', {
      workspace: 'academic',
      apiBaseUrl: apiBaseUrl || null,
      telemetrySinkConfigured: Boolean(telemetrySinkUrl),
      diagnosticCount: startupDiagnostics.length,
      errorCount: startupDiagnostics.filter(item => item.level === 'error').length,
    })
  }, [apiBaseUrl, startupDiagnostics, telemetrySinkUrl])

  const fetchAcademicBootstrap = useCallback(async () => {
    if (!apiClient) return null
    const syncSnapshot = (snapshot: ApiAcademicBootstrap) => {
      hydrateAcademicData(snapshot)
      setRemoteBootstrap(snapshot)
      setPlaybackCheckpointId(snapshot.proofPlayback?.simulationStageCheckpointId ?? null)
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
    }
    const selection = readProofPlaybackSelection()
    try {
      const requestedCheckpointId = selection?.simulationStageCheckpointId ?? null
      const snapshot = restrictAcademicBootstrap(await apiClient.getAcademicBootstrap(requestedCheckpointId ? {
        simulationStageCheckpointId: requestedCheckpointId,
      } : undefined))
      const restoredCheckpointId = snapshot.proofPlayback?.simulationStageCheckpointId ?? null
      if (requestedCheckpointId && restoredCheckpointId === requestedCheckpointId) {
        const restoredCheckpointLabel = snapshot.proofPlayback?.stageLabel ?? 'selected checkpoint'
        const semesterLabel = snapshot.proofPlayback?.semesterNumber != null
          ? `Semester ${snapshot.proofPlayback.semesterNumber}`
          : 'the selected semester'
        setProofPlaybackNotice({
          tone: 'neutral',
          message: `Proof playback restored to ${semesterLabel} · ${restoredCheckpointLabel}. Use Reset playback to return to the active proof-run view.`,
        })
        emitClientOperationalEvent('proof.playback.restored', {
          workspace: 'academic',
          simulationStageCheckpointId: restoredCheckpointId,
          semesterLabel,
          stageLabel: restoredCheckpointLabel,
        })
      } else if (requestedCheckpointId) {
        clearProofPlaybackSelection()
        setProofPlaybackNotice({
          tone: 'error',
          message: 'Saved proof playback checkpoint is no longer available in this academic scope. Reset playback to return to the active proof-run view.',
        })
        emitClientOperationalEvent('proof.playback.invalidated', {
          workspace: 'academic',
          requestedCheckpointId,
        }, { level: 'warn' })
      } else {
        setProofPlaybackNotice(null)
      }
      return syncSnapshot(snapshot)
    } catch (error) {
      const invalidSelection = selection?.simulationStageCheckpointId
        && error instanceof AirMentorApiError
        && (error.status === 403 || error.status === 404)
      if (!invalidSelection) {
        emitClientOperationalEvent('academic.bootstrap.load_failed', {
          workspace: 'academic',
          requestedCheckpointId: selection?.simulationStageCheckpointId ?? null,
          error: normalizeClientTelemetryError(error),
        }, { level: 'error' })
        throw error
      }
      clearProofPlaybackSelection()
      setProofPlaybackNotice({
        tone: 'error',
        message: 'The selected proof playback checkpoint is no longer accessible in this academic scope. Reset playback to return to the active proof-run view.',
      })
      emitClientOperationalEvent('proof.playback.inaccessible', {
        workspace: 'academic',
        requestedCheckpointId: selection?.simulationStageCheckpointId ?? null,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      const snapshot = restrictAcademicBootstrap(await apiClient.getAcademicBootstrap())
      return syncSnapshot(snapshot)
    }
  }, [apiClient])

  const handleResetProofPlaybackSelection = useCallback(async () => {
    clearProofPlaybackSelection()
    setProofPlaybackNotice(null)
    await fetchAcademicBootstrap().catch(() => undefined)
  }, [fetchAcademicBootstrap])

  useEffect(() => {
    if (typeof window === 'undefined' || !remoteSession?.faculty?.facultyId) return undefined
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PROOF_PLAYBACK_SELECTION_STORAGE_KEY) return
      void fetchAcademicBootstrap().catch(() => undefined)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [fetchAcademicBootstrap, remoteSession?.faculty?.facultyId])

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
          emitClientOperationalEvent('auth.session.restored', {
            workspace: 'academic',
            sessionId: restoredSession.sessionId,
            facultyId: restoredSession.faculty.facultyId,
            activeRole: restoredSession.activeRoleGrant.roleCode,
          })
          setRemoteSession(restoredSession)
          await fetchAcademicBootstrap()
        } else {
          setRemoteSession(null)
          setRemoteBootstrap(null)
        }
      } catch (error) {
        if (cancelled) return
        emitClientOperationalEvent('auth.session.restore_failed', {
          workspace: 'academic',
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
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
    handleReturnToPortal()
  }, [handleReturnToPortal, remoteSessionRepositories])

  const handleRemoteRoleChange = useCallback(async (role: Role) => {
    if (!remoteSession || !remoteSessionRepositories) return
    const match = remoteSession.availableRoleGrants.find(grant => mapApiRoleToRole(grant.roleCode) === role)
    if (!match) return
    const nextSession = await remoteSessionRepositories.sessionPreferences.switchRemoteRoleContext(match.grantId)
    setRemoteSession(nextSession)
    await fetchAcademicBootstrap()
  }, [fetchAcademicBootstrap, remoteSession, remoteSessionRepositories])

  const remoteInitialRole = remoteSession ? mapApiRoleToRole(remoteSession.activeRoleGrant.roleCode) : null

  const loadAcademicFacultyProfile = useCallback(async (facultyId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicFacultyProfile(facultyId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.faculty_profile.load_failed', {
        workspace: 'academic',
        facultyId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicHodProofAnalytics = useCallback(async () => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicHodProofBundle(playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.analytics.load_failed', {
        workspace: 'academic',
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicStudentAgentCard = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentAgentCard(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.student_shell.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const loadAcademicStudentAgentTimeline = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentAgentTimeline(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.student_timeline.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const startAcademicStudentAgentSession = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    return apiClient.startAcademicStudentAgentSession(studentId, playbackCheckpointId ? {
      simulationStageCheckpointId: playbackCheckpointId,
    } : undefined)
  }, [apiClient, playbackCheckpointId])

  const sendAcademicStudentAgentMessage = useCallback((sessionId: string, payload: { prompt: string }) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    return apiClient.sendAcademicStudentAgentMessage(sessionId, payload)
  }, [apiClient])

  const loadAcademicStudentRiskExplorer = useCallback(async (studentId: string) => {
    if (!apiClient) throw new Error('Academic backend is unavailable.')
    try {
      return await apiClient.getAcademicStudentRiskExplorer(studentId, playbackCheckpointId ? {
        simulationStageCheckpointId: playbackCheckpointId,
      } : undefined)
    } catch (error) {
      emitClientOperationalEvent('proof.risk_explorer.load_failed', {
        workspace: 'academic',
        studentId,
        simulationStageCheckpointId: playbackCheckpointId,
        error: normalizeClientTelemetryError(error),
      }, { level: 'warn' })
      throw error
    }
  }, [apiClient, playbackCheckpointId])

  const workspaceSession = remoteSession
  const workspaceRole = remoteInitialRole
  const workspaceBootstrap = remoteBootstrap
  const workspaceRepositories = remoteRepositories
  const workspaceReady = Boolean(remoteSession?.faculty?.facultyId && remoteInitialRole && remoteBootstrap && remoteRepositories)

  return (
    <AcademicSessionBoundary
      backendReady={Boolean(apiClient && remoteSessionRepositories)}
      booting={booting}
      sessionReady={workspaceReady}
      facultyOptions={loginFaculty}
      authBusy={authBusy}
      authError={authError}
      onBackToPortal={handleReturnToPortal}
      onLogin={handleRemoteLogin}
    >
      {workspaceReady ? (
        <OperationalWorkspace
          repositories={workspaceRepositories!}
          initialTeacherId={workspaceSession!.faculty!.facultyId}
          initialRole={workspaceRole!}
          onLogout={handleRemoteLogout}
          onRoleChange={handleRemoteRoleChange}
          loadFacultyProfile={loadAcademicFacultyProfile}
          loadHodProofAnalytics={loadAcademicHodProofAnalytics}
          loadStudentAgentCard={loadAcademicStudentAgentCard}
          loadStudentAgentTimeline={loadAcademicStudentAgentTimeline}
          startStudentAgentSession={startAcademicStudentAgentSession}
          sendStudentAgentMessage={sendAcademicStudentAgentMessage}
          loadStudentRiskExplorer={loadAcademicStudentRiskExplorer}
          academicBootstrap={workspaceBootstrap!}
          proofPlaybackNotice={proofPlaybackNotice}
          onResetProofPlaybackSelection={handleResetProofPlaybackSelection}
        />
      ) : null}
    </AcademicSessionBoundary>
  )
}

function PortalRouterApp() {
  const [route, setRoute] = useState<PortalRoute>(() => {
    if (typeof window === 'undefined') return 'home'
    return resolvePortalRoute(window.location.hash)
  })

  const handleSelectAcademic = useCallback(() => {
    setRoute('app')
    navigateToPortal('app')
  }, [])

  const handleSelectAdmin = useCallback(() => {
    setRoute('admin')
    navigateToPortal('admin')
  }, [])

  const handleExitAdminToPortal = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearPortalWorkspaceHints(window.localStorage)
    }
    setRoute('home')
    navigateToPortal('home')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncRoute = () => setRoute(resolvePortalRoute(window.location.hash))
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
      onSelectAcademic={handleSelectAcademic}
      onSelectAdmin={handleSelectAdmin}
    />
  )
}

export default function App() {
  return <PortalRouterApp />
}
