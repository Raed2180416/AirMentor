/**
 * Drizzle data access for academic tasks + task transitions.
 *
 * Queries are moved verbatim from modules/academic-runtime-routes.ts
 * (`context.db` -> injected `db`). Timestamps (`createdAt`/`updatedAt`/
 * `occurredAt`) are passed in so the single `context.now()` capture per
 * operation is preserved.
 */
import { asc, eq } from 'drizzle-orm'
import { academicTaskTransitions, academicTasks } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type {
  AcademicTaskRow,
  AcademicTaskTransitionRow,
  InsertTaskTransitionInput,
  UpdateTaskDueDateFields,
  UpsertTaskFields,
} from '../../../../application/ports/academic-runtime-repository.js'

export async function getTaskById(db: AppDb, taskId: string): Promise<AcademicTaskRow | undefined> {
  const [row] = await db.select().from(academicTasks).where(eq(academicTasks.taskId, taskId))
  return row
}

export function getTaskTransitions(db: AppDb, taskId: string): Promise<AcademicTaskTransitionRow[]> {
  return db.select().from(academicTaskTransitions).where(eq(academicTaskTransitions.taskId, taskId))
}

export function getTaskTransitionsOrderedAsc(db: AppDb, taskId: string): Promise<AcademicTaskTransitionRow[]> {
  return db
    .select()
    .from(academicTaskTransitions)
    .where(eq(academicTaskTransitions.taskId, taskId))
    .orderBy(asc(academicTaskTransitions.occurredAt))
}

export function listAllTasks(db: AppDb): Promise<AcademicTaskRow[]> {
  return db.select().from(academicTasks)
}

export function listAllTaskTransitionsOrderedAsc(db: AppDb): Promise<AcademicTaskTransitionRow[]> {
  return db.select().from(academicTaskTransitions).orderBy(asc(academicTaskTransitions.occurredAt))
}

export async function updateTask(
  db: AppDb,
  taskId: string,
  fields: UpsertTaskFields,
  nextVersion: number,
  updatedAt: string,
): Promise<void> {
  await db.update(academicTasks).set({
    studentId: fields.studentId,
    offeringId: fields.offeringId,
    assignedToRole: fields.assignedToRole,
    taskType: fields.taskType,
    status: fields.status,
    title: fields.title,
    dueLabel: fields.dueLabel,
    dueDateIso: fields.dueDateIso,
    riskProbScaled: fields.riskProbScaled,
    riskBand: fields.riskBand,
    priority: fields.priority,
    payloadJson: fields.payloadJson,
    updatedByFacultyId: fields.updatedByFacultyId,
    version: nextVersion,
    updatedAt,
  }).where(eq(academicTasks.taskId, taskId))
}

export async function insertTask(
  db: AppDb,
  taskId: string,
  fields: UpsertTaskFields,
  createdByFacultyId: string | null,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  await db.insert(academicTasks).values({
    taskId,
    studentId: fields.studentId,
    offeringId: fields.offeringId,
    assignedToRole: fields.assignedToRole,
    taskType: fields.taskType,
    status: fields.status,
    title: fields.title,
    dueLabel: fields.dueLabel,
    dueDateIso: fields.dueDateIso,
    riskProbScaled: fields.riskProbScaled,
    riskBand: fields.riskBand,
    priority: fields.priority,
    payloadJson: fields.payloadJson,
    createdByFacultyId,
    updatedByFacultyId: fields.updatedByFacultyId,
    version: 1,
    createdAt,
    updatedAt,
  })
}

export async function updateTaskDueDate(db: AppDb, taskId: string, fields: UpdateTaskDueDateFields): Promise<void> {
  await db.update(academicTasks).set({
    dueDateIso: fields.dueDateIso,
    payloadJson: fields.payloadJson,
    updatedByFacultyId: fields.updatedByFacultyId,
    updatedAt: fields.updatedAt,
  }).where(eq(academicTasks.taskId, taskId))
}

export async function insertTaskTransition(db: AppDb, input: InsertTaskTransitionInput): Promise<void> {
  await db.insert(academicTaskTransitions).values({
    transitionId: input.transitionId,
    taskId: input.taskId,
    actorRole: input.actorRole,
    actorFacultyId: input.actorFacultyId,
    action: input.action,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    note: input.note,
    occurredAt: input.occurredAt,
  })
}
