import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  UserCog,
  Users,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAuditEvent,
  ApiAdminFacultyCalendar,
  ApiFacultyAppointment,
  ApiMentorAssignment,
  ApiAdminRequestDetail,
  ApiAdminSearchResult,
  ApiAdminRequestSummary,
  ApiOfferingOwnership,
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
  ApiRoleCode,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiStudentEnrollment,
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
  AuthFeature,
  DayToggle,
  EmptyState,
  EntityButton,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  SectionHeading,
  SelectInput,
  TextAreaInput,
  TextInput,
  formatDate,
  formatDateTime,
} from './system-admin-ui'
import { applyThemePreset, isLightTheme } from './theme'
import { SystemAdminTimetableEditor } from './system-admin-timetable-editor'
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
  passMarkPercent: string
  minimumCgpaForPromotion: string
  requireNoActiveBacklogs: boolean
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

type StudentFormState = {
  usn: string
  rollNumber: string
  name: string
  email: string
  phone: string
  admissionDate: string
}

type EnrollmentFormState = {
  enrollmentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: string
  academicStatus: string
  startDate: string
  endDate: string
}

type MentorAssignmentFormState = {
  assignmentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string
  source: string
}

type FacultyFormState = {
  username: string
  password: string
  email: string
  phone: string
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string
}

type AppointmentFormState = {
  appointmentId: string
  departmentId: string
  branchId: string
  isPrimary: boolean
  startDate: string
  endDate: string
}

type RoleGrantFormState = {
  grantId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string
}

type OwnershipFormState = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
}

type AdminWorkspaceSnapshot = {
  route: LiveAdminRoute
  universityTab: 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'courses'
  selectedSectionCode: string | null
  scrollY: number
}

type UniversityScopeState = {
  academicFacultyId: string | null
  departmentId: string | null
  branchId: string | null
  batchId: string | null
  sectionCode: string | null
  label: string
}

const EMPTY_DATA: LiveAdminDataset = {
  institution: null, academicFaculties: [], departments: [], branches: [], batches: [], terms: [],
  facultyMembers: [], students: [], courses: [], curriculumCourses: [], policyOverrides: [],
  offerings: [], ownerships: [], requests: [], reminders: [],
}

