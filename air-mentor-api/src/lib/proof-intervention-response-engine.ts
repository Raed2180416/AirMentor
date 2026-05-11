// Deterministic intervention-response engine — implements master prompt Section H.
//
// Pure function module. No DB access. No wall-clock dependence. Every output is a
// deterministic function of the inputs, so reruns with the same runId / studentId /
// intervention sequence produce bytewise-identical results.
//
// Formula (Section H §8):
//   impact = baseActionWeight
//          × responseScore(studentProfile)
//          × supportCompatibility(actionCode, concernFamily, weakness)
//          × stageFactor(stageKey, semesterNumber)
//          × severityPenalty(riskBand, cgpa, backlog)
//          × repeatPenalty(ordinal)
//
// Tier thresholds (Section H §9):
//   impact >= 0.65 -> 'strong'
//   impact >= 0.35 -> 'partial'
//   otherwise      -> 'weak'
//
// Workflow-only actions (faculty_followup_reminder, generic_default_family_action) are
// computed like any other action but their impact is dropped by sumInterventionImpacts.
// This matches Section H §13: reminders do not shift student behavior, they shift
// teacher behavior.

import type {
  ComputedInterventionImpact,
  InterventionApplication,
  InterventionImpactTier,
  InterventionStageKey,
  ProofInterventionActionCode,
  ProofInterventionConcernFamily,
  ProofInterventionDominantWeakness,
  ResponseProfile,
  StudentLatentProfileForIntervention,
} from './proof-intervention-response-types.js'

// ---------- Constants ----------

export const RESPONSE_SCORE_BY_PROFILE: Readonly<Record<ResponseProfile, number>> = {
  strong: 0.85,
  partial: 0.60,
  weak: 0.35,
  resistant: 0.15,
}

export const BASE_ACTION_WEIGHT: Readonly<Record<ProofInterventionActionCode, number>> = {
  mentor_meeting: 0.55,
  faculty_followup_reminder: 0.45,
  attendance_warning: 0.50,
  extra_academic_support_plan: 0.75,
  targeted_remedial_plan: 0.80,
  hod_escalation_student_action: 0.65,
  structured_study_plan: 0.70,
  peer_study_group: 0.40,
  generic_default_family_action: 0.50,
}

// Student-facing vs workflow-only separation per Section H §13.
// Workflow-only actions change teacher behavior (nudges, reminders) but do not move
// student latent state or mark realization.
export const STUDENT_FACING_ACTIONS: ReadonlySet<ProofInterventionActionCode> = new Set<ProofInterventionActionCode>([
  'mentor_meeting',
  'attendance_warning',
  'extra_academic_support_plan',
  'targeted_remedial_plan',
  'hod_escalation_student_action',
  'structured_study_plan',
  'peer_study_group',
])

// Which weakness families each action primarily addresses.
// Used by supportCompatibility to award a match bonus (1.10) or mismatch penalty (0.90).
const ACTION_FAMILY_AFFINITY: Readonly<Record<ProofInterventionActionCode, ReadonlyArray<Exclude<ProofInterventionDominantWeakness, null>>>> = {
  mentor_meeting: ['mentoring', 'broad'],
  faculty_followup_reminder: ['mentoring', 'broad'],
  attendance_warning: ['attendance'],
  extra_academic_support_plan: ['coursework', 'broad'],
  targeted_remedial_plan: ['coursework', 'exam'],
  hod_escalation_student_action: ['broad'],
  structured_study_plan: ['exam', 'coursework'],
  peer_study_group: ['coursework', 'mentoring'],
  generic_default_family_action: ['broad'],
}

// ---------- Pure utility helpers (local copies, zero imports) ----------

