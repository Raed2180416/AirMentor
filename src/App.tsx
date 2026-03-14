import { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Calendar, CheckCircle, ChevronRight,
  LayoutDashboard, ListTodo, Mail, Phone, Shield, Upload, Users, X,
  AlertTriangle, TrendingDown, BookOpen, Target, Activity, Eye, MessageSquare,
} from 'lucide-react'
import {
  CO_COLORS, T, mono, sora, yearColor,
  PROFESSOR, OFFERINGS, YEAR_GROUPS, PAPER_MAP,
  FACULTY, generateTasks, MENTEES, CALENDAR_EVENTS, getStudentHistoryRecord,
  type Offering, type Student, type YearGroup,
  type Mentee, type StudentHistoryRecord,
} from './data'
import {
  createTransition,
  getNextScheduledDate,
  getRemedialProgress,
  normalizeDateISO,
  normalizeThemeMode,
  toDueLabel,
  toTodayISO,
  type EntryKind,
  type EntryLockMap,
  type FacultyAccount,
  type FacultyCapabilitySet,
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
  type TaskType,
  type TermTestBlueprint,
  type ThemeMode,
  type TTKind,
} from './domain'
import {
  AppSelectorsContext,
  defaultSchemeForOffering,
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
import { inferKindFromPendingAction } from './page-utils'
import { createLocalAirMentorRepositories } from './repositories'
import { Bar, Btn, Card, Chip, HScrollArea, PageShell, RiskBadge, StagePips, TD, TH } from './ui-primitives'
import './App.css'

const LazyCourseDetail = lazy(() => import('./pages/course-pages').then(module => ({ default: module.CourseDetail })))
const LazyAllStudentsPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.AllStudentsPage })))
const LazyStudentHistoryPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.StudentHistoryPage })))
const LazySchemeSetupPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.SchemeSetupPage })))
const LazyUploadPage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.UploadPage })))
const LazyEntryWorkspacePage = lazy(() => import('./pages/workflow-pages').then(module => ({ default: module.EntryWorkspacePage })))
const LazyHodView = lazy(() => import('./pages/hod-pages').then(module => ({ default: module.HodView })))

type TaskComposerState = {
  isOpen: boolean
  step: 'details' | 'remedial'
  offeringId?: string
  studentId?: string
  taskType: TaskType
  dueDateISO: string
  note: string
  search: string
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
}

type PageId = 'dashboard' | 'students' | 'course' | 'calendar' | 'upload' | 'entry-workspace' | 'mentees' | 'department' | 'mentee-detail' | 'student-history' | 'unlock-review' | 'scheme-setup' | 'queue-history'

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

const THEME_PRESETS: Record<ThemeMode, typeof T> = {
  'frosted-focus-light': {
    ...T,
    bg: '#edf3f8', surface: '#f7fbff', surface2: '#edf5ff', surface3: '#e4effa',
    border: '#d5e3f2', border2: '#c6d8ec',
    text: '#11243d', muted: '#4d647f', dim: '#8ea1b8',
    accent: '#3b82f6', accentLight: '#70a6ff',
  },
  'frosted-focus-dark': {
    ...T,
    bg: '#0a1018', surface: '#101a27', surface2: '#152131', surface3: '#1a293d',
    border: '#25364b', border2: '#2d435d',
    text: '#d5dfee', muted: '#9badc3', dim: '#607790',
    accent: '#5ea0ff', accentLight: '#84b8ff',
  },
}

function isLightTheme(mode: ThemeMode) {
  return mode.endsWith('-light')
}

function applyThemePreset(mode: ThemeMode) {
  Object.assign(T, THEME_PRESETS[mode])
}

function getHomePage(role: Role): PageId {
  return role === 'Course Leader' ? 'dashboard' : role === 'Mentor' ? 'mentees' : 'department'
}

function canAccessPage(role: Role, page: PageId) {
  if (page === 'student-history' || page === 'queue-history') return true
  if (page === 'scheme-setup') return role === 'Course Leader'
  if (page === 'unlock-review') return role === 'HoD'
  if (page === 'mentee-detail') return role === 'Mentor'
  if (role === 'Course Leader') return ['dashboard', 'students', 'course', 'calendar', 'upload', 'entry-workspace'].includes(page)
  if (role === 'Mentor') return ['mentees', 'calendar'].includes(page)
  return ['department', 'course', 'calendar', 'unlock-review'].includes(page)
}

function formatDateTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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

