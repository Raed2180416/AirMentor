import {
  FACULTY,
  MENTEES,
  OFFERINGS,
  getStudentHistoryRecord,
  getStudents,
  type Mentee,
  type Offering,
  type Student,
  type StudentHistoryRecord,
} from './data'
import { AirMentorApiClient, AirMentorApiError, type AirMentorApiClientLike } from './api/client'
import type { ApiLoginRequest, ApiSessionResponse } from './api/types'
import {
  type CalendarAuditEvent,
  createTransition,
  type FacultyTimetableTemplate,
  normalizeThemeMode,
  type TaskCalendarPlacement,
  toBackendTaskPayload,
  type BackendTaskUpsertPayload,
  type EntryLockMap,
  type FacultyAccount,
  type QueueTransition,
  type SchemeState,
  type SharedTask,
  type StudentRuntimePatch,
  type TTKind,
  type TermTestBlueprint,
  type ThemeMode,
} from './domain'
import { normalizeFacultyTimetableTemplate, normalizeTaskCalendarPlacement } from './calendar-utils'
import {
  getEntryLockMap,
  normalizeBlueprint,
  normalizeSchemeState,
  seedBlueprintFromPaper,
} from './selectors'
import { PAPER_MAP } from './data'

type JsonStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type RepositoryMode = 'local' | 'http'

export const AIRMENTOR_STORAGE_KEYS = {
  themeMode: 'airmentor-theme',
  currentFacultyId: 'airmentor-current-faculty-id',
  legacyCurrentTeacherId: 'airmentor-current-teacher-id',
  studentPatches: 'airmentor-student-patches',
  schemeState: 'airmentor-schemes',
  blueprintState: 'airmentor-tt-blueprints',
  lockAudit: 'airmentor-lock-audit',
  locks: 'airmentor-locks',
  drafts: 'airmentor-drafts',
  cellValues: 'airmentor-cell-values',
  timetableTemplates: 'airmentor-timetable-templates',
  taskPlacements: 'airmentor-task-placements',
  calendarAudit: 'airmentor-calendar-audit',
  allTasks: 'airmentor-all-tasks',
  resolvedTasks: 'airmentor-resolved-tasks',
} as const

const AIRMENTOR_STORAGE_KEY_LIST = Object.values(AIRMENTOR_STORAGE_KEYS)

function resolveStorage(storage?: JsonStorage) {
  if (storage) return storage
  if (typeof window !== 'undefined') return window.localStorage
  return undefined
}

