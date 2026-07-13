// System-admin search, reminders, request workflow (summary/note/transition/
// detail), and audit-event contracts. Extracted verbatim from '../types'.

import type { ApiRoleCode } from './session'

export type ApiAdminSearchRoute = {
  section: 'overview' | 'faculties' | 'students' | 'faculty-members' | 'requests'
  academicFacultyId?: string
  departmentId?: string
  branchId?: string
  batchId?: string
  studentId?: string
  facultyMemberId?: string
  requestId?: string
}

export type ApiAdminSearchResult = {
  key: string
  entityType: string
  entityId: string
  label: string
  meta: string
  route: ApiAdminSearchRoute
}

export type ApiAdminReminder = {
  reminderId: string
  facultyId: string
  title: string
  body: string
  dueAt: string
  status: 'pending' | 'done'
  version: number
  createdAt: string
  updatedAt: string
}

export type ApiTargetEntityRef = {
  entityType: string
  entityId: string
}

export type ApiAdminRequestSummary = {
  adminRequestId: string
  requestType: string
  scopeType: string
  scopeId: string
  targetEntityRefs: ApiTargetEntityRef[]
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: 'New' | 'In Review' | 'Needs Info' | 'Approved' | 'Rejected' | 'Implemented' | 'Closed'
  requestedByRole: ApiRoleCode
  requestedByFacultyId: string
  ownedByRole: ApiRoleCode
  ownedByFacultyId: string | null
  summary: string
  details: string
  notesThreadId: string
  dueAt: string
  slaPolicyCode: string
  decision: string | null
  payload: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  requesterName?: string | null
  ownerName?: string | null
}

export type ApiAdminRequestNote = {
  noteId: string
  adminRequestId: string
  authorRole: string
  authorFacultyId: string | null
  visibility: string
  noteType: string
  body: string
  createdAt: string
}

export type ApiAdminRequestTransition = {
  transitionId: string
  adminRequestId: string
  previousStatus: string | null
  nextStatus: string
  actorRole: string
  actorFacultyId: string | null
  noteId: string | null
  affectedEntityRefs: ApiTargetEntityRef[]
  createdAt: string
}

export type ApiAuditEvent = {
  auditEventId: string
  entityType: string
  entityId: string
  action: string
  actorRole: string
  actorId: string | null
  before: unknown
  after: unknown
  metadata: unknown
  createdAt: string
}

export type ApiAdminRequestDetail = ApiAdminRequestSummary & {
  notes: ApiAdminRequestNote[]
  transitions: ApiAdminRequestTransition[]
}