function LoginPage({ onLogin }: { onLogin: (facultyId: string) => void }) {
  const [teacherId, setTeacherId] = useState<string>(FACULTY[0]?.facultyId ?? '')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== '1234') {
      setErr('Invalid password')
      return
    }
    setErr('')
    onLogin(teacherId)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 420, padding: 24 }} glow={T.accent}>
        <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text, marginBottom: 6 }}>AirMentor Login</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 16 }}>Use password <span style={{ color: T.accent }}>1234</span> for mock flow.</div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label htmlFor="teacher-login" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 5 }}>Teacher</label>
            <select id="teacher-login" value={teacherId} onChange={e => setTeacherId(e.target.value)} style={{ width: '100%', ...mono, fontSize: 12, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '9px 10px' }}>
              {FACULTY.map(faculty => <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="teacher-password" style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 5 }}>Password</label>
            <input id="teacher-password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', ...mono, fontSize: 12, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 7, padding: '9px 10px' }} />
          </div>

          {err && <div style={{ ...mono, fontSize: 11, color: T.danger, marginBottom: 10 }}>{err}</div>}
          <Btn type="submit"><Shield size={14} /> Login</Btn>
        </form>
      </Card>
    </div>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
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
      </div>
    </div>
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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, minHeight: 620, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{step === 'details' ? 'Add Task' : 'Build Remedial Plan'}</div>
            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{step === 'details' ? 'One unified task flow for follow-up, attendance, academic, and remedial actions.' : 'Step 2 of 2 · leaf tasks stay tied to the same queue item.'}</div>
          </div>
          <button aria-label="Close task composer" title="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={16} /></button>
        </div>

        <div className="scroll-pane scroll-pane--dense" style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'grid', gap: 12 }}>
          {step === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select aria-label="Select year" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                  <option value="">All Years</option>
                  {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <select aria-label="Select branch" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                  <option value="">All Branches</option>
                  {deptOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              <select aria-label="Select class" value={activeSelectedOffId} onChange={e => { setSelectedOffId(e.target.value); setQuery('') }} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                <option value="">Select class</option>
                {classOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Sec {offering.section} · {offering.count} students</option>)}
              </select>
              <input aria-label="Search student" placeholder="Search student / USN" value={query} onChange={e => setQuery(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
              {query.trim() !== '' && <div className="scroll-pane scroll-pane--dense" style={{ minHeight: 96, maxHeight: 140, overflowY: 'auto', border: `1px solid ${T.border2}`, borderRadius: 6, background: T.surface2 }}>
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
              <select aria-label="Select student" value={selectedStudentId} onChange={e => {
                const nextId = e.target.value
                setSelectedStudentId(nextId)
                const nextStudent = filteredStudents.find(student => student.id === nextId)
                if (nextStudent) hydrateSelectedStudent(nextStudent)
              }} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                <option value="">Select student</option>
                {filteredStudents.map(student => <option key={student.id} value={student.id}>{student.name} · {student.usn}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select aria-label="Task type" value={taskType} onChange={e => setTaskType(e.target.value as TaskType)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                  <option>Follow-up</option>
                  <option>Remedial</option>
                  <option>Attendance</option>
                  <option>Academic</option>
                </select>
                <input aria-label={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} title={schedulingMode === 'scheduled' ? 'Starts on' : 'Due date'} type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
              </div>
              <Card style={{ padding: '10px 12px' }}>
                <div style={{ ...sora, fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 8 }}>Scheduling</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" onClick={() => setSchedulingMode('one-time')} style={{ ...mono, fontSize: 10, borderRadius: 6, border: `1px solid ${schedulingMode === 'one-time' ? T.accent : T.border}`, background: schedulingMode === 'one-time' ? `${T.accent}18` : 'transparent', color: schedulingMode === 'one-time' ? T.accentLight : T.muted, padding: '5px 8px', cursor: 'pointer' }}>One-time</button>
                  <button type="button" onClick={() => setSchedulingMode('scheduled')} style={{ ...mono, fontSize: 10, borderRadius: 6, border: `1px solid ${schedulingMode === 'scheduled' ? T.accent : T.border}`, background: schedulingMode === 'scheduled' ? `${T.accent}18` : 'transparent', color: schedulingMode === 'scheduled' ? T.accentLight : T.muted, padding: '5px 8px', cursor: 'pointer' }}>Scheduled</button>
                </div>
                {schedulingMode === 'scheduled' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select aria-label="Schedule preset" value={schedulePreset} onChange={e => setSchedulePreset(e.target.value as SchedulePreset)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="custom dates">Custom dates</option>
                      </select>
                      {schedulePreset !== 'custom dates' && <input aria-label="Recurring time (optional)" type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />}
                    </div>
                    {schedulePreset === 'custom dates' && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {customDates.map((item, index) => (
                          <div key={`custom-date-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                            <input aria-label={`Custom date ${index + 1}`} type="date" value={item.dateISO} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, dateISO: e.target.value } : row))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                            <input aria-label={`Custom date ${index + 1} time`} type="time" value={item.time ?? ''} onChange={e => setCustomDates(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, time: e.target.value } : row))} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                            <button type="button" aria-label={`Remove custom date ${index + 1}`} onClick={() => setCustomDates(prev => prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index))} style={{ ...mono, fontSize: 10, borderRadius: 6, border: `1px solid ${T.border2}`, background: 'transparent', color: T.muted, padding: '0 8px', cursor: 'pointer' }}>−</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setCustomDates(prev => [...prev, { dateISO: '', time: '' }])} style={{ ...mono, fontSize: 10, borderRadius: 6, border: `1px dashed ${T.border2}`, background: 'transparent', color: T.accent, padding: '6px 8px', cursor: 'pointer' }}>+ Add custom date</button>
                      </div>
                    )}
                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>Starts on: {normalizeDateISO(dueDateISO) ?? 'today'} · Queue activation occurs at the start of each scheduled date. Time is metadata only.</div>
                  </div>
                )}
              </Card>
              <textarea aria-label="Task note" value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Task note" style={{ width: '100%', resize: 'none', ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
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
              <input aria-label="Remedial plan title" value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="Plan title" style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input aria-label="Plan due date" type="date" value={dueDateISO} onChange={e => setDueDateISO(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                <input aria-label="Check-in date 1" type="date" value={checkIn1} onChange={e => setCheckIn1(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
                <input aria-label="Check-in date 2" type="date" value={checkIn2} onChange={e => setCheckIn2(e.target.value)} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted }}>Plan steps (checklist)</div>
              {planSteps.map((stepLabel, index) => (
                <input key={index} aria-label={`Plan step ${index + 1}`} value={stepLabel} onChange={e => setPlanSteps(prev => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`Step ${index + 1}`} style={{ ...mono, fontSize: 11, background: T.surface2, color: T.text, border: `1px solid ${T.border2}`, borderRadius: 6, padding: '8px 10px' }} />
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Chip color={T.accent} size={9}>Owner: {role}</Chip>
          <div style={{ display: 'flex', gap: 8 }}>
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
              })
              onClose()
            }}>Create Remedial Task</Btn>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   STUDENT DRAWER — SHAP, What-If, CO, Interventions
   ══════════════════════════════════════════════════════════════ */

function StudentDrawer({ student, offering, role, onClose, onEscalate, onOpenTaskComposer, onAssignToMentor, onOpenHistory }: { student: Student | null; offering?: Offering; role: Role; onClose: () => void; onEscalate: (s: Student, o?: Offering) => void; onOpenTaskComposer: (s: Student, o?: Offering, taskType?: TaskType) => void; onAssignToMentor: (s: Student, o?: Offering) => void; onOpenHistory: (s: Student, o?: Offering) => void }) {
  const { deriveAcademicProjection, getSchemeForOffering } = useAppSelectors()
  if (!student) return null
  const s = student
  const attPct = Math.round(s.present / s.totalClasses * 100)
  const riskCol = s.riskBand === 'High' ? T.danger : s.riskBand === 'Medium' ? T.warning : T.success
  const canSeeDetailedMarks = role !== 'Mentor'
  const drawerHistory = buildHistoryProfile({ student: s, offering: offering ?? null })
  const ceSummary = offering ? deriveAcademicProjection({ offering, student: s, scheme: getSchemeForOffering(offering), history: drawerHistory }) : null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <motion.div initial={{ x: 320, opacity: 1 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.12, ease: 'easeOut' }}
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
              { lbl: 'CE Signal', val: ceSummary ? `${ceSummary.ce60.toFixed(1)}/60` : '—', col: ceSummary ? (ceSummary.ce60 >= 30 ? T.success : ceSummary.ce60 >= 24 ? T.warning : T.danger) : T.warning },
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

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn size="sm" onClick={() => navigator.clipboard.writeText(s.phone)}><Phone size={12} /> Call</Btn>
          <Btn size="sm" variant="ghost"><Mail size={12} /> Email</Btn>
          <Btn size="sm" variant="ghost" onClick={() => onOpenTaskComposer(s, offering, s.riskBand === 'High' ? 'Remedial' : 'Follow-up')}><MessageSquare size={12} /> Add Task</Btn>
          {(role === 'Course Leader' || role === 'HoD') && <Btn size="sm" variant="ghost" onClick={() => onAssignToMentor(s, offering)}><Users size={12} /> Defer to Mentor</Btn>}
          <Btn size="sm" variant="ghost" onClick={() => onOpenHistory(s, offering)}><Eye size={12} /> Open Full Profile</Btn>
          {role !== 'HoD' && <Btn size="sm" variant="danger" onClick={() => onEscalate(s, offering)}><AlertTriangle size={12} /> Escalate to HoD</Btn>}
        </div>
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ACTION QUEUE (Right Sidebar)
   ══════════════════════════════════════════════════════════════ */

function ActionQueue({ role, tasks, resolvedTaskIds, onResolveTask, onUndoTask, onOpenStudent, onOpenTaskComposer, onRemedialCheckIn, onReassignTask, onOpenUnlockReview, onOpenQueueHistory, onApproveUnlock, onRejectUnlock, onResetComplete, onToggleSchedulePause, onEndSchedule, onEditSchedule }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onResolveTask: (id: string) => void; onUndoTask: (id: string) => void; onOpenStudent: (task: SharedTask) => void; onOpenTaskComposer: (input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => void; onRemedialCheckIn: (taskId: string) => void; onReassignTask: (taskId: string, toRole: Role) => void; onOpenUnlockReview: (taskId: string) => void; onOpenQueueHistory: () => void; onApproveUnlock: (taskId: string) => void; onRejectUnlock: (taskId: string) => void; onResetComplete: (taskId: string) => void; onToggleSchedulePause: (taskId: string) => void; onEndSchedule: (taskId: string) => void; onEditSchedule: (taskId: string) => void }) {
  const todayISO = toTodayISO()
  const active = tasks
    .filter(t => !resolvedTaskIds[t.id])
    .filter(t => {
      if (t.scheduleMeta?.mode !== 'scheduled') return true
      if (t.scheduleMeta.status === 'ended' || t.scheduleMeta.status === 'paused') return false
      const activationDate = normalizeDateISO(t.scheduleMeta.nextDueDateISO) ?? normalizeDateISO(t.dueDateISO)
      if (!activationDate) return true
      return activationDate <= todayISO
    })
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  const done = tasks.filter(t => !!resolvedTaskIds[t.id]).sort((a, b) => (resolvedTaskIds[b.id] ?? 0) - (resolvedTaskIds[a.id] ?? 0))

  return (
    <div className="scroll-pane scroll-pane--dense" style={{ width: 320, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', padding: '18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ListTodo size={16} color={T.accent} />
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Action Queue</div>
        <button aria-label="Open queue history" title="Open queue history" onClick={onOpenQueueHistory} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>History</button>
        <Chip color={T.danger} size={10}>{active.length} pending</Chip>
      </div>
      <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>Single-owner queue with visible reassignment trail.</div>

      {active.map(t => {
        const progress = getRemedialProgress(t.remedialPlan)
        const hasRemedialFlow = (t.taskType === 'Remedial' || !!t.remedialPlan) && progress.total > 0
        const latestTransition = getLatestTransition(t)
        return (
          <div key={t.id} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
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
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {(t.taskType === 'Remedial' || !!t.remedialPlan) && <button aria-label="Log remedial check-in" title="Check-in" onClick={() => onRemedialCheckIn(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.warning, padding: 2 }}><Activity size={13} /></button>}
              <button aria-label="Open task student details" title="Open student" onClick={() => onOpenStudent(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, padding: 2 }}><Eye size={13} /></button>
              {t.unlockRequest && role === 'HoD' && (
                <>
                  <button aria-label="Review unlock request" title="Review unlock" onClick={() => onOpenUnlockReview(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.warning, ...mono, fontSize: 10 }}>Review</button>
                  {t.unlockRequest.status === 'Pending' && <button aria-label="Approve unlock request" title="Approve unlock" onClick={() => onApproveUnlock(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.success, ...mono, fontSize: 10 }}>Approve</button>}
                  {t.unlockRequest.status === 'Pending' && <button aria-label="Reject unlock request" title="Reject unlock" onClick={() => onRejectUnlock(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, ...mono, fontSize: 10 }}>Reject</button>}
                  {t.unlockRequest.status === 'Approved' && <button aria-label="Reset and unlock dataset" title="Reset and unlock" onClick={() => onResetComplete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.success, ...mono, fontSize: 10 }}>Reset</button>}
                </>
              )}
              {role === 'Course Leader' && !t.unlockRequest && <button aria-label="Reassign task to mentor" title="Defer to Mentor" onClick={() => onReassignTask(t.id, 'Mentor')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue, ...mono, fontSize: 10 }}>Mentor</button>}
              {role !== 'HoD' && !t.unlockRequest && <button aria-label="Reassign task to hod" title="Defer to HoD" onClick={() => onReassignTask(t.id, 'HoD')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, ...mono, fontSize: 10 }}>HoD</button>}
              {role === 'HoD' && !t.unlockRequest && <button aria-label="Return task to course leader" title="Return to Course Leader" onClick={() => onReassignTask(t.id, 'Course Leader')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue, ...mono, fontSize: 10 }}>CL</button>}
              {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Pause or resume recurrence" title={t.scheduleMeta.status === 'paused' ? 'Resume recurrence' : 'Pause recurrence'} onClick={() => onToggleSchedulePause(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.warning, ...mono, fontSize: 10 }}>{t.scheduleMeta.status === 'paused' ? 'Resume' : 'Pause'}</button>}
              {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="Edit recurrence" title="Edit recurrence" onClick={() => onEditSchedule(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, ...mono, fontSize: 10 }}>Edit schedule</button>}
              {t.scheduleMeta?.mode === 'scheduled' && t.scheduleMeta.status !== 'ended' && <button aria-label="End recurrence" title="End recurrence" onClick={() => onEndSchedule(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, ...mono, fontSize: 10 }}>End</button>}
              <button aria-label="Mark task as resolved" title="Resolve task" onClick={() => onResolveTask(t.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.success, padding: 2 }}><CheckCircle size={13} /></button>
            </div>
          </div>
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

function CLDashboard({ offerings, pendingTaskCount, onOpenCourse, onOpenStudent, onOpenUpload, onOpenAllStudents, teacherInitials, greetingHeadline, greetingMeta }: { offerings: Offering[]; pendingTaskCount: number; onOpenCourse: (o: Offering) => void; onOpenStudent: (s: Student, o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void; onOpenAllStudents: () => void; teacherInitials: string; greetingHeadline: string; greetingMeta: string }) {
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
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Academic Year</div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>Odd Sem 2025–26</div>
          <div style={{ marginTop: 8 }}><Btn size="sm" onClick={() => onOpenUpload()}>Open Data Entry Hub</Btn></div>
        </div>
      </div>

      {/* Stat Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '📚', label: 'Assigned Classes', val: offerings.length, color: T.accent },
          { icon: '👥', label: 'Total Students', val: total, color: T.success, action: onOpenAllStudents },
          { icon: '‼️', label: 'High Risk Students', val: highRiskCount, color: T.danger },
          { icon: '🎯', label: 'Pending Actions', val: pendingTaskCount, color: T.warning },
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

      {/* Summary Table */}
      <SummaryTable offerings={offerings} onOpenCourse={onOpenCourse} onOpenUpload={onOpenUpload} />
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
      <div onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: `${color}0c`, border: `1px solid ${color}28`, borderRadius: collapsed ? 10 : '10px 10px 0 0', marginBottom: collapsed ? 0 : 12, cursor: 'pointer', transition: 'all 0.2s', flexWrap: 'wrap' }}>
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
  const [hov, setHov] = useState(false)
  const sc = o.stageInfo.color
  const avgAtt = getOfferingAttendancePatched(o)
  const ac = avgAtt >= 75 ? T.success : avgAtt >= 65 ? T.warning : T.danger
  const checks = [o.tt1Done, o.tt2Done, avgAtt >= 75]
  const highRisk = o.stage >= 2 ? getStudentsPatched(o).filter(s => s.riskBand === 'High').length : 0

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={() => onOpen(o)}
      style={{ background: T.surface, border: `1px solid ${hov ? yc + '50' : T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s', transform: hov ? 'translateY(-2px)' : 'none', boxShadow: hov ? `0 8px 24px ${yc}12` : 'none', position: 'relative', overflow: 'hidden' }}>
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
    </div>
  )
}

function SummaryTable({ offerings, onOpenCourse, onOpenUpload }: { offerings: Offering[]; onOpenCourse: (o: Offering) => void; onOpenUpload: (o?: Offering, kind?: EntryKind) => void }) {
  const { getStudentsPatched, getOfferingAttendancePatched } = useAppSelectors()
  return (
    <Card style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>All Assigned Classes — Quick View</div>
      </div>
      <HScrollArea>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Year', 'Code', 'Course', 'Sec', 'Students', 'Attendance', 'Stage', 'TT1', 'TT2', 'High Risk', 'Action', 'Entry'].map(h => <TH key={h}>{h}</TH>)}</tr>
          </thead>
          <tbody>
            {offerings.map(o => {
              const avgAtt = getOfferingAttendancePatched(o)
              const ac = avgAtt >= 75 ? T.success : avgAtt >= 65 ? T.warning : T.danger
              const yc = yearColor(o.year)
              const hr = o.stage >= 2 ? getStudentsPatched(o).filter(s => s.riskBand === 'High').length : 0
              return (
                <tr key={o.offId} onClick={() => onOpenCourse(o)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.surface2)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <TD><Chip color={yc} size={9}>{o.year}</Chip></TD>
                  <TD style={{ ...mono, fontSize: 11, color: yc }}>{o.code}</TD>
                  <TD style={{ ...sora, fontSize: 12, color: T.text }}>{o.title}</TD>
                  <TD style={{ ...mono, fontSize: 11, color: T.muted }}>Sec {o.section}</TD>
                  <TD style={{ ...mono, fontSize: 12, fontWeight: 600, color: T.text }}>{o.count}</TD>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
                      <Bar val={avgAtt} color={ac} h={4} />
                      <span style={{ ...mono, fontSize: 10, color: ac }}>{avgAtt}%</span>
                    </div>
                  </TD>
                  <TD><Chip color={o.stageInfo.color} size={9}>{o.stageInfo.label}</Chip></TD>
                  <TD style={{ textAlign: 'center' }}><span style={{ color: o.tt1Done ? T.success : T.dim, fontSize: 13 }}>{o.tt1Done ? '✓' : '—'}</span></TD>
                  <TD style={{ textAlign: 'center' }}><span style={{ color: o.tt2Done ? T.success : T.dim, fontSize: 13 }}>{o.tt2Done ? '✓' : '—'}</span></TD>
                  <TD>{hr > 0 ? <Chip color={T.danger} size={9}>{hr} students</Chip> : <span style={{ ...mono, fontSize: 10, color: T.dim }}>—</span>}</TD>
                  <TD>{o.pendingAction ? <Chip color={T.warning} size={9}>{o.pendingAction}</Chip> : <Chip color={T.success} size={9}>✓</Chip>}</TD>
                  <TD><button onClick={(e) => { e.stopPropagation(); onOpenUpload(o, inferKindFromPendingAction(o.pendingAction)) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Open Hub</button></TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </HScrollArea>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════════
   MENTOR VIEW — Student-centric, cross-subject risk
   ══════════════════════════════════════════════════════════════ */

function MentorView({ mentees, onOpenMentee }: { mentees: Mentee[]; onOpenMentee: (m: Mentee) => void }) {
  const sorted = [...mentees].sort((a, b) => b.avs - a.avs)
  const highRisk = mentees.filter(m => m.avs >= 0.6).length
  const medRisk = mentees.filter(m => m.avs >= 0.35 && m.avs < 0.6).length
  const noData = mentees.filter(m => m.avs < 0).length

  return (
    <PageShell size="standard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Users size={22} color={T.accent} />
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text }}>My Mentees</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Student-centric view · Aggregate vulnerability across all courses</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { lbl: 'Total Mentees', val: mentees.length, col: T.accent },
          { lbl: 'High Vulnerability', val: highRisk, col: T.danger },
          { lbl: 'Medium Risk', val: medRisk, col: T.warning },
          { lbl: 'Awaiting Data', val: noData, col: T.dim },
        ].map((x, i) => (
          <Card key={i} glow={x.col} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: x.col }}>{x.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{x.lbl}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(m => {
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
      </div>
    </PageShell>
  )
}

function MenteeDetailPage({ mentee, tasks, onBack, onOpenHistory }: { mentee: Mentee; tasks: SharedTask[]; onBack: () => void; onOpenHistory: (mentee: Mentee) => void }) {
  const activeTasks = tasks.filter(task => task.studentUsn === mentee.usn)
  const latestIntervention = mentee.interventions[mentee.interventions.length - 1]
  const avgCourseRisk = mentee.avs >= 0 ? Math.round(mentee.courseRisks.filter(r => r.risk >= 0).reduce((acc, risk) => acc + risk.risk, 0) / Math.max(1, mentee.courseRisks.filter(r => r.risk >= 0).length) * 100) : null

  return (
    <PageShell size="standard">
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back to Mentees</button>
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
        {[
          { lbl: 'Aggregate Risk', val: mentee.avs >= 0 ? `${Math.round(mentee.avs * 100)}%` : 'Awaiting TT1', col: mentee.avs >= 0.6 ? T.danger : mentee.avs >= 0.35 ? T.warning : T.success },
          { lbl: 'Prev CGPA', val: mentee.prevCgpa > 0 ? mentee.prevCgpa.toFixed(1) : '—', col: mentee.prevCgpa >= 7 ? T.success : mentee.prevCgpa >= 6 ? T.warning : T.danger },
          { lbl: 'Tracked Courses', val: mentee.courseRisks.length, col: T.accent },
          { lbl: 'Open Queue Items', val: activeTasks.length, col: activeTasks.length > 0 ? T.warning : T.success },
        ].map((metric, index) => (
          <Card key={index} glow={metric.col} style={{ padding: '12px 16px' }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: metric.col }}>{metric.val}</div>
            <div style={{ ...mono, fontSize: 9, color: T.muted }}>{metric.lbl}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ ...sora, fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 10 }}>Current Course Risk Map</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {mentee.courseRisks.map(risk => {
              const color = risk.risk >= 0.7 ? T.danger : risk.risk >= 0.35 ? T.warning : risk.risk >= 0 ? T.success : T.dim
              return (
                <div key={risk.code} style={{ background: T.surface2, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div>
                      <div style={{ ...sora, fontWeight: 600, fontSize: 13, color: T.text }}>{risk.code}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted }}>{risk.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...sora, fontWeight: 800, fontSize: 18, color }}>{risk.risk >= 0 ? `${Math.round(risk.risk * 100)}%` : '—'}</div>
                      <div style={{ ...mono, fontSize: 9, color: T.dim }}>{risk.risk >= 0 ? `${risk.band} vulnerability` : 'Awaiting data'}</div>
                    </div>
                  </div>
                  <Bar val={risk.risk >= 0 ? risk.risk * 100 : 0} color={color} h={5} />
                </div>
              )
            })}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Mentor Summary</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              {avgCourseRisk !== null ? `Average course risk is ${avgCourseRisk}%.` : 'No score-based risk yet.'}
              {' '}Previous-semester CGPA is {mentee.prevCgpa > 0 ? mentee.prevCgpa.toFixed(1) : 'not yet available'}.
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

          <Card>
            <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Queue Ownership Snapshot</div>
            {activeTasks.length > 0 ? activeTasks.map(task => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{task.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted }}>{getLatestTransition(task)?.action ?? 'Created'} · {task.due}</div>
                </div>
                <Chip color={task.assignedTo === 'Mentor' ? T.warning : task.assignedTo === 'HoD' ? T.danger : T.accent} size={9}>{task.assignedTo}</Chip>
              </div>
            )) : (
              <div style={{ ...mono, fontSize: 11, color: T.dim }}>No active queue items for this mentee.</div>
            )}
            {latestIntervention && <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 10 }}>Latest intervention: {latestIntervention.note}</div>}
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

function UnlockReviewPage({ task, offering, onBack, onApprove, onReject, onResetComplete }: { task: SharedTask; offering: Offering | null; onBack: () => void; onApprove: () => void; onReject: () => void; onResetComplete: () => void }) {
  return (
    <PageShell size="narrow">
      <button onClick={onBack} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10 }}>← Back</button>
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

function QueueHistoryPage({ role, tasks, resolvedTaskIds, onOpenTaskStudent, onOpenUnlockReview }: { role: Role; tasks: SharedTask[]; resolvedTaskIds: Record<string, number>; onOpenTaskStudent: (task: SharedTask) => void; onOpenUnlockReview: (taskId: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')
  const visible = tasks
    .filter(task => filter === 'all' ? true : filter === 'active' ? !resolvedTaskIds[task.id] : !!resolvedTaskIds[task.id])
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

  return (
    <PageShell size="standard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...sora, fontWeight: 700, fontSize: 21, color: T.text }}>Queue History</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{role} view of active, resolved, and reassigned items.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'resolved'] as const).map(option => (
            <button key={option} onClick={() => setFilter(option)} style={{ ...mono, fontSize: 10, padding: '5px 8px', borderRadius: 4, border: `1px solid ${filter === option ? T.accent : T.border}`, background: filter === option ? T.accent + '18' : 'transparent', color: filter === option ? T.accentLight : T.muted, cursor: 'pointer' }}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map(task => (
          <Card key={task.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{task.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 3 }}>{task.studentName} · {task.studentUsn} · {task.courseCode || 'Mentor context'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip color={resolvedTaskIds[task.id] ? T.success : T.warning} size={9}>{resolvedTaskIds[task.id] ? 'Resolved' : 'Active'}</Chip>
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
              <Btn size="sm" variant="ghost" onClick={() => onOpenTaskStudent(task)}>Open Student</Btn>
              {task.unlockRequest && role === 'HoD' && <Btn size="sm" onClick={() => onOpenUnlockReview(task.id)}>Open Unlock Review</Btn>}
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

function CalendarPage() {
  const typeColor: Record<string, string> = { tt: T.accent, quiz: T.warning, asgn: T.success, att: T.pink, see: T.danger }
  const typeLabel: Record<string, string> = { tt: 'Term Test', quiz: 'Quiz', asgn: 'Assignment', att: 'Attendance', see: 'Finals' }
  return (
    <PageShell size="narrow">
      <div style={{ ...sora, fontWeight: 700, fontSize: 20, color: T.text, marginBottom: 4 }}>Academic Calendar</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginBottom: 20 }}>Odd Semester 2025-26</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {CALENDAR_EVENTS.map((event, index) => {
          const color = typeColor[event.type] || T.muted
          const yearTint = event.year === 'All' ? T.muted : yearColor(event.year)
          return (
            <div key={index} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 18px', background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}`, borderRadius: index === 0 ? '10px 10px 0 0' : index === CALENDAR_EVENTS.length - 1 ? '0 0 10px 10px' : '0' }}>
              <div style={{ ...mono, fontSize: 11, color: T.muted, minWidth: 52 }}>{event.date}</div>
              <div style={{ flex: 1, ...sora, fontSize: 13, color: T.text }}>{event.label}</div>
              <Chip color={color} size={9}>{typeLabel[event.type] || event.type}</Chip>
              <Chip color={yearTint} size={9}>{event.year}</Chip>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   ROOT APP
   ══════════════════════════════════════════════════════════════ */

const CL_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'students', icon: Users, label: 'All Students' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'upload', icon: Upload, label: 'Data Entry Hub' },
]
const MENTOR_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'mentees', icon: Users, label: 'My Mentees' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
]
const HOD_NAV: Array<{ id: PageId; icon: typeof LayoutDashboard; label: string }> = [
  { id: 'department', icon: Shield, label: 'Department' },
  { id: 'queue-history', icon: ListTodo, label: 'Queue History' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
]

export default function App() {
  const repositories = useMemo(() => createLocalAirMentorRepositories(), [])
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [isCompactTopbar, setIsCompactTopbar] = useState(() => window.innerWidth < 980)
  const [showTopbarMenu, setShowTopbarMenu] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(() => repositories.sessionPreferences.getCurrentFacultyIdSnapshot())
  const currentTeacher = useMemo<FacultyAccount | null>(() => currentTeacherId ? (FACULTY.find(faculty => faculty.facultyId === currentTeacherId) ?? null) : null, [currentTeacherId])
  const [role, setRole] = useState<Role>(() => currentTeacher?.allowedRoles[0] ?? 'Course Leader')
  const [page, setPage] = useState<PageId>(() => getHomePage(currentTeacher?.allowedRoles[0] ?? 'Course Leader'))
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
  const [uploadOffering, setUploadOffering] = useState<Offering | null>(null)
  const [uploadKind, setUploadKind] = useState<EntryKind>('tt1')
  const [entryOfferingId, setEntryOfferingId] = useState<string>(OFFERINGS[0].offId)
  const [entryKind, setEntryKind] = useState<EntryKind>('tt1')
  const [courseInitialTab, setCourseInitialTab] = useState<string | undefined>(undefined)
  const [taskComposer, setTaskComposer] = useState<TaskComposerState>({ isOpen: false, step: 'details', taskType: 'Follow-up', dueDateISO: '', note: '', search: '' })
  const [pendingNoteAction, setPendingNoteAction] = useState<NoteActionState | null>(null)
  const [studentPatches, setStudentPatches] = useState<Record<string, StudentRuntimePatch>>(() => repositories.entryData.getStudentPatchesSnapshot())
  const [schemeByOffering, setSchemeByOffering] = useState<Record<string, SchemeState>>(() => repositories.entryData.getSchemeStateSnapshot(OFFERINGS))
  const [ttBlueprintsByOffering, setTtBlueprintsByOffering] = useState<Record<string, Record<TTKind, TermTestBlueprint>>>(() => repositories.entryData.getBlueprintSnapshot(OFFERINGS))
  const [lockAuditByTarget, setLockAuditByTarget] = useState<Record<string, QueueTransition[]>>(() => repositories.locksAudit.getLockAuditSnapshot())
  const selectors = useMemo(() => createAppSelectors({ studentPatches, schemeByOffering, ttBlueprintsByOffering }), [schemeByOffering, studentPatches, ttBlueprintsByOffering])
  const { getStudentsPatched } = selectors

  const allowedRoles = useMemo(() => currentTeacher?.allowedRoles ?? [], [currentTeacher])
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

  useEffect(() => { void repositories.locksAudit.saveLocks(lockByOffering) }, [lockByOffering, repositories])
  useEffect(() => { void repositories.entryData.saveDrafts(draftBySection) }, [draftBySection, repositories])
  useEffect(() => { void repositories.entryData.saveCellValues(cellValues) }, [cellValues, repositories])
  useEffect(() => { void repositories.tasks.saveTasks(allTasksList) }, [allTasksList, repositories])
  useEffect(() => { void repositories.tasks.saveResolvedTasks(resolvedTasks) }, [repositories, resolvedTasks])
  useEffect(() => { void repositories.entryData.saveStudentPatches(studentPatches) }, [repositories, studentPatches])
  useEffect(() => { void repositories.entryData.saveSchemeState(schemeByOffering) }, [repositories, schemeByOffering])
  useEffect(() => { void repositories.entryData.saveBlueprintState(ttBlueprintsByOffering) }, [repositories, ttBlueprintsByOffering])
  useEffect(() => { void repositories.locksAudit.saveLockAudit(lockAuditByTarget) }, [lockAuditByTarget, repositories])

  const supervisedOfferingIds = useMemo(() => new Set(assignedOfferings.map(o => o.offId)), [assignedOfferings])
  const supervisedMenteeIds = useMemo(() => new Set(assignedMentees.map(m => m.id)), [assignedMentees])
  const supervisedMenteeUsns = useMemo(() => new Set(assignedMentees.map(m => m.usn)), [assignedMentees])

  const roleTasks = useMemo(() => {
    const base = allTasksList.filter(t => t.assignedTo === role)
    if (role === 'HoD') return base
    if (role === 'Course Leader') return base.filter(t => supervisedOfferingIds.has(t.offeringId))
    const mentorScopedIds = new Set([...Array.from(supervisedMenteeIds), ...Array.from(supervisedMenteeIds).map(id => `mentee-${id}`)])
    return base.filter(t => mentorScopedIds.has(t.studentId) || supervisedMenteeUsns.has(t.studentUsn))
  }, [allTasksList, role, supervisedOfferingIds, supervisedMenteeIds, supervisedMenteeUsns])

  const pendingActionCount = roleTasks.filter(t => {
    if (resolvedTasks[t.id]) return false
    if (t.scheduleMeta?.mode !== 'scheduled') return true
    if (t.scheduleMeta.status === 'ended' || t.scheduleMeta.status === 'paused') return false
    const activationDate = normalizeDateISO(t.scheduleMeta.nextDueDateISO) ?? normalizeDateISO(t.dueDateISO)
    if (!activationDate) return true
    return activationDate <= toTodayISO()
  }).length
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

  // IMMEDIATELY apply the theme *before* rendering any components so child elements pick up the correct T colors
  applyThemePreset(themeMode)

  useEffect(() => {
    void repositories.sessionPreferences.saveTheme(themeMode)
  }, [repositories, themeMode])

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
    setPage(getHomePage(role))
    setOffering(null)
    setSelectedStudent(null)
    setSelectedOffering(null)
    setSelectedMentee(null)
    setHistoryProfile(null)
    setSelectedUnlockTaskId(null)
    setCourseInitialTab(undefined)
    setHistoryBackPage(null)
  }, [role])
  const handleBack = useCallback(() => {
    setOffering(null)
    setCourseInitialTab(undefined)
    setHistoryBackPage(null)
    setPage(getHomePage(role))
  }, [role])
  const handleOpenStudent = useCallback((s: Student, o?: Offering) => {
    setSelectedStudent(s)
    setSelectedOffering(o || null)
  }, [])
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
  const handleOpenAllStudents = useCallback(() => {
    setPage('students')
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
  const handleOpenQueueHistory = useCallback(() => setPage('queue-history'), [])
  const handleOpenUnlockReview = useCallback((taskId: string) => {
    setSelectedUnlockTaskId(taskId)
    setPage('unlock-review')
  }, [])

  const handleUpdateBlueprint = useCallback((offId: string, kind: TTKind, next: TermTestBlueprint) => {
    setTtBlueprintsByOffering(prev => ({
      ...prev,
      [offId]: {
        ...(prev[offId] ?? {
          tt1: seedBlueprintFromPaper('tt1', PAPER_MAP[(OFFERINGS.find(item => item.offId === offId)?.code ?? OFFERINGS[0].code)] || PAPER_MAP.default),
          tt2: seedBlueprintFromPaper('tt2', PAPER_MAP[(OFFERINGS.find(item => item.offId === offId)?.code ?? OFFERINGS[0].code)] || PAPER_MAP.default),
        }),
        [kind]: normalizeBlueprint(kind, next),
      },
    }))
  }, [])

  const handleRoleChange = useCallback((r: Role) => {
    if (!allowedRoles.includes(r)) return
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
    setTaskComposer(prev => ({ ...prev, isOpen: false }))
    setPendingNoteAction(null)
  }, [allowedRoles])

  const handleSaveDraft = useCallback((offId: string, kind: EntryKind) => {
    setDraftBySection(prev => ({ ...prev, [`${offId}::${kind}`]: Date.now() }))
    setSchemeByOffering(prev => ({
      ...prev,
      [offId]: prev[offId] ? { ...prev[offId], status: prev[offId].status === 'Needs Setup' ? 'Configured' : prev[offId].status } : defaultSchemeForOffering(OFFERINGS.find(item => item.offId === offId) ?? OFFERINGS[0]),
    }))
  }, [])

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
  }, [])

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
    setResolvedTasks(prev => ({ ...prev, [id]: resolvedAt }))
    setAllTasksList(prev => {
      const target = prev.find(task => task.id === id)
      if (!target) return prev

      const updated = prev.map(task => {
        if (task.id !== id) return task
        const updatedTask: SharedTask = {
          ...task,
          status: 'Resolved',
          updatedAt: resolvedAt,
          resolvedByFacultyId: currentTeacherId ?? undefined,
          scheduleMeta: task.scheduleMeta?.mode === 'scheduled'
            ? {
              ...task.scheduleMeta,
              completedDatesISO: [...(task.scheduleMeta.completedDatesISO ?? []), ...(task.dueDateISO ? [task.dueDateISO] : [])],
            }
            : task.scheduleMeta,
          transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Resolved', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} marked this queue item as resolved.` })],
        }
        return updatedTask
      })

      if (target.scheduleMeta?.mode !== 'scheduled' || target.scheduleMeta.status === 'paused' || target.scheduleMeta.status === 'ended') return updated

      const nextDueDateISO = getNextScheduledDate(target.scheduleMeta, target.dueDateISO)
      if (!nextDueDateISO) return updated

      const nextTask: SharedTask = {
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

      return [...updated, nextTask]
    })
  }, [currentTeacherId, role])

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

  const handleEndSchedule = useCallback((taskId: string) => {
    setAllTasksList(prev => prev.map(task => {
      if (task.id !== taskId || task.scheduleMeta?.mode !== 'scheduled') return task
      return {
        ...task,
        updatedAt: Date.now(),
        scheduleMeta: { ...task.scheduleMeta, status: 'ended' },
        transitionHistory: [...(task.transitionHistory ?? []), createTransition({ action: 'Recurrence ended', actorRole: role, actorTeacherId: currentTeacherId ?? undefined, fromOwner: task.assignedTo, toOwner: task.assignedTo, note: `${role} ended recurrence for future occurrences.` })],
      }
    }))
  }, [currentTeacherId, role])

  const handleEditSchedule = useCallback((taskId: string) => {
    const nextDate = window.prompt('Set next occurrence date (YYYY-MM-DD)')
    const normalized = normalizeDateISO(nextDate ?? undefined)
    if (!normalized) return
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

  const handleUpdateStudentAttendance = useCallback((offeringId: string, studentId: string, patch: StudentRuntimePatch) => {
    commitStudentPatch(offeringId, studentId, existing => ({ ...existing, ...patch }))
  }, [commitStudentPatch])

  const handleOpenTaskComposer = useCallback((input?: { offeringId?: string; studentId?: string; taskType?: TaskType }) => {
    const fallbackOffering = (input?.offeringId ? OFFERINGS.find(item => item.offId === input.offeringId) : null) ?? uploadOffering ?? offering ?? assignedOfferings[0] ?? OFFERINGS[0]
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
      dueDateISO: suggested.dueDateISO,
      note: suggested.note,
      search: selectedStudent?.name ?? '',
    })
  }, [assignedOfferings, getStudentsPatched, offering, uploadOffering])

  const handleRequestUnlock = useCallback((offeringId: string, kind: EntryKind) => {
    setPendingNoteAction({ type: 'unlock-request', offeringId, kind })
  }, [])

  const handleCreateTask = useCallback((input: TaskCreateInput) => {
    const off = OFFERINGS.find(o => o.offId === input.offeringId)
    if (!off) return
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
    void repositories.tasks.upsertTask(next)
    setAllTasksList(prev => [next, ...prev])
  }, [currentTeacherId, getStudentsPatched, repositories, role])

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
    return <AppSelectorsContext.Provider value={selectors}><LoginPage onLogin={(teacherId) => {
      const account = FACULTY.find(faculty => faculty.facultyId === teacherId)
      if (!account) return
      setCurrentTeacherId(account.facultyId)
      const firstRole = account.allowedRoles[0]
      setRole(firstRole)
      setPage(getHomePage(firstRole))
      setOffering(null)
      setSelectedStudent(null)
      setSelectedMentee(null)
      setHistoryProfile(null)
      setHistoryBackPage(null)
      setCourseInitialTab(undefined)
    }} /></AppSelectorsContext.Provider>
  }

  const handleLogout = () => {
    setCurrentTeacherId(null)
    setRole('Course Leader')
    setPage('dashboard')
    setOffering(null)
    setSelectedStudent(null)
    setSelectedMentee(null)
    setHistoryProfile(null)
    setSelectedUnlockTaskId(null)
    setSchemeOfferingId(null)
    setCourseInitialTab(undefined)
    setHistoryBackPage(null)
    setTaskComposer(prev => ({ ...prev, isOpen: false }))
    setPendingNoteAction(null)
    setShowTopbarMenu(false)
  }

  const sidebarToggleLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const routeLoadingLabel = page === 'course'
    ? 'Loading course workspace...'
    : page === 'upload' || page === 'entry-workspace' || page === 'scheme-setup'
      ? 'Loading entry workflow...'
      : page === 'department'
        ? 'Loading department view...'
        : 'Loading workspace...'

  return (
    <AppSelectorsContext.Provider value={selectors}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg, color: T.text, overflowX: 'hidden' }}>
      {/* ═══ TOP BAR ═══ */}
      <div className={`top-bar-shell ${isCompactTopbar ? 'top-bar-shell--compact' : ''}`} style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', background: isLightTheme(themeMode) ? 'rgba(255,255,255,0.9)' : 'rgba(9,14,22,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
        {/* Brand */}
        <button aria-label="Go to dashboard" title="Go to dashboard" onClick={handleGoHome} className="top-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 13, color: '#fff' }}>AM</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 14, color: T.text }}>AirMentor</div>
            <div className="top-bar-greeting" style={{ ...mono, fontSize: 9, color: T.dim }}>AI Mentor Intelligence</div>
          </div>
        </button>

        {isCompactTopbar && (
          <button className="top-control-btn" aria-label={sidebarToggleLabel} title={sidebarToggleLabel} onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted }}>
            <motion.span animate={{ rotate: sidebarCollapsed ? 0 : 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <ChevronRight size={14} />
            </motion.span>
          </button>
        )}

        {/* Role Switcher */}
        <div className="top-bar-role-switcher" style={{ display: 'flex', gap: 0, marginLeft: 16, background: T.surface2, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>
          {allowedRoles.map(r => (
            <button key={r} onClick={() => handleRoleChange(r)}
              style={{ ...sora, fontWeight: 600, fontSize: 11, padding: isCompactTopbar ? '7px 12px' : '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: role === r ? T.accent : 'transparent', color: role === r ? '#fff' : T.muted, transition: 'all 0.15s', minHeight: isCompactTopbar ? 34 : undefined }}>
              {r}
            </button>
          ))}
        </div>

        <div className="top-bar-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <div className="top-bar-clock" style={{ ...mono, fontSize: 10, color: T.dim, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 9px', minHeight: 32, display: 'flex', alignItems: 'center', background: T.surface2 }}>
            {formattedCurrentTime}
          </div>

          <button className="top-control-btn" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={() => {
            setThemeMode(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')
          }} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted }}>{isLightTheme(themeMode) ? '🌙' : '☀️'}</button>

          <button className="top-control-btn" aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'} title={showActionQueue ? 'Hide action queue' : 'Show action queue'} onClick={() => setShowActionQueue(v => !v)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, position: 'relative' }}>
            <Bell size={14} />
            {pendingActionCount > 0 && <div style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pendingActionCount}</div>}
          </button>

          {isCompactTopbar && (
            <>
              <button className="top-control-btn" aria-label={showTopbarMenu ? 'Close more controls' : 'Open more controls'} title="More" onClick={() => setShowTopbarMenu(v => !v)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>More</button>
              {showTopbarMenu && (
                <div className="top-bar-more-menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 38, minWidth: 200, padding: 10, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, boxShadow: '0 10px 26px rgba(2,6,23,0.28)', display: 'grid', gap: 8, zIndex: 70 }}>
                  <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10, textAlign: 'left' }}>
                    Logout
                  </button>
                </div>
              )}
            </>
          )}

          {!isCompactTopbar && (
            <button className="top-control-btn" aria-label="Logout" title="Logout" onClick={handleLogout} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>
              Logout
            </button>
          )}
        </div>
      </div>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="app-main" style={{ display: 'flex', flex: 1, minWidth: 0, position: 'relative' }}>
        {!isCompactTopbar && (
          <motion.button
            type="button"
            className="sidebar-edge-toggle"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
            onClick={() => setSidebarCollapsed(c => !c)}
            animate={{ left: sidebarCollapsed ? 18 : 210 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ top: 18, background: T.surface, border: `1px solid ${T.border2}`, color: T.muted }}
          >
            <motion.span animate={{ rotate: sidebarCollapsed ? 0 : 180 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={15} />
            </motion.span>
          </motion.button>
        )}

        {/* Left Sidebar */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 210, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ background: T.surface, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 54, height: 'calc(100vh - 54px)', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', minWidth: 210 }}>
                {/* Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 10, color: '#fff', flexShrink: 0 }}>{PROFESSOR.initials}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ ...sora, fontWeight: 600, fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTeacher.name}</div>
                    <div style={{ ...mono, fontSize: 9, color: T.dim }}>{role}</div>
                  </div>
                </div>

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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Content */}
        <div className={`scroll-pane app-content app-content--${layoutMode}`} style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: 'calc(100vh - 54px)' }}>
          <Suspense fallback={<RouteLoadingFallback label={routeLoadingLabel} />}>
            {role === 'Course Leader' && page === 'dashboard' && <CLDashboard offerings={assignedOfferings} pendingTaskCount={pendingActionCount} onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} onOpenUpload={handleOpenUpload} onOpenAllStudents={handleOpenAllStudents} teacherInitials={currentTeacher.initials} greetingHeadline={greetingHeadline} greetingMeta={greetingMeta} />}
            {role === 'Course Leader' && page === 'students' && <LazyAllStudentsPage offerings={assignedOfferings} onOpenStudent={handleOpenStudent} onOpenHistory={handleOpenHistoryFromStudent} onOpenUpload={handleOpenUpload} />}
            {role === 'Course Leader' && page === 'course' && offering && <LazyCourseDetail key={`${offering.offId}-${courseInitialTab ?? 'overview'}`} offering={offering} scheme={schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)} lockMap={lockByOffering[offering.offId] ?? getEntryLockMap(offering)} blueprints={ttBlueprintsByOffering[offering.offId] ?? { tt1: seedBlueprintFromPaper('tt1', PAPER_MAP[offering.code] || PAPER_MAP.default), tt2: seedBlueprintFromPaper('tt2', PAPER_MAP[offering.code] || PAPER_MAP.default) }} onUpdateBlueprint={(kind, next) => handleUpdateBlueprint(offering.offId, kind, next)} onBack={handleBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} onOpenSchemeSetup={() => handleOpenSchemeSetup(offering)} initialTab={courseInitialTab} />}
            {role === 'Course Leader' && page === 'scheme-setup' && selectedSchemeOffering && <LazySchemeSetupPage role={role} offering={selectedSchemeOffering} scheme={schemeByOffering[selectedSchemeOffering.offId] ?? defaultSchemeForOffering(selectedSchemeOffering)} hasEntryStarted={hasEntryStartedForOffering(selectedSchemeOffering.offId)} onSave={(next) => handleSaveScheme(selectedSchemeOffering.offId, next)} onBack={() => setPage('upload')} />}
            {role === 'Course Leader' && page === 'calendar' && <CalendarPage />}
            {role === 'Course Leader' && page === 'upload' && <LazyUploadPage key={`${uploadOffering?.offId ?? 'default'}-${uploadKind}`} role={role} offering={uploadOffering} defaultKind={uploadKind} onOpenWorkspace={handleOpenWorkspace} lockByOffering={lockByOffering} onRequestUnlock={handleRequestUnlock} availableOfferings={assignedOfferings} onOpenSchemeSetup={handleOpenSchemeSetup} />}
            {role === 'Course Leader' && page === 'entry-workspace' && <LazyEntryWorkspacePage capabilities={capabilities} offeringId={entryOfferingId} kind={entryKind} onBack={() => setPage('upload')} lockByOffering={lockByOffering} draftBySection={draftBySection} onSaveDraft={handleSaveDraft} onSubmitLock={handleSubmitLock} onRequestUnlock={handleRequestUnlock} cellValues={cellValues} onCellValueChange={handleCellValueChange} onOpenStudent={handleOpenStudent} onOpenTaskComposer={handleOpenTaskComposer} onUpdateStudentAttendance={handleUpdateStudentAttendance} schemeByOffering={schemeByOffering} ttBlueprintsByOffering={ttBlueprintsByOffering} lockAuditByTarget={lockAuditByTarget} />}
            {role === 'Course Leader' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} />}

            {role === 'Mentor' && page === 'mentees' && <MentorView mentees={assignedMentees} onOpenMentee={handleOpenMentee} />}
            {role === 'Mentor' && page === 'mentee-detail' && selectedMentee && <MenteeDetailPage mentee={selectedMentee} tasks={roleTasks} onBack={() => setPage('mentees')} onOpenHistory={handleOpenHistoryFromMentee} />}
            {role === 'Mentor' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} />}
            {role === 'Mentor' && page === 'calendar' && <CalendarPage />}

            {role === 'HoD' && page === 'department' && <LazyHodView onOpenQueueHistory={handleOpenQueueHistory} onOpenCourse={handleOpenCourse} onOpenStudent={handleOpenStudent} tasks={allTasksList} />}
            {role === 'HoD' && page === 'course' && offering && <LazyCourseDetail key={`${offering.offId}-${courseInitialTab ?? 'overview'}`} offering={offering} scheme={schemeByOffering[offering.offId] ?? defaultSchemeForOffering(offering)} lockMap={lockByOffering[offering.offId] ?? getEntryLockMap(offering)} blueprints={ttBlueprintsByOffering[offering.offId] ?? { tt1: seedBlueprintFromPaper('tt1', PAPER_MAP[offering.code] || PAPER_MAP.default), tt2: seedBlueprintFromPaper('tt2', PAPER_MAP[offering.code] || PAPER_MAP.default) }} onUpdateBlueprint={(kind, next) => handleUpdateBlueprint(offering.offId, kind, next)} onBack={handleBack} onOpenStudent={s => handleOpenStudent(s, offering)} onOpenEntryHub={(kind) => handleOpenEntryHub(offering, kind)} onOpenSchemeSetup={() => handleOpenSchemeSetup(offering)} initialTab={courseInitialTab} />}
            {role === 'HoD' && page === 'unlock-review' && selectedUnlockTask && <UnlockReviewPage task={selectedUnlockTask} offering={OFFERINGS.find(item => item.offId === selectedUnlockTask.offeringId) ?? null} onBack={() => setPage('queue-history')} onApprove={() => handleApproveUnlock(selectedUnlockTask.id)} onReject={() => handleRejectUnlock(selectedUnlockTask.id)} onResetComplete={() => handleResetComplete(selectedUnlockTask.id)} />}
            {role === 'HoD' && page === 'queue-history' && <QueueHistoryPage role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onOpenTaskStudent={handleOpenTaskStudent} onOpenUnlockReview={handleOpenUnlockReview} />}
            {role === 'HoD' && page === 'calendar' && <CalendarPage />}

            {page === 'student-history' && historyProfile && <LazyStudentHistoryPage role={role} history={historyProfile} onBack={() => {
              const fallback = role === 'Mentor' && selectedMentee ? 'mentee-detail' : getHomePage(role)
              const target = historyBackPage && canAccessPage(role, historyBackPage) ? historyBackPage : fallback
              setPage(target)
              setHistoryBackPage(null)
            }} />}
          </Suspense>
        </div>

        {/* Right Sidebar — Action Queue */}
        <AnimatePresence>
          {showActionQueue && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 24 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <ActionQueue role={role} tasks={roleTasks} resolvedTaskIds={resolvedTasks} onResolveTask={handleResolveTask} onUndoTask={handleUndoTask} onOpenTaskComposer={handleOpenTaskComposer} onRemedialCheckIn={handleRemedialCheckIn} onOpenStudent={handleOpenTaskStudent} onReassignTask={handleReassignTask} onOpenUnlockReview={handleOpenUnlockReview} onOpenQueueHistory={handleOpenQueueHistory} onApproveUnlock={handleApproveUnlock} onRejectUnlock={handleRejectUnlock} onResetComplete={handleResetComplete} onToggleSchedulePause={handleToggleSchedulePause} onEndSchedule={handleEndSchedule} onEditSchedule={handleEditSchedule} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ STUDENT DRAWER ═══ */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDrawer student={selectedStudent} offering={selectedOffering || undefined} role={role} onClose={() => { setSelectedStudent(null); setSelectedOffering(null) }} onEscalate={handleOpenStudentEscalation} onOpenTaskComposer={(s, o, taskType) => {
            const resolvedOffering = o ?? OFFERINGS.find(item => getStudentsPatched(item).some(candidate => candidate.id === s.id))
            handleOpenTaskComposer({ offeringId: resolvedOffering?.offId, studentId: s.id, taskType })
          }} onAssignToMentor={handleOpenStudentMentorHandoff} onOpenHistory={handleOpenHistoryFromStudent} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {taskComposer.isOpen && (
          <TaskComposerModal role={role} offerings={role === 'HoD' ? OFFERINGS : (assignedOfferings.length > 0 ? assignedOfferings : OFFERINGS)} initialState={taskComposer} onClose={() => setTaskComposer(prev => ({ ...prev, isOpen: false }))} onSubmit={handleCreateTask} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingNoteAction && pendingNoteMeta && (
          <RequiredNoteModal title={pendingNoteMeta.title} description={pendingNoteMeta.description} submitLabel={pendingNoteMeta.submitLabel} onClose={() => setPendingNoteAction(null)} onSubmit={handleSubmitRequiredNote} />
        )}
      </AnimatePresence>

      <button
        aria-label="Hard reset development data"
        title="Hard reset"
        onClick={() => {
          if (!confirm('This will reset all saved changes and restore mock defaults. Continue?')) return
          void repositories.clearPersistedState()
          window.location.reload()
        }}
        style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 140, border: `1px solid ${T.danger}55`, background: '#ef44441a', color: T.danger, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', ...mono, fontSize: 10 }}
      >
        Reset Mock Data
      </button>
    </div>
    </AppSelectorsContext.Provider>
  )
}