function readJson<T>(storage: JsonStorage | undefined, key: string, fallback: T): T {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(storage: JsonStorage | undefined, key: string, value: unknown) {
  if (!storage) return
  storage.setItem(key, JSON.stringify(value))
}

function normalizePersistedTask(task: Partial<SharedTask>): SharedTask {
  const createdAt = typeof task.createdAt === 'number' ? task.createdAt : Date.now()
  const assignedTo = task.assignedTo ?? 'Course Leader'
  return {
    id: task.id ?? `task-${Date.now()}`,
    studentId: task.studentId ?? '',
    studentName: task.studentName ?? 'Unknown Student',
    studentUsn: task.studentUsn ?? 'N/A',
    offeringId: task.offeringId ?? '',
    courseCode: task.courseCode ?? 'GEN',
    courseName: task.courseName ?? 'Recovered Task',
    year: task.year ?? '',
    riskProb: typeof task.riskProb === 'number' ? task.riskProb : 0,
    riskBand: task.riskBand ?? 'Low',
    title: task.title ?? 'Recovered queue item',
    due: task.due ?? 'This week',
    status: task.status ?? 'New',
    actionHint: task.actionHint ?? 'Recovered persisted queue item.',
    priority: typeof task.priority === 'number' ? task.priority : 0,
    createdAt,
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : createdAt,
    taskType: task.taskType ?? 'Follow-up',
    assignedTo,
    dueDateISO: task.dueDateISO,
    remedialPlan: task.remedialPlan,
    escalated: !!task.escalated,
    sourceRole: task.sourceRole,
    manual: task.manual,
    transitionHistory: Array.isArray(task.transitionHistory) && task.transitionHistory.length > 0
      ? task.transitionHistory
      : [createTransition({
          action: 'Imported into local mock state',
          actorRole: 'System',
          toOwner: assignedTo,
          note: 'Recovered persisted queue item.',
        })],
    unlockRequest: task.unlockRequest,
    requestNote: task.requestNote,
    handoffNote: task.handoffNote,
    resolvedByFacultyId: task.resolvedByFacultyId,
    scheduleMeta: task.scheduleMeta,
    dismissal: task.dismissal,
  }
}

export interface SessionPreferencesRepository {
  getThemeSnapshot(): ThemeMode | null
  getCurrentFacultyIdSnapshot(): string | null
  saveTheme(mode: ThemeMode): Promise<void>
  saveCurrentFacultyId(facultyId: string | null): Promise<void>
  restoreRemoteSession(): Promise<ApiSessionResponse | null>
  loginRemoteSession(payload: ApiLoginRequest): Promise<ApiSessionResponse>
  logoutRemoteSession(): Promise<void>
  switchRemoteRoleContext(roleGrantId: string): Promise<ApiSessionResponse>
}

export interface OfferingsStudentsHistoryRepository {
  listFaculty(): Promise<FacultyAccount[]>
  listOfferings(): Promise<Offering[]>
  listStudents(offering: Offering): Promise<Student[]>
  listMentees(): Promise<Mentee[]>
  getStudentHistory(params: { usn: string; studentName: string; dept: string; yearLabel?: string; prevCgpa?: number }): Promise<StudentHistoryRecord | null>
}

export interface EntryDataRepository {
  getStudentPatchesSnapshot(): Record<string, StudentRuntimePatch>
  getSchemeStateSnapshot(offerings: Offering[]): Record<string, SchemeState>
  getBlueprintSnapshot(offerings: Offering[]): Record<string, Record<TTKind, TermTestBlueprint>>
  getDraftSnapshot(): Record<string, number>
  getCellValueSnapshot(): Record<string, number>
  saveStudentPatches(next: Record<string, StudentRuntimePatch>): Promise<void>
  saveSchemeState(next: Record<string, SchemeState>): Promise<void>
  saveBlueprintState(next: Record<string, Record<TTKind, TermTestBlueprint>>): Promise<void>
  saveDrafts(next: Record<string, number>): Promise<void>
  saveCellValues(next: Record<string, number>): Promise<void>
}

export interface LocksAuditRepository {
  getLockSnapshot(offerings: Offering[]): Record<string, EntryLockMap>
  getLockAuditSnapshot(): Record<string, QueueTransition[]>
  saveLocks(next: Record<string, EntryLockMap>): Promise<void>
  saveLockAudit(next: Record<string, QueueTransition[]>): Promise<void>
}

export interface TaskRepository {
  getTasksSnapshot(seedFactory: () => SharedTask[]): SharedTask[]
  getResolvedTasksSnapshot(fallback: Record<string, number>): Record<string, number>
  saveTasks(next: SharedTask[]): Promise<void>
  saveResolvedTasks(next: Record<string, number>): Promise<void>
  upsertTask(task: SharedTask): Promise<BackendTaskUpsertPayload>
}

export interface CalendarRepository {
  getTimetableTemplatesSnapshot(faculty: FacultyAccount[], offerings: Offering[]): Record<string, FacultyTimetableTemplate>
  getTaskPlacementsSnapshot(): Record<string, TaskCalendarPlacement>
  getCalendarAuditSnapshot(): CalendarAuditEvent[]
  saveTimetableTemplates(next: Record<string, FacultyTimetableTemplate>): Promise<void>
  saveTaskPlacements(next: Record<string, TaskCalendarPlacement>): Promise<void>
  saveCalendarAudit(next: CalendarAuditEvent[]): Promise<void>
}

export interface AirMentorRepositories {
  sessionPreferences: SessionPreferencesRepository
  offeringsStudentsHistory: OfferingsStudentsHistoryRepository
  entryData: EntryDataRepository
  locksAudit: LocksAuditRepository
  tasks: TaskRepository
  calendar: CalendarRepository
  clearPersistedState(): Promise<void>
}

function getConfiguredRepositoryMode(): RepositoryMode {
  const value = import.meta.env.VITE_AIRMENTOR_REPOSITORY_MODE
  return value === 'http' ? 'http' : 'local'
}

function getConfiguredApiBaseUrl() {
  return import.meta.env.VITE_AIRMENTOR_API_BASE_URL ?? 'http://127.0.0.1:4000'
}

function writeThemeSnapshot(storage: JsonStorage | undefined, mode: ThemeMode) {
  if (!storage) return
  storage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, mode)
}

