/**
 * Academic runtime repository port.
 *
 * Framework-free interface for every direct DB access the academic-runtime
 * use-cases perform (runtime-state slices, academic tasks + transitions, task
 * placements, calendar-audit events, faculty-calendar workspaces, meetings, and
 * the offering data-entry writes: attendance, assessment scores, schemes,
 * question papers). MUST NOT import db/schema or drizzle-orm — the Drizzle
 * implementation lives under adapters/persistence (ESLint enforces this).
 *
 * Row types below mirror the corresponding Drizzle `$inferSelect` shapes exactly
 * so the injected deps.* mappers (defined in modules/academic.ts) accept them
 * without change.
 */

export type AcademicRuntimeStateRow = {
  stateKey: string
  payloadJson: string
  version: number
  updatedAt: string
}

export type AcademicTaskRow = {
  taskId: string
  studentId: string
  offeringId: string
  assignedToRole: string
  taskType: string
  status: string
  title: string
  dueLabel: string
  dueDateIso: string | null
  riskProbScaled: number
  riskBand: string
  priority: number
  payloadJson: string
  createdByFacultyId: string | null
  updatedByFacultyId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type AcademicTaskTransitionRow = {
  transitionId: string
  taskId: string
  actorRole: string
  actorFacultyId: string | null
  action: string
  fromOwner: string | null
  toOwner: string
  note: string
  occurredAt: string
}

export type AcademicTaskPlacementRow = {
  taskId: string
  facultyId: string
  dateIso: string
  placementMode: string
  startMinutes: number | null
  endMinutes: number | null
  slotId: string | null
  startTime: string | null
  endTime: string | null
  updatedAt: string
}

export type AcademicCalendarAuditEventRow = {
  auditEventId: string
  facultyId: string
  payloadJson: string
  createdAt: string
}

export type FacultyCalendarWorkspaceRow = {
  facultyId: string
  templateJson: string
  version: number
  createdAt: string
  updatedAt: string
}

export type AcademicMeetingRow = {
  meetingId: string
  facultyId: string
  studentId: string
  offeringId: string | null
  title: string
  notes: string | null
  dateIso: string
  startMinutes: number
  endMinutes: number
  status: string
  createdByFacultyId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type OfferingAssessmentSchemeRow = {
  offeringId: string
  configuredByFacultyId: string | null
  schemeJson: string
  policySnapshotJson: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export type OfferingQuestionPaperRow = {
  paperId: string
  offeringId: string
  kind: string
  blueprintJson: string
  updatedByFacultyId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type CourseOutcomeOverrideRow = {
  courseOutcomeOverrideId: string
  courseId: string
  scopeType: string
  scopeId: string
  outcomesJson: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

// -------------------------------------------------------------------------
// Write-input shapes (kept structural so the application layer never touches
// db/schema). Field lists mirror the exact column writes in the legacy module.
// -------------------------------------------------------------------------

export type UpsertTaskFields = {
  studentId: string
  offeringId: string
  assignedToRole: string
  taskType: string
  status: string
  title: string
  dueLabel: string
  dueDateIso: string | null
  riskProbScaled: number
  riskBand: string
  priority: number
  payloadJson: string
  updatedByFacultyId: string | null
}

export type InsertTaskTransitionInput = {
  transitionId: string
  taskId: string
  actorRole: string
  actorFacultyId: string | null
  action: string
  fromOwner: string | null
  toOwner: string
  note: string
  occurredAt: string
}

export type UpsertTaskPlacementFields = {
  facultyId: string
  dateIso: string
  placementMode: string
  startMinutes: number | null
  endMinutes: number | null
  slotId: string | null
  startTime: string | null
  endTime: string | null
}

export type UpdateTaskDueDateFields = {
  dueDateIso: string
  payloadJson: string
  updatedByFacultyId: string | null
  updatedAt: string
}

export type InsertMeetingInput = {
  meetingId: string
  facultyId: string
  studentId: string
  offeringId: string | null
  title: string
  notes: string | null
  dateIso: string
  startMinutes: number
  endMinutes: number
  status: string
  createdByFacultyId: string | null
}

export type UpdateMeetingFields = {
  studentId: string
  offeringId: string | null
  title: string
  notes: string | null
  dateIso: string
  startMinutes: number
  endMinutes: number
  status: string
}

export type InsertAttendanceSnapshotInput = {
  studentId: string
  offeringId: string
  presentClasses: number
  totalClasses: number
  attendancePercent: number
  source: string
  capturedAt: string
}

export type InsertAssessmentScoreInput = {
  studentId: string
  offeringId: string
  termId: string | null
  componentType: string
  componentCode: string | null
  score: number
  maxScore: number
  evaluatedAt: string
}

export type OfferingLockField = 'tt1Locked' | 'tt2Locked' | 'quizLocked' | 'assignmentLocked' | 'finalsLocked'

export type OfferingWritePatch = {
  attendance?: number
  tt1Done?: number
  tt2Done?: number
  tt1Locked?: number
  tt2Locked?: number
  quizLocked?: number
  assignmentLocked?: number
  finalsLocked?: number
  version?: number
  updatedAt?: string
}

export type UpsertSchemeFields = {
  configuredByFacultyId: string | null
  schemeJson: string
  policySnapshotJson: string
  status: string
}

export type UpsertQuestionPaperFields = {
  offeringId: string
  kind: string
  blueprintJson: string
  updatedByFacultyId: string | null
}

export interface AcademicRuntimeRepository {
  // runtime-state
  getRuntimeStateRow(stateKey: string): Promise<AcademicRuntimeStateRow | undefined>
  updateRuntimeStateRow(stateKey: string, payloadJson: string, currentVersion: number): Promise<void>
  insertRuntimeStateRow(stateKey: string, payloadJson: string): Promise<void>

  // tasks
  getTaskById(taskId: string): Promise<AcademicTaskRow | undefined>
  getTaskTransitions(taskId: string): Promise<AcademicTaskTransitionRow[]>
  getTaskTransitionsOrderedAsc(taskId: string): Promise<AcademicTaskTransitionRow[]>
  listAllTasks(): Promise<AcademicTaskRow[]>
  listAllTaskTransitionsOrderedAsc(): Promise<AcademicTaskTransitionRow[]>
  updateTask(taskId: string, fields: UpsertTaskFields, nextVersion: number, updatedAt: string): Promise<void>
  insertTask(taskId: string, fields: UpsertTaskFields, createdByFacultyId: string | null, createdAt: string, updatedAt: string): Promise<void>
  updateTaskDueDate(taskId: string, fields: UpdateTaskDueDateFields): Promise<void>
  insertTaskTransition(input: InsertTaskTransitionInput): Promise<void>

  // task-placements
  getPlacementByTaskId(taskId: string): Promise<AcademicTaskPlacementRow | undefined>
  listAllPlacements(): Promise<AcademicTaskPlacementRow[]>
  updatePlacement(taskId: string, fields: UpsertTaskPlacementFields, updatedAt: string): Promise<void>
  insertPlacement(taskId: string, fields: UpsertTaskPlacementFields, updatedAt: string): Promise<void>
  deletePlacement(taskId: string): Promise<void>

  // calendar-audit
  getCalendarAuditEventById(auditEventId: string): Promise<AcademicCalendarAuditEventRow | undefined>
  insertCalendarAuditEvent(auditEventId: string, facultyId: string, payloadJson: string, createdAt: string): Promise<void>
  listCalendarAuditEventsByFaculty(facultyId: string): Promise<AcademicCalendarAuditEventRow[]>

  // faculty-calendar-workspace
  getFacultyCalendarWorkspace(facultyId: string): Promise<FacultyCalendarWorkspaceRow | undefined>
  updateFacultyCalendarWorkspace(facultyId: string, templateJson: string, nextVersion: number, updatedAt: string): Promise<void>
  insertFacultyCalendarWorkspace(facultyId: string, templateJson: string, createdAt: string, updatedAt: string): Promise<void>

  // meetings
  insertMeeting(input: InsertMeetingInput, createdAt: string, updatedAt: string): Promise<void>
  getMeetingById(meetingId: string): Promise<AcademicMeetingRow | undefined>
  updateMeeting(meetingId: string, fields: UpdateMeetingFields, nextVersion: number, updatedAt: string): Promise<void>

  // offering data-entry
  insertAttendanceSnapshot(input: InsertAttendanceSnapshotInput, createdAt: string, updatedAt: string): Promise<void>
  updateOfferingFields(offeringId: string, patch: OfferingWritePatch): Promise<void>
  getSchemeByOffering(offeringId: string): Promise<OfferingAssessmentSchemeRow | undefined>
  listActiveCourseOutcomeOverrides(courseId: string): Promise<CourseOutcomeOverrideRow[]>
  getQuestionPaperByOfferingKind(offeringId: string, kind: string): Promise<OfferingQuestionPaperRow | undefined>
  listScoreComponentTypes(offeringId: string): Promise<Array<{ componentType: string }>>
  deleteStaleScores(offeringId: string, componentTypes: string[], submittedStudentIds: string[]): Promise<void>
  deleteStudentScores(studentId: string, offeringId: string, componentTypes: string[]): Promise<void>
  insertAssessmentScore(input: InsertAssessmentScoreInput, createdAt: string, updatedAt: string): Promise<void>
  updateScheme(offeringId: string, fields: UpsertSchemeFields, nextVersion: number, updatedAt: string): Promise<void>
  insertScheme(offeringId: string, fields: UpsertSchemeFields, createdAt: string, updatedAt: string): Promise<void>
  updateQuestionPaper(paperId: string, blueprintJson: string, updatedByFacultyId: string | null, nextVersion: number, updatedAt: string): Promise<void>
  insertQuestionPaper(fields: UpsertQuestionPaperFields, createdAt: string, updatedAt: string): Promise<void>
}
