/**
 * GET/POST/PATCH /api/admin/reminders — private reminders for the current
 * system admin. Error paths throw the same AppErrors as the legacy handlers
 * (forbidden / notFound) so the global error handler produces identical
 * responses; the mapped reminder shapes come back from the repository.
 */
import { forbidden, notFound } from '../../../lib/http-errors.js'
import type { AdminControlPlaneRepository } from '../../ports/admin-control-plane-repository.js'
import type { AuditEmitter, UseCaseResponse } from '../curriculum-graph/shared.js'

export type ListRemindersInput = {
  facultyId: string | null
}

export async function listReminders(
  deps: { repo: AdminControlPlaneRepository },
  input: ListRemindersInput,
): Promise<UseCaseResponse> {
  if (!input.facultyId) return { status: 200, body: { items: [] } }
  const items = await deps.repo.listReminders(input.facultyId)
  return { status: 200, body: { items } }
}

export type CreateReminderInput = {
  facultyId: string
  actorRole: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
}

export async function createReminder(
  deps: { repo: AdminControlPlaneRepository; emitAudit: AuditEmitter },
  input: CreateReminderInput,
): Promise<UseCaseResponse> {
  const created = await deps.repo.createReminder({
    facultyId: input.facultyId,
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    status: input.status,
  })
  await deps.emitAudit({
    entityType: 'AdminReminder',
    entityId: created.reminderId,
    action: 'created',
    actorRole: input.actorRole,
    actorId: input.facultyId,
    after: created,
  })
  return { status: 200, body: created }
}

export type UpdateReminderInput = {
  facultyId: string
  actorRole: string
  reminderId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  version: number
}

export async function updateReminder(
  deps: { repo: AdminControlPlaneRepository; emitAudit: AuditEmitter },
  input: UpdateReminderInput,
): Promise<UseCaseResponse> {
  const current = await deps.repo.getReminderById(input.reminderId)
  if (!current || current.facultyId !== input.facultyId) throw notFound('Reminder not found')
  if (current.version !== input.version) throw forbidden('Reminder version is stale')
  const next = await deps.repo.updateReminder({
    reminderId: input.reminderId,
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    status: input.status,
    currentVersion: current.version,
  })
  await deps.emitAudit({
    entityType: 'AdminReminder',
    entityId: input.reminderId,
    action: 'updated',
    actorRole: input.actorRole,
    actorId: input.facultyId,
    before: current,
    after: next,
  })
  return { status: 200, body: next }
}