function writeFacultySnapshot(storage: JsonStorage | undefined, facultyId: string | null) {
  if (!storage) return
  if (facultyId) storage.setItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId, facultyId)
  else storage.removeItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)
  storage.removeItem(AIRMENTOR_STORAGE_KEYS.legacyCurrentTeacherId)
}

function createUnsupportedRemoteSessionError() {
  return new Error('Remote session APIs are unavailable in local repository mode.')
}

export function createLocalAirMentorRepositories(storage?: JsonStorage): AirMentorRepositories {
  const resolvedStorage = resolveStorage(storage)

  return {
    sessionPreferences: {
      getThemeSnapshot() {
        if (!resolvedStorage) return null
        return normalizeThemeMode(resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.themeMode))
      },
      getCurrentFacultyIdSnapshot() {
        if (!resolvedStorage) return null
        return resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)
          ?? resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.legacyCurrentTeacherId)
      },
      async saveTheme(mode) {
        if (!resolvedStorage) return
        writeThemeSnapshot(resolvedStorage, mode)
      },
      async saveCurrentFacultyId(facultyId) {
        if (!resolvedStorage) return
        writeFacultySnapshot(resolvedStorage, facultyId)
      },
      async restoreRemoteSession() {
        return null
      },
      async loginRemoteSession() {
        throw createUnsupportedRemoteSessionError()
      },
      async logoutRemoteSession() {
        throw createUnsupportedRemoteSessionError()
      },
      async switchRemoteRoleContext() {
        throw createUnsupportedRemoteSessionError()
      },
    },
    offeringsStudentsHistory: {
      async listFaculty() {
        return FACULTY
      },
      async listOfferings() {
        return OFFERINGS
      },
      async listStudents(offering) {
        return getStudents(offering)
      },
      async listMentees() {
        return MENTEES
      },
      async getStudentHistory(params) {
        return getStudentHistoryRecord(params)
      },
    },
    entryData: {
      getStudentPatchesSnapshot() {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.studentPatches, {} as Record<string, StudentRuntimePatch>)
      },
      getSchemeStateSnapshot(offerings) {
        const parsed = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.schemeState, {} as Record<string, Partial<SchemeState>>)
        return Object.fromEntries(
          offerings.map(offering => [offering.offId, normalizeSchemeState(parsed[offering.offId], offering)]),
        ) as Record<string, SchemeState>
      },
      getBlueprintSnapshot(offerings) {
        const parsed = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.blueprintState, {} as Record<string, Record<TTKind, TermTestBlueprint>>)
        return Object.fromEntries(offerings.map(offering => {
          const source = parsed[offering.offId]
          const basePaper = PAPER_MAP[offering.code] || PAPER_MAP.default
          return [offering.offId, {
            tt1: normalizeBlueprint('tt1', source?.tt1 ?? seedBlueprintFromPaper('tt1', basePaper)),
            tt2: normalizeBlueprint('tt2', source?.tt2 ?? seedBlueprintFromPaper('tt2', basePaper)),
          }]
        })) as Record<string, Record<TTKind, TermTestBlueprint>>
      },
      getDraftSnapshot() {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.drafts, {} as Record<string, number>)
      },
      getCellValueSnapshot() {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.cellValues, {} as Record<string, number>)
      },
      async saveStudentPatches(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.studentPatches, next)
      },
      async saveSchemeState(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.schemeState, next)
      },
      async saveBlueprintState(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.blueprintState, next)
      },
      async saveDrafts(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.drafts, next)
      },
      async saveCellValues(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.cellValues, next)
      },
    },
    locksAudit: {
      getLockSnapshot(offerings) {
        const saved = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.locks, null as Record<string, EntryLockMap> | null)
        if (saved) return saved
        return Object.fromEntries(offerings.map(offering => [offering.offId, getEntryLockMap(offering)])) as Record<string, EntryLockMap>
      },
      getLockAuditSnapshot() {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.lockAudit, {} as Record<string, QueueTransition[]>)
      },
      async saveLocks(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.locks, next)
      },
      async saveLockAudit(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.lockAudit, next)
      },
    },
    tasks: {
      getTasksSnapshot(seedFactory) {
        const parsed = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.allTasks, null as Array<Partial<SharedTask>> | null)
        return parsed ? parsed.map(normalizePersistedTask) : seedFactory()
      },
      getResolvedTasksSnapshot(fallback) {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.resolvedTasks, fallback)
      },
      async saveTasks(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.allTasks, next)
      },
      async saveResolvedTasks(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.resolvedTasks, next)
      },
      async upsertTask(task) {
        return toBackendTaskPayload(task)
      },
    },
    calendar: {
      getTimetableTemplatesSnapshot(faculty, offerings) {
        const parsed = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.timetableTemplates, {} as Record<string, FacultyTimetableTemplate>)
        return Object.fromEntries(faculty.map(account => {
          const ownedOfferings = offerings.filter(offering => account.offeringIds.includes(offering.offId))
          return [account.facultyId, normalizeFacultyTimetableTemplate(parsed[account.facultyId], account, ownedOfferings)]
        })) as Record<string, FacultyTimetableTemplate>
      },
      getTaskPlacementsSnapshot() {
        const parsed = readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.taskPlacements, {} as Record<string, TaskCalendarPlacement>)
        return Object.fromEntries(
          Object.entries(parsed).map(([taskId, placement]) => [taskId, normalizeTaskCalendarPlacement(placement)]),
        ) as Record<string, TaskCalendarPlacement>
      },
      getCalendarAuditSnapshot() {
        return readJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.calendarAudit, [] as CalendarAuditEvent[])
      },
      async saveTimetableTemplates(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.timetableTemplates, next)
      },
      async saveTaskPlacements(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.taskPlacements, next)
      },
      async saveCalendarAudit(next) {
        writeJson(resolvedStorage, AIRMENTOR_STORAGE_KEYS.calendarAudit, next)
      },
    },
    async clearPersistedState() {
      if (!resolvedStorage) return
      AIRMENTOR_STORAGE_KEY_LIST.forEach(key => resolvedStorage.removeItem(key))
    },
  }
}

