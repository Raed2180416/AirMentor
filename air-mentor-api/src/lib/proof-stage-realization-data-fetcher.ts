// Phase-6d data fetcher — translates stored DB state (studentInterventions rows,
// studentLatentStates latentStateJson) into the exact shape the Phase-5 evidence
// applier expects (EvidenceApplierInterventionInput[] + StudentLatentProfileFor-
// Intervention). Pure functions only. No DB I/O — callers fetch rows and pass them
// in, enabling straight-line testing.
//
// Why this module exists: the legacy seeded-run pipeline stores
// studentInterventions.interventionType as a kebab-case free-text column (values
// like 'mentor-check-in', 'prerequisite-bridge', 'targeted-tutoring'). The new
// engines built in Phase 1-5 demand a strict snake_case ProofInterventionAction-
// Code enum ('mentor_meeting', 'targeted_remedial_plan', ...). This module is the
// mapping layer that bridges the two vocabularies deterministically.

import type {
  EvidenceApplierInterventionInput,
} from './proof-stage-realization-evidence-applier.js'
import type {
  InterventionStageKey,
  InterventionSeverityContext,
  ProofInterventionActionCode,
  ProofInterventionConcernFamily,
  ProofInterventionDominantWeakness,
  StudentLatentProfileForIntervention,
} from './proof-intervention-response-types.js'

// ---------- Legacy free-text interventionType -> enum ProofInterventionActionCode ----------

// Canonical mapping from the legacy kebab-case strings the seeded-run pipeline
// writes into studentInterventions.interventionType to the Phase-5 enum. Values
// aligned with intervention semantics:
//   - Direct-action student remedies -> 'targeted_remedial_plan'
//   - Study-structure heavy -> 'structured_study_plan'
//   - Mentor-touch interventions -> 'mentor_meeting'
//   - Attendance recovery -> 'attendance_warning'
//   - Faculty-side prompts -> 'faculty_followup_reminder'
//   - No-op alerts / explicit no-action -> null (skipped; workflow-only)
const LEGACY_TO_ACTION_CODE: Readonly<Record<string, ProofInterventionActionCode | null>> = {
  'mentor-check-in': 'mentor_meeting',
  'mentor-outreach': 'mentor_meeting',
  'prerequisite-bridge': 'targeted_remedial_plan',
  'structured-study-plan': 'structured_study_plan',
  'targeted-tutoring': 'targeted_remedial_plan',
  'pre-see-rescue': 'structured_study_plan',
  'outreach-plus-tutoring': 'targeted_remedial_plan',
  'attendance-recovery-follow-up': 'attendance_warning',
  'faculty-outreach': 'faculty_followup_reminder',
  'alert-only': 'faculty_followup_reminder',
  'no-action': null,
  support: 'generic_default_family_action',
}

const ENUM_VALUES: ReadonlySet<ProofInterventionActionCode> = new Set<ProofInterventionActionCode>([
  'attendance_warning',
  'targeted_remedial_plan',
  'structured_study_plan',
  'extra_academic_support_plan',
  'mentor_meeting',
  'faculty_followup_reminder',
  'hod_escalation_student_action',
  'generic_default_family_action',
])

export function mapLegacyInterventionTypeToActionCode(
  rawType: string | null | undefined,
): ProofInterventionActionCode | null {
  if (!rawType || typeof rawType !== 'string') return null
  const trimmed = rawType.trim()
  if (trimmed === '') return null
  if (trimmed in LEGACY_TO_ACTION_CODE) return LEGACY_TO_ACTION_CODE[trimmed]!
  // Pass-through: if the string already matches a canonical enum value, use it.
  if (ENUM_VALUES.has(trimmed as ProofInterventionActionCode)) {
    return trimmed as ProofInterventionActionCode
  }
  // Normalise kebab-case -> snake_case and try again.
  const snaked = trimmed.replace(/-/g, '_')
  if (ENUM_VALUES.has(snaked as ProofInterventionActionCode)) {
    return snaked as ProofInterventionActionCode
  }
  // Genuinely unknown — fall back to the neutral 'generic_default_family_action'
  // which has zero intervention impact and contributes nothing to the applier's
  // total — safe catch-all. Do NOT silently drop the record, so the caller still
  // sees it counted.
  return 'generic_default_family_action'
}

// ---------- Latent state JSON -> StudentLatentProfileForIntervention ----------

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function numFromRecord(record: Record<string, unknown>, key: string, fallback: number): number {
  return num(record[key], fallback)
}

