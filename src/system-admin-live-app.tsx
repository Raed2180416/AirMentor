import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Compass,
  GraduationCap,
  Layers3,
  RefreshCw,
  Search,
  Shield,
  UserCog,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAdminRequestSummary,
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
  ApiSessionResponse,
} from './api/types'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from './repositories'
import {
  deriveCurrentYearLabel,
  getPrimaryAppointmentDepartmentId,
  listBatchesForBranch,
  listBranchesForDepartment,
  listCurriculumBySemester,
  listDepartmentsForAcademicFaculty,
  listFacultyAssignments,
  listTermsForBatch,
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  resolveFacultyMember,
  resolveStudent,
  searchLiveAdminWorkspace,
  type LiveAdminDataset,
  type LiveAdminRoute,
} from './system-admin-live-data'
import { applyThemePreset } from './theme'
import { Btn, Card, Chip, PageShell } from './ui-primitives'

type SystemAdminLiveAppProps = {
  apiBaseUrl: string
  onExitPortal?: () => void
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
  maxTermTests: string
  maxQuizzes: string
  maxAssignments: string
  dayStart: string
  dayEnd: string
  workingDays: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
  repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
}

type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

const TOP_TABS: Array<{ id: LiveAdminRoute['section']; label: string; icon: typeof Building2 }> = [
  { id: 'overview', label: 'Overview', icon: Layers3 },
  { id: 'faculties', label: 'Faculties', icon: Building2 },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'faculty-members', label: 'Faculty Members', icon: UserCog },
  { id: 'requests', label: 'Requests', icon: Shield },
]

const EMPTY_DATA: LiveAdminDataset = {
  institution: null,
  academicFaculties: [],
  departments: [],
  branches: [],
  batches: [],
  terms: [],
  facultyMembers: [],
  students: [],
  courses: [],
  curriculumCourses: [],
  policyOverrides: [],
  offerings: [],
  ownerships: [],
  requests: [],
}

const WEEKDAYS: PolicyFormState['workingDays'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseAdminRoute(hash: string): LiveAdminRoute {
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
      academicFacultyId: parts[1],
      departmentId: parts[2] === 'departments' ? parts[3] : undefined,
      branchId: parts[4] === 'branches' ? parts[5] : undefined,
      batchId: parts[6] === 'batches' ? parts[7] : undefined,
    }
  }
  return { section: 'overview' }
}

function routeToHash(route: LiveAdminRoute) {
  if (route.section === 'overview') return '#/admin/overview'
  if (route.section === 'students') return route.studentId ? `#/admin/students/${route.studentId}` : '#/admin/students'
  if (route.section === 'faculty-members') return route.facultyMemberId ? `#/admin/faculty-members/${route.facultyMemberId}` : '#/admin/faculty-members'
  if (route.section === 'requests') return route.requestId ? `#/admin/requests/${route.requestId}` : '#/admin/requests'
  const segments = ['#/admin/faculties']
  if (route.academicFacultyId) segments.push(route.academicFacultyId)
  if (route.departmentId) segments.push('departments', route.departmentId)
  if (route.branchId) segments.push('branches', route.branchId)
  if (route.batchId) segments.push('batches', route.batchId)
  return segments.join('/')
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function defaultPolicyForm(): PolicyFormState {
  return {
    oMin: '90',
    aPlusMin: '80',
    aMin: '70',
    bPlusMin: '60',
    bMin: '55',
    cMin: '50',
    pMin: '40',
    ce: '50',
    see: '50',
    termTestsWeight: '20',
    quizWeight: '10',
    assignmentWeight: '20',
    maxTermTests: '2',
    maxQuizzes: '2',
    maxAssignments: '2',
    dayStart: '08:30',
    dayEnd: '16:30',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    repeatedCoursePolicy: 'latest-attempt',
  }
}

function hydratePolicyForm(policy: ApiResolvedBatchPolicy['effectivePolicy']): PolicyFormState {
  const lookup = Object.fromEntries(policy.gradeBands.map(item => [item.grade, item.minimumMark])) as Record<string, number>
  return {
    oMin: String(lookup.O ?? 90),
    aPlusMin: String(lookup['A+'] ?? 80),
    aMin: String(lookup.A ?? 70),
    bPlusMin: String(lookup['B+'] ?? 60),
    bMin: String(lookup.B ?? 55),
    cMin: String(lookup.C ?? 50),
    pMin: String(lookup.P ?? 40),
    ce: String(policy.ceSeeSplit.ce),
    see: String(policy.ceSeeSplit.see),
    termTestsWeight: String(policy.ceComponentCaps.termTestsWeight),
    quizWeight: String(policy.ceComponentCaps.quizWeight),
    assignmentWeight: String(policy.ceComponentCaps.assignmentWeight),
    maxTermTests: String(policy.ceComponentCaps.maxTermTests),
    maxQuizzes: String(policy.ceComponentCaps.maxQuizzes),
    maxAssignments: String(policy.ceComponentCaps.maxAssignments),
    dayStart: policy.workingCalendar.dayStart,
    dayEnd: policy.workingCalendar.dayEnd,
    workingDays: [...policy.workingCalendar.days],
    repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
  }
}

function buildPolicyPayload(form: PolicyFormState): ApiPolicyPayload {
  return {
    gradeBands: [
      { grade: 'O', minimumMark: Number(form.oMin), maximumMark: 100, gradePoint: 10 },
      { grade: 'A+', minimumMark: Number(form.aPlusMin), maximumMark: Math.max(Number(form.oMin) - 1, Number(form.aPlusMin)), gradePoint: 9 },
      { grade: 'A', minimumMark: Number(form.aMin), maximumMark: Math.max(Number(form.aPlusMin) - 1, Number(form.aMin)), gradePoint: 8 },
      { grade: 'B+', minimumMark: Number(form.bPlusMin), maximumMark: Math.max(Number(form.aMin) - 1, Number(form.bPlusMin)), gradePoint: 7 },
      { grade: 'B', minimumMark: Number(form.bMin), maximumMark: Math.max(Number(form.bPlusMin) - 1, Number(form.bMin)), gradePoint: 6 },
      { grade: 'C', minimumMark: Number(form.cMin), maximumMark: Math.max(Number(form.bMin) - 1, Number(form.cMin)), gradePoint: 5 },
      { grade: 'P', minimumMark: Number(form.pMin), maximumMark: Math.max(Number(form.cMin) - 1, Number(form.pMin)), gradePoint: 4 },
      { grade: 'F', minimumMark: 0, maximumMark: Math.max(Number(form.pMin) - 1, 0), gradePoint: 0 },
    ],
    ceSeeSplit: {
      ce: Number(form.ce),
      see: Number(form.see),
    },
    ceComponentCaps: {
      termTestsWeight: Number(form.termTestsWeight),
      quizWeight: Number(form.quizWeight),
      assignmentWeight: Number(form.assignmentWeight),
      maxTermTests: Number(form.maxTermTests),
      maxQuizzes: Number(form.maxQuizzes),
      maxAssignments: Number(form.maxAssignments),
    },
    workingCalendar: {
      days: form.workingDays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
    },
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted',
      cgpaModel: 'credit-weighted-cumulative',
      rounding: '2-decimal',
      includeFailedCredits: false,
      repeatedCoursePolicy: form.repeatedCoursePolicy,
    },
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof AirMentorApiError) return error.message
  if (error instanceof Error) return error.message
  return 'The request could not be completed.'
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ width: '100%', resize: 'vertical', ...mono, fontSize: 11, borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function InfoBanner({ tone = 'neutral', message }: { tone?: 'neutral' | 'error' | 'success'; message: string }) {
  const color = tone === 'error' ? T.danger : tone === 'success' ? T.success : T.accent
  return (
    <div style={{ ...mono, fontSize: 11, color, border: `1px solid ${color}40`, background: `${color}12`, borderRadius: 10, padding: '10px 12px' }}>
      {message}
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>{value}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{helper}</div>
    </Card>
  )
}

function SectionHeading({ title, eyebrow, caption }: { title: string; eyebrow: string; caption: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{eyebrow}</div>
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text, marginTop: 4 }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{caption}</div>
    </div>
  )
}

