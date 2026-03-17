import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  BookOpen,
  RefreshCw,
  Users,
} from 'lucide-react'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS } from './repositories'
import {
  type AdminSearchResult,
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
import {
  AdminTopBar,
  AuthFeature,
  DayToggle,
  EmptyState,
  EntityButton,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  MetricCard,
  SectionHeading,
  SelectInput,
  TextAreaInput,
  TextInput,
  formatDateTime,
  normalizeSearch,
  type AdminSectionId,
  type BreadcrumbSegment,
} from './system-admin-ui'
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
  return { username, displayName: 'Mock System Admin' } satisfies MockSession
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

function buildPolicyForm(state: MockAdminState, batchId: string): PolicyFormState {
  const resolved = resolvePolicyForBatch(state, batchId)
  if (!resolved) {
    return {
      oMin: '90', aPlusMin: '75', aMin: '60', bPlusMin: '55', bMin: '50', cMin: '45', pMin: '40',
      ce: '60', see: '40', termTestsWeight: '30', quizWeight: '10', assignmentWeight: '20',
      maxQuizCount: '2', maxAssignmentCount: '2', dayStart: '08:30', dayEnd: '16:30',
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], rounding: '2-decimal',
    }
  }
  const byLabel = Object.fromEntries(resolved.effectivePolicy.gradingBands.map(item => [item.label, item.minScore]))
  return {
    oMin: String(byLabel.O ?? 90), aPlusMin: String(byLabel['A+'] ?? 75), aMin: String(byLabel.A ?? 60),
    bPlusMin: String(byLabel['B+'] ?? 55), bMin: String(byLabel.B ?? 50), cMin: String(byLabel.C ?? 45),
    pMin: String(byLabel.P ?? 40),
    ce: String(resolved.effectivePolicy.assessment.ce), see: String(resolved.effectivePolicy.assessment.see),
    termTestsWeight: String(resolved.effectivePolicy.assessment.termTestsWeight),
    quizWeight: String(resolved.effectivePolicy.assessment.quizWeight),
    assignmentWeight: String(resolved.effectivePolicy.assessment.assignmentWeight),
    maxQuizCount: String(resolved.effectivePolicy.assessment.maxQuizCount),
    maxAssignmentCount: String(resolved.effectivePolicy.assessment.maxAssignmentCount),
    dayStart: resolved.effectivePolicy.schedule.dayStart, dayEnd: resolved.effectivePolicy.schedule.dayEnd,
    workingDays: resolved.effectivePolicy.schedule.workingDays, rounding: resolved.effectivePolicy.calculation.rounding,
  }
}

