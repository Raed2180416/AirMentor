import { describe, expect, it } from 'vitest'
import {
  applyCorrectionCycleTransition,
  describeCorrectionCycle,
  isCorrectionCycleTerminal,
  nextActionsFromStatus,
  scopeForKind,
} from '../src/lib/proof-hod-correction-cycle-engine.js'

describe('scopeForKind — intent §D.6 scope classification', () => {
  it('maps evidence kinds to evidence scope', () => {
    expect(scopeForKind('tt1')).toBe('evidence')
    expect(scopeForKind('tt2')).toBe('evidence')
    expect(scopeForKind('quiz')).toBe('evidence')
    expect(scopeForKind('assignment')).toBe('evidence')
    expect(scopeForKind('attendance')).toBe('evidence')
    expect(scopeForKind('finals')).toBe('evidence')
  })
  it('maps scheme to scheme scope', () => {
    expect(scopeForKind('scheme')).toBe('scheme')
  })
  it('maps blueprint to blueprint scope', () => {
    expect(scopeForKind('blueprint')).toBe('blueprint')
  })
})

describe('request action — opens a new correction cycle', () => {
  it('null current status + teacher role → Pending', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: null,
      kind: 'tt1',
      action: 'request',
      actorRole: 'COURSE_LEADER',
      actorFacultyId: 'fac_001',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Pending')
    expect(result.scope).toBe('evidence')
    expect(result.nextActions).toEqual(['approve', 'reject'])
    expect(result.surfaceReopens).toBe(false)
    expect(result.triggersRecompute).toBe(false)
  })

  it('rejects opening a new request while current is Pending', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt1',
      action: 'request',
      actorRole: 'COURSE_LEADER',
      actorFacultyId: 'fac_001',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('illegal-transition')
  })

  it('allows opening a new request after previous was Rejected', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Rejected',
      kind: 'scheme',
      action: 'request',
      actorRole: 'HOD',
      actorFacultyId: 'fac_hod_01',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Pending')
  })

  it('rejects request from unauthorised role', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: null,
      kind: 'tt1',
      action: 'request',
      actorRole: 'SYSTEM',
      actorFacultyId: 'fac_001',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('forbidden-role')
  })

  it('rejects request without faculty id', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: null,
      kind: 'tt1',
      action: 'request',
      actorRole: 'COURSE_LEADER',
      actorFacultyId: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('missing-faculty-id')
  })
})

describe('approve/reject transitions — only HOD or SYSTEM_ADMIN', () => {
  it('HOD approves Pending → Approved', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt2',
      action: 'approve',
      actorRole: 'HOD',
      actorFacultyId: 'fac_hod_01',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Approved')
    expect(result.nextActions).toEqual(['reset-complete'])
    expect(result.surfaceReopens).toBe(false)
  })

  it('SYSTEM_ADMIN can also approve', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'scheme',
      action: 'approve',
      actorRole: 'SYSTEM_ADMIN',
    })
    expect(result.ok).toBe(true)
  })

  it('COURSE_LEADER cannot approve', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt2',
      action: 'approve',
      actorRole: 'COURSE_LEADER',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('forbidden-role')
  })

  it('MENTOR cannot approve', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt2',
      action: 'approve',
      actorRole: 'MENTOR',
    })
    expect(result.ok).toBe(false)
  })

  it('HOD rejects Pending → Rejected (terminal)', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'assignment',
      action: 'reject',
      actorRole: 'HOD',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Rejected')
    expect(isCorrectionCycleTerminal(result.next)).toBe(true)
    expect(result.nextActions).toEqual([])
  })
})

