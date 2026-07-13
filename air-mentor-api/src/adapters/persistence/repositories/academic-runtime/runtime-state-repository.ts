/**
 * Drizzle data access for the academic runtime-state slice writes.
 *
 * Queries are moved verbatim from modules/academic-runtime-routes.ts
 * (`context.db` -> injected `db`, `context.now()` -> injected `now()`).
 */
import { eq } from 'drizzle-orm'
import { academicRuntimeState } from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import type { AcademicRuntimeStateRow } from '../../../../application/ports/academic-runtime-repository.js'

export async function getRuntimeStateRow(db: AppDb, stateKey: string): Promise<AcademicRuntimeStateRow | undefined> {
  const [current] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  return current
}

export async function updateRuntimeStateRow(
  db: AppDb,
  now: () => string,
  stateKey: string,
  payloadJson: string,
  currentVersion: number,
): Promise<void> {
  await db.update(academicRuntimeState).set({
    payloadJson,
    version: currentVersion + 1,
    updatedAt: now(),
  }).where(eq(academicRuntimeState.stateKey, stateKey))
}

export async function insertRuntimeStateRow(
  db: AppDb,
  now: () => string,
  stateKey: string,
  payloadJson: string,
): Promise<void> {
  await db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson,
    version: 1,
    updatedAt: now(),
  })
}
