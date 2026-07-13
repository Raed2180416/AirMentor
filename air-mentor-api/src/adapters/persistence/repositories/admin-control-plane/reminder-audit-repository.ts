/**
 * Drizzle access for private reminders and recent audit events. Reminder rows
 * are mapped to the domain shape (mapReminder, moved verbatim); recent audit
 * rows are returned raw for the controller-injected mapAuditEvent to format.
 */
import { asc, desc, eq } from 'drizzle-orm'
import { adminReminders, auditEvents } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { createId } from '../../../../lib/ids.js'
import type { AuditEventRow, Reminder } from '../../../../application/use-cases/admin-control-plane/reminder-audit-domain.js'
import type {
  CreateReminderInput,
  UpdateReminderInput,
} from '../../../../application/ports/admin-control-plane-repository.js'

function mapReminder(row: typeof adminReminders.$inferSelect): Reminder {
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

export function listRecentAuditEvents(db: AppDb, limit: number): Promise<AuditEventRow[]> {
  return db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
}

export function listReminders(db: AppDb, facultyId: string): Promise<Reminder[]> {
  return db
    .select()
    .from(adminReminders)
    .where(eq(adminReminders.facultyId, facultyId))
    .orderBy(asc(adminReminders.dueAt))
    .then(rows => rows.map(mapReminder))
}

export async function createReminder(db: AppDb, now: () => string, input: CreateReminderInput): Promise<Reminder> {
  const created = {
    reminderId: createId('admin_reminder'),
    facultyId: input.facultyId,
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    status: input.status,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.insert(adminReminders).values(created)
  return mapReminder(created)
}

export async function getReminderById(db: AppDb, reminderId: string): Promise<Reminder | null> {
  const [current] = await db.select().from(adminReminders).where(eq(adminReminders.reminderId, reminderId))
  return current ? mapReminder(current) : null
}

export async function updateReminder(db: AppDb, now: () => string, input: UpdateReminderInput): Promise<Reminder> {
  await db.update(adminReminders).set({
    title: input.title,
    body: input.body,
    dueAt: input.dueAt,
    status: input.status,
    version: input.currentVersion + 1,
    updatedAt: now(),
  }).where(eq(adminReminders.reminderId, input.reminderId))
  const [next] = await db.select().from(adminReminders).where(eq(adminReminders.reminderId, input.reminderId))
  return mapReminder(next)
}