const WEEKDAYS: PolicyFormState['workingDays'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ADMIN_SECTION_TONES = {
  overview: T.accent,
  faculties: T.success,
  students: T.blue,
  'faculty-members': T.orange,
  requests: T.warning,
  history: T.danger,
} as const
const DEFAULT_PROGRESSION_RULES = {
  passMarkPercent: 40,
  minimumCgpaForPromotion: 5,
  requireNoActiveBacklogs: true,
}

function parseAdminRoute(hash: string): LiveAdminRoute {
  const cleaned = hash.replace(/^#\/admin/, '').replace(/^\/+/, '')
  if (!cleaned) return { section: 'overview' }
  const parts = cleaned.split('/').filter(Boolean)
  if (parts[0] === 'overview') return { section: 'overview' }
  if (parts[0] === 'students') return { section: 'students', studentId: parts[1] }
  if (parts[0] === 'faculty-members') return { section: 'faculty-members', facultyMemberId: parts[1] }
  if (parts[0] === 'requests') return { section: 'requests', requestId: parts[1] }
  if (parts[0] === 'history') return { section: 'history' }
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
  if (route.section === 'history') return '#/admin/history'
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
    passMarkPercent: '40',
    minimumCgpaForPromotion: '5.0',
    requireNoActiveBacklogs: true,
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

function defaultStudentForm(): StudentFormState {
  return {
    usn: '',
    rollNumber: '',
    name: '',
    email: '',
    phone: '',
    admissionDate: new Date().toISOString().slice(0, 10),
  }
}

function defaultEnrollmentForm(): EnrollmentFormState {
  return {
    enrollmentId: '',
    branchId: '',
    termId: '',
    sectionCode: 'A',
    rosterOrder: '0',
    academicStatus: 'regular',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

function defaultMentorAssignmentForm(): MentorAssignmentFormState {
  return {
    assignmentId: '',
    facultyId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    source: 'sysadmin-manual',
  }
}

function defaultFacultyForm(): FacultyFormState {
  return {
    username: '',
    password: '',
    email: '',
    phone: '',
    employeeCode: '',
    displayName: '',
    designation: '',
    joinedOn: '',
  }
}

function defaultAppointmentForm(): AppointmentFormState {
  return {
    appointmentId: '',
    departmentId: '',
    branchId: '',
    isPrimary: false,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

function defaultRoleGrantForm(): RoleGrantFormState {
  return {
    grantId: '',
    roleCode: 'MENTOR',
    scopeType: 'department',
    scopeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

function defaultOwnershipForm(): OwnershipFormState {
  return {
    ownershipId: '',
    offeringId: '',
    facultyId: '',
    ownershipRole: 'owner',
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
    passMarkPercent: String(policy.progressionRules.passMarkPercent),
    minimumCgpaForPromotion: String(policy.progressionRules.minimumCgpaForPromotion),
    requireNoActiveBacklogs: policy.progressionRules.requireNoActiveBacklogs,
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
    progressionRules: {
      passMarkPercent: Number(form.passMarkPercent),
      minimumCgpaForPromotion: Number(form.minimumCgpaForPromotion),
      requireNoActiveBacklogs: form.requireNoActiveBacklogs,
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

function requirePositiveEvenInteger(label: string, value: string) {
  const parsed = requirePositiveInteger(label, value)
  if (parsed % 2 !== 0) throw new Error(`${label} must be an even whole number.`)
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
  const passMarkPercent = requireRange('Pass mark percent', form.passMarkPercent, 0, 100)
  const minimumCgpaForPromotion = requireRange('Minimum CGPA for promotion', form.minimumCgpaForPromotion, 0, 10)

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
    passMarkPercent: String(passMarkPercent),
    minimumCgpaForPromotion: String(minimumCgpaForPromotion),
  })
}

function formatClockLabel(now: Date) {
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isLeaderLikeOwnership(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized.includes('course') || normalized.includes('leader') || normalized.includes('owner') || normalized.includes('primary')
}

function isCurrentRoleGrant(grant: ApiRoleGrant) {
  return grant.status === 'active'
}

function findLatestEnrollment(student: { enrollments: ApiStudentEnrollment[]; activeAcademicContext: { enrollmentId: string } | null }) {
  return student.enrollments.find(item => item.enrollmentId === student.activeAcademicContext?.enrollmentId)
    ?? [...student.enrollments].sort((left, right) => right.startDate.localeCompare(left.startDate))[0]
    ?? null
}

function findLatestMentorAssignment(student: { mentorAssignments: ApiMentorAssignment[]; activeMentorAssignment: ApiMentorAssignment | null }) {
  return student.activeMentorAssignment
    ?? [...student.mentorAssignments].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    ?? null
}

function summarizeAuditEvent(event: ApiAuditEvent) {
  const action = event.action.replace(/[_-]+/g, ' ')
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function getAuditEventRoute(event: ApiAuditEvent): LiveAdminRoute | null {
  if (event.entityType === 'Student' || event.entityType === 'StudentEnrollment' || event.entityType === 'MentorAssignment') {
    const studentId = event.entityType === 'Student'
      ? event.entityId
      : typeof event.after === 'object' && event.after && 'studentId' in event.after
        ? String((event.after as { studentId?: unknown }).studentId ?? '')
        : typeof event.before === 'object' && event.before && 'studentId' in event.before
          ? String((event.before as { studentId?: unknown }).studentId ?? '')
          : ''
    return studentId ? { section: 'students', studentId } : null
  }
  if (event.entityType === 'FacultyProfile' || event.entityType === 'FacultyAppointment' || event.entityType === 'RoleGrant' || event.entityType === 'faculty_offering_ownership' || event.entityType === 'FacultyTimetableAdmin') {
    const facultyMemberId = event.entityType === 'FacultyProfile' || event.entityType === 'FacultyTimetableAdmin'
      ? event.entityId
      : typeof event.after === 'object' && event.after && 'facultyId' in event.after
        ? String((event.after as { facultyId?: unknown }).facultyId ?? '')
        : typeof event.before === 'object' && event.before && 'facultyId' in event.before
          ? String((event.before as { facultyId?: unknown }).facultyId ?? '')
          : ''
    return facultyMemberId ? { section: 'faculty-members', facultyMemberId } : null
  }
  if (event.entityType === 'AdminRequest') return { section: 'requests', requestId: event.entityId }
  return null
}

function createAdminWorkspaceSnapshot(input: Omit<AdminWorkspaceSnapshot, 'scrollY'>): AdminWorkspaceSnapshot {
  return {
    ...input,
    scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
  }
}

function getAdminWorkspaceSnapshotKey(snapshot: Omit<AdminWorkspaceSnapshot, 'scrollY'> | AdminWorkspaceSnapshot) {
  return `${routeToHash(snapshot.route)}::${snapshot.universityTab}::${snapshot.selectedSectionCode ?? ''}`
}

function persistAdminRouteUiState(snapshot: Pick<AdminWorkspaceSnapshot, 'route' | 'universityTab' | 'selectedSectionCode'>) {
  if (typeof window === 'undefined' || snapshot.route.section !== 'faculties') return
  window.sessionStorage.setItem(`airmentor-admin-ui:${routeToHash(snapshot.route)}`, JSON.stringify({
    tab: snapshot.universityTab,
    sectionCode: snapshot.selectedSectionCode,
  }))
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

function matchesStudentScope(student: LiveAdminDataset['students'][number], data: LiveAdminDataset, scope: Omit<UniversityScopeState, 'label'> | null) {
  if (!scope) return true
  const context = student.activeAcademicContext
  if (!context) return false
  if (scope.academicFacultyId) {
    const department = context.departmentId ? resolveDepartment(data, context.departmentId) : null
    if (department?.academicFacultyId !== scope.academicFacultyId) return false
  }
  if (scope.departmentId && context.departmentId !== scope.departmentId) return false
  if (scope.branchId && context.branchId !== scope.branchId) return false
  if (scope.batchId && context.batchId !== scope.batchId) return false
  if (scope.sectionCode && context.sectionCode !== scope.sectionCode) return false
  return true
}

function matchesFacultyScope(member: LiveAdminDataset['facultyMembers'][number], data: LiveAdminDataset, scope: Omit<UniversityScopeState, 'label'> | null) {
  if (!scope) return true
  const hasScopedSelection = Boolean(scope.academicFacultyId || scope.departmentId || scope.branchId || scope.batchId || scope.sectionCode)
  if (!hasScopedSelection) return true

  const batchTermIds = scope.batchId
    ? new Set(
        data.terms
          .filter(item => item.batchId === scope.batchId && isVisibleAdminRecord(item.status))
          .map(item => item.termId),
      )
    : null

  const appointmentMatch = member.appointments.some(appointment => {
    if (appointment.status !== 'active') return false
    if (scope.departmentId && appointment.departmentId !== scope.departmentId) return false
    if (scope.branchId && appointment.branchId !== scope.branchId) return false
    if (scope.academicFacultyId) {
      const department = resolveDepartment(data, appointment.departmentId)
      if (department?.academicFacultyId !== scope.academicFacultyId) return false
    }
    return true
  })

  const ownershipMatch = data.ownerships.some(ownership => {
    if (ownership.facultyId !== member.facultyId || ownership.status !== 'active') return false
    const offering = data.offerings.find(item => item.offId === ownership.offeringId)
    if (!offering) return false
    const matchedDepartment = data.departments.find(item => item.code.toLowerCase() === offering.dept.toLowerCase())
    if (scope.academicFacultyId && matchedDepartment?.academicFacultyId !== scope.academicFacultyId) return false
    if (scope.departmentId && matchedDepartment?.departmentId !== scope.departmentId) return false
    if (scope.branchId && offering.branchId !== scope.branchId) return false
    if (batchTermIds && (!offering.termId || !batchTermIds.has(offering.termId))) return false
    if (scope.sectionCode && offering.section !== scope.sectionCode) return false
    return true
  })

  return appointmentMatch || ownershipMatch
}

function TeachingShellAdminTopBar({
  institutionName,
  adminName,
  contextLabel,
  now,
  themeMode,
  actionCount,
  searchQuery,
  onSearchChange,
  searchResults,
  onSearchSelect,
  onToggleTheme,
  onGoHome,
  onToggleQueue,
  onRefresh,
  onExitPortal,
  onLogout,
}: {
  institutionName: string
  adminName: string
  contextLabel: string
  now: Date
  themeMode: ThemeMode
  actionCount: number
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: Array<{ key: string; title: string; subtitle: string; onSelect: () => void }>
  onSearchSelect?: () => void
  onToggleTheme: () => void
  onGoHome: () => void
  onToggleQueue: () => void
  onRefresh: () => void
  onExitPortal?: () => void
  onLogout: () => void
}) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'grid', gap: 14, padding: '10px 20px 16px', background: isLightTheme(themeMode) ? 'rgba(255,255,255,0.9)' : 'rgba(9,14,22,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label="Go to dashboard"
            title="Go to dashboard"
            onClick={onGoHome}
            style={{ width: 34, height: 34, borderRadius: 10, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sora, fontWeight: 800, fontSize: 13, color: '#fff', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            AM
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 14, color: T.text }}>{institutionName}</div>
            <div style={{ ...mono, fontSize: 9, color: T.dim }}>Welcome {adminName} · {contextLabel}</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 10, color: T.dim, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 9px', minHeight: 32, display: 'flex', alignItems: 'center', gap: 6, background: T.surface2 }}>
            <Clock3 size={12} />
            {formatClockLabel(now)}
          </div>
          <button type="button" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={onToggleTheme} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 14, lineHeight: 1 }}>
            {isLightTheme(themeMode) ? '🌙' : '☀️'}
          </button>
          <button type="button" aria-label="Open action queue" onClick={onToggleQueue} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, position: 'relative' }}>
            <Bell size={14} />
            {actionCount > 0 ? (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {Math.min(actionCount, 99)}
              </span>
            ) : null}
          </button>
          <button type="button" aria-label="Refresh admin data" onClick={onRefresh} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted }}>
            <RefreshCw size={14} />
          </button>
          {onExitPortal ? <button type="button" onClick={onExitPortal} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>Portal</button> : null}
          <button type="button" onClick={onLogout} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, border: `1px solid ${T.border2}`, background: T.surface, padding: '10px 14px' }}>
          <Search size={15} color={T.muted} />
          <input
            aria-label="Global admin search"
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search anything: faculty, department, course, request, student, section..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.text, ...mono, fontSize: 12 }}
          />
        </div>
        {searchResults.length > 0 ? (
          <Card style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, padding: 0, overflow: 'hidden', zIndex: 30 }}>
            {searchResults.map(result => (
              <button
                key={result.key}
                type="button"
                onClick={() => {
                  result.onSelect()
                  onSearchSelect?.()
                }}
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
                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{result.title}</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.subtitle}</div>
              </button>
            ))}
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function SectionLaunchCard({
  title,
  caption,
  helper,
  icon,
  tone = T.accent,
  active,
  onClick,
}: {
  title: string
  caption: string
  helper: string
  icon: ReactNode
  tone?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <Card
      glow={active ? tone : undefined}
      onClick={onClick}
      style={{
        padding: 20,
        background: active
          ? `linear-gradient(160deg, ${tone}18, ${T.surface})`
          : `linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
        borderTop: `3px solid ${tone}28`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone}16`, color: tone }}>
          {icon}
        </div>
        <div>
          <div style={{ ...sora, fontSize: 17, fontWeight: 800, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: 10, color: tone }}>{caption}</div>
        </div>
      </div>
      <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

function ActionQueueCard({
  title,
  subtitle,
  chips,
  trailing,
  tone = T.warning,
  onClick,
}: {
  title: string
  subtitle: string
  chips: string[]
  trailing?: ReactNode
  tone?: string
  onClick?: () => void
}) {
  return (
    <Card onClick={onClick} style={{ padding: 12, background: T.surface2, cursor: onClick ? 'pointer' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>{subtitle}</div>
        </div>
        {trailing}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {chips.map(chip => <Chip key={chip} color={tone} size={9}>{chip}</Chip>)}
      </div>
    </Card>
  )
}

export function SystemAdminLiveApp({ apiBaseUrl, onExitPortal }: SystemAdminLiveAppProps) {
  const apiClient = useMemo(() => new AirMentorApiClient(apiBaseUrl), [apiBaseUrl])
  const repositories = useMemo(() => createAirMentorRepositories({ repositoryMode: 'http', apiClient }), [apiClient])

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => repositories.sessionPreferences.getThemeSnapshot() ?? normalizeThemeMode(null))
  const [now, setNow] = useState(() => new Date())
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
  const [serverSearchResults, setServerSearchResults] = useState<ApiAdminSearchResult[]>([])
  const [showActionQueue, setShowActionQueue] = useState(true)
  const [remindersSupported, setRemindersSupported] = useState(true)
  const [universityTab, setUniversityTab] = useState<'overview' | 'bands' | 'ce-see' | 'cgpa' | 'courses'>('overview')
  const [selectedSectionCode, setSelectedSectionCode] = useState<string | null>(null)
  const [route, setRoute] = useState<LiveAdminRoute>(() => parseAdminRoute(typeof window === 'undefined' ? '' : window.location.hash))
  const [routeHistory, setRouteHistory] = useState<AdminWorkspaceSnapshot[]>([])
  const [registryScope, setRegistryScope] = useState<UniversityScopeState | null>(null)
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
  const [studentForm, setStudentForm] = useState<StudentFormState>(() => defaultStudentForm())
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentFormState>(() => defaultEnrollmentForm())
  const [mentorForm, setMentorForm] = useState<MentorAssignmentFormState>(() => defaultMentorAssignmentForm())
  const [facultyForm, setFacultyForm] = useState<FacultyFormState>(() => defaultFacultyForm())
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

  const updateUniversityTab = useCallback((nextTab: 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'courses', options?: { recordHistory?: boolean }) => {
    if (nextTab === universityTab) return
    if (options?.recordHistory !== false) pushCurrentWorkspaceToHistory()
    setUniversityTab(nextTab)
  }, [pushCurrentWorkspaceToHistory, universityTab])

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

  const handleGoHome = useCallback(() => {
    clearRouteHistory()
    clearRegistryScope()
    updateSelectedSectionCode(null, { recordHistory: false })
    updateUniversityTab('overview', { recordHistory: false })
    navigate({ section: 'overview' }, { recordHistory: false })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [clearRegistryScope, clearRouteHistory, navigate, updateSelectedSectionCode, updateUniversityTab])

  const handleNavigateBack = useCallback(() => {
    if (routeHistory.length === 0) {
      handleGoHome()
      return
    }
    const nextHistory = [...routeHistory]
    const snapshot = nextHistory.pop()
    if (!snapshot) {
      handleGoHome()
      return
    }
    setRouteHistory(nextHistory)
    pendingScrollRestoreRef.current = snapshot.scrollY
    persistAdminRouteUiState(snapshot)
    updateSelectedSectionCode(snapshot.selectedSectionCode, { recordHistory: false })
    updateUniversityTab(snapshot.universityTab, { recordHistory: false })
    navigate(snapshot.route, { recordHistory: false })
  }, [handleGoHome, navigate, routeHistory, updateSelectedSectionCode, updateUniversityTab])

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
      const [institution, academicFaculties, departments, branches, batches, terms, facultyMembers, students, courses, curriculumCourses, policyOverrides, offerings, ownerships, requests, reminders] = await Promise.all([
        safeInstitution(), apiClient.listAcademicFaculties(), apiClient.listDepartments(),
        apiClient.listBranches(), apiClient.listBatches(), apiClient.listTerms(),
        apiClient.listFaculty(), apiClient.listStudents(), apiClient.listCourses(),
        apiClient.listCurriculumCourses(), apiClient.listPolicyOverrides(),
        apiClient.listOfferings(), apiClient.listOfferingOwnership(), apiClient.listAdminRequests(),
        safeReminders(),
      ])
      setData({
        institution, academicFaculties: academicFaculties.items, departments: departments.items,
        branches: branches.items, batches: batches.items, terms: terms.items,
        facultyMembers: facultyMembers.items, students: students.items, courses: courses.items,
        curriculumCourses: curriculumCourses.items, policyOverrides: policyOverrides.items,
        offerings: offerings.items, ownerships: ownerships.items, requests: requests.items,
        reminders: reminders.items,
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
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (route.section !== 'faculties') {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      return
    }
    const storageKey = `airmentor-admin-ui:${routeToHash(route)}`
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      return
    }
    try {
      const parsed = JSON.parse(raw) as { tab?: typeof universityTab; sectionCode?: string | null }
      setUniversityTab(parsed.tab ?? 'overview')
      setSelectedSectionCode(parsed.sectionCode ?? null)
    } catch {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
    }
  }, [route])

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

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    const query = deferredSearch.trim()
    if (!query) {
      setServerSearchResults([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await apiClient.searchAdminWorkspace(query, {
          academicFacultyId: route.academicFacultyId,
          departmentId: route.departmentId,
          branchId: route.branchId,
          batchId: route.batchId,
          sectionCode: selectedSectionCode ?? undefined,
        })
        if (!cancelled) setServerSearchResults(response.items)
      } catch {
        if (!cancelled) setServerSearchResults([])
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, deferredSearch, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, selectedSectionCode, session])

  const systemAdminGrant = session?.availableRoleGrants.find(item => item.roleCode === 'SYSTEM_ADMIN') ?? null
  const selectedAcademicFaculty = resolveAcademicFaculty(data, route.academicFacultyId)
  const selectedDepartment = resolveDepartment(data, route.departmentId)
  const selectedBranch = resolveBranch(data, route.branchId)
  const selectedBatch = resolveBatch(data, route.batchId)
  const selectedStudent = resolveStudent(data, route.studentId)
  const selectedFacultyMember = resolveFacultyMember(data, route.facultyMemberId)
  const searchResults = useMemo(() => {
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
      }))
    }
    return searchLiveAdminWorkspace(data, deferredSearch)
  }, [data, deferredSearch, serverSearchResults])
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
    const latestOwnership = data.ownerships.find(item => item.facultyId === selectedFacultyMember.facultyId && item.status === 'active') ?? null
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
    setOwnershipForm(latestOwnership ? {
      ownershipId: latestOwnership.ownershipId,
      offeringId: latestOwnership.offeringId,
      facultyId: latestOwnership.facultyId,
      ownershipRole: latestOwnership.ownershipRole,
    } : {
      ...defaultOwnershipForm(),
      facultyId: selectedFacultyMember.facultyId,
    })
  }, [data.ownerships, selectedFacultyMember])

  useEffect(() => {
    if (!selectedStudent?.activeAcademicContext?.batchId) {
      setSelectedStudentPolicy(null)
      setSelectedStudentPolicyLoading(false)
      return
    }
    let cancelled = false
    setSelectedStudentPolicyLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(selectedStudent.activeAcademicContext!.batchId!)
        if (!cancelled) setSelectedStudentPolicy(next)
      } catch {
        if (!cancelled) setSelectedStudentPolicy(null)
      } finally {
        if (!cancelled) setSelectedStudentPolicyLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedStudent?.activeAcademicContext?.batchId])

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
      const facultyOwnerships = data.ownerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
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
  }, [apiClient, data.ownerships, selectedFacultyMember])

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
  }, [apiClient, dataLoading, session])

  useEffect(() => {
    if (!selectedFacultyMember) {
      setFacultyCalendar(null)
      setFacultyCalendarLoading(false)
      return
    }
    let cancelled = false
    setFacultyCalendarLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getAdminFacultyCalendar(selectedFacultyMember.facultyId)
        if (!cancelled) setFacultyCalendar(next)
      } catch {
        if (!cancelled) setFacultyCalendar(null)
      } finally {
        if (!cancelled) setFacultyCalendarLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedFacultyMember?.facultyId])

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
    clearRegistryScope()
    setSession(null); setData(EMPTY_DATA)
  }

  const handleSwitchToSystemAdmin = async () => {
    if (!systemAdminGrant) return
    setAuthBusy(true)
    try { const next = await apiClient.switchRoleContext(systemAdminGrant.grantId); setSession(next) }
    catch (error) { setAuthError(toErrorMessage(error)) }
    finally { setAuthBusy(false) }
  }

  const runAction = async <T,>(runner: () => Promise<T>) => {
    setActionError('')
    try {
      const result = await runner()
      await loadAdminData()
      return result
    } catch (error) {
      setActionError(toErrorMessage(error))
      return null
    }
  }

  const handleCreateReminder = async () => {
    if (!remindersSupported) {
      setActionError('This live backend does not expose private admin reminders yet. Deploy the latest API to enable them.')
      return
    }
    const title = window.prompt('Reminder title')
    if (!title?.trim()) return
    const body = window.prompt('Reminder note', 'Follow up with HoD / verify structure change / review pending implementation.') ?? ''
    const dueAt = window.prompt('Due date and time (YYYY-MM-DDTHH:mm)', `${new Date().toISOString().slice(0, 16)}`) ?? ''
    if (!dueAt.trim()) return
    await runAction(async () => {
      await apiClient.createAdminReminder({
        title: title.trim(),
        body: body.trim() || 'Personal admin reminder.',
        dueAt: dueAt.trim(),
        status: 'pending',
      })
      setFlashMessage('Reminder created.')
    })
  }

  const handleToggleReminderStatus = async (reminder: LiveAdminDataset['reminders'][number]) => {
    if (!remindersSupported) {
      setActionError('Private reminders are not available on this backend yet.')
      return
    }
    await runAction(async () => {
      await apiClient.updateAdminReminder(reminder.reminderId, {
        title: reminder.title,
        body: reminder.body,
        dueAt: reminder.dueAt,
        status: reminder.status === 'pending' ? 'done' : 'pending',
        version: reminder.version,
      })
      setFlashMessage(reminder.status === 'pending' ? 'Reminder completed.' : 'Reminder reopened.')
    })
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
        status: 'deleted',
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
        status: 'deleted',
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
        semesterCount: requirePositiveEvenInteger('Semester count', entityEditors.branch.semesterCount),
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
        status: 'deleted',
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
        status: 'deleted',
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
        semesterCount: requirePositiveEvenInteger('Semester count', structureForms.branch.semesterCount),
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
        status: 'deleted',
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
        status: 'deleted',
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

  const resetStudentEditors = () => {
    setStudentForm(defaultStudentForm())
    setEnrollmentForm(defaultEnrollmentForm())
    setMentorForm(defaultMentorAssignmentForm())
  }

  const startEditingEnrollment = (enrollment: ApiStudentEnrollment) => {
    setEnrollmentForm({
      enrollmentId: enrollment.enrollmentId,
      branchId: enrollment.branchId,
      termId: enrollment.termId,
      sectionCode: enrollment.sectionCode,
      rosterOrder: String(enrollment.rosterOrder ?? 0),
      academicStatus: enrollment.academicStatus,
      startDate: enrollment.startDate,
      endDate: enrollment.endDate ?? '',
    })
  }

  const startEditingMentorAssignment = (assignment: ApiMentorAssignment) => {
    setMentorForm({
      assignmentId: assignment.assignmentId,
      facultyId: assignment.facultyId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo ?? '',
      source: assignment.source,
    })
  }

  const handleSaveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      usn: requireText('University ID / USN', studentForm.usn),
      rollNumber: studentForm.rollNumber.trim() || null,
      name: requireText('Student name', studentForm.name),
      email: studentForm.email.trim() || null,
      phone: studentForm.phone.trim() || null,
      admissionDate: requireDate('Admission date', studentForm.admissionDate),
      status: selectedStudent?.status ?? 'active',
    }
    if (selectedStudent) {
      await runAction(async () => {
        await apiClient.updateStudent(selectedStudent.studentId, {
          ...payload,
          version: selectedStudent.version,
        })
        setFlashMessage('Student record updated.')
      })
      return
    }
    const created = await runAction(async () => apiClient.createStudent(payload))
    if (created) {
      navigate({ section: 'students', studentId: created.studentId })
      setFlashMessage('Student created.')
    }
  }

  const handleArchiveStudent = async () => {
    if (!selectedStudent) return
    if (!window.confirm(`Delete ${selectedStudent.name}? This moves the record to the recycle bin for 60 days.`)) return
    await runAction(async () => {
      await apiClient.updateStudent(selectedStudent.studentId, {
        usn: selectedStudent.usn,
        rollNumber: selectedStudent.rollNumber,
        name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        admissionDate: selectedStudent.admissionDate,
        status: 'deleted',
        version: selectedStudent.version,
      })
      navigate({ section: 'students' })
      resetStudentEditors()
      setFlashMessage('Student moved to recycle bin.')
    })
  }

  const handleSaveEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing enrollment.')
    const payload = {
      branchId: requireText('Branch', enrollmentForm.branchId),
      termId: requireText('Term', enrollmentForm.termId),
      sectionCode: requireText('Section', enrollmentForm.sectionCode),
      rosterOrder: requirePositiveInteger('Roster order', enrollmentForm.rosterOrder),
      academicStatus: requireText('Academic status', enrollmentForm.academicStatus),
      startDate: requireDate('Enrollment start date', enrollmentForm.startDate),
      endDate: enrollmentForm.endDate.trim() ? requireDate('Enrollment end date', enrollmentForm.endDate) : null,
    }
    if (enrollmentForm.enrollmentId) {
      const current = selectedStudent.enrollments.find(item => item.enrollmentId === enrollmentForm.enrollmentId)
      if (!current) throw new Error('Enrollment could not be found.')
      await runAction(async () => {
        await apiClient.updateEnrollment(current.enrollmentId, {
          studentId: selectedStudent.studentId,
          ...payload,
          version: current.version,
        })
        setFlashMessage('Enrollment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createEnrollment(selectedStudent.studentId, payload)
      setFlashMessage('Enrollment created.')
    })
  }

  const handleCloseEnrollment = async (enrollment: ApiStudentEnrollment) => {
    if (!selectedStudent) return
    if (!window.confirm(`Close enrollment ${enrollment.enrollmentId}?`)) return
    await runAction(async () => {
      await apiClient.updateEnrollment(enrollment.enrollmentId, {
        studentId: selectedStudent.studentId,
        branchId: enrollment.branchId,
        termId: enrollment.termId,
        sectionCode: enrollment.sectionCode,
        rosterOrder: enrollment.rosterOrder ?? 0,
        academicStatus: enrollment.academicStatus === 'regular' ? 'completed' : enrollment.academicStatus,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate ?? new Date().toISOString().slice(0, 10),
        version: enrollment.version,
      })
      setFlashMessage('Enrollment closed.')
    })
  }

  const handleSaveMentorAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStudent) throw new Error('Select a student before editing mentor linkage.')
    const payload = {
      studentId: selectedStudent.studentId,
      facultyId: requireText('Mentor faculty', mentorForm.facultyId),
      effectiveFrom: requireDate('Mentor effective from', mentorForm.effectiveFrom),
      effectiveTo: mentorForm.effectiveTo.trim() ? requireDate('Mentor effective to', mentorForm.effectiveTo) : null,
      source: requireText('Assignment source', mentorForm.source),
    }
    if (mentorForm.assignmentId) {
      const current = selectedStudent.mentorAssignments.find(item => item.assignmentId === mentorForm.assignmentId)
      if (!current) throw new Error('Mentor assignment could not be found.')
      await runAction(async () => {
        await apiClient.updateMentorAssignment(current.assignmentId, {
          ...payload,
          version: current.version,
        })
        setFlashMessage('Mentor assignment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createMentorAssignment(payload)
      setFlashMessage('Mentor assignment created.')
    })
  }

  const handleEndMentorAssignment = async (assignment: ApiMentorAssignment) => {
    if (!selectedStudent) return
    if (!window.confirm('End this mentor assignment?')) return
    await runAction(async () => {
      await apiClient.updateMentorAssignment(assignment.assignmentId, {
        studentId: assignment.studentId,
        facultyId: assignment.facultyId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo ?? new Date().toISOString().slice(0, 10),
        source: assignment.source,
        version: assignment.version,
      })
      setFlashMessage('Mentor assignment ended.')
    })
  }

  const handlePromoteStudent = async (targetTermId: string) => {
    if (!selectedStudent) return
    const currentEnrollment = findLatestEnrollment(selectedStudent)
    const targetTerm = data.terms.find(item => item.termId === targetTermId)
    if (!currentEnrollment || !targetTerm) {
      setActionError('Active enrollment and target term are required for promotion.')
      return
    }
    const existingTarget = selectedStudent.enrollments.find(item => item.termId === targetTermId)
    if (existingTarget) {
      setActionError('This student already has an enrollment for the selected next term.')
      return
    }
    if (!window.confirm(`Promote ${selectedStudent.name} into Semester ${targetTerm.semesterNumber} (${targetTerm.academicYearLabel})?`)) return
    await runAction(async () => {
      if (!currentEnrollment.endDate) {
        await apiClient.updateEnrollment(currentEnrollment.enrollmentId, {
          studentId: selectedStudent.studentId,
          branchId: currentEnrollment.branchId,
          termId: currentEnrollment.termId,
          sectionCode: currentEnrollment.sectionCode,
          rosterOrder: currentEnrollment.rosterOrder ?? 0,
          academicStatus: currentEnrollment.academicStatus === 'regular' ? 'completed' : currentEnrollment.academicStatus,
          startDate: currentEnrollment.startDate,
          endDate: targetTerm.startDate,
          version: currentEnrollment.version,
        })
      }
      await apiClient.createEnrollment(selectedStudent.studentId, {
        branchId: targetTerm.branchId,
        termId: targetTerm.termId,
        sectionCode: currentEnrollment.sectionCode,
        rosterOrder: currentEnrollment.rosterOrder ?? 0,
        academicStatus: 'regular',
        startDate: targetTerm.startDate,
        endDate: null,
      })
      setFlashMessage(`Promotion recorded for Semester ${targetTerm.semesterNumber}.`)
    })
  }

  const resetFacultyEditors = () => {
    setFacultyForm(defaultFacultyForm())
    setAppointmentForm(defaultAppointmentForm())
    setRoleGrantForm(defaultRoleGrantForm())
    setOwnershipForm(defaultOwnershipForm())
  }

  const startEditingAppointment = (appointment: ApiFacultyAppointment) => {
    setAppointmentForm({
      appointmentId: appointment.appointmentId,
      departmentId: appointment.departmentId,
      branchId: appointment.branchId ?? '',
      isPrimary: appointment.isPrimary,
      startDate: appointment.startDate,
      endDate: appointment.endDate ?? '',
    })
  }

  const startEditingRoleGrant = (grant: ApiRoleGrant) => {
    setRoleGrantForm({
      grantId: grant.grantId,
      roleCode: grant.roleCode,
      scopeType: grant.scopeType,
      scopeId: grant.scopeId,
      startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: grant.endDate ?? '',
    })
  }

  const startEditingOwnership = (ownership: ApiOfferingOwnership) => {
    setOwnershipForm({
      ownershipId: ownership.ownershipId,
      offeringId: ownership.offeringId,
      facultyId: ownership.facultyId,
      ownershipRole: ownership.ownershipRole,
    })
  }

  const handleSaveFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      username: requireText('Username', facultyForm.username),
      email: requireText('Email', facultyForm.email),
      phone: facultyForm.phone.trim() || null,
      employeeCode: requireText('Employee code', facultyForm.employeeCode),
      displayName: requireText('Display name', facultyForm.displayName),
      designation: requireText('Designation', facultyForm.designation),
      joinedOn: selectedFacultyMember?.joinedOn ?? null,
      status: selectedFacultyMember?.status ?? 'active',
    }
    if (selectedFacultyMember) {
      await runAction(async () => {
        await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
          ...payload,
          version: selectedFacultyMember.version,
        })
        setFlashMessage('Faculty profile updated.')
      })
      return
    }
    const created = await runAction(async () => apiClient.createFaculty({
      ...payload,
      password: requireText('Password', facultyForm.password),
    }))
    if (created) {
      navigate({ section: 'faculty-members', facultyMemberId: created.facultyId })
      setFlashMessage('Faculty profile created.')
    }
  }

  const handleArchiveFaculty = async () => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${selectedFacultyMember.displayName}? This will soft-delete the faculty profile and login.`)) return
    await runAction(async () => {
      await apiClient.updateFaculty(selectedFacultyMember.facultyId, {
        username: selectedFacultyMember.username,
        email: selectedFacultyMember.email,
        phone: selectedFacultyMember.phone,
        employeeCode: selectedFacultyMember.employeeCode,
        displayName: selectedFacultyMember.displayName,
        designation: selectedFacultyMember.designation,
        joinedOn: selectedFacultyMember.joinedOn,
        status: 'deleted',
        version: selectedFacultyMember.version,
      })
      navigate({ section: 'faculty-members' })
      resetFacultyEditors()
      setFlashMessage('Faculty member moved to recycle bin.')
    })
  }

  const handleSaveAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing appointments.')
    const payload = {
      departmentId: requireText('Department', appointmentForm.departmentId),
      branchId: appointmentForm.branchId.trim() || null,
      isPrimary: appointmentForm.isPrimary,
      startDate: requireDate('Appointment start date', appointmentForm.startDate),
      endDate: appointmentForm.endDate.trim() ? requireDate('Appointment end date', appointmentForm.endDate) : null,
      status: 'active',
    }
    if (appointmentForm.appointmentId) {
      const current = selectedFacultyMember.appointments.find(item => item.appointmentId === appointmentForm.appointmentId)
      if (!current) throw new Error('Appointment could not be found.')
      await runAction(async () => {
        await apiClient.updateFacultyAppointment(current.appointmentId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Appointment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createFacultyAppointment(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Appointment created.')
    })
  }

  const handleArchiveAppointment = async (appointment: ApiFacultyAppointment) => {
    if (!selectedFacultyMember) return
    if (!window.confirm('Delete this appointment?')) return
    await runAction(async () => {
      await apiClient.updateFacultyAppointment(appointment.appointmentId, {
        facultyId: selectedFacultyMember.facultyId,
        departmentId: appointment.departmentId,
        branchId: appointment.branchId,
        isPrimary: appointment.isPrimary,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        status: 'deleted',
        version: appointment.version,
      })
      setFlashMessage('Appointment moved to recycle bin.')
    })
  }

  const handleSaveRoleGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing permissions.')
    const payload = {
      roleCode: roleGrantForm.roleCode,
      scopeType: requireText('Scope type', roleGrantForm.scopeType),
      scopeId: requireText('Scope id', roleGrantForm.scopeId),
      startDate: requireDate('Permission start date', roleGrantForm.startDate),
      endDate: roleGrantForm.endDate.trim() ? requireDate('Permission end date', roleGrantForm.endDate) : null,
      status: 'active',
    }
    if (roleGrantForm.grantId) {
      const current = selectedFacultyMember.roleGrants.find(item => item.grantId === roleGrantForm.grantId)
      if (!current) throw new Error('Permission grant could not be found.')
      await runAction(async () => {
        await apiClient.updateRoleGrant(current.grantId, {
          facultyId: selectedFacultyMember.facultyId,
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Permission updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createRoleGrant(selectedFacultyMember.facultyId, payload)
      setFlashMessage('Permission granted.')
    })
  }

  const handleArchiveRoleGrant = async (grant: ApiRoleGrant) => {
    if (!selectedFacultyMember) return
    if (!window.confirm(`Delete ${grant.roleCode} permission?`)) return
    await runAction(async () => {
      await apiClient.updateRoleGrant(grant.grantId, {
        facultyId: selectedFacultyMember.facultyId,
        roleCode: grant.roleCode,
        scopeType: grant.scopeType,
        scopeId: grant.scopeId,
        startDate: grant.startDate ?? new Date().toISOString().slice(0, 10),
        endDate: grant.endDate,
        status: 'deleted',
        version: grant.version,
      })
      setFlashMessage('Permission moved to recycle bin.')
    })
  }

  const handleSaveOwnership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFacultyMember) throw new Error('Select a faculty member before editing teaching ownership.')
    const payload = {
      offeringId: requireText('Class / offering', ownershipForm.offeringId),
      facultyId: selectedFacultyMember.facultyId,
      ownershipRole: requireText('Ownership role', ownershipForm.ownershipRole),
      status: 'active',
    }
    if (ownershipForm.ownershipId) {
      const current = data.ownerships.find(item => item.ownershipId === ownershipForm.ownershipId)
      if (!current) throw new Error('Teaching ownership could not be found.')
      await runAction(async () => {
        await apiClient.updateOfferingOwnership(current.ownershipId, {
          ...payload,
          status: current.status,
          version: current.version,
        })
        setFlashMessage('Teaching ownership updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createOfferingOwnership(payload)
      setFlashMessage('Teaching ownership added.')
    })
  }

  const handleArchiveOwnership = async (ownership: ApiOfferingOwnership) => {
    if (!window.confirm('Delete this teaching ownership?')) return
    await runAction(async () => {
      await apiClient.updateOfferingOwnership(ownership.ownershipId, {
        offeringId: ownership.offeringId,
        facultyId: ownership.facultyId,
        ownershipRole: ownership.ownershipRole,
        status: 'deleted',
        version: ownership.version,
      })
      setFlashMessage('Teaching ownership moved to recycle bin.')
    })
  }

  const handleAssignCurriculumCourseLeader = async (curriculumCourseId: string, facultyId: string) => {
    if (!selectedBatch || !selectedBranch) return
    const curriculumCourse = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!curriculumCourse) {
      setActionError('The selected curriculum course could not be found.')
      return
    }
    const matchingTermIds = new Set(
      data.terms
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isVisibleAdminRecord(item.status))
        .map(item => item.termId),
    )
    const matchingOfferings = data.offerings.filter(item => {
      if (item.branchId !== selectedBranch.branchId) return false
      if (!item.termId) return false
      if (!matchingTermIds.has(item.termId)) return false
      if (item.code.toLowerCase() !== curriculumCourse.courseCode.toLowerCase()) return false
      if (selectedSectionCode && item.section !== selectedSectionCode) return false
      return true
    })
    if (matchingOfferings.length === 0) {
      setActionError('No live offerings match this curriculum row in the selected year or section yet. Create the relevant class offerings first.')
      return
    }

    await runAction(async () => {
      for (const offering of matchingOfferings) {
        const activeLeaderLikeOwnerships = data.ownerships.filter(ownership => ownership.offeringId === offering.offId && ownership.status === 'active' && isLeaderLikeOwnership(ownership.ownershipRole))
        for (const ownership of activeLeaderLikeOwnerships) {
          if (!facultyId || ownership.facultyId !== facultyId) {
            await apiClient.updateOfferingOwnership(ownership.ownershipId, {
              offeringId: ownership.offeringId,
              facultyId: ownership.facultyId,
              ownershipRole: ownership.ownershipRole,
              status: 'deleted',
              version: ownership.version,
            })
          }
        }
        if (!facultyId) continue
        const existingForTarget = activeLeaderLikeOwnerships.find(ownership => ownership.facultyId === facultyId)
        if (!existingForTarget) {
          await apiClient.createOfferingOwnership({
            offeringId: offering.offId,
            facultyId,
            ownershipRole: 'owner',
            status: 'active',
          })
        }
      }
      setFlashMessage(facultyId
        ? `Course leader updated across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`
        : `Course leader cleared across ${matchingOfferings.length} offering${matchingOfferings.length === 1 ? '' : 's'}.`)
    })
  }

  const handleSaveFacultyCalendar = async (payload: Pick<ApiAdminFacultyCalendar, 'template' | 'workspace'>) => {
    if (!selectedFacultyMember) return
    setFacultyCalendarLoading(true)
    setActionError('')
    try {
      const next = await apiClient.saveAdminFacultyCalendar(selectedFacultyMember.facultyId, payload)
      setFacultyCalendar(next)
      await loadAdminData()
      setFlashMessage('Timetable planner saved.')
    } catch (error) {
      setActionError(toErrorMessage(error))
    } finally {
      setFacultyCalendarLoading(false)
    }
  }

  // --- Boot / auth screens ---
  if (booting) {
    return <PageShell size="narrow" style={{ paddingTop: 48 }}><Card><div style={{ ...mono, fontSize: 11, color: T.muted }}>Restoring system admin session…</div></Card></PageShell>
  }

  if (!session) {
    return (
      <AuthPageShell>
        <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
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
      </AuthPageShell>
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
  const deletedItems = [
    ...data.academicFaculties.filter(item => item.status === 'deleted').map(item => ({ key: `academic-faculty:${item.academicFacultyId}`, label: item.name, meta: 'Academic faculty', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
    } })),
    ...data.departments.filter(item => item.status === 'deleted').map(item => ({ key: `department:${item.departmentId}`, label: item.name, meta: 'Department', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateDepartment(item.departmentId, { academicFacultyId: item.academicFacultyId, code: item.code, name: item.name, status: 'active', version: item.version })
    } })),
    ...data.branches.filter(item => item.status === 'deleted').map(item => ({ key: `branch:${item.branchId}`, label: item.name, meta: 'Branch', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateBranch(item.branchId, { departmentId: item.departmentId, code: item.code, name: item.name, programLevel: item.programLevel, semesterCount: item.semesterCount, status: 'active', version: item.version })
    } })),
    ...data.batches.filter(item => item.status === 'deleted').map(item => ({ key: `batch:${item.batchId}`, label: item.batchLabel, meta: 'Year', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateBatch(item.batchId, { branchId: item.branchId, admissionYear: item.admissionYear, batchLabel: item.batchLabel, currentSemester: item.currentSemester, sectionLabels: item.sectionLabels, status: 'active', version: item.version })
    } })),
    ...data.students.filter(item => item.status === 'deleted').map(item => ({ key: `student:${item.studentId}`, label: item.name, meta: 'Student', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateStudent(item.studentId, { usn: item.usn, rollNumber: item.rollNumber, name: item.name, email: item.email, phone: item.phone, admissionDate: item.admissionDate, status: 'active', version: item.version })
    } })),
    ...data.facultyMembers.filter(item => item.status === 'deleted').map(item => ({ key: `faculty:${item.facultyId}`, label: item.displayName, meta: 'Faculty member', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateFaculty(item.facultyId, { username: item.username, email: item.email, phone: item.phone, employeeCode: item.employeeCode, displayName: item.displayName, designation: item.designation, joinedOn: item.joinedOn, status: 'active', version: item.version })
    } })),
    ...data.courses.filter(item => item.status === 'deleted').map(item => ({ key: `course:${item.courseId}`, label: item.title, meta: 'Course', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateCourse(item.courseId, { courseCode: item.courseCode, title: item.title, defaultCredits: item.defaultCredits, departmentId: item.departmentId, status: 'active', version: item.version })
    } })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const openRequests = data.requests.filter(item => item.status !== 'Closed')
  const pendingReminders = data.reminders.filter(item => item.status === 'pending')
  const actionQueueCount = openRequests.length + pendingReminders.length
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
  const currentUniversityLevel = selectedBatch
    ? (selectedSectionCode ? 'section' : 'year')
    : selectedBranch
      ? 'year'
      : selectedDepartment
        ? 'branch'
        : selectedAcademicFaculty
          ? 'department'
          : 'faculty'
  const universityLeftItems = (() => {
    if (selectedBatch) {
      return selectorSections.map(sectionCode => ({
        key: `section:${sectionCode}`,
        title: `Section ${sectionCode}`,
        subtitle: 'Section scope',
        selected: selectedSectionCode === sectionCode,
        onSelect: () => updateSelectedSectionCode(sectionCode),
      }))
    }
    if (selectedBranch) {
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
    if (selectedDepartment) {
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
    if (selectedAcademicFaculty) {
      return facultyDepartments.map(department => ({
        key: `department:${department.departmentId}`,
        title: department.name,
        subtitle: `${department.code} · ${listBranchesForDepartment(data, department.departmentId).length} branches`,
        selected: route.departmentId === department.departmentId,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty!.academicFacultyId,
          departmentId: department.departmentId,
        }),
      }))
    }
    return visibleAcademicFaculties.map(faculty => ({
      key: `faculty:${faculty.academicFacultyId}`,
      title: faculty.name,
      subtitle: `${faculty.code} · ${listDepartmentsForAcademicFaculty(data, faculty.academicFacultyId).length} departments`,
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
        description: `${data.students.filter(student => student.activeAcademicContext?.batchId === selectedBatch!.batchId && student.activeAcademicContext.sectionCode === sectionCode).length} students`,
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
        description: `${branch.code} · ${branch.programLevel} · ${listBatchesForBranch(data, branch.branchId).length} years`,
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
        description: `${department.code} · ${listBranchesForDepartment(data, department.departmentId).length} branches`,
        onSelect: () => navigate({
          section: 'faculties',
          academicFacultyId: selectedAcademicFaculty!.academicFacultyId,
          departmentId: department.departmentId,
        }),
      }))
    }
    return []
  })()
  const filteredUniversityStudents = data.students
    .filter(item => isVisibleAdminRecord(item.status))
    .filter(student => matchesStudentScope(student, data, activeUniversityScope))
  const filteredUniversityFaculty = data.facultyMembers
    .filter(item => isVisibleAdminRecord(item.status))
    .filter(member => matchesFacultyScope(member, data, activeUniversityScope))
  const universityContextLabel = selectedSectionCode
    ? `Section ${selectedSectionCode}`
    : selectedBatch
      ? deriveCurrentYearLabel(selectedBatch.currentSemester)
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
  const universityNavigatorTitle = selectedSectionCode
    ? 'Navigator Complete'
    : selectedBatch
      ? 'Sections'
      : selectedBranch
        ? 'Years'
        : selectedDepartment
          ? 'Branches'
          : 'Departments'
  const universityNavigatorHelper = selectedSectionCode
    ? 'You are already at the last hierarchy layer. Use the tabs above or jump into the scoped student or faculty registries below.'
    : selectedBatch
      ? 'Choose a section to finish the hierarchy path. Clicking a section moves you into the last layer with the same layout.'
      : selectedBranch
        ? 'Choose a year to keep drilling down. Each card behaves exactly like selecting the year dropdown above.'
        : selectedDepartment
          ? 'Choose a branch to keep the same layout and move one level deeper.'
          : selectedAcademicFaculty
            ? 'Choose a department to keep the same layout and move one level deeper.'
            : 'Select an academic faculty from the left rail first. This area then becomes the next-level navigator for its departments.'
  const universityLevelTitle = currentUniversityLevel === 'faculty'
    ? 'Academic Faculties'
    : currentUniversityLevel === 'department'
      ? 'Departments'
      : currentUniversityLevel === 'branch'
        ? 'Branches'
        : currentUniversityLevel === 'year'
          ? 'Years'
          : 'Sections'
  const universityLevelHelper = currentUniversityLevel === 'faculty'
    ? 'Create and maintain top-level academic faculties before drilling into departments, branches, years, and sections.'
    : currentUniversityLevel === 'department'
      ? 'Edit the selected academic faculty and curate the departments that live under it.'
      : currentUniversityLevel === 'branch'
        ? 'Edit the selected department and define its UG/PG branches with even semester counts.'
        : currentUniversityLevel === 'year'
          ? 'Edit the selected branch and manage the year/batch records that determine section scope and policy.'
          : 'Sections are controlled from the selected year. Editing section labels updates the year directly.'
  const getUniversityCourseLeaders = (courseCode: string) => {
    const leaderNames = data.ownerships.flatMap(ownership => {
      if (ownership.status !== 'active' || !isLeaderLikeOwnership(ownership.ownershipRole)) return []
      const offering = data.offerings.find(item => item.offId === ownership.offeringId)
      const facultyMember = resolveFacultyMember(data, ownership.facultyId)
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
    const curriculumCourse = data.curriculumCourses.find(item => item.curriculumCourseId === curriculumCourseId)
    if (!curriculumCourse) return []
    const matchingTermIds = new Set(
      data.terms
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isVisibleAdminRecord(item.status))
        .map(item => item.termId),
    )
    return data.offerings.filter(item => {
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
      matchingOfferings.flatMap(offering => data.ownerships
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
  const mentorEligibleFaculty = data.facultyMembers
    .filter(item => item.status === 'active' && item.roleGrants.some(grant => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
  const selectedStudentEnrollment = selectedStudent ? findLatestEnrollment(selectedStudent) : null
  const selectedStudentMentorAssignment = selectedStudent ? findLatestMentorAssignment(selectedStudent) : null
  const selectedStudentPromotionRules = selectedStudentPolicy?.effectivePolicy.progressionRules ?? DEFAULT_PROGRESSION_RULES
  const selectedStudentNextTerms = selectedStudent?.activeAcademicContext
    ? data.terms
        .filter(item => item.branchId === selectedStudent.activeAcademicContext!.branchId && item.semesterNumber === (selectedStudent.activeAcademicContext!.semesterNumber ?? 0) + 1 && isVisibleAdminRecord(item.status))
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
    : []
  const selectedStudentPromotionRecommended = selectedStudent
    ? selectedStudent.currentCgpa >= selectedStudentPromotionRules.minimumCgpaForPromotion
      && (!selectedStudentPromotionRules.requireNoActiveBacklogs || !/(backlog|fail|repeat|detain)/i.test(selectedStudent.activeAcademicContext?.academicStatus ?? ''))
    : false
  const studentRegistryItems = data.students
    .filter(item => isVisibleAdminRecord(item.status))
    .filter(item => matchesStudentScope(item, data, registryScope ? {
      academicFacultyId: registryScope.academicFacultyId,
      departmentId: registryScope.departmentId,
      branchId: registryScope.branchId,
      batchId: registryScope.batchId,
      sectionCode: registryScope.sectionCode,
    } : null))
    .sort((left, right) => left.name.localeCompare(right.name))
  const facultyRegistryItems = data.facultyMembers
    .filter(item => isVisibleAdminRecord(item.status))
    .filter(item => matchesFacultyScope(item, data, registryScope ? {
      academicFacultyId: registryScope.academicFacultyId,
      departmentId: registryScope.departmentId,
      branchId: registryScope.branchId,
      batchId: registryScope.batchId,
      sectionCode: registryScope.sectionCode,
    } : null))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
  const visibleTerms = data.terms
    .filter(item => isVisibleAdminRecord(item.status))
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
  const termsForEnrollment = visibleTerms.filter(item => !enrollmentForm.branchId || item.branchId === enrollmentForm.branchId)
  const branchesForAppointment = visibleBranches.filter(item => !appointmentForm.departmentId || item.departmentId === appointmentForm.departmentId)
  const selectedFacultyOwnerships = selectedFacultyMember
    ? data.ownerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
    : []
  const visibleOfferings = [...data.offerings]
    .sort((left, right) => `${left.code}-${left.year}-${left.section}`.localeCompare(`${right.code}-${right.year}-${right.section}`))
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
      return data.batches.filter(item => isVisibleAdminRecord(item.status)).map(item => ({ value: item.batchId, label: `${item.batchLabel} · ${deriveCurrentYearLabel(item.currentSemester)}` }))
    }
  if (roleGrantForm.scopeType === 'offering') {
      return visibleOfferings.map(item => ({ value: item.offId, label: `${item.code} · ${item.year} · ${item.section}` }))
    }
    return []
  })()
  const canNavigatePageBack = routeHistory.length > 0 || route.section !== 'overview'
  const canNavigateUniversityPanelBack = route.section === 'faculties'
    && (universityTab !== 'overview' || !!selectedSectionCode || !!route.batchId || !!route.branchId || !!route.departmentId || !!route.academicFacultyId)
  const handleOpenScopedRegistry = (section: 'students' | 'faculty-members') => {
    if (activeUniversityRegistryScope) setRegistryScope(activeUniversityRegistryScope)
    navigate({ section })
  }
  const handleReturnToScopedUniversity = () => {
    if (!registryScope) return
    updateUniversityTab('overview', { recordHistory: false })
    updateSelectedSectionCode(registryScope.sectionCode, { recordHistory: false })
    navigate({
      section: 'faculties',
      academicFacultyId: registryScope.academicFacultyId ?? undefined,
      departmentId: registryScope.departmentId ?? undefined,
      branchId: registryScope.branchId ?? undefined,
      batchId: registryScope.batchId ?? undefined,
    }, { recordHistory: false })
  }
  const handleNavigateUniversityPanelBack = () => {
    if (route.section !== 'faculties') return
    if (selectedSectionCode) {
      updateSelectedSectionCode(null, { recordHistory: false })
      return
    }
    if (universityTab !== 'overview') {
      updateUniversityTab('overview', { recordHistory: false })
      return
    }
    if (selectedBatch) {
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
        branchId: selectedBranch?.branchId,
      }, { recordHistory: false })
      return
    }
    if (selectedBranch) {
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
        departmentId: selectedDepartment?.departmentId,
      }, { recordHistory: false })
      return
    }
    if (selectedDepartment) {
      navigate({
        section: 'faculties',
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
      }, { recordHistory: false })
      return
    }
    if (selectedAcademicFaculty) {
      navigate({ section: 'faculties' }, { recordHistory: false })
      return
    }
    handleNavigateBack()
  }

  // --- Main workspace ---
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <TeachingShellAdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        adminName={session.faculty?.displayName ?? session.user.username}
        contextLabel={route.section === 'faculties' ? `University · ${universityContextLabel}` : route.section === 'students' ? 'Student Registry' : route.section === 'faculty-members' ? 'Faculty Registry' : route.section === 'requests' ? 'Governed Requests' : route.section === 'history' ? 'History And Restore' : 'Operations Dashboard'}
        now={now}
        themeMode={themeMode}
        actionCount={actionQueueCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults.map(r => ({ key: r.key, title: r.label, subtitle: r.meta, onSelect: () => { clearRegistryScope(); setSearchQuery(''); navigate(r.route) } }))}
        onToggleTheme={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}
        onGoHome={handleGoHome}
        onToggleQueue={() => setShowActionQueue(current => !current)}
        onRefresh={() => { void loadAdminData() }}
        onExitPortal={onExitPortal}
        onLogout={handleLogout}
      />

      <div style={{ display: 'grid', gridTemplateColumns: showActionQueue ? 'minmax(0,1fr) 320px' : 'minmax(0,1fr)', gap: 0, alignItems: 'start' }}>
      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="Operations Dashboard"
              eyebrow="Sysadmin Control Plane"
              caption="University setup, student registry, faculty registry, and governed requests all begin here."
              toneColor={ADMIN_SECTION_TONES.overview}
            />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <SectionLaunchCard
                title="University"
                caption={`${visibleAcademicFaculties.length} faculties · ${visibleDepartments.length} departments · ${visibleBranches.length} branches`}
                helper="Selector-driven hierarchy control for academic faculty, department, branch, year, section, policy bands, CE/SEE, CGPA progression, and course tables."
                icon={<LayoutDashboard size={18} />}
                tone={ADMIN_SECTION_TONES.faculties}
                active={false}
                onClick={() => {
                  clearRegistryScope()
                  navigate({ section: 'faculties' })
                }}
              />
              <SectionLaunchCard
                title="Students"
                caption={`${data.students.length} records · ${data.students.filter(item => item.activeMentorAssignment).length} mentored`}
                helper="Canonical student identity, mentor eligibility, academic context corrections, and semester progression review live in one registry."
                icon={<GraduationCap size={18} />}
                tone={ADMIN_SECTION_TONES.students}
                active={false}
                onClick={() => {
                  clearRegistryScope()
                  navigate({ section: 'students' })
                }}
              />
              <SectionLaunchCard
                title="Faculty"
                caption={`${data.facultyMembers.length} profiles · ${data.ownerships.filter(item => item.status === 'active').length} active teaching assignments`}
                helper="Appointments, permissions, course ownership, mentor scope, and teaching-profile parity are all managed from the faculty registry."
                icon={<UserCog size={18} />}
                tone={ADMIN_SECTION_TONES['faculty-members']}
                active={false}
                onClick={() => {
                  clearRegistryScope()
                  navigate({ section: 'faculty-members' })
                }}
              />
            </div>
            <Card style={{ padding: 18, display: 'grid', gap: 12, background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <HeroBadge color={T.accent}><Bell size={12} /> Action Queue {actionQueueCount}</HeroBadge>
                <HeroBadge color={T.warning}><Clock3 size={12} /> Open Requests {openRequests.length}</HeroBadge>
                <HeroBadge color={T.danger}><RefreshCw size={12} /> Recycle Bin {deletedItems.length}</HeroBadge>
                <HeroBadge color={remindersSupported ? T.success : T.orange}><CheckCircle2 size={12} /> {remindersSupported ? `Private Reminders ${pendingReminders.length}` : 'Reminder API offline on this backend'}</HeroBadge>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                The right rail is the operational queue. This dashboard stays intentionally light so the three launch blocks remain the primary wayfinding surface instead of competing with another summary panel.
              </div>
            </Card>
          </div>
        )}

        {/* ========== FACULTIES (selector workspace) ========== */}
        {route.section === 'faculties' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="University"
              eyebrow="Hierarchy Control"
              caption="Selector-driven control for academic faculty, department, branch, year, section, policy, and semester-wise course setup."
              toneColor={ADMIN_SECTION_TONES.faculties}
              actions={
                <>
                  {canNavigateUniversityPanelBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateUniversityPanelBack}><ChevronLeft size={14} /> Back In Panel</Btn> : null}
                  {canNavigatePageBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateBack}><ChevronLeft size={14} /> Back Page</Btn> : null}
                </>
              }
            />

            <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <div>
                  <FieldLabel>Faculty</FieldLabel>
                  <SelectInput
                    value={selectedAcademicFaculty?.academicFacultyId ?? ''}
                    onChange={event => {
                      updateSelectedSectionCode(null, { recordHistory: false })
                      navigate({ section: 'faculties', academicFacultyId: event.target.value || undefined })
                    }}
                  >
                    <option value="">All Academic Faculties</option>
                    {visibleAcademicFaculties.map(faculty => <option key={faculty.academicFacultyId} value={faculty.academicFacultyId}>{faculty.name}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Department</FieldLabel>
                  <SelectInput
                    value={selectedDepartment?.departmentId ?? ''}
                    disabled={!selectedAcademicFaculty}
                    onChange={event => {
                      updateSelectedSectionCode(null, { recordHistory: false })
                      navigate({
                        section: 'faculties',
                        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
                        departmentId: event.target.value || undefined,
                      })
                    }}
                  >
                    <option value="">{selectedAcademicFaculty ? 'Select Department' : 'Pick Faculty First'}</option>
                    {facultyDepartments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Branch</FieldLabel>
                  <SelectInput
                    value={selectedBranch?.branchId ?? ''}
                    disabled={!selectedDepartment}
                    onChange={event => {
                      updateSelectedSectionCode(null, { recordHistory: false })
                      navigate({
                        section: 'faculties',
                        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
                        departmentId: selectedDepartment?.departmentId,
                        branchId: event.target.value || undefined,
                      })
                    }}
                  >
                    <option value="">{selectedDepartment ? 'Select Branch' : 'Pick Department First'}</option>
                    {departmentBranches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Year</FieldLabel>
                  <SelectInput
                    value={selectedBatch?.batchId ?? ''}
                    disabled={!selectedBranch}
                    onChange={event => {
                      updateSelectedSectionCode(null, { recordHistory: false })
                      navigate({
                        section: 'faculties',
                        academicFacultyId: selectedAcademicFaculty?.academicFacultyId,
                        departmentId: selectedDepartment?.departmentId,
                        branchId: selectedBranch?.branchId,
                        batchId: event.target.value || undefined,
                      })
                    }}
                  >
                    <option value="">{selectedBranch ? 'Select Year' : 'Pick Branch First'}</option>
                    {branchBatches.map(batch => <option key={batch.batchId} value={batch.batchId}>{deriveCurrentYearLabel(batch.currentSemester)} · {batch.batchLabel}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Section</FieldLabel>
                  <SelectInput
                    value={selectedSectionCode ?? ''}
                    disabled={!selectedBatch}
                    onChange={event => updateSelectedSectionCode(event.target.value || null)}
                  >
                    <option value="">{selectedBatch ? 'All Sections' : 'Pick Year First'}</option>
                    {selectorSections.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>)}
                  </SelectInput>
                </div>
              </div>
              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                Search narrows automatically to the active selector scope. `Year` is a UI alias for the canonical batch record beneath it.
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
            {/* Tree explorer */}
            <Card style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Entity Rail</div>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text, marginTop: 6 }}>{universityLevelTitle}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>{universityLevelHelper}</div>
                </div>
                <Chip color={T.accent}>{universityLeftItems.length}</Chip>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {universityLeftItems.length === 0 ? (
                  <EmptyState title={`No ${universityLevelTitle.toLowerCase()} yet`} body="Use the forms on the right to create the first record in this scope." />
                ) : universityLeftItems.map(item => (
                  <EntityButton key={item.key} selected={item.selected} onClick={item.onSelect}>
                    <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.title}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.subtitle}</div>
                  </EntityButton>
                ))}
              </div>

              {!selectedAcademicFaculty ? (
                <form onSubmit={handleCreateAcademicFaculty} style={{ display: 'grid', gap: 8, marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={14} color={T.accent} />
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Academic Faculty</div>
                  </div>
                  <TextInput value={structureForms.academicFaculty.code} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} placeholder="ENG" />
                  <TextInput value={structureForms.academicFaculty.name} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} placeholder="Engineering and Technology" />
                  <TextAreaInput value={structureForms.academicFaculty.overview} onChange={event => setStructureForms(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} placeholder="Overview" rows={2} />
                  <Btn type="submit"><Plus size={14} /> Add Faculty</Btn>
                </form>
              ) : null}
            </Card>

            {/* Right: detail panel */}
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <Card style={{ padding: 16, display: 'grid', gap: 14, background: T.surface2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subpanel</div>
                    <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text, marginTop: 6 }}>{universityContextLabel}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                      If you do not switch tabs, this area behaves as a scoped navigator plus metadata surface. Once a batch is selected, the policy controls split into bands, CE/SEE, and CGPA views.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedBranch ? <Chip color={T.success}>{selectedBranch.programLevel}</Chip> : null}
                    {selectedBatch ? <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Override active' : 'Inherited policy'}</Chip> : null}
                    {canNavigateUniversityPanelBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateUniversityPanelBack}><ChevronLeft size={14} /> Back In Panel</Btn> : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'overview' as const, label: 'Overview', icon: <LayoutDashboard size={13} /> },
                    { id: 'bands' as const, label: 'Bands', icon: <CheckCircle2 size={13} /> },
                    { id: 'ce-see' as const, label: 'CE / SEE', icon: <Compass size={13} /> },
                    { id: 'cgpa' as const, label: 'CGPA', icon: <GraduationCap size={13} /> },
                    ...(selectedBranch ? [{ id: 'courses' as const, label: 'Courses', icon: <BookOpen size={13} /> }] : []),
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      data-tab="true"
                      onClick={() => updateUniversityTab(tab.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 8,
                        border: `1px solid ${universityTab === tab.id ? T.accent : T.border}`,
                        background: universityTab === tab.id ? `${T.accent}16` : 'transparent',
                        color: universityTab === tab.id ? T.accentLight : T.muted,
                        cursor: 'pointer',
                        padding: '8px 12px',
                        ...mono,
                        fontSize: 10,
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </Card>

              {universityTab === 'overview' && (
                <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 10 }}>
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Overview Navigator · {universityNavigatorTitle}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    {universityNavigatorHelper}
                  </div>
                  {universityNextItems.length === 0 ? (
                    <Card style={{ padding: 14, background: T.surface }}>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                        {selectedSectionCode
                          ? 'No further hierarchy level exists below section. Use the tabs above or jump into the scoped student or faculty pages below.'
                          : 'The next-level cards appear here as soon as the current level on the left is selected.'}
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                      {universityNextItems.map(item => (
                        <button key={item.key} type="button" onClick={item.onSelect} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface, padding: '12px 14px', cursor: 'pointer', transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease' }}>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.title}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {!selectedAcademicFaculty ? (
                <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select an academic faculty in the tree to begin, or create one below." />
              ) : null}

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

              {universityTab === 'bands' && (
                selectedBatch ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="Academic Bands" eyebrow="Evaluation" caption="Current repo defaults seed the table; save here to keep a batch-specific override." />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>O Minimum</FieldLabel><TextInput value={policyForm.oMin} onChange={event => setPolicyForm(prev => ({ ...prev, oMin: event.target.value }))} /></div>
                      <div><FieldLabel>A+ Minimum</FieldLabel><TextInput value={policyForm.aPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, aPlusMin: event.target.value }))} /></div>
                      <div><FieldLabel>A Minimum</FieldLabel><TextInput value={policyForm.aMin} onChange={event => setPolicyForm(prev => ({ ...prev, aMin: event.target.value }))} /></div>
                      <div><FieldLabel>B+ Minimum</FieldLabel><TextInput value={policyForm.bPlusMin} onChange={event => setPolicyForm(prev => ({ ...prev, bPlusMin: event.target.value }))} /></div>
                      <div><FieldLabel>B Minimum</FieldLabel><TextInput value={policyForm.bMin} onChange={event => setPolicyForm(prev => ({ ...prev, bMin: event.target.value }))} /></div>
                      <div><FieldLabel>C Minimum</FieldLabel><TextInput value={policyForm.cMin} onChange={event => setPolicyForm(prev => ({ ...prev, cMin: event.target.value }))} /></div>
                      <div><FieldLabel>P Minimum</FieldLabel><TextInput value={policyForm.pMin} onChange={event => setPolicyForm(prev => ({ ...prev, pMin: event.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn onClick={handleSaveBatchPolicy}><CheckCircle2 size={14} /> Save Bands</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetBatchPolicy()}>Reset To Inherited</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="Select a year" body="Bands are editable once year scope is selected." />
              )}

              {universityTab === 'ce-see' && (
                selectedBatch ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="CE / SEE Split" eyebrow="Assessment" caption="Configure CE, SEE, and internal assessment caps for the selected year." />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>CE</FieldLabel><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></div>
                      <div><FieldLabel>SEE</FieldLabel><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></div>
                      <div><FieldLabel>TT Weight</FieldLabel><TextInput value={policyForm.termTestsWeight} onChange={event => setPolicyForm(prev => ({ ...prev, termTestsWeight: event.target.value }))} /></div>
                      <div><FieldLabel>Quiz Weight</FieldLabel><TextInput value={policyForm.quizWeight} onChange={event => setPolicyForm(prev => ({ ...prev, quizWeight: event.target.value }))} /></div>
                      <div><FieldLabel>Assignment Weight</FieldLabel><TextInput value={policyForm.assignmentWeight} onChange={event => setPolicyForm(prev => ({ ...prev, assignmentWeight: event.target.value }))} /></div>
                      <div><FieldLabel>Max TTs</FieldLabel><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></div>
                      <div><FieldLabel>Max Quizzes</FieldLabel><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></div>
                      <div><FieldLabel>Max Assignments</FieldLabel><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></div>
                      <div><FieldLabel>Day Start</FieldLabel><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></div>
                      <div><FieldLabel>Day End</FieldLabel><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></div>
                    </div>
                    <div>
                      <FieldLabel>Working Days</FieldLabel>
                      <DayToggle days={WEEKDAYS} selected={policyForm.workingDays} onChange={next => setPolicyForm(prev => ({ ...prev, workingDays: next as PolicyFormState['workingDays'] }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn onClick={handleSaveBatchPolicy}><CheckCircle2 size={14} /> Save CE / SEE</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetBatchPolicy()}>Reset To Inherited</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="Select a year" body="CE/SEE rules are editable once year scope is selected." />
              )}

              {universityTab === 'cgpa' && (
                selectedBatch ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="CGPA And Progression" eyebrow="Rules" caption="Use the current repo defaults as a starting point, then tune promotion rules per year." />
                    <Card style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.9 }}>
                        CE + SEE → M → Letter Grade → Grade Point<br />
                        SGPA = Σ(credit × grade point) / Σ credits<br />
                        CGPA = Σ(all credits × all grade points) / Σ all credits
                      </div>
                    </Card>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>Pass Mark Percent</FieldLabel><TextInput value={policyForm.passMarkPercent} onChange={event => setPolicyForm(prev => ({ ...prev, passMarkPercent: event.target.value }))} /></div>
                      <div><FieldLabel>Minimum CGPA For Promotion</FieldLabel><TextInput value={policyForm.minimumCgpaForPromotion} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCgpaForPromotion: event.target.value }))} /></div>
                      <div>
                        <FieldLabel>Repeated Course Policy</FieldLabel>
                        <SelectInput value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))}>
                          <option value="latest-attempt">Latest attempt</option>
                          <option value="best-attempt">Best attempt</option>
                        </SelectInput>
                      </div>
                      <div>
                        <FieldLabel>Promotion Rule</FieldLabel>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                          <input type="checkbox" checked={policyForm.requireNoActiveBacklogs} onChange={event => setPolicyForm(prev => ({ ...prev, requireNoActiveBacklogs: event.target.checked }))} />
                          Require no active backlogs
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn onClick={handleSaveBatchPolicy}><CheckCircle2 size={14} /> Save CGPA Rules</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetBatchPolicy()}>Reset To Inherited</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="Select a year" body="CGPA and progression rules are editable once year scope is selected." />
              )}

              {universityTab === 'courses' && (
                selectedBranch ? (
                  selectedBatch ? (
                    <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                      <SectionHeading title="Semester Courses" eyebrow="Curriculum" caption="Semester-wise course rows, credits, and scoped course leader visibility for the selected year." />
                      {curriculumBySemester.length === 0 ? <EmptyState title="No semester rows yet" body="Add the first course row below." /> : curriculumBySemester.map(entry => (
                        <Card key={entry.semesterNumber} style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                          <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Semester {entry.semesterNumber}</div>
                          {entry.courses.map(course => (
                            <div key={course.curriculumCourseId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 110px minmax(220px, 0.9fr) auto', gap: 10, alignItems: 'center' }}>
                              {(() => {
                                const leaderState = getScopedCourseLeaderState(course.curriculumCourseId)
                                return (
                                  <>
                                    <div>
                                      <div style={{ ...mono, fontSize: 11, color: T.text }}>{course.courseCode} · {course.title}</div>
                                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Semester {entry.semesterNumber} · {leaderState.matchingOfferings.length} live offering{leaderState.matchingOfferings.length === 1 ? '' : 's'} in scope</div>
                                    </div>
                                    <div style={{ ...mono, fontSize: 10, color: T.text }}>{course.credits} credits</div>
                                    <div style={{ display: 'grid', gap: 6 }}>
                                      <SelectInput
                                        value={leaderState.selectedFacultyId}
                                        disabled={leaderState.matchingOfferings.length === 0}
                                        onChange={event => void handleAssignCurriculumCourseLeader(course.curriculumCourseId, event.target.value)}
                                      >
                                        <option value="">{leaderState.hasMultipleLeaders ? 'Multiple leaders assigned' : leaderState.matchingOfferings.length === 0 ? 'No offerings in scope yet' : 'Clear course leader'}</option>
                                        {scopedCourseLeaderFaculty.map(member => <option key={member.facultyId} value={member.facultyId}>{member.displayName} · {member.employeeCode}</option>)}
                                      </SelectInput>
                                      <div style={{ ...mono, fontSize: 10, color: leaderState.hasMultipleLeaders ? T.warning : T.accent }}>
                                        {leaderState.hasMultipleLeaders
                                          ? getUniversityCourseLeaders(course.courseCode).join(', ')
                                          : getUniversityCourseLeaders(course.courseCode).join(', ') || 'Course leader not assigned'}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      <Btn size="sm" variant="ghost" onClick={() => startEditingCurriculumCourse(course.curriculumCourseId)}>Edit</Btn>
                                      <Btn
                                        size="sm"
                                        variant="danger"
                                        onClick={() => {
                                          if (window.confirm(`Delete curriculum row ${course.courseCode}?`)) {
                                            void handleArchiveCurriculumCourse(course.curriculumCourseId)
                                          }
                                        }}
                                      >
                                        Delete
                                      </Btn>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          ))}
                        </Card>
                      ))}
                      <form onSubmit={handleSaveCurriculumCourse} style={{ display: 'grid', gap: 10 }}>
                        <div><FieldLabel>Semester Number</FieldLabel><TextInput value={entityEditors.curriculum.semesterNumber} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, semesterNumber: event.target.value } }))} placeholder="Semester" /></div>
                        <div><FieldLabel>Course Code</FieldLabel><TextInput value={entityEditors.curriculum.courseCode} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, courseCode: event.target.value } }))} placeholder="CS699" /></div>
                        <div><FieldLabel>Course Title</FieldLabel><TextInput value={entityEditors.curriculum.title} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, title: event.target.value } }))} placeholder="Advanced Governance Systems" /></div>
                        <div><FieldLabel>Credits</FieldLabel><TextInput value={entityEditors.curriculum.credits} onChange={event => setEntityEditors(prev => ({ ...prev, curriculum: { ...prev.curriculum, credits: event.target.value } }))} placeholder="4" /></div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <Btn type="submit">{entityEditors.curriculum.curriculumCourseId ? 'Save Curriculum Course' : 'Add Curriculum Course'}</Btn>
                          {entityEditors.curriculum.curriculumCourseId ? <Btn type="button" variant="ghost" onClick={resetCurriculumEditor}>Cancel Edit</Btn> : null}
                        </div>
                      </form>
                    </Card>
                  ) : (
                    <Card style={{ padding: 18, display: 'grid', gap: 10 }}>
                      <SectionHeading title="Pick A Year" eyebrow="Courses" caption="Course editing unlocks at branch level, but semester-wise rows belong to a selected year." />
                      {branchBatches.map(batch => (
                        <button key={batch.batchId} type="button" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })} style={{ textAlign: 'left', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, padding: '12px 14px', cursor: 'pointer' }}>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sections {batch.sectionLabels.join(', ')}</div>
                        </button>
                      ))}
                    </Card>
                  )
                ) : <EmptyState title="Select a branch" body="Courses are only editable after branch scope is selected." />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={14} color={ADMIN_SECTION_TONES.students} />
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Students View</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    Open the student registry scoped to {activeUniversityRegistryScope?.label ?? 'the current hierarchy view'}.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={ADMIN_SECTION_TONES.students}>{filteredUniversityStudents.length} visible</Chip>
                    {selectedSectionCode ? <Chip color={T.accent}>Section scope</Chip> : selectedBatch ? <Chip color={T.accent}>Year scope</Chip> : selectedBranch ? <Chip color={T.accent}>Branch scope</Chip> : selectedDepartment ? <Chip color={T.accent}>Department scope</Chip> : selectedAcademicFaculty ? <Chip color={T.accent}>Faculty scope</Chip> : <Chip color={T.dim}>All students</Chip>}
                  </div>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenScopedRegistry('students')}>Open Students Page</Btn>
                </Card>

                <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserCog size={14} color={ADMIN_SECTION_TONES['faculty-members']} />
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Faculty View</div>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    Open the faculty registry scoped to {activeUniversityRegistryScope?.label ?? 'the current hierarchy view'}.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={ADMIN_SECTION_TONES['faculty-members']}>{filteredUniversityFaculty.length} visible</Chip>
                    {selectedSectionCode ? <Chip color={T.accent}>Section scope</Chip> : selectedBatch ? <Chip color={T.accent}>Year scope</Chip> : selectedBranch ? <Chip color={T.accent}>Branch scope</Chip> : selectedDepartment ? <Chip color={T.accent}>Department scope</Chip> : selectedAcademicFaculty ? <Chip color={T.accent}>Faculty scope</Chip> : <Chip color={T.dim}>All faculty</Chip>}
                  </div>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenScopedRegistry('faculty-members')}>Open Faculty Page</Btn>
                </Card>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ========== STUDENTS ========== */}
        {route.section === 'students' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 410px) minmax(420px, 1fr)' }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading
                title="Students"
                eyebrow="Registry"
                caption={registryScope ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Filtered to ${registryScope.label}.` : 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history.'}
                toneColor={ADMIN_SECTION_TONES.students}
                actions={
                  <>
                    {registryScope ? <Btn type="button" size="sm" variant="ghost" onClick={handleReturnToScopedUniversity}><ChevronLeft size={14} /> Back To University</Btn> : null}
                    {canNavigatePageBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateBack}><ChevronLeft size={14} /> Back Page</Btn> : null}
                  </>
                }
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn type="button" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}><Plus size={14} /> New Student</Btn>
                <Chip color={T.accent}>{studentRegistryItems.length} active</Chip>
                <Chip color={T.warning}>{studentRegistryItems.filter(item => !item.activeMentorAssignment).length} mentor gaps</Chip>
                {registryScope ? <Chip color={ADMIN_SECTION_TONES.students}>{registryScope.label}</Chip> : null}
              </div>
              {studentRegistryItems.map(student => (
                <EntityButton key={student.studentId} selected={route.studentId === student.studentId} onClick={() => navigate({ section: 'students', studentId: student.studentId })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{student.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{student.usn} · {student.activeAcademicContext?.branchName ?? 'No branch mapped'}</div>
                    </div>
                    <Chip color={student.activeMentorAssignment ? T.success : T.warning} size={9}>{student.activeMentorAssignment ? 'Mentored' : 'Mentor missing'}</Chip>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.success, marginTop: 6 }}>CGPA {student.currentCgpa.toFixed(2)} · Semester {student.activeAcademicContext?.semesterNumber ?? '—'} · Section {student.activeAcademicContext?.sectionCode ?? '—'}</div>
                </EntityButton>
              ))}
              {studentRegistryItems.length === 0 ? <InfoBanner message="No active students yet. Create the first student record from this panel." /> : null}
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title={selectedStudent ? 'Student Detail' : 'Create Student'} eyebrow={selectedStudent ? selectedStudent.name : 'New record'} caption="Save the identity record first, then maintain enrollment, mentor, and promotion details below." />
                {selectedStudent ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                    <Chip color={T.success}>CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                    <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                    <Chip color={selectedStudent.status === 'active' ? T.success : T.danger}>{selectedStudent.status}</Chip>
                  </div>
                ) : null}
                <form onSubmit={handleSaveStudent} style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div><FieldLabel>Name</FieldLabel><TextInput value={studentForm.name} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Student name" /></div>
                    <div><FieldLabel>University ID / USN</FieldLabel><TextInput value={studentForm.usn} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} placeholder="1MS22CS001" /></div>
                    <div><FieldLabel>Roll Number</FieldLabel><TextInput value={studentForm.rollNumber} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} placeholder="Optional" /></div>
                    <div><FieldLabel>Admission Date</FieldLabel><TextInput value={studentForm.admissionDate} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                    <div><FieldLabel>Email</FieldLabel><TextInput value={studentForm.email} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} placeholder="student@campus.edu" /></div>
                    <div><FieldLabel>Phone</FieldLabel><TextInput value={studentForm.phone} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="submit">{selectedStudent ? 'Save Student' : 'Create Student'}</Btn>
                    <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>{selectedStudent ? 'New Student' : 'Clear Form'}</Btn>
                    {selectedStudent ? <Btn type="button" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn> : null}
                  </div>
                </form>
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Academic Context" eyebrow="Enrollment" caption="Keep branch, term, section, and academic standing aligned with the canonical term structure." />
                {!selectedStudent ? <EmptyState title="Save the student first" body="Enrollment editing becomes available after the student record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedStudent.enrollments.length === 0 ? <InfoBanner message="No enrollment trail exists yet for this student." /> : selectedStudent.enrollments.map(enrollment => {
                        const term = data.terms.find(item => item.termId === enrollment.termId)
                        const branch = resolveBranch(data, enrollment.branchId)
                        return (
                          <Card key={enrollment.enrollmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{branch?.name ?? 'Unknown branch'} · Semester {term?.semesterNumber ?? '—'} · Section {enrollment.sectionCode}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{term?.academicYearLabel ?? enrollment.termId} · {formatDate(enrollment.startDate)} to {enrollment.endDate ? formatDate(enrollment.endDate) : 'Active'} · {enrollment.academicStatus}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingEnrollment(enrollment)}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleCloseEnrollment(enrollment)}>Close</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveEnrollment} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Branch</FieldLabel>
                          <SelectInput value={enrollmentForm.branchId} onChange={event => setEnrollmentForm(prev => ({ ...prev, branchId: event.target.value, termId: '' }))}>
                            <option value="">Select branch</option>
                            {visibleBranches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Term</FieldLabel>
                          <SelectInput value={enrollmentForm.termId} onChange={event => {
                            const nextTerm = visibleTerms.find(item => item.termId === event.target.value)
                            setEnrollmentForm(prev => ({
                              ...prev,
                              termId: event.target.value,
                              branchId: nextTerm?.branchId ?? prev.branchId,
                              startDate: nextTerm?.startDate ?? prev.startDate,
                            }))
                          }}>
                            <option value="">Select term</option>
                            {termsForEnrollment.map(term => <option key={term.termId} value={term.termId}>{term.academicYearLabel} · Semester {term.semesterNumber}</option>)}
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Section</FieldLabel><TextInput value={enrollmentForm.sectionCode} onChange={event => setEnrollmentForm(prev => ({ ...prev, sectionCode: event.target.value.toUpperCase() }))} placeholder="A" /></div>
                        <div><FieldLabel>Academic Status</FieldLabel><TextInput value={enrollmentForm.academicStatus} onChange={event => setEnrollmentForm(prev => ({ ...prev, academicStatus: event.target.value }))} placeholder="regular / repeat / backlog" /></div>
                        <div><FieldLabel>Roster Order</FieldLabel><TextInput value={enrollmentForm.rosterOrder} onChange={event => setEnrollmentForm(prev => ({ ...prev, rosterOrder: event.target.value }))} placeholder="0" /></div>
                        <div><FieldLabel>Start Date</FieldLabel><TextInput value={enrollmentForm.startDate} onChange={event => setEnrollmentForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>End Date</FieldLabel><TextInput value={enrollmentForm.endDate} onChange={event => setEnrollmentForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{enrollmentForm.enrollmentId ? 'Save Enrollment' : 'Add Enrollment'}</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setEnrollmentForm(selectedStudentEnrollment ? {
                          enrollmentId: selectedStudentEnrollment.enrollmentId,
                          branchId: selectedStudentEnrollment.branchId,
                          termId: selectedStudentEnrollment.termId,
                          sectionCode: selectedStudentEnrollment.sectionCode,
                          rosterOrder: String(selectedStudentEnrollment.rosterOrder ?? 0),
                          academicStatus: selectedStudentEnrollment.academicStatus,
                          startDate: selectedStudentEnrollment.startDate,
                          endDate: selectedStudentEnrollment.endDate ?? '',
                        } : {
                          ...defaultEnrollmentForm(),
                          branchId: selectedStudent.activeAcademicContext?.branchId ?? '',
                          termId: selectedStudent.activeAcademicContext?.termId ?? '',
                          sectionCode: selectedStudent.activeAcademicContext?.sectionCode ?? 'A',
                        })}>Reset Enrollment Form</Btn>
                      </div>
                    </form>
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Mentor Linkage" eyebrow="Faculty" caption="Only faculty with an active mentor permission are shown as eligible mentors." />
                {!selectedStudent ? <EmptyState title="Save the student first" body="Mentor assignment becomes available after the student record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedStudent.mentorAssignments.length === 0 ? <InfoBanner message="No mentor assignments recorded yet." /> : selectedStudent.mentorAssignments.map(assignment => {
                        const mentor = resolveFacultyMember(data, assignment.facultyId)
                        return (
                          <Card key={assignment.assignmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{mentor?.displayName ?? assignment.facultyId}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{assignment.source} · {formatDate(assignment.effectiveFrom)} to {assignment.effectiveTo ? formatDate(assignment.effectiveTo) : 'Active'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingMentorAssignment(assignment)}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleEndMentorAssignment(assignment)}>End</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveMentorAssignment} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Eligible Mentor</FieldLabel>
                          <SelectInput value={mentorForm.facultyId} onChange={event => setMentorForm(prev => ({ ...prev, facultyId: event.target.value }))}>
                            <option value="">Select mentor</option>
                            {mentorEligibleFaculty.map(member => <option key={member.facultyId} value={member.facultyId}>{member.displayName} · {member.employeeCode}</option>)}
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Effective From</FieldLabel><TextInput value={mentorForm.effectiveFrom} onChange={event => setMentorForm(prev => ({ ...prev, effectiveFrom: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>Effective To</FieldLabel><TextInput value={mentorForm.effectiveTo} onChange={event => setMentorForm(prev => ({ ...prev, effectiveTo: event.target.value }))} placeholder="Leave blank while active" /></div>
                        <div><FieldLabel>Source</FieldLabel><TextInput value={mentorForm.source} onChange={event => setMentorForm(prev => ({ ...prev, source: event.target.value }))} placeholder="sysadmin-manual" /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{mentorForm.assignmentId ? 'Save Mentor Link' : 'Assign Mentor'}</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setMentorForm(selectedStudentMentorAssignment ? {
                          assignmentId: selectedStudentMentorAssignment.assignmentId,
                          facultyId: selectedStudentMentorAssignment.facultyId,
                          effectiveFrom: selectedStudentMentorAssignment.effectiveFrom,
                          effectiveTo: selectedStudentMentorAssignment.effectiveTo ?? '',
                          source: selectedStudentMentorAssignment.source,
                        } : defaultMentorAssignmentForm())}>Reset Mentor Form</Btn>
                      </div>
                    </form>
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Promotion Review" eyebrow="Semester Progression" caption="Recommendations use the configured CGPA rule and backlog guard, then wait for explicit admin confirmation." />
                {!selectedStudent ? <EmptyState title="Select a student" body="Promotion review appears when a student with an academic context is selected." /> : !selectedStudent.activeAcademicContext ? (
                  <EmptyState title="No active academic context" body="Create or restore an enrollment before using the promotion panel." />
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedStudentPromotionRecommended ? T.success : T.warning}>{selectedStudentPromotionRecommended ? 'Recommended' : 'Hold for review'}</Chip>
                      <Chip color={T.accent}>Current CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                      <Chip color={T.warning}>Min CGPA {selectedStudentPromotionRules.minimumCgpaForPromotion.toFixed(1)}</Chip>
                      {selectedStudentPolicyLoading ? <Chip color={T.dim}>Loading policy…</Chip> : null}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.9 }}>
                      Current semester: {selectedStudent.activeAcademicContext.semesterNumber ?? '—'} · Academic status: {selectedStudent.activeAcademicContext.academicStatus}<br />
                      Promotion rule: {selectedStudentPromotionRules.requireNoActiveBacklogs ? 'Require no active backlogs' : 'Backlog check disabled'} · Pass threshold {selectedStudentPromotionRules.passMarkPercent}%
                    </div>
                    {selectedStudentNextTerms.length === 0 ? <InfoBanner message="No next-semester term is configured yet for this branch. Add the next term in the university workspace first." /> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedStudentNextTerms.map(term => (
                          <Card key={term.termId} style={{ padding: 12, background: T.surface2, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{term.academicYearLabel} · Semester {term.semesterNumber}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatDate(term.startDate)} to {formatDate(term.endDate)}</div>
                            </div>
                            <Btn type="button" onClick={() => void handlePromoteStudent(term.termId)}>Promote Into This Term</Btn>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <SectionHeading title="History" eyebrow="Audit Trail" caption="Every student, enrollment, and mentor change lands here so deletions and corrections stay traceable." />
                {studentAuditLoading ? <InfoBanner message="Loading audit history…" /> : null}
                {!studentAuditLoading && studentAuditEvents.length === 0 ? <EmptyState title="No audit trail yet" body="Student create/update activity will appear here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {studentAuditEvents.slice(0, 16).map(item => (
                      <Card key={item.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{item.entityType} · {summarizeAuditEvent(item)}</div>
                          <Chip color={T.accent} size={9}>{formatDateTime(item.createdAt)}</Chip>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.entityId}{item.actorRole ? ` · ${item.actorRole}` : ''}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ========== FACULTY MEMBERS ========== */}
        {route.section === 'faculty-members' && (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 410px) minmax(420px, 1fr)' }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              <SectionHeading
                title="Faculty Members"
                eyebrow="Registry"
                caption={registryScope ? `Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here. Filtered to ${registryScope.label}.` : 'Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here.'}
                toneColor={ADMIN_SECTION_TONES['faculty-members']}
                actions={
                  <>
                    {registryScope ? <Btn type="button" size="sm" variant="ghost" onClick={handleReturnToScopedUniversity}><ChevronLeft size={14} /> Back To University</Btn> : null}
                    {canNavigatePageBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateBack}><ChevronLeft size={14} /> Back Page</Btn> : null}
                  </>
                }
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn type="button" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}><Plus size={14} /> New Faculty</Btn>
                <Chip color={T.accent}>{facultyRegistryItems.length} active</Chip>
                <Chip color={T.warning}>{facultyRegistryItems.filter(item => !item.roleGrants.some(grant => isCurrentRoleGrant(grant))).length} no active permissions</Chip>
                {registryScope ? <Chip color={ADMIN_SECTION_TONES['faculty-members']}>{registryScope.label}</Chip> : null}
              </div>
              {facultyRegistryItems.map(item => {
                const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(item))
                return (
                  <EntityButton key={item.facultyId} selected={route.facultyMemberId === item.facultyId} onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.facultyId })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.displayName}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No primary department'}</div>
                      </div>
                      <Chip color={item.roleGrants.some(grant => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)) ? T.success : T.dim} size={9}>{item.roleGrants.some(grant => isCurrentRoleGrant(grant)) ? 'Scoped' : 'Unscoped'}</Chip>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {item.roleGrants.filter(isCurrentRoleGrant).slice(0, 3).map(grant => <Chip key={grant.grantId} color={T.accent} size={9}>{grant.roleCode}</Chip>)}
                    </div>
                  </EntityButton>
                )
              })}
              {facultyRegistryItems.length === 0 ? <InfoBanner message="No active faculty profiles yet. Create the first faculty record from this panel." /> : null}
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title={selectedFacultyMember ? 'Faculty Detail' : 'Create Faculty'} eyebrow={selectedFacultyMember ? selectedFacultyMember.displayName : 'New profile'} caption="Master identity stays admin-owned. Teaching workflow actions continue in the teaching workspace." />
                {selectedFacultyMember ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={T.accent}>{selectedFacultyMember.employeeCode}</Chip>
                    <Chip color={T.warning}>{resolveDepartment(data, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'No primary department'}</Chip>
                    {selectedFacultyMember.roleGrants.filter(isCurrentRoleGrant).map(grant => <Chip key={grant.grantId} color={T.success}>{grant.roleCode}</Chip>)}
                  </div>
                ) : null}
                <form onSubmit={handleSaveFaculty} style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div><FieldLabel>Display Name</FieldLabel><TextInput value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} placeholder="Faculty name" /></div>
                    <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} placeholder="EMP001" /></div>
                    <div><FieldLabel>Username</FieldLabel><TextInput value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} placeholder="faculty.user" /></div>
                    <div><FieldLabel>Email</FieldLabel><TextInput value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} placeholder="faculty@campus.edu" /></div>
                    <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" /></div>
                    <div><FieldLabel>Designation</FieldLabel><TextInput value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} placeholder="Assistant Professor" /></div>
                    {!selectedFacultyMember ? <div><FieldLabel>Initial Password</FieldLabel><TextInput type="password" value={facultyForm.password} onChange={event => setFacultyForm(prev => ({ ...prev, password: event.target.value }))} placeholder="Minimum 8 characters" /></div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="submit">{selectedFacultyMember ? 'Save Faculty' : 'Create Faculty'}</Btn>
                    <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>{selectedFacultyMember ? 'New Faculty' : 'Clear Form'}</Btn>
                    {selectedFacultyMember ? <Btn type="button" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn> : null}
                  </div>
                </form>
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Appointments" eyebrow="Canonical Affiliation" caption="Department and branch affiliation stay canonical here, even when HoD visibility rolls up external teaching activity." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Appointments become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.appointments.length === 0 ? <InfoBanner message="No appointments recorded yet." /> : selectedFacultyMember.appointments.map(appointment => {
                        const department = resolveDepartment(data, appointment.departmentId)
                        const branch = resolveBranch(data, appointment.branchId)
                        return (
                          <Card key={appointment.appointmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{department?.name ?? 'Unknown department'}{branch ? ` · ${branch.name}` : ''}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{appointment.isPrimary ? 'Primary appointment' : 'Supporting appointment'} · {formatDate(appointment.startDate)} to {appointment.endDate ? formatDate(appointment.endDate) : 'Active'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingAppointment(appointment)}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveAppointment(appointment)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveAppointment} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Department</FieldLabel>
                          <SelectInput value={appointmentForm.departmentId} onChange={event => setAppointmentForm(prev => ({ ...prev, departmentId: event.target.value, branchId: '' }))}>
                            <option value="">Select department</option>
                            {visibleDepartments.map(department => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Branch</FieldLabel>
                          <SelectInput value={appointmentForm.branchId} onChange={event => setAppointmentForm(prev => ({ ...prev, branchId: event.target.value }))}>
                            <option value="">No branch / department-wide</option>
                            {branchesForAppointment.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Start Date</FieldLabel><TextInput value={appointmentForm.startDate} onChange={event => setAppointmentForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>End Date</FieldLabel><TextInput value={appointmentForm.endDate} onChange={event => setAppointmentForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
                        <div>
                          <FieldLabel>Primary Appointment</FieldLabel>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                            <input type="checkbox" checked={appointmentForm.isPrimary} onChange={event => setAppointmentForm(prev => ({ ...prev, isPrimary: event.target.checked }))} />
                            Mark as primary
                          </label>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{appointmentForm.appointmentId ? 'Save Appointment' : 'Add Appointment'}</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setAppointmentForm(selectedFacultyMember.appointments.find(item => item.isPrimary) ? {
                          appointmentId: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.appointmentId,
                          departmentId: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.departmentId,
                          branchId: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.branchId ?? '',
                          isPrimary: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.isPrimary,
                          startDate: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.startDate,
                          endDate: (selectedFacultyMember.appointments.find(item => item.isPrimary) ?? selectedFacultyMember.appointments[0])!.endDate ?? '',
                        } : defaultAppointmentForm())}>Reset Appointment Form</Btn>
                      </div>
                    </form>
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Permissions" eyebrow="Role Grants" caption="Mentor, HoD, Course Leader, and System Admin permissions stay separate from actual class ownership." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Permissions become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.roleGrants.length === 0 ? <InfoBanner message="No permissions granted yet." /> : selectedFacultyMember.roleGrants.map(grant => (
                        <Card key={grant.grantId} style={{ padding: 12, background: T.surface2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{grant.roleCode}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{grant.scopeType}:{grant.scopeId} · {grant.startDate ?? 'No start'} to {grant.endDate ?? 'Active'} · {grant.status}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingRoleGrant(grant)}>Edit</Btn>
                              <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveRoleGrant(grant)}>Delete</Btn>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <form onSubmit={handleSaveRoleGrant} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Role</FieldLabel>
                          <SelectInput value={roleGrantForm.roleCode} onChange={event => setRoleGrantForm(prev => ({ ...prev, roleCode: event.target.value as ApiRoleCode }))}>
                            <option value="MENTOR">MENTOR</option>
                            <option value="HOD">HOD</option>
                            <option value="COURSE_LEADER">COURSE_LEADER</option>
                            <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Scope Type</FieldLabel>
                          <SelectInput value={roleGrantForm.scopeType} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeType: event.target.value, scopeId: '' }))}>
                            <option value="institution">institution</option>
                            <option value="academic-faculty">academic-faculty</option>
                            <option value="department">department</option>
                            <option value="branch">branch</option>
                            <option value="batch">batch</option>
                            <option value="offering">offering</option>
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Scope</FieldLabel>
                          {scopeOptions.length > 0 ? (
                            <SelectInput value={roleGrantForm.scopeId} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeId: event.target.value }))}>
                              <option value="">Select scope</option>
                              {scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </SelectInput>
                          ) : (
                            <TextInput value={roleGrantForm.scopeId} onChange={event => setRoleGrantForm(prev => ({ ...prev, scopeId: event.target.value }))} placeholder="Scope id" />
                          )}
                        </div>
                        <div><FieldLabel>Start Date</FieldLabel><TextInput value={roleGrantForm.startDate} onChange={event => setRoleGrantForm(prev => ({ ...prev, startDate: event.target.value }))} placeholder="YYYY-MM-DD" /></div>
                        <div><FieldLabel>End Date</FieldLabel><TextInput value={roleGrantForm.endDate} onChange={event => setRoleGrantForm(prev => ({ ...prev, endDate: event.target.value }))} placeholder="Leave blank while active" /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{roleGrantForm.grantId ? 'Save Permission' : 'Grant Permission'}</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setRoleGrantForm(selectedFacultyMember.roleGrants[0] ? {
                          grantId: selectedFacultyMember.roleGrants[0].grantId,
                          roleCode: selectedFacultyMember.roleGrants[0].roleCode,
                          scopeType: selectedFacultyMember.roleGrants[0].scopeType,
                          scopeId: selectedFacultyMember.roleGrants[0].scopeId,
                          startDate: selectedFacultyMember.roleGrants[0].startDate ?? new Date().toISOString().slice(0, 10),
                          endDate: selectedFacultyMember.roleGrants[0].endDate ?? '',
                        } : defaultRoleGrantForm())}>Reset Permission Form</Btn>
                      </div>
                    </form>
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Teaching Ownership" eyebrow="Classes And Course Leader Scope" caption="Assign the exact classes they own or support. The seeded default role is `owner`, and that now counts for course-leader visibility." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Teaching ownership becomes available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyOwnerships.length === 0 ? <InfoBanner message="No teaching ownership records yet." /> : selectedFacultyOwnerships.map(ownership => {
                        const offering = data.offerings.find(item => item.offId === ownership.offeringId)
                        return (
                          <Card key={ownership.ownershipId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{offering?.code ?? ownership.offeringId} · {offering?.title ?? 'Unknown offering'}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{offering?.dept ?? 'NA'} · {offering?.year ?? '—'} · Section {offering?.section ?? '—'} · {ownership.ownershipRole} · {ownership.status}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => startEditingOwnership(ownership)}>Edit</Btn>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveOwnership(ownership)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveOwnership} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Offering / Class</FieldLabel>
                          <SelectInput value={ownershipForm.offeringId} onChange={event => setOwnershipForm(prev => ({ ...prev, offeringId: event.target.value, facultyId: selectedFacultyMember.facultyId }))}>
                            <option value="">Select offering</option>
                            {visibleOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Section {offering.section}</option>)}
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Ownership Role</FieldLabel><TextInput value={ownershipForm.ownershipRole} onChange={event => setOwnershipForm(prev => ({ ...prev, ownershipRole: event.target.value }))} placeholder="owner / support / course_leader" /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit">{ownershipForm.ownershipId ? 'Save Ownership' : 'Add Ownership'}</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setOwnershipForm(selectedFacultyOwnerships[0] ? {
                          ownershipId: selectedFacultyOwnerships[0].ownershipId,
                          offeringId: selectedFacultyOwnerships[0].offeringId,
                          facultyId: selectedFacultyOwnerships[0].facultyId,
                          ownershipRole: selectedFacultyOwnerships[0].ownershipRole,
                        } : {
                          ...defaultOwnershipForm(),
                          facultyId: selectedFacultyMember.facultyId,
                        })}>Reset Ownership Form</Btn>
                      </div>
                    </form>
                    {selectedFacultyAssignments.length > 0 ? (
                      <Card style={{ padding: 12, background: T.surface }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Current Owned Classes</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {selectedFacultyAssignments.map(item => (
                            <div key={item.ownership.ownershipId} style={{ ...mono, fontSize: 10, color: T.text }}>
                              {item.offering?.code} · {item.offering?.dept} · {item.offering?.year} · Section {item.offering?.section} · {item.ownership.ownershipRole}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                  </>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Timetable Planner" eyebrow="Teaching Calendar" caption="Reuses the teacher-style drag board for class movement, then layers semester markers, term-test windows, holidays, and events in a distinct admin planning rail." />
                {!selectedFacultyMember ? <EmptyState title="Select or create a faculty member first" body="Timetable planning becomes available once the faculty profile exists." /> : facultyCalendarLoading && !facultyCalendar ? (
                  <InfoBanner message="Loading timetable planner…" />
                ) : (
                  <SystemAdminTimetableEditor
                    facultyId={selectedFacultyMember.facultyId}
                    facultyName={selectedFacultyMember.displayName}
                    offerings={selectedFacultyAssignments.flatMap(item => item.offering ? [item.offering] : [])}
                    calendar={facultyCalendar}
                    onSave={handleSaveFacultyCalendar}
                  />
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <SectionHeading title="History" eyebrow="Audit Trail" caption="Profile, appointment, permission, and class-ownership changes all land here for restore and review." />
                {facultyAuditLoading ? <InfoBanner message="Loading audit history…" /> : null}
                {!facultyAuditLoading && facultyAuditEvents.length === 0 ? <EmptyState title="No audit trail yet" body="Faculty create/update activity will appear here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {facultyAuditEvents.slice(0, 18).map(item => (
                      <Card key={item.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{item.entityType} · {summarizeAuditEvent(item)}</div>
                          <Chip color={T.accent} size={9}>{formatDateTime(item.createdAt)}</Chip>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>{item.entityId}{item.actorRole ? ` · ${item.actorRole}` : ''}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ========== HISTORY ========== */}
        {route.section === 'history' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="History And Restore"
              eyebrow="Audit + Recycle Bin"
              caption="Use one page for recent admin activity, restore-ready deletions, and the exact records that changed."
              toneColor={ADMIN_SECTION_TONES.history}
              actions={canNavigatePageBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateBack}><ChevronLeft size={14} /> Back Page</Btn> : undefined}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(420px, 1.1fr)', gap: 16, alignItems: 'start' }}>
              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Recycle Bin</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Deletes stay soft for 60 days. Restore is blocked only when a required parent still remains deleted.</div>
                  </div>
                  <Chip color={T.danger}>{deletedItems.length}</Chip>
                </div>
                {deletedItems.length === 0 ? <EmptyState title="Nothing deleted right now" body="Soft-deleted records will appear here with their restore window." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {deletedItems.map(item => {
                      const deletedDays = Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000)
                      const restoreDaysLeft = Math.max(0, 60 - deletedDays)
                      return (
                        <Card key={item.key} style={{ padding: 12, background: T.surface2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.label}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.meta} · deleted {formatDateTime(item.updatedAt)} · {restoreDaysLeft} day{restoreDaysLeft === 1 ? '' : 's'} left</div>
                            </div>
                            <Btn type="button" size="sm" onClick={() => void runAction(async () => {
                              await item.onRestore()
                              setFlashMessage(`${item.label} restored.`)
                            })}>Restore</Btn>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </Card>

              <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Recent Audit</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Recent admin changes across hierarchy, people, requests, and timetable planning.</div>
                  </div>
                  <Chip color={T.accent}>{recentAuditEvents.length}</Chip>
                </div>
                {recentAuditLoading ? <InfoBanner message="Loading recent audit activity…" /> : null}
                {!recentAuditLoading && recentAuditEvents.length === 0 ? <EmptyState title="No recent audit activity" body="New creates, updates, restores, and planner saves will surface here." /> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {recentAuditEvents.map(event => {
                      const nextRoute = getAuditEventRoute(event)
                      return (
                        <Card key={event.auditEventId} style={{ padding: 12, background: T.surface2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{event.entityType} · {summarizeAuditEvent(event)}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{event.entityId}{event.actorRole ? ` · ${event.actorRole}` : ''} · {formatDateTime(event.createdAt)}</div>
                            </div>
                            {nextRoute ? <Btn type="button" size="sm" variant="ghost" onClick={() => navigate(nextRoute)}>Open</Btn> : null}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ========== REQUESTS ========== */}
        {route.section === 'requests' && (
          <>
            <SectionHeading
              title="Requests"
              eyebrow="Workflow"
              caption="HoD-issued permanent changes move through admin review, approval, implementation, and closure."
              toneColor={ADMIN_SECTION_TONES.requests}
              actions={canNavigatePageBack ? <Btn type="button" size="sm" variant="ghost" onClick={handleNavigateBack}><ChevronLeft size={14} /> Back Page</Btn> : undefined}
            />
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
      {showActionQueue ? (
        <div className="scroll-pane scroll-pane--dense" style={{ position: 'sticky', top: 92, height: 'calc(100vh - 92px)', overflowY: 'auto', padding: '18px 16px', borderLeft: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Bell size={16} color={T.accent} />
            <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Action Queue</div>
            <Chip color={T.danger} size={10}>{actionQueueCount} active</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>
            Requests go first. {remindersSupported ? 'Personal reminders stay private to the signed-in system admin.' : 'Private reminders are hidden until the live API supports `/api/admin/reminders`.'}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Requests</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {openRequests.slice(0, 8).map(request => (
              <ActionQueueCard
                key={request.adminRequestId}
                title={request.summary}
                subtitle={`${request.requestType} · ${request.requesterName ?? request.requestedByFacultyId} · due ${formatDateTime(request.dueAt)}`}
                chips={[request.status, request.priority]}
                tone={request.status === 'Implemented' ? T.success : T.warning}
                trailing={<Chip color={request.status === 'Implemented' ? T.success : T.warning} size={9}>{request.status}</Chip>}
                onClick={() => navigate({ section: 'requests', requestId: request.adminRequestId })}
              />
            ))}
            {openRequests.length === 0 ? <InfoBanner message="No open HoD or governance requests right now." /> : null}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Personal Tasks</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {remindersSupported ? pendingReminders.map(reminder => (
              <ActionQueueCard
                key={reminder.reminderId}
                title={reminder.title}
                subtitle={`${reminder.body} · due ${formatDateTime(reminder.dueAt)}`}
                chips={[reminder.status]}
                tone={T.accent}
                trailing={<button type="button" onClick={event => { event.stopPropagation(); void handleToggleReminderStatus(reminder) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>}
              />
            )) : null}
            {remindersSupported
              ? (pendingReminders.length === 0 ? <InfoBanner message="No private admin reminders. Use the quick add button below." /> : null)
              : <InfoBanner message="This backend does not expose private reminders yet, so the queue is running in request-only mode." />}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Recycle Bin</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {deletedItems.slice(0, 4).map(item => (
              <ActionQueueCard
                key={item.key}
                title={item.label}
                subtitle={`${item.meta} · deleted ${formatDateTime(item.updatedAt)} · restore window 60 days`}
                chips={[item.meta]}
                tone={T.danger}
                trailing={<button type="button" onClick={event => { event.stopPropagation(); void runAction(async () => { await item.onRestore(); setFlashMessage(`${item.label} restored.`) }) }} style={{ ...mono, fontSize: 10, color: T.success, background: 'none', border: 'none', cursor: 'pointer' }}>Restore</button>}
              />
            ))}
            {deletedItems.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>Nothing in recycle bin.</div> : null}
          </div>

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${T.surface} 35%)` }}>
            <button type="button" onClick={() => void handleCreateReminder()} disabled={!remindersSupported} style={{ width: '100%', border: 'none', borderRadius: 10, cursor: remindersSupported ? 'pointer' : 'not-allowed', background: remindersSupported ? T.accent : T.surface3, color: remindersSupported ? '#fff' : T.dim, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...sora, fontWeight: 700, fontSize: 12 }}>
              <Plus size={14} />
              {remindersSupported ? 'Quick Add Reminder' : 'Reminder API Unavailable'}
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
