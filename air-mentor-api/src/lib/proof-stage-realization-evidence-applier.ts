// Evidence-applier — pure helper that takes a baseline stage-evidence snapshot and
// a list of interventions applied in the current stage window, returning the realized
// evidence snapshot with intervention deltas folded in.
//
// This is the render-side counterpart to the stage-realization service in Phase 4.
// Existing DB assessment rows are treated as the baseline trajectory (what the student
// WOULD score with no intervention). When AIRMENTOR_STAGE_REALIZATION_V1=1 is set, UI
// callers invoke this applier to project the baseline onto an intervention-adjusted
// view. When the flag is off, the applier is a no-op pass-through.
//
// Why render-side instead of write-side:
//   1. Zero DB schema change
//   2. Baseline always preserved in DB -> free Phase-11 counterfactual analytics
//   3. Flag toggle is reversible — unset and the UI returns to baseline
//   4. No race conditions with activation / seeded-run writes
//
// Determinism: same (runId, studentId, baseline, intervention sequence) -> identical
// realized output bytewise. Every draw lives on a stable hash-keyed seed.

import type {
  AssessmentType,
  InterventionImpactTier,
  StudentLatentProfileForIntervention,
  InterventionApplication,
  InterventionStageKey,
  ProofInterventionActionCode,
  ProofInterventionConcernFamily,
  ProofInterventionDominantWeakness,
  InterventionSeverityContext,
} from './proof-intervention-response-types.js'
import {
  sumInterventionImpacts,
} from './proof-intervention-response-engine.js'
import {
  ASSESSMENT_BOUNDS,
  computeMarkDelta,
} from './proof-world-realism-engine.js'
import {
  STAGE_REALIZATION_FLAG_NAME,
  isStageRealizationEnabled,
} from './proof-stage-realization-service.js'

// ---------- Types ----------

export type StageBaselineEvidence = {
  attendancePct: number
  tt1Pct: number | null
  tt2Pct: number | null
  quizPct: number | null
  assignmentPct: number | null
  seePct: number | null
  cePct: number | null
}

// Intervention record minimally enough for the applier. Matches the input shape
// accepted by the stage-realization-service orchestrator but keeps the contract narrow.
export type EvidenceApplierInterventionInput = {
  caseId: string
  actionCode: ProofInterventionActionCode
  concernFamily: ProofInterventionConcernFamily | null
  ordinalInStageForStudent: number
  stageKeyApplied: InterventionStageKey
  semesterNumberApplied: number
  dominantWeaknessHint: ProofInterventionDominantWeakness
  severityContext: InterventionSeverityContext
}

export type EvidenceRealizationInput = {
  baseline: StageBaselineEvidence
  studentProfile: StudentLatentProfileForIntervention
  runId: string
  studentId: string
  semesterNumber: number
  stageKey: InterventionStageKey
  interventionsInWindow: ReadonlyArray<EvidenceApplierInterventionInput>
}

export type EvidenceRealizationOutput = {
  realized: StageBaselineEvidence
  impact: {
    totalImpact: number
    dominantTier: InterventionImpactTier | null
    appliedCount: number
    markDeltas: Readonly<Record<AssessmentType, number>>
  }
  flagOn: boolean
}

// ---------- Helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// Apply a numeric delta to a possibly-null baseline field, clamped to the assessment
// bounds. Returns null unchanged when baseline is null (future-stage assessment not
// yet realized).
function applyDelta(
  baseline: number | null,
  delta: number,
  bounds: { min: number; max: number },
): number | null {
  if (baseline == null) return null
  return roundTo(clamp(baseline + delta, bounds.min, bounds.max), 2)
}

// Rebuild CE from the possibly-shifted component marks, preserving the baseline CE
// noise residual so the intervention delta flows only through the components.
function rebuildCePct(input: {
  baselineCePct: number | null
  baselineTt1: number | null
  baselineTt2: number | null
  baselineQuiz: number | null
  baselineAssignment: number | null
  newTt1: number | null
  newTt2: number | null
  newQuiz: number | null
  newAssignment: number | null
}): number | null {
  if (input.baselineCePct == null) return null
  // If any component is null (future stage), we cannot meaningfully rebuild CE; keep
  // baseline as-is.
  if (input.baselineTt1 == null || input.baselineTt2 == null
    || input.baselineQuiz == null || input.baselineAssignment == null) {
    return input.baselineCePct
  }
  const newTt1 = input.newTt1 ?? input.baselineTt1
  const newTt2 = input.newTt2 ?? input.baselineTt2
  const newQuiz = input.newQuiz ?? input.baselineQuiz
  const newAssignment = input.newAssignment ?? input.baselineAssignment
  const baselineWeighted =
      input.baselineTt1 * 0.28
    + input.baselineTt2 * 0.27
    + input.baselineQuiz * 0.2
    + input.baselineAssignment * 0.25
  const baselineNoise = input.baselineCePct - baselineWeighted
  const newWeighted =
      newTt1 * 0.28
    + newTt2 * 0.27
    + newQuiz * 0.2
    + newAssignment * 0.25
  return roundTo(clamp(newWeighted + baselineNoise, 10, 97), 2)
}

