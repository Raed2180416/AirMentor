import type {
  Mentee,
  Offering,
  Professor,
  Student,
  StudentHistoryRecord,
  SubjectRun,
  TeacherInfo,
  YearGroup,
} from '../data'
import type {
  CalendarAuditEvent,
  EntryLockMap,
  FacultyAccount,
  FacultyTimetableTemplate,
  QueueTransition,
  SchemeState,
  SharedTask,
  StudentRuntimePatch,
  TaskCalendarPlacement,
  TTKind,
  TermTestBlueprint,
} from '../domain'

export type ApiRoleCode = 'SYSTEM_ADMIN' | 'HOD' | 'COURSE_LEADER' | 'MENTOR'

export type ApiRoleGrant = {
  grantId: string
  facultyId: string
  roleCode: ApiRoleCode
  scopeType: string
  scopeId: string
  startDate?: string | null
  endDate?: string | null
  status: string
  version: number
}

export type ApiUiPreferences = {
  userId: string
  themeMode: 'frosted-focus-light' | 'frosted-focus-dark'
  version: number
  updatedAt: string
}

export type ApiSessionResponse = {
  sessionId: string
  user: {
    userId: string
    username: string
    email: string
  }
  faculty: {
    facultyId: string
    displayName: string | null
  } | null
  activeRoleGrant: ApiRoleGrant
  availableRoleGrants: ApiRoleGrant[]
  preferences: ApiUiPreferences
}

export type ApiLoginRequest = {
  identifier: string
  password: string
}

