import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  Compass,
  RefreshCw,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAdminRequestDetail,
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
  isVisibleAdminRecord,
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
  formatDate,
  formatDateTime,
  type AdminSectionId,
  type BreadcrumbSegment,
} from './system-admin-ui'
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

type EntityEditorState = {
  academicFaculty: StructureFormState['academicFaculty']
  department: StructureFormState['department']
  branch: StructureFormState['branch']
  batch: StructureFormState['batch']
  term: StructureFormState['term'] & { termId: string }
  curriculum: StructureFormState['curriculum'] & { curriculumCourseId: string }
}

const EMPTY_DATA: LiveAdminDataset = {
  institution: null, academicFaculties: [], departments: [], branches: [], batches: [], terms: [],
  facultyMembers: [], students: [], courses: [], curriculumCourses: [], policyOverrides: [],
  offerings: [], ownerships: [], requests: [],
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

function defaultPolicyForm(): PolicyFormState {
  return {
    oMin: '90', aPlusMin: '80', aMin: '70', bPlusMin: '60', bMin: '55', cMin: '50', pMin: '40',
    ce: '50', see: '50', termTestsWeight: '20', quizWeight: '10', assignmentWeight: '20',
    maxTermTests: '2', maxQuizzes: '2', maxAssignments: '2',
    dayStart: '08:30', dayEnd: '16:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    repeatedCoursePolicy: 'latest-attempt',
  }
}

function defaultEntityEditorState(currentSemester = '1'): EntityEditorState {
  return {
    academicFaculty: { code: '', name: '', overview: '' },
    department: { code: '', name: '' },
    branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' },
    batch: { admissionYear: '2022', batchLabel: '2022', currentSemester, sectionLabels: 'A, B' },
    term: { termId: '', academicYearLabel: '2026-27', semesterNumber: currentSemester, startDate: '2026-08-01', endDate: '2026-12-15' },
    curriculum: { curriculumCourseId: '', semesterNumber: currentSemester, courseCode: '', title: '', credits: '4' },
  }
}

function hydratePolicyForm(policy: ApiResolvedBatchPolicy['effectivePolicy']): PolicyFormState {
  const lookup = Object.fromEntries(policy.gradeBands.map(item => [item.grade, item.minimumMark])) as Record<string, number>
  return {
    oMin: String(lookup.O ?? 90), aPlusMin: String(lookup['A+'] ?? 80), aMin: String(lookup.A ?? 70),
    bPlusMin: String(lookup['B+'] ?? 60), bMin: String(lookup.B ?? 55), cMin: String(lookup.C ?? 50),
    pMin: String(lookup.P ?? 40),
    ce: String(policy.ceSeeSplit.ce), see: String(policy.ceSeeSplit.see),
    termTestsWeight: String(policy.ceComponentCaps.termTestsWeight),
    quizWeight: String(policy.ceComponentCaps.quizWeight),
    assignmentWeight: String(policy.ceComponentCaps.assignmentWeight),
    maxTermTests: String(policy.ceComponentCaps.maxTermTests),
    maxQuizzes: String(policy.ceComponentCaps.maxQuizzes),
    maxAssignments: String(policy.ceComponentCaps.maxAssignments),
    dayStart: policy.workingCalendar.dayStart, dayEnd: policy.workingCalendar.dayEnd,
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
    ceSeeSplit: { ce: Number(form.ce), see: Number(form.see) },
    ceComponentCaps: {
      termTestsWeight: Number(form.termTestsWeight), quizWeight: Number(form.quizWeight),
      assignmentWeight: Number(form.assignmentWeight), maxTermTests: Number(form.maxTermTests),
      maxQuizzes: Number(form.maxQuizzes), maxAssignments: Number(form.maxAssignments),
    },
    workingCalendar: { days: form.workingDays, dayStart: form.dayStart, dayEnd: form.dayEnd },
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted', cgpaModel: 'credit-weighted-cumulative', rounding: '2-decimal',
      includeFailedCredits: false, repeatedCoursePolicy: form.repeatedCoursePolicy,
    },
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof AirMentorApiError) {
    const details = error.details
    if (details && typeof details === 'object') {
      const fieldErrors = 'fieldErrors' in details && details.fieldErrors && typeof details.fieldErrors === 'object'
        ? Object.entries(details.fieldErrors as Record<string, unknown>)
            .flatMap(([field, messages]) => Array.isArray(messages) ? messages.map(message => `${field}: ${String(message)}`) : [])
        : []
      const formErrors = 'formErrors' in details && Array.isArray(details.formErrors)
        ? details.formErrors.map(message => String(message))
        : []
      const combined = [...fieldErrors, ...formErrors].filter(Boolean)
      if (combined.length > 0) return `${error.message}. ${combined.join(' · ')}`
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'The request could not be completed.'
}

function requireText(label: string, value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

function requirePositiveInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive whole number.`)
  return parsed
}

function requireDate(label: string, value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${label} must use YYYY-MM-DD format.`)
  return trimmed
}

function requireRange(label: string, value: string, minimum: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
  return parsed
}

function buildValidatedPolicyPayload(form: PolicyFormState): ApiPolicyPayload {
  const oMin = requireRange('O grade minimum', form.oMin, 0, 100)
  const aPlusMin = requireRange('A+ minimum', form.aPlusMin, 0, 100)
  const aMin = requireRange('A minimum', form.aMin, 0, 100)
  const bPlusMin = requireRange('B+ minimum', form.bPlusMin, 0, 100)
  const bMin = requireRange('B minimum', form.bMin, 0, 100)
  const cMin = requireRange('C minimum', form.cMin, 0, 100)
  const pMin = requireRange('P minimum', form.pMin, 0, 100)
  const ce = requireRange('CE', form.ce, 0, 100)
  const see = requireRange('SEE', form.see, 0, 100)
  const termTestsWeight = requireRange('Term test weight', form.termTestsWeight, 0, 100)
  const quizWeight = requireRange('Quiz weight', form.quizWeight, 0, 100)
  const assignmentWeight = requireRange('Assignment weight', form.assignmentWeight, 0, 100)
  const maxTermTests = requirePositiveInteger('Max term tests', form.maxTermTests)
  const maxQuizzes = requirePositiveInteger('Max quizzes', form.maxQuizzes)
  const maxAssignments = requirePositiveInteger('Max assignments', form.maxAssignments)

  if (ce + see !== 100) throw new Error('CE and SEE must total 100.')
  if (termTestsWeight + quizWeight + assignmentWeight !== ce) {
    throw new Error('Term test, quiz, and assignment weights must total the CE value.')
  }
  if (!(oMin >= aPlusMin && aPlusMin >= aMin && aMin >= bPlusMin && bPlusMin >= bMin && bMin >= cMin && cMin >= pMin)) {
    throw new Error('Grade bands must descend from O down to P without gaps going upward.')
  }

  return buildPolicyPayload({
    ...form,
    oMin: String(oMin),
    aPlusMin: String(aPlusMin),
    aMin: String(aMin),
    bPlusMin: String(bPlusMin),
    bMin: String(bMin),
    cMin: String(cMin),
    pMin: String(pMin),
    ce: String(ce),
    see: String(see),
    termTestsWeight: String(termTestsWeight),
    quizWeight: String(quizWeight),
    assignmentWeight: String(assignmentWeight),
    maxTermTests: String(maxTermTests),
    maxQuizzes: String(maxQuizzes),
    maxAssignments: String(maxAssignments),
  })
}

export function SystemAdminLiveApp({ apiBaseUrl, onExitPortal }: SystemAdminLiveAppProps) {
  const apiClient = useMemo(() => new AirMentorApiClient(apiBaseUrl), [apiBaseUrl])
  const repositories = useMemo(() => createAirMentorRepositories({ repositoryMode: 'http', apiClient }), [apiClient])

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
  const [entityEditors, setEntityEditors] = useState<EntityEditorState>(() => defaultEntityEditorState())
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(() => defaultPolicyForm())
  const [resolvedBatchPolicy, setResolvedBatchPolicy] = useState<ApiResolvedBatchPolicy | null>(null)
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<ApiAdminRequestDetail | null>(null)
  const [requestDetailLoading, setRequestDetailLoading] = useState(false)
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
        try { return await apiClient.getInstitution() } catch (error) {
          if (error instanceof AirMentorApiError && error.status === 404) return null
          throw error
        }
      }
      const [institution, academicFaculties, departments, branches, batches, terms, facultyMembers, students, courses, curriculumCourses, policyOverrides, offerings, ownerships, requests] = await Promise.all([
        safeInstitution(), apiClient.listAcademicFaculties(), apiClient.listDepartments(),
        apiClient.listBranches(), apiClient.listBatches(), apiClient.listTerms(),
        apiClient.listFaculty(), apiClient.listStudents(), apiClient.listCourses(),
        apiClient.listCurriculumCourses(), apiClient.listPolicyOverrides(),
        apiClient.listOfferings(), apiClient.listOfferingOwnership(), apiClient.listAdminRequests(),
      ])
      setData({
        institution, academicFaculties: academicFaculties.items, departments: departments.items,
        branches: branches.items, batches: batches.items, terms: terms.items,
        facultyMembers: facultyMembers.items, students: students.items, courses: courses.items,
        curriculumCourses: curriculumCourses.items, policyOverrides: policyOverrides.items,
        offerings: offerings.items, ownerships: ownerships.items, requests: requests.items,
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
      } catch { if (!cancelled) setSession(null) }
      finally { if (!cancelled) setBooting(false) }
    })()
    return () => { cancelled = true }
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
      } catch (error) { if (!cancelled) setActionError(toErrorMessage(error)) }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, session])

  const selectedRequestSummary = route.requestId ? data.requests.find(item => item.adminRequestId === route.requestId) ?? null : null

  useEffect(() => {
    if (!route.requestId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setSelectedRequestDetail(null)
      setRequestDetailLoading(false)
      return
    }
    let cancelled = false
    setRequestDetailLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getAdminRequest(route.requestId!)
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
  }, [apiClient, route.requestId, selectedRequestSummary?.version, session])

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
  const selectedRequest = selectedRequestDetail && selectedRequestSummary && selectedRequestDetail.version !== selectedRequestSummary.version
    ? selectedRequestSummary
    : (selectedRequestDetail ?? selectedRequestSummary)
  const requestDetail = selectedRequestDetail && selectedRequest?.adminRequestId === selectedRequestDetail.adminRequestId ? selectedRequestDetail : null

  useEffect(() => {
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
  }, [selectedAcademicFaculty?.academicFacultyId, selectedAcademicFaculty?.version])

  useEffect(() => {
    setEntityEditors(prev => ({
      ...prev,
      department: selectedDepartment
        ? {
            code: selectedDepartment.code,
            name: selectedDepartment.name,
          }
        : defaultEntityEditorState().department,
    }))
  }, [selectedDepartment?.departmentId, selectedDepartment?.version])

  useEffect(() => {
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
  }, [selectedBranch?.branchId, selectedBranch?.version])

  useEffect(() => {
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
      term: defaultEntityEditorState(selectedBatch ? String(selectedBatch.currentSemester) : '1').term,
      curriculum: defaultEntityEditorState(selectedBatch ? String(selectedBatch.currentSemester) : '1').curriculum,
    }))
  }, [selectedBatch?.batchId, selectedBatch?.version, selectedBatch?.currentSemester])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      const nextSession = await apiClient.login({ identifier, password })
      setSession(nextSession); setIdentifier(''); setPassword('')
    } catch (error) { setAuthError(toErrorMessage(error)) }
    finally { setAuthBusy(false) }
  }

  const handleLogout = async () => {
    await apiClient.logout()
    setSession(null); setData(EMPTY_DATA)
  }

  const handleSwitchToSystemAdmin = async () => {
    if (!systemAdminGrant) return
    setAuthBusy(true)
    try { const next = await apiClient.switchRoleContext(systemAdminGrant.grantId); setSession(next) }
    catch (error) { setAuthError(toErrorMessage(error)) }
    finally { setAuthBusy(false) }
  }

  const runAction = async (runner: () => Promise<void>) => {
    setActionError('')
    try { await runner(); await loadAdminData() }
    catch (error) { setActionError(toErrorMessage(error)) }
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
      term: defaultEntityEditorState(selectedBatch ? String(selectedBatch.currentSemester) : '1').term,
    }))
  }

  const startEditingCurriculumCourse = (curriculumCourseId: string) => {
    const target = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!target) return
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
      curriculum: defaultEntityEditorState(selectedBatch ? String(selectedBatch.currentSemester) : '1').curriculum,
    }))
  }

  const handleUpdateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: requireText('Faculty code', entityEditors.academicFaculty.code),
        name: requireText('Faculty name', entityEditors.academicFaculty.name),
        overview: entityEditors.academicFaculty.overview.trim() || null,
        status: selectedAcademicFaculty.status,
        version: selectedAcademicFaculty.version,
      })
      setFlashMessage('Academic faculty updated.')
    })
  }

  const handleArchiveAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (facultyDepartments.length > 0) {
      setActionError('Archive or move this faculty’s departments before archiving the academic faculty.')
      return
    }
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'archived',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty archived.')
    })
  }

  const handleUpdateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    await runAction(async () => {
      await apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        code: requireText('Department code', entityEditors.department.code),
        name: requireText('Department name', entityEditors.department.name),
        status: selectedDepartment.status,
        version: selectedDepartment.version,
      })
      setFlashMessage('Department updated.')
    })
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
        status: 'archived',
        version: selectedDepartment.version,
      })
      navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId })
      setFlashMessage('Department archived.')
    })
  }

  const handleUpdateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    await runAction(async () => {
      await apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: requireText('Branch code', entityEditors.branch.code),
        name: requireText('Branch name', entityEditors.branch.name),
        programLevel: requireText('Program level', entityEditors.branch.programLevel),
        semesterCount: requirePositiveInteger('Semester count', entityEditors.branch.semesterCount),
        status: selectedBranch.status,
        version: selectedBranch.version,
      })
      setFlashMessage('Branch updated.')
    })
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
        status: 'archived',
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
    await runAction(async () => {
      const sectionLabels = entityEditors.batch.sectionLabels.split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      await apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', entityEditors.batch.admissionYear),
        batchLabel: requireText('Batch label', entityEditors.batch.batchLabel),
        currentSemester: requirePositiveInteger('Active semester', entityEditors.batch.currentSemester),
        sectionLabels,
        status: selectedBatch.status,
        version: selectedBatch.version,
      })
      setFlashMessage('Batch updated.')
    })
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
        status: 'archived',
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
    await runAction(async () => {
      await apiClient.createAcademicFaculty({
        code: requireText('Faculty code', structureForms.academicFaculty.code),
        name: requireText('Faculty name', structureForms.academicFaculty.name),
        overview: structureForms.academicFaculty.overview.trim() || null,
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, academicFaculty: { code: '', name: '', overview: '' } }))
      setFlashMessage('Academic faculty created.')
    })
  }

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    await runAction(async () => {
      await apiClient.createDepartment({
        academicFacultyId: selectedAcademicFaculty.academicFacultyId,
        code: requireText('Department code', structureForms.department.code),
        name: requireText('Department name', structureForms.department.name),
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, department: { code: '', name: '' } }))
      setFlashMessage('Department created.')
    })
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    await runAction(async () => {
      await apiClient.createBranch({
        departmentId: selectedDepartment.departmentId,
        code: requireText('Branch code', structureForms.branch.code),
        name: requireText('Branch name', structureForms.branch.name),
        programLevel: requireText('Program level', structureForms.branch.programLevel),
        semesterCount: requirePositiveInteger('Semester count', structureForms.branch.semesterCount),
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' } }))
      setFlashMessage('Branch created.')
    })
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    await runAction(async () => {
      const sectionLabels = structureForms.batch.sectionLabels.split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      await apiClient.createBatch({
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', structureForms.batch.admissionYear),
        batchLabel: requireText('Batch label', structureForms.batch.batchLabel),
        currentSemester: requirePositiveInteger('Active semester', structureForms.batch.currentSemester),
        sectionLabels,
        status: 'active',
      })
      setStructureForms(prev => ({ ...prev, batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' } }))
      setFlashMessage('Batch created.')
    })
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
        status: 'archived',
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
      const matchingCourse = data.courses.find(item => item.courseCode.toLowerCase() === entityEditors.curriculum.courseCode.toLowerCase() && isVisibleAdminRecord(item.status)) ?? null
      if (entityEditors.curriculum.curriculumCourseId) {
        const current = data.curriculumCourses.find(item => item.curriculumCourseId === entityEditors.curriculum.curriculumCourseId)
        if (!current) throw new Error('Selected curriculum course could not be found.')
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
        status: 'archived',
        version: current.version,
      })
      if (entityEditors.curriculum.curriculumCourseId === curriculumCourseId) resetCurriculumEditor()
      setFlashMessage('Curriculum course archived.')
    })
  }

  const handleSaveBatchPolicy = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const existing = data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId) ?? null
      const payload = { scopeType: 'batch' as const, scopeId: selectedBatch.batchId, policy: buildValidatedPolicyPayload(policyForm), status: 'active' }
      if (existing) await apiClient.updatePolicyOverride(existing.policyOverrideId, { ...payload, version: existing.version })
      else await apiClient.createPolicyOverride(payload)
      setFlashMessage('Batch policy saved.')
      const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId)
      setResolvedBatchPolicy(nextResolved)
    })
  }

  const handleResetBatchPolicy = async () => {
    if (!selectedBatch) return
    const existing = data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId && isVisibleAdminRecord(item.status)) ?? null
    if (!existing) {
      setFlashMessage('No batch override exists. The batch is already using inherited policy.')
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
      const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId)
      setResolvedBatchPolicy(nextResolved)
      setPolicyForm(hydratePolicyForm(nextResolved.effectivePolicy))
      setFlashMessage('Batch policy override reset to inherited defaults.')
    })
  }

  const handleAdvanceRequest = async (request: ApiAdminRequestSummary) => {
    setRequestBusy(request.adminRequestId)
    try {
      if (request.status === 'New') await apiClient.assignAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Claimed for review.' })
      else if (request.status === 'In Review' || request.status === 'Needs Info') await apiClient.approveAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Approved for implementation.' })
      else if (request.status === 'Approved') await apiClient.markAdminRequestImplemented(request.adminRequestId, { version: request.version, noteBody: 'Implemented from the sysadmin workspace.' })
      else if (request.status === 'Implemented') await apiClient.closeAdminRequest(request.adminRequestId, { version: request.version, noteBody: 'Closed after execution.' })
      await loadAdminData()
      if (route.requestId === request.adminRequestId) {
        const nextDetail = await apiClient.getAdminRequest(request.adminRequestId)
        setSelectedRequestDetail(nextDetail)
      }
      setFlashMessage('Request advanced.')
    } catch (error) { setActionError(toErrorMessage(error)) }
    finally { setRequestBusy('') }
  }

  // --- Breadcrumbs ---
  const breadcrumbs: BreadcrumbSegment[] = []
  if (route.section === 'overview') {
    breadcrumbs.push({ label: 'Overview' })
  } else if (route.section === 'faculties') {
    if (selectedAcademicFaculty) {
      breadcrumbs.push({ label: 'Faculties', onClick: () => navigate({ section: 'faculties' }) })
      if (selectedDepartment) {
        breadcrumbs.push({ label: selectedAcademicFaculty.name, onClick: () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId }) })
        if (selectedBranch) {
          breadcrumbs.push({ label: selectedDepartment.name, onClick: () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: selectedDepartment.departmentId }) })
          if (selectedBatch) {
            breadcrumbs.push({ label: selectedBranch.name, onClick: () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: selectedBranch.branchId }) })
            breadcrumbs.push({ label: `Batch ${selectedBatch.batchLabel}` })
          } else {
            breadcrumbs.push({ label: selectedBranch.name })
          }
        } else {
          breadcrumbs.push({ label: selectedDepartment.name })
        }
      } else {
        breadcrumbs.push({ label: selectedAcademicFaculty.name })
      }
    } else {
      breadcrumbs.push({ label: 'Faculties' })
    }
  } else if (route.section === 'students') {
    breadcrumbs.push({ label: 'Students', onClick: () => navigate({ section: 'students' }) })
    if (selectedStudent) breadcrumbs.push({ label: selectedStudent.name })
  } else if (route.section === 'faculty-members') {
    breadcrumbs.push({ label: 'Faculty Members', onClick: () => navigate({ section: 'faculty-members' }) })
    if (selectedFacultyMember) breadcrumbs.push({ label: selectedFacultyMember.displayName })
  } else if (route.section === 'requests') {
    breadcrumbs.push({ label: 'Requests', onClick: route.requestId ? () => navigate({ section: 'requests' }) : undefined })
    if (selectedRequestSummary) breadcrumbs.push({ label: selectedRequestSummary.summary })
  }

  // --- Boot / auth screens ---
  if (booting) {
    return <PageShell size="narrow" style={{ paddingTop: 48 }}><Card><div style={{ ...mono, fontSize: 11, color: T.muted }}>Restoring system admin session…</div></Card></PageShell>
  }

  if (!session) {
    return (
      <PageShell size="wide" style={{ paddingTop: 40 }}>
        <div style={{ minHeight: 'calc(100vh - 80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
          <Card style={{ padding: 28, background: `radial-gradient(circle at top left, ${T.accent}24, transparent 36%), radial-gradient(circle at bottom right, ${T.success}16, transparent 28%), linear-gradient(160deg, ${T.surface}, ${T.surface2})`, display: 'grid', alignContent: 'space-between', minHeight: 520 }} glow={T.accent}>
            <div style={{ display: 'grid', gap: 18 }}>
              <HeroBadge><Compass size={12} /> System Admin Live Mode</HeroBadge>
              <div>
                <div style={{ ...sora, fontSize: 42, fontWeight: 800, color: T.text, lineHeight: 1.02, maxWidth: 560 }}>Govern curriculum, policy, and year-specific control from one place.</div>
                <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.9, maxWidth: 560 }}>This workspace is connected to the live backend at `{apiBaseUrl}`. Use it for academic faculties, branches, batches, policy overrides, requests, and the student or faculty records that depend on them.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <AuthFeature title="Hierarchy" body="Academic faculty, department, branch, and batch stay aligned so year-wise policy divergence is explicit instead of buried." color={T.accent} />
                <AuthFeature title="Governance" body="CE/SEE limits, grade bands, working calendar, and SGPA or CGPA rules remain centrally controlled but overrideable at the right level." color={T.success} />
                <AuthFeature title="Operations" body="Search, requests, and teaching ownership stay visible together so the sysadmin flow feels like one control plane instead of a setup dead-end." color={T.orange} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
              <div style={{ ...mono, fontSize: 11, color: T.muted }}>Need the teaching workspace instead? Return to the portal selector and sign in as faculty.</div>
              {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}><ChevronLeft size={14} /> Portal Selector</Btn> : null}
            </div>
          </Card>
          <Card style={{ padding: 28, display: 'grid', alignContent: 'center', background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
            <div style={{ ...mono, fontSize: 10, color: T.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Secure Session</div>
            <div style={{ ...sora, fontSize: 28, fontWeight: 800, color: T.text, marginTop: 10 }}>Sign in to manage the live hierarchy.</div>
            <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>Use the seeded sysadmin account or your assigned live admin credentials. Session state and theme preferences are restored automatically after sign-in.</div>
            <form onSubmit={handleLogin} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              <div><FieldLabel>Username Or Email</FieldLabel><TextInput value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="sysadmin" /></div>
              <div><FieldLabel>Password</FieldLabel><TextInput type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" /></div>
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

  // --- Computed ---
  const facultyDepartments = listDepartmentsForAcademicFaculty(data, selectedAcademicFaculty?.academicFacultyId)
  const departmentBranches = listBranchesForDepartment(data, selectedDepartment?.departmentId)
  const branchBatches = listBatchesForBranch(data, selectedBranch?.branchId)
  const batchTerms = listTermsForBatch(data, selectedBatch?.batchId)
  const curriculumBySemester = listCurriculumBySemester(data, selectedBatch?.batchId)
  const selectedFacultyAssignments = selectedFacultyMember ? listFacultyAssignments(data, selectedFacultyMember.facultyId) : []
  const activeBatchPolicyOverride = selectedBatch
    ? data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const visibleAcademicFaculties = data.academicFaculties.filter(item => isVisibleAdminRecord(item.status))
  const visibleDepartments = data.departments.filter(item => isVisibleAdminRecord(item.status))
  const visibleBranches = data.branches.filter(item => isVisibleAdminRecord(item.status))
  const visibleBatches = data.batches.filter(item => isVisibleAdminRecord(item.status))
  const visibleTerms = data.terms.filter(item => isVisibleAdminRecord(item.status))

  // --- Main workspace ---
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <AdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        modeLabel="Live"
        modeColor={T.success}
        breadcrumbs={breadcrumbs}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults.map(r => ({ key: r.key, title: r.label, subtitle: r.meta, onSelect: () => { setSearchQuery(''); navigate(r.route) } }))}
        activeSection={route.section as AdminSectionId}
        onSectionChange={section => navigate({ section: section as LiveAdminRoute['section'] })}
        themeMode={themeMode}
        onThemeToggle={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}
        extraActions={
          <>
            {onExitPortal ? <Btn variant="ghost" onClick={onExitPortal}>Portal</Btn> : null}
            <Btn variant="ghost" onClick={() => void loadAdminData()}><RefreshCw size={14} /> Refresh</Btn>
            <Btn variant="ghost" onClick={handleLogout}>Log Out</Btn>
          </>
        }
      />

      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <SectionHeading title="System Admin Dashboard" eyebrow="Live Mode" caption="Search-first academic configuration. Everything is managed from the main dashboard." />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <MetricCard label="Academic Faculties" value={String(visibleAcademicFaculties.length)} helper="Top-level schools or colleges above departments." onClick={() => navigate({ section: 'faculties' })} />
              <MetricCard label="Departments" value={String(visibleDepartments.length)} helper="Administrative owners beneath academic faculties." onClick={() => navigate({ section: 'faculties' })} />
              <MetricCard label="Batches" value={String(visibleBatches.length)} helper="Curriculum and policy versioning nodes per branch." onClick={() => navigate({ section: 'faculties' })} />
              <MetricCard label="Open Requests" value={String(data.requests.filter(item => item.status !== 'Closed').length)} helper="HoD-driven changes moving through implementation." onClick={() => navigate({ section: 'requests' })} />
            </div>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>Hierarchy</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>{data.institution?.name ?? 'Institution not configured'} currently has {visibleAcademicFaculties.length} academic faculties, {visibleBranches.length} branches, and {visibleTerms.length} active academic terms.</div>
              </Card>
              <Card style={{ padding: 18 }}>
                <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>Faculty Assignments</div>
                <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6 }}>There are {data.ownerships.filter(item => item.status === 'active').length} active class ownership records linked to {data.facultyMembers.length} faculty members.</div>
              </Card>
            </div>
          </div>
        )}

        {/* ========== FACULTIES (tree explorer + detail) ========== */}
        {route.section === 'faculties' && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
            {/* Tree explorer */}
            <Card style={{ padding: 16, display: 'grid', gap: 8, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hierarchy</div>
              {visibleAcademicFaculties.map(fac => {
                const facDepts = listDepartmentsForAcademicFaculty(data, fac.academicFacultyId)
                const isExpanded = selectedAcademicFaculty?.academicFacultyId === fac.academicFacultyId
                return (
                  <div key={fac.academicFacultyId}>
                    <EntityButton selected={isExpanded && !selectedDepartment} onClick={() => navigate({ section: 'faculties', academicFacultyId: fac.academicFacultyId })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{fac.name}</div>
                        <Chip color={T.dim}>{facDepts.length}</Chip>
                      </div>
                    </EntityButton>
                    {isExpanded && facDepts.map(dept => {
                      const deptBranches = listBranchesForDepartment(data, dept.departmentId)
                      const isDeptExpanded = selectedDepartment?.departmentId === dept.departmentId
                      return (
                        <div key={dept.departmentId} style={{ paddingLeft: 14 }}>
                          <EntityButton selected={isDeptExpanded && !selectedBranch} onClick={() => navigate({ section: 'faculties', academicFacultyId: fac.academicFacultyId, departmentId: dept.departmentId })} style={{ marginTop: 6 }}>
                            <div style={{ ...mono, fontSize: 11, color: T.text }}>{dept.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{dept.code} · {deptBranches.length} branches</div>
                          </EntityButton>
                          {isDeptExpanded && deptBranches.map(br => {
                            const brBatches = listBatchesForBranch(data, br.branchId)
                            const isBrExpanded = selectedBranch?.branchId === br.branchId
                            return (
                              <div key={br.branchId} style={{ paddingLeft: 14 }}>
                                <EntityButton selected={isBrExpanded && !selectedBatch} onClick={() => navigate({ section: 'faculties', academicFacultyId: fac.academicFacultyId, departmentId: dept.departmentId, branchId: br.branchId })} style={{ marginTop: 6 }}>
                                  <div style={{ ...mono, fontSize: 11, color: T.text }}>{br.name}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{br.code} · {br.programLevel} · {brBatches.length} batches</div>
                                </EntityButton>
                                {isBrExpanded && brBatches.map(bt => (
                                  <div key={bt.batchId} style={{ paddingLeft: 14 }}>
                                    <EntityButton selected={selectedBatch?.batchId === bt.batchId} onClick={() => navigate({ section: 'faculties', academicFacultyId: fac.academicFacultyId, departmentId: dept.departmentId, branchId: br.branchId, batchId: bt.batchId })} style={{ marginTop: 6 }}>
                                      <div style={{ ...mono, fontSize: 11, color: T.text }}>Batch {bt.batchLabel}</div>
                                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 2 }}>{deriveCurrentYearLabel(bt.currentSemester)} · Sem {bt.currentSemester}</div>
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
              <form onSubmit={handleCreateAcademicFaculty} style={{ display: 'grid', gap: 8, marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Faculty</div>
                <TextInput value={structureForms.academicFaculty.code} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" />
                <TextInput value={structureForms.academicFaculty.name} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" />
                <TextAreaInput value={structureForms.academicFaculty.overview} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} placeholder="Overview" rows={2} />
                <Btn type="submit">Add Academic Faculty</Btn>
              </form>
            </Card>

            {/* Right: detail panel */}
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              {!selectedAcademicFaculty && (
                <>
                  <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select an academic faculty in the tree to begin, or create one below." />
                </>
              )}

              {selectedAcademicFaculty && !selectedDepartment && (
                <Card style={{ padding: 18 }}>
                  <SectionHeading title={selectedAcademicFaculty.name} eyebrow="Academic Faculty" caption="Edit the faculty record, then add or organize departments underneath it." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedAcademicFaculty.code}</Chip>
                    <Chip color={T.success}>{facultyDepartments.length} departments</Chip>
                  </div>
                  <form onSubmit={handleUpdateAcademicFaculty} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <div><FieldLabel>Faculty Code</FieldLabel><TextInput aria-label="Faculty Code" value={entityEditors.academicFaculty.code} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" /></div>
                    <div><FieldLabel>Faculty Name</FieldLabel><TextInput aria-label="Faculty Name" value={entityEditors.academicFaculty.name} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" /></div>
                    <div><FieldLabel>Overview</FieldLabel><TextAreaInput aria-label="Faculty Overview" value={entityEditors.academicFaculty.overview} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} rows={3} placeholder="Overview" /></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Save Faculty</Btn>
                      <Btn type="button" variant="danger" onClick={() => void handleArchiveAcademicFaculty()}>Archive Faculty</Btn>
                    </div>
                  </form>
                  <form onSubmit={handleCreateDepartment} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
                    <div><FieldLabel>Department Code</FieldLabel><TextInput value={structureForms.department.code} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" /></div>
                    <div><FieldLabel>Department Name</FieldLabel><TextInput value={structureForms.department.name} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" /></div>
                    <Btn type="submit">Add Department</Btn>
                  </form>
                </Card>
              )}

              {selectedDepartment && !selectedBranch && (
                <Card style={{ padding: 18 }}>
                  <SectionHeading title={selectedDepartment.name} eyebrow="Department" caption="Edit the department record, then create or reorganize the branches it owns." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedDepartment.code}</Chip>
                    <Chip color={T.success}>{departmentBranches.length} branches</Chip>
                  </div>
                  <form onSubmit={handleUpdateDepartment} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <div><FieldLabel>Department Code</FieldLabel><TextInput aria-label="Department Code" value={entityEditors.department.code} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" /></div>
                    <div><FieldLabel>Department Name</FieldLabel><TextInput aria-label="Department Name" value={entityEditors.department.name} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" /></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Save Department</Btn>
                      <Btn type="button" variant="danger" onClick={() => void handleArchiveDepartment()}>Archive Department</Btn>
                    </div>
                  </form>
                  <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Branch</div>
                    <div><FieldLabel>Branch Code</FieldLabel><TextInput value={structureForms.branch.code} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} placeholder="CSE-AI" /></div>
                    <div><FieldLabel>Branch Name</FieldLabel><TextInput value={structureForms.branch.name} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} placeholder="AI and Data Science" /></div>
                    <div><FieldLabel>Program Level</FieldLabel><SelectInput value={structureForms.branch.programLevel} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}>
                      <option value="UG">UG</option><option value="PG">PG</option>
                    </SelectInput></div>
                    <div><FieldLabel>Semester Count</FieldLabel><TextInput value={structureForms.branch.semesterCount} onChange={event => setStructureForms(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} placeholder="8" /></div>
                    <Btn type="submit">Add Branch</Btn>
                  </form>
                </Card>
              )}

              {selectedBranch && !selectedBatch && (
                <Card style={{ padding: 18 }}>
                  <SectionHeading title={selectedBranch.name} eyebrow="Branch" caption="Edit core branch metadata, then add or maintain the batch versions that inherit from it." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedBranch.code}</Chip>
                    <Chip color={T.warning}>{selectedBranch.programLevel}</Chip>
                    <Chip color={T.success}>{branchBatches.length} batches</Chip>
                  </div>
                  <form onSubmit={handleUpdateBranch} style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <div><FieldLabel>Branch Code</FieldLabel><TextInput aria-label="Branch Code" value={entityEditors.branch.code} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} placeholder="CSE-AI" /></div>
                    <div><FieldLabel>Branch Name</FieldLabel><TextInput aria-label="Branch Name" value={entityEditors.branch.name} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} placeholder="AI and Data Science" /></div>
                    <div><FieldLabel>Program Level</FieldLabel><SelectInput aria-label="Branch Program Level" value={entityEditors.branch.programLevel} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}>
                      <option value="UG">UG</option><option value="PG">PG</option>
                    </SelectInput></div>
                    <div><FieldLabel>Semester Count</FieldLabel><TextInput aria-label="Branch Semester Count" value={entityEditors.branch.semesterCount} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} placeholder="8" /></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Save Branch</Btn>
                      <Btn type="button" variant="danger" onClick={() => void handleArchiveBranch()}>Archive Branch</Btn>
                    </div>
                  </form>
                  <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
                    <div><FieldLabel>Admission Year</FieldLabel><TextInput value={structureForms.batch.admissionYear} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value, batchLabel: event.target.value } }))} placeholder="2022" /></div>
                    <div><FieldLabel>Active Semester</FieldLabel><TextInput value={structureForms.batch.currentSemester} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} placeholder="5" /></div>
                    <div><FieldLabel>Section Labels</FieldLabel><TextInput value={structureForms.batch.sectionLabels} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" /></div>
                    <Btn type="submit">Add Batch</Btn>
                  </form>
                </Card>
              )}

              {selectedBatch && (
                <Card style={{ padding: 18 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Chip color={T.success}>Batch {selectedBatch.batchLabel}</Chip>
                    <Chip color={T.accent}>Sem {selectedBatch.currentSemester}</Chip>
                    <Chip color={T.warning}>{deriveCurrentYearLabel(selectedBatch.currentSemester)}</Chip>
                    <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Local Policy Override' : 'Inherited Policy'}</Chip>
                  </div>

                  <SectionHeading title="Batch Configuration" eyebrow="Settings" caption="Edit the batch identity, active semester, and sections before adjusting policy, terms, or curriculum." />
                  <form onSubmit={handleUpdateBatch} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 14 }}>
                    <div><FieldLabel>Admission Year</FieldLabel><TextInput aria-label="Batch Admission Year" value={entityEditors.batch.admissionYear} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value } }))} /></div>
                    <div><FieldLabel>Batch Label</FieldLabel><TextInput aria-label="Batch Label" value={entityEditors.batch.batchLabel} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, batchLabel: event.target.value } }))} /></div>
                    <div><FieldLabel>Active Semester</FieldLabel><TextInput aria-label="Batch Active Semester" value={entityEditors.batch.currentSemester} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} /></div>
                    <div><FieldLabel>Section Labels</FieldLabel><TextInput aria-label="Batch Section Labels" value={entityEditors.batch.sectionLabels} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" /></div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Save Batch</Btn>
                      <Btn type="button" variant="danger" onClick={() => void handleArchiveBatch()}>Archive Batch</Btn>
                    </div>
                  </form>

                  {resolvedBatchPolicy ? (
                    <div style={{ marginTop: 18 }}>
                      <InfoBanner message={`Resolved from ${resolvedBatchPolicy.scopeChain.map(item => item.scopeType).join(' -> ')}. Applied overrides: ${resolvedBatchPolicy.appliedOverrides.map(item => item.scopeType).join(', ') || 'institution default only'}.`} />
                    </div>
                  ) : null}

                  <div style={{ marginTop: 18 }}>
                    <SectionHeading title="Batch Policy Override" eyebrow="Governance" caption="Adjust grading bands and operational limits here, or reset the batch back to inherited defaults." />
                  </div>

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 14 }}>
                    <div><FieldLabel>O Grade Min</FieldLabel><TextInput value={policyForm.oMin} onChange={event => setPolicyForm(prev => ({ ...prev, oMin: event.target.value }))} /></div>
                    <div><FieldLabel>A+ Min</FieldLabel><TextInput value={policyForm.aPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, aPlusMin: event.target.value }))} /></div>
                    <div><FieldLabel>A Min</FieldLabel><TextInput value={policyForm.aMin} onChange={event => setPolicyForm(prev => ({ ...prev, aMin: event.target.value }))} /></div>
                    <div><FieldLabel>B+ Min</FieldLabel><TextInput value={policyForm.bPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, bPlusMin: event.target.value }))} /></div>
                    <div><FieldLabel>B Min</FieldLabel><TextInput value={policyForm.bMin} onChange={event => setPolicyForm(prev => ({ ...prev, bMin: event.target.value }))} /></div>
                    <div><FieldLabel>C Min</FieldLabel><TextInput value={policyForm.cMin} onChange={event => setPolicyForm(prev => ({ ...prev, cMin: event.target.value }))} /></div>
                    <div><FieldLabel>P Min</FieldLabel><TextInput value={policyForm.pMin} onChange={event => setPolicyForm(prev => ({ ...prev, pMin: event.target.value }))} /></div>
                    <div><FieldLabel>CE / SEE</FieldLabel><TextInput value={`${policyForm.ce} / ${policyForm.see}`} readOnly /></div>
                    <div><FieldLabel>CE</FieldLabel><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></div>
                    <div><FieldLabel>SEE</FieldLabel><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></div>
                    <div><FieldLabel>TT Weight</FieldLabel><TextInput value={policyForm.termTestsWeight} onChange={event => setPolicyForm(prev => ({ ...prev, termTestsWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Quiz Weight</FieldLabel><TextInput value={policyForm.quizWeight} onChange={event => setPolicyForm(prev => ({ ...prev, quizWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Asgn Weight</FieldLabel><TextInput value={policyForm.assignmentWeight} onChange={event => setPolicyForm(prev => ({ ...prev, assignmentWeight: event.target.value }))} /></div>
                    <div><FieldLabel>Max TTs</FieldLabel><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></div>
                    <div><FieldLabel>Max Quizzes</FieldLabel><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></div>
                    <div><FieldLabel>Max Asgn</FieldLabel><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></div>
                    <div><FieldLabel>Day Start</FieldLabel><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></div>
                    <div><FieldLabel>Day End</FieldLabel><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Working Days</FieldLabel>
                      <DayToggle days={WEEKDAYS} selected={policyForm.workingDays} onChange={next => setPolicyForm(prev => ({ ...prev, workingDays: next as PolicyFormState['workingDays'] }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Repeat Course Policy</FieldLabel>
                      <SelectInput value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))}>
                        <option value="latest-attempt">Latest attempt</option><option value="best-attempt">Best attempt</option>
                      </SelectInput>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn onClick={handleSaveBatchPolicy}><CheckCircle2 size={14} /> Save Batch Policy</Btn>
                    <Btn variant="ghost" onClick={() => void handleResetBatchPolicy()}>Reset To Inherited</Btn>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <SectionHeading title="Academic Terms" eyebrow="Calendar" caption="Terms tie a batch to a semester instance." />
                    {batchTerms.map(term => (
                      <Card key={term.termId} style={{ padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ ...mono, fontSize: 11, color: T.text }}>Semester {term.semesterNumber} · {term.academicYearLabel}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(term.startDate)} to {formatDate(term.endDate)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn size="sm" variant="ghost" onClick={() => startEditingTerm(term.termId)}>Edit</Btn>
                            <Btn size="sm" variant="danger" onClick={() => void handleArchiveTerm(term.termId)}>Delete</Btn>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <form onSubmit={handleSaveTerm} style={{ display: 'grid', gap: 10 }}>
                      <div><FieldLabel>Academic Year Label</FieldLabel><TextInput aria-label="Term Academic Year Label" value={entityEditors.term.academicYearLabel} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, academicYearLabel: event.target.value } }))} placeholder="2026-27" /></div>
                      <div><FieldLabel>Semester Number</FieldLabel><TextInput aria-label="Term Semester Number" value={entityEditors.term.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, semesterNumber: event.target.value } }))} placeholder="5" /></div>
                      <div><FieldLabel>Start Date</FieldLabel><TextInput aria-label="Term Start Date" value={entityEditors.term.startDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, startDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></div>
                      <div><FieldLabel>End Date</FieldLabel><TextInput aria-label="Term End Date" value={entityEditors.term.endDate} onChange={event => setEntityEditors(prev => ({ ...prev, term: { ...prev.term, endDate: event.target.value } }))} placeholder="YYYY-MM-DD" /></div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{entityEditors.term.termId ? 'Save Term' : 'Add Term'}</Btn>
                        {entityEditors.term.termId ? <Btn type="button" variant="ghost" onClick={resetTermEditor}>Cancel Edit</Btn> : null}
                      </div>
                    </form>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <SectionHeading title="Semester Curriculum" eyebrow="Courses" caption="Curriculum rows hold the exact course code, title, and credits for each batch-semester." />
                    {curriculumBySemester.map(entry => (
                      <Card key={entry.semesterNumber} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>Semester {entry.semesterNumber}</div>
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                          {entry.courses.map(course => (
                            <div key={course.curriculumCourseId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...mono, fontSize: 11, color: T.text }}>{course.courseCode} · {course.title}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{course.credits} credits</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn size="sm" variant="ghost" onClick={() => startEditingCurriculumCourse(course.curriculumCourseId)}>Edit</Btn>
                                <Btn size="sm" variant="danger" onClick={() => void handleArchiveCurriculumCourse(course.curriculumCourseId)}>Delete</Btn>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    <form onSubmit={handleSaveCurriculumCourse} style={{ display: 'grid', gap: 10 }}>
                      <div><FieldLabel>Semester Number</FieldLabel><TextInput aria-label="Curriculum Semester Number" value={entityEditors.curriculum.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, semesterNumber: event.target.value } }))} placeholder="Semester" /></div>
                      <div><FieldLabel>Course Code</FieldLabel><TextInput aria-label="Curriculum Course Code" value={entityEditors.curriculum.courseCode} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, courseCode: event.target.value } }))} placeholder="CS699" /></div>
                      <div><FieldLabel>Course Title</FieldLabel><TextInput aria-label="Curriculum Course Title" value={entityEditors.curriculum.title} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, title: event.target.value } }))} placeholder="Advanced Governance Systems" /></div>
                      <div><FieldLabel>Credits</FieldLabel><TextInput aria-label="Curriculum Credits" value={entityEditors.curriculum.credits} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, credits: event.target.value } }))} placeholder="4" /></div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{entityEditors.curriculum.curriculumCourseId ? 'Save Curriculum Course' : 'Add Curriculum Course'}</Btn>
                        {entityEditors.curriculum.curriculumCourseId ? <Btn type="button" variant="ghost" onClick={resetCurriculumEditor}>Cancel Edit</Btn> : null}
                      </div>
                    </form>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ========== STUDENTS ========== */}
        {route.section === 'students' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)' }}>
            <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading title="Students" eyebrow="Registry" caption="Canonical student identity, academic context, mentor linkage, and CGPA." />
              {data.students.map(student => (
                <EntityButton key={student.studentId} selected={route.studentId === student.studentId} onClick={() => navigate({ section: 'students', studentId: student.studentId })}>
                  <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{student.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{student.usn} · {student.activeAcademicContext?.departmentName ?? 'No department'}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.success, marginTop: 4 }}>CGPA {student.currentCgpa.toFixed(2)}</div>
                </EntityButton>
              ))}
            </Card>
            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start' }}>
              {!selectedStudent ? <EmptyState title="Select a student" body="Choose a student to inspect their academic context." /> : (
                <>
                  <SectionHeading title="Student Detail" eyebrow={selectedStudent.name} caption="Academic context, mentor linkage, and enrollment trail." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                    <Chip color={T.success}>CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                    <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Email: {selectedStudent.email ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Phone: {selectedStudent.phone ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Batch: {selectedStudent.activeAcademicContext?.batchLabel ?? 'Not mapped'} · Semester {selectedStudent.activeAcademicContext?.semesterNumber ?? '—'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Mentor: <button type="button" onClick={() => { if (selectedStudent.activeMentorAssignment?.facultyId) navigate({ section: 'faculty-members', facultyMemberId: selectedStudent.activeMentorAssignment.facultyId }) }} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{resolveFacultyMember(data, selectedStudent.activeMentorAssignment?.facultyId)?.displayName ?? 'Not assigned'}</button></div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enrollment Trail</div>
                    {selectedStudent.enrollments.map(enrollment => (
                      <Card key={enrollment.enrollmentId} style={{ padding: 12 }}>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{enrollment.termId} · Section {enrollment.sectionCode}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(enrollment.startDate)} · {enrollment.academicStatus}</div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* ========== FACULTY MEMBERS ========== */}
        {route.section === 'faculty-members' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 420px) minmax(360px, 1fr)' }}>
            <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading title="Faculty Members" eyebrow="People" caption="Permissions and teaching ownership stay separate." />
              {data.facultyMembers.map(item => {
                const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(item))
                return (
                  <EntityButton key={item.facultyId} selected={route.facultyMemberId === item.facultyId} onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.facultyId })}>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.displayName}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No primary department'}</div>
                  </EntityButton>
                )
              })}
            </Card>
            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start' }}>
              {!selectedFacultyMember ? <EmptyState title="Select a faculty member" body="Review permissions and assigned classes." /> : (
                <>
                  <SectionHeading title="Faculty Detail" eyebrow={selectedFacultyMember.displayName} caption="Permissions, appointments, and assigned classes." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedFacultyMember.roleGrants.map(item => <Chip key={item.grantId} color={T.accent}>{item.roleCode}</Chip>)}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Email: {selectedFacultyMember.email}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Phone: {selectedFacultyMember.phone ?? 'Not set'}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.text }}>Primary Department: <button type="button" onClick={() => { const deptId = getPrimaryAppointmentDepartmentId(selectedFacultyMember); if (deptId) { const dept = resolveDepartment(data, deptId); if (dept) navigate({ section: 'faculties', academicFacultyId: dept.academicFacultyId ?? undefined, departmentId: deptId }) } }} style={{ ...mono, fontSize: 11, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{resolveDepartment(data, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'Not set'}</button></div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
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
              )}
            </Card>
          </div>
        )}

        {/* ========== REQUESTS ========== */}
        {route.section === 'requests' && (
          <>
            <SectionHeading title="Requests" eyebrow="Workflow" caption="HoD-issued permanent changes move through admin review, approval, implementation, and closure." />
            <div style={{ display: 'grid', gridTemplateColumns: '0.96fr 1.04fr', gap: 16, alignItems: 'start' }}>
              <Card style={{ padding: 18, display: 'grid', gap: 10, alignContent: 'start' }}>
                {data.requests.map(request => (
                  <EntityButton key={request.adminRequestId} selected={route.requestId === request.adminRequestId} onClick={() => navigate({ section: 'requests', requestId: request.adminRequestId })}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ ...mono, fontSize: 11, color: T.text }}>{request.summary}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{request.requestType} · {request.scopeType}:{request.scopeId} · due {formatDateTime(request.dueAt)}</div>
                      </div>
                      <Chip color={request.status === 'Closed' ? T.dim : request.status === 'Implemented' ? T.success : T.warning}>{request.status}</Chip>
                    </div>
                  </EntityButton>
                ))}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>
                {!route.requestId ? (
                  <EmptyState title="Select a request" body="Choose a request from the left to inspect details, linked targets, and implementation status." />
                ) : requestDetailLoading && !selectedRequest ? (
                  <InfoBanner message="Loading request details…" />
                ) : !selectedRequest ? (
                  <EmptyState title="Request not found" body="The selected request could not be loaded. Refresh the workspace or choose another request." />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>{selectedRequest.summary}</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted, marginTop: 6, maxWidth: 720 }}>{selectedRequest.details}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip color={selectedRequest.status === 'Closed' ? T.dim : selectedRequest.status === 'Implemented' ? T.success : T.warning}>{selectedRequest.status}</Chip>
                        {['New', 'In Review', 'Needs Info', 'Approved', 'Implemented'].includes(selectedRequest.status) ? (
                          <Btn onClick={() => void handleAdvanceRequest(selectedRequest)} disabled={requestBusy === selectedRequest.adminRequestId}>
                            {selectedRequest.status === 'New' ? 'Take Review' : selectedRequest.status === 'Approved' ? 'Mark Implemented' : selectedRequest.status === 'Implemented' ? 'Close' : 'Approve'}
                          </Btn>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Request Type: <span style={{ color: T.text }}>{selectedRequest.requestType}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Priority: <span style={{ color: T.text }}>{selectedRequest.priority}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Requester: <span style={{ color: T.text }}>{selectedRequest.requesterName ?? selectedRequest.requestedByFacultyId}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Current Owner: <span style={{ color: T.text }}>{selectedRequest.ownerName ?? selectedRequest.ownedByFacultyId ?? 'Unassigned'}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Due: <span style={{ color: T.text }}>{formatDateTime(selectedRequest.dueAt)}</span></div>
                      <div style={{ ...mono, fontSize: 11, color: T.muted }}>Updated: <span style={{ color: T.text }}>{formatDateTime(selectedRequest.updatedAt)}</span></div>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Linked Targets</div>
                      {selectedRequest.targetEntityRefs.length === 0 ? (
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>No explicit target entities were attached to this request.</div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {selectedRequest.targetEntityRefs.map(ref => (
                            <Chip key={`${ref.entityType}:${ref.entityId}`} color={T.accent}>{ref.entityType}:{ref.entityId}</Chip>
                          ))}
                        </div>
                      )}
                    </div>

                    {requestDetail && requestDetail.transitions.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status History</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {requestDetail.transitions.map(transition => (
                            <Card key={transition.transitionId} style={{ padding: 12 }}>
                              <div style={{ ...mono, fontSize: 11, color: T.text }}>{transition.previousStatus ?? 'Start'} {'->'} {transition.nextStatus}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                {transition.actorRole}{transition.actorFacultyId ? ` · ${transition.actorFacultyId}` : ''} · {formatDateTime(transition.createdAt)}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {requestDetail && requestDetail.notes.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {requestDetail.notes.map(note => (
                            <Card key={note.noteId} style={{ padding: 12 }}>
                              <div style={{ ...mono, fontSize: 11, color: T.text }}>{note.body}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                {note.authorRole}{note.authorFacultyId ? ` · ${note.authorFacultyId}` : ''} · {formatDateTime(note.createdAt)}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </Card>
            </div>
          </>
        )}

        {dataLoading ? <InfoBanner message="Refreshing live admin data…" /> : null}
      </PageShell>
    </div>
  )
}
