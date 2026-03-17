import { asc, desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicFaculties,
  academicRuntimeState,
  adminReminders,
  adminRequests,
  academicTerms,
  auditEvents,
  batches,
  branches,
  courses,
  departments,
  facultyAppointments,
  facultyOfferingOwnerships,
  facultyProfiles,
  mentorAssignments,
  roleGrants,
  sectionOfferings,
  students,
  userAccounts,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { forbidden, notFound } from '../lib/http-errors.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import {
  createAdminRequestTransition,
  emitAuditEvent,
  getAuditEventsForEntity,
  mapAuditEvent,
  mapRoleGrant,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'

const reminderCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  dueAt: z.string().min(1),
  status: z.enum(['pending', 'done']).default('pending'),
})

const reminderPatchSchema = reminderCreateSchema.extend({
  version: z.number().int().positive(),
})

const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  academicFacultyId: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  sectionCode: z.string().optional(),
})

const auditQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
})

const recentAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(80),
})

const facultyCalendarParamsSchema = z.object({
  facultyId: z.string().min(1),
})

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const timetableSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

const timetableClassBlockSchema = z.object({
  id: z.string().min(1),
  facultyId: z.string().min(1),
  offeringId: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  section: z.string().min(1),
  year: z.string().min(1),
  day: weekdaySchema,
  dateISO: z.string().optional(),
  kind: z.enum(['regular', 'extra']).optional(),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  slotId: z.string().optional(),
  slotSpan: z.number().int().positive().optional(),
}).passthrough()

const facultyCalendarTemplateSchema = z.object({
  facultyId: z.string().min(1),
  slots: z.array(timetableSlotSchema),
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  classBlocks: z.array(timetableClassBlockSchema),
  updatedAt: z.number().int().nonnegative(),
}).passthrough()