function HeroBadge({ children, color = T.accent }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, fontSize: 10, color, border: `1px solid ${color}30`, background: `${color}12`, borderRadius: 999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  )
}

function AuthFeature({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: `${color}10`, border: `1px solid ${color}22`, boxShadow: `0 18px 40px ${color}10` }}>
      <div style={{ ...mono, fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

export function SystemAdminLiveApp({ apiBaseUrl, onExitPortal }: SystemAdminLiveAppProps) {
  const apiClient = useMemo(() => new AirMentorApiClient(apiBaseUrl), [apiBaseUrl])
  const repositories = useMemo(() => createAirMentorRepositories({
    repositoryMode: 'http',
    apiClient,
  }), [apiClient])

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [booting, setBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [session, setSession] = useState<ApiSessionResponse | null>(null)
  const [data, setData] = useState<LiveAdminDataset>(EMPTY_DATA)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [flashMessage, setFlashMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [route, setRoute] = useState<LiveAdminRoute>(() => parseAdminRoute(typeof window === 'undefined' ? '' : window.location.hash))
  const [structureForms, setStructureForms] = useState<StructureFormState>({
    academicFaculty: { code: '', name: '', overview: '' },
    department: { code: '', name: '' },
    branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' },
    batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' },
    term: { academicYearLabel: '2026-27', semesterNumber: '1', startDate: '2026-08-01', endDate: '2026-12-15' },
    curriculum: { semesterNumber: '1', courseCode: '', title: '', credits: '4' },
  })
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(() => defaultPolicyForm())
  const [resolvedBatchPolicy, setResolvedBatchPolicy] = useState<ApiResolvedBatchPolicy | null>(null)
  const [requestBusy, setRequestBusy] = useState('')

  const deferredSearch = useDeferredValue(searchQuery)

  applyThemePreset(themeMode)

  const persistTheme = useCallback((nextMode: ThemeMode) => {
    setThemeMode(nextMode)
    if (typeof window !== 'undefined') window.localStorage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, nextMode)
  }, [])

  const navigate = useCallback((nextRoute: LiveAdminRoute) => {
    const nextHash = routeToHash(nextRoute)
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) window.location.hash = nextHash
    setRoute(nextRoute)
  }, [])

  const loadAdminData = useCallback(async () => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    setDataLoading(true)
    setDataError('')
    try {
      const safeInstitution = async () => {
        try {
          return await apiClient.getInstitution()
        } catch (error) {
          if (error instanceof AirMentorApiError && error.status === 404) return null
          throw error
        }
      }

      const [
        institution,
        academicFaculties,
        departments,
        branches,
        batches,
        terms,
        facultyMembers,
        students,
        courses,
        curriculumCourses,
        policyOverrides,
        offerings,
        ownerships,
        requests,
      ] = await Promise.all([
        safeInstitution(),
        apiClient.listAcademicFaculties(),
        apiClient.listDepartments(),
        apiClient.listBranches(),
        apiClient.listBatches(),
        apiClient.listTerms(),
        apiClient.listFaculty(),
        apiClient.listStudents(),
        apiClient.listCourses(),
        apiClient.listCurriculumCourses(),
        apiClient.listPolicyOverrides(),
        apiClient.listOfferings(),
        apiClient.listOfferingOwnership(),
        apiClient.listAdminRequests(),
      ])

      setData({
        institution,
        academicFaculties: academicFaculties.items,
        departments: departments.items,
        branches: branches.items,
        batches: batches.items,
        terms: terms.items,
        facultyMembers: facultyMembers.items,
        students: students.items,
        courses: courses.items,
        curriculumCourses: curriculumCourses.items,
        policyOverrides: policyOverrides.items,
        offerings: offerings.items,
        ownerships: ownerships.items,
        requests: requests.items,
      })
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
    let cancelled = false
    void (async () => {
      try {
        const restored = await apiClient.restoreSession()
        if (!cancelled) setSession(restored)
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    void loadAdminData()
  }, [loadAdminData, session])

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setResolvedBatchPolicy(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(route.batchId!)
        if (cancelled) return
        setResolvedBatchPolicy(next)
        setPolicyForm(hydratePolicyForm(next.effectivePolicy))
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient, route.batchId, session])

  useEffect(() => {
    if (!flashMessage) return undefined
    const timer = window.setTimeout(() => setFlashMessage(''), 2500)
    return () => window.clearTimeout(timer)
  }, [flashMessage])

  const systemAdminGrant = session?.availableRoleGrants.find(item => item.roleCode === 'SYSTEM_ADMIN') ?? null

  const selectedAcademicFaculty = resolveAcademicFaculty(data, route.academicFacultyId)
  const selectedDepartment = resolveDepartment(data, route.departmentId)
  const selectedBranch = resolveBranch(data, route.branchId)
  const selectedBatch = resolveBatch(data, route.batchId)
  const selectedStudent = resolveStudent(data, route.studentId)
  const selectedFacultyMember = resolveFacultyMember(data, route.facultyMemberId)
  const searchResults = useMemo(() => searchLiveAdminWorkspace(data, deferredSearch), [data, deferredSearch])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      const nextSession = await apiClient.login({ identifier, password })
      setSession(nextSession)
      setIdentifier('')
      setPassword('')
    } catch (error) {
      setAuthError(toErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    await apiClient.logout()
    setSession(null)
    setData(EMPTY_DATA)
  }

  const handleSwitchToSystemAdmin = async () => {
    if (!systemAdminGrant) return
    setAuthBusy(true)
    try {
      const next = await apiClient.switchRoleContext(systemAdminGrant.grantId)
      setSession(next)
    } catch (error) {
      setAuthError(toErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const runAction = async (runner: () => Promise<void>) => {
    setActionError('')
    try {
      await runner()
      await loadAdminData()
    } catch (error) {
      setActionError(toErrorMessage(error))
    }
  }

  const handleCreateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runAction(async () => {
      const created = await apiClient.createAcademicFaculty({
        code: structureForms.academicFaculty.code,
        name: structureForms.academicFaculty.name,
        overview: structureForms.academicFaculty.overview || null,
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, academicFaculty: { code: '', name: '', overview: '' } }))
      setFlashMessage('Academic faculty created.')
      navigate({ section: 'faculties', academicFacultyId: created.academicFacultyId })
    })
  }

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    await runAction(async () => {
      const created = await apiClient.createDepartment({
        academicFacultyId: selectedAcademicFaculty.academicFacultyId,
        code: structureForms.department.code,
        name: structureForms.department.name,
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, department: { code: '', name: '' } }))
      setFlashMessage('Department created.')
      navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: created.departmentId })
    })
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    await runAction(async () => {
      const created = await apiClient.createBranch({
        departmentId: selectedDepartment.departmentId,
        code: structureForms.branch.code,
        name: structureForms.branch.name,
        programLevel: structureForms.branch.programLevel,
        semesterCount: Number(structureForms.branch.semesterCount),
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' } }))
      setFlashMessage('Branch created.')
      navigate({
        section: 'faculties',
        academicFacultyId: selectedDepartment.academicFacultyId ?? undefined,
        departmentId: selectedDepartment.departmentId,
        branchId: created.branchId,
      })
    })
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    await runAction(async () => {
      const created = await apiClient.createBatch({
        branchId: selectedBranch.branchId,
        admissionYear: Number(structureForms.batch.admissionYear),
        batchLabel: structureForms.batch.batchLabel,
        currentSemester: Number(structureForms.batch.currentSemester),
        sectionLabels: structureForms.batch.sectionLabels.split(',').map(item => item.trim()).filter(Boolean),
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' } }))
      setFlashMessage('Batch created.')
      navigate({
        section: 'faculties',
        academicFacultyId: selectedDepartment?.academicFacultyId ?? undefined,
        departmentId: selectedDepartment?.departmentId,
        branchId: selectedBranch.branchId,
        batchId: created.batchId,
      })
    })
  }

  const handleCreateTerm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch || !selectedBatch) return
    await runAction(async () => {
      await apiClient.createTerm({
        branchId: selectedBranch.branchId,
        batchId: selectedBatch.batchId,
        academicYearLabel: structureForms.term.academicYearLabel,
        semesterNumber: Number(structureForms.term.semesterNumber),
        startDate: structureForms.term.startDate,
        endDate: structureForms.term.endDate,
        status: 'active',
      })
      setFlashMessage('Academic term created.')
    })
  }

  const handleCreateCurriculumCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBatch) return
    await runAction(async () => {
      const matchingCourse = data.courses.find(item => item.courseCode.toLowerCase() === structureForms.curriculum.courseCode.toLowerCase()) ?? null
      await apiClient.createCurriculumCourse({
        batchId: selectedBatch.batchId,
        semesterNumber: Number(structureForms.curriculum.semesterNumber),
        courseId: matchingCourse?.courseId ?? null,
        courseCode: structureForms.curriculum.courseCode,
        title: structureForms.curriculum.title,
        credits: Number(structureForms.curriculum.credits),
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, curriculum: { semesterNumber: prev.curriculum.semesterNumber, courseCode: '', title: '', credits: '4' } }))
      setFlashMessage('Curriculum course created.')
    })
  }

  const handleSaveBatchPolicy = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const existing = data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId) ?? null
      const payload = {
        scopeType: 'batch' as const,
        scopeId: selectedBatch.batchId,
        policy: buildPolicyPayload(policyForm),
        status: 'active',
      }
      if (existing) {
        await apiClient.updatePolicyOverride(existing.policyOverrideId, { ...payload, version: existing.version })
      } else {
        await apiClient.createPolicyOverride(payload)
      }
      setFlashMessage('Batch policy saved.')
      const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId)
      setResolvedBatchPolicy(nextResolved)
    })
  }

  const handleAdvanceRequest = async (request: ApiAdminRequestSummary) => {
    setRequestBusy(request.adminRequestId)
    try {
      if (request.status === 'New') {
        await apiClient.assignAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Claimed for review.' })
      } else if (request.status === 'In Review' || request.status === 'Needs Info') {
        await apiClient.approveAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Approved for implementation.' })
      } else if (request.status === 'Approved') {
        await apiClient.markAdminRequestImplemented(request.adminRequestId, { version: request.version, noteBody: 'Implemented from the sysadmin workspace.' })
      } else if (request.status === 'Implemented') {
        await apiClient.closeAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Closed after execution.' })
      }
      setFlashMessage('Request advanced.')
      await loadAdminData()
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestBusy('')
    }
  }

  if (booting) {
    return (
      <PageShell size="narrow" style={{ paddingTop: 48 }}>
        <Card><div style={{ ...mono, fontSize: 11, color: T.muted }}>Restoring system admin session…</div></Card>
      </PageShell>
    )
  }

  if (!session) {
    return (
      <PageShell size="wide" style={{ paddingTop: 40 }}>
        <div style={{ minHeight: 'calc(100vh - 80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
          <Card
            style={{
              padding: 28,
              background: `radial-gradient(circle at top left, ${T.accent}24, transparent 36%), radial-gradient(circle at bottom right, ${T.success}16, transparent 28%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
              display: 'grid',
              alignContent: 'space-between',
              minHeight: 520,
            }}
            glow={T.accent}
          >
            <div style={{ display: 'grid', gap: 18 }}>
              <HeroBadge><Compass size={12} /> System Admin Live Mode</HeroBadge>
              <div>
                <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>
                  Govern curriculum, policy, and year-specific control from one place.
                </div>
                <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>
                  This workspace is connected to the live backend at `{apiBaseUrl}`. Use it for academic faculties, branches, batches, policy overrides, requests, and the student or faculty records that depend on them.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <AuthFeature title="Hierarchy" body="Academic faculty, department, branch, and batch stay aligned so year-wise policy divergence is explicit instead of buried." color={T.accent} />
                <AuthFeature title="Governance" body="CE/SEE limits, grade bands, working calendar, and SGPA or CGPA rules remain centrally controlled but overrideable at the right level." color={T.success} />
                <AuthFeature title="Operations" body="Search, requests, and teaching ownership stay visible together so the sysadmin flow feels like one control plane instead of a setup dead-end." color={T.orange} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the teaching workspace instead? Return to the portal selector and sign in as faculty.</div>
              {onExitPortal ? (
                <Btn variant="ghost" onClick={onExitPortal}>
                  <ChevronLeft size={14} />
                  Portal Selector
                </Btn>
              ) : null}
            </div>
          </Card>

          <Card style={{ padding: 28, display: 'grid', alignContent: 'center', background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
            <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
            <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to manage the live hierarchy.</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>Use the seeded sysadmin account or your assigned live admin credentials. Session state and theme preferences are restored automatically after sign-in.</div>

            <form onSubmit={handleLogin} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              <div>
                <FieldLabel>Username Or Email</FieldLabel>
                <TextInput value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="sysadmin" />
              </div>
              <div>
                <FieldLabel>Password</FieldLabel>
                <TextInput type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" />
              </div>
              {authError ? <InfoBanner tone="error" message={authError} /> : null}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Back To Portal</Btn> : <span />}
                <Btn type="submit" disabled={authBusy}>{authBusy ? 'Signing In…' : 'Sign In'}</Btn>
              </div>
            </form>
          </Card>
        </div>
      </PageShell>
    )
  }

  if (session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
    return (
      <PageShell size="narrow" style={{ paddingTop: 48 }}>
        <Card style={{ padding: 28 }}>
          <div style={{ ...sora, fontSize: 22, fontWeight: 800, color: T.text }}>System admin role required</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>You are currently in `{session.activeRoleGrant.roleCode}` context. Switch to your system-admin grant to use the configuration workspace.</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            {systemAdminGrant ? <Btn onClick={handleSwitchToSystemAdmin} disabled={authBusy}>Switch To System Admin</Btn> : null}
            <Btn variant="ghost" onClick={handleLogout}>Log Out</Btn>
          </div>
        </Card>
      </PageShell>
    )
  }

  const facultyDepartments = listDepartmentsForAcademicFaculty(data, selectedAcademicFaculty?.academicFacultyId)
  const departmentBranches = listBranchesForDepartment(data, selectedDepartment?.departmentId)
  const branchBatches = listBatchesForBranch(data, selectedBranch?.branchId)
  const batchTerms = listTermsForBatch(data, selectedBatch?.batchId)
  const curriculumBySemester = listCurriculumBySemester(data, selectedBatch?.batchId)
  const selectedFacultyAssignments = selectedFacultyMember ? listFacultyAssignments(data, selectedFacultyMember.facultyId) : []

  return (
    <PageShell size="wide" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <Card
          style={{
            padding: 22,
            background: `radial-gradient(circle at top left, ${T.accent}18, transparent 28%), linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
          }}
          glow={T.accent}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>System Admin Live Mode</div>
              <div style={{ ...sora, fontSize: 24, fontWeight: 800, color: T.text, marginTop: 6 }}>Search-first academic configuration.</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, maxWidth: 720 }}>Everything is managed from the main dashboard. Search gets you to the right academic node fast, while hierarchy, policy, requests, and people stay connected instead of scattered.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <HeroBadge>Live data</HeroBadge>
                <HeroBadge color={T.success}>Batch policy aware</HeroBadge>
                <HeroBadge color={T.orange}>HoD request workflow</HeroBadge>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Portal</Btn> : null}
              <Btn variant="ghost" onClick={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}>Theme</Btn>
              <Btn variant="ghost" onClick={() => void loadAdminData()}><RefreshCw size={14} /> Refresh</Btn>
              <Btn variant="ghost" onClick={handleLogout}>Log Out</Btn>
            </div>
          </div>

          <div style={{ marginTop: 16, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${T.border2}`, borderRadius: 12, padding: '12px 14px', background: T.surface2 }}>
              <Search size={16} color={T.accent} />
              <input
                aria-label="Global admin search"
                placeholder="Search faculty, department, batch, student, faculty member, or course code"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.text, ...mono, fontSize: 12 }}
              />
            </div>
            {searchResults.length > 0 ? (
              <div style={{ position: 'absolute', zIndex: 10, insetInline: 0, top: 'calc(100% + 8px)', display: 'grid', gap: 8 }}>
                <Card style={{ padding: 12 }}>
                  {searchResults.map(result => (
                    <button
                      key={result.key}
                      type="button"
                      onClick={() => {
                        setSearchQuery('')
                        navigate(result.route)
                      }}
                      style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', borderRadius: 10 }}
                    >
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{result.label}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.meta}</div>
                    </button>
                  ))}
                </Card>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {TOP_TABS.map(tab => {
              const Icon = tab.icon
              const active = route.section === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate({ section: tab.id })}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${active ? T.accent : T.border2}`,
                    background: active ? `${T.accent}16` : T.surface,
                    color: active ? T.accent : T.text,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    gap: 8,
                    alignItems: 'center',
                    ...mono,
                    fontSize: 11,
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </Card>

        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {route.section === 'overview' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <MetricCard label="Academic Faculties" value={String(data.academicFaculties.length)} helper="Top-level schools or colleges above departments." />
              <MetricCard label="Departments" value={String(data.departments.length)} helper="Administrative owners beneath academic faculties." />
              <MetricCard label="Batches" value={String(data.batches.length)} helper="Curriculum and policy versioning nodes per branch." />
              <MetricCard label="Open Requests" value={String(data.requests.filter(item => item.status !== 'Closed').length)} helper="HoD-driven changes moving through implementation." />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <Card>
                <SectionHeading title="Hierarchy" eyebrow="Configured" caption="Academic faculty, department, branch, and batch are now first-class backend entities." />
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>{data.institution?.name ?? 'Institution not configured'} currently has {data.academicFaculties.length} academic faculties, {data.branches.length} branches, and {data.terms.length} active academic terms.</div>
              </Card>
              <Card>
                <SectionHeading title="Faculty Assignments" eyebrow="Coverage" caption="Primary department and exact class ownership stay separate, so cross-department teaching is handled without losing home-department identity." />
                <div style={{ ...mono, fontSize: 11, color: T.muted }}>There are {data.ownerships.filter(item => item.status === 'active').length} active class ownership records linked to {data.facultyMembers.length} faculty members.</div>
              </Card>
            </div>
          </div>
        ) : null}

        {route.section === 'faculties' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(240px, 320px) minmax(240px, 320px) minmax(240px, 320px) minmax(320px, 1fr)' }}>
            <Card style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <SectionHeading title="Academic Faculties" eyebrow="Level 1" caption="The school or college layer above departments." />
              {data.academicFaculties.map(item => (
                <button key={item.academicFacultyId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: item.academicFacultyId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.academicFacultyId === item.academicFacultyId ? T.accent : T.border2}`, background: route.academicFacultyId === item.academicFacultyId ? `${T.accent}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.code}</div>
                </button>
              ))}
              <form onSubmit={handleCreateAcademicFaculty} style={{ display: 'grid', gap: 10 }}>
                <FieldLabel>Create Academic Faculty</FieldLabel>
                <TextInput value={structureForms.academicFaculty.code} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" />
                <TextInput value={structureForms.academicFaculty.name} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" />
                <TextAreaInput value={structureForms.academicFaculty.overview} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} placeholder="Overview" rows={3} />
                <Btn type="submit">Add Academic Faculty</Btn>
              </form>
            </Card>

            <Card style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <SectionHeading title="Departments" eyebrow="Level 2" caption="Departments inherit their academic faculty but can manage distinct branches and staff." />
              {!selectedAcademicFaculty ? <InfoBanner message="Select an academic faculty to manage departments." /> : null}
              {facultyDepartments.map(item => (
                <button key={item.departmentId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: item.departmentId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.departmentId === item.departmentId ? T.accent : T.border2}`, background: route.departmentId === item.departmentId ? `${T.accent}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.code}</div>
                </button>
              ))}
              {selectedAcademicFaculty ? (
                <form onSubmit={handleCreateDepartment} style={{ display: 'grid', gap: 10 }}>
                  <FieldLabel>Create Department</FieldLabel>
                  <TextInput value={structureForms.department.code} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" />
                  <TextInput value={structureForms.department.name} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" />
                  <Btn type="submit">Add Department</Btn>
                </form>
              ) : null}
            </Card>

            <Card style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <SectionHeading title="Branches And Batches" eyebrow="Level 3-4" caption="Batches carry curriculum and policy versions, which is where year-specific divergence lives." />
              {!selectedDepartment ? <InfoBanner message="Pick a department to manage branches and batches." /> : null}
              {departmentBranches.map(item => (
                <button key={item.branchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedDepartment?.academicFacultyId ?? undefined, departmentId: selectedDepartment?.departmentId, branchId: item.branchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.branchId === item.branchId ? T.accent : T.border2}`, background: route.branchId === item.branchId ? `${T.accent}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.code} · {item.programLevel}</div>
                </button>
              ))}
              {selectedDepartment ? (
                <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: 10 }}>
                  <FieldLabel>Create Branch</FieldLabel>
                  <TextInput value={structureForms.branch.code} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} placeholder="CSE-AI" />
                  <TextInput value={structureForms.branch.name} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} placeholder="AI and Data Science" />
                  <SelectInput value={structureForms.branch.programLevel} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}>
                    <option value="UG">UG</option>
                    <option value="PG">PG</option>
                  </SelectInput>
                  <TextInput value={structureForms.branch.semesterCount} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} placeholder="8" />
                  <Btn type="submit">Add Branch</Btn>
                </form>
              ) : null}
              {selectedBranch ? (
                <>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Batches</div>
                  {branchBatches.map(item => (
                    <button key={item.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedDepartment?.academicFacultyId ?? undefined, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: item.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.batchId === item.batchId ? T.success : T.border2}`, background: route.batchId === item.batchId ? `${T.success}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                      <div style={{ ...mono, fontSize: 11, color: T.text }}>Batch {item.batchLabel}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{deriveCurrentYearLabel(item.currentSemester)} · Sem {item.currentSemester}</div>
                    </button>
                  ))}
                  <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: 10 }}>
                    <FieldLabel>Create Batch</FieldLabel>
                    <TextInput value={structureForms.batch.admissionYear} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value, batchLabel: event.target.value } }))} placeholder="2022" />
                    <TextInput value={structureForms.batch.currentSemester} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} placeholder="5" />
                    <TextInput value={structureForms.batch.sectionLabels} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" />
                    <Btn type="submit">Add Batch</Btn>
                  </form>
                </>
              ) : null}
            </Card>

            <Card style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <SectionHeading title="Batch Detail" eyebrow="Curriculum And Policy" caption="Batch is the lowest sysadmin override scope. Curriculum, terms, and resolved policy live here." />
              {!selectedBatch ? <InfoBanner message="Select a batch to manage terms, curriculum, and policy overrides." /> : null}
              {selectedBatch ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.success}>Batch {selectedBatch.batchLabel}</Chip>
                    <Chip color={T.accent}>Sem {selectedBatch.currentSemester}</Chip>
                    <Chip color={T.warning}>{deriveCurrentYearLabel(selectedBatch.currentSemester)}</Chip>
                  </div>
                  {resolvedBatchPolicy ? (
                    <InfoBanner message={`Resolved from ${resolvedBatchPolicy.scopeChain.map(item => item.scopeType).join(' -> ')}. Applied overrides: ${resolvedBatchPolicy.appliedOverrides.map(item => item.scopeType).join(', ') || 'institution default only'}.`} />
                  ) : null}

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <div><FieldLabel>O Grade Minimum</FieldLabel><TextInput value={policyForm.oMin} onChange={event => setPolicyForm(prev => ({ ...prev, oMin: event.target.value }))} /></div>
                    <div><FieldLabel>A+ Minimum</FieldLabel><TextInput value={policyForm.aPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, aPlusMin: event.target.value }))} /></div>
                    <div><FieldLabel>A Minimum</FieldLabel><TextInput value={policyForm.aMin} onChange={event => setPolicyForm(prev => ({ ...prev, aMin: event.target.value }))} /></div>
                    <div><FieldLabel>B+ Minimum</FieldLabel><TextInput value={policyForm.bPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, bPlusMin: event.target.value }))} /></div>
                    <div><FieldLabel>B Minimum</FieldLabel><TextInput value={policyForm.bMin} onChange={event => setPolicyForm(prev => ({ ...prev, bMin: event.target.value }))} /></div>
                    <div><FieldLabel>C Minimum</FieldLabel><TextInput value={policyForm.cMin} onChange={event => setPolicyForm(prev => ({ ...prev, cMin: event.target.value }))} /></div>
                    <div><FieldLabel>P Minimum</FieldLabel><TextInput value={policyForm.pMin} onChange={event => setPolicyForm(prev => ({ ...prev, pMin: event.target.value }))} /></div>
                    <div><FieldLabel>CE / SEE Split</FieldLabel><TextInput value={`${policyForm.ce} / ${policyForm.see}`} readOnly /></div>
                    <div><FieldLabel>CE Weight</FieldLabel><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></div>
                    <div><FieldLabel>SEE Weight</FieldLabel><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></div>
                    <div><FieldLabel>Term Tests Weight</FieldLabel><TextInput value={policyForm.termTestsWeight} onChange={event => setPolicyForm(prev => ({ ...prev, termTestsWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Quiz Weight</FieldLabel><TextInput value={policyForm.quizWeight} onChange={event => setPolicyForm(prev => ({ ...prev, quizWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Assignment Weight</FieldLabel><TextInput value={policyForm.assignmentWeight} onChange={event => setPolicyForm(prev => ({ ...prev, assignmentWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Max Term Tests</FieldLabel><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></div>
                    <div><FieldLabel>Max Quizzes</FieldLabel><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></div>
                    <div><FieldLabel>Max Assignments</FieldLabel><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></div>
                    <div><FieldLabel>Workday Start</FieldLabel><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></div>
                    <div><FieldLabel>Workday End</FieldLabel><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Working Days</FieldLabel>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {WEEKDAYS.map(day => {
                          const selected = policyForm.workingDays.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setPolicyForm(prev => ({
                                ...prev,
                                workingDays: selected ? prev.workingDays.filter(item => item !== day) : [...prev.workingDays, day],
                              }))}
                              style={{ borderRadius: 999, border: `1px solid ${selected ? T.accent : T.border2}`, background: selected ? `${T.accent}16` : T.surface2, color: selected ? T.accent : T.text, padding: '8px 10px', cursor: 'pointer', ...mono, fontSize: 10 }}
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Repeat Course Policy</FieldLabel>
                      <SelectInput value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))}>
                        <option value="latest-attempt">Latest attempt</option>
                        <option value="best-attempt">Best attempt</option>
                      </SelectInput>
                    </div>
                  </div>

                  <Btn onClick={handleSaveBatchPolicy}><CheckCircle2 size={14} /> Save Batch Policy</Btn>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <SectionHeading title="Academic Terms" eyebrow="Calendar" caption="Terms tie a batch to a semester instance and actual teaching window." />
                    {batchTerms.map(term => (
                      <Card key={term.termId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>Semester {term.semesterNumber} · {term.academicYearLabel}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(term.startDate)} to {formatDate(term.endDate)}</div>
                      </Card>
                    ))}
                    <form onSubmit={handleCreateTerm} style={{ display: 'grid', gap: 10 }}>
                      <TextInput value={structureForms.term.academicYearLabel} onChange={event => setStructureForms(prev => ({ ...prev, term: { ...prev.term, academicYearLabel: event.target.value } }))} placeholder="2026-27" />
                      <TextInput value={structureForms.term.semesterNumber} onChange={event => setStructureForms(prev => ({ ...prev, term: { ...prev.term, semesterNumber: event.target.value } }))} placeholder="5" />
                      <TextInput value={structureForms.term.startDate} onChange={event => setStructureForms(prev => ({ ...prev, term: { ...prev.term, startDate: event.target.value } }))} placeholder="YYYY-MM-DD" />
                      <TextInput value={structureForms.term.endDate} onChange={event => setStructureForms(prev => ({ ...prev, term: { ...prev.term, endDate: event.target.value } }))} placeholder="YYYY-MM-DD" />
                      <Btn type="submit">Add Term</Btn>
                    </form>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <SectionHeading title="Semester Curriculum" eyebrow="Courses" caption="Curriculum rows hold the exact course code, title, and credits for each batch-semester combination." />
                    {curriculumBySemester.map(entry => (
                      <Card key={entry.semesterNumber} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>Semester {entry.semesterNumber}</div>
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {entry.courses.map(course => (
                            <div key={course.curriculumCourseId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ ...mono, fontSize: 11, color: T.text }}>{course.courseCode} · {course.title}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted }}>{course.credits} credits</div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    <form onSubmit={handleCreateCurriculumCourse} style={{ display: 'grid', gap: 10 }}>
                      <TextInput value={structureForms.curriculum.semesterNumber} onChange={event => setStructureForms(prev => ({ ...prev, curriculum: { ...prev.curriculum, semesterNumber: event.target.value } }))} placeholder="Semester" />
                      <TextInput value={structureForms.curriculum.courseCode} onChange={event => setStructureForms(prev => ({ ...prev, curriculum: { ...prev.curriculum, courseCode: event.target.value } }))} placeholder="CS699" />
                      <TextInput value={structureForms.curriculum.title} onChange={event => setStructureForms(prev => ({ ...prev, curriculum: { ...prev.curriculum, title: event.target.value } }))} placeholder="Advanced Governance Systems" />
                      <TextInput value={structureForms.curriculum.credits} onChange={event => setStructureForms(prev => ({ ...prev, curriculum: { ...prev.curriculum, credits: event.target.value } }))} placeholder="4" />
                      <Btn type="submit">Add Curriculum Course</Btn>
                    </form>
                  </div>
                </>
              ) : null}
            </Card>
          </div>
        ) : null}

        {route.section === 'students' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)' }}>
            <Card style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <SectionHeading title="Students" eyebrow="Registry" caption="Canonical student identity, current academic context, mentor linkage, and CGPA snapshot." />
              {data.students.map(student => (
                <button key={student.studentId} type="button" onClick={() => navigate({ section: 'students', studentId: student.studentId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.studentId === student.studentId ? T.accent : T.border2}`, background: route.studentId === student.studentId ? `${T.accent}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{student.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{student.usn} · {student.activeAcademicContext?.departmentName ?? 'No department'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.success, marginTop: 4 }}>CGPA {student.currentCgpa.toFixed(2)}</div>
                </button>
              ))}
            </Card>
            <Card style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <SectionHeading title="Student Detail" eyebrow="Current Context" caption="Batch, active semester, mentor assignment, and available academic trail." />
              {!selectedStudent ? <InfoBanner message="Choose a student to inspect the current academic context." /> : null}
              {selectedStudent ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                    <Chip color={T.success}>CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                    <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Email: {selectedStudent.email ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Phone: {selectedStudent.phone ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Batch: {selectedStudent.activeAcademicContext?.batchLabel ?? 'Not mapped yet'} · Semester {selectedStudent.activeAcademicContext?.semesterNumber ?? '—'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Mentor: {resolveFacultyMember(data, selectedStudent.activeMentorAssignment?.facultyId)?.displayName ?? selectedStudent.activeMentorAssignment?.facultyId ?? 'Not assigned'}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enrollment Trail</div>
                    {selectedStudent.enrollments.map(enrollment => (
                      <Card key={enrollment.enrollmentId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{enrollment.termId} · Section {enrollment.sectionCode}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(enrollment.startDate)} · {enrollment.academicStatus}</div>
                      </Card>
                    ))}
                  </div>
                </>
              ) : null}
            </Card>
          </div>
        ) : null}

        {route.section === 'faculty-members' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)' }}>
            <Card style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <SectionHeading title="Faculty Members" eyebrow="People" caption="Permissions and teaching ownership stay separate so cross-department loads are visible without muddying roles." />
              {data.facultyMembers.map(item => {
                const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(item))
                return (
                  <button key={item.facultyId} type="button" onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.facultyId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${route.facultyMemberId === item.facultyId ? T.accent : T.border2}`, background: route.facultyMemberId === item.facultyId ? `${T.accent}12` : T.surface2, padding: 12, cursor: 'pointer' }}>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.displayName}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No primary department'}</div>
                  </button>
                )
              })}
            </Card>
            <Card style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <SectionHeading title="Faculty Detail" eyebrow="Assignments" caption="The primary department anchors identity, while appointments, role grants, and exact offering ownership show what they can teach and supervise." />
              {!selectedFacultyMember ? <InfoBanner message="Select a faculty member to review permissions and assigned classes." /> : null}
              {selectedFacultyMember ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedFacultyMember.roleGrants.map(item => <Chip key={item.grantId} color={T.accent}>{item.roleCode}</Chip>)}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Email: {selectedFacultyMember.email}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Phone: {selectedFacultyMember.phone ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Primary Department: {resolveDepartment(data, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'Not set'}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Assigned Classes</div>
                    {selectedFacultyAssignments.map(item => (
                      <Card key={item.ownership.ownershipId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.offering?.code} · {item.offering?.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.offering?.dept} · {item.offering?.year} · Sem {item.offering?.sem} · Section {item.offering?.section}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 4 }}>{item.ownership.ownershipRole}</div>
                      </Card>
                    ))}
                  </div>
                </>
              ) : null}
            </Card>
          </div>
        ) : null}

        {route.section === 'requests' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <Card>
              <SectionHeading title="Requests" eyebrow="Workflow" caption="HoD-issued permanent changes move through admin review, approval, implementation, and closure. The live backend workflow is preserved here." />
              <div style={{ display: 'grid', gap: 10 }}>
                {data.requests.map(request => (
                  <Card key={request.adminRequestId} style={{ padding: 14 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{request.summary}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{request.requestType} · {request.scopeType}:{request.scopeId} · due {formatDateTime(request.dueAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Chip color={request.status === 'Closed' ? T.dim : request.status === 'Implemented' ? T.success : T.warning}>{request.status}</Chip>
                        {['New', 'In Review', 'Needs Info', 'Approved', 'Implemented'].includes(request.status) ? (
                          <Btn onClick={() => void handleAdvanceRequest(request)} disabled={requestBusy === request.adminRequestId}>
                            {request.status === 'New' ? 'Take Review' : request.status === 'Approved' ? 'Mark Implemented' : request.status === 'Implemented' ? 'Close' : 'Approve'}
                          </Btn>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {dataLoading ? <InfoBanner message="Refreshing live admin data…" /> : null}
      </div>
    </PageShell>
  )
}
