import type { PassRules, AttendanceRules, CondonationRules, EligibilityRules } from '../../kernel/grading/index.js'

export function createIitbPassRules(): PassRules {
  return {
    ceMinimum: 30,
    seeMinimum: 20,
    overallMinimum: 50,
    ceMaximum: 50,
    seeMaximum: 50,
    overallMaximum: 100,
  }
}

export function createIitbAttendanceRules(): AttendanceRules {
  return { minimumPercent: 80 }
}

export function createIitbCondonationRules(): CondonationRules {
  return {
    minimumPercent: 70,
    shortagePercent: 10,
    requiresApproval: true,
  }
}

export function createIitbEligibilityRules(): EligibilityRules {
  return {
    minimumAttendancePercent: 80,
    minimumCeForSee: 30,
  }
}
