import { type ResolvedPolicy } from '../modules/admin-structure.js'

export type RemediationAction = 're-sit' | 're-register' | 'not-eligible' | 'passed'

export type RemediationDecision = {
  action: RemediationAction
  reason: string
}

export function evaluateStudentRemediation(input: {
  isPass: boolean
  attendancePercent: number
  ceMark: number
  reSitAttempts: number
  reRegisterAttempts: number
  policy: Pick<ResolvedPolicy, 'remediationRules'>
}): RemediationDecision {
  if (input.isPass) {
    return { action: 'passed', reason: 'Student passed the course' }
  }

  const r = input.policy.remediationRules

  // Try re-sit first
  if (r.allowReSit && input.reSitAttempts < r.maxReSitAttempts) {
    if (input.attendancePercent >= r.reSitEligibilityMinAttendance && input.ceMark >= r.reSitEligibilityMinCe) {
      return { action: 're-sit', reason: 'Eligible for SEE Re-Sit' }
    }
  }

  // Fallback to re-register
  if (r.allowReRegister && input.reRegisterAttempts < r.maxReRegisterAttempts) {
    return { action: 're-register', reason: 'Must re-register for the course' }
  }

  return { action: 'not-eligible', reason: 'Exhausted remediation attempts or not allowed' }
}
