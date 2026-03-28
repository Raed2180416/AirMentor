import { and, asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RouteContext } from '../app.js'
import {
  academicCalendarAuditEvents,
  academicMeetings,
  academicRuntimeState,
  academicTaskPlacements,
  academicTaskTransitions,
  academicTasks,
  courseOutcomeOverrides,
  facultyCalendarWorkspaces,
  offeringAssessmentSchemes,
  offeringQuestionPapers,
  sectionOfferings,
  studentAssessmentScores,
  studentAttendanceSnapshots,
} from '../db/schema.js'
import { createId } from '../lib/ids.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/http-errors.js'
import { parseJson, stringifyJson } from '../lib/json.js'
import { emitOperationalEvent } from '../lib/telemetry.js'
import type { AcademicRouteDependencies } from './academic.js'
import { DEFAULT_POLICY, resolveBatchPolicy } from './admin-structure.js'
import {
  emitAuditEvent,
  expectVersion,
  parseOrThrow,
  requireAuth,
  requireRole,
} from './support.js'

export async function registerAcademicRuntimeRoutes(
  app: FastifyInstance,
  context: RouteContext,
  deps: AcademicRouteDependencies,
) {
  const {
    academicMeetingCreateSchema,
    academicMeetingParamsSchema,
    academicMeetingPatchSchema,
    academicRoleCodes,
    assessmentCommitParamsSchema,
    assessmentCommitSchema,
    assertCourseLeaderCanManageOffering,
    assertStudentEnrolledInOffering,
    assertViewerCanManageTask,
    assertViewerCanSuperviseStudent,
    attendanceCommitSchema,
    buildAcademicMeetingResponse,
    buildDefaultQuestionPaper,
    buildDefaultSchemeFromPolicy,
    calendarAuditSyncSchema,
    canonicalizeSchemeState,
    facultyCalendarWorkspaceUpsertSchema,
    flattenTermTestLeaves,
    getAcademicRuntimeState,
    getEditableCalendarWindowStatus,
    getOfferingContext,
    mapAcademicTaskRow,
    mapCalendarAuditEventRow,
    mapFacultyCalendarWorkspaceRow,
    mapTaskPlacementRow,
    mapTaskTransitionRow,
    millisToIso,
    normalizeAcademicStudentId,
    offeringParamsSchema,
    offeringQuestionPaperUpsertSchema,
    offeringSchemeUpsertSchema,
    questionPaperParamsSchema,
    resolveCourseOutcomesForOffering,
    runtimeSliceSchemas,
    runtimeStateKeySchema,
    saveAcademicRuntimeState,
    schemeStateSchema,
    taskPlacementSyncSchema,
    taskSyncSchema,
    termTestBlueprintSchema,
    validateFacultyCalendarTemplate,
    validateMeetingWindow,
    validateQuestionPaperBlueprint,
    validateSchemeAgainstPolicy,
  } = deps

  const taskUpsertBodySchema = z.object({
    task: z.unknown(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  const taskPlacementUpsertBodySchema = z.object({
    placement: z.unknown(),
    expectedUpdatedAt: z.number().int().nonnegative().optional(),
  })
  const calendarAuditAppendBodySchema = z.object({
    event: z.unknown(),
  })
  const taskIdParamsSchema = z.object({
    taskId: z.string().min(1),
  })
  const taskPlacementDeleteQuerySchema = z.object({
    expectedUpdatedAt: z.coerce.number().int().nonnegative().optional(),
  })

  function taskRecordWithVersion(
    row: typeof academicTasks.$inferSelect,
    transitionRows: Array<typeof academicTaskTransitions.$inferSelect>,
  ) {
    return {
      ...mapAcademicTaskRow(row, transitionRows.map(mapTaskTransitionRow)),
      version: row.version,
    }
  }

  async function syncRuntimeTaskShadow(
    record: ReturnType<typeof taskRecordWithVersion>,
    options: { writeRuntimeShadow?: boolean } = {},
  ) {
    if (options.writeRuntimeShadow === false) return record as Record<string, unknown>
    const { version: _version, ...runtimeComparableTask } = record
    const currentTasks = await getAcademicRuntimeState(context, 'tasks') as Array<Record<string, unknown>>
    const nextTasks = currentTasks.slice()
    const currentIndex = nextTasks.findIndex(task => task.id === runtimeComparableTask.id)
    if (currentIndex >= 0) {
      nextTasks[currentIndex] = runtimeComparableTask
    } else {
      nextTasks.push(runtimeComparableTask)
    }
    const savedTasks = await saveAcademicRuntimeState(context, 'tasks', nextTasks) as Array<Record<string, unknown>>

    const currentResolvedTasks = await getAcademicRuntimeState(context, 'resolvedTasks') as Record<string, number>
    const nextResolvedTasks = { ...currentResolvedTasks }
    if (record.status === 'Resolved') {
      nextResolvedTasks[record.id] = record.updatedAt ?? record.createdAt
    } else {
      delete nextResolvedTasks[record.id]
    }
    await saveAcademicRuntimeState(context, 'resolvedTasks', nextResolvedTasks)
    return (savedTasks.find(task => task.id === runtimeComparableTask.id) ?? runtimeComparableTask) as Record<string, unknown>
  }

  async function syncRuntimeTaskPlacementShadow(
    taskId: string,
    placement: ReturnType<typeof mapTaskPlacementRow> | null,
    options: { writeRuntimeShadow?: boolean } = {},
  ) {
    if (options.writeRuntimeShadow === false) return placement
    const currentPlacements = await getAcademicRuntimeState(context, 'taskPlacements') as Record<string, unknown>
    const nextPlacements = { ...currentPlacements }
    if (placement) {
      nextPlacements[taskId] = placement
    } else {
      delete nextPlacements[taskId]
    }
    const savedPlacements = await saveAcademicRuntimeState(context, 'taskPlacements', nextPlacements) as Record<string, unknown>
    return (savedPlacements[taskId] ?? null) as ReturnType<typeof mapTaskPlacementRow> | null
  }

  async function syncRuntimeCalendarAuditShadow(
    event: ReturnType<typeof mapCalendarAuditEventRow>,
    options: { writeRuntimeShadow?: boolean } = {},
  ) {
    if (!event || options.writeRuntimeShadow === false) return event
    const currentEvents = await getAcademicRuntimeState(context, 'calendarAudit') as Array<Record<string, unknown>>
    const nextEvents = currentEvents.slice()
    const currentIndex = nextEvents.findIndex(item => item.id === event.id)
    if (currentIndex >= 0) {
      nextEvents[currentIndex] = event
    } else {
      nextEvents.push(event)
    }
    const savedEvents = await saveAcademicRuntimeState(context, 'calendarAudit', nextEvents) as Array<Record<string, unknown>>
    return (savedEvents.find(item => item.id === event.id) ?? event) as ReturnType<typeof mapCalendarAuditEventRow>
  }

  async function maybeEmitRuntimeShadowDrift(
    stateKey: 'tasks' | 'taskPlacements' | 'calendarAudit',
    entityId: string,
    authoritativeEntity: unknown,
  ) {
    const runtime = await getAcademicRuntimeState(context, stateKey)
    const runtimeEntity = stateKey === 'tasks'
      ? ((runtime as Array<Record<string, unknown>>).find(item => item.id === entityId) ?? null)
      : stateKey === 'taskPlacements'
        ? (((runtime as Record<string, unknown>)[entityId]) ?? null)
        : (((runtime as Array<Record<string, unknown>>).find(item => item.id === entityId)) ?? null)
    if (JSON.stringify(runtimeEntity) === JSON.stringify(authoritativeEntity)) return
    emitOperationalEvent('academic.runtime.shadow_drift', {
      stateKey,
      entityId,
      runtimeEntityPresent: runtimeEntity != null,
      authoritativeEntityPresent: authoritativeEntity != null,
    }, { level: 'warn' })
  }

  async function listVisibleTaskRecords(
    auth: ReturnType<typeof requireRole>,
  ) {
    const [taskRows, transitionRows] = await Promise.all([
      context.db.select().from(academicTasks),
      context.db.select().from(academicTaskTransitions).orderBy(asc(academicTaskTransitions.occurredAt)),
    ])
    const transitionsByTaskId = new Map<string, Array<typeof academicTaskTransitions.$inferSelect>>()
    for (const transitionRow of transitionRows) {
      const current = transitionsByTaskId.get(transitionRow.taskId) ?? []
      current.push(transitionRow)
      transitionsByTaskId.set(transitionRow.taskId, current)
    }
    const visibleItems: Array<ReturnType<typeof taskRecordWithVersion>> = []
    for (const row of taskRows) {
      const record = taskRecordWithVersion(row, transitionsByTaskId.get(row.taskId) ?? [])
      try {
        await assertViewerCanManageTask(context, auth, record)
        visibleItems.push(record)
      } catch {
        // Ignore tasks outside the active teaching scope.
      }
    }
    return visibleItems
  }

  async function persistAcademicTask(
    auth: ReturnType<typeof requireRole>,
    taskInput: unknown,
    options: { expectedVersion?: number; emitShadowDrift?: boolean; writeRuntimeShadow?: boolean } = {},
  ) {
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const parsed = parseOrThrow(taskSyncSchema, { tasks: [taskInput] })
    const task = parsed.tasks[0]
    const normalizedTask = {
      ...task,
      studentId: normalizeAcademicStudentId(task.studentId),
    }
    await assertViewerCanManageTask(context, auth, normalizedTask)
    const now = context.now()
    const [current] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, task.id))
    if (!current && typeof options.expectedVersion === 'number') {
      throw badRequest('Expected version can only be supplied for an existing task')
    }
    if (current && typeof options.expectedVersion === 'number') {
      expectVersion(current.version, options.expectedVersion, 'academic task', {
        taskId: task.id,
        version: current.version,
      })
    }
    if (current) {
      const currentTransitions = await context.db
        .select()
        .from(academicTaskTransitions)
        .where(eq(academicTaskTransitions.taskId, task.id))
        .orderBy(asc(academicTaskTransitions.occurredAt))
      const currentTask = mapAcademicTaskRow(current, currentTransitions.map(mapTaskTransitionRow))
      if (currentTask.dismissal && !task.dismissal) {
        const restoreWindowEndsAt = currentTask.dismissal.dismissedAt + (60 * 24 * 60 * 60 * 1000)
        if (restoreWindowEndsAt < Date.now()) {
          throw forbidden('The restore window for this queue item has expired')
        }
      }
      await context.db.update(academicTasks).set({
        studentId: normalizedTask.studentId,
        offeringId: normalizedTask.offeringId,
        assignedToRole: normalizedTask.assignedTo,
        taskType: normalizedTask.taskType ?? 'Follow-up',
        status: normalizedTask.status,
        title: normalizedTask.title,
        dueLabel: normalizedTask.due,
        dueDateIso: normalizedTask.dueDateISO ?? null,
        riskProbScaled: Math.round(normalizedTask.riskProb * 100),
        riskBand: normalizedTask.riskBand,
        priority: normalizedTask.priority,
        payloadJson: stringifyJson(normalizedTask),
        updatedByFacultyId: auth.facultyId,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(academicTasks.taskId, task.id))
    } else {
      await context.db.insert(academicTasks).values({
        taskId: task.id,
        studentId: normalizedTask.studentId,
        offeringId: normalizedTask.offeringId,
        assignedToRole: normalizedTask.assignedTo,
        taskType: normalizedTask.taskType ?? 'Follow-up',
        status: normalizedTask.status,
        title: normalizedTask.title,
        dueLabel: normalizedTask.due,
        dueDateIso: normalizedTask.dueDateISO ?? null,
        riskProbScaled: Math.round(normalizedTask.riskProb * 100),
        riskBand: normalizedTask.riskBand,
        priority: normalizedTask.priority,
        payloadJson: stringifyJson(normalizedTask),
        createdByFacultyId: auth.facultyId,
        updatedByFacultyId: auth.facultyId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const existingTransitions = await context.db
      .select()
      .from(academicTaskTransitions)
      .where(eq(academicTaskTransitions.taskId, task.id))
    const existingTransitionIds = new Set(existingTransitions.map(row => row.transitionId))
    const missingTransitions = (task.transitionHistory ?? []).filter(transition => !existingTransitionIds.has(transition.id))
    for (const transition of missingTransitions) {
      await context.db.insert(academicTaskTransitions).values({
        transitionId: transition.id,
        taskId: task.id,
        actorRole: transition.actorRole,
        actorFacultyId: transition.actorTeacherId ?? null,
        action: transition.action,
        fromOwner: transition.fromOwner ?? null,
        toOwner: transition.toOwner,
        note: transition.note,
        occurredAt: millisToIso(transition.at, now),
      })
    }

    const [storedTask] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, task.id))
    if (!storedTask) throw notFound('Task not found after save')
    const storedTransitions = await context.db
      .select()
      .from(academicTaskTransitions)
      .where(eq(academicTaskTransitions.taskId, task.id))
      .orderBy(asc(academicTaskTransitions.occurredAt))
    const record = taskRecordWithVersion(storedTask, storedTransitions)
    const runtimeTaskShadow = await syncRuntimeTaskShadow(record, {
      writeRuntimeShadow: options.writeRuntimeShadow ?? true,
    })
    await emitAuditEvent(context, {
      entityType: 'academic_task',
      entityId: task.id,
      action: current ? 'UPSERT' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { version: record.version },
    })
    if (options.emitShadowDrift) {
      await maybeEmitRuntimeShadowDrift('tasks', task.id, runtimeTaskShadow)
    }
    return {
      task: record,
      created: !current,
    }
  }

  async function persistAcademicTaskPlacement(
    auth: ReturnType<typeof requireRole>,
    placementInput: unknown,
    options: { expectedUpdatedAt?: number; emitShadowDrift?: boolean; writeRuntimeShadow?: boolean } = {},
  ) {
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const parsed = parseOrThrow(taskPlacementSyncSchema, {
      placements: {
        [String((placementInput as { taskId?: string })?.taskId ?? '')]: placementInput,
      },
    })
    const placement = Object.values(parsed.placements)[0]
    const [taskRow] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, placement.taskId))
    if (!taskRow) throw notFound('Task not found for placement')
    const task = mapAcademicTaskRow(taskRow, [])
    await assertViewerCanManageTask(context, auth, task)
    if (placement.placementMode === 'timed') {
      if (
        typeof placement.startMinutes !== 'number'
        || typeof placement.endMinutes !== 'number'
        || placement.startMinutes >= placement.endMinutes
      ) {
        throw badRequest('Timed task placements must include a valid start and end range')
      }
    }
    const now = context.now()
    const [current] = await context.db
      .select()
      .from(academicTaskPlacements)
      .where(eq(academicTaskPlacements.taskId, placement.taskId))
    if (!current && typeof options.expectedUpdatedAt === 'number') {
      throw badRequest('Expected updatedAt can only be supplied for an existing placement')
    }
    if (current && typeof options.expectedUpdatedAt === 'number') {
      const currentUpdatedAt = Date.parse(current.updatedAt)
      if (!Number.isFinite(currentUpdatedAt) || currentUpdatedAt !== options.expectedUpdatedAt) {
        throw conflict('Stale updatedAt for academic task placement', {
          taskId: placement.taskId,
          updatedAt: Number.isFinite(currentUpdatedAt) ? currentUpdatedAt : null,
        })
      }
    }
    if (current) {
      await context.db.update(academicTaskPlacements).set({
        facultyId: auth.facultyId,
        dateIso: placement.dateISO,
        placementMode: placement.placementMode,
        startMinutes: placement.startMinutes ?? null,
        endMinutes: placement.endMinutes ?? null,
        slotId: placement.slotId ?? null,
        startTime: placement.startTime ?? null,
        endTime: placement.endTime ?? null,
        updatedAt: now,
      }).where(eq(academicTaskPlacements.taskId, placement.taskId))
    } else {
      await context.db.insert(academicTaskPlacements).values({
        taskId: placement.taskId,
        facultyId: auth.facultyId,
        dateIso: placement.dateISO,
        placementMode: placement.placementMode,
        startMinutes: placement.startMinutes ?? null,
        endMinutes: placement.endMinutes ?? null,
        slotId: placement.slotId ?? null,
        startTime: placement.startTime ?? null,
        endTime: placement.endTime ?? null,
        updatedAt: now,
      })
    }
    const [storedPlacement] = await context.db
      .select()
      .from(academicTaskPlacements)
      .where(eq(academicTaskPlacements.taskId, placement.taskId))
    if (!storedPlacement) throw notFound('Task placement not found after save')
    const record = mapTaskPlacementRow(storedPlacement)
    const runtimePlacementShadow = await syncRuntimeTaskPlacementShadow(placement.taskId, record, {
      writeRuntimeShadow: options.writeRuntimeShadow ?? true,
    })
    await emitAuditEvent(context, {
      entityType: 'academic_task_placement',
      entityId: placement.taskId,
      action: current ? 'UPSERT' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { updatedAt: record.updatedAt },
    })
    if (options.emitShadowDrift) {
      await maybeEmitRuntimeShadowDrift('taskPlacements', placement.taskId, runtimePlacementShadow)
    }
    return {
      placement: record,
      created: !current,
    }
  }

  async function deleteAcademicTaskPlacement(
    auth: ReturnType<typeof requireRole>,
    taskId: string,
    expectedUpdatedAt?: number,
  ) {
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const [taskRow] = await context.db.select().from(academicTasks).where(eq(academicTasks.taskId, taskId))
    if (!taskRow) throw notFound('Task not found for placement')
    const task = mapAcademicTaskRow(taskRow, [])
    await assertViewerCanManageTask(context, auth, task)
    const [current] = await context.db
      .select()
      .from(academicTaskPlacements)
      .where(eq(academicTaskPlacements.taskId, taskId))
    if (!current) {
      return { ok: true as const, taskId, deleted: false }
    }
    if (typeof expectedUpdatedAt === 'number') {
      const currentUpdatedAt = Date.parse(current.updatedAt)
      if (!Number.isFinite(currentUpdatedAt) || currentUpdatedAt !== expectedUpdatedAt) {
        throw conflict('Stale updatedAt for academic task placement', {
          taskId,
          updatedAt: Number.isFinite(currentUpdatedAt) ? currentUpdatedAt : null,
        })
      }
    }
    await context.db.delete(academicTaskPlacements).where(eq(academicTaskPlacements.taskId, taskId))
    const runtimePlacementShadow = await syncRuntimeTaskPlacementShadow(taskId, null, {
      writeRuntimeShadow: false,
    })
    await emitAuditEvent(context, {
      entityType: 'academic_task_placement',
      entityId: taskId,
      action: 'DELETE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
    await maybeEmitRuntimeShadowDrift('taskPlacements', taskId, runtimePlacementShadow)
    return { ok: true as const, taskId, deleted: true }
  }

  async function appendAcademicCalendarAuditEvent(
    auth: ReturnType<typeof requireRole>,
    eventInput: unknown,
    options: { emitShadowDrift?: boolean; writeRuntimeShadow?: boolean } = {},
  ) {
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const parsed = parseOrThrow(calendarAuditSyncSchema, { events: [eventInput] })
    const event = parsed.events[0]
    if (event.facultyId !== auth.facultyId) {
      throw forbidden('Calendar audit events can only be persisted for the active faculty')
    }
    const [current] = await context.db
      .select()
      .from(academicCalendarAuditEvents)
      .where(eq(academicCalendarAuditEvents.auditEventId, event.id))
    const currentEvent = current ? mapCalendarAuditEventRow(current) : null
    if (currentEvent && stringifyJson(currentEvent) !== stringifyJson(event)) {
      throw conflict('Calendar audit event already exists with different payload', currentEvent)
    }
    if (!current) {
      await context.db.insert(academicCalendarAuditEvents).values({
        auditEventId: event.id,
        facultyId: auth.facultyId,
        payloadJson: stringifyJson(event),
        createdAt: millisToIso(event.timestamp, context.now()),
      })
      await emitAuditEvent(context, {
        entityType: 'academic_calendar_audit_event',
        entityId: event.id,
        action: 'CREATE',
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId,
      })
    }
    const stored = currentEvent ?? event
    const runtimeCalendarAuditShadow = await syncRuntimeCalendarAuditShadow(stored, {
      writeRuntimeShadow: options.writeRuntimeShadow ?? true,
    })
    if (options.emitShadowDrift) {
      await maybeEmitRuntimeShadowDrift('calendarAudit', event.id, runtimeCalendarAuditShadow)
    }
    return {
      event: stored,
      created: !current,
    }
  }

  app.put('/api/academic/runtime/:stateKey', {
    schema: {
      tags: ['academic'],
      summary: 'Persist a single academic runtime slice',
      deprecated: true,
    },
  }, async request => {
    requireRole(request, [...academicRoleCodes])
    const auth = requireAuth(request)
    const params = parseOrThrow(z.object({ stateKey: runtimeStateKeySchema }), request.params)
    const body = parseOrThrow(runtimeSliceSchemas[params.stateKey] as z.ZodTypeAny, request.body)
    const [current] = await context.db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, params.stateKey))
    if (current) {
      await context.db.update(academicRuntimeState).set({
        payloadJson: stringifyJson(body),
        version: current.version + 1,
        updatedAt: context.now(),
      }).where(eq(academicRuntimeState.stateKey, params.stateKey))
    } else {
      await context.db.insert(academicRuntimeState).values({
        stateKey: params.stateKey,
        payloadJson: stringifyJson(body),
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

  function registerNamedRuntimeSliceUpsertRoute(input: {
    route: string
    stateKey: 'drafts' | 'cellValues' | 'lockByOffering' | 'lockAuditByTarget'
    summary: string
  }) {
    app.put(input.route, {
      schema: {
        tags: ['academic'],
        summary: input.summary,
      },
    }, async request => {
      requireRole(request, [...academicRoleCodes])
      const auth = requireAuth(request)
      const body = parseOrThrow(runtimeSliceSchemas[input.stateKey] as z.ZodTypeAny, request.body)
      await saveAcademicRuntimeState(context, input.stateKey, body)
      await emitAuditEvent(context, {
        entityType: 'academic_runtime_state',
        entityId: input.stateKey,
        action: 'UPSERT',
        actorRole: auth.activeRoleGrant.roleCode,
        actorId: auth.facultyId ?? auth.userId,
        metadata: {
          route: input.route,
          stateKey: input.stateKey,
        },
      })
      return { ok: true, stateKey: input.stateKey }
    })
  }

  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/drafts',
    stateKey: 'drafts',
    summary: 'Persist academic draft cells',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/cell-values',
    stateKey: 'cellValues',
    summary: 'Persist academic cell values',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/lock-by-offering',
    stateKey: 'lockByOffering',
    summary: 'Persist academic entry locks by offering',
  })
  registerNamedRuntimeSliceUpsertRoute({
    route: '/api/academic/runtime/lock-audit-by-target',
    stateKey: 'lockAuditByTarget',
    summary: 'Persist academic lock audit by target',
  })

  app.put('/api/academic/tasks/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative academic action queue projection for the active teaching role',
      deprecated: true,
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskSyncSchema, request.body)
    for (const task of body.tasks) {
      await persistAcademicTask(auth, task)
    }

    await emitAuditEvent(context, {
      entityType: 'academic_task_sync',
      entityId: auth.facultyId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { taskCount: body.tasks.length },
    })
    return { ok: true, count: body.tasks.length }
  })

  app.get('/api/academic/tasks', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative academic tasks for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    return {
      items: await listVisibleTaskRecords(auth),
    }
  })

  app.put('/api/academic/tasks/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Create or update a single academic task with per-entity conflict handling',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const body = parseOrThrow(taskUpsertBodySchema, request.body)
    const parsed = parseOrThrow(taskSyncSchema, { tasks: [body.task] })
    const task = parsed.tasks[0]
    if (task.id !== params.taskId) {
      throw badRequest('Task payload does not match the requested task id')
    }
    return persistAcademicTask(auth, task, {
      expectedVersion: body.expectedVersion,
      writeRuntimeShadow: false,
    })
  })

  app.put('/api/academic/task-placements/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist task placements for the active teaching role',
      deprecated: true,
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(taskPlacementSyncSchema, request.body)
    for (const [taskId, placement] of Object.entries(body.placements)) {
      if (placement.taskId !== taskId) throw badRequest('Task placement payload does not match its record key')
      await persistAcademicTaskPlacement(auth, placement)
    }

    await emitAuditEvent(context, {
      entityType: 'academic_task_placement_sync',
      entityId: auth.facultyId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: { placementCount: Object.keys(body.placements).length },
    })
    return { ok: true, count: Object.keys(body.placements).length }
  })

  app.get('/api/academic/task-placements', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative task placements for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const visibleTasks = await listVisibleTaskRecords(auth)
    const visibleTaskIds = new Set(visibleTasks.map(task => task.id))
    const placementRows = await context.db.select().from(academicTaskPlacements)
    return {
      items: placementRows
        .filter(row => visibleTaskIds.has(row.taskId))
        .map(row => mapTaskPlacementRow(row)),
    }
  })

  app.put('/api/academic/task-placements/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Create or update a single task placement with per-entity conflict handling',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const body = parseOrThrow(taskPlacementUpsertBodySchema, request.body)
    const parsed = parseOrThrow(taskPlacementSyncSchema, {
      placements: {
        [params.taskId]: body.placement,
      },
    })
    const placement = parsed.placements[params.taskId]
    if (!placement || placement.taskId !== params.taskId) {
      throw badRequest('Task placement payload does not match the requested task id')
    }
    return persistAcademicTaskPlacement(auth, placement, {
      expectedUpdatedAt: body.expectedUpdatedAt,
      writeRuntimeShadow: false,
    })
  })

  app.delete('/api/academic/task-placements/:taskId', {
    schema: {
      tags: ['academic'],
      summary: 'Delete a single task placement with per-entity conflict handling',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const params = parseOrThrow(taskIdParamsSchema, request.params)
    const query = parseOrThrow(taskPlacementDeleteQuerySchema, request.query)
    return deleteAcademicTaskPlacement(auth, params.taskId, query.expectedUpdatedAt)
  })

  app.put('/api/academic/calendar-audit/sync', {
    schema: {
      tags: ['academic'],
      summary: 'Persist faculty calendar audit events',
      deprecated: true,
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const body = parseOrThrow(calendarAuditSyncSchema, request.body)
    for (const event of body.events) {
      await appendAcademicCalendarAuditEvent(auth, event)
    }
    return { ok: true, count: body.events.length }
  })

  app.get('/api/academic/calendar-audit', {
    schema: {
      tags: ['academic'],
      summary: 'List authoritative calendar audit events for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const rows = await context.db
      .select()
      .from(academicCalendarAuditEvents)
      .where(eq(academicCalendarAuditEvents.facultyId, auth.facultyId))
      .orderBy(asc(academicCalendarAuditEvents.createdAt))
    return {
      items: rows.flatMap(row => {
        const parsed = mapCalendarAuditEventRow(row)
        return parsed ? [parsed] : []
      }),
    }
  })

  app.post('/api/academic/calendar-audit', {
    schema: {
      tags: ['academic'],
      summary: 'Append a single calendar audit event for the active teaching role',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    const body = parseOrThrow(calendarAuditAppendBodySchema, request.body)
    return appendAcademicCalendarAuditEvent(auth, body.event, {
      writeRuntimeShadow: false,
    })
  })

  app.put('/api/academic/faculty-calendar-workspace/:facultyId', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the faculty-owned timetable workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(z.object({ facultyId: z.string().min(1) }), request.params)
    const body = parseOrThrow(facultyCalendarWorkspaceUpsertSchema, request.body)
    if (auth.facultyId !== params.facultyId) {
      throw forbidden('You can only edit your own timetable workspace')
    }
    await validateFacultyCalendarTemplate(context, params.facultyId, body.template)
    const { directEditWindowEndsAt, classEditingLocked } = await getEditableCalendarWindowStatus(context, params.facultyId)
    const [current] = await context.db
      .select()
      .from(facultyCalendarWorkspaces)
      .where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    const currentTemplate = current ? mapFacultyCalendarWorkspaceRow(current) : null
    if (classEditingLocked && stringifyJson(currentTemplate) !== stringifyJson(body.template)) {
      throw forbidden('The direct class editing window has ended for this faculty timetable')
    }

    const now = context.now()
    if (current) {
      await context.db.update(facultyCalendarWorkspaces).set({
        templateJson: stringifyJson(body.template),
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    } else {
      await context.db.insert(facultyCalendarWorkspaces).values({
        facultyId: params.facultyId,
        templateJson: stringifyJson(body.template),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const timetablePayload = await getAcademicRuntimeState(context, 'timetableByFacultyId') as Record<string, unknown>
    await saveAcademicRuntimeState(context, 'timetableByFacultyId', {
      ...timetablePayload,
      [params.facultyId]: body.template,
    })

    const [saved] = await context.db
      .select()
      .from(facultyCalendarWorkspaces)
      .where(eq(facultyCalendarWorkspaces.facultyId, params.facultyId))
    await emitAuditEvent(context, {
      entityType: 'faculty_calendar_workspace',
      entityId: params.facultyId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: currentTemplate,
      after: body.template,
      metadata: { directEditWindowEndsAt, classEditingLocked },
    })
    return {
      facultyId: params.facultyId,
      template: body.template,
      version: saved?.version ?? 1,
      directEditWindowEndsAt,
      classEditingLocked,
    }
  })

  app.post('/api/academic/meetings', {
    schema: {
      tags: ['academic'],
      summary: 'Create a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const body = parseOrThrow(academicMeetingCreateSchema, request.body)
    validateMeetingWindow(body.startMinutes, body.endMinutes)
    const { studentId } = await assertViewerCanSuperviseStudent({
      context,
      auth,
      studentId: body.studentId,
      offeringId: body.offeringId ?? null,
    })

    if (body.offeringId) {
      const { offering } = await getOfferingContext(context, body.offeringId)
      await assertStudentEnrolledInOffering(context, offering, studentId)
    }

    const now = context.now()
    const meetingId = createId('meeting')
    await context.db.insert(academicMeetings).values({
      meetingId,
      facultyId: auth.facultyId,
      studentId,
      offeringId: body.offeringId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      dateIso: body.dateISO,
      startMinutes: body.startMinutes,
      endMinutes: body.endMinutes,
      status: body.status,
      createdByFacultyId: auth.facultyId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    const [saved] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, meetingId))
    if (!saved) throw notFound('Meeting could not be created')
    const response = await buildAcademicMeetingResponse(context, saved)
    await emitAuditEvent(context, {
      entityType: 'academic_meeting',
      entityId: meetingId,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      after: response,
    })
    return response
  })

  app.patch('/api/academic/meetings/:meetingId', {
    schema: {
      tags: ['academic'],
      summary: 'Update a faculty meeting with a supervised student',
    },
  }, async request => {
    const auth = requireRole(request, [...academicRoleCodes])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(academicMeetingParamsSchema, request.params)
    const body = parseOrThrow(academicMeetingPatchSchema, request.body)
    validateMeetingWindow(body.startMinutes, body.endMinutes)
    const [current] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, params.meetingId))
    if (!current) throw notFound('Meeting not found')
    if (current.facultyId !== auth.facultyId) {
      throw forbidden('You can only update meetings owned by the active faculty')
    }
    expectVersion(current.version, body.version, 'meeting', current)
    const { studentId } = await assertViewerCanSuperviseStudent({
      context,
      auth,
      studentId: body.studentId,
      offeringId: body.offeringId ?? current.offeringId ?? null,
    })
    if (body.offeringId) {
      const { offering } = await getOfferingContext(context, body.offeringId)
      await assertStudentEnrolledInOffering(context, offering, studentId)
    }

    await context.db.update(academicMeetings).set({
      studentId,
      offeringId: body.offeringId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      dateIso: body.dateISO,
      startMinutes: body.startMinutes,
      endMinutes: body.endMinutes,
      status: body.status,
      version: current.version + 1,
      updatedAt: context.now(),
    }).where(eq(academicMeetings.meetingId, params.meetingId))
    const [saved] = await context.db
      .select()
      .from(academicMeetings)
      .where(eq(academicMeetings.meetingId, params.meetingId))
    if (!saved) throw notFound('Meeting not found after update')
    const beforeResponse = await buildAcademicMeetingResponse(context, current)
    const response = await buildAcademicMeetingResponse(context, saved)
    await emitAuditEvent(context, {
      entityType: 'academic_meeting',
      entityId: params.meetingId,
      action: 'UPDATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: beforeResponse,
      after: response,
    })
    return response
  })

  app.put('/api/academic/offerings/:offeringId/attendance', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering attendance entries from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(attendanceCommitSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering } = await getOfferingContext(context, params.offeringId)
    const capturedAt = body.capturedAt ?? context.now()
    const now = context.now()

    for (const entry of body.entries) {
      if (entry.presentClasses > entry.totalClasses) {
        throw badRequest('Present classes cannot exceed total classes')
      }
      const enrollment = await assertStudentEnrolledInOffering(context, offering, entry.studentId)
      await context.db.insert(studentAttendanceSnapshots).values({
        attendanceSnapshotId: createId('attendance'),
        studentId: enrollment.studentId,
        offeringId: params.offeringId,
        presentClasses: entry.presentClasses,
        totalClasses: entry.totalClasses,
        attendancePercent: Math.round((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100),
        source: 'teacher-workspace',
        capturedAt,
        createdAt: now,
        updatedAt: now,
      })
    }

    const averageAttendance = body.entries.length > 0
      ? Math.round(body.entries.reduce((sum, entry) => sum + ((entry.presentClasses / Math.max(1, entry.totalClasses)) * 100), 0) / body.entries.length)
      : offering.attendance

    await context.db.update(sectionOfferings).set({
      attendance: averageAttendance,
      version: offering.version + 1,
      updatedAt: now,
    }).where(eq(sectionOfferings.offeringId, params.offeringId))

    if (body.lock) {
      const currentLockPayload = await getAcademicRuntimeState(context, 'lockByOffering') as Record<string, Record<string, boolean>>
      await saveAcademicRuntimeState(context, 'lockByOffering', {
        ...currentLockPayload,
        [params.offeringId]: {
          ...(currentLockPayload[params.offeringId] ?? {}),
          attendance: true,
        },
      })
    }

    await emitAuditEvent(context, {
      entityType: 'offering_attendance_commit',
      entityId: params.offeringId,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: {
        entryCount: body.entries.length,
        capturedAt,
        locked: !!body.lock,
      },
    })
    return {
      ok: true,
      offeringId: params.offeringId,
      capturedAt,
      averageAttendance,
      locked: !!body.lock,
    }
  })

  app.put('/api/academic/offerings/:offeringId/assessment-entries/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist offering assessment entry rows from the teaching workspace',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(assessmentCommitParamsSchema, request.params)
    const body = parseOrThrow(assessmentCommitSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, term, course, department } = await getOfferingContext(context, params.offeringId)
    const policy = term.batchId ? (await resolveBatchPolicy(context, term.batchId)).effectivePolicy : DEFAULT_POLICY
    const schemeRow = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))
      .then(rows => rows[0] ?? null)
    const scheme = schemeRow
      ? canonicalizeSchemeState(schemeStateSchema.parse(parseJson(schemeRow.schemeJson, {})), policy)
      : buildDefaultSchemeFromPolicy(policy)
    const evaluatedAt = body.evaluatedAt ?? context.now()
    const now = context.now()

    const lockField = params.kind === 'tt1'
      ? 'tt1Locked'
      : params.kind === 'tt2'
        ? 'tt2Locked'
        : params.kind === 'quiz'
          ? 'quizLocked'
          : params.kind === 'assignment'
            ? 'assignmentLocked'
            : params.kind === 'finals'
              ? 'finalsLocked'
              : null
    if (lockField && offering[lockField] === 1) {
      throw forbidden('This assessment dataset is locked')
    }

    const allowedComponents = new Map<string, { maxScore: number; storageType: string }>()
    if (params.kind === 'tt1' || params.kind === 'tt2') {
      const courseOutcomeRows = await context.db
        .select()
        .from(courseOutcomeOverrides)
        .where(and(
          eq(courseOutcomeOverrides.courseId, offering.courseId),
          eq(courseOutcomeOverrides.status, 'active'),
        ))
      const resolvedOutcomes = resolveCourseOutcomesForOffering({
        institutionId: department.institutionId,
        branchId: offering.branchId,
        batchId: term.batchId,
        offeringId: offering.offeringId,
        courseId: offering.courseId,
        courseCode: course.courseCode,
        courseTitle: course.title,
        overrides: courseOutcomeRows,
      })
      const [paperRow] = await context.db
        .select()
        .from(offeringQuestionPapers)
        .where(and(
          eq(offeringQuestionPapers.offeringId, params.offeringId),
          eq(offeringQuestionPapers.kind, params.kind),
        ))
      const blueprint = paperRow
        ? termTestBlueprintSchema.parse(parseJson(paperRow.blueprintJson, {}))
        : buildDefaultQuestionPaper(params.kind, resolvedOutcomes)
      for (const leaf of flattenTermTestLeaves(blueprint.nodes)) {
        allowedComponents.set(leaf.id, { maxScore: leaf.maxMarks, storageType: `${params.kind}_leaf` })
      }
    } else if (params.kind === 'quiz') {
      scheme.quizComponents.forEach((component, index) => {
        allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `quiz${index + 1}` })
      })
    } else if (params.kind === 'assignment') {
      scheme.assignmentComponents.forEach((component, index) => {
        allowedComponents.set(component.id, { maxScore: component.rawMax, storageType: `asgn${index + 1}` })
      })
    } else {
      allowedComponents.set('see', { maxScore: scheme.finalsMax, storageType: 'sem_end' })
    }

    for (const entry of body.entries) {
      const enrollment = await assertStudentEnrolledInOffering(context, offering, entry.studentId)
      let aggregateScore = 0
      let aggregateMax = 0
      for (const component of entry.components) {
        const allowed = allowedComponents.get(component.componentCode)
        if (!allowed) {
          throw badRequest('Assessment entry references a component outside the configured scheme', {
            componentCode: component.componentCode,
            kind: params.kind,
          })
        }
        if (component.maxScore > allowed.maxScore || component.score > component.maxScore) {
          throw badRequest('Assessment entry exceeds the configured component max score', {
            componentCode: component.componentCode,
            allowedMax: allowed.maxScore,
          })
        }
        aggregateScore += component.score
        aggregateMax += component.maxScore
        await context.db.insert(studentAssessmentScores).values({
          assessmentScoreId: createId('assessment'),
          studentId: enrollment.studentId,
          offeringId: params.offeringId,
          termId: term.termId,
          componentType: allowed.storageType,
          componentCode: component.componentCode,
          score: component.score,
          maxScore: component.maxScore,
          evaluatedAt,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (params.kind === 'tt1' || params.kind === 'tt2') {
        await context.db.insert(studentAssessmentScores).values({
          assessmentScoreId: createId('assessment'),
          studentId: enrollment.studentId,
          offeringId: params.offeringId,
          termId: term.termId,
          componentType: params.kind,
          componentCode: null,
          score: aggregateScore,
          maxScore: aggregateMax,
          evaluatedAt,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    if (params.kind === 'tt1' || params.kind === 'tt2' || body.lock) {
      const nextOfferingPatch: Partial<typeof sectionOfferings.$inferInsert> = {
        ...(params.kind === 'tt1' ? { tt1Done: 1 } : {}),
        ...(params.kind === 'tt2' ? { tt2Done: 1 } : {}),
        version: offering.version + 1,
        updatedAt: now,
      }
      if (body.lock && lockField) nextOfferingPatch[lockField] = 1
      if (Object.keys(nextOfferingPatch).length > 0) {
        await context.db.update(sectionOfferings).set(nextOfferingPatch).where(eq(sectionOfferings.offeringId, params.offeringId))
      }
    }

    await emitAuditEvent(context, {
      entityType: 'offering_assessment_commit',
      entityId: `${params.offeringId}:${params.kind}`,
      action: 'UPSERT',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      metadata: {
        kind: params.kind,
        offeringId: params.offeringId,
        entryCount: body.entries.length,
        evaluatedAt,
        locked: !!body.lock,
      },
    })
    return {
      ok: true,
      offeringId: params.offeringId,
      kind: params.kind,
      evaluatedAt,
      locked: !!body.lock,
    }
  })

  app.put('/api/academic/offerings/:offeringId/scheme', {
    schema: {
      tags: ['academic'],
      summary: 'Persist the authoritative assessment scheme for an offering',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(offeringParamsSchema, request.params)
    const body = parseOrThrow(offeringSchemeUpsertSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, term } = await getOfferingContext(context, params.offeringId)
    const policy = term.batchId ? (await resolveBatchPolicy(context, term.batchId)).effectivePolicy : DEFAULT_POLICY
    const canonicalScheme = canonicalizeSchemeState(body.scheme, policy)
    validateSchemeAgainstPolicy(canonicalScheme, policy)
    const now = context.now()
    const [current] = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))

    if (current) {
      await context.db.update(offeringAssessmentSchemes).set({
        configuredByFacultyId: auth.facultyId,
        schemeJson: stringifyJson(canonicalScheme),
        policySnapshotJson: stringifyJson(policy),
        status: current.status,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))
    } else {
      await context.db.insert(offeringAssessmentSchemes).values({
        offeringId: offering.offeringId,
        configuredByFacultyId: auth.facultyId,
        schemeJson: stringifyJson(canonicalScheme),
        policySnapshotJson: stringifyJson(policy),
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const [saved] = await context.db
      .select()
      .from(offeringAssessmentSchemes)
      .where(eq(offeringAssessmentSchemes.offeringId, params.offeringId))

    const previousScheme = current
      ? schemeStateSchema.safeParse(parseJson(current.schemeJson, {}))
      : null
    await emitAuditEvent(context, {
      entityType: 'offering_assessment_scheme',
      entityId: params.offeringId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: previousScheme?.success ? canonicalizeSchemeState(previousScheme.data, policy) : null,
      after: canonicalScheme,
      metadata: { offeringId: params.offeringId },
    })

    return {
      offeringId: saved.offeringId,
      scheme: canonicalizeSchemeState(schemeStateSchema.parse(parseJson(saved.schemeJson, {})), policy),
      version: saved.version,
      policySnapshot: parseJson(saved.policySnapshotJson, {}),
    }
  })

  app.put('/api/academic/offerings/:offeringId/question-papers/:kind', {
    schema: {
      tags: ['academic'],
      summary: 'Persist an offering-owned question paper blueprint',
    },
  }, async request => {
    const auth = requireRole(request, ['COURSE_LEADER'])
    if (!auth.facultyId) throw forbidden('Faculty context is required')
    const params = parseOrThrow(questionPaperParamsSchema, request.params)
    const body = parseOrThrow(offeringQuestionPaperUpsertSchema, request.body)
    await assertCourseLeaderCanManageOffering(context, auth.facultyId, params.offeringId)
    const { offering, course, term, department } = await getOfferingContext(context, params.offeringId)
    const rows = await context.db
      .select()
      .from(courseOutcomeOverrides)
      .where(and(
        eq(courseOutcomeOverrides.courseId, offering.courseId),
        eq(courseOutcomeOverrides.status, 'active'),
      ))
    const resolvedOutcomes = resolveCourseOutcomesForOffering({
      institutionId: department.institutionId,
      branchId: offering.branchId,
      batchId: term.batchId,
      offeringId: offering.offeringId,
      courseId: offering.courseId,
      courseCode: course.courseCode,
      courseTitle: course.title,
      overrides: rows,
    })
    validateQuestionPaperBlueprint(params.kind, body.blueprint, new Set(resolvedOutcomes.map(item => item.id)))
    const now = context.now()
    const [current] = await context.db
      .select()
      .from(offeringQuestionPapers)
      .where(and(
        eq(offeringQuestionPapers.offeringId, params.offeringId),
        eq(offeringQuestionPapers.kind, params.kind),
      ))

    if (current) {
      await context.db.update(offeringQuestionPapers).set({
        blueprintJson: stringifyJson(body.blueprint),
        updatedByFacultyId: auth.facultyId,
        version: current.version + 1,
        updatedAt: now,
      }).where(eq(offeringQuestionPapers.paperId, current.paperId))
    } else {
      await context.db.insert(offeringQuestionPapers).values({
        paperId: createId('question_paper'),
        offeringId: params.offeringId,
        kind: params.kind,
        blueprintJson: stringifyJson(body.blueprint),
        updatedByFacultyId: auth.facultyId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    }

    const [saved] = await context.db
      .select()
      .from(offeringQuestionPapers)
      .where(and(
        eq(offeringQuestionPapers.offeringId, params.offeringId),
        eq(offeringQuestionPapers.kind, params.kind),
      ))

    const previousBlueprint = current
      ? termTestBlueprintSchema.safeParse(parseJson(current.blueprintJson, {}))
      : null
    await emitAuditEvent(context, {
      entityType: 'offering_question_paper',
      entityId: saved.paperId,
      action: current ? 'UPDATE' : 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
      before: previousBlueprint?.success ? previousBlueprint.data : null,
      after: body.blueprint,
      metadata: { offeringId: params.offeringId, kind: params.kind },
    })

    return {
      paperId: saved.paperId,
      offeringId: saved.offeringId,
      kind: saved.kind,
      blueprint: termTestBlueprintSchema.parse(parseJson(saved.blueprintJson, {})),
      version: saved.version,
    }
  })
}
