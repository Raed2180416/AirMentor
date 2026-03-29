import { describe, expect, it, vi } from 'vitest'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories, createLocalAirMentorRepositories } from '../src/repositories'
import type { AirMentorApiClientLike } from '../src/api/client'
import type { ApiAcademicBootstrap, ApiLoginRequest, ApiSessionResponse, ApiUiPreferences } from '../src/api/types'
import type { CalendarAuditEvent, SharedTask, TaskCalendarPlacement } from '../src/domain'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>()

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }

  removeItem(key: string) {
    this.data.delete(key)
  }
}

function createSessionResponse(overrides?: Partial<ApiSessionResponse>): ApiSessionResponse {
  return {
    sessionId: 'session-1',
    csrfToken: 'csrf-session-1',
    user: {
      userId: 'user-1',
      username: 'sysadmin',
      email: 'sysadmin@example.com',
    },
    faculty: {
      facultyId: 'fac_sysadmin',
      displayName: 'System Admin',
    },
    activeRoleGrant: {
      grantId: 'grant-system-admin',
      facultyId: 'fac_sysadmin',
      roleCode: 'SYSTEM_ADMIN',
      scopeType: 'institution',
      scopeId: 'inst_1',
      status: 'active',
      version: 1,
    },
    availableRoleGrants: [
      {
        grantId: 'grant-system-admin',
        facultyId: 'fac_sysadmin',
        roleCode: 'SYSTEM_ADMIN',
        scopeType: 'institution',
        scopeId: 'inst_1',
        status: 'active',
        version: 1,
      },
      {
        grantId: 'grant-hod',
        facultyId: 'fac_sysadmin',
        roleCode: 'HOD',
        scopeType: 'department',
        scopeId: 'dept_cse',
        status: 'active',
        version: 1,
      },
    ],
    preferences: {
      userId: 'user-1',
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: '2026-03-16T00:00:00.000Z',
    },
    ...overrides,
  }
}

function createApiClientMock(overrides: Partial<AirMentorApiClientLike>): AirMentorApiClientLike {
  return new Proxy(overrides as AirMentorApiClientLike, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver)
      return vi.fn(async () => {
        throw new Error(`Unexpected API call in repositories-http.test: ${String(prop)}`)
      })
    },
  })
}