function stableUnit(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// ---------- Student-facing filter ----------

export function isStudentFacing(actionCode: ProofInterventionActionCode): boolean {
  return STUDENT_FACING_ACTIONS.has(actionCode)
}

// ---------- Response profile derivation ----------

// Deterministic mapping from (runId, studentId, latent profile) to a 4-bucket responsiveness.
// The random component lives on a stable hash keyed by (runId, studentId); the latent
// profile then biases the bucket boundary via interventionReceptivity and
// practiceCompliance. A student with high receptivity AND compliance skews heavily
// toward 'strong' / 'partial'; a student with low values skews toward 'weak' / 'resistant'.
export function deriveResponseProfile(input: {
  runId: string
  studentId: string
  studentProfile: StudentLatentProfileForIntervention
}): { profile: ResponseProfile; responseScore: number; consistencyScore: number } {
  const { runId, studentId, studentProfile } = input
  const seed = `${runId}::${studentId}::response-profile::v1`
  const draw = stableUnit(seed)
  const receptivityBias = (clamp(studentProfile.intervention.interventionReceptivity, 0, 1) - 0.5) * 0.45
  const complianceBias = (clamp(studentProfile.behavior.practiceCompliance, 0, 1) - 0.5) * 0.25
  const shifted = clamp(draw + receptivityBias + complianceBias, 0, 1)
  const profile: ResponseProfile =
    shifted >= 0.75 ? 'strong' :
    shifted >= 0.45 ? 'partial' :
    shifted >= 0.20 ? 'weak' : 'resistant'
  return {
    profile,
    responseScore: RESPONSE_SCORE_BY_PROFILE[profile],
    consistencyScore: clamp(studentProfile.dynamics.consistency, 0, 1),
  }
}

// ---------- Support compatibility ----------

function concernFamilyToWeakness(family: ProofInterventionConcernFamily | null): ProofInterventionDominantWeakness {
  switch (family) {
    case 'attendance': return 'attendance'
    case 'coursework': return 'coursework'
    case 'exam-performance': return 'exam'
    case 'broad-academic': return 'broad'
    case 'mentoring-engagement': return 'mentoring'
    default: return null
  }
}

export function supportCompatibility(input: {
  actionCode: ProofInterventionActionCode
  concernFamily: ProofInterventionConcernFamily | null
  studentProfile: StudentLatentProfileForIntervention
  dominantWeaknessHint: ProofInterventionDominantWeakness
}): number {
  const affinities = ACTION_FAMILY_AFFINITY[input.actionCode]
  const weaknessToken = input.dominantWeaknessHint ?? concernFamilyToWeakness(input.concernFamily)
  let baseFactor = 1.00
  if (weaknessToken != null) {
    baseFactor = affinities.includes(weaknessToken) ? 1.10 : 0.90
  }
  const receptivity = clamp(input.studentProfile.intervention.interventionReceptivity, 0, 1)
  // Receptivity scales the compatibility factor in a bounded window [0.7, 1.3].
  const receptivityScale = clamp(0.7 + receptivity * 0.6, 0.7, 1.3)
  return clamp(baseFactor * receptivityScale, 0.60, 1.45)
}

// ---------- Stage factor ----------

// Earlier-stage interventions have more runway to reshape remaining assessments.
// Sem >= 2 pre-tt1 gets a small bonus because the incoming student already has
// prior-semester signal, so the intervention is targeted rather than speculative.
export function stageFactor(stageKey: InterventionStageKey, semesterNumber: number): number {
  switch (stageKey) {
    case 'pre-tt1':
      return semesterNumber >= 2 ? 1.10 : 1.00
    case 'post-tt1':
      return 1.00
    case 'post-tt2':
      return 0.85
    case 'post-assignments':
      return 0.70
    case 'post-see':
      return 0.50
    default:
      return 1.00
  }
}

// ---------- Severity penalty ----------

function classifySeverity(
  riskBand: 'High' | 'Medium' | 'Low',
  cgpa: number,
  backlogCount: number,
): 'mild' | 'moderate' | 'severe' | 'extreme' {
  if (riskBand === 'High' && (backlogCount >= 3 || cgpa < 4.0)) return 'extreme'
  if (riskBand === 'High') return 'severe'
  if (riskBand === 'Medium' && (backlogCount >= 2 || cgpa < 4.5)) return 'severe'
  if (riskBand === 'Medium') return 'moderate'
  return 'mild'
}

export function severityPenalty(
  riskBand: 'High' | 'Medium' | 'Low',
  cgpa: number,
  backlogCount: number,
): number {
  switch (classifySeverity(riskBand, cgpa, backlogCount)) {
    case 'mild':     return 1.00
    case 'moderate': return 0.85
    case 'severe':   return 0.70
    case 'extreme':  return 0.55
  }
}

// ---------- Repeat penalty ----------

// First intervention in a stage: full weight. Subsequent interventions lose effect
// (students adapt / tune out). Cap at 0.35 so repeated interventions never zero out
// entirely; there is always some residual nudge value.
export function repeatPenalty(ordinal: number): number {
  if (ordinal <= 1) return 1.00
  if (ordinal === 2) return 0.60
  return 0.35
}

// ---------- Main formula ----------

export function computeInterventionImpact(
  application: InterventionApplication,
  studentProfile: StudentLatentProfileForIntervention,
): ComputedInterventionImpact {
  const responseProfile = deriveResponseProfile({
    runId: application.runId,
    studentId: application.studentId,
    studentProfile,
  })
  const baseActionWeight = BASE_ACTION_WEIGHT[application.actionCode]
  const compat = supportCompatibility({
    actionCode: application.actionCode,
    concernFamily: application.concernFamily,
    studentProfile,
    dominantWeaknessHint: application.dominantWeaknessHint,
  })
  const stage = stageFactor(application.stageKey, application.semesterNumber)
  const sev = severityPenalty(
    application.severityContext.riskBand,
    application.severityContext.cgpa,
    application.severityContext.backlogCount,
  )
  const repeat = repeatPenalty(application.ordinalInStageForStudent)
  const impactRaw = baseActionWeight * responseProfile.responseScore * compat * stage * sev * repeat
  const impact = roundTo(impactRaw, 6)
  const tier: InterventionImpactTier =
    impact >= 0.65 ? 'strong' :
    impact >= 0.35 ? 'partial' : 'weak'
  return {
    impact,
    tier,
    breakdown: {
      baseActionWeight,
      responseScore: responseProfile.responseScore,
      compatibilityFactor: roundTo(compat, 6),
      stageFactor: stage,
      severityPenalty: sev,
      repeatPenalty: repeat,
    },
  }
}

// ---------- Aggregation across the stage window ----------

// Per Section H §12 the cumulative impact inside a stage window is capped at 0.95
// to prevent infinite stacking of interventions from zeroing out the risk score.
export const CUMULATIVE_IMPACT_CAP = 0.95

export function sumInterventionImpacts(
  applications: ReadonlyArray<{
    application: InterventionApplication
    profile: StudentLatentProfileForIntervention
  }>,
): { totalImpact: number; dominantTier: InterventionImpactTier | null; appliedCount: number } {
  let total = 0
  let strongest = -Infinity
  let dominantTier: InterventionImpactTier | null = null
  let appliedCount = 0
  for (const entry of applications) {
    if (!isStudentFacing(entry.application.actionCode)) continue
    const computed = computeInterventionImpact(entry.application, entry.profile)
    total += computed.impact
    appliedCount += 1
    if (computed.impact > strongest) {
      strongest = computed.impact
      dominantTier = computed.tier
    }
  }
  return {
    totalImpact: roundTo(Math.min(CUMULATIVE_IMPACT_CAP, total), 6),
    dominantTier,
    appliedCount,
  }
}
