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

export type ApiDepartment = {
  departmentId: string
  institutionId: string
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

export type ApiFacultyAppointment = {
  appointmentId: string
  facultyId: string
  departmentId: string
  branchId: string | null
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
  appointments: ApiFacultyAppointment[]
  roleGrants: ApiRoleGrant[]
}

export type ApiStudentEnrollment = {
  enrollmentId: string
  studentId: string
  branchId: string
  termId: string
  sectionCode: string
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
