import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type FormEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import {
  ArrowLeft,
  BookOpen,
  Building2,
  GraduationCap,
  Layers3,
  RefreshCw,
  Search,
  Shield,
  UserCog,
  Users,
} from 'lucide-react'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS } from './repositories'
import {
  type AdminSearchResult,
  type AdminSectionId,
  type MockAdminState,
  createMockAdminState,
  deriveCurrentYearLabel,
  implementAdminRequest,
  listCurriculumBySemester,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  resolveFaculty,
  resolveFacultyMember,
  resolvePolicyForBatch,
  resolveStudent,
  searchAdminWorkspace,
  type WeekdayCode,
} from './system-admin-mock-data'
import { applyThemePreset, isLightTheme } from './theme'
import { Btn, Card, Chip, PageShell } from './ui-primitives'

type MockSession = {
  username: string
  displayName: string
}

type SystemAdminMockAppProps = {
  onExitPortal?: () => void
}

type AdminRoute = {
  section: AdminSectionId
  facultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

type PolicyFormState = {
  oMin: string
  aPlusMin: string
  aMin: string
  bPlusMin: string
  bMin: string
  cMin: string
  pMin: string
  ce: string
  see: string
  termTestsWeight: string
  quizWeight: string
  assignmentWeight: string
  maxQuizCount: string
  maxAssignmentCount: string
  dayStart: string
  dayEnd: string
  workingDays: WeekdayCode[]
  rounding: '2-decimal'
}

type BatchFormState = {
  label: string
  admissionYear: string
  activeSemester: string
  sectionLabels: string
}

type CourseFormState = {
  semesterNumber: string
  courseCode: string
  title: string
  credits: string
}

type FacultyFormState = {
  code: string
  name: string
  overview: string
}

type DepartmentFormState = {
  code: string
  name: string
}

type BranchFormState = {
  code: string
  name: string
  programLabel: string
  semesterCount: string
}

type FacultyMemberFormState = {
  name: string
  employeeCode: string
  primaryDepartmentId: string
  email: string
  phone: string
}

const MOCK_ADMIN_STORAGE_KEY = AIRMENTOR_STORAGE_KEYS.currentAdminFacultyId
const WEEKDAYS: WeekdayCode[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TOP_TABS: Array<{ id: AdminSectionId; label: string; icon: typeof Building2 }> = [
  { id: 'overview', label: 'Overview', icon: Layers3 },
  { id: 'faculties', label: 'Faculties', icon: Building2 },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'faculty-members', label: 'Faculty Members', icon: UserCog },
  { id: 'requests', label: 'Requests', icon: Shield },
]

function formatDateTime(value?: string) {
  if (!value) return 'Pending'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function persistThemeSnapshot(mode: ThemeMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, mode)
}

function persistMockSession(session: MockSession | null) {
  if (typeof window === 'undefined') return
  if (session) window.localStorage.setItem(MOCK_ADMIN_STORAGE_KEY, session.username)
  else window.localStorage.removeItem(MOCK_ADMIN_STORAGE_KEY)
}

function restoreMockSession() {
  if (typeof window === 'undefined') return null
  const username = window.localStorage.getItem(MOCK_ADMIN_STORAGE_KEY)
  if (!username) return null
  return {
    username,
    displayName: 'Mock System Admin',
  } satisfies MockSession
}

function parseAdminRoute(hash: string): AdminRoute {
  const cleaned = hash.replace(/^#\/admin/, '').replace(/^\/+/, '')
  if (!cleaned) return { section: 'overview' }

  const parts = cleaned.split('/').filter(Boolean)
  if (parts[0] === 'overview') return { section: 'overview' }
  if (parts[0] === 'students') return { section: 'students', studentId: parts[1] }
  if (parts[0] === 'faculty-members') return { section: 'faculty-members', facultyMemberId: parts[1] }
  if (parts[0] === 'requests') return { section: 'requests', requestId: parts[1] }
  if (parts[0] === 'faculties') {
    return {
      section: 'faculties',
      facultyId: parts[1],
      departmentId: parts[2] === 'departments' ? parts[3] : undefined,
      branchId: parts[4] === 'branches' ? parts[5] : undefined,
      batchId: parts[6] === 'batches' ? parts[7] : undefined,
    }
  }
  return { section: 'overview' }
}

function routeToHash(route: AdminRoute) {
  if (route.section === 'overview') return '#/admin/overview'
  if (route.section === 'students') return route.studentId ? `#/admin/students/${route.studentId}` : '#/admin/students'
  if (route.section === 'faculty-members') return route.facultyMemberId ? `#/admin/faculty-members/${route.facultyMemberId}` : '#/admin/faculty-members'
  if (route.section === 'requests') return route.requestId ? `#/admin/requests/${route.requestId}` : '#/admin/requests'
  if (route.section === 'faculties') {
    const segments = ['#/admin/faculties']
    if (route.facultyId) segments.push(route.facultyId)
    if (route.departmentId) segments.push('departments', route.departmentId)
    if (route.branchId) segments.push('branches', route.branchId)
    if (route.batchId) segments.push('batches', route.batchId)
    return segments.join('/')
  }
  return '#/admin/overview'
}

function navigate(route: AdminRoute) {
  window.location.hash = routeToHash(route)
}

function routeFromSearchResult(result: AdminSearchResult): AdminRoute {
  return parseAdminRoute(`#/admin${result.route}`)
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        ...mono,
        fontSize: 11,
        borderRadius: 10,
        border: `1px solid ${T.border2}`,
        background: T.surface2,
        color: T.text,
        padding: '10px 12px',
        ...(props.style ?? {}),
      }}
    />
  )
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        ...mono,
        fontSize: 11,
        borderRadius: 10,
        border: `1px solid ${T.border2}`,
        background: T.surface2,
        color: T.text,
        padding: '10px 12px',
        ...(props.style ?? {}),
      }}
    />
  )
}

