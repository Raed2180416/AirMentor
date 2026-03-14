export type Role = 'Course Leader' | 'Mentor' | 'HoD'
export type Stage = 1 | 2 | 3
export type RiskBand = 'High' | 'Medium' | 'Low'
export type TaskStatus = 'New' | 'In Progress' | 'Follow-up' | 'Resolved'

export type ThemeMode = 'frosted-focus-light' | 'frosted-focus-dark'
export type LayoutMode = 'three-column' | 'split' | 'focus'
export type EntryKind = 'tt1' | 'tt2' | 'quiz' | 'assignment' | 'attendance' | 'finals'
export type EntryLockMap = Record<EntryKind, boolean>
export type TaskType = 'Follow-up' | 'Remedial' | 'Attendance' | 'Academic'
export type TTKind = 'tt1' | 'tt2'
export type AssessmentComponentKind = 'quiz' | 'assignment'

export type FacultyCapabilitySet = {
  canApproveUnlock: boolean
  canEditMarks: boolean
}

export type SchedulePreset = 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom dates'

export type ScheduleMeta = {
  mode: 'one-time' | 'scheduled'
  preset?: SchedulePreset
  time?: string
  customDates?: Array<{ dateISO: string; time?: string }>
  completedDatesISO?: string[]
  status?: 'active' | 'paused' | 'ended'
  nextDueDateISO?: string
}

export type AssessmentComponentDefinition = {
  id: string
  label: string
  rawMax: number
}

export type TermTestNode = {
  id: string
  label: string
  text: string
  maxMarks: number
  cos: string[]
  children?: TermTestNode[]
}

export type TermTestBlueprint = {
  kind: TTKind
  totalMarks: number
  nodes: TermTestNode[]
  updatedAt: number
}

export type DerivedAcademicProjection = {
  attendancePct: number
  tt1Raw: number | null
  tt2Raw: number | null
  tt1Scaled: number
  tt2Scaled: number
  quizRawTotal: number
  assignmentRawTotal: number
  quizScaled: number
  asgnScaled: number
  ce60: number
  seeRaw: number | null
  seeScaled40: number
  finalScore100: number
  bandLabel: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F'
  gradePoint: 0 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  predictedCgpa: number
}

export type FacultyAccount = {
  facultyId: string
  name: string
  initials: string
  email: string
  dept: string
  roleTitle: string
  allowedRoles: Role[]
  courseCodes: string[]
  offeringIds: string[]
  menteeIds: string[]
}

export type EvaluationScheme = {
  finalsMax: 50 | 100
  quizWeight: number
  assignmentWeight: number
  quizCount: 0 | 1 | 2
  assignmentCount: 0 | 1 | 2
  quizComponents: AssessmentComponentDefinition[]
  assignmentComponents: AssessmentComponentDefinition[]
}

export type SchemeLifecycleStatus = 'Needs Setup' | 'Configured' | 'Locked'

export type SchemeState = EvaluationScheme & {
  status: SchemeLifecycleStatus
  configuredAt?: number
  lockedAt?: number
  lastEditedBy?: Role
}

export type QueueTransition = {
  id: string
  at: number
  actorRole: Role | 'System' | 'Auto'
  actorTeacherId?: string
  action: string
  fromOwner?: Role
  toOwner: Role
  note: string
}

export type UnlockRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Reset Completed'

export type UnlockRequest = {
  offeringId: string
  kind: EntryKind
  status: UnlockRequestStatus
  requestedByRole: Role
  requestedByFacultyId?: string
  requestedAt: number
  reviewedAt?: number
  requestNote?: string
  reviewNote?: string
  handoffNote?: string
}

export type StudentRuntimePatch = {
  present?: number
  totalClasses?: number
  tt1LeafScores?: Record<string, number>
  tt2LeafScores?: Record<string, number>
  quizScores?: Record<string, number>
  assignmentScores?: Record<string, number>
  seeScore?: number
}

export type RemedialPlanStep = {
  id: string
  label: string
  completedAt?: number
}

export type RemedialPlan = {
  planId: string
  title: string
  createdAt: number
  ownerRole: Role
  dueDateISO: string
  checkInDatesISO: string[]
  steps: RemedialPlanStep[]
}

