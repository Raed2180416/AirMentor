import { AirMentorApiError } from '../api/client'
import type {
  ApiAcademicFaculty,
  ApiAuditEvent,
  ApiBatchProvisioningRequest,
  ApiBatch,
  ApiBranch,
  ApiCurriculumFeatureConfigBundle,
  ApiCurriculumFeatureConfigPayload,
  ApiDepartment,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
  ApiRoleCode,
  ApiScopeType,
  ApiRoleGrant,
  ApiSimulationStageCheckpointSummary,
  ApiStageEvidenceKind,
  ApiStagePolicyPayload,
} from '../api/types'
import { T } from '../data'
import {
  resolveBranch,
  resolveDepartment,
  type LiveAdminProofProvenance,
  type LiveAdminDataset,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
  type RegistryFilterState,
} from '../system-admin-live-data'
import {
  type HierarchyScopeInput,
} from '../system-admin-overview-helpers'
import { describeProofAvailability, describeProofProvenance } from '../proof-provenance'
import {
  isCanonicalProofBatchId,
  scopeTargetsCanonicalProofHierarchy,
} from '../proof-pilot'

export const EMPTY_FACULTY_RECORDS: ApiFacultyRecord[] = []

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

export type StructureFormState = {
  academicFaculty: { code: string; name: string; overview: string }
  department: { code: string; name: string }
  branch: { code: string; name: string; programLevel: string; semesterCount: string }
  batch: { admissionYear: string; batchLabel: string; currentSemester: string; sectionLabels: string }
  term: { academicYearLabel: string; semesterNumber: string; startDate: string; endDate: string }
  curriculum: { semesterNumber: string; courseCode: string; title: string; credits: string }
}