function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        resize: 'vertical',
        ...mono,
        fontSize: 11,
        borderRadius: 10,
        border: `1px solid ${T.border2}`,
        background: T.surface2,
        color: T.text,
        padding: '10px 12px',
        ...(props.style ?? {}),
      }}
    />
  )
}

function InfoBanner({ tone, message }: { tone: 'success' | 'error' | 'neutral'; message: string }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}14`, borderRadius: 12, padding: '10px 12px' }}>
      {message}
    </div>
  )
}

function SectionHeading({ title, caption, eyebrow }: { title: string; caption: string; eyebrow?: string }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {eyebrow ? <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div> : null}
      <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted }}>{caption}</div>
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text, marginTop: 10 }}>{value}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{helper}</div>
    </Card>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 26, textAlign: 'center' }}>
      <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{body}</div>
    </Card>
  )
}

function SearchResultCard({ result, onSelect }: { result: AdminSearchResult; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${T.border}`,
        padding: '11px 12px',
        cursor: 'pointer',
      }}
    >
      <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{result.title}</div>
      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.subtitle}</div>
    </button>
  )
}

function buildPolicyForm(state: MockAdminState, batchId: string): PolicyFormState {
  const resolved = resolvePolicyForBatch(state, batchId)
  if (!resolved) {
    return {
      oMin: '90',
      aPlusMin: '75',
      aMin: '60',
      bPlusMin: '55',
      bMin: '50',
      cMin: '45',
      pMin: '40',
      ce: '60',
      see: '40',
      termTestsWeight: '30',
      quizWeight: '10',
      assignmentWeight: '20',
      maxQuizCount: '2',
      maxAssignmentCount: '2',
      dayStart: '08:30',
      dayEnd: '16:30',
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      rounding: '2-decimal',
    }
  }

  const byLabel = Object.fromEntries(resolved.effectivePolicy.gradingBands.map(item => [item.label, item.minScore]))
  return {
    oMin: String(byLabel.O ?? 90),
    aPlusMin: String(byLabel['A+'] ?? 75),
    aMin: String(byLabel.A ?? 60),
    bPlusMin: String(byLabel['B+'] ?? 55),
    bMin: String(byLabel.B ?? 50),
    cMin: String(byLabel.C ?? 45),
    pMin: String(byLabel.P ?? 40),
    ce: String(resolved.effectivePolicy.assessment.ce),
    see: String(resolved.effectivePolicy.assessment.see),
    termTestsWeight: String(resolved.effectivePolicy.assessment.termTestsWeight),
    quizWeight: String(resolved.effectivePolicy.assessment.quizWeight),
    assignmentWeight: String(resolved.effectivePolicy.assessment.assignmentWeight),
    maxQuizCount: String(resolved.effectivePolicy.assessment.maxQuizCount),
    maxAssignmentCount: String(resolved.effectivePolicy.assessment.maxAssignmentCount),
    dayStart: resolved.effectivePolicy.schedule.dayStart,
    dayEnd: resolved.effectivePolicy.schedule.dayEnd,
    workingDays: resolved.effectivePolicy.schedule.workingDays,
    rounding: resolved.effectivePolicy.calculation.rounding,
  }
}