describe('reset-complete — surface truly reopens (§D.6)', () => {
  it('Approved + reset-complete → Reset Completed + surfaceReopens true', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Approved',
      kind: 'scheme',
      action: 'reset-complete',
      actorRole: 'SYSTEM',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Reset Completed')
    expect(result.surfaceReopens).toBe(true)
    expect(result.scope).toBe('scheme')
    expect(result.nextActions).toContain('teacher-edit-submit')
    expect(result.nextActions).toContain('relock')
  })

  it('blueprint reset-complete returns blueprint scope', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Approved',
      kind: 'blueprint',
      action: 'reset-complete',
      actorRole: 'HOD',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scope).toBe('blueprint')
    expect(result.surfaceReopens).toBe(true)
  })

  it('rejects reset-complete from COURSE_LEADER', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Approved',
      kind: 'tt1',
      action: 'reset-complete',
      actorRole: 'COURSE_LEADER',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('forbidden-role')
  })

  it('cannot reset-complete directly from Pending (must approve first)', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt1',
      action: 'reset-complete',
      actorRole: 'SYSTEM',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('illegal-transition')
  })
})

describe('teacher-edit-submit — triggers recompute', () => {
  it('Reset Completed + teacher-edit-submit stays in Reset Completed + triggersRecompute true', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Reset Completed',
      kind: 'tt2',
      action: 'teacher-edit-submit',
      actorRole: 'COURSE_LEADER',
      actorFacultyId: 'fac_001',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Reset Completed')
    expect(result.triggersRecompute).toBe(true)
    expect(result.nextActions).toContain('relock')
  })

  it('SYSTEM cannot teacher-edit-submit (only teacher roles)', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Reset Completed',
      kind: 'tt1',
      action: 'teacher-edit-submit',
      actorRole: 'SYSTEM',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('forbidden-role')
  })
})

describe('relock — closes the cycle', () => {
  it('Reset Completed + relock → Relocked (terminal)', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Reset Completed',
      kind: 'tt1',
      action: 'relock',
      actorRole: 'SYSTEM',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.next).toBe('Relocked')
    expect(isCorrectionCycleTerminal(result.next)).toBe(true)
    expect(result.nextActions).toEqual([])
  })

  it('COURSE_LEADER cannot relock', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Reset Completed',
      kind: 'tt1',
      action: 'relock',
      actorRole: 'COURSE_LEADER',
    })
    expect(result.ok).toBe(false)
  })
})

describe('illegal / reverse transitions blocked', () => {
  it('cannot approve from Reset Completed', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Reset Completed',
      kind: 'tt1',
      action: 'approve',
      actorRole: 'HOD',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('illegal-transition')
  })

  it('cannot reject from Approved', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Approved',
      kind: 'tt2',
      action: 'reject',
      actorRole: 'HOD',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('illegal-transition')
  })

  it('cannot approve a Relocked cycle', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Relocked',
      kind: 'tt1',
      action: 'approve',
      actorRole: 'HOD',
    })
    expect(result.ok).toBe(false)
  })

  it('cannot teacher-edit-submit from Pending', () => {
    const result = applyCorrectionCycleTransition({
      currentStatus: 'Pending',
      kind: 'tt2',
      action: 'teacher-edit-submit',
      actorRole: 'COURSE_LEADER',
    })
    expect(result.ok).toBe(false)
  })
})

describe('nextActionsFromStatus enumeration', () => {
  it('Pending → [approve, reject]', () => {
    expect(nextActionsFromStatus('Pending')).toEqual(['approve', 'reject'])
  })
  it('Approved → [reset-complete]', () => {
    expect(nextActionsFromStatus('Approved')).toEqual(['reset-complete'])
  })
  it('Rejected → []', () => {
    expect(nextActionsFromStatus('Rejected')).toEqual([])
  })
  it('Reset Completed → [teacher-edit-submit, relock]', () => {
    expect(nextActionsFromStatus('Reset Completed')).toEqual(['teacher-edit-submit', 'relock'])
  })
  it('Relocked → []', () => {
    expect(nextActionsFromStatus('Relocked')).toEqual([])
  })
})