export type ApiInstitution = {
  institutionId: string
  name: string
  timezone: string
  academicYearStartMonth: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicFaculty = {
  academicFacultyId: string
  institutionId: string
  code: string
  name: string
  overview: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiDepartment = {
  departmentId: string
  institutionId: string
  academicFacultyId: string | null
  code: string
  name: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBranch = {
  branchId: string
  departmentId: string
  code: string
  name: string
  programLevel: string
  semesterCount: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiBatch = {
  batchId: string
  branchId: string
  admissionYear: number
  batchLabel: string
  currentSemester: number
  sectionLabels: string[]
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicTerm = {
  termId: string
  branchId: string
  batchId: string | null
  academicYearLabel: string
  semesterNumber: number
  startDate: string
  endDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyAppointment = {
  appointmentId: string
  facultyId: string
  departmentId: string
  departmentName?: string | null
  departmentCode?: string | null
  branchId: string | null
  branchName?: string | null
  branchCode?: string | null
  isPrimary: boolean
  startDate: string
  endDate: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiFacultyRecord = {
  facultyId: string
  userId: string
  username: string
  email: string
  phone: string | null
  employeeCode: string
  displayName: string
  designation: string
  joinedOn: string | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
  appointments: ApiFacultyAppointment[]
  roleGrants: ApiRoleGrant[]
}

export type ApiStudentEnrollment = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
  rosterOrder?: number
  academicStatus: string
  startDate: string
  endDate: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiMentorAssignment = {
  assignmentId: string
  studentId: string
  facultyId: string
  effectiveFrom: string
  effectiveTo: string | null
  source: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiStudentRecord = {
  studentId: string
  institutionId: string
  usn: string
  rollNumber: string | null
  name: string
  email: string | null
  phone: string | null
  admissionDate: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
  currentCgpa: number
  activeAcademicContext: {
    enrollmentId: string
    branchId: string
    branchName: string | null
    departmentId: string | null
    departmentName: string | null
    termId: string
    academicYearLabel: string | null
    semesterNumber: number | null
    sectionCode: string
    batchId: string | null
    batchLabel: string | null
    admissionYear: number | null
    academicStatus: string
  } | null
  activeMentorAssignment: ApiMentorAssignment | null
  enrollments: ApiStudentEnrollment[]
  mentorAssignments: ApiMentorAssignment[]
}

export type ApiCourse = {
  courseId: string
  institutionId: string
  courseCode: string
  title: string
  defaultCredits: number
  departmentId: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiCurriculumCourse = {
  curriculumCourseId: string
  batchId: string
  semesterNumber: number
  courseId: string | null
  courseCode: string
  title: string
  credits: number
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiGradeBand = {
  grade: string
  minimumMark: number
  maximumMark: number
  gradePoint: number
}

export type ApiPolicyPayload = {
  gradeBands?: ApiGradeBand[]
  ceSeeSplit?: {
    ce: number
    see: number
  }
  ceComponentCaps?: {
    termTestsWeight: number
    quizWeight: number
    assignmentWeight: number
    maxTermTests: number
    maxQuizzes: number
    maxAssignments: number
  }
  workingCalendar?: {
    days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
    dayStart: string
    dayEnd: string
  }
  sgpaCgpaRules?: {
    sgpaModel: 'credit-weighted'
    cgpaModel: 'credit-weighted-cumulative'
    rounding: '2-decimal'
    includeFailedCredits: boolean
    repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
  }
  progressionRules?: {
    passMarkPercent: number
    minimumCgpaForPromotion: number
    requireNoActiveBacklogs: boolean
  }
}

export type ApiPolicyOverride = {
  policyOverrideId: string
  scopeType: 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch'
  scopeId: string
  policy: ApiPolicyPayload
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiResolvedBatchPolicy = {
  batch: ApiBatch
  scopeChain: Array<{
    scopeType: 'institution' | 'academic-faculty' | 'department' | 'branch' | 'batch'
    scopeId: string
  }>
  appliedOverrides: Array<ApiPolicyOverride & { appliedAtScope: string }>
  effectivePolicy: {
    gradeBands: ApiGradeBand[]
    ceSeeSplit: {
      ce: number
      see: number
    }
    ceComponentCaps: {
      termTestsWeight: number
      quizWeight: number
      assignmentWeight: number
      maxTermTests: number
      maxQuizzes: number
      maxAssignments: number
    }
    workingCalendar: {
      days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>
      dayStart: string
      dayEnd: string
    }
    sgpaCgpaRules: {
      sgpaModel: 'credit-weighted'
      cgpaModel: 'credit-weighted-cumulative'
      rounding: '2-decimal'
      includeFailedCredits: boolean
      repeatedCoursePolicy: 'latest-attempt' | 'best-attempt'
    }
    progressionRules: {
      passMarkPercent: number
      minimumCgpaForPromotion: number
      requireNoActiveBacklogs: boolean
    }
  }
}

export type ApiAdminSearchRoute = {
  section: 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

export type ApiAdminSearchResult = {
  key: string
  entityType: string
  entityId: string
  label: string
  meta: string
  route: ApiAdminSearchRoute
}

export type ApiAdminReminder = {
  reminderId: string
  facultyId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiTargetEntityRef = {
  entityType: string
  entityId: string
}

export type ApiAdminRequestSummary = {
  adminRequestId: string
  requestType: string
  scopeType: string
  scopeId: string
  targetEntityRefs: ApiTargetEntityRef[]
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: 'New' | 'In Review' | 'Needs Info' | 'Approved' | 'Rejected' | 'Implemented' | 'Closed'
  requestedByRole: ApiRoleCode
  requestedByFacultyId: string
  ownedByRole: ApiRoleCode
  ownedByFacultyId: string | null
  summary: string
  details: string
  notesThreadId: string
  dueAt: string
  slaPolicyCode: string
  decision: string | null
  payload: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  requesterName?: string | null
  ownerName?: string | null
}

export type ApiAdminRequestNote = {
  noteId: string
  adminRequestId: string
  authorRole: string
  authorFacultyId: string | null
  visibility: string
  noteType: string
  body: string
  createdAt: string
}

export type ApiAdminRequestTransition = {
  transitionId: string
  adminRequestId: string
  previousStatus: string | null
  nextStatus: string
  actorRole: string
  actorFacultyId: string | null
  noteId: string | null
  affectedEntityRefs: ApiTargetEntityRef[]
  createdAt: string
}

export type ApiAuditEvent = {
  auditEventId: string
  entityType: string
  entityId: string
  action: string
  actorRole: string
  actorId: string | null
  before: unknown
  after: unknown
  metadata: unknown
  createdAt: string
}

export type ApiAdminRequestDetail = ApiAdminRequestSummary & {
  notes: ApiAdminRequestNote[]
  transitions: ApiAdminRequestTransition[]
}

export type ApiAcademicLoginFaculty = {
  facultyId: string
  name: string
  dept: string
  roleTitle: string
  allowedRoles: Array<'Course Leader' | 'Mentor' | 'HoD'>
}

export type ApiAcademicRuntimeState = {
  studentPatches: Record<string, StudentRuntimePatch>
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  drafts: Record<string, number>
  cellValues: Record<string, number>
  lockByOffering: Record<string, EntryLockMap>
  lockAuditByTarget: Record<string, QueueTransition[]>
  tasks: SharedTask[]
  resolvedTasks: Record<string, number>
  timetableByFacultyId: Record<string, FacultyTimetableTemplate>
  taskPlacements: Record<string, TaskCalendarPlacement>
  calendarAudit: CalendarAuditEvent[]
}

export type ApiAcademicBootstrap = {
  professor: Professor
  faculty: FacultyAccount[]
  offerings: Offering[]
  yearGroups: YearGroup[]
  mentees: Mentee[]
  teachers: TeacherInfo[]
  subjectRuns: SubjectRun[]
  studentsByOffering: Record<string, Student[]>
  studentHistoryByUsn: Record<string, StudentHistoryRecord>
  runtime: ApiAcademicRuntimeState
}

export type ApiAcademicRuntimeKey = keyof ApiAcademicRuntimeState

export type ApiAdminOffering = Offering & {
  termId?: string
  branchId?: string
  version?: number
}

export type ApiAdminCalendarMarkerType =
  | 'semester-start'
  | 'semester-end'
  | 'term-test-start'
  | 'term-test-end'
  | 'holiday'
  | 'event'

export type ApiAdminCalendarMarker = {
  markerId: string
  facultyId: string
  markerType: ApiAdminCalendarMarkerType
  title: string
  note: string | null
  dateISO: string
  endDateISO: string | null
  allDay: boolean
  startMinutes: number | null
  endMinutes: number | null
  color: string
  createdAt: number
  updatedAt: number
}

export type ApiAdminFacultyCalendarWorkspace = {
  publishedAt: string | null
  markers: ApiAdminCalendarMarker[]
}

export type ApiAdminFacultyCalendar = {
  facultyId: string
  template: FacultyTimetableTemplate | null
  workspace: ApiAdminFacultyCalendarWorkspace
  directEditWindowEndsAt: string | null
  classEditingLocked: boolean
}

export type ApiOfferingOwnership = {
  ownershipId: string
  offeringId: string
  facultyId: string
  ownershipRole: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiAcademicFacultyProfile = {
  facultyId: string
  displayName: string
  designation: string
  employeeCode: string
  email: string
  phone: string | null
  primaryDepartment: {
    departmentId: string
    name: string
    code: string
  } | null
  appointments: ApiFacultyAppointment[]
  permissions: ApiRoleGrant[]
  subjectRunCourseLeaderScope: Array<{
    subjectRunId: string
    courseCode: string
    title: string
    termId: string
    yearLabel: string
    sectionCodes: string[]
  }>
  mentorScope: {
    activeStudentCount: number
    studentIds: string[]
  }
  currentOwnedClasses: Array<{
    offeringId: string
    courseCode: string
    title: string
    yearLabel: string
    sectionCode: string
    ownershipRole: string
    departmentName: string | null
    branchName: string | null
  }>
  timetableStatus: {
    hasTemplate: boolean
    publishedAt: string | null
    directEditWindowEndsAt: string | null
  }
  requestSummary: {
    openCount: number
    recent: Array<{
      adminRequestId: string
      summary: string
      status: string
      updatedAt: string
    }>
  }
}
