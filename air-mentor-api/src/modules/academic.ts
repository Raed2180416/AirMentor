import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicRuntimeState,
  academicTerms,
  branches,
  courses,
  departments,
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  roleGrants,
  sectionOfferings,
  studentAcademicProfiles,
  studentEnrollments,
  students,
  userAccounts,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import {
  emitAuditEvent,
  expectVersion,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'

const academicRoleCodes = ['COURSE_LEADER', 'MENTOR', 'HOD'] as const
const runtimeStateKeys = [
  'studentPatches',
  'schemeByOffering',
  'ttBlueprintsByOffering',
  'drafts',
  'cellValues',
  'lockByOffering',
  'lockAuditByTarget',
  'tasks',
  'resolvedTasks',
  'timetableByFacultyId',
  'adminCalendarByFacultyId',
  'taskPlacements',
  'calendarAudit',
] as const

const runtimeStateKeySchema = z.enum(runtimeStateKeys)

const offeringCreateSchema = z.object({
  courseId: z.string().min(1),
  termId: z.string().min(1),
  branchId: z.string().min(1),
  sectionCode: z.string().min(1),
  yearLabel: z.string().min(1),
  attendance: z.number().int().min(0).max(100),
  studentCount: z.number().int().min(0),
  stage: z.number().int().min(1).max(3),
  stageLabel: z.string().min(1),
  stageDescription: z.string().min(1),
  stageColor: z.string().min(1),
  tt1Done: z.boolean().default(false),
  tt2Done: z.boolean().default(false),
  tt1Locked: z.boolean().default(false),
  tt2Locked: z.boolean().default(false),
  quizLocked: z.boolean().default(false),
  assignmentLocked: z.boolean().default(false),
  pendingAction: z.string().nullable().optional(),
  status: z.string().min(1),
})

const offeringPatchSchema = offeringCreateSchema.extend({
  version: z.number().int().positive(),
})

const ownershipCreateSchema = z.object({
  offeringId: z.string().min(1),
  facultyId: z.string().min(1),
  ownershipRole: z.string().min(1),
  status: z.string().min(1),
})

const ownershipPatchSchema = ownershipCreateSchema.extend({
  version: z.number().int().positive(),
})

const publicFacultyResponseSchema = z.object({
  items: z.array(z.object({
    facultyId: z.string(),
    name: z.string(),
    dept: z.string(),
    roleTitle: z.string(),
    allowedRoles: z.array(z.enum(['Course Leader', 'Mentor', 'HoD'])),
  })),
})

type PublicFacultyResponse = z.infer<typeof publicFacultyResponseSchema>

function toUiRole(roleCode: string) {
  if (roleCode === 'COURSE_LEADER') return 'Course Leader'
  if (roleCode === 'MENTOR') return 'Mentor'
  if (roleCode === 'HOD') return 'HoD'
  return null
}

function sortRoleLabels(left: string, right: string) {
  const order = ['Course Leader', 'Mentor', 'HoD']
  return order.indexOf(left) - order.indexOf(right)
}

async function getAcademicRuntimeState<T>(context: RouteContext, stateKey: string, fallback: T): Promise<T> {
  const [row] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  return row ? parseJson(row.payloadJson, fallback) : fallback
}

function dedupeRoles(roleCodes: string[]) {
  return Array.from(new Set(roleCodes.map(toUiRole).filter((value): value is 'Course Leader' | 'Mentor' | 'HoD' => !!value))).sort(sortRoleLabels)
}

function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function inferMenteeFallback(input: {
  student: typeof students.$inferSelect
  enrollment?: typeof studentEnrollments.$inferSelect
  deptCode: string
  yearLabel: string
  prevCgpa: number
}) {
  return {
    id: `mentee-${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    year: input.yearLabel,
    section: input.enrollment?.sectionCode ?? 'A',
    dept: input.deptCode,
    courseRisks: [],
    avs: -1,
    prevCgpa: input.prevCgpa,
    interventions: [],
  }
}

function inferStudentFallback(input: {
  offering: {
    offId: string
    attendance: number
    tt1Done: boolean
    tt2Done: boolean
    stage: number
  }
  student: typeof students.$inferSelect
  prevCgpa: number
}) {
  return {
    id: `${input.offering.offId}::${input.student.studentId}`,
    usn: input.student.usn,
    name: input.student.name,
    phone: input.student.phone ?? '',
    present: Math.round((input.offering.attendance / 100) * 45),
    totalClasses: 45,
    tt1Score: null,
    tt1Max: 25,
    tt2Score: null,
    tt2Max: 25,
    quiz1: null,
    quiz2: null,
    asgn1: null,
    asgn2: null,
    prevCgpa: input.prevCgpa,
    riskProb: null,
    riskBand: null,
    reasons: [],
    coScores: [],
    whatIf: [],
    interventions: [],
    flags: {
      backlog: input.prevCgpa > 0 && input.prevCgpa < 5.5,
      lowAttendance: input.offering.attendance > 0 && input.offering.attendance < 75,
      declining: false,
    },
  }
}

function buildStudentHistoryRecord(input: {
  student: typeof students.$inferSelect
  branch?: typeof branches.$inferSelect
  department?: typeof departments.$inferSelect
  prevCgpa: number
}) {
  const departmentCode = input.department?.code ?? input.branch?.code ?? 'GEN'
  const programLabel = input.branch?.name ?? input.department?.name ?? departmentCode
  const notes = input.prevCgpa > 0
    ? ['Transcript history has not been published yet. Current CGPA reflects the latest recorded student profile.']
    : ['Transcript history has not been published yet for this student.']

  return {
    usn: input.student.usn,
    studentName: input.student.name,
    program: programLabel,
    dept: departmentCode,
    trend: 'Stable' as const,
    currentCgpa: input.prevCgpa,
    advisoryNotes: notes,
    repeatSubjects: [],
    terms: [],
  }
}

type AcademicStudentProjection = ReturnType<typeof inferStudentFallback> & Record<string, unknown>
type AcademicMenteeProjection = ReturnType<typeof inferMenteeFallback> & Record<string, unknown>
type AcademicOfferingProjection = Omit<ReturnType<typeof mapOfferingRow>, 'termId' | 'branchId' | 'tt1Locked' | 'tt2Locked' | 'quizLocked' | 'asgnLocked'> & {
  termId?: string
  branchId?: string
  tt1Locked?: boolean
  tt2Locked?: boolean
  quizLocked?: boolean
  asgnLocked?: boolean
} & Record<string, unknown>

function mapOfferingRow(input: {
  offering: typeof sectionOfferings.$inferSelect
  course: typeof courses.$inferSelect
  term: typeof academicTerms.$inferSelect
  department: typeof departments.$inferSelect | undefined
  computedCount?: number
}) {
  const count = input.computedCount ?? input.offering.studentCount
  return {
    id: input.course.courseId,
    offId: input.offering.offeringId,
    termId: input.offering.termId,
    branchId: input.offering.branchId,
    code: input.course.courseCode,
    title: input.course.title,
    year: input.offering.yearLabel,
    dept: input.department?.code ?? 'CSE',
    sem: input.term.semesterNumber,
    section: input.offering.sectionCode,
    count,
    attendance: input.offering.attendance,
    stage: input.offering.stage,
    stageInfo: {
      stage: input.offering.stage,
      label: input.offering.stageLabel,
      desc: input.offering.stageDescription,
      color: input.offering.stageColor,
    },
    tt1Done: !!input.offering.tt1Done,
    tt2Done: !!input.offering.tt2Done,
    tt1Locked: !!input.offering.tt1Locked,
    tt2Locked: !!input.offering.tt2Locked,
    quizLocked: !!input.offering.quizLocked,
    asgnLocked: !!input.offering.assignmentLocked,
    pendingAction: input.offering.pendingAction,
    sections: [input.offering.sectionCode],
    enrolled: [count],
    att: [input.offering.attendance],
  }
}

function buildProfessorProjection(input: {
  faculty: Array<{
    facultyId: string
    name: string
    initials: string
    email: string
    dept: string
    roleTitle: string
  }>
  facultyId?: string | null
  roleCode?: string | null
}) {
  const current = input.facultyId
    ? (input.faculty.find(account => account.facultyId === input.facultyId) ?? null)
    : null
  const fallback = current ?? input.faculty[0] ?? {
    facultyId: 'faculty-unassigned',
    name: 'Teaching Workspace',
    initials: 'TW',
    email: '',
    dept: 'Unassigned',
    roleTitle: 'Faculty',
  }

  return {
    name: fallback.name,
    id: fallback.facultyId,
    dept: fallback.dept,
    role: input.roleCode ? (toUiRole(input.roleCode) ?? fallback.roleTitle) : fallback.roleTitle,
    initials: fallback.initials,
    email: fallback.email,
  }
}

async function buildAcademicBootstrap(
  context: RouteContext,
  viewer: {
    facultyId?: string | null
    roleCode?: string | null
  } = {},
) {
  const runtimeEntries = await Promise.all(runtimeStateKeys.map(async stateKey => [stateKey, await getAcademicRuntimeState(context, stateKey, {})] as const))
  const runtime = Object.fromEntries(runtimeEntries)

  const [
    courseRows,
    termRows,
    branchRows,
    departmentRows,
    offeringRows,
    ownershipRows,
    facultyRows,
    appointmentRows,
    userRows,
    roleGrantRows,
    studentRows,
    profileRows,
    enrollmentRows,
    mentorRows,
  ] = await Promise.all([
    context.db.select().from(courses).orderBy(asc(courses.courseCode)),
    context.db.select().from(academicTerms),
    context.db.select().from(branches),
    context.db.select().from(departments),
    context.db.select().from(sectionOfferings).where(eq(sectionOfferings.status, 'active')).orderBy(asc(sectionOfferings.offeringId)),
    context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.status, 'active')),
    context.db.select().from(facultyProfiles).where(eq(facultyProfiles.status, 'active')).orderBy(asc(facultyProfiles.facultyId)),
    context.db.select().from(facultyAppointments).where(eq(facultyAppointments.status, 'active')).orderBy(asc(facultyAppointments.facultyId)),
    context.db.select().from(userAccounts),
    context.db.select().from(roleGrants).where(eq(roleGrants.status, 'active')),
    context.db.select().from(students).where(eq(students.status, 'active')).orderBy(asc(students.usn)),
    context.db.select().from(studentAcademicProfiles),
    context.db.select().from(studentEnrollments).where(eq(studentEnrollments.academicStatus, 'active')).orderBy(asc(studentEnrollments.termId), asc(studentEnrollments.sectionCode), asc(studentEnrollments.rosterOrder), asc(studentEnrollments.studentId)),
    context.db.select().from(mentorAssignments),
  ])

  const courseById = Object.fromEntries(courseRows.map(row => [row.courseId, row]))
  const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
  const offeringRowById = Object.fromEntries(offeringRows.map(row => [row.offeringId, row]))
  const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
  const studentById = Object.fromEntries(studentRows.map(row => [row.studentId, row]))
  const studentAcademicProfileById = Object.fromEntries(profileRows.map(row => [row.studentId, row]))
  const activeEnrollmentByStudentId = new Map<string, typeof studentEnrollments.$inferSelect>()
  const primaryAppointmentByFacultyId = new Map<string, typeof facultyAppointments.$inferSelect>()
  for (const appointment of appointmentRows) {
    const current = primaryAppointmentByFacultyId.get(appointment.facultyId)
    if (!current || appointment.isPrimary === 1) {
      primaryAppointmentByFacultyId.set(appointment.facultyId, appointment)
    }
  }

  const enrollmentsByGroup = new Map<string, Array<typeof studentEnrollments.$inferSelect>>()
  for (const enrollment of enrollmentRows) {
    const key = `${enrollment.termId}::${enrollment.sectionCode}`
    enrollmentsByGroup.set(key, [...(enrollmentsByGroup.get(key) ?? []), enrollment])
    const current = activeEnrollmentByStudentId.get(enrollment.studentId)
    if (!current || enrollment.startDate > current.startDate) {
      activeEnrollmentByStudentId.set(enrollment.studentId, enrollment)
    }
  }

  const activeMentorAssignmentByStudentId = new Map<string, typeof mentorAssignments.$inferSelect>()
  for (const assignment of mentorRows) {
    if (assignment.effectiveTo) continue
    const existing = activeMentorAssignmentByStudentId.get(assignment.studentId)
    if (!existing || assignment.effectiveFrom > existing.effectiveFrom) {
      activeMentorAssignmentByStudentId.set(assignment.studentId, assignment)
    }
  }

  const academicOfferings: AcademicOfferingProjection[] = offeringRows.map(offeringRow => {
    const course = courseById[offeringRow.courseId]
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : undefined
    const enrollmentKey = `${offeringRow.termId}::${offeringRow.sectionCode}`
    const sectionEnrollments = enrollmentsByGroup.get(enrollmentKey) ?? []
    return mapOfferingRow({
      offering: offeringRow,
      course,
      term,
      department,
      computedCount: sectionEnrollments.length,
    })
  })

  const studentsByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const offeringRow = offeringRowById[offering.offId]
    const sectionEnrollments = offeringRow
      ? (enrollmentsByGroup.get(`${offeringRow.termId}::${offering.section}`) ?? [])
      : []
    const nextStudents = sectionEnrollments.map(enrollment => {
      const student = studentById[enrollment.studentId]
      if (!student) return null
      const profile = studentAcademicProfileById[enrollment.studentId]
      const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
      return inferStudentFallback({
        offering,
        student,
        prevCgpa,
      })
    }).filter((student): student is AcademicStudentProjection => !!student)
    return [offering.offId, nextStudents]
  })) as Record<string, AcademicStudentProjection[]>

  const studentHistoryByUsn = Object.fromEntries(studentRows.map(student => {
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    return [student.usn, buildStudentHistoryRecord({
      student,
      branch,
      department,
      prevCgpa,
    })]
  }))

  const mentees = studentRows.flatMap(student => {
    const mentorAssignment = activeMentorAssignmentByStudentId.get(student.studentId)
    if (!mentorAssignment) return []
    const enrollment = activeEnrollmentByStudentId.get(student.studentId)
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const term = enrollment ? termById[enrollment.termId] : undefined
    const offering = academicOfferings.find(item => item.section === (enrollment?.sectionCode ?? '') && item.sem === term?.semesterNumber)
    const profile = studentAcademicProfileById[student.studentId]
    const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
    return [inferMenteeFallback({
      student,
      enrollment,
      deptCode: department?.code ?? 'GEN',
      yearLabel: offering?.year ?? `Semester ${term?.semesterNumber ?? 1}`,
      prevCgpa,
    })]
  }) as AcademicMenteeProjection[]
  mentees.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name)
    if (nameOrder !== 0) return nameOrder
    return left.usn.localeCompare(right.usn)
  })

  const menteeByStudentId = new Map<string, string>()
  for (const mentee of mentees) {
    const matchingStudents = studentRows.filter(student => student.usn === mentee.usn)
    for (const student of matchingStudents) {
      menteeByStudentId.set(student.studentId, mentee.id)
    }
  }

  const offeringCodeById = Object.fromEntries(academicOfferings.map(offering => [offering.offId, offering.code]))
  const offeringIdsByFacultyId = new Map<string, string[]>()
  for (const ownership of ownershipRows) {
    offeringIdsByFacultyId.set(ownership.facultyId, [...(offeringIdsByFacultyId.get(ownership.facultyId) ?? []), ownership.offeringId])
  }
  const menteeIdsByFacultyId = new Map<string, string[]>()
  for (const assignment of activeMentorAssignmentByStudentId.values()) {
    const menteeId = menteeByStudentId.get(assignment.studentId)
    if (!menteeId) continue
    menteeIdsByFacultyId.set(assignment.facultyId, [...(menteeIdsByFacultyId.get(assignment.facultyId) ?? []), menteeId])
  }

  const faculty = facultyRows
    .map(row => {
      const user = userById[row.userId]
      const grants = roleGrantRows.filter(grant => grant.facultyId === row.facultyId)
      const allowedRoles = dedupeRoles(grants.map(grant => grant.roleCode))
      if (allowedRoles.length === 0) return null
      const primaryAppointment = primaryAppointmentByFacultyId.get(row.facultyId)
      const appointmentDepartment = primaryAppointment ? departmentById[primaryAppointment.departmentId] : undefined
      const offeringIds = Array.from(new Set(offeringIdsByFacultyId.get(row.facultyId) ?? []))
      const courseCodes = Array.from(new Set(offeringIds.map(offeringId => offeringCodeById[offeringId]).filter((value): value is string => !!value)))
      const nextMenteeIds = Array.from(new Set(menteeIdsByFacultyId.get(row.facultyId) ?? []))
      nextMenteeIds.sort((left, right) => {
        return left.localeCompare(right)
      })
      return {
        facultyId: row.facultyId,
        name: String(row.displayName || row.facultyId),
        initials: buildInitials(row.displayName),
        email: String(user?.email ?? `${row.facultyId}@airmentor.local`),
        dept: String(appointmentDepartment?.code ?? 'GEN'),
        roleTitle: String(row.designation || 'Faculty'),
        allowedRoles,
        courseCodes,
        offeringIds,
        menteeIds: nextMenteeIds,
      }
    })
    .filter((value): value is NonNullable<typeof value> => !!value)

  const yearGroups = ['1st Year', '2nd Year', '3rd Year', '4th Year']
    .map(year => ({
      year,
      color: ({ '1st Year': '#f59e0b', '2nd Year': '#6366f1', '3rd Year': '#10b981', '4th Year': '#ec4899' } as Record<string, string>)[year] ?? '#8892a4',
      stageInfo: academicOfferings.find(offering => offering.year === year)?.stageInfo ?? { stage: 1, label: 'Stage 1', desc: 'Term Start → TT1', color: '#f97316' },
      offerings: academicOfferings.filter(offering => offering.year === year),
    }))
    .filter(group => group.offerings.length > 0)

  const teachers = faculty.map(account => {
    const offerings = academicOfferings.filter(offering => account.offeringIds.includes(offering.offId))
    const studentsCount = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId]?.length ?? 0), 0)
    const highRisk = offerings.reduce((sum, offering) => sum + (studentsByOffering[offering.offId] ?? []).filter(student => student.riskBand === 'High').length, 0)
    const avgAtt = offerings.length > 0
      ? Math.round(offerings.reduce((sum, offering) => sum + offering.attendance, 0) / offerings.length)
      : 0
    const completenessChecks = offerings.flatMap(offering => [offering.tt1Locked ? 1 : 0, offering.tt2Locked ? 1 : 0, offering.quizLocked ? 1 : 0, offering.asgnLocked ? 1 : 0])
    const completeness = completenessChecks.length > 0
      ? Math.round((completenessChecks.reduce((sum, value) => sum + value, 0) / completenessChecks.length) * 100)
      : 0
    return {
      id: account.facultyId,
      name: account.name,
      initials: account.initials,
      dept: account.dept,
      role: account.roleTitle,
      roles: account.allowedRoles,
      offerings: offerings.length,
      students: studentsCount,
      highRisk,
      avgAtt,
      completeness,
      pendingTasks: offerings.filter(offering => !!offering.pendingAction).length,
    }
  })

  const subjectRuns = Object.values(academicOfferings.reduce<Record<string, typeof academicOfferings>>((acc, offering) => {
    const key = `${offering.code}::${offering.year}::${offering.sem}`
    acc[key] = [...(acc[key] ?? []), offering]
    return acc
  }, {})).map((grouped, index) => {
    const sample = grouped[0]
    const sectionOfferingIds = grouped.map(item => item.offId)
    const courseLeaderFacultyIds = faculty
      .filter(account => account.allowedRoles.includes('Course Leader') && account.courseCodes.includes(sample.code))
      .map(account => account.facultyId)
    return {
      subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
      code: sample.code,
      title: sample.title,
      year: sample.year,
      dept: sample.dept,
      sem: sample.sem,
      sectionOfferingIds,
      courseLeaderFacultyIds,
      scheme: {
        subjectRunId: `run-${sample.code}-${sample.year.replace(/\s+/g, '').toLowerCase()}-s${sample.sem}-${index + 1}`,
        status: grouped.some(item => item.tt1Locked || item.tt2Locked || item.quizLocked || item.asgnLocked) ? 'Locked' : 'Needs Setup',
        finalsMax: 50,
        quizWeight: 10,
        assignmentWeight: 20,
        quizCount: 1,
        assignmentCount: 2,
      },
    }
  })

  const professor = buildProfessorProjection({
    faculty,
    facultyId: viewer.facultyId,
    roleCode: viewer.roleCode,
  })

  return {
    professor,
    faculty,
    offerings: academicOfferings,
    yearGroups,
    mentees,
    teachers,
    subjectRuns,
    studentsByOffering,
    studentHistoryByUsn,
    runtime,
  }
}

async function buildPublicFacultyList(context: RouteContext): Promise<PublicFacultyResponse> {
  const snapshot = await buildAcademicBootstrap(context)
  return publicFacultyResponseSchema.parse({
    items: snapshot.faculty.map(account => ({
      facultyId: account.facultyId,
      name: account.name,
      dept: account.dept,
      roleTitle: account.roleTitle,
      allowedRoles: account.allowedRoles,
    })),
  })
}

export async function registerAcademicRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/academic/public/faculty', {
    schema: {
      tags: ['academic'],
      summary: 'List academic faculty accounts for the teaching portal login selector',
    },
  }, async () => buildPublicFacultyList(context))

  app.get('/api/academic/bootstrap', {
    schema: {
      tags: ['academic'],
      summary: 'Return the full academic portal parity snapshot',
    },
  }, async request => {
    requireRole(request, [...academicRoleCodes])
    return buildAcademicBootstrap(context, {
      facultyId: request.auth?.facultyId ?? null,
      roleCode: request.auth?.activeRoleGrant.roleCode ?? null,
    })
  })

  app.put('/api/academic/runtime/:stateKey', {
    schema: {
      tags: ['academic'],
      summary: 'Persist a single academic runtime slice',
    },
  }, async request => {
    requireRole(request, [...academicRoleCodes])
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ stateKey: runtimeStateKeySchema }), request.params)
    const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, params.stateKey))
    if (current) {
      await context.db.update(academicRuntimeState).set({
        payloadJson: stringifyJson(request.body),
        version: current.version + 1,
        updatedAt: context.now(),
      }).where(eq(academicRuntimeState.stateKey, params.stateKey))
    } else {
      await context.db.insert(academicRuntimeState).values({
        stateKey: params.stateKey,
        payloadJson: stringifyJson(request.body),
        version: 1,
        updatedAt: context.now(),
      })
    }
    await emitAuditEvent(context, {
      entityType: 'academic_runtime_state',
      entityId: params.stateKey,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      metadata: { stateKey: params.stateKey },
    })
    return { ok: true, stateKey: params.stateKey }
  })

  app.get('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List section offerings',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const snapshot = await buildAcademicBootstrap(context, {
      facultyId: request.auth?.facultyId ?? null,
      roleCode: request.auth?.activeRoleGrant.roleCode ?? null,
    })
    return { items: snapshot.offerings }
  })

  app.post('/api/admin/offerings', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(offeringCreateSchema, request.body)
    const offeringId = createId('offering')
    const now = context.now()
    await context.db.insert(sectionOfferings).values({
      offeringId,
      courseId: body.courseId,
      termId: body.termId,
      branchId: body.branchId,
      sectionCode: body.sectionCode,
      yearLabel: body.yearLabel,
      attendance: body.attendance,
      studentCount: body.studentCount,
      stage: body.stage,
      stageLabel: body.stageLabel,
      stageDescription: body.stageDescription,
      stageColor: body.stageColor,
      tt1Done: body.tt1Done ? 1 : 0,
      tt2Done: body.tt2Done ? 1 : 0,
      tt1Locked: body.tt1Locked ? 1 : 0,
      tt2Locked: body.tt2Locked ? 1 : 0,
      quizLocked: body.quizLocked ? 1 : 0,
      assignmentLocked: body.assignmentLocked ? 1 : 0,
      pendingAction: body.pendingAction ?? null,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [created] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, offeringId))
    await emitAuditEvent(context, {
      entityType: 'section_offering',
      entityId: offeringId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      after: created,
    })
    return created
  })

  app.patch('/api/admin/offerings/:offeringId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update a section offering',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ offeringId: z.string().min(1) }), request.params)
    const body = parseOrThrow(offeringPatchSchema, request.body)
    const [current] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, params.offeringId))
    if (!current) throw notFound('Section offering not found')
    expectVersion(current.version, body.version, 'section offering', current)
    await context.db.update(sectionOfferings).set({
      courseId: body.courseId,
      termId: body.termId,
      branchId: body.branchId,
      sectionCode: body.sectionCode,
      yearLabel: body.yearLabel,
      attendance: body.attendance,
      studentCount: body.studentCount,
      stage: body.stage,
      stageLabel: body.stageLabel,
      stageDescription: body.stageDescription,
      stageColor: body.stageColor,
      tt1Done: body.tt1Done ? 1 : 0,
      tt2Done: body.tt2Done ? 1 : 0,
      tt1Locked: body.tt1Locked ? 1 : 0,
      tt2Locked: body.tt2Locked ? 1 : 0,
      quizLocked: body.quizLocked ? 1 : 0,
      assignmentLocked: body.assignmentLocked ? 1 : 0,
      pendingAction: body.pendingAction ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(sectionOfferings.offeringId, params.offeringId))
    const [updated] = await context.db.select().from(sectionOfferings).where(eq(sectionOfferings.offeringId, params.offeringId))
    await emitAuditEvent(context, {
      entityType: 'section_offering',
      entityId: params.offeringId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: current,
      after: updated,
    })
    return updated
  })

  app.get('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'List offering ownership records',
    },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const items = await context.db.select().from(facultyOfferingOwnerships).orderBy(asc(facultyOfferingOwnerships.ownershipId))
    return { items }
  })

  app.post('/api/admin/offering-ownership', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Create offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(ownershipCreateSchema, request.body)
    const ownershipId = createId('ownership')
    const now = context.now()
    await context.db.insert(facultyOfferingOwnerships).values({
      ownershipId,
      offeringId: body.offeringId,
      facultyId: body.facultyId,
      ownershipRole: body.ownershipRole,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [created] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, ownershipId))
    await emitAuditEvent(context, {
      entityType: 'faculty_offering_ownership',
      entityId: ownershipId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      after: created,
    })
    return created
  })

  app.patch('/api/admin/offering-ownership/:ownershipId', {
    schema: {
      tags: ['academic-admin'],
      summary: 'Update offering ownership',
    },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ ownershipId: z.string().min(1) }), request.params)
    const body = parseOrThrow(ownershipPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    if (!current) throw notFound('Offering ownership not found')
    expectVersion(current.version, body.version, 'offering ownership', current)
    await context.db.update(facultyOfferingOwnerships).set({
      offeringId: body.offeringId,
      facultyId: body.facultyId,
      ownershipRole: body.ownershipRole,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    const [updated] = await context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.ownershipId, params.ownershipId))
    await emitAuditEvent(context, {
      entityType: 'faculty_offering_ownership',
      entityId: params.ownershipId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: current,
      after: updated,
    })
    return updated
  })
}
