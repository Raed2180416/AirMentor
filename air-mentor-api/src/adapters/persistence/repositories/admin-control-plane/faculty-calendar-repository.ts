/**
 * Drizzle access + 3-way projection writes (teacher workspace / canonical
 * template / admin workspace + runtime-state mirrors) for the sysadmin
 * faculty-calendar routes. Every query and the write order are moved verbatim
 * from the legacy module; `context.db`/`context.now()` become injected `db`/`now`.
 */
import { eq } from 'drizzle-orm'
import {
  academicRuntimeState,
  facultyCalendarAdminWorkspaces,
  facultyCalendarCanonicalTemplates,
  facultyCalendarWorkspaces,
  facultyProfiles,
} from '../../../../db/schema.js'
import type { AppDb } from '../../../../db/client.js'
import { parseJson, stringifyJson } from '../../../../lib/json.js'
import {
  facultyCalendarTemplateSchema,
  facultyCalendarWorkspaceSchema,
  mergeTimetableTemplates,
  type FacultyCalendarTemplate,
  type FacultyCalendarWorkspace,
} from '../../../../application/use-cases/admin-control-plane/faculty-calendar-domain.js'
import type { FacultyProfileRef } from '../../../../application/ports/admin-control-plane-repository.js'
import {
  mapFacultyCalendarAdminWorkspaceRow,
  mapFacultyCalendarCanonicalTemplateRow,
  mapFacultyCalendarTemplateRow,
} from './faculty-calendar-mappers.js'

async function getRuntimeSlice<T>(db: AppDb, stateKey: string, fallback: T) {
  const [row] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  return row ? parseJson(row.payloadJson, fallback) : fallback
}

async function saveRuntimeSlice(db: AppDb, now: () => string, stateKey: string, payload: unknown) {
  const [current] = await db.select().from(academicRuntimeState).where(eq(academicRuntimeState.stateKey, stateKey))
  if (current) {
    await db.update(academicRuntimeState).set({
      payloadJson: stringifyJson(payload),
      version: current.version + 1,
      updatedAt: now(),
    }).where(eq(academicRuntimeState.stateKey, stateKey))
    return
  }
  await db.insert(academicRuntimeState).values({
    stateKey,
    payloadJson: stringifyJson(payload),
    version: 1,
    updatedAt: now(),
  })
}

export async function getFacultyProfileRef(db: AppDb, facultyId: string): Promise<FacultyProfileRef | null> {
  const [row] = await db.select().from(facultyProfiles).where(eq(facultyProfiles.facultyId, facultyId))
  return row ? { facultyId: row.facultyId } : null
}

export async function loadFacultyCalendarCanonicalTemplate(db: AppDb, facultyId: string) {
  const [row] = await db
    .select()
    .from(facultyCalendarCanonicalTemplates)
    .where(eq(facultyCalendarCanonicalTemplates.facultyId, facultyId))
  if (row) {
    const parsed = mapFacultyCalendarCanonicalTemplateRow(row)
    if (parsed) return parsed
  }
  const runtimePayload = await getRuntimeSlice(db, 'canonicalTimetableByFacultyId', {} as Record<string, unknown>)
  const runtimeParsed = facultyCalendarTemplateSchema.safeParse(runtimePayload?.[facultyId])
  return runtimeParsed.success ? runtimeParsed.data : null
}

export async function loadFacultyCalendarAdminWorkspace(db: AppDb, facultyId: string) {
  const [workspaceRow] = await db
    .select()
    .from(facultyCalendarAdminWorkspaces)
    .where(eq(facultyCalendarAdminWorkspaces.facultyId, facultyId))
  const workspaceFromTable = workspaceRow ? mapFacultyCalendarAdminWorkspaceRow(workspaceRow) : null
  if (workspaceFromTable) return workspaceFromTable
  const workspacePayload = await getRuntimeSlice(db, 'adminCalendarByFacultyId', {} as Record<string, unknown>)
  const parsedFallback = facultyCalendarWorkspaceSchema.safeParse(workspacePayload?.[facultyId])
  return parsedFallback.success ? parsedFallback.data : { publishedAt: null, markers: [] }
}