export type SharedTask = {
  id: string
  studentId: string
  studentName: string
  studentUsn: string
  offeringId: string
  courseCode: string
  courseName: string
  year: string
  riskProb: number
  riskBand: RiskBand
  title: string
  due: string
  status: TaskStatus
  actionHint: string
  priority: number
  createdAt: number
  updatedAt?: number
  assignedTo: Role
  taskType?: TaskType
  dueDateISO?: string
  remedialPlan?: RemedialPlan
  escalated?: boolean
  sourceRole?: Role | 'Auto' | 'System'
  manual?: boolean
  transitionHistory?: QueueTransition[]
  unlockRequest?: UnlockRequest
  requestNote?: string
  handoffNote?: string
  resolvedByFacultyId?: string
  scheduleMeta?: ScheduleMeta
}

export type BackendTaskUpsertPayload = {
  taskId: string
  studentId: string
  offeringId: string
  assignedTo: Role
  taskType: TaskType
  status: TaskStatus
  dueDateISO?: string
  dueLabel: string
  note: string
  escalated: boolean
  requestNote?: string
  remedialPlan?: RemedialPlan
  scheduleMeta?: ScheduleMeta
  createdAt: number
  updatedAt: number
}

export function normalizeThemeMode(raw: string | null): ThemeMode {
  if (raw === 'light') return 'frosted-focus-light'
  if (raw === 'dark') return 'frosted-focus-dark'
  if (raw === 'frosted-focus-light' || raw === 'frosted-focus-dark') return raw
  return 'frosted-focus-dark'
}

export function toDueLabel(dueDateISO?: string, fallback = 'This week') {
  if (!dueDateISO) return fallback
  const dueDate = new Date(`${dueDateISO}T00:00:00`)
  if (Number.isNaN(dueDate.getTime())) return fallback
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return 'Today'
  if (diffDays <= 7) return 'This week'
  return dueDateISO
}

export function toTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function parseDateParts(dateISO: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  const value = new Date(Date.UTC(year, month - 1, day))
  if (
    value.getUTCFullYear() !== year
    || value.getUTCMonth() !== month - 1
    || value.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function normalizeDateISO(dateISO?: string) {
  if (!dateISO) return undefined
  if (!parseDateParts(dateISO)) return undefined
  return dateISO
}

export function advanceByPreset(dateISO: string, preset: SchedulePreset) {
  const parts = parseDateParts(dateISO)
  if (!parts) return dateISO
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (preset === 'daily') base.setUTCDate(base.getUTCDate() + 1)
  if (preset === 'weekly') base.setUTCDate(base.getUTCDate() + 7)
  if (preset === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1)
  if (preset === 'weekdays') {
    do {
      base.setUTCDate(base.getUTCDate() + 1)
    } while (base.getUTCDay() === 0 || base.getUTCDay() === 6)
  }
  return base.toISOString().slice(0, 10)
}

export function getNextScheduledDate(meta?: ScheduleMeta, currentDateISO?: string) {
  if (!meta || meta.mode !== 'scheduled' || meta.status === 'ended' || meta.status === 'paused') return undefined
  const todayISO = toTodayISO()
  const current = normalizeDateISO(currentDateISO) ?? normalizeDateISO(meta.nextDueDateISO) ?? todayISO
  if (meta.preset === 'custom dates') {
    const completed = new Set(meta.completedDatesISO ?? [])
    return (meta.customDates ?? [])
      .map(item => item.dateISO)
      .filter(date => date >= todayISO && date > current && !completed.has(date))
      .sort()[0]
  }
  if (!meta.preset) return undefined
  return advanceByPreset(current, meta.preset)
}

export function createTransition(input: { action: string; actorRole: QueueTransition['actorRole']; toOwner: Role; note: string; fromOwner?: Role; actorTeacherId?: string }): QueueTransition {
  return {
    id: `transition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    actorRole: input.actorRole,
    actorTeacherId: input.actorTeacherId,
    action: input.action,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    note: input.note,
  }
}

export function getRemedialProgress(plan?: RemedialPlan) {
  if (!plan) return { completed: 0, total: 0 }
  const completed = plan.steps.filter(step => !!step.completedAt).length
  return { completed, total: plan.steps.length }
}

export function toBackendTaskPayload(task: SharedTask): BackendTaskUpsertPayload {
  return {
    taskId: task.id,
    studentId: task.studentId,
    offeringId: task.offeringId,
    assignedTo: task.assignedTo,
    taskType: task.taskType ?? 'Follow-up',
    status: task.status,
    dueDateISO: task.dueDateISO,
    dueLabel: task.due,
    note: task.actionHint,
    escalated: !!task.escalated,
    requestNote: task.requestNote ?? task.unlockRequest?.requestNote,
    remedialPlan: task.remedialPlan,
    scheduleMeta: task.scheduleMeta,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt ?? task.createdAt,
  }
}
