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
        taskPlacements: {},
        calendarAudit: [],
      },
    }
    const client: AirMentorApiClientLike = {
      restoreSession: vi.fn(async () => remoteSession),
      login: vi.fn(async (_payload: ApiLoginRequest) => remoteSession),
      logout: vi.fn(async () => undefined),
      switchRoleContext: vi.fn(async () => switchedSession),
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
    }

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
})
