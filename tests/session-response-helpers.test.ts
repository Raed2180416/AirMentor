import { describe, expect, it } from 'vitest'
import type { ApiSessionResponse } from '../src/api/types'
import { areSessionResponsesEquivalent } from '../src/session-response-helpers'

function makeSession(overrides: Partial<ApiSessionResponse> = {}): ApiSessionResponse {
  return {
    sessionId: 'session_1',
    csrfToken: 'csrf_1',
    user: {
      userId: 'user_1',
      username: 'sysadmin',
      email: 'sysadmin@airmentor.local',
    },
    faculty: {
      facultyId: 'fac_sysadmin',
      displayName: 'System Admin',
    },
    activeRoleGrant: {
      grantId: 'grant_system_admin',
      facultyId: 'fac_sysadmin',
      roleCode: 'SYSTEM_ADMIN',
      scopeType: 'institution',
      scopeId: 'inst_airmentor',
      scopeLabel: 'Institution',
      startDate: '2024-01-01',
      endDate: null,
      status: 'active',
      version: 1,
    },
    availableRoleGrants: [
      {
        grantId: 'grant_system_admin',
        facultyId: 'fac_sysadmin',
        roleCode: 'SYSTEM_ADMIN',
        scopeType: 'institution',
        scopeId: 'inst_airmentor',
        scopeLabel: 'Institution',
        startDate: '2024-01-01',
        endDate: null,
        status: 'active',
        version: 1,
      },
    ],
    preferences: {
      userId: 'user_1',
      themeMode: 'frosted-focus-light',
      version: 1,
      updatedAt: '2026-04-19T00:00:00.000Z',
    },
    ...overrides,
  }
}

describe('areSessionResponsesEquivalent', () => {
  it('treats structurally identical sessions as equivalent', () => {
    const left = makeSession()
    const right = makeSession()

    expect(areSessionResponsesEquivalent(left, right)).toBe(true)
  })

  it('detects changed role context or security tokens', () => {
    const base = makeSession()
    const differentRole = makeSession({
      activeRoleGrant: {
        ...base.activeRoleGrant,
        grantId: 'grant_hod',
        roleCode: 'HOD',
        scopeType: 'department',
        scopeId: 'dept_cse',
      },
    })
    const differentToken = makeSession({ csrfToken: 'csrf_2' })

    expect(areSessionResponsesEquivalent(base, differentRole)).toBe(false)
    expect(areSessionResponsesEquivalent(base, differentToken)).toBe(false)
  })

  it('returns false when either side is missing', () => {
    const base = makeSession()

    expect(areSessionResponsesEquivalent(base, null)).toBe(false)
    expect(areSessionResponsesEquivalent(null, base)).toBe(false)
    expect(areSessionResponsesEquivalent(null, null)).toBe(true)
  })
})
