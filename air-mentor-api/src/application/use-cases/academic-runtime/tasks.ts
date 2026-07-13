/**
 * Academic tasks use-cases: authoritative persistence for the action-queue
 * projection plus the compatibility sync / single-upsert / list operations.
 *
 * Moved verbatim from modules/academic-runtime-routes.ts: `context.db.*` access
 * is delegated to the injected repository, and the shared academic functions
 * (mappers, scope guards, runtime-state accessors, audit emit) arrive through
 * the deps bundle. Behaviour — validation, ordering, error strings, shadow
 * writes, audit metadata — is unchanged.
 */
import { badRequest, forbidden, notFound } from '../../../lib/http-errors.js'
import { stringifyJson } from '../../../lib/json.js'
import { expectVersion, parseOrThrow } from '../../../modules/support.js'
import type { AcademicTaskTransitionRow } from '../../ports/academic-runtime-repository.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import {
  maybeEmitRuntimeShadowDrift,
  syncRuntimeTaskShadow,
  taskRecordWithVersion,
} from './runtime-shadow.js'

export type PersistTaskOptions = {
  expectedVersion?: number
  emitShadowDrift?: boolean
  writeRuntimeShadow?: boolean
}

export async function persistAcademicTask(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  taskInput: unknown,
  options: PersistTaskOptions = {},
) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const parsed = parseOrThrow(deps.taskSyncSchema, { tasks: [taskInput] })
  const task = parsed.tasks[0]
  const normalizedTask = {
    ...task,
    studentId: deps.normalizeAcademicStudentId(task.studentId),
  }
  await deps.assertViewerCanManageTask(auth, normalizedTask)
  const now = deps.now()
  const current = await deps.repo.getTaskById(task.id)
  if (!current && typeof options.expectedVersion === 'number') {
    throw badRequest('Expected version can only be supplied for an existing task')
  }
  if (current && typeof options.expectedVersion === 'number') {
    expectVersion(current.version, options.expectedVersion, 'academic task', {
      taskId: task.id,
      version: current.version,
    })
  }
  const fields = {
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
  }
  if (current) {
    const currentTransitions = await deps.repo.getTaskTransitionsOrderedAsc(task.id)
    const currentTask = deps.mapAcademicTaskRow(current, currentTransitions.map(deps.mapTaskTransitionRow))
    if (currentTask.dismissal && !task.dismissal) {
      const restoreWindowEndsAt = currentTask.dismissal.dismissedAt + (60 * 24 * 60 * 60 * 1000)
      if (restoreWindowEndsAt < Date.now()) {
        throw forbidden('The restore window for this queue item has expired')
      }
    }
    await deps.repo.updateTask(task.id, fields, current.version + 1, now)
  } else {
    await deps.repo.insertTask(task.id, fields, auth.facultyId, now, now)
  }

  const existingTransitions = await deps.repo.getTaskTransitions(task.id)
  const existingTransitionIds = new Set(existingTransitions.map(row => row.transitionId))
  const missingTransitions = (task.transitionHistory ?? []).filter(transition => !existingTransitionIds.has(transition.id))
  for (const transition of missingTransitions) {
    await deps.repo.insertTaskTransition({
      transitionId: transition.id,
      taskId: task.id,
      actorRole: transition.actorRole,
      actorFacultyId: transition.actorTeacherId ?? null,
      action: transition.action,
      fromOwner: transition.fromOwner ?? null,
      toOwner: transition.toOwner,
      note: transition.note,
      occurredAt: deps.millisToIso(transition.at, now),
    })
  }

  const storedTask = await deps.repo.getTaskById(task.id)
  if (!storedTask) throw notFound('Task not found after save')
  const storedTransitions = await deps.repo.getTaskTransitionsOrderedAsc(task.id)
  const record = taskRecordWithVersion(deps, storedTask, storedTransitions)
  const runtimeTaskShadow = await syncRuntimeTaskShadow(deps, record, {
    writeRuntimeShadow: options.writeRuntimeShadow ?? true,
  })
  await deps.emitAudit({
    entityType: 'academic_task',
    entityId: task.id,
    action: current ? 'UPSERT' : 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: auth.facultyId,
    metadata: { version: record.version },
  })
  if (options.emitShadowDrift) {
    await maybeEmitRuntimeShadowDrift(deps, 'tasks', task.id, runtimeTaskShadow)
  }
  return {
    task: record,
    created: !current,
  }
}

export async function listVisibleTaskRecords(deps: AcademicRuntimeUseCaseDeps, auth: RuntimeAuth) {
  const [taskRows, transitionRows] = await Promise.all([
    deps.repo.listAllTasks(),
    deps.repo.listAllTaskTransitionsOrderedAsc(),
  ])
  const transitionsByTaskId = new Map<string, AcademicTaskTransitionRow[]>()
  for (const transitionRow of transitionRows) {
    const current = transitionsByTaskId.get(transitionRow.taskId) ?? []
    current.push(transitionRow)
    transitionsByTaskId.set(transitionRow.taskId, current)
  }
  const visibleItems: Array<ReturnType<typeof taskRecordWithVersion>> = []
  for (const row of taskRows) {
    const record = taskRecordWithVersion(deps, row, transitionsByTaskId.get(row.taskId) ?? [])
    try {
      await deps.assertViewerCanManageTask(auth, record)
      visibleItems.push(record)
    } catch {
      // Ignore tasks outside the active teaching scope.
    }
  }
  return visibleItems
}

/** PUT /api/academic/tasks/sync loop body (facultyId is guarded by the controller). */
export async function syncTasks(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  body: { tasks: unknown[] },
) {
  for (const task of body.tasks) {
    await persistAcademicTask(deps, auth, task)
  }
  await deps.emitAudit({
    entityType: 'academic_task_sync',
    entityId: facultyId,
    action: 'UPSERT',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    metadata: { taskCount: body.tasks.length },
  })
  return { ok: true, count: body.tasks.length }
}

/** PUT /api/academic/tasks/:taskId body. */
export async function putSingleTask(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  taskId: string,
  body: { task: unknown; expectedVersion?: number },
) {
  const parsed = parseOrThrow(deps.taskSyncSchema, { tasks: [body.task] })
  const task = parsed.tasks[0]
  if (task.id !== taskId) {
    throw badRequest('Task payload does not match the requested task id')
  }
  return persistAcademicTask(deps, auth, task, {
    expectedVersion: body.expectedVersion,
    writeRuntimeShadow: false,
  })
}
