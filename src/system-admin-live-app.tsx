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
  ChevronRight,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Plus,
  RefreshCw,
  UserCog,
  Users,
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAuditEvent,
  ApiAdminFacultyCalendar,
  ApiBatchProvisioningRequest,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigPayload,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiMentorAssignment,
  ApiAdminRequestDetail,
  ApiAdminSearchResult,
  ApiAdminRequestSummary,
  ApiOfferingStageEligibility,
  ApiOfferingOwnership,
  ApiPolicyPayload,
  ApiProofDashboard,
  ApiProofRunCheckpointDetail,
  ApiResolvedBatchPolicy,
  ApiResolvedBatchStagePolicy,
  ApiRoleCode,
  ApiScopeType,
  ApiRoleGrant,
  ApiSessionResponse,
  ApiSimulationStageCheckpointSummary,
  ApiStageEvidenceKind,
  ApiStagePolicyOverride,
  ApiStagePolicyPayload,
  ApiStudentEnrollment,
  ApiStudentRecord,
} from './api/types'
import { T, mono, sora } from './data'
import { normalizeThemeMode, type ThemeMode } from './domain'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories } from './repositories'
import {
  compareAdminTimestampsDesc,
  deriveCurrentYearLabel,
  hasHierarchyScopeSelection,
  isAcademicFacultyVisible,
  isBatchVisible,
  isBranchVisible,
  isDepartmentVisible,
  isFacultyMemberVisible,
  isOfferingVisible,
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
  type LiveAdminSearchScope,
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
  SearchField,
  SectionHeading,
  SelectInput,
  TextAreaInput,
  TextInput,
  TOP_TABS,
  formatDate,
  formatDateTime,
  type BreadcrumbSegment,
} from './system-admin-ui'
import type { LiveAdminSectionId } from './system-admin-live-data'
import { applyThemePreset, isLightTheme } from './theme'
import { readProofPlaybackSelection, writeProofPlaybackSelection } from './proof-playback'
import { SystemAdminFacultyCalendarWorkspace } from './system-admin-faculty-calendar-workspace'
import {
  BrandMark,
  Btn,
  Card,
  Chip,
  ModalWorkspace,
  PageShell,
  UI_FONT_SIZES,
  getIconButtonStyle,
  getSegmentedButtonStyle,
  getSegmentedGroupStyle,
  getShellBarStyle,
  withAlpha,
} from './ui-primitives'

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
  courseworkWeeks: string
  examPreparationWeeks: string
  seeWeeks: string
  totalWeeks: string
  minimumAttendancePercent: string
  condonationFloorPercent: string
  condonationShortagePercent: string
  condonationRequiresApproval: boolean
  minimumCeForSeeEligibility: string
  allowCondonationForSeeEligibility: boolean
  minimumCeMark: string
  minimumSeeMark: string
  minimumOverallMark: string
  applyBeforeStatusDetermination: boolean
  sgpaCgpaDecimals: string
  repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
  passMarkPercent: string
  minimumCgpaForPromotion: string
  requireNoActiveBacklogs: boolean
  highRiskAttendancePercentBelow: string
  mediumRiskAttendancePercentBelow: string
  highRiskCgpaBelow: string
  mediumRiskCgpaBelow: string
  highRiskBacklogCount: string
  mediumRiskBacklogCount: string
}

type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

type CurriculumFeatureFormState = {
  assessmentProfile: string
  outcomesText: string
  prerequisitesText: string
  bridgeModulesText: string
  tt1TopicsText: string
  tt2TopicsText: string
  seeTopicsText: string
  workbookTopicsText: string
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
}

type StagePolicyFormState = {
  stages: Array<{
    key: ApiStagePolicyPayload['stages'][number]['key']
    label: string
    description: string
    semesterDayOffset: string
    requiredEvidence: ApiStageEvidenceKind[]
    requireQueueClearance: boolean
    requireTaskClearance: boolean
    advancementMode: ApiStagePolicyPayload['stages'][number]['advancementMode']
    color: string
  }>
}

type BatchProvisioningFormState = {
  termId: string
  sectionLabels: string
  mode: ApiBatchProvisioningRequest['mode']
  studentsPerSection: string
  createStudents: boolean
  createMentors: boolean
  createAttendanceScaffolding: boolean
  createAssessmentScaffolding: boolean
  createTranscriptScaffolding: boolean
}

type StudentDetailTab = 'profile' | 'academic' | 'mentor' | 'progression' | 'history'
type FacultyDetailTab = 'profile' | 'appointments' | 'permissions' | 'teaching' | 'timetable' | 'history'
type UniversityTab = 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'stage' | 'courses' | 'provision'
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

type HierarchyScopeInput = {
  academicFacultyId?: string | null
  departmentId?: string | null
  branchId?: string | null
  batchId?: string | null
  sectionCode?: string | null
}

