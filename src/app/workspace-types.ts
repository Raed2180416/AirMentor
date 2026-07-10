import type {
  EntryKind,
  RemedialPlan,
  Role,
  ScheduleMeta,
  TaskPlacementMode,
  TaskType,
} from '../domain'
import type { StudentHistoryRecord } from '../data'
import type { ApiAcademicBootstrap, ApiSessionResponse } from '../api/types'

export type TaskPlacementDraft = {
  dateISO: string
  placementMode: TaskPlacementMode
  startMinutes?: number
  endMinutes?: number
}

export type TaskComposerState = {
  isOpen: boolean
  step: 'details' | 'remedial'
  offeringId?: string
  studentId?: string
  taskType: TaskType
  dueDateISO: string
  note: string
  search: string
  availableOfferingIds?: string[]
  placement?: TaskPlacementDraft
}

export type NoteActionState =
  | { type: 'unlock-request'; offeringId: string; kind: EntryKind }
  | { type: 'reassign-task'; taskId: string; toRole: Role; title: string }
  | { type: 'student-handoff'; mode: 'escalate' | 'mentor'; studentId: string; offeringId: string; title: string }

export type TaskCreateInput = {
  offeringId: string
  studentId: string
  taskType: TaskType
  due?: string
  dueDateISO?: string
  note?: string
  remedialPlan?: RemedialPlan
  scheduleMeta?: ScheduleMeta
  placement?: TaskPlacementDraft
}

export type PageId = 'dashboard' | 'students' | 'course' | 'calendar' | 'upload' | 'entry-workspace' | 'mentees' | 'department' | 'mentee-detail' | 'student-history' | 'student-shell' | 'risk-explorer' | 'unlock-review' | 'scheme-setup' | 'queue-history' | 'faculty-profile'

export type RouteSnapshot = {
  page: PageId
  offeringId: string | null
  uploadOfferingId: string | null
  uploadKind: EntryKind
  entryOfferingId: string
  entryKind: EntryKind
  selectedMenteeId: string | null
  historyProfile: StudentHistoryRecord | null
  historyStudentId: string | null
  studentShellStudentId: string | null
  historyBackPage: PageId | null
  selectedUnlockTaskId: string | null
  schemeOfferingId: string | null
  courseInitialTab?: string
}

export type AcademicWorkspaceProjection = {
  session: ApiSessionResponse
  bootstrap: ApiAcademicBootstrap
  revision: number
}
