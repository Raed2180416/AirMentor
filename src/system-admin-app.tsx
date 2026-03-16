import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings2,
  Shield,
  Users,
} from 'lucide-react'
import { T, mono, sora } from './data'
import type { ThemeMode } from './domain'
import { normalizeThemeMode } from './domain'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAdminRequestDetail,
  ApiAdminRequestSummary,
  ApiAuditEvent,
  ApiBranch,
  ApiCourse,
  ApiDepartment,
  ApiFacultyRecord,
  ApiInstitution,
  ApiSessionResponse,
  ApiStudentRecord,
} from './api/types'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from './repositories'
import { applyThemePreset, isLightTheme } from './theme'
import { Btn, Card, Chip, PageShell } from './ui-primitives'

type AdminPageId = 'dashboard' | 'setup' | 'faculty' | 'students' | 'courses' | 'requests'

type AdminDataset = {
  institution: ApiInstitution | null
  departments: ApiDepartment[]
  branches: ApiBranch[]
  faculty: ApiFacultyRecord[]
  students: ApiStudentRecord[]
  courses: ApiCourse[]
  requests: ApiAdminRequestSummary[]
}

type RequestNoteType = 'request-context' | 'clarification' | 'decision-rationale' | 'implementation-note' | 'system-note'

const EMPTY_ADMIN_DATA: AdminDataset = {
  institution: null,
  departments: [],
  branches: [],
  faculty: [],
  students: [],
  courses: [],
  requests: [],
}

type SystemAdminAppProps = {
  onExitPortal?: () => void
}

const ADMIN_PAGES: Array<{ id: AdminPageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'setup', label: 'Setup', icon: Settings2 },
  { id: 'faculty', label: 'Faculty', icon: Users },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
]

function persistThemeSnapshot(mode: ThemeMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, mode)
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

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function getStatusColor(status: string) {
  const value = status.toLowerCase()
  if (value.includes('active') || value.includes('approved') || value.includes('implemented')) return T.success
  if (value.includes('review') || value.includes('new') || value.includes('needs')) return T.warning
  if (value.includes('reject') || value.includes('closed') || value.includes('inactive')) return T.danger
  return T.muted
}

function toErrorMessage(error: unknown) {
  if (error instanceof AirMentorApiError) {
    if (error.status === 409) return `${error.message}. The latest server version has been reloaded.`
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'The request could not be completed.'
}

function FieldLabel({ children }: { children: string }) {
  return <label style={{ ...mono, fontSize: 10, color: T.muted, display: 'block', marginBottom: 6 }}>{children}</label>
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ width: '100%', ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
}

function TextAreaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ width: '100%', resize: 'vertical', ...mono, fontSize: 11, borderRadius: 8, border: `1px solid ${T.border2}`, background: T.surface2, color: T.text, padding: '10px 12px', ...(props.style ?? {}) }} />
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

function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{caption}</div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{title}</div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{body}</div>
    </Card>
  )
}

