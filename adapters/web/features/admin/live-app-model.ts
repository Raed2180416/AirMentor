import type {
  ApiAcademicFaculty,
  ApiAuditEvent,
  ApiBatchProvisioningRequest,
  ApiBatch,
  ApiBranch,
  ApiDepartment,
  ApiFacultyRecord,
  ApiFacultyAppointment,
  ApiPolicyPayload,
  ApiResolvedBatchPolicy,
  ApiScopeType,
  ApiRoleGrant,
  ApiSimulationStageCheckpointSummary,
} from '@web/shared/api/types'
import { T } from '@web/simulation/fixtures'
import {
  resolveBranch,
  resolveDepartment,
  type LiveAdminProofProvenance,
  type LiveAdminDataset,
  type LiveAdminRoute,
  type LiveAdminSearchScope,
} from './system-admin-live-data'
import { describeProofAvailability, describeProofProvenance } from '@web/simulation/proof-provenance'
import {
  isCanonicalProofBatchId,
  scopeTargetsCanonicalProofHierarchy,
} from '@web/simulation/proof-pilot'
import {
  requirePositiveInteger,
  requireRange,
  requireText,
} from './live-app-validation'
import {
  parseAdminSectionScopeId,
  routeToHash,
} from './live-app-routes-and-scopes'
import { parseCurriculumFeatureLines } from './live-app-curriculum-feature-model'

export {
  toErrorMessage,
  requireText,
  requirePositiveInteger,
  requireNonNegativeInteger,
  requirePositiveEvenInteger,
  requireDate,
  requireRange,
} from './live-app-validation'
export {
  formatClockLabel,
  readStringField,
  readNumberField,
  readBooleanField,
  readRecordField,
  formatSplitSummary,
  formatKeyedCounts,
  formatHeadSupportSummary,
  formatDiagnosticSummary,
  summarizeAuditEvent,
} from './live-app-diagnostic-formatters'
export {
  parseAdminRoute,
  routeToHash,
  toRegistrySearchScope,
  normalizeHierarchyScope,
  normalizeAdminSectionCode,
  buildAdminSectionScopeId,
  parseAdminSectionScopeId,
  buildAdminActiveScopeChain,
  fadeColor,
} from './live-app-routes-and-scopes'
export type { ActiveAdminScope } from './live-app-routes-and-scopes'
export {
  defaultCurriculumFeatureForm,
  hydrateCurriculumFeatureForm,
  parseCurriculumFeatureLines,
  buildCurriculumFeaturePayload,
  validateCurriculumFeaturePrerequisites,
} from './live-app-curriculum-feature-model'
export type { CurriculumFeatureFormState } from './live-app-curriculum-feature-model'
export {
  defaultEntityEditorState,
  defaultStudentForm,
  defaultEnrollmentForm,
  defaultMentorAssignmentForm,
  defaultFacultyForm,
  defaultAppointmentForm,
  defaultRoleGrantForm,
  defaultOwnershipForm,
} from './live-app-editor-forms'
export type {
  StructureFormState,
  EntityEditorState,
  StudentFormState,
  EnrollmentFormState,
  MentorAssignmentFormState,
  FacultyFormState,
  AppointmentFormState,
  RoleGrantFormState,
  OwnershipFormState,
} from './live-app-editor-forms'
export {
  DEFAULT_STAGE_POLICY,
  STAGE_EVIDENCE_OPTIONS,
  defaultStagePolicyForm,
  hydrateStagePolicyForm,
  buildStagePolicyPayload,
} from './live-app-stage-policy-model'
export type { StagePolicyFormState } from './live-app-stage-policy-model'

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

// describeRegistryScope is now imported from './system-admin-overview-helpers'

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

// isLeaderLikeOwnership and isCurrentRoleGrant are now imported from './system-admin-overview-helpers'

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
