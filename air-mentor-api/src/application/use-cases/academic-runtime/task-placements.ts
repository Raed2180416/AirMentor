/**
 * Academic task-placement use-cases: authoritative persistence + delete plus the
 * compatibility sync / single-upsert / list operations.
 *
 * Moved verbatim from modules/academic-runtime-routes.ts; DB access goes through
 * the repository and the shared academic functions arrive via the deps bundle.
 * Optimistic-concurrency (expectedUpdatedAt) checks, shadow writes, and audit
 * metadata are unchanged.
 */
import { badRequest, conflict, forbidden, notFound } from '../../../lib/http-errors.js'
import { parseJson } from '../../../lib/json.js'
import { parseOrThrow } from '../../../modules/support.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import { taskPayloadWithPlacementDate } from './task-payload.js'
import {
  maybeEmitRuntimeShadowDrift,
  syncRuntimeTaskPlacementShadow,
  syncRuntimeTaskShadow,
  taskRecordWithVersion,
} from './runtime-shadow.js'
import { listVisibleTaskRecords } from './tasks.js'

export type PersistPlacementOptions = {
  expectedUpdatedAt?: number
  emitShadowDrift?: boolean
  writeRuntimeShadow?: boolean
}

export async function persistAcademicTaskPlacement(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  placementInput: unknown,
  options: PersistPlacementOptions = {},
) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const parsed = parseOrThrow(deps.taskPlacementSyncSchema, {
    placements: {
      [String((placementInput as { taskId?: string })?.taskId ?? '')]: placementInput,
    },
  })
  const placement = Object.values(parsed.placements)[0]
  const taskRow = await deps.repo.getTaskById(placement.taskId)
  if (!taskRow) throw notFound('Task not found for placement')
  const task = deps.mapAcademicTaskRow(taskRow, [])
  await deps.assertViewerCanManageTask(auth, task)
  if (placement.placementMode === 'timed') {
    if (
      typeof placement.startMinutes !== 'number'
      || typeof placement.endMinutes !== 'number'
      || placement.startMinutes >= placement.endMinutes
    ) {
      throw badRequest('Timed task placements must include a valid start and end range')
    }
  }
  const now = deps.now()
  const nowMillis = Date.parse(now)
  const currentPayload = parseJson(taskRow.payloadJson, {} as Record<string, unknown>)
  const currentPayloadDueDateISO = typeof currentPayload.dueDateISO === 'string' ? currentPayload.dueDateISO : null
  const currentScheduleMeta = currentPayload.scheduleMeta
  const currentScheduleDueDateISO = currentScheduleMeta && typeof currentScheduleMeta === 'object' && !Array.isArray(currentScheduleMeta)
    && typeof (currentScheduleMeta as Record<string, unknown>).nextDueDateISO === 'string'
    ? String((currentScheduleMeta as Record<string, unknown>).nextDueDateISO)
    : null
  const current = await deps.repo.getPlacementByTaskId(placement.taskId)
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
  const fields = {
    facultyId: auth.facultyId,
    dateIso: placement.dateISO,
    placementMode: placement.placementMode,
    startMinutes: placement.startMinutes ?? null,
    endMinutes: placement.endMinutes ?? null,
    slotId: placement.slotId ?? null,
    startTime: placement.startTime ?? null,
    endTime: placement.endTime ?? null,
  }
  if (current) {
    await deps.repo.updatePlacement(placement.taskId, fields, now)
  } else {
    await deps.repo.insertPlacement(placement.taskId, fields, now)
  }
  let runtimeTaskShadow: Record<string, unknown> | null = null
  if (
    taskRow.dueDateIso !== placement.dateISO
    || currentPayloadDueDateISO !== placement.dateISO
    || currentScheduleDueDateISO !== placement.dateISO
  ) {
    await deps.repo.updateTaskDueDate(placement.taskId, {
      dueDateIso: placement.dateISO,
      payloadJson: taskPayloadWithPlacementDate(taskRow.payloadJson, placement.dateISO, Number.isFinite(nowMillis) ? nowMillis : Date.now()),
      updatedByFacultyId: auth.facultyId,
      updatedAt: now,
    })
    const storedTask = await deps.repo.getTaskById(placement.taskId)
    if (storedTask) {
      const storedTransitions = await deps.repo.getTaskTransitionsOrderedAsc(placement.taskId)
      runtimeTaskShadow = await syncRuntimeTaskShadow(deps, taskRecordWithVersion(deps, storedTask, storedTransitions), {
        writeRuntimeShadow: options.writeRuntimeShadow ?? true,
      }) as Record<string, unknown>
    }
  }
  const storedPlacement = await deps.repo.getPlacementByTaskId(placement.taskId)
  if (!storedPlacement) throw notFound('Task placement not found after save')
  const record = deps.mapTaskPlacementRow(storedPlacement)
  const runtimePlacementShadow = await syncRuntimeTaskPlacementShadow(deps, placement.taskId, record, {
    writeRuntimeShadow: options.writeRuntimeShadow ?? true,
  })
  await deps.emitAudit({
    entityType: 'academic_task_placement',
    entityId: placement.taskId,
    action: current ? 'UPSERT' : 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
    metadata: { updatedAt: record.updatedAt },
  })
  if (options.emitShadowDrift) {
    if (runtimeTaskShadow) {
      await maybeEmitRuntimeShadowDrift(deps, 'tasks', placement.taskId, runtimeTaskShadow)
    }
    await maybeEmitRuntimeShadowDrift(deps, 'taskPlacements', placement.taskId, runtimePlacementShadow)
  }
  return {
    placement: record,
    created: !current,
  }
}