function createHttpSessionPreferencesRepository({
  storage,
  client,
}: {
  storage?: JsonStorage
  client: AirMentorApiClientLike
}): SessionPreferencesRepository {
  const resolvedStorage = resolveStorage(storage)

  function cacheSession(session: ApiSessionResponse | null) {
    const themeMode = session?.preferences.themeMode
    if (themeMode) writeThemeSnapshot(resolvedStorage, themeMode)
    writeFacultySnapshot(resolvedStorage, session?.faculty?.facultyId ?? null)
    return session
  }

  return {
    getThemeSnapshot() {
      if (!resolvedStorage) return null
      return normalizeThemeMode(resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.themeMode))
    },
    getCurrentFacultyIdSnapshot() {
      if (!resolvedStorage) return null
      return resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)
        ?? resolvedStorage.getItem(AIRMENTOR_STORAGE_KEYS.legacyCurrentTeacherId)
    },
    async saveTheme(mode) {
      writeThemeSnapshot(resolvedStorage, mode)
      try {
        const preferences = await client.getUiPreferences()
        await client.saveUiPreferences({ themeMode: mode, version: preferences.version })
      } catch (error) {
        if (!(error instanceof AirMentorApiError) || error.status !== 401) throw error
      }
    },
    async saveCurrentFacultyId(facultyId) {
      writeFacultySnapshot(resolvedStorage, facultyId)
    },
    async restoreRemoteSession() {
      try {
        return cacheSession(await client.restoreSession())
      } catch (error) {
        if (error instanceof AirMentorApiError && error.status === 401) return cacheSession(null)
        throw error
      }
    },
    async loginRemoteSession(payload) {
      return cacheSession(await client.login(payload)) as ApiSessionResponse
    },
    async logoutRemoteSession() {
      await client.logout()
      cacheSession(null)
    },
    async switchRemoteRoleContext(roleGrantId) {
      return cacheSession(await client.switchRoleContext(roleGrantId)) as ApiSessionResponse
    },
  }
}

export function createAirMentorRepositories(options?: {
  storage?: JsonStorage
  repositoryMode?: RepositoryMode
  apiClient?: AirMentorApiClientLike
}): AirMentorRepositories {
  const localRepositories = createLocalAirMentorRepositories(options?.storage)
  const repositoryMode = options?.repositoryMode ?? getConfiguredRepositoryMode()
  if (repositoryMode !== 'http') return localRepositories
  const client = options?.apiClient ?? new AirMentorApiClient(getConfiguredApiBaseUrl())
  return {
    ...localRepositories,
    sessionPreferences: createHttpSessionPreferencesRepository({
      storage: options?.storage,
      client,
    }),
  }
}

export { AIRMENTOR_STORAGE_KEY_LIST }