// ---------- Entry point ----------

export function applyRealizationToEvidenceSnapshot(
  input: EvidenceRealizationInput,
): EvidenceRealizationOutput {
  const flagOn = isStageRealizationEnabled()
  const zeroDeltas: Record<AssessmentType, number> = {
    attendance: 0,
    tt1: 0,
    tt2: 0,
    quiz: 0,
    assignment: 0,
    see: 0,
  }

  // Fast path — flag off OR no interventions: return baseline unchanged.
  if (!flagOn || input.interventionsInWindow.length === 0) {
    return {
      realized: { ...input.baseline },
      impact: {
        totalImpact: 0,
        dominantTier: null,
        appliedCount: 0,
        markDeltas: zeroDeltas,
      },
      flagOn,
    }
  }

  const applications = input.interventionsInWindow.map(entry => ({
    application: {
      runId: input.runId,
      studentId: input.studentId,
      semesterNumber: entry.semesterNumberApplied,
      stageKey: entry.stageKeyApplied,
      caseId: entry.caseId,
      actionCode: entry.actionCode,
      concernFamily: entry.concernFamily,
      ordinalInStageForStudent: entry.ordinalInStageForStudent,
      severityContext: entry.severityContext,
      dominantWeaknessHint: entry.dominantWeaknessHint,
    } satisfies InterventionApplication,
    profile: input.studentProfile,
  }))

  const impactSummary = sumInterventionImpacts(applications)

  const markDeltas: Record<AssessmentType, number> = {
    attendance: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'attendance',
    }),
    tt1: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'tt1',
    }),
    tt2: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'tt2',
    }),
    quiz: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'quiz',
    }),
    assignment: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'assignment',
    }),
    see: computeMarkDelta({
      totalInterventionImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      assessmentType: 'see',
    }),
  }

  const newAttendance = roundTo(clamp(
    input.baseline.attendancePct + markDeltas.attendance,
    ASSESSMENT_BOUNDS.attendance.min,
    ASSESSMENT_BOUNDS.attendance.max,
  ), 2)
  const newTt1 = applyDelta(input.baseline.tt1Pct, markDeltas.tt1, ASSESSMENT_BOUNDS.tt1)
  const newTt2 = applyDelta(input.baseline.tt2Pct, markDeltas.tt2, ASSESSMENT_BOUNDS.tt2)
  const newQuiz = applyDelta(input.baseline.quizPct, markDeltas.quiz, ASSESSMENT_BOUNDS.quiz)
  const newAssignment = applyDelta(input.baseline.assignmentPct, markDeltas.assignment, ASSESSMENT_BOUNDS.assignment)
  const newSee = applyDelta(input.baseline.seePct, markDeltas.see, ASSESSMENT_BOUNDS.see)
  const newCe = rebuildCePct({
    baselineCePct: input.baseline.cePct,
    baselineTt1: input.baseline.tt1Pct,
    baselineTt2: input.baseline.tt2Pct,
    baselineQuiz: input.baseline.quizPct,
    baselineAssignment: input.baseline.assignmentPct,
    newTt1,
    newTt2,
    newQuiz,
    newAssignment,
  })

  return {
    realized: {
      attendancePct: newAttendance,
      tt1Pct: newTt1,
      tt2Pct: newTt2,
      quizPct: newQuiz,
      assignmentPct: newAssignment,
      seePct: newSee,
      cePct: newCe,
    },
    impact: {
      totalImpact: impactSummary.totalImpact,
      dominantTier: impactSummary.dominantTier,
      appliedCount: impactSummary.appliedCount,
      markDeltas,
    },
    flagOn,
  }
}

// Re-export the flag name so callers can inspect or toggle env in test harnesses.
export { STAGE_REALIZATION_FLAG_NAME }