export function SystemAdminMockApp({ onExitPortal }: SystemAdminMockAppProps = {}) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return normalizeThemeMode(null)
    return normalizeThemeMode(window.localStorage.getItem(AIRMENTOR_STORAGE_KEYS.themeMode))
  })
  const [session, setSession] = useState<MockSession | null>(() => restoreMockSession())
  const [route, setRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.hash || '#/admin/overview'))
  const [data, setData] = useState<MockAdminState>(() => createMockAdminState())
  const [searchQuery, setSearchQuery] = useState('')
  const [flashMessage, setFlashMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loginIdentifier, setLoginIdentifier] = useState('sysadmin')
  const [loginPassword, setLoginPassword] = useState('')
  const [requestNote, setRequestNote] = useState('Implemented according to HoD instruction.')
  const [facultyForm, setFacultyForm] = useState<FacultyFormState>({ code: '', name: '', overview: '' })
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>({ code: '', name: '' })
  const [branchForm, setBranchForm] = useState<BranchFormState>({ code: '', name: '', programLabel: 'B.Tech', semesterCount: '8' })
  const [batchForm, setBatchForm] = useState<BatchFormState>({ label: '', admissionYear: '2026', activeSemester: '1', sectionLabels: 'A' })
  const [courseForm, setCourseForm] = useState<CourseFormState>({ semesterNumber: '1', courseCode: '', title: '', credits: '4' })
  const [facultyMemberForm, setFacultyMemberForm] = useState<FacultyMemberFormState>({ name: '', employeeCode: '', primaryDepartmentId: '', email: '', phone: '' })
  const [studentsQuery, setStudentsQuery] = useState('')
  const [facultyMembersQuery, setFacultyMembersQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  applyThemePreset(themeMode)

  useEffect(() => {
    const onHashChange = () => setRoute(parseAdminRoute(window.location.hash || '#/admin/overview'))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!flashMessage) return
    const timeout = window.setTimeout(() => setFlashMessage(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [flashMessage])

  useEffect(() => {
    if (!route.batchId) return
    setCourseForm(current => ({ ...current, semesterNumber: current.semesterNumber || '1' }))
  }, [route.batchId])

  const faculty = route.facultyId ? resolveFaculty(data, route.facultyId) : null
  const department = route.departmentId ? resolveDepartment(data, route.departmentId) : null
  const branch = route.branchId ? resolveBranch(data, route.branchId) : null
  const batch = route.batchId ? resolveBatch(data, route.batchId) : null
  const student = route.studentId ? resolveStudent(data, route.studentId) : null
  const facultyMember = route.facultyMemberId ? resolveFacultyMember(data, route.facultyMemberId) : null
  const request = route.requestId ? data.requests.find(item => item.id === route.requestId) ?? null : null

  const policyForm = useMemo(() => route.batchId ? buildPolicyForm(data, route.batchId) : null, [data, route.batchId])

  const searchResults = useMemo(() => searchAdminWorkspace(data, deferredSearch), [data, deferredSearch])
  const filteredStudents = useMemo(() => {
    const query = normalizeSearch(studentsQuery)
    if (!query) return data.students
    return data.students.filter(item => `${item.name} ${item.universityId} ${item.email}`.toLowerCase().includes(query))
  }, [data.students, studentsQuery])
  const filteredFacultyMembers = useMemo(() => {
    const query = normalizeSearch(facultyMembersQuery)
    if (!query) return data.facultyMembers
    return data.facultyMembers.filter(item => `${item.name} ${item.employeeCode} ${item.email}`.toLowerCase().includes(query))
  }, [data.facultyMembers, facultyMembersQuery])

  async function handleThemeChange(nextMode: ThemeMode) {
    setThemeMode(nextMode)
    persistThemeSnapshot(nextMode)
  }

  function handleMockLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loginPassword !== '1234') {
      setErrorMessage('Invalid mock admin password. Use 1234.')
      return
    }
    const nextSession = { username: loginIdentifier.trim() || 'sysadmin', displayName: 'Mock System Admin' } satisfies MockSession
    setSession(nextSession)
    persistMockSession(nextSession)
    setErrorMessage('')
    setFlashMessage(`Signed in as ${nextSession.username}`)
  }

  function handleLogout() {
    setSession(null)
    persistMockSession(null)
    setLoginPassword('')
    setFlashMessage('Mock admin session cleared.')
  }

  function handleResetMockData() {
    setData(createMockAdminState())
    setFlashMessage('Mock data reset.')
  }

  function handleSearchSelection(result: AdminSearchResult) {
    setSearchQuery('')
    startTransition(() => navigate(routeFromSearchResult(result)))
  }

  function handleSavePolicy(form: PolicyFormState) {
    if (!route.batchId) return
    setData(current => ({
      ...current,
      batches: current.batches.map(item => item.id === route.batchId ? {
        ...item,
        policyOverride: {
          gradingBands: [
            { label: 'O', minScore: Number(form.oMin), gradePoint: 10 },
            { label: 'A+', minScore: Number(form.aPlusMin), gradePoint: 9 },
            { label: 'A', minScore: Number(form.aMin), gradePoint: 8 },
            { label: 'B+', minScore: Number(form.bPlusMin), gradePoint: 7 },
            { label: 'B', minScore: Number(form.bMin), gradePoint: 6 },
            { label: 'C', minScore: Number(form.cMin), gradePoint: 5 },
            { label: 'P', minScore: Number(form.pMin), gradePoint: 4 },
            { label: 'F', minScore: 0, gradePoint: 0 },
          ],
          assessment: {
            ce: Number(form.ce),
            see: Number(form.see),
            termTestsWeight: Number(form.termTestsWeight),
            quizWeight: Number(form.quizWeight),
            assignmentWeight: Number(form.assignmentWeight),
            maxQuizCount: Number(form.maxQuizCount),
            maxAssignmentCount: Number(form.maxAssignmentCount),
          },
          schedule: {
            workingDays: form.workingDays,
            dayStart: form.dayStart,
            dayEnd: form.dayEnd,
          },
          calculation: {
            rounding: form.rounding,
          },
        },
      } : item),
    }))
    setFlashMessage('Batch policy saved.')
  }

  function handleAddFaculty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = `fac-${facultyForm.code.trim().toLowerCase()}`
    setData(current => ({
      ...current,
      faculties: [...current.faculties, {
        id,
        code: facultyForm.code.trim().toUpperCase(),
        name: facultyForm.name.trim(),
        overview: facultyForm.overview.trim(),
      }],
    }))
    setFacultyForm({ code: '', name: '', overview: '' })
    setFlashMessage('Academic faculty added.')
  }

  function handleAddDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const facultyId = route.facultyId
    if (!facultyId) return
    const id = `dept-${departmentForm.code.trim().toLowerCase()}`
    setData(current => ({
      ...current,
      departments: [...current.departments, {
        id,
        facultyId,
        code: departmentForm.code.trim().toUpperCase(),
        name: departmentForm.name.trim(),
      }],
    }))
    setDepartmentForm({ code: '', name: '' })
    setFlashMessage('Department added.')
  }

  function handleAddBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const departmentId = route.departmentId
    if (!departmentId) return
    const id = `branch-${branchForm.code.trim().toLowerCase()}`
    setData(current => ({
      ...current,
      branches: [...current.branches, {
        id,
        departmentId,
        code: branchForm.code.trim().toUpperCase(),
        name: branchForm.name.trim(),
        programLabel: branchForm.programLabel.trim(),
        semesterCount: Number(branchForm.semesterCount),
      }],
    }))
    setBranchForm({ code: '', name: '', programLabel: 'B.Tech', semesterCount: '8' })
    setFlashMessage('Branch added.')
  }

  function handleAddBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const branchId = route.branchId
    if (!branchId) return
    const label = batchForm.label.trim()
    const id = `batch-${branchId}-${label}`
    setData(current => ({
      ...current,
      batches: [...current.batches, {
        id,
        branchId,
        label,
        admissionYear: Number(batchForm.admissionYear),
        activeSemester: Number(batchForm.activeSemester),
        sectionLabels: batchForm.sectionLabels.split(',').map(item => item.trim()).filter(Boolean),
      }],
    }))
    setBatchForm({ label: '', admissionYear: '2026', activeSemester: '1', sectionLabels: 'A' })
    setFlashMessage('Batch added.')
  }

  function handleAddCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const batchId = route.batchId
    if (!batchId) return
    const id = `${batchId}-${courseForm.semesterNumber}-${courseForm.courseCode.trim().toLowerCase()}`
    setData(current => ({
      ...current,
      curriculumCourses: [...current.curriculumCourses, {
        id,
        batchId,
        semesterNumber: Number(courseForm.semesterNumber),
        courseCode: courseForm.courseCode.trim().toUpperCase(),
        title: courseForm.title.trim(),
        credits: Number(courseForm.credits),
      }],
    }))
    setCourseForm({ semesterNumber: String(resolveBatch(data, batchId)?.activeSemester ?? 1), courseCode: '', title: '', credits: '4' })
    setFlashMessage('Course added to curriculum.')
  }

  function handleAddFacultyMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = `fm-${facultyMemberForm.employeeCode.trim().toLowerCase()}`
    setData(current => ({
      ...current,
      facultyMembers: [...current.facultyMembers, {
        id,
        employeeCode: facultyMemberForm.employeeCode.trim().toUpperCase(),
        name: facultyMemberForm.name.trim(),
        permissions: ['Mentor'],
        primaryDepartmentId: facultyMemberForm.primaryDepartmentId,
        email: facultyMemberForm.email.trim(),
        phone: facultyMemberForm.phone.trim(),
        teachingAssignments: [],
        scheduleExceptions: [],
        mentorStudentIds: [],
      }],
    }))
    setFacultyMemberForm({ name: '', employeeCode: '', primaryDepartmentId: facultyMemberForm.primaryDepartmentId, email: '', phone: '' })
    setFlashMessage('Faculty member added.')
  }

  function handleImplementRequest() {
    if (!request) return
    setData(current => implementAdminRequest(current, request.id, requestNote))
    setFlashMessage('Request implemented.')
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${T.accent}22, transparent 26%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), ${T.bg}`, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ width: '100%', maxWidth: 520, padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>System Admin Mock Mode</div>
              <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 8 }}>Search-first control plane</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10 }}>
                Mock data is enabled so we can validate the faculty hierarchy, student records, faculty-member assignments, and HoD-driven admin requests without a backend dependency.
              </div>
            </div>
            <button
              type="button"
              aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={() => void handleThemeChange(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')}
              style={{ ...mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
            >
              {isLightTheme(themeMode) ? 'Dark' : 'Light'}
            </button>
          </div>
          <form onSubmit={handleMockLogin} style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            <div>
              <FieldLabel>Username</FieldLabel>
              <TextInput value={loginIdentifier} onChange={event => setLoginIdentifier(event.target.value)} placeholder="sysadmin" />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <TextInput type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="1234" />
            </div>
            {errorMessage ? <InfoBanner tone="error" message={errorMessage} /> : <InfoBanner tone="neutral" message="Use password 1234 to enter mock admin mode." />}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Mode: mock data</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Back</Btn> : null}
                <Btn type="submit">Sign In</Btn>
              </div>
            </div>
          </form>
        </Card>
      </div>
    )
  }

  const selectedPolicy = policyForm
  const resolvedPolicy = route.batchId ? resolvePolicyForBatch(data, route.batchId) : null
  const batchSemesters = route.batchId ? listCurriculumBySemester(data, route.batchId) : []
  const currentFacultyDepartmentCount = faculty ? data.departments.filter(item => item.facultyId === faculty.id).length : 0
  const currentDepartmentBranchCount = department ? data.branches.filter(item => item.departmentId === department.id).length : 0
  const currentBranchBatches = branch ? data.batches.filter(item => item.branchId === branch.id) : []
  const totalStudents = data.students.length
  const totalFacultyMembers = data.facultyMembers.length
  const totalOpenRequests = data.requests.filter(item => item.status !== 'Implemented').length

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)', background: isLightTheme(themeMode) ? 'rgba(247,251,255,0.88)' : 'rgba(10,16,24,0.88)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', ...sora, fontWeight: 800 }}>AM</div>
              <div>
                <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Mock Control Plane</div>
                <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>{data.institution.name}</div>
              </div>
              <Chip color={T.warning}>Mock Data</Chip>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>{session.username} · {session.displayName}</div>
              <button
                type="button"
                aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'}
                onClick={() => void handleThemeChange(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')}
                style={{ ...mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
              >
                {isLightTheme(themeMode) ? 'Dark' : 'Light'}
              </button>
              <Btn variant="ghost" onClick={handleResetMockData}>
                <RefreshCw size={14} />
                Reset Mock Data
              </Btn>
              <Btn variant="ghost" onClick={handleLogout}>Logout</Btn>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, border: `1px solid ${T.border2}`, background: T.surface, padding: '12px 14px' }}>
                <Search size={16} color={T.muted} />
                <input
                  aria-label="Global admin search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search program, batch, student, faculty member, course code..."
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.text, ...mono, fontSize: 12 }}
                />
              </div>
              {deferredSearch.trim() ? (
                <Card style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, padding: 0, overflow: 'hidden', zIndex: 30 }}>
                  {searchResults.length === 0 ? <div style={{ ...mono, fontSize: 11, color: T.muted, padding: '12px 14px' }}>No matching program, student, faculty member, or course.</div> : searchResults.map(result => (
                    <SearchResultCard key={`${result.kind}-${result.id}`} result={result} onSelect={() => handleSearchSelection(result)} />
                  ))}
                </Card>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TOP_TABS.map(item => {
                const Icon = item.icon
                const active = route.section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate({ section: item.id })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 999,
                      border: `1px solid ${active ? T.accent : T.border}`,
                      background: active ? `${T.accent}18` : 'transparent',
                      color: active ? T.text : T.muted,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      ...mono,
                      fontSize: 11,
                    }}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {errorMessage && session ? <InfoBanner tone="error" message={errorMessage} /> : null}

        {route.section === 'overview' && (
          <>
            <SectionHeading title="System Admin Dashboard" eyebrow="Main Dash" caption="Everything is managed from the main dashboard now. The old left navigation and separate setup panel are gone in favor of search, entry cards, and contextual drill-down." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <MetricCard label="Academic Faculties" value={String(data.faculties.length)} helper="Top-level colleges or schools" />
              <MetricCard label="Students" value={String(totalStudents)} helper="Searchable canonical student records" />
              <MetricCard label="Faculty Members" value={String(totalFacultyMembers)} helper="Staff permissions plus teaching ownership" />
              <MetricCard label="Open Requests" value={String(totalOpenRequests)} helper="HoD-issued changes awaiting implementation" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Faculties</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Configure academic faculty, departments, branches, batches, curriculum, and policy overrides from one drill-down flow.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'faculties' })}><Building2 size={14} /> Open Faculties</Btn></div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Students</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Track university ID, branch, batch, current semester, CGPA, mentor, and full academic history.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'students' })}><GraduationCap size={14} /> Open Students</Btn></div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Faculty Members</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Manage HoD, mentor, and course leader permissions alongside exact class assignments and timetable governance.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'faculty-members' })}><UserCog size={14} /> Open Faculty Members</Btn></div>
              </Card>
            </div>
            <Card style={{ padding: 18 }}>
              <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Recent HoD Requests</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {data.requests.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate({ section: 'requests', requestId: item.id })}
                    style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{item.summary}</div>
                      <Chip color={item.status === 'Implemented' ? T.success : T.warning}>{item.status}</Chip>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.type} · requested {formatDateTime(item.requestedAt)}</div>
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        {route.section === 'faculties' && (
          <>
            <SectionHeading title="Faculties" eyebrow="Hierarchy" caption="Drill from academic faculty to department, branch, and batch. Batch is the configuration point for curriculum and inherited evaluation policy." />
            <div style={{ display: 'grid', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>Academic Faculties</div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>This replaces the old setup menu and starts the hierarchy from colleges or schools like Engineering and Technology.</div>
                  </div>
                  {faculty ? <Btn variant="ghost" onClick={() => navigate({ section: 'faculties' })}><ArrowLeft size={14} /> Back To Faculties</Btn> : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
                  {data.faculties.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate({ section: 'faculties', facultyId: item.id })}
                      style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${faculty?.id === item.id ? T.accent : T.border}`, background: faculty?.id === item.id ? `${T.accent}18` : T.surface2, padding: '14px 16px', cursor: 'pointer' }}
                    >
                      <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>{item.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{item.overview}</div>
                    </button>
                  ))}
                </div>
                <form onSubmit={handleAddFaculty} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                  <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Academic Faculty</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1fr', gap: 10 }}>
                    <div>
                      <FieldLabel>Code</FieldLabel>
                      <TextInput value={facultyForm.code} onChange={event => setFacultyForm(current => ({ ...current, code: event.target.value }))} placeholder="FCA" />
                    </div>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <TextInput value={facultyForm.name} onChange={event => setFacultyForm(current => ({ ...current, name: event.target.value }))} placeholder="Computing and AI" />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Overview</FieldLabel>
                    <TextAreaInput rows={3} value={facultyForm.overview} onChange={event => setFacultyForm(current => ({ ...current, overview: event.target.value }))} placeholder="What this academic faculty covers..." />
                  </div>
                  <div><Btn type="submit">Add Academic Faculty</Btn></div>
                </form>
              </Card>

              {faculty ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <Card style={{ padding: 18 }}>
                    <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{faculty.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{currentFacultyDepartmentCount} departments configured inside this academic faculty.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, marginTop: 16 }}>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {data.departments.filter(item => item.facultyId === faculty.id).map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate({ section: 'faculties', facultyId: faculty.id, departmentId: item.id })}
                            style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${department?.id === item.id ? T.accent : T.border}`, background: department?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                          >
                            <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{item.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 5 }}>{item.code}</div>
                          </button>
                        ))}
                      </div>
                      <form onSubmit={handleAddDepartment} style={{ display: 'grid', gap: 10 }}>
                        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
                        <div>
                          <FieldLabel>Code</FieldLabel>
                          <TextInput value={departmentForm.code} onChange={event => setDepartmentForm(current => ({ ...current, code: event.target.value }))} placeholder="ISE" />
                        </div>
                        <div>
                          <FieldLabel>Name</FieldLabel>
                          <TextInput value={departmentForm.name} onChange={event => setDepartmentForm(current => ({ ...current, name: event.target.value }))} placeholder="Information Science and Engineering" />
                        </div>
                        <div><Btn type="submit">Add Department</Btn></div>
                      </form>
                    </div>
                  </Card>

                  {department ? (
                    <Card style={{ padding: 18 }}>
                      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{department.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{currentDepartmentBranchCount} branches managed under this department.</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, marginTop: 16 }}>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {data.branches.filter(item => item.departmentId === department.id).map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => navigate({ section: 'faculties', facultyId: faculty.id, departmentId: department.id, branchId: item.id })}
                              style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${branch?.id === item.id ? T.accent : T.border}`, background: branch?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                            >
                              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{item.name}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 5 }}>{item.code} · {item.programLabel} · {item.semesterCount} semesters</div>
                            </button>
                          ))}
                        </div>
                        <form onSubmit={handleAddBranch} style={{ display: 'grid', gap: 10 }}>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Branch</div>
                          <div>
                            <FieldLabel>Code</FieldLabel>
                            <TextInput value={branchForm.code} onChange={event => setBranchForm(current => ({ ...current, code: event.target.value }))} placeholder="DS" />
                          </div>
                          <div>
                            <FieldLabel>Name</FieldLabel>
                            <TextInput value={branchForm.name} onChange={event => setBranchForm(current => ({ ...current, name: event.target.value }))} placeholder="Data Science" />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <FieldLabel>Program</FieldLabel>
                              <TextInput value={branchForm.programLabel} onChange={event => setBranchForm(current => ({ ...current, programLabel: event.target.value }))} />
                            </div>
                            <div>
                              <FieldLabel>Semesters</FieldLabel>
                              <TextInput type="number" min="1" value={branchForm.semesterCount} onChange={event => setBranchForm(current => ({ ...current, semesterCount: event.target.value }))} />
                            </div>
                          </div>
                          <div><Btn type="submit">Add Branch</Btn></div>
                        </form>
                      </div>
                    </Card>
                  ) : null}

                  {branch ? (
                    <Card style={{ padding: 18 }}>
                      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{branch.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Configure exact batches because Batch 2022 and Batch 2021 can carry different evaluation criteria even within the same branch.</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, marginTop: 16 }}>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {currentBranchBatches.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => navigate({ section: 'faculties', facultyId: faculty.id, departmentId: department?.id, branchId: branch.id, batchId: item.id })}
                              style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${batch?.id === item.id ? T.accent : T.border}`, background: batch?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                            >
                              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Batch {item.label}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 5 }}>{deriveCurrentYearLabel(item.activeSemester)} · Active semester {item.activeSemester} · Sections {item.sectionLabels.join(', ')}</div>
                            </button>
                          ))}
                        </div>
                        <form onSubmit={handleAddBatch} style={{ display: 'grid', gap: 10 }}>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <FieldLabel>Batch</FieldLabel>
                              <TextInput value={batchForm.label} onChange={event => setBatchForm(current => ({ ...current, label: event.target.value }))} placeholder="2026" />
                            </div>
                            <div>
                              <FieldLabel>Admission Year</FieldLabel>
                              <TextInput type="number" value={batchForm.admissionYear} onChange={event => setBatchForm(current => ({ ...current, admissionYear: event.target.value }))} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <FieldLabel>Active Semester</FieldLabel>
                              <TextInput type="number" min="1" max="8" value={batchForm.activeSemester} onChange={event => setBatchForm(current => ({ ...current, activeSemester: event.target.value }))} />
                            </div>
                            <div>
                              <FieldLabel>Sections</FieldLabel>
                              <TextInput value={batchForm.sectionLabels} onChange={event => setBatchForm(current => ({ ...current, sectionLabels: event.target.value }))} placeholder="A, B" />
                            </div>
                          </div>
                          <div><Btn type="submit">Add Batch</Btn></div>
                        </form>
                      </div>
                    </Card>
                  ) : null}

                  {batch && selectedPolicy && resolvedPolicy ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <Card style={{ padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{branch?.code} Batch {batch.label}</div>
                            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{deriveCurrentYearLabel(batch.activeSemester)} · Active semester {batch.activeSemester} · Curriculum and policy overrides live here.</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Chip color={T.accent}>Inherited From {resolvedPolicy.faculty.name} / {resolvedPolicy.department.code} / {resolvedPolicy.branch.code}</Chip>
                          </div>
                        </div>
                        <BatchPolicyEditor initialValue={selectedPolicy} onSave={handleSavePolicy} />
                      </Card>

                      <Card style={{ padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Semester 1-8 Curriculum</div>
                            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>All course codes and exact credits are managed at the batch level so year-specific curricula can diverge safely.</div>
                          </div>
                          <Chip color={T.success}>{batchSemesters.reduce((total, item) => total + item.courses.length, 0)} courses</Chip>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                          {batchSemesters.map(item => (
                            <div key={item.semesterNumber} style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Semester {item.semesterNumber}</div>
                              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                                {item.courses.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>No courses yet.</div> : item.courses.map(course => (
                                  <div key={course.id} style={{ borderRadius: 10, background: T.surface, padding: '8px 10px' }}>
                                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{course.courseCode}</div>
                                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{course.title}</div>
                                    <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{course.credits} credits</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleAddCourse} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Curriculum Course</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 0.9fr 1.6fr 0.6fr', gap: 10 }}>
                            <div>
                              <FieldLabel>Semester</FieldLabel>
                              <TextInput type="number" min="1" max="8" value={courseForm.semesterNumber} onChange={event => setCourseForm(current => ({ ...current, semesterNumber: event.target.value }))} />
                            </div>
                            <div>
                              <FieldLabel>Course Code</FieldLabel>
                              <TextInput value={courseForm.courseCode} onChange={event => setCourseForm(current => ({ ...current, courseCode: event.target.value }))} placeholder="CS699" />
                            </div>
                            <div>
                              <FieldLabel>Title</FieldLabel>
                              <TextInput value={courseForm.title} onChange={event => setCourseForm(current => ({ ...current, title: event.target.value }))} placeholder="Special Topics in AI Governance" />
                            </div>
                            <div>
                              <FieldLabel>Credits</FieldLabel>
                              <TextInput type="number" min="1" value={courseForm.credits} onChange={event => setCourseForm(current => ({ ...current, credits: event.target.value }))} />
                            </div>
                          </div>
                          <div><Btn type="submit"><BookOpen size={14} /> Add Course</Btn></div>
                        </form>
                      </Card>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}

        {route.section === 'students' && (
          <>
            <SectionHeading title="Students" eyebrow="Records" caption="Search by university ID, mentor, branch, or student name. Each record includes the current CGPA and a linked academic history." />
            <Card style={{ padding: 18 }}>
              <FieldLabel>Search Students</FieldLabel>
              <TextInput value={studentsQuery} onChange={event => setStudentsQuery(event.target.value)} placeholder="University ID, student name, email" />
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {filteredStudents.map(item => {
                  const mentor = resolveFacultyMember(data, item.mentorFacultyMemberId)
                  const branchRecord = resolveBranch(data, item.branchId)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate({ section: 'students', studentId: item.id })}
                      style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${student?.id === item.id ? T.accent : T.border}`, background: student?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
                        <div>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{item.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.universityId}</div>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{branchRecord?.code} · Batch {resolveBatch(data, item.batchId)?.label} · Sem {item.activeSemester}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{item.programLabel}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>CGPA {item.cgpaCurrent.toFixed(2)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted }}>{mentor?.name ?? 'Unassigned mentor'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>

            {student ? (
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{student.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{student.universityId} · {student.programLabel} · Batch {resolveBatch(data, student.batchId)?.label} · Active sem {student.activeSemester}</div>
                  </div>
                  <Chip color={T.success}>CGPA {student.cgpaCurrent.toFixed(2)}</Chip>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{student.email}</span></div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Phone: <span style={{ color: T.text }}>{student.phone}</span></div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Mentor: <span style={{ color: T.text }}>{resolveFacultyMember(data, student.mentorFacultyMemberId)?.name ?? 'Unassigned'}</span></div>
                </div>
                <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
                  {student.history.map(term => (
                    <div key={term.termLabel} style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{term.termLabel}</div>
                        <Chip color={term.sgpa >= 8 ? T.success : T.warning}>SGPA {term.sgpa.toFixed(2)}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>Credits earned: {term.creditsEarned}</div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {term.courses.map(course => (
                          <div key={`${term.termLabel}-${course.courseCode}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, ...mono, fontSize: 10, color: T.muted }}>
                            <span>{course.courseCode} · {course.title}</span>
                            <span>{course.credits} cr · {course.grade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}

        {route.section === 'faculty-members' && (
          <>
            <SectionHeading title="Faculty Members" eyebrow="Assignments" caption="Permissions and teaching ownership are separate. Staff can hold multiple permissions while teaching exact class offerings across departments and years." />
            <Card style={{ padding: 18 }}>
              <FieldLabel>Search Faculty Members</FieldLabel>
              <TextInput value={facultyMembersQuery} onChange={event => setFacultyMembersQuery(event.target.value)} placeholder="Faculty member, employee code, or email" />
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {filteredFacultyMembers.map(item => {
                  const primaryDepartment = resolveDepartment(data, item.primaryDepartmentId)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.id })}
                      style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${facultyMember?.id === item.id ? T.accent : T.border}`, background: facultyMember?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{item.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'Unknown department'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {item.permissions.map(permission => <Chip key={`${item.id}-${permission}`} color={permission === 'HOD' ? T.warning : permission === 'Mentor' ? T.success : T.accent}>{permission}</Chip>)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <form onSubmit={handleAddFacultyMember} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Faculty Member</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: 10 }}>
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <TextInput value={facultyMemberForm.name} onChange={event => setFacultyMemberForm(current => ({ ...current, name: event.target.value }))} placeholder="Dr. Meera Joshi" />
                  </div>
                  <div>
                    <FieldLabel>Employee Code</FieldLabel>
                    <TextInput value={facultyMemberForm.employeeCode} onChange={event => setFacultyMemberForm(current => ({ ...current, employeeCode: event.target.value }))} placeholder="EMP-CSE-060" />
                  </div>
                  <div>
                    <FieldLabel>Primary Department</FieldLabel>
                    <SelectInput value={facultyMemberForm.primaryDepartmentId} onChange={event => setFacultyMemberForm(current => ({ ...current, primaryDepartmentId: event.target.value }))}>
                      <option value="">Select department</option>
                      {data.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <TextInput value={facultyMemberForm.email} onChange={event => setFacultyMemberForm(current => ({ ...current, email: event.target.value }))} placeholder="meera.joshi@msruas.ac.in" />
                  </div>
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    <TextInput value={facultyMemberForm.phone} onChange={event => setFacultyMemberForm(current => ({ ...current, phone: event.target.value }))} placeholder="+91 99860 00060" />
                  </div>
                </div>
                <div><Btn type="submit"><Users size={14} /> Add Faculty Member</Btn></div>
              </form>
            </Card>

            {facultyMember ? (
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{facultyMember.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{facultyMember.employeeCode} · Primary department {resolveDepartment(data, facultyMember.primaryDepartmentId)?.name ?? 'Unknown'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {facultyMember.permissions.map(permission => <Chip key={permission} color={permission === 'HOD' ? T.warning : permission === 'Mentor' ? T.success : T.accent}>{permission}</Chip>)}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{facultyMember.email}</span></div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Phone: <span style={{ color: T.text }}>{facultyMember.phone}</span></div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted }}>Mentor Load: <span style={{ color: T.text }}>{facultyMember.mentorStudentIds.length} students</span></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14, marginTop: 18 }}>
                  <div>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Assigned Classes</div>
                    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                      {facultyMember.teachingAssignments.map(item => {
                        const assignmentDepartment = resolveDepartment(data, item.departmentId)
                        const assignmentBatch = resolveBatch(data, item.batchId)
                        return (
                          <div key={item.id} style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>{item.courseCode} · {item.courseTitle}</div>
                              <Chip color={item.ownership === 'PRIMARY' ? T.success : T.warning}>{item.ownership}</Chip>
                            </div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                              {assignmentDepartment?.code} · Batch {assignmentBatch?.label} · Sem {item.semesterNumber} · Sec {item.section}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                              {item.weeklyPattern.map(slot => <Chip key={`${item.id}-${slot}`} color={T.accent}>{slot}</Chip>)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Weekly Schedule Changes</div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {facultyMember.scheduleExceptions.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>No weekly exceptions logged.</div> : facultyMember.scheduleExceptions.map(item => (
                          <div key={item.id} style={{ ...mono, fontSize: 10, color: T.muted, borderRadius: 10, background: T.surface, padding: '8px 10px' }}>
                            <div style={{ color: T.text }}>{item.weekLabel}</div>
                            <div style={{ marginTop: 4 }}>{item.summary}</div>
                            <div style={{ marginTop: 4, color: item.status === 'Applied' ? T.success : T.warning }}>{item.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Governance Rule</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 8 }}>
                        Faculty can shift their schedule for a week, but permanent timetable or mentor changes must come through HoD and then be implemented by sysadmin using the request queue.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        )}

        {route.section === 'requests' && (
          <>
            <SectionHeading title="Requests" eyebrow="HoD To Sysadmin" caption="Permanent timetable and mentor-assignment changes are raised by HoD. Sysadmin implements them and records the action; there is no reject path in this mock flow." />
            <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.requests.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate({ section: 'requests', requestId: item.id })}
                      style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${request?.id === item.id ? T.accent : T.border}`, background: request?.id === item.id ? `${T.accent}18` : T.surface2, padding: '12px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{item.summary}</div>
                        <Chip color={item.status === 'Implemented' ? T.success : T.warning}>{item.status}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.type} · {item.requestedBy}</div>
                    </button>
                  ))}
                </div>
              </Card>
              {request ? (
                <Card style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{request.summary}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{request.detail}</div>
                    </div>
                    <Chip color={request.status === 'Implemented' ? T.success : T.warning}>{request.status}</Chip>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Requested by: <span style={{ color: T.text }}>{request.requestedBy}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Requested at: <span style={{ color: T.text }}>{formatDateTime(request.requestedAt)}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Target faculty member: <span style={{ color: T.text }}>{resolveFacultyMember(data, request.targetFacultyMemberId)?.name ?? 'Unknown'}</span></div>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <FieldLabel>Implementation Note</FieldLabel>
                    <TextAreaInput rows={4} value={requestNote} onChange={event => setRequestNote(event.target.value)} placeholder="What changed during implementation?" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <Btn onClick={handleImplementRequest} disabled={request.status === 'Implemented'}>Implement Request</Btn>
                  </div>
                  {request.implementationNote ? (
                    <div style={{ marginTop: 14 }}>
                      <InfoBanner tone="success" message={`${request.implementationNote} · ${formatDateTime(request.implementedAt)}`} />
                    </div>
                  ) : null}
                </Card>
              ) : <EmptyState title="Select a request" body="Open a request on the left to inspect and implement it." />}
            </div>
          </>
        )}
      </PageShell>
    </div>
  )
}

function BatchPolicyEditor({
  initialValue,
  onSave,
}: {
  initialValue: PolicyFormState
  onSave: (next: PolicyFormState) => void
}) {
  const [form, setForm] = useState<PolicyFormState>(initialValue)

  useEffect(() => {
    setForm(initialValue)
  }, [initialValue])

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        onSave(form)
      }}
      style={{ display: 'grid', gap: 16, marginTop: 16 }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Subject-wise Grading Bands</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 10 }}>
          {[
            ['O', 'oMin'],
            ['A+', 'aPlusMin'],
            ['A', 'aMin'],
            ['B+', 'bPlusMin'],
            ['B', 'bMin'],
            ['C', 'cMin'],
            ['P', 'pMin'],
          ].map(([label, key]) => (
            <div key={label}>
              <FieldLabel>{label} Min</FieldLabel>
              <TextInput type="number" value={form[key as keyof PolicyFormState] as string} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>CE / SEE And Component Caps</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 10 }}>
          {[
            ['CE', 'ce'],
            ['SEE', 'see'],
            ['TT', 'termTestsWeight'],
            ['Quiz', 'quizWeight'],
            ['Asgn', 'assignmentWeight'],
            ['Max Quiz', 'maxQuizCount'],
            ['Max Asgn', 'maxAssignmentCount'],
          ].map(([label, key]) => (
            <div key={label}>
              <FieldLabel>{label}</FieldLabel>
              <TextInput type="number" value={form[key as keyof PolicyFormState] as string} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Working College Hours And Days</div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <FieldLabel>Day Start</FieldLabel>
            <TextInput type="time" value={form.dayStart} onChange={event => setForm(current => ({ ...current, dayStart: event.target.value }))} />
          </div>
          <div>
            <FieldLabel>Day End</FieldLabel>
            <TextInput type="time" value={form.dayEnd} onChange={event => setForm(current => ({ ...current, dayEnd: event.target.value }))} />
          </div>
          <div>
            <FieldLabel>Working Days</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WEEKDAYS.map(day => {
                const active = form.workingDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setForm(current => ({
                      ...current,
                      workingDays: active
                        ? current.workingDays.filter(item => item !== day)
                        : [...current.workingDays, day],
                    }))}
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${active ? T.accent : T.border}`,
                      background: active ? `${T.accent}18` : 'transparent',
                      color: active ? T.text : T.muted,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      ...mono,
                      fontSize: 11,
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>SGPA / CGPA Calculation</div>
        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Structured rule config only: credit-weighted SGPA and cumulative CGPA, latest attempt replaces repeated course, failed subjects excluded from earned credits, rounded to two decimals.</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ ...mono, fontSize: 10, color: T.dim }}>If a local override is not edited, the hierarchy falls back to branch, department, faculty, then institution defaults.</div>
        <Btn type="submit">Save Batch Policy</Btn>
      </div>
    </form>
  )
}
