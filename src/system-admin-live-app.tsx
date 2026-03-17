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
import { AnimatePresence, motion } from 'framer-motion'
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
  ApiStudentRecord,
} from './api/types'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from './repositories'
import {
  deriveCurrentYearLabel,
  isAcademicFacultyVisible,
  isBatchVisible,
  isBranchVisible,
  isDepartmentVisible,
  isFacultyMemberVisible,
  isStudentVisible,
  isTermVisible,
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
  AdminBreadcrumbs,
  AuthFeature,
  DayToggle,
  EmptyState,
  EntityButton,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  ModalFrame,
  SectionHeading,
  SelectInput,
  TextAreaInput,
  TextInput,
  TOP_TABS,
  formatDate,
  formatDateTime,
  getReadOnlyInputStyle,
  type BreadcrumbSegment,
} from './system-admin-ui'
import type { LiveAdminSectionId } from './system-admin-live-data'
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

type StudentDetailTab = 'profile' | 'academic' | 'mentor' | 'progression' | 'history'
type FacultyDetailTab = 'profile' | 'appointments' | 'permissions' | 'teaching' | 'timetable' | 'history'
type UniversityTab = 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'courses'
type EditingEntity =
  | 'academic-faculty'
  | 'department'
  | 'branch'
  | 'batch'
  | 'student-profile'
  | 'faculty-profile'

type AdminWorkspaceSnapshot = {
  route: LiveAdminRoute
  universityTab: UniversityTab
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

type RegistryFilterState = {
  academicFacultyId: string
  departmentId: string
  branchId: string
  batchId: string
  sectionCode: string
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
const ADMIN_DISMISSED_QUEUE_STORAGE_KEY = 'airmentor-admin-dismissed-queue-items'

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

function defaultRegistryFilter(): RegistryFilterState {
  return {
    academicFacultyId: '',
    departmentId: '',
    branchId: '',
    batchId: '',
    sectionCode: '',
  }
}

function hydrateRegistryFilter(scope: UniversityScopeState | null): RegistryFilterState {
  return {
    academicFacultyId: scope?.academicFacultyId ?? '',
    departmentId: scope?.departmentId ?? '',
    branchId: scope?.branchId ?? '',
    batchId: scope?.batchId ?? '',
    sectionCode: scope?.sectionCode ?? '',
  }
}

function fadeColor(hexColor: string, alpha: string) {
  const trimmed = hexColor.trim()
  if (!trimmed.startsWith('#')) return trimmed
  const normalized = trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
  return `${normalized}${alpha}`
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
          .filter(item => item.batchId === scope.batchId && isTermVisible(data, item))
          .map(item => item.termId),
      )
    : null

  const appointmentMatch = member.appointments.some(appointment => {
    if (!isVisibleAdminRecord(appointment.status)) return false
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
  activeSection,
  onSectionChange,
  breadcrumbs,
  onToggleTheme,
  onGoHome,
  onToggleQueue,
  onRefresh,
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
  activeSection: LiveAdminSectionId
  onSectionChange: (section: LiveAdminSectionId) => void
  breadcrumbs: BreadcrumbSegment[]
  onToggleTheme: () => void
  onGoHome: () => void
  onToggleQueue: () => void
  onRefresh: () => void
  onExitPortal?: () => void
  onLogout: () => void
}) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'grid', gap: 14, padding: '12px 20px 16px', background: isLightTheme(themeMode) ? fadeColor(T.surface, 'eb') : fadeColor(T.surface, 'e0'), backdropFilter: 'blur(16px)', borderBottom: `1px solid ${T.border}` }}>
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
          <div style={{ ...mono, fontSize: 10, color: T.dim, border: `1px solid ${T.border}`, borderRadius: 12, padding: '8px 11px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 6, background: T.surface }}>
            <Clock3 size={12} />
            {formatClockLabel(now)}
          </div>
          <button type="button" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={onToggleTheme} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 12px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 14, lineHeight: 1 }}>
            {isLightTheme(themeMode) ? '🌙' : '☀️'}
          </button>
          <button type="button" aria-label="Open action queue" onClick={onToggleQueue} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 12px', cursor: 'pointer', color: T.muted, position: 'relative' }}>
            <Bell size={14} />
            {actionCount > 0 ? (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {Math.min(actionCount, 99)}
              </span>
            ) : null}
          </button>
          <button type="button" aria-label="Refresh admin data" onClick={onRefresh} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 12px', cursor: 'pointer', color: T.muted }}>
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={onLogout} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 12px', cursor: 'pointer', color: T.muted, ...mono, fontSize: 10 }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, border: `1px solid ${T.border2}`, background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`, padding: '12px 14px', boxShadow: `inset 0 1px 0 ${T.surface3}` }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {TOP_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeSection === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange(tab.id as LiveAdminSectionId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 14,
                border: `1px solid ${isActive ? T.accent : T.border}`,
                background: isActive ? `linear-gradient(180deg, ${T.accent}18, ${T.surface})` : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
                color: isActive ? T.accent : T.muted,
                cursor: 'pointer',
                padding: '8px 13px',
                ...mono,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {breadcrumbs.length > 0 ? <AdminBreadcrumbs segments={breadcrumbs} /> : null}
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
        padding: 22,
        minHeight: 246,
        background: active
          ? `linear-gradient(160deg, ${tone}18, ${T.surface})`
          : `linear-gradient(160deg, ${T.surface}, ${T.surface2})`,
        borderTop: `3px solid ${tone}28`,
        display: 'grid',
        alignContent: 'space-between',
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

function AdminDetailTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: string | number; disabled?: boolean }>
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          data-tab="true"
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'grid',
            justifyItems: 'start',
            alignContent: 'space-between',
            gap: 10,
            minHeight: 82,
            borderRadius: 18,
            border: `1px solid ${activeTab === tab.id ? T.accent : T.border}`,
            background: activeTab === tab.id ? `linear-gradient(180deg, ${T.accent}16, ${T.surface})` : `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
            color: activeTab === tab.id ? T.accent : (tab.disabled ? T.dim : T.muted),
            cursor: tab.disabled ? 'not-allowed' : 'pointer',
            padding: '12px 14px',
            opacity: tab.disabled ? 0.55 : 1,
            textAlign: 'left',
          }}
        >
          <span style={{ ...sora, fontSize: 13, fontWeight: 700 }}>{tab.label}</span>
          {tab.count != null ? <Chip color={activeTab === tab.id ? T.accent : T.dim} size={8}>{String(tab.count)}</Chip> : <span style={{ ...mono, fontSize: 9, color: T.dim }}>{tab.disabled ? 'Locked' : 'Open'}</span>}
        </button>
      ))}
    </div>
  )
}

function AdminMiniStat({
  label,
  value,
  tone = T.accent,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${tone}20`, background: `${tone}10`, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ ...mono, fontSize: 9, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text, marginTop: 6 }}>{value}</div>
    </div>
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
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth)
  const [remindersSupported, setRemindersSupported] = useState(true)
  const [universityTab, setUniversityTab] = useState<UniversityTab>('overview')
  const [selectedSectionCode, setSelectedSectionCode] = useState<string | null>(null)
  const [route, setRoute] = useState<LiveAdminRoute>(() => parseAdminRoute(typeof window === 'undefined' ? '' : window.location.hash))
  const [, setRouteHistory] = useState<AdminWorkspaceSnapshot[]>([])
  const [registryScope, setRegistryScope] = useState<UniversityScopeState | null>(null)
  const [studentRegistryFilter, setStudentRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [facultyRegistryFilter, setFacultyRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [dismissedQueueItemKeys, setDismissedQueueItemKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(ADMIN_DISMISSED_QUEUE_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })
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
  const [studentDetailTab, setStudentDetailTab] = useState<StudentDetailTab>('profile')
  const [facultyDetailTab, setFacultyDetailTab] = useState<FacultyDetailTab>('profile')
  const [editingEntity, setEditingEntity] = useState<EditingEntity | null>(null)
  const universityWorkspacePaneRef = useRef<HTMLDivElement | null>(null)

  const mergeStudentRecord = useCallback((nextStudent: ApiStudentRecord) => {
    setData(prev => {
      const nextStudents = prev.students.some(item => item.studentId === nextStudent.studentId)
        ? prev.students.map(item => item.studentId === nextStudent.studentId ? nextStudent : item)
        : [nextStudent, ...prev.students]
      return {
        ...prev,
        students: nextStudents,
      }
    })
  }, [])
  const pendingScrollRestoreRef = useRef<number | null>(null)

  const deferredSearch = useDeferredValue(searchQuery)

  applyThemePreset(themeMode)
  const readOnlyInputStyle = getReadOnlyInputStyle()

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

  const scrollUniversityWorkspaceToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    universityWorkspacePaneRef.current?.scrollTo({ top: 0, behavior })
  }, [])

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

  const updateUniversityTab = useCallback((nextTab: UniversityTab, options?: { recordHistory?: boolean; scroll?: boolean }) => {
    if (nextTab === universityTab) {
      if (options?.scroll !== false) scrollUniversityWorkspaceToTop()
      return
    }
    if (options?.recordHistory !== false) pushCurrentWorkspaceToHistory()
    setUniversityTab(nextTab)
    if (options?.scroll !== false) scrollUniversityWorkspaceToTop()
  }, [pushCurrentWorkspaceToHistory, scrollUniversityWorkspaceToTop, universityTab])

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

  const dismissQueueItem = useCallback((key: string) => {
    setDismissedQueueItemKeys(existing => existing.includes(key) ? existing : [...existing, key])
  }, [])

  const clearDismissedQueueItems = useCallback(() => {
    setDismissedQueueItemKeys([])
  }, [])

  const handleGoHome = useCallback(() => {
    clearRouteHistory()
    clearRegistryScope()
    updateSelectedSectionCode(null, { recordHistory: false })
    updateUniversityTab('overview', { recordHistory: false })
    navigate({ section: 'overview' }, { recordHistory: false })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [clearRegistryScope, clearRouteHistory, navigate, updateSelectedSectionCode, updateUniversityTab])

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
    window.localStorage.setItem(ADMIN_DISMISSED_QUEUE_STORAGE_KEY, JSON.stringify(dismissedQueueItemKeys))
  }, [dismissedQueueItemKeys])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setEditingEntity(null)
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

  useEffect(() => {
    setStudentDetailTab('profile')
  }, [selectedStudent?.studentId])

  useEffect(() => {
    setFacultyDetailTab('profile')
  }, [selectedFacultyMember?.facultyId])

  useEffect(() => {
    if (route.section !== 'students') return
    setStudentRegistryFilter(hydrateRegistryFilter(registryScope))
  }, [registryScope, route.section])

  useEffect(() => {
    if (route.section !== 'faculty-members') return
    setFacultyRegistryFilter(hydrateRegistryFilter(registryScope))
  }, [registryScope, route.section])

  const searchResults = useMemo(() => {
    const isRouteVisible = (candidateRoute: LiveAdminRoute) => {
      if (candidateRoute.section === 'requests' || candidateRoute.section === 'overview') return true
      if (candidateRoute.studentId) return isStudentVisible(data, candidateRoute.studentId)
      if (candidateRoute.facultyMemberId) return isFacultyMemberVisible(data, candidateRoute.facultyMemberId)
      if (candidateRoute.batchId) return isBatchVisible(data, candidateRoute.batchId)
      if (candidateRoute.branchId) return isBranchVisible(data, candidateRoute.branchId)
      if (candidateRoute.departmentId) return isDepartmentVisible(data, candidateRoute.departmentId)
      if (candidateRoute.academicFacultyId) return isAcademicFacultyVisible(data, candidateRoute.academicFacultyId)
      return true
    }
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
      })).filter(result => isRouteVisible(result.route))
    }
    return searchLiveAdminWorkspace(data, deferredSearch).filter(result => isRouteVisible(result.route))
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
    onExitPortal?.()
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
      if (error instanceof AirMentorApiError && error.status === 409 && /stale version/i.test(error.message)) {
        await loadAdminData()
        setActionError(`${error.message}. Reloaded the latest server state. Please review the record and try again.`)
        return null
      }
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
      setEditingEntity(null)
    })
  }

  const handleArchiveAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Archive ${selectedAcademicFaculty.name}? Departments, branches, years, students, and faculty tied to this scope will disappear from the working views until you restore it from History.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'archived',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty archived. Restore it from History when needed.')
    })
  }

  const handleDeleteAcademicFaculty = async () => {
    if (!selectedAcademicFaculty) return
    if (!window.confirm(`Delete ${selectedAcademicFaculty.name}? This removes the faculty scope from working views, including its departments, branches, years, and linked registries, and sends the faculty to the recycle bin.`)) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: selectedAcademicFaculty.code,
        name: selectedAcademicFaculty.name,
        overview: selectedAcademicFaculty.overview,
        status: 'deleted',
        version: selectedAcademicFaculty.version,
      })
      navigate({ section: 'faculties' })
      setFlashMessage('Academic faculty moved to recycle bin.')
    })
  }

  const handleRestoreAcademicFaculty = async (academicFaculty = selectedAcademicFaculty) => {
    if (!academicFaculty) return
    await runAction(async () => {
      await apiClient.updateAcademicFaculty(academicFaculty.academicFacultyId, {
        code: academicFaculty.code,
        name: academicFaculty.name,
        overview: academicFaculty.overview,
        status: 'active',
        version: academicFaculty.version,
      })
      navigate({ section: 'faculties', academicFacultyId: academicFaculty.academicFacultyId })
      setFlashMessage('Academic faculty restored.')
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
      setEditingEntity(null)
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
      setEditingEntity(null)
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
      setEditingEntity(null)
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
        const updated = await apiClient.updateStudent(selectedStudent.studentId, {
          ...payload,
          version: selectedStudent.version,
        })
        mergeStudentRecord(updated)
        setFlashMessage('Student record updated.')
        setEditingEntity(null)
      })
      return
    }
    const created = await runAction(async () => {
      const next = await apiClient.createStudent(payload)
      mergeStudentRecord(next)
      return next
    })
    if (created) {
      navigate({ section: 'students', studentId: created.studentId })
      setFlashMessage('Student created.')
    }
  }

  const handleArchiveStudent = async () => {
    if (!selectedStudent) return
    if (!window.confirm(`Delete ${selectedStudent.name}? This moves the record to the recycle bin for 60 days.`)) return
    await runAction(async () => {
      const deleted = await apiClient.updateStudent(selectedStudent.studentId, {
        usn: selectedStudent.usn,
        rollNumber: selectedStudent.rollNumber,
        name: selectedStudent.name,
        email: selectedStudent.email,
        phone: selectedStudent.phone,
        admissionDate: selectedStudent.admissionDate,
        status: 'deleted',
        version: selectedStudent.version,
      })
      mergeStudentRecord(deleted)
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
        setEditingEntity(null)
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
        .filter(item => item.batchId === selectedBatch.batchId && item.branchId === selectedBranch.branchId && item.semesterNumber === curriculumCourse.semesterNumber && isTermVisible(data, item))
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
  const visibleAcademicFaculties = data.academicFaculties.filter(item => isAcademicFacultyVisible(data, item))
  const visibleDepartments = data.departments.filter(item => isDepartmentVisible(data, item))
  const visibleBranches = data.branches.filter(item => isBranchVisible(data, item))
  const visibleBatches = data.batches.filter(item => isBatchVisible(data, item))
  const visibleTerms = data.terms
    .filter(item => isTermVisible(data, item))
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
  const archivedItems = [
    ...data.academicFaculties.filter(item => item.status === 'archived').map(item => ({
      key: `archived:academic-faculty:${item.academicFacultyId}`,
      label: item.name,
      meta: 'Academic faculty',
      updatedAt: item.updatedAt,
      onRestore: async () => {
        await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
      },
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
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
      const restored = await apiClient.updateStudent(item.studentId, { usn: item.usn, rollNumber: item.rollNumber, name: item.name, email: item.email, phone: item.phone, admissionDate: item.admissionDate, status: 'active', version: item.version })
      mergeStudentRecord(restored)
    } })),
    ...data.facultyMembers.filter(item => item.status === 'deleted').map(item => ({ key: `faculty:${item.facultyId}`, label: item.displayName, meta: 'Faculty member', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateFaculty(item.facultyId, { username: item.username, email: item.email, phone: item.phone, employeeCode: item.employeeCode, displayName: item.displayName, designation: item.designation, joinedOn: item.joinedOn, status: 'active', version: item.version })
    } })),
    ...data.courses.filter(item => item.status === 'deleted').map(item => ({ key: `course:${item.courseId}`, label: item.title, meta: 'Course', updatedAt: item.updatedAt, onRestore: async () => {
      await apiClient.updateCourse(item.courseId, { courseCode: item.courseCode, title: item.title, defaultCredits: item.defaultCredits, departmentId: item.departmentId, status: 'active', version: item.version })
    } })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const hiddenItemCount = archivedItems.length + deletedItems.length
  const selectedAcademicFacultyImpact = selectedAcademicFaculty
    ? {
        departments: data.departments.filter(item => item.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted').length,
        branches: data.branches.filter(item => {
          const department = resolveDepartment(data, item.departmentId)
          return department?.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted'
        }).length,
        batches: data.batches.filter(item => {
          const branch = resolveBranch(data, item.branchId)
          const department = branch ? resolveDepartment(data, branch.departmentId) : null
          return department?.academicFacultyId === selectedAcademicFaculty.academicFacultyId && item.status !== 'deleted'
        }).length,
        students: data.students.filter(item => item.status !== 'deleted' && item.activeAcademicContext?.departmentId && resolveDepartment(data, item.activeAcademicContext.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId).length,
        facultyMembers: data.facultyMembers.filter(item => item.status !== 'deleted' && item.appointments.some(appointment => appointment.status !== 'deleted' && resolveDepartment(data, appointment.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId)).length,
        courses: data.courses.filter(item => item.status !== 'deleted' && resolveDepartment(data, item.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId).length,
      }
    : null
  const openRequests = data.requests
    .filter(item => item.status !== 'Closed')
    .filter(item => !dismissedQueueItemKeys.includes(`request:${item.adminRequestId}`))
  const pendingReminders = data.reminders
    .filter(item => item.status === 'pending')
    .filter(item => !dismissedQueueItemKeys.includes(`reminder:${item.reminderId}`))
  const actionQueueCount = openRequests.length + pendingReminders.length
  const visibleHiddenQueueItems = [...archivedItems, ...deletedItems].filter(item => !dismissedQueueItemKeys.includes(`hidden:${item.key}`))
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
  const currentUniversityLevel = selectedSectionCode
    ? 'section'
    : selectedBatch
      ? 'batch'
      : selectedBranch
        ? 'branch'
        : selectedDepartment
          ? 'department'
          : 'faculty'
  const universityLeftItems = (() => {
    if (currentUniversityLevel === 'section' && selectedBatch) {
      return selectorSections.map(sectionCode => ({
        key: `section:${sectionCode}`,
        title: `Section ${sectionCode}`,
        subtitle: 'Section scope',
        selected: selectedSectionCode === sectionCode,
        onSelect: () => updateSelectedSectionCode(sectionCode),
      }))
    }
    if (currentUniversityLevel === 'batch' && selectedBranch) {
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
    if (currentUniversityLevel === 'branch' && selectedDepartment) {
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
    if (currentUniversityLevel === 'department' && selectedAcademicFaculty) {
      return facultyDepartments
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(department => ({
          key: `department:${department.departmentId}`,
          title: department.name,
          subtitle: `${department.code} · ${listBranchesForDepartment(data, department.departmentId).length} branches`,
          selected: route.departmentId === department.departmentId,
          onSelect: () => navigate({
            section: 'faculties',
            academicFacultyId: selectedAcademicFaculty.academicFacultyId,
            departmentId: department.departmentId,
          }),
        }))
    }
    return visibleAcademicFaculties
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(faculty => ({
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
    .filter(item => isStudentVisible(data, item))
    .filter(student => matchesStudentScope(student, data, activeUniversityScope))
  const filteredUniversityFaculty = data.facultyMembers
    .filter(item => isFacultyMemberVisible(data, item))
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
    ? 'Hierarchy Complete'
    : selectedBatch
      ? 'Sections'
      : selectedBranch
        ? 'Years'
        : selectedDepartment
          ? 'Branches'
          : selectedAcademicFaculty
            ? 'Departments'
            : 'Departments'
  const universityNavigatorHelper = selectedSectionCode
    ? 'You are already at the final layer. Use the scoped student and faculty views below or go back one level to keep drilling sideways.'
    : selectedBatch
      ? 'The left rail stays on years while this subpanel shows section-specific actions, counts, and drill-down.'
      : selectedBranch
        ? 'The left rail stays on branches while this subpanel becomes the year workspace for the selected branch.'
        : selectedDepartment
          ? 'The left rail stays on departments while this subpanel becomes the branch workspace for the selected department.'
          : selectedAcademicFaculty
            ? 'The left rail stays on faculties while this subpanel becomes the department workspace for the selected faculty.'
            : 'Pick a faculty from the left rail first, then this subpanel becomes its department workspace.'
  const universityLevelTitle = currentUniversityLevel === 'faculty'
    ? 'Academic Faculties'
    : currentUniversityLevel === 'department'
      ? 'Departments'
      : currentUniversityLevel === 'branch'
        ? 'Branches'
        : currentUniversityLevel === 'batch'
          ? 'Years'
          : 'Sections'
  const universityLevelHelper = currentUniversityLevel === 'faculty'
    ? 'Stay on the faculty rail while the subpanel handles the next layer and the selected faculty summary.'
    : currentUniversityLevel === 'department'
      ? 'Stay on the department rail while the subpanel handles branch-level work for the selected department.'
      : currentUniversityLevel === 'branch'
        ? 'Stay on the branch rail while the subpanel handles year-level work for the selected branch.'
        : currentUniversityLevel === 'batch'
          ? 'Stay on the year rail while the subpanel handles sections, policy tabs, and term or curriculum setup.'
          : 'Sections are the last layer. Use the scoped registries or go back to the year rail for broader edits.'
  const universityTabOptions = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: <LayoutDashboard size={13} />,
      description: 'Hierarchy navigator, scoped views, and the main year workspace summary.',
    },
    {
      id: 'bands' as const,
      label: 'Bands',
      icon: <CheckCircle2 size={13} />,
      description: 'Grade cutoffs for O, A+, A, B+, B, C, and P within the selected year.',
    },
    {
      id: 'ce-see' as const,
      label: 'CE / SEE',
      icon: <Compass size={13} />,
      description: 'Continuous evaluation, SEE split, internal weights, and working-day limits.',
    },
    {
      id: 'cgpa' as const,
      label: 'CGPA Formula',
      icon: <GraduationCap size={13} />,
      description: 'Pass mark, repeat-course policy, and promotion guardrails for progression.',
    },
    ...(selectedBranch ? [{
      id: 'courses' as const,
      label: 'Courses',
      icon: <BookOpen size={13} />,
      description: 'Semester-wise curriculum rows, credits, and scoped course leader assignments.',
    }] : []),
  ] satisfies Array<{ id: UniversityTab; label: string; icon: ReactNode; description: string }>
  const activeUniversityTab = universityTabOptions.find(item => item.id === universityTab) ?? universityTabOptions[0]
  const universityWorkspaceLabel = selectedBatch && universityTab !== 'overview'
    ? `${universityContextLabel} · ${activeUniversityTab.label}`
    : universityContextLabel
  const universityWorkspaceTabCards = selectedBatch
    ? universityTabOptions.filter(item => item.id !== 'overview')
    : []
  const showInlineActionQueue = showActionQueue && viewportWidth >= 1480
  const registryPageColumns = viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(360px, 460px) minmax(0, 1fr)'
  const universityWorkspaceColumns = viewportWidth < 1220 ? 'minmax(0, 1fr)' : '260px minmax(0, 1fr)'
  const registryFilterColumns = viewportWidth < 760
    ? 'minmax(0, 1fr)'
    : viewportWidth < 1120
      ? 'repeat(2, minmax(0, 1fr))'
      : 'repeat(auto-fit, minmax(140px, 1fr))'
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
    .filter(item => isFacultyMemberVisible(data, item) && item.status === 'active' && item.roleGrants.some(grant => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
  const selectedStudentEnrollment = selectedStudent ? findLatestEnrollment(selectedStudent) : null
  const selectedStudentMentorAssignment = selectedStudent ? findLatestMentorAssignment(selectedStudent) : null
  const selectedStudentPromotionRules = selectedStudentPolicy?.effectivePolicy.progressionRules ?? DEFAULT_PROGRESSION_RULES
  const selectedStudentNextTerms = selectedStudent?.activeAcademicContext
    ? data.terms
        .filter(item => item.branchId === selectedStudent.activeAcademicContext!.branchId && item.semesterNumber === (selectedStudent.activeAcademicContext!.semesterNumber ?? 0) + 1 && isTermVisible(data, item))
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
    : []
  const selectedStudentPromotionRecommended = selectedStudent
    ? selectedStudent.currentCgpa >= selectedStudentPromotionRules.minimumCgpaForPromotion
      && (!selectedStudentPromotionRules.requireNoActiveBacklogs || !/(backlog|fail|repeat|detain)/i.test(selectedStudent.activeAcademicContext?.academicStatus ?? ''))
    : false
  const effectiveStudentRegistryFilter = {
    academicFacultyId: studentRegistryFilter.academicFacultyId || registryScope?.academicFacultyId || '',
    departmentId: studentRegistryFilter.departmentId || registryScope?.departmentId || '',
    branchId: studentRegistryFilter.branchId || registryScope?.branchId || '',
    batchId: studentRegistryFilter.batchId || registryScope?.batchId || '',
    sectionCode: studentRegistryFilter.sectionCode || registryScope?.sectionCode || '',
  }
  const effectiveFacultyRegistryFilter = {
    academicFacultyId: facultyRegistryFilter.academicFacultyId || registryScope?.academicFacultyId || '',
    departmentId: facultyRegistryFilter.departmentId || registryScope?.departmentId || '',
    branchId: facultyRegistryFilter.branchId || registryScope?.branchId || '',
    batchId: facultyRegistryFilter.batchId || registryScope?.batchId || '',
    sectionCode: facultyRegistryFilter.sectionCode || registryScope?.sectionCode || '',
  }
  const studentFilterDepartments = visibleDepartments
    .filter(item => !effectiveStudentRegistryFilter.academicFacultyId || item.academicFacultyId === effectiveStudentRegistryFilter.academicFacultyId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const studentFilterBranches = visibleBranches
    .filter(item => !effectiveStudentRegistryFilter.departmentId || item.departmentId === effectiveStudentRegistryFilter.departmentId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const studentFilterBatches = visibleBatches
    .filter(item => !effectiveStudentRegistryFilter.branchId || item.branchId === effectiveStudentRegistryFilter.branchId)
    .sort((left, right) => left.admissionYear - right.admissionYear || left.batchLabel.localeCompare(right.batchLabel))
  const studentFilterSections = Array.from(new Set(
    studentFilterBatches
      .filter(item => !effectiveStudentRegistryFilter.batchId || item.batchId === effectiveStudentRegistryFilter.batchId)
      .flatMap(item => item.sectionLabels),
  )).sort()
  const facultyFilterDepartments = visibleDepartments
    .filter(item => !effectiveFacultyRegistryFilter.academicFacultyId || item.academicFacultyId === effectiveFacultyRegistryFilter.academicFacultyId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const facultyFilterBranches = visibleBranches
    .filter(item => !effectiveFacultyRegistryFilter.departmentId || item.departmentId === effectiveFacultyRegistryFilter.departmentId)
    .sort((left, right) => left.name.localeCompare(right.name))
  const facultyFilterBatches = visibleBatches
    .filter(item => !effectiveFacultyRegistryFilter.branchId || item.branchId === effectiveFacultyRegistryFilter.branchId)
    .sort((left, right) => left.admissionYear - right.admissionYear || left.batchLabel.localeCompare(right.batchLabel))
  const facultyFilterSections = Array.from(new Set(
    facultyFilterBatches
      .filter(item => !effectiveFacultyRegistryFilter.batchId || item.batchId === effectiveFacultyRegistryFilter.batchId)
      .flatMap(item => item.sectionLabels),
  )).sort()
  const studentRegistryItems = data.students
    .filter(item => isStudentVisible(data, item))
    .filter(item => matchesStudentScope(item, data, {
      academicFacultyId: effectiveStudentRegistryFilter.academicFacultyId || null,
      departmentId: effectiveStudentRegistryFilter.departmentId || null,
      branchId: effectiveStudentRegistryFilter.branchId || null,
      batchId: effectiveStudentRegistryFilter.batchId || null,
      sectionCode: effectiveStudentRegistryFilter.sectionCode || null,
    }))
    .sort((left, right) => {
      const leftKey = `${left.activeAcademicContext?.departmentName ?? ''}-${left.activeAcademicContext?.branchName ?? ''}-${left.name}-${left.usn}`
      const rightKey = `${right.activeAcademicContext?.departmentName ?? ''}-${right.activeAcademicContext?.branchName ?? ''}-${right.name}-${right.usn}`
      return leftKey.localeCompare(rightKey)
    })
  const facultyRegistryItems = data.facultyMembers
    .filter(item => isFacultyMemberVisible(data, item))
    .filter(item => matchesFacultyScope(item, data, {
      academicFacultyId: effectiveFacultyRegistryFilter.academicFacultyId || null,
      departmentId: effectiveFacultyRegistryFilter.departmentId || null,
      branchId: effectiveFacultyRegistryFilter.branchId || null,
      batchId: effectiveFacultyRegistryFilter.batchId || null,
      sectionCode: effectiveFacultyRegistryFilter.sectionCode || null,
    }))
    .sort((left, right) => {
      const leftDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(left))?.name ?? ''
      const rightDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(right))?.name ?? ''
      return `${leftDepartment}-${left.displayName}-${left.employeeCode}`.localeCompare(`${rightDepartment}-${right.displayName}-${right.employeeCode}`)
    })
  const termsForEnrollment = visibleTerms.filter(item => !enrollmentForm.branchId || item.branchId === enrollmentForm.branchId)
  const branchesForAppointment = visibleBranches.filter(item => !appointmentForm.departmentId || item.departmentId === appointmentForm.departmentId)
  const selectedFacultyOwnerships = selectedFacultyMember
    ? data.ownerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
    : []
  const visibleOfferings = [...data.offerings]
    .filter(item => !item.branchId || isBranchVisible(data, item.branchId))
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
      return visibleBatches.map(item => ({ value: item.batchId, label: `${item.batchLabel} · ${deriveCurrentYearLabel(item.currentSemester)}` }))
    }
  if (roleGrantForm.scopeType === 'offering') {
      return visibleOfferings.map(item => ({ value: item.offId, label: `${item.code} · ${item.year} · ${item.section}` }))
    }
    return []
  })()
  const handleOpenScopedRegistry = (section: 'students' | 'faculty-members') => {
    if (activeUniversityRegistryScope) setRegistryScope(activeUniversityRegistryScope)
    navigate({ section })
  }
  const handleOpenFullRegistry = (section: 'students' | 'faculty-members') => {
    clearRegistryScope()
    if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
    else setFacultyRegistryFilter(defaultRegistryFilter())
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
  // --- Breadcrumbs ---
  const topBarBreadcrumbs: BreadcrumbSegment[] = (() => {
    if (route.section === 'overview') return [{ label: 'Dashboard' }]
    if (route.section === 'history') return [{ label: 'History & Restore' }]
    if (route.section === 'requests') {
      const segments: BreadcrumbSegment[] = [{ label: 'Requests', onClick: selectedRequestSummary ? () => navigate({ section: 'requests' }) : undefined }]
      if (selectedRequestSummary) segments.push({ label: selectedRequestSummary.summary || selectedRequestSummary.adminRequestId })
      return segments
    }
    if (route.section === 'students') {
      const segments: BreadcrumbSegment[] = []
      if (registryScope) segments.push({ label: registryScope.label, onClick: () => handleReturnToScopedUniversity() })
      segments.push({ label: 'Students', onClick: selectedStudent ? () => navigate({ section: 'students' }) : undefined })
      if (selectedStudent) segments.push({ label: selectedStudent.name })
      return segments
    }
    if (route.section === 'faculty-members') {
      const segments: BreadcrumbSegment[] = []
      if (registryScope) segments.push({ label: registryScope.label, onClick: () => handleReturnToScopedUniversity() })
      segments.push({ label: 'Faculty Members', onClick: selectedFacultyMember ? () => navigate({ section: 'faculty-members' }) : undefined })
      if (selectedFacultyMember) segments.push({ label: selectedFacultyMember.displayName })
      return segments
    }
    if (route.section === 'faculties') {
      const segments: BreadcrumbSegment[] = [{ label: 'University', onClick: selectedAcademicFaculty ? () => navigate({ section: 'faculties' }) : undefined }]
      if (selectedAcademicFaculty) {
        segments.push({ label: selectedAcademicFaculty.name, onClick: selectedDepartment ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId }) : undefined })
      }
      if (selectedDepartment) {
        segments.push({ label: selectedDepartment.name, onClick: selectedBranch ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId }) : undefined })
      }
      if (selectedBranch) {
        segments.push({ label: selectedBranch.name, onClick: selectedBatch ? () => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId }) : undefined })
      }
      if (selectedBatch) {
        segments.push({ label: `Batch ${selectedBatch.batchLabel}`, onClick: selectedSectionCode ? () => { updateSelectedSectionCode(null); navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch?.branchId, batchId: selectedBatch.batchId }) } : undefined })
      }
      if (selectedSectionCode) {
        segments.push({ label: `Section ${selectedSectionCode}` })
      }
      return segments
    }
    return []
  })()

  // --- Main workspace ---
  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <TeachingShellAdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        adminName={session.faculty?.displayName ?? session.user.username}
        contextLabel={route.section === 'faculties' ? `University · ${universityWorkspaceLabel}` : route.section === 'students' ? 'Student Registry' : route.section === 'faculty-members' ? 'Faculty Registry' : route.section === 'requests' ? 'Governed Requests' : route.section === 'history' ? 'History And Restore' : 'Operations Dashboard'}
        now={now}
        themeMode={themeMode}
        actionCount={actionQueueCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults.map(r => ({ key: r.key, title: r.label, subtitle: r.meta, onSelect: () => { clearRegistryScope(); setSearchQuery(''); navigate(r.route) } }))}
        activeSection={route.section as LiveAdminSectionId}
        onSectionChange={section => { clearRegistryScope(); navigate({ section }) }}
        breadcrumbs={topBarBreadcrumbs}
        onToggleTheme={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}
        onGoHome={handleGoHome}
        onToggleQueue={() => setShowActionQueue(current => !current)}
        onRefresh={() => { void loadAdminData() }}
        onExitPortal={onExitPortal}
        onLogout={handleLogout}
      />

      <div style={{ display: 'grid', gridTemplateColumns: showInlineActionQueue ? 'minmax(0,1fr) 320px' : 'minmax(0,1fr)', gap: 0, alignItems: 'start' }}>
      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <div className="fade-up" style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="Operations Dashboard"
              eyebrow="Sysadmin Control Plane"
              caption="University setup, student registry, faculty registry, and governed requests all begin here."
              toneColor={ADMIN_SECTION_TONES.overview}
            />
            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 280px))', justifyContent: 'center' }}>
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
                <HeroBadge color={T.danger}><RefreshCw size={12} /> Hidden Records {hiddenItemCount}</HeroBadge>
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
          <div className="fade-up" style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="University"
              eyebrow="Hierarchy Control"
              caption="Selector-driven control for academic faculty, department, branch, year, section, policy, and semester-wise course setup."
              toneColor={ADMIN_SECTION_TONES.faculties}
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
                    {selectedAcademicFaculty && !isAcademicFacultyVisible(data, selectedAcademicFaculty) ? (
                      <option value={selectedAcademicFaculty.academicFacultyId}>{selectedAcademicFaculty.name} ({selectedAcademicFaculty.status})</option>
                    ) : null}
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

            <div style={{ display: 'grid', gridTemplateColumns: universityWorkspaceColumns, gap: 16 }}>
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
            <div ref={universityWorkspacePaneRef} className="scroll-pane" style={{ display: 'grid', gap: 14, alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
              <Card style={{ padding: 16, display: 'grid', gap: 14, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, position: 'sticky', top: 0, zIndex: 4, boxShadow: isLightTheme(themeMode) ? '0 18px 32px rgba(15, 23, 42, 0.08)' : '0 18px 32px rgba(2, 6, 23, 0.32)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subpanel</div>
                    <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text, marginTop: 6 }}>{universityWorkspaceLabel}</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                      {selectedBatch
                        ? 'Use the editor cards below or the sticky tabs here to jump straight into the exact year-level control surface.'
                        : 'This area behaves as a scoped navigator plus metadata surface until a year is selected.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedBranch ? <Chip color={T.success}>{selectedBranch.programLevel}</Chip> : null}
                    {selectedBatch ? <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Override active' : 'Inherited policy'}</Chip> : null}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {universityTabOptions.map(tab => (
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
                  <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Hierarchy Navigator · {universityNavigatorTitle}</div>
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

              {universityTab === 'overview' && selectedBatch && universityWorkspaceTabCards.length > 0 && (
                <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Year Editors</div>
                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                      These cards open the exact edit surface for the selected year, so you land on the real controls instead of hunting through the overview.
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {universityWorkspaceTabCards.map(tab => (
                      <button
                        key={`workspace:${tab.id}`}
                        type="button"
                        data-pressable="true"
                        onClick={() => updateUniversityTab(tab.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 14,
                          border: `1px solid ${T.border}`,
                          background: T.surface,
                          padding: '14px 16px',
                          display: 'grid',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.accent }}>
                          {tab.icon}
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{tab.label}</div>
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{tab.description}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.accentLight, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open Editor</div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {!selectedAcademicFaculty ? (
                <SectionHeading title="Academic Faculties" eyebrow="Hierarchy" caption="Select an academic faculty in the tree to begin, or create one below." />
              ) : null}

              {selectedAcademicFaculty && !selectedDepartment && (
                <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
                  <SectionHeading
                    title={selectedAcademicFaculty.name}
                    eyebrow="Academic Faculty"
                    caption={selectedAcademicFaculty.status === 'archived'
                      ? 'This faculty is archived. Restore it to bring its departments and linked workspace scope back into the main admin views.'
                      : 'Edit the faculty record, then add or organize departments underneath it.'}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedAcademicFaculty.code}</Chip>
                    <Chip color={T.success}>{facultyDepartments.length} departments</Chip>
                    <Chip color={selectedAcademicFaculty.status === 'archived' ? T.warning : T.success}>{selectedAcademicFaculty.status}</Chip>
                  </div>
                  {selectedAcademicFacultyImpact ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginTop: 16 }}>
                      <AdminMiniStat label="Departments" value={String(selectedAcademicFacultyImpact.departments)} tone={T.accent} />
                      <AdminMiniStat label="Branches" value={String(selectedAcademicFacultyImpact.branches)} tone={T.success} />
                      <AdminMiniStat label="Years" value={String(selectedAcademicFacultyImpact.batches)} tone={T.warning} />
                      <AdminMiniStat label="Students" value={String(selectedAcademicFacultyImpact.students)} tone={ADMIN_SECTION_TONES.students} />
                      <AdminMiniStat label="Faculty" value={String(selectedAcademicFacultyImpact.facultyMembers)} tone={ADMIN_SECTION_TONES['faculty-members']} />
                      <AdminMiniStat label="Courses" value={String(selectedAcademicFacultyImpact.courses)} tone={T.orange} />
                    </div>
                  ) : null}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overview</div>
                    <Card style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.9 }}>
                        {selectedAcademicFaculty.overview?.trim() || 'No faculty overview has been added yet.'}
                      </div>
                    </Card>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" onClick={() => setEditingEntity('academic-faculty')}>Edit Faculty</Btn>
                  </div>
                  {selectedAcademicFaculty.status === 'archived' ? null : facultyDepartments.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Departments</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                        {facultyDepartments.map(department => {
                          const previewBranches = listBranchesForDepartment(data, department.departmentId).sort((left, right) => left.name.localeCompare(right.name))
                          return (
                            <Card key={department.departmentId} style={{ padding: 14, background: T.surface2 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{department.name}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{department.code} · {previewBranches.length} branches</div>
                                </div>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId })}>Open</Btn>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                {previewBranches.slice(0, 4).map(branch => (
                                  <button
                                    key={branch.branchId}
                                    type="button"
                                    data-pressable="true"
                                    onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty.academicFacultyId, departmentId: department.departmentId, branchId: branch.branchId })}
                                    style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                                  >
                                    {branch.name}
                                  </button>
                                ))}
                                {previewBranches.length > 4 ? <Chip color={T.dim}>+{previewBranches.length - 4} more</Chip> : null}
                                {previewBranches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No branches yet.</span> : null}
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  {selectedAcademicFaculty.status === 'archived' ? null : (
                    <form onSubmit={handleCreateDepartment} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Department</div>
                      <div><FieldLabel>Department Code</FieldLabel><TextInput value={structureForms.department.code} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} placeholder="CSE" /></div>
                      <div><FieldLabel>Department Name</FieldLabel><TextInput value={structureForms.department.name} onChange={event => setStructureForms(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} placeholder="Computer Science and Engineering" /></div>
                      <Btn type="submit">Add Department</Btn>
                    </form>
                  )}
                </Card>
              )}

              {selectedDepartment && !selectedBranch && (
                <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
                  <SectionHeading title={selectedDepartment.name} eyebrow="Department" caption="Edit the department record, then create or reorganize the branches it owns." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedDepartment.code}</Chip>
                    <Chip color={T.success}>{departmentBranches.length} branches</Chip>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" onClick={() => setEditingEntity('department')}>Edit Department</Btn>
                  </div>
                  {departmentBranches.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Branches</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                        {departmentBranches.map(branch => {
                          const previewBatches = listBatchesForBranch(data, branch.branchId).sort((left, right) => left.admissionYear - right.admissionYear)
                          return (
                            <Card key={branch.branchId} style={{ padding: 14, background: T.surface2 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{branch.name}</div>
                                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{branch.code} · {branch.programLevel} · {previewBatches.length} years</div>
                                </div>
                                <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId })}>Open</Btn>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                {previewBatches.slice(0, 4).map(batch => (
                                  <button
                                    key={batch.batchId}
                                    type="button"
                                    data-pressable="true"
                                    onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment.departmentId, branchId: branch.branchId, batchId: batch.batchId })}
                                    style={{ ...mono, fontSize: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: T.surface, color: T.muted, padding: '6px 10px', cursor: 'pointer' }}
                                  >
                                    {deriveCurrentYearLabel(batch.currentSemester)}
                                  </button>
                                ))}
                                {previewBatches.length > 4 ? <Chip color={T.dim}>+{previewBatches.length - 4} more</Chip> : null}
                                {previewBatches.length === 0 ? <span style={{ ...mono, fontSize: 10, color: T.dim }}>No years yet.</span> : null}
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
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
                <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
                  <SectionHeading title={selectedBranch.name} eyebrow="Branch" caption="Edit core branch metadata, then add or maintain the batch versions that inherit from it." />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <Chip color={T.accent}>{selectedBranch.code}</Chip>
                    <Chip color={T.warning}>{selectedBranch.programLevel}</Chip>
                    <Chip color={T.success}>{branchBatches.length} batches</Chip>
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                    {selectedBranch.semesterCount} semesters configured in this branch. Use the edit dialog for branch metadata or jump directly into a year below.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" onClick={() => setEditingEntity('branch')}>Edit Branch</Btn>
                  </div>
                  {branchBatches.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Years</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        {branchBatches.map(batch => (
                          <Card key={batch.batchId} style={{ padding: 14, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{deriveCurrentYearLabel(batch.currentSemester)}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Batch {batch.batchLabel} · sem {batch.currentSemester}</div>
                              </div>
                              <Btn type="button" size="sm" variant="ghost" onClick={() => navigate({ section: 'faculties', academicFacultyId: selectedAcademicFaculty?.academicFacultyId, departmentId: selectedDepartment?.departmentId, branchId: selectedBranch.branchId, batchId: batch.batchId })}>Open</Btn>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                              {batch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <form onSubmit={handleCreateBatch} style={{ display: 'grid', gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
                    <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Add Batch</div>
                    <div><FieldLabel>Admission Year</FieldLabel><TextInput value={structureForms.batch.admissionYear} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value, batchLabel: event.target.value } }))} placeholder="2022" /></div>
                    <div><FieldLabel>Active Semester</FieldLabel><TextInput value={structureForms.batch.currentSemester} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} placeholder="5" /></div>
                    <div><FieldLabel>Section Labels</FieldLabel><TextInput value={structureForms.batch.sectionLabels} onChange={event => setStructureForms(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} placeholder="A, B" /></div>
                    <Btn type="submit">Add Batch</Btn>
                  </form>
                </Card>
              )}

              {selectedBatch && universityTab === 'overview' && (
                <Card style={{ padding: 18, display: 'grid', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Chip color={T.success}>Batch {selectedBatch.batchLabel}</Chip>
                    <Chip color={T.accent}>Sem {selectedBatch.currentSemester}</Chip>
                    <Chip color={T.warning}>{deriveCurrentYearLabel(selectedBatch.currentSemester)}</Chip>
                    <Chip color={activeBatchPolicyOverride ? T.orange : T.dim}>{activeBatchPolicyOverride ? 'Local Policy Override' : 'Inherited Policy'}</Chip>
                  </div>

                  <SectionHeading title="Batch Configuration" eyebrow="Settings" caption="Edit the batch identity, active semester, and sections before adjusting policy, terms, or curriculum." />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <Card style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission Year</div>
                      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedBatch.admissionYear}</div>
                    </Card>
                    <Card style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Semester</div>
                      <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedBatch.currentSemester}</div>
                    </Card>
                    <Card style={{ padding: 14, background: T.surface2 }}>
                      <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sections</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {selectedBatch.sectionLabels.map(sectionCode => <Chip key={sectionCode} color={T.accent}>{sectionCode}</Chip>)}
                      </div>
                    </Card>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" onClick={() => setEditingEntity('batch')}>Edit Batch</Btn>
                  </div>

                  {resolvedBatchPolicy ? (
                    <div>
                      <InfoBanner message={`Resolved from ${resolvedBatchPolicy.scopeChain.map(item => item.scopeType).join(' -> ')}. Applied overrides: ${resolvedBatchPolicy.appliedOverrides.map(item => item.scopeType).join(', ') || 'institution default only'}.`} />
                    </div>
                  ) : null}

                  <div>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" variant="ghost" onClick={() => handleOpenScopedRegistry('students')}>Open Scoped Students</Btn>
                    <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('students')}>Open Full Students</Btn>
                  </div>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" variant="ghost" onClick={() => handleOpenScopedRegistry('faculty-members')}>Open Scoped Faculty</Btn>
                    <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('faculty-members')}>Open Full Faculty</Btn>
                  </div>
                </Card>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ========== STUDENTS ========== */}
        {route.section === 'students' && (
          <div className="fade-up" style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
              <SectionHeading
                title="Students"
                eyebrow="Registry"
                caption={registryScope ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Filtered to ${registryScope.label}.` : 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history.'}
                toneColor={ADMIN_SECTION_TONES.students}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}><Plus size={14} /> New Student</Btn>
                  <Chip color={T.accent}>{studentRegistryItems.length} active</Chip>
                  <Chip color={T.warning}>{studentRegistryItems.filter(item => !item.activeMentorAssignment).length} mentor gaps</Chip>
                  {registryScope ? <Chip color={ADMIN_SECTION_TONES.students}>{registryScope.label}</Chip> : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: registryFilterColumns, gap: 10 }}>
                  <div>
                    <FieldLabel>Faculty</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.academicFacultyId} onChange={event => setStudentRegistryFilter({
                      academicFacultyId: event.target.value,
                      departmentId: '',
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    })}>
                      <option value="">All Faculties</option>
                      {visibleAcademicFaculties.map(item => <option key={item.academicFacultyId} value={item.academicFacultyId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.departmentId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      departmentId: event.target.value,
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Departments</option>
                      {studentFilterDepartments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Branch</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.branchId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      branchId: event.target.value,
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Branches</option>
                      {studentFilterBranches.map(item => <option key={item.branchId} value={item.branchId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Year</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.batchId} onChange={event => setStudentRegistryFilter(prev => ({
                      ...prev,
                      batchId: event.target.value,
                      sectionCode: '',
                    }))}>
                      <option value="">All Years</option>
                      {studentFilterBatches.map(item => <option key={item.batchId} value={item.batchId}>{deriveCurrentYearLabel(item.currentSemester)} · {item.batchLabel}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <SelectInput value={effectiveStudentRegistryFilter.sectionCode} onChange={event => setStudentRegistryFilter(prev => ({ ...prev, sectionCode: event.target.value }))}>
                      <option value="">All Sections</option>
                      {studentFilterSections.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>)}
                    </SelectInput>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setStudentRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('students')}>Open Complete Page</Btn>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
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
              </div>
            </Card>

            <div className="scroll-pane" style={{ display: 'grid', gap: 16, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
              <Card
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  padding: 18,
                  display: 'grid',
                  gap: 14,
                  background: isLightTheme(themeMode) ? fadeColor(T.surface, 'f0') : fadeColor(T.surface, 'ea'),
                  backdropFilter: 'blur(12px)',
                }}
              >
                <SectionHeading
                  title={selectedStudent ? selectedStudent.name : 'Create Student'}
                  eyebrow="Student Workspace"
                  caption={selectedStudent
                    ? 'Identity, academic context, mentor linkage, progression review, and history now stay in one focused workspace.'
                    : 'Create the student identity first, then move through academic context, mentoring, and progression from the tabs below.'}
                />
                {selectedStudent ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                    <AdminMiniStat label="CGPA" value={selectedStudent.currentCgpa.toFixed(2)} tone={T.success} />
                    <AdminMiniStat label="Semester" value={String(selectedStudent.activeAcademicContext?.semesterNumber ?? '—')} tone={T.accent} />
                    <AdminMiniStat label="Enrollments" value={String(selectedStudent.enrollments.length)} tone={T.warning} />
                    <AdminMiniStat label="Mentor Links" value={String(selectedStudent.mentorAssignments.length)} tone={ADMIN_SECTION_TONES['faculty-members']} />
                    <AdminMiniStat label="Audit Events" value={String(studentAuditEvents.length)} tone={T.orange} />
                  </div>
                ) : null}
                <AdminDetailTabs
                  activeTab={studentDetailTab}
                  onChange={tabId => setStudentDetailTab(tabId as StudentDetailTab)}
                  tabs={[
                    { id: 'profile', label: 'Profile' },
                    { id: 'academic', label: 'Academic', count: selectedStudent?.enrollments.length ?? 0, disabled: !selectedStudent },
                    { id: 'mentor', label: 'Mentor', count: selectedStudent?.mentorAssignments.length ?? 0, disabled: !selectedStudent },
                    { id: 'progression', label: 'Progression', disabled: !selectedStudent },
                    { id: 'history', label: 'History', count: studentAuditEvents.length, disabled: !selectedStudent },
                  ]}
                />
              </Card>

              {studentDetailTab === 'profile' && (
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
                    <div><FieldLabel>Name</FieldLabel><TextInput value={studentForm.name} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Student name" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>University ID / USN</FieldLabel><TextInput value={studentForm.usn} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} placeholder="1MS22CS001" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Roll Number</FieldLabel><TextInput value={studentForm.rollNumber} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} placeholder="Optional" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Admission Date</FieldLabel><TextInput value={studentForm.admissionDate} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} placeholder="YYYY-MM-DD" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Email</FieldLabel><TextInput value={studentForm.email} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} placeholder="student@campus.edu" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Phone</FieldLabel><TextInput value={studentForm.phone} readOnly={selectedStudent != null} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" style={selectedStudent != null ? readOnlyInputStyle : undefined} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {selectedStudent ? (
                      <>
                        <Btn type="button" onClick={() => setEditingEntity('student-profile')}>Edit Student</Btn>
                        <Btn type="button" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                        <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>New Student</Btn>
                      </>
                    ) : (
                      <>
                        <Btn type="submit">Create Student</Btn>
                        <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>Clear Form</Btn>
                      </>
                    )}
                  </div>
                </form>
              </Card>
              )}

              {studentDetailTab === 'academic' && (
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
              )}

              {studentDetailTab === 'mentor' && (
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
              )}

              {studentDetailTab === 'progression' && (
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
              )}

              {studentDetailTab === 'history' && (
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
              )}
            </div>
          </div>
        )}

        {/* ========== FACULTY MEMBERS ========== */}
        {route.section === 'faculty-members' && (
          <div className="fade-up" style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
              <SectionHeading
                title="Faculty Members"
                eyebrow="Registry"
                caption={registryScope ? `Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here. Filtered to ${registryScope.label}.` : 'Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here.'}
                toneColor={ADMIN_SECTION_TONES['faculty-members']}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}><Plus size={14} /> New Faculty</Btn>
                  <Chip color={T.accent}>{facultyRegistryItems.length} active</Chip>
                  <Chip color={T.warning}>{facultyRegistryItems.filter(item => !item.roleGrants.some(grant => isCurrentRoleGrant(grant))).length} no active permissions</Chip>
                  {registryScope ? <Chip color={ADMIN_SECTION_TONES['faculty-members']}>{registryScope.label}</Chip> : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: registryFilterColumns, gap: 10 }}>
                  <div>
                    <FieldLabel>Faculty</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.academicFacultyId} onChange={event => setFacultyRegistryFilter({
                      academicFacultyId: event.target.value,
                      departmentId: '',
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    })}>
                      <option value="">All Faculties</option>
                      {visibleAcademicFaculties.map(item => <option key={item.academicFacultyId} value={item.academicFacultyId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.departmentId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      departmentId: event.target.value,
                      branchId: '',
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Departments</option>
                      {facultyFilterDepartments.map(item => <option key={item.departmentId} value={item.departmentId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Branch</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.branchId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      branchId: event.target.value,
                      batchId: '',
                      sectionCode: '',
                    }))}>
                      <option value="">All Branches</option>
                      {facultyFilterBranches.map(item => <option key={item.branchId} value={item.branchId}>{item.name}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Year</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.batchId} onChange={event => setFacultyRegistryFilter(prev => ({
                      ...prev,
                      batchId: event.target.value,
                      sectionCode: '',
                    }))}>
                      <option value="">All Years</option>
                      {facultyFilterBatches.map(item => <option key={item.batchId} value={item.batchId}>{deriveCurrentYearLabel(item.currentSemester)} · {item.batchLabel}</option>)}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <SelectInput value={effectiveFacultyRegistryFilter.sectionCode} onChange={event => setFacultyRegistryFilter(prev => ({ ...prev, sectionCode: event.target.value }))}>
                      <option value="">All Sections</option>
                      {facultyFilterSections.map(sectionCode => <option key={sectionCode} value={sectionCode}>{sectionCode}</option>)}
                    </SelectInput>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setFacultyRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('faculty-members')}>Open Complete Page</Btn>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
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
              </div>
            </Card>

            <div className="scroll-pane" style={{ display: 'grid', gap: 16, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
              <Card
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  padding: 18,
                  display: 'grid',
                  gap: 14,
                  background: isLightTheme(themeMode) ? fadeColor(T.surface, 'f0') : fadeColor(T.surface, 'ea'),
                  backdropFilter: 'blur(12px)',
                }}
              >
                <SectionHeading
                  title={selectedFacultyMember ? selectedFacultyMember.displayName : 'Create Faculty'}
                  eyebrow="Faculty Workspace"
                  caption={selectedFacultyMember
                    ? 'Identity, appointments, permissions, teaching coverage, timetable planning, and history now stay in a tighter working loop.'
                    : 'Create the faculty profile first, then use the tabs to manage appointments, permissions, teaching coverage, and planning.'}
                />
                {selectedFacultyMember ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                    <AdminMiniStat label="Appointments" value={String(selectedFacultyMember.appointments.length)} tone={T.warning} />
                    <AdminMiniStat label="Permissions" value={String(selectedFacultyMember.roleGrants.length)} tone={T.success} />
                    <AdminMiniStat label="Classes" value={String(selectedFacultyAssignments.length)} tone={T.accent} />
                    <AdminMiniStat label="Mentor Load" value={String(data.students.filter(item => item.activeMentorAssignment?.facultyId === selectedFacultyMember.facultyId).length)} tone={ADMIN_SECTION_TONES.students} />
                    <AdminMiniStat label="Audit Events" value={String(facultyAuditEvents.length)} tone={T.orange} />
                  </div>
                ) : null}
                <AdminDetailTabs
                  activeTab={facultyDetailTab}
                  onChange={tabId => setFacultyDetailTab(tabId as FacultyDetailTab)}
                  tabs={[
                    { id: 'profile', label: 'Profile' },
                    { id: 'appointments', label: 'Appointments', count: selectedFacultyMember?.appointments.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'permissions', label: 'Permissions', count: selectedFacultyMember?.roleGrants.length ?? 0, disabled: !selectedFacultyMember },
                    { id: 'teaching', label: 'Teaching', count: selectedFacultyAssignments.length, disabled: !selectedFacultyMember },
                    { id: 'timetable', label: 'Timetable', disabled: !selectedFacultyMember },
                    { id: 'history', label: 'History', count: facultyAuditEvents.length, disabled: !selectedFacultyMember },
                  ]}
                />
              </Card>

              {facultyDetailTab === 'profile' && (
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
                    <div><FieldLabel>Display Name</FieldLabel><TextInput value={facultyForm.displayName} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} placeholder="Faculty name" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyForm.employeeCode} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} placeholder="EMP001" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Username</FieldLabel><TextInput value={facultyForm.username} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} placeholder="faculty.user" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Email</FieldLabel><TextInput value={facultyForm.email} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} placeholder="faculty@campus.edu" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyForm.phone} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    <div><FieldLabel>Designation</FieldLabel><TextInput value={facultyForm.designation} readOnly={selectedFacultyMember != null} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} placeholder="Assistant Professor" style={selectedFacultyMember != null ? readOnlyInputStyle : undefined} /></div>
                    {!selectedFacultyMember ? <div><FieldLabel>Initial Password</FieldLabel><TextInput type="password" value={facultyForm.password} onChange={event => setFacultyForm(prev => ({ ...prev, password: event.target.value }))} placeholder="Minimum 8 characters" /></div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {selectedFacultyMember ? (
                      <>
                        <Btn type="button" onClick={() => setEditingEntity('faculty-profile')}>Edit Faculty</Btn>
                        <Btn type="button" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                        <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>New Faculty</Btn>
                      </>
                    ) : (
                      <>
                        <Btn type="submit">Create Faculty</Btn>
                        <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>Clear Form</Btn>
                      </>
                    )}
                  </div>
                </form>
              </Card>
              )}

              {facultyDetailTab === 'appointments' && (
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
              )}

              {facultyDetailTab === 'permissions' && (
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
              )}

              {facultyDetailTab === 'teaching' && (
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
              )}

              {facultyDetailTab === 'timetable' && (
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
              )}

              {facultyDetailTab === 'history' && (
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
              )}
            </div>
          </div>
        )}

        {/* ========== HISTORY ========== */}
        {route.section === 'history' && (
          <div className="fade-up" style={{ display: 'grid', gap: 16 }}>
            <SectionHeading
              title="History And Restore"
              eyebrow="Audit + Recycle Bin"
              caption="Use one page for archived faculties, restore-ready deletions, and the exact records that changed."
              toneColor={ADMIN_SECTION_TONES.history}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(420px, 1.1fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text }}>Archive</div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Archived faculties stay out of daily sysadmin views until you restore them here.</div>
                    </div>
                    <Chip color={T.warning}>{archivedItems.length}</Chip>
                  </div>
                  {archivedItems.length === 0 ? <EmptyState title="Nothing archived right now" body="Archived academic faculties will appear here for quick restore." /> : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {archivedItems.map(item => (
                        <Card key={item.key} style={{ padding: 12, background: T.surface2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.label}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.meta} · archived {formatDateTime(item.updatedAt)}</div>
                            </div>
                            <Btn type="button" size="sm" onClick={() => void runAction(async () => {
                              await item.onRestore()
                              setFlashMessage(`${item.label} restored.`)
                            })}>Restore</Btn>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>

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
              </div>

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
      <AnimatePresence initial={false}>
      {showInlineActionQueue ? (
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="scroll-pane scroll-pane--dense"
          style={{ position: 'sticky', top: 92, height: 'calc(100vh - 92px)', overflowY: 'auto', padding: '18px 16px', borderLeft: `1px solid ${T.border}`, background: T.surface }}
        >
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
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <Chip color={request.status === 'Implemented' ? T.success : T.warning} size={9}>{request.status}</Chip>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`request:${request.adminRequestId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Discard</button>
                  </div>
                }
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
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); void handleToggleReminderStatus(reminder) }} style={{ ...mono, fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`reminder:${reminder.reminderId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Discard</button>
                  </div>
                }
              />
            )) : null}
            {remindersSupported
              ? (pendingReminders.length === 0 ? <InfoBanner message="No private admin reminders. Use the quick add button below." /> : null)
              : <InfoBanner message="This backend does not expose private reminders yet, so the queue is running in request-only mode." />}
          </div>

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Hidden Records</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {visibleHiddenQueueItems.slice(0, 4).map(item => (
              <ActionQueueCard
                key={item.key}
                title={item.label}
                subtitle={`${item.meta} · ${item.key.startsWith('archived:') ? 'archived' : 'deleted'} ${formatDateTime(item.updatedAt)}${item.key.startsWith('archived:') ? '' : ' · restore window 60 days'}`}
                chips={[item.meta]}
                tone={item.key.startsWith('archived:') ? T.warning : T.danger}
                trailing={
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <button type="button" onClick={event => { event.stopPropagation(); void runAction(async () => { await item.onRestore(); setFlashMessage(`${item.label} restored.`) }) }} style={{ ...mono, fontSize: 10, color: T.success, background: 'none', border: 'none', cursor: 'pointer' }}>Restore</button>
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`hidden:${item.key}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Discard</button>
                  </div>
                }
              />
            ))}
            {visibleHiddenQueueItems.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>Nothing hidden right now.</div> : null}
          </div>

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, ${fadeColor(T.surface, '00')} 0%, ${T.surface} 35%)` }}>
            {dismissedQueueItemKeys.length > 0 ? (
              <button type="button" onClick={clearDismissedQueueItems} style={{ width: '100%', marginBottom: 8, border: `1px solid ${T.border}`, borderRadius: 12, cursor: 'pointer', background: T.surface, color: T.muted, padding: '9px 12px', ...mono, fontSize: 10 }}>
                Reset Discarded Queue Items
              </button>
            ) : null}
            <button type="button" onClick={() => void handleCreateReminder()} disabled={!remindersSupported} style={{ width: '100%', border: 'none', borderRadius: 10, cursor: remindersSupported ? 'pointer' : 'not-allowed', background: remindersSupported ? T.accent : T.surface3, color: remindersSupported ? '#fff' : T.dim, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...sora, fontWeight: 700, fontSize: 12 }}>
              <Plus size={14} />
              {remindersSupported ? 'Quick Add Reminder' : 'Reminder API Unavailable'}
            </button>
          </div>
        </motion.div>
      ) : null}
      </AnimatePresence>
      </div>

      <AnimatePresence>
        {editingEntity === 'student-profile' && selectedStudent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Student Edit"
              title={`Edit ${selectedStudent.name}`}
              caption="Update the core student identity from a focused dialog instead of the stretched workspace card."
              onClose={() => {
                setStudentForm({ name: selectedStudent.name, usn: selectedStudent.usn, rollNumber: selectedStudent.rollNumber ?? '', admissionDate: selectedStudent.admissionDate, email: selectedStudent.email ?? '', phone: selectedStudent.phone ?? '' })
                setEditingEntity(null)
              }}
            >
              <form onSubmit={handleSaveStudent} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div><FieldLabel>Name</FieldLabel><TextInput value={studentForm.name} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} /></div>
                  <div><FieldLabel>USN</FieldLabel><TextInput value={studentForm.usn} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} /></div>
                  <div><FieldLabel>Roll Number</FieldLabel><TextInput value={studentForm.rollNumber} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} /></div>
                  <div><FieldLabel>Admission Date</FieldLabel><TextInput value={studentForm.admissionDate} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} /></div>
                  <div><FieldLabel>Email</FieldLabel><TextInput value={studentForm.email} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput value={studentForm.phone} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Btn type="button" variant="ghost" onClick={() => {
                    setStudentForm({ name: selectedStudent.name, usn: selectedStudent.usn, rollNumber: selectedStudent.rollNumber ?? '', admissionDate: selectedStudent.admissionDate, email: selectedStudent.email ?? '', phone: selectedStudent.phone ?? '' })
                    setEditingEntity(null)
                  }}>Cancel</Btn>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                  <Btn type="submit">Save Student</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'faculty-profile' && selectedFacultyMember ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame
              eyebrow="Faculty Edit"
              title={`Edit ${selectedFacultyMember.displayName}`}
              caption="Keep faculty identity edits in a focused dialog while the workspace stays reserved for appointments, permissions, classes, and planning."
              onClose={() => {
                setFacultyForm({ displayName: selectedFacultyMember.displayName, employeeCode: selectedFacultyMember.employeeCode, username: selectedFacultyMember.username, email: selectedFacultyMember.email, phone: selectedFacultyMember.phone ?? '', designation: selectedFacultyMember.designation, joinedOn: selectedFacultyMember.joinedOn ?? '', password: '' })
                setEditingEntity(null)
              }}
            >
              <form onSubmit={handleSaveFaculty} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div><FieldLabel>Display Name</FieldLabel><TextInput value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} /></div>
                  <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} /></div>
                  <div><FieldLabel>Username</FieldLabel><TextInput value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} /></div>
                  <div><FieldLabel>Email</FieldLabel><TextInput value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                  <div><FieldLabel>Designation</FieldLabel><TextInput value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Btn type="button" variant="ghost" onClick={() => {
                    setFacultyForm({ displayName: selectedFacultyMember.displayName, employeeCode: selectedFacultyMember.employeeCode, username: selectedFacultyMember.username, email: selectedFacultyMember.email, phone: selectedFacultyMember.phone ?? '', designation: selectedFacultyMember.designation, joinedOn: selectedFacultyMember.joinedOn ?? '', password: '' })
                    setEditingEntity(null)
                  }}>Cancel</Btn>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                  <Btn type="submit">Save Faculty</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'academic-faculty' && selectedAcademicFaculty ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedAcademicFaculty.name}`} caption="Adjust faculty qualities here, then return to the same hierarchy layer with the rail preserved." onClose={() => setEditingEntity(null)}>
              <form onSubmit={handleUpdateAcademicFaculty} style={{ display: 'grid', gap: 10 }}>
                <div><FieldLabel>Faculty Code</FieldLabel><TextInput value={entityEditors.academicFaculty.code} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} /></div>
                <div><FieldLabel>Faculty Name</FieldLabel><TextInput value={entityEditors.academicFaculty.name} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} /></div>
                <div><FieldLabel>Overview</FieldLabel><TextAreaInput value={entityEditors.academicFaculty.overview} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} rows={4} /></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {selectedAcademicFaculty.status === 'archived'
                      ? <Btn type="button" variant="ghost" onClick={() => void handleRestoreAcademicFaculty()}>Restore Faculty</Btn>
                      : <Btn type="button" variant="ghost" onClick={() => void handleArchiveAcademicFaculty()}>Archive Faculty</Btn>}
                    <Btn type="button" variant="danger" onClick={() => void handleDeleteAcademicFaculty()}>Delete Faculty</Btn>
                  </div>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">Save Faculty</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'department' && selectedDepartment ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedDepartment.name}`} caption="Department edits now live in a focused dialog so the rail and next-level branch workspace stay stable behind it." onClose={() => setEditingEntity(null)}>
              <form onSubmit={handleUpdateDepartment} style={{ display: 'grid', gap: 10 }}>
                <div><FieldLabel>Department Code</FieldLabel><TextInput value={entityEditors.department.code} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} /></div>
                <div><FieldLabel>Department Name</FieldLabel><TextInput value={entityEditors.department.name} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} /></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveDepartment()}>Archive Department</Btn>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">Save Department</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'branch' && selectedBranch ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame eyebrow="Hierarchy Edit" title={`Edit ${selectedBranch.name}`} caption="Branch metadata opens in a modal so year-level work in the subpanel stays visible and easier to reason about." onClose={() => setEditingEntity(null)}>
              <form onSubmit={handleUpdateBranch} style={{ display: 'grid', gap: 10 }}>
                <div><FieldLabel>Branch Code</FieldLabel><TextInput value={entityEditors.branch.code} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} /></div>
                <div><FieldLabel>Branch Name</FieldLabel><TextInput value={entityEditors.branch.name} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} /></div>
                <div><FieldLabel>Program Level</FieldLabel><SelectInput value={entityEditors.branch.programLevel} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}><option value="UG">UG</option><option value="PG">PG</option></SelectInput></div>
                <div><FieldLabel>Semester Count</FieldLabel><TextInput value={entityEditors.branch.semesterCount} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} /></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveBranch()}>Archive Branch</Btn>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">Save Branch</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}

        {editingEntity === 'batch' && selectedBatch ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalFrame eyebrow="Hierarchy Edit" title={`Edit Batch ${selectedBatch.batchLabel}`} caption="Year-level edits now happen in a compact popup, while policy tabs and section-level actions stay in the main subpanel." onClose={() => setEditingEntity(null)}>
              <form onSubmit={handleUpdateBatch} style={{ display: 'grid', gap: 10 }}>
                <div><FieldLabel>Admission Year</FieldLabel><TextInput value={entityEditors.batch.admissionYear} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value } }))} /></div>
                <div><FieldLabel>Batch Label</FieldLabel><TextInput value={entityEditors.batch.batchLabel} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, batchLabel: event.target.value } }))} /></div>
                <div><FieldLabel>Active Semester</FieldLabel><TextInput value={entityEditors.batch.currentSemester} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} /></div>
                <div><FieldLabel>Section Labels</FieldLabel><TextInput value={entityEditors.batch.sectionLabels} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} /></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <Btn type="button" variant="danger" onClick={() => void handleArchiveBatch()}>Archive Batch</Btn>
                  <Btn type="button" variant="ghost" onClick={() => setEditingEntity(null)}>Cancel</Btn>
                  <Btn type="submit">Save Batch</Btn>
                </div>
              </form>
            </ModalFrame>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
