/**
 * Students routes — thin controller.
 *
 * Each handler authenticates + parses the request, then delegates to a use-case
 * (built over the StudentsRepository from context.db) and maps the use-case's
 * { status, body } onto the reply. Domain logic (record projection, scope
 * filtering, mentor bulk-apply) lives under src/application/use-cases/students;
 * all DB access lives under src/adapters/persistence/repositories/students. The
 * persistence-bound batch-policy resolver and audit emission are injected as
 * context-bound closures.
 *
 * Endpoints:
 *   GET   /api/admin/students
 *   POST  /api/admin/students
 *   PATCH /api/admin/students/:studentId
 *   POST  /api/admin/students/:studentId/enrollments
 *   PATCH /api/admin/enrollments/:enrollmentId
 *   POST  /api/admin/mentor-assignments/bulk-apply
 *   POST  /api/admin/mentor-assignments
 *   PATCH /api/admin/mentor-assignments/:assignmentId
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { resolveBatchPolicy } from './admin-structure.js'
import { emitAuditEvent, parseOrThrow, requireRole } from './support.js'
import type { AuditEmitter } from '../application/use-cases/curriculum-graph/shared.js'
import type { ResolveBatchPolicyForStudents } from '../application/use-cases/students/students-domain.js'
import { createStudentsRepository } from '../adapters/persistence/repositories/students/students-repository.js'
import { listStudents } from '../application/use-cases/students/list-students.js'
import { createStudent, updateStudent } from '../application/use-cases/students/write-students.js'
import { createEnrollment, updateEnrollment } from '../application/use-cases/students/write-enrollments.js'
import { createMentorAssignment, updateMentorAssignment } from '../application/use-cases/students/write-mentor-assignments.js'
import { bulkApplyMentorAssignments } from '../application/use-cases/students/bulk-apply-mentor-assignments.js'

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

const mentorAssignmentBulkApplySchema = z.object({
  facultyId: z.string().min(1),
  batchId: z.string().min(1),
  sectionCode: z.string().trim().min(1).optional().nullable(),
  effectiveFrom: z.string().min(1),
  source: z.string().min(1),
  selectionMode: z.enum(['missing-only', 'replace-all']).optional(),
  applyMode: z.enum(['missing-only', 'replace-all']).optional(),
  previewOnly: z.boolean().default(false),
  expectedStudentIds: z.array(z.string().min(1)).optional(),
}).transform(value => ({
  ...value,
  selectionMode: value.selectionMode ?? value.applyMode ?? 'replace-all',
})).superRefine((value, ctx) => {
  if (!value.previewOnly && (!value.expectedStudentIds || value.expectedStudentIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expectedStudentIds'],
      message: 'Confirmation requires the previewed student ids.',
    })
  }
})

const studentDirectoryScopeQuerySchema = z.object({
  academicFacultyId: z.string().trim().min(1).optional(),
  departmentId: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  sectionCode: z.string().trim().min(1).optional(),
})

export async function registerStudentRoutes(app: FastifyInstance, context: RouteContext) {
  const repo = createStudentsRepository(context.db, context.now)
  const emitAudit: AuditEmitter = params => emitAuditEvent(context, params)
  const resolveBatchPolicyBound: ResolveBatchPolicyForStudents = (batchId, options) =>
    resolveBatchPolicy(context, batchId, options)

  app.get('/api/admin/students', {
    schema: { tags: ['students'], summary: 'List students with enrollment and mentor assignment context' },
  }, async (request, reply) => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const filter = parseOrThrow(studentDirectoryScopeQuerySchema, request.query ?? {})
    const result = await listStudents({ repo, resolveBatchPolicy: resolveBatchPolicyBound }, { filter })
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/students', {
    schema: { tags: ['students'], summary: 'Create student' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(studentCreateSchema, request.body)
    const result = await createStudent(
      { repo, emitAudit, resolveBatchPolicy: resolveBatchPolicyBound },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        usn: body.usn,
        rollNumber: body.rollNumber,
        name: body.name,
        email: body.email,
        phone: body.phone,
        admissionDate: body.admissionDate,
        status: body.status,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/students/:studentId', {
    schema: { tags: ['students'], summary: 'Update student' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(studentPatchSchema, request.body)
    const result = await updateStudent(
      { repo, emitAudit, resolveBatchPolicy: resolveBatchPolicyBound },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        studentId: params.studentId,
        usn: body.usn,
        rollNumber: body.rollNumber,
        name: body.name,
        email: body.email,
        phone: body.phone,
        admissionDate: body.admissionDate,
        status: body.status,
        version: body.version,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/students/:studentId/enrollments', {
    schema: { tags: ['students'], summary: 'Create student enrollment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ studentId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(enrollmentCreateSchema, { ...rawBody, studentId: params.studentId })
    const result = await createEnrollment(
      { repo, emitAudit },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        studentId: body.studentId,
        branchId: body.branchId,
        termId: body.termId,
        sectionCode: body.sectionCode,
        rosterOrder: body.rosterOrder,
        academicStatus: body.academicStatus,
        startDate: body.startDate,
        endDate: body.endDate,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/enrollments/:enrollmentId', {
    schema: { tags: ['students'], summary: 'Update student enrollment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ enrollmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(enrollmentPatchSchema, request.body)
    const result = await updateEnrollment(
      { repo, emitAudit },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        enrollmentId: params.enrollmentId,
        studentId: body.studentId,
        branchId: body.branchId,
        termId: body.termId,
        sectionCode: body.sectionCode,
        rosterOrder: body.rosterOrder,
        academicStatus: body.academicStatus,
        startDate: body.startDate,
        endDate: body.endDate,
        version: body.version,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/mentor-assignments/bulk-apply', {
    schema: { tags: ['students'], summary: 'Preview or apply mentor assignment changes across a scoped student cohort' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(mentorAssignmentBulkApplySchema, request.body)
    const result = await bulkApplyMentorAssignments(
      { repo, emitAudit, now: context.now },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        facultyId: body.facultyId,
        batchId: body.batchId,
        sectionCode: body.sectionCode,
        effectiveFrom: body.effectiveFrom,
        source: body.source,
        selectionMode: body.selectionMode,
        previewOnly: body.previewOnly,
        expectedStudentIds: body.expectedStudentIds,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.post('/api/admin/mentor-assignments', {
    schema: { tags: ['students'], summary: 'Create mentor assignment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(mentorAssignmentCreateSchema, request.body)
    const result = await createMentorAssignment(
      { repo, emitAudit },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        studentId: body.studentId,
        facultyId: body.facultyId,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        source: body.source,
      },
    )
    return reply.status(result.status).send(result.body)
  })

  app.patch('/api/admin/mentor-assignments/:assignmentId', {
    schema: { tags: ['students'], summary: 'Update mentor assignment' },
  }, async (request, reply) => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ assignmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(mentorAssignmentPatchSchema, request.body)
    const result = await updateMentorAssignment(
      { repo, emitAudit },
      {
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
        assignmentId: params.assignmentId,
        studentId: body.studentId,
        facultyId: body.facultyId,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo,
        source: body.source,
        version: body.version,
      },
    )
    return reply.status(result.status).send(result.body)
  })
}
