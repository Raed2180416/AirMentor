/**
 * Drizzle data access for calendar-audit events and faculty-calendar
 * workspaces. Queries are moved verbatim from
 * modules/academic-runtime-routes.ts (`context.db` -> injected `db`).
 */
import { asc, eq } from 'drizzle-orm'
import {
  academicCalendarAuditEvents,
  facultyCalendarWorkspaces,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  AcademicCalendarAuditEventRow,
  FacultyCalendarWorkspaceRow,
} from '../../../../application/ports/academic-runtime-repository.js'

export async function getCalendarAuditEventById(
  db: AppDb,
  auditEventId: string,
): Promise<AcademicCalendarAuditEventRow | undefined> {
  const [current] = await db
    .select()
    .from(academicCalendarAuditEvents)
    .where(eq(academicCalendarAuditEvents.auditEventId, auditEventId))
  return current
}

export async function insertCalendarAuditEvent(
  db: AppDb,
  auditEventId: string,
  facultyId: string,
  payloadJson: string,
  createdAt: string,
): Promise<void> {
  await db.insert(academicCalendarAuditEvents).values({
    auditEventId,
    facultyId,
    payloadJson,
    createdAt,
  })
}

export function listCalendarAuditEventsByFaculty(
  db: AppDb,
  facultyId: string,
): Promise<AcademicCalendarAuditEventRow[]> {
  return db
    .select()
    .from(academicCalendarAuditEvents)
    .where(eq(academicCalendarAuditEvents.facultyId, facultyId))
    .orderBy(asc(academicCalendarAuditEvents.createdAt))
}

export async function getFacultyCalendarWorkspace(
  db: AppDb,
  facultyId: string,
): Promise<FacultyCalendarWorkspaceRow | undefined> {
  const [current] = await db
    .select()
    .from(facultyCalendarWorkspaces)
    .where(eq(facultyCalendarWorkspaces.facultyId, facultyId))
  return current
}

export async function updateFacultyCalendarWorkspace(
  db: AppDb,
  facultyId: string,
  templateJson: string,
  nextVersion: number,
  updatedAt: string,
): Promise<void> {
  await db.update(facultyCalendarWorkspaces).set({
    templateJson,
    version: nextVersion,
    updatedAt,
  }).where(eq(facultyCalendarWorkspaces.facultyId, facultyId))
}

export async function insertFacultyCalendarWorkspace(
  db: AppDb,
  facultyId: string,
  templateJson: string,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(facultyCalendarWorkspaces).values({
    facultyId,
    templateJson,
    version: 1,
    createdAt,
    updatedAt,
  })
}