async function saveFacultyCalendarCanonicalTemplate(
  db: AppDb,
  now: () => string,
  facultyId: string,
  template: FacultyCalendarTemplate | null,
) {
  const [currentRow, canonicalRuntimePayload] = await Promise.all([
    db.select().from(facultyCalendarCanonicalTemplates).where(eq(facultyCalendarCanonicalTemplates.facultyId, facultyId)).then(rows => rows[0] ?? null),
    getRuntimeSlice(db, 'canonicalTimetableByFacultyId', {} as Record<string, unknown>),
  ])
  const nowValue = now()
  if (template) {
    if (currentRow) {
      await db.update(facultyCalendarCanonicalTemplates).set({
        templateJson: stringifyJson(template),
        version: currentRow.version + 1,
        updatedAt: nowValue,
      }).where(eq(facultyCalendarCanonicalTemplates.facultyId, facultyId))
    } else {
      await db.insert(facultyCalendarCanonicalTemplates).values({
        facultyId,
        templateJson: stringifyJson(template),
        version: 1,
        createdAt: nowValue,
        updatedAt: nowValue,
      })
    }
  } else if (currentRow) {
    await db.delete(facultyCalendarCanonicalTemplates).where(eq(facultyCalendarCanonicalTemplates.facultyId, facultyId))
  }
  const nextCanonicalPayload = { ...canonicalRuntimePayload }
  if (template) nextCanonicalPayload[facultyId] = template
  else delete nextCanonicalPayload[facultyId]
  await saveRuntimeSlice(db, now, 'canonicalTimetableByFacultyId', nextCanonicalPayload)
}

export async function saveFacultyCalendarTemplateProjection(
  db: AppDb,
  now: () => string,
  facultyId: string,
  template: FacultyCalendarTemplate | null,
) {
  const oldCanonical = await loadFacultyCalendarCanonicalTemplate(db, facultyId)
  const [teacherRow, timetablePayload] = await Promise.all([
    db.select().from(facultyCalendarWorkspaces).where(eq(facultyCalendarWorkspaces.facultyId, facultyId)).then(rows => rows[0] ?? null),
    getRuntimeSlice(db, 'timetableByFacultyId', {} as Record<string, unknown>),
  ])
  const teacherLocal = teacherRow ? mapFacultyCalendarTemplateRow(teacherRow) : null

  await saveFacultyCalendarCanonicalTemplate(db, now, facultyId, template)

  const nowValue = now()
  if (teacherLocal && template) {
    const merged = mergeTimetableTemplates(oldCanonical, teacherLocal, template)
    await db.update(facultyCalendarWorkspaces).set({
      templateJson: stringifyJson(merged),
      version: teacherRow.version + 1,
      updatedAt: nowValue,
    }).where(eq(facultyCalendarWorkspaces.facultyId, facultyId))
    const nextTimetablePayload = { ...timetablePayload, [facultyId]: merged }
    await saveRuntimeSlice(db, now, 'timetableByFacultyId', nextTimetablePayload)
  } else if (teacherLocal && !template) {
    await db.delete(facultyCalendarWorkspaces).where(eq(facultyCalendarWorkspaces.facultyId, facultyId))
    const nextTimetablePayload = { ...timetablePayload }
    delete nextTimetablePayload[facultyId]
    await saveRuntimeSlice(db, now, 'timetableByFacultyId', nextTimetablePayload)
  } else if (template) {
    const nextTimetablePayload = { ...timetablePayload, [facultyId]: template }
    await saveRuntimeSlice(db, now, 'timetableByFacultyId', nextTimetablePayload)
  }
}

export async function saveFacultyCalendarAdminWorkspaceProjection(
  db: AppDb,
  now: () => string,
  facultyId: string,
  workspace: FacultyCalendarWorkspace,
) {
  const [currentWorkspaceRow, workspacePayload] = await Promise.all([
    db.select().from(facultyCalendarAdminWorkspaces).where(eq(facultyCalendarAdminWorkspaces.facultyId, facultyId)).then(rows => rows[0] ?? null),
    getRuntimeSlice(db, 'adminCalendarByFacultyId', {} as Record<string, unknown>),
  ])
  const nowValue = now()
  if (currentWorkspaceRow) {
    await db.update(facultyCalendarAdminWorkspaces).set({
      workspaceJson: stringifyJson(workspace),
      version: currentWorkspaceRow.version + 1,
      updatedAt: nowValue,
    }).where(eq(facultyCalendarAdminWorkspaces.facultyId, facultyId))
  } else {
    await db.insert(facultyCalendarAdminWorkspaces).values({
      facultyId,
      workspaceJson: stringifyJson(workspace),
      version: 1,
      createdAt: nowValue,
      updatedAt: nowValue,
    })
  }
  await saveRuntimeSlice(db, now, 'adminCalendarByFacultyId', {
    ...workspacePayload,
    [facultyId]: workspace,
  })
}
