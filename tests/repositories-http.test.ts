import { describe, expect, it, vi } from 'vitest'
import { createAirMentorRepositories } from '../src/repositories'
import type { AirMentorApiClientLike } from '../src/api/client'
import type { ApiLoginRequest, ApiSessionResponse, ApiUiPreferences } from '../src/api/types'

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
    const client: AirMentorApiClientLike = {
      restoreSession: vi.fn(async () => remoteSession),
      login: vi.fn(async (_payload: ApiLoginRequest) => remoteSession),
      logout: vi.fn(async () => undefined),
      switchRoleContext: vi.fn(async () => switchedSession),
      getUiPreferences: vi.fn(async () => preferencesResponse),
      saveUiPreferences: vi.fn(async ({ themeMode, version }) => ({
        userId: 'user-1',
        themeMode,
        version: version + 1,
        updatedAt: '2026-03-16T00:00:00.000Z',
      })),
    }

    const repositories = createAirMentorRepositories({
      storage,
      repositoryMode: 'http',
      apiClient: client,
    })

    const restored = await repositories.sessionPreferences.restoreRemoteSession()
    expect(restored?.faculty?.facultyId).toBe('fac_sysadmin')
    expect(repositories.sessionPreferences.getCurrentFacultyIdSnapshot()).toBe('fac_sysadmin')

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
  })
})
