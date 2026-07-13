/**
 * Drizzle data access for academic task placements.
 *
 * Queries are moved verbatim from modules/academic-runtime-routes.ts
 * (`context.db` -> injected `db`); `updatedAt` is passed in so the single
 * `context.now()` capture per operation is preserved.
 */
import { eq } from 'drizzle-orm'
import { academicTaskPlacements } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  AcademicTaskPlacementRow,
  UpsertTaskPlacementFields,
} from '../../../../application/ports/academic-runtime-repository.js'

export async function getPlacementByTaskId(db: AppDb, taskId: string): Promise<AcademicTaskPlacementRow | undefined> {
  const [row] = await db.select().from(academicTaskPlacements).where(eq(academicTaskPlacements.taskId, taskId))
  return row
}

export function listAllPlacements(db: AppDb): Promise<AcademicTaskPlacementRow[]> {
  return db.select().from(academicTaskPlacements)
}

export async function updatePlacement(
  db: AppDb,
  taskId: string,
  fields: UpsertTaskPlacementFields,
  updatedAt: string,
): Promise<void> {
  await db.update(academicTaskPlacements).set({
    facultyId: fields.facultyId,
    dateIso: fields.dateIso,
    placementMode: fields.placementMode,
    startMinutes: fields.startMinutes,
    endMinutes: fields.endMinutes,
    slotId: fields.slotId,
    startTime: fields.startTime,
    endTime: fields.endTime,
    updatedAt,
  }).where(eq(academicTaskPlacements.taskId, taskId))
}

export async function insertPlacement(
  db: AppDb,
  taskId: string,
  fields: UpsertTaskPlacementFields,
  updatedAt: string,
): Promise<void> {
  await db.insert(academicTaskPlacements).values({
    taskId,
    facultyId: fields.facultyId,
    dateIso: fields.dateIso,
    placementMode: fields.placementMode,
    startMinutes: fields.startMinutes,
    endMinutes: fields.endMinutes,
    slotId: fields.slotId,
    startTime: fields.startTime,
    endTime: fields.endTime,
    updatedAt,
  })
}

export async function deletePlacement(db: AppDb, taskId: string): Promise<void> {
  await db.delete(academicTaskPlacements).where(eq(academicTaskPlacements.taskId, taskId))
}
