/**
 * Academic pure helpers — framework/persistence-free scalar + collection
 * utilities used across the academic route dependency bag (role-label mapping,
 * time/id normalization, nullable numeric aggregation, assessment-type
 * matching, timetable overlap geometry, and stage-policy resolution).
 *
 * Moved verbatim from modules/academic.ts. Structural relocation only — no logic
 * change; the only added tokens are `export` on each declaration.
 */
import { z } from 'zod'
import { badRequest } from '../../../lib/http-errors.js'
import { DEFAULT_STAGE_POLICY, type StagePolicyPayload } from '../../../lib/stage-policy.js'
import { proofReassessmentResolutionOutcomeSchema } from './academic-contracts.js'
import { timetableClassBlockSchema, weekdaySchema } from './academic-task-contracts.js'

export function visibleAssessmentComponentTypesForStage(stageKey: string | null | undefined) {
  if (!stageKey) return null
  switch (stageKey) {
    case 'pre-tt1':
      return []
    case 'post-tt1':
      return ['tt1', 'tt1_leaf']
    case 'post-tt2':
      return ['tt1', 'tt1_leaf', 'tt2', 'tt2_leaf']
    case 'post-assignments':
      return ['tt1', 'tt1_leaf', 'tt2', 'tt2_leaf', 'quiz*', 'asgn*']
    case 'post-see':
      return null
    default:
      return null
  }
}

export function isoDatePart(value: string | null | undefined) {
  if (!value) return null
  return value.slice(0, 10)
}

export function toUiRole(roleCode: string) {
  if (roleCode === 'COURSE_LEADER') return 'Course Leader'
  if (roleCode === 'MENTOR') return 'Mentor'
  if (roleCode === 'HOD') return 'HoD'
  return null
}

export function sortRoleLabels(left: string, right: string) {
  const order = ['Course Leader', 'Mentor', 'HoD']
  return order.indexOf(left) - order.indexOf(right)
}

export function isLeaderLikeOwnershipRole(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized.includes('course') || normalized.includes('leader') || normalized.includes('owner') || normalized.includes('primary')
}

export function dedupeRoles(roleCodes: string[]) {
  return Array.from(new Set(roleCodes.map(toUiRole).filter((value): value is 'Course Leader' | 'Mentor' | 'HoD' => !!value))).sort(sortRoleLabels)
}

export function millisToIso(value: number | undefined, fallback: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return new Date(value).toISOString()
}

export function isoToMillis(value: string | undefined, fallback = Date.now()) {
  if (!value) return fallback
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeAcademicStudentId(studentId: string) {
  return studentId.includes('::') ? (studentId.split('::').at(-1) ?? studentId) : studentId
}

export function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

export function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizeCourseCode(courseCode: string) {
  return courseCode.trim().toUpperCase()
}

export function normalizeTranscriptCourseKey(courseCode: string) {
  return courseCode.replace(/\(.*repeat.*\)/i, '').replace(/R$/i, '').trim()
}

export function courseFamilyForCode(courseCode: string) {
  const normalized = normalizeCourseCode(courseCode)
  const match = normalized.match(/^[A-Z]+/)
  return match?.[0] ?? (normalized || 'GENERAL')
}

export function resolveAuthoritativeStageOrder(
  stagePolicy: StagePolicyPayload | undefined,
  stageKey: string | null | undefined,
) {
  if (!stageKey) return null
  const resolvedPolicy = stagePolicy ?? DEFAULT_STAGE_POLICY
  return resolvedPolicy.stages.find(stage => stage.key === stageKey)?.order ?? null
}

export function averageNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (filtered.length === 0) return null
  return roundToTwo(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

export function weightedAverageNullable(values: Array<{ value: number | null; weight: number }>) {
  const filtered = values.filter(item =>
    typeof item.value === 'number'
    && Number.isFinite(item.value)
    && Number.isFinite(item.weight)
    && item.weight > 0,
  ) as Array<{ value: number; weight: number }>
  if (filtered.length === 0) return averageNullable(values.map(item => item.value))
  const totalWeight = filtered.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return averageNullable(filtered.map(item => item.value))
  return roundToTwo(filtered.reduce((sum, item) => sum + (item.value * item.weight), 0) / totalWeight)
}

export function assessmentTypeMatches(componentType: string, expectedTypes: string[]) {
  return expectedTypes.some(expectedType => {
    if (expectedType.endsWith('*')) return componentType.startsWith(expectedType.slice(0, -1))
    return componentType === expectedType
  })
}

export function stagePolicyForOffering(batchPolicy: { effectivePolicy: StagePolicyPayload } | null) {
  return batchPolicy?.effectivePolicy ?? DEFAULT_STAGE_POLICY
}

export function validateMeetingWindow(startMinutes: number, endMinutes: number) {
  if (startMinutes >= endMinutes) {
    throw badRequest('Meeting duration must be positive')
  }
}

export function proofResolutionRecoveryState(outcome: z.infer<typeof proofReassessmentResolutionOutcomeSchema>) {
  return outcome === 'completed_improving' ? 'confirmed_improvement' : 'under_watch'
}

export function weekdayFromDateIso(dateISO: string) {
  const value = new Date(`${dateISO}T00:00:00Z`)
  if (Number.isNaN(value.getTime())) return null
  const weekday = value.getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday] ?? null) as z.infer<typeof weekdaySchema> | null
}

export function classBlocksCanOverlap(
  left: z.infer<typeof timetableClassBlockSchema>,
  right: z.infer<typeof timetableClassBlockSchema>,
) {
  if (left.kind === 'extra' && left.dateISO && right.kind === 'extra' && right.dateISO) {
    return left.dateISO === right.dateISO
  }
  if (left.kind === 'extra' && left.dateISO && right.kind !== 'extra') {
    return weekdayFromDateIso(left.dateISO) === right.day
  }
  if (right.kind === 'extra' && right.dateISO && left.kind !== 'extra') {
    return weekdayFromDateIso(right.dateISO) === left.day
  }
  return left.day === right.day
}

export function rangesOverlap(
  left: { startMinutes: number; endMinutes: number },
  right: { startMinutes: number; endMinutes: number },
) {
  return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes
}
