import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { courses, institutions } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const courseCreateSchema = z.object({
  courseCode: z.string().min(1),
  title: z.string().min(1),
  defaultCredits: z.number().int().positive(),
  departmentId: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const coursePatchSchema = courseCreateSchema.extend({
  version: z.number().int().positive(),
})

export async function registerCourseRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/courses', {
    schema: { tags: ['courses'], summary: 'List courses' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(courses)
    return { items: rows }
  })

  app.post('/api/admin/courses', {
    schema: { tags: ['courses'], summary: 'Create course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(courseCreateSchema, request.body)
    const institution = (await context.db.select().from(institutions))[0]
    if (!institution) throw notFound('Institution is not configured')
    const created = {
      courseId: createId('course'),
      institutionId: institution.institutionId,
      courseCode: body.courseCode,
      title: body.title,
      defaultCredits: body.defaultCredits,
      departmentId: body.departmentId,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(courses).values(created)
    await emitAuditEvent(context, {
      entityType: 'Course',
      entityId: created.courseId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: created,
    })
    return created
  })

  app.patch('/api/admin/courses/:courseId', {
    schema: { tags: ['courses'], summary: 'Update course' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ courseId: z.string().min(1) }), request.params)
    const body = parseOrThrow(coursePatchSchema, request.body)
    const [current] = await context.db.select().from(courses).where(eq(courses.courseId, params.courseId))
    if (!current) throw notFound('Course not found')
    expectVersion(current.version, body.version, 'Course', current)
    await context.db.update(courses).set({
      courseCode: body.courseCode,
      title: body.title,
      defaultCredits: body.defaultCredits,
      departmentId: body.departmentId,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(courses.courseId, params.courseId))
    const [next] = await context.db.select().from(courses).where(eq(courses.courseId, params.courseId))
    await emitAuditEvent(context, {
      entityType: 'Course',
      entityId: params.courseId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    return next
  })
}
