import { describe, expect, it, vi } from 'vitest'
import { AIRMENTOR_STORAGE_KEYS, createAirMentorRepositories, createLocalAirMentorRepositories } from '../src/repositories'
import type { AirMentorApiClientLike } from '../src/api/client'
import type { ApiAcademicBootstrap, ApiLoginRequest, ApiSessionResponse, ApiUiPreferences } from '../src/api/types'

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
      saveAcademicRuntimeSlice: vi.fn(async stateKey => ({ ok: true as const, stateKey })),
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
      saveAcademicRuntimeSlice: vi.fn(async stateKey => ({ ok: true as const, stateKey })),
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
})
