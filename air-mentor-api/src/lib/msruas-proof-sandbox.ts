import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import curriculumSeedJson from '../db/seeds/msruas-mnc-curriculum.json' with { type: 'json' }
import {
  academicCalendarAuditEvents,
  academicRuntimeState,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  academicTerms,
  alertDecisions,
  alertOutcomes,
  batches,
  branches,
  bridgeModules,
  courseTopicPartitions,
  courses,
  curriculumCourses,
  curriculumEdges,
  curriculumImportVersions,
  curriculumNodes,
  departments,
  electiveBaskets,
  electiveOptions,
  electiveRecommendations,
  facultyAppointments,
  facultyCalendarWorkspaces,
  facultyOfferingOwnerships,
  facultyProfiles,
  institutions,
  mentorAssignments,
  reassessmentEvents,
  riskAssessments,
  roleGrants,
  sectionOfferings,
  simulationResetSnapshots,
  simulationRuns,
  semesterTransitionLogs,
  studentAcademicProfiles,
  studentAssessmentScores,
  studentAttendanceSnapshots,
  studentEnrollments,
  studentInterventions,
  studentLatentStates,
  studentObservedSemesterStates,
  students,
  teacherAllocations,
  teacherLoadProfiles,
  transcriptSubjectResults,
  transcriptTermResults,
  uiPreferences,
  userAccounts,
  userPasswordCredentials,
} from '../db/schema.js'
import { inferObservableRisk } from './inference-engine.js'
import { buildMonitoringDecision } from './monitoring-engine.js'
import {
  buildCompletenessCertificate,
  buildCurriculumOutputChecksum,
  compileMsruasCurriculumWorkbook,
  EMBEDDED_CURRICULUM_SOURCE_PATH,
  validateCompiledCurriculum,
} from './msruas-curriculum-compiler.js'
import {
  calculateCgpa,
  calculateSgpa,
  evaluateCourseStatus,
  type GradePointSubjectAttempt,
  type MsruasDeterministicPolicy,
} from './msruas-rules.js'
import { hashPassword } from './passwords.js'
import type { ResolvedPolicy } from '../modules/admin-structure.js'

type CurriculumSeedCourse = {
  title: string
  semester: number
  credits: number
  assessmentProfile: string
  explicitPrerequisites: string[]
  addedPrerequisites: string[]
  bridgeModules: string[]
  tt1Topics: string[]
  tt2Topics: string[]
  seeTopics: string[]
  workbookTopics: string[]
  internalCompilerId: string
  officialWebCode: string | null
  officialWebTitle: string | null
  matchStatus: string
  mappingNote: string
}

type CurriculumSeedEdge = {
  targetCourse: string
  sourceCourse: string
  edgeType: string
  whyAdded?: string
}

type CurriculumSeedElective = {
  stream: string
  pceGroup: string
  code: string
  title: string
  semesterSlot: string
}

type CurriculumSeed = {
  courses: CurriculumSeedCourse[]
  explicitEdges: CurriculumSeedEdge[]
  addedEdges: CurriculumSeedEdge[]
  electives: CurriculumSeedElective[]
}

type ProofFacultySeed = {
  facultyId: string
  userId: string
  username: string
  email: string
  displayName: string
  designation: string
  employeeCode: string
  phone: string
  permissions: Array<'HOD' | 'COURSE_LEADER' | 'MENTOR'>
}

type StudentTrajectory = {
  studentId: string
  usn: string
  name: string
  sectionCode: 'A' | 'B'
  latentBase: {
    academicPotential: number
    mathematicsFoundation: number
    computingFoundation: number
    selfRegulation: number
    attendanceDiscipline: number
    supportResponsiveness: number
  }
}

type SemesterSimulation = {
  sgpa: number
  cgpa: number
  backlogCount: number
  earnedCredits: number
  registeredCredits: number
  attempts: GradePointSubjectAttempt[]
  subjectRows: Array<{
    course: CurriculumSeedCourse
    attendancePct: number
    ceMark: number
    seeMark: number
    overallMark: number
    gradeLabel: string
    gradePoint: number
    result: 'Passed' | 'Failed'
    condoned: boolean
  }>
}

type StreamRecommendation = {
  stream: string
  code: string
  title: string
  score: number
  rationale: string[]
  alternatives: Array<{ code: string; title: string; stream: string; score: number }>
}

const curriculumSeed = curriculumSeedJson as CurriculumSeed

export const MSRUAS_PROOF_DEPARTMENT_ID = 'dept_cse'
export const MSRUAS_PROOF_BRANCH_ID = 'branch_mnc_btech'
export const MSRUAS_PROOF_BATCH_ID = 'batch_branch_mnc_btech_2023'
export const MSRUAS_PROOF_SIMULATION_RUN_ID = 'sim_mnc_2023_first6_v1'
export const MSRUAS_PROOF_CURRICULUM_IMPORT_ID = 'curriculum_import_mnc_2023_first6_v1'

export async function ensureMsruasProofSandboxSeeded(db: AppDb, options: {
  institutionId?: string
  now: string
  policy: ResolvedPolicy
}) {
  const [existingBatch] = await db.select().from(batches).where(eq(batches.batchId, MSRUAS_PROOF_BATCH_ID))
  if (existingBatch) {
    return {
      seeded: false,
      batchId: existingBatch.batchId,
    }
  }

  const resolvedInstitutionId = options.institutionId ?? (
    await db.select().from(institutions).limit(1)
  )[0]?.institutionId
  if (!resolvedInstitutionId) throw new Error('Institution not configured')

  await seedMsruasProofSandbox(db, {
    institutionId: resolvedInstitutionId,
    now: options.now,
    policy: options.policy,
  })

  return {
    seeded: true,
    batchId: MSRUAS_PROOF_BATCH_ID,
  }
}

export const PROOF_TERM_DEFS = [
  { termId: 'term_mnc_sem1', semesterNumber: 1, academicYearLabel: '2023-24', startDate: '2023-08-01', endDate: '2023-12-15' },
  { termId: 'term_mnc_sem2', semesterNumber: 2, academicYearLabel: '2023-24', startDate: '2024-01-08', endDate: '2024-05-15' },
  { termId: 'term_mnc_sem3', semesterNumber: 3, academicYearLabel: '2024-25', startDate: '2024-08-01', endDate: '2024-12-15' },
  { termId: 'term_mnc_sem4', semesterNumber: 4, academicYearLabel: '2024-25', startDate: '2025-01-08', endDate: '2025-05-15' },
  { termId: 'term_mnc_sem5', semesterNumber: 5, academicYearLabel: '2025-26', startDate: '2025-08-01', endDate: '2025-12-15' },
  { termId: 'term_mnc_sem6', semesterNumber: 6, academicYearLabel: '2025-26', startDate: '2026-01-08', endDate: '2026-05-15' },
] as const

const FIRST_NAMES = ['Aarav', 'Ishita', 'Vihaan', 'Ananya', 'Advik', 'Meera', 'Reyansh', 'Kavya', 'Arjun', 'Diya', 'Krish', 'Nitya', 'Rohan', 'Saanvi', 'Dev', 'Mira', 'Kabir', 'Tara', 'Yash', 'Ira']
const LAST_NAMES = ['Sharma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Joshi', 'Bhat', 'Rao', 'Singh', 'Krishnan', 'Menon', 'Kulkarni', 'Saxena', 'Varma']

