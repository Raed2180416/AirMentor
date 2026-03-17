import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { facultyAppointments, facultyProfiles, institutions, roleGrants, uiPreferences, userAccounts, userPasswordCredentials } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { notFound } from '../lib/http-errors.js'
import { hashPassword } from '../lib/passwords.js'
import { emitAuditEvent, expectVersion, parseOrThrow, requireRole } from './support.js'

const facultyCreateSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const facultyPatchSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1),
  version: z.number().int().positive(),
})

const appointmentCreateSchema = z.object({
  facultyId: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const appointmentPatchSchema = appointmentCreateSchema.extend({
  version: z.number().int().positive(),
})

const roleGrantCreateSchema = z.object({
  facultyId: z.string().min(1),
  roleCode: z.enum(['SYSTEM_ADMIN', 'HOD', 'COURSE_LEADER', 'MENTOR']),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

const roleGrantPatchSchema = roleGrantCreateSchema.extend({
  version: z.number().int().positive(),
})

function mapAppointment(row: typeof facultyAppointments.$inferSelect) {
  return {
    appointmentId: row.appointmentId,
    facultyId: row.facultyId,
    departmentId: row.departmentId,
    branchId: row.branchId,
    isPrimary: row.isPrimary === 1,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapRoleGrant(row: typeof roleGrants.$inferSelect) {
  return {
    grantId: row.grantId,
    facultyId: row.facultyId,
    roleCode: row.roleCode,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapFacultyRecord(params: {
  profile: typeof facultyProfiles.$inferSelect
  user: typeof userAccounts.$inferSelect | undefined
  appointments: Array<typeof facultyAppointments.$inferSelect>
  grants: Array<typeof roleGrants.$inferSelect>
}) {
  return {
    facultyId: params.profile.facultyId,
    userId: params.profile.userId,
    username: params.user?.username ?? '',
    email: params.user?.email ?? '',
    phone: params.user?.phone ?? null,
    employeeCode: params.profile.employeeCode,
    displayName: params.profile.displayName,
    designation: params.profile.designation,
    joinedOn: params.profile.joinedOn,
    status: params.profile.status,
    version: params.profile.version,
    appointments: params.appointments.map(mapAppointment),
    roleGrants: params.grants.map(mapRoleGrant),
  }
}

export async function registerPeopleRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'List faculty master records' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const profiles = await context.db.select().from(facultyProfiles)
    const users = await context.db.select().from(userAccounts)
    const appointments = await context.db.select().from(facultyAppointments)
    const grants = await context.db.select().from(roleGrants)
    return {
      items: profiles.map(profile => mapFacultyRecord({
        profile,
        user: users.find(item => item.userId === profile.userId),
        appointments: appointments.filter(item => item.facultyId === profile.facultyId),
        grants: grants.filter(item => item.facultyId === profile.facultyId),
      })),
    }
  })

  app.post('/api/admin/faculty', {
    schema: { tags: ['people'], summary: 'Create faculty profile and user' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const body = parseOrThrow(facultyCreateSchema, request.body)
    const institution = (await context.db.select().from(institutions).limit(1))[0]?.institutionId
    if (!institution) throw notFound('Institution-backed user setup is missing')
    const now = context.now()
    const userId = createId('user')
    const facultyId = createId('faculty')
    await context.db.insert(userAccounts).values({
      userId,
      institutionId: institution,
      username: body.username,
      email: body.email,
      phone: body.phone ?? null,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    await context.db.insert(userPasswordCredentials).values({
      userId,
      passwordHash: await hashPassword(body.password),
      updatedAt: now,
    })
    await context.db.insert(uiPreferences).values({
      userId,
      themeMode: context.config.defaultThemeMode,
      version: 1,
      updatedAt: now,
    })
    const created = {
      facultyId,
      userId,
      employeeCode: body.employeeCode,
      displayName: body.displayName,
      designation: body.designation,
      joinedOn: body.joinedOn ?? null,
      status: body.status,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    await context.db.insert(facultyProfiles).values(created)
    await emitAuditEvent(context, {
      entityType: 'FacultyProfile',
      entityId: facultyId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: {
        ...created,
        username: body.username,
        email: body.email,
        phone: body.phone ?? null,
      },
    })
    const [createdProfile] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId))
    const [createdUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, userId))
    return mapFacultyRecord({
      profile: createdProfile,
      user: createdUser,
      appointments: [],
      grants: [],
    })
  })

  app.patch('/api/admin/faculty/:facultyId', {
    schema: { tags: ['people'], summary: 'Update faculty profile and user account' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId))
    if (!current) throw notFound('Faculty not found')
    expectVersion(current.version, body.version, 'FacultyProfile', current)
    const [currentUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, current.userId))
    await context.db.update(userAccounts).set({
      username: body.username,
      email: body.email,
      phone: body.phone ?? null,
      status: body.status,
      version: currentUser.version + 1,
      updatedAt: context.now(),
    }).where(eq(userAccounts.userId, current.userId))
    await context.db.update(facultyProfiles).set({
      employeeCode: body.employeeCode,
      displayName: body.displayName,
      designation: body.designation,
      joinedOn: body.joinedOn ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(facultyProfiles.facultyId, params.facultyId))
    const [next] = await context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId))
    const [nextUser] = await context.db.select().from(userAccounts).where(eq(userAccounts.userId, current.userId))
    const appointments = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, params.facultyId))
    const grants = await context.db.select().from(roleGrants).where(eq(roleGrants.facultyId, params.facultyId))
    const payload = mapFacultyRecord({
      profile: next,
      user: nextUser,
      appointments,
      grants,
    })
    await emitAuditEvent(context, {
      entityType: 'FacultyProfile',
      entityId: params.facultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: {
        ...current,
        username: currentUser.username,
        email: currentUser.email,
        phone: currentUser.phone,
      },
      after: payload,
    })
    return payload
  })

  app.post('/api/admin/faculty/:facultyId/appointments', {
    schema: { tags: ['people'], summary: 'Create faculty appointment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(appointmentCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const created = {
      appointmentId: createId('appointment'),
      facultyId: body.facultyId,
      departmentId: body.departmentId,
      branchId: body.branchId ?? null,
      isPrimary: body.isPrimary ? 1 : 0,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(facultyAppointments).values(created)
    await emitAuditEvent(context, {
      entityType: 'FacultyAppointment',
      entityId: created.appointmentId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAppointment(created),
    })
    return mapAppointment(created)
  })

  app.patch('/api/admin/appointments/:appointmentId', {
    schema: { tags: ['people'], summary: 'Update faculty appointment' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ appointmentId: z.string().min(1) }), request.params)
    const body = parseOrThrow(appointmentPatchSchema, request.body)
    const [current] = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    if (!current) throw notFound('Faculty appointment not found')
    expectVersion(current.version, body.version, 'FacultyAppointment', mapAppointment(current))
    await context.db.update(facultyAppointments).set({
      facultyId: body.facultyId,
      departmentId: body.departmentId,
      branchId: body.branchId ?? null,
      isPrimary: body.isPrimary ? 1 : 0,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    const [next] = await context.db.select().from(facultyAppointments).where(eq(facultyAppointments.appointmentId, params.appointmentId))
    await emitAuditEvent(context, {
      entityType: 'FacultyAppointment',
      entityId: params.appointmentId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapAppointment(current),
      after: mapAppointment(next),
    })
    return mapAppointment(next)
  })

  app.post('/api/admin/faculty/:facultyId/role-grants', {
    schema: { tags: ['people'], summary: 'Create role grant' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const rawBody = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {}
    const body = parseOrThrow(roleGrantCreateSchema, { ...rawBody, facultyId: params.facultyId })
    const created = {
      grantId: createId('grant'),
      facultyId: body.facultyId,
      roleCode: body.roleCode,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(roleGrants).values(created)
    await emitAuditEvent(context, {
      entityType: 'RoleGrant',
      entityId: created.grantId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapRoleGrant(created),
    })
    return mapRoleGrant(created)
  })

  app.patch('/api/admin/role-grants/:grantId', {
    schema: { tags: ['people'], summary: 'Update role grant' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ grantId: z.string().min(1) }), request.params)
    const body = parseOrThrow(roleGrantPatchSchema, request.body)
    const [current] = await context.db.select().from(roleGrants).where(eq(roleGrants.grantId, params.grantId))
    if (!current) throw notFound('Role grant not found')
    expectVersion(current.version, body.version, 'RoleGrant', mapRoleGrant(current))
    await context.db.update(roleGrants).set({
      facultyId: body.facultyId,
      roleCode: body.roleCode,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(roleGrants.grantId, params.grantId))
    const [next] = await context.db.select().from(roleGrants).where(eq(roleGrants.grantId, params.grantId))
    await emitAuditEvent(context, {
      entityType: 'RoleGrant',
      entityId: params.grantId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapRoleGrant(current),
      after: mapRoleGrant(next),
    })
    return mapRoleGrant(next)
  })
}
