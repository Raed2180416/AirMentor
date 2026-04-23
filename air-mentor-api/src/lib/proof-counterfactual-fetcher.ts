import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client.js'
import { simulationStageCheckpoints, simulationStageStudentProjections } from '../db/schema.js'
import { parseJson } from './json.js'
import type { ProofMarkSnapshotRow } from './proof-counterfactual-reader.js'

// Counterfactual fetcher (2026-04-23).
//
// Reads simulation_stage_student_projections for one runId and projects each
// row into the ProofMarkSnapshotRow shape consumed by
// buildCounterfactualReport. Marks scalars live inside `projectionJson` under
// `currentEvidence.{tt1Pct,tt2Pct,quizPct,assignmentPct,seePct}`. When a
// scalar is missing or not numeric, null is written so the reader can skip it.

const KNOWN_STAGE_KEYS = new Set<ProofMarkSnapshotRow['stageKey']>([
  'pre-tt1',
  'post-tt1',
  'post-tt2',
  'pre-see',
  'post-see',
])

type ProjectionShape = {
  currentEvidence?: {
    tt1Pct?: number | null
    tt2Pct?: number | null
    quizPct?: number | null
    assignmentPct?: number | null
    seePct?: number | null
  } | null
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

export async function fetchCounterfactualSnapshotRows(
  dbInstance: AppDb,
  input: { simulationRunId: string },
): Promise<ProofMarkSnapshotRow[]> {
  // Load all checkpoints for the run so we can map checkpointId -> stageKey.
  const checkpoints = await dbInstance
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

  const projections = await dbInstance
    .select({
      simulationStageCheckpointId: simulationStageStudentProjections.simulationStageCheckpointId,
      studentId: simulationStageStudentProjections.studentId,
      projectionJson: simulationStageStudentProjections.projectionJson,
      semesterNumber: simulationStageStudentProjections.semesterNumber,
    })
    .from(simulationStageStudentProjections)
    .where(eq(simulationStageStudentProjections.simulationRunId, input.simulationRunId))

  // A student may have multiple course-level projections per checkpoint (one
  // per offering). We aggregate marks per (student, stage) by taking the
  // mean across offerings for each scalar. This matches how the UI's
  // "per-student per-stage" mark is conceptualised in the demo surfaces.
  const perKey = new Map<string, {
    studentId: string
    semesterNumber: number
    stageKey: ProofMarkSnapshotRow['stageKey']
    samples: {
      tt1Pct: number[]
      tt2Pct: number[]
      quizPct: number[]
      assignmentPct: number[]
      seePct: number[]
    }
  }>()

  for (const row of projections) {
    const checkpoint = checkpointById.get(row.simulationStageCheckpointId)
    if (!checkpoint) continue
    const stageKey = checkpoint.stageKey as ProofMarkSnapshotRow['stageKey']
    if (!KNOWN_STAGE_KEYS.has(stageKey)) continue
    const semesterNumber = Number(row.semesterNumber ?? checkpoint.semesterNumber)
    if (!Number.isFinite(semesterNumber)) continue
    const key = `${row.studentId}::${semesterNumber}::${stageKey}`
    const bucket = perKey.get(key) ?? {
      studentId: String(row.studentId),
      semesterNumber,
      stageKey,
      samples: {
        tt1Pct: [] as number[],
        tt2Pct: [] as number[],
        quizPct: [] as number[],
        assignmentPct: [] as number[],
        seePct: [] as number[],
      },
    }
    const projection = parseJson<ProjectionShape>(row.projectionJson, {})
    const evidence = projection?.currentEvidence ?? null
    if (evidence) {
      const tt1 = toNumberOrNull(evidence.tt1Pct)
      const tt2 = toNumberOrNull(evidence.tt2Pct)
      const quiz = toNumberOrNull(evidence.quizPct)
      const asgn = toNumberOrNull(evidence.assignmentPct)
      const see = toNumberOrNull(evidence.seePct)
      if (tt1 !== null) bucket.samples.tt1Pct.push(tt1)
      if (tt2 !== null) bucket.samples.tt2Pct.push(tt2)
      if (quiz !== null) bucket.samples.quizPct.push(quiz)
      if (asgn !== null) bucket.samples.assignmentPct.push(asgn)
      if (see !== null) bucket.samples.seePct.push(see)
    }
    perKey.set(key, bucket)
  }

  function mean(values: number[]): number | null {
    if (values.length === 0) return null
    const sum = values.reduce((s, v) => s + v, 0)
    return Math.round((sum / values.length) * 100) / 100
  }

  const rows: ProofMarkSnapshotRow[] = []
  for (const bucket of perKey.values()) {
    const tt1Pct = mean(bucket.samples.tt1Pct)
    const tt2Pct = mean(bucket.samples.tt2Pct)
    const quizPct = mean(bucket.samples.quizPct)
    const assignmentPct = mean(bucket.samples.assignmentPct)
    const seePct = mean(bucket.samples.seePct)
    const totalSamples = [tt1Pct, tt2Pct, quizPct, assignmentPct, seePct].filter(v => v !== null) as number[]
    const totalPct = totalSamples.length === 0
      ? null
      : Math.round((totalSamples.reduce((s, v) => s + v, 0) / totalSamples.length) * 100) / 100
    rows.push({
      studentId: bucket.studentId,
      semesterNumber: bucket.semesterNumber,
      stageKey: bucket.stageKey,
      tt1Pct,
      tt2Pct,
      quizPct,
      assignmentPct,
      seePct,
      totalPct,
    })
  }

  // Deterministic ordering so downstream reporting is stable.
  const stageOrder = ['pre-tt1', 'post-tt1', 'post-tt2', 'pre-see', 'post-see']
  rows.sort((a, b) => {
    if (a.semesterNumber !== b.semesterNumber) return a.semesterNumber - b.semesterNumber
    const aIdx = stageOrder.indexOf(a.stageKey)
    const bIdx = stageOrder.indexOf(b.stageKey)
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.studentId.localeCompare(b.studentId)
  })
  return rows
}
