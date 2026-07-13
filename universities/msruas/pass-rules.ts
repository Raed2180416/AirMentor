import type { PassRules, AttendanceRules, CondonationRules, EligibilityRules } from '../../kernel/grading/index.js'

export function createMsruasPassRules(): PassRules {
  return {
    ceMinimum: 24,
    seeMinimum: 16,
    overallMinimum: 40,
    ceMaximum: 60,
    seeMaximum: 40,
    overallMaximum: 100,
  }
}

export function createMsruasAttendanceRules(): AttendanceRules {
  return { minimumPercent: 75 }
}

export function createMsruasCondonationRules(): CondonationRules {
  return {
    minimumPercent: 65,
    shortagePercent: 10,
    requiresApproval: true,
  }
}

export function createMsruasEligibilityRules(): EligibilityRules {
  return {
    minimumAttendancePercent: 75,
    minimumCeForSee: 24,
  }
}
