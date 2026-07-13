/**
 * Calendar-audit event use-cases (append / sync / list) plus the faculty-owned
 * timetable workspace upsert. Moved verbatim from
 * modules/academic-runtime-routes.ts; DB access goes through the repository and
 * the shared academic functions arrive via the deps bundle.
 */
import { conflict, forbidden } from '../../../lib/http-errors.js'
import { stringifyJson } from '../../../lib/json.js'
import { parseOrThrow } from '../../../modules/support.js'
import type { AcademicRuntimeUseCaseDeps, RuntimeAuth } from './deps.js'
import {
  maybeEmitRuntimeShadowDrift,
  syncRuntimeCalendarAuditShadow,
} from './runtime-shadow.js'

export type AppendCalendarAuditOptions = {
  emitShadowDrift?: boolean
  writeRuntimeShadow?: boolean
}

export async function appendAcademicCalendarAuditEvent(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  eventInput: unknown,
  options: AppendCalendarAuditOptions = {},
) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const parsed = parseOrThrow(deps.calendarAuditSyncSchema, { events: [eventInput] })
  const event = parsed.events[0]
  if (event.facultyId !== auth.facultyId) {
    throw forbidden('Calendar audit events can only be persisted for the active faculty')
  }
  const current = await deps.repo.getCalendarAuditEventById(event.id)
  const currentEvent = current ? deps.mapCalendarAuditEventRow(current) : null
  if (currentEvent && stringifyJson(currentEvent) !== stringifyJson(event)) {
    throw conflict('Calendar audit event already exists with different payload', currentEvent)
  }
  if (!current) {
    await deps.repo.insertCalendarAuditEvent(
      event.id,
      auth.facultyId,
      stringifyJson(event),
      deps.millisToIso(event.timestamp, deps.now()),
    )
    await deps.emitAudit({
      entityType: 'academic_calendar_audit_event',
      entityId: event.id,
      action: 'CREATE',
      actorRole: auth.activeRoleGrant.roleCode,
      actorId: auth.facultyId,
    })
  }
  const stored = currentEvent ?? event
  const runtimeCalendarAuditShadow = await syncRuntimeCalendarAuditShadow(deps, stored, {
    writeRuntimeShadow: options.writeRuntimeShadow ?? true,
  })
  if (options.emitShadowDrift) {
    await maybeEmitRuntimeShadowDrift(deps, 'calendarAudit', event.id, runtimeCalendarAuditShadow)
  }
  return {
    event: stored,
    created: !current,
  }
}

/** PUT /api/academic/calendar-audit/sync loop body. */
export async function syncCalendarAudit(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  body: { events: unknown[] },
) {
  for (const event of body.events) {
    await appendAcademicCalendarAuditEvent(deps, auth, event)
  }
  return { ok: true, count: body.events.length }
}

/** GET /api/academic/calendar-audit. */
export async function listCalendarAudit(deps: AcademicRuntimeUseCaseDeps, auth: RuntimeAuth) {
  if (!auth.facultyId) throw forbidden('Faculty context is required')
  const rows = await deps.repo.listCalendarAuditEventsByFaculty(auth.facultyId)
  return {
    items: rows.flatMap(row => {
      const parsed = deps.mapCalendarAuditEventRow(row)
      return parsed ? [parsed] : []
    }),
  }
}

/** PUT /api/academic/faculty-calendar-workspace/:facultyId. */
export async function saveFacultyCalendarWorkspace(
  deps: AcademicRuntimeUseCaseDeps,
  auth: RuntimeAuth,
  facultyId: string,
  targetFacultyId: string,
  template: Parameters<AcademicRuntimeUseCaseDeps['validateFacultyCalendarTemplate']>[1],
) {
  if (facultyId !== targetFacultyId) {
    throw forbidden('You can only edit your own timetable workspace')
  }
  await deps.validateFacultyCalendarTemplate(targetFacultyId, template)
  const { directEditWindowEndsAt, classEditingLocked } = await deps.getEditableCalendarWindowStatus(targetFacultyId)
  const current = await deps.repo.getFacultyCalendarWorkspace(targetFacultyId)
  const currentTemplate = current ? deps.mapFacultyCalendarWorkspaceRow(current) : null
  if (classEditingLocked && stringifyJson(currentTemplate) !== stringifyJson(template)) {
    throw forbidden('The direct class editing window has ended for this faculty timetable')
  }

  const now = deps.now()
  if (current) {
    await deps.repo.updateFacultyCalendarWorkspace(targetFacultyId, stringifyJson(template), current.version + 1, now)
  } else {
    await deps.repo.insertFacultyCalendarWorkspace(targetFacultyId, stringifyJson(template), now, now)
  }

  const timetablePayload = await deps.getAcademicRuntimeState('timetableByFacultyId') as Record<string, unknown>
  await deps.saveAcademicRuntimeState('timetableByFacultyId', {
    ...timetablePayload,
    [targetFacultyId]: template,
  })

  const saved = await deps.repo.getFacultyCalendarWorkspace(targetFacultyId)
  await deps.emitAudit({
    entityType: 'faculty_calendar_workspace',
    entityId: targetFacultyId,
    action: current ? 'UPDATE' : 'CREATE',
    actorRole: auth.activeRoleGrant.roleCode,
    actorId: facultyId,
    before: currentTemplate,
    after: template,
    metadata: { directEditWindowEndsAt, classEditingLocked },
  })
  return {
    facultyId: targetFacultyId,
    template,
    version: saved?.version ?? 1,
    directEditWindowEndsAt,
    classEditingLocked,
  }
}
