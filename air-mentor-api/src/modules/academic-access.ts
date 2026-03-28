import { AppError } from '../lib/http-errors.js'

type AcademicRoleCode = string | null | undefined

type AcademicAccessAuth = {
  facultyId?: string | null
  activeRoleGrant: {
    roleCode?: AcademicRoleCode
  }
}

type AcademicAccessDecisionDetails = Record<string, unknown>

export type AcademicAccessDecisionCode =
  | 'FACULTY_CONTEXT_REQUIRED'
  | 'NON_ACTIVE_PROOF_RUN_SELECTION_FORBIDDEN'
  | 'INACTIVE_PROOF_RUN_FORBIDDEN'
  | 'COURSE_LEADER_OFFERING_SCOPE_REQUIRED'
  | 'OFFERING_READ_ROLE_FORBIDDEN'
  | 'MENTOR_STUDENT_SCOPE_REQUIRED'
  | 'HOD_OFFERING_SCOPE_REQUIRED'
  | 'HOD_STUDENT_SCOPE_REQUIRED'
  | 'STUDENT_SHELL_SESSION_OUT_OF_SCOPE'

export type AcademicAccessDecision = {
  allowed: true
} | {
  allowed: false
  code: AcademicAccessDecisionCode
  reason: string
  details?: AcademicAccessDecisionDetails
}

function allowAcademicAccess(): AcademicAccessDecision {
  return { allowed: true }
}

function denyAcademicAccess(
  code: AcademicAccessDecisionCode,
  reason: string,
  details?: AcademicAccessDecisionDetails,
): AcademicAccessDecision {
  return {
    allowed: false,
    code,
    reason,
    details,
  }
}

export function assertAcademicAccess(decision: AcademicAccessDecision): asserts decision is { allowed: true } {
  if (decision.allowed) return
  throw new AppError(403, 'FORBIDDEN', decision.reason, {
    accessCode: decision.code,
    ...(decision.details ?? {}),
  })
}

export function evaluateFacultyContextAccess(
  auth: AcademicAccessAuth,
  options?: {
    allowSystemAdmin?: boolean
    reason?: string
  },
): AcademicAccessDecision {
  if (options?.allowSystemAdmin && auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') {
    return allowAcademicAccess()
  }
  if (auth.facultyId) return allowAcademicAccess()
  return denyAcademicAccess(
    'FACULTY_CONTEXT_REQUIRED',
    options?.reason ?? 'Faculty context is required',
  )
}

export function evaluateProofRunSelectionAccess(
  auth: AcademicAccessAuth,
  requestedRunId?: string,
): AcademicAccessDecision {
  if (!requestedRunId || auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') {
    return allowAcademicAccess()
  }
  return denyAcademicAccess(
    'NON_ACTIVE_PROOF_RUN_SELECTION_FORBIDDEN',
    'Only system admin may select a non-active proof run',
    { requestedRunId },
  )
}

export function evaluateActiveProofRunAccess(
  auth: AcademicAccessAuth,
  isActiveRun: boolean,
  reason = 'Academic roles may inspect only the active proof run',
): AcademicAccessDecision {
  if (auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN' || isActiveRun) {
    return allowAcademicAccess()
  }
  return denyAcademicAccess('INACTIVE_PROOF_RUN_FORBIDDEN', reason)
}

export function evaluateCourseLeaderOfferingManagementAccess(
  hasOwnership: boolean,
  reason = 'You do not oversee this offering as a course leader',
): AcademicAccessDecision {
  if (hasOwnership) return allowAcademicAccess()
  return denyAcademicAccess(
    'COURSE_LEADER_OFFERING_SCOPE_REQUIRED',
    reason,
  )
}

export function evaluateOfferingReadRoleAccess(roleCode: AcademicRoleCode): AcademicAccessDecision {
  if (roleCode === 'SYSTEM_ADMIN' || roleCode === 'COURSE_LEADER' || roleCode === 'HOD') {
    return allowAcademicAccess()
  }
  return denyAcademicAccess(
    'OFFERING_READ_ROLE_FORBIDDEN',
    'This role cannot read offering-owned academic configuration',
    { roleCode: roleCode ?? null },
  )
}

export function evaluateMentorStudentScopeAccess(
  hasAssignment: boolean,
  reason = 'This mentor does not supervise the selected student',
): AcademicAccessDecision {
  if (hasAssignment) return allowAcademicAccess()
  return denyAcademicAccess('MENTOR_STUDENT_SCOPE_REQUIRED', reason)
}

export function evaluateHodOfferingScopeAccess(
  inScope: boolean,
  reason = 'This HoD does not supervise the selected offering',
): AcademicAccessDecision {
  if (inScope) return allowAcademicAccess()
  return denyAcademicAccess('HOD_OFFERING_SCOPE_REQUIRED', reason)
}

export function evaluateHodStudentScopeAccess(
  inScope: boolean,
  reason = 'This HoD does not supervise the selected student',
): AcademicAccessDecision {
  if (inScope) return allowAcademicAccess()
  return denyAcademicAccess('HOD_STUDENT_SCOPE_REQUIRED', reason)
}

export function evaluateStudentShellSessionMessageAccess(input: {
  auth: AcademicAccessAuth
  sessionViewerFacultyId: string | null
  sessionViewerRole: string | null
  activeRunMatches: boolean
}): AcademicAccessDecision {
  if (input.auth.activeRoleGrant.roleCode === 'SYSTEM_ADMIN') {
    return allowAcademicAccess()
  }

  const facultyContextDecision = evaluateFacultyContextAccess(input.auth)
  if (!facultyContextDecision.allowed) return facultyContextDecision

  if (
    input.sessionViewerFacultyId !== input.auth.facultyId
    || input.sessionViewerRole !== input.auth.activeRoleGrant.roleCode
  ) {
    return denyAcademicAccess(
      'STUDENT_SHELL_SESSION_OUT_OF_SCOPE',
      'Student shell session is outside the current faculty scope',
      {
        sessionViewerFacultyId: input.sessionViewerFacultyId,
        sessionViewerRole: input.sessionViewerRole,
      },
    )
  }

  if (!input.activeRunMatches) {
    return denyAcademicAccess(
      'INACTIVE_PROOF_RUN_FORBIDDEN',
      'Academic roles may send shell messages only for the active proof run',
    )
  }

  return allowAcademicAccess()
}
