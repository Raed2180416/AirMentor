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
} from 'lucide-react'
import { AirMentorApiClient, AirMentorApiError } from './api/client'
import type {
  ApiAcademicFaculty,
  ApiAuditEvent,
  ApiAdminFacultyCalendar,
  ApiBatchProvisioningRequest,
  ApiBatch,
  ApiBranch,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumLinkageCandidate,
  ApiCurriculumLinkageGenerationStatus,
  ApiCurriculumFeatureConfigPayload,
  ApiDepartment,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiMentorAssignmentBulkApplyResponse,
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
  defaultRegistryFilter,
  compareAdminTimestampsDesc,
  deriveCurrentYearLabel,
  findLatestEnrollment,
  findLatestMentorAssignment,
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
  hydrateRegistryFilter,
  resolveAcademicFaculty,
  resolveBatch,
  resolveBranch,
  resolveDepartment,
  resolveFacultyMember,
  resolveStudent,
  searchLiveAdminWorkspace,
  type LiveAdminProofProvenance,
  type LiveAdminDataset,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
  type RegistryFilterState,
  type UniversityScopeState,
} from './system-admin-live-data'
import {
  computeOverviewScopedCounts,
  describeRegistryScope,
  isCurrentRoleGrant,
  isLeaderLikeOwnership,
  matchesFacultyScope,
  matchesStudentScope,
  type HierarchyScopeInput,
} from './system-admin-overview-helpers'
import { describeProofAvailability, describeProofProvenance } from './proof-provenance'
import {
  CANONICAL_PROOF_ROUTE,
  resolveAdminDirectoryScopeFilter,
  resolveAuthoritativeOperationalSemester,
  resolveCanonicalProofBatch,
  shouldResolveCanonicalProofRoute,
} from './proof-pilot'
import {
  buildBulkMentorAssignmentApplyPayload,
  buildBulkMentorAssignmentPreviewPayload,
  defaultBulkMentorAssignmentForm,
  describeBulkMentorPreview,
  getScopedMentorEligibleFaculty,
  type BulkMentorAssignmentFormState,
} from './system-admin-provisioning-helpers'
import {
  collectAdminQueueDismissKeys,
  mergeAdminQueueDismissKeys,
} from './system-admin-action-queue'
import {
  AdminBreadcrumbs,
  DayToggle,
  EmptyState,
  EntityButton,
  FieldLabel,
  HeroBadge,
  InfoBanner,
  ModalFrame,
  QueueBulkActions,
  RestoreBanner,
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
import { clearProofPlaybackSelection, readProofPlaybackSelection, writeProofPlaybackSelection } from './proof-playback'
import { emitClientOperationalEvent, normalizeClientTelemetryError } from './telemetry'
import { SystemAdminFacultyCalendarWorkspace } from './system-admin-faculty-calendar-workspace'
import {
  describeGovernanceRollbackMessage,
  SystemAdminFacultiesWorkspace,
} from './system-admin-faculties-workspace'
import { SystemAdminHistoryWorkspace } from './system-admin-history-workspace'
import { SystemAdminRequestWorkspace } from './system-admin-request-workspace'
import { SystemAdminSessionBoundary } from './system-admin-session-shell'
import {
  BrandMark,
  Btn,
  Card,
  Chip,
  ModalWorkspace,
  NotificationCountBadge,
  PageShell,
  UI_FONT_SIZES,
  getPrimaryActionButtonStyle,
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

const EMPTY_FACULTY_RECORDS: ApiFacultyRecord[] = []

export type PolicyFormState = {
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

export type EntityEditorState = {
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

function upsertLiveAdminItem<T>(items: T[], nextItem: T, matches: (item: T) => boolean) {
  return items.some(matches)
    ? items.map(item => matches(item) ? nextItem : item)
    : [nextItem, ...items]
}

export function readSubmittedField(form: HTMLFormElement, fieldName: string, fallback = '') {
  const value = new FormData(form).get(fieldName)
  return typeof value === 'string' ? value : fallback
}

export function shouldHydrateHierarchyEditor(editingEntity: EditingEntity | null, target: Extract<EditingEntity, 'academic-faculty' | 'department' | 'branch' | 'batch'>) {
  return editingEntity !== target
}

export function upsertAcademicFacultyRecord(data: LiveAdminDataset, nextFaculty: ApiAcademicFaculty): LiveAdminDataset {
  return {
    ...data,
    academicFaculties: upsertLiveAdminItem(
      data.academicFaculties,
      nextFaculty,
      item => item.academicFacultyId === nextFaculty.academicFacultyId,
    ),
  }
}

export function upsertDepartmentRecord(data: LiveAdminDataset, nextDepartment: ApiDepartment): LiveAdminDataset {
  return {
    ...data,
    departments: upsertLiveAdminItem(
      data.departments,
      nextDepartment,
      item => item.departmentId === nextDepartment.departmentId,
    ),
  }
}

export function upsertBranchRecord(data: LiveAdminDataset, nextBranch: ApiBranch): LiveAdminDataset {
  return {
    ...data,
    branches: upsertLiveAdminItem(
      data.branches,
      nextBranch,
      item => item.branchId === nextBranch.branchId,
    ),
  }
}

export function upsertBatchRecord(data: LiveAdminDataset, nextBatch: ApiBatch): LiveAdminDataset {
  return {
    ...data,
    batches: upsertLiveAdminItem(
      data.batches,
      nextBatch,
      item => item.batchId === nextBatch.batchId,
    ),
  }
}

export type StagePolicyFormState = {
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

export type BatchProvisioningFormState = {
  termId: string
  sectionLabels: string
  mode: ApiBatchProvisioningRequest['mode']
  studentsPerSection: string
  facultyPoolIds: string[]
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

// HierarchyScopeInput is now imported from './system-admin-overview-helpers'

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
const ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT = 1400

function applyFacultyVisibilityRules(facultyMembers: ApiFacultyRecord[]) {
  return [...facultyMembers].sort((left, right) => {
    const leftLabel = left.displayName.toLowerCase()
    const rightLabel = right.displayName.toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
}

type ProvenancedRecord = Partial<LiveAdminProofProvenance>

function hasRecordProofProvenance(record: ProvenancedRecord | null | undefined): record is LiveAdminProofProvenance {
  return !!record?.scopeDescriptor
    && !!record.resolvedFrom
    && !!record.scopeMode
    && !!record.countSource
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatRecordProofBanner(record: ProvenancedRecord | null | undefined) {
  if (!hasRecordProofProvenance(record)) return null
  return record.countSource === 'unavailable'
    ? describeProofAvailability(record)
    : describeProofProvenance(record)
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatFacultyGrantScopeLabel(grant: Pick<ApiRoleGrant, 'scopeLabel' | 'scopeType' | 'scopeId'>) {
  return grant.scopeLabel ?? `${grant.scopeType}:${grant.scopeId}`
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatFacultyAppointmentLabel(appointment: Pick<ApiFacultyAppointment, 'departmentId' | 'departmentName' | 'departmentCode' | 'branchId' | 'branchName' | 'branchCode'>) {
  const departmentLabel = appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId
  const branchLabel = appointment.branchName ?? appointment.branchCode ?? appointment.branchId
  return branchLabel ? `${departmentLabel} · ${branchLabel}` : departmentLabel
}

// eslint-disable-next-line react-refresh/only-export-components
export function parseAdminRoute(hash: string): LiveAdminRoute {
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
    facultyPoolIds: [],
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
    facultyPoolIds: form.facultyPoolIds.length > 0 ? [...form.facultyPoolIds] : undefined,
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

function normalizeAdminSectionCode(sectionCode: string) {
  return sectionCode.trim().toUpperCase()
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAdminSectionScopeId(batchId: string, sectionCode: string) {
  const normalizedBatchId = batchId.trim()
  const normalizedSectionCode = normalizeAdminSectionCode(sectionCode)
  if (!normalizedBatchId || !normalizedSectionCode) {
    throw new Error('Section scope ids require both a batch id and a section code.')
  }
  return `${normalizedBatchId}::${normalizedSectionCode}`
}

function parseAdminSectionScopeId(scopeId: string) {
  const [batchId, sectionCode, ...remainder] = scopeId.split('::')
  if (remainder.length > 0) return null
  const normalizedBatchId = batchId?.trim() ?? ''
  const normalizedSectionCode = normalizeAdminSectionCode(sectionCode ?? '')
  if (!normalizedBatchId || !normalizedSectionCode) return null
  return {
    batchId: normalizedBatchId,
    sectionCode: normalizedSectionCode,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAdminActiveScopeChain(input: {
  institution: LiveAdminDataset['institution']
  academicFaculty: ApiAcademicFaculty | null
  department: ApiDepartment | null
  branch: ApiBranch | null
  batch: ApiBatch | null
  sectionCode: string | null
}) {
  const chain: ActiveAdminScope[] = []
  if (input.institution) {
    chain.push({
      scopeType: 'institution',
      scopeId: input.institution.institutionId,
      label: input.institution.name,
    })
  }
  if (input.academicFaculty) {
    chain.push({
      scopeType: 'academic-faculty',
      scopeId: input.academicFaculty.academicFacultyId,
      label: input.academicFaculty.name,
    })
  }
  if (input.department) {
    chain.push({
      scopeType: 'department',
      scopeId: input.department.departmentId,
      label: input.department.name,
    })
  }
  if (input.branch) {
    chain.push({
      scopeType: 'branch',
      scopeId: input.branch.branchId,
      label: input.branch.name,
    })
  }
  if (input.batch) {
    chain.push({
      scopeType: 'batch',
      scopeId: input.batch.batchId,
      label: `Batch ${input.batch.batchLabel}`,
    })
  }
  if (input.batch && input.sectionCode) {
    chain.push({
      scopeType: 'section',
      scopeId: buildAdminSectionScopeId(input.batch.batchId, input.sectionCode),
      label: `Section ${normalizeAdminSectionCode(input.sectionCode)}`,
    })
  }
  return chain
}

// describeRegistryScope is now imported from './system-admin-overview-helpers'

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

// isLeaderLikeOwnership and isCurrentRoleGrant are now imported from './system-admin-overview-helpers'

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

// eslint-disable-next-line react-refresh/only-export-components
export function getAdminWorkspaceSnapshotKey(snapshot: Omit<AdminWorkspaceSnapshot, 'scrollY'> | AdminWorkspaceSnapshot) {
  return `${routeToHash(snapshot.route)}::${snapshot.universityTab}::${snapshot.selectedSectionCode ?? ''}`
}

// matchesStudentScope, matchesFacultyScope, and matchesOfferingScope are now imported from './system-admin-overview-helpers'

function matchesBatchScope(batch: LiveAdminDataset['batches'][number], data: LiveAdminDataset, scopeType: ApiScopeType, scopeId: string) {
  if (scopeType === 'institution') return true
  if (scopeType === 'batch') return batch.batchId === scopeId
  if (scopeType === 'section') return parseAdminSectionScopeId(scopeId)?.batchId === batch.batchId
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
  showActionQueue,
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
  showActionQueue: boolean
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
          <button
            type="button"
            aria-label={showActionQueue ? 'Hide action queue' : 'Show action queue'}
            title={showActionQueue ? 'Hide action queue' : 'Show action queue'}
            onClick={onToggleQueue}
            style={{ ...getIconButtonStyle({ active: showActionQueue }), color: showActionQueue ? T.accent : T.muted, position: 'relative' }}
          >
            <Bell size={14} />
            {actionCount > 0 ? <NotificationCountBadge count={actionCount} /> : null}
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

export function ActionQueueCard({
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
  const primaryContent = (
    <>
      <span style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text, display: 'block' }}>{title}</span>
      <span style={{ ...mono, fontSize: UI_FONT_SIZES.eyebrow, color: T.muted, marginTop: 4, lineHeight: 1.7, display: 'block' }}>{subtitle}</span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {chips.map(chip => <Chip key={chip} color={tone} size={9}>{chip}</Chip>)}
      </span>
    </>
  )

  return (
    <Card data-action-queue-card="true" style={{ padding: 12, background: `linear-gradient(180deg, ${T.surface2}, ${T.surface})` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        {onClick
          ? (
            <button
              type="button"
              data-action-queue-primary="true"
              onClick={onClick}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {primaryContent}
            </button>
          )
          : <div style={{ flex: 1, minWidth: 0 }}>{primaryContent}</div>}
        {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
      </div>
    </Card>
  )
}

export function AdminDetailTabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel = 'Admin detail sections',
  idBase = 'admin-detail',
}: {
  tabs: Array<{ id: string; label: string; count?: string | number; disabled?: boolean }>
  activeTab: string
  onChange: (tabId: string) => void
  ariaLabel?: string
  idBase?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ ...getSegmentedGroupStyle(), flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', alignItems: 'center', justifyContent: 'flex-start', rowGap: 6 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          id={`${idBase}-tab-${tab.id}`}
          role="tab"
          aria-controls={`${idBase}-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
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

export function AdminDetailTabPanel({
  idBase,
  tabId,
  children,
}: {
  idBase: string
  tabId: string
  children: ReactNode
}) {
  return (
    <div
      id={`${idBase}-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`${idBase}-tab-${tabId}`}
    >
      {children}
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
  const [scopedDirectoryStudents, setScopedDirectoryStudents] = useState<ApiStudentRecord[] | null>(null)
  const [scopedDirectoryFacultyMembers, setScopedDirectoryFacultyMembers] = useState<ApiFacultyRecord[] | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [flashMessage, setFlashMessage] = useState('')
  const [curriculumProofRefreshRetry, setCurriculumProofRefreshRetry] = useState<{
    batchIds: string[]
    curriculumImportVersionId: string | null
    message: string
  } | null>(null)
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
  const [facultiesRestoreNotice, setFacultiesRestoreNotice] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null)
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
  const [curriculumLinkageCandidates, setCurriculumLinkageCandidates] = useState<ApiCurriculumLinkageCandidate[]>([])
  const [curriculumLinkageGenerationStatus, setCurriculumLinkageGenerationStatus] = useState<ApiCurriculumLinkageGenerationStatus | null>(null)
  const [curriculumLinkageCandidatesLoading, setCurriculumLinkageCandidatesLoading] = useState(false)
  const [curriculumLinkageReviewNote, setCurriculumLinkageReviewNote] = useState('')
  const [selectedCurriculumFeatureCourseId, setSelectedCurriculumFeatureCourseId] = useState('')
  const [selectedCurriculumSemester, setSelectedCurriculumSemester] = useState('')
  const [selectedCurriculumCourseId, setSelectedCurriculumCourseId] = useState('')
  const [curriculumFeatureForm, setCurriculumFeatureForm] = useState<CurriculumFeatureFormState>(() => defaultCurriculumFeatureForm())
  const [curriculumFeatureTargetMode, setCurriculumFeatureTargetMode] = useState<'batch-local-override' | 'scope-profile'>('batch-local-override')
  const [curriculumFeatureTargetScopeKey, setCurriculumFeatureTargetScopeKey] = useState('')
  const [curriculumFeatureBindingMode, setCurriculumFeatureBindingMode] = useState<'inherit-scope-profile' | 'pin-profile' | 'local-only'>('inherit-scope-profile')
  const [curriculumFeaturePinnedProfileId, setCurriculumFeaturePinnedProfileId] = useState('')
  const [batchProvisioningForm, setBatchProvisioningForm] = useState<BatchProvisioningFormState>(() => defaultBatchProvisioningForm())
  const [bulkMentorAssignmentForm, setBulkMentorAssignmentForm] = useState<BulkMentorAssignmentFormState>(() => defaultBulkMentorAssignmentForm())
  const [bulkMentorAssignmentPreview, setBulkMentorAssignmentPreview] = useState<ApiMentorAssignmentBulkApplyResponse | null>(null)
  const [selectedStageOfferingId, setSelectedStageOfferingId] = useState('')
  const [selectedStageEligibility, setSelectedStageEligibility] = useState<ApiOfferingStageEligibility | null>(null)
  const [selectedProofCheckpointId, setSelectedProofCheckpointId] = useState<string | null>(() => readProofPlaybackSelection()?.simulationStageCheckpointId ?? null)
  const [selectedProofCheckpointSource, setSelectedProofCheckpointSource] = useState<'auto' | 'restored' | 'manual'>(() => readProofPlaybackSelection() ? 'restored' : 'auto')
  const [proofPlaybackRestoreNotice, setProofPlaybackRestoreNotice] = useState<{ tone: 'neutral' | 'error'; message: string } | null>(null)
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
  const scopedAdminDirectoryFilter = useMemo(
    () => resolveAdminDirectoryScopeFilter({
      route,
      registryScope,
      selectedSectionCode,
    }),
    [registryScope, route, selectedSectionCode],
  )

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

  const restoreAllHiddenQueueItems = useCallback(() => {
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
      setFacultiesRestoreNotice(null)
      return
    }
    const storageKey = `airmentor-admin-ui:${routeToHash(route)}`
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      setFacultiesRestoreNotice(null)
      return
    }
    try {
      const parsed = JSON.parse(raw) as { tab?: typeof universityTab; sectionCode?: string | null }
      setUniversityTab(parsed.tab ?? 'overview')
      setSelectedSectionCode(parsed.sectionCode ?? null)
      setFacultiesRestoreNotice({
        tone: 'neutral',
        message: 'Faculties workspace state was restored from your last sysadmin session. Use Reset workspace to return to the default University overview.',
      })
    } catch {
      setSelectedSectionCode(null)
      setUniversityTab('overview')
      setFacultiesRestoreNotice({
        tone: 'error',
        message: 'Saved faculties workspace state could not be restored. Reset workspace to return to the default University overview.',
      })
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
        emitClientOperationalEvent('auth.session.restored', {
          workspace: 'system-admin',
          sessionId: restored.sessionId,
          facultyId: restored.faculty?.facultyId ?? null,
          activeRole: restored.activeRoleGrant.roleCode,
        })
        if (!cancelled) setSession(restored)
      } catch (error) {
        if (!(error instanceof AirMentorApiError && error.status === 401)) {
          emitClientOperationalEvent('auth.session.restore_failed', {
            workspace: 'system-admin',
            error: normalizeClientTelemetryError(error),
          }, { level: 'warn' })
        }
        if (!cancelled) setSession(null)
      }
      finally { if (!cancelled) setBooting(false) }
    })()
    return () => { cancelled = true }
  }, [apiClient])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    void loadAdminData()
  }, [loadAdminData, session])

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setScopedDirectoryStudents(null)
      setScopedDirectoryFacultyMembers(null)
      return
    }
    if (!scopedAdminDirectoryFilter || !hasHierarchyScopeSelection(scopedAdminDirectoryFilter)) {
      setScopedDirectoryStudents(null)
      setScopedDirectoryFacultyMembers(null)
      return
    }
    let cancelled = false
    setScopedDirectoryStudents(null)
    setScopedDirectoryFacultyMembers(null)
    void (async () => {
      try {
        const [facultyResponse, studentsResponse] = await Promise.all([
          apiClient.listFaculty(scopedAdminDirectoryFilter),
          apiClient.listStudents(scopedAdminDirectoryFilter),
        ])
        if (cancelled) return
        setScopedDirectoryFacultyMembers(applyFacultyVisibilityRules(facultyResponse.items))
        setScopedDirectoryStudents(studentsResponse.items)
      } catch (error) {
        if (cancelled) return
        setScopedDirectoryStudents(null)
        setScopedDirectoryFacultyMembers(null)
        setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, scopedAdminDirectoryFilter, session])

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
        const next = await apiClient.getResolvedBatchPolicy(route.batchId!, { sectionCode: selectedSectionCode })
        if (cancelled) return
        setResolvedBatchPolicy(next)
        setPolicyForm(hydratePolicyForm(next.effectivePolicy))
      } catch (error) { if (!cancelled) setActionError(toErrorMessage(error)) }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, selectedSectionCode, session])

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setResolvedStagePolicy(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await apiClient.getResolvedStagePolicy(route.batchId!, { sectionCode: selectedSectionCode })
        if (cancelled) return
        setResolvedStagePolicy(next)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, route.batchId, selectedSectionCode, session])

  const refreshCurriculumFeatureConfig = useCallback(async (batchId: string) => {
    const next = await apiClient.getCurriculumFeatureConfig(batchId)
    setCurriculumFeatureConfig(next)
    return next
  }, [apiClient])

  const refreshCurriculumLinkageCandidates = useCallback(async (batchId: string) => {
    setCurriculumLinkageCandidatesLoading(true)
    try {
      const next = await apiClient.listCurriculumLinkageCandidates(batchId)
      setCurriculumLinkageCandidates(next.items)
      return next.items
    } finally {
      setCurriculumLinkageCandidatesLoading(false)
    }
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

  const getQueuedProofRefreshCount = useCallback((value: unknown) => {
    if (!value || typeof value !== 'object') return 0
    const proofRefresh = (value as { proofRefresh?: { queuedSimulationRunIds?: unknown } }).proofRefresh
    if (!proofRefresh || !Array.isArray(proofRefresh.queuedSimulationRunIds)) return 0
    return proofRefresh.queuedSimulationRunIds.length
  }, [])

  const queueProofRefreshBatches = useCallback(async (batchIds: string[], reason: string, overrideImportVersionId?: string | null) => {
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
        runLabel: `${activeRun?.runLabel ?? 'Sysadmin refresh'} · ${reason}`,
        activate: true,
      })
      refreshedBatchIds.push(batchId)
      if (batchId === route.batchId) {
        await refreshProofDashboard(batchId)
      }
    }
    return refreshedBatchIds
  }, [apiClient, curriculumFeatureConfig, proofDashboard, refreshProofDashboard, route.batchId])

  const queueSelectedProofRefresh = useCallback(async (reason: string, curriculumImportVersionId?: string | null) => {
    if (!route.batchId) return []
    return queueProofRefreshBatches([route.batchId], reason, curriculumImportVersionId)
  }, [queueProofRefreshBatches, route.batchId])

  useEffect(() => {
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setCurriculumFeatureConfig(null)
      setCurriculumLinkageCandidates([])
      setCurriculumLinkageGenerationStatus(null)
      setCurriculumLinkageReviewNote('')
      setCurriculumProofRefreshRetry(null)
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
    if (!route.batchId || !session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') {
      setCurriculumLinkageCandidates([])
      setCurriculumLinkageGenerationStatus(null)
      setCurriculumLinkageCandidatesLoading(false)
      return
    }
    let cancelled = false
    setCurriculumLinkageCandidatesLoading(true)
    void (async () => {
      try {
        const next = await apiClient.listCurriculumLinkageCandidates(route.batchId!)
        if (cancelled) return
        setCurriculumLinkageCandidates(next.items)
      } catch (error) {
        if (!cancelled) setActionError(toErrorMessage(error))
      } finally {
        if (!cancelled) setCurriculumLinkageCandidatesLoading(false)
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

  const curriculumFeatureBinding = curriculumFeatureConfig?.binding ?? null

  useEffect(() => {
    const binding = curriculumFeatureBinding
    setCurriculumFeatureBindingMode(binding?.bindingMode ?? 'inherit-scope-profile')
    setCurriculumFeaturePinnedProfileId(binding?.curriculumFeatureProfileId ?? '')
  }, [curriculumFeatureBinding])

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
  const canonicalProofBatch = useMemo(() => resolveCanonicalProofBatch(data), [data.batches])
  const activeRunDetail = proofDashboard?.activeRunDetail ?? null
  const { semester: authoritativeOperationalSemester, source: authoritativeOperationalSemesterSource } = resolveAuthoritativeOperationalSemester({
    route,
    selectedBatch,
    activeOperationalSemester: activeRunDetail?.activeOperationalSemester ?? null,
  })
  const activeSimulationRunId = activeRunDetail?.simulationRunId ?? null
  const activeRunCheckpoints = useMemo(
    () => activeRunDetail?.checkpoints ?? [],
    [activeRunDetail?.checkpoints],
  )
  const activeModelDiagnostics = activeRunDetail?.modelDiagnostics ?? null
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

  useEffect(() => {
    if (!session || session.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN') return
    if (!shouldResolveCanonicalProofRoute(route, { batches: data.batches })) return
    navigate({
      ...CANONICAL_PROOF_ROUTE,
      batchId: canonicalProofBatch?.batchId ?? CANONICAL_PROOF_ROUTE.batchId,
    }, { recordHistory: false })
  }, [canonicalProofBatch?.batchId, data.batches, navigate, route, session])
  const activeDiagnosticsQueueBurden = readRecordField(activeProductionEvaluation, 'queueBurdenSummary')
    ?? readRecordField(activeChallengerEvaluation, 'queueBurdenSummary')
    ?? activeModelDiagnostics?.queueBurdenSummary
  const selectedProofCheckpoint = useMemo<ApiSimulationStageCheckpointSummary | null>(() => {
    if (activeRunCheckpoints.length === 0) return null
    if (!selectedProofCheckpointId) return activeRunCheckpoints[0] ?? null
    return activeRunCheckpoints.find(item => item.simulationStageCheckpointId === selectedProofCheckpointId) ?? activeRunCheckpoints[0] ?? null
  }, [activeRunCheckpoints, selectedProofCheckpointId])
  const defaultProofPlaybackCheckpointId = useMemo(() => (
    activeRunCheckpoints.find(item => item.playbackAccessible !== false && item.stageAdvanceBlocked !== true && (item.blockingQueueItemCount ?? item.openQueueCount ?? 0) === 0)?.simulationStageCheckpointId
    ?? activeRunCheckpoints[0]?.simulationStageCheckpointId
    ?? null
  ), [activeRunCheckpoints])
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
  ), [activeRunCheckpoints, selectedProofCheckpoint])
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

  useEffect(() => {
    if (!activeSimulationRunId || !selectedProofCheckpoint) return
    emitClientOperationalEvent('proof.checkpoint.readiness', {
      workspace: 'system-admin',
      simulationRunId: activeSimulationRunId,
      simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
      stageLabel: selectedProofCheckpoint.stageLabel,
      playbackAccessible: selectedProofCheckpoint.playbackAccessible !== false,
      stageAdvanceBlocked: selectedProofCheckpoint.stageAdvanceBlocked === true,
      blockingQueueItemCount: selectedProofCheckpoint.blockingQueueItemCount ?? selectedProofCheckpoint.openQueueCount ?? 0,
      canStepForward: selectedProofCheckpointCanStepForward,
      canPlayToEnd: selectedProofCheckpointCanPlayToEnd,
    }, {
      level: selectedProofCheckpointBlocked || selectedProofCheckpointHasBlockedProgression ? 'warn' : 'info',
    })
  }, [
    activeSimulationRunId,
    selectedProofCheckpoint,
    selectedProofCheckpointBlocked,
    selectedProofCheckpointCanPlayToEnd,
    selectedProofCheckpointCanStepForward,
    selectedProofCheckpointHasBlockedProgression,
  ])

  const studentRegistryScope = useMemo(
    () => toRegistrySearchScope(studentRegistryFilter),
    [studentRegistryFilter],
  )
  const facultyRegistryScope = useMemo(
    () => toRegistrySearchScope(facultyRegistryFilter),
    [facultyRegistryFilter],
  )
  const studentRegistryHasScope = hasHierarchyScopeSelection(studentRegistryScope)
  const selectedStudentRecord = resolveStudent(data, route.studentId)
  const selectedStudent = selectedStudentRecord && isStudentVisible(data, selectedStudentRecord)
    ? selectedStudentRecord
    : null
  const selectedStudentActiveAcademicContext = selectedStudent?.activeAcademicContext ?? null
  const selectedStudentPolicyBatchId = selectedStudentActiveAcademicContext?.batchId ?? null
  const selectedStudentPolicySectionCode = selectedStudentActiveAcademicContext?.sectionCode ?? null
  const selectedFacultyRecord = resolveFacultyMember(data, route.facultyMemberId)
  const selectedFacultyMember = selectedFacultyRecord && isFacultyMemberVisible(data, selectedFacultyRecord)
    ? selectedFacultyRecord
    : null
  const selectedFacultyId = selectedFacultyMember?.facultyId ?? null
  const selectedStudentProofBanner = formatRecordProofBanner(selectedStudent as unknown as ProvenancedRecord | null)
  const selectedFacultyProofBanner = formatRecordProofBanner(selectedFacultyMember as unknown as ProvenancedRecord | null)
  const selectedStudentRouteIsExplicit = route.section === 'students' && !!route.studentId
  const selectedStudentScopeMismatch = !!selectedStudent && studentRegistryHasScope && !matchesStudentScope(selectedStudent, data, studentRegistryScope)

  useEffect(() => {
    if (!activeSimulationRunId || activeRunCheckpoints.length === 0) {
      setSelectedProofCheckpointDetail(null)
      setProofPlaybackRestoreNotice(null)
      return
    }
    const persistedSelection = readProofPlaybackSelection()
    const currentSelectionValid = !!selectedProofCheckpointId && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === selectedProofCheckpointId)
    const persistedCheckpointId = persistedSelection?.simulationRunId === activeSimulationRunId
      ? persistedSelection.simulationStageCheckpointId
      : null
    const persistedCheckpointValid = !!persistedCheckpointId && activeRunCheckpoints.some(item => item.simulationStageCheckpointId === persistedCheckpointId)

    if (currentSelectionValid) {
      if (selectedProofCheckpointSource === 'restored') {
        const restoredCheckpoint = activeRunCheckpoints.find(item => item.simulationStageCheckpointId === selectedProofCheckpointId) ?? null
        if (restoredCheckpoint) {
          const nextMessage = `Proof playback restored to Semester ${restoredCheckpoint.semesterNumber} · ${restoredCheckpoint.stageLabel}. Use Reset playback to clear the saved checkpoint.`
          setProofPlaybackRestoreNotice(current => current?.tone === 'neutral' && current.message === nextMessage
            ? current
            : { tone: 'neutral', message: nextMessage })
        }
      } else {
        setProofPlaybackRestoreNotice(current => current?.tone === 'error' ? current : null)
      }
      return
    }

    if (persistedCheckpointValid && persistedCheckpointId) {
      setSelectedProofCheckpointId(persistedCheckpointId)
      setSelectedProofCheckpointSource('restored')
      const restoredCheckpoint = activeRunCheckpoints.find(item => item.simulationStageCheckpointId === persistedCheckpointId) ?? null
      if (restoredCheckpoint) {
        const nextMessage = `Proof playback restored to Semester ${restoredCheckpoint.semesterNumber} · ${restoredCheckpoint.stageLabel}. Use Reset playback to clear the saved checkpoint.`
        setProofPlaybackRestoreNotice(current => current?.tone === 'neutral' && current.message === nextMessage
          ? current
          : { tone: 'neutral', message: nextMessage })
      }
      return
    }

    if (persistedSelection?.simulationStageCheckpointId) {
      clearProofPlaybackSelection()
      setProofPlaybackRestoreNotice({
        tone: 'error',
        message: 'Saved proof playback checkpoint is no longer available in this academic scope. Reset playback to return to the active proof-run view.',
      })
    } else {
      setProofPlaybackRestoreNotice(current => current?.tone === 'error' ? current : null)
    }
    setSelectedProofCheckpointSource('auto')
    setSelectedProofCheckpointId(defaultProofPlaybackCheckpointId)
  }, [activeRunCheckpoints, activeSimulationRunId, defaultProofPlaybackCheckpointId, selectedProofCheckpointId, selectedProofCheckpointSource])

  useEffect(() => {
    if (!activeSimulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) {
      setSelectedProofCheckpointDetail(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const detail = await apiClient.getProofRunCheckpointDetail(
          activeSimulationRunId,
          selectedProofCheckpoint.simulationStageCheckpointId,
        )
        if (!cancelled) setSelectedProofCheckpointDetail(detail)
      } catch (error) {
        emitClientOperationalEvent('proof.checkpoint.detail_load_failed', {
          workspace: 'system-admin',
          simulationRunId: activeSimulationRunId,
          simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        if (cancelled) return
        if (error instanceof AirMentorApiError && error.status === 404) {
          setSelectedProofCheckpointDetail(null)
          return
        }
        setActionError(toErrorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSimulationRunId, apiClient, selectedProofCheckpoint])

  useEffect(() => {
    if (selectedProofCheckpointSource !== 'manual') return
    if (!proofDashboard?.activeRunDetail?.simulationRunId || !selectedProofCheckpoint?.simulationStageCheckpointId) return
    writeProofPlaybackSelection({
      simulationRunId: proofDashboard.activeRunDetail.simulationRunId,
      simulationStageCheckpointId: selectedProofCheckpoint.simulationStageCheckpointId,
      updatedAt: new Date().toISOString(),
    })
  }, [proofDashboard?.activeRunDetail?.simulationRunId, selectedProofCheckpoint?.simulationStageCheckpointId, selectedProofCheckpointSource])

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
        ? studentRegistryScope
        : route.section === 'faculty-members'
          ? (hasHierarchyScopeSelection(facultyRegistryScope) ? facultyRegistryScope : null)
          : {
              academicFacultyId: toOptionalScopeValue(registryScope?.academicFacultyId),
              departmentId: toOptionalScopeValue(registryScope?.departmentId),
              branchId: toOptionalScopeValue(registryScope?.branchId),
              batchId: toOptionalScopeValue(registryScope?.batchId),
              sectionCode: toOptionalScopeValue(registryScope?.sectionCode),
            }
    if (!query) {
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
    setActionError('That student is no longer available in the active workspace.')
    navigate({ section: 'students' }, { recordHistory: false })
  }, [data.students.length, dataLoading, navigate, route.section, route.studentId, selectedStudent, session])

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
        ? studentRegistryScope
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
  }, [data, deferredSearch, facultyRegistryScope, registryScope?.academicFacultyId, registryScope?.batchId, registryScope?.branchId, registryScope?.departmentId, registryScope?.sectionCode, route.academicFacultyId, route.batchId, route.branchId, route.departmentId, route.section, selectedSectionCode, serverSearchResults, studentRegistryScope])
  const selectedRequest = selectedRequestDetail && selectedRequestSummary && selectedRequestDetail.version !== selectedRequestSummary.version
    ? selectedRequestSummary
    : (selectedRequestDetail ?? selectedRequestSummary)
  const requestDetail = selectedRequestDetail && selectedRequest?.adminRequestId === selectedRequestDetail.adminRequestId ? selectedRequestDetail : null

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'academic-faculty')) return
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
  }, [editingEntity, selectedAcademicFaculty])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'department')) return
    setEntityEditors(prev => ({
      ...prev,
      department: selectedDepartment
        ? {
            code: selectedDepartment.code,
            name: selectedDepartment.name,
          }
        : defaultEntityEditorState().department,
    }))
  }, [editingEntity, selectedDepartment])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'branch')) return
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
  }, [editingEntity, selectedBranch])

  useEffect(() => {
    if (!shouldHydrateHierarchyEditor(editingEntity, 'batch')) return
    const nextSemester = String(authoritativeOperationalSemester ?? selectedBatch?.currentSemester ?? 1)
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
      term: defaultEntityEditorState(nextSemester).term,
      curriculum: defaultEntityEditorState(nextSemester).curriculum,
    }))
  }, [authoritativeOperationalSemester, editingEntity, selectedBatch])

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
    if (!selectedStudentPolicyBatchId) {
      setSelectedStudentPolicy(null)
      setSelectedStudentPolicyLoading(false)
      return
    }
    let cancelled = false
    setSelectedStudentPolicyLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getResolvedBatchPolicy(selectedStudentPolicyBatchId, { sectionCode: selectedStudentPolicySectionCode })
        if (!cancelled) setSelectedStudentPolicy(next)
      } catch {
        if (!cancelled) setSelectedStudentPolicy(null)
      } finally {
        if (!cancelled) setSelectedStudentPolicyLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedStudentPolicyBatchId, selectedStudentPolicySectionCode])

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
    if (!selectedFacultyId) {
      setFacultyCalendar(null)
      setFacultyCalendarLoading(false)
      return
    }
    let cancelled = false
    setFacultyCalendarLoading(true)
    void (async () => {
      try {
        const next = await apiClient.getAdminFacultyCalendar(selectedFacultyId)
        if (!cancelled) setFacultyCalendar(next)
      } catch {
        if (!cancelled) setFacultyCalendar(null)
      } finally {
        if (!cancelled) setFacultyCalendarLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [apiClient, selectedFacultyId])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true); setAuthError('')
    try {
      await apiClient.login({ identifier, password })
      const nextSession = await settleCookieBackedSession('login')
      setSession(nextSession); setIdentifier(''); setPassword('')
    } catch (error) {
      setAuthError(toErrorMessage(error))
    }
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
    catch (error) {
      setAuthError(toErrorMessage(error))
    }
    finally { setAuthBusy(false) }
  }

  const runAction = useCallback(async <T,>(runner: () => Promise<T>) => {
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
  }, [loadAdminData])

  const retryCurriculumProofRefresh = useCallback(async () => {
    if (!curriculumProofRefreshRetry) return
    await runAction(async () => {
      const refreshed = await queueProofRefreshBatches(
        curriculumProofRefreshRetry.batchIds,
        'curriculum-proof-refresh-retry',
        curriculumProofRefreshRetry.curriculumImportVersionId,
      )
      setCurriculumProofRefreshRetry(null)
      setFlashMessage(
        refreshed.length > 0
          ? `Proof refresh retried for ${refreshed.length} affected batch${refreshed.length === 1 ? '' : 'es'}.`
          : 'Proof refresh retry did not need to queue a new run.',
      )
    })
  }, [curriculumProofRefreshRetry, queueProofRefreshBatches, runAction])

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
      term: defaultEntityEditorState(String(authoritativeOperationalSemester ?? 1)).term,
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
      curriculum: defaultEntityEditorState(selectedCurriculumSemester || String(authoritativeOperationalSemester ?? 1)).curriculum,
    }))
  }

  const handleUpdateAcademicFaculty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.updateAcademicFaculty(selectedAcademicFaculty.academicFacultyId, {
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', entityEditors.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', entityEditors.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', entityEditors.academicFaculty.overview).trim() || null,
        status: selectedAcademicFaculty.status,
        version: selectedAcademicFaculty.version,
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setFlashMessage('Academic faculty updated.')
    setEditingEntity(null)
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
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.updateDepartment(selectedDepartment.departmentId, {
        academicFacultyId: selectedAcademicFaculty?.academicFacultyId ?? null,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', entityEditors.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', entityEditors.department.name)),
        status: selectedDepartment.status,
        version: selectedDepartment.version,
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setFlashMessage('Department updated.')
    setEditingEntity(null)
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
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.updateBranch(selectedBranch.branchId, {
        departmentId: selectedBranch.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', entityEditors.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', entityEditors.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', entityEditors.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', entityEditors.branch.semesterCount)),
        status: selectedBranch.status,
        version: selectedBranch.version,
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setFlashMessage('Branch updated.')
    setEditingEntity(null)
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
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', entityEditors.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.updateBatch(selectedBatch.batchId, {
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', entityEditors.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', entityEditors.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', entityEditors.batch.currentSemester)),
        sectionLabels,
        status: selectedBatch.status,
        version: selectedBatch.version,
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setFlashMessage('Batch updated.')
    setEditingEntity(null)
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
    const form = event.currentTarget
    const nextAcademicFaculty = await runAction(async () => apiClient.createAcademicFaculty({
        code: requireText('Faculty code', readSubmittedField(form, 'academicFacultyCode', structureForms.academicFaculty.code)),
        name: requireText('Faculty name', readSubmittedField(form, 'academicFacultyName', structureForms.academicFaculty.name)),
        overview: readSubmittedField(form, 'academicFacultyOverview', structureForms.academicFaculty.overview).trim() || null,
        status: 'active',
      }))
    if (!nextAcademicFaculty) return
    setData(prev => upsertAcademicFacultyRecord(prev, nextAcademicFaculty))
    setStructureForms(prev => ({ ...prev, academicFaculty: { code: '', name: '', overview: '' } }))
    setFlashMessage('Academic faculty created.')
  }

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAcademicFaculty) return
    const form = event.currentTarget
    const nextDepartment = await runAction(async () => apiClient.createDepartment({
        academicFacultyId: selectedAcademicFaculty.academicFacultyId,
        code: requireText('Department code', readSubmittedField(form, 'departmentCode', structureForms.department.code)),
        name: requireText('Department name', readSubmittedField(form, 'departmentName', structureForms.department.name)),
        status: 'active',
      }))
    if (!nextDepartment) return
    setData(prev => upsertDepartmentRecord(prev, nextDepartment))
    setStructureForms(prev => ({ ...prev, department: { code: '', name: '' } }))
    setFlashMessage('Department created.')
  }

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDepartment) return
    const form = event.currentTarget
    const nextBranch = await runAction(async () => apiClient.createBranch({
        departmentId: selectedDepartment.departmentId,
        code: requireText('Branch code', readSubmittedField(form, 'branchCode', structureForms.branch.code)),
        name: requireText('Branch name', readSubmittedField(form, 'branchName', structureForms.branch.name)),
        programLevel: requireText('Program level', readSubmittedField(form, 'branchProgramLevel', structureForms.branch.programLevel)),
        semesterCount: requirePositiveEvenInteger('Semester count', readSubmittedField(form, 'branchSemesterCount', structureForms.branch.semesterCount)),
        status: 'active',
      }))
    if (!nextBranch) return
    setData(prev => upsertBranchRecord(prev, nextBranch))
    setStructureForms(prev => ({ ...prev, branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' } }))
    setFlashMessage('Branch created.')
  }

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedBranch) return
    const form = event.currentTarget
    const nextBatch = await runAction(async () => {
      const sectionLabels = readSubmittedField(form, 'batchSectionLabels', structureForms.batch.sectionLabels).split(',').map(item => item.trim()).filter(Boolean)
      if (sectionLabels.length === 0) throw new Error('At least one batch section label is required.')
      return apiClient.createBatch({
        branchId: selectedBranch.branchId,
        admissionYear: requirePositiveInteger('Admission year', readSubmittedField(form, 'batchAdmissionYear', structureForms.batch.admissionYear)),
        batchLabel: requireText('Batch label', readSubmittedField(form, 'batchLabel', structureForms.batch.batchLabel)),
        currentSemester: requirePositiveInteger('Active semester', readSubmittedField(form, 'batchCurrentSemester', structureForms.batch.currentSemester)),
        sectionLabels,
        status: 'active',
      })
    })
    if (!nextBatch) return
    setData(prev => upsertBatchRecord(prev, nextBatch))
    setStructureForms(prev => ({ ...prev, batch: { admissionYear: '2022', batchLabel: '2022', currentSemester: '1', sectionLabels: 'A, B' } }))
    setFlashMessage('Batch created.')
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
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(`Curriculum course saved for ${courseCodeForRefresh}. Any required proof refresh is now queued by the backend.`)
    })
  }

  const handleBootstrapCurriculumManifest = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      const result = await apiClient.bootstrapCurriculum(selectedBatch.batchId, { manifestKey: 'msruas-mnc-seed' })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await loadAdminData()
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        queuedCount > 0
          ? `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, generated ${result.generatedCandidateCount} linkage candidates, and queued ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'}.${generationNote}`
          : `Bootstrap imported ${result.createdCourseCount} live course rows, synced ${result.upsertedProfileCourseCount} profile items, and generated ${result.generatedCandidateCount} linkage candidates.${generationNote}`,
      )
    })
  }

  const handleRegenerateCurriculumLinkageCandidates = async () => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.regenerateCurriculumLinkageCandidates(selectedBatch.batchId, {
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.regeneration_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.regenerated', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumCourseId: selectedCurriculumFeatureItem?.curriculumCourseId ?? null,
        generatedCount: result.items.length,
        candidateGenerationStatus: result.candidateGenerationStatus.status,
      })
      setCurriculumLinkageGenerationStatus(result.candidateGenerationStatus)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const generationNote = result.candidateGenerationStatus.status === 'ok'
        ? ''
        : ` Candidate generation ran in ${result.candidateGenerationStatus.status} mode via ${result.candidateGenerationStatus.provider.replace('-', ' ')}.`
      setFlashMessage(
        result.items.length > 0
          ? `Regenerated ${result.items.length} linkage candidate${result.items.length === 1 ? '' : 's'} for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`
          : `No linkage candidates were generated for ${selectedCurriculumFeatureItem?.courseCode ?? 'the selected scope'}.${generationNote}`,
      )
    })
  }

  const handleApproveCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      let result
      try {
        result = await apiClient.approveCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
          reviewNote: curriculumLinkageReviewNote.trim() || undefined,
        })
      } catch (error) {
        emitClientOperationalEvent('curriculum.linkage.approval_failed', {
          workspace: 'system-admin',
          batchId: selectedBatch.batchId,
          curriculumLinkageCandidateId,
          error: normalizeClientTelemetryError(error),
        }, { level: 'warn' })
        throw error
      }
      emitClientOperationalEvent('curriculum.linkage.approved', {
        workspace: 'system-admin',
        batchId: selectedBatch.batchId,
        curriculumLinkageCandidateId,
        affectedBatchIds: result.affectedBatchIds,
        proofRefreshQueued: result.proofRefreshQueued,
        proofRefreshStatus: result.proofRefresh?.status ?? null,
        queuedProofRefreshCount: getQueuedProofRefreshCount(result),
      })
      await refreshCurriculumFeatureConfig(selectedBatch.batchId)
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(result)
      setCurriculumLinkageReviewNote('')
      if (!result.proofRefreshQueued && result.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: result.affectedBatchIds,
          curriculumImportVersionId: result.curriculumImportVersionId,
          message: result.proofRefreshWarning
            ?? 'Curriculum linkage was approved, but proof refresh queueing failed for one or more affected batches. Retry immediately to restore proof parity.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(
        !result.proofRefreshQueued
          ? `Curriculum linkage approved, but proof refresh queueing failed. ${result.proofRefreshWarning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
          : queuedCount > 0
          ? `Curriculum linkage approved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
          : 'Curriculum linkage approved.',
      )
    })
  }

  const handleRejectCurriculumLinkageCandidate = async (curriculumLinkageCandidateId: string) => {
    if (!selectedBatch) return
    await runAction(async () => {
      await apiClient.rejectCurriculumLinkageCandidate(selectedBatch.batchId, curriculumLinkageCandidateId, {
        reviewNote: curriculumLinkageReviewNote.trim() || undefined,
      })
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      setCurriculumLinkageReviewNote('')
      setFlashMessage('Curriculum linkage candidate rejected.')
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
      await loadAdminData()
      await refreshCurriculumFeatureConfig(current.batchId)
      await refreshCurriculumLinkageCandidates(current.batchId)
      await refreshProofDashboard(current.batchId)
      setFlashMessage(`Curriculum course archived for ${current.courseCode}. Any required proof refresh is now queued by the backend.`)
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
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      const nextSelected = nextBundle.items.find(item => item.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId) ?? null
      setCurriculumFeatureForm(hydrateCurriculumFeatureForm(nextSelected))
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds?.length) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? `Curriculum model inputs were saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed for one or more affected batches.`,
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum model inputs saved for ${selectedCurriculumFeatureItem.courseCode}, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum model inputs saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued for ${selectedCurriculumFeatureItem.courseCode}.`
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
      await refreshCurriculumLinkageCandidates(selectedBatch.batchId)
      await refreshProofDashboard(selectedBatch.batchId)
      const queuedCount = getQueuedProofRefreshCount(saved)
      if (saved.proofRefresh?.status === 'degraded' && saved.affectedBatchIds.length > 0) {
        setCurriculumProofRefreshRetry({
          batchIds: saved.affectedBatchIds,
          curriculumImportVersionId: saved.curriculumImportVersionId,
          message: saved.proofRefresh.warning
            ?? 'Curriculum feature binding was saved, but proof refresh queueing failed for one or more affected batches.',
        })
      } else {
        setCurriculumProofRefreshRetry(null)
      }
      setFlashMessage(saved.proofRefresh?.status === 'degraded'
        ? `Curriculum feature binding saved, but proof refresh queueing failed. ${saved.proofRefresh.warning ?? 'Use Retry proof refresh to re-queue the affected batches.'}`
        : queuedCount > 0
          ? `Curriculum feature binding saved and ${queuedCount} affected batch proof run${queuedCount === 1 ? '' : 's'} queued.`
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
        const nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
      }
      const refreshed = selectedBatch ? await queueSelectedProofRefresh('policy refresh') : []
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy saved and proof batch refreshed.`
        : `${activeGovernanceScope.label} policy saved.`)
    })
  }

  const handleResetScopePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting governance.')
      return
    }
    if (!activeScopePolicyOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
      return
    }
    const existing = activeScopePolicyOverride
    if (!existing) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedBatchPolicy,
        subject: 'policy',
      }))
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
      let nextResolved: ApiResolvedBatchPolicy | null = null
      if (selectedBatch) {
        nextResolved = await apiClient.getResolvedBatchPolicy(selectedBatch.batchId, { sectionCode: selectedSectionCode })
        setResolvedBatchPolicy(nextResolved)
        setPolicyForm(hydratePolicyForm(nextResolved.effectivePolicy))
      }
      const refreshed = selectedBatch ? await queueSelectedProofRefresh('policy reset') : []
      const rollbackMessage = describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedBatchPolicy,
        subject: 'policy',
      })
      setFlashMessage(refreshed.length > 0
        ? `${activeGovernanceScope.label} policy override reset and proof batch refreshed. ${rollbackMessage}`
        : `${activeGovernanceScope.label} policy override reset. ${rollbackMessage}`)
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
        const nextResolved = await apiClient.getResolvedStagePolicy(selectedBatch.batchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
      }
      setFlashMessage(`${activeGovernanceScope.label} stage policy saved.`)
    })
  }

  const handleResetScopeStagePolicy = async () => {
    if (!activeGovernanceScope) {
      setFlashMessage('Select a hierarchy scope before resetting stage policy.')
      return
    }
    if (!activeScopeStageOverride) {
      setFlashMessage(describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: resolvedStagePolicy,
        subject: 'stage policy',
      }))
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
      let nextResolved: ApiResolvedBatchStagePolicy | null = null
      if (selectedBatch) {
        nextResolved = await apiClient.getResolvedStagePolicy(selectedBatch.batchId, { sectionCode: selectedSectionCode })
        setResolvedStagePolicy(nextResolved)
        setStagePolicyForm(hydrateStagePolicyForm(nextResolved.effectivePolicy))
      }
      setFlashMessage(`${activeGovernanceScope.label} stage policy override reset. ${describeGovernanceRollbackMessage({
        activeGovernanceScope,
        activeScopeChain,
        hasLocalOverride: false,
        resolved: nextResolved ?? resolvedStagePolicy,
        subject: 'stage policy',
      })}`)
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
      if (selectedBatch.batchId === route.batchId) {
        await refreshProofDashboard(selectedBatch.batchId)
      }
      const queuedCount = getQueuedProofRefreshCount(result)
      setFlashMessage(
        queuedCount > 0
          ? `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, ${result.summary.createdMentorCount} mentor links, and ${queuedCount} proof refresh${queuedCount === 1 ? '' : 'es'} for ${selectedBatch.batchLabel}.`
          : `Provisioned ${result.summary.createdStudentCount} students, ${result.summary.createdOfferingCount} offerings, and ${result.summary.createdMentorCount} mentor links for ${selectedBatch.batchLabel}.`,
      )
    })
  }

  const handlePreviewBulkMentorAssignment = async () => {
    if (!selectedBatch) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentPreviewPayload(selectedBatch.batchId, selectedSectionCode, bulkMentorAssignmentForm),
    ))
    if (!result) return
    setBulkMentorAssignmentPreview(result)
    setFlashMessage(describeBulkMentorPreview(result))
  }

  const handleApplyBulkMentorAssignment = async () => {
    if (!selectedBatch || !bulkMentorAssignmentPreview) return
    if (
      bulkMentorAssignmentPreview.summary.createdAssignmentCount === 0
      && bulkMentorAssignmentPreview.summary.endedAssignmentCount === 0
    ) {
      setFlashMessage('The current preview does not contain any mentor changes to apply.')
      return
    }
    if (!window.confirm(`Apply mentor changes for ${bulkMentorAssignmentPreview.scopeLabel}?`)) return
    const result = await runAction(async () => apiClient.bulkApplyMentorAssignments(
      buildBulkMentorAssignmentApplyPayload(
        selectedBatch.batchId,
        selectedSectionCode,
        bulkMentorAssignmentForm,
        bulkMentorAssignmentPreview.studentIds,
      ),
    ))
    if (!result) return
    await loadAdminData()
    setBulkMentorAssignmentPreview(null)
    setFlashMessage(
      `${result.summary.createdAssignmentCount} mentor links applied and ${result.summary.endedAssignmentCount} active links end-dated for ${result.scopeLabel}.`,
    )
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
      const rerun = await queueSelectedProofRefresh('proof import approval', latestImport.curriculumImportVersionId)
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

  const handleActivateProofSemester = async (simulationRunId: string, semesterNumber: number) => {
    if (!selectedBatch) return
    await runAction(async () => {
      const activation = await apiClient.activateProofSemester(simulationRunId, {
        semesterNumber: semesterNumber as 1 | 2 | 3 | 4 | 5 | 6,
      })
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(batch => (
          batch.batchId === activation.batchId
            ? {
                ...batch,
                currentSemester: activation.activeOperationalSemester,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )),
      }))
      await refreshProofDashboard(selectedBatch.batchId)
      setFlashMessage(`Proof operational semester switched to Semester ${semesterNumber}.`)
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

  const handleResetProofPlaybackSelection = useCallback(() => {
    clearProofPlaybackSelection()
    setSelectedProofCheckpointSource('auto')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(defaultProofPlaybackCheckpointId)
  }, [defaultProofPlaybackCheckpointId])

  const handleSelectProofCheckpoint = useCallback((checkpointId: string | null) => {
    setSelectedProofCheckpointSource('manual')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(checkpointId)
  }, [])

  const handleStepProofPlayback = useCallback((direction: 'previous' | 'next' | 'start' | 'end') => {
    if (activeRunCheckpoints.length === 0) return
    if (direction === 'start') {
      const startIndex = firstAccessibleCheckpointIndex >= 0 ? firstAccessibleCheckpointIndex : 0
      const checkpointId = activeRunCheckpoints[startIndex]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointSource('manual')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(checkpointId)
      return
    }
    if (direction === 'end') {
      const lastAccessibleIndex = firstBlockedCheckpointIndex >= 0 ? Math.max(0, firstBlockedCheckpointIndex - 1) : activeRunCheckpoints.length - 1
      const checkpointId = activeRunCheckpoints[lastAccessibleIndex]?.simulationStageCheckpointId ?? null
      setSelectedProofCheckpointSource('manual')
      setProofPlaybackRestoreNotice(null)
      setSelectedProofCheckpointDetail(null)
      setSelectedProofCheckpointId(checkpointId)
      return
    }
    const currentIndex = Math.max(0, activeRunCheckpoints.findIndex(item => item.simulationStageCheckpointId === selectedProofCheckpoint?.simulationStageCheckpointId))
    const nextIndex = direction === 'previous'
      ? Math.max(0, currentIndex - 1)
      : Math.min(activeRunCheckpoints.length - 1, currentIndex + 1)
    if (direction === 'next' && firstBlockedCheckpointIndex >= 0 && nextIndex >= firstBlockedCheckpointIndex) return
    const checkpointId = activeRunCheckpoints[nextIndex]?.simulationStageCheckpointId ?? null
    setSelectedProofCheckpointSource('manual')
    setProofPlaybackRestoreNotice(null)
    setSelectedProofCheckpointDetail(null)
    setSelectedProofCheckpointId(checkpointId)
  }, [activeRunCheckpoints, firstAccessibleCheckpointIndex, firstBlockedCheckpointIndex, selectedProofCheckpoint?.simulationStageCheckpointId])

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
        const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
        setFlashMessage(rerun.length > 0 ? 'Enrollment updated and proof batch refreshed.' : 'Enrollment updated.')
      })
      return
    }
    await runAction(async () => {
      await apiClient.createEnrollment(selectedStudent.studentId, payload)
      const rerun = await queueSelectedProofRefresh(`${selectedStudent.name} enrollment refresh`)
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
  const curriculumSemesterEntries = useMemo(() => {
    const semesterCount = selectedBranch?.semesterCount ?? 0
    if (semesterCount <= 0) return curriculumBySemester
    return Array.from({ length: semesterCount }, (_, index) => {
      const semesterNumber = index + 1
      const existing = curriculumBySemester.find(entry => entry.semesterNumber === semesterNumber)
      return existing ?? { semesterNumber, courses: [] }
    })
  }, [curriculumBySemester, selectedBranch?.semesterCount])
  const selectedCurriculumSemesterEntry = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === selectedCurriculumSemester) ?? null
  const selectedCurriculumSemesterCourses = selectedCurriculumSemesterEntry?.courses ?? []
  const selectedCurriculumCourse = selectedCurriculumSemesterCourses.find(course => course.curriculumCourseId === selectedCurriculumCourseId)
    ?? selectedCurriculumSemesterCourses[0]
    ?? null
  const curriculumFeatureItems = curriculumFeatureConfig?.items ?? []
  const selectedCurriculumFeatureItem = curriculumFeatureItems.find(item => item.curriculumCourseId === selectedCurriculumFeatureCourseId) ?? null
  const selectedCurriculumLinkageCandidates = useMemo(
    () => selectedCurriculumFeatureItem
      ? curriculumLinkageCandidates.filter(candidate => candidate.curriculumCourseId === selectedCurriculumFeatureItem.curriculumCourseId)
      : [],
    [curriculumLinkageCandidates, selectedCurriculumFeatureItem],
  )
  const selectedFacultyAssignments = selectedFacultyMember ? listFacultyAssignments(data, selectedFacultyMember.facultyId) : []
  const activeBatchPolicyOverride = selectedBatch
    ? data.policyOverrides.find(item => item.scopeType === 'batch' && item.scopeId === selectedBatch.batchId && isVisibleAdminRecord(item.status)) ?? null
    : null

  useEffect(() => {
    if (curriculumSemesterEntries.length === 0) {
      setSelectedCurriculumSemester('')
      setSelectedCurriculumCourseId('')
      return
    }
    const preferredSemester = selectedCurriculumSemester
      && curriculumSemesterEntries.some(entry => String(entry.semesterNumber) === selectedCurriculumSemester)
      ? selectedCurriculumSemester
      : curriculumSemesterEntries.find(entry => entry.semesterNumber === authoritativeOperationalSemester)?.semesterNumber?.toString()
        ?? String(curriculumSemesterEntries[0]!.semesterNumber)
    if (preferredSemester !== selectedCurriculumSemester) {
      setSelectedCurriculumSemester(preferredSemester)
      return
    }
    const semesterCourses = curriculumSemesterEntries.find(entry => String(entry.semesterNumber) === preferredSemester)?.courses ?? []
    if (semesterCourses.length === 0) {
      if (selectedCurriculumCourseId) setSelectedCurriculumCourseId('')
      return
    }
    if (!semesterCourses.some(course => course.curriculumCourseId === selectedCurriculumCourseId)) {
      setSelectedCurriculumCourseId(semesterCourses[0]!.curriculumCourseId)
    }
  }, [authoritativeOperationalSemester, curriculumSemesterEntries, selectedCurriculumCourseId, selectedCurriculumSemester])
  useEffect(() => {
    if (entityEditors.curriculum.curriculumCourseId) return
    const nextSemester = selectedCurriculumSemester || String(authoritativeOperationalSemester ?? 1)
    if (entityEditors.curriculum.semesterNumber === nextSemester) return
    setEntityEditors(prev => ({
      ...prev,
      curriculum: {
        ...prev.curriculum,
        semesterNumber: nextSemester,
      },
    }))
  }, [authoritativeOperationalSemester, entityEditors.curriculum.curriculumCourseId, entityEditors.curriculum.semesterNumber, selectedCurriculumSemester])
  const activeScopeChain = useMemo<ActiveAdminScope[]>(() => buildAdminActiveScopeChain({
    institution: data.institution,
    academicFaculty: selectedAcademicFaculty,
    department: selectedDepartment,
    branch: selectedBranch,
    batch: selectedBatch,
    sectionCode: selectedSectionCode,
  }), [data.institution, selectedAcademicFaculty, selectedBatch, selectedBranch, selectedDepartment, selectedSectionCode])
  const activeGovernanceScope = activeScopeChain.at(-1) ?? null
  const activeGovernanceScopeId = activeGovernanceScope?.scopeId ?? null
  const activeGovernanceScopeType = activeGovernanceScope?.scopeType ?? null
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
    if (
      activeGovernanceScope
      && resolvedBatchPolicy
      && resolvedBatchPolicy.batch.batchId === selectedBatch?.batchId
      && resolvedBatchPolicy.scopeChain.some(scope => scope.scopeType === activeGovernanceScope.scopeType && scope.scopeId === activeGovernanceScope.scopeId)
    ) {
      return resolvedBatchPolicy.effectivePolicy
    }
    return scopePolicyOverrides.reduce<ApiResolvedBatchPolicy['effectivePolicy']>(
      (policy, override) => mergePolicyPayload(policy, override.policy),
      buildValidatedPolicyPayload(defaultPolicyForm()),
    )
  }, [activeGovernanceScope, resolvedBatchPolicy, scopePolicyOverrides, selectedBatch?.batchId])
  const effectiveScopeStagePolicy = useMemo(() => {
    if (
      activeGovernanceScope
      && resolvedStagePolicy
      && resolvedStagePolicy.batch.batchId === selectedBatch?.batchId
      && resolvedStagePolicy.scopeChain.some(scope => scope.scopeType === activeGovernanceScope.scopeType && scope.scopeId === activeGovernanceScope.scopeId)
    ) {
      return resolvedStagePolicy.effectivePolicy
    }
    return scopeStageOverrides.at(-1)?.policy ?? DEFAULT_STAGE_POLICY
  }, [activeGovernanceScope, resolvedStagePolicy, scopeStageOverrides, selectedBatch?.batchId])
  const activeScopePolicyOverride = activeGovernanceScope
    ? data.policyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const activeScopeStageOverride = activeGovernanceScope
    ? stagePolicyOverrides.find(item => item.scopeType === activeGovernanceScope.scopeType && item.scopeId === activeGovernanceScope.scopeId && isVisibleAdminRecord(item.status)) ?? null
    : null
  const curriculumFeatureTargetScopeOptions = activeScopeChain.filter(scope => scope.scopeType !== 'section')
  const curriculumFeatureProfileOptions = curriculumFeatureConfig?.availableProfiles ?? []
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
  const visibleHiddenQueueItems = [...archivedItems, ...deletedItems].filter(item => !dismissedQueueItemKeys.includes(`hidden:${item.key}`))
  const visibleQueueDismissKeys = useMemo(() => collectAdminQueueDismissKeys({
    requestIds: openRequests.map(item => item.adminRequestId),
    reminderIds: pendingReminders.map(item => item.reminderId),
    hiddenItemKeys: visibleHiddenQueueItems.map(item => item.key),
  }), [openRequests, pendingReminders, visibleHiddenQueueItems])
  const actionQueueCount = openRequests.length + pendingReminders.length + visibleHiddenQueueItems.length
  const hideAllVisibleQueueItems = useCallback(() => {
    setDismissedQueueItemKeys(existing => mergeAdminQueueDismissKeys(existing, visibleQueueDismissKeys))
  }, [visibleQueueDismissKeys])
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
  const scopedAdminDirectoryData: LiveAdminDataset = {
    ...data,
    students: scopedDirectoryStudents ?? data.students,
    facultyMembers: scopedDirectoryFacultyMembers ?? data.facultyMembers,
  }
  const filteredUniversityStudents = scopedAdminDirectoryData.students
    .filter(item => isStudentVisible(data, item))
    .filter(student => matchesStudentScope(student, data, activeUniversityScope))
  const filteredUniversityFaculty = scopedAdminDirectoryData.facultyMembers
    .filter(item => isFacultyMemberVisible(data, item))
    .filter(member => matchesFacultyScope(member, data, activeUniversityScope))
  const scopedUniversityStudents = activeUniversityScope ? filteredUniversityStudents : []
  const universityContextLabel = selectedSectionCode
    ? `Section ${selectedSectionCode}`
    : selectedBatch
      ? deriveCurrentYearLabel(authoritativeOperationalSemester ?? selectedBatch.currentSemester)
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
  const activeUniversityStudentScopeChipLabel = selectedSectionCode
    ? 'Section scope'
    : selectedBatch
      ? 'Year scope'
      : selectedBranch
        ? 'Branch scope'
        : selectedDepartment
          ? 'Department scope'
          : selectedAcademicFaculty
            ? 'Faculty scope'
            : 'Global registry'
  const activeUniversityFacultyScopeChipLabel = selectedSectionCode
    ? 'Section scope'
    : selectedBatch
      ? 'Year scope'
      : selectedBranch
        ? 'Branch scope'
        : selectedDepartment
          ? 'Department scope'
          : selectedAcademicFaculty
            ? 'Faculty scope'
            : 'All faculty'
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
  const showInlineActionQueue = showActionQueue && viewportWidth >= ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT
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
    ? batchTerms.find(item => item.semesterNumber === authoritativeOperationalSemester && isVisibleAdminRecord(item.status)) ?? batchTerms[0] ?? null
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
    : EMPTY_FACULTY_RECORDS
  const batchMentorEligibleFaculty = getScopedMentorEligibleFaculty(
    batchFacultyPool,
    selectedBatch?.batchId ?? null,
    selectedSectionCode,
  )
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

  useEffect(() => {
    setBatchProvisioningForm(prev => {
      const nextFacultyPoolIds = prev.facultyPoolIds.filter(facultyId => batchFacultyPool.some(member => member.facultyId === facultyId))
      return nextFacultyPoolIds.length === prev.facultyPoolIds.length
        ? prev
        : { ...prev, facultyPoolIds: nextFacultyPoolIds }
    })
  }, [batchFacultyPool])

  useEffect(() => {
    setBulkMentorAssignmentForm(prev => {
      const fallbackFacultyId = batchMentorEligibleFaculty[0]?.facultyId ?? ''
      const nextFacultyId = batchMentorEligibleFaculty.some(member => member.facultyId === prev.facultyId)
        ? prev.facultyId
        : fallbackFacultyId
      const nextEffectiveFrom = currentSemesterTerm?.startDate ?? prev.effectiveFrom
      if (nextFacultyId === prev.facultyId && nextEffectiveFrom === prev.effectiveFrom) return prev
      return {
        ...prev,
        facultyId: nextFacultyId,
        effectiveFrom: nextEffectiveFrom,
      }
    })
  }, [batchMentorEligibleFaculty, currentSemesterTerm?.startDate, selectedBatch?.batchId, selectedSectionCode])

  useEffect(() => {
    setBulkMentorAssignmentPreview(null)
  }, [
    selectedBatch?.batchId,
    selectedSectionCode,
    bulkMentorAssignmentForm.facultyId,
    bulkMentorAssignmentForm.effectiveFrom,
    bulkMentorAssignmentForm.source,
    bulkMentorAssignmentForm.selectionMode,
  ])

  const selectedStageOffering = batchOfferings.find(item => item.offId === selectedStageOfferingId) ?? batchOfferings[0] ?? null
  const selectedCurriculumFeatureTargetScope = curriculumFeatureTargetScopeKey
    ? curriculumFeatureTargetScopeOptions.find(scope => `${scope.scopeType}::${scope.scopeId}` === curriculumFeatureTargetScopeKey) ?? null
    : null
  const curriculumFeatureAffectedBatchPreview = selectedCurriculumFeatureTargetScope
    ? visibleBatches.filter(batch => matchesBatchScope(batch, data, selectedCurriculumFeatureTargetScope.scopeType, selectedCurriculumFeatureTargetScope.scopeId))
    : []
  const overviewCounts = computeOverviewScopedCounts(
    overviewHierarchyScope ? scopedAdminDirectoryData : data,
    overviewHierarchyScope,
  )
  const overviewGlobalCounts = computeOverviewScopedCounts(data, null)
  const overviewVisibleStudentCount = overviewCounts.studentCount
  const overviewVisibleMentoredCount = overviewCounts.mentoredCount
  const overviewVisibleMentorGapCount = overviewCounts.mentorGapCount
  const overviewGlobalStudentCount = overviewGlobalCounts.studentCount
  const overviewGlobalMentoredCount = overviewGlobalCounts.mentoredCount
  const overviewVisibleFacultyCount = overviewCounts.facultyCount
  const overviewVisibleOwnershipCount = overviewCounts.ownershipCount
  const normalizedStudentRegistrySearch = studentRegistrySearch.trim().toLowerCase()
  const normalizedFacultyRegistrySearch = facultyRegistrySearch.trim().toLowerCase()
  const studentRegistryItems = (studentRegistryHasScope ? scopedAdminDirectoryData : data).students
    .filter(item => isStudentVisible(data, item))
    .filter(item => !studentRegistryHasScope || matchesStudentScope(item, data, studentRegistryScope))
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
  const facultyRegistryItems = (hasHierarchyScopeSelection(facultyRegistryScope) ? scopedAdminDirectoryData : data).facultyMembers
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
    ? `Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Live scope-backed feed filtered to ${studentRegistryScopeLabel ?? 'the selected academic scope'}.`
    : selectedStudentRouteIsExplicit
      ? 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. The global registry remains open while the explicit student drilldown is focused on the right.'
      : 'Canonical identity, enrollment correction, mentor linkage, promotion review, and audit history. Global student registry is open; apply filters to narrow the scope.'
  const studentRegistryEmptyMessage = studentRegistryHasScope
    ? 'No students match the current academic scope.'
    : selectedStudentRouteIsExplicit
      ? 'No students match the current global filters. The explicit student drilldown is already open on the right.'
      : 'No students match the current global filters.'
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
    if (!activeGovernanceScopeId || !activeGovernanceScopeType) return
    setPolicyForm(hydratePolicyForm(effectiveScopePolicy))
  }, [
    activeGovernanceScopeId,
    activeGovernanceScopeType,
    activeScopePolicyOverride?.policyOverrideId,
    activeScopePolicyOverride?.version,
    effectiveScopePolicy,
  ])

  useEffect(() => {
    if (!activeGovernanceScopeId || !activeGovernanceScopeType) {
      setStagePolicyForm(defaultStagePolicyForm())
      return
    }
    setStagePolicyForm(hydrateStagePolicyForm(effectiveScopeStagePolicy))
  }, [
    activeGovernanceScopeId,
    activeGovernanceScopeType,
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
  const handleResetFacultiesWorkspaceRestore = useCallback(() => {
    if (typeof window !== 'undefined' && route.section === 'faculties') {
      window.sessionStorage.removeItem(`airmentor-admin-ui:${routeToHash(route)}`)
    }
    setSelectedSectionCode(null)
    setUniversityTab('overview')
    setFacultiesRestoreNotice(null)
  }, [route])
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
  const workspaceAdminName = session?.faculty?.displayName ?? session?.user.username ?? 'System Admin'
  void [
    DayToggle,
    WEEKDAYS,
    STAGE_EVIDENCE_OPTIONS,
    selectedStageEligibility,
    startEditingTerm,
    startEditingCurriculumCourse,
    handleSaveTerm,
    handleArchiveTerm,
    handleSaveCurriculumCourse,
    handleBootstrapCurriculumManifest,
    handleArchiveCurriculumCourse,
    handleSaveScopePolicy,
    handleResetScopePolicy,
    handleSaveScopeStagePolicy,
    handleResetScopeStagePolicy,
    handleAdvanceOfferingStage,
    handleProvisionBatch,
    handleAssignCurriculumCourseLeader,
    selectedCurriculumCourse,
    universityNextItems,
    universityNavigatorTitle,
    universityNavigatorHelper,
    getUniversityCourseLeaders,
    scopedCourseLeaderFaculty,
    getScopedCourseLeaderState,
    batchFacultyPool,
    batchOfferingsWithoutOwner,
    batchStudentsWithoutEnrollment,
    batchStudentsWithoutMentor,
    batchOfferingsWithoutRoster,
  ]

  // --- Main workspace ---
  return (
    <SystemAdminSessionBoundary
      booting={booting}
      activeRoleCode={session?.activeRoleGrant.roleCode ?? null}
      canSwitchToSystemAdmin={Boolean(systemAdminGrant)}
      authBusy={authBusy}
      authError={authError}
      identifier={identifier}
      password={password}
      apiBaseUrl={apiBaseUrl}
      onIdentifierChange={setIdentifier}
      onPasswordChange={setPassword}
      onLogin={handleLogin}
      onExitPortal={onExitPortal}
      onSwitchToSystemAdmin={() => { void handleSwitchToSystemAdmin() }}
      onLogout={() => { void handleLogout() }}
    >
      <div className="app-shell" style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${T.bg}, ${T.surface2})`, color: T.text }}>
        <TeachingShellAdminTopBar
        institutionName={data.institution?.name ?? 'AirMentor'}
        adminName={workspaceAdminName}
        contextLabel={adminContextLabel}
        now={now}
        themeMode={themeMode}
        actionCount={actionQueueCount}
        showActionQueue={showInlineActionQueue}
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
        {curriculumProofRefreshRetry ? (
          <RestoreBanner
            title="Proof Refresh Needs Retry"
            message={curriculumProofRefreshRetry.message}
            tone="error"
            actionLabel="Retry proof refresh"
            onAction={() => {
              void retryCurriculumProofRefresh()
            }}
          />
        ) : null}
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
                      : `${overviewGlobalStudentCount} records · ${overviewGlobalMentoredCount} mentored`}
                    helper={overviewHierarchyScope
                      ? `Canonical student identity, mentor linkage, and semester progression filtered to ${overviewScopeLabel ?? 'the active academic scope'}.`
                      : 'Open the full global student registry directly, or set a faculty, department, branch, year, or section in the university workspace to preserve scope.'}
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
          <SystemAdminFacultiesWorkspace
            data={data}
            route={route}
            toneColor={ADMIN_SECTION_TONES.faculties}
            restoreNotice={facultiesRestoreNotice}
            onResetRestore={handleResetFacultiesWorkspaceRestore}
            selectedAcademicFaculty={selectedAcademicFaculty}
            selectedDepartment={selectedDepartment}
            selectedBranch={selectedBranch}
            selectedBatch={selectedBatch}
            canonicalProofBatch={canonicalProofBatch}
            authoritativeOperationalSemester={authoritativeOperationalSemester}
            authoritativeOperationalSemesterSource={authoritativeOperationalSemesterSource}
            selectedSectionCode={selectedSectionCode}
            selectedAcademicFacultyImpact={selectedAcademicFacultyImpact}
            facultyDepartments={facultyDepartments}
            departmentBranches={departmentBranches}
            branchBatches={branchBatches}
            structureForms={structureForms}
            setStructureForms={setStructureForms}
            setEditingEntity={value => setEditingEntity(value as EditingEntity | null)}
            handleCreateAcademicFaculty={handleCreateAcademicFaculty}
            handleCreateDepartment={handleCreateDepartment}
            handleCreateBranch={handleCreateBranch}
            handleCreateBatch={handleCreateBatch}
            navigate={navigate}
            updateSelectedSectionCode={updateSelectedSectionCode}
            universityTab={universityTab}
            updateUniversityTab={(tabId, options) => updateUniversityTab(tabId as UniversityTab, options)}
            universityTabOptions={universityTabOptions}
            universityWorkspaceTabCards={universityWorkspaceTabCards}
            universityWorkspaceColumns={universityWorkspaceColumns}
            universityLevelTitle={universityLevelTitle}
            universityLevelHelper={universityLevelHelper}
            universityLeftItems={universityLeftItems}
            universityWorkspaceLabel={universityWorkspaceLabel}
            universityWorkspacePaneRef={universityWorkspacePaneRef}
            stickyShadow={isLightTheme(themeMode) ? '0 18px 32px rgba(15, 23, 42, 0.08)' : '0 18px 32px rgba(2, 6, 23, 0.32)'}
            activeBatchPolicyOverride={activeBatchPolicyOverride}
            activeScopeChain={activeScopeChain}
            activeGovernanceScope={activeGovernanceScope}
            resolvedBatchPolicy={resolvedBatchPolicy}
            resolvedStagePolicy={resolvedStagePolicy}
            activeScopePolicyOverride={activeScopePolicyOverride}
            activeScopeStageOverride={activeScopeStageOverride}
            policyForm={policyForm}
            setPolicyForm={setPolicyForm}
            stagePolicyForm={stagePolicyForm}
            setStagePolicyForm={setStagePolicyForm}
            handleSaveScopePolicy={handleSaveScopePolicy}
            handleResetScopePolicy={handleResetScopePolicy}
            handleSaveScopeStagePolicy={handleSaveScopeStagePolicy}
            handleResetScopeStagePolicy={handleResetScopeStagePolicy}
            entityEditors={entityEditors}
            setEntityEditors={setEntityEditors}
            batchTerms={batchTerms}
            currentSemesterTerm={currentSemesterTerm}
            startEditingTerm={startEditingTerm}
            resetTermEditor={resetTermEditor}
            handleSaveTerm={handleSaveTerm}
            handleArchiveTerm={handleArchiveTerm}
            selectedCurriculumSemester={selectedCurriculumSemester}
            setSelectedCurriculumSemester={setSelectedCurriculumSemester}
            curriculumSemesterEntries={curriculumSemesterEntries}
            selectedCurriculumCourseId={selectedCurriculumCourseId}
            startEditingCurriculumCourse={startEditingCurriculumCourse}
            resetCurriculumEditor={resetCurriculumEditor}
            handleSaveCurriculumCourse={handleSaveCurriculumCourse}
            handleArchiveCurriculumCourse={handleArchiveCurriculumCourse}
            handleBootstrapCurriculumManifest={handleBootstrapCurriculumManifest}
            scopedCourseLeaderFaculty={scopedCourseLeaderFaculty}
            getScopedCourseLeaderState={getScopedCourseLeaderState}
            handleAssignCurriculumCourseLeader={handleAssignCurriculumCourseLeader}
            batchProvisioningForm={batchProvisioningForm}
            setBatchProvisioningForm={setBatchProvisioningForm}
            handleProvisionBatch={handleProvisionBatch}
            batchFacultyPool={batchFacultyPool}
            batchMentorEligibleFaculty={batchMentorEligibleFaculty}
            batchOfferingsWithoutOwner={batchOfferingsWithoutOwner}
            batchStudentsWithoutEnrollment={batchStudentsWithoutEnrollment}
            batchStudentsWithoutMentor={batchStudentsWithoutMentor}
            batchOfferingsWithoutRoster={batchOfferingsWithoutRoster}
            bulkMentorAssignmentForm={bulkMentorAssignmentForm}
            setBulkMentorAssignmentForm={setBulkMentorAssignmentForm}
            bulkMentorAssignmentPreview={bulkMentorAssignmentPreview}
            handlePreviewBulkMentorAssignment={handlePreviewBulkMentorAssignment}
            handleApplyBulkMentorAssignment={handleApplyBulkMentorAssignment}
            clearBulkMentorAssignmentPreview={() => setBulkMentorAssignmentPreview(null)}
            activeUniversityRegistryScope={activeUniversityRegistryScope}
            activeUniversityStudentScopeChipLabel={activeUniversityStudentScopeChipLabel}
            activeUniversityFacultyScopeChipLabel={activeUniversityFacultyScopeChipLabel}
            scopedUniversityStudents={scopedUniversityStudents}
            filteredUniversityFaculty={filteredUniversityFaculty}
            curriculumFeatureConfig={curriculumFeatureConfig}
            curriculumFeatureItems={curriculumFeatureItems}
            selectedCurriculumFeatureCourseId={selectedCurriculumFeatureCourseId}
            setSelectedCurriculumFeatureCourseId={setSelectedCurriculumFeatureCourseId}
            selectedCurriculumFeatureItem={selectedCurriculumFeatureItem}
            curriculumFeatureProfileOptions={curriculumFeatureProfileOptions}
            curriculumFeatureBindingMode={curriculumFeatureBindingMode}
            setCurriculumFeatureBindingMode={setCurriculumFeatureBindingMode}
            curriculumFeaturePinnedProfileId={curriculumFeaturePinnedProfileId}
            setCurriculumFeaturePinnedProfileId={setCurriculumFeaturePinnedProfileId}
            curriculumFeatureTargetMode={curriculumFeatureTargetMode}
            setCurriculumFeatureTargetMode={setCurriculumFeatureTargetMode}
            curriculumFeatureTargetScopeKey={curriculumFeatureTargetScopeKey}
            setCurriculumFeatureTargetScopeKey={setCurriculumFeatureTargetScopeKey}
            curriculumFeatureTargetScopeOptions={curriculumFeatureTargetScopeOptions}
            selectedCurriculumFeatureTargetScope={selectedCurriculumFeatureTargetScope}
            curriculumFeatureAffectedBatchPreview={curriculumFeatureAffectedBatchPreview}
            curriculumLinkageGenerationStatus={curriculumLinkageGenerationStatus}
            curriculumLinkageCandidatesLoading={curriculumLinkageCandidatesLoading}
            selectedCurriculumLinkageCandidates={selectedCurriculumLinkageCandidates}
            curriculumLinkageReviewNote={curriculumLinkageReviewNote}
            setCurriculumLinkageReviewNote={setCurriculumLinkageReviewNote}
            curriculumFeatureForm={curriculumFeatureForm}
            setCurriculumFeatureForm={setCurriculumFeatureForm}
            handleSaveCurriculumFeatureBinding={handleSaveCurriculumFeatureBinding}
            handleRegenerateCurriculumLinkageCandidates={handleRegenerateCurriculumLinkageCandidates}
            handleApproveCurriculumLinkageCandidate={handleApproveCurriculumLinkageCandidate}
            handleRejectCurriculumLinkageCandidate={handleRejectCurriculumLinkageCandidate}
            handleSaveCurriculumFeatureConfig={handleSaveCurriculumFeatureConfig}
            proofDashboardProps={{
              proofDashboard,
              proofDashboardLoading,
              activeRunCheckpoints,
              activeModelDiagnostics,
              activeProductionDiagnostics,
              activeDiagnosticsTrainingManifestVersion,
              activeDiagnosticsCalibrationVersion,
              activeDiagnosticsSplitSummary,
              activeDiagnosticsWorldSplitSummary,
              activeDiagnosticsScenarioFamilies,
              activeDiagnosticsHeadSupportSummary,
              activeDiagnosticsGovernedRunCount,
              activeDiagnosticsSkippedRunCount,
              activeDiagnosticsDisplayProbabilityAllowed,
              activeDiagnosticsSupportWarning,
              activeDiagnosticsPolicyDiagnostics,
              activeDiagnosticsCoEvidence,
              activeDiagnosticsPolicyAcceptance,
              activeDiagnosticsOverallCourseRuntime,
              activeDiagnosticsQueueBurden,
              activeDiagnosticsUiParity,
              selectedProofCheckpoint,
              selectedProofCheckpointDetail,
              selectedProofCheckpointBlocked,
              selectedProofCheckpointHasBlockedProgression,
              selectedProofCheckpointCanStepForward,
              selectedProofCheckpointCanPlayToEnd,
              proofPlaybackRestoreNotice,
              onCreateProofImport: handleCreateProofImport,
              onValidateLatestProofImport: handleValidateLatestProofImport,
              onReviewPendingCrosswalks: handleReviewPendingCrosswalks,
              onApproveLatestProofImport: handleApproveLatestProofImport,
              onCreateProofRun: handleCreateProofRun,
              onRecomputeProofRunRisk: handleRecomputeProofRunRisk,
              onActivateProofRun: handleActivateProofRun,
              onActivateProofSemester: handleActivateProofSemester,
              onRetryProofRun: handleRetryProofRun,
              onArchiveProofRun: handleArchiveProofRun,
              onRestoreProofSnapshot: handleRestoreProofSnapshot,
              onResetProofPlaybackSelection: handleResetProofPlaybackSelection,
              onSelectProofCheckpoint: handleSelectProofCheckpoint,
              onStepProofPlayback: handleStepProofPlayback,
              formatSplitSummary,
              formatKeyedCounts,
              formatHeadSupportSummary,
              formatDiagnosticSummary,
            }}
            registryLaunchProps={{
              registryScopeLabel: activeUniversityRegistryScope?.label ?? null,
              studentScopeChipLabel: activeUniversityStudentScopeChipLabel,
              facultyScopeChipLabel: activeUniversityFacultyScopeChipLabel,
              visibleStudentCount: scopedUniversityStudents.length,
              visibleFacultyCount: filteredUniversityFaculty.length,
              studentToneColor: ADMIN_SECTION_TONES.students,
              facultyToneColor: ADMIN_SECTION_TONES['faculty-members'],
              onOpenScopedStudents: () => handleOpenScopedRegistry('students'),
              onOpenAllStudents: () => handleOpenFullRegistry('students'),
              onOpenScopedFaculty: () => handleOpenScopedRegistry('faculty-members'),
              onOpenAllFaculty: () => handleOpenFullRegistry('faculty-members'),
            }}
          />
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
                  {studentRegistryScopeLabel ? <Chip color={ADMIN_SECTION_TONES.students}>{studentRegistryScopeLabel}</Chip> : <Chip color={T.dim}>All students</Chip>}
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
                data-proof-surface="system-admin-student-drilldown"
                data-proof-student-id={selectedStudent?.studentId ?? undefined}
              >
                <SectionHeading
                  title={selectedStudent ? selectedStudent.name : 'Create Student'}
                  eyebrow="Student Workspace"
                  caption={selectedStudent
                    ? `Identity, academic context, mentor linkage, progression review, and history stay in one focused workspace.${selectedStudentRouteIsExplicit ? ' Opened from the explicit /admin/students/:id path.' : ''}`
                    : 'Create the student identity first, then move through academic context, mentoring, and progression from the tabs below.'}
                />
                {selectedStudent ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={selectedStudentRouteIsExplicit ? T.accent : T.dim}>{selectedStudentRouteIsExplicit ? 'Direct drilldown' : 'Scoped registry'}</Chip>
                      <Chip color={selectedStudentScopeMismatch ? T.warning : T.success}>{selectedStudentScopeMismatch ? 'Outside current scope' : 'Scope aligned'}</Chip>
                      <Chip color={selectedStudentPolicyLoading ? T.dim : selectedStudentPolicy ? T.success : T.dim}>{selectedStudentPolicyLoading ? 'Loading policy…' : selectedStudentPolicy ? 'Policy loaded' : 'Policy unavailable'}</Chip>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                      <AdminMiniStat label="CGPA" value={selectedStudent.currentCgpa.toFixed(2)} tone={T.success} />
                      <AdminMiniStat label="Semester" value={String(selectedStudent.activeAcademicContext?.semesterNumber ?? '—')} tone={T.accent} />
                      <AdminMiniStat label="Enrollments" value={String(selectedStudent.enrollments.length)} tone={T.warning} />
                      <AdminMiniStat label="Mentor Links" value={String(selectedStudent.mentorAssignments.length)} tone={ADMIN_SECTION_TONES['faculty-members']} />
                      <AdminMiniStat label="Audit Events" value={String(studentAuditEvents.length)} tone={T.orange} />
                    </div>
                  </>
                ) : null}
                <AdminDetailTabs
                  activeTab={studentDetailTab}
                  onChange={tabId => setStudentDetailTab(tabId as StudentDetailTab)}
                  ariaLabel="Student detail sections"
                  idBase="student-detail"
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
              <AdminDetailTabPanel idBase="student-detail" tabId="profile">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }} data-proof-surface="system-admin-student-profile" data-proof-student-id={selectedStudent?.studentId ?? undefined}>
                <SectionHeading title={selectedStudent ? 'Student Detail' : 'Create Student'} eyebrow={selectedStudent ? selectedStudent.name : 'New record'} caption="Save the identity record first, then maintain enrollment, mentor, and promotion details below." />
                {selectedStudent ? (
                  <>
                    {!selectedStudentPolicy && !selectedStudentPolicyLoading ? <InfoBanner message="No resolved scope policy snapshot is loaded for this student yet. Progression guidance falls back to the default guardrails until a policy is available." /> : null}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedStudent.usn}</Chip>
                      <Chip color={T.success}>CGPA {selectedStudent.currentCgpa.toFixed(2)}</Chip>
                      <Chip color={T.warning}>{selectedStudent.activeAcademicContext?.departmentName ?? 'No department'}</Chip>
                      <Chip color={selectedStudent.status === 'active' ? T.success : T.danger}>{selectedStudent.status}</Chip>
                    </div>
                    {selectedStudentProofBanner ? <InfoBanner tone="neutral" message={selectedStudentProofBanner} /> : null}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Policy Snapshot</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>
                          {selectedStudentPolicyLoading ? 'Loading policy…' : selectedStudentPolicy ? `Min CGPA ${selectedStudentPromotionRules.minimumCgpaForPromotion.toFixed(1)}` : 'No policy snapshot'}
                        </div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>
                          {selectedStudentPolicyLoading ? 'Awaiting policy resolution…' : selectedStudentPolicy ? `Pass threshold ${selectedStudentPromotionRules.passMarkPercent}% · backlog guard ${selectedStudentPromotionRules.requireNoActiveBacklogs ? 'on' : 'off'}` : 'Configured defaults only until a resolved scope policy loads.'}
                        </div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Academic Lineage</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.activeAcademicContext ? `${selectedStudent.activeAcademicContext.branchName ?? 'Branch'} · Sem ${selectedStudent.activeAcademicContext.semesterNumber ?? '—'}` : 'No active academic context'}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{selectedStudent.activeAcademicContext?.sectionCode ? `Section ${selectedStudent.activeAcademicContext.sectionCode}` : 'No section assigned'}</div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mentor Link</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{selectedStudent.activeMentorAssignment ? 'Mentor linked' : 'No mentor linked'}</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{selectedStudent.mentorAssignments.length} historical assignment{selectedStudent.mentorAssignments.length === 1 ? '' : 's'}</div>
                      </Card>
                      <Card style={{ padding: 14, background: T.surface2 }}>
                        <div style={{ ...mono, fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audit Trail</div>
                        <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text, marginTop: 8 }}>{studentAuditEvents.length} events</div>
                        <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{studentAuditLoading ? 'Loading history…' : studentAuditEvents.length > 0 ? 'Change history is available.' : 'No audit events recorded yet.'}</div>
                      </Card>
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
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>Back to Registry</Btn>
                      <Btn type="button" size="sm" variant="ghost" onClick={() => { navigate({ section: 'students' }); resetStudentEditors() }}>{selectedStudent ? 'Create Student' : 'New Student'}</Btn>
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
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'academic' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="academic">
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
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'mentor' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="mentor">
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
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'progression' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="progression">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Promotion Review" eyebrow="Semester Progression" caption="Recommendations use the configured CGPA rule and backlog guard, then wait for explicit admin confirmation." />
                {!selectedStudent ? <EmptyState title="Select a student" body="Promotion review appears when a student with an academic context is selected." /> : !selectedStudent.activeAcademicContext ? (
                  <EmptyState title="No active academic context" body="Create or restore an enrollment before using the promotion panel." />
                ) : (
                  <>
                    {!selectedStudentPolicy && !selectedStudentPolicyLoading ? <InfoBanner message="No resolved scope policy snapshot is loaded for this student. The progression panel is using the default guardrails only." /> : null}
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
              </AdminDetailTabPanel>
              )}

              {studentDetailTab === 'history' && (
              <AdminDetailTabPanel idBase="student-detail" tabId="history">
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
              </AdminDetailTabPanel>
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
                caption={registryScope
                  ? `Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here. Live scope-backed feed filtered to ${registryScope.label}.`
                  : 'Identity, appointments, permissions, teaching ownership, and teaching-profile parity live here.'}
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
                  ariaLabel="Faculty detail sections"
                  idBase="faculty-detail"
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
              <AdminDetailTabPanel idBase="faculty-detail" tabId="profile">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title={selectedFacultyMember ? 'Faculty Detail' : 'Create Faculty'} eyebrow={selectedFacultyMember ? selectedFacultyMember.displayName : 'New profile'} caption="Master identity stays admin-owned. Teaching workflow actions continue in the teaching workspace." />
                {selectedFacultyMember ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Chip color={T.accent}>{selectedFacultyMember.employeeCode}</Chip>
                      <Chip color={T.warning}>{resolveDepartment(data, getPrimaryAppointmentDepartmentId(selectedFacultyMember))?.name ?? 'No primary department'}</Chip>
                      {selectedFacultyMember.roleGrants.filter(isCurrentRoleGrant).map(grant => <Chip key={grant.grantId} color={T.success}>{formatFacultyGrantScopeLabel(grant)}</Chip>)}
                    </div>
                    {selectedFacultyProofBanner ? <InfoBanner tone="neutral" message={selectedFacultyProofBanner} /> : null}
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
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'appointments' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="appointments">
              <Card style={{ padding: 18, display: 'grid', gap: 14 }}>
                <SectionHeading title="Appointments" eyebrow="Canonical Affiliation" caption="Department and branch affiliation stay canonical here, even when HoD visibility rolls up external teaching activity." />
                {!selectedFacultyMember ? <EmptyState title="Save the faculty profile first" body="Appointments become available after the faculty record exists." /> : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedFacultyMember.appointments.length === 0 ? <InfoBanner message="No appointments recorded yet." /> : selectedFacultyMember.appointments.map(appointment => {
                        return (
                          <Card key={appointment.appointmentId} style={{ padding: 12, background: T.surface2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>{formatFacultyAppointmentLabel(appointment)}</div>
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
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'permissions' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="permissions">
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
                              <div style={{ ...mono, fontSize: 10, color: T.muted, marginTop: 4 }}>{formatFacultyGrantScopeLabel(grant)} · {grant.startDate ?? 'No start'} to {grant.endDate ?? 'Active'} · {grant.status}</div>
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
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'teaching' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="teaching">
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
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'timetable' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="timetable">
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
              </AdminDetailTabPanel>
              )}

              {facultyDetailTab === 'history' && (
              <AdminDetailTabPanel idBase="faculty-detail" tabId="history">
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
              </AdminDetailTabPanel>
              )}
            </div>
          </div>
        )}

        {/* ========== HISTORY ========== */}
        {route.section === 'history' && (
          <SystemAdminHistoryWorkspace
            archivedItems={archivedItems}
            deletedItems={deletedItems}
            recentAuditEvents={recentAuditEvents}
            recentAuditLoading={recentAuditLoading}
            toneColor={ADMIN_SECTION_TONES.history}
            summarizeAuditEvent={summarizeAuditEvent}
            getAuditEventRoute={getAuditEventRoute}
            onOpenRoute={navigate}
            onRestoreItem={item => {
              void runAction(async () => {
                await item.onRestore()
                setFlashMessage(`${item.label} restored.`)
              })
            }}
          />
        )}

        {/* ========== REQUESTS ========== */}
        {route.section === 'requests' && (
          <SystemAdminRequestWorkspace
            requests={data.requests}
            selectedRequestId={route.requestId}
            requestDetailLoading={requestDetailLoading}
            selectedRequest={selectedRequest}
            requestDetail={requestDetail}
            requestBusyId={requestBusy}
            toneColor={ADMIN_SECTION_TONES.requests}
            onSelectRequest={requestId => navigate({ section: 'requests', requestId })}
            onAdvanceRequest={request => { void handleAdvanceRequest(request) }}
          />
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
            <Chip color={T.danger} size={10}>{actionQueueCount} visible</Chip>
          </div>
          <div style={{ ...mono, fontSize: 10, color: T.dim, marginBottom: 14 }}>
            Requests go first. {remindersSupported ? 'Personal reminders stay private to the signed-in system admin.' : 'Private reminders are hidden until the live API supports `/api/admin/reminders`.'}
          </div>
          <QueueBulkActions
            canHideAll={visibleQueueDismissKeys.length > 0}
            hiddenCount={dismissedQueueItemKeys.length}
            onHideAll={hideAllVisibleQueueItems}
            onRestoreAll={restoreAllHiddenQueueItems}
          />

          <div style={{ ...mono, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 8 }}>Requests</div>
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
          {actionQueueCount === 0 && dismissedQueueItemKeys.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <InfoBanner message="Everything in this action queue is currently hidden. Use Restore all hidden to bring requests, reminders, and restore-ready records back into view." />
            </div>
          ) : null}

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, marginTop: 16, background: `linear-gradient(180deg, ${fadeColor(T.surface, '00')} 0%, ${T.surface} 35%)` }}>
            <button
              type="button"
              onClick={() => void handleCreateReminder()}
              disabled={!remindersSupported}
              style={getPrimaryActionButtonStyle({ disabled: !remindersSupported, fullWidth: true })}
            >
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
                <div><FieldLabel>Faculty Code</FieldLabel><TextInput name="academicFacultyCode" aria-label="Faculty Code" value={entityEditors.academicFaculty.code} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, code: event.target.value } }))} /></div>
                <div><FieldLabel>Faculty Name</FieldLabel><TextInput name="academicFacultyName" aria-label="Faculty Name" value={entityEditors.academicFaculty.name} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, name: event.target.value } }))} /></div>
                <div><FieldLabel>Overview</FieldLabel><TextAreaInput name="academicFacultyOverview" aria-label="Faculty Overview" value={entityEditors.academicFaculty.overview} onChange={event => setEntityEditors(prev => ({ ...prev, academicFaculty: { ...prev.academicFaculty, overview: event.target.value } }))} rows={4} /></div>
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
                <div><FieldLabel>Department Code</FieldLabel><TextInput name="departmentCode" aria-label="Department Code" value={entityEditors.department.code} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, code: event.target.value } }))} /></div>
                <div><FieldLabel>Department Name</FieldLabel><TextInput name="departmentName" aria-label="Department Name" value={entityEditors.department.name} onChange={event => setEntityEditors(prev => ({ ...prev, department: { ...prev.department, name: event.target.value } }))} /></div>
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
                <div><FieldLabel>Branch Code</FieldLabel><TextInput name="branchCode" aria-label="Branch Code" value={entityEditors.branch.code} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, code: event.target.value } }))} /></div>
                <div><FieldLabel>Branch Name</FieldLabel><TextInput name="branchName" aria-label="Branch Name" value={entityEditors.branch.name} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, name: event.target.value } }))} /></div>
                <div><FieldLabel>Program Level</FieldLabel><SelectInput name="branchProgramLevel" aria-label="Branch Program Level" value={entityEditors.branch.programLevel} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, programLevel: event.target.value } }))}><option value="UG">UG</option><option value="PG">PG</option></SelectInput></div>
                <div><FieldLabel>Semester Count</FieldLabel><TextInput name="branchSemesterCount" aria-label="Branch Semester Count" value={entityEditors.branch.semesterCount} onChange={event => setEntityEditors(prev => ({ ...prev, branch: { ...prev.branch, semesterCount: event.target.value } }))} /></div>
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
                <div><FieldLabel>Admission Year</FieldLabel><TextInput name="batchAdmissionYear" aria-label="Batch Admission Year" value={entityEditors.batch.admissionYear} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, admissionYear: event.target.value } }))} /></div>
                <div><FieldLabel>Batch Label</FieldLabel><TextInput name="batchLabel" aria-label="Batch Label" value={entityEditors.batch.batchLabel} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, batchLabel: event.target.value } }))} /></div>
                <div><FieldLabel>Active Semester</FieldLabel><TextInput name="batchCurrentSemester" aria-label="Batch Active Semester" value={entityEditors.batch.currentSemester} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, currentSemester: event.target.value } }))} /></div>
                <div><FieldLabel>Section Labels</FieldLabel><TextInput name="batchSectionLabels" aria-label="Batch Section Labels" value={entityEditors.batch.sectionLabels} onChange={event => setEntityEditors(prev => ({ ...prev, batch: { ...prev.batch, sectionLabels: event.target.value } }))} /></div>
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
    </SystemAdminSessionBoundary>
  )
}