// Parses a latentStateJson blob (as written by proof-control-plane-seeded-semester-
// service.ts) and extracts the minimum subset needed by the intervention-response
// engine. Newer rows store explicit dynamics/behavior/intervention objects. Older
// proof playback rows stored flat latent signals only, so we derive a conservative
// profile from those instead of silently disabling realization.
export function parseLatentProfileForIntervention(
  latentStateJson: string | null | undefined,
): StudentLatentProfileForIntervention | null {
  if (!latentStateJson || typeof latentStateJson !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(latentStateJson)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed == null) return null
  const record = parsed as Record<string, unknown>
  const dynamics = record.dynamics as Record<string, unknown> | undefined
  const behavior = record.behavior as Record<string, unknown> | undefined
  const intervention = record.intervention as Record<string, unknown> | undefined
  const hasStructuredProfile = !!dynamics && !!behavior && !!intervention
  const hasFlatLatentSignals = [
    'academicPotential',
    'selfRegulation',
    'attendanceDiscipline',
    'supportResponsiveness',
  ].some(key => typeof record[key] === 'number' && Number.isFinite(record[key]))
  if (!hasStructuredProfile && !hasFlatLatentSignals) return null

  const selfRegulation = numFromRecord(record, 'selfRegulation', 0.55)
  const supportResponsiveness = numFromRecord(record, 'supportResponsiveness', 0.5)
  const academicPotential = numFromRecord(record, 'academicPotential', 0.55)
  const attendanceDiscipline = numFromRecord(record, 'attendanceDiscipline', selfRegulation)
  const externalWorkObligation = numFromRecord(record, 'externalWorkObligation', 0.25)
  const commuteStress = numFromRecord(record, 'commuteStress', 0.35)

  const flatFallback = hasFlatLatentSignals
    ? {
        forgetRate: clamp(0.16 - (selfRegulation * 0.08) + (externalWorkObligation * 0.04), 0.02, 0.28),
        relearnRate: clamp(0.35 + (supportResponsiveness * 0.35), 0.12, 0.92),
        transferGainRate: clamp(0.25 + (academicPotential * 0.3), 0.08, 0.9),
        studyGainRate: clamp(0.3 + (selfRegulation * 0.3), 0.12, 0.92),
        fatigueRate: clamp(0.05 + (commuteStress * 0.1) + (externalWorkObligation * 0.08), 0.02, 0.3),
        consistency: clamp(0.35 + (selfRegulation * 0.45), 0.1, 0.95),
        volatility: clamp(0.36 - (selfRegulation * 0.18) + (externalWorkObligation * 0.08), 0.04, 0.62),
        recoveryTendency: clamp(0.3 + (supportResponsiveness * 0.4), 0.08, 0.94),
        relapseTendency: clamp(0.35 - (selfRegulation * 0.2) + (externalWorkObligation * 0.08), 0.02, 0.58),
        practiceCompliance: clamp(0.35 + (selfRegulation * 0.35), 0.06, 0.95),
        helpSeekingTendency: clamp(0.25 + (supportResponsiveness * 0.45), 0.05, 0.95),
        examPressure: clamp(0.3 + (externalWorkObligation * 0.2) + ((1 - selfRegulation) * 0.1), 0.05, 0.88),
        interventionReceptivity: clamp(supportResponsiveness, 0.08, 0.98),
        temporaryUpliftCredit: clamp(0.06 + (supportResponsiveness * 0.12), 0.01, 0.34),
        expectedRecoveryThreshold: clamp(0.08 + ((1 - attendanceDiscipline) * 0.08), 0.02, 0.36),
      }
    : null

  return {
    dynamics: {
      forgetRate: num(dynamics?.forgetRate, flatFallback?.forgetRate ?? 0.1),
      relearnRate: num(dynamics?.relearnRate, flatFallback?.relearnRate ?? 0.5),
      transferGainRate: num(dynamics?.transferGainRate, flatFallback?.transferGainRate ?? 0.4),
      studyGainRate: num(dynamics?.studyGainRate, flatFallback?.studyGainRate ?? 0.5),
      fatigueRate: num(dynamics?.fatigueRate, flatFallback?.fatigueRate ?? 0.1),
      consistency: num(dynamics?.consistency, flatFallback?.consistency ?? 0.55),
      volatility: num(dynamics?.volatility, flatFallback?.volatility ?? 0.22),
      recoveryTendency: num(dynamics?.recoveryTendency, flatFallback?.recoveryTendency ?? 0.5),
      relapseTendency: num(dynamics?.relapseTendency, flatFallback?.relapseTendency ?? 0.22),
    },
    behavior: {
      practiceCompliance: num(behavior?.practiceCompliance, flatFallback?.practiceCompliance ?? 0.55),
      helpSeekingTendency: num(behavior?.helpSeekingTendency, flatFallback?.helpSeekingTendency ?? 0.4),
      examPressure: num(behavior?.examPressure, flatFallback?.examPressure ?? 0.35),
    },
    intervention: {
      interventionReceptivity: num(intervention?.interventionReceptivity, flatFallback?.interventionReceptivity ?? 0.5),
      temporaryUpliftCredit: num(intervention?.temporaryUpliftCredit, flatFallback?.temporaryUpliftCredit ?? 0.1),
      expectedRecoveryThreshold: num(intervention?.expectedRecoveryThreshold, flatFallback?.expectedRecoveryThreshold ?? 0.12),
    },
  }
}

// ---------- Intervention row -> EvidenceApplierInterventionInput ----------

