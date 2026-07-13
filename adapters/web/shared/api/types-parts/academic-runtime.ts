// Academic login faculty projection, runtime state, task + task-placement
// records/requests/responses, and calendar-audit records/requests/responses.
// Extracted verbatim from '../types'.

import type {
  CalendarAuditEvent,
  EntryLockMap,
  FacultyTimetableTemplate,
  QueueTransition,
  SchemeState,
  SharedTask,
  StudentRuntimePatch,
  TaskCalendarPlacement,
  TTKind,
  TermTestBlueprint,
} from '@kernel/shared/domain'
import type { ApiAdminFacultyCalendarWorkspace } from './calendar'

export type ApiAcademicLoginFaculty = {
  facultyId: string
  username: string
  email: string
  name: string
  displayName: string
  designation: string
  dept: string
  departmentCode: string
  roleTitle: string
  allowedRoles: Array<'Course Leader' | 'Mentor' | 'HoD'>
  courseCodes: string[]
  offeringIds: string[]
  menteeIds: string[]
}

export type ApiAcademicRuntimeState = {
  studentPatches: Record<string, StudentRuntimePatch>
  schemeByOffering: Record<string, SchemeState>
  ttBlueprintsByOffering: Record<string, Record<TTKind, TermTestBlueprint>>
  drafts: Record<string, number>
  cellValues: Record<string, number>
  lockByOffering: Record<string, EntryLockMap>
  lockAuditByTarget: Record<string, QueueTransition[]>
  tasks: SharedTask[]
  resolvedTasks: Record<string, number>
  timetableByFacultyId: Record<string, FacultyTimetableTemplate>
  adminCalendarByFacultyId: Record<string, ApiAdminFacultyCalendarWorkspace>
  taskPlacements: Record<string, TaskCalendarPlacement>
  calendarAudit: CalendarAuditEvent[]
}

export type ApiAcademicTaskRecord = SharedTask & {
  version: number
}

export type ApiAcademicTaskListResponse = {
  items: ApiAcademicTaskRecord[]
}

export type ApiUpsertAcademicTaskRequest = {
  task: SharedTask
  expectedVersion?: number
}

export type ApiUpsertAcademicTaskResponse = {
  task: ApiAcademicTaskRecord
  created: boolean
}

export type ApiAcademicTaskPlacementRecord = TaskCalendarPlacement

export type ApiAcademicTaskPlacementListResponse = {
  items: ApiAcademicTaskPlacementRecord[]
}

export type ApiUpsertAcademicTaskPlacementRequest = {
  placement: TaskCalendarPlacement
  expectedUpdatedAt?: number
}

export type ApiUpsertAcademicTaskPlacementResponse = {
  placement: ApiAcademicTaskPlacementRecord
  created: boolean
}

export type ApiDeleteAcademicTaskPlacementResponse = {
  ok: true
  taskId: string
  deleted: boolean
}

export type ApiAcademicCalendarAuditRecord = CalendarAuditEvent

export type ApiAcademicCalendarAuditListResponse = {
  items: ApiAcademicCalendarAuditRecord[]
}

export type ApiAppendAcademicCalendarAuditRequest = {
  event: CalendarAuditEvent
}

export type ApiAppendAcademicCalendarAuditResponse = {
  event: ApiAcademicCalendarAuditRecord
  created: boolean
}