export const PROOF_FACULTY: ProofFacultySeed[] = [
  { facultyId: 'mnc_t1', userId: 'user_mnc_t1', username: 'devika.shetty', email: 'devika.shetty@msruas.ac.in', displayName: 'Dr. Devika Shetty', designation: 'Professor & Programme Lead', employeeCode: 'MNC-T001', phone: '+91-9000002101', permissions: ['HOD', 'COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t2', userId: 'user_mnc_t2', username: 'rohit.menon', email: 'rohit.menon@msruas.ac.in', displayName: 'Dr. Rohit Menon', designation: 'Associate Professor', employeeCode: 'MNC-T002', phone: '+91-9000002102', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t3', userId: 'user_mnc_t3', username: 'priya.raman', email: 'priya.raman@msruas.ac.in', displayName: 'Dr. Priya Raman', designation: 'Associate Professor', employeeCode: 'MNC-T003', phone: '+91-9000002103', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t4', userId: 'user_mnc_t4', username: 'karan.naidu', email: 'karan.naidu@msruas.ac.in', displayName: 'Dr. Karan Naidu', designation: 'Assistant Professor', employeeCode: 'MNC-T004', phone: '+91-9000002104', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t5', userId: 'user_mnc_t5', username: 'sowmya.krishnan', email: 'sowmya.krishnan@msruas.ac.in', displayName: 'Dr. Sowmya Krishnan', designation: 'Assistant Professor', employeeCode: 'MNC-T005', phone: '+91-9000002105', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t6', userId: 'user_mnc_t6', username: 'abhinav.rao', email: 'abhinav.rao@msruas.ac.in', displayName: 'Dr. Abhinav Rao', designation: 'Assistant Professor', employeeCode: 'MNC-T006', phone: '+91-9000002106', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t7', userId: 'user_mnc_t7', username: 'neha.iyengar', email: 'neha.iyengar@msruas.ac.in', displayName: 'Dr. Neha Iyengar', designation: 'Assistant Professor', employeeCode: 'MNC-T007', phone: '+91-9000002107', permissions: ['COURSE_LEADER', 'MENTOR'] },
  { facultyId: 'mnc_t8', userId: 'user_mnc_t8', username: 'harish.bhat', email: 'harish.bhat@msruas.ac.in', displayName: 'Dr. Harish Bhat', designation: 'Assistant Professor', employeeCode: 'MNC-T008', phone: '+91-9000002108', permissions: ['MENTOR'] },
  { facultyId: 'mnc_t9', userId: 'user_mnc_t9', username: 'namrata.shah', email: 'namrata.shah@msruas.ac.in', displayName: 'Dr. Namrata Shah', designation: 'Assistant Professor', employeeCode: 'MNC-T009', phone: '+91-9000002109', permissions: ['MENTOR'] },
  { facultyId: 'mnc_t10', userId: 'user_mnc_t10', username: 'vivek.kumar', email: 'vivek.kumar@msruas.ac.in', displayName: 'Dr. Vivek Kumar', designation: 'Assistant Professor', employeeCode: 'MNC-T010', phone: '+91-9000002110', permissions: ['MENTOR'] },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function stableUnit(seed: string) {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function stableBetween(seed: string, min: number, max: number) {
  return min + (stableUnit(seed) * (max - min))
}

function pickName(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]
  return `${first} ${last}`
}

function courseCodeForSeed(course: CurriculumSeedCourse) {
  return course.officialWebCode ?? course.internalCompilerId
}

function isLabLikeCourse(course: CurriculumSeedCourse) {
  const haystack = `${course.title} ${course.assessmentProfile}`.toLowerCase()
  return haystack.includes('lab') || haystack.includes('project') || haystack.includes('workshop')
}

function semesterCourses(semesterNumber: number) {
  return curriculumSeed.courses.filter(course => course.semester === semesterNumber)
}

function deterministicPolicyFromResolved(policy: ResolvedPolicy): MsruasDeterministicPolicy {
  return {
    gradeBands: policy.gradeBands,
    attendanceRules: {
      minimumPercent: policy.attendanceRules.minimumRequiredPercent,
    },
    condonationRules: {
      minimumPercent: policy.attendanceRules.condonationFloorPercent,
      shortagePercent: policy.condonationRules.maximumShortagePercent,
      requiresApproval: policy.condonationRules.requiresApproval,
    },
    eligibilityRules: {
      minimumAttendancePercent: policy.attendanceRules.minimumRequiredPercent,
      minimumCeForSee: policy.eligibilityRules.minimumCeForSeeEligibility,
    },
    passRules: {
      ceMinimum: policy.passRules.minimumCeMark,
      seeMinimum: policy.passRules.minimumSeeMark,
      overallMinimum: policy.passRules.minimumOverallMark,
      ceMaximum: policy.passRules.ceMaximum,
      seeMaximum: policy.passRules.seeMaximum,
      overallMaximum: policy.passRules.overallMaximum,
    },
    roundingRules: {
      statusMarkRounding: policy.roundingRules.statusMarkRounding,
      sgpaCgpaDecimals: policy.roundingRules.sgpaCgpaDecimals,
    },
    sgpaCgpaRules: {
      includeFailedCredits: policy.sgpaCgpaRules.includeFailedCredits,
      repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
    },
  }
}

function sectionForIndex(index: number): 'A' | 'B' {
  return index < 60 ? 'A' : 'B'
}

function buildStudentTrajectory(index: number): StudentTrajectory {
  const sectionCode = sectionForIndex(index)
  const sectionAbility = sectionCode === 'A' ? 0.64 : 0.5
  const sectionDiscipline = sectionCode === 'A' ? 0.66 : 0.56
  const seedBase = `student-${index + 1}`
  return {
    studentId: `mnc_student_${String(index + 1).padStart(3, '0')}`,
    usn: `1MS23MC${String(index + 1).padStart(3, '0')}`,
    name: pickName(index),
    sectionCode,
    latentBase: {
      academicPotential: clamp(sectionAbility + stableBetween(`${seedBase}-ability`, -0.18, 0.18), 0.2, 0.94),
      mathematicsFoundation: clamp((sectionAbility + 0.04) + stableBetween(`${seedBase}-math`, -0.2, 0.2), 0.2, 0.96),
      computingFoundation: clamp((sectionAbility - 0.02) + stableBetween(`${seedBase}-computing`, -0.2, 0.2), 0.18, 0.96),
      selfRegulation: clamp(sectionDiscipline + stableBetween(`${seedBase}-self`, -0.18, 0.18), 0.2, 0.95),
      attendanceDiscipline: clamp((sectionDiscipline + 0.03) + stableBetween(`${seedBase}-attendance`, -0.2, 0.2), 0.2, 0.98),
      supportResponsiveness: clamp(0.56 + stableBetween(`${seedBase}-support`, -0.2, 0.2), 0.15, 0.96),
    },
  }
}

function teacherEffect(facultyId: string, course: CurriculumSeedCourse, sectionCode: string) {
  return stableBetween(`${facultyId}-${course.internalCompilerId}-${sectionCode}`, -0.06, 0.08)
}

function prerequisiteAverage(course: CurriculumSeedCourse, scoresByCourseTitle: Map<string, number>) {
  const signals = [...course.explicitPrerequisites, ...course.addedPrerequisites]
    .map(title => scoresByCourseTitle.get(title))
    .filter((value): value is number => typeof value === 'number')
  if (signals.length === 0) return 0.58
  return clamp(signals.reduce((sum, value) => sum + value, 0) / (signals.length * 100), 0.2, 0.95)
}

function courseEmphasis(course: CurriculumSeedCourse) {
  const lower = course.title.toLowerCase()
  const mathHeavy = ['mathematics', 'algebra', 'probability', 'statistics', 'optimization', 'numerical', 'analysis', 'computation'].some(token => lower.includes(token))
  const computingHeavy = ['programming', 'computer', 'database', 'operating', 'network', 'software', 'algorithm', 'machine', 'data', 'distributed', 'logic', 'intelligence'].some(token => lower.includes(token))
  return {
    mathWeight: mathHeavy ? 0.7 : computingHeavy ? 0.35 : 0.5,
    computingWeight: computingHeavy ? 0.72 : mathHeavy ? 0.34 : 0.5,
  }
}

function simulateSemesterCourse(input: {
  student: StudentTrajectory
  course: CurriculumSeedCourse
  semesterNumber: number
  scoresByCourseTitle: Map<string, number>
  facultyId: string
  sectionCode: 'A' | 'B'
  policy: MsruasDeterministicPolicy
}): {
  attendancePct: number
  ceMark: number
  seeMark: number
  overallMark: number
  gradeLabel: string
  gradePoint: number
  result: 'Passed' | 'Failed'
  condoned: boolean
  latentSummary: Record<string, number>
} {
  const { student, course, semesterNumber, scoresByCourseTitle, facultyId, sectionCode, policy } = input
  const emphasis = courseEmphasis(course)
  const prereq = prerequisiteAverage(course, scoresByCourseTitle)
  const difficulty = 0.28 + (semesterNumber * 0.075) + stableBetween(`${student.studentId}-${course.internalCompilerId}-difficulty`, -0.03, 0.05)
  const teaching = teacherEffect(facultyId, course, sectionCode)
  const mastery = clamp(
    (student.latentBase.academicPotential * 0.32)
      + (student.latentBase.mathematicsFoundation * emphasis.mathWeight * 0.24)
      + (student.latentBase.computingFoundation * emphasis.computingWeight * 0.24)
      + (student.latentBase.selfRegulation * 0.12)
      + (student.latentBase.supportResponsiveness * 0.08)
      + (prereq * 0.18)
      + teaching
      - (difficulty * 0.22),
    0.18,
    0.96,
  )
  const attendancePct = clamp(
    Math.round(
      58
        + (student.latentBase.attendanceDiscipline * 30)
        + (student.latentBase.selfRegulation * 8)
        + (student.latentBase.supportResponsiveness * 4)
        - (difficulty * 8)
        + stableBetween(`${student.studentId}-${course.internalCompilerId}-attendance`, -7, 9),
    ),
    52,
    98,
  )
  const cePct = clamp(
    24
      + (mastery * 60)
      + (student.latentBase.selfRegulation * 10)
      + (prereq * 8)
      - (difficulty * 9)
      + stableBetween(`${student.studentId}-${course.internalCompilerId}-ce`, -12, 10),
    10,
    97,
  )
  const seePct = clamp(
    22
      + (mastery * 58)
      + (prereq * 10)
      - (difficulty * 10)
      + stableBetween(`${student.studentId}-${course.internalCompilerId}-see`, -14, 12),
    8,
    98,
  )
  const ceMark = roundToTwo((cePct / 100) * policy.passRules.ceMaximum)
  const seeMark = roundToTwo((seePct / 100) * policy.passRules.seeMaximum)
  const condoned = attendancePct >= policy.condonationRules.minimumPercent
    && attendancePct < policy.attendanceRules.minimumPercent
    && stableUnit(`${student.studentId}-${course.internalCompilerId}-condonation`) > 0.42
  const decision = evaluateCourseStatus({
    attendancePercent: attendancePct,
    ceMark,
    seeMark,
    condoned,
    policy,
  })
  return {
    attendancePct,
    ceMark,
    seeMark,
    overallMark: decision.overallRounded,
    gradeLabel: decision.gradeLabel,
    gradePoint: decision.gradePoint,
    result: decision.result,
    condoned,
    latentSummary: {
      mastery: roundToTwo(mastery),
      prereq: roundToTwo(prereq),
      teaching: roundToTwo(teaching),
      difficulty: roundToTwo(difficulty),
    },
  }
}

function electiveRecommendationForStudent(input: {
  courseScores: Map<string, number>
}): StreamRecommendation {
  const streamMappings: Array<{ stream: string; code: string; title: string; sourceCourses: string[]; rationale: string[] }> = [
    {
      stream: 'Coding and Cryptography',
      code: '20MCE401A',
      title: 'Information Theory and Coding',
      sourceCourses: ['Discrete Mathematics', 'Digital Logic Design', 'Theory of Computation', 'Data Structures and Algorithms'],
      rationale: ['strong symbolic reasoning', 'good performance on formal and logic-heavy courses'],
    },
    {
      stream: 'Mathematical Models',
      code: '20MCE404A',
      title: 'Introduction to Real Analysis',
      sourceCourses: ['Engineering Mathematics-1', 'Engineering Mathematics-2', 'Linear Algebra', 'Probability and Statistics'],
      rationale: ['stable mathematical foundation', 'consistent performance on proof-oriented mathematics'],
    },
    {
      stream: 'Artificial Intelligence and Data Sciences',
      code: '20CSE405A',
      title: 'Computer Vision',
      sourceCourses: ['Programming in C', 'Python Programming', 'Machine Learning', 'Probability and Statistics'],
      rationale: ['applied modelling strength', 'solid algorithmic and data reasoning profile'],
    },
    {
      stream: 'Software Development',
      code: '20CSE401A',
      title: 'Software Architecture',
      sourceCourses: ['Object Oriented Programming', 'Database Management Systems', 'Operating Systems', 'Software Engineering'],
      rationale: ['strong systems and software stack performance', 'good consistency in implementation-heavy courses'],
    },
    {
      stream: 'Applied Mathematics',
      code: '20CSE401A',
      title: 'Advanced Mathematics',
      sourceCourses: ['Engineering Mathematics-1', 'Engineering Mathematics-2', 'Linear Algebra', 'Numerical Methods'],
      rationale: ['high readiness for quantitative electives', 'strong performance on analytical methods'],
    },
    {
      stream: 'Data Science and Analytics',
      code: '20CSE407A',
      title: 'Data Sciences Foundation',
      sourceCourses: ['Python Programming', 'Probability and Statistics', 'Machine Learning', 'Scientific Computing Lab'],
      rationale: ['good preparation for data-centric electives', 'observable strength in modelling and computation'],
    },
  ]

  const scored = streamMappings.map(mapping => {
    const values = mapping.sourceCourses
      .map(courseTitle => input.courseScores.get(courseTitle))
      .filter((value): value is number => typeof value === 'number')
    const score = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 40
    return { ...mapping, score: roundToTwo(score) }
  }).sort((left, right) => right.score - left.score)

  const best = scored[0]
  return {
    stream: best.stream,
    code: best.code,
    title: best.title,
    score: best.score,
    rationale: best.rationale,
    alternatives: scored.slice(1, 4).map(item => ({
      code: item.code,
      title: item.title,
      stream: item.stream,
      score: item.score,
    })),
  }
}

function weeklyContactHoursForCourse(course: CurriculumSeedCourse) {
  const totalContactHours = course.credits * (isLabLikeCourse(course) ? 30 : 15)
  return Math.max(2, Math.round(totalContactHours / 16))
}

function buildTimetablePayload(loadsByFacultyId: Map<string, Array<{ offeringId: string; courseCode: string; courseName: string; sectionCode: string; semesterNumber: number; weeklyHours: number }>>) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
  const slots = [
    { id: 'slot_1', label: '08:30-09:30', startTime: '08:30', endTime: '09:30' },
    { id: 'slot_2', label: '09:30-10:30', startTime: '09:30', endTime: '10:30' },
    { id: 'slot_3', label: '10:45-11:45', startTime: '10:45', endTime: '11:45' },
    { id: 'slot_4', label: '11:45-12:45', startTime: '11:45', endTime: '12:45' },
    { id: 'slot_5', label: '13:30-14:30', startTime: '13:30', endTime: '14:30' },
    { id: 'slot_6', label: '14:30-15:30', startTime: '14:30', endTime: '15:30' },
  ] as const
  const cells = weekdays.flatMap(day => slots.map(slot => ({ day, slot })))
  const result: Record<string, Record<string, unknown>> = {}
  for (const [facultyId, entries] of loadsByFacultyId.entries()) {
    const classBlocks: Array<Record<string, unknown>> = []
    const occupiedCells = new Set<string>()
    let cursor = 0
    const sortedEntries = [...entries].sort((left, right) => {
      if (left.offeringId !== right.offeringId) return left.offeringId.localeCompare(right.offeringId)
      if (left.sectionCode !== right.sectionCode) return left.sectionCode.localeCompare(right.sectionCode)
      return left.courseCode.localeCompare(right.courseCode)
    })
    sortedEntries.forEach((entry, entryIndex) => {
      const repeatCount = Math.max(1, Math.min(cells.length, entry.weeklyHours))
      for (let blockIndex = 0; blockIndex < repeatCount; blockIndex += 1) {
        const startIndex = (cursor + entryIndex + blockIndex) % cells.length
        let resolvedCell = cells[startIndex]
        for (let offset = 0; offset < cells.length; offset += 1) {
          const candidate = cells[(startIndex + offset) % cells.length]
          const candidateKey = `${candidate.day}::${candidate.slot.id}`
          if (occupiedCells.has(candidateKey)) continue
          resolvedCell = candidate
          occupiedCells.add(candidateKey)
          break
        }
        cursor = (cells.findIndex(cell => cell.day === resolvedCell.day && cell.slot.id === resolvedCell.slot.id) + 1) % cells.length
        classBlocks.push({
          id: `${facultyId}_${entry.offeringId}_${blockIndex + 1}`,
          facultyId,
          offeringId: entry.offeringId,
          courseCode: entry.courseCode,
          courseName: entry.courseName,
          section: entry.sectionCode,
          year: `${Math.ceil(entry.semesterNumber / 2)} Year`,
          day: resolvedCell.day,
          kind: 'regular',
          startMinutes: Number(resolvedCell.slot.startTime.slice(0, 2)) * 60 + Number(resolvedCell.slot.startTime.slice(3, 5)),
          endMinutes: Number(resolvedCell.slot.endTime.slice(0, 2)) * 60 + Number(resolvedCell.slot.endTime.slice(3, 5)),
          slotId: resolvedCell.slot.id,
          slotSpan: 1,
        })
      }
    })
    result[facultyId] = {
      facultyId,
      slots,
      dayStartMinutes: 8 * 60 + 30,
      dayEndMinutes: 15 * 60 + 30,
      classBlocks,
      updatedAt: Date.now(),
    }
  }
  return result
}

async function upsertRuntimeSlice(db: AppDb, stateKey: string, payload: unknown, now: string) {
  const [current] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await db.update(academicRuntimeState).set({
      payloadJson: JSON.stringify(payload),
      version: current.version + 1,
      updatedAt: now,
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return
  }
  await db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: JSON.stringify(payload),
    version: 1,
    updatedAt: now,
  })
}

export async function seedMsruasProofSandbox(db: AppDb, options: {
  institutionId: string
  now: string
  policy: ResolvedPolicy
}) {
  const { institutionId, now, policy } = options
  const deterministicPolicy = deterministicPolicyFromResolved(policy)
  const compiled = compileMsruasCurriculumWorkbook(EMBEDDED_CURRICULUM_SOURCE_PATH)
  const validation = validateCompiledCurriculum(compiled)
  const completenessCertificate = buildCompletenessCertificate(compiled, validation)
  const outputChecksum = buildCurriculumOutputChecksum(compiled)
  const sem6Courses = semesterCourses(6)
  const sem6CourseLeaderFaculty = PROOF_FACULTY.filter(faculty => faculty.permissions.includes('COURSE_LEADER'))
  const mentorFaculty = PROOF_FACULTY.filter(faculty => faculty.permissions.includes('MENTOR'))

  const [existingDepartment] = await db.select().from(departments).where(eq(departments.departmentId, MSRUAS_PROOF_DEPARTMENT_ID))
  if (!existingDepartment) {
    await db.insert(departments).values({
      departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
      institutionId,
      academicFacultyId: 'academic_faculty_engineering_and_technology',
      code: 'CSE',
      name: 'Computer Science and Engineering',
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  const [existingBranch] = await db.select().from(branches).where(eq(branches.branchId, MSRUAS_PROOF_BRANCH_ID))
  if (existingBranch) {
    await db.update(branches).set({
      departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
      code: 'BTECH-MNC',
      name: 'B.Tech Mathematics and Computing',
      programLevel: 'undergraduate',
      semesterCount: 8,
      status: 'active',
      updatedAt: now,
    }).where(eq(branches.branchId, MSRUAS_PROOF_BRANCH_ID))
  } else {
    await db.insert(branches).values({
      branchId: MSRUAS_PROOF_BRANCH_ID,
      departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
      code: 'BTECH-MNC',
      name: 'B.Tech Mathematics and Computing',
      programLevel: 'undergraduate',
      semesterCount: 8,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
  }

  await db.insert(batches).values({
    batchId: MSRUAS_PROOF_BATCH_ID,
    branchId: MSRUAS_PROOF_BRANCH_ID,
    admissionYear: 2023,
    batchLabel: '2023 Proof',
    currentSemester: 6,
    sectionLabelsJson: JSON.stringify(['A', 'B']),
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(academicTerms).values(PROOF_TERM_DEFS.map(term => ({
    termId: term.termId,
    branchId: MSRUAS_PROOF_BRANCH_ID,
    batchId: MSRUAS_PROOF_BATCH_ID,
    academicYearLabel: term.academicYearLabel,
    semesterNumber: term.semesterNumber,
    startDate: term.startDate,
    endDate: term.endDate,
    status: term.semesterNumber === 6 ? 'active' : 'archived',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })))

  for (const faculty of PROOF_FACULTY) {
    await db.insert(userAccounts).values({
      userId: faculty.userId,
      institutionId,
      username: faculty.username,
      email: faculty.email,
      phone: faculty.phone,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(userPasswordCredentials).values({
      userId: faculty.userId,
      passwordHash: await hashPassword('faculty1234'),
      updatedAt: now,
    })
    await db.insert(uiPreferences).values({
      userId: faculty.userId,
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: now,
    })
    await db.insert(facultyProfiles).values({
      facultyId: faculty.facultyId,
      userId: faculty.userId,
      employeeCode: faculty.employeeCode,
      displayName: faculty.displayName,
      designation: faculty.designation,
      joinedOn: '2023-06-01',
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(facultyAppointments).values({
      appointmentId: `appointment_${faculty.facultyId}`,
      facultyId: faculty.facultyId,
      departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
      branchId: MSRUAS_PROOF_BRANCH_ID,
      isPrimary: 1,
      startDate: '2023-06-01',
      endDate: null,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(roleGrants).values(faculty.permissions.map(roleCode => ({
      grantId: `grant_${faculty.facultyId}_${roleCode.toLowerCase()}`,
      facultyId: faculty.facultyId,
      roleCode,
      scopeType: 'branch',
      scopeId: MSRUAS_PROOF_BRANCH_ID,
      startDate: '2023-06-01',
      endDate: null,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })))
  }

  const importVersionRow: typeof curriculumImportVersions.$inferInsert = {
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    batchId: MSRUAS_PROOF_BATCH_ID,
    sourceLabel: compiled.sourceLabel,
    sourceChecksum: compiled.sourceChecksum,
    sourcePath: compiled.sourcePath,
    sourceType: compiled.sourceType,
    compilerVersion: compiled.compilerVersion,
    outputChecksum,
    firstSemester: validation.semesterCoverage[0],
    lastSemester: validation.semesterCoverage[1],
    courseCount: validation.courseCount,
    totalCredits: validation.totalCredits,
    explicitEdgeCount: validation.explicitEdgeCount,
    addedEdgeCount: validation.addedEdgeCount,
    bridgeModuleCount: validation.bridgeModuleCount,
    electiveOptionCount: validation.electiveOptionCount,
    unresolvedMappingCount: validation.unresolvedMappingCount,
    validationStatus: validation.status,
    completenessCertificateJson: JSON.stringify(completenessCertificate),
    approvedByFacultyId: null,
    approvedAt: null,
    status: validation.errors.length > 0 ? 'needs-review' : 'validated',
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(curriculumImportVersions).values(importVersionRow)

  const courseRows: Array<typeof courses.$inferInsert> = curriculumSeed.courses.map(course => ({
    courseId: `course_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    institutionId,
    courseCode: courseCodeForSeed(course),
    title: course.title,
    defaultCredits: course.credits,
    departmentId: MSRUAS_PROOF_DEPARTMENT_ID,
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }))
  await db.insert(courses).values(courseRows)

  const curriculumNodeRows: Array<typeof curriculumNodes.$inferInsert> = curriculumSeed.courses.map((course, index) => ({
    curriculumNodeId: `curriculum_node_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    batchId: MSRUAS_PROOF_BATCH_ID,
    semesterNumber: course.semester,
    courseId: courseRows[index].courseId,
    courseCode: courseCodeForSeed(course),
    title: course.title,
    credits: course.credits,
    internalCompilerId: course.internalCompilerId,
    officialWebCode: course.officialWebCode,
    officialWebTitle: course.officialWebTitle,
    matchStatus: course.matchStatus,
    mappingNote: course.mappingNote,
    assessmentProfile: course.assessmentProfile,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }))
  await db.insert(curriculumNodes).values(curriculumNodeRows)

  await db.insert(curriculumCourses).values(curriculumSeed.courses.map((course, index) => ({
    curriculumCourseId: `curriculum_course_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    batchId: MSRUAS_PROOF_BATCH_ID,
    semesterNumber: course.semester,
    courseId: courseRows[index].courseId,
    courseCode: courseCodeForSeed(course),
    title: course.title,
    credits: course.credits,
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  })))

  const curriculumNodeIdByTitle = new Map(curriculumSeed.courses.map((course, index) => [course.title, curriculumNodeRows[index].curriculumNodeId]))
  const curriculumEdgeRows: Array<typeof curriculumEdges.$inferInsert> = [
    ...curriculumSeed.explicitEdges.map((edge, index) => ({
      curriculumEdgeId: `curriculum_edge_explicit_${index + 1}`,
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      batchId: MSRUAS_PROOF_BATCH_ID,
      sourceCurriculumNodeId: curriculumNodeIdByTitle.get(edge.sourceCourse) ?? '',
      targetCurriculumNodeId: curriculumNodeIdByTitle.get(edge.targetCourse) ?? '',
      edgeKind: 'explicit',
      rationale: edge.edgeType,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })),
    ...curriculumSeed.addedEdges.map((edge, index) => ({
      curriculumEdgeId: `curriculum_edge_added_${index + 1}`,
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      batchId: MSRUAS_PROOF_BATCH_ID,
      sourceCurriculumNodeId: curriculumNodeIdByTitle.get(edge.sourceCourse) ?? '',
      targetCurriculumNodeId: curriculumNodeIdByTitle.get(edge.targetCourse) ?? '',
      edgeKind: 'added',
      rationale: edge.whyAdded ?? edge.edgeType,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })),
  ].filter(edge => edge.sourceCurriculumNodeId && edge.targetCurriculumNodeId)
  await db.insert(curriculumEdges).values(curriculumEdgeRows)

  const bridgeModuleRows: Array<typeof bridgeModules.$inferInsert> = curriculumSeed.courses
    .filter(course => course.bridgeModules.length > 0)
    .map(course => ({
      bridgeModuleId: `bridge_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
      curriculumNodeId: curriculumNodeIdByTitle.get(course.title) ?? '',
      batchId: MSRUAS_PROOF_BATCH_ID,
      moduleTitlesJson: JSON.stringify(course.bridgeModules),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }))
    .filter(row => row.curriculumNodeId)
  if (bridgeModuleRows.length > 0) await db.insert(bridgeModules).values(bridgeModuleRows)

  const topicPartitionRows: Array<typeof courseTopicPartitions.$inferInsert> = curriculumSeed.courses.flatMap(course => {
    const nodeId = curriculumNodeIdByTitle.get(course.title)
    if (!nodeId) return []
    return [
      {
        courseTopicPartitionId: `topic_tt1_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        curriculumNodeId: nodeId,
        partitionKind: 'tt1',
        topicsJson: JSON.stringify(course.tt1Topics),
        createdAt: now,
        updatedAt: now,
      },
      {
        courseTopicPartitionId: `topic_tt2_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        curriculumNodeId: nodeId,
        partitionKind: 'tt2',
        topicsJson: JSON.stringify(course.tt2Topics),
        createdAt: now,
        updatedAt: now,
      },
      {
        courseTopicPartitionId: `topic_see_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        curriculumNodeId: nodeId,
        partitionKind: 'see',
        topicsJson: JSON.stringify(course.seeTopics),
        createdAt: now,
        updatedAt: now,
      },
      {
        courseTopicPartitionId: `topic_workbook_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        curriculumNodeId: nodeId,
        partitionKind: 'workbook',
        topicsJson: JSON.stringify(course.workbookTopics),
        createdAt: now,
        updatedAt: now,
      },
    ]
  })
  await db.insert(courseTopicPartitions).values(topicPartitionRows)

  const basketIds = new Map<string, string>()
  const basketRows: Array<typeof electiveBaskets.$inferInsert> = []
  const optionRows: Array<typeof electiveOptions.$inferInsert> = []
  curriculumSeed.electives.forEach((elective, index) => {
    const semesterNumber = Number(elective.semesterSlot.replace(/[^0-9]/g, '') || '6')
    const basketKey = `${elective.stream}::${elective.pceGroup}`
    let basketId = basketIds.get(basketKey)
    if (!basketId) {
      basketId = `elective_basket_${basketIds.size + 1}`
      basketIds.set(basketKey, basketId)
      basketRows.push({
        electiveBasketId: basketId,
        curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
        batchId: MSRUAS_PROOF_BATCH_ID,
        semesterNumber,
        stream: elective.stream,
        pceGroup: elective.pceGroup,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }
    optionRows.push({
      electiveOptionId: `elective_option_${index + 1}`,
      electiveBasketId: basketId,
      code: elective.code,
      title: elective.title,
      stream: elective.stream,
      semesterSlot: elective.semesterSlot,
      createdAt: now,
      updatedAt: now,
    })
  })
  await db.insert(electiveBaskets).values(basketRows)
  await db.insert(electiveOptions).values(optionRows)

  await db.insert(simulationRuns).values({
    simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
    batchId: MSRUAS_PROOF_BATCH_ID,
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    parentSimulationRunId: null,
    runLabel: 'MSRUAS first-6-semester proof batch',
    status: 'active',
    activeFlag: 1,
    seed: 101,
    sectionCount: 2,
    studentCount: 120,
    facultyCount: PROOF_FACULTY.length,
    semesterStart: 1,
    semesterEnd: 6,
    activeOperationalSemester: 6,
    sourceType: 'simulation',
    policySnapshotJson: JSON.stringify(policy),
    engineVersionsJson: JSON.stringify({
      worldEngineVersion: 'world-engine-v1',
      inferenceModelVersion: 'observable-inference-v1',
      monitoringPolicyVersion: 'monitoring-v1',
    }),
    metricsJson: JSON.stringify({
      proofGoal: 'adaptation-readiness',
      notes: 'Latent state remains isolated. Teacher-facing reads rely on observed evidence plus deterministic policy.',
    }),
    createdAt: now,
    updatedAt: now,
  })

  const sem6OfferingRows: Array<typeof sectionOfferings.$inferInsert> = []
  const sem6OwnershipRows: Array<typeof facultyOfferingOwnerships.$inferInsert> = []
  const offeringFacultyById = new Map<string, ProofFacultySeed>()
  const activeOfferingLoads = new Map<string, Array<{ offeringId: string; courseCode: string; courseName: string; sectionCode: string; semesterNumber: number; weeklyHours: number }>>()
  ;(['A', 'B'] as const).forEach((sectionCode, sectionOffset) => {
    sem6Courses.forEach((course, courseIndex) => {
      const courseRow = courseRows.find(row => row.title === course.title)
      if (!courseRow) return
      const offeringId = `mnc_s6_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${sectionCode.toLowerCase()}`
      const faculty = sem6CourseLeaderFaculty[(courseIndex + (sectionOffset * 3)) % sem6CourseLeaderFaculty.length]
      offeringFacultyById.set(offeringId, faculty)
      sem6OfferingRows.push({
        offeringId,
        courseId: courseRow.courseId,
        termId: 'term_mnc_sem6',
        branchId: MSRUAS_PROOF_BRANCH_ID,
        sectionCode,
        yearLabel: '3rd Year',
        attendance: sectionCode === 'A' ? 82 : 74,
        studentCount: 60,
        stage: 2,
        stageLabel: 'TT1 Review',
        stageDescription: 'Observable monitoring window after TT1; reassessment stays active.',
        stageColor: '#f59e0b',
        tt1Done: 1,
        tt2Done: 0,
        tt1Locked: 1,
        tt2Locked: 0,
        quizLocked: 1,
        assignmentLocked: 1,
        pendingAction: 'Adaptive reassessment window active',
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      sem6OwnershipRows.push({
        ownershipId: `ownership_${faculty.facultyId}_${offeringId}`,
        offeringId,
        facultyId: faculty.facultyId,
        ownershipRole: 'owner',
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      const facultyLoads = activeOfferingLoads.get(faculty.facultyId) ?? []
      facultyLoads.push({
        offeringId,
        courseCode: courseCodeForSeed(course),
        courseName: course.title,
        sectionCode,
        semesterNumber: 6,
        weeklyHours: weeklyContactHoursForCourse(course),
      })
      activeOfferingLoads.set(faculty.facultyId, facultyLoads)
    })
  })
  await db.insert(sectionOfferings).values(sem6OfferingRows)
  await db.insert(facultyOfferingOwnerships).values(sem6OwnershipRows)

  const trajectories = Array.from({ length: 120 }, (_, index) => buildStudentTrajectory(index))
  const studentRows: Array<typeof students.$inferInsert> = []
  const academicProfileRows: Array<typeof studentAcademicProfiles.$inferInsert> = []
  const mentorAssignmentRows: Array<typeof mentorAssignments.$inferInsert> = []
  const enrollmentRows: Array<typeof studentEnrollments.$inferInsert> = []
  const transcriptTermRows: Array<typeof transcriptTermResults.$inferInsert> = []
  const transcriptSubjectRows: Array<typeof transcriptSubjectResults.$inferInsert> = []
  const latentStateRows: Array<typeof studentLatentStates.$inferInsert> = []
  const observedStateRows: Array<typeof studentObservedSemesterStates.$inferInsert> = []
  const transitionRows: Array<typeof semesterTransitionLogs.$inferInsert> = []
  const attendanceRows: Array<typeof studentAttendanceSnapshots.$inferInsert> = []
  const assessmentRows: Array<typeof studentAssessmentScores.$inferInsert> = []
  const riskRows: Array<typeof riskAssessments.$inferInsert> = []
  const reassessmentRows: Array<typeof reassessmentEvents.$inferInsert> = []
  const alertDecisionRows: Array<typeof alertDecisions.$inferInsert> = []
  const alertOutcomeRows: Array<typeof alertOutcomes.$inferInsert> = []
  const interventionRows: Array<typeof studentInterventions.$inferInsert> = []
  const electiveRecommendationRows: Array<typeof electiveRecommendations.$inferInsert> = []
  const taskRows: Array<typeof academicTasks.$inferInsert> = []
  const taskTransitionRows: Array<typeof academicTaskTransitions.$inferInsert> = []
  const taskPlacementRows: Array<typeof academicTaskPlacements.$inferInsert> = []
  const teacherAllocationRows: Array<typeof teacherAllocations.$inferInsert> = []
  const teacherLoadRows: Array<typeof teacherLoadProfiles.$inferInsert> = []

  const courseFacultyBySemester = new Map<number, ProofFacultySeed[]>()
  for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
    const shuffledFaculty = [...sem6CourseLeaderFaculty]
    courseFacultyBySemester.set(semesterNumber, shuffledFaculty)
  }

  for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
    const facultyPool = courseFacultyBySemester.get(semesterNumber) ?? sem6CourseLeaderFaculty
    const semesterCourseRows = semesterCourses(semesterNumber)
    ;(['A', 'B'] as const).forEach((sectionCode, sectionOffset) => {
      semesterCourseRows.forEach((course, courseIndex) => {
        const faculty = facultyPool[(courseIndex + sectionOffset) % facultyPool.length]
        const offeringId = semesterNumber === 6
          ? `mnc_s6_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${sectionCode.toLowerCase()}`
          : null
        teacherAllocationRows.push({
          teacherAllocationId: `allocation_${faculty.facultyId}_s${semesterNumber}_${sectionCode}_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
          facultyId: faculty.facultyId,
          offeringId,
          curriculumNodeId: curriculumNodeIdByTitle.get(course.title) ?? null,
          semesterNumber,
          sectionCode,
          allocationRole: faculty.permissions.includes('COURSE_LEADER') ? 'course-leader' : 'mentor',
          plannedContactHours: weeklyContactHoursForCourse(course),
          createdAt: now,
          updatedAt: now,
        })
      })
    })
  }

  trajectories.forEach((trajectory, studentIndex) => {
    studentRows.push({
      studentId: trajectory.studentId,
      institutionId,
      usn: trajectory.usn,
      rollNumber: `MC-${String(studentIndex + 1).padStart(3, '0')}`,
      name: trajectory.name,
      email: `${trajectory.usn.toLowerCase()}@student.msruas.ac.in`,
      phone: `+91-80000${String(studentIndex + 1).padStart(5, '0')}`,
      admissionDate: '2023-08-01',
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })

    const mentor = mentorFaculty[studentIndex % mentorFaculty.length]
    mentorAssignmentRows.push({
      assignmentId: `mentor_assignment_${trajectory.studentId}`,
      studentId: trajectory.studentId,
      facultyId: mentor.facultyId,
      effectiveFrom: '2023-08-01',
      effectiveTo: null,
      source: 'msruas-proof-seed',
      version: 1,
      createdAt: now,
      updatedAt: now,
    })

    const courseScores = new Map<string, number>()
    const cumulativeAttempts: GradePointSubjectAttempt[][] = []
    let currentCgpa = 0
    let activeBacklogCount = 0

    for (const term of PROOF_TERM_DEFS) {
      enrollmentRows.push({
        enrollmentId: `enrollment_${trajectory.studentId}_${term.termId}`,
        studentId: trajectory.studentId,
        branchId: MSRUAS_PROOF_BRANCH_ID,
        termId: term.termId,
        sectionCode: trajectory.sectionCode,
        rosterOrder: studentIndex % 60,
        academicStatus: 'active',
        startDate: term.startDate,
        endDate: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    for (let semesterNumber = 1; semesterNumber <= 5; semesterNumber += 1) {
      const term = PROOF_TERM_DEFS.find(item => item.semesterNumber === semesterNumber)
      if (!term) continue
      const facultyPool = courseFacultyBySemester.get(semesterNumber) ?? sem6CourseLeaderFaculty
      const semesterAttempts: GradePointSubjectAttempt[] = []
      const semesterSubjectRows: SemesterSimulation['subjectRows'] = []

      semesterCourses(semesterNumber).forEach((course, courseIndex) => {
        const faculty = facultyPool[(courseIndex + (trajectory.sectionCode === 'B' ? 1 : 0)) % facultyPool.length]
        const simulation = simulateSemesterCourse({
          student: trajectory,
          course,
          semesterNumber,
          scoresByCourseTitle: courseScores,
          facultyId: faculty.facultyId,
          sectionCode: trajectory.sectionCode,
          policy: deterministicPolicy,
        })
        courseScores.set(course.title, simulation.overallMark)
        semesterAttempts.push({
          courseCode: courseCodeForSeed(course),
          credits: course.credits,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
        })
        semesterSubjectRows.push({
          course,
          attendancePct: simulation.attendancePct,
          ceMark: simulation.ceMark,
          seeMark: simulation.seeMark,
          overallMark: simulation.overallMark,
          gradeLabel: simulation.gradeLabel,
          gradePoint: simulation.gradePoint,
          result: simulation.result,
          condoned: simulation.condoned,
        })
        latentStateRows.push({
          studentLatentStateId: `latent_${trajectory.studentId}_s${semesterNumber}_${course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
          studentId: trajectory.studentId,
          semesterNumber,
          sectionCode: trajectory.sectionCode,
          latentStateJson: JSON.stringify({
            ...trajectory.latentBase,
            courseInternalId: course.internalCompilerId,
            courseTitle: course.title,
            observedFromSemester: semesterNumber,
            scoreForecast: simulation.overallMark,
            ...simulation.latentSummary,
          }),
          createdAt: now,
          updatedAt: now,
        })
      })

      const registeredCredits = semesterSubjectRows.reduce((sum, row) => sum + row.course.credits, 0)
      const earnedCredits = semesterSubjectRows.filter(row => row.result === 'Passed').reduce((sum, row) => sum + row.course.credits, 0)
      const failuresThisSemester = semesterSubjectRows.filter(row => row.result === 'Failed').length
      activeBacklogCount += failuresThisSemester
      const sgpa = calculateSgpa({
        attempts: semesterAttempts,
        policy: {
          roundingRules: {
            statusMarkRounding: policy.roundingRules.statusMarkRounding,
            sgpaCgpaDecimals: policy.roundingRules.sgpaCgpaDecimals,
          },
          sgpaCgpaRules: {
            includeFailedCredits: policy.sgpaCgpaRules.includeFailedCredits,
            repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
          },
        },
      })
      cumulativeAttempts.push(semesterAttempts)
      currentCgpa = calculateCgpa({
        termAttempts: cumulativeAttempts,
        policy: {
          roundingRules: {
            statusMarkRounding: policy.roundingRules.statusMarkRounding,
            sgpaCgpaDecimals: policy.roundingRules.sgpaCgpaDecimals,
          },
          sgpaCgpaRules: {
            includeFailedCredits: policy.sgpaCgpaRules.includeFailedCredits,
            repeatedCoursePolicy: policy.sgpaCgpaRules.repeatedCoursePolicy,
          },
        },
      })
      const transcriptTermResultId = `transcript_${trajectory.studentId}_${term.termId}`
      transcriptTermRows.push({
        transcriptTermResultId,
        studentId: trajectory.studentId,
        termId: term.termId,
        sgpaScaled: Math.round(sgpa * 100),
        registeredCredits,
        earnedCredits,
        backlogCount: activeBacklogCount,
        createdAt: now,
        updatedAt: now,
      })
      transcriptSubjectRows.push(...semesterSubjectRows.map(row => ({
        transcriptSubjectResultId: `subject_${trajectory.studentId}_${term.termId}_${row.course.internalCompilerId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        transcriptTermResultId,
        courseCode: courseCodeForSeed(row.course),
        title: row.course.title,
        credits: row.course.credits,
        score: row.overallMark,
        gradeLabel: row.gradeLabel,
        gradePoint: row.gradePoint,
        result: row.result,
        createdAt: now,
        updatedAt: now,
      })))
      observedStateRows.push({
        studentObservedSemesterStateId: `observed_${trajectory.studentId}_${term.termId}`,
        simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
        studentId: trajectory.studentId,
        termId: term.termId,
        semesterNumber,
        sectionCode: trajectory.sectionCode,
        observedStateJson: JSON.stringify({
          sgpa,
          cgpaAfterSemester: currentCgpa,
          registeredCredits,
          earnedCredits,
          backlogCount: activeBacklogCount,
          subjectScores: semesterSubjectRows.map(row => ({
            courseCode: courseCodeForSeed(row.course),
            title: row.course.title,
            score: row.overallMark,
            attendancePct: row.attendancePct,
            result: row.result,
          })),
        }),
        createdAt: now,
        updatedAt: now,
      })
      if (semesterNumber > 1) {
        transitionRows.push({
          semesterTransitionLogId: `transition_${trajectory.studentId}_s${semesterNumber - 1}_s${semesterNumber}`,
          simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
          studentId: trajectory.studentId,
          fromSemester: semesterNumber - 1,
          toSemester: semesterNumber,
          summaryJson: JSON.stringify({
            cgpa: currentCgpa,
            backlogCount: activeBacklogCount,
            transitionReadiness: activeBacklogCount === 0 && currentCgpa >= 6 ? 'stable' : activeBacklogCount <= 1 ? 'review' : 'support-required',
          }),
          createdAt: now,
        })
      }
    }

    academicProfileRows.push({
      studentId: trajectory.studentId,
      prevCgpaScaled: Math.round(currentCgpa * 100),
      createdAt: now,
      updatedAt: now,
    })

    const recommendation = electiveRecommendationForStudent({ courseScores })
    electiveRecommendationRows.push({
      electiveRecommendationId: `elective_${trajectory.studentId}`,
      simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
      studentId: trajectory.studentId,
      batchId: MSRUAS_PROOF_BATCH_ID,
      semesterNumber: 6,
      recommendedCode: recommendation.code,
      recommendedTitle: recommendation.title,
      stream: recommendation.stream,
      rationaleJson: JSON.stringify(recommendation.rationale),
      alternativesJson: JSON.stringify(recommendation.alternatives),
      createdAt: now,
      updatedAt: now,
    })

    sem6OfferingRows
      .filter(offering => offering.sectionCode === trajectory.sectionCode)
      .forEach((offering, offeringIndex) => {
        const faculty = offeringFacultyById.get(offering.offeringId)
        const course = sem6Courses.find(item => item.title === courseRows.find(row => row.courseId === offering.courseId)?.title)
        if (!faculty || !course) return
        const attendancePct = clamp(
          Math.round(60 + (trajectory.latentBase.attendanceDiscipline * 28) + (trajectory.latentBase.selfRegulation * 7) - (offeringIndex % 3) * 2 + stableBetween(`${trajectory.studentId}-${offering.offeringId}-att`, -9, 7)),
          58,
          97,
        )
        const tt1Pct = clamp(
          26 + (trajectory.latentBase.academicPotential * 42) + (trajectory.latentBase.computingFoundation * 12) + (trajectory.latentBase.mathematicsFoundation * 12) + stableBetween(`${trajectory.studentId}-${offering.offeringId}-tt1`, -18, 12),
          18,
          96,
        )
        const quizPct = clamp(tt1Pct + stableBetween(`${trajectory.studentId}-${offering.offeringId}-quiz`, -10, 8), 15, 97)
        const assignmentPct = clamp(tt1Pct + stableBetween(`${trajectory.studentId}-${offering.offeringId}-assignment`, -8, 10), 18, 98)
        const weakCoCount = tt1Pct < 45 ? 2 : tt1Pct < 60 ? 1 : 0
        const inference = inferObservableRisk({
          attendancePct,
          currentCgpa,
          backlogCount: Math.max(0, Math.round(stableBetween(`${trajectory.studentId}-backlog-observed`, currentCgpa < 6 ? 1 : 0, currentCgpa < 5.2 ? 3 : 1))),
          tt1Pct,
          tt2Pct: null,
          quizPct,
          assignmentPct,
          weakCoCount,
          policy,
        })
        const monitoring = buildMonitoringDecision({
          riskProb: inference.riskProb,
          riskBand: inference.riskBand,
          previousRiskBand: inference.riskBand === 'High' && stableUnit(`${trajectory.studentId}-${offering.offeringId}-prev`) > 0.55 ? 'Medium' : null,
          cooldownUntil: null,
          nowIso: now,
        })
        const attendanceTotal = 32
        const presentClasses = Math.round((attendancePct / 100) * attendanceTotal)
        attendanceRows.push({
          attendanceSnapshotId: `attendance_${trajectory.studentId}_${offering.offeringId}`,
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          presentClasses,
          totalClasses: attendanceTotal,
          attendancePercent: attendancePct,
          source: 'msruas-proof-simulation',
          capturedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        assessmentRows.push(
          {
            assessmentScoreId: `assessment_tt1_${trajectory.studentId}_${offering.offeringId}`,
            studentId: trajectory.studentId,
            offeringId: offering.offeringId,
            termId: 'term_mnc_sem6',
            componentType: 'tt1',
            componentCode: 'TT1',
            score: Math.round((tt1Pct / 100) * 25),
            maxScore: 25,
            evaluatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          {
            assessmentScoreId: `assessment_quiz1_${trajectory.studentId}_${offering.offeringId}`,
            studentId: trajectory.studentId,
            offeringId: offering.offeringId,
            termId: 'term_mnc_sem6',
            componentType: 'quiz1',
            componentCode: 'Quiz 1',
            score: Math.round((quizPct / 100) * 10),
            maxScore: 10,
            evaluatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          {
            assessmentScoreId: `assessment_asgn1_${trajectory.studentId}_${offering.offeringId}`,
            studentId: trajectory.studentId,
            offeringId: offering.offeringId,
            termId: 'term_mnc_sem6',
            componentType: 'asgn1',
            componentCode: 'Assignment 1',
            score: Math.round((assignmentPct / 100) * 10),
            maxScore: 10,
            evaluatedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        )
        riskRows.push({
          riskAssessmentId: `risk_${trajectory.studentId}_${offering.offeringId}`,
          simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          termId: 'term_mnc_sem6',
          assessmentScope: 'observable-only',
          riskProbScaled: Math.round(inference.riskProb * 100),
          riskBand: inference.riskBand,
          recommendedAction: inference.recommendedAction,
          driversJson: JSON.stringify(inference.observableDrivers),
          evidenceWindow: 'semester-6-tt1',
          evidenceSnapshotId: `evidence_${trajectory.studentId}_${offering.offeringId}`,
          modelVersion: 'observable-inference-v1',
          policyVersion: 'resolved-batch-policy',
          sourceType: 'simulation',
          assessedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        observedStateRows.push({
          studentObservedSemesterStateId: `observed_${trajectory.studentId}_${offering.offeringId}`,
          simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
          studentId: trajectory.studentId,
          termId: 'term_mnc_sem6',
          semesterNumber: 6,
          sectionCode: trajectory.sectionCode,
          observedStateJson: JSON.stringify({
            offeringId: offering.offeringId,
            attendancePct,
            tt1Pct: roundToTwo(tt1Pct),
            quizPct: roundToTwo(quizPct),
            assignmentPct: roundToTwo(assignmentPct),
            weakCoCount,
            riskBand: inference.riskBand,
            riskProb: inference.riskProb,
          }),
          createdAt: now,
          updatedAt: now,
        })
        const alertDecisionId = `alert_${trajectory.studentId}_${offering.offeringId}`
        alertDecisionRows.push({
          alertDecisionId,
          riskAssessmentId: `risk_${trajectory.studentId}_${offering.offeringId}`,
          studentId: trajectory.studentId,
          offeringId: offering.offeringId,
          decisionType: monitoring.decisionType,
          queueOwnerRole: monitoring.queueOwnerRole,
          note: monitoring.note,
          reassessmentDueAt: monitoring.reassessmentDueAt,
          cooldownUntil: monitoring.cooldownUntil,
          monitoringPolicyVersion: 'monitoring-v1',
          createdAt: now,
          updatedAt: now,
        })
        alertOutcomeRows.push({
          alertOutcomeId: `alert_outcome_${trajectory.studentId}_${offering.offeringId}`,
          alertDecisionId,
          outcomeStatus: monitoring.decisionType === 'suppress' ? 'Suppressed' : 'Pending',
          acknowledgedByFacultyId: null,
          acknowledgedAt: null,
          outcomeNote: monitoring.note,
          createdAt: now,
          updatedAt: now,
        })
        if (monitoring.decisionType !== 'suppress') {
          reassessmentRows.push({
            reassessmentEventId: `reassessment_${trajectory.studentId}_${offering.offeringId}`,
            riskAssessmentId: `risk_${trajectory.studentId}_${offering.offeringId}`,
            studentId: trajectory.studentId,
            offeringId: offering.offeringId,
            assignedToRole: monitoring.queueOwnerRole,
            dueAt: monitoring.reassessmentDueAt ?? now,
            status: 'Open',
            payloadJson: JSON.stringify({
              riskBand: inference.riskBand,
              riskProb: inference.riskProb,
              recommendedAction: inference.recommendedAction,
            }),
            createdAt: now,
            updatedAt: now,
          })
          const priority = inference.riskBand === 'High' ? 1 : 2
          const taskId = `task_${trajectory.studentId}_${offering.offeringId}`
          taskRows.push({
            taskId,
            studentId: trajectory.studentId,
            offeringId: offering.offeringId,
            assignedToRole: monitoring.queueOwnerRole,
            taskType: inference.riskBand === 'High' ? 'Academic' : 'Follow-up',
            status: inference.riskBand === 'High' ? 'New' : 'In Progress',
            title: inference.riskBand === 'High'
              ? `Reassessment required for ${courseCodeForSeed(course)}`
              : `Watchlist follow-up for ${courseCodeForSeed(course)}`,
            dueLabel: inference.riskBand === 'High' ? 'Within 3 days' : 'Within 7 days',
            dueDateIso: monitoring.reassessmentDueAt,
            riskProbScaled: Math.round(inference.riskProb * 100),
            riskBand: inference.riskBand,
            priority,
            payloadJson: JSON.stringify({
              riskAssessmentId: `risk_${trajectory.studentId}_${offering.offeringId}`,
              observableDrivers: inference.observableDrivers,
              recommendedAction: inference.recommendedAction,
            }),
            createdByFacultyId: faculty.facultyId,
            updatedByFacultyId: faculty.facultyId,
            version: 1,
            createdAt: now,
            updatedAt: now,
          })
          taskTransitionRows.push({
            transitionId: `task_transition_${trajectory.studentId}_${offering.offeringId}`,
            taskId,
            actorRole: 'Auto',
            actorFacultyId: null,
            action: 'seeded_to_queue',
            fromOwner: null,
            toOwner: monitoring.queueOwnerRole,
            note: monitoring.note,
            occurredAt: now,
          })
          taskPlacementRows.push({
            taskId,
            facultyId: monitoring.queueOwnerRole === 'Mentor' ? mentor.facultyId : faculty.facultyId,
            dateIso: (monitoring.reassessmentDueAt ?? now).slice(0, 10),
            placementMode: 'untimed',
            startMinutes: null,
            endMinutes: null,
            slotId: null,
            startTime: null,
            endTime: null,
            updatedAt: now,
          })
        }
        if (inference.riskBand === 'High' && stableUnit(`${trajectory.studentId}-${offering.offeringId}-intervention`) > 0.55) {
          interventionRows.push({
            interventionId: `intervention_${trajectory.studentId}_${offering.offeringId}`,
            studentId: trajectory.studentId,
            facultyId: mentor.facultyId,
            offeringId: offering.offeringId,
            interventionType: 'mentor-check-in',
            note: `Seeded mentor check-in for ${courseCodeForSeed(course)} with observable support plan.`,
            occurredAt: now,
            createdAt: now,
            updatedAt: now,
          })
        }
      })
  })

  await db.insert(students).values(studentRows)
  await db.insert(studentAcademicProfiles).values(academicProfileRows)
  await db.insert(studentEnrollments).values(enrollmentRows)
  await db.insert(mentorAssignments).values(mentorAssignmentRows)
  await db.insert(transcriptTermResults).values(transcriptTermRows)
  await db.insert(transcriptSubjectResults).values(transcriptSubjectRows)
  await db.insert(studentLatentStates).values(latentStateRows)
  await db.insert(studentObservedSemesterStates).values(observedStateRows)
  await db.insert(semesterTransitionLogs).values(transitionRows)
  await db.insert(studentAttendanceSnapshots).values(attendanceRows)
  await db.insert(studentAssessmentScores).values(assessmentRows)
  await db.insert(riskAssessments).values(riskRows)
  if (reassessmentRows.length > 0) await db.insert(reassessmentEvents).values(reassessmentRows)
  await db.insert(alertDecisions).values(alertDecisionRows)
  await db.insert(alertOutcomes).values(alertOutcomeRows)
  if (interventionRows.length > 0) await db.insert(studentInterventions).values(interventionRows)
  await db.insert(electiveRecommendations).values(electiveRecommendationRows)
  if (taskRows.length > 0) {
    await db.insert(academicTasks).values(taskRows)
    await db.insert(academicTaskTransitions).values(taskTransitionRows)
    await db.insert(academicTaskPlacements).values(taskPlacementRows)
  }

  const perFacultySemester = new Map<string, Array<typeof teacherAllocations.$inferInsert>>()
  teacherAllocationRows.forEach(row => {
    const key = `${row.facultyId}::${row.semesterNumber}`
    perFacultySemester.set(key, [...(perFacultySemester.get(key) ?? []), row])
  })
  for (const faculty of PROOF_FACULTY) {
    for (let semesterNumber = 1; semesterNumber <= 6; semesterNumber += 1) {
      const allocations = perFacultySemester.get(`${faculty.facultyId}::${semesterNumber}`) ?? []
      const assignedCredits = allocations.reduce((sum, row) => sum + (row.plannedContactHours > 0 ? 1 : 0), 0)
      const weeklyContactHours = allocations.reduce((sum, row) => sum + row.plannedContactHours, 0)
      teacherLoadRows.push({
        teacherLoadProfileId: `teacher_load_${faculty.facultyId}_s${semesterNumber}`,
        simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
        facultyId: faculty.facultyId,
        semesterNumber,
        sectionLoadCount: allocations.length,
        weeklyContactHours,
        assignedCredits,
        permissionsJson: JSON.stringify(faculty.permissions),
        createdAt: now,
        updatedAt: now,
      })
    }
  }
  await db.insert(teacherAllocations).values(teacherAllocationRows)
  await db.insert(teacherLoadProfiles).values(teacherLoadRows)

  await db.insert(simulationResetSnapshots).values({
    simulationResetSnapshotId: 'simulation_reset_mnc_2023_first6_v1',
    simulationRunId: MSRUAS_PROOF_SIMULATION_RUN_ID,
    batchId: MSRUAS_PROOF_BATCH_ID,
    snapshotLabel: 'Baseline snapshot',
    snapshotJson: JSON.stringify({
      batchId: MSRUAS_PROOF_BATCH_ID,
      facultyCount: PROOF_FACULTY.length,
      studentCount: trajectories.length,
      offeringCount: sem6OfferingRows.length,
      generatedAt: now,
    }),
    createdAt: now,
  })

  const timetablePayload = buildTimetablePayload(activeOfferingLoads)
  const currentTimetableSlice = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'timetableByFacultyId'))
  const mergedTimetable = currentTimetableSlice[0]
    ? { ...(JSON.parse(currentTimetableSlice[0].payloadJson) as Record<string, unknown>), ...timetablePayload }
    : timetablePayload
  await upsertRuntimeSlice(db, 'timetableByFacultyId', mergedTimetable, now)

  const markerPayload = Object.fromEntries(PROOF_FACULTY.map(faculty => [faculty.facultyId, {
    publishedAt: now,
    markers: PROOF_TERM_DEFS.flatMap(term => ([
      {
        markerId: `${faculty.facultyId}_${term.termId}_start`,
        facultyId: faculty.facultyId,
        markerType: 'semester-start',
        title: `Semester ${term.semesterNumber} start`,
        dateISO: term.startDate,
        allDay: true,
      },
      {
        markerId: `${faculty.facultyId}_${term.termId}_end`,
        facultyId: faculty.facultyId,
        markerType: 'semester-end',
        title: `Semester ${term.semesterNumber} end`,
        dateISO: term.endDate,
        allDay: true,
      },
    ])),
  }]))
  const currentCalendarSlice = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId'))
  const mergedCalendar = currentCalendarSlice[0]
    ? { ...(JSON.parse(currentCalendarSlice[0].payloadJson) as Record<string, unknown>), ...markerPayload }
    : markerPayload
  await upsertRuntimeSlice(db, 'adminCalendarByFacultyId', mergedCalendar, now)

  await db.insert(facultyCalendarWorkspaces).values(PROOF_FACULTY.map(faculty => ({
    facultyId: faculty.facultyId,
    templateJson: JSON.stringify(timetablePayload[faculty.facultyId] ?? { facultyId: faculty.facultyId, classBlocks: [] }),
    version: 1,
    createdAt: now,
    updatedAt: now,
  })))

  await db.insert(academicCalendarAuditEvents).values(PROOF_FACULTY.map(faculty => ({
    auditEventId: `calendar_audit_${faculty.facultyId}`,
    facultyId: faculty.facultyId,
    payloadJson: JSON.stringify({
      action: 'proof-seed-published',
      facultyId: faculty.facultyId,
      batchId: MSRUAS_PROOF_BATCH_ID,
      publishedAt: now,
    }),
    createdAt: now,
  })))

  return {
    curriculumImportVersionId: MSRUAS_PROOF_CURRICULUM_IMPORT_ID,
    validation,
    completenessCertificate,
  }
}