function BatchPolicyEditor({ initialValue, onSave }: { initialValue: PolicyFormState; onSave: (next: PolicyFormState) => void }) {
  const [form, setForm] = useState<PolicyFormState>(initialValue)
  useEffect(() => { setForm(initialValue) }, [initialValue])

  return (
    <form onSubmit={event => { event.preventDefault(); onSave(form) }} style={{ display: 'grid', gap: 16, marginTop: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Subject-wise Grading Bands</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 10 }}>
          {([['O', 'oMin'], ['A+', 'aPlusMin'], ['A', 'aMin'], ['B+', 'bPlusMin'], ['B', 'bMin'], ['C', 'cMin'], ['P', 'pMin']] as const).map(([label, key]) => (
            <div key={label}>
              <FieldLabel>{label} Min</FieldLabel>
              <TextInput type="number" value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>CE / SEE And Component Caps</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 10 }}>
          {([['CE', 'ce'], ['SEE', 'see'], ['TT', 'termTestsWeight'], ['Quiz', 'quizWeight'], ['Asgn', 'assignmentWeight'], ['Max Quiz', 'maxQuizCount'], ['Max Asgn', 'maxAssignmentCount']] as const).map(([label, key]) => (
            <div key={label}>
              <FieldLabel>{label}</FieldLabel>
              <TextInput type="number" value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Working College Hours And Days</div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr', gap: 12, alignItems: 'end' }}>
          <div><FieldLabel>Day Start</FieldLabel><TextInput type="time" value={form.dayStart} onChange={event => setForm(current => ({ ...current, dayStart: event.target.value }))} /></div>
          <div><FieldLabel>Day End</FieldLabel><TextInput type="time" value={form.dayEnd} onChange={event => setForm(current => ({ ...current, dayEnd: event.target.value }))} /></div>
          <div>
            <FieldLabel>Working Days</FieldLabel>
            <DayToggle days={WEEKDAYS} selected={form.workingDays} onChange={next => setForm(current => ({ ...current, workingDays: next as WeekdayCode[] }))} />
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

  function handleThemeToggle() {
    const next: ThemeMode = isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light'
    setThemeMode(next)
    persistThemeSnapshot(next)
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
            ce: Number(form.ce), see: Number(form.see), termTestsWeight: Number(form.termTestsWeight),
            quizWeight: Number(form.quizWeight), assignmentWeight: Number(form.assignmentWeight),
            maxQuizCount: Number(form.maxQuizCount), maxAssignmentCount: Number(form.maxAssignmentCount),
          },
          schedule: { workingDays: form.workingDays, dayStart: form.dayStart, dayEnd: form.dayEnd },
          calculation: { rounding: form.rounding },
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
      faculties: [...current.faculties, { id, code: facultyForm.code.trim().toUpperCase(), name: facultyForm.name.trim(), overview: facultyForm.overview.trim() }],
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
      departments: [...current.departments, { id, facultyId, code: departmentForm.code.trim().toUpperCase(), name: departmentForm.name.trim() }],
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
      branches: [...current.branches, { id, departmentId, code: branchForm.code.trim().toUpperCase(), name: branchForm.name.trim(), programLabel: branchForm.programLabel.trim(), semesterCount: Number(branchForm.semesterCount) }],
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
      batches: [...current.batches, { id, branchId, label, admissionYear: Number(batchForm.admissionYear), activeSemester: Number(batchForm.activeSemester), sectionLabels: batchForm.sectionLabels.split(',').map(item => item.trim()).filter(Boolean) }],
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
      curriculumCourses: [...current.curriculumCourses, { id, batchId, semesterNumber: Number(courseForm.semesterNumber), courseCode: courseForm.courseCode.trim().toUpperCase(), title: courseForm.title.trim(), credits: Number(courseForm.credits) }],
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
        id, employeeCode: facultyMemberForm.employeeCode.trim().toUpperCase(), name: facultyMemberForm.name.trim(),
        permissions: ['Mentor'], primaryDepartmentId: facultyMemberForm.primaryDepartmentId,
        email: facultyMemberForm.email.trim(), phone: facultyMemberForm.phone.trim(),
        teachingAssignments: [], scheduleExceptions: [], mentorStudentIds: [],
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

  // --- Breadcrumbs ---
  const breadcrumbs: BreadcrumbSegment[] = []
  if (route.section === 'overview') {
    breadcrumbs.push({ label: 'Overview' })
  } else if (route.section === 'faculties') {
    if (faculty) {
      breadcrumbs.push({ label: 'Faculties', onClick: () => navigate({ section: 'faculties' }) })
      if (department) {
        breadcrumbs.push({ label: faculty.name, onClick: () => navigate({ section: 'faculties', facultyId: faculty.id }) })
        if (branch) {
          breadcrumbs.push({ label: department.name, onClick: () => navigate({ section: 'faculties', facultyId: faculty.id, departmentId: department.id }) })
          if (batch) {
            breadcrumbs.push({ label: branch.name, onClick: () => navigate({ section: 'faculties', facultyId: faculty.id, departmentId: department.id, branchId: branch.id }) })
            breadcrumbs.push({ label: `Batch ${batch.label}` })
          } else {
            breadcrumbs.push({ label: branch.name })
          }
        } else {
          breadcrumbs.push({ label: department.name })
        }
      } else {
        breadcrumbs.push({ label: faculty.name })
      }
    } else {
      breadcrumbs.push({ label: 'Faculties' })
    }
  } else if (route.section === 'students') {
    breadcrumbs.push({ label: 'Students', onClick: () => navigate({ section: 'students' }) })
    if (student) breadcrumbs.push({ label: student.name })
  } else if (route.section === 'faculty-members') {
    breadcrumbs.push({ label: 'Faculty Members', onClick: () => navigate({ section: 'faculty-members' }) })
    if (facultyMember) breadcrumbs.push({ label: facultyMember.name })
  } else if (route.section === 'requests') {
    breadcrumbs.push({ label: 'Requests', onClick: () => navigate({ section: 'requests' }) })
    if (request) breadcrumbs.push({ label: request.summary })
  }

  // --- Login screen ---
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${T.accent}22, transparent 26%), radial-gradient(circle at bottom right, ${T.success}14, transparent 30%), ${T.bg}`, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PageShell size="wide" style={{ paddingTop: 40 }}>
          <div style={{ minHeight: 'calc(100vh - 80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
            <Card
              style={{
                padding: 28,
                background: `radial-gradient(circle at top left, ${T.accent}20, transparent 34%), radial-gradient(circle at bottom right, ${T.success}16, transparent 26%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
                display: 'grid',
                alignContent: 'space-between',
                minHeight: 520,
              }}
              glow={T.accent}
            >
              <div style={{ display: 'grid', gap: 18 }}>
                <HeroBadge color={T.accent}>System Admin Mock Mode</HeroBadge>
                <div>
                  <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>
                    Search-first academic control plane.
                  </div>
                  <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>
                    Mock data is enabled so we can validate the faculty hierarchy, student records, faculty-member assignments, and HoD-driven admin requests without a backend dependency.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <AuthFeature title="Hierarchy" body="Academic faculty, department, branch, and batch stay aligned so year-wise policy divergence is explicit instead of buried." color={T.accent} />
                  <AuthFeature title="Governance" body="CE/SEE limits, grade bands, working calendar, and calculation rules remain centrally controlled but overrideable at the right level." color={T.success} />
                  <AuthFeature title="Operations" body="Search, requests, and teaching ownership stay visible together so the sysadmin flow feels like one control plane." color={T.orange} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the teaching workspace? Return to the portal selector.</div>
                {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Portal Selector</Btn> : null}
              </div>
            </Card>

            <Card style={{ padding: 28, display: 'grid', alignContent: 'center', background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
              <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to enter mock admin mode.</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>
                Use password 1234 to enter mock admin mode. All state is in-memory and resets on reload.
              </div>
              <form onSubmit={handleMockLogin} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
                <div><FieldLabel>Username</FieldLabel><TextInput value={loginIdentifier} onChange={event => setLoginIdentifier(event.target.value)} placeholder="sysadmin" /></div>
                <div><FieldLabel>Password</FieldLabel><TextInput type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="1234" /></div>
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
        </PageShell>
      </div>
    )
  }

  // --- Computed data ---
  const selectedPolicy = policyForm
  const resolvedPolicy = route.batchId ? resolvePolicyForBatch(data, route.batchId) : null
  const batchSemesters = route.batchId ? listCurriculumBySemester(data, route.batchId) : []
  const totalStudents = data.students.length
  const totalFacultyMembers = data.facultyMembers.length
  const totalOpenRequests = data.requests.filter(item => item.status !== 'Implemented').length

  // --- Main workspace ---
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <AdminTopBar
        institutionName={data.institution.name}
        modeLabel="Mock Data"
        modeColor={T.warning}
        breadcrumbs={breadcrumbs}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={deferredSearch.trim() ? searchResults.map(result => ({
          key: `${result.kind}-${result.id}`,
          title: result.title,
          subtitle: result.subtitle,
          onSelect: () => handleSearchSelection(result),
        })) : []}
        onSearchSelect={() => setSearchQuery('')}
        activeSection={route.section}
        onSectionChange={section => navigate({ section })}
        themeMode={themeMode}
        onThemeToggle={handleThemeToggle}
        onGoHome={() => navigate({ section: 'overview' })}
        canNavigateBack={route.section !== 'overview'}
        onNavigateBack={() => navigate({ section: 'overview' })}
        extraActions={
          <>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>{session.username}</div>
            <Btn variant="ghost" onClick={handleResetMockData}><RefreshCw size={14} /> Reset Mock Data</Btn>
            <Btn variant="ghost" onClick={handleLogout}>Logout</Btn>
          </>
        }
      />

      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {errorMessage && session ? <InfoBanner tone="error" message={errorMessage} /> : null}

        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <>
            <SectionHeading title="System Admin Dashboard" eyebrow="Main Dash" caption="Everything is managed from the main dashboard now. The old left navigation and separate setup panel are gone in favor of search, entry cards, and contextual drill-down." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <MetricCard label="Academic Faculties" value={String(data.faculties.length)} helper="Top-level colleges or schools" onClick={() => navigate({ section: 'faculties' })} />
              <MetricCard label="Students" value={String(totalStudents)} helper="Searchable canonical student records" onClick={() => navigate({ section: 'students' })} />
              <MetricCard label="Faculty Members" value={String(totalFacultyMembers)} helper="Staff permissions plus teaching ownership" onClick={() => navigate({ section: 'faculty-members' })} />
              <MetricCard label="Open Requests" value={String(totalOpenRequests)} helper="HoD-issued changes awaiting implementation" onClick={() => navigate({ section: 'requests' })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Faculties</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Configure academic faculty, departments, branches, batches, curriculum, and policy overrides from one drill-down flow.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'faculties' })}>Open Faculties</Btn></div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Students</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Track university ID, branch, batch, current semester, CGPA, mentor, and full academic history.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'students' })}>Open Students</Btn></div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Faculty Members</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Manage HoD, mentor, and course leader permissions alongside exact class assignments and timetable governance.</div>
                <div style={{ marginTop: 16 }}><Btn onClick={() => navigate({ section: 'faculty-members' })}>Open Faculty Members</Btn></div>
              </Card>
            </div>
            {data.requests.length > 0 ? (
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>Recent HoD Requests</div>
                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  {data.requests.map(item => (
                    <EntityButton key={item.id} selected={false} onClick={() => navigate({ section: 'requests', requestId: item.id })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text }}>{item.summary}</div>
                        <Chip color={item.status === 'Implemented' ? T.success : T.warning}>{item.status}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.type} · requested {formatDateTime(item.requestedAt)}</div>
                    </EntityButton>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}

        {/* ========== FACULTIES (hierarchy drill-down with tree explorer) ========== */}
        {route.section === 'faculties' && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
            {/* --- Left: Tree Explorer --- */}
            <Card style={{ padding: 16, display: 'grid', gap: 8, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hierarchy</div>
              {data.faculties.map(fac => {
                const facDepts = data.departments.filter(d => d.facultyId === fac.id)
                const isExpanded = faculty?.id === fac.id
                return (
                  <div key={fac.id}>
                    <EntityButton selected={isExpanded && !department} onClick={() => navigate({ section: 'faculties', facultyId: fac.id })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{fac.name}</div>
                        <Chip color={T.dim}>{facDepts.length}</Chip>
                      </div>
                    </EntityButton>
                    {isExpanded && facDepts.map(dept => {
                      const deptBranches = data.branches.filter(b => b.departmentId === dept.id)
                      const isDeptExpanded = department?.id === dept.id
                      return (
                        <div key={dept.id} style={{ paddingLeft: 14 }}>
                          <EntityButton selected={isDeptExpanded && !branch} onClick={() => navigate({ section: 'faculties', facultyId: fac.id, departmentId: dept.id })} style={{ marginTop: 6 }}>
                            <div style={{ ...mono, fontSize: 11, color: T.text }}>{dept.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{dept.code} · {deptBranches.length} branches</div>
                          </EntityButton>
                          {isDeptExpanded && deptBranches.map(br => {
                            const brBatches = data.batches.filter(bt => bt.branchId === br.id)
                            const isBrExpanded = branch?.id === br.id
                            return (
                              <div key={br.id} style={{ paddingLeft: 14 }}>
                                <EntityButton selected={isBrExpanded && !batch} onClick={() => navigate({ section: 'faculties', facultyId: fac.id, departmentId: dept.id, branchId: br.id })} style={{ marginTop: 6 }}>
                                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{br.name}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{br.code} · {br.programLabel} · {brBatches.length} batches</div>
                                </EntityButton>
                                {isBrExpanded && brBatches.map(bt => (
                                  <div key={bt.id} style={{ paddingLeft: 14 }}>
                                    <EntityButton selected={batch?.id === bt.id} onClick={() => navigate({ section: 'faculties', facultyId: fac.id, departmentId: dept.id, branchId: br.id, batchId: bt.id })} style={{ marginTop: 6 }}>
                                      <div style={{ ...mono, fontSize: 11, color: T.text }}>Batch {bt.label}</div>
                                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{deriveCurrentYearLabel(bt.activeSemester)} · Sem {bt.activeSemester}</div>
                                    </EntityButton>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </Card>

            {/* --- Right: Entity Detail + Forms --- */}
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              {/* No selection state */}
              {!faculty && (
                <Card style={{ padding: 18 }}>
                  <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select a node in the tree, or create a new academic faculty to get started." />
                  <form onSubmit={handleAddFaculty} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Academic Faculty</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 1fr', gap: 10 }}>
                      <div><FieldLabel>Code</FieldLabel><TextInput value={facultyForm.code} onChange={event => setFacultyForm(c => ({ ...c, code: event.target.value }))} placeholder="FCA" /></div>
                      <div><FieldLabel>Name</FieldLabel><TextInput value={facultyForm.name} onChange={event => setFacultyForm(c => ({ ...c, name: event.target.value }))} placeholder="Computing and AI" /></div>
                    </div>
                    <div><FieldLabel>Overview</FieldLabel><TextAreaInput rows={3} value={facultyForm.overview} onChange={event => setFacultyForm(c => ({ ...c, overview: event.target.value }))} placeholder="What this academic faculty covers..." /></div>
                    <div><Btn type="submit">Add Academic Faculty</Btn></div>
                  </form>
                </Card>
              )}

              {/* Faculty selected */}
              {faculty && !department && (
                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{faculty.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{faculty.overview}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{data.departments.filter(d => d.facultyId === faculty.id).length} departments configured.</div>
                  <form onSubmit={handleAddDepartment} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
                    <div><FieldLabel>Code</FieldLabel><TextInput value={departmentForm.code} onChange={event => setDepartmentForm(c => ({ ...c, code: event.target.value }))} placeholder="ISE" /></div>
                    <div><FieldLabel>Name</FieldLabel><TextInput value={departmentForm.name} onChange={event => setDepartmentForm(c => ({ ...c, name: event.target.value }))} placeholder="Information Science and Engineering" /></div>
                    <div><Btn type="submit">Add Department</Btn></div>
                  </form>
                </Card>
              )}

              {/* Department selected */}
              {department && !branch && (
                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{department.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{department.code} · {data.branches.filter(b => b.departmentId === department.id).length} branches</div>
                  <form onSubmit={handleAddBranch} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Branch</div>
                    <div><FieldLabel>Code</FieldLabel><TextInput value={branchForm.code} onChange={event => setBranchForm(c => ({ ...c, code: event.target.value }))} placeholder="DS" /></div>
                    <div><FieldLabel>Name</FieldLabel><TextInput value={branchForm.name} onChange={event => setBranchForm(c => ({ ...c, name: event.target.value }))} placeholder="Data Science" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><FieldLabel>Program</FieldLabel><TextInput value={branchForm.programLabel} onChange={event => setBranchForm(c => ({ ...c, programLabel: event.target.value }))} /></div>
                      <div><FieldLabel>Semesters</FieldLabel><TextInput type="number" min="1" value={branchForm.semesterCount} onChange={event => setBranchForm(c => ({ ...c, semesterCount: event.target.value }))} /></div>
                    </div>
                    <div><Btn type="submit">Add Branch</Btn></div>
                  </form>
                </Card>
              )}

              {/* Branch selected (no batch) */}
              {branch && !batch && (
                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{branch.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{branch.code} · {branch.programLabel} · {branch.semesterCount} semesters</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>Configure exact batches because Batch 2022 and Batch 2021 can carry different evaluation criteria even within the same branch.</div>
                  <form onSubmit={handleAddBatch} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><FieldLabel>Batch</FieldLabel><TextInput value={batchForm.label} onChange={event => setBatchForm(c => ({ ...c, label: event.target.value }))} placeholder="2026" /></div>
                      <div><FieldLabel>Admission Year</FieldLabel><TextInput type="number" value={batchForm.admissionYear} onChange={event => setBatchForm(c => ({ ...c, admissionYear: event.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><FieldLabel>Active Semester</FieldLabel><TextInput type="number" min="1" max="8" value={batchForm.activeSemester} onChange={event => setBatchForm(c => ({ ...c, activeSemester: event.target.value }))} /></div>
                      <div><FieldLabel>Sections</FieldLabel><TextInput value={batchForm.sectionLabels} onChange={event => setBatchForm(c => ({ ...c, sectionLabels: event.target.value }))} placeholder="A, B" /></div>
                    </div>
                    <div><Btn type="submit">Add Batch</Btn></div>
                  </form>
                </Card>
              )}

              {/* Batch selected — policy + curriculum */}
              {batch && selectedPolicy && resolvedPolicy ? (
                <>
                  <Card style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{branch?.code} Batch {batch.label}</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{deriveCurrentYearLabel(batch.activeSemester)} · Active semester {batch.activeSemester} · Curriculum and policy overrides live here.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Chip color={T.accent}>Inherited From {resolvedPolicy.faculty.name} / {resolvedPolicy.department.code} / {resolvedPolicy.branch.code}</Chip>
                        <button type="button" onClick={() => navigate({ section: 'students' })} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}><Chip color={T.success}>{data.students.filter(s => s.batchId === batch.id).length} students</Chip></button>
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
                        <div><FieldLabel>Semester</FieldLabel><TextInput type="number" min="1" max="8" value={courseForm.semesterNumber} onChange={event => setCourseForm(c => ({ ...c, semesterNumber: event.target.value }))} /></div>
                        <div><FieldLabel>Course Code</FieldLabel><TextInput value={courseForm.courseCode} onChange={event => setCourseForm(c => ({ ...c, courseCode: event.target.value }))} placeholder="CS699" /></div>
                        <div><FieldLabel>Title</FieldLabel><TextInput value={courseForm.title} onChange={event => setCourseForm(c => ({ ...c, title: event.target.value }))} placeholder="Special Topics in AI Governance" /></div>
                        <div><FieldLabel>Credits</FieldLabel><TextInput type="number" min="1" value={courseForm.credits} onChange={event => setCourseForm(c => ({ ...c, credits: event.target.value }))} /></div>
                      </div>
                      <div><Btn type="submit"><BookOpen size={14} /> Add Course</Btn></div>
                    </form>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ========== STUDENTS ========== */}
        {route.section === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)', gap: 16 }}>
            <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading title="Students" eyebrow="Records" caption="Search by university ID, mentor, branch, or student name." />
              <TextInput value={studentsQuery} onChange={event => setStudentsQuery(event.target.value)} placeholder="University ID, student name, email" />
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredStudents.map(item => {
                  const mentor = resolveFacultyMember(data, item.mentorFacultyMemberId)
                  const branchRecord = resolveBranch(data, item.branchId)
                  return (
                    <EntityButton key={item.id} selected={student?.id === item.id} onClick={() => navigate({ section: 'students', studentId: item.id })}>
                      <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.universityId} · {branchRecord?.code} · Batch {resolveBatch(data, item.batchId)?.label} · Sem {item.activeSemester}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ ...mono, fontSize: 10, color: T.success }}>CGPA {item.cgpaCurrent.toFixed(2)}</span>
                        <span style={{ ...mono, fontSize: 10, color: T.muted }}>· {mentor?.name ?? 'Unassigned mentor'}</span>
                      </div>
                    </EntityButton>
                  )
                })}
              </div>
            </Card>

            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start' }}>
              {!student ? <EmptyState title="Select a student" body="Open a student on the left to see their full academic context and history." /> : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{student.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{student.universityId} · {student.programLabel} · Batch {resolveBatch(data, student.batchId)?.label} · Active sem {student.activeSemester}</div>
                    </div>
                    <Chip color={T.success}>CGPA {student.cgpaCurrent.toFixed(2)}</Chip>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{student.email}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Phone: <span style={{ color: T.text }}>{student.phone}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Mentor: <button type="button" onClick={() => { const m = resolveFacultyMember(data, student.mentorFacultyMemberId); if (m) navigate({ section: 'faculty-members', facultyMemberId: m.id }) }} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{resolveFacultyMember(data, student.mentorFacultyMemberId)?.name ?? 'Unassigned'}</button></div>
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Academic History</div>
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
                </>
              )}
            </Card>
          </div>
        )}

        {/* ========== FACULTY MEMBERS ========== */}
        {route.section === 'faculty-members' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)', gap: 16 }}>
            <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading title="Faculty Members" eyebrow="Assignments" caption="Permissions and teaching ownership are separate." />
              <TextInput value={facultyMembersQuery} onChange={event => setFacultyMembersQuery(event.target.value)} placeholder="Faculty member, employee code, or email" />
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredFacultyMembers.map(item => {
                  const primaryDepartment = resolveDepartment(data, item.primaryDepartmentId)
                  return (
                    <EntityButton key={item.id} selected={facultyMember?.id === item.id} onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.id })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No department'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {item.permissions.map(perm => <Chip key={`${item.id}-${perm}`} color={perm === 'HOD' ? T.warning : perm === 'Mentor' ? T.success : T.accent}>{perm}</Chip>)}
                        </div>
                      </div>
                    </EntityButton>
                  )
                })}
              </div>
              <form onSubmit={handleAddFacultyMember} style={{ display: 'grid', gap: 10, marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Add Faculty Member</div>
                <div><FieldLabel>Name</FieldLabel><TextInput value={facultyMemberForm.name} onChange={event => setFacultyMemberForm(c => ({ ...c, name: event.target.value }))} placeholder="Dr. Meera Joshi" /></div>
                <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyMemberForm.employeeCode} onChange={event => setFacultyMemberForm(c => ({ ...c, employeeCode: event.target.value }))} placeholder="EMP-CSE-060" /></div>
                <div>
                  <FieldLabel>Primary Department</FieldLabel>
                  <SelectInput value={facultyMemberForm.primaryDepartmentId} onChange={event => setFacultyMemberForm(c => ({ ...c, primaryDepartmentId: event.target.value }))}>
                    <option value="">Select department</option>
                    {data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </SelectInput>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><FieldLabel>Email</FieldLabel><TextInput value={facultyMemberForm.email} onChange={event => setFacultyMemberForm(c => ({ ...c, email: event.target.value }))} placeholder="meera.joshi@msruas.ac.in" /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyMemberForm.phone} onChange={event => setFacultyMemberForm(c => ({ ...c, phone: event.target.value }))} placeholder="+91 99860 00060" /></div>
                </div>
                <div><Btn type="submit"><Users size={14} /> Add Faculty Member</Btn></div>
              </form>
            </Card>

            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start' }}>
              {!facultyMember ? <EmptyState title="Select a faculty member" body="Open a faculty member on the left to inspect permissions and assigned classes." /> : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{facultyMember.name}</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{facultyMember.employeeCode} · {resolveDepartment(data, facultyMember.primaryDepartmentId)?.name ?? 'Unknown department'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {facultyMember.permissions.map(perm => <Chip key={perm} color={perm === 'HOD' ? T.warning : perm === 'Mentor' ? T.success : T.accent}>{perm}</Chip>)}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{facultyMember.email}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Phone: <span style={{ color: T.text }}>{facultyMember.phone}</span></div>
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Mentor load: <span style={{ color: T.text }}>{facultyMember.mentorStudentIds.length} students</span></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14, marginTop: 10 }}>
                    <div>
                      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Assigned Classes</div>
                      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                        {facultyMember.teachingAssignments.map(item => {
                          const assignmentDept = resolveDepartment(data, item.departmentId)
                          const assignmentBatch = resolveBatch(data, item.batchId)
                          return (
                            <div key={item.id} style={{ borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, padding: '12px 14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{item.courseCode} · {item.courseTitle}</div>
                                <Chip color={item.ownership === 'PRIMARY' ? T.success : T.warning}>{item.ownership}</Chip>
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{assignmentDept?.code} · Batch {assignmentBatch?.label} · Sem {item.semesterNumber} · Sec {item.section}</div>
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
                        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Schedule Exceptions</div>
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
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 8 }}>Faculty can shift their schedule for a week, but permanent timetable or mentor changes must come through HoD and then be implemented by sysadmin using the request queue.</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* ========== REQUESTS ========== */}
        {route.section === 'requests' && (
          <>
            <SectionHeading title="Requests" eyebrow="HoD To Sysadmin" caption="Permanent timetable and mentor-assignment changes are raised by HoD. Sysadmin implements them and records the action." />
            <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 14 }}>
              <Card style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.requests.map(item => (
                    <EntityButton key={item.id} selected={request?.id === item.id} onClick={() => navigate({ section: 'requests', requestId: item.id })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{item.summary}</div>
                        <Chip color={item.status === 'Implemented' ? T.success : T.warning}>{item.status}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.type} · {item.requestedBy}</div>
                    </EntityButton>
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
                    <div style={{ ...mono, fontSize: 11, color: T.muted }}>Target: <button type="button" onClick={() => navigate({ section: 'faculty-members', facultyMemberId: request.targetFacultyMemberId })} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{resolveFacultyMember(data, request.targetFacultyMemberId)?.name ?? 'Unknown'}</button></div>
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