export async function deleteAcademicTaskPlacement(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  taskId: string,
  expectedUpdatedAt?: number,
) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const taskRow = await deps.repo.getTaskById(taskId)
  if (!taskRow) throw notFound('Task not found for placement')
  const task = deps.mapAcademicTaskRow(taskRow, [])
  await deps.assertViewerCanManageTask(auth, task)
  const current = await deps.repo.getPlacementByTaskId(taskId)
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
  await deps.repo.deletePlacement(taskId)
  const runtimePlacementShadow = await syncRuntimeTaskPlacementShadow(deps, taskId, null, {
    writeRuntimeShadow: false,
  })
  await deps.emitAudit({
    entityType: 'academic_task_placement',
    entityId: taskId,
    action: 'DELETE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
  })
  await maybeEmitRuntimeShadowDrift(deps, 'taskPlacements', taskId, runtimePlacementShadow)
  return { ok: true as const, taskId, deleted: true }
}

/** PUT /api/academic/task-placements/sync loop body (facultyId guarded by controller). */
export async function syncTaskPlacements(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  body: { placements: Record<string, { taskId: string }> },
) {
  for (const [taskId, placement] of Object.entries(body.placements)) {
    if (placement.taskId !== taskId) throw badRequest('Task placement payload does not match its record key')
    await persistAcademicTaskPlacement(deps, auth, placement)
  }
  await deps.emitAudit({
    entityType: 'academic_task_placement_sync',
    entityId: facultyId,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    metadata: { placementCount: Object.keys(body.placements).length },
  })
  return { ok: true, count: Object.keys(body.placements).length }
}

/** PUT /api/academic/task-placements/:taskId body. */
export async function putSinglePlacement(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  taskId: string,
  body: { placement: unknown; expectedUpdatedAt?: number },
) {
  const parsed = parseOrThrow(deps.taskPlacementSyncSchema, {
    placements: {
      [taskId]: body.placement,
    },
  })
  const placement = parsed.placements[taskId]
  if (!placement || placement.taskId !== taskId) {
    throw badRequest('Task placement payload does not match the requested task id')
  }
  return persistAcademicTaskPlacement(deps, auth, placement, {
    expectedUpdatedAt: body.expectedUpdatedAt,
    writeRuntimeShadow: false,
  })
}

/** GET /api/academic/task-placements. */
export async function listVisibleTaskPlacements(deps: AcademicRuntimeUseCaseDeps, auth: RuntimeAuth) {
  const visibleTasks = await listVisibleTaskRecords(deps, auth)
  const visibleTaskIds = new Set(visibleTasks.map(task => task.id))
  const placementRows = await deps.repo.listAllPlacements()
  return {
    items: placementRows
      .filter(row => visibleTaskIds.has(row.taskId))
      .map(row => deps.mapTaskPlacementRow(row)),
  }
}
