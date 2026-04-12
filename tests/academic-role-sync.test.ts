import { describe, expect, it } from 'vitest'
import { resolveRoleSyncState } from '../src/academic-workspace-route-helpers'

describe('academic role sync', () => {
  it('keeps a valid refreshed role on the current page and falls back when the page is no longer allowed', () => {
    expect(resolveRoleSyncState({
      allowedRoles: ['Course Leader', 'Mentor', 'HoD'],
      initialRole: 'Mentor',
      role: 'Mentor',
      page: 'queue-history',
    })).toBeNull()

    expect(resolveRoleSyncState({
      allowedRoles: ['Mentor'],
      initialRole: 'Mentor',
      role: 'Mentor',
      page: 'scheme-setup',
    })).toEqual({
      role: 'Mentor',
      page: 'mentees',
    })
  })
})