const calendarMarkerSchema = z.object({
  markerId: z.string().min(1),
  facultyId: z.string().min(1),
  markerType: z.enum(['semester-start', 'semester-end', 'term-test-start', 'term-test-end', 'holiday', 'event']),
  title: z.string().min(1),
  note: z.string().nullable().optional(),
  dateISO: z.string().min(1),
  endDateISO: z.string().nullable().optional(),
  allDay: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  endMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  color: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const facultyCalendarWorkspaceSchema = z.object({
  publishedAt: z.string().nullable(),
  markers: z.array(calendarMarkerSchema),
})

const facultyCalendarSaveSchema = z.object({
  template: facultyCalendarTemplateSchema.nullable(),
  workspace: facultyCalendarWorkspaceSchema,
})

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function isVisibleStatus(status?: string | null) {
  const normalized = (status ?? 'active').toLowerCase()
  return normalized !== 'archived' && normalized !== 'deleted'
}

function deriveCurrentYearLabel(currentSemester: number) {
  const year = Math.max(1, Math.ceil(currentSemester / 2))
  if (year === 1) return '1st Year'
  if (year === 2) return '2nd Year'
  if (year === 3) return '3rd Year'
  return `${year}th Year`
}

function addDays(isoString: string, days: number) {
  const date = new Date(isoString)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

async function getRuntimeSlice<T>(context: RouteContext, stateKey: string, fallback: T) {
  const [row] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  return row ? parseJson(row.payloadJson, fallback) : fallback
}

async function saveRuntimeSlice(context: RouteContext, stateKey: string, payload: unknown) {
  const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await context.db.update(academicRuntimeState).set({
      payloadJson: stringifyJson(payload),
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return
  }
  await context.db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: stringifyJson(payload),
    version: 1,
    updatedAt: context.now(),
  })
}

function mapReminder(row: typeof adminReminders.$inferSelect) {
  return {
    reminderId: row.reminderId,
    facultyId: row.facultyId,
    title: row.title,
    body: row.body,
    dueAt: row.dueAt,
    status: row.status as 'pending' | 'done',
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function registerAdminControlPlaneRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/search', {
    schema: { tags: ['admin-control-plane'], summary: 'Search the admin workspace with optional scope narrowing' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(searchQuerySchema, request.query)
    const needle = normalizeSearch(query.q)
    if (!needle) return { items: [] }

    const [
      academicFacultyRows,
      departmentRows,
      branchRows,
      batchRows,
      studentRows,
      facultyRows,
      userRows,
      courseRows,
      requestRows,
    ] = await Promise.all([
      context.db.select().from(academicFaculties),
      context.db.select().from(departments),
      context.db.select().from(branches),
      context.db.select().from(batches),
      context.db.select().from(students),
      context.db.select().from(facultyProfiles),
      context.db.select().from(userAccounts),
      context.db.select().from(courses),
      context.db.select().from(adminRequests),
    ])

    const userById = Object.fromEntries(userRows.map(row => [row.userId, row]))
    const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
    const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))

    const scopedDepartments = departmentRows.filter(row => {
      if (!isVisibleStatus(row.status)) return false
      if (query.academicFacultyId && row.academicFacultyId !== query.academicFacultyId) return false
      if (query.departmentId && row.departmentId !== query.departmentId) return false
      return true
    })
    const scopedDepartmentIds = new Set(scopedDepartments.map(row => row.departmentId))

    const scopedBranches = branchRows.filter(row => {
      if (!isVisibleStatus(row.status)) return false
      if (query.departmentId && row.departmentId !== query.departmentId) return false
      if (query.branchId && row.branchId !== query.branchId) return false
      if (query.academicFacultyId && !scopedDepartmentIds.has(row.departmentId)) return false
      return true
    })
    const scopedBranchIds = new Set(scopedBranches.map(row => row.branchId))

    const scopedBatches = batchRows.filter(row => {
      if (!isVisibleStatus(row.status)) return false
      if (query.branchId && row.branchId !== query.branchId) return false
      if (query.batchId && row.batchId !== query.batchId) return false
      if ((query.departmentId || query.academicFacultyId) && !scopedBranchIds.has(row.branchId)) return false
      return true
    })
    const scopedBatchIds = new Set(scopedBatches.map(row => row.batchId))

    const results: Array<{
      key: string
      entityType: string
      entityId: string
      label: string
      meta: string
      route: Record<string, string>
    }> = []

    for (const row of academicFacultyRows) {
      if (!isVisibleStatus(row.status)) continue
      if (query.academicFacultyId && row.academicFacultyId !== query.academicFacultyId) continue
      if (![row.name, row.code, row.overview ?? ''].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `academic-faculty:${row.academicFacultyId}`,
        entityType: 'academic-faculty',
        entityId: row.academicFacultyId,
        label: row.name,
        meta: `Academic faculty · ${row.code}`,
        route: { section: 'faculties', academicFacultyId: row.academicFacultyId },
      })
    }

    for (const row of scopedDepartments) {
      if (![row.name, row.code].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `department:${row.departmentId}`,
        entityType: 'department',
        entityId: row.departmentId,
        label: row.name,
        meta: `Department · ${row.code}`,
        route: {
          section: 'faculties',
          academicFacultyId: row.academicFacultyId ?? '',
          departmentId: row.departmentId,
        },
      })
    }

    for (const row of scopedBranches) {
      if (![row.name, row.code, row.programLevel].some(value => value.toLowerCase().includes(needle))) continue
      const department = departmentById[row.departmentId]
      results.push({
        key: `branch:${row.branchId}`,
        entityType: 'branch',
        entityId: row.branchId,
        label: row.name,
        meta: `Branch · ${department?.code ?? 'NA'} · ${row.programLevel}`,
        route: {
          section: 'faculties',
          academicFacultyId: department?.academicFacultyId ?? '',
          departmentId: row.departmentId,
          branchId: row.branchId,
        },
      })
    }

    for (const row of scopedBatches) {
      const branch = branchById[row.branchId]
      if (![row.batchLabel, String(row.admissionYear), branch?.name ?? ''].some(value => value.toLowerCase().includes(needle))) continue
      const department = branch ? departmentById[branch.departmentId] : null
      results.push({
        key: `batch:${row.batchId}`,
        entityType: 'batch',
        entityId: row.batchId,
        label: `Batch ${row.batchLabel}`,
        meta: `${branch?.code ?? 'NA'} · ${deriveCurrentYearLabel(row.currentSemester)}`,
        route: {
          section: 'faculties',
          academicFacultyId: department?.academicFacultyId ?? '',
          departmentId: department?.departmentId ?? '',
          branchId: branch?.branchId ?? '',
          batchId: row.batchId,
        },
      })
    }

    for (const row of studentRows) {
      if (!isVisibleStatus(row.status)) continue
      if (![row.name, row.usn, row.email ?? ''].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `student:${row.studentId}`,
        entityType: 'student',
        entityId: row.studentId,
        label: row.name,
        meta: `Student · ${row.usn}`,
        route: {
          section: 'students',
          studentId: row.studentId,
        },
      })
    }

    for (const row of facultyRows) {
      if (!isVisibleStatus(row.status)) continue
      const user = userById[row.userId]
      if (![row.displayName, row.employeeCode, user?.email ?? '', user?.username ?? ''].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `faculty-member:${row.facultyId}`,
        entityType: 'faculty-member',
        entityId: row.facultyId,
        label: row.displayName,
        meta: `${row.employeeCode} · ${row.designation}`,
        route: {
          section: 'faculty-members',
          facultyMemberId: row.facultyId,
        },
      })
    }

    for (const row of courseRows) {
      if (!isVisibleStatus(row.status)) continue
      const department = departmentById[row.departmentId]
      if (query.departmentId && row.departmentId !== query.departmentId) continue
      if (query.academicFacultyId && department?.academicFacultyId !== query.academicFacultyId) continue
      if (![row.courseCode, row.title].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `course:${row.courseId}`,
        entityType: 'course',
        entityId: row.courseId,
        label: `${row.courseCode} · ${row.title}`,
        meta: `Course catalog · ${department?.code ?? 'NA'}`,
        route: {
          section: 'faculties',
          academicFacultyId: department?.academicFacultyId ?? '',
          departmentId: department?.departmentId ?? '',
        },
      })
    }

    for (const row of requestRows) {
      if (![row.summary, row.details, row.requestType, row.scopeType, row.scopeId].some(value => value.toLowerCase().includes(needle))) continue
      results.push({
        key: `request:${row.adminRequestId}`,
        entityType: 'request',
        entityId: row.adminRequestId,
        label: row.summary,
        meta: `Request · ${row.status} · ${row.requestType}`,
        route: {
          section: 'requests',
          requestId: row.adminRequestId,
        },
      })
    }

    return { items: results.slice(0, 20) }
  })

  app.get('/api/admin/audit-events', {
    schema: { tags: ['admin-control-plane'], summary: 'Read audit history for any admin-managed entity' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(auditQuerySchema, request.query)
    return {
      items: await getAuditEventsForEntity(context, query.entityType, query.entityId),
    }
  })

  app.get('/api/admin/audit-events/recent', {
    schema: { tags: ['admin-control-plane'], summary: 'Read the most recent admin audit activity across the workspace' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const query = parseOrThrow(recentAuditQuerySchema, request.query)
    const rows = await context.db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(query.limit)
    return {
      items: rows.map(mapAuditEvent),
    }
  })

  app.get('/api/admin/reminders', {
    schema: { tags: ['admin-control-plane'], summary: 'List private reminders for the current system admin' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    if (!auth.facultyId) return { items: [] }
    const items = await context.db
      .select()
      .from(adminReminders)
      .where(eq(adminReminders.facultyId, auth.facultyId))
      .orderBy(asc(adminReminders.dueAt))
    return { items: items.map(mapReminder) }
  })

  app.post('/api/admin/reminders', {
    schema: { tags: ['admin-control-plane'], summary: 'Create a private reminder for the current system admin' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    if (!auth.facultyId) throw forbidden('Faculty context is required to create reminders')
    const body = parseOrThrow(reminderCreateSchema, request.body)
    const created = {
      reminderId: createId('admin_reminder'),
      facultyId: auth.facultyId,
      title: body.title,
      body: body.body,
      dueAt: body.dueAt,
      status: body.status,
      version: 1,
      createdAt: context.now(),
      updatedAt: context.now(),
    }
    await context.db.insert(adminReminders).values(created)
    await emitAuditEvent(context, {
      entityType: 'AdminReminder',
      entityId: created.reminderId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapReminder(created),
    })
    return mapReminder(created)
  })

  app.patch('/api/admin/reminders/:reminderId', {
    schema: { tags: ['admin-control-plane'], summary: 'Update a private reminder' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    if (!auth.facultyId) throw forbidden('Faculty context is required to update reminders')
    const params = parseOrThrow(z.object({ reminderId: z.string().min(1) }), request.params)
    const body = parseOrThrow(reminderPatchSchema, request.body)
    const [current] = await context.db.select().from(adminReminders).where(eq(adminReminders.reminderId, params.reminderId))
    if (!current || current.facultyId !== auth.facultyId) throw notFound('Reminder not found')
    if (current.version !== body.version) throw forbidden('Reminder version is stale')
    await context.db.update(adminReminders).set({
      title: body.title,
      body: body.body,
      dueAt: body.dueAt,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(adminReminders.reminderId, params.reminderId))
    const [next] = await context.db.select().from(adminReminders).where(eq(adminReminders.reminderId, params.reminderId))
    await emitAuditEvent(context, {
      entityType: 'AdminReminder',
      entityId: params.reminderId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: mapReminder(current),
      after: mapReminder(next),
    })
    return mapReminder(next)
  })

  app.get('/api/admin/faculty-calendar/:facultyId', {
    schema: { tags: ['admin-control-plane'], summary: 'Read the sysadmin timetable workspace for a faculty member' },
  }, async request => {
    requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(facultyCalendarParamsSchema, request.params)
    const [profile, timetablePayload, workspacePayload] = await Promise.all([
      context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId)).then(rows => rows[0] ?? null),
      getRuntimeSlice(context, 'timetableByFacultyId', {} as Record<string, unknown>),
      getRuntimeSlice(context, 'adminCalendarByFacultyId', {} as Record<string, unknown>),
    ])
    if (!profile) throw notFound('Faculty profile not found')
    const rawTemplate = timetablePayload?.[params.facultyId]
    const rawWorkspace = workspacePayload?.[params.facultyId]
    const parsedWorkspace = facultyCalendarWorkspaceSchema.safeParse(rawWorkspace)
    const workspace = parsedWorkspace.success ? parsedWorkspace.data : { publishedAt: null, markers: [] }
    const publishedAt = workspace.publishedAt ?? null
    const directEditWindowEndsAt = publishedAt ? addDays(publishedAt, 14) : null
    return {
      facultyId: params.facultyId,
      template: rawTemplate && typeof rawTemplate === 'object' ? rawTemplate : null,
      workspace,
      directEditWindowEndsAt,
      classEditingLocked: !!directEditWindowEndsAt && new Date(directEditWindowEndsAt).getTime() < new Date(context.now()).getTime(),
    }
  })

  app.put('/api/admin/faculty-calendar/:facultyId', {
    schema: { tags: ['admin-control-plane'], summary: 'Persist the sysadmin timetable workspace for a faculty member' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(facultyCalendarParamsSchema, request.params)
    const body = parseOrThrow(facultyCalendarSaveSchema, request.body)
    const [profile, timetablePayload, workspacePayload] = await Promise.all([
      context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId)).then(rows => rows[0] ?? null),
      getRuntimeSlice(context, 'timetableByFacultyId', {} as Record<string, unknown>),
      getRuntimeSlice(context, 'adminCalendarByFacultyId', {} as Record<string, unknown>),
    ])
    if (!profile) throw notFound('Faculty profile not found')

    const currentTemplate = timetablePayload?.[params.facultyId] ?? null
    const currentWorkspace = facultyCalendarWorkspaceSchema.safeParse(workspacePayload?.[params.facultyId]).success
      ? facultyCalendarWorkspaceSchema.parse(workspacePayload?.[params.facultyId])
      : { publishedAt: null, markers: [] }
    const directEditWindowEndsAt = currentWorkspace.publishedAt ? addDays(currentWorkspace.publishedAt, 14) : null
    const classEditingLocked = !!directEditWindowEndsAt && new Date(directEditWindowEndsAt).getTime() < new Date(context.now()).getTime()
    const templateChanged = stringifyJson(currentTemplate) !== stringifyJson(body.template)
    if (templateChanged && classEditingLocked) {
      throw forbidden('The direct timetable edit window has ended for this faculty member. Route permanent class changes through the request workflow.')
    }

    const nextWorkspace = {
      publishedAt: currentWorkspace.publishedAt ?? (body.template ? context.now() : null),
      markers: body.workspace.markers
        .filter(marker => marker.facultyId === params.facultyId)
        .sort((left, right) => {
          if (left.dateISO !== right.dateISO) return left.dateISO.localeCompare(right.dateISO)
          const leftStart = left.startMinutes ?? -1
          const rightStart = right.startMinutes ?? -1
          return leftStart - rightStart
        }),
    }

    const nextTimetablePayload = { ...timetablePayload }
    if (body.template) nextTimetablePayload[params.facultyId] = body.template
    else delete nextTimetablePayload[params.facultyId]
    const nextWorkspacePayload = {
      ...workspacePayload,
      [params.facultyId]: nextWorkspace,
    }

    await Promise.all([
      saveRuntimeSlice(context, 'timetableByFacultyId', nextTimetablePayload),
      saveRuntimeSlice(context, 'adminCalendarByFacultyId', nextWorkspacePayload),
    ])

    await emitAuditEvent(context, {
      entityType: 'FacultyTimetableAdmin',
      entityId: params.facultyId,
      action: 'updated',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId ?? auth.userId,
      before: {
        hasTemplate: !!currentTemplate,
        workspace: currentWorkspace,
      },
      after: {
        hasTemplate: !!body.template,
        workspace: nextWorkspace,
      },
      metadata: {
        directEditWindowEndsAt: nextWorkspace.publishedAt ? addDays(nextWorkspace.publishedAt, 14) : null,
        classEditingLocked: false,
      },
    })

    const nextDirectEditWindowEndsAt = nextWorkspace.publishedAt ? addDays(nextWorkspace.publishedAt, 14) : null
    return {
      facultyId: params.facultyId,
      template: body.template,
      workspace: nextWorkspace,
      directEditWindowEndsAt: nextDirectEditWindowEndsAt,
      classEditingLocked: !!nextDirectEditWindowEndsAt && new Date(nextDirectEditWindowEndsAt).getTime() < new Date(context.now()).getTime(),
    }
  })

  app.get('/api/academic/faculty-profile/:facultyId', {
    schema: { tags: ['academic'], summary: 'Read the teaching-side faculty profile projection' },
  }, async request => {
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    if (
      auth.facultyId !== params.facultyId
      && auth.activeRoleGrant.roleCode !== 'HOD'
      && auth.activeRoleGrant.roleCode !== 'SYSTEM_ADMIN'
    ) {
      throw forbidden()
    }

    const [
      profileRows,
      userRows,
      appointmentRows,
      departmentRows,
      roleGrantRows,
      assignmentRows,
      ownershipRows,
      offeringRows,
      courseRows,
      branchRows,
      termRows,
      requestRows,
      timetableRuntimeRows,
      calendarRuntimeRows,
    ] = await Promise.all([
      context.db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, params.facultyId)),
      context.db.select().from(userAccounts),
      context.db.select().from(facultyAppointments).where(eq(facultyAppointments.facultyId, params.facultyId)),
      context.db.select().from(departments),
      context.db.select().from(roleGrants).where(eq(roleGrants.facultyId, params.facultyId)),
      context.db.select().from(mentorAssignments).where(eq(mentorAssignments.facultyId, params.facultyId)),
      context.db.select().from(facultyOfferingOwnerships).where(eq(facultyOfferingOwnerships.facultyId, params.facultyId)),
      context.db.select().from(sectionOfferings),
      context.db.select().from(courses),
      context.db.select().from(branches),
      context.db.select().from(academicTerms),
      context.db.select().from(adminRequests),
      context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'timetableByFacultyId')),
      context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, 'adminCalendarByFacultyId')),
    ])

    const profile = profileRows[0]
    if (!profile) throw notFound('Faculty profile not found')
    const user = userRows.find(row => row.userId === profile.userId)
    const departmentById = Object.fromEntries(departmentRows.map(row => [row.departmentId, row]))
    const branchById = Object.fromEntries(branchRows.map(row => [row.branchId, row]))
    const termById = Object.fromEntries(termRows.map(row => [row.termId, row]))
    const courseById = Object.fromEntries(courseRows.map(row => [row.courseId, row]))
    const primaryAppointment = appointmentRows.find(row => row.isPrimary === 1) ?? appointmentRows[0] ?? null
    const timetablePayload = timetableRuntimeRows[0] ? parseJson(timetableRuntimeRows[0].payloadJson, {} as Record<string, unknown>) : {}
    const timetableTemplate = timetablePayload && typeof timetablePayload === 'object'
      ? (timetablePayload as Record<string, unknown>)[params.facultyId]
      : null
    const calendarWorkspacePayload = calendarRuntimeRows[0] ? parseJson(calendarRuntimeRows[0].payloadJson, {} as Record<string, unknown>) : {}
    const parsedCalendarWorkspace = calendarWorkspacePayload && typeof calendarWorkspacePayload === 'object'
      ? facultyCalendarWorkspaceSchema.safeParse((calendarWorkspacePayload as Record<string, unknown>)[params.facultyId])
      : null
    const calendarWorkspace = parsedCalendarWorkspace?.success ? parsedCalendarWorkspace.data : null

    const activeOwnerships = ownershipRows.filter(row => row.status === 'active')
    const currentOwnedClasses = activeOwnerships.flatMap(row => {
      const offering = offeringRows.find(item => item.offeringId === row.offeringId)
      if (!offering) return []
      const course = courseById[offering.courseId]
      const branch = branchById[offering.branchId]
      const department = branch ? departmentById[branch.departmentId] : null
      return [{
        offeringId: offering.offeringId,
        courseCode: course?.courseCode ?? 'NA',
        title: course?.title ?? 'Untitled course',
        yearLabel: offering.yearLabel,
        sectionCode: offering.sectionCode,
        ownershipRole: row.ownershipRole,
        departmentName: department?.name ?? null,
        branchName: branch?.name ?? null,
      }]
    })

    const subjectRunMap = new Map<string, {
      subjectRunId: string
      courseCode: string
      title: string
      termId: string
      yearLabel: string
      sectionCodes: Set<string>
    }>()
    for (const row of activeOwnerships) {
      const offering = offeringRows.find(item => item.offeringId === row.offeringId)
      if (!offering) continue
      const course = courseById[offering.courseId]
      const subjectRunId = `subject_run_${offering.termId}_${offering.courseId}_${offering.yearLabel}`
      const existing = subjectRunMap.get(subjectRunId) ?? {
        subjectRunId,
        courseCode: course?.courseCode ?? 'NA',
        title: course?.title ?? 'Untitled course',
        termId: offering.termId,
        yearLabel: offering.yearLabel,
        sectionCodes: new Set<string>(),
      }
      existing.sectionCodes.add(offering.sectionCode)
      subjectRunMap.set(subjectRunId, existing)
    }

    const relatedRequests = requestRows
      .filter(row => row.requestedByFacultyId === params.facultyId || row.ownedByFacultyId === params.facultyId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    return {
      facultyId: profile.facultyId,
      displayName: profile.displayName,
      designation: profile.designation,
      employeeCode: profile.employeeCode,
      email: user?.email ?? '',
      phone: user?.phone ?? null,
      primaryDepartment: primaryAppointment
        ? {
            departmentId: primaryAppointment.departmentId,
            name: departmentById[primaryAppointment.departmentId]?.name ?? 'Unknown department',
            code: departmentById[primaryAppointment.departmentId]?.code ?? 'NA',
          }
        : null,
      appointments: appointmentRows.map(row => ({
        appointmentId: row.appointmentId,
        facultyId: row.facultyId,
        departmentId: row.departmentId,
        departmentName: departmentById[row.departmentId]?.name ?? null,
        departmentCode: departmentById[row.departmentId]?.code ?? null,
        branchId: row.branchId,
        branchName: row.branchId ? (branchById[row.branchId]?.name ?? null) : null,
        branchCode: row.branchId ? (branchById[row.branchId]?.code ?? null) : null,
        isPrimary: row.isPrimary === 1,
        startDate: row.startDate,
        endDate: row.endDate,
        status: row.status,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      permissions: roleGrantRows.map(mapRoleGrant),
      subjectRunCourseLeaderScope: Array.from(subjectRunMap.values()).map(entry => ({
        ...entry,
        sectionCodes: Array.from(entry.sectionCodes).sort(),
      })),
      mentorScope: {
        activeStudentCount: assignmentRows.filter(row => row.effectiveTo === null).length,
        studentIds: assignmentRows.filter(row => row.effectiveTo === null).map(row => row.studentId),
      },
      currentOwnedClasses,
      timetableStatus: {
        hasTemplate: !!timetableTemplate,
        publishedAt: timetableTemplate ? (calendarWorkspace?.publishedAt ?? timetableRuntimeRows[0]?.updatedAt ?? null) : null,
        directEditWindowEndsAt: timetableTemplate
          ? (calendarWorkspace?.publishedAt ? addDays(calendarWorkspace.publishedAt, 14) : (timetableRuntimeRows[0]?.updatedAt ? addDays(timetableRuntimeRows[0].updatedAt, 14) : null))
          : null,
      },
      requestSummary: {
        openCount: relatedRequests.filter(row => row.status !== 'Closed').length,
        recent: relatedRequests.slice(0, 5).map(row => ({
          adminRequestId: row.adminRequestId,
          summary: row.summary,
          status: row.status,
          updatedAt: row.updatedAt,
        })),
      },
    }
  })
}
