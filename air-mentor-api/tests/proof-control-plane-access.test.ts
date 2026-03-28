import { describe, expect, it } from 'vitest'
import {
  isFacultyProofQueueItemVisible,
  isFacultyProofStudentVisible,
  queueDecisionTypeFromStatus,
  queueReassessmentStatusFromStatus,
} from '../src/lib/proof-control-plane-access.js'

describe('proof-control-plane-access', () => {
  it('scopes queue and student visibility by viewer role', () => {
    expect(isFacultyProofQueueItemVisible({
      viewerRoleCode: 'COURSE_LEADER',
      matchesOwnedOffering: true,
      matchesAssignedStudent: false,
    })).toBe(true)
    expect(isFacultyProofQueueItemVisible({
      viewerRoleCode: 'MENTOR',
      matchesOwnedOffering: true,
      matchesAssignedStudent: false,
    })).toBe(false)
    expect(isFacultyProofStudentVisible({
      viewerRoleCode: 'MENTOR',
      visibleViaOwnedOffering: false,
      visibleViaAssignedMentorScope: true,
    })).toBe(true)
  })

  it('maps queue status into proof decision and reassessment labels', () => {
    expect(queueDecisionTypeFromStatus('Resolved')).toBe('suppress')
    expect(queueDecisionTypeFromStatus('Watching')).toBe('watch')
    expect(queueDecisionTypeFromStatus('Open')).toBe('alert')
    expect(queueReassessmentStatusFromStatus('Resolved')).toBe('Resolved')
    expect(queueReassessmentStatusFromStatus('Watching')).toBe('Watching')
    expect(queueReassessmentStatusFromStatus('Open')).toBe('Open')
  })
})
