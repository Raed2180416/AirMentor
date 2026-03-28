import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import { adminRequestNotes, adminRequests, facultyProfiles } from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { badRequest, forbidden, notFound } from '../lib/http-errors.js'
import {
  adminRequestStatusSchema,
  canAccessAdminRequest,
  createAdminRequestTransition,
  deserializeTargetEntityRefs,
  emitAuditEvent,
  expectVersion,
  findSystemAdminFacultyId,
  getAdminRequestNotes,
  getAdminRequestTransitions,
  getAuditEventsForEntity,
  parseOrThrow,
  prioritySchema,
  requireAuth,
  requireRole,
  serializeTargetEntityRefs,
} from './support.js'

const createRequestSchema = z.object({
  requestType: z.string().min(1),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  targetEntityRefs: z.array(z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
  })),
  priority: prioritySchema,
  summary: z.string().min(1),
  details: z.string().min(1),
  dueAt: z.string().min(1),
  slaPolicyCode: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
})

const versionedActionSchema = z.object({
  version: z.number().int().positive(),
  noteBody: z.string().optional(),
})

const assignSchema = z.object({
  version: z.number().int().positive(),
  ownedByFacultyId: z.string().optional().nullable(),
  noteBody: z.string().optional(),
})

const noteSchema = z.object({
  visibility: z.string().min(1).default('internal'),
  noteType: z.enum(['request-context', 'clarification', 'decision-rationale', 'implementation-note', 'system-note']),
  body: z.string().min(1),
})

const allowedTransitions: Record<string, string[]> = {
  New: ['In Review', 'Rejected'],
  'In Review': ['Needs Info', 'Approved', 'Rejected'],
  'Needs Info': ['In Review', 'Rejected'],
  Approved: ['Implemented', 'Rejected'],
  Rejected: ['Closed'],
  Implemented: ['Closed'],
  Closed: [],
}