describe('HTTP repository mode', () => {
  it('uses the remote session adapter while keeping local operational repositories', async () => {
    const storage = new MemoryStorage()
    storage.setItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId, 'faculty-academic')
    const remoteSession = createSessionResponse()
    const switchedSession = createSessionResponse({
      activeRoleGrant: {
        ...remoteSession.availableRoleGrants[1],
      },
    })
    let persistedRemoteSession = remoteSession
    const preferencesResponse: ApiUiPreferences = {
      userId: 'user-1',
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: '2026-03-16T00:00:00.000Z',
    }
    const academicBootstrap: ApiAcademicBootstrap = {
      professor: {
        name: 'Dr. Kavitha Rao',
        id: 'FET-CSE-2018-047',
        dept: 'Computer Science & Engineering',
        role: 'Associate Professor',
        initials: 'KR',
        email: 'kavitha.rao@msruas.ac.in',
      },
      faculty: [],
      offerings: [],
      yearGroups: [],
      mentees: [],
      teachers: [],
      subjectRuns: [],
      studentsByOffering: {},
      studentHistoryByUsn: {},
      courseOutcomesByOffering: {},
      assessmentSchemesByOffering: {},
      questionPapersByOffering: {},
      coAttainmentByOffering: {},
      meetings: [],
      runtime: {
        studentPatches: {},
        schemeByOffering: {},
        ttBlueprintsByOffering: {},
        drafts: {},
        cellValues: {},
        lockByOffering: {},
        lockAuditByTarget: {},
        tasks: [],
        resolvedTasks: {},
        timetableByFacultyId: {},
        adminCalendarByFacultyId: {},
        taskPlacements: {},
        calendarAudit: [],
      },
    }
    const client = createApiClientMock({
      restoreSession: vi.fn(async () => persistedRemoteSession),
      login: vi.fn(async (_payload: ApiLoginRequest) => remoteSession),
      logout: vi.fn(async () => undefined),
      switchRoleContext: vi.fn(async () => {
        persistedRemoteSession = switchedSession
        return switchedSession
      }),
      listAcademicLoginFaculty: vi.fn(async () => ({ items: [] })),
      getAcademicBootstrap: vi.fn(async () => academicBootstrap),
      getUiPreferences: vi.fn(async () => preferencesResponse),
      saveUiPreferences: vi.fn(async ({ themeMode, version }) => ({
        userId: 'user-1',
        themeMode,
        version: version + 1,
        updatedAt: '2026-03-16T00:00:00.000Z',
      })),
      getInstitution: vi.fn(),
      updateInstitution: vi.fn(),
      listDepartments: vi.fn(),
      createDepartment: vi.fn(),
      updateDepartment: vi.fn(),
      listBranches: vi.fn(),
      createBranch: vi.fn(),
      updateBranch: vi.fn(),
      listFaculty: vi.fn(),
      listStudents: vi.fn(),
      listCourses: vi.fn(),
      createCourse: vi.fn(),
      updateCourse: vi.fn(),
      listOfferings: vi.fn(),
      createOffering: vi.fn(),
      updateOffering: vi.fn(),
      listOfferingOwnership: vi.fn(),
      createOfferingOwnership: vi.fn(),
      updateOfferingOwnership: vi.fn(),
      listAdminRequests: vi.fn(),
      getAdminRequest: vi.fn(),
      assignAdminRequest: vi.fn(),
      requestAdminRequestInfo: vi.fn(),
      approveAdminRequest: vi.fn(),
      rejectAdminRequest: vi.fn(),
      markAdminRequestImplemented: vi.fn(),
      closeAdminRequest: vi.fn(),
      addAdminRequestNote: vi.fn(),
      getAdminRequestAudit: vi.fn(),
    })

    const repositories = createAirMentorRepositories({
      storage,
      repositoryMode: 'http',
      apiClient: client,
    })

    const restored = await repositories.sessionPreferences.restoreRemoteSession()
    expect(restored?.faculty?.facultyId).toBe('fac_sysadmin')
    expect(repositories.sessionPreferences.getCurrentFacultyIdSnapshot()).toBe('fac_sysadmin')
    expect(storage.getItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)).toBe('faculty-academic')
    expect(storage.getItem(AIRMENTOR_STORAGE_KEYS.currentAdminFacultyId)).toBe('fac_sysadmin')

    await repositories.sessionPreferences.saveTheme('frosted-focus-dark')
    expect(repositories.sessionPreferences.getThemeSnapshot()).toBe('frosted-focus-dark')
    expect(client.saveUiPreferences).toHaveBeenCalledWith({
      themeMode: 'frosted-focus-dark',
      version: 1,
    })

    const switched = await repositories.sessionPreferences.switchRemoteRoleContext('grant-hod')
    expect(switched.activeRoleGrant.roleCode).toBe('HOD')

    const faculty = await repositories.offeringsStudentsHistory.listFaculty()
    expect(faculty.length).toBeGreaterThan(0)

    const localRepositories = createLocalAirMentorRepositories(storage)
    expect(localRepositories.sessionPreferences.getCurrentFacultyIdSnapshot()).toBe('faculty-academic')
  })

  it('does not persist a normalized timetable snapshot back to the API on first HTTP render', async () => {
    const storage = new MemoryStorage()
    const saveFacultyCalendarWorkspace = vi.fn(async () => ({
      facultyId: 'fac_course_leader',
      template: {
        facultyId: 'fac_course_leader',
        slots: [],
        dayStartMinutes: 510,
        dayEndMinutes: 930,
        classBlocks: [],
        updatedAt: 1,
      },
      version: 1,
      directEditWindowEndsAt: null,
      classEditingLocked: false,
    }))
    const client = {
      saveFacultyCalendarWorkspace,
    } as unknown as AirMentorApiClientLike

    const bootstrap: ApiAcademicBootstrap = {
      professor: {
        name: 'Dr. Devika Shetty',
        id: 'mnc_t1',
        dept: 'Mathematics and Computing',
        role: 'Course Leader',
        initials: 'DS',
        email: 'devika.shetty@msruas.ac.in',
      },
      faculty: [
        {
          facultyId: 'fac_course_leader',
          name: 'Dr. Devika Shetty',
          initials: 'DS',
          dept: 'MNC',
          roleTitle: 'Professor',
          email: 'devika.shetty@msruas.ac.in',
          offeringIds: ['off_001'],
          courseCodes: ['MCC301A'],
          allowedRoles: ['Course Leader'],
          menteeIds: [],
        },
      ],
      offerings: [
        {
          id: 'course_graph_theory',
          offId: 'off_001',
          code: 'MCC301A',
          title: 'Graph Theory',
          dept: 'MNC',
          sem: 5,
          section: 'A',
          year: '3rd Year',
          count: 60,
          attendance: 0,
          stage: 1,
          stageInfo: {
            stage: 1,
            label: 'Stage 1',
            desc: 'Proof',
            color: '#2563eb',
          },
          tt1Done: false,
          tt2Done: false,
          tt1Locked: false,
          tt2Locked: false,
          quizLocked: false,
          asgnLocked: false,
          pendingAction: null,
          sections: ['A'],
          enrolled: [60],
          att: [0],
        },
      ],
      yearGroups: [],
      mentees: [],
      teachers: [],
      subjectRuns: [],
      studentsByOffering: {},
      studentHistoryByUsn: {},
      courseOutcomesByOffering: {},
      assessmentSchemesByOffering: {},
      questionPapersByOffering: {},
      coAttainmentByOffering: {},
      meetings: [],
      runtime: {
        studentPatches: {},
        schemeByOffering: {},
        ttBlueprintsByOffering: {},
        drafts: {},
        cellValues: {},
        lockByOffering: {},
        lockAuditByTarget: {},
        tasks: [],
        resolvedTasks: {},
        timetableByFacultyId: {
          fac_course_leader: {
            facultyId: 'fac_course_leader',
            slots: [],
            dayStartMinutes: 510,
            dayEndMinutes: 930,
            classBlocks: [
              {
                id: 'class-1',
                facultyId: 'legacy-faculty',
                offeringId: 'off_001',
                courseCode: 'MCC301A',
                courseName: 'Graph Theory',
                section: 'A',
                year: '3rd Year',
                day: 'Mon',
                startMinutes: 540,
                endMinutes: 600,
              },
            ],
            updatedAt: 1,
          },
        },
        taskPlacements: {},
        calendarAudit: [],
        adminCalendarByFacultyId: {},
      },
    }

    const repositories = createAirMentorRepositories({
      storage,
      repositoryMode: 'http',
      apiClient: createApiClientMock(client),
      academicBootstrap: bootstrap,
    })

    const snapshot = repositories.calendar.getTimetableTemplatesSnapshot(bootstrap.faculty, bootstrap.offerings)
    expect(snapshot.fac_course_leader.facultyId).toBe('fac_course_leader')

    await repositories.calendar.saveTimetableTemplates(snapshot)

    expect(saveFacultyCalendarWorkspace).not.toHaveBeenCalled()
  })

  it('clears HTTP-mode local cache and storage without bulk-resetting runtime state through the generic API', async () => {
    const storage = new MemoryStorage()
    storage.setItem(AIRMENTOR_STORAGE_KEYS.themeMode, 'frosted-focus-dark')
    storage.setItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId, 'faculty-academic')

    const saveAcademicDrafts = vi.fn(async () => ({ ok: true as const, stateKey: 'drafts' as const }))
    const saveAcademicCellValues = vi.fn(async () => ({ ok: true as const, stateKey: 'cellValues' as const }))
    const saveAcademicLockByOffering = vi.fn(async () => ({ ok: true as const, stateKey: 'lockByOffering' as const }))
    const saveAcademicLockAuditByTarget = vi.fn(async () => ({ ok: true as const, stateKey: 'lockAuditByTarget' as const }))
    const createAcademicMeeting = vi.fn(async () => ({
      meetingId: 'meeting-2',
      version: 1,
      facultyId: 'fac-course-leader',
      studentId: 'student-2',
      studentName: 'Diya Nair',
      studentUsn: '1MS23CS002',
      title: 'Recovery follow-up',
      notes: 'Escalated locally',
      dateISO: '2026-03-23',
      startMinutes: 660,
      endMinutes: 690,
      status: 'scheduled' as const,
      createdByFacultyId: 'fac-course-leader',
      createdAt: 1_710_000_010_000,
      updatedAt: 1_710_000_010_000,
    }))

    const bootstrap: ApiAcademicBootstrap = {
      professor: {
        name: 'Dr. Kavitha Rao',
        id: 'FET-CSE-2018-047',
        dept: 'Computer Science & Engineering',
        role: 'Associate Professor',
        initials: 'KR',
        email: 'kavitha.rao@msruas.ac.in',
      },
      faculty: [],
      offerings: [],
      yearGroups: [],
      mentees: [],
      teachers: [],
      subjectRuns: [],
      studentsByOffering: {},
      studentHistoryByUsn: {},
      courseOutcomesByOffering: {},
      assessmentSchemesByOffering: {},
      questionPapersByOffering: {},
      coAttainmentByOffering: {},
      meetings: [
        {
          meetingId: 'meeting-1',
          version: 1,
          facultyId: 'fac-course-leader',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          studentUsn: '1MS23CS001',
          title: 'Baseline review',
          notes: 'Original server snapshot',
          dateISO: '2026-03-21',
          startMinutes: 600,
          endMinutes: 630,
          status: 'scheduled',
          createdByFacultyId: 'fac-course-leader',
          createdAt: 1_710_000_000_000,
          updatedAt: 1_710_000_000_000,
        },
      ],
      runtime: {
        studentPatches: {},
        schemeByOffering: {},
        ttBlueprintsByOffering: {},
        drafts: {
          'draft-1': 5,
        },
        cellValues: {},
        lockByOffering: {},
        lockAuditByTarget: {},
        tasks: [],
        resolvedTasks: {},
        timetableByFacultyId: {},
        adminCalendarByFacultyId: {},
        taskPlacements: {},
        calendarAudit: [],
      },
    }

    const repositories = createAirMentorRepositories({
      storage,
      repositoryMode: 'http',
      apiClient: createApiClientMock({
        saveAcademicDrafts,
        saveAcademicCellValues,
        saveAcademicLockByOffering,
        saveAcademicLockAuditByTarget,
        createAcademicMeeting,
      }),
      academicBootstrap: bootstrap,
    })

    await repositories.entryData.saveDrafts({ 'draft-1': 9, 'draft-2': 3 })
    expect(saveAcademicDrafts).toHaveBeenCalledTimes(1)
    expect(repositories.entryData.getDraftSnapshot()).toEqual({ 'draft-1': 9, 'draft-2': 3 })
    await repositories.entryData.saveCellValues({ 'cell-1': 84 })
    expect(saveAcademicCellValues).toHaveBeenCalledTimes(1)
    await repositories.locksAudit.saveLocks({
      off_001: {
        attendance: true,
        tt1: false,
        tt2: false,
        quiz: false,
        assignment: false,
        finals: false,
      },
    })
    expect(saveAcademicLockByOffering).toHaveBeenCalledTimes(1)
    await repositories.locksAudit.saveLockAudit({
      off_001: [{
        id: 'transition-lock-1',
        action: 'lock',
        actorRole: 'Course Leader',
        toOwner: 'Course Leader',
        note: 'Local lock persisted for attendance.',
        at: 1_710_000_012_000,
      }],
    })
    expect(saveAcademicLockAuditByTarget).toHaveBeenCalledTimes(1)

    await repositories.calendar.createMeeting({
      studentId: 'student-2',
      title: 'Recovery follow-up',
      notes: 'Escalated locally',
      dateISO: '2026-03-23',
      startMinutes: 660,
      endMinutes: 690,
      status: 'scheduled',
    })
    expect(repositories.calendar.getMeetingsSnapshot()).toHaveLength(2)

    saveAcademicDrafts.mockClear()
    saveAcademicCellValues.mockClear()
    saveAcademicLockByOffering.mockClear()
    saveAcademicLockAuditByTarget.mockClear()

    await repositories.clearPersistedState()

    expect(saveAcademicDrafts).not.toHaveBeenCalled()
    expect(saveAcademicCellValues).not.toHaveBeenCalled()
    expect(saveAcademicLockByOffering).not.toHaveBeenCalled()
    expect(saveAcademicLockAuditByTarget).not.toHaveBeenCalled()
    expect(repositories.entryData.getDraftSnapshot()).toEqual(bootstrap.runtime.drafts)
    expect(repositories.calendar.getMeetingsSnapshot()).toEqual(bootstrap.meetings)
    expect(storage.getItem(AIRMENTOR_STORAGE_KEYS.themeMode)).toBeNull()
    expect(storage.getItem(AIRMENTOR_STORAGE_KEYS.currentFacultyId)).toBeNull()
  })

  it('uses the narrow academic runtime contracts for per-entity task, placement, and calendar-audit writes', async () => {
    const storage = new MemoryStorage()
    const saveAcademicTask = vi.fn(async (_taskId: string, payload: { task: SharedTask; expectedVersion?: number }) => ({
      task: {
        ...payload.task,
        version: payload.expectedVersion ? payload.expectedVersion + 1 : 1,
      },
      created: !payload.expectedVersion,
    }))
    const saveAcademicTaskPlacement = vi.fn(async (_taskId: string, payload: { placement: TaskCalendarPlacement }) => ({
      placement: payload.placement,
      created: false,
    }))
    const deleteAcademicTaskPlacement = vi.fn(async (taskId: string) => ({
      ok: true as const,
      taskId,
      deleted: true,
    }))
    const appendAcademicCalendarAuditEvent = vi.fn(async (payload: { event: CalendarAuditEvent }) => ({
      event: payload.event,
      created: true,
    }))

    const bootstrap: ApiAcademicBootstrap = {
      professor: {
        name: 'Dr. Kavitha Rao',
        id: 'FET-CSE-2018-047',
        dept: 'Computer Science & Engineering',
        role: 'Associate Professor',
        initials: 'KR',
        email: 'kavitha.rao@msruas.ac.in',
      },
      faculty: [],
      offerings: [],
      yearGroups: [],
      mentees: [],
      teachers: [],
      subjectRuns: [],
      studentsByOffering: {},
      studentHistoryByUsn: {},
      courseOutcomesByOffering: {},
      assessmentSchemesByOffering: {},
      questionPapersByOffering: {},
      coAttainmentByOffering: {},
      meetings: [],
      runtime: {
        studentPatches: {},
        schemeByOffering: {},
        ttBlueprintsByOffering: {},
        drafts: {},
        cellValues: {},
        lockByOffering: {},
        lockAuditByTarget: {},
        tasks: [
          {
            id: 'task-1',
            studentId: 'student-1',
            studentName: 'Aarav Sharma',
            studentUsn: '1MS23CS001',
            offeringId: 'off-1',
            courseCode: 'MCC301A',
            courseName: 'Graph Theory',
            year: '3rd Year',
            riskProb: 0.62,
            riskBand: 'Medium',
            title: 'Follow-up',
            due: 'Today',
            status: 'In Progress',
            actionHint: 'Meet the student',
            priority: 62,
            createdAt: 1_710_000_000_000,
            updatedAt: 1_710_000_000_500,
            assignedTo: 'Course Leader',
          },
        ],
        resolvedTasks: {},
        timetableByFacultyId: {},
        adminCalendarByFacultyId: {},
        taskPlacements: {
          'task-1': {
            taskId: 'task-1',
            dateISO: '2026-03-20',
            placementMode: 'timed',
            startMinutes: 570,
            endMinutes: 600,
            updatedAt: 1_710_000_001_000,
          },
        },
        calendarAudit: [
          {
            id: 'audit-1',
            facultyId: 'fac-1',
            actorRole: 'Course Leader',
            actorFacultyId: 'fac-1',
            timestamp: 1_710_000_001_500,
            actionKind: 'task-scheduled',
            targetType: 'task',
            targetId: 'task-1',
            note: 'Scheduled task-1.',
            after: {
              dateISO: '2026-03-20',
              startMinutes: 570,
              endMinutes: 600,
              placementMode: 'timed',
              offeringId: 'off-1',
            },
          },
        ],
      },
    }

    const repositories = createAirMentorRepositories({
      storage,
      repositoryMode: 'http',
      apiClient: createApiClientMock({
        saveAcademicTask,
        saveAcademicTaskPlacement,
        deleteAcademicTaskPlacement,
        appendAcademicCalendarAuditEvent,
      }),
      academicBootstrap: bootstrap,
    })

    await repositories.tasks.saveTasks([
      {
        ...bootstrap.runtime.tasks[0],
        title: 'Follow-up: confirm recovery plan',
        updatedAt: 1_710_000_002_000,
      },
      {
        id: 'task-2',
        studentId: 'student-2',
        studentName: 'Diya Nair',
        studentUsn: '1MS23CS002',
        offeringId: 'off-1',
        courseCode: 'MCC301A',
        courseName: 'Graph Theory',
        year: '3rd Year',
        riskProb: 0.71,
        riskBand: 'High',
        title: 'Escalate mentoring',
        due: 'Tomorrow',
        status: 'New',
        actionHint: 'Escalate to mentor',
        priority: 71,
        createdAt: 1_710_000_002_500,
        updatedAt: 1_710_000_002_500,
        assignedTo: 'Course Leader',
      },
    ])

    await repositories.calendar.saveTaskPlacements({
      'task-2': {
        taskId: 'task-2',
        dateISO: '2026-03-21',
        placementMode: 'timed',
        startMinutes: 630,
        endMinutes: 660,
        updatedAt: 1_710_000_003_000,
      },
    })

    await repositories.calendar.saveCalendarAudit([
      ...bootstrap.runtime.calendarAudit,
      {
        id: 'audit-2',
        facultyId: 'fac-1',
        actorRole: 'Course Leader',
        actorFacultyId: 'fac-1',
        timestamp: 1_710_000_003_500,
        actionKind: 'task-created-and-scheduled',
        targetType: 'task',
        targetId: 'task-2',
        note: 'Created and scheduled task-2.',
        after: {
          dateISO: '2026-03-21',
          startMinutes: 630,
          endMinutes: 660,
          placementMode: 'timed',
          offeringId: 'off-1',
        },
      },
    ])

    expect(saveAcademicTask).toHaveBeenCalledTimes(2)
    expect(saveAcademicTask).toHaveBeenNthCalledWith(1, 'task-1', expect.objectContaining({
      expectedVersion: undefined,
      task: expect.objectContaining({
        id: 'task-1',
        title: 'Follow-up: confirm recovery plan',
      }),
    }))
    expect(saveAcademicTask).toHaveBeenNthCalledWith(2, 'task-2', expect.objectContaining({
      task: expect.objectContaining({
        id: 'task-2',
      }),
    }))

    expect(saveAcademicTaskPlacement).toHaveBeenCalledTimes(1)
    expect(saveAcademicTaskPlacement).toHaveBeenCalledWith('task-2', expect.objectContaining({
      expectedUpdatedAt: undefined,
      placement: expect.objectContaining({
        taskId: 'task-2',
      }),
    }))
    expect(deleteAcademicTaskPlacement).toHaveBeenCalledWith('task-1', 1_710_000_001_000)

    expect(appendAcademicCalendarAuditEvent).toHaveBeenCalledTimes(1)
    expect(appendAcademicCalendarAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({
        id: 'audit-2',
      }),
    }))
  })
})