describe('describeCorrectionCycle — UI copy', () => {
  it('Pending describes awaiting HOD + scope label', () => {
    const d = describeCorrectionCycle({ status: 'Pending', kind: 'scheme' })
    expect(d.awaitingActor).toBe('HOD')
    expect(d.stepLabel).toContain('HOD')
    expect(d.description).toContain('CE scheme decomposition')
    expect(d.editorReopened).toBe(false)
  })
  it('Reset Completed describes editor open + awaiting teacher', () => {
    const d = describeCorrectionCycle({ status: 'Reset Completed', kind: 'blueprint' })
    expect(d.editorReopened).toBe(true)
    expect(d.awaitingActor).toBe('COURSE_LEADER')
    expect(d.description).toContain('TT blueprint')
  })
  it('Rejected describes terminal state', () => {
    const d = describeCorrectionCycle({ status: 'Rejected', kind: 'tt1' })
    expect(d.awaitingActor).toBeNull()
    expect(d.editorReopened).toBe(false)
    expect(d.stepLabel).toContain('Rejected')
  })
  it('Relocked describes cycle closed', () => {
    const d = describeCorrectionCycle({ status: 'Relocked', kind: 'tt2' })
    expect(d.awaitingActor).toBeNull()
    expect(d.editorReopened).toBe(false)
    expect(d.stepLabel).toContain('Relocked')
  })
})

describe('full happy-path traversal', () => {
  it('request → approve → reset-complete → teacher-edit → relock', () => {
    const cycle: Array<{ action: Parameters<typeof applyCorrectionCycleTransition>[0]['action']; actorRole: Parameters<typeof applyCorrectionCycleTransition>[0]['actorRole']; actorFacultyId?: string | null }> = [
      { action: 'request', actorRole: 'COURSE_LEADER', actorFacultyId: 'fac_cl_01' },
      { action: 'approve', actorRole: 'HOD' },
      { action: 'reset-complete', actorRole: 'SYSTEM' },
      { action: 'teacher-edit-submit', actorRole: 'COURSE_LEADER', actorFacultyId: 'fac_cl_01' },
      { action: 'relock', actorRole: 'SYSTEM' },
    ]
    let currentStatus: Parameters<typeof applyCorrectionCycleTransition>[0]['currentStatus'] = null
    const visited: string[] = []
    for (const step of cycle) {
      const result = applyCorrectionCycleTransition({
        currentStatus,
        kind: 'scheme',
        action: step.action,
        actorRole: step.actorRole,
        actorFacultyId: step.actorFacultyId ?? null,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(`Step ${step.action} failed: ${result.reason}`)
      visited.push(`${step.action}:${result.next}`)
      currentStatus = result.next
    }
    expect(visited).toEqual([
      'request:Pending',
      'approve:Approved',
      'reset-complete:Reset Completed',
      'teacher-edit-submit:Reset Completed',
      'relock:Relocked',
    ])
    expect(isCorrectionCycleTerminal(currentStatus as 'Relocked')).toBe(true)
  })

  it('full traversal — reject path from Pending is terminal', () => {
    let currentStatus: Parameters<typeof applyCorrectionCycleTransition>[0]['currentStatus'] = null
    const open = applyCorrectionCycleTransition({
      currentStatus,
      kind: 'tt1',
      action: 'request',
      actorRole: 'COURSE_LEADER',
      actorFacultyId: 'fac_cl_01',
    })
    expect(open.ok).toBe(true)
    if (!open.ok) return
    currentStatus = open.next
    const reject = applyCorrectionCycleTransition({
      currentStatus,
      kind: 'tt1',
      action: 'reject',
      actorRole: 'HOD',
    })
    expect(reject.ok).toBe(true)
    if (!reject.ok) return
    expect(reject.next).toBe('Rejected')
    // Cannot continue from Rejected except to open a brand-new request.
    expect(nextActionsFromStatus(reject.next)).toEqual([])
  })
})
