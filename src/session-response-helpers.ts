import type { ApiSessionResponse } from './api/types'

function normalizeSessionResponse(session: ApiSessionResponse) {
  return {
    sessionId: session.sessionId,
    csrfToken: session.csrfToken,
    user: session.user,
    faculty: session.faculty,
    activeRoleGrant: session.activeRoleGrant,
    availableRoleGrants: session.availableRoleGrants,
    preferences: session.preferences,
  }
}

export function areSessionResponsesEquivalent(left: ApiSessionResponse | null, right: ApiSessionResponse | null) {
  if (left === right) return true
  if (!left || !right) return false
  return JSON.stringify(normalizeSessionResponse(left)) === JSON.stringify(normalizeSessionResponse(right))
}
