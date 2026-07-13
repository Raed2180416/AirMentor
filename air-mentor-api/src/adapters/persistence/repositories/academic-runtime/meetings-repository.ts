/**
 * Drizzle data access for academic meetings. Queries are moved verbatim from
 * modules/academic-runtime-routes.ts (`context.db` -> injected `db`).
 */
import { eq } from 'drizzle-orm'
import { academicMeetings } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  AcademicMeetingRow,
  InsertMeetingInput,
  UpdateMeetingFields,
} from '../../../../application/ports/academic-runtime-repository.js'

export async function insertMeeting(
  db: AppDb,
  input: InsertMeetingInput,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(academicMeetings).values({
    meetingId: input.meetingId,
    facultyId: input.facultyId,
    studentId: input.studentId,
    offeringId: input.offeringId,
    title: input.title,
    notes: input.notes,
    dateIso: input.dateIso,
    startMinutes: input.startMinutes,
    endMinutes: input.endMinutes,
    status: input.status,
    createdByFacultyId: input.createdByFacultyId,
    version: 1,
    createdAt,
    updatedAt,
  })
}

export async function getMeetingById(db: AppDb, meetingId: string): Promise<AcademicMeetingRow | undefined> {
  const [row] = await db
    .select()
    .from(academicMeetings)
    .where(eq(academicMeetings.meetingId, meetingId))
  return row
}

export async function updateMeeting(
  db: AppDb,
  meetingId: string,
  fields: UpdateMeetingFields,
  nextVersion: number,
  updatedAt: string,
): Promise<void> {
  await db.update(academicMeetings).set({
    studentId: fields.studentId,
    offeringId: fields.offeringId,
    title: fields.title,
    notes: fields.notes,
    dateIso: fields.dateIso,
    startMinutes: fields.startMinutes,
    endMinutes: fields.endMinutes,
    status: fields.status,
    version: nextVersion,
    updatedAt,
  }).where(eq(academicMeetings.meetingId, meetingId))
}
