/**
 * Drizzle-row -> domain mappers for the faculty-calendar tables. Kept in the
 * persistence layer because they reference db/schema row types; the parse logic
 * is moved verbatim from the legacy module.
 */
import {
  facultyCalendarAdminWorkspaces,
  facultyCalendarCanonicalTemplates,
  facultyCalendarWorkspaces,
} from '../../../../db/schema.js'
import { parseJson } from '../../../../lib/json.js'
import {
  facultyCalendarTemplateSchema,
  facultyCalendarWorkspaceSchema,
} from '../../../../application/use-cases/admin-control-plane/faculty-calendar-domain.js'

export function mapFacultyCalendarTemplateRow(row: typeof facultyCalendarWorkspaces.$inferSelect) {
  const parsed = facultyCalendarTemplateSchema.safeParse(parseJson(row.templateJson, {}))
  return parsed.success ? parsed.data : null
}

export function mapFacultyCalendarCanonicalTemplateRow(row: typeof facultyCalendarCanonicalTemplates.$inferSelect) {
  const parsed = facultyCalendarTemplateSchema.safeParse(parseJson(row.templateJson, {}))
  return parsed.success ? parsed.data : null
}

export function mapFacultyCalendarAdminWorkspaceRow(row: typeof facultyCalendarAdminWorkspaces.$inferSelect) {
  const parsed = facultyCalendarWorkspaceSchema.safeParse(parseJson(row.workspaceJson, {}))
  return parsed.success ? parsed.data : null
}
