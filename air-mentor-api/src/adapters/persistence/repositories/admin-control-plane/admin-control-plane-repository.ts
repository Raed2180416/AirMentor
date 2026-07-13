/**
 * Drizzle implementation of the AdminControlPlaneRepository port.
 *
 * Composition point for admin-control-plane data access; the heavier read/write
 * paths (search scan, reminders/audit, faculty-calendar projections, and the
 * faculty-profile dataset) live in sibling files to respect the 400-line cap.
 * `now` is injected so the calendar/reminder writes keep the legacy clock calls.
 */
import type { AppDb } from '../../../../db/client.js'
import type { AdminControlPlaneRepository } from '../../../../application/ports/admin-control-plane-repository.js'
import { loadSearchDataset } from './search-repository.js'
import {
  createReminder,
  getReminderById,
  listRecentAuditEvents,
  listReminders,
  updateReminder,
} from './reminder-audit-repository.js'
import {
  getFacultyProfileRef,
  loadFacultyCalendarAdminWorkspace,
  loadFacultyCalendarCanonicalTemplate,
  saveFacultyCalendarAdminWorkspaceProjection,
  saveFacultyCalendarTemplateProjection,
} from './faculty-calendar-repository.js'
import {
  getCheckpointRunId,
  loadFacultyProfileDataset,
} from './faculty-profile-repository.js'

export function createAdminControlPlaneRepository(db: AppDb, now: () => string): AdminControlPlaneRepository {
  return {
    loadSearchDataset: () => loadSearchDataset(db),

    listRecentAuditEvents: limit => listRecentAuditEvents(db, limit),

    listReminders: facultyId => listReminders(db, facultyId),
    createReminder: input => createReminder(db, now, input),
    getReminderById: reminderId => getReminderById(db, reminderId),
    updateReminder: input => updateReminder(db, now, input),

    getFacultyProfileRef: facultyId => getFacultyProfileRef(db, facultyId),
    loadFacultyCalendarCanonicalTemplate: facultyId => loadFacultyCalendarCanonicalTemplate(db, facultyId),
    loadFacultyCalendarAdminWorkspace: facultyId => loadFacultyCalendarAdminWorkspace(db, facultyId),
    saveFacultyCalendarTemplateProjection: (facultyId, template) => saveFacultyCalendarTemplateProjection(db, now, facultyId, template),
    saveFacultyCalendarAdminWorkspaceProjection: (facultyId, workspace) => saveFacultyCalendarAdminWorkspaceProjection(db, now, facultyId, workspace),

    getCheckpointRunId: id => getCheckpointRunId(db, id),
    loadFacultyProfileDataset: input => loadFacultyProfileDataset(db, input),
  }
}
