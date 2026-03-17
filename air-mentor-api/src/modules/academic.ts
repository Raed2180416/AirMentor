import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicAssets,
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

async function getAcademicAsset<T>(context: RouteContext, assetKey: string, fallback: T): Promise<T> {
  const [row] = await context.db.select().from(academicAssets).where(eq(academicAssets.assetKey, assetKey))
  return row ? parseJson(row.payloadJson, fallback) : fallback
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
    avs: input.yearLabel === '1st Year' ? -1 : 0.35,
    prevCgpa: 0,
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
    tt1Score: input.offering.tt1Done ? 15 : null,
    tt1Max: 25,
    tt2Score: input.offering.tt2Done ? 16 : null,
    tt2Max: 25,
    quiz1: input.offering.tt1Done ? 6 : null,
    quiz2: null,
    asgn1: input.offering.tt1Done ? 7 : null,
    asgn2: null,
    prevCgpa: input.prevCgpa,
    riskProb: input.offering.stage >= 2 ? 0.35 : null,
    riskBand: input.offering.stage >= 2 ? 'Medium' : null,
    reasons: [],
    coScores: [],
    whatIf: [],
    interventions: [],
    flags: {
      backlog: input.prevCgpa < 5.5,
      lowAttendance: input.offering.attendance < 75,
      declining: false,
    },
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

function valuesMatchSemantically(left: unknown, right: unknown) {
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) < 0.000001
  }
  return left === right
}

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