export function SystemAdminApp({ onExitPortal }: SystemAdminAppProps = {}) {
  const apiBaseUrl = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim() || 'http://127.0.0.1:4000'
  const apiClient = useMemo(() => new AirMentorApiClient(apiBaseUrl), [apiBaseUrl])
  const repositories = useMemo(() => createAirMentorRepositories({
    repositoryMode: 'http',
    apiClient,
  }), [apiClient])

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 1100)
  const [booting, setBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [session, setSession] = useState<ApiSessionResponse | null>(null)
  const [page, setPage] = useState<AdminPageId>('dashboard')
  const [adminData, setAdminData] = useState<AdminDataset>(EMPTY_ADMIN_DATA)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [flashMessage, setFlashMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [requestDetail, setRequestDetail] = useState<ApiAdminRequestDetail | null>(null)
  const [requestAuditEvents, setRequestAuditEvents] = useState<ApiAuditEvent[]>([])
  const [requestLoading, setRequestLoading] = useState(false)
  const [institutionForm, setInstitutionForm] = useState({ name: '', timezone: 'Asia/Kolkata', academicYearStartMonth: '7', status: 'active' })
  const [departmentForm, setDepartmentForm] = useState({ code: '', name: '', status: 'active' })
  const [branchForm, setBranchForm] = useState({ departmentId: '', code: '', name: '', programLevel: 'UG', semesterCount: '8', status: 'active' })
  const [courseForm, setCourseForm] = useState({ departmentId: '', courseCode: '', title: '', defaultCredits: '4', status: 'active' })
  const [facultyQuery, setFacultyQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [requestQuery, setRequestQuery] = useState('')
  const [requestActionNote, setRequestActionNote] = useState('')
  const [requestNoteType, setRequestNoteType] = useState<RequestNoteType>('implementation-note')
  const [requestOwnerId, setRequestOwnerId] = useState('')

  const deferredFacultyQuery = useDeferredValue(facultyQuery)
  const deferredStudentQuery = useDeferredValue(studentQuery)
  const deferredCourseQuery = useDeferredValue(courseQuery)
  const deferredRequestQuery = useDeferredValue(requestQuery)

  applyThemePreset(themeMode)

  const activeRoleCode = session?.activeRoleGrant.roleCode ?? null
  const isSystemAdmin = activeRoleCode === 'SYSTEM_ADMIN'
  const requestSummary = adminData.requests.find(item => item.adminRequestId === selectedRequestId) ?? null

  const filteredFaculty = useMemo(() => {
    const query = normalizeSearch(deferredFacultyQuery)
    if (!query) return adminData.faculty
    return adminData.faculty.filter(item => (
      item.displayName.toLowerCase().includes(query)
      || item.username.toLowerCase().includes(query)
      || item.email.toLowerCase().includes(query)
      || item.employeeCode.toLowerCase().includes(query)
    ))
  }, [adminData.faculty, deferredFacultyQuery])

  const filteredStudents = useMemo(() => {
    const query = normalizeSearch(deferredStudentQuery)
    if (!query) return adminData.students
    return adminData.students.filter(item => (
      item.name.toLowerCase().includes(query)
      || item.usn.toLowerCase().includes(query)
      || (item.email ?? '').toLowerCase().includes(query)
    ))
  }, [adminData.students, deferredStudentQuery])

  const filteredCourses = useMemo(() => {
    const query = normalizeSearch(deferredCourseQuery)
    if (!query) return adminData.courses
    return adminData.courses.filter(item => (
      item.courseCode.toLowerCase().includes(query)
      || item.title.toLowerCase().includes(query)
    ))
  }, [adminData.courses, deferredCourseQuery])

  const filteredRequests = useMemo(() => {
    const query = normalizeSearch(deferredRequestQuery)
    if (!query) return adminData.requests
    return adminData.requests.filter(item => (
      item.summary.toLowerCase().includes(query)
      || item.requestType.toLowerCase().includes(query)
      || item.scopeId.toLowerCase().includes(query)
      || (item.requesterName ?? '').toLowerCase().includes(query)
    ))
  }, [adminData.requests, deferredRequestQuery])

  const loadAdminData = useCallback(async () => {
    setAdminLoading(true)
    setAdminError('')
    try {
      const [
        institution,
        departments,
        branches,
        faculty,
        students,
        courses,
        requests,
      ] = await Promise.all([
        apiClient.getInstitution(),
        apiClient.listDepartments(),
        apiClient.listBranches(),
        apiClient.listFaculty(),
        apiClient.listStudents(),
        apiClient.listCourses(),
        apiClient.listAdminRequests(),
      ])

      setAdminData({
        institution,
        departments: departments.items,
        branches: branches.items,
        faculty: faculty.items,
        students: students.items,
        courses: courses.items,
        requests: requests.items,
      })
    } catch (error) {
      setAdminError(toErrorMessage(error))
    } finally {
      setAdminLoading(false)
    }
  }, [apiClient])

  const loadRequestDetail = useCallback(async (requestId: string) => {
    setRequestLoading(true)
    try {
      const [detail, audit] = await Promise.all([
        apiClient.getAdminRequest(requestId),
        apiClient.getAdminRequestAudit(requestId),
      ])
      setRequestDetail(detail)
      setRequestAuditEvents(audit.auditEvents)
      setRequestOwnerId(detail.ownedByFacultyId ?? '')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setRequestLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setBooting(true)
      setAuthError('')
      try {
        const restored = await repositories.sessionPreferences.restoreRemoteSession()
        if (cancelled) return
        setSession(restored)
        if (restored?.preferences.themeMode) setThemeMode(restored.preferences.themeMode)
      } catch (error) {
        if (cancelled) return
        setAuthError(toErrorMessage(error))
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [repositories])

  useEffect(() => {
    if (!flashMessage) return
    const timeout = window.setTimeout(() => setFlashMessage(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [flashMessage])

  useEffect(() => {
    if (!isSystemAdmin) {
      setAdminData(EMPTY_ADMIN_DATA)
      setSelectedRequestId(null)
      setRequestDetail(null)
      setRequestAuditEvents([])
      return
    }
    void loadAdminData()
  }, [isSystemAdmin, loadAdminData])

  useEffect(() => {
    if (!adminData.institution) return
    setInstitutionForm({
      name: adminData.institution.name,
      timezone: adminData.institution.timezone,
      academicYearStartMonth: String(adminData.institution.academicYearStartMonth),
      status: adminData.institution.status,
    })
  }, [adminData.institution])

  useEffect(() => {
    const selected = selectedDepartmentId
      ? adminData.departments.find(item => item.departmentId === selectedDepartmentId) ?? null
      : null
    if (!selected) {
      setDepartmentForm({ code: '', name: '', status: 'active' })
      return
    }
    setDepartmentForm({
      code: selected.code,
      name: selected.name,
      status: selected.status,
    })
  }, [adminData.departments, selectedDepartmentId])

  useEffect(() => {
    const selected = selectedBranchId
      ? adminData.branches.find(item => item.branchId === selectedBranchId) ?? null
      : null
    if (!selected) {
      setBranchForm({
        departmentId: adminData.departments[0]?.departmentId ?? '',
        code: '',
        name: '',
        programLevel: 'UG',
        semesterCount: '8',
        status: 'active',
      })
      return
    }
    setBranchForm({
      departmentId: selected.departmentId,
      code: selected.code,
      name: selected.name,
      programLevel: selected.programLevel,
      semesterCount: String(selected.semesterCount),
      status: selected.status,
    })
  }, [adminData.branches, adminData.departments, selectedBranchId])

  useEffect(() => {
    const selected = selectedCourseId
      ? adminData.courses.find(item => item.courseId === selectedCourseId) ?? null
      : null
    if (!selected) {
      setCourseForm({
        departmentId: adminData.departments[0]?.departmentId ?? '',
        courseCode: '',
        title: '',
        defaultCredits: '4',
        status: 'active',
      })
      return
    }
    setCourseForm({
      departmentId: selected.departmentId,
      courseCode: selected.courseCode,
      title: selected.title,
      defaultCredits: String(selected.defaultCredits),
      status: selected.status,
    })
  }, [adminData.courses, adminData.departments, selectedCourseId])

  useEffect(() => {
    if (adminData.requests.length === 0) {
      setSelectedRequestId(null)
      setRequestDetail(null)
      setRequestAuditEvents([])
      return
    }
    if (!selectedRequestId || !adminData.requests.some(item => item.adminRequestId === selectedRequestId)) {
      setSelectedRequestId(adminData.requests[0].adminRequestId)
    }
  }, [adminData.requests, selectedRequestId])

  useEffect(() => {
    if (!selectedRequestId || !isSystemAdmin) {
      setRequestDetail(null)
      setRequestAuditEvents([])
      return
    }
    void loadRequestDetail(selectedRequestId)
  }, [isSystemAdmin, loadRequestDetail, selectedRequestId])

  async function handleThemeChange(nextMode: ThemeMode) {
    setThemeMode(nextMode)
    persistThemeSnapshot(nextMode)
    setSession(current => current ? {
      ...current,
      preferences: {
        ...current.preferences,
        themeMode: nextMode,
        version: current.preferences.version + 1,
      },
    } : current)

    try {
      await repositories.sessionPreferences.saveTheme(nextMode)
    } catch (error) {
      setActionError(toErrorMessage(error))
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      const nextSession = await repositories.sessionPreferences.loginRemoteSession({ identifier, password })
      setSession(nextSession)
      setThemeMode(nextSession.preferences.themeMode)
      setPage('dashboard')
      setFlashMessage(`Signed in as ${nextSession.user.username}`)
    } catch (error) {
      setAuthError(toErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    setActionBusy('logout')
    setActionError('')
    try {
      await repositories.sessionPreferences.logoutRemoteSession()
      setSession(null)
      setAdminData(EMPTY_ADMIN_DATA)
      setSelectedRequestId(null)
      setRequestDetail(null)
      setRequestAuditEvents([])
      setPage('dashboard')
      setFlashMessage('Session cleared.')
      onExitPortal?.()
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setActionBusy('')
    }
  }

  async function handleRoleSwitch(roleGrantId: string) {
    setActionBusy(`role:${roleGrantId}`)
    setActionError('')
    try {
      const nextSession = await repositories.sessionPreferences.switchRemoteRoleContext(roleGrantId)
      setSession(nextSession)
      setFlashMessage(`Role context switched to ${nextSession.activeRoleGrant.roleCode}`)
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setActionBusy('')
    }
  }

  async function handleInstitutionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adminData.institution) return
    setActionBusy('institution')
    setActionError('')
    try {
      const next = await apiClient.updateInstitution({
        name: institutionForm.name,
        timezone: institutionForm.timezone,
        academicYearStartMonth: Number(institutionForm.academicYearStartMonth),
        status: institutionForm.status,
        version: adminData.institution.version,
      })
      setAdminData(current => ({ ...current, institution: next }))
      setFlashMessage('Institution settings updated.')
    } catch (error) {
      setActionError(toErrorMessage(error))
      await loadAdminData()
    } finally {
      setActionBusy('')
    }
  }

  async function handleDepartmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionBusy('department')
    setActionError('')
    try {
      if (selectedDepartmentId) {
        const current = adminData.departments.find(item => item.departmentId === selectedDepartmentId)
        if (!current) return
        const next = await apiClient.updateDepartment(selectedDepartmentId, {
          code: departmentForm.code,
          name: departmentForm.name,
          status: departmentForm.status,
          version: current.version,
        })
        setAdminData(data => ({
          ...data,
          departments: data.departments.map(item => item.departmentId === next.departmentId ? next : item),
        }))
        setFlashMessage('Department updated.')
      } else {
        const created = await apiClient.createDepartment({
          code: departmentForm.code,
          name: departmentForm.name,
          status: departmentForm.status,
        })
        setAdminData(data => ({ ...data, departments: [...data.departments, created] }))
        setSelectedDepartmentId(created.departmentId)
        setFlashMessage('Department created.')
      }
    } catch (error) {
      setActionError(toErrorMessage(error))
      await loadAdminData()
    } finally {
      setActionBusy('')
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionBusy('branch')
    setActionError('')
    try {
      if (selectedBranchId) {
        const current = adminData.branches.find(item => item.branchId === selectedBranchId)
        if (!current) return
        const next = await apiClient.updateBranch(selectedBranchId, {
          departmentId: branchForm.departmentId,
          code: branchForm.code,
          name: branchForm.name,
          programLevel: branchForm.programLevel,
          semesterCount: Number(branchForm.semesterCount),
          status: branchForm.status,
          version: current.version,
        })
        setAdminData(data => ({
          ...data,
          branches: data.branches.map(item => item.branchId === next.branchId ? next : item),
        }))
        setFlashMessage('Branch updated.')
      } else {
        const created = await apiClient.createBranch({
          departmentId: branchForm.departmentId,
          code: branchForm.code,
          name: branchForm.name,
          programLevel: branchForm.programLevel,
          semesterCount: Number(branchForm.semesterCount),
          status: branchForm.status,
        })
        setAdminData(data => ({ ...data, branches: [...data.branches, created] }))
        setSelectedBranchId(created.branchId)
        setFlashMessage('Branch created.')
      }
    } catch (error) {
      setActionError(toErrorMessage(error))
      await loadAdminData()
    } finally {
      setActionBusy('')
    }
  }

  async function handleCourseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionBusy('course')
    setActionError('')
    try {
      if (selectedCourseId) {
        const current = adminData.courses.find(item => item.courseId === selectedCourseId)
        if (!current) return
        const next = await apiClient.updateCourse(selectedCourseId, {
          departmentId: courseForm.departmentId,
          courseCode: courseForm.courseCode,
          title: courseForm.title,
          defaultCredits: Number(courseForm.defaultCredits),
          status: courseForm.status,
          version: current.version,
        })
        setAdminData(data => ({
          ...data,
          courses: data.courses.map(item => item.courseId === next.courseId ? next : item),
        }))
        setFlashMessage('Course updated.')
      } else {
        const created = await apiClient.createCourse({
          departmentId: courseForm.departmentId,
          courseCode: courseForm.courseCode,
          title: courseForm.title,
          defaultCredits: Number(courseForm.defaultCredits),
          status: courseForm.status,
        })
        setAdminData(data => ({ ...data, courses: [...data.courses, created] }))
        setSelectedCourseId(created.courseId)
        setFlashMessage('Course created.')
      }
    } catch (error) {
      setActionError(toErrorMessage(error))
      await loadAdminData()
    } finally {
      setActionBusy('')
    }
  }

  async function handleRequestTransition(action: 'assign' | 'request-info' | 'approve' | 'reject' | 'mark-implemented' | 'close' | 'note') {
    if (!requestDetail) return
    if ((action === 'request-info' || action === 'reject' || action === 'note') && !requestActionNote.trim()) {
      setActionError('A note is required for this action.')
      return
    }
    setActionBusy(`request:${action}`)
    setActionError('')
    try {
      if (action === 'assign') {
        await apiClient.assignAdminRequest(requestDetail.adminRequestId, {
          version: requestDetail.version,
          ownedByFacultyId: requestOwnerId || null,
          noteBody: requestActionNote.trim() || undefined,
        })
      } else if (action === 'request-info') {
        await apiClient.requestAdminRequestInfo(requestDetail.adminRequestId, {
          version: requestDetail.version,
          noteBody: requestActionNote.trim(),
        })
      } else if (action === 'approve') {
        await apiClient.approveAdminRequest(requestDetail.adminRequestId, {
          version: requestDetail.version,
          noteBody: requestActionNote.trim() || undefined,
        })
      } else if (action === 'reject') {
        await apiClient.rejectAdminRequest(requestDetail.adminRequestId, {
          version: requestDetail.version,
          noteBody: requestActionNote.trim(),
        })
      } else if (action === 'mark-implemented') {
        await apiClient.markAdminRequestImplemented(requestDetail.adminRequestId, {
          version: requestDetail.version,
          noteBody: requestActionNote.trim() || undefined,
        })
      } else if (action === 'close') {
        await apiClient.closeAdminRequest(requestDetail.adminRequestId, {
          version: requestDetail.version,
          noteBody: requestActionNote.trim() || undefined,
        })
      } else {
        await apiClient.addAdminRequestNote(requestDetail.adminRequestId, {
          visibility: 'internal',
          noteType: requestNoteType,
          body: requestActionNote.trim(),
        })
      }
      await loadAdminData()
      await loadRequestDetail(requestDetail.adminRequestId)
      setRequestActionNote('')
      setFlashMessage(action === 'note' ? 'Request note added.' : 'Request workflow updated.')
    } catch (error) {
      setActionError(toErrorMessage(error))
      await loadAdminData()
      await loadRequestDetail(requestDetail.adminRequestId)
    } finally {
      setActionBusy('')
    }
  }

  const institutionName = adminData.institution?.name ?? 'AirMentor'
  const activeFacultyCount = adminData.faculty.filter(item => item.status === 'active').length
  const openRequestCount = adminData.requests.filter(item => item.status !== 'Closed' && item.status !== 'Rejected').length
  const implementedRequestCount = adminData.requests.filter(item => item.status === 'Implemented').length

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', background: `radial-gradient(circle at top left, ${T.accent}16, transparent 28%), ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ maxWidth: 420, width: '100%', padding: 24 }}>
          <div style={{ ...sora, fontWeight: 800, fontSize: 22, color: T.text }}>Preparing admin control plane</div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>
            Restoring backend session and loading the system admin workspace.
          </div>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top left, ${T.accent}22, transparent 24%), radial-gradient(circle at bottom right, ${T.success}12, transparent 28%), ${T.bg}`,
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Card style={{ width: '100%', maxWidth: 480, padding: 26 }} glow={T.accent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>System Admin Portal</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 26, color: T.text, marginTop: 8 }}>AirMentor Control Plane</div>
              <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10 }}>
                Live backend mode is enabled. Sign in with the seeded system admin account to access setup and governance workflows.
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

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            <div>
              <FieldLabel>Username or email</FieldLabel>
              <TextInput value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Username or email" />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <TextInput type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" />
            </div>
            {authError ? <InfoBanner tone="error" message={authError} /> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim }}>API base: {apiBaseUrl}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {onExitPortal ? (
                  <Btn variant="ghost" onClick={onExitPortal}>
                    Back
                  </Btn>
                ) : null}
                <Btn type="submit" disabled={authBusy}>
                  <Shield size={14} />
                  {authBusy ? 'Signing in...' : 'Sign In'}
                </Btn>
              </div>
            </div>
          </form>
        </Card>
      </div>
    )
  }

  if (!isSystemAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ width: '100%', maxWidth: 640, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.warning }}>
            <AlertTriangle size={18} />
            <div style={{ ...sora, fontWeight: 800, fontSize: 20, color: T.text }}>System Admin workspace is not available for {session.activeRoleGrant.roleCode}</div>
          </div>
          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10 }}>
            This portal is separated from the teaching workflows. Switch back to a `SYSTEM_ADMIN` role grant or log out.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {session.availableRoleGrants.map(grant => (
              <button
                key={grant.grantId}
                type="button"
                onClick={() => void handleRoleSwitch(grant.grantId)}
                style={{
                  ...mono,
                  fontSize: 11,
                  color: grant.grantId === session.activeRoleGrant.grantId ? T.text : T.muted,
                  border: `1px solid ${grant.grantId === session.activeRoleGrant.grantId ? T.accent : T.border}`,
                  background: grant.grantId === session.activeRoleGrant.grantId ? `${T.accent}18` : 'transparent',
                  borderRadius: 999,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                {grant.roleCode} · {grant.scopeType}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {onExitPortal ? (
              <Btn variant="ghost" onClick={onExitPortal}>
                Back to portal choice
              </Btn>
            ) : null}
            <Btn variant="ghost" onClick={() => void handleLogout()}>
              <LogOut size={14} />
              Log Out
            </Btn>
          </div>
          {actionError ? <div style={{ marginTop: 12 }}><InfoBanner tone="error" message={actionError} /></div> : null}
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)', background: isLightTheme(themeMode) ? 'rgba(247,251,255,0.88)' : 'rgba(10,16,24,0.88)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', ...sora, fontWeight: 800 }}>AM</div>
            <div>
              <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>System Admin</div>
              <div style={{ ...sora, fontWeight: 800, fontSize: 18, color: T.text }}>{institutionName}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ ...mono, fontSize: 11, color: T.muted }}>
              {session.user.username} · {session.faculty?.displayName ?? 'No faculty profile'}
            </div>
            <button
              type="button"
              onClick={() => void handleThemeChange(isLightTheme(themeMode) ? 'frosted-focus-dark' : 'frosted-focus-light')}
              style={{ ...mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
            >
              {isLightTheme(themeMode) ? 'Dark' : 'Light'}
            </button>
            <Btn variant="ghost" onClick={() => void loadAdminData()} disabled={adminLoading}>
              <RefreshCw size={14} />
              {adminLoading ? 'Refreshing...' : 'Refresh'}
            </Btn>
            <Btn variant="ghost" onClick={() => void handleLogout()} disabled={actionBusy === 'logout'}>
              <LogOut size={14} />
              Logout
            </Btn>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '280px minmax(0, 1fr)', gap: 20, padding: 20 }}>
        <Card style={{ padding: 16, alignSelf: 'start', position: isCompact ? 'static' : 'sticky', top: 96 }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Navigation</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {ADMIN_PAGES.map(item => {
              const Icon = item.icon
              const active = item.id === page
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startTransition(() => setPage(item.id))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 12,
                    border: `1px solid ${active ? T.accent : T.border}`,
                    background: active ? `${T.accent}18` : 'transparent',
                    color: active ? T.text : T.muted,
                    padding: '11px 12px',
                    cursor: 'pointer',
                    ...mono,
                    fontSize: 11,
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Role grants</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {session.availableRoleGrants.map(grant => (
                <button
                  key={grant.grantId}
                  type="button"
                  onClick={() => void handleRoleSwitch(grant.grantId)}
                  style={{
                    textAlign: 'left',
                    borderRadius: 10,
                    border: `1px solid ${grant.grantId === session.activeRoleGrant.grantId ? T.accent : T.border}`,
                    background: grant.grantId === session.activeRoleGrant.grantId ? `${T.accent}16` : T.surface2,
                    color: grant.grantId === session.activeRoleGrant.grantId ? T.text : T.muted,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ ...mono, fontSize: 11 }}>{grant.roleCode}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{grant.scopeType} · {grant.scopeId}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Backend</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10 }}>Repository mode: `http`</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, wordBreak: 'break-word' }}>API base: {apiBaseUrl}</div>
          </div>
        </Card>

        <PageShell size="wide" style={{ display: 'grid', gap: 18 }}>
          {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
          {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
          {adminError ? <InfoBanner tone="error" message={adminError} /> : null}

          {page === 'dashboard' && (
            <>
              <SectionHeading title="Dashboard" caption="Institution summary, request posture, and control-plane health." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                <MetricCard label="Departments" value={String(adminData.departments.length)} helper="Configured academic departments" />
                <MetricCard label="Branches" value={String(adminData.branches.length)} helper="Programs available under the institution" />
                <MetricCard label="Faculty" value={String(activeFacultyCount)} helper="Active faculty profiles with appointments and grants" />
                <MetricCard label="Requests" value={String(openRequestCount)} helper={`${implementedRequestCount} implemented and awaiting closure`} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Institution setup</div>
                  {adminData.institution ? (
                    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Timezone: <span style={{ color: T.text }}>{adminData.institution.timezone}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Academic year start month: <span style={{ color: T.text }}>{adminData.institution.academicYearStartMonth}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Last updated: <span style={{ color: T.text }}>{formatDateTime(adminData.institution.updatedAt)}</span></div>
                      <Chip color={getStatusColor(adminData.institution.status)}>{adminData.institution.status}</Chip>
                    </div>
                  ) : <EmptyState title="Institution not loaded" body="Refresh the backend connection to load the institution record." />}
                </Card>

                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Request queue posture</div>
                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {['New', 'In Review', 'Needs Info', 'Approved', 'Implemented', 'Closed'].map(status => {
                      const count = adminData.requests.filter(item => item.status === status).length
                      return (
                        <div key={status} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <Chip color={getStatusColor(status)}>{status}</Chip>
                          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{count}</div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Card style={{ padding: 18 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Role coverage</div>
                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {['SYSTEM_ADMIN', 'HOD', 'COURSE_LEADER', 'MENTOR'].map(roleCode => {
                      const count = adminData.faculty.filter(item => item.roleGrants.some(grant => grant.roleCode === roleCode && grant.status === 'active')).length
                      return (
                        <div key={roleCode} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div style={{ ...mono, fontSize: 11, color: T.muted }}>{roleCode}</div>
                          <div style={{ ...sora, fontWeight: 700, fontSize: 16, color: T.text }}>{count}</div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            </>
          )}

          {page === 'setup' && (
            <>
              <SectionHeading title="Setup" caption="Institution registry, departments, and branch structure." />
              <Card style={{ padding: 18 }}>
                <form onSubmit={handleInstitutionSubmit} style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Institution</div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>Controls the deployment-wide identity and academic-year defaults.</div>
                    </div>
                    <Btn type="submit" disabled={actionBusy === 'institution' || !adminData.institution}>Save Institution</Btn>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <TextInput value={institutionForm.name} onChange={event => setInstitutionForm(current => ({ ...current, name: event.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Timezone</FieldLabel>
                      <TextInput value={institutionForm.timezone} onChange={event => setInstitutionForm(current => ({ ...current, timezone: event.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Academic year start month</FieldLabel>
                      <TextInput type="number" min="1" max="12" value={institutionForm.academicYearStartMonth} onChange={event => setInstitutionForm(current => ({ ...current, academicYearStartMonth: event.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <SelectInput value={institutionForm.status} onChange={event => setInstitutionForm(current => ({ ...current, status: event.target.value }))}>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </SelectInput>
                    </div>
                  </div>
                </form>
              </Card>

              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14 }}>
                <Card style={{ padding: 18 }}>
                  <form onSubmit={handleDepartmentSubmit} style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Departments</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>Create and revise department master records.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="ghost" onClick={() => setSelectedDepartmentId(null)}>New</Btn>
                        <Btn type="submit" disabled={actionBusy === 'department'}>{selectedDepartmentId ? 'Save Department' : 'Create Department'}</Btn>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {adminData.departments.map(item => (
                        <button
                          key={item.departmentId}
                          type="button"
                          onClick={() => setSelectedDepartmentId(item.departmentId)}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${selectedDepartmentId === item.departmentId ? T.accent : T.border}`,
                            background: selectedDepartmentId === item.departmentId ? `${T.accent}16` : T.surface2,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.code} · {item.name}</div>
                          <div style={{ marginTop: 6 }}><Chip color={getStatusColor(item.status)}>{item.status}</Chip></div>
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Code</FieldLabel>
                        <TextInput value={departmentForm.code} onChange={event => setDepartmentForm(current => ({ ...current, code: event.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <SelectInput value={departmentForm.status} onChange={event => setDepartmentForm(current => ({ ...current, status: event.target.value }))}>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </SelectInput>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <TextInput value={departmentForm.name} onChange={event => setDepartmentForm(current => ({ ...current, name: event.target.value }))} />
                    </div>
                  </form>
                </Card>

                <Card style={{ padding: 18 }}>
                  <form onSubmit={handleBranchSubmit} style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Branches</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>Manage programs under each department.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="ghost" onClick={() => setSelectedBranchId(null)}>New</Btn>
                        <Btn type="submit" disabled={actionBusy === 'branch'}>{selectedBranchId ? 'Save Branch' : 'Create Branch'}</Btn>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {adminData.branches.map(item => (
                        <button
                          key={item.branchId}
                          type="button"
                          onClick={() => setSelectedBranchId(item.branchId)}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${selectedBranchId === item.branchId ? T.accent : T.border}`,
                            background: selectedBranchId === item.branchId ? `${T.accent}16` : T.surface2,
                            padding: '10px 12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.code} · {item.name}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{item.programLevel} · {item.semesterCount} semesters</div>
                        </button>
                      ))}
                    </div>

                    <div>
                      <FieldLabel>Department</FieldLabel>
                      <SelectInput value={branchForm.departmentId} onChange={event => setBranchForm(current => ({ ...current, departmentId: event.target.value }))}>
                        {adminData.departments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.code} · {item.name}</option>)}
                      </SelectInput>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Code</FieldLabel>
                        <TextInput value={branchForm.code} onChange={event => setBranchForm(current => ({ ...current, code: event.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel>Name</FieldLabel>
                        <TextInput value={branchForm.name} onChange={event => setBranchForm(current => ({ ...current, name: event.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Program level</FieldLabel>
                        <SelectInput value={branchForm.programLevel} onChange={event => setBranchForm(current => ({ ...current, programLevel: event.target.value }))}>
                          <option value="UG">UG</option>
                          <option value="PG">PG</option>
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Semesters</FieldLabel>
                        <TextInput type="number" min="1" value={branchForm.semesterCount} onChange={event => setBranchForm(current => ({ ...current, semesterCount: event.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <SelectInput value={branchForm.status} onChange={event => setBranchForm(current => ({ ...current, status: event.target.value }))}>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </SelectInput>
                      </div>
                    </div>
                  </form>
                </Card>
              </div>
            </>
          )}

          {page === 'faculty' && (
            <>
              <SectionHeading title="Faculty" caption="Faculty profiles, appointments, and granted role contexts." />
              <Card style={{ padding: 18 }}>
                <FieldLabel>Search faculty</FieldLabel>
                <TextInput value={facultyQuery} onChange={event => setFacultyQuery(event.target.value)} placeholder="Name, username, email, employee code" />
              </Card>
              {filteredFaculty.length === 0 ? <EmptyState title="No faculty records" body="No faculty matched the current search." /> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {filteredFaculty.map(item => (
                    <Card key={item.facultyId} style={{ padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ ...sora, fontWeight: 800, fontSize: 17, color: T.text }}>{item.displayName}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{item.designation}</div>
                        </div>
                        <Chip color={getStatusColor(item.status)}>{item.status}</Chip>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Employee code: <span style={{ color: T.text }}>{item.employeeCode}</span></div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Username: <span style={{ color: T.text }}>{item.username}</span></div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{item.email}</span></div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Joined on: <span style={{ color: T.text }}>{formatDate(item.joinedOn)}</span></div>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active grants</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {item.roleGrants.map(grant => <Chip key={grant.grantId} color={getStatusColor(grant.status)}>{grant.roleCode}</Chip>)}
                        </div>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Appointments</div>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          {item.appointments.map(appointment => (
                            <div key={appointment.appointmentId} style={{ ...mono, fontSize: 11, color: T.muted, padding: '8px 10px', borderRadius: 8, background: T.surface2 }}>
                              {appointment.departmentId}{appointment.branchId ? ` · ${appointment.branchId}` : ''} · {appointment.isPrimary ? 'Primary' : 'Secondary'}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {page === 'students' && (
            <>
              <SectionHeading title="Students" caption="Canonical student identities, enrollments, and mentor mappings." />
              <Card style={{ padding: 18 }}>
                <FieldLabel>Search students</FieldLabel>
                <TextInput value={studentQuery} onChange={event => setStudentQuery(event.target.value)} placeholder="Name, USN, email" />
              </Card>
              {filteredStudents.length === 0 ? <EmptyState title="No students found" body="Try a different name, USN, or clear the filter." /> : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {filteredStudents.map(item => (
                    <Card key={item.studentId} style={{ padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontWeight: 800, fontSize: 17, color: T.text }}>{item.name}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{item.usn}{item.rollNumber ? ` · ${item.rollNumber}` : ''}</div>
                        </div>
                        <Chip color={getStatusColor(item.status)}>{item.status}</Chip>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Admission date: <span style={{ color: T.text }}>{formatDate(item.admissionDate)}</span></div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Email: <span style={{ color: T.text }}>{item.email ?? 'Not set'}</span></div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Phone: <span style={{ color: T.text }}>{item.phone ?? 'Not set'}</span></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 12, marginTop: 14 }}>
                        <div>
                          <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enrollments</div>
                          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                            {item.enrollments.map(enrollment => (
                              <div key={enrollment.enrollmentId} style={{ ...mono, fontSize: 11, color: T.muted, padding: '8px 10px', borderRadius: 8, background: T.surface2 }}>
                                {enrollment.branchId} · Term {enrollment.termId} · Section {enrollment.sectionCode}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mentor assignments</div>
                          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                            {item.mentorAssignments.map(assignment => (
                              <div key={assignment.assignmentId} style={{ ...mono, fontSize: 11, color: T.muted, padding: '8px 10px', borderRadius: 8, background: T.surface2 }}>
                                {assignment.facultyId} · Since {formatDate(assignment.effectiveFrom)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {page === 'courses' && (
            <>
              <SectionHeading title="Courses" caption="Master course definitions mapped to departments." />
              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.15fr 0.85fr', gap: 14 }}>
                <Card style={{ padding: 18 }}>
                  <FieldLabel>Search courses</FieldLabel>
                  <TextInput value={courseQuery} onChange={event => setCourseQuery(event.target.value)} placeholder="Course code or title" />
                  <div style={{ display: 'grid', gap: 8, marginTop: 14, maxHeight: 420, overflowY: 'auto' }}>
                    {filteredCourses.map(item => (
                      <button
                        key={item.courseId}
                        type="button"
                        onClick={() => setSelectedCourseId(item.courseId)}
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${selectedCourseId === item.courseId ? T.accent : T.border}`,
                          background: selectedCourseId === item.courseId ? `${T.accent}16` : T.surface2,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <div style={{ ...mono, fontSize: 11, color: T.text }}>{item.courseCode}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.title}</div>
                          </div>
                          <Chip color={getStatusColor(item.status)}>{item.defaultCredits} cr</Chip>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card style={{ padding: 18 }}>
                  <form onSubmit={handleCourseSubmit} style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>{selectedCourseId ? 'Edit course' : 'Create course'}</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 4 }}>Adjust master course metadata and default credits.</div>
                      </div>
                      <Btn variant="ghost" onClick={() => setSelectedCourseId(null)}>Clear</Btn>
                    </div>

                    <div>
                      <FieldLabel>Department</FieldLabel>
                      <SelectInput value={courseForm.departmentId} onChange={event => setCourseForm(current => ({ ...current, departmentId: event.target.value }))}>
                        {adminData.departments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.code} · {item.name}</option>)}
                      </SelectInput>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Course code</FieldLabel>
                        <TextInput value={courseForm.courseCode} onChange={event => setCourseForm(current => ({ ...current, courseCode: event.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel>Default credits</FieldLabel>
                        <TextInput type="number" min="1" value={courseForm.defaultCredits} onChange={event => setCourseForm(current => ({ ...current, defaultCredits: event.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Title</FieldLabel>
                      <TextInput value={courseForm.title} onChange={event => setCourseForm(current => ({ ...current, title: event.target.value }))} />
                    </div>
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <SelectInput value={courseForm.status} onChange={event => setCourseForm(current => ({ ...current, status: event.target.value }))}>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </SelectInput>
                    </div>
                    <Btn type="submit" disabled={actionBusy === 'course'}>{selectedCourseId ? 'Save Course' : 'Create Course'}</Btn>
                  </form>
                </Card>
              </div>
            </>
          )}

          {page === 'requests' && (
            <>
              <SectionHeading title="Requests" caption="System-admin governance queue with notes, transitions, and audit evidence." />
              <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '380px minmax(0, 1fr)', gap: 14 }}>
                <Card style={{ padding: 18 }}>
                  <FieldLabel>Search requests</FieldLabel>
                  <TextInput value={requestQuery} onChange={event => setRequestQuery(event.target.value)} placeholder="Summary, type, scope, requester" />
                  <div style={{ display: 'grid', gap: 8, marginTop: 14, maxHeight: 620, overflowY: 'auto' }}>
                    {filteredRequests.map(item => (
                      <button
                        key={item.adminRequestId}
                        type="button"
                        onClick={() => setSelectedRequestId(item.adminRequestId)}
                        style={{
                          borderRadius: 12,
                          border: `1px solid ${selectedRequestId === item.adminRequestId ? T.accent : T.border}`,
                          background: selectedRequestId === item.adminRequestId ? `${T.accent}16` : T.surface2,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <Chip color={getStatusColor(item.status)}>{item.status}</Chip>
                          <Chip color={getStatusColor(item.priority)}>{item.priority}</Chip>
                        </div>
                        <div style={{ ...sora, fontWeight: 700, fontSize: 14, color: T.text, marginTop: 10 }}>{item.summary}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.requestType} · {item.scopeType} · due {formatDate(item.dueAt)}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 6 }}>Requester: {item.requesterName ?? item.requestedByFacultyId}</div>
                      </button>
                    ))}
                  </div>
                </Card>

                {!requestDetail && !requestLoading ? <EmptyState title="Select a request" body="Pick a request from the left to inspect its notes, transitions, and audit trail." /> : (
                  <Card style={{ padding: 18 }}>
                    {requestLoading || !requestDetail ? (
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Loading request detail...</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <Chip color={getStatusColor(requestDetail.status)}>{requestDetail.status}</Chip>
                              <Chip color={getStatusColor(requestDetail.priority)}>{requestDetail.priority}</Chip>
                              <Chip color={T.accent}>{requestDetail.requestType}</Chip>
                            </div>
                            <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{requestDetail.summary}</div>
                            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 8 }}>{requestDetail.details}</div>
                          </div>
                          <div style={{ ...mono, fontSize: 11, color: T.dim }}>
                            Version {requestDetail.version}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Requester: <span style={{ color: T.text }}>{requestSummary?.requesterName ?? requestDetail.requestedByFacultyId}</span></div>
                          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current owner: <span style={{ color: T.text }}>{requestSummary?.ownerName ?? requestDetail.ownedByFacultyId ?? 'Unassigned'}</span></div>
                          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Due at: <span style={{ color: T.text }}>{formatDateTime(requestDetail.dueAt)}</span></div>
                          <div style={{ ...mono, fontSize: 11, color: T.muted }}>Updated: <span style={{ color: T.text }}>{formatDateTime(requestDetail.updatedAt)}</span></div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                          <FieldLabel>Action note</FieldLabel>
                          <TextAreaInput rows={4} value={requestActionNote} onChange={event => setRequestActionNote(event.target.value)} placeholder="Use this for rationale, clarifications, or implementation notes." />
                          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 12 }}>
                            <div>
                              <FieldLabel>Note type</FieldLabel>
                              <SelectInput value={requestNoteType} onChange={event => setRequestNoteType(event.target.value as RequestNoteType)}>
                                <option value="implementation-note">implementation-note</option>
                                <option value="decision-rationale">decision-rationale</option>
                                <option value="clarification">clarification</option>
                                <option value="request-context">request-context</option>
                                <option value="system-note">system-note</option>
                              </SelectInput>
                            </div>
                            <div>
                              <FieldLabel>Owner</FieldLabel>
                              <SelectInput value={requestOwnerId} onChange={event => setRequestOwnerId(event.target.value)}>
                                <option value="">Unassigned</option>
                                {adminData.faculty.map(item => <option key={item.facultyId} value={item.facultyId}>{item.displayName}</option>)}
                              </SelectInput>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <Btn onClick={() => void handleRequestTransition('assign')} disabled={actionBusy === 'request:assign'}>Assign / Claim</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('request-info')} disabled={actionBusy === 'request:request-info'}>Request Info</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('approve')} disabled={actionBusy === 'request:approve'}>Approve</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('reject')} disabled={actionBusy === 'request:reject'}>Reject</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('mark-implemented')} disabled={actionBusy === 'request:mark-implemented'}>Mark Implemented</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('close')} disabled={actionBusy === 'request:close'}>Close</Btn>
                            <Btn variant="ghost" onClick={() => void handleRequestTransition('note')} disabled={actionBusy === 'request:note'}>Add Note</Btn>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 14 }}>
                          <div>
                            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</div>
                            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                              {requestDetail.notes.map(note => (
                                <div key={note.noteId} style={{ borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Chip color={T.accent}>{note.noteType}</Chip>
                                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>{formatDateTime(note.createdAt)}</div>
                                  </div>
                                  <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 8 }}>{note.body}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 8 }}>{note.authorRole}{note.authorFacultyId ? ` · ${note.authorFacultyId}` : ''}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transitions</div>
                            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                              {requestDetail.transitions.map(transition => (
                                <div key={transition.transitionId} style={{ borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ ...mono, fontSize: 11, color: T.text }}>
                                      {(transition.previousStatus ?? 'None')} → {transition.nextStatus}
                                    </div>
                                    <div style={{ ...mono, fontSize: 10, color: T.dim }}>{formatDateTime(transition.createdAt)}</div>
                                  </div>
                                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{transition.actorRole}{transition.actorFacultyId ? ` · ${transition.actorFacultyId}` : ''}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audit events</div>
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {requestAuditEvents.map(event => (
                              <div key={event.auditEventId} style={{ borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, padding: '10px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{event.action}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.dim }}>{formatDateTime(event.createdAt)}</div>
                                </div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{event.actorRole}{event.actorId ? ` · ${event.actorId}` : ''}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </>
          )}
        </PageShell>
      </div>

      {adminLoading ? (
        <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 30, borderRadius: 999, background: T.surface, border: `1px solid ${T.border}`, padding: '10px 14px', boxShadow: '0 18px 42px rgba(2, 6, 23, 0.24)', ...mono, fontSize: 11, color: T.muted }}>
          Syncing backend data...
        </div>
      ) : null}
    </div>
  )
}
