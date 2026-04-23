// Phase-11 simulator counterfactual fetcher (2026-04-23).
//
// Loads the stored simulator projection rows for ONE run and shapes them
// into the input rows the buildSimulatorCounterfactualReport aggregator
// consumes. All per-stage, per-student, per-offering rows come from
// simulation_stage_student_projections which is populated by
// proof-control-plane-playback-governance-service.
//
// This is the authoritative demo-final path for "with-intervention vs
// without-intervention" analytics — see prompt §G.6 + §C.13 + §L.10.

import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import { simulationStageCheckpoints, simulationStageStudentProjections } from '../db/schema.js'
import { parseJson } from './json.js'
import type {
  RealizedEvidence,
  SimulatorProjectionInputRow,
} from './proof-counterfactual-simulator-aggregator.js'

type ProjectionJsonShape = {
  stageKey?: string
  currentEvidence?: {
    attendancePct?: number | null
    tt1Pct?: number | null
    tt2Pct?: number | null
    quizPct?: number | null
    assignmentPct?: number | null
    seePct?: number | null
    weakCoCount?: number | null
    weakQuestionCount?: number | null
    interventionRecoveryStatus?: string | null
  } | null
  currentStatus?: {
    policyComparison?: {
      simulatedActionTaken?: string | null
    } | null
  } | null
}

const KNOWN_STAGE_KEYS: ReadonlySet<SimulatorProjectionInputRow['stageKey']> = new Set([
  'pre-tt1',
  'post-tt1',
  'post-tt2',
  'post-assignments',
  'post-see',
])

const KNOWN_RISK_BANDS: ReadonlySet<'High' | 'Medium' | 'Low'> = new Set(['High', 'Medium', 'Low'])

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

function toFiniteNumberOrZero(value: unknown): number {
  return toFiniteNumber(value) ?? 0
}

function coerceRiskBand(value: unknown): 'High' | 'Medium' | 'Low' {
  // Default to Low if band is missing/malformed so aggregator band-transition
  // math stays deterministic. The simulator always writes a valid band, so
  // this fallback is belt-and-braces only.
  if (typeof value === 'string' && KNOWN_RISK_BANDS.has(value as 'High' | 'Medium' | 'Low')) {
    return value as 'High' | 'Medium' | 'Low'
  }
  return 'Low'
}

export async function fetchSimulatorProjectionRows(
  db: AppDb,
  input: { simulationRunId: string },
): Promise<SimulatorProjectionInputRow[]> {
  const checkpoints = await db
    .select({
      checkpointId: simulationStageCheckpoints.simulationStageCheckpointId,
      stageKey: simulationStageCheckpoints.stageKey,
      semesterNumber: simulationStageCheckpoints.semesterNumber,
    })
    .from(simulationStageCheckpoints)
    .where(eq(simulationStageCheckpoints.simulationRunId, input.simulationRunId))

  const checkpointById = new Map<string, { stageKey: string; semesterNumber: number }>()
  for (const row of checkpoints) {
    checkpointById.set(row.checkpointId, {
      stageKey: String(row.stageKey),
      semesterNumber: Number(row.semesterNumber),
    })
  }

  const projectionRows = await db
    .select({
      simulationStageCheckpointId: simulationStageStudentProjections.simulationStageCheckpointId,
      studentId: simulationStageStudentProjections.studentId,
      offeringId: simulationStageStudentProjections.offeringId,
      semesterNumber: simulationStageStudentProjections.semesterNumber,
      sectionCode: simulationStageStudentProjections.sectionCode,
      courseCode: simulationStageStudentProjections.courseCode,
      courseTitle: simulationStageStudentProjections.courseTitle,
      riskProbScaled: simulationStageStudentProjections.riskProbScaled,
      riskBand: simulationStageStudentProjections.riskBand,
      noActionRiskProbScaled: simulationStageStudentProjections.noActionRiskProbScaled,
      noActionRiskBand: simulationStageStudentProjections.noActionRiskBand,
      simulatedActionTaken: simulationStageStudentProjections.simulatedActionTaken,
      projectionJson: simulationStageStudentProjections.projectionJson,
    })
    .from(simulationStageStudentProjections)
    .where(eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId))

  const results: SimulatorProjectionInputRow[] = []
  for (const row of projectionRows) {
    const checkpoint = checkpointById.get(row.simulationStageCheckpointId)
    if (!checkpoint) continue
    // Stage key source of truth: checkpoint table (not JSON payload). If
    // somehow unknown, skip so aggregator doesn't receive invalid stage.
    const stageKey = checkpoint.stageKey as SimulatorProjectionInputRow['stageKey']
    if (!KNOWN_STAGE_KEYS.has(stageKey)) continue

    const projection = parseJson<ProjectionJsonShape>(row.projectionJson, {})
    const evidence = projection?.currentEvidence ?? null
    // The aggregator tolerates missing marks via null fields; construct a
    // RealizedEvidence with best-effort scalar extraction.
    const realizedEvidence: RealizedEvidence = {
      attendancePct: toFiniteNumberOrZero(evidence?.attendancePct),
      tt1Pct: toFiniteNumber(evidence?.tt1Pct),
      tt2Pct: toFiniteNumber(evidence?.tt2Pct),
      quizPct: toFiniteNumber(evidence?.quizPct),
      assignmentPct: toFiniteNumber(evidence?.assignmentPct),
      seePct: toFiniteNumber(evidence?.seePct),
      weakCoCount: Math.max(0, Math.round(toFiniteNumberOrZero(evidence?.weakCoCount))),
      weakQuestionCount: Math.max(0, Math.round(toFiniteNumberOrZero(evidence?.weakQuestionCount))),
      // interventionResponseScore lives deeper in projectionJson when available,
      // but the Phase-11 aggregator only uses it for mark reconstruction and
      // the governance service strips it from currentEvidence. Pass null so
      // aggregator applies the mid-stage default behaviour.
      interventionResponseScore: null,
    }

    // simulatedActionTaken: top-level column is authoritative; fall back to
    // JSON payload for defence in depth.
    const simulatedActionTaken = (typeof row.simulatedActionTaken === 'string' && row.simulatedActionTaken.length > 0)
      ? row.simulatedActionTaken
      : projection?.currentStatus?.policyComparison?.simulatedActionTaken ?? null

    results.push({
      studentId: String(row.studentId),
      offeringId: row.offeringId == null ? null : String(row.offeringId),
      semesterNumber: Number(row.semesterNumber ?? checkpoint.semesterNumber),
      sectionCode: String(row.sectionCode),
      courseCode: String(row.courseCode),
      courseTitle: String(row.courseTitle),
      stageKey,
      riskProbScaled: Number(row.riskProbScaled),
      riskBand: coerceRiskBand(row.riskBand),
      noActionRiskProbScaled: Number(row.noActionRiskProbScaled),
      noActionRiskBand: coerceRiskBand(row.noActionRiskBand),
      simulatedActionTaken,
      realizedEvidence,
    })
  }

  return results
}
