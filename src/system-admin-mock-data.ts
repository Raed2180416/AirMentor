export type AdminSectionId = 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'

export type AdminRolePermission = 'HOD' | 'Mentor' | 'Course Leader'
export type AdminRequestStatus = 'New' | 'In Progress' | 'Implemented'
export type AdminRequestType = 'timetable-change' | 'mentor-assignment-change'
export type PolicyScope = 'institution' | 'faculty' | 'department' | 'branch' | 'batch'
export type WeekdayCode = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'

export type GradeBand = {
  label: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F'
  minScore: number
  gradePoint: number
}

export type AssessmentCaps = {
  ce: number
  see: number
  termTestsWeight: number
  quizWeight: number
  assignmentWeight: number
  maxQuizCount: number
  maxAssignmentCount: number
}

export type WorkingSchedulePolicy = {
  workingDays: WeekdayCode[]
  dayStart: string
  dayEnd: string
}

export type CalculationRules = {
  sgpaModel: 'credit-weighted'
  cgpaModel: 'credit-weighted-cumulative'
  failHandling: 'exclude-failed-from-earned-credits'
  repeatHandling: 'latest-attempt-replaces'
  rounding: '2-decimal'
}

export type ResolvedPolicy = {
  gradingBands: GradeBand[]
  assessment: AssessmentCaps
  schedule: WorkingSchedulePolicy
  calculation: CalculationRules
}

export type PolicyOverride = Partial<{
  gradingBands: GradeBand[]
  assessment: Partial<AssessmentCaps>
  schedule: Partial<WorkingSchedulePolicy>
  calculation: Partial<CalculationRules>
}>

export type AcademicFacultyRecord = {
  id: string
  name: string
  code: string
  overview: string
  policyOverride?: PolicyOverride
}

export type DepartmentRecord = {
  id: string
  facultyId: string
  name: string
  code: string
  policyOverride?: PolicyOverride
}

export type BranchRecord = {
  id: string
  departmentId: string
  name: string
  code: string
  programLabel: string
  semesterCount: number
  policyOverride?: PolicyOverride
}

export type BatchRecord = {
  id: string
  branchId: string
  label: string
  admissionYear: number
  activeSemester: number
  sectionLabels: string[]
  policyOverride?: PolicyOverride
}

export type CurriculumCourseRecord = {
  id: string
  batchId: string
  semesterNumber: number
  courseCode: string
  title: string
  credits: number
}

export type StudentHistoryCourse = {
  courseCode: string
  title: string
  credits: number
  grade: string
}

export type StudentHistoryTerm = {
  termLabel: string
  sgpa: number
  creditsEarned: number
  courses: StudentHistoryCourse[]
}

export type StudentRecord = {
  id: string
  universityId: string
  name: string
  academicFacultyId: string
  departmentId: string
  branchId: string
  batchId: string
  section: string
  activeSemester: number
  programLabel: string
  email: string
  phone: string
  cgpaCurrent: number
  mentorFacultyMemberId: string
  history: StudentHistoryTerm[]
}

export type TeachingAssignment = {
  id: string
  departmentId: string
  branchId: string
  batchId: string
  section: string
  semesterNumber: number
  courseCode: string
  courseTitle: string
  ownership: 'PRIMARY' | 'ADDITIONAL'
  weeklyPattern: string[]
}

export type ScheduleException = {
  id: string
  weekLabel: string
  summary: string
  status: 'Applied' | 'Pending HOD Sync'
}

export type FacultyMemberRecord = {
  id: string
  employeeCode: string
  name: string
  permissions: AdminRolePermission[]
  primaryDepartmentId: string
  email: string
  phone: string
  teachingAssignments: TeachingAssignment[]
  scheduleExceptions: ScheduleException[]
  mentorStudentIds: string[]
}

export type AdminRequestPayload =
  | {
      type: 'timetable-change'
      facultyMemberId: string
      teachingAssignmentId: string
      nextWeeklyPattern: string[]
    }
  | {
      type: 'mentor-assignment-change'
      studentId: string
      nextMentorFacultyMemberId: string
    }

export type AdminRequestRecord = {
  id: string
  type: AdminRequestType
  status: AdminRequestStatus
  requestedBy: string
  requestedRole: 'HOD'
  targetFacultyMemberId: string
  relatedBatchId?: string
  summary: string
  detail: string
  requestedAt: string
  implementedAt?: string
  implementationNote?: string
  payload: AdminRequestPayload
}

