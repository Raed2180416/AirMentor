import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicTerms,
  batches,
  branches,
  departments,
  institutions,
  mentorAssignments,
  studentAcademicProfiles,
  studentEnrollments,
  students,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const studentCreateSchema = z.object({
  usn: z.string().min(1),
  rollNumber: z.string().optional().nullable(),
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  admissionDate: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const studentPatchSchema = studentCreateSchema.extend({
  version: z.number().int().positive(),
})

const enrollmentCreateSchema = z.object({
  studentId: z.string().min(1),
  branchId: z.string().min(1),
  termId: z.string().min(1),
  sectionCode: z.string().min(1),
  rosterOrder: z.number().int().nonnegative().optional(),
  academicStatus: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
})

const enrollmentPatchSchema = enrollmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const mentorAssignmentCreateSchema = z.object({
  studentId: z.string().min(1),
  facultyId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  source: z.string().min(1),
})

const mentorAssignmentPatchSchema = mentorAssignmentCreateSchema.extend({
  version: z.number().int().positive(),
})

function mapEnrollment(row: typeof studentEnrollments.$inferSelect) {
  return {
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    branchId: row.branchId,
    termId: row.termId,
    sectionCode: row.sectionCode,
    rosterOrder: row.rosterOrder,
    academicStatus: row.academicStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMentorAssignment(row: typeof mentorAssignments.$inferSelect) {
  return {
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    facultyId: row.facultyId,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapStudentRecord(params: {
  student: typeof students.$inferSelect
  enrollmentRows: Array<typeof studentEnrollments.$inferSelect>
  assignmentRows: Array<typeof mentorAssignments.$inferSelect>
  profileRows: Array<typeof studentAcademicProfiles.$inferSelect>
  termRows: Array<typeof academicTerms.$inferSelect>
  branchRows: Array<typeof branches.$inferSelect>
  departmentRows: Array<typeof departments.$inferSelect>
  batchRows: Array<typeof batches.$inferSelect>
}) {
  const termById = Object.fromEntries(params.termRows.map(row => [row.termId, row]))
  const branchById = Object.fromEntries(params.branchRows.map(row => [row.branchId, row]))
  const departmentById = Object.fromEntries(params.departmentRows.map(row => [row.departmentId, row]))
  const batchById = Object.fromEntries(params.batchRows.map(row => [row.batchId, row]))
  return {
    ...params.student,
    currentCgpa: (params.profileRows.find(item => item.studentId === params.student.studentId)?.prevCgpaScaled ?? 0) / 100,
    activeAcademicContext: (() => {
      const currentEnrollment = params.enrollmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.endDate === null && right.endDate !== null) return -1
          if (left.endDate !== null && right.endDate === null) return 1
          return right.startDate.localeCompare(left.startDate)
        })[0]
      if (!currentEnrollment) return null
      const term = termById[currentEnrollment.termId]
      const branch = branchById[currentEnrollment.branchId]
      const department = branch ? departmentById[branch.departmentId] : null
      const batch = term?.batchId ? batchById[term.batchId] : null
      return {
        enrollmentId: currentEnrollment.enrollmentId,
        branchId: currentEnrollment.branchId,
        branchName: branch?.name ?? null,
        departmentId: department?.departmentId ?? null,
        departmentName: department?.name ?? null,
        termId: currentEnrollment.termId,
        academicYearLabel: term?.academicYearLabel ?? null,
        semesterNumber: term?.semesterNumber ?? null,
        sectionCode: currentEnrollment.sectionCode,
        batchId: batch?.batchId ?? term?.batchId ?? null,
        batchLabel: batch?.batchLabel ?? null,
        admissionYear: batch?.admissionYear ?? null,
        academicStatus: currentEnrollment.academicStatus,
      }
    })(),
    activeMentorAssignment: (() => {
      const activeAssignment = params.assignmentRows
        .filter(item => item.studentId === params.student.studentId)
        .sort((left, right) => {
          if (left.effectiveTo === null && right.effectiveTo !== null) return -1
          if (left.effectiveTo !== null && right.effectiveTo === null) return 1
          return right.effectiveFrom.localeCompare(left.effectiveFrom)
        })[0]
      return activeAssignment ? mapMentorAssignment(activeAssignment) : null
    })(),
    enrollments: params.enrollmentRows.filter(item => item.studentId === params.student.studentId).map(mapEnrollment),
    mentorAssignments: params.assignmentRows.filter(item => item.studentId === params.student.studentId).map(mapMentorAssignment),
  }
}

export async function registerStudentRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/students', {
    schema: { tags: ['students'], summary: 'List students with enrollment and mentor assignment context' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const studentRows = await context.db.select().from(students)
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    return {
      items: studentRows.map(student => mapStudentRecord({
        student,
        enrollmentRows,
        assignmentRows,
        profileRows,
        termRows,
        branchRows,
        departmentRows,
        batchRows,
      })),
    }
  })

  app.post('/api/admin/students', {
    schema: { tags: ['students'], summary: 'Create student' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(studentCreateSchema, request.body)
    const institutionId = (await context.db.select().from(students).limit(1))[0]?.institutionId
      ?? (await context.db.select().from(institutions).limit(1))[0]?.institutionId
    if (!institutionId) throw notFound('Institution is not configured')
    const created = {
      studentId: createId('student'),
      institutionId,
      usn: body.usn,
      rollNumber: body.rollNumber ?? null,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      admissionDate: body.admissionDate,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(students).values(created)
    await emitAuditEvent(context, {
      entityType: 'Student',
      entityId: created.studentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: created,
    })
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    return mapStudentRecord({
      student: created,
      enrollmentRows,
      assignmentRows,
      profileRows,
      termRows,
      branchRows,
      departmentRows,
      batchRows,
    })
  })

  app.patch('/api/admin/students/:studentId', {
    schema: { tags: ['students'], summary: 'Update student' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentPatchSchema, request.body)
    const [current] = await context.db.select().from(students).where(eq(students.studentId, params.studentId))
    if (!current) throw notFound('Student not found')
    expectVersion(current.version, body.version, 'Student', current)
    await context.db.update(students).set({
      usn: body.usn,
      rollNumber: body.rollNumber ?? null,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      admissionDate: body.admissionDate,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(students.studentId, params.studentId))
    const [next] = await context.db.select().from(students).where(eq(students.studentId, params.studentId))
    await emitAuditEvent(context, {
      entityType: 'Student',
      entityId: params.studentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    const enrollmentRows = await context.db.select().from(studentEnrollments)
    const assignmentRows = await context.db.select().from(mentorAssignments)
    const profileRows = await context.db.select().from(studentAcademicProfiles)
    const termRows = await context.db.select().from(academicTerms)
    const branchRows = await context.db.select().from(branches)
    const departmentRows = await context.db.select().from(departments)
    const batchRows = await context.db.select().from(batches)
    return mapStudentRecord({
      student: next,
      enrollmentRows,
      assignmentRows,
      profileRows,
      termRows,
      branchRows,
      departmentRows,
      batchRows,
    })
  })

  app.post('/api/admin/students/:studentId/enrollments', {
    schema: { tags: ['students'], summary: 'Create student enrollment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(enrollmentCreateSchema, { ...rawBody, studentId: params.studentId })
    const created = {
      enrollmentId: createId('enrollment'),
      studentId: body.studentId,
      branchId: body.branchId,
      termId: body.termId,
      sectionCode: body.sectionCode,
      rosterOrder: body.rosterOrder ?? 0,
      academicStatus: body.academicStatus,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(studentEnrollments).values(created)
    await emitAuditEvent(context, {
      entityType: 'StudentEnrollment',
      entityId: created.enrollmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapEnrollment(created),
    })
    return mapEnrollment(created)
  })

  app.patch('/api/admin/enrollments/:enrollmentId', {
    schema: { tags: ['students'], summary: 'Update student enrollment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ enrollmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(enrollmentPatchSchema, request.body)
    const [current] = await context.db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    if (!current) throw notFound('Enrollment not found')
    expectVersion(current.version, body.version, 'StudentEnrollment', mapEnrollment(current))
    await context.db.update(studentEnrollments).set({
      studentId: body.studentId,
      branchId: body.branchId,
      termId: body.termId,
      sectionCode: body.sectionCode,
      rosterOrder: body.rosterOrder ?? current.rosterOrder,
      academicStatus: body.academicStatus,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    const [next] = await context.db.select().from(studentEnrollments).where(eq(studentEnrollments.enrollmentId, params.enrollmentId))
    await emitAuditEvent(context, {
      entityType: 'StudentEnrollment',
      entityId: params.enrollmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapEnrollment(current),
      after: mapEnrollment(next),
    })
    return mapEnrollment(next)
  })

  app.post('/api/admin/mentor-assignments', {
    schema: { tags: ['students'], summary: 'Create mentor assignment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(mentorAssignmentCreateSchema, request.body)
    const created = {
      assignmentId: createId('mentor_assignment'),
      studentId: body.studentId,
      facultyId: body.facultyId,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      source: body.source,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(mentorAssignments).values(created)
    await emitAuditEvent(context, {
      entityType: 'MentorAssignment',
      entityId: created.assignmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapMentorAssignment(created),
    })
    return mapMentorAssignment(created)
  })

  app.patch('/api/admin/mentor-assignments/:assignmentId', {
    schema: { tags: ['students'], summary: 'Update mentor assignment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ assignmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(mentorAssignmentPatchSchema, request.body)
    const [current] = await context.db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    if (!current) throw notFound('Mentor assignment not found')
    expectVersion(current.version, body.version, 'MentorAssignment', mapMentorAssignment(current))
    await context.db.update(mentorAssignments).set({
      studentId: body.studentId,
      facultyId: body.facultyId,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      source: body.source,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    const [next] = await context.db.select().from(mentorAssignments).where(eq(mentorAssignments.assignmentId, params.assignmentId))
    await emitAuditEvent(context, {
      entityType: 'MentorAssignment',
      entityId: params.assignmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapMentorAssignment(current),
      after: mapMentorAssignment(next),
    })
    return mapMentorAssignment(next)
  })
}
