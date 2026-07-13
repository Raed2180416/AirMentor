/**
 * Runtime-shadow projection helpers shared by the tasks / task-placements /
 * calendar-audit use-cases. These maintain the legacy JSON runtime-state
 * "shadow" alongside the authoritative tables and emit drift telemetry.
 *
 * Moved verbatim from modules/academic-runtime-routes.ts; the shared
 * runtime-state accessors and row mappers arrive through the injected deps
 * bundle instead of `context` + destructured `deps`.
 */
import { emitOperationalEvent } from '../../../lib/telemetry.js'
import type {
  AcademicTaskRow,
  AcademicTaskTransitionRow,
} from '../../ports/academic-runtime-repository.js'
import type { AcademicRuntimeUseCaseDeps } from './deps.js'

export function taskRecordWithVersion(
  deps: AcademicRuntimeUseCaseDeps,
  row: AcademicTaskRow,
  transitionRows: AcademicTaskTransitionRow[],
) {
  return {
    ...deps.mapAcademicTaskRow(row, transitionRows.map(deps.mapTaskTransitionRow)),
    version: row.version,
  }
}

export async function syncRuntimeTaskShadow(
  deps: AcademicRuntimeUseCaseDeps,
  record: ReturnType<typeof taskRecordWithVersion>,
  options: { writeRuntimeShadow?: boolean } = {},
) {
  if (options.writeRuntimeShadow === false) return record as Record<string, unknown>
  const { version: _version, ...runtimeComparableTask } = record
  const currentTasks = await deps.getAcademicRuntimeState('tasks') as Array<Record<string, unknown>>
  const nextTasks = currentTasks.slice()
  const currentIndex = nextTasks.findIndex(task => task.id === runtimeComparableTask.id)
  if (currentIndex >= 0) {
    nextTasks[currentIndex] = runtimeComparableTask
  } else {
    nextTasks.push(runtimeComparableTask)
  }
  const savedTasks = await deps.saveAcademicRuntimeState('tasks', nextTasks) as Array<Record<string, unknown>>

  const currentResolvedTasks = await deps.getAcademicRuntimeState('resolvedTasks') as Record<string, number>
  const nextResolvedTasks = { ...currentResolvedTasks }
  if (record.status === 'Resolved') {
    nextResolvedTasks[record.id] = record.updatedAt ?? record.createdAt
  } else {
    delete nextResolvedTasks[record.id]
  }
  await deps.saveAcademicRuntimeState('resolvedTasks', nextResolvedTasks)
  return (savedTasks.find(task => task.id === runtimeComparableTask.id) ?? runtimeComparableTask) as Record<string, unknown>
}

export async function syncRuntimeTaskPlacementShadow(
  deps: AcademicRuntimeUseCaseDeps,
  taskId: string,
  placement: ReturnType<AcademicRuntimeUseCaseDeps['mapTaskPlacementRow']> | null,
  options: { writeRuntimeShadow?: boolean } = {},
) {
  if (options.writeRuntimeShadow === false) return placement
  const currentPlacements = await deps.getAcademicRuntimeState('taskPlacements') as Record<string, unknown>
  const nextPlacements = { ...currentPlacements }
  if (placement) {
    nextPlacements[taskId] = placement
  } else {
    delete nextPlacements[taskId]
  }
  const savedPlacements = await deps.saveAcademicRuntimeState('taskPlacements', nextPlacements) as Record<string, unknown>
  return (savedPlacements[taskId] ?? null) as ReturnType<AcademicRuntimeUseCaseDeps['mapTaskPlacementRow']> | null
}

export async function syncRuntimeCalendarAuditShadow(
  deps: AcademicRuntimeUseCaseDeps,
  event: ReturnType<AcademicRuntimeUseCaseDeps['mapCalendarAuditEventRow']>,
  options: { writeRuntimeShadow?: boolean } = {},
) {
  if (!event || options.writeRuntimeShadow === false) return event
  const currentEvents = await deps.getAcademicRuntimeState('calendarAudit') as Array<Record<string, unknown>>
  const nextEvents = currentEvents.slice()
  const currentIndex = nextEvents.findIndex(item => item.id === event.id)
  if (currentIndex >= 0) {
    nextEvents[currentIndex] = event
  } else {
    nextEvents.push(event)
  }
  const savedEvents = await deps.saveAcademicRuntimeState('calendarAudit', nextEvents) as Array<Record<string, unknown>>
  return (savedEvents.find(item => item.id === event.id) ?? event) as ReturnType<AcademicRuntimeUseCaseDeps['mapCalendarAuditEventRow']>
}

export async function maybeEmitRuntimeShadowDrift(
  deps: AcademicRuntimeUseCaseDeps,
  stateKey: 'tasks' | 'taskPlacements' | 'calendarAudit',
  entityId: string,
  authoritativeEntity: unknown,
) {
  const runtime = await deps.getAcademicRuntimeState(stateKey)
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

export async function upsertStudentPatchShadow(
  deps: AcademicRuntimeUseCaseDeps,
  nextPatchesByKey: Record<string, Record<string, unknown>>,
) {
  if (Object.keys(nextPatchesByKey).length === 0) return
  const currentStudentPatches = await deps.getAcademicRuntimeState('studentPatches') as Record<string, Record<string, unknown>>
  const mergedStudentPatches = { ...currentStudentPatches }
  for (const [patchKey, patchValue] of Object.entries(nextPatchesByKey)) {
    const nextPatch = {
      ...(currentStudentPatches[patchKey] ?? {}),
    }
    for (const [field, value] of Object.entries(patchValue)) {
      if (value === null) delete nextPatch[field]
      else nextPatch[field] = value
    }
    if (Object.keys(nextPatch).length === 0) delete mergedStudentPatches[patchKey]
    else mergedStudentPatches[patchKey] = nextPatch
  }
  await deps.saveAcademicRuntimeState('studentPatches', mergedStudentPatches)
}
