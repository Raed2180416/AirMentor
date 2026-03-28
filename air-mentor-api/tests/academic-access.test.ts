import { describe, expect, it } from 'vitest'
import {
  assertAcademicAccess,
  evaluateActiveProofRunAccess,
  evaluateFacultyContextAccess,
  evaluateOfferingReadRoleAccess,
  evaluateProofRunSelectionAccess,
  evaluateStudentShellSessionMessageAccess,
} from '../src/modules/academic-access.js'

function createAuth(roleCode: string, facultyId: string | null = 'faculty-1') {
  return {
    facultyId,
    activeRoleGrant: { roleCode },
  }
}

describe('academic access decisions', () => {
  it('rejects non-admin proof run selection with a stable access code', () => {
    const decision = evaluateProofRunSelectionAccess(createAuth('HOD'), 'run-2')
    expect(decision).toMatchObject({
      allowed: false,
      code: 'NON_ACTIVE_PROOF_RUN_SELECTION_FORBIDDEN',
    })

    try {
      assertAcademicAccess(decision)
      throw new Error('Expected access assertion to throw')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'FORBIDDEN',
        details: expect.objectContaining({
          accessCode: 'NON_ACTIVE_PROOF_RUN_SELECTION_FORBIDDEN',
          requestedRunId: 'run-2',
        }),
      })
    }
  })

  it('allows system admin to inspect inactive proof runs', () => {
    expect(evaluateActiveProofRunAccess(createAuth('SYSTEM_ADMIN', null), false)).toEqual({
      allowed: true,
    })
  })

  it('requires faculty context for academic roles', () => {
    expect(evaluateFacultyContextAccess(createAuth('COURSE_LEADER', null))).toMatchObject({
      allowed: false,
      code: 'FACULTY_CONTEXT_REQUIRED',
    })
  })

  it('rejects mentor access to offering-owned config', () => {
    expect(evaluateOfferingReadRoleAccess('MENTOR')).toMatchObject({
      allowed: false,
      code: 'OFFERING_READ_ROLE_FORBIDDEN',
    })
  })

  it('rejects student shell session messages outside the viewer scope', () => {
    const decision = evaluateStudentShellSessionMessageAccess({
      auth: createAuth('COURSE_LEADER', 'faculty-1'),
      sessionViewerFacultyId: 'faculty-2',
      sessionViewerRole: 'COURSE_LEADER',
      activeRunMatches: true,
    })

    expect(decision).toMatchObject({
      allowed: false,
      code: 'STUDENT_SHELL_SESSION_OUT_OF_SCOPE',
    })
  })
})