async function buildAcademicBootstrap(context: RouteContext) {
  const [
    professor,
    seededFaculty,
    seededOfferings,
    seededStudentsByOffering,
    seededMenteesByUsn,
    studentHistoryByUsn,
  ] = await Promise.all([
    getAcademicAsset(context, 'professor', null as Record<string, unknown> | null),
    getAcademicAsset(context, 'faculty', [] as Array<Record<string, unknown>>),
    getAcademicAsset(context, 'offerings', [] as Array<Record<string, unknown>>),
    getAcademicAsset(context, 'studentsByOffering', {} as Record<string, Array<Record<string, unknown>>>),
    getAcademicAsset(context, 'menteesByUsn', {} as Record<string, Record<string, unknown>>),
    getAcademicAsset(context, 'studentHistoryByUsn', {} as Record<string, Record<string, unknown>>),
  ])

  const seededFacultyById = Object.fromEntries(seededFaculty.map(item => [String(item.facultyId ?? ''), item]))
  const seededOfferingsById = Object.fromEntries(seededOfferings.map(item => [String(item.offId ?? ''), item]))

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
  const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
  const studentById = Object.fromEntries(studentRows.map(row => [row.studentId, row]))
  const studentAcademicProfileById = Object.fromEntries(profileRows.map(row => [row.studentId, row]))
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
  }

  const activeMentorAssignmentByStudentId = new Map<string, typeof mentorAssignments.$inferSelect>()
  for (const assignment of mentorRows) {
    if (assignment.effectiveTo) continue
    const existing = activeMentorAssignmentByStudentId.get(assignment.studentId)
    if (!existing || assignment.effectiveFrom > existing.effectiveFrom) {
      activeMentorAssignmentByStudentId.set(assignment.studentId, assignment)
    }
  }

  const offeringTemplateKeys = new Map<string, string>()
  for (const [offeringId, studentsForOffering] of Object.entries(seededStudentsByOffering)) {
    const sample = offeringRows.find(row => row.offeringId === offeringId)
    if (!sample) continue
    offeringTemplateKeys.set(`${sample.termId}::${sample.sectionCode}`, offeringId)
    if (studentsForOffering && studentsForOffering.length > 0) {
      offeringTemplateKeys.set(`${sample.yearLabel}::${sample.sectionCode}::${sample.branchId}`, offeringId)
    }
  }

  const academicOfferings: AcademicOfferingProjection[] = offeringRows.map(offeringRow => {
    const course = courseById[offeringRow.courseId]
    const term = termById[offeringRow.termId]
    const branch = branchById[offeringRow.branchId]
    const department = branch ? departmentById[branch.departmentId] : undefined
    const enrollmentKey = `${offeringRow.termId}::${offeringRow.sectionCode}`
    const sectionEnrollments = enrollmentsByGroup.get(enrollmentKey) ?? []
    const mapped = mapOfferingRow({
      offering: offeringRow,
      course,
      term,
      department,
      computedCount: sectionEnrollments.length,
    })
    const seeded = seededOfferingsById[offeringRow.offeringId]
    if (!seeded) return mapped
    return {
      ...seeded,
      id: mapped.id,
      offId: mapped.offId,
      code: mapped.code,
      title: mapped.title,
      year: mapped.year,
      dept: mapped.dept,
      sem: mapped.sem,
      section: mapped.section,
      count: sectionEnrollments.length === 0 ? Number(seeded.count ?? mapped.count) : mapped.count,
      attendance: mapped.attendance,
      stage: mapped.stage,
      stageInfo: mapped.stageInfo,
      tt1Done: mapped.tt1Done,
      tt2Done: mapped.tt2Done,
      sections: Array.isArray((seeded as { sections?: unknown }).sections)
        ? ((seeded as { sections: string[] }).sections)
        : mapped.sections,
      enrolled: Array.isArray((seeded as { enrolled?: unknown }).enrolled)
        ? ((seeded as { enrolled: number[] }).enrolled)
        : mapped.enrolled,
      att: Array.isArray((seeded as { att?: unknown }).att)
        ? ((seeded as { att: number[] }).att)
        : mapped.att,
      ...(seeded.tt1Locked != null || mapped.tt1Locked ? { tt1Locked: mapped.tt1Locked } : {}),
      ...(seeded.tt2Locked != null || mapped.tt2Locked ? { tt2Locked: mapped.tt2Locked } : {}),
      ...(seeded.quizLocked != null || mapped.quizLocked ? { quizLocked: mapped.quizLocked } : {}),
      ...(seeded.asgnLocked != null || mapped.asgnLocked ? { asgnLocked: mapped.asgnLocked } : {}),
      pendingAction: mapped.pendingAction,
    }
  })

  const studentsByOffering = Object.fromEntries(academicOfferings.map(offering => {
    const sectionEnrollments = enrollmentsByGroup.get(`${offeringRows.find(row => row.offeringId === offering.offId)?.termId ?? ''}::${offering.section}`) ?? []
    const seededList = seededStudentsByOffering[offering.offId] ?? seededStudentsByOffering[offeringTemplateKeys.get(`${offering.year}::${offering.section}::${offeringRows.find(row => row.offeringId === offering.offId)?.branchId ?? ''}`) ?? ''] ?? []
    const nextStudents = sectionEnrollments.map((enrollment, index) => {
      const student = studentById[enrollment.studentId]
      const profile = studentAcademicProfileById[enrollment.studentId]
      const prevCgpa = profile ? profile.prevCgpaScaled / 100 : 0
      const seededStudent = seededList.find(item => item.usn === student.usn) ?? seededList[index] ?? null
      if (seededStudent) {
        return {
          ...seededStudent,
          ...(valuesMatchSemantically(seededStudent.usn, student.usn) ? {} : { usn: student.usn }),
          ...(valuesMatchSemantically(seededStudent.name, student.name) ? {} : { name: student.name }),
          ...(valuesMatchSemantically(seededStudent.phone, student.phone ?? '') ? {} : { phone: student.phone ?? '' }),
          ...(valuesMatchSemantically(seededStudent.prevCgpa, prevCgpa) ? {} : { prevCgpa }),
        }
      }
      return inferStudentFallback({
        offering,
        student,
        prevCgpa,
      })
    })
    return [offering.offId, nextStudents]
  })) as Record<string, AcademicStudentProjection[]>

  const mentees = studentRows.flatMap(student => {
    const mentorAssignment = activeMentorAssignmentByStudentId.get(student.studentId)
    if (!mentorAssignment) return []
    const enrollment = enrollmentRows.find(item => item.studentId === student.studentId)
    const branch = enrollment ? branchById[enrollment.branchId] : undefined
    const department = branch ? departmentById[branch.departmentId] : undefined
    const offering = academicOfferings.find(item => item.section === (enrollment?.sectionCode ?? '') && item.sem === (enrollment ? termById[enrollment.termId]?.semesterNumber : undefined))
    const baseline = seededMenteesByUsn[student.usn]
    if (baseline) {
      return [{
        ...baseline,
        usn: student.usn,
        name: student.name,
        phone: student.phone ?? '',
        year: offering?.year ?? baseline.year,
        section: enrollment?.sectionCode ?? baseline.section,
        dept: department?.code ?? baseline.dept,
      }]
    }
    return [inferMenteeFallback({
      student,
      enrollment,
      deptCode: department?.code ?? 'CSE',
      yearLabel: offering?.year ?? '1st Year',
    })]
  }) as AcademicMenteeProjection[]
  const seededMenteeOrder = Object.values(seededMenteesByUsn).map(item => String(item.id ?? ''))
  mentees.sort((left, right) => {
    const leftIndex = seededMenteeOrder.indexOf(String(left.id ?? ''))
    const rightIndex = seededMenteeOrder.indexOf(String(right.id ?? ''))
    if (leftIndex === -1 && rightIndex === -1) return String(left.id ?? '').localeCompare(String(right.id ?? ''))
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
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
      const seeded = seededFacultyById[row.facultyId]
      const user = userById[row.userId]
      const grants = roleGrantRows.filter(grant => grant.facultyId === row.facultyId)
      const hasSystemAdminGrant = grants.some(grant => grant.roleCode === 'SYSTEM_ADMIN')
      if (hasSystemAdminGrant && !seeded) return null
      const allowedRoles = dedupeRoles(grants.map(grant => grant.roleCode))
      if (allowedRoles.length === 0) return null
      const primaryAppointment = primaryAppointmentByFacultyId.get(row.facultyId)
      const appointmentDepartment = primaryAppointment ? departmentById[primaryAppointment.departmentId] : undefined
      const offeringIds = Array.from(new Set(offeringIdsByFacultyId.get(row.facultyId) ?? []))
      const courseCodes = Array.from(new Set(offeringIds.map(offeringId => offeringCodeById[offeringId]).filter((value): value is string => !!value)))
      const nextMenteeIds = Array.from(new Set(menteeIdsByFacultyId.get(row.facultyId) ?? []))
      const seededMenteeOrder = Array.isArray(seeded?.menteeIds) ? seeded.menteeIds.map(value => String(value)) : []
      nextMenteeIds.sort((left, right) => {
        const leftIndex = seededMenteeOrder.indexOf(left)
        const rightIndex = seededMenteeOrder.indexOf(right)
        if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
        if (leftIndex === -1) return 1
        if (rightIndex === -1) return -1
        return leftIndex - rightIndex
      })
      return {
        facultyId: row.facultyId,
        name: String(row.displayName || seeded?.name || row.facultyId),
        initials: String(seeded?.initials ?? buildInitials(row.displayName)),
        email: String(user?.email ?? seeded?.email ?? `${row.facultyId}@airmentor.local`),
        dept: String(appointmentDepartment?.code ?? seeded?.dept ?? 'GEN'),
        roleTitle: String(row.designation || seeded?.roleTitle || 'Faculty'),
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
        finalsMax: sample.code === 'CS702' ? 100 : 50,
        quizWeight: sample.code === 'CS401' ? 20 : 10,
        assignmentWeight: sample.code === 'CS401' ? 10 : 20,
        quizCount: sample.code === 'CS401' ? 2 : 1,
        assignmentCount: sample.code === 'CS401' ? 1 : 2,
      },
    }
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
    return buildAcademicBootstrap(context)
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
    const snapshot = await buildAcademicBootstrap(context)
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
