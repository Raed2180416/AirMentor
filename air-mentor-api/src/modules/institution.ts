import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { academicFaculties, academicTerms, batches, branches, departments, institutions } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const institutionPatchSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  academicYearStartMonth: z.number().int().min(1).max(12),
  status: z.string().min(1),
  version: z.number().int().positive(),
})

const departmentCreateSchema = z.object({
  academicFacultyId: z.string().min(1).optional().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const departmentPatchSchema = departmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const branchCreateSchema = z.object({
  departmentId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  programLevel: z.string().min(1),
  semesterCount: z.number().int().positive(),
  status: z.string().min(1).default('active'),
})

const branchPatchSchema = branchCreateSchema.extend({
  version: z.number().int().positive(),
})

const termCreateSchema = z.object({
  branchId: z.string().min(1),
  batchId: z.string().min(1).optional().nullable(),
  academicYearLabel: z.string().min(1),
  semesterNumber: z.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.string().min(1).default('active'),
})

const termPatchSchema = termCreateSchema.extend({
  version: z.number().int().positive(),
})

function mapInstitution(row: typeof institutions.$inferSelect) {
  return {
    institutionId: row.institutionId,
    name: row.name,
    timezone: row.timezone,
    academicYearStartMonth: row.academicYearStartMonth,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function registerInstitutionRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/institution', {
    schema: { tags: ['institution'], summary: 'Get institution setup' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(institutions)
    const institution = rows[0]
    if (!institution) throw notFound('Institution is not configured')
    return mapInstitution(institution)
  })

  app.patch('/api/admin/institution', {
    schema: { tags: ['institution'], summary: 'Update institution setup' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(institutionPatchSchema, request.body)
    const rows = await context.db.select().from(institutions)
    const current = rows[0]
    if (!current) throw notFound('Institution is not configured')
    expectVersion(current.version, body.version, 'Institution', mapInstitution(current))
    await context.db.update(institutions).set({
      name: body.name,
      timezone: body.timezone,
      academicYearStartMonth: body.academicYearStartMonth,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(institutions.institutionId, current.institutionId))
    const [next] = await context.db.select().from(institutions).where(eq(institutions.institutionId, current.institutionId))
    await emitAuditEvent(context, {
      entityType: 'Institution',
      entityId: current.institutionId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapInstitution(current),
      after: mapInstitution(next),
    })
    return mapInstitution(next)
  })

  app.get('/api/admin/departments', {
    schema: { tags: ['institution'], summary: 'List departments' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(departments)
    return { items: rows }
  })

  app.post('/api/admin/departments', {
    schema: { tags: ['institution'], summary: 'Create department' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(departmentCreateSchema, request.body)
    const institution = (await context.db.select().from(institutions))[0]
    if (!institution) throw notFound('Institution is not configured')
    if (body.academicFacultyId) {
      const [faculty] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, body.academicFacultyId))
      if (!faculty) throw notFound('Academic faculty not found')
    }
    const next = {
      departmentId: createId('department'),
      institutionId: institution.institutionId,
      academicFacultyId: body.academicFacultyId ?? null,
      code: body.code,
      name: body.name,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(departments).values(next)
    await emitAuditEvent(context, {
      entityType: 'Department',
      entityId: next.departmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: next,
    })
    return next
  })

  app.patch('/api/admin/departments/:departmentId', {
    schema: { tags: ['institution'], summary: 'Update department' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ departmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(departmentPatchSchema, request.body)
    const [current] = await context.db.select().from(departments).where(eq(departments.departmentId, params.departmentId))
    if (!current) throw notFound('Department not found')
    if (body.academicFacultyId) {
      const [faculty] = await context.db.select().from(academicFaculties).where(eq(academicFaculties.academicFacultyId, body.academicFacultyId))
      if (!faculty) throw notFound('Academic faculty not found')
    }
    expectVersion(current.version, body.version, 'Department', current)
    await context.db.update(departments).set({
      academicFacultyId: body.academicFacultyId ?? null,
      code: body.code,
      name: body.name,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(departments.departmentId, params.departmentId))
    const [next] = await context.db.select().from(departments).where(eq(departments.departmentId, params.departmentId))
    await emitAuditEvent(context, {
      entityType: 'Department',
      entityId: params.departmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    return next
  })

  app.get('/api/admin/branches', {
    schema: { tags: ['institution'], summary: 'List branches' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(branches)
    return { items: rows }
  })

  app.post('/api/admin/branches', {
    schema: { tags: ['institution'], summary: 'Create branch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(branchCreateSchema, request.body)
    const next = {
      branchId: createId('branch'),
      departmentId: body.departmentId,
      code: body.code,
      name: body.name,
      programLevel: body.programLevel,
      semesterCount: body.semesterCount,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(branches).values(next)
    await emitAuditEvent(context, {
      entityType: 'Branch',
      entityId: next.branchId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: next,
    })
    return next
  })

  app.patch('/api/admin/branches/:branchId', {
    schema: { tags: ['institution'], summary: 'Update branch' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ branchId: z.string().min(1) }), request.params)
    const body = parseOrThrow(branchPatchSchema, request.body)
    const [current] = await context.db.select().from(branches).where(eq(branches.branchId, params.branchId))
    if (!current) throw notFound('Branch not found')
    expectVersion(current.version, body.version, 'Branch', current)
    await context.db.update(branches).set({
      departmentId: body.departmentId,
      code: body.code,
      name: body.name,
      programLevel: body.programLevel,
      semesterCount: body.semesterCount,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(branches.branchId, params.branchId))
    const [next] = await context.db.select().from(branches).where(eq(branches.branchId, params.branchId))
    await emitAuditEvent(context, {
      entityType: 'Branch',
      entityId: params.branchId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    return next
  })

  app.get('/api/admin/terms', {
    schema: { tags: ['institution'], summary: 'List academic terms' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const rows = await context.db.select().from(academicTerms)
    return { items: rows }
  })

  app.post('/api/admin/terms', {
    schema: { tags: ['institution'], summary: 'Create academic term' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(termCreateSchema, request.body)
    if (body.batchId) {
      const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
      if (!batch) throw notFound('Batch not found')
    }
    const next = {
      termId: createId('term'),
      branchId: body.branchId,
      batchId: body.batchId ?? null,
      academicYearLabel: body.academicYearLabel,
      semesterNumber: body.semesterNumber,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(academicTerms).values(next)
    await emitAuditEvent(context, {
      entityType: 'AcademicTerm',
      entityId: next.termId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: next,
    })
    return next
  })

  app.patch('/api/admin/terms/:termId', {
    schema: { tags: ['institution'], summary: 'Update academic term' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ termId: z.string().min(1) }), request.params)
    const body = parseOrThrow(termPatchSchema, request.body)
    const [current] = await context.db.select().from(academicTerms).where(eq(academicTerms.termId, params.termId))
    if (!current) throw notFound('Academic term not found')
    if (body.batchId) {
      const [batch] = await context.db.select().from(batches).where(eq(batches.batchId, body.batchId))
      if (!batch) throw notFound('Batch not found')
    }
    expectVersion(current.version, body.version, 'AcademicTerm', current)
    await context.db.update(academicTerms).set({
      branchId: body.branchId,
      batchId: body.batchId ?? null,
      academicYearLabel: body.academicYearLabel,
      semesterNumber: body.semesterNumber,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicTerms.termId, params.termId))
    const [next] = await context.db.select().from(academicTerms).where(eq(academicTerms.termId, params.termId))
    await emitAuditEvent(context, {
      entityType: 'AcademicTerm',
      entityId: params.termId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: current,
      after: next,
    })
    return next
  })
}
