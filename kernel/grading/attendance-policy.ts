export type AttendanceRules = {
  minimumPercent: number
}

export type CondonationRules = {
  minimumPercent: number
  shortagePercent: number
  requiresApproval: boolean
}

export type EligibilityRules = {
  minimumAttendancePercent: number
  minimumCeForSee: number
}

export type AttendanceDecision = {
  status: 'eligible' | 'condonable' | 'ineligible'
  condonationRequired: boolean
  shortfallPercent: number
}

export type AttendancePolicyInput = {
  attendancePercent: number
  condoned?: boolean
  policy: {
    attendanceRules: AttendanceRules
    condonationRules: CondonationRules
  }
}

export function evaluateAttendanceStatus(input: AttendancePolicyInput): AttendanceDecision {
  const attendancePercent = Math.max(0, Math.min(100, input.attendancePercent))
  const shortfallPercent = Math.max(0, input.policy.attendanceRules.minimumPercent - attendancePercent)
  if (attendancePercent >= input.policy.attendanceRules.minimumPercent) {
    return {
      status: 'eligible',
      condonationRequired: false,
      shortfallPercent,
    }
  }
  const condonableMinimum = input.policy.condonationRules.minimumPercent
  if (attendancePercent >= condonableMinimum) {
    return {
      status: input.condoned ? 'eligible' : 'condonable',
      condonationRequired: !input.condoned,
      shortfallPercent,
    }
  }
  return {
    status: 'ineligible',
    condonationRequired: false,
    shortfallPercent,
  }
}