// Narrow row shape — keeps the fetcher decoupled from the drizzle schema import so
// the module is unit-testable without pulling in DB dependencies.
export type InterventionRowForFetcher = {
  interventionId: string
  studentId: string
  offeringId: string | null
  interventionType: string
  occurredAt: string
  createdAt: string
  semesterNumberApplied?: number | null
  stageKeyApplied?: InterventionStageKey | null
}

export function buildEvidenceApplierInterventionInput(input: {
  interventionRow: InterventionRowForFetcher
  semesterNumber: number
  stageKeyApplied: InterventionStageKey
  ordinalInStageForStudent: number
  severityContext: InterventionSeverityContext
  dominantWeaknessHint?: ProofInterventionDominantWeakness
  concernFamily?: ProofInterventionConcernFamily | null
}): EvidenceApplierInterventionInput | null {
  const actionCode = mapLegacyInterventionTypeToActionCode(input.interventionRow.interventionType)
  if (actionCode === null) return null
  return {
    caseId: input.interventionRow.interventionId,
    actionCode,
    concernFamily: input.concernFamily ?? null,
    ordinalInStageForStudent: input.ordinalInStageForStudent,
    stageKeyApplied: input.stageKeyApplied,
    semesterNumberApplied: input.semesterNumber,
    dominantWeaknessHint: input.dominantWeaknessHint ?? null,
    severityContext: input.severityContext,
  }
}

// ---------- Group interventions per (student, offering) ----------

// Takes a flat list of intervention rows plus severity / weakness context, returns a
// Map keyed `${studentId}::${offeringId ?? ''}` -> ordered EvidenceApplierIntervention-
// Input[]. The ordinal-in-stage is assigned deterministically by occurredAt order
// within each (studentId, stageKeyApplied) pair. Rows that map to null (e.g.,
// 'no-action') are dropped silently so callers receive a clean, consumable list.
export function groupInterventionsByStudentAndOffering(input: {
  interventionRows: ReadonlyArray<InterventionRowForFetcher>
  semesterNumber: number
  stageKeyApplied: InterventionStageKey
  severityContextByStudentId: ReadonlyMap<string, InterventionSeverityContext>
  dominantWeaknessByStudentId?: ReadonlyMap<string, ProofInterventionDominantWeakness>
}): Map<string, EvidenceApplierInterventionInput[]> {
  const grouped = new Map<string, EvidenceApplierInterventionInput[]>()
  const ordinalCounters = new Map<string, number>()
  // Sort by occurredAt then by interventionId for stable tie-break.
  const sorted = [...input.interventionRows].sort((left, right) => {
    const occurredCmp = left.occurredAt.localeCompare(right.occurredAt)
    if (occurredCmp !== 0) return occurredCmp
    return left.interventionId.localeCompare(right.interventionId)
  })

  for (const row of sorted) {
    const severityContext = input.severityContextByStudentId.get(row.studentId)
    if (!severityContext) continue
    const stageKeyApplied = row.stageKeyApplied ?? input.stageKeyApplied
    const semesterNumberApplied = row.semesterNumberApplied ?? input.semesterNumber
    const ordinalKey = `${row.studentId}::${semesterNumberApplied}::${stageKeyApplied}`
    const ordinal = (ordinalCounters.get(ordinalKey) ?? 0) + 1
    ordinalCounters.set(ordinalKey, ordinal)
    const appInput = buildEvidenceApplierInterventionInput({
      interventionRow: row,
      semesterNumber: semesterNumberApplied,
      stageKeyApplied,
      ordinalInStageForStudent: ordinal,
      severityContext,
      dominantWeaknessHint: input.dominantWeaknessByStudentId?.get(row.studentId) ?? null,
    })
    if (!appInput) continue
    const groupKey = `${row.studentId}::${row.offeringId ?? ''}`
    const existing = grouped.get(groupKey) ?? []
    existing.push(appInput)
    grouped.set(groupKey, existing)
  }

  return grouped
}

// ---------- Parse latent profiles in bulk from studentLatentStates rows ----------

export type LatentStateRowForFetcher = {
  studentId: string
  semesterNumber: number
  latentStateJson: string
}

// Builds a Map<studentId, StudentLatentProfileForIntervention> from the latent-state
// rows for a given semester. Rows that fail to parse are skipped and the studentId
// is absent from the map; callers should treat that as "no realization possible".
export function parseLatentProfilesForSemester(input: {
  latentStateRows: ReadonlyArray<LatentStateRowForFetcher>
  semesterNumber: number
}): Map<string, StudentLatentProfileForIntervention> {
  const profileByStudentId = new Map<string, StudentLatentProfileForIntervention>()
  for (const row of input.latentStateRows) {
    if (row.semesterNumber !== input.semesterNumber) continue
    const profile = parseLatentProfileForIntervention(row.latentStateJson)
    if (!profile) continue
    profileByStudentId.set(row.studentId, profile)
  }
  return profileByStudentId
}