export type CurriculumFeatureFormState = {
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

export type StudentFormState = {
  usn: string
  rollNumber: string
  name: string
  email: string
  phone: string
  admissionDate: string
}

export type EnrollmentFormState = {
  enrollmentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder: string
  academicStatus: string
  startDate: string
  endDate: string
}

export type MentorAssignmentFormState = {
  assignmentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string
  source: string
}

export type FacultyFormState = {
  username: string
  password: string
  email: string
  phone: string
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string
}

export type AppointmentFormState = {
  appointmentId: string
  departmentId: string
  branchId: string
  isPrimary: boolean
  startDate: string
  endDate: string
}

export type RoleGrantFormState = {
  grantId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  startDate: string
  endDate: string
}

export type OwnershipFormState = {
  ownershipId: string
  offeringId: string
  facultyId: string
}

export function upsertLiveAdminItem<T>(items: T[], nextItem: T, matches: (item: T) => boolean) {
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

export type StudentDetailTab = 'profile' | 'academic' | 'mentor' | 'progression' | 'history'
export type FacultyDetailTab = 'profile' | 'appointments' | 'permissions' | 'teaching' | 'timetable' | 'history'
export type UniversityTab = 'overview' | 'bands' | 'ce-see' | 'cgpa' | 'stage' | 'courses' | 'curriculum'
export const UNIVERSITY_TABS = new Set<UniversityTab>(['overview', 'bands', 'ce-see', 'cgpa', 'stage', 'courses', 'curriculum'])

export function isUniversityTab(value: unknown): value is UniversityTab {
  return typeof value === 'string' && UNIVERSITY_TABS.has(value as UniversityTab)
}

export type EditingEntity =
  | 'academic-faculty'
  | 'department'
  | 'branch'
  | 'batch'
  | 'batch'
  | 'student-profile'
  | 'student-enrollment'
  | 'student-mentor'
  | 'faculty-profile'
  | 'faculty-appointment'
  | 'faculty-permission'

export type AdminWorkspaceSnapshot = {
  route: LiveAdminRoute
  universityTab: UniversityTab
  selectedSectionCode: string | null
  scrollY: number
}

// HierarchyScopeInput is now imported from './system-admin-overview-helpers'

export type ActiveAdminScope = {
  scopeType: ApiScopeType
  scopeId: string
  label: string
}

export const EMPTY_DATA: LiveAdminDataset = {
  institution: null, academicFaculties: [], departments: [], branches: [], batches: [], terms: [],
  facultyMembers: [], students: [], courses: [], curriculumCourses: [], policyOverrides: [],
  offerings: [], ownerships: [], requests: [], reminders: [],
}

export const WEEKDAYS: PolicyFormState['workingDays'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const ADMIN_SECTION_TONES = {
  overview: T.accent,
  faculties: T.success,
  students: T.blue,
  'faculty-members': T.orange,
  requests: T.warning,
  history: T.danger,
} as const
export const DEFAULT_PROGRESSION_RULES = {
  passMarkPercent: 40,
  minimumCgpaForPromotion: 5,
  requireNoActiveBacklogs: true,
}
export const ADMIN_DISMISSED_QUEUE_STORAGE_KEY = 'airmentor-admin-dismissed-queue-items'
export const ADMIN_INLINE_ACTION_QUEUE_MIN_VIEWPORT = 1400

export function applyFacultyVisibilityRules(facultyMembers: ApiFacultyRecord[]) {
  return [...facultyMembers].sort((left, right) => {
    const leftLabel = left.displayName.toLowerCase()
    const rightLabel = right.displayName.toLowerCase()
    return leftLabel.localeCompare(rightLabel) || left.facultyId.localeCompare(right.facultyId)
  })
}

export type ProvenancedRecord = Partial<LiveAdminProofProvenance>

export function hasRecordProofProvenance(record: ProvenancedRecord | null | undefined): record is LiveAdminProofProvenance {
  return !!record?.scopeDescriptor
    && !!record.resolvedFrom
    && !!record.scopeMode
    && !!record.countSource
}

export function formatRecordProofBanner(record: ProvenancedRecord | null | undefined) {
  if (!hasRecordProofProvenance(record)) return null
  return record.countSource === 'unavailable'
    ? describeProofAvailability(record)
    : describeProofProvenance(record)
}

export function shouldShowProofCheckpointCgpa(input: {
  proofScopeActive: boolean
  semesterNumber?: number | null
  stageKey?: string | null
}) {
  if (!input.proofScopeActive) return true
  return (input.semesterNumber ?? 0) > 1 && input.stageKey !== 'pre-tt1'
}

export function shouldOverlayProofCheckpointStudentSummary(input: {
  routeSection: LiveAdminRoute['section']
  studentBatchId?: string | null
  selectedProofCheckpoint?: Pick<ApiSimulationStageCheckpointSummary, 'simulationStageCheckpointId'> | null
  registryScope?: Pick<LiveAdminSearchScope, 'academicFacultyId' | 'departmentId' | 'branchId' | 'batchId'> | null
}) {
  if (input.routeSection !== 'students' || !input.selectedProofCheckpoint?.simulationStageCheckpointId) return false
  return scopeTargetsCanonicalProofHierarchy(input.registryScope) || isCanonicalProofBatchId(input.studentBatchId)
}

export function formatFacultyGrantScopeLabel(grant: Pick<ApiRoleGrant, 'scopeLabel' | 'scopeType' | 'scopeId'>) {
  return grant.scopeLabel ?? `${grant.scopeType}:${grant.scopeId}`
}

export function formatFacultyAppointmentLabel(appointment: Pick<ApiFacultyAppointment, 'departmentId' | 'departmentName' | 'departmentCode' | 'branchId' | 'branchName' | 'branchCode'>) {
  const departmentLabel = appointment.departmentName ?? appointment.departmentCode ?? appointment.departmentId
  const branchLabel = appointment.branchName ?? appointment.branchCode ?? appointment.branchId
  return branchLabel ? `${departmentLabel} · ${branchLabel}` : departmentLabel
}

export function resolveFacultyCredentialStatus(faculty: ApiFacultyRecord | null | undefined) {
  return faculty?.credentialStatus ?? {
    passwordConfigured: false,
    activeSetupRequest: false,
    latestPurpose: null,
    latestRequestedAt: null,
    latestExpiresAt: null,
  }
}

export function parseAdminRoute(hash: string): LiveAdminRoute {
  const cleaned = hash.replace(/^#\/admin/, '').replace(/^\/+/, '')
  if (!cleaned) return { section: 'overview' }
  const parts = cleaned.split('/').filter(Boolean)
  if (parts[0] === 'overview') return { section: 'overview' }
  if (parts[0] === 'proof-dashboard') return { section: 'proof-dashboard' }
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

export function routeToHash(route: LiveAdminRoute) {
  if (route.section === 'overview') return '#/admin/overview'
  if (route.section === 'proof-dashboard') return '#/admin/proof-dashboard'
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

export function defaultPolicyForm(): PolicyFormState {
  return {
    oMin: '90', aPlusMin: '80', aMin: '70', bPlusMin: '60', bMin: '55', cMin: '50', pMin: '40',
    ce: '60', see: '40', termTestsWeight: '30', quizWeight: '10', assignmentWeight: '20',
    maxTermTests: '2', maxQuizzes: '5', maxAssignments: '5',
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
    highRiskCgpaBelow: '6.5',
    mediumRiskCgpaBelow: '7.5',
    highRiskBacklogCount: '2',
    mediumRiskBacklogCount: '1',
  }
}

export function defaultEntityEditorState(currentSemester = '1'): EntityEditorState {
  return {
    academicFaculty: { code: '', name: '', overview: '' },
    department: { code: '', name: '' },
    branch: { code: '', name: '', programLevel: 'UG', semesterCount: '8' },
    batch: { admissionYear: '2022', batchLabel: '2022', currentSemester, sectionLabels: 'A, B' },
    term: { termId: '', academicYearLabel: '2026-27', semesterNumber: currentSemester, startDate: '2026-08-01', endDate: '2026-12-15' },
    curriculum: { curriculumCourseId: '', semesterNumber: currentSemester, courseCode: '', title: '', credits: '4' },
  }
}

export function defaultStudentForm(): StudentFormState {
  return {
    usn: '',
    rollNumber: '',
    name: '',
    email: '',
    phone: '',
    admissionDate: new Date().toISOString().slice(0, 10),
  }
}

export function defaultCurriculumFeatureForm(): CurriculumFeatureFormState {
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

export function hydrateCurriculumFeatureForm(item: ApiCurriculumFeatureConfigBundle['items'][number] | null): CurriculumFeatureFormState {
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

export function parseCurriculumFeatureLines(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

export function buildCurriculumFeaturePayload(form: CurriculumFeatureFormState): ApiCurriculumFeatureConfigPayload {
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
    const normalizedKind = (rawKind ?? '').toLowerCase()
    const edgeKind: 'explicit' | 'added' | null = normalizedKind === 'explicit'
      ? 'explicit'
      : normalizedKind === 'added'
        ? 'added'
        : null
    const rationale = rationaleParts.join(' | ').trim()
    if (!sourceCourseCode || !edgeKind || !rationale) {
      throw new Error(`Prerequisite line ${index + 1} must use "COURSE_CODE | explicit|added | Rationale".`)
    }
    return {
      sourceCourseCode,
      edgeKind,
      rationale,
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

export function validateCurriculumFeaturePrerequisites(
  targetCourse: ApiCurriculumFeatureConfigBundle['items'][number],
  prerequisites: ApiCurriculumFeatureConfigPayload['prerequisites'],
  items: ApiCurriculumFeatureConfigBundle['items'],
) {
  const targetSemesterNumber = Number(targetCourse.semesterNumber ?? 0)
  if (!Number.isFinite(targetSemesterNumber) || targetSemesterNumber <= 0) return

  const courseByCode = new Map(
    items.map(item => [item.courseCode.trim().toLowerCase(), item] as const),
  )

  for (const prerequisite of prerequisites) {
    const sourceCourse = courseByCode.get(prerequisite.sourceCourseCode.trim().toLowerCase())
    if (!sourceCourse) continue
    const sourceSemesterNumber = Number(sourceCourse.semesterNumber ?? 0)
    if (!Number.isFinite(sourceSemesterNumber) || sourceSemesterNumber <= 0) continue
    if (prerequisite.edgeKind === 'explicit' && sourceSemesterNumber >= targetSemesterNumber) {
      throw new Error(`Prerequisite edges require an earlier semester. Found semester ${sourceSemesterNumber} -> ${targetSemesterNumber}.`)
    }
  }
}

export const DEFAULT_STAGE_POLICY: ApiStagePolicyPayload = {
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

export const STAGE_EVIDENCE_OPTIONS: ApiStageEvidenceKind[] = ['attendance', 'tt1', 'tt2', 'quiz', 'assignment', 'finals', 'transcript']

export function defaultStagePolicyForm(): StagePolicyFormState {
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

export function hydrateStagePolicyForm(policy: ApiStagePolicyPayload | null | undefined): StagePolicyFormState {
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

export function buildStagePolicyPayload(form: StagePolicyFormState): ApiStagePolicyPayload {
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

export function defaultBatchProvisioningForm(): BatchProvisioningFormState {
  return {
    termId: '',
    sectionLabels: 'A, B',
    mode: 'live-empty',
    studentsPerSection: '60',
    facultyPoolIds: [],
    createStudents: false,
    createMentors: true,
    createAttendanceScaffolding: true,
    createAssessmentScaffolding: false,
    createTranscriptScaffolding: true,
  }
}

export function buildBatchProvisioningPayload(form: BatchProvisioningFormState): ApiBatchProvisioningRequest {
  return {
    termId: requireText('Setup term', form.termId),
    sectionLabels: parseCurriculumFeatureLines(form.sectionLabels.replace(/,/g, '\n')),
    mode: form.mode ?? 'live-empty',
    studentsPerSection: requirePositiveInteger('Students per section', form.studentsPerSection),
    facultyPoolIds: form.facultyPoolIds.length > 0 ? [...form.facultyPoolIds] : undefined,
    createStudents: form.createStudents,
    createMentors: form.createMentors,
    createAttendanceScaffolding: form.createAttendanceScaffolding,
    createAssessmentScaffolding: form.createAssessmentScaffolding,
    createTranscriptScaffolding: form.createTranscriptScaffolding,
  }
}

export function mergePolicyPayload(base: ApiResolvedBatchPolicy['effectivePolicy'], override: ApiPolicyPayload): ApiResolvedBatchPolicy['effectivePolicy'] {
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

export function defaultEnrollmentForm(): EnrollmentFormState {
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

export function defaultMentorAssignmentForm(): MentorAssignmentFormState {
  return {
    assignmentId: '',
    facultyId: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    source: 'sysadmin-manual',
  }
}

export function defaultFacultyForm(): FacultyFormState {
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

export function toRegistrySearchScope(filter: RegistryFilterState): LiveAdminSearchScope | null {
  return {
    academicFacultyId: filter.academicFacultyId || undefined,
    departmentId: filter.departmentId || undefined,
    branchId: filter.branchId || undefined,
    batchId: filter.batchId || undefined,
    sectionCode: filter.sectionCode || undefined,
  }
}

export function normalizeHierarchyScope(scope: HierarchyScopeInput | null): LiveAdminSearchScope | null {
  if (!scope) return null
  return {
    academicFacultyId: scope.academicFacultyId || undefined,
    departmentId: scope.departmentId || undefined,
    branchId: scope.branchId || undefined,
    batchId: scope.batchId || undefined,
    sectionCode: scope.sectionCode || undefined,
  }
}

export function normalizeAdminSectionCode(sectionCode: string) {
  return sectionCode.trim().toUpperCase()
}

export function buildAdminSectionScopeId(batchId: string, sectionCode: string) {
  const normalizedBatchId = batchId.trim()
  const normalizedSectionCode = normalizeAdminSectionCode(sectionCode)
  if (!normalizedBatchId || !normalizedSectionCode) {
    throw new Error('Section scope ids require both a batch id and a section code.')
  }
  return `${normalizedBatchId}::${normalizedSectionCode}`
}

export function parseAdminSectionScopeId(scopeId: string) {
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

export function fadeColor(hexColor: string, alpha: string) {
  const trimmed = hexColor.trim()
  if (!trimmed.startsWith('#')) return trimmed
  const normalized = trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed
  return `${normalized}${alpha}`
}

export function defaultAppointmentForm(): AppointmentFormState {
  return {
    appointmentId: '',
    departmentId: '',
    branchId: '',
    isPrimary: false,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

export function defaultRoleGrantForm(): RoleGrantFormState {
  return {
    grantId: '',
    roleCode: 'MENTOR',
    scopeType: 'department',
    scopeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  }
}

export function defaultOwnershipForm(): OwnershipFormState {
  return {
    ownershipId: '',
    offeringId: '',
    facultyId: '',
  }
}

export function hydratePolicyForm(policy: ApiResolvedBatchPolicy['effectivePolicy']): PolicyFormState {
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

export function buildPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
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

export function toErrorMessage(error: unknown) {
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

export function requireText(label: string, value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

export function requirePositiveInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive whole number.`)
  return parsed
}

export function requireNonNegativeInteger(label: string, value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number.`)
  return parsed
}

export function requirePositiveEvenInteger(label: string, value: string) {
  const parsed = requirePositiveInteger(label, value)
  if (parsed % 2 !== 0) throw new Error(`${label} must be an even whole number.`)
  return parsed
}

export function requireDate(label: string, value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${label} must use YYYY-MM-DD format.`)
  return trimmed
}

export function requireRange(label: string, value: string, minimum: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
  return parsed
}

export function buildValidatedPolicyPayload(form: PolicyFormState): ApiResolvedBatchPolicy['effectivePolicy'] {
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

export function formatClockLabel(now: Date) {
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function readStringField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'string' ? value : null
}

export function readNumberField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readBooleanField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return typeof value === 'boolean' ? value : null
}

export function readRecordField(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function formatSplitSummary(summary: Record<string, unknown> | null | undefined) {
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

export function formatKeyedCounts(summary: Record<string, unknown> | null | undefined) {
  if (!summary) return 'Unavailable'
  const entries = Object.entries(summary)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} ${value}`)
  return entries.length > 0 ? entries.join(' · ') : 'Unavailable'
}

export function formatHeadSupportSummary(summary: Record<string, unknown> | null | undefined) {
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

export function formatDiagnosticSummary(summary: Record<string, unknown> | null | undefined) {
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

export function summarizeAuditEvent(event: ApiAuditEvent) {
  const action = event.action.replace(/[_-]+/g, ' ')
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export function getAuditEventRoute(event: ApiAuditEvent): LiveAdminRoute | null {
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

export function createAdminWorkspaceSnapshot(input: Omit<AdminWorkspaceSnapshot, 'scrollY'>): AdminWorkspaceSnapshot {
  return {
    ...input,
    scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
  }
}

export function getAdminWorkspaceSnapshotKey(snapshot: Omit<AdminWorkspaceSnapshot, 'scrollY'> | AdminWorkspaceSnapshot) {
  return `${routeToHash(snapshot.route)}::${snapshot.universityTab}::${snapshot.selectedSectionCode ?? ''}`
}

// matchesStudentScope, matchesFacultyScope, and matchesOfferingScope are now imported from './system-admin-overview-helpers'

export function matchesBatchScope(batch: LiveAdminDataset['batches'][number], data: LiveAdminDataset, scopeType: ApiScopeType, scopeId: string) {
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


export function toOptionalScopeValue(value?: string | null) {
  return value ?? undefined
}
