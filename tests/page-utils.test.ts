import { describe, expect, it } from 'vitest'
import { getEntryAccessState, inferKindFromPendingAction, isEntryKindApplicableForStage } from '../src/page-utils'

describe('page utils', () => {
  it('maps pending actions to deterministic entry kinds', () => {
    expect(inferKindFromPendingAction(null)).toBe('tt1')
    expect(inferKindFromPendingAction('Pending TT2 moderation')).toBe('tt2')
    expect(inferKindFromPendingAction('Attendance correction pending')).toBe('attendance')
    expect(inferKindFromPendingAction('Final marks freeze')).toBe('finals')
  })

  it('uses one shared entry applicability contract for upload and workspace gating', () => {
    expect(isEntryKindApplicableForStage(1, 'tt1')).toBe(true)
    expect(isEntryKindApplicableForStage(1, 'tt2')).toBe(false)

    expect(getEntryAccessState({
      stage: 2,
      kind: 'quiz',
      isLocked: false,
      canEditMarks: true,
    })).toEqual({
      isApplicableForStage: true,
      isLocked: false,
      canEdit: true,
      canOpenWorkspace: true,
    })

    expect(getEntryAccessState({
      stage: 1,
      kind: 'finals',
      isLocked: false,
      canEditMarks: true,
    })).toEqual({
      isApplicableForStage: false,
      isLocked: false,
      canEdit: false,
      canOpenWorkspace: false,
    })

    expect(getEntryAccessState({
      stage: 3,
      kind: 'assignment',
      isLocked: true,
      canEditMarks: true,
    })).toEqual({
      isApplicableForStage: true,
      isLocked: true,
      canEdit: false,
      canOpenWorkspace: false,
    })
  })
})