type ActiveAdminScope = {
  scopeType: ApiScopeType
  scopeId: string
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
const ADMIN_DISMISSED_QUEUE_STORAGE_KEY = 'airmentor-admin-dismissed-queue-items'

function applyFacultyVisibilityRules(facultyMembers: ApiFacultyRecord[]) {
  return [...facultyMembers].sort((left, right) => {
    const leftLabel = left.displayName.toLowerCase()
    const rightLabel = right.displayName.toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
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
    ce: '60', see: '40', termTestsWeight: '30', quizWeight: '10', assignmentWeight: '20',
    maxTermTests: '2', maxQuizzes: '2', maxAssignments: '2',
    dayStart: '08:30', dayEnd: '16:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    courseworkWeeks: '16', examPreparationWeeks: '1', seeWeeks: '3', totalWeeks: '20',
    minimumAttendancePercent: '75',
    condonationFloorPercent: '65',
    condonationShortagePercent: '10',
    condonationRequiresApproval: true,
    minimumCeForSeeEligibility: '24',
    allowCondonationForSeeEligibility: true,
    minimumCeMark: '24',
    minimumSeeMark: '16',
    minimumOverallMark: '40',
    applyBeforeStatusDetermination: true,
    sgpaCgpaDecimals: '2',
    repeatedCoursePolicy: 'latest-attempt',
    passMarkPercent: '40',
    minimumCgpaForPromotion: '5.0',
    requireNoActiveBacklogs: true,
    highRiskAttendancePercentBelow: '65',
    mediumRiskAttendancePercentBelow: '75',
    highRiskCgpaBelow: '6.0',
    mediumRiskCgpaBelow: '7.0',
    highRiskBacklogCount: '2',
    mediumRiskBacklogCount: '1',
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

function defaultCurriculumFeatureForm(): CurriculumFeatureFormState {
  return {
    assessmentProfile: 'admin-authored',
    outcomesText: '',
    prerequisitesText: '',
    bridgeModulesText: '',
    tt1TopicsText: '',
    tt2TopicsText: '',
    seeTopicsText: '',
    workbookTopicsText: '',
  }
}

function hydrateCurriculumFeatureForm(item: ApiCurriculumFeatureConfigBundle['items'][number] | null): CurriculumFeatureFormState {
  if (!item) return defaultCurriculumFeatureForm()
  return {
    assessmentProfile: item.assessmentProfile || 'admin-authored',
    outcomesText: item.outcomes.map(outcome => `${outcome.id} | ${outcome.bloom} | ${outcome.desc}`).join('\n'),
    prerequisitesText: item.prerequisites.map(prerequisite => `${prerequisite.sourceCourseCode} | ${prerequisite.edgeKind} | ${prerequisite.rationale}`).join('\n'),
    bridgeModulesText: item.bridgeModules.join('\n'),
    tt1TopicsText: item.topicPartitions.tt1.join('\n'),
    tt2TopicsText: item.topicPartitions.tt2.join('\n'),
    seeTopicsText: item.topicPartitions.see.join('\n'),
    workbookTopicsText: item.topicPartitions.workbook.join('\n'),
  }
}

function parseCurriculumFeatureLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function buildCurriculumFeaturePayload(form: CurriculumFeatureFormState): ApiCurriculumFeatureConfigPayload {
  const outcomes = parseCurriculumFeatureLines(form.outcomesText).map((line, index) => {
    const [id, bloom, ...descParts] = line.split('|').map(part => part.trim())
    if (!id || !bloom || descParts.length === 0) {
      throw new Error(`Outcome line ${index + 1} must use "COx | Bloom | Description".`)
    }
    return {
      id,
      bloom,
      desc: descParts.join(' | '),
    }
  })
  const prerequisites = parseCurriculumFeatureLines(form.prerequisitesText).map((line, index) => {
    const [sourceCourseCode, rawKind, ...rationaleParts] = line.split('|').map(part => part.trim())
    let edgeKind: 'explicit' | 'added' | null = null
    if (rawKind === 'added') edgeKind = 'added'
    else if (rawKind === 'explicit' || !rawKind) edgeKind = 'explicit'
    if (!sourceCourseCode || !edgeKind || rationaleParts.length === 0) {
      throw new Error(`Prerequisite line ${index + 1} must use "COURSE_CODE | explicit|added | Rationale".`)
    }
    return {
      sourceCourseCode,
      edgeKind,
      rationale: rationaleParts.join(' | '),
    }
  })
  if (outcomes.length === 0) {
    throw new Error('At least one course outcome is required.')
  }
  return {
    assessmentProfile: requireText('Assessment profile', form.assessmentProfile),
    outcomes,
    prerequisites,
    bridgeModules: parseCurriculumFeatureLines(form.bridgeModulesText),
    topicPartitions: {
      tt1: parseCurriculumFeatureLines(form.tt1TopicsText),
      tt2: parseCurriculumFeatureLines(form.tt2TopicsText),
      see: parseCurriculumFeatureLines(form.seeTopicsText),
      workbook: parseCurriculumFeatureLines(form.workbookTopicsText),
    },
  }
}

const DEFAULT_STAGE_POLICY: ApiStagePolicyPayload = {
  stages: [
    {
      key: 'pre-tt1',
      label: 'Pre TT1',
      description: 'Opening stage before TT1 closes. Scheme setup, attendance updates, and class execution stay open here.',
      order: 1,
      semesterDayOffset: 0,
      requiredEvidence: ['attendance'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#2D8AF0',
    },
    {
      key: 'post-tt1',
      label: 'Post TT1',
      description: 'First checkpoint after TT1 evidence is present and locked.',
      order: 2,
      semesterDayOffset: 35,
      requiredEvidence: ['tt1'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F59E0B',
    },
    {
      key: 'post-tt2',
      label: 'Post TT2',
      description: 'Checkpoint after TT2 evidence is present and locked.',
      order: 3,
      semesterDayOffset: 77,
      requiredEvidence: ['tt2'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#8B5CF6',
    },
    {
      key: 'post-assignments',
      label: 'Post Assignments',
      description: 'Checkpoint after assignment evidence is present and locked. Assignment work may be entered earlier but cannot skip TT2.',
      order: 4,
      semesterDayOffset: 98,
      requiredEvidence: ['assignment'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#F97316',
    },
    {
      key: 'post-see',
      label: 'Post SEE',
      description: 'Checkpoint after SEE evidence is present and locked. This is the end-of-semester progression gate.',
      order: 5,
      semesterDayOffset: 119,
      requiredEvidence: ['finals'],
      requireQueueClearance: true,
      requireTaskClearance: true,
      advancementMode: 'admin-confirmed',
      color: '#EF4444',
    },
  ],
}

const STAGE_EVIDENCE_OPTIONS: ApiStageEvidenceKind[] = ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript']

function defaultStagePolicyForm(): StagePolicyFormState {
  return {
    stages: DEFAULT_STAGE_POLICY.stages.map(stage => ({
      key: stage.key,
      label: stage.label,
      description: stage.description,
      semesterDayOffset: String(stage.semesterDayOffset),
      requiredEvidence: [...stage.requiredEvidence],
      requireQueueClearance: stage.requireQueueClearance,
      requireTaskClearance: stage.requireTaskClearance,
      advancementMode: stage.advancementMode,
      color: stage.color,
    })),
  }
}

function hydrateStagePolicyForm(policy: ApiStagePolicyPayload | null | undefined): StagePolicyFormState {
  const source = policy?.stages?.length ? policy : DEFAULT_STAGE_POLICY
  return {
    stages: DEFAULT_STAGE_POLICY.stages.map(defaultStage => {
      const stage = source.stages.find(item => item.key === defaultStage.key) ?? defaultStage
      return {
        key: stage.key,
        label: stage.label,
        description: stage.description,
        semesterDayOffset: String(stage.semesterDayOffset),
        requiredEvidence: [...stage.requiredEvidence],
        requireQueueClearance: stage.requireQueueClearance,
        requireTaskClearance: stage.requireTaskClearance,
        advancementMode: stage.advancementMode,
        color: stage.color,
      }
    }),
  }
}

function buildStagePolicyPayload(form: StagePolicyFormState): ApiStagePolicyPayload {
  return {
    stages: form.stages.map((stage, index) => ({
      key: stage.key,
      label: requireText(`${stage.key} label`, stage.label),
      description: requireText(`${stage.key} description`, stage.description),
      order: index + 1,
      semesterDayOffset: requireNonNegativeInteger(`${stage.key} semester day offset`, stage.semesterDayOffset),
      requiredEvidence: [...stage.requiredEvidence],
      requireQueueClearance: stage.requireQueueClearance,
      requireTaskClearance: stage.requireTaskClearance,
      advancementMode: stage.advancementMode,
      color: requireText(`${stage.key} color`, stage.color),
    })),
  }
}

function defaultBatchProvisioningForm(): BatchProvisioningFormState {
  return {
    termId: '',
    sectionLabels: 'A, B',
    mode: 'mock',
    studentsPerSection: '60',
    createStudents: true,
    createMentors: true,
    createAttendanceScaffolding: true,
    createAssessmentScaffolding: false,
    createTranscriptScaffolding: true,
  }
}

function buildBatchProvisioningPayload(form: BatchProvisioningFormState): ApiBatchProvisioningRequest {
  return {
    termId: requireText('Provisioning term', form.termId),
    sectionLabels: parseCurriculumFeatureLines(form.sectionLabels.replace(/,/g, '\n')),
    mode: form.mode ?? 'mock',
    studentsPerSection: requirePositiveInteger('Students per section', form.studentsPerSection),
    createStudents: form.createStudents,
    createMentors: form.createMentors,
    createAttendanceScaffolding: form.createAttendanceScaffolding,
    createAssessmentScaffolding: form.createAssessmentScaffolding,
    createTranscriptScaffolding: form.createTranscriptScaffolding,
  }
}

function mergePolicyPayload(base: ApiResolvedBatchPolicy['effectivePolicy'], override: ApiPolicyPayload): ApiResolvedBatchPolicy['effectivePolicy'] {
  return {
    gradeBands: override.gradeBands ?? base.gradeBands,
    ceSeeSplit: override.ceSeeSplit ?? base.ceSeeSplit,
    ceComponentCaps: override.ceComponentCaps ?? base.ceComponentCaps,
    workingCalendar: override.workingCalendar ?? base.workingCalendar,
    attendanceRules: override.attendanceRules ?? base.attendanceRules,
    condonationRules: override.condonationRules ?? base.condonationRules,
    eligibilityRules: override.eligibilityRules ?? base.eligibilityRules,
    passRules: override.passRules ?? base.passRules,
    roundingRules: override.roundingRules ?? base.roundingRules,
    sgpaCgpaRules: override.sgpaCgpaRules ?? base.sgpaCgpaRules,
    progressionRules: override.progressionRules ?? base.progressionRules,
    riskRules: override.riskRules ?? base.riskRules,
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

function toRegistrySearchScope(filter: RegistryFilterState): LiveAdminSearchScope | null {
  return {
    academicFacultyId: filter.academicFacultyId || undefined,
    departmentId: filter.departmentId || undefined,
    branchId: filter.branchId || undefined,
    batchId: filter.batchId || undefined,
    sectionCode: filter.sectionCode || undefined,
  }
}

function normalizeHierarchyScope(scope: HierarchyScopeInput | null): LiveAdminSearchScope | null {
  if (!scope) return null
  return {
    academicFacultyId: scope.academicFacultyId || undefined,
    departmentId: scope.departmentId || undefined,
    branchId: scope.branchId || undefined,
    batchId: scope.batchId || undefined,
    sectionCode: scope.sectionCode || undefined,
  }
}

function describeRegistryScope(data: LiveAdminDataset, scope?: LiveAdminSearchScope | null) {
  if (!hasHierarchyScopeSelection(scope)) return null
  if (scope?.sectionCode) {
    const branch = resolveBranch(data, scope.branchId)
    const batch = resolveBatch(data, scope.batchId)
    return [`Section ${scope.sectionCode}`, batch ? `Batch ${batch.batchLabel}` : null, branch?.code ?? null].filter(Boolean).join(' · ')
  }
  if (scope?.batchId) {
    const batch = resolveBatch(data, scope.batchId)
    const branch = resolveBranch(data, scope.branchId)
    if (!batch) return branch?.name ?? 'Selected year'
    return [`${deriveCurrentYearLabel(batch.currentSemester)}`, `Batch ${batch.batchLabel}`, branch?.code ?? null].filter(Boolean).join(' · ')
  }
  if (scope?.branchId) return resolveBranch(data, scope.branchId)?.name ?? 'Selected branch'
  if (scope?.departmentId) return resolveDepartment(data, scope.departmentId)?.name ?? 'Selected department'
  if (scope?.academicFacultyId) return resolveAcademicFaculty(data, scope.academicFacultyId)?.name ?? 'Selected faculty'
  return null
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
    courseworkWeeks: String(policy.workingCalendar.courseworkWeeks),
    examPreparationWeeks: String(policy.workingCalendar.examPreparationWeeks),
    seeWeeks: String(policy.workingCalendar.seeWeeks),
    totalWeeks: String(policy.workingCalendar.totalWeeks),
    minimumAttendancePercent: String(policy.attendanceRules.minimumRequiredPercent),
    condonationFloorPercent: String(policy.attendanceRules.condonationFloorPercent),
    condonationShortagePercent: String(policy.condonationRules.maximumShortagePercent),
    condonationRequiresApproval: policy.condonationRules.requiresApproval,
    minimumCeForSeeEligibility: String(policy.eligibilityRules.minimumCeForSeeEligibility),
    allowCondonationForSeeEligibility: policy.eligibilityRules.allowCondonationForSeeEligibility,
    minimumCeMark: String(policy.passRules.minimumCeMark),
    minimumSeeMark: String(policy.passRules.minimumSeeMark),
    minimumOverallMark: String(policy.passRules.minimumOverallMark),
    applyBeforeStatusDetermination: policy.roundingRules.applyBeforeStatusDetermination,
    sgpaCgpaDecimals: String(policy.roundingRules.sgpaCgpaDecimals),
    repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
    passMarkPercent: String(policy.progressionRules.passMarkPercent),
    minimumCgpaForPromotion: String(policy.progressionRules.minimumCgpaForPromotion),
    requireNoActiveBacklogs: policy.progressionRules.requireNoActiveBacklogs,
    highRiskAttendancePercentBelow: String(policy.riskRules.highRiskAttendancePercentBelow),
    mediumRiskAttendancePercentBelow: String(policy.riskRules.mediumRiskAttendancePercentBelow),
    highRiskCgpaBelow: String(policy.riskRules.highRiskCgpaBelow),
    mediumRiskCgpaBelow: String(policy.riskRules.mediumRiskCgpaBelow),
    highRiskBacklogCount: String(policy.riskRules.highRiskBacklogCount),
    mediumRiskBacklogCount: String(policy.riskRules.mediumRiskBacklogCount),
  }
}

function buildPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
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
    workingCalendar: {
      days: form.workingDays,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      courseworkWeeks: Number(form.courseworkWeeks),
      examPreparationWeeks: Number(form.examPreparationWeeks),
      seeWeeks: Number(form.seeWeeks),
      totalWeeks: Number(form.totalWeeks),
    },
    attendanceRules: {
      minimumRequiredPercent: Number(form.minimumAttendancePercent),
      condonationFloorPercent: Number(form.condonationFloorPercent),
    },
    condonationRules: {
      maximumShortagePercent: Number(form.condonationShortagePercent),
      requiresApproval: form.condonationRequiresApproval,
    },
    eligibilityRules: {
      minimumCeForSeeEligibility: Number(form.minimumCeForSeeEligibility),
      allowCondonationForSeeEligibility: form.allowCondonationForSeeEligibility,
    },
    passRules: {
      minimumCeMark: Number(form.minimumCeMark),
      minimumSeeMark: Number(form.minimumSeeMark),
      minimumOverallMark: Number(form.minimumOverallMark),
      ceMaximum: Number(form.ce),
      seeMaximum: Number(form.see),
      overallMaximum: 100,
    },
    roundingRules: {
      statusMarkRounding: 'nearest-integer',
      applyBeforeStatusDetermination: form.applyBeforeStatusDetermination,
      sgpaCgpaDecimals: Number(form.sgpaCgpaDecimals),
    },
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted', cgpaModel: 'credit-weighted-cumulative', rounding: '2-decimal',
      includeFailedCredits: false, repeatedCoursePolicy: form.repeatedCoursePolicy,
    },
    progressionRules: {
      passMarkPercent: Number(form.passMarkPercent),
      minimumCgpaForPromotion: Number(form.minimumCgpaForPromotion),
      requireNoActiveBacklogs: form.requireNoActiveBacklogs,
    },
    riskRules: {
      highRiskAttendancePercentBelow: Number(form.highRiskAttendancePercentBelow),
      mediumRiskAttendancePercentBelow: Number(form.mediumRiskAttendancePercentBelow),
      highRiskCgpaBelow: Number(form.highRiskCgpaBelow),
      mediumRiskCgpaBelow: Number(form.mediumRiskCgpaBelow),
      highRiskBacklogCount: Number(form.highRiskBacklogCount),
      mediumRiskBacklogCount: Number(form.mediumRiskBacklogCount),
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

function requireNonNegativeInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number.`)
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

function buildValidatedPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
  const oMin = requireRange('O grade minimum', form.oMin, 0, 100)
  const aPlusMin = requireRange('A+ minimum', form.aPlusMin, 0, 100)
  const aMin = requireRange('A minimum', form.aMin, 0, 100)
  const bPlusMin = requireRange('B+ minimum', form.bPlusMin, 0, 100)
  const bMin = requireRange('B minimum', form.bMin, 0, 100)
  const cMin = requireRange('C minimum', form.cMin, 0, 100)
  const pMin = requireRange('P minimum', form.pMin, 0, 100)
  const ce = requireRange('CE', form.ce, 0, 100)
  const see = requireRange('SEE', form.see, 0, 100)
  const termTestsWeight = requireRange('Stored term test weight', form.termTestsWeight, 0, 100)
  const quizWeight = requireRange('Stored quiz weight', form.quizWeight, 0, 100)
  const assignmentWeight = requireRange('Stored assignment weight', form.assignmentWeight, 0, 100)
  const maxTermTests = requirePositiveInteger('Max term tests', form.maxTermTests)
  const maxQuizzes = requirePositiveInteger('Max quizzes', form.maxQuizzes)
  const maxAssignments = requirePositiveInteger('Max assignments', form.maxAssignments)
  const courseworkWeeks = requirePositiveInteger('Coursework weeks', form.courseworkWeeks)
  const examPreparationWeeks = requireRange('Exam preparation weeks', form.examPreparationWeeks, 0, 52)
  const seeWeeks = requireRange('SEE weeks', form.seeWeeks, 0, 52)
  const totalWeeks = requirePositiveInteger('Total weeks', form.totalWeeks)
  const minimumAttendancePercent = requireRange('Minimum attendance percent', form.minimumAttendancePercent, 0, 100)
  const condonationFloorPercent = requireRange('Condonation floor percent', form.condonationFloorPercent, 0, 100)
  const condonationShortagePercent = requireRange('Condonation shortage percent', form.condonationShortagePercent, 0, 100)
  const minimumCeForSeeEligibility = requireRange('Minimum CE for SEE eligibility', form.minimumCeForSeeEligibility, 0, 100)
  const minimumCeMark = requireRange('Minimum CE mark', form.minimumCeMark, 0, 100)
  const minimumSeeMark = requireRange('Minimum SEE mark', form.minimumSeeMark, 0, 100)
  const minimumOverallMark = requireRange('Minimum overall mark', form.minimumOverallMark, 0, 100)
  const sgpaCgpaDecimals = requireRange('SGPA / CGPA decimals', form.sgpaCgpaDecimals, 0, 4)
  const passMarkPercent = requireRange('Pass mark percent', form.passMarkPercent, 0, 100)
  const minimumCgpaForPromotion = requireRange('Minimum CGPA for promotion', form.minimumCgpaForPromotion, 0, 10)
  const highRiskAttendancePercentBelow = requireRange('High risk attendance threshold', form.highRiskAttendancePercentBelow, 0, 100)
  const mediumRiskAttendancePercentBelow = requireRange('Medium risk attendance threshold', form.mediumRiskAttendancePercentBelow, 0, 100)
  const highRiskCgpaBelow = requireRange('High risk CGPA threshold', form.highRiskCgpaBelow, 0, 10)
  const mediumRiskCgpaBelow = requireRange('Medium risk CGPA threshold', form.mediumRiskCgpaBelow, 0, 10)
  const highRiskBacklogCount = requireRange('High risk backlog threshold', form.highRiskBacklogCount, 0, 50)
  const mediumRiskBacklogCount = requireRange('Medium risk backlog threshold', form.mediumRiskBacklogCount, 0, 50)

  if (ce + see !== 100) throw new Error('CE and SEE must total 100.')
  if (courseworkWeeks + examPreparationWeeks + seeWeeks !== totalWeeks) {
    throw new Error('Coursework, exam preparation, and SEE weeks must total the configured total weeks.')
  }
  if (condonationFloorPercent > minimumAttendancePercent) {
    throw new Error('Condonation floor percent must be less than or equal to the minimum attendance percent.')
  }
  if (minimumCeForSeeEligibility > ce) {
    throw new Error('Minimum CE for SEE eligibility cannot exceed the CE maximum.')
  }
  if (minimumCeMark > ce || minimumSeeMark > see || minimumOverallMark > 100) {
    throw new Error('Pass thresholds cannot exceed the configured CE / SEE totals.')
  }
  if (!(oMin >= aPlusMin && aPlusMin >= aMin && aMin >= bPlusMin && bPlusMin >= bMin && bMin >= cMin && cMin >= pMin)) {
    throw new Error('Grade bands must descend from O down to P without gaps going upward.')
  }
  if (highRiskAttendancePercentBelow > mediumRiskAttendancePercentBelow) {
    throw new Error('High risk attendance threshold must be less than or equal to the medium risk threshold.')
  }
  if (highRiskCgpaBelow > mediumRiskCgpaBelow) {
    throw new Error('High risk CGPA threshold must be less than or equal to the medium risk threshold.')
  }
  if (highRiskBacklogCount < mediumRiskBacklogCount) {
    throw new Error('High risk backlog threshold must be greater than or equal to the medium risk threshold.')
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
    courseworkWeeks: String(courseworkWeeks),
    examPreparationWeeks: String(examPreparationWeeks),
    seeWeeks: String(seeWeeks),
    totalWeeks: String(totalWeeks),
    minimumAttendancePercent: String(minimumAttendancePercent),
    condonationFloorPercent: String(condonationFloorPercent),
    condonationShortagePercent: String(condonationShortagePercent),
    minimumCeForSeeEligibility: String(minimumCeForSeeEligibility),
    minimumCeMark: String(minimumCeMark),
    minimumSeeMark: String(minimumSeeMark),
    minimumOverallMark: String(minimumOverallMark),
    sgpaCgpaDecimals: String(sgpaCgpaDecimals),
    passMarkPercent: String(passMarkPercent),
    minimumCgpaForPromotion: String(minimumCgpaForPromotion),
    highRiskAttendancePercentBelow: String(highRiskAttendancePercentBelow),
    mediumRiskAttendancePercentBelow: String(mediumRiskAttendancePercentBelow),
    highRiskCgpaBelow: String(highRiskCgpaBelow),
    mediumRiskCgpaBelow: String(mediumRiskCgpaBelow),
    highRiskBacklogCount: String(highRiskBacklogCount),
    mediumRiskBacklogCount: String(mediumRiskBacklogCount),
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

function readStringField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'string' ? value : null
}

function readNumberField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBooleanField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'boolean' ? value : null
}

function readRecordField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function formatSplitSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const train = readNumberField(summary, 'train')
  const validation = readNumberField(summary, 'validation')
  const test = readNumberField(summary, 'test')
  return [
    train != null ? `train ${train}` : null,
    validation != null ? `validation ${validation}` : null,
    test != null ? `test ${test}` : null,
  ].filter((value): value is string => !!value).join(' · ') || 'Unavailable'
}

function formatKeyedCounts(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} ${value}`)
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

function formatHeadSupportSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([headKey, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return headKey
      const record = value as Record<string, unknown>
      const counts = [
        readNumberField(record, 'trainSupport') ?? readNumberField(record, 'train'),
        readNumberField(record, 'validationSupport') ?? readNumberField(record, 'validation'),
        readNumberField(record, 'testSupport') ?? readNumberField(record, 'test'),
      ].filter((item): item is number => typeof item === 'number')
      if (counts.length === 0) return headKey
      return `${headKey} ${counts.join('/')}`
    })
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

function formatDiagnosticSummary(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      if (value == null) return null
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return `${key} ${String(value)}`
      if (Array.isArray(value)) return `${key} ${value.length} items`
      if (typeof value === 'object') {
        const nestedKeys = Object.keys(value as Record<string, unknown>).slice(0, 3)
        return `${key} ${nestedKeys.join('/') || 'object'}`
      }
      return null
    })
    .filter((value): value is string => !!value)
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
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

function matchesStudentScope(student: LiveAdminDataset['students'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
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

function matchesFacultyScope(member: LiveAdminDataset['facultyMembers'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
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
    if (!offering || !isOfferingVisible(data, offering)) return false
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

function matchesOfferingScope(offering: LiveAdminDataset['offerings'][number], data: LiveAdminDataset, scope: HierarchyScopeInput | null) {
  if (!scope) return true
  const hasScopedSelection = Boolean(scope.academicFacultyId || scope.departmentId || scope.branchId || scope.batchId || scope.sectionCode)
  if (!hasScopedSelection) return true
  if (!isOfferingVisible(data, offering)) return false

  const branch = offering.branchId ? resolveBranch(data, offering.branchId) : null
  const department = branch
    ? resolveDepartment(data, branch.departmentId)
    : data.departments.find(item => item.code.toLowerCase() === offering.dept.toLowerCase()) ?? null
  const term = offering.termId ? data.terms.find(item => item.termId === offering.termId) ?? null : null

  if (scope.academicFacultyId && department?.academicFacultyId !== scope.academicFacultyId) return false
  if (scope.departmentId && department?.departmentId !== scope.departmentId) return false
  if (scope.branchId && offering.branchId !== scope.branchId) return false
  if (scope.batchId && term?.batchId !== scope.batchId) return false
  if (scope.sectionCode && offering.section !== scope.sectionCode) return false
  return true
}

function formatScopeTypeLabel(scopeType: ApiScopeType) {
  switch (scopeType) {
    case 'institution':
      return 'Institution'
    case 'academic-faculty':
      return 'Faculty'
    case 'department':
      return 'Department'
    case 'branch':
      return 'Branch'
    case 'batch':
      return 'Batch'
    default:
      return scopeType
  }
}

function matchesBatchScope(batch: LiveAdminDataset['batches'][number], data: LiveAdminDataset, scopeType: ApiScopeType, scopeId: string) {
  if (scopeType === 'institution') return true
  if (scopeType === 'batch') return batch.batchId === scopeId
  if (scopeType === 'branch') return batch.branchId === scopeId
  const branch = resolveBranch(data, batch.branchId)
  if (!branch) return false
  if (scopeType === 'department') return branch.departmentId === scopeId
  if (scopeType === 'academic-faculty') {
    const department = resolveDepartment(data, branch.departmentId)
    return department?.academicFacultyId === scopeId
  }
  return false
}

function TeachingShellAdminTopBar({
  institutionName,
  adminName,
  contextLabel,
  now,
  themeMode,
  actionCount,
  canNavigateBack,
  onNavigateBack,
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
  canNavigateBack: boolean
  onNavigateBack: () => void
  onToggleTheme: () => void
  onGoHome: () => void
  onToggleQueue: () => void
  onRefresh: () => void
  onExitPortal?: () => void
  onLogout: () => void
}) {
  return (
    <div style={{ ...getShellBarStyle(themeMode), zIndex: 40, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label="Go to dashboard"
            title="Go to dashboard"
            onClick={onGoHome}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
          >
            <BrandMark size={36} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sora, fontWeight: 800, fontSize: 15, color: T.text }}>{institutionName}</div>
            <div style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: T.dim }}>Welcome {adminName} · {contextLabel}</div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canNavigateBack ? (
            <button type="button" aria-label="Go back" title="Go back" onClick={onNavigateBack} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={14} />
              Back
            </button>
          ) : null}
          <div style={{ ...getIconButtonStyle({ subtle: false }), width: 'auto', padding: '0 12px', ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.dim, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock3 size={12} />
            {formatClockLabel(now)}
          </div>
          <button type="button" aria-label={isLightTheme(themeMode) ? 'Switch to dark mode' : 'Switch to light mode'} title={isLightTheme(themeMode) ? 'Dark mode' : 'Light mode'} onClick={onToggleTheme} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted, ...mono, fontSize: 14, lineHeight: 1 }}>
            {isLightTheme(themeMode) ? '🌙' : '☀️'}
          </button>
          <button type="button" aria-label="Open action queue" onClick={onToggleQueue} style={{ ...getIconButtonStyle({ active: actionCount > 0 }), color: actionCount > 0 ? T.accent : T.muted, position: 'relative' }}>
            <Bell size={14} />
            {actionCount > 0 ? (
              <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, background: T.danger, color: '#fff', ...mono, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {Math.min(actionCount, 99)}
              </span>
            ) : null}
          </button>
          <button type="button" aria-label="Refresh admin data" onClick={onRefresh} style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted }}>
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={onLogout} style={{ ...getIconButtonStyle({ subtle: true }), width: 'auto', padding: '0 12px', color: T.muted, ...mono, fontSize: UI_FONT_SIZES.eyebrow }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

function OperationsRail({
  collapsed,
  contextLabel,
  scopeLabel,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  searchResults,
  activeSection,
  onSectionChange,
  breadcrumbs,
  onToggleCollapsed,
}: {
  collapsed: boolean
  contextLabel: string
  scopeLabel?: string
  searchQuery: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchResults: Array<{ key: string; title: string; subtitle: string; onSelect: () => void }>
  activeSection: LiveAdminSectionId
  onSectionChange: (section: LiveAdminSectionId) => void
  breadcrumbs: BreadcrumbSegment[]
  onToggleCollapsed: () => void
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 0 : 232, opacity: collapsed ? 0 : 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-hidden={collapsed}
      style={{
        position: 'sticky',
        top: 0,
        height: 'calc(100vh - 84px)',
        alignSelf: 'start',
        background: `linear-gradient(180deg, ${T.surface}, ${T.surface2})`,
        borderRight: collapsed ? 'none' : `1px solid ${T.border}`,
        overflow: 'hidden',
        flexShrink: 0,
        pointerEvents: collapsed ? 'none' : 'auto',
      }}
    >
      <div className="scroll-pane scroll-pane--dense" style={{ height: '100%', overflowY: 'auto', padding: '16px 12px', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Operations Rail</div>
            <div style={{ ...sora, fontSize: 16, fontWeight: 800, color: T.text, marginTop: 6 }}>{contextLabel}</div>
            {scopeLabel ? <div style={{ ...mono, fontSize: 10, color: T.accent, marginTop: 6 }}>{scopeLabel}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Collapse operations rail"
            title="Collapse operations rail"
            onClick={onToggleCollapsed}
            style={{ ...getIconButtonStyle({ subtle: false }), color: T.muted, marginLeft: 'auto' }}
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <SearchField
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            ariaLabel="Admin search"
          />
          {searchResults.length > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {searchResults.map((result, index) => (
                <button
                  key={result.key}
                  type="button"
                  onClick={result.onSelect}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: index < searchResults.length - 1 ? `1px solid ${T.border}` : 'none',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ ...sora, fontSize: 12, fontWeight: 700, color: T.text }}>{result.title}</div>
                  <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{result.subtitle}</div>
                </button>
              ))}
            </Card>
          ) : searchQuery.trim() ? (
            <InfoBanner message="No matching records in the active admin scope." />
          ) : null}
        </div>

        <nav style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          {TOP_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeSection === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                data-nav-item="true"
                data-active={active ? 'true' : 'false'}
                onClick={() => onSectionChange(tab.id as LiveAdminSectionId)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 12,
                  border: `1px solid ${active ? withAlpha(T.accent, '44') : 'transparent'}`,
                  background: active ? withAlpha(T.accent, '18') : 'transparent',
                  color: active ? T.accentLight : T.muted,
                  cursor: 'pointer',
                  textAlign: 'left',
                  minHeight: 44,
                }}
              >
                <Icon size={15} />
                <span style={{ ...sora, fontSize: 12, fontWeight: 700 }}>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <Card style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Path</div>
          {breadcrumbs.length > 0 ? <AdminBreadcrumbs segments={breadcrumbs} /> : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No deeper scope selected yet.</div>}
        </Card>
      </div>
    </motion.aside>
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
      surface={active ? 'selected' : 'launch'}
      glow={active ? tone : undefined}
      onClick={onClick}
      style={{
        padding: 22,
        minHeight: 196,
        background: active
          ? `linear-gradient(160deg, ${withAlpha(tone, '20')} 0%, ${withAlpha(tone, '0f')} 18%, ${T.surface} 100%)`
          : `linear-gradient(160deg, ${withAlpha(tone, '10')} 0%, ${T.surface} 20%, ${T.surface2} 100%)`,
        display: 'grid',
        alignContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${tone}16`, color: tone }}>
          {icon}
        </div>
        <div>
          <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone }}>{caption}</div>
        </div>
      </div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.meta, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

function OverviewSupportCard({
  title,
  value,
  helper,
  tone,
  onClick,
}: {
  title: string
  value: string
  helper: string
  tone: string
  onClick?: () => void
}) {
  return (
    <Card
      surface="launch"
      onClick={onClick}
      style={{
        padding: 18,
        minHeight: 148,
        display: 'grid',
        alignContent: 'space-between',
        background: `linear-gradient(180deg, ${withAlpha(tone, '0d')}, ${T.surface})`,
      }}
    >
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, lineHeight: 1.8 }}>{helper}</div>
    </Card>
  )
}

function toOptionalScopeValue(value?: string | null) {
  return value ?? undefined
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
    <Card onClick={onClick} style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, cursor: onClick ? 'pointer' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, marginTop: 4, lineHeight: 1.7 }}>{subtitle}</div>
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
    <div style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', alignItems: 'center', justifyContent: 'flex-start', rowGap: 6 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          data-tab="true"
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            minWidth: 0,
            maxWidth: '100%',
            flex: '0 0 auto',
            textAlign: 'left',
            alignSelf: 'flex-start',
            ...getSegmentedButtonStyle({ active: activeTab === tab.id, disabled: tab.disabled, compact: true }),
          }}
        >
          <span style={{ ...sora, fontSize: 12, fontWeight: 700 }}>{tab.label}</span>
          {tab.count != null ? <Chip color={activeTab === tab.id ? T.accent : T.dim} size={8}>{String(tab.count)}</Chip> : null}
          {tab.disabled && tab.count == null ? <span style={{ ...mono, fontSize: 9, color: T.dim }}>Locked</span> : null}
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
    <div style={{ borderRadius: 16, border: `1px solid ${withAlpha(tone, '28')}`, background: `linear-gradient(180deg, ${withAlpha(tone, '12')}, ${T.surface})`, padding: '12px 14px', minWidth: 0, boxShadow: `0 10px 24px ${withAlpha(tone, '12')}` }}>
      <div style={{ ...mono, fontSize: UI_FONT_SIZES.micro, color: tone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text, marginTop: 6, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</div>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window === 'undefined' ? false : window.innerWidth < 1280)
  const [remindersSupported, setRemindersSupported] = useState(true)
  const [universityTab, setUniversityTab] = useState<UniversityTab>('overview')
  const [selectedSectionCode, setSelectedSectionCode] = useState<string | null>(null)
  const [route, setRoute] = useState<LiveAdminRoute>(() => parseAdminRoute(typeof window === 'undefined' ? '' : window.location.hash))
  const [routeHistory, setRouteHistory] = useState<AdminWorkspaceSnapshot[]>([])
  const [registryScope, setRegistryScope] = useState<UniversityScopeState | null>(null)
  const [studentRegistryFilter, setStudentRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [facultyRegistryFilter, setFacultyRegistryFilter] = useState<RegistryFilterState>(() => defaultRegistryFilter())
  const [studentRegistrySearch, setStudentRegistrySearch] = useState('')
  const [facultyRegistrySearch, setFacultyRegistrySearch] = useState('')
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
  const [stagePolicyOverrides, setStagePolicyOverrides] = useState<ApiStagePolicyOverride[]>([])
  const [resolvedStagePolicy, setResolvedStagePolicy] = useState<ApiResolvedBatchStagePolicy | null>(null)
  const [stagePolicyForm, setStagePolicyForm] = useState<StagePolicyFormState>(() => defaultStagePolicyForm())
  const [proofDashboard, setProofDashboard] = useState<ApiProofDashboard | null>(null)
  const [proofDashboardLoading, setProofDashboardLoading] = useState(false)
  const [curriculumFeatureConfig, setCurriculumFeatureConfig] = useState<ApiCurriculumFeatureConfigBundle | null>(null)
  const [selectedCurriculumFeatureCourseId, setSelectedCurriculumFeatureCourseId] = useState('')
  const [selectedCurriculumSemester, setSelectedCurriculumSemester] = useState('')
  const [selectedCurriculumCourseId, setSelectedCurriculumCourseId] = useState('')
  const [curriculumFeatureForm, setCurriculumFeatureForm] = useState<CurriculumFeatureFormState>(() => defaultCurriculumFeatureForm())
  const [curriculumFeatureTargetMode, setCurriculumFeatureTargetMode] = useState<'batch-local-override' | 'scope-profile'>('batch-local-override')
  const [curriculumFeatureTargetScopeKey, setCurriculumFeatureTargetScopeKey] = useState('')
  const [curriculumFeatureBindingMode, setCurriculumFeatureBindingMode] = useState<'inherit-scope-profile' | 'pin-profile' | 'local-only'>('inherit-scope-profile')
  const [curriculumFeaturePinnedProfileId, setCurriculumFeaturePinnedProfileId] = useState('')
  const [batchProvisioningForm, setBatchProvisioningForm] = useState<BatchProvisioningFormState>(() => defaultBatchProvisioningForm())
  const [selectedStageOfferingId, setSelectedStageOfferingId] = useState('')
  const [selectedStageEligibility, setSelectedStageEligibility] = useState<ApiOfferingStageEligibility | null>(null)
  const [selectedProofCheckpointId, setSelectedProofCheckpointId] = useState<string | null>(() => readProofPlaybackSelection()?.simulationStageCheckpointId ?? null)
  const [selectedProofCheckpointDetail, setSelectedProofCheckpointDetail] = useState<ApiProofRunCheckpointDetail | null>(null)
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
  const [showFacultyTimetableExpanded, setShowFacultyTimetableExpanded] = useState(false)
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

  const handleNavigateBack = useCallback(() => {
    const nextHistory = [...routeHistory]
    const previous = nextHistory.pop()
    if (!previous) {
      handleGoHome()
      return
    }
    setRouteHistory(nextHistory)
    pendingScrollRestoreRef.current = previous.scrollY
    setRoute(previous.route)
    setUniversityTab(previous.universityTab)
    setSelectedSectionCode(previous.selectedSectionCode)
    if (typeof window !== 'undefined') {
      const nextHash = routeToHash(previous.route)
      if (window.location.hash !== nextHash) window.location.hash = nextHash
    }
  }, [handleGoHome, routeHistory])

  const settleCookieBackedSession = useCallback(async (stage: 'login' | 'role-switch') => {
    const retryDelaysMs = [0, 75, 200, 400, 750, 1200, 2000, 3000]
    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await new Promise(resolve => window.setTimeout(resolve, delayMs))
      }
      try {
        return await apiClient.restoreSession()
      } catch (error) {
        if (error instanceof AirMentorApiError && error.status === 401) continue
        throw error
      }
    }
    throw new Error(
      stage === 'login'
        ? 'Signed in, but the backend session cookie did not become readable yet. Please try signing in again.'
        : 'Role switch did not settle in the backend session. Please retry the switch.',
    )
  }, [apiClient])

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
      const [institution, academicFaculties, departments, branches, batches, terms, facultyMembers, students, courses, curriculumCourses, policyOverrides, nextStagePolicyOverrides, offerings, ownerships, requests, reminders] = await Promise.all([
        safeInstitution(), apiClient.listAcademicFaculties(), apiClient.listDepartments(),
        apiClient.listBranches(), apiClient.listBatches(), apiClient.listTerms(),
        apiClient.listFaculty(), apiClient.listStudents(), apiClient.listCourses(),
        apiClient.listCurriculumCourses(), apiClient.listPolicyOverrides(), apiClient.listStagePolicyOverrides(),
        apiClient.listOfferings(), apiClient.listOfferingOwnership(), apiClient.listAdminRequests(),
        safeReminders(),
      ])
      setData({
        institution, academicFaculties: academicFaculties.items, departments: departments.items,
        branches: branches.items, batches: batches.items, terms: terms.items,
        facultyMembers: applyFacultyVisibilityRules(facultyMembers.items), students: students.items, courses: courses.items,
        curriculumCourses: curriculumCourses.items, policyOverrides: policyOverrides.items,
        offerings: offerings.items, ownerships: ownerships.items, requests: requests.items,
        reminders: reminders.items,
      })
      setStagePolicyOverrides(nextStagePolicyOverrides.items)
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
      setResolvedStagePolicy(null)
      setProofDashboard(null)
      setCurriculumFeatureConfig(null)
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      setStagePolicyForm(defaultStagePolicyForm())
      setSelectedStageOfferingId('')
      setSelectedStageEligibility(null)
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

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setResolvedStagePolicy(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedStagePolicy(route.batchId!)
        if (cancelled) return
        setResolvedStagePolicy(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, session])

  const refreshCurriculumFeatureConfig = useCallback(async (batchId: string) => {
    const next = await apiClient.getCurriculumFeatureConfig(batchId)
    setCurriculumFeatureConfig(next)
    return next
  }, [apiClient])

  const refreshProofDashboard = useCallback(async (batchId: string) => {
    setProofDashboardLoading(true)
    try {
      const next = await apiClient.getProofDashboard(batchId)
      setProofDashboard(next)
      return next
    } finally {
      setProofDashboardLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setProofDashboard(null)
      return
    }
    let cancelled = false
    setProofDashboardLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getProofDashboard(route.batchId!)
        if (!cancelled) setProofDashboard(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      } finally {
        if (!cancelled) setProofDashboardLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, session])

  useEffect(() => {
    if (!route.batchId) return
    const runStatus = proofDashboard?.activeRunDetail?.status ?? null
    if (runStatus !== 'queued' && runStatus !== 'running') return
    const timer = window.setInterval(() => {
      void refreshProofDashboard(route.batchId!)
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [proofDashboard?.activeRunDetail?.status, refreshProofDashboard, route.batchId])

  const autoRefreshProofBatches = useCallback(async (batchIds: string[], reason: string, overrideImportVersionId?: string | null) => {
    const refreshedBatchIds: string[] = []
    for (const batchId of Array.from(new Set(batchIds.filter(Boolean)))) {
      const scopedConfig = batchId === route.batchId
        ? curriculumFeatureConfig
        : await apiClient.getCurriculumFeatureConfig(batchId)
      const scopedDashboard = batchId === route.batchId
        ? proofDashboard
        : await apiClient.getProofDashboard(batchId)
      const importVersionId = overrideImportVersionId
        ?? scopedConfig?.curriculumImportVersion?.curriculumImportVersionId
        ?? scopedDashboard?.imports[0]?.curriculumImportVersionId
        ?? null
      if (!importVersionId) continue
      const activeRun = scopedDashboard?.activeRunDetail ?? null
      await apiClient.createProofRun(batchId, {
        curriculumImportVersionId: importVersionId,
        seed: activeRun?.seed,
        runLabel: `${activeRun?.runLabel ?? 'Sysadmin auto refresh'} · ${reason}`,
        activate: true,
      })
      refreshedBatchIds.push(batchId)
      if (batchId === route.batchId) {
        await refreshProofDashboard(batchId)
      }
    }
    return refreshedBatchIds
  }, [apiClient, curriculumFeatureConfig, proofDashboard, refreshProofDashboard, route.batchId])

  const maybeAutoRefreshSelectedProofBatch = useCallback(async (reason: string, curriculumImportVersionId?: string | null) => {
    if (!route.batchId) return []
    return autoRefreshProofBatches([route.batchId], reason, curriculumImportVersionId)
  }, [autoRefreshProofBatches, route.batchId])

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setCurriculumFeatureConfig(null)
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getCurriculumFeatureConfig(route.batchId!)
        if (cancelled) return
        setCurriculumFeatureConfig(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, session])

  useEffect(() => {
    const items = curriculumFeatureConfig?.items ?? []
    if (items.length === 0) {
      setSelectedCurriculumFeatureCourseId('')
      setCurriculumFeatureForm(defaultCurriculumFeatureForm())
      return
    }
    const nextSelectedId = items.some(item => item.curriculumCourseId === selectedCurriculumFeatureCourseId)
      ? selectedCurriculumFeatureCourseId
      : items[0]!.curriculumCourseId
    setSelectedCurriculumFeatureCourseId(nextSelectedId)
    const selectedItem = items.find(item => item.curriculumCourseId === nextSelectedId) ?? null
    setCurriculumFeatureForm(hydrateCurriculumFeatureForm(selectedItem))
  }, [curriculumFeatureConfig, selectedCurriculumFeatureCourseId])

  useEffect(() => {
    const binding = curriculumFeatureConfig?.binding
    setCurriculumFeatureBindingMode(binding?.bindingMode ?? 'inherit-scope-profile')
    setCurriculumFeaturePinnedProfileId(binding?.curriculumFeatureProfileId ?? '')
  }, [curriculumFeatureConfig?.binding?.bindingMode, curriculumFeatureConfig?.binding?.curriculumFeatureProfileId])

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
  const activeRunCheckpoints = proofDashboard?.activeRunDetail?.checkpoints ?? []
  const activeModelDiagnostics = proofDashboard?.activeRunDetail?.modelDiagnostics ?? null
  const activeProductionDiagnostics = activeModelDiagnostics?.production ?? null
  const activeChallengerDiagnostics = activeModelDiagnostics?.challenger ?? null
  const activeProductionEvaluation = (activeProductionDiagnostics?.evaluation ?? {}) as Record<string, unknown>
  const activeChallengerEvaluation = (activeChallengerDiagnostics?.evaluation ?? {}) as Record<string, unknown>
  const activeDiagnosticsTrainingManifestVersion = activeModelDiagnostics?.trainingManifestVersion
    ?? readStringField(activeProductionEvaluation, 'trainingManifestVersion')
    ?? readStringField(activeChallengerEvaluation, 'trainingManifestVersion')
    ?? activeProductionDiagnostics?.trainingManifestVersion
    ?? activeChallengerDiagnostics?.trainingManifestVersion
  const activeDiagnosticsCalibrationVersion = activeModelDiagnostics?.calibrationVersion
    ?? activeProductionDiagnostics?.calibrationVersion
    ?? activeChallengerDiagnostics?.calibrationVersion
    ?? readStringField(activeProductionEvaluation, 'calibrationVersion')
    ?? readStringField(activeChallengerEvaluation, 'calibrationVersion')
  const activeDiagnosticsSplitSummary = activeModelDiagnostics?.splitSummary
    ?? readRecordField(activeProductionEvaluation, 'splitSummary')
    ?? readRecordField(activeChallengerEvaluation, 'splitSummary')
  const activeDiagnosticsWorldSplitSummary = activeModelDiagnostics?.worldSplitSummary
    ?? readRecordField(activeProductionEvaluation, 'worldSplitSummary')
    ?? readRecordField(activeChallengerEvaluation, 'worldSplitSummary')
  const activeDiagnosticsScenarioFamilies = activeModelDiagnostics?.scenarioFamilySummary
    ?? readRecordField(activeProductionEvaluation, 'scenarioFamilySummary')
    ?? readRecordField(activeChallengerEvaluation, 'scenarioFamilySummary')
  const activeDiagnosticsHeadSupportSummary = activeModelDiagnostics?.headSupportSummary
    ?? readRecordField(activeProductionEvaluation, 'headSupportSummary')
    ?? readRecordField(activeChallengerEvaluation, 'headSupportSummary')
  const activeDiagnosticsPolicyDiagnostics = activeModelDiagnostics?.policyDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'policyDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'policyDiagnostics')
  const activeDiagnosticsCoEvidence = activeModelDiagnostics?.coEvidenceDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'coEvidenceDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'coEvidenceDiagnostics')
  const activeDiagnosticsSupportWarning = readStringField(activeProductionEvaluation, 'supportWarning')
    ?? readStringField(activeChallengerEvaluation, 'supportWarning')
    ?? null
  const activeDiagnosticsDisplayProbabilityAllowed = readBooleanField(activeProductionEvaluation, 'displayProbabilityAllowed')
    ?? readBooleanField(activeChallengerEvaluation, 'displayProbabilityAllowed')
  const activeDiagnosticsGovernedRunCount = readNumberField(activeProductionEvaluation, 'governedRunCount')
    ?? readNumberField(activeChallengerEvaluation, 'governedRunCount')
  const activeDiagnosticsSkippedRunCount = readNumberField(activeProductionEvaluation, 'skippedRunCount')
    ?? readNumberField(activeChallengerEvaluation, 'skippedRunCount')
  const activeDiagnosticsPolicyAcceptance = readRecordField(activeDiagnosticsPolicyDiagnostics, 'acceptanceGates')
  const activeDiagnosticsUiParity = activeModelDiagnostics?.uiParityDiagnostics
    ?? readRecordField(activeProductionEvaluation, 'uiParityDiagnostics')
    ?? readRecordField(activeChallengerEvaluation, 'uiParityDiagnostics')
  const activeDiagnosticsOverallCourseRuntime = readRecordField(activeProductionEvaluation, 'overallCourseRuntimeSummary')
    ?? readRecordField(activeChallengerEvaluation, 'overallCourseRuntimeSummary')
    ?? readRecordField(activeProductionEvaluation, 'runtimeSummary')
    ?? readRecordField(activeChallengerEvaluation, 'runtimeSummary')
    ?? activeModelDiagnostics?.overallCourseRuntimeSummary
    ?? activeModelDiagnostics?.runtimeSummary
  const activeDiagnosticsQueueBurden = readRecordField(activeProductionEvaluation, 'queueBurdenSummary')
    ?? readRecordField(activeChallengerEvaluation, 'queueBurdenSummary')
    ?? activeModelDiagnostics?.queueBurdenSummary
  const selectedProofCheckpoint = useMemo<ApiSimulationStageCheckpointSummary | null>(() => {
    if (activeRunCheckpoints.length === 0) return null
    if (!selectedProofCheckpointId) return activeRunCheckpoints[0] ?? null
    return activeRunCheckpoints.find(item => item.simulationStageCheckpointId === selectedProofCheckpointId) ?? activeRunCheckpoints[0] ?? null
  }, [activeRunCheckpoints, selectedProofCheckpointId])
  const firstBlockedCheckpointIndex = useMemo(() => (
    activeRunCheckpoints.findIndex(item => item.playbackAccessible === false || item.stageAdvanceBlocked === true || (item.blockingQueueItemCount ?? item.openQueueCount ?? 0) > 0)
  ), [activeRunCheckpoints])
  const firstAccessibleCheckpointIndex = useMemo(() => (
    activeRunCheckpoints.findIndex(item => item.playbackAccessible !== false && item.stageAdvanceBlocked !== true && (item.blockingQueueItemCount ?? item.openQueueCount ?? 0) === 0)
  ), [activeRunCheckpoints])
  const selectedProofCheckpointIndex = useMemo(() => (
    selectedProofCheckpoint
      ? activeRunCheckpoints.findIndex(item => item.simulationStageCheckpointId === selectedProofCheckpoint.simulationStageCheckpointId)
      : -1
  ), [activeRunCheckpoints, selectedProofCheckpoint?.simulationStageCheckpointId])
  const selectedProofCheckpointBlocked = !!selectedProofCheckpoint && (
    selectedProofCheckpoint.playbackAccessible === false
    || selectedProofCheckpoint.stageAdvanceBlocked === true
    || (selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0) > 0
  )
  const selectedProofCheckpointHasBlockedProgression = firstBlockedCheckpointIndex >= 0
    && selectedProofCheckpointIndex >= 0
    && selectedProofCheckpointIndex >= firstBlockedCheckpointIndex
  const selectedProofCheckpointCanStepForward = !!selectedProofCheckpoint && activeRunCheckpoints.length > 0 && !selectedProofCheckpointBlocked && !selectedProofCheckpointHasBlockedProgression
  const selectedProofCheckpointCanPlayToEnd = !!selectedProofCheckpoint && activeRunCheckpoints.length > 0 && !selectedProofCheckpointBlocked && firstBlockedCheckpointIndex < 0
  const studentRegistryScope = useMemo(
    () => toRegistrySearchScope(studentRegistryFilter),
    [studentRegistryFilter.academicFacultyId, studentRegistryFilter.batchId, studentRegistryFilter.branchId, studentRegistryFilter.departmentId, studentRegistryFilter.sectionCode],
  )
  const facultyRegistryScope = useMemo(
    () => toRegistrySearchScope(facultyRegistryFilter),
    [facultyRegistryFilter.academicFacultyId, facultyRegistryFilter.batchId, facultyRegistryFilter.branchId, facultyRegistryFilter.departmentId, facultyRegistryFilter.sectionCode],
  )
  const studentRegistryHasScope = hasHierarchyScopeSelection(studentRegistryScope)
  const selectedStudentRecord = resolveStudent(data, route.studentId)
  const selectedStudent = selectedStudentRecord && isStudentVisible(data, selectedStudentRecord) && (
    route.section !== 'students'
      || (studentRegistryHasScope && matchesStudentScope(selectedStudentRecord, data, studentRegistryScope))
  )
    ? selectedStudentRecord
    : null
  const selectedFacultyRecord = resolveFacultyMember(data, route.facultyMemberId)
  const selectedFacultyMember = selectedFacultyRecord && isFacultyMemberVisible(data, selectedFacultyRecord)
    ? selectedFacultyRecord
    : null

  useEffect(() => {
    if (!proofDashboard?.activeRunDetail || activeRunCheckpoints.length === 0) {
      setSelectedProofCheckpointDetail(null)
      return
    }
    const persistedSelection = readProofPlaybackSelection()
    const persistedCheckpointId = persistedSelection?.simulationRunId === proofDashboard.activeRunDetail.simulationRunId
      ? persistedSelection.simulationStageCheckpointId
      : null
    setSelectedProofCheckpointId(current => (
      current && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === current)
        ? current
        : persistedCheckpointId && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === persistedCheckpointId)
          ? persistedCheckpointId
        : activeRunCheckpoints.find(item => item.playbackAccessible !== false)?.simulationStageCheckpointId
          ?? activeRunCheckpoints[0]?.simulationStageCheckpointId
          ?? null
    ))
  }, [activeRunCheckpoints, proofDashboard?.activeRunDetail?.simulationRunId])

  useEffect(() => {
    if (!proofDashboard?.activeRunDetail?.simulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) {
      setSelectedProofCheckpointDetail(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const detail = await apiClient.getProofRunCheckpointDetail(
          proofDashboard.activeRunDetail!.simulationRunId,
          selectedProofCheckpoint.simulationStageCheckpointId,
        )
        if (!cancelled) setSelectedProofCheckpointDetail(detail)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiClient, proofDashboard?.activeRunDetail?.simulationRunId, selectedProofCheckpoint?.simulationStageCheckpointId])

  useEffect(() => {
    if (!proofDashboard?.activeRunDetail?.simulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) return
    writeProofPlaybackSelection({
      simulationRunId: proofDashboard.activeRunDetail.simulationRunId,
      simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
      updatedAt: new Date().toISOString(),
    })
  }, [proofDashboard?.activeRunDetail?.simulationRunId, selectedProofCheckpoint?.simulationStageCheckpointId])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    const query = deferredSearch.trim()
    const activeSearchScope = route.section === 'faculties'
      ? {
          academicFacultyId: toOptionalScopeValue(route.academicFacultyId),
          departmentId: toOptionalScopeValue(route.departmentId),
          branchId: toOptionalScopeValue(route.branchId),
          batchId: toOptionalScopeValue(route.batchId),
          sectionCode: toOptionalScopeValue(selectedSectionCode),
        }
      : route.section === 'students'
        ? (studentRegistryHasScope ? studentRegistryScope : null)
        : route.section === 'faculty-members'
          ? (hasHierarchyScopeSelection(facultyRegistryScope) ? facultyRegistryScope : null)
          : {
              academicFacultyId: toOptionalScopeValue(registryScope?.academicFacultyId),
              departmentId: toOptionalScopeValue(registryScope?.departmentId),
              branchId: toOptionalScopeValue(registryScope?.branchId),
              batchId: toOptionalScopeValue(registryScope?.batchId),
              sectionCode: toOptionalScopeValue(registryScope?.sectionCode),
            }
    if (!query || (route.section === 'students' && !studentRegistryHasScope)) {
      setServerSearchResults([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await apiClient.searchAdminWorkspace(query, activeSearchScope ?? undefined)
        if (!cancelled) setServerSearchResults(response.items)
      } catch {
        if (!cancelled) setServerSearchResults([])
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, deferredSearch, facultyRegistryScope, registryScope?.academicFacultyId, registryScope?.batchId, registryScope?.branchId, registryScope?.departmentId, registryScope?.sectionCode, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, route.section, selectedSectionCode, session, studentRegistryHasScope, studentRegistryScope])

  useEffect(() => {
    setStudentDetailTab('profile')
  }, [selectedStudent?.studentId])

  useEffect(() => {
    setFacultyDetailTab('profile')
  }, [selectedFacultyMember?.facultyId])

  useEffect(() => {
    setShowFacultyTimetableExpanded(false)
  }, [facultyDetailTab, selectedFacultyMember?.facultyId])

  useEffect(() => {
    if (route.section === 'faculty-members' && route.facultyMemberId && !selectedFacultyMember && session && !dataLoading && data.facultyMembers.length > 0) {
      setActionError('That faculty profile is no longer available in the active workspace.')
      navigate({ section: 'faculty-members' }, { recordHistory: false })
    }
  }, [data.facultyMembers.length, dataLoading, navigate, route.facultyMemberId, route.section, selectedFacultyMember, session])

  useEffect(() => {
    if (route.section !== 'students' || !route.studentId || !session || dataLoading || data.students.length === 0 || selectedStudent) return
    if (!studentRegistryHasScope) {
      setActionError('Select a faculty, department, branch, year, or section before opening student records.')
    } else {
      setActionError('That student is outside the active academic scope.')
    }
    navigate({ section: 'students' }, { recordHistory: false })
  }, [data.students.length, dataLoading, navigate, route.section, route.studentId, selectedStudent, session, studentRegistryHasScope])

  const searchResults = useMemo(() => {
    const activeSearchScope = route.section === 'faculties'
      ? {
          academicFacultyId: toOptionalScopeValue(route.academicFacultyId),
          departmentId: toOptionalScopeValue(route.departmentId),
          branchId: toOptionalScopeValue(route.branchId),
          batchId: toOptionalScopeValue(route.batchId),
          sectionCode: toOptionalScopeValue(selectedSectionCode),
        }
      : route.section === 'students'
        ? (studentRegistryHasScope ? studentRegistryScope : null)
        : route.section === 'faculty-members'
          ? (hasHierarchyScopeSelection(facultyRegistryScope) ? facultyRegistryScope : null)
          : {
              academicFacultyId: toOptionalScopeValue(registryScope?.academicFacultyId),
              departmentId: toOptionalScopeValue(registryScope?.departmentId),
              branchId: toOptionalScopeValue(registryScope?.branchId),
              batchId: toOptionalScopeValue(registryScope?.batchId),
              sectionCode: toOptionalScopeValue(registryScope?.sectionCode),
            }
    const matchesActiveSection = (candidateRoute: LiveAdminRoute) => {
      if (route.section === 'overview') return true
      if (route.section === 'history') return candidateRoute.section === 'requests'
      return candidateRoute.section === route.section
    }
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
      })).filter(result => matchesActiveSection(result.route) && isRouteVisible(result.route))
    }
    return searchLiveAdminWorkspace(data, deferredSearch, {
      section: route.section,
      scope: activeSearchScope,
    }).filter(result => matchesActiveSection(result.route) && isRouteVisible(result.route))
  }, [data, deferredSearch, facultyRegistryScope, registryScope?.academicFacultyId, registryScope?.batchId, registryScope?.branchId, registryScope?.departmentId, registryScope?.sectionCode, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, route.section, selectedSectionCode, serverSearchResults, studentRegistryHasScope, studentRegistryScope])
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
    setOwnershipForm({
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
      await apiClient.login({ identifier, password })
      const nextSession = await settleCookieBackedSession('login')
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
    try {
      await apiClient.switchRoleContext(systemAdminGrant.grantId)
      const next = await settleCookieBackedSession('role-switch')
      setSession(next)
    }
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
    setSelectedCurriculumSemester(String(target.semesterNumber))
    setSelectedCurriculumCourseId(target.curriculumCourseId)
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
      let courseCodeForRefresh = entityEditors.curriculum.courseCode
      const matchingCourse = data.courses.find(item => item.courseCode.toLowerCase() === entityEditors.curriculum.courseCode.toLowerCase() && isVisibleAdminRecord(item.status)) ?? null
      if (entityEditors.curriculum.curriculumCourseId) {
        const current = data.curriculumCourses.find(item => item.curriculumCourseId === entityEditors.curriculum.curriculumCourseId)
        if (!current) throw new Error('Selected curriculum course could not be found.')
        courseCodeForRefresh = current.courseCode
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
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      const rerun = await maybeAutoRefreshSelectedProofBatch(`${courseCodeForRefresh} curriculum refresh`)
      if (rerun.length > 0) {
        setFlashMessage(`Curriculum course saved and proof batch refreshed for ${courseCodeForRefresh}.`)
      }
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
      await refreshCurriculumFeatureConfig(current.batchId)
      const rerun = await maybeAutoRefreshSelectedProofBatch(`${current.courseCode} curriculum archive`)
      setFlashMessage(rerun.length > 0
        ? `Curriculum course archived and proof batch refreshed for ${current.courseCode}.`
        : 'Curriculum course archived.')
    })
  }

  const handleSaveCurriculumFeatureConfig = async () => {
    if (!selectedBatch || !selectedCurriculumFeatureItem) return
    await runAction(async () => {
      const payload = buildCurriculumFeaturePayload(curriculumFeatureForm)
      const [targetScopeType, targetScopeId] = curriculumFeatureTargetScopeKey.split('::')
      const saved = await apiClient.saveCurriculumFeatureConfig(selectedBatch.batchId, selectedCurriculumFeatureItem.curriculumCourseId, {
        ...payload,
        targetMode: curriculumFeatureTargetMode,
        targetScopeType: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeType as ApiScopeType : undefined,
        targetScopeId: curriculumFeatureTargetMode === 'scope-profile' ? targetScopeId : undefined,
      })
      const nextBundle = await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      const nextSelected = nextBundle.items.find(item => item.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId) ?? null
      setCurriculumFeatureForm(hydrateCurriculumFeatureForm(nextSelected))
      const refreshed = await autoRefreshProofBatches(saved.affectedBatchIds ?? [selectedBatch.batchId], `${selectedCurriculumFeatureItem.courseCode} feature refresh`, saved.curriculumImportVersionId)
      setFlashMessage(refreshed.length > 0
        ? `Curriculum model inputs saved and ${refreshed.length} affected batch proof run${refreshed.length === 1 ? '' : 's'} refreshed for ${selectedCurriculumFeatureItem.courseCode}.`
        : `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}.`)
    })
  }

  const handleSaveCurriculumFeatureBinding = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const saved = await apiClient.saveCurriculumFeatureBinding(selectedBatch.batchId, {
        bindingMode: curriculumFeatureBindingMode,
        curriculumFeatureProfileId: curriculumFeatureBindingMode === 'pin-profile' ? (curriculumFeaturePinnedProfileId || null) : null,
        status: 'active',
        version: curriculumFeatureConfig?.binding?.version ?? 1,
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      const refreshed = await autoRefreshProofBatches(saved.affectedBatchIds, 'curriculum feature binding refresh', saved.curriculumImportVersionId)
      setFlashMessage(refreshed.length > 0
        ? `Curriculum feature binding saved and ${refreshed.length} affected batch proof run${refreshed.length === 1 ? '' : 's'} refreshed.`
        : 'Curriculum feature binding saved.')
    })
  }

  const handleSaveScopePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const existing = activeScopePolicyOverride
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildValidatedPolicyPayload(policyForm),
        status: 'active',
      }
      if (existing) await apiClient.updatePolicyOverride(existing.policyOverrideId, { ...payload, version: existing.version })
      else await apiClient.createPolicyOverride(payload)
      await loadAdminData()
      if (selectedBatch) {
        const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId)
        setResolvedBatchPolicy(nextResolved)
      }
      const refreshed = selectedBatch ? await maybeAutoRefreshSelectedProofBatch('policy refresh') : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} policy saved.`)
    })
  }

  const handleResetScopePolicy = async () => {
    if (!activeGovernanceScope || !activeScopePolicyOverride) {
      setFlashMessage('No local override exists at the current scope. This layer is already inheriting.')
      return
    }
    const existing = activeScopePolicyOverride
    if (!existing) {
      setFlashMessage('No local override exists at the current scope. This layer is already inheriting.')
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
      await loadAdminData()
      if (selectedBatch) {
        const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId)
        setResolvedBatchPolicy(nextResolved)
        setPolicyForm(hydratePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = selectedBatch ? await maybeAutoRefreshSelectedProofBatch('policy reset') : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy override reset and proof batch refreshed.`
        : `${activeGovernanceScope.label} policy override reset to inherited defaults.`)
    })
  }

  const handleSaveScopeStagePolicy = async () => {
    if (!activeGovernanceScope) return
    await runAction(async () => {
      const payload = {
        scopeType: activeGovernanceScope.scopeType,
        scopeId: activeGovernanceScope.scopeId,
        policy: buildStagePolicyPayload(stagePolicyForm),
        status: 'active',
      }
      if (activeScopeStageOverride) await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, { ...payload, version: activeScopeStageOverride.version })
      else await apiClient.createStagePolicyOverride(payload)
      await loadAdminData()
      if (selectedBatch) {
        const nextResolved = await apiClient.getResolvedStagePolicy(selectedBatch.batchId)
        setResolvedStagePolicy(nextResolved)
      }
      setFlashMessage(`${activeGovernanceScope.label} stage policy saved.`)
    })
  }

  const handleResetScopeStagePolicy = async () => {
    if (!activeGovernanceScope || !activeScopeStageOverride) {
      setFlashMessage('No local stage policy exists at the current scope. This layer is already inheriting.')
      return
    }
    await runAction(async () => {
      await apiClient.updateStagePolicyOverride(activeScopeStageOverride.stagePolicyOverrideId, {
        scopeType: activeScopeStageOverride.scopeType,
        scopeId: activeScopeStageOverride.scopeId,
        policy: activeScopeStageOverride.policy,
        status: 'archived',
        version: activeScopeStageOverride.version,
      })
      await loadAdminData()
      if (selectedBatch) {
        const nextResolved = await apiClient.getResolvedStagePolicy(selectedBatch.batchId)
        setResolvedStagePolicy(nextResolved)
      }
      setFlashMessage(`${activeGovernanceScope.label} stage policy override reset to inherited defaults.`)
    })
  }

  const handleAdvanceOfferingStage = async () => {
    if (!selectedStageOffering) return
    await runAction(async () => {
      const nextEligibility = await apiClient.advanceOfferingStage(selectedStageOffering.offId)
      setSelectedStageEligibility(nextEligibility)
      await loadAdminData()
      setFlashMessage(`${selectedStageOffering.code} · Section ${selectedStageOffering.section} advanced to ${nextEligibility.currentStage.label}.`)
    })
  }

  const handleProvisionBatch = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const payload = buildBatchProvisioningPayload(batchProvisioningForm)
      const result = await apiClient.provisionBatch(selectedBatch.batchId, payload)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      const refreshed = await autoRefreshProofBatches(result.affectedBatchIds, 'batch provisioning refresh')
      if (selectedBatch.batchId === route.batchId) {
        await refreshProofDashboard(selectedBatch.batchId)
      }
      setFlashMessage(
        `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, ${result.summary.createdMentorCount} mentor links, and ${refreshed.length} proof refresh${refreshed.length === 1 ? '' : 'es'} for ${selectedBatch.batchLabel}.`,
      )
    })
  }

  const handleCreateProofImport = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.createProofImport(selectedBatch.batchId)
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Proof curriculum import created from the reconciled workbook.')
    })
  }

  const handleValidateLatestProofImport = async () => {
    if (!selectedBatch) return
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.validateProofImport(latestImport.curriculumImportVersionId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Latest proof import validated.')
    })
  }

  const handleReviewPendingCrosswalks = async () => {
    if (!selectedBatch || !proofDashboard?.crosswalkReviewQueue.length || !proofDashboard.imports[0]) return
    await runAction(async () => {
      await apiClient.reviewProofCrosswalks(proofDashboard.imports[0].curriculumImportVersionId, {
        reviews: proofDashboard.crosswalkReviewQueue.map(item => ({
          officialCodeCrosswalkId: item.officialCodeCrosswalkId,
          reviewStatus: 'accepted-with-note',
          overrideReason: 'Reviewed in the sysadmin proof shell for the first-6-semester proof batch.',
        })),
      })
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Pending proof crosswalk entries marked as reviewed.')
    })
  }

  const handleApproveLatestProofImport = async () => {
    if (!selectedBatch) return
    const latestImport = proofDashboard?.imports[0]
    if (!latestImport) return
    await runAction(async () => {
      await apiClient.approveProofImport(latestImport.curriculumImportVersionId)
      const rerun = await maybeAutoRefreshSelectedProofBatch('proof import approval', latestImport.curriculumImportVersionId)
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(
        rerun.length > 0
          ? 'Latest proof import approved, synced into the batch curriculum snapshot, and republished as the active proof run.'
          : 'Latest proof import approved and synced into the batch curriculum snapshot.',
      )
    })
  }

  const handleCreateProofRun = async () => {
    if (!selectedBatch) return
    const preferredImport = proofDashboard?.imports.find(item => item.status === 'approved') ?? proofDashboard?.imports[0]
    if (!preferredImport) return
    await runAction(async () => {
      const queuedRun = await apiClient.createProofRun(selectedBatch.batchId, {
        curriculumImportVersionId: preferredImport.curriculumImportVersionId,
        activate: true,
      })
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(`Proof simulation rerun queued as ${queuedRun.simulationRunId}. It will publish automatically when background execution completes.`)
    })
  }

  const handleRetryProofRun = async (simulationRunId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.retryProofRun(simulationRunId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Failed proof run re-queued for background execution.')
    })
  }

  const handleActivateProofRun = async (simulationRunId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.activateProofRun(simulationRunId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Selected proof run is now active.')
    })
  }

  const handleArchiveProofRun = async (simulationRunId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.archiveProofRun(simulationRunId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Selected proof run archived.')
    })
  }

  const handleRecomputeProofRunRisk = async () => {
    if (!selectedBatch || !proofDashboard?.activeRunDetail) return
    const activeRunDetail = proofDashboard.activeRunDetail
    await runAction(async () => {
      await apiClient.recomputeProofRunRisk(activeRunDetail.simulationRunId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Observable-only risk recomputed for the active proof run.')
    })
  }

  const handleRestoreProofSnapshot = async (simulationRunId: string, simulationResetSnapshotId?: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.restoreProofRunSnapshot(simulationRunId, simulationResetSnapshotId ? { simulationResetSnapshotId } : undefined)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage('Proof run restored from the selected snapshot.')
    })
  }

  const persistProofPlaybackSelection = useCallback((checkpointId: string | null) => {
    const simulationRunId = proofDashboard?.activeRunDetail?.simulationRunId
    if (!simulationRunId || !checkpointId) return
    writeProofPlaybackSelection({
      simulationRunId,
      simulationStageCheckpointId: checkpointId,
      updatedAt: new Date().toISOString(),
    })
  }, [proofDashboard?.activeRunDetail?.simulationRunId])

  const handleSelectProofCheckpoint = useCallback((checkpointId: string | null) => {
    setSelectedProofCheckpointId(checkpointId)
    persistProofPlaybackSelection(checkpointId)
  }, [persistProofPlaybackSelection])

  const handleStepProofPlayback = useCallback((direction: 'previous' | 'next' | 'start' | 'end') => {
    if (activeRunCheckpoints.length === 0) return
    if (direction === 'start') {
      const startIndex = firstAccessibleCheckpointIndex >= 0 ? firstAccessibleCheckpointIndex : 0
      const checkpointId = activeRunCheckpoints[startIndex]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointId(checkpointId)
      persistProofPlaybackSelection(checkpointId)
      return
    }
    if (direction === 'end') {
      const lastAccessibleIndex = firstBlockedCheckpointIndex >= 0 ? Math.max(0, firstBlockedCheckpointIndex - 1) : activeRunCheckpoints.length - 1
      const checkpointId = activeRunCheckpoints[lastAccessibleIndex]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointId(checkpointId)
      persistProofPlaybackSelection(checkpointId)
      return
    }
    const currentIndex = Math.max(0, activeRunCheckpoints.findIndex(item => item.simulationStageCheckpointId === selectedProofCheckpoint?.simulationStageCheckpointId))
    const nextIndex = direction === 'previous'
      ? Math.max(0, currentIndex - 1)
      : Math.min(activeRunCheckpoints.length - 1, currentIndex + 1)
    if (direction === 'next' && firstBlockedCheckpointIndex >= 0 && nextIndex >= firstBlockedCheckpointIndex) return
    const checkpointId = activeRunCheckpoints[nextIndex]?.simulationStageCheckpointId ?? null
    setSelectedProofCheckpointId(checkpointId)
    persistProofPlaybackSelection(checkpointId)
  }, [activeRunCheckpoints, firstBlockedCheckpointIndex, persistProofPlaybackSelection, selectedProofCheckpoint?.simulationStageCheckpointId])

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
        const rerun = await maybeAutoRefreshSelectedProofBatch(`${selectedStudent.name} enrollment refresh`)
        setFlashMessage(rerun.length > 0 ? 'Enrollment updated and proof batch refreshed.' : 'Enrollment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createEnrollment(selectedStudent.studentId, payload)
      const rerun = await maybeAutoRefreshSelectedProofBatch(`${selectedStudent.name} enrollment refresh`)
      setFlashMessage(rerun.length > 0 ? 'Enrollment created and proof batch refreshed.' : 'Enrollment created.')
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
    const offeringId = requireText('Class / offering', ownershipForm.offeringId)
    await runAction(async () => {
      await apiClient.createOfferingOwnership({
        offeringId,
        facultyId: selectedFacultyMember.facultyId,
        ownershipRole: 'owner',
        status: 'active',
      })
      setOwnershipForm({
        ownershipId: '',
        offeringId: '',
        facultyId: selectedFacultyMember.facultyId,
      })
      setFlashMessage('Class ownership added.')
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

  // --- Computed ---
  const facultyDepartments = listDepartmentsForAcademicFaculty(data, selectedAcademicFaculty?.academicFacultyId)
  const departmentBranches = listBranchesForDepartment(data, selectedDepartment?.departmentId)
  const branchBatches = listBatchesForBranch(data, selectedBranch?.branchId)
  const batchTerms = listTermsForBatch(data, selectedBatch?.batchId)
  const curriculumBySemester = listCurriculumBySemester(data, selectedBatch?.batchId)
  const selectedCurriculumSemesterEntry = curriculumBySemester.find(entry => String(entry.semesterNumber) === selectedCurriculumSemester) ?? null
  const selectedCurriculumSemesterCourses = selectedCurriculumSemesterEntry?.courses ?? []
  const selectedCurriculumCourse = selectedCurriculumSemesterCourses.find(course => course.curriculumCourseId === selectedCurriculumCourseId)
    ?? selectedCurriculumSemesterCourses[0]
    ?? null
  const curriculumFeatureItems = curriculumFeatureConfig?.items ?? []
  const selectedCurriculumFeatureItem = curriculumFeatureItems.find(item => item.curriculumCourseId === selectedCurriculumFeatureCourseId) ?? null
  const selectedFacultyAssignments = selectedFacultyMember ? listFacultyAssignments(data, selectedFacultyMember.facultyId) : []
  const activeBatchPolicyOverride = selectedBatch
    ? data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId && isVisibleAdminRecord(item.status)) ?? null
    : null

  useEffect(() => {
    if (curriculumBySemester.length === 0) {
      setSelectedCurriculumSemester('')
      setSelectedCurriculumCourseId('')
      return
    }
    const preferredSemester = selectedCurriculumSemester
      && curriculumBySemester.some(entry => String(entry.semesterNumber) === selectedCurriculumSemester)
      ? selectedCurriculumSemester
      : curriculumBySemester.find(entry => entry.semesterNumber === selectedBatch?.currentSemester)?.semesterNumber?.toString()
        ?? String(curriculumBySemester[0]!.semesterNumber)
    if (preferredSemester !== selectedCurriculumSemester) {
      setSelectedCurriculumSemester(preferredSemester)
      return
    }
    const semesterCourses = curriculumBySemester.find(entry => String(entry.semesterNumber) === preferredSemester)?.courses ?? []
    if (semesterCourses.length === 0) {
      if (selectedCurriculumCourseId) setSelectedCurriculumCourseId('')
      return
    }
    if (!semesterCourses.some(course => course.curriculumCourseId === selectedCurriculumCourseId)) {
      setSelectedCurriculumCourseId(semesterCourses[0]!.curriculumCourseId)
    }
  }, [curriculumBySemester, selectedBatch?.currentSemester, selectedCurriculumCourseId, selectedCurriculumSemester])
  const activeScopeChain = useMemo<ActiveAdminScope[]>(() => {
    const chain: ActiveAdminScope[] = []
    if (data.institution) {
      chain.push({
        scopeType: 'institution',
        scopeId: data.institution.institutionId,
        label: data.institution.name,
      })
    }
    if (selectedAcademicFaculty) {
      chain.push({
        scopeType: 'academic-faculty',
        scopeId: selectedAcademicFaculty.academicFacultyId,
        label: selectedAcademicFaculty.name,
      })
    }
    if (selectedDepartment) {
      chain.push({
        scopeType: 'department',
        scopeId: selectedDepartment.departmentId,
        label: selectedDepartment.name,
      })
    }
    if (selectedBranch) {
      chain.push({
        scopeType: 'branch',
        scopeId: selectedBranch.branchId,
        label: selectedBranch.name,
      })
    }
    if (selectedBatch) {
      chain.push({
        scopeType: 'batch',
        scopeId: selectedBatch.batchId,
        label: `Batch ${selectedBatch.batchLabel}`,
      })
    }
    return chain
  }, [data.institution, selectedAcademicFaculty, selectedBatch, selectedBranch, selectedDepartment])
  const activeGovernanceScope = activeScopeChain.at(-1) ?? null
  const scopePolicyOverrides = useMemo(() => (
    activeScopeChain.flatMap(scope => {
      const match = data.policyOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && isVisibleAdminRecord(item.status))
      return match ? [{ ...match, appliedAtScope: `${scope.scopeType}:${scope.scopeId}` }] : []
    })
  ), [activeScopeChain, data.policyOverrides])
  const scopeStageOverrides = useMemo(() => (
    activeScopeChain.flatMap(scope => {
      const match = stagePolicyOverrides.find(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId && isVisibleAdminRecord(item.status))
      return match ? [{ ...match, appliedAtScope: `${scope.scopeType}:${scope.scopeId}` }] : []
    })
  ), [activeScopeChain, stagePolicyOverrides])
  const effectiveScopePolicy = useMemo(() => {
    if (activeGovernanceScope?.scopeType === 'batch' && resolvedBatchPolicy?.batch.batchId === activeGovernanceScope.scopeId) {
      return resolvedBatchPolicy.effectivePolicy
    }
    return scopePolicyOverrides.reduce<ApiResolvedBatchPolicy['effectivePolicy']>(
      (policy, override) => mergePolicyPayload(policy, override.policy),
      buildValidatedPolicyPayload(defaultPolicyForm()),
    )
  }, [activeGovernanceScope?.scopeId, activeGovernanceScope?.scopeType, resolvedBatchPolicy, scopePolicyOverrides])
  const effectiveScopeStagePolicy = useMemo(() => {
    if (activeGovernanceScope?.scopeType === 'batch' && resolvedStagePolicy?.batch.batchId === activeGovernanceScope.scopeId) {
      return resolvedStagePolicy.effectivePolicy
    }
    return scopeStageOverrides.at(-1)?.policy ?? DEFAULT_STAGE_POLICY
  }, [activeGovernanceScope?.scopeId, activeGovernanceScope?.scopeType, resolvedStagePolicy, scopeStageOverrides])
  const activeScopePolicyOverride = activeGovernanceScope
    ? data.policyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const activeScopeStageOverride = activeGovernanceScope
    ? stagePolicyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const curriculumFeatureTargetScopeOptions = activeScopeChain
  const curriculumFeatureProfileOptions = curriculumFeatureConfig?.availableProfiles ?? []
  const governanceScopeSummary = activeGovernanceScope
    ? `${formatScopeTypeLabel(activeGovernanceScope.scopeType)} scope`
    : 'Institution scope'
  const policyOverrideTrail = scopePolicyOverrides.length
    ? scopePolicyOverrides.map(item => `${formatScopeTypeLabel(item.scopeType)} · ${activeScopeChain.find(scope => scope.scopeType === item.scopeType && scope.scopeId === item.scopeId)?.label ?? item.scopeType}`).join(' -> ')
    : 'Institution defaults only'
  const stageOverrideTrail = scopeStageOverrides.length
    ? scopeStageOverrides.map(item => `${formatScopeTypeLabel(item.scopeType)} · ${activeScopeChain.find(scope => scope.scopeType === item.scopeType && scope.scopeId === item.scopeId)?.label ?? item.scopeType}`).join(' -> ')
    : 'Institution defaults only'
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
      updatedAt: item.updatedAt ?? item.createdAt ?? '',
      onRestore: async () => {
        await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
      },
    })),
  ].sort((left, right) => compareAdminTimestampsDesc(left.updatedAt, right.updatedAt))
  const deletedItems = [
    ...data.academicFaculties.filter(item => item.status === 'deleted').map(item => ({ key: `academic-faculty:${item.academicFacultyId}`, label: item.name, meta: 'Academic faculty', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateAcademicFaculty(item.academicFacultyId, { code: item.code, name: item.name, overview: item.overview, status: 'active', version: item.version })
    } })),
    ...data.departments.filter(item => item.status === 'deleted').map(item => ({ key: `department:${item.departmentId}`, label: item.name, meta: 'Department', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateDepartment(item.departmentId, { academicFacultyId: item.academicFacultyId, code: item.code, name: item.name, status: 'active', version: item.version })
    } })),
    ...data.branches.filter(item => item.status === 'deleted').map(item => ({ key: `branch:${item.branchId}`, label: item.name, meta: 'Branch', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateBranch(item.branchId, { departmentId: item.departmentId, code: item.code, name: item.name, programLevel: item.programLevel, semesterCount: item.semesterCount, status: 'active', version: item.version })
    } })),
    ...data.batches.filter(item => item.status === 'deleted').map(item => ({ key: `batch:${item.batchId}`, label: item.batchLabel, meta: 'Year', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateBatch(item.batchId, { branchId: item.branchId, admissionYear: item.admissionYear, batchLabel: item.batchLabel, currentSemester: item.currentSemester, sectionLabels: item.sectionLabels, status: 'active', version: item.version })
    } })),
    ...data.students.filter(item => item.status === 'deleted').map(item => ({ key: `student:${item.studentId}`, label: item.name, meta: 'Student', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      const restored = await apiClient.updateStudent(item.studentId, { usn: item.usn, rollNumber: item.rollNumber, name: item.name, email: item.email, phone: item.phone, admissionDate: item.admissionDate, status: 'active', version: item.version })
      mergeStudentRecord(restored)
    } })),
    ...data.facultyMembers.filter(item => item.status === 'deleted').map(item => ({ key: `faculty:${item.facultyId}`, label: item.displayName, meta: 'Faculty member', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateFaculty(item.facultyId, { username: item.username, email: item.email, phone: item.phone, employeeCode: item.employeeCode, displayName: item.displayName, designation: item.designation, joinedOn: item.joinedOn, status: 'active', version: item.version })
    } })),
    ...data.courses.filter(item => item.status === 'deleted').map(item => ({ key: `course:${item.courseId}`, label: item.title, meta: 'Course', updatedAt: item.updatedAt ?? item.createdAt ?? '', onRestore: async () => {
      await apiClient.updateCourse(item.courseId, { courseCode: item.courseCode, title: item.title, defaultCredits: item.defaultCredits, departmentId: item.departmentId, status: 'active', version: item.version })
    } })),
  ].sort((left, right) => compareAdminTimestampsDesc(left.updatedAt, right.updatedAt))
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
        facultyMembers: data.facultyMembers.filter(item => isFacultyMemberVisible(data, item) && item.appointments.some(appointment => appointment.status !== 'deleted' && resolveDepartment(data, appointment.departmentId)?.academicFacultyId === selectedAcademicFaculty.academicFacultyId)).length,
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
  const scopedUniversityStudents = activeUniversityScope ? filteredUniversityStudents : []
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
  const normalizedActiveUniversityRegistryScope = normalizeHierarchyScope(activeUniversityRegistryScope)
  const normalizedRegistryScope = normalizeHierarchyScope(registryScope)
  const overviewHierarchyScope = hasHierarchyScopeSelection(normalizedActiveUniversityRegistryScope)
    ? normalizedActiveUniversityRegistryScope
    : hasHierarchyScopeSelection(normalizedRegistryScope)
      ? normalizedRegistryScope
      : null
  const overviewScopeLabel = describeRegistryScope(data, overviewHierarchyScope)
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
    {
      id: 'stage' as const,
      label: 'Stage Gates',
      icon: <Clock3 size={13} />,
      description: 'Configure inherited stage gates and advance individual classes only when evidence is complete.',
    },
    ...(selectedBranch ? [{
      id: 'courses' as const,
      label: 'Courses',
      icon: <BookOpen size={13} />,
      description: 'Semester-wise curriculum rows, credits, and scoped course leader assignments.',
    }] : []),
    ...(selectedBatch ? [{
      id: 'provision' as const,
      label: 'Provision',
      icon: <Plus size={13} />,
      description: 'Seed sections, students, ownerships, mentor links, timetables, and assessment scaffolding for live verification.',
    }] : []),
  ] satisfies Array<{ id: UniversityTab; label: string; icon: ReactNode; description: string }>
  const activeUniversityTab = universityTabOptions.find(item => item.id === universityTab) ?? universityTabOptions[0]
  const universityWorkspaceLabel = activeGovernanceScope && universityTab !== 'overview'
    ? `${universityContextLabel} · ${activeUniversityTab.label}`
    : universityContextLabel
  const universityWorkspaceTabCards = activeGovernanceScope
    ? universityTabOptions.filter(item => item.id !== 'overview')
    : []
  const showInlineActionQueue = showActionQueue && viewportWidth >= 1480
  const registryIsSingleColumn = viewportWidth < 1180
  const registryPageColumns = viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(320px, 420px) minmax(0, 1fr)'
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
  const effectiveStudentRegistryFilter = studentRegistryFilter
  const effectiveFacultyRegistryFilter = facultyRegistryFilter
  const studentRegistryScopeLabel = describeRegistryScope(data, studentRegistryScope)
  const facultyRegistryScopeLabel = describeRegistryScope(data, facultyRegistryScope)
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
  const visibleFacultyMembers = data.facultyMembers.filter(item => isFacultyMemberVisible(data, item))
  const visibleOfferings = [...data.offerings]
    .filter(item => isOfferingVisible(data, item))
    .sort((left, right) => `${left.code}-${left.year}-${left.section}`.localeCompare(`${right.code}-${right.year}-${right.section}`))
  const batchTermIds = new Set(batchTerms.map(item => item.termId))
  const currentSemesterTerm = selectedBatch
    ? batchTerms.find(item => item.semesterNumber === selectedBatch.currentSemester && isVisibleAdminRecord(item.status)) ?? batchTerms[0] ?? null
    : null
  const batchOfferings = selectedBatch
    ? visibleOfferings
        .filter(item => item.termId ? batchTermIds.has(item.termId) : false)
        .filter(item => !selectedSectionCode || item.section === selectedSectionCode)
    : []
  const visibleOfferingById = new Map(visibleOfferings.map(item => [item.offId, item]))
  const activeVisibleOwnerships = data.ownerships.filter(item => item.status === 'active' && isFacultyMemberVisible(data, item.facultyId) && visibleOfferingById.has(item.offeringId))
  const batchScopeForProvisioning = selectedBatch
    ? {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        departmentId: selectedDepartment?.departmentId ?? null,
        branchId: selectedBranch?.branchId ?? null,
        batchId: selectedBatch.batchId,
        sectionCode: null,
      }
    : null
  const batchFacultyPool = batchScopeForProvisioning
    ? visibleFacultyMembers.filter(item => matchesFacultyScope(item, data, batchScopeForProvisioning))
    : []
  const batchStudents = selectedBatch
    ? data.students
        .filter(item => isStudentVisible(data, item))
        .filter(item => item.activeAcademicContext?.batchId === selectedBatch.batchId)
        .filter(item => !selectedSectionCode || item.activeAcademicContext?.sectionCode === selectedSectionCode)
    : []
  const batchOfferingsWithoutOwner = batchOfferings.filter(offering => !activeVisibleOwnerships.some(ownership => ownership.offeringId === offering.offId))
  const batchStudentsWithoutEnrollment = batchStudents.filter(student => !findLatestEnrollment(student))
  const batchStudentsWithoutMentor = batchStudents.filter(student => !student.activeMentorAssignment)
  const batchOfferingsWithoutRoster = batchOfferings.filter(offering => !batchStudents.some(student => (
    student.activeAcademicContext?.termId === offering.termId
    && student.activeAcademicContext?.sectionCode === offering.section
  )))
  const selectedStageOffering = batchOfferings.find(item => item.offId === selectedStageOfferingId) ?? batchOfferings[0] ?? null
  const selectedCurriculumFeatureTargetScope = curriculumFeatureTargetScopeKey
    ? curriculumFeatureTargetScopeOptions.find(scope => `${scope.scopeType}::${scope.scopeId}` === curriculumFeatureTargetScopeKey) ?? null
    : null
  const curriculumFeatureAffectedBatchPreview = selectedCurriculumFeatureTargetScope
    ? visibleBatches.filter(batch => matchesBatchScope(batch, data, selectedCurriculumFeatureTargetScope.scopeType, selectedCurriculumFeatureTargetScope.scopeId))
    : []
  const overviewScopedStudents = overviewHierarchyScope
    ? data.students
        .filter(item => isStudentVisible(data, item))
        .filter(item => matchesStudentScope(item, data, overviewHierarchyScope))
    : []
  const overviewScopedFaculty = overviewHierarchyScope
    ? visibleFacultyMembers.filter(item => matchesFacultyScope(item, data, overviewHierarchyScope))
    : []
  const overviewScopedOwnerships = overviewHierarchyScope
    ? activeVisibleOwnerships.filter(item => {
        const offering = visibleOfferingById.get(item.offeringId)
        return offering ? matchesOfferingScope(offering, data, overviewHierarchyScope) : false
      })
    : []
  const overviewVisibleStudentCount = overviewScopedStudents.length
  const overviewVisibleMentoredCount = overviewScopedStudents.filter(item => item.activeMentorAssignment).length
  const overviewVisibleMentorGapCount = overviewScopedStudents.filter(item => !item.activeMentorAssignment).length
  const overviewVisibleFacultyCount = overviewScopedFaculty.length
  const overviewVisibleOwnershipCount = overviewScopedOwnerships.length
  const normalizedStudentRegistrySearch = studentRegistrySearch.trim().toLowerCase()
  const normalizedFacultyRegistrySearch = facultyRegistrySearch.trim().toLowerCase()
  const studentRegistryItems = studentRegistryHasScope
    ? data.students
        .filter(item => isStudentVisible(data, item))
        .filter(item => matchesStudentScope(item, data, studentRegistryScope))
        .filter(item => {
          if (!normalizedStudentRegistrySearch) return true
          const searchableText = [
            item.name,
            item.usn,
            item.rollNumber ?? '',
            item.email ?? '',
            item.phone ?? '',
            item.activeAcademicContext?.departmentName ?? '',
            item.activeAcademicContext?.branchName ?? '',
            item.activeAcademicContext?.batchLabel ?? '',
            item.activeAcademicContext?.sectionCode ?? '',
          ].join(' ').toLowerCase()
          return searchableText.includes(normalizedStudentRegistrySearch)
        })
        .sort((left, right) => {
          const leftKey = `${left.activeAcademicContext?.departmentName ?? ''}-${left.activeAcademicContext?.branchName ?? ''}-${left.name}-${left.usn}`
          const rightKey = `${right.activeAcademicContext?.departmentName ?? ''}-${right.activeAcademicContext?.branchName ?? ''}-${right.name}-${right.usn}`
          return leftKey.localeCompare(rightKey)
        })
    : []
  const facultyRegistryItems = data.facultyMembers
    .filter(item => isFacultyMemberVisible(data, item))
    .filter(item => matchesFacultyScope(item, data, {
      academicFacultyId: effectiveFacultyRegistryFilter.academicFacultyId || null,
      departmentId: effectiveFacultyRegistryFilter.departmentId || null,
      branchId: effectiveFacultyRegistryFilter.branchId || null,
      batchId: effectiveFacultyRegistryFilter.batchId || null,
      sectionCode: effectiveFacultyRegistryFilter.sectionCode || null,
    }))
    .filter(item => {
      if (!normalizedFacultyRegistrySearch) return true
      const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(item))?.name ?? ''
      const searchableText = [
        item.displayName,
        item.employeeCode,
        item.username,
        item.email,
        item.phone ?? '',
        item.designation,
        primaryDepartment,
        ...item.roleGrants.map(grant => grant.roleCode),
      ].join(' ').toLowerCase()
      return searchableText.includes(normalizedFacultyRegistrySearch)
    })
    .sort((left, right) => {
      const leftDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(left))?.name ?? ''
      const rightDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(right))?.name ?? ''
      return `${leftDepartment}-${left.displayName}-${left.employeeCode}`.localeCompare(`${rightDepartment}-${right.displayName}-${right.employeeCode}`)
    })
  const studentRegistryCaption = studentRegistryHasScope
    ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Filtered to ${studentRegistryScopeLabel ?? 'the selected academic scope'}.`
    : 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Select a faculty, department, branch, year, or section to load the student registry.'
  const studentRegistryEmptyMessage = studentRegistryHasScope
    ? 'No students match the current academic scope.'
    : 'Select a faculty, department, branch, year, or section to load students. Unscoped student registry stays empty by design.'
  const termsForEnrollment = visibleTerms.filter(item => !enrollmentForm.branchId || item.branchId === enrollmentForm.branchId)
  const branchesForAppointment = visibleBranches.filter(item => !appointmentForm.departmentId || item.departmentId === appointmentForm.departmentId)
  const selectedFacultyOwnerships = selectedFacultyMember
    ? activeVisibleOwnerships.filter(item => item.facultyId === selectedFacultyMember.facultyId)
    : []
  const activeOfferingOwnerById = new Map(
    activeVisibleOwnerships
      .map(item => [item.offeringId, item]),
  )
  const availableOwnershipOfferings = selectedFacultyMember
    ? visibleOfferings.filter(item => !activeOfferingOwnerById.has(item.offId))
    : []
  const selectedFacultyCalendarOfferings = selectedFacultyAssignments.flatMap(item => item.offering ? [item.offering] : [])
  const sortedFacultyCalendarMarkers = [...(facultyCalendar?.workspace.markers ?? [])]
    .sort((left, right) => {
      if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
      return (left.startMinutes ?? -1) - (right.startMinutes ?? -1)
    })
  const facultyCalendarRecurringBlocks = facultyCalendar?.template?.classBlocks.filter(item => !item.dateISO) ?? []
  const facultyCalendarExtraBlocks = facultyCalendar?.template?.classBlocks.filter(item => !!item.dateISO) ?? []

  useEffect(() => {
    if (!activeGovernanceScope) return
    setPolicyForm(hydratePolicyForm(effectiveScopePolicy))
  }, [
    activeGovernanceScope?.scopeId,
    activeGovernanceScope?.scopeType,
    activeScopePolicyOverride?.policyOverrideId,
    activeScopePolicyOverride?.version,
    effectiveScopePolicy,
  ])

  useEffect(() => {
    if (!activeGovernanceScope) {
      setStagePolicyForm(defaultStagePolicyForm())
      return
    }
    setStagePolicyForm(hydrateStagePolicyForm(effectiveScopeStagePolicy))
  }, [
    activeGovernanceScope?.scopeId,
    activeGovernanceScope?.scopeType,
    activeScopeStageOverride?.stagePolicyOverrideId,
    activeScopeStageOverride?.version,
    effectiveScopeStagePolicy,
  ])

  useEffect(() => {
    setBatchProvisioningForm(prev => ({
      ...prev,
      termId: currentSemesterTerm?.termId ?? prev.termId,
      sectionLabels: selectedBatch?.sectionLabels.join(', ') ?? prev.sectionLabels,
    }))
  }, [currentSemesterTerm?.termId, selectedBatch?.batchId, selectedBatch?.sectionLabels])

  useEffect(() => {
    const availableKeys = new Set(curriculumFeatureTargetScopeOptions.map(scope => `${scope.scopeType}::${scope.scopeId}`))
    if (availableKeys.size === 0) {
      setCurriculumFeatureTargetScopeKey('')
      return
    }
    setCurriculumFeatureTargetScopeKey(current => {
      if (current && availableKeys.has(current)) return current
      const preferred = selectedBranch
        ? `branch::${selectedBranch.branchId}`
        : activeGovernanceScope
          ? `${activeGovernanceScope.scopeType}::${activeGovernanceScope.scopeId}`
          : null
      return preferred && availableKeys.has(preferred) ? preferred : Array.from(availableKeys)[0]!
    })
  }, [activeGovernanceScope, curriculumFeatureTargetScopeOptions, selectedBranch])

  useEffect(() => {
    if (!selectedStageOffering) {
      setSelectedStageOfferingId('')
      setSelectedStageEligibility(null)
      return
    }
    if (selectedStageOffering.offId !== selectedStageOfferingId) {
      setSelectedStageOfferingId(selectedStageOffering.offId)
    }
  }, [selectedStageOffering, selectedStageOfferingId])

  useEffect(() => {
    if (!selectedStageOfferingId || !selectedBatch) {
      setSelectedStageEligibility(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getOfferingStageEligibility(selectedStageOfferingId)
        if (!cancelled) setSelectedStageEligibility(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedBatch, selectedStageOfferingId])
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
    if (activeUniversityRegistryScope) {
      setRegistryScope(activeUniversityRegistryScope)
      if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
      else setFacultyRegistryFilter(hydrateRegistryFilter(activeUniversityRegistryScope))
    } else if (section === 'students') {
      clearRegistryScope()
      setStudentRegistryFilter(defaultRegistryFilter())
    } else {
      clearRegistryScope()
      setFacultyRegistryFilter(defaultRegistryFilter())
    }
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
  const adminContextLabel = route.section === 'faculties'
    ? `University · ${universityWorkspaceLabel}`
    : route.section === 'students'
      ? 'Student Registry'
      : route.section === 'faculty-members'
        ? 'Faculty Registry'
        : route.section === 'requests'
          ? 'Governed Requests'
          : route.section === 'history'
            ? 'History And Restore'
            : 'Operations Dashboard'
  const railScopeLabel = route.section === 'faculties'
    ? activeUniversityRegistryScope?.label ?? universityWorkspaceLabel
    : route.section === 'students'
      ? studentRegistryScopeLabel ?? undefined
      : route.section === 'faculty-members'
        ? facultyRegistryScopeLabel ?? registryScope?.label ?? undefined
        : registryScope?.label
  const railSearchPlaceholder = route.section === 'overview'
    ? 'Search across the full control plane...'
    : route.section === 'faculties'
      ? 'Search within the active university scope...'
      : route.section === 'students'
        ? 'Search students in the active scope...'
        : route.section === 'faculty-members'
          ? 'Search faculty in the active scope...'
          : route.section === 'requests'
            ? 'Search governed requests...'
            : 'Search admin history...'
  const railSearchResults = searchResults.map(result => ({
    key: result.key,
    title: result.label,
    subtitle: result.meta,
    onSelect: () => {
      const scopedRegistryTarget = result.route.section === 'students' || result.route.section === 'faculty-members'
      if (scopedRegistryTarget) {
        const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
        if (nextScope) {
          setRegistryScope(nextScope)
          if (result.route.section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(nextScope))
          if (result.route.section === 'faculty-members') setFacultyRegistryFilter(hydrateRegistryFilter(nextScope))
        }
      }
      setSearchQuery('')
      navigate(result.route)
    },
  }))
  const handleRailSectionChange = (section: LiveAdminSectionId) => {
    if (section === route.section) return
    if (section === 'students' || section === 'faculty-members') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      if (nextScope) {
        setRegistryScope(nextScope)
        if (section === 'students') setStudentRegistryFilter(hydrateRegistryFilter(nextScope))
        else setFacultyRegistryFilter(hydrateRegistryFilter(nextScope))
      } else if (route.section === 'faculties') {
        clearRegistryScope()
        if (section === 'students') setStudentRegistryFilter(defaultRegistryFilter())
        else setFacultyRegistryFilter(defaultRegistryFilter())
      }
      navigate({ section })
      return
    }
    if (section === 'faculties') {
      const nextScope = route.section === 'faculties' ? activeUniversityRegistryScope : registryScope
      navigate({
        section: 'faculties',
        academicFacultyId: nextScope?.academicFacultyId ?? undefined,
        departmentId: nextScope?.departmentId ?? undefined,
        branchId: nextScope?.branchId ?? undefined,
        batchId: nextScope?.batchId ?? undefined,
      })
      return
    }
    navigate({ section })
  }
  const canNavigateBack = routeHistory.length > 0

  // --- Main workspace ---
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

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
      <TeachingShellAdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        adminName={session.faculty?.displayName ?? session.user.username}
        contextLabel={adminContextLabel}
        now={now}
        themeMode={themeMode}
        actionCount={actionQueueCount}
        canNavigateBack={canNavigateBack}
        onNavigateBack={handleNavigateBack}
        onToggleTheme={() => persistTheme(themeMode === 'frosted-focus-light' ? 'frosted-focus-dark' : 'frosted-focus-light')}
        onGoHome={handleGoHome}
        onToggleQueue={() => setShowActionQueue(current => !current)}
        onRefresh={() => { void loadAdminData() }}
        onLogout={handleLogout}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 84px)', alignItems: 'stretch' }}>
      {sidebarCollapsed ? (
        <motion.button
          type="button"
          aria-label="Expand operations rail"
          title="Expand operations rail"
          onClick={() => setSidebarCollapsed(false)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: 18,
            bottom: 18,
            zIndex: 32,
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
      ) : null}
      <OperationsRail
        collapsed={sidebarCollapsed}
        contextLabel={adminContextLabel}
        scopeLabel={railScopeLabel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={railSearchPlaceholder}
        searchResults={railSearchResults}
        activeSection={route.section as LiveAdminSectionId}
        onSectionChange={handleRailSectionChange}
        breadcrumbs={topBarBreadcrumbs}
        onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: showInlineActionQueue ? 'minmax(0,1fr) 320px' : 'minmax(0,1fr)', gap: 0, alignItems: 'start' }}>
      <motion.div
        key={`${routeToHash(route)}::${universityTab}::${selectedSectionCode ?? ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ minWidth: 0 }}
      >
      <PageShell size="wide" style={{ display: 'grid', gap: 18, paddingTop: 22, paddingBottom: 34, maxWidth: '100%', paddingLeft: viewportWidth < 720 ? 14 : 22, paddingRight: viewportWidth < 720 ? 14 : 22 }}>
        {flashMessage ? <InfoBanner tone="success" message={flashMessage} /> : null}
        {actionError ? <InfoBanner tone="error" message={actionError} /> : null}
        {dataError ? <InfoBanner tone="error" message={dataError} /> : null}

        {/* ========== OVERVIEW ========== */}
        {route.section === 'overview' && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: viewportWidth > 1180 ? 'minmax(0, 1.6fr) minmax(280px, 0.95fr)' : 'minmax(0, 1fr)' }}>
              <Card style={{ padding: 24, display: 'grid', gap: 16, textAlign: 'left', background: `radial-gradient(circle at top left, ${T.accent}14, transparent 34%), linear-gradient(180deg, ${T.surface}, ${T.surface2})` }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ ...mono, fontSize: 10, color: ADMIN_SECTION_TONES.overview, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Sysadmin Control Plane</div>
                  <div style={{ ...sora, fontSize: 30, fontWeight: 800, color: T.text }}>Operations Dashboard</div>
                  <div style={{ ...mono, fontSize: 11, color: T.muted, lineHeight: 1.9, maxWidth: 760 }}>
                    University setup, registry cleanup, faculty ownership, and governed requests begin from the rail on the left. This overview now works like an operations launch surface instead of a centered report card.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <HeroBadge color={T.accent}><Bell size={12} /> Action Queue {actionQueueCount}</HeroBadge>
                  <HeroBadge color={T.warning}><Clock3 size={12} /> Open Requests {openRequests.length}</HeroBadge>
                  <HeroBadge color={T.danger}><RefreshCw size={12} /> Hidden Records {hiddenItemCount}</HeroBadge>
                  <HeroBadge color={remindersSupported ? T.success : T.orange}><CheckCircle2 size={12} /> {remindersSupported ? `Private Reminders ${pendingReminders.length}` : 'Reminder API offline on this backend'}</HeroBadge>
                </div>
                <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <SectionLaunchCard
                    title="University"
                    caption={`${visibleAcademicFaculties.length} faculties · ${visibleDepartments.length} departments · ${visibleBranches.length} branches`}
                    helper="Selector-driven hierarchy control for faculty, department, branch, year, section, policy bands, and course tables."
                    icon={<LayoutDashboard size={18} />}
                    tone={ADMIN_SECTION_TONES.faculties}
                    active={false}
                    onClick={() => navigate({ section: 'faculties' })}
                  />
                  <SectionLaunchCard
                    title="Students"
                    caption={overviewHierarchyScope
                      ? `${overviewVisibleStudentCount} records · ${overviewVisibleMentoredCount} mentored`
                      : '0 records · scope required'}
                    helper={overviewHierarchyScope
                      ? `Canonical student identity, mentor linkage, and semester progression filtered to ${overviewScopeLabel ?? 'the active academic scope'}.`
                      : 'Select a faculty, department, branch, year, or section in the university workspace before student totals appear here.'}
                    icon={<GraduationCap size={18} />}
                    tone={ADMIN_SECTION_TONES.students}
                    active={false}
                    onClick={() => navigate({ section: 'students' })}
                  />
                  <SectionLaunchCard
                    title="Faculty"
                    caption={overviewHierarchyScope
                      ? `${overviewVisibleFacultyCount} profiles · ${overviewVisibleOwnershipCount} active class owners`
                      : '0 profiles · scope required'}
                    helper={overviewHierarchyScope
                      ? `Appointments, permissions, class ownership, and timetable review filtered to ${overviewScopeLabel ?? 'the active academic scope'}.`
                      : 'Select an academic scope first so faculty ownership and load totals only reflect the active slice of the institution.'}
                    icon={<UserCog size={18} />}
                    tone={ADMIN_SECTION_TONES['faculty-members']}
                    active={false}
                    onClick={() => navigate({ section: 'faculty-members' })}
                  />
                </div>
              </Card>

              <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
                <OverviewSupportCard title="Requests" value={String(openRequests.length)} helper="Governed items waiting in the action rail." tone={T.warning} onClick={() => navigate({ section: 'requests' })} />
                <OverviewSupportCard title="Hidden Records" value={String(hiddenItemCount)} helper="Archived or deleted records with restore visibility." tone={T.danger} onClick={() => navigate({ section: 'history' })} />
                <OverviewSupportCard
                  title="Mentor Gaps"
                  value={String(overviewVisibleMentorGapCount)}
                  helper={overviewHierarchyScope
                    ? `Students still missing an active mentor linkage inside ${overviewScopeLabel ?? 'the active academic scope'}.`
                    : 'No hierarchy scope selected yet. Mentor-gap totals stay empty until you select a faculty, department, branch, year, or section.'}
                  tone={ADMIN_SECTION_TONES.students}
                  onClick={() => navigate({ section: 'students' })}
                />
                <OverviewSupportCard
                  title="Teaching Load"
                  value={String(overviewVisibleOwnershipCount)}
                  helper={overviewHierarchyScope
                    ? `Active teaching ownership records mapped to faculty inside ${overviewScopeLabel ?? 'the active academic scope'}.`
                    : 'No hierarchy scope selected yet. Teaching-load totals stay empty until you choose the academic slice you want to inspect.'}
                  tone={ADMIN_SECTION_TONES['faculty-members']}
                  onClick={() => navigate({ section: 'faculty-members' })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
                <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Immediate Watchlist</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>What needs eyes first</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  {openRequests.length > 0
                    ? `${openRequests[0].summary} is currently the highest-visibility governed request.`
                    : 'No governed requests are waiting right now.'}
                </div>
              </Card>
              <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 10 }}>
                <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scoped Navigation</div>
                <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>Rail state carries forward</div>
                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                  Deep faculty, student, and faculty-member searches now respect the active hierarchy scope so you can move across panels without rebuilding context.
                </div>
              </Card>
            </div>
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
            <Card style={{ padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
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
            <div ref={universityWorkspacePaneRef} style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
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

                  <Card data-proof-surface="system-admin-proof-control-plane" style={{ padding: 14, background: T.surface2, display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Proof Control Plane</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                          Curriculum import, crosswalk review, active run control, monitoring state, and snapshot restore all run from the backend proof shell now.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn size="sm" dataProofAction="proof-create-import" onClick={handleCreateProofImport}>Create Import</Btn>
                        <Btn size="sm" variant="ghost" dataProofAction="proof-validate-import" onClick={handleValidateLatestProofImport} disabled={!proofDashboard?.imports.length}>Validate Import</Btn>
                        <Btn size="sm" variant="ghost" dataProofAction="proof-review-crosswalks" onClick={handleReviewPendingCrosswalks} disabled={!proofDashboard?.crosswalkReviewQueue.length}>Review Mappings</Btn>
                        <Btn size="sm" variant="ghost" dataProofAction="proof-approve-import" onClick={handleApproveLatestProofImport} disabled={!proofDashboard?.imports.length}>Approve Import</Btn>
                        <Btn size="sm" dataProofAction="proof-run-rerun" onClick={handleCreateProofRun} disabled={!proofDashboard?.imports.length}>Run / Rerun</Btn>
                        <Btn size="sm" variant="ghost" dataProofAction="proof-recompute-risk" onClick={handleRecomputeProofRunRisk} disabled={!proofDashboard?.activeRunDetail}>Recompute Risk</Btn>
                      </div>
                    </div>

                    {proofDashboardLoading ? <InfoBanner message="Loading proof control-plane data..." /> : null}

                    {proofDashboard?.activeRunDetail ? (
                      <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                          <Card style={{ padding: 12, background: T.surface }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>Active Run</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>{proofDashboard.activeRunDetail.runLabel}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>Seed {proofDashboard.activeRunDetail.seed} · {proofDashboard.activeRunDetail.status}</div>
                            {proofDashboard.activeRunDetail.progress ? (
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                                {String(proofDashboard.activeRunDetail.progress.phase ?? 'running')} · {String(proofDashboard.activeRunDetail.progress.percent ?? 0)}%
                              </div>
                            ) : null}
                            {proofDashboard.activeRunDetail.failureMessage ? (
                              <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 6, lineHeight: 1.6 }}>
                                {proofDashboard.activeRunDetail.failureMessage}
                              </div>
                            ) : null}
                          </Card>
                        <Card style={{ padding: 12, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Monitoring</div>
                          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                            {proofDashboard.activeRunDetail.monitoringSummary.riskAssessmentCount} watch scores · {proofDashboard.activeRunDetail.monitoringSummary.activeReassessmentCount} open reassessments
                          </div>
                        </Card>
                        <Card style={{ padding: 12, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Alerts</div>
                          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                            {proofDashboard.activeRunDetail.monitoringSummary.alertDecisionCount} decisions · {proofDashboard.activeRunDetail.monitoringSummary.acknowledgementCount} acknowledgements
                          </div>
                        </Card>
                        <Card style={{ padding: 12, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Snapshots</div>
                          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>{proofDashboard.activeRunDetail.snapshots.length} saved</div>
                        </Card>
                        <Card style={{ padding: 12, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 10, color: T.dim }}>Stage 2 Coverage</div>
                          <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                            {proofDashboard.activeRunDetail.coverageDiagnostics.behaviorProfileCoverage.count}/{proofDashboard.activeRunDetail.coverageDiagnostics.behaviorProfileCoverage.expected} profiles · {proofDashboard.activeRunDetail.coverageDiagnostics.questionResultCoverage.count} question results
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                            Topic {proofDashboard.activeRunDetail.coverageDiagnostics.topicStateCoverage.count} · CO {proofDashboard.activeRunDetail.coverageDiagnostics.coStateCoverage.count} · response {proofDashboard.activeRunDetail.coverageDiagnostics.interventionResponseCoverage.count}
                          </div>
                        </Card>
                          <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                            <div>
                              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Model</div>
                              <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                                {activeProductionDiagnostics
                                  ? `${activeProductionDiagnostics.artifactVersion} · ${proofDashboard.activeRunDetail.modelDiagnostics.activeRunFeatureRowCount} active rows`
                                  : 'Heuristic fallback only'}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                                {activeProductionDiagnostics
                                  ? `${proofDashboard.activeRunDetail.modelDiagnostics.sourceRunCount} run corpus · ${proofDashboard.activeRunDetail.modelDiagnostics.featureRowCount} checkpoint rows`
                                  : 'No active local artifact has been trained for this batch yet.'}
                              </div>
                            </div>

                            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'grid', gap: 6 }}>
                              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Corpus + Split</div>
                              <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>
                                Manifest {activeDiagnosticsTrainingManifestVersion ?? 'unknown'}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                Splits: {formatSplitSummary(activeDiagnosticsSplitSummary)}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                Worlds: {formatSplitSummary(activeDiagnosticsWorldSplitSummary)}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                Scenario families: {formatKeyedCounts(activeModelDiagnostics?.scenarioFamilySummary ?? activeDiagnosticsScenarioFamilies)}
                              </div>
                              {activeDiagnosticsHeadSupportSummary ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Head support: {formatHeadSupportSummary(activeDiagnosticsHeadSupportSummary)}
                                </div>
                              ) : null}
                              {activeDiagnosticsGovernedRunCount != null || activeDiagnosticsSkippedRunCount != null ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Governed runs: {activeDiagnosticsGovernedRunCount ?? 'unknown'} · skipped runs: {activeDiagnosticsSkippedRunCount ?? 0}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'grid', gap: 6 }}>
                              <div style={{ ...mono, fontSize: 10, color: T.dim }}>Calibration + Policy</div>
                              <div style={{ ...mono, fontSize: 11, color: T.text, lineHeight: 1.6 }}>
                                Calibration {activeDiagnosticsCalibrationVersion ?? 'unknown'}
                              </div>
                              {activeDiagnosticsDisplayProbabilityAllowed != null ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Probability display: {activeDiagnosticsDisplayProbabilityAllowed ? 'allowed' : 'band only'}
                                </div>
                              ) : null}
                              {activeDiagnosticsSupportWarning ? (
                                <div style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.6 }}>
                                  Support: {activeDiagnosticsSupportWarning}
                                </div>
                              ) : null}
                              <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                {activeProductionDiagnostics?.evaluation && typeof activeProductionDiagnostics.evaluation === 'object'
                                  ? `Evaluation keys: ${Object.keys(activeProductionDiagnostics.evaluation).slice(0, 5).join(' · ') || 'none'}`
                                  : 'No evaluation payload is available.'}
                              </div>
                              {activeDiagnosticsPolicyDiagnostics ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Governed policy: {formatDiagnosticSummary(activeDiagnosticsPolicyDiagnostics)}
                                </div>
                              ) : null}
                              {activeDiagnosticsCoEvidence ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Governed CO evidence: {formatDiagnosticSummary(activeDiagnosticsCoEvidence)}
                                </div>
                              ) : null}
                              {activeDiagnosticsPolicyAcceptance ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Policy gates: {formatDiagnosticSummary(activeDiagnosticsPolicyAcceptance)}
                                </div>
                              ) : null}
                              {activeDiagnosticsOverallCourseRuntime ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Overall-course runtime: {formatDiagnosticSummary(activeDiagnosticsOverallCourseRuntime)}
                                </div>
                              ) : null}
                              {activeDiagnosticsQueueBurden ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Queue burden: {formatDiagnosticSummary(activeDiagnosticsQueueBurden)}
                                </div>
                              ) : null}
                              {activeDiagnosticsUiParity ? (
                                <div style={{ ...mono, fontSize: 10, color: T.dim, lineHeight: 1.6 }}>
                                  Active-run parity: {formatDiagnosticSummary(activeDiagnosticsUiParity)}
                                </div>
                              ) : null}
                              {activeProductionDiagnostics?.correlations ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
                                  Correlations: {Object.keys(activeProductionDiagnostics.correlations).slice(0, 5).join(' · ') || 'none'}
                                </div>
                              ) : null}
                            </div>
                          </Card>
                      </div>

                        {selectedProofCheckpoint ? (
                          <Card data-proof-section="checkpoint-playback" style={{ padding: 12, background: T.surface, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Checkpoint Playback</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                              Read-only playback overlay for the active proof run. The run itself does not mutate while stepping through stage checkpoints.
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="proof-playback-reset"
                              onClick={() => handleStepProofPlayback('start')}
                              disabled={activeRunCheckpoints.length === 0 || selectedProofCheckpoint.simulationStageCheckpointId === activeRunCheckpoints[0]?.simulationStageCheckpointId}
                            >
                              Reset To Start
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="proof-playback-previous"
                              onClick={() => handleStepProofPlayback('previous')}
                              disabled={!selectedProofCheckpoint.previousCheckpointId}
                            >
                              Previous
                            </Btn>
                            <Btn
                              size="sm"
                              variant="ghost"
                              dataProofAction="proof-playback-next"
                              onClick={() => handleStepProofPlayback('next')}
                              disabled={!selectedProofCheckpointCanStepForward || !selectedProofCheckpoint.nextCheckpointId}
                            >
                              Next
                            </Btn>
                            <Btn
                              size="sm"
                              dataProofAction="proof-playback-end"
                              onClick={() => handleStepProofPlayback('end')}
                              disabled={!selectedProofCheckpointCanPlayToEnd}
                            >
                              Play To End
                            </Btn>
                          </div>
                        </div>

                        <div data-proof-section="selected-checkpoint-banner">
                          <InfoBanner
                            tone={selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'error' : 'neutral'}
                            message={`Selected checkpoint: semester ${selectedProofCheckpoint.semesterNumber} · ${selectedProofCheckpoint.stageLabel} · ${selectedProofCheckpoint.stageDescription}. ${selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'Playback progression is blocked until all queue items at this checkpoint are resolved.' : 'This stage is synced into the academic playback overlay for teaching surfaces.'}`}
                          />
                        </div>

                        <div data-proof-section="checkpoint-buttons" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {activeRunCheckpoints.map(item => (
                            <Btn
                              key={item.simulationStageCheckpointId}
                              size="sm"
                              dataProofAction="proof-select-checkpoint"
                              dataProofEntityId={item.simulationStageCheckpointId}
                              variant={item.simulationStageCheckpointId === selectedProofCheckpoint.simulationStageCheckpointId ? 'primary' : 'ghost'}
                              onClick={() => handleSelectProofCheckpoint(item.simulationStageCheckpointId)}
                            >
                              {`S${item.semesterNumber} · ${item.stageLabel}${item.playbackAccessible === false ? ' · blocked' : ''}`}
                            </Btn>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                          <Card style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>Risk Snapshot</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                              {selectedProofCheckpoint.highRiskCount ?? 0} high · {selectedProofCheckpoint.mediumRiskCount ?? 0} medium · {selectedProofCheckpoint.lowRiskCount ?? 0} low
                            </div>
                          </Card>
                          <Card style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue State</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                              {selectedProofCheckpoint.openQueueCount ?? 0} open · {selectedProofCheckpoint.watchQueueCount ?? 0} watch · {selectedProofCheckpoint.resolvedQueueCount ?? 0} resolved
                            </div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                              {selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0} blocking students · {selectedProofCheckpoint.watchStudentCount ?? 0} watched students
                            </div>
                            {selectedProofCheckpoint.stageAdvanceBlocked ? (
                              <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>
                                Stage progression blocked{selectedProofCheckpoint.blockedProgressionReason ? ` · ${selectedProofCheckpoint.blockedProgressionReason}` : ''}.
                              </div>
                            ) : null}
                          </Card>
                          <Card style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>No-Action Comparator</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                              {selectedProofCheckpoint.noActionHighRiskCount ?? 0} high-risk rows without simulated support
                            </div>
                          </Card>
                          <Card style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>Average Risk Change</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                              {selectedProofCheckpoint.averageRiskChangeFromPreviousCheckpointScaled ?? selectedProofCheckpoint.averageRiskDeltaScaled ?? 0} scaled points
                            </div>
                          </Card>
                          <Card style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.dim }}>Average Counterfactual Lift</div>
                            <div style={{ ...mono, fontSize: 11, color: T.text, marginTop: 4 }}>
                              {selectedProofCheckpoint.averageCounterfactualLiftScaled ?? 0} scaled points
                            </div>
                          </Card>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                            <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Stage queue preview</div>
                            {selectedProofCheckpointDetail?.queuePreview.length ? selectedProofCheckpointDetail.queuePreview.slice(0, 8).map(item => (
                              <Card key={item.simulationStageQueueProjectionId} style={{ padding: 10, background: T.surface }}>
                                <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · {item.assignedToRole} · {item.riskBand} · {item.status}</div>
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                                  {item.taskType} · action {item.simulatedActionTaken ?? item.recommendedAction ?? 'none'} · risk {item.riskProbScaled}%{item.noActionRiskProbScaled != null ? ` vs no-action ${item.noActionRiskProbScaled}%` : ''}.
                                </div>
                                {item.coEvidenceMode ? (
                                  <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                                    CO evidence mode: {item.coEvidenceMode}.
                                  </div>
                                ) : null}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                  {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                                  {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                                </div>
                              </Card>
                            )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No stage queue items exist at this checkpoint.</div>}
                          </Card>

                          <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 8 }}>
                            <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Offering action summary</div>
                            {selectedProofCheckpointDetail?.offeringRollups.length ? selectedProofCheckpointDetail.offeringRollups.slice(0, 8).map(item => {
                              const projection = item.projection
                              const averageRisk = typeof projection.averageRiskProbScaled === 'number' ? projection.averageRiskProbScaled : null
                              const openQueueCount = typeof projection.openQueueCount === 'number' ? projection.openQueueCount : null
                              return (
                                <Card key={item.simulationStageOfferingProjectionId} style={{ padding: 10, background: T.surface }}>
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.courseCode} · Section {item.sectionCode}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4, lineHeight: 1.8 }}>
                                {item.pendingAction ?? 'No pending action'}{averageRisk != null ? ` · avg risk ${averageRisk}%` : ''}{openQueueCount != null ? ` · open queue ${openQueueCount}` : ''}.
                              </div>
                              {typeof projection.coEvidenceMode === 'string' && projection.coEvidenceMode.length > 0 ? (
                                <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                                  CO evidence mode: {projection.coEvidenceMode}.
                                </div>
                              ) : null}
                              {item.projection ? (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                  {typeof projection.riskChangeFromPreviousCheckpointScaled === 'number' ? <Chip color={projection.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : projection.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${projection.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${projection.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                                  {typeof projection.counterfactualLiftScaled === 'number' ? <Chip color={projection.counterfactualLiftScaled > 0 ? T.success : projection.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${projection.counterfactualLiftScaled > 0 ? '+' : ''}${projection.counterfactualLiftScaled}`}</Chip> : null}
                                </div>
                              ) : null}
                            </Card>
                          )
                        }) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No offering rollups are available for this checkpoint.</div>}
                          </Card>
                        </div>
                      </Card>
                    ) : null}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                      <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Imports</div>
                        {proofDashboard?.imports.length ? proofDashboard.imports.slice(0, 3).map(item => (
                          <Card key={item.curriculumImportVersionId} style={{ padding: 10, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.sourceLabel}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                              {item.status} · {item.validationStatus} · {item.unresolvedMappingCount} unresolved mappings
                            </div>
                          </Card>
                        )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof imports yet.</div>}
                      </Card>

                      <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Crosswalk Review</div>
                        {proofDashboard?.crosswalkReviewQueue.length ? proofDashboard.crosswalkReviewQueue.slice(0, 5).map(item => (
                          <Card key={item.officialCodeCrosswalkId} style={{ padding: 10, background: T.surface2 }}>
                            <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.internalCompilerId}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                              {item.officialWebCode ?? 'No public code'} · {item.confidence}
                            </div>
                          </Card>
                        )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No pending crosswalk reviews.</div>}
                      </Card>

                      <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Runs</div>
                        {proofDashboard?.proofRuns.length ? proofDashboard.proofRuns.slice(0, 4).map(item => (
                          <Card key={item.simulationRunId} style={{ padding: 10, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.runLabel}</div>
                              <Chip color={item.activeFlag ? T.success : T.dim}>{item.activeFlag ? 'Active' : item.status}</Chip>
                            </div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>Seed {item.seed} · {new Date(item.createdAt).toLocaleString('en-IN')}</div>
                            {item.progress ? (
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                {String(item.progress.phase ?? item.status)} · {String(item.progress.percent ?? 0)}%
                              </div>
                            ) : null}
                            {item.failureMessage ? (
                              <div style={{ ...mono, fontSize: 10, color: T.warning, marginTop: 4, lineHeight: 1.6 }}>{item.failureMessage}</div>
                            ) : null}
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                              {!item.activeFlag && item.status === 'completed' ? <Btn size="sm" variant="ghost" onClick={() => handleActivateProofRun(item.simulationRunId)}>Set Active</Btn> : null}
                              {item.status === 'failed' ? <Btn size="sm" variant="ghost" onClick={() => handleRetryProofRun(item.simulationRunId)}>Retry</Btn> : null}
                              <Btn size="sm" variant="ghost" onClick={() => handleArchiveProofRun(item.simulationRunId)}>Archive</Btn>
                              {proofDashboard?.activeRunDetail?.snapshots[0] ? <Btn size="sm" variant="ghost" onClick={() => handleRestoreProofSnapshot(item.simulationRunId, proofDashboard.activeRunDetail?.snapshots[0]?.simulationResetSnapshotId)}>Restore Snapshot</Btn> : null}
                            </div>
                          </Card>
                        )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof simulation runs yet.</div>}
                      </Card>
                    </div>

                    {proofDashboard?.activeRunDetail ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                        <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Teacher Load</div>
                          {proofDashboard.activeRunDetail.teacherAllocationLoad.slice(0, 6).map(load => (
                            <Card key={load.teacherLoadProfileId} style={{ padding: 10, background: T.surface2 }}>
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{load.facultyName}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                Sem {load.semesterNumber} · {load.weeklyContactHours} contact hrs · {load.assignedCredits} credits
                              </div>
                            </Card>
                          ))}
                        </Card>

                        <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Queue Preview</div>
                          {proofDashboard.activeRunDetail.queuePreview.length ? proofDashboard.activeRunDetail.queuePreview.map(item => (
                            <Card key={item.reassessmentEventId} style={{ padding: 10, background: T.surface2 }}>
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.studentName} · {item.courseCode}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                {item.assignedToRole} · {item.status} · due {new Date(item.dueAt).toLocaleString('en-IN')}
                              </div>
                              {item.sourceKind === 'checkpoint-playback' ? (
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                  Playback fallback · {item.stageLabel ?? 'checkpoint-sourced'}
                                </div>
                              ) : null}
                              {item.coEvidenceMode ? (
                                <div style={{ ...mono, fontSize: 10, color: T.dim, marginTop: 4, lineHeight: 1.8 }}>
                                  CO evidence mode: {item.coEvidenceMode}.
                                </div>
                              ) : null}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                {item.riskChangeFromPreviousCheckpointScaled != null ? <Chip color={item.riskChangeFromPreviousCheckpointScaled > 0 ? T.danger : item.riskChangeFromPreviousCheckpointScaled < 0 ? T.success : T.dim}>{`Δ ${item.riskChangeFromPreviousCheckpointScaled > 0 ? '+' : ''}${item.riskChangeFromPreviousCheckpointScaled}`}</Chip> : null}
                                {item.counterfactualLiftScaled != null ? <Chip color={item.counterfactualLiftScaled > 0 ? T.success : item.counterfactualLiftScaled < 0 ? T.warning : T.dim}>{`Lift ${item.counterfactualLiftScaled > 0 ? '+' : ''}${item.counterfactualLiftScaled}`}</Chip> : null}
                              </div>
                            </Card>
                          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No active reassessment queue items.</div>}
                        </Card>

                        <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 8 }}>
                          <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>Lifecycle Audit</div>
                          {proofDashboard.lifecycleAudit.length ? proofDashboard.lifecycleAudit.slice(0, 6).map(item => (
                            <Card key={item.simulationLifecycleAuditId} style={{ padding: 10, background: T.surface2 }}>
                              <div style={{ ...mono, fontSize: 10, color: T.text }}>{item.actionType}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                {item.createdByFacultyName ?? 'System'} · {new Date(item.createdAt).toLocaleString('en-IN')}
                              </div>
                            </Card>
                          )) : <div style={{ ...mono, fontSize: 10, color: T.muted }}>No proof lifecycle audit entries yet.</div>}
                          </Card>
                        </div>
                        ) : null}
                      </div>
                    ) : (
                      <InfoBanner message="No proof run exists for this batch yet. Create an import, approve it, then start the first run." />
                    )}
                  </Card>

                  <div>
                    <SectionHeading title="Scope Governance Override" eyebrow="Governance" caption={`Adjust deterministic MSRUAS attendance, condonation, grading, and operational limits at ${activeGovernanceScope?.label ?? 'the active scope'}, or reset this layer back to inheritance.`} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? `${governanceScopeSummary} override` : `${governanceScopeSummary} inheriting`}</Chip>
                      <Chip color={T.accent}>{policyOverrideTrail}</Chip>
                    </div>
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
                    <div><FieldLabel>Max TTs</FieldLabel><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></div>
                    <div><FieldLabel>Max Quizzes</FieldLabel><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></div>
                    <div><FieldLabel>Max Asgn</FieldLabel><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></div>
                    <div><FieldLabel>Day Start</FieldLabel><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></div>
                    <div><FieldLabel>Day End</FieldLabel><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Working Days</FieldLabel>
                      <DayToggle days={WEEKDAYS} selected={policyForm.workingDays} onChange={next => setPolicyForm(prev => ({ ...prev, workingDays: next as PolicyFormState['workingDays'] }))} />
                    </div>
                    <div><FieldLabel>Coursework Weeks</FieldLabel><TextInput value={policyForm.courseworkWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, courseworkWeeks: event.target.value }))} /></div>
                    <div><FieldLabel>Exam Prep Weeks</FieldLabel><TextInput value={policyForm.examPreparationWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, examPreparationWeeks: event.target.value }))} /></div>
                    <div><FieldLabel>SEE Weeks</FieldLabel><TextInput value={policyForm.seeWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, seeWeeks: event.target.value }))} /></div>
                    <div><FieldLabel>Total Weeks</FieldLabel><TextInput value={policyForm.totalWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, totalWeeks: event.target.value }))} /></div>
                    <div><FieldLabel>Minimum Attendance %</FieldLabel><TextInput value={policyForm.minimumAttendancePercent} onChange={event => setPolicyForm(prev => ({ ...prev, minimumAttendancePercent: event.target.value }))} /></div>
                    <div><FieldLabel>Condonation Floor %</FieldLabel><TextInput value={policyForm.condonationFloorPercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationFloorPercent: event.target.value }))} /></div>
                    <div><FieldLabel>Condonation Shortage %</FieldLabel><TextInput value={policyForm.condonationShortagePercent} onChange={event => setPolicyForm(prev => ({ ...prev, condonationShortagePercent: event.target.value }))} /></div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                        <input type="checkbox" checked={policyForm.condonationRequiresApproval} onChange={event => setPolicyForm(prev => ({ ...prev, condonationRequiresApproval: event.target.checked }))} />
                        Condonation needs approval
                      </label>
                    </div>
                    <div><FieldLabel>CE Needed For SEE</FieldLabel><TextInput value={policyForm.minimumCeForSeeEligibility} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeForSeeEligibility: event.target.value }))} /></div>
                    <div><FieldLabel>Minimum CE Mark</FieldLabel><TextInput value={policyForm.minimumCeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumCeMark: event.target.value }))} /></div>
                    <div><FieldLabel>Minimum SEE Mark</FieldLabel><TextInput value={policyForm.minimumSeeMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumSeeMark: event.target.value }))} /></div>
                    <div><FieldLabel>Minimum Overall Mark</FieldLabel><TextInput value={policyForm.minimumOverallMark} onChange={event => setPolicyForm(prev => ({ ...prev, minimumOverallMark: event.target.value }))} /></div>
                    <div><FieldLabel>SGPA / CGPA Decimals</FieldLabel><TextInput value={policyForm.sgpaCgpaDecimals} onChange={event => setPolicyForm(prev => ({ ...prev, sgpaCgpaDecimals: event.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Repeat Course Policy</FieldLabel>
                      <SelectInput value={policyForm.repeatedCoursePolicy} onChange={event => setPolicyForm(prev => ({ ...prev, repeatedCoursePolicy: event.target.value as PolicyFormState['repeatedCoursePolicy'] }))}>
                        <option value="latest-attempt">Latest attempt</option><option value="best-attempt">Best attempt</option>
                      </SelectInput>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                        <input type="checkbox" checked={policyForm.allowCondonationForSeeEligibility} onChange={event => setPolicyForm(prev => ({ ...prev, allowCondonationForSeeEligibility: event.target.checked }))} />
                        Allow condoned attendance cases to remain SEE-eligible
                      </label>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                        <input type="checkbox" checked={policyForm.applyBeforeStatusDetermination} onChange={event => setPolicyForm(prev => ({ ...prev, applyBeforeStatusDetermination: event.target.checked }))} />
                        Apply rounding before pass / fail and grade status determination
                      </label>
                    </div>
                  </div>

                  <InfoBanner message="Course leaders now manage the internal TT, quiz, and assignment weightages inside the teaching workspace. Sysadmin controls only the CE/SEE split and max component counts here." />

                  <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Btn onClick={handleSaveScopePolicy}><CheckCircle2 size={14} /> Save {activeGovernanceScope ? formatScopeTypeLabel(activeGovernanceScope.scopeType) : 'Scope'} Policy</Btn>
                    <Btn variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset This Scope</Btn>
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
                activeGovernanceScope ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="Academic Bands" eyebrow="Evaluation" caption={`Resolved grade bands for ${activeGovernanceScope.label}. Save here to create or update the local override at this exact scope.`} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? `${governanceScopeSummary} override` : `${governanceScopeSummary} inheriting`}</Chip>
                      <Chip color={T.accent}>{policyOverrideTrail}</Chip>
                    </div>
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
                      <Btn onClick={handleSaveScopePolicy}><CheckCircle2 size={14} /> Save Bands</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset This Scope</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="No governance scope" body="Select a faculty, department, branch, or year to author a local override. Institution defaults remain available when no deeper scope is selected." />
              )}

              {universityTab === 'ce-see' && (
                activeGovernanceScope ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="CE / SEE Split" eyebrow="Assessment" caption={`Configure the CE/SEE split, component caps, and working calendar at ${activeGovernanceScope.label}. Deeper scopes inherit this unless they create a local override.`} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? `${governanceScopeSummary} override` : `${governanceScopeSummary} inheriting`}</Chip>
                      <Chip color={T.accent}>{policyOverrideTrail}</Chip>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>CE</FieldLabel><TextInput value={policyForm.ce} onChange={event => setPolicyForm(prev => ({ ...prev, ce: event.target.value }))} /></div>
                      <div><FieldLabel>SEE</FieldLabel><TextInput value={policyForm.see} onChange={event => setPolicyForm(prev => ({ ...prev, see: event.target.value }))} /></div>
                      <div><FieldLabel>Max TTs</FieldLabel><TextInput value={policyForm.maxTermTests} onChange={event => setPolicyForm(prev => ({ ...prev, maxTermTests: event.target.value }))} /></div>
                      <div><FieldLabel>Max Quizzes</FieldLabel><TextInput value={policyForm.maxQuizzes} onChange={event => setPolicyForm(prev => ({ ...prev, maxQuizzes: event.target.value }))} /></div>
                      <div><FieldLabel>Max Assignments</FieldLabel><TextInput value={policyForm.maxAssignments} onChange={event => setPolicyForm(prev => ({ ...prev, maxAssignments: event.target.value }))} /></div>
                      <div><FieldLabel>Day Start</FieldLabel><TextInput value={policyForm.dayStart} onChange={event => setPolicyForm(prev => ({ ...prev, dayStart: event.target.value }))} /></div>
                      <div><FieldLabel>Day End</FieldLabel><TextInput value={policyForm.dayEnd} onChange={event => setPolicyForm(prev => ({ ...prev, dayEnd: event.target.value }))} /></div>
                    </div>
                    <InfoBanner message="Internal TT, quiz, and assignment weight splits stay in teaching profile. Sysadmin owns the CE/SEE totals, caps, and inherited calendar guardrails here." />
                    <div>
                      <FieldLabel>Working Days</FieldLabel>
                      <DayToggle days={WEEKDAYS} selected={policyForm.workingDays} onChange={next => setPolicyForm(prev => ({ ...prev, workingDays: next as PolicyFormState['workingDays'] }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>Coursework Weeks</FieldLabel><TextInput value={policyForm.courseworkWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, courseworkWeeks: event.target.value }))} /></div>
                      <div><FieldLabel>Exam Prep Weeks</FieldLabel><TextInput value={policyForm.examPreparationWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, examPreparationWeeks: event.target.value }))} /></div>
                      <div><FieldLabel>SEE Weeks</FieldLabel><TextInput value={policyForm.seeWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, seeWeeks: event.target.value }))} /></div>
                      <div><FieldLabel>Total Weeks</FieldLabel><TextInput value={policyForm.totalWeeks} onChange={event => setPolicyForm(prev => ({ ...prev, totalWeeks: event.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn onClick={handleSaveScopePolicy}><CheckCircle2 size={14} /> Save CE / SEE</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset This Scope</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="No governance scope" body="Select a faculty, department, branch, or year to author CE/SEE rules at that layer." />
              )}

              {universityTab === 'cgpa' && (
                activeGovernanceScope ? (
                  <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                    <SectionHeading title="CGPA And Progression" eyebrow="Rules" caption={`Configure pass rules, progression, and risk thresholds for ${activeGovernanceScope.label}. Deeper scopes inherit these values until locally overridden.`} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={activeScopePolicyOverride ? T.orange : T.dim}>{activeScopePolicyOverride ? `${governanceScopeSummary} override` : `${governanceScopeSummary} inheriting`}</Chip>
                      <Chip color={T.accent}>{policyOverrideTrail}</Chip>
                    </div>
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
                      <div><FieldLabel>SGPA / CGPA Decimals</FieldLabel><TextInput value={policyForm.sgpaCgpaDecimals} onChange={event => setPolicyForm(prev => ({ ...prev, sgpaCgpaDecimals: event.target.value }))} /></div>
                      <div><FieldLabel>High Risk Attendance Below</FieldLabel><TextInput value={policyForm.highRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskAttendancePercentBelow: event.target.value }))} /></div>
                      <div><FieldLabel>Medium Risk Attendance Below</FieldLabel><TextInput value={policyForm.mediumRiskAttendancePercentBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskAttendancePercentBelow: event.target.value }))} /></div>
                      <div><FieldLabel>High Risk CGPA Below</FieldLabel><TextInput value={policyForm.highRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskCgpaBelow: event.target.value }))} /></div>
                      <div><FieldLabel>Medium Risk CGPA Below</FieldLabel><TextInput value={policyForm.mediumRiskCgpaBelow} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskCgpaBelow: event.target.value }))} /></div>
                      <div><FieldLabel>High Risk Backlogs At Or Above</FieldLabel><TextInput value={policyForm.highRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, highRiskBacklogCount: event.target.value }))} /></div>
                      <div><FieldLabel>Medium Risk Backlogs At Or Above</FieldLabel><TextInput value={policyForm.mediumRiskBacklogCount} onChange={event => setPolicyForm(prev => ({ ...prev, mediumRiskBacklogCount: event.target.value }))} /></div>
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
                      <Btn onClick={handleSaveScopePolicy}><CheckCircle2 size={14} /> Save CGPA Rules</Btn>
                      <Btn variant="ghost" onClick={() => void handleResetScopePolicy()}>Reset This Scope</Btn>
                    </div>
                  </Card>
                ) : <EmptyState title="No governance scope" body="Select a faculty, department, branch, or year to author CGPA and progression rules at that layer." />
              )}

              {universityTab === 'stage' && (
                activeGovernanceScope ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                      <SectionHeading title="Stage Policy" eyebrow="Lifecycle" caption={`Configure inherited class-stage gates at ${activeGovernanceScope.label}. Runtime offerings now advance only through this resolved policy.`} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Chip color={activeScopeStageOverride ? T.orange : T.dim}>{activeScopeStageOverride ? `${governanceScopeSummary} override` : `${governanceScopeSummary} inheriting`}</Chip>
                        <Chip color={T.accent}>{stageOverrideTrail}</Chip>
                      </div>
                      {stagePolicyForm.stages.map((stage, index) => (
                        <Card key={stage.key} style={{ padding: 14, background: T.surface2, display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{stage.label || `Stage ${index + 1}`}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{stage.key}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FieldLabel>Color</FieldLabel>
                              <TextInput
                                type="color"
                                value={stage.color}
                                onChange={event => setStagePolicyForm(prev => ({
                                  ...prev,
                                  stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item),
                                }))}
                                style={{ minHeight: 42, padding: 6 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                            <div><FieldLabel>Label</FieldLabel><TextInput value={stage.label} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></div>
                            <div><FieldLabel>Semester Day Offset</FieldLabel><TextInput value={stage.semesterDayOffset} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, semesterDayOffset: event.target.value } : item) }))} /></div>
                            <div style={{ gridColumn: '1 / -1' }}><FieldLabel>Description</FieldLabel><TextAreaInput value={stage.description} rows={3} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} /></div>
                            <div>
                              <FieldLabel>Advancement Mode</FieldLabel>
                              <SelectInput value={stage.advancementMode} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, advancementMode: event.target.value as StagePolicyFormState['stages'][number]['advancementMode'] } : item) }))}>
                                <option value="admin-confirmed">Admin confirmed</option>
                                <option value="automatic">Automatic</option>
                              </SelectInput>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              <FieldLabel>Required Evidence</FieldLabel>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {STAGE_EVIDENCE_OPTIONS.map(kind => (
                                  <label key={`${stage.key}:${kind}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface, ...mono, fontSize: 10, color: T.text }}>
                                    <input
                                      type="checkbox"
                                      checked={stage.requiredEvidence.includes(kind)}
                                      onChange={event => setStagePolicyForm(prev => ({
                                        ...prev,
                                        stages: prev.stages.map((item, itemIndex) => itemIndex === index ? {
                                          ...item,
                                          requiredEvidence: event.target.checked
                                            ? [...item.requiredEvidence, kind]
                                            : item.requiredEvidence.filter(entry => entry !== kind),
                                        } : item),
                                      }))}
                                    />
                                    {kind}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface, ...mono, fontSize: 11, color: T.text }}>
                                <input type="checkbox" checked={stage.requireQueueClearance} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireQueueClearance: event.target.checked } : item) }))} />
                                Require action queue clearance
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface, ...mono, fontSize: 11, color: T.text }}>
                                <input type="checkbox" checked={stage.requireTaskClearance} onChange={event => setStagePolicyForm(prev => ({ ...prev, stages: prev.stages.map((item, itemIndex) => itemIndex === index ? { ...item, requireTaskClearance: event.target.checked } : item) }))} />
                                Require faculty task clearance
                              </label>
                            </div>
                          </div>
                        </Card>
                      ))}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn onClick={handleSaveScopeStagePolicy}><CheckCircle2 size={14} /> Save Stage Policy</Btn>
                        <Btn variant="ghost" onClick={() => void handleResetScopeStagePolicy()}>Reset This Scope</Btn>
                      </div>
                    </Card>

                    {selectedBatch ? (
                      <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                        <SectionHeading title="Class Stage Control" eyebrow="Runtime" caption="The next stage can move only when the required evidence is present and locked, and when queue or faculty-task blockers are clear." />
                        {batchOfferings.length === 0 ? (
                          <EmptyState title="No live offerings in this batch" body="Provision the selected batch first, or create the missing section offerings for the active term." />
                        ) : (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(260px, 0.8fr) minmax(0, 1fr)', gap: 10 }}>
                              <div>
                                <FieldLabel>Offering</FieldLabel>
                                <SelectInput value={selectedStageOfferingId} onChange={event => setSelectedStageOfferingId(event.target.value)}>
                                  {batchOfferings.map(offering => (
                                    <option key={offering.offId} value={offering.offId}>
                                      {`${offering.code} · ${offering.title} · Sec ${offering.section}`}
                                    </option>
                                  ))}
                                </SelectInput>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <Chip color={selectedStageEligibility?.eligible ? T.success : T.warning}>
                                  {selectedStageEligibility?.eligible ? 'Advance eligible' : 'Blocked'}
                                </Chip>
                                {selectedStageEligibility?.currentStage ? <Chip color={selectedStageEligibility.currentStage.color}>{`Current · ${selectedStageEligibility.currentStage.label}`}</Chip> : null}
                                {selectedStageEligibility?.nextStage ? <Chip color={selectedStageEligibility.nextStage.color}>{`Next · ${selectedStageEligibility.nextStage.label}`}</Chip> : <Chip color={T.dim}>Final stage</Chip>}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                              <Card style={{ padding: 12, background: T.surface2 }}>
                                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Queue Burden</div>
                                <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{selectedStageEligibility?.queueBurden ?? 0}</div>
                              </Card>
                              <Card style={{ padding: 12, background: T.surface2 }}>
                                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Required Evidence</div>
                                <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{selectedStageEligibility?.evidenceStatus.filter(item => item.required).length ?? 0}</div>
                              </Card>
                              <Card style={{ padding: 12, background: T.surface2 }}>
                                <div style={{ ...mono, fontSize: 10, color: T.dim }}>Locked Evidence</div>
                                <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{selectedStageEligibility?.evidenceStatus.filter(item => item.required && item.locked).length ?? 0}</div>
                              </Card>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {(selectedStageEligibility?.evidenceStatus ?? []).map(item => (
                                <Card key={item.kind} style={{ padding: 12, background: T.surface2, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ ...mono, fontSize: 11, color: T.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.kind}</div>
                                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                                      {item.required ? `Required for next stage · ${item.presentCount}/${item.expectedCount} records present.` : 'Not required at this stage.'}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Chip color={item.required ? T.accent : T.dim}>{item.required ? 'Required' : 'Optional'}</Chip>
                                    <Chip color={item.present ? T.success : T.warning}>{item.present ? 'Present' : 'Missing'}</Chip>
                                    <Chip color={item.locked ? T.success : T.warning}>{item.locked ? 'Locked' : 'Unlocked'}</Chip>
                                  </div>
                                </Card>
                              ))}
                            </div>
                            {selectedStageEligibility?.blockingReasons.length ? (
                              <Card style={{ padding: 14, background: T.surface2, display: 'grid', gap: 8 }}>
                                <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>Blocking Reasons</div>
                                {selectedStageEligibility.blockingReasons.map(reason => (
                                  <div key={reason} style={{ ...mono, fontSize: 10, color: T.warning, lineHeight: 1.8 }}>{reason}</div>
                                ))}
                              </Card>
                            ) : (
                              <InfoBanner message="All configured requirements for the next stage are currently satisfied." />
                            )}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <Btn onClick={() => void handleAdvanceOfferingStage()} disabled={!selectedStageEligibility?.eligible || !selectedStageEligibility?.nextStage}>
                                <CheckCircle2 size={14} />
                                {selectedStageEligibility?.nextStage ? `Advance To ${selectedStageEligibility.nextStage.label}` : 'Final Stage Reached'}
                              </Btn>
                            </div>
                          </>
                        )}
                      </Card>
                    ) : null}
                  </div>
                ) : <EmptyState title="No governance scope" body="Select a faculty, department, branch, or year to configure stage policy." />
              )}

              {universityTab === 'provision' && (
                selectedBatch ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                      <SectionHeading title="Batch Provisioning" eyebrow="Live Wiring" caption="Seed the selected batch with live offerings, section rosters, mentor assignments, assessment scaffolding, and teacher ownerships so the teaching portfolio shows real data." />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Sections</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{selectedBatch.sectionLabels.join(', ')}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Faculty Pool</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchFacultyPool.length}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Visible Students</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchStudents.length}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Live Offerings</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchOfferings.length}</div></Card>
                      </div>
                      <InfoBanner message="Provisioning uses the currently scoped faculty pool, assigns course ownerships using the shared MSRUAS allocator, publishes timetable workspaces, creates section rosters, and refreshes affected proof batches." />
                      <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Term</FieldLabel>
                          <SelectInput value={batchProvisioningForm.termId} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, termId: event.target.value }))}>
                            <option value="">Select term</option>
                            {batchTerms.map(term => (
                              <option key={term.termId} value={term.termId}>
                                {`Semester ${term.semesterNumber} · ${term.academicYearLabel}`}
                              </option>
                            ))}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Mode</FieldLabel>
                          <SelectInput value={batchProvisioningForm.mode ?? 'mock'} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, mode: event.target.value as BatchProvisioningFormState['mode'] }))}>
                            <option value="mock">Mock</option>
                            <option value="live-empty">Live empty</option>
                            <option value="manual">Manual</option>
                          </SelectInput>
                        </div>
                        <div><FieldLabel>Section Labels</FieldLabel><TextInput value={batchProvisioningForm.sectionLabels} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, sectionLabels: event.target.value }))} placeholder="A, B" /></div>
                        <div><FieldLabel>Students Per Section</FieldLabel><TextInput value={batchProvisioningForm.studentsPerSection} onChange={event => setBatchProvisioningForm(prev => ({ ...prev, studentsPerSection: event.target.value }))} placeholder="60" /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        {[
                          ['createStudents', 'Create synthetic students'],
                          ['createMentors', 'Create mentor assignments'],
                          ['createAttendanceScaffolding', 'Create attendance scaffolding'],
                          ['createAssessmentScaffolding', 'Create assessment scaffolding'],
                          ['createTranscriptScaffolding', 'Create transcript scaffolding'],
                        ].map(([key, label]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${T.border2}`, background: T.surface2, ...mono, fontSize: 11, color: T.text }}>
                            <input
                              type="checkbox"
                              checked={batchProvisioningForm[key as keyof BatchProvisioningFormState] as boolean}
                              onChange={event => setBatchProvisioningForm(prev => ({ ...prev, [key]: event.target.checked }))}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn onClick={() => void handleProvisionBatch()} disabled={!batchProvisioningForm.termId || batchFacultyPool.length === 0}>
                          <Plus size={14} />
                          Provision Batch
                        </Btn>
                        {currentSemesterTerm ? <Chip color={T.accent}>{`Default term · Semester ${currentSemesterTerm.semesterNumber}`}</Chip> : <Chip color={T.warning}>Create a term first</Chip>}
                        {batchFacultyPool.length === 0 ? <Chip color={T.danger}>No scoped faculty pool available</Chip> : null}
                      </div>
                    </Card>

                    <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                      <SectionHeading title="Consistency Validator" eyebrow="Readiness" caption="Use these live counts to confirm the selected batch is fully wired for teacher and mentor views." />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Offerings Missing Owner</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchOfferingsWithoutOwner.length}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Students Missing Enrollment</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchStudentsWithoutEnrollment.length}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Students Missing Mentor</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchStudentsWithoutMentor.length}</div></Card>
                        <Card style={{ padding: 12, background: T.surface2 }}><div style={{ ...mono, fontSize: 10, color: T.dim }}>Offerings Without Visible Roster</div><div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text, marginTop: 6 }}>{batchOfferingsWithoutRoster.length}</div></Card>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.muted, lineHeight: 1.8 }}>
                        This validator uses the live relational graph already loaded in sysadmin: ownerships, active enrollments, mentor links, and offering-section rosters. Published timetable workspaces remain visible in each faculty timetable workspace after provisioning.
                      </div>
                    </Card>
                  </div>
                ) : <EmptyState title="Select a year" body="Provisioning runs at year scope because sections, offerings, rosters, and mentor links all hang from the batch." />
              )}

              {universityTab === 'courses' && (
                selectedBranch ? (
                selectedBatch ? (
                    <Card style={{ padding: 18, display: 'grid', gap: 12 }}>
                      <SectionHeading title="Semester Courses" eyebrow="Curriculum" caption="Semester-wise course rows, credits, and scoped course leader visibility for the selected year." />
                      {curriculumBySemester.length === 0 ? <EmptyState title="No semester rows yet" body="Add the first course row below." /> : (
                        <Card style={{ padding: 12, background: T.surface2, display: 'grid', gap: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1024 ? 'minmax(0, 1fr)' : '180px minmax(0, 1fr)', gap: 10 }}>
                            <div>
                              <FieldLabel>Semester</FieldLabel>
                              <SelectInput value={selectedCurriculumSemester} onChange={event => setSelectedCurriculumSemester(event.target.value)}>
                                {curriculumBySemester.map(entry => (
                                  <option key={entry.semesterNumber} value={String(entry.semesterNumber)}>
                                    {`Semester ${entry.semesterNumber} · ${entry.courses.length} course${entry.courses.length === 1 ? '' : 's'}`}
                                  </option>
                                ))}
                              </SelectInput>
                            </div>
                            <div>
                              <FieldLabel>Course In Selected Semester</FieldLabel>
                              <SelectInput
                                value={selectedCurriculumCourse?.curriculumCourseId ?? ''}
                                onChange={event => {
                                  setSelectedCurriculumCourseId(event.target.value)
                                  if (event.target.value) startEditingCurriculumCourse(event.target.value)
                                }}
                                disabled={selectedCurriculumSemesterCourses.length === 0}
                              >
                                {selectedCurriculumSemesterCourses.length === 0 ? <option value="">No courses in this semester</option> : selectedCurriculumSemesterCourses.map(course => (
                                  <option key={course.curriculumCourseId} value={course.curriculumCourseId}>
                                    {`${course.courseCode} · ${course.title}`}
                                  </option>
                                ))}
                              </SelectInput>
                            </div>
                          </div>

                          {selectedCurriculumCourse ? (() => {
                            const leaderState = getScopedCourseLeaderState(selectedCurriculumCourse.curriculumCourseId)
                            return (
                              <Card style={{ padding: 14, background: T.surface, display: 'grid', gap: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                  <div>
                                    <div style={{ ...sora, fontSize: 16, fontWeight: 700, color: T.text }}>{selectedCurriculumCourse.courseCode} · {selectedCurriculumCourse.title}</div>
                                    <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6 }}>
                                      {`Semester ${selectedCurriculumSemesterEntry?.semesterNumber ?? selectedCurriculumCourse.semesterNumber} · ${leaderState.matchingOfferings.length} live offering${leaderState.matchingOfferings.length === 1 ? '' : 's'} in scope`}
                                    </div>
                                  </div>
                                  <Chip color={T.accent}>{`${selectedCurriculumCourse.credits} credits`}</Chip>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1024 ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                                  <div style={{ display: 'grid', gap: 6 }}>
                                    <FieldLabel>Course Leader</FieldLabel>
                                    <SelectInput
                                      value={leaderState.selectedFacultyId}
                                      disabled={leaderState.matchingOfferings.length === 0}
                                      onChange={event => void handleAssignCurriculumCourseLeader(selectedCurriculumCourse.curriculumCourseId, event.target.value)}
                                    >
                                      <option value="">{leaderState.hasMultipleLeaders ? 'Multiple leaders assigned' : leaderState.matchingOfferings.length === 0 ? 'No offerings in scope yet' : 'Clear course leader'}</option>
                                      {scopedCourseLeaderFaculty.map(member => <option key={member.facultyId} value={member.facultyId}>{member.displayName} · {member.employeeCode}</option>)}
                                    </SelectInput>
                                    <div style={{ ...mono, fontSize: 10, color: leaderState.hasMultipleLeaders ? T.warning : T.accent }}>
                                      {leaderState.hasMultipleLeaders
                                        ? getUniversityCourseLeaders(selectedCurriculumCourse.courseCode).join(', ')
                                        : getUniversityCourseLeaders(selectedCurriculumCourse.courseCode).join(', ') || 'Course leader not assigned'}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Btn size="sm" variant="ghost" onClick={() => startEditingCurriculumCourse(selectedCurriculumCourse.curriculumCourseId)}>Load Into Editor</Btn>
                                    <Btn
                                      size="sm"
                                      variant="danger"
                                      onClick={() => {
                                        if (window.confirm(`Delete curriculum row ${selectedCurriculumCourse.courseCode}?`)) {
                                          void handleArchiveCurriculumCourse(selectedCurriculumCourse.curriculumCourseId)
                                        }
                                      }}
                                    >
                                      Delete
                                    </Btn>
                                  </div>
                                </div>
                              </Card>
                            )
                          })() : (
                            <InfoBanner message="No course exists in the selected semester yet. Use the form below to create the first row." />
                          )}
                        </Card>
                      )}
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
                      <Card style={{ padding: 16, background: T.surface2, display: 'grid', gap: 12 }}>
                        <SectionHeading title="Model Inputs" eyebrow="Risk Model" caption="Manage course outcomes, prerequisite edges, bridge modules, and topic partitions through batch-local overrides or shared scope profiles that feed retraining and world generation." />
                        {curriculumFeatureItems.length === 0 ? (
                          <EmptyState title="No model input bundle yet" body="Save at least one curriculum row first. The sysadmin editor will then project those rows into the proof curriculum snapshot." />
                        ) : (
                          <>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'minmax(260px, 1fr) minmax(0, 1fr)', gap: 10 }}>
                                <div>
                                  <FieldLabel>Course</FieldLabel>
                                  <SelectInput
                                    value={selectedCurriculumFeatureCourseId}
                                    onChange={event => {
                                      const nextId = event.target.value
                                      setSelectedCurriculumFeatureCourseId(nextId)
                                      const nextItem = curriculumFeatureItems.find(item => item.curriculumCourseId === nextId) ?? null
                                      setCurriculumFeatureForm(hydrateCurriculumFeatureForm(nextItem))
                                    }}
                                  >
                                    {curriculumFeatureItems.map(item => (
                                      <option key={item.curriculumCourseId} value={item.curriculumCourseId}>
                                        {`Sem ${item.semesterNumber} · ${item.courseCode} · ${item.title}`}
                                      </option>
                                    ))}
                                  </SelectInput>
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  <FieldLabel>Resolved Snapshot</FieldLabel>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Chip color={curriculumFeatureConfig?.curriculumImportVersion ? T.accent : T.dim}>
                                      {curriculumFeatureConfig?.curriculumImportVersion
                                        ? `${curriculumFeatureConfig.curriculumImportVersion.sourceLabel} · ${curriculumFeatureConfig.curriculumImportVersion.validationStatus}`
                                        : 'No import snapshot yet'}
                                    </Chip>
                                    {curriculumFeatureConfig?.curriculumFeatureProfileFingerprint ? <Chip color={T.success}>{`Fingerprint ${curriculumFeatureConfig.curriculumFeatureProfileFingerprint.slice(0, 8)}`}</Chip> : null}
                                    {selectedCurriculumFeatureItem?.resolvedSource ? <Chip color={T.warning}>{selectedCurriculumFeatureItem.resolvedSource.label}</Chip> : null}
                                    {selectedCurriculumFeatureItem?.localOverride ? <Chip color={T.orange}>Batch-local override active</Chip> : <Chip color={T.dim}>No batch-local override</Chip>}
                                  </div>
                                </div>
                              </div>

                              <Card style={{ padding: 12, background: T.surface, display: 'grid', gap: 10 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1180 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                                  <div>
                                    <FieldLabel>Batch Binding Mode</FieldLabel>
                                    <SelectInput value={curriculumFeatureBindingMode} onChange={event => setCurriculumFeatureBindingMode(event.target.value as typeof curriculumFeatureBindingMode)}>
                                      <option value="inherit-scope-profile">Inherit scope profile</option>
                                      <option value="pin-profile">Pin specific profile</option>
                                      <option value="local-only">Local only</option>
                                    </SelectInput>
                                  </div>
                                  <div>
                                    <FieldLabel>Pinned Profile</FieldLabel>
                                    <SelectInput
                                      value={curriculumFeaturePinnedProfileId}
                                      disabled={curriculumFeatureBindingMode !== 'pin-profile'}
                                      onChange={event => setCurriculumFeaturePinnedProfileId(event.target.value)}
                                    >
                                      <option value="">Select profile</option>
                                      {curriculumFeatureProfileOptions.map(profile => (
                                        <option key={profile.curriculumFeatureProfileId} value={profile.curriculumFeatureProfileId}>
                                          {`${formatScopeTypeLabel(profile.scopeType)} · ${profile.name}`}
                                        </option>
                                      ))}
                                    </SelectInput>
                                  </div>
                                  <div>
                                    <FieldLabel>Save Target Mode</FieldLabel>
                                    <SelectInput value={curriculumFeatureTargetMode} onChange={event => setCurriculumFeatureTargetMode(event.target.value as typeof curriculumFeatureTargetMode)}>
                                      <option value="batch-local-override">Batch-local override</option>
                                      <option value="scope-profile">Scope profile</option>
                                    </SelectInput>
                                  </div>
                                  <div>
                                    <FieldLabel>Target Scope</FieldLabel>
                                    <SelectInput
                                      value={curriculumFeatureTargetScopeKey}
                                      disabled={curriculumFeatureTargetMode !== 'scope-profile'}
                                      onChange={event => setCurriculumFeatureTargetScopeKey(event.target.value)}
                                    >
                                      {curriculumFeatureTargetScopeOptions.map(scope => (
                                        <option key={`${scope.scopeType}:${scope.scopeId}`} value={`${scope.scopeType}::${scope.scopeId}`}>
                                          {`${formatScopeTypeLabel(scope.scopeType)} · ${scope.label}`}
                                        </option>
                                      ))}
                                    </SelectInput>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <Chip color={curriculumFeatureConfig?.binding?.bindingMode === 'local-only' ? T.orange : T.accent}>
                                    {`Current binding · ${curriculumFeatureConfig?.binding?.bindingMode ?? 'inherit-scope-profile'}`}
                                  </Chip>
                                  {selectedCurriculumFeatureItem?.appliedProfiles?.map(profile => (
                                    <Chip key={profile.curriculumFeatureProfileId} color={T.success}>{`${formatScopeTypeLabel(profile.scopeType)} · ${profile.name}`}</Chip>
                                  ))}
                                  {curriculumFeatureTargetMode === 'scope-profile' && selectedCurriculumFeatureTargetScope ? (
                                    <Chip color={T.warning}>{`${curriculumFeatureAffectedBatchPreview.length} affected batch${curriculumFeatureAffectedBatchPreview.length === 1 ? '' : 'es'} in target scope`}</Chip>
                                  ) : null}
                                </div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <Btn type="button" onClick={() => void handleSaveCurriculumFeatureBinding()} disabled={curriculumFeatureBindingMode === 'pin-profile' && !curriculumFeaturePinnedProfileId}>
                                    Save Binding
                                  </Btn>
                                </div>
                              </Card>
                            </div>
                            <InfoBanner message="Outcome line format: CO1 | Apply | Description. Prerequisite line format: COURSE_CODE | explicit|added | rationale. Saving to a scope profile updates that shared feature category and only refreshes affected batches whose resolved fingerprints change." />
                            <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 1240 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                              <div><FieldLabel>Assessment Profile</FieldLabel><TextInput value={curriculumFeatureForm.assessmentProfile} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, assessmentProfile: event.target.value }))} placeholder="admin-authored" /></div>
                              <div><FieldLabel>Bridge Modules</FieldLabel><TextAreaInput value={curriculumFeatureForm.bridgeModulesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, bridgeModulesText: event.target.value }))} rows={4} placeholder={'Bridge topic 1\nBridge topic 2'} /></div>
                              <div style={{ gridColumn: '1 / -1' }}><FieldLabel>Course Outcomes</FieldLabel><TextAreaInput value={curriculumFeatureForm.outcomesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, outcomesText: event.target.value }))} rows={6} placeholder={'CO1 | Understand | Explain the core concepts\nCO2 | Apply | Apply the methods to structured problems'} /></div>
                              <div style={{ gridColumn: '1 / -1' }}><FieldLabel>Prerequisites</FieldLabel><TextAreaInput value={curriculumFeatureForm.prerequisitesText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, prerequisitesText: event.target.value }))} rows={5} placeholder={'MATH201 | explicit | Calculus foundation for optimisation\nCS202 | added | Added dependency for implementation readiness'} /></div>
                              <div><FieldLabel>TT1 Topics</FieldLabel><TextAreaInput value={curriculumFeatureForm.tt1TopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, tt1TopicsText: event.target.value }))} rows={4} placeholder={'Unit 1\nUnit 2'} /></div>
                              <div><FieldLabel>TT2 Topics</FieldLabel><TextAreaInput value={curriculumFeatureForm.tt2TopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, tt2TopicsText: event.target.value }))} rows={4} placeholder={'Unit 3\nUnit 4'} /></div>
                              <div><FieldLabel>SEE Topics</FieldLabel><TextAreaInput value={curriculumFeatureForm.seeTopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, seeTopicsText: event.target.value }))} rows={4} placeholder={'Comprehensive topic 1\nComprehensive topic 2'} /></div>
                              <div><FieldLabel>Workbook Topics</FieldLabel><TextAreaInput value={curriculumFeatureForm.workbookTopicsText} onChange={event => setCurriculumFeatureForm(prev => ({ ...prev, workbookTopicsText: event.target.value }))} rows={4} placeholder={'Workbook topic 1\nWorkbook topic 2'} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <Btn type="button" onClick={() => void handleSaveCurriculumFeatureConfig()} disabled={!selectedCurriculumFeatureItem}>{curriculumFeatureTargetMode === 'scope-profile' ? 'Save Shared Model Inputs' : 'Save Model Inputs'}</Btn>
                              {selectedCurriculumFeatureItem ? <Chip color={T.warning}>{`${selectedCurriculumFeatureItem.prerequisites.length} prerequisites · ${selectedCurriculumFeatureItem.bridgeModules.length} bridge modules`}</Chip> : null}
                              {curriculumFeatureTargetMode === 'scope-profile' && selectedCurriculumFeatureTargetScope ? <Chip color={T.accent}>{`${formatScopeTypeLabel(selectedCurriculumFeatureTargetScope.scopeType)} · ${selectedCurriculumFeatureTargetScope.label}`}</Chip> : null}
                            </div>
                          </>
                        )}
                      </Card>
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
                    {activeUniversityRegistryScope
                      ? `Open the student registry scoped to ${activeUniversityRegistryScope.label}.`
                      : 'Select a faculty, department, branch, year, or section first, then open the student registry.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Chip color={activeUniversityRegistryScope ? ADMIN_SECTION_TONES.students : T.dim}>{scopedUniversityStudents.length} visible</Chip>
                    {selectedSectionCode ? <Chip color={T.accent}>Section scope</Chip> : selectedBatch ? <Chip color={T.accent}>Year scope</Chip> : selectedBranch ? <Chip color={T.accent}>Branch scope</Chip> : selectedDepartment ? <Chip color={T.accent}>Department scope</Chip> : selectedAcademicFaculty ? <Chip color={T.accent}>Faculty scope</Chip> : <Chip color={T.dim}>Scope required</Chip>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" variant="ghost" onClick={() => handleOpenScopedRegistry('students')}>Open Scoped Students</Btn>
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
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: registryIsSingleColumn ? 'none' : 'calc(100vh - 200px)', overflow: registryIsSingleColumn ? 'visible' : 'hidden' }}>
              <SectionHeading
                title="Students"
                eyebrow="Registry"
                caption={studentRegistryCaption}
                toneColor={ADMIN_SECTION_TONES.students}
              />
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}><Plus size={14} /> New Student</Btn>
                  <Chip color={T.accent}>{studentRegistryItems.length} active</Chip>
                  <Chip color={T.warning}>{studentRegistryItems.filter(item => !item.activeMentorAssignment).length} mentor gaps</Chip>
                  {studentRegistryScopeLabel ? <Chip color={ADMIN_SECTION_TONES.students}>{studentRegistryScopeLabel}</Chip> : <Chip color={T.dim}>Scope required</Chip>}
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
                <SearchField
                  value={studentRegistrySearch}
                  onChange={setStudentRegistrySearch}
                  placeholder="Search student, USN, branch, section, email..."
                  ariaLabel="Student registry search"
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setStudentRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Chip color={T.dim}>Sorted A-Z</Chip>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: registryIsSingleColumn ? 'visible' : 'auto', paddingRight: 4 }}>
                {studentRegistryItems.map(student => (
                  <EntityButton key={student.studentId} selected={route.studentId === student.studentId} onClick={() => navigate({ section: 'students', studentId: student.studentId })}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 12, background: `${ADMIN_SECTION_TONES.students}18`, color: ADMIN_SECTION_TONES.students, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...sora, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                            {student.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'ST'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{student.name}</div>
                            <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{student.usn} · {student.activeAcademicContext?.branchName ?? 'No branch mapped'}</div>
                          </div>
                        </div>
                        <Chip color={student.activeMentorAssignment ? T.success : T.warning} size={9}>{student.activeMentorAssignment ? 'Mentored' : 'Mentor missing'}</Chip>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {student.activeAcademicContext?.departmentName ? <Chip color={T.warning} size={9}>{student.activeAcademicContext.departmentName}</Chip> : null}
                        {student.activeAcademicContext?.sectionCode ? <Chip color={T.accent} size={9}>Sec {student.activeAcademicContext.sectionCode}</Chip> : null}
                        <Chip color={T.success} size={9}>CGPA {student.currentCgpa.toFixed(2)}</Chip>
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: T.success, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        Semester {student.activeAcademicContext?.semesterNumber ?? '—'} · {student.email ?? 'Email not set'} · {student.phone ?? 'Phone not set'}
                      </div>
                    </div>
                  </EntityButton>
                ))}
                {studentRegistryItems.length === 0 ? <InfoBanner message={studentRegistryEmptyMessage} /> : null}
              </div>
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
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
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                      <Chip color={T.success}>CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                      <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                      <Chip color={selectedStudent.status === 'active' ? T.success : T.danger}>{selectedStudent.status}</Chip>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.name}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roll Number</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.rollNumber ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admission Date</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{formatDate(selectedStudent.admissionDate)}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.email ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.phone ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Context</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedStudent.activeAcademicContext ? `${selectedStudent.activeAcademicContext.branchName ?? 'Branch'} · Sem ${selectedStudent.activeAcademicContext.semesterNumber ?? '—'} · Sec ${selectedStudent.activeAcademicContext.sectionCode}` : 'No active academic context'}</div></Card>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="button" size="sm" onClick={() => setEditingEntity('student-profile')}>Edit Student</Btn>
                      <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveStudent()}>Delete Student</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>New Student</Btn>
                    </div>
                  </>
                ) : (
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
                      <Btn type="submit">Create Student</Btn>
                      <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>Clear Form</Btn>
                    </div>
                  </form>
                )}
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
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: registryPageColumns }}>
            <Card style={{ padding: 18, display: 'grid', gap: 12, gridTemplateRows: 'auto auto auto minmax(0, 1fr)', alignContent: 'start', maxHeight: registryIsSingleColumn ? 'none' : 'calc(100vh - 200px)', overflow: registryIsSingleColumn ? 'visible' : 'hidden' }}>
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
                <SearchField
                  value={facultyRegistrySearch}
                  onChange={setFacultyRegistrySearch}
                  placeholder="Search faculty, code, department, role, email..."
                  ariaLabel="Faculty registry search"
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn type="button" variant="ghost" onClick={() => setFacultyRegistryFilter(hydrateRegistryFilter(registryScope))}>Reset Filters</Btn>
                  <Btn type="button" variant="ghost" onClick={() => handleOpenFullRegistry('faculty-members')}>Open Complete Page</Btn>
                  <Chip color={T.dim}>Sorted A-Z</Chip>
                </div>
              </div>
              <div className="scroll-pane" style={{ display: 'grid', gap: 8, minHeight: 0, overflowY: registryIsSingleColumn ? 'visible' : 'auto', paddingRight: 4 }}>
                {facultyRegistryItems.map(item => {
                  const primaryDepartment = resolveDepartment(data, getPrimaryAppointmentDepartmentId(item))
                  return (
                    <EntityButton key={item.facultyId} selected={route.facultyMemberId === item.facultyId} onClick={() => navigate({ section: 'faculty-members', facultyMemberId: item.facultyId })}>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 12, background: `${ADMIN_SECTION_TONES['faculty-members']}18`, color: ADMIN_SECTION_TONES['faculty-members'], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...sora, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                              {item.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'FM'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{item.displayName}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{item.employeeCode} · {primaryDepartment?.name ?? 'No primary department'}</div>
                            </div>
                          </div>
                          <Chip color={item.roleGrants.some(grant => grant.roleCode === 'MENTOR' && isCurrentRoleGrant(grant)) ? T.success : T.dim} size={9}>{item.roleGrants.some(grant => isCurrentRoleGrant(grant)) ? 'Scoped' : 'Unscoped'}</Chip>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.roleGrants.filter(isCurrentRoleGrant).slice(0, 3).map(grant => <Chip key={grant.grantId} color={T.accent} size={9}>{grant.roleCode}</Chip>)}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.designation} · {item.email}</div>
                      </div>
                    </EntityButton>
                  )
                })}
                {facultyRegistryItems.length === 0 ? <InfoBanner message="No active faculty profiles yet. Create the first faculty record from this panel." /> : null}
              </div>
            </Card>

            <div style={{ display: 'grid', gap: 16 }}>
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
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedFacultyMember.employeeCode}</Chip>
                      <Chip color={T.warning}>{resolveDepartment(data, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'No primary department'}</Chip>
                      {selectedFacultyMember.roleGrants.filter(isCurrentRoleGrant).map(grant => <Chip key={grant.grantId} color={T.success}>{grant.roleCode}</Chip>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Display Name</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.displayName}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Username</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.username}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Designation</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.designation}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.email}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{selectedFacultyMember.phone ?? 'Not set'}</div></Card>
                      <Card style={{ padding: 14, background: T.surface2 }}><div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Joined On</div><div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedFacultyMember.joinedOn ? formatDate(selectedFacultyMember.joinedOn) : 'Not set'}</div></Card>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="button" size="sm" onClick={() => setEditingEntity('faculty-profile')}>Edit Faculty</Btn>
                      <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveFaculty()}>Delete Faculty</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>New Faculty</Btn>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSaveFaculty} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <div><FieldLabel>Display Name</FieldLabel><TextInput value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} placeholder="Faculty name" /></div>
                      <div><FieldLabel>Employee Code</FieldLabel><TextInput value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} placeholder="EMP001" /></div>
                      <div><FieldLabel>Username</FieldLabel><TextInput value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} placeholder="faculty.user" /></div>
                      <div><FieldLabel>Email</FieldLabel><TextInput value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} placeholder="faculty@campus.edu" /></div>
                      <div><FieldLabel>Phone</FieldLabel><TextInput value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="+91…" /></div>
                      <div><FieldLabel>Designation</FieldLabel><TextInput value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} placeholder="Assistant Professor" /></div>
                      <div><FieldLabel>Initial Password</FieldLabel><TextInput type="password" value={facultyForm.password} onChange={event => setFacultyForm(prev => ({ ...prev, password: event.target.value }))} placeholder="Minimum 8 characters" /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Btn type="submit">Create Faculty</Btn>
                      <Btn type="button" variant="ghost" onClick={() => { navigate({ section: 'faculty-members' }); resetFacultyEditors() }}>Clear Form</Btn>
                    </div>
                  </form>
                )}
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
                <SectionHeading title="Class Ownership" eyebrow="Single Owner Assignment" caption="System admin assigns classes here as a single-owner list. Ownership role stays fixed and no class can belong to more than one professor at the same time." />
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
                                <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{offering?.dept ?? 'NA'} · {offering?.year ?? '—'} · Section {offering?.section ?? '—'} · owner · {ownership.status}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Btn type="button" size="sm" variant="danger" onClick={() => void handleArchiveOwnership(ownership)}>Delete</Btn>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                    <form onSubmit={handleSaveOwnership} style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <div>
                          <FieldLabel>Offering / Class</FieldLabel>
                          <SelectInput value={ownershipForm.offeringId} onChange={event => setOwnershipForm(prev => ({ ...prev, offeringId: event.target.value, facultyId: selectedFacultyMember.facultyId }))}>
                            <option value="">{availableOwnershipOfferings.length > 0 ? 'Select unassigned class' : 'No unassigned classes available'}</option>
                            {availableOwnershipOfferings.map(offering => <option key={offering.offId} value={offering.offId}>{offering.code} · {offering.year} · Section {offering.section}</option>)}
                          </SelectInput>
                        </div>
                        <div>
                          <FieldLabel>Assigned Role</FieldLabel>
                          <TextInput value="owner" readOnly />
                        </div>
                      </div>
                      {availableOwnershipOfferings.length === 0 ? <InfoBanner message="All visible classes already have an active owner. Remove an ownership first before reassigning a class." /> : null}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Btn type="submit" disabled={!ownershipForm.offeringId}>Add Class</Btn>
                        <Btn type="button" variant="ghost" onClick={() => setOwnershipForm({
                          ...defaultOwnershipForm(),
                          facultyId: selectedFacultyMember.facultyId,
                        })}>Clear Selection</Btn>
                      </div>
                    </form>
                    {selectedFacultyAssignments.length > 0 ? (
                      <Card style={{ padding: 12, background: T.surface }}>
                        <div style={{ ...mono, fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Current Owned Classes</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {selectedFacultyAssignments.map(item => (
                            <div key={item.ownership.ownershipId} style={{ ...mono, fontSize: 10, color: T.text }}>
                              {item.offering?.code} · {item.offering?.dept} · {item.offering?.year} · Section {item.offering?.section} · owner
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
                <SectionHeading title="Timetable Planner" eyebrow="Calendar-First Review" caption="System admin starts with a calendar summary here, then expands into the full planner only when a wider review surface is needed." />
                {!selectedFacultyMember ? <EmptyState title="Select or create a faculty member first" body="Timetable planning becomes available once the faculty profile exists." /> : facultyCalendarLoading && !facultyCalendar ? (
                  <InfoBanner message="Loading timetable planner…" />
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <AdminMiniStat label="Mapped Classes" value={String(selectedFacultyCalendarOfferings.length)} tone={T.accent} />
                      <AdminMiniStat label="Weekly Blocks" value={String(facultyCalendarRecurringBlocks.length)} tone={T.success} />
                      <AdminMiniStat label="Exceptions" value={String(facultyCalendarExtraBlocks.length)} tone={T.warning} />
                      <AdminMiniStat label="Markers" value={String(sortedFacultyCalendarMarkers.length)} tone={T.orange} />
                    </div>

                    <Card style={{ padding: 16, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})`, display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ ...sora, fontSize: 15, fontWeight: 700, color: T.text }}>Planner Summary</div>
                          <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 6, lineHeight: 1.8 }}>
                            Review the institutional calendar state first, then open the expanded planner when you need the full weekly board without leaving the faculty workspace.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Chip color={facultyCalendar?.classEditingLocked ? T.danger : T.success}>{facultyCalendar?.classEditingLocked ? 'Recurring edits locked' : 'Recurring edits open'}</Chip>
                          <Chip color={facultyCalendar?.workspace.publishedAt ? T.accent : T.warning}>{facultyCalendar?.workspace.publishedAt ? `Published ${formatDate(facultyCalendar.workspace.publishedAt.slice(0, 10))}` : 'Not published'}</Chip>
                          <Btn type="button" size="sm" variant="primary" onClick={() => setShowFacultyTimetableExpanded(true)}>
                            Open Full Planner
                          </Btn>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                        <Card style={{ padding: 14, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming Markers</div>
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {sortedFacultyCalendarMarkers.slice(0, 4).map(marker => (
                              <div key={marker.markerId} style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.8 }}>
                                {marker.title} · {formatDate(marker.dateISO)}
                              </div>
                            ))}
                            {sortedFacultyCalendarMarkers.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No semester or event markers mapped yet.</div> : null}
                          </div>
                        </Card>
                        <Card style={{ padding: 14, background: T.surface }}>
                          <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Class Coverage</div>
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {selectedFacultyCalendarOfferings.slice(0, 4).map(offering => (
                              <div key={offering.offId} style={{ ...mono, fontSize: 10, color: T.text, lineHeight: 1.8 }}>
                                {offering.code} · {offering.year} · Section {offering.section}
                              </div>
                            ))}
                            {selectedFacultyCalendarOfferings.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.muted }}>No classes are currently assigned to this faculty member.</div> : null}
                          </div>
                        </Card>
                      </div>
                    </Card>

                    <AnimatePresence>
                      {showFacultyTimetableExpanded ? (
                        <ModalWorkspace
                          size="full"
                          eyebrow="Faculty Planner"
                          title={`${selectedFacultyMember.displayName} · Weekly Planner`}
                          caption="Use this full-screen planner review surface for weekly edits, then return to the faculty workspace when you are done."
                          onClose={() => setShowFacultyTimetableExpanded(false)}
                        >
                          <div style={{ display: 'grid', gap: 14, padding: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Btn type="button" variant="ghost" onClick={() => setShowFacultyTimetableExpanded(false)}>
                                <ChevronLeft size={14} /> Back to Faculty Workspace
                              </Btn>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Chip color={facultyCalendar?.classEditingLocked ? T.danger : T.success}>{facultyCalendar?.classEditingLocked ? 'Recurring edits locked' : 'Recurring edits open'}</Chip>
                                <Chip color={facultyCalendar?.workspace.publishedAt ? T.accent : T.warning}>{facultyCalendar?.workspace.publishedAt ? `Published ${formatDate(facultyCalendar.workspace.publishedAt.slice(0, 10))}` : 'Not published'}</Chip>
                              </div>
                            </div>
                            <div className="scroll-pane" style={{ minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                              <SystemAdminFacultyCalendarWorkspace
                                facultyId={selectedFacultyMember.facultyId}
                                facultyName={selectedFacultyMember.displayName}
                                offerings={selectedFacultyCalendarOfferings}
                                calendar={facultyCalendar}
                                onSave={handleSaveFacultyCalendar}
                              />
                            </div>
                          </div>
                        </ModalWorkspace>
                      ) : null}
                    </AnimatePresence>
                  </div>
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
          <div style={{ display: 'grid', gap: 16 }}>
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
      </motion.div>
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
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`request:${request.adminRequestId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
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
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`reminder:${reminder.reminderId}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
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
                    <button type="button" onClick={event => { event.stopPropagation(); dismissQueueItem(`hidden:${item.key}`) }} style={{ ...mono, fontSize: 10, color: T.dim, background: 'none', border: 'none', cursor: 'pointer' }}>Hide forever</button>
                  </div>
                }
              />
            ))}
            {visibleHiddenQueueItems.length === 0 ? <div style={{ ...mono, fontSize: 10, color: T.dim }}>Nothing hidden right now.</div> : null}
          </div>

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, ${fadeColor(T.surface, '00')} 0%, ${T.surface} 35%)` }}>
            {dismissedQueueItemKeys.length > 0 ? (
              <button type="button" onClick={clearDismissedQueueItems} style={{ width: '100%', marginBottom: 8, border: `1px solid ${T.border}`, borderRadius: 12, cursor: 'pointer', background: T.surface, color: T.muted, padding: '9px 12px', ...mono, fontSize: 10 }}>
                Restore Hidden Queue Items
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
                  <div><FieldLabel>Name</FieldLabel><TextInput aria-label="Student Name" value={studentForm.name} onChange={event => setStudentForm(prev => ({ ...prev, name: event.target.value }))} /></div>
                  <div><FieldLabel>USN</FieldLabel><TextInput aria-label="Student USN" value={studentForm.usn} onChange={event => setStudentForm(prev => ({ ...prev, usn: event.target.value }))} /></div>
                  <div><FieldLabel>Roll Number</FieldLabel><TextInput aria-label="Student Roll Number" value={studentForm.rollNumber} onChange={event => setStudentForm(prev => ({ ...prev, rollNumber: event.target.value }))} /></div>
                  <div><FieldLabel>Admission Date</FieldLabel><TextInput aria-label="Student Admission Date" value={studentForm.admissionDate} onChange={event => setStudentForm(prev => ({ ...prev, admissionDate: event.target.value }))} /></div>
                  <div><FieldLabel>Email</FieldLabel><TextInput aria-label="Student Email" value={studentForm.email} onChange={event => setStudentForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput aria-label="Student Phone" value={studentForm.phone} onChange={event => setStudentForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
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
                  <div><FieldLabel>Display Name</FieldLabel><TextInput aria-label="Faculty Display Name" value={facultyForm.displayName} onChange={event => setFacultyForm(prev => ({ ...prev, displayName: event.target.value }))} /></div>
                  <div><FieldLabel>Employee Code</FieldLabel><TextInput aria-label="Faculty Employee Code" value={facultyForm.employeeCode} onChange={event => setFacultyForm(prev => ({ ...prev, employeeCode: event.target.value }))} /></div>
                  <div><FieldLabel>Username</FieldLabel><TextInput aria-label="Faculty Username" value={facultyForm.username} onChange={event => setFacultyForm(prev => ({ ...prev, username: event.target.value }))} /></div>
                  <div><FieldLabel>Email</FieldLabel><TextInput aria-label="Faculty Email" value={facultyForm.email} onChange={event => setFacultyForm(prev => ({ ...prev, email: event.target.value }))} /></div>
                  <div><FieldLabel>Phone</FieldLabel><TextInput aria-label="Faculty Phone" value={facultyForm.phone} onChange={event => setFacultyForm(prev => ({ ...prev, phone: event.target.value }))} /></div>
                  <div><FieldLabel>Designation</FieldLabel><TextInput aria-label="Faculty Designation" value={facultyForm.designation} onChange={event => setFacultyForm(prev => ({ ...prev, designation: event.target.value }))} /></div>
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
                <div><FieldLabel>Faculty Code</FieldLabel><TextInput aria-label="Faculty Code" value={entityEditors.academicFaculty.code} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} /></div>
                <div><FieldLabel>Faculty Name</FieldLabel><TextInput aria-label="Faculty Name" value={entityEditors.academicFaculty.name} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} /></div>
                <div><FieldLabel>Overview</FieldLabel><TextAreaInput aria-label="Faculty Overview" value={entityEditors.academicFaculty.overview} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} rows={4} /></div>
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
                <div><FieldLabel>Department Code</FieldLabel><TextInput aria-label="Department Code" value={entityEditors.department.code} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} /></div>
                <div><FieldLabel>Department Name</FieldLabel><TextInput aria-label="Department Name" value={entityEditors.department.name} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} /></div>
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
                <div><FieldLabel>Branch Code</FieldLabel><TextInput aria-label="Branch Code" value={entityEditors.branch.code} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} /></div>
                <div><FieldLabel>Branch Name</FieldLabel><TextInput aria-label="Branch Name" value={entityEditors.branch.name} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} /></div>
                <div><FieldLabel>Program Level</FieldLabel><SelectInput aria-label="Branch Program Level" value={entityEditors.branch.programLevel} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}><option value="UG">UG</option><option value="PG">PG</option></SelectInput></div>
                <div><FieldLabel>Semester Count</FieldLabel><TextInput aria-label="Branch Semester Count" value={entityEditors.branch.semesterCount} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} /></div>
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
                <div><FieldLabel>Admission Year</FieldLabel><TextInput aria-label="Batch Admission Year" value={entityEditors.batch.admissionYear} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value } }))} /></div>
                <div><FieldLabel>Batch Label</FieldLabel><TextInput aria-label="Batch Label" value={entityEditors.batch.batchLabel} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, batchLabel: event.target.value } }))} /></div>
                <div><FieldLabel>Active Semester</FieldLabel><TextInput aria-label="Batch Active Semester" value={entityEditors.batch.currentSemester} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} /></div>
                <div><FieldLabel>Section Labels</FieldLabel><TextInput aria-label="Batch Section Labels" value={entityEditors.batch.sectionLabels} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} /></div>
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
