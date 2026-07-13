/**
 * Faculty-calendar domain — zod schemas, inferred types, and pure timetable
 * helpers shared by the controller (request validation), the use-cases (merge /
 * lock logic), and the persistence mappers.
 *
 * Every schema, `addDays`, `classBlocksEqual`, and `mergeTimetableTemplates` are
 * moved verbatim from the legacy admin-control-plane module. Zod is permitted in
 * the application layer; no db/schema or drizzle imports live here.
 */
import { z } from 'zod'

const weekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

export const timetableSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const timetableClassBlockSchema = z.object({
  id: z.string().min(1),
  facultyId: z.string().min(1),
  offeringId: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  section: z.string().min(1),
  year: z.string().min(1),
  day: weekdaySchema,
  dateISO: z.string().optional(),
  kind: z.enum(['regular', 'extra']).optional(),
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
  slotId: z.string().optional(),
  slotSpan: z.number().int().positive().optional(),
}).passthrough()

export const facultyCalendarTemplateSchema = z.object({
  facultyId: z.string().min(1),
  slots: z.array(timetableSlotSchema),
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  classBlocks: z.array(timetableClassBlockSchema),
  updatedAt: z.number().int().nonnegative(),
}).passthrough()

export const calendarMarkerSchema = z.object({
  markerId: z.string().min(1),
  facultyId: z.string().min(1),
  markerType: z.enum(['semester-start', 'semester-end', 'term-test-start', 'term-test-end', 'holiday', 'event']),
  title: z.string().min(1),
  note: z.string().nullable().optional(),
  dateISO: z.string().min(1),
  endDateISO: z.string().nullable().optional(),
  allDay: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  endMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  color: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export const facultyCalendarWorkspaceSchema = z.object({
  publishedAt: z.string().nullable(),
  markers: z.array(calendarMarkerSchema),
})

export const facultyCalendarSaveSchema = z.object({
  template: facultyCalendarTemplateSchema.nullable(),
  workspace: facultyCalendarWorkspaceSchema,
})

export type FacultyCalendarTemplate = z.infer<typeof facultyCalendarTemplateSchema>
export type FacultyCalendarWorkspace = z.infer<typeof facultyCalendarWorkspaceSchema>

export function addDays(isoString: string, days: number) {
  const date = new Date(isoString)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function classBlocksEqual(
  left: Array<Record<string, unknown>>,
  right: Array<Record<string, unknown>>,
) {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const rightSorted = [...right].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return JSON.stringify(leftSorted) === JSON.stringify(rightSorted)
}

export function mergeTimetableTemplates(
  oldCanonical: FacultyCalendarTemplate | null,
  teacherLocal: FacultyCalendarTemplate,
  newCanonical: FacultyCalendarTemplate | null,
): FacultyCalendarTemplate {
  if (!newCanonical) return teacherLocal
  if (!oldCanonical) return newCanonical

  const oldCanonicalMap = new Map(oldCanonical.classBlocks.map(b => [b.id, b]))
  const newCanonicalMap = new Map(newCanonical.classBlocks.map(b => [b.id, b]))

  const mergedBlocks = [...newCanonical.classBlocks]

  for (const localBlock of teacherLocal.classBlocks) {
    if (localBlock.kind === 'extra') {
      if (!newCanonicalMap.has(localBlock.id)) {
        mergedBlocks.push(localBlock)
      }
      continue
    }

    const oldBlock = oldCanonicalMap.get(localBlock.id)
    const newBlock = newCanonicalMap.get(localBlock.id)

    if (oldBlock && newBlock) {
      const teacherModified = (
        oldBlock.day !== localBlock.day ||
        oldBlock.startMinutes !== localBlock.startMinutes ||
        oldBlock.endMinutes !== localBlock.endMinutes ||
        oldBlock.dateISO !== localBlock.dateISO
      )
      if (teacherModified) {
        const idx = mergedBlocks.findIndex(b => b.id === localBlock.id)
        if (idx >= 0) {
          mergedBlocks[idx] = {
            ...newBlock,
            day: localBlock.day,
            startMinutes: localBlock.startMinutes,
            endMinutes: localBlock.endMinutes,
            dateISO: localBlock.dateISO,
          }
        }
      }
    } else if (!oldBlock && !newBlock) {
      if (!mergedBlocks.some(b => b.id === localBlock.id)) {
        mergedBlocks.push(localBlock)
      }
    }
  }

  return {
    ...newCanonical,
    classBlocks: mergedBlocks,
    updatedAt: Date.now(),
  }
}
