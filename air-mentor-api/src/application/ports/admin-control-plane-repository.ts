/**
 * Admin-control-plane repository port.
 *
 * Framework-free interface for every DB access the admin-control-plane
 * use-cases need (admin search dataset, recent audit events, private reminders,
 * faculty-calendar projections, and the faculty-profile read dataset). MUST NOT
 * import db/schema or drizzle-orm — the Drizzle implementation lives under
 * adapters/persistence (ESLint enforces this).
 */
import type { SearchDataset } from '../use-cases/admin-control-plane/search-domain.js'
import type { AuditEventRow, Reminder } from '../use-cases/admin-control-plane/reminder-audit-domain.js'
import type {
  FacultyCalendarTemplate,
  FacultyCalendarWorkspace,
} from '../use-cases/admin-control-plane/faculty-calendar-domain.js'
import type { FacultyProfileDataset } from '../use-cases/admin-control-plane/faculty-profile-domain.js'

export type FacultyProfileRef = { facultyId: string }

export type CreateReminderInput = {
  facultyId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
}

export type UpdateReminderInput = {
  reminderId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  currentVersion: number
}

export type LoadFacultyProfileDatasetInput = {
  facultyId: string
  viewerRoleCode: string
  viewerFacultyId: string | null
}

export interface AdminControlPlaneRepository {
  // GET /api/admin/search
  loadSearchDataset(): Promise<SearchDataset>

  // GET /api/admin/audit-events/recent
  listRecentAuditEvents(limit: number): Promise<AuditEventRow[]>

  // GET/POST/PATCH /api/admin/reminders
  listReminders(facultyId: string): Promise<Reminder[]>
  createReminder(input: CreateReminderInput): Promise<Reminder>
  getReminderById(reminderId: string): Promise<Reminder | null>
  updateReminder(input: UpdateReminderInput): Promise<Reminder>

  // GET/PUT /api/admin/faculty-calendar/:facultyId
  getFacultyProfileRef(facultyId: string): Promise<FacultyProfileRef | null>
  loadFacultyCalendarCanonicalTemplate(facultyId: string): Promise<FacultyCalendarTemplate | null>
  loadFacultyCalendarAdminWorkspace(facultyId: string): Promise<FacultyCalendarWorkspace>
  saveFacultyCalendarTemplateProjection(facultyId: string, template: FacultyCalendarTemplate | null): Promise<void>
  saveFacultyCalendarAdminWorkspaceProjection(facultyId: string, workspace: FacultyCalendarWorkspace): Promise<void>

  // GET /api/academic/faculty-profile/:facultyId
  getCheckpointRunId(simulationStageCheckpointId: string): Promise<{ simulationRunId: string } | null>
  loadFacultyProfileDataset(input: LoadFacultyProfileDatasetInput): Promise<FacultyProfileDataset>
}
