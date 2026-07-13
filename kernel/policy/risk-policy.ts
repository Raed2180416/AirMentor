import type { RiskRules } from './university-plugin.js'

/**
 * Attendance thresholds the risk floor reads. Note these are risk-domain
 * thresholds (minimum required + condonation floor), distinct from the
 * grading-domain AttendanceRules in kernel/grading.
 */
export type RiskAttendanceRules = {
  minimumRequiredPercent: number
  condonationFloorPercent: number
}

/** Pass-mark thresholds the risk floor reads (CE/SEE/overall minima + maxima). */
export type RiskPassRules = {
  minimumCeMark: number
  minimumSeeMark: number
  minimumOverallMark: number
  ceMaximum: number
  seeMaximum: number
  overallMaximum: number
}

/**
 * The minimal, framework-free policy slice the risk scorer depends on.
 *
 * Lifting this into the kernel lets the risk engine stay pure — it no longer
 * imports ResolvedPolicy from a Fastify route module. The backend's
 * ResolvedPolicy carries all three rule blocks with matching shapes, so it is
 * structurally assignable to RiskPolicy and callers pass it unchanged.
 */
export type RiskPolicy = {
  riskRules: RiskRules
  attendanceRules: RiskAttendanceRules
  passRules: RiskPassRules
}