export type MockAdminState = {
  institution: {
    name: string
    academicYearStartMonth: number
  }
  defaultPolicy: ResolvedPolicy
  faculties: AcademicFacultyRecord[]
  departments: DepartmentRecord[]
  branches: BranchRecord[]
  batches: BatchRecord[]
  curriculumCourses: CurriculumCourseRecord[]
  students: StudentRecord[]
  facultyMembers: FacultyMemberRecord[]
  requests: AdminRequestRecord[]
}

export type SearchResultKind = 'faculty' | 'department' | 'branch' | 'batch' | 'student' | 'faculty-member' | 'course'

export type AdminSearchResult = {
  id: string
  kind: SearchResultKind
  title: string
  subtitle: string
  route: string
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function yearLabelForSemester(activeSemester: number) {
  const year = Math.max(1, Math.ceil(activeSemester / 2))
  return year === 1 ? '1st Year'
    : year === 2 ? '2nd Year'
    : year === 3 ? '3rd Year'
    : '4th Year'
}

export function deriveCurrentYearLabel(activeSemester: number) {
  return yearLabelForSemester(activeSemester)
}

export function resolveDepartment(state: MockAdminState, departmentId: string) {
  return state.departments.find(item => item.id === departmentId) ?? null
}

export function resolveBranch(state: MockAdminState, branchId: string) {
  return state.branches.find(item => item.id === branchId) ?? null
}

export function resolveBatch(state: MockAdminState, batchId: string) {
  return state.batches.find(item => item.id === batchId) ?? null
}

export function resolveFaculty(state: MockAdminState, facultyId: string) {
  return state.faculties.find(item => item.id === facultyId) ?? null
}

export function resolveStudent(state: MockAdminState, studentId: string) {
  return state.students.find(item => item.id === studentId) ?? null
}

export function resolveFacultyMember(state: MockAdminState, facultyMemberId: string) {
  return state.facultyMembers.find(item => item.id === facultyMemberId) ?? null
}

function mergePolicy(base: ResolvedPolicy, override?: PolicyOverride): ResolvedPolicy {
  if (!override) return deepClone(base)
  return {
    gradingBands: override.gradingBands ? deepClone(override.gradingBands) : deepClone(base.gradingBands),
    assessment: {
      ...base.assessment,
      ...(override.assessment ?? {}),
    },
    schedule: {
      ...base.schedule,
      ...(override.schedule ?? {}),
    },
    calculation: {
      ...base.calculation,
      ...(override.calculation ?? {}),
    },
  }
}

export function resolvePolicyForBatch(state: MockAdminState, batchId: string) {
  const batch = resolveBatch(state, batchId)
  if (!batch) return null
  const branch = resolveBranch(state, batch.branchId)
  if (!branch) return null
  const department = resolveDepartment(state, branch.departmentId)
  if (!department) return null
  const faculty = resolveFaculty(state, department.facultyId)
  if (!faculty) return null

  const effectivePolicy = [
    { scope: 'institution' as const, override: undefined },
    { scope: 'faculty' as const, override: faculty.policyOverride },
    { scope: 'department' as const, override: department.policyOverride },
    { scope: 'branch' as const, override: branch.policyOverride },
    { scope: 'batch' as const, override: batch.policyOverride },
  ].reduce((current, item) => mergePolicy(current, item.override), state.defaultPolicy)

  return {
    faculty,
    department,
    branch,
    batch,
    effectivePolicy,
  }
}

export function searchAdminWorkspace(state: MockAdminState, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return [] as AdminSearchResult[]

  const results: AdminSearchResult[] = []
  const push = (item: AdminSearchResult) => {
    if (!results.some(existing => existing.kind === item.kind && existing.id === item.id)) {
      results.push(item)
    }
  }

  state.faculties.forEach(item => {
    if (`${item.name} ${item.code}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'faculty',
        title: item.name,
        subtitle: `Academic faculty · ${item.code}`,
        route: `/faculties/${item.id}`,
      })
    }
  })

  state.departments.forEach(item => {
    const faculty = resolveFaculty(state, item.facultyId)
    if (`${item.name} ${item.code}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'department',
        title: item.name,
        subtitle: `Department · ${faculty?.name ?? 'Unknown faculty'}`,
        route: `/faculties/${item.facultyId}/departments/${item.id}`,
      })
    }
  })

  state.branches.forEach(item => {
    const department = resolveDepartment(state, item.departmentId)
    if (`${item.name} ${item.code} ${item.programLabel}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'branch',
        title: `${item.name} (${item.code})`,
        subtitle: `Branch · ${department?.name ?? 'Unknown department'}`,
        route: `/faculties/${department ? resolveFaculty(state, department.facultyId)?.id ?? '' : ''}/departments/${item.departmentId}/branches/${item.id}`,
      })
    }
  })

  state.batches.forEach(item => {
    const branch = resolveBranch(state, item.branchId)
    const department = branch ? resolveDepartment(state, branch.departmentId) : null
    const facultyId = department ? resolveFaculty(state, department.facultyId)?.id ?? '' : ''
    const yearLabel = yearLabelForSemester(item.activeSemester)
    if (`${item.label} ${item.admissionYear} ${yearLabel} ${branch?.name ?? ''}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'batch',
        title: `${branch?.code ?? ''} · Batch ${item.label}`,
        subtitle: `${yearLabel} · Sem ${item.activeSemester}`,
        route: `/faculties/${facultyId}/departments/${branch?.departmentId ?? ''}/branches/${item.branchId}/batches/${item.id}`,
      })
    }
  })

  state.students.forEach(item => {
    if (`${item.name} ${item.universityId} ${item.email}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'student',
        title: item.name,
        subtitle: `Student · ${item.universityId}`,
        route: `/students/${item.id}`,
      })
    }
  })

  state.facultyMembers.forEach(item => {
    if (`${item.name} ${item.employeeCode} ${item.email}`.toLowerCase().includes(query)) {
      push({
        id: item.id,
        kind: 'faculty-member',
        title: item.name,
        subtitle: `Faculty member · ${item.employeeCode}`,
        route: `/faculty-members/${item.id}`,
      })
    }
  })

  state.curriculumCourses.forEach(item => {
    if (`${item.courseCode} ${item.title}`.toLowerCase().includes(query)) {
      const batch = resolveBatch(state, item.batchId)
      const branch = batch ? resolveBranch(state, batch.branchId) : null
      const department = branch ? resolveDepartment(state, branch.departmentId) : null
      const facultyId = department ? resolveFaculty(state, department.facultyId)?.id ?? '' : ''
      push({
        id: item.id,
        kind: 'course',
        title: `${item.courseCode} · ${item.title}`,
        subtitle: `Semester ${item.semesterNumber} · Batch ${batch?.label ?? 'Unknown'}`,
        route: `/faculties/${facultyId}/departments/${branch?.departmentId ?? ''}/branches/${branch?.id ?? ''}/batches/${item.batchId}`,
      })
    }
  })

  const kindOrder: Record<SearchResultKind, number> = {
    faculty: 0,
    department: 1,
    branch: 2,
    batch: 3,
    student: 4,
    'faculty-member': 5,
    course: 6,
  }

  return results
    .sort((left, right) => {
      const byKind = kindOrder[left.kind] - kindOrder[right.kind]
      if (byKind !== 0) return byKind
      return left.title.localeCompare(right.title)
    })
    .slice(0, 12)
}

export function listCurriculumBySemester(state: MockAdminState, batchId: string) {
  return Array.from({ length: 8 }, (_, index) => {
    const semesterNumber = index + 1
    const courses = state.curriculumCourses
      .filter(item => item.batchId === batchId && item.semesterNumber === semesterNumber)
      .sort((left, right) => left.courseCode.localeCompare(right.courseCode))
    return { semesterNumber, courses }
  })
}

export function implementAdminRequest(state: MockAdminState, requestId: string, implementationNote: string) {
  const next = deepClone(state)
  const request = next.requests.find(item => item.id === requestId)
  if (!request) return next
  const payload = request.payload

  switch (payload.type) {
    case 'mentor-assignment-change': {
      const targetStudent = next.students.find(item => item.id === payload.studentId)
      if (targetStudent) targetStudent.mentorFacultyMemberId = payload.nextMentorFacultyMemberId
      break
    }
    case 'timetable-change': {
      const targetFacultyMember = next.facultyMembers.find(item => item.id === payload.facultyMemberId)
      if (targetFacultyMember) {
        targetFacultyMember.teachingAssignments = targetFacultyMember.teachingAssignments.map(item => (
          item.id === payload.teachingAssignmentId
            ? { ...item, weeklyPattern: deepClone(payload.nextWeeklyPattern) }
            : item
        ))
      }
      break
    }
  }

  request.status = 'Implemented'
  request.implementedAt = '2026-03-16T11:30:00.000Z'
  request.implementationNote = implementationNote.trim() || 'Implemented by system admin in mock mode.'

  return next
}

function course(id: string, batchId: string, semesterNumber: number, courseCode: string, title: string, credits: number): CurriculumCourseRecord {
  return { id, batchId, semesterNumber, courseCode, title, credits }
}

const defaultPolicy: ResolvedPolicy = {
  gradingBands: [
    { label: 'O', minScore: 90, gradePoint: 10 },
    { label: 'A+', minScore: 75, gradePoint: 9 },
    { label: 'A', minScore: 60, gradePoint: 8 },
    { label: 'B+', minScore: 55, gradePoint: 7 },
    { label: 'B', minScore: 50, gradePoint: 6 },
    { label: 'C', minScore: 45, gradePoint: 5 },
    { label: 'P', minScore: 40, gradePoint: 4 },
    { label: 'F', minScore: 0, gradePoint: 0 },
  ],
  assessment: {
    ce: 60,
    see: 40,
    termTestsWeight: 30,
    quizWeight: 10,
    assignmentWeight: 20,
    maxQuizCount: 2,
    maxAssignmentCount: 2,
  },
  schedule: {
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayStart: '08:30',
    dayEnd: '16:30',
  },
  calculation: {
    sgpaModel: 'credit-weighted',
    cgpaModel: 'credit-weighted-cumulative',
    failHandling: 'exclude-failed-from-earned-credits',
    repeatHandling: 'latest-attempt-replaces',
    rounding: '2-decimal',
  },
}

const seededState: MockAdminState = {
  institution: {
    name: 'M.S. Ramaiah University',
    academicYearStartMonth: 7,
  },
  defaultPolicy,
  faculties: [
    {
      id: 'fac-eng-tech',
      name: 'Engineering and Technology',
      code: 'FET',
      overview: 'Undergraduate and postgraduate engineering programs with batch-sensitive evaluation rules.',
      policyOverride: {
        schedule: {
          workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        },
      },
    },
    {
      id: 'fac-medicine',
      name: 'Medicine',
      code: 'MED',
      overview: 'Clinical programs with longer day windows and different academic calendar expectations.',
      policyOverride: {
        schedule: {
          dayStart: '07:30',
          dayEnd: '17:00',
        },
      },
    },
  ],
  departments: [
    {
      id: 'dept-cse',
      facultyId: 'fac-eng-tech',
      name: 'Computer Science and Engineering',
      code: 'CSE',
      policyOverride: {
        assessment: {
          quizWeight: 15,
          assignmentWeight: 15,
        },
      },
    },
    {
      id: 'dept-ece',
      facultyId: 'fac-eng-tech',
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    },
    {
      id: 'dept-med',
      facultyId: 'fac-medicine',
      name: 'Internal Medicine',
      code: 'IMD',
    },
  ],
  branches: [
    {
      id: 'branch-cse',
      departmentId: 'dept-cse',
      name: 'Computer Science and Engineering',
      code: 'CSE',
      programLabel: 'B.Tech',
      semesterCount: 8,
      policyOverride: {
        assessment: {
          maxQuizCount: 3,
        },
      },
    },
    {
      id: 'branch-aids',
      departmentId: 'dept-cse',
      name: 'Artificial Intelligence and Data Science',
      code: 'AI&DS',
      programLabel: 'B.Tech',
      semesterCount: 8,
    },
    {
      id: 'branch-mbbs',
      departmentId: 'dept-med',
      name: 'Bachelor of Medicine and Bachelor of Surgery',
      code: 'MBBS',
      programLabel: 'MBBS',
      semesterCount: 8,
    },
  ],
  batches: [
    {
      id: 'batch-cse-2021',
      branchId: 'branch-cse',
      label: '2021',
      admissionYear: 2021,
      activeSemester: 8,
      sectionLabels: ['A', 'B'],
      policyOverride: {
        gradingBands: [
          { label: 'O', minScore: 90, gradePoint: 10 },
          { label: 'A+', minScore: 75, gradePoint: 9 },
          { label: 'A', minScore: 60, gradePoint: 8 },
          { label: 'B+', minScore: 55, gradePoint: 7 },
          { label: 'B', minScore: 50, gradePoint: 6 },
          { label: 'C', minScore: 45, gradePoint: 5 },
          { label: 'P', minScore: 40, gradePoint: 4 },
          { label: 'F', minScore: 0, gradePoint: 0 },
        ],
      },
    },
    {
      id: 'batch-cse-2022',
      branchId: 'branch-cse',
      label: '2022',
      admissionYear: 2022,
      activeSemester: 6,
      sectionLabels: ['A', 'B'],
      policyOverride: {
        gradingBands: [
          { label: 'O', minScore: 92, gradePoint: 10 },
          { label: 'A+', minScore: 80, gradePoint: 9 },
          { label: 'A', minScore: 67, gradePoint: 8 },
          { label: 'B+', minScore: 58, gradePoint: 7 },
          { label: 'B', minScore: 50, gradePoint: 6 },
          { label: 'C', minScore: 45, gradePoint: 5 },
          { label: 'P', minScore: 40, gradePoint: 4 },
          { label: 'F', minScore: 0, gradePoint: 0 },
        ],
        assessment: {
          ce: 50,
          see: 50,
          termTestsWeight: 20,
          quizWeight: 15,
          assignmentWeight: 15,
          maxQuizCount: 3,
          maxAssignmentCount: 2,
        },
      },
    },
    {
      id: 'batch-aids-2023',
      branchId: 'branch-aids',
      label: '2023',
      admissionYear: 2023,
      activeSemester: 4,
      sectionLabels: ['A'],
    },
    {
      id: 'batch-mbbs-2022',
      branchId: 'branch-mbbs',
      label: '2022',
      admissionYear: 2022,
      activeSemester: 6,
      sectionLabels: ['A'],
      policyOverride: {
        assessment: {
          ce: 70,
          see: 30,
          termTestsWeight: 25,
          quizWeight: 20,
          assignmentWeight: 25,
          maxQuizCount: 2,
          maxAssignmentCount: 3,
        },
      },
    },
  ],
  curriculumCourses: [
    course('cse21-s1-ma101', 'batch-cse-2021', 1, 'MA101', 'Calculus and Linear Algebra', 4),
    course('cse21-s1-cs101', 'batch-cse-2021', 1, 'CS101', 'Programming Fundamentals', 4),
    course('cse21-s1-ph101', 'batch-cse-2021', 1, 'PH101', 'Engineering Physics', 3),
    course('cse21-s2-ma201', 'batch-cse-2021', 2, 'MA201', 'Probability and Statistics', 4),
    course('cse21-s2-cs201', 'batch-cse-2021', 2, 'CS201', 'Data Structures', 4),
    course('cse21-s2-ee201', 'batch-cse-2021', 2, 'EE201', 'Digital Design', 3),
    course('cse21-s3-cs301', 'batch-cse-2021', 3, 'CS301', 'Object Oriented Programming', 4),
    course('cse21-s3-cs302', 'batch-cse-2021', 3, 'CS302', 'Database Systems', 4),
    course('cse21-s3-hs301', 'batch-cse-2021', 3, 'HS301', 'Professional Communication', 2),
    course('cse21-s4-cs401', 'batch-cse-2021', 4, 'CS401', 'Operating Systems', 4),
    course('cse21-s4-cs402', 'batch-cse-2021', 4, 'CS402', 'Computer Networks', 4),
    course('cse21-s4-ma401', 'batch-cse-2021', 4, 'MA401', 'Discrete Optimization', 3),
    course('cse21-s5-cs501', 'batch-cse-2021', 5, 'CS501', 'Theory of Computation', 4),
    course('cse21-s5-cs502', 'batch-cse-2021', 5, 'CS502', 'Cloud Platforms', 3),
    course('cse21-s5-cs503', 'batch-cse-2021', 5, 'CS503', 'Software Engineering', 4),
    course('cse21-s6-cs601', 'batch-cse-2021', 6, 'CS601', 'Machine Learning', 4),
    course('cse21-s6-cs602', 'batch-cse-2021', 6, 'CS602', 'Data Mining', 3),
    course('cse21-s6-cs603', 'batch-cse-2021', 6, 'CS603', 'DevOps Engineering', 3),
    course('cse21-s7-cs701', 'batch-cse-2021', 7, 'CS701', 'Information Security', 4),
    course('cse21-s7-cs702', 'batch-cse-2021', 7, 'CS702', 'Big Data Systems', 4),
    course('cse21-s7-cs703', 'batch-cse-2021', 7, 'CS703', 'Capstone Project I', 6),
    course('cse21-s8-cs801', 'batch-cse-2021', 8, 'CS801', 'Capstone Project II', 8),
    course('cse21-s8-cs842', 'batch-cse-2021', 8, 'CS842', 'Distributed Systems Lab', 2),
    course('cse21-s8-cs852', 'batch-cse-2021', 8, 'CS852', 'Professional Ethics and IP', 2),
    course('cse22-s1-ma101', 'batch-cse-2022', 1, 'MA101', 'Calculus and Linear Algebra', 4),
    course('cse22-s1-cs105', 'batch-cse-2022', 1, 'CS105', 'Computational Thinking', 4),
    course('cse22-s1-ph101', 'batch-cse-2022', 1, 'PH101', 'Engineering Physics', 3),
    course('cse22-s2-ma201', 'batch-cse-2022', 2, 'MA201', 'Probability and Statistics', 4),
    course('cse22-s2-cs205', 'batch-cse-2022', 2, 'CS205', 'Structured Programming', 4),
    course('cse22-s2-ee201', 'batch-cse-2022', 2, 'EE201', 'Digital Systems', 3),
    course('cse22-s3-cs301', 'batch-cse-2022', 3, 'CS301', 'Data Structures and Algorithms', 4),
    course('cse22-s3-cs312', 'batch-cse-2022', 3, 'CS312', 'Web Engineering', 3),
    course('cse22-s3-hs301', 'batch-cse-2022', 3, 'HS301', 'Technical Writing', 2),
    course('cse22-s4-cs401', 'batch-cse-2022', 4, 'CS401', 'Database Systems', 4),
    course('cse22-s4-cs412', 'batch-cse-2022', 4, 'CS412', 'Operating Systems', 4),
    course('cse22-s4-ma401', 'batch-cse-2022', 4, 'MA401', 'Discrete Mathematics', 3),
    course('cse22-s5-cs501', 'batch-cse-2022', 5, 'CS501', 'Computer Networks', 4),
    course('cse22-s5-cs522', 'batch-cse-2022', 5, 'CS522', 'Microservices Architecture', 3),
    course('cse22-s5-cs531', 'batch-cse-2022', 5, 'CS531', 'Applied Cryptography', 3),
    course('cse22-s6-cs601', 'batch-cse-2022', 6, 'CS601', 'Software Engineering', 4),
    course('cse22-s6-cs652', 'batch-cse-2022', 6, 'CS652', 'MLOps Studio', 4),
    course('cse22-s6-cs661', 'batch-cse-2022', 6, 'CS661', 'Distributed Systems', 3),
    course('aids23-s4-ai401', 'batch-aids-2023', 4, 'AI401', 'Applied Linear Models', 4),
    course('aids23-s4-ai402', 'batch-aids-2023', 4, 'AI402', 'Data Visualization', 3),
    course('mbbs22-s6-md601', 'batch-mbbs-2022', 6, 'MD601', 'Clinical Medicine VI', 8),
    course('mbbs22-s6-md602', 'batch-mbbs-2022', 6, 'MD602', 'Surgery Rotation', 6),
  ],
  students: [
    {
      id: 'stu-aisha',
      universityId: '1MS22CS001',
      name: 'Aisha Khan',
      academicFacultyId: 'fac-eng-tech',
      departmentId: 'dept-cse',
      branchId: 'branch-cse',
      batchId: 'batch-cse-2022',
      section: 'A',
      activeSemester: 6,
      programLabel: 'B.Tech CSE',
      email: 'aisha.khan@msruas.ac.in',
      phone: '+91 98860 12001',
      cgpaCurrent: 8.42,
      mentorFacultyMemberId: 'fm-nandini',
      history: [
        {
          termLabel: 'Sem 4',
          sgpa: 8.65,
          creditsEarned: 21,
          courses: [
            { courseCode: 'CS401', title: 'Database Systems', credits: 4, grade: 'A+' },
            { courseCode: 'CS412', title: 'Operating Systems', credits: 4, grade: 'A' },
          ],
        },
        {
          termLabel: 'Sem 5',
          sgpa: 8.4,
          creditsEarned: 20,
          courses: [
            { courseCode: 'CS501', title: 'Computer Networks', credits: 4, grade: 'A+' },
            { courseCode: 'CS522', title: 'Microservices Architecture', credits: 3, grade: 'A' },
          ],
        },
      ],
    },
    {
      id: 'stu-rahul',
      universityId: '1MS21CS004',
      name: 'Rahul Menon',
      academicFacultyId: 'fac-eng-tech',
      departmentId: 'dept-cse',
      branchId: 'branch-cse',
      batchId: 'batch-cse-2021',
      section: 'B',
      activeSemester: 8,
      programLabel: 'B.Tech CSE',
      email: 'rahul.menon@msruas.ac.in',
      phone: '+91 98860 12002',
      cgpaCurrent: 7.91,
      mentorFacultyMemberId: 'fm-neha',
      history: [
        {
          termLabel: 'Sem 6',
          sgpa: 7.82,
          creditsEarned: 19,
          courses: [
            { courseCode: 'CS601', title: 'Machine Learning', credits: 4, grade: 'A' },
            { courseCode: 'CS603', title: 'DevOps Engineering', credits: 3, grade: 'B+' },
          ],
        },
        {
          termLabel: 'Sem 7',
          sgpa: 8.01,
          creditsEarned: 22,
          courses: [
            { courseCode: 'CS701', title: 'Information Security', credits: 4, grade: 'A' },
            { courseCode: 'CS703', title: 'Capstone Project I', credits: 6, grade: 'A+' },
          ],
        },
      ],
    },
    {
      id: 'stu-kavya',
      universityId: '1MS23AI003',
      name: 'Kavya Rao',
      academicFacultyId: 'fac-eng-tech',
      departmentId: 'dept-cse',
      branchId: 'branch-aids',
      batchId: 'batch-aids-2023',
      section: 'A',
      activeSemester: 4,
      programLabel: 'B.Tech AI&DS',
      email: 'kavya.rao@msruas.ac.in',
      phone: '+91 98860 12003',
      cgpaCurrent: 8.88,
      mentorFacultyMemberId: 'fm-neha',
      history: [
        {
          termLabel: 'Sem 3',
          sgpa: 8.9,
          creditsEarned: 20,
          courses: [
            { courseCode: 'AI301', title: 'Python for AI', credits: 4, grade: 'O' },
            { courseCode: 'AI302', title: 'Statistics for Data Science', credits: 4, grade: 'A+' },
          ],
        },
      ],
    },
    {
      id: 'stu-ishan',
      universityId: '1MS22MB015',
      name: 'Ishan Verma',
      academicFacultyId: 'fac-medicine',
      departmentId: 'dept-med',
      branchId: 'branch-mbbs',
      batchId: 'batch-mbbs-2022',
      section: 'A',
      activeSemester: 6,
      programLabel: 'MBBS',
      email: 'ishan.verma@msruas.ac.in',
      phone: '+91 98860 12004',
      cgpaCurrent: 8.11,
      mentorFacultyMemberId: 'fm-farah',
      history: [
        {
          termLabel: 'Sem 5',
          sgpa: 8.07,
          creditsEarned: 24,
          courses: [
            { courseCode: 'MD501', title: 'Clinical Medicine V', credits: 8, grade: 'A' },
            { courseCode: 'MD502', title: 'Community Health', credits: 4, grade: 'A+' },
          ],
        },
      ],
    },
  ],
  facultyMembers: [
    {
      id: 'fm-rekha',
      employeeCode: 'EMP-CSE-017',
      name: 'Dr. Rekha Rao',
      permissions: ['HOD', 'Course Leader'],
      primaryDepartmentId: 'dept-cse',
      email: 'rekha.rao@msruas.ac.in',
      phone: '+91 99860 00017',
      teachingAssignments: [
        {
          id: 'ta-rekha-se',
          departmentId: 'dept-cse',
          branchId: 'branch-cse',
          batchId: 'batch-cse-2022',
          section: 'A',
          semesterNumber: 6,
          courseCode: 'CS601',
          courseTitle: 'Software Engineering',
          ownership: 'PRIMARY',
          weeklyPattern: ['Mon 09:00-10:00', 'Wed 09:00-10:00', 'Fri 11:00-12:00'],
        },
        {
          id: 'ta-rekha-capstone',
          departmentId: 'dept-cse',
          branchId: 'branch-cse',
          batchId: 'batch-cse-2021',
          section: 'B',
          semesterNumber: 8,
          courseCode: 'CS801',
          courseTitle: 'Capstone Project II',
          ownership: 'PRIMARY',
          weeklyPattern: ['Tue 10:00-11:00', 'Thu 10:00-11:00'],
        },
      ],
      scheduleExceptions: [],
      mentorStudentIds: [],
    },
    {
      id: 'fm-nandini',
      employeeCode: 'EMP-CSE-041',
      name: 'Prof. Nandini Shah',
      permissions: ['Mentor', 'Course Leader'],
      primaryDepartmentId: 'dept-cse',
      email: 'nandini.shah@msruas.ac.in',
      phone: '+91 99860 00041',
      teachingAssignments: [
        {
          id: 'ta-nandini-mlops',
          departmentId: 'dept-cse',
          branchId: 'branch-cse',
          batchId: 'batch-cse-2022',
          section: 'B',
          semesterNumber: 6,
          courseCode: 'CS652',
          courseTitle: 'MLOps Studio',
          ownership: 'PRIMARY',
          weeklyPattern: ['Tue 09:00-10:00', 'Thu 09:00-10:00'],
        },
        {
          id: 'ta-nandini-aids',
          departmentId: 'dept-cse',
          branchId: 'branch-aids',
          batchId: 'batch-aids-2023',
          section: 'A',
          semesterNumber: 4,
          courseCode: 'AI402',
          courseTitle: 'Data Visualization',
          ownership: 'ADDITIONAL',
          weeklyPattern: ['Fri 14:00-15:00'],
        },
      ],
      scheduleExceptions: [
        {
          id: 'sx-nandini-1',
          weekLabel: 'Week of 17 Mar 2026',
          summary: 'Shifted Thursday MLOps class to Friday morning for accreditation visit.',
          status: 'Applied',
        },
      ],
      mentorStudentIds: ['stu-aisha'],
    },
    {
      id: 'fm-arjun',
      employeeCode: 'EMP-ECE-028',
      name: 'Dr. Arjun Menon',
      permissions: ['Course Leader'],
      primaryDepartmentId: 'dept-ece',
      email: 'arjun.menon@msruas.ac.in',
      phone: '+91 99860 00028',
      teachingAssignments: [
        {
          id: 'ta-arjun-dslab',
          departmentId: 'dept-cse',
          branchId: 'branch-cse',
          batchId: 'batch-cse-2021',
          section: 'A',
          semesterNumber: 8,
          courseCode: 'CS842',
          courseTitle: 'Distributed Systems Lab',
          ownership: 'ADDITIONAL',
          weeklyPattern: ['Mon 14:00-16:00'],
        },
      ],
      scheduleExceptions: [],
      mentorStudentIds: [],
    },
    {
      id: 'fm-neha',
      employeeCode: 'EMP-CSE-055',
      name: 'Dr. Neha Kulkarni',
      permissions: ['Mentor'],
      primaryDepartmentId: 'dept-cse',
      email: 'neha.kulkarni@msruas.ac.in',
      phone: '+91 99860 00055',
      teachingAssignments: [
        {
          id: 'ta-neha-aids',
          departmentId: 'dept-cse',
          branchId: 'branch-aids',
          batchId: 'batch-aids-2023',
          section: 'A',
          semesterNumber: 4,
          courseCode: 'AI401',
          courseTitle: 'Applied Linear Models',
          ownership: 'PRIMARY',
          weeklyPattern: ['Wed 11:00-12:00', 'Sat 09:00-10:00'],
        },
      ],
      scheduleExceptions: [],
      mentorStudentIds: ['stu-rahul', 'stu-kavya'],
    },
    {
      id: 'fm-farah',
      employeeCode: 'EMP-MED-013',
      name: 'Dr. Farah Siddiqui',
      permissions: ['HOD', 'Mentor'],
      primaryDepartmentId: 'dept-med',
      email: 'farah.siddiqui@msruas.ac.in',
      phone: '+91 99860 00013',
      teachingAssignments: [
        {
          id: 'ta-farah-clinic',
          departmentId: 'dept-med',
          branchId: 'branch-mbbs',
          batchId: 'batch-mbbs-2022',
          section: 'A',
          semesterNumber: 6,
          courseCode: 'MD601',
          courseTitle: 'Clinical Medicine VI',
          ownership: 'PRIMARY',
          weeklyPattern: ['Mon 08:00-10:00', 'Thu 08:00-10:00'],
        },
      ],
      scheduleExceptions: [
        {
          id: 'sx-farah-1',
          weekLabel: 'Week of 24 Mar 2026',
          summary: 'Added one extra ward round on Saturday morning.',
          status: 'Pending HOD Sync',
        },
      ],
      mentorStudentIds: ['stu-ishan'],
    },
  ],
  requests: [
    {
      id: 'req-timetable-1',
      type: 'timetable-change',
      status: 'New',
      requestedBy: 'Dr. Rekha Rao',
      requestedRole: 'HOD',
      targetFacultyMemberId: 'fm-arjun',
      relatedBatchId: 'batch-cse-2021',
      summary: 'Move Distributed Systems Lab to Tue/Thu for Batch 2021 CSE',
      detail: 'HoD requested a permanent timetable change because the current Monday 2-4 PM lab conflicts with placement training for final-year CSE.',
      requestedAt: '2026-03-15T09:30:00.000Z',
      payload: {
        type: 'timetable-change',
        facultyMemberId: 'fm-arjun',
        teachingAssignmentId: 'ta-arjun-dslab',
        nextWeeklyPattern: ['Tue 14:00-15:00', 'Thu 14:00-15:00'],
      },
    },
    {
      id: 'req-mentor-1',
      type: 'mentor-assignment-change',
      status: 'New',
      requestedBy: 'Dr. Rekha Rao',
      requestedRole: 'HOD',
      targetFacultyMemberId: 'fm-neha',
      relatedBatchId: 'batch-cse-2022',
      summary: 'Reassign Aisha Khan to Dr. Neha Kulkarni as mentor',
      detail: 'HoD requested mentor reassignment because Batch 2022 Section A now sits under Dr. Neha Kulkarni for all mentor reviews and remediation tracking.',
      requestedAt: '2026-03-16T07:45:00.000Z',
      payload: {
        type: 'mentor-assignment-change',
        studentId: 'stu-aisha',
        nextMentorFacultyMemberId: 'fm-neha',
      },
    },
  ],
}

export function createMockAdminState() {
  return deepClone(seededState)
}