function mapAdminRequest(row: typeof adminRequests.$inferSelect) {
  return {
    adminRequestId: row.adminRequestId,
    requestType: row.requestType,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    targetEntityRefs: deserializeTargetEntityRefs(row.targetEntityRefsJson),
    priority: row.priority,
    status: row.status,
    requestedByRole: row.requestedByRole,
    requestedByFacultyId: row.requestedByFacultyId,
    ownedByRole: row.ownedByRole,
    ownedByFacultyId: row.ownedByFacultyId,
    summary: row.summary,
    details: row.details,
    notesThreadId: row.notesThreadId,
    dueAt: row.dueAt,
    slaPolicyCode: row.slaPolicyCode,
    decision: row.decision,
    payload: JSON.parse(row.payloadJson),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function getRequestOrThrow(context: RouteContext, adminRequestId: string) {
  const [row] = await context.db.select().from(adminRequests).where(eq(adminRequests.adminRequestId, adminRequestId))
  if (!row) throw notFound('Admin request not found')
  return row
}

async function insertNote(
  context: RouteContext,
  params: {
    adminRequestId: string
    authorRole: string
    authorFacultyId?: string | null
    visibility: string
    noteType: string
    body: string
  },
) {
  const note = {
    noteId: createId('request_note'),
    adminRequestId: params.adminRequestId,
    authorRole: params.authorRole,
    authorFacultyId: params.authorFacultyId ?? null,
    visibility: params.visibility,
    noteType: params.noteType,
    body: params.body,
    createdAt: context.now(),
  }
  await context.db.insert(adminRequestNotes).values(note)
  return note
}

async function transitionRequest(
  context: RouteContext,
  params: {
    requestId: string
    nextStatus: z.infer<typeof adminRequestStatusSchema>
    expectedVersion: number
    actorRole: string
    actorFacultyId?: string | null
    noteBody?: string
    noteType?: 'request-context' | 'clarification' | 'decision-rationale' | 'implementation-note' | 'system-note'
    decision?: string | null
    ownedByFacultyId?: string | null
  },
) {
  const current = await getRequestOrThrow(context, params.requestId)
  expectVersion(current.version, params.expectedVersion, 'AdminRequest', mapAdminRequest(current))
  if (!allowedTransitions[current.status]?.includes(params.nextStatus)) {
    throw badRequest(`Cannot move admin request from ${current.status} to ${params.nextStatus}`)
  }
  let noteId: string | null = null
  if (params.noteBody) {
    const note = await insertNote(context, {
      adminRequestId: params.requestId,
      authorRole: params.actorRole,
      authorFacultyId: params.actorFacultyId,
      visibility: 'internal',
      noteType: params.noteType ?? 'system-note',
      body: params.noteBody,
    })
    noteId = note.noteId
  }
  await context.db.update(adminRequests).set({
    status: params.nextStatus,
    decision: params.decision ?? current.decision,
    ownedByFacultyId: params.ownedByFacultyId === undefined ? current.ownedByFacultyId : params.ownedByFacultyId,
    version: current.version + 1,
    updatedAt: context.now(),
  }).where(eq(adminRequests.adminRequestId, params.requestId))
  const next = await getRequestOrThrow(context, params.requestId)
  await createAdminRequestTransition(context, {
    adminRequestId: params.requestId,
    previousStatus: current.status,
    nextStatus: params.nextStatus,
    actorRole: params.actorRole,
    actorFacultyId: params.actorFacultyId,
    noteId,
    affectedEntityRefs: deserializeTargetEntityRefs(current.targetEntityRefsJson),
  })
  await emitAuditEvent(context, {
    entityType: 'AdminRequest',
    entityId: params.requestId,
    action: `status:${params.nextStatus}`,
    actorRole: params.actorRole,
    actorId: params.actorFacultyId,
    before: mapAdminRequest(current),
    after: mapAdminRequest(next),
  })
  return mapAdminRequest(next)
}

export async function registerAdminRequestRoutes(app: FastifyInstance, context: RouteContext) {
  app.get('/api/admin/requests', {
    schema: { tags: ['admin-requests'], summary: 'List admin requests' },
  }, async request => {
    const auth = requireAuth(request)
    if (!['SYSTEM_ADMIN', 'HOD'].includes(auth.activeRoleGrant.roleCode)) throw forbidden()
    const rows = await context.db.select().from(adminRequests)
    const faculty = await context.db.select().from(facultyProfiles)
    const filtered = auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN'
      ? rows
      : rows.filter(item => item.requestedByFacultyId === auth.facultyId)
    return {
      items: filtered.map(row => {
        const requester = faculty.find(item => item.facultyId === row.requestedByFacultyId)
        const owner = faculty.find(item => item.facultyId === row.ownedByFacultyId)
        return {
          ...mapAdminRequest(row),
          requesterName: requester?.displayName ?? null,
          ownerName: owner?.displayName ?? null,
        }
      }),
    }
  })

  app.post('/api/admin/requests', {
    schema: { tags: ['admin-requests'], summary: 'Create admin request' },
  }, async request => {
    const auth = requireAuth(request)
    if (!['SYSTEM_ADMIN', 'HOD'].includes(auth.activeRoleGrant.roleCode)) throw forbidden()
    const body = parseOrThrow(createRequestSchema, request.body)
    if (!auth.facultyId) throw forbidden('Faculty context is required to create an admin request')
    const adminRequestId = createId('admin_request')
    const now = context.now()
    const ownerFacultyId = auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN' ? auth.facultyId : await findSystemAdminFacultyId(context)
    const created = {
      adminRequestId,
      requestType: body.requestType,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      targetEntityRefsJson: serializeTargetEntityRefs(body.targetEntityRefs),
      priority: body.priority,
      status: 'New',
      requestedByRole: auth.activeRoleGrant.roleCode,
      requestedByFacultyId: auth.facultyId,
      ownedByRole: 'SYSTEM_ADMIN',
      ownedByFacultyId: ownerFacultyId,
      summary: body.summary,
      details: body.details,
      notesThreadId: adminRequestId,
      dueAt: body.dueAt,
      slaPolicyCode: body.slaPolicyCode,
      decision: null,
      payloadJson: JSON.stringify(body.payload),
      version: 1,
      createdAt: now,
      updatedAt: now,
    } as const
    await context.db.insert(adminRequests).values(created)
    await createAdminRequestTransition(context, {
      adminRequestId,
      previousStatus: null,
      nextStatus: 'New',
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      affectedEntityRefs: body.targetEntityRefs,
    })
    await emitAuditEvent(context, {
      entityType: 'AdminRequest',
      entityId: adminRequestId,
      action: 'created',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: mapAdminRequest(created),
    })
    return mapAdminRequest(created)
  })

  app.get('/api/admin/requests/:requestId', {
    schema: { tags: ['admin-requests'], summary: 'Get admin request detail' },
  }, async request => {
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const row = await getRequestOrThrow(context, params.requestId)
    const allowed = await canAccessAdminRequest(context, request, row)
    if (!allowed) throw forbidden()
    return {
      ...mapAdminRequest(row),
      notes: await getAdminRequestNotes(context, params.requestId),
      transitions: await getAdminRequestTransitions(context, params.requestId),
    }
  })

  app.post('/api/admin/requests/:requestId/assign', {
    schema: { tags: ['admin-requests'], summary: 'Assign and claim admin request' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(assignSchema, request.body)
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'In Review',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'implementation-note',
      ownedByFacultyId: body.ownedByFacultyId ?? auth.facultyId,
    })
  })

  app.post('/api/admin/requests/:requestId/request-info', {
    schema: { tags: ['admin-requests'], summary: 'Request clarification from HoD' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(versionedActionSchema.extend({ noteBody: z.string().min(1) }), request.body)
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'Needs Info',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'clarification',
    })
  })

  app.post('/api/admin/requests/:requestId/approve', {
    schema: { tags: ['admin-requests'], summary: 'Approve admin request' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(versionedActionSchema.extend({ noteBody: z.string().min(1).optional() }), request.body)
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'Approved',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'decision-rationale',
      decision: 'approved',
    })
  })

  app.post('/api/admin/requests/:requestId/reject', {
    schema: { tags: ['admin-requests'], summary: 'Reject admin request' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(versionedActionSchema.extend({ noteBody: z.string().min(1) }), request.body)
    const current = await getRequestOrThrow(context, params.requestId)
    if (!['New', 'In Review', 'Needs Info', 'Approved'].includes(current.status)) {
      throw badRequest(`Cannot reject admin request from ${current.status}`)
    }
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'Rejected',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'decision-rationale',
      decision: 'rejected',
    })
  })

  app.post('/api/admin/requests/:requestId/mark-implemented', {
    schema: { tags: ['admin-requests'], summary: 'Mark request implemented' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(versionedActionSchema.extend({ noteBody: z.string().min(1).optional() }), request.body)
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'Implemented',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'implementation-note',
      decision: 'approved',
    })
  })

  app.post('/api/admin/requests/:requestId/close', {
    schema: { tags: ['admin-requests'], summary: 'Close admin request' },
  }, async request => {
    const auth = requireRole(request, ['SYSTEM_ADMIN'])
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const body = parseOrThrow(versionedActionSchema.extend({ noteBody: z.string().optional() }), request.body)
    return transitionRequest(context, {
      requestId: params.requestId,
      nextStatus: 'Closed',
      expectedVersion: body.version,
      actorRole: auth.activeRoleGrant.roleCode,
      actorFacultyId: auth.facultyId,
      noteBody: body.noteBody,
      noteType: 'implementation-note',
    })
  })

  app.post('/api/admin/requests/:requestId/notes', {
    schema: { tags: ['admin-requests'], summary: 'Add structured note to admin request' },
  }, async request => {
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const row = await getRequestOrThrow(context, params.requestId)
    const allowed = await canAccessAdminRequest(context, request, row)
    if (!allowed) throw forbidden()
    const body = parseOrThrow(noteSchema, request.body)
    const note = await insertNote(context, {
      adminRequestId: params.requestId,
      authorRole: auth.activeRoleGrant.roleCode,
      authorFacultyId: auth.facultyId,
      visibility: body.visibility,
      noteType: body.noteType,
      body: body.body,
    })
    await emitAuditEvent(context, {
      entityType: 'AdminRequest',
      entityId: params.requestId,
      action: 'note-added',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: note,
    })
    return note
  })

  app.get('/api/admin/requests/:requestId/audit', {
    schema: { tags: ['admin-requests'], summary: 'Get admin request audit trail' },
  }, async request => {
    const params = parseOrThrow(z.object({ requestId: z.string().min(1) }), request.params)
    const row = await getRequestOrThrow(context, params.requestId)
    const allowed = await canAccessAdminRequest(context, request, row)
    if (!allowed) throw forbidden()
    return {
      transitions: await getAdminRequestTransitions(context, params.requestId),
      auditEvents: await getAuditEventsForEntity(context, 'AdminRequest', params.requestId),
    }
  })
}
